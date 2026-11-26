import { create } from 'zustand';
import { t } from '../i18n/index.js';
import {
  cancelCheckout,
  checkinFiles,
  checkoutFile,
  commitExternalChanges,
  createGitBranch,
  createGitTag,
  deleteGitBranch,
  deleteGitTag,
  discardExternalChanges,
  executeGitMerge,
  fetchBranches,
  fetchGitAudit,
  fetchGitDiff,
  fetchGitLog,
  fetchGitStatus,
  fetchGitTags,
  fetchIdentity,
  fetchLocks,
  forceUnlockFile,
  handoffLock,
  initGitRepository,
  releaseLock,
  restoreGitFile,
  revertGitCommit,
  switchGitBranch,
  type CheckinOptions,
  type CheckinResponse,
  type DraftView,
  type FileLock,
  type GitBranchInfo,
  type GitCommitInfo,
  type GitFileChange,
  type GitFileDiff,
  type GitStatusResponse,
  type GitTagInfo,
  type LockOperationResponse,
  type MergeResult,
  type RestoreFileInput,
  type VersionAuditLogView,
} from '../services/git-api';
import {
  getCurrentUserId,
  setCurrentUserId,
  type IdentityResponse,
  type IdentityUser,
} from '../services/identity-api';
import { fetchWorkspace, type WorkspaceSnapshot } from '../services/workspace-api';
import { ApiHttpError } from '../services/workspace-api';
import { useAssignmentStore } from './assignment-store';
import { useEditorStore } from './editor-store';

/** Phase 13 visible operation feedback: an `sr-only` announcement alone is invisible on screen. */
export interface GitNotice {
  id: number;
  tone: 'success' | 'info';
  message: string;
}

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
  /** Phase 13: the caller's own uncommitted drafts (what "dirty" means in this app). */
  userDrafts: DraftView[];
  /** Phase 13: files edited on disk outside the app (desktop editor, script). */
  externalDirtyFiles: GitFileChange[];
  /** Phase 13: immutable publish snapshots. */
  tags: GitTagInfo[];
  auditLogs: VersionAuditLogView[];
  history: GitCommitInfo[];
  historyPath: string | null;
  diff: GitFileDiff | null;
  diffLoading: boolean;
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  /** Sticky, dismissible success/info banner pinned below the panel header. */
  notice: GitNotice | null;
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
  checkin: (
    paths: string[],
    message: string,
    options?: CheckinOptions,
  ) => Promise<CheckinResponse | null>;
  forceUnlock: (path: string, reason?: string) => Promise<void>;
  initGit: () => Promise<boolean>;
  createBranch: (name: string, baseBranch?: string | null) => Promise<boolean>;
  switchBranch: (branch: string) => Promise<boolean>;
  /** Phase 13: delete a branch (admins may force-delete a checked-out branch). */
  deleteBranch: (branch: string, force?: boolean) => Promise<boolean>;
  /** Phase 13: move a check-out (and its draft overlay) to another writer. */
  handoff: (path: string, targetUserId: string) => Promise<boolean>;
  loadTags: () => Promise<void>;
  createTag: (input: { name: string; target?: string; message?: string }) => Promise<boolean>;
  deleteTag: (name: string) => Promise<boolean>;
  loadAudit: (options?: { branch?: string; action?: string; limit?: number }) => Promise<void>;
  restoreFile: (input: RestoreFileInput) => Promise<boolean>;
  revertCommit: (commitHash: string) => Promise<boolean>;
  commitExternal: (message: string) => Promise<boolean>;
  discardExternal: () => Promise<boolean>;
  /** Phase 13: run a safe merge and refresh every view that can see the result. */
  merge: (input: {
    sourceBranch: string;
    targetBranch: string;
    message?: string;
    resolutions?: Record<string, string>;
  }) => Promise<MergeResult | null>;
  loadHistory: (path?: string | null) => Promise<void>;
  loadDiff: (options: { path: string; from?: string; to?: string }) => Promise<GitFileDiff | null>;
  clearDiff: () => void;
  clearError: () => void;
  clearNotice: () => void;
  applyBranchSnapshot: (snapshot: WorkspaceSnapshot) => Promise<void>;
}

