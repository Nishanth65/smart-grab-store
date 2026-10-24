# Smart Grab Store (AuraStore) - Full-Stack E-Commerce Web Application

A full-stack, responsive e-commerce web platform built with **HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and MySQL (MariaDB)** for the CodeAlpha Internship project.

---

## 🌟 Key Features

- **Authentication & Security**:
  - Secure User Registration and Login with bcrypt password hashing.
  - JSON Web Token (JWT) session management stored via secure HttpOnly cookies and authorization headers.
  - Protected API endpoints and automatic page access control.
- **Diwali Festive Showcase**:
  - Festive hero banner with interactive hotspots, promotional controls, and canvas fireworks overlay.
  - Seamless category cards and value-proposition benefit badges.
- **Product Catalog & Browsing**:
  - Dynamic product catalog powered by MySQL with over 8,000+ items.
  - Real-time search by keyword and name.
  - Multi-category filtering and sorting (Price, Name, Stock).
  - Server-side pagination with responsive page navigation.
- **Cart & Checkout**:
  - Client-side persistent shopping cart using `localStorage`.
  - Add to cart, adjust quantities, remove items, and live order total calculations.
  - Complete order checkout with customer details and delivery shipping address.
- **Live Order Tracking**:
  - Real-time order lookup by Order ID displaying itemized breakdown, total amount, and fulfillment status.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom design system, glassmorphism, responsive grid), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js (RESTful APIs, middleware, routing).
- **Database**: MySQL / MariaDB (Connection pooling via `mysql2/promise`, relational schema with `users`, `products`, `orders`, and `order_items`).
- **Authentication**: JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Cookie Parser (`cookie-parser`).

---

## 🚀 Getting Started & Installation

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **MySQL / MariaDB** (e.g. via XAMPP, standalone MySQL, or MariaDB server running on port `3306`)

### 2. Clone the Repository
```bash
git clone <repository-url>
cd my-store
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the `.env.example` file to create your `.env` file:
```bash
cp .env.example .env
```
Ensure your database credentials in `.env` match your local MySQL configuration:
```env
PORT=3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ecommerce_store
JWT_SECRET=your_secure_jwt_secret_key_here
```

### 5. Start the Application
Start the MySQL service, then launch the Express server:
```bash
npm start
```
The application will automatically connect to MySQL, verify the database schema, and start at:
👉 **`http://localhost:3000`**

---

## 🧪 Testing & Verification

An automated end-to-end verification script is provided in `scripts/test_user_flow.js`:
```bash
node scripts/test_user_flow.js
```
This tests:
1. Server health check (`/api/health`)
2. User Registration (`/api/auth/register`)
3. User Login (`/api/auth/login`)
4. Catalog Product Loading (`/api/products`)
5. Product Search
6. Category Filtering
7. Catalog Pagination
8. Checkout & Order Placement (`/api/checkout`)
9. Order Tracking (`/api/orders/:id`)
10. User Logout (`/api/auth/logout`)

---

## 📂 Project Structure

```text
my-store/
├── .env.example          # Environment variable template
├── .gitignore            # Git ignore configuration
├── database.js           # MySQL connection pool & schema initialization
├── package.json          # Project manifest & dependencies
├── server.js             # Express application & API routing
├── public/               # Client-facing static assets
│   ├── index.html        # Storefront homepage & Diwali showcase
│   ├── login.html        # User sign-in page
│   ├── register.html     # User registration page
│   ├── cart.html         # Shopping cart & checkout page
│   ├── track.html        # Order tracking page
│   ├── product.html      # Product detail view
│   ├── script.js         # Frontend application logic & API client
│   ├── style.css         # Styling, themes, responsive layout
│   └── images/           # Festive hero artwork & static graphics
└── scripts/              # Utility & audit scripts
    ├── test_user_flow.js # Automated pre-submission verification
    └── perf_test.js      # Query performance benchmarking
```

---

## 📄 License
This project was developed for the CodeAlpha Web Development Internship.
