import { existsSync } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { and, count, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { manuals, topicAssignments, type ManualRow } from '../../db/schema.js';
import type { ApiLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';
import { httpError } from '../errors.js';
import { repositoryIdFor, type GitManager } from '../git/git-manager.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { WorkspaceManager, type WorkspaceScaffold } from '../files/workspace-fs.js';

export interface ManualStats {
  totalTopics: number;
  totalMaps: number;
}

export interface ManualView {
  id: string;
  name: string;
  description: string;
  rootDir: string;
  defaultRootMap: string | null;
  isBuiltin: boolean;
  archived: boolean;
  /** False when the folder vanished from disk; the record is kept so the hub can explain it. */
  exists: boolean;
  currentBranch: string;
  stats: ManualStats;
  activeAssignmentCount: number;
  myActiveAssignmentCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
}

export interface ManualListSnapshot {
  defaultRootDir: string;
  importsRootDir: string;
  manuals: ManualView[];
}

export type ManualCreateMode = 'create' | 'import' | 'attach';

export interface ManualCreateInput {
  mode: ManualCreateMode;
  name?: string;
  description?: string;
  rootDir?: string;
  parentDir?: string;
  scaffold?: WorkspaceScaffold;
  files?: { path: string; content: string; encoding?: 'utf8' | 'base64' }[];
  initGit?: boolean;
}

export interface ManualUpdateInput {
  name?: string;
  description?: string;
  defaultRootMap?: string | null;
  archived?: boolean;
}

export interface ManualRegistryOptions {
  db: DitaDatabase;
  git: GitManager;
  defaultRootDir: string;
  importsRootDir: string;
  /** Legacy registry file loader/writer (workspaces.json) used for upgrade + tombstones. */
  registryWorkspace: WorkspaceManager;
}

const BUILTIN_SCOPE_DIRS = new Set(['git-worktrees', 'publish']);
const STATS_CACHE_TTL_MS = 15_000;
const DEFAULT_MANUAL_CREATOR = 'u-admin';

function nowIso(ms: number | null | undefined): string | null {
  return typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null;
}

/** Cheap directory census: counts topics/maps without parsing XML or building a file tree. */
export async function countManualFiles(rootDir: string): Promise<ManualStats> {
  const stats: ManualStats = { totalTopics: 0, totalMaps: 0 };

  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isDirectory()) {
        if (!BUILTIN_SCOPE_DIRS.has(entry.name)) await walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.dita')) stats.totalTopics += 1;
      else if (lower.endsWith('.ditamap') || lower.endsWith('.bookmap')) stats.totalMaps += 1;
    }
  };

  await walk(rootDir);
  return stats;
}

/**
 * Registers manuals (one manual = one independent workspace + Git repository) and keeps the
 * `manuals` table in sync with what actually exists on disk. Records are never deleted when a
 * folder goes missing, and `remove()` only unregisters — the folder and its Git history survive.
 */
export class ManualRegistryService {
  private readonly db: DitaDatabase;
  private readonly git: GitManager;
  private readonly registryWorkspace: WorkspaceManager;
  private readonly creationManager: WorkspaceManager;
  readonly defaultRootDir: string;
  readonly importsRootDir: string;
  private readonly statsCache = new Map<string, { at: number; stats: ManualStats }>();

  constructor(options: ManualRegistryOptions) {
    this.db = options.db;
    this.git = options.git;
    this.registryWorkspace = options.registryWorkspace;
    this.defaultRootDir = path.resolve(options.defaultRootDir);
    this.importsRootDir = path.resolve(options.importsRootDir);
    // Dedicated manager so creating a manual never repoints a live request session.
    this.creationManager = new WorkspaceManager({
      workspaceDir: this.defaultRootDir,
      importsRootDir: this.importsRootDir,
      registryPath: this.registryWorkspace.registryPath,
    });
  }

