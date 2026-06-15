import { eq, desc } from 'drizzle-orm';
import { db, projects } from '../schema';
import { logger } from '../../utils/logger';

export interface ProjectRecord {
  id: string;
  userId?: string | null;
  projectPath: string;
  projectName: string;
  language?: string | null;
  framework?: string | null;
  lastScanId?: string | null;
  lastScore?: number | null;
  scanCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export async function upsertProject(data: ProjectRecord): Promise<void> {
  const record = {
    id: data.id,
    userId: data.userId || null,
    projectPath: data.projectPath,
    projectName: data.projectName,
    language: data.language || null,
    framework: data.framework || null,
    lastScanId: data.lastScanId || null,
    lastScore: data.lastScore ?? null,
    scanCount: data.scanCount ?? 1,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.insert(projects)
      .values(record)
      .onConflictDoUpdate({
        target: projects.projectPath,
        set: {
          projectName: record.projectName,
          language: record.language,
          framework: record.framework,
          lastScanId: record.lastScanId,
          lastScore: record.lastScore,
          scanCount: sql`${projects.scanCount} + 1`,
          updatedAt: record.updatedAt
        }
      });
  } catch (err) {
    // If the SQL tag isn't imported, let's just use regular Drizzle custom SQL or read first.
    // To be safe and clean, let's use sql helper from drizzle-orm.
    logger.error('ProjectQueries', `Failed to upsert project ${data.projectName}`, err);
    throw err;
  }
}

// Wait! Import `sql` helper from drizzle-orm
import { sql } from 'drizzle-orm';

export async function getProjects(userId?: string): Promise<ProjectRecord[]> {
  try {
    if (userId) {
      return await db.select().from(projects)
        .where(eq(projects.userId, userId))
        .orderBy(desc(projects.updatedAt)) as unknown as ProjectRecord[];
    }
    return await db.select().from(projects).orderBy(desc(projects.updatedAt)) as unknown as ProjectRecord[];
  } catch (err) {
    logger.error('ProjectQueries', 'Failed to retrieve projects list', err);
    throw err;
  }
}

export async function getProjectByPath(path: string): Promise<ProjectRecord | undefined> {
  try {
    const results = await db.select().from(projects).where(eq(projects.projectPath, path)).limit(1);
    return results[0] as unknown as ProjectRecord | undefined;
  } catch (err) {
    logger.error('ProjectQueries', `Failed to retrieve project for path ${path}`, err);
    throw err;
  }
}
