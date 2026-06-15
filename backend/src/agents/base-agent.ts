import * as path from 'path';
import * as crypto from 'crypto';
import { AgentConfig, FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { logger } from '../utils/logger';
import { readFileSafe, chunkContent } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { armorClaw } from '../armorclaw/validator';
import { hfClient } from '../hf/hf-client';

export abstract class BaseAgent {
  abstract name: string;
  abstract agentId: string;

  protected config: AgentConfig = {
    model: process.env.HF_PRIMARY_MODEL || 'Qwen/Qwen3-Coder-Next:novita',
    maxTokens: 2048,
    temperature: 0.1,
    timeoutMs: 15000,
    minConfidence: 0.65,
    maxFindingsPerFile: 10,
  };

  abstract run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]>;

  protected async analyzeFile(filePath: string, rootPath: string, token: DelegationToken, prompt: string): Promise<RawFinding[]> {
    try {
      // 1. Call invokeFileRead — if denied, return []
      const allowed = await invokeFileRead(filePath, token, this.agentId);
      if (!allowed) {
        return [];
      }

      // 2. Call readFileSafe — if fails, log error, return []
      let fileData;
      try {
        fileData = readFileSafe(filePath, rootPath);
      } catch (err) {
        logger.error(this.agentId, `Failed to read file: ${filePath}`, err);
        return [];
      }
      const { content } = fileData;

      // 3. Call armorClaw.checkPromptInjection — if unsafe, log warning, return []
      const safety = await armorClaw.checkPromptInjection(content);
      if (!safety.safe) {
        logger.warn(this.agentId, `Prompt injection check failed for ${filePath}: ${safety.reason}`);
        return [];
      }

      let rawFindings: RawFinding[] = [];
      const chunked = chunkContent(content);

      // 4. If file is chunked (isChunked=true): call HFClient.analyzeChunked(), else: call HFClient.analyze
      if (chunked.isChunked) {
        rawFindings = await hfClient.analyzeChunked(prompt, chunked.chunks, filePath, this.agentId, content);
      } else {
        // 5. Else: call HFClient.analyze
        const findings = await hfClient.analyze(prompt, content, filePath, this.agentId);
        rawFindings.push(...findings);
      }

      const relativeFile = path.relative(rootPath, filePath);

      // 6. Filter findings by confidence >= this.config.minConfidence
      // 7. Add agentId and relative file path to each finding
      const processed = rawFindings
        .filter((f) => f.confidence >= this.config.minConfidence)
        .map((f) => ({
          ...f,
          file: relativeFile,
          agentId: this.agentId,
        }));

      // 8. Cap at maxFindingsPerFile (keep highest confidence ones)
      processed.sort((a, b) => b.confidence - a.confidence);
      const capped = processed.slice(0, this.config.maxFindingsPerFile);

      return capped;
    } catch (err) {
      logger.warn(this.agentId, `Uncaught error in analyzeFile for ${filePath}`, { error: String(err) });
      return [];
    }
  }

  protected parseHFResponse(raw: string, filePath: string): RawFinding[] {
    try {
      let clean = raw.trim();
      if (clean.startsWith('```json')) {
        clean = clean.substring(7);
      } else if (clean.startsWith('```')) {
        clean = clean.substring(3);
      }
      if (clean.endsWith('```')) {
        clean = clean.substring(0, clean.length - 3);
      }
      clean = clean.trim();

      const parsed = JSON.parse(clean);
      if (!parsed || !Array.isArray(parsed.findings)) {
        return [];
      }

      const validSeverities = new Set(['CRITICAL', 'WARNING', 'INFO']);
      const validFindings: RawFinding[] = [];

      for (const f of parsed.findings) {
        if (f && typeof f === 'object') {
          const severity = String(f.severity).toUpperCase();
          if (validSeverities.has(severity)) {
            validFindings.push({
              id: f.id || crypto.randomUUID(),
              severity: severity as any,
              category: f.category || 'OPEN_ENDPOINT',
              file: filePath,
              line: typeof f.line === 'number' ? f.line : 0,
              title: f.title || 'Security Finding',
              description: f.description || '',
              impact: f.impact || '',
              fix: f.fix || '',
              codeSnippet: f.codeSnippet || '',
              fixSnippet: f.fixSnippet || '',
              agentId: this.agentId,
              confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
            });
          }
        }
      }
      return validFindings;
    } catch (err) {
      return [];
    }
  }

  protected deduplicateByLine(findings: RawFinding[]): RawFinding[] {
    const grouped: Record<string, RawFinding> = {};
    for (const f of findings) {
      const key = `${f.file}:${f.line}`;
      if (!grouped[key] || grouped[key].confidence < f.confidence) {
        grouped[key] = f;
      }
    }
    return Object.values(grouped);
  }

  protected looksLikeSourceFile(content: string): boolean {
    const keywords = ['function', 'const', 'let', 'var', 'import', 'require', 'class', 'def', 'async'];
    return keywords.some((kw) => content.includes(kw));
  }

  protected logStart(fileCount: number): void {
    logger.info(this.agentId, `Starting analysis`, { files: fileCount });
  }

  protected logComplete(findingCount: number, durationMs: number): void {
    logger.info(this.agentId, `Analysis complete`, { findings: findingCount, durationMs });
  }
}
