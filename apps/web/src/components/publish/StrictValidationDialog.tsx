import { useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { PublishDiagnostic, StrictValidationInput } from '../../services/publish-api';
import { usePublishStore } from '../../store/publish-store';
import { useI18n } from '../../i18n/index.js';

export interface StrictValidationDialogProps {
  open: boolean;
  input: StrictValidationInput | null;
  targetLabel: string;
  onClose: () => void;
  onJumpToFile: (path: string, line: number, column: number) => void;
  /** Closes the dialog and reveals the merged results in the bottom Problems panel. */
  onViewInProblems?: () => void;
  /** Opens the AI assistant with the strict DITA-OT diagnostic as fix context. */
  onAiFixDiagnostic?: (diagnostic: PublishDiagnostic) => void;
  /** Shows the "proposal applied, re-run validation" hint after an AI fix. */
  aiApplied?: boolean;
  /** Desktop shell only: jump to the plugin install guide when DITA-OT / Java is missing. */
  onOpenPluginGuide?: (() => void) | undefined;
}

export function StrictValidationDialog({
  open,
  input,
  targetLabel,
  onClose,
  onJumpToFile,
  onAiFixDiagnostic,
  aiApplied = false,
  onOpenPluginGuide,
  onViewInProblems,
}: StrictValidationDialogProps) {
  const { t } = useI18n();
  const runtime = usePublishStore((state) => state.runtime);
  const strictResult = usePublishStore((state) => state.strictResult);
  const strictRunning = usePublishStore((state) => state.strictRunning);
  const strictError = usePublishStore((state) => state.strictError);
  const strictTargets = usePublishStore((state) => state.strictTargets);
  const runStrictValidation = usePublishStore((state) => state.runStrictValidation);
  const loadRuntime = usePublishStore((state) => state.loadRuntime);

  useEffect(() => {
    if (!open || !input) return;
    void loadRuntime();
    void runStrictValidation(input);
  }, [open, input, loadRuntime, runStrictValidation]);

  if (!open) return null;

  const errors = strictResult?.diagnostics.filter((item) => item.severity === 'error') ?? [];
  const warnings = strictResult?.diagnostics.filter((item) => item.severity === 'warning') ?? [];
  const unavailable = strictResult ? !strictResult.available : runtime ? !runtime.available : false;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('strict.aria')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !strictRunning) onClose();
      }}
    >
      <div className="flex h-[74vh] w-[min(900px,94vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />
              {t('strict.title')}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {targetLabel || t('strict.fallbackTarget')} · {t('strict.badgeSuffix')}{' '}
              <code className="font-mono">--processing-mode=strict</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={strictRunning}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            aria-label={t('strict.closeAria')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {strictError ? (
          <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-[11px] text-rose-800">
            {strictError}
          </div>
        ) : null}

        {strictRunning ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
            <p>{t('strict.running')}</p>
            {strictTargets.length > 0 ? (
              <p className="font-mono text-[10.5px] text-slate-400">
                {strictTargets.join('  ·  ')}
              </p>
            ) : null}
          </div>
        ) : strictResult ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  !strictResult.available
                    ? 'bg-amber-100 text-amber-800'
                    : strictResult.ok
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                }`}
              >
                {!strictResult.available ? (
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                ) : strictResult.ok ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                )}
                {!strictResult.available ? t('strict.unavailable') : strictResult.ok ? t('strict.passed') : t('strict.failed')}
              </span>
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                {t('strict.errorCount', { count: errors.length })}
              </span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                {t('strict.warningCount', { count: warnings.length })}
              </span>
              <span className="text-[10px] text-slate-500">
                {t('strict.summary', { count: strictResult.targets.length, seconds: (strictResult.durationMs / 1000).toFixed(1) })}
              </span>
              {strictResult.runtime.version ? (
                <span className="text-[10px] text-slate-400">
                  DITA-OT {strictResult.runtime.version}
                </span>
              ) : null}
              <span className="ml-auto font-mono text-[9.5px] text-slate-400">
                {strictResult.command}
              </span>
            </div>

            {aiApplied ? (
              <div className="flex shrink-0 items-center gap-1.5 border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[11px] text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t('strict.aiApplied')}
              </div>
            ) : null}

            {unavailable ? (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
                <p>{strictResult.message ?? t('strict.noCli')}</p>
                {onOpenPluginGuide ? (
                  <button
                    type="button"
                    onClick={onOpenPluginGuide}
                    data-testid="strict-open-plugin-guide"
                    className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10.5px] font-medium text-amber-900 transition-colors hover:bg-amber-100"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    {t('desktop.shortcut.openGuide')}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="dita-scroller min-h-0 flex-1 overflow-y-auto">
              {strictResult.diagnostics.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-xs text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  <p className="font-medium">{t('strict.cleanTitle')}</p>
                  <p className="text-[10.5px] text-emerald-600">
                    {t('strict.cleanBody')}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {strictResult.diagnostics.map((diagnostic) => (
                    <li key={diagnostic.id} className="flex items-start gap-1 pr-3 hover:bg-slate-50">
                      <button
                        type="button"
                        onClick={() =>
                          onJumpToFile(diagnostic.filePath, diagnostic.line, diagnostic.column)
                        }
                        className="flex min-w-0 flex-1 items-start gap-2 py-2 pl-4 pr-1 text-left"
                      >
                        {diagnostic.severity === 'error' ? (
                          <AlertCircle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <AlertTriangle
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                            aria-hidden="true"
                          />
                        )}
                        {diagnostic.code ? (
                          <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600">
                            {diagnostic.code}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 text-[11px] text-slate-800">
                          {diagnostic.message}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">
                          {diagnostic.filePath}:{diagnostic.line}:{diagnostic.column}
                        </span>
                      </button>
                      {onAiFixDiagnostic ? (
                        <button
                          type="button"
                          onClick={() => onAiFixDiagnostic(diagnostic)}
                          title={t('strict.fixWithAi')}
                          aria-label={t('strict.fixWithAi')}
                          className="mt-1.5 shrink-0 rounded p-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {strictResult.logTail ? (
              <details className="shrink-0 border-t border-slate-200 bg-slate-50">
                <summary className="cursor-pointer px-4 py-1.5 text-[10.5px] font-medium text-slate-600">
                  {t('strict.rawOutput')}
                </summary>
                <pre className="dita-scroller max-h-32 overflow-auto px-4 pb-2 font-mono text-[10px] leading-relaxed text-slate-600">
                  {strictResult.logTail}
                </pre>
              </details>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
            {t('strict.noTargets')}
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[10px] text-slate-500">
            {t('strict.footnote')}
          </span>
          <div className="flex items-center gap-2">
            {!strictRunning && strictResult && strictResult.diagnostics.length > 0 && onViewInProblems ? (
              <button
                type="button"
                onClick={onViewInProblems}
                data-testid="strict-view-in-problems"
                className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
              >
                {t('strict.viewInProblems')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={strictRunning}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {t('common.close')}
            </button>
            <button
              type="button"
              disabled={strictRunning || !input}
              onClick={() => {
                if (input) void runStrictValidation(input);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3 w-3 ${strictRunning ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {t('strict.revalidate')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
