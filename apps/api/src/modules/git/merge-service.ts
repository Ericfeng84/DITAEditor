import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { checkXmlWellFormed } from '@dita/core';
import { HttpError } from '../errors.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type { LockService, LockView } from '../locks/lock-service.js';
import type { DraftService } from '../locks/draft-service.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import type { VersionAuditService } from './audit-service.js';
import type { GitManager } from './git-manager.js';

export interface MergeConflictPreview {
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
}

export interface MergePreview {
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string;
  targetCommit: string;
  baseCommit: string | null;
  ahead: number;
  behind: number;
  canFastForward: boolean;
  hasConflicts: boolean;
  conflicts: MergeConflictPreview[];
  blockingLocks: LockView[];
  protectedTarget: boolean;
  alreadyUpToDate: boolean;
}

export interface MergeConflictContent {
  path: string;
  sourceBranch: string;
  targetBranch: string;
  baseCommit: string | null;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  isXml: boolean;
}

export interface MergeInput {
  projectRootDir: string;
  /** Worktree of the target branch: the only place the merge is ever applied. */
  targetWorkDir: string;
  projectId: string;
  manualId?: string | null;
  sourceBranch: string;
  targetBranch: string;
  user: IdentityUser;
  message?: string;
  /** Conflict path → resolved file content (final, no conflict markers). */
  resolutions?: Record<string, string>;
}

export interface MergeResult {
  commit: string;
  sourceBranch: string;
  targetBranch: string;
  changedFiles: string[];
  resolvedFiles: string[];
}

export interface MergeServiceOptions {
  git: GitManager;
  locks: LockService;
  drafts?: DraftService;
  audit?: VersionAuditService;
  registry?: ManualRegistryService;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const XML_PATH_PATTERN = /\.(dita|ditamap|ditaval|xml)$/i;
const MAX_PREVIEW_CONFLICTS = 50;

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Phase 13 safe merge: preflight with `git merge-tree` (objects only, never touches a worktree),
 * then apply the merge in a throwaway detached worktree and fast-forward the real target only
 * when its `HEAD` still matches. A conflicting or failed merge can never leave the shared
 * `workDir` in `MERGING` state.
 */
export class MergeService {
  private readonly git: GitManager;
  private readonly locks: LockService;
  private readonly drafts: DraftService | undefined;
  private readonly audit: VersionAuditService | undefined;
  private readonly registry: ManualRegistryService | undefined;

  constructor(options: MergeServiceOptions) {
    this.git = options.git;
    this.locks = options.locks;
    this.drafts = options.drafts;
    this.audit = options.audit;
    this.registry = options.registry;
  }

  async previewMerge(input: {
    projectRootDir: string;
    projectId: string;
    manualId?: string | null;
    sourceBranch: string;
    targetBranch: string;
  }): Promise<MergePreview> {
    const { projectRootDir, sourceBranch, targetBranch } = input;
    await this.assertBranches(projectRootDir, sourceBranch, targetBranch);

    const [ahead, behind] = await Promise.all([
      this.countCommits(projectRootDir, targetBranch, sourceBranch),
      this.countCommits(projectRootDir, sourceBranch, targetBranch),
    ]);
    const targetCommit = await this.revParse(projectRootDir, targetBranch);
    const sourceCommit = await this.revParse(projectRootDir, sourceBranch);
    const baseCommit = await this.mergeBase(projectRootDir, targetBranch, sourceBranch);

    const conflicts = await this.detectConflicts(projectRootDir, targetBranch, sourceBranch);
    const conflictPreviews = await Promise.all(
      conflicts.slice(0, MAX_PREVIEW_CONFLICTS).map(async (path) => {
        const versions = await this.readVersions(projectRootDir, baseCommit, targetBranch, sourceBranch, path);
        return { path, ...versions };
      }),
    );

    return {
      sourceBranch,
      targetBranch,
      sourceCommit,
      targetCommit,
      baseCommit,
      ahead,
      behind,
      canFastForward: conflicts.length === 0 && ahead > 0 && behind === 0,
      hasConflicts: conflicts.length > 0,
      conflicts: conflictPreviews,
      blockingLocks: this.locks.list(input.projectId, targetBranch),
      protectedTarget: this.isProtected(input.manualId, targetBranch),
      alreadyUpToDate: ahead === 0,
    };
  }

