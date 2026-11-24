import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  fileLocks,
  manuals,
  topicAssignments,
  type ManualRow,
  type TopicAssignmentRow,
} from '../../db/schema.js';
import { httpError } from '../errors.js';
import type { GitManager } from '../git/git-manager.js';
import type { IdentityService, IdentityUser, UserRole } from '../identity/identity-service.js';

export type AssignmentStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type AssignmentStatusFilter = AssignmentStatus | 'active' | 'all';
export type AssignmentScope = 'mine' | 'delegated' | 'all';

const ACTIVE_STATUSES: AssignmentStatus[] = ['pending', 'in_progress'];
const ALL_STATUSES: AssignmentStatus[] = ['pending', 'in_progress', 'done', 'cancelled'];
const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface AssignmentPerson {
  id: string;
  displayName: string;
  color: string;
  initials: string;
  role: UserRole | string;
}

export interface AssignmentView {
  id: string;
  manualId: string;
  manualName: string;
  branch: string;
  topicPath: string;
  topicTitle: string | null;
  topicExists: boolean;
  status: AssignmentStatus;
  note: string;
  dueDate: string | null;
  overdue: boolean;
  assignee: AssignmentPerson | null;
  assigner: AssignmentPerson | null;
  lockOwnerId: string | null;
  lockOwnerName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AssignmentSummary {
  myPending: number;
  myInProgress: number;
  myOverdue: number;
  delegatedActive: number;
}

export interface AssignmentListQuery {
  scope?: AssignmentScope;
  status?: AssignmentStatusFilter;
  manualId?: string;
  branch?: string;
  topicPath?: string;
}

export interface CreateAssignmentInput {
  manualId: string;
  branch: string;
  topicPath: string;
  assigneeId: string;
  note?: string;
  dueDate?: string | null;
}

export interface UpdateAssignmentInput {
  status?: AssignmentStatus;
  assigneeId?: string;
  note?: string;
  dueDate?: string | null;
}

export interface AssignmentServiceOptions {
  db: DitaDatabase;
  identity: IdentityService;
  git: GitManager;
}

function parseStatus(value: string | undefined, fallback: AssignmentStatus): AssignmentStatus {
  return ALL_STATUSES.includes(value as AssignmentStatus)
    ? (value as AssignmentStatus)
    : fallback;
}

function toPersons(user: IdentityUser | undefined): AssignmentPerson | null {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    color: user.color,
    initials: user.initials,
    role: user.role,
  };
}

function normalizeTopicPath(raw: string): string {
  const posix = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!posix || posix.includes('..') || posix.includes('\0')) {
    throw httpError(400, 'assignments.topicMissing', { path: raw });
  }
  return posix;
}

