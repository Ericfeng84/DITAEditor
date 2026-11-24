import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from 'electron';
import { createServer } from '@dita/api';
import { ensureInitialWorkspace, resolveDesktopPaths } from './paths.js';

type ApiServer = ReturnType<typeof createServer>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

let mainWindow: BrowserWindow | null = null;
let apiServer: ApiServer | null = null;
let serverUrl: string | null = null;
let serverOrigin: string | null = null;
let isShuttingDown = false;

function buildApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

async function startEmbeddedServer(): Promise<string> {
  const paths = resolveDesktopPaths({
    isPackaged: app.isPackaged,
    userDataDir: app.getPath('userData'),
    resourcesDir: process.resourcesPath,
    repoRoot: REPO_ROOT,
    dataDirOverride: process.env.DITA_DESKTOP_DATA_DIR,
  });

  if (!existsSync(path.join(paths.webDistDir, 'index.html'))) {
    throw new Error(
      `Built web workbench not found at "${paths.webDistDir}". Run "pnpm --filter @dita/web build" first.`,
    );
  }

  mkdirSync(paths.importsRootDir, { recursive: true });
  mkdirSync(paths.worktreesRootDir, { recursive: true });
  mkdirSync(paths.publishRootDir, { recursive: true });
  ensureInitialWorkspace(paths.sampleTemplateDir, paths.workspaceDir);

  apiServer = createServer({
    workspaceDir: paths.workspaceDir,
    importsRootDir: paths.importsRootDir,
    dbPath: paths.dbPath,
    worktreesRootDir: paths.worktreesRootDir,
    publishRootDir: paths.publishRootDir,
    webDistDir: paths.webDistDir,
    ditaRuntime: {
      pluginDir: paths.pluginDir,
    },
    logger: !app.isPackaged,
  });

  const address = await apiServer.listen({ port: 0, host: '127.0.0.1' });
  serverUrl = address;
  serverOrigin = new URL(address).origin;
  return address;
}

function createMainWindow(targetUrl: string): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'DITAEditor',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      // Allow same-origin popups (e.g. published HTML5 preview) inside Electron;
      // open external links in the OS default browser.
      if (serverOrigin && parsed.origin === serverOrigin) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 1200,
            height: 820,
            autoHideMenuBar: true,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        void shell.openExternal(url);
      }
    } catch {
      // Ignore malformed URLs.
    }
    return { action: 'deny' };
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  void win.loadURL(targetUrl);
  return win;
}

function registerIpcHandlers(): void {
  ipcMain.handle('dita:pick-directory', async (_event, defaultPath?: string) => {
    const parent = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      ...(defaultPath ? { defaultPath } : {}),
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0] ?? null;
  });
}

async function shutdownServer(): Promise<void> {
  if (!apiServer) return;
  const server = apiServer;
  apiServer = null;
  // Close BrowserWindows first so Chromium drops HTTP/1.1 keep-alive & SSE connections
  // before Fastify drains; race with a short deadline so quitting can never hang.
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.destroy();
    }
  }
  try {
    await Promise.race([
      server.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
    ]);
  } catch {
    // Ignore shutdown errors while quitting.
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on('before-quit', (event) => {
    if (!apiServer || isShuttingDown) return;
    event.preventDefault();
    isShuttingDown = true;
    void shutdownServer().finally(() => {
      app.quit();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
      mainWindow = createMainWindow(serverUrl);
    }
  });

  void app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(buildApplicationMenu());
      registerIpcHandlers();
      const url = await startEmbeddedServer();
      mainWindow = createMainWindow(url);
    })
    .catch((error: unknown) => {
      const detail = error instanceof Error ? error.stack || error.message : String(error);
      dialog.showErrorBox('DITAEditor Failed to Start', detail);
      app.exit(1);
    });
}
