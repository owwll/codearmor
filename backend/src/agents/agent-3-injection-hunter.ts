import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as INJECTION_HUNTER_PROMPT } from '../hf/prompts/injection-hunter.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class InjectionHunter extends BaseAgent {
  name = 'Injection Hunter';
  agentId = 'injection-hunter';

  private PATTERN_SQL_TEMPLATE = /`[^`]*SELECT[^`]*\$\{req\.(params|body|query)/i;
  private PATTERN_SQL_CONCAT = /['"][^'"]*WHERE[^'"]*['"]\s*\+\s*req\.(params|body|query)/i;
  private PATTERN_CMD_TEMPLATE = /(exec|execSync|spawn)\s*\(`[^`]*\$\{req\./i;
  private PATTERN_CMD_CONCAT = /(exec|execSync)\s*\(['"][^'"]*['"]\s*\+\s*req\./i;

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const uniqueTargets = Array.from(new Set(fileMap.sourceFiles));
    
    this.logStart(uniqueTargets.length);
    const startTime = Date.now();
    const allFindings: RawFinding[] = [];

    for (const filePath of uniqueTargets) {
      try {
        const allowed = await invokeFileRead(filePath, token, this.agentId);
        if (!allowed) continue;

        const { content } = readFileSafe(filePath, fileMap.rootPath);

        // Only analyze files where req.body/params/query/headers exists
        if (!/req\.(body|params|query|headers)/.test(content)) {
          continue;
        }

        const relativePath = path.relative(fileMap.rootPath, filePath);
        const lines = content.split(/\r?\n/);

        // 1. Run static checks line by line
        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];
          const lineNum = i + 1;

          if (this.PATTERN_SQL_TEMPLATE.test(lineContent)) {
            allFindings.push({
              id: `static_inj_sql_tpl_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'SQL_INJECTION',
              file: relativePath,
              line: lineNum,
              title: 'SQL Injection via template literal interpolation',
              description: 'User request parameters are directly interpolated into a SQL query string using template literals.',
              impact: 'Attackers can manipulate the query structure to bypass authentication, read, modify, or delete database contents.',
              fix: 'Use parameterized queries or prepared statements instead of string interpolation.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "db.query('SELECT * FROM users WHERE id = ?', [req.params.id])",
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_SQL_CONCAT.test(lineContent)) {
            allFindings.push({
              id: `static_inj_sql_concat_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'SQL_INJECTION',
              file: relativePath,
              line: lineNum,
              title: 'SQL Injection via string concatenation',
              description: 'User request data is joined to a SQL query string via string concatenation.',
              impact: 'Attackers can inject malicious SQL commands and gain full access to the database.',
              fix: 'Use prepared statements with query parameters.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "db.query('SELECT * FROM users WHERE id = ?', [req.query.id])",
              agentId: this.agentId,
              confidence: 0.92,
            });
          }

          if (this.PATTERN_CMD_TEMPLATE.test(lineContent)) {
            allFindings.push({
              id: `static_inj_cmd_tpl_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'COMMAND_INJECTION',
              file: relativePath,
              line: lineNum,
              title: 'Command Injection via template literal execution',
              description: 'User input is directly injected into an OS command shell runner.',
              impact: 'Attackers can execute arbitrary command shell instructions on the server hosting the application.',
              fix: 'Avoid running shell commands dynamically. If required, sanitize inputs or use spawn with an arguments array.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "execFile('node', ['script.js', req.query.arg])",
              agentId: this.agentId,
              confidence: 0.97,
            });
          }

          if (this.PATTERN_CMD_CONCAT.test(lineContent)) {
            allFindings.push({
              id: `static_inj_cmd_concat_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'COMMAND_INJECTION',
              file: relativePath,
              line: lineNum,
              title: 'Command Injection via string concatenation',
              description: 'User input is concatenated into an OS shell execution string.',
              impact: 'Attackers can execute remote code on the host operating system.',
              fix: 'Use spawn or execFile with an array of arguments to prevent shell meta-character evaluation.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "spawn('ls', [req.query.dir])",
              agentId: this.agentId,
              confidence: 0.95,
            });
          }
        }

        // 2. Run HF Analysis
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, INJECTION_HUNTER_PROMPT);
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
