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

export interface DelegationToken {
  planId: string;
  agentId: string;
  allowedFiles: string[];
  operations: string[];
  expiresAt: number;
  signature: string;
}

export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  minConfidence: number;
  maxFindingsPerFile: number;
}
