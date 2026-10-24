const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_store',
    port: parseInt(process.env.DB_PORT, 10) || 3306
  });
  
  console.log('Testing query performance on 8,010 products...');
  
  const start1 = Date.now();
  const [rows1] = await pool.query('SELECT *, stock_quantity AS stock FROM products ORDER BY id ASC LIMIT 12 OFFSET 0');
  const dur1 = Date.now() - start1;
  console.log('Page 1 query (LIMIT 12 OFFSET 0):', dur1, 'ms, returned:', rows1.length, 'rows');

  const start2 = Date.now();
  const [rows2] = await pool.query('SELECT *, stock_quantity AS stock FROM products ORDER BY id ASC LIMIT 12 OFFSET 3600');
  const dur2 = Date.now() - start2;
  console.log('Page 300 query (LIMIT 12 OFFSET 3600):', dur2, 'ms, returned:', rows2.length, 'rows');

  const start3 = Date.now();
  const [rows3] = await pool.query('SELECT *, stock_quantity AS stock FROM products WHERE category = ? ORDER BY id ASC LIMIT 12 OFFSET 0', ['Home & Garden']);
  const dur3 = Date.now() - start3;
  console.log('Category filter query ("Home & Garden"):', dur3, 'ms, returned:', rows3.length, 'rows');

  const start4 = Date.now();
  const [rows4] = await pool.query('SELECT *, stock_quantity AS stock FROM products WHERE name LIKE ? ORDER BY id ASC LIMIT 12 OFFSET 0', ['%Hat%']);
  const dur4 = Date.now() - start4;
  console.log('Search query ("Hat"):', dur4, 'ms, returned:', rows4.length, 'rows');

  const [cnt] = await pool.query('SELECT COUNT(*) as cnt FROM products');
  console.log('Exact row count in MySQL:', cnt[0].cnt);

  await pool.end();
})();
