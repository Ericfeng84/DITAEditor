import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';
import type { IdentityService } from '../identity/identity-service.js';
import type { LockService } from '../locks/lock-service.js';
import { isHttpError, localizeErrorMessage } from '../errors.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import {
  WorkspaceConflictError,
  WorkspaceNotFoundError,
  WorkspacePathError,
  resolveSafeWorkspacePath,
  type WorkspaceManager,
  type WorkspaceSnapshot,
} from './workspace-fs.js';
import type { ManualContextResolver } from '../manuals/manual-context-resolver.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';

async function resolveSafeWorkspacePathFor(workspace: WorkspaceManager, relPath: string) {
  return resolveSafeWorkspacePath(workspace.getRootDir(), relPath);
}

const openWorkspaceSchema = z.union([
  z.object({ useDefault: z.literal(true) }),
  z.object({ rootDir: z.string().min(1) }),
]);

const importWorkspaceSchema = z.object({
  projectName: z.string().min(1),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
        encoding: z.enum(['utf8', 'base64']).optional(),
      }),
    )
    .min(1),
});

const writeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  createDirs: z.boolean().optional(),
});

const createFileSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(['concept', 'task', 'reference', 'topic', 'map', 'bookmap', 'ditaval']),
  id: z.string().optional(),
  title: z.string().optional(),
  lang: z.string().optional(),
  content: z.string().optional(),
  overwrite: z.boolean().optional(),
});

const mkdirSchema = z.object({
  path: z.string().min(1),
});

const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentDir: z.string().trim().min(1).optional(),
  scaffold: z.enum(['blank', 'starter']).optional(),
});

const forgetWorkspaceSchema = z.object({
  path: z.string().min(1),
});

const renameSchema = z.object({
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
});

