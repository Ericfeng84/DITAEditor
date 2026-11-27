import { accessSync, constants, cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface DesktopPathInput {
  isPackaged: boolean;
  userDataDir: string;
  resourcesDir: string;
  repoRoot: string;
  dataDirOverride?: string;
}

export interface DesktopRuntimePaths {
  dataDir: string;
  workspaceDir: string;
  importsRootDir: string;
  dbPath: string;
  worktreesRootDir: string;
  publishRootDir: string;
  webDistDir: string;
  sampleTemplateDir: string;
  pluginDir: string;
  htmlThemesDir: string;
}

/**
 * Resolves writable user-data directories and read-only bundled assets for both
 * development (`electron .`) and packaged macOS/Windows desktop builds.
 */
export function resolveDesktopPaths(input: DesktopPathInput): DesktopRuntimePaths {
  const dataDir = path.resolve(input.dataDirOverride?.trim() || input.userDataDir);
  const webDistDir = input.isPackaged
    ? path.join(input.resourcesDir, 'web-dist')
    : path.join(input.repoRoot, 'apps', 'web', 'dist');
  const sampleTemplateDir = input.isPackaged
    ? path.join(input.resourcesDir, 'samples', 'demo-dita-project')
    : path.join(input.repoRoot, 'samples', 'demo-dita-project');
  const pluginDir = input.isPackaged
    ? path.join(input.resourcesDir, 'dita-ot-plugins', 'com.ditaeditor.pdf-cjk')
    : path.join(input.repoRoot, 'dita-ot-plugins', 'com.ditaeditor.pdf-cjk');
  const htmlThemesDir = input.isPackaged
    ? path.join(input.resourcesDir, 'dita-ot-plugins', 'html5-themes')
    : path.join(input.repoRoot, 'dita-ot-plugins', 'html5-themes');

  return {
    dataDir,
    workspaceDir: path.join(dataDir, 'demo-dita-project'),
    importsRootDir: path.join(dataDir, 'workspaces'),
    dbPath: path.join(dataDir, 'dita-editor.sqlite'),
    worktreesRootDir: path.join(dataDir, 'git-worktrees'),
    publishRootDir: path.join(dataDir, 'publishes'),
    webDistDir,
    sampleTemplateDir,
    pluginDir,
    htmlThemesDir,
  };
}

/**
 * Seeds a writable copy of the built-in sample project inside `userData` on first launch.
 * Packaged resources inside `.app` / `Program Files` are read-only, so editing must happen
 * on a copy owned by the current user.
 */
export function ensureInitialWorkspace(sampleTemplateDir: string, workspaceDir: string): boolean {
  mkdirSync(path.dirname(workspaceDir), { recursive: true });
  if (existsSync(workspaceDir)) {
    return false;
  }
  if (!existsSync(sampleTemplateDir)) {
    mkdirSync(workspaceDir, { recursive: true });
    return false;
  }
  cpSync(sampleTemplateDir, workspaceDir, {
    recursive: true,
    filter: (src) => path.basename(src) !== '.git' && path.basename(src) !== '.DS_Store',
  });
  return true;
}

/** Directories copied by `migrateDesktopDataDir` when they exist inside the data root. */
export const DESKTOP_DATA_SUB_ITEMS = [
  'dita-editor.sqlite',
  'demo-dita-project',
  'workspaces',
  'publishes',
] as const;

/** Marker entries whose presence means `targetDir` already holds a DITAEditor data root. */
const EXISTING_DATA_MARKERS = ['dita-editor.sqlite', 'workspaces', 'demo-dita-project'] as const;

function pathDelimiterFor(platform: NodeJS.Platform): string {
  return platform === 'win32' ? ';' : ':';
}

function joinerFor(platform: NodeJS.Platform): (...parts: string[]) => string {
  return platform === 'win32' ? path.win32.join : path.join;
}

/**
 * Normalizes one PATH segment into a comparison key so we never append a duplicate
 * directory. Windows PATH lookups are case-insensitive, POSIX ones are not.
 */
function pathSetKey(entry: string, platform: NodeJS.Platform): string {
  const normalized = path.normalize(entry.trim());
  const trimmed =
    normalized.length > 1 ? normalized.replace(/[\\/]+$/, '') : normalized;
  return platform === 'win32' ? trimmed.toLowerCase() : trimmed;
}

function normalizePathSet(
  entries: readonly string[],
  platform: NodeJS.Platform,
): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    set.add(pathSetKey(trimmed, platform));
  }
  return set;
}

