import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { fileLocks, lockBackups, repositories, users, type FileLockRow } from '../../db/schema.js';
import { HttpError } from '../errors.js';
import type { GitManager } from '../git/git-manager.js';
import { repositoryIdFor } from '../git/git-manager.js';
import type { IdentityUser, UserRole } from '../identity/identity-service.js';

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

const DEFAULT_LOCK_TTL_HOURS = 72;

function lockTtlMs(): number {
  const parsed = Number.parseFloat(process.env.DITA_LOCK_TTL_HOURS ?? '');
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LOCK_TTL_HOURS;
  return hours * 60 * 60 * 1000;
}

function isExpired(lockedAt: number): boolean {
  return Date.now() - lockedAt > lockTtlMs();
}

export class LockService {
  constructor(
    private readonly db: DitaDatabase,
    private readonly git: GitManager,
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
      expired: isExpired(row.lockedAt),
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

  currentBranch(workDir: string): Promise<string> {
    return this.git.currentBranch(workDir);
  }

  ensureRepository(rootDir: string): string {
    const projectId = repositoryIdFor(rootDir);
    const existing = this.db.select().from(repositories).where(eq(repositories.id, projectId)).get();
    if (!existing) {
      this.db
        .insert(repositories)
        .values({
          id: projectId,
          rootDir,
          name: rootDir.split('/').pop() ?? 'DITA Project',
          createdAt: Date.now(),
          initializedAt: null,
        })
        .onConflictDoNothing()
        .run();
    }
    return projectId;
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

  async checkout(options: {
    workDir: string;
    projectRootDir: string;
    filePath: string;
    user: IdentityUser;
    allowMissing?: boolean;
  }): Promise<LockView> {
    const { workDir, projectRootDir, filePath, user } = options;
    if (user.role === 'viewer') {
      throw new HttpError(403, '只读角色无法检出文件');
    }
    if (!options.allowMissing && !existsSync(join(workDir, filePath))) {
      throw new HttpError(404, `文件不存在：${filePath}`);
    }
    await this.git.ensureInitialized(projectRootDir);
    const projectId = this.ensureRepository(projectRootDir);
    this.markInitialized(projectId);
    const branch = await this.git.currentBranch(workDir);
    const existing = this.findRow(projectId, branch, filePath);
    if (existing) {
      if (existing.userId === user.id) {
        this.db
          .update(fileLocks)
          .set({ updatedAt: Date.now() })
          .where(eq(fileLocks.id, existing.id))
          .run();
        return this.toView({ ...existing, updatedAt: Date.now() });
      }
      const owner = this.userName(existing.userId);
      throw new HttpError(
        409,
        `文件已被 ${owner.name} 检出（${new Date(existing.lockedAt).toLocaleString('zh-CN')}）`,
        { lock: this.toView(existing) },
      );
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
        throw new HttpError(409, `文件已被 ${owner.name} 检出`, { lock: this.toView(current) });
      }
      throw error;
    }
    return this.toView(row);
  }

  release(projectId: string, branch: string, filePath: string, user: IdentityUser): LockView {
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw new HttpError(404, `文件未被检出：${filePath}`);
    }
    if (row.userId !== user.id && user.role !== 'admin') {
      throw new HttpError(403, '只能释放自己的检出锁');
    }
    this.db.delete(fileLocks).where(eq(fileLocks.id, row.id)).run();
    return this.toView(row);
  }

