import { AlertTriangle, Download, Upload, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { ContentConflict } from '../store/editor-store/types.js';

export interface ContentConflictBannerProps {
  conflict: ContentConflict;
  busy?: boolean;
  onReload: () => void;
  onOverwrite: () => void;
  onDismiss: () => void;
}

/**
 * Phase 13 optimistic-concurrency banner.
 *
 * The shared work dir must never lose a write silently: when `PUT /api/files/content` answers
 * `409 files.staleContent` the buffer stays untouched and this banner makes the user pick
 * between the newer server version and an explicit overwrite.
 */
export function ContentConflictBanner({
  conflict,
  busy = false,
  onReload,
  onOverwrite,
  onDismiss,
}: ContentConflictBannerProps) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-950"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        <p className="font-semibold">{t('contentConflict.title')}</p>
        <p className="break-words">{conflict.message}</p>
      </div>
      <button
        type="button"
        onClick={onReload}
        disabled={busy}
        title={t('contentConflict.reloadHint')}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-current/30 bg-white px-2 py-0.5 text-[10.5px] font-medium hover:bg-white/70 disabled:opacity-50"
      >
        <Download className="h-3 w-3" aria-hidden="true" />
        {t('contentConflict.reload')}
      </button>
      <button
        type="button"
        onClick={onOverwrite}
        disabled={busy}
        title={t('contentConflict.overwriteHint')}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-current/30 bg-white px-2 py-0.5 text-[10.5px] font-medium hover:bg-white/70 disabled:opacity-50"
      >
        <Upload className="h-3 w-3" aria-hidden="true" />
        {t('contentConflict.overwrite')}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        title={t('contentConflict.dismiss')}
        aria-label={t('contentConflict.dismiss')}
        className="shrink-0 rounded p-0.5 hover:bg-white/70"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );
}
