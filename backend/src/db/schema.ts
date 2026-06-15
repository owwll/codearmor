import { pgTable, varchar, integer, timestamp, real, text } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Database connection initialization
// ─────────────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[Drizzle] WARNING: DATABASE_URL is not set in environment.');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Neon Postgres connection
  }
});

export const db = drizzle(pool);

// ─────────────────────────────────────────────────────────────────────────────
// Unified User & Admin Table
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('user').notNull(), // 'user' | 'admin'
  plan: varchar('plan', { length: 50 }).default('free').notNull(), // 'free' | 'pro'
  scansToday: integer('scans_today').default(0).notNull(),
  lastScanDate: varchar('last_scan_date', { length: 50 }).default('').notNull(), // 'YYYY-MM-DD'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLogin: timestamp('last_login'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Scan History Table
// ─────────────────────────────────────────────────────────────────────────────

export const scans = pgTable('scans', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'cascade' }),
  projectPath: text('project_path').notNull(),
  projectName: text('project_name').notNull(),
  score: integer('score').default(0).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  totalFindings: integer('total_findings').default(0).notNull(),
  criticalCount: integer('critical_count').default(0).notNull(),
  warningCount: integer('warning_count').default(0).notNull(),
  infoCount: integer('info_count').default(0).notNull(),
  startedAt: varchar('started_at', { length: 255 }).notNull(),
  completedAt: varchar('completed_at', { length: 255 }),
  durationMs: integer('duration_ms'),
  armorIqPlanId: varchar('armor_iq_plan_id', { length: 255 }),
  metadata: text('metadata'), // JSON blob string
});

// ─────────────────────────────────────────────────────────────────────────────
// Findings Table
// ─────────────────────────────────────────────────────────────────────────────

export const findings = pgTable('findings', {
  id: varchar('id', { length: 255 }).primaryKey(),
  scanId: varchar('scan_id', { length: 255 }).notNull().references(() => scans.id, { onDelete: 'cascade' }),
  severity: varchar('severity', { length: 50 }).notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  lineNumber: integer('line_number').default(0).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  impact: text('impact').notNull(),
  fixSuggestion: text('fix_suggestion').notNull(),
  codeSnippet: text('code_snippet'),
  fixSnippet: text('fix_snippet'),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  confidence: real('confidence').default(0.0).notNull(),
  validated: integer('validated').default(0).notNull(), // 0 = false, 1 = true
  armorClawScore: real('armor_claw_score'),
  validatedAt: varchar('validated_at', { length: 255 }),
  createdAt: varchar('created_at', { length: 255 }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent Logs Table
// ─────────────────────────────────────────────────────────────────────────────

export const agentLogs = pgTable('agent_logs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  scanId: varchar('scan_id', { length: 255 }).notNull().references(() => scans.id, { onDelete: 'cascade' }),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  agentName: varchar('agent_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  filesAnalyzed: integer('files_analyzed').default(0).notNull(),
  findingsCount: integer('findings_count').default(0).notNull(),
  durationMs: integer('duration_ms'),
  errorMessage: text('error_message'),
  createdAt: varchar('created_at', { length: 255 }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Audit Log Table
// ─────────────────────────────────────────────────────────────────────────────

export const auditLog = pgTable('audit_log', {
  id: varchar('id', { length: 255 }).primaryKey(),
  scanId: varchar('scan_id', { length: 255 }).references(() => scans.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  agentName: varchar('agent_name', { length: 255 }),
  action: varchar('action', { length: 255 }).notNull(),
  target: text('target'),
  result: text('result'),
  metadata: text('metadata'), // JSON blob string
  armorIqPlanId: varchar('armor_iq_plan_id', { length: 255 }),
  createdAt: varchar('created_at', { length: 255 }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Projects Table
// ─────────────────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).references(() => users.id, { onDelete: 'cascade' }),
  projectPath: text('project_path').notNull().unique(),
  projectName: text('project_name').notNull(),
  language: varchar('language', { length: 100 }),
  framework: varchar('framework', { length: 100 }),
  lastScanId: varchar('last_scan_id', { length: 255 }),
  lastScore: integer('last_score'),
  scanCount: integer('scan_count').default(0).notNull(),
  createdAt: varchar('created_at', { length: 255 }),
  updatedAt: varchar('updated_at', { length: 255 }),
});

export function initDatabase(): void {
  // Database pool is automatically initialized on module load
}

export function getDb() {
  return db;
}
