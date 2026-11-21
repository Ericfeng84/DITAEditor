import { promises as fs } from 'node:fs';
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

interface BranchIndexState {
  rootDir: string;
  branch: string;
  index: DitaSemanticIndex;
  assetPaths: Set<string>;
  ditavals: Map<string, WorkspaceDitavalSummary>;
  initialized: boolean;
  indexedAt: number;
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

  constructor(private readonly workspace: WorkspaceManager) {}

  private makeBranchKey(rootDir: string, branch: string): string {
    return `${rootDir}::${branch}`;
  }

  private async getOrInitBranch(branch = 'default'): Promise<BranchIndexState> {
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
    };
    this.branches.set(key, state);
    return state;
  }

  private getLoadedBranchesForActiveRoot(): BranchIndexState[] {
    const activeRoot = this.workspace.getRootDir();
    const out: BranchIndexState[] = [];
    for (const st of this.branches.values()) {
      if (st.rootDir === activeRoot && st.initialized) {
        out.push(st);
      }
    }
    return out;
  }

  async onFileWritten(posixPath: string, content: string, branch = 'default'): Promise<void> {
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
    state.indexedAt = Date.now();
  }

  async onAssetAdded(posixPath: string, branch = 'default'): Promise<void> {
    const norm = normalizePosixPath(posixPath);
    if (!norm) return;
    const realRoot = await fs.realpath(this.workspace.getRootDir());
    const state = this.branches.get(this.makeBranchKey(realRoot, branch));
    if (!state?.initialized) return;
    state.assetPaths.add(norm);
    state.indexedAt = Date.now();
  }

  async onFileDeleted(posixPath: string, branch = 'default'): Promise<void> {
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
    state.indexedAt = Date.now();
  }

  async onFileRenamed(fromPath: string, toPath: string, branch = 'default'): Promise<void> {
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

    state.indexedAt = Date.now();
  }

  onWorkspaceChanged(newRootDir: string): void {
    // Clear caches for other roots if desired or keep keyed by rootDir; invalidate target root to force clean initial scan
    for (const key of Array.from(this.branches.keys())) {
      if (key.startsWith(`${newRootDir}::`)) {
        this.branches.delete(key);
      }
    }
    void this.getLoadedBranchesForActiveRoot();
  }

  async getSemanticContext(
    rootMapPath: string | null,
    ditavalPath: string | null,
    branch = 'default',
  ): Promise<SemanticContextResponse> {
    const state = await this.getOrInitBranch(branch);
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

  async getKeyspace(rootMapPath: string, branch = 'default'): Promise<KeyspaceResult | null> {
    const state = await this.getOrInitBranch(branch);
    const norm = normalizePosixPath(rootMapPath);
    if (!norm || !state.index.hasFile(norm)) return null;
    return state.index.getKeyspace(norm);
  }

  async getTopicIndices(filePath?: string, branch = 'default'): Promise<TopicIdIndexEntry[]> {
    const state = await this.getOrInitBranch(branch);
    if (filePath) {
      const entry = state.index.getTopicIndex(filePath);
      return entry ? [entry] : [];
    }
    return state.index.getAllTopicIndices();
  }

  async getDitaval(
    ditavalPath: string,
    branch = 'default',
  ): Promise<{ ok: true; parsed: ParsedDitaval } | { ok: false; error: XmlParseError } | null> {
    const state = await this.getOrInitBranch(branch);
    return state.index.getDitaval(ditavalPath);
  }

  async resolveDocument(params: {
    filePath: string;
    rootMapPath: string | null;
    xml?: string;
    branch?: string;
  }): Promise<DocumentSemanticOverlay> {
    const state = await this.getOrInitBranch(params.branch ?? 'default');
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
  }): Promise<ResolvedConrefResult> {
    const state = await this.getOrInitBranch(params.branch ?? 'default');
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
    branch = 'default',
  ): Promise<SemanticDiagnostic[]> {
    const state = await this.getOrInitBranch(branch);
    return state.index.collectSemanticDiagnostics(rootMapPath, {
      assetPaths: state.assetPaths,
    });
  }
}
