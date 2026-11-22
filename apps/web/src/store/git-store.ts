import { create } from 'zustand';
import { t } from '../i18n/index.js';
import {
  cancelCheckout,
  checkinFiles,
  checkoutFile,
  createGitBranch,
  fetchBranches,
  fetchGitDiff,
  fetchGitLog,
  fetchGitStatus,
  fetchIdentity,
  fetchLocks,
  forceUnlockFile,
  initGitRepository,
  releaseLock,
  switchGitBranch,
  type CheckinResponse,
  type FileLock,
  type GitBranchInfo,
  type GitCommitInfo,
  type GitFileDiff,
  type GitStatusResponse,
  type LockOperationResponse,
} from '../services/git-api';
import {
  getCurrentUserId,
  setCurrentUserId,
  type IdentityResponse,
  type IdentityUser,
} from '../services/identity-api';
import type { WorkspaceSnapshot } from '../services/workspace-api';
import { useEditorStore } from './editor-store';

export interface GitWorkbenchState {
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  locks: FileLock[];
  branch: string | null;
  projectId: string | null;
  workDir: string | null;
  projectRootDir: string | null;
  status: GitStatusResponse | null;
  branches: GitBranchInfo[];
  history: GitCommitInfo[];
  historyPath: string | null;
  diff: GitFileDiff | null;
  diffLoading: boolean;
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  lastCommit: GitCommitInfo | null;

