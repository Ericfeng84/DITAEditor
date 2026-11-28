import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, count, desc, eq, inArray, like, or, type SQL } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { manuals, repositories, topicAssignments, type ManualRow } from '../../db/schema.js';
import type { ApiLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';
import { httpError } from '../errors.js';
import { repositoryIdFor, validateBranchName, type GitManager } from '../git/git-manager.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { normalizeLangTag } from '../translation/types.js';
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
  /** Phase 13: branches whose shared baseline cannot be rewritten/merged into without admin. */
  protectedBranches: string[];
  /**
   * Phase 16: the language this manual is authored in. `null` until a translation link fixes it
   * or the root map / first topic `xml:lang` is inferred lazily.
   */
  sourceLang: string | null;
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
  /** Phase 16: authored language for a newly created/imported manual. */
  sourceLang?: string | null;
}

export interface ManualUpdateInput {
  name?: string;
  description?: string;
  defaultRootMap?: string | null;
  archived?: boolean;
  /** Phase 13: admin-only branch protection policy; `[]` means nothing is protected. */
  protectedBranches?: string[];
  /** Phase 16: explicit authored language; `null` clears it so it can be re-inferred. */
  sourceLang?: string | null;
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
const MANUAL_ID_MARKER_FILE = 'ditaeditor-id';
const MANUAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DEFAULT_PROTECTED_BRANCHES = ['main'];

/**
 * Phase 13: the manual identity is persisted inside `.git/` (never in the working tree, so it
 * can never show up in a diff) and survives moving/renaming the manual folder or its worktrees.
 */
export function manualIdMarkerPath(rootDir: string): string {
  return path.join(rootDir, '.git', MANUAL_ID_MARKER_FILE);
}

async function gitDirectoryFor(rootDir: string): Promise<string | null> {
  try {
    const info = await stat(path.join(rootDir, '.git'));
    // Worktrees and submodules use a `.git` *file*; only real repos can carry the marker.
    return info.isDirectory() ? path.join(rootDir, '.git') : null;
  } catch {
    return null;
  }
}

export async function readManualIdMarker(rootDir: string): Promise<string | null> {
  const gitDir = await gitDirectoryFor(rootDir);
  if (!gitDir) return null;
  try {
    const raw = await readFile(path.join(gitDir, MANUAL_ID_MARKER_FILE), 'utf8');
    const id = raw.trim();
    return MANUAL_ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Best-effort: writing the marker must never fail registration of an otherwise valid manual. */
export async function writeManualIdMarker(rootDir: string, id: string): Promise<boolean> {
  if (!MANUAL_ID_PATTERN.test(id)) return false;
  const gitDir = await gitDirectoryFor(rootDir);
  if (!gitDir) return false;
  try {
    await writeFile(path.join(gitDir, MANUAL_ID_MARKER_FILE), `${id}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function normalizeProtectedBranches(branches: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of branches) {
    const branch = raw.trim();
    if (branch) seen.add(validateBranchName(branch));
  }
  return [...seen];
}

export function parseProtectedBranches(raw: string | null | undefined): string[] {
  if (!raw) return [...DEFAULT_PROTECTED_BRANCHES];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PROTECTED_BRANCHES];
    return normalizeProtectedBranches(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return [...DEFAULT_PROTECTED_BRANCHES];
  }
}

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
      else if (lower.endsWith('.ditamap')) stats.totalMaps += 1;
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
   *
   * Phase 13: identity is resolved marker-first (`.git/ditaeditor-id`), so a manual keeps its id
   * when its folder is moved or renamed. Legacy rows registered by path/`repositoryIdFor(real)`
   * are recovered in place and get their marker backfilled on the next successful lookup.
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
      /** Phase 13: id chosen at creation time (fresh UUID) instead of the legacy path hash. */
      manualId?: string;
      /** Phase 16: authored language recorded on insert. */
      sourceLang?: string | null;
    } = {},
  ): Promise<ManualView> {
    const resolvedRootDir = path.resolve(rootDir);
    const real = await realpath(resolvedRootDir).catch(() => resolvedRootDir);
    const timestamp = Date.now();
    const markerId = await readManualIdMarker(real);

    if (markerId) {
      const byMarker = await this.rowById(markerId);
      if (byMarker) {
        return this.recoverManual(byMarker, resolvedRootDir, options, timestamp);
      }
      const legacyRow = await this.rowById(repositoryIdFor(real));
      if (legacyRow) {
        await writeManualIdMarker(real, legacyRow.id);
        return this.recoverManual(legacyRow, resolvedRootDir, options, timestamp);
      }
      return this.insertManual(markerId, resolvedRootDir, options, timestamp);
    }

    const existing =
      (await this.rowById(repositoryIdFor(real))) ??
      (await this.rowByRootDir(resolvedRootDir, real));
    if (existing) {
      await writeManualIdMarker(real, existing.id);
      return this.recoverManual(existing, resolvedRootDir, options, timestamp);
    }

    const id = options.manualId ?? repositoryIdFor(real);
    const clash = await this.rowById(id);
    if (clash) {
      await writeManualIdMarker(real, clash.id);
      return this.recoverManual(clash, resolvedRootDir, options, timestamp);
    }
    await writeManualIdMarker(real, id);
    return this.insertManual(id, resolvedRootDir, options, timestamp);
  }

  private async rowById(id: string): Promise<ManualRow | null> {
    const rows = await this.db.select().from(manuals).where(eq(manuals.id, id)).limit(1);
    return rows[0] ?? null;
  }

  private async rowByRootDir(resolvedRootDir: string, real: string): Promise<ManualRow | null> {
    const rows = await this.db
      .select()
      .from(manuals)
      .where(or(eq(manuals.rootDir, resolvedRootDir), eq(manuals.rootDir, real)))
      .limit(1);
    return rows[0] ?? null;
  }

  private async recoverManual(
    row: ManualRow,
    resolvedRootDir: string,
    options: { lastOpenedAt?: number },
    timestamp: number,
  ): Promise<ManualView> {
    const lastOpenedAt = options.lastOpenedAt ?? timestamp;
    const moved = row.rootDir !== resolvedRootDir;
    await this.db
      .update(manuals)
      .set(moved ? { rootDir: resolvedRootDir, lastOpenedAt } : { lastOpenedAt })
      .where(eq(manuals.id, row.id));
    if (moved) {
      this.statsCache.delete(row.rootDir);
      await this.syncRepositoryRootDir(row.id, resolvedRootDir);
    }
    return this.toView({ ...row, rootDir: resolvedRootDir, lastOpenedAt });
  }

  /** Keeps the legacy `repositories` row aligned so old endpoints resolve the same folder. */
  private async syncRepositoryRootDir(id: string, rootDir: string): Promise<void> {
    try {
      const rows = await this.db
        .select()
        .from(repositories)
        .where(eq(repositories.id, id))
        .limit(1);
      const row = rows[0];
      if (!row || row.rootDir === rootDir) return;
      await this.db.update(repositories).set({ rootDir }).where(eq(repositories.id, id));
    } catch {
      // Another repository row may already own the path; the manual itself is still correct.
    }
  }

  private async insertManual(
    id: string,
    resolvedRootDir: string,
    options: {
      name?: string;
      description?: string;
      lastOpenedAt?: number;
      isBuiltin?: boolean;
      createdBy?: string;
      sourceLang?: string | null;
    },
    timestamp: number,
  ): Promise<ManualView> {
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
      protectedBranchesJson: JSON.stringify(DEFAULT_PROTECTED_BRANCHES),
      sourceLang: options.sourceLang ?? null,
    };
    await this.db.insert(manuals).values(row);
    return this.toView(row);
  }

  /** Phase 13: branch protection policy for a manual (defaults to `["main"]`). */
  getProtectedBranches(manualId: string): string[] {
    const row = this.db.select().from(manuals).where(eq(manuals.id, manualId)).get();
    return parseProtectedBranches(row?.protectedBranchesJson);
  }

  isBranchProtected(manualId: string, branch: string): boolean {
    return this.getProtectedBranches(manualId).includes(branch);
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

    // Phase 13: create/import get a fresh path-independent id; attach keeps whatever the
    // repository already carries (marker) or falls back to the legacy path hash.
    const manualId = input.mode === 'attach' ? undefined : randomUUID();
    if (manualId && this.git.isRepository(snapshotRoot)) {
      await writeManualIdMarker(snapshotRoot, manualId);
    }

    const view = await this.registerDirectory(snapshotRoot, {
      name: displayName,
      description: input.description?.trim() || '',
      createdBy: user.id,
      locale,
      ...(manualId ? { manualId } : {}),
      ...(input.sourceLang === undefined ? {} : { sourceLang: input.sourceLang }),
    });
    // An attached manual already has a row; record the requested language explicitly.
    if (input.sourceLang !== undefined && view.sourceLang !== input.sourceLang) {
      await this.setSourceLang(view.id, input.sourceLang);
      return this.get(view.id);
    }
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

    let protectedBranchesJson = row.protectedBranchesJson ?? null;
    if (patch.protectedBranches !== undefined) {
      if (user.role !== 'admin') throw httpError(403, 'manuals.adminOrCreatorOnly');
      protectedBranchesJson = JSON.stringify(normalizeProtectedBranches(patch.protectedBranches));
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
        ...(protectedBranchesJson === null ? {} : { protectedBranchesJson }),
        ...(patch.sourceLang === undefined
          ? {}
          : { sourceLang: normalizeLangTag(patch.sourceLang) }),
        updatedAt: Date.now(),
      })
      .where(eq(manuals.id, id));

    return this.get(id);
  }

  /** Phase 16: current authored language, or `null` when it was never recorded. */
  getSourceLang(manualId: string): string | null {
    const row = this.db.select().from(manuals).where(eq(manuals.id, manualId)).get();
    return row?.sourceLang ?? null;
  }

  /** Phase 16: persists the authored language (`null` clears it). */
  async setSourceLang(manualId: string, sourceLang: string | null): Promise<string | null> {
    const normalized = normalizeLangTag(sourceLang);
    await this.db
      .update(manuals)
      .set({ sourceLang: normalized, updatedAt: Date.now() })
      .where(eq(manuals.id, manualId));
    return normalized;
  }

  /**
   * Phase 16 lazy inference: keep the recorded language when present, otherwise read the root
   * map's (or first topic's) `xml:lang`, persist it and return it. A manual whose content never
   * declares a language stays `null` — guessing `en` would silently mistranslate.
   */
  async ensureSourceLang(manualId: string): Promise<string | null> {
    const row = await this.requireRow(manualId).catch(() => null);
    if (!row) return null;
    const existing = normalizeLangTag(row.sourceLang ?? null);
    if (existing) return existing;
    const inferred = await inferSourceLangFromDirectory(row.rootDir, row.defaultRootMap);
    if (!inferred) return null;
    await this.db
      .update(manuals)
      .set({ sourceLang: inferred, updatedAt: Date.now() })
      .where(eq(manuals.id, manualId));
    return inferred;
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
      protectedBranches: parseProtectedBranches(row.protectedBranchesJson),
      sourceLang: row.sourceLang ?? null,
    };
  }
}

function gitFallbackBranch(): string {
  return 'main';
}

/** Directories that never carry authored DITA content (same skip list as the Phase 16 scan). */
const IGNORED_DIRS = new Set([
  '.git',
  '.ditaeditor',
  'node_modules',
  'dist',
  'out',
  'build',
  '.turbo',
  '.cache',
]);

/** Root element `xml:lang` of one XML file, or `null` when absent/unreadable. */
async function readXmllangAt(filePath: string): Promise<string | null> {
  const text = await readFile(filePath, 'utf8').catch(() => null);
  if (!text) return null;
  const match = /<([A-Za-z_][\w.:-]*)([^<>]*?)\sxml:lang\s*=\s*(["'])([^"']+)\3/.exec(text);
  return match ? normalizeLangTag(match[4]) : null;
}

/** Depth-limited search for the first file whose extension is in `extensions`. */
async function findFirstFileByExtension(
  rootDir: string,
  extensions: readonly string[],
  maxDepth = 4,
): Promise<string | null> {
  const walk = async (dir: string, depth: number): Promise<string | null> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
    if (!entries) return null;
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of sorted) {
      if (entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        return path.join(dir, entry.name);
      }
    }
    if (depth >= maxDepth) return null;
    for (const entry of sorted) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      const found = await walk(path.join(dir, entry.name), depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(rootDir, 0);
}

/**
 * Phase 16 lazy language inference: the root map wins, then any root-level map, then the first
 * topic. Reading content is the only truthful source — a manual that declares no `xml:lang`
 * stays `null` instead of being assumed English.
 */
export async function inferSourceLangFromDirectory(
  rootDir: string,
  defaultRootMap?: string | null,
): Promise<string | null> {
  const rootStat = await stat(rootDir).catch(() => null);
  if (!rootStat?.isDirectory()) return null;

  const mapCandidates: string[] = [];
  if (defaultRootMap?.trim()) mapCandidates.push(defaultRootMap.trim());
  const rootEntries = await readdir(rootDir, { withFileTypes: true }).catch(() => []);
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.ditamap')) {
      mapCandidates.push(entry.name);
      continue;
    }
    if (
      entry.isFile() &&
      (entry.name.toLowerCase().endsWith('.dita') || entry.name.toLowerCase().endsWith('.xml'))
    ) {
      mapCandidates.push(entry.name);
    }
  }

  for (const candidate of mapCandidates) {
    const lang = await readXmllangAt(path.join(rootDir, candidate));
    if (lang) return lang;
  }

  const topic = await findFirstFileByExtension(rootDir, ['.dita']);
  if (topic) return await readXmllangAt(topic);
  return null;
}

/** i18n-aware helper used by the route layer when a manual folder disappeared. */
export function manualMissingMessage(locale: ApiLocale, rootDir: string): string {
  return apiT(locale, 'manuals.rootDirMissing', { path: rootDir });
}
