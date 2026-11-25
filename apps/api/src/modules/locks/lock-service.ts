import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  fileLocks,
  lockBackups,
  manuals,
  repositories,
  users,
  workingDrafts,
  type FileLockRow,
  type WorkingDraftRow,
} from '../../db/schema.js';
import { httpError } from '../errors.js';
import { apiT } from '../../i18n/messages.js';
import type { GitCommitEntry, GitManager } from '../git/git-manager.js';
import { repositoryIdFor } from '../git/git-manager.js';
import type { VersionAuditService } from '../git/audit-service.js';
import type { IdentityUser, UserRole } from '../identity/identity-service.js';
import type { DraftService } from './draft-service.js';

export interface LockView {
  id: string;
  projectId: string;
  branch: string;
  filePath: string;
  userId: string;
  userName: string;
  userColor: string;
  userRole: UserRole;
  lockedAt: string;
  updatedAt: string;
  expired: boolean;
}

export interface LockBackupSummary {
  id: string;
  filePath: string;
  ownerUserId: string;
  hasContent: boolean;
  patchPreview: string;
  createdAt: string;
}

export interface ForceUnlockResult {
  released: LockView;
  backup: LockBackupSummary;
}

export interface WriteAuthorization {
  lock: LockView | null;
  autoLocked: boolean;
}

export interface LockHandoffResult {
  lock: LockView;
  targetUserId: string;
  affectedPaths: string[];
}

export interface CancelCheckoutResult {
  released: LockView;
  deleted: boolean;
  restoredPath: string | null;
}

export interface CheckinResult {
  commit: GitCommitEntry;
  branch: string;
  projectId: string;
  releasedPaths: string[];
  renames: Array<{ from: string; to: string }>;
  deletedPaths: string[];
  writtenPaths: string[];
}

const DEFAULT_LOCK_TTL_HOURS = 72;

