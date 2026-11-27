import { useEffect, useRef, useState } from 'react';
import { FileCheck2, Lock, LockOpen, ShieldAlert, Undo2 } from 'lucide-react';
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
  // "Not checked out" is a neutral state, not a warning: keep it grey so the row never
  // reads as an error and the actionable "检出" button carries the emphasis.
  unlocked: 'border-slate-300 bg-white/80 text-slate-700',
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
  if (variant === 'inline') {
    // A four-button lock row forced the visual sub-header to wrap; the inline form is now one
    // state icon whose menu carries the same verbs (see `InlineLockMenu`).
    return (
      <InlineLockMenu
        editability={editability}
        lock={lock}
        busy={busy}
        canCheckin={canCheckin}
        onCheckout={onCheckout}
        onRelease={onRelease}
        onCancelCheckout={onCancelCheckout}
        onOpenCheckin={onOpenCheckin}
        onForceUnlock={onForceUnlock}
      />
    );
  }
  const showCheckout =
    editability.state === 'unlocked' ||
    (editability.state === 'locked-by-other' && !editability.canForceUnlock);
  const showOwnerActions = editability.state === 'owned' || (editability.state === 'admin' && lock);

  return (
    <div
      className={`flex h-8 shrink-0 items-center justify-between gap-2 border-b px-3 text-[11px] ${stateStyles[editability.state]}`}
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
        <span className="truncate text-current/80">{editability.reason}</span>
        {lock ? (
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
              {/* Undo2 vs LockOpen keeps "取消检出" and "释放" visually distinct. */}
              <Undo2 className="h-3 w-3" aria-hidden="true" />
              {t('lock.cancelCheckout')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRelease}
              className="rounded border border-current/25 bg-white/80 px-2 py-0.5 hover:bg-white disabled:opacity-50"
              title={t('lock.release')}
            >
              {t('lock.release')}
            </button>
          </>
        ) : null}
        {editability.canForceUnlock ? (
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
        {editability.state === 'locked-by-other' && lock && !editability.canForceUnlock ? (
          <span className="text-current/70">{t('lock.needRelease', { name: lock.userName })}</span>
        ) : null}
      </div>
    </div>
  );
}

interface InlineLockMenuProps {
  editability: FileEditability;
  lock: FileLock | null;
  busy: boolean;
  canCheckin: boolean;
  onCheckout: () => void;
  onRelease: () => void;
  onCancelCheckout: () => void;
  onOpenCheckin: () => void;
  onForceUnlock: () => void;
}

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] font-medium transition-colors';

/**
 * Inline lock affordance for the visual sub-header: one state icon that opens a menu holding the
 * status summary and the same verbs the full bar exposes. Keeping the verbs behind a menu stops the
 * sub-header from wrapping to a second row on narrow documents.
 */
function InlineLockMenu({
  editability,
  lock,
  busy,
  canCheckin,
  onCheckout,
  onRelease,
  onCancelCheckout,
  onOpenCheckin,
  onForceUnlock,
}: InlineLockMenuProps) {
  const { t, locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Transient menu: outside pointer or Escape closes it, so it can never cover the canvas.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const stateLabel =
    editability.state === 'owned'
      ? t('lock.state.owned')
      : editability.state === 'locked-by-other'
        ? t('lock.state.other')
        : editability.state === 'admin'
          ? t('lock.state.admin')
          : editability.state === 'viewer'
            ? t('lock.state.viewer')
            : t('lock.state.unlocked');
  const showCheckout =
    editability.state === 'unlocked' ||
    (editability.state === 'locked-by-other' && !editability.canForceUnlock);
  const showOwnerActions = editability.state === 'owned' || (editability.state === 'admin' && lock);
  const run = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="lock-status-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={stateLabel}
        title={editability.reason}
        onClick={() => setMenuOpen((open) => !open)}
        className={`inline-flex items-center justify-center rounded border px-1.5 py-[3px] transition-colors ${stateStyles[editability.state]} ${busy ? 'opacity-60' : ''} ${menuOpen ? 'ring-2 ring-blue-500/40' : ''}`}
      >
        {editability.state === 'owned' ? (
          <Lock className={`h-3 w-3 shrink-0 ${busy ? 'animate-pulse' : ''}`} aria-hidden="true" />
        ) : editability.state === 'locked-by-other' ? (
          <ShieldAlert
            className={`h-3 w-3 shrink-0 ${busy ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
        ) : (
          <LockOpen
            className={`h-3 w-3 shrink-0 ${busy ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
        )}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          data-testid="lock-status-menu"
          aria-label={stateLabel}
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <div className="mb-1 rounded border border-slate-200 bg-slate-50/80 px-1.5 py-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
              {editability.state === 'owned' ? (
                <Lock className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : editability.state === 'locked-by-other' ? (
                <ShieldAlert className="h-3 w-3 shrink-0 text-rose-600" aria-hidden="true" />
              ) : (
                <LockOpen className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
              )}
              <span>{stateLabel}</span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{editability.reason}</p>
            {lock ? (
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                {formatDateTime(lock.updatedAt, locale)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col">
            {showCheckout ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={run(onCheckout)}
                className={`${MENU_ITEM_CLASS} text-slate-700 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50`}
              >
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {busy ? t('lock.busy') : t('lock.checkout')}
              </button>
            ) : null}

            {showOwnerActions && editability.state === 'owned' ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy || !canCheckin}
                  onClick={run(onOpenCheckin)}
                  title={canCheckin ? t('lock.checkinTitle') : t('lock.checkinDisabled')}
                  className={`${MENU_ITEM_CLASS} text-emerald-700 hover:bg-emerald-50 disabled:opacity-40`}
                >
                  <FileCheck2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {t('lock.checkin')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={run(onCancelCheckout)}
                  title={t('lock.cancelTitle')}
                  className={`${MENU_ITEM_CLASS} text-slate-700 hover:bg-slate-100 disabled:opacity-50`}
                >
                  <Undo2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {t('lock.cancelCheckout')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={run(onRelease)}
                  className={`${MENU_ITEM_CLASS} text-slate-700 hover:bg-slate-100 disabled:opacity-50`}
                >
                  <LockOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {t('lock.release')}
                </button>
              </>
            ) : null}

            {editability.canForceUnlock ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={run(onForceUnlock)}
                title={t('lock.forceTitle')}
                className={`${MENU_ITEM_CLASS} text-rose-700 hover:bg-rose-50 disabled:opacity-50`}
              >
                <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
                {t('lock.force')}
              </button>
            ) : null}

            {editability.state === 'locked-by-other' && lock && !editability.canForceUnlock ? (
              <p className="px-1.5 py-1 text-[10.5px] leading-snug text-slate-500">
                {t('lock.needRelease', { name: lock.userName })}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
