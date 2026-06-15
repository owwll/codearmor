import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth/auth.middleware';
import {
  getProjects,
  getStats,
  getAuditLog,
  getScans,
  getUsers,
  updateUserPlan,
  updateUserRole,
  getUsageStats,
} from './admin.controller';

const router = Router();

// Dashboard routes are accessible by regular users (they see their own data)
router.use(requireAuth);

/**
 * GET /api/admin/projects
 */
router.get('/projects', getProjects);

/**
 * GET /api/admin/stats
 */
router.get('/stats', getStats);

/**
 * GET /api/admin/audit-log
 */
router.get('/audit-log', getAuditLog);

/**
 * GET /api/admin/scans
 */
router.get('/scans', getScans);

/**
 * GET /api/admin/users
 */
router.get('/users', getUsers);

/**
 * POST /api/admin/users/:id/plan
 */
router.post('/users/:id/plan', updateUserPlan);

/**
 * POST /api/admin/users/:id/role
 */
router.post('/users/:id/role', updateUserRole);

/**
 * GET /api/admin/usage
 */
router.get('/usage', getUsageStats);

export default router;
