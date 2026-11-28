import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { AiTargetSpec } from './ai-types';
import { hasAiProposalChanges, isAiProposalStale, isSameXmlBuffer } from './ai-proposal';
import { buildDiagnosticFixTarget, buildSourceAiTarget, buildVisualAiTarget } from './ai-target';
import { useAiStore, type AiApplyOutcome, type AiPanelIntent } from './ai-store';
import type { InspectorTab } from '../components/TopicInspector';
import type { VisualEditorHandle } from '../editor/visual/VisualEditor';
import { resolveAiApplyMode, useEditorStore } from '../store/editor-store';
import { useGitStore } from '../store/git-store';
import type {
  AiApplyMode,
  EditorViewMode,
  InspectorTarget,
  OpenEditorTab,
} from '../store/editor-store';
import type { MessageKey, MessageParams } from '../i18n/index.js';
import type { ProblemDiagnostic } from '../services/problem-diagnostics.js';
import type { PublishDiagnostic } from '../services/publish-api';

/** Everything the AI panel entry points need from the workbench composition root. */
export interface UseAiPanelActionsDeps {
  activeTab: OpenEditorTab | null;
  visualRef: RefObject<VisualEditorHandle | null>;
  sourceCursorOffsetRef: RefObject<number>;
  aiApplyMode: AiApplyMode;
  workspaceMode: 'api' | 'memory';
  checkoutFile: (path: string) => Promise<unknown>;
  openFileTab: (
    filePath: string,
    options?: { mode?: EditorViewMode; jumpOffset?: number; jumpLine?: number },
  ) => Promise<void>;
  announce: (message: string) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTarget: (target: InspectorTarget) => void;
  setInspectorTab: Dispatch<SetStateAction<InspectorTab>>;
  setAiTarget: Dispatch<SetStateAction<AiTargetSpec | null>>;
  setStrictOpen: Dispatch<SetStateAction<boolean>>;
  setStrictAiApplied: Dispatch<SetStateAction<boolean>>;
  setAiDiffOpen: Dispatch<SetStateAction<boolean>>;
  setSourceReplacementXml: Dispatch<SetStateAction<string | null>>;
}

export interface AiPanelActions {
  computeAiTarget: () => AiTargetSpec;
  openAiPanel: (intent?: AiPanelIntent) => void;
  handleInspectorTabChange: (next: InspectorTab) => void;
  handleVisualAiRequest: (kind: 'rewrite' | 'ask') => void;
  handleAiFixXmlError: () => void;
  handleAiFixDiagnostic: (diagnostic: ProblemDiagnostic) => Promise<void>;
  handleAiFixStrictDiagnostic: (diagnostic: PublishDiagnostic) => Promise<void>;
  handleApplyAiProposal: (patchedXml: string) => Promise<void>;
  handleSourceReplacementApplied: () => void;
}

/** Where a proposal's patch actually landed. */
export interface AiBufferWriteResult {
  /** The visual editor already applied the patch (it owns the single-step undo). */
  visualApplied: boolean;
  /** The source editor is mounted for this file and must be replaced explicitly. */
  syncSource: boolean;
}

/** Everything the apply pipeline needs from the workbench shell. */
export interface ApplyAiProposalDeps {
  patchedXml: string;
  workspaceMode: 'api' | 'memory';
  /** File the proposal belongs to; defaults to the live active tab. */
  filePath?: string | null;
  writeBuffer: (filePath: string, patchedXml: string) => AiBufferWriteResult;
  setSourceReplacementXml: (xml: string | null) => void;
  checkoutFile: (path: string) => Promise<unknown>;
  announce: (message: string) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  closeDiff: () => void;
  onStrictAiApplied?: () => void;
}

/** File the patch belongs to: the live active tab, else the intent's file, else the caller's. */
function resolveApplyFilePath(fallbackPath?: string | null): string | null {
  const editor = useEditorStore.getState();
  const intentPath = useAiStore.getState().pendingIntent?.projectPath ?? null;
  for (const candidate of [editor.activeTabPath, intentPath, fallbackPath]) {
    if (!candidate) continue;
    const hasBuffer =
      editor.openTabs.some((tab) => tab.path === candidate) ||
      Boolean(editor.mapBuffers[candidate]);
    if (hasBuffer) return candidate;
  }
  return editor.activeTabPath ?? intentPath ?? fallbackPath ?? null;
}

/**
 * Apply an AI proposal end to end: live lock resolution, optional auto check-out, one undoable
 * buffer transaction, then persist into the personal Draft Overlay.
 *
 * Exported (rather than buried in the hook) so the state machine — check-out ordering, save
 * failure degradation, cross-file targeting — is testable without a DOM.
 */
