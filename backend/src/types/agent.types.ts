import type { IntentToken } from '@armoriq/sdk';

export interface FileMap {
  rootPath: string;
  allFiles: string[];
  routeFiles: string[];
  authFiles: string[];
  sourceFiles: string[];
  configFiles: string[];
  controllerFiles: string[];
  modelFiles: string[];
  viewFiles: string[];
  packageJson?: string;
  totalCount: number;
}

/**
 * DelegationToken is now an alias for the SDK's IntentToken.
 * All agents and the agent-runner receive an IntentToken from ArmorIQ
 * that authorises them to call the proxy on behalf of a specific plan step.
 * The alias keeps all downstream imports unchanged.
 */
export type DelegationToken = IntentToken;

export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  minConfidence: number;
  maxFindingsPerFile: number;
}
