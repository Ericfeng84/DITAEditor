import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  createMapTemplate,
  createTopicTemplate,
  extractDitaDocumentTitle,
  extractDitaTopicType,
  findDomElementByPath,
  getNodeSourceRange,
  insertMapNode,
  normalizePosixPath,
  parseDitaMap,
  parseDitaval,
  parseXml,
  resolveDitaHref,
  type DitaFileKind,
  type DitaMapTemplateType,
  type DitaTopicTemplateType,
  type XmlParseError,
} from '@dita/core';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';

export interface WorkspaceFileNode {
  name: string;
  path: string;
  kind: 'directory' | DitaFileKind;
  size?: number;
  mtimeMs?: number;
  children?: WorkspaceFileNode[];
}

export interface WorkspaceMapSummary {
  path: string;
  name: string;
  kind: 'ditamap';
  title: string;
  topicrefCount: number;
  parseError?: XmlParseError;
}

export interface WorkspaceDitavalSummary {
  path: string;
  name: string;
  ruleCount: number;
  parseError?: XmlParseError;
}

export interface WorkspaceSnapshot {
  rootDir: string;
  projectRootDir: string;
  defaultRootDir: string;
  name: string;
  maps: WorkspaceMapSummary[];
  ditavals: WorkspaceDitavalSummary[];
  files: WorkspaceFileNode[];
  topicTitles: Record<string, string>;
  /** Root-element topic type of each scanned topic, so the map tree can show real file types. */
  topicTypes: Record<string, DitaTopicTemplateType>;
  stats: {
    totalFiles: number;
    totalTopics: number;
    totalMaps: number;
    totalImages: number;
  };
}

export interface FileContentResult {
  path: string;
  content: string;
  mtimeMs: number;
  size: number;
  kind: DitaFileKind;
  wellFormed: boolean;
  xmlError?: XmlParseError;
}

export interface WorkspaceRegistryEntry {
  path: string;
  name: string;
  lastOpenedAt: number;
  /** Tombstone written by an explicit forget so discovery keeps the directory hidden. */
  hidden?: boolean;
  /** Set only on list results discovered on disk but never registered. */
  unregistered?: boolean;
}

export interface WorkspaceListItem extends Omit<WorkspaceRegistryEntry, 'hidden'> {
  exists: boolean;
  isDefault: boolean;
  isCurrent: boolean;
}

export interface WorkspacePickerSnapshot {
  current: { path: string; name: string } | null;
  defaultRootDir: string;
  importsRootDir: string;
  workspaces: WorkspaceListItem[];
}

export type WorkspaceScaffold = 'blank' | 'starter';

/** Standard directory skeleton created for a new blank DITA workspace. */
export const WORKSPACE_SCAFFOLD_DIRS = ['topics', 'maps', 'images'] as const;

const MAX_RECENT_WORKSPACES = 12;
const MAX_HIDDEN_WORKSPACES = 50;
const WORKSPACE_REGISTRY_FILENAME = 'workspaces.json';

/** Turn a user-supplied project name into a filesystem-safe directory name. */
export function sanitizeWorkspaceDirName(raw: string): string {
  return raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/^\.+/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export interface WorkspaceDiagnostic {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  source: 'xml' | 'map-ref' | 'asset-ref';
  message: string;
  targetHref?: string;
  resolvedPath?: string;
}

export class WorkspacePathError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'WorkspacePathError';
  }
}

export class WorkspaceNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceNotFoundError';
  }
}

export class WorkspaceConflictError extends Error {
  readonly statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceConflictError';
  }
}

const IGNORED_ENTRIES = new Set(['.git', 'node_modules', '.DS_Store', 'dist', 'out', '.turbo']);

function findRepoRootFromModule(): string {
  let cursor = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(cursor, 'samples', 'demo-dita-project'))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return process.cwd();
}

export function getDefaultWorkspaceDir(): string {
  if (process.env.DITA_WORKSPACE_DIR) {
    return path.resolve(process.env.DITA_WORKSPACE_DIR);
  }
  return path.join(findRepoRootFromModule(), 'samples', 'demo-dita-project');
}

export function getDefaultImportsRootDir(): string {
  if (process.env.DITA_IMPORTS_DIR) {
    return path.resolve(process.env.DITA_IMPORTS_DIR);
  }
  return path.join(findRepoRootFromModule(), '.dita-workspaces');
}

function isWithinRoot(realRoot: string, candidatePath: string): boolean {
  if (candidatePath === realRoot) return true;
  const prefix = realRoot.endsWith(path.sep) ? realRoot : `${realRoot}${path.sep}`;
  return candidatePath.startsWith(prefix);
}

