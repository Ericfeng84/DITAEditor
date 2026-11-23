import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  dirnamePosix,
  type DitaTopicTemplateType,
  type RawAttrs,
  type XmlDeclaration,
  type XmlPrologItem,
} from '@dita/core';
import { FilePlus2, FolderOpen, Network, PanelRightClose, Sparkles } from 'lucide-react';
import { CheckinDialog, type CheckinCandidate } from './components/CheckinDialog';
import { DiffDialog } from './components/DiffDialog';
import { EditorTabBar } from './components/EditorTabBar';
import { FileExplorerPanel } from './components/FileExplorerPanel';
import { GitPanel } from './components/GitPanel';
import { InsertKeyrefDialog } from './components/InsertKeyrefDialog';
import { KeyspacePanel } from './components/KeyspacePanel';
import { LeftSidebar } from './components/LeftSidebar';
import { LockStatusBar } from './components/LockStatusBar';
import { NewMapDialog } from './components/NewMapDialog';
import { NewTopicDialog, type NewTopicMountContext } from './components/NewTopicDialog';
import { ProblemsPanel } from './components/ProblemsPanel';
import { PublishDialog } from './components/publish/PublishDialog';
import { StrictValidationDialog } from './components/publish/StrictValidationDialog';
import { TopicAuthoringGuide } from './components/TopicAuthoringGuide';
import { TopicInspector, type InspectorTab } from './components/TopicInspector';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { WorkspaceDialog } from './components/WorkspaceDialog';
import { XrefImageDialog } from './components/XrefImageDialog';
import { AiAssistantPanel } from './ai/AiAssistantPanel';
import { AiDiffDialog } from './ai/AiDiffDialog';
import { AiSettingsDialog } from './ai/AiSettingsDialog';
import { applyDocumentLocale, useI18n } from './i18n/index.js';
import { buildSourceAiTarget, buildVisualAiTarget } from './ai/ai-target';
import { useAiStore, type AiPanelIntent } from './ai/ai-store';
import type { AiTargetSpec } from './ai/ai-types';
import { syncSourceToVisual, syncVisualToSource } from './editor/bridge/xml-bridge';
import { SourceEditor } from './editor/source/SourceEditor';
import { AttributesPanel } from './editor/visual/AttributesPanel';
import { BreadcrumbBar } from './editor/visual/BreadcrumbBar';
import { EditorToolbar } from './editor/visual/EditorToolbar';
import type { BreadcrumbItem, EditorSelectionSnapshot } from './editor/visual/selection-info';
import { VisualEditor, type VisualEditorHandle } from './editor/visual/VisualEditor';
import { MapNodeInspector } from './map-tree/MapNodeInspector';
import { MapOverviewPane } from './map-tree/MapOverviewPane';
import { MapTreePanel } from './map-tree/MapTreePanel';
import {
  collectWorkspaceDirectoryPaths,
  collectWorkspaceFilesByKind,
} from './map-tree/map-tree-utils';
import { MountExistingDialog } from './map-tree/MountExistingDialog';
import { resolveFileEditability } from './services/lock-helpers';
import type { PublishDiagnostic, StrictValidationInput } from './services/publish-api';
import {
  resolveWorkspaceAssetUrl,
  uploadWorkspaceImage,
  type WorkspaceDiagnostic,
} from './services/workspace-api';
import {
  getTabDiffStats,
  resolveAiApplyMode,
  selectActiveTab,
  useEditorStore,
  type EditorViewMode,
} from './store/editor-store';
import { useGitStore } from './store/git-store';

