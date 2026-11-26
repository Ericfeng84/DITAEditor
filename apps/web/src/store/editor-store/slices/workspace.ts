import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  extractDitaDocumentTitle,
  findPmPosByDitaId,
  xmlToPmDoc,
  type DitavalDisplayMode,
  type DocumentSemanticOverlay,
} from '@dita/core';
import { buildSnapshotFromMemoryFiles } from '../../../services/demo-workspace.js';
import { t } from '../../../i18n/index.js';
import {
  createWorkspaceProject,
  fetchFileContent,
  fetchParsedDitaval,
  fetchSemanticContext,
  fetchWorkspace,
  fetchWorkspaceDiagnostics,
  fetchWorkspaces,
  forgetWorkspaceProject,
  importWorkspaceProject,
  openWorkspaceDir,
  resolveDocumentSemantics,
  resolveSingleConref,
} from '../../../services/workspace-api';
import { ApiHttpError } from '../../../services/workspace-api';
import {
  cancelAllPendingRefreshes,
  collectMemoryIndexFiles,
  computeMemoryDiagnostics,
  EMPTY_PROFILING_CATALOG,
  extractTitleFromCheck,
  memorySemanticIndex,
  resetMemorySemanticIndex,
  syncMemorySemanticIndex,
} from '../internals.js';
import { selectActiveTab } from '../selectors.js';
import type { EditorWorkbenchState, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createWorkspaceSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
    async initWorkspace(options) {
      if (import.meta.env.VITE_STATIC_DEMO === 'true') {
        runtime.activateMemoryFallback(
          t('status.offlineDemo'),
        );
        return;
      }
      set({ loadingWorkspace: true });
      try {
        const snapshot = await fetchWorkspace();
        const fSet = runtime.applySnapshotToState(snapshot);
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
          statusMessage: t('status.workspaceConnected', { name: snapshot.name, topics: snapshot.stats.totalTopics, maps: snapshot.stats.totalMaps }),
        });

        const requested = options?.topicPath && fSet.has(options.topicPath) ? options.topicPath : null;
        if (firstMap) {
          await runtime.loadMapTreeBuffers(firstMap, true);
          const rootXml = get().mapBuffers[firstMap]?.xml ?? null;
          const firstTopic =
            requested ?? runtime.findFirstTopicInWorkspace(rootXml, firstMap, fSet);
          if (firstTopic) {
            await get().openFileTab(firstTopic);
          }
        } else {
          const firstTopic = requested ?? runtime.findFirstTopicInWorkspace(null, null, fSet);
          if (firstTopic) await get().openFileTab(firstTopic);
        }
        await get().refreshSemantics();
        await get().refreshDiagnostics();
      } catch {
        runtime.activateMemoryFallback(t('status.apiMissing'));
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
        runtime.applySnapshotToState(snap);
        return;
      }
      const snap = await fetchWorkspace();
      runtime.applySnapshotToState(snap);
    },

    async reloadWorkspaceFromSnapshot(snapshot, statusMessage) {
      cancelAllPendingRefreshes();
      const previousActive = get().activeTabPath;
      const fSet = runtime.applySnapshotToState(snapshot);
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
        contentConflict: null,
        alert: null,
        lastSaveFailures: [],
        selectedMapNode: nextRootMap ? { mapPath: nextRootMap, elementPath: null } : null,
        loadingWorkspace: false,
        statusMessage: statusMessage ?? t('status.branchSwitched', { path: snapshot.rootDir }),
      });

      if (nextRootMap) {
        await runtime.loadMapTreeBuffers(nextRootMap, true);
        const preferred =
          previousActive && fSet.has(previousActive) ? previousActive : null;
        const firstTopic = preferred ?? runtime.findFirstTopicInWorkspace(
          get().mapBuffers[nextRootMap]?.xml ?? null,
          nextRootMap,
          fSet,
        );
        if (firstTopic) await get().openFileTab(firstTopic);
      } else {
        const firstTopic = runtime.findFirstTopicInWorkspace(null, null, fSet);
        if (firstTopic) await get().openFileTab(firstTopic);
      }

      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    async reloadFilesFromDisk(filePaths) {
      if (get().workspaceMode === 'memory') return;
      const uniquePaths = Array.from(new Set(filePaths.filter((path) => path.length > 0)));
      if (uniquePaths.length === 0) return;

      // Only paths that are currently open can be refreshed: any other path has no buffer to
      // update and will be read fresh when its tab is opened later.
      const before = get();
      const openPaths = new Set<string>([
        ...before.openTabs.map((tab) => tab.path),
        ...Object.keys(before.mapBuffers),
      ]);
      const targets = uniquePaths.filter((path) => openPaths.has(path));
      if (targets.length === 0) return;

      type Fetched =
        | { path: string; kind: 'content'; content: string; contentHash: string | null }
        // 404 means the file no longer exists in Baseline + this user's overlay: a revert, merge
        // or delete really removed it, so its tab must close instead of showing stale bytes.
        | { path: string; kind: 'missing' }
        // Any other failure is transient: never destroy the user's tab for a flaky network.
        | { path: string; kind: 'failed' };

      const fetched: Fetched[] = [];
      for (const filePath of targets) {
        try {
          const res = await fetchFileContent(filePath);
          fetched.push({
            path: filePath,
            kind: 'content',
            content: res.content,
            contentHash: res.contentHash ?? null,
          });
        } catch (err) {
          fetched.push({
            path: filePath,
            kind: err instanceof ApiHttpError && err.status === 404 ? 'missing' : 'failed',
          });
        }
      }

      const applied = fetched.filter((entry) => entry.kind !== 'failed').length;
      if (applied === 0) return;

      // Merge atomically against the freshest state: any edit/close/tab-switch that happened while
      // the fetches were in flight survives (a snapshot taken before the awaits would clobber it).
      set((s) => {
        let nextTabs = s.openTabs;
        let nextBuffers = s.mapBuffers;
        let nextTitles = s.topicTitles;
        let nextActive = s.activeTabPath;
        let nextConflict = s.contentConflict;

        for (const entry of fetched) {
          if (entry.kind === 'content') {
            const check = checkXmlWellFormed(entry.content, { position: false });
            const xmlError = check.ok ? null : check.error;
            const tabIndex = nextTabs.findIndex((tab) => tab.path === entry.path);
            if (tabIndex >= 0) {
              const tab = nextTabs[tabIndex]!;
              const nextTitle = extractTitleFromCheck(check, tab.fileName);
              nextTabs = nextTabs.map((item, index) =>
                index === tabIndex
                  ? {
                      ...item,
                      xml: entry.content,
                      baselineXml: entry.content,
                      xmlError,
                      switchBlockedReason: null,
                      visualReloadToken: item.visualReloadToken + 1,
                      title: nextTitle,
                      contentHash: entry.contentHash,
                    }
                  : item,
              );
              const parsedTitle = extractDitaDocumentTitle(entry.content);
              if (parsedTitle) nextTitles = { ...nextTitles, [entry.path]: parsedTitle };
            }
            const buffer = nextBuffers[entry.path];
            if (buffer) {
              nextBuffers = {
                ...nextBuffers,
                [entry.path]: {
                  ...buffer,
                  xml: entry.content,
                  baselineXml: entry.content,
                  undoStack: [],
                  redoStack: [],
                  xmlError,
                  contentHash: entry.contentHash,
                },
              };
            }
            if (nextConflict?.path === entry.path) nextConflict = null;
            continue;
          }

          if (entry.kind === 'missing') {
            if (nextBuffers[entry.path]) {
              const buffersWithoutPath = { ...nextBuffers };
              delete buffersWithoutPath[entry.path];
              nextBuffers = buffersWithoutPath;
            }
            const removedIndex = nextTabs.findIndex((tab) => tab.path === entry.path);
            if (removedIndex >= 0) {
              const wasActive = nextActive === entry.path;
              nextTabs = nextTabs.filter((tab) => tab.path !== entry.path);
              if (wasActive) {
                const neighbour = nextTabs[removedIndex] ?? nextTabs[removedIndex - 1] ?? null;
                nextActive = neighbour?.path ?? null;
              }
            }
            if (nextConflict?.path === entry.path) nextConflict = null;
          }
        }

        return {
          openTabs: nextTabs,
          mapBuffers: nextBuffers,
          topicTitles: nextTitles,
          activeTabPath: nextActive,
          contentConflict: nextConflict,
          statusMessage: t('status.reloaded', { count: applied }),
        };
      });
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    async openLocalWorkspace(target) {
      set({ loadingWorkspace: true });
      try {
        const snapshot = await openWorkspaceDir(target);
        await runtime.adoptApiWorkspaceSnapshot(snapshot, t('status.openedProject', { name: snapshot.name }));
      } catch (err) {
        set({
          loadingWorkspace: false,
          statusMessage: t('status.openDirFailed', { message: err instanceof Error ? err.message : String(err) }),
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
        await runtime.adoptApiWorkspaceSnapshot(
          snapshot,
          t('status.blankWorkspace', { name: snapshot.name, path: snapshot.rootDir }),
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
          await runtime.adoptApiWorkspaceSnapshot(
            snapshot,
            t('status.importedFolder', { name: projectName, topics: snapshot.stats.totalTopics }),
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
      cancelAllPendingRefreshes();
      const snap = buildSnapshotFromMemoryFiles(projectName, nextFiles, nextAssets);
      const fSet = runtime.applySnapshotToState(snap);
      const firstMap = snap.maps[0]?.path ?? null;
      resetMemorySemanticIndex(nextFiles);
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
        statusMessage: t('status.importedMemory', { name: projectName }),
      });
      if (firstMap) {
        await runtime.loadMapTreeBuffers(firstMap, true);
        const firstTopic = runtime.findFirstTopicInWorkspace(nextFiles[firstMap] ?? null, firstMap, fSet);
        if (firstTopic) await get().openFileTab(firstTopic);
      }
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    restoreOfflineDemo() {
      runtime.activateMemoryFallback(t('status.restoredDemo'));
    },

    async selectRootMap(mapPath) {
      set({
        activeRootMapPath: mapPath,
        selectedMapNode: { mapPath, elementPath: null },
        statusMessage: t('status.rootMapActivated', { path: mapPath }),
      });
      await runtime.loadMapTreeBuffers(mapPath, false);
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    async selectDitaval(ditavalPath) {
      if (!ditavalPath) {
        set({
          activeDitavalPath: null,
          activeDitaval: null,
          statusMessage: t('status.ditavalOff'),
        });
        return;
      }

      const state = get();
      if (state.workspaceMode === 'memory') {
        const dv = memorySemanticIndex.getDitaval(ditavalPath);
        if (!dv) {
          set({ statusMessage: t('status.ditavalNotFound', { path: ditavalPath }) });
          return;
        }
        if (!dv.ok) {
          set({
            activeDitavalPath: ditavalPath,
            activeDitaval: null,
            statusMessage: t('status.ditavalParseFailed', { message: dv.error.message }),
          });
          return;
        }
        set({
          activeDitavalPath: ditavalPath,
          activeDitaval: dv.parsed,
          statusMessage: t('status.ditavalEnabled', { path: ditavalPath, count: dv.parsed.rules.length }),
        });
        return;
      }

      try {
        const res = await fetchParsedDitaval(ditavalPath);
        set({
          activeDitavalPath: ditavalPath,
          activeDitaval: res.ditaval,
          statusMessage: t('status.ditavalEnabled', { path: ditavalPath, count: res.ditaval.rules.length }),
        });
      } catch (err) {
        set({
          activeDitavalPath: ditavalPath,
          activeDitaval: null,
          statusMessage: t('status.ditavalLoadFailed', { message: err instanceof Error ? err.message : String(err) }),
        });
      }
    },

    setDitavalDisplayMode(mode) {
      const labelMap: Record<DitavalDisplayMode, string> = {
        'show-all': t('status.ditavalView.showAll'),
        'dim-excluded': t('status.ditavalView.dimExcluded'),
        'hide-excluded': t('status.ditavalView.hideExcluded'),
      };
      set({ ditavalDisplayMode: mode, statusMessage: labelMap[mode] });
    },

    async refreshSemantics() {
      const state = get();
      if (state.workspaceMode === 'memory') {
        syncMemorySemanticIndex(collectMemoryIndexFiles(state));
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
        // Merge live map/tab buffers so a fix that is not saved yet clears its diagnostic,
        // instead of re-reporting the last saved snapshot (mirrors `refreshSemantics`).
        const diags = computeMemoryDiagnostics(
          collectMemoryIndexFiles(state),
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


  } satisfies Partial<EditorWorkbenchState>;
}
