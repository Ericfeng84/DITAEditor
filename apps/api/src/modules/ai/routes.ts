import { HumanMessage } from '@langchain/core/messages';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { HttpError, httpError } from '../errors.js';
import { resolveRequestLocale, type ApiLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';
import type { WorkspaceManager } from '../files/workspace-fs.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';
import type { ManualContextResolver } from '../manuals/manual-context-resolver.js';
import type { DraftService } from '../locks/draft-service.js';
import { handlePhase4Error } from '../locks/routes.js';
import type { AiModelFactory } from './ai-model-factory.js';
import type { AiServiceLogger } from './ai-service.js';
import { AiService } from './ai-service.js';
import type { AiSettingsService } from './ai-settings-service.js';
import type { AiUsageService } from './ai-usage-service.js';
import {
  aiConfigTestSchema,
  aiConfigUpdateSchema,
  aiStreamRequestSchema,
  aiUsageQuerySchema,
  type AiConfigTestResult,
  type AiStreamRequest,
} from './types.js';

export interface AiRouteDeps {
  workspace: WorkspaceManager;
  indexer: WorkspaceSemanticIndexer;
  /** Phase 10: read the target topic inside the request's manual + branch worktree. */
  context?: ManualContextResolver;
  identity: IdentityService;
  /** Phase 13: draft overlay so AI edits/context see the caller's own drafts. */
  drafts?: DraftService;
  settings: AiSettingsService;
  usage: AiUsageService;
  modelFactory: AiModelFactory;
  logger?: AiServiceLogger;
}

const CONFIG_TEST_TIMEOUT_MS = 30_000;

function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): ZodInfer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw httpError(400, 'ai.invalidUserRequest', undefined, {
      code: 'invalid-request',
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

function requireAdmin(identity: IdentityService, req: FastifyRequest) {
  const user = identity.resolve(req.headers['x-dita-user-id']);
  identity.requireRole(user, ['admin']);
  return user;
}

function failureMessage(locale: ApiLocale): string {
  return apiT(locale, 'ai.configTest.failed');
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  locale: ApiLocale,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(apiT(locale, 'ai.configTest.timeout'))),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function registerAiRoutes(app: FastifyInstance, deps: AiRouteDeps): void {
  const service = new AiService(deps);

  /** Manual + branch isolation: the AI target locator must read the caller's own worktree. */
  const serviceFor = async (req: FastifyRequest) => {
    if (!deps.context) return service;
    const session = await deps.context.resolveRequest(req);
    return new AiService({
      ...deps,
      workspace: session.workspace,
      indexer: session.indexer,
      drafts: deps.drafts,
      projectId: session.manualId,
    });
  };

  app.get('/api/ai/config', async (req, reply) => {
    try {
      const user = deps.identity.resolve(req.headers['x-dita-user-id']);
      return reply.send(deps.settings.getPublicConfig(user));
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.put('/api/ai/config', async (req, reply) => {
    try {
      const user = requireAdmin(deps.identity, req);
      const input = parseBody(aiConfigUpdateSchema, req.body);
      return reply.send(deps.settings.saveConfig(input, user));
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/ai/config/test', async (req, reply) => {
    const locale = resolveRequestLocale(req);
    try {
      requireAdmin(deps.identity, req);
      const overrides = parseBody(aiConfigTestSchema, req.body);
      // Phase 16: probe the reviewer role when asked; it inherits the primary config unless a
      // dedicated reviewer base URL / model / key is configured.
      const base =
        overrides.role === 'reviewer'
          ? deps.settings.resolveReviewerConfig()
          : deps.settings.resolveConfig();
      const config = {
        ...base,
        ...(overrides.baseUrl ? { baseUrl: overrides.baseUrl } : {}),
        ...(overrides.model ? { model: overrides.model } : {}),
        ...(overrides.apiKey ? { apiKey: overrides.apiKey } : {}),
      };
      const startedAt = Date.now();
      let result: AiConfigTestResult;
      if (!config.apiKey) {
        result = {
          ok: false,
          latencyMs: 0,
          model: config.model,
          message: apiT(locale, 'ai.configTest.noKey'),
        };
      } else {
        try {
          const model = deps.modelFactory(config);
          // A real (tiny) completion verifies the key, model name and endpoint, not just TCP reachability.
          await withTimeout(
            model.invoke([new HumanMessage('ping')]),
            CONFIG_TEST_TIMEOUT_MS,
            locale,
          );
          result = {
            ok: true,
            latencyMs: Date.now() - startedAt,
            model: config.model,
            message: apiT(locale, 'ai.configTest.ok'),
          };
        } catch {
          result = {
            ok: false,
            latencyMs: Date.now() - startedAt,
            model: config.model,
            message: failureMessage(locale),
          };
        }
      }
      return reply.send(result);
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/ai/usage', async (req, reply) => {
    try {
      requireAdmin(deps.identity, req);
      const query = parseBody(aiUsageQuerySchema, req.query ?? {});
      return reply.send(deps.usage.summary(query));
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/ai/stream', async (req, reply) => {
    let input: AiStreamRequest;
    let user: IdentityUser;
    try {
      user = deps.identity.resolve(req.headers['x-dita-user-id']);
      input = parseBody(aiStreamRequestSchema, req.body);
      const config = deps.settings.resolveConfig();
      if (!config.apiKey) {
        throw httpError(400, 'ai.notConfigured', undefined, {
          code: 'ai-not-configured',
        });
      }
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }

    const controller = new AbortController();
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.write('retry: 1500\n\n');

    let closed = false;
    const writeEvent = (event: string, data: unknown): void => {
      if (closed || response.writableEnded || response.destroyed) return;
      try {
        response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        closed = true;
      }
    };

    const heartbeat = setInterval(() => {
      if (closed || response.writableEnded || response.destroyed) return;
      try {
        response.write(': ping\n\n');
      } catch {
        closed = true;
      }
    }, 15_000);
    heartbeat.unref?.();

    // `req.raw` emits 'close' as soon as its body has been consumed, which is NOT a disconnect;
    // only 'aborted' means the client went away mid-request. The response side additionally fires
    // 'close' when a proxy drops the socket before we finish streaming.
    req.raw.on('aborted', () => {
      closed = true;
      controller.abort();
    });
    response.on('close', () => {
      if (response.writableEnded) return;
      closed = true;
      controller.abort();
    });

    const startedAt = Date.now();
    try {
      const activeService = await serviceFor(req);
      for await (const event of activeService.stream(input, user, {
          signal: controller.signal,
          locale: resolveRequestLocale(req),
        })) {
        writeEvent(event.event, event.data);
      }
    } catch (err) {
      if (!closed && !response.writableEnded) {
        const message = err instanceof Error ? err.message : String(err);
        const code =
          err instanceof HttpError && typeof err.details?.code === 'string'
            ? err.details.code
            : 'ai-failed';
        writeEvent('error', { message, code });
        writeEvent('done', {
          status: 'failed',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          durationMs: Date.now() - startedAt,
        });
      }
    } finally {
      clearInterval(heartbeat);
      if (!response.writableEnded) {
        try {
          response.end();
        } catch {
          // socket already closed by the client
        }
      }
    }
  });
}
