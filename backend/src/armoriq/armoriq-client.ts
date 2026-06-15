import * as path from 'path';
import { logger } from '../utils/logger';
import { DelegationToken } from '../types/agent.types';

export interface PlanConfig {
  planType: string;
  projectId: string;
  agentManifest: string[];
  totalFiles: number;
  allowedOperations: string[];
  forbiddenOperations: string[];
  timestamp: string;
}

export interface AuditEvent {
  scanId?: string;
  eventType: string;
  agentName?: string;
  action: string;
  target?: string;
  result?: string;
  metadata?: any;
  armorIqPlanId?: string;
}

export class ArmorIQClient {
  private apiKey: string;
  private endpoint: string;
  private isMockMode: boolean;

  constructor() {
    this.apiKey = process.env.ARMORIQ_API_KEY || 'mock';
    this.endpoint = process.env.ARMORIQ_ENDPOINT || 'https://api.armoriq.ai';
    // Remove trailing slash if present
    if (this.endpoint.endsWith('/')) {
      this.endpoint = this.endpoint.slice(0, -1);
    }
    // Remove /v1 suffix if it was incorrectly configured in env
    if (this.endpoint.endsWith('/v1')) {
      this.endpoint = this.endpoint.slice(0, -3);
    }
    this.isMockMode = this.apiKey === 'mock';

    if (this.isMockMode) {
      logger.info('ArmorIQ', 'ArmorIQ: mock mode');
    } else {
      logger.info('ArmorIQ', `ArmorIQ: connected to ${this.endpoint}`);
    }
  }

  async capturePlan(config: PlanConfig): Promise<{ planId: string; signature: string }> {
    const mockFallback = (): { planId: string; signature: string } => ({
      planId:    `mock_plan_${Math.random().toString(36).substring(2, 15)}`,
      signature: `mock_sig_${Date.now()}`,
    });

    if (this.isMockMode) return mockFallback();

    try {
      const res = await fetch(`${this.endpoint}/iap/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        logger.warn('ArmorIQ', `capturePlan returned ${res.status} — using mock fallback`);
        return mockFallback();
      }
      return (await res.json()) as { planId: string; signature: string };
    } catch (err) {
      logger.warn('ArmorIQ', 'capturePlan failed — using mock fallback', err as object);
      return mockFallback();
    }
  }

  async delegate(planId: string, agentId: string, permissions: { read: string[] }): Promise<DelegationToken> {
    const mockFallback = (): DelegationToken => ({
      planId,
      agentId,
      allowedFiles: permissions.read,
      operations:   ['read_file', 'call_hf_api'],
      expiresAt:    Date.now() + 60000,
      signature:    'mock',
    });

    if (this.isMockMode) return mockFallback();

    try {
      const res = await fetch(`${this.endpoint}/iap/delegate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({ planId, agentId, permissions }),
      });
      if (!res.ok) {
        logger.warn('ArmorIQ', `delegate returned ${res.status} — using mock fallback`);
        return mockFallback();
      }
      return (await res.json()) as DelegationToken;
    } catch (err) {
      logger.warn('ArmorIQ', `delegate failed for agent ${agentId} — using mock fallback`, err as object);
      return mockFallback();
    }
  }

  async invoke(params: { token: DelegationToken; operation: string; target: string }): Promise<{ allowed: boolean; reason?: string }> {
    if (this.isMockMode) {
      const resolvedTarget = path.resolve(params.target);
      const isAllowed = params.token.allowedFiles.some(
        (f) => path.resolve(f) === resolvedTarget
      );
      return { allowed: isAllowed, reason: isAllowed ? undefined : 'File not in delegation list' };
    }

    try {
      const res = await fetch(`${this.endpoint}/iap/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        logger.warn('ArmorIQ', `invoke returned ${res.status} — allowing operation`);
        return { allowed: true };
      }
      return (await res.json()) as { allowed: boolean; reason?: string };
    } catch (err) {
      logger.warn('ArmorIQ', 'invoke failed — allowing operation', err as object);
      return { allowed: true };
    }
  }

  async logAudit(event: AuditEvent): Promise<void> {
    if (this.isMockMode) {
      logger.debug('ArmorIQ', 'ArmorIQ audit', event);
      return;
    }

    try {
      const res = await fetch(`${this.endpoint}/iap/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        logger.warn('ArmorIQ', `logAudit returned ${res.status} — skipping`);
      }
    } catch (err) {
      logger.warn('ArmorIQ', 'logAudit failed — skipping', err as object);
    }
  }

  async registerAgent(agent: { agentId: string; name: string; description: string; role?: string }): Promise<void> {
    if (this.isMockMode) return;
    try {
      const res = await fetch(`${this.endpoint}/agent/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(agent),
      });
      if (!res.ok) {
        logger.warn('ArmorIQ', `registerAgent ${agent.agentId} returned status ${res.status}`);
      } else {
        logger.info('ArmorIQ', `Successfully registered agent ${agent.agentId} with ArmorIQ Platform`);
      }
    } catch (err) {
      logger.warn('ArmorIQ', `Failed to register agent ${agent.agentId}`, err as object);
    }
  }

  async registerMcpServer(mcp: { mcpId: string; name: string; description: string; url?: string }): Promise<void> {
    if (this.isMockMode) return;
    try {
      const res = await fetch(`${this.endpoint}/mcp/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(mcp),
      });
      if (!res.ok) {
        logger.warn('ArmorIQ', `registerMcpServer ${mcp.mcpId} returned status ${res.status}`);
      } else {
        logger.info('ArmorIQ', `Successfully registered MCP server ${mcp.mcpId} with ArmorIQ Platform`);
      }
    } catch (err) {
      logger.warn('ArmorIQ', `Failed to register MCP server ${mcp.mcpId}`, err as object);
    }
  }
}

export const armorIQ = new ArmorIQClient();
