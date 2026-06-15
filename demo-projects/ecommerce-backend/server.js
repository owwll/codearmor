// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

const express      = require('express');
const cors         = require('cors');
const morgan       = require('morgan');
const crypto       = require('crypto');
const productsRouter = require('./routes/products');
const paymentsRouter = require('./routes/payments');
const errorHandler   = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3003;

// VULNERABILITY 1: No rate limiting on any route
// Should use: express-rate-limit applied globally or per route

// VULNERABILITY 2: CORS allows ALL origins with credentials
// This lets any website make credentialed requests to this API
// An attacker's site at evil.com can make authenticated requests on behalf of logged-in users
app.use(cors({
  origin:      '*',           // Any origin — including evil.com
  credentials: true,          // Combined with wildcard origin, this is a browser CORS spec violation
                              // but many old browsers/proxies still allowed it
}));

// VULNERABILITY 3: No helmet() — missing all security headers:
//   - No X-Frame-Options (clickjacking)
//   - No X-Content-Type-Options (MIME sniffing)
//   - No HSTS (downgrade attacks)
//   - No Content-Security-Policy (XSS protection)

app.use(express.json());
app.use(morgan('combined'));

// VULNERABILITY 4: Serves the entire uploads directory as static files
// Any uploaded file (including .html, .js, .svg with scripts) is served directly
// Attack: upload a .html file with <script>document.cookie</script> → Stored XSS
app.use('/uploads', express.static('./uploads'));

// VULNERABILITY 5: Predictable IDs using Date.now() + Math.random()
// - Date.now() is time-based and predictable within a time window
// - Math.random() is NOT cryptographically secure
// Attack: enumerate IDs by guessing timestamps → access other users' resources
const generateId = () => Date.now() + Math.random(); // Should use: crypto.randomUUID()

app.get('/', (req, res) => {
  const id = generateId();
  res.json({ name: 'Ecommerce Backend', version: '1.0.0', requestId: id });
});

app.use('/api/products', productsRouter);
app.use('/api/payments', paymentsRouter);

// Must be last
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Ecommerce Backend running on port ${PORT}`);
});

module.exports = app;
