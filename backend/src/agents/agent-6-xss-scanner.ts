import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as XSS_SCANNER_PROMPT } from '../hf/prompts/xss-scanner.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

export class XSSScanner extends BaseAgent {
  name = 'XSS Scanner';
  agentId = 'xss-scanner';

  private PATTERN_REFLECTED = /res\.(send|write)\s*\(`[^`]*\$\{req\.(params|body|query)/;
  private PATTERN_INNER_HTML = /\.innerHTML\s*=\s*(req\.|userInput|user_input|data\.)/;
  private PATTERN_DOC_WRITE = /document\.write\s*\([^)]*req\./;
  private PATTERN_EJS_UNESCAPED = /<%-(.*)(req\.|user\.)/;
  private PATTERN_DANGEROUS_REACT = /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*[^}]*req\./;

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const targets = [...fileMap.sourceFiles, ...fileMap.viewFiles];
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

          if (this.PATTERN_REFLECTED.test(lineContent)) {
            allFindings.push({
              id: `static_xss_reflected_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'XSS_REFLECTED',
              file: relativePath,
              line: lineNum,
              title: 'Reflected XSS in res.send()',
              description: 'Directly outputting raw user input from query/body/params into an HTML response creates a Reflected XSS risk.',
              impact: 'Attackers can execute malicious scripts in the victim browser by sending them a crafted link.',
              fix: 'Sanitize inputs using DOMPurify, or use res.json() or escapeHTML wrapper.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'res.send(escapeHTML(req.query.name))',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_INNER_HTML.test(lineContent)) {
            allFindings.push({
              id: `static_xss_innerhtml_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'XSS_DOM',
              file: relativePath,
              line: lineNum,
              title: 'DOM XSS via innerHTML assignment',
              description: 'Assigning user-controlled data directly to innerHTML is highly dangerous.',
              impact: 'Malicious JavaScript injected into the client context runs in the context of the user session.',
              fix: 'Use textContent or innerText instead of innerHTML, or sanitize content with DOMPurify.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'element.textContent = userInput;',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_DOC_WRITE.test(lineContent)) {
            allFindings.push({
              id: `static_xss_docwrite_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'XSS_DOM',
              file: relativePath,
              line: lineNum,
              title: 'DOM XSS via document.write()',
              description: 'Using document.write with unvalidated user request data can cause DOM-based XSS.',
              impact: 'Script injection in the user\'s browser.',
              fix: 'Use modern DOM manipulation APIs or textContent.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'element.appendChild(document.createTextNode(userInput));',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_EJS_UNESCAPED.test(lineContent)) {
            allFindings.push({
              id: `static_xss_ejs_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'UNSAFE_TEMPLATE',
              file: relativePath,
              line: lineNum,
              title: 'Unescaped EJS template output',
              description: 'Using <%- instead of <%= to output user request/session data renders unescaped HTML.',
              impact: 'Attackers can inject malicious scripts into EJS-rendered pages.',
              fix: 'Escape outputs by switching from <%- to <%= for any user-controlled values.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: '<%= user.name %>',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }

          if (this.PATTERN_DANGEROUS_REACT.test(lineContent)) {
            allFindings.push({
              id: `static_xss_react_${crypto.randomUUID()}`,
              severity: 'CRITICAL',
              category: 'XSS_DOM',
              file: relativePath,
              line: lineNum,
              title: 'Reflected/DOM XSS via dangerouslySetInnerHTML',
              description: 'Using dangerouslySetInnerHTML with user request data bypasses React\'s automatic escaping protection.',
              impact: 'Renders raw HTML/scripts from user input, causing cross-site scripting.',
              fix: 'Sanitize the HTML using a library like DOMPurify before rendering.',
              codeSnippet: lineContent.trim().substring(0, 150),
              fixSnippet: 'const cleanHtml = DOMPurify.sanitize(userInput);',
              agentId: this.agentId,
              confidence: 0.95,
            });
          }
        }

        // 2. Run HF Scan
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, XSS_SCANNER_PROMPT);
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
