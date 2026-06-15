import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as CRYPTO_AUDITOR_PROMPT } from '../hf/prompts/crypto-auditor.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class CryptoAuditor extends BaseAgent {
  name = 'Crypto Auditor';
  agentId = 'crypto-auditor';

  private PATTERN_WEAK_CIPHER = /createCipheriv?\s*\(['"](des|rc4|blowfish|3des)/i;
  private PATTERN_ECB = /createCipheriv?\s*\(['"](aes-\d+-ecb)/i;
  private PATTERN_MATH_RANDOM = /Math\.random\(\)/;
  private PATTERN_HARDCODED_IV = /(?:iv|IV|nonce)\s*=\s*(?:Buffer\.from\s*\(['"](0{16,}|1{16,})['"]\)|['"][0-9a-f]{16,}['"])/;
  private PATTERN_PREDICTABLE = /(?:token|id)\s*=\s*Date\.now\(\)/;

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

          if (this.PATTERN_WEAK_CIPHER.test(lineContent)) {
            allFindings.push({
              id: `static_crypto_weak_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'WEAK_CIPHER',
              file: relativePath,
              line: lineNum,
              title: 'Use of weak or insecure cryptographic cipher',
              description: 'The application uses outdated ciphers like DES, RC4, Blowfish, or 3DES, which are vulnerable to cryptanalysis.',
              impact: 'Encrypted data can be decrypted or tampered with by adversaries.',
              fix: 'Use strong modern encryption standards such as AES-256-GCM.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "crypto.createCipheriv('aes-256-gcm', key, iv)",
              agentId: this.agentId,
              confidence: 0.98,
            });
          }

          if (this.PATTERN_ECB.test(lineContent)) {
            allFindings.push({
              id: `static_crypto_ecb_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'WEAK_CIPHER',
              file: relativePath,
              line: lineNum,
              title: 'Use of AES in insecure ECB mode',
              description: 'Electronic Codebook (ECB) mode encrypts identical plaintext blocks into identical ciphertext blocks, leaking patterns.',
              impact: 'Attackers can deduce structure and contents of the encrypted message without knowing the key.',
              fix: 'Switch to secure authenticated modes like GCM or CBC with a random IV.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "crypto.createCipheriv('aes-256-gcm', key, iv)",
              agentId: this.agentId,
              confidence: 0.98,
            });
          }

          if (this.PATTERN_MATH_RANDOM.test(lineContent)) {
            // Check if variable name looks security-critical
            if (/(token|session|secret|key|salt|password|otp)/i.test(lineContent)) {
              allFindings.push({
                id: `static_crypto_random_${crypto.randomUUID()}`,
                severity: 'WARNING',
                category: 'INSECURE_RANDOM',
                file: relativePath,
                line: lineNum,
                title: 'Math.random() used for security-sensitive operation',
                description: 'Math.random() is pseudo-random and not cryptographically secure, meaning its outputs can be predicted.',
                impact: 'Session tokens, reset tokens, or passwords generated via Math.random() can be predicted and hijacked.',
                fix: 'Use crypto.randomBytes() or crypto.randomUUID() for security-critical values.',
                codeSnippet: lineContent.trim().substring(0, 150),
                fixSnippet: "const token = crypto.randomBytes(32).toString('hex');",
                agentId: this.agentId,
                confidence: 0.85,
              });
            }
          }

          if (this.PATTERN_HARDCODED_IV.test(lineContent)) {
            allFindings.push({
              id: `static_crypto_iv_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'HARDCODED_IV',
              file: relativePath,
              line: lineNum,
              title: 'Insecure hardcoded or static initialization vector (IV)',
              description: 'The Initialization Vector (IV) is hardcoded or set to a static value. IVs must be unique and random per encryption run.',
              impact: 'Encryption becomes vulnerable to replay attacks and cryptographic pattern leakage.',
              fix: 'Generate a cryptographically secure random IV for every encryption operation.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const iv = crypto.randomBytes(16);',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_PREDICTABLE.test(lineContent)) {
            allFindings.push({
              id: `static_crypto_predictable_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'INSECURE_RANDOM',
              file: relativePath,
              line: lineNum,
              title: 'Predictable identifier generation',
              description: 'Generating tokens or IDs using Date.now() is predictable and easily guessable.',
              impact: 'Attackers can guess token values and hijack user accounts or sessions.',
              fix: 'Use cryptographically secure random values.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: "const token = crypto.randomBytes(32).toString('hex');",
              agentId: this.agentId,
              confidence: 0.85,
            });
          }
        }

        // 2. Run LLM check if file contains crypto keywords
        if (/crypto|cipher|encrypt|decrypt|hash|random|token|jwt/i.test(filePath)) {
          const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, CRYPTO_AUDITOR_PROMPT);
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
