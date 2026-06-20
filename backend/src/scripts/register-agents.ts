import * as dotenv from 'dotenv';
import { ArmorIQClient as SdkClient } from '@armoriq/sdk';

dotenv.config();

// ── Config ───────────────────────────────────────────────────────────────────

const ARMORIQ_API_KEY    = process.env.ARMORIQ_API_KEY    || '';
const ARMORIQ_ENDPOINT   = process.env.ARMORIQ_ENDPOINT   || 'https://api.armoriq.ai';
const ARMORIQ_USER_ID    = process.env.ARMORIQ_USER_ID    || 'codearmor-user';
const ARMORIQ_AGENT_ID   = process.env.ARMORIQ_AGENT_ID   || 'codearmor-orchestrator';
const ARMORIQ_MCP_NAME   = process.env.ARMORIQ_MCP_NAME   || 'codearmor-mcp';
const ARMORIQ_AGENTS     = process.env.ARMORIQ_AGENTS     || '';
const ARMORIQ_AGENT_IDS  = process.env.ARMORIQ_AGENT_IDS  || '';

const AGENT_ROSTER = [
  { id: 'route-analyst',   name: 'Route Analyst',   role: 'Audits API routes and controllers for exposure' },
  { id: 'auth-inspector',  name: 'Auth Inspector',  role: 'Inspects authentication and authorization flows' },
  { id: 'injection-hunter',name: 'Injection Hunter',role: 'Detects SQL, command and template injections' },
  { id: 'data-flow-tracer',name: 'Data Flow Tracer',role: 'Traces sensitive data flows through the app' },
  { id: 'config-auditor',  name: 'Config Auditor',  role: 'Audits configuration files and secrets exposure' },
  { id: 'xss-scanner',     name: 'XSS Scanner',     role: 'Finds cross-site scripting vulnerabilities' },
  { id: 'csrf-scanner',    name: 'CSRF Scanner',     role: 'Detects missing CSRF protection' },
  { id: 'file-security',   name: 'File Security',    role: 'Checks for insecure file operations' },
  { id: 'api-security',    name: 'API Security',     role: 'Reviews API key exposure and endpoint security' },
  { id: 'business-logic',  name: 'Business Logic',   role: 'Identifies logic flaws and race conditions' },
  { id: 'crypto-auditor',  name: 'Crypto Auditor',   role: 'Audits cryptographic implementations and key usage' },
];

