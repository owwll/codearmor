// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');
const ordersRouter = require('./routes/orders');
const adminRouter  = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3001;

// VULNERABILITY 1: Wildcard CORS — accepts requests from ANY origin
// This allows malicious websites to make authenticated requests on behalf of users
app.use(cors()); // Should be: cors({ origin: 'https://yourdomain.com' })

// VULNERABILITY 2: No helmet() — missing all security headers:
//   X-Content-Type-Options, X-Frame-Options, HSTS, CSP, etc.

app.use(express.json());

// VULNERABILITY 3: Morgan logging unconditionally in all environments
// In production this logs every request including auth tokens in headers
app.use(morgan('combined'));

app.use('/api/orders', ordersRouter);
app.use('/admin',      adminRouter);

app.get('/', (req, res) => {
  res.json({ name: 'Restaurant API', version: '1.0.0', status: 'running' });
});

// VULNERABILITY 4: Global error handler exposes full stack traces to clients
// An attacker can trigger errors to learn internal paths, libraries, and logic
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({
    error: err.message,   // Reveals internal error details
    stack: err.stack,     // Full stack trace sent to client!
  });
});

app.listen(PORT, () => {
  console.log(`Restaurant API running on port ${PORT}`);
});

module.exports = app;
