import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { workingDrafts, type WorkingDraftRow } from '../../db/schema.js';
import { httpError } from '../errors.js';

/**
 * Phase 13 personal draft overlay.
 *
 * Uncommitted edits (`edit` / `create` / `delete` / `rename`) live in SQLite
 * `working_drafts` and never touch the shared branch `workDir`, which stays clean at
 * Git `HEAD`. Binary draft assets (images) live outside the repository in
 * `draftAssetsRootDir`, keyed by draft id, so Git never sees them and `git status`
 * stays clean.
 */
export type DraftOp = 'edit' | 'create' | 'delete' | 'rename';

export interface DraftView {
  id: string;
  projectId: string;
  branch: string;
  filePath: string;
  userId: string;
  op: DraftOp;
  originalPath: string | null;
  contentHash: string | null;
  isBinary: boolean;
  baseCommit: string | null;
  updatedAt: string;
}

/**
 * Local mirror of `@dita/core`'s `SemanticOverlayOperation` so this module does not
 * depend on the semantic-engine build (Task 1A) at type level.
 */
export type SemanticOverlayOperation =
  | { op: 'edit' | 'create'; filePath: string; content: string }
  | { op: 'delete'; filePath: string }
  | { op: 'rename'; originalPath: string; filePath: string; content?: string | null };

export interface DraftServiceOptions {
  db: DitaDatabase;
  /** Out-of-repo root for draft binary assets (e.g. `<dataRoot>/draft-assets`). */
  draftAssetsRootDir: string;
}

export interface UpsertTextDraftInput {
  projectId: string;
  branch: string;
  filePath: string;
  userId: string;
  op: DraftOp;
  content: string;
  baseCommit: string | null;
  originalPath?: string | null;
}

export interface UpsertBinaryDraftInput {
  projectId: string;
  branch: string;
  filePath: string;
  userId: string;
  op: DraftOp;
  buffer: Buffer;
  ext: string;
  baseCommit: string | null;
  originalPath?: string | null;
}

export interface MarkDeletedInput {
  projectId: string;
  branch: string;
  filePath: string;
  userId: string;
  baseCommit: string | null;
  existsInBaseline: boolean;
}

export interface MarkDeletedResult {
  removedCreateOnly: boolean;
  originalPath?: string | null;
  draft: WorkingDraftRow | null;
}

export interface MarkRenamedInput {
  projectId: string;
  branch: string;
  fromPath: string;
  toPath: string;
  userId: string;
  content: string | null;
  baseCommit: string | null;
  existsInBaseline: boolean;
}

export interface MarkRenamedResult {
  draft: WorkingDraftRow;
  rootOriginalPath: string | null;
}

export interface MaterializeOverlayInput {
  baselineDir: string;
  projectId: string;
  branch: string;
  userId: string;
  destDir: string;
}

export interface MaterializeOverlayResult {
  appliedCount: number;
  appliedPaths: string[];
}

const ORPHAN_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SEMANTIC_EXTENSIONS = new Set(['.dita', '.ditamap', '.bookmap', '.ditaval']);
const MATERIALIZE_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  '.turbo',
  '.dita-workspaces',
  '.DS_Store',
]);

export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

function normalizeExtension(ext: string): string {
  const base = ext.replace(/[^A-Za-z0-9.]/g, '').toLowerCase();
  if (!base) return '';
  return base.startsWith('.') ? base : `.${base}`;
}

function extensionOf(filePath: string): string {
  const index = filePath.lastIndexOf('.');
  return index >= 0 ? filePath.slice(index).toLowerCase() : '';
}

function isBinaryDraft(row: WorkingDraftRow): boolean {
  return row.assetBlobPath !== null || (row.content === null && row.op !== 'delete');
}

export class DraftService {
  private readonly db: DitaDatabase;
  private readonly draftAssetsRootDir: string;
  private readonly draftRevs = new Map<string, number>();

  constructor(options: DraftServiceOptions) {
    this.db = options.db;
    this.draftAssetsRootDir = options.draftAssetsRootDir;
  }

  get assetsRootDir(): string {
    return this.draftAssetsRootDir;
  }

