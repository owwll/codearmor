// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express = require('express');
const Database = require('better-sqlite3');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const db = new Database('./restaurant.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    role TEXT DEFAULT 'user',
    email TEXT
  );
  INSERT OR IGNORE INTO users (id, username, role, email)
    VALUES (1, 'alice', 'user', 'alice@example.com'),
           (2, 'bob', 'user', 'bob@example.com'),
           (99, 'admin', 'admin', 'admin@restaurant.com');
`);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/users/:id — Auth but NO role check
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 1: Any authenticated user can delete any user (missing role check)
// Attack: Login as regular user, DELETE /admin/users/99 → deletes the admin
router.delete('/users/:id', authMiddleware, (req, res) => {
  // MISSING: if (req.user?.role !== 'admin') return res.status(403).json(...)

  // VULNERABILITY 2: No input validation — id could be any string
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ deleted: true, id: req.params.id });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/stats — No authentication at all
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 3: Exposes business metrics to unauthenticated requests
router.get('/stats', (req, res) => {
  const totalUsers  = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
  const revenue     = db.prepare('SELECT SUM(price) as total FROM orders').get();

  res.json({
    totalUsers:  totalUsers.count,
    totalOrders,
    totalRevenue: revenue.total,
    adminEmails: db.prepare("SELECT email FROM users WHERE role = 'admin'").all(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users — No input validation
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 4: No input validation — attacker can set role: 'admin' directly
router.post('/users', authMiddleware, (req, res) => {
  const { username, role, email } = req.body; // role accepted from user input!
  db.prepare('INSERT INTO users (username, role, email) VALUES (?, ?, ?)').run(username, role, email);
  res.status(201).json({ username, role, email });
});

module.exports = router;