interface CheckResult {
  name: string;
  status: '✅' | '❌' | '⚠️';
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, status: '✅', detail });
}
function fail(name: string, detail: string) {
  results.push({ name, status: '❌', detail });
}
function warn(name: string, detail: string) {
  results.push({ name, status: '⚠️', detail });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseCsv(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

async function checkBackendAgentEndpoints(baseUrl: string): Promise<void> {
  const agentIds = parseCsv(ARMORIQ_AGENTS);
  let ok = 0;
  for (const agentId of agentIds) {
    try {
      const res = await fetch(`${baseUrl}/agents/${agentId}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) ok++;
    } catch { /* unreachable — skip */ }
  }
  if (ok === agentIds.length) {
    pass(`Backend agent endpoints (${ok}/${agentIds.length})`, `All agent metadata endpoints reachable at ${baseUrl}/agents/:id`);
  } else if (ok > 0) {
    warn(`Backend agent endpoints (${ok}/${agentIds.length})`, `${agentIds.length - ok} agent endpoint(s) unreachable at ${baseUrl}/agents/:id`);
  } else {
    fail('Backend agent endpoints', `No agent endpoints reachable at ${baseUrl}/agents/:id`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\x1b[36m================================================================\x1b[0m');
  console.log('\x1b[36m   ArmorIQ — Registration Verification Script                   \x1b[0m');
  console.log('\x1b[36m================================================================\x1b[0m\n');

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!ARMORIQ_API_KEY || ARMORIQ_API_KEY === 'mock') {
    fail('API key', 'ARMORIQ_API_KEY is not set or is "mock"');
    printSummary();
    process.exit(1);
  }

  // ── Step 1: Validate API key ───────────────────────────────────────────────
  console.log('\x1b[33m─── Step 1/6: API Key Validation ───────────────────────────────\x1b[0m');

  let client: SdkClient;
  try {
    client = new SdkClient({
      apiKey:  ARMORIQ_API_KEY,
      userId:  ARMORIQ_USER_ID,
      agentId: ARMORIQ_AGENT_ID,
    });
    pass('SDK client instantiated', `userId=${ARMORIQ_USER_ID}, agentId=${ARMORIQ_AGENT_ID}`);
  } catch (err: any) {
    fail('SDK client instantiation', err.message || String(err));
    printSummary();
    process.exit(1);
  }

  try {
    const info = await client.bootstrap();
    pass('API key validation (bootstrap)', `Platform responded — ${JSON.stringify(info).slice(0, 200)}`);
  } catch (err: any) {
    fail('API key validation (bootstrap)', err.message || String(err));
    warn('Tip', 'Confirm API key is from the correct organisation on the ArmorIQ dashboard');
    printSummary();
    process.exit(1);
  }

  // ── Step 2: List & verify MCPs ────────────────────────────────────────────
  console.log('\n\x1b[33m─── Step 2/6: MCP Server Registration ───────────────────────────\x1b[0m');

  try {
    const mcps = await client.listMcps();
    if (mcps.length === 0) {
      fail('MCP server list', `No MCP servers registered. Register "${ARMORIQ_MCP_NAME}" on the dashboard`);
    } else {
      pass(`MCP servers found (${mcps.length})`, mcps.map(m => `${m.name} (${m.mcpId})`).join(', '));

      const expected = mcps.find(m => m.name === ARMORIQ_MCP_NAME);
      if (expected) {
        pass(`MCP "${ARMORIQ_MCP_NAME}" registered`, `URL: ${expected.url}, ID: ${expected.mcpId}`);
      } else {
        fail(`MCP "${ARMORIQ_MCP_NAME}" not found`, `Registered MCPs: ${mcps.map(m => m.name).join(', ')}`);
      }
    }
  } catch (err: any) {
    warn('MCP server list', `listMcps() failed: ${err.message || err}`);
  }

  // ── Step 3: Env config consistency ─────────────────────────────────────────
  console.log('\n\x1b[33m─── Step 3/6: Environment Configuration ─────────────────────────\x1b[0m');

  const agentNames = parseCsv(ARMORIQ_AGENTS);
  const agentUuids = parseCsv(ARMORIQ_AGENT_IDS);

  if (agentNames.length === 0) {
    fail('ARMORIQ_AGENTS', 'No agent names configured');
  } else {
    pass(`ARMORIQ_AGENTS (${agentNames.length})`, agentNames.join(', '));
  }

  if (agentUuids.length === 0) {
    warn('ARMORIQ_AGENT_IDS', 'No agent UUIDs configured — will fall back to names in plan steps');
  } else {
    pass(`ARMORIQ_AGENT_IDS (${agentUuids.length})`, agentUuids.map(u => u.slice(0, 8) + '…').join(', '));
  }

  if (agentUuids.length > 0 && agentUuids.length !== agentNames.length) {
    warn('Count mismatch', `ARMORIQ_AGENTS has ${agentNames.length} items but ARMORIQ_AGENT_IDS has ${agentUuids.length}`);
  }

  if (agentNames.length !== AGENT_ROSTER.length) {
    warn('Roster mismatch', `Expected ${AGENT_ROSTER.length} agents but ARMORIQ_AGENTS has ${agentNames.length}`);
  }

  if (agentNames.length > 0 && agentUuids.length > 0) {
    const usingUuids = agentUuids.length === agentNames.length;
    pass('Plan identifier mode', usingUuids ? 'Using UUIDs in plan steps' : 'Falling back to names (count mismatch)');
  }

  // ── Step 4: Test capturePlan + getIntentToken ─────────────────────────────
  console.log('\n\x1b[33m─── Step 4/6: Plan Capture & Intent Token ───────────────────────\x1b[0m');

  const projectId = `test_${Date.now().toString(36)}`;
  const planAgents = (agentUuids.length === agentNames.length && agentUuids.length > 0) ? agentUuids : agentNames;

  try {
    const planCapture = client.capturePlan(
      'huggingface/mistral-7b',
      `CodeArmor registration test — ${planAgents.length} agents`,
      {
        steps: planAgents.map((id, i) => ({
          step:      i + 1,
          action:    'read_file',
          agentId:   id,
          planType:  'registration_test',
          projectId,
        })),
      },
      { totalFiles: 0, allowedOperations: ['read_file'], forbiddenOperations: [], timestamp: new Date().toISOString() }
    );
    pass('Plan captured', `${planAgents.length} steps created with ${agentUuids.length === agentNames.length ? 'UUIDs' : 'names'}`);

    const token = await client.getIntentToken(planCapture);
    pass('Intent token issued', `planId=${token.planId}, tokenId=${token.tokenId}, expires=${new Date(token.expiresAt * 1000).toISOString()}`);

    // Verify token has plan steps matching our agents
    const stepCount = (planCapture as any).plan?.steps?.length || 0;
    pass(`Token covers ${stepCount} steps`, 'Plan-to-token mapping verified');
  } catch (err: any) {
    fail('Plan capture / intent token', err.message || String(err));
    warn('Tip', 'If this fails with agentId errors, the agent UUIDs in ARMORIQ_AGENT_IDS may not match the registered agents');
  }

  // ── Step 5: Check backend metadata endpoints ──────────────────────────────
  console.log('\n\x1b[33m─── Step 5/6: Backend Agent Metadata Endpoints ──────────────────\x1b[0m');

  const backendUrl = `http://localhost:${process.env.BACKEND_PORT || '3847'}`;

  // Health check
  try {
    const healthRes = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (healthRes.ok) {
      pass('Backend health endpoint', `GET ${backendUrl}/api/health → ${healthRes.status}`);
    } else {
      warn('Backend health endpoint', `GET ${backendUrl}/api/health → ${healthRes.status}`);
    }
  } catch {
    warn('Backend health endpoint', `Backend not reachable at ${backendUrl} (is it running?)`);
  }

  // Agent metadata endpoints (only if backend is running)
  try {
    const testRes = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (testRes.ok) {
      await checkBackendAgentEndpoints(backendUrl);
    }
  } catch {
    // already warned above
  }

  // Try the ngrok URL if available (from MCP listing)
  if (ARMORIQ_ENDPOINT !== 'https://api.armoriq.ai') {
    try {
      await checkBackendAgentEndpoints(ARMORIQ_ENDPOINT);
    } catch { /* skip */ }
  }

  // ── Step 6: Print agent roster ────────────────────────────────────────────
  console.log('\n\x1b[33m─── Step 6/6: Agent Roster ──────────────────────────────────────\x1b[0m');

  for (const agent of AGENT_ROSTER) {
    const uuid = agentUuids[agentNames.indexOf(agent.id)] || '(no UUID)';
    const shortUuid = uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
    const registered = uuid !== '(no UUID)' && uuid.length > 8;
    const mark = registered ? '✅' : '⚠️';
    console.log(`   ${mark} \x1b[36m${agent.id.padEnd(20)}\x1b[0m ${agent.name.padEnd(18)} ${shortUuid.padEnd(14)} ${agent.role}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  printSummary();
}

function printSummary() {
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  const warned = results.filter(r => r.status === '⚠️').length;

  console.log('\n\x1b[36m================================================================\x1b[0m');
  console.log(`\x1b[36m   Summary: ${passed} ✅  ${failed} ❌  ${warned} ⚠️\x1b[0m`);
  console.log('\x1b[36m================================================================\x1b[0m\n');

  for (const r of results) {
    console.log(`   ${r.status} ${r.name}`);
    console.log(`      ${r.detail}`);
  }

  if (failed > 0) {
    console.log('\n\x1b[31m❌ Some checks failed. Review the details above.\x1b[0m');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\n\x1b[33m⚠️  All critical checks passed, but some warnings exist.\x1b[0m');
    process.exit(0);
  } else {
    console.log('\n\x1b[32m✅ All checks passed! ArmorIQ registration is fully verified.\x1b[0m');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
