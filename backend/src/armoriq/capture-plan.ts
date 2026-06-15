import { createHash } from 'crypto';
import type { IntentToken } from '@armoriq/sdk';
import { FileMap } from '../types/agent.types';
import { armorIQ, PlanConfig } from './armoriq-client';
import { logger } from '../utils/logger';

/**
 * Builds the plan configuration, captures it with the SDK (local step),
 * then requests a signed IntentToken from the ArmorIQ IAP service (network step).
 *
 * Returns an IntentToken that all 11 agents will use as their delegation credential.
 */
export async function captureScanPlan(fileMap: FileMap): Promise<IntentToken> {
  const projectId = createHash('sha256')
    .update(fileMap.rootPath)
    .digest('hex')
    .slice(0, 16);

  const config: PlanConfig = {
    planType: 'code_security_scan',
    projectId,
    agentManifest: [
      'route-analyst',
      'auth-inspector',
      'injection-hunter',
      'data-flow-tracer',
      'config-auditor',
      'xss-scanner',
      'csrf-scanner',
      'file-security',
      'api-security',
      'business-logic',
      'crypto-auditor',
    ],
    totalFiles:          fileMap.totalCount,
    allowedOperations:   ['read_file', 'call_hf_api'],
    forbiddenOperations: ['write_file', 'network_external', 'execute_code', 'read_env_file'],
    timestamp:           new Date().toISOString(),
  };

  try {
    // Step 1: build the PlanCapture locally (no network)
    const planCapture = armorIQ.capturePlan(config);

    // Step 2: submit to IAP and get a signed IntentToken
    const intentToken = await armorIQ.getIntentToken(planCapture);

    logger.info(
      'ArmorIQ',
      `[ArmorIQ] Intent token captured: planId=${intentToken.planId} for ${fileMap.totalCount} files with 11 agents`
    );

    return intentToken;
  } catch (err) {
    logger.error('ArmorIQ', 'Failed to capture scan plan', err);
    throw err;
  }
}
