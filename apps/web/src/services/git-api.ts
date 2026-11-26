import type { Assignment } from './assignments-api.js';
import type { IdentityResponse } from './identity-api.js';
import { requestJson, type WorkspaceSnapshot } from './workspace-api.js';

export interface GitFileChange {
  path: string;
  originalPath?: string;
  index: string;
  workingTree: string;
  staged: boolean;
  untracked: boolean;
  deleted: boolean;
  renamed: boolean;
  label: string;
}

export interface GitStatusSummary {
  initialized: boolean;
  hasCommits: boolean;
  rootDir: string;
  branch: string;
  primaryBranch: string;
  ahead: number;
  behind: number;
  isClean: boolean;
  dirtyFiles: GitFileChange[];
  lastCommit: GitCommitInfo | null;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

export interface GitFileDiff {
  path: string;
  from: string;
  to: string | null;
  fromLabel: string;
  toLabel: string;
  oldText: string;
  newText: string;
  additions: number;
  deletions: number;
  binary: boolean;
  oldExists: boolean;
  newExists: boolean;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  primary: boolean;
  worktreePath?: string;
}

export interface FileLock {
  id: string;
  projectId: string;
  branch: string;
  filePath: string;
  userId: string;
  userName: string;
  userColor: string;
  userRole: string;
  lockedAt: string;
  updatedAt: string;
  expired: boolean;
}

export interface LockListResponse {
  locks: FileLock[];
  branch: string;
  projectId: string;
  workDir: string;
  projectRootDir: string;
  /** Phase 13: the caller's own personal drafts (never another writer's). */
  drafts?: DraftView[];
}

/**
 * Phase 13 personal draft overlay row.
 *
 * A draft is one user's uncommitted change: the shared work dir stays clean at `HEAD`, so
 * "dirty" for a writer means exactly this list.
 */
export interface DraftView {
  id: string;
  filePath: string;
  op: 'edit' | 'create' | 'delete' | 'rename';
  originalPath: string | null;
  contentHash: string | null;
  isBinary: boolean;
  /** `HEAD` the draft was created against (null when unknown). */
  baseCommit?: string | null;
  updatedAt: string;
}

export interface GitStatusResponse extends GitStatusSummary {
  workDir: string;
  projectRootDir: string;
  projectId: string;
  locks: FileLock[];
  /** Phase 13: the caller's drafts — this is what "dirty" means now. */
  userDrafts?: DraftView[];
  /** Phase 13: uncommitted on-disk edits made by desktop editors / external tools. */
  externalDirtyFiles?: GitFileChange[];
  externalDirtyCount?: number;
}

export interface GitBranchesResponse {
  initialized: boolean;
  branch: string;
  primaryBranch: string;
  branches: GitBranchInfo[];
  /** Phase 13: branches an admin protects against deletion / non-admin merges. */
  protectedBranches?: string[];
}

/** Phase 13 annotated or lightweight tag (an immutable publish snapshot). */
export interface GitTagInfo {
  name: string;
  commitHash: string;
  shortHash: string;
  message: string;
  taggerName: string;
  date: string;
}

/** Phase 13 append-only audit row for every baseline mutation. */
export type VersionAuditAction =
  | 'checkout'
  | 'release'
  | 'handoff'
  | 'cancel'
  | 'force_unlock'
  | 'checkin'
  | 'branch_create'
  | 'branch_delete'
  | 'tag_create'
  | 'tag_delete'
  | 'merge'
  | 'restore'
  | 'revert'
  | 'publish';

export interface VersionAuditLogView {
  id: string;
  projectId: string;
  branch: string;
  actorId: string;
  actorName: string;
  actorColor: string;
  action: VersionAuditAction;
  targetPath: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/** Phase 13 safe-merge preflight (never touches a worktree). */
export interface MergeConflictPreview {
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
}

export interface MergePreview {
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string;
  targetCommit: string;
  baseCommit: string | null;
  ahead: number;
  behind: number;
  canFastForward: boolean;
  hasConflicts: boolean;
  conflicts: MergeConflictPreview[];
  blockingLocks: FileLock[];
  protectedTarget: boolean;
  alreadyUpToDate: boolean;
}

export interface MergeConflictContent {
  path: string;
  sourceBranch: string;
  targetBranch: string;
  baseCommit: string | null;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  isXml: boolean;
}

export interface MergeResult {
  commit: string;
  sourceBranch: string;
  targetBranch: string;
  changedFiles: string[];
  resolvedFiles: string[];
}

export interface RestoreFileInput {
  path: string;
  revision: string;
  /** `draft` (default) stages the old content in my overlay; `commit` rewrites the baseline. */
  mode?: 'draft' | 'commit';
  message?: string;
}

/** Phase 13 restore result: the API never mints a lock / ghost draft for a no-op restore. */
export interface RestoreFileResponse {
  path?: string;
  revision?: string;
  mode?: 'draft' | 'commit';
  status?: GitStatusResponse;
  /** The requested revision already matches what this user reads — nothing was restored. */
  unchanged?: boolean;
  /** Restoring `HEAD` content deleted the caller's now-redundant personal draft. */
  clearedDraft?: boolean;
  contentHash?: string;
}

/** Phase 13 revert result: `changedFiles` drives which open buffers must be re-read. */
export interface RevertCommitResponse {
  commit: GitCommitInfo | string;
  /** Paths the new revert commit actually changed (absent on older API responses). */
  changedFiles?: string[];
  status?: GitStatusResponse;
}

export interface GitSwitchBranchResponse {
  branch: string;
  workDir: string;
  projectRootDir: string;
  snapshot: WorkspaceSnapshot;
  status: GitStatusSummary;
  locks: FileLock[];
}

export interface LockOperationResponse extends LockListResponse {
  lock?: FileLock;
  autoLocked?: boolean;
}

export interface CheckinOptions {
  /** Phase 10: complete every one of my active assignments whose topic is being checked in. */
  completeMyAssignments?: boolean;
  /** Restrict completion to these assignment ids (from the check-in dialog). */
  completeAssignmentIds?: string[];
}

export interface CheckinResponse {
  commit: GitCommitInfo;
  branch: string;
  projectId: string;
  releasedPaths: string[];
  locks: FileLock[];
  status: GitStatusSummary;
  workDir: string;
  projectRootDir: string;
  /** Assignments the server moved to `done` as part of this check-in. */
  completedAssignments?: Assignment[];
}

export interface ForceUnlockResponse extends LockListResponse {
  released: FileLock;
  backup: {
    id: string;
    filePath: string;
    ownerUserId: string;
    hasContent: boolean;
    patchPreview: string;
  };
}

export function fetchIdentity(): Promise<IdentityResponse> {
  return requestJson<IdentityResponse>('/api/identity');
}

export function fetchLocks(): Promise<LockListResponse> {
  return requestJson<LockListResponse>('/api/locks');
}

export function checkoutFile(path: string): Promise<LockOperationResponse> {
  return requestJson<LockOperationResponse>('/api/locks/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export function releaseLock(path: string): Promise<LockOperationResponse> {
  return requestJson<LockOperationResponse>('/api/locks/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export function cancelCheckout(path: string): Promise<LockOperationResponse> {
  return requestJson<LockOperationResponse>('/api/locks/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export function checkinFiles(
  paths: string[],
  message: string,
  options: CheckinOptions = {},
): Promise<CheckinResponse> {
  return requestJson<CheckinResponse>('/api/locks/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paths,
      message,
      completeMyAssignments: options.completeMyAssignments,
      completeAssignmentIds: options.completeAssignmentIds,
    }),
  });
}

export function forceUnlockFile(path: string, reason?: string): Promise<ForceUnlockResponse> {
  return requestJson<ForceUnlockResponse>('/api/locks/force-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, reason }),
  });
}

export function fetchGitStatus(): Promise<GitStatusResponse> {
  return requestJson<GitStatusResponse>('/api/git/status');
}

export function initGitRepository(): Promise<{ created: boolean; status: GitStatusSummary }> {
  return requestJson<{ created: boolean; status: GitStatusSummary }>('/api/git/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

export function fetchBranches(): Promise<GitBranchesResponse> {
  return requestJson<GitBranchesResponse>('/api/git/branches');
}

export function createGitBranch(
  name: string,
  baseBranch?: string | null,
): Promise<{ created: string; branches: GitBranchInfo[] }> {
  return requestJson<{ created: string; branches: GitBranchInfo[] }>('/api/git/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...(baseBranch ? { baseBranch } : {}) }),
  });
}

export function deleteGitBranch(
  branch: string,
  force = false,
): Promise<{ deleted: string; branches: GitBranchInfo[] }> {
  const qs = force ? '?force=true' : '';
  return requestJson<{ deleted: string; branches: GitBranchInfo[] }>(
    `/api/git/branches/${encodeURIComponent(branch)}${qs}`,
    { method: 'DELETE' },
  );
}

export function switchGitBranch(branch: string): Promise<GitSwitchBranchResponse> {
  return requestJson<GitSwitchBranchResponse>('/api/git/switch-branch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch }),
  });
}

export function fetchGitLog(
  path?: string,
  limit = 50,
): Promise<{ branch: string; commits: GitCommitInfo[] }> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  params.set('limit', String(limit));
  return requestJson<{ branch: string; commits: GitCommitInfo[] }>(`/api/git/log?${params}`);
}

