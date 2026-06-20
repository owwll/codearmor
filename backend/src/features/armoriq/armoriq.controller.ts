import { Request, Response } from 'express';

const ARMORIQ_KEY   = process.env.ARMORIQ_API_KEY   || 'mock';
const ARMORCLAW_KEY = process.env.ARMORCLAW_API_KEY || 'mock';
const HF_KEY        = process.env.HF_API_KEY        || '';
const HF_MODEL      = process.env.HF_PRIMARY_MODEL  || 'Qwen/Qwen3-Coder-Next:novita';

const AGENT_NAMES: Record<string, string> = {
  'route-analyst':    'Route Analyst',
  'auth-inspector':   'Auth Inspector',
  'injection-hunter': 'Injection Hunter',
  'data-flow-tracer': 'Data Flow Tracer',
  'config-auditor':   'Config Auditor',
  'xss-scanner':      'XSS Scanner',
  'csrf-scanner':     'CSRF Scanner',
  'file-security':    'File Security',
  'api-security':     'API Security',
  'business-logic':   'Business Logic',
  'crypto-auditor':   'Crypto Auditor',
};

const AGENT_ROLES: Record<string, string> = {
  'route-analyst':    'Audits API routes and controllers for exposure',
  'auth-inspector':   'Inspects authentication and authorization flows',
  'injection-hunter': 'Detects SQL, command and template injections',
  'data-flow-tracer': 'Traces sensitive data flows through the app',
  'config-auditor':   'Audits configuration files and secrets exposure',
  'xss-scanner':      'Finds cross-site scripting vulnerabilities',
  'csrf-scanner':     'Detects missing CSRF protection',
  'file-security':    'Checks for insecure file operations',
  'api-security':     'Reviews API key exposure and endpoint security',
  'business-logic':   'Identifies logic flaws and race conditions',
  'crypto-auditor':   'Audits cryptographic implementations and key usage',
};

function getAgentRoster() {
  const raw = process.env.ARMORIQ_AGENTS || 'route-analyst,auth-inspector,injection-hunter,data-flow-tracer,config-auditor,xss-scanner,csrf-scanner,file-security,api-security,business-logic,crypto-auditor';
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(id => ({
    id,
    name: AGENT_NAMES[id] || id,
    role: AGENT_ROLES[id] || 'Security analysis agent',
  }));
}

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
  const agents = getAgentRoster();
  res.json({ agents, total: agents.length });
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

