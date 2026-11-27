import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { BreadcrumbItem } from './selection-info';
import { useI18n } from '../../i18n/index.js';

export interface BreadcrumbBarProps {
  breadcrumbs: BreadcrumbItem[];
  activePos: number | null;
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
}

export function BreadcrumbBar({
  breadcrumbs,
  activePos,
  onSelectCrumb,
  diffStats,
  mode,
  activePath,
}: BreadcrumbBarProps) {
  const { t } = useI18n();
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-600">
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
