import { useEffect, useRef, useState } from 'react';
import type { XmlParseError } from '@dita/core';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Code2,
  Columns2,
  Eye,
  PanelLeft,
  PanelRightOpen,
  Rocket,
  Settings,
} from 'lucide-react';
import type { EditorViewMode, OpenEditorTab } from '../store/editor-store';
import type { IdentityResponse, IdentityUser } from '../services/identity-api';
import { useI18n } from '../i18n/index.js';
import { IdentitySwitcher } from './IdentitySwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';
import { DesktopSettingsButton } from '../desktop/DesktopSettingsDialog.js';
import { useHelpCenterStore } from '../store/help-center-store.js';

export interface WorkbenchHeaderProps {
  /** Brand lockup is rendered in the sidebar strip while it is open; the header takes over when collapsed. */
  showBrand: boolean;
  activeTab: OpenEditorTab | null;
  mode: EditorViewMode;
  xmlError: XmlParseError | null;
  leftSidebarOpen: boolean;
  problemsOpen: boolean;
  errorCount: number;
  warningCount: number;
  dirtyCount: number;
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onSwitchIdentity: (userId: string) => void;
  onToggleLeftSidebar: () => void;
  onChangeMode: (nextMode: EditorViewMode) => void;
  onToggleProblems: () => void;
  /** Collapsed inspector: show an explicit toolbar button so the panel is always recoverable. */
  showInspectorExpand: boolean;
  onExpandInspector: () => void;
  /** Phase 10: manual name of this session, shown as the header brand when the sidebar is collapsed. */
  manualName?: string | null;
  /** Publish the current root map (DITA-OT HTML5 / PDF). Omitted when publishing is unavailable. */
  onOpenPublish?: () => void;
}

export function WorkbenchHeader({
  showBrand,
  activeTab,
  mode,
  xmlError,
  leftSidebarOpen,
  problemsOpen,
  errorCount,
  warningCount,
  dirtyCount,
  identity,
  currentUser,
  onSwitchIdentity,
  onToggleLeftSidebar,
  onChangeMode,
  onToggleProblems,
  showInspectorExpand,
  onExpandInspector,
  manualName = null,
  onOpenPublish,
}: WorkbenchHeaderProps) {
  const { t } = useI18n();
  const openHelp = useHelpCenterStore((state) => state.open);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // The settings popover is a transient menu: any pointer outside it or Escape closes it, so it can
  // never linger over the canvas while the user edits.
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen]);
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Mirrors `showInspectorExpand` on the right: a collapse button is pointless while the
            sidebar is open (the sidebar strip carries its own toggle), so only offer expand. */}
        {!leftSidebarOpen ? (
          <button
            type="button"
            aria-pressed={false}
            onClick={onToggleLeftSidebar}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50"
            title={t('header.toggleExpandTitle')}
            aria-label={t('header.toggleExpandAria')}
          >
            <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}

        {showBrand ? (
          <div className="flex items-center gap-2 pr-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white shadow-xs">
              D
            </div>
            <div className="hidden leading-tight xl:block">
              <div className="text-xs font-bold tracking-tight text-slate-900">
                {manualName ?? 'DITAEditor'}
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {manualName ? t('header.manualSubtitle') : t('header.brandSubtitle')}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Center: Visual | Split | Source Mode Segmented Switch */}
      <div
        role="group"
        aria-label={t('header.modeGroup')}
        className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5"
      >
        {(
          [
            { id: 'visual', label: t('header.mode.visual'), icon: Eye },
            { id: 'split', label: t('header.mode.split'), icon: Columns2 },
            { id: 'source', label: t('header.mode.source'), icon: Code2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          const blocked = Boolean(xmlError && mode === 'source' && item.id !== 'source');
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              disabled={!activeTab}
              onClick={() => onChangeMode(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : blocked
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
              title={
                blocked
                  ? t('header.mode.blockedTitle')
                  : t('header.mode.switchTitle', { mode: item.label })
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Publish, Diagnostics, Drafts, Desktop settings, Settings, Inspector. Session chrome
          (identity, language, help) lives in the settings menu so the bar stays document state. */}
      <div className="flex shrink-0 items-center gap-1.5">
        {onOpenPublish ? (
          <button
            type="button"
            onClick={onOpenPublish}
            className="inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs transition-colors hover:border-blue-700 hover:bg-blue-700"
            title={t('mapTree.publishTooltip')}
            aria-label={t('mapTree.publish')}
          >
            <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('mapTree.publish')}</span>
          </button>
        ) : null}

        {/* Diagnostics toggle pill */}
        <button
          type="button"
          aria-pressed={problemsOpen}
          onClick={onToggleProblems}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            errorCount > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : warningCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : problemsOpen
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title={t('header.problems.toggleTitle')}
        >
          {errorCount > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          )}
          <span className="hidden md:inline">
            {errorCount > 0 || warningCount > 0
              ? t('header.problems.summary', { errors: errorCount, warnings: warningCount })
              : t('header.problems.zero')}
          </span>
        </button>

        {xmlError ? (
          <span
            className="hidden items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 2xl:inline-flex"
            title={xmlError.message}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            L{xmlError.line}:{xmlError.column}
          </span>
        ) : null}

        {dirtyCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
            title={t('header.dirtyTitle')}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span>{t('header.dirtyCount', { count: dirtyCount })}</span>
          </span>
        ) : null}

        <DesktopSettingsButton />

        {/* Session chrome (identity, language, help) lives behind this gear: each was a permanent
            control on the bar competing with document state for the tightest pixels. */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            data-testid="header-settings-button"
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-label={t('header.settings.aria')}
            title={t('header.settings.title')}
            onClick={() => setSettingsOpen((open) => !open)}
            className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors ${
              settingsOpen
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {settingsOpen ? (
            <div
              role="menu"
              aria-label={t('header.settings.title')}
              className="absolute right-0 top-full z-50 mt-1 min-w-[280px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              {/* Who is signed in, the interface language and the help center. Keeping them off
                  the bar leaves the header to document state only. */}
              <div className="flex items-center justify-between gap-2 rounded px-1 py-1">
                <span className="text-[11px] font-medium text-slate-500">
                  {t('header.settings.identity')}
                </span>
                <IdentitySwitcher
                  identity={identity}
                  currentUser={currentUser}
                  onChange={onSwitchIdentity}
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
                  setSettingsOpen(false);
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

        {showInspectorExpand ? (
          <button
            type="button"
            onClick={onExpandInspector}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            title={t('header.inspector.expandTitle')}
            aria-label={t('header.inspector.expandAria')}
          >
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">{t('header.inspector.expand')}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
