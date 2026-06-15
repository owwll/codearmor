import { sql } from 'drizzle-orm';
import { db, pool } from './schema';
import { runMigrations } from './migrations';
import { logger } from '../utils/logger';

async function main() {
  logger.info('ResetDB', 'Resetting database on Neon Postgres...');
  try {
    // 1. Drop all existing tables with CASCADE to clean the database
    await db.execute(sql`
      DROP TABLE IF EXISTS findings, agent_logs, audit_log, scans, projects, users CASCADE;
    `);
    logger.info('ResetDB', 'Dropped all existing tables.');

    // 2. Re-run migrations to recreate schema and seed the default admin
    await runMigrations();
    logger.info('ResetDB', 'Database recreated and seeded successfully.');
  } catch (err) {
    logger.error('ResetDB', 'Error resetting database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
