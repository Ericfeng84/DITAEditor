import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { XmlParseError } from '@dita/core';
import {
  AlertTriangle,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronDown,
  ChevronRight,
  Code2,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Info,
  Layers,
  List as ListIcon,
  ListChecks,
  ListOrdered,
  ListTree,
  PanelLeftClose,
  Search,
  SquareCheckBig,
  StickyNote,
  Table2,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import {
  filterOutlineTree,
  type OutlineDensity,
  type OutlineNode,
  type OutlineNodeCategory,
} from './outline-model.js';
import type { OutlineDropBlockReason, OutlineDropEvaluation, OutlineDropPlacement } from './outline-dnd.js';
import { useOutlineDrag } from './use-outline-drag.js';

export interface DocumentOutlinePanelProps {
  nodes: readonly OutlineNode[];
  activeNodeId: string | null;
  density: OutlineDensity;
  onChangeDensity: (density: OutlineDensity) => void;
  readOnly?: boolean;
  xmlError?: XmlParseError | null;
  onJumpToXmlError?: () => void;
  onLocateNode: (node: OutlineNode) => void;
  onEvaluateDrop: (sourcePos: number, targetPos: number, placement: OutlineDropPlacement) => OutlineDropEvaluation;
  onMoveNode: (sourcePos: number, targetPos: number, placement: OutlineDropPlacement) => boolean;
  onCollapse: () => void;
}

interface OutlineRow {
  node: OutlineNode;
  hasChildren: boolean;
  expanded: boolean;
}

/** One semantic icon per `OutlineNodeCategory`, staying inside the panel's 14px optical size. */
function CategoryIcon({ category }: { category: OutlineNodeCategory }) {
  const className = 'h-3 w-3 shrink-0';
  switch (category) {
    case 'topic':
      return <FileText className={className} aria-hidden="true" />;
    case 'section':
      return <Layers className={className} aria-hidden="true" />;
    case 'task':
      return <ListChecks className={className} aria-hidden="true" />;
    case 'step':
      return <ListOrdered className={className} aria-hidden="true" />;
    case 'media':
      return <ImageIcon className={className} aria-hidden="true" />;
    case 'table':
      return <Table2 className={className} aria-hidden="true" />;
    case 'list':
      return <ListIcon className={className} aria-hidden="true" />;
    case 'code':
      return <Code2 className={className} aria-hidden="true" />;
    case 'note':
      return <StickyNote className={className} aria-hidden="true" />;
    case 'metadata':
      return <Info className={className} aria-hidden="true" />;
    case 'block':
    default:
      return <SquareCheckBig className={className} aria-hidden="true" />;
  }
}

function collectExpandableIds(nodes: readonly OutlineNode[], into: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.add(node.id);
      collectExpandableIds(node.children, into);
    }
  }
  return into;
}

/** Depth-first flatten of the visible rows: collapsed parents hide their whole subtree. */
function flattenVisibleRows(
  nodes: readonly OutlineNode[],
  collapsed: ReadonlySet<string>,
  expandAll: boolean,
): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const walk = (list: readonly OutlineNode[]) => {
    for (const node of list) {
      const hasChildren = node.children.length > 0;
      const expanded = hasChildren && (expandAll || !collapsed.has(node.id));
      rows.push({ node, hasChildren, expanded });
      if (expanded) walk(node.children);
    }
  };
  walk(nodes);
  return rows;
}

