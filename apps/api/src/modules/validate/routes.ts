import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import type { IdentityService } from '../identity/identity-service.js';
import type { DraftService } from '../locks/draft-service.js';
import type { LockService } from '../locks/lock-service.js';

const strictValidationSchema = z.object({
  paths: z.array(z.string().min(1)).max(100).optional(),
  path: z.string().min(1).optional(),
  rootMapPath: z.string().min(1).optional(),
  ditavalPath: z.string().min(1).nullable().optional(),
  /** Phase 13: validate the caller's own drafts by default, or the clean baseline. */
  scope: z.enum(['my_drafts', 'baseline']).optional().default('my_drafts'),
});

export interface StrictValidationRouteOptions {
  workspace: WorkspaceManager;
  runtime?: DitaRuntimeOptions;
  timeoutMs?: number;
  /** Phase 10: validate inside the request's manual + branch worktree. */
  context?: ManualContextResolver;
  /** Phase 13: temp-materialize the caller's User Overlay for strict validation. */
  identity?: IdentityService;
  drafts?: DraftService;
  locks?: LockService;
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
    const { paths, path, rootMapPath, ditavalPath, scope } = parsed.data;
    const selected = paths ?? (path ? [path] : rootMapPath ? [rootMapPath] : []);
    if (selected.length === 0) {
      return reply
        .status(400)
        .send({ error: apiT(resolveRequestLocale(req), 'validate.argsRequired') });
    }
    const session = options.context ? await options.context.resolveRequest(req) : null;
    const workDir = session ? session.workDir : options.workspace.getRootDir();
    let overlayDir: string | null = null;
    try {
      let validationWorkDir = workDir;

      // Phase 13: strict validation of `my_drafts` runs on a temp materialization of the
      // User Overlay (baseline + caller's drafts) so the shared workDir stays clean at HEAD.
      if (scope === 'my_drafts' && session && options.drafts && options.identity) {
        const user = options.identity.resolve(req.headers['x-dita-user-id']);
        const projectId =
          session.manualId ||
          (options.locks ? options.locks.ensureRepository(session.projectRootDir) : '');
        if (
          projectId &&
          options.drafts.listUserDrafts(projectId, session.branch, user.id).length > 0
        ) {
          overlayDir = mkdtempSync(join(tmpdir(), 'dita-overlay-val-'));
          await options.drafts.materializeOverlayDir({
            baselineDir: workDir,
            projectId,
            branch: session.branch,
            userId: user.id,
            destDir: overlayDir,
          });
          validationWorkDir = overlayDir;
        }
      }

      const result = await validateStrict({
        workDir: validationWorkDir,
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
      return { ...result, scope };
    } catch (err) {
      return errorReply(req, reply, err);
    } finally {
      if (overlayDir) {
        rmSync(overlayDir, { recursive: true, force: true });
      }
    }
  });
}
