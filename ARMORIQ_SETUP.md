# ArmorIQ Platform Setup Guide

## Prerequisites

- Backend code ready with the ArmorIQ SDK changes
- ngrok installed (`brew install ngrok` or from [ngrok.com](https://ngrok.com))
- ArmorIQ Platform account at [platform.armoriq.ai](https://platform.armoriq.ai)

---

## Step 1 — Start Backend + ngrok

Open **two terminals**:

### Terminal 1 — Start the backend

```bash
cd backend
npm run dev
```

### Terminal 2 — Expose with ngrok

```bash
ngrok http 3847
```

You'll see output like:

```
Forwarding  https://abc123.ngrok.io -> http://localhost:3847
```

**Copy the ngrok URL** (e.g. `https://abc123.ngrok.io`) — you'll paste it into every registration form.

---

## Step 2 — Register MCP Server

Open **[platform.armoriq.ai](https://platform.armoriq.ai)** → **MCPs → Register MCP**

Fill the form:

| Field | Value |
|---|---|
| **Server Name** | `codearmor-mcp` |
| **Server URL** | `https://abc123.ngrok.io` (your ngrok URL) |
| **Environment** | Production |
| **Authentication → Credentials provided by** | `Client SDK / Agent (default)` |
| **Authentication Method** | API Key |
| **API Key** | *(leave blank — provided by SDK at runtime)* |
| **API Key Name** | *(leave blank)* |

Click **Start Onboarding** → Wait for these stages to complete:

- [ ] Server Discovery — Check
- [ ] Security Scan — Complete
- [ ] Issuing Certificate — Complete
- [ ] Registry Addition — Complete

---

## Step 3 — Register 11 AI Agents

Open **Agents → Register Agent**

**Important**: The ArmorIQ platform requires each agent to have a **unique Agent URL**. Each agent uses the same base ngrok URL but with its own path segment (`/agents/{agent-id}`). The backend exposes per-agent metadata endpoints for this purpose.

Fill the form **11 times**, once per agent:

| Field | Value |
|---|---|
| **Version** | `1.0.0` |
| **Environment** | Production |
| **Authentication → Credentials provided by** | `Client SDK / Agent (default)` |
| **Authentication Method** | API Key |
| **API Key** | *(leave blank)* |
| **API Key Name** | *(leave blank)* |
| **Repository URL** | `https://github.com/your-org/codearmor` |

### Agent 1 — Route Analyst

| Field | Value |
|---|---|
| **Agent Name** | `route-analyst` |
| **Agent URL** | `https://abc123.ngrok.io/agents/route-analyst` |
| **Description** | `Audits API routes and controllers for exposure` |

### Agent 2 — Auth Inspector

| Field | Value |
|---|---|
| **Agent Name** | `auth-inspector` |
| **Agent URL** | `https://abc123.ngrok.io/agents/auth-inspector` |
| **Description** | `Inspects authentication and authorization flows` |

### Agent 3 — Injection Hunter

| Field | Value |
|---|---|
| **Agent Name** | `injection-hunter` |
| **Agent URL** | `https://abc123.ngrok.io/agents/injection-hunter` |
| **Description** | `Detects SQL, command and template injections` |

### Agent 4 — Data Flow Tracer

| Field | Value |
|---|---|
| **Agent Name** | `data-flow-tracer` |
| **Agent URL** | `https://abc123.ngrok.io/agents/data-flow-tracer` |
| **Description** | `Traces sensitive data flows through the app` |

### Agent 5 — Config Auditor

| Field | Value |
|---|---|
| **Agent Name** | `config-auditor` |
| **Agent URL** | `https://abc123.ngrok.io/agents/config-auditor` |
| **Description** | `Audits configuration files and secrets exposure` |

### Agent 6 — XSS Scanner

| Field | Value |
|---|---|
| **Agent Name** | `xss-scanner` |
| **Agent URL** | `https://abc123.ngrok.io/agents/xss-scanner` |
| **Description** | `Finds cross-site scripting vulnerabilities` |

### Agent 7 — CSRF Scanner

| Field | Value |
|---|---|
| **Agent Name** | `csrf-scanner` |
| **Agent URL** | `https://abc123.ngrok.io/agents/csrf-scanner` |
| **Description** | `Detects missing CSRF protection` |

### Agent 8 — File Security

| Field | Value |
|---|---|
| **Agent Name** | `file-security` |
| **Agent URL** | `https://abc123.ngrok.io/agents/file-security` |
| **Description** | `Checks for insecure file operations` |

### Agent 9 — API Security

| Field | Value |
|---|---|
| **Agent Name** | `api-security` |
| **Agent URL** | `https://abc123.ngrok.io/agents/api-security` |
| **Description** | `Reviews API key exposure and endpoint security` |

### Agent 10 — Business Logic

| Field | Value |
|---|---|
| **Agent Name** | `business-logic` |
| **Agent URL** | `https://abc123.ngrok.io/agents/business-logic` |
| **Description** | `Identifies logic flaws and race conditions` |

### Agent 11 — Crypto Auditor

| Field | Value |
|---|---|
| **Agent Name** | `crypto-auditor` |
| **Agent URL** | `https://abc123.ngrok.io/agents/crypto-auditor` |
| **Description** | `Audits cryptographic implementations and key usage` |

For each agent:
1. Fill the form (use the unique Agent URL from the table above)
2. Click **Start Onboarding**
3. Wait for Security Scan + Certificate to complete
4. Move to the next agent

---

## Step 4 — Verify Connectivity

Keep the backend and ngrok running. Open a **third terminal**:

```bash
cd backend
npx ts-node src/scripts/register-agents.ts
```

Expected successful output:

```
✅ SDK client instantiated successfully.

--- 1. Validating API key via SDK bootstrap() ---
✅ API key is valid. Platform response:
{...}

--- 2. Listing registered MCPs ---
✅ Found 1 registered MCP(s):
   • codearmor-mcp (xxx) — https://abc123.ngrok.io
```

If you see errors:
- `bootstrap() failed` → API key might be invalid/expired — regenerate at **Settings → API Keys**
- No MCPs found → MCP registration didn't complete — go back to **MCPs** and check status

---

## Step 5 — Test a Scan

In VS Code:
1. Press `Cmd+Shift+P` → **CodeArmor: Scan Project**
2. Select a project folder
3. Watch the progress

Expected flow:

```
verifyIntent() → IAP signs token ✓
captureScanPlan() → IAP signs plan with 11 agents ✓
delegateToAgents() → each agent gets user-scoped token ✓
agent reads file → invokeFileRead('codearmor-mcp', token, userEmail)
  → proxy.armoriq.ai checks policy → allowed/blocked
```

---

## Troubleshooting

### "Policy Check Failed"
- Run `register-agents.ts` to verify API key
- Check that `ARMORIQ_MCP_NAME` in `.env` matches the MCP Server Name you registered
- Check that `ARMORIQ_AGENTS` in `.env` matches the agent IDs you registered
- Verify ngrok URL is still active (free ngrok sessions expire after a few hours)

### "MCP not found"
- The MCP `codearmor-mcp` must be registered before agents can invoke it
- Go to **MCPs** and confirm it shows as registered

### "Agent not found"
- All 11 agent IDs in `ARMORIQ_AGENTS` must be registered on the platform
- Go to **Agents** and verify all 11 are listed with status "Verified"

### ngrok expired
- Restart ngrok (`ngrok http 3847`) to get a new URL
- Update the **MCP Server URL** and **Agent URL** in the ArmorIQ Platform to the new ngrok URL
- Or upgrade to a paid ngrok plan for fixed subdomains