  async getConflictContent(input: {
    projectRootDir: string;
    sourceBranch: string;
    targetBranch: string;
    path: string;
  }): Promise<MergeConflictContent> {
    const { projectRootDir, sourceBranch, targetBranch } = input;
    await this.assertBranches(projectRootDir, sourceBranch, targetBranch);
    const filePath = normalizeRelativePath(input.path);
    const baseCommit = await this.mergeBase(projectRootDir, targetBranch, sourceBranch);
    const versions = await this.readVersions(
      projectRootDir,
      baseCommit,
      targetBranch,
      sourceBranch,
      filePath,
    );
    if (versions.ours === null && versions.theirs === null && versions.base === null) {
      throw new HttpError(404, `File not found on either branch: ${filePath}`, { path: filePath });
    }
    return {
      path: filePath,
      sourceBranch,
      targetBranch,
      baseCommit,
      ...versions,
      isXml: XML_PATH_PATTERN.test(filePath),
    };
  }

  async executeMerge(input: MergeInput): Promise<MergeResult> {
    const { projectRootDir, targetWorkDir, sourceBranch, targetBranch, user } = input;
    if (user.role === 'viewer') {
      throw new HttpError(403, 'Viewers cannot merge branches.');
    }
    await this.assertBranches(projectRootDir, sourceBranch, targetBranch);
    if (this.isProtected(input.manualId, targetBranch) && user.role !== 'admin') {
      throw new HttpError(403, `Branch ${targetBranch} is protected; an admin must merge into it.`, {
        branch: targetBranch,
      });
    }

    const blockingLocks = this.locks.list(input.projectId, targetBranch);
    if (blockingLocks.length > 0) {
      throw new HttpError(
        409,
        `Branch ${targetBranch} has ${blockingLocks.length} active lock(s); release them before merging.`,
        { locks: blockingLocks },
      );
    }

    const resolutions = input.resolutions ?? {};
    for (const [path, content] of Object.entries(resolutions)) {
      normalizeRelativePath(path);
      if (!XML_PATH_PATTERN.test(path)) continue;
      const parsed = checkXmlWellFormed(content);
      if (!parsed.ok) {
        throw new HttpError(422, `Merged XML is not well formed: ${path}`, {
          path,
          error: {
            line: parsed.error.line,
            column: parsed.error.column,
            message: parsed.error.message,
          },
        });
      }
    }

    const targetCommit = await this.revParse(projectRootDir, targetBranch);
    const sourceCommit = await this.revParse(projectRootDir, sourceBranch);
    if (targetCommit === sourceCommit) {
      throw new HttpError(409, `Nothing to merge: ${sourceBranch} is already in ${targetBranch}.`);
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'dita-merge-'));
    let worktreeAdded = false;
    try {
      await this.run(['worktree', 'add', '--detach', tempDir, targetCommit], projectRootDir);
      worktreeAdded = true;

      const merge = await this.run(['merge', '--no-commit', '--no-ff', sourceCommit], tempDir, {
        allowFailure: true,
      });
      if (merge.code !== 0 && merge.code !== 1) {
        throw new HttpError(500, `git merge failed: ${merge.stderr.trim() || merge.stdout.trim()}`);
      }

      for (const [path, content] of Object.entries(resolutions)) {
        const target = resolve(tempDir, path);
        if (!isInside(tempDir, target) || target === tempDir) {
          throw new HttpError(400, `Invalid conflict path: ${path}`, { path });
        }
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
        await this.run(['add', '--', path], tempDir);
      }

      const unresolved = await this.unmergedPaths(tempDir);
      if (unresolved.length > 0) {
        throw new HttpError(
          409,
          `Merge has unresolved conflicts: ${unresolved.join(', ')}`,
          { conflicts: unresolved },
        );
      }

      const staged = await this.run(['diff', '--cached', '--name-only'], tempDir);
      const changedFiles = staged.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      if (changedFiles.length === 0) {
        throw new HttpError(409, `Nothing to merge: ${sourceBranch} is already in ${targetBranch}.`);
      }

      const message =
        input.message?.trim() || `Merge branch '${sourceBranch}' into ${targetBranch}`;
      await this.run(
        [
          '-c',
          `user.name=${user.displayName}`,
          '-c',
          `user.email=${user.email}`,
          'commit',
          '--no-gpg-sign',
          '--no-verify',
          `--author=${user.displayName} <${user.email}>`,
          '-m',
          message,
        ],
        tempDir,
      );
      const mergeCommit = await this.revParse(tempDir, 'HEAD');

      await this.git.withWorkDirLock(targetWorkDir, async () => {
        const head = await this.git.headCommit(targetWorkDir);
        if (head && head !== targetCommit) {
          throw new HttpError(
            409,
            `Branch ${targetBranch} advanced while merging; preview the merge again.`,
            { expected: targetCommit, actual: head },
          );
        }
        const fastForward = await this.run(['merge', '--ff-only', mergeCommit], targetWorkDir, {
          allowFailure: true,
        });
        if (fastForward.code !== 0) {
          throw new HttpError(
            409,
            `Could not fast-forward ${targetBranch}; its worktree has local changes.`,
            { branch: targetBranch, detail: fastForward.stderr.trim() },
          );
        }
      });

      try {
        this.audit?.record({
          projectId: input.projectId,
          branch: targetBranch,
          actorId: user.id,
          action: 'merge',
          targetPath: sourceBranch,
          details: {
            sourceBranch,
            targetBranch,
            sourceCommit,
            targetCommit,
            mergeCommit,
            changedFiles,
            resolvedFiles: Object.keys(resolutions),
          },
        });
      } catch {
        // Auditing must never roll back a completed merge.
      }

      return {
        commit: mergeCommit,
        sourceBranch,
        targetBranch,
        changedFiles,
        resolvedFiles: Object.keys(resolutions),
      };
    } finally {
      if (worktreeAdded) {
        try {
          await this.run(['worktree', 'remove', '--force', tempDir], projectRootDir);
        } catch {
          // Fall through to the recursive removal below.
        }
      }
      await rm(tempDir, { recursive: true, force: true });
      try {
        await this.run(['worktree', 'prune'], projectRootDir);
      } catch {
        // Pruning is housekeeping only.
      }
    }
  }

