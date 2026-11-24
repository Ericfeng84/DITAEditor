import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { IdentityService } from '../identity/identity-service.js';
import type {
  AssignmentScope,
  AssignmentService,
  AssignmentStatus,
  AssignmentStatusFilter,
} from './assignment-service.js';
import type { ManualContextResolver } from '../manuals/manual-context-resolver.js';

const statusSchema = z.enum(['pending', 'in_progress', 'done', 'cancelled']);
const scopeSchema = z.enum(['mine', 'delegated', 'all']);

const createAssignmentSchema = z.object({
  manualId: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
  topicPath: z.string().min(1),
  assigneeId: z.string().min(1),
  note: z.string().max(500).optional(),
  dueDate: z.string().max(10).nullable().optional(),
});

const updateAssignmentSchema = z.object({
  status: statusSchema.optional(),
  assigneeId: z.string().min(1).optional(),
  note: z.string().max(500).optional(),
  dueDate: z.string().max(10).nullable().optional(),
});

export interface AssignmentRouteOptions {
  assignments: AssignmentService;
  identity: IdentityService;
  context: ManualContextResolver;
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseStatusFilter(value: string | undefined): AssignmentStatusFilter | undefined {
  if (value === 'active' || value === 'all') return value;
  const parsed = statusSchema.safeParse(value);
  return parsed.success ? (parsed.data as AssignmentStatus) : undefined;
}

export function registerAssignmentRoutes(
  app: FastifyInstance,
  options: AssignmentRouteOptions,
): void {
  const { assignments, identity, context } = options;

  app.get('/api/assignments', async (req) => {
    const user = identity.resolve(req.headers['x-dita-user-id']);
    const query = req.query as Record<string, unknown>;
    const explicit = context.readExplicit(req);
    const scope = scopeSchema.safeParse(queryString(query.scope));
    return {
      assignments: await assignments.list(
        {
          scope: scope.success ? (scope.data as AssignmentScope) : 'all',
          status: parseStatusFilter(queryString(query.status)),
          manualId: queryString(query.manualId) ?? explicit.manualId,
          branch: queryString(query.branch) ?? explicit.branch,
          topicPath: queryString(query.topicPath),
        },
        user,
      ),
    };
  });

  app.get('/api/assignments/summary', async (req) => {
    const user = identity.resolve(req.headers['x-dita-user-id']);
    const query = req.query as Record<string, unknown>;
    const explicit = context.readExplicit(req);
    return {
      summary: await assignments.summary(user, {
        manualId: queryString(query.manualId) ?? explicit.manualId,
        branch: queryString(query.branch) ?? explicit.branch,
      }),
    };
  });

  app.post('/api/assignments', async (req, reply) => {
    const parsed = createAssignmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    const user = identity.resolve(req.headers['x-dita-user-id']);
    const explicit = context.readExplicit(req);
    const session = await context.resolveRequest(req);
    const manualId = parsed.data.manualId ?? explicit.manualId ?? session.manualId;
    const branch = parsed.data.branch ?? explicit.branch ?? session.branch;
    const assignment = await assignments.create(
      {
        manualId,
        branch,
        topicPath: parsed.data.topicPath,
        assigneeId: parsed.data.assigneeId,
        note: parsed.data.note,
        dueDate: parsed.data.dueDate,
      },
      user,
    );
    return { assignment };
  });

  app.patch('/api/assignments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateAssignmentSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.message });
    }
    const user = identity.resolve(req.headers['x-dita-user-id']);
    return { assignment: await assignments.update(id, parsed.data, user) };
  });

  app.delete('/api/assignments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = identity.resolve(req.headers['x-dita-user-id']);
    const query = req.query as Record<string, unknown>;
    if (queryString(query.hard) === '1' || queryString(query.hard) === 'true') {
      await assignments.delete(id, user);
      return { deleted: id };
    }
    void reply;
    return { assignment: await assignments.cancel(id, user) };
  });

  app.get('/api/assignments/manual/:manualId/topic', async (req) => {
    const { manualId } = req.params as { manualId: string };
    const query = req.query as Record<string, unknown>;
    const session = await context.resolve(manualId, queryString(query.branch));
    const topicPath = queryString(query.topicPath);
    if (!topicPath) return { assignment: null };
    return {
      assignment: await assignments.activeForTopic(
        session.manualId,
        session.branch,
        topicPath,
      ),
    };
  });
}
