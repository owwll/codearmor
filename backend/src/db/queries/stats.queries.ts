import { sql, eq } from 'drizzle-orm';
import { db, scans, findings, projects } from '../schema';
import { logger } from '../../utils/logger';

export async function getDashboardStats(userId?: string): Promise<{
  totalScans: number;
  totalFindings: number;
  avgScore: number;
  projectCount: number;
}> {
  try {
    let scansCountRes;
    let findingsCountRes;
    let avgScoreRes;
    let projectsCountRes;

    if (userId) {
      scansCountRes = await db.select({ count: sql<number>`count(*)` }).from(scans).where(eq(scans.userId, userId));
      findingsCountRes = await db.select({ count: sql<number>`count(*)` })
        .from(findings)
        .innerJoin(scans, eq(findings.scanId, scans.id))
        .where(eq(scans.userId, userId));
      avgScoreRes = await db.select({ avg: sql<number>`avg(${scans.score})` }).from(scans).where(eq(scans.userId, userId));
      projectsCountRes = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.userId, userId));
    } else {
      scansCountRes = await db.select({ count: sql<number>`count(*)` }).from(scans);
      findingsCountRes = await db.select({ count: sql<number>`count(*)` }).from(findings);
      avgScoreRes = await db.select({ avg: sql<number>`avg(${scans.score})` }).from(scans);
      projectsCountRes = await db.select({ count: sql<number>`count(*)` }).from(projects);
    }

    const totalScans = Number(scansCountRes[0]?.count ?? 0);
    const totalFindings = Number(findingsCountRes[0]?.count ?? 0);
    const avgScore = Math.round(Number(avgScoreRes[0]?.avg ?? 0));
    const projectCount = Number(projectsCountRes[0]?.count ?? 0);

    return {
      totalScans,
      totalFindings,
      avgScore,
      projectCount,
    };
  } catch (err) {
    logger.error('StatsQueries', 'Failed to retrieve dashboard stats', err);
    throw err;
  }
}

export async function getSeverityBreakdown(userId?: string): Promise<{ severity: string; count: number }[]> {
  try {
    if (userId) {
      const results = await db.select({
        severity: findings.severity,
        count: sql<number>`count(*)`
      })
      .from(findings)
      .innerJoin(scans, eq(findings.scanId, scans.id))
      .where(eq(scans.userId, userId))
      .groupBy(findings.severity);
      return results.map(r => ({ severity: r.severity, count: Number(r.count) }));
    }

    const results = await db.select({
      severity: findings.severity,
      count: sql<number>`count(*)`
    })
    .from(findings)
    .groupBy(findings.severity);
    return results.map(r => ({ severity: r.severity, count: Number(r.count) }));
  } catch (err) {
    logger.error('StatsQueries', 'Failed to retrieve severity breakdown', err);
    throw err;
  }
}

export async function getCategoryBreakdown(limit: number, userId?: string): Promise<{ category: string; count: number }[]> {
  try {
    if (userId) {
      const results = await db.select({
        category: findings.category,
        count: sql<number>`count(*)`
      })
      .from(findings)
      .innerJoin(scans, eq(findings.scanId, scans.id))
      .where(eq(scans.userId, userId))
      .groupBy(findings.category)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);
      return results.map(r => ({ category: r.category, count: Number(r.count) }));
    }

    const results = await db.select({
      category: findings.category,
      count: sql<number>`count(*)`
    })
    .from(findings)
    .groupBy(findings.category)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);
    return results.map(r => ({ category: r.category, count: Number(r.count) }));
  } catch (err) {
    logger.error('StatsQueries', 'Failed to retrieve category breakdown', err);
    throw err;
  }
}