  initialize: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshLocks: () => Promise<void>;
  refreshGit: () => Promise<void>;
  /** Re-fetch identities so API-localized role labels follow a UI-locale switch. */
  refreshIdentity: () => Promise<void>;
  checkout: (path: string) => Promise<FileLock | null>;
  release: (path: string) => Promise<void>;
  cancel: (path: string) => Promise<void>;
  checkin: (paths: string[], message: string) => Promise<CheckinResponse | null>;
  forceUnlock: (path: string, reason?: string) => Promise<void>;
  initGit: () => Promise<boolean>;
  createBranch: (name: string) => Promise<boolean>;
  switchBranch: (branch: string) => Promise<boolean>;
  loadHistory: (path?: string | null) => Promise<void>;
  loadDiff: (options: { path: string; from?: string; to?: string }) => Promise<GitFileDiff | null>;
  clearDiff: () => void;
  applyBranchSnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useGitStore = create<GitWorkbenchState>((set, get) => {
  const applyLocks = (locks: FileLock[]) => set({ locks });
  const announce = (message: string) => useEditorStore.getState().announce(message);

  const applyStatus = (status: GitStatusResponse) => {
    set({
      status,
      locks: status.locks,
      branch: status.branch,
      projectId: status.projectId,
      workDir: status.workDir,
      projectRootDir: status.projectRootDir,
      lastCommit: status.lastCommit,
    });
  };

  const refreshGit = async () => {
    const status = await fetchGitStatus();
    applyStatus(status);
    const branchesResponse = await fetchBranches();
    set({ branches: branchesResponse.branches });
  };

  const refreshLocks = async () => {
    const response = await fetchLocks();
    set({
      locks: response.locks,
      branch: response.branch,
      projectId: response.projectId,
      workDir: response.workDir,
      projectRootDir: response.projectRootDir,
    });
  };

  const refreshAll = async () => {
    set({ loading: true, error: null });
    try {
      await refreshGit();
    } catch (err) {
      set({ error: messageOf(err) });
      try {
        await refreshLocks();
      } catch {
        // Leave the previous lock list in place when the API is offline.
      }
    } finally {
      set({ loading: false });
    }
  };

  const applyLockOperation = (response: LockOperationResponse) => {
    applyLocks(response.locks);
    set({ branch: response.branch, projectId: response.projectId, workDir: response.workDir });
  };

  return {
    identity: null,
    currentUser: null,
    locks: [],
    branch: null,
    projectId: null,
    workDir: null,
    projectRootDir: null,
    status: null,
    branches: [],
    history: [],
    historyPath: null,
    diff: null,
    diffLoading: false,
    loading: false,
    busyPath: null,
    error: null,
    lastCommit: null,

    async initialize() {
      set({ loading: true, error: null });
      try {
        const identity = await fetchIdentity();
        const storedId = getCurrentUserId();
        const storedUser = storedId
          ? (identity.users.find((user) => user.id === storedId) ?? null)
          : null;
        if (storedUser && storedUser.id !== identity.currentUser.id) {
          setCurrentUserId(storedUser.id);
          const refreshed = await fetchIdentity();
          set({ identity: refreshed, currentUser: refreshed.currentUser });
        } else {
          setCurrentUserId(identity.currentUser.id);
          set({ identity, currentUser: identity.currentUser });
        }
        await refreshGit().catch((err) => set({ error: messageOf(err) }));
        await refreshLocks().catch(() => undefined);
      } catch (err) {
        set({ error: messageOf(err) });
      } finally {
        set({ loading: false });
      }
    },

    async switchUser(userId) {
      const identity = get().identity;
      const user = identity?.users.find((item) => item.id === userId);
      if (!user) return;
      setCurrentUserId(user.id);
      set({ currentUser: user, error: null, diff: null });
      announce(t('gitStatus.identitySwitched', { name: user.displayName, role: user.role }));
      set({ loading: true });
      try {
        const refreshed = await fetchIdentity();
        set({ identity: refreshed, currentUser: refreshed.currentUser });
        await refreshGit();
      } catch (err) {
        set({ error: messageOf(err) });
      } finally {
        set({ loading: false });
      }
    },

    refreshAll,
    refreshLocks,
    refreshGit,

    async refreshIdentity() {
      try {
        const identity = await fetchIdentity();
        const current =
          identity.users.find((user) => user.id === get().currentUser?.id) ??
          identity.currentUser;
        set({ identity, currentUser: current });
      } catch {
        // identity text is cosmetic; keep the previous snapshot on transient errors
      }
    },

    async checkout(path) {
      set({ busyPath: path, error: null });
      try {
        const response = await checkoutFile(path);
        applyLockOperation(response);
        await refreshGit().catch(() => undefined);
        announce(
          response.autoLocked
            ? t('gitStatus.autoLocked', { path })
            : t('gitStatus.checkedOut', { path }),
        );
        return response.lock ?? null;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.checkoutFailed', { message: messageOf(err) }));
        return null;
      } finally {
        set({ busyPath: null });
      }
    },

    async release(path) {
      set({ busyPath: path, error: null });
      try {
        const response = await releaseLock(path);
        applyLockOperation(response);
        await refreshGit().catch(() => undefined);
        announce(t('gitStatus.released', { path }));
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.releaseFailed', { message: messageOf(err) }));
      } finally {
        set({ busyPath: null });
      }
    },

    async cancel(path) {
      set({ busyPath: path, error: null });
      try {
        const response = await cancelCheckout(path);
        applyLockOperation(response);
        await useEditorStore.getState().reloadFilesFromDisk([path]);
        await refreshGit().catch(() => undefined);
        announce(t('gitStatus.cancelled', { path }));
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.cancelFailed', { message: messageOf(err) }));
      } finally {
        set({ busyPath: null });
      }
    },

    async checkin(paths, message) {
      if (paths.length === 0) {
        set({ error: t('gitStatus.noFilesSelected') });
        return null;
      }
      set({ busyPath: paths[0] ?? null, error: null });
      try {
        const response = await checkinFiles(paths, message);
        set({ locks: response.locks });
        await refreshGit().catch(() => undefined);
        await useEditorStore.getState().refreshWorkspaceTree().catch(() => undefined);
        await useEditorStore.getState().reloadFilesFromDisk(paths).catch(() => undefined);
        announce(t('gitStatus.committed', { hash: response.commit.shortHash, message: response.commit.message }));
        return response;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.commitFailed', { message: messageOf(err) }));
        return null;
      } finally {
        set({ busyPath: null });
      }
    },

    async forceUnlock(path, reason) {
      set({ busyPath: path, error: null });
      try {
        const response = await forceUnlockFile(path, reason);
        applyLocks(response.locks);
        await useEditorStore.getState().reloadFilesFromDisk([path]);
        await refreshGit().catch(() => undefined);
        announce(
          t('gitStatus.forceUnlocked', {
            path,
            user: response.released.userName,
            chars: response.backup.patchPreview.length,
          }),
        );
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.forceUnlockFailed', { message: messageOf(err) }));
      } finally {
        set({ busyPath: null });
      }
    },

    async initGit() {
      set({ loading: true, error: null });
      try {
        const response = await initGitRepository();
        await refreshGit();
        announce(
          response.created ? t('gitStatus.initialized') : t('gitStatus.alreadyInitialized'),
        );
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.initFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async createBranch(name) {
      set({ loading: true, error: null });
      try {
        const response = await createGitBranch(name);
        await refreshGit();
        announce(t('gitStatus.branchCreated', { branch: response.branch }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.branchCreateFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async switchBranch(branch) {
      set({ loading: true, error: null });
      try {
        const response = await switchGitBranch(branch);
        set({
          branch: response.branch,
          workDir: response.workDir,
          projectRootDir: response.projectRootDir,
          locks: response.locks,
          history: [],
          historyPath: null,
          diff: null,
        });
        await useEditorStore
          .getState()
          .reloadWorkspaceFromSnapshot(
            response.snapshot,
            t('gitStatus.branchSwitchedPath', { branch: response.branch, path: response.workDir }),
          );
        await refreshGit().catch(() => undefined);
        announce(t('gitStatus.branchSwitched', { branch: response.branch }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.branchSwitchFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async loadHistory(path) {
      set({ historyPath: path ?? null, error: null });
      try {
        const response = await fetchGitLog(path ?? undefined);
        set({ history: response.commits });
      } catch (err) {
        set({ error: messageOf(err), history: [] });
      }
    },

    async loadDiff(options) {
      set({ diffLoading: true, error: null });
      try {
        const diff = await fetchGitDiff(options);
        set({ diff });
        return diff;
      } catch (err) {
        set({ error: messageOf(err), diff: null });
        announce(t('gitStatus.diffFailed', { message: messageOf(err) }));
        return null;
      } finally {
        set({ diffLoading: false });
      }
    },

    clearDiff() {
      set({ diff: null });
    },

    async applyBranchSnapshot(snapshot) {
      await useEditorStore.getState().reloadWorkspaceFromSnapshot(snapshot);
    },
  };
});

export function selectCurrentLock(state: GitWorkbenchState, path: string | null): FileLock | null {
  if (!path) return null;
  return state.locks.find((lock) => lock.filePath === path) ?? null;
}
