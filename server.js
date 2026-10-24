require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, query, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'aurastore_super_secure_jwt_secret_key_2026_production';
const IS_PROD = process.env.NODE_ENV === 'production';

// Cookie settings for HttpOnly session token
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// ----------------------------------------------------
// Core Middleware
// ----------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ----------------------------------------------------
// Authentication Helpers & Middleware
// ----------------------------------------------------

/**
 * Extract JWT from HttpOnly cookie or Authorization header
 */
function extractToken(req) {
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Verify JWT token string
 */
function verifyUserToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware: Strictly enforce authentication for protected API endpoints.
 * Returns HTTP 401 if unauthenticated.
 */
function requireAuthApi(req, res, next) {
  const token = extractToken(req);
  const user = verifyUserToken(token);

  if (!user) {
    return res.status(401).json({
      error: 'Access denied. Please log in to access this resource.',
      code: 'UNAUTHORIZED'
    });
  }

  req.user = user;
  next();
}

/**
 * Middleware: Optional authentication check
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  const user = verifyUserToken(token);
  if (user) {
    req.user = user;
  }
  next();
}

// ----------------------------------------------------
// Authentication-First Page Routing & Protection
// ----------------------------------------------------

// List of public auth pages that unauthenticated visitors can view
const PUBLIC_HTML_PAGES = ['/login.html', '/register.html'];

// List of protected HTML pages that require an active session
const PROTECTED_HTML_PAGES = ['/index.html', '/product.html', '/cart.html', '/track.html'];

/**
 * Root route ('/'):
 * Directs visitors according to authentication status.
 * Unauthenticated visitors are directed to /login.html.
 * Authenticated visitors are directed to the store homepage.
 */
app.get('/', (req, res) => {
  const token = extractToken(req);
  const user = verifyUserToken(token);

  if (user) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  return res.redirect('/login.html');
});

// Protect all private HTML page entries from direct URL access
app.use((req, res, next) => {
  // Check if requesting an HTML file or private page
  const reqPath = req.path.toLowerCase();

  // If requesting a public auth page while already logged in, redirect to homepage
  if (PUBLIC_HTML_PAGES.includes(reqPath)) {
    const token = extractToken(req);
    const user = verifyUserToken(token);
    if (user) {
      return res.redirect('/index.html');
    }
    return next();
  }

  // If requesting a protected HTML page
  if (PROTECTED_HTML_PAGES.includes(reqPath) || (reqPath.endsWith('.html') && !PUBLIC_HTML_PAGES.includes(reqPath))) {
    const token = extractToken(req);
    const user = verifyUserToken(token);

    if (!user) {
      return res.redirect('/login.html');
    }
  }

  next();
});

// Serve static assets (CSS, JS, images, icons)
// Set index: false so Express does NOT automatically serve index.html to unauthenticated visitors at '/'
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ----------------------------------------------------
// 1. Authentication APIs
// ----------------------------------------------------

/**
 * User Registration API
 * POST /api/auth/register & POST /api/register
 */
async function registerUser(req, res) {
  try {
    const name = (req.body.full_name || req.body.fullName || req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || req.body.confirm_password || '';

    // Backend validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email address, and password are all required.' });
    }

    if (name.length < 2) {
      return res.status(400).json({ error: 'Please enter a valid full name (at least 2 characters).' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and confirm password do not match.' });
    }

    // Check for duplicate email in MySQL
    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into MySQL users table
    const result = await run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    const newUser = {
      id: result.id,
      name,
      full_name: name,
      email
    };

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set secure HttpOnly cookie
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to AuraStore.',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error while creating user account.' });
  }
}

app.post('/api/auth/register', registerUser);
app.post('/api/register', registerUser);

/**
 * User Login API
 * POST /api/auth/login & POST /api/login
 * Generic error message to prevent user enumeration
 */
async function loginUser(req, res) {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Both email and password are required.' });
    }

    // Lookup user by email in MySQL
    const user = await get('SELECT id, name, email, password FROM users WHERE email = ?', [email]);

    // Constant-time-like rejection: generic error without revealing email presence
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate authenticated JWT session
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HttpOnly cookie
    res.cookie('auth_token', token, COOKIE_OPTIONS);

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        full_name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

app.post('/api/auth/login', loginUser);
app.post('/api/login', loginUser);

/**
 * Logout API
 * POST /api/auth/logout & GET /logout
 */
function handleLogout(req, res) {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/'
  });

  if (req.method === 'GET' || req.headers.accept?.includes('text/html')) {
    return res.redirect('/login.html');
  }

  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}

