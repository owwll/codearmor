// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express = require('express');
const jwt     = require('jsonwebtoken');
const { saveUser, findUserByUsername, findUserById, hashPassword, users } = require('../models/User');

const router = express.Router();

// VULNERABILITY 1: Hardcoded JWT secret at module scope — visible in source, git history
const JWT_SECRET = 'mysupersecretkey';

// ─────────────────────────────────────────────────────────────────────────────
// POST /register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  // VULNERABILITY 2: Password stored as MD5 (see User.js)
  const user = saveUser({ username, email, password });

  // VULNERABILITY 3: JWT issued with NO expiresIn — token is valid forever
  // Attack: steal token once → permanent access, no rotation possible
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET);

  // Strip password before returning (at least this is done right)
  const { password: _, ...safeUser } = user;
  res.status(201).json({ token, user: safeUser });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  // VULNERABILITY 4: Logs password in plain text to console
  console.log('Login attempt:', req.body); // req.body.password visible in logs!

  const { username, password } = req.body;
  const user = findUserByUsername(username);

  if (!user || user.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // VULNERABILITY 5: jwt.decode() used inside login for "verification"
  // (This pattern is used when devs misunderstand the library)
  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  const decoded = jwt.decode(token); // Pointless — just issued it; demonstrates the anti-pattern
  console.log('Issued token payload:', decoded);

  res.json({ token, userId: user.id });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /profile/:id — No auth + full user object returned
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 6: No authentication middleware — anyone can fetch any user's profile
// VULNERABILITY 7: Returns full user object including password hash
// VULNERABILITY 8: No ownership check — user 2 can fetch user 1's data (IDOR)
router.get('/profile/:id', (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user); // Includes: password (MD5 hash), email, role
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /users — Dumps all users (no auth)
// ─────────────────────────────────────────────────────────────────────────────
// VULNERABILITY 9: Returns ALL users including their password hashes to anyone
router.get('/users', (req, res) => {
  res.json(users);
});

module.exports = router;
