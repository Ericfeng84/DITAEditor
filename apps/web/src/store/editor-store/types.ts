import type {
  DitaFileKind,
  DitaMapTemplateType,
  DitaProfilingAttrName,
  DitaTopicTemplateType,
  DitavalDisplayMode,
  DocumentSemanticOverlay,
  KeyspaceResult,
  ParsedDitaval,
  ResolvedConrefResult,
  TaskContentModelSetting,
  TopicIdIndexEntry,
  XmlParseError,
} from '@dita/core';
import type { CompositeMapTreeNode, MapBufferState } from '../../map-tree/map-tree-utils';
import type {
  WorkspaceDiagnostic,
  WorkspaceDitavalSummary,
  WorkspaceFileNode,
  WorkspaceListItem,
  WorkspaceMapSummary,
  WorkspaceScaffold,
  WorkspaceSnapshot,
} from '../../services/workspace-api';

export type EditorViewMode = 'visual' | 'split' | 'source';
export type TagDisplayMode = 'none' | 'tags' | 'full';
/** `auto` follows each document's DOCTYPE, otherwise the task content model is forced. */
export type { TaskContentModelSetting };
export type LeftSidebarTab = 'map' | 'files' | 'keys' | 'git';
export type InspectorTarget = 'topic' | 'map-node';

export interface OpenEditorTab {
  path: string;
  fileName: string;
  title: string;
  kind: DitaFileKind;
  docType: DitaTopicTemplateType | 'map' | 'bookmap' | 'ditaval' | 'other';
  baselineXml: string;
  xml: string;
  mode: EditorViewMode;
  xmlError: XmlParseError | null;
  switchBlockedReason: string | null;
  visualReloadToken: number;
}

export interface SelectedMapNodeRef {
  mapPath: string;
  elementPath: number[] | null; // null represents the Root Map element itself
}

export interface EditorWorkbenchState {
  // Workspace
  workspaceMode: 'api' | 'memory';
  workspaceRootDir: string;
  workspaceDefaultRootDir: string;
  workspaceName: string;
  workspaceImportsRootDir: string;
  recentWorkspaces: WorkspaceListItem[];
  loadingWorkspaces: boolean;
  fileTree: WorkspaceFileNode[];
  fileSet: Set<string>;
  workspaceMaps: WorkspaceMapSummary[];
  workspaceDitavals: WorkspaceDitavalSummary[];
  topicTitles: Record<string, string>;
  /** Root-element topic type per file path (concept/task/reference/topic) for map-tree icons. */
  topicTypes: Record<string, DitaTopicTemplateType>;
  activeRootMapPath: string | null;
  activeDitavalPath: string | null;
  activeDitaval: ParsedDitaval | null;
  ditavalDisplayMode: DitavalDisplayMode;
  keyspace: KeyspaceResult | null;
  topicIndices: TopicIdIndexEntry[];
  profilingCatalog: Record<DitaProfilingAttrName, string[]>;
  documentOverlays: Record<string, DocumentSemanticOverlay>;
  memoryFiles: Record<string, string>;
  memoryAssets: Record<string, string>;
  mapBuffers: Record<string, MapBufferState>;
  diagnostics: WorkspaceDiagnostic[];
  loadingWorkspace: boolean;
  savingPaths: string[];

  // Multi-tab editor
  openTabs: OpenEditorTab[];
  activeTabPath: string | null;

  // Workbench UI state
  leftSidebarOpen: boolean;
  leftSidebarTab: LeftSidebarTab;
  inspectorOpen: boolean;
  inspectorTarget: InspectorTarget;
  selectedMapNode: SelectedMapNodeRef | null;
  problemsOpen: boolean;
  tagDisplayMode: TagDisplayMode;
  /** Task content model preference: `auto` (per-document DOCTYPE) / `strict` (task.dtd) / `general`. */
  taskModelSetting: TaskContentModelSetting;
  statusMessage: string;
  pendingSourceOffset: number | null;
  pendingVisualPmPos: number | null;

  // Workspace actions
  initWorkspace: () => Promise<void>;
  refreshWorkspaceTree: () => Promise<void>;
  reloadWorkspaceFromSnapshot: (snapshot: WorkspaceSnapshot, statusMessage?: string) => Promise<void>;
  reloadFilesFromDisk: (filePaths: string[]) => Promise<void>;
  openLocalWorkspace: (target: { rootDir: string } | { useDefault: true }) => Promise<void>;
  refreshRecentWorkspaces: () => Promise<void>;
  createBlankWorkspace: (options: {
    name: string;
    parentDir: string;
    scaffold: WorkspaceScaffold;
  }) => Promise<void>;
  forgetRecentWorkspace: (dirPath: string) => Promise<void>;
  importFolderWorkspace: (
    projectName: string,
    files: { path: string; content: string; encoding?: 'utf8' | 'base64' }[],
  ) => Promise<void>;
  restoreOfflineDemo: () => void;
  selectRootMap: (mapPath: string) => Promise<void>;
  selectDitaval: (ditavalPath: string | null) => Promise<void>;
  setDitavalDisplayMode: (mode: DitavalDisplayMode) => void;
  refreshSemantics: () => Promise<void>;
  refreshDocumentOverlay: (filePath: string, overrideXml?: string) => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
  jumpToSemanticLocation: (
    filePath: string,
    options?: { line?: number; elementId?: string; mode?: EditorViewMode },
  ) => Promise<void>;
  resolveConrefPreview: (params: {
    sourceFilePath: string;
    sourceTagName: string;
    attrName: 'conref' | 'conkeyref';
    rawValue: string;
    conrefend?: string;
    sourceTopicId?: string;
    sourceElementId?: string;
  }) => Promise<ResolvedConrefResult>;

