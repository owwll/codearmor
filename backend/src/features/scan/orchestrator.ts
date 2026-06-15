import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

// ── ArmorIQ & ArmorClaw ──────────────────────────────────────────────────────
import { captureScanPlan }  from '../../armoriq/capture-plan';
import { delegateToAgents } from '../../armoriq/delegate';
import { armorClaw }        from '../../armorclaw/validator';

// ── Sub-modules ─────────────────────────────────────────────────────────────
import { buildFileMap }     from './file-mapper';
import { runParallelAgents } from './agent-runner';

// ── DB ────────────────────────────────────────────────────────────────────────
import * as queries         from '../../db/queries';

// ── Utils ─────────────────────────────────────────────────────────────────────
import { logger }               from '../../utils/logger';
import { calculateScore, buildSummary } from '../../utils/scorer';
import { deduplicateFindings }  from '../../utils/deduplicator';

// ── Types ─────────────────────────────────────────────────────────────────────
import { ScanRequest, ScanResult } from '../../types/scan.types';

// ─────────────────────────────────────────────────────────────────────────────
// Scan progress event emitter
// ─────────────────────────────────────────────────────────────────────────────
export const scanEvents = new EventEmitter();
scanEvents.setMaxListeners(50);

function emit(scanId: string, payload: Record<string, any>): void {
  scanEvents.emit('progress', { scanId, ...payload });
  logger.debug('Orchestrator', `[${scanId}] Progress: ${JSON.stringify(payload)}`);
}

/**
 * Core orchestration function (asynchronous Postgres version)
 */