export function handleWorkspaceError(err: unknown, req: FastifyRequest, reply: FastifyReply) {
  if (isHttpError(err)) {
    return reply.status(err.statusCode).send({
      error: localizeErrorMessage(err, resolveRequestLocale(req)),
      ...(err.details ?? {}),
    });
  }
  if (
    err instanceof WorkspacePathError ||
    err instanceof WorkspaceNotFoundError ||
    err instanceof WorkspaceConflictError
  ) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export interface WorkspaceRouteSecurity {
  identity: IdentityService;
  locks: LockService;
  /** Phase 10: resolves the manual/branch session this request belongs to. */
  context?: ManualContextResolver;
  /** Phase 10: bridges the legacy single-workspace routes onto the manual registry. */
  registry?: ManualRegistryService;
  /** Phase 10: fired after a rename so assignments can follow the new topic path. */
  onFileRenamed?: (input: {
    manualId: string;
    branch: string;
    fromPath: string;
    toPath: string;
  }) => Promise<unknown> | unknown;
}

export function registerWorkspaceFileRoutes(
  app: FastifyInstance,
  workspace: WorkspaceManager,
  indexer?: WorkspaceSemanticIndexer,
  security?: WorkspaceRouteSecurity,
): void {
  const requireWriterOrAdmin = (req: FastifyRequest) => {
    if (!security) return undefined;
    const user = security.identity.resolve(req.headers['x-dita-user-id']);
    security.identity.requireRole(user, ['admin', 'writer']);
    return user;
  };

  const sessionFor = async (req: FastifyRequest) =>
    security?.context ? await security.context.resolveRequest(req) : null;

  /** The workspace view this request must read and write through (manual + branch isolated). */
  const workspaceFor = async (req: FastifyRequest) =>
    (await sessionFor(req))?.workspace ?? workspace;

  const indexerFor = async (req: FastifyRequest) => (await sessionFor(req))?.indexer ?? indexer;

  const authorizeWrite = async (req: FastifyRequest, relPath: string, exists: boolean) => {
    if (!security) return;
    const user = security.identity.resolve(req.headers['x-dita-user-id']);
    const session = await sessionFor(req);
    const workDir = session?.workDir ?? workspace.getRootDir();
    const projectRootDir = session?.projectRootDir ?? workspace.getProjectRootDir();
    await security.locks.authorizeWrite({
      workDir,
      projectRootDir,
      filePath: relPath,
      user,
      exists,
    });
  };

  const currentScope = async (req: FastifyRequest) => {
    if (!security) return null;
    const user = security.identity.resolve(req.headers['x-dita-user-id']);
    const session = await sessionFor(req);
    const workDir = session?.workDir ?? workspace.getRootDir();
    const projectRootDir = session?.projectRootDir ?? workspace.getProjectRootDir();
    const projectId = security.locks.ensureRepository(projectRootDir);
    const branch = session?.branch ?? (await security.locks.currentBranch(workDir));
    return { user, projectId, branch, workDir, session };
  };

  /** Legacy open/import/create routes: adopt the directory as a manual so requests can
   *  address it by `x-dita-manual-id` from then on. */
  const adoptWorkspace = async (
    req: FastifyRequest,
    snapshot: WorkspaceSnapshot,
    requestedPath?: string,
  ) => {
    if (!security?.context || !security.registry) return snapshot;
    const view = await security.registry.registerDirectory(requestedPath ?? snapshot.rootDir, {
      name: snapshot.name,
      locale: resolveRequestLocale(req),
    });
    security.context.setActiveManual(view.id);
    return snapshot;
  };

  app.get('/api/workspace', async (req, reply) => {
    try {
      return await (await workspaceFor(req)).scanWorkspace();
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/workspace/open', async (req, reply) => {
    const parsed = openWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const target = 'useDefault' in parsed.data ? { useDefault: true as const } : parsed.data.rootDir;
      const snapshot = await workspace.openWorkspace(target);
      return await adoptWorkspace(
        req,
        snapshot,
        'useDefault' in parsed.data ? workspace.defaultRootDir : path.resolve(parsed.data.rootDir),
      );
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/workspace/import', async (req, reply) => {
    requireWriterOrAdmin(req);
    const parsed = importWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const snapshot = await workspace.importBatchFiles(parsed.data.projectName, parsed.data.files);
      return await adoptWorkspace(req, snapshot);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.get('/api/workspaces', async (req, reply) => {
    try {
      return await workspace.listWorkspaces();
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/workspaces/create', async (req, reply) => {
    requireWriterOrAdmin(req);
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const snapshot = await workspace.createWorkspace({
        ...parsed.data,
        locale: resolveRequestLocale(req),
      });
      return await adoptWorkspace(req, snapshot);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/workspaces/forget', async (req, reply) => {
    requireWriterOrAdmin(req);
    const parsed = forgetWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const known =
        security?.registry && security.context
          ? (await security.registry.list({ includeArchived: true })).manuals.find(
              (manual) => manual.rootDir === parsed.data.path,
            )
          : undefined;
      if (known) {
        await security!.registry!.remove(
          known.id,
          security!.identity.resolve(req.headers['x-dita-user-id']),
        );
        security!.context!.invalidateManual(known.id);
      }
      return { workspaces: await workspace.forgetWorkspace(parsed.data.path) };
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.get('/api/files/tree', async (req, reply) => {
    try {
      const snapshot = await (await workspaceFor(req)).scanWorkspace();
      return {
        rootDir: snapshot.rootDir,
        files: snapshot.files,
        maps: snapshot.maps,
        topicTitles: snapshot.topicTitles,
        topicTypes: snapshot.topicTypes,
      };
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.get('/api/files/content', async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      return await (await workspaceFor(req)).readFile(query.path);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.put('/api/files/content', async (req, reply) => {
    const parsed = writeFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const ws = await workspaceFor(req);
      const safePath = (await resolveSafeWorkspacePathFor(ws, parsed.data.path)).posixPath;
      await authorizeWrite(req, safePath, await ws.fileExists(safePath));
      return await ws.writeFile(parsed.data.path, parsed.data.content, parsed.data.createDirs ?? true);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/files/create', async (req, reply) => {
    const parsed = createFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const ws = await workspaceFor(req);
      const exists = await ws.fileExists(parsed.data.path);
      if (!exists || parsed.data.overwrite) {
        const safePath = (await resolveSafeWorkspacePathFor(ws, parsed.data.path)).posixPath;
        await authorizeWrite(req, safePath, exists);
      }
      return await ws.createFromTemplate(parsed.data);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/files/mkdir', async (req, reply) => {
    const parsed = mkdirSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      requireWriterOrAdmin(req);
      return await (await workspaceFor(req)).mkdir(parsed.data.path);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.post('/api/files/rename', async (req, reply) => {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const ws = await workspaceFor(req);
      const safeFrom = (await resolveSafeWorkspacePathFor(ws, parsed.data.fromPath)).posixPath;
      await authorizeWrite(req, safeFrom, true);
      const result = await ws.renamePath(parsed.data.fromPath, parsed.data.toPath);
      const scope = await currentScope(req);
      if (scope) {
        await security!.locks.transferLock({
          projectId: scope.projectId,
          branch: scope.branch,
          fromPath: result.fromPath,
          toPath: result.toPath,
          user: scope.user,
        });
        if (scope.session) {
          await security!.onFileRenamed?.({
            manualId: scope.session.manualId,
            branch: scope.session.branch,
            fromPath: result.fromPath,
            toPath: result.toPath,
          });
        }
      }
      return result;
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.delete('/api/files', async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      const ws = await workspaceFor(req);
      const safePath = (await resolveSafeWorkspacePathFor(ws, query.path)).posixPath;
      await authorizeWrite(req, safePath, true);
      const result = await ws.deletePath(query.path);
      const scope = await currentScope(req);
      if (scope) {
        const lock = security!.locks.find(scope.projectId, scope.branch, safePath);
        if (lock) {
          security!.locks.release(scope.projectId, scope.branch, safePath, scope.user);
        }
      }
      return result;
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.get('/api/diagnostics', async (req, reply) => {
    const query = req.query as { rootMap?: string; branch?: string };
    try {
      const session = await sessionFor(req);
      const activeIndexer = session?.indexer ?? indexer;
      const ws = session?.workspace ?? workspace;
      const branch = query.branch ?? session?.branch ?? 'default';
      const diagnostics = activeIndexer
        ? await activeIndexer.collectDiagnostics(query.rootMap ?? null, branch)
        : await ws.collectDiagnostics(query.rootMap, resolveRequestLocale(req));
      return { diagnostics };
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });
}
