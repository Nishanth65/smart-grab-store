const https = require('https');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration
const ARGS = process.argv.slice(2);
let TARGET_COUNT = 100; // default for staged test
const targetArgIdx = ARGS.indexOf('--target');
if (targetArgIdx !== -1 && ARGS[targetArgIdx + 1]) {
  TARGET_COUNT = parseInt(ARGS[targetArgIdx + 1], 10);
}
const BATCH_SIZE = 100;
const CONCURRENT_IMAGE_DOWNLOADS = 6;
const IMAGES_PER_PARTITION = 500;

const BASE_IMAGE_DIR = path.join(__dirname, '..', 'public', 'images', 'products', 'catalog');
const REPORT_FILE = path.join(__dirname, 'import_report.json');

// Helper: HTTP GET as Promise
function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SmartGrabStoreImporter/1.0',
        ...options.headers
      },
      timeout: 30000
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, options).then(resolve).catch(reject);
      }
      if (options.stream) {
        return resolve(res);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

// Download image and save to disk
async function downloadImageFile(imgUrl, destPath) {
  if (fs.existsSync(destPath)) {
    const stats = fs.statSync(destPath);
    if (stats.size > 500) return true; // Already downloaded
  }

  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await httpGet(imgUrl, { stream: true });
      if (res.statusCode !== 200) {
        res.resume();
        if (attempt === 3) return false;
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      await new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(resolve);
        });
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });
      return true;
    } catch (err) {
      if (attempt === 3) return false;
      await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  return false;
}

// Helper: Download multiple images concurrently with pool limit
async function downloadImagesInPool(items, concurrency = 6) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const success = await downloadImageFile(item.url, item.destPath);
        results[currentIndex] = success;
      } catch (err) {
        results[currentIndex] = false;
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length)).fill(0).map(() => worker());
  await Promise.all(workers);
  return results;
}

// Clean and parse category
function extractPrimaryCategory(catPath) {
  if (!catPath || typeof catPath !== 'string') return 'General';
  const parts = catPath.split('>').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return 'General';
  // Use primary high-level category for clean filtering
  return parts[0].slice(0, 100);
}

