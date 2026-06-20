import 'dotenv/config';

// ── Suppress verbose SDK console.log noise (Merkle proof logs from @armoriq/sdk) ──
const _origConsoleLog = console.log;
console.log = (...args: any[]) => {
  if (args.some(a => typeof a === 'string' && (a.includes('Merkle proof') || a.includes('CSRG-IAP')))) {
    return;
  }
  _origConsoleLog.apply(console, args);
};

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

// ── CORS — restrict to VS Code webview, local admin UI, and ArmorIQ ───────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, VS Code extension internal)
    if (!origin) return callback(null, true);
    // Allow VS Code webview origins, localhost dev servers, and ArmorIQ domains
    const allowed =
      origin.startsWith('vscode-webview://') ||
      origin === 'http://localhost:4000'      ||
      origin === 'http://127.0.0.1:4000'      ||
      origin.includes('armoriq.ai')           ||
      origin.includes('ngrok-free.app'); // support local ngrok tunnels
    callback(allowed ? null : new Error('CORS policy violation'), allowed);
  },
  credentials: true,
}));

// ── Body parser ───────────────────────────────────────────────────────────────
// Enforces request size limits to prevent DoS attacks. Rejects with 413 Payload Too Large.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Catch payload size limit errors specifically and return 413
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Payload too large. Request body must be under 1MB.' });
  }
  next(err);
});


// ── HTTP request logging (dev only) ──────────────────────────────────────────
if (IS_DEV) {
  app.use(morgan('dev'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/scan',  scanRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth',  authRouter);
app.use('/api/armoriq', armoriqRouter);

// ── Per-agent metadata endpoints (each agent gets a unique URL) ────────────

const AGENT_REGISTRY: Record<string, { name: string; role: string }> = {
  'route-analyst':    { name: 'Route Analyst',   role: 'Audits API routes and controllers for exposure' },
  'auth-inspector':   { name: 'Auth Inspector',  role: 'Inspects authentication and authorization flows' },
  'injection-hunter': { name: 'Injection Hunter',role: 'Detects SQL, command and template injections' },
  'data-flow-tracer': { name: 'Data Flow Tracer',role: 'Traces sensitive data flows through the app' },
  'config-auditor':   { name: 'Config Auditor',  role: 'Audits configuration files and secrets exposure' },
  'xss-scanner':      { name: 'XSS Scanner',     role: 'Finds cross-site scripting vulnerabilities' },
  'csrf-scanner':     { name: 'CSRF Scanner',    role: 'Detects missing CSRF protection' },
  'file-security':    { name: 'File Security',   role: 'Checks for insecure file operations' },
  'api-security':     { name: 'API Security',    role: 'Reviews API key exposure and endpoint security' },
  'business-logic':   { name: 'Business Logic',  role: 'Identifies logic flaws and race conditions' },
  'crypto-auditor':   { name: 'Crypto Auditor',  role: 'Audits cryptographic implementations and key usage' },
};

app.get('/agents/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const agent = AGENT_REGISTRY[agentId];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({
    agentId,
    agentName: agent.name,
    name: agent.name,
    role: agent.role,
    status: 'active',
    version: '1.0.0',
    capabilities: ['read_file', 'call_hf_api'],
  });
});

app.post('/agents/:agentId', (req: Request, res: Response) => {
  const { agentId } = req.params;
  const agent = AGENT_REGISTRY[agentId];
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({
    agentId,
    agentName: agent.name,
    name: agent.name,
    role: agent.role,
    status: 'active',
    version: '1.0.0',
  });
});

// ── MCP tools listing endpoint for platform security scan ────────────────────

const MCP_TOOLS = [
  {
    name: 'read_file',
    description: 'Read a file from the scanned project directory with ArmorIQ policy enforcement',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative path to the file' },
        agentId:  { type: 'string', description: 'Agent identifier requesting the read' },
      },
      required: ['filePath'],
    },
  },
];

app.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: MCP_TOOLS });
});

app.post('/tools/list', (_req: Request, res: Response) => {
  res.json({ tools: MCP_TOOLS });
});

app.get('/tools/list', (_req: Request, res: Response) => {
  res.json({ tools: MCP_TOOLS });
});

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

// Standard ArmorIQ verification routes to prevent 404s during dashboard scanner checks
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'codearmor-orchestrator' });
});
app.post('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'codearmor-orchestrator' });
});
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'codearmor-mcp',
    version: '1.0.0',
    organization: 'CodeArmor',
    tools: MCP_TOOLS.map(t => t.name),
    agents: Object.keys(AGENT_REGISTRY),
  });
});
app.post('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'codearmor-mcp',
    version: '1.0.0',
    organization: 'CodeArmor',
    tools: MCP_TOOLS.map(t => t.name),
    agents: Object.keys(AGENT_REGISTRY),
  });
});
app.post('/docs', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'codearmor-orchestrator' });
});
app.post('/api', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'codearmor-orchestrator' });
});
app.post('/v1', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'codearmor-orchestrator' });
});
app.post('/openapi.json', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'codearmor-orchestrator' });
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

  // 2b. Validate ArmorIQ API key via SDK bootstrap (non-fatal)
  //   Note: agent and MCP registration is managed through the ArmorIQ Platform
  //   dashboard, not via API calls. Run `npm run register-agents` for a
  //   health-check and dashboard registration instructions.
  try {
    const info = await armorIQ.bootstrap();
    if (info?.mock) {
      logger.info('Server', 'ArmorIQ: running in mock mode (set ARMORIQ_API_KEY to enable)');
    } else {
      logger.info('Server', 'ArmorIQ: platform bootstrap OK', info);
    }
  } catch (err) {
    logger.warn('Server', 'ArmorIQ: bootstrap() failed — continuing in degraded mode', err as object);
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
