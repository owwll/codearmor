import { Request, Response } from 'express';
import * as queries from '../../db/queries';
import { logger } from '../../utils/logger';

/**
 * GET /api/admin/projects
 */
export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.role !== 'admin' ? req.user?.userId : undefined;
    const projects = await queries.getProjects(userId);
    res.json({ projects });
  } catch (err) {
    logger.error('AdminController', 'getProjects failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/stats
 */
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.role !== 'admin' ? req.user?.userId : undefined;
    const overview          = await queries.getDashboardStats(userId);
    const severityBreakdown = await queries.getSeverityBreakdown(userId);
    const categoryBreakdown = await queries.getCategoryBreakdown(10, userId);

    res.json({
      overview,
      severityBreakdown,
      categoryBreakdown,
    });
  } catch (err) {
    logger.error('AdminController', 'getStats failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/audit-log
 */
export async function getAuditLog(req: Request, res: Response): Promise<void> {
  try {
    const scanId = req.query.scanId as string | undefined;
    const userId = req.user?.role !== 'admin' ? req.user?.userId : undefined;
    
    let events = await queries.getAuditLog(scanId, 100);
    
    if (userId) {
      // Non-admins should only see audit logs of their own scans
      const userScans = await queries.getRecentScans(1000, 0, userId);
      const userScanIds = new Set(userScans.map(s => s.id));
      events = events.filter(e => e.scanId && userScanIds.has(e.scanId));
    }
    
    res.json({ events, total: events.length });
  } catch (err) {
    logger.error('AdminController', 'getAuditLog failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/scans
 */
export async function getScans(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.role !== 'admin' ? req.user?.userId : undefined;
    const scans = await queries.getRecentScans(50, 0, userId);

    const enriched = scans.map((scan) => ({
      ...scan,
      findingsCount: scan.totalFindings ?? 0,
    }));

    res.json({ scans: enriched, total: enriched.length });
  } catch (err) {
    logger.error('AdminController', 'getScans failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/users
 */
export async function getUsers(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const users = await queries.getAllUsers();
    res.json({ users });
  } catch (err) {
    logger.error('AdminController', 'getUsers failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/users/:id/plan
 */
export async function updateUserPlan(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { id } = req.params;
  const { plan } = req.body;

  if (plan !== 'free' && plan !== 'pro') {
    res.status(400).json({ error: 'Invalid plan type' });
    return;
  }

  try {
    await queries.toggleUserPlan(id, plan);
    logger.info('AdminController', `User ${id} plan updated to ${plan}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('AdminController', 'updateUserPlan failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/admin/users/:id/role
 */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { id } = req.params;
  const { role } = req.body;

  if (role !== 'user' && role !== 'admin') {
    res.status(400).json({ error: 'Invalid role type' });
    return;
  }

  try {
    await queries.toggleUserRole(id, role);
    logger.info('AdminController', `User ${id} role updated to ${role}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('AdminController', 'updateUserRole failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/admin/usage
 * Returns per-user daily scan usage (admin-only).
 */
export async function getUsageStats(req: Request, res: Response): Promise<void> {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const users = await queries.getAllUsers();
    const todayStr = new Date().toISOString().split('T')[0];

    const usage = users.map((u) => {
      const scansToday = u.lastScanDate === todayStr ? u.scansToday : 0;
      const limit = u.plan === 'pro' || u.role === 'admin' ? Infinity : 3;
      const remaining = limit === Infinity ? 9999 : Math.max(0, limit - scansToday);
      return {
        userId:    u.id,
        username:  u.username,
        plan:      u.plan,
        role:      u.role,
        scansToday,
        limit:     limit === Infinity ? null : limit,
        remaining: limit === Infinity ? null : remaining,
        lastScanDate: u.lastScanDate || null,
        createdAt: u.createdAt,
      };
    });

    res.json({ usage, total: usage.length });
  } catch (err) {
    logger.error('AdminController', 'getUsageStats failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
