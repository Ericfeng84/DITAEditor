import { useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { PublishDiagnostic, StrictValidationInput } from '../../services/publish-api';
import { usePublishStore } from '../../store/publish-store';

export interface StrictValidationDialogProps {
  open: boolean;
  input: StrictValidationInput | null;
  targetLabel: string;
  onClose: () => void;
  onJumpToFile: (path: string, line: number, column: number) => void;
  /** Opens the AI assistant with the strict DITA-OT diagnostic as fix context. */
  onAiFixDiagnostic?: (diagnostic: PublishDiagnostic) => void;
  /** Shows the "proposal applied, re-run validation" hint after an AI fix. */
  aiApplied?: boolean;
}

export function StrictValidationDialog({
  open,
  input,
  targetLabel,
  onClose,
  onJumpToFile,
  onAiFixDiagnostic,
  aiApplied = false,
}: StrictValidationDialogProps) {
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
      aria-label="DITA-OT 严格校验"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !strictRunning) onClose();
      }}
    >
      <div className="flex h-[74vh] w-[min(900px,94vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              DITA-OT 严格校验
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {targetLabel || '按 Root Map 校验'} · 使用 OASIS DITA 1.3 DTD/RNG +{' '}
              <code className="font-mono">--processing-mode=strict</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={strictRunning}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            aria-label="关闭严格校验对话框"
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
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden="true" />
            <p>正在调用 DITA-OT 预检 DTD/RNG 与严格处理模式…</p>
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
                {!strictResult.available ? 'DITA-OT 不可用' : strictResult.ok ? '校验通过' : '校验未通过'}
              </span>
              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                {errors.length} 错误
              </span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                {warnings.length} 警告
              </span>
              <span className="text-[10px] text-slate-500">
                {strictResult.targets.length} 个输入 · {(strictResult.durationMs / 1000).toFixed(1)} s
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
                已应用 AI 修复建议，请点击“重新校验”确认严格校验结果。
              </div>
            ) : null}

            {unavailable ? (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
                {strictResult.message ??
                  '未检测到可用的 DITA-OT CLI，严格校验暂时无法运行。请安装 DITA-OT 4.x 并配置 DITA_OT_HOME。'}
              </div>
            ) : null}

            <div className="dita-scroller min-h-0 flex-1 overflow-y-auto">
              {strictResult.diagnostics.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-xs text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                  <p className="font-medium">未发现 DTD/RNG 或严格处理模式问题</p>
                  <p className="text-[10.5px] text-emerald-600">
                    该结果来自真实 DITA-OT 调用，可作为发布前质量门禁。
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
                          title="用 AI 修复此问题"
                          aria-label="用 AI 修复此问题"
                          className="mt-1.5 shrink-0 rounded p-1 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
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
                  查看 DITA-OT 原始输出（尾部）
                </summary>
                <pre className="dita-scroller max-h-32 overflow-auto px-4 pb-2 font-mono text-[10px] leading-relaxed text-slate-600">
                  {strictResult.logTail}
                </pre>
              </details>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
            没有可校验的目标。
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[10px] text-slate-500">
            严格校验只读取工作区文件，不修改 XML；发布任务同样会先执行严格校验。
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={strictRunning}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              关闭
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
              重新校验
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
