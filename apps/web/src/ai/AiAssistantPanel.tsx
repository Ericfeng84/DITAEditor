import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Square,
  Wand2,
  X,
} from 'lucide-react';
import type { AiTargetMode, AiTargetSpec } from '@dita/core';
import type { WorkspaceDiagnostic } from '../services/workspace-api';
import {
  useAiStore,
  type AiPanelIntent,
} from '../ai/ai-store';
import {
  AI_TARGET_SCOPE_LABELS,
  resolveScopeTarget,
  type AiTargetScope,
} from '../ai/ai-target';
import type {
  AiDiagnosticContext,
  AiHistoryTurn,
  AiStreamRequest,
  AiSubAction,
  AiTaskType,
} from '../ai/ai-types';

export interface AiAssistantPanelProps {
  filePath: string;
  xml: string;
  target: AiTargetSpec | null;
  /** Recomputed at send time so a caret/selection moved after opening the tab is honored. */
  resolveTarget?: () => AiTargetSpec;
  projectPath?: string;
  rootMapPath?: string;
  ditavalPath?: string;
  branch?: string;
  diagnostics?: WorkspaceDiagnostic[];
  canApply: boolean;
  readOnly: boolean;
  onApplyProposal: (patchedXml: string) => void;
  onRequestApply?: (targetMode: AiTargetMode) => void;
  onPreviewDiff?: () => void;
  onOpenSettings?: () => void;
}

const TASK_OPTIONS: Array<{ id: AiTaskType; label: string; hint: string }> = [
  { id: 'ask', label: '提问', hint: '解释结构、语义或给出建议（不修改 XML）' },
  { id: 'authoring', label: '改写', hint: '按指令改写当前目标并生成补丁' },
  { id: 'optimize_tags', label: '优化标签', hint: '改用更精确的 DITA 1.3 元素' },
  { id: 'fix_error', label: '修复', hint: '修复 XML / 诊断 / 严格校验错误' },
];

const TARGET_MODE_LABELS: Record<AiTargetMode, string> = {
  element: '元素靶向',
  'line-window': '行窗口',
  'full-document': '整篇文档',
};

function defaultInstruction(taskType: AiTaskType, subAction?: AiSubAction): string {
  if (subAction === 'fix_xml') return '请修复当前 XML 的良构性错误，保持其它内容不变。';
  if (subAction === 'fix_diagnostic') return '请修复当前工作区诊断所指出的问题，保持 DITA 语义与格式。';
  if (subAction === 'fix_strict') return '请修复 DITA-OT 严格校验报错，保持 DTD/RNG 合法性。';
  if (taskType === 'optimize_tags') return '请在保持语义不变的前提下，把通用标签优化为更精确的 DITA 1.3 元素。';
  if (taskType === 'authoring') return '请在保持 DITA 语义与结构的前提下改写选中内容。';
  if (taskType === 'fix_error') return '请修复当前问题，保持其它内容不变。';
  return '请解释当前选中内容的 DITA 语义、结构约束与可改进之处。';
}

function targetLabel(target: AiTargetSpec | null): string {
  if (!target) return '未定位';
  if (target.mode === 'element') {
    return `元素 ${target.elementPath && target.elementPath.length > 0 ? target.elementPath.join('/') : '根元素'}`;
  }
  if (target.mode === 'line-window') {
    const start = target.line ?? 1;
    const end = target.lineEnd ?? start;
    return end > start ? `第 ${String(start)}–${String(end)} 行` : `第 ${String(start)} 行`;
  }
  return '整篇文档';
}

function toDiagnosticContext(
  diagnostics: WorkspaceDiagnostic[] | undefined,
  filePath: string,
): AiDiagnosticContext[] {
  if (!diagnostics) return [];
  return diagnostics
    .filter((item) => !item.filePath || item.filePath === filePath)
    .slice(0, 12)
    .map((item) => ({
      source: item.source,
      message: item.message,
      ...(item.line ? { line: item.line } : {}),
      ...(item.column ? { column: item.column } : {}),
    }));
}

function historyFromMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): AiHistoryTurn[] {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-6)
    .map((message) => ({ role: message.role, content: message.content }));
}

/**
 * Right-inspector AI chat. Building the request here keeps every entry point
 * (bubble toolbar, diagnostics, strict validation, XML error banner) on one code path;
 * `pendingIntent` carries the target/instruction prepared by those entry points.
 */
