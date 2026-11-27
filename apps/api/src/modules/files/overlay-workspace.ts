import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  createMapTemplate,
  createTopicTemplate,
  extractDitaDocumentTitle,
  extractDitaTopicType,
  parseDitaMap,
  parseDitaval,
  type DitaFileKind,
  type XmlParseError,
} from '@dita/core';
import type { WorkingDraftRow } from '../../db/schema.js';
import {
  computeContentHash,
  type DraftOp,
  type DraftService,
} from '../locks/draft-service.js';
import {
  WorkspaceNotFoundError,
  WorkspacePathError,
  resolveSafeWorkspacePath,
  type FileContentResult,
  type WorkspaceDitavalSummary,
  type WorkspaceFileNode,
  type WorkspaceManager,
  type WorkspaceMapSummary,
  type WorkspaceSnapshot,
} from './workspace-fs.js';

/**
 * Phase 13 Stage 1 — read-side draft overlay for the shared branch worktree.
 *
 * The shared branch `workDir` always stays clean at Git `HEAD`; a user's
 * uncommitted `edit` / `create` / `delete` / `rename` drafts live in SQLite
 * (`working_drafts`, guarded by `file_locks`) plus out-of-repo draft assets.
 * These helpers merge that personal overlay on top of a baseline disk scan so
 * file routes, asset routes and diagnostics see `Baseline ⊎ caller drafts`.
 */
export interface OverlayScope {
  projectId: string;
  branch: string;
  userId: string;
}

export interface OverlayFileContent extends FileContentResult {
  /** Stable short hash of the returned content, used for optimistic-concurrency checks. */
  contentHash: string;
  isDraft: boolean;
  draftOp: DraftOp | null;
}

export interface OverlayFileExists {
  exists: boolean;
  existsInBaseline: boolean;
  draft: WorkingDraftRow | null;
}

export interface OverlayAsset {
  buffer: Buffer;
  ext: string;
  path: string;
  size: number;
  isDraft: boolean;
}

const XML_KINDS = new Set<DitaFileKind>(['ditamap', 'ditaval', 'topic']);

function countMapTreeNodes(nodes: { children?: unknown[] }[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (Array.isArray(node.children)) {
      count += countMapTreeNodes(node.children as { children?: unknown[] }[]);
    }
  }
  return count;
}

function toParseError(err: unknown): XmlParseError {
  return {
    message: err instanceof Error ? err.message : String(err),
    line: 1,
    column: 1,
    offset: 0,
  };
}

function mapSummaryFor(
  filePath: string,
  kind: 'ditamap',
  xml: string,
): WorkspaceMapSummary {
  const name = filePath.split('/').pop() ?? filePath;
  const check = checkXmlWellFormed(xml, { position: false });
  if (!check.ok) {
    return { path: filePath, name, kind, title: name, topicrefCount: 0, parseError: check.error };
  }
  try {
    const parsed = parseDitaMap(xml);
    return {
      path: filePath,
      name,
      kind,
      title: parsed.title,
      topicrefCount: countMapTreeNodes(parsed.nodes),
    };
  } catch (err) {
    return { path: filePath, name, kind, title: name, topicrefCount: 0, parseError: toParseError(err) };
  }
}

function ditavalSummaryFor(filePath: string, xml: string): WorkspaceDitavalSummary {
  const name = filePath.split('/').pop() ?? filePath;
  try {
    const parsed = parseDitaval(xml);
    return { path: filePath, name, ruleCount: parsed.rules.length };
  } catch (err) {
    return { path: filePath, name, ruleCount: 0, parseError: toParseError(err) };
  }
}

function findUserDraft(
  drafts: DraftService,
  scope: OverlayScope,
  filePath: string,
): WorkingDraftRow | null {
  return drafts.getUserDraft(scope.projectId, scope.branch, scope.userId, filePath);
}

