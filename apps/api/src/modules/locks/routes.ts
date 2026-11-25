import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, httpError, isHttpError, localizeErrorMessage } from '../errors.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import type { GitManager } from '../git/git-manager.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { LockService } from './lock-service.js';
import type { DraftService } from './draft-service.js';
import type { VersionAuditService } from '../git/audit-service.js';
import type { ManualContextResolver, ManualSession } from '../manuals/manual-context-resolver.js';
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
  /** Phase 10: assignments to complete together with this check-in (assignee's own only). */
  completeAssignmentIds: z.array(z.string().min(1)).optional(),
  /** Phase 10: complete every assignment of the caller covering the checked-in topics. */
  completeMyAssignments: z.boolean().optional(),
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
  /** Phase 10: the manual + branch session this request resolved to, when available. */
  manualId?: string;
  session?: ManualSession;
}

/** Phase 13: baseline-move notification payload used by the semantic indexers. */
export interface BaselineChangeInfo {
  writtenPaths?: string[];
  deletedPaths?: string[];
  renames?: { from: string; to: string }[];
}

export interface LockRouteOptions {
  workspace: WorkspaceManager;
  /** Phase 13: optional so publish-only route sets can share these scope helpers. */
  git?: GitManager;
  identity: IdentityService;
  locks: LockService;
  /** Phase 10 per-request manual/branch isolation; absent in legacy unit tests. */
  context?: ManualContextResolver;
  /** Phase 10 hook: check-out moves the caller's pending assignment to `in_progress`. */
  onCheckout?: (input: {
    scope: Phase4Scope;
    filePath: string;
  }) => Promise<unknown>;
  /** Phase 10 hook: check-in completes the caller's assignments for the committed topics. */
  onCheckin?: (input: {
    scope: Phase4Scope;
    paths: string[];
    completeAssignmentIds?: string[];
    completeMyAssignments?: boolean;
  }) => Promise<unknown>;
  /** Phase 13: draft overlay, so every response can report the caller's own drafts. */
  drafts?: DraftService;
  /** Phase 13: append-only audit trail for every baseline mutation. */
  audit?: VersionAuditService;
  /** Phase 13: `topic_assignments.path` follows a rename only once the baseline commits it. */
  onRenameCommitted?: (input: {
    manualId: string;
    branch: string;
    fromPath: string;
    toPath: string;
  }) => Promise<unknown> | unknown;
  /** Phase 13: refresh semantic indexes after the shared baseline moved. */
  onBaselineChanged?: (
    scope: Phase4Scope,
    info?: BaselineChangeInfo,
  ) => Promise<void> | void;
}

function requireGit(options: LockRouteOptions): GitManager {
  if (!options.git) throw new HttpError(500, 'Git manager is not configured.');
  return options.git;
}

export function handlePhase4Error(err: unknown, req: FastifyRequest, reply: FastifyReply) {
  const locale = resolveRequestLocale(req);
  if (isHttpError(err)) {
    return reply
      .status(err.statusCode)
      .send({ error: localizeErrorMessage(err, locale), ...(err.details ?? {}) });
  }
  return handleWorkspaceError(err, req, reply);
}

export async function resolvePhase4Scope(
  req: FastifyRequest,
  options: LockRouteOptions,
): Promise<Phase4Scope> {
  const user = options.identity.resolve(req.headers['x-dita-user-id']);

  if (options.context) {
    const session = await options.context.resolveRequest(req);
    // Phase 13: the manual id IS the project id. Locks, drafts, audit logs and publish jobs
    // must all use it; a path hash here would split one manual into two isolated id spaces.
    const projectId = options.locks.projectIdForManual(
      session.projectRootDir,
      session.manualId,
    );
    return {
      user,
      workDir: session.workDir,
      projectRootDir: session.projectRootDir,
      projectId,
      branch: session.branch,
      manualId: session.manualId,
      session,
    };
  }

  const workDir = options.workspace.getRootDir();
  const projectRootDir = options.workspace.getProjectRootDir();
  const projectId = options.locks.ensureRepository(projectRootDir);
  const branch = options.git ? await options.git.currentBranch(workDir) : 'main';
  return { user, workDir, projectRootDir, projectId, branch };
}

async function normalizePath(workDir: string, rawPath: string): Promise<string> {
  const safe = await resolveSafeWorkspacePath(workDir, rawPath);
  return safe.posixPath;
}

export function registerLockRoutes(app: FastifyInstance, options: LockRouteOptions): void {
  const { identity, locks, drafts } = options;

  /** Phase 13: the caller's own drafts, so clients see "dirty" without a shared workDir change. */
  const draftViewsFor = (scope: Phase4Scope) =>
    drafts ? drafts.listUserDraftViews(scope.projectId, scope.branch, scope.user.id) : [];

  app.get('/api/locks', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      return {
        branch: scope.branch,
        projectId: scope.projectId,
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        locks: locks.list(scope.projectId, scope.branch),
        drafts: draftViewsFor(scope),
        users: identity.list(),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
      const updatedAssignment = options.onCheckout
        ? await options.onCheckout({ scope, filePath })
        : null;
      return {
        lock,
        branch: scope.branch,
        locks: locks.list(scope.projectId, scope.branch),
        updatedAssignment: updatedAssignment ?? null,
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
      return handlePhase4Error(err, req, reply);
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
        drafts: draftViewsFor(scope),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
      const completedAssignments = options.onCheckin
        ? await options.onCheckin({
            scope,
            paths,
            completeAssignmentIds: parsed.data.completeAssignmentIds,
            completeMyAssignments: parsed.data.completeMyAssignments,
          })
        : null;

      const baselineInfo: BaselineChangeInfo = {
        writtenPaths: result.writtenPaths,
        deletedPaths: result.deletedPaths,
        renames: result.renames,
      };

      // Phase 13: a draft rename only becomes a real path change once the baseline commits it.
      if (options.onRenameCommitted) {
        const manualId = scope.manualId ?? scope.projectId;
        for (const rename of result.renames) {
          await options.onRenameCommitted({
            manualId,
            branch: scope.branch,
            fromPath: rename.from,
            toPath: rename.to,
          });
        }
      }

      if (scope.session) {
        await scope.session.indexer.refreshFromBaselineDisk(scope.branch, baselineInfo);
      }
      await options.onBaselineChanged?.(scope, baselineInfo);

      return {
        ...result,
        locks: locks.list(scope.projectId, scope.branch),
        drafts: draftViewsFor(scope),
        status: await requireGit(options).status(
          scope.workDir,
          scope.projectRootDir,
          resolveRequestLocale(req),
        ),
        completedAssignments: completedAssignments ?? [],
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  const handoffSchema = z.object({
    path: z.string().min(1),
    targetUserId: z.string().min(1),
  });

  app.post('/api/locks/handoff', async (req, reply) => {
    const parsed = handoffSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const filePath = await normalizePath(scope.workDir, parsed.data.path);
      const result = await locks.handoff({
        projectId: scope.projectId,
        branch: scope.branch,
        filePath,
        fromUser: scope.user,
        targetUserId: parsed.data.targetUserId,
      });
      return {
        ...result,
        branch: scope.branch,
        locks: locks.list(scope.projectId, scope.branch),
        drafts: draftViewsFor(scope),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
        throw httpError(403, 'locks.adminOnlyUnlock');
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
        drafts: draftViewsFor(scope),
        status: await requireGit(options).status(
          scope.workDir,
          scope.projectRootDir,
          resolveRequestLocale(req),
        ),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });
}
