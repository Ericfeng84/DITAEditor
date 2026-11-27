import { BookOpen, CircleHelp, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { IdentityResponse, IdentityUser } from '../services/identity-api';
import { IdentitySwitcher } from '../components/IdentitySwitcher';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { DesktopSettingsButton } from '../desktop/DesktopSettingsDialog.js';
import { useHelpCenterStore } from '../store/help-center-store.js';

export interface HubHeaderProps {
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onSwitchIdentity: (userId: string) => void;
  onRefresh: () => void;
  loading: boolean;
  offline: boolean;
}

export function HubHeader({
  identity,
  currentUser,
  onSwitchIdentity,
  onRefresh,
  loading,
  offline,
}: HubHeaderProps) {
  const { t } = useI18n();
  const openHelp = useHelpCenterStore((state) => state.open);
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white shadow-xs">
            D
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5 text-[13px] font-bold tracking-tight text-slate-900">
              DITAEditor
              <span className="rounded bg-slate-100 px-1 py-[1px] font-mono text-[9px] font-semibold text-slate-500">
                DITA 1.3
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10.5px] font-medium text-slate-400">
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {t('workbench.title')}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {offline ? (
            <span className="hidden rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 sm:inline">
              {t('workbench.offlineTitle')}
            </span>
          ) : null}
          <button
            type="button"
            onClick={openHelp}
            aria-label={t('help.openAria')}
            title={t('help.openTitle')}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
            {t('help.open')}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={t('workbench.refreshAria')}
            title={t('workbench.refresh')}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <DesktopSettingsButton />
          <IdentitySwitcher identity={identity} currentUser={currentUser} onChange={onSwitchIdentity} />
          <LocaleSwitcher />
        </div>
      </div>
    </header>
  );
}
