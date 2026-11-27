import { initialFileSet, initialMemoryDemo, memorySemanticIndex } from './internals.js';
import type { EditorStateValues, TagDisplayMode } from './types.js';
import type { OutlineDensity } from '../../editor/outline/outline-model.js';

const OUTLINE_OPEN_STORAGE_KEY = 'ditaeditor.outlineOpen';
const OUTLINE_DENSITY_STORAGE_KEY = 'ditaeditor.outlineDensity';
const TAG_MODE_READONLY_STORAGE_KEY = 'ditaeditor.tagDisplayMode.readOnly';
const TAG_MODE_EDIT_STORAGE_KEY = 'ditaeditor.tagDisplayMode.edit';

/** localStorage is unavailable in tests/private modes — never let hydration break the boot. */
function readOutlineOpen(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(OUTLINE_OPEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readOutlineDensity(): OutlineDensity {
  try {
    if (typeof localStorage === 'undefined') return 'structure';
    const raw = localStorage.getItem(OUTLINE_DENSITY_STORAGE_KEY);
    return raw === 'all' || raw === 'structure' ? raw : 'structure';
  } catch {
    return 'structure';
  }
}

function isTagDisplayMode(value: unknown): value is TagDisplayMode {
  return value === 'none' || value === 'tags' || value === 'full';
}

/**
 * Adaptive tag display mode (Phase 16 UX): read-only documents hide tag chrome by default while
 * editable documents keep the chevron tags. Both defaults are per-browser persisted.
 */
export function readTagDisplayMode(storageKey: string, fallback: TagDisplayMode): TagDisplayMode {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(storageKey);
    return isTagDisplayMode(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function persistTagDisplayMode(storageKey: string, mode: TagDisplayMode): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(storageKey, mode);
  } catch {
    /* private mode / quota — the in-memory value still applies for this session */
  }
}

export const TAG_DISPLAY_MODE_STORAGE_KEYS = {
  readOnly: TAG_MODE_READONLY_STORAGE_KEY,
  edit: TAG_MODE_EDIT_STORAGE_KEY,
} as const;

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
    topicTypes: initialMemoryDemo.snapshot.topicTypes ?? {},
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
    mapPanelView: 'tree',
    inspectorOpen: true,
    inspectorTarget: 'topic',
    selectedMapNode: null,
    problemsOpen: false,
    outlineOpen: readOutlineOpen(),
    outlineDensity: readOutlineDensity(),
    tagDisplayMode: readTagDisplayMode(TAG_MODE_EDIT_STORAGE_KEY, 'tags'),
    readOnlyTagDisplayMode: readTagDisplayMode(TAG_MODE_READONLY_STORAGE_KEY, 'none'),
    editTagDisplayMode: readTagDisplayMode(TAG_MODE_EDIT_STORAGE_KEY, 'tags'),
    taskModelSetting: 'auto',
    statusMessage: '',
    alert: null,
    contentConflict: null,
    lastSaveFailures: [],
    pendingSourceOffset: null,
    pendingVisualPmPos: null,
  };
}