export function DocumentOutlinePanel({
  nodes,
  activeNodeId,
  density,
  onChangeDensity,
  readOnly = false,
  xmlError,
  onJumpToXmlError,
  onLocateNode,
  onEvaluateDrop,
  onMoveNode,
  onCollapse,
}: DocumentOutlinePanelProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const filteredNodes = useMemo(() => filterOutlineTree(nodes, search), [nodes, search]);
  const searching = search.trim().length > 0;
  const rows = useMemo(() => flattenVisibleRows(filteredNodes, collapsed, searching), [filteredNodes, collapsed, searching]);

  const { draggingPos, dropIndicator, ghost, startDrag } = useOutlineDrag({
    onEvaluateDrop,
    onDrop: onMoveNode,
    scrollContainerRef: scrollRef,
    disabled: readOnly,
  });

  const focusRowAt = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      setFocusedId(row.node.id);
      const element = listRef.current?.querySelector<HTMLElement>(`[data-outline-id="${row.node.id}"]`);
      element?.focus();
    },
    [rows],
  );

  // Follow the caret without hijacking the reading position while a drag is in flight.
  useEffect(() => {
    if (!activeNodeId || draggingPos !== null) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-outline-id="${activeNodeId}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [activeNodeId, draggingPos, rows.length]);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set<string>()), []);
  const collapseAll = useCallback(() => setCollapsed(collectExpandableIds(nodes, new Set<string>())), [nodes]);

  const findVisibleSibling = useCallback(
    (index: number, direction: -1 | 1): OutlineRow | null => {
      const current = rows[index];
      if (!current) return null;
      for (let i = index + direction; i >= 0 && i < rows.length; i += direction) {
        const candidate = rows[i];
        if (!candidate) return null;
        if (candidate.node.depth === current.node.depth) return candidate;
        if (candidate.node.depth < current.node.depth) return null;
      }
      return null;
    },
    [rows],
  );

  const handleRowKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
      const row = rows[index];
      if (!row) return;
      const { node } = row;

      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        if (readOnly || !node.canDrag) return;
        const direction: -1 | 1 = event.key === 'ArrowUp' ? -1 : 1;
        const sibling = findVisibleSibling(index, direction);
        if (!sibling) return;
        event.preventDefault();
        onMoveNode(node.pmPos, sibling.node.pmPos, direction < 0 ? 'before' : 'after');
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusRowAt(Math.min(index + 1, rows.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusRowAt(Math.max(index - 1, 0));
          break;
        case 'ArrowRight': {
          event.preventDefault();
          if (row.hasChildren && !row.expanded) {
            toggleCollapsed(node.id);
            return;
          }
          const firstChild = rows[index + 1];
          if (firstChild && firstChild.node.depth > node.depth) focusRowAt(index + 1);
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (row.hasChildren && row.expanded) {
            toggleCollapsed(node.id);
            return;
          }
          for (let i = index - 1; i >= 0; i -= 1) {
            const candidate = rows[i];
            if (candidate && candidate.node.depth < node.depth) {
              focusRowAt(i);
              break;
            }
          }
          break;
        }
        case 'Enter':
        case ' ':
          event.preventDefault();
          onLocateNode(node);
          break;
        default:
          break;
      }
    },
    [rows, readOnly, findVisibleSibling, focusRowAt, toggleCollapsed, onLocateNode, onMoveNode],
  );

  const renderRow = (row: OutlineRow, index: number): ReactNode => {
    const { node, hasChildren, expanded } = row;
    const isActive = node.id === activeNodeId;
    const drop = dropIndicator && dropIndicator.targetPos === node.pmPos ? dropIndicator : null;
    const dropClass = drop
      ? `dita-outline-drop-${drop.placement}${drop.ok ? '' : ' dita-outline-drop-invalid'}`
      : '';
    const titleParts = [`<${node.tagName}>`];
    if (node.ditaId) titleParts.push(`#${node.ditaId}`);
    if (node.label && node.label !== node.tagName) titleParts.push(node.label);

    return (
      <div
        key={node.id}
        role="treeitem"
        aria-level={node.depth + 1}
        aria-selected={isActive}
        aria-expanded={hasChildren ? expanded : undefined}
        data-outline-pos={String(node.pmPos)}
        data-outline-id={node.id}
        data-outline-container={node.canAcceptChildren ? 'true' : undefined}
        data-outline-tag={node.tagName}
        tabIndex={focusedId === null ? (index === 0 ? 0 : -1) : focusedId === node.id ? 0 : -1}
        title={titleParts.join(' · ')}
        onClick={() => onLocateNode(node)}
        onFocus={() => setFocusedId(node.id)}
        onKeyDown={(event) => handleRowKeyDown(event, index)}
        className={`dita-outline-row group flex h-7 cursor-pointer items-center gap-1 rounded-[5px] pe-1 text-[11px] leading-none outline-none ${
          isActive ? 'bg-blue-50 font-medium text-blue-900' : 'text-slate-700 hover:bg-slate-100'
        } ${dropClass} ${draggingPos === node.pmPos ? 'opacity-45' : ''}`}
        style={{ paddingInlineStart: `${4 + node.depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              toggleCollapsed(node.id);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            {expanded ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden="true" />
        )}

        <span className={isActive ? 'shrink-0 text-blue-600' : 'shrink-0 text-slate-400'}>
          <CategoryIcon category={node.category} />
        </span>

        <span className="min-w-0 flex-1 truncate">{node.label}</span>

        {density === 'structure' && node.hiddenChildCount > 0 ? (
          <button
            type="button"
            tabIndex={-1}
            title={t('outline.hiddenBlocks', { count: node.hiddenChildCount })}
            aria-label={t('outline.hiddenBlocks', { count: node.hiddenChildCount })}
            onClick={(event) => {
              event.stopPropagation();
              onChangeDensity('all');
            }}
            className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500 hover:bg-blue-100 hover:text-blue-700"
          >
            {t('outline.hiddenBlocksShort', { count: node.hiddenChildCount })}
          </button>
        ) : null}

        {node.structureIssueMessage ? (
          <span
            role="img"
            aria-label={t('outline.structureIssue', { message: node.structureIssueMessage })}
            title={t('outline.structureIssue', { message: node.structureIssueMessage })}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          />
        ) : null}

        <span className="shrink-0 rounded bg-slate-100 px-1 font-mono text-[9px] text-slate-500">{`<${node.tagName}>`}</span>

        {node.canDrag && !readOnly ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('outline.dragHandle', { tag: node.tagName })}
            title={t('outline.dragHandle', { tag: node.tagName })}
            onPointerDown={(event) => startDrag(event, node)}
            onClick={(event) => event.stopPropagation()}
            className="flex h-4 w-4 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 opacity-0 hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  };

  const dropReasonLabel = (reason: OutlineDropBlockReason): string => {
    const key = `outline.drop.${reason}` as const;
    return t(key, { source: ghost?.tagName ?? '', target: ghost?.targetTag ?? '' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white" data-outline-panel="true">
      <div className="flex shrink-0 flex-col gap-1 border-b border-slate-200 bg-slate-50/95 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <ListTree className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-slate-700">{t('outline.title')}</span>
          <button
            type="button"
            title={t('outline.expandAll')}
            aria-label={t('outline.expandAll')}
            onClick={expandAll}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            title={t('outline.collapseAll')}
            aria-label={t('outline.collapseAll')}
            onClick={collapseAll}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <ChevronsDownUp className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            title={t('outline.collapse')}
            aria-label={t('outline.collapse')}
            onClick={onCollapse}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <PanelLeftClose className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>

        <div
          role="group"
          aria-label={t('outline.densityGroupAria')}
          className="flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-white p-0.5"
        >
          {(['structure', 'all'] as const).map((value) => {
            const selected = density === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                title={value === 'structure' ? t('outline.density.structureHint') : t('outline.density.allHint')}
                onClick={() => onChangeDensity(value)}
                className={`flex-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  selected ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {t(value === 'structure' ? 'outline.density.structure' : 'outline.density.all')}
              </button>
            );
          })}
        </div>

        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute start-1.5 h-3 w-3 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            aria-label={t('outline.searchAria')}
            placeholder={t('outline.searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
            className="h-6 w-full rounded border border-slate-200 bg-white ps-6 pe-6 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <button
              type="button"
              title={t('outline.clearSearch')}
              aria-label={t('outline.clearSearch')}
              onClick={() => setSearch('')}
              className="absolute end-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {xmlError ? (
        <div role="status" className="m-2 shrink-0 rounded border border-amber-200 bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('outline.xmlErrorTitle')}</p>
              <p className="font-mono text-amber-800">{`L${xmlError.line}:${xmlError.column}`}</p>
              <p className="truncate" title={xmlError.message}>
                {xmlError.message}
              </p>
              <p className="mt-0.5 text-amber-700">{t('outline.xmlErrorBody')}</p>
            </div>
          </div>
          {onJumpToXmlError ? (
            <button
              type="button"
              onClick={onJumpToXmlError}
              className="mt-1 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
            >
              {t('outline.xmlErrorJump')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div ref={scrollRef} data-outline-scroll="true" className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {rows.length > 0 ? (
          <div ref={listRef} role="tree" aria-label={t('outline.treeAria')} aria-multiselectable="false">
            {rows.map((row, index) => renderRow(row, index))}
          </div>
        ) : (
          <p className="px-2 py-4 text-center text-[11px] text-slate-400">
            {searching ? t('outline.noMatch', { query: search.trim() }) : t('outline.empty')}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-t border-slate-200 bg-slate-50/95 px-2 py-1 text-[10px] text-slate-500">
        <span className="min-w-0 flex-1 truncate">
          {readOnly ? t('outline.footer.readOnly') : t('outline.footer.editable')}
        </span>
        <span className="shrink-0 rounded bg-slate-200/70 px-1 font-mono text-[9px] text-slate-500">
          {density === 'structure' ? t('outline.density.structure') : t('outline.density.all')}
        </span>
      </div>

      {ghost ? (
        <div
          className="dita-outline-ghost"
          style={{ left: ghost.clientX + 12, top: ghost.clientY + 12 }}
          aria-hidden="true"
        >
          <span className="font-mono text-[10px] text-slate-500">{`<${ghost.tagName}>`}</span>
          <span className="max-w-[160px] truncate text-[10px] text-slate-800">{ghost.label}</span>
          {ghost.reason ? (
            <span className="rounded bg-rose-100 px-1 text-[9px] font-medium text-rose-700">
              {dropReasonLabel(ghost.reason)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