export function App() {
  const { t, locale } = useI18n();
  const workspaceMode = useEditorStore((s) => s.workspaceMode);
  const workspaceRootDir = useEditorStore((s) => s.workspaceRootDir);
  const workspaceDefaultRootDir = useEditorStore((s) => s.workspaceDefaultRootDir);
  const workspaceImportsRootDir = useEditorStore((s) => s.workspaceImportsRootDir);
  const workspaceName = useEditorStore((s) => s.workspaceName);
  const recentWorkspaces = useEditorStore((s) => s.recentWorkspaces);
  const loadingWorkspaces = useEditorStore((s) => s.loadingWorkspaces);
  const fileTree = useEditorStore((s) => s.fileTree);
  const fileSet = useEditorStore((s) => s.fileSet);
  const workspaceMaps = useEditorStore((s) => s.workspaceMaps);
  const workspaceDitavals = useEditorStore((s) => s.workspaceDitavals);
  const topicTitles = useEditorStore((s) => s.topicTitles);
  const activeRootMapPath = useEditorStore((s) => s.activeRootMapPath);
  const activeDitavalPath = useEditorStore((s) => s.activeDitavalPath);
  const activeDitaval = useEditorStore((s) => s.activeDitaval);
  const ditavalDisplayMode = useEditorStore((s) => s.ditavalDisplayMode);
  const keyspace = useEditorStore((s) => s.keyspace);
  const topicIndices = useEditorStore((s) => s.topicIndices);
  const profilingCatalog = useEditorStore((s) => s.profilingCatalog);
  const documentOverlays = useEditorStore((s) => s.documentOverlays);
  const memoryAssets = useEditorStore((s) => s.memoryAssets);
  const mapBuffers = useEditorStore((s) => s.mapBuffers);
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const savingPaths = useEditorStore((s) => s.savingPaths);

  const openTabs = useEditorStore((s) => s.openTabs);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);

  const leftSidebarOpen = useEditorStore((s) => s.leftSidebarOpen);
  const leftSidebarTab = useEditorStore((s) => s.leftSidebarTab);
  const inspectorOpen = useEditorStore((s) => s.inspectorOpen);
  const inspectorTarget = useEditorStore((s) => s.inspectorTarget);
  const selectedMapNode = useEditorStore((s) => s.selectedMapNode);
  const problemsOpen = useEditorStore((s) => s.problemsOpen);
  const tagDisplayMode = useEditorStore((s) => s.tagDisplayMode);
  const statusMessage = useEditorStore((s) => s.statusMessage);
  const pendingSourceOffset = useEditorStore((s) => s.pendingSourceOffset);
  const pendingVisualPmPos = useEditorStore((s) => s.pendingVisualPmPos);

  const initWorkspace = useEditorStore((s) => s.initWorkspace);
  const openLocalWorkspace = useEditorStore((s) => s.openLocalWorkspace);
  const importFolderWorkspace = useEditorStore((s) => s.importFolderWorkspace);
  const createBlankWorkspace = useEditorStore((s) => s.createBlankWorkspace);
  const forgetRecentWorkspace = useEditorStore((s) => s.forgetRecentWorkspace);
  const refreshRecentWorkspaces = useEditorStore((s) => s.refreshRecentWorkspaces);
  const restoreOfflineDemo = useEditorStore((s) => s.restoreOfflineDemo);
  const selectRootMap = useEditorStore((s) => s.selectRootMap);
  const selectDitaval = useEditorStore((s) => s.selectDitaval);
  const setDitavalDisplayMode = useEditorStore((s) => s.setDitavalDisplayMode);
  const refreshDiagnostics = useEditorStore((s) => s.refreshDiagnostics);
  const jumpToSemanticLocation = useEditorStore((s) => s.jumpToSemanticLocation);
  const resolveConrefPreview = useEditorStore((s) => s.resolveConrefPreview);
  const openFileTab = useEditorStore((s) => s.openFileTab);
  const activateTab = useEditorStore((s) => s.activateTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const closeOtherTabs = useEditorStore((s) => s.closeOtherTabs);
  const closeSavedTabs = useEditorStore((s) => s.closeSavedTabs);
  const saveActiveFile = useEditorStore((s) => s.saveActiveFile);
  const saveAllDirtyFiles = useEditorStore((s) => s.saveAllDirtyFiles);
  const resetCurrentToBaseline = useEditorStore((s) => s.resetCurrentToBaseline);
  const setMode = useEditorStore((s) => s.setMode);
  const updateXmlFromVisual = useEditorStore((s) => s.updateXmlFromVisual);
  const updateXmlFromSource = useEditorStore((s) => s.updateXmlFromSource);
  const setTagDisplayMode = useEditorStore((s) => s.setTagDisplayMode);

  const selectMapNode = useEditorStore((s) => s.selectMapNode);
  const moveMapTreeNodes = useEditorStore((s) => s.moveMapTreeNodes);
  const createTopicAndMountInMap = useEditorStore((s) => s.createTopicAndMountInMap);
  const mountExistingFileInMap = useEditorStore((s) => s.mountExistingFileInMap);
  const insertMapStructureNode = useEditorStore((s) => s.insertMapStructureNode);
  const updateMapAttr = useEditorStore((s) => s.updateMapAttr);
  const updateMapNavtitle = useEditorStore((s) => s.updateMapNavtitle);
  const updateMapRootTitle = useEditorStore((s) => s.updateMapRootTitle);
  const deleteMapTreeNode = useEditorStore((s) => s.deleteMapTreeNode);
  const jumpToMapNodeSource = useEditorStore((s) => s.jumpToMapNodeSource);
  const undoMap = useEditorStore((s) => s.undoMap);
  const redoMap = useEditorStore((s) => s.redoMap);

  const createStandaloneTopic = useEditorStore((s) => s.createStandaloneTopic);
  const createNewMapFile = useEditorStore((s) => s.createNewMapFile);
  const createWorkspaceFolder = useEditorStore((s) => s.createWorkspaceFolder);
  const renameWorkspaceFile = useEditorStore((s) => s.renameWorkspaceFile);
  const deleteWorkspaceFile = useEditorStore((s) => s.deleteWorkspaceFile);

  const setLeftSidebarOpen = useEditorStore((s) => s.setLeftSidebarOpen);
  const setLeftSidebarTab = useEditorStore((s) => s.setLeftSidebarTab);
  const setInspectorOpen = useEditorStore((s) => s.setInspectorOpen);
  const setInspectorTarget = useEditorStore((s) => s.setInspectorTarget);
  const setProblemsOpen = useEditorStore((s) => s.setProblemsOpen);
  const announce = useEditorStore((s) => s.announce);
  useEffect(() => {
    applyDocumentLocale(locale);
    document.title = t('app.title');
  }, [locale, t]);

  // A locale switch is lossless: no reload, no editor remount. Only the server-authored text
  // (semantic diagnostics, identity role wording) is re-fetched so nothing stays mixed-language.
  const localeForRefresh = useRef(locale);
  useEffect(() => {
    if (localeForRefresh.current === locale) return;
    localeForRefresh.current = locale;
    void refreshDiagnostics();
    void useGitStore.getState().refreshIdentity();
  }, [locale, refreshDiagnostics]);
  const clearPendingSourceOffset = useEditorStore((s) => s.clearPendingSourceOffset);
  const clearPendingVisualPmPos = useEditorStore((s) => s.clearPendingVisualPmPos);
  const requestSourceJump = useEditorStore((s) => s.requestSourceJump);
  const requestVisualJump = useEditorStore((s) => s.requestVisualJump);

  const identity = useGitStore((s) => s.identity);
  const currentUser = useGitStore((s) => s.currentUser);
  const locks = useGitStore((s) => s.locks);
  const gitStatus = useGitStore((s) => s.status);
  const gitLoading = useGitStore((s) => s.loading);
  const gitDiff = useGitStore((s) => s.diff);
  const gitDiffLoading = useGitStore((s) => s.diffLoading);
  const initializeGit = useGitStore((s) => s.initialize);
  const loadGitHistory = useGitStore((s) => s.loadHistory);
  const switchUser = useGitStore((s) => s.switchUser);
  const refreshAllGit = useGitStore((s) => s.refreshAll);
  const checkoutFile = useGitStore((s) => s.checkout);
  const releaseFileLock = useGitStore((s) => s.release);
  const cancelFileCheckout = useGitStore((s) => s.cancel);
  const forceUnlockFile = useGitStore((s) => s.forceUnlock);
  const checkinFiles = useGitStore((s) => s.checkin);
  const refreshLocksGit = useGitStore((s) => s.refreshLocks);
  const loadGitDiff = useGitStore((s) => s.loadDiff);
  const clearGitDiff = useGitStore((s) => s.clearDiff);

  // Initialize workspace on mount
  useEffect(() => {
    void initWorkspace();
  }, [initWorkspace]);

  useEffect(() => {
    if (import.meta.env.VITE_STATIC_DEMO === 'true') return;
    void initializeGit();
  }, [initializeGit]);

  // A different workspace root or branch worktree means entirely new Git state.
  useEffect(() => {
    if (!currentUser || workspaceMode !== 'api' || !workspaceRootDir) return;
    void refreshAllGit();
  }, [workspaceRootDir, workspaceMode, currentUser?.id, refreshAllGit]);

  // Newly created files are auto-locked by the API; refresh when the active file changes.
  useEffect(() => {
    if (workspaceMode !== 'api' || !activeTabPath) return;
    void refreshLocksGit();
  }, [activeTabPath, workspaceMode, refreshLocksGit]);

  // A save is the only moment disk changes, so refresh Git status right after it finishes.
  const wasSavingRef = useRef(false);
  useEffect(() => {
    if (savingPaths.length > 0) {
      wasSavingRef.current = true;
      return;
    }
    if (!wasSavingRef.current) return;
    wasSavingRef.current = false;
    if (workspaceMode === 'api') void refreshAllGit();
  }, [savingPaths.length, workspaceMode, refreshAllGit]);

  // Global Cmd/Ctrl+S shortcut to persist changes cleanly
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault();
        void saveActiveFile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveActiveFile]);

  // Global Cmd/Ctrl+\ shortcut to collapse / expand the 项目 · Map navigation column
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === '\\') {
        ev.preventDefault();
        setLeftSidebarOpen(!leftSidebarOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leftSidebarOpen, setLeftSidebarOpen]);

  const activeTab = useMemo(
    () => selectActiveTab({ openTabs, activeTabPath }),
    [openTabs, activeTabPath],
  );
  const diffStats = useMemo(() => getTabDiffStats(activeTab), [activeTab]);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinPaths, setCheckinPaths] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [strictOpen, setStrictOpen] = useState(false);
  const [strictInput, setStrictInput] = useState<StrictValidationInput | null>(null);
  const [strictLabel, setStrictLabel] = useState('');
  const [strictAiApplied, setStrictAiApplied] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiDiffOpen, setAiDiffOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<AiTargetSpec | null>(null);
  const [sourceReplacementXml, setSourceReplacementXml] = useState<string | null>(null);

  const openStrictValidation = useCallback((input: StrictValidationInput, label: string) => {
    setStrictInput(input);
    setStrictLabel(label);
    setStrictAiApplied(false);
    setStrictOpen(true);
  }, []);

  const activeLock = useMemo(
    () => locks.find((lock) => lock.filePath === activeTabPath) ?? null,
    [locks, activeTabPath],
  );
  const editability = useMemo(
    () =>
      resolveFileEditability({
        role: currentUser?.role,
        userId: currentUser?.id,
        filePath: activeTabPath,
        locks,
      }),
    // `resolveFileEditability` renders its reason in the current UI language, so a locale
    // switch must recompute it — otherwise the admin banner keeps the old language.
    [currentUser?.role, currentUser?.id, activeTabPath, locks, locale],
  );
  const canEdit = workspaceMode === 'memory' ? true : editability.editable;
  const aiApplyMode = useMemo(
    () =>
      resolveAiApplyMode({
        role: currentUser?.role,
        userId: currentUser?.id,
        filePath: activeTabPath,
        locks,
        workspaceMode,
      }),
    [currentUser?.role, currentUser?.id, activeTabPath, locks, workspaceMode],
  );
  const aiConfig = useAiStore((state) => state.config);
  const aiProposal = useAiStore((state) => state.proposal);
  const loadAiConfig = useAiStore((state) => state.loadConfig);
  const aiConfigured = aiConfig?.configured ?? false;
  const aiPanelOpen = useAiStore((state) => state.panelOpen);
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (import.meta.env.VITE_STATIC_DEMO === 'true') return;
    void loadAiConfig();
  }, [loadAiConfig, currentUserId]);
  const dirtyPathSet = useMemo(
    () => new Set((gitStatus?.dirtyFiles ?? []).map((file) => file.path)),
    [gitStatus],
  );
  const activeLockDirty = Boolean(activeTabPath && dirtyPathSet.has(activeTabPath));
  const checkinCandidates = useMemo<CheckinCandidate[]>(() => {
    const paths =
      checkinPaths.length > 0
        ? checkinPaths
        : locks
            .filter((lock) => lock.userId === currentUser?.id && dirtyPathSet.has(lock.filePath))
            .map((lock) => lock.filePath);
    return paths
      .map((path) => {
        const lock = locks.find((item) => item.filePath === path);
        return lock ? { path, lock } : null;
      })
      .filter((item): item is CheckinCandidate => item !== null);
  }, [checkinPaths, locks, currentUser?.id, dirtyPathSet]);

  const openGitDiff = useCallback(
    async (options: { path: string; from?: string; to?: string }) => {
      setDiffDialogOpen(true);
      await loadGitDiff(options);
    },
    [loadGitDiff],
  );

  const closeGitDiff = useCallback(() => {
    setDiffDialogOpen(false);
    clearGitDiff();
  }, [clearGitDiff]);

  const openCheckin = useCallback((paths: string[]) => {
    setCheckinPaths(paths);
    setCheckinOpen(true);
  }, []);

  const dirtyCount = useMemo(() => {
    const dirty = new Set<string>();
    for (const t of openTabs) {
      if (t.xml !== t.baselineXml) dirty.add(t.path);
    }
    for (const [p, buf] of Object.entries(mapBuffers)) {
      if (buf.xml !== buf.baselineXml) dirty.add(p);
    }
    return dirty.size;
  }, [openTabs, mapBuffers]);

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'error').length,
    [diagnostics],
  );
  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === 'warning').length,
    [diagnostics],
  );

  const workspaceDirectories = useMemo(
    () => collectWorkspaceDirectoryPaths(fileTree),
    [fileTree],
  );
  const workspaceTopics = useMemo(
    () => collectWorkspaceFilesByKind(fileTree, new Set(['topic'])),
    [fileTree],
  );
  const workspaceImages = useMemo(
    () => collectWorkspaceFilesByKind(fileTree, new Set(['image'])),
    [fileTree],
  );
  const workspaceMountables = useMemo(
    () => collectWorkspaceFilesByKind(fileTree, new Set(['topic', 'ditamap', 'bookmap'])),
    [fileTree],
  );

  const visualRef = useRef<VisualEditorHandle | null>(null);
  const sourceCursorOffsetRef = useRef<number>(0);

  const [snapshot, setSnapshot] = useState<EditorSelectionSnapshot | null>(null);
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });
  const [docMeta, setDocMeta] = useState<{
    xmlDeclaration: XmlDeclaration | null;
    prolog: XmlPrologItem[];
    epilog: XmlPrologItem[];
  } | null>(null);

  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [topicMountContext, setTopicMountContext] = useState<{
    mount: NewTopicMountContext;
    parentPath: number[] | null;
  } | null>(null);
  const [newMapOpen, setNewMapOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [mountExistingTarget, setMountExistingTarget] = useState<{
    mapPath: string;
    parentPath: number[] | null;
    parentLabel: string;
    isBookmap: boolean;
  } | null>(null);
  const [refDialogMode, setRefDialogMode] = useState<'xref' | 'image' | null>(null);
  const [keyrefDialogOpen, setKeyrefDialogOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('attributes');

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
  }, [activeTab]);

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
    [computeAiTarget, setInspectorOpen, setInspectorTarget],
  );

  // Opening the AI tab by hand still needs a live target (selection or source caret).
  const handleInspectorTabChange = useCallback(
    (next: InspectorTab) => {
      setInspectorTab(next);
      if (next !== 'ai') return;
      const store = useAiStore.getState();
      if (!store.panelOpen) openAiPanel();
    },
    [openAiPanel],
  );

  // Switching files or modes invalidates a stale target prepared by an entry point.
  const aiActivePathRef = useRef<string | null>(null);
  useEffect(() => {
    const nextPath = activeTab?.path ?? null;
    if (aiActivePathRef.current === nextPath) return;
    aiActivePathRef.current = nextPath;
    useAiStore.getState().setIntent(null);
    setAiTarget(null);
  }, [activeTab?.path]);
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
    [activeTab, computeAiTarget, openAiPanel],
  );

  const handleAiFixXmlError = useCallback(() => {
    if (!activeTab?.xmlError) return;
    const error = activeTab.xmlError;
    openAiPanel({
      taskType: 'fix_error',
      subAction: 'fix_xml',
      target: {
        mode: 'line-window',
        line: error.line,
        column: error.column,
        lineEnd: error.line,
      },
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
      const targetTab = useEditorStore
        .getState()
        .openTabs.find((tab) => tab.path === diagnostic.filePath);
      if (!targetTab || useEditorStore.getState().activeTabPath !== diagnostic.filePath) {
        await openFileTab(diagnostic.filePath, { mode: 'source', jumpLine: diagnostic.line });
      }
      openAiPanel({
        taskType: 'fix_error',
        subAction: 'fix_diagnostic',
        target: {
          mode: 'line-window',
          line: diagnostic.line,
          lineEnd: diagnostic.line,
        },
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
      openAiPanel({
        taskType: 'fix_error',
        subAction: 'fix_strict',
        target: {
          mode: 'line-window',
          line: diagnostic.line,
          column: diagnostic.column,
          lineEnd: diagnostic.line,
        },
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
    [openAiPanel, openFileTab],
  );

  const handleApplyAiProposal = useCallback(
    async (patchedXml: string) => {
      if (!activeTab) return;
      const filePath = activeTab.path;
      if (aiApplyMode === 'preview-only') {
        announce(t('app.aiPreviewOnly'));
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
    [activeTab, aiApplyMode, workspaceMode, checkoutFile, announce],
  );

  const handleSourceReplacementApplied = useCallback(() => {
    setSourceReplacementXml(null);
  }, []);

  const handleSnapshotChange = useCallback(
    (
      nextSnap: EditorSelectionSnapshot,
      nextHistory: { canUndo: boolean; canRedo: boolean },
      nextMeta: {
        xmlDeclaration: XmlDeclaration | null;
        prolog: XmlPrologItem[];
        epilog: XmlPrologItem[];
      },
    ) => {
      setSnapshot(nextSnap);
      setHistoryFlags(nextHistory);
      setDocMeta(nextMeta);
    },
    [],
  );

  const isActiveMapTab =
    activeTab?.kind === 'ditamap' || activeTab?.kind === 'bookmap';
  const mode: EditorViewMode = activeTab?.mode ?? 'visual';

  const handleChangeMode = useCallback(
    (nextMode: EditorViewMode) => {
      if (!activeTab || nextMode === activeTab.mode) return;

      if (
        !isActiveMapTab &&
        activeTab.kind === 'topic' &&
        activeTab.mode === 'visual' &&
        (nextMode === 'source' || nextMode === 'split')
      ) {
        const pmState = visualRef.current?.getCurrentPmState();
        if (pmState) {
          const synced = syncVisualToSource(pmState.doc, pmState.selection.from);
          updateXmlFromVisual(synced.xml);
          if (synced.targetOffset !== null) {
            requestSourceJump(synced.targetOffset);
          }
        }
        setMode(nextMode);
        return;
      }

      if (
        !isActiveMapTab &&
        activeTab.kind === 'topic' &&
        activeTab.mode === 'source' &&
        (nextMode === 'visual' || nextMode === 'split')
      ) {
        const res = syncSourceToVisual(activeTab.xml, sourceCursorOffsetRef.current);
        if (!res.ok) {
          setMode(nextMode);
          return;
        }
        const switched = setMode(nextMode);
        if (switched && res.targetPmPos !== null) {
          requestVisualJump(res.targetPmPos);
        }
        return;
      }

      setMode(nextMode);
    },
    [
      activeTab,
      isActiveMapTab,
      setMode,
      updateXmlFromVisual,
      requestSourceJump,
      requestVisualJump,
    ],
  );

  const handleConfirmXref = useCallback((attrs: RawAttrs, linkText: string) => {
    visualRef.current?.toggleInline('xref', attrs, linkText || undefined);
  }, []);

  const handleConfirmImage = useCallback((attrs: RawAttrs, placement: 'inline' | 'break') => {
    if (placement === 'inline') {
      visualRef.current?.toggleInline('image', attrs);
    } else {
      visualRef.current?.insertBlock('image', undefined, attrs);
    }
  }, []);

  const handleConfirmKeyref = useCallback(
    (tagName: 'keyword' | 'ph' | 'xref' | 'term', attrs: RawAttrs, fallbackText?: string) => {
      visualRef.current?.toggleInline(tagName, attrs, fallbackText || undefined);
    },
    [],
  );

  /** Right-inspector "复用" tab is the single entry point for conref / conkeyref work. */
  const openReuseTab = useCallback(() => {
    setInspectorOpen(true);
    setInspectorTarget('topic');
    setInspectorTab('reuse');
  }, [setInspectorOpen, setInspectorTarget]);

  const handleConfirmConref = useCallback(
    (opts: {
      action: 'insert-new' | 'bind-selected';
      tagName: string;
      attrName: 'conref' | 'conkeyref';
      value: string;
    }) => {
      const oppositeAttr = opts.attrName === 'conref' ? 'conkeyref' : 'conref';
      if (opts.action === 'bind-selected' && snapshot?.activeItem) {
        const targetPos = snapshot.activeItem.pos;
        visualRef.current?.updateAttr(targetPos, oppositeAttr, null);
        visualRef.current?.updateAttr(targetPos, opts.attrName, opts.value);
        announce(t('app.conrefBound', { tag: snapshot.activeItem.tagName, attr: opts.attrName, value: opts.value }));
        return;
      }

      const initialAttrs: RawAttrs = [{ name: opts.attrName, value: opts.value, namespaceURI: null }];
      const editor = visualRef.current;
      const inserted =
        editor === null
          ? false
          : editor.canInsertInline(opts.tagName)
            ? editor.toggleInline(opts.tagName, initialAttrs)
            : editor.insertBlock(opts.tagName, undefined, initialAttrs);

      if (!inserted) {
        announce(t('app.conrefCannotInsert', { tag: opts.tagName }));
        return;
      }
      announce(t('app.conrefInserted', { tag: opts.tagName, attr: opts.attrName, value: opts.value }));
    },
    [snapshot, announce],
  );

  const handleSelectBreadcrumb = useCallback((crumb: BreadcrumbItem) => {
    visualRef.current?.selectNode(crumb.pos, true);
  }, []);

  const resolveImageSrcForActiveTab = useCallback(
    (href: string) => {
      if (!activeTab) return null;
      return resolveWorkspaceAssetUrl(activeTab.path, href, workspaceMode, memoryAssets);
    },
    [activeTab, workspaceMode, memoryAssets],
  );

  const handleOpenCreateAndMount = useCallback(
    (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => {
      const isBook = parent.mapPath.toLowerCase().endsWith('.bookmap');
      const mapDir = dirnamePosix(parent.mapPath);
      setTopicMountContext({
        mount: {
          mapPath: parent.mapPath,
          parentLabel: parent.parentLabel,
          defaultDir: mapDir ? `${mapDir}/topics` : 'concepts',
          defaultTagName: isBook && !parent.parentPath ? 'chapter' : 'topicref',
          isBookmap: isBook,
        },
        parentPath: parent.parentPath,
      });
      setNewTopicOpen(true);
    },
    [],
  );

  const handleOpenMountExisting = useCallback(
    (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => {
      setMountExistingTarget({
        ...parent,
        isBookmap: parent.mapPath.toLowerCase().endsWith('.bookmap'),
      });
    },
    [],
  );

  const handleCreateTopicConfirm = useCallback(
    (
      type: DitaTopicTemplateType,
      id: string,
      title: string,
      lang: string,
      targetDir: string,
      mountTagName: string,
    ) => {
      if (topicMountContext) {
        void createTopicAndMountInMap({
          mapPath: topicMountContext.mount.mapPath,
          parentPath: topicMountContext.parentPath,
          tagName: mountTagName,
          topicType: type,
          id,
          title,
          lang,
          targetDir,
        });
        setTopicMountContext(null);
      } else {
        void createStandaloneTopic(type, id, title, lang, targetDir);
      }
    },
    [topicMountContext, createTopicAndMountInMap, createStandaloneTopic],
  );

  const handleJumpToDiagnostic = useCallback(
    (diag: WorkspaceDiagnostic) => {
      void openFileTab(diag.filePath, {
        mode: 'source',
        jumpLine: diag.line,
      });
    },
    [openFileTab],
  );

  const rootMapStrictInput = useMemo<StrictValidationInput | null>(() => {
    if (activeRootMapPath) {
      return { rootMapPath: activeRootMapPath, ditavalPath: activeDitavalPath };
    }
    if (activeTabPath) {
      return { paths: [activeTabPath], ditavalPath: activeDitavalPath };
    }
    return null;
  }, [activeRootMapPath, activeDitavalPath, activeTabPath]);

  const handleJumpFromStrictValidation = useCallback(
    (filePath: string, line: number, column: number) => {
      setStrictOpen(false);
      void openFileTab(filePath, { mode: 'source', jumpLine: line });
      void column;
    },
    [openFileTab],
  );

  const handleCheckinStrictValidate = useCallback(
    (paths: string[]) => {
      setCheckinOpen(false);
      openStrictValidation(
        {
          paths,
          ditavalPath: activeDitavalPath,
          ...(activeRootMapPath ? { rootMapPath: activeRootMapPath } : {}),
        },
        t('app.checkinStrictLabel', { count: paths.length }),
      );
    },
    [activeRootMapPath, activeDitavalPath, openStrictValidation],
  );

  const showTopicVisual =
    Boolean(activeTab) &&
    activeTab!.kind === 'topic' &&
    (mode === 'visual' || mode === 'split');
  const showMapOverview =
    Boolean(activeTab) &&
    isActiveMapTab &&
    (mode === 'visual' || mode === 'split');
  const showVisualPane = showTopicVisual || showMapOverview;
  const showSourcePane = Boolean(activeTab) && (mode === 'source' || mode === 'split');
  /**
   * The inspector is reachable for any open topic tab — including source-only mode, where the
   * AI tab still works on the raw buffer — so collapsing and expanding never dead-ends on a
   * handle that cannot bring the panel back.
   */
  const canShowInspector = inspectorTarget === 'map-node' || activeTab?.kind === 'topic';
  const showRightInspector = inspectorOpen && canShowInspector;
  /** The floating launcher must stay available whenever the panel is not actually on screen. */
  const aiPanelVisible = aiPanelOpen && showRightInspector && inspectorTab === 'ai';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Accessible live status region */}
      <p role="status" className="sr-only">
        {statusMessage}
      </p>

      {/* Full-height workbench shell: the 项目 / Map navigation column runs to the top
          edge of the window, and collapses back so the header regains the full width. */}
      <Group
        key={`outer-${leftSidebarOpen ? 'L' : 'noL'}`}
        orientation="horizontal"
        className="h-full w-full"
      >
        {leftSidebarOpen ? (
          <>
            <Panel id="left-sidebar-pane" defaultSize="22%" minSize="16%" maxSize="36%">
              <LeftSidebar
                activeTab={leftSidebarTab}
                onChangeTab={setLeftSidebarTab}
                onCollapse={() => setLeftSidebarOpen(false)}
                workspaceName={workspaceName}
                workspaceMode={workspaceMode}
                onOpenWorkspaceDialog={() => setWorkspaceDialogOpen(true)}
                mapTreeSlot={
                  <MapTreePanel
                    rootMapPath={activeRootMapPath}
                    mapBuffers={mapBuffers}
                    fileSet={fileSet}
                    topicTitles={topicTitles}
                    selectedMapNode={selectedMapNode}
                    ditavals={workspaceDitavals}
                    activeDitavalPath={activeDitavalPath}
                    activeDitaval={activeDitaval}
                    ditavalDisplayMode={ditavalDisplayMode}
                    onSelectDitaval={(ditavalPath) => void selectDitaval(ditavalPath)}
                    onChangeDitavalDisplayMode={setDitavalDisplayMode}
                    onSelectMapNode={(ref) => selectMapNode(ref, true)}
                    onMoveNodes={moveMapTreeNodes}
                    onOpenTopicOrMap={(path) => void openFileTab(path)}
                    onJumpToSource={(mapPath, line) => void jumpToMapNodeSource(mapPath, line)}
                    onOpenCreateAndMount={handleOpenCreateAndMount}
                    onOpenMountExisting={handleOpenMountExisting}
                    onInsertStructure={(mapPath, parentPath, tagName) =>
                      insertMapStructureNode({
                        mapPath,
                        parentPath,
                        tagName,
                        navtitle: tagName === 'chapter' ? t('app.newChapter') : t('app.newGroup'),
                      })
                    }
                    onDeleteNode={deleteMapTreeNode}
                    onUndoMap={undoMap}
                    onRedoMap={redoMap}
                    onOpenPublish={() => setPublishOpen(true)}
                  />
                }
                keyspaceSlot={
                  <KeyspacePanel
                    rootMapPath={activeRootMapPath}
                    keyspace={keyspace}
                    canInsertInTopic={Boolean(showTopicVisual)}
                    onInsertKeyref={(keyName) => {
                      visualRef.current?.toggleInline('keyword', [
                        { name: 'keyref', value: keyName, namespaceURI: null },
                      ]);
                    }}
                    onJumpToKeyDef={(def) =>
                      void jumpToSemanticLocation(def.sourceMapPath, {
                        mode: 'source',
                        line: def.line,
                      })
                    }
                  />
                }
                fileExplorerSlot={
                  <FileExplorerPanel
                    files={fileTree}
                    activeTabPath={activeTabPath}
                    activeRootMapPath={activeRootMapPath}
                    maps={workspaceMaps}
                    topicTitles={topicTitles}
                    onOpenFile={(path) => void openFileTab(path)}
                    onActivateMap={(path) => void selectRootMap(path)}
                    onSelectRootMap={(path) => void selectRootMap(path)}
                    onNewTopic={() => {
                      setTopicMountContext(null);
                      setNewTopicOpen(true);
                    }}
                    onNewMap={() => setNewMapOpen(true)}
                    onCreateFolder={(dir) => void createWorkspaceFolder(dir)}
                    onRenameFile={(from, to) => void renameWorkspaceFile(from, to)}
                    onDeleteFile={(path) => void deleteWorkspaceFile(path)}
                  />
                }
                gitSlot={
                  <GitPanel
                    activePath={activeTabPath}
                    onOpenDiff={(options) => void openGitDiff(options)}
                    onOpenCheckin={openCheckin}
                  />
                }
              />
            </Panel>
            <Separator className="dita-resize-handle" aria-label={t('app.resizeSidebar')} />
          </>
        ) : null}

        <Panel id="workbench-main-pane" minSize="38%">
          <div className="flex h-full flex-col overflow-hidden">
            <WorkbenchHeader
              showBrand={!leftSidebarOpen}
              activeTab={activeTab}
              mode={mode}
              xmlError={activeTab?.xmlError ?? null}
              leftSidebarOpen={leftSidebarOpen}
              problemsOpen={problemsOpen}
              errorCount={errorCount}
              warningCount={warningCount}
              dirtyCount={dirtyCount}
              isCurrentDirty={!diffStats.isIdentical}
              saving={savingPaths.length > 0}
              identity={identity}
              currentUser={currentUser}
              onSwitchIdentity={(userId) => void switchUser(userId)}
              onToggleLeftSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
              onResetBaseline={resetCurrentToBaseline}
              onSaveActive={() => void saveActiveFile()}
              onSaveAll={() => void saveAllDirtyFiles()}
              onChangeMode={handleChangeMode}
              onToggleProblems={() => setProblemsOpen(!problemsOpen)}
              showInspectorExpand={!showRightInspector && canShowInspector}
              onExpandInspector={() => setInspectorOpen(true)}
            />

            {workspaceMode === 'api' && activeTab ? (
              <LockStatusBar
                filePath={activeTabPath}
                editability={editability}
                lock={activeLock}
                busy={gitLoading}
                canCheckin={activeLockDirty}
                onCheckout={() => {
                  if (activeTabPath) void checkoutFile(activeTabPath);
                }}
                onRelease={() => {
                  if (activeTabPath) void releaseFileLock(activeTabPath);
                }}
                onCancelCheckout={() => {
                  if (activeTabPath) void cancelFileCheckout(activeTabPath);
                }}
                onOpenCheckin={() => {
                  if (activeTabPath) openCheckin([activeTabPath]);
                }}
                onForceUnlock={() => {
                  if (!activeTabPath) return;
                  const reason = window.prompt(
                    t('app.forceUnlockPrompt', { path: activeTabPath }),
                    t('app.forceUnlockReason'),
                  );
                  if (reason !== null) void forceUnlockFile(activeTabPath, reason);
                }}
              />
            ) : null}

            {/* Contextual Topic Formatting Toolbar */}
            {showTopicVisual && canEdit ? (
              <EditorToolbar
                snapshot={snapshot}
                canUndo={historyFlags.canUndo}
                canRedo={historyFlags.canRedo}
                canInsertBlock={(tag) => visualRef.current?.canInsertBlock(tag) ?? false}
                canInsertInline={(tag) => visualRef.current?.canInsertInline(tag) ?? false}
                onUndo={() => visualRef.current?.undo()}
                onRedo={() => visualRef.current?.redo()}
                onOpenInsertMenu={(el) => visualRef.current?.openInsertMenuAtElement(el)}
                onToggleInline={(tag) => visualRef.current?.toggleInline(tag)}
                onInsertBlock={(tag) => visualRef.current?.insertBlock(tag)}
                onOpenXrefDialog={() => setRefDialogMode('xref')}
                onOpenImageDialog={() => setRefDialogMode('image')}
                onOpenKeyrefDialog={() => setKeyrefDialogOpen(true)}
                onOpenConrefDialog={openReuseTab}
                onTableAction={(action) => visualRef.current?.runTableAction(action)}
              />
            ) : null}

            <main className="min-h-0 flex-1 overflow-hidden">
              <Group
                key={`main-${showRightInspector ? 'R' : 'noR'}`}
                orientation="horizontal"
                className="h-full w-full"
              >
                {/* Center Column: Tab Bar + Editor + Optional Bottom Problems Panel */}
                <Panel id="center-workbench-pane" defaultSize={showRightInspector ? '76%' : '100%'} minSize="34%">
                  <div className="relative flex h-full flex-col overflow-hidden">
                    <EditorTabBar
                      tabs={openTabs}
                      activeTabPath={activeTabPath}
                      onSelectTab={activateTab}
                      onCloseTab={closeTab}
                      onCloseOtherTabs={closeOtherTabs}
                      onCloseSavedTabs={closeSavedTabs}
                    />

                    {activeTab?.kind === 'topic' ? (
                      <TopicAuthoringGuide
                        docType={activeTab.docType}
                        structureIssueCount={
                          diagnostics.filter(
                            (d) => d.filePath === activeTab.path && d.source === 'structure',
                          ).length
                        }
                        onOpenProblems={() => setProblemsOpen(true)}
                      />
                    ) : null}

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <Group
                        key={`center-v-${problemsOpen ? 'prob' : 'noprob'}`}
                        orientation="vertical"
                        className="h-full w-full"
                      >
                        <Panel id="editor-stage-pane" defaultSize={problemsOpen ? '72%' : '100%'} minSize="35%">
                          <div className="relative h-full">
                            {!activeTab ? (
                              <div className="flex h-full flex-col items-center justify-center bg-slate-100/70 p-8 text-center">
                                <Network className="mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
                                <h2 className="text-sm font-semibold text-slate-800">
                                  {t('app.emptyTitle')}
                                </h2>
                                <p className="mt-1 max-w-md text-xs text-slate-500">
                                  {t('app.emptyBody')}
                                </p>
                                <div className="mt-4 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTopicMountContext(null);
                                      setNewTopicOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                                  >
                                    <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t('app.newTopic')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setWorkspaceDialogOpen(true)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                                    {t('app.manageWorkspace')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <Group
                                key={`editor-${activeTab.path}-${mode}-${showVisualPane ? 'V' : 'noV'}-${showSourcePane ? 'S' : 'noS'}`}
                                orientation="horizontal"
                                className="h-full w-full"
                              >
                                {showVisualPane ? (
                                  <Panel
                                    id="visual-pane"
                                    defaultSize={showSourcePane ? '52%' : '100%'}
                                    minSize="25%"
                                  >
                                    {showMapOverview ? (
                                      <MapOverviewPane
                                        mapPath={activeTab.path}
                                        xml={activeTab.xml}
                                        fileSet={fileSet}
                                        onUpdateRootTitle={updateMapRootTitle}
                                        onActivateRootMap={(p) => void selectRootMap(p)}
                                        onOpenSourceMode={() => handleChangeMode('source')}
                                        onOpenTopic={(p) => void openFileTab(p)}
                                        onCreateAndMount={(mapPath, title) =>
                                          handleOpenCreateAndMount({
                                            mapPath,
                                            parentPath: null,
                                            parentLabel: title,
                                          })
                                        }
                                      />
                                    ) : (
                                      <VisualEditor
                                        ref={visualRef}
                                        xml={activeTab.xml}
                                        reloadToken={activeTab.visualReloadToken}
                                        tagDisplayMode={tagDisplayMode}
                                        onChangeTagDisplayMode={setTagDisplayMode}
                                        pendingJumpPos={pendingVisualPmPos}
                                        onJumpHandled={clearPendingVisualPmPos}
                                        onXmlChange={updateXmlFromVisual}
                                        onSnapshotChange={handleSnapshotChange}
                                        onAiRequest={handleVisualAiRequest}
                                        onOpenXrefDialog={() => setRefDialogMode('xref')}
                                        onAnnounce={announce}
                                        resolveImageSrc={resolveImageSrcForActiveTab}
                                        semanticOverlay={documentOverlays[activeTab.path] ?? null}
                                        activeDitaval={activeDitaval}
                                        activeDitavalPath={activeDitavalPath}
                                        ditavalDisplayMode={ditavalDisplayMode}
                                        onJumpToSource={(filePath, line, elementId) =>
                                          void jumpToSemanticLocation(filePath, { line, elementId })
                                        }
                                        readOnly={!canEdit}
                                      />
                                    )}
                                  </Panel>
                                ) : null}

                                {showVisualPane && showSourcePane ? (
                                  <Separator
                                    className="dita-resize-handle"
                                    aria-label={t('app.resizeSplit')}
                                  />
                                ) : null}

                                {showSourcePane ? (
                                  <Panel
                                    id="source-pane"
                                    defaultSize={showVisualPane ? '48%' : '100%'}
                                    minSize="24%"
                                  >
                                    <SourceEditor
                                      xml={activeTab.xml}
                                      xmlError={activeTab.xmlError}
                                      switchBlockedReason={activeTab.switchBlockedReason}
                                      pendingJumpOffset={pendingSourceOffset}
                                      onJumpHandled={clearPendingSourceOffset}
                                      onChange={updateXmlFromSource}
                                      onCursorOffsetChange={(offset) => {
                                        sourceCursorOffsetRef.current = offset;
                                      }}
                                      replacementXml={sourceReplacementXml}
                                      onReplacementApplied={handleSourceReplacementApplied}
                                      onAiFixXmlError={handleAiFixXmlError}
                                      onAnnounce={announce}
                                      keyspace={keyspace}
                                      topicIndices={topicIndices}
                                      profilingCatalog={profilingCatalog}
                                      readOnly={!canEdit}
                                    />
                                  </Panel>
                                ) : null}
                              </Group>
                            )}
                            {activeTab?.kind === 'topic' && !aiPanelVisible ? (
                              <button
                                type="button"
                                onClick={() => openAiPanel()}
                                aria-label={t('app.openAiFab')}
                                title={t('app.openAiFabTitle')}
                                className="absolute bottom-4 right-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-white/95 text-indigo-600 shadow-lg shadow-indigo-900/10 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-indigo-600 hover:text-white"
                              >
                                <Sparkles className="h-4 w-4" aria-hidden="true" />
                                {!aiConfigured ? (
                                  <span
                                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </button>
                            ) : null}
                          </div>
                        </Panel>

                        {problemsOpen ? (
                          <>
                            <Separator
                              className="dita-resize-handle-y"
                              aria-label={t('app.resizeProblems')}
                            />
                            <Panel id="problems-pane" defaultSize="28%" minSize="16%" maxSize="55%">
                              <ProblemsPanel
                                diagnostics={diagnostics}
                                onRefresh={() => void refreshDiagnostics()}
                                onJumpToDiagnostic={handleJumpToDiagnostic}
                                onClose={() => setProblemsOpen(false)}
                                onAiFixDiagnostic={(diagnostic) => void handleAiFixDiagnostic(diagnostic)}
                                onStrictValidate={
                                  rootMapStrictInput
                                    ? () =>
                                        openStrictValidation(
                                          rootMapStrictInput,
                                          t('app.strictLabel', { path: activeRootMapPath ?? activeTabPath ?? '' }),
                                        )
                                    : undefined
                                }
                              />
                            </Panel>
                          </>
                        ) : null}
                      </Group>
                    </div>
                  </div>
                </Panel>

                {showRightInspector ? (
                  <>
                    <Separator className="dita-resize-handle" aria-label={t('app.resizeInspector')} />
                    <Panel id="inspector-pane" defaultSize="24%" minSize="18%" maxSize="38%">
                      <div className="relative h-full">
                        {inspectorTarget === 'map-node' ? (
                          <>
                            <MapNodeInspector
                              selected={selectedMapNode}
                              mapBuffers={mapBuffers}
                              availableFiles={workspaceMountables}
                              activeDitaval={activeDitaval}
                              profilingCatalog={profilingCatalog}
                              onUpdateAttr={updateMapAttr}
                              onUpdateNavtitle={updateMapNavtitle}
                              onUpdateRootTitle={updateMapRootTitle}
                              onOpenTargetFile={(path) => void openFileTab(path)}
                              onJumpToSource={(mapPath, line) => void jumpToMapNodeSource(mapPath, line)}
                              onDeleteNode={deleteMapTreeNode}
                            />
                            <button
                              type="button"
                              onClick={() => setInspectorOpen(false)}
                              aria-label={t('app.collapseInspector')}
                              title={t('app.collapseInspector')}
                              className="absolute right-1.5 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                            >
                              <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <TopicInspector
                            onCollapse={() => setInspectorOpen(false)}
                            tab={inspectorTab}
                            onTabChange={handleInspectorTabChange}
                            attributes={{
                              snapshot,
                              docMetadata: docMeta,
                              semanticOverlay: activeTab
                                ? (documentOverlays[activeTab.path] ?? null)
                                : null,
                              activeDitaval,
                              profilingCatalog,
                              onJumpToSource: (filePath, line, elementId) =>
                                void jumpToSemanticLocation(filePath, { line, elementId }),
                              onOpenConrefDialog: openReuseTab,
                              onUpdateAttr: (pos, name, val) =>
                                visualRef.current?.updateAttr(pos, name, val),
                              onSelectBreadcrumb: (pos) => visualRef.current?.selectNode(pos, true),
                              onMoveNode: (pos, dir) => visualRef.current?.moveNode(pos, dir),
                              onDeleteNode: (pos) => visualRef.current?.deleteNode(pos),
                            }}
                            reuse={{
                              activeDocPath: activeTab?.path ?? null,
                              selectedElementTag: snapshot?.activeItem?.tagName ?? null,
                              selectedTopicId: snapshot?.breadcrumbs[0]?.id ?? undefined,
                              selectedElementId: snapshot?.activeItem?.id ?? undefined,
                              keyspace,
                              topicIndices,
                              onResolvePreview: resolveConrefPreview,
                              onConfirm: handleConfirmConref,
                              onConfirmed: () => setInspectorTab('attributes'),
                            }}
                            ai={
                              activeTab ? (
                                <AiAssistantPanel
                                  filePath={activeTab.path}
                                  xml={activeTab.xml}
                                  target={aiTarget}
                                  resolveTarget={computeAiTarget}
                                  projectPath={activeTab.path}
                                  rootMapPath={activeRootMapPath ?? undefined}
                                  ditavalPath={activeDitavalPath ?? undefined}
                                  diagnostics={diagnostics}
                                  canApply={aiApplyMode !== 'preview-only'}
                                  readOnly={aiApplyMode === 'preview-only'}
                                  onApplyProposal={(patchedXml) => void handleApplyAiProposal(patchedXml)}
                                  onRequestApply={() => setAiDiffOpen(true)}
                                  onPreviewDiff={() => setAiDiffOpen(true)}
                                  onOpenSettings={() => setAiSettingsOpen(true)}
                                />
                              ) : null
                            }
                          />
                        )}
                      </div>
                    </Panel>
                  </>
                ) : null}
              </Group>
            </main>

            <BreadcrumbBar
              breadcrumbs={showTopicVisual ? (snapshot?.breadcrumbs ?? []) : []}
              activePos={showTopicVisual ? (snapshot?.activeItem?.pos ?? null) : null}
              onSelectCrumb={handleSelectBreadcrumb}
              diffStats={diffStats}
              mode={mode}
              activePath={activeTab?.path ?? activeRootMapPath}
              diagnosticsCount={diagnostics.length}
              onToggleProblems={() => setProblemsOpen(!problemsOpen)}
            />
          </div>
        </Panel>
      </Group>

      {/* Native Modal Dialogs */}
      <NewTopicDialog
        open={newTopicOpen}
        mountContext={topicMountContext?.mount ?? null}
        directories={workspaceDirectories}
        onClose={() => {
          setNewTopicOpen(false);
          setTopicMountContext(null);
        }}
        onCreate={handleCreateTopicConfirm}
      />

      <NewMapDialog
        open={newMapOpen}
        onClose={() => setNewMapOpen(false)}
        onCreate={(opts) => void createNewMapFile(opts)}
      />

      <WorkspaceDialog
        open={workspaceDialogOpen}
        workspaceMode={workspaceMode}
        rootDir={workspaceRootDir}
        defaultRootDir={workspaceDefaultRootDir}
        importsRootDir={workspaceImportsRootDir}
        recentWorkspaces={recentWorkspaces}
        loadingWorkspaces={loadingWorkspaces}
        onClose={() => setWorkspaceDialogOpen(false)}
        onOpenLocalDir={openLocalWorkspace}
        onCreateWorkspace={createBlankWorkspace}
        onForgetWorkspace={forgetRecentWorkspace}
        onRefreshWorkspaces={refreshRecentWorkspaces}
        onImportFolder={importFolderWorkspace}
        onRestoreOfflineDemo={restoreOfflineDemo}
      />

      {mountExistingTarget ? (
        <MountExistingDialog
          open={Boolean(mountExistingTarget)}
          mapPath={mountExistingTarget.mapPath}
          parentLabel={mountExistingTarget.parentLabel}
          isBookmap={mountExistingTarget.isBookmap}
          availableFiles={workspaceMountables}
          topicTitles={topicTitles}
          onClose={() => setMountExistingTarget(null)}
          onConfirm={(opts) => {
            mountExistingFileInMap({
              mapPath: mountExistingTarget.mapPath,
              parentPath: mountExistingTarget.parentPath,
              targetFilePath: opts.targetFilePath,
              tagName: opts.tagName,
              navtitle: opts.navtitle,
            });
            setMountExistingTarget(null);
          }}
        />
      ) : null}

      <XrefImageDialog
        mode={refDialogMode}
        activeDocPath={activeTab?.path ?? null}
        workspaceMode={workspaceMode}
        workspaceTopics={workspaceTopics}
        workspaceImages={workspaceImages}
        topicTitles={topicTitles}
        keyspace={keyspace}
        onUploadImage={uploadWorkspaceImage}
        resolvePreviewUrl={resolveImageSrcForActiveTab}
        onClose={() => setRefDialogMode(null)}
        onConfirmXref={handleConfirmXref}
        onConfirmImage={handleConfirmImage}
      />

      <InsertKeyrefDialog
        open={keyrefDialogOpen}
        keyspace={keyspace}
        rootMapPath={activeRootMapPath}
        onClose={() => setKeyrefDialogOpen(false)}
        onConfirm={handleConfirmKeyref}
      />

      <DiffDialog
        open={diffDialogOpen}
        diff={gitDiff}
        loading={gitDiffLoading}
        onClose={closeGitDiff}
      />

      <CheckinDialog
        open={checkinOpen}
        candidates={checkinCandidates}
        onClose={() => setCheckinOpen(false)}
        onStrictValidate={handleCheckinStrictValidate}
        onConfirm={async (paths, message) => {
          const result = await checkinFiles(paths, message);
          if (result) await loadGitHistory(activeTabPath);
          return result !== null;
        }}
      />

      <PublishDialog
        open={publishOpen}
        rootMaps={workspaceMaps}
        ditavals={workspaceDitavals}
        activeRootMapPath={activeRootMapPath}
        activeDitavalPath={activeDitavalPath}
        role={currentUser?.role ?? null}
        onClose={() => setPublishOpen(false)}
      />

      <StrictValidationDialog
        open={strictOpen}
        input={strictInput}
        targetLabel={strictLabel}
        onClose={() => setStrictOpen(false)}
        onJumpToFile={handleJumpFromStrictValidation}
        onAiFixDiagnostic={(diagnostic) => void handleAiFixStrictDiagnostic(diagnostic)}
        aiApplied={strictAiApplied}
      />

      <AiSettingsDialog open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />

      <AiDiffDialog
        open={aiDiffOpen}
        proposal={aiProposal}
        canApply={aiApplyMode !== 'preview-only'}
        readOnly={aiApplyMode === 'preview-only'}
        onClose={() => setAiDiffOpen(false)}
        onApply={(patchedXml) => void handleApplyAiProposal(patchedXml)}
      />
    </div>
  );
}