export function AiAssistantPanel({
  filePath,
  xml,
  target,
  resolveTarget,
  projectPath,
  rootMapPath,
  ditavalPath,
  branch,
  diagnostics,
  canApply,
  readOnly,
  onApplyProposal,
  onRequestApply,
  onPreviewDiff,
  onOpenSettings,
}: AiAssistantPanelProps) {
  const panelPhase = useAiStore((state) => state.phase);
  const messages = useAiStore((state) => state.messages);
  const draft = useAiStore((state) => state.draft);
  const deltaText = useAiStore((state) => state.deltaText);
  const proposal = useAiStore((state) => state.proposal);
  const applied = useAiStore((state) => state.applied);
  const error = useAiStore((state) => state.error);
  const meta = useAiStore((state) => state.meta);
  const retry = useAiStore((state) => state.retry);
  const config = useAiStore((state) => state.config);
  const configError = useAiStore((state) => state.configError);
  const intent = useAiStore((state) => state.pendingIntent);
  const setDraft = useAiStore((state) => state.setDraft);
  const send = useAiStore((state) => state.send);
  const cancel = useAiStore((state) => state.cancel);
  const dismissProposal = useAiStore((state) => state.dismissProposal);
  const closePanel = useAiStore((state) => state.closePanel);

  const [taskType, setTaskType] = useState<AiTaskType>(intent?.taskType ?? 'ask');
  const [showHistory, setShowHistory] = useState(false);
  const autoSentIntentRef = useRef<AiPanelIntent | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [lastTarget, setLastTarget] = useState<AiTargetSpec | null>(null);
  const effectiveTarget = intent?.target ?? lastTarget ?? target;
  // Authoring defaults to the whole topic so a single instruction can draft a complete DITA topic.
  const [scope, setScope] = useState<AiTargetScope>('document');
  // Entry points (bubble toolbar, diagnostics, strict validation) carry an explicit fragment.
  useEffect(() => {
    if (intent?.target) setScope('fragment');
  }, [intent]);
  const streaming = panelPhase === 'streaming';

  useEffect(() => {
    if (intent?.taskType) setTaskType(intent.taskType);
  }, [intent]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, deltaText, proposal, error]);

  const runSend = async (
    nextTaskType: AiTaskType,
    instruction: string,
    requestTarget: AiTargetSpec | null,
    subAction?: AiSubAction,
    intentDiagnostics?: AiDiagnosticContext[],
  ) => {
    const contextDiagnostics = intentDiagnostics ?? toDiagnosticContext(diagnostics, filePath);
    const history = historyFromMessages(messages);
    const effectiveProjectPath = intent?.projectPath ?? projectPath ?? filePath;
    const request: AiStreamRequest = {
      projectPath: effectiveProjectPath,
      ...(xml ? { xml } : {}),
      ...(rootMapPath ? { rootMapPath } : {}),
      ...(ditavalPath ? { ditavalPath } : {}),
      ...(branch ? { branch } : {}),
      taskType: nextTaskType,
      ...(subAction ? { subAction } : {}),
      instruction: instruction.trim() || defaultInstruction(nextTaskType, subAction),
      target: requestTarget ?? { mode: 'full-document' },
      ...(contextDiagnostics.length > 0 ? { context: { diagnostics: contextDiagnostics } } : {}),
      ...(history.length > 0 ? { history } : {}),
    };
    await send(request);
  };

  useEffect(() => {
    if (!intent?.autoSend) return;
    if (streaming) return;
    if (autoSentIntentRef.current === intent) return;
    autoSentIntentRef.current = intent;
    void runSend(
      intent.taskType,
      intent.instruction ?? defaultInstruction(intent.taskType, intent.subAction),
      intent.target,
      intent.subAction,
      intent.diagnostics,
    );
    // runSend intentionally reads the latest store snapshot; re-firing is guarded by autoSentIntentRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, streaming]);

  const configured = config?.configured ?? false;
  const showConfigWarning = Boolean(configError) || (config !== null && !configured);

  const safeResolveTarget = (): AiTargetSpec | null => {
    try {
      return resolveTarget?.() ?? null;
    } catch {
      // Malformed source XML can block fragment resolution; fall back to the whole document.
      return null;
    }
  };

  const handleSubmit = () => {
    if (streaming) return;
    if (!draft.trim() && taskType !== 'optimize_tags') return;
    if (readOnly && taskType !== 'ask') return;
    const sendTarget = scope === 'document'
      ? resolveScopeTarget('document', [])
      : resolveScopeTarget('fragment', [intent?.target, safeResolveTarget(), lastTarget, target]);
    // A whole-topic send must not poison the remembered fragment target.
    if (scope === 'fragment') setLastTarget(sendTarget);
    void runSend(taskType, draft, sendTarget);
  };

  const proposalBadges = useMemo(() => {
    if (!proposal) return [];
    return [
      {
        ok: proposal.verification.wellFormed,
        label: proposal.verification.wellFormed ? 'XML 良构' : 'XML 非良构',
      },
      {
        ok: proposal.verification.prosemirrorCompatible,
        label: proposal.verification.prosemirrorCompatible ? '可视化兼容' : '可视化不兼容',
      },
      {
        ok: proposal.verification.preservedDoctype,
        label: proposal.verification.preservedDoctype ? 'DOCTYPE 保留' : 'DOCTYPE 变更',
      },
    ];
  }, [proposal]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-xs" data-testid="ai-assistant-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-2.5">
        <Sparkles className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
        <span className="font-semibold text-slate-800">AI 助手</span>
        {meta?.model ?? config?.model ? (
          <span className="truncate rounded bg-white/80 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
            {meta?.model ?? config?.model}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded p-1 text-slate-500 hover:bg-white hover:text-indigo-700"
              title="AI 助手设置"
              aria-label="AI 助手设置"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={closePanel}
            className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
            title="关闭 AI 助手"
            aria-label="关闭 AI 助手"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showConfigWarning ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-900">
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              {configError ?? '尚未配置 AI 模型服务，请先在设置中填写 Base URL、模型与 API Key。'}
            </span>
          </p>
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="ml-4 mt-1 rounded border border-amber-300 bg-white px-1.5 py-0.5 font-medium text-amber-900 hover:bg-amber-100"
            >
              打开 AI 设置
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[10px]">
        <div
          className="inline-flex overflow-hidden rounded-full border border-indigo-200 bg-white font-medium"
          role="group"
          aria-label="AI 靶向范围"
        >
          {(['fragment', 'document'] as AiTargetScope[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              aria-pressed={scope === option}
              className={`px-1.5 py-0.5 text-[9.5px] transition-colors ${
                scope === option
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {AI_TARGET_SCOPE_LABELS[option]}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-800">
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          {scope === 'document'
            ? '整篇模式 · 完整 Topic'
            : effectiveTarget && effectiveTarget.mode !== 'full-document'
              ? `${TARGET_MODE_LABELS[effectiveTarget.mode]} · ${targetLabel(effectiveTarget)}`
              : '未定位 · 发送时回退整篇文档'}
        </span>
        {scope === 'fragment' && meta?.targetTag ? (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-700">
            &lt;{meta.targetTag}&gt;
          </span>
        ) : null}
        {intent?.subAction ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">{intent.subAction}</span>
        ) : null}
        {meta?.contextBadges.map((badge) => (
          <span key={badge} className="rounded bg-white px-1.5 py-0.5 text-slate-500">
            {badge}
          </span>
        ))}
        {effectiveTarget?.selectedText ? (
          <span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-slate-400">
            “{effectiveTarget.selectedText.slice(0, 60)}”
          </span>
        ) : null}
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="ml-auto text-[9.5px] text-slate-400 hover:text-slate-700"
          >
            {showHistory ? '隐藏历史' : `历史 ${String(messages.length)}`}
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="dita-scroller min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        {messages.length === 0 && !proposal ? (
          <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-2.5 text-[10.5px] leading-relaxed text-slate-600">
            <p className="flex items-center gap-1 font-semibold text-indigo-800">
              <Wand2 className="h-3 w-3" aria-hidden="true" />
              编写整篇 Topic，或改写选中片段
            </p>
            <p className="mt-1">
              默认按「整篇 Topic」靶向：一句话即可起草或重写整个主题，系统保留 XML 声明与 DOCTYPE，
              结果先经过良构 / 可视化 / DOCTYPE 校验，再由你确认应用。
            </p>
            <p className="mt-1 text-slate-400">
              只改选中元素时，把上方范围切到「片段」，或在可视化编辑器里选中文字后用气泡工具栏的 AI 按钮。
            </p>
          </div>
        ) : null}

        {messages.map((message, index) => {
          const isLastStreaming = streaming && index === messages.length - 1;
          return (
            <div
              key={message.id}
              className={`flex flex-col gap-0.5 ${message.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className="px-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                {message.role === 'user' ? '我' : 'AI'}
              </span>
              <div
                className={`max-w-[95%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {message.content || (isLastStreaming ? '' : '…')}
                {isLastStreaming ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-indigo-600">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                    生成中
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}

        {retry ? (
          <p className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
            <RotateCcw className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              第 {retry.attempt}/{retry.maxRetries} 次重试：{retry.reason}
            </span>
          </p>
        ) : null}

        {error ? (
          <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10.5px] text-rose-800">
            <p className="flex items-start gap-1.5">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="flex-1">{error}</span>
            </p>
            <p className="mt-1 text-[9.5px] text-rose-600">
              可按 Ctrl+Z 撤销已应用的修改；若连续失败，请检查 AI 设置中的端点与密钥。
            </p>
          </div>
        ) : null}

        {proposal ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-emerald-900">AI 修改提案</span>
              <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                {TARGET_MODE_LABELS[proposal.targetMode]}
                {proposal.targetTag ? ` · <${proposal.targetTag}>` : ''}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[10.5px] leading-relaxed text-slate-700">
              {proposal.explanation}
            </p>
            {proposal.changesSummary.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                {proposal.changesSummary.map((item) => (
                  <li key={item} className="flex items-start gap-1">
                    <ChevronRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {proposalBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                    badge.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {badge.label}
                </span>
              ))}
              {proposal.verification.retryCount > 0 ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">
                  重试 {proposal.verification.retryCount}
                </span>
              ) : null}
              {proposal.canRevalidateStrict ? (
                <span className="rounded bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                  可重新严格校验
                </span>
              ) : null}
            </div>
            {proposal.verification.warnings.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-[9.5px] text-amber-800">
                {proposal.verification.warnings.map((warning) => (
                  <li key={warning}>⚠ {warning}</li>
                ))}
              </ul>
            ) : null}
            {applied ? (
              <p className="mt-1.5 rounded bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-900">
                已应用到编辑器（可 Ctrl+Z 撤销），尚未保存到文件。
              </p>
            ) : (
              <div className="mt-2 flex items-center gap-1.5">
                {onPreviewDiff ? (
                  <button
                    type="button"
                    onClick={onPreviewDiff}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                    查看差异
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={!canApply || readOnly}
                  title={
                    !canApply
                      ? '当前身份或检出锁限制：仅可预览 AI 修改'
                      : readOnly
                        ? '只读模式下无法应用'
                        : '把提案写入编辑器缓冲区'
                  }
                  onClick={() => {
                    if (onRequestApply) onRequestApply(proposal.targetMode);
                    else onApplyProposal(proposal.patchedXml);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                  应用
                </button>
                <button
                  type="button"
                  onClick={dismissProposal}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                >
                  <Ban className="h-2.5 w-2.5" aria-hidden="true" />
                  忽略
                </button>
              </div>
            )}
            {!canApply && !applied ? (
              <p className="mt-1 text-[9.5px] text-amber-700">
                只读 / 未检出：仍可查看差异，检出文件后才能应用。
              </p>
            ) : null}
          </div>
        ) : null}

        {showHistory ? (
          <div className="rounded border border-slate-200 bg-white p-1.5 text-[9.5px] text-slate-500">
            <p className="font-medium text-slate-600">发送历史（最多 6 轮作为上下文）</p>
            <ul className="mt-1 space-y-0.5">
              {historyFromMessages(messages).map((item, index) => (
                <li key={`${item.role}-${String(index)}`} className="truncate">
                  {item.role === 'user' ? '我' : 'AI'}：{item.content}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 p-2">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {TASK_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              onClick={() => setTaskType(option.id)}
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-medium transition-colors ${
                taskType === option.id
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'text-slate-500 hover:bg-slate-200/80 hover:text-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
          <span className="ml-auto truncate font-mono text-[9px] text-slate-400">
            {filePath.split(/[\\/]/).pop() ?? filePath}
          </span>
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder={
            taskType === 'ask'
              ? scope === 'document'
                ? '询问整篇 Topic 的结构、语义或修改建议…（Ctrl+Enter 发送）'
                : '询问当前片段的结构、语义或修改建议…（Ctrl+Enter 发送）'
              : scope === 'document'
                ? '描述要编写或重写的完整 Topic，例如：写一篇「安装前检查」的 task，含前置条件与 3 个步骤…（Ctrl+Enter 发送）'
                : '描述希望如何修改当前靶向内容…（Ctrl+Enter 发送）'
          }
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
        />
        <div className="mt-1 flex items-center gap-1.5">
          {streaming ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-50"
            >
              <Square className="h-2.5 w-2.5" aria-hidden="true" />
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={readOnly && taskType !== 'ask'}
              className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-2.5 w-2.5" aria-hidden="true" />
              发送
            </button>
          )}
          <span className="text-[9px] text-slate-400">
            {readOnly ? '只读模式：可提问，不能生成修改' : 'AI 生成内容需要人工确认后才会写入'}
          </span>
          {deltaText && streaming ? (
            <span className="ml-auto font-mono text-[9px] text-indigo-500">
              +{deltaText.length} 字符
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
