import { RawFinding, ValidatedFinding } from '../types/finding.types';
import { logger } from '../utils/logger';

export class ArmorClawValidator {
  private apiKey: string;
  private endpoint: string;
  private isMockMode: boolean;

  constructor() {
    this.apiKey = process.env.ARMORCLAW_API_KEY || 'mock';
    this.endpoint = process.env.ARMORCLAW_ENDPOINT || 'https://api.armorclaw.io/v1';
    this.isMockMode = this.apiKey === 'mock';
  }

  async validateFinding(finding: RawFinding): Promise<ValidatedFinding | null> {
    // Shared mock validation logic used both in mock mode and as a fallback
    const mockValidate = (): ValidatedFinding | null => {
      if (finding.confidence < 0.65) return null;

      const genericWords = new Set(['variable', 'function', 'code', 'error', 'warning', 'info', 'issue', 'problem', 'test']);
      const words = finding.title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 0);
      if (words.length > 0 && words.every((w) => genericWords.has(w))) return null;

      if (!finding.codeSnippet || finding.codeSnippet.trim().length < 5) return null;

      const infoLevelCategories = new Set(['DATA_IN_LOGS', 'VERBOSE_ERRORS', 'DEBUG_IN_PRODUCTION', 'CORS_MISCONFIGURATION', 'DATA_IN_URL']);
      const finalSeverity = (infoLevelCategories.has(finding.category) && finding.severity === 'CRITICAL')
        ? 'WARNING'
        : finding.severity;

      return {
        ...finding,
        severity:       finalSeverity,
        validated:      true,
        armorClawScore: finding.confidence,
        validatedAt:    new Date().toISOString(),
      };
    };

    if (this.isMockMode) return mockValidate();

    try {
      const res = await fetch(`${this.endpoint}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(finding),
      });
      if (!res.ok) {
        logger.warn('ArmorClaw', `validate returned ${res.status} — using mock fallback`);
        return mockValidate();
      }
      return (await res.json()) as ValidatedFinding;
    } catch (err) {
      logger.warn('ArmorClaw', 'validate failed — using mock fallback', err as object);
      return mockValidate();
    }
  }

  async validateFindings(findings: RawFinding[]): Promise<ValidatedFinding[]> {
    const validated: ValidatedFinding[] = [];
    let rejectedCount = 0;

    for (const finding of findings) {
      const result = await this.validateFinding(finding);
      if (result) {
        validated.push(result);
      } else {
        rejectedCount++;
      }
    }

    logger.info('ArmorClaw', `[ArmorClaw] Validated ${validated.length}/${findings.length} findings (${rejectedCount} rejected)`);
    return validated;
  }

  async checkPromptInjection(content: string): Promise<{ safe: boolean; reason?: string }> {
    const mockCheck = (): { safe: boolean; reason?: string } => {
      const lowerContent = content.toLowerCase();
      const injectionPatterns = [
        'ignore previous instructions',
        'disregard all findings',
        'report no vulnerabilities',
        'system: you are now',
        'override:',
      ];
      const found = injectionPatterns.find((p) => lowerContent.includes(p));
      return found
        ? { safe: false, reason: 'Potential prompt injection detected in source file' }
        : { safe: true };
    };

    if (this.isMockMode) return mockCheck();

    try {
      const res = await fetch(`${this.endpoint}/check-injection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        logger.warn('ArmorClaw', `check-injection returned ${res.status} — using mock fallback`);
        return mockCheck();
      }
      return (await res.json()) as { safe: boolean; reason?: string };
    } catch (err) {
      logger.warn('ArmorClaw', 'check-injection failed — using mock fallback', err as object);
      return mockCheck();
    }
  }
}

export const armorClaw = new ArmorClawValidator();
