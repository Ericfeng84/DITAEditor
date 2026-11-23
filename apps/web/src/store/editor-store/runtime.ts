import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  parseDitaMap,
  resolveDitaHref,
} from '@dita/core';
import { t } from '../../i18n/index.js';
import type { MapBufferState } from '../../map-tree/map-tree-utils';
import { createInMemoryDemoWorkspace } from '../../services/demo-workspace.js';
import { fetchFileContent } from '../../services/workspace-api';
import type { WorkspaceSnapshot } from '../../services/workspace-api';
import {
  cancelAllPendingRefreshes,
  cancelOverlayRefresh,
  collectFileSetFromTree,
  memorySemanticIndex,
  resetMemorySemanticIndex,
  storeRuntimeState,
  updateMemoryIndexFile,
} from './internals.js';
import type { StoreGet, StoreSet } from './types.js';

/**
 * Store-internal helpers that need both `set`/`get` and the shared debounce/semantic-index
 * state. Extracted from the store factory so the action slices below stay purely action-shaped.
 */
export function createStoreRuntime(set: StoreSet, get: StoreGet) {
  /**
   * Per-file debounced document-overlay refresh. In demo (memory) mode this also
   * pushes the newest XML into the semantic index, so neither the index nor the
   * overlay re-parses the whole document on every keystroke.
   */
  const scheduleOverlayRefresh = (filePath: string, xml: string) => {
    cancelOverlayRefresh(filePath);
    const generation = storeRuntimeState.workspaceGeneration;
    const timer = setTimeout(() => {
      storeRuntimeState.overlayDebounceTimers.delete(filePath);
      if (generation !== storeRuntimeState.workspaceGeneration) return;
      const current = get();
      const openTab = current.openTabs.find((t) => t.path === filePath);
      if (openTab && openTab.xml !== xml) return;
      if (current.workspaceMode === 'memory') updateMemoryIndexFile(filePath, xml);
      void current.refreshDocumentOverlay(filePath, xml);
    }, 180);
    storeRuntimeState.overlayDebounceTimers.set(filePath, timer);
  };

  /** Debounced keyspace/overlay rebuild for edits that change project semantics (map/ditaval files). */
  const scheduleSemanticsRefresh = () => {
    if (storeRuntimeState.semanticsDebounceTimer) clearTimeout(storeRuntimeState.semanticsDebounceTimer);
    const generation = storeRuntimeState.workspaceGeneration;
    storeRuntimeState.semanticsDebounceTimer = setTimeout(() => {
      storeRuntimeState.semanticsDebounceTimer = null;
      if (generation !== storeRuntimeState.workspaceGeneration) return;
      void get().refreshSemantics();
    }, 400);
  };

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
    cancelAllPendingRefreshes();
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
    cancelAllPendingRefreshes();
    const demo = createInMemoryDemoWorkspace();
    const fSet = collectFileSetFromTree(demo.snapshot.files);
    const defaultRootMap = demo.snapshot.maps[0]?.path ?? null;
    resetMemorySemanticIndex(demo.files);

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
      statusMessage: reason ?? t('status.loadedOfflineDemo'),
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
    scheduleOverlayRefresh,
    scheduleSemanticsRefresh,
    applySnapshotToState,
    readTextFromActiveSource,
    loadMapTreeBuffers,
    findFirstTopicInWorkspace,
    adoptApiWorkspaceSnapshot,
    activateMemoryFallback,
  };
}

export type StoreRuntime = ReturnType<typeof createStoreRuntime>;
