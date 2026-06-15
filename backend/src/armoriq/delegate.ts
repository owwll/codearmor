import type { IntentToken } from '@armoriq/sdk';
import { FileMap } from '../types/agent.types';
import { logger } from '../utils/logger';

/**
 * Distributes the IntentToken to each of the 11 agents.
 *
 * In the SDK model, a single signed IntentToken covers the full execution plan.
 * Each agent uses the same token when calling armorIQ.invoke() — the proxy
 * enforces per-step policies via the Merkle proof embedded in the token.
 *
 * We return a Map<agentId, IntentToken> so the agent-runner API is unchanged,
 * and each agent can still retrieve its individual token by ID.
 *
 * The agentScopes mapping is preserved here for documentation — it defines
 * the intended read scope per agent and can be used to build policy metadata
 * in future when the platform supports per-agent sub-token delegation.
 */
export async function delegateToAgents(
  intentToken: IntentToken,
  fileMap: FileMap
): Promise<Map<string, IntentToken>> {
  const agentScopes: Record<string, string[]> = {
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

  for (const [agentId, allowedFiles] of Object.entries(agentScopes)) {
    const uniqueFiles = Array.from(new Set(allowedFiles));

    // Tag the token with scope metadata so the agent can log it
    const agentToken: IntentToken = {
      ...intentToken,
      rawToken: {
        ...intentToken.rawToken,
        agentId,
        scopedFiles: uniqueFiles.length,
      },
    };

    delegations.set(agentId, agentToken);
  }

  logger.info('ArmorIQ', '[ArmorIQ] Intent token distributed to all 11 agents');
  return delegations;
}
