import type { NodeRendererProps } from 'react-arborist';
import type { DitavalDisplayMode } from '@dita/core';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  BookText,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  KeyRound,
  Layers,
  ListChecks,
  MoreVertical,
  Network,
  ScrollText,
} from 'lucide-react';
import { profilingBadgeClasses } from '../components/profiling-badge-palette.js';
import { sanitizeCssColor } from '../editor/visual/conref-renderer';
import type { CompositeMapTreeNode } from './map-tree-utils';
import { useI18n } from '../i18n/index.js';

export interface MapNodeRowActions {
  ditavalActive?: boolean;
  ditavalDisplayMode?: DitavalDisplayMode;
  onOpenTarget: (node: CompositeMapTreeNode) => void;
  onOpenContextMenu: (
    node: CompositeMapTreeNode,
    x: number,
    y: number,
    openedByKeyboard: boolean,
    restoreEl: HTMLElement | null,
  ) => void;
  onQuickAddChildTopic: (node: CompositeMapTreeNode) => void;
  /** Opens the “target not created yet” quick-fix popover anchored at the badge. */
  onOpenTargetFix: (
    node: CompositeMapTreeNode,
    x: number,
    y: number,
    openedByKeyboard: boolean,
    restoreEl: HTMLElement | null,
  ) => void;
}

