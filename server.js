const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, query, get, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'indian_store_super_secret_jwt_key_2026';

// ----------------------------------------------------
// Middleware
// ----------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public/ folder (index.html, product.html, cart.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// Authentication Helpers & Middleware
// ----------------------------------------------------

/**
 * Middleware: Verify JWT token for protected routes
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <TOKEN>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired authentication token.' });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware: Optional JWT check for routes that can work for both
 * logged-in users and guests (such as checkout)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err && user) {
      req.user = user;
    }
    next();
  });
}

// ----------------------------------------------------
// 1. User Registration API
// ----------------------------------------------------

/**
 * POST /api/register
 * Body: { name, email, password }
 */
async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are all required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existingUser = await get('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    // Hash password securely with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save to database
    const result = await run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), trimmedEmail, hashedPassword]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: result.id, name: name.trim(), email: trimmedEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: result.id,
        name: name.trim(),
        email: trimmedEmail
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error while creating user account.' });
  }
}

app.post('/api/register', registerUser);
app.post('/api/auth/register', registerUser);

// ----------------------------------------------------
// 2. User Login API (JWT)
// ----------------------------------------------------

/**
 * POST /api/login
 * Body: { email, password }
 */
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Look up user by email
    const user = await get('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare provided password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

app.post('/api/login', loginUser);
app.post('/api/auth/login', loginUser);

/**
 * GET /api/auth/me
 * Returns authenticated user details
 */
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

// ----------------------------------------------------
// 3. Products APIs
// ----------------------------------------------------

/**
 * GET /api/products
 * Fetch all products, with optional ?category= and ?search= filters
 */
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category.trim() !== '' && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category.trim());
    }

    if (search && search.trim() !== '') {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ' ORDER BY id ASC';

    const products = await query(sql, params);
    return res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Failed to fetch products from database.' });
  }
});

/**
 * GET /api/categories
 * Fetch distinct categories list
 */
app.get('/api/categories', async (req, res) => {
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
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID.' });
    }

    const product = await get('SELECT * FROM products WHERE id = ?', [productId]);
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
// 4. Checkout & Order APIs
// ----------------------------------------------------

/**
 * POST /api/checkout (and POST /api/orders)
 * Saves an order containing cart items, customer info, and total.
 * Body: { items, customerName, customerEmail, shippingAddress, totalAmount }
 */
async function handleCheckout(req, res) {
  try {
    const { items, customerName, customerEmail, shippingAddress, totalAmount } = req.body;

    // Validate cart items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty. Please add items before checking out.' });
    }

    // Determine customer name & email (authenticated user or guest input)
    const userId = req.user ? req.user.id : null;
    const finalName = customerName || (req.user ? req.user.name : null);
    const finalEmail = customerEmail || (req.user ? req.user.email : null);

    if (!finalName || !finalName.trim()) {
      return res.status(400).json({ error: 'Customer name is required for order delivery.' });
    }

    if (!finalEmail || !finalEmail.trim()) {
      return res.status(400).json({ error: 'Customer email is required for order confirmation.' });
    }

    if (!shippingAddress || !shippingAddress.trim()) {
      return res.status(400).json({ error: 'Shipping delivery address is required.' });
    }

    // Sanitize and calculate order total
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

    // Save order into SQLite orders table with initial status 'Order Placed'
    const result = await run(
      `INSERT INTO orders (user_id, customer_name, customer_email, shipping_address, total_amount, status, items)
       VALUES (?, ?, ?, ?, ?, 'Order Placed', ?)`,
      [
        userId,
        finalName.trim(),
        finalEmail.trim().toLowerCase(),
        shippingAddress.trim(),
        finalTotal,
        JSON.stringify(sanitizedItems)
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully! Thank you for shopping with us.',
      orderId: result.id,
      order: {
        id: result.id,
        userId,
        customerName: finalName.trim(),
        customerEmail: finalEmail.trim().toLowerCase(),
        shippingAddress: shippingAddress.trim(),
        totalAmount: finalTotal,
        status: 'Order Placed',
        items: sanitizedItems,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Internal server error while processing checkout.' });
  }
}

app.post('/api/checkout', optionalAuth, handleCheckout);
app.post('/api/orders', optionalAuth, handleCheckout);

/**
 * GET /api/orders
 * Retrieve orders for the authenticated user
 */
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    const formattedOrders = orders.map((order) => {
      let parsedItems = [];
      try {
        parsedItems = JSON.parse(order.items);
      } catch (e) {
        parsedItems = [];
      }
      return {
        ...order,
        items: parsedItems
      };
    });

    return res.json(formattedOrders);
  } catch (error) {
    console.error('Fetch orders error:', error);
    return res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

/**
 * GET /api/orders/:id
 * Retrieve a specific order by ID (supports tracking lookup)
 */
app.get('/api/orders/:id', optionalAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID.' });
    }

    const order = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    let parsedItems = [];
    try {
      parsedItems = JSON.parse(order.items);
    } catch (e) {
      parsedItems = [];
    }

    return res.json({
      ...order,
      items: parsedItems
    });
  } catch (error) {
    console.error('Fetch order by ID error:', error);
    return res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Update order tracking status (Order Placed, Processing, Shipped, Out for Delivery, Delivered)
 */
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const validStatuses = ['Order Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`
      });
    }

    const existingOrder = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    await run('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    const updatedOrder = await get('SELECT * FROM orders WHERE id = ?', [orderId]);
    let parsedItems = [];
    try {
      parsedItems = JSON.parse(updatedOrder.items);
    } catch (e) {
      parsedItems = [];
    }

    return res.json({
      success: true,
      message: `Order status updated to "${status}"`,
      order: {
        ...updatedOrder,
        items: parsedItems
      }
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ error: 'Failed to update order status.' });
  }
});

// ----------------------------------------------------
// Health check route
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    store: 'Indian eCommerce Store API'
  });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log(`Serving static files from ${path.join(__dirname, 'public')}`);
});
