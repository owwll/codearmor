// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express = require('express');

const router = express.Router();

// In-memory product store
let products = [
  { id: 1, name: 'Laptop',      price: 999.99, stock: 50, isDeleted: false, category: 'electronics', sellerId: 1 },
  { id: 2, name: 'Headphones',  price: 79.99,  stock: 200, isDeleted: false, category: 'electronics', sellerId: 2 },
  { id: 3, name: 'Admin Config',price: 0,      stock: 1,  isDeleted: false, category: 'internal',    sellerId: 99 },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/products — No pagination limit
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 1: Returns entire catalog without pagination
// On a real DB: SELECT * FROM products — can dump millions of records
router.get('/', async (req, res) => {
  // Simulates: return await db.findAll()
  res.json(products); // No limit, no pagination, no auth
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/products — Mass assignment
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 2: Entire req.body passed to create — attacker controls all fields
// Attack: POST { name: "hack", price: 0, category: "admin", sellerId: 99 }
router.post('/', (req, res) => {
  const product = {
    id: Date.now(), // VULNERABILITY: predictable ID (also in server.js)
    ...req.body,    // Mass assignment — user controls every field including internal ones
  };
  products.push(product);
  res.status(201).json(product);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/products/:id — Mass assignment via Object.assign
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 3: Object.assign merges full req.body without allowlist
// Attack: PUT /api/products/1 { "price": 0, "isDeleted": false, "category": "admin", "sellerId": 1 }
// User can change price to 0, override internal flags, or hijack another seller's product
router.put('/:id', (req, res) => {
  const product = products.find((p) => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Should be: pick only allowed fields (name, description, price if owner, stock if owner)
  Object.assign(product, req.body); // VULNERABILITY: merges all user-supplied fields

  res.json(product);
});

// DELETE /api/products/:id — No auth, no ownership check
router.delete('/:id', (req, res) => {
  products = products.filter((p) => p.id !== parseInt(req.params.id));
  res.json({ deleted: true });
});

module.exports = router;
