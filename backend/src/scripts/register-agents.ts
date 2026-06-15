import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

const ARMORIQ_API_KEY = process.env.ARMORIQ_API_KEY || '';
const ARMORIQ_ENDPOINT = process.env.ARMORIQ_ENDPOINT || 'https://api.armoriq.ai';
const PORT = parseInt(process.env.BACKEND_PORT || '3847', 10);

const AGENT_ROSTER = [
  { id: 'route-analyst', name: 'Route Analyst', role: 'Audits API routes and controllers for exposure' },
  { id: 'auth-inspector', name: 'Auth Inspector', role: 'Inspects authentication and authorization flows' },
  { id: 'injection-hunter', name: 'Injection Hunter', role: 'Detects SQL, command and template injections' },
  { id: 'data-flow-tracer', name: 'Data Flow Tracer', role: 'Traces sensitive data flows through the app' },
  { id: 'config-auditor', name: 'Config Auditor', role: 'Audits configuration files and secrets exposure' },
  { id: 'xss-scanner', name: 'XSS Scanner', role: 'Finds cross-site scripting vulnerabilities' },
  { id: 'csrf-scanner', name: 'CSRF Scanner', role: 'Detects missing CSRF protection' },
  { id: 'file-security', name: 'File Security', role: 'Checks for insecure file operations' },
  { id: 'api-security', name: 'API Security', role: 'Reviews API key exposure and endpoint security' },
  { id: 'business-logic', name: 'Business Logic', role: 'Identifies logic flaws and race conditions' },
  { id: 'crypto-auditor', name: 'Crypto Auditor', role: 'Audits cryptographic implementations and key usage' },
];

function getCleanEndpoint(url: string): string {
  let endpoint = url.trim();
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1);
  }
  if (endpoint.endsWith('/v1')) {
    endpoint = endpoint.slice(0, -3);
  }
  return endpoint;
}

async function makePostRequest(url: string, body: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ARMORIQ_API_KEY}`,
    'x-api-key': ARMORIQ_API_KEY,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const status = res.status;
    let responseText = '';
    try {
      responseText = await res.text();
    } catch {
      responseText = '(empty body)';
    }

    return { status, responseText, ok: res.ok };
  } catch (err: any) {
    return { status: 0, responseText: err.message || String(err), ok: false };
  }
}

async function registerAll() {
  console.log('\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[36m   ArmorIQ Standalone Agent Registration Script     \x1b[0m');
  console.log('\x1b[36m====================================================\x1b[0m\n');

  if (!ARMORIQ_API_KEY || ARMORIQ_API_KEY === 'mock') {
    console.error('\x1b[31m❌ Error: ARMORIQ_API_KEY is not configured or is set to "mock".\x1b[0m');
    console.error('Please configure a valid API Key in your backend/.env file.');
    process.exit(1);
  }

  const cleanBase = getCleanEndpoint(ARMORIQ_ENDPOINT);
  console.log(`Endpoint: \x1b[33m${cleanBase}\x1b[0m`);
  console.log(`API Key:  \x1b[33m${ARMORIQ_API_KEY.slice(0, 10)}...${ARMORIQ_API_KEY.slice(-6)}\x1b[0m\n`);

  let anyFailed = false;

  console.log('--- 1. Registering AI Agents ---');
  for (const agent of AGENT_ROSTER) {
    const payload = {
      agentId: agent.id,
      name: agent.name,
      description: agent.role,
      role: agent.role,
    };

    const url = `${cleanBase}/agent/register`;
    const result = await makePostRequest(url, payload);

    if (result.ok) {
      console.log(`✅ Registered Agent: \x1b[32m${agent.id}\x1b[0m`);
    } else {
      console.error(`❌ Failed to register Agent \x1b[31m${agent.id}\x1b[0m. Code: ${result.status}`);
      if (result.status === 401) {
        anyFailed = true;
      }
    }
  }

  console.log('\n--- 2. Registering MCP Server ---');
  const mcpPayload = {
    mcpId: 'codearmor-mcp',
    name: 'CodeArmor MCP Server',
    description: 'Local CodeArmor security scanning MCP server',
    url: `http://localhost:${PORT}`,
  };

  const mcpUrl = `${cleanBase}/mcp/register`;
  const mcpResult = await makePostRequest(mcpUrl, mcpPayload);

  if (mcpResult.ok) {
    console.log(`✅ Registered MCP Server: \x1b[32m${mcpPayload.mcpId}\x1b[0m`);
  } else {
    console.error(`❌ Failed to register MCP Server \x1b[31m${mcpPayload.mcpId}\x1b[0m. Code: ${mcpResult.status}`);
    if (mcpResult.status === 401) {
      anyFailed = true;
    }
  }

  console.log('\n\x1b[36m====================================================\x1b[0m');
  if (anyFailed) {
    console.log('\n\x1b[31m⚠️  Troubleshooting 401 Unauthorized Errors:\x1b[0m');
    console.log('The ArmorIQ API returned a 401 Unauthorized response.');
    console.log('1. Go to your ArmorIQ Platform Console -> API Keys.');
    console.log('2. Verify that the key in backend/.env is active and has not expired.');
    console.log('3. If needed, generate a new key and update ARMORIQ_API_KEY in backend/.env.');
  } else {
    console.log('\x1b[32m🎉 Success: All registrations completed successfully!\x1b[0m');
  }
  console.log('\x1b[36m====================================================\x1b[0m');
}

registerAll().catch((err) => {
  console.error('Unhandled fatal error in script:', err);
});