app.post('/api/auth/logout', handleLogout);
app.post('/api/logout', handleLogout);
app.get('/logout', handleLogout);

/**
 * Authenticated Profile Endpoint
 * GET /api/auth/me
 */
app.get('/api/auth/me', requireAuthApi, async (req, res) => {
  try {
    const user = await get(
      'SELECT id, name, name AS full_name, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

// ----------------------------------------------------
// 2. Protected Products APIs
// ----------------------------------------------------

/**
 * GET /api/products
 * Fetch paginated products from MySQL with optional filtering and sorting.
 * Query parameters: page (default 1), limit (default 12), category, search, in_stock, min_price, max_price, sort
 */
app.get('/api/products', requireAuthApi, async (req, res) => {
  try {
    const { category, search, sort, in_stock, min_price, max_price } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;

    let whereSql = ' WHERE 1=1';
    const params = [];

    if (category && category.trim() !== '' && category !== 'All') {
      whereSql += ' AND category = ?';
      params.push(category.trim());
    }

    if (search && search.trim() !== '') {
      whereSql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (in_stock === 'true' || in_stock === true || in_stock === '1') {
      whereSql += ' AND stock_quantity > 0';
    }

    if (min_price && !isNaN(parseFloat(min_price))) {
      whereSql += ' AND price >= ?';
      params.push(parseFloat(min_price));
    }

    if (max_price && !isNaN(parseFloat(max_price))) {
      whereSql += ' AND price <= ?';
      params.push(parseFloat(max_price));
    }

    // Determine ordering safely
    let orderBySql = ' ORDER BY id ASC';
    if (sort === 'price-asc') {
      orderBySql = ' ORDER BY price ASC, id ASC';
    } else if (sort === 'price-desc') {
      orderBySql = ' ORDER BY price DESC, id ASC';
    } else if (sort === 'name-asc') {
      orderBySql = ' ORDER BY name ASC, id ASC';
    } else if (sort === 'stock-desc') {
      orderBySql = ' ORDER BY stock_quantity DESC, id ASC';
    }

    // 1. Total count query for pagination metadata
    const countRows = await query(`SELECT COUNT(*) AS total FROM products${whereSql}`, params);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // 2. Fetch paginated products with stock_quantity preserved and aliased as stock
    const productsSql = `SELECT *, stock_quantity AS stock FROM products${whereSql}${orderBySql} LIMIT ? OFFSET ?`;
    const products = await query(productsSql, [...params, limit, offset]);

    return res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Failed to fetch products from database.' });
  }
});

/**
 * GET /api/categories
 * Fetch distinct categories from MySQL products
 */
app.get('/api/categories', requireAuthApi, async (req, res) => {
  try {
    const rows = await query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category ASC');
    const categories = rows.map((r) => r.category);
    return res.json(categories);
  } catch (error) {
    console.error('Fetch categories error:', error);
    return res.status(500).json({ error: 'Failed to retrieve categories.' });
  }
});

/**
 * GET /api/products/:id
 * Fetch single product by ID
 */
app.get('/api/products/:id', requireAuthApi, async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const product = await get('SELECT *, stock_quantity AS stock FROM products WHERE id = ?', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.json(product);
  } catch (error) {
    console.error('Fetch product by ID error:', error);
    return res.status(500).json({ error: 'Failed to fetch product details.' });
  }
});

// ----------------------------------------------------
// 3. Protected Orders & Checkout APIs
// ----------------------------------------------------

/**
 * POST /api/checkout & POST /api/orders
 * Saves order in MySQL orders and order_items tables
 */
async function handleCheckout(req, res) {
  try {
    const { items, customerName, customerEmail, shippingAddress, totalAmount } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty. Please add items before checking out.' });
    }

    const userId = req.user.id;
    const finalName = customerName || req.user.name;
    const finalEmail = customerEmail || req.user.email;

    if (!shippingAddress || !shippingAddress.trim()) {
      return res.status(400).json({ error: 'Shipping delivery address is required.' });
    }

    // Verify each item is purchasable and has verified pricing
    for (const item of items) {
      const prodId = parseInt(item.id || item.productId, 10);
      if (prodId) {
        const prod = await get('SELECT is_purchasable, price_status, name FROM products WHERE id = ?', [prodId]);
        if (prod && (!prod.is_purchasable || prod.price_status === 'unverified')) {
          return res.status(400).json({
            error: `"${prod.name}" is currently a catalog showcase item pending price verification and cannot be checked out.`
          });
        }
      }
    }

    // Calculate total
    let calculatedTotal = 0;
    const sanitizedItems = items.map((item) => {
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity, 10) || 1;
      calculatedTotal += price * quantity;
      return {
        id: item.id || item.productId,
        name: item.name,
        price,
        quantity,
        subtotal: price * quantity,
        image_url: item.image_url || ''
      };
    });

    const finalTotal = totalAmount ? parseFloat(totalAmount) : calculatedTotal;

    // Insert order into MySQL orders table
    const orderResult = await run(
      `INSERT INTO orders (user_id, total_amount, status, shipping_address)
       VALUES (?, ?, 'completed', ?)`,
      [userId, finalTotal, shippingAddress.trim()]
    );

    const orderId = orderResult.id;

    // Insert order items
    for (const item of sanitizedItems) {
      const prodId = parseInt(item.id, 10) || null;
      if (prodId) {
        try {
          await run(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
             VALUES (?, ?, ?, ?)`,
            [orderId, prodId, item.quantity, item.price]
          );
        } catch (itemErr) {
          console.warn('Item insert note:', itemErr.message);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully! Thank you for shopping with us.',
      orderId,
      order: {
        id: orderId,
        user_id: userId,
        customer_name: finalName,
        customer_email: finalEmail,
        shipping_address: shippingAddress.trim(),
        total_amount: finalTotal,
        status: 'Order Placed',
        items: sanitizedItems,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Internal server error while processing checkout.' });
  }
}

app.post('/api/checkout', requireAuthApi, handleCheckout);
app.post('/api/orders', requireAuthApi, handleCheckout);

/**
 * GET /api/orders
 * Retrieve orders for the authenticated user
 */
app.get('/api/orders', requireAuthApi, async (req, res) => {
  try {
    const orders = await query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    // Attach items to each order
    for (const order of orders) {
      const items = await query(
        `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price AS price, p.name, p.image_url
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    return res.json(orders);
  } catch (error) {
    console.error('Fetch orders error:', error);
    return res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

/**
 * GET /api/orders/:id
 * Retrieve order details by ID
 */
app.get('/api/orders/:id', requireAuthApi, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const order = await get(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const items = await query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price AS price, p.name, p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    order.items = items;

    return res.json(order);
  } catch (error) {
    console.error('Fetch order by ID error:', error);
    return res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
});

// ----------------------------------------------------
// Health check
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    store: 'AuraStore API',
    database: 'MySQL'
  });
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`AuraStore server is running at http://localhost:${PORT}`);
  console.log(`Database connected: MySQL (${process.env.DB_NAME || 'ecommerce_store'})`);
});

module.exports = app;
