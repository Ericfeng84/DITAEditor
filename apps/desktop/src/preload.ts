import { contextBridge, ipcRenderer } from 'electron';

export interface DitaDesktopBridge {
  readonly isDesktop: true;
  readonly platform: NodeJS.Platform;
  pickDirectory: (defaultPath?: string) => Promise<string | null>;
}

const bridge: DitaDesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  pickDirectory: (defaultPath?: string) => ipcRenderer.invoke('dita:pick-directory', defaultPath),
};

contextBridge.exposeInMainWorld('ditaDesktop', bridge);
