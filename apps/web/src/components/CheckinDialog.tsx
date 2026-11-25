import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileDiff, Lock, ShieldCheck, X } from 'lucide-react';
import type { FileLock } from '../services/git-api';
import { useGitStore } from '../store/git-store';
import { DiffViewer } from './DiffViewer';
import { useI18n } from '../i18n/index.js';

export interface CheckinCandidate {
  path: string;
  lock: FileLock;
  label?: string;
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
}

export function CheckinDialog({
  open,
  candidates,
  onClose,
  assignedPaths = [],
  onConfirm,
  onStrictValidate,
}: CheckinDialogProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completeAssignments, setCompleteAssignments] = useState(true);
  const diff = useGitStore((state) => state.diff);
  const gitError = useGitStore((state) => state.error);
  const diffLoading = useGitStore((state) => state.diffLoading);
  const loadDiff = useGitStore((state) => state.loadDiff);

  useEffect(() => {
    if (!open) return;
    const paths = candidates.map((item) => item.path);
    setSelected(paths);
    setPreviewPath(paths[0] ?? null);
    setMessage('');
    setSubmitting(false);
    setCompleteAssignments(true);
  }, [open, candidates]);

  useEffect(() => {
    if (!open || !previewPath) return;
    void loadDiff({ path: previewPath, from: 'HEAD' });
  }, [open, previewPath, loadDiff]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const assignedSet = useMemo(() => new Set(assignedPaths), [assignedPaths]);
  const selectedAssignedCount = useMemo(
    () => selected.filter((path) => assignedSet.has(path)).length,
    [selected, assignedSet],
  );
  const canSubmit = selected.length > 0 && message.trim().length > 0 && !submitting;

  if (!open) return null;

  const toggle = (path: string) => {
    setSelected((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('checkin.aria')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
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
            disabled={submitting}
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
                candidates.map((item) => (
                  <div
                    key={item.path}
                    className={`mb-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
                      previewPath === item.path
                        ? 'border-blue-200 bg-blue-50/60'
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
                        {item.lock.userName}
                      </span>
                    </button>
                    <FileDiff className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                  </div>
                ))
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

            {/* A check-in is rejected when one of the selected files cannot be saved first
                (missing check-out lock). Without this the dialog just stayed open. */}
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
                disabled={selected.length === 0 || submitting}
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
              disabled={submitting}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
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
