// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express = require('express');
const Database = require('better-sqlite3');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const db = new Database('./restaurant.db');

// Seed table for demo
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    item TEXT,
    price REAL,
    status TEXT DEFAULT 'pending',
    paymentInfo TEXT
  );
  INSERT OR IGNORE INTO orders (id, userId, item, price, paymentInfo)
    VALUES (1, 1, 'Margherita Pizza', 12.99, '{"card":"4111111111111111","cvv":"123"}'),
           (2, 2, 'Burger Combo',     8.50,  '{"card":"4222222222222222","cvv":"456"}');
`);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders/:id — SQL Injection + IDOR
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, (req, res) => {
  // VULNERABILITY 1: SQL Injection — user input directly interpolated into query
  // Attack: GET /api/orders/1 OR 1=1--  → dumps all orders
  const query = `SELECT * FROM orders WHERE id = ${req.params.id}`;
  const order = db.prepare(query).get();

  if (!order) return res.status(404).json({ error: 'Order not found' });

  // VULNERABILITY 2: IDOR — no check that req.user.id === order.userId
  // Any authenticated user can read ANY order (including payment info)
  res.json(order);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/orders — No authentication at all
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 3: Missing auth middleware — anyone can list all orders
router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders').all();
  res.json(orders); // Returns all orders including payment info to unauthenticated users
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders — Price manipulation + data in logs
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  // VULNERABILITY 4: Data in logs — logs full body including payment card data
  console.log('New order request:', req.body);

  const { item, paymentInfo } = req.body;

  // VULNERABILITY 5: Price taken from request body — attacker can send price: 0
  const price = req.body.price;

  const stmt = db.prepare(
    'INSERT INTO orders (userId, item, price, paymentInfo) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(req.user?.id ?? 0, item, price, JSON.stringify(paymentInfo));

  res.status(201).json({ orderId: result.lastInsertRowid, item, price });
});

module.exports = router;
