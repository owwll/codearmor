import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as BUSINESS_LOGIC_PROMPT } from '../hf/prompts/business-logic.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class BusinessLogicAgent extends BaseAgent {
  name = 'Business Logic';
  agentId = 'business-logic';

  private PATTERN_PRICE_BODY = /price\s*[:=]\s*req\.body\.price/;
  private PATTERN_DEBIT = /(balance.*-=|deduct|withdraw)/i;

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

          if (this.PATTERN_PRICE_BODY.test(lineContent)) {
            allFindings.push({
              id: `static_biz_price_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'BUSINESS_LOGIC_BYPASS',
              file: relativePath,
              line: lineNum,
              title: 'Price accepted directly from client request body',
              description: 'Taking item prices directly from req.body.price instead of looking them up in the database allows clients to tamper with transaction costs.',
              impact: 'Attackers can modify requests to set item prices to 0 or negative values, bypassing payment requirements.',
              fix: 'Fetch the price of the item from your database based on its ID.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const item = await Product.findById(productId); const price = item.price;',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          // Quantity check
          if (lineContent.includes('req.body.quantity') && !lineContent.includes('Math.abs') && !content.includes('quantity > 0')) {
            allFindings.push({
              id: `static_biz_qty_${crypto.randomUUID()}`,
              severity: 'WARNING',
              category: 'BUSINESS_LOGIC_BYPASS',
              file: relativePath,
              line: lineNum,
              title: 'Quantity accepted without sign checks',
              description: 'Using req.body.quantity without verifying that the value is positive and non-zero can lead to business logic manipulation.',
              impact: 'Attackers can input negative quantities to deduct balance, obtain refunds, or corrupt inventory counts.',
              fix: 'Ensure the quantity is validated to be greater than zero.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const quantity = Math.max(1, parseInt(req.body.quantity, 10));',
              agentId: this.agentId,
              confidence: 0.80,
            });
          }

          // Transaction check
          if (this.PATTERN_DEBIT.test(lineContent)) {
            if (!/transaction|session\.start/i.test(content)) {
              allFindings.push({
                id: `static_biz_race_${crypto.randomUUID()}`,
                severity: 'WARNING',
                category: 'RACE_CONDITION',
                file: relativePath,
                line: lineNum,
                title: 'State modification without database transaction',
                description: 'A balance or inventory modification occurs without database transactions or locking mechanisms.',
                impact: 'Attackers can execute concurrent requests simultaneously to double-spend or withdraw more than their balance.',
                fix: 'Wrap the read-and-write operation inside a database transaction or apply row locks.',
                codeSnippet: lineContent.trim().substring(0, 150),
                fixSnippet: 'db.transaction(() => { ... })',
                agentId: this.agentId,
                confidence: 0.85,
              });
            }
          }
        }

        // 2. Run LLM check only on files matching /order|payment|cart|checkout|invoice|price|discount/i
        if (/order|payment|cart|checkout|invoice|price|discount/i.test(filePath)) {
          const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, BUSINESS_LOGIC_PROMPT);
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