function findRenamedAwayDraft(
  drafts: DraftService,
  scope: OverlayScope,
  filePath: string,
): WorkingDraftRow | null {
  return drafts.findUserDraftByOriginalPath(
    scope.projectId,
    scope.branch,
    scope.userId,
    filePath,
  );
}

// ---------------------------------------------------------------------------
// File tree helpers
// ---------------------------------------------------------------------------

function removeFileNode(nodes: WorkspaceFileNode[], targetPath: string): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node) continue;
    if (node.path === targetPath && node.kind !== 'directory') {
      nodes.splice(index, 1);
      return true;
    }
    if (node.kind === 'directory' && node.children) {
      const removed = removeFileNode(node.children, targetPath);
      if (removed) {
        if (node.children.length === 0) {
          nodes.splice(index, 1);
        }
        return true;
      }
    }
  }
  return false;
}

function insertFileNode(nodes: WorkspaceFileNode[], node: WorkspaceFileNode): void {
  const segments = node.path.split('/').filter((segment) => segment.length > 0);
  insertFileNodeAt(nodes, segments, '', node);
}

/**
 * Insert (or replace) a file node, creating missing parent directories.
 *
 * `WorkspaceFileNode.path` is always the FULL workspace-relative POSIX path at every tree
 * level (see `WorkspaceManager.scanWorkspace`), so it must never be shortened while
 * descending — an edit draft on `concepts/foo.dita` used to overwrite the baseline node
 * with `path: 'foo.dita'`, which broke `fileSet` lookups (map tree showed a false
 * “missing target” warning and file actions addressed a phantom root-level file).
 */
function insertFileNodeAt(
  nodes: WorkspaceFileNode[],
  segments: readonly string[],
  parentPath: string,
  node: WorkspaceFileNode,
): void {
  const [head, ...rest] = segments;
  if (!head) return;

  if (rest.length === 0) {
    const existingIndex = nodes.findIndex(
      (candidate) => candidate.kind !== 'directory' && candidate.name === head,
    );
    if (existingIndex >= 0) {
      nodes[existingIndex] = node;
    } else {
      nodes.push(node);
    }
    sortNodes(nodes);
    return;
  }

  const dirPath = parentPath ? `${parentPath}/${head}` : head;
  let dir = nodes.find(
    (candidate) => candidate.kind === 'directory' && candidate.name === head,
  );
  if (!dir) {
    dir = {
      name: head,
      path: dirPath,
      kind: 'directory',
      children: [],
    };
    nodes.push(dir);
  } else if (dir.path !== dirPath) {
    // Repair directories synthesized by an older build that stored a truncated path.
    dir.path = dirPath;
  }
  if (!dir.children) dir.children = [];
  insertFileNodeAt(dir.children, rest, dirPath, node);
  sortNodes(nodes);
}