export async function applyAiProposal(deps: ApplyAiProposalDeps): Promise<AiApplyOutcome> {
  const filePath = resolveApplyFilePath(deps.filePath);
  if (!filePath) return null;

  // Resolve the lock state at click time: a cross-file jump (Problems panel → unopened topic) must
  // not reuse the apply mode computed for the previously active tab.
  const git = useGitStore.getState();
  const currentApplyMode = resolveAiApplyMode({
    role: git.currentUser?.role,
    userId: git.currentUser?.id,
    filePath,
    locks: git.locks,
    workspaceMode: deps.workspaceMode,
  });
  if (currentApplyMode === 'preview-only') {
    deps.announce(deps.t('app.aiPreviewOnly'));
    return null;
  }

  const ai = useAiStore.getState();
  const proposal = ai.proposal;
  const currentXml =
    useEditorStore.getState().openTabs.find((tab) => tab.path === filePath)?.xml ??
    useEditorStore.getState().mapBuffers[filePath]?.xml;
  if (currentXml !== undefined && isSameXmlBuffer(deps.patchedXml, currentXml)) {
    deps.announce(deps.t('app.aiNoChanges'));
    deps.closeDiff();
    return null;
  }
  if (proposal && currentXml !== undefined && isAiProposalStale(proposal, currentXml)) {
    deps.announce(deps.t('app.aiStaleProposal'));
    ai.dismissProposal();
    deps.closeDiff();
    return null;
  }
  if (proposal && !hasAiProposalChanges(proposal)) {
    deps.announce(deps.t('app.aiNoChanges'));
    deps.closeDiff();
    return null;
  }

  ai.setApplyOutcome({ status: 'applying', checkedOutAutomatically: false, filePath });

  let checkedOutAutomatically = false;
  if (currentApplyMode === 'checkout-and-apply' && deps.workspaceMode === 'api') {
    const lock = await deps.checkoutFile(filePath);
    if (!lock) {
      // Somebody else won the race: leave the buffer untouched so no unsaved ghost edit appears.
      useAiStore.getState().setApplyOutcome(null);
      deps.announce(deps.t('app.aiCheckoutFailed'));
      return null;
    }
    checkedOutAutomatically = true;
  }

  const write = deps.writeBuffer(filePath, deps.patchedXml);
  useEditorStore
    .getState()
    .applyAiPatchedXml(filePath, deps.patchedXml, { skipVisualReload: write.visualApplied });
  if (!write.visualApplied && write.syncSource) {
    deps.setSourceReplacementXml(deps.patchedXml);
  }
  if (useAiStore.getState().pendingIntent?.subAction === 'fix_strict') {
    deps.onStrictAiApplied?.();
  }

  if (deps.workspaceMode === 'memory') {
    const outcome: AiApplyOutcome = {
      status: 'saved-draft',
      checkedOutAutomatically: false,
      filePath,
    };
    useAiStore.getState().setApplyOutcome(outcome);
    useAiStore.getState().markApplied();
    deps.closeDiff();
    deps.announce(deps.t('app.aiApplied'));
    return outcome;
  }

  const saved = await useEditorStore.getState().saveFile(filePath);
  // `saveFile` refreshes tree/semantics/diagnostics; the lock list and draft list need their own
  // round-trip so the "checked out by me / my drafts" UI turns over immediately.
  await useGitStore.getState().refreshAll().catch(() => undefined);

  if (saved) {
    const outcome: AiApplyOutcome = {
      status: 'saved-draft',
      checkedOutAutomatically,
      filePath,
    };
    useAiStore.getState().setApplyOutcome(outcome);
    useAiStore.getState().markApplied();
    deps.closeDiff();
    deps.announce(
      deps.t(checkedOutAutomatically ? 'app.aiAppliedCheckedOutDraft' : 'app.aiAppliedSavedDraft'),
    );
    return outcome;
  }

  const editorAfterSave = useEditorStore.getState();
  const saveError =
    editorAfterSave.lastSaveFailures?.find((item) => item.path === filePath)?.message ??
    editorAfterSave.statusMessage ??
    '';
  const outcome: AiApplyOutcome = {
    status: 'applied-unsaved',
    checkedOutAutomatically,
    filePath,
    saveError,
  };
  useAiStore.getState().setApplyOutcome(outcome);
  useAiStore.getState().markApplied();
  deps.closeDiff();
  deps.announce(deps.t('app.aiAppliedSaveFailed', { message: saveError }));
  return outcome;
}