  private isProtected(manualId: string | null | undefined, branch: string): boolean {
    if (!this.registry || !manualId) return false;
    return this.registry.isBranchProtected(manualId, branch);
  }

  private async assertBranches(
    projectRootDir: string,
    sourceBranch: string,
    targetBranch: string,
  ): Promise<void> {
    if (!(await this.git.isRepository(projectRootDir))) {
      throw new HttpError(400, 'Not a Git repository.', { rootDir: projectRootDir });
    }
    if (sourceBranch === targetBranch) {
      throw new HttpError(400, 'The source and target branches are the same.', { branch: sourceBranch });
    }
    if (!(await this.git.branchExists(projectRootDir, targetBranch))) {
      throw new HttpError(404, `Target branch not found: ${targetBranch}`, { branch: targetBranch });
    }
    if (!(await this.git.branchExists(projectRootDir, sourceBranch))) {
      throw new HttpError(404, `Source branch not found: ${sourceBranch}`, { branch: sourceBranch });
    }
  }

  private async countCommits(
    projectRootDir: string,
    left: string,
    right: string,
  ): Promise<number> {
    const result = await this.run(
      ['rev-list', '--left-right', '--count', `${left}...${right}`],
      projectRootDir,
    );
    const [, rightCount] = result.stdout.trim().split(/\s+/);
    return Number(rightCount) || 0;
  }