  assertOwnLock(projectId: string, branch: string, filePath: string, user: IdentityUser): LockView {
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw new HttpError(409, `文件未检出，无法提交：${filePath}`);
    }
    if (row.userId !== user.id && user.role !== 'admin') {
      const owner = this.userName(row.userId);
      throw new HttpError(403, `文件由 ${owner.name} 检出，无法提交`);
    }
    return this.toView(row);
  }

  /**
   * Enforces the write policy for an existing file:
   * - viewer: denied
   * - admin: allowed without lock
   * - writer: must own the lock; new files are locked implicitly.
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
      throw new HttpError(403, '只读角色无权修改文件');
    }
    if (user.role === 'admin') {
      this.ensureRepository(projectRootDir);
      return { lock: null, autoLocked: false };
    }
    const projectId = this.ensureRepository(projectRootDir);
    const branch = await this.git.currentBranch(workDir);
    const row = this.findRow(projectId, branch, filePath);
    if (row) {
      if (row.userId !== user.id) {
        const owner = this.userName(row.userId);
        throw new HttpError(409, `文件已被 ${owner.name} 检出，无法保存`);
      }
      this.db.update(fileLocks).set({ updatedAt: Date.now() }).where(eq(fileLocks.id, row.id)).run();
      return { lock: this.toView(row), autoLocked: false };
    }
    if (!exists) {
      const lock = await this.checkout({
        workDir,
        projectRootDir,
        filePath,
        user,
        allowMissing: true,
      });
      return { lock, autoLocked: true };
    }
    throw new HttpError(409, '请先检出该文件再编辑保存');
  }

  async checkin(options: {
    workDir: string;
    projectRootDir: string;
    paths: string[];
    message: string;
    user: IdentityUser;
  }): Promise<{ commit: import('../git/git-manager.js').GitCommitEntry; branch: string; projectId: string; releasedPaths: string[] }> {
    const { workDir, projectRootDir, paths, message, user } = options;
    if (user.role === 'viewer') {
      throw new HttpError(403, '只读角色无法提交');
    }
    if (paths.length === 0) {
      throw new HttpError(400, '请选择要提交的文件');
    }
    const projectId = this.ensureRepository(projectRootDir);
    const branch = await this.git.currentBranch(workDir);
    const dirty = await this.git.statusMap(workDir);
    for (const filePath of paths) {
      const row = this.findRow(projectId, branch, filePath);
      if (!row) {
        throw new HttpError(409, `文件未检出，无法提交：${filePath}`);
      }
      if (row.userId !== user.id) {
        const owner = this.userName(row.userId);
        throw new HttpError(403, `文件由 ${owner.name} 检出，无法提交：${filePath}`);
      }
      if (!dirty.has(filePath)) {
        throw new HttpError(409, `文件没有可提交的改动：${filePath}`);
      }
    }
    const commit = await this.git.commit(workDir, paths, message, user);
    for (const filePath of paths) {
      this.db
        .delete(fileLocks)
        .where(
          and(
            eq(fileLocks.projectId, projectId),
            eq(fileLocks.branch, branch),
            eq(fileLocks.filePath, filePath),
          ),
        )
        .run();
    }
    return { commit, branch, projectId, releasedPaths: paths };
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
      throw new HttpError(403, '无法移动他人检出的文件');
    }
    const target = this.findRow(projectId, branch, toPath);
    if (target && target.userId !== row.userId) {
      const owner = this.userName(target.userId);
      throw new HttpError(409, `目标路径已被 ${owner.name} 检出`);
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
  }): Promise<{ released: LockView; deleted: boolean }> {
    const { workDir, projectId, branch, filePath, user } = options;
    this.assertOwnLock(projectId, branch, filePath, user);
    const result = await this.git.discard(workDir, filePath);
    const released = this.release(projectId, branch, filePath, user);
    return { released, deleted: result.deleted };
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
      throw new HttpError(403, '仅管理员可强制解锁');
    }
    const row = this.findRow(projectId, branch, filePath);
    if (!row) {
      throw new HttpError(404, `文件未被检出：${filePath}`);
    }
    let content: string | null = null;
    const absolute = join(workDir, filePath);
    try {
      if (existsSync(absolute)) {
        content = readFileSync(absolute, 'utf8');
      }
    } catch {
      content = null;
    }
    const patch = await this.git.diffPatch(workDir, filePath);
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
        reason: options.reason?.trim() || `管理员 ${admin.displayName} 强制解锁`,
        createdAt,
      })
      .run();

    this.db.delete(fileLocks).where(eq(fileLocks.id, row.id)).run();
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
}
