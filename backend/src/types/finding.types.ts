export type FindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type FindingCategory =
  | 'IDOR'
  | 'MISSING_AUTH'
  | 'MISSING_ROLE_CHECK'
  | 'OPEN_ENDPOINT'
  | 'WEAK_JWT'
  | 'INSECURE_PASSWORD_STORAGE'
  | 'HARDCODED_SECRET'
  | 'INSECURE_SESSION'
  | 'MISSING_TOKEN_EXPIRY'
  | 'SQL_INJECTION'
  | 'NOSQL_INJECTION'
  | 'COMMAND_INJECTION'
  | 'LDAP_INJECTION'
  | 'XPATH_INJECTION'
  | 'TEMPLATE_INJECTION'
  | 'DATA_IN_LOGS'
  | 'VERBOSE_ERRORS'
  | 'SENSITIVE_RESPONSE'
  | 'DATA_IN_URL'
  | 'UNENCRYPTED_STORAGE'
  | 'VULNERABLE_DEPENDENCY'
  | 'CORS_MISCONFIGURATION'
  | 'MISSING_SECURITY_HEADERS'
  | 'MISSING_RATE_LIMIT'
  | 'DEBUG_IN_PRODUCTION'
  | 'XSS_REFLECTED'
  | 'XSS_STORED'
  | 'XSS_DOM'
  | 'UNSAFE_TEMPLATE'
  | 'CSRF_MISSING_TOKEN'
  | 'CSRF_WRONG_SAMESITE'
  | 'PATH_TRAVERSAL'
  | 'UNRESTRICTED_FILE_UPLOAD'
  | 'INSECURE_FILE_PERMISSIONS'
  | 'MASS_ASSIGNMENT'
  | 'MISSING_INPUT_VALIDATION'
  | 'OPEN_REDIRECT'
  | 'SSRF'
  | 'INSECURE_DESERIALIZATION'
  | 'RACE_CONDITION'
  | 'BUSINESS_LOGIC_BYPASS'
  | 'WEAK_CIPHER'
  | 'HARDCODED_IV'
  | 'INSECURE_RANDOM'
  | 'MISSING_ENCRYPTION';

export interface RawFinding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  file: string;
  line: number;
  title: string;
  description: string;
  impact: string;
  fix: string;
  codeSnippet: string;
  fixSnippet: string;
  agentId: string;
  confidence: number; // 0-1
}

export interface ValidatedFinding extends RawFinding {
  validated: boolean;
  armorClawScore: number;
  validatedAt: string; // ISO timestamp
}

export interface FindingGroup {
  severity: FindingSeverity;
  findings: ValidatedFinding[];
}

export interface ScanSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}
