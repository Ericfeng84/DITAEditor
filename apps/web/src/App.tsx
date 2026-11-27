import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  checkXmlWellFormed,
  collectTopicElementIds,
  detectTaskContentModel,
  dirnamePosix,
  findDomElementByPath,
  findElementPathAtOffset,
  generateSemanticElementId,
  getNodeSourceRange,
  getPmDocTitle,
  getPmNodeTagName,
  pmDocToXml,
  slimdomToPmDoc,
  type DitaTopicTemplateType,
  type RawAttrs,
  type XmlDeclaration,
  type XmlPrologItem,
  type IngestJobResult,
} from '@dita/core';
import { FilePlus2, FolderOpen, ListTree, Network, PanelRightClose, Sparkles } from 'lucide-react';
import {
  CheckinDialog,
  collectCheckinIssues,
  type CheckinCandidate,
} from './components/CheckinDialog';
import { DiffDialog } from './components/DiffDialog';
import { EditorTabBar } from './components/EditorTabBar';
import { FileExplorerPanel } from './components/FileExplorerPanel';
import { GitPanel } from './components/GitPanel';
import { MergeDialog } from './components/MergeDialog';
import { InsertKeyrefDialog } from './components/InsertKeyrefDialog';
import { NewKeyDialog, type NewKeyDialogContext } from './components/NewKeyDialog';
import { KeyspacePanel } from './components/KeyspacePanel';
import { LeftSidebar } from './components/LeftSidebar';
import { LockStatusBar } from './components/LockStatusBar';
import { ReadOnlyBanner } from './components/ReadOnlyBanner';
import { NewMapDialog } from './components/NewMapDialog';
import { NewTopicDialog, type NewTopicMountContext } from './components/NewTopicDialog';
import {
  CreateReusableSnippetDialog,
  resolveWarehouseTargetValue,
  type ReuseSnippetMode,
  type ReuseSnippetExtractSource,
  type ReuseSnippetSubmission,
} from './components/CreateReusableSnippetDialog';
import { ProblemsPanel } from './components/ProblemsPanel';
import { PublishDialog } from './components/publish/PublishDialog';
import { StrictValidationDialog } from './components/publish/StrictValidationDialog';
import {
  TopicAuthoringGuide,
  TopicGuideChip,
  useAuthoringGuideExpanded,
} from './components/TopicAuthoringGuide';
import { DelegateTopicButton } from './components/DelegateTopicButton';
import { ManualAssignmentsPanel } from './components/ManualAssignmentsPanel';
import type { AssignmentBadge } from './components/FileExplorerPanel';
import { TopicAssignmentBanner } from './components/TopicAssignmentBanner';
import { SaveControls } from './components/SaveControls';
import { WorkbenchAlertBanner } from './workbench/WorkbenchAlertBanner';
import { ContentConflictBanner } from './workbench/ContentConflictBanner';
import { TopicInspector, type InspectorTab } from './components/TopicInspector';
import { WorkbenchHeader } from './components/WorkbenchHeader';
import { WorkspaceDialog } from './components/WorkspaceDialog';
import { XrefImageDialog } from './components/XrefImageDialog';
import { AiAssistantPanel } from './ai/AiAssistantPanel';
import { AiDiffDialog } from './ai/AiDiffDialog';
import { AiSettingsDialog } from './ai/AiSettingsDialog';
import { DocumentIngestDialog } from './ingest/DocumentIngestDialog';
import { DesktopSettingsDialog } from './desktop/DesktopSettingsDialog.js';
import { isDesktopApp } from './services/desktop-bridge.js';
import { useDesktopStore } from './store/desktop-store.js';
import type { IngestMountContext } from './ingest/types';
import { applyDocumentLocale, useI18n } from './i18n/index.js';
import type { AiTargetSpec } from './ai/ai-types';
import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { useAiStore } from './ai/ai-store';
import { useAiPanelActions } from './ai/use-ai-panel-actions';
import { syncSourceToVisual, syncVisualToSource } from './editor/bridge/xml-bridge';
import { DocumentOutlinePanel } from './editor/outline/DocumentOutlinePanel';
import {
  evaluateOutlineDrop,
  type OutlineDropEvaluation,
  type OutlineDropPlacement,
} from './editor/outline/outline-dnd';
import {
  buildDocumentOutline,
  indexOutlineNodes,
  resolveActiveOutlineId,
  resolveActiveOutlineIdByPath,
  type OutlineNode,
} from './editor/outline/outline-model';
import { SourceEditor } from './editor/source/SourceEditor';
import { AttributesPanel } from './editor/visual/AttributesPanel';
import { BreadcrumbBar } from './editor/visual/BreadcrumbBar';
import { EditorToolbar } from './editor/visual/EditorToolbar';
import type { BreadcrumbItem, EditorSelectionSnapshot } from './editor/visual/selection-info';
import { VisualEditor, type VisualEditorHandle } from './editor/visual/VisualEditor';
import { moveDitaNodeByOutline } from './editor/visual/commands';
import { MapNodeInspector } from './map-tree/MapNodeInspector';
import { MapOverviewPane } from './map-tree/MapOverviewPane';
import { MapTreePanel } from './map-tree/MapTreePanel';
import {
  collectWorkspaceDirectoryPaths,
  collectWorkspaceFilesByKind,
  type CompositeMapTreeNode,
} from './map-tree/map-tree-utils';
import { MountExistingDialog } from './map-tree/MountExistingDialog';
import { canManageMapKeys, resolveFileEditability } from './services/lock-helpers';
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
import { useAssignmentStore } from './store/assignment-store';
import { useGitStore } from './store/git-store';
import {
  setDetectedTaskContentModel,
  shouldShowTaskModelSwitch,
} from './editor/structure-options';
import { DelegateTopicDialog } from './workbench/DelegateTopicDialog';
import { UnsavedChangesDialog } from './workbench/UnsavedChangesDialog';

export interface AppProps {
  /** Phase 10: the manual this session is bound to (identical to the scope header value). */
  manualId: string;
  manualName: string;
  branch: string | null;
  /** Deep link from the hub or an assignment card (`?topic=…`). */
  topicPath: string | null;
  assignmentId: string | null;
  /** Leaves the session back to the workbench hub; the shell owns the actual navigation. */
  onLeaveSession: () => void;
}

/** Outline column width: clamped so the panel stays usable without starving the editors. */
const OUTLINE_MIN_WIDTH = 180;
const OUTLINE_MAX_WIDTH = 420;
const OUTLINE_DEFAULT_WIDTH = 240;

