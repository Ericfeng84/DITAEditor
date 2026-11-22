import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileDiff,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AiProposal } from './ai-types';
import { DiffViewer } from '../components/DiffViewer';

export interface AiDiffDialogProps {
  open: boolean;
  proposal: AiProposal | null;
  canApply: boolean;
  readOnly: boolean;
  onClose: () => void;
  onApply: (patchedXml: string) => void;
}

/**
 * Side-by-side review of the AI proposal before anything touches the editor buffer.
 * The diff is read-only; applying is a single editor transaction (contract §4).
 */
export function AiDiffDialog({
  open,
  proposal,
  canApply,
  readOnly,
  onClose,
  onApply,
}: AiDiffDialogProps) {
  if (!open || !proposal) return null;

  const verification = proposal.verification;
  const blocked = !canApply || readOnly;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="AI 修改差异"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[80vh] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <FileDiff className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              AI 修改差异
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {proposal.explanation}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            aria-label="关闭 AI 差异对话框"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50/80 px-4 py-1.5 text-[10px]">
          <span className="rounded bg-slate-900 px-1.5 py-0.5 font-medium text-white">
            {proposal.targetMode}
            {proposal.targetTag ? ` · <${proposal.targetTag}>` : ''}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${
              verification.wellFormed
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {verification.wellFormed ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
            )}
            {verification.wellFormed ? 'XML 良构' : 'XML 非良构'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${
              verification.prosemirrorCompatible
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {verification.prosemirrorCompatible ? '可视化兼容' : '可视化不兼容'}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${
              verification.preservedDoctype
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {verification.preservedDoctype ? 'DOCTYPE 保留' : 'DOCTYPE 变更'}
          </span>
          {verification.retryCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
              自动重试 {verification.retryCount}
            </span>
          ) : null}
          {proposal.canRevalidateStrict ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              应用后可重新严格校验
            </span>
          ) : null}
          <span className="ml-auto text-[9.5px] text-slate-400">
            原始版本 → AI 补丁版本（只读预览）
          </span>
        </div>

        {verification.warnings.length > 0 ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[10.5px] text-amber-900">
            <p className="flex items-center gap-1 font-medium">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              校验提示
            </p>
            <ul className="mt-0.5 list-disc pl-5">
              {verification.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden">
          <DiffViewer
            oldText={proposal.originalXml}
            newText={proposal.patchedXml}
            fromLabel="当前编辑器缓冲区"
            toLabel="AI 补丁"
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <span className="text-[10px] text-slate-500">
            {blocked
              ? '当前身份或检出锁限制：仅可预览，检出文件后可应用。'
              : '应用只修改编辑器缓冲区（一次事务，可撤销），不会自动保存或提交。'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              关闭
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={() => onApply(proposal.patchedXml)}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              应用到编辑器
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
