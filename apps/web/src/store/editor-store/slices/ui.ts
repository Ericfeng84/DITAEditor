import { t } from '../../../i18n/index.js';
import type { EditorWorkbenchState, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createUiSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
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
  } satisfies Partial<EditorWorkbenchState>;
}
