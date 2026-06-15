import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { initDatabase } from './db/schema';
import { runMigrations } from './db/migrations';
import { hfClient } from './hf/hf-client';
import { logger } from './utils/logger';

import scanRouter  from './features/scan/scan.routes';
import adminRouter from './features/admin/admin.routes';
import authRouter  from './features/auth/auth.routes';
import armoriqRouter from './features/armoriq/armoriq.routes';
import { armorIQ } from './armoriq/armoriq-client';

// ─────────────────────────────────────────────────────────────────────────────
// App bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.BACKEND_PORT || '3847', 10);
const IS_DEV = process.env.NODE_ENV !== 'production';

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS — restrict to VS Code webview and local admin UI ────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, VS Code extension internal)
    if (!origin) return callback(null, true);
    // Allow VS Code webview origins and localhost dev server
    const allowed =
      origin.startsWith('vscode-webview://') ||
      origin === 'http://localhost:4000'      ||
      origin === 'http://127.0.0.1:4000';
    callback(allowed ? null : new Error('CORS policy violation'), allowed);
  },
  credentials: true,
}));

// ── Body parser ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ── HTTP request logging (dev only) ──────────────────────────────────────────
if (IS_DEV) {
  app.use(morgan('combined'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/scan',  scanRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth',  authRouter);
app.use('/api/armoriq', armoriqRouter);

// ─────────────────────────────────────────────────────────────────────────────
// Health & diagnostics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Quick liveness check — reports connection modes for ArmorIQ & ArmorClaw.
 */
app.get('/api/health', (_req: Request, res: Response) => {
  const armoriqKey   = process.env.ARMORIQ_API_KEY   || 'mock';
  const armorclawKey = process.env.ARMORCLAW_API_KEY || 'mock';

  res.json({
    status:    'ok',
    version:   '1.0.0',
    armoriq:   armoriqKey   === 'mock' ? 'mock' : 'connected',
    armorclaw: armorclawKey === 'mock' ? 'mock' : 'connected',
  });
});

/**
 * GET /api/test-hf
 * Attempts a real HuggingFace API ping to verify the key & model are reachable.
 */
app.get('/api/test-hf', async (_req: Request, res: Response) => {
  const model = process.env.HF_PRIMARY_MODEL || 'Qwen/Qwen3-Coder-Next:novita';
  try {
    const ok = await hfClient.testConnection();
    if (ok) {
      res.json({ status: 'ok', model });
    } else {
      res.status(502).json({ status: 'error', model, error: 'HuggingFace connection test failed' });
    }
  } catch (err) {
    logger.error('Server', 'HF test-connection error', err);
    res.status(502).json({ status: 'error', model, error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handlers
// ─────────────────────────────────────────────────────────────────────────────

// 404 — no route matched
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — never leak stack traces to the client
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Server', 'Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // 1. Init SQLite
  initDatabase();
  logger.info('Server', 'Database initialised');

  // 2. Seed default admin user if missing
  await runMigrations();
  logger.info('Server', 'Migrations complete');

  // 2b. Register CodeArmor agents and MCP server with ArmorIQ Platform
  try {
    const AGENT_ROSTER = [
      { id: 'route-analyst',    name: 'Route Analyst',     role: 'Audits API routes and controllers for exposure' },
      { id: 'auth-inspector',   name: 'Auth Inspector',    role: 'Inspects authentication and authorization flows' },
      { id: 'injection-hunter', name: 'Injection Hunter',  role: 'Detects SQL, command and template injections' },
      { id: 'data-flow-tracer', name: 'Data Flow Tracer',  role: 'Traces sensitive data flows through the app' },
      { id: 'config-auditor',   name: 'Config Auditor',    role: 'Audits configuration files and secrets exposure' },
      { id: 'xss-scanner',      name: 'XSS Scanner',       role: 'Finds cross-site scripting vulnerabilities' },
      { id: 'csrf-scanner',     name: 'CSRF Scanner',      role: 'Detects missing CSRF protection' },
      { id: 'file-security',    name: 'File Security',     role: 'Checks for insecure file operations' },
      { id: 'api-security',     name: 'API Security',      role: 'Reviews API key exposure and endpoint security' },
      { id: 'business-logic',   name: 'Business Logic',    role: 'Identifies logic flaws and race conditions' },
      { id: 'crypto-auditor',   name: 'Crypto Auditor',    role: 'Audits cryptographic implementations and key usage' },
    ];

    logger.info('Server', 'Registering local agents with ArmorIQ Platform...');
    for (const agent of AGENT_ROSTER) {
      await armorIQ.registerAgent({
        agentId: agent.id,
        name: agent.name,
        description: agent.role,
        role: agent.role
      });
    }

    logger.info('Server', 'Registering local MCP server with ArmorIQ Platform...');
    await armorIQ.registerMcpServer({
      mcpId: 'codearmor-mcp',
      name: 'CodeArmor MCP Server',
      description: 'Local CodeArmor security scanning MCP server',
      url: `http://localhost:${PORT}`
    });
  } catch (err) {
    logger.warn('Server', 'Failed to register agents/MCP during bootstrap', err as object);
  }

  // 3. Start listening
  app.listen(PORT, () => {
    logger.info('Server', `CodeArmor backend running on port ${PORT}`, {
      env:  process.env.NODE_ENV || 'development',
      port: PORT,
    });
  });
}

bootstrap().catch((err) => {
  logger.error('Server', 'Fatal startup error', err);
  process.exit(1);
});

export default app;
