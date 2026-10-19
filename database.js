const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Path to SQLite database file
const dbPath = path.join(__dirname, 'store.db');

// Connect to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Promise-based helper functions for clean async/await in server.js
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Indian dataset for seeding products table
const initialProducts = [
  {
    name: 'Premium Cotton Kurta',
    description: 'Breathable, 100% pure cotton kurta with a mandarin collar.',
    price: 1499.00,
    image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
    category: 'Ethnic Wear',
    stock: 45
  },
  {
    name: 'Kulhad Chai Mug Set',
    description: 'Authentic terracotta clay mugs for traditional chai.',
    price: 499.00,
    image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?q=80&w=800&auto=format&fit=crop',
    category: 'Home',
    stock: 120
  },
  {
    name: 'TWS Bluetooth Earbuds',
    description: 'True wireless earbuds with 40 hours playtime and deep bass.',
    price: 2499.00,
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=800&auto=format&fit=crop',
    category: 'Electronics',
    stock: 60
  },
  {
    name: 'Handcrafted Leather Wallet',
    description: 'Genuine leather bi-fold wallet with RFID blocking.',
    price: 899.00,
    image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?q=80&w=800&auto=format&fit=crop',
    category: 'Accessories',
    stock: 35
  },
  {
    name: 'Classic Denim Jacket',
    description: 'Vintage-wash rugged denim jacket.',
    price: 1999.00,
    image_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800&auto=format&fit=crop',
    category: 'Apparel',
    stock: 25
  },
  {
    name: 'Smart Fitness Band',
    description: 'Track steps, heart rate, and sleep with a 10-day battery.',
    price: 3499.00,
    image_url: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?q=80&w=800&auto=format&fit=crop',
    category: 'Electronics',
    stock: 15
  },
  {
    name: 'Ethnic Jutti (Women)',
    description: 'Traditional hand-embroidered Punjabi juttis.',
    price: 1299.00,
    image_url: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?q=80&w=800&auto=format&fit=crop',
    category: 'Footwear',
    stock: 40
  },
  {
    name: 'Anti-Theft Laptop Backpack',
    description: 'Water-resistant backpack with USB charging port.',
    price: 1199.00,
    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800&auto=format&fit=crop',
    category: 'Bags',
    stock: 80
  }
];

// Initialize schema and seed database
function initDatabase() {
  db.serialize(() => {
    // Enable SQLite foreign key constraints
    db.run('PRAGMA foreign_keys = ON;');

    // 1. Users Table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Products Table
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        category TEXT,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Orders Table
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        shipping_address TEXT NOT NULL,
        total_amount REAL NOT NULL,
        status TEXT DEFAULT 'Processing',
        items TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // Check if products table is empty, and seed the dataset
    db.get('SELECT COUNT(*) AS count FROM products;', (err, row) => {
      if (err) {
        console.error('Error verifying products table:', err.message);
        return;
      }

      if (row && row.count === 0) {
        console.log('Products table is empty. Seeding initial Indian products dataset...');
        const stmt = db.prepare(`
          INSERT INTO products (name, description, price, image_url, category, stock)
          VALUES (?, ?, ?, ?, ?, ?);
        `);

        initialProducts.forEach((product) => {
          stmt.run([
            product.name,
            product.description,
            product.price,
            product.image_url,
            product.category,
            product.stock
          ]);
        });

        stmt.finalize((finalizeErr) => {
          if (finalizeErr) {
            console.error('Error finalizing seed statement:', finalizeErr.message);
          } else {
            console.log(`Successfully seeded ${initialProducts.length} products into the database.`);
          }
        });
      } else {
        console.log(`Database already contains ${row.count} products. Skipping seeding.`);
      }
    });
  });
}

// Execute database initialization
initDatabase();

module.exports = {
  db,
  query,
  get,
  run,
  initialProducts
};
