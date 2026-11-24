import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, httpError, isHttpError, localizeErrorMessage } from '../errors.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';
import type { WorkspaceManager } from '../files/workspace-fs.js';
import type { DitaRuntimeOptions } from '../dita-ot/dita-runtime.js';
import { detectDitaRuntime } from '../dita-ot/dita-runtime.js';
import { validateStrict } from './strict-validator.js';
import type { ManualContextResolver } from '../manuals/manual-context-resolver.js';

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
  /** Phase 10: validate inside the request's manual + branch worktree. */
  context?: ManualContextResolver;
}

function errorReply(req: FastifyRequest, reply: FastifyReply, err: unknown) {
  const locale = resolveRequestLocale(req);
  if (isHttpError(err)) {
    return reply.status(err.statusCode).send({
      error: localizeErrorMessage(err, locale),
      ...(err.details ?? {}),
    });
  }
  return reply
    .status(500)
    .send({ error: err instanceof Error ? err.message : apiT(locale, 'validate.failed') });
}

export function registerStrictValidationRoutes(
  app: FastifyInstance,
  options: StrictValidationRouteOptions,
): void {
  app.get('/api/validate/runtime', async (_req, reply) => {
    try {
      const runtime = await detectDitaRuntime(options.runtime, {
        force: true,
        locale: resolveRequestLocale(_req),
      });
      return { runtime };
    } catch (err) {
      return errorReply(_req, reply, err);
    }
  });

  app.post('/api/validate/strict', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = strictValidationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? apiT(resolveRequestLocale(req), 'validate.invalidParams'),
      });
    }
    const { paths, path, rootMapPath, ditavalPath } = parsed.data;
    const selected = paths ?? (path ? [path] : rootMapPath ? [rootMapPath] : []);
    if (selected.length === 0) {
      return reply
        .status(400)
        .send({ error: apiT(resolveRequestLocale(req), 'validate.argsRequired') });
    }
    try {
      const workDir = options.context
        ? (await options.context.resolveRequest(req)).workDir
        : options.workspace.getRootDir();
      const result = await validateStrict({
        workDir,
        paths: selected,
        rootMapPath: rootMapPath ?? null,
        ditavalPath: ditavalPath ?? null,
        runtimeOptions: options.runtime,
        timeoutMs: options.timeoutMs,
        locale: resolveRequestLocale(req),
      });
      if (!result.available) {
        throw httpError(503, 'validate.noCliShort', undefined, {
          runtime: result.runtime,
        });
      }
      return result;
    } catch (err) {
      return errorReply(req, reply, err);
    }
  });
}
