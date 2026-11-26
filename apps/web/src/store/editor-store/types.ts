import type {
  DitaFileKind,
  DitaMapTemplateType,
  DitaProfilingAttrName,
  DitaTopicTemplateType,
  DitavalDisplayMode,
  DocumentSemanticOverlay,
  KeyDefinition,
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
export type LeftSidebarTab = 'map' | 'files' | 'keys' | 'git' | 'assignments';
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
  /** Phase 13: hash of the bytes this buffer was read from / last saved to (`expectedHash`). */
  contentHash?: string | null;
}

export interface SelectedMapNodeRef {
  mapPath: string;
  elementPath: number[] | null; // null represents the Root Map element itself
}

/** One failed save attempt, kept so dialogs can show the server's real reason. */
export interface SaveFailure {
  path: string;
  message: string;
}

/** Recovery offered from the alert banner (currently: take the check-out lock, then save). */
export interface WorkbenchAlertAction {
  kind: 'save-with-checkout';
  paths: string[];
}

/**
 * A blocking problem that must not be hidden in the screen-reader-only status line:
 * a rejected save, or a map/structure edit that could not take its check-out lock.
 */
/**
 * Phase 13 optimistic-concurrency conflict: another writer (or another browser tab) saved the
 * same file first, so this buffer's save was rejected with `409 files.staleContent`.
 *
 * The user chooses explicitly — load the newer server version, or overwrite it.
 */
export interface ContentConflict {
  path: string;
  message: string;
  /** Hash the server reported as current (best effort; `null` when absent). */
  currentHash: string | null;
  /** Hash this buffer was based on, when known. */
  baseHash: string | null;
}

export interface WorkbenchAlert {
  id: number;
  tone: 'error' | 'warning';
  message: string;
  action?: WorkbenchAlertAction;
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
  /** Unsolved, user-visible problem (rejected save / rejected map edit). */
  alert: WorkbenchAlert | null;
  /** Phase 13: another writer saved the open file first — reload or overwrite explicitly. */
  contentConflict: ContentConflict | null;
  /** Failures of the most recent save attempt, with the API's localized reason. */
  lastSaveFailures: SaveFailure[];
  pendingSourceOffset: number | null;
  pendingVisualPmPos: number | null;

  // Workspace actions
  /**
   * Boot the session. `options.topicPath` is the Phase 10 deep link target
   * (`/manuals/:id?topic=…`); the manual/branch themselves arrive via request headers.
   */
  initWorkspace: (options?: { topicPath?: string | null }) => Promise<void>;
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
  saveFile: (
    filePath: string,
    options?: { refresh?: boolean; force?: boolean },
  ) => Promise<boolean>;
  saveActiveFile: () => Promise<boolean>;
  /**
   * Saves one file, taking its check-out lock first when the API workspace requires one.
   * On failure the reason is surfaced through `alert` (with a retry action).
   */
  saveFileEnsuringLock: (
    filePath: string,
    options?: { refresh?: boolean; force?: boolean },
  ) => Promise<boolean>;
  /**
   * Saves several files, taking each missing check-out lock first.
   * @returns the paths that failed to save (empty when everything landed).
   */
  saveFilesEnsuringLocks: (
    filePaths: string[],
    options?: { refresh?: boolean; force?: boolean },
  ) => Promise<string[]>;
  /** True when the file has edits that are not on disk yet (tab or map buffer). */
  isPathDirty: (filePath: string) => boolean;
  /**
   * Saves every dirty tab and map buffer.
   * `ensureLocks` takes the check-out lock for files the current user has not locked yet.
   * @returns the paths that failed to save (empty when everything landed).
   */
  saveAllDirtyFiles: (options?: { refresh?: boolean; ensureLocks?: boolean }) => Promise<string[]>;
  dismissAlert: () => void;
  /** Phase 13: drop the stale-content banner without touching the buffer. */
  dismissContentConflict: () => void;
  /**
   * Resolve a stale-content conflict:
   * - `reload` replaces the buffer with the newer server content (local edits are discarded);
   * - `overwrite` saves this buffer on top of the server version (no `expectedHash`).
   */
  resolveContentConflict: (strategy: 'reload' | 'overwrite') => Promise<boolean>;
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
  /**
   * Makes sure the current user may write this map (memory mode, admin, or holds the lock;
   * otherwise the check-out is taken first). Returns false when the edit must not proceed and
   * already reported why through `alert`.
   */
  ensureMapEditable: (mapPath: string) => Promise<boolean>;
  undoMap: (mapPath: string) => void;
  redoMap: (mapPath: string) => void;
  selectMapNode: (ref: SelectedMapNodeRef | null, switchInspector?: boolean) => void;
  moveMapTreeNodes: (
    dragNodes: CompositeMapTreeNode[],
    targetParent: CompositeMapTreeNode | null,
    index: number,
  ) => Promise<void>;
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
  /**
   * Creates the file a dangling `topicref` points at, leaving the node and its `href` untouched.
   * One-click repair for the Map Tree “target not created yet” state; writing the file needs no
   * map edit, so it never checks out or rewrites the map itself.
   */
  createMissingMapTarget: (options: {
    mapPath: string;
    targetPath: string;
    elementPath: number[];
    title: string;
    topicType: DitaTopicTemplateType;
    lang: string;
  }) => Promise<void>;
  mountExistingFileInMap: (options: {
    mapPath: string;
    parentPath: number[] | null;
    targetFilePath: string;
    tagName: string;
    navtitle?: string;
  }) => Promise<void>;
  insertMapStructureNode: (options: {
    mapPath: string;
    parentPath: number[] | null;
    tagName: string;
    navtitle?: string;
    keys?: string;
    keydefKeyword?: string;
  }) => Promise<void>;
  updateMapAttr: (
    mapPath: string,
    elementPath: number[] | null,
    attrName: string,
    value: string | null,
  ) => Promise<void>;
  updateMapNavtitle: (mapPath: string, elementPath: number[], navtitle: string) => Promise<void>;
  /**
   * Rename the `keys` token of one Keyspace definition in its source map.
   * Returns false when the definition is no longer present (map unloaded / key already renamed)
   * or when the source map could not be checked out for editing.
   */
  renameMapKey: (def: KeyDefinition, nextKey: string) => Promise<boolean>;
  /**
   * Rewrite the displayed value of one Keyspace definition (keyword/linktext/navtitle text or `@href`)
   * directly in its source map. Returns false when the value cannot be rewritten losslessly
   * or when the source map could not be checked out for editing.
   */
  updateMapKeyValue: (def: KeyDefinition, nextValue: string) => Promise<boolean>;
  updateMapRootTitle: (mapPath: string, title: string) => Promise<void>;
  deleteMapTreeNode: (mapPath: string, elementPath: number[]) => Promise<void>;
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