export async function orchestrateScan(request: ScanRequest): Promise<ScanResult> {
  const scanId = request.scanId ?? crypto.randomUUID();
  const startedAt = new Date().toISOString();

  try {
    // ── Step 1 — Initialise scan record ──────────────────────────────────────
    if (request.scanId) {
      await queries.updateScan(scanId, { status: 'pending', startedAt });
    } else {
      await queries.createScan({
        id:           scanId,
        userId:       request.userId || null,
        projectPath:  request.projectPath,
        projectName:  request.projectName ?? path.basename(request.projectPath),
        status:       'pending',
        startedAt,
      });
    }

    emit(scanId, { phase: 'INITIALIZING', message: 'Reading project structure...' });

    // ── Step 2 — Build file map ──────────────────────────────────────────────
    const fileMap = await buildFileMap(request.projectPath);

    await queries.updateScan(scanId, { status: 'scanning' });
    emit(scanId, {
      phase:     'PLANNING',
      message:   'Building secure scan plan with ArmorIQ...',
      fileCount: fileMap.totalCount,
    });

    // ── Step 2b — Audit: scan started ────────────────────────────────────────
    await queries.insertAuditEvent({
      id:        crypto.randomUUID(),
      scanId,
      eventType: 'SCAN_START',
      action:    'Scan initialised and file map built',
      target:    request.projectPath,
      result:    `${fileMap.totalCount} files discovered`,
    });

    // ── Step 3 — ArmorIQ plan ────────────────────────────────────────────────
    const plan = await captureScanPlan(fileMap);
    await queries.insertAuditEvent({
      id:             crypto.randomUUID(),
      scanId,
      eventType:      'PLAN_CREATED',
      action:         'ArmorIQ scan plan captured',
      target:         request.projectPath,
      result:         `Plan ID: ${plan.planId}`,
      armorIqPlanId:  plan.planId,
    });

    // ── Step 4 — Delegation tokens ───────────────────────────────────────────
    const agentTokens = await delegateToAgents(plan.planId, fileMap);
    await queries.insertAuditEvent({
      id:            crypto.randomUUID(),
      scanId,
      eventType:     'AGENT_DELEGATED',
      action:        'All 11 security agents received ArmorIQ delegation tokens',
      target:        'all-agents',
      result:        `${agentTokens.size} tokens issued`,
      armorIqPlanId: plan.planId,
    });

    // ── Step 5 — Run agents in parallel ──────────────────────────────────────
    emit(scanId, { phase: 'SCANNING', message: 'All 11 CodeArmor agents deployed...' });

    const agentResult = await runParallelAgents(
      scanId,
      fileMap,
      agentTokens,
      (payload) => emit(scanId, payload)
    );

    // ── Step 6 — ArmorClaw validation ────────────────────────────────────────
    await queries.updateScan(scanId, { status: 'validating' });
    emit(scanId, {
      phase:    'VALIDATING',
      message:  'ArmorClaw validating findings...',
      rawCount: agentResult.rawFindings.length,
    });

    const validated = await armorClaw.validateFindings(agentResult.rawFindings);
    await queries.insertAuditEvent({
      id:        crypto.randomUUID(),
      scanId,
      eventType: 'FINDING_VALIDATED',
      action:    'ArmorClaw validated all agent findings',
      target:    'all-findings',
      result:    `${validated.length} / ${agentResult.rawFindings.length} findings validated`,
      armorIqPlanId: plan.planId,
    });

    // ── Step 7 — Deduplicate and score ───────────────────────────────────────
    emit(scanId, {
      phase:          'SCORING',
      message:        'Calculating security score...',
      validatedCount: validated.length,
    });

    const deduped = deduplicateFindings(validated);
    const score   = calculateScore(deduped);
    const summary = buildSummary(deduped);

    // ── Step 8 — Persist findings ────────────────────────────────────────────
    await queries.insertFindings(
      deduped.map((f) => ({
        id:             f.id,
        scanId,
        severity:       f.severity,
        category:       f.category,
        filePath:       f.file,
        lineNumber:     f.line,
        title:          f.title,
        description:    f.description,
        impact:         f.impact,
        fixSuggestion:  f.fix,
        codeSnippet:    f.codeSnippet,
        fixSnippet:     f.fixSnippet,
        agentId:        f.agentId,
        confidence:     f.confidence,
        validated:      f.validated ? 1 : 0,
        armorClawScore: f.armorClawScore,
        validatedAt:    f.validatedAt,
        createdAt:      new Date().toISOString(),
      }))
    );

    // ── Step 9 — Finalise scan record & upsert project ───────────────────────
    const completedAt = new Date().toISOString();
    const durationMs  = Date.now() - new Date(startedAt).getTime();

    await queries.updateScan(scanId, {
      status:        'complete',
      score,
      totalFindings: deduped.length,
      criticalCount: summary.critical,
      warningCount:  summary.warning,
      infoCount:     summary.info,
      completedAt,
      durationMs,
      armorIqPlanId: plan.planId,
    });

    await queries.upsertProject({
      id:           crypto.randomUUID(),
      userId:       request.userId || null,
      projectPath:  request.projectPath,
      projectName:  path.basename(request.projectPath),
      lastScanId:   scanId,
      lastScore:     score,
      scanCount:    1,
    });

    // ── Step 10 — Audit completion ────────────────────────────────────────────
    await queries.insertAuditEvent({
      id:            crypto.randomUUID(),
      scanId,
      eventType:     'SCAN_COMPLETE',
      action:        'Security scan completed successfully',
      target:        request.projectPath,
      result:        `Score: ${score} | ${summary.critical}C / ${summary.warning}W / ${summary.info}I findings`,
      armorIqPlanId: plan.planId,
    });

    // ── Step 11 — Broadcast completion ───────────────────────────────────────
    emit(scanId, {
      phase:   'COMPLETE',
      message: 'Scan complete.',
      score,
      summary,
    });

    logger.info('Orchestrator', `[${scanId}] Scan finished — score: ${score}, findings: ${deduped.length} (${summary.critical}C / ${summary.warning}W / ${summary.info}I)`, { durationMs });

    return {
      scanId,
      projectPath:   request.projectPath,
      projectName:   request.projectName ?? path.basename(request.projectPath),
      score,
      status:        'complete',
      findings:      deduped,
      agentStatuses: agentResult.statuses,
      summary,
      startedAt,
      completedAt,
      durationMs,
      armorIqPlanId: plan.planId,
    };
  } catch (err: any) {
    await queries.updateScan(scanId, { status: 'failed' });
    await queries.insertAuditEvent({
      id:        crypto.randomUUID(),
      scanId,
      eventType: 'SCAN_FAILED',
      action:    'Scan terminated with error',
      target:    request.projectPath,
      result:    err.message || String(err),
    }).catch(() => {}); // best-effort — don't swallow original error
    emit(scanId, { phase: 'FAILED', message: err.message || String(err) });
    logger.error('Orchestrator', 'Scan failed', err);
    throw err;
  }
}
