import { create } from 'zustand';
import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  computeRelativeDitaHref,
  createMapTemplate,
  createTopicTemplate,
  deleteMapNode,
  DITA_MAP_CONTAINER_NODE_TAGS,
  extractDitaDocumentTitle,
  insertMapNode,
  parseDitaMap,
  resolveDitaHref,
  updateMapNodeAttr,
  updateMapNodeNavtitle,
  updateMapTitle,
  type DitaFileKind,
  type DitaMapTemplateType,
  type DitaTopicTemplateType,
  type XmlAttributeEntry,
  type XmlParseError,
} from '@dita/core';
import { computeXmlLineDiffStats } from '../editor/bridge/xml-bridge';
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
  deleteWorkspaceEntry,
  fetchFileContent,
  fetchWorkspace,
  fetchWorkspaceDiagnostics,
  importWorkspaceProject,
  openWorkspaceDir,
  renameWorkspaceEntry,
  saveFileContent,
  type WorkspaceDiagnostic,
  type WorkspaceFileNode,
  type WorkspaceMapSummary,
  type WorkspaceSnapshot,
} from '../services/workspace-api';

export type EditorViewMode = 'visual' | 'split' | 'source';
export type TagDisplayMode = 'none' | 'tags' | 'full';
export type LeftSidebarTab = 'map' | 'files';
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
  fileTree: WorkspaceFileNode[];
  fileSet: Set<string>;
  workspaceMaps: WorkspaceMapSummary[];
  topicTitles: Record<string, string>;
  activeRootMapPath: string | null;
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
  openLocalWorkspace: (target: { rootDir: string } | { useDefault: true }) => Promise<void>;
  importFolderWorkspace: (
    projectName: string,
    files: { path: string; content: string; encoding?: 'utf8' | 'base64' }[],
  ) => Promise<void>;
  restoreOfflineDemo: () => void;
  selectRootMap: (mapPath: string) => Promise<void>;
  refreshDiagnostics: () => Promise<void>;

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

function computeMemoryDiagnostics(
  files: Record<string, string>,
  assets: Record<string, string>,
  rootMapPath: string | null,
): WorkspaceDiagnostic[] {
  const diagnostics: WorkspaceDiagnostic[] = [];
  const allPaths = new Set([...Object.keys(files), ...Object.keys(assets)]);

  for (const [filePath, xml] of Object.entries(files)) {
    const check = checkXmlWellFormed(xml, { position: false });
    if (!check.ok) {
      diagnostics.push({
        id: `xml:${filePath}:${check.error.line}:${check.error.column}`,
        filePath,
        line: check.error.line,
        column: check.error.column,
        severity: 'error',
        source: 'xml',
        message: `XML 良构错误：${check.error.message}`,
      });
    }
  }

  if (rootMapPath && files[rootMapPath]) {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const walkMap = (mapPath: string) => {
      if (visited.has(mapPath)) return;
      visited.add(mapPath);
      stack.add(mapPath);
      const xml = files[mapPath];
      if (!xml) {
        stack.delete(mapPath);
        return;
      }
      try {
        const parsed = parseDitaMap(xml);
        for (const ref of parsed.references) {
          if (ref.scope === 'external' || ref.scope === 'peer') continue;
          const res = resolveDitaHref(mapPath, ref.href);
          if (res.isExternal) continue;
          if (res.escapesRoot || !res.targetPath || !allPaths.has(res.targetPath)) {
            diagnostics.push({
              id: `map:${mapPath}:${ref.line ?? 1}:${ref.column ?? 1}:${ref.href}`,
              filePath: mapPath,
              line: ref.line ?? 1,
              column: ref.column ?? 1,
              severity: 'error',
              source: 'map-ref',
              message: `目标文件不存在：${ref.href}`,
              targetHref: ref.href,
              resolvedPath: res.targetPath || undefined,
            });
            continue;
          }
          if (ref.isSubmapRef) {
            if (stack.has(res.targetPath)) {
              diagnostics.push({
                id: `cycle:${mapPath}:${res.targetPath}`,
                filePath: mapPath,
                line: ref.line ?? 1,
                column: ref.column ?? 1,
                severity: 'error',
                source: 'map-ref',
                message: `检测到循环子地图引用：${res.targetPath}`,
                targetHref: ref.href,
                resolvedPath: res.targetPath,
              });
            } else {
              walkMap(res.targetPath);
            }
          }
        }
      } catch {
        // XML errors already reported
      }
      stack.delete(mapPath);
    };
    walkMap(rootMapPath);
  }

  return diagnostics;
}

