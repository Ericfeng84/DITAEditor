/**
 * Non-intrusive "missing desktop tools" banner for the hub page.
 *
 * Desktop only, dry by default: it never blocks the page, and once dismissed the electron-side
 * preference (`pluginGuideDismissed`) keeps it quiet across restarts.
 */

import { useEffect, type ElementType } from 'react';
import { AlertTriangle, Languages, PlugZap, TerminalSquare, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';
import { isDesktopApp, missingCoreToolIds } from '../services/desktop-bridge.js';
import { useDesktopStore } from '../store/desktop-store.js';

const TOOL_LABELS: Record<string, { key: MessageKey; Icon: ElementType }> = {
  ditaOt: { key: 'desktop.banner.missing.ditaOt', Icon: TerminalSquare },
  java: { key: 'desktop.banner.missing.java', Icon: TerminalSquare },
  fonts: { key: 'desktop.banner.missing.fonts', Icon: Languages },
  git: { key: 'desktop.banner.missing.git', Icon: PlugZap },
};

export function DesktopPluginBanner() {
  const { t } = useI18n();
  const status = useDesktopStore((state) => state.status);
  const env = useDesktopStore((state) => state.env);
  const busy = useDesktopStore((state) => state.busy);
  const envLoading = useDesktopStore((state) => state.envLoading);
  const refreshStatus = useDesktopStore((state) => state.refreshStatus);
  const refreshEnvironment = useDesktopStore((state) => state.refreshEnvironment);
  const openDialog = useDesktopStore((state) => state.openDialog);
  const dismissPluginBanner = useDesktopStore((state) => state.dismissPluginBanner);

  const desktop = isDesktopApp();

  useEffect(() => {
    if (!desktop) return;
    void refreshStatus();
    void refreshEnvironment(false);
  }, [desktop, refreshStatus, refreshEnvironment]);

  if (!desktop) return null;
  if (!status || !env) return null;
  if (status.pluginGuideDismissed) return null;

  const missing = missingCoreToolIds(env);
  if (missing.length === 0) return null;

  return (
    <div
      data-testid="desktop-plugin-banner"
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2"
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-amber-900">{t('desktop.banner.title')}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-amber-800">{t('desktop.banner.body')}</p>
          <ul className="mt-1 flex flex-wrap items-center gap-1">
            {missing.map((id) => {
              const meta = TOOL_LABELS[id];
              if (!meta) return null;
              const Icon = meta.Icon;
              return (
                <li
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/70 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-900"
                >
                  <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                  {t(meta.key)}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => openDialog('plugins')}
          disabled={envLoading}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-600 px-2.5 text-[10.5px] font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          data-testid="desktop-plugin-banner-guide"
        >
          <PlugZap className="h-3 w-3" aria-hidden="true" />
          {t('desktop.banner.viewGuide')}
        </button>
        <button
          type="button"
          onClick={() => void dismissPluginBanner()}
          disabled={busy}
          aria-label={t('desktop.banner.dismissAria')}
          title={t('desktop.banner.dismissAria')}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-white px-2 text-[10.5px] font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
          data-testid="desktop-plugin-banner-dismiss"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          {t('desktop.banner.dismiss')}
        </button>
      </div>
    </div>
  );
}
