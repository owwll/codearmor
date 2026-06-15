import * as path from 'path';
import * as crypto from 'crypto';
import { BaseAgent } from './base-agent';
import { FileMap, DelegationToken } from '../types/agent.types';
import { RawFinding } from '../types/finding.types';
import { PROMPT as CONFIG_AUDITOR_PROMPT } from '../hf/prompts/config-auditor.prompt';
import { readFileSafe } from '../utils/file-reader';
import { invokeFileRead } from '../armoriq/invoke';
import { logger } from '../utils/logger';

interface VulnerablePackage {
  name: string;
  maxVersion: string;
  cve: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  fix: string;
}

export class ConfigAuditor extends BaseAgent {
  name = 'Config Auditor';
  agentId = 'config-auditor';

  private VULNERABLE_PACKAGES: VulnerablePackage[] = [
    { name: 'lodash', maxVersion: '4.17.21', cve: 'CVE-2021-23337', severity: 'WARNING', description: 'Command injection via template in lodash.', fix: 'Upgrade lodash to >= 4.17.21' },
    { name: 'express', maxVersion: '4.19.0', cve: 'CVE-2024-29041', severity: 'WARNING', description: 'Open redirect vulnerability in express.', fix: 'Upgrade express to >= 4.19.0' },
    { name: 'jsonwebtoken', maxVersion: '9.0.0', cve: 'CVE-2022-23529', severity: 'WARNING', description: 'Secret key not validated in jsonwebtoken.', fix: 'Upgrade jsonwebtoken to >= 9.0.0' },
    { name: 'axios', maxVersion: '0.21.2', cve: 'CVE-2021-3749', severity: 'WARNING', description: 'SSRF via redirects in axios.', fix: 'Upgrade axios to >= 0.21.2' },
    { name: 'minimist', maxVersion: '1.2.6', cve: 'CVE-2021-44906', severity: 'CRITICAL', description: 'Prototype pollution in minimist.', fix: 'Upgrade minimist to >= 1.2.6' },
    { name: 'qs', maxVersion: '6.7.3', cve: 'CVE-2022-24999', severity: 'WARNING', description: 'Prototype pollution in qs.', fix: 'Upgrade qs to >= 6.7.3' },
    { name: 'multer', maxVersion: '1.4.4', cve: 'CVE-2022-24434', severity: 'WARNING', description: 'Directory traversal in multer.', fix: 'Upgrade multer to >= 1.4.4' },
    { name: 'mongoose', maxVersion: '5.13.15', cve: 'CVE-2022-24302', severity: 'WARNING', description: 'Prototype pollution in mongoose.', fix: 'Upgrade mongoose to >= 5.13.15' },
    { name: 'sequelize', maxVersion: '6.6.5', cve: 'CVE-2023-22578', severity: 'CRITICAL', description: 'SQL injection in sequelize.', fix: 'Upgrade sequelize to >= 6.6.5' },
    { name: 'passport', maxVersion: '0.6.0', cve: 'CVE-2022-25896', severity: 'WARNING', description: 'Session fixation in passport.', fix: 'Upgrade passport to >= 0.6.0' }
  ];

  private semverLt(version1: string, version2: string): boolean {
    const clean = (v: string) => v.replace(/^[\^~]/, '').split('-')[0].split('.');
    const parts1 = clean(version1).map(Number);
    const parts2 = clean(version2).map(Number);

    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return true;
      if (p1 > p2) return false;
    }
    return false;
  }

  async run(fileMap: FileMap, token: DelegationToken): Promise<RawFinding[]> {
    const uniqueConfigs = Array.from(new Set(fileMap.configFiles));
    
    // We count package.json as 1, plus config files
    const totalFiles = (fileMap.packageJson ? 1 : 0) + uniqueConfigs.length;
    this.logStart(totalFiles);
    const startTime = Date.now();
    const allFindings: RawFinding[] = [];

    // 1. Dependency Audit (package.json)
    if (fileMap.packageJson) {
      try {
        const allowed = await invokeFileRead(fileMap.packageJson, token, this.agentId);
        if (allowed) {
          const { content } = readFileSafe(fileMap.packageJson, fileMap.rootPath);
          const pkg = JSON.parse(content);
          const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
          const relativePath = path.relative(fileMap.rootPath, fileMap.packageJson);

          for (const vuln of this.VULNERABLE_PACKAGES) {
            const version = dependencies[vuln.name];
            if (version && this.semverLt(version, vuln.maxVersion)) {
              allFindings.push({
                id: `static_dep_${vuln.name}_${crypto.randomUUID()}`,
                severity: vuln.severity,
                category: 'VULNERABLE_DEPENDENCY',
                file: relativePath,
                line: 1, // point to package.json start
                title: `Vulnerable dependency: ${vuln.name} (${vuln.cve})`,
                description: `${vuln.description} Found installed version ${version} which is less than the fixed threshold of ${vuln.maxVersion}.`,
                impact: `Attackers can exploit this known dependency vulnerability to target the application.`,
                fix: vuln.fix,
                codeSnippet: `"${vuln.name}": "${version}"`,
                fixSnippet: `"${vuln.name}": "^${vuln.maxVersion}"`,
                agentId: this.agentId,
                confidence: 0.99
              });
            }
          }
        }
      } catch (err) {
        logger.error(this.agentId, 'Failed to perform dependency audit on package.json', err);
      }
    }

    // 2. HF Config Auditing
    for (const filePath of uniqueConfigs) {
      // Avoid re-scanning package.json with HF, since it's checked statically
      if (filePath === fileMap.packageJson) {
        continue;
      }

      try {
        const hfFindings = await this.analyzeFile(filePath, fileMap.rootPath, token, CONFIG_AUDITOR_PROMPT);
        allFindings.push(...hfFindings);
      } catch (err) {
        logger.error(this.agentId, `Error auditing config file: ${filePath}`, err);
      }
    }

    const deduplicated = this.deduplicateByLine(allFindings);
    this.logComplete(deduplicated.length, Date.now() - startTime);
    return deduplicated;
  }
}