const initialMemoryDemo = createInMemoryDemoWorkspace();
const initialFileSet = collectFileSetFromTree(initialMemoryDemo.snapshot.files);

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

  const activateMemoryFallback = (reason?: string) => {
    const demo = createInMemoryDemoWorkspace();
    const fSet = collectFileSetFromTree(demo.snapshot.files);
    const defaultRootMap = demo.snapshot.maps[0]?.path ?? null;

    set({
      workspaceMode: 'memory',
      workspaceRootDir: demo.snapshot.rootDir,
      workspaceDefaultRootDir: demo.snapshot.rootDir,
      workspaceName: demo.snapshot.name,
      fileTree: demo.snapshot.files,
      fileSet: fSet,
      workspaceMaps: demo.snapshot.maps,
      topicTitles: demo.snapshot.topicTitles,
      activeRootMapPath: defaultRootMap,
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
    fileTree: initialMemoryDemo.snapshot.files,
    fileSet: initialFileSet,
    workspaceMaps: initialMemoryDemo.snapshot.maps,
    topicTitles: initialMemoryDemo.snapshot.topicTitles,
    activeRootMapPath: initialMemoryDemo.snapshot.maps[0]?.path ?? null,
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

    async openLocalWorkspace(target) {
      set({ loadingWorkspace: true });
      try {
        const snapshot = await openWorkspaceDir(target);
        const fSet = applySnapshotToState(snapshot);
        const firstMap = snapshot.maps[0]?.path ?? null;
        set({
          workspaceMode: 'api',
          mapBuffers: {},
          openTabs: [],
          activeTabPath: null,
          activeRootMapPath: firstMap,
          selectedMapNode: firstMap ? { mapPath: firstMap, elementPath: null } : null,
          loadingWorkspace: false,
          statusMessage: `已打开本地项目：${snapshot.name}`,
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
        await get().refreshDiagnostics();
      } catch (err) {
        set({
          loadingWorkspace: false,
          statusMessage: `打开目录失败：${err instanceof Error ? err.message : String(err)}`,
        });
        throw err;
      }
    },

    async importFolderWorkspace(projectName, files) {
      set({ loadingWorkspace: true });
      if (get().workspaceMode === 'api') {
        try {
          const snapshot = await importWorkspaceProject(projectName, files);
          const fSet = applySnapshotToState(snapshot);
          const firstMap = snapshot.maps[0]?.path ?? null;
          set({
            mapBuffers: {},
            openTabs: [],
            activeTabPath: null,
            activeRootMapPath: firstMap,
            selectedMapNode: firstMap ? { mapPath: firstMap, elementPath: null } : null,
            loadingWorkspace: false,
            statusMessage: `已导入本地文件夹项目：${projectName}（${snapshot.stats.totalTopics} 个主题）`,
          });
          if (firstMap) {
            await loadMapTreeBuffers(firstMap, true);
            const firstTopic = findFirstTopicInWorkspace(
              get().mapBuffers[firstMap]?.xml ?? null,
              firstMap,
              fSet,
            );
            if (firstTopic) await get().openFileTab(firstTopic);
          }
          await get().refreshDiagnostics();
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
      set({
        workspaceMode: 'memory',
        memoryFiles: nextFiles,
        memoryAssets: nextAssets,
        mapBuffers: {},
        openTabs: [],
        activeTabPath: null,
        activeRootMapPath: firstMap,
        loadingWorkspace: false,
        statusMessage: `已在离线内存工作区导入项目：${projectName}`,
      });
      if (firstMap) {
        await loadMapTreeBuffers(firstMap, true);
        const firstTopic = findFirstTopicInWorkspace(nextFiles[firstMap] ?? null, firstMap, fSet);
        if (firstTopic) await get().openFileTab(firstTopic);
      }
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
      await get().refreshDiagnostics();
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
    },

    activateTab(filePath) {
      const tab = get().openTabs.find((t) => t.path === filePath);
      if (!tab) return;
      set({
        activeTabPath: filePath,
        inspectorTarget: 'topic',
        statusMessage: `已切换到 ${tab.fileName}`,
      });
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
        statusMessage: `已撤销 ${mapPath} 结构修改`,
      }));
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
        statusMessage: `已重做 ${mapPath} 结构修改`,
      }));
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
