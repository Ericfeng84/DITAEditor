import { useEffect, useId, useRef, type ReactNode } from 'react';
import { FolderTree, Network, PanelLeftClose } from 'lucide-react';
import type { LeftSidebarTab } from '../store/editor-store';

export interface LeftSidebarProps {
  activeTab: LeftSidebarTab;
  onChangeTab: (tab: LeftSidebarTab) => void;
  onCollapse: () => void;
  mapTreeSlot: ReactNode;
  fileExplorerSlot: ReactNode;
}

/**
 * Left workbench sidebar implementing `modern-web-guidance` `tabs`:
 * - `focusgroup="tablist nomemory"` + `focusgroupstart` on selected tab
 * - `hidden="until-found"` + `beforematch` support; the inactive panel keeps its box, so
 *   `.dita-sidebar-panel[hidden]` disables pointer events (see index.css) instead of overlaying
 * - Underline indicator styled via `[aria-selected="true"]::after`
 *
 * The sidebar owns its own top strip (brand + collapse button) because it now runs to the
 * very top edge of the window instead of starting below the workbench header.
 */
export function LeftSidebar({
  activeTab,
  onChangeTab,
  onCollapse,
  mapTreeSlot,
  fileExplorerSlot,
}: LeftSidebarProps) {
  const mapTabId = useId();
  const filesTabId = useId();
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const filesPanelRef = useRef<HTMLDivElement | null>(null);

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
  }, [activeTab]);

  useEffect(() => {
    const mapEl = mapPanelRef.current;
    const filesEl = filesPanelRef.current;
    const onMatchMap = () => onChangeTab('map');
    const onMatchFiles = () => onChangeTab('files');
    mapEl?.addEventListener('beforematch', onMatchMap);
    filesEl?.addEventListener('beforematch', onMatchFiles);
    return () => {
      mapEl?.removeEventListener('beforematch', onMatchMap);
      filesEl?.removeEventListener('beforematch', onMatchFiles);
    };
  }, [onChangeTab]);

  return (
    <aside
      aria-label="项目导航工作区"
      className="flex h-full flex-col border-r border-slate-200 bg-white"
    >
      {/* Top strip aligned with the workbench header height (h-12) */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white shadow-xs">
            D
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-xs font-bold tracking-tight text-slate-900">
              DITAEditor
            </div>
            <div className="truncate text-[10px] font-medium text-slate-400">
              项目 · Map 管理
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          title="收起左侧栏 (⌘\\)"
          aria-label="收起项目与 Map 导航栏"
        >
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={tablistRef}
        {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
        aria-label="导航视图切换"
        className="dita-sidebar-tablist grid h-9 shrink-0 grid-cols-2 border-b border-slate-200 bg-slate-50"
      >
        <button
          type="button"
          id={filesTabId}
          aria-selected={activeTab === 'files'}
          {...(activeTab === 'files' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('files')}
          className="dita-sidebar-tab relative flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
        >
          <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
          <span>项目文件</span>
        </button>
        <button
          type="button"
          id={mapTabId}
          aria-selected={activeTab === 'map'}
          {...(activeTab === 'map' ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
          onClick={() => onChangeTab('map')}
          className="dita-sidebar-tab relative flex items-center justify-center gap-1.5 text-xs text-slate-600 hover:text-slate-900"
        >
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Map 结构树</span>
        </button>
      </div>

      {/* Single stacked grid cell holds both panels cleanly without padding/border on tabpanel */}
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
      </div>
    </aside>
  );
}