function NodeKindIcon({ data }: { data: CompositeMapTreeNode }) {
  if (data.isSubmapRef) {
    return <Network className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />;
  }
  if (data.tagName === 'keydef') {
    return <KeyRound className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />;
  }
  if (data.tagName === 'topichead' || data.tagName === 'part') {
    return <Folder className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
  if (data.tagName === 'topicgroup' || data.tagName === 'frontmatter' || data.tagName === 'backmatter') {
    return <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
  if (data.tagName === 'chapter' || data.tagName === 'appendix' || data.tagName === 'preface') {
    return <BookMarked className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />;
  }
  // Topic type of the referenced file (own `type=` attribute wins, else the scanned root element).
  switch (data.topicType) {
    case 'concept':
      return <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />;
    case 'task':
      return <ListChecks className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />;
    case 'reference':
      return <BookText className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden="true" />;
    case 'topic':
      return <ScrollText className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />;
  }
}

const TAG_PILL_STYLES: Record<string, string> = {
  mapref: 'bg-sky-100 text-sky-800',
  chapter: 'bg-blue-100 text-blue-800',
  part: 'bg-slate-200 text-slate-700',
  appendix: 'bg-blue-100 text-blue-800',
  keydef: 'bg-blue-100 text-blue-800',
  topichead: 'bg-slate-200 text-slate-700',
  topicgroup: 'bg-slate-100 text-slate-500',
};

export function createMapTreeNodeRenderer(actions: MapNodeRowActions) {
  return function MapTreeNodeRenderer({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<CompositeMapTreeNode>) {
    const { t } = useI18n();
    const data = node.data;
    const hasExpandable = Boolean(data.children && data.children.length > 0);
    // A `missing` target is a to-do (amber hint + quick fix); `escaped` / `cycle` are real errors.
    const targetStatus =
      data.targetStatus ?? (data.href && !data.targetExists ? 'missing' : undefined);
    const hasTargetError = targetStatus === 'escaped' || targetStatus === 'cycle';
    const hasMissingTarget = targetStatus === 'missing';
    const tagPillStyle = TAG_PILL_STYLES[data.tagName] ?? 'bg-slate-100 text-slate-600';
    const isExcluded = Boolean(data.isExcluded);
    const isFlagged = !isExcluded && data.conditionEval?.status === 'flag';
    const flagStyle = isFlagged ? data.conditionEval?.effectiveStyle : undefined;
    const firstFlagBadge = isFlagged
      ? data.conditionEval?.flags.find((f) => f.startFlag?.altText)?.startFlag?.altText
      : undefined;
    const flagColor = sanitizeCssColor(flagStyle?.color);
    const flagBg = sanitizeCssColor(flagStyle?.backcolor);
    // A freshly inserted <topicgroup> has no navtitle, so surface a readable placeholder
    // instead of the raw "<topicgroup>" label the map parser falls back to.
    const rowLabel =
      data.tagName === 'topicgroup' && data.label === '<topicgroup>'
        ? t('mapTree.untitledGroup')
        : data.label;
    const showProfilingChips =
      Boolean(data.profilingSummary?.length) &&
      (actions.ditavalDisplayMode === 'show-all' || Boolean(actions.ditavalActive));

    return (
      <div
        ref={dragHandle}
        style={{
          ...style,
          ...(isFlagged && !node.isSelected && flagBg ? { backgroundColor: flagBg } : {}),
        }}
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
            ? 'bg-blue-50 text-blue-950 ring-1 ring-blue-300/80'
            : node.willReceiveDrop
              ? 'bg-sky-50 ring-1 ring-sky-400'
              : 'text-slate-700 hover:bg-slate-100/90'
        } ${data.isSubmapChild ? 'border-l-2 border-sky-200' : ''} ${
          isExcluded && actions.ditavalDisplayMode === 'dim-excluded'
            ? 'opacity-40 line-through'
            : isExcluded && actions.ditavalDisplayMode === 'show-all'
              ? 'border border-dashed border-rose-300 bg-rose-50/40'
              : ''
        }`}
      >
        {/* Expand / Collapse Chevron */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(ev) => {
            ev.stopPropagation();
            if (hasExpandable) node.toggle();
          }}
          aria-label={node.isOpen ? t('mapNode.collapse') : t('mapNode.expand')}
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
          className={`min-w-0 flex-1 truncate font-medium ${hasTargetError ? 'text-rose-700' : ''}`}
          style={isFlagged && flagColor ? { color: flagColor } : undefined}
          title={[
            data.label,
            data.href ? `href: ${data.href}` : null,
            data.inlineText ? `text: ${data.inlineText}` : null,
            data.isSubmapChild ? t('mapNode.submapOwner', { path: data.ownerMapPath }) : null,
            data.profilingSummary
              ? t('mapNode.profiling', { attrs: data.profilingSummary.map((p) => `${p.name}=${p.values.join(' ')}`).join(', ') })
              : null,
            isExcluded ? t('mapNode.excluded') : null,
            hasTargetError
              ? t(targetStatus === 'cycle' ? 'mapNode.cycle' : 'mapNode.targetEscaped')
              : null,
            hasMissingTarget
              ? t('mapNode.targetMissingHint', { path: data.resolvedTargetPath ?? data.href ?? '' })
              : null,
          ]
            .filter(Boolean)
            .join('\n')}
        >
          {rowLabel}
        </span>

        {/* `<keydef>` rows preview their bound value so keys are readable at a glance */}
        {data.tagName === 'keydef' ? (
          (() => {
            const keyPreview = data.inlineText ?? data.href;
            if (!keyPreview) return null;
            return (
              <span
                className="max-w-[45%] shrink-0 truncate rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] font-medium text-slate-600"
                title={keyPreview}
              >
                {data.inlineText
                  ? t('mapNode.keyTextPreview', { text: data.inlineText })
                  : keyPreview}
              </span>
            );
          })()
        ) : null}

        {/* DITAVAL Flag / Excluded / Profiling pills */}
        {isExcluded ? (
          <span className="shrink-0 rounded bg-rose-100 px-1 py-0.2 font-mono text-[9px] font-semibold text-rose-700">
            {t('mapNode.excludedBadge')}
          </span>
        ) : firstFlagBadge ? (
          <span className="shrink-0 rounded bg-blue-100 px-1 py-0.2 font-mono text-[9px] font-semibold text-blue-800">
            {firstFlagBadge}
          </span>
        ) : null}

        {showProfilingChips && data.profilingSummary ? (
          <span className="hidden shrink-0 items-center gap-0.5 sm:inline-flex">
            {data.profilingSummary.slice(0, 1).map((p) => (
              <span
                key={p.name}
                className={`rounded border px-1 py-0.2 font-mono text-[9px] font-medium ${profilingBadgeClasses(p.name)}`}
              >
                {p.name}={p.values.join(' ')}
              </span>
            ))}
          </span>
        ) : null}

        {/* Broken / cyclic reference error (rose) */}
        {hasTargetError ? (
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0 text-rose-500"
            aria-label={targetStatus === 'cycle' ? t('mapNode.cycleAria') : t('mapNode.escapedAria')}
          />
        ) : null}

        {/* Target file not created yet: an action, not an error — click for the quick fix */}
        {hasMissingTarget ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={(ev) => {
              ev.stopPropagation();
              const rect = ev.currentTarget.getBoundingClientRect();
              actions.onOpenTargetFix(
                data,
                rect.left,
                rect.bottom + 2,
                ev.detail === 0,
                ev.currentTarget,
              );
            }}
            title={t('mapNode.targetMissingFixTitle')}
            aria-label={t('mapNode.targetPendingAria')}
            aria-haspopup="menu"
            className="flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 py-0.2 font-mono text-[9px] font-semibold text-amber-800 hover:bg-amber-200"
          >
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
            {t('mapNode.targetPendingBadge')}
          </button>
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
              title={t('mapNode.createChildTitle')}
              aria-label={t('mapNode.createChildAria')}
              className="rounded p-0.5 text-slate-400 hover:bg-blue-100 hover:text-blue-700"
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
            title={t('mapNode.menuTitle')}
            aria-label={t('mapNode.menuAria')}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
          >
            <MoreVertical className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };
}
