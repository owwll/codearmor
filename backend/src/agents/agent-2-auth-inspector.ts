import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as AUTH_INSPECTOR_PROMPT } from '../hf/prompts/auth-inspector.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class AuthInspector extends BaseAgent {
  name = 'Auth Inspector';
  agentId = 'auth-inspector';

  private STATIC_PATTERNS = [
    {
      pattern: /jwt\.decode\(/,
      category: 'WEAK_JWT' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.99,
      title: 'jwt.decode() does not verify token signature',
      description: 'Using jwt.decode() instead of jwt.verify() means token signatures are never checked.',
      impact: 'Attackers can forge JWT tokens and log in as any user including admins.',
      fix: 'Replace jwt.decode(token) with jwt.verify(token, process.env.JWT_SECRET)',
      fixSnippet: 'const decoded = jwt.verify(token, process.env.JWT_SECRET);',
    },
    {
      pattern: /algorithm:\s*['"]none['"]/,
      category: 'WEAK_JWT' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.99,
      title: 'JWT algorithm set to none — no signature',
      description: 'Algorithm none means tokens have no cryptographic protection.',
      impact: 'Anyone can create a valid-looking token for any user.',
      fix: 'Remove algorithm: none and use HS256 with a strong secret.',
      fixSnippet: 'const token = jwt.sign(payload, secret, { algorithm: "HS256" });',
    },
    {
      pattern: /createHash\(['"]md5['"]\)/,
      category: 'INSECURE_PASSWORD_STORAGE' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.99,
      title: 'MD5 used for password hashing',
      description: 'MD5 is cryptographically broken and trivial to reverse.',
      impact: 'All passwords exposed in a database breach are crackable instantly.',
      fix: 'Use bcrypt.hash(password, 12) instead of MD5.',
      fixSnippet: 'const hash = await bcrypt.hash(password, 12);',
    },
    {
      pattern: /createHash\(['"]sha1['"]\)/,
      category: 'INSECURE_PASSWORD_STORAGE' as const,
      severity: 'CRITICAL' as const,
      confidence: 0.95,
      title: 'SHA1 used for password hashing',
      description: 'SHA1 is not designed for passwords and is fast enough to brute-force.',
      impact: 'Passwords can be cracked in minutes using GPU-based attacks.',
      fix: 'Use bcrypt.hash(password, 12) for password storage.',
      fixSnippet: 'const hash = await bcrypt.hash(password, 12);',
    },
  ];

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const targets = [...fileMap.authFiles, ...fileMap.modelFiles];
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

        // 1. Run static checks
        for (let i = 0; i < lines.length; i++) {
          const lineContent = lines[i];
          const lineNum = i + 1;

          for (const sp of this.STATIC_PATTERNS) {
            if (sp.pattern.test(lineContent)) {
              allFindings.push({
                id: `static_auth_${sp.category.toLowerCase()}_${crypto.randomUUID()}`,
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

        // 2. Run LLM check if the file seems related to auth
        if (this.looksLikeAuthFile(content)) {
          const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, AUTH_INSPECTOR_PROMPT);
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

  private looksLikeAuthFile(content: string): boolean {
    return /password|jwt|token|session|bcrypt|hash|auth/i.test(content);
  }
}
