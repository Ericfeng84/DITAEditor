import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Settings } from 'lucide-react';
import type { IdentityResponse, IdentityUser } from '../services/identity-api';
import { useHelpCenterStore } from '../store/help-center-store';
import { useI18n } from '../i18n/index.js';
import { IdentitySwitcher } from './IdentitySwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';

export interface SessionSettingsMenuProps {
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onChangeIdentity: (userId: string) => void;
  /** Trigger test id — one per surface so screens keep their existing anchors. */
  testId?: string;
  menuTestId?: string;
  /** Optional override for the menu's accessible name. */
  menuAriaLabel?: string;
}

/**
 * Session chrome (identity, interface language, help center) behind one gear.
 *
 * Every workbench surface already spends its header pixels on document state, so these three
 * controls must look and behave identically in the editor, the translation center and the review
 * workbench: one trigger, one popover, one dismissal contract (outside pointerdown or Escape).
 */
export function SessionSettingsMenu({
  identity,
  currentUser,
  onChangeIdentity,
  testId,
  menuTestId,
  menuAriaLabel,
}: SessionSettingsMenuProps) {
  const { t } = useI18n();
  const openHelp = useHelpCenterStore((state) => state.open);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.settings.aria')}
        title={t('header.settings.title')}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          open
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Settings className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={menuAriaLabel ?? t('header.settings.title')}
          data-testid={menuTestId}
          className="absolute right-0 top-full z-50 mt-1 min-w-[280px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 rounded px-1 py-1">
            <span className="text-[11px] font-medium text-slate-500">
              {t('header.settings.identity')}
            </span>
            <IdentitySwitcher
              identity={identity}
              currentUser={currentUser}
              onChange={onChangeIdentity}
            />
          </div>
          <div className="flex items-center justify-between gap-2 rounded px-1 py-1">
            <span className="text-[11px] font-medium text-slate-500">
              {t('header.settings.language')}
            </span>
            <LocaleSwitcher />
          </div>
          <div className="my-1 h-px bg-slate-100" aria-hidden="true" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              openHelp();
            }}
            title={t('help.openTitle')}
            aria-label={t('help.openAria')}
            className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-800"
          >
            <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('header.settings.help')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
