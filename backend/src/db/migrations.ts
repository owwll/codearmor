import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db } from './schema';
import { getUserByUsername, createUser } from './queries/users.queries';
import { logger } from '../utils/logger';

/**
 * Runs DDL migrations to set up PostgreSQL tables and indexes on Neon if they do not exist.
 * Then seeds a default admin user if one is missing.
 */
export async function runMigrations(): Promise<void> {
  logger.info('Migrations', 'Running schema setup on Neon Postgres...');

  try {
    // 1. Create tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user' NOT NULL,
        plan VARCHAR(50) DEFAULT 'free' NOT NULL,
        scans_today INTEGER DEFAULT 0 NOT NULL,
        last_scan_date VARCHAR(50) DEFAULT '' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_login TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scans (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        project_path TEXT NOT NULL,
        project_name TEXT NOT NULL,
        score INTEGER DEFAULT 0 NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' NOT NULL,
        total_findings INTEGER DEFAULT 0 NOT NULL,
        critical_count INTEGER DEFAULT 0 NOT NULL,
        warning_count INTEGER DEFAULT 0 NOT NULL,
        info_count INTEGER DEFAULT 0 NOT NULL,
        started_at VARCHAR(255) NOT NULL,
        completed_at VARCHAR(255),
        duration_ms INTEGER,
        armor_iq_plan_id VARCHAR(255),
        metadata TEXT
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS findings (
        id VARCHAR(255) PRIMARY KEY,
        scan_id VARCHAR(255) NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        severity VARCHAR(50) NOT NULL,
        category VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        line_number INTEGER DEFAULT 0 NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        fix_suggestion TEXT NOT NULL,
        code_snippet TEXT,
        fix_snippet TEXT,
        agent_id VARCHAR(255) NOT NULL,
        confidence REAL DEFAULT 0 NOT NULL,
        validated INTEGER DEFAULT 0 NOT NULL,
        armor_claw_score REAL,
        validated_at VARCHAR(255),
        created_at VARCHAR(255)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_logs (
        id VARCHAR(255) PRIMARY KEY,
        scan_id VARCHAR(255) NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        agent_id VARCHAR(255) NOT NULL,
        agent_name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        files_analyzed INTEGER DEFAULT 0 NOT NULL,
        findings_count INTEGER DEFAULT 0 NOT NULL,
        duration_ms INTEGER,
        error_message TEXT,
        created_at VARCHAR(255)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(255) PRIMARY KEY,
        scan_id VARCHAR(255) REFERENCES scans(id) ON DELETE CASCADE,
        event_type VARCHAR(255) NOT NULL,
        agent_name VARCHAR(255),
        action VARCHAR(255) NOT NULL,
        target TEXT,
        result TEXT,
        metadata TEXT,
        armor_iq_plan_id VARCHAR(255),
        created_at VARCHAR(255)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
        project_path TEXT NOT NULL UNIQUE,
        project_name TEXT NOT NULL,
        language VARCHAR(100),
        framework VARCHAR(100),
        last_scan_id VARCHAR(255),
        last_score INTEGER,
        scan_count INTEGER DEFAULT 0 NOT NULL,
        created_at VARCHAR(255),
        updated_at VARCHAR(255)
      );
    `);

    // 2. Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_audit_log_scan_id ON audit_log(scan_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_logs_scan_id ON agent_logs(scan_id);`);

    logger.info('Migrations', 'DDL setup finished.');

    // 3. Seed admin user
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';

    const admin = await getUserByUsername(username);
    if (!admin) {
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      await createUser({
        id: `admin_${Math.random().toString(36).substring(2, 11)}`,
        username,
        passwordHash,
        role: 'admin',
        plan: 'pro'
      });
      logger.info('Migrations', 'Default admin created', { username });
    } else {
      logger.info('Migrations', 'Admin already exists', { username });
    }
  } catch (err) {
    logger.error('Migrations', 'Error running migrations', err);
    throw err;
  }
}
