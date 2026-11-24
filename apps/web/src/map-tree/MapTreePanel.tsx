import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tree, type TreeApi } from 'react-arborist';
import type { DitavalDisplayMode, ParsedDitaval } from '@dita/core';
import { useI18n } from '../i18n/index.js';
import {
  AlertTriangle,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  FilePlus2,
  Filter,
  FolderPlus,
  Heading,
  Layers,
  Link2,
  Network,
  Redo2,
  Rocket,
  Search,
  Undo2,
} from 'lucide-react';
import type { WorkspaceDitavalSummary } from '../services/workspace-api';
import {
  buildCompositeMapTree,
  type CompositeMapTreeNode,
  type MapBufferState,
} from './map-tree-utils';
import { MapNodeContextMenu, type MapNodeMenuTarget } from './MapNodeContextMenu';
import { createMapTreeNodeRenderer } from './MapTreeNodeRenderer';

export interface MapTreePanelProps {
  rootMapPath: string | null;
  mapBuffers: Record<string, MapBufferState>;
  fileSet: ReadonlySet<string>;
  topicTitles: Record<string, string>;
  topicTypes?: Record<string, string>;
  ditavals: WorkspaceDitavalSummary[];
  activeDitavalPath?: string | null;
  activeDitaval?: ParsedDitaval | null;
  ditavalDisplayMode?: DitavalDisplayMode;
  onSelectDitaval: (ditavalPath: string | null) => void;
  onChangeDitavalDisplayMode: (mode: DitavalDisplayMode) => void;
  selectedMapNode: { mapPath: string; elementPath: number[] | null } | null;
  onSelectMapNode: (ref: { mapPath: string; elementPath: number[] | null }) => void;
  onMoveNodes: (
    dragNodes: CompositeMapTreeNode[],
    targetParent: CompositeMapTreeNode | null,
    index: number,
  ) => void;
  onOpenTopicOrMap: (filePath: string) => void;
  onJumpToSource: (mapPath: string, line?: number) => void;
  onOpenCreateAndMount: (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => void;
  onOpenMountExisting: (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => void;
  onInsertStructure: (
    mapPath: string,
    parentPath: number[] | null,
    tagName: string,
  ) => void;
  onDeleteNode: (mapPath: string, elementPath: number[]) => void;
  onUndoMap: (mapPath: string) => void;
  onRedoMap: (mapPath: string) => void;
  /** Publishing lives next to the map structure: the output is always the active root map. */
  onOpenPublish: () => void;
}

function useContainerDimensions(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 280, height: 420 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

export function MapTreePanel({
  rootMapPath,
  mapBuffers,
  fileSet,
  topicTitles,
  topicTypes,
  ditavals,
  activeDitavalPath = null,
  activeDitaval = null,
  ditavalDisplayMode = 'dim-excluded',
  onSelectDitaval,
  onChangeDitavalDisplayMode,
  selectedMapNode,
  onSelectMapNode,
  onMoveNodes,
  onOpenTopicOrMap,
  onJumpToSource,
  onOpenCreateAndMount,
  onOpenMountExisting,
  onInsertStructure,
  onDeleteNode,
  onUndoMap,
  onRedoMap,
  onOpenPublish,
}: MapTreePanelProps) {
  const { t } = useI18n();
  const treeHostRef = useRef<HTMLDivElement | null>(null);
  const treeApiRef = useRef<TreeApi<CompositeMapTreeNode> | undefined>(undefined);
  const { width, height } = useContainerDimensions(treeHostRef);

  const [search, setSearch] = useState('');
  const [menuTarget, setMenuTarget] = useState<MapNodeMenuTarget | null>(null);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!groupMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(event.target as Node)) {
        setGroupMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGroupMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [groupMenuOpen]);

  const treeResult = useMemo(
    () =>
      buildCompositeMapTree(rootMapPath, mapBuffers, fileSet, topicTitles, {
        ditaval: activeDitaval,
        ditavalDisplayMode,
        topicTypes,
      }),
    [rootMapPath, mapBuffers, fileSet, topicTitles, activeDitaval, ditavalDisplayMode, topicTypes],
  );

  const dragDisabled = Boolean(
    activeDitaval && ditavalDisplayMode === 'hide-excluded' && treeResult.hiddenCount > 0,
  );

  const activeBuffer = rootMapPath ? mapBuffers[rootMapPath] : undefined;
  const isRootDirty = Boolean(activeBuffer && activeBuffer.xml !== activeBuffer.baselineXml);
  const isBookmap = treeResult.parsedRoot?.kind === 'bookmap';
  const canUndo = Boolean(activeBuffer && activeBuffer.undoStack.length > 0);
  const canRedo = Boolean(activeBuffer && activeBuffer.redoStack.length > 0);

  const getMountParentForNode = useCallback(
    (node: CompositeMapTreeNode) => {
      if (node.isSubmapRef && node.resolvedTargetPath && mapBuffers[node.resolvedTargetPath]) {
        return {
          mapPath: node.resolvedTargetPath,
          parentPath: null,
          parentLabel: node.label,
        };
      }
      return {
        mapPath: node.ownerMapPath,
        parentPath: node.elementPath,
        parentLabel: node.label,
      };
    },
    [mapBuffers],
  );

  const NodeRenderer = useMemo(
    () =>
      createMapTreeNodeRenderer({
        ditavalActive: Boolean(activeDitaval),
        ditavalDisplayMode,
        onOpenTarget: (node) => {
          if (node.resolvedTargetPath) {
            onOpenTopicOrMap(node.resolvedTargetPath);
          }
        },
        onOpenContextMenu: (node, x, y, openedByKeyboard, restoreEl) => {
          setMenuTarget({ node, x, y, openedByKeyboard, restoreEl });
        },
        onQuickAddChildTopic: (node) => {
          onOpenCreateAndMount(getMountParentForNode(node));
        },
      }),
    [activeDitaval, ditavalDisplayMode, onOpenTopicOrMap, onOpenCreateAndMount, getMountParentForNode],
  );

  if (!rootMapPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
        <Network className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
        <p>{t('mapTree.noMaps')}</p>
        <p className="mt-1 text-[11px]">{t('mapTree.noMapsHint')}</p>
      </div>
    );
  }

  const isRootSelected =
    selectedMapNode?.mapPath === rootMapPath && selectedMapNode.elementPath === null;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Root Map Header & Quick Actions */}      <div className="border-b border-slate-100 px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onSelectMapNode({ mapPath: rootMapPath, elementPath: null })}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors ${
              isRootSelected
                ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-300'
                : 'hover:bg-slate-100'
            }`}
            title={t('mapTree.rootTooltip', { path: rootMapPath })}
          >
            <span
              className={`shrink-0 rounded px-1 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                isBookmap
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-sky-100 text-sky-800'
              }`}
            >
              {isBookmap ? 'bookmap' : 'map'}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
              {treeResult.parsedRoot?.title ?? rootMapPath}
            </span>
            {isRootDirty ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                title={t('mapTree.dirtyTooltip')}
              />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onJumpToSource(rootMapPath, 1)}
            title={t('mapTree.sourceTooltip')}
            className="dita-mini-btn shrink-0 px-1.5 py-0.5 text-sky-700"
          >
            <Code2 className="h-3 w-3" aria-hidden="true" />
            <span>{t('mapTree.source')}</span>
          </button>
        </div>

        {/* Action Strip */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onOpenCreateAndMount({
                mapPath: rootMapPath,
                parentPath: null,
                parentLabel: treeResult.parsedRoot?.title ?? rootMapPath,
              })
            }
            title={t('mapTree.createMountedTooltip')}
            className="dita-mini-btn px-1.5 py-0.5 text-blue-700"
          >
            <FilePlus2 className="h-3 w-3" aria-hidden="true" />
            <span>{t('mapTree.createMounted')}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenMountExisting({
                mapPath: rootMapPath,
                parentPath: null,
                parentLabel: treeResult.parsedRoot?.title ?? rootMapPath,
              })
            }
            title={t('mapTree.mountExistingTooltip')}
            className="dita-mini-btn px-1.5 py-0.5"
          >
            <Link2 className="h-3 w-3 text-slate-600" aria-hidden="true" />
            <span>{t('mapTree.mountExisting')}</span>
          </button>
          {isBookmap ? (
            <button
              type="button"
              onClick={() => onInsertStructure(rootMapPath, null, 'chapter')}
              title={t('mapTree.insertChapterTooltip')}
              className="dita-mini-btn px-1.5 py-0.5"
            >
              <FolderPlus className="h-3 w-3 text-slate-500" aria-hidden="true" />
              <span>{t('mapTree.chapter')}</span>
            </button>
          ) : (
            <div ref={groupMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setGroupMenuOpen((prev) => !prev)}
                title={t('mapTree.groupMenuTooltip')}
                aria-haspopup="menu"
                aria-expanded={groupMenuOpen}
                className="dita-mini-btn px-1.5 py-0.5"
              >
                <FolderPlus className="h-3 w-3 text-slate-500" aria-hidden="true" />
                <span>{t('mapTree.group')}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
              </button>
              {groupMenuOpen ? (
                <div
                  role="menu"
                  aria-label={t('mapTree.groupMenuAria')}
                  className="dita-ctx-menu absolute top-full right-0 z-40 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setGroupMenuOpen(false);
                      onInsertStructure(rootMapPath, null, 'topichead');
                    }}
                  >
                    <Heading className="dita-ctx-icon text-slate-600" aria-hidden="true" />
                    <span className="flex flex-col">
                      <span>{t('mapTree.groupMenuHeading')}</span>
                      <span className="text-[10px] leading-tight text-slate-500">
                        {t('mapTree.groupMenuHeadingHint')}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setGroupMenuOpen(false);
                      onInsertStructure(rootMapPath, null, 'topicgroup');
                    }}
                  >
                    <Layers className="dita-ctx-icon text-slate-600" aria-hidden="true" />
                    <span className="flex flex-col">
                      <span>{t('mapTree.groupMenuContainer')}</span>
                      <span className="text-[10px] leading-tight text-slate-500">
                        {t('mapTree.groupMenuContainerHint')}
                      </span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <button
            type="button"
            onClick={onOpenPublish}
            title={t('mapTree.publishTooltip')}
            className="dita-mini-btn px-1.5 py-0.5 text-rose-700"
          >
            <Rocket className="h-3 w-3" aria-hidden="true" />
            <span>{t('mapTree.publish')}</span>
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => onUndoMap(rootMapPath)}
              title={t('mapTree.undo')}
              aria-label={t('mapTree.undo')}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => onRedoMap(rootMapPath)}
              title={t('mapTree.redo')}
              aria-label={t('mapTree.redo')}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => treeApiRef.current?.openAll()}
              title={t('mapTree.expandAll')}
              aria-label={t('mapTree.expandAll')}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => treeApiRef.current?.closeAll()}
              title={t('mapTree.collapseAll')}
              aria-label={t('mapTree.collapseAll')}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* DITAVAL Condition Projection Control */}
      <div className="border-b border-slate-100 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <Filter
            className={`h-3 w-3 shrink-0 ${activeDitaval ? 'text-teal-600' : 'text-slate-400'}`}
            aria-hidden="true"
          />
          <label htmlFor="map-ditaval-select" className="sr-only">
            {t('mapTree.ditavalSelect')}
          </label>
          <select
            id="map-ditaval-select"
            value={activeDitavalPath ?? ''}
            onChange={(e) => onSelectDitaval(e.target.value || null)}
            title={
              activeDitavalPath
                ? t('mapTree.ditavalActiveTooltip', { path: activeDitavalPath ?? '' })
                : t('mapTree.ditavalIdleTooltip')
            }
            className={`min-w-0 flex-1 truncate rounded-md border px-1.5 py-1 text-[11px] font-medium focus:border-teal-500 focus:outline-none ${
              activeDitavalPath
                ? 'border-teal-300 bg-teal-50/70 text-teal-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <option value="">{t('mapTree.ditavalOff')}</option>
            {ditavals.map((dv) => (
              <option key={dv.path} value={dv.path}>
                {dv.name} ({t('mapTree.ruleCount', { count: dv.ruleCount })})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-1 flex min-w-0 items-center justify-between gap-1">
          <div
            role="group"
            aria-label={t('mapTree.ditavalModeAria')}
            className="flex items-center rounded-md border border-slate-200 bg-slate-100/90 p-0.5"
          >
            {(
              [
                { id: 'show-all', label: t('mapTree.view.showAll'), title: t('mapTree.view.showAllTitle') },
                { id: 'dim-excluded', label: t('mapTree.view.dim'), title: t('mapTree.view.dimTitle') },
                { id: 'hide-excluded', label: t('mapTree.view.hide'), title: t('mapTree.view.hideTitle') },
              ] as const
            ).map((opt) => {
              const active = ditavalDisplayMode === opt.id;
              const disabled = !activeDitavalPath && opt.id !== 'show-all';
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => onChangeDitavalDisplayMode(opt.id)}
                  title={disabled ? t('mapTree.ditavalPickFirst') : opt.title}
                  className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors disabled:opacity-40 ${
                    active ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {activeDitaval ? (
            <span
              className="min-w-0 truncate font-mono text-[10px] text-teal-800"
              title={t('mapTree.ditavalCurrent', { path: activeDitavalPath ?? '' })}
            >
              {treeResult.hiddenCount > 0
                ? t('mapTree.hiddenCount', { count: treeResult.hiddenCount })
                : treeResult.excludedCount > 0
                  ? t('mapTree.excludedCount', { count: treeResult.excludedCount })
                  : t('mapTree.allPass')}
              {treeResult.flaggedCount > 0 ? t('mapTree.flaggedCount', { count: treeResult.flaggedCount }) : ''}
            </span>
          ) : null}
        </div>
      </div>

      {/* Filter Input */}
      <div className="border-b border-slate-100 px-2.5 py-1.5">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2 h-3 w-3 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('mapTree.searchPlaceholder')}
            aria-label={t('mapTree.searchAria')}
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pr-2 pl-6 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Parse Error Banner if Map XML was broken in Source Mode */}
      {treeResult.parseError ? (
        <div className="m-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
            <span>{t('mapTree.parseFailed')}</span>
          </div>
          <p className="mt-1 font-mono text-[11px] text-rose-700">
            L{treeResult.parseError.line}:{treeResult.parseError.column} —{' '}
            {treeResult.parseError.message}
          </p>
          <button
            type="button"
            onClick={() => onJumpToSource(rootMapPath, treeResult.parseError?.line)}
            className="mt-2 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-500"
          >
            {t('mapTree.fixInSource')}
          </button>
        </div>
      ) : null}

      {/* Virtualized Drag-and-Drop Map Tree (react-arborist) */}
      <div
        ref={treeHostRef}
        className="dita-map-tree-host min-h-0 flex-1 overflow-hidden px-1 py-1"
      >
        {!treeResult.parseError && treeResult.nodes.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <p>{t('mapTree.empty')}</p>
            <p className="mt-1">{t('mapTree.emptyHint')}</p>
          </div>
        ) : (
          <Tree<CompositeMapTreeNode>
            ref={treeApiRef}
            data={treeResult.nodes}
            width={width}
            height={height}
            rowHeight={30}
            indent={16}
            padding={6}
            openByDefault={true}
            disableEdit={true}
            disableDrag={dragDisabled}
            disableDrop={dragDisabled}
            searchTerm={search}
            searchMatch={(node, term) => {
              const q = term.toLowerCase();
              const d = node.data;
              return (
                d.label.toLowerCase().includes(q) ||
                (d.href?.toLowerCase().includes(q) ?? false) ||
                (d.keys?.toLowerCase().includes(q) ?? false) ||
                d.tagName.toLowerCase().includes(q)
              );
            }}
            onSelect={(selected) => {
              const first = selected[0];
              if (!first) return;
              onSelectMapNode({
                mapPath: first.data.ownerMapPath,
                elementPath: first.data.elementPath,
              });
            }}
            onActivate={(node) => {
              if (node.data.resolvedTargetPath) {
                onOpenTopicOrMap(node.data.resolvedTargetPath);
              }
            }}
            onMove={({ dragNodes, parentNode, index }) => {
              onMoveNodes(
                dragNodes.map((n) => n.data),
                parentNode ? parentNode.data : null,
                index,
              );
            }}
          >
            {NodeRenderer}
          </Tree>
        )}
      </div>

      {/* Footer Hint */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-2.5 py-1 text-[10.5px] text-slate-400">
        {t('mapTree.footerHint')}
      </div>

      {/* Native Popover Context Menu */}
      <MapNodeContextMenu
        target={menuTarget}
        isBookmap={isBookmap}
        onClose={() => setMenuTarget(null)}
        onOpenTarget={(node) => {
          if (node.resolvedTargetPath) onOpenTopicOrMap(node.resolvedTargetPath);
        }}
        onViewSource={(node) => onJumpToSource(node.ownerMapPath, node.line)}
        onCreateChildTopic={(node) => onOpenCreateAndMount(getMountParentForNode(node))}
        onMountExisting={(node) => onOpenMountExisting(getMountParentForNode(node))}
        onInsertStructure={(node, tagName) => {
          const parent = getMountParentForNode(node);
          onInsertStructure(parent.mapPath, parent.parentPath, tagName);
        }}
        onInspectNode={(node) =>
          onSelectMapNode({ mapPath: node.ownerMapPath, elementPath: node.elementPath })
        }
        onRemoveNode={(node) => onDeleteNode(node.ownerMapPath, node.elementPath)}
      />
    </div>
  );
}
