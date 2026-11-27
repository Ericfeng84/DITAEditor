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
import { createServer, resetDitaRuntimeCache, type DitaRuntimeOptions } from '@dita/api';
import {
  augmentDesktopPath,
  ensureInitialWorkspace,
  inspectDataDirCandidate,
  resolveDesktopPaths,
  type DesktopRuntimePaths,
} from './paths.js';
import { migrateDesktopDataDir } from './migration.js';
import { loadDesktopSettings, saveDesktopSettings, type DesktopSettings } from './settings.js';
import type { DataDirSwitchMode, DesktopRuntimeStatus } from './preload.js';

type ApiServer = ReturnType<typeof createServer>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const VALID_SWITCH_MODES: readonly DataDirSwitchMode[] = ['migrate', 'use-existing', 'fresh'];

// Finder/Start-Menu launches inherit a minimal PATH; enrich it before any child process
// (`git`, `java`, `dita`, `docling`, `markitdown`) is spawned by the embedded server.
process.env.PATH = augmentDesktopPath(process.env.PATH);

let mainWindow: BrowserWindow | null = null;
let apiServer: ApiServer | null = null;
let serverUrl: string | null = null;
let serverOrigin: string | null = null;
let isShuttingDown = false;

let activeSettings: DesktopSettings = {};
let activePaths: DesktopRuntimePaths;
/**
 * Mutable runtime options shared with the embedded server. `createServer` keeps this object
 * by reference, so mutating it in place makes new `ditaHome` / `notoFontDir` visible to
 * `PublishService`, `validateStrict` and the ingest agent without a restart.
 */
const ditaRuntimeOptions: DitaRuntimeOptions = { pluginDir: '' };

function envDataDirOverride(): string | undefined {
  const value = process.env.DITA_DESKTOP_DATA_DIR?.trim();
  return value ? value : undefined;
}

function computeDesktopPaths(): DesktopRuntimePaths {
  return resolveDesktopPaths({
    isPackaged: app.isPackaged,
    userDataDir: app.getPath('userData'),
    resourcesDir: process.resourcesPath,
    repoRoot: REPO_ROOT,
    dataDirOverride: envDataDirOverride() ?? activeSettings.dataDir,
  });
}

function defaultDataDir(): string {
  return resolveDesktopPaths({
    isPackaged: app.isPackaged,
    userDataDir: app.getPath('userData'),
    resourcesDir: process.resourcesPath,
    repoRoot: REPO_ROOT,
    dataDirOverride: envDataDirOverride(),
  }).dataDir;
}

function applyRuntimeOptions(): void {
  ditaRuntimeOptions.pluginDir = activePaths.pluginDir;
  if (activeSettings.ditaHome) {
    ditaRuntimeOptions.ditaHome = activeSettings.ditaHome;
  } else {
    delete ditaRuntimeOptions.ditaHome;
  }
  if (activeSettings.notoFontDir) {
    ditaRuntimeOptions.notoFontDir = activeSettings.notoFontDir;
  } else {
    delete ditaRuntimeOptions.notoFontDir;
  }
}

function buildStatus(): DesktopRuntimeStatus {
  const fallbackDataDir = defaultDataDir();
  return {
    dataDir: activePaths.dataDir,
    defaultDataDir: fallbackDataDir,
    isCustomDataDir:
      !envDataDirOverride() && activePaths.dataDir !== path.resolve(fallbackDataDir),
    isEnvOverridden: Boolean(envDataDirOverride()),
    ditaHome: ditaRuntimeOptions.ditaHome ?? null,
    notoFontDir: ditaRuntimeOptions.notoFontDir ?? null,
    pluginGuideDismissed: activeSettings.pluginGuideDismissed === true,
    platform: process.platform,
    paths: {
      workspaceDir: activePaths.workspaceDir,
      importsRootDir: activePaths.importsRootDir,
      dbPath: activePaths.dbPath,
      publishRootDir: activePaths.publishRootDir,
    },
  };
}

function openDesktopSettingsFromMenu(): void {
  const target = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!target || target.isDestroyed()) return;
  target.webContents.send('dita:open-desktop-settings');
}

function buildApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const settingsItem: MenuItemConstructorOptions = {
    label: 'Desktop Settings & Plugins...',
    accelerator: 'CmdOrCtrl+,',
    click: () => {
      openDesktopSettingsFromMenu();
    },
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              settingsItem,
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
      submenu: isMac
        ? [{ role: 'close' }]
        : [settingsItem, { type: 'separator' }, { role: 'quit' }],
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
  const paths = activePaths;

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
    // Shared by reference: `dita:update-preferences` mutates this object in place.
    ditaRuntime: ditaRuntimeOptions,
    htmlThemesDir: paths.htmlThemesDir,
    pdfThemesDir: paths.pdfThemesDir,
    logger: !app.isPackaged,
  });

  const address = await apiServer.listen({ port: 0, host: '127.0.0.1' });
  serverUrl = address;
  serverOrigin = new URL(address).origin;
  return address;
}

/**
 * Closes only the embedded Fastify server (and its SQLite handle) while keeping the window
 * alive. Required before a data-folder migration: the DB must be closed & checkpointed first.
 * Chromium keeps HTTP/1.1 and SSE sockets open, so idle connections are dropped and a
 * lingering stream is force-closed after a short grace period; Fastify's `onClose` hook can
 * therefore always run `database.close()` before we touch the SQLite files.
 */
async function shutdownServerOnly(): Promise<void> {
  if (!apiServer) return;
  const server = apiServer;
  apiServer = null;
  const delay = (ms: number) => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), ms));

  const closePromise = server.close().catch(() => undefined);
  try {
    server.server.closeIdleConnections();
  } catch {
    // Unlistened or already-closed servers have no connections to drop.
  }

  const settled = await Promise.race([
    closePromise.then(() => true),
    delay(2_000).then(() => false),
  ]);
  if (!settled) {
    try {
      server.server.closeAllConnections();
    } catch {
      // Ignore: the server may have finished closing between the race and this call.
    }
    await Promise.race([closePromise, delay(1_000)]);
  }
}

/** Reloads the renderer after the server was restarted on a different port. */
function scheduleWindowReload(url: string): void {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  // Give the IPC reply a tick to flush before the renderer context is replaced.
  setTimeout(() => {
    if (!win.isDestroyed()) {
      void win.loadURL(url);
    }
  }, 150);
}

/**
 * Restarts the embedded server against freshly resolved paths and reloads the window.
 * Paths are recomputed from `activeSettings`/env so callers only have to persist settings.
 */
