import { AlertTriangle, Loader2, Save, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../i18n/index.js';

export interface UnsavedChangesDialogProps {
  open: boolean;
  dirtyCount: number;
  saving: boolean;
  /** Why the last save-and-leave attempt did not finish (missing lock, read-only, network). */
  error?: string | null;
  onSaveAndLeave: () => void;
  onDiscardAndLeave: () => void;
  onCancel: () => void;
}

/**
 * Guard for leaving the editor session. Discarding is destructive, so it is a second,
 * explicit click inside the dialog rather than a checkbox.
 */
export function UnsavedChangesDialog({
  open,
  dirtyCount,
  saving,
  error = null,
  onSaveAndLeave,
  onDiscardAndLeave,
  onCancel,
}: UnsavedChangesDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-sm rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-start gap-2 border-b border-slate-100 px-5 py-3.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        <div>
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {t('workbench.leaveTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('workbench.leaveDescription')}</p>
        </div>
      </div>

      <div className="space-y-2 p-5 text-xs">
        <p className="rounded-md bg-slate-50 px-2 py-1.5 text-[11.5px] text-slate-600">
          {t('workbench.leaveDirty', { count: dirtyCount })}
        </p>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11.5px] font-medium text-rose-700"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onSaveAndLeave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3 w-3" aria-hidden="true" />
            )}
            {t('workbench.leaveSave')}
          </button>
          <button
            type="button"
            onClick={onDiscardAndLeave}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11.5px] font-medium text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            {t('workbench.leaveDiscard')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('workbench.leaveCancel')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
