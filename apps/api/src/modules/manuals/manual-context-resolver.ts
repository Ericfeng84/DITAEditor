import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyRequest } from 'fastify';
import type { ManualRow } from '../../db/schema.js';
import { httpError } from '../errors.js';
import { repositoryIdFor } from '../git/git-manager.js';
import type { GitManager } from '../git/git-manager.js';
import { WorkspaceManager } from '../files/workspace-fs.js';
import { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';
import type { ManualRegistryService } from './manual-registry-service.js';

/** Max number of live `(manual, workDir)` sessions kept in memory (see ADR-0002). */
export const MAX_CACHED_SESSIONS = 16;

/**
 * One resolved manual + branch working context. Each session owns an isolated
 * `WorkspaceManager` view and semantic index, so two manuals (or two branches of the same
 * manual) can never leak file paths, locks or keyspace into each other.
 */
export interface ManualSession {
  manualId: string;
  manual: ManualRow;
  projectRootDir: string;
  workDir: string;
  branch: string;
  isPrimaryBranch: boolean;
  workspace: WorkspaceManager;
  indexer: WorkspaceSemanticIndexer;
}

export interface ManualContextResolverOptions {
  registry: ManualRegistryService;
  git: GitManager;
  importsRootDir: string;
  registryPath: string;
  /** Bound once at startup so header-less legacy clients resolve to the sample manual. */
  defaultRootDir: string;
}

function firstHeader(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function firstQuery(request: FastifyRequest, name: string): string | undefined {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Resolves the request's manual + branch from `x-dita-manual-id` / `x-dita-branch` headers
 * (or `?manualId=` / `?branch=`) and caches workspace sessions with an LRU cap.
 *
 * Header-less requests fall back to the most recently activated manual and the last branch
 * used for that manual, which keeps the pre-Phase-10 single-workspace clients working.
 */
export class ManualContextResolver {
  private readonly registry: ManualRegistryService;
  private readonly git: GitManager;
  private readonly importsRootDir: string;
  private readonly registryPath: string;
  private readonly defaultRootDir: string;
  private readonly sessions = new Map<string, ManualSession>();
  private readonly defaultBranchByManual = new Map<string, string>();
  private activeManualId: string | null = null;

  constructor(options: ManualContextResolverOptions) {
    this.registry = options.registry;
    this.git = options.git;
    this.importsRootDir = path.resolve(options.importsRootDir);
    this.registryPath = path.resolve(options.registryPath);
    this.defaultRootDir = path.resolve(options.defaultRootDir);
  }

  /** Reads the manual/branch from a request, no side effects other than session creation. */
  /**
   * Explicit per-request manual/branch hints (headers or query), without falling back to
   * the most recently opened manual. The workbench hub uses this to keep its cross-manual
   * "My assignments" list from being narrowed to whatever manual was opened last.
   */
  readExplicit(request: FastifyRequest): { manualId?: string; branch?: string } {
    return {
      manualId: firstHeader(request, 'x-dita-manual-id') ?? firstQuery(request, 'manualId'),
      branch: firstHeader(request, 'x-dita-branch') ?? firstQuery(request, 'branch'),
    };
  }

  async resolveRequest(request: FastifyRequest): Promise<ManualSession> {
    const manualId =
      firstHeader(request, 'x-dita-manual-id') ?? firstQuery(request, 'manualId');
    const branch = firstHeader(request, 'x-dita-branch') ?? firstQuery(request, 'branch');
    return this.resolve(manualId, branch);
  }

  async resolve(manualId?: string | null, branch?: string | null): Promise<ManualSession> {
    const manual = manualId
      ? await this.registry.requireRow(manualId)
      : await this.requireActiveManual();

    const projectRootDir = path.resolve(manual.rootDir);
    const rootStat = await stat(projectRootDir).catch(() => null);
    if (!rootStat?.isDirectory()) {
      throw httpError(404, 'manuals.rootDirMissing', { path: manual.rootDir });
    }

    const fallbackBranch =
      this.defaultBranchByManual.get(manual.id) ?? (await this.git.currentBranch(projectRootDir));
    const targetBranch = (branch ?? fallbackBranch).trim() || fallbackBranch;

    const workDir = await this.resolveWorkDir(projectRootDir, targetBranch);
    const cacheKey = `${manual.id}::${workDir}`;

    // Re-insert to keep the Map ordered as an LRU (oldest first).
    const cached = this.sessions.get(cacheKey);
    if (cached) {
      this.sessions.delete(cacheKey);
      this.sessions.set(cacheKey, cached);
      this.defaultBranchByManual.set(manual.id, targetBranch);
      return cached;
    }

    const session = await this.createSession(manual, projectRootDir, workDir, targetBranch);
    this.sessions.set(cacheKey, session);
    this.defaultBranchByManual.set(manual.id, targetBranch);
    this.evictIfNeeded();
    return session;
  }

  /** Marks the manual that header-less requests should resolve to (legacy compatibility). */
  setActiveManual(manualId: string): void {
    this.activeManualId = manualId;
  }

  getActiveManualId(): string | null {
    return this.activeManualId;
  }

  /** Remembers the branch chosen by `POST /api/git/switch-branch` for header-less clients. */
  setDefaultBranch(manualId: string, branch: string): void {
    this.defaultBranchByManual.set(manualId, branch);
  }

  getDefaultBranch(manualId: string): string | null {
    return this.defaultBranchByManual.get(manualId) ?? null;
  }

  /** Drops every cached session of a manual (after removal, rename or archive). */
  invalidateManual(manualId: string): void {
    for (const [key, session] of this.sessions) {
      if (session.manualId === manualId) this.sessions.delete(key);
    }
    this.defaultBranchByManual.delete(manualId);
    if (this.activeManualId === manualId) this.activeManualId = null;
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  private async requireActiveManual(): Promise<ManualRow> {
    if (this.activeManualId) {
      try {
        return await this.registry.requireRow(this.activeManualId);
      } catch {
        this.activeManualId = null;
      }
    }
    const recent = await this.registry.findMostRecent();
    if (recent) {
      this.activeManualId = recent.id;
      return recent;
    }
    throw httpError(404, 'manuals.notFound', { id: this.defaultRootDir });
  }

  private async resolveWorkDir(projectRootDir: string, branch: string): Promise<string> {
    if (!this.git.isRepository(projectRootDir)) {
      // A manual without a repository has exactly one working directory.
      return projectRootDir;
    }
    // `ensureWorktree` returns the project root itself for the primary branch, so its
    // spelling (not a realpath) is what every response echoes back.
    return this.git.ensureWorktree(projectRootDir, branch);
  }

  private async createSession(
    manual: ManualRow,
    projectRootDir: string,
    workDir: string,
    branch: string,
  ): Promise<ManualSession> {
    const workspace = new WorkspaceManager({
      workspaceDir: projectRootDir,
      importsRootDir: this.importsRootDir,
      registryPath: this.registryPath,
    });
    await workspace.bindRootDir(workDir, projectRootDir);
    const indexer = new WorkspaceSemanticIndexer(workspace);
    workspace.setMutationCallbacks({
      onFileWritten: (posixPath, content) => indexer.onFileWritten(posixPath, content),
      onAssetAdded: (posixPath) => indexer.onAssetAdded(posixPath),
      onFileDeleted: (posixPath) => indexer.onFileDeleted(posixPath),
      onFileRenamed: (fromPath, toPath) => indexer.onFileRenamed(fromPath, toPath),
      onWorkspaceChanged: (newRootDir) => indexer.onWorkspaceChanged(newRootDir),
    });

    return {
      manualId: manual.id,
      manual,
      projectRootDir,
      workDir,
      branch,
      isPrimaryBranch: workDir === projectRootDir,
      workspace,
      indexer,
    };
  }

  private evictIfNeeded(): void {
    while (this.sessions.size > MAX_CACHED_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey === undefined) return;
      this.sessions.delete(oldestKey);
    }
  }
}

/** Convenience: a manual id is the same identifier locks, publish jobs and AI audits use. */
export function manualIdForRoot(rootDir: string): string {
  return repositoryIdFor(rootDir);
}
