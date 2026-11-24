/**
 * Phase 10 — the manual (handbook) scope every other API call is bound to.
 *
 * The workbench keeps one editor per manual/branch. Instead of repointing a mutable
 * server-wide singleton, each request carries `x-dita-manual-id` / `x-dita-branch`, and
 * the API resolves (and caches) an isolated session from those headers.
 *
 * This module is the single client-side source of truth for those headers so that
 * `requestJson` and the streaming publish client can stay ignorant of routing.
 */
export interface ActiveScope {
  manualId: string | null;
  branch: string | null;
}

let activeScope: ActiveScope = { manualId: null, branch: null };

export function getActiveScope(): ActiveScope {
  return activeScope;
}

export function setActiveScope(scope: ActiveScope): void {
  activeScope = { manualId: scope.manualId ?? null, branch: scope.branch ?? null };
}

export function clearActiveScope(): void {
  activeScope = { manualId: null, branch: null };
}

/** Applies the current manual/branch onto an outgoing header bag. */
export function applyScopeHeaders(headers: Headers): Headers {
  if (activeScope.manualId) headers.set('x-dita-manual-id', activeScope.manualId);
  if (activeScope.branch) headers.set('x-dita-branch', activeScope.branch);
  return headers;
}
