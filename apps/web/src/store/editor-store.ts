import { create } from 'zustand';
import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  computeRelativeDitaHref,
  createMapTemplate,
  createTopicTemplate,
  deleteMapNode,
  DITA_MAP_CONTAINER_NODE_TAGS,
  DitaSemanticIndex,
  extractDitaDocumentTitle,
  findPmPosByDitaId,
  insertMapNode,
  parseDitaMap,
  resolveDitaHref,
  updateMapNodeAttr,
  updateMapNodeNavtitle,
  updateMapTitle,
  xmlToPmDoc,
  type DitaFileKind,
  type DitaMapTemplateType,
  type DitaProfilingAttrName,
  type DitaTopicTemplateType,
  type DitavalDisplayMode,
  type DocumentSemanticOverlay,
  type KeyspaceResult,
  type ParsedDitaval,
  type ResolvedConrefResult,
  type TopicIdIndexEntry,
  type XmlAttributeEntry,
  type XmlParseError,
} from '@dita/core';
import { computeXmlLineDiffStats } from '../editor/bridge/xml-bridge';
import { resolveFileEditability, type LockLike } from '../services/lock-helpers';
import type { IdentityRole } from '../services/identity-api';
import {
  planMapNodeMove,
  type CompositeMapTreeNode,
  type MapBufferState,
} from '../map-tree/map-tree-utils';
import {
  buildSnapshotFromMemoryFiles,
  createInMemoryDemoWorkspace,
  createWorkspaceDir,
  createWorkspaceFile,
  createWorkspaceProject,
  deleteWorkspaceEntry,
  fetchFileContent,
  fetchParsedDitaval,
  fetchSemanticContext,
  fetchWorkspace,
  fetchWorkspaceDiagnostics,
  fetchWorkspaces,
  forgetWorkspaceProject,
  importWorkspaceProject,
  openWorkspaceDir,
  renameWorkspaceEntry,
  resolveDocumentSemantics,
  resolveSingleConref,
  saveFileContent,
  type WorkspaceDiagnostic,
  type WorkspaceDitavalSummary,
  type WorkspaceFileNode,
  type WorkspaceListItem,
  type WorkspaceMapSummary,
  type WorkspaceScaffold,
  type WorkspaceSnapshot,
} from '../services/workspace-api';

export type EditorViewMode = 'visual' | 'split' | 'source';
export type TagDisplayMode = 'none' | 'tags' | 'full';
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
  updateXmlFromVisual: (xml: string) => void;
  updateXmlFromSource: (xml: string) => void;
  /** `skipVisualReload` keeps the live ProseMirror history when the editor already applied the doc. */
  applyAiPatchedXml: (
    filePath: string,
    xml: string,
    options?: { skipVisualReload?: boolean },
  ) => boolean;
  setTagDisplayMode: (mode: TagDisplayMode) => void;

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

function collectFileSetFromTree(nodes: readonly WorkspaceFileNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (list: readonly WorkspaceFileNode[]) => {
    for (const n of list) {
      if (n.kind === 'directory') {
        if (n.children) walk(n.children);
      } else {
        set.add(n.path);
      }
    }
  };
  walk(nodes);
  return set;
}

function detectTopicTypeFromXml(xml: string, fallbackKind: DitaFileKind): OpenEditorTab['docType'] {
  if (fallbackKind === 'bookmap') return 'bookmap';
  if (fallbackKind === 'ditamap') return 'map';
  if (fallbackKind === 'ditaval') return 'ditaval';
  const m = /<(concept|task|reference|topic|map|bookmap)\b/.exec(xml);
  if (
    m &&
    (m[1] === 'concept' ||
      m[1] === 'task' ||
      m[1] === 'reference' ||
      m[1] === 'topic' ||
      m[1] === 'map' ||
      m[1] === 'bookmap')
  ) {
    return m[1];
  }
  return 'topic';
}

function extractTitleSafe(xml: string, fallback: string): string {
  return extractDitaDocumentTitle(xml) ?? fallback;
}

function lineNumberToOffset(text: string, line: number): number {
  if (line <= 1) return 0;
  let current = 1;
  let idx = 0;
  while (current < line && idx < text.length) {
    const nl = text.indexOf('\n', idx);
    if (nl === -1) return text.length;
    idx = nl + 1;
    current++;
  }
  return idx;
}

const EMPTY_PROFILING_CATALOG: Record<DitaProfilingAttrName, string[]> = {
  audience: [],
  platform: [],
  product: [],
  otherprops: [],
  props: [],
  rev: [],
};

const memorySemanticIndex = new DitaSemanticIndex();
let overlayDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function computeMemoryDiagnostics(
  files: Record<string, string>,
  assets: Record<string, string>,
  rootMapPath: string | null,
): WorkspaceDiagnostic[] {
  memorySemanticIndex.loadFiles(files);
  return memorySemanticIndex.collectSemanticDiagnostics(rootMapPath, {
    assetPaths: new Set(Object.keys(assets)),
  });
}

const initialMemoryDemo = createInMemoryDemoWorkspace();
const initialFileSet = collectFileSetFromTree(initialMemoryDemo.snapshot.files);
memorySemanticIndex.loadFiles(initialMemoryDemo.files);

