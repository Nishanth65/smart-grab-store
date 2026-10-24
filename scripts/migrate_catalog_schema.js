const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateSchema() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_store',
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Connecting to MySQL database...');
    const [cols] = await pool.query('DESCRIBE products');
    const colNames = cols.map(c => c.Field);
    console.log('Current columns:', colNames.join(', '));

    // 1. Modify price to be NULLABLE
    console.log('Modifying price column to NULLable...');
    await pool.query('ALTER TABLE products MODIFY COLUMN price DECIMAL(10,2) NULL');

    // 2. Add price_status if not exists
    if (!colNames.includes('price_status')) {
      console.log('Adding price_status column...');
      await pool.query("ALTER TABLE products ADD COLUMN price_status ENUM('verified', 'unverified') NOT NULL DEFAULT 'unverified' AFTER price");
    }

    // 3. Add is_purchasable if not exists
    if (!colNames.includes('is_purchasable')) {
      console.log('Adding is_purchasable column...');
      await pool.query("ALTER TABLE products ADD COLUMN is_purchasable BOOLEAN NOT NULL DEFAULT FALSE AFTER price_status");
    }

    // 4. Add stock_status if not exists
    if (!colNames.includes('stock_status')) {
      console.log('Adding stock_status column...');
      await pool.query("ALTER TABLE products ADD COLUMN stock_status ENUM('in_stock', 'out_of_stock', 'unverified') NOT NULL DEFAULT 'unverified' AFTER stock_quantity");
    }

    // 5. Add source_dataset if not exists
    if (!colNames.includes('source_dataset')) {
      console.log('Adding source_dataset column...');
      await pool.query("ALTER TABLE products ADD COLUMN source_dataset VARCHAR(50) DEFAULT 'shopify_catalogue' AFTER badge");
    }

    // 6. Add source_id if not exists
    if (!colNames.includes('source_id')) {
      console.log('Adding source_id column...');
      await pool.query("ALTER TABLE products ADD COLUMN source_id VARCHAR(100) NULL AFTER source_dataset");
      await pool.query("ALTER TABLE products ADD UNIQUE KEY uq_source_id (source_id)");
    }

    // 7. Add indexes if not exists
    const [indexes] = await pool.query('SHOW INDEX FROM products');
    const indexNames = new Set(indexes.map(i => i.Key_name));

    if (!indexNames.has('idx_price_status')) {
      console.log('Adding idx_price_status...');
      await pool.query('ALTER TABLE products ADD INDEX idx_price_status (price_status)');
    }
    if (!indexNames.has('idx_category_brand')) {
      console.log('Adding idx_category_brand...');
      await pool.query('ALTER TABLE products ADD INDEX idx_category_brand (category, brand)');
    }
    if (!indexNames.has('idx_stock_status')) {
      console.log('Adding idx_stock_status...');
      await pool.query('ALTER TABLE products ADD INDEX idx_stock_status (stock_status)');
    }

    // 8. Update original products (IDs 1-10) to verified and purchasable
    console.log('Marking original 10 products as verified and purchasable...');
    await pool.query(`
      UPDATE products
      SET price_status = 'verified',
          is_purchasable = TRUE,
          stock_status = IF(stock_quantity > 0, 'in_stock', 'out_of_stock'),
          source_dataset = 'aurastore_original',
          source_id = CONCAT('original_', id)
      WHERE id <= 10 AND (source_id IS NULL OR source_id LIKE 'original_%')
    `);

    console.log('Schema migration completed successfully!');
    const [updatedCols] = await pool.query('DESCRIBE products');
    console.log('Updated columns:');
    updatedCols.forEach(c => console.log(`  - ${c.Field}: ${c.Type} (Null: ${c.Null}, Default: ${c.Default})`));

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateSchema();
