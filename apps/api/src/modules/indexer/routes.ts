import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { handleWorkspaceError } from '../files/routes.js';
import type { WorkspaceSemanticIndexer } from './semantic-indexer.js';

const resolveDocumentSchema = z.object({
  filePath: z.string().min(1),
  rootMapPath: z.string().nullable().optional(),
  xml: z.string().optional(),
  branch: z.string().optional(),
});

const resolveConrefSchema = z.object({
  sourceFilePath: z.string().min(1),
  sourceTagName: z.string().min(1),
  attrName: z.enum(['conref', 'conkeyref']),
  rawValue: z.string(),
  conrefend: z.string().optional(),
  sourceTopicId: z.string().optional(),
  sourceElementId: z.string().optional(),
  rootMapPath: z.string().nullable().optional(),
  branch: z.string().optional(),
});

export function registerSemanticIndexerRoutes(
  app: FastifyInstance,
  indexer: WorkspaceSemanticIndexer,
): void {
  app.get('/api/semantics/context', async (req, reply) => {
    const query = req.query as { rootMap?: string; ditaval?: string; branch?: string };
    try {
      return await indexer.getSemanticContext(
        query.rootMap ?? null,
        query.ditaval ?? null,
        query.branch ?? 'default',
      );
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/semantics/keyspace', async (req, reply) => {
    const query = req.query as { rootMap?: string; branch?: string };
    if (!query.rootMap) {
      return reply.status(400).send({ error: 'Missing required query parameter: rootMap' });
    }
    try {
      const keyspace = await indexer.getKeyspace(query.rootMap, query.branch ?? 'default');
      if (!keyspace) {
        return reply.status(404).send({ error: `Root map not found: ${query.rootMap}` });
      }
      return { keyspace };
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/semantics/ids', async (req, reply) => {
    const query = req.query as { filePath?: string; branch?: string };
    try {
      const topics = await indexer.getTopicIndices(query.filePath, query.branch ?? 'default');
      return { topics };
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/semantics/ditaval', async (req, reply) => {
    const query = req.query as { path?: string; branch?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      const res = await indexer.getDitaval(query.path, query.branch ?? 'default');
      if (!res) {
        return reply.status(404).send({ error: `DITAVAL file not found: ${query.path}` });
      }
      if (!res.ok) {
        return reply.status(422).send({ error: res.error.message, xmlError: res.error });
      }
      return { path: query.path, ditaval: res.parsed };
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/semantics/resolve-document', async (req, reply) => {
    const parsed = resolveDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await indexer.resolveDocument({
        filePath: parsed.data.filePath,
        rootMapPath: parsed.data.rootMapPath ?? null,
        xml: parsed.data.xml,
        branch: parsed.data.branch,
      });
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.post('/api/semantics/resolve-conref', async (req, reply) => {
    const parsed = resolveConrefSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    try {
      return await indexer.resolveConref({
        sourceFilePath: parsed.data.sourceFilePath,
        sourceTagName: parsed.data.sourceTagName,
        attrName: parsed.data.attrName,
        rawValue: parsed.data.rawValue,
        conrefend: parsed.data.conrefend,
        sourceTopicId: parsed.data.sourceTopicId,
        sourceElementId: parsed.data.sourceElementId,
        rootMapPath: parsed.data.rootMapPath ?? null,
        branch: parsed.data.branch,
      });
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });
}
