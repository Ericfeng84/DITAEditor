import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  extractDitaDocumentTitleFromDocument,
  type TaskContentModelSetting,
} from '@dita/core';
import { setTaskContentModelSetting } from '../../../editor/structure-options';
import { t } from '../../../i18n/index.js';
import {
  extractTitleSafe,
  updateMemoryIndexFile,
  cancelOverlayRefresh,
} from '../internals.js';
import type { EditorWorkbenchState, StoreGet, StoreSet, TagDisplayMode } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createEditorSyncSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
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
            openTabs: state.openTabs.map((tab) =>
              tab.path === active.path
                ? {
                    ...tab,
                    xmlError: check.error,
                    switchBlockedReason: t('status.xmlErrorSwitchBlocked', {
                      line: check.error.line,
                      column: check.error.column,
                      message: check.error.message,
                    }),
                  }
                : tab,
            ),
            statusMessage: t('status.xmlInvalidBlocked'),
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
          statusMessage: nextMode === 'visual' ? t('status.modeVisual') : t('status.modeSplit'),
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
            ? t('status.modeSource')
            : nextMode === 'split'
              ? t('status.modeSplit')
              : t('status.modeVisual'),
      });
      return true;
    },

    updateXmlFromVisual(xml, title) {
      const state = get();
      const activePath = state.activeTabPath;
      if (!activePath) return;

      const titleFallback = activePath.split('/').pop() ?? activePath;
      // The visual editor derives the title from its ProseMirror doc (passing `null` when the
      // document has no title); only callers omitting `title` (`undefined`) fall back to XML parse.
      const nextTitle =
        title === undefined ? extractTitleSafe(xml, titleFallback) : (title ?? titleFallback);

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

      runtime.scheduleOverlayRefresh(activePath, xml);
    },

    updateXmlFromSource(xml) {
      const state = get();
      const activePath = state.activeTabPath;
      if (!activePath) return;

      const check = checkXmlWellFormed(xml, { position: false });
      const active = state.openTabs.find((t) => t.path === activePath);
      const fallback = active?.fileName ?? activePath;
      const nextTitle = check.ok
        ? (extractDitaDocumentTitleFromDocument(check.parsed.document) ?? fallback)
        : (active?.title ?? fallback);
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
        void runtime.loadMapTreeBuffers(get().activeRootMapPath!, false);
      }

      if (state.workspaceMode === 'memory') {
        if ((isMap || active?.kind === 'ditaval') && check.ok) {
          runtime.scheduleSemanticsRefresh();
        } else if (active?.kind === 'topic') {
          runtime.scheduleOverlayRefresh(activePath, xml);
        }
      } else if (active?.kind === 'topic') {
        runtime.scheduleOverlayRefresh(activePath, xml);
      }
    },

    applyAiPatchedXml(filePath, xml, options) {
      const state = get();
      const tab = state.openTabs.find((t) => t.path === filePath);
      if (!tab) return false;

      const check = checkXmlWellFormed(xml, { position: false });
      const nextTitle = check.ok
        ? (extractDitaDocumentTitleFromDocument(check.parsed.document) ?? tab.fileName)
        : tab.title;
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

      cancelOverlayRefresh(filePath);
      if (state.workspaceMode === 'memory') {
        updateMemoryIndexFile(filePath, xml);
      }
      if (tab.kind === 'topic') {
        if (state.workspaceMode === 'memory' || state.activeTabPath !== filePath) {
          void get().refreshDocumentOverlay(filePath, xml);
        } else {
          runtime.scheduleOverlayRefresh(filePath, xml);
        }
      }
      return true;
    },

    setTagDisplayMode(tagDisplayMode) {
      const labelMap: Record<TagDisplayMode, string> = {
        none: t('status.tags.none'),
        tags: t('status.tags.tags'),
        full: t('status.tags.full'),
      };
      set({ tagDisplayMode, statusMessage: labelMap[tagDisplayMode] });
    },

    setTaskModelSetting(taskModelSetting) {
      // Mirror into the React-free helper so commands, block transforms, the Source linter and
      // XML autocomplete switch variant immediately (same pattern as the locale helpers).
      setTaskContentModelSetting(taskModelSetting);
      const labelMap: Record<TaskContentModelSetting, string> = {
        auto: t('status.taskModel.auto'),
        strict: t('status.taskModel.strict'),
        general: t('status.taskModel.general'),
      };
      set({ taskModelSetting, statusMessage: labelMap[taskModelSetting] });
    },


  } satisfies Partial<EditorWorkbenchState>;
}
