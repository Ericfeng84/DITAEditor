import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileDiff,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  History,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  ShieldAlert,
  Tag,
  Trash2,
  Undo2,
  UserRoundPlus,
  X,
} from 'lucide-react';
import { useGitStore } from '../store/git-store';
import { useEditorStore } from '../store/editor-store';
import { roleLabel } from '../services/identity-api';
import type { MessageKey } from '../i18n/messages/index.js';
import type { DraftView, GitFileChange } from '../services/git-api';

export interface GitPanelProps {
  activePath: string | null;
  onOpenDiff: (options: { path: string; from?: string; to?: string }) => void;
  onOpenCheckin: (paths: string[]) => void;
  /** Phase 13: opens the safe-merge dialog (branch selectors, preview, conflicts). */
  onOpenMerge?: () => void;
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Git change badges are localized on the client so the API stays locale-free. */
function changeLabelKey(change: GitFileChange): MessageKey {
  if (change.untracked) return 'git.change.added';
  if (change.renamed) return 'git.change.renamed';
  if (change.deleted) return 'git.change.deleted';
  if (change.staged && change.workingTree !== ' ') return 'git.change.stagedModified';
  if (change.staged) return 'git.change.staged';
  return 'git.change.modified';
}

/** Phase 13 draft op badge (`edit` / `create` / `delete` / `rename`). */
function draftOpKey(op: DraftView['op']): MessageKey {
  switch (op) {
    case 'create':
      return 'git.draftOp.create';
    case 'delete':
      return 'git.draftOp.delete';
    case 'rename':
      return 'git.draftOp.rename';
    default:
      return 'git.draftOp.edit';
  }
}

const draftOpTone: Record<DraftView['op'], string> = {
  edit: 'bg-sky-100 text-sky-700',
  create: 'bg-emerald-100 text-emerald-700',
  delete: 'bg-rose-100 text-rose-700',
  rename: 'bg-amber-100 text-amber-800',
};

export function GitPanel({ activePath, onOpenDiff, onOpenCheckin, onOpenMerge }: GitPanelProps) {
  const { t } = useI18n();
  const identity = useGitStore((state) => state.identity);
  const currentUser = useGitStore((state) => state.currentUser);
  const status = useGitStore((state) => state.status);
  const branches = useGitStore((state) => state.branches);
  const branch = useGitStore((state) => state.branch);
  const locks = useGitStore((state) => state.locks);
  const userDrafts = useGitStore((state) => state.userDrafts);
  const externalDirtyFiles = useGitStore((state) => state.externalDirtyFiles);
  const tags = useGitStore((state) => state.tags);
  const auditLogs = useGitStore((state) => state.auditLogs);
  const history = useGitStore((state) => state.history);
  const loading = useGitStore((state) => state.loading);
  const error = useGitStore((state) => state.error);
  const notice = useGitStore((state) => state.notice);
  const clearError = useGitStore((state) => state.clearError);
  const clearNotice = useGitStore((state) => state.clearNotice);
  const busyPath = useGitStore((state) => state.busyPath);
  const refreshAll = useGitStore((state) => state.refreshAll);
  const initGit = useGitStore((state) => state.initGit);
  const createBranch = useGitStore((state) => state.createBranch);
  const switchBranch = useGitStore((state) => state.switchBranch);
  const deleteBranch = useGitStore((state) => state.deleteBranch);
  const loadHistory = useGitStore((state) => state.loadHistory);
  const release = useGitStore((state) => state.release);
  const cancel = useGitStore((state) => state.cancel);
  const forceUnlock = useGitStore((state) => state.forceUnlock);
  const handoff = useGitStore((state) => state.handoff);
  const loadTags = useGitStore((state) => state.loadTags);
  const createTag = useGitStore((state) => state.createTag);
  const deleteTag = useGitStore((state) => state.deleteTag);
  const loadAudit = useGitStore((state) => state.loadAudit);
  const restoreFile = useGitStore((state) => state.restoreFile);
  const revertCommit = useGitStore((state) => state.revertCommit);
  const commitExternal = useGitStore((state) => state.commitExternal);
  const discardExternal = useGitStore((state) => state.discardExternal);

  const [newBranch, setNewBranch] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [tagMessage, setTagMessage] = useState('');
  const [handoffTarget, setHandoffTarget] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);

