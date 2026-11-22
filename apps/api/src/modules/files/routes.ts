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
} from './workspace-fs.js';

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

  const authorizeWrite = async (req: FastifyRequest, relPath: string, exists: boolean) => {
    if (!security) return;
    const user = security.identity.resolve(req.headers['x-dita-user-id']);
    await security.locks.authorizeWrite({
      workDir: workspace.getRootDir(),
      projectRootDir: workspace.getProjectRootDir(),
      filePath: relPath,
      user,
      exists,
    });
  };

  const currentScope = async (req: FastifyRequest) => {
    if (!security) return null;
    const user = security.identity.resolve(req.headers['x-dita-user-id']);
    const projectRootDir = workspace.getProjectRootDir();
    const projectId = security.locks.ensureRepository(projectRootDir);
    const branch = await security.locks.currentBranch(workspace.getRootDir());
    return { user, projectId, branch, workDir: workspace.getRootDir() };
  };
  app.get('/api/workspace', async (_req, reply) => {
    try {
      return await workspace.scanWorkspace();
    } catch (err) {
      return handleWorkspaceError(err, _req, reply);
    }
  });

  app.post('/api/workspace/open', async (req, reply) => {
    const parsed = openWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      const target = 'useDefault' in parsed.data ? { useDefault: true as const } : parsed.data.rootDir;
      return await workspace.openWorkspace(target);
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
      return await workspace.importBatchFiles(parsed.data.projectName, parsed.data.files);
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
      return await workspace.createWorkspace({
        ...parsed.data,
        locale: resolveRequestLocale(req),
      });
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
      return { workspaces: await workspace.forgetWorkspace(parsed.data.path) };
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.get('/api/files/tree', async (_req, reply) => {
    try {
      const snapshot = await workspace.scanWorkspace();
      return {
        rootDir: snapshot.rootDir,
        files: snapshot.files,
        maps: snapshot.maps,
        topicTitles: snapshot.topicTitles,
      };
    } catch (err) {
      return handleWorkspaceError(err, _req, reply);
    }
  });

  app.get('/api/files/content', async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      return await workspace.readFile(query.path);
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
      const safePath = (await resolveSafeWorkspacePathFor(workspace, parsed.data.path)).posixPath;
      await authorizeWrite(req, safePath, await workspace.fileExists(safePath));
      return await workspace.writeFile(
        parsed.data.path,
        parsed.data.content,
        parsed.data.createDirs ?? true,
      );
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
      const exists = await workspace.fileExists(parsed.data.path);
      if (!exists || parsed.data.overwrite) {
        const safePath = (await resolveSafeWorkspacePathFor(workspace, parsed.data.path)).posixPath;
        await authorizeWrite(req, safePath, exists);
      }
      return await workspace.createFromTemplate(parsed.data);
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
      return await workspace.mkdir(parsed.data.path);
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
      const safeFrom = (await resolveSafeWorkspacePathFor(workspace, parsed.data.fromPath)).posixPath;
      await authorizeWrite(req, safeFrom, true);
      const result = await workspace.renamePath(parsed.data.fromPath, parsed.data.toPath);
      const scope = await currentScope(req);
      if (scope) {
        await security!.locks.transferLock({
          projectId: scope.projectId,
          branch: scope.branch,
          fromPath: result.fromPath,
          toPath: result.toPath,
          user: scope.user,
        });
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
      const safePath = (await resolveSafeWorkspacePathFor(workspace, query.path)).posixPath;
      await authorizeWrite(req, safePath, true);
      const result = await workspace.deletePath(query.path);
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
      const diagnostics = indexer
        ? await indexer.collectDiagnostics(query.rootMap ?? null, query.branch ?? 'default')
        : await workspace.collectDiagnostics(query.rootMap, resolveRequestLocale(req));
      return { diagnostics };
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });
}