function sortNodes(nodes: WorkspaceFileNode[]): void {
  nodes.sort((a, b) => {
    if ((a.kind === 'directory') !== (b.kind === 'directory')) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function collectFileNodes(nodes: WorkspaceFileNode[], out: WorkspaceFileNode[]): void {
  for (const node of nodes) {
    if (node.kind === 'directory') {
      if (node.children) collectFileNodes(node.children, out);
      continue;
    }
    out.push(node);
  }
}

function recomputeStats(files: WorkspaceFileNode[]): WorkspaceSnapshot['stats'] {
  const flat: WorkspaceFileNode[] = [];
  collectFileNodes(files, flat);

  const stats = {
    totalFiles: 0,
    totalTopics: 0,
    totalMaps: 0,
    totalImages: 0,
  };
  for (const node of flat) {
    stats.totalFiles += 1;
    if (node.kind === 'topic') stats.totalTopics += 1;
    else if (node.kind === 'ditamap') stats.totalMaps += 1;
    else if (node.kind === 'image') stats.totalImages += 1;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Snapshot with overlay
// ---------------------------------------------------------------------------

/**
 * Scan the clean branch worktree and merge the caller's drafts on top:
 * deleted / renamed-away baseline paths are hidden, while draft targets are
 * added as file nodes (with synthesized parent directories).
 */
export async function scanWorkspaceWithOverlay(
  workspace: WorkspaceManager,
  drafts: DraftService,
  scope: OverlayScope,
): Promise<WorkspaceSnapshot> {
  const snapshot = await workspace.scanWorkspace();
  const rows = drafts.listUserDrafts(scope.projectId, scope.branch, scope.userId);
  if (rows.length === 0) return snapshot;

  const files = snapshot.files;
  const maps = snapshot.maps.filter((entry) => entry.path.length > 0);
  const ditavals = snapshot.ditavals.slice();
  const topicTitles = { ...snapshot.topicTitles };
  const topicTypes = { ...snapshot.topicTypes };

  const hidePath = (filePath: string) => {
    removeFileNode(files, filePath);
    const mapIndex = maps.findIndex((entry) => entry.path === filePath);
    if (mapIndex >= 0) maps.splice(mapIndex, 1);
    const ditavalIndex = ditavals.findIndex((entry) => entry.path === filePath);
    if (ditavalIndex >= 0) ditavals.splice(ditavalIndex, 1);
    delete topicTitles[filePath];
    delete topicTypes[filePath];
  };

  const addPath = (draft: WorkingDraftRow) => {
    const filePath = draft.filePath;
    const kind = classifyDitaFileKind(filePath);
    const content = draft.content ?? '';
    insertFileNode(files, {
      name: filePath.split('/').pop() ?? filePath,
      path: filePath,
      kind,
      size: content.length,
      mtimeMs: draft.updatedAt,
    });

    if (kind === 'ditamap') {
      maps.push(mapSummaryFor(filePath, kind, content));
      return;
    }
    if (kind === 'ditaval') {
      ditavals.push(ditavalSummaryFor(filePath, content));
      return;
    }
    if (kind === 'topic') {
      const title = extractDitaDocumentTitle(content);
      if (title) topicTitles[filePath] = title;
      const topicType = extractDitaTopicType(content);
      if (topicType) topicTypes[filePath] = topicType;
    }
  };

  for (const draft of rows) {
    if (draft.op === 'delete') {
      hidePath(draft.filePath);
      continue;
    }
    if (draft.op === 'rename' && draft.originalPath) {
      hidePath(draft.originalPath);
    }
    addPath(draft);
  }

  maps.sort((a, b) => {
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.path.localeCompare(b.path);
  });
  ditavals.sort((a, b) => a.path.localeCompare(b.path));

  return {
    ...snapshot,
    maps,
    ditavals,
    files,
    topicTitles,
    topicTypes,
    stats: recomputeStats(files),
  };
}

// ---------------------------------------------------------------------------
// File reads with overlay
// ---------------------------------------------------------------------------

/** Read a file as the caller sees it: their draft text, else clean baseline content. */
export async function readFileWithOverlay(
  workspace: WorkspaceManager,
  drafts: DraftService,
  scope: OverlayScope,
  filePath: string,
): Promise<OverlayFileContent> {
  const draft = findUserDraft(drafts, scope, filePath);

  if (draft && draft.op === 'delete') {
    throw new WorkspaceNotFoundError(`File not found: ${filePath}`);
  }

  if (draft && draft.content !== null) {
    const content = draft.content;
    const kind = classifyDitaFileKind(draft.filePath);
    const check = XML_KINDS.has(kind)
      ? checkXmlWellFormed(content, { position: false })
      : { ok: true as const };
    return {
      path: draft.filePath,
      content,
      mtimeMs: draft.updatedAt,
      size: Buffer.byteLength(content, 'utf8'),
      kind,
      wellFormed: check.ok,
      ...(check.ok ? {} : { xmlError: check.error }),
      contentHash: draft.contentHash ?? computeContentHash(content),
      isDraft: true,
      draftOp: draft.op,
    };
  }

  if (!draft) {
    const renamedAway = findRenamedAwayDraft(drafts, scope, filePath);
    if (renamedAway) {
      throw new WorkspaceNotFoundError(`File not found: ${filePath}`);
    }
  }

  const baseline = await workspace.readFile(filePath);
  return {
    ...baseline,
    contentHash: computeContentHash(baseline.content),
    isDraft: false,
    draftOp: null,
  };
}

/**
 * Check whether a path exists for the caller, splitting baseline existence from
 * overlay existence so callers can distinguish `create` from `edit`.
 */
export async function fileExistsInOverlay(
  workspace: WorkspaceManager,
  drafts: DraftService,
  scope: OverlayScope,
  filePath: string,
): Promise<OverlayFileExists> {
  const draft = findUserDraft(drafts, scope, filePath);
  const existsInBaseline = await workspace.fileExists(filePath);

  if (draft) {
    return { exists: draft.op !== 'delete', existsInBaseline, draft };
  }

  const renamedAway = findRenamedAwayDraft(drafts, scope, filePath);
  return {
    exists: existsInBaseline && renamedAway === null,
    existsInBaseline,
    draft: null,
  };
}

// ---------------------------------------------------------------------------
// Binary assets with overlay
// ---------------------------------------------------------------------------

/** Read an image asset, preferring the caller's out-of-repo draft blob. */
export async function readBinaryAssetWithOverlay(
  workspace: WorkspaceManager,
  drafts: DraftService,
  scope: OverlayScope,
  filePath: string,
): Promise<OverlayAsset> {
  const draft = findUserDraft(drafts, scope, filePath);

  if (draft && draft.op === 'delete') {
    throw new WorkspaceNotFoundError(`Asset not found: ${filePath}`);
  }

  if (draft && draft.assetBlobPath) {
    const buffer = drafts.readBinaryDraft(draft);
    if (buffer) {
      const ext = draft.filePath.slice(draft.filePath.lastIndexOf('.')).toLowerCase();
      return { buffer, ext, path: draft.filePath, size: buffer.byteLength, isDraft: true };
    }
  }

  if (!draft) {
    const renamedAway = findRenamedAwayDraft(drafts, scope, filePath);
    if (renamedAway) {
      throw new WorkspaceNotFoundError(`Asset not found: ${filePath}`);
    }
  }

  const baseline = await workspace.readBinaryAsset(filePath);
  const buffer = Buffer.isBuffer(baseline.buffer) ? baseline.buffer : Buffer.from(baseline.buffer);
  return {
    buffer,
    ext: baseline.ext,
    path: baseline.posixPath,
    size: buffer.byteLength,
    isDraft: false,
  };
}

/** Normalize a caller-supplied relative path exactly like the file routes do. */
export async function normalizeOverlayPath(
  workspace: WorkspaceManager,
  rawPath: string,
): Promise<string> {
  const safe = await resolveSafeWorkspacePath(workspace.getRootDir(), rawPath);
  if (safe.posixPath.length === 0) {
    throw new WorkspacePathError('Target path is required.');
  }
  return safe.posixPath;
}

// ---------------------------------------------------------------------------
// Template content (in-memory, so draft creates never touch the shared workDir)
// ---------------------------------------------------------------------------

export type OverlayCreateKind =
  | 'concept'
  | 'task'
  | 'reference'
  | 'topic'
  | 'map'
  | 'ditaval';

const DITAVAL_TEMPLATE = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<val>',
  '  <prop att="audience" val="admin" action="include"/>',
  '</val>',
  '',
].join('\n');

/** Same bytes `WorkspaceManager.createFromTemplate` writes, generated without disk I/O. */
export function buildTemplateContent(
  kind: OverlayCreateKind,
  options: { id?: string; title?: string; lang?: string } = {},
): string {
  if (kind === 'map') {
    return createMapTemplate(kind, options);
  }
  if (kind === 'ditaval') {
    return DITAVAL_TEMPLATE;
  }
  return createTopicTemplate(kind, options);
}
