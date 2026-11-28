import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  Search,
  Undo2,
} from 'lucide-react';
import type { WorkspaceDitavalSummary, WorkspaceMapSummary } from '../services/workspace-api';
import {
  buildCompositeMapTree,
  stripKeydefNodes,
  type CompositeMapTreeNode,
  type MapBufferState,
} from './map-tree-utils';
import { MapNodeContextMenu, type MapNodeMenuTarget } from './MapNodeContextMenu';
import { MapTargetFixPopover, type MapTargetFixTarget } from './MapTargetFixPopover';
import { RootMapSwitcher } from './RootMapSwitcher';
import { ToolbarMenu } from './ToolbarMenu';
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
  /** Every map of the workspace, offered by the header dropdown (switch + set as default). */
  maps?: WorkspaceMapSummary[];
  /** Activates another map as the tree root; omit to keep the header switcher read-only. */
  onSelectRootMap?: (mapPath: string) => void;
  /** Manual-level default root map (the map the workbench opens with). */
  defaultRootMap?: string | null;
  /** Pins `defaultRootMap`; omitted for viewers, read-only sessions and the offline demo. */
  onSetDefaultRootMap?: (mapPath: string) => void;
  onMoveNodes: (
    dragNodes: CompositeMapTreeNode[],
    targetParent: CompositeMapTreeNode | null,
    index: number,
  ) => void;
  onOpenTopicOrMap: (filePath: string) => void;
  onJumpToSource: (mapPath: string, line?: number) => void;
  onOpenCreateAndMount: (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => void;
  onOpenMountExisting: (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => void;
  /** Phase 14 — import a document and mount the generated topics under this node. */
  onOpenIngestTopic?: (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => void;
  onInsertStructure: (
    mapPath: string,
    parentPath: number[] | null,
    tagName: string,
  ) => void;
  onDeleteNode: (mapPath: string, elementPath: number[]) => void;
  /** Creates the topic a dangling `topicref` points at, keeping the node and its `href` intact. */
  onCreateMissingTarget: (node: CompositeMapTreeNode) => void;
  onUndoMap: (mapPath: string) => void;
  onRedoMap: (mapPath: string) => void;
  /** Kept optional for backward compatibility — publishing now lives in the WorkbenchHeader. */
  onOpenPublish?: () => void;
  /** `tree` shows the structure, `keys` shows the keyspace of the same root map. */
  viewMode: 'tree' | 'keys';
  onChangeViewMode: (view: 'tree' | 'keys') => void;
  keyCount: number;
  /** The keyspace panel, hosted here so keys live next to the map that defines them. */
  keyspaceSlot: ReactNode;
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

export interface MountMenuTarget {
  mapPath: string;
  parentPath: number[] | null;
  parentLabel: string;
}

export interface MountMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapPath: string;
  parentLabel: string;
  onCreateAndMount: (target: MountMenuTarget) => void;
  onMountExisting: (target: MountMenuTarget) => void;
}

/**
 * Merged "Mount" entry point: creating a topic and mounting an existing one answer the same
 * question, so they live in one dropdown instead of two competing buttons in the action strip.
 * The dropdown is a `ToolbarMenu` (top-layer popover), so the panel only tracks *which* sibling
 * menu (mount vs. group) is open.
 */
export function MountMenu({
  open,
  onOpenChange,
  mapPath,
  parentLabel,
  onCreateAndMount,
  onMountExisting,
}: MountMenuProps) {
  const { t } = useI18n();
  const target: MountMenuTarget = { mapPath, parentPath: null, parentLabel };

  return (
    <ToolbarMenu
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel={t('mapTree.mountMenuAria')}
      triggerTitle={t('mapTree.mountMenuTooltip')}
      triggerClassName="text-blue-700"
      triggerContent={
        <>
          <FilePlus2 className="h-3 w-3" aria-hidden="true" />
          <span>{t('mapTree.mountMenu')}</span>
          <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
        </>
      }
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onOpenChange(false);
          onCreateAndMount(target);
        }}
      >
        <FilePlus2 className="dita-ctx-icon text-blue-700" aria-hidden="true" />
        <span className="flex flex-col">
          <span>{t('mapTree.createMounted')}</span>
          <span className="text-[10px] leading-tight text-slate-500">
            {t('mapTree.createMountedTooltip')}
          </span>
        </span>
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onOpenChange(false);
          onMountExisting(target);
        }}
      >
        <Link2 className="dita-ctx-icon text-slate-600" aria-hidden="true" />
        <span className="flex flex-col">
          <span>{t('mapTree.mountExisting')}</span>
          <span className="text-[10px] leading-tight text-slate-500">
            {t('mapTree.mountExistingTooltip')}
          </span>
        </span>
      </button>
    </ToolbarMenu>
  );
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
  maps = [],
  onSelectRootMap,
  defaultRootMap = null,
  onSetDefaultRootMap,
  onMoveNodes,
  onOpenTopicOrMap,
  onJumpToSource,
  onOpenCreateAndMount,
  onOpenMountExisting,
  onOpenIngestTopic,
  onInsertStructure,
  onDeleteNode,
  onCreateMissingTarget,
  onUndoMap,
  onRedoMap,
  viewMode,
  onChangeViewMode,
  keyCount,
  keyspaceSlot,
}: MapTreePanelProps) {
  const { t } = useI18n();
  const treeHostRef = useRef<HTMLDivElement | null>(null);
  const treeApiRef = useRef<TreeApi<CompositeMapTreeNode> | undefined>(undefined);
  const { width, height } = useContainerDimensions(treeHostRef);

  const [search, setSearch] = useState('');
  const [menuTarget, setMenuTarget] = useState<MapNodeMenuTarget | null>(null);
  const [fixTarget, setFixTarget] = useState<MapTargetFixTarget | null>(null);
  // Progressive disclosure: the three DITAVAL projection modes only matter once the author is
  // consciously filtering, so the drawer starts collapsed when no .ditaval is active.
  const [ditavalFilterOpen, setDitavalFilterOpen] = useState(false);
  // A .ditaval that is already active keeps its projection controls visible; with none selected the
  // strip only appears on demand, so read-only browsing is not cluttered by disabled buttons.
  const showDitavalStrip = Boolean(activeDitavalPath) || ditavalFilterOpen;
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [mountMenuOpen, setMountMenuOpen] = useState(false);
  const [rootMapMenuOpen, setRootMapMenuOpen] = useState(false);

  const treeResult = useMemo(
    () =>
      buildCompositeMapTree(rootMapPath, mapBuffers, fileSet, topicTitles, {
        ditaval: activeDitaval,
        ditavalDisplayMode,
        topicTypes,
      }),
    [rootMapPath, mapBuffers, fileSet, topicTitles, activeDitaval, ditavalDisplayMode, topicTypes],
  );

  // Keys live in the Keyspace tab, never as structure rows.
  const treeNodes = useMemo(() => stripKeydefNodes(treeResult.nodes), [treeResult.nodes]);

  const dragDisabled = Boolean(
    activeDitaval && ditavalDisplayMode === 'hide-excluded' && treeResult.hiddenCount > 0,
  );

  const activeBuffer = rootMapPath ? mapBuffers[rootMapPath] : undefined;
  const isRootDirty = Boolean(activeBuffer && activeBuffer.xml !== activeBuffer.baselineXml);
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
          setFixTarget(null);
          setMenuTarget({ node, x, y, openedByKeyboard, restoreEl });
        },
        onOpenTargetFix: (node, x, y, openedByKeyboard, restoreEl) => {
          setMenuTarget(null);
          setFixTarget({ node, x, y, openedByKeyboard, restoreEl });
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
      {/* Root Map Header & Quick Actions */}
      {/* `relative z-20` keeps the root-map dropdown above the tab strip and the tree it overlays. */}
      <div className="relative z-20 border-b border-slate-100 px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <RootMapSwitcher
            rootMapPath={rootMapPath}
            rootTitle={treeResult.parsedRoot?.title ?? rootMapPath}
            isDirty={isRootDirty}
            isRootSelected={isRootSelected}
            maps={maps}
            open={rootMapMenuOpen}
            onOpenChange={setRootMapMenuOpen}
            onSelectRootMap={(mapPath) => {
              // Activating a root map reloads buffers and semantics, so it belongs to the store;
              // without a host handler the header still moves the tree selection.
              if (onSelectRootMap) onSelectRootMap(mapPath);
              else onSelectMapNode({ mapPath, elementPath: null });
            }}
            onInspectRoot={() => onSelectMapNode({ mapPath: rootMapPath, elementPath: null })}
            defaultRootMap={defaultRootMap}
            {...(onSetDefaultRootMap ? { onSetDefaultRootMap } : {})}
          />

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
      </div>

      {/* 2. Structure / Keyspace switch — Keys live with the map that defines them */}
      <div className="border-b border-slate-100 px-2.5 py-1.5">
        <div
          role="tablist"
          aria-label={t('mapPanel.switchAria')}
          className="flex items-center rounded-md border border-slate-200 bg-slate-100/90 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'tree'}
            onClick={() => onChangeViewMode('tree')}
            className={`flex-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors ${
              viewMode === 'tree'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('mapPanel.tree')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'keys'}
            onClick={() => onChangeViewMode('keys')}
            className={`flex-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors ${
              viewMode === 'keys'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t('mapPanel.keys', { count: keyCount })}
          </button>
        </div>
      </div>

      {/* 3. Action strip is tree-mode only: the Keys view is driven by the keyspace panel.
          Publishing now lives in the WorkbenchHeader, so this row stays map-structure work. */}
      {viewMode === 'tree' ? (
        /* `relative` lets the group dropdown anchor to the whole strip instead of the narrow
           button: a `right-0` menu inside a 70px button wrapper overflowed the panel and was
           clipped by the sidebar's `overflow-hidden`. */
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2.5 py-1.5">
            {/* One "Mount" entry point: creating a topic and mounting an existing one are two
                answers to the same question, so they live in one menu instead of two buttons. */}
            <MountMenu
              open={mountMenuOpen}
              onOpenChange={(next) => {
                setMountMenuOpen(next);
                if (next) setGroupMenuOpen(false);
              }}
              mapPath={rootMapPath}
              parentLabel={treeResult.parsedRoot?.title ?? rootMapPath}
              onCreateAndMount={onOpenCreateAndMount}
              onMountExisting={onOpenMountExisting}
            />
            <ToolbarMenu
              open={groupMenuOpen}
              onOpenChange={(next) => {
                setGroupMenuOpen(next);
                if (next) setMountMenuOpen(false);
              }}
              ariaLabel={t('mapTree.groupMenuAria')}
              triggerTitle={t('mapTree.groupMenuTooltip')}
              triggerContent={
                <>
                  <FolderPlus className="h-3 w-3 text-slate-500" aria-hidden="true" />
                  <span>{t('mapTree.group')}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                </>
              }
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
            </ToolbarMenu>

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
        ) : null}

      {viewMode === 'keys' ? (
        <div className="min-h-0 flex-1 overflow-hidden">{keyspaceSlot}</div>
      ) : (
        <>
      {/* 4. Search + conditional filtering share one row: the three projection modes are inert
          without a .ditaval, so they are disclosed together with the filter strip. */}
      <div className="border-b border-slate-100 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="relative flex min-w-0 flex-1 items-center">
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
          {ditavals.length > 0 ? (
            <button
              type="button"
              aria-expanded={showDitavalStrip}
              aria-controls="map-ditaval-filter"
              aria-label={t('mapTree.ditavalToggleAria')}
              title={t('mapTree.ditavalToggleTitle')}
              data-ditaval-active={activeDitavalPath ? 'true' : 'false'}
              onClick={() => setDitavalFilterOpen((open) => !open)}
              className={`dita-mini-btn shrink-0 px-1.5 py-1 ${
                activeDitavalPath
                  ? 'border-teal-300 bg-teal-50 text-teal-800'
                  : 'text-slate-500'
              }`}
            >
              <Filter className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {showDitavalStrip ? (
          <div
            id="map-ditaval-filter"
            className="mt-1.5 rounded-md border border-teal-200 bg-teal-50/60 p-1.5"
          >
            <div className="flex min-w-0 items-center gap-1.5">
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

          <div
            role="group"
            aria-label={t('mapTree.ditavalModeAria')}
            className="flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-100/90 p-0.5"
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
                  className={`rounded px-1 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                    active ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeDitaval ? (
          <span
            className="mt-1 block min-w-0 truncate font-mono text-[10px] text-teal-800"
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
        ) : null}
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
        {!treeResult.parseError && treeNodes.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            <p>{t('mapTree.empty')}</p>
            <p className="mt-1">{t('mapTree.emptyHint')}</p>
            <p className="mt-2 text-[10.5px] text-slate-400">{t('mapTree.footerHint')}</p>
          </div>
        ) : (
          <Tree<CompositeMapTreeNode>
            ref={treeApiRef}
            data={treeNodes}
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

        </>
      )}

      {/* Native Popover Context Menu */}
      <MapNodeContextMenu
        target={menuTarget}
        onClose={() => setMenuTarget(null)}
        onOpenTarget={(node) => {
          if (node.resolvedTargetPath) onOpenTopicOrMap(node.resolvedTargetPath);
        }}
        onViewSource={(node) => onJumpToSource(node.ownerMapPath, node.line)}
        onCreateChildTopic={(node) => onOpenCreateAndMount(getMountParentForNode(node))}
        onMountExisting={(node) => onOpenMountExisting(getMountParentForNode(node))}
        {...(onOpenIngestTopic
          ? { onImportTopics: (node) => onOpenIngestTopic(getMountParentForNode(node)) }
          : {})}
        onInsertStructure={(node, tagName) => {
          const parent = getMountParentForNode(node);
          onInsertStructure(parent.mapPath, parent.parentPath, tagName);
        }}
        onInspectNode={(node) =>
          onSelectMapNode({ mapPath: node.ownerMapPath, elementPath: node.elementPath })
        }
        onRemoveNode={(node) => onDeleteNode(node.ownerMapPath, node.elementPath)}
      />

      {/* “Target not created yet” quick fix */}
      <MapTargetFixPopover
        target={fixTarget}
        onClose={() => setFixTarget(null)}
        onCreateTarget={(node) => onCreateMissingTarget(node)}
        onEditHref={(node) =>
          onSelectMapNode({ mapPath: node.ownerMapPath, elementPath: node.elementPath })
        }
        onRemoveNode={(node) => onDeleteNode(node.ownerMapPath, node.elementPath)}
      />
    </div>
  );
}