  // Multi-tab & file actions
  openFileTab: (
    filePath: string,
    options?: { mode?: EditorViewMode; jumpOffset?: number; jumpLine?: number },
  ) => Promise<void>;
  activateTab: (filePath: string) => void;
  closeTab: (filePath: string) => void;
  closeOtherTabs: (filePath: string) => void;
  closeSavedTabs: () => void;
  saveFile: (filePath: string) => Promise<boolean>;
  saveActiveFile: () => Promise<boolean>;
  saveAllDirtyFiles: () => Promise<void>;
  resetCurrentToBaseline: () => void;

  // Editor mode & content sync
  setMode: (nextMode: EditorViewMode) => boolean;
  updateXmlFromVisual: (xml: string, title?: string | null) => void;
  updateXmlFromSource: (xml: string) => void;
  /** `skipVisualReload` keeps the live ProseMirror history when the editor already applied the doc. */
  applyAiPatchedXml: (
    filePath: string,
    xml: string,
    options?: { skipVisualReload?: boolean },
  ) => boolean;
  setTagDisplayMode: (mode: TagDisplayMode) => void;
  setTaskModelSetting: (setting: TaskContentModelSetting) => void;

  // Map Tree actions
  mutateMapXml: (mapPath: string, nextXml: string, announcement?: string) => void;
  undoMap: (mapPath: string) => void;
  redoMap: (mapPath: string) => void;
  selectMapNode: (ref: SelectedMapNodeRef | null, switchInspector?: boolean) => void;
  moveMapTreeNodes: (
    dragNodes: CompositeMapTreeNode[],
    targetParent: CompositeMapTreeNode | null,
    index: number,
  ) => void;
  createTopicAndMountInMap: (options: {
    mapPath: string;
    parentPath: number[] | null;
    tagName: string;
    topicType: DitaTopicTemplateType;
    id: string;
    title: string;
    lang: string;
    targetDir: string;
  }) => Promise<void>;
  mountExistingFileInMap: (options: {
    mapPath: string;
    parentPath: number[] | null;
    targetFilePath: string;
    tagName: string;
    navtitle?: string;
  }) => void;
  insertMapStructureNode: (options: {
    mapPath: string;
    parentPath: number[] | null;
    tagName: string;
    navtitle?: string;
    keys?: string;
    keydefKeyword?: string;
  }) => void;
  updateMapAttr: (
    mapPath: string,
    elementPath: number[] | null,
    attrName: string,
    value: string | null,
  ) => void;
  updateMapNavtitle: (mapPath: string, elementPath: number[], navtitle: string) => void;
  updateMapRootTitle: (mapPath: string, title: string) => void;
  deleteMapTreeNode: (mapPath: string, elementPath: number[]) => void;
  jumpToMapNodeSource: (mapPath: string, line?: number) => Promise<void>;

  // Standalone File / Folder / Import CRUD
  createStandaloneTopic: (
    type: DitaTopicTemplateType,
    id: string,
    title: string,
    lang: string,
    targetDir?: string,
  ) => Promise<void>;
  createNewMapFile: (options: {
    kind: DitaMapTemplateType;
    fileName: string;
    id: string;
    title: string;
    lang: string;
    targetDir?: string;
  }) => Promise<void>;
  importSingleLocalFile: (fileName: string, content: string) => Promise<void>;
  createWorkspaceFolder: (dirPath: string) => Promise<void>;
  renameWorkspaceFile: (fromPath: string, toPath: string) => Promise<void>;
  deleteWorkspaceFile: (filePath: string) => Promise<void>;

  // Layout & Cursor Jump UI state
  setLeftSidebarOpen: (open: boolean) => void;
  setLeftSidebarTab: (tab: LeftSidebarTab) => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTarget: (target: InspectorTarget) => void;
  setProblemsOpen: (open: boolean) => void;
  announce: (msg: string) => void;
  clearPendingSourceOffset: () => void;
  clearPendingVisualPmPos: () => void;
  requestSourceJump: (offset: number) => void;
  requestVisualJump: (pmPos: number) => void;
  clearSwitchBlockedReason: () => void;
}

type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never;
}[keyof T];

/** The data half of the workbench state: everything except the action functions. */
export type EditorStateValues = Omit<EditorWorkbenchState, FunctionKeys<EditorWorkbenchState>>;

/** Minimal zustand `set` surface every slice/runtime needs. */
export type StoreSet = (
  partial:
    | Partial<EditorWorkbenchState>
    | ((state: EditorWorkbenchState) => Partial<EditorWorkbenchState>),
) => void;

export type StoreGet = () => EditorWorkbenchState;
