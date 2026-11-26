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
import type { AiApplyMode } from '../store/editor-store';
import {
  getCurrentLocale,
  translate,
  useI18n,
  type MessageKey,
  type MessageParams,
} from '../i18n/index.js';
import {
  useAiStore,
  type AiPanelIntent,
} from '../ai/ai-store';
import {
  AI_TARGET_SCOPE_LABELS,
  resolveScopeTarget,
  type AiTargetScope,
} from '../ai/ai-target';
import { hasAiProposalChanges } from '../ai/ai-proposal';
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
  /** How the proposal lands: apply outright, auto check-out first, or preview only. */
  applyMode?: AiApplyMode;
  workspaceMode?: 'api' | 'memory';
  onApplyProposal: (patchedXml: string) => void;
  onRequestApply?: (targetMode: AiTargetMode) => void;
  onPreviewDiff?: () => void;
  onOpenSettings?: () => void;
  /** Quick action once a draft is saved: commit it. */
  onOpenCheckin?: (paths: string[]) => void;
  /** Quick action for strict-validation fixes: re-run DITA-OT. */
  onRevalidateStrict?: () => void;
  /** Retry persisting an `applied-unsaved` patch. */
  onRetrySave?: () => void;
}

const TASK_OPTIONS: Array<{ id: AiTaskType; labelKey: MessageKey; hintKey: MessageKey }> = [
  { id: 'ask', labelKey: 'ai.task.ask', hintKey: 'ai.task.askHint' },
  { id: 'authoring', labelKey: 'ai.task.authoring', hintKey: 'ai.task.authoringHint' },
  { id: 'optimize_tags', labelKey: 'ai.task.optimize', hintKey: 'ai.task.optimizeHint' },
  { id: 'fix_error', labelKey: 'ai.task.fix', hintKey: 'ai.task.fixHint' },
];

const TARGET_MODE_LABEL_KEYS: Record<AiTargetMode, MessageKey> = {
  element: 'ai.targetMode.element',
  'line-window': 'ai.targetMode.lineWindow',
  'full-document': 'ai.targetMode.fullDocument',
};

function defaultInstruction(taskType: AiTaskType, subAction?: AiSubAction): string {
  const tr = (key: MessageKey, params?: MessageParams) => translate(getCurrentLocale(), key, params);
  if (subAction === 'fix_xml') return tr('ai.instruction.fixXml');
  if (subAction === 'fix_diagnostic') return tr('ai.instruction.fixDiagnostic');
  if (subAction === 'fix_strict') return tr('ai.instruction.fixStrict');
  if (taskType === 'optimize_tags') return tr('ai.instruction.optimize');
  if (taskType === 'authoring') return tr('ai.instruction.authoring');
  if (taskType === 'fix_error') return tr('ai.instruction.fixError');
  return tr('ai.instruction.ask');
}

