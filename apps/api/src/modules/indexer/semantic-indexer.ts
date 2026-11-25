import { promises as fs, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  classifyDitaFileKind,
  DitaSemanticIndex,
  normalizePosixPath,
  parseDitaval,
  type DitaProfilingAttrName,
  type DocumentSemanticOverlay,
  type KeyspaceResult,
  type ParsedDitaval,
  type ResolvedConrefResult,
  type SemanticDiagnostic,
  type TopicIdIndexEntry,
  type XmlParseError,
} from '@dita/core';
import type {
  WorkspaceDitavalSummary,
  WorkspaceFileNode,
  WorkspaceManager,
} from '../files/workspace-fs.js';
import type { DraftService } from '../locks/draft-service.js';

interface BranchIndexState {
  rootDir: string;
  branch: string;
  index: DitaSemanticIndex;
  assetPaths: Set<string>;
  ditavals: Map<string, WorkspaceDitavalSummary>;
  initialized: boolean;
  indexedAt: number;
  /**
   * Phase 13: monotonically increasing revision of the shared baseline (Git `HEAD`-clean
   * worktree). Personal draft overlays are cached against it so a check-in, revert or merge
   * invalidates every derived overlay index without touching the baseline one.
   */
  baselineRev: number;
}

/** Optional Phase 13 personal draft overlay wiring for the semantic indexer. */
export interface SemanticOverlayOptions {
  /** Personal draft overlay (`working_drafts`) merged on top of the clean baseline. */
  drafts?: DraftService;
  /** Project (manual) id the drafts belong to; equals the session's `manualId`. */
  projectId?: string;
}

interface OverlayCacheEntry {
  baselineRev: number;
  draftRev: number;
  state: BranchIndexState;
}

/** Paths that just moved from a draft overlay into the shared baseline (check-in). */
export interface BaselineRefreshInfo {
  writtenPaths?: string[];
  deletedPaths?: string[];
  renames?: { from: string; to: string }[];
}

export interface SemanticContextResponse {
  branch: string;
  rootMapPath: string | null;
  ditavalPath: string | null;
  keyspace: KeyspaceResult | null;
  topicIndices: TopicIdIndexEntry[];
  profilingCatalog: Record<DitaProfilingAttrName, string[]>;
  ditavals: WorkspaceDitavalSummary[];
  activeDitaval: ParsedDitaval | null;
  ditavalError?: XmlParseError;
  indexedAt: number;
}

