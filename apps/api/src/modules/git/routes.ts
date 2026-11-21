import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import type { GitManager } from './git-manager.js';
import { validateBranchName } from './git-manager.js';
import type { IdentityService } from '../identity/identity-service.js';
import type { LockService } from '../locks/lock-service.js';
import { handlePhase4Error, resolvePhase4Scope, type LockRouteOptions } from '../locks/routes.js';
import { resolveSafeWorkspacePath, type WorkspaceManager } from '../files/workspace-fs.js';

const branchSchema = z.object({ branch: z.string().min(1) });
const createBranchSchema = z.object({ name: z.string().min(1) });
const commitSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
  message: z.string().trim().min(1),
});

const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/~^@{}-]{0,200}$/;

function normalizeRevision(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (!REVISION_PATTERN.test(raw) || raw.includes('..')) {
    throw new HttpError(400, `非法版本标识：${raw}`);
  }
  return raw;
}

export interface GitRouteOptions extends LockRouteOptions {
  workspace: WorkspaceManager;
  git: GitManager;
  identity: IdentityService;
  locks: LockService;
  onBranchChanged?: (workDir: string) => Promise<void> | void;
}

export function registerGitRoutes(app: FastifyInstance, options: GitRouteOptions): void {
  const { git, identity, locks, workspace } = options;

  app.get('/api/git/status', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const status = await git.status(scope.workDir, scope.projectRootDir);
      return {
        ...status,
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        projectId: scope.projectId,
        locks: locks.list(scope.projectId, scope.branch),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/git/init', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const created = await git.init(scope.projectRootDir);
      locks.markInitialized(scope.projectId);
      return {
        created,
        status: await git.status(scope.workDir, scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/git/branches', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const initialized = git.isRepository(scope.projectRootDir);
      const primaryBranch = await git.currentBranch(scope.projectRootDir);
      const activeBranch = await git.currentBranch(scope.workDir);
      const branches = (await git.listBranches(scope.projectRootDir)).map((branch) => ({
        ...branch,
        current: branch.name === activeBranch,
        primary: branch.name === primaryBranch,
      }));
      return {
        initialized,
        branch: activeBranch,
        primaryBranch,
        branches,
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/git/branches', async (req, reply) => {
    const parsed = createBranchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      if (scope.user.role === 'viewer') {
        throw new HttpError(403, '只读角色无法创建分支');
      }
      const name = validateBranchName(parsed.data.name);
      await git.createBranch(scope.projectRootDir, name);
      locks.markInitialized(scope.projectId);
      return {
        created: name,
        branches: await git.listBranches(scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/git/switch-branch', async (req, reply) => {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const branch = validateBranchName(parsed.data.branch);
      const workDir = await git.ensureWorktree(scope.projectRootDir, branch);
      await workspace.setActiveRootDirForBranch(workDir);
      await options.onBranchChanged?.(workDir);
      const snapshot = await workspace.scanWorkspace();
      return {
        branch: await git.currentBranch(workDir),
        workDir,
        projectRootDir: scope.projectRootDir,
        snapshot,
        status: await git.status(workDir, scope.projectRootDir),
        locks: locks.list(scope.projectId, branch),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/git/log', async (req, reply) => {
    const query = req.query as { path?: string; limit?: string };
    try {
      const scope = await resolvePhase4Scope(req, options);
      let filePath: string | undefined;
      if (query.path) {
        filePath = (await resolveSafeWorkspacePath(scope.workDir, query.path)).posixPath;
      }
      const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
      return {
        branch: scope.branch,
        path: filePath ?? null,
        commits: await git.log(scope.workDir, {
          path: filePath,
          limit: Number.isFinite(limit) ? limit : undefined,
        }),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/git/diff', async (req, reply) => {
    const query = req.query as { path?: string; from?: string; to?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = (await resolveSafeWorkspacePath(scope.workDir, query.path)).posixPath;
      const diff = await git.diffFile(
        scope.workDir,
        filePath,
        normalizeRevision(query.from),
        normalizeRevision(query.to),
      );
      return { branch: scope.branch, ...diff };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/git/file', async (req, reply) => {
    const query = req.query as { path?: string; rev?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = (await resolveSafeWorkspacePath(scope.workDir, query.path)).posixPath;
      const rev = normalizeRevision(query.rev) ?? 'HEAD';
      const content = await git.fileAtRevision(scope.workDir, rev, filePath);
      if (content === null) {
        return reply.status(404).send({ error: `版本 ${rev} 中不存在该文件` });
      }
      return { path: filePath, rev, content };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/git/commit', async (req, reply) => {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const paths: string[] = [];
      for (const rawPath of parsed.data.paths) {
        paths.push((await resolveSafeWorkspacePath(scope.workDir, rawPath)).posixPath);
      }
      const result = await locks.checkin({
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        paths,
        message: parsed.data.message,
        user: scope.user,
      });
      return {
        ...result,
        locks: locks.list(scope.projectId, scope.branch),
        status: await git.status(scope.workDir, scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/git/discard', async (req, reply) => {
    const parsed = z.object({ path: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = (await resolveSafeWorkspacePath(scope.workDir, parsed.data.path)).posixPath;
      locks.assertOwnLock(scope.projectId, scope.branch, filePath, scope.user);
      const result = await git.discard(scope.workDir, filePath);
      locks.release(scope.projectId, scope.branch, filePath, scope.user);
      return { ...result, path: filePath, locks: locks.list(scope.projectId, scope.branch) };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });
}
