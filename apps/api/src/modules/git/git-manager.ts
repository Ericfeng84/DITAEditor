import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { HttpError, httpError } from '../errors.js';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import type { IdentityUser } from '../identity/identity-service.js';

export interface GitFileChange {
  path: string;
  originalPath?: string;
  index: string;
  workingTree: string;
  staged: boolean;
  untracked: boolean;
  deleted: boolean;
  renamed: boolean;
  label: string;
}

export interface GitCommitEntry {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
}

export interface GitStatusSummary {
  initialized: boolean;
  hasCommits: boolean;
  rootDir: string;
  branch: string;
  primaryBranch: string;
  ahead: number;
  behind: number;
  isClean: boolean;
  dirtyFiles: GitFileChange[];
  lastCommit: GitCommitEntry | null;
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  primary: boolean;
  worktreePath: string | null;
}

export interface GitFileDiff {
  path: string;
  fromLabel: string;
  toLabel: string;
  oldText: string;
  newText: string;
  additions: number;
  deletions: number;
  binary: boolean;
  oldExists: boolean;
  newExists: boolean;
}

export interface GitWorktreeInfo {
  path: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
}

/** Phase 13: annotated or lightweight tag as reported by `git for-each-ref`. */
export interface GitTagInfo {
  name: string;
  commitHash: string;
  shortHash: string;
  message: string;
  taggerName: string;
  date: string;
}

const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/;
const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/;
const ORPHAN_WORKTREE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GITIGNORE = ['node_modules/', 'dist/', '*.log', '.DS_Store', '.dita-editor*'].join('\n') + '\n';

export function repositoryIdFor(rootDir: string): string {
  return createHash('sha1').update(rootDir).digest('hex').slice(0, 16);
}

export function validateBranchName(branch: string): string {
  const trimmed = branch.trim();
  if (
    !BRANCH_PATTERN.test(trimmed) ||
    trimmed.includes('..') ||
    trimmed.endsWith('/') ||
    trimmed.endsWith('.lock') ||
    trimmed.startsWith('-')
  ) {
    throw httpError(400, 'git.invalidBranch', { branch });
  }
  return trimmed;
}

export function validateTagName(tag: string): string {
  const trimmed = tag.trim();
  if (
    !TAG_PATTERN.test(trimmed) ||
    trimmed.includes('..') ||
    trimmed.endsWith('/') ||
    trimmed.endsWith('.lock') ||
    trimmed.startsWith('-')
  ) {
    throw httpError(400, 'git.invalidTag', { tag });
  }
  return trimmed;
}

/** Rejects refs that could be parsed as CLI options or contain whitespace. */
function validateRevisionRef(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith('-') || /\s/.test(trimmed) || trimmed.includes('\u0000')) {
    throw httpError(400, 'git.invalidRevision', { revision: ref });
  }
  return trimmed;
}

function resolveKey(dir: string): string {
  try {
    return realpathSync(dir);
  } catch {
    return resolve(dir);
  }
}

function slugifyBranch(branch: string): string {
  return branch.replace(/[^A-Za-z0-9._-]+/g, '__');
}

/**
 * Collision-free worktree leaf: `release/2.0` and `release__2.0` both slugify to
 * `release__2.0`, so a short branch hash keeps their directories distinct.
 */
function worktreeLeafName(branch: string): string {
  return `${slugifyBranch(branch)}-${createHash('sha1').update(branch).digest('hex').slice(0, 8)}`;
}

function changeLabel(change: GitFileChange, locale: ApiLocale): string {
  if (change.untracked) return apiT(locale, 'git.change.added');
  if (change.renamed) return apiT(locale, 'git.change.renamed');
  if (change.deleted) return apiT(locale, 'git.change.deleted');
  if (change.staged && change.workingTree !== ' ') return apiT(locale, 'git.change.stagedModified');
  if (change.staged) return apiT(locale, 'git.change.staged');
  return apiT(locale, 'git.change.modified');
}

function parseStatus(raw: string, locale: ApiLocale = 'zh-CN'): {
  branch: string;
  ahead: number;
  behind: number;
  dirtyFiles: GitFileChange[];
} {
  let branch = '';
  let ahead = 0;
  let behind = 0;
  const dirtyFiles: GitFileChange[] = [];
  const parts = raw.split('\0');

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part) continue;
    if (part.startsWith('## ')) {
      const header = part.slice(3);
      const branchPart = header.split('...')[0] ?? header;
      branch = branchPart.split(' ')[0] ?? '';
      const aheadMatch = /ahead (\d+)/.exec(header);
      const behindMatch = /behind (\d+)/.exec(header);
      if (aheadMatch) ahead = Number.parseInt(aheadMatch[1] ?? '0', 10);
      if (behindMatch) behind = Number.parseInt(behindMatch[1] ?? '0', 10);
      continue;
    }
    if (part.length < 3) continue;

    const indexCode = part[0] ?? ' ';
    const workTreeCode = part[1] ?? ' ';
    const path = part.slice(3);
    const change: GitFileChange = {
      path,
      index: indexCode,
      workingTree: workTreeCode,
      staged: indexCode !== ' ' && indexCode !== '?',
      untracked: indexCode === '?',
      deleted: indexCode === 'D' || workTreeCode === 'D',
      renamed: indexCode === 'R',
      label: '',
    };

    if (change.renamed || indexCode === 'C') {
      const original = parts[index + 1];
      if (original) {
        change.originalPath = original;
        index += 1;
      }
    }
    change.label = changeLabel(change, locale);
    dirtyFiles.push(change);
  }

  return { branch, ahead, behind, dirtyFiles };
}

