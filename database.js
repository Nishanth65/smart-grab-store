require('dotenv').config();
const mysql = require('mysql2/promise');

// MySQL connection pool configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommerce_store',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
});

// Helper for executing queries that return multiple rows
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper for executing queries that return a single row
async function get(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper for INSERT / UPDATE / DELETE queries
async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return {
    id: result.insertId,
    changes: result.affectedRows
  };
}

// Initial products dataset for seeding if table is brand new/empty
const initialProducts = [
  {
    name: 'Aura Pro Wireless Headphones',
    description: 'Active noise cancellation with 40-hour battery life and spatial audio.',
    price: 199.99,
    original_price: 249.99,
    stock_quantity: 45,
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    category: 'Audio',
    brand: 'AuraStore',
    rating: 4.8,
    reviews_count: 124,
    badge: 'Best Seller'
  },
  {
    name: 'Tactile Mechanical Keyboard',
    description: 'Custom hot-swappable mechanical switches with RGB backlighting.',
    price: 129.50,
    original_price: 159.00,
    stock_quantity: 30,
    image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    category: 'Peripherals',
    brand: 'AuraStore',
    rating: 4.7,
    reviews_count: 88,
    badge: 'Popular'
  },
  {
    name: 'Ultra-Slim Precision Mouse',
    description: 'Ergonomic dual-mode wireless mouse with 4000 DPI laser sensor.',
    price: 59.00,
    original_price: 79.00,
    stock_quantity: 60,
    image_url: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
    category: 'Peripherals',
    brand: 'AuraStore',
    rating: 4.6,
    reviews_count: 65,
    badge: null
  },
  {
    name: 'Minimalist Ceramic Coffee Dripper',
    description: 'Handcrafted artisan ceramic pourover dripper for coffee enthusiasts.',
    price: 34.00,
    original_price: 45.00,
    stock_quantity: 80,
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
    category: 'Lifestyle',
    brand: 'AuraStore',
    rating: 4.9,
    reviews_count: 42,
    badge: 'Eco Friendly'
  },
  {
    name: 'Aerospace Aluminum Laptop Stand',
    description: 'Foldable ergonomic aluminum riser supporting laptops up to 17 inches.',
    price: 49.99,
    original_price: 69.99,
    stock_quantity: 50,
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
    category: 'Accessories',
    brand: 'AuraStore',
    rating: 4.7,
    reviews_count: 95,
    badge: 'Top Rated'
  },
  {
    name: 'Heritage Waxed Canvas Backpack',
    description: 'Weatherproof heavy-duty canvas pack with padded laptop compartment.',
    price: 119.00,
    original_price: 149.00,
    stock_quantity: 25,
    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    category: 'Lifestyle',
    brand: 'AuraStore',
    rating: 4.8,
    reviews_count: 73,
    badge: 'New Arrival'
  }
];

// Initialize database schema and verify connectivity
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database:', process.env.DB_NAME || 'ecommerce_store');

    // 1. Ensure Users Table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(191) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Ensure Products Table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2) DEFAULT NULL,
        stock_quantity INT DEFAULT 0,
        image_url VARCHAR(500),
        category VARCHAR(100) DEFAULT 'General',
        brand VARCHAR(100) NOT NULL DEFAULT 'AuraStore',
        rating DECIMAL(2,1) NOT NULL DEFAULT 4.5,
        reviews_count INT NOT NULL DEFAULT 50,
        badge VARCHAR(50) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Ensure Orders Table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending','completed','cancelled') DEFAULT 'completed',
        shipping_address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Ensure Order Items Table exists
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Check existing products count
    const [rows] = await connection.execute('SELECT COUNT(*) AS count FROM products');
    const count = rows[0]?.count || 0;

    if (count === 0) {
      console.log('Products table is empty. Seeding initial products...');
      for (const p of initialProducts) {
        await connection.execute(
          `INSERT INTO products (name, description, price, original_price, stock_quantity, image_url, category, brand, rating, reviews_count, badge)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.name, p.description, p.price, p.original_price, p.stock_quantity, p.image_url, p.category, p.brand, p.rating, p.reviews_count, p.badge]
        );
      }
      console.log(`Successfully seeded ${initialProducts.length} initial products.`);
    } else {
      console.log(`Database already contains ${count} products. Reusing existing data.`);
    }

    connection.release();
  } catch (error) {
    console.error('MySQL database initialization error:', error.message);
  }
}

// Run non-destructive initialization
initDatabase();

module.exports = {
  pool,
  query,
  get,
  run,
  initialProducts
};
