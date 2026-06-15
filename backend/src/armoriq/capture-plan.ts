import { createHash } from 'crypto';
import { FileMap } from '../types/agent.types';
import { armorIQ, PlanConfig } from './armoriq-client';
import { logger } from '../utils/logger';

/**
 * Builds the plan configuration and captures it with ArmorIQ, returning the plan ID and signature.
 */
export async function captureScanPlan(fileMap: FileMap): Promise<{ planId: string; signature: string }> {
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
    totalFiles: fileMap.totalCount,
    allowedOperations: ['read_file', 'call_hf_api'],
    forbiddenOperations: ['write_file', 'network_external', 'execute_code', 'read_env_file'],
    timestamp: new Date().toISOString(),
  };

  try {
    const result = await armorIQ.capturePlan(config);
    logger.info('ArmorIQ', `[ArmorIQ] Plan captured: ${result.planId} for ${fileMap.totalCount} files with 11 agents`);
    return result;
  } catch (err) {
    logger.error('ArmorIQ', 'Failed to capture scan plan', err);
    throw err;
  }
}
