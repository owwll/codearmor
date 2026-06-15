import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as DATA_FLOW_PROMPT } from '../hf/prompts/data-flow.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class DataFlowTracer extends BaseAgent {
  name = 'Data Flow Tracer';
  agentId = 'data-flow-tracer';

  private STATIC_PATTERNS = [
    {
      pattern: /console\.(log|info|debug)\s*\([^)]*req\.body/,
      category: 'DATA_IN_LOGS' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.95,
      title: 'Sensitive user input logged',
      description: 'Logging raw request body values (which often contain credentials or secrets) leaks sensitive data into logs.',
      impact: 'Attackers or unauthorized personnel with log access can retrieve user passwords and private tokens.',
      fix: 'Avoid logging raw request objects. Sanitize or cherry-pick fields to log.',
      fixSnippet: "logger.info('User action', { userId: req.user.id });",
    },
    {
      pattern: /console\.(log|info)\s*\([^)]*password/i,
      category: 'DATA_IN_LOGS' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.95,
      title: 'Plaintext password logged',
      description: 'The code logs variables containing passwords to the console.',
      impact: 'Sensitive user passwords can be exposed to server logs.',
      fix: 'Remove password logs entirely.',
      fixSnippet: '// console.log(password) removed',
    },
    {
      pattern: /res\.(json|send)\s*\([^)]*err\.(stack|message)/,
      category: 'VERBOSE_ERRORS' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.98,
      title: 'Verbose system error messages returned to user',
      description: 'Returning detailed error stack traces or raw error messages directly exposes internal backend details.',
      impact: 'Attackers can map out directory structures, frameworks, databases, and dependencies to find vulnerabilities.',
      fix: 'Return a generic error message and log the verbose details internally.',
      fixSnippet: "res.status(500).json({ error: 'Internal Server Error' });",
    },
    {
      pattern: /console\.(log|info)\s*\([^)]*token/i,
      category: 'DATA_IN_LOGS' as const,
      severity: 'WARNING' as const,
      confidence: 0.90,
      title: 'Security tokens logged',
      description: 'The application logs token variables to the console.',
      impact: 'Session or security tokens could be leaked in system logs.',
      fix: 'Remove token logs to keep authentication keys private.',
      fixSnippet: '// console.log(token) removed',
    },
  ];

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

          for (const sp of this.STATIC_PATTERNS) {
            if (sp.pattern.test(lineContent)) {
              allFindings.push({
                id: `static_data_${sp.category.toLowerCase()}_${crypto.randomUUID()}`,
                severity: sp.severity,
                category: sp.category,
                file: relativePath,
                line: lineNum,
                title: sp.title,
                description: sp.description,
                impact: sp.impact,
                fix: sp.fix,
                codeSnippet: lineContent.trim().substring(0, 150),
                fixSnippet: sp.fixSnippet,
                agentId: this.agentId,
                confidence: sp.confidence,
              });
            }
          }
        }

        // 2. Run LLM check for files with complex flow
        if (/res\.(json|send)\s*\([^)]*user\)|findOne\s*\(/i.test(content)) {
          const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, DATA_FLOW_PROMPT);
          allFindings.push(...hfFindings);
        }
      } catch (err) {
        logger.error(this.agentId, `Error scanning file: ${filePath}`, err);
      }
    }

    const deduplicated = this.deduplicateByLine(allFindings);
    this.logComplete(deduplicated.length, Date.now() - startTime);
    return deduplicated;
  }
}
