import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  BookMarked,
  FileCode2,
  FileText,
  FolderKanban,
  X,
} from 'lucide-react';
import type { OpenEditorTab } from '../store/editor-store';

export interface EditorTabBarProps {
  tabs: OpenEditorTab[];
  activeTabPath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onCloseOtherTabs: (path: string) => void;
  onCloseSavedTabs: () => void;
}

const TAB_TYPE_BADGE: Record<string, string> = {
  concept: 'text-indigo-600',
  task: 'text-emerald-600',
  reference: 'text-amber-600',
  topic: 'text-slate-600',
  map: 'text-sky-600',
  bookmap: 'text-violet-600',
  ditaval: 'text-teal-600',
};

/**
 * Multi-tab document bar following `modern-web-guidance` `tabs`:
 * - `focusgroup="tablist nomemory"` + `focusgroupstart` on the active tab
 * - Roving-tabindex + `role="tablist"`/`role="tab"` fallback strictly when native `focusgroup` is absent
 * - `::after` `border-block-end` selected indicator styled from `[aria-selected="true"]`
 * - Scroll-driven edge fades + `IntersectionObserver` sentinel fallback
 */
export function EditorTabBar({
  tabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseSavedTabs,
}: EditorTabBarProps) {
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const startSentinelRef = useRef<HTMLDivElement | null>(null);
  const endSentinelRef = useRef<HTMLDivElement | null>(null);

  // Scroll active tab into view on selection change
  useEffect(() => {
    const list = tablistRef.current;
    if (!list || !activeTabPath) return;
    const selectedBtn = list.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    selectedBtn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabPath, tabs.length]);

  // Roving-tabindex fallback strictly when native `focusgroup` is unsupported
  useEffect(() => {
    const list = tablistRef.current;
    if (!list || 'focusGroup' in HTMLElement.prototype) return;

    list.setAttribute('role', 'tablist');
    const getTabButtons = () =>
      Array.from(list.querySelectorAll<HTMLButtonElement>('button.dita-tab-btn'));

    const buttons = getTabButtons();
    const activeIdx = Math.max(
      0,
      buttons.findIndex((b) => b.getAttribute('aria-selected') === 'true'),
    );
    buttons.forEach((b, i) => {
      b.setAttribute('role', 'tab');
      b.tabIndex = i === activeIdx ? 0 : -1;
    });

    const onKeyDown = (ev: KeyboardEvent) => {
      const listBtns = getTabButtons();
      const idx = listBtns.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1 || listBtns.length === 0) return;

      let nextIdx = -1;
      if (ev.key === 'ArrowRight') nextIdx = (idx + 1) % listBtns.length;
      else if (ev.key === 'ArrowLeft') nextIdx = (idx - 1 + listBtns.length) % listBtns.length;
      else if (ev.key === 'Home') nextIdx = 0;
      else if (ev.key === 'End') nextIdx = listBtns.length - 1;

      if (nextIdx >= 0) {
        ev.preventDefault();
        const target = listBtns[nextIdx];
        if (target) {
          listBtns.forEach((b, i) => {
            b.tabIndex = i === nextIdx ? 0 : -1;
          });
          target.focus();
          target.click();
        }
      }
    };

    list.addEventListener('keydown', onKeyDown);
    return () => list.removeEventListener('keydown', onKeyDown);
  }, [tabs, activeTabPath]);

  // Edge fade fallback via IntersectionObserver when scroll-driven animations are unsupported
  useEffect(() => {
    const scroller = tablistRef.current;
    const startEl = startSentinelRef.current;
    const endEl = endSentinelRef.current;
    if (!scroller || !startEl || !endEl) return;
    if (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline', 'scroll()')) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === startEl) {
            scroller.classList.toggle('more-start', !entry.isIntersecting);
          } else if (entry.target === endEl) {
            scroller.classList.toggle('more-end', !entry.isIntersecting);
          }
        }
      },
      { root: scroller, threshold: 0.99 },
    );

    observer.observe(startEl);
    observer.observe(endEl);
    return () => observer.disconnect();
  }, [tabs.length]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex h-9 shrink-0 items-stretch justify-between border-b border-slate-200 bg-slate-100/90">
      <div
        ref={tablistRef}
        {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
        aria-label="已打开文档标签栏"
        className="dita-tablist dita-scroller-hidden flex min-w-0 flex-1 items-stretch overflow-x-auto"
      >
        <div
          ref={startSentinelRef}
          aria-hidden="true"
          className="w-px shrink-0"
        />
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;
          const isDirty = tab.xml !== tab.baselineXml;
          const Icon =
            tab.kind === 'bookmap'
              ? BookMarked
              : tab.kind === 'ditamap'
                ? FolderKanban
                : tab.kind === 'ditaval'
                  ? FileCode2
                  : FileText;
          const iconColor = TAB_TYPE_BADGE[tab.docType] ?? 'text-slate-500';

          return (
            <div
              key={tab.path}
              className={`dita-tab-group group relative flex items-stretch border-r border-slate-200/80 ${
                isActive ? 'bg-white' : 'bg-slate-100/70 hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                id={`tab-${tab.path}`}
                aria-selected={isActive}
                {...(isActive ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
                onClick={() => onSelectTab(tab.path)}
                onMouseDown={(ev) => {
                  if (ev.button === 1) {
                    ev.preventDefault();
                    onCloseTab(tab.path);
                  }
                }}
                title={`${tab.path}${isDirty ? '（有未保存改动）' : ''}`}
                className={`dita-tab-btn relative flex min-w-0 items-center gap-1.5 px-2.5 text-xs ${
                  isActive ? 'text-slate-900' : 'text-slate-600'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} aria-hidden="true" />
                <span className="truncate font-medium">{tab.fileName}</span>
                {tab.xmlError ? (
                  <AlertCircle
                    className="h-3 w-3 shrink-0 text-rose-500"
                    aria-label="XML 语法错误"
                  />
                ) : isDirty ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    title="未保存"
                    aria-label="未保存"
                  />
                ) : null}
              </button>

              <button
                type="button"
                {...({ focusgroup: 'none' } as Record<string, string>)}
                onClick={() => onCloseTab(tab.path)}
                aria-label={`关闭 ${tab.fileName}`}
                title={`关闭 ${tab.fileName}`}
                className={`mr-1 self-center rounded p-0.5 text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 ${
                  isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                }`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <div
          ref={endSentinelRef}
          aria-hidden="true"
          className="w-px shrink-0"
        />
      </div>

      {/* Bulk Tab Actions */}
      {tabs.length > 1 && activeTabPath ? (
        <div className="hidden shrink-0 items-center gap-1 border-l border-slate-200 bg-slate-100/90 px-2 sm:flex">
          <button
            type="button"
            onClick={onCloseSavedTabs}
            className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
            title="关闭所有已保存的标签页"
          >
            清已保存
          </button>
          <button
            type="button"
            onClick={() => onCloseOtherTabs(activeTabPath)}
            className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200/70 hover:text-slate-800"
            title="仅保留当前标签页"
          >
            关闭其他
          </button>
        </div>
      ) : null}
    </div>
  );
}