async function main() {
  console.log('====================================================');
  console.log(`SMART GRAB STORE: SHOPIFY CATALOG IMPORTER`);
  console.log(`Target Count: ${TARGET_COUNT} products`);
  console.log(`Base Image Directory: ${BASE_IMAGE_DIR}`);
  console.log('====================================================');

  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_store',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10
  });

  const startTime = Date.now();
  let totalImported = 0;
  let totalSkipped = 0;
  let totalImagesDownloaded = 0;
  let totalImagesFailed = 0;
  const categoryCounts = {};

  try {
    if (!fs.existsSync(BASE_IMAGE_DIR)) {
      fs.mkdirSync(BASE_IMAGE_DIR, { recursive: true });
    }

    let currentOffset = 0;
    const totalBatches = Math.ceil(TARGET_COUNT / BATCH_SIZE);

    for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
      const remaining = TARGET_COUNT - totalImported;
      const limit = Math.min(BATCH_SIZE, remaining);
      if (limit <= 0) break;

      const apiUrl = `https://datasets-server.huggingface.co/rows?dataset=Shopify/product-catalogue&config=default&split=train&offset=${currentOffset}&limit=${limit}`;
      console.log(`\n[Batch ${batchNum}/${totalBatches}] Fetching rows from offset ${currentOffset} (limit ${limit})...`);

      let apiResponse;
      for (let retry = 1; retry <= 3; retry++) {
        try {
          const res = await httpGet(apiUrl);
          if (res.statusCode === 200) {
            apiResponse = JSON.parse(res.body);
            break;
          } else if (res.statusCode === 429) {
            console.warn(`[Batch ${batchNum}] Rate limited (429). Backing off for ${retry * 3}s...`);
            await new Promise(r => setTimeout(r, retry * 3000));
          } else {
            throw new Error(`API returned HTTP ${res.statusCode}: ${res.body.slice(0, 200)}`);
          }
        } catch (err) {
          console.warn(`[Batch ${batchNum}] Error fetching API (attempt ${retry}): ${err.message}`);
          if (retry === 3) throw err;
          await new Promise(r => setTimeout(r, 2000 * retry));
        }
      }

      const rows = apiResponse.rows || [];
      if (rows.length === 0) {
        console.log(`[Batch ${batchNum}] No more rows returned by API.`);
        break;
      }

      console.log(`[Batch ${batchNum}] Retrieved ${rows.length} product records.`);

      // 1. Prepare images to download
      const imageDownloadQueue = [];
      const preparedProducts = [];

      for (const item of rows) {
        const row = item.row;
        const rowIdx = item.row_idx;
        const sourceId = `shopify_${rowIdx}`;

        const partitionNum = Math.floor(rowIdx / IMAGES_PER_PARTITION) + 1;
        const partitionFolder = `part_${String(partitionNum).padStart(2, '0')}`;
        const filename = `item_${rowIdx}.jpg`;
        const relativeImagePath = `/images/products/catalog/${partitionFolder}/${filename}`;
        const localFsPath = path.join(BASE_IMAGE_DIR, partitionFolder, filename);

        const imgUrl = row.product_image && row.product_image.src ? row.product_image.src : null;
        if (imgUrl) {
          imageDownloadQueue.push({
            rowIdx,
            url: imgUrl,
            destPath: localFsPath
          });
        }

        const title = (row.product_title || 'Untitled Product').trim().slice(0, 200);
        const description = (row.product_description || title).trim();
        const brand = (row.ground_truth_brand || 'Shopify Select').trim().slice(0, 100);
        const category = extractPrimaryCategory(row.ground_truth_category);

        categoryCounts[category] = (categoryCounts[category] || 0) + 1;

        preparedProducts.push({
          sourceId,
          name: title,
          description,
          category,
          brand,
          image_url: imgUrl ? relativeImagePath : '/images/placeholder.jpg',
          price: null,
          price_status: 'unverified',
          is_purchasable: 0,
          stock_quantity: 0,
          stock_status: 'unverified',
          rating: null,
          reviews_count: 0,
          badge: null,
          source_dataset: 'shopify_catalogue'
        });
      }

      // 2. Download Images concurrently
      console.log(`[Batch ${batchNum}] Downloading ${imageDownloadQueue.length} images...`);
      const downloadResults = await downloadImagesInPool(imageDownloadQueue, CONCURRENT_IMAGE_DOWNLOADS);
      const successfulDownloads = downloadResults.filter(Boolean).length;
      totalImagesDownloaded += successfulDownloads;
      totalImagesFailed += (imageDownloadQueue.length - successfulDownloads);
      console.log(`[Batch ${batchNum}] Images saved: ${successfulDownloads} succeeded, ${imageDownloadQueue.length - successfulDownloads} failed.`);

      // 3. MySQL Transaction: Insert products with duplicate check
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const insertSql = `
          INSERT INTO products (
            source_id, name, description, category, brand, image_url,
            price, price_status, is_purchasable, stock_quantity, stock_status,
            rating, reviews_count, badge, source_dataset
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            category = VALUES(category),
            brand = VALUES(brand),
            image_url = VALUES(image_url)
        `;

        for (const p of preparedProducts) {
          await conn.query(insertSql, [
            p.sourceId, p.name, p.description, p.category, p.brand, p.image_url,
            p.price, p.price_status, p.is_purchasable, p.stock_quantity, p.stock_status,
            p.rating, p.reviews_count, p.badge, p.source_dataset
          ]);
          totalImported++;
        }

        await conn.commit();
        console.log(`[Batch ${batchNum}] Transaction committed. Products inserted/updated: ${preparedProducts.length}.`);
      } catch (dbErr) {
        await conn.rollback();
        console.error(`[Batch ${batchNum}] DB error, transaction rolled back:`, dbErr.message);
        throw dbErr;
      } finally {
        conn.release();
      }

      currentOffset += rows.length;
      console.log(`Progress: ${totalImported}/${TARGET_COUNT} products imported.`);

      // Polite delay between batches
      if (batchNum < totalBatches) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    const [finalCountRow] = await pool.query('SELECT COUNT(*) AS cnt FROM products');
    const totalInDb = finalCountRow[0].cnt;

    const report = {
      timestamp: new Date().toISOString(),
      durationSeconds: durationSec,
      targetRequested: TARGET_COUNT,
      productsImportedThisRun: totalImported,
      totalProductsInDatabase: totalInDb,
      imagesDownloaded: totalImagesDownloaded,
      imagesFailed: totalImagesFailed,
      categoriesFound: categoryCounts
    };

    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));

    console.log('\n====================================================');
    console.log(`IMPORT COMPLETED SUCCESSFULLY in ${durationSec}s`);
    console.log(`Products Imported: ${totalImported}`);
    console.log(`Total Products in Database: ${totalInDb}`);
    console.log(`Images Downloaded: ${totalImagesDownloaded}`);
    console.log(`Categories Represented: ${Object.keys(categoryCounts).length}`);
    console.log(`Report saved to: ${REPORT_FILE}`);
    console.log('====================================================');

  } catch (err) {
    console.error('\n[FATAL] Import pipeline failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
