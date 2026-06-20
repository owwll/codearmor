import { logger } from '../utils/logger';
import { RawFinding } from '../types/finding.types';

export class HFClient {
  private primaryModel: string;
  private fallbackModel: string;
  private lastCallTimes: Map<string, number> = new Map();
  private timeoutMs: number;
  private creditsExhausted = false;

  constructor() {
    this.primaryModel = process.env.HF_PRIMARY_MODEL || 'Qwen/Qwen3-Coder-Next:novita';
    this.fallbackModel = process.env.HF_FALLBACK_MODEL || 'Qwen/Qwen3-Coder-Next:novita';
    this.timeoutMs = parseInt(process.env.HF_REQUEST_TIMEOUT_MS || '15000', 10);
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async enforceRateLimit(model: string): Promise<void> {
    const lastCall = this.lastCallTimes.get(model) || 0;
    const now = Date.now();
    const elapsed = now - lastCall;
    if (elapsed < 500) {
      const delay = 500 - elapsed;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.lastCallTimes.set(model, Date.now());
  }

  private cleanResponseJson(text: string): string {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('```')) {
      clean = clean.substring(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.substring(0, clean.length - 3);
    }
    return clean.trim();
  }

  async analyze(systemPrompt: string, codeContent: string, filename: string, agentId: string): Promise<RawFinding[]> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `CODE TO ANALYZE (file: ${filename}):\n\`\`\`\n${codeContent}\n\`\`\`` }
    ];
    const tokens = this.estimateTokens(JSON.stringify(messages));
    
    logger.info('HFClient', `agent=${agentId} file=${filename} tokens_estimated=${tokens}`);

    if (this.creditsExhausted) {
      logger.warn('HFClient', `Skipping LLM analysis for ${filename} — HF credits exhausted`);
      return [];
    }

    try {
      return await this.callModelWithRetry(messages, this.primaryModel, agentId);
    } catch (err) {
      logger.warn('HFClient', `Failed with primary model, retrying with fallback model: ${this.fallbackModel}`, { error: String(err) });
      try {
        return await this.callModelWithRetry(messages, this.fallbackModel, agentId);
      } catch (fallbackErr) {
        logger.error('HFClient', `Both primary and fallback models failed for agent=${agentId} file=${filename}`, fallbackErr);
        return [];
      }
    }
  }

  private async callModelWithRetry(messages: any[], model: string, agentId: string): Promise<RawFinding[]> {
    await this.enforceRateLimit(model);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const apiKey = process.env.HF_API_KEY || process.env.HF_TOKEN || '';

    try {
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.1,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 402) {
          this.creditsExhausted = true;
          logger.error('HFClient', `CREDITS EXHAUSTED: HuggingFace inference credits depleted. Add credits at https://huggingface.co/settings/billing or set HF_PRIMARY_MODEL to a free model.`);
          throw new Error(`HF Router API HTTP 402: Credits exhausted`);
        }
        throw new Error(`HF Router API HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json() as any;
      const generatedText = responseData.choices?.[0]?.message?.content;
      if (!generatedText) {
        throw new Error('HF Router API returned empty response / choices');
      }

      const cleanText = this.cleanResponseJson(generatedText);
      
      try {
        const parsed = JSON.parse(cleanText);
        if (parsed && Array.isArray(parsed.findings)) {
          return parsed.findings.map((finding: any, idx: number) => ({
            id: finding.id || `finding_${agentId}_${Date.now()}_${idx}`,
            severity: finding.severity || 'INFO',
            category: finding.category || 'OPEN_ENDPOINT',
            file: finding.file || 'unknown',
            line: typeof finding.line === 'number' ? finding.line : 0,
            title: finding.title || 'Security Finding',
            description: finding.description || '',
            impact: finding.impact || '',
            fix: finding.fix || '',
            codeSnippet: finding.codeSnippet || '',
            fixSnippet: finding.fixSnippet || '',
            agentId: agentId,
            confidence: typeof finding.confidence === 'number' ? finding.confidence : 0.5,
          }));
        }
        logger.warn('HFClient', 'Response JSON did not match expected schema', { text: cleanText });
        return [];
      } catch (parseErr) {
        logger.warn('HFClient', 'Failed to parse JSON response from LLM', { text: cleanText, error: String(parseErr) });
        return [];
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async analyzeChunked(
    systemPrompt: string,
    chunks: string[],
    filename: string,
    agentId: string,
    fullContent?: string
  ): Promise<RawFinding[]> {
    const allFindings: RawFinding[] = [];

    let content = fullContent;
    if (!content) {
      try {
        const fs = require('fs');
        if (fs.existsSync(filename)) {
          content = fs.readFileSync(filename, 'utf8');
        }
      } catch (err) {
        logger.warn('HFClient', `Could not read full content for ${filename}`, { error: String(err) });
      }
    }

    let lastIndex = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      let chunkStartLine = 0;
      if (content) {
        let chunkStartIndex = content.indexOf(chunk, lastIndex);
        if (chunkStartIndex === -1) {
          chunkStartIndex = content.indexOf(chunk);
        }
        if (chunkStartIndex !== -1) {
          lastIndex = chunkStartIndex;
          const prefix = content.substring(0, chunkStartIndex);
          for (let j = 0; j < prefix.length; j++) {
            if (prefix[j] === '\n') {
              chunkStartLine++;
            }
          }
        } else {
          const estimatedIndex = i * 2000;
          const prefix = content.substring(0, Math.min(estimatedIndex, content.length));
          for (let j = 0; j < prefix.length; j++) {
            if (prefix[j] === '\n') {
              chunkStartLine++;
            }
          }
        }
      }

      const chunkPrompt = `${systemPrompt}\n\n[Analyzing Chunk ${i + 1}/${chunks.length}]`;
      const findings = await this.analyze(chunkPrompt, chunk, filename, agentId);

      for (const finding of findings) {
        finding.line += chunkStartLine;
        allFindings.push(finding);
      }
    }

    const grouped = new Map<string, RawFinding>();
    for (const finding of allFindings) {
      const normalizedFile = finding.file.replace(/\\/g, '/').toLowerCase();
      const key = `${normalizedFile}::${finding.line}::${finding.category}`;
      const existing = grouped.get(key);
      if (!existing || finding.confidence > existing.confidence) {
        grouped.set(key, finding);
      }
    }

    return Array.from(grouped.values());
  }

  async testConnection(): Promise<boolean> {
    try {
      const apiKey = process.env.HF_API_KEY || process.env.HF_TOKEN || '';
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.primaryModel,
          messages: [{ role: 'user', content: 'Respond with "OK"' }],
          max_tokens: 10,
        }),
      });
      return response.ok;
    } catch (err) {
      logger.error('HFClient', 'Test connection failed', err);
      return false;
    }
  }
}

export const hfClient = new HFClient();
