import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { localizeErrorMessage } from '../errors.js';
import type { IdentityService } from '../identity/identity-service.js';
import type { ManualContextResolver } from './manual-context-resolver.js';
import type { ManualRegistryService } from './manual-registry-service.js';
import type { WorkspaceScaffold } from '../files/workspace-fs.js';

const createManualSchema = z.object({
  mode: z.enum(['create', 'import', 'attach']).optional(),
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  rootDir: z.string().trim().min(1).optional(),
  parentDir: z.string().trim().min(1).optional(),
  scaffold: z.enum(['blank', 'starter']).optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string(),
        encoding: z.enum(['utf8', 'base64']).optional(),
      }),
    )
    .optional(),
  initGit: z.boolean().optional(),
});

const updateManualSchema = z.object({
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  defaultRootMap: z.string().trim().nullable().optional(),
  archived: z.boolean().optional(),
});

export interface ManualRouteOptions {
  registry: ManualRegistryService;
  resolver: ManualContextResolver;
  identity: IdentityService;
}

function flag(value: unknown): boolean {
  return value === true || value === '1' || value === 'true';
}

export function registerManualRoutes(app: FastifyInstance, options: ManualRouteOptions): void {
  const { registry, resolver, identity } = options;

  app.get('/api/manuals', async (req, reply) => {
    try {
      const user = identity.resolve(req.headers['x-dita-user-id']);
      const query = req.query as Record<string, unknown>;
      const snapshot = await registry.list({
        userId: user.id,
        includeArchived: flag(query.includeArchived),
        query: typeof query.q === 'string' ? query.q : undefined,
      });
      const activeManualId =
        resolver.getActiveManualId() ?? (await registry.findMostRecent())?.id ?? null;
      return { ...snapshot, activeManualId };
    } catch (err) {
      const locale = resolveRequestLocale(req);
      reply.code(500);
      return { message: localizeErrorMessage(err, locale) };
    }
  });

  app.get('/api/manuals/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { manual: await registry.get(id) };
  });

  app.post('/api/manuals', async (req, reply) => {
    const locale = resolveRequestLocale(req);
    const user = identity.resolve(req.headers['x-dita-user-id']);
    const parsed = createManualSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    const manual = await registry.create(
      {
        mode: parsed.data.mode ?? 'create',
        name: parsed.data.name,
        description: parsed.data.description,
        rootDir: parsed.data.rootDir,
        parentDir: parsed.data.parentDir,
        scaffold: parsed.data.scaffold as WorkspaceScaffold | undefined,
        files: parsed.data.files,
        initGit: parsed.data.initGit,
      },
      user,
      locale,
    );
    resolver.setActiveManual(manual.id);
    return { manual };
  });

  app.patch('/api/manuals/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = identity.resolve(req.headers['x-dita-user-id']);
    const parsed = updateManualSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    const manual = await registry.update(id, parsed.data, user);
    if (manual.archived) resolver.invalidateManual(id);
    return { manual };
  });

  app.post('/api/manuals/:id/touch', async (req) => {
    const { id } = req.params as { id: string };
    const manual = await registry.touch(id);
    resolver.setActiveManual(manual.id);
    return { manual };
  });

  app.delete('/api/manuals/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = identity.resolve(req.headers['x-dita-user-id']);
    await registry.remove(id, user);
    resolver.invalidateManual(id);
    const snapshot = await registry.list({ userId: user.id });
    reply.code(200);
    return { removed: id, manuals: snapshot.manuals };
  });
}