/**
 * GUI apps launched from Finder / Start Menu inherit a minimal PATH that usually lacks
 * Homebrew, `/usr/local/bin` or user-local package managers, so `git`, `java`, `dita`,
 * `docling` and `markitdown` would all look "missing". Append the standard user binary
 * directories (deduplicated, preserving the caller's original order) so the embedded
 * server finds the same tools the user's terminal does.
 */
export function augmentDesktopPath(
  currentPath: string | undefined,
  platform: NodeJS.Platform = process.platform,
  homeDir: string = os.homedir(),
): string {
  const delimiter = pathDelimiterFor(platform);
  const join = joinerFor(platform);
  const current = (currentPath ?? '')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const seen = normalizePathSet(current, platform);

  const candidates: string[] =
    platform === 'win32'
      ? [
          join(homeDir, '.local', 'bin'),
          join(
            process.env.LOCALAPPDATA ?? join(homeDir, 'AppData', 'Local'),
            'Programs',
            'Git',
            'cmd',
          ),
        ]
      : [
          '/opt/homebrew/bin',
          '/opt/homebrew/sbin',
          '/usr/local/bin',
          join(homeDir, '.local', 'bin'),
          join(homeDir, '.cargo', 'bin'),
        ];

  const appended: string[] = [];
  for (const candidate of candidates) {
    const key = pathSetKey(candidate, platform);
    if (seen.has(key)) continue;
    seen.add(key);
    appended.push(candidate);
  }

  return [...current, ...appended].join(delimiter);
}

export interface DesktopDirInspection {
  path: string;
  exists: boolean;
  writable: boolean;
  hasExistingData: boolean;
  isSameAsCurrent: boolean;
  isNestedConflict: boolean;
  error?: string;
}

function isStrictlyInside(parent: string, candidate: string, platform: NodeJS.Platform): boolean {
  const parentKey = pathSetKey(parent, platform);
  const candidateKey = pathSetKey(candidate, platform);
  const separator = platform === 'win32' ? '\\' : '/';
  return candidateKey.startsWith(`${parentKey}${separator}`);
}

function checkDirectoryWritable(
  targetDir: string,
): { writable: boolean; error?: string } {
  let probe = targetDir;
  while (!existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) {
      return { writable: false, error: `No existing parent directory for "${targetDir}".` };
    }
    probe = parent;
  }
  try {
    if (!statSync(probe).isDirectory()) {
      return { writable: false, error: `"${probe}" is not a directory.` };
    }
  } catch (error) {
    return { writable: false, error: toErrorMessage(error) };
  }
  try {
    accessSync(probe, constants.W_OK);
  } catch (error) {
    return { writable: false, error: toErrorMessage(error) };
  }
  return { writable: true };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pre-flight inspection for the "change data folder" dialog. Crucially it detects
 * `isNestedConflict` (target inside current or vice versa) so a migration can never
 * recursively copy a directory into itself.
 */
export function inspectDataDirCandidate(
  targetDir: string,
  currentDataDir: string,
  platform: NodeJS.Platform = process.platform,
): DesktopDirInspection {
  const trimmed = targetDir?.trim() ?? '';
  if (!trimmed) {
    return {
      path: '',
      exists: false,
      writable: false,
      hasExistingData: false,
      isSameAsCurrent: false,
      isNestedConflict: false,
      error: 'A target directory is required.',
    };
  }

  const resolvedTarget = path.resolve(trimmed);
  const resolvedCurrent = path.resolve(currentDataDir);
  const exists = existsSync(resolvedTarget);
  const hasExistingData = EXISTING_DATA_MARKERS.some((marker) =>
    existsSync(path.join(resolvedTarget, marker)),
  );
  const targetKey = pathSetKey(resolvedTarget, platform);
  const currentKey = pathSetKey(resolvedCurrent, platform);
  const isSameAsCurrent = targetKey === currentKey;
  const isNestedConflict =
    !isSameAsCurrent &&
    (isStrictlyInside(resolvedCurrent, resolvedTarget, platform) ||
      isStrictlyInside(resolvedTarget, resolvedCurrent, platform));
  const writableCheck = checkDirectoryWritable(resolvedTarget);

  const inspection: DesktopDirInspection = {
    path: resolvedTarget,
    exists,
    writable: writableCheck.writable,
    hasExistingData,
    isSameAsCurrent,
    isNestedConflict,
  };
  if (writableCheck.error) {
    inspection.error = writableCheck.error;
  }
  return inspection;
}

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Normalizes a Git release tag (e.g. `v1.3.0`) into a clean semver string for desktop installers.
 */
export function normalizeDesktopVersion(raw: string | undefined, fallback: string): string {
  const cleaned = raw?.trim().replace(/^v/i, '') ?? '';
  return SEMVER_PATTERN.test(cleaned) ? cleaned : fallback;
}
