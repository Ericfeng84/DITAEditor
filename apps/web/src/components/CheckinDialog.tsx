import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileDiff,
  GitCommitHorizontal,
  Lock,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  validateDitaFileForCheckin,
  type CheckinFileInput,
  type CheckinValidationIssue,
} from '@dita/core';
import type { FileLock } from '../services/git-api';
import type { WorkspaceDiagnostic } from '../services/workspace-api';
import { useGitStore } from '../store/git-store';
import { DiffViewer } from './DiffViewer';
import { useI18n } from '../i18n/index.js';

/**
 * A check-in preflight issue. `source` is wider than core's `CheckinValidationIssue` because
 * cross-file diagnostics (keyref/conref/map-ref) are merged in from the workspace indexer.
 */
export type CheckinIssue = Omit<CheckinValidationIssue, 'source'> & {
  source: WorkspaceDiagnostic['source'];
};

export interface CheckinCandidate {
  path: string;
  /** Absent for drafts that never took a check-out (new file, rename, delete). */
  lock?: FileLock;
  label?: string;
}

/**
 * Check-in preflight issues, keyed by candidate path.
 *
 * Live editor buffers win over the indexer: a draft that is open in a tab is validated from its
 * in-memory XML (the unsaved truth), and only cross-file diagnostics (keyref/conref/map-ref) are
 * merged in from the workspace scan. Closed drafts fall back to the indexed diagnostics.
 */
export interface CheckinIssueSources {
  candidates: string[];
  /** Live XML of open tabs, by path. */
  openXml?: Record<string, string | undefined>;
  /** Drafts from the overlay (`userDrafts`), used to skip deletes/binaries. */
  drafts?: { filePath: string; op: string; isBinary?: boolean }[];
  /** Workspace-wide semantic diagnostics (indexer view of the user overlay). */
  diagnostics?: WorkspaceDiagnostic[];
  locale: 'zh-CN' | 'en';
}

/** Diagnostic sources that only the cross-file indexer can produce. */
const CROSS_FILE_SOURCES = new Set([
  'map-ref',
  'asset-ref',
  'keyref',
  'conref',
  'conref-cycle',
]);

/**
 * Sources whose `error` severity really blocks a check-in. This mirrors `@dita/core`'s
 * `validateDitaFileForCheckin` (single-file XML / structure / DITAVAL gate).
 *
 * Cross-file reference diagnostics (`keyref`, `conref`, `conref-cycle`, `map-ref`, `asset-ref`)
 * are always presented as non-blocking warnings, even when the semantic indexer reports them with
 * `severity: 'error'`, so parallel team authoring can still check in and the dialog never diverges
 * from the backend gate.
 */
const BLOCKING_ERROR_SOURCES = new Set<string>(['xml', 'structure', 'ditaval']);

/** True only when the issue would actually be rejected by the server-side check-in gate. */
export function isBlockingCheckinIssue(issue: CheckinIssue): boolean {
  return issue.severity === 'error' && BLOCKING_ERROR_SOURCES.has(issue.source);
}

/** Per-file badge counts, classified exactly like the submit gate. */
export function countCheckinIssues(issues: CheckinIssue[]): { errors: number; warnings: number } {
  let errors = 0;
  for (const issue of issues) if (isBlockingCheckinIssue(issue)) errors += 1;
  return { errors, warnings: issues.length - errors };
}

function issueKey(issue: CheckinIssue): string {
  return `${issue.severity}|${issue.line}|${issue.column}|${issue.source}|${issue.message}`;
}

