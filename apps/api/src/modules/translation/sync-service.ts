import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  computeTranslatableDocumentFingerprint,
  type TranslationFileStatus,
} from '@dita/core';
import { and, eq, inArray } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  translationFileStates,
  translationItems,
  users,
  type TranslationFileStateRow,
  type TranslationItemRow,
  type TranslationLinkRow,
} from '../../db/schema.js';
import type { ApiMessageKey } from '../../i18n/messages.js';
import { httpError, isHttpError } from '../errors.js';
import type { GitManager } from '../git/git-manager.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type { DraftService } from '../locks/draft-service.js';
import type { LockService } from '../locks/lock-service.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import { readLinkRow } from './link-service.js';
import {
  countFileStatuses,
  type LockedAssetSkip,
  type MarkSyncedResult,
  type ResolveDeletedAction,
  type ResolveDeletedResult,
  type SyncAssetsResult,
  type SyncPassthroughResult,
  type TranslationFileKind,
  type TranslationFileStateFilter,
  type TranslationFileStateView,
  type TranslationDraftOwner,
  type TranslationScanResult,
  type TranslationScanSummary,
} from './types.js';

/** Directories that never participate in a translation link (mirrors the workspace walker). */
const IGNORED_SEGMENTS = new Set([
  '.git',
  '.ditaeditor',
  'node_modules',
  'dist',
  'out',
  'build',
  '.turbo',
  '.cache',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']);

/** `keys.ditamap`, `product-keys.ditamap`, … — key definitions need human review (§1.2 #3). */
const KEYDEF_MAP_PATTERN = /(^|\/)(keys\.ditamap|[^/]*-keys\.ditamap)$/i;

/** Item statuses that own the file's workflow state; a scan must never overwrite them. */
const ACTIVE_ITEM_STATUSES = [
  'queued',
  'ai_translating',
  'validating',
  'ready_for_review',
  'in_review',
  'approved_draft',
] as const;

/** Status ordering used by `GET /files` so reviewable work floats to the top. */
const STATUS_ORDER: TranslationFileStatus[] = [
  'in_review',
  'draft_ready',
  'in_queue',
  'outdated',
  'source_renamed',
  'untranslated',
  'outdated_metadata_only',
  'synced',
  'source_deleted',
];

export function isIgnoredTranslationPath(filePath: string): boolean {
  return filePath
    .split('/')
    .some((segment) => segment.startsWith('.') || IGNORED_SEGMENTS.has(segment));
}

/**
 * Maps one repository path (plus the map's content when a sniff is needed) to a translation
 * file kind. Returns `null` for files the translation pipeline does not track at all.
 */
export function classifyTranslationFileKind(
  filePath: string,
  content?: string | null,
): TranslationFileKind | null {
  const lower = filePath.toLowerCase();
  const ext = path.posix.extname(lower);
  if (ext === '.dita') return 'topic';
  if (ext === '.ditaval') return 'ditaval';
  if (ext === '.ditamap' || ext === '.bookmap') {
    if (KEYDEF_MAP_PATTERN.test(filePath)) return 'keydef_map';
    // Only a content sniff is truthful: `keys.ditamap` naming is a convention, not a guarantee.
    if (content && /<keydef[\s/>]/.test(content)) return 'keydef_map';
    return 'map';
  }
  if (IMAGE_EXTENSIONS.has(ext)) return 'asset';
  return null;
}

function fileStatusForItemStatus(itemStatus: string): TranslationFileStatus | null {
  switch (itemStatus) {
    case 'queued':
    case 'ai_translating':
    case 'validating':
      return 'in_queue';
    case 'ready_for_review':
    case 'in_review':
      return 'in_review';
    case 'approved_draft':
      return 'draft_ready';
    default:
      return null;
  }
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Asserts that a path string is a safe repository-relative POSIX path. Every path that reaches
 * the filesystem or Git here comes from a Git tree listing or a request body, so traversal and
 * absolute paths must be rejected before they can escape the worktree.
 */
function assertSafePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\u0000') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw httpError(400, 'translation.invalidPath', { path: filePath });
  }
  return normalized;
}

/** Most frequent non-null value — the source commit every row was last scanned against. */
function previousScanCommit(rows: readonly TranslationFileStateRow[]): string | null {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const commit = row.lastSourceCommit;
    if (!commit) continue;
    tally.set(commit, (tally.get(commit) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [commit, count] of tally) {
    if (count > bestCount) {
      best = commit;
      bestCount = count;
    }
  }
  return best;
}

interface ResolvedManualWorkDir {
  rootDir: string;
  workDir: string;
}

interface ComputedFileState {
  row: TranslationFileStateRow;
  created: boolean;
}

export interface IncrementalSyncServiceOptions {
  db: DitaDatabase;
  git: GitManager;
  registry: ManualRegistryService;
  locks: LockService;
  drafts: DraftService;
}

/**
 * Phase 16 Stage 2 — incremental source↔target reconciliation.
 *
 * Every method here is a strict Phase 13 reader: worktrees are resolved with
 * `createIfMissing: false`, the shared baseline is only read through Git, and the single write
 * path for assets goes through the caller's Draft Overlay (`working_drafts` + `file_locks`).
 */
export class IncrementalSyncService {
  private readonly db: DitaDatabase;
  private readonly git: GitManager;
  private readonly registry: ManualRegistryService;
  private readonly locks: LockService;
  private readonly drafts: DraftService;

  constructor(options: IncrementalSyncServiceOptions) {
    this.db = options.db;
    this.git = options.git;
    this.registry = options.registry;
    this.locks = options.locks;
    this.drafts = options.drafts;
  }

  /** Resolves `(manual, branch)` to a worktree without ever creating a ref or a worktree. */
  private async resolveManualWorkDir(
    manualId: string,
    branch: string | null,
    missingKey: ApiMessageKey,
  ): Promise<ResolvedManualWorkDir> {
    const row = await this.registry.requireRow(manualId).catch(() => {
      throw httpError(404, missingKey, { path: manualId });
    });
    const rootDir = path.resolve(row.rootDir);
    if (!existsSync(rootDir)) throw httpError(404, missingKey, { path: row.rootDir });
    if (!this.git.isRepository(rootDir)) return { rootDir, workDir: rootDir };
    const targetBranch = (branch ?? '').trim() || (await this.git.currentBranch(rootDir));
    const workDir = await this.git.ensureWorktree(rootDir, targetBranch, {
      createIfMissing: false,
    });
    return { rootDir, workDir };
  }

  /** Reads the current HEAD of a worktree (never creates one). */
  private async headOf(workDir: string): Promise<string | null> {
    return await this.git.headCommit(workDir);
  }

  private async treeHashes(workDir: string): Promise<Map<string, string>> {
    const files = await this.git.listTreeFiles(workDir, 'HEAD');
    return new Map(files.map((file) => [file.path, file.blobHash]));
  }

  /** Active workflow items for a link, newest first, keyed by source path. */
  private loadActiveItems(linkId: string): Map<string, TranslationItemRow> {
    const rows = this.db
      .select()
      .from(translationItems)
      .where(
        and(
          eq(translationItems.linkId, linkId),
          inArray(translationItems.status, [...ACTIVE_ITEM_STATUSES]),
        ),
      )
      .all();
    const byPath = new Map<string, TranslationItemRow>();
    for (const row of rows) {
      const previous = byPath.get(row.sourcePath);
      if (!previous || row.updatedAt >= previous.updatedAt) byPath.set(row.sourcePath, row);
    }
    return byPath;
  }

  private toFileStateView(
    row: TranslationFileStateRow,
    activeItem: TranslationItemRow | null,
    draftOwner: TranslationDraftOwner | null = null,
  ): TranslationFileStateView {
    return {
      id: row.id,
      linkId: row.linkId,
      sourcePath: row.sourcePath,
      targetPath: row.targetPath,
      fileKind: row.fileKind,
      status: row.status as TranslationFileStatus,
      lastSourceCommit: row.lastSourceCommit,
      lastSourceBlobHash: row.lastSourceBlobHash,
      lastSourceTranslatableHash: row.lastSourceTranslatableHash,
      lastTargetCommit: row.lastTargetCommit,
      lastTargetBlobHash: row.lastTargetBlobHash,
      renamedFromPath: row.renamedFromPath,
      localizedAssetOverride: row.localizedAssetOverride === 1,
      needsHumanReview: row.fileKind === 'keydef_map',
      updatedAt: toIso(row.updatedAt),
      activeItem: activeItem
        ? {
            id: activeItem.id,
            jobId: activeItem.jobId,
            status: activeItem.status,
            reviewerId: activeItem.reviewerId,
            updatedAt: toIso(activeItem.updatedAt),
          }
        : null,
      draftOwner,
    };
  }

  /**
   * Draft overlay owner per *target* path (`targetPath` → owner), for the caller's target branch.
   *
   * Phase 13: drafts live per user, so a `draft_ready` row may belong to a colleague. Reads only
   * SQLite — a missing target manual degrades to "no drafts" instead of failing the file list.
   */
  private async loadDraftOwners(
    link: TranslationLinkRow,
    currentUserId?: string,
  ): Promise<Map<string, TranslationDraftOwner>> {
    const owners = new Map<string, TranslationDraftOwner>();
    let projectId: string;
    try {
      const manual = await this.registry.requireRow(link.targetManualId);
      projectId = this.locks.projectIdForManual(manual.rootDir, link.targetManualId);
    } catch {
      return owners;
    }
    const drafts = this.drafts.listBranchDrafts(projectId, link.targetBranch);
    if (drafts.length === 0) return owners;
    const userRows = this.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .all();
    const names = new Map(userRows.map((row) => [row.id, row.displayName]));
    for (const draft of drafts) {
      owners.set(draft.filePath, {
        userId: draft.userId,
        userName: names.get(draft.userId) ?? draft.userId,
        isMine: Boolean(currentUserId && draft.userId === currentUserId),
      });
    }
    return owners;
  }

  /**
   * Reconciles the source `HEAD` against the target `HEAD` and the stored watermarks.
   *
   * Rules (§3.2 + §1.2 defaults):
   * - active workflow states (`in_queue` / `in_review` / `draft_ready`) win over every heuristic;
   * - a missing target file is `untranslated`, an unchanged source blob is `synced`;
   * - a changed blob that keeps the same translatable fingerprint is `outdated_metadata_only`;
   * - renames are detected with `git diff -M` and keep the old watermarks on the new path;
   * - a locally replaced image is never overwritten (`localizedAssetOverride`).
   */
  async scanLink(linkId: string, currentUserId?: string): Promise<TranslationScanResult> {
    const link = readLinkRow(this.db, linkId);
    const source = await this.resolveManualWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const target = await this.resolveManualWorkDir(
      link.targetManualId,
      link.targetBranch,
      'translation.targetManualMissing',
    );

    const sourceHead = await this.headOf(source.workDir);
    if (!sourceHead) throw httpError(409, 'translation.noSourceCommit');
    const targetHead = await this.headOf(target.workDir);
    const sourceTree = await this.git.listTreeFiles(source.workDir, 'HEAD');
    const targetHashes = await this.treeHashes(target.workDir);

    const existingRows = this.db
      .select()
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all();
    const byPath = new Map(existingRows.map((row) => [row.sourcePath, row]));
    const previousCommit = previousScanCommit(existingRows);

    const renames = new Map<string, string>();
    const deletedPaths = new Set<string>();
    if (previousCommit && previousCommit !== sourceHead) {
      const changes = await this.git.diffNameStatusBetween(
        source.workDir,
        previousCommit,
        sourceHead,
      );
      for (const change of changes) {
        if (change.status === 'D') deletedPaths.add(change.path);
        if (change.status === 'R' && change.oldPath) renames.set(change.path, change.oldPath);
      }
    }

    // Phase 16 §5.1: a file sitting in the caller's Draft Overlay keeps its `draft_ready`
    // status across rescans — otherwise synced assets/ditavals silently fall back to
    // `untranslated` / `outdated` and the check-in loop loses its track. Locks and drafts
    // share `link.targetManualId` as the project id (see `projectIdForManual`).
    const projectId = this.locks.projectIdForManual(target.rootDir, link.targetManualId);
    const draftPaths = new Set(
      this.drafts.listBranchDrafts(projectId, link.targetBranch).map((draft) => draft.filePath),
    );

    const activeByPath = this.loadActiveItems(linkId);
    const now = Date.now();
    const computed: ComputedFileState[] = [];
    const consumedRowIds = new Set<string>();
    const currentPaths = new Set<string>();
    let createdCount = 0;
    let updatedCount = 0;

    for (const file of sourceTree) {
      if (isIgnoredTranslationPath(file.path)) continue;
      const preliminary = classifyTranslationFileKind(file.path);
      if (!preliminary) continue;

      const sourcePath = assertSafePath(file.path);
      currentPaths.add(sourcePath);
      const targetPath = sourcePath; // the target manual mirrors the source layout

      let content: string | null = null;
      let fileKind = preliminary;
      if (preliminary === 'map' || preliminary === 'keydef_map') {
        content = await this.git.fileAtRevision(source.workDir, 'HEAD', sourcePath);
        fileKind = classifyTranslationFileKind(sourcePath, content) ?? preliminary;
      } else if (preliminary === 'topic') {
        content = await this.git.fileAtRevision(source.workDir, 'HEAD', sourcePath);
      }

      const renamedFrom = renames.get(sourcePath) ?? null;
      const previous =
        byPath.get(sourcePath) ?? (renamedFrom ? byPath.get(renamedFrom) : undefined);
      if (renamedFrom && previous) consumedRowIds.add(previous.id);

      const isXml = fileKind === 'topic' || fileKind === 'map' || fileKind === 'keydef_map';
      const sourceBlobHash = file.blobHash;
      const targetBlobHash = targetHashes.get(targetPath) ?? null;
      const fingerprint =
        isXml && content ? computeTranslatableDocumentFingerprint(content) : null;

      let lastSourceBlobHash = previous?.lastSourceBlobHash ?? null;
      let lastSourceTranslatableHash = previous?.lastSourceTranslatableHash ?? null;
      let lastTargetBlobHash = previous?.lastTargetBlobHash ?? null;
      let localizedAssetOverride = previous?.localizedAssetOverride ?? 0;

      // §1.2 default #2: a localised screenshot that the translator replaced wins over the source.
      if (
        fileKind === 'asset' &&
        previous &&
        targetBlobHash &&
        previous.lastTargetBlobHash &&
        targetBlobHash !== previous.lastTargetBlobHash &&
        targetBlobHash !== previous.lastSourceBlobHash
      ) {
        localizedAssetOverride = 1;
      }

      const activeItem = activeByPath.get(sourcePath) ?? null;
      const activeStatus = activeItem ? fileStatusForItemStatus(activeItem.status) : null;

      let status: TranslationFileStatus;
      if (activeStatus) {
        status = activeStatus;
      } else if (draftPaths.has(targetPath)) {
        // A pending edit/delete already lives in the overlay: never downgrade it.
        status = 'draft_ready';
      } else if (renamedFrom) {
        status = 'source_renamed';
      } else if (!targetBlobHash) {
        status = 'untranslated';
      } else if (!previous || previous.lastSourceBlobHash === null) {
        // First bind, or the first target file for a previously `untranslated` row: the target
        // file is already there, so the pair starts in sync and the watermarks are initialized.
        status = 'synced';
        lastSourceBlobHash = sourceBlobHash;
        lastSourceTranslatableHash = fingerprint;
        lastTargetBlobHash = targetBlobHash;
      } else if (previous.lastSourceBlobHash === sourceBlobHash) {
        status = 'synced';
      } else if (
        fingerprint &&
        previous.lastSourceTranslatableHash &&
        previous.lastSourceTranslatableHash === fingerprint
      ) {
        status = 'outdated_metadata_only';
      } else {
        status = 'outdated';
      }

      /**
       * `lastSourceCommit` is the `S0` seed of the next incremental job: it must keep pointing at
       * the commit whose source content the stored translation actually corresponds to. Advancing
       * it to `sourceHead` for a file whose translatable content just changed makes the next plan
       * diff the new source against itself — every segment looks `unchanged`, the AI is never
       * asked, and the reviewer sees a stale translation labelled 未变更.
       */
      const sourceBaselineSynced =
        previous != null &&
        (previous.lastSourceBlobHash === null ||
          previous.lastSourceBlobHash === sourceBlobHash ||
          (fingerprint !== null && previous.lastSourceTranslatableHash === fingerprint));
      const lastSourceCommit =
        targetBlobHash !== null && (previous == null || sourceBaselineSynced)
          ? sourceHead
          : previous?.lastSourceCommit ?? null;

      const row: TranslationFileStateRow = {
        id: previous?.id ?? randomUUID(),
        linkId,
        sourcePath,
        targetPath,
        fileKind,
        status,
        lastSourceCommit,
        lastSourceBlobHash,
        lastSourceTranslatableHash,
        lastTargetCommit: targetHead,
        lastTargetBlobHash,
        renamedFromPath: renamedFrom ?? previous?.renamedFromPath ?? null,
        localizedAssetOverride,
        updatedAt: now,
      };
      if (previous) updatedCount += 1;
      else createdCount += 1;
      computed.push({ row, created: !previous });
    }

    // Source files that disappeared. Renamed rows were re-pointed above and must not be revived.
    let removedCount = 0;
    for (const existing of existingRows) {
      if (currentPaths.has(existing.sourcePath)) continue;
      if (consumedRowIds.has(existing.id)) continue;
      const wasAlreadyDeleted = existing.status === 'source_deleted';
      if (!wasAlreadyDeleted) removedCount += 1;
      // A staged delete in the overlay must survive the rescan, or the user loses the
      // `source_deleted` → `draft_ready` progress from `resolve-deleted`.
      const stagedDelete = draftPaths.has(existing.targetPath);
      computed.push({
        row: {
          ...existing,
          status: stagedDelete ? 'draft_ready' : 'source_deleted',
          // A deleted source is not a translated baseline: keep `S0` for a possible restore.
          lastTargetCommit: targetHead,
          updatedAt: now,
        },
        created: false,
      });
    }

    this.db.transaction((tx) => {
      for (const entry of computed) {
        if (entry.created) {
          tx.insert(translationFileStates).values(entry.row).run();
        } else {
          tx
            .update(translationFileStates)
            .set({
              sourcePath: entry.row.sourcePath,
              targetPath: entry.row.targetPath,
              fileKind: entry.row.fileKind,
              status: entry.row.status,
              lastSourceCommit: entry.row.lastSourceCommit,
              lastSourceBlobHash: entry.row.lastSourceBlobHash,
              lastSourceTranslatableHash: entry.row.lastSourceTranslatableHash,
              lastTargetCommit: entry.row.lastTargetCommit,
              lastTargetBlobHash: entry.row.lastTargetBlobHash,
              renamedFromPath: entry.row.renamedFromPath,
              localizedAssetOverride: entry.row.localizedAssetOverride,
              updatedAt: entry.row.updatedAt,
            })
            .where(eq(translationFileStates.id, entry.row.id))
            .run();
        }
      }
    });

    const files = await this.listFileStates(linkId, {}, currentUserId);
    const summary: TranslationScanSummary = {
      sourceCommit: sourceHead,
      targetCommit: targetHead,
      total: files.length,
      created: createdCount,
      updated: updatedCount,
      removed: removedCount,
      renames: renames.size,
      deleted: deletedPaths.size,
      counts: countFileStatuses(files),
    };
    return { summary, files };
  }

  /** File states of one link, filtered for the translation-center file table. */
  async listFileStates(
    linkId: string,
    filter: TranslationFileStateFilter = {},
    currentUserId?: string,
  ): Promise<TranslationFileStateView[]> {
    const link = readLinkRow(this.db, linkId);
    const rows = this.db
      .select()
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all();
    const activeByPath = this.loadActiveItems(linkId);
    const draftOwners = await this.loadDraftOwners(link, currentUserId);

    const statuses = filter.status
      ? new Set<string>(Array.isArray(filter.status) ? filter.status : [filter.status])
      : null;
    const kinds = filter.kind
      ? new Set<string>(Array.isArray(filter.kind) ? filter.kind : [filter.kind])
      : null;
    const search = filter.search?.trim().toLowerCase() ?? '';

    const views = rows
      .filter((row) => {
        if (statuses && !statuses.has(row.status)) return false;
        if (kinds && !kinds.has(row.fileKind)) return false;
        if (filter.includeRemoved === false && row.status === 'source_deleted') return false;
        if (search) {
          const haystack = `${row.sourcePath}\n${row.targetPath}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .map((row) =>
        this.toFileStateView(
          row,
          activeByPath.get(row.sourcePath) ?? null,
          draftOwners.get(row.targetPath) ?? null,
        ),
      );

    return views.sort((a, b) => {
      const orderA = STATUS_ORDER.indexOf(a.status);
      const orderB = STATUS_ORDER.indexOf(b.status);
      if (orderA !== orderB) return orderA - orderB;
      return a.sourcePath.localeCompare(b.sourcePath);
    });
  }

  /**
   * Copies source images into the caller's target Manual Draft Overlay.
   *
   * Phase 13 boundary: nothing is written into the shared target `workDir`; a file locked by
   * another user is reported in `skippedLocked` instead of being stolen.
   */
  async syncAssetsToDrafts(
    linkId: string,
    paths: string[] | undefined,
    user: IdentityUser,
    options: { force?: boolean } = {},
  ): Promise<SyncAssetsResult> {
    if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
    const link = readLinkRow(this.db, linkId);
    const source = await this.resolveManualWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const target = await this.resolveManualWorkDir(
      link.targetManualId,
      link.targetBranch,
      'translation.targetManualMissing',
    );

    const requested = paths?.map((entry) => assertSafePath(entry)).filter(Boolean) ?? null;
    const states = this.db
      .select()
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all()
      .filter((row) => row.fileKind === 'asset')
      .filter((row) => !requested || requested.includes(row.sourcePath) || requested.includes(row.targetPath));

    if (states.length === 0) throw httpError(400, 'translation.syncAssetsEmpty');

    const projectId = this.locks.projectIdForManual(target.rootDir, link.targetManualId);
    const baseCommit = await this.headOf(target.workDir);
    const targetHashes = await this.treeHashes(target.workDir);

    const result: SyncAssetsResult = {
      synced: [],
      skippedLocked: [],
      skippedOverride: [],
      skippedUnknown: [],
    };

    for (const state of states) {
      if (state.localizedAssetOverride === 1 && options.force !== true) {
        result.skippedOverride.push(state.targetPath);
        continue;
      }
      const buffer = await this.git.fileBufferAtRevision(
        source.workDir,
        'HEAD',
        state.sourcePath,
      );
      if (!buffer) {
        result.skippedUnknown.push(state.sourcePath);
        continue;
      }

      const existingLock = this.locks.find(projectId, link.targetBranch, state.targetPath);
      if (existingLock && existingLock.userId !== user.id) {
        result.skippedLocked.push(this.lockedSkip(state.targetPath, existingLock));
        continue;
      }
      if (!existingLock) {
        try {
          await this.locks.checkout({
            workDir: target.workDir,
            projectRootDir: target.rootDir,
            filePath: state.targetPath,
            user,
            allowMissing: true,
          });
        } catch (err) {
          if (isHttpError(err) && err.statusCode === 409) {
            result.skippedLocked.push(
              this.lockedSkip(state.targetPath, this.locks.find(projectId, link.targetBranch, state.targetPath)),
            );
            continue;
          }
          throw err;
        }
      }

      this.drafts.upsertBinaryDraft({
        projectId,
        branch: link.targetBranch,
        filePath: state.targetPath,
        userId: user.id,
        op: targetHashes.has(state.targetPath) ? 'edit' : 'create',
        buffer,
        ext: path.posix.extname(state.targetPath).toLowerCase(),
        baseCommit,
      });
      // §5.1 #1: the asset now waits in the overlay, so the row advances to `draft_ready`
      // (previously it stayed `untranslated`/`outdated` and could never reach check-in).
      this.db
        .update(translationFileStates)
        .set({
          status: 'draft_ready',
          updatedAt: Date.now(),
          ...(options.force === true ? { localizedAssetOverride: 0 } : {}),
        })
        .where(eq(translationFileStates.id, state.id))
        .run();
      result.synced.push(state.targetPath);
    }

    return result;
  }

  private lockedSkip(
    filePath: string,
    lock: { userId: string; userName: string; lockedAt: string } | null,
  ): LockedAssetSkip {
    return {
      path: filePath,
      userId: lock?.userId ?? null,
      userName: lock?.userName ?? null,
      lockedAt: lock?.lockedAt ?? null,
    };
  }

  /**
   * Copies non-translatable passthrough files (`*.ditaval`) into the caller's target Draft
   * Overlay so DITAVAL-only edits (a new audience filter, a retargeted `props`) can be
   * checked in through the same Phase 13 flow as topics and assets.
   *
   * Phase 13 boundary: a file locked by another user is reported in `skippedLocked` and is
   * never stolen; nothing is written into the shared target `workDir`.
   */
  async syncPassthroughToDrafts(
    linkId: string,
    paths: string[] | undefined,
    user: IdentityUser,
  ): Promise<SyncPassthroughResult> {
    if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
    const link = readLinkRow(this.db, linkId);
    const source = await this.resolveManualWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const target = await this.resolveManualWorkDir(
      link.targetManualId,
      link.targetBranch,
      'translation.targetManualMissing',
    );

    const requested = paths?.map((entry) => assertSafePath(entry)).filter(Boolean) ?? null;
    const states = this.db
      .select()
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all()
      .filter((row) => row.fileKind === 'ditaval')
      .filter((row) => !requested || requested.includes(row.sourcePath) || requested.includes(row.targetPath));

    if (states.length === 0) throw httpError(400, 'translation.syncPassthroughEmpty');

    const projectId = this.locks.projectIdForManual(target.rootDir, link.targetManualId);
    const baseCommit = await this.headOf(target.workDir);
    const targetHashes = await this.treeHashes(target.workDir);
    const result: SyncPassthroughResult = {
      synced: [],
      skippedLocked: [],
      skippedUnknown: [],
    };

    for (const state of states) {
      const content = await this.git.fileAtRevision(source.workDir, 'HEAD', state.sourcePath);
      if (content === null) {
        result.skippedUnknown.push(state.sourcePath);
        continue;
      }

      const existingLock = this.locks.find(projectId, link.targetBranch, state.targetPath);
      if (existingLock && existingLock.userId !== user.id) {
        result.skippedLocked.push(this.lockedSkip(state.targetPath, existingLock));
        continue;
      }
      const existsInTarget = targetHashes.has(state.targetPath);
      if (!existingLock) {
        try {
          await this.locks.checkout({
            workDir: target.workDir,
            projectRootDir: target.rootDir,
            filePath: state.targetPath,
            user,
            allowMissing: !existsInTarget,
          });
        } catch (err) {
          if (isHttpError(err) && err.statusCode === 409) {
            result.skippedLocked.push(
              this.lockedSkip(state.targetPath, this.locks.find(projectId, link.targetBranch, state.targetPath)),
            );
            continue;
          }
          throw err;
        }
      }

      this.drafts.upsertTextDraft({
        projectId,
        branch: link.targetBranch,
        filePath: state.targetPath,
        userId: user.id,
        op: existsInTarget ? 'edit' : 'create',
        content,
        baseCommit,
      });
      this.db
        .update(translationFileStates)
        .set({ status: 'draft_ready', updatedAt: Date.now() })
        .where(eq(translationFileStates.id, state.id))
        .run();
      result.synced.push(state.targetPath);
    }

    return result;
  }

  /**
   * Resolves rows whose source file was deleted upstream.
   *
   * - `keep_target` dismisses the row and leaves the (still useful) translated file alone;
   * - `stage_delete` marks the translated target deleted in the caller's Draft Overlay so the
   *   deletion lands with the next check-in. A target file that already disappeared from the
   *   target `HEAD` just drops its tracking row.
   */
  async resolveDeletedFiles(
    linkId: string,
    input: { paths: string[]; action: ResolveDeletedAction },
    user: IdentityUser,
  ): Promise<ResolveDeletedResult> {
    if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
    const link = readLinkRow(this.db, linkId);
    const wanted = new Set(input.paths.map((entry) => assertSafePath(entry)).filter(Boolean));
    if (wanted.size === 0) throw httpError(400, 'translation.resolveDeletedEmpty');

    const target = await this.resolveManualWorkDir(
      link.targetManualId,
      link.targetBranch,
      'translation.targetManualMissing',
    );
    const projectId = this.locks.projectIdForManual(target.rootDir, link.targetManualId);
    const targetHead = await this.headOf(target.workDir);
    const targetHashes = await this.treeHashes(target.workDir);

    const states = this.db
      .select()
      .from(translationFileStates)
      .where(
        and(
          eq(translationFileStates.linkId, linkId),
          eq(translationFileStates.status, 'source_deleted'),
        ),
      )
      .all()
      .filter((row) => wanted.has(row.sourcePath) || wanted.has(row.targetPath));

    const now = Date.now();
    const result: ResolveDeletedResult = {
      staged: [],
      dismissed: [],
      skippedLocked: [],
      skippedUnknown: [],
    };
    const matched = new Set<string>();

    for (const state of states) {
      matched.add(state.sourcePath);
      matched.add(state.targetPath);

      if (input.action === 'keep_target') {
        this.db.delete(translationFileStates).where(eq(translationFileStates.id, state.id)).run();
        result.dismissed.push(state.sourcePath);
        continue;
      }

      // Nothing to delete in git: the translated file is already gone from the target HEAD.
      if (!targetHashes.has(state.targetPath)) {
        this.db.delete(translationFileStates).where(eq(translationFileStates.id, state.id)).run();
        result.dismissed.push(state.sourcePath);
        continue;
      }

      const existingLock = this.locks.find(projectId, link.targetBranch, state.targetPath);
      if (existingLock && existingLock.userId !== user.id) {
        result.skippedLocked.push(this.lockedSkip(state.targetPath, existingLock));
        continue;
      }
      if (!existingLock) {
        try {
          await this.locks.checkout({
            workDir: target.workDir,
            projectRootDir: target.rootDir,
            filePath: state.targetPath,
            user,
            allowMissing: false,
          });
        } catch (err) {
          if (isHttpError(err) && err.statusCode === 409) {
            result.skippedLocked.push(
              this.lockedSkip(state.targetPath, this.locks.find(projectId, link.targetBranch, state.targetPath)),
            );
            continue;
          }
          throw err;
        }
      }

      this.drafts.markDeleted({
        projectId,
        branch: link.targetBranch,
        filePath: state.targetPath,
        userId: user.id,
        baseCommit: targetHead,
        existsInBaseline: true,
      });
      this.db
        .update(translationFileStates)
        .set({ status: 'draft_ready', updatedAt: now })
        .where(eq(translationFileStates.id, state.id))
        .run();
      result.staged.push(state.targetPath);
    }

    for (const entry of wanted) {
      if (!matched.has(entry)) result.skippedUnknown.push(entry);
    }

    if (
      result.staged.length === 0 &&
      result.dismissed.length === 0 &&
      result.skippedLocked.length === 0
    ) {
      throw httpError(400, 'translation.resolveDeletedEmpty');
    }
    return result;
  }

  /**
   * Advances the watermarks of already-translated files (a manually verified
   * `outdated_metadata_only` file, or a target file the reviewer approved).
   */
  async markSynced(
    linkId: string,
    paths: string[],
    user: IdentityUser,
  ): Promise<MarkSyncedResult> {
    if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
    const link = readLinkRow(this.db, linkId);
    const source = await this.resolveManualWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const target = await this.resolveManualWorkDir(
      link.targetManualId,
      link.targetBranch,
      'translation.targetManualMissing',
    );

    const wanted = new Set(paths.map((entry) => assertSafePath(entry)).filter(Boolean));
    if (wanted.size === 0) throw httpError(400, 'translation.markSyncedEmpty');

    const sourceHead = await this.headOf(source.workDir);
    const targetHead = await this.headOf(target.workDir);
    const sourceHashes = await this.treeHashes(source.workDir);
    const targetHashes = await this.treeHashes(target.workDir);

    const rows = this.db
      .select()
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all()
      .filter((row) => wanted.has(row.sourcePath) || wanted.has(row.targetPath));

    const result: MarkSyncedResult = { marked: [], skippedUnknown: [] };
    const matched = new Set<string>();
    const now = Date.now();

    for (const row of rows) {
      matched.add(row.sourcePath);
      matched.add(row.targetPath);
      const isXml =
        row.fileKind === 'topic' || row.fileKind === 'map' || row.fileKind === 'keydef_map';
      let fingerprint: string | null = null;
      if (isXml) {
        const content = await this.git.fileAtRevision(source.workDir, 'HEAD', row.sourcePath);
        fingerprint = content ? computeTranslatableDocumentFingerprint(content) : null;
      }
      this.db
        .update(translationFileStates)
        .set({
          status: 'synced',
          lastSourceCommit: sourceHead,
          lastSourceBlobHash: sourceHashes.get(row.sourcePath) ?? row.lastSourceBlobHash,
          lastSourceTranslatableHash: fingerprint ?? row.lastSourceTranslatableHash,
          lastTargetCommit: targetHead,
          lastTargetBlobHash: targetHashes.get(row.targetPath) ?? row.lastTargetBlobHash,
          // The source path is authoritative now; a stale rename source would follow the row.
          renamedFromPath: null,
          updatedAt: now,
        })
        .where(eq(translationFileStates.id, row.id))
        .run();
      result.marked.push(row.sourcePath);
    }

    for (const entry of wanted) {
      if (!matched.has(entry)) result.skippedUnknown.push(entry);
    }
    if (result.marked.length === 0) throw httpError(400, 'translation.markSyncedEmpty');
    return result;
  }

  /** Convenience for `GET /api/translation/links/:id` style summaries. */
  countLinkFiles(linkId: string) {
    const rows = this.db
      .select({ status: translationFileStates.status })
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all();
    return countFileStatuses(rows);
  }

  /** Narrowed link row accessor shared with the routes (404 when the link vanished). */
  readLink(linkId: string): TranslationLinkRow {
    return readLinkRow(this.db, linkId);
  }
}
