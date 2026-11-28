import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Pencil, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/index.js';
import type { TranslationLinkView } from '../services/translation-api.js';
import type { TranslationLineageModel } from './translation-lineage.js';

export interface TranslationLineageSidebarProps {
  lineage: TranslationLineageModel;
  /** Manual the center was opened from — highlighted in the tree even without an active link. */
  entryManualId: string;
  entryManualName?: string | null;
  activeLinkId: string | null;
  onSelectLink: (linkId: string) => void;
  onOpenEditor: (link: TranslationLinkView) => void;
  /** Node `+` action: pre-select this node as the parent in the derive dialog. */
  onDerive: (manualId: string) => void;
  onAddTarget: () => void;
  onOpenRoot: () => void;
}

function fullNodeKey(manualId: string, branch: string | null | undefined): string {
  return `${manualId}::${branch ?? ''}`;
}

/**
 * Phase 16 — the left "language lineage" tree that replaced the horizontal top language bar.
 *
 * Level 0 is the family root (`zh-CN`), every level below it is an indented target language, and a
 * target may itself be a source (`zh-CN → en-US → ar-SA`). The tree is the only place where that
 * multi-level shape is visible, so it is a master list for the detail pane on the right rather
 * than a decorative switcher: selecting a node swaps the whole center (files, queue, settings).
 *
 * Two invariants keep it usable at depth:
 * - A node's quick actions are *siblings* of its select button, never children of it — remember
 *   which language is active must never be one click away from silently navigating away.
 * - Expanding/collapsing a node only hides its subtree; it never changes the active link, so the
 *   breadcrumb and the detail pane stay consistent with what the user last opened.
 */
