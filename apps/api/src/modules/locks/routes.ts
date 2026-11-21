import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, isHttpError } from '../errors.js';
import type { GitManager } from '../git/git-manager.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { LockService } from './lock-service.js';
import {
  resolveSafeWorkspacePath,
  type WorkspaceManager,
} from '../files/workspace-fs.js';
import { handleWorkspaceError } from '../files/routes.js';

const checkoutSchema = z.object({ path: z.string().min(1) });
const releaseSchema = z.object({ path: z.string().min(1) });
const checkinSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
  message: z.string().trim().min(1),
});
const forceUnlockSchema = z.object({
  path: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

export interface Phase4Scope {
  user: IdentityUser;
  workDir: string;
  projectRootDir: string;
  projectId: string;
  branch: string;
}

export interface LockRouteOptions {
  workspace: WorkspaceManager;
  git: GitManager;
  identity: IdentityService;
  locks: LockService;
}

export function handlePhase4Error(err: unknown, reply: FastifyReply) {
  if (isHttpError(err)) {
    return reply.status(err.statusCode).send({ error: err.message, ...(err.details ?? {}) });
  }
  return handleWorkspaceError(err, reply);
}

export async function resolvePhase4Scope(
  req: FastifyRequest,
  options: LockRouteOptions,
): Promise<Phase4Scope> {
  const user = options.identity.resolve(req.headers['x-dita-user-id']);
  const workDir = options.workspace.getRootDir();
  const projectRootDir = options.workspace.getProjectRootDir();
  const projectId = options.locks.ensureRepository(projectRootDir);
  const branch = await options.git.currentBranch(workDir);
  return { user, workDir, projectRootDir, projectId, branch };
}

async function normalizePath(workDir: string, rawPath: string): Promise<string> {
  const safe = await resolveSafeWorkspacePath(workDir, rawPath);
  return safe.posixPath;
}

export function registerLockRoutes(app: FastifyInstance, options: LockRouteOptions): void {
  const { git, identity, locks } = options;

  app.get('/api/locks', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      return {
        branch: scope.branch,
        projectId: scope.projectId,
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        locks: locks.list(scope.projectId, scope.branch),
        users: identity.list(),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/locks/checkout', async (req, reply) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = await normalizePath(scope.workDir, parsed.data.path);
      const lock = await locks.checkout({
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        filePath,
        user: scope.user,
      });
      return {
        lock,
        branch: scope.branch,
        locks: locks.list(scope.projectId, scope.branch),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/locks/release', async (req, reply) => {
    const parsed = releaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = await normalizePath(scope.workDir, parsed.data.path);
      locks.release(scope.projectId, scope.branch, filePath, scope.user);
      return {
        released: filePath,
        branch: scope.branch,
        locks: locks.list(scope.projectId, scope.branch),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/locks/cancel', async (req, reply) => {
    const parsed = releaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = await normalizePath(scope.workDir, parsed.data.path);
      const result = await locks.cancelCheckout({
        workDir: scope.workDir,
        projectId: scope.projectId,
        branch: scope.branch,
        filePath,
        user: scope.user,
      });
      return {
        ...result,
        branch: scope.branch,
        locks: locks.list(scope.projectId, scope.branch),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/locks/checkin', async (req, reply) => {
    const parsed = checkinSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const paths: string[] = [];
      for (const rawPath of parsed.data.paths) {
        paths.push(await normalizePath(scope.workDir, rawPath));
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

  app.post('/api/locks/force-unlock', async (req, reply) => {
    const parsed = forceUnlockSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      if (scope.user.role !== 'admin') {
        throw new HttpError(403, '仅管理员可强制解锁');
      }
      const filePath = await normalizePath(scope.workDir, parsed.data.path);
      const result = await locks.forceUnlock({
        workDir: scope.workDir,
        projectId: scope.projectId,
        branch: scope.branch,
        filePath,
        admin: scope.user,
        reason: parsed.data.reason,
      });
      return {
        ...result,
        branch: scope.branch,
        locks: locks.list(scope.projectId, scope.branch),
        status: await git.status(scope.workDir, scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });
}
