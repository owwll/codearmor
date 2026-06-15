import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as CSRF_SCANNER_PROMPT } from '../hf/prompts/csrf-scanner.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class CSRFScanner extends BaseAgent {
  name = 'CSRF Scanner';
  agentId = 'csrf-scanner';

  private PATTERN_LOCAL_STORAGE = /localStorage\.(set|get)Item\s*\(['"](token|jwt|auth)/i;
  private PATTERN_NO_SAMESITE = /res\.cookie\s*\([^)]+\)(?!.*sameSite)/;

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const targets = [...fileMap.routeFiles, ...fileMap.sourceFiles];
    const uniqueTargets = Array.from(new Set(targets));

    this.logStart(uniqueTargets.length);
    const startTime = Date.now();
    const allFindings: RawFinding[] = [];

    // 1. Check package.json for CSRF protection library
    if (fileMap.packageJson) {
      try {
        const allowed = await invokeFileRead(fileMap.packageJson, token, this.agentId);
        if (allowed) {
          const { content } = readFileSafe(fileMap.packageJson, fileMap.rootPath);
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };

          if (!deps['csurf'] && !deps['csrf-csrf'] && !deps['express-xsrf-jwt']) {
            allFindings.push({
              id: `csrf_pkg_missing_${crypto.randomUUID()}`,
              severity: 'INFO',
              category: 'CSRF_MISSING_TOKEN',
              file: 'package.json',
              line: 1,
              title: 'CSRF protection package missing',
              description: 'No CSRF protection middleware (e.g. csurf or csrf-csrf) was found in package.json.',
              impact: 'The application might be vulnerable to Cross-Site Request Forgery (CSRF) attacks on state-changing endpoints.',
              fix: 'Install and configure csrf-csrf or equivalent CSRF middleware.',
              codeSnippet: '"dependencies": {}',
              fixSnippet: '"csrf-csrf": "^3.0.0"',
              agentId: this.agentId,
              confidence: 0.80,
            });
          }
        }
      } catch (err) {
        logger.error(this.agentId, 'Failed to scan package.json for CSRF libraries', err);
      }
    }

    // 2. Scan targets with regex and LLM
    for (const filePath of uniqueTargets) {
      try {
        const allowed = await invokeFileRead(filePath, token, this.agentId);
        if (!allowed) continue;

        const { content } = readFileSafe(filePath, fileMap.rootPath);
        const relativePath = path.relative(fileMap.rootPath, filePath);
        const lines = content.split(/\r?\n/);

        // Run static regex checks
        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];
          const lineNum = i + 1;

          if (this.PATTERN_LOCAL_STORAGE.test(lineContent)) {
            allFindings.push({
              id: `static_csrf_localstorage_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'CSRF_MISSING_TOKEN',
              file: relativePath,
              line: lineNum,
              title: 'JWT stored in LocalStorage',
              description: 'Storing authentication tokens (JWTs) in LocalStorage makes them accessible to XSS attacks.',
              impact: 'If XSS exists, an attacker can steal the JWT token to impersonate the user, bypassing CSRF protections.',
              fix: 'Store JWTs in httpOnly, secure, sameSite cookies instead of LocalStorage.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'strict' });",
              agentId: this.agentId,
              confidence: 0.90,
            });
          }

          if (this.PATTERN_NO_SAMESITE.test(lineContent)) {
            allFindings.push({
              id: `static_csrf_samesite_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'CSRF_WRONG_SAMESITE',
              file: relativePath,
              line: lineNum,
              title: 'Cookie sameSite attribute not set',
              description: 'Setting cookies without the sameSite attribute allows cross-site requests to include cookies.',
              impact: 'Enables Cross-Site Request Forgery (CSRF) attacks if the user triggers actions on another site.',
              fix: 'Set sameSite: "strict" or sameSite: "lax" explicitly in cookie options.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "res.cookie('session', id, { sameSite: 'strict', httpOnly: true });",
              agentId: this.agentId,
              confidence: 0.85,
            });
          }
        }

        // Run LLM Scan
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, CSRF_SCANNER_PROMPT);
        allFindings.push(...hfFindings);
      } catch (err) {
        logger.error(this.agentId, `Error scanning file: ${filePath}`, err);
      }
    }

    const deduplicated = this.deduplicateByLine(allFindings);
    this.logComplete(deduplicated.length, Date.now() - startTime);
    return deduplicated;
  }
}
