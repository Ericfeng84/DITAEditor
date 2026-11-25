import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, httpError } from '../errors.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';
import type { GitFileChange, GitFileDiff, GitManager } from './git-manager.js';
import { validateBranchName } from './git-manager.js';
import type { IdentityService } from '../identity/identity-service.js';
import type { LockService } from '../locks/lock-service.js';
import type { DraftService, DraftView } from '../locks/draft-service.js';
import {
  handlePhase4Error,
  resolvePhase4Scope,
  type LockRouteOptions,
  type Phase4Scope,
} from '../locks/routes.js';
import { resolveSafeWorkspacePath, type WorkspaceManager } from '../files/workspace-fs.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import type { VersionAuditAction, VersionAuditService } from './audit-service.js';
import type { MergeService } from './merge-service.js';

const branchSchema = z.object({ branch: z.string().min(1) });
const createBranchSchema = z.object({
  name: z.string().min(1),
  /** Phase 13: branch off a specific baseline instead of the current branch. */
  baseBranch: z.string().min(1).optional(),
});
const commitSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
  message: z.string().trim().min(1),
});
const externalCommitSchema = z.object({ message: z.string().trim().min(1).max(500) });
const tagSchema = z.object({
  name: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(200).optional(),
  message: z.string().trim().max(500).optional(),
});
const restoreFileSchema = z.object({
  path: z.string().min(1),
  revision: z.string().trim().min(1).max(200),
  /** `draft` (default) restores into the caller's overlay; `commit` rewrites the baseline. */
  mode: z.enum(['draft', 'commit']).optional(),
  message: z.string().trim().min(1).max(500).optional(),
});
const revertSchema = z.object({ commitHash: z.string().trim().min(1).max(200) });
const mergeSchema = z.object({
  sourceBranch: z.string().trim().min(1),
  targetBranch: z.string().trim().min(1).optional(),
  message: z.string().trim().max(500).optional(),
  /** Conflict path → resolved content; validated as XML before any commit is created. */
  resolutions: z.record(z.string(), z.string()).optional(),
});

const REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/~^@{}-]{0,200}$/;

function normalizeRevision(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (!REVISION_PATTERN.test(raw) || raw.includes('..')) {
    throw httpError(400, 'git.invalidRevision', { revision: raw });
  }
  return raw;
}

function draftToChange(draft: DraftView): GitFileChange {
  const untracked = draft.op === 'create';
  const deleted = draft.op === 'delete';
  const renamed = draft.op === 'rename';
  return {
    path: draft.filePath,
    ...(renamed && draft.originalPath ? { originalPath: draft.originalPath } : {}),
    index: 'M',
    workingTree: 'M',
    staged: false,
    untracked,
    deleted,
    renamed,
    label: untracked
      ? 'New draft'
      : deleted
        ? 'Deleted draft'
        : renamed
          ? 'Renamed draft'
          : 'Draft',
  };
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split('\n').length;
}

/**
 * Phase 13: when personal drafts exist, the diff of an unchecked file must compare against the
 * caller's own overlay rather than a dirty shared work dir (which never holds their edits).
 */
function buildDraftDiff(
  drafts: DraftService,
  git: GitManager,
  scope: Phase4Scope,
  filePath: string,
  from: string,
): Promise<GitFileDiff | null> | GitFileDiff | null {
  const row =
    drafts.getUserDraft(scope.projectId, scope.branch, scope.user.id, filePath) ??
    drafts.findUserDraftByOriginalPath(scope.projectId, scope.branch, scope.user.id, filePath);
  if (!row) return null;

  const originalPath =
    row.op === 'rename' && row.originalPath ? row.originalPath : row.filePath;
  const newText = row.op === 'delete' ? '' : (row.content ?? '');
  const binary = Boolean(row.assetBlobPath) || (row.content === null && row.op !== 'delete');

  return git.fileAtRevision(scope.workDir, from, originalPath).then((oldText) => ({
    path: row.filePath,
    fromLabel: from,
    toLabel: 'draft',
    oldText: oldText ?? '',
    newText,
    additions: countLines(newText),
    deletions: countLines(oldText ?? ''),
    binary,
    oldExists: oldText !== null,
    newExists: row.op !== 'delete',
  }));
}