function parseCommits(raw: string): GitCommitEntry[] {
  return raw
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, shortHash, authorName, authorEmail, date, message] = record.split('\x1f');
      return {
        hash: hash ?? '',
        shortHash: shortHash ?? '',
        authorName: authorName ?? '',
        authorEmail: authorEmail ?? '',
        date: date ?? '',
        message: message ?? '',
      };
    })
    .filter((entry) => entry.hash.length > 0);
}

function textLooksBinary(text: string): boolean {
  return text.includes('\u0000');
}

/**
 * Parses `git diff --name-status -M -z` output.
 *
 * Records are NUL separated as `STATUS\0path\0` — or `R100\0oldPath\0newPath\0` for renames and
 * `C100\0oldPath\0newPath\0` for copies. Only the leading letter of the score is meaningful.
 */
function parseNameStatusZ(
  raw: string,
): Array<{ status: 'A' | 'M' | 'D' | 'R' | 'C'; path: string; oldPath?: string }> {
  const tokens = raw.split('\u0000');
  const changes: Array<{ status: 'A' | 'M' | 'D' | 'R' | 'C'; path: string; oldPath?: string }> =
    [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    index += 1;
    if (!token) continue;
    const letter = token.trim().charAt(0).toUpperCase();
    if (letter !== 'A' && letter !== 'M' && letter !== 'D' && letter !== 'R' && letter !== 'C') {
      continue;
    }
    if (letter === 'R' || letter === 'C') {
      const oldPath = tokens[index];
      const newPath = tokens[index + 1];
      index += 2;
      if (!oldPath || !newPath) continue;
      changes.push({ status: letter, path: newPath, oldPath });
      continue;
    }
    const filePath = tokens[index];
    index += 1;
    if (!filePath) continue;
    changes.push({ status: letter, path: filePath });
  }
  return changes;
}

/** Directory names under `root`, or an empty list when unreadable. */
function safeReadDirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export interface GitManagerOptions {
  worktreesRootDir: string;
}

export class GitManager {
  private readonly clients = new Map<string, SimpleGit>();
  /** Single-flight guard so concurrent `ensureWorktree` calls share one `git worktree add`. */
  private readonly inflightWorktrees = new Map<string, Promise<string>>();
  /** Per-`workDir` promise chain: mutating Git/disk operations never interleave. */
  private readonly workDirLocks = new Map<string, Promise<unknown>>();

  constructor(private readonly options: GitManagerOptions) {}

  get worktreesRootDir(): string {
    return this.options.worktreesRootDir;
  }

