import * as crypto from 'crypto';
import * as queries from '../../db/queries';
import { logger } from '../../utils/logger';
import { AgentStatus } from '../../types/scan.types';
import { RawFinding } from '../../types/finding.types';
import { FileMap, DelegationToken } from '../../types/agent.types';

// Import all agents
import { RouteAnalyst } from '../../agents/agent-1-route-analyst';
import { AuthInspector } from '../../agents/agent-2-auth-inspector';
import { InjectionHunter } from '../../agents/agent-3-injection-hunter';
import { DataFlowTracer } from '../../agents/agent-4-data-flow-tracer';
import { ConfigAuditor } from '../../agents/agent-5-config-auditor';
import { XSSScanner } from '../../agents/agent-6-xss-scanner';
import { CSRFScanner } from '../../agents/agent-7-csrf-scanner';
import { FileSecurityAgent } from '../../agents/agent-8-file-security';
import { APISecurityAgent } from '../../agents/agent-9-api-security';
import { BusinessLogicAgent } from '../../agents/agent-10-business-logic';
import { CryptoAuditor } from '../../agents/agent-11-crypto-auditor';

export interface AgentRunnerResult {
  rawFindings: RawFinding[];
  statuses: AgentStatus[];
}

export async function runParallelAgents(
  scanId: string,
  fileMap: FileMap,
  agentTokens: Map<string, DelegationToken>,
  emit: (payload: Record<string, any>) => void
): Promise<AgentRunnerResult> {
  const agents = [
    new RouteAnalyst(),
    new AuthInspector(),
    new InjectionHunter(),
    new DataFlowTracer(),
    new ConfigAuditor(),
    new XSSScanner(),
    new CSRFScanner(),
    new FileSecurityAgent(),
    new APISecurityAgent(),
    new BusinessLogicAgent(),
    new CryptoAuditor(),
  ];

  const agentLogIds = new Map<string, string>();

  // Initialize logs in DB
  for (const agent of agents) {
    const logId = crypto.randomUUID();
    agentLogIds.set(agent.agentId, logId);
    await queries.insertAgentLog({
      id: logId,
      scanId,
      agentId: agent.agentId,
      agentName: agent.name,
      status: 'running',
      filesAnalyzed: 0,
      findingsCount: 0,
    });
  }

  // Execute in parallel
  const agentResults = await Promise.allSettled(
    agents.map(async (agent) => {
      const t0 = Date.now();
      const logId = agentLogIds.get(agent.agentId)!;

      emit({
        phase: 'AGENT_START',
        agentId: agent.agentId,
        agentName: agent.name,
      });

      const token = agentTokens.get(agent.agentId)!;
      let findings: RawFinding[] = [];

      try {
        findings = await agent.run(fileMap, token);
      } catch (err) {
        logger.error('AgentRunner', `Agent ${agent.name} failed during execution`, err);
        throw err;
      } finally {
        const durationMs = Date.now() - t0;
        try {
          await queries.updateAgentLog(logId, {
            status: 'complete',
            findingsCount: findings.length,
            durationMs,
          });
          // Write per-agent audit trail entry
          await queries.insertAuditEvent({
            id:        crypto.randomUUID(),
            scanId,
            eventType: 'FINDING_ADDED',
            agentName: agent.name,
            action:    `Agent completed analysis`,
            target:    agent.agentId,
            result:    `${findings.length} finding${findings.length !== 1 ? 's' : ''} reported in ${durationMs}ms`,
          });
        } catch (dbErr) {
          logger.error('AgentRunner', `Failed to update agent log for ${agent.agentId}`, dbErr);
        }

        emit({
          phase: 'AGENT_COMPLETE',
          agentId: agent.agentId,
          findingsCount: findings.length,
          durationMs,
        });
      }

      return {
        agentId: agent.agentId,
        agentName: agent.name,
        findings,
        durationMs: Date.now() - t0,
      };
    })
  );

  const rawFindings: RawFinding[] = [];
  const statuses: AgentStatus[] = [];

  for (let i = 0; i < agentResults.length; i++) {
    const result = agentResults[i];
    const agent = agents[i];
    const logId = agentLogIds.get(agent.agentId)!;

    if (result.status === 'fulfilled') {
      rawFindings.push(...result.value.findings);
      statuses.push({
        agentId: result.value.agentId,
        agentName: result.value.agentName,
        status: 'complete',
        filesAnalyzed: 0,
        findingsCount: result.value.findings.length,
        durationMs: result.value.durationMs,
      });
      await queries.updateAgentLog(logId, { status: 'complete' });
    } else {
      statuses.push({
        agentId: agent.agentId,
        agentName: agent.name,
        status: 'error',
        filesAnalyzed: 0,
        findingsCount: 0,
        durationMs: 0,
        error: String(result.reason),
      });
      await queries.updateAgentLog(logId, {
        status: 'error',
        errorMessage: String(result.reason),
      });
    }
  }

  return { rawFindings, statuses };
}
