import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown, FolderOpen, FolderTree, GitBranch, KeyRound, Network, PanelLeftClose } from 'lucide-react';
import type { LeftSidebarTab } from '../store/editor-store';
import { useI18n } from '../i18n/index.js';

export interface LeftSidebarProps {
  activeTab: LeftSidebarTab;
  onChangeTab: (tab: LeftSidebarTab) => void;
  onCollapse: () => void;
  workspaceName: string;
  workspaceMode: 'api' | 'memory';
  onOpenWorkspaceDialog: () => void;
  mapTreeSlot: ReactNode;
  fileExplorerSlot: ReactNode;
  keyspaceSlot: ReactNode;
  gitSlot: ReactNode;
}

/**
 * Left workbench sidebar implementing `modern-web-guidance` `tabs`:
 * - `focusgroup="tablist nomemory"` + `focusgroupstart` on selected tab
 * - `hidden="until-found"` + `beforematch` support; the inactive panels keep their boxes, so
 *   `.dita-sidebar-panel[hidden]` disables pointer events (see index.css) instead of overlaying
 * - Underline indicator styled via `[aria-selected="true"]::after`
 */
export function LeftSidebar({
  activeTab,
  onChangeTab,
  onCollapse,
  workspaceName,
  workspaceMode,
  onOpenWorkspaceDialog,
  mapTreeSlot,
  fileExplorerSlot,
  keyspaceSlot,
  gitSlot,
}: LeftSidebarProps) {
  const { t } = useI18n();
  const mapTabId = useId();
  const filesTabId = useId();
  const keysTabId = useId();
  const gitTabId = useId();
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const filesPanelRef = useRef<HTMLDivElement | null>(null);
  const keysPanelRef = useRef<HTMLDivElement | null>(null);
  const gitPanelRef = useRef<HTMLDivElement | null>(null);

  // Roving-tabindex fallback when native `focusgroup` is unavailable
  useEffect(() => {
    const bar = tablistRef.current;
    if (!bar || 'focusGroup' in HTMLElement.prototype) return;

    bar.setAttribute('role', 'tablist');
    const buttons = Array.from(bar.querySelectorAll<HTMLButtonElement>('button'));
    buttons.forEach((b) => {
      b.setAttribute('role', 'tab');
      b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1;
    });

    const onKeyDown = (ev: KeyboardEvent) => {
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;
      let next = -1;
      if (ev.key === 'ArrowRight') next = (idx + 1) % buttons.length;
      else if (ev.key === 'ArrowLeft') next = (idx - 1 + buttons.length) % buttons.length;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = buttons.length - 1;
      if (next >= 0) {
        ev.preventDefault();
        buttons.forEach((b, i) => {
          b.tabIndex = i === next ? 0 : -1;
        });
        buttons[next]?.focus();
        buttons[next]?.click();
      }
    };

    bar.addEventListener('keydown', onKeyDown);
    return () => bar.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  // Sync `hidden="until-found"` and `beforematch` for browser Find-in-page
  useEffect(() => {
    const syncPanel = (el: HTMLDivElement | null, tab: LeftSidebarTab) => {
      if (!el) return;
      const isVisible = activeTab === tab;
      if (isVisible) {
        el.removeAttribute('hidden');
      } else {
        el.setAttribute('hidden', 'until-found');
      }
    };
    syncPanel(mapPanelRef.current, 'map');
    syncPanel(filesPanelRef.current, 'files');
    syncPanel(keysPanelRef.current, 'keys');
    syncPanel(gitPanelRef.current, 'git');
  }, [activeTab]);

  useEffect(() => {
    const mapEl = mapPanelRef.current;
    const filesEl = filesPanelRef.current;
    const keysEl = keysPanelRef.current;
    const gitEl = gitPanelRef.current;
    const onMatchMap = () => onChangeTab('map');
    const onMatchFiles = () => onChangeTab('files');
    const onMatchKeys = () => onChangeTab('keys');
    const onMatchGit = () => onChangeTab('git');
    mapEl?.addEventListener('beforematch', onMatchMap);
    filesEl?.addEventListener('beforematch', onMatchFiles);
    keysEl?.addEventListener('beforematch', onMatchKeys);
    gitEl?.addEventListener('beforematch', onMatchGit);
    return () => {
      mapEl?.removeEventListener('beforematch', onMatchMap);
      filesEl?.removeEventListener('beforematch', onMatchFiles);
      keysEl?.removeEventListener('beforematch', onMatchKeys);
      gitEl?.removeEventListener('beforematch', onMatchGit);
    };
  }, [onChangeTab]);

  return (
    <aside
      aria-label={t('sidebar.aria')}
      className="@container flex h-full flex-col border-r border-slate-200 bg-white"
    >
      {/* Top strip aligned with the workbench header height (h-12) */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-1.5 border-b border-slate-200 px-2.5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white shadow-xs">
            D
          </div>
          <div className="hidden truncate text-xs font-bold tracking-tight text-slate-900 @min-[240px]:block">
            DITAEditor
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onOpenWorkspaceDialog}
            title={t('sidebar.workspace.title', {
              name: workspaceName,
              mode: t(workspaceMode === 'api' ? 'sidebar.mode.api' : 'sidebar.mode.memory'),
            })}
            aria-label={t('sidebar.workspace.aria', { name: workspaceName })}
            className="inline-flex h-6 min-w-0 max-w-[160px] flex-1 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <FolderOpen className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="min-w-0 truncate">{workspaceName}</span>
            <ChevronDown className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            title={t('sidebar.collapseTitle')}
            aria-label={t('sidebar.collapseAria')}
          >
            <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={tablistRef}
        {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
        aria-label={t('sidebar.viewGroup')}
        className="dita-sidebar-tablist grid h-9 shrink-0 grid-cols-4 border-b border-slate-200 bg-slate-50"
      >
        <button
          type="button"
          id={filesTabId}
          aria-selected={activeTab === 'files'}
          {...(activeTab === 'files' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('files')}
          className="dita-sidebar-tab relative flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-slate-900"
        >
          <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('sidebar.tab.files')}</span>
        </button>
        <button
          type="button"
          id={mapTabId}
          aria-selected={activeTab === 'map'}
          {...(activeTab === 'map' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('map')}
          className="dita-sidebar-tab relative flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-slate-900"
        >
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('sidebar.tab.map')}</span>
        </button>
        <button
          type="button"
          id={keysTabId}
          aria-selected={activeTab === 'keys'}
          {...(activeTab === 'keys' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('keys')}
          className="dita-sidebar-tab relative flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-slate-900"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Keys</span>
        </button>
        <button
          type="button"
          id={gitTabId}
          aria-selected={activeTab === 'git'}
          {...(activeTab === 'git' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('git')}
          className="dita-sidebar-tab relative flex items-center justify-center gap-1 text-xs text-slate-600 hover:text-slate-900"
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('sidebar.tab.git')}</span>
        </button>
      </div>

      {/* Single stacked grid cell holds all panels cleanly without padding/border on tabpanel */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 overflow-hidden">
        <div
          ref={mapPanelRef}
          role="tabpanel"
          aria-labelledby={mapTabId}
          className="dita-sidebar-panel col-start-1 row-start-1"
        >
          <div className="h-full w-full overflow-hidden">{mapTreeSlot}</div>
        </div>
        <div
          ref={filesPanelRef}
          role="tabpanel"
          aria-labelledby={filesTabId}
          hidden
          className="dita-sidebar-panel col-start-1 row-start-1"
        >
          <div className="h-full w-full overflow-hidden">{fileExplorerSlot}</div>
        </div>
        <div
          ref={keysPanelRef}
          role="tabpanel"
          aria-labelledby={keysTabId}
          hidden
          className="dita-sidebar-panel col-start-1 row-start-1"
        >
          <div className="h-full w-full overflow-hidden">{keyspaceSlot}</div>
        </div>
        <div
          ref={gitPanelRef}
          role="tabpanel"
          aria-labelledby={gitTabId}
          hidden
          className="dita-sidebar-panel col-start-1 row-start-1"
        >
          <div className="h-full w-full overflow-hidden">{gitSlot}</div>
        </div>
      </div>
    </aside>
  );
}
