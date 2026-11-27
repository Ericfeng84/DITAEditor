import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopDirInspection } from './paths.js';

/** How `changeDataDir` treats the contents of the newly selected folder. */
export type DataDirSwitchMode = 'migrate' | 'use-existing' | 'fresh';

export interface DesktopRuntimeStatus {
  dataDir: string;
  defaultDataDir: string;
  isCustomDataDir: boolean;
  isEnvOverridden: boolean;
  ditaHome: string | null;
  notoFontDir: string | null;
  pluginGuideDismissed: boolean;
  platform: NodeJS.Platform;
  paths: {
    workspaceDir: string;
    importsRootDir: string;
    dbPath: string;
    publishRootDir: string;
  };
}

export interface ChangeDataDirInput {
  targetDir: string | null;
  mode: DataDirSwitchMode;
}

export interface DesktopPreferencesPatch {
  ditaHome?: string | null;
  notoFontDir?: string | null;
  pluginGuideDismissed?: boolean;
}

export interface DitaDesktopBridge {
  readonly isDesktop: true;
  readonly platform: NodeJS.Platform;
  pickDirectory: (defaultPath?: string) => Promise<string | null>;
  getStatus: () => Promise<DesktopRuntimeStatus>;
  inspectDataDir: (targetDir: string) => Promise<DesktopDirInspection>;
  changeDataDir: (input: ChangeDataDirInput) => Promise<DesktopRuntimeStatus>;
  updatePreferences: (patch: DesktopPreferencesPatch) => Promise<DesktopRuntimeStatus>;
  openPath: (targetPath: string) => Promise<string>;
  /** Subscribes to the "Desktop Settings & Plugins…" menu item; returns an unsubscribe fn. */
  onOpenDesktopSettings: (listener: () => void) => () => void;
}

const OPEN_SETTINGS_CHANNEL = 'dita:open-desktop-settings';

const bridge: DitaDesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  pickDirectory: (defaultPath?: string) => ipcRenderer.invoke('dita:pick-directory', defaultPath),
  getStatus: () => ipcRenderer.invoke('dita:get-desktop-status'),
  inspectDataDir: (targetDir: string) => ipcRenderer.invoke('dita:inspect-data-dir', targetDir),
  changeDataDir: (input: ChangeDataDirInput) => ipcRenderer.invoke('dita:change-data-dir', input),
  updatePreferences: (patch: DesktopPreferencesPatch) =>
    ipcRenderer.invoke('dita:update-preferences', patch),
  openPath: (targetPath: string) => ipcRenderer.invoke('dita:open-path', targetPath),
  onOpenDesktopSettings: (listener: () => void) => {
    const handler = () => {
      listener();
    };
    ipcRenderer.on(OPEN_SETTINGS_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(OPEN_SETTINGS_CHANNEL, handler);
    };
  },
};

contextBridge.exposeInMainWorld('ditaDesktop', bridge);