  /**
   * Idempotent startup sync: default sample workspace, `workspaces.json` entries (hidden
   * tombstones excluded) and unregistered folders under the imports root become manuals.
   * Existing rows are never overwritten, so user edits to name/description/archive survive.
   */
  async syncLegacyWorkspaces(locale: ApiLocale = 'zh-CN'): Promise<void> {
    const candidates: Array<{ rootDir: string; name: string; lastOpenedAt: number; builtin?: boolean }> =
      [];

    if (existsSync(this.defaultRootDir)) {
      candidates.push({
        rootDir: path.resolve(this.defaultRootDir),
        name: path.basename(this.defaultRootDir),
        lastOpenedAt: 0,
        builtin: true,
      });
    }

    const entries = await this.registryWorkspace.listRegistryEntries().catch(() => []);
    const hidden = new Set<string>();
    for (const entry of entries) {
      const real = await realpath(entry.path).catch(() => entry.path);
      if (entry.hidden) {
        hidden.add(entry.path);
        hidden.add(real);
        continue;
      }
      if (!existsSync(entry.path)) continue;
      candidates.push({
        rootDir: path.resolve(entry.path),
        name: entry.name || path.basename(entry.path),
        lastOpenedAt: entry.lastOpenedAt,
        builtin: real === this.defaultRootDir,
      });
    }

    try {
      const dirents = await readdir(this.importsRootDir, { withFileTypes: true });
      for (const dirent of dirents) {
        if (!dirent.isDirectory() || dirent.name.startsWith('.') || dirent.name === 'publish') {
          continue;
        }
        const candidate = path.join(this.importsRootDir, dirent.name);
        const real = await realpath(candidate).catch(() => candidate);
        if (hidden.has(real) || hidden.has(candidate)) continue;
        candidates.push({ rootDir: candidate, name: dirent.name, lastOpenedAt: 0 });
      }
    } catch {
      // The imports root may not exist yet on a fresh install.
    }

    for (const candidate of candidates) {
      await this.registerDirectory(candidate.rootDir, {
        name: candidate.name,
        lastOpenedAt: candidate.lastOpenedAt,
        isBuiltin: candidate.builtin === true,
        locale,
      });
    }
  }

  /**
   * Inserts the manual when the directory is unknown, otherwise refreshes bookkeeping only.
   * Used by the legacy workspace endpoints so old clients keep working after the upgrade.
   */
  async registerDirectory(
    rootDir: string,
    options: {
      name?: string;
      description?: string;
      lastOpenedAt?: number;
      isBuiltin?: boolean;
      createdBy?: string;
      locale?: ApiLocale;
    } = {},
  ): Promise<ManualView> {
    const resolvedRootDir = path.resolve(rootDir);
    const real = await realpath(resolvedRootDir).catch(() => resolvedRootDir);
    // Identity comes from the real path (stable across symlinks); the stored path keeps the
    // spelling the caller used so API responses stay byte-for-byte comparable.
    const id = repositoryIdFor(real);
    const existing = await this.db.select().from(manuals).where(eq(manuals.id, id)).limit(1);
    const timestamp = Date.now();
    if (existing.length > 0) {
      const row = existing[0]!;
      await this.db
        .update(manuals)
        .set({ lastOpenedAt: options.lastOpenedAt ?? timestamp, updatedAt: row.updatedAt })
        .where(eq(manuals.id, id));
      return this.toView({ ...row, lastOpenedAt: options.lastOpenedAt ?? timestamp });
    }

    const row: ManualRow = {
      id,
      name: options.name?.trim() || (await this.suggestName(resolvedRootDir)),
      description: options.description ?? '',
      rootDir: resolvedRootDir,
      defaultRootMap: null,
      isBuiltin: options.isBuiltin ? 1 : 0,
      archived: 0,
      createdBy: options.createdBy ?? DEFAULT_MANUAL_CREATOR,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: options.lastOpenedAt ?? timestamp,
    };
    await this.db.insert(manuals).values(row);
    return this.toView(row);
  }

  async list(options: {
    userId?: string;
    includeArchived?: boolean;
    query?: string;
  } = {}): Promise<ManualListSnapshot> {
    const filters: SQL[] = [];
    if (!options.includeArchived) filters.push(eq(manuals.archived, 0));
    const query = options.query?.trim();
    if (query) {
      const pattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
      const clause = or(
        like(manuals.name, pattern),
        like(manuals.description, pattern),
        like(manuals.rootDir, pattern),
      );
      if (clause) filters.push(clause);
    }

    const rows = await this.db
      .select()
      .from(manuals)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(manuals.archived, desc(manuals.lastOpenedAt), manuals.name);

    const counts = await this.assignmentCounts(
      rows.map((row) => row.id),
      options.userId,
    );

    const views: ManualView[] = [];
    for (const row of rows) {
      views.push(await this.toView(row, counts));
    }
    return {
      defaultRootDir: this.defaultRootDir,
      importsRootDir: this.importsRootDir,
      manuals: views,
    };
  }

