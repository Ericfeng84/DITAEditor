import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Persisted desktop preferences. This file ALWAYS lives in `app.getPath('userData')`,
 * never inside a custom `dataDir` — otherwise switching data folders would lose the
 * very setting that says which folder to use.
 */
export interface DesktopSettings {
  /** Custom data root (SQLite DB, workspaces, publishes). Absent = default userData root. */
  dataDir?: string;
  /** DITA-OT installation root (directory containing `bin/dita`). */
  ditaHome?: string;
  /** Directory containing Noto CJK font files for PDF publishing. */
  notoFontDir?: string;
  /** The web workbench hides the DITA-OT plugin setup guide once this is true. */
  pluginGuideDismissed?: boolean;
}

/** Patch accepted by `saveDesktopSettings`; `null`/`undefined` deletes optional keys. */
export interface DesktopSettingsPatch {
  dataDir?: string | null;
  ditaHome?: string | null;
  notoFontDir?: string | null;
  pluginGuideDismissed?: boolean;
}

export const DESKTOP_SETTINGS_FILENAME = 'desktop-settings.json';

const OPTIONAL_PATH_KEYS = ['dataDir', 'ditaHome', 'notoFontDir'] as const;

export function desktopSettingsPath(userDataDir: string): string {
  return path.join(path.resolve(userDataDir), DESKTOP_SETTINGS_FILENAME);
}

function readPathSetting(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Reads `desktop-settings.json`. A missing, corrupt, or unexpected file yields `{}` so a
 * broken preferences file can never stop the app from starting.
 */
export function loadDesktopSettings(userDataDir: string): DesktopSettings {
  let raw: string;
  try {
    raw = readFileSync(desktopSettingsPath(userDataDir), 'utf8');
  } catch {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  const settings: DesktopSettings = {};
  for (const key of OPTIONAL_PATH_KEYS) {
    const value = readPathSetting(record, key);
    if (value) settings[key] = value;
  }
  if (typeof record.pluginGuideDismissed === 'boolean') {
    settings.pluginGuideDismissed = record.pluginGuideDismissed;
  }
  return settings;
}

/**
 * Merges `patch` into the stored settings and writes the file atomically (temp file +
 * `renameSync`) so a crash mid-write cannot leave a truncated JSON file behind.
 */
export function saveDesktopSettings(
  userDataDir: string,
  patch: DesktopSettingsPatch,
): DesktopSettings {
  const next: DesktopSettings = loadDesktopSettings(userDataDir);

  for (const key of OPTIONAL_PATH_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value === undefined || value === null) {
      delete next[key];
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      delete next[key];
      continue;
    }
    next[key] = trimmed;
  }
  if (typeof patch.pluginGuideDismissed === 'boolean') {
    next.pluginGuideDismissed = patch.pluginGuideDismissed;
  }

  const targetPath = desktopSettingsPath(userDataDir);
  const directory = path.dirname(targetPath);
  mkdirSync(directory, { recursive: true });

  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    renameSync(tempPath, targetPath);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
  return next;
}

/** Small helper used by the main process when reading back a settings file just written. */
export function desktopSettingsFileExists(userDataDir: string): boolean {
  return existsSync(desktopSettingsPath(userDataDir));
}