export function TranslationLineageSidebar({
  lineage,
  entryManualId,
  entryManualName,
  activeLinkId,
  onSelectLink,
  onOpenEditor,
  onDerive,
  onAddTarget,
  onOpenRoot,
}: TranslationLineageSidebarProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<ReadonlySet<string>>(new Set());

  /** Children per source node, already DFS ordered by the lineage kernel. */
  const childrenByNode = useMemo(() => {
    const out = new Map<string, TranslationLinkView[]>();
    for (const link of lineage.orderedLinks) {
      const key = fullNodeKey(link.sourceManualId, link.sourceBranch);
      const list = out.get(key);
      if (list) list.push(link);
      else out.set(key, [link]);
    }
    return out;
  }, [lineage.orderedLinks]);

  const toggleNode = (key: string) => {
    setCollapsedNodes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const editionCount = lineage.orderedLinks.length;
  const root = lineage.roots[0] ?? null;

  const renderTarget = (link: TranslationLinkView, depth: number): ReactNode => {
    const meta = lineage.linkMetaById.get(link.id);
    const key = fullNodeKey(link.targetManualId, link.targetBranch);
    const children = childrenByNode.get(key) ?? [];
    const expandable = children.length > 0;
    const expanded = expandable && !collapsedNodes.has(key);
    const active = activeLinkId === link.id;
    const percent = link.counts?.progressPercent ?? 0;
    const pending = meta?.upstreamPending ?? [];
    const missing = link.targetManual?.exists === false;
    const openTitle = t('translation.openTargetInEditorTitle', { lang: link.targetLang });
    const deriveTitle = t('translation.lineage.derive', { lang: link.targetLang });
    const pendingTitle =
      pending.length > 0
        ? pending
            .map((ancestor) => t('translation.lineage.upstreamPending', { lang: ancestor.targetLang }))
            .join(' · ')
        : undefined;

    return (
      <li key={link.id} role="none">
        <div
          role="treeitem"
          aria-selected={active}
          aria-expanded={expandable ? expanded : undefined}
          aria-label={`${link.sourceLang} → ${link.targetLang}`}
          data-testid={`translation-lineage-node-${link.id}`}
          data-depth={depth}
          className="group relative"
          style={{ paddingLeft: 8 + (depth - 1) * 14 }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 border-l border-slate-200"
            style={{ left: 6 + (depth - 1) * 14 }}
          />
          <div
            className={`flex items-center gap-1 rounded-md pr-1 transition-colors ${
              active ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'
            }`}
          >
            {expandable ? (
              <button
                type="button"
                onClick={() => toggleNode(key)}
                aria-label={
                  expanded
                    ? t('translation.lineage.collapseNode')
                    : t('translation.lineage.expandNode')
                }
                title={
                  expanded
                    ? t('translation.lineage.collapseNode')
                    : t('translation.lineage.expandNode')
                }
                data-testid={`translation-lineage-toggle-${link.id}`}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            ) : (
              <span aria-hidden="true" className="w-4 shrink-0" />
            )}

            <button
              type="button"
              aria-pressed={active}
              data-testid={`translation-link-${link.id}`}
              onClick={() => onSelectLink(link.id)}
              title={`${link.sourceLang} → ${link.targetLang} · ${
                link.targetManual?.name ?? link.targetManualId
              }`}
              className="min-w-0 flex-1 py-1 pr-0.5 text-left"
            >
              <span className="flex items-center gap-1">
                <span className="truncate font-mono text-[11px] font-semibold text-slate-800">
                  {link.targetLang}
                </span>
                {pending.length > 0 ? (
                  <span
                    data-testid={`translation-link-upstream-dot-${link.id}`}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                    title={pendingTitle}
                    aria-label={pendingTitle}
                  />
                ) : null}
                <span
                  className={`ml-auto shrink-0 rounded px-1 text-[9.5px] font-semibold tabular-nums ${
                    active ? 'bg-white text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}
                  title={t('translation.progressLabel', { percent })}
                >
                  {t('translation.progressPercent', { percent })}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-slate-100"
              >
                <span
                  className={`block h-full rounded-full ${
                    percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </span>
            </button>

            {/* Sibling actions: selecting the pair stays one click, opening the edition or deriving
                a child language is a separate affordance. */}
            <span
              className={`flex shrink-0 items-center gap-0.5 ${
                active
                  ? 'opacity-100'
                  : 'opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={() => onOpenEditor(link)}
                disabled={missing}
                data-testid={`translation-link-open-editor-${link.id}`}
                title={openTitle}
                aria-label={openTitle}
                className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDerive(link.targetManualId)}
                data-testid={`translation-link-derive-${link.id}`}
                title={deriveTitle}
                aria-label={deriveTitle}
                className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-blue-700"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>

        {expandable && expanded ? (
          <ul role="group" className="space-y-0.5">
            {children.map((child) => renderTarget(child, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  if (collapsed) {
    return (
      <aside
        data-testid="translation-lineage-sidebar"
        data-collapsed="true"
        className="flex w-full shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 py-1.5 lg:h-[calc(100vh-3rem)] lg:w-12 lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-2"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          data-testid="translation-lineage-expand"
          title={t('translation.lineage.expand')}
          aria-label={t('translation.lineage.expand')}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <span className="text-[11px] font-semibold text-slate-500 lg:[writing-mode:vertical-rl]">
          {t('translation.lineage.title')}
        </span>
        <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold tabular-nums text-slate-500">
          {editionCount}
        </span>
      </aside>
    );
  }

  return (
    <aside
      data-testid="translation-lineage-sidebar"
      className="w-full shrink-0 border-b border-slate-200 bg-white lg:sticky lg:top-12 lg:h-[calc(100vh-3rem)] lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-[272px]"
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t('translation.lineage.title')}
        </span>
        <span
          className="rounded bg-slate-100 px-1 text-[10px] font-semibold tabular-nums text-slate-500"
          aria-label={t('translation.lineage.countLabel')}
          title={t('translation.lineage.countLabel')}
        >
          {editionCount}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          data-testid="translation-lineage-toggle"
          title={t('translation.lineage.collapse')}
          aria-label={t('translation.lineage.collapse')}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <ul role="tree" aria-label={t('translation.targetLanguages')} className="space-y-0.5 px-1.5 py-2">
        {root ? (
          <li role="none">
            <div
              role="treeitem"
              aria-selected={false}
              aria-label={`${root.lang ?? ''} ${root.manualName ?? ''}`.trim()}
              data-testid="translation-lineage-root"
              data-depth={0}
              className="group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-slate-50"
            >
              <span aria-hidden="true" className="w-4 shrink-0" />
              <button
                type="button"
                onClick={onOpenRoot}
                data-testid="translation-lineage-root-open"
                title={t('translation.lineage.openRoot')}
                aria-label={t('translation.lineage.openRoot')}
                className="flex min-w-0 flex-1 items-center gap-1 text-left"
              >
                <span aria-hidden="true" className="text-[12px] leading-none">
                  🌐
                </span>
                <span className="truncate font-mono text-[11px] font-semibold text-slate-900">
                  {root.lang ?? root.manualId}
                </span>
                <span className="shrink-0 rounded bg-slate-900 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
                  {t('translation.lineage.rootBadge')}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenRoot}
                title={t('translation.lineage.openRoot')}
                aria-label={t('translation.lineage.openRoot')}
                data-testid="translation-lineage-root-editor"
                className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-blue-700 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDerive(root.manualId)}
                title={t('translation.lineage.derive', { lang: root.lang ?? root.manualId })}
                aria-label={t('translation.lineage.derive', { lang: root.lang ?? root.manualId })}
                data-testid="translation-lineage-root-derive"
                className="rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-blue-700 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>

            {root.manualName ? (
              <p className="truncate pl-6 pr-1 text-[10px] text-slate-400" title={root.manualName}>
                {entryManualId === root.manualId ? (entryManualName ?? root.manualName) : root.manualName}
              </p>
            ) : null}

            <ul role="group" className="mt-0.5 space-y-0.5">
              {(childrenByNode.get(fullNodeKey(root.manualId, root.branch)) ?? []).map((link) =>
                renderTarget(link, 1),
              )}
            </ul>
          </li>
        ) : null}
      </ul>

      <div className="border-t border-slate-100 p-2">
        <button
          type="button"
          onClick={onAddTarget}
          data-testid="translation-lineage-add"
          className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          {t('translation.addTargetLanguage')}
        </button>
      </div>
    </aside>
  );
}
