import { cpSync, existsSync, mkdirSync } from 'node:fs';
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

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * Normalizes a Git release tag (e.g. `v1.3.0`) into a clean semver string for desktop installers.
 */
export function normalizeDesktopVersion(raw: string | undefined, fallback: string): string {
  const cleaned = raw?.trim().replace(/^v/i, '') ?? '';
  return SEMVER_PATTERN.test(cleaned) ? cleaned : fallback;
}
