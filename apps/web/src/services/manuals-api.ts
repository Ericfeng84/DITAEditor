/**
 * Phase 10 — manual (handbook) registry client.
 *
 * Every response here is scoped by the caller's identity only; the per-manual scope
 * headers are applied when an editor session is active (see `active-scope.ts`).
 */
import { requestJson } from './workspace-api.js';

export interface ManualStats {
  totalTopics: number;
  totalMaps: number;
}

export interface Manual {
  id: string;
  name: string;
  description: string;
  rootDir: string;
  defaultRootMap: string | null;
  isBuiltin: boolean;
  archived: boolean;
  /** False when the folder is missing on disk — the hub explains instead of crashing. */
  exists: boolean;
  currentBranch: string;
  stats: ManualStats;
  activeAssignmentCount: number;
  myActiveAssignmentCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface ManualListSnapshot {
  defaultRootDir: string;
  importsRootDir: string;
  manuals: Manual[];
  activeManualId: string | null;
}

export type ManualCreateMode = 'create' | 'import' | 'attach';

export interface ManualCreateInput {
  mode?: ManualCreateMode;
  name?: string;
  description?: string;
  rootDir?: string;
  parentDir?: string;
  scaffold?: 'blank' | 'starter';
  initGit?: boolean;
}

export interface ManualUpdateInput {
  name?: string;
  description?: string;
  defaultRootMap?: string | null;
  archived?: boolean;
}

export function fetchManuals(options: { includeArchived?: boolean; q?: string } = {}) {
  const params = new URLSearchParams();
  if (options.includeArchived) params.set('includeArchived', '1');
  const query = options.q?.trim();
  if (query) params.set('q', query);
  const suffix = params.toString();
  return requestJson<ManualListSnapshot>(`/api/manuals${suffix ? `?${suffix}` : ''}`);
}

export function fetchManual(id: string): Promise<{ manual: Manual }> {
  return requestJson<{ manual: Manual }>(`/api/manuals/${encodeURIComponent(id)}`);
}

export function createManual(input: ManualCreateInput): Promise<{ manual: Manual }> {
  return requestJson<{ manual: Manual }>('/api/manuals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateManual(id: string, patch: ManualUpdateInput): Promise<{ manual: Manual }> {
  return requestJson<{ manual: Manual }>(`/api/manuals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function touchManual(id: string): Promise<{ manual: Manual }> {
  return requestJson<{ manual: Manual }>(`/api/manuals/${encodeURIComponent(id)}/touch`, {
    method: 'POST',
  });
}

export function removeManual(id: string): Promise<{ removed: string; manuals: Manual[] }> {
  return requestJson<{ removed: string; manuals: Manual[] }>(
    `/api/manuals/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
