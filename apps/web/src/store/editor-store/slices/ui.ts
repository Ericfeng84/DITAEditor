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

    setMapPanelView(view) {
      set({ mapPanelView: view });
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

    setOutlineOpen(open) {
      set({ outlineOpen: open });
      try {
        localStorage.setItem('ditaeditor.outlineOpen', String(open));
      } catch {
        // Private mode / storage disabled: the in-memory value still works.
      }
    },

    setOutlineDensity(density) {
      set({ outlineDensity: density });
      try {
        localStorage.setItem('ditaeditor.outlineDensity', density);
      } catch {
        // Private mode / storage disabled: the in-memory value still works.
      }
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
