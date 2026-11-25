import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { WorkbenchAlert } from '../store/editor-store/types.js';

export interface WorkbenchAlertBannerProps {
  alert: WorkbenchAlert;
  /** A recovery action (check-out + save) is already running. */
  busy?: boolean;
  onDismiss: () => void;
  onAction?: () => void;
}

/**
 * Sticky banner for problems that used to be invisible: a save rejected by the API (missing
 * check-out lock) or a map edit blocked by someone else's lock. The status text alone is only
 * rendered into a screen-reader region, so a rejected write looked like nothing happened.
 */
export function WorkbenchAlertBanner({
  alert,
  busy = false,
  onDismiss,
  onAction,
}: WorkbenchAlertBannerProps) {
  const { t } = useI18n();
  const tone =
    alert.tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  return (
    <div
      role="alert"
      className={`flex shrink-0 items-start gap-2 border-b px-3 py-1.5 text-[11px] ${tone}`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-relaxed break-words">{alert.message}</p>
      {alert.action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          title={t('lock.checkoutAndSaveHint')}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-current/30 bg-white/70 px-2 py-0.5 text-[10.5px] font-medium hover:bg-white disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : null}
          {t('lock.checkoutAndSave')}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        title={t('lock.dismissAlert')}
        aria-label={t('lock.dismissAlert')}
        className="shrink-0 rounded p-0.5 hover:bg-white/70"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
