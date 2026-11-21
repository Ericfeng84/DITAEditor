import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { WorkspaceDiagnostic } from '../services/workspace-api';

export interface ProblemsPanelProps {
  diagnostics: WorkspaceDiagnostic[];
  onRefresh: () => void;
  onJumpToDiagnostic: (diag: WorkspaceDiagnostic) => void;
  onClose: () => void;
}

const SOURCE_LABELS: Record<WorkspaceDiagnostic['source'], string> = {
  xml: 'XML 良构',
  'map-ref': 'Map 引用',
  'asset-ref': '图片资源',
};

export function ProblemsPanel({
  diagnostics,
  onRefresh,
  onJumpToDiagnostic,
  onClose,
}: ProblemsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics],
  );
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics],
  );

  const visible = useMemo(() => {
    if (filter === 'all') return diagnostics;
    return diagnostics.filter((d) => d.severity === filter);
  }, [diagnostics, filter]);

  return (
    <section
      aria-label="项目诊断与问题面板"
      className="flex h-full flex-col border-t border-slate-200 bg-white text-xs"
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">问题诊断</span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all', label: `全部 (${diagnostics.length})` },
                { id: 'error', label: `错误 (${errorCount})` },
                { id: 'warning', label: `警告 (${warningCount})` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  filter === item.id
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            className="dita-mini-btn px-2 py-0.5"
            title="重新扫描工作区链接与 XML 良构性"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>重新检测</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭问题面板"
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 p-4 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>未检测到断链、循环引用或 XML 语法错误</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((diag) => (
              <li key={diag.id}>
                <button
                  type="button"
                  onClick={() => onJumpToDiagnostic(diag)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  {diag.severity === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                  )}
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                    {SOURCE_LABELS[diag.source]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-800">{diag.message}</span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">
                    {diag.filePath}:{diag.line}:{diag.column}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
