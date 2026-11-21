import type { NodeRendererProps } from 'react-arborist';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  KeyRound,
  Layers,
  MoreVertical,
  Network,
} from 'lucide-react';
import type { CompositeMapTreeNode } from './map-tree-utils';

export interface MapNodeRowActions {
  onOpenTarget: (node: CompositeMapTreeNode) => void;
  onOpenContextMenu: (
    node: CompositeMapTreeNode,
    x: number,
    y: number,
    openedByKeyboard: boolean,
    restoreEl: HTMLElement | null,
  ) => void;
  onQuickAddChildTopic: (node: CompositeMapTreeNode) => void;
}

function NodeKindIcon({ data }: { data: CompositeMapTreeNode }) {
  if (data.isSubmapRef) {
    return <Network className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />;
  }
  if (data.tagName === 'keydef') {
    return <KeyRound className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />;
  }
  if (data.tagName === 'topichead' || data.tagName === 'part') {
    return <Folder className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />;
  }
  if (data.tagName === 'topicgroup' || data.tagName === 'frontmatter' || data.tagName === 'backmatter') {
    return <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
  if (data.tagName === 'chapter' || data.tagName === 'appendix' || data.tagName === 'preface') {
    return <BookMarked className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden="true" />;
  }
  if (data.topicType === 'concept') {
    return <BookOpen className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden="true" />;
  }
  return <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />;
}

const TAG_PILL_STYLES: Record<string, string> = {
  mapref: 'bg-sky-100 text-sky-800',
  chapter: 'bg-indigo-100 text-indigo-800',
  part: 'bg-amber-100 text-amber-800',
  appendix: 'bg-purple-100 text-purple-800',
  keydef: 'bg-violet-100 text-violet-800',
  topichead: 'bg-amber-50 text-amber-700',
  topicgroup: 'bg-slate-100 text-slate-600',
};

export function createMapTreeNodeRenderer(actions: MapNodeRowActions) {
  return function MapTreeNodeRenderer({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<CompositeMapTreeNode>) {
    const data = node.data;
    const hasExpandable = Boolean(data.children && data.children.length > 0);
    const hasBrokenTarget = Boolean(data.href && !data.targetExists);
    const tagPillStyle = TAG_PILL_STYLES[data.tagName] ?? 'bg-slate-100 text-slate-600';

    return (
      <div
        ref={dragHandle}
        style={style}
        onDoubleClick={() => {
          if (data.resolvedTargetPath) {
            actions.onOpenTarget(data);
          } else if (hasExpandable) {
            node.toggle();
          }
        }}
        onContextMenu={(ev) => {
          ev.preventDefault();
          node.select();
          actions.onOpenContextMenu(
            data,
            ev.clientX,
            ev.clientY,
            false,
            ev.currentTarget,
          );
        }}
        className={`dita-map-row group flex items-center gap-1 rounded-md pr-1.5 text-xs select-none ${
          node.isSelected
            ? 'bg-indigo-50 text-indigo-950 ring-1 ring-indigo-300/80'
            : node.willReceiveDrop
              ? 'bg-sky-50 ring-1 ring-sky-400'
              : 'text-slate-700 hover:bg-slate-100/90'
        } ${data.isSubmapChild ? 'border-l-2 border-sky-200' : ''}`}
      >
        {/* Expand / Collapse Chevron */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(ev) => {
            ev.stopPropagation();
            if (hasExpandable) node.toggle();
          }}
          aria-label={node.isOpen ? '折叠子节点' : '展开子节点'}
          className={`flex h-5 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-700 ${
            hasExpandable ? 'visible' : 'invisible'
          }`}
        >
          {node.isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        {/* Semantic Icon */}
        <NodeKindIcon data={data} />

        {/* Label */}
        <span
          className={`min-w-0 flex-1 truncate font-medium ${
            hasBrokenTarget || data.isCyclicRef ? 'text-rose-700' : ''
          }`}
          title={[
            data.label,
            data.href ? `href: ${data.href}` : null,
            data.isSubmapChild ? `所属子地图: ${data.ownerMapPath}` : null,
            hasBrokenTarget ? '⚠ 找不到目标文件' : null,
            data.isCyclicRef ? '⚠ 检测到循环 <mapref>' : null,
          ]
            .filter(Boolean)
            .join('\n')}
        >
          {data.label}
        </span>

        {/* Broken Link / Cycle Warning */}
        {hasBrokenTarget || data.isCyclicRef ? (
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0 text-rose-500"
            aria-label={data.isCyclicRef ? '循环子地图引用' : '目标文件不存在'}
          />
        ) : null}

        {/* Compact Tag Pill */}
        {data.tagName !== 'topicref' ? (
          <span
            className={`shrink-0 rounded px-1 py-0.2 font-mono text-[9.5px] font-semibold ${tagPillStyle}`}
          >
            {data.tagName}
          </span>
        ) : null}

        {/* Hover Actions */}
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {data.tagName !== 'keydef' ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={(ev) => {
                ev.stopPropagation();
                actions.onQuickAddChildTopic(data);
              }}
              title="在该节点下新建子 Topic 并挂载"
              aria-label="新建子 Topic 并挂载"
              className="rounded p-0.5 text-slate-400 hover:bg-indigo-100 hover:text-indigo-700"
            >
              <FilePlus2 className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            onClick={(ev) => {
              ev.stopPropagation();
              const rect = ev.currentTarget.getBoundingClientRect();
              actions.onOpenContextMenu(
                data,
                rect.right,
                rect.bottom + 2,
                ev.detail === 0,
                ev.currentTarget,
              );
            }}
            title="节点操作菜单"
            aria-label="打开节点操作菜单"
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
          >
            <MoreVertical className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };
}