/**
 * Resolve a workspace-relative POSIX path strictly inside `rootDir`,
 * rejecting `..` traversals, absolute paths, null bytes, and symlink escapes.
 */
export async function resolveSafeWorkspacePath(
  rootDir: string,
  relPath: string,
  options: { allowRoot?: boolean } = {},
): Promise<{ absPath: string; posixPath: string }> {
  if (relPath.includes('\0')) {
    throw new WorkspacePathError('Invalid path containing null bytes.');
  }

  const rawTrimmed = relPath.trim();
  if (
    rawTrimmed.startsWith('/') ||
    rawTrimmed.startsWith('\\') ||
    /^[a-zA-Z]:/.test(rawTrimmed)
  ) {
    throw new WorkspacePathError('Absolute paths are not permitted inside workspace.');
  }

  const normalized = normalizePosixPath(rawTrimmed);
  if (!normalized || normalized === '.') {
    if (options.allowRoot) {
      const realRoot = await fs.realpath(rootDir);
      return { absPath: realRoot, posixPath: '' };
    }
    throw new WorkspacePathError('Workspace file path cannot be empty.');
  }

  if (normalized === '..' || normalized.startsWith('../')) {
    throw new WorkspacePathError(`Path "${relPath}" escapes the workspace root.`);
  }

  const realRoot = await fs.realpath(rootDir);
  const absCandidate = path.resolve(realRoot, ...normalized.split('/'));
  if (!isWithinRoot(realRoot, absCandidate)) {
    throw new WorkspacePathError(`Path "${relPath}" escapes the workspace root.`);
  }

  // Verify existing path or nearest existing ancestor does not symlink outside rootDir
  let checkPath = absCandidate;
  while (true) {
    try {
      const realAncestor = await fs.realpath(checkPath);
      if (!isWithinRoot(realRoot, realAncestor)) {
        throw new WorkspacePathError(`Path "${relPath}" resolves outside the workspace root.`);
      }
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw err;
      }
      const parent = path.dirname(checkPath);
      if (parent === checkPath) break;
      checkPath = parent;
    }
  }

  return { absPath: absCandidate, posixPath: normalized };
}

function countMapTreeNodes(nodes: { children?: unknown[] }[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (Array.isArray(node.children)) {
      count += countMapTreeNodes(node.children as { children?: unknown[] }[]);
    }
  }
  return count;
}

export type WorkspaceCreateKind =
  | DitaTopicTemplateType
  | DitaMapTemplateType
  | 'ditaval';

export interface WorkspaceManagerOptions {
  workspaceDir?: string;
  importsRootDir?: string;
  /** Optional override for the persisted recent-workspace registry file. */
  registryPath?: string;
}

export interface WorkspaceMutationCallbacks {
  onFileWritten?: (posixPath: string, content: string) => void | Promise<void>;
  onAssetAdded?: (posixPath: string) => void | Promise<void>;
  onFileDeleted?: (posixPath: string) => void | Promise<void>;
  onFileRenamed?: (fromPath: string, toPath: string) => void | Promise<void>;
  onWorkspaceChanged?: (newRootDir: string) => void | Promise<void>;
}

export class WorkspaceManager {
  readonly defaultRootDir: string;
  readonly importsRootDir: string;
  readonly registryPath: string;
  private activeRootDir: string;
  private projectRootDir: string;
  private callbacks: WorkspaceMutationCallbacks = {};
  private registryChain: Promise<void> = Promise.resolve();

  constructor(options: WorkspaceManagerOptions = {}) {
    this.defaultRootDir = path.resolve(options.workspaceDir ?? getDefaultWorkspaceDir());
    this.importsRootDir = path.resolve(options.importsRootDir ?? getDefaultImportsRootDir());
    this.registryPath = path.resolve(
      options.registryPath ??
        process.env.DITA_WORKSPACES_REGISTRY ??
        path.join(this.importsRootDir, WORKSPACE_REGISTRY_FILENAME),
    );
    this.activeRootDir = this.defaultRootDir;
    this.projectRootDir = this.defaultRootDir;
  }

  setMutationCallbacks(callbacks: WorkspaceMutationCallbacks): void {
    this.callbacks = callbacks;
  }

  async notifyAssetAdded(posixPath: string): Promise<void> {
    await this.callbacks.onAssetAdded?.(posixPath);
  }

  getRootDir(): string {
    return this.activeRootDir;
  }

  /** The primary project checkout; branch worktrees share this identity. */
  getProjectRootDir(): string {
    return this.projectRootDir;
  }

