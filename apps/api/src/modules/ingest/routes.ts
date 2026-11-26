/**
 * Phase 14 Stage 3 — REST + SSE surface for document ingest.
 *
 * The plugin is encapsulated so it can register its own error handler and accept large multipart
 * uploads via per-request `limits` (100 MB transport ceiling) while every other multipart route
 * keeps its own ceiling (`/api/assets/upload` stays at 10 MB).
 */

import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { apiT } from '../../i18n/messages.js';
import { resolveRequestLocale, type ApiLocale } from '../../i18n/locale.js';
import { httpError, isHttpError, localizeErrorMessage } from '../errors.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { ManualContextResolver } from '../manuals/manual-context-resolver.js';
import type { CommandRunner } from './parsers/types.js';
import type { ParserSettingsService } from './parser-settings-service.js';
import type {
  IngestJobView,
  IngestService,
  IngestStreamEvent,
  IngestTargetMode,
} from './ingest-service.js';

/** Transport ceiling for one ingest upload; the exact limit comes from `parserSettings.maxFileMb`. */
const INGEST_UPLOAD_CEILING = 100 * 1024 * 1024;
const MAX_UPLOAD_FIELDS = 40;
const SSE_HEARTBEAT_MS = 15_000;

export interface IngestRouteDeps {
  identity: IdentityService;
  settings: ParserSettingsService;
  service: IngestService;
  context: ManualContextResolver;
  /** Optional test seams for the `/config/test` runtime probe. */
  fetchImpl?: typeof fetch;
  commandRunner?: CommandRunner;
}

const targetModeSchema = z.enum(['new_manual', 'single_topic', 'multi_topic']);
const engineSchema = z.enum(['auto', 'docling', 'markitdown']);
const mapKindSchema = z.enum(['map', 'bookmap']);
const topicTypeSchema = z.enum(['concept', 'task', 'reference', 'topic', 'auto']);

const configPatchSchema = z
  .object({
    defaultEngine: engineSchema.optional(),
    preferMarkitdownForOffice: z.boolean().optional(),
    doclingMode: z.enum(['auto', 'serve', 'cli', 'off']).optional(),
    doclingServeUrl: z.string().trim().max(500).nullable().optional(),
    doclingApiKey: z.string().max(500).nullable().optional(),
    doclingCliCommand: z.string().trim().max(500).optional(),
    doclingDoOcr: z.boolean().optional(),
    doclingTableMode: z.enum(['fast', 'accurate']).optional(),
    markitdownEnabled: z.boolean().optional(),
    markitdownCliCommand: z.string().trim().max(500).optional(),
    markitdownKeepDataUris: z.boolean().optional(),
    timeoutMs: z.number().int().min(5_000).max(3_600_000).optional(),
    maxFileMb: z.number().int().min(1).max(100).optional(),
  })
  .strict();

const markdownSchema = z.object({ markdown: z.string().min(1).max(10_000_000) });

const replanSchema = z
  .object({
    language: z.string().trim().max(40).optional(),
    mapKind: mapKindSchema.optional(),
    topicType: topicTypeSchema.optional(),
    targetDir: z.string().trim().max(300).optional(),
    instruction: z.string().trim().max(4_000).optional(),
    maxTopics: z.number().int().min(1).max(200).optional(),
  })
  .strict();

const approveSchema = z.object({ plan: z.unknown().optional() }).strict();

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const uploadFieldsSchema = z.object({
  targetMode: targetModeSchema.default('new_manual'),
  engine: engineSchema.default('auto'),
  autoApprove: z
    .preprocess(
      (value) => value === true || value === 'true' || value === '1' || value === 'yes' || value === 'on',
      z.boolean(),
    )
    .default(false),
  language: z.string().trim().max(40).optional(),
  mapKind: mapKindSchema.optional(),
  topicType: topicTypeSchema.optional(),
  targetDir: z.string().trim().max(300).optional(),
  instruction: z.string().trim().max(4_000).optional(),
  maxTopics: z.coerce.number().int().min(1).max(200).optional(),
  manualName: z.string().trim().max(200).optional(),
  manualDescription: z.string().trim().max(2_000).optional(),
  manualId: z.string().trim().max(200).optional(),
  branch: z.string().trim().max(200).optional(),
  mountMapPath: z.string().trim().max(500).optional(),
  mountParentPath: z.array(z.number().int().min(0)).max(64).optional(),
});