export function collectCheckinIssues(
  sources: CheckinIssueSources,
): Record<string, CheckinIssue[]> {
  const openXml = sources.openXml ?? {};
  const drafts = sources.drafts ?? [];
  const diagnostics = sources.diagnostics ?? [];
  const result: Record<string, CheckinIssue[]> = {};

  for (const path of sources.candidates) {
    const draft = drafts.find((item) => item.filePath === path);
    const xml = openXml[path];
    const issues: CheckinIssue[] = [];
    const seen = new Set<string>();
    const push = (issue: CheckinIssue) => {
      const key = issueKey(issue);
      if (seen.has(key)) return;
      seen.add(key);
      issues.push(issue);
    };

    if (draft?.op === 'delete' || draft?.isBinary) {
      result[path] = [];
      continue;
    }

    if (xml !== undefined && xml !== null) {
      const input: CheckinFileInput = { filePath: path, content: xml };
      for (const issue of validateDitaFileForCheckin(input, sources.locale)) {
        push({ ...issue, filePath: path });
      }
    }

    for (const diagnostic of diagnostics) {
      if (diagnostic.filePath !== path) continue;
      // Open buffers already ran the local structure check; keep only what needs the whole project.
      if (xml !== undefined && !CROSS_FILE_SOURCES.has(diagnostic.source)) continue;
      push({
        filePath: path,
        line: diagnostic.line,
        column: diagnostic.column,
        severity: diagnostic.severity,
        source: diagnostic.source,
        message: diagnostic.message,
      });
    }

    result[path] = issues;
  }

  return result;
}

/** Selected-only rollup used by the dialog (and by the tests). */
export function summarizeCheckinIssues(
  issuesByPath: Record<string, CheckinIssue[]>,
  selectedPaths: string[],
): { blockingErrors: CheckinIssue[]; warnings: CheckinIssue[] } {
  const blockingErrors: CheckinIssue[] = [];
  const warnings: CheckinIssue[] = [];
  for (const path of selectedPaths) {
    for (const issue of issuesByPath[path] ?? []) {
      if (isBlockingCheckinIssue(issue)) blockingErrors.push(issue);
      else warnings.push(issue);
    }
  }
  return { blockingErrors, warnings };
}

/** Single submit gate, so the badge, the tooltip and the button can never disagree. */
export function resolveCheckinSubmit(params: {
  selected: string[];
  message: string;
  busy: boolean;
  conflictingExternalPaths: string[];
  blockingErrors: CheckinIssue[];
}): { canSubmit: boolean; blockedReason: 'none' | 'errors' | 'external' | 'empty' | 'message' } {
  if (params.conflictingExternalPaths.length > 0) {
    return { canSubmit: false, blockedReason: 'external' };
  }
  if (params.blockingErrors.length > 0) return { canSubmit: false, blockedReason: 'errors' };
  if (params.selected.length === 0) return { canSubmit: false, blockedReason: 'empty' };
  if (params.message.trim().length === 0) return { canSubmit: false, blockedReason: 'message' };
  if (params.busy) return { canSubmit: false, blockedReason: 'none' };
  return { canSubmit: true, blockedReason: 'none' };
}

/**
 * "AI Fix" on a blocking issue: close the check-in dialog, then hand the issue to the workbench
 * (which opens the file and streams a fix proposal).
 */
export function applyCheckinAiFix(
  issue: CheckinIssue,
  handlers: { onAiFixIssue: (issue: CheckinIssue) => void; onClose: () => void },
): void {
  handlers.onClose();
  handlers.onAiFixIssue(issue);
}

export interface CheckinDialogProps {
  open: boolean;
  candidates: CheckinCandidate[];
  onClose: () => void;
  /**
   * Phase 10: topic paths that hold one of my active assignments. When any selected path is
   * in this list the dialog offers to close those assignments as part of the check-in.
   */
  assignedPaths?: string[];
  onConfirm: (
    paths: string[],
    message: string,
    options?: { completeMyAssignments: boolean },
  ) => Promise<boolean>;
  onStrictValidate?: (paths: string[]) => void;
  /** Preflight issues per candidate path (see `collectCheckinIssues`). */
  issuesByPath?: Record<string, CheckinIssue[]>;
  /** Validation in flight (live buffers / indexer refresh). */
  validating?: boolean;
  /** Jump the editor to the issue (line/column of the failing draft). */
  onJumpToIssue?: (issue: CheckinIssue) => void;
  /** Ask the AI to fix this blocking issue (the dialog closes first). */
  onAiFixIssue?: (issue: CheckinIssue) => void;
}

