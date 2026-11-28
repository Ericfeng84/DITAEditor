import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ProblemDiagnostic,
  ProblemDiagnosticSource,
} from '../services/problem-diagnostics.js';
import { useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';

export interface ProblemsPanelProps {
  diagnostics: ProblemDiagnostic[];
  onRefresh: () => void;
  onJumpToDiagnostic: (diag: ProblemDiagnostic) => void;
  onClose: () => void;
  onStrictValidate?: () => void;
  /** Opens the AI assistant with the diagnostic attached as fix context. */
  onAiFixDiagnostic?: (diag: ProblemDiagnostic) => void;
  /** Drops the results of the last DITA-OT strict validation run (merged into this list). */
  onClearStrictDiagnostics?: () => void;
}

type ProblemFilter = 'all' | 'error' | 'warning' | 'dita-ot';

const SOURCE_KEYS: Record<ProblemDiagnosticSource, MessageKey> = {
  xml: 'problems.source.xml',
  'map-ref': 'problems.source.mapRef',
  'asset-ref': 'problems.source.assetRef',
  keyref: 'problems.source.keyref',
  conref: 'problems.source.conref',
  'conref-cycle': 'problems.source.conrefCycle',
  ditaval: 'problems.source.ditaval',
  structure: 'problems.source.structure',
  'dita-ot': 'problems.source.ditaOt',
};

export function ProblemsPanel({
  diagnostics,
  onRefresh,
  onJumpToDiagnostic,
  onClose,
  onStrictValidate,
  onAiFixDiagnostic,
  onClearStrictDiagnostics,
}: ProblemsPanelProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<ProblemFilter>('all');

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics],
  );
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics],
  );
  const strictCount = useMemo(
    () => diagnostics.filter((d) => d.source === 'dita-ot').length,
    [diagnostics],
  );

  // Clearing the strict results (or a strict run that finds nothing) must never leave the user
  // staring at an empty list because the hidden `dita-ot` tab is still selected.
  const effectiveFilter: ProblemFilter = filter === 'dita-ot' && strictCount === 0 ? 'all' : filter;

  const visible = useMemo(() => {
    if (effectiveFilter === 'all') return diagnostics;
    if (effectiveFilter === 'dita-ot') return diagnostics.filter((d) => d.source === 'dita-ot');
    return diagnostics.filter((d) => d.severity === effectiveFilter);
  }, [diagnostics, effectiveFilter]);

  return (
    <section
      aria-label={t('problems.aria')}
      className="flex h-full flex-col border-t border-slate-200 bg-white text-xs"
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">{t('problems.title')}</span>
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'all' as const, label: t('problems.filter.all', { count: diagnostics.length }) },
                { id: 'error' as const, label: t('problems.filter.error', { count: errorCount }) },
                { id: 'warning' as const, label: t('problems.filter.warning', { count: warningCount }) },
                ...(strictCount > 0
                  ? [
                      {
                        id: 'dita-ot' as const,
                        label: t('problems.filter.ditaOt', { count: strictCount }),
                      },
                    ]
                  : []),
              ]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  effectiveFilter === item.id
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {strictCount > 0 && onClearStrictDiagnostics ? (
            <button
              type="button"
              onClick={onClearStrictDiagnostics}
              data-testid="problems-clear-strict"
              className="dita-mini-btn px-2 py-0.5 text-slate-600 hover:text-slate-900"
              title={t('problems.clearStrictTitle')}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              <span>{t('problems.clearStrict')}</span>
            </button>
          ) : null}
          {onStrictValidate ? (
            <button
              type="button"
              onClick={onStrictValidate}
              className="dita-mini-btn border-blue-200 px-2 py-0.5 text-blue-700 hover:bg-blue-50"
              title={t('problems.strictTitle')}
            >
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              <span>{t('problems.strict')}</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="dita-mini-btn px-2 py-0.5"
            title={t('problems.refreshTitle')}
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>{t('problems.refresh')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('problems.closeAria')}
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
            <span>{t('problems.empty')}</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((diag) => (
              <li key={diag.id} className="flex items-center gap-1 pr-2 hover:bg-slate-50">
                <button
                  type="button"
                  onClick={() => onJumpToDiagnostic(diag)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pl-3 pr-1 text-left"
                >
                  {diag.severity === 'error' ? (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
                  )}
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      diag.source === 'dita-ot'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t(SOURCE_KEYS[diag.source])}
                  </span>
                  {diag.code ? (
                    <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 font-mono text-[9.5px] text-slate-500">
                      {diag.code}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-slate-800" title={diag.message}>
                    {diag.message}
                    {diag.cycleChain && diag.cycleChain.length > 0 ? (
                      <span className="ml-2 font-mono text-[10px] text-rose-600">
                        [{diag.cycleChain.join(' → ')}]
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">
                    {diag.filePath}:{diag.line}:{diag.column}
                  </span>
                </button>
                {onAiFixDiagnostic ? (
                  <button
                    type="button"
                    onClick={() => onAiFixDiagnostic(diag)}
                    title={t('problems.aiFixTitle')}
                    aria-label={t('problems.aiFixTitle')}
                    className="shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
