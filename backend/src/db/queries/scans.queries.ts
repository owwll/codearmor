import { eq, desc, and, sql } from 'drizzle-orm';
import { db, scans, findings, agentLogs, auditLog } from '../schema';
import { logger } from '../../utils/logger';

export interface ScanRecord {
  id: string;
  userId?: string | null;
  projectPath: string;
  projectName: string;
  score: number;
  status: string;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  armorIqPlanId?: string | null;
  metadata?: string | null;
}

export interface FindingRecord {
  id: string;
  scanId: string;
  severity: string;
  category: string;
  filePath: string;
  lineNumber: number;
  title: string;
  description: string;
  impact: string;
  fixSuggestion: string;
  codeSnippet?: string | null;
  fixSnippet?: string | null;
  agentId: string;
  confidence: number;
  validated: number;
  armorClawScore?: number | null;
  validatedAt?: string | null;
  createdAt?: string | null;
}

export interface AgentLogRecord {
  id: string;
  scanId: string;
  agentId: string;
  agentName: string;
  status: string;
  filesAnalyzed: number;
  findingsCount: number;
  durationMs?: number | null;
  errorMessage?: string | null;
  createdAt?: string | null;
}

export interface AuditRecord {
  id: string;
  scanId?: string | null;
  eventType: string;
  agentName?: string | null;
  action: string;
  target?: string | null;
  result?: string | null;
  metadata?: string | null;
  armorIqPlanId?: string | null;
  createdAt?: string | null;
}

// ==========================================
// SCAN QUERIES
// ==========================================

export async function createScan(data: Partial<ScanRecord>): Promise<ScanRecord> {
  const record = {
    id: data.id || `scan_${Math.random().toString(36).substring(2, 11)}`,
    userId: data.userId || null,
    projectPath: data.projectPath || '',
    projectName: data.projectName || '',
    score: data.score ?? 100,
    status: data.status || 'pending',
    totalFindings: data.totalFindings ?? 0,
    criticalCount: data.criticalCount ?? 0,
    warningCount: data.warningCount ?? 0,
    infoCount: data.infoCount ?? 0,
    startedAt: data.startedAt || new Date().toISOString(),
    completedAt: data.completedAt || null,
    durationMs: data.durationMs || null,
    armorIqPlanId: data.armorIqPlanId || null,
    metadata: data.metadata || null,
  };

  try {
    const results = await db.insert(scans).values(record).returning();
    return results[0] as unknown as ScanRecord;
  } catch (err) {
    logger.error('ScanQueries', 'Failed to create scan', err);
    throw err;
  }
}

export async function updateScan(id: string, data: Partial<ScanRecord>): Promise<void> {
  try {
    const updatePayload: Record<string, any> = {};
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.score !== undefined) updatePayload.score = data.score;
    if (data.totalFindings !== undefined) updatePayload.totalFindings = data.totalFindings;
    if (data.criticalCount !== undefined) updatePayload.criticalCount = data.criticalCount;
    if (data.warningCount !== undefined) updatePayload.warningCount = data.warningCount;
    if (data.infoCount !== undefined) updatePayload.infoCount = data.infoCount;
    if (data.completedAt !== undefined) updatePayload.completedAt = data.completedAt;
    if (data.durationMs !== undefined) updatePayload.durationMs = data.durationMs;
    if (data.armorIqPlanId !== undefined) updatePayload.armorIqPlanId = data.armorIqPlanId;
    if (data.metadata !== undefined) updatePayload.metadata = data.metadata;
    if (data.startedAt !== undefined) updatePayload.startedAt = data.startedAt;

    await db.update(scans).set(updatePayload).where(eq(scans.id, id));
  } catch (err) {
    logger.error('ScanQueries', `Failed to update scan ${id}`, err);
    throw err;
  }
}

export async function getScanById(id: string): Promise<ScanRecord | undefined> {
  try {
    const results = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
    return results[0] as unknown as ScanRecord | undefined;
  } catch (err) {
    logger.error('ScanQueries', `Failed to get scan ${id}`, err);
    throw err;
  }
}

export async function getRecentScans(limit: number, offset: number, userId?: string): Promise<ScanRecord[]> {
  try {
    if (userId) {
      return await db.select().from(scans)
        .where(eq(scans.userId, userId))
        .orderBy(desc(scans.startedAt))
        .limit(limit)
        .offset(offset) as unknown as ScanRecord[];
    }
    return await db.select().from(scans)
      .orderBy(desc(scans.startedAt))
      .limit(limit)
      .offset(offset) as unknown as ScanRecord[];
  } catch (err) {
    logger.error('ScanQueries', 'Failed to get recent scans', err);
    throw err;
  }
}

export async function getScanCount(userId?: string): Promise<number> {
  try {
    let result;
    if (userId) {
      result = await db.select({ count: sql<number>`count(*)` })
        .from(scans)
        .where(eq(scans.userId, userId));
    } else {
      result = await db.select({ count: sql<number>`count(*)` }).from(scans);
    }
    return Number(result[0]?.count ?? 0);
  } catch (err) {
    logger.error('ScanQueries', 'Failed to get scan count', err);
    throw err;
  }
}

// ==========================================
// FINDING QUERIES
// ==========================================

