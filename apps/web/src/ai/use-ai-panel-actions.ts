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
import { useAiStore, type AiPanelIntent } from './ai-store';
import type { InspectorTab } from '../components/TopicInspector';
import type { VisualEditorHandle } from '../editor/visual/VisualEditor';
import { useEditorStore } from '../store/editor-store';
import type {
  AiApplyMode,
  EditorViewMode,
  InspectorTarget,
  OpenEditorTab,
} from '../store/editor-store';
import type { MessageKey, MessageParams } from '../i18n/index.js';
import type { PublishDiagnostic } from '../services/publish-api';
import type { WorkspaceDiagnostic } from '../services/workspace-api';

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
  handleAiFixDiagnostic: (diagnostic: WorkspaceDiagnostic) => Promise<void>;
  handleAiFixStrictDiagnostic: (diagnostic: PublishDiagnostic) => Promise<void>;
  handleApplyAiProposal: (patchedXml: string) => Promise<void>;
  handleSourceReplacementApplied: () => void;
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
      target: buildDiagnosticFixTarget(activeTab.xml, error.line, error.column, error.line),
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
    async (diagnostic: WorkspaceDiagnostic) => {
      const store = useEditorStore.getState();
      const targetTab = store.openTabs.find((tab) => tab.path === diagnostic.filePath);
      if (!targetTab || store.activeTabPath !== diagnostic.filePath) {
        await openFileTab(diagnostic.filePath, { mode: 'source', jumpLine: diagnostic.line });
      }
      const targetXml =
        useEditorStore.getState().openTabs.find((tab) => tab.path === diagnostic.filePath)?.xml ??
        targetTab?.xml ??
        '';
      openAiPanel({
        taskType: 'fix_error',
        subAction: 'fix_diagnostic',
        target: buildDiagnosticFixTarget(
          targetXml,
          diagnostic.line,
          diagnostic.column,
          diagnostic.line,
        ),
        diagnostics: [
          {
            source: diagnostic.source,
            message: diagnostic.message,
            line: diagnostic.line,
            column: diagnostic.column,
          },
        ],
        autoSend: true,
        projectPath: diagnostic.filePath,
      });
    },
    [openAiPanel, openFileTab],
  );

  const handleAiFixStrictDiagnostic = useCallback(
    async (diagnostic: PublishDiagnostic) => {
      setStrictOpen(false);
      setStrictAiApplied(false);
      await openFileTab(diagnostic.filePath, { mode: 'source', jumpLine: diagnostic.line });
      const targetXml =
        useEditorStore.getState().openTabs.find((tab) => tab.path === diagnostic.filePath)?.xml ?? '';
      openAiPanel({
        taskType: 'fix_error',
        subAction: 'fix_strict',
        target: buildDiagnosticFixTarget(
          targetXml,
          diagnostic.line,
          diagnostic.column,
          diagnostic.line,
        ),
        diagnostics: [
          {
            source: 'xml',
            message: diagnostic.message,
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
      if (!activeTab) return;
      const filePath = activeTab.path;
      if (aiApplyMode === 'preview-only') {
        announce(t('app.aiPreviewOnly'));
        return;
      }

      // Guard both ends of the "it says applied but nothing changed" trap: a patch identical to the
      // buffer is a no-op, and a patch generated from a different buffer would revert later edits.
      const proposal = useAiStore.getState().proposal;
      const currentXml = useEditorStore
        .getState()
        .openTabs.find((tab) => tab.path === filePath)?.xml;
      if (currentXml !== undefined && isSameXmlBuffer(patchedXml, currentXml)) {
        announce(t('app.aiNoChanges'));
        setAiDiffOpen(false);
        return;
      }
      if (proposal && currentXml !== undefined && isAiProposalStale(proposal, currentXml)) {
        announce(t('app.aiStaleProposal'));
        useAiStore.getState().dismissProposal();
        setAiDiffOpen(false);
        return;
      }
      if (proposal && !hasAiProposalChanges(proposal)) {
        announce(t('app.aiNoChanges'));
        setAiDiffOpen(false);
        return;
      }

      if (aiApplyMode === 'checkout-and-apply' && workspaceMode === 'api') {
        const lock = await checkoutFile(filePath);
        if (!lock) {
          announce(t('app.aiCheckoutFailed'));
          return;
        }
      }

      const visualApply =
        activeTab.kind === 'topic' &&
        (activeTab.mode === 'visual' || activeTab.mode === 'split') &&
        (visualRef.current?.replaceDocumentXml(patchedXml) ?? false);
      useEditorStore
        .getState()
        .applyAiPatchedXml(filePath, patchedXml, { skipVisualReload: visualApply });
      if (!visualApply && (activeTab.mode === 'source' || activeTab.mode === 'split')) {
        setSourceReplacementXml(patchedXml);
      }
      if (useAiStore.getState().pendingIntent?.subAction === 'fix_strict') {
        setStrictAiApplied(true);
      }
      useAiStore.getState().markApplied();
      setAiDiffOpen(false);
      announce(t('app.aiApplied'));
    },
    [
      activeTab,
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
