import { HumanMessage } from '@langchain/core/messages';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { HttpError } from '../errors.js';
import type { WorkspaceManager } from '../files/workspace-fs.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';
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
  identity: IdentityService;
  settings: AiSettingsService;
  usage: AiUsageService;
  modelFactory: AiModelFactory;
  logger?: AiServiceLogger;
}

const CONFIG_TEST_TIMEOUT_MS = 30_000;

function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): ZodInfer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new HttpError(400, '请求参数不合法。', {
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

function failureMessage(): string {
  return '连接失败，请检查 Base URL、模型名称与 API Key。';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('连接测试超时。')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function registerAiRoutes(app: FastifyInstance, deps: AiRouteDeps): void {
  const service = new AiService(deps);

  app.get('/api/ai/config', async (req, reply) => {
    try {
      const user = deps.identity.resolve(req.headers['x-dita-user-id']);
      return reply.send(deps.settings.getPublicConfig(user));
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.put('/api/ai/config', async (req, reply) => {
    try {
      const user = requireAdmin(deps.identity, req);
      const input = parseBody(aiConfigUpdateSchema, req.body);
      return reply.send(deps.settings.saveConfig(input, user));
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/ai/config/test', async (req, reply) => {
    try {
      requireAdmin(deps.identity, req);
      const overrides = parseBody(aiConfigTestSchema, req.body);
      const base = deps.settings.resolveConfig();
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
          message: 'AI 未配置 API Key。',
        };
      } else {
        try {
          const model = deps.modelFactory(config);
          // A real (tiny) completion verifies the key, model name and endpoint, not just TCP reachability.
          await withTimeout(model.invoke([new HumanMessage('ping')]), CONFIG_TEST_TIMEOUT_MS);
          result = {
            ok: true,
            latencyMs: Date.now() - startedAt,
            model: config.model,
            message: '连接成功。',
          };
        } catch {
          result = {
            ok: false,
            latencyMs: Date.now() - startedAt,
            model: config.model,
            message: failureMessage(),
          };
        }
      }
      return reply.send(result);
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/ai/usage', async (req, reply) => {
    try {
      requireAdmin(deps.identity, req);
      const query = parseBody(aiUsageQuerySchema, req.query ?? {});
      return reply.send(deps.usage.summary(query));
    } catch (err) {
      return handlePhase4Error(err, reply);
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
        throw new HttpError(400, 'AI 未配置 API Key，请管理员先在 AI 设置中配置。', {
          code: 'ai-not-configured',
        });
      }
    } catch (err) {
      return handlePhase4Error(err, reply);
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
      for await (const event of service.stream(input, user, { signal: controller.signal })) {
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