export function fetchGitDiff(options: {
  path: string;
  from?: string;
  to?: string;
}): Promise<GitFileDiff> {
  const params = new URLSearchParams({ path: options.path });
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  return requestJson<GitFileDiff>(`/api/git/diff?${params}`);
}

export function fetchFileAtRevision(
  path: string,
  rev: string,
): Promise<{ path: string; rev: string; content: string }> {
  const params = new URLSearchParams({ path, rev });
  return requestJson<{ path: string; rev: string; content: string }>(
    `/api/git/file?${params}`,
  );
}

/** Phase 13: hand a check-out to another writer without losing the draft overlay. */
export function handoffLock(
  path: string,
  targetUserId: string,
): Promise<{ locks: FileLock[]; drafts?: DraftView[] }> {
  return requestJson<{ locks: FileLock[]; drafts?: DraftView[] }>('/api/locks/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, targetUserId }),
  });
}

export function fetchGitTags(): Promise<{ branch: string; tags: GitTagInfo[] }> {
  return requestJson<{ branch: string; tags: GitTagInfo[] }>('/api/git/tags');
}

export function createGitTag(input: {
  name: string;
  target?: string;
  message?: string;
}): Promise<{ tag: GitTagInfo; tags: GitTagInfo[] }> {
  return requestJson<{ tag: GitTagInfo; tags: GitTagInfo[] }>('/api/git/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      ...(input.target ? { target: input.target } : {}),
      ...(input.message ? { message: input.message } : {}),
    }),
  });
}

