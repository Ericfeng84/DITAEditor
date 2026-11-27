import { useEffect, useMemo, useRef, useState } from 'react';
import type { DitaElementSpec } from '@dita/core';
import { CopyPlus, CornerDownLeft, Search, X } from 'lucide-react';
import type { InsertContextGroup } from './selection-info';
import { useI18n } from '../../i18n/index.js';
import { getElementDescription, getElementLabel } from '@dita/core';

export interface InsertElementChoice {
  spec: DitaElementSpec;
  containerTag: string;
  containerDepth: number;
  insertKind: 'inline' | 'block';
  groupLabel: string;
  /** Optional explicit ProseMirror document offset when opened from a Jupyter-style between-block `+` gap */
  insertPos?: number;
}

export interface InsertElementMenuProps {
  open: boolean;
  groups: InsertContextGroup[];
  anchorRect: { top: number; left: number } | null;
  isSlashTrigger?: boolean;
  explicitInsertPos?: number | null;
  /**
   * Non-structural entries that always sit at the top of the menu (e.g. "insert reusable
   * content"). They stay searchable with the same haystack as element specs but never depend on
   * the selection's content model.
   */
  specialActions?: InsertMenuSpecialAction[];
  onSelectSpecialAction?: (action: InsertMenuSpecialAction) => void;
  onSelect: (choice: InsertElementChoice) => void;
  onClose: () => void;
}

/** A menu entry that opens a dialog or panel instead of inserting an XML element. */
export interface InsertMenuSpecialAction {
  id: string;
  label: string;
  hint?: string;
  /** Extra search tokens (usually translated) matched together with the label. */
  keywords?: string[];
}

