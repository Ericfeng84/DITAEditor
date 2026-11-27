import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BreadcrumbItem } from './selection-info';
import { useI18n } from '../../i18n/index.js';

export interface BreadcrumbBarProps {
  breadcrumbs: BreadcrumbItem[];
  activePos: number | null;
  /**
   * Selects that hierarchy level in the canvas *and* opens the document outline on it. The footer
   * path is the outline's only visible entry point, so a click has to do both: the crumb row is
   * what authors already read to understand where they are.
   */
  onSelectCrumb: (item: BreadcrumbItem) => void;
  diffStats: {
    changedLines: number;
    addedLines: number;
    removedLines: number;
    isIdentical: boolean;
  };
  mode: 'visual' | 'split' | 'source';
  activePath?: string | null;
  /**
   * Kept for compatibility only — the WorkbenchHeader diagnostics pill is the single place that
   * opens the problems pane, so the footer no longer duplicates it.
   */
  diagnosticsCount?: number;
  onToggleProblems?: () => void;
  /**
   * Authoring-guide toggle (topic type badge + expand/collapse), pinned to the footer's far left.
   * The chip is a per-document annotation rather than document state, so it belongs on the status
   * strip at the bottom edge instead of taking a slot in the toolbar row above the canvas.
   */
  guideChip?: ReactNode;
  /**
   * Task content-model switch (`auto` / `strict` / `general`), pinned immediately right of the guide
   * chip: "which kind of topic is this" and "which content model does it follow" are the same
   * question, so both answers sit together on the status strip instead of in the toolbar row.
   */
  topicModelSlot?: ReactNode;
  /**
   * Expanded authoring-guide card. It opens *upward* out of the footer: the footer is the bottom
   * edge of the workbench, so a panel dropping down from the chip would be clipped off-screen.
   */
  guidePanel?: ReactNode;
}

export function BreadcrumbBar({
  breadcrumbs,
  activePos,
  onSelectCrumb,
  diffStats,
  mode,
  activePath,
  guideChip,
  topicModelSlot,
  guidePanel,
}: BreadcrumbBarProps) {
  const { t } = useI18n();
  return (
    <footer className="relative flex h-7 shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-600">
      {guidePanel ? (
        <div
          data-testid="topic-guide-popover"
          className="absolute bottom-full left-2 z-30 mb-1 max-h-[min(430px,72vh)] w-[min(700px,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white shadow-xl"
        >
          {guidePanel}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {guideChip ? <div className="flex shrink-0 items-center">{guideChip}</div> : null}
        {topicModelSlot ? (
          <div className="flex shrink-0 items-center">{topicModelSlot}</div>
        ) : null}
        <nav
          aria-label={t('breadcrumb.aria')}
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        >
          {mode === 'source' ? (
            <span className="text-slate-400">
              {t('breadcrumb.sourceMode')}
            </span>
          ) : breadcrumbs.length === 0 ? (
            <span className="text-slate-400">{t('breadcrumb.empty')}</span>
          ) : (
            breadcrumbs.map((crumb, idx) => {
              const isSelected = crumb.pos === activePos;
              return (
                <span key={`${crumb.depth}-${crumb.pos}`} className="flex shrink-0 items-center">
                  {idx > 0 ? (
                    <ChevronRight className="mx-0.5 h-3 w-3 text-slate-400" aria-hidden="true" />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelectCrumb(crumb)}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors ${
                      isSelected
                        ? 'bg-blue-600 font-semibold text-white'
                        : crumb.isUnknown
                          ? 'text-amber-700 hover:bg-amber-100/70'
                          : 'text-slate-700 hover:bg-slate-200/80'
                    }`}
                    title={t('breadcrumb.selectTitle', { tag: crumb.tagName })}
                  >
                    <span>{crumb.tagName}</span>
                    {crumb.id ? (
                      <span
                        className={
                          isSelected ? 'text-blue-200' : 'text-slate-400'
                        }
                      >
                        #{crumb.id}
                      </span>
                    ) : null}
                  </button>
                </span>
              );
            })
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-3 pr-3 text-[11px]">
        {activePath ? (
          <span className="hidden font-mono text-slate-400 lg:inline">{activePath}</span>
        ) : null}
        <span className="font-mono text-slate-500">
          {diffStats.isIdentical
            ? t('breadcrumb.diffNone')
            : t('breadcrumb.diff', { count: diffStats.changedLines })}
        </span>
        <span
          className="inline-flex items-center text-emerald-700"
          title={t('breadcrumb.kernel')}
          aria-label={t('breadcrumb.kernel')}
          role="img"
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </footer>
  );
}
