// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const jwt = require('jsonwebtoken');

// VULNERABILITY 1: Hardcoded, weak JWT secret
const JWT_SECRET = 'secret123';

/**
 * Auth middleware — VULNERABLE IMPLEMENTATION
 *
 * Problems:
 *  - jwt.decode() does NOT verify the signature — anyone can forge a token
 *  - No token expiry check — expired tokens are accepted forever
 *  - Missing authentication rejection — even if decode fails, user proceeds as null
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    // VULNERABILITY: continues without user — downstream code may not check
    req.user = null;
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  // VULNERABILITY 2: jwt.decode() — no signature verification whatsoever
  // An attacker can forge ANY payload: { userId: 1, role: 'admin' }
  const decoded = jwt.decode(token);

  // VULNERABILITY 3: No expiry check — jwt.decode ignores exp claim
  // A token that expired 2 years ago is still "valid" here

  req.user = decoded;
  next();
}

module.exports = { authMiddleware, JWT_SECRET };