  /**
   * Serializes mutating work per working directory. Callbacks are chained FIFO on the
   * resolved `workDir`, so a check-in materialization never races another Git write.
   */
  async withWorkDirLock<T>(workDir: string, fn: () => Promise<T>): Promise<T> {
    const key = resolveKey(workDir);
    const previous = this.workDirLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const tail = previous.catch(() => undefined).then(() => gate);
    this.workDirLocks.set(key, tail);
    await previous.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
      if (this.workDirLocks.get(key) === tail) {
        this.workDirLocks.delete(key);
      }
    }
  }

  private client(dir: string): SimpleGit {
    const cached = this.clients.get(dir);
    if (cached) return cached;
    const instance = simpleGit({
      baseDir: dir,
      binary: 'git',
      maxConcurrentProcesses: 1,
      trimmed: false,
    });
    this.clients.set(dir, instance);
    return instance;
  }

  isRepository(dir: string): boolean {
    return existsSync(join(dir, '.git'));
  }

  async hasCommits(dir: string): Promise<boolean> {
    if (!this.isRepository(dir)) return false;
    try {
      await this.client(dir).raw(['rev-parse', '--verify', '--quiet', 'HEAD']);
      return true;
    } catch {
      return false;
    }
  }

  async currentBranch(dir: string): Promise<string> {
    if (!this.isRepository(dir)) return 'main';
    try {
      const symbolic = (await this.client(dir).raw(['symbolic-ref', '--short', '-q', 'HEAD'])).trim();
      if (symbolic) return symbolic;
    } catch {
      // fall through to rev-parse for detached HEAD
    }
    try {
      const name = (await this.client(dir).raw(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      if (name && name !== 'HEAD') return name;
    } catch {
      // unborn branch
    }
    return 'main';
  }

  async init(rootDir: string): Promise<boolean> {
    if (this.isRepository(rootDir)) return false;
    const git = this.client(rootDir);
    mkdirSync(rootDir, { recursive: true });
    try {
      await git.raw(['init', '-b', 'main']);
    } catch {
      await git.raw(['init']);
      await git.raw(['symbolic-ref', 'HEAD', 'refs/heads/main']);
    }
    await git.raw(['config', 'user.name', 'DITAEditor']);
    await git.raw(['config', 'user.email', 'dita-editor@local']);
    const gitignorePath = join(rootDir, '.gitignore');
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, GITIGNORE, 'utf8');
    }
    await git.raw(['add', '-A']);
    try {
      await git.raw(['commit', '--no-gpg-sign', '-m', 'chore: initialize DITA workspace']);
    } catch {
      // Empty repositories without any committable file can stay unborn; later commits still work.
    }
    return true;
  }

  async ensureInitialized(rootDir: string): Promise<void> {
    if (!this.isRepository(rootDir)) {
      await this.init(rootDir);
    }
  }

  async listWorktrees(rootDir: string): Promise<GitWorktreeInfo[]> {
    if (!this.isRepository(rootDir)) return [];
    const raw = await this.client(rootDir).raw(['worktree', 'list', '--porcelain']);
    const worktrees: GitWorktreeInfo[] = [];
    let current: GitWorktreeInfo | null = null;
    for (const line of raw.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current) worktrees.push(current);
        current = { path: line.slice('worktree '.length).trim(), branch: null, bare: false, detached: false };
      } else if (line.startsWith('branch ') && current) {
        current.branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '');
      } else if (line === 'bare' && current) {
        current.bare = true;
      } else if (line === 'detached' && current) {
        current.detached = true;
      }
    }
    if (current) worktrees.push(current);
    return worktrees;
  }

  async branchExists(rootDir: string, branch: string): Promise<boolean> {
    try {
      const output = await this.client(rootDir).raw([
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/heads/${branch}`,
      ]);
      return typeof output === 'string' && output.trim().length > 0;
    } catch {
      return false;
    }
  }

  async listBranches(rootDir: string): Promise<GitBranchInfo[]> {
    if (!this.isRepository(rootDir)) {
      return [{ name: 'main', current: true, primary: true, worktreePath: rootDir }];
    }
    const current = await this.currentBranch(rootDir);
    const hasCommits = await this.hasCommits(rootDir);
    let names: string[] = [];
    if (hasCommits) {
      const raw = await this.client(rootDir).raw(['for-each-ref', '--format=%(refname:short)', 'refs/heads']);
      names = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
    if (!names.includes(current)) names.unshift(current);
    if (!names.includes('main')) names.push('main');
    names = [...new Set(names)].sort((a, b) => {
      if (a === current) return -1;
      if (b === current) return 1;
      if (a === 'main') return -1;
      if (b === 'main') return 1;
      return a.localeCompare(b);
    });
    const worktrees = await this.listWorktrees(rootDir);
    return names.map((name) => ({
      name,
      current: name === current,
      primary: name === current && worktrees[0]?.path === rootDir,
      worktreePath: worktrees.find((worktree) => worktree.branch === name)?.path ?? null,
    }));
  }

  async worktreePathForBranch(rootDir: string, branch: string): Promise<string | null> {
    const worktrees = await this.listWorktrees(rootDir);
    return worktrees.find((worktree) => worktree.branch === branch)?.path ?? null;
  }

  /**
   * Returns the working directory for a branch. The primary checkout keeps its branch;
   * every other branch lives in an isolated `git worktree` outside the project root.
   *
   * Read-only requests must pass `{ createIfMissing: false }` (the default) so a typo or
   * unknown branch can never silently create a Git branch/worktree as a side effect.
   */
  async ensureWorktree(
    rootDir: string,
    branchInput: string,
    options: { createIfMissing?: boolean } = {},
  ): Promise<string> {
    const branch = validateBranchName(branchInput);
    const key = `${resolveKey(rootDir)}::${branch}`;
    const inflight = this.inflightWorktrees.get(key);
    if (inflight) return inflight;
    const task = this.createOrReuseWorktree(rootDir, branch, options).finally(() => {
      if (this.inflightWorktrees.get(key) === task) {
        this.inflightWorktrees.delete(key);
      }
    });
    this.inflightWorktrees.set(key, task);
    return task;
  }

  private async createOrReuseWorktree(
    rootDir: string,
    branch: string,
    options: { createIfMissing?: boolean },
  ): Promise<string> {
    const createIfMissing = options.createIfMissing === true;
    await this.ensureInitialized(rootDir);
    const primaryBranch = await this.currentBranch(rootDir);
    if (branch === primaryBranch) return rootDir;

    const exists = await this.branchExists(rootDir, branch);
    if (!exists && !createIfMissing) {
      throw httpError(404, 'git.branchNotFound', { branch });
    }

    const existing = await this.worktreePathForBranch(rootDir, branch);
    if (existing && existsSync(existing)) return realpathSync(existing);
    if (existing) {
      await this.client(rootDir).raw(['worktree', 'prune']);
    }

    const target = join(
      this.options.worktreesRootDir,
      `${basename(rootDir).replace(/[^A-Za-z0-9._-]+/g, '-')}-${repositoryIdFor(rootDir)}`,
      worktreeLeafName(branch),
    );
    if (existsSync(target)) {
      throw httpError(409, 'git.worktreeExists', { target });
    }
    mkdirSync(join(target, '..'), { recursive: true });

    if (exists) {
      await this.client(rootDir).raw(['worktree', 'add', target, branch]);
    } else {
      if (!(await this.hasCommits(rootDir))) {
        throw httpError(409, 'git.noCommitsWorktree');
      }
      await this.client(rootDir).raw(['worktree', 'add', '-b', branch, target]);
    }
    return realpathSync(target);
  }

  async createBranch(
    rootDir: string,
    branchInput: string,
    options: { baseBranch?: string } = {},
  ): Promise<string> {
    const branch = validateBranchName(branchInput);
    await this.ensureInitialized(rootDir);
    if (await this.branchExists(rootDir, branch)) {
      throw httpError(409, 'git.branchExists', { branch });
    }
    if (!(await this.hasCommits(rootDir))) {
      throw httpError(409, 'git.noCommits');
    }
    if (options.baseBranch) {
      const baseBranch = validateBranchName(options.baseBranch);
      if (!(await this.branchExists(rootDir, baseBranch))) {
        throw httpError(404, 'git.branchNotFound', { branch: baseBranch });
      }
      await this.client(rootDir).raw(['branch', branch, baseBranch]);
      return branch;
    }
    await this.client(rootDir).raw(['branch', branch]);
    return branch;
  }

  /**
   * Deletes a branch plus its worktree. Refuses the primary branch and protects
   * unmerged branches unless `force` is requested.
   */
  async deleteBranch(
    rootDir: string,
    branchInput: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const branch = validateBranchName(branchInput);
    const primaryBranch = await this.currentBranch(rootDir);
    if (branch === primaryBranch) {
      throw httpError(409, 'git.cannotDeletePrimaryBranch', { branch });
    }
    if (!(await this.branchExists(rootDir, branch))) {
      throw httpError(404, 'git.branchNotFound', { branch });
    }
    const worktreePath = await this.worktreePathForBranch(rootDir, branch);
    if (worktreePath) {
      try {
        await this.client(rootDir).raw(['worktree', 'remove', '--force', worktreePath]);
      } catch {
        // A deleted/locked directory is cleaned up below and by `worktree prune`.
      }
    }
    try {
      await this.client(rootDir).raw(['worktree', 'prune']);
    } catch {
      // prune is best effort
    }
    if (worktreePath && existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true });
    }
    if (options.force) {
      await this.client(rootDir).raw(['branch', '-D', branch]);
      return;
    }
    try {
      await this.client(rootDir).raw(['branch', '-d', branch]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not fully merged/i.test(message) || /not merged/i.test(message)) {
        throw httpError(409, 'git.branchNotMerged', { branch });
      }
      throw error;
    }
  }

  /** Full 40-char HEAD SHA, or `null` for an unborn/broken repository. */
  async headCommit(workDir: string): Promise<string | null> {
    if (!this.isRepository(workDir)) return null;
    try {
      const raw = await this.client(workDir).raw(['rev-parse', '--verify', 'HEAD']);
      const sha = raw.trim();
      return sha.length > 0 ? sha : null;
    } catch {
      return null;
    }
  }

  /** Resolves any ref (branch, tag, SHA) to a commit SHA; 404 when unknown. */
  async resolveCommit(rootDir: string, ref: string): Promise<string> {
    const revision = validateRevisionRef(ref);
    try {
      const raw = await this.client(rootDir).raw(['rev-parse', '--verify', `${revision}^{commit}`]);
      const sha = raw.trim();
      if (!sha) throw new Error('empty revision');
      return sha;
    } catch {
      throw httpError(404, 'git.revisionNotFound', { revision: ref });
    }
  }

  /**
   * Extracts a clean tree for `ref` into `destDir` via `git archive`, returning the
   * resolved commit SHA. Used for baseline (Tag/Commit) publishing so deliverables are
   * never built from a dirty working tree.
   */
  async archiveRef(rootDir: string, ref: string, destDir: string): Promise<string> {
    const commit = await this.resolveCommit(rootDir, ref);
    mkdirSync(destDir, { recursive: true });
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const archive = spawn('git', ['archive', '--format=tar', commit], {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const tar = spawn('tar', ['-xf', '-', '-C', destDir], {
        cwd: rootDir,
        stdio: ['pipe', 'ignore', 'pipe'],
      });
      let stderr = '';
      const fail = (error: Error) => {
        archive.kill();
        tar.kill();
        rejectPromise(error);
      };
      archive.stdout?.pipe(tar.stdin ?? process.stdout);
      archive.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      tar.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      archive.on('error', fail);
      tar.on('error', fail);
      archive.on('close', (code) => {
        if (code !== 0) {
          fail(httpError(500, 'git.archiveFailed', { ref, message: stderr.trim() }));
        }
      });
      tar.on('close', (code) => {
        if (code !== 0) {
          fail(httpError(500, 'git.archiveFailed', { ref, message: stderr.trim() }));
          return;
        }
        resolvePromise();
      });
    });
    return commit;
  }

  /** Lists tags newest-first with their resolved commit, message and tagger. */
  async listTags(rootDir: string): Promise<GitTagInfo[]> {
    if (!this.isRepository(rootDir)) return [];
    try {
      const raw = await this.client(rootDir).raw([
        'for-each-ref',
        '--sort=-creatordate',
        '--format=%(refname:short)%1f%(objectname)%1f%(*objectname)%1f%(taggername)%1f%(creatordate:iso-strict)%1f%(subject)%1e',
        'refs/tags',
      ]);
      return raw
        .split('\x1e')
        .map((record) => record.replace(/^\n+/, '').trim())
        .filter(Boolean)
        .map((record) => {
          const [name, objectName, peeled, taggerName, date, message] = record.split('\x1f');
          const commitHash = (peeled && peeled.trim()) || (objectName ?? '').trim();
          return {
            name: (name ?? '').trim(),
            commitHash,
            shortHash: commitHash.slice(0, 7),
            message: (message ?? '').trim(),
            taggerName: (taggerName ?? '').trim(),
            date: (date ?? '').trim(),
          };
        })
        .filter((tag) => tag.name.length > 0);
    } catch {
      return [];
    }
  }

  /** Creates an annotated tag when a message is given, else a lightweight tag. */
  async createTag(
    rootDir: string,
    input: { name: string; target?: string; message?: string; user?: IdentityUser },
  ): Promise<GitTagInfo> {
    const name = validateTagName(input.name);
    const git = this.client(rootDir);
    try {
      const existing = (await git.raw(['rev-parse', '--verify', '--quiet', `refs/tags/${name}`])).trim();
      if (existing) throw httpError(409, 'git.tagExists', { tag: name });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // ref-parse failure means the tag does not exist yet
    }
    if (!(await this.hasCommits(rootDir))) {
      throw httpError(409, 'git.noCommits');
    }
    const target = input.target ? await this.resolveCommit(rootDir, input.target) : 'HEAD';
    const message = input.message?.trim();
    if (message) {
      const user = input.user;
      const args = ['-c', `user.name=${user?.displayName ?? 'DITAEditor'}`, '-c', `user.email=${user?.email ?? 'dita-editor@local'}`, 'tag', '-a', name, '-m', message, target];
      await git.raw(args);
    } else {
      await git.raw(['tag', name, target]);
    }
    const created = (await this.listTags(rootDir)).find((tag) => tag.name === name);
    return (
      created ?? {
        name,
        commitHash: target === 'HEAD' ? (await this.headCommit(rootDir)) ?? '' : target,
        shortHash: (target === 'HEAD' ? (await this.headCommit(rootDir)) ?? '' : target).slice(0, 7),
        message: message ?? '',
        taggerName: input.user?.displayName ?? '',
        date: new Date().toISOString(),
      }
    );
  }

  async deleteTag(rootDir: string, name: string): Promise<void> {
    const tag = validateTagName(name);
    try {
      await this.client(rootDir).raw(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]);
    } catch {
      throw httpError(404, 'git.tagNotFound', { tag });
    }
    await this.client(rootDir).raw(['tag', '-d', tag]);
  }

  /** Reverts a commit inside the work-dir lock; conflicts auto-abort (409). */
  async revertCommit(workDir: string, commitHash: string, user: IdentityUser): Promise<GitCommitEntry> {
    return this.withWorkDirLock(workDir, async () => {
      const revision = validateRevisionRef(commitHash);
      const dirty = await this.statusMap(workDir);
      if (dirty.size > 0) {
        throw httpError(409, 'git.workDirNotClean');
      }
      try {
        await this.client(workDir).raw([
          '-c',
          `user.name=${user.displayName}`,
          '-c',
          `user.email=${user.email}`,
          'revert',
          '--no-edit',
          revision,
        ]);
      } catch {
        try {
          await this.client(workDir).raw(['revert', '--abort']);
        } catch {
          // nothing to abort
        }
        throw httpError(409, 'git.revertConflict', { commit: commitHash });
      }
      return this.latestCommit(workDir, user, `Revert "${revision.slice(0, 7)}"`);
    });
  }

  /**
   * POSIX paths a revision added, modified, deleted or renamed — used to preflight
   * `revert-commit` against locks/drafts and to report `changedFiles` afterwards.
   *
   * `-z` keeps paths literal (no C-style octal quoting), so CJK file names survive.
   */
  async commitChangedFiles(workDir: string, revision: string): Promise<string[]> {
    if (!this.isRepository(workDir)) return [];
    const safeRev = validateRevisionRef(revision);
    let raw: string;
    try {
      raw = await this.client(workDir).raw([
        '-c',
        'core.quotepath=false',
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        '-z',
        '--root',
        safeRev,
      ]);
    } catch {
      throw httpError(404, 'git.revisionNotFound', { revision });
    }
    return raw
      .split('\u0000')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /** Commits external (desktop-editor) changes on disk into the shared baseline. */
  async commitExternalChanges(
    workDir: string,
    message: string,
    user: IdentityUser,
  ): Promise<GitCommitEntry> {
    return this.withWorkDirLock(workDir, async () => {
      const trimmed = message.trim();
      if (!trimmed) throw httpError(400, 'git.messageRequired');
      const dirty = await this.statusMap(workDir);
      if (dirty.size === 0) throw httpError(409, 'git.noCommitChanges');
      return this.commit(workDir, ['.'], trimmed, user);
    });
  }

  /** Discards external changes on disk so `workDir` returns to `HEAD`. */
  async discardExternalChanges(workDir: string): Promise<void> {
    await this.withWorkDirLock(workDir, async () => {
      const git = this.client(workDir);
      if (await this.hasCommits(workDir)) {
        await git.raw(['reset', '--hard', 'HEAD']);
      }
      await git.raw(['clean', '-fd']);
    });
  }

  /**
   * Stages and commits exactly `affectedPaths`. `git add -A -- <path>` also stages
   * deletes, and `git commit -- <paths>` keeps unrelated external files out of the commit.
   */
  async commitScopedChanges(
    workDir: string,
    affectedPaths: string[],
    message: string,
    user: IdentityUser,
    options: { alreadyLocked?: boolean } = {},
  ): Promise<GitCommitEntry> {
    if (options.alreadyLocked) {
      return this.performScopedCommit(workDir, affectedPaths, message, user);
    }
    return this.withWorkDirLock(workDir, () =>
      this.performScopedCommit(workDir, affectedPaths, message, user),
    );
  }

  private async performScopedCommit(
    workDir: string,
    affectedPaths: string[],
    message: string,
    user: IdentityUser,
  ): Promise<GitCommitEntry> {
    {
      const trimmed = message.trim();
      if (!trimmed) throw httpError(400, 'git.messageRequired');
      if (affectedPaths.length === 0) throw httpError(400, 'git.filesRequired');
      const git = this.client(workDir);
      await git.raw(['add', '-A', '--', ...affectedPaths]);
      const staged = await git.raw(['diff', '--cached', '--name-only', '--', ...affectedPaths]);
      if (!staged.trim()) {
        throw httpError(409, 'git.noCommitChanges');
      }
      const author = `${user.displayName} <${user.email}>`;
      await git.raw([
        '-c',
        `user.name=${user.displayName}`,
        '-c',
        `user.email=${user.email}`,
        'commit',
        '--no-gpg-sign',
        '--no-verify',
        `--author=${author}`,
        '-m',
        trimmed,
        '--',
        ...affectedPaths,
      ]);
      return this.latestCommit(workDir, user, trimmed);
    }
  }

  /**
   * Rollback helper for a failed atomic check-in: tracked paths return to `HEAD` and
   * untracked paths that materialization created are removed from disk.
   */
  async restoreTrackedPathsFromHead(
    workDir: string,
    trackedPaths: string[],
    untrackedPaths: string[],
  ): Promise<void> {
    const git = this.client(workDir);
    if (trackedPaths.length > 0 && (await this.hasCommits(workDir))) {
      try {
        await git.raw(['checkout', 'HEAD', '--', ...trackedPaths]);
      } catch {
        // A path may have been deleted in HEAD; `reset`/`clean` below still restore the rest.
      }
    }
    for (const path of untrackedPaths) {
      rmSync(join(workDir, path), { recursive: true, force: true });
    }
  }

  /**
   * Removes stale worktree directories under `worktreesRootDir` whose registration is gone
   * (dangling `.git` gitdir pointer or no `.git` at all) and are older than `maxAgeMs`.
   */
  async pruneOrphanWorktrees(maxAgeMs: number = ORPHAN_WORKTREE_MAX_AGE_MS): Promise<number> {
    const root = this.options.worktreesRootDir;
    if (!existsSync(root)) return 0;
    let removed = 0;
    const cutoff = Date.now() - maxAgeMs;
    for (const projectDir of safeReadDirs(root)) {
      for (const leaf of safeReadDirs(projectDir)) {
        const dir = join(projectDir, leaf);
        const gitFile = join(dir, '.git');
        let markerAge = 0;
        try {
          markerAge = statSync(existsSync(gitFile) ? gitFile : dir).mtimeMs;
        } catch {
          continue;
        }
        if (markerAge > cutoff) continue;
        let orphan = true;
        if (existsSync(gitFile)) {
          try {
            const text = readFileSync(gitFile, 'utf8');
            const match = /^gitdir:\s*(.+)$/m.exec(text);
            if (match?.[1]) {
              orphan = !existsSync(resolve(dir, match[1].trim()));
            }
          } catch {
            orphan = true;
          }
        }
        if (!orphan) continue;
        rmSync(dir, { recursive: true, force: true });
        removed += 1;
      }
      try {
        if (readdirSync(projectDir).length === 0) rmSync(projectDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    return removed;
  }

  private async latestCommit(
    workDir: string,
    user: IdentityUser,
    fallbackMessage: string,
  ): Promise<GitCommitEntry> {
    const hash = (await this.headCommit(workDir)) ?? '';
    const entries = await this.log(workDir, { limit: 1 });
    return (
      entries[0] ?? {
        hash,
        shortHash: hash.slice(0, 7),
        authorName: user.displayName,
        authorEmail: user.email,
        date: new Date().toISOString(),
        message: fallbackMessage,
      }
    );
  }

  async status(
    workDir: string,
    rootDir = workDir,
    locale: ApiLocale = 'zh-CN',
  ): Promise<GitStatusSummary> {
    if (!this.isRepository(workDir)) {
      return {
        initialized: false,
        hasCommits: false,
        rootDir,
        branch: 'main',
        primaryBranch: 'main',
        ahead: 0,
        behind: 0,
        isClean: true,
        dirtyFiles: [],
        lastCommit: null,
      };
    }
    const [raw, hasCommits, primaryBranch] = await Promise.all([
      this.client(workDir).raw(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--branch']),
      this.hasCommits(workDir),
      this.currentBranch(rootDir),
    ]);
    const parsed = parseStatus(raw, locale);
    const branch = parsed.branch || (await this.currentBranch(workDir));
    const lastCommit = hasCommits ? (await this.log(workDir, { limit: 1 }))[0] ?? null : null;
    return {
      initialized: true,
      hasCommits,
      rootDir,
      branch,
      primaryBranch,
      ahead: parsed.ahead,
      behind: parsed.behind,
      isClean: parsed.dirtyFiles.length === 0,
      dirtyFiles: parsed.dirtyFiles,
      lastCommit,
    };
  }

  async statusMap(
    workDir: string,
    locale: ApiLocale = 'zh-CN',
  ): Promise<Map<string, GitFileChange>> {
    if (!this.isRepository(workDir)) return new Map();
    const raw = await this.client(workDir).raw(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const parsed = parseStatus(raw, locale);
    return new Map(parsed.dirtyFiles.map((change) => [change.path, change]));
  }

  async fileAtRevision(workDir: string, revision: string, filePath: string): Promise<string | null> {
    if (!this.isRepository(workDir)) return null;
    try {
      return await this.client(workDir).raw(['show', `${revision}:${filePath}`]);
    } catch {
      return null;
    }
  }

  /**
   * Phase 16: every tracked file at `ref` with its blob hash, in one read-only pass.
   * `git ls-tree -r -z` keeps non-ASCII paths intact; repositories without commits return `[]`.
   */
  async listTreeFiles(
    workDir: string,
    ref = 'HEAD',
  ): Promise<Array<{ path: string; blobHash: string }>> {
    if (!this.isRepository(workDir)) return [];
    try {
      const raw = await this.client(workDir).raw(['ls-tree', '-r', '-z', '--full-tree', ref]);
      const files: Array<{ path: string; blobHash: string }> = [];
      for (const entry of raw.split('\u0000')) {
        if (!entry) continue;
        // Format: `<mode> SP <type> SP <object> TAB <path>`
        const tabIndex = entry.indexOf('\t');
        if (tabIndex < 0) continue;
        const meta = entry.slice(0, tabIndex).split(' ');
        const type = meta[1];
        const blobHash = meta[2];
        if (type !== 'blob' || !blobHash) continue;
        files.push({ path: entry.slice(tabIndex + 1), blobHash });
      }
      return files;
    } catch {
      // No commits yet, or an unknown ref: an empty tree is the truthful answer.
      return [];
    }
  }

  /**
   * Phase 16: rename-aware name/status diff between two revisions. `-M` enables rename
   * detection, which is what lets an incremental scan follow a moved topic instead of
   * reporting a delete plus an untranslated file.
   */
  async diffNameStatusBetween(
    workDir: string,
    fromCommit: string,
    toCommit = 'HEAD',
  ): Promise<Array<{ status: 'A' | 'M' | 'D' | 'R' | 'C'; path: string; oldPath?: string }>> {
    if (!this.isRepository(workDir)) return [];
    let raw: string;
    try {
      raw = await this.client(workDir).raw([
        'diff',
        '--name-status',
        '-M',
        '-z',
        fromCommit,
        toCommit,
      ]);
    } catch {
      return [];
    }
    return parseNameStatusZ(raw);
  }

  /**
   * Phase 16: binary-safe file content at one revision (`git show <rev>:<path>`). Returns
   * `null` when the path is absent at that revision rather than throwing.
   */
  async fileBufferAtRevision(
    workDir: string,
    revision: string,
    filePath: string,
  ): Promise<Buffer | null> {
    if (!this.isRepository(workDir)) return null;
    return await new Promise<Buffer | null>((resolvePromise) => {
      const child = spawn('git', ['show', `${revision}:${filePath}`], {
        cwd: workDir,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const chunks: Buffer[] = [];
      child.stdout?.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.on('error', () => resolvePromise(null));
      child.on('close', (code) => {
        resolvePromise(code === 0 ? Buffer.concat(chunks) : null);
      });
    });
  }

  async log(
    workDir: string,
    options: { path?: string | undefined; limit?: number | undefined } = {},
  ): Promise<GitCommitEntry[]> {
    if (!this.isRepository(workDir) || !(await this.hasCommits(workDir))) return [];
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 200);
    const args = [
      'log',
      `--max-count=${limit}`,
      '--format=%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e',
    ];
    if (options.path) {
      args.push('--', options.path);
    }
    try {
      const raw = await this.client(workDir).raw(args);
      return parseCommits(raw);
    } catch {
      return [];
    }
  }

  private async numstat(workDir: string, filePath: string, from?: string, to?: string): Promise<[number, number]> {
    if (!this.isRepository(workDir)) return [0, 0];
    const args = ['diff', '--numstat'];
    if (from) args.push(from);
    if (to) args.push(to);
    args.push('--', filePath);
    try {
      const raw = await this.client(workDir).raw(args);
      const line = raw.split('\n').find(Boolean);
      if (!line) return [0, 0];
      const [added, removed] = line.split('\t');
      return [
        Number.parseInt(added ?? '0', 10) || 0,
        Number.parseInt(removed ?? '0', 10) || 0,
      ];
    } catch {
      return [0, 0];
    }
  }

  async diffFile(
    workDir: string,
    filePath: string,
    from?: string | undefined,
    to?: string | undefined,
    locale: ApiLocale = 'zh-CN',
  ): Promise<GitFileDiff> {
    const hasCommits = await this.hasCommits(workDir);
    const fromRevision = from ?? (hasCommits ? 'HEAD' : undefined);
    const oldText = fromRevision ? await this.fileAtRevision(workDir, fromRevision, filePath) : null;
    let newText: string | null;
    if (to) {
      newText = await this.fileAtRevision(workDir, to, filePath);
    } else {
      const absolute = join(workDir, filePath);
      try {
        newText = statSync(absolute).isFile() ? readFileSync(absolute, 'utf8') : null;
      } catch {
        newText = null;
      }
    }
    const binary = textLooksBinary(oldText ?? '') || textLooksBinary(newText ?? '');
    let additions = 0;
    let deletions = 0;
    if (!binary) {
      [additions, deletions] = await this.numstat(workDir, filePath, fromRevision, to);
      if (additions === 0 && deletions === 0) {
        const oldLines = (oldText ?? '').split('\n').length;
        const newLines = (newText ?? '').split('\n').length;
        additions = newText !== null && oldText === null ? newLines : Math.max(0, newLines - oldLines);
        deletions = oldText !== null && newText === null ? oldLines : Math.max(0, oldLines - newLines);
      }
    }
    return {
      path: filePath,
      fromLabel: fromRevision ?? apiT(locale, 'git.diff.emptyRevision'),
      toLabel: to ?? apiT(locale, 'git.diff.workingTree'),
      oldText: binary ? '' : oldText ?? '',
      newText: binary ? '' : newText ?? '',
      additions,
      deletions,
      binary,
      oldExists: oldText !== null,
      newExists: newText !== null,
    };
  }

  async commit(
    workDir: string,
    paths: string[],
    message: string,
    user: IdentityUser,
  ): Promise<GitCommitEntry> {
    const trimmed = message.trim();
    if (!trimmed) {
      throw httpError(400, 'git.messageRequired');
    }
    if (paths.length === 0) {
      throw httpError(400, 'git.filesRequired');
    }
    const git = this.client(workDir);
    await git.raw(['add', '-A', '--', ...paths]);
    let staged = '';
    try {
      staged = await git.raw(['diff', '--cached', '--name-only', '--', ...paths]);
    } catch {
      staged = '';
    }
    if (!staged.trim()) {
      throw httpError(409, 'git.noCommitChanges');
    }
    const author = `${user.displayName} <${user.email}>`;
    await git.raw([
      '-c',
      `user.name=${user.displayName}`,
      '-c',
      `user.email=${user.email}`,
      'commit',
      '--no-gpg-sign',
      '--no-verify',
      `--author=${author}`,
      '-m',
      trimmed,
      '--',
      ...paths,
    ]);
    const hash = (await git.raw(['rev-parse', 'HEAD'])).trim();
    const entries = await this.log(workDir, { limit: 1 });
    return (
      entries[0] ?? {
        hash,
        shortHash: hash.slice(0, 7),
        authorName: user.displayName,
        authorEmail: user.email,
        date: new Date().toISOString(),
        message: trimmed,
      }
    );
  }

  /** Rolls a working file back to HEAD; files unknown to HEAD are removed completely. */
  async discard(workDir: string, filePath: string): Promise<{ deleted: boolean }> {
    const git = this.client(workDir);
    const atHead = (await this.hasCommits(workDir))
      ? await this.fileAtRevision(workDir, 'HEAD', filePath)
      : null;
    if (atHead !== null) {
      await git.raw(['checkout', 'HEAD', '--', filePath]);
      return { deleted: false };
    }
    try {
      await git.raw(['rm', '--cached', '-f', '--ignore-unmatch', '--', filePath]);
    } catch {
      // not staged
    }
    const absolute = join(workDir, filePath);
    if (existsSync(absolute)) {
      rmSync(absolute, { recursive: true, force: true });
      return { deleted: true };
    }
    return { deleted: false };
  }

  async diffPatch(workDir: string, filePath: string): Promise<string> {
    if (!this.isRepository(workDir)) return '';
    try {
      const staged = await this.client(workDir).raw(['diff', '--cached', '--', filePath]);
      const unstaged = await this.client(workDir).raw(['diff', '--', filePath]);
      return [staged, unstaged].filter(Boolean).join('\n');
    } catch {
      return '';
    }
  }
}