  const canWrite = currentUser?.role === 'admin' || currentUser?.role === 'writer';
  const isAdmin = currentUser?.role === 'admin';
  const initialized = Boolean(status?.initialized);
  const headHash = status?.lastCommit?.hash ?? null;
  /** `lastCommit.hash` and `history[].hash` are both full hashes; fall back to prefix matching. */
  const isHeadCommit = (hash: string): boolean => {
    if (!headHash) return false;
    if (hash === headHash) return true;
    const shorter = hash.length <= headHash.length ? hash : headHash;
    return shorter.length >= 7 && (hash.startsWith(headHash) || headHash.startsWith(hash));
  };
  /** Restore / revert must not fire twice for the same file while a request is in flight. */
  const versionActionsDisabled = loading || (Boolean(activePath) && busyPath === activePath);
  const dirtyFiles = status?.dirtyFiles ?? [];
  const dirtySet = useMemo(() => new Set(dirtyFiles.map((file) => file.path)), [dirtyFiles]);
  const myLocks = useMemo(
    () => locks.filter((lock) => lock.userId === currentUser?.id),
    [locks, currentUser?.id],
  );
  /** Members who may receive a check-out: writers and admins, never the caller or viewers. */
  const handoffCandidates = useMemo(
    () =>
      (identity?.users ?? []).filter(
        (user) => user.id !== currentUser?.id && user.role !== 'viewer',
      ),
    [identity?.users, currentUser?.id],
  );
  /** Map buffers edited in memory but not saved yet — they are check-in candidates too. */
  const memoryDirtyMaps = useEditorStore((state) =>
    Object.entries(state.mapBuffers)
      .filter(([, buffer]) => buffer.xml !== buffer.baselineXml)
      .map(([mapPath]) => mapPath)
      .join('|'),
  );
  /**
   * Phase 13: what a check-in can commit is exactly the caller's draft overlay. Deletes and
   * renames have a draft row but no check-out lock, so they must still reach the dialog.
   */
  const eligiblePaths = useMemo(() => {
    const unsaved = new Set(memoryDirtyMaps.split('|').filter(Boolean));
    const paths = new Set<string>();
    for (const draft of userDrafts) paths.add(draft.filePath);
    for (const lock of myLocks) {
      if (dirtySet.has(lock.filePath) || unsaved.has(lock.filePath)) paths.add(lock.filePath);
    }
    return Array.from(paths);
  }, [userDrafts, myLocks, dirtySet, memoryDirtyMaps]);

  const currentBranchInfo = branches.find((item) => item.name === branch) ?? null;
  const canDeleteBranch = canWrite && Boolean(branch) && !currentBranchInfo?.primary;
  const canMerge = canWrite && branches.length > 1;

  useEffect(() => {
    if (!initialized) return;
    void loadHistory(activePath);
  }, [initialized, activePath, branch, loadHistory]);

  useEffect(() => {
    if (!initialized) return;
    void loadTags();
  }, [initialized, branch, loadTags]);

  const toggleAudit = useCallback(() => {
    setAuditOpen((open) => {
      if (!open) void loadAudit({ limit: 50 });
      return !open;
    });
  }, [loadAudit]);

