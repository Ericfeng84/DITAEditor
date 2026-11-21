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
}

export interface GitStatusResponse extends GitStatusSummary {
  workDir: string;
  projectRootDir: string;
  projectId: string;
  locks: FileLock[];
}

export interface GitBranchesResponse {
  initialized: boolean;
  branch: string;
  primaryBranch: string;
  branches: GitBranchInfo[];
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

export interface CheckinResponse {
  commit: GitCommitInfo;
  branch: string;
  projectId: string;
  releasedPaths: string[];
  locks: FileLock[];
  status: GitStatusSummary;
  workDir: string;
  projectRootDir: string;
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

export function checkinFiles(paths: string[], message: string): Promise<CheckinResponse> {
  return requestJson<CheckinResponse>('/api/locks/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths, message }),
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

export function createGitBranch(name: string): Promise<{ branch: string }> {
  return requestJson<{ branch: string }>('/api/git/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
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