function shortCommitHash(commit: string | GitCommitInfo | null | undefined): string {
  if (!commit) return '';
  if (typeof commit === 'string') return commit.slice(0, 7);
  return commit.shortHash || commit.hash.slice(0, 7);
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useGitStore = create<GitWorkbenchState>((set, get) => {
  const applyLocks = (locks: FileLock[]) => set({ locks });
  const announce = (message: string) => useEditorStore.getState().announce(message);
  let noticeSequence = 0;
  const showNotice = (tone: GitNotice['tone'], message: string) => {
    noticeSequence += 1;
    set({ notice: { id: noticeSequence, tone, message } });
  };

  /**
   * Phase 13: a baseline mutation (merge / restore / revert / external commit) changes files
   * behind the open tabs, so every derived view is re-read instead of trusting stale buffers.
   *
   * `reloadAllOpen` (and any baseline-wide mutation with no known path list) must refresh every
   * open tab and map buffer: passing an empty list used to reload literally nothing, which made
   * revert / external-commit look like a no-op in the editor.
   */
  const refreshBaselineDependents = async (
    paths: readonly string[],
    options?: { reloadAllOpen?: boolean },
  ) => {
    await refreshGit().catch(() => undefined);
    const editor = useEditorStore.getState();
    await editor.refreshWorkspaceTree().catch(() => undefined);
    const targets = new Set(paths.filter((path) => path.length > 0));
    if (options?.reloadAllOpen === true || paths.length === 0) {
      for (const tab of editor.openTabs) targets.add(tab.path);
      for (const mapPath of Object.keys(editor.mapBuffers)) targets.add(mapPath);
    }
    await editor.reloadFilesFromDisk([...targets]).catch(() => undefined);
    await editor.refreshDiagnostics().catch(() => undefined);
    if (get().auditLogs.length > 0) {
      await get().loadAudit({ limit: 50 }).catch(() => undefined);
    }
  };

  const applyStatus = (status: GitStatusResponse) => {
    set({
      status,
      locks: status.locks,
      userDrafts: status.userDrafts ?? [],
      externalDirtyFiles: status.externalDirtyFiles ?? [],
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
      ...(response.drafts ? { userDrafts: response.drafts } : {}),
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
    userDrafts: [],
    externalDirtyFiles: [],
    tags: [],
    auditLogs: [],
    history: [],
    historyPath: null,
    diff: null,
    diffLoading: false,
    loading: false,
    busyPath: null,
    error: null,
    notice: null,
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
      const switchedMessage = t('gitStatus.identitySwitched', {
        name: user.displayName,
        role: user.role,
      });
      announce(switchedMessage);
      set({ loading: true });
      try {
        const refreshed = await fetchIdentity();
        set({ identity: refreshed, currentUser: refreshed.currentUser });
        await refreshGit();
        // Phase 13: drafts live in a per-user overlay. Switching identity must drop the
        // previous author's in-memory tabs, map buffers, tree, semantics and diagnostics
        // so the newly selected user immediately sees clean Baseline (+ their own drafts).
        const editor = useEditorStore.getState();
        if (
          editor.workspaceMode === 'api' &&
          (editor.openTabs.length > 0 || editor.fileTree.length > 0)
        ) {
          const snapshot = await fetchWorkspace();
          await editor.reloadWorkspaceFromSnapshot(snapshot, switchedMessage);
        }
        await useAssignmentStore.getState().refreshLists().catch(() => undefined);
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
        // Phase 13: releasing never throws away a draft. The API answers 409 while the overlay
        // still has changes, so point at the three paths forward instead of a bare message.
        if (err instanceof ApiHttpError && err.status === 409) {
          const guided = t('gitStatus.releaseDirtyGuided', { path });
          set({ error: guided });
          announce(guided);
          return;
        }
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

    async checkin(paths, message, options) {
      if (paths.length === 0) {
        set({ error: t('gitStatus.noFilesSelected') });
        return null;
      }
      set({ busyPath: paths[0] ?? null, error: null });
      try {
        // A check-in commits what is on disk. Files that are only changed in memory would be
        // committed in their stale form (or not at all), so save them first — and stop here if
        // a save is rejected instead of silently committing a partial change.
        const editor = useEditorStore.getState();
        const dirtySelected = paths.filter((path) => editor.isPathDirty(path));
        if (dirtySelected.length > 0) {
          const failed = await useEditorStore
            .getState()
            .saveFilesEnsuringLocks(dirtySelected, { refresh: false });
          if (failed.length > 0) {
            const reason = t('gitStatus.checkinBlockedByDirty', { paths: failed.join(', ') });
            set({ error: reason });
            announce(reason);
            return null;
          }
          announce(t('gitStatus.savedBeforeCheckin', { count: dirtySelected.length }));
        }
        const response = await checkinFiles(paths, message, options);
        set({ locks: response.locks });
        if ((response.completedAssignments ?? []).length > 0) {
          // Keep the banner/tab badges honest right after a check-in completes assignments.
          await useAssignmentStore.getState().refreshLists().catch(() => undefined);
          await useAssignmentStore
            .getState()
            .refreshForTopic(useEditorStore.getState().activeTabPath)
            .catch(() => undefined);
        }
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

    async createBranch(name, baseBranch) {
      set({ loading: true, error: null });
      try {
        const response = await createGitBranch(name, baseBranch ?? undefined);
        await refreshGit();
        announce(t('gitStatus.branchCreated', { branch: response.created }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.branchCreateFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async deleteBranch(branch, force = false) {
      set({ loading: true, error: null });
      try {
        const response = await deleteGitBranch(branch, force);
        await refreshGit();
        announce(t('gitStatus.branchDeleted', { branch: response.deleted }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.branchDeleteFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async handoff(path, targetUserId) {
      set({ busyPath: path, error: null });
      try {
        const response = await handoffLock(path, targetUserId);
        set({ locks: response.locks });
        if (response.drafts) set({ userDrafts: response.drafts });
        await useEditorStore.getState().reloadFilesFromDisk([path]).catch(() => undefined);
        await refreshGit().catch(() => undefined);
        announce(t('gitStatus.handedOff', { path }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.handoffFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ busyPath: null });
      }
    },

    async loadTags() {
      try {
        const response = await fetchGitTags();
        set({ tags: response.tags });
      } catch (err) {
        set({ error: messageOf(err) });
      }
    },

    async createTag(input) {
      try {
        const response = await createGitTag(input);
        set({ tags: response.tags });
        announce(t('gitStatus.tagCreated', { tag: response.tag.name }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.tagCreateFailed', { message: messageOf(err) }));
        return false;
      }
    },

    async deleteTag(name) {
      try {
        const response = await deleteGitTag(name);
        set({ tags: response.tags });
        announce(t('gitStatus.tagDeleted', { tag: response.deleted }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.tagDeleteFailed', { message: messageOf(err) }));
        return false;
      }
    },

    async loadAudit(options) {
      try {
        const response = await fetchGitAudit(options);
        set({ auditLogs: response.logs });
      } catch (err) {
        set({ error: messageOf(err) });
      }
    },

    async restoreFile(input) {
      set({ busyPath: input.path, error: null, notice: null });
      const revision = shortCommitHash(input.revision);
      try {
        const response = await restoreGitFile(input);
        // `unchanged`: the revision matches what this user reads, so the API minted no lock and
        // no draft — reloading would only throw away unsaved in-memory edits.
        if (response.unchanged === true) {
          const message = t('gitStatus.restoredUnchanged', { path: input.path, revision });
          showNotice('info', message);
          announce(message);
        } else {
          await refreshBaselineDependents([input.path]);
          const message =
            response.clearedDraft === true
              ? t('gitStatus.restoredClearedDraft', { path: input.path, revision })
              : t('gitStatus.restored', { path: input.path, revision: input.revision });
          showNotice('success', message);
          announce(message);
        }
        if (input.mode === 'commit') {
          await get().loadHistory(get().historyPath);
        }
        return true;
      } catch (err) {
        set({ error: messageOf(err), notice: null });
        announce(t('gitStatus.restoreFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ busyPath: null });
      }
    },

    async revertCommit(commitHash) {
      set({ loading: true, error: null, notice: null });
      try {
        const response = await revertGitCommit(commitHash);
        const changedFiles = response.changedFiles ?? [];
        await refreshBaselineDependents(changedFiles, {
          reloadAllOpen: changedFiles.length === 0,
        });
        await get().loadHistory(get().historyPath);
        const message = t('gitStatus.reverted', { hash: shortCommitHash(response.commit) });
        showNotice('success', message);
        announce(message);
        return true;
      } catch (err) {
        set({ error: messageOf(err), notice: null });
        announce(t('gitStatus.revertFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async commitExternal(message) {
      set({ loading: true, error: null, notice: null });
      try {
        const response = await commitExternalChanges(message);
        // The API does not report which paths the commit touched, so re-read everything open.
        await refreshBaselineDependents([], { reloadAllOpen: true });
        await get().loadHistory(get().historyPath);
        announce(t('gitStatus.externalCommitted', { hash: shortCommitHash(response.commit) }));
        return true;
      } catch (err) {
        set({ error: messageOf(err), notice: null });
        announce(t('gitStatus.externalCommitFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async discardExternal() {
      set({ loading: true, error: null });
      try {
        const prevCount = get().externalDirtyFiles.length;
        const response = await discardExternalChanges();
        const discardedPaths = Array.isArray(response.paths)
          ? response.paths
          : Array.isArray(response.discarded)
            ? response.discarded
            : [];
        await refreshBaselineDependents(discardedPaths);
        announce(t('gitStatus.externalDiscarded', { count: discardedPaths.length || prevCount }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.externalDiscardFailed', { message: messageOf(err) }));
        return false;
      } finally {
        set({ loading: false });
      }
    },

    async merge(input) {
      set({ loading: true, error: null });
      try {
        const result = await executeGitMerge(input);
        await refreshBaselineDependents(result.changedFiles ?? []);
        await get().loadHistory(get().historyPath);
        announce(
          t('gitStatus.merged', {
            source: result.sourceBranch,
            target: result.targetBranch,
            hash: shortCommitHash(result.commit),
          }),
        );
        return result;
      } catch (err) {
        set({ error: messageOf(err) });
        announce(t('gitStatus.mergeFailed', { message: messageOf(err) }));
        return null;
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

    clearError() {
      set({ error: null });
    },

    clearNotice() {
      set({ notice: null });
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

/** Why an edit was allowed or rejected — mirrors `authorizeWrite()` in the API lock service. */
export type LockGuardReason =
  | 'memory'
  | 'admin'
  | 'owned'
  | 'locked-by-other'
  | 'viewer'
  | 'checkout-failed';

export interface LockGuardResult {
  ok: boolean;
  reason: LockGuardReason;
  lock: FileLock | null;
  /** Localized explanation, safe to show in a visible alert. Empty when `ok`. */
  message: string;
}

/**
 * In-flight checkouts per path.
 *
 * Several mutations can fire from one user gesture (map structure insert refreshes the tree
 * which can trigger a second write); the API rejects a duplicate check-out with 409, so the
 * second call waits on the first instead of racing it.
 */
const pendingCheckouts = new Map<string, Promise<LockGuardResult>>();

export async function ensureFileCheckedOut(path: string): Promise<LockGuardResult> {
  const pending = pendingCheckouts.get(path);
  if (pending) return pending;
  const run = runLockGuard(path);
  pendingCheckouts.set(path, run);
  try {
    return await run;
  } finally {
    pendingCheckouts.delete(path);
  }
}

async function runLockGuard(path: string): Promise<LockGuardResult> {
  const state = useGitStore.getState();
  const { currentUser, projectId, locks } = state;
  // Memory mode has no locks at all: the in-browser workspace is single-user.
  if (!projectId || !currentUser) {
    return { ok: true, reason: 'memory', lock: null, message: '' };
  }
  const holder = locks.find((lock) => lock.filePath === path) ?? null;
  if (holder && holder.userId === currentUser.id) {
    return { ok: true, reason: 'owned', lock: holder, message: '' };
  }
  // Phase 13: nobody silently overwrites somebody else's check-out, admins included — they
  // must force-unlock first (which backs up the holder's content into the audit table).
  if (holder) {
    return {
      ok: false,
      reason: 'locked-by-other',
      lock: holder,
      message:
        currentUser.role === 'admin'
          ? t('lock.adminHeldByOther', { user: holder.userName || holder.userId })
          : t('lock.checkedOutByOther', { user: holder.userName || holder.userId }),
    };
  }
  if (currentUser.role === 'admin') {
    return { ok: true, reason: 'admin', lock: null, message: '' };
  }
  if (currentUser.role === 'viewer') {
    return {
      ok: false,
      reason: 'viewer',
      lock: holder,
      message: t('lock.viewerReadOnly'),
    };
  }
  const lock = await state.checkout(path);
  if (!lock) {
    const error = useGitStore.getState().error ?? '';
    return {
      ok: false,
      reason: 'checkout-failed',
      lock: null,
      message: error || t('lock.guardCheckoutFailed', { path }),
    };
  }
  return { ok: true, reason: 'owned', lock, message: '' };
}
