import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GitMerge, Loader2, X } from 'lucide-react';
import { checkXmlWellFormed } from '@dita/core';
import { useI18n } from '../i18n/index.js';
import { useGitStore } from '../store/git-store';
import {
  fetchMergeConflict,
  fetchMergePreview,
  type MergeConflictContent,
  type MergePreview,
} from '../services/git-api';

export interface MergeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful merge so the shell can re-focus the now-changed branch. */
  onMerged?: (result: { sourceBranch: string; targetBranch: string; commit: string }) => void;
}

/** A merged document must still parse: the API rejects invalid XML with 422, so warn early. */
interface XmlCheck {
  ok: boolean;
  message: string;
}

function checkResolutionXml(xml: string): { ok: boolean; error: { line: number; column: number; message: string } | null } {
  const result = checkXmlWellFormed(xml, { position: true });
  if (result.ok) return { ok: true, error: null };
  const error = result.error;
  return { ok: false, error: { line: error.line, column: error.column, message: error.message } };
}

export function MergeDialog({ open, onClose, onMerged }: MergeDialogProps) {
  const { t } = useI18n();
  const branches = useGitStore((state) => state.branches);
  const branch = useGitStore((state) => state.branch);
  const currentUser = useGitStore((state) => state.currentUser);
  const loading = useGitStore((state) => state.loading);
  const merge = useGitStore((state) => state.merge);

  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeConflict, setActiveConflict] = useState<string | null>(null);
  const [conflictContent, setConflictContent] = useState<MergeConflictContent | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  // Default the selectors: merge *from* another branch *into* the current one.
  useEffect(() => {
    if (!open) return;
    const current = branch ?? branches.find((item) => item.current)?.name ?? '';
    setTarget(current);
    setSource(branches.find((item) => item.name !== current)?.name ?? '');
    setPreview(null);
    setPreviewError(null);
    setActiveConflict(null);
    setConflictContent(null);
    setResolutions({});
    setMessage('');
    setSubmitting(false);
  }, [open, branch, branches]);

  const loadPreview = useCallback(async () => {
    if (!source || !target || source === target) {
      setPreview(null);
      setPreviewError(t('merge.needBoth'));
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    try {
      const result = await fetchMergePreview(source, target);
      setPreview(result);
      setResolutions((current) => {
        const next: Record<string, string> = {};
        for (const conflict of result.conflicts) {
          const existing = current[conflict.path];
          if (existing !== undefined) next[conflict.path] = existing;
        }
        return next;
      });
      setActiveConflict(result.conflicts[0]?.path ?? null);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewing(false);
    }
  }, [source, target, t]);

  useEffect(() => {
    if (!open || !source || !target || source === target) return;
    void loadPreview();
  }, [open, source, target, loadPreview]);

  // Load ours/theirs content for the conflict the user is looking at.
  useEffect(() => {
    if (!open || !activeConflict || !preview) {
      setConflictContent(null);
      return;
    }
    let cancelled = false;
    setConflictLoading(true);
    void fetchMergeConflict(preview.sourceBranch, preview.targetBranch, activeConflict)
      .then((content) => {
        if (cancelled) return;
        setConflictContent(content);
        setResolutions((current) =>
          current[content.path] === undefined
            ? { ...current, [content.path]: content.ours ?? content.theirs ?? '' }
            : current,
        );
      })
      .catch(() => {
        if (!cancelled) setConflictContent(null);
      })
      .finally(() => {
        if (!cancelled) setConflictLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, activeConflict, preview]);

  const blockingLocks = preview?.blockingLocks ?? [];
  const conflicts = preview?.conflicts ?? [];
  const protectedTarget = preview?.protectedTarget === true && !isAdmin;
  // Every conflicting file needs a real, well-formed resolution before the merge can be committed.
  const needsResolution = conflicts.some((conflict) => {
    const value = resolutions[conflict.path];
    if ((value ?? '').trim() === '') return true;
    if (/\.(dita|ditamap|bookmap|ditaval|xml)$/i.test(conflict.path)) {
      return !checkResolutionXml(value!).ok;
    }
    return false;
  });
  const canSubmit =
    Boolean(preview) &&
    !preview?.alreadyUpToDate &&
    blockingLocks.length === 0 &&
    !protectedTarget &&
    !needsResolution &&
    !submitting &&
    !loading;

  const resolutionXml = useMemo<XmlCheck | null>(() => {
    if (!activeConflict || !conflictContent?.isXml) return null;
    const value = resolutions[activeConflict];
    if (value === undefined) return null;
    const checked = checkResolutionXml(value);
    if (checked.ok) return { ok: true, message: t('merge.xmlValid') };
    const error = checked.error;
    return {
      ok: false,
      message: t('merge.xmlInvalid', {
        line: error?.line ?? 0,
        column: error?.column ?? 0,
        message: error?.message ?? '',
      }),
    };
  }, [activeConflict, conflictContent, resolutions, t]);

  const handleMerge = async () => {
    if (!preview) return;
    setSubmitting(true);
    const payloadResolutions: Record<string, string> = {};
    for (const conflict of preview.conflicts) {
      const value = resolutions[conflict.path];
      if (value !== undefined) payloadResolutions[conflict.path] = value;
    }
    const result = await merge({
      sourceBranch: preview.sourceBranch,
      targetBranch: preview.targetBranch,
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(Object.keys(payloadResolutions).length > 0 ? { resolutions: payloadResolutions } : {}),
    });
    setSubmitting(false);
    if (result) {
      onMerged?.(result);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('merge.aria')}
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <GitMerge className="h-3.5 w-3.5" aria-hidden="true" />
              {t('merge.title')}
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t('merge.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('merge.closeAria')}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('merge.source')}
              </span>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-blue-400"
              >
                {branches.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('merge.target')}
              </span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] outline-none focus:border-blue-400"
              >
                {branches.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {previewError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
              {previewError}
            </div>
          ) : null}

          {previewing ? (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t('merge.previewing')}
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  {t('merge.aheadBehind', { ahead: preview.ahead, behind: preview.behind })}
                </span>
                {preview.canFastForward ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    {t('merge.canFastForward')}
                  </span>
                ) : null}
                {preview.alreadyUpToDate ? (
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                    {t('merge.upToDate')}
                  </span>
                ) : null}
                {preview.hasConflicts ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    {t('merge.conflicts', { count: conflicts.length })}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadPreview()}
                  className="ml-auto rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                >
                  {t('merge.recheck')}
                </button>
              </div>

              {protectedTarget ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                  {t('merge.protected')}
                </p>
              ) : null}

              {blockingLocks.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                  <p className="flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    {t('merge.blockingLocks', { count: blockingLocks.length })}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {blockingLocks.map((lock) => (
                      <li key={lock.id} className="truncate text-[10px]">
                        {lock.filePath} · {lock.userName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {conflicts.length === 0 ? (
                <p className="flex items-center gap-1 text-[11px] text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {t('merge.noConflicts')}
                </p>
              ) : (
                <div className="space-y-2">
                  <ul className="flex flex-wrap gap-1">
                    {conflicts.map((conflict) => (
                      <li key={conflict.path}>
                        <button
                          type="button"
                          onClick={() => setActiveConflict(conflict.path)}
                          title={t('merge.conflictSelect', { path: conflict.path })}
                          className={`rounded border px-1.5 py-0.5 text-[10px] ${
                            activeConflict === conflict.path
                              ? 'border-amber-400 bg-amber-100 text-amber-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {conflict.path}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {activeConflict ? (
                    <div className="rounded-lg border border-slate-200">
                      <p className="border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                        {t('merge.conflictTitle', { path: activeConflict })}
                      </p>
                      {conflictLoading ? (
                        <p className="px-2 py-1.5 text-[10px] text-slate-500">
                          {t('merge.conflictLoading')}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 p-2">
                          <div className="min-w-0">
                            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                              {t('merge.ours')}
                            </p>
                            <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-slate-50 p-1.5 text-[9.5px] leading-relaxed text-slate-700">
                              {conflictContent?.ours ?? '—'}
                            </pre>
                            <button
                              type="button"
                              onClick={() =>
                                setResolutions((current) => ({
                                  ...current,
                                  [activeConflict]: conflictContent?.ours ?? '',
                                }))
                              }
                              className="mt-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                            >
                              {t('merge.useOurs')}
                            </button>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                              {t('merge.theirs')}
                            </p>
                            <pre className="mt-0.5 max-h-40 overflow-auto rounded bg-slate-50 p-1.5 text-[9.5px] leading-relaxed text-slate-700">
                              {conflictContent?.theirs ?? '—'}
                            </pre>
                            <button
                              type="button"
                              onClick={() =>
                                setResolutions((current) => ({
                                  ...current,
                                  [activeConflict]: conflictContent?.theirs ?? '',
                                }))
                              }
                              className="mt-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                            >
                              {t('merge.useTheirs')}
                            </button>
                          </div>
                          <div className="col-span-2">
                            <label
                              className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400"
                              htmlFor="merge-resolution"
                            >
                              {t('merge.resolutionLabel')}
                            </label>
                            <textarea
                              id="merge-resolution"
                              value={resolutions[activeConflict] ?? ''}
                              onChange={(event) =>
                                setResolutions((current) => ({
                                  ...current,
                                  [activeConflict]: event.target.value,
                                }))
                              }
                              placeholder={t('merge.resolutionPlaceholder')}
                              spellCheck={false}
                              className="mt-0.5 h-40 w-full resize-y rounded border border-slate-300 bg-white p-1.5 font-mono text-[10px] leading-relaxed text-slate-800 outline-none focus:border-blue-400"
                            />
                            {resolutionXml ? (
                              <p
                                className={`mt-0.5 text-[10px] ${
                                  resolutionXml.ok ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {resolutionXml.message}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {t('merge.messageLabel')}
                </span>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t('merge.messagePlaceholder')}
                  className="rounded-md border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-blue-400"
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          {blockingLocks.length > 0 ? (
            <span className="mr-auto text-[10px] font-medium text-amber-800">{t('merge.blocked')}</span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleMerge()}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting || loading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <GitMerge className="h-3 w-3" aria-hidden="true" />
            )}
            {submitting ? t('merge.executing') : t('merge.execute')}
          </button>
        </div>
      </div>
    </div>
  );
}