export const useEditorStore = create<EditorWorkbenchState>((set, get) => {
  const applySnapshotToState = (snapshot: WorkspaceSnapshot) => {
    const nextFileSet = collectFileSetFromTree(snapshot.files);
    set({
      workspaceRootDir: snapshot.rootDir,
      workspaceDefaultRootDir: snapshot.defaultRootDir,
      workspaceName: snapshot.name,
      fileTree: snapshot.files,
      fileSet: nextFileSet,
      workspaceMaps: snapshot.maps,
      workspaceDitavals: snapshot.ditavals ?? [],
      topicTitles: snapshot.topicTitles,
    });
    return nextFileSet;
  };

  const readTextFromActiveSource = async (filePath: string): Promise<string | null> => {
    const state = get();
    // Prefer open tab or loaded map buffer if already in memory
    const openTab = state.openTabs.find((t) => t.path === filePath);
    if (openTab) return openTab.xml;
    const mapBuf = state.mapBuffers[filePath];
    if (mapBuf) return mapBuf.xml;

    if (state.workspaceMode === 'memory') {
      return state.memoryFiles[filePath] ?? null;
    }

    try {
      const res = await fetchFileContent(filePath);
      return res.content;
    } catch {
      return null;
    }
  };

  const loadMapTreeBuffers = async (rootMapPath: string, forceReload = false) => {
    const visited = new Set<string>();
    const nextBuffers: Record<string, MapBufferState> = { ...get().mapBuffers };

    const loadRecursive = async (mapPath: string) => {
      if (visited.has(mapPath)) return;
      visited.add(mapPath);

      const existing = nextBuffers[mapPath];
      let xml: string | null = existing && !forceReload ? existing.xml : null;

      if (xml === null) {
        if (get().workspaceMode === 'memory') {
          xml = get().memoryFiles[mapPath] ?? null;
        } else {
          try {
            const res = await fetchFileContent(mapPath);
            xml = res.content;
          } catch {
            xml = null;
          }
        }
      }

      if (xml === null) return;

      const check = checkXmlWellFormed(xml, { position: false });
      if (!existing || forceReload) {
        nextBuffers[mapPath] = {
          path: mapPath,
          baselineXml: existing?.baselineXml ?? xml,
          xml,
          undoStack: existing?.undoStack ?? [],
          redoStack: existing?.redoStack ?? [],
          xmlError: check.ok ? null : check.error,
        };
      }

      if (check.ok) {
        try {
          const parsed = parseDitaMap(xml);
          for (const ref of parsed.references) {
            if (!ref.isSubmapRef) continue;
            const resolved = resolveDitaHref(mapPath, ref.href);
            if (!resolved.isExternal && !resolved.escapesRoot && resolved.targetPath) {
              await loadRecursive(resolved.targetPath);
            }
          }
        } catch {
          // ignore non-map roots
        }
      }
    };

    await loadRecursive(rootMapPath);
    set({ mapBuffers: nextBuffers });
  };

  const findFirstTopicInWorkspace = (
    mapXml: string | null,
    mapPath: string | null,
    fileSet: Set<string>,
  ): string | null => {
    if (mapXml && mapPath) {
      try {
        const parsed = parseDitaMap(mapXml);
        for (const ref of parsed.references) {
          if (ref.isSubmapRef) continue;
          const res = resolveDitaHref(mapPath, ref.href);
          if (!res.isExternal && !res.escapesRoot && res.targetPath && fileSet.has(res.targetPath)) {
            const kind = classifyDitaFileKind(res.targetPath);
            if (kind === 'topic') return res.targetPath;
          }
        }
      } catch {
        // fallback below
      }
    }
    for (const path of fileSet) {
      if (classifyDitaFileKind(path) === 'topic') return path;
    }
    return mapPath;
  };

  /** Adopt an API workspace snapshot and open its first map/topic. */
  const adoptApiWorkspaceSnapshot = async (
    snapshot: WorkspaceSnapshot,
    statusMessage: string,
  ): Promise<void> => {
    const fSet = applySnapshotToState(snapshot);
    const firstMap = snapshot.maps[0]?.path ?? null;
    set({
      workspaceMode: 'api',
      mapBuffers: {},
      openTabs: [],
      activeTabPath: null,
      activeRootMapPath: firstMap,
      activeDitavalPath: null,
      activeDitaval: null,
      documentOverlays: {},
      selectedMapNode: firstMap ? { mapPath: firstMap, elementPath: null } : null,
      loadingWorkspace: false,
      statusMessage,
    });

    if (firstMap) {
      await loadMapTreeBuffers(firstMap, true);
      const firstTopic = findFirstTopicInWorkspace(
        get().mapBuffers[firstMap]?.xml ?? null,
        firstMap,
        fSet,
      );
      if (firstTopic) await get().openFileTab(firstTopic);
    } else {
      const firstTopic = findFirstTopicInWorkspace(null, null, fSet);
      if (firstTopic) await get().openFileTab(firstTopic);
    }

    await get().refreshSemantics();
    await get().refreshDiagnostics();
    await get().refreshRecentWorkspaces().catch(() => undefined);
  };

  const activateMemoryFallback = (reason?: string) => {
    const demo = createInMemoryDemoWorkspace();
    const fSet = collectFileSetFromTree(demo.snapshot.files);
    const defaultRootMap = demo.snapshot.maps[0]?.path ?? null;
    memorySemanticIndex.loadFiles(demo.files);

    set({
      workspaceMode: 'memory',
      workspaceRootDir: demo.snapshot.rootDir,
      workspaceDefaultRootDir: demo.snapshot.rootDir,
      workspaceName: demo.snapshot.name,
      fileTree: demo.snapshot.files,
      fileSet: fSet,
      workspaceMaps: demo.snapshot.maps,
      workspaceDitavals: demo.snapshot.ditavals,
      topicTitles: demo.snapshot.topicTitles,
      activeRootMapPath: defaultRootMap,
      activeDitavalPath: null,
      activeDitaval: null,
      keyspace: defaultRootMap ? memorySemanticIndex.getKeyspace(defaultRootMap) : null,
      topicIndices: memorySemanticIndex.getAllTopicIndices(),
      profilingCatalog: memorySemanticIndex.getProfilingCatalog(),
      documentOverlays: {},
      memoryFiles: { ...demo.files },
      memoryAssets: { ...demo.assets },
      mapBuffers: {},
      openTabs: [],
      activeTabPath: null,
      loadingWorkspace: false,
      statusMessage: reason ?? '已加载离线示例工作区',
    });

    if (defaultRootMap) {
      void get()
        .selectRootMap(defaultRootMap)
        .then(async () => {
          const firstTopic = findFirstTopicInWorkspace(
            demo.files[defaultRootMap] ?? null,
            defaultRootMap,
            fSet,
          );
          if (firstTopic) {
            await get().openFileTab(firstTopic);
          }
          await get().refreshDiagnostics();
        });
    }
  };

  return {
    workspaceMode: 'memory',
    workspaceRootDir: initialMemoryDemo.snapshot.rootDir,
    workspaceDefaultRootDir: initialMemoryDemo.snapshot.rootDir,
    workspaceName: initialMemoryDemo.snapshot.name,
    workspaceImportsRootDir: '',
    recentWorkspaces: [],
    loadingWorkspaces: false,
    fileTree: initialMemoryDemo.snapshot.files,
    fileSet: initialFileSet,
    workspaceMaps: initialMemoryDemo.snapshot.maps,
    workspaceDitavals: initialMemoryDemo.snapshot.ditavals,
    topicTitles: initialMemoryDemo.snapshot.topicTitles,
    activeRootMapPath: initialMemoryDemo.snapshot.maps[0]?.path ?? null,
    activeDitavalPath: null,
    activeDitaval: null,
    ditavalDisplayMode: 'dim-excluded',
    keyspace: initialMemoryDemo.snapshot.maps[0]?.path
      ? memorySemanticIndex.getKeyspace(initialMemoryDemo.snapshot.maps[0]!.path)
      : null,
    topicIndices: memorySemanticIndex.getAllTopicIndices(),
    profilingCatalog: memorySemanticIndex.getProfilingCatalog(),
    documentOverlays: {},
    memoryFiles: { ...initialMemoryDemo.files },
    memoryAssets: { ...initialMemoryDemo.assets },
    mapBuffers: {},
    diagnostics: [],
    loadingWorkspace: false,
    savingPaths: [],

    openTabs: [],
    activeTabPath: null,

    leftSidebarOpen: true,
    leftSidebarTab: 'map',
    inspectorOpen: true,
    inspectorTarget: 'topic',
    selectedMapNode: null,
    problemsOpen: false,
    tagDisplayMode: 'full',
    statusMessage: '',
    pendingSourceOffset: null,
    pendingVisualPmPos: null,

    async initWorkspace() {
      if (import.meta.env.VITE_STATIC_DEMO === 'true') {
        activateMemoryFallback(
          '已进入纯前端离线工作台（GitHub Pages 演示版：支持多文件 Map 树、双模编辑与 Keys/Conref/DITAVAL；Git/发布与 AI 需自托管 Docker）',
        );
        return;
      }
      set({ loadingWorkspace: true });
      try {
        const snapshot = await fetchWorkspace();
        const fSet = applySnapshotToState(snapshot);
        const firstMap =
          snapshot.maps.find((m) => m.path.endsWith('.ditamap') && !m.path.includes('/'))?.path ??
          snapshot.maps[0]?.path ??
          null;

        set({
          workspaceMode: 'api',
          mapBuffers: {},
          openTabs: [],
          activeTabPath: null,
          activeRootMapPath: firstMap,
          activeDitavalPath: null,
          activeDitaval: null,
          documentOverlays: {},
          selectedMapNode: firstMap ? { mapPath: firstMap, elementPath: null } : null,
          loadingWorkspace: false,
          statusMessage: `已连接本地工作区：${snapshot.name}（${snapshot.stats.totalTopics} 篇 Topic，${snapshot.stats.totalMaps} 个 Map）`,
        });

        if (firstMap) {
          await loadMapTreeBuffers(firstMap, true);
          const rootXml = get().mapBuffers[firstMap]?.xml ?? null;
          const firstTopic = findFirstTopicInWorkspace(rootXml, firstMap, fSet);
          if (firstTopic) {
            await get().openFileTab(firstTopic);
          }
        } else {
          const firstTopic = findFirstTopicInWorkspace(null, null, fSet);
          if (firstTopic) await get().openFileTab(firstTopic);
        }
        await get().refreshSemantics();
        await get().refreshDiagnostics();
      } catch {
        activateMemoryFallback('未检测到本地 API 服务，已启用内置多文件离线示例工作区');
      }
    },

    async refreshWorkspaceTree() {
      const state = get();
      if (state.workspaceMode === 'memory') {
        const snap = buildSnapshotFromMemoryFiles(
          state.workspaceName,
          state.memoryFiles,
          state.memoryAssets,
        );
        applySnapshotToState(snap);
        return;
      }
      const snap = await fetchWorkspace();
      applySnapshotToState(snap);
    },

    async reloadWorkspaceFromSnapshot(snapshot, statusMessage) {
      const previousActive = get().activeTabPath;
      const fSet = applySnapshotToState(snapshot);
      const firstMap = snapshot.maps[0]?.path ?? null;
      const nextRootMap =
        get().activeRootMapPath && fSet.has(get().activeRootMapPath!)
          ? get().activeRootMapPath
          : firstMap;
      set({
        workspaceMode: 'api',
        mapBuffers: {},
        openTabs: [],
        activeTabPath: null,
        activeRootMapPath: nextRootMap,
        activeDitavalPath: null,
        activeDitaval: null,
        documentOverlays: {},
        selectedMapNode: nextRootMap ? { mapPath: nextRootMap, elementPath: null } : null,
        loadingWorkspace: false,
        statusMessage: statusMessage ?? `已切换到分支工作区：${snapshot.rootDir}`,
      });

      if (nextRootMap) {
        await loadMapTreeBuffers(nextRootMap, true);
        const preferred =
          previousActive && fSet.has(previousActive) ? previousActive : null;
        const firstTopic = preferred ?? findFirstTopicInWorkspace(
          get().mapBuffers[nextRootMap]?.xml ?? null,
          nextRootMap,
          fSet,
        );
        if (firstTopic) await get().openFileTab(firstTopic);
      } else {
        const firstTopic = findFirstTopicInWorkspace(null, null, fSet);
        if (firstTopic) await get().openFileTab(firstTopic);
      }

      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    async reloadFilesFromDisk(filePaths) {
      if (get().workspaceMode === 'memory') return;
      const uniquePaths = Array.from(new Set(filePaths));
      const tabs = get().openTabs;
      const buffers = get().mapBuffers;
      const nextTabs = [...tabs];
      const nextBuffers = { ...buffers };

      for (const filePath of uniquePaths) {
        let content: string;
        try {
          const res = await fetchFileContent(filePath);
          content = res.content;
        } catch {
          continue;
        }
        const check = checkXmlWellFormed(content, { position: false });
        const xmlError = check.ok ? null : check.error;
        const tabIndex = nextTabs.findIndex((tab) => tab.path === filePath);
        if (tabIndex >= 0) {
          const tab = nextTabs[tabIndex]!;
          nextTabs[tabIndex] = {
            ...tab,
            xml: content,
            baselineXml: content,
            xmlError,
            switchBlockedReason: null,
            visualReloadToken: tab.visualReloadToken + 1,
            title: extractTitleSafe(content, tab.fileName),
          };
        }
        if (nextBuffers[filePath]) {
          const buffer = nextBuffers[filePath]!;
          nextBuffers[filePath] = {
            ...buffer,
            xml: content,
            baselineXml: content,
            undoStack: [],
            redoStack: [],
            xmlError,
          };
        }
      }

      set({
        openTabs: nextTabs,
        mapBuffers: nextBuffers,
        statusMessage: `已从磁盘重新加载 ${uniquePaths.length} 个文件`,
      });
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    async openLocalWorkspace(target) {
      set({ loadingWorkspace: true });
      try {
        const snapshot = await openWorkspaceDir(target);
        await adoptApiWorkspaceSnapshot(snapshot, `已打开本地项目：${snapshot.name}`);
      } catch (err) {
        set({
          loadingWorkspace: false,
          statusMessage: `打开目录失败：${err instanceof Error ? err.message : String(err)}`,
        });
        throw err;
      }
    },

    async refreshRecentWorkspaces() {
      if (get().workspaceMode !== 'api') {
        set({ recentWorkspaces: [], loadingWorkspaces: false });
        return;
      }
      set({ loadingWorkspaces: true });
      try {
        const snapshot = await fetchWorkspaces();
        set({
          recentWorkspaces: snapshot.workspaces,
          workspaceImportsRootDir: snapshot.importsRootDir,
          loadingWorkspaces: false,
        });
      } catch {
        set({ recentWorkspaces: [], loadingWorkspaces: false });
      }
    },

    async createBlankWorkspace(options) {
      set({ loadingWorkspace: true });
      try {
        const snapshot = await createWorkspaceProject(options);
        await adoptApiWorkspaceSnapshot(
          snapshot,
          `已创建空白工作区：${snapshot.name}（${snapshot.rootDir}）`,
        );
      } catch (err) {
        set({ loadingWorkspace: false });
        throw err;
      }
    },

    async forgetRecentWorkspace(dirPath) {
      try {
        const res = await forgetWorkspaceProject(dirPath);
        set({ recentWorkspaces: res.workspaces });
      } catch {
        // Ignore bookkeeping failures; the workspace itself is untouched.
      }
    },

    async importFolderWorkspace(projectName, files) {
      set({ loadingWorkspace: true });
      if (get().workspaceMode === 'api') {
        try {
          const snapshot = await importWorkspaceProject(projectName, files);
          await adoptApiWorkspaceSnapshot(
            snapshot,
            `已导入本地文件夹项目：${projectName}（${snapshot.stats.totalTopics} 个主题）`,
          );
          return;
        } catch {
          // Fallback to memory import if API is offline
        }
      }

      const nextFiles: Record<string, string> = {};
      const nextAssets: Record<string, string> = {};
      for (const f of files) {
        const kind = classifyDitaFileKind(f.path);
        if (kind === 'image' && f.encoding === 'base64') {
          const ext = f.path.split('.').pop()?.toLowerCase() ?? 'png';
          const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          nextAssets[f.path] = `data:${mime};base64,${f.content}`;
        } else if (f.encoding !== 'base64') {
          nextFiles[f.path] = f.content;
        }
      }
      const snap = buildSnapshotFromMemoryFiles(projectName, nextFiles, nextAssets);
      const fSet = applySnapshotToState(snap);
      const firstMap = snap.maps[0]?.path ?? null;
      memorySemanticIndex.loadFiles(nextFiles);
      set({
        workspaceMode: 'memory',
        memoryFiles: nextFiles,
        memoryAssets: nextAssets,
        mapBuffers: {},
        openTabs: [],
        activeTabPath: null,
        activeRootMapPath: firstMap,
        activeDitavalPath: null,
        activeDitaval: null,
        documentOverlays: {},
        loadingWorkspace: false,
        statusMessage: `已在离线内存工作区导入项目：${projectName}`,
      });
      if (firstMap) {
        await loadMapTreeBuffers(firstMap, true);
        const firstTopic = findFirstTopicInWorkspace(nextFiles[firstMap] ?? null, firstMap, fSet);
        if (firstTopic) await get().openFileTab(firstTopic);
      }
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    restoreOfflineDemo() {
      activateMemoryFallback('已恢复内置多文件离线示例工作区');
    },

    async selectRootMap(mapPath) {
      set({
        activeRootMapPath: mapPath,
        selectedMapNode: { mapPath, elementPath: null },
        statusMessage: `已激活 Root Map：${mapPath}`,
      });
      await loadMapTreeBuffers(mapPath, false);
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    async selectDitaval(ditavalPath) {
      if (!ditavalPath) {
        set({
          activeDitavalPath: null,
          activeDitaval: null,
          statusMessage: '已关闭 DITAVAL 条件过滤（显示完整文档）',
        });
        return;
      }

      const state = get();
      if (state.workspaceMode === 'memory') {
        const dv = memorySemanticIndex.getDitaval(ditavalPath);
        if (!dv) {
          set({ statusMessage: `未找到 DITAVAL 文件：${ditavalPath}` });
          return;
        }
        if (!dv.ok) {
          set({
            activeDitavalPath: ditavalPath,
            activeDitaval: null,
            statusMessage: `DITAVAL 解析失败：${dv.error.message}`,
          });
          return;
        }
        set({
          activeDitavalPath: ditavalPath,
          activeDitaval: dv.parsed,
          statusMessage: `已启用 DITAVAL 过滤配置：${ditavalPath}（${dv.parsed.rules.length} 条规则）`,
        });
        return;
      }

      try {
        const res = await fetchParsedDitaval(ditavalPath);
        set({
          activeDitavalPath: ditavalPath,
          activeDitaval: res.ditaval,
          statusMessage: `已启用 DITAVAL 过滤配置：${ditavalPath}（${res.ditaval.rules.length} 条规则）`,
        });
      } catch (err) {
        set({
          activeDitavalPath: ditavalPath,
          activeDitaval: null,
          statusMessage: `加载 DITAVAL 失败：${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },

    setDitavalDisplayMode(mode) {
      const labelMap: Record<DitavalDisplayMode, string> = {
        'show-all': '已切换为“全部显示 + 条件徽章”视图',
        'dim-excluded': '已切换为“淡化被排除内容”视图',
        'hide-excluded': '已切换为“隐藏被排除内容”视图',
      };
      set({ ditavalDisplayMode: mode, statusMessage: labelMap[mode] });
    },

    async refreshSemantics() {
      const state = get();
      if (state.workspaceMode === 'memory') {
        memorySemanticIndex.loadFiles(state.memoryFiles);
        const keyspace = state.activeRootMapPath
          ? memorySemanticIndex.getKeyspace(state.activeRootMapPath)
          : null;
        const dv = state.activeDitavalPath
          ? memorySemanticIndex.getDitaval(state.activeDitavalPath)
          : null;
        const activeDitaval = dv && dv.ok ? dv.parsed : null;

        const nextOverlays: Record<string, DocumentSemanticOverlay> = {};
        for (const tab of state.openTabs) {
          if (tab.kind === 'topic') {
            nextOverlays[tab.path] = memorySemanticIndex.buildDocumentOverlay(
              tab.path,
              state.activeRootMapPath,
              tab.xml,
            );
          }
        }

        set({
          keyspace,
          topicIndices: memorySemanticIndex.getAllTopicIndices(),
          profilingCatalog: memorySemanticIndex.getProfilingCatalog(),
          activeDitaval,
          documentOverlays: nextOverlays,
        });
        return;
      }

      try {
        const ctx = await fetchSemanticContext(
          state.activeRootMapPath,
          state.activeDitavalPath,
        );
        set({
          keyspace: ctx.keyspace,
          topicIndices: ctx.topicIndices,
          profilingCatalog: ctx.profilingCatalog ?? EMPTY_PROFILING_CATALOG,
          workspaceDitavals: ctx.ditavals,
          activeDitaval: ctx.activeDitaval,
        });

        const activeTab = selectActiveTab(get());
        if (activeTab && activeTab.kind === 'topic') {
          await get().refreshDocumentOverlay(activeTab.path, activeTab.xml);
        }
      } catch {
        // Gracefully retain prior semantic context on transient API issues
      }
    },

    async refreshDocumentOverlay(filePath, overrideXml) {
      const state = get();
      if (classifyDitaFileKind(filePath) !== 'topic') return;

      if (state.workspaceMode === 'memory') {
        const overlay = memorySemanticIndex.buildDocumentOverlay(
          filePath,
          state.activeRootMapPath,
          overrideXml,
        );
        set((s) => ({
          documentOverlays: {
            ...s.documentOverlays,
            [filePath]: overlay,
          },
        }));
        return;
      }

      try {
        const overlay = await resolveDocumentSemantics({
          filePath,
          rootMapPath: state.activeRootMapPath,
          xml: overrideXml,
        });
        set((s) => ({
          documentOverlays: {
            ...s.documentOverlays,
            [filePath]: overlay,
          },
        }));
      } catch {
        // Ignore transient network errors during live typing
      }
    },

    async jumpToSemanticLocation(filePath, options = {}) {
      const targetMode = options.mode;
      await get().openFileTab(filePath, {
        mode: targetMode,
        jumpLine: options.line,
      });

      if (options.elementId) {
        const tab = get().openTabs.find((t) => t.path === filePath);
        if (tab && tab.mode !== 'source' && tab.kind === 'topic') {
          try {
            const { pmDoc } = xmlToPmDoc(tab.xml, { position: false });
            const pmPos = findPmPosByDitaId(pmDoc, options.elementId);
            if (pmPos !== null) {
              get().requestVisualJump(pmPos + 1);
            }
          } catch {
            // fallback cleanly if document isn't currently visual-parseable
          }
        }
      }
    },

    async resolveConrefPreview(params) {
      const state = get();
      if (state.workspaceMode === 'memory') {
        return memorySemanticIndex.resolveConref({
          ...params,
          rootMapPath: state.activeRootMapPath,
        });
      }
      return resolveSingleConref({
        ...params,
        rootMapPath: state.activeRootMapPath,
      });
    },

    async refreshDiagnostics() {
      const state = get();
      if (state.workspaceMode === 'memory') {
        const diags = computeMemoryDiagnostics(
          state.memoryFiles,
          state.memoryAssets,
          state.activeRootMapPath,
        );
        set({ diagnostics: diags });
        return;
      }
      try {
        const res = await fetchWorkspaceDiagnostics(state.activeRootMapPath ?? undefined);
        set({ diagnostics: res.diagnostics });
      } catch {
        // keep previous diagnostics gracefully on transient error
      }
    },

    async openFileTab(filePath, options = {}) {
      const state = get();
      const existing = state.openTabs.find((t) => t.path === filePath);
      if (existing) {
        const nextMode = options.mode ?? existing.mode;
        let nextOffset = options.jumpOffset ?? null;
        if (nextOffset === null && options.jumpLine) {
          nextOffset = lineNumberToOffset(existing.xml, options.jumpLine);
        }
        set({
          activeTabPath: filePath,
          openTabs: state.openTabs.map((t) =>
            t.path === filePath ? { ...t, mode: nextMode } : t,
          ),
          inspectorTarget: 'topic',
          pendingSourceOffset: nextMode !== 'visual' ? nextOffset : null,
          statusMessage: `已切换到 ${existing.fileName}`,
        });
        if (existing.kind === 'topic') {
          void get().refreshDocumentOverlay(filePath, existing.xml);
        }
        return;
      }

      const kind = classifyDitaFileKind(filePath);
      if (kind === 'image') {
        set({ statusMessage: `图片资产：${filePath}` });
        return;
      }

      // Prefer unsaved mapBuffer if this map was edited via the Map Tree
      const mapBuf = state.mapBuffers[filePath];
      let xml: string | null = mapBuf ? mapBuf.xml : await readTextFromActiveSource(filePath);
      if (xml === null) {
        set({ statusMessage: `无法打开文件（不存在或不可读）：${filePath}` });
        return;
      }

      const baselineXml = mapBuf ? mapBuf.baselineXml : xml;
      const check = checkXmlWellFormed(xml, { position: false });
      const fileName = filePath.split('/').pop() ?? filePath;
      const docType = detectTopicTypeFromXml(xml, kind);
      const isMapOrVal = kind === 'ditamap' || kind === 'bookmap' || kind === 'ditaval';
      const defaultMode: EditorViewMode = !check.ok
        ? 'source'
        : options.mode ?? (isMapOrVal ? 'source' : 'visual');

      const newTab: OpenEditorTab = {
        path: filePath,
        fileName,
        title: extractTitleSafe(xml, fileName),
        kind,
        docType,
        baselineXml,
        xml,
        mode: defaultMode,
        xmlError: check.ok ? null : check.error,
        switchBlockedReason: null,
        visualReloadToken: 1,
      };

      let jumpOffset = options.jumpOffset ?? null;
      if (jumpOffset === null && options.jumpLine) {
        jumpOffset = lineNumberToOffset(xml, options.jumpLine);
      }

      set((s) => ({
        openTabs: [...s.openTabs, newTab],
        activeTabPath: filePath,
        inspectorTarget: 'topic',
        pendingSourceOffset: defaultMode !== 'visual' ? jumpOffset : null,
        statusMessage: `已打开 ${fileName}`,
      }));

      if (kind === 'topic') {
        void get().refreshDocumentOverlay(filePath, xml);
      }
    },

    activateTab(filePath) {
      const tab = get().openTabs.find((t) => t.path === filePath);
      if (!tab) return;
      set({
        activeTabPath: filePath,
        inspectorTarget: 'topic',
        statusMessage: `已切换到 ${tab.fileName}`,
      });
      if (tab.kind === 'topic') {
        void get().refreshDocumentOverlay(filePath, tab.xml);
      }
    },

    closeTab(filePath) {
      set((state) => {
        const idx = state.openTabs.findIndex((t) => t.path === filePath);
        if (idx === -1) return state;
        const nextTabs = state.openTabs.filter((t) => t.path !== filePath);
        let nextActive = state.activeTabPath;
        if (state.activeTabPath === filePath) {
          const neighbor = nextTabs[Math.min(idx, nextTabs.length - 1)] ?? null;
          nextActive = neighbor?.path ?? null;
        }
        return {
          openTabs: nextTabs,
          activeTabPath: nextActive,
        };
      });
    },

    closeOtherTabs(filePath) {
      set((state) => ({
        openTabs: state.openTabs.filter((t) => t.path === filePath),
        activeTabPath: filePath,
      }));
    },

    closeSavedTabs() {
      set((state) => {
        const kept = state.openTabs.filter((t) => t.xml !== t.baselineXml);
        const activeStillOpen = kept.some((t) => t.path === state.activeTabPath);
        return {
          openTabs: kept,
          activeTabPath: activeStillOpen ? state.activeTabPath : (kept[0]?.path ?? null),
        };
      });
    },

    async saveFile(filePath) {
      const state = get();
      const tab = state.openTabs.find((t) => t.path === filePath);
      const mapBuf = state.mapBuffers[filePath];
      const content = tab?.xml ?? mapBuf?.xml;
      if (content === undefined) return false;

      set((s) => ({ savingPaths: [...s.savingPaths, filePath] }));

      try {
        if (state.workspaceMode === 'api') {
          await saveFileContent(filePath, content, true);
        } else {
          set((s) => ({
            memoryFiles: { ...s.memoryFiles, [filePath]: content },
          }));
        }

        const nextTitle = extractTitleSafe(content, filePath.split('/').pop() ?? filePath);
        set((s) => ({
          openTabs: s.openTabs.map((t) =>
            t.path === filePath
              ? { ...t, baselineXml: content, title: nextTitle }
              : t,
          ),
          mapBuffers: s.mapBuffers[filePath]
            ? {
                ...s.mapBuffers,
                [filePath]: {
                  ...s.mapBuffers[filePath]!,
                  baselineXml: content,
                  xml: content,
                },
              }
            : s.mapBuffers,
          topicTitles:
            classifyDitaFileKind(filePath) === 'topic'
              ? { ...s.topicTitles, [filePath]: nextTitle }
              : s.topicTitles,
          savingPaths: s.savingPaths.filter((p) => p !== filePath),
          statusMessage: `已保存 ${filePath}`,
        }));

        await get().refreshWorkspaceTree();
        await get().refreshSemantics();
        await get().refreshDiagnostics();
        return true;
      } catch (err) {
        set((s) => ({
          savingPaths: s.savingPaths.filter((p) => p !== filePath),
          statusMessage: `保存失败 (${filePath})：${err instanceof Error ? err.message : String(err)}`,
        }));
        return false;
      }
    },

    async saveActiveFile() {
      const activePath = get().activeTabPath;
      if (activePath) {
        return get().saveFile(activePath);
      }
      const rootMap = get().activeRootMapPath;
      if (rootMap) {
        return get().saveFile(rootMap);
      }
      return false;
    },

    async saveAllDirtyFiles() {
      const state = get();
      const dirtyPaths = new Set<string>();
      for (const tab of state.openTabs) {
        if (tab.xml !== tab.baselineXml) dirtyPaths.add(tab.path);
      }
      for (const [p, buf] of Object.entries(state.mapBuffers)) {
        if (buf.xml !== buf.baselineXml) dirtyPaths.add(p);
      }
      for (const p of dirtyPaths) {
        await get().saveFile(p);
      }
      set({ statusMessage: `已保存全部 ${dirtyPaths.size} 个改动文件` });
    },

    resetCurrentToBaseline() {
      const state = get();
      const active = state.openTabs.find((t) => t.path === state.activeTabPath);
      if (!active) return;

      const check = checkXmlWellFormed(active.baselineXml, { position: false });
      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === active.path
            ? {
                ...t,
                xml: t.baselineXml,
                xmlError: check.ok ? null : check.error,
                switchBlockedReason: null,
                visualReloadToken: t.visualReloadToken + 1,
              }
            : t,
        ),
        mapBuffers: s.mapBuffers[active.path]
          ? {
              ...s.mapBuffers,
              [active.path]: {
                ...s.mapBuffers[active.path]!,
                xml: active.baselineXml,
                xmlError: check.ok ? null : check.error,
              },
            }
          : s.mapBuffers,
        statusMessage: `已还原 ${active.fileName} 至上次保存版本`,
      }));
    },

    setMode(nextMode) {
      const state = get();
      const active = state.openTabs.find((t) => t.path === state.activeTabPath);
      if (!active) return false;
      if (nextMode === active.mode) return true;

      // Guard Source -> Visual / Split transitions for topics
      if ((nextMode === 'visual' || nextMode === 'split') && active.mode === 'source') {
        const check = checkXmlWellFormed(active.xml, { position: false });
        if (!check.ok) {
          set({
            openTabs: state.openTabs.map((t) =>
              t.path === active.path
                ? {
                    ...t,
                    xmlError: check.error,
                    switchBlockedReason: `第 ${check.error.line} 行第 ${check.error.column} 列存在 XML 语法错误：${check.error.message}。请修复后再切换到可视化模式。`,
                  }
                : t,
            ),
            statusMessage: 'XML 语法非法，已拦截切换到可视化视图',
          });
          return false;
        }
        set({
          openTabs: state.openTabs.map((t) =>
            t.path === active.path
              ? {
                  ...t,
                  mode: nextMode,
                  xmlError: null,
                  switchBlockedReason: null,
                  visualReloadToken: t.visualReloadToken + 1,
                }
              : t,
          ),
          statusMessage: nextMode === 'visual' ? '已切换到可视化模式' : '已切换到双栏对比模式',
        });
        return true;
      }

      set({
        openTabs: state.openTabs.map((t) =>
          t.path === active.path
            ? { ...t, mode: nextMode, switchBlockedReason: null }
            : t,
        ),
        statusMessage:
          nextMode === 'source'
            ? '已切换到 XML 源码模式'
            : nextMode === 'split'
              ? '已切换到双栏对比模式'
              : '已切换到可视化模式',
      });
      return true;
    },

    updateXmlFromVisual(xml) {
      const state = get();
      const activePath = state.activeTabPath;
      if (!activePath) return;

      const titleFallback = activePath.split('/').pop() ?? activePath;
      const nextTitle = extractTitleSafe(xml, titleFallback);

      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === activePath
            ? {
                ...t,
                xml,
                title: nextTitle,
                xmlError: null,
                switchBlockedReason: null,
              }
            : t,
        ),
        topicTitles:
          classifyDitaFileKind(activePath) === 'topic'
            ? { ...s.topicTitles, [activePath]: nextTitle }
            : s.topicTitles,
      }));

      if (state.workspaceMode === 'memory') {
        memorySemanticIndex.updateFile(activePath, xml);
        void get().refreshDocumentOverlay(activePath, xml);
      } else {
        if (overlayDebounceTimer) clearTimeout(overlayDebounceTimer);
        overlayDebounceTimer = setTimeout(() => {
          void get().refreshDocumentOverlay(activePath, xml);
        }, 180);
      }
    },

    updateXmlFromSource(xml) {
      const state = get();
      const activePath = state.activeTabPath;
      if (!activePath) return;

      const check = checkXmlWellFormed(xml, { position: false });
      const active = state.openTabs.find((t) => t.path === activePath);
      const fallback = active?.fileName ?? activePath;
      const nextTitle = check.ok ? extractTitleSafe(xml, fallback) : (active?.title ?? fallback);
      const isMap = active?.kind === 'ditamap' || active?.kind === 'bookmap';

      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === activePath
            ? {
                ...t,
                xml,
                title: nextTitle,
                xmlError: check.ok ? null : check.error,
                switchBlockedReason: check.ok ? null : t.switchBlockedReason,
                visualReloadToken:
                  check.ok && t.mode === 'split'
                    ? t.visualReloadToken + 1
                    : t.visualReloadToken,
              }
            : t,
        ),
        topicTitles:
          check.ok && active?.kind === 'topic'
            ? { ...s.topicTitles, [activePath]: nextTitle }
            : s.topicTitles,
        mapBuffers:
          isMap && s.mapBuffers[activePath]
            ? {
                ...s.mapBuffers,
                [activePath]: {
                  ...s.mapBuffers[activePath]!,
                  xml,
                  xmlError: check.ok ? null : check.error,
                },
              }
            : s.mapBuffers,
      }));

      if (isMap && check.ok && get().activeRootMapPath) {
        void loadMapTreeBuffers(get().activeRootMapPath!, false);
      }

      if (state.workspaceMode === 'memory') {
        memorySemanticIndex.updateFile(activePath, xml);
        if (isMap && check.ok) {
          void get().refreshSemantics();
        } else if (active?.kind === 'topic') {
          void get().refreshDocumentOverlay(activePath, xml);
        }
      } else if (active?.kind === 'topic') {
        if (overlayDebounceTimer) clearTimeout(overlayDebounceTimer);
        overlayDebounceTimer = setTimeout(() => {
          void get().refreshDocumentOverlay(activePath, xml);
        }, 180);
      }
    },

    applyAiPatchedXml(filePath, xml, options) {
      const state = get();
      const tab = state.openTabs.find((t) => t.path === filePath);
      if (!tab) return false;

      const check = checkXmlWellFormed(xml, { position: false });
      const nextTitle = check.ok ? extractTitleSafe(xml, tab.fileName) : tab.title;
      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === filePath
            ? {
                ...t,
                xml,
                title: nextTitle,
                xmlError: check.ok ? null : check.error,
                switchBlockedReason: check.ok ? null : t.switchBlockedReason,
                visualReloadToken:
                  check.ok &&
                  !options?.skipVisualReload &&
                  s.activeTabPath === filePath &&
                  t.mode === 'visual'
                    ? t.visualReloadToken + 1
                    : t.visualReloadToken,
              }
            : t,
        ),
        topicTitles:
          check.ok && tab.kind === 'topic'
            ? { ...s.topicTitles, [filePath]: nextTitle }
            : s.topicTitles,
        mapBuffers:
          s.mapBuffers[filePath]
            ? {
                ...s.mapBuffers,
                [filePath]: {
                  ...s.mapBuffers[filePath]!,
                  xml,
                  xmlError: check.ok ? null : check.error,
                },
              }
            : s.mapBuffers,
      }));

      if (state.workspaceMode === 'memory') {
        memorySemanticIndex.updateFile(filePath, xml);
      }
      if (tab.kind === 'topic') {
        if (state.workspaceMode === 'api' && state.activeTabPath !== filePath) {
          void get().refreshDocumentOverlay(filePath, xml);
        } else if (state.workspaceMode === 'api') {
          if (overlayDebounceTimer) clearTimeout(overlayDebounceTimer);
          overlayDebounceTimer = setTimeout(() => {
            void get().refreshDocumentOverlay(filePath, xml);
          }, 180);
        } else {
          void get().refreshDocumentOverlay(filePath, xml);
        }
      }
      return true;
    },

    setTagDisplayMode(tagDisplayMode) {
      const labelMap: Record<TagDisplayMode, string> = {
        none: '已隐藏段落与元素标签',
        tags: '已切换为紧凑元素标签视图',
        full: '已切换为完整标签与属性视图',
      };
      set({ tagDisplayMode, statusMessage: labelMap[tagDisplayMode] });
    },

    mutateMapXml(mapPath, nextXml, announcement) {
      const state = get();
      const prevBuf = state.mapBuffers[mapPath];
      if (!prevBuf || prevBuf.xml === nextXml) return;

      const check = checkXmlWellFormed(nextXml, { position: false });
      const nextTitle = extractTitleSafe(nextXml, mapPath.split('/').pop() ?? mapPath);

      set((s) => ({
        mapBuffers: {
          ...s.mapBuffers,
          [mapPath]: {
            ...prevBuf,
            xml: nextXml,
            undoStack: [...prevBuf.undoStack.slice(-39), prevBuf.xml],
            redoStack: [],
            xmlError: check.ok ? null : check.error,
          },
        },
        openTabs: s.openTabs.map((t) =>
          t.path === mapPath
            ? {
                ...t,
                xml: nextXml,
                title: nextTitle,
                xmlError: check.ok ? null : check.error,
                visualReloadToken: t.visualReloadToken + 1,
              }
            : t,
        ),
        workspaceMaps: s.workspaceMaps.map((m) =>
          m.path === mapPath ? { ...m, title: nextTitle } : m,
        ),
        statusMessage: announcement ?? s.statusMessage,
      }));

      if (state.workspaceMode === 'memory') {
        set((s) => ({
          memoryFiles: { ...s.memoryFiles, [mapPath]: nextXml },
        }));
        void get().refreshSemantics();
        void get().refreshDiagnostics();
      }
      if (get().activeRootMapPath) {
        void loadMapTreeBuffers(get().activeRootMapPath!, false);
      }
    },

    undoMap(mapPath) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf || buf.undoStack.length === 0) return;

      const previousXml = buf.undoStack[buf.undoStack.length - 1]!;
      const nextUndo = buf.undoStack.slice(0, -1);
      const nextRedo = [...buf.redoStack, buf.xml];
      const check = checkXmlWellFormed(previousXml, { position: false });
      const nextTitle = extractTitleSafe(previousXml, mapPath);

      set((s) => ({
        mapBuffers: {
          ...s.mapBuffers,
          [mapPath]: {
            ...buf,
            xml: previousXml,
            undoStack: nextUndo,
            redoStack: nextRedo,
            xmlError: check.ok ? null : check.error,
          },
        },
        openTabs: s.openTabs.map((t) =>
          t.path === mapPath
            ? { ...t, xml: previousXml, title: nextTitle, visualReloadToken: t.visualReloadToken + 1 }
            : t,
        ),
        memoryFiles: s.workspaceMode === 'memory' ? { ...s.memoryFiles, [mapPath]: previousXml } : s.memoryFiles,
        statusMessage: `已撤销 ${mapPath} 结构修改`,
      }));
      if (state.workspaceMode === 'memory') {
        void get().refreshSemantics();
        void get().refreshDiagnostics();
      }
    },

    redoMap(mapPath) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf || buf.redoStack.length === 0) return;

      const nextXml = buf.redoStack[buf.redoStack.length - 1]!;
      const nextRedo = buf.redoStack.slice(0, -1);
      const nextUndo = [...buf.undoStack, buf.xml];
      const check = checkXmlWellFormed(nextXml, { position: false });
      const nextTitle = extractTitleSafe(nextXml, mapPath);

      set((s) => ({
        mapBuffers: {
          ...s.mapBuffers,
          [mapPath]: {
            ...buf,
            xml: nextXml,
            undoStack: nextUndo,
            redoStack: nextRedo,
            xmlError: check.ok ? null : check.error,
          },
        },
        openTabs: s.openTabs.map((t) =>
          t.path === mapPath
            ? { ...t, xml: nextXml, title: nextTitle, visualReloadToken: t.visualReloadToken + 1 }
            : t,
        ),
        memoryFiles: s.workspaceMode === 'memory' ? { ...s.memoryFiles, [mapPath]: nextXml } : s.memoryFiles,
        statusMessage: `已重做 ${mapPath} 结构修改`,
      }));
      if (state.workspaceMode === 'memory') {
        void get().refreshSemantics();
        void get().refreshDiagnostics();
      }
    },

    selectMapNode(ref, switchInspector = true) {
      set((s) => ({
        selectedMapNode: ref,
        inspectorTarget: switchInspector && ref ? 'map-node' : s.inspectorTarget,
      }));
    },

    moveMapTreeNodes(dragNodes, targetParent, index) {
      const state = get();
      if (!state.activeRootMapPath) return;

      const plan = planMapNodeMove({
        rootMapPath: state.activeRootMapPath,
        dragNodes,
        targetParentNode: targetParent,
        targetIndex: index,
        mapBuffers: state.mapBuffers,
      });

      if (!plan.ok) {
        if (plan.reason) set({ statusMessage: plan.reason });
        return;
      }

      for (const upd of plan.updates) {
        get().mutateMapXml(upd.mapPath, upd.xml, '已调整 Map 目录结构');
      }
    },

    async createTopicAndMountInMap({
      mapPath,
      parentPath,
      tagName,
      topicType,
      id,
      title,
      lang,
      targetDir,
    }) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf) return;

      const cleanId =
        id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '') || `${topicType}_${Date.now().toString(36)}`;
      const slug = cleanId.replace(/_/g, '-');
      const cleanDir = targetDir.trim().replace(/^\/+|\/+$/g, '');
      let relPath = cleanDir ? `${cleanDir}/${slug}.dita` : `${slug}.dita`;
      if (state.fileSet.has(relPath)) {
        const suffix = Date.now().toString(36).slice(-4);
        relPath = cleanDir ? `${cleanDir}/${slug}-${suffix}.dita` : `${slug}-${suffix}.dita`;
      }

      const xml = createTopicTemplate(topicType, { id: cleanId, title, lang });

      if (state.workspaceMode === 'api') {
        await createWorkspaceFile({
          path: relPath,
          kind: topicType,
          id: cleanId,
          title,
          lang,
          content: xml,
        });
      } else {
        set((s) => ({
          memoryFiles: { ...s.memoryFiles, [relPath]: xml },
        }));
      }

      await get().refreshWorkspaceTree();

      const relativeHref = computeRelativeDitaHref(mapPath, relPath);
      const attrs: XmlAttributeEntry[] = [
        { name: 'href', value: relativeHref, namespaceURI: null },
        { name: 'type', value: topicType, namespaceURI: null },
      ];
      const latestMapXml = get().mapBuffers[mapPath]?.xml ?? buf.xml;
      const inserted = insertMapNode(latestMapXml, {
        parentPath,
        tagName,
        attrs,
        navtitle: title,
      });

      get().mutateMapXml(mapPath, inserted.xml, `已新建并挂载 ${relPath}`);
      set({
        selectedMapNode: { mapPath, elementPath: inserted.insertedPath },
      });

      await get().openFileTab(relPath, { mode: 'visual' });
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    mountExistingFileInMap({ mapPath, parentPath, targetFilePath, tagName, navtitle }) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf) return;

      const relativeHref = computeRelativeDitaHref(mapPath, targetFilePath);
      const kind = classifyDitaFileKind(targetFilePath);
      const isSubmap = kind === 'ditamap' || kind === 'bookmap' || tagName === 'mapref';

      const attrs: XmlAttributeEntry[] = [
        { name: 'href', value: relativeHref, namespaceURI: null },
      ];
      if (isSubmap) {
        attrs.push({ name: 'format', value: 'ditamap', namespaceURI: null });
      }
      const derivedTitle = navtitle?.trim() || state.topicTitles[targetFilePath];

      const inserted = insertMapNode(buf.xml, {
        parentPath,
        tagName: isSubmap && tagName === 'topicref' ? 'mapref' : tagName,
        attrs,
        navtitle: derivedTitle,
      });

      get().mutateMapXml(mapPath, inserted.xml, `已挂载 ${targetFilePath}`);
      set({
        selectedMapNode: { mapPath, elementPath: inserted.insertedPath },
        inspectorTarget: 'map-node',
      });
    },

    insertMapStructureNode({ mapPath, parentPath, tagName, navtitle, keys, keydefKeyword }) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf) return;

      const attrs: XmlAttributeEntry[] = [];
      if (tagName === 'keydef') {
        attrs.push({
          name: 'keys',
          value: keys?.trim() || `key_${Date.now().toString(36).slice(-4)}`,
          namespaceURI: null,
        });
        attrs.push({
          name: 'processing-role',
          value: 'resource-only',
          namespaceURI: null,
        });
      }

      const inserted = insertMapNode(buf.xml, {
        parentPath,
        tagName,
        attrs,
        navtitle: tagName === 'topicgroup' || tagName === 'keydef' ? undefined : navtitle,
        keydefKeyword,
      });

      get().mutateMapXml(mapPath, inserted.xml, `已插入 <${tagName}>`);
      set({
        selectedMapNode: { mapPath, elementPath: inserted.insertedPath },
        inspectorTarget: 'map-node',
      });
    },

    updateMapAttr(mapPath, elementPath, attrName, value) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapNodeAttr(buf.xml, elementPath, attrName, value);
      get().mutateMapXml(mapPath, res.xml, `已更新属性 ${attrName}`);
    },

    updateMapNavtitle(mapPath, elementPath, navtitle) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapNodeNavtitle(buf.xml, elementPath, navtitle);
      get().mutateMapXml(mapPath, res.xml, '已更新导航标题');
    },

    updateMapRootTitle(mapPath, title) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapTitle(buf.xml, title);
      get().mutateMapXml(mapPath, res.xml, '已更新 Map 标题');
    },

    deleteMapTreeNode(mapPath, elementPath) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = deleteMapNode(buf.xml, elementPath);
      if (res.deleted) {
        get().mutateMapXml(mapPath, res.xml, '已从 Map 中移除节点');
        set({ selectedMapNode: { mapPath, elementPath: null } });
      }
    },

    async jumpToMapNodeSource(mapPath, line) {
      await get().openFileTab(mapPath, {
        mode: 'source',
        jumpLine: line,
      });
    },

    async createStandaloneTopic(type, id, title, lang, targetDir = 'concepts') {
      const cleanId =
        id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '') || `${type}_${Date.now().toString(36)}`;
      const slug = cleanId.replace(/_/g, '-');
      const dir = targetDir.trim().replace(/^\/+|\/+$/g, '');
      let relPath = dir ? `${dir}/${slug}.dita` : `${slug}.dita`;
      if (get().fileSet.has(relPath)) {
        relPath = dir
          ? `${dir}/${slug}-${Date.now().toString(36).slice(-4)}.dita`
          : `${slug}-${Date.now().toString(36).slice(-4)}.dita`;
      }

      const xml = createTopicTemplate(type, { id: cleanId, title, lang });
      if (get().workspaceMode === 'api') {
        await createWorkspaceFile({ path: relPath, kind: type, id: cleanId, title, lang, content: xml });
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [relPath]: xml } }));
      }
      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().openFileTab(relPath, { mode: 'visual' });
      set({ statusMessage: `已新建 ${relPath}` });
    },

    async createNewMapFile({ kind, fileName, id, title, lang, targetDir = '' }) {
      const ext = kind === 'bookmap' ? '.bookmap' : '.ditamap';
      const rawName = fileName.trim() || id.trim() || `${kind}-${Date.now().toString(36).slice(-4)}`;
      const withExt = rawName.endsWith('.ditamap') || rawName.endsWith('.bookmap')
        ? rawName
        : `${rawName}${ext}`;
      const dir = targetDir.trim().replace(/^\/+|\/+$/g, '');
      const relPath = dir ? `${dir}/${withExt}` : withExt;
      const xml = createMapTemplate(kind, { id, title, lang });

      if (get().workspaceMode === 'api') {
        await createWorkspaceFile({ path: relPath, kind, id, title, lang, content: xml });
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [relPath]: xml } }));
      }

      await get().refreshWorkspaceTree();
      await get().selectRootMap(relPath);
      await get().openFileTab(relPath, { mode: 'source' });
      set({ statusMessage: `已新建并激活 ${relPath}` });
    },

    async importSingleLocalFile(fileName, content) {
      const kind = classifyDitaFileKind(fileName);
      const baseName = fileName.split('/').pop() ?? fileName;
      const relPath =
        kind === 'ditamap' || kind === 'bookmap'
          ? baseName
          : `imported/${baseName}`;

      if (get().workspaceMode === 'api') {
        await saveFileContent(relPath, content, true);
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [relPath]: content } }));
      }

      await get().refreshWorkspaceTree();
      if (kind === 'ditamap' || kind === 'bookmap') {
        await get().selectRootMap(relPath);
      } else {
        await get().refreshSemantics();
      }
      await get().openFileTab(relPath);
      set({ statusMessage: `已导入 ${relPath}` });
    },

    async createWorkspaceFolder(dirPath) {
      const clean = dirPath.trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return;
      if (get().workspaceMode === 'api') {
        await createWorkspaceDir(clean);
      }
      await get().refreshWorkspaceTree();
      set({ statusMessage: `已创建目录 ${clean}` });
    },

    async renameWorkspaceFile(fromPath, toPath) {
      if (get().workspaceMode === 'api') {
        await renameWorkspaceEntry(fromPath, toPath);
      } else {
        const files = { ...get().memoryFiles };
        if (files[fromPath] !== undefined) {
          files[toPath] = files[fromPath]!;
          delete files[fromPath];
          set({ memoryFiles: files });
        }
      }

      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === fromPath
            ? { ...t, path: toPath, fileName: toPath.split('/').pop() ?? toPath }
            : t,
        ),
        activeTabPath: s.activeTabPath === fromPath ? toPath : s.activeTabPath,
        activeRootMapPath: s.activeRootMapPath === fromPath ? toPath : s.activeRootMapPath,
      }));
      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().refreshDiagnostics();
      set({ statusMessage: `已重命名 ${fromPath} -> ${toPath}` });
    },

    async deleteWorkspaceFile(filePath) {
      if (get().workspaceMode === 'api') {
        await deleteWorkspaceEntry(filePath);
      } else {
        const files = { ...get().memoryFiles };
        delete files[filePath];
        set({ memoryFiles: files });
      }

      get().closeTab(filePath);
      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().refreshDiagnostics();
      set({ statusMessage: `已删除 ${filePath}` });
    },

    setLeftSidebarOpen(open) {
      set({ leftSidebarOpen: open });
    },

    setLeftSidebarTab(tab) {
      set({ leftSidebarTab: tab, leftSidebarOpen: true });
    },

    setInspectorOpen(open) {
      set({ inspectorOpen: open });
    },

    setInspectorTarget(target) {
      set({ inspectorTarget: target });
    },

    setProblemsOpen(open) {
      set({ problemsOpen: open });
    },

    announce(msg) {
      set({ statusMessage: msg });
    },

    clearPendingSourceOffset() {
      set({ pendingSourceOffset: null });
    },

    clearPendingVisualPmPos() {
      set({ pendingVisualPmPos: null });
    },

    requestSourceJump(offset) {
      set({ pendingSourceOffset: offset });
    },

    requestVisualJump(pmPos) {
      set({ pendingVisualPmPos: pmPos });
    },

    clearSwitchBlockedReason() {
      const activePath = get().activeTabPath;
      if (!activePath) return;
      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === activePath ? { ...t, switchBlockedReason: null } : t,
        ),
      }));
    },
  };
});

export function selectActiveTab(state: Pick<EditorWorkbenchState, 'openTabs' | 'activeTabPath'>): OpenEditorTab | null {
  if (!state.activeTabPath) return state.openTabs[0] ?? null;
  return state.openTabs.find((t) => t.path === state.activeTabPath) ?? state.openTabs[0] ?? null;
}

export function getTabDiffStats(tab: OpenEditorTab | null) {
  if (!tab) {
    return { changedLines: 0, addedLines: 0, removedLines: 0, isIdentical: true };
  }
  return computeXmlLineDiffStats(tab.baselineXml, tab.xml);
}

export function isDitaContainerTagName(tagName: string): boolean {
  return DITA_MAP_CONTAINER_NODE_TAGS.has(tagName);
}


export type AiApplyMode = 'apply' | 'checkout-and-apply' | 'preview-only';

export interface ResolveAiApplyModeInput {
  role: IdentityRole | null | undefined;
  userId: string | null | undefined;
  filePath: string | null | undefined;
  locks: readonly LockLike[];
  workspaceMode: 'api' | 'memory';
}

/**
 * Decide how an AI proposal may reach the editor buffer. The offline demo has no server
 * locks, admins and owners apply directly, an unlocked writer gets a checkout step, and
 * viewers / files locked by someone else stay preview-only (contract §4).
 */
export function resolveAiApplyMode(input: ResolveAiApplyModeInput): AiApplyMode {
  if (input.workspaceMode === 'memory') return 'apply';
  const editability = resolveFileEditability(input);
  if (editability.state === 'admin' || editability.state === 'owned') return 'apply';
  if (editability.state === 'unlocked' && input.role === 'writer' && input.filePath) {
    return 'checkout-and-apply';
  }
  return 'preview-only';
}
