import {
  ArmorIQClient as SdkClient,
  type IntentToken,
  type PlanCapture,
  type MCPInvocationResult,
} from '@armoriq/sdk';
import { logger } from '../utils/logger';

// ─── Plan config passed by our capture-plan helper ──────────────────────────

export interface PlanConfig {
  planType: string;
  projectId: string;
  agentManifest: string[];
  totalFiles: number;
  allowedOperations: string[];
  forbiddenOperations: string[];
  timestamp: string;
}

// ─── Audit event shape (kept for interface compatibility) ────────────────────

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

// ─── Mock intent token used when ARMORIQ_API_KEY=mock ───────────────────────

function makeMockIntentToken(planId: string): IntentToken {
  return {
    tokenId:          `mock_token_${Math.random().toString(36).substring(2, 10)}`,
    planHash:         `mock_hash_${Date.now()}`,
    planId,
    signature:        'mock_signature',
    issuedAt:         Math.floor(Date.now() / 1000),
    expiresAt:        Math.floor(Date.now() / 1000) + 3600,
    policy:           { allowedTools: [] },
    compositeIdentity:'mock_identity',
    stepProofs:       [],
    totalSteps:       0,
    rawToken:         {},
  };
}

// ─── Wrapper class ───────────────────────────────────────────────────────────

export class ArmorIQClient {
  private sdkClient: SdkClient | null;
  private isMockMode: boolean;
  private currentUserEmail: string | null;

  constructor() {
    const apiKey = process.env.ARMORIQ_API_KEY || 'mock';
    this.isMockMode = apiKey === 'mock';
    this.currentUserEmail = null;

    if (this.isMockMode) {
      this.sdkClient = null;
      logger.info('ArmorIQ', 'ArmorIQ: mock mode — skipping SDK initialisation');
      return;
    }

    const userId  = process.env.ARMORIQ_USER_ID  || 'codearmor-user';
    const agentId = process.env.ARMORIQ_AGENT_ID || 'codearmor-orchestrator';

    try {
      this.sdkClient = new SdkClient({ apiKey, userId, agentId });
      logger.info('ArmorIQ', `ArmorIQ: SDK client initialised (userId=${userId}, agentId=${agentId})`);
    } catch (err) {
      logger.warn('ArmorIQ', 'ArmorIQ: SDK client initialisation failed — falling back to mock mode', err as object);
      this.sdkClient = null;
      this.isMockMode = true;
    }
  }

  forUser(userEmail: string): this {
    this.currentUserEmail = userEmail;
    return this;
  }

  // ── capturePlan ────────────────────────────────────────────────────────────
  // The SDK's capturePlan() is a *local* call (no network). It builds a
  // PlanCapture object that is then sent to IAP via getIntentToken().

  capturePlan(config: PlanConfig): PlanCapture {
    if (this.isMockMode || !this.sdkClient) {
      // Return a minimal PlanCapture-shaped object for mock mode
      return {
        plan: {
          steps: config.agentManifest.map((id, i) => ({
            step:      i + 1,
            action:    'read_file',
            agentId:   id,
            planType:  config.planType,
            projectId: config.projectId,
          })),
        },
        llm:    'mock',
        prompt: `CodeArmor security scan of project ${config.projectId}`,
        metadata: {
          totalFiles:          config.totalFiles,
          allowedOperations:   config.allowedOperations,
          forbiddenOperations: config.forbiddenOperations,
          timestamp:           config.timestamp,
        },
      };
    }

    return this.sdkClient.capturePlan(
      /* llm    */ 'huggingface/mistral-7b',
      /* prompt */ `CodeArmor security scan of project ${config.projectId}: run ${config.agentManifest.length} specialised agents over ${config.totalFiles} files`,
      /* plan   */ {
        steps: config.agentManifest.map((id, i) => ({
          step:      i + 1,
          action:    'read_file',
          agentId:   id,
          planType:  config.planType,
          projectId: config.projectId,
        })),
      },
      /* metadata */ {
        totalFiles:          config.totalFiles,
        allowedOperations:   config.allowedOperations,
        forbiddenOperations: config.forbiddenOperations,
        timestamp:           config.timestamp,
      }
    );
  }