function realpathSyncOrNull(dir: string): string {
  try {
    return realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

function summarizeDitaval(posixPath: string, content: string): WorkspaceDitavalSummary {
  const name = path.posix.basename(posixPath);
  try {
    const parsed = parseDitaval(content);
    return {
      path: posixPath,
      name,
      ruleCount: parsed.rules.length,
    };
  } catch (err) {
    return {
      path: posixPath,
      name,
      ruleCount: 0,
      parseError: {
        message: err instanceof Error ? err.message : String(err),
        line: 1,
        column: 1,
        offset: 0,
      },
    };
  }
}

function collectAllFilePaths(nodes: readonly WorkspaceFileNode[]): string[] {
  const out: string[] = [];
  const walk = (list: readonly WorkspaceFileNode[]) => {
    for (const node of list) {
      if (node.kind === 'directory') {
        if (node.children) walk(node.children);
      } else {
        out.push(node.path);
      }
    }
  };
  walk(nodes);
  return out;
}

/**
 * Branch-aware incremental semantic indexer for Fastify API.
 * Caches a `DitaSemanticIndex` per `(rootDir, branch)` and performs O(1) incremental
 * updates on file writes, creations, renames, and deletions.
 */
export class WorkspaceSemanticIndexer {
  private readonly branches = new Map<string, BranchIndexState>();
  /** Cached per-user overlay indexes, keyed by `branchKey::userId` (bounded). */
  private readonly overlayCache = new Map<string, OverlayCacheEntry>();
  private static readonly MAX_OVERLAY_CACHE_PER_BRANCH = 32;

  /**
   * `defaultBranch` is the branch this indexer instance is bound to (a manual session owns
   * exactly one worktree/branch). Every omitted `branch` argument falls back to it so that
   * mutations (`onFileWritten`, `onFileDeleted`, …) and reads (`collectDiagnostics`, …) always
   * address the same cached `BranchIndexState`. A mismatch there silently freezes diagnostics
   * (reads hit a state that no write ever updates).
   */
  constructor(
    private readonly workspace: WorkspaceManager,
    private readonly defaultBranch = 'default',
    private readonly overlayOptions: SemanticOverlayOptions = {},
  ) {}

  private makeBranchKey(rootDir: string, branch: string): string {
    return `${rootDir}::${branch}`;
  }

  private async getOrInitBranch(branch = this.defaultBranch): Promise<BranchIndexState> {
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const key = this.makeBranchKey(realRoot, branch);
    const existing = this.branches.get(key);
    if (existing?.initialized) {
      return existing;
    }

    const snapshot = await this.workspace.scanWorkspace();
    const index = new DitaSemanticIndex();
    const assetPaths = new Set<string>();
    const ditavals = new Map<string, WorkspaceDitavalSummary>();
    const xmlFiles: Record<string, string> = {};

    const allPaths = collectAllFilePaths(snapshot.files);
    for (const posixPath of allPaths) {
      const kind = classifyDitaFileKind(posixPath);
      if (kind === 'ditamap' || kind === 'bookmap' || kind === 'topic' || kind === 'ditaval') {
        const abs = path.join(snapshot.rootDir, ...posixPath.split('/'));
        try {
          const content = await fs.readFile(abs, 'utf8');
          xmlFiles[posixPath] = content;
          if (kind === 'ditaval') {
            ditavals.set(posixPath, summarizeDitaval(posixPath, content));
          }
        } catch {
          // Skip transient unreadable files
        }
      } else {
        assetPaths.add(posixPath);
      }
    }

    index.loadFiles(xmlFiles);

    const state: BranchIndexState = {
      rootDir: realRoot,
      branch,
      index,
      assetPaths,
      ditavals,
      initialized: true,
      indexedAt: Date.now(),
      baselineRev: 1,
    };
    this.branches.set(key, state);
    return state;
  }

  private getLoadedBranchesForActiveRoot(): BranchIndexState[] {
    const activeRoot = realpathSyncOrNull(this.workspace.getRootDir());
    const out: BranchIndexState[] = [];
    for (const st of this.branches.values()) {
      if (st.rootDir === activeRoot && st.initialized) {
        out.push(st);
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Phase 13 draft overlay
  // -------------------------------------------------------------------------

  private overlayKey(rootDir: string, branch: string, userId: string): string {
    return `${this.makeBranchKey(rootDir, branch)}::${userId}`;
  }

  private dropOverlayCache(rootDir: string, branch: string): void {
    const prefix = `${this.makeBranchKey(rootDir, branch)}::`;
    for (const key of Array.from(this.overlayCache.keys())) {
      if (key.startsWith(prefix)) this.overlayCache.delete(key);
    }
  }

  /** Bumps the baseline revision so cached personal overlays are rebuilt on next read. */
  bumpBaselineRev(branch = this.defaultBranch): void {
    const activeRoot = realpathSyncOrNull(this.workspace.getRootDir());
    for (const state of this.branches.values()) {
      if (state.rootDir !== activeRoot || state.branch !== branch) continue;
      state.baselineRev += 1;
      state.indexedAt = Date.now();
    }
    this.dropOverlayCache(activeRoot, branch);
  }

  /**
   * The state a caller actually reads: the clean baseline, or `Baseline + caller drafts`
   * when the indexer was constructed with a `DraftService`. Honors the "strict read/write
   * boundaries" rule — a read never materializes drafts or writes to the worktree.
   */
  private async getEffectiveState(
    branch = this.defaultBranch,
    userId?: string,
  ): Promise<BranchIndexState> {
    const baseline = await this.getOrInitBranch(branch);
    const drafts = this.overlayOptions.drafts;
    const projectId = this.overlayOptions.projectId;
    if (!drafts || !projectId || !userId) return baseline;

    const draftRev = drafts.getDraftRev(projectId, baseline.branch, userId);
    const key = this.overlayKey(baseline.rootDir, baseline.branch, userId);
    const cached = this.overlayCache.get(key);
    if (
      cached &&
      cached.baselineRev === baseline.baselineRev &&
      cached.draftRev === draftRev
    ) {
      this.overlayCache.delete(key);
      this.overlayCache.set(key, cached);
      return cached.state;
    }

    const rows = drafts.listUserDrafts(projectId, baseline.branch, userId);
    if (rows.length === 0) {
      this.overlayCache.delete(key);
      return baseline;
    }

    const index = baseline.index.cloneWithOverlay(
      drafts.toSemanticOverlayOps(projectId, baseline.branch, userId),
    );
    const assetPaths = new Set(baseline.assetPaths);
    const ditavals = new Map(baseline.ditavals);

    for (const row of rows) {
      if (row.op === 'delete') {
        assetPaths.delete(row.filePath);
        ditavals.delete(row.filePath);
        continue;
      }
      if (row.op === 'rename' && row.originalPath) {
        if (assetPaths.delete(row.originalPath)) assetPaths.add(row.filePath);
        const moved = ditavals.get(row.originalPath);
        if (moved) {
          ditavals.delete(row.originalPath);
          ditavals.set(row.filePath, {
            ...moved,
            path: row.filePath,
            name: path.posix.basename(row.filePath),
          });
        }
      }
      const kind = classifyDitaFileKind(row.filePath);
      if (kind === 'ditaval' && row.content !== null) {
        ditavals.set(row.filePath, summarizeDitaval(row.filePath, row.content));
      } else if (kind === 'image' || kind === 'other') {
        assetPaths.add(row.filePath);
      }
    }

    const state: BranchIndexState = {
      rootDir: baseline.rootDir,
      branch: baseline.branch,
      index,
      assetPaths,
      ditavals,
      initialized: true,
      indexedAt: Date.now(),
      baselineRev: baseline.baselineRev,
    };
    this.overlayCache.set(key, {
      baselineRev: baseline.baselineRev,
      draftRev,
      state,
    });
    this.trimOverlayCache(baseline.rootDir, baseline.branch);
    return state;
  }

  private trimOverlayCache(rootDir: string, branch: string): void {
    const prefix = `${this.makeBranchKey(rootDir, branch)}::`;
    const keys = Array.from(this.overlayCache.keys()).filter((key) => key.startsWith(prefix));
    while (keys.length > WorkspaceSemanticIndexer.MAX_OVERLAY_CACHE_PER_BRANCH) {
      const oldest = keys.shift();
      if (oldest === undefined) break;
      this.overlayCache.delete(oldest);
    }
  }

  /**
   * Re-syncs the baseline index after `workDir` advanced (check-in / revert / merge).
   * With explicit path info only those entries are re-read from disk; otherwise the whole
   * branch index is rebuilt, which is always correct because the worktree is clean at `HEAD`.
   */
  async refreshFromBaselineDisk(
    branch = this.defaultBranch,
    info?: BaselineRefreshInfo,
  ): Promise<void> {
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const key = this.makeBranchKey(realRoot, branch);
    const state = this.branches.get(key);
    if (!state?.initialized) return;

    const written = new Set(info?.writtenPaths ?? []);
    const deleted = new Set(info?.deletedPaths ?? []);
    for (const rename of info?.renames ?? []) {
      deleted.add(rename.from);
      written.add(rename.to);
    }

    const hasInfo = written.size > 0 || deleted.size > 0;
    if (!hasInfo) {
      this.branches.delete(key);
      await this.getOrInitBranch(branch);
      this.bumpBaselineRev(branch);
      return;
    }

    for (const posixPath of deleted) {
      await this.onFileDeleted(posixPath, branch);
    }
    for (const posixPath of written) {
      const abs = path.join(state.rootDir, ...normalizePosixPath(posixPath).split('/'));
      try {
        const content = await fs.readFile(abs, 'utf8');
        await this.onFileWritten(posixPath, content, branch);
      } catch {
        await this.onFileDeleted(posixPath, branch);
      }
    }
    this.bumpBaselineRev(branch);
  }

  /** Alias kept for callers that only know which paths changed. */
  async refreshBaselinePaths(
    branch = this.defaultBranch,
    info?: BaselineRefreshInfo,
  ): Promise<void> {
    await this.refreshFromBaselineDisk(branch, info);
  }

  async onFileWritten(
    posixPath: string,
    content: string,
    branch = this.defaultBranch,
  ): Promise<void> {
    const norm = normalizePosixPath(posixPath);
    if (!norm) return;
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const state = this.branches.get(this.makeBranchKey(realRoot, branch));
    if (!state?.initialized) return;

    const kind = classifyDitaFileKind(norm);
    if (kind === 'ditamap' || kind === 'bookmap' || kind === 'topic' || kind === 'ditaval') {
      state.index.updateFile(norm, content);
      if (kind === 'ditaval') {
        state.ditavals.set(norm, summarizeDitaval(norm, content));
      }
    } else {
      state.assetPaths.add(norm);
    }
    state.baselineRev += 1;
    state.indexedAt = Date.now();
  }

  async onAssetAdded(posixPath: string, branch = this.defaultBranch): Promise<void> {
    const norm = normalizePosixPath(posixPath);
    if (!norm) return;
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const state = this.branches.get(this.makeBranchKey(realRoot, branch));
    if (!state?.initialized) return;
    state.assetPaths.add(norm);
    state.baselineRev += 1;
    state.indexedAt = Date.now();
  }

  async onFileDeleted(posixPath: string, branch = this.defaultBranch): Promise<void> {
    const norm = normalizePosixPath(posixPath);
    if (!norm) return;
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const state = this.branches.get(this.makeBranchKey(realRoot, branch));
    if (!state?.initialized) return;

    // Support deleting either a single file or a directory prefix
    const prefix = `${norm}/`;
    for (const existing of state.index.getFilePaths()) {
      if (existing === norm || existing.startsWith(prefix)) {
        state.index.removeFile(existing);
        state.ditavals.delete(existing);
      }
    }
    for (const asset of Array.from(state.assetPaths)) {
      if (asset === norm || asset.startsWith(prefix)) {
        state.assetPaths.delete(asset);
      }
    }
    state.baselineRev += 1;
    state.indexedAt = Date.now();
  }

  async onFileRenamed(
    fromPath: string,
    toPath: string,
    branch = this.defaultBranch,
  ): Promise<void> {
    const normFrom = normalizePosixPath(fromPath);
    const normTo = normalizePosixPath(toPath);
    if (!normFrom || !normTo) return;
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const state = this.branches.get(this.makeBranchKey(realRoot, branch));
    if (!state?.initialized) return;

    const prefix = `${normFrom}/`;
    const matchingFiles = state.index
      .getFilePaths()
      .filter((p) => p === normFrom || p.startsWith(prefix));
    if (matchingFiles.length > 0) {
      for (const oldPath of matchingFiles) {
        const nextPath =
          oldPath === normFrom ? normTo : `${normTo}${oldPath.slice(normFrom.length)}`;
        state.index.renameFile(oldPath, nextPath);
        const dv = state.ditavals.get(oldPath);
        if (dv) {
          state.ditavals.delete(oldPath);
          state.ditavals.set(nextPath, {
            ...dv,
            path: nextPath,
            name: path.posix.basename(nextPath),
          });
        }
      }
    } else {
      for (const asset of Array.from(state.assetPaths)) {
        if (asset === normFrom || asset.startsWith(prefix)) {
          state.assetPaths.delete(asset);
          const nextAsset =
            asset === normFrom ? normTo : `${normTo}${asset.slice(normFrom.length)}`;
          state.assetPaths.add(nextAsset);
        }
      }
    }

    state.baselineRev += 1;
    state.indexedAt = Date.now();
  }

  onWorkspaceChanged(newRootDir: string): void {
    // Branch states are keyed by realpath(rootDir), so resolve the incoming path the same way
    // or the invalidation silently misses and diagnostics keep serving the pre-switch scan.
    const realRoot = realpathSyncOrNull(newRootDir);
    for (const [key, state] of Array.from(this.branches)) {
      if (state.rootDir !== realRoot && !key.startsWith(`${realRoot}::`)) continue;
      this.branches.delete(key);
    }
    this.dropOverlayCache(realRoot, this.defaultBranch);
    void this.getLoadedBranchesForActiveRoot();
  }

  async getSemanticContext(
    rootMapPath: string | null,
    ditavalPath: string | null,
    branch = this.defaultBranch,
    /** Phase 13: read the caller's `Baseline ⊎ own drafts` view instead of the clean baseline. */
    userId?: string,
  ): Promise<SemanticContextResponse> {
    const state = await this.getEffectiveState(branch, userId);
    const normMap = rootMapPath ? normalizePosixPath(rootMapPath) : null;
    const activeMap = normMap && state.index.hasFile(normMap) ? normMap : null;
    const keyspace = activeMap ? state.index.getKeyspace(activeMap) : null;

    const normDitaval = ditavalPath ? normalizePosixPath(ditavalPath) : null;
    let activeDitaval: ParsedDitaval | null = null;
    let ditavalError: XmlParseError | undefined;
    if (normDitaval) {
      const dv = state.index.getDitaval(normDitaval);
      if (dv) {
        if (dv.ok) activeDitaval = dv.parsed;
        else ditavalError = dv.error;
      }
    }

    return {
      branch,
      rootMapPath: activeMap,
      ditavalPath: normDitaval,
      keyspace,
      topicIndices: state.index.getAllTopicIndices(),
      profilingCatalog: state.index.getProfilingCatalog(),
      ditavals: Array.from(state.ditavals.values()).sort((a, b) => a.path.localeCompare(b.path)),
      activeDitaval,
      ditavalError,
      indexedAt: state.indexedAt,
    };
  }

  async getKeyspace(
    rootMapPath: string,
    branch = this.defaultBranch,
    userId?: string,
  ): Promise<KeyspaceResult | null> {
    const state = await this.getEffectiveState(branch, userId);
    const norm = normalizePosixPath(rootMapPath);
    if (!norm || !state.index.hasFile(norm)) return null;
    return state.index.getKeyspace(norm);
  }

  async getTopicIndices(
    filePath?: string,
    branch = this.defaultBranch,
    userId?: string,
  ): Promise<TopicIdIndexEntry[]> {
    const state = await this.getEffectiveState(branch, userId);
    if (filePath) {
      const entry = state.index.getTopicIndex(filePath);
      return entry ? [entry] : [];
    }
    return state.index.getAllTopicIndices();
  }

  async getDitaval(
    ditavalPath: string,
    branch = this.defaultBranch,
    userId?: string,
  ): Promise<{ ok: true; parsed: ParsedDitaval } | { ok: false; error: XmlParseError } | null> {
    const state = await this.getEffectiveState(branch, userId);
    return state.index.getDitaval(ditavalPath);
  }

  async resolveDocument(params: {
    filePath: string;
    rootMapPath: string | null;
    xml?: string;
    branch?: string;
    userId?: string;
  }): Promise<DocumentSemanticOverlay> {
    const state = await this.getEffectiveState(params.branch ?? this.defaultBranch, params.userId);
    const normMap = params.rootMapPath ? normalizePosixPath(params.rootMapPath) : null;
    const activeMap = normMap && state.index.hasFile(normMap) ? normMap : null;
    return state.index.buildDocumentOverlay(params.filePath, activeMap, params.xml);
  }

  async resolveConref(params: {
    sourceFilePath: string;
    sourceTagName: string;
    attrName: 'conref' | 'conkeyref';
    rawValue: string;
    conrefend?: string;
    sourceTopicId?: string;
    sourceElementId?: string;
    rootMapPath: string | null;
    branch?: string;
    userId?: string;
  }): Promise<ResolvedConrefResult> {
    const state = await this.getEffectiveState(params.branch ?? this.defaultBranch, params.userId);
    const normMap = params.rootMapPath ? normalizePosixPath(params.rootMapPath) : null;
    const activeMap = normMap && state.index.hasFile(normMap) ? normMap : null;
    return state.index.resolveConref({
      sourceFilePath: params.sourceFilePath,
      sourceTagName: params.sourceTagName,
      attrName: params.attrName,
      rawValue: params.rawValue,
      conrefend: params.conrefend,
      sourceTopicId: params.sourceTopicId,
      sourceElementId: params.sourceElementId,
      rootMapPath: activeMap,
    });
  }

  async collectDiagnostics(
    rootMapPath: string | null,
    branch = this.defaultBranch,
    userId?: string,
  ): Promise<SemanticDiagnostic[]> {
    const state = await this.getEffectiveState(branch, userId);
    return state.index.collectSemanticDiagnostics(rootMapPath, {
      assetPaths: state.assetPaths,
    });
  }
}
