// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const fs      = require('fs');
const path    = require('path');
const express = require('express');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/process — No rate limiting, price from body, no CSRF
// ─────────────────────────────────────────────────────────────────────────────
router.post('/process', (req, res) => {
  // VULNERABILITY 1: No rate limiting — brute-force stolen cards at will
  // Should use: express-rate-limit middleware

  const { cardNumber, cvv, expiryMonth, expiryYear, orderId } = req.body;

  // VULNERABILITY 2: Price taken from request body, NOT looked up from DB
  // Attack: POST { orderId: 123, price: 0.01 } → pays $0.01 for any order
  const price = req.body.price; // Should be: const order = await db.getOrder(orderId); price = order.price;

  // VULNERABILITY 3: No CSRF protection — cross-origin form POST can trigger payment
  // Should use: csrf token validation or SameSite=Strict cookies

  // Simulate payment processing
  console.log(`Processing payment: $${price} for order ${orderId} with card ${cardNumber}`);

  res.json({
    success:      true,
    transactionId:`txn_${Date.now()}`,
    amount:        price,
    orderId,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/receipts?file=invoice.pdf — Path traversal
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 4: User-supplied filename directly concatenated to path
// Attack: GET /api/receipts?file=../../.env
//         GET /api/receipts?file=../../../etc/passwd
router.get('/receipts', (req, res) => {
  const file = req.query.file;

  if (!file) return res.status(400).json({ error: 'file parameter required' });

  // VULNERABILITY: No path sanitization, no realpath check, no allowlist
  // Should use: path.resolve + check it starts with the allowed receipts directory
  const filePath = __dirname + '/' + file; // Direct concatenation — path traversal!

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'File not found', path: filePath }); // Also leaks path
    }
    res.send(data);
  });
});

module.exports = router;
