import { create } from 'zustand';
import { createInitialEditorState } from './initial-state.js';
import { createStoreRuntime } from './runtime.js';
import { createEditorSyncSlice } from './slices/editor-sync.js';
import { createFilesSlice } from './slices/files.js';
import { createMapTreeSlice } from './slices/map-tree.js';
import { createTabsSlice } from './slices/tabs.js';
import { createUiSlice } from './slices/ui.js';
import { createWorkspaceSlice } from './slices/workspace.js';
import type { EditorWorkbenchState } from './types.js';

/**
 * Workbench store composed from focused slices. Each slice owns one action family and shares
 * `set`/`get` plus the `StoreRuntime` helpers (debounce, snapshot adoption, map buffers).
 */
export const useEditorStore = create<EditorWorkbenchState>((set, get) => {
  const runtime = createStoreRuntime(set, get);
  return {
    ...createInitialEditorState(),
    ...createWorkspaceSlice(set, get, runtime),
    ...createTabsSlice(set, get, runtime),
    ...createEditorSyncSlice(set, get, runtime),
    ...createMapTreeSlice(set, get, runtime),
    ...createFilesSlice(set, get, runtime),
    ...createUiSlice(set, get, runtime),
  };
});

export * from './selectors.js';
export * from './types.js';
