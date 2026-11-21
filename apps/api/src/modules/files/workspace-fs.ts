import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  createMapTemplate,
  createTopicTemplate,
  extractDitaDocumentTitle,
  getNodeSourceRange,
  normalizePosixPath,
  parseDitaMap,
  parseXml,
  resolveDitaHref,
  type DitaFileKind,
  type DitaMapTemplateType,
  type DitaTopicTemplateType,
  type XmlParseError,
} from '@dita/core';

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
  kind: 'ditamap' | 'bookmap';
  title: string;
  topicrefCount: number;
  parseError?: XmlParseError;
}

export interface WorkspaceSnapshot {
  rootDir: string;
  defaultRootDir: string;
  name: string;
  maps: WorkspaceMapSummary[];
  files: WorkspaceFileNode[];
  topicTitles: Record<string, string>;
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
}

export class WorkspaceManager {
  readonly defaultRootDir: string;
  readonly importsRootDir: string;
  private activeRootDir: string;

  constructor(options: WorkspaceManagerOptions = {}) {
    this.defaultRootDir = path.resolve(options.workspaceDir ?? getDefaultWorkspaceDir());
    this.importsRootDir = path.resolve(options.importsRootDir ?? getDefaultImportsRootDir());
    this.activeRootDir = this.defaultRootDir;
  }

  getRootDir(): string {
    return this.activeRootDir;
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
    return this.scanWorkspace();
  }

  async scanWorkspace(): Promise<WorkspaceSnapshot> {
    const realRoot = await fs.realpath(this.activeRootDir);
    const maps: WorkspaceMapSummary[] = [];
    const topicTitles: Record<string, string> = {};
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

        if (kind === 'ditamap' || kind === 'bookmap') {
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
        } else if (kind === 'topic') {
          stats.totalTopics++;
          const xml = await fs.readFile(entryAbs, 'utf8');
          const title = extractDitaDocumentTitle(xml);
          if (title) {
            topicTitles[entryPosix] = title;
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

    return {
      rootDir: realRoot,
      defaultRootDir: this.defaultRootDir,
      name: path.basename(realRoot),
      maps,
      files,
      topicTitles,
      stats,
    };
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
    const isXmlFile =
      kind === 'ditamap' ||
      kind === 'bookmap' ||
      kind === 'topic' ||
      kind === 'ditaval';

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
      if (options.kind === 'map' || options.kind === 'bookmap') {
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

  async collectDiagnostics(rootMapPath?: string): Promise<WorkspaceDiagnostic[]> {
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
      if (kind !== 'ditamap' && kind !== 'bookmap' && kind !== 'topic' && kind !== 'ditaval') {
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
          message: `XML 良构错误：${check.error.message}`,
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
              message: `引用图片不存在或超出工作区：${href}`,
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
            message: `引用路径超出工作区根目录：${ref.href}`,
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
            message: `目标文件不存在：${ref.href}（解析路径：${resolved.targetPath}）`,
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
              message: `检测到循环子地图引用 (<mapref>)：${mapPath} -> ${resolved.targetPath}`,
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
