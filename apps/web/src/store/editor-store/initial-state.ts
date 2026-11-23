import { initialFileSet, initialMemoryDemo, memorySemanticIndex } from './internals.js';
import type { EditorStateValues } from './types.js';

/** Fresh workbench state for the offline demo workspace. */
export function createInitialEditorState(): EditorStateValues {
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
    taskModelSetting: 'auto',
    statusMessage: '',
    pendingSourceOffset: null,
    pendingVisualPmPos: null,
  };
}