export function CheckinDialog({
  open,
  candidates,
  onClose,
  assignedPaths = [],
  onConfirm,
  onStrictValidate,
  issuesByPath = {},
  validating = false,
  onJumpToIssue,
  onAiFixIssue,
}: CheckinDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>(() =>
    open ? candidates.map((item) => item.path) : [],
  );
  const [message, setMessage] = useState('');
  const [previewPath, setPreviewPath] = useState<string | null>(() =>
    open ? (candidates[0]?.path ?? null) : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [completeAssignments, setCompleteAssignments] = useState(true);
  const [externalAction, setExternalAction] = useState<'none' | 'commit' | 'discard'>('none');
  const [externalCommitMsg, setExternalCommitMsg] = useState('');
  const [resolvingExternal, setResolvingExternal] = useState(false);

  const diff = useGitStore((state) => state.diff);
  const gitError = useGitStore((state) => state.error);
  const diffLoading = useGitStore((state) => state.diffLoading);
  const loadDiff = useGitStore((state) => state.loadDiff);
  const clearError = useGitStore((state) => state.clearError);
  const externalDirtyFiles = useGitStore((state) => state.externalDirtyFiles);
  const userDrafts = useGitStore((state) => state.userDrafts);
  const currentUser = useGitStore((state) => state.currentUser);
  const commitExternal = useGitStore((state) => state.commitExternal);
  const discardExternal = useGitStore((state) => state.discardExternal);

  useEffect(() => {
    if (!open) return;
    const paths = candidates.map((item) => item.path);
    setSelected(paths);
    setPreviewPath(paths[0] ?? null);
    setMessage('');
    setSubmitting(false);
    setCompleteAssignments(true);
    setExternalAction('none');
    setExternalCommitMsg('');
    setResolvingExternal(false);
    clearError();
  }, [open, candidates, clearError]);

  useEffect(() => {
    if (!open || !previewPath) return;
    void loadDiff({ path: previewPath, from: 'HEAD' });
  }, [open, previewPath, loadDiff]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const assignedSet = useMemo(() => new Set(assignedPaths), [assignedPaths]);
  const externalDirtySet = useMemo(() => {
    const set = new Set<string>();
    for (const file of externalDirtyFiles) {
      set.add(file.path);
      if (file.originalPath) set.add(file.originalPath);
    }
    return set;
  }, [externalDirtyFiles]);

  const draftOriginalByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const draft of userDrafts) {
      if (draft.originalPath) map.set(draft.filePath, draft.originalPath);
    }
    return map;
  }, [userDrafts]);

  const isPathExternallyDirty = (filePath: string): boolean => {
    if (externalDirtySet.has(filePath)) return true;
    const orig = draftOriginalByPath.get(filePath);
    return Boolean(orig && externalDirtySet.has(orig));
  };

  const conflictingExternalPaths = useMemo(
    () => selected.filter((path) => isPathExternallyDirty(path)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, externalDirtySet, draftOriginalByPath],
  );

  const selectedAssignedCount = useMemo(
    () => selected.filter((path) => assignedSet.has(path)).length,
    [selected, assignedSet],
  );
  const canWrite = currentUser?.role === 'admin' || currentUser?.role === 'writer';
  const busy = submitting || resolvingExternal;
  const { blockingErrors, warnings } = useMemo(
    () => summarizeCheckinIssues(issuesByPath, selected),
    [issuesByPath, selected],
  );
  const { canSubmit, blockedReason } = resolveCheckinSubmit({
    selected,
    message,
    busy,
    conflictingExternalPaths,
    blockingErrors,
  });
  const submitTitle =
    blockedReason === 'errors'
      ? t('checkin.blockedByErrors')
      : blockedReason === 'external'
        ? t('checkin.blockedByExternal')
        : undefined;

  const issuesFor = (path: string): CheckinIssue[] => issuesByPath[path] ?? [];

  if (!open) return null;

  const toggle = (path: string) => {
    setSelected((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    );
  };

  const handleCommitExternal = async () => {
    const commitMsg = externalCommitMsg.trim() || t('checkin.externalCommitDefault');
    setResolvingExternal(true);
    const ok = await commitExternal(commitMsg);
    setResolvingExternal(false);
    if (ok) {
      setExternalAction('none');
      setExternalCommitMsg('');
      if (previewPath) void loadDiff({ path: previewPath, from: 'HEAD' });
    }
  };

  const handleDiscardExternal = async () => {
    setResolvingExternal(true);
    const ok = await discardExternal();
    setResolvingExternal(false);
    if (ok) {
      setExternalAction('none');
      if (previewPath) void loadDiff({ path: previewPath, from: 'HEAD' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('checkin.aria')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex h-[80vh] w-[min(1180px,95vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('checkin.title')}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('checkin.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            aria-label={t('checkin.closeAria')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              {t('checkin.selectedCount', { selected: selected.length, total: candidates.length })}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {candidates.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] text-slate-500">
                  {t('checkin.noFiles')}
                </p>
              ) : (
                candidates.map((item) => {
                  const hasExternalConflict = isPathExternallyDirty(item.path);
                  return (
                    <div
                      key={item.path}
                      className={`mb-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
                        previewPath === item.path
                          ? 'border-blue-200 bg-blue-50/60'
                          : hasExternalConflict
                            ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                            : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(item.path)}
                        onChange={() => toggle(item.path)}
                        aria-label={t('checkin.selectAria', { path: item.path })}
                        className="h-3 w-3 accent-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewPath(item.path)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate font-medium text-slate-800">{item.path}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                          <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                          {item.lock?.userName ?? t('checkin.draftOnly')}
                        </span>
                        {(() => {
                          const { errors: errorCount, warnings: warningCount } = countCheckinIssues(
                            issuesFor(item.path),
                          );
                          if (errorCount > 0) {
                            return (
                              <span
                                data-testid={`checkin-badge-errors-${item.path}`}
                                className="mt-0.5 inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1 py-px text-[9.5px] font-semibold text-rose-700"
                              >
                                <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                {t('checkin.statusErrors', { count: errorCount })}
                              </span>
                            );
                          }
                          if (warningCount > 0) {
                            return (
                              <span
                                data-testid={`checkin-badge-warnings-${item.path}`}
                                className="mt-0.5 inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1 py-px text-[9.5px] font-semibold text-amber-700"
                              >
                                <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                {t('checkin.statusWarnings', { count: warningCount })}
                              </span>
                            );
                          }
                          return (
                            <span
                              data-testid={`checkin-badge-valid-${item.path}`}
                              className="mt-0.5 inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[9.5px] font-medium text-emerald-700"
                            >
                              {validating ? t('checkin.statusChecking') : t('checkin.statusValid')}
                            </span>
                          );
                        })()}
                      </button>
                      {hasExternalConflict ? (
                        <span title={t('checkin.externalBadgeTooltip')} className="shrink-0 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      ) : (
                        <FileDiff className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2 p-3">
            {previewPath ? (
              diff ? (
                <DiffViewer
                  oldText={diff.oldText}
                  newText={diff.newText}
                  fromLabel={diff.fromLabel}
                  toLabel={diff.toLabel}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 text-xs text-slate-500">
                  {diffLoading ? t('checkin.diffLoading') : t('checkin.diffHint')}
                </div>
              )
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                {t('checkin.noPreview')}
              </div>
            )}

            {/* Phase 13 UX: surface overlapping on-disk external edits directly inside the dialog
                with one-click commit/discard controls so users never hit a dead-end 409. */}
            {conflictingExternalPaths.length > 0 ? (
              <div
                role="alert"
                className="shrink-0 rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t('checkin.externalConflictTitle', { count: conflictingExternalPaths.length })}
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-amber-900/90">
                      {t('checkin.externalConflictBody', { total: externalDirtyFiles.length })}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {conflictingExternalPaths.map((filePath) => (
                        <code
                          key={filePath}
                          className="rounded border border-amber-200 bg-white/80 px-1.5 py-0.5 text-[10px] text-amber-900"
                        >
                          {filePath}
                        </code>
                      ))}
                    </div>

                    {canWrite ? (
                      <div className="mt-2">
                        {externalAction === 'none' ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setExternalCommitMsg(t('checkin.externalCommitDefault'));
                                setExternalAction('commit');
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-700 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                            >
                              <GitCommitHorizontal className="h-3 w-3" aria-hidden="true" />
                              {t('checkin.externalCommitBtn')}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setExternalAction('discard')}
                              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[10.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              {t('checkin.externalDiscardBtn')}
                            </button>
                          </div>
                        ) : externalAction === 'commit' ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              value={externalCommitMsg}
                              onChange={(event) => setExternalCommitMsg(event.target.value)}
                              disabled={resolvingExternal}
                              placeholder={t('checkin.externalCommitDefault')}
                              className="min-w-[220px] flex-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              disabled={resolvingExternal}
                              onClick={() => void handleCommitExternal()}
                              className="rounded-md bg-amber-700 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                            >
                              {resolvingExternal
                                ? t('checkin.externalResolving')
                                : t('checkin.externalCommitConfirm')}
                            </button>
                            <button
                              type="button"
                              disabled={resolvingExternal}
                              onClick={() => setExternalAction('none')}
                              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10.5px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10.5px] font-medium text-amber-950">
                              {t('checkin.externalDiscardAsk', { count: externalDirtyFiles.length })}
                            </span>
                            <button
                              type="button"
                              disabled={resolvingExternal}
                              onClick={() => void handleDiscardExternal()}
                              className="rounded-md bg-rose-600 px-2.5 py-1 text-[10.5px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              {resolvingExternal
                                ? t('checkin.externalResolving')
                                : t('checkin.externalDiscardConfirm')}
                            </button>
                            <button
                              type="button"
                              disabled={resolvingExternal}
                              onClick={() => setExternalAction('none')}
                              className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10.5px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Phase 14 preflight: a structure/XML error inside a selected draft blocks the commit,
                with one-click jump and AI fix so the user never has to leave the dialog blind. */}
            {blockingErrors.length > 0 ? (
              <div
                role="alert"
                data-testid="checkin-blocking-errors"
                className="shrink-0 rounded-lg border border-rose-300 bg-rose-50/90 px-3 py-2 text-[11px] text-rose-950"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {t('checkin.validationErrors', { count: blockingErrors.length })}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {blockingErrors.map((issue) => (
                        <li
                          key={`${issue.filePath}:${issue.line}:${issue.column}:${issue.message}`}
                          className="rounded border border-rose-200 bg-white/80 px-2 py-1"
                        >
                          <p className="truncate font-mono text-[10px] text-rose-900/80">
                            {issue.filePath}:{issue.line}:{issue.column}
                          </p>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-rose-950">
                            {issue.message}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {onJumpToIssue ? (
                              <button
                                type="button"
                                data-testid={`checkin-jump-${issue.filePath}`}
                                onClick={() => onJumpToIssue(issue)}
                                className="rounded border border-rose-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-rose-800 hover:bg-rose-100"
                              >
                                {t('checkin.jumpToSource')}
                              </button>
                            ) : null}
                            {onAiFixIssue ? (
                              <button
                                type="button"
                                data-testid={`checkin-ai-fix-${issue.filePath}`}
                                title={t('checkin.aiFixTooltip')}
                                onClick={() =>
                                  applyCheckinAiFix(issue, {
                                    onAiFixIssue,
                                    onClose,
                                  })
                                }
                                className="rounded border border-rose-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-rose-800 hover:bg-rose-100"
                              >
                                {t('checkin.aiFix')}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {blockingErrors.length === 0 && warnings.length > 0 ? (
              <div
                role="status"
                data-testid="checkin-warnings-only"
                className="flex shrink-0 items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950"
              >
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t('checkin.validationWarnings', { count: warnings.length })}
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-amber-900/90">
                    {t('checkin.warningsOnly')}
                  </p>
                </div>
              </div>
            ) : null}

            <label className="shrink-0">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">{t('checkin.messageLabel')}</span>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t('checkin.messagePlaceholder')}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>

            {selectedAssignedCount > 0 ? (
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={completeAssignments}
                  onChange={(event) => setCompleteAssignments(event.target.checked)}
                  className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                />
                {t('checkin.completeAssignments', { count: selectedAssignedCount })}
              </label>
            ) : null}

            {gitError ? (
              <p
                role="alert"
                className="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700"
              >
                {gitError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[10px] text-slate-500">
            {t('checkin.localOnly')}
          </span>
          <div className="flex items-center gap-2">
            {onStrictValidate ? (
              <button
                type="button"
                disabled={selected.length === 0 || busy}
                onClick={() => onStrictValidate(selected)}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                title={t('checkin.strictTooltip')}
              >
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {t('checkin.strict')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              data-testid="checkin-submit"
              disabled={!canSubmit}
              title={submitTitle}
              onClick={async () => {
                setSubmitting(true);
                const ok = await onConfirm(selected, message.trim(), {
                  completeMyAssignments: completeAssignments && selectedAssignedCount > 0,
                });
                setSubmitting(false);
                if (ok) onClose();
              }}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {submitting ? t('checkin.submitting') : t('checkin.submit', { count: selected.length })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