export function InsertElementMenu({
  open,
  groups,
  anchorRect,
  isSlashTrigger = false,
  explicitInsertPos = null,
  specialActions,
  onSelectSpecialAction,
  onSelect,
  onClose,
}: InsertElementMenuProps) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const flattened = useMemo<InsertElementChoice[]>(() => {
    const q = query.trim().toLowerCase();
    const out: InsertElementChoice[] = [];
    for (const group of groups) {
      for (const spec of group.items) {
        if (q) {
          const haystack = [
            spec.tag,
            spec.label,
            getElementLabel(spec, locale),
            spec.description,
            ...(spec.keywords ?? []),
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(q)) continue;
        }
        out.push({
          spec,
          containerTag: group.containerTag,
          containerDepth: group.containerDepth,
          insertKind: group.insertKind,
          groupLabel: group.containerLabel,
          insertPos: explicitInsertPos ?? undefined,
        });
      }
    }
    return out;
  }, [groups, query, explicitInsertPos]);

  const filteredActions = useMemo<InsertMenuSpecialAction[]>(() => {
    const list = specialActions ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((action) =>
      [action.label, action.hint ?? '', ...(action.keywords ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [specialActions, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    // Focus search box cleanly on next paint
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  const totalCount = filteredActions.length + flattened.length;

  useEffect(() => {
    setActiveIndex((prev) => (totalCount === 0 ? 0 : Math.min(prev, totalCount - 1)));
  }, [totalCount]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, onClose]);

  if (!open) return null;

  // Clamp floating position safely inside viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const menuW = 340;
  const menuH = 380;
  const rawLeft = anchorRect?.left ?? Math.round((vw - menuW) / 2);
  const rawTop = anchorRect?.top ?? 120;
  const left = Math.max(12, Math.min(rawLeft, vw - menuW - 12));
  const top = rawTop + menuH > vh - 16 ? Math.max(12, rawTop - menuH - 12) : Math.max(12, rawTop);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalCount > 0) {
        setActiveIndex((i) => (i + 1) % totalCount);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalCount > 0) {
        setActiveIndex((i) => (i - 1 + totalCount) % totalCount);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex < filteredActions.length) {
        const action = filteredActions[activeIndex];
        if (action) onSelectSpecialAction?.(action);
        return;
      }
      const chosen = flattened[activeIndex - filteredActions.length];
      if (chosen) {
        onSelect(chosen);
      }
    }
  };

  // Group flattened results back by container group label for clean headers
  const groupedSections: { label: string; kind: 'inline' | 'block'; items: { choice: InsertElementChoice; flatIndex: number }[] }[] = [];
  const sectionMap = new Map<string, (typeof groupedSections)[number]>();
  flattened.forEach((choice, flatIndex) => {
    const key = `${choice.insertKind}:${choice.containerDepth}:${choice.containerTag}`;
    let sec = sectionMap.get(key);
    if (!sec) {
      sec = { label: choice.groupLabel, kind: choice.insertKind, items: [] };
      sectionMap.set(key, sec);
      groupedSections.push(sec);
    }
    sec.items.push({ choice, flatIndex });
  });

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label={t('insertMenu.aria')}
      style={{ top: `${top}px`, left: `${left}px`, width: `${menuW}px` }}
      className="fixed z-50 flex max-h-[380px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-900/5"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isSlashTrigger
              ? t('insertMenu.placeholderSlash')
              : t('insertMenu.placeholderSearch')
          }
          className="w-full bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('insertMenu.closeAria')}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto p-1.5">
        {totalCount === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-400">
            {t('insertMenu.empty')}
          </div>
        ) : null}
        {filteredActions.length > 0 ? (
          <div className="mb-2">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span>{t('insertMenu.specialSection')}</span>
              <span className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-700">
                {t('insertMenu.specialBadge')}
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredActions.map((action, actionIndex) => {
                const isActive = actionIndex === activeIndex;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(actionIndex)}
                    onClick={() => onSelectSpecialAction?.(action)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                      isActive ? 'bg-teal-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <CopyPlus
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isActive ? 'text-white' : 'text-teal-600'
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-medium">{action.label}</span>
                        {action.hint ? (
                          <p
                            className={`mt-0.5 truncate text-[11px] ${
                              isActive ? 'text-teal-100' : 'text-slate-500'
                            }`}
                          >
                            {action.hint}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {isActive ? (
                      <CornerDownLeft
                        className="h-3.5 w-3.5 shrink-0 text-teal-200"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {groupedSections.length > 0
          ? groupedSections.map((section) => (
            <div key={section.label} className="mb-2 last:mb-0">
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>{section.label}</span>
                <span
                  className={
                    section.kind === 'inline'
                      ? 'rounded bg-blue-50 px-1.5 py-0.5 text-blue-600'
                      : 'rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700'
                  }
                >
                  {section.kind === 'inline' ? 'Inline' : 'Block'}
                </span>
              </div>
              <div className="space-y-0.5">
                {section.items.map(({ choice, flatIndex }) => {
                  const absoluteIndex = flatIndex + filteredActions.length;
                  const isActive = absoluteIndex === activeIndex;
                  return (
                    <button
                      key={`${choice.insertKind}-${choice.containerDepth}-${choice.spec.tag}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onMouseEnter={() => setActiveIndex(absoluteIndex)}
                      onClick={() => onSelect(choice)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <code
                            className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-blue-700'
                            }`}
                          >
                            &lt;{choice.spec.tag}&gt;
                          </code>
                          <span className="truncate text-xs font-medium">
                            {getElementLabel(choice.spec, locale)}
                          </span>
                        </div>
                        <p
                          className={`mt-0.5 truncate text-[11px] ${
                            isActive ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {getElementDescription(choice.spec, locale)}
                        </p>
                      </div>
                      {isActive ? (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-blue-200" aria-hidden="true" />
                      ) : choice.spec.shortcut ? (
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">
                          {choice.spec.shortcut}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
          : null}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
        <span>{t('insertMenu.footnoteContentModel')}</span>
        <span className="font-mono">{t('insertMenu.footnoteKeys')}</span>
      </div>
    </div>
  );
}
