import { eq, sql } from 'drizzle-orm';
import { db, users } from '../schema';
import { logger } from '../../utils/logger';

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  plan: string;
  scansToday: number;
  lastScanDate: string;
  createdAt: Date;
  lastLogin?: Date | null;
}

export async function createUser(data: {
  id: string;
  username: string;
  passwordHash: string;
  role?: string;
  plan?: string;
}): Promise<UserRecord> {
  const newUser = {
    id: data.id,
    username: data.username,
    passwordHash: data.passwordHash,
    role: data.role || 'user',
    plan: data.plan || 'free',
    scansToday: 0,
    lastScanDate: '',
  };

  try {
    const results = await db.insert(users).values(newUser).returning();
    return results[0] as UserRecord;
  } catch (err) {
    logger.error('UserQueries', `Failed to create user ${data.username}`, err);
    throw err;
  }
}

export async function getUserByUsername(username: string): Promise<UserRecord | undefined> {
  try {
    const results = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return results[0] as UserRecord | undefined;
  } catch (err) {
    logger.error('UserQueries', `Failed to get user by username ${username}`, err);
    throw err;
  }
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  try {
    const results = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return results[0] as UserRecord | undefined;
  } catch (err) {
    logger.error('UserQueries', `Failed to get user by id ${id}`, err);
    throw err;
  }
}

export async function getAllUsers(): Promise<UserRecord[]> {
  try {
    return await db.select().from(users).orderBy(users.username) as UserRecord[];
  } catch (err) {
    logger.error('UserQueries', 'Failed to get all users', err);
    throw err;
  }
}

export async function updateLastLogin(id: string): Promise<void> {
  try {
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, id));
  } catch (err) {
    logger.error('UserQueries', `Failed to update last login for ${id}`, err);
    throw err;
  }
}

export async function upgradeUserToPro(id: string): Promise<void> {
  try {
    await db.update(users).set({ plan: 'pro' }).where(eq(users.id, id));
  } catch (err) {
    logger.error('UserQueries', `Failed to upgrade user ${id}`, err);
    throw err;
  }
}

export async function toggleUserPlan(id: string, plan: 'free' | 'pro'): Promise<void> {
  try {
    await db.update(users).set({ plan }).where(eq(users.id, id));
  } catch (err) {
    logger.error('UserQueries', `Failed to change plan for user ${id}`, err);
    throw err;
  }
}

export async function toggleUserRole(id: string, role: 'user' | 'admin'): Promise<void> {
  try {
    await db.update(users).set({ role }).where(eq(users.id, id));
  } catch (err) {
    logger.error('UserQueries', `Failed to change role for user ${id}`, err);
    throw err;
  }
}

export async function checkAndIncrementScanLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  plan: string;
}> {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return { allowed: false, remaining: 0, plan: 'free' };
    }

    if (user.plan === 'pro' || user.role === 'admin') {
      return { allowed: true, remaining: 9999, plan: user.plan };
    }

    const todayStr = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    let currentScans = user.scansToday;

    if (user.lastScanDate !== todayStr) {
      currentScans = 0;
    }

    if (currentScans >= 3) {
      return { allowed: false, remaining: 0, plan: 'free' };
    }

    const newScansCount = currentScans + 1;
    await db.update(users).set({
      scansToday: newScansCount,
      lastScanDate: todayStr
    }).where(eq(users.id, userId));

    return { allowed: true, remaining: 3 - newScansCount, plan: 'free' };
  } catch (err) {
    logger.error('UserQueries', `Failed to check scan limits for user ${userId}`, err);
    throw err;
  }
}