function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function extractTitle(xml: string): string | null {
  const match = TITLE_PATTERN.exec(xml);
  if (!match) return null;
  const text = decodeEntities(match[1]!.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim();
  return text || null;
}

/**
 * Soft Topic editing assignments (ADR-0003): SQLite-only delegation metadata. Nothing here ever
 * touches DITA XML or Git, and assignments do not create locks — check-out remains explicit.
 */
export class AssignmentService {
  private readonly db: DitaDatabase;
  private readonly identity: IdentityService;
  private readonly git: GitManager;
  private readonly titleCache = new Map<string, { mtimeKey: string; title: string | null }>();

  constructor(options: AssignmentServiceOptions) {
    this.db = options.db;
    this.identity = options.identity;
    this.git = options.git;
  }

  async list(query: AssignmentListQuery, user: IdentityUser): Promise<AssignmentView[]> {
    const filters: SQL[] = [];
    const scope = query.scope ?? 'all';
    if (scope === 'mine') filters.push(eq(topicAssignments.assigneeId, user.id));
    if (scope === 'delegated') filters.push(eq(topicAssignments.assignerId, user.id));
    if (query.manualId) filters.push(eq(topicAssignments.manualId, query.manualId));
    if (query.branch) filters.push(eq(topicAssignments.branch, query.branch));
    if (query.topicPath) filters.push(eq(topicAssignments.topicPath, query.topicPath));

    const status = query.status ?? 'active';
    if (status === 'active') {
      filters.push(inArray(topicAssignments.status, ACTIVE_STATUSES));
    } else if (status !== 'all') {
      filters.push(eq(topicAssignments.status, parseStatus(status, 'pending')));
    }

    const rows = await this.db
      .select()
      .from(topicAssignments)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(topicAssignments.updatedAt));

    return this.decorate(rows);
  }

  async summary(
    user: IdentityUser,
    scope: { manualId?: string; branch?: string } = {},
  ): Promise<AssignmentSummary> {
    const filters: SQL[] = [inArray(topicAssignments.status, ACTIVE_STATUSES)];
    if (scope.manualId) filters.push(eq(topicAssignments.manualId, scope.manualId));
    if (scope.branch) filters.push(eq(topicAssignments.branch, scope.branch));
    const rows = await this.db
      .select()
      .from(topicAssignments)
      .where(and(...filters));

    const today = todayIso();
    const summary: AssignmentSummary = {
      myPending: 0,
      myInProgress: 0,
      myOverdue: 0,
      delegatedActive: 0,
    };
    for (const row of rows) {
      const overdue = Boolean(row.dueDate && row.dueDate < today);
      if (row.assigneeId === user.id) {
        if (row.status === 'pending') summary.myPending += 1;
        if (row.status === 'in_progress') summary.myInProgress += 1;
        if (overdue) summary.myOverdue += 1;
      }
      if (row.assignerId === user.id) summary.delegatedActive += 1;
    }
    return summary;
  }

  async get(id: string): Promise<AssignmentView> {
    const rows = await this.db
      .select()
      .from(topicAssignments)
      .where(eq(topicAssignments.id, id))
      .limit(1);
    if (rows.length === 0) throw httpError(404, 'assignments.notFound', { id });
    const [view] = await this.decorate(rows);
    return view!;
  }

  async findActive(
    manualId: string,
    branch: string,
    topicPath: string,
  ): Promise<TopicAssignmentRow | null> {
    const rows = await this.db
      .select()
      .from(topicAssignments)
      .where(
        and(
          eq(topicAssignments.manualId, manualId),
          eq(topicAssignments.branch, branch),
          eq(topicAssignments.topicPath, topicPath),
          inArray(topicAssignments.status, ACTIVE_STATUSES),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async activeForTopic(
    manualId: string,
    branch: string,
    topicPath: string,
  ): Promise<AssignmentView | null> {
    const row = await this.findActive(manualId, branch, topicPath);
    if (!row) return null;
    const [view] = await this.decorate([row]);
    return view ?? null;
  }

  async create(input: CreateAssignmentInput, user: IdentityUser): Promise<AssignmentView> {
    if (user.role === 'viewer') throw httpError(403, 'assignments.viewerForbidden');

    const manual = await this.requireManual(input.manualId);
    const topicPath = normalizeTopicPath(input.topicPath);
    if (!topicPath.toLowerCase().endsWith('.dita')) {
      throw httpError(400, 'assignments.topicNotDita', { path: topicPath });
    }
    if (!existsSync(path.join(await this.branchRoot(manual, input.branch), topicPath))) {
      throw httpError(404, 'assignments.topicMissing', { path: topicPath });
    }

    const assignee = this.requireAssignable(input.assigneeId);
    const dueDate = this.normalizeDueDate(input.dueDate);

    const existing = await this.findActive(manual.id, input.branch, topicPath);
    if (existing) {
      const [view] = await this.decorate([existing]);
      throw httpError(409, 'assignments.activeExists', undefined, {
        existingAssignment: view ?? null,
      });
    }

    const timestamp = Date.now();
    const row: TopicAssignmentRow = {
      id: randomUUID(),
      manualId: manual.id,
      branch: input.branch,
      topicPath,
      assigneeId: assignee.id,
      assignerId: user.id,
      status: 'pending',
      note: input.note?.trim() ?? '',
      dueDate,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
    };
    try {
      await this.db.insert(topicAssignments).values(row);
    } catch (err) {
      // The partial unique index wins races; surface the same 409 shape as the pre-check.
      const raced = await this.findActive(manual.id, input.branch, topicPath);
      if (raced) {
        const [view] = await this.decorate([raced]);
        throw httpError(409, 'assignments.activeExists', undefined, {
          existingAssignment: view ?? null,
        });
      }
      throw err;
    }
    return this.get(row.id);
  }

  async update(
    id: string,
    patch: UpdateAssignmentInput,
    user: IdentityUser,
  ): Promise<AssignmentView> {
    const row = await this.requireRow(id);
    if (user.role === 'viewer') throw httpError(403, 'assignments.viewerForbidden');

    const isAdmin = user.role === 'admin';
    const isAssigner = row.assignerId === user.id;
    const isAssignee = row.assigneeId === user.id;
    if (!isAdmin && !isAssigner && !isAssignee) {
      throw httpError(403, 'assignments.assignerOrAssigneeOnly');
    }

    const next: Partial<TopicAssignmentRow> = {};
    const timestamp = Date.now();

    if (patch.assigneeId !== undefined && patch.assigneeId !== row.assigneeId) {
      const assignee = this.requireAssignable(patch.assigneeId);
      next.assigneeId = assignee.id;
      // Re-opening a finished assignment keeps the topic in the active set again.
      if (row.status === 'done' || row.status === 'cancelled') {
        next.status = 'pending';
        next.completedAt = null;
      } else {
        const clash = await this.findActive(row.manualId, row.branch, row.topicPath);
        if (clash && clash.id !== row.id) {
          throw httpError(409, 'assignments.activeExists');
        }
      }
    }

    if (patch.status !== undefined && patch.status !== row.status) {
      const status = parseStatus(patch.status, row.status);
      if (!ACTIVE_STATUSES.includes(status) && !isAdmin && !isAssigner && !isAssignee) {
        throw httpError(403, 'assignments.assignerOrAssigneeOnly');
      }
      next.status = status;
      next.completedAt = status === 'done' ? timestamp : null;
    }

    if (patch.note !== undefined) next.note = patch.note.trim();
    if (patch.dueDate !== undefined) next.dueDate = this.normalizeDueDate(patch.dueDate);

    if (Object.keys(next).length > 0) {
      await this.db
        .update(topicAssignments)
        .set({ ...next, updatedAt: timestamp })
        .where(eq(topicAssignments.id, id));
    }
    return this.get(id);
  }

  async cancel(id: string, user: IdentityUser): Promise<AssignmentView> {
    const row = await this.requireRow(id);
    if (user.role === 'viewer') throw httpError(403, 'assignments.viewerForbidden');
    const allowed =
      user.role === 'admin' || row.assignerId === user.id || row.assigneeId === user.id;
    if (!allowed) throw httpError(403, 'assignments.assignerOrAssigneeOnly');
    const timestamp = Date.now();
    await this.db
      .update(topicAssignments)
      .set({ status: 'cancelled', completedAt: null, updatedAt: timestamp })
      .where(eq(topicAssignments.id, id));
    return this.get(id);
  }

  /** Removes the delegation record entirely (admin only; cancelling is the soft path). */
  async delete(id: string, user: IdentityUser): Promise<void> {
    const row = await this.requireRow(id);
    if (user.role !== 'admin' && row.assignerId !== user.id) {
      throw httpError(403, 'assignments.adminOrAssignerOnly');
    }
    await this.db.delete(topicAssignments).where(eq(topicAssignments.id, id));
  }

  /** Check-out hook: the assignee starting work moves a `pending` task to `in_progress`. */
  async markInProgressForCheckout(input: {
    manualId: string;
    branch: string;
    topicPath: string;
    userId: string;
  }): Promise<AssignmentView | null> {
    const row = await this.findActive(input.manualId, input.branch, input.topicPath);
    if (!row || row.assigneeId !== input.userId || row.status !== 'pending') return null;
    const timestamp = Date.now();
    await this.db
      .update(topicAssignments)
      .set({ status: 'in_progress', updatedAt: timestamp })
      .where(eq(topicAssignments.id, row.id));
    return this.get(row.id);
  }

  /**
   * Check-in hook: completes the caller's active assignments whose topic is part of the commit.
   * Explicit ids must intersect the committed paths, so a stale client cannot close other work.
   */
  async completeOnCheckin(input: {
    manualId: string;
    branch: string;
    paths: readonly string[];
    userId: string;
    ids?: readonly string[];
  }): Promise<AssignmentView[]> {
    const pathSet = new Set(input.paths);
    const idSet = input.ids && input.ids.length > 0 ? new Set(input.ids) : null;
    const filters: SQL[] = [
      eq(topicAssignments.manualId, input.manualId),
      eq(topicAssignments.branch, input.branch),
      eq(topicAssignments.assigneeId, input.userId),
      inArray(topicAssignments.status, ACTIVE_STATUSES),
    ];
    if (pathSet.size > 0) filters.push(inArray(topicAssignments.topicPath, [...pathSet]));
    const rows = await this.db
      .select()
      .from(topicAssignments)
      .where(and(...filters));

    const targets = rows.filter((row) => {
      if (pathSet.size > 0 && !pathSet.has(row.topicPath)) return false;
      if (idSet && !idSet.has(row.id)) return false;
      return true;
    });

    if (targets.length === 0) return [];
    const timestamp = Date.now();
    await this.db
      .update(topicAssignments)
      .set({ status: 'done', completedAt: timestamp, updatedAt: timestamp })
      .where(
        inArray(
          topicAssignments.id,
          targets.map((row) => row.id),
        ),
      );
    return this.decorate(
      targets.map((row) => ({
        ...row,
        status: 'done' as AssignmentStatus,
        completedAt: timestamp,
        updatedAt: timestamp,
      })),
    );
  }

  /** Rename hook: keep the assignment pointing at the new topic path. */
  async syncRename(input: {
    manualId: string;
    branch: string;
    fromPath: string;
    toPath: string;
  }): Promise<void> {
    await this.db
      .update(topicAssignments)
      .set({ topicPath: input.toPath, updatedAt: Date.now() })
      .where(
        and(
          eq(topicAssignments.manualId, input.manualId),
          eq(topicAssignments.branch, input.branch),
          eq(topicAssignments.topicPath, input.fromPath),
          inArray(topicAssignments.status, ACTIVE_STATUSES),
        ),
      );
  }

  private async requireRow(id: string): Promise<TopicAssignmentRow> {
    const rows = await this.db
      .select()
      .from(topicAssignments)
      .where(eq(topicAssignments.id, id))
      .limit(1);
    if (rows.length === 0) throw httpError(404, 'assignments.notFound', { id });
    return rows[0]!;
  }

  private async requireManual(manualId: string): Promise<ManualRow> {
    const rows = await this.db.select().from(manuals).where(eq(manuals.id, manualId)).limit(1);
    if (rows.length === 0) throw httpError(404, 'manuals.notFound', { id: manualId });
    return rows[0]!;
  }

  private requireAssignable(userId: string): IdentityUser {
    const user = this.identity.get(userId);
    if (!user) throw httpError(404, 'assignments.assigneeNotFound', { id: userId });
    if (user.role === 'viewer') {
      throw httpError(403, 'assignments.assigneeViewer', { user: user.displayName });
    }
    return user;
  }

  private normalizeDueDate(value: string | null | undefined): string | null {
    if (value === undefined || value === null || value === '') return null;
    const trimmed = value.trim();
    if (!DUE_DATE_PATTERN.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
      throw httpError(400, 'assignments.invalidDueDate', { value: trimmed });
    }
    return trimmed;
  }

  /**
   * Working directory for the branch. Uses the branch worktree when one exists, otherwise the
   * primary checkout (which is what a brand-new branch will eventually branch from).
   */
  private async branchRoot(manual: ManualRow, branch: string): Promise<string> {
    if (!this.git.isRepository(manual.rootDir)) return manual.rootDir;
    const fromPrimary = await this.git.currentBranch(manual.rootDir).catch(() => 'main');
    if (branch === fromPrimary) return manual.rootDir;
    const worktree = await this.git.worktreePathForBranch(manual.rootDir, branch).catch(() => null);
    return worktree ?? manual.rootDir;
  }

  private async readTopicTitle(
    manual: ManualRow,
    branch: string,
    topicPath: string,
  ): Promise<string | null> {
    const abs = path.join(await this.branchRoot(manual, branch), topicPath);
    if (!existsSync(abs)) return null;
    const cacheKey = `${manual.id}::${branch}::${topicPath}`;
    try {
      const { mtimeMs } = await stat(abs);
      const cached = this.titleCache.get(cacheKey);
      if (cached && cached.mtimeKey === `${mtimeMs}`) return cached.title;
      const xml = await readFile(abs, 'utf8');
      const title = extractTitle(xml);
      this.titleCache.set(cacheKey, { mtimeKey: `${mtimeMs}`, title });
      return title;
    } catch {
      return null;
    }
  }

  private async decorate(rows: TopicAssignmentRow[]): Promise<AssignmentView[]> {
    if (rows.length === 0) return [];
    const manualIds = [...new Set(rows.map((row) => row.manualId))];
    const manualRows = await this.db
      .select()
      .from(manuals)
      .where(inArray(manuals.id, manualIds));
    const manualMap = new Map(manualRows.map((row) => [row.id, row]));

    const branches = [...new Set(rows.map((row) => row.branch))];
    const locks = await this.db
      .select()
      .from(fileLocks)
      .where(
        and(
          inArray(fileLocks.projectId, manualIds),
          inArray(fileLocks.branch, branches),
        ),
      );
    const lockMap = new Map(locks.map((lock) => [`${lock.projectId}::${lock.branch}::${lock.filePath}`, lock]));

    const today = todayIso();
    const views: AssignmentView[] = [];
    for (const row of rows) {
      const manual = manualMap.get(row.manualId) ?? null;
      const lock = lockMap.get(`${row.manualId}::${row.branch}::${row.topicPath}`);
      const lockOwner = lock ? (this.identity.get(lock.userId) ?? null) : null;
      const title = manual ? await this.readTopicTitle(manual, row.branch, row.topicPath) : null;
      const topicExists = manual
        ? existsSync(path.join(await this.branchRoot(manual, row.branch), row.topicPath))
        : false;
      const assignee = this.identity.get(row.assigneeId);
      const assigner = this.identity.get(row.assignerId);
      views.push({
        id: row.id,
        manualId: row.manualId,
        manualName: manual?.name ?? row.manualId,
        branch: row.branch,
        topicPath: row.topicPath,
        topicTitle: title,
        topicExists,
        status: row.status as AssignmentStatus,
        note: row.note,
        dueDate: row.dueDate,
        overdue: Boolean(
          row.dueDate &&
            row.dueDate < today &&
            ACTIVE_STATUSES.includes(row.status as AssignmentStatus),
        ),
        assignee: toPersons(assignee),
        assigner: toPersons(assigner),
        lockOwnerId: lock?.userId ?? null,
        lockOwnerName: lockOwner?.displayName ?? null,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
      });
    }
    return views;
  }
}
