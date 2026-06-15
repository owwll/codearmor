// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express = require('express');
const authRouter = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// VULNERABILITY 1: Stack error details exposed in all environments
app.set('showStackError', true);

app.use('/api/auth', authRouter);

app.get('/', (req, res) => {
  res.json({ name: 'Auth System', version: '1.0.0' });
});

// VULNERABILITY 2: Session cookie set without httpOnly, secure, or sameSite flags
// - No httpOnly: JavaScript can read the cookie (enables XSS cookie theft)
// - No secure: cookie sent over plain HTTP (network sniffing attack)
// - No sameSite: cookie sent on cross-origin requests (CSRF vulnerability)
app.get('/set-session', (req, res) => {
  const token = req.query.token || 'demo-token';
  res.cookie('session', token); // Should be: { httpOnly: true, secure: true, sameSite: 'strict' }
  res.json({ message: 'Session set' });
});

// VULNERABILITY 3: Global error handler exposes internal details
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(500).json({
    error:   err.message,
    stack:   err.stack,          // Sends stack trace to client
    details: err.details || null,
  });
});

app.listen(PORT, () => {
  console.log(`Auth System running on port ${PORT}`);
});

module.exports = app;
