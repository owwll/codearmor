import { createHash } from 'crypto';
import type { IntentToken } from '@armoriq/sdk';
import { FileMap } from '../types/agent.types';
import { armorIQ, PlanConfig } from './armoriq-client';
import { logger } from '../utils/logger';

const DEFAULT_AGENTS = 'route-analyst,auth-inspector,injection-hunter,data-flow-tracer,config-auditor,xss-scanner,csrf-scanner,file-security,api-security,business-logic,crypto-auditor';

function getAgentManifest(): string[] {
  const raw = process.env.ARMORIQ_AGENTS || DEFAULT_AGENTS;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export async function captureScanPlan(fileMap: FileMap): Promise<IntentToken> {
  const projectId = createHash('sha256')
    .update(fileMap.rootPath)
    .digest('hex')
    .slice(0, 16);

  const agentManifest = getAgentManifest();

  const config: PlanConfig = {
    planType: 'code_security_scan',
    projectId,
    agentManifest,
    totalFiles:          fileMap.totalCount,
    allowedOperations:   ['read_file', 'call_hf_api'],
    forbiddenOperations: ['write_file', 'network_external', 'execute_code', 'read_env_file'],
    timestamp:           new Date().toISOString(),
  };

  try {
    const planCapture = armorIQ.capturePlan(config);
    const intentToken = await armorIQ.getIntentToken(planCapture);

    logger.info(
      'ArmorIQ',
      `[ArmorIQ] Intent token captured: planId=${intentToken.planId} for ${fileMap.totalCount} files with ${agentManifest.length} agents`
    );

    return intentToken;
  } catch (err) {
    logger.error('ArmorIQ', 'Failed to capture scan plan', err);
    throw err;
  }
}