  /**
   * Repoints the active root at a linked `git worktree` without touching the workspace registry.
   * The project root stays stable so locks and repository IDs remain shared across branches.
   */
  async setActiveRootDirForBranch(targetDir: string): Promise<void> {
    const resolved = path.resolve(targetDir);
    let stat;
    try {
      stat = await fs.stat(resolved);
    } catch {
      throw new WorkspaceNotFoundError(`Branch worktree does not exist: ${resolved}`);
    }
    if (!stat.isDirectory()) {
      throw new WorkspacePathError(`Branch worktree is not a directory: ${resolved}`);
    }
    this.activeRootDir = await fs.realpath(resolved);
  }

  /**
   * Binds this manager to an existing workspace directory without recording it in the
   * recent-workspace registry. Used by Phase 10 per-request manual sessions, where the
   * `manuals` table is the source of truth instead of `workspaces.json`.
   */
  async bindRootDir(rootDir: string, projectRootDir: string = rootDir): Promise<void> {
    const resolved = path.resolve(rootDir);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat?.isDirectory()) {
      throw new WorkspaceNotFoundError(`Workspace directory does not exist: ${resolved}`);
    }
    // Keep the path spelling the caller registered (e.g. a macOS `/var` temp dir) instead of
    // its realpath, so responses echo back exactly what was opened.
    this.activeRootDir = resolved;
    this.projectRootDir = path.resolve(projectRootDir);
  }

  async openWorkspace(targetDir: string | { useDefault: true }): Promise<WorkspaceSnapshot> {
    const resolved =
      typeof targetDir === 'string'
        ? path.resolve(targetDir)
        : this.defaultRootDir;

    let stat;
    try {
      stat = await fs.stat(resolved);
    } catch {
      throw new WorkspaceNotFoundError(`Workspace directory does not exist: ${resolved}`);
    }
    if (!stat.isDirectory()) {
      throw new WorkspacePathError(`Target path is not a directory: ${resolved}`);
    }

    this.activeRootDir = await fs.realpath(resolved);
    this.projectRootDir = this.activeRootDir;
    await this.recordWorkspace(this.activeRootDir);
    await this.callbacks.onWorkspaceChanged?.(this.activeRootDir);
    return this.scanWorkspace();
  }

  async importBatchFiles(
    projectName: string,
    files: readonly { path: string; content: string; encoding?: 'utf8' | 'base64' }[],
  ): Promise<WorkspaceSnapshot> {
    const safeName =
      projectName
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'dita-project';
    const destDir = path.join(
      this.importsRootDir,
      `${safeName}-${Date.now().toString(36)}`,
    );
    await fs.mkdir(destDir, { recursive: true });

    for (const file of files) {
      const safe = await resolveSafeWorkspacePath(destDir, file.path);
      await fs.mkdir(path.dirname(safe.absPath), { recursive: true });
      if (file.encoding === 'base64') {
        await fs.writeFile(safe.absPath, Buffer.from(file.content, 'base64'));
      } else {
        await fs.writeFile(safe.absPath, file.content, 'utf8');
      }
    }

    this.activeRootDir = await fs.realpath(destDir);
    this.projectRootDir = this.activeRootDir;
    await this.recordWorkspace(this.activeRootDir, projectName);
    await this.callbacks.onWorkspaceChanged?.(this.activeRootDir);
    return this.scanWorkspace();
  }

  private withRegistryLock<T>(task: () => Promise<T>): Promise<T> {
    const run = this.registryChain.then(task, task);
    this.registryChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async readRegistry(): Promise<WorkspaceRegistryEntry[]> {
    try {
      const raw = await fs.readFile(this.registryPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : (parsed as { workspaces?: unknown } | null)?.workspaces;
      if (!Array.isArray(list)) return [];

      return list
        .flatMap((item): WorkspaceRegistryEntry[] => {
          if (!item || typeof item !== 'object') return [];
          const record = item as Record<string, unknown>;
          if (typeof record.path !== 'string' || !path.isAbsolute(record.path)) return [];
          return [
            {
              path: record.path,
              name:
                typeof record.name === 'string' && record.name.trim()
                  ? record.name
                  : path.basename(record.path),
              lastOpenedAt:
                typeof record.lastOpenedAt === 'number' ? record.lastOpenedAt : 0,
              hidden: record.hidden === true,
            },
          ];
        });
    } catch {
      return [];
    }
  }

  private async writeRegistry(entries: readonly WorkspaceRegistryEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    const serialized = entries.map((entry) => ({
      path: entry.path,
      name: entry.name,
      lastOpenedAt: entry.lastOpenedAt,
      ...(entry.hidden ? { hidden: true } : {}),
    }));
    await fs.writeFile(
      this.registryPath,
      `${JSON.stringify({ version: 1, workspaces: serialized }, null, 2)}\n`,
      'utf8',
    );
  }

  /** Record a workspace as most-recently opened (persisted under the imports root). */
  async recordWorkspace(rootDir: string, name?: string): Promise<void> {
    try {
      await this.withRegistryLock(async () => {
        const entries = (await this.readRegistry()).filter(
          (entry) => entry.path !== rootDir,
        );
        entries.unshift({
          path: rootDir,
          name: name?.trim() || path.basename(rootDir),
          lastOpenedAt: Date.now(),
        });
        const visible = entries
          .filter((entry) => !entry.hidden)
          .slice(0, MAX_RECENT_WORKSPACES);
        const hidden = entries.filter((entry) => entry.hidden);
        await this.writeRegistry([...visible, ...hidden]);
      });
    } catch {
      // Recent-workspace bookkeeping must never block opening a project.
    }
  }

  async listWorkspaces(): Promise<WorkspacePickerSnapshot> {
    const currentReal = await fs.realpath(this.activeRootDir).catch(() => this.activeRootDir);
    const entries = await this.readRegistry();

    const hiddenPaths = new Set<string>();
    for (const entry of entries) {
      if (!entry.hidden) continue;
      hiddenPaths.add(entry.path);
      hiddenPaths.add(await fs.realpath(entry.path).catch(() => entry.path));
    }

    const merged = new Map<string, WorkspaceRegistryEntry>();
    const seed: WorkspaceRegistryEntry[] = [
      { path: currentReal, name: path.basename(currentReal), lastOpenedAt: Date.now() },
      ...entries.filter((entry) => !entry.hidden).slice(0, MAX_RECENT_WORKSPACES),
    ];
    if (!hiddenPaths.has(this.defaultRootDir)) {
      seed.push({
        path: this.defaultRootDir,
        name: path.basename(this.defaultRootDir),
        lastOpenedAt: 0,
      });
    }
    for (const entry of seed) {
      const existing = merged.get(entry.path);
      if (!existing || entry.lastOpenedAt > existing.lastOpenedAt) {
        merged.set(entry.path, entry);
      }
    }

    // Discover workspace dirs under the imports root that were never registered
    // (e.g. created by an older build, copied in by hand, or lost with the registry).
    try {
      const dirents = await fs.readdir(this.importsRootDir, { withFileTypes: true });
      for (const dirent of dirents) {
        if (!dirent.isDirectory() || dirent.name.startsWith('.')) continue;
        const candidate = path.join(this.importsRootDir, dirent.name);
        const real = await fs.realpath(candidate).catch(() => candidate);
        if (merged.has(real) || hiddenPaths.has(real) || hiddenPaths.has(candidate)) continue;
        merged.set(real, {
          path: real,
          name: dirent.name,
          lastOpenedAt: 0,
          unregistered: true,
        });
      }
    } catch {
      // The imports root may not exist yet.
    }

    const workspaces = await Promise.all(
      [...merged.values()].map(async (entry): Promise<WorkspaceListItem> => {
        let exists = false;
        try {
          exists = (await fs.stat(entry.path)).isDirectory();
        } catch {
          exists = false;
        }
        return {
          path: entry.path,
          name: entry.name,
          lastOpenedAt: entry.lastOpenedAt,
          unregistered: entry.unregistered === true,
          exists,
          isDefault: entry.path === this.defaultRootDir,
          isCurrent: entry.path === currentReal,
        };
      }),
    );

    workspaces.sort(
      (a, b) =>
        Number(b.isCurrent) - Number(a.isCurrent) ||
        Number(a.unregistered) - Number(b.unregistered) ||
        b.lastOpenedAt - a.lastOpenedAt ||
        a.name.localeCompare(b.name),
    );

    return {
      current: { path: currentReal, name: path.basename(currentReal) },
      defaultRootDir: this.defaultRootDir,
      importsRootDir: this.importsRootDir,
      workspaces,
    };
  }

  /** Create + initialize a brand-new workspace directory, optionally with a starter topic/map. */
  async createWorkspace(options: {
    name: string;
    parentDir?: string;
    scaffold?: WorkspaceScaffold;
    locale?: ApiLocale;
  }): Promise<WorkspaceSnapshot> {
    const locale: ApiLocale = options.locale ?? 'zh-CN';
    const displayName = options.name.trim();
    if (!displayName) {
      throw new WorkspacePathError('Workspace name cannot be empty.');
    }

    const parentDir = path.resolve(options.parentDir?.trim() || this.importsRootDir);
    // Creating the first manual on a fresh install must not fail because the imports root is absent.
    await fs.mkdir(parentDir, { recursive: true });
    const parentStat = await fs.stat(parentDir);
    if (!parentStat.isDirectory()) {
      throw new WorkspacePathError(`Parent path is not a directory: ${parentDir}`);
    }

    const dirName = sanitizeWorkspaceDirName(displayName) || 'dita-project';
    const targetDir = path.join(parentDir, dirName);

    if (existsSync(targetDir)) {
      const existing = await fs.readdir(targetDir);
      if (existing.length > 0) {
        throw new WorkspaceConflictError(apiT(locale, 'files.targetNotEmpty', { path: targetDir }));
      }
    }

    await fs.mkdir(targetDir, { recursive: true });
    for (const dir of WORKSPACE_SCAFFOLD_DIRS) {
      await fs.mkdir(path.join(targetDir, dir), { recursive: true });
    }

    if (options.scaffold === 'starter') {
      const topicPath = 'topics/introduction.dita';
      const mapXml = createMapTemplate('map', { id: 'index', title: displayName });
      const mapWithTopic = insertMapNode(mapXml, {
        parentPath: null,
        tagName: 'topicref',
        attrs: [
          { name: 'href', value: topicPath, namespaceURI: null },
          { name: 'type', value: 'concept', namespaceURI: null },
        ],
        navtitle: apiT(locale, 'files.projectIntroNavtitle'),
      });
      const topicXml = createTopicTemplate('concept', {
        id: 'introduction',
        title: apiT(locale, 'files.projectIntroTitle', { name: displayName }),
      });
      await fs.writeFile(path.join(targetDir, 'index.ditamap'), mapWithTopic.xml, 'utf8');
      await fs.writeFile(path.join(targetDir, topicPath), topicXml, 'utf8');
    }

    const realRoot = await fs.realpath(targetDir);
    this.activeRootDir = realRoot;
    this.projectRootDir = realRoot;
    await this.recordWorkspace(realRoot, displayName);
    await this.callbacks.onWorkspaceChanged?.(realRoot);
    return this.scanWorkspace();
  }

  async forgetWorkspace(targetDir: string): Promise<WorkspaceListItem[]> {
    const resolved = path.resolve(targetDir);
    const realResolved = await fs.realpath(resolved).catch(() => resolved);
    const currentReal = await fs.realpath(this.activeRootDir).catch(() => this.activeRootDir);

    // Hide the entry instead of deleting it so auto-discovery does not resurrect it.
    if (realResolved !== currentReal) {
      await this.hideWorkspaceDir(realResolved);
    }

    const snapshot = await this.listWorkspaces();
    return snapshot.workspaces;
  }

  /**
   * Writes a hidden tombstone for a directory so both the picker and disk discovery keep it
   * hidden. Phase 10 uses this when a manual is removed from the workbench (disk is untouched).
   */
  async hideWorkspaceDir(targetDir: string): Promise<void> {
    const resolved = path.resolve(targetDir);
    const realResolved = await fs.realpath(resolved).catch(() => resolved);
    await this.withRegistryLock(async () => {
      const entries = await this.readRegistry();
      const remaining = entries.filter(
        (entry) => entry.path !== resolved && entry.path !== realResolved,
      );
      remaining.push({
        path: realResolved,
        name: path.basename(realResolved),
        lastOpenedAt: 0,
        hidden: true,
      });
      const visible = remaining
        .filter((entry) => !entry.hidden)
        .slice(0, MAX_RECENT_WORKSPACES);
      const hidden = remaining.filter((entry) => entry.hidden).slice(-MAX_HIDDEN_WORKSPACES);
      await this.writeRegistry([...visible, ...hidden]);
    });
  }

  /** Raw registry entries, including hidden tombstones (used by the Phase 10 manual sync). */
  async listRegistryEntries(): Promise<WorkspaceRegistryEntry[]> {
    return this.readRegistry();
  }

  async scanWorkspace(): Promise<WorkspaceSnapshot> {
    const realRoot = await fs.realpath(this.activeRootDir);
    const maps: WorkspaceMapSummary[] = [];
    const ditavals: WorkspaceDitavalSummary[] = [];
    const topicTitles: Record<string, string> = {};
    const topicTypes: Record<string, DitaTopicTemplateType> = {};
    const stats = {
      totalFiles: 0,
      totalTopics: 0,
      totalMaps: 0,
      totalImages: 0,
    };

    const walk = async (dirAbs: string, dirPosix: string): Promise<WorkspaceFileNode[]> => {
      const entries = await fs.readdir(dirAbs, { withFileTypes: true });
      const visible = entries.filter((e) => !IGNORED_ENTRIES.has(e.name) && !e.name.startsWith('.'));

      visible.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      const nodes: WorkspaceFileNode[] = [];
      for (const entry of visible) {
        const entryPosix = dirPosix ? `${dirPosix}/${entry.name}` : entry.name;
        const entryAbs = path.join(dirAbs, entry.name);

        if (entry.isDirectory()) {
          const children = await walk(entryAbs, entryPosix);
          nodes.push({
            name: entry.name,
            path: entryPosix,
            kind: 'directory',
            children,
          });
          continue;
        }

        if (!entry.isFile()) continue;
        const st = await fs.stat(entryAbs);
        const kind = classifyDitaFileKind(entry.name);
        stats.totalFiles++;

        if (kind === 'ditamap') {
          stats.totalMaps++;
          const xml = await fs.readFile(entryAbs, 'utf8');
          const check = checkXmlWellFormed(xml, { position: false });
          if (!check.ok) {
            maps.push({
              path: entryPosix,
              name: entry.name,
              kind,
              title: entry.name,
              topicrefCount: 0,
              parseError: check.error,
            });
          } else {
            try {
              const parsed = parseDitaMap(xml);
              maps.push({
                path: entryPosix,
                name: entry.name,
                kind,
                title: parsed.title,
                topicrefCount: countMapTreeNodes(parsed.nodes),
              });
            } catch (err) {
              maps.push({
                path: entryPosix,
                name: entry.name,
                kind,
                title: entry.name,
                topicrefCount: 0,
                parseError: {
                  message: err instanceof Error ? err.message : String(err),
                  line: 1,
                  column: 1,
                  offset: 0,
                },
              });
            }
          }
        } else if (kind === 'ditaval') {
          const xml = await fs.readFile(entryAbs, 'utf8');
          try {
            const parsedVal = parseDitaval(xml);
            ditavals.push({
              path: entryPosix,
              name: entry.name,
              ruleCount: parsedVal.rules.length,
            });
          } catch (err) {
            ditavals.push({
              path: entryPosix,
              name: entry.name,
              ruleCount: 0,
              parseError: {
                message: err instanceof Error ? err.message : String(err),
                line: 1,
                column: 1,
                offset: 0,
              },
            });
          }
        } else if (kind === 'topic') {
          stats.totalTopics++;
          const xml = await fs.readFile(entryAbs, 'utf8');
          const title = extractDitaDocumentTitle(xml);
          if (title) {
            topicTitles[entryPosix] = title;
          }
          const topicType = extractDitaTopicType(xml);
          if (topicType) {
            topicTypes[entryPosix] = topicType;
          }
        } else if (kind === 'image') {
          stats.totalImages++;
        }

        nodes.push({
          name: entry.name,
          path: entryPosix,
          kind,
          size: st.size,
          mtimeMs: st.mtimeMs,
        });
      }

      return nodes;
    };

    const files = await walk(realRoot, '');
    // Prefer root-level maps first, then nested maps alphabetically
    maps.sort((a, b) => {
      const aDepth = a.path.split('/').length;
      const bDepth = b.path.split('/').length;
      if (aDepth !== bDepth) return aDepth - bDepth;
      return a.path.localeCompare(b.path);
    });
    ditavals.sort((a, b) => a.path.localeCompare(b.path));

    return {
      rootDir: realRoot,
      projectRootDir: this.projectRootDir,
      defaultRootDir: this.defaultRootDir,
      name: path.basename(realRoot),
      maps,
      ditavals,
      files,
      topicTitles,
      topicTypes,
      stats,
    };
  }

  async fileExists(relPath: string): Promise<boolean> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, relPath);
    return existsSync(safe.absPath);
  }

  async readFile(relPath: string): Promise<FileContentResult> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, relPath);
    let stat;
    try {
      stat = await fs.stat(safe.absPath);
    } catch {
      throw new WorkspaceNotFoundError(`File not found: ${safe.posixPath}`);
    }
    if (!stat.isFile()) {
      throw new WorkspacePathError(`Target is not a file: ${safe.posixPath}`);
    }

    const content = await fs.readFile(safe.absPath, 'utf8');
    const kind = classifyDitaFileKind(safe.posixPath);
    const isXmlFile = kind === 'ditamap' || kind === 'topic' || kind === 'ditaval';

    if (isXmlFile) {
      const check = checkXmlWellFormed(content, { position: false });
      return {
        path: safe.posixPath,
        content,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        kind,
        wellFormed: check.ok,
        xmlError: check.ok ? undefined : check.error,
      };
    }

    return {
      path: safe.posixPath,
      content,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      kind,
      wellFormed: true,
    };
  }

  async writeFile(
    relPath: string,
    content: string,
    createDirs = true,
  ): Promise<FileContentResult> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, relPath);
    if (createDirs) {
      await fs.mkdir(path.dirname(safe.absPath), { recursive: true });
    }
    await fs.writeFile(safe.absPath, content, 'utf8');
    await this.callbacks.onFileWritten?.(safe.posixPath, content);
    return this.readFile(safe.posixPath);
  }

  async createFromTemplate(options: {
    path: string;
    kind: WorkspaceCreateKind;
    id?: string;
    title?: string;
    lang?: string;
    content?: string;
    overwrite?: boolean;
  }): Promise<FileContentResult> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, options.path);
    if (!options.overwrite && existsSync(safe.absPath)) {
      throw new WorkspaceConflictError(`File already exists: ${safe.posixPath}`);
    }

    let content = options.content;
    if (content === undefined) {
      if (options.kind === 'map') {
        content = createMapTemplate(options.kind, {
          id: options.id,
          title: options.title,
          lang: options.lang,
        });
      } else if (options.kind === 'ditaval') {
        content = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<val>',
          '  <prop att="audience" val="admin" action="include"/>',
          '</val>',
          '',
        ].join('\n');
      } else {
        content = createTopicTemplate(options.kind, {
          id: options.id,
          title: options.title,
          lang: options.lang,
        });
      }
    }

    await fs.mkdir(path.dirname(safe.absPath), { recursive: true });
    await fs.writeFile(safe.absPath, content, 'utf8');
    await this.callbacks.onFileWritten?.(safe.posixPath, content);
    return this.readFile(safe.posixPath);
  }

  async mkdir(relPath: string): Promise<{ path: string }> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, relPath);
    await fs.mkdir(safe.absPath, { recursive: true });
    return { path: safe.posixPath };
  }

  async renamePath(fromPath: string, toPath: string): Promise<{ fromPath: string; toPath: string }> {
    const safeFrom = await resolveSafeWorkspacePath(this.activeRootDir, fromPath);
    const safeTo = await resolveSafeWorkspacePath(this.activeRootDir, toPath);

    if (!existsSync(safeFrom.absPath)) {
      throw new WorkspaceNotFoundError(`Source path not found: ${safeFrom.posixPath}`);
    }
    if (existsSync(safeTo.absPath)) {
      throw new WorkspaceConflictError(`Destination already exists: ${safeTo.posixPath}`);
    }

    await fs.mkdir(path.dirname(safeTo.absPath), { recursive: true });
    await fs.rename(safeFrom.absPath, safeTo.absPath);
    await this.callbacks.onFileRenamed?.(safeFrom.posixPath, safeTo.posixPath);
    return { fromPath: safeFrom.posixPath, toPath: safeTo.posixPath };
  }

  async deletePath(relPath: string): Promise<{ path: string }> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, relPath);
    if (!existsSync(safe.absPath)) {
      throw new WorkspaceNotFoundError(`Path not found: ${safe.posixPath}`);
    }
    const stat = await fs.stat(safe.absPath);
    if (stat.isDirectory()) {
      await fs.rm(safe.absPath, { recursive: true });
    } else {
      await fs.unlink(safe.absPath);
    }
    await this.callbacks.onFileDeleted?.(safe.posixPath);
    return { path: safe.posixPath };
  }

  async readBinaryAsset(relPath: string): Promise<{ buffer: Buffer; posixPath: string; ext: string }> {
    const safe = await resolveSafeWorkspacePath(this.activeRootDir, relPath);
    let stat;
    try {
      stat = await fs.stat(safe.absPath);
    } catch {
      throw new WorkspaceNotFoundError(`Asset not found: ${safe.posixPath}`);
    }
    if (!stat.isFile()) {
      throw new WorkspacePathError(`Asset path is not a file: ${safe.posixPath}`);
    }
    const buffer = await fs.readFile(safe.absPath);
    return {
      buffer,
      posixPath: safe.posixPath,
      ext: path.extname(safe.posixPath).toLowerCase(),
    };
  }

  async collectDiagnostics(
    rootMapPath?: string,
    locale: ApiLocale = 'zh-CN',
  ): Promise<WorkspaceDiagnostic[]> {
    const snapshot = await this.scanWorkspace();
    const fileSet = new Set<string>();

    const collectFilePaths = (nodes: WorkspaceFileNode[]) => {
      for (const node of nodes) {
        if (node.kind === 'directory') {
          if (node.children) collectFilePaths(node.children);
        } else {
          fileSet.add(node.path);
        }
      }
    };
    collectFilePaths(snapshot.files);

    const diagnostics: WorkspaceDiagnostic[] = [];
    const realRoot = snapshot.rootDir;

    // 1. Check XML well-formedness & image asset references across all XML/DITA files
    for (const filePath of fileSet) {
      const kind = classifyDitaFileKind(filePath);
      if (kind !== 'ditamap' && kind !== 'topic' && kind !== 'ditaval') {
        continue;
      }

      const abs = path.join(realRoot, ...filePath.split('/'));
      const xml = await fs.readFile(abs, 'utf8');
      const check = checkXmlWellFormed(xml, { position: true });
      if (!check.ok) {
        diagnostics.push({
          id: `xml:${filePath}:${check.error.line}:${check.error.column}`,
          filePath,
          line: check.error.line,
          column: check.error.column,
          severity: 'error',
          source: 'xml',
          message: apiT(locale, 'files.xmlNotWellFormed', { message: check.error.message }),
        });
        continue;
      }

      if (kind === 'topic') {
        const parsed = check.parsed;
        const images = parsed.document.getElementsByTagName('image');
        for (const imgEl of Array.from(images)) {
          const href = imgEl.getAttribute('href')?.trim();
          if (!href) continue;
          const resolved = resolveDitaHref(filePath, href);
          if (resolved.isExternal) continue;
          const range = getNodeSourceRange(imgEl);
          const line = range.open?.line ?? 1;
          const column = range.open?.column ?? 1;

          if (resolved.escapesRoot || !fileSet.has(resolved.targetPath)) {
            diagnostics.push({
              id: `asset:${filePath}:${line}:${column}:${href}`,
              filePath,
              line,
              column,
              severity: 'warning',
              source: 'asset-ref',
              message: apiT(locale, 'files.imageMissing', { href }),
              targetHref: href,
              resolvedPath: resolved.targetPath || undefined,
            });
          }
        }
      }
    }

    // 2. Traverse active Root Map (or all maps if none specified) for broken href & circular <mapref>
    const mapsToInspect = rootMapPath && fileSet.has(normalizePosixPath(rootMapPath))
      ? [normalizePosixPath(rootMapPath)]
      : snapshot.maps.map((m) => m.path);

    const visitedMaps = new Set<string>();
    const activeStack = new Set<string>();

    const inspectMap = async (mapPath: string) => {
      if (visitedMaps.has(mapPath)) return;
      visitedMaps.add(mapPath);
      activeStack.add(mapPath);

      const abs = path.join(realRoot, ...mapPath.split('/'));
      let xml: string;
      try {
        xml = await fs.readFile(abs, 'utf8');
      } catch {
        activeStack.delete(mapPath);
        return;
      }

      let parsedMap;
      try {
        // Confirm well-formed and parse via @dita/core
        parseXml(xml, { position: false });
        parsedMap = parseDitaMap(xml);
      } catch {
        activeStack.delete(mapPath);
        return;
      }

      for (const ref of parsedMap.references) {
        if (ref.scope === 'external' || ref.scope === 'peer') continue;
        const resolved = resolveDitaHref(mapPath, ref.href);
        if (resolved.isExternal) continue;

        const line = ref.line ?? 1;
        const column = ref.column ?? 1;

        if (resolved.escapesRoot || !resolved.targetPath) {
          diagnostics.push({
            id: `map:${mapPath}:${line}:${column}:${ref.href}`,
            filePath: mapPath,
            line,
            column,
            severity: 'error',
            source: 'map-ref',
            message: apiT(locale, 'files.refOutsideRoot', { href: ref.href }),
            targetHref: ref.href,
          });
          continue;
        }

        if (!fileSet.has(resolved.targetPath)) {
          diagnostics.push({
            id: `map:${mapPath}:${line}:${column}:${ref.href}`,
            filePath: mapPath,
            line,
            column,
            severity: 'error',
            source: 'map-ref',
            message: apiT(locale, 'files.refTargetMissing', {
                href: ref.href,
                resolved: resolved.targetPath,
              }),
            targetHref: ref.href,
            resolvedPath: resolved.targetPath,
          });
          continue;
        }

        if (ref.isSubmapRef) {
          if (activeStack.has(resolved.targetPath)) {
            diagnostics.push({
              id: `cycle:${mapPath}:${line}:${column}:${resolved.targetPath}`,
              filePath: mapPath,
              line,
              column,
              severity: 'error',
              source: 'map-ref',
              message: apiT(locale, 'files.submapCycle', {
                from: mapPath,
                to: resolved.targetPath,
              }),
              targetHref: ref.href,
              resolvedPath: resolved.targetPath,
            });
          } else {
            await inspectMap(resolved.targetPath);
          }
        }
      }

      activeStack.delete(mapPath);
    };

    for (const mapPath of mapsToInspect) {
      await inspectMap(mapPath);
    }

    return diagnostics;
  }
}