function targetLabel(target: AiTargetSpec | null): string {
  const tr = (key: MessageKey, params?: MessageParams) => translate(getCurrentLocale(), key, params);
  if (!target) return tr('ai.target.none');
  if (target.mode === 'element') {
    return tr('ai.target.element', {
      path: target.elementPath && target.elementPath.length > 0 ? target.elementPath.join('/') : tr('ai.target.rootElement'),
    });
  }
  if (target.mode === 'line-window') {
    const start = target.line ?? 1;
    const end = target.lineEnd ?? start;
    return end > start
      ? tr('ai.target.lineRange', { start, end })
      : tr('ai.target.line', { start });
  }
  return tr('ai.target.fullDocument');
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
  applyMode = 'apply',
  workspaceMode = 'api',
  onApplyProposal,
  onRequestApply,
  onPreviewDiff,
  onOpenSettings,
  onOpenCheckin,
  onRevalidateStrict,
  onRetrySave,
}: AiAssistantPanelProps) {
  const { t } = useI18n();
  const panelPhase = useAiStore((state) => state.phase);
  const messages = useAiStore((state) => state.messages);
  const draft = useAiStore((state) => state.draft);
  const deltaText = useAiStore((state) => state.deltaText);
  const proposal = useAiStore((state) => state.proposal);
  const applied = useAiStore((state) => state.applied);
  const applyOutcome = useAiStore((state) => state.applyOutcome);
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
    if (!el) return;
    // Keep the empty state pinned to its first line; only follow the stream once there is a turn.
    if (messages.length === 0 && !proposal && !error) {
      el.scrollTop = 0;
      return;
    }
    el.scrollTop = el.scrollHeight;
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

  // A patch that echoes the target back would "apply" without touching the buffer, so say so
  // instead of offering a button that silently changes nothing.
  const proposalNoChange = proposal !== null && !hasAiProposalChanges(proposal);
  const applying = applyOutcome?.status === 'applying';
  const applyBlockedReason = !canApply
    ? t('ai.proposal.applyLocked')
    : readOnly
      ? t('ai.proposal.applyReadOnly')
      : proposalNoChange
        ? t('ai.proposal.noChangeHint')
        : applyMode === 'checkout-and-apply'
          ? t('ai.proposal.applyCheckoutDraftHint')
          : workspaceMode === 'api'
            ? t('ai.proposal.applyDraftHint')
            : t('ai.proposal.applyHint');
  // The label must say what the click will actually do (lock, draft, or plain buffer write).
  const applyLabel =
    applyMode === 'checkout-and-apply'
      ? t('ai.proposal.applyCheckoutDraft')
      : applyMode === 'apply' && workspaceMode === 'api'
        ? t('ai.proposal.applyDraft')
        : t('ai.proposal.apply');

  const proposalBadges = useMemo(() => {
    if (!proposal) return [];
    return [
      ...(hasAiProposalChanges(proposal)
        ? []
        : [{ ok: false, label: t('ai.badge.noChange') }]),
      {
        ok: proposal.verification.wellFormed,
        label: proposal.verification.wellFormed ? t('ai.badge.wellFormed') : t('ai.badge.notWellFormed'),
      },
      {
        ok: proposal.verification.prosemirrorCompatible,
        label: proposal.verification.prosemirrorCompatible ? t('ai.badge.visualOk') : t('ai.badge.visualFail'),
      },
      {
        ok: proposal.verification.preservedDoctype,
        label: proposal.verification.preservedDoctype ? t('ai.badge.doctypeKept') : t('ai.badge.doctypeChanged'),
      },
    ];
  }, [proposal, t]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-xs" data-testid="ai-assistant-panel">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-2.5">
        <Sparkles className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
        <span className="shrink-0 whitespace-nowrap font-semibold text-slate-800">{t('ai.title')}</span>
        {meta?.model ?? config?.model ? (
          <span className="min-w-0 flex-1 truncate rounded bg-white/80 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
            {meta?.model ?? config?.model}
          </span>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded p-1 text-slate-500 hover:bg-white hover:text-blue-700"
              title={t('ai.settings')}
              aria-label={t('ai.settings')}
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={closePanel}
            className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700"
            title={t('ai.close')}
            aria-label={t('ai.close')}
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
              {configError ?? t('ai.notConfigured')}
            </span>
          </p>
          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="ml-4 mt-1 rounded border border-amber-300 bg-white px-1.5 py-0.5 font-medium text-amber-900 hover:bg-amber-100"
            >
              {t('ai.openSettings')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-[10px]">
        <div
          className="inline-flex overflow-hidden rounded-full border border-blue-200 bg-white font-medium"
          role="group"
          aria-label={t('ai.scopeAria')}
        >
          {(['fragment', 'document'] as AiTargetScope[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setScope(option)}
              aria-pressed={scope === option}
              className={`px-1.5 py-0.5 text-[9.5px] transition-colors ${
                scope === option
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {t(AI_TARGET_SCOPE_LABELS[option])}
            </button>
          ))}
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 font-medium text-blue-800">
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          {scope === 'document'
            ? t('ai.scopeBanner.document')
            : effectiveTarget && effectiveTarget.mode !== 'full-document'
              ? `${t(TARGET_MODE_LABEL_KEYS[effectiveTarget.mode])} · ${targetLabel(effectiveTarget)}`
              : t('ai.scopeBanner.fallback')}
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
            {showHistory ? t('ai.historyHide') : t('ai.historyShow', { count: messages.length })}
          </button>
        ) : null}
      </div>

      <div ref={scrollRef} className="dita-scroller min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2">
        {messages.length === 0 && !proposal ? (
          <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/40 p-2.5 text-[10.5px] leading-relaxed text-slate-600">
            <p className="flex items-center gap-1 font-semibold text-blue-800">
              <Wand2 className="h-3 w-3" aria-hidden="true" />
              {t('ai.empty.title')}
            </p>
            <p className="mt-1">
              {t('ai.empty.body')}
            </p>
            <p className="mt-1 text-slate-400">
              {t('ai.empty.tip')}
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
                {message.role === 'user' ? t('ai.role.me') : t('ai.role.ai')}
              </span>
              <div
                className={`max-w-[95%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                {message.content || (isLastStreaming ? '' : '…')}
                {isLastStreaming ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-blue-600">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                    {t('ai.generating')}
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
              {t('ai.retry', { attempt: retry.attempt, max: retry.maxRetries, reason: retry.reason })}
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
              {t('ai.retryHint')}
            </p>
          </div>
        ) : null}

        {proposal ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-emerald-900">{t('ai.proposal.title')}</span>
              <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                {t(TARGET_MODE_LABEL_KEYS[proposal.targetMode])}
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
                  {t('ai.proposal.retries', { count: proposal.verification.retryCount })}
                </span>
              ) : null}
              {proposal.canRevalidateStrict ? (
                <span className="rounded bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                  {t('ai.proposal.revalidate')}
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
              <div className="mt-1.5 space-y-1.5" data-testid="ai-apply-outcome">
                {applyOutcome?.status === 'applied-unsaved' ? (
                  <div
                    role="alert"
                    data-testid="ai-apply-unsaved"
                    className="rounded bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-900"
                  >
                    <p>{t('ai.proposal.appliedUnsaved', { message: applyOutcome.saveError ?? '' })}</p>
                    <p className="mt-0.5 text-[9.5px] font-normal text-amber-800">
                      {t('ai.proposal.saveDraftRetryHint')}
                    </p>
                    {onRetrySave ? (
                      <button
                        type="button"
                        data-testid="ai-retry-save-draft"
                        onClick={onRetrySave}
                        className="mt-1 inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-50"
                      >
                        <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
                        {t('ai.proposal.retrySaveDraft')}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p
                    data-testid="ai-apply-saved"
                    className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-medium text-emerald-900"
                  >
                    {applyOutcome?.status === 'saved-draft'
                      ? t(
                          applyOutcome.checkedOutAutomatically
                            ? 'ai.proposal.appliedDraftCheckedOut'
                            : 'ai.proposal.appliedDraft',
                        )
                      : t('ai.proposal.applied')}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {workspaceMode === 'api' && onOpenCheckin ? (
                    <button
                      type="button"
                      data-testid="ai-open-checkin"
                      title={t('ai.proposal.checkinHint')}
                      onClick={() => onOpenCheckin([applyOutcome?.filePath ?? filePath])}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('ai.proposal.checkin')}
                    </button>
                  ) : null}
                  {onRevalidateStrict && proposal.canRevalidateStrict ? (
                    <button
                      type="button"
                      data-testid="ai-rerun-strict"
                      onClick={onRevalidateStrict}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('ai.proposal.rerunStrict')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-1.5">
                {onPreviewDiff ? (
                  <button
                    type="button"
                    onClick={onPreviewDiff}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                    {t('ai.proposal.viewDiff')}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="ai-apply-button"
                  disabled={!canApply || readOnly || proposalNoChange || applying}
                  title={applyBlockedReason}
                  onClick={() => {
                    if (onRequestApply) onRequestApply(proposal.targetMode);
                    else onApplyProposal(proposal.patchedXml);
                  }}
                  className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {applying ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                  )}
                  {applying ? t('ai.proposal.applying') : applyLabel}
                </button>
                <button
                  type="button"
                  onClick={dismissProposal}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                >
                  <Ban className="h-2.5 w-2.5" aria-hidden="true" />
                  {t('ai.proposal.dismiss')}
                </button>
              </div>
            )}
            {!canApply && !applied ? (
              <p className="mt-1 text-[9.5px] text-amber-700">
                {t('ai.proposal.readOnlyHint')}
              </p>
            ) : null}
            {proposalNoChange && !applied ? (
              <p className="mt-1 text-[9.5px] text-amber-700">{t('ai.proposal.noChangeHint')}</p>
            ) : null}
          </div>
        ) : null}

        {showHistory ? (
          <div className="rounded border border-slate-200 bg-white p-1.5 text-[9.5px] text-slate-500">
            <p className="font-medium text-slate-600">{t('ai.history.title')}</p>
            <ul className="mt-1 space-y-0.5">
              {historyFromMessages(messages).map((item, index) => (
                <li key={`${item.role}-${String(index)}`} className="truncate">
                  {item.role === 'user' ? t('ai.role.me') : t('ai.role.ai')}：{item.content}
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
              title={t(option.hintKey)}
              onClick={() => setTaskType(option.id)}
              className={`rounded px-1.5 py-0.5 text-[9.5px] font-medium transition-colors ${
                taskType === option.id
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-slate-500 hover:bg-slate-200/80 hover:text-slate-800'
              }`}
            >
              {t(option.labelKey)}
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
                ? t('ai.placeholder.documentAsk')
                : t('ai.placeholder.fragmentAsk')
              : scope === 'document'
                ? t('ai.placeholder.documentAuthor')
                : t('ai.placeholder.fragmentAuthor')
          }
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
        <div className="mt-1 flex items-center gap-1.5">
          {streaming ? (
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-white px-2 py-1 text-[10px] font-medium text-rose-700 hover:bg-rose-50"
            >
              <Square className="h-2.5 w-2.5" aria-hidden="true" />
              {t('ai.stop')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={readOnly && taskType !== 'ask'}
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-2.5 w-2.5" aria-hidden="true" />
              {t('ai.send')}
            </button>
          )}
          <span className="text-[9px] text-slate-400">
            {readOnly ? t('ai.footer.readOnly') : t('ai.footer.confirm')}
          </span>
          {deltaText && streaming ? (
            <span className="ml-auto font-mono text-[9px] text-blue-600">
              +{t('ai.chars', { count: deltaText.length })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
