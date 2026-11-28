import type { PublishDiagnostic } from './publish-api.js';
import type { WorkspaceDiagnostic } from './workspace-api.js';

/**
 * Phase 16: the Problems panel is the single home for *every* diagnostic the workbench knows
 * about. Semantic diagnostics arrive from the TS indexer (`WorkspaceDiagnostic`), while
 * DITA-OT strict validation returns `PublishDiagnostic` rows from `usePublishStore`.
 *
 * Rather than teaching the panel about two shapes, normalize them into one supertype here —
 * a pure module so the merge rules stay testable without React or a store.
 */
export type ProblemDiagnosticSource = WorkspaceDiagnostic['source'] | 'dita-ot';

export interface ProblemDiagnostic extends Omit<WorkspaceDiagnostic, 'source'> {
  source: ProblemDiagnosticSource;
  code?: string;
}

/** De-duplication key: same file/position/code/message means the same DITA-OT finding. */
function strictDiagnosticKey(diag: PublishDiagnostic): string {
  return `${diag.filePath}:${diag.line}:${diag.column}:${diag.code ?? ''}:${diag.message}`;
}

/**
 * Convert DITA-OT strict validation diagnostics into Problems-panel rows.
 *
 * Deterministic: order is preserved and only byte-identical findings (same file, position,
 * code and message) collapse, so a repeated DITA-OT run cannot duplicate the list.
 */
export function strictDiagnosticsToProblems(
  diagnostics: readonly PublishDiagnostic[] | undefined | null,
): ProblemDiagnostic[] {
  if (!diagnostics || diagnostics.length === 0) return [];
  const seen = new Set<string>();
  const out: ProblemDiagnostic[] = [];
  diagnostics.forEach((diag, index) => {
    const key = strictDiagnosticKey(diag);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `dita-ot:${diag.id || index}`,
      filePath: diag.filePath,
      line: diag.line,
      column: diag.column,
      severity: diag.severity,
      source: 'dita-ot',
      message: diag.message,
      ...(diag.code ? { code: diag.code } : {}),
    });
  });
  return out;
}

/**
 * Merge semantic diagnostics with DITA-OT strict diagnostics. Semantic rows keep their position
 * and identity; strict rows are appended so nothing from the strict run is ever dropped.
 */
export function mergeProblemDiagnostics(
  semanticDiagnostics: readonly WorkspaceDiagnostic[],
  strictDiagnostics: readonly PublishDiagnostic[] | undefined | null,
): ProblemDiagnostic[] {
  const merged: ProblemDiagnostic[] = semanticDiagnostics.map((diag) => ({ ...diag }));
  merged.push(...strictDiagnosticsToProblems(strictDiagnostics));
  return merged;
}