function lockTtlMs(): number {
  const parsed = Number.parseFloat(process.env.DITA_LOCK_TTL_HOURS ?? '');
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCK_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

function isExpired(timestamp: number): boolean {
  return Date.now() - timestamp > lockTtlMs();
}

function autoReclaimEnabled(): boolean {
  const value = process.env.DITA_LOCK_AUTO_RECLAIM_CLEAN;
  return value === '1' || value === 'true';
}

/** Minimal unified diff used for lock backups when the draft only exists in SQLite. */
function buildDraftPatch(filePath: string, before: string | null, after: string | null): string {
  if (before === null && after === null) return '';
  const beforeLines = before === null ? [] : before.split('\n');
  const afterLines = after === null ? [] : after.split('\n');
  const header = `--- ${before === null ? '/dev/null' : `a/${filePath}`}\n+++ ${after === null ? '/dev/null' : `b/${filePath}`}`;
  const body = [
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
    ...beforeLines.map((line) => `-${line}`),
    ...afterLines.map((line) => `+${line}`),
  ].join('\n');
  return `${header}\n${body}`;
}

export class LockService {
  constructor(
    private readonly db: DitaDatabase,
    private readonly git: GitManager,
    private readonly drafts?: DraftService,
    private readonly audit?: VersionAuditService,
  ) {}

  private userName(userId: string): { name: string; color: string; role: UserRole } {
    const row = this.db.select().from(users).where(eq(users.id, userId)).get();
    return {
      name: row?.displayName ?? userId,
      color: row?.color ?? '#64748b',
      role: row?.role ?? 'writer',
    };
  }

  private toView(row: FileLockRow): LockView {
    const info = this.userName(row.userId);
    return {
      id: row.id,
      projectId: row.projectId,
      branch: row.branch,
      filePath: row.filePath,
      userId: row.userId,
      userName: info.name,
      userColor: info.color,
      userRole: info.role,
      lockedAt: new Date(row.lockedAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      expired: isExpired(row.updatedAt),
    };
  }

  private findRow(projectId: string, branch: string, filePath: string): FileLockRow | undefined {
    return this.db
      .select()
      .from(fileLocks)
      .where(
        and(
          eq(fileLocks.projectId, projectId),
          eq(fileLocks.branch, branch),
          eq(fileLocks.filePath, filePath),
        ),
      )
      .get();
  }

  private auditRecord(input: {
    projectId: string;
    branch: string;
    actorId: string;
    action: Parameters<VersionAuditService['record']>[0]['action'];
    targetPath?: string | null;
    details?: Record<string, unknown>;
  }): void {
    this.audit?.record({
      projectId: input.projectId,
      branch: input.branch,
      actorId: input.actorId,
      action: input.action,
      targetPath: input.targetPath ?? null,
      details: input.details ?? {},
    });
  }

  /**
   * An expired lock whose owner has no dirty draft can be reclaimed automatically so a
   * stale check-out never blocks the team permanently.
   */
  private tryReclaimStaleLock(
    projectId: string,
    branch: string,
    row: FileLockRow,
    filePath: string,
  ): boolean {
    if (!autoReclaimEnabled()) return false;
    if (!isExpired(row.updatedAt)) return false;
    if (this.drafts?.hasDirtyDraft(projectId, branch, row.userId, filePath)) return false;
    this.db.delete(fileLocks).where(eq(fileLocks.id, row.id)).run();
    return true;
  }

  currentBranch(workDir: string): Promise<string> {
    return this.git.currentBranch(workDir);
  }

  /**
   * Resolves the project id shared by locks, drafts, audit logs and publish
   * jobs. A registered manual owns the folder, so its `manuals.id` (a UUID
   * since Phase 13) is authoritative; folders that were never registered as a
   * manual keep the legacy path hash so old workspaces stay readable.
   */
  ensureRepository(rootDir: string): string {
    const resolvedRootDir = resolvePath(rootDir);
    const manualId = this.manualIdForRootDir(resolvedRootDir);
    const projectId = manualId ?? repositoryIdFor(rootDir);
    const existing = this.db.select().from(repositories).where(eq(repositories.id, projectId)).get();
    if (!existing) {
      this.db
        .insert(repositories)
        .values({
          id: projectId,
          rootDir: resolvedRootDir,
          name: resolvedRootDir.split('/').pop() ?? 'DITA Project',
          createdAt: Date.now(),
          initializedAt: null,
        })
        .onConflictDoNothing()
        .run();
    }
    return projectId;
  }

  /** Manuals are the Phase 13 project registry; their id is the project id. */
  private manualIdForRootDir(resolvedRootDir: string): string | null {
    const row = this.db
      .select({ id: manuals.id })
      .from(manuals)
      .where(eq(manuals.rootDir, resolvedRootDir))
      .limit(1)
      .get();
    return row?.id ?? null;
  }

  /** Project id for a manual row, creating the legacy repositories row on demand. */
  projectIdForManual(rootDir: string, manualId: string): string {
    const projectId = this.ensureRepository(rootDir);
    if (projectId !== manualId) {
      const existing = this.db
        .select({ id: repositories.id })
        .from(repositories)
        .where(eq(repositories.id, manualId))
        .limit(1)
        .get();
      if (!existing) {
        this.db
          .insert(repositories)
          .values({
            id: manualId,
            rootDir: resolvePath(rootDir),
            name: resolvePath(rootDir).split('/').pop() ?? 'DITA Project',
            createdAt: Date.now(),
            initializedAt: null,
          })
          .onConflictDoNothing()
          .run();
      }
    }
    return manualId;
  }

  markInitialized(projectId: string): void {
    this.db
      .update(repositories)
      .set({ initializedAt: Date.now() })
      .where(eq(repositories.id, projectId))
      .run();
  }

  list(projectId: string, branch: string): LockView[] {
    return this.db
      .select()
      .from(fileLocks)
      .where(and(eq(fileLocks.projectId, projectId), eq(fileLocks.branch, branch)))
      .orderBy(desc(fileLocks.lockedAt))
      .all()
      .map((row) => this.toView(row));
  }

  find(projectId: string, branch: string, filePath: string): LockView | null {
    const row = this.findRow(projectId, branch, filePath);
    return row ? this.toView(row) : null;
  }

  /** Active lock count for a branch — used by branch deletion and merge preview. */
  listActiveLockCount(projectId: string, branch: string): number {
    return this.db
      .select({ id: fileLocks.id })
      .from(fileLocks)
      .where(and(eq(fileLocks.projectId, projectId), eq(fileLocks.branch, branch)))
      .all().length;
  }

  async checkout(options: {
    workDir: string;
    projectRootDir: string;
    filePath: string;
    user: IdentityUser;
    allowMissing?: boolean;
  }): Promise<LockView> {
    const { workDir, projectRootDir, filePath, user } = options;
    if (user.role === 'viewer') {
      throw httpError(403, 'locks.viewerCannotCheckout');
    }
    await this.git.ensureInitialized(projectRootDir);
    const projectId = this.ensureRepository(projectRootDir);
    this.markInitialized(projectId);
    const branch = await this.git.currentBranch(workDir);

    const draft = this.drafts?.getUserDraft(projectId, branch, user.id, filePath) ?? null;
    if (!options.allowMissing && !existsSync(join(workDir, filePath)) && !draft) {
      throw httpError(404, 'locks.fileNotFound', { path: filePath });
    }

    const existing = this.findRow(projectId, branch, filePath);
    let reclaimedFrom: string | null = null;
    if (existing) {
      if (existing.userId !== user.id) {
        if (!this.tryReclaimStaleLock(projectId, branch, existing, filePath)) {
          const owner = this.userName(existing.userId);
          throw httpError(
            409,
            'locks.checkoutConflict',
            {
              user: owner.name,
              // Timestamps stay numeric and language-neutral so both locales read the same instant.
              at: new Date(existing.lockedAt).toLocaleString('zh-CN'),
            },
            { lock: this.toView(existing) },
          );
        }
        reclaimedFrom = existing.userId;
      } else {
        const now = Date.now();
        this.db.update(fileLocks).set({ updatedAt: now }).where(eq(fileLocks.id, existing.id)).run();
        return this.toView({ ...existing, updatedAt: now });
      }
    }

    const now = Date.now();
    const row: FileLockRow = {
      id: randomUUID(),
      projectId,
      branch,
      filePath,
      userId: user.id,
      lockedAt: now,
      updatedAt: now,
    };
    try {
      this.db.insert(fileLocks).values(row).run();
    } catch (error) {
      const current = this.findRow(projectId, branch, filePath);
      if (current) {
        const owner = this.userName(current.userId);
        throw httpError(409, 'locks.alreadyCheckedOut', { user: owner.name }, { lock: this.toView(current) });
      }
      throw error;
    }
    this.auditRecord({
      projectId,
      branch,
      actorId: user.id,
      action: 'checkout',
      targetPath: filePath,
      details: reclaimedFrom ? { reclaimedFrom } : {},
    });
    return this.toView(row);
  }

  release(projectId: string, branch: string, filePath: string, user: IdentityUser): LockView {
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw httpError(404, 'locks.notCheckedOut', { path: filePath });
    }
    if (row.userId !== user.id && user.role !== 'admin') {
      throw httpError(403, 'locks.releaseOwnOnly');
    }
    if (this.drafts?.hasDirtyDraft(projectId, branch, row.userId, filePath)) {
      throw httpError(409, 'locks.releaseDirtyBlocked', { path: filePath });
    }
    this.db.delete(fileLocks).where(eq(fileLocks.id, row.id)).run();
    this.auditRecord({
      projectId,
      branch,
      actorId: user.id,
      action: 'release',
      targetPath: filePath,
      details: { ownerUserId: row.userId },
    });
    return this.toView(row);
  }

  assertOwnLock(projectId: string, branch: string, filePath: string, user: IdentityUser): LockView {
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw httpError(409, 'locks.commitNotCheckedOut', { path: filePath });
    }
    if (row.userId !== user.id && user.role !== 'admin') {
      const owner = this.userName(row.userId);
      throw httpError(403, 'locks.commitByOther', { user: owner.name });
    }
    return this.toView(row);
  }

  /**
   * Enforces the write policy for an existing file:
   * - viewer: denied
   * - locked by someone else: conflict for every role (an expired clean lock may be reclaimed)
   * - locked by caller: refresh and allow
   * - unlocked: admin and new files auto-lock; writers on existing files must check out first
   */
  async authorizeWrite(options: {
    workDir: string;
    projectRootDir: string;
    filePath: string;
    user: IdentityUser;
    exists: boolean;
  }): Promise<WriteAuthorization> {
    const { workDir, projectRootDir, filePath, user, exists } = options;
    if (user.role === 'viewer') {
      throw httpError(403, 'locks.viewerCannotModify');
    }
    const projectId = this.ensureRepository(projectRootDir);
    const branch = await this.git.currentBranch(workDir);
    const row = this.findRow(projectId, branch, filePath);
    if (row) {
      if (row.userId !== user.id) {
        if (!this.tryReclaimStaleLock(projectId, branch, row, filePath)) {
          const owner = this.userName(row.userId);
          throw httpError(409, 'locks.saveConflict', { user: owner.name });
        }
      } else {
        const now = Date.now();
        this.db.update(fileLocks).set({ updatedAt: now }).where(eq(fileLocks.id, row.id)).run();
        return { lock: this.toView({ ...row, updatedAt: now }), autoLocked: false };
      }
    }
    if (!exists || user.role === 'admin') {
      const lock = await this.checkout({
        workDir,
        projectRootDir,
        filePath,
        user,
        allowMissing: true,
      });
      return { lock, autoLocked: true };
    }
    throw httpError(409, 'locks.checkoutFirst');
  }

  /**
   * Hands a check-out (and the owner's drafts) to another writer without touching Git.
   */
  handoff(options: {
    projectId: string;
    branch: string;
    filePath: string;
    fromUser: IdentityUser;
    targetUserId: string;
  }): LockHandoffResult {
    const { projectId, branch, filePath, fromUser, targetUserId } = options;
    const target = this.db.select().from(users).where(eq(users.id, targetUserId)).get();
    if (!target) {
      throw httpError(400, 'locks.handoffTargetInvalid');
    }
    if (target.role === 'viewer') {
      throw httpError(403, 'locks.handoffViewerForbidden');
    }
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw httpError(404, 'locks.notCheckedOut', { path: filePath });
    }
    if (row.userId !== fromUser.id && fromUser.role !== 'admin') {
      throw httpError(403, 'locks.moveOthersLock');
    }
    const draft =
      this.drafts?.getDraft(projectId, branch, filePath) ??
      this.drafts?.findUserDraftByOriginalPath(projectId, branch, row.userId, filePath) ??
      null;
    const affectedPaths =
      draft?.op === 'rename' && draft.originalPath
        ? [draft.originalPath, draft.filePath]
        : [...new Set([filePath, ...(draft ? [draft.filePath] : [])])];
    const now = Date.now();
    this.db.transaction((tx) => {
      tx.update(fileLocks)
        .set({ userId: targetUserId, updatedAt: now })
        .where(
          and(
            eq(fileLocks.projectId, projectId),
            eq(fileLocks.branch, branch),
            inArray(fileLocks.filePath, affectedPaths),
          ),
        )
        .run();
      tx.update(workingDrafts)
        .set({ userId: targetUserId, updatedAt: now })
        .where(
          and(
            eq(workingDrafts.projectId, projectId),
            eq(workingDrafts.branch, branch),
            inArray(workingDrafts.filePath, affectedPaths),
          ),
        )
        .run();
    });
    this.drafts?.bumpDraftRev(projectId, branch, row.userId);
    this.drafts?.bumpDraftRev(projectId, branch, targetUserId);
    this.auditRecord({
      projectId,
      branch,
      actorId: fromUser.id,
      action: 'handoff',
      targetPath: filePath,
      details: { targetUserId, fromUserId: row.userId, paths: affectedPaths },
    });
    return {
      lock: this.toView({ ...row, userId: targetUserId, updatedAt: now }),
      targetUserId,
      affectedPaths,
    };
  }

  /**
   * Acquires the lock for a rename target, keeping BOTH paths locked for baseline files so
   * nobody can touch the old path before check-in.
   */
  async lockForRename(options: {
    projectId: string;
    branch: string;
    fromPath: string;
    toPath: string;
    user: IdentityUser;
    workDir: string;
    projectRootDir: string;
  }): Promise<LockView> {
    const { projectId, branch, fromPath, toPath, user, workDir, projectRootDir } = options;
    if (user.role === 'viewer') {
      throw httpError(403, 'locks.viewerCannotCheckout');
    }
    const fromRow = this.findRow(projectId, branch, fromPath);
    if (fromRow && fromRow.userId !== user.id && user.role !== 'admin') {
      throw httpError(403, 'locks.moveOthersLock');
    }
    if (!fromRow) {
      if (user.role !== 'admin') {
        throw httpError(409, 'locks.notCheckedOut', { path: fromPath });
      }
      await this.checkout({ workDir, projectRootDir, filePath: fromPath, user, allowMissing: true });
    }
    const target = this.findRow(projectId, branch, toPath);
    if (target) {
      if (target.userId !== user.id && user.role !== 'admin') {
        const owner = this.userName(target.userId);
        throw httpError(409, 'locks.moveTargetLocked', { user: owner.name });
      }
      return this.toView(target);
    }
    const now = Date.now();
    const row: FileLockRow = {
      id: randomUUID(),
      projectId,
      branch,
      filePath: toPath,
      userId: user.id,
      lockedAt: now,
      updatedAt: now,
    };
    this.db.insert(fileLocks).values(row).run();
    const createOnly = this.drafts?.getUserDraft(projectId, branch, user.id, fromPath)?.op === 'create';
    if (createOnly && fromRow) {
      this.db.delete(fileLocks).where(eq(fileLocks.id, fromRow.id)).run();
    }
    return this.toView(row);
  }

  async checkin(options: {
    workDir: string;
    projectRootDir: string;
    paths: string[];
    message: string;
    user: IdentityUser;
  }): Promise<CheckinResult> {
    const { workDir, projectRootDir, paths, message, user } = options;
    if (user.role === 'viewer') {
      throw httpError(403, 'locks.viewerCannotCommit');
    }
    if (paths.length === 0) {
      throw httpError(400, 'locks.filesRequired');
    }
    const projectId = this.ensureRepository(projectRootDir);
    const branch = await this.git.currentBranch(workDir);
    const drafts = this.drafts;

    if (!drafts) {
      const dirty = await this.git.statusMap(workDir);
      for (const filePath of paths) {
        const row = this.findRow(projectId, branch, filePath);
        if (!row) {
          throw httpError(409, 'locks.commitNotCheckedOut', { path: filePath });
        }
        if (row.userId !== user.id) {
          const owner = this.userName(row.userId);
          throw httpError(403, 'locks.commitByOtherWithPath', { user: owner.name, path: filePath });
        }
        if (!dirty.has(filePath)) {
          throw httpError(409, 'locks.noCommitChange', { path: filePath });
        }
      }
      const commit = await this.git.commit(workDir, paths, message, user);
      this.deleteLockPaths(projectId, branch, paths);
      this.auditRecord({
        projectId,
        branch,
        actorId: user.id,
        action: 'checkin',
        targetPath: paths[0] ?? null,
        details: { paths },
      });
      return {
        commit,
        branch,
        projectId,
        releasedPaths: paths,
        renames: [],
        deletedPaths: [],
        writtenPaths: paths,
      };
    }

    return this.git.withWorkDirLock(workDir, async () => {
      const resolved = new Map<string, WorkingDraftRow>();
      for (const filePath of paths) {
        const lock = this.findRow(projectId, branch, filePath);
        if (!lock) {
          throw httpError(409, 'locks.commitNotCheckedOut', { path: filePath });
        }
        if (lock.userId !== user.id) {
          const owner = this.userName(lock.userId);
          throw httpError(403, 'locks.commitByOtherWithPath', { user: owner.name, path: filePath });
        }
        const draft =
          drafts.getUserDraft(projectId, branch, user.id, filePath) ??
          drafts.findUserDraftByOriginalPath(projectId, branch, user.id, filePath);
        if (!draft) {
          throw httpError(409, 'locks.draftRequired', { path: filePath });
        }
        resolved.set(draft.id, draft);
      }
      const selected = [...resolved.values()];
      const affectedPaths = [
        ...new Set(
          selected.flatMap((draft) =>
            draft.originalPath ? [draft.originalPath, draft.filePath] : [draft.filePath],
          ),
        ),
      ];
      const external = await this.git.statusMap(workDir);
      const colliding = affectedPaths.filter((path) => external.has(path));
      if (colliding.length > 0) {
        throw httpError(409, 'git.externalDirtyConflict', { paths: colliding.join(', ') });
      }
      const existedBefore = new Set(
        affectedPaths.filter((path) => existsSync(join(workDir, path))),
      );
      try {
        for (const draft of selected) {
          await this.materializeDraft(workDir, draft);
        }
        const commit = await this.git.commitScopedChanges(workDir, affectedPaths, message, user, {
          alreadyLocked: true,
        });
        this.db.transaction((tx) => {
          for (const draft of selected) {
            tx.delete(workingDrafts).where(eq(workingDrafts.id, draft.id)).run();
          }
          tx.delete(fileLocks)
            .where(
              and(
                eq(fileLocks.projectId, projectId),
                eq(fileLocks.branch, branch),
                inArray(fileLocks.filePath, affectedPaths),
              ),
            )
            .run();
        });
        for (const draft of selected) {
          drafts.removeBlobForDraft(draft);
        }
        drafts.bumpDraftRev(projectId, branch, user.id);
        const renames = selected
          .filter((draft) => draft.op === 'rename' && draft.originalPath)
          .map((draft) => ({ from: draft.originalPath as string, to: draft.filePath }));
        const deletedPaths = selected
          .filter((draft) => draft.op === 'delete')
          .map((draft) => draft.filePath);
        const writtenPaths = selected
          .filter((draft) => draft.op !== 'delete')
          .map((draft) => draft.filePath);
        this.auditRecord({
          projectId,
          branch,
          actorId: user.id,
          action: 'checkin',
          targetPath: affectedPaths[0] ?? null,
          details: { paths: affectedPaths, renames },
        });
        return {
          commit,
          branch,
          projectId,
          releasedPaths: affectedPaths,
          renames,
          deletedPaths,
          writtenPaths,
        };
      } catch (error) {
        const tracked = affectedPaths.filter((path) => existedBefore.has(path));
        const untracked = affectedPaths.filter((path) => !existedBefore.has(path));
        try {
          await this.git.restoreTrackedPathsFromHead(workDir, tracked, untracked);
        } catch {
          // Preserve the original failure; rollback is best effort.
        }
        throw error;
      }
    });
  }

  async transferLock(options: {
    projectId: string;
    branch: string;
    fromPath: string;
    toPath: string;
    user: IdentityUser;
  }): Promise<void> {
    const { projectId, branch, fromPath, toPath, user } = options;
    const row = this.findRow(projectId, branch, fromPath);
    if (!row) return;
    if (row.userId !== user.id && user.role !== 'admin') {
      throw httpError(403, 'locks.moveOthersLock');
    }
    const target = this.findRow(projectId, branch, toPath);
    if (target && target.userId !== row.userId) {
      const owner = this.userName(target.userId);
      throw httpError(409, 'locks.moveTargetLocked', { user: owner.name });
    }
    if (target) {
      this.db.delete(fileLocks).where(eq(fileLocks.id, target.id)).run();
    }
    this.db
      .update(fileLocks)
      .set({ filePath: toPath, updatedAt: Date.now() })
      .where(eq(fileLocks.id, row.id))
      .run();
  }

  async cancelCheckout(options: {
    workDir: string;
    projectId: string;
    branch: string;
    filePath: string;
    user: IdentityUser;
  }): Promise<CancelCheckoutResult> {
    const { workDir, projectId, branch, filePath, user } = options;
    const lock = this.assertOwnLock(projectId, branch, filePath, user);

    if (!this.drafts) {
      const result = await this.git.discard(workDir, filePath);
      const released = this.release(projectId, branch, filePath, user);
      return { released, deleted: result.deleted, restoredPath: null };
    }

    const draft =
      this.drafts.getDraft(projectId, branch, filePath) ??
      this.drafts.findUserDraftByOriginalPath(projectId, branch, lock.userId, filePath);
    const paths = draft
      ? [...new Set([draft.filePath, ...(draft.originalPath ? [draft.originalPath] : []), filePath])]
      : [filePath];
    if (draft) {
      this.drafts.deleteUserDraft(projectId, branch, lock.userId, draft.filePath);
    }
    this.deleteLockPaths(projectId, branch, paths);
    this.drafts.bumpDraftRev(projectId, branch, lock.userId);
    this.auditRecord({
      projectId,
      branch,
      actorId: user.id,
      action: 'cancel',
      targetPath: filePath,
      details: {
        ownerUserId: lock.userId,
        paths,
        removedCreateOnly: draft?.op === 'create',
      },
    });
    return {
      released: lock,
      deleted: draft?.op === 'create',
      restoredPath: draft?.originalPath ?? null,
    };
  }

  async forceUnlock(options: {
    workDir: string;
    projectId: string;
    branch: string;
    filePath: string;
    admin: IdentityUser;
    reason?: string | undefined;
  }): Promise<ForceUnlockResult> {
    const { workDir, projectId, branch, filePath, admin } = options;
    if (admin.role !== 'admin') {
      throw httpError(403, 'locks.adminOnlyUnlock');
    }
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw httpError(404, 'locks.notCheckedOut', { path: filePath });
    }

    const draft = this.drafts
      ? this.drafts.getDraft(projectId, branch, filePath) ??
        this.drafts.findUserDraftByOriginalPath(projectId, branch, row.userId, filePath)
      : null;
    const paths = draft
      ? [...new Set([draft.filePath, ...(draft.originalPath ? [draft.originalPath] : []), filePath])]
      : [filePath];

    let content: string | null = null;
    let patch = '';
    if (draft) {
      content = draft.content;
      const baselinePath = draft.originalPath ?? draft.filePath;
      const baseline = await this.git.fileAtRevision(workDir, 'HEAD', baselinePath);
      patch = buildDraftPatch(draft.filePath, draft.op === 'create' ? null : baseline, draft.content);
    } else {
      const absolute = join(workDir, filePath);
      try {
        if (existsSync(absolute)) {
          content = readFileSync(absolute, 'utf8');
        }
      } catch {
        content = null;
      }
      patch = await this.git.diffPatch(workDir, filePath);
    }

    const backupId = randomUUID();
    const createdAt = Date.now();
    this.db
      .insert(lockBackups)
      .values({
        id: backupId,
        projectId,
        branch,
        filePath,
        ownerUserId: row.userId,
        content,
        patch: patch || null,
        reason:
          options.reason?.trim() ||
          apiT('zh-CN', 'locks.forceUnlockReason', { admin: admin.displayName }),
        createdAt,
      })
      .run();

    if (draft) {
      this.drafts?.deleteUserDraft(projectId, branch, row.userId, draft.filePath);
    }
    this.deleteLockPaths(projectId, branch, paths);
    this.drafts?.bumpDraftRev(projectId, branch, row.userId);
    this.auditRecord({
      projectId,
      branch,
      actorId: admin.id,
      action: 'force_unlock',
      targetPath: filePath,
      details: { ownerUserId: row.userId, paths, reason: options.reason ?? null },
    });
    return {
      released: this.toView(row),
      backup: {
        id: backupId,
        filePath,
        ownerUserId: row.userId,
        hasContent: content !== null,
        patchPreview: (patch || content || '').slice(0, 400),
        createdAt: new Date(createdAt).toISOString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Draft materialization (Phase 13)
  // ---------------------------------------------------------------------------

  private deleteLockPaths(projectId: string, branch: string, paths: string[]): void {
    if (paths.length === 0) return;
    this.db
      .delete(fileLocks)
      .where(
        and(
          eq(fileLocks.projectId, projectId),
          eq(fileLocks.branch, branch),
          inArray(fileLocks.filePath, paths),
        ),
      )
      .run();
  }

  private async materializeDraft(workDir: string, draft: WorkingDraftRow): Promise<void> {
    if (draft.op === 'delete') {
      rmSync(join(workDir, draft.filePath), { recursive: true, force: true });
      return;
    }
    if (draft.op === 'rename' && draft.originalPath) {
      rmSync(join(workDir, draft.originalPath), { recursive: true, force: true });
    }
    const target = join(workDir, draft.filePath);
    mkdirSync(dirname(target), { recursive: true });
    const blob = this.drafts?.readBinaryDraft(draft) ?? null;
    if (blob) {
      writeFileSync(target, blob);
      return;
    }
    if (draft.content !== null) {
      writeFileSync(target, draft.content, 'utf8');
      return;
    }
    if (draft.op === 'rename' && draft.originalPath) {
      const baseline = await this.git.fileAtRevision(workDir, 'HEAD', draft.originalPath);
      if (baseline !== null) {
        writeFileSync(target, baseline, 'utf8');
      }
    }
  }
}
