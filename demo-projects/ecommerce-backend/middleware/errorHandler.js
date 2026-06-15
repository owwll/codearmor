// ⚠️  INTENTIONALLY VULNERABLE — CodeArmor Demo Project
// This file contains real security vulnerabilities for demonstration purposes.
// DO NOT use this code in production.

/**
 * Global error handler — INTENTIONALLY VULNERABLE implementation.
 *
 * Vulnerabilities:
 *  1. Sends err.message and full err.stack to the client (information disclosure)
 *  2. Sends the raw SQL query if err.sql exists (exposes DB schema + query structure)
 *  3. Logs req.body including any card numbers / PII to stdout
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // VULNERABILITY 3: Logs full request body — if a payment endpoint threw,
  // this logs card numbers, CVVs, and other sensitive data to the console/log files
  console.error('Request that caused error:', {
    method:  req.method,
    url:     req.url,
    body:    req.body,   // Includes card numbers, passwords, PII
    headers: req.headers,
  });
  console.error('Error:', err);

  const response = {
    error:   err.message,   // VULNERABILITY 1: Internal error message exposed
    stack:   err.stack,     // VULNERABILITY 1: Full stack trace with file paths
  };

  // VULNERABILITY 2: If ORM/DB error includes the SQL query, send it to client
  // Attack: trigger a DB error → learn table names, column names, query structure
  if (err.sql) {
    response.sql = err.sql;         // The raw failed SQL query
    response.sqlMessage = err.sqlMessage; // DB engine error message
  }

  res.status(err.status || 500).json(response);
}

module.exports = errorHandler;