export interface GitRouteOptions extends LockRouteOptions {
  workspace: WorkspaceManager;
  git: GitManager;
  identity: IdentityService;
  locks: LockService;
  onBranchChanged?: (workDir: string) => Promise<void> | void;
  /** Phase 13: personal draft overlay for status / diff / discard / external-change detection. */
  drafts?: DraftService;
  /** Phase 13: append-only audit trail for every baseline mutation. */
  audit?: VersionAuditService;
  /** Phase 13: preflight + isolated merge execution. */
  merge?: MergeService;
  /** Phase 13: protected branch policy + move-aware manual ids. */
  registry?: ManualRegistryService;
  /** Phase 13: refresh semantic indexes after the shared baseline moved. */
  onBaselineChanged?: (
    scope: Phase4Scope,
    info?: {
      writtenPaths?: string[];
      deletedPaths?: string[];
      renames?: { from: string; to: string }[];
    },
  ) => Promise<void> | void;
}

export function registerGitRoutes(app: FastifyInstance, options: GitRouteOptions): void {
  const { git, identity, locks, workspace } = options;

  function recordAudit(input: {
    scope: Phase4Scope;
    action: VersionAuditAction;
    branch?: string;
    targetPath?: string;
    details?: Record<string, unknown>;
  }): void {
    try {
      options.audit?.record({
        projectId: input.scope.projectId,
        branch: input.branch ?? input.scope.branch,
        actorId: input.scope.user.id,
        action: input.action,
        ...(input.targetPath ? { targetPath: input.targetPath } : {}),
        details: input.details ?? {},
      });
    } catch {
      // The audit trail is best-effort: it must never fail the operation it records.
    }
  }

  async function notifyBaselineChanged(
    scope: Phase4Scope,
    info?: {
      writtenPaths?: string[];
      deletedPaths?: string[];
      renames?: { from: string; to: string }[];
    },
  ): Promise<void> {
    try {
      await options.onBaselineChanged?.(scope, info);
    } catch {
      // A stale index must not roll back a committed baseline.
    }
  }

  function evictBranchSession(scope: Phase4Scope, branch: string): void {
    if (!scope.manualId || !options.context) return;
    const context = options.context as unknown as {
      evictBranch?: (manualId: string, branch: string) => void;
      invalidateManual?: (manualId: string) => void;
    };
    try {
      if (typeof context.evictBranch === 'function') {
        context.evictBranch(scope.manualId, branch);
      } else if (typeof context.invalidateManual === 'function') {
        context.invalidateManual(scope.manualId);
      }
    } catch {
      // Session caches are disposable.
    }
  }

  function requireMerge(): MergeService {
    if (!options.merge) throw new HttpError(503, 'The merge service is not available.');
    return options.merge;
  }

  app.get('/api/git/status', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const status = await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req));
      const userDrafts = options.drafts
        ? options.drafts.listUserDraftViews(scope.projectId, scope.branch, scope.user.id)
        : [];
      return {
        ...status,
        // Phase 13: the shared work dir is always clean, so "dirty" means the caller's drafts.
        ...(options.drafts
          ? {
              dirtyFiles: userDrafts.map(draftToChange),
              isClean: status.dirtyFiles.length === 0 && userDrafts.length === 0,
            }
          : {}),
        /** Uncommitted on-disk edits (desktop editors / external tools) — never drafts. */
        externalDirtyFiles: status.dirtyFiles,
        externalDirtyCount: status.dirtyFiles.length,
        userDrafts,
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        projectId: scope.projectId,
        locks: locks.list(scope.projectId, scope.branch),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
        status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/git/branches', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const initialized = git.isRepository(scope.projectRootDir);
      const primaryBranch = await git.currentBranch(scope.projectRootDir);
      const activeBranch = await git.currentBranch(scope.workDir);
      const protectedBranches = options.registry
        ? options.registry.getProtectedBranches(scope.manualId ?? scope.projectId)
        : ['main'];
      const branches = (await git.listBranches(scope.projectRootDir)).map((branch) => ({
        ...branch,
        current: branch.name === activeBranch,
        primary: branch.name === primaryBranch,
        protected: protectedBranches.includes(branch.name),
      }));
      return {
        initialized,
        branch: activeBranch,
        primaryBranch,
        protectedBranches,
        branches,
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
        throw httpError(403, 'git.viewerCannotBranch');
      }
      const name = validateBranchName(parsed.data.name);
      const baseBranch = parsed.data.baseBranch
        ? validateBranchName(parsed.data.baseBranch)
        : undefined;
      await git.createBranch(scope.projectRootDir, name, baseBranch ? { baseBranch } : {});
      locks.markInitialized(scope.projectId);
      recordAudit({
        scope,
        action: 'branch_create',
        targetPath: name,
        branch: name,
        details: { baseBranch: baseBranch ?? scope.branch },
      });
      return {
        created: name,
        branches: await git.listBranches(scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  const handleDeleteBranch = async (
    req: FastifyRequest,
    reply: FastifyReply,
    wildcardBranch?: string,
  ) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const query = req.query as { branch?: string; force?: string };
      const rawBranch = wildcardBranch ?? query.branch ?? '';
      const branch = validateBranchName(decodeURIComponent(String(rawBranch)));
      if (branch === scope.branch) {
        throw new HttpError(400, `Cannot delete the branch this request is using: ${branch}`, {
          branch,
        });
      }
      const manualId = scope.manualId ?? scope.projectId;
      if (options.registry?.isBranchProtected(manualId, branch)) {
        throw new HttpError(403, `Branch ${branch} is protected and cannot be deleted.`, { branch });
      }
      const activeLocks = locks.list(scope.projectId, branch);
      if (activeLocks.length > 0) {
        throw new HttpError(
          409,
          `Branch ${branch} has ${activeLocks.length} active lock(s); release them first.`,
          { branch, locks: activeLocks },
        );
      }
      const force = query.force === 'true' || query.force === '1';
      await git.deleteBranch(scope.projectRootDir, branch, { force });
      evictBranchSession(scope, branch);
      recordAudit({ scope, action: 'branch_delete', targetPath: branch, branch, details: { force } });
      return {
        deleted: branch,
        branches: await git.listBranches(scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  };

  app.delete('/api/git/branches', (req, reply) => handleDeleteBranch(req, reply));
  app.delete('/api/git/branches/*', (req, reply) =>
    handleDeleteBranch(req, reply, (req.params as { '*'?: string })['*']),
  );

  app.post('/api/git/switch-branch', async (req, reply) => {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const branch = validateBranchName(parsed.data.branch);

      if (options.context) {
        // Phase 13: switching reuses an existing baseline; a missing branch may still be
        // provisioned implicitly for writers (Phase 4 behaviour), never for viewers.
        const exists = await git.branchExists(scope.projectRootDir, branch);
        if (!exists) {
          // Creating a branch on switch is a write: writers only, and audited below.
          identity.requireRole(scope.user, ['admin', 'writer']);
          await git.createBranch(scope.projectRootDir, branch);
        }
        const session = await options.context.resolve(scope.manualId ?? null, branch);
        const explicit = (
          options.context as unknown as {
            readExplicit?: (request: FastifyRequest) => { branch?: string | null };
          }
        ).readExplicit?.(req);
        if (!explicit?.branch) {
          options.context.setDefaultBranch(session.manualId, session.branch);
        }
        if (!exists) {
          recordAudit({
            scope,
            action: 'branch_create',
            targetPath: session.branch,
            branch: session.branch,
            details: { implicit: true },
          });
        }
        await options.onBranchChanged?.(session.workDir);
        return {
          branch: session.branch,
          workDir: session.workDir,
          projectRootDir: session.projectRootDir,
          manualId: session.manualId,
          snapshot: await session.workspace.scanWorkspace(),
          status: await git.status(session.workDir, scope.projectRootDir, resolveRequestLocale(req)),
          locks: locks.list(scope.projectId, session.branch),
        };
      }

      // Legacy (no per-request context): switching may provision the worktree, as before.
      const exists = await git.branchExists(scope.projectRootDir, branch);
      if (!exists) identity.requireRole(scope.user, ['admin', 'writer']);
      const workDir = await git.ensureWorktree(scope.projectRootDir, branch, {
        createIfMissing: !exists,
      });
      await workspace.setActiveRootDirForBranch(workDir);
      await options.onBranchChanged?.(workDir);
      if (!exists) {
        recordAudit({ scope, action: 'branch_create', targetPath: branch, branch, details: { implicit: true } });
      }
      const snapshot = await workspace.scanWorkspace();
      return {
        branch: await git.currentBranch(workDir),
        workDir,
        projectRootDir: scope.projectRootDir,
        snapshot,
        status: await git.status(workDir, scope.projectRootDir, resolveRequestLocale(req)),
        locks: locks.list(scope.projectId, branch),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
      return handlePhase4Error(err, req, reply);
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
      const from = normalizeRevision(query.from) ?? 'HEAD';
      const to = normalizeRevision(query.to);
      if (!to && options.drafts) {
        const draftDiff = await buildDraftDiff(options.drafts, git, scope, filePath, from);
        if (draftDiff) return { branch: scope.branch, ...draftDiff };
      }
      const diff = await git.diffFile(
        scope.workDir,
        filePath,
        from,
        to,
        resolveRequestLocale(req),
      );
      return { branch: scope.branch, ...diff };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
        return reply
          .status(404)
          .send({ error: apiT(resolveRequestLocale(req), 'git.revisionFileMissing', { revision: rev }) });
      }
      return { path: filePath, rev, content };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
      await notifyBaselineChanged(scope, { writtenPaths: paths });
      return {
        ...result,
        locks: locks.list(scope.projectId, scope.branch),
        status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
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
      if (options.drafts) {
        // Phase 13: dropping a draft must never touch the shared baseline.
        const result = await locks.cancelCheckout({
          workDir: scope.workDir,
          projectId: scope.projectId,
          branch: scope.branch,
          filePath,
          user: scope.user,
        });
        return {
          ...result,
          path: filePath,
          locks: locks.list(scope.projectId, scope.branch),
          status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
        };
      }
      locks.assertOwnLock(scope.projectId, scope.branch, filePath, scope.user);
      const result = await git.discard(scope.workDir, filePath);
      locks.release(scope.projectId, scope.branch, filePath, scope.user);
      return { ...result, path: filePath, locks: locks.list(scope.projectId, scope.branch) };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  // --- External (desktop / VS Code / Oxygen) edits: detect, commit or discard explicitly. ---

  app.post('/api/git/external-commit', async (req, reply) => {
    const parsed = externalCommitSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const before = await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req));
      const paths = before.dirtyFiles.map((file) => file.path);
      const commit = await git.commitExternalChanges(scope.workDir, parsed.data.message, scope.user);
      await notifyBaselineChanged(scope, { writtenPaths: paths });
      return {
        commit,
        status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/git/external-discard', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const before = await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req));
      const paths = before.dirtyFiles.map((file) => file.path);
      await git.discardExternalChanges(scope.workDir);
      await notifyBaselineChanged(scope, { writtenPaths: paths });
      return {
        discarded: true,
        paths,
        status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  // --- Baseline tags (immutable publish snapshots). ---

  app.get('/api/git/tags', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      return {
        branch: scope.branch,
        tags: await git.listTags(scope.projectRootDir),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/git/tags', async (req, reply) => {
    const parsed = tagSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const target = normalizeRevision(parsed.data.target);
      const tag = await git.createTag(scope.projectRootDir, {
        name: parsed.data.name,
        ...(target ? { target } : {}),
        ...(parsed.data.message ? { message: parsed.data.message } : {}),
        user: scope.user,
      });
      recordAudit({
        scope,
        action: 'tag_create',
        targetPath: tag.name,
        details: {
          commitHash: tag.commitHash,
          annotated: Boolean(parsed.data.message),
        },
      });
      return { tag, tags: await git.listTags(scope.projectRootDir) };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  const handleDeleteTag = async (req: FastifyRequest, reply: FastifyReply, rawName?: string) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const name = decodeURIComponent(String(rawName ?? (req.params as { name?: string }).name ?? ''));
      if (!name) throw new HttpError(400, 'A tag name is required.');
      await git.deleteTag(scope.projectRootDir, name);
      recordAudit({ scope, action: 'tag_delete', targetPath: name });
      return { deleted: name, tags: await git.listTags(scope.projectRootDir) };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  };

  app.delete('/api/git/tags/:name', (req, reply) => handleDeleteTag(req, reply));
  app.delete('/api/git/tags/*', (req, reply) =>
    handleDeleteTag(req, reply, (req.params as { '*'?: string })['*']),
  );

  // --- Version audit log. ---

  app.get('/api/git/audit', async (req, reply) => {
    const query = req.query as { branch?: string; action?: string; limit?: string };
    try {
      const scope = await resolvePhase4Scope(req, options);
      if (!options.audit) {
        return { branch: query.branch ?? scope.branch, logs: [] };
      }
      const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
      const logs = options.audit.list(scope.projectId, {
        branch: query.branch || scope.branch,
        ...(query.action ? { action: query.action as VersionAuditAction } : {}),
        ...(Number.isFinite(limit) ? { limit } : {}),
      });
      return { branch: query.branch ?? scope.branch, logs };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  // --- Restore / revert an existing commit. ---

  app.post('/api/git/restore-file', async (req, reply) => {
    const parsed = restoreFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const filePath = (await resolveSafeWorkspacePath(scope.workDir, parsed.data.path)).posixPath;
      const revision = normalizeRevision(parsed.data.revision);
      if (!revision) throw httpError(400, 'git.invalidRevision', { revision: parsed.data.revision });
      const content = await git.fileAtRevision(scope.workDir, revision, filePath);
      if (content === null) {
        throw new HttpError(404, `File ${filePath} does not exist at ${revision}.`, {
          path: filePath,
          revision,
        });
      }
      const mode = parsed.data.mode ?? 'draft';

      if (mode === 'draft') {
        if (!options.drafts) {
          throw new HttpError(503, 'Personal drafts are not available.');
        }
        await locks.checkout({
          workDir: scope.workDir,
          projectRootDir: scope.projectRootDir,
          filePath,
          user: scope.user,
          allowMissing: true,
        });
        const baseCommit = (await git.headCommit(scope.workDir)) ?? '';
        const draft = options.drafts.upsertTextDraft({
          projectId: scope.projectId,
          branch: scope.branch,
          filePath,
          userId: scope.user.id,
          op: 'edit',
          content,
          baseCommit,
          originalPath: null,
        });
        recordAudit({
          scope,
          action: 'restore',
          targetPath: filePath,
          details: { revision, mode, contentHash: draft.contentHash },
        });
        return { path: filePath, revision, mode, contentHash: draft.contentHash };
      }

      // mode === 'commit': rewrite the shared baseline under the caller's file lock.
      await locks.checkout({
        workDir: scope.workDir,
        projectRootDir: scope.projectRootDir,
        filePath,
        user: scope.user,
        allowMissing: true,
      });
      const absPath = resolve(scope.workDir, filePath);
      const commit = await git.withWorkDirLock(scope.workDir, async () => {
        await mkdir(dirname(absPath), { recursive: true });
        await writeFile(absPath, content, 'utf8');
        return git.commitScopedChanges(
          scope.workDir,
          [filePath],
          parsed.data.message ?? `Restore ${filePath} from ${revision}`,
          scope.user,
          { alreadyLocked: true },
        );
      });
      if (options.drafts) {
        options.drafts.deleteUserDraft(scope.projectId, scope.branch, scope.user.id, filePath);
        options.drafts.bumpDraftRev(scope.projectId, scope.branch, scope.user.id);
      }
      try {
        locks.release(scope.projectId, scope.branch, filePath, scope.user);
      } catch {
        // The commit already advanced the baseline; a missing lock is harmless.
      }
      await notifyBaselineChanged(scope, { writtenPaths: [filePath] });
      recordAudit({
        scope,
        action: 'restore',
        targetPath: filePath,
        details: { revision, mode, commitHash: commit.hash },
      });
      return {
        path: filePath,
        revision,
        mode,
        commit,
        status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/git/revert-commit', async (req, reply) => {
    const parsed = revertSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const revision = normalizeRevision(parsed.data.commitHash);
      if (!revision) throw httpError(400, 'git.invalidRevision', { revision: parsed.data.commitHash });
      const commit = await git.revertCommit(scope.workDir, revision, scope.user);
      await notifyBaselineChanged(scope);
      recordAudit({
        scope,
        action: 'revert',
        targetPath: revision,
        details: { commitHash: revision, revertCommit: commit.hash },
      });
      return {
        commit,
        status: await git.status(scope.workDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  // --- Safe merge (preflight, conflict content, isolated execution). ---

  app.get('/api/git/merge-preview', async (req, reply) => {
    const query = req.query as { source?: string; target?: string };
    if (!query.source) {
      return reply.status(400).send({ error: 'Missing required query parameter: source' });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const merge = requireMerge();
      const sourceBranch = validateBranchName(query.source);
      const targetBranch = validateBranchName(query.target || scope.branch);
      return await merge.previewMerge({
        projectRootDir: scope.projectRootDir,
        projectId: scope.projectId,
        manualId: scope.manualId ?? null,
        sourceBranch,
        targetBranch,
      });
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/git/merge-conflict', async (req, reply) => {
    const query = req.query as { source?: string; target?: string; path?: string };
    if (!query.source || !query.path) {
      return reply.status(400).send({ error: 'Missing required query parameters: source, path' });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      const merge = requireMerge();
      const sourceBranch = validateBranchName(query.source);
      const targetBranch = validateBranchName(query.target || scope.branch);
      return await merge.getConflictContent({
        projectRootDir: scope.projectRootDir,
        sourceBranch,
        targetBranch,
        path: query.path,
      });
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/git/merge', async (req, reply) => {
    const parsed = mergeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      identity.requireRole(scope.user, ['admin', 'writer']);
      const merge = requireMerge();
      const sourceBranch = validateBranchName(parsed.data.sourceBranch);
      const targetBranch = validateBranchName(parsed.data.targetBranch || scope.branch);
      const targetWorkDir = await git.ensureWorktree(scope.projectRootDir, targetBranch, {
        createIfMissing: false,
      });
      const result = await merge.executeMerge({
        projectRootDir: scope.projectRootDir,
        targetWorkDir,
        projectId: scope.projectId,
        manualId: scope.manualId ?? null,
        sourceBranch,
        targetBranch,
        user: scope.user,
        ...(parsed.data.message ? { message: parsed.data.message } : {}),
        ...(parsed.data.resolutions ? { resolutions: parsed.data.resolutions } : {}),
      });
      await notifyBaselineChanged({ ...scope, branch: targetBranch }, { writtenPaths: result.changedFiles });
      return {
        ...result,
        status: await git.status(targetWorkDir, scope.projectRootDir, resolveRequestLocale(req)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });
}
