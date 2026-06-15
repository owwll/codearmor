import { Request, Response } from 'express';

const ARMORIQ_KEY   = process.env.ARMORIQ_API_KEY   || 'mock';
const ARMORCLAW_KEY = process.env.ARMORCLAW_API_KEY || 'mock';
const HF_KEY        = process.env.HF_API_KEY        || '';
const HF_MODEL      = process.env.HF_PRIMARY_MODEL  || 'Qwen/Qwen3-Coder-Next:novita';

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

/**
 * GET /api/armoriq/status
 * Returns the live connection status of ArmorIQ, ArmorClaw, and the HF LLM.
 */
export const getStatus = (_req: Request, res: Response) => {
  res.json({
    armoriq: {
      mode:     ARMORIQ_KEY === 'mock' ? 'mock' : 'live',
      endpoint: process.env.ARMORIQ_ENDPOINT || 'https://api.armoriq.io/v1',
      keyConfigured: ARMORIQ_KEY !== 'mock',
    },
    armorclaw: {
      mode:     ARMORCLAW_KEY === 'mock' ? 'mock' : 'live',
      endpoint: process.env.ARMORCLAW_ENDPOINT || 'https://api.armorclaw.io/v1',
      keyConfigured: ARMORCLAW_KEY !== 'mock',
    },
    llm: {
      provider: 'HuggingFace',
      model:    HF_MODEL,
      keyConfigured: !!HF_KEY && HF_KEY !== 'mock',
    },
  });
};

/**
 * GET /api/armoriq/agents
 * Returns the roster of AI agents, each protected by ArmorIQ + ArmorClaw.
 */
export const getAgents = (_req: Request, res: Response) => {
  res.json({ agents: AGENT_ROSTER, total: AGENT_ROSTER.length });
};

/**
 * GET /api/armoriq/how-it-works
 * Returns the security flow description for display in the dashboard.
 */
export const getHowItWorks = (_req: Request, res: Response) => {
  res.json({
    steps: [
      { step: 1, title: 'Plan Captured',     description: 'ArmorIQ captures the scan plan — which agents run, which files they can read.' },
      { step: 2, title: 'Tokens Delegated',  description: 'ArmorIQ issues scoped delegation tokens to each of the 11 agents with file-level permissions.' },
      { step: 3, title: 'Invoke Verified',   description: 'Before any agent reads a file, `invokeFileRead` checks the token against ArmorIQ.' },
      { step: 4, title: 'Injection Checked', description: 'ArmorClaw scans file content for prompt injection before it is sent to the HuggingFace LLM.' },
      { step: 5, title: 'Findings Validated',description: 'ArmorClaw validates every raw finding — filtering low-confidence, generic, or malicious results.' },
      { step: 6, title: 'Audit Logged',      description: 'Every action is logged to the ArmorIQ audit trail for compliance and review.' },
    ],
  });
};