  private async revParse(dir: string, revision: string): Promise<string> {
    const result = await this.run(['rev-parse', revision], dir);
    return result.stdout.trim();
  }

  private async mergeBase(
    projectRootDir: string,
    left: string,
    right: string,
  ): Promise<string | null> {
    const result = await this.run(['merge-base', left, right], projectRootDir, {
      allowFailure: true,
    });
    return result.code === 0 ? result.stdout.trim() || null : null;
  }

  private async unmergedPaths(dir: string): Promise<string[]> {
    const result = await this.run(['diff', '--name-only', '--diff-filter=U'], dir);
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * `git merge-tree --write-tree --name-only` (Git 2.38+) answers conflicts without a worktree.
   * Older Git falls back to a three-way content comparison against the merge base.
   */
  private async detectConflicts(
    projectRootDir: string,
    targetBranch: string,
    sourceBranch: string,
  ): Promise<string[]> {
    const result = await this.run(
      ['merge-tree', '--write-tree', '--name-only', targetBranch, sourceBranch],
      projectRootDir,
      { allowFailure: true },
    );
    if (result.code === 0) return [];
    if (result.code === 1) {
      const lines = result.stdout.split('\n');
      const conflicts: string[] = [];
      for (const line of lines.slice(1)) {
        const trimmed = line.trim();
        if (!trimmed) break;
        conflicts.push(trimmed);
      }
      return conflicts;
    }

    const baseCommit = await this.mergeBase(projectRootDir, targetBranch, sourceBranch);
    if (!baseCommit) {
      const changed = await this.run(
        ['diff', '--name-only', baseCommit ?? targetBranch, sourceBranch],
        projectRootDir,
        { allowFailure: true },
      );
      return changed.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    }
    const changed = await this.run(['diff', '--name-only', baseCommit, sourceBranch], projectRootDir, {
      allowFailure: true,
    });
    const conflicts: string[] = [];
    for (const raw of changed.stdout.split('\n')) {
      const path = raw.trim();
      if (!path) continue;
      const versions = await this.readVersions(
        projectRootDir,
        baseCommit,
        targetBranch,
        sourceBranch,
        path,
      );
      if (versions.ours !== versions.theirs && versions.theirs !== versions.base) {
        conflicts.push(path);
      }
    }
    return conflicts;
  }

  private async readVersions(
    projectRootDir: string,
    baseCommit: string | null,
    targetBranch: string,
    sourceBranch: string,
    path: string,
  ): Promise<{ base: string | null; ours: string | null; theirs: string | null }> {
    const [base, ours, theirs] = await Promise.all([
      baseCommit ? this.git.fileAtRevision(projectRootDir, baseCommit, path) : Promise.resolve(null),
      this.git.fileAtRevision(projectRootDir, targetBranch, path),
      this.git.fileAtRevision(projectRootDir, sourceBranch, path),
    ]);
    return { base, ours, theirs };
  }

  private run(
    args: string[],
    cwd: string,
    options: { allowFailure?: boolean } = {},
  ): Promise<RunResult> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn('git', ['-C', cwd, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => rejectPromise(error));
      child.on('close', (code) => {
        const result: RunResult = { code: code ?? 1, stdout, stderr };
        if (result.code !== 0 && !options.allowFailure) {
          rejectPromise(
            new HttpError(500, `git ${args[0] ?? ''} failed: ${stderr.trim() || stdout.trim()}`),
          );
          return;
        }
        resolvePromise(result);
      });
    });
  }
}

function normalizeRelativePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized || normalized.split('/').includes('..') || isAbsolute(normalized)) {
    throw new HttpError(400, `Invalid repository path: ${rawPath}`, { path: rawPath });
  }
  return normalized;
}
