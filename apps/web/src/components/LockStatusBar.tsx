import { FileCheck2, Lock, LockOpen, ShieldAlert, Unlock } from 'lucide-react';
import type { FileEditability } from '../services/lock-helpers';
import type { FileLock } from '../services/git-api';
import { formatDateTime, useI18n } from '../i18n/index.js';

export interface LockStatusBarProps {
  filePath: string | null;
  editability: FileEditability;
  lock: FileLock | null;
  busy: boolean;
  canCheckin: boolean;
  onCheckout: () => void;
  onRelease: () => void;
  onCancelCheckout: () => void;
  onOpenCheckin: () => void;
  onForceUnlock: () => void;
  /**
   * `bar` — full-width status strip with its own chrome border (standalone use).
   * `inline` — compact cluster that lives inside the editor action row.
   */
  variant?: 'bar' | 'inline';
}

const stateStyles: Record<FileEditability['state'], string> = {
  admin: 'border-blue-200 bg-blue-50/70 text-blue-800',
  viewer: 'border-slate-200 bg-slate-50 text-slate-600',
  unlocked: 'border-amber-200 bg-amber-50/70 text-amber-800',
  owned: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  'locked-by-other': 'border-rose-200 bg-rose-50/70 text-rose-800',
};

export function LockStatusBar({
  filePath,
  editability,
  lock,
  busy,
  canCheckin,
  onCheckout,
  onRelease,
  onCancelCheckout,
  onOpenCheckin,
  onForceUnlock,
  variant = 'bar',
}: LockStatusBarProps) {
  const { t, locale } = useI18n();
  if (!filePath) return null;
  const showCheckout =
    editability.state === 'unlocked' || editability.state === 'locked-by-other';
  const showOwnerActions = editability.state === 'owned' || (editability.state === 'admin' && lock);

  return (
    <div
      className={
        variant === 'inline'
          ? `flex min-w-0 max-w-full items-center gap-1.5 rounded border px-1.5 py-[2px] text-[10.5px] ${stateStyles[editability.state]}`
          : `flex h-8 shrink-0 items-center justify-between gap-2 border-b px-3 text-[11px] ${stateStyles[editability.state]}`
      }
      role="status"
      aria-live="polite"
      title={editability.reason}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {editability.state === 'owned' ? (
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : editability.state === 'locked-by-other' ? (
          <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <LockOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span className="shrink-0 font-semibold">
          {editability.state === 'owned'
            ? t('lock.state.owned')
            : editability.state === 'locked-by-other'
              ? t('lock.state.other')
              : editability.state === 'admin'
                ? t('lock.state.admin')
                : editability.state === 'viewer'
                  ? t('lock.state.viewer')
                  : t('lock.state.unlocked')}
        </span>
        <span className={variant === 'inline' ? 'sr-only' : 'truncate text-current/80'}>
          {editability.reason}
        </span>
        {lock && variant === 'bar' ? (
          <span className="hidden shrink-0 text-current/60 md:inline">
            {formatDateTime(lock.updatedAt, locale)}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {showCheckout ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCheckout}
            className="inline-flex items-center gap-1 rounded border border-current/25 bg-white/80 px-2 py-0.5 font-medium hover:bg-white disabled:opacity-50"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            {busy ? t('lock.busy') : t('lock.checkout')}
          </button>
        ) : null}
        {showOwnerActions && editability.state === 'owned' ? (
          <>
            <button
              type="button"
              disabled={busy || !canCheckin}
              onClick={onOpenCheckin}
              className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              title={canCheckin ? t('lock.checkinTitle') : t('lock.checkinDisabled')}
            >
              <FileCheck2 className="h-3 w-3" aria-hidden="true" />
              {t('lock.checkin')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelCheckout}
              className="inline-flex items-center gap-1 rounded border border-current/25 bg-white/80 px-2 py-0.5 hover:bg-white disabled:opacity-50"
              title={t('lock.cancelTitle')}
            >
              <Unlock className="h-3 w-3" aria-hidden="true" />
              {t('lock.cancelCheckout')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRelease}
              className="rounded border border-current/25 bg-white/80 px-2 py-0.5 hover:bg-white disabled:opacity-50"
              title={t('lock.releaseTitle')}
            >
              {t('lock.release')}
            </button>
          </>
        ) : null}
        {editability.state === 'admin' && lock ? (
          <button
            type="button"
            disabled={busy}
            onClick={onForceUnlock}
            className="inline-flex items-center gap-1 rounded border border-rose-300 bg-white px-2 py-0.5 font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            title={t('lock.forceTitle')}
          >
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            {t('lock.force')}
          </button>
        ) : null}
        {editability.state === 'locked-by-other' && lock ? (
          <span className="text-current/70">{t('lock.needRelease', { name: lock.userName })}</span>
        ) : null}
      </div>
    </div>
  );
}