  async get(id: string): Promise<ManualView> {
    const row = await this.requireRow(id);
    return this.toView(row);
  }

  async requireRow(id: string): Promise<ManualRow> {
    const rows = await this.db.select().from(manuals).where(eq(manuals.id, id)).limit(1);
    if (rows.length === 0) throw httpError(404, 'manuals.notFound', { id });
    return rows[0]!;
  }

  async create(input: ManualCreateInput, user: IdentityUser, locale: ApiLocale): Promise<ManualView> {
    if (user.role === 'viewer') throw httpError(403, 'manuals.viewerCannotManage');

    let snapshotRoot: string;
    let displayName: string;

    if (input.mode === 'attach') {
      const target = input.rootDir?.trim();
      if (!target) throw httpError(400, 'manuals.rootDirMissing', { path: '' });
      const resolved = path.resolve(target);
      const dirStat = await stat(resolved).catch(() => null);
      if (!dirStat?.isDirectory()) {
        throw httpError(404, 'manuals.rootDirMissing', { path: resolved });
      }
      const real = await realpath(resolved);
      const already = await this.db
        .select()
        .from(manuals)
        .where(eq(manuals.id, repositoryIdFor(real)))
        .limit(1);
      if (already.length > 0) {
        await this.touch(already[0]!.id);
        return this.toView({ ...already[0]!, lastOpenedAt: Date.now() });
      }
      snapshotRoot = resolved;
      displayName = input.name?.trim() || (await this.suggestName(resolved));
      await this.creationManager.recordWorkspace(resolved, displayName);
    } else if (input.mode === 'import') {
      displayName = input.name?.trim() || '';
      if (!displayName) throw httpError(400, 'manuals.nameRequired');
      if (!input.files || input.files.length === 0) throw httpError(400, 'manuals.createFailed');
      const snapshot = await this.creationManager.importBatchFiles(displayName, input.files);
      snapshotRoot = snapshot.rootDir;
    } else {
      displayName = input.name?.trim() || '';
      if (!displayName) throw httpError(400, 'manuals.nameRequired');
      const snapshot = await this.creationManager.createWorkspace({
        name: displayName,
        parentDir: input.parentDir?.trim() || this.importsRootDir,
        scaffold: input.scaffold ?? 'starter',
        locale,
      });
      snapshotRoot = snapshot.rootDir;
    }

    if (input.initGit) {
      await this.git.ensureInitialized(snapshotRoot).catch(() => undefined);
    }

    const view = await this.registerDirectory(snapshotRoot, {
      name: displayName,
      description: input.description?.trim() || '',
      createdBy: user.id,
      locale,
    });
    return view;
  }

  async update(
    id: string,
    patch: ManualUpdateInput,
    user: IdentityUser,
  ): Promise<ManualView> {
    const row = await this.requireRow(id);
    if (user.role === 'viewer') throw httpError(403, 'manuals.viewerCannotManage');
    if (typeof patch.archived === 'boolean' && row.isBuiltin !== 1) {
      if (user.role !== 'admin' && user.id !== row.createdBy) {
        throw httpError(403, 'manuals.adminOrCreatorOnly');
      }
    }
    if (typeof patch.archived === 'boolean' && row.isBuiltin === 1 && patch.archived) {
      throw httpError(403, 'manuals.builtinNotRemovable');
    }

    const nextName = patch.name?.trim();
    if (nextName !== undefined && nextName.length === 0) {
      throw httpError(400, 'manuals.nameRequired');
    }

    await this.db
      .update(manuals)
      .set({
        name: nextName ?? row.name,
        description: patch.description?.trim() ?? row.description,
        defaultRootMap:
          patch.defaultRootMap === undefined ? row.defaultRootMap : patch.defaultRootMap,
        archived:
          typeof patch.archived === 'boolean' ? (patch.archived ? 1 : 0) : row.archived,
        updatedAt: Date.now(),
      })
      .where(eq(manuals.id, id));

    return this.get(id);
  }

  async touch(id: string): Promise<ManualView> {
    const row = await this.requireRow(id);
    const timestamp = Date.now();
    await this.db
      .update(manuals)
      .set({ lastOpenedAt: timestamp })
      .where(eq(manuals.id, id));
    return this.toView({ ...row, lastOpenedAt: timestamp });
  }

