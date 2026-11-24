import { Loader2, Send, UserPlus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { roleLabel, type IdentityUser } from '../services/identity-api';

export interface DelegateTopicDialogProps {
  open: boolean;
  mode: 'create' | 'reassign';
  topicPath: string;
  topicTitle: string | null;
  branch: string | null;
  candidates: IdentityUser[];
  initialAssigneeId?: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { assigneeId: string; note: string; dueDate: string | null }) => void;
}

export function DelegateTopicDialog({
  open,
  mode,
  topicPath,
  topicTitle,
  branch,
  candidates,
  initialAssigneeId,
  busy,
  error,
  onClose,
  onSubmit,
}: DelegateTopicDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setAssigneeId(initialAssigneeId ?? candidates[0]?.id ?? '');
      setNote('');
      setDueDate('');
      setValidation(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, initialAssigneeId, candidates]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!assigneeId) {
      setValidation(t('assignments.dialogAssigneeRequired'));
      return;
    }
    onSubmit({ assigneeId, note: note.trim(), dueDate: dueDate || null });
    dialogRef.current?.close('ok');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {t('assignments.dialogTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('assignments.dialogSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('assignments.dialogCancel')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 p-5 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t('assignments.dialogTopic')}
          </div>
          <div className="truncate text-[12px] font-semibold text-slate-800">
            {topicTitle ?? topicPath}
          </div>
          <div className="truncate font-mono text-[10.5px] text-slate-500">{topicPath}</div>
          {branch ? (
            <div className="mt-1 text-[10.5px] text-slate-500">
              {t('assignments.dialogBranchHint', { branch })}
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="delegate-assignee" className="mb-1 block font-medium text-slate-700">
            {t('assignments.dialogAssignee')}
          </label>
          {candidates.length === 0 ? (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              {t('assignments.dialogNoCandidates')}
            </p>
          ) : (
            <select
              id="delegate-assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">{t('assignments.dialogAssigneePlaceholder')}</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {roleLabel(user.role)}
                </option>
              ))}
            </select>
          )}
        </div>

        {mode === 'create' ? (
          <>
            <div>
              <label htmlFor="delegate-note" className="mb-1 block font-medium text-slate-700">
                {t('assignments.dialogNote')}
              </label>
              <textarea
                id="delegate-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t('assignments.dialogNotePlaceholder')}
                rows={2}
                className="w-full resize-none rounded-md border border-slate-300 px-2 py-1.5 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="delegate-due" className="mb-1 block font-medium text-slate-700">
                {t('assignments.dialogDueDate')}
              </label>
              <input
                id="delegate-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 px-2 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </>
        ) : null}

        {validation ?? error ? (
          <p role="alert" className="rounded-md bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
            {validation ?? error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('assignments.dialogCancel')}
          </button>
          <button
            type="submit"
            disabled={busy || candidates.length === 0}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : mode === 'create' ? (
              <Send className="h-3 w-3" aria-hidden="true" />
            ) : (
              <UserPlus className="h-3 w-3" aria-hidden="true" />
            )}
            {mode === 'create'
              ? t('assignments.dialogSubmit')
              : t('assignments.dialogReassignSubmit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
