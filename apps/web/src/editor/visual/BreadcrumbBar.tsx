import { ChevronRight, ShieldCheck } from 'lucide-react';
import type { BreadcrumbItem } from './selection-info';

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
}

export function BreadcrumbBar({
  breadcrumbs,
  activePos,
  onSelectCrumb,
  diffStats,
  mode,
}: BreadcrumbBarProps) {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-600">
      <nav
        aria-label="DITA 元素层级面包屑"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
      >
        {mode === 'source' ? (
          <span className="text-slate-400">
            XML 源码模式 · 切换至可视化或双栏视图可浏览交互式元素路径
          </span>
        ) : breadcrumbs.length === 0 ? (
          <span className="text-slate-400">点击文档内任意元素查看层级路径</span>
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
                      ? 'bg-indigo-600 font-semibold text-white'
                      : crumb.isUnknown
                        ? 'text-amber-700 hover:bg-amber-100/70'
                        : 'text-slate-700 hover:bg-slate-200/80'
                  }`}
                  title={`点击选中并检查 <${crumb.tagName}> 属性`}
                >
                  <span>{crumb.tagName}</span>
                  {crumb.id ? (
                    <span
                      className={
                        isSelected ? 'text-indigo-200' : 'text-slate-400'
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

      <div className="flex shrink-0 items-center gap-3 text-[11px]">
        <span className="font-mono text-slate-500">
          {diffStats.isIdentical
            ? '与基线 0 行差异'
            : `Diff: ${diffStats.changedLines} 行变动`}
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">@dita/core 无损内核</span>
        </span>
      </div>
    </footer>
  );
}