/**
 * AI assistance entry points (panel opening, target resolution, "fix this" flows and
 * proposal application). Kept out of `App.tsx` so the workbench shell stays a layout file.
 */
export function useAiPanelActions(deps: UseAiPanelActionsDeps): AiPanelActions {
  const {
    activeTab,
    visualRef,
    sourceCursorOffsetRef,
    aiApplyMode,
    workspaceMode,
    checkoutFile,
    openFileTab,
    announce,
    t,
    setInspectorOpen,
    setInspectorTarget,
    setInspectorTab,
    setAiTarget,
    setStrictOpen,
    setStrictAiApplied,
    setAiDiffOpen,
    setSourceReplacementXml,
  } = deps;

  /** Current visual selection or source caret, expressed as a contract AiTargetSpec. */
  const computeAiTarget = useCallback((): AiTargetSpec => {
    if (!activeTab) return { mode: 'full-document' };
    const visualMode =
      activeTab.kind === 'topic' && (activeTab.mode === 'visual' || activeTab.mode === 'split');
    if (visualMode) {
      const state = visualRef.current?.getCurrentPmState();
      if (state) {
        const { from, to } = state.selection;
        const selectedText = to > from ? state.doc.textBetween(from, to, '\n') : '';
        return buildVisualAiTarget(state.doc, from, to, selectedText || undefined);
      }
    }
    if (activeTab.mode === 'source' || activeTab.mode === 'split') {
      return buildSourceAiTarget(activeTab.xml, sourceCursorOffsetRef.current);
    }
    return { mode: 'full-document' };
  }, [activeTab, visualRef, sourceCursorOffsetRef]);

  const openAiPanel = useCallback(
    (intent?: AiPanelIntent) => {
      setInspectorOpen(true);
      setInspectorTarget('topic');
      setInspectorTab('ai');
      const target = intent?.target ?? computeAiTarget();
      setAiTarget(target);
      const store = useAiStore.getState();
      if (intent) {
        store.openPanel(intent);
        return;
      }
      // Opening the tab by hand must not inherit a stale entry-point fragment: the panel then
      // defaults to whole-topic scope.
      store.setIntent(null);
      store.openPanel();
    },
    [computeAiTarget, setInspectorOpen, setInspectorTarget, setInspectorTab, setAiTarget],
  );

  // Opening the AI tab by hand still needs a live target (selection or source caret).
  const handleInspectorTabChange = useCallback(
    (next: InspectorTab) => {
      setInspectorTab(next);
      if (next !== 'ai') return;
      const store = useAiStore.getState();
      if (!store.panelOpen) openAiPanel();
    },
    [openAiPanel, setInspectorTab],
  );

  // Switching files or modes invalidates a stale target prepared by an entry point.
  const aiActivePathRef = useRef<string | null>(null);
  useEffect(() => {
    const nextPath = activeTab?.path ?? null;
    if (aiActivePathRef.current === nextPath) return;
    aiActivePathRef.current = nextPath;
    useAiStore.getState().setIntent(null);
    setAiTarget(null);
  }, [activeTab?.path, setAiTarget]);
  const aiModeRef = useRef(activeTab?.mode ?? 'visual');
  useEffect(() => {
    const nextMode = activeTab?.mode ?? 'visual';
    if (aiModeRef.current === nextMode) return;
    aiModeRef.current = nextMode;
    useAiStore.getState().setIntent(null);
  }, [activeTab?.mode]);

  const handleVisualAiRequest = useCallback(
    (kind: 'rewrite' | 'ask') => {
      const target = computeAiTarget();
      openAiPanel({
        taskType: kind === 'rewrite' ? 'authoring' : 'ask',
        target,
        ...(kind === 'rewrite'
          ? {
              instruction: t('app.ai.rewriteInstruction'),
              autoSend: true,
            }
          : {}),
        ...(activeTab ? { projectPath: activeTab.path } : {}),
      });
    },
    [activeTab, computeAiTarget, openAiPanel, t],
  );

  const handleAiFixXmlError = useCallback(() => {
    if (!activeTab?.xmlError) return;
    const error = activeTab.xmlError;
    openAiPanel({
      taskType: 'fix_error',
      subAction: 'fix_xml',
      target: buildDiagnosticFixTarget(activeTab.xml, error.line, error.column, error.line, {
        source: 'xml',
      }),
      diagnostics: [
        {
          source: 'xml',
          message: error.message,
          line: error.line,
          column: error.column,
        },
      ],
      autoSend: true,
      projectPath: activeTab.path,
    });
  }, [activeTab, openAiPanel]);

  const handleAiFixDiagnostic = useCallback(
    async (diagnostic: ProblemDiagnostic) => {
      const store = useEditorStore.getState();
      const targetTab = store.openTabs.find((tab) => tab.path === diagnostic.filePath);
      if (!targetTab || store.activeTabPath !== diagnostic.filePath) {
        await openFileTab(diagnostic.filePath, { mode: 'source', jumpLine: diagnostic.line });
      }
      const targetXml =
        useEditorStore.getState().openTabs.find((tab) => tab.path === diagnostic.filePath)?.xml ??
        targetTab?.xml ??
        '';
      const fromDitaOt = diagnostic.source === 'dita-ot';
      if (fromDitaOt) setStrictAiApplied(false);
      const code = fromDitaOt ? diagnostic.code : undefined;
      // DITA-OT messages sometimes drop the [DOTJ013E] prefix; keep the code visible to the model.
      const message =
        code && !diagnostic.message.includes(code)
          ? `[${code}] ${diagnostic.message}`
          : diagnostic.message;
      openAiPanel({
        taskType: 'fix_error',
        subAction: fromDitaOt ? 'fix_strict' : 'fix_diagnostic',
        target: buildDiagnosticFixTarget(
          targetXml,
          diagnostic.line,
          diagnostic.column,
          diagnostic.line,
          { source: diagnostic.source },
        ),
        diagnostics: [
          {
            source: diagnostic.source,
            message,
            line: diagnostic.line,
            column: diagnostic.column,
          },
        ],
        autoSend: true,
        projectPath: diagnostic.filePath,
      });
    },
    [openAiPanel, openFileTab, setStrictAiApplied],
  );

  const handleAiFixStrictDiagnostic = useCallback(
    async (diagnostic: PublishDiagnostic) => {
      setStrictOpen(false);
      setStrictAiApplied(false);
      await openFileTab(diagnostic.filePath, { mode: 'source', jumpLine: diagnostic.line });
      const targetXml =
        useEditorStore.getState().openTabs.find((tab) => tab.path === diagnostic.filePath)?.xml ?? '';
      const message =
        diagnostic.code && !diagnostic.message.includes(diagnostic.code)
          ? `[${diagnostic.code}] ${diagnostic.message}`
          : diagnostic.message;
      openAiPanel({
        taskType: 'fix_error',
        subAction: 'fix_strict',
        target: buildDiagnosticFixTarget(
          targetXml,
          diagnostic.line,
          diagnostic.column,
          diagnostic.line,
          { source: 'dita-ot' },
        ),
        diagnostics: [
          {
            source: 'dita-ot',
            message,
            line: diagnostic.line,
            column: diagnostic.column,
          },
        ],
        autoSend: true,
        projectPath: diagnostic.filePath,
      });
    },
    [openAiPanel, openFileTab, setStrictOpen, setStrictAiApplied],
  );

  const handleApplyAiProposal = useCallback(
    async (patchedXml: string) => {
      await applyAiProposal({
        patchedXml,
        workspaceMode,
        filePath: activeTab?.path ?? null,
        writeBuffer: (filePath, xml) => {
          const tab = useEditorStore.getState().openTabs.find((item) => item.path === filePath);
          const visualApplied =
            tab !== undefined &&
            tab.kind === 'topic' &&
            (tab.mode === 'visual' || tab.mode === 'split') &&
            (visualRef.current?.replaceDocumentXml(xml) ?? false);
          return {
            visualApplied,
            syncSource: tab !== undefined && (tab.mode === 'source' || tab.mode === 'split'),
          };
        },
        setSourceReplacementXml,
        checkoutFile,
        announce,
        t,
        closeDiff: () => setAiDiffOpen(false),
        onStrictAiApplied: () => setStrictAiApplied(true),
      });
    },
    [
      activeTab?.path,
      aiApplyMode,
      workspaceMode,
      checkoutFile,
      announce,
      t,
      visualRef,
      setSourceReplacementXml,
      setStrictAiApplied,
      setAiDiffOpen,
    ],
  );

  const handleSourceReplacementApplied = useCallback(() => {
    setSourceReplacementXml(null);
  }, [setSourceReplacementXml]);

  return {
    computeAiTarget,
    openAiPanel,
    handleInspectorTabChange,
    handleVisualAiRequest,
    handleAiFixXmlError,
    handleAiFixDiagnostic,
    handleAiFixStrictDiagnostic,
    handleApplyAiProposal,
    handleSourceReplacementApplied,
  };
}
