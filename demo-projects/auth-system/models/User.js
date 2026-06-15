// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const crypto = require('crypto');

// In-memory user store (simulates a database)
const users = [];
let nextId = 1;

/**
 * VULNERABILITY 1: Passwords stored as MD5 hash
 * MD5 is cryptographically broken — rainbow tables crack common passwords instantly
 * Should use: bcrypt.hash(password, 12)
 */
function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

function saveUser(data) {
  const user = {
    id:       nextId++,
    username: data.username,
    email:    data.email,
    role:     data.role || 'user',
    // VULNERABILITY 2: Alternatively stores plain-text password (demonstrates both patterns)
    // password: data.password,                      // plain text
    password: hashPassword(data.password),           // MD5 — still very weak
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  return user;
}

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

function findUserById(id) {
  return users.find((u) => u.id === parseInt(id));
}

// Seed a default user
saveUser({ username: 'alice', email: 'alice@example.com', password: 'password123' });
saveUser({ username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' });

module.exports = { saveUser, findUserByUsername, findUserById, hashPassword, users };
