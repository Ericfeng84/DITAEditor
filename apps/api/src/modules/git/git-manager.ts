import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { HttpError } from '../errors.js';
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

const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,120}$/;
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
    throw new HttpError(400, `非法分支名：${branch}`);
  }
  return trimmed;
}

function slugifyBranch(branch: string): string {
  return branch.replace(/[^A-Za-z0-9._-]+/g, '__');
}

function changeLabel(change: GitFileChange): string {
  if (change.untracked) return '新增';
  if (change.renamed) return '重命名';
  if (change.deleted) return '删除';
  if (change.staged && change.workingTree !== ' ') return '已暂存·再修改';
  if (change.staged) return '已暂存';
  return '已修改';
}

function parseStatus(raw: string): {
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
    change.label = changeLabel(change);
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

export interface GitManagerOptions {
  worktreesRootDir: string;
}

export class GitManager {
  private readonly clients = new Map<string, SimpleGit>();

  constructor(private readonly options: GitManagerOptions) {}

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
   */
  async ensureWorktree(rootDir: string, branchInput: string): Promise<string> {
    const branch = validateBranchName(branchInput);
    await this.ensureInitialized(rootDir);
    const primaryBranch = await this.currentBranch(rootDir);
    if (branch === primaryBranch) return rootDir;

    const existing = await this.worktreePathForBranch(rootDir, branch);
    if (existing && existsSync(existing)) return realpathSync(existing);
    if (existing) {
      await this.client(rootDir).raw(['worktree', 'prune']);
    }

    const target = join(
      this.options.worktreesRootDir,
      `${basename(rootDir).replace(/[^A-Za-z0-9._-]+/g, '-')}-${repositoryIdFor(rootDir)}`,
      slugifyBranch(branch),
    );
    if (existsSync(target)) {
      throw new HttpError(409, `分支工作区目录已存在但未注册到 Git：${target}`);
    }
    mkdirSync(join(target, '..'), { recursive: true });

    const exists = await this.branchExists(rootDir, branch);
    if (exists) {
      await this.client(rootDir).raw(['worktree', 'add', target, branch]);
    } else {
      if (!(await this.hasCommits(rootDir))) {
        throw new HttpError(409, '仓库尚无提交，无法创建分支工作区');
      }
      await this.client(rootDir).raw(['worktree', 'add', '-b', branch, target]);
    }
    return realpathSync(target);
  }

  async createBranch(rootDir: string, branchInput: string): Promise<string> {
    const branch = validateBranchName(branchInput);
    await this.ensureInitialized(rootDir);
    if (await this.branchExists(rootDir, branch)) {
      throw new HttpError(409, `分支已存在：${branch}`);
    }
    if (!(await this.hasCommits(rootDir))) {
      throw new HttpError(409, '仓库尚无提交，无法创建分支');
    }
    await this.client(rootDir).raw(['branch', branch]);
    return branch;
  }

  async status(workDir: string, rootDir = workDir): Promise<GitStatusSummary> {
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
    const parsed = parseStatus(raw);
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

  async statusMap(workDir: string): Promise<Map<string, GitFileChange>> {
    if (!this.isRepository(workDir)) return new Map();
    const raw = await this.client(workDir).raw(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const parsed = parseStatus(raw);
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
      fromLabel: fromRevision ?? '空',
      toLabel: to ?? '工作区',
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
      throw new HttpError(400, '提交说明不能为空');
    }
    if (paths.length === 0) {
      throw new HttpError(400, '请选择要提交的文件');
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
      throw new HttpError(409, '所选文件没有可提交的改动');
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
