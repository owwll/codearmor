import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as API_SECURITY_PROMPT } from '../hf/prompts/api-security.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class APISecurityAgent extends BaseAgent {
  name = 'API Security';
  agentId = 'api-security';

  private PATTERN_MONGOOSE_UPDATE = /findByIdAndUpdate\s*\([^,]+,\s*req\.body(?!\s*\.)/;
  private PATTERN_OBJECT_ASSIGN = /Object\.assign\s*\([a-zA-Z_$]+\s*,\s*req\.body\)/;
  private PATTERN_MODEL_CREATE = /(?:Model|[A-Z][a-zA-Z]+)\.create\s*\(\s*req\.body\s*\)/;
  private PATTERN_SSRF_AXIOS = /axios\.(get|post)\s*\(\s*req\.(body|query|params)\./;
  private PATTERN_SSRF_HTTP = /https?\.(?:get|request)\s*\(\s*req\.(body|query|params)\./;

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const targets = [...fileMap.routeFiles, ...fileMap.sourceFiles];
    const uniqueTargets = Array.from(new Set(targets));

    this.logStart(uniqueTargets.length);
    const startTime = Date.now();
    const allFindings: RawFinding[] = [];

    for (const filePath of uniqueTargets) {
      try {
        const allowed = await invokeFileRead(filePath, token, this.agentId);
        if (!allowed) continue;

        const { content } = readFileSafe(filePath, fileMap.rootPath);
        const relativePath = path.relative(fileMap.rootPath, filePath);
        const lines = content.split(/\r?\n/);

        // 1. Run static checks line by line
        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];
          const lineNum = i + 1;

          if (this.PATTERN_MONGOOSE_UPDATE.test(lineContent)) {
            allFindings.push({
              id: `static_api_mongoose_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'MASS_ASSIGNMENT',
              file: relativePath,
              line: lineNum,
              title: 'Potential Mass Assignment in findByIdAndUpdate()',
              description: 'Passing raw req.body directly to findByIdAndUpdate allows clients to update unauthorized fields.',
              impact: 'Attackers can modify administrative flags (e.g. isAdmin: true) or elevate privileges.',
              fix: 'Whitelist allowed fields or sanitize req.body before updating the database.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const { name, email } = req.body; await User.findByIdAndUpdate(id, { name, email });',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_OBJECT_ASSIGN.test(lineContent)) {
            allFindings.push({
              id: `static_api_assign_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'MASS_ASSIGNMENT',
              file: relativePath,
              line: lineNum,
              title: 'Mass Assignment via Object.assign()',
              description: 'Assigning raw req.body directly to a database model allows attackers to overwrite restricted parameters.',
              impact: 'Privilege escalation, state bypass, or parameter tampering.',
              fix: 'Deconstruct only permitted fields before assignment.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const { bio } = req.body; Object.assign(user, { bio });',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_MODEL_CREATE.test(lineContent)) {
            allFindings.push({
              id: `static_api_create_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'MASS_ASSIGNMENT',
              file: relativePath,
              line: lineNum,
              title: 'Mass Assignment in Model.create()',
              description: 'Creating models directly with req.body can lead to unauthorized field setting.',
              impact: 'Attackers can register with higher privileges or inject unauthorized state details.',
              fix: 'Pass sanitized parameters to the create method.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'User.create({ username: req.body.username, passwordHash })',
              agentId: this.agentId,
              confidence: 0.85,
            });
          }

          if (this.PATTERN_SSRF_AXIOS.test(lineContent)) {
            allFindings.push({
              id: `static_api_ssrf_axios_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'SSRF',
              file: relativePath,
              line: lineNum,
              title: 'Server-Side Request Forgery via Axios',
              description: 'The application makes outgoing HTTP requests to a URL provided directly by the user.',
              impact: 'Attackers can access internal network services, cloud metadata endpoints, or scan internal networks.',
              fix: 'Validate user-provided URLs against a strict domain whitelist, or map IDs to predetermined URLs.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'if (ALLOWED_DOMAINS.includes(new URL(url).hostname)) { axios.get(url); }',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_SSRF_HTTP.test(lineContent)) {
            allFindings.push({
              id: `static_api_ssrf_http_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'SSRF',
              file: relativePath,
              line: lineNum,
              title: 'Server-Side Request Forgery via Node HTTP',
              description: 'Node HTTP/HTTPS client is invoked with unvalidated user input URLs.',
              impact: 'Attackers can read internal infrastructure details or fetch remote files.',
              fix: 'Validate the target host and restrict requests to external public APIs.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'if (isSafeUrl(url)) http.get(url);',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }
        }

        // 2. Run LLM check
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, API_SECURITY_PROMPT);
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
