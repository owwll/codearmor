import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as ROUTE_ANALYST_PROMPT } from '../hf/prompts/route-analyst.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class RouteAnalyst extends BaseAgent {
  name = 'Route Analyst';
  agentId = 'route-analyst';

  private PATTERN_NO_AUTH = /router\.(get|post|put|delete|patch)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*async/;
  private PATTERN_OPEN_REDIRECT = /res\.redirect\s*\(\s*req\.(query|body|params)\./;
  private PATTERN_ADMIN_NO_ROLE = /\/admin[^'"]*['"],\s*authenticate[^,]+,\s*async/;

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const targets = [...fileMap.routeFiles, ...fileMap.controllerFiles];
    const uniqueTargets = Array.from(new Set(targets));
    
    this.logStart(uniqueTargets.length);
    const startTime = Date.now();
    const allFindings: RawFinding[] = [];

    for (const filePath of uniqueTargets) {
      // 1. Run HF analysis
      try {
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, ROUTE_ANALYST_PROMPT);
        allFindings.push(...hfFindings);
      } catch (err) {
        logger.error(this.agentId, `Error analyzing file via HF: ${filePath}`, err);
      }

      // 2. Run static analysis
      try {
        const allowed = await invokeFileRead(filePath, token, this.agentId);
        if (!allowed) continue;

        const { content } = readFileSafe(filePath, fileMap.rootPath);
        const lines = content.split(/\r?\n/);
        const relativePath = path.relative(fileMap.rootPath, filePath);

        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];
          const lineNum = i + 1;

          if (this.PATTERN_NO_AUTH.test(lineContent)) {
            allFindings.push({
              id: `static_route_no_auth_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'MISSING_AUTH',
              file: relativePath,
              line: lineNum,
              title: 'Route handler missing authentication middleware',
              description: 'Sensitive API endpoint defined without route-level authentication middleware before the handler.',
              impact: 'Unauthorized users can access this endpoint, potentially exposing private data or actions.',
              fix: 'Add authentication middleware: router.get("/path", authMiddleware, async ...)',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'router.get("/path", auth, async (req, res) => {',
              agentId: this.agentId,
              confidence: 0.85,
            });
          }

          if (this.PATTERN_OPEN_REDIRECT.test(lineContent)) {
            allFindings.push({
              id: `static_route_open_redirect_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'OPEN_REDIRECT',
              file: relativePath,
              line: lineNum,
              title: 'Potential Open Redirect vulnerability',
              description: 'The application redirects users to a URL taken directly from user input without validation.',
              impact: 'Attackers can construct links that redirect victims to malicious phishing sites under the guise of your domain.',
              fix: 'Validate redirect URL against a whitelist of domains or ensure it is a relative path starting with /.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'if (isValidRedirect(url)) res.redirect(url);',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_ADMIN_NO_ROLE.test(lineContent)) {
            allFindings.push({
              id: `static_route_admin_no_role_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'MISSING_ROLE_CHECK',
              file: relativePath,
              line: lineNum,
              title: 'Admin route missing role-based access control check',
              description: 'The admin route uses general authentication middleware but lacks a role check (like requireAdmin).',
              impact: 'Any authenticated user can access sensitive administrative functionality.',
              fix: 'Add authorization middleware check: router.get("/admin/config", authenticate, requireAdmin, async ...)',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'router.get("/admin", authenticate, requireAdmin, async (req, res) => {',
              agentId: this.agentId,
              confidence: 0.90,
            });
          }
        }
      } catch (err) {
        logger.error(this.agentId, `Error in static scan for: ${filePath}`, err);
      }
    }

    const deduplicated = this.deduplicateByLine(allFindings);
    this.logComplete(deduplicated.length, Date.now() - startTime);
    return deduplicated;
  }
}