export function App({ manualId, manualName, branch, topicPath, assignmentId, onLeaveSession }: AppProps) {
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
  const topicTypes = useEditorStore((s) => s.topicTypes);
  const activeRootMapPath = useEditorStore((s) => s.activeRootMapPath);
  const activeDitavalPath = useEditorStore((s) => s.activeDitavalPath);
  const activeDitaval = useEditorStore((s) => s.activeDitaval);
  const ditavalDisplayMode = useEditorStore((s) => s.ditavalDisplayMode);
  const keyspace = useEditorStore((s) => s.keyspace);
  const mapPanelView = useEditorStore((s) => s.mapPanelView);
  const setMapPanelView = useEditorStore((s) => s.setMapPanelView);
  const createMapKey = useEditorStore((s) => s.createMapKey);
  const deleteMapKey = useEditorStore((s) => s.deleteMapKey);
  const upsertMapNodeKeyText = useEditorStore((s) => s.upsertMapNodeKeyText);
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
  const taskModelSetting = useEditorStore((s) => s.taskModelSetting);
  const setTaskModelSetting = useEditorStore((s) => s.setTaskModelSetting);
  const statusMessage = useEditorStore((s) => s.statusMessage);
  const alert = useEditorStore((s) => s.alert);
  const dismissAlert = useEditorStore((s) => s.dismissAlert);
  const contentConflict = useEditorStore((s) => s.contentConflict);
  const dismissContentConflict = useEditorStore((s) => s.dismissContentConflict);
  const resolveContentConflict = useEditorStore((s) => s.resolveContentConflict);
  const saveFileEnsuringLock = useEditorStore((s) => s.saveFileEnsuringLock);
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
  const createMissingMapTarget = useEditorStore((s) => s.createMissingMapTarget);
  const mountExistingFileInMap = useEditorStore((s) => s.mountExistingFileInMap);
  const insertMapStructureNode = useEditorStore((s) => s.insertMapStructureNode);
  const updateMapAttr = useEditorStore((s) => s.updateMapAttr);
  const updateMapNavtitle = useEditorStore((s) => s.updateMapNavtitle);
  const renameMapKey = useEditorStore((s) => s.renameMapKey);
  const updateMapKeyValue = useEditorStore((s) => s.updateMapKeyValue);
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
  const createWarehouseTopic = useEditorStore((s) => s.createWarehouseTopic);
  const addReusableFragmentToTopic = useEditorStore((s) => s.addReusableFragmentToTopic);

  const setLeftSidebarOpen = useEditorStore((s) => s.setLeftSidebarOpen);
  const setLeftSidebarTab = useEditorStore((s) => s.setLeftSidebarTab);
  const setInspectorOpen = useEditorStore((s) => s.setInspectorOpen);
  const setInspectorTarget = useEditorStore((s) => s.setInspectorTarget);
  const setProblemsOpen = useEditorStore((s) => s.setProblemsOpen);
  const outlineOpen = useEditorStore((s) => s.outlineOpen);
  const outlineDensity = useEditorStore((s) => s.outlineDensity);
  const setOutlineOpen = useEditorStore((s) => s.setOutlineOpen);
  const setOutlineDensity = useEditorStore((s) => s.setOutlineDensity);
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
  const userDrafts = useGitStore((s) => s.userDrafts);
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

  // Initialize workspace on mount. A deep-linked topic (`?topic=…`) wins over the first topic.
  useEffect(() => {
    void initWorkspace({ topicPath });
  }, [initWorkspace, topicPath]);

  // Phase 10: assignment state is scoped to this session's manual + branch by the shell headers.
  const refreshAssignmentForTopic = useAssignmentStore((state) => state.refreshForTopic);
  const refreshAssignmentLists = useAssignmentStore((state) => state.refreshLists);
  useEffect(() => {
    if (import.meta.env.VITE_STATIC_DEMO === 'true') return;
    void refreshAssignmentLists();
  }, [refreshAssignmentLists]);
  useEffect(() => {
    if (import.meta.env.VITE_STATIC_DEMO === 'true') return;
    void refreshAssignmentForTopic(activeTabPath);
    // A checkout/check-in changes assignment status server-side, so the lists need a re-read too.
    void refreshAssignmentLists();
  }, [refreshAssignmentForTopic, refreshAssignmentLists, activeTabPath, assignmentId, locks]);

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
  // Task content model: `auto` follows the open document's <!DOCTYPE>, so mirror the detection into
  // the React-free helper used by commands / block transforms / the Source linter.
  const detectedTaskModel = useMemo(
    () => detectTaskContentModel(activeTab?.xml),
    [activeTab?.xml],
  );
  const resolvedTaskModel = taskModelSetting === 'auto' ? detectedTaskModel : taskModelSetting;
  const showTaskModelSwitch = shouldShowTaskModelSwitch(activeTab?.docType);
  useEffect(() => {
    setDetectedTaskContentModel(detectedTaskModel);
  }, [detectedTaskModel]);

  // Global Cmd/Ctrl+Shift+O toggles the document outline of the open topic.
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (!(ev.metaKey || ev.ctrlKey) || !ev.shiftKey) return;
      if (ev.key.toLowerCase() !== 'o') return;
      if (!activeTab || activeTab.kind !== 'topic') return;
      ev.preventDefault();
      setOutlineOpen(!outlineOpen);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, outlineOpen, setOutlineOpen]);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinPaths, setCheckinPaths] = useState<string[]>([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [strictOpen, setStrictOpen] = useState(false);
  const [strictInput, setStrictInput] = useState<StrictValidationInput | null>(null);
  const [strictLabel, setStrictLabel] = useState('');
  const [strictAiApplied, setStrictAiApplied] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettingsTab, setAiSettingsTab] = useState<'llm' | 'parsers'>('llm');
  /** Desktop shell only: the storage/plugin dialog and the Electron menu shortcut. */
  const desktop = isDesktopApp();
  const openDesktopDialog = useDesktopStore((state) => state.openDialog);
  const openPluginGuide = useCallback(() => openDesktopDialog('plugins'), [openDesktopDialog]);
  const openParserSettings = useCallback(() => {
    setAiSettingsTab('parsers');
    setAiSettingsOpen(true);
  }, []);

  useEffect(() => {
    if (!desktop) return;
    const bridge = window.ditaDesktop;
    if (!bridge) return;
    return bridge.onOpenDesktopSettings(() => openDesktopDialog('storage'));
  }, [desktop, openDesktopDialog]);
  /** Phase 14 — document ingest wizard (targets the current manual). */
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestMount, setIngestMount] = useState<IngestMountContext | null>(null);
  const [aiDiffOpen, setAiDiffOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<AiTargetSpec | null>(null);
  const [sourceReplacementXml, setSourceReplacementXml] = useState<string | null>(null);
  /** Live ProseMirror document behind the outline; refreshed only when the doc really changes. */
  const [visualDoc, setVisualDoc] = useState<PMNode | null>(null);
  /** Width of the outline column; it lives outside the resizable `<Group>` so toggling it never
   * remounts the editors (which would wipe undo history, selection and scroll position). */
  const [outlineWidth, setOutlineWidth] = useState(OUTLINE_DEFAULT_WIDTH);

  /**
   * Pointer-resize for the outline column. The column sits outside the editor `<Group>`, so a drag
   * only moves the panel and lets the editors reflow — no ProseMirror state is touched.
   */
  const handleOutlineResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = outlineWidth;
      const onMove = (moveEvent: PointerEvent) => {
        setOutlineWidth(
          Math.min(
            OUTLINE_MAX_WIDTH,
            Math.max(OUTLINE_MIN_WIDTH, startWidth + (moveEvent.clientX - startX)),
          ),
        );
      };
      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    },
    [outlineWidth],
  );
  /** Caret offset mirrored into the outline, only tracked while it is open in Source-only mode. */
  const [outlineSourceCursorOffset, setOutlineSourceCursorOffset] = useState(0);

  // A tab switch always invalidates the previous document's outline snapshot.
  useEffect(() => {
    setVisualDoc(null);
    setOutlineSourceCursorOffset(0);
  }, [activeTabPath, activeTab?.kind]);

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
  // Key CRUD writes the `.ditamap`, so it must not follow the open topic's check-out state; the
  // store actions check the map out themselves through `ensureMapEditable(mapPath)`.
  const canManageKeys = canManageMapKeys({ workspaceMode, role: currentUser?.role });

  /** `NewKeyDialog` placement plus the optional binding callback for resolved keyrefs. */
  type NewKeyRequest = NewKeyDialogContext & { onCreated?: (qualifiedKey: string) => void };
  const [newKeyRequest, setNewKeyRequest] = useState<NewKeyRequest | null>(null);
  const openNewKey = useCallback(
    (request: NewKeyRequest) => {
      setNewKeyRequest(request);
    },
    [],
  );
  const availableKeyFiles = useMemo(
    () => collectWorkspaceFilesByKind(fileTree, new Set(['topic', 'ditamap', 'image'])),
    [fileTree],
  );
  const keyCount = keyspace ? Object.keys(keyspace.keys).length : 0;
  const openKeysView = useCallback(() => {
    setLeftSidebarOpen(true);
    setLeftSidebarTab('map');
    setMapPanelView('keys');
  }, [setLeftSidebarOpen, setLeftSidebarTab, setMapPanelView]);
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
  const aiApplyOutcome = useAiStore((state) => state.applyOutcome);
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
  const dirtyPaths = useMemo(() => {
    const dirty = new Set<string>();
    for (const t of openTabs) {
      if (t.xml !== t.baselineXml) dirty.add(t.path);
    }
    for (const [p, buf] of Object.entries(mapBuffers)) {
      if (buf.xml !== buf.baselineXml) dirty.add(p);
    }
    return Array.from(dirty);
  }, [openTabs, mapBuffers]);
  // Phase 10: assignment wiring for the currently open topic.
  const assignableUsers = useMemo(
    () => (identity?.users ?? []).filter((user) => user.role !== 'viewer'),
    [identity],
  );
  const activeAssignment = useAssignmentStore((state) => state.active);
  const myAssignments = useAssignmentStore((state) => state.mine);
  const openAssignmentCount = useMemo(
    () => myAssignments.filter((item) => item.status === 'pending' || item.status === 'in_progress').length,
    [myAssignments],
  );
  const delegatedAssignments = useAssignmentStore((state) => state.delegated);
  const delegate = useAssignmentStore((state) => state.delegate);
  const assignmentBusy = useAssignmentStore((state) => state.busy);
  const assignmentError = useAssignmentStore((state) => state.error);
  const [delegateTarget, setDelegateTarget] = useState<{ path: string; title: string } | null>(null);

  /** Phase 10: file-explorer badge per assigned topic (mine + delegated, open statuses only). */
  const assignmentBadges = useMemo(() => {
    const badges: Record<string, AssignmentBadge> = {};
    const consider = (item: (typeof myAssignments)[number]) => {
      if (item.status === 'done' || item.status === 'cancelled') return;
      if (!item.assignee) return;
      badges[item.topicPath] = {
        initials: item.assignee.initials,
        displayName: item.assignee.displayName,
        status: item.status,
        overdue: item.overdue,
        mine: item.assignee.id === currentUser?.id,
      };
    };
    myAssignments.forEach(consider);
    delegatedAssignments.forEach(consider);
    if (activeAssignment) consider(activeAssignment);
    return badges;
  }, [myAssignments, delegatedAssignments, activeAssignment, currentUser?.id]);
  /** Topic paths of my open assignments — the check-in dialog offers to close them. */
  const assignedPaths = useMemo(() => {
    const paths = new Set(
      myAssignments
        .filter((item) => item.status === 'pending' || item.status === 'in_progress')
        .map((item) => item.topicPath),
    );
    if (activeAssignment && (activeAssignment.status === 'pending' || activeAssignment.status === 'in_progress')) {
      paths.add(activeAssignment.topicPath);
    }
    return Array.from(paths);
  }, [myAssignments, activeAssignment]);
  const showDelegateButton = Boolean(
    workspaceMode === 'api' &&
      activeTab &&
      activeTab.kind === 'topic' &&
      (currentUser?.role === 'admin' || currentUser?.role === 'writer') &&
      !(
        activeAssignment &&
        activeAssignment.topicPath === activeTab.path &&
        activeAssignment.status !== 'done' &&
        activeAssignment.status !== 'cancelled'
      ),
  );
  const checkinCandidates = useMemo<CheckinCandidate[]>(() => {
    const paths =
      checkinPaths.length > 0
        ? checkinPaths
        : locks
            .filter(
              (lock) =>
                lock.userId === currentUser?.id &&
                // Maps edited from the map tree are dirty in memory long before they are dirty on
                // disk, and `checkin` saves them before committing.
                (dirtyPathSet.has(lock.filePath) || dirtyPaths.includes(lock.filePath)),
            )
            .map((lock) => lock.filePath);
    // Phase 13: creates, renames and deletes never take a check-out lock, yet they are exactly
    // what the caller wants to commit — include every drafts path and let `lock` be optional.
    const draftPaths = userDrafts.map((draft) => draft.filePath);
    const allPaths = Array.from(new Set([...paths, ...draftPaths]));
    return allPaths.map((path) => {
      const lock = locks.find((item) => item.filePath === path);
      return lock ? { path, lock } : { path };
    });
  }, [checkinPaths, locks, userDrafts, currentUser?.id, dirtyPathSet, dirtyPaths]);

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

  // Phase 14 preflight: validate the drafts about to be committed before the commit is attempted,
  // so a structure error cannot turn into an opaque server-side rejection. Open tabs are re-parsed
  // from their live XML; closed drafts fall back to the indexer's overlay diagnostics.
  const checkinIssuesByPath = useMemo(() => {
    if (!checkinOpen) return {};
    const openXml: Record<string, string | undefined> = {};
    for (const tab of openTabs) openXml[tab.path] = tab.xml;
    for (const [path, buffer] of Object.entries(mapBuffers)) {
      if (openXml[path] === undefined) openXml[path] = buffer.xml;
    }
    return collectCheckinIssues({
      candidates: checkinCandidates.map((item) => item.path),
      openXml,
      drafts: userDrafts,
      diagnostics,
      locale,
    });
  }, [checkinOpen, checkinCandidates, openTabs, mapBuffers, userDrafts, diagnostics, locale]);

  const dirtyCount = dirtyPaths.length;
  const reloadFilesFromDisk = useEditorStore((state) => state.reloadFilesFromDisk);

  // Phase 10: leaving a manual session must not silently drop unsaved buffers.
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const requestLeave = useCallback(() => {
    if (dirtyPaths.length === 0) {
      onLeaveSession();
      return;
    }
    setLeaveError(null);
    setLeaveOpen(true);
  }, [dirtyPaths.length, onLeaveSession]);
  const attemptSaveAndLeave = useCallback(
    async (ensureLocks: boolean) => {
      setLeaving(true);
      setLeaveError(null);
      try {
        // `refresh: false` — leaving the session does not need the index/diagnostics round-trip; it
        // previously left the button spinning forever when that refresh was slow.
        const failed = await saveAllDirtyFiles({ refresh: false, ensureLocks });
        if (failed.length === 0) {
          setLeaveOpen(false);
          onLeaveSession();
          return;
        }
        // A failed save (missing checkout lock, deleted file, network error) used to leave the
        // dialog silently open — surface which files failed, with discard as the escape hatch.
        // The API's own wording is the only reliable hint ("请先检出该文件再编辑保存"), so quote it.
        const reason = useEditorStore
          .getState()
          .lastSaveFailures.filter((failure) => failed.includes(failure.path))
          .map((failure) => failure.message)
          .join('; ');
        setLeaveError(
          reason
            ? t('workbench.leaveSaveFailedDetail', {
                paths: failed.join('、'),
                reason,
              })
            : t('workbench.leaveSaveFailed', { paths: failed.join('、') }),
        );
      } catch (err) {
        setLeaveError(
          t('workbench.leaveSaveFailed', { paths: dirtyPaths.join('、') }) +
            (err instanceof Error ? ` ${err.message}` : ''),
        );
      } finally {
        setLeaving(false);
      }
    },
    [saveAllDirtyFiles, onLeaveSession, t, dirtyPaths],
  );
  const handleSaveAndLeave = useCallback(() => {
    void attemptSaveAndLeave(false);
  }, [attemptSaveAndLeave]);
  const handleSaveWithCheckoutAndLeave = useCallback(() => {
    void attemptSaveAndLeave(true);
  }, [attemptSaveAndLeave]);
  const handleDiscardAndLeave = useCallback(async () => {
    setLeaving(true);
    setLeaveError(null);
    try {
      if (dirtyPaths.length > 0) await reloadFilesFromDisk(dirtyPaths);
      setLeaveOpen(false);
      onLeaveSession();
    } finally {
      setLeaving(false);
    }
  }, [dirtyPaths, reloadFilesFromDisk, onLeaveSession]);

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
    () => collectWorkspaceFilesByKind(fileTree, new Set(['topic', 'ditamap'])),
    [fileTree],
  );

  /** Reuse target candidates + the ids already taken in each of them (dialog-side validation). */
  const reuseTopicFiles = useMemo(
    () =>
      workspaceTopics.map((path) =>
        topicTitles[path] ? { path, title: topicTitles[path] } : { path },
      ),
    [workspaceTopics, topicTitles],
  );
  const reuseExistingIdsByFile = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const entry of topicIndices) {
      out[entry.filePath] = entry.elements.map((element) => element.elementId);
    }
    return out;
  }, [topicIndices]);

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
  } | null>(null);
  const [refDialogMode, setRefDialogMode] = useState<'xref' | 'image' | null>(null);
  const [keyrefDialogOpen, setKeyrefDialogOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('attributes');
  const [reuseDialog, setReuseDialog] = useState<{
    mode: ReuseSnippetMode;
    source?: ReuseSnippetExtractSource;
  } | null>(null);
  /** Caret the `/` insert menu was opened at, so a snippet lands there instead of the selection. */
  const pendingReuseInsertPosRef = useRef<number | null>(null);

  const {
    computeAiTarget,
    openAiPanel,
    handleInspectorTabChange,
    handleVisualAiRequest,
    handleAiFixXmlError,
    handleAiFixDiagnostic,
    handleAiFixStrictDiagnostic,
    handleApplyAiProposal,
    handleSourceReplacementApplied,
  } = useAiPanelActions({
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
  });

  // Retry persisting an AI patch whose draft save failed: the editor still holds the fix, so the
  // only thing missing is the Draft Overlay write (and the resulting lock/draft list refresh).
  const handleRetryAiSaveDraft = useCallback(async () => {
    const outcome = useAiStore.getState().applyOutcome;
    const path = outcome?.filePath ?? activeTabPath;
    if (!path) return;
    const saved = await useEditorStore.getState().saveFile(path);
    await useGitStore.getState().refreshAll().catch(() => undefined);
    const checkedOutAutomatically = outcome?.checkedOutAutomatically ?? false;
    if (saved) {
      useAiStore.getState().setApplyOutcome({
        status: 'saved-draft',
        checkedOutAutomatically,
        filePath: path,
      });
      announce(t('app.aiAppliedSavedDraft'));
      return;
    }
    const saveError =
      useEditorStore.getState().lastSaveFailures?.find((item) => item.path === path)?.message ??
      useEditorStore.getState().statusMessage ??
      '';
    useAiStore.getState().setApplyOutcome({
      status: 'applied-unsaved',
      checkedOutAutomatically,
      filePath: path,
      saveError,
    });
    announce(t('app.aiAppliedSaveFailed', { message: saveError }));
  }, [activeTabPath, announce, t]);

  const handleRevalidateStrictForPatch = useCallback(() => {
    const path = activeTab?.path ?? activeTabPath;
    if (!path) return;
    openStrictValidation(
      {
        paths: [path],
        ditavalPath: activeDitavalPath,
        ...(activeRootMapPath ? { rootMapPath: activeRootMapPath } : {}),
      },
      t('app.checkinStrictLabel', { count: 1 }),
    );
  }, [activeTab?.path, activeTabPath, activeDitavalPath, activeRootMapPath, openStrictValidation, t]);

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
    activeTab?.kind === 'ditamap';
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
          updateXmlFromVisual(synced.xml, getPmDocTitle(pmState.doc));
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

  /**
   * Right-inspector "复用" tab is the single entry point for conref / conkeyref work. When the
   * caller already knows where the reference belongs (the `/` insert menu), that caret is
   * remembered so the dialog inserts there rather than at the live selection.
   */
  const openReuseTab = useCallback(
    (insertContext?: { insertPos?: number }) => {
      pendingReuseInsertPosRef.current = insertContext?.insertPos ?? null;
      setInspectorOpen(true);
      setInspectorTarget('topic');
      setInspectorTab('reuse');
    },
    [setInspectorOpen, setInspectorTarget],
  );

  // Leaving the reuse tab (or re-selecting something) drops the remembered caret: it only ever
  // belongs to the insert-menu invocation that opened the tab.
  useEffect(() => {
    if (inspectorTab !== 'reuse') pendingReuseInsertPosRef.current = null;
  }, [inspectorTab]);

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

      const editor = visualRef.current;
      const pendingPos = pendingReuseInsertPosRef.current;
      pendingReuseInsertPosRef.current = null;
      if (pendingPos !== null) {
        const insertedAtPos =
          editor?.insertReuseAtPos(opts.tagName, pendingPos, opts.attrName, opts.value) ?? false;
        announce(
          insertedAtPos
            ? t('app.conrefInserted', { tag: opts.tagName, attr: opts.attrName, value: opts.value })
            : t('app.conrefCannotInsert', { tag: opts.tagName }),
        );
        return;
      }

      const initialAttrs: RawAttrs = [{ name: opts.attrName, value: opts.value, namespaceURI: null }];
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
    [snapshot, announce, t],
  );

  /** "Make reusable" assigns a unique semantic id, then leaves the attributes panel open for refining. */
  const handleMakeBlockReusable = useCallback(
    (payload: { pos: number; tagName: string; previewText: string }) => {
      const editor = visualRef.current;
      if (!editor) return;
      // One click must produce a usable reuse target: assign a unique semantic id derived from the
      // block's own text, then keep the attributes panel open so the author can refine it.
      const existingIds = collectTopicElementIds(activeTab?.xml ?? '');
      const nextId = generateSemanticElementId(payload.tagName, payload.previewText, existingIds);
      if (!nextId) {
        announce(t('visual.announce.reuseIdPrompt', { tag: payload.tagName }));
        return;
      }
      editor.updateAttr(payload.pos, 'id', nextId);
      editor.selectNode(payload.pos, true);
      setInspectorOpen(true);
      setInspectorTarget('topic');
      setInspectorTab('attributes');
      announce(t('visual.announce.reuseIdAssigned', { tag: payload.tagName, id: nextId }));
    },
    [activeTab, announce, setInspectorOpen, setInspectorTarget, t],
  );

  const handleExtractBlockToReuse = useCallback(
    (payload: { pos: number; tagName: string; previewText: string; fragmentXml: string }) => {
      setReuseDialog({ mode: 'extract', source: payload });
    },
    [],
  );

  const handleOpenCreateSnippet = useCallback(() => {
    setReuseDialog({ mode: 'create' });
  }, []);

  /** The key (if any) the current Root Map binds to `filePath`, so `conkeyref` wins over `conref`. */
  const keyForFile = useCallback(
    (filePath: string): string | null => {
      if (!keyspace) return null;
      const normalize = (value: string) => value.replace(/^\.\//, '').replace(/\\/g, '/');
      const target = normalize(filePath);
      for (const key of Object.values(keyspace.keys)) {
        if (key.isExternal || !key.resolvedHref) continue;
        if (normalize(key.resolvedHref) === target) return key.qualifiedKey;
      }
      return null;
    },
    [keyspace],
  );

  const handleSubmitReuseSnippet = useCallback(
    async (payload: ReuseSnippetSubmission): Promise<{ ok: boolean; error?: string }> => {
      let targetFilePath: string;
      let keyName: string | null = null;

      if (payload.target.kind === 'new') {
        const created = await createWarehouseTopic({
          filePath: payload.target.filePath,
          mountKeyInRootMap: payload.target.mountKeyInRootMap,
          ...(payload.target.title ? { title: payload.target.title } : {}),
          ...(payload.target.keyName ? { keyName: payload.target.keyName } : {}),
        });
        if (!created.ok || !created.filePath) {
          return { ok: false, error: t('reuseDialog.errorGeneric') };
        }
        targetFilePath = created.filePath;
        keyName = created.keyName ?? (payload.target.keyName || null);
      } else {
        targetFilePath = payload.target.filePath;
        keyName = keyForFile(targetFilePath);
      }

      // A reference inserted into the file we are about to rewrite must go in *before* the write:
      // saving an open tab reloads the ProseMirror doc, which would invalidate a remembered caret.
      let insertedBeforeSave = false;
      if (
        payload.mode === 'create' &&
        payload.insertReference &&
        payload.target.kind === 'existing' &&
        targetFilePath === activeTabPath
      ) {
        const handle = visualRef.current;
        const pendingPos = pendingReuseInsertPosRef.current;
        pendingReuseInsertPosRef.current = null;
        const insertPos = pendingPos ?? handle?.getCurrentPmState()?.selection.from ?? null;
        if (handle && insertPos !== null) {
          const early = resolveWarehouseTargetValue({
            keyName,
            activeDocPath: activeTabPath,
            targetFilePath,
            elementId: payload.elementId,
          });
          insertedBeforeSave = handle.insertReuseAtPos(
            payload.tagName,
            insertPos,
            early.attrName,
            early.value,
          );
        }
      }

      const saved = await addReusableFragmentToTopic({
        targetFilePath,
        tagName: payload.tagName,
        elementId: payload.elementId,
        ...(payload.textContent ? { textContent: payload.textContent } : {}),
        ...(payload.fragmentXml ? { fragmentXml: payload.fragmentXml } : {}),
      });
      if (!saved.ok) return { ok: false, error: saved.error };

      const { attrName, value } = resolveWarehouseTargetValue({
        keyName,
        activeDocPath: activeTabPath,
        targetFilePath: saved.filePath,
        elementId: saved.elementId,
      });

      if (payload.mode === 'extract') {
        if (payload.extractAction === 'replace' && payload.sourcePos !== undefined) {
          visualRef.current?.replaceBlockWithReuse(payload.sourcePos, attrName, value);
        }
        return { ok: true };
      }

      if (payload.insertReference && !insertedBeforeSave && visualRef.current) {
        const handle = visualRef.current;
        const pendingPos = pendingReuseInsertPosRef.current;
        pendingReuseInsertPosRef.current = null;
        const caret = handle.getCurrentPmState()?.selection.from ?? null;
        const insertPos = pendingPos ?? caret;
        if (insertPos !== null) {
          handle.insertReuseAtPos(saved.tagName, insertPos, attrName, value);
        }
      }

      return { ok: true };
    },
    [addReusableFragmentToTopic, activeTabPath, createWarehouseTopic, keyForFile, t],
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
      const mapDir = dirnamePosix(parent.mapPath);
      setTopicMountContext({
        mount: {
          mapPath: parent.mapPath,
          parentLabel: parent.parentLabel,
          defaultDir: mapDir ? `${mapDir}/topics` : 'concepts',
          defaultTagName: 'topicref',
        },
        parentPath: parent.parentPath,
      });
      setNewTopicOpen(true);
    },
    [],
  );

  /**
   * Map Tree quick fix: a `topicref` points at a file that does not exist yet. Writing that file
   * needs no map edit, so the node, its `href` and its attributes stay byte-identical.
   */
  const handleCreateMissingTarget = useCallback(
    (node: CompositeMapTreeNode) => {
      if (!node.resolvedTargetPath) return;
      const templateTypes = ['concept', 'task', 'reference', 'topic'] as const;
      const declared = templateTypes.find((type) => type === node.topicType);
      void createMissingMapTarget({
        mapPath: node.ownerMapPath,
        targetPath: node.resolvedTargetPath,
        elementPath: node.elementPath,
        title: node.label,
        topicType: declared ?? 'concept',
        lang: locale === 'en' ? 'en-US' : 'zh-CN',
      });
    },
    [createMissingMapTarget, locale],
  );

  const handleOpenMountExisting = useCallback(
    (parent: { mapPath: string; parentPath: number[] | null; parentLabel: string }) => {
      setMountExistingTarget(parent);
    },
    [],
  );

  /** Phase 14 — open the ingest wizard, optionally mounting the generated topics under a Map node. */
  const handleOpenIngest = useCallback((mount: IngestMountContext | null = null) => {
    setIngestMount(mount);
    setIngestOpen(true);
  }, []);

  /**
   * A finished import already wrote files into the draft overlay: refresh the tree, the map
   * buffers, locks and drafts, then jump into the first generated topic.
   */
  const handleIngestMaterialized = useCallback(
    async (result: IngestJobResult) => {
      await Promise.all([
        useEditorStore.getState().refreshWorkspaceTree().catch(() => undefined),
        useGitStore.getState().refreshAll().catch(() => undefined),
      ]);
      const touchedMaps = [result.mountedMapPath, result.rootMapPath].filter(
        (mapPath): mapPath is string => Boolean(mapPath),
      );
      if (touchedMaps.length > 0) {
        await useEditorStore.getState().reloadFilesFromDisk(touchedMaps).catch(() => undefined);
      }
      const first = result.topics[0];
      if (first) await useEditorStore.getState().openFileTab(first.filePath);
    },
    [],
  );

  const canIngestDocument =
    import.meta.env.VITE_STATIC_DEMO !== 'true' && (currentUser ? currentUser.role !== 'viewer' : false);

  /* Editor-wide shortcut: Ctrl/Cmd + Shift + I opens the import wizard. */
  useEffect(() => {
    if (!canIngestDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== 'i') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      handleOpenIngest(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canIngestDocument, handleOpenIngest]);

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

  /* --------------------------------------------------------------------------
   * Document outline (topic tabs only): a ProseMirror-derived tree in Visual /
   * Split mode and a memoized XML parse in Source-only mode. Nothing here runs
   * while the panel is closed, so the workbench keeps its previous behaviour.
   * -------------------------------------------------------------------------- */
  const showOutlinePane = Boolean(activeTab && activeTab.kind === 'topic' && outlineOpen);
  const outlineSourceXml = showOutlinePane && !showTopicVisual ? (activeTab?.xml ?? null) : null;

  const sourceOutlineParse = useMemo(() => {
    if (outlineSourceXml === null) return null;
    const check = checkXmlWellFormed(outlineSourceXml, { position: true });
    if (!check.ok) return null;
    return { pmDoc: slimdomToPmDoc(check.parsed), domDoc: check.parsed.document };
  }, [outlineSourceXml]);

  const outlinePmDoc: PMNode | null = showOutlinePane
    ? showTopicVisual
      ? (visualDoc ?? visualRef.current?.getCurrentPmState()?.doc ?? null)
      : (sourceOutlineParse?.pmDoc ?? null)
    : null;

  const outlineNodes = useMemo(
    () =>
      outlinePmDoc
        ? buildDocumentOutline(outlinePmDoc, {
            density: outlineDensity,
            taskModel: resolvedTaskModel,
            locale,
          })
        : [],
    [outlinePmDoc, outlineDensity, resolvedTaskModel, locale],
  );
  const outlineNodeMap = useMemo(() => indexOutlineNodes(outlineNodes), [outlineNodes]);

  const activeOutlineId = useMemo(() => {
    if (!showOutlinePane) return null;
    if (showTopicVisual) return resolveActiveOutlineId(snapshot?.breadcrumbs ?? [], outlineNodeMap);
    if (!sourceOutlineParse) return null;
    const path = findElementPathAtOffset(sourceOutlineParse.domDoc, outlineSourceCursorOffset);
    return resolveActiveOutlineIdByPath(path, outlineNodeMap);
  }, [
    showOutlinePane,
    showTopicVisual,
    snapshot?.breadcrumbs,
    outlineNodeMap,
    sourceOutlineParse,
    outlineSourceCursorOffset,
  ]);

  const handleLocateOutlineNode = useCallback(
    (node: OutlineNode) => {
      if (!activeTab) return;
      if (showTopicVisual) {
        visualRef.current?.locateNode(node.pmPos);
        // Split mode keeps the Source pane on the same element instead of leaving it behind.
        if (showSourcePane) {
          const check = checkXmlWellFormed(activeTab.xml, { position: true });
          if (!check.ok) return;
          const element = findDomElementByPath(check.parsed.document, node.elementPath);
          if (!element) return;
          const range = getNodeSourceRange(element);
          if (range.open) requestSourceJump(range.open.start);
        }
        return;
      }
      const domDoc = sourceOutlineParse?.domDoc;
      if (!domDoc) return;
      const element = findDomElementByPath(domDoc, node.elementPath);
      if (!element) return;
      const range = getNodeSourceRange(element);
      if (range.open) requestSourceJump(range.open.start);
    },
    [activeTab, showTopicVisual, showSourcePane, sourceOutlineParse, requestSourceJump],
  );

  const handleEvaluateOutlineDrop = useCallback(
    (sourcePos: number, targetPos: number, placement: OutlineDropPlacement): OutlineDropEvaluation => {
      if (!outlinePmDoc) {
        return { ok: false, placement, sourcePos, targetPos, reason: 'target-not-container' };
      }
      return evaluateOutlineDrop(outlinePmDoc, sourcePos, targetPos, placement, resolvedTaskModel);
    },
    [outlinePmDoc, resolvedTaskModel],
  );

  const handleMoveOutlineNode = useCallback(
    (sourcePos: number, targetPos: number, placement: OutlineDropPlacement): boolean => {
      if (!canEdit) return false;
      if (showTopicVisual) {
        return visualRef.current?.moveOutlineNode(sourcePos, targetPos, placement) ?? false;
      }
      const doc = outlinePmDoc;
      if (!doc) return false;
      // Read the moved element's tag up front: re-evaluating the drop afterwards is both wasteful
      // and wrong, because positions have already shifted inside the new document.
      const sourceNode = doc.nodeAt(sourcePos);
      const sourceTag = sourceNode ? (getPmNodeTagName(sourceNode) ?? '') : '';
      const state = EditorState.create({ doc });
      let nextState = state;
      const moved = moveDitaNodeByOutline(sourcePos, targetPos, placement)(state, (tr) => {
        nextState = state.apply(tr);
      });
      if (!moved) return false;
      const nextXml = pmDocToXml(nextState.doc);
      setSourceReplacementXml(nextXml);
      updateXmlFromSource(nextXml);
      announce(t('outline.announce.moved', { tag: sourceTag }));
      return true;
    },
    [
      canEdit,
      showTopicVisual,
      outlinePmDoc,
      updateXmlFromSource,
      announce,
      t,
    ],
  );

  /* Two button skins: the visual sub-header sits on a light bar, the source toolbar is slate-900. */
  const renderOutlineToggle = (variant: 'light' | 'dark') =>
    activeTab?.kind === 'topic' ? (
      <button
        type="button"
        aria-pressed={outlineOpen}
        aria-label={t('outline.toggle')}
        title={t('outline.toggleTitle')}
        onClick={() => setOutlineOpen(!outlineOpen)}
        className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
          variant === 'dark'
            ? outlineOpen
              ? 'border-sky-500/60 bg-sky-500/15 text-sky-300'
              : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            : outlineOpen
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <ListTree className="h-3 w-3" aria-hidden="true" />
        <span>{t('outline.toggle')}</span>
      </button>
    ) : null;
  /**
   * The inspector is reachable for any open topic tab — including source-only mode, where the
   * AI tab still works on the raw buffer — so collapsing and expanding never dead-ends on a
   * handle that cannot bring the panel back.
   */
  const canShowInspector = inspectorTarget === 'map-node' || activeTab?.kind === 'topic';
  const showRightInspector = inspectorOpen && canShowInspector;
  /** The floating launcher must stay available whenever the panel is not actually on screen. */
  const aiPanelVisible = aiPanelOpen && showRightInspector && inspectorTab === 'ai';

  /** Persisted expand/collapse state of the DITA 1.3 authoring-guide panel. */
  const [guideExpanded, toggleGuideExpanded] = useAuthoringGuideExpanded();
  const activeStructureIssueCount = activeTab
    ? diagnostics.filter((d) => d.filePath === activeTab.path && d.source === 'structure').length
    : 0;
  const showGuideChip = activeTab?.kind === 'topic';
  // The admin state is always editable and offers no action; the owned state keeps its chip so
  // check-in / cancel / release stay on the document toolbar. Every read-only state is covered
  // by the banner above the canvas instead of a chip.
  // Read-only states (not checked out / held by somebody else / viewer) get a full-width
  // banner above the canvas instead of the compact chip, so the canvas is never silently inert.
  const showReadOnlyBanner = workspaceMode === 'api' && Boolean(activeTab) && !canEdit;
  const showLockStatus =
    workspaceMode === 'api' &&
    Boolean(activeTab) &&
    editability.editable &&
    editability.state !== 'admin';
  /** Locks + guide toggle still need a home when the visual toolbar is hidden (source mode, read-only). */
  const showActionRow =
    (showTopicVisual && canEdit) || showGuideChip || showLockStatus || dirtyCount > 0;
  /** In-memory dirty state of the active tab (not the git diff) drives save-active vs save-all. */
  const activeTabDirty = Boolean(activeTab && activeTab.xml !== activeTab.baselineXml);
  const saveControlsNode = showActionRow ? (
    <SaveControls
      dirtyCount={dirtyCount}
      isCurrentDirty={activeTabDirty}
      saving={savingPaths.length > 0}
      readOnly={!canEdit}
      onSave={() => {
        if (activeTabDirty) void saveActiveFile();
        else void saveAllDirtyFiles();
      }}
      onResetBaseline={resetCurrentToBaseline}
    />
  ) : null;
  const lockStatusNode =
    showLockStatus && activeTab ? (
      <LockStatusBar
        variant="inline"
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
    ) : null;

  /**
   * Lock state, assignment chip and the "委派" entry share one slot so they ride on the
   * topic toolbar (visual sub-header, or the action row when there is no visual toolbar).
   */
  const showTopicAssignment = Boolean(
    workspaceMode === 'api' && activeTab && activeTab.kind === 'topic',
  );
  const topicContextNode = (
    <>
      {showTopicAssignment && activeTab ? (
        <TopicAssignmentBanner
          topicPath={activeTab.path}
          topicTitle={activeTab.title}
          currentUserId={currentUser?.id ?? null}
          role={currentUser?.role ?? null}
          candidates={assignableUsers}
          lockedByMe={Boolean(activeLock && currentUser && activeLock.userId === currentUser.id)}
          busy={gitLoading}
          onCheckout={() => void checkoutFile(activeTab.path)}
        />
      ) : null}
      {showDelegateButton && activeTab ? (
        <DelegateTopicButton
          topicPath={activeTab.path}
          topicTitle={activeTab.title}
          candidates={assignableUsers}
          disabled={gitLoading}
        />
      ) : null}
      {lockStatusNode}
    </>
  );

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
                workspaceName={manualName || workspaceName}
                workspaceMode={workspaceMode}
                onOpenWorkspaceDialog={() => setWorkspaceDialogOpen(true)}
                onOpenManualHub={requestLeave}
                mapTreeSlot={
                  <MapTreePanel
                    rootMapPath={activeRootMapPath}
                    mapBuffers={mapBuffers}
                    fileSet={fileSet}
                    topicTitles={topicTitles}
                    topicTypes={topicTypes}
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
                    {...(canIngestDocument
                      ? {
                          onOpenIngestTopic: (parent: IngestMountContext) => handleOpenIngest(parent),
                        }
                      : {})}
                    onInsertStructure={(mapPath, parentPath, tagName) =>
                      insertMapStructureNode({
                        mapPath,
                        parentPath,
                        tagName,
                        navtitle: tagName === 'chapter' ? t('app.newChapter') : t('app.newGroup'),
                      })
                    }
                    onDeleteNode={deleteMapTreeNode}
                    onCreateMissingTarget={handleCreateMissingTarget}
                    onUndoMap={undoMap}
                    onRedoMap={redoMap}
                    onOpenPublish={() => setPublishOpen(true)}
                    viewMode={mapPanelView}
                    onChangeViewMode={setMapPanelView}
                    keyCount={keyCount}
                    keyspaceSlot={
                      <KeyspacePanel
                        embedded
                        rootMapPath={activeRootMapPath}
                        keyspace={keyspace}
                        selectedMapNode={selectedMapNode}
                        canInsertInTopic={Boolean(showTopicVisual && canEdit)}
                        canEditKeys={canManageKeys}
                        onInsertKeyref={(keyName) => {
                          visualRef.current?.toggleInline('keyword', [
                            { name: 'keyref', value: keyName, namespaceURI: null },
                          ]);
                        }}
                        onRenameKey={(def, nextKey) => renameMapKey(def, nextKey)}
                        onUpdateKeyValue={(def, nextValue) => updateMapKeyValue(def, nextValue)}
                        onJumpToKeyDef={(def) =>
                          void jumpToSemanticLocation(def.sourceMapPath, {
                            mode: 'source',
                            line: def.line,
                          })
                        }
                        onInspectKeyDef={(def) => {
                          selectMapNode(
                            { mapPath: def.sourceMapPath, elementPath: def.elementPath },
                            true,
                          );
                          setInspectorOpen(true);
                        }}
                        onDeleteKey={(def) => deleteMapKey(def)}
                        onOpenNewKey={() =>
                          openNewKey({
                            mapPath: activeRootMapPath ?? '',
                            parentPath: null,
                            parentLabel: keyspace?.rootMapPath ?? t('keyspace.title'),
                          })
                        }
                      />
                    }
                  />
                }
                fileExplorerSlot={
                  <FileExplorerPanel
                    files={fileTree}
                    activeTabPath={activeTabPath}
                    activeRootMapPath={activeRootMapPath}
                    projectName={manualName || workspaceName}
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
                    {...(canIngestDocument ? { onImportFromDocument: () => handleOpenIngest(null) } : {})}
                    onCreateFolder={(dir) => void createWorkspaceFolder(dir)}
                    onRenameFile={(from, to) => void renameWorkspaceFile(from, to)}
                    onDeleteFile={(path) => void deleteWorkspaceFile(path)}
                    assignmentBadges={assignmentBadges}
                    onDelegateTopic={
                      currentUser?.role === 'admin' || currentUser?.role === 'writer'
                        ? (path) =>
                            setDelegateTarget({
                              path,
                              title: topicTitles[path] ?? path.split('/').pop() ?? path,
                            })
                        : undefined
                    }
                  />
                }
                gitSlot={
                  <GitPanel
                    activePath={activeTabPath}
                    onOpenDiff={(options) => void openGitDiff(options)}
                    onOpenCheckin={openCheckin}
                    onOpenMerge={() => setMergeDialogOpen(true)}
                  />
                }
                assignmentBadgeCount={openAssignmentCount}
                assignmentsSlot={
                  <ManualAssignmentsPanel
                    onOpenTopic={(assignment) => void openFileTab(assignment.topicPath)}
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
              identity={identity}
              currentUser={currentUser}
              onSwitchIdentity={(userId) => void switchUser(userId)}
              onToggleLeftSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
              onChangeMode={handleChangeMode}
              onToggleProblems={() => setProblemsOpen(!problemsOpen)}
              showInspectorExpand={!showRightInspector && canShowInspector}
              onExpandInspector={() => setInspectorOpen(true)}
              manualName={manualName}
            />

        {/* Single editor action row: formatting toolbar + authoring guide toggle + lock state */}
        {showActionRow ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-1">
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
                onOpenXrefDialog={() => setRefDialogMode('xref')}
                onOpenImageDialog={() => setRefDialogMode('image')}
                onOpenKeyrefDialog={() => setKeyrefDialogOpen(true)}
                onOpenConrefDialog={openReuseTab}
                onTableAction={(action) => visualRef.current?.runTableAction(action)}
              />
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* The save affordance lives on the document toolbar, next to the guide toggle. */}
              {!showVisualPane ? saveControlsNode : null}
              {/* In visual mode the guide toggle lives in the editor sub-header toolbar; the
                  action row only hosts it when there is no visual pane to attach it to. */}
              {showGuideChip && activeTab && !showVisualPane ? (
                <TopicGuideChip
                  docType={activeTab.docType}
                  expanded={guideExpanded}
                  onToggle={toggleGuideExpanded}
                  structureIssueCount={activeStructureIssueCount}
                  onOpenProblems={() => setProblemsOpen(true)}
                />
              ) : null}
              {/* The visual editor hosts the lock/assignment/delegate cluster in its sub-header;
                  the action row only shows it when there is no visual toolbar to attach it to. */}
              {!showVisualPane ? topicContextNode : null}
            </div>
          </div>
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

                    {/* Rejected saves and blocked map edits must be visible, not just announced
                        to the screen-reader status line. */}
                    {alert ? (
                      <WorkbenchAlertBanner
                        alert={alert}
                        busy={savingPaths.length > 0}
                        onDismiss={dismissAlert}
                        onAction={
                          alert.action
                            ? () => {
                                for (const path of alert.action!.paths) {
                                  void saveFileEnsuringLock(path);
                                }
                              }
                            : undefined
                        }
                      />
                    ) : null}

                    {/* Phase 13: another writer saved this file first — the buffer is intact and
                        the user chooses between reloading and overwriting. */}
                    {contentConflict ? (
                      <ContentConflictBanner
                        conflict={contentConflict}
                        busy={savingPaths.length > 0}
                        onReload={() => void resolveContentConflict('reload')}
                        onOverwrite={() => void resolveContentConflict('overwrite')}
                        onDismiss={dismissContentConflict}
                      />
                    ) : null}

                    {showReadOnlyBanner ? (
                      <ReadOnlyBanner
                        editability={editability}
                        lock={activeLock}
                        busy={gitLoading}
                        onCheckout={() => {
                          if (activeTabPath) void checkoutFile(activeTabPath);
                        }}
                        onForceUnlock={
                          activeTabPath
                            ? () => {
                                const reason = window.prompt(
                                  t('app.forceUnlockPrompt', { path: activeTabPath }),
                                  t('app.forceUnlockReason'),
                                );
                                if (reason !== null) void forceUnlockFile(activeTabPath, reason);
                              }
                            : undefined
                        }
                        onRefresh={() => void refreshLocksGit()}
                      />
                    ) : null}

                    {/* Source-only layouts have no visual sub-header to host the expanded guide card. */}
                    {showGuideChip && guideExpanded && !showVisualPane ? (
                      <TopicAuthoringGuide docType={activeTab?.docType ?? 'topic'} />
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
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
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
                              <div className="flex h-full w-full overflow-hidden">
                                {showOutlinePane && activeTab ? (
                                  <>
                                    <div className="h-full shrink-0 overflow-hidden" style={{ width: outlineWidth }}>
                                      <DocumentOutlinePanel
                                        nodes={outlineNodes}
                                        activeNodeId={activeOutlineId}
                                        density={outlineDensity}
                                        onChangeDensity={setOutlineDensity}
                                        readOnly={!canEdit}
                                        xmlError={showTopicVisual ? null : (activeTab.xmlError ?? null)}
                                        onJumpToXmlError={() => {
                                          void openFileTab(activeTab.path, {
                                            mode: 'source',
                                            jumpLine: activeTab.xmlError?.line ?? 1,
                                          });
                                        }}
                                        onLocateNode={handleLocateOutlineNode}
                                        onEvaluateDrop={handleEvaluateOutlineDrop}
                                        onMoveNode={handleMoveOutlineNode}
                                        onCollapse={() => setOutlineOpen(false)}
                                      />
                                    </div>
                                    <div
                                      role="separator"
                                      aria-orientation="vertical"
                                      aria-label={t('outline.resizeAria')}
                                      title={t('outline.resizeAria')}
                                      className="dita-resize-handle w-1 shrink-0 cursor-col-resize"
                                      onPointerDown={handleOutlineResizeStart}
                                    />
                                  </>
                                ) : null}
                                <div className="min-w-0 flex-1 overflow-hidden">
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
                                            canEditKeys={canManageKeys}
                                            onOpenNewKey={(mapPath, title) =>
                                              openNewKey({ mapPath, parentPath: null, parentLabel: title })
                                            }
                                            onInspectNode={(mapPath, elementPath) =>
                                              selectMapNode({ mapPath, elementPath }, true)
                                            }
                                          />
                                        ) : (
                                          <VisualEditor
                                            ref={visualRef}
                                            xml={activeTab.xml}
                                            reloadToken={activeTab.visualReloadToken}
                                            tagDisplayMode={tagDisplayMode}
                                            onChangeTagDisplayMode={setTagDisplayMode}
                                            taskModelSetting={taskModelSetting}
                                            resolvedTaskModel={resolvedTaskModel}
                                            onChangeTaskModelSetting={setTaskModelSetting}
                                            showTaskModelSwitch={showTaskModelSwitch}
                                            pendingJumpPos={pendingVisualPmPos}
                                            onJumpHandled={clearPendingVisualPmPos}
                                            onXmlChange={updateXmlFromVisual}
                                            onSnapshotChange={handleSnapshotChange}
                                            onDocChange={setVisualDoc}
                                            onAiRequest={handleVisualAiRequest}
                                            onOpenXrefDialog={() => setRefDialogMode('xref')}
                                            onOpenConrefDialog={openReuseTab}
                                            onMakeBlockReusable={handleMakeBlockReusable}
                                            onExtractBlockToReuse={handleExtractBlockToReuse}
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
                                            guideSlot={
                                              showGuideChip && activeTab ? (
                                                <TopicGuideChip
                                                  docType={activeTab.docType}
                                                  expanded={guideExpanded}
                                                  onToggle={toggleGuideExpanded}
                                                  structureIssueCount={activeStructureIssueCount}
                                                  onOpenProblems={() => setProblemsOpen(true)}
                                                />
                                              ) : null
                                            }
                                            saveSlot={saveControlsNode}
                                            contextSlot={topicContextNode}
                                            guidePanel={
                                              activeTab?.kind === 'topic' && guideExpanded ? (
                                                <TopicAuthoringGuide docType={activeTab.docType} />
                                              ) : null
                                            }
                                            outlineSlot={renderOutlineToggle('light')}
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
                                            // Only mirror the caret while the outline can use it.
                                            if (outlineOpen && !showTopicVisual) {
                                              setOutlineSourceCursorOffset(offset);
                                            }
                                          }}
                                          outlineSlot={
                                            !showVisualPane && activeTab?.kind === 'topic'
                                              ? renderOutlineToggle('dark')
                                              : null
                                          }
                                          replacementXml={sourceReplacementXml}
                                          onReplacementApplied={handleSourceReplacementApplied}
                                          onAiFixXmlError={handleAiFixXmlError}
                                          onAnnounce={announce}
                                          keyspace={keyspace}
                                          topicIndices={topicIndices}
                                          profilingCatalog={profilingCatalog}
                                          taskModelSetting={taskModelSetting}
                                          resolvedTaskModel={resolvedTaskModel}
                                          onChangeTaskModelSetting={setTaskModelSetting}
                                          showTaskModelSwitch={showTaskModelSwitch}
                                          readOnly={!canEdit}
                                        />
                                      </Panel>
                                    ) : null}
                                  </Group>
                                </div>
                              </div>
                            )}
                            {activeTab?.kind === 'topic' && !aiPanelVisible ? (
                              <button
                                type="button"
                                onClick={() => openAiPanel()}
                                aria-label={t('app.openAiFab')}
                                title={t('app.openAiFabTitle')}
                                className="absolute bottom-4 right-4 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-white/95 text-blue-600 shadow-lg shadow-blue-900/10 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-blue-600 hover:text-white"
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
                              keyspace={keyspace}
                              canEditKeys={canManageKeys}
                              onUpsertKeyText={(mapPath, elementPath, source, value) =>
                                upsertMapNodeKeyText(mapPath, elementPath, source, value)
                              }
                              onOpenNewKey={(parent) => openNewKey(parent)}
                              onOpenKeysView={openKeysView}
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
                              onMakeReusable: handleMakeBlockReusable,
                              onExtractToReuse: handleExtractBlockToReuse,
                              onUpdateAttr: (pos, name, val) =>
                                visualRef.current?.updateAttr(pos, name, val),
                              onSelectBreadcrumb: (pos) => visualRef.current?.selectNode(pos, true),
                              onMoveNode: (pos, dir) => visualRef.current?.moveNode(pos, dir),
                              onDeleteNode: (pos) => visualRef.current?.deleteNode(pos),
                              keyspace,
                              canEditKeys: canManageKeys && Boolean(activeRootMapPath),
                              onOpenNewKey: (options) => {
                                if (!activeRootMapPath) return;
                                openNewKey({
                                  mapPath: activeRootMapPath,
                                  parentPath: null,
                                  parentLabel: keyspace?.rootMapPath ?? t('keyspace.title'),
                                  initialKeyName: options?.initialKeyName,
                                  initialKind: options?.initialKind,
                                  onCreated: options?.onCreated,
                                });
                              },
                              onUpdateKeyValue: (def, nextValue) => updateMapKeyValue(def, nextValue),
                              onInspectKeyDef: (def) => {
                                selectMapNode(
                                  { mapPath: def.sourceMapPath, elementPath: def.elementPath },
                                  true,
                                );
                                setInspectorOpen(true);
                              },
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
                              onCreateSnippet: handleOpenCreateSnippet,
                              onDropAtPoint: (clientX, clientY, payload) =>
                                visualRef.current?.insertReuseAtPoint(clientX, clientY, payload) ??
                                false,
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
                                  applyMode={aiApplyMode}
                                  workspaceMode={workspaceMode}
                                  onOpenCheckin={openCheckin}
                                  onRevalidateStrict={handleRevalidateStrictForPatch}
                                  onRetrySave={() => void handleRetryAiSaveDraft()}
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
        {...(canIngestDocument ? { onImportFromDocument: () => handleOpenIngest(null) } : {})}
      />

      <NewMapDialog
        open={newMapOpen}
        onClose={() => setNewMapOpen(false)}
        onCreate={(opts) => void createNewMapFile(opts)}
      />

      <CreateReusableSnippetDialog
        open={reuseDialog !== null}
        mode={reuseDialog?.mode ?? 'create'}
        source={reuseDialog?.source ?? null}
        activeDocPath={activeTabPath}
        topicFiles={reuseDialog?.mode === 'extract'
          ? reuseTopicFiles.filter((file) => file.path !== activeTabPath)
          : reuseTopicFiles}
        existingIdsByFile={reuseExistingIdsByFile}
        canInsertInActiveDoc={canEdit && Boolean(activeTab) && !isActiveMapTab}
        readOnly={!canEdit}
        activeRootMapPath={activeRootMapPath}
        canManageKeys={canManageKeys}
        onClose={() => setReuseDialog(null)}
        onSubmit={handleSubmitReuseSnippet}
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
        canEditKeys={canManageKeys && Boolean(activeRootMapPath)}
        onRequestCreateKey={({ initialKeyName, onCreated }) => {
          if (!activeRootMapPath) return;
          openNewKey({
            mapPath: activeRootMapPath,
            parentPath: null,
            parentLabel: keyspace?.rootMapPath ?? t('keyspace.title'),
            initialKeyName,
            onCreated,
          });
        }}
        onClose={() => setKeyrefDialogOpen(false)}
        onConfirm={handleConfirmKeyref}
      />

      <NewKeyDialog
        open={Boolean(newKeyRequest)}
        context={newKeyRequest ?? { mapPath: '', parentPath: null }}
        availableMaps={Object.keys(mapBuffers)}
        availableFiles={availableKeyFiles}
        topicTitles={topicTitles}
        keyspace={keyspace}
        onClose={() => setNewKeyRequest(null)}
        onCreate={(options) => createMapKey(options)}
        onCreated={(qualifiedKey) => newKeyRequest?.onCreated?.(qualifiedKey)}
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
        issuesByPath={checkinIssuesByPath}
        onClose={() => setCheckinOpen(false)}
        onStrictValidate={handleCheckinStrictValidate}
        assignedPaths={assignedPaths}
        onJumpToIssue={(issue) => {
          setCheckinOpen(false);
          void openFileTab(issue.filePath, { mode: 'source', jumpLine: issue.line });
        }}
        onAiFixIssue={(issue) => {
          void handleAiFixDiagnostic({
            id: `${issue.filePath}:${issue.line}:${issue.column}:${issue.source}`,
            filePath: issue.filePath,
            line: issue.line,
            column: issue.column,
            severity: issue.severity,
            source: issue.source,
            message: issue.message,
          });
        }}
        onConfirm={async (paths, message, options) => {
          const result = await checkinFiles(paths, message, options);
          if (result) await loadGitHistory(activeTabPath);
          return result !== null;
        }}
      />

      <MergeDialog
        open={mergeDialogOpen}
        onClose={() => setMergeDialogOpen(false)}
      />

      <PublishDialog
        open={publishOpen}
        rootMaps={workspaceMaps}
        ditavals={workspaceDitavals}
        activeRootMapPath={activeRootMapPath}
        activeDitavalPath={activeDitavalPath}
        role={currentUser?.role ?? null}
        onClose={() => setPublishOpen(false)}
        onOpenPluginGuide={desktop ? openPluginGuide : undefined}
      />

      <StrictValidationDialog
        open={strictOpen}
        input={strictInput}
        targetLabel={strictLabel}
        onClose={() => setStrictOpen(false)}
        onJumpToFile={handleJumpFromStrictValidation}
        onAiFixDiagnostic={(diagnostic) => void handleAiFixStrictDiagnostic(diagnostic)}
        aiApplied={strictAiApplied}
        onOpenPluginGuide={desktop ? openPluginGuide : undefined}
      />

      <AiSettingsDialog
        open={aiSettingsOpen}
        initialTab={aiSettingsTab}
        onClose={() => {
          setAiSettingsOpen(false);
          setAiSettingsTab('llm');
        }}
      />

      {desktop ? <DesktopSettingsDialog onOpenParserSettings={openParserSettings} /> : null}

      {canIngestDocument ? (
        <DocumentIngestDialog
          open={ingestOpen}
          origin="editor"
          manualId={manualId}
          {...(branch ? { branch } : {})}
          mountContext={ingestMount}
          defaultTargetMode="multi_topic"
          onClose={() => {
            setIngestOpen(false);
            setIngestMount(null);
          }}
          onOpenSettings={() => {
            setIngestOpen(false);
            openParserSettings();
          }}
          onTopicsMaterialized={(result) => void handleIngestMaterialized(result)}
          onOpenTopic={(filePath) => void openFileTab(filePath)}
        />
      ) : null}

      <AiDiffDialog
        open={aiDiffOpen}
        proposal={aiProposal}
        canApply={aiApplyMode !== 'preview-only'}
        readOnly={aiApplyMode === 'preview-only'}
        applyMode={aiApplyMode}
        workspaceMode={workspaceMode}
        applying={aiApplyOutcome?.status === 'applying'}
        onClose={() => setAiDiffOpen(false)}
        onApply={(patchedXml) => void handleApplyAiProposal(patchedXml)}
      />

      <DelegateTopicDialog
        open={delegateTarget !== null}
        mode="create"
        topicPath={delegateTarget?.path ?? ''}
        topicTitle={delegateTarget?.title ?? null}
        branch={branch}
        candidates={assignableUsers}
        busy={assignmentBusy}
        error={assignmentError}
        onClose={() => setDelegateTarget(null)}
        onSubmit={({ assigneeId, note, dueDate }) => {
          if (!delegateTarget) return;
          void delegate({ topicPath: delegateTarget.path, assigneeId, note, dueDate });
          setDelegateTarget(null);
        }}
      />

      <UnsavedChangesDialog
        open={leaveOpen}
        dirtyCount={dirtyPaths.length}
        saving={leaving}
        error={leaveError}
        onSaveAndLeave={handleSaveAndLeave}
        onSaveWithCheckout={workspaceMode === 'api' ? handleSaveWithCheckoutAndLeave : undefined}
        onDiscardAndLeave={() => void handleDiscardAndLeave()}
        onCancel={() => {
          setLeaveError(null);
          setLeaveOpen(false);
        }}
      />
    </div>
  );
}
