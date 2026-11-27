import { create } from 'zustand';
import {
  getDesktopBridge,
  type DataDirSwitchMode,
  type DesktopPreferencesPatch,
  type DesktopRuntimeStatus,
  type RuntimeEnvironmentReport,
  fetchRuntimeEnvironment,
} from '../services/desktop-bridge.js';

/** Two panes of the desktop settings dialog. */
export type DesktopSettingsTab = 'storage' | 'plugins';

export interface DesktopState {
  dialogOpen: boolean;
  activeTab: DesktopSettingsTab;
  status: DesktopRuntimeStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  env: RuntimeEnvironmentReport | null;
  envLoading: boolean;
  envError: string | null;
  busy: boolean;
  actionError: string | null;
  openDialog: (tab?: DesktopSettingsTab) => void;
  closeDialog: () => void;
  setActiveTab: (tab: DesktopSettingsTab) => void;
  refreshStatus: () => Promise<void>;
  refreshEnvironment: (force?: boolean) => Promise<void>;
  changeDataDir: (input: { targetDir: string | null; mode: DataDirSwitchMode }) => Promise<boolean>;
  updatePreferences: (patch: DesktopPreferencesPatch) => Promise<boolean>;
  dismissPluginBanner: () => Promise<void>;
  reset: () => void;
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const EMPTY = {
  status: null,
  statusError: null,
  env: null,
  envError: null,
  busy: false,
  actionError: null,
} satisfies Partial<DesktopState>;

/**
 * Desktop-only runtime state (data folder + plugin readiness).
 *
 * Everything degrades to a no-op in the browser: `getDesktopBridge()` is `null`, so `refresh*`
 * clears instead of probing and the mutating actions return `false` without touching `fetch`.
 */
export const useDesktopStore = create<DesktopState>((set, get) => ({
  dialogOpen: false,
  activeTab: 'storage',
  status: null,
  statusLoading: false,
  statusError: null,
  env: null,
  envLoading: false,
  envError: null,
  busy: false,
  actionError: null,

  openDialog: (tab = 'storage') => {
    set({ dialogOpen: true, activeTab: tab, actionError: null });
    void get().refreshStatus();
    void get().refreshEnvironment(false);
  },

  closeDialog: () => set({ dialogOpen: false, actionError: null }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  refreshStatus: async () => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      set({ status: null, statusLoading: false, statusError: null });
      return;
    }
    set({ statusLoading: true, statusError: null });
    try {
      const status = await bridge.getStatus();
      set({ status, statusLoading: false });
    } catch (error) {
      set({ statusLoading: false, statusError: toMessage(error) });
    }
  },

  refreshEnvironment: async (force = false) => {
    set({ envLoading: true, envError: null });
    try {
      const env = await fetchRuntimeEnvironment(force);
      set({ env, envLoading: false });
    } catch (error) {
      set({ envLoading: false, envError: toMessage(error) });
    }
  },

  changeDataDir: async (input) => {
    const bridge = getDesktopBridge();
    if (!bridge) return false;
    set({ busy: true, actionError: null });
    try {
      const status = await bridge.changeDataDir(input);
      // Electron reloads the window after a successful switch; keep the state coherent anyway
      // so a caller that stays alive (or a test) observes the new folder.
      set({ status, busy: false });
      return true;
    } catch (error) {
      set({ busy: false, actionError: toMessage(error) });
      return false;
    }
  },

  updatePreferences: async (patch) => {
    const bridge = getDesktopBridge();
    if (!bridge) return false;
    set({ busy: true, actionError: null });
    try {
      const status = await bridge.updatePreferences(patch);
      set({ status, busy: false });
      return true;
    } catch (error) {
      set({ busy: false, actionError: toMessage(error) });
      return false;
    }
  },

  dismissPluginBanner: async () => {
    await get().updatePreferences({ pluginGuideDismissed: true });
  },

  reset: () =>
    set({
      dialogOpen: false,
      activeTab: 'storage',
      ...EMPTY,
    }),
}));
