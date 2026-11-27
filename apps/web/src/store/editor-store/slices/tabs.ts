import {
  checkXmlWellFormed,
  classifyDitaFileKind,
} from '@dita/core';
import { t } from '../../../i18n/index.js';
import {
  ApiHttpError,
  fetchFileContent,
  saveFileContent,
} from '../../../services/workspace-api';
import {
  detectTopicTypeFromXml,
  extractTitleSafe,
  extractTitleFromCheck,
  lineNumberToOffset,
  nextWorkbenchAlert,
  updateMemoryIndexFile,
  cancelOverlayRefresh,
} from '../internals.js';
import { ensureFileCheckedOut } from '../../git-store';
import type { EditorViewMode, EditorWorkbenchState, OpenEditorTab, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createTabsSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
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
          statusMessage: t('status.switchedToFile', { name: existing.fileName }),
        });
        if (existing.kind === 'topic') {
          void get().refreshDocumentOverlay(filePath, existing.xml);
        }
        return;
      }

      const kind = classifyDitaFileKind(filePath);
      if (kind === 'image') {
        set({ statusMessage: t('status.imageAsset', { path: filePath }) });
        return;
      }

      // Prefer unsaved mapBuffer if this map was edited via the Map Tree
      const mapBuf = state.mapBuffers[filePath];
      const read = mapBuf
        ? { xml: mapBuf.xml as string | null, contentHash: mapBuf.contentHash ?? null }
        : await runtime.readTextMetaFromActiveSource(filePath);
      const xml: string | null = read.xml;
      if (xml === null) {
        set({ statusMessage: t('status.cannotOpen', { path: filePath }) });
        return;
      }

      const baselineXml = mapBuf ? mapBuf.baselineXml : xml;
      const check = checkXmlWellFormed(xml, { position: false });
      const fileName = filePath.split('/').pop() ?? filePath;
      const docType = detectTopicTypeFromXml(xml, kind);
      const isMapOrVal = kind === 'ditamap' || kind === 'ditaval';
      const defaultMode: EditorViewMode = !check.ok
        ? 'source'
        : options.mode ?? (isMapOrVal ? 'source' : 'visual');

      const newTab: OpenEditorTab = {
        path: filePath,
        fileName,
        title: extractTitleFromCheck(check, fileName),
        kind,
        docType,
        baselineXml,
        xml,
        mode: defaultMode,
        xmlError: check.ok ? null : check.error,
        switchBlockedReason: null,
        visualReloadToken: 1,
        contentHash: read.contentHash,
      };

      let jumpOffset = options.jumpOffset ?? null;
      if (jumpOffset === null && options.jumpLine) {
        jumpOffset = lineNumberToOffset(xml, options.jumpLine);
      }

      set((s) => ({
        // Guard against concurrent opens: awaited reads above can let two callers
        // (e.g. a double-invoked bootstrap effect) both reach this point.
        openTabs: s.openTabs.some((t) => t.path === filePath)
          ? s.openTabs.map((t) => (t.path === filePath ? { ...t, mode: defaultMode } : t))
          : [...s.openTabs, newTab],
        activeTabPath: filePath,
        inspectorTarget: 'topic',
        pendingSourceOffset: defaultMode !== 'visual' ? jumpOffset : null,
        statusMessage: t('status.openedFile', { name: fileName }),
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
        statusMessage: t('status.switchedToFile', { name: tab.fileName }),
      });
      if (tab.kind === 'topic') {
        void get().refreshDocumentOverlay(filePath, tab.xml);
      }
    },

    closeTab(filePath) {
      cancelOverlayRefresh(filePath);
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
      for (const tab of get().openTabs) {
        if (tab.path !== filePath) cancelOverlayRefresh(tab.path);
      }
      set((state) => ({
        openTabs: state.openTabs.filter((t) => t.path === filePath),
        activeTabPath: filePath,
      }));
    },

    closeSavedTabs() {
      for (const tab of get().openTabs) {
        if (tab.xml === tab.baselineXml) cancelOverlayRefresh(tab.path);
      }
      set((state) => {
        const kept = state.openTabs.filter((t) => t.xml !== t.baselineXml);
        const activeStillOpen = kept.some((t) => t.path === state.activeTabPath);
        return {
          openTabs: kept,
          activeTabPath: activeStillOpen ? state.activeTabPath : (kept[0]?.path ?? null),
        };
      });
    },

    async saveFile(filePath, options) {
      const state = get();
      const tab = state.openTabs.find((t) => t.path === filePath);
      const mapBuf = state.mapBuffers[filePath];
      const content = tab?.xml ?? mapBuf?.xml;
      if (content === undefined) return false;

      set((s) => ({ savingPaths: [...s.savingPaths, filePath] }));

      try {
        let nextContentHash: string | null = null;
        if (state.workspaceMode === 'api') {
          // Phase 13: send the hash the buffer was read from (unless the user explicitly
          // overwrites), so a concurrent save is reported instead of silently lost.
          const expectedHash = options?.force
            ? null
            : (tab?.contentHash ?? mapBuf?.contentHash ?? null);
          const saved = await saveFileContent(filePath, content, true, expectedHash);
          nextContentHash = saved.contentHash ?? null;
        } else {
          set((s) => ({
            memoryFiles: { ...s.memoryFiles, [filePath]: content },
          }));
        }

        const currentTab = get().openTabs.find((t) => t.path === filePath);
        const nextTitle =
          currentTab && currentTab.xml === content
            ? currentTab.title
            : extractTitleSafe(content, filePath.split('/').pop() ?? filePath);
        set((s) => ({
          openTabs: s.openTabs.map((t) =>
            t.path === filePath
              ? {
                  ...t,
                  baselineXml: content,
                  title: nextTitle,
                  ...(nextContentHash ? { contentHash: nextContentHash } : {}),
                }
              : t,
          ),
          mapBuffers: s.mapBuffers[filePath]
            ? {
                ...s.mapBuffers,
                [filePath]: {
                  ...s.mapBuffers[filePath]!,
                  baselineXml: content,
                  xml: content,
                  ...(nextContentHash ? { contentHash: nextContentHash } : {}),
                },
              }
            : s.mapBuffers,
          topicTitles:
            classifyDitaFileKind(filePath) === 'topic'
              ? { ...s.topicTitles, [filePath]: nextTitle }
              : s.topicTitles,
          savingPaths: s.savingPaths.filter((p) => p !== filePath),
          statusMessage: t('status.savedFile', { path: filePath }),
          contentConflict: s.contentConflict?.path === filePath ? null : s.contentConflict,
          lastSaveFailures: s.lastSaveFailures.filter((f) => f.path !== filePath),
          // Drop the alert once every file it wanted to save actually landed.
          alert:
            s.alert?.action &&
            s.alert.action.paths.every(
              (p) => p === filePath || !s.lastSaveFailures.some((f) => f.path === p),
            )
              ? null
              : s.alert,
        }));

        // Leaving a session does not need the index/diagnostics round-trip, and awaiting it
        // made "save and go back" look dead when the semantic refresh was slow.
        if (options?.refresh !== false) {
          // Refresh is best-effort: the bytes are already on disk, so a slow or failing
          // index/diagnostics round-trip must not be reported as a failed save.
          try {
            await get().refreshWorkspaceTree();
            await get().refreshSemantics();
            await get().refreshDiagnostics();
          } catch {
            // ignored on purpose — see above
          }
        }
        return true;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        if (err instanceof ApiHttpError && err.isStaleContent) {
          // Someone else saved first: keep the buffer intact and offer the two safe choices.
          const currentHash =
            typeof err.details.currentHash === 'string' ? err.details.currentHash : null;
          set((s) => ({
            savingPaths: s.savingPaths.filter((p) => p !== filePath),
            statusMessage: t('status.saveFailed', { path: filePath, message: reason }),
            contentConflict: {
              path: filePath,
              message: t('contentConflict.message', { path: filePath }),
              currentHash,
              baseHash: tab?.contentHash ?? mapBuf?.contentHash ?? null,
            },
            lastSaveFailures: [
              ...s.lastSaveFailures.filter((f) => f.path !== filePath),
              { path: filePath, message: reason },
            ],
          }));
          return false;
        }
        const statusMessage = t('status.saveFailed', { path: filePath, message: reason });
        set((s) => ({
          savingPaths: s.savingPaths.filter((p) => p !== filePath),
          statusMessage,
          // Keep the server's own wording: it is the only hint that the check-out lock is gone.
          lastSaveFailures: [
            ...s.lastSaveFailures.filter((f) => f.path !== filePath),
            { path: filePath, message: reason },
          ],
          alert: nextWorkbenchAlert({
            tone: 'error',
            message: t('lock.saveFailed', { path: filePath, message: reason }),
            action: s.workspaceMode === 'api' ? { kind: 'save-with-checkout', paths: [filePath] } : undefined,
          }),
        }));
        return false;
      }
    },

    async saveFileEnsuringLock(filePath, options) {
      if (get().workspaceMode === 'api') {
        const guard = await ensureFileCheckedOut(filePath);
        if (!guard.ok) {
          set({
            alert: nextWorkbenchAlert({
              tone: 'error',
              message: t('lock.saveNeedsCheckout', { path: filePath, message: guard.message }),
            }),
          });
          return false;
        }
      }
      return get().saveFile(filePath, options);
    },

    async saveFilesEnsuringLocks(filePaths, options) {
      const failed: string[] = [];
      for (const p of filePaths) {
        const ok = await get().saveFileEnsuringLock(p, options);
        if (!ok) failed.push(p);
      }
      return failed;
    },

    isPathDirty(filePath) {
      const state = get();
      const tab = state.openTabs.find((t) => t.path === filePath);
      if (tab) return tab.xml !== tab.baselineXml;
      const buffer = state.mapBuffers[filePath];
      return Boolean(buffer && buffer.xml !== buffer.baselineXml);
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

    async saveAllDirtyFiles(options) {
      const state = get();
      const dirtyPaths = new Set<string>();
      for (const tab of state.openTabs) {
        if (tab.xml !== tab.baselineXml) dirtyPaths.add(tab.path);
      }
      for (const [p, buf] of Object.entries(state.mapBuffers)) {
        if (buf.xml !== buf.baselineXml) dirtyPaths.add(p);
      }
      set({ lastSaveFailures: [] });
      const failed: string[] = [];
      for (const p of dirtyPaths) {
        const ok = options?.ensureLocks
          ? await get().saveFileEnsuringLock(p, options)
          : await get().saveFile(p, options);
        if (!ok) failed.push(p);
      }
      set({
        statusMessage:
          failed.length === 0
            ? t('status.savedAll', { count: dirtyPaths.size })
            : t('status.saveFailedSome', { paths: failed.join(', ') }),
      });
      return failed;
    },

    dismissAlert() {
      set({ alert: null });
    },

    dismissContentConflict() {
      set({ contentConflict: null });
    },

    async resolveContentConflict(strategy) {
      const state = get();
      const conflict = state.contentConflict;
      if (!conflict) return false;
      const { path } = conflict;
      if (strategy === 'overwrite') {
        const ok = await get().saveFile(path, { force: true });
        if (ok) set({ contentConflict: null });
        return ok;
      }
      if (state.workspaceMode === 'memory') {
        set({ contentConflict: null });
        return true;
      }
      try {
        const fresh = await fetchFileContent(path);
        const check = checkXmlWellFormed(fresh.content, { position: false });
        const fileName = path.split('/').pop() ?? path;
        const title = extractTitleFromCheck(check, fileName);
        cancelOverlayRefresh(path);
        set((s) => ({
          contentConflict: null,
          openTabs: s.openTabs.map((t) =>
            t.path === path
              ? {
                  ...t,
                  xml: fresh.content,
                  baselineXml: fresh.content,
                  title,
                  xmlError: check.ok ? null : check.error,
                  switchBlockedReason: null,
                  visualReloadToken: t.visualReloadToken + 1,
                  contentHash: fresh.contentHash ?? null,
                }
              : t,
          ),
          mapBuffers: s.mapBuffers[path]
            ? {
                ...s.mapBuffers,
                [path]: {
                  ...s.mapBuffers[path]!,
                  xml: fresh.content,
                  baselineXml: fresh.content,
                  xmlError: check.ok ? null : check.error,
                  contentHash: fresh.contentHash ?? null,
                },
              }
            : s.mapBuffers,
          statusMessage: t('contentConflict.reloaded', { path }),
        }));
        await get().refreshDocumentOverlay(path, fresh.content).catch(() => undefined);
        return true;
      } catch {
        set({ statusMessage: t('contentConflict.reloadFailed', { path }) });
        return false;
      }
    },

    resetCurrentToBaseline() {
      const state = get();
      const active = state.openTabs.find((t) => t.path === state.activeTabPath);
      if (!active) return;

      cancelOverlayRefresh(active.path);
      const check = checkXmlWellFormed(active.baselineXml, { position: false });
      const revertedTitle = extractTitleFromCheck(check, active.fileName);
      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === active.path
            ? {
                ...t,
                xml: t.baselineXml,
                title: revertedTitle,
                xmlError: check.ok ? null : check.error,
                switchBlockedReason: null,
                visualReloadToken: t.visualReloadToken + 1,
              }
            : t,
        ),
        topicTitles:
          active.kind === 'topic'
            ? { ...s.topicTitles, [active.path]: revertedTitle }
            : s.topicTitles,
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
        statusMessage: t('status.reverted', { name: active.fileName }),
      }));

      if (state.workspaceMode === 'memory') {
        updateMemoryIndexFile(active.path, active.baselineXml);
        if (active.kind === 'ditamap' || active.kind === 'ditaval') {
          void get().refreshSemantics();
        } else if (active.kind === 'topic') {
          void get().refreshDocumentOverlay(active.path, active.baselineXml);
        }
      } else if (active.kind === 'topic') {
        void get().refreshDocumentOverlay(active.path, active.baselineXml);
      }
    },


  } satisfies Partial<EditorWorkbenchState>;
}
