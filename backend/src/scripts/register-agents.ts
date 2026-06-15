import * as dotenv from 'dotenv';
import { ArmorIQClient as SdkClient } from '@armoriq/sdk';

/**
 * ArmorIQ connectivity & health-check script.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  NOTE ON AGENT / MCP REGISTRATION                                       │
 * │                                                                          │
 * │  The official @armoriq/sdk does NOT expose registerAgent() or           │
 * │  registerMcpServer() methods. Agent and MCP registration is managed     │
 * │  through the ArmorIQ Platform dashboard or via an armoriq.yaml config   │
 * │  file — not via API calls.                                              │
 * │                                                                          │
 * │  To register agents and MCPs:                                           │
 * │    1. Log in to https://platform.armoriq.ai                             │
 * │    2. Navigate to Agents → Register Agent for each of the 11 agents     │
 * │    3. Navigate to MCPs → Register MCP for "codearmor-mcp"              │
 * │                                                                          │
 * │  This script validates your API key and confirms platform connectivity. │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   npm run register-agents
 */

dotenv.config();

const ARMORIQ_API_KEY = process.env.ARMORIQ_API_KEY || '';
const ARMORIQ_USER_ID  = process.env.ARMORIQ_USER_ID  || 'codearmor-user';
const ARMORIQ_AGENT_ID = process.env.ARMORIQ_AGENT_ID || 'codearmor-orchestrator';

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

async function main() {
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m   ArmorIQ SDK — Connectivity & Health-Check Script   \x1b[0m');
  console.log('\x1b[36m======================================================\x1b[0m\n');

  // ── Guard: require a real API key ──────────────────────────────────────────
  if (!ARMORIQ_API_KEY || ARMORIQ_API_KEY === 'mock') {
    console.error('\x1b[31m❌ Error: ARMORIQ_API_KEY is not configured or is set to "mock".\x1b[0m');
    console.error('   Please set a valid key in backend/.env and re-run.');
    process.exit(1);
  }

  console.log(`API Key:   \x1b[33m${ARMORIQ_API_KEY.slice(0, 10)}...${ARMORIQ_API_KEY.slice(-6)}\x1b[0m`);
  console.log(`User ID:   \x1b[33m${ARMORIQ_USER_ID}\x1b[0m`);
  console.log(`Agent ID:  \x1b[33m${ARMORIQ_AGENT_ID}\x1b[0m\n`);

  // ── Instantiate the official SDK client ───────────────────────────────────
  let client: SdkClient;
  try {
    client = new SdkClient({
      apiKey:  ARMORIQ_API_KEY,
      userId:  ARMORIQ_USER_ID,
      agentId: ARMORIQ_AGENT_ID,
    });
    console.log('\x1b[32m✅ SDK client instantiated successfully.\x1b[0m\n');
  } catch (err: any) {
    console.error(`\x1b[31m❌ Failed to create SDK client: ${err.message || err}\x1b[0m`);
    process.exit(1);
  }

  // ── Bootstrap: validates API key against the platform ─────────────────────
  console.log('--- 1. Validating API key via SDK bootstrap() ---');
  try {
    const info = await client.bootstrap();
    console.log('\x1b[32m✅ API key is valid. Platform response:\x1b[0m');
    console.log(JSON.stringify(info, null, 2));
  } catch (err: any) {
    console.error(`\x1b[31m❌ bootstrap() failed: ${err.message || err}\x1b[0m`);
    console.error('\n\x1b[33mTroubleshooting tips:\x1b[0m');
    console.error('  • Confirm the API key is from the correct organisation on the ArmorIQ dashboard.');
    console.error('  • Run: armoriq whoami  (Python CLI) to check which org the key is scoped to.');
    console.error('  • Ensure ARMORIQ_USER_ID and ARMORIQ_AGENT_ID match your dashboard values.\n');
    process.exit(1);
  }

  // ── List registered MCPs ──────────────────────────────────────────────────
  console.log('\n--- 2. Listing registered MCPs ---');
  try {
    const mcps = await client.listMcps();
    if (mcps.length === 0) {
      console.log('\x1b[33m⚠️  No MCPs registered for this organisation yet.\x1b[0m');
      console.log('   Register "codearmor-mcp" via the ArmorIQ Platform dashboard.');
    } else {
      console.log(`\x1b[32m✅ Found ${mcps.length} registered MCP(s):\x1b[0m`);
      for (const m of mcps) {
        console.log(`   • ${m.name} (${m.mcpId}) — ${m.url}`);
      }
    }
  } catch (err: any) {
    console.warn(`\x1b[33m⚠️  listMcps() failed (non-fatal): ${err.message || err}\x1b[0m`);
  }

  // ── Print the expected agent roster ──────────────────────────────────────
  console.log('\n--- 3. Expected agent roster (register via dashboard) ---');
  for (const agent of AGENT_ROSTER) {
    console.log(`   \x1b[36m${agent.id.padEnd(20)}\x1b[0m ${agent.role}`);
  }

  console.log('\n\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[32m🎉 Connectivity check complete. API key is valid.\x1b[0m');
  console.log('\x1b[36m======================================================\x1b[0m\n');
  console.log('Next steps:');
  console.log('  1. Register the 11 agents above via the ArmorIQ Platform dashboard.');
  console.log('  2. Register "codearmor-mcp" as an MCP server pointing to your backend URL.');
  console.log('  3. Set ARMORIQ_USER_ID and ARMORIQ_AGENT_ID in backend/.env.');
  console.log('  4. Start the backend: npm run dev\n');
}

main().catch((err) => {
  console.error('Unhandled fatal error:', err);
  process.exit(1);
});
