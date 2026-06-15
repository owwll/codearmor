import { FileMap, DelegationToken } from '../types/agent.types';
import { armorIQ } from './armoriq-client';
import { logger } from '../utils/logger';

/**
 * Creates delegation tokens for each of the 11 agents with properly scoped read access limits.
 */
export async function delegateToAgents(planId: string, fileMap: FileMap): Promise<Map<string, DelegationToken>> {
  const agentScopes: Record<string, string[]> = {
    'route-analyst': [...fileMap.routeFiles, ...fileMap.controllerFiles],
    'auth-inspector': [...fileMap.authFiles, ...fileMap.modelFiles],
    'injection-hunter': fileMap.sourceFiles,
    'data-flow-tracer': fileMap.sourceFiles,
    'config-auditor': [...fileMap.configFiles, ...(fileMap.packageJson ? [fileMap.packageJson] : [])],
    'xss-scanner': [...fileMap.sourceFiles, ...fileMap.viewFiles],
    'csrf-scanner': [...fileMap.routeFiles, ...fileMap.sourceFiles],
    'file-security': fileMap.sourceFiles,
    'api-security': [...fileMap.routeFiles, ...fileMap.sourceFiles],
    'business-logic': [...fileMap.routeFiles, ...fileMap.sourceFiles],
    'crypto-auditor': fileMap.sourceFiles,
  };

  const delegations = new Map<string, DelegationToken>();

  try {
    for (const [agentId, allowedFiles] of Object.entries(agentScopes)) {
      const uniqueAllowedFiles = Array.from(new Set(allowedFiles));
      const token = await armorIQ.delegate(planId, agentId, { read: uniqueAllowedFiles });
      delegations.set(agentId, token);
    }
    logger.info('ArmorIQ', '[ArmorIQ] Delegation tokens generated for all 11 agents');
    return delegations;
  } catch (err) {
    logger.error('ArmorIQ', 'Failed to delegate tokens to agents', err);
    throw err;
  }
}
