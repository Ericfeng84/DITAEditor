import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, isHttpError } from '../errors.js';
import type { WorkspaceManager } from '../files/workspace-fs.js';
import type { DitaRuntimeOptions } from '../dita-ot/dita-runtime.js';
import { detectDitaRuntime } from '../dita-ot/dita-runtime.js';
import { validateStrict } from './strict-validator.js';

const strictValidationSchema = z.object({
  paths: z.array(z.string().min(1)).max(100).optional(),
  path: z.string().min(1).optional(),
  rootMapPath: z.string().min(1).optional(),
  ditavalPath: z.string().min(1).nullable().optional(),
});

export interface StrictValidationRouteOptions {
  workspace: WorkspaceManager;
  runtime?: DitaRuntimeOptions;
  timeoutMs?: number;
}

function errorReply(reply: FastifyReply, err: unknown) {
  if (isHttpError(err)) {
    return reply.status(err.statusCode).send({ error: err.message, ...(err.details ?? {}) });
  }
  return reply
    .status(500)
    .send({ error: err instanceof Error ? err.message : '严格校验失败' });
}

export function registerStrictValidationRoutes(
  app: FastifyInstance,
  options: StrictValidationRouteOptions,
): void {
  app.get('/api/validate/runtime', async (_req, reply) => {
    try {
      const runtime = await detectDitaRuntime(options.runtime, { force: true });
      return { runtime };
    } catch (err) {
      return errorReply(reply, err);
    }
  });

  app.post('/api/validate/strict', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = strictValidationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? '参数错误' });
    }
    const { paths, path, rootMapPath, ditavalPath } = parsed.data;
    const selected = paths ?? (path ? [path] : rootMapPath ? [rootMapPath] : []);
    if (selected.length === 0) {
      return reply.status(400).send({ error: '请提供待校验的 paths、path 或 rootMapPath' });
    }
    try {
      const workDir = options.workspace.getRootDir();
      const result = await validateStrict({
        workDir,
        paths: selected,
        rootMapPath: rootMapPath ?? null,
        ditavalPath: ditavalPath ?? null,
        runtimeOptions: options.runtime,
        timeoutMs: options.timeoutMs,
      });
      if (!result.available) {
        throw new HttpError(503, result.message ?? '未检测到 DITA-OT CLI', {
          runtime: result.runtime,
        });
      }
      return result;
    } catch (err) {
      return errorReply(reply, err);
    }
  });
}
