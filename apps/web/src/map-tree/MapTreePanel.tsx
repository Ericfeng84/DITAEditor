import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tree, type TreeApi } from 'react-arborist';
import {
  AlertTriangle,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  FilePlus2,
  FolderPlus,
  Link2,
  Network,
  Redo2,
  Search,
  Undo2,
} from 'lucide-react';
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
}: MapTreePanelProps) {
  const treeHostRef = useRef<HTMLDivElement | null>(null);
  const treeApiRef = useRef<TreeApi<CompositeMapTreeNode> | undefined>(undefined);
  const { width, height } = useContainerDimensions(treeHostRef);

  const [search, setSearch] = useState('');
  const [menuTarget, setMenuTarget] = useState<MapNodeMenuTarget | null>(null);

  const treeResult = useMemo(
    () => buildCompositeMapTree(rootMapPath, mapBuffers, fileSet, topicTitles),
    [rootMapPath, mapBuffers, fileSet, topicTitles],
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
    [onOpenTopicOrMap, onOpenCreateAndMount, getMountParentForNode],
  );

  if (!rootMapPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
        <Network className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
        <p>当前工作区暂无 .ditamap 或 .bookmap 文件</p>
        <p className="mt-1 text-[11px]">请在“项目文件”页签点击新建 Map。</p>
      </div>
    );
  }

  const isRootSelected =
    selectedMapNode?.mapPath === rootMapPath && selectedMapNode.elementPath === null;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Root Map Header & Quick Actions */}
      <div className="border-b border-slate-100 px-2.5 py-2">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onSelectMapNode({ mapPath: rootMapPath, elementPath: null })}
            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left transition-colors ${
              isRootSelected
                ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-300'
                : 'hover:bg-slate-100'
            }`}
            title={`点击选中根节点：${rootMapPath}`}
          >
            <span
              className={`shrink-0 rounded px-1 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                isBookmap
                  ? 'bg-violet-100 text-violet-800'
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
                title="Map 有未保存的结构更改"
              />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onJumpToSource(rootMapPath, 1)}
            title="查看 / 编辑当前 Map 的 XML 源码"
            className="dita-mini-btn shrink-0 px-1.5 py-0.5 text-sky-700"
          >
            <Code2 className="h-3 w-3" aria-hidden="true" />
            <span>源码</span>
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
            title="新建 Topic 并挂载到当前 Map 根节点"
            className="dita-mini-btn px-1.5 py-0.5 text-indigo-700"
          >
            <FilePlus2 className="h-3 w-3" aria-hidden="true" />
            <span>新建挂载</span>
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
            title="挂载工作区中已有的 Topic 或子 Map"
            className="dita-mini-btn px-1.5 py-0.5"
          >
            <Link2 className="h-3 w-3 text-slate-600" aria-hidden="true" />
            <span>挂载已有</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onInsertStructure(
                rootMapPath,
                null,
                isBookmap ? 'chapter' : 'topichead',
              )
            }
            title={isBookmap ? '插入空章 <chapter>' : '插入分组标题 <topichead>'}
            className="dita-mini-btn px-1.5 py-0.5"
          >
            <FolderPlus className="h-3 w-3 text-amber-600" aria-hidden="true" />
            <span>{isBookmap ? '章' : '分组'}</span>
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => onUndoMap(rootMapPath)}
              title="撤销 Map 结构修改"
              aria-label="撤销 Map 结构修改"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={() => onRedoMap(rootMapPath)}
              title="重做 Map 结构修改"
              aria-label="重做 Map 结构修改"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => treeApiRef.current?.openAll()}
              title="全部展开"
              aria-label="全部展开"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => treeApiRef.current?.closeAll()}
              title="全部折叠"
              aria-label="全部折叠"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
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
            placeholder="搜索章节标题、href 或 key..."
            aria-label="搜索 Map 树节点"
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pr-2 pl-6 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Parse Error Banner if Map XML was broken in Source Mode */}
      {treeResult.parseError ? (
        <div className="m-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
            <span>Map XML 解析失败</span>
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
            切到源码修复
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
            <p>当前 Map 暂无目录节点。</p>
            <p className="mt-1">点击上方“新建挂载”或“挂载已有”开始编排。</p>
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
        提示：拖拽节点可调层级与跨子图移动 · 双击打开 Topic · 右键更多操作
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