export function deleteGitTag(name: string): Promise<{ deleted: string; tags: GitTagInfo[] }> {
  return requestJson<{ deleted: string; tags: GitTagInfo[] }>(
    `/api/git/tags/${encodeURIComponent(name)}`,
    { method: 'DELETE' },
  );
}

export function fetchGitAudit(options?: {
  branch?: string;
  action?: string;
  limit?: number;
}): Promise<{ branch: string; logs: VersionAuditLogView[] }> {
  const params = new URLSearchParams();
  if (options?.branch) params.set('branch', options.branch);
  if (options?.action) params.set('action', options.action);
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return requestJson<{ branch: string; logs: VersionAuditLogView[] }>(
    `/api/git/audit${qs ? `?${qs}` : ''}`,
  );
}

export function restoreGitFile(input: RestoreFileInput): Promise<RestoreFileResponse> {
  return requestJson<RestoreFileResponse>('/api/git/restore-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function revertGitCommit(commitHash: string): Promise<RevertCommitResponse> {
  return requestJson<RevertCommitResponse>('/api/git/revert-commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commitHash }),
  });
}

export function fetchMergePreview(sourceBranch: string, targetBranch: string): Promise<MergePreview> {
  const params = new URLSearchParams({ source: sourceBranch, target: targetBranch });
  return requestJson<MergePreview>(`/api/git/merge-preview?${params}`);
}

export function fetchMergeConflict(
  sourceBranch: string,
  targetBranch: string,
  path: string,
): Promise<MergeConflictContent> {
  const params = new URLSearchParams({ source: sourceBranch, target: targetBranch, path });
  return requestJson<MergeConflictContent>(`/api/git/merge-conflict?${params}`);
}

export function executeGitMerge(input: {
  sourceBranch: string;
  targetBranch: string;
  message?: string;
  resolutions?: Record<string, string>;
}): Promise<MergeResult & { status?: GitStatusResponse }> {
  return requestJson<MergeResult & { status?: GitStatusResponse }>('/api/git/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      ...(input.message ? { message: input.message } : {}),
      ...(input.resolutions && Object.keys(input.resolutions).length > 0
        ? { resolutions: input.resolutions }
        : {}),
    }),
  });
}

export function commitExternalChanges(
  message: string,
): Promise<{ commit: GitCommitInfo | string; status?: GitStatusResponse }> {
  return requestJson<{ commit: GitCommitInfo | string; status?: GitStatusResponse }>(
    '/api/git/external-commit',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    },
  );
}

export function discardExternalChanges(): Promise<{
  discarded: boolean | string[];
  paths?: string[];
  status?: GitStatusResponse;
}> {
  return requestJson<{
    discarded: boolean | string[];
    paths?: string[];
    status?: GitStatusResponse;
  }>(
    '/api/git/external-discard',
    { method: 'POST' },
  );
}
