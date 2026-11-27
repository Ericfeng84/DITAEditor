/**
 * Desktop-only settings dialog: storage folder switching plus the plugin/runtime install guide.
 *
 * Visibility lives in `useDesktopStore` so the Electron menu item (`CmdOrCtrl+,`), the workbench
 * headers and contextual hint buttons can all open the same dialog on a specific tab.
 */

import { useEffect, type ReactNode } from 'react';
import { FolderCog, Loader2, PlugZap, Settings2, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';
import { getDesktopBridge, hasMissingCoreTools, isDesktopApp } from '../services/desktop-bridge.js';
import { useDesktopStore, type DesktopSettingsTab } from '../store/desktop-store.js';
import { DesktopStorageTab } from './DesktopStorageTab.js';
import { DesktopPluginGuideTab } from './DesktopPluginGuideTab.js';

export interface DesktopSettingsDialogProps {
  /** Opens `AiSettingsDialog` on its parser tab (CLI commands, docling-serve URL). */
  onOpenParserSettings?: () => void;
}

const TABS: readonly { id: DesktopSettingsTab; icon: typeof FolderCog; labelKey: MessageKey }[] = [
  { id: 'storage', icon: FolderCog, labelKey: 'desktop.tab.storage' },
  { id: 'plugins', icon: PlugZap, labelKey: 'desktop.tab.plugins' },
];

/**
 * Compact header entry point (desktop shell only).
 *
 * The dot is the only ambient signal: amber when a core dependency (Git, DITA-OT or the Noto CJK
 * fonts) is missing — exactly when publishing / check-in would fail later — blue for a custom
 * data folder. In the browser this renders nothing at all.
 */
export function DesktopSettingsButton({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const status = useDesktopStore((state) => state.status);
  const env = useDesktopStore((state) => state.env);
  const openDialog = useDesktopStore((state) => state.openDialog);
  const desktop = isDesktopApp();

  useEffect(() => {
    if (!desktop) return;
    const state = useDesktopStore.getState();
    if (!state.status && !state.statusLoading) void state.refreshStatus();
    if (!state.env && !state.envLoading) void state.refreshEnvironment(false);
  }, [desktop]);

  if (!desktop) return null;

  const missing = hasMissingCoreTools(env);
  const decorated = Boolean(status?.isCustomDataDir || missing);

  return (
    <button
      type="button"
      onClick={() => openDialog('storage')}
      aria-label={t('desktop.headerButtonAria')}
      title={missing ? t('desktop.headerButtonMissing') : t('desktop.headerButtonAria')}
      data-testid="desktop-settings-button"
      className={`relative inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
        missing
          ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      } ${className}`}
    >
      {missing ? (
        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <FolderCog className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{t('desktop.headerButton')}</span>
      {decorated ? (
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ring-2 ring-white ${
            missing ? 'bg-amber-500' : 'bg-blue-500'
          }`}
        />
      ) : null}
    </button>
  );
}

/**
 * "Browse…" affordance for path inputs (attach-existing-manual, workspace parent dir).
 *
 * Renders nothing outside the desktop shell: a browser deployment has no native folder picker, so
 * the plain text input stays the only way to enter a path there.
 */
export function DesktopBrowseButton({
  value,
  onPicked,
  disabled = false,
  testId,
}: {
  value?: string | null;
  onPicked: (path: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const { t } = useI18n();
  const desktop = isDesktopApp();
  if (!desktop) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        const bridge = getDesktopBridge();
        if (!bridge) return;
        void bridge
          .pickDirectory(value ?? undefined)
          .then((picked) => {
            if (picked) onPicked(picked);
          })
          .catch(() => {
            /* Picker cancelled or unavailable — keep the typed value untouched. */
          });
      }}
      aria-label={t('desktop.shortcut.browseAria')}
      data-testid={testId ?? 'desktop-browse-button'}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
    >
      <FolderCog className="h-3.5 w-3.5" aria-hidden="true" />
      {t('desktop.shortcut.browse')}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[11.5px] font-medium transition-colors ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export function DesktopSettingsDialog({ onOpenParserSettings }: DesktopSettingsDialogProps) {
  const { t } = useI18n();
  const open = useDesktopStore((state) => state.dialogOpen);
  const activeTab = useDesktopStore((state) => state.activeTab);
  const setActiveTab = useDesktopStore((state) => state.setActiveTab);
  const closeDialog = useDesktopStore((state) => state.closeDialog);
  const busy = useDesktopStore((state) => state.busy);
  const status = useDesktopStore((state) => state.status);
  const statusLoading = useDesktopStore((state) => state.statusLoading);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeDialog();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeDialog]);

  if (!open || !isDesktopApp()) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) closeDialog();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('desktop.title')}
        data-testid="desktop-settings-dialog"
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 pb-2 pt-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-slate-900">{t('desktop.title')}</h2>
            <p className="mt-0.5 text-[10.5px] text-slate-500">{t('desktop.subtitle')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {statusLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />
            ) : null}
            {status?.isCustomDataDir ? (
              <span className="max-w-52 truncate rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
                {status.dataDir}
              </span>
            ) : null}
            <button
              type="button"
              onClick={closeDialog}
              aria-label={t('desktop.closeAria')}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div role="tablist" className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-3">
          {TABS.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {t(tab.labelKey)}
            </TabButton>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" data-testid="desktop-settings-body">
          {activeTab === 'storage' ? (
            <DesktopStorageTab />
          ) : (
            <DesktopPluginGuideTab onOpenParserSettings={onOpenParserSettings} />
          )}
        </div>
      </div>
    </div>
  );
}