  // ── getIntentToken ─────────────────────────────────────────────────────────
  // Makes the actual network call to IAP and returns a signed IntentToken.

  async getIntentToken(planCapture: PlanCapture): Promise<IntentToken> {
    if (this.isMockMode || !this.sdkClient) {
      const mockPlanId = `mock_plan_${Math.random().toString(36).substring(2, 15)}`;
      logger.debug('ArmorIQ', `[mock] getIntentToken → ${mockPlanId}`);
      return makeMockIntentToken(mockPlanId);
    }

    try {
      const token = await this.sdkClient.getIntentToken(planCapture);
      logger.info('ArmorIQ', `Intent token issued: planId=${token.planId} tokenId=${token.tokenId}`);
      return token;
    } catch (err) {
      logger.warn('ArmorIQ', 'getIntentToken failed — using mock fallback', err as object);
      const fallbackId = `fallback_plan_${Date.now()}`;
      return makeMockIntentToken(fallbackId);
    }
  }

  // ── verifyIntent ───────────────────────────────────────────────────────────
  // Strict intent verification used as a pre-scan authorization gate.
  // Unlike getIntentToken(), this does NOT fall back to mock on failure —
  // it propagates errors so the caller can deny the action.

  async verifyIntent(planCapture: PlanCapture): Promise<{ allowed: boolean; reason?: string }> {
    if (this.isMockMode || !this.sdkClient) {
      return { allowed: true };
    }

    try {
      await this.sdkClient.getIntentToken(planCapture);
      return { allowed: true };
    } catch (err: any) {
      logger.warn('ArmorIQ', 'verifyIntent failed — blocking action', err as object);
      return { allowed: false, reason: err.message || 'Intent verification failed' };
    }
  }

  // ── invoke ─────────────────────────────────────────────────────────────────
  // Routes the tool call through the ArmorIQ proxy for policy enforcement.

  async invoke(
    mcp: string,
    action: string,
    intentToken: IntentToken,
    params?: Record<string, any>,
    userEmail?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (this.isMockMode || !this.sdkClient) {
      return { allowed: true };
    }

    const email = userEmail || this.currentUserEmail || undefined;

    try {
      const result: MCPInvocationResult = await this.sdkClient.invoke(
        mcp,
        action,
        intentToken,
        params,
        undefined,
        email
      );

      const allowed = result.status !== 'blocked' && result.verified !== false;
      const reason  = allowed ? undefined : `Proxy blocked: status=${result.status}`;
      return { allowed, reason };
    } catch (err: any) {
      logger.warn('ArmorIQ', `invoke failed for ${mcp}/${action} — allowing operation`, err as object);
      return { allowed: true };
    }
  }

  // ── logAudit ───────────────────────────────────────────────────────────────
  // The SDK does not expose a direct audit endpoint; audit events are captured
  // automatically by the IAP proxy on each invoke() call. This method is kept
  // for interface compatibility and logs locally in non-mock mode.

  async logAudit(event: AuditEvent): Promise<void> {
    logger.debug('ArmorIQ', 'audit event', event);
  }

  // ── bootstrap ──────────────────────────────────────────────────────────────
  // Validates the API key against the ArmorIQ platform. Used by the
  // registration/health-check script.

  async bootstrap(): Promise<Record<string, any>> {
    if (this.isMockMode || !this.sdkClient) {
      return { mock: true };
    }
    return this.sdkClient.bootstrap();
  }

  // ── listMcps ───────────────────────────────────────────────────────────────

  async listMcps(): Promise<Array<{ mcpId: string; name: string; url: string }>> {
    if (this.isMockMode || !this.sdkClient) {
      return [];
    }
    return this.sdkClient.listMcps();
  }
}

export const armorIQ = new ArmorIQClient();
