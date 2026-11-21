import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';
import {
  WorkspaceConflictError,
  WorkspaceNotFoundError,
  WorkspacePathError,
  type WorkspaceManager,
} from './workspace-fs.js';

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

export function handleWorkspaceError(err: unknown, reply: FastifyReply) {
  if (
    err instanceof WorkspacePathError ||
    err instanceof WorkspaceNotFoundError ||
    err instanceof WorkspaceConflictError
  ) {
    return reply.status(err.statusCode).send({ error: err.message });
  }
  throw err;
}

export function registerWorkspaceFileRoutes(
  app: FastifyInstance,
  workspace: WorkspaceManager,
  indexer?: WorkspaceSemanticIndexer,
): void {
  app.get('/api/workspace', async (_req, reply) => {
    try {
      return await workspace.scanWorkspace();
    } catch (err) {
      return handleWorkspaceError(err, reply);
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
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/workspace/import', async (req, reply) => {
    const parsed = importWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await workspace.importBatchFiles(parsed.data.projectName, parsed.data.files);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/workspaces', async (_req, reply) => {
    try {
      return await workspace.listWorkspaces();
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/workspaces/create', async (req, reply) => {
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await workspace.createWorkspace(parsed.data);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/workspaces/forget', async (req, reply) => {
    const parsed = forgetWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return { workspaces: await workspace.forgetWorkspace(parsed.data.path) };
    } catch (err) {
      return handleWorkspaceError(err, reply);
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
      return handleWorkspaceError(err, reply);
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
      return handleWorkspaceError(err, reply);
    }
  });

  app.put('/api/files/content', async (req, reply) => {
    const parsed = writeFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await workspace.writeFile(
        parsed.data.path,
        parsed.data.content,
        parsed.data.createDirs ?? true,
      );
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/files/create', async (req, reply) => {
    const parsed = createFileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await workspace.createFromTemplate(parsed.data);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/files/mkdir', async (req, reply) => {
    const parsed = mkdirSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await workspace.mkdir(parsed.data.path);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/files/rename', async (req, reply) => {
    const parsed = renameSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await workspace.renamePath(parsed.data.fromPath, parsed.data.toPath);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.delete('/api/files', async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      return await workspace.deletePath(query.path);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/diagnostics', async (req, reply) => {
    const query = req.query as { rootMap?: string; branch?: string };
    try {
      const diagnostics = indexer
        ? await indexer.collectDiagnostics(query.rootMap ?? null, query.branch ?? 'default')
        : await workspace.collectDiagnostics(query.rootMap);
      return { diagnostics };
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });
}