  const handleCreateBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    setCreating(true);
    const created = await createBranch(name, baseBranch || null);
    if (created) {
      setNewBranch('');
      setBaseBranch('');
      await switchBranch(name);
    }
    setCreating(false);
  };

  const handleDeleteBranch = async () => {
    if (!branch) return;
    if (!window.confirm(t('git.deleteBranchConfirm', { branch }))) return;
    const deleted = await deleteBranch(branch, false);
    if (!deleted && window.confirm(t('git.deleteBranchForceConfirm', { branch }))) {
      await deleteBranch(branch, true);
    }
  };

  const handleCreateTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    const created = await createTag({
      name,
      ...(tagMessage.trim() ? { message: tagMessage.trim() } : {}),
    });
    if (created) {
      setNewTag('');
      setTagMessage('');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <span className="text-[11px] font-semibold text-slate-700">{t('git.panelTitle')}</span>
        <div className="flex items-center gap-1">
          {canMerge && onOpenMerge ? (
            <button
              type="button"
              disabled={loading}
              onClick={onOpenMerge}
              className="inline-flex items-center justify-center rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              title={t('git.mergeOpenTooltip')}
              aria-label={t('git.mergeOpen')}
            >
              <GitMerge className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => void refreshAll()}
            className="inline-flex items-center justify-center rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            title={t('git.refresh')}
            aria-label={t('git.refresh')}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Phase 13: feedback is pinned outside the scrolling body. The Commit History section
          lives at the very bottom, so an error rendered inside the scroll area (or an
          `sr-only` success announcement) is invisible right when the user clicks. */}
      {error || notice ? (
        <div
          className="shrink-0 space-y-1 border-b border-slate-200 bg-white px-2 py-1.5"
          data-testid="git-panel-feedback"
        >
          {error ? (
            <div
              role="alert"
              className="flex items-start justify-between gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] leading-relaxed text-rose-700"
            >
              <span className="min-w-0 break-words">{error}</span>
              <button
                type="button"
                onClick={clearError}
                className="shrink-0 rounded p-0.5 text-rose-500 hover:bg-rose-100 hover:text-rose-800"
                title={t('git.dismissNotice')}
                aria-label={t('git.dismissNotice')}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {notice ? (
            <div
              role="status"
              className={`flex items-start justify-between gap-1 rounded-md border px-2 py-1.5 text-[10px] leading-relaxed ${
                notice.tone === 'info'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              <span className="min-w-0 break-words">{notice.message}</span>
              <button
                type="button"
                onClick={clearNotice}
                className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-white hover:text-slate-800"
                title={t('git.dismissNotice')}
                aria-label={t('git.dismissNotice')}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2" data-testid="git-panel-scroll">
        {/* Phase 13: on-disk edits made outside the app would otherwise be invisible until a
            check-in stumbled over them. */}
        {initialized && canWrite && externalDirtyFiles.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-900">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              {t('git.externalDirty', { count: externalDirtyFiles.length })}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
              {t('git.externalDirtyHint')}
            </p>
            <ul className="mt-1 space-y-0.5">
              {externalDirtyFiles.slice(0, 20).map((file) => (
                <li key={file.path} className="truncate text-[9.5px] text-amber-900" title={file.path}>
                  {file.path}
                </li>
              ))}
            </ul>
            <div className="mt-1.5 flex items-center gap-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  const message = window.prompt(
                    t('git.externalCommitPrompt', { count: externalDirtyFiles.length }),
                    t('git.externalCommit'),
                  );
                  if (message && message.trim()) void commitExternal(message.trim());
                }}
                className="rounded bg-amber-700 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {t('git.externalCommit')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (window.confirm(t('git.externalDiscardConfirm', { count: externalDirtyFiles.length }))) {
                    void discardExternal();
                  }
                }}
                className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {t('git.externalDiscard')}
              </button>
            </div>
          </div>
        ) : null}

        {!initialized ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
            <p className="text-[11px] font-semibold text-amber-900">{t('git.notInitialized')}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
              {t('git.initHint')}
            </p>
            {canWrite ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void initGit()}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <GitBranch className="h-3 w-3" aria-hidden="true" />
                {t('git.init')}
              </button>
            ) : (
              <p className="mt-2 text-[10px] font-medium text-amber-800">{t('git.readonlyInit')}</p>
            )}
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  {t('git.branch')}
                </span>
                {canDeleteBranch ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleDeleteBranch()}
                    className="shrink-0 rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:border-rose-200 hover:text-rose-600 disabled:opacity-50"
                    title={t('git.deleteBranchTooltip')}
                    aria-label={t('git.deleteBranchAria', { branch: branch ?? '' })}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {/* Phase 13: viewers may still inspect another branch — switching reads only. */}
              <select
                value={branch ?? ''}
                disabled={loading || branches.length <= 1}
                onChange={(event) => void switchBranch(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
                aria-label={t('git.switchBranchAria')}
              >
                {branches.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                    {item.primary ? t('git.primaryWorktree') : item.worktreePath ? ' · worktree' : ''}
                  </option>
                ))}
              </select>
              {canWrite ? (
                <div className="mt-1.5 space-y-1">
                  <input
                    value={newBranch}
                    onChange={(event) => setNewBranch(event.target.value)}
                    placeholder={t('git.newBranchPlaceholder')}
                    className="w-full rounded border border-slate-300 px-1.5 py-1 text-[10px] outline-none focus:border-blue-400"
                    aria-label={t('git.newBranchAria')}
                  />
                  <div className="flex items-center gap-1">
                    <select
                      value={baseBranch}
                      onChange={(event) => setBaseBranch(event.target.value)}
                      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1 py-1 text-[10px] text-slate-700 outline-none focus:border-blue-400"
                      aria-label={t('git.baseBranchAria')}
                    >
                      <option value="">{t('git.baseBranch')} · {branch ?? ''}</option>
                      {branches
                        .filter((item) => item.name !== branch)
                        .map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={creating || !newBranch.trim()}
                      onClick={() => void handleCreateBranch()}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                      title={t('git.createBranchTooltip')}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      {t('common.create')}
                    </button>
                  </div>
                </div>
              ) : null}
              {status?.lastCommit ? (
                <p className="mt-1.5 truncate text-[10px] text-slate-500" title={status.lastCommit.message}>
                  HEAD {status.lastCommit.shortHash} · {status.lastCommit.message}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {t('git.locks', { count: locks.length })}
                </span>
                {eligiblePaths.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenCheckin(eligiblePaths)}
                    className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700"
                  >
                    {t('git.checkin', { count: eligiblePaths.length })}
                  </button>
                ) : null}
              </div>
              {locks.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">{t('git.noLocks')}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {locks.map((lock) => (
                    <li
                      key={lock.id}
                      className="flex items-center justify-between gap-1 rounded border border-slate-100 bg-slate-50/60 px-1.5 py-1"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-medium text-slate-700" title={lock.filePath}>
                          {lock.filePath}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-500">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: lock.userColor }}
                            aria-hidden="true"
                          />
                          {lock.userName} · {shortDate(lock.updatedAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        {lock.userId === currentUser?.id ? (
                          <>
                            <button
                              type="button"
                              disabled={busyPath === lock.filePath}
                              onClick={() => void release(lock.filePath)}
                              className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-50"
                              title={t('git.releaseTooltip')}
                              aria-label={t('git.releaseAria', { path: lock.filePath })}
                            >
                              <LockOpen className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={busyPath === lock.filePath}
                              onClick={() => void cancel(lock.filePath)}
                              className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:text-rose-600 disabled:opacity-50"
                              title={t('lock.cancelTitle')}
                              aria-label={t('lock.cancelCheckout')}
                            >
                              <Undo2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={busyPath === lock.filePath || !handoffTarget}
                              onClick={() => void handoff(lock.filePath, handoffTarget)}
                              className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:text-blue-700 disabled:opacity-40"
                              title={t('git.handoffTooltip')}
                              aria-label={t('git.handoffAria', { path: lock.filePath })}
                            >
                              <UserRoundPlus className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            disabled={busyPath === lock.filePath}
                            onClick={() => {
                              const reason = window.prompt(
                                t('git.forceUnlockPrompt', { path: lock.filePath, user: lock.userName }),
                                t('git.forceUnlockPromptTitle'),
                              );
                              if (reason !== null) void forceUnlock(lock.filePath, reason);
                            }}
                            className="rounded border border-rose-200 bg-white p-0.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            title={t('git.forceUnlockTooltip')}
                            aria-label={t('git.forceUnlockAria', { path: lock.filePath })}
                          >
                            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                          </button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && myLocks.length > 0 && handoffCandidates.length > 0 ? (
                <div className="mt-1.5 flex items-center gap-1 border-t border-slate-100 pt-1.5">
                  <label className="shrink-0 text-[9.5px] text-slate-500" htmlFor="git-handoff-target">
                    {t('git.handoffTarget')}
                  </label>
                  <select
                    id="git-handoff-target"
                    value={handoffTarget}
                    onChange={(event) => setHandoffTarget(event.target.value)}
                    aria-label={t('git.handoffTargetAria')}
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[9.5px] text-slate-700 outline-none focus:border-blue-400"
                  >
                    <option value="">{t('git.handoffTargetNone')}</option>
                    {handoffCandidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Archive className="h-3 w-3" aria-hidden="true" />
                  {t('git.drafts', { count: userDrafts.length })}
                </span>
              </div>
              {userDrafts.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">{t('git.noDrafts')}</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {userDrafts.slice(0, 80).map((draft) => (
                    <li key={draft.id} className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenDiff({ path: draft.filePath, from: 'HEAD' })}
                        className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded px-1 py-0.5 text-left hover:bg-slate-50"
                        title={t('git.viewDiffTooltip', { path: draft.filePath })}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[10px] text-slate-700">
                            {draft.originalPath
                              ? `${draft.originalPath} → ${draft.filePath}`
                              : draft.filePath}
                          </span>
                          {draft.originalPath ? (
                            <span className="block truncate text-[9px] text-slate-400">
                              {t('git.draftRenamedFrom', { path: draft.originalPath })}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`shrink-0 rounded px-1 text-[9px] ${draftOpTone[draft.op]}`}
                        >
                          {t(draftOpKey(draft.op))}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={busyPath === draft.filePath}
                        onClick={() => void cancel(draft.filePath)}
                        className="shrink-0 rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:text-rose-600 disabled:opacity-50"
                        title={t('lock.cancelTitle')}
                        aria-label={t('lock.cancelCheckout')}
                      >
                        <Undo2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <FileDiff className="h-3 w-3" aria-hidden="true" />
                  {t('git.dirty', { count: dirtyFiles.length })}
                </span>
                {activePath && dirtySet.has(activePath) ? (
                  <button
                    type="button"
                    onClick={() => onOpenDiff({ path: activePath, from: 'HEAD' })}
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    {t('git.currentDiff')}
                  </button>
                ) : null}
              </div>
              {dirtyFiles.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">{t('git.clean')}</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {dirtyFiles.slice(0, 80).map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        onClick={() => onOpenDiff({ path: file.path, from: 'HEAD' })}
                        className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left hover:bg-slate-50"
                        title={t('git.viewDiffTooltip', { path: file.path })}
                      >
                        <span className="min-w-0 truncate text-[10px] text-slate-700">
                          {file.renamed ? `${file.originalPath} → ${file.path}` : file.path}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-1 text-[9px] text-slate-500">
                          {t(changeLabelKey(file))}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <Tag className="h-3 w-3" aria-hidden="true" />
                {t('git.tags', { count: tags.length })}
              </div>
              {tags.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">{t('git.noTags')}</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {tags.slice(0, 40).map((tag) => (
                    <li
                      key={tag.name}
                      className="flex items-center justify-between gap-1 rounded border border-slate-100 bg-slate-50/60 px-1.5 py-1"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-medium text-slate-700" title={tag.message || tag.name}>
                          {tag.name}
                        </span>
                        <span className="block truncate text-[9px] text-slate-500">
                          {tag.shortHash} · {shortDate(tag.date)}
                        </span>
                      </span>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('git.tagDeleteConfirm', { tag: tag.name }))) {
                              void deleteTag(tag.name);
                            }
                          }}
                          className="shrink-0 rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:border-rose-200 hover:text-rose-600"
                          title={t('git.tagDeleteTooltip')}
                          aria-label={t('git.tagDeleteAria', { tag: tag.name })}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite ? (
                <div className="mt-1.5 space-y-1">
                  <input
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    placeholder={t('git.tagPlaceholder')}
                    aria-label={t('git.tagPlaceholder')}
                    className="w-full rounded border border-slate-300 px-1.5 py-1 text-[10px] outline-none focus:border-blue-400"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      value={tagMessage}
                      onChange={(event) => setTagMessage(event.target.value)}
                      placeholder={t('git.tagMessagePlaceholder')}
                      aria-label={t('git.tagMessagePlaceholder')}
                      className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-[10px] outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      disabled={!newTag.trim()}
                      onClick={() => void handleCreateTag()}
                      className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                      title={t('git.createTagTooltip')}
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      {t('common.create')}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <History className="h-3 w-3" aria-hidden="true" />
                {activePath ? t('git.historyForFile', { name: activePath.split('/').pop() ?? '' }) : t('git.historyAllBranches')}
              </div>
              {history.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">{t('git.noCommits')}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {history.slice(0, 30).map((commit) => (
                    <li key={commit.hash} className="rounded border border-slate-100 p-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-medium text-slate-800" title={commit.message}>
                            {commit.message}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                            <GitCommitHorizontal className="h-2.5 w-2.5" aria-hidden="true" />
                            {commit.shortHash} · {commit.authorName} · {shortDate(commit.date)}
                            {isHeadCommit(commit.hash) ? (
                              <span className="rounded bg-emerald-100 px-1 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-emerald-700">
                                {t('git.headBadge')}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          {activePath ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenDiff({
                                  path: activePath,
                                  from: `${commit.hash}~1`,
                                  to: commit.hash,
                                })
                              }
                              className="rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-600 hover:bg-slate-50"
                              title={t('git.compareCommitTooltip')}
                            >
                              {t('git.diff')}
                            </button>
                          ) : null}
                          {canWrite && activePath ? (
                            <button
                              type="button"
                              disabled={versionActionsDisabled}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    t('git.restoreConfirm', {
                                      path: activePath,
                                      revision: commit.shortHash,
                                    }),
                                  )
                                ) {
                                  void restoreFile({ path: activePath, revision: commit.hash });
                                }
                              }}
                              className="rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              title={t('git.restoreFileTooltip')}
                            >
                              {t('git.restoreFile')}
                            </button>
                          ) : null}
                          {canWrite ? (
                            <button
                              type="button"
                              disabled={versionActionsDisabled}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    t('git.revertConfirm', { hash: commit.shortHash }),
                                  )
                                ) {
                                  void revertCommit(commit.hash);
                                }
                              }}
                              className="rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                              title={t('git.revertCommitTooltip')}
                            >
                              {t('git.revertCommit')}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={toggleAudit}
                  aria-expanded={auditOpen}
                  title={auditOpen ? t('git.auditHide') : t('git.auditShow')}
                  className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                >
                  {auditOpen ? (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  )}
                  {t('git.audit')}
                </button>
                {auditOpen ? (
                  <button
                    type="button"
                    onClick={() => void loadAudit({ limit: 50 })}
                    className="shrink-0 rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:text-slate-800"
                    title={t('git.auditRefresh')}
                    aria-label={t('git.auditRefresh')}
                  >
                    <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {auditOpen ? (
                auditLogs.length === 0 ? (
                  <p className="mt-1.5 text-[10px] text-slate-500">{t('git.auditEmpty')}</p>
                ) : (
                  <ul className="mt-1 space-y-0.5">
                    {auditLogs.slice(0, 60).map((log) => (
                      <li
                        key={log.id}
                        className="rounded border border-slate-100 px-1.5 py-1 text-[9.5px] text-slate-600"
                      >
                        <p className="flex items-center justify-between gap-1">
                          <span className="font-medium text-slate-700">{log.action}</span>
                          <span className="shrink-0 text-slate-400">{shortDate(log.createdAt)}</span>
                        </p>
                        <p className="truncate text-[9px] text-slate-500" title={log.targetPath ?? ''}>
                          {log.actorName}
                          {log.targetPath ? ` · ${log.targetPath}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </section>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] text-slate-500">
        {currentUser
                    ? `${currentUser.displayName} · ${roleLabel(currentUser.role)}`
          : t('git.identityLoading')}
        {' · '}
        {t('git.localOnly')}
      </div>
    </div>
  );
}
