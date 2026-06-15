import { ValidatedFinding, ScanSummary } from '../types/finding.types';

// ============================================================
// Scoring weight configuration
// ============================================================

const CRITICAL_DEDUCTION = 15;
const WARNING_DEDUCTION = 5;
const INFO_DEDUCTION = 1;

const MAX_CRITICAL_DEDUCTION = 60;
const MAX_WARNING_DEDUCTION = 30;
const MAX_INFO_DEDUCTION = 10;

const BASE_SCORE = 100;
const MIN_SCORE = 0;

/**
 * Calculates an overall security score (0–100) based on validated findings.
 *
 * Scoring strategy:
 *   - Start at 100
 *   - CRITICAL: -15 each, capped at -60
 *   - WARNING:  -5  each, capped at -30
 *   - INFO:     -1  each, capped at -10
 *   - Floor: 0
 */
export function calculateScore(findings: ValidatedFinding[]): number {
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL':
        criticalCount++;
        break;
      case 'WARNING':
        warningCount++;
        break;
      case 'INFO':
        infoCount++;
        break;
    }
  }

  const criticalDeduction = Math.min(criticalCount * CRITICAL_DEDUCTION, MAX_CRITICAL_DEDUCTION);
  const warningDeduction = Math.min(warningCount * WARNING_DEDUCTION, MAX_WARNING_DEDUCTION);
  const infoDeduction = Math.min(infoCount * INFO_DEDUCTION, MAX_INFO_DEDUCTION);

  const rawScore = BASE_SCORE - criticalDeduction - warningDeduction - infoDeduction;
  return Math.max(MIN_SCORE, Math.round(rawScore));
}

/**
 * Builds a severity summary object from a list of validated findings.
 */
export function buildSummary(findings: ValidatedFinding[]): ScanSummary {
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL':
        critical++;
        break;
      case 'WARNING':
        warning++;
        break;
      case 'INFO':
        info++;
        break;
    }
  }

  return {
    critical,
    warning,
    info,
    total: findings.length,
  };
}
