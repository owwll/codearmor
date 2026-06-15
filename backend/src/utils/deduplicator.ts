import { ValidatedFinding, FindingSeverity } from '../types/finding.types';

// ============================================================
// Severity ordering for sort (lower index = higher priority)
// ============================================================

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
};

/**
 * Deduplicates a list of ValidatedFindings using a composite key of
 * file + line + category.
 *
 * Strategy:
 *   1. Group by file + line + category.
 *   2. Within each group, keep the highest-confidence finding.
 *   3. Merge agentIds from all duplicates into the winning finding.
 *   4. Sort result: CRITICAL → WARNING → INFO, then confidence descending.
 */
export function deduplicateFindings(findings: ValidatedFinding[]): ValidatedFinding[] {
  // Map from composite key → best finding so far
  const grouped = new Map<string, ValidatedFinding & { agentIds: string[] }>();

  for (const finding of findings) {
    // Normalise the file path to ensure consistent grouping
    const normalizedFile = finding.file.replace(/\\/g, '/').toLowerCase();
    const key = `${normalizedFile}::${finding.line}::${finding.category}`;

    const existing = grouped.get(key);

    if (!existing) {
      // First occurrence for this key — seed the group
      grouped.set(key, {
        ...finding,
        agentIds: [finding.agentId],
      });
    } else {
      // Track every contributing agent
      if (!existing.agentIds.includes(finding.agentId)) {
        existing.agentIds.push(finding.agentId);
      }

      // Promote the higher-confidence finding as the canonical record
      if (finding.confidence > existing.confidence) {
        grouped.set(key, {
          ...finding,
          agentIds: existing.agentIds,
        });
      }
    }
  }

  // Build the final array, embedding the merged agentId list
  const deduped: ValidatedFinding[] = [];

  for (const [, entry] of grouped) {
    // If multiple agents contributed, reflect that in the agentId field
    // (comma-separated list so the type remains string)
    const { agentIds, ...rest } = entry;
    deduped.push({
      ...rest,
      agentId: agentIds.join(','),
    });
  }

  // Sort: severity order first, then confidence descending within each tier
  deduped.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });

  return deduped;
}