async function restartEmbeddedServer(): Promise<void> {
  await shutdownServerOnly();
  activePaths = computeDesktopPaths();
  applyRuntimeOptions();
  const url = await startEmbeddedServer();
  scheduleWindowReload(url);
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

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

async function changeDataDir(
  rawInput: unknown,
): Promise<DesktopRuntimeStatus> {
  if (envDataDirOverride()) {
    throw new Error(
      'The data folder is pinned by the DITA_DESKTOP_DATA_DIR environment variable; unset it to change it here.',
    );
  }
  if (isShuttingDown) {
    throw new Error('The application is shutting down.');
  }

  const input =
    rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {};
  const mode = input.mode;
  if (typeof mode !== 'string' || !VALID_SWITCH_MODES.includes(mode as DataDirSwitchMode)) {
    throw new Error('Invalid data folder switch mode.');
  }
  const switchMode = mode as DataDirSwitchMode;
  const rawTarget = typeof input.targetDir === 'string' ? input.targetDir.trim() : '';
  const previousSettings = activeSettings;

  // `targetDir: null` resets to the default (userData) folder without copying anything.
  if (!rawTarget) {
    if (switchMode === 'migrate') {
      throw new Error('Select a target folder to migrate into.');
    }
    await shutdownServerOnly();
    try {
      activeSettings = saveDesktopSettings(app.getPath('userData'), { dataDir: null });
      await restartEmbeddedServer();
    } catch (error) {
      await recoverFromFailedSwitch(previousSettings);
      throw error;
    }
    return buildStatus();
  }

  const inspection = inspectDataDirCandidate(rawTarget, activePaths.dataDir);
  if (inspection.error && !inspection.writable) {
    throw new Error(inspection.error);
  }
  if (inspection.isSameAsCurrent) {
    throw new Error('That folder is already the active data folder.');
  }
  if (inspection.isNestedConflict) {
    // Migrating into a nested folder would recursively copy data into itself.
    throw new Error(
      'The target folder and the current data folder cannot be nested inside one another.',
    );
  }
  if (!inspection.writable) {
    throw new Error(`The target folder is not writable: ${inspection.path}`);
  }
  if (switchMode === 'migrate' && inspection.hasExistingData) {
    throw new Error(
      'The target folder already contains DITAEditor data. Use "use existing" instead of migrating.',
    );
  }
  if (switchMode === 'fresh' && inspection.hasExistingData) {
    throw new Error(
      'The target folder already contains DITAEditor data. Use "use existing" to keep it.',
    );
  }

  // SQLite must be closed (and checkpointed) before files are copied.
  await shutdownServerOnly();
  try {
    if (switchMode === 'migrate') {
      migrateDesktopDataDir({ fromDir: activePaths.dataDir, toDir: inspection.path });
    }
    activeSettings = saveDesktopSettings(app.getPath('userData'), {
      dataDir: inspection.path,
    });
    await restartEmbeddedServer();
  } catch (error) {
    await recoverFromFailedSwitch(previousSettings);
    throw error;
  }
  return buildStatus();
}

/** Restarts the embedded server on the previous data folder after a failed switch. */
async function recoverFromFailedSwitch(previousSettings: DesktopSettings): Promise<void> {
  try {
    activeSettings = saveDesktopSettings(app.getPath('userData'), {
      dataDir: previousSettings.dataDir ?? null,
    });
    await restartEmbeddedServer();
  } catch {
    // A hard startup failure is surfaced by the caller's original error.
  }
}

function updatePreferences(rawPatch: unknown): DesktopRuntimeStatus {
  const record =
    rawPatch && typeof rawPatch === 'object' ? (rawPatch as Record<string, unknown>) : {};
  const patch: {
    ditaHome?: string | null;
    notoFontDir?: string | null;
    pluginGuideDismissed?: boolean;
  } = {};
  if ('ditaHome' in record) {
    patch.ditaHome =
      typeof record.ditaHome === 'string' && record.ditaHome.trim() ? record.ditaHome : null;
  }
  if ('notoFontDir' in record) {
    patch.notoFontDir =
      typeof record.notoFontDir === 'string' && record.notoFontDir.trim()
        ? record.notoFontDir
        : null;
  }
  if (typeof record.pluginGuideDismissed === 'boolean') {
    patch.pluginGuideDismissed = record.pluginGuideDismissed;
  }

  activeSettings = saveDesktopSettings(app.getPath('userData'), patch);
  applyRuntimeOptions();
  // Drop the 30 s DITA-OT detection cache so the new ditaHome/notoFontDir is used at once.
  resetDitaRuntimeCache();
  return buildStatus();
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

  ipcMain.handle('dita:get-desktop-status', () => buildStatus());

  ipcMain.handle('dita:inspect-data-dir', (_event, targetDir?: unknown) => {
    const candidate = requireString(targetDir, 'targetDir');
    return inspectDataDirCandidate(candidate, activePaths.dataDir);
  });

  ipcMain.handle('dita:change-data-dir', (_event, input?: unknown) => changeDataDir(input));

  ipcMain.handle('dita:update-preferences', (_event, patch?: unknown) =>
    updatePreferences(patch),
  );

  ipcMain.handle('dita:open-path', async (_event, targetPath?: unknown) => {
    const resolved = requireString(targetPath, 'targetPath');
    return shell.openPath(resolved);
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
      // Preferences always live in `userData`, never inside the (possibly custom) dataDir.
      activeSettings = loadDesktopSettings(app.getPath('userData'));
      activePaths = computeDesktopPaths();
      applyRuntimeOptions();
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