  /** Removes the manual from the workbench; the folder and its Git repository are untouched. */
  async remove(id: string, user: IdentityUser): Promise<void> {
    const row = await this.requireRow(id);
    if (user.role === 'viewer') throw httpError(403, 'manuals.viewerCannotManage');
    if (row.isBuiltin === 1) throw httpError(403, 'manuals.builtinNotRemovable');
    if (user.role !== 'admin' && user.id !== row.createdBy) {
      throw httpError(403, 'manuals.adminOrCreatorOnly');
    }

    await this.db.delete(topicAssignments).where(eq(topicAssignments.manualId, id));
    await this.db.delete(manuals).where(eq(manuals.id, id));
    this.statsCache.delete(row.rootDir);
    await this.registryWorkspace.hideWorkspaceDir(row.rootDir);
  }

  /** Most recently opened non-archived manual — the header-less fallback for legacy clients. */
  async findMostRecent(): Promise<ManualRow | null> {
    const rows = await this.db
      .select()
      .from(manuals)
      .where(eq(manuals.archived, 0))
      .orderBy(desc(manuals.lastOpenedAt), desc(manuals.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  }

  private async suggestName(realRoot: string): Promise<string> {
    const base = path.basename(realRoot);
    return base || 'manual';
  }

  private async assignmentCounts(
    manualIds: readonly string[],
    userId?: string,
  ): Promise<Map<string, { active: number; mine: number }>> {
    const result = new Map<string, { active: number; mine: number }>();
    if (manualIds.length === 0) return result;
    for (const id of manualIds) result.set(id, { active: 0, mine: 0 });

    const activeRows = await this.db
      .select({ manualId: topicAssignments.manualId, total: count() })
      .from(topicAssignments)
      .where(
        and(
          inArray(topicAssignments.manualId, [...manualIds]),
          inArray(topicAssignments.status, ['pending', 'in_progress']),
        ),
      )
      .groupBy(topicAssignments.manualId);
    for (const row of activeRows) {
      const entry = result.get(row.manualId);
      if (entry) entry.active = Number(row.total);
    }

    if (userId) {
      const mineRows = await this.db
        .select({ manualId: topicAssignments.manualId, total: count() })
        .from(topicAssignments)
        .where(
          and(
            inArray(topicAssignments.manualId, [...manualIds]),
            eq(topicAssignments.assigneeId, userId),
            inArray(topicAssignments.status, ['pending', 'in_progress']),
          ),
        )
        .groupBy(topicAssignments.manualId);
      for (const row of mineRows) {
        const entry = result.get(row.manualId);
        if (entry) entry.mine = Number(row.total);
      }
    }

    return result;
  }

  private async statsFor(rootDir: string, exists: boolean): Promise<ManualStats> {
    if (!exists) return { totalTopics: 0, totalMaps: 0 };
    const cached = this.statsCache.get(rootDir);
    if (cached && Date.now() - cached.at < STATS_CACHE_TTL_MS) return cached.stats;
    const stats = await countManualFiles(rootDir);
    this.statsCache.set(rootDir, { at: Date.now(), stats });
    return stats;
  }

  private async toView(
    row: ManualRow,
    counts?: Map<string, { active: number; mine: number }>,
  ): Promise<ManualView> {
    const exists = existsSync(row.rootDir);
    const branch = exists ? await this.git.currentBranch(row.rootDir) : gitFallbackBranch();
    const stats = await this.statsFor(row.rootDir, exists);
    const counters = counts?.get(row.id);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      rootDir: row.rootDir,
      defaultRootMap: row.defaultRootMap,
      isBuiltin: row.isBuiltin === 1,
      archived: row.archived === 1,
      exists,
      currentBranch: branch,
      stats,
      activeAssignmentCount: counters?.active ?? 0,
      myActiveAssignmentCount: counters?.mine ?? 0,
      createdBy: row.createdBy,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      lastOpenedAt: nowIso(row.lastOpenedAt),
    };
  }
}

function gitFallbackBranch(): string {
  return 'main';
}

/** i18n-aware helper used by the route layer when a manual folder disappeared. */
export function manualMissingMessage(locale: ApiLocale, rootDir: string): string {
  return apiT(locale, 'manuals.rootDirMissing', { path: rootDir });
}
