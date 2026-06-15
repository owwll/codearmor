import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as FILE_SECURITY_PROMPT } from '../hf/prompts/file-security.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class FileSecurityAgent extends BaseAgent {
  name = 'File Security';
  agentId = 'file-security';

  private PATTERN_TRAVERSAL = /(?:readFile|readFileSync|createReadStream)\s*\([^)]*req\.(params|query|body)/;
  private PATTERN_JOIN = /path\.join\s*\(__dirname[^)]*req\.(params|query|body)/;
  private PATTERN_REQUIRE = /require\s*\(\s*req\.(params|query|body)/;

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
        const relativePath = path.relative(fileMap.rootPath, filePath);
        const lines = content.split(/\r?\n/);

        // 1. Run static checks line by line
        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];
          const lineNum = i + 1;

          if (this.PATTERN_TRAVERSAL.test(lineContent)) {
            allFindings.push({
              id: `static_file_traversal_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'PATH_TRAVERSAL',
              file: relativePath,
              line: lineNum,
              title: 'Path Traversal via unvalidated file read',
              description: 'User input is passed directly to file reading operations without validation.',
              impact: 'Attackers can read sensitive files outside the project directory (e.g. /etc/passwd or env files).',
              fix: 'Resolve paths and ensure they start with the project root directory, or sanitize inputs.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "if (!resolvedPath.startsWith(projectRoot)) throw new Error('Access denied');",
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_JOIN.test(lineContent)) {
            allFindings.push({
              id: `static_file_join_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'PATH_TRAVERSAL',
              file: relativePath,
              line: lineNum,
              title: 'Insecure path joining with user input',
              description: 'User input is joined to path.join without validation or path normalization.',
              impact: 'Attackers can bypass directory restrictions using relative paths (e.g. ../../).',
              fix: 'Normalize resolved paths and verify they reside inside the allowed directory scope.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const safePath = path.normalize(path.join(root, userInput));',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_REQUIRE.test(lineContent)) {
            allFindings.push({
              id: `static_file_require_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'INSECURE_FILE_PERMISSIONS',
              file: relativePath,
              line: lineNum,
              title: 'Arbitrary file require (Remote Code Execution)',
              description: 'The application dynamically imports/requires a file based on user input.',
              impact: 'Attackers can execute arbitrary JavaScript on the server by loading uploaded files or node modules.',
              fix: 'Use a hardcoded map of allowed modules or avoid dynamic imports completely.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "const modules = { user: require('./user') }; const mod = modules[req.query.module];",
              agentId: this.agentId,
              confidence: 0.98,
            });
          }
        }

        // 2. Run LLM check
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, FILE_SECURITY_PROMPT);
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
