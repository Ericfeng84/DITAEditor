import { EyeOff, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import type { FileLock } from '../services/git-api';
import type { FileEditability } from '../services/lock-helpers';
import { useI18n } from '../i18n/index.js';

export interface ReadOnlyBannerProps {
  /** Projection of the check-out rules for the open file. Editability is always false here. */
  editability: FileEditability;
  lock: FileLock | null;
  busy: boolean;
  onCheckout: () => void;
  /** Re-reads the lock list, e.g. after the holder released or checked in elsewhere. */
  onRefresh: () => void;
}

const toneStyles: Record<'unlocked' | 'locked-by-other' | 'viewer', string> = {
  // "Not checked out" is actionable rather than an error, so it stays calm and blue.
  unlocked: 'border-blue-200 bg-blue-50/90 text-blue-900',
  'locked-by-other': 'border-rose-200 bg-rose-50/90 text-rose-900',
  viewer: 'border-slate-200 bg-slate-100/90 text-slate-700',
};

/**
 * Read-only banner pinned above the editing surface.
 *
 * Without it a writer who opens a topic they have not checked out (or one somebody else holds)
 * simply finds an inert canvas: the lock chip in the document toolbar is small, and the map
 * overview / source-only layouts did not surface it at all. The banner always names the reason
 * and offers the next step — check out, wait for the holder, or just re-read the lock list.
 *
 * It renders nothing while the file is editable, so admins, the lock owner and the in-memory
 * demo workspace keep the full-height canvas.
 */
export function ReadOnlyBanner({
  editability,
  lock,
  busy,
  onCheckout,
  onRefresh,
}: ReadOnlyBannerProps) {
  const { t } = useI18n();
  if (editability.editable) return null;

  const state =
    editability.state === 'locked-by-other' || editability.state === 'viewer'
      ? editability.state
      : 'unlocked';
  const blockedByOther = state === 'locked-by-other';
  const ownerName = lock?.userName || lock?.userId || t('lock.state.other');
  const Icon = state === 'viewer' ? EyeOff : blockedByOther ? ShieldAlert : Lock;

  return (
    <div
      role="status"
      aria-live="polite"
      title={editability.reason}
      className={`flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[11.5px] ${toneStyles[state]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="shrink-0 rounded border border-current/20 bg-white/70 px-1.5 py-[1px] text-[10px] font-semibold tracking-wide">
        {t('lock.readOnlyTitle')}
      </span>
      <span className="min-w-0 truncate font-medium">{editability.reason}</span>
      {blockedByOther ? (
        <span className="hidden shrink-0 text-current/70 md:inline">
          {t('lock.needRelease', { name: ownerName })}
        </span>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {state === 'unlocked' || blockedByOther ? (
          <button
            type="button"
            disabled={busy || blockedByOther}
            onClick={onCheckout}
            title={blockedByOther ? t('lock.needRelease', { name: ownerName }) : undefined}
            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            {busy ? t('lock.busy') : t('lock.checkout')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          title={t('lock.refresh')}
          aria-label={t('lock.refresh')}
          className="inline-flex items-center gap-1 rounded border border-current/25 bg-white/80 px-1.5 py-0.5 hover:bg-white"
        >
          <RefreshCw
            className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
