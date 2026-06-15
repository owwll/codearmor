import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

dotenv.config();

async function runVerification() {
  let failed = false;

  console.log('Starting CodeArmor Startup Verification...\n');

  // Check 1: HF_API_KEY
  const hfKey = process.env.HF_API_KEY;
  if (hfKey && hfKey.trim() !== '' && hfKey !== 'hf_your_key_here') {
    console.log('✅ Check 1: HF_API_KEY is configured correctly.');
  } else {
    console.log('❌ Check 1: HF_API_KEY is not set or is set to placeholder.');
    failed = true;
  }

  // Check 2: JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length >= 32) {
    console.log('✅ Check 2: JWT_SECRET is configured (length >= 32 chars).');
  } else {
    console.log('❌ Check 2: JWT_SECRET must be configured and be at least 32 characters long.');
    failed = true;
  }

  // Check 3: DATABASE_URL configuration
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.trim() !== '' && !dbUrl.includes('YOUR-PROJECT-ID')) {
    console.log('✅ Check 3: DATABASE_URL is configured for Neon Postgres.');
  } else {
    console.log('❌ Check 3: DATABASE_URL is not set or contains placeholders. Please configure it in backend/.env.');
    failed = true;
  }

  // Check 4: Local config directory is writable
  const configDir = path.resolve(path.join(os.homedir(), '.codearmor'));
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    // Test write permission by writing a temp file
    const tempFile = path.join(configDir, `.write-test-${Date.now()}`);
    fs.writeFileSync(tempFile, 'test');
    fs.unlinkSync(tempFile);
    console.log(`✅ Check 4: Local config directory is writable (${configDir}).`);
  } catch (err) {
    console.log(`❌ Check 4: Local config directory is NOT writable (${configDir}). Error: ${String(err)}`);
    failed = true;
  }

  // Check 5: HF API responds to a minimal test call
  if (hfKey && hfKey !== 'hf_your_key_here') {
    try {
      const model = process.env.HF_PRIMARY_MODEL || 'Qwen/Qwen3-Coder-Next:novita';
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Respond with "OK"' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        console.log(`✅ Check 5: HuggingFace API connection test passed using model: ${model}.`);
      } else {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.log(`❌ Check 5: HuggingFace API connection test failed. Error: ${String(err)}`);
      failed = true;
    }
  } else {
    console.log('❌ Check 5: HuggingFace API connection test skipped due to invalid HF_API_KEY.');
    failed = true;
  }

  // Check 6: All 11 agent files exist in agents/ directory
  const expectedAgents = [
    'agent-1-route-analyst.ts',
    'agent-2-auth-inspector.ts',
    'agent-3-injection-hunter.ts',
    'agent-4-data-flow-tracer.ts',
    'agent-5-config-auditor.ts',
    'agent-6-xss-scanner.ts',
    'agent-7-csrf-scanner.ts',
    'agent-8-file-security.ts',
    'agent-9-api-security.ts',
    'agent-10-business-logic.ts',
    'agent-11-crypto-auditor.ts',
  ];
  const agentsDir = path.join(__dirname, '..', 'agents');
  let agentsOk = true;

  for (const filename of expectedAgents) {
    const filePath = path.join(agentsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`   - Missing agent: ${filename}`);
      agentsOk = false;
    }
  }

  if (agentsOk) {
    console.log('✅ Check 6: All 11 agent files exist in agents/ directory.');
  } else {
    console.log('❌ Check 6: Some agent files are missing from agents/ directory.');
    failed = true;
  }

  console.log('\n----------------------------------------');
  if (failed) {
    console.log('❌ Verification failed. Please check the logs above.');
    process.exit(1);
  } else {
    console.log('✅ All startup checks passed successfully! CodeArmor is ready.');
    process.exit(0);
  }
}

runVerification();