export async function insertFindings(records: FindingRecord[]): Promise<void> {
  if (records.length === 0) return;
  try {
    const values = records.map((f) => ({
      id: f.id,
      scanId: f.scanId,
      severity: f.severity,
      category: f.category,
      filePath: f.filePath,
      lineNumber: f.lineNumber,
      title: f.title,
      description: f.description,
      impact: f.impact,
      fixSuggestion: f.fixSuggestion,
      codeSnippet: f.codeSnippet || null,
      fixSnippet: f.fixSnippet || null,
      agentId: f.agentId,
      confidence: f.confidence,
      validated: f.validated,
      armorClawScore: f.armorClawScore ? Number(f.armorClawScore) : null,
      validatedAt: f.validatedAt || null,
      createdAt: f.createdAt || new Date().toISOString(),
    }));

    // Perform batch insert
    await db.insert(findings).values(values);
  } catch (err) {
    logger.error('ScanQueries', 'Failed to batch insert findings', err);
    throw err;
  }
}

export async function getFindingsByScan(scanId: string): Promise<FindingRecord[]> {
  try {
    return await db.select().from(findings).where(eq(findings.scanId, scanId)) as FindingRecord[];
  } catch (err) {
    logger.error('ScanQueries', `Failed to get findings for scan ${scanId}`, err);
    throw err;
  }
}

export async function getFindingsByCategory(scanId: string, category: string): Promise<FindingRecord[]> {
  try {
    return await db.select().from(findings)
      .where(and(eq(findings.scanId, scanId), eq(findings.category, category))) as FindingRecord[];
  } catch (err) {
    logger.error('ScanQueries', `Failed to get findings for category ${category} in scan ${scanId}`, err);
    throw err;
  }
}

export async function getCriticalFindings(scanId: string): Promise<FindingRecord[]> {
  try {
    return await db.select().from(findings)
      .where(and(eq(findings.scanId, scanId), eq(findings.severity, 'CRITICAL'))) as FindingRecord[];
  } catch (err) {
    logger.error('ScanQueries', `Failed to get critical findings for scan ${scanId}`, err);
    throw err;
  }
}

// ==========================================
// AGENT LOG QUERIES
// ==========================================

export async function insertAgentLog(log: AgentLogRecord): Promise<void> {
  try {
    await db.insert(agentLogs).values({
      id: log.id,
      scanId: log.scanId,
      agentId: log.agentId,
      agentName: log.agentName,
      status: log.status,
      filesAnalyzed: log.filesAnalyzed,
      findingsCount: log.findingsCount,
      durationMs: log.durationMs || null,
      errorMessage: log.errorMessage || null,
      createdAt: log.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    logger.error('ScanQueries', 'Failed to insert agent log', err);
    throw err;
  }
}

export async function updateAgentLog(id: string, data: Partial<AgentLogRecord>): Promise<void> {
  try {
    const updatePayload: Record<string, any> = {};
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.findingsCount !== undefined) updatePayload.findingsCount = data.findingsCount;
    if (data.durationMs !== undefined) updatePayload.durationMs = data.durationMs;
    if (data.errorMessage !== undefined) updatePayload.errorMessage = data.errorMessage;
    if (data.filesAnalyzed !== undefined) updatePayload.filesAnalyzed = data.filesAnalyzed;

    await db.update(agentLogs).set(updatePayload).where(eq(agentLogs.id, id));
  } catch (err) {
    logger.error('ScanQueries', `Failed to update agent log ${id}`, err);
    throw err;
  }
}

export async function getAgentLogs(scanId: string): Promise<AgentLogRecord[]> {
  try {
    return await db.select().from(agentLogs).where(eq(agentLogs.scanId, scanId)) as AgentLogRecord[];
  } catch (err) {
    logger.error('ScanQueries', `Failed to get agent logs for scan ${scanId}`, err);
    throw err;
  }
}

// ==========================================
// AUDIT QUERIES
// ==========================================

import { armorIQ } from '../../armoriq/armoriq-client';

export async function insertAuditEvent(event: AuditRecord): Promise<void> {
  try {
    await db.insert(auditLog).values({
      id: event.id,
      scanId: event.scanId || null,
      eventType: event.eventType,
      agentName: event.agentName || null,
      action: event.action,
      target: event.target || null,
      result: event.result || null,
      metadata: event.metadata || null,
      armorIqPlanId: event.armorIqPlanId || null,
      createdAt: event.createdAt || new Date().toISOString(),
    });

    // Sync the audit event to the ArmorIQ Platform
    // Convert AuditRecord values to the format expected by AuditEvent
    armorIQ.logAudit({
      scanId: event.scanId || undefined,
      eventType: event.eventType,
      agentName: event.agentName || undefined,
      action: event.action,
      target: event.target || undefined,
      result: event.result || undefined,
      metadata: event.metadata ? JSON.parse(event.metadata) : undefined,
      armorIqPlanId: event.armorIqPlanId || undefined,
    }).catch((err) => {
      logger.warn('ScanQueries', 'Failed to async sync audit event to ArmorIQ', err);
    });
  } catch (err) {
    logger.error('ScanQueries', 'Failed to insert audit event', err);
    throw err;
  }
}

export async function getAuditLog(scanId?: string, limit = 50): Promise<AuditRecord[]> {
  try {
    if (scanId) {
      return await db.select().from(auditLog)
        .where(eq(auditLog.scanId, scanId))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit) as unknown as AuditRecord[];
    }
    return await db.select().from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit) as unknown as AuditRecord[];
  } catch (err) {
    logger.error('ScanQueries', 'Failed to get audit logs', err);
    throw err;
  }
}
