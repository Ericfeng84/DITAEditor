import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, FolderOpen, PanelLeftClose } from 'lucide-react';
import type { LeftSidebarTab } from '../store/editor-store';
import { useI18n } from '../i18n/index.js';

export interface LeftSidebarProps {
  activeTab: LeftSidebarTab;
  onChangeTab: (tab: LeftSidebarTab) => void;
  onCollapse: () => void;
  workspaceName: string;
  workspaceMode: 'api' | 'memory';
  onOpenWorkspaceDialog: () => void;
  /**
   * Phase 10: inside a manual session the chip navigates back to the manual workbench instead of
   * opening the legacy workspace dialog — switching manuals is a workbench-level action now.
   */
  onOpenManualHub?: () => void;
  mapTreeSlot: ReactNode;
  fileExplorerSlot: ReactNode;
  keyspaceSlot: ReactNode;
  gitSlot: ReactNode;
  /** Phase 10: my assignments for this manual/branch. */
  assignmentsSlot?: ReactNode;
  /** Open-assignment badge on the 任务 tab. */
  assignmentBadgeCount?: number;
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
  onOpenManualHub,
  mapTreeSlot,
  fileExplorerSlot,
  keyspaceSlot,
  gitSlot,
  assignmentsSlot,
  assignmentBadgeCount = 0,
}: LeftSidebarProps) {
  const { t } = useI18n();
  const mapTabId = useId();
  const filesTabId = useId();
  const keysTabId = useId();
  const gitTabId = useId();
  const assignmentsTabId = useId();
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const filesPanelRef = useRef<HTMLDivElement | null>(null);
  const keysPanelRef = useRef<HTMLDivElement | null>(null);
  const gitPanelRef = useRef<HTMLDivElement | null>(null);
  const assignmentsPanelRef = useRef<HTMLDivElement | null>(null);

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
    syncPanel(assignmentsPanelRef.current, 'assignments');
  }, [activeTab]);

  useEffect(() => {
    const mapEl = mapPanelRef.current;
    const filesEl = filesPanelRef.current;
    const keysEl = keysPanelRef.current;
    const gitEl = gitPanelRef.current;
    const assignmentsEl = assignmentsPanelRef.current;
    const onMatchMap = () => onChangeTab('map');
    const onMatchFiles = () => onChangeTab('files');
    const onMatchKeys = () => onChangeTab('keys');
    const onMatchGit = () => onChangeTab('git');
    const onMatchAssignments = () => onChangeTab('assignments');
    mapEl?.addEventListener('beforematch', onMatchMap);
    filesEl?.addEventListener('beforematch', onMatchFiles);
    keysEl?.addEventListener('beforematch', onMatchKeys);
    gitEl?.addEventListener('beforematch', onMatchGit);
    assignmentsEl?.addEventListener('beforematch', onMatchAssignments);
    return () => {
      mapEl?.removeEventListener('beforematch', onMatchMap);
      filesEl?.removeEventListener('beforematch', onMatchFiles);
      keysEl?.removeEventListener('beforematch', onMatchKeys);
      gitEl?.removeEventListener('beforematch', onMatchGit);
      assignmentsEl?.removeEventListener('beforematch', onMatchAssignments);
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
            onClick={onOpenManualHub ?? onOpenWorkspaceDialog}
            title={
              onOpenManualHub
                ? t('sidebar.manual.title', { name: workspaceName })
                : t('sidebar.workspace.title', {
                    name: workspaceName,
                    mode: t(workspaceMode === 'api' ? 'sidebar.mode.api' : 'sidebar.mode.memory'),
                  })
            }
            aria-label={
              onOpenManualHub
                ? t('sidebar.manual.aria', { name: workspaceName })
                : t('sidebar.workspace.aria', { name: workspaceName })
            }
            className="inline-flex h-6 min-w-0 max-w-[160px] flex-1 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            {onOpenManualHub ? (
              <ChevronLeft className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            ) : (
              <FolderOpen className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
            )}
            <span className="min-w-0 truncate">
              {onOpenManualHub ? t('sidebar.manual.hubLabel') : workspaceName}
            </span>
            {onOpenManualHub ? null : (
              <ChevronDown className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden="true" />
            )}
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
        className="dita-sidebar-tablist grid h-9 shrink-0 grid-cols-[0.95fr_1.25fr_0.85fr_0.7fr_1.45fr] border-b border-slate-200 bg-slate-50 text-[10.5px]"
      >
        {/* Five tabs in a 256px rail: text-only labels plus a wider last column so
            "Assignments" also fits in English without truncating. */}
        <button
          type="button"
          id={filesTabId}
          aria-selected={activeTab === 'files'}
          {...(activeTab === 'files' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('files')}
          title={t('sidebar.tab.files')}
          className="dita-sidebar-tab relative flex min-w-0 items-center justify-center px-0.5 text-slate-600 hover:text-slate-900"
        >
          <span className="min-w-0 truncate">{t('sidebar.tab.files')}</span>
        </button>
        <button
          type="button"
          id={mapTabId}
          aria-selected={activeTab === 'map'}
          {...(activeTab === 'map' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('map')}
          title={t('sidebar.tab.map')}
          className="dita-sidebar-tab relative flex min-w-0 items-center justify-center px-0.5 text-slate-600 hover:text-slate-900"
        >
          <span className="min-w-0 truncate">{t('sidebar.tab.map')}</span>
        </button>
        <button
          type="button"
          id={keysTabId}
          aria-selected={activeTab === 'keys'}
          {...(activeTab === 'keys' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('keys')}
          title="Keys"
          className="dita-sidebar-tab relative flex min-w-0 items-center justify-center px-0.5 text-slate-600 hover:text-slate-900"
        >
          <span className="min-w-0 truncate">Keys</span>
        </button>
        <button
          type="button"
          id={gitTabId}
          aria-selected={activeTab === 'git'}
          {...(activeTab === 'git' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('git')}
          title={t('sidebar.tab.git')}
          className="dita-sidebar-tab relative flex min-w-0 items-center justify-center px-0.5 text-slate-600 hover:text-slate-900"
        >
          <span className="min-w-0 truncate">{t('sidebar.tab.git')}</span>
        </button>
        <button
          type="button"
          id={assignmentsTabId}
          aria-selected={activeTab === 'assignments'}
          {...(activeTab === 'assignments' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('assignments')}
          title={t('sidebar.tab.assignments')}
          className="dita-sidebar-tab relative flex min-w-0 items-center justify-center gap-1 px-0.5 text-slate-600 hover:text-slate-900"
        >
          <span className="min-w-0 truncate">{t('sidebar.tab.assignments')}</span>
          {assignmentBadgeCount > 0 ? (
            <span
              aria-hidden="true"
              className="inline-flex h-3 min-w-3 shrink-0 items-center justify-center rounded-full bg-blue-600 px-0.5 text-[8.5px] font-bold leading-none text-white"
            >
              {assignmentBadgeCount > 9 ? '9+' : assignmentBadgeCount}
            </span>
          ) : null}
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
        <div
          ref={assignmentsPanelRef}
          role="tabpanel"
          aria-labelledby={assignmentsTabId}
          hidden
          className="dita-sidebar-panel col-start-1 row-start-1"
        >
          <div className="h-full w-full overflow-hidden">{assignmentsSlot ?? null}</div>
        </div>
      </div>
    </aside>
  );
}
