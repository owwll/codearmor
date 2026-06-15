import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { orchestrateScan } from './orchestrator';
import * as queries from '../../db/queries';
import { logger } from '../../utils/logger';
import { ScanRequest, AgentStatus } from '../../types/scan.types';
import { ArmorIQService } from '../armoriq/armoriq.service';

function parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
  const page  = Math.max(1, parseInt(String(query.page  ?? 1),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? 20), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * POST /api/scan
 * Verified with requireAuth middleware. Enforces daily scan limits.
 */
export async function startScan(req: Request, res: Response): Promise<void> {
  const { projectPath, projectName } = req.body ?? {};
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Input validation
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    res.status(400).json({ error: 'projectPath is required and must be a non-empty string' });
    return;
  }

  const resolvedPath = path.resolve(projectPath.trim());
  if (!fs.existsSync(resolvedPath)) {
    res.status(400).json({ error: `Path does not exist: ${resolvedPath}` });
    return;
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    res.status(400).json({ error: `Path is not a directory: ${resolvedPath}` });
    return;
  }

  try {
    // Verify intent with ArmorIQ before starting
    const verifyResult = await ArmorIQService.verifyIntent('scan_start', {
      projectPath: resolvedPath,
      projectName: (typeof projectName === 'string' && projectName.trim())
        ? projectName.trim()
        : path.basename(resolvedPath),
      userId
    });

    if (!verifyResult.allowed) {
      res.status(403).json({
        error: `Policy Check Failed: ${verifyResult.reason || 'Verification failed by OPA Policy engine.'}`,
        policyFailed: true
      });
      return;
    }

    // Check user limits
    const limitCheck = await queries.checkAndIncrementScanLimit(userId);
    if (!limitCheck.allowed) {
      res.status(403).json({
        error: 'Scan limit reached. Please upgrade to Pro plan to get unlimited scans.',
        limitReached: true
      });
      return;
    }

    const scanId = crypto.randomUUID();

    // Pre-register scan associated with user
    await queries.createScan({
      id:           scanId,
      userId,
      projectPath:  resolvedPath,
      projectName:  (typeof projectName === 'string' && projectName.trim())
        ? projectName.trim()
        : path.basename(resolvedPath),
      status:       'pending',
      startedAt:    new Date().toISOString(),
    });

    const scanRequest: ScanRequest = {
      scanId,
      projectPath: resolvedPath,
      projectName: typeof projectName === 'string' ? projectName.trim() : undefined,
      userId,
    };

    // Trigger orchestrator in background
    orchestrateScan(scanRequest).catch(async (err) => {
      logger.error('ScanController', `Background scan ${scanId} failed`, err);
      try {
        await queries.updateScan(scanId, {
          status:       'failed',
          completedAt: new Date().toISOString(),
        });
      } catch (dbErr) {
        logger.error('ScanController', 'Failed to mark scan as failed in DB', dbErr);
      }
    });

    res.status(202).json({ scanId, message: 'Scan started', remainingScans: limitCheck.remaining });
  } catch (err) {
    logger.error('ScanController', 'Failed to start scan', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/scan/:id
 */
export async function getScan(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const scan = await queries.getScanById(id);
    if (!scan) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    // Access control: regular user can only view their own scans
    if (user.role !== 'admin' && scan.userId !== user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const findingRecords = await queries.getFindingsByScan(id);
    const agentLogs      = await queries.getAgentLogs(id);

    const agentStatuses: AgentStatus[] = agentLogs.map((log) => ({
      agentId:       log.agentId,
      agentName:     log.agentName,
      status:        log.status as AgentStatus['status'],
      filesAnalyzed: log.filesAnalyzed,
      findingsCount: log.findingsCount,
      durationMs:    log.durationMs ?? 0,
      error:         log.errorMessage ?? undefined,
    }));

    const mappedFindings = findingRecords.map((f) => ({
      id:             f.id,
      severity:       f.severity,
      category:       f.category,
      file:           f.filePath,
      line:           f.lineNumber,
      title:          f.title,
      description:    f.description,
      impact:         f.impact,
      fix:            f.fixSuggestion,
      codeSnippet:    f.codeSnippet ?? '',
      fixSnippet:     f.fixSnippet ?? '',
      agentId:        f.agentId,
      confidence:     f.confidence,
      validated:      Boolean(f.validated),
      armorClawScore: f.armorClawScore ?? 0,
    }));

    res.json({
      scanId:        scan.id,
      projectPath:   scan.projectPath,
      projectName:   scan.projectName,
      score:         scan.score,
      status:        scan.status,
      findings:      mappedFindings,
      agentStatuses,
      summary: {
        critical: scan.criticalCount,
        warning:  scan.warningCount,
        info:     scan.infoCount,
        total:    scan.totalFindings,
      },
      startedAt:     scan.startedAt,
      completedAt:   scan.completedAt,
      durationMs:    scan.durationMs,
      armorIqPlanId: scan.armorIqPlanId,
    });
  } catch (err) {
    logger.error('ScanController', `getScan ${id} failed`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/scans/list
 */
export async function listScans(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>);
    
    // Regular users see only their scans, admins see all
    const targetUserId = user.role === 'admin' ? undefined : user.userId;
    
    const scans = await queries.getRecentScans(limit, offset, targetUserId);
    const total = await queries.getScanCount(targetUserId);

    res.json({ scans, total, page, limit });
  } catch (err) {
    logger.error('ScanController', 'listScans failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
