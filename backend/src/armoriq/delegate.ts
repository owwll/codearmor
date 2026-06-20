import type { IntentToken } from '@armoriq/sdk';
import { FileMap } from '../types/agent.types';
import { logger } from '../utils/logger';

const DEFAULT_AGENTS = 'route-analyst,auth-inspector,injection-hunter,data-flow-tracer,config-auditor,xss-scanner,csrf-scanner,file-security,api-security,business-logic,crypto-auditor';

function getAgentIds(): string[] {
  const raw = process.env.ARMORIQ_AGENTS || DEFAULT_AGENTS;
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

export async function delegateToAgents(
  intentToken: IntentToken,
  fileMap: FileMap,
  userEmail?: string
): Promise<Map<string, IntentToken>> {
  const agentIds = getAgentIds();

  const scopeMap: Record<string, string[]> = {
    'route-analyst':   [...fileMap.routeFiles, ...fileMap.controllerFiles],
    'auth-inspector':  [...fileMap.authFiles,  ...fileMap.modelFiles],
    'injection-hunter': fileMap.sourceFiles,
    'data-flow-tracer': fileMap.sourceFiles,
    'config-auditor':  [...fileMap.configFiles, ...(fileMap.packageJson ? [fileMap.packageJson] : [])],
    'xss-scanner':     [...fileMap.sourceFiles, ...fileMap.viewFiles],
    'csrf-scanner':    [...fileMap.routeFiles,  ...fileMap.sourceFiles],
    'file-security':   fileMap.sourceFiles,
    'api-security':    [...fileMap.routeFiles,  ...fileMap.sourceFiles],
    'business-logic':  [...fileMap.routeFiles,  ...fileMap.sourceFiles],
    'crypto-auditor':  fileMap.sourceFiles,
  };

  const delegations = new Map<string, IntentToken>();

  for (const agentId of agentIds) {
    const allowedFiles = scopeMap[agentId];
    if (!allowedFiles) {
      logger.warn('ArmorIQ', `Agent "${agentId}" from ARMORIQ_AGENTS has no scope mapping — using all source files`);
    }
    const uniqueFiles = Array.from(new Set(allowedFiles || fileMap.sourceFiles));

    const agentToken: IntentToken = {
      ...intentToken,
      rawToken: {
        ...intentToken.rawToken,
        agent_id: agentId,
        user_id: userEmail || null,
        userEmail: userEmail || null,
        scopedFiles: uniqueFiles.length,
      },
    };

    delegations.set(agentId, agentToken);
  }

  logger.info('ArmorIQ', `[ArmorIQ] Intent token distributed to ${agentIds.length} agents (user: ${userEmail || 'anonymous'})`);
  return delegations;
}