  private revKey(projectId: string, branch: string, userId: string): string {
    return `${projectId}::${branch}::${userId}`;
  }

  /** Monotonic in-memory revision used to invalidate cached overlay semantic indexes. */
  getDraftRev(projectId: string, branch: string, userId: string): number {
    return this.draftRevs.get(this.revKey(projectId, branch, userId)) ?? 0;
  }

  bumpDraftRev(projectId: string, branch: string, userId: string): number {
    const key = this.revKey(projectId, branch, userId);
    const next = (this.draftRevs.get(key) ?? 0) + 1;
    this.draftRevs.set(key, next);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  listUserDrafts(projectId: string, branch: string, userId: string): WorkingDraftRow[] {
    return this.db
      .select()
      .from(workingDrafts)
      .where(
        and(
          eq(workingDrafts.projectId, projectId),
          eq(workingDrafts.branch, branch),
          eq(workingDrafts.userId, userId),
        ),
      )
      .all();
  }

  listUserDraftViews(projectId: string, branch: string, userId: string): DraftView[] {
    return this.listUserDrafts(projectId, branch, userId).map((row) => this.toView(row));
  }

  listBranchDrafts(projectId: string, branch: string): WorkingDraftRow[] {
    return this.db
      .select()
      .from(workingDrafts)
      .where(and(eq(workingDrafts.projectId, projectId), eq(workingDrafts.branch, branch)))
      .all();
  }

  getDraft(projectId: string, branch: string, filePath: string): WorkingDraftRow | null {
    return (
      this.db
        .select()
        .from(workingDrafts)
        .where(
          and(
            eq(workingDrafts.projectId, projectId),
            eq(workingDrafts.branch, branch),
            eq(workingDrafts.filePath, filePath),
          ),
        )
        .get() ?? null
    );
  }

  getUserDraft(
    projectId: string,
    branch: string,
    userId: string,
    filePath: string,
  ): WorkingDraftRow | null {
    const row = this.getDraft(projectId, branch, filePath);
    return row && row.userId === userId ? row : null;
  }

  findUserDraftByOriginalPath(
    projectId: string,
    branch: string,
    userId: string,
    originalPath: string,
  ): WorkingDraftRow | null {
    return (
      this.db
        .select()
        .from(workingDrafts)
        .where(
          and(
            eq(workingDrafts.projectId, projectId),
            eq(workingDrafts.branch, branch),
            eq(workingDrafts.userId, userId),
            eq(workingDrafts.originalPath, originalPath),
          ),
        )
        .get() ?? null
    );
  }

  /** True when the user has any draft (by target or rename original path) for `filePath`. */
  hasDirtyDraft(projectId: string, branch: string, userId: string, filePath: string): boolean {
    if (this.getUserDraft(projectId, branch, userId, filePath)) return true;
    return this.findUserDraftByOriginalPath(projectId, branch, userId, filePath) !== null;
  }

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  upsertTextDraft(input: UpsertTextDraftInput): WorkingDraftRow {
    const existing = this.claimExisting(input.projectId, input.branch, input.filePath, input.userId);
    const updatedAt = Date.now();
    const preserve =
      existing !== null && existing.userId === input.userId && (existing.op === 'create' || existing.op === 'rename');
    const op = preserve ? existing.op : input.op;
    const originalPath = preserve ? existing.originalPath : input.originalPath ?? null;
    if (existing?.assetBlobPath) {
      this.removeBlob(existing.assetBlobPath);
    }
    const row: WorkingDraftRow = {
      id: existing?.id ?? randomUUID(),
      projectId: input.projectId,
      branch: input.branch,
      filePath: input.filePath,
      userId: input.userId,
      op,
      originalPath,
      content: input.content,
      assetBlobPath: null,
      baseCommit: input.baseCommit,
      contentHash: computeContentHash(input.content),
      updatedAt,
    };
    this.persist(row, existing !== null);
    return row;
  }

  upsertBinaryDraft(input: UpsertBinaryDraftInput): WorkingDraftRow {
    const existing = this.claimExisting(input.projectId, input.branch, input.filePath, input.userId);
    const updatedAt = Date.now();
    const preserve =
      existing !== null && existing.userId === input.userId && (existing.op === 'create' || existing.op === 'rename');
    const op = preserve ? existing.op : input.op;
    const originalPath = preserve ? existing.originalPath : input.originalPath ?? null;
    const id = existing?.id ?? randomUUID();
    const ext = normalizeExtension(input.ext);
    const blobPath = `${input.projectId}/${id}${ext}`;
    const absolute = join(this.draftAssetsRootDir, blobPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, input.buffer);
    if (existing?.assetBlobPath && existing.assetBlobPath !== blobPath) {
      this.removeBlob(existing.assetBlobPath);
    }
    const row: WorkingDraftRow = {
      id,
      projectId: input.projectId,
      branch: input.branch,
      filePath: input.filePath,
      userId: input.userId,
      op,
      originalPath,
      content: null,
      assetBlobPath: blobPath,
      baseCommit: input.baseCommit,
      contentHash: hashBuffer(input.buffer),
      updatedAt,
    };
    this.persist(row, existing !== null);
    return row;
  }

  /** Removes only the on-disk blob for a draft row (used after a transactional delete). */
  removeBlobForDraft(draft: WorkingDraftRow): void {
    if (draft.assetBlobPath) this.removeBlob(draft.assetBlobPath);
  }

  readBinaryDraft(draft: WorkingDraftRow): Buffer | null {
    if (!draft.assetBlobPath) return null;
    try {
      return readFileSync(join(this.draftAssetsRootDir, draft.assetBlobPath));
    } catch {
      return null;
    }
  }

  markDeleted(input: MarkDeletedInput): MarkDeletedResult {
    const { projectId, branch, filePath, userId, baseCommit, existsInBaseline } = input;
    const existing = this.getUserDraft(projectId, branch, userId, filePath);

    if (existing?.op === 'create') {
      this.removeDraftRow(existing);
      return { removedCreateOnly: true, draft: null, originalPath: null };
    }

    if (existing?.op === 'rename' && existing.originalPath) {
      const originalPath = existing.originalPath;
      this.removeDraftRow(existing);
      if (existsInBaseline) {
        const deleteDraft = this.writeRow({
          id: randomUUID(),
          projectId,
          branch,
          filePath: originalPath,
          userId,
          op: 'delete',
          originalPath: null,
          content: null,
          assetBlobPath: null,
          baseCommit,
          contentHash: null,
          updatedAt: Date.now(),
        });
        return { removedCreateOnly: false, originalPath, draft: deleteDraft };
      }
      return { removedCreateOnly: false, originalPath, draft: null };
    }

    const deleteDraft = this.writeRow({
      id: existing?.id ?? randomUUID(),
      projectId,
      branch,
      filePath,
      userId,
      op: 'delete',
      originalPath: null,
      content: null,
      assetBlobPath: null,
      baseCommit,
      contentHash: null,
      updatedAt: Date.now(),
    });
    if (existing?.assetBlobPath) this.removeBlob(existing.assetBlobPath);
    return { removedCreateOnly: false, originalPath: null, draft: deleteDraft };
  }

  markRenamed(input: MarkRenamedInput): MarkRenamedResult {
    const { projectId, branch, fromPath, toPath, userId, content, baseCommit } = input;
    this.assertPathFree(projectId, branch, toPath, userId);
    const staleTarget = this.getUserDraft(projectId, branch, userId, toPath);
    if (staleTarget) {
      this.removeDraftRow(staleTarget);
    }
    const fromDraft = this.getUserDraft(projectId, branch, userId, fromPath);

    if (fromDraft?.op === 'create') {
      const moved = this.moveRow(fromDraft, toPath, {
        op: 'create',
        originalPath: null,
        content: fromDraft.assetBlobPath ? null : content,
      });
      return { draft: moved, rootOriginalPath: null };
    }

    if (fromDraft?.op === 'rename' && fromDraft.originalPath) {
      const rootOrig = fromDraft.originalPath;
      const backToBaseline = toPath === rootOrig;
      const moved = this.moveRow(fromDraft, toPath, {
        op: backToBaseline ? 'edit' : 'rename',
        originalPath: backToBaseline ? null : rootOrig,
        content: fromDraft.assetBlobPath ? null : content,
      });
      return { draft: moved, rootOriginalPath: rootOrig };
    }

    // Renaming a baseline file (possibly with an existing `edit` draft at `fromPath`).
    const carriedBlob = fromDraft?.assetBlobPath ?? null;
    if (fromDraft) {
      this.removeDraftRow(fromDraft);
    }
    const row: WorkingDraftRow = {
      id: randomUUID(),
      projectId,
      branch,
      filePath: toPath,
      userId,
      op: 'rename',
      originalPath: fromPath,
      content: carriedBlob ? null : content,
      assetBlobPath: null,
      baseCommit,
      contentHash: null,
      updatedAt: Date.now(),
    };
    if (carriedBlob && fromDraft) {
      const ext = normalizeExtension(extensionOf(fromPath));
      const blobPath = `${projectId}/${row.id}${ext}`;
      this.moveBlob(carriedBlob, blobPath);
      row.assetBlobPath = blobPath;
    } else if (content !== null) {
      row.contentHash = computeContentHash(content);
    }
    const draft = this.writeRow(row);
    return { draft, rootOriginalPath: null };
  }

  deleteUserDraft(
    projectId: string,
    branch: string,
    userId: string,
    filePath: string,
  ): { deleted: boolean; originalPath: string | null } {
    const row = this.getUserDraft(projectId, branch, userId, filePath);
    if (!row) return { deleted: false, originalPath: null };
    this.removeDraftRow(row);
    return { deleted: true, originalPath: row.originalPath };
  }

  deleteDraftsForPaths(projectId: string, branch: string, userId: string, paths: string[]): void {
    for (const path of paths) {
      const row = this.getUserDraft(projectId, branch, userId, path);
      if (row) this.removeDraftRow(row);
    }
  }

  transferOwner(
    projectId: string,
    branch: string,
    filePath: string,
    fromUserId: string,
    toUserId: string,
  ): WorkingDraftRow | null {
    const row = this.getDraft(projectId, branch, filePath);
    if (!row) return null;
    if (row.userId !== fromUserId) return null;
    this.db
      .update(workingDrafts)
      .set({ userId: toUserId, updatedAt: Date.now() })
      .where(eq(workingDrafts.id, row.id))
      .run();
    this.bumpDraftRev(projectId, branch, fromUserId);
    this.bumpDraftRev(projectId, branch, toUserId);
    return { ...row, userId: toUserId };
  }

  // ---------------------------------------------------------------------------
  // Semantic overlay / materialization
  // ---------------------------------------------------------------------------

  toSemanticOverlayOps(projectId: string, branch: string, userId: string): SemanticOverlayOperation[] {
    const ops: SemanticOverlayOperation[] = [];
    for (const row of this.listUserDrafts(projectId, branch, userId)) {
      const ext = extensionOf(row.filePath);
      if (!SEMANTIC_EXTENSIONS.has(ext)) continue;
      if (row.op === 'delete') {
        ops.push({ op: 'delete', filePath: row.filePath });
        continue;
      }
      if (isBinaryDraft(row)) continue;
      const content = row.content ?? '';
      if (row.op === 'rename' && row.originalPath) {
        ops.push({ op: 'rename', originalPath: row.originalPath, filePath: row.filePath, content });
        continue;
      }
      ops.push({
        op: row.op === 'create' ? 'create' : 'edit',
        filePath: row.filePath,
        content,
      });
    }
    return ops;
  }

  async materializeOverlayDir(input: MaterializeOverlayInput): Promise<MaterializeOverlayResult> {
    const { baselineDir, projectId, branch, userId, destDir } = input;
    mkdirSync(destDir, { recursive: true });
    this.cloneTree(baselineDir, destDir);

    const applied = new Set<string>();
    for (const draft of this.listUserDrafts(projectId, branch, userId)) {
      const target = join(destDir, draft.filePath);
      if (draft.op === 'delete') {
        rmSync(target, { recursive: true, force: true });
        applied.add(draft.filePath);
        continue;
      }
      if (draft.op === 'rename' && draft.originalPath) {
        rmSync(join(destDir, draft.originalPath), { recursive: true, force: true });
        applied.add(draft.originalPath);
        this.writeDraftFile(baselineDir, destDir, draft);
        applied.add(draft.filePath);
        continue;
      }
      this.writeDraftFile(baselineDir, destDir, draft);
      applied.add(draft.filePath);
    }
    return { appliedCount: applied.size, appliedPaths: [...applied] };
  }

  private writeDraftFile(baselineDir: string, destDir: string, draft: WorkingDraftRow): void {
    const target = join(destDir, draft.filePath);
    mkdirSync(dirname(target), { recursive: true });
    // `cloneTree` hardlinks, so the materialized copy shares an inode with the shared
    // baseline workDir. Unlink first, otherwise writing the draft would silently rewrite
    // the baseline file through that inode.
    rmSync(target, { force: true });
    const blob = this.readBinaryDraft(draft);
    if (blob) {
      writeFileSync(target, blob);
      return;
    }
    if (draft.content !== null) {
      writeFileSync(target, draft.content, 'utf8');
      return;
    }
    if (draft.op === 'rename' && draft.originalPath) {
      const baselineFile = join(baselineDir, draft.originalPath);
      if (existsSync(baselineFile)) {
        copyFileSync(baselineFile, target);
      }
    }
  }

  private cloneTree(source: string, dest: string): void {
    let entries;
    try {
      entries = readdirSync(source, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (MATERIALIZE_SKIP_DIRS.has(entry.name)) continue;
      const from = join(source, entry.name);
      const to = join(dest, entry.name);
      if (entry.isDirectory()) {
        mkdirSync(to, { recursive: true });
        this.cloneTree(from, to);
      } else if (entry.isSymbolicLink()) {
        try {
          copyFileSync(from, to);
        } catch {
          // Unresolvable symlink: skip rather than fail materialization.
        }
      } else if (entry.isFile()) {
        try {
          linkSync(from, to);
        } catch {
          copyFileSync(from, to);
        }
      }
    }
  }

  /**
   * Deletes draft blob files that no `working_drafts` row references and that are older
   * than `maxAgeMs` (default 24h). Returns the number of removed files.
   */
  async pruneOrphanDraftBlobs(maxAgeMs: number = ORPHAN_DRAFT_MAX_AGE_MS): Promise<number> {
    if (!existsSync(this.draftAssetsRootDir)) return 0;
    const referenced = new Set(
      this.db
        .select({ assetBlobPath: workingDrafts.assetBlobPath })
        .from(workingDrafts)
        .all()
        .map((row) => row.assetBlobPath)
        .filter((path): path is string => typeof path === 'string' && path.length > 0),
    );
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const file of this.walkBlobs(this.draftAssetsRootDir, this.draftAssetsRootDir)) {
      if (referenced.has(file)) continue;
      const absolute = join(this.draftAssetsRootDir, file);
      try {
        if (statSync(absolute).mtimeMs > cutoff) continue;
      } catch {
        continue;
      }
      rmSync(absolute, { force: true });
      removed += 1;
    }
    return removed;
  }

  private walkBlobs(root: string, dir: string): string[] {
    const out: string[] = [];
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...this.walkBlobs(root, absolute));
      } else if (entry.isFile()) {
        out.push(absolute.slice(root.length + 1).split('\\').join('/'));
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private toView(row: WorkingDraftRow): DraftView {
    return {
      id: row.id,
      projectId: row.projectId,
      branch: row.branch,
      filePath: row.filePath,
      userId: row.userId,
      op: row.op,
      originalPath: row.originalPath,
      contentHash: row.contentHash,
      isBinary: isBinaryDraft(row),
      baseCommit: row.baseCommit,
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  private claimExisting(
    projectId: string,
    branch: string,
    filePath: string,
    userId: string,
  ): WorkingDraftRow | null {
    const existing = this.getDraft(projectId, branch, filePath);
    if (existing && existing.userId !== userId) {
      throw httpError(409, 'drafts.ownedByOther', { path: filePath });
    }
    return existing;
  }

  private assertPathFree(
    projectId: string,
    branch: string,
    filePath: string,
    userId: string,
  ): void {
    const existing = this.getDraft(projectId, branch, filePath);
    if (existing && existing.userId !== userId) {
      throw httpError(409, 'drafts.ownedByOther', { path: filePath });
    }
  }

  private persist(row: WorkingDraftRow, update: boolean): void {
    if (update) {
      this.db
        .update(workingDrafts)
        .set({
          filePath: row.filePath,
          userId: row.userId,
          op: row.op,
          originalPath: row.originalPath,
          content: row.content,
          assetBlobPath: row.assetBlobPath,
          baseCommit: row.baseCommit,
          contentHash: row.contentHash,
          updatedAt: row.updatedAt,
        })
        .where(eq(workingDrafts.id, row.id))
        .run();
      this.bumpDraftRev(row.projectId, row.branch, row.userId);
      return;
    }
    this.db.insert(workingDrafts).values(row).run();
    this.bumpDraftRev(row.projectId, row.branch, row.userId);
  }

  /** Insert-or-replace by (project, branch, filePath); returns the stored row. */
  private writeRow(row: WorkingDraftRow): WorkingDraftRow {
    const existing = this.getDraft(row.projectId, row.branch, row.filePath);
    if (existing) {
      if (existing.id !== row.id && existing.assetBlobPath) {
        this.removeBlob(existing.assetBlobPath);
      }
      this.db
        .update(workingDrafts)
        .set({
          userId: row.userId,
          op: row.op,
          originalPath: row.originalPath,
          content: row.content,
          assetBlobPath: row.assetBlobPath,
          baseCommit: row.baseCommit,
          contentHash: row.contentHash,
          updatedAt: row.updatedAt,
        })
        .where(eq(workingDrafts.id, existing.id))
        .run();
      this.bumpDraftRev(row.projectId, row.branch, row.userId);
      return { ...row, id: existing.id };
    }
    this.db.insert(workingDrafts).values(row).run();
    this.bumpDraftRev(row.projectId, row.branch, row.userId);
    return row;
  }

  private moveRow(
    row: WorkingDraftRow,
    toPath: string,
    patch: { op: DraftOp; originalPath: string | null; content: string | null },
  ): WorkingDraftRow {
    const hasBlob = row.assetBlobPath !== null;
    const next: WorkingDraftRow = {
      ...row,
      filePath: toPath,
      op: patch.op,
      originalPath: patch.originalPath,
      content: hasBlob ? null : patch.content,
      contentHash: hasBlob ? row.contentHash : patch.content === null ? null : computeContentHash(patch.content),
      updatedAt: Date.now(),
    };
    this.db
      .update(workingDrafts)
      .set({
        filePath: next.filePath,
        op: next.op,
        originalPath: next.originalPath,
        content: next.content,
        contentHash: next.contentHash,
        updatedAt: next.updatedAt,
      })
      .where(eq(workingDrafts.id, row.id))
      .run();
    this.bumpDraftRev(next.projectId, next.branch, next.userId);
    return next;
  }

  private removeDraftRow(row: WorkingDraftRow): void {
    if (row.assetBlobPath) this.removeBlob(row.assetBlobPath);
    this.db.delete(workingDrafts).where(eq(workingDrafts.id, row.id)).run();
    this.bumpDraftRev(row.projectId, row.branch, row.userId);
  }

  private removeBlob(blobPath: string): void {
    try {
      rmSync(join(this.draftAssetsRootDir, blobPath), { force: true });
    } catch {
      // best effort
    }
  }

  private moveBlob(fromBlobPath: string, toBlobPath: string): void {
    const from = join(this.draftAssetsRootDir, fromBlobPath);
    const to = join(this.draftAssetsRootDir, toBlobPath);
    mkdirSync(dirname(to), { recursive: true });
    try {
      copyFileSync(from, to);
    } catch {
      return;
    }
    this.removeBlob(fromBlobPath);
  }
}

/** Absolute path helper used by callers that need to read a draft asset. */
export function draftAssetAbsolutePath(rootDir: string, blobPath: string): string {
  return resolve(rootDir, blobPath);
}
