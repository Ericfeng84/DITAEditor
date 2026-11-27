import { Check, ChevronDown, Map as MapIcon, Pin } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { WorkspaceMapSummary } from '../services/workspace-api';
import { useI18n } from '../i18n/index.js';

export interface RootMapSwitcherProps {
  /** Map the tree is currently rooted at. */
  rootMapPath: string;
  rootTitle: string;
  isDirty: boolean;
  /** True while the map root node (not a topicref) is the inspected node. */
  isRootSelected: boolean;
  maps: WorkspaceMapSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Activates another workspace map as the tree root; omit to keep the header read-only. */
  onSelectRootMap?: (mapPath: string) => void;
  /** Selects the map's root node in the inspector (the header's behaviour before it became a menu). */
  onInspectRoot: () => void;
  /** Manual-level default map, pinned through `MapTreePanel.onSetDefaultRootMap`. */
  defaultRootMap?: string | null;
  onSetDefaultRootMap?: (mapPath: string) => void;
}

/**
 * Root-map switcher in the Map panel header.
 *
 * The header used to be a plain button whose only job was selecting the map root node, so
 * switching maps required the Files tab. It now opens a menu that (a) activates any other workspace
 * map as the tree root, (b) keeps the old "inspect the root node" action, and (c) pins the current
 * map as the manual's default root map — the value the workbench opens a manual with.
 */
export function RootMapSwitcher({
  rootMapPath,
  rootTitle,
  isDirty,
  isRootSelected,
  maps,
  open,
  onOpenChange,
  onSelectRootMap,
  onInspectRoot,
  defaultRootMap = null,
  onSetDefaultRootMap,
}: RootMapSwitcherProps) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const isDefault = defaultRootMap === rootMapPath;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!hostRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={hostRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('mapTree.switchRootMapAria')}
        title={t('mapTree.rootTooltip', { path: rootMapPath })}
        onClick={() => onOpenChange(!open)}
        className={`flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors ${
          isRootSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-100'
        }`}
      >
        <MapIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{rootTitle}</span>
        {isDefault ? (
          <Pin
            className="h-3 w-3 shrink-0 text-amber-500"
            aria-label={t('mapTree.defaultRootMapActive')}
          />
        ) : null}
        {isDirty ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            title={t('mapTree.dirtyTooltip')}
          />
        ) : null}
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t('mapTree.switchRootMapAria')}
          className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
        >
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('mapTree.switchRootMap')}
          </p>
          {maps.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-slate-500">{t('mapTree.noMaps')}</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {maps.map((map) => {
                const active = map.path === rootMapPath;
                return (
                  <button
                    key={map.path}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    disabled={!onSelectRootMap}
                    onClick={() => {
                      onSelectRootMap?.(map.path);
                      onOpenChange(false);
                    }}
                    className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left disabled:cursor-default ${
                      active ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1">
                        <span className="truncate text-xs font-medium text-slate-800">
                          {map.title || map.name}
                        </span>
                        {map.path === defaultRootMap ? (
                          <Pin
                            className="h-2.5 w-2.5 shrink-0 text-amber-500"
                            aria-label={t('mapTree.defaultRootMapActive')}
                          />
                        ) : null}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-slate-400">
                        {map.path}
                      </span>
                    </span>
                    {map.topicrefCount > 0 ? (
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                        {map.topicrefCount}
                      </span>
                    ) : null}
                    {active ? (
                      <Check className="h-3 w-3 shrink-0 text-blue-600" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onInspectRoot();
              onOpenChange(false);
            }}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            <MapIcon className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
            {t('mapTree.inspectRoot')}
          </button>

          {onSetDefaultRootMap ? (
            <button
              type="button"
              role="menuitem"
              disabled={isDefault}
              onClick={() => {
                onSetDefaultRootMap(rootMapPath);
                onOpenChange(false);
              }}
              title={t('mapTree.defaultRootMapHint')}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              <Pin
                className={`h-3 w-3 shrink-0 ${isDefault ? 'text-amber-500' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              {isDefault ? t('mapTree.defaultRootMapActive') : t('mapTree.setDefaultRootMap')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