type UploadFields = z.infer<typeof uploadFieldsSchema>;

function parseJsonField(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw httpError(400, 'ingest.invalidRequest', { message: 'mountParentPath must be JSON.' });
  }
}

/** Rejects absolute paths and `..` traversal before a workspace-relative path is trusted. */
function safeRelativePath(raw: string, locale: ApiLocale): string {
  const normalized = path.posix.normalize(raw.replace(/\\/g, '/')).replace(/^\.\//, '');
  if (
    !normalized ||
    normalized === '.' ||
    normalized.startsWith('..') ||
    normalized.startsWith('/') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw httpError(400, 'ingest.invalidRequest', {
      message: apiT(locale, 'ingest.invalidPath', { path: raw }),
    });
  }
  return normalized;
}

function requireAdmin(user: IdentityUser): void {
  if (user.role !== 'admin') throw httpError(403, 'ingest.adminOnly');
}

function jobViewFor(reply: FastifyReply, job: IngestJobView, statusCode = 200): FastifyReply {
  return reply.code(statusCode).send(job);
}

function writeEvent(reply: FastifyReply, event: IngestStreamEvent): void {
  reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function registerIngestRoutes(app: FastifyInstance, deps: IngestRouteDeps): void {
  app.register(async (scope) => {
    scope.setErrorHandler((error, req, reply) => {
      const locale = resolveRequestLocale(req);
      if (isHttpError(error)) {
        return reply
          .code(error.statusCode)
          .send({ error: localizeErrorMessage(error, locale), key: error.i18n?.key ?? null });
      }
      const name = (error as { name?: string; code?: string }).name;
      const code = (error as { code?: string }).code;
      if (name === 'RequestFileTooLargeError' || code === 'FST_REQ_FILE_TOO_LARGE') {
        return reply.code(413).send({ error: apiT(locale, 'ingest.fileTooLarge') });
      }
      if (name === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
        return reply.code(415).send({ error: apiT(locale, 'ingest.invalidUpload') });
      }
      if (typeof name === 'string' && name.startsWith('FST_ERR_CTP_')) {
        return reply.code(400).send({ error: apiT(locale, 'ingest.invalidUpload') });
      }
      if (error instanceof z.ZodError) {
        const message = error.issues
          .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
          .join('; ');
        return reply.code(400).send({ error: apiT(locale, 'ingest.invalidRequest', { message }) });
      }
      req.log.error({ err: error }, 'ingest route failed');
      return reply.code(500).send({
        error: localizeErrorMessage(error, locale),
      });
    });

    const identityFor = (req: FastifyRequest): IdentityUser =>
      deps.identity.resolve(req.headers['x-dita-user-id']);

    /* ------------------------------------------------------------------------------------ */
    /* Parser configuration                                                                  */
    /* ------------------------------------------------------------------------------------ */

    scope.get('/api/ingest/config', async (req) => {
      const user = identityFor(req);
      return deps.settings.getPublicConfig(user);
    });

    scope.put('/api/ingest/config', async (req) => {
      const user = identityFor(req);
      requireAdmin(user);
      const patch = configPatchSchema.parse(req.body ?? {});
      return deps.settings.saveConfig(patch, user);
    });

    scope.post('/api/ingest/config/test', async (req) => {
      const user = identityFor(req);
      requireAdmin(user);
      return deps.settings.detectRuntimes({
        ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
        ...(deps.commandRunner ? { commandRunner: deps.commandRunner } : {}),
      });
    });

    /* ------------------------------------------------------------------------------------ */
    /* Job creation                                                                          */
    /* ------------------------------------------------------------------------------------ */

    scope.post('/api/ingest/jobs', async (req, reply) => {
      const user = identityFor(req);
      const locale = resolveRequestLocale(req);
      if (user.role === 'viewer') throw httpError(403, 'ingest.viewerForbidden');

      const config = deps.settings.resolveConfig();
      const maxBytes = Math.max(1, config.maxFileMb) * 1024 * 1024;
      const fields = await readMultipartFields(req);
      const parsedFields = uploadFieldsSchema.parse(fields.values);

      if (fields.fileName === null) throw httpError(400, 'ingest.invalidUpload');
      if (fields.buffer.byteLength > maxBytes) {
        throw httpError(413, 'ingest.fileTooLarge', {
          maxMb: String(config.maxFileMb),
        });
      }
      const extension = extensionOf(fields.fileName);
      if (!extension) throw httpError(400, 'ingest.unsupportedFile', { ext: fields.fileName });

      const targetMode: IngestTargetMode = parsedFields.targetMode;
      let projectId: string | null = null;
      let branch: string | null = null;
      if (targetMode !== 'new_manual') {
        if (!parsedFields.manualId) throw httpError(400, 'ingest.manualRequired');
        const session = await deps.context.resolve(parsedFields.manualId, parsedFields.branch);
        projectId = session.manualId;
        branch = session.branch;
      }

      const job = await deps.service.createJob({
        user,
        locale,
        targetMode,
        sourceFilename: fields.fileName,
        extension,
        buffer: fields.buffer,
        requestedEngine: parsedFields.engine,
        autoApprove: parsedFields.autoApprove,
        options: {
          engine: parsedFields.engine,
          ...(parsedFields.language ? { language: parsedFields.language } : {}),
          ...(parsedFields.mapKind ? { mapKind: parsedFields.mapKind } : {}),
          ...(parsedFields.topicType ? { topicType: parsedFields.topicType } : {}),
          ...(parsedFields.targetDir
            ? { targetDir: safeRelativePath(parsedFields.targetDir, locale) }
            : {}),
          ...(parsedFields.instruction ? { instruction: parsedFields.instruction } : {}),
          ...(parsedFields.maxTopics ? { maxTopics: parsedFields.maxTopics } : {}),
          ...(parsedFields.manualName ? { manualName: parsedFields.manualName } : {}),
          ...(parsedFields.manualDescription
            ? { manualDescription: parsedFields.manualDescription }
            : {}),
          ...(parsedFields.mountMapPath
            ? { mountMapPath: safeRelativePath(parsedFields.mountMapPath, locale) }
            : {}),
          ...(parsedFields.mountParentPath
            ? { mountParentPath: parsedFields.mountParentPath }
            : {}),
        },
        projectId,
        branch,
      });
      return jobViewFor(reply, job, 202);
    });

    /* ------------------------------------------------------------------------------------ */
    /* Job reads                                                                             */
    /* ------------------------------------------------------------------------------------ */

    scope.get('/api/ingest/jobs', async (req) => {
      const user = identityFor(req);
      const { limit } = listSchema.parse(req.query ?? {});
      return { jobs: deps.service.listJobs(user, { ...(limit ? { limit } : {}) }) };
    });

    scope.get<{ Params: { id: string } }>('/api/ingest/jobs/:id', async (req) => {
      const user = identityFor(req);
      return deps.service.getJobForUser(req.params.id, user);
    });

    scope.get<{ Params: { id: string } }>('/api/ingest/jobs/:id/markdown', async (req) => {
      const user = identityFor(req);
      return deps.service.getMarkdown(req.params.id, user);
    });

    scope.put<{ Params: { id: string } }>('/api/ingest/jobs/:id/markdown', async (req) => {
      const user = identityFor(req);
      const { markdown } = markdownSchema.parse(req.body ?? {});
      return deps.service.updateMarkdown(req.params.id, markdown, user);
    });

    scope.get<{ Params: { id: string; assetId: string } }>(
      '/api/ingest/jobs/:id/assets/:assetId',
      async (req, reply) => {
        const user = identityFor(req);
        deps.service.getJobForUser(req.params.id, user);
        const asset = await deps.service.readAsset(req.params.id, req.params.assetId);
        return reply
          .header('content-type', asset.mediaType || 'application/octet-stream')
          .header('content-disposition', `inline; filename="${encodeURIComponent(asset.fileName)}"`)
          .header('cache-control', 'private, max-age=60')
          .send(asset.buffer);
      },
    );

    /* ------------------------------------------------------------------------------------ */
    /* Plan review actions                                                                   */
    /* ------------------------------------------------------------------------------------ */

    scope.post<{ Params: { id: string } }>('/api/ingest/jobs/:id/replan', async (req) => {
      const user = identityFor(req);
      const options = replanSchema.parse(req.body ?? {});
      return deps.service.replan(req.params.id, options, user);
    });

    scope.post<{ Params: { id: string } }>('/api/ingest/jobs/:id/approve', async (req) => {
      const user = identityFor(req);
      const { plan } = approveSchema.parse(req.body ?? {});
      return deps.service.approve(req.params.id, plan as never, user);
    });

    scope.post<{ Params: { id: string } }>('/api/ingest/jobs/:id/cancel', async (req) => {
      const user = identityFor(req);
      return deps.service.cancel(req.params.id, user);
    });

    /* ------------------------------------------------------------------------------------ */
    /* SSE                                                                                   */
    /* ------------------------------------------------------------------------------------ */

    scope.get<{ Params: { id: string } }>('/api/ingest/jobs/:id/stream', async (req, reply) => {
      const user = identityFor(req);
      const job = deps.service.getJobForUser(req.params.id, user);

      reply.hijack();
      const response = reply.raw;
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      response.write('retry: 1500\n\n');
      writeEvent(reply, { type: 'snapshot', job });

      const unsubscribe = deps.service.subscribe(req.params.id, (event) => {
        if (response.writableEnded || response.destroyed) return;
        writeEvent(reply, event);
      });
      const heartbeat = setInterval(() => {
        if (response.writableEnded || response.destroyed) return;
        response.write(': ping\n\n');
      }, SSE_HEARTBEAT_MS);
      heartbeat.unref?.();

      let cleaned = false;
      const cleanup = (): void => {
        if (cleaned) return;
        cleaned = true;
        clearInterval(heartbeat);
        unsubscribe();
      };
      req.raw.on('aborted', cleanup);
      response.on('close', cleanup);
      response.on('error', cleanup);
      if (response.writableEnded || response.destroyed) cleanup();
      return reply;
    });
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Multipart helpers                                                                          */
/* ------------------------------------------------------------------------------------------ */

interface MultipartFields {
  values: Record<string, string>;
  buffer: Buffer;
  fileName: string | null;
}

/**
 * Reads exactly one file plus its sibling text fields.
 *
 * Per-request `limits` raise the transport ceiling to {@link INGEST_UPLOAD_CEILING} without
 * touching the globally registered 10 MB multipart limit used by `/api/assets/upload`; the
 * caller then enforces `parserSettings.maxFileMb` on the actual buffer length.
 */
async function readMultipartFields(req: FastifyRequest): Promise<MultipartFields> {
  const parts = req.parts({
    limits: { fileSize: INGEST_UPLOAD_CEILING, files: 1, fields: MAX_UPLOAD_FIELDS },
  });
  const values: Record<string, string> = {};
  let buffer: Buffer | null = null;
  let fileName: string | null = null;
  let extraFile = false;

  for await (const part of parts) {
    if (part.type === 'file') {
      if (fileName !== null) {
        extraFile = true;
        // Drain the extra stream so the parser can finish cleanly.
        await part.toBuffer();
        continue;
      }
      fileName = part.filename || 'upload';
      buffer = await part.toBuffer();
      if (part.file.truncated) {
        throw httpError(413, 'ingest.fileTooLarge');
      }
      continue;
    }
    values[part.fieldname] = String(part.value);
  }

  if (extraFile) throw httpError(400, 'ingest.invalidUpload');
  if (!buffer || fileName === null) throw httpError(400, 'ingest.invalidUpload');
  return { values, buffer, fileName };
}

function extensionOf(fileName: string): string | null {
  const base = fileName.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  const ext = base.slice(dot).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/u.test(ext) ? ext : null;
}
