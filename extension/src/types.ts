// ─────────────────────────────────────────────────────────────────────────────
// Scan phases — mirrors the orchestrator's progress event phases
// ─────────────────────────────────────────────────────────────────────────────

export type ScanPhase =
  | 'INITIALIZING'
  | 'PLANNING'
  | 'SCANNING'
  | 'AGENT_START'
  | 'AGENT_COMPLETE'
  | 'VALIDATING'
  | 'SCORING'
  | 'COMPLETE'
  | 'FAILED';

// ─────────────────────────────────────────────────────────────────────────────
// Progress events streamed from the backend during a scan
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressEvent {
  phase: ScanPhase;
  scanId?: string;
  agentId?: string;
  agentName?: string;
  message?: string;
  findingsCount?: number;
  durationMs?: number;
  fileCount?: number;
  rawCount?: number;
  validatedCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Findings — mirrors backend ValidatedFinding
// ─────────────────────────────────────────────────────────────────────────────

export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: string;
  file: string;
  line: number;
  title: string;
  description: string;
  impact: string;
  fix: string;
  codeSnippet: string;
  fixSnippet: string;
  agentId: string;
  confidence: number;
  validated: boolean;
  armorClawScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan result — returned after a completed scan
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanResult {
  scanId: string;
  projectPath: string;
  projectName: string;
  score: number;
  status: string;
  findings: Finding[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  durationMs?: number;
  armorIqPlanId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webview ↔ Extension message protocol (discriminated union)
// ─────────────────────────────────────────────────────────────────────────────

/** Extension → Webview: scan has been triggered, show loading state */
export interface ScanStartMessage   { type: 'SCAN_START' }

/** Extension → Webview: per-agent / per-phase progress update */
export interface AgentUpdateMessage { type: 'AGENT_UPDATE';    payload: ProgressEvent }

/** Extension → Webview: scan finished successfully */
export interface ScanCompleteMessage{ type: 'SCAN_COMPLETE';   payload: ScanResult }

/** Extension → Webview: scan failed */
export interface ScanErrorMessage   { type: 'SCAN_ERROR';      payload: { message: string } }

/** Webview → Extension: open a source file at a specific line */
export interface NavigateToFileMessage { type: 'NAVIGATE_TO_FILE'; payload: { file: string; line: number } }

/** Webview → Extension: user requested another scan */
export interface RequestRescanMessage  { type: 'REQUEST_RESCAN' }

/** Webview ↔ Extension Auth Messages */
export interface CheckAuthMessage     { type: 'CHECK_AUTH' }
export interface AuthStatusMessage    { type: 'AUTH_STATUS'; payload: { authenticated: boolean; user?: any } }
export interface InitiateLoginMessage  { type: 'INITIATE_LOGIN' }
export interface InitiateLogoutMessage { type: 'INITIATE_LOGOUT' }

export type WebviewMessage =
  | ScanStartMessage
  | AgentUpdateMessage
  | ScanCompleteMessage
  | ScanErrorMessage
  | NavigateToFileMessage
  | RequestRescanMessage
  | CheckAuthMessage
  | AuthStatusMessage
  | InitiateLoginMessage
  | InitiateLogoutMessage;

