import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { apiT } from '../../i18n/messages.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { isHttpError, localizeErrorMessage } from '../errors.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { ReviewApplyService } from './review-apply-service.js';
import type { TranslationQueueService } from './queue-service.js';
import type { GlossaryService } from './glossary-service.js';
import type { TranslationLinkService } from './link-service.js';
import type { IncrementalSyncService } from './sync-service.js';
import {
  isTerminalJobStatus,
  type GlossaryScope,
  type GlossaryTermStatus,
  type TranslationFileKind,
  type TranslationFileStatus,
  type TranslationJobStatus,
} from './types.js';

const FILE_STATUSES = [
  'untranslated',
  'in_queue',
  'outdated',
  'outdated_metadata_only',
  'synced',
  'source_deleted',
  'source_renamed',
  'in_review',
  'draft_ready',
] as const;

const FILE_KINDS = ['topic', 'map', 'keydef_map', 'ditaval', 'asset'] as const;

const linkOptionsSchema = z
  .object({
    glossaryIds: z.array(z.string().min(1)).optional(),
    doNotTranslatePaths: z.array(z.string().min(1)).optional(),
    segmentReuse: z.boolean().optional(),
    qaStrict: z.boolean().optional(),
    /** Phase 16: independent reviewer AI round (default on). */
    aiReviewEnabled: z.boolean().optional(),
    /** Phase 16: job-level DITA-OT strict validation (default on). */
    ditaOtStrictEnabled: z.boolean().optional(),
    /** Phase 16: targeted QA repair rounds, `0..3` (default 2). */
    maxQaRepairRounds: z.number().int().min(0).max(3).optional(),
    targetLocaleStyle: z.string().max(64).optional(),
  })
  .passthrough();

const createLinkSchema = z.object({
  sourceManualId: z.string().min(1),
  sourceBranch: z.string().min(1).optional(),
  sourceLang: z.string().min(2).max(35).optional(),
  targetLang: z.string().min(2).max(35),
  targetManualId: z.string().min(1).optional(),
  targetManualName: z.string().min(1).max(120).optional(),
  targetBranch: z.string().min(1).optional(),
  createTargetManual: z.boolean().optional(),
  options: linkOptionsSchema.optional(),
});

const updateLinkSchema = z.object({
  sourceBranch: z.string().min(1).optional(),
  targetBranch: z.string().min(1).optional(),
  targetLang: z.string().min(2).max(35).optional(),
  options: linkOptionsSchema.optional(),
});

const fileFilterSchema = z.object({
  status: z.string().optional(),
  kind: z.string().optional(),
  q: z.string().optional(),
});

const syncAssetsSchema = z.object({
  paths: z.array(z.string().min(1)).max(2000).optional(),
  force: z.boolean().optional(),
});

const markSyncedSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(2000),
});

const syncPassthroughSchema = z.object({
  paths: z.array(z.string().min(1)).max(2000).optional(),
});

const resolveDeletedSchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(2000),
  action: z.enum(['stage_delete', 'keep_target']),
});

const glossaryScopeSchema = z.enum(['global', 'manual']);
const termStatusSchema = z.enum(['approved', 'draft', 'deprecated']);

const createGlossarySchema = z.object({
  scope: glossaryScopeSchema.optional(),
  manualId: z.string().min(1).nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sourceLang: z.string().min(2).max(35),
  enabled: z.boolean().optional(),
});

const updateGlossarySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  sourceLang: z.string().min(2).max(35).optional(),
  enabled: z.boolean().optional(),
});

const translationInputSchema = z.object({
  targetLang: z.string().min(2).max(35),
  targetTerm: z.string().min(1).max(500),
  forbiddenTargets: z.array(z.string().min(1).max(500)).max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const createTermSchema = z.object({
  sourceTerm: z.string().min(1).max(500),
  synonyms: z.array(z.string().min(1).max(500)).max(50).optional(),
  caseSensitive: z.boolean().optional(),
  doNotTranslate: z.boolean().optional(),
  partOfSpeech: z.string().max(64).nullable().optional(),
  contextNote: z.string().max(2000).nullable().optional(),
  status: termStatusSchema.optional(),
  translations: z.array(translationInputSchema).max(50).optional(),
});

const updateTermSchema = createTermSchema.partial().extend({
  replaceTranslations: z.boolean().optional(),
});

const importSchema = z.object({
  format: z.enum(['csv', 'json', 'tbx']),
  content: z.string().min(1),
  dryRun: z.boolean().optional(),
  targetLang: z.string().min(2).max(35).optional(),
});

const JOB_STATUSES = [
  'queued',
  'running',
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
] as const;

const createJobSchema = z.object({
  linkId: z.string().min(1),
  paths: z.array(z.string().min(1)).min(1).max(500),
  mode: z.enum(['incremental', 'full']).optional(),
  customInstruction: z.string().max(2000).optional(),
  reviewerId: z.string().min(1).optional(),
});

const listJobsSchema = z.object({
  linkId: z.string().min(1).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const assignReviewerSchema = z.object({
  reviewerId: z.string().min(1).nullable(),
});

const saveReviewSchema = z
  .object({
    segments: z
      .array(
        z.object({
          segmentId: z.string().min(1),
          proposedTargetXml: z.string(),
        }),
      )
      .max(2000)
      .optional(),
    proposedXml: z.string().optional(),
  })
  .refine(
    (value) => value.segments !== undefined || value.proposedXml !== undefined,
    { message: 'segments or proposedXml is required' },
  );

const refineSegmentSchema = z.object({
  segmentId: z.string().min(1),
  instruction: z.string().min(1).max(2000),
  currentTargetXml: z.string().optional(),
});

const batchCheckinSchema = z.object({
  paths: z.array(z.string().min(1)).max(500).optional(),
  itemIds: z.array(z.string().min(1)).max(500).optional(),
  message: z.string().min(1).max(500),
});

const batchApplyDraftSchema = z.object({
  paths: z.array(z.string().min(1)).max(2000).optional(),
  itemIds: z.array(z.string().min(1)).max(2000).optional(),
});

export interface TranslationRouteOptions {
  identity: IdentityService;
  links: TranslationLinkService;
  sync: IncrementalSyncService;
  glossaries: GlossaryService;
  /** Phase 16 Stage 3 — persistent translation queue (jobs, SSE, cancel/retry). */
  queue: TranslationQueueService;
  /** Phase 16 Stage 3 — bilingual review, AI refine and the Phase 13 draft bridge. */
  review: ReviewApplyService;
}

function handleError(req: FastifyRequest, reply: FastifyReply, err: unknown) {
  const locale = resolveRequestLocale(req);
  if (isHttpError(err)) {
    return reply.status(err.statusCode).send({
      error: localizeErrorMessage(err, locale),
      ...(err.details ?? {}),
    });
  }
  req.log.error({ err }, 'translation route failed');
  return reply.status(500).send({
    error: err instanceof Error ? err.message : apiT(locale, 'translation.scanFailed', { message: '' }),
  });
}

function invalid(req: FastifyRequest, reply: FastifyReply, issues: z.ZodError) {
  return reply.status(400).send({
    error: issues.issues[0]?.message ?? apiT(resolveRequestLocale(req), 'translation.invalidParams'),
  });
}

export function registerTranslationRoutes(
  app: FastifyInstance,
  options: TranslationRouteOptions,
): void {
  const user = (req: FastifyRequest): IdentityUser =>
    options.identity.resolve(req.headers['x-dita-user-id']);

  // ---------------------------------------------------------------------------------------------
  // Links
  // ---------------------------------------------------------------------------------------------

  app.get('/api/translation/links', async (req, reply) => {
    try {
      const query = z
        .object({ manualId: z.string().min(1).optional(), branch: z.string().min(1).optional() })
        .safeParse(req.query);
      if (!query.success) return invalid(req, reply, query.error);
      const links = await options.links.listLinks(query.data);
      return { links };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/translation/links/:linkId', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      return { link: await options.links.getLink(linkId) };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/links', async (req, reply) => {
    try {
      const parsed = createLinkSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const link = await options.links.createLink(
        parsed.data,
        user(req),
        resolveRequestLocale(req),
      );
      return reply.status(201).send({ link });
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.patch('/api/translation/links/:linkId', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = updateLinkSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return { link: await options.links.updateLink(linkId, parsed.data, user(req)) };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.delete('/api/translation/links/:linkId', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      return await options.links.deleteLink(linkId, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Incremental scan / files
  // ---------------------------------------------------------------------------------------------

  app.post('/api/translation/links/:linkId/scan', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const actor = user(req);
      // Scanning only reads HEAD and writes SQLite, but it is still a mutating endpoint.
      if (actor.role === 'viewer') {
        return reply
          .status(403)
          .send({ error: apiT(resolveRequestLocale(req), 'translation.viewerForbidden') });
      }
      return await options.sync.scanLink(linkId, actor.id);
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/translation/links/:linkId/files', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = fileFilterSchema.safeParse(req.query);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const { status, kind, q } = parsed.data;
      const files = await options.sync.listFileStates(linkId, {
        ...(status
          ? {
              status: status
                .split(',')
                .map((entry) => entry.trim())
                .filter((entry): entry is TranslationFileStatus =>
                  (FILE_STATUSES as readonly string[]).includes(entry),
                ),
            }
          : {}),
        ...(kind
          ? {
              kind: kind
                .split(',')
                .map((entry) => entry.trim())
                .filter((entry): entry is TranslationFileKind =>
                  (FILE_KINDS as readonly string[]).includes(entry),
                ),
            }
          : {}),
        ...(q ? { search: q } : {}),
      }, user(req).id);
      return { files, counts: options.sync.countLinkFiles(linkId) };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/links/:linkId/sync-assets', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = syncAssetsSchema.safeParse(req.body ?? {});
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const result = await options.sync.syncAssetsToDrafts(
        linkId,
        parsed.data.paths,
        user(req),
        { force: parsed.data.force === true },
      );
      return result;
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/links/:linkId/mark-synced', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = markSyncedSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.sync.markSynced(linkId, parsed.data.paths, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  // Phase 16 §5.1.3 — non-translatable passthrough (`.ditaval`) sync into the draft overlay.
  app.post('/api/translation/links/:linkId/sync-passthrough', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = syncPassthroughSchema.safeParse(req.body ?? {});
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.sync.syncPassthroughToDrafts(linkId, parsed.data.paths, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  // Phase 16 §5.1.3 — resolve rows whose source file was deleted upstream.
  app.post('/api/translation/links/:linkId/resolve-deleted', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = resolveDeletedSchema.safeParse(req.body ?? {});
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.sync.resolveDeletedFiles(
        linkId,
        { paths: parsed.data.paths, action: parsed.data.action },
        user(req),
      );
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Stage 3 — AI translation jobs (persistent queue + SSE progress)
  // ---------------------------------------------------------------------------------------------

  app.post('/api/translation/jobs', async (req, reply) => {
    try {
      const parsed = createJobSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const { linkId, paths, mode, customInstruction, reviewerId } = parsed.data;
      const snapshot = await options.queue.enqueueJob({
        linkId,
        paths,
        ...(mode ? { mode } : {}),
        ...(customInstruction ? { customInstruction } : {}),
        ...(reviewerId ? { reviewerId } : {}),
        user: user(req),
      });
      reply.status(201);
      return snapshot;
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/translation/jobs', async (req, reply) => {
    try {
      const parsed = listJobsSchema.safeParse(req.query);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const status = parsed.data.status as TranslationJobStatus | undefined;
      return {
        jobs: options.queue.listJobs({
          ...(parsed.data.linkId ? { linkId: parsed.data.linkId } : {}),
          ...(status ? { status } : {}),
          ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
        }),
      };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/translation/jobs/:id', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      return options.queue.getJob(id);
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  /**
   * SSE progress stream. Sends a `job.snapshot` immediately, then `item.updated` /
   * `job.updated` / `job.completed`, and closes itself once the job is terminal.
   */
  app.get('/api/translation/jobs/:id/stream', async (req, reply) => {
    let jobId: string;
    let snapshot;
    try {
      const parsed = z.object({ id: z.string().min(1) }).parse(req.params);
      jobId = parsed.id;
      snapshot = options.queue.getJob(jobId);
    } catch (err) {
      return handleError(req, reply, err);
    }

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });

    const write = (event: string, data: unknown): void => {
      raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    let unsubscribe: () => void = () => undefined;
    const heartbeat = setInterval(() => {
      if (!closed) raw.write(': ping\n\n');
    }, 15_000);
    if (typeof heartbeat.unref === 'function') heartbeat.unref();

    const close = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      req.raw.off('close', close);
      try {
        raw.end();
      } catch {
        // The socket may already be gone; nothing left to clean up.
      }
    };

    write('job.snapshot', snapshot);
    if (isTerminalJobStatus(snapshot.job.status)) {
      write('job.completed', snapshot.job);
      close();
      return reply;
    }

    unsubscribe = options.queue.subscribe(jobId, (event) => {
      if (closed) return;
      write(event.event, event.data);
      if (event.event === 'job.completed') close();
    });
    req.raw.on('close', close);
    return reply;
  });

  app.post('/api/translation/jobs/:id/cancel', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      return options.queue.cancelJob(id, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/jobs/:id/retry-failed', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      return options.queue.retryFailed(id, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Stage 3 — bilingual review, single-block refine and the Phase 13 draft bridge
  // ---------------------------------------------------------------------------------------------

  app.patch('/api/translation/items/:itemId/assign', async (req, reply) => {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.params);
      const parsed = assignReviewerSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return {
        item: options.queue.assignReviewer(itemId, parsed.data.reviewerId, user(req)),
      };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/translation/items/:itemId/review', async (req, reply) => {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.params);
      return await options.review.getReviewPayload(itemId, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.put('/api/translation/items/:itemId/review', async (req, reply) => {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.params);
      const parsed = saveReviewSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.review.saveReviewEdits(
        itemId,
        {
          ...(parsed.data.segments ? { segments: parsed.data.segments } : {}),
          ...(parsed.data.proposedXml !== undefined ? { proposedXml: parsed.data.proposedXml } : {}),
        },
        user(req),
      );
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/items/:itemId/ai-refine', async (req, reply) => {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.params);
      const parsed = refineSegmentSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.review.refineReviewSegment(
        itemId,
        {
          segmentId: parsed.data.segmentId,
          instruction: parsed.data.instruction,
          ...(parsed.data.currentTargetXml !== undefined
            ? { currentTargetXml: parsed.data.currentTargetXml }
            : {}),
        },
        user(req),
      );
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/items/:itemId/validate-strict', async (req, reply) => {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.params);
      return await options.review.validateItemStrict(itemId, user(req), resolveRequestLocale(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/items/:itemId/apply-draft', async (req, reply) => {
    try {
      const { itemId } = z.object({ itemId: z.string().min(1) }).parse(req.params);
      return await options.review.applyToDraft(itemId, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/links/:linkId/batch-apply-draft', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = batchApplyDraftSchema.safeParse(req.body ?? {});
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.review.batchApplyDrafts(
        linkId,
        {
          ...(parsed.data.paths ? { paths: parsed.data.paths } : {}),
          ...(parsed.data.itemIds ? { itemIds: parsed.data.itemIds } : {}),
        },
        user(req),
        resolveRequestLocale(req),
      );
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/translation/links/:linkId/batch-checkin', async (req, reply) => {
    try {
      const { linkId } = z.object({ linkId: z.string().min(1) }).parse(req.params);
      const parsed = batchCheckinSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return await options.review.batchCheckin(
        linkId,
        {
          ...(parsed.data.paths ? { paths: parsed.data.paths } : {}),
          ...(parsed.data.itemIds ? { itemIds: parsed.data.itemIds } : {}),
          message: parsed.data.message,
        },
        user(req),
      );
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  // ---------------------------------------------------------------------------------------------
  // Glossaries
  // ---------------------------------------------------------------------------------------------

  app.get('/api/glossaries', async (req, reply) => {
    try {
      const parsed = z
        .object({
          scope: glossaryScopeSchema.optional(),
          manualId: z.string().min(1).optional(),
          sourceLang: z.string().min(2).max(35).optional(),
        })
        .safeParse(req.query);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return {
        glossaries: options.glossaries.listGlossaries({
          ...(parsed.data.scope ? { scope: parsed.data.scope as GlossaryScope } : {}),
          ...(parsed.data.manualId ? { manualId: parsed.data.manualId } : {}),
          ...(parsed.data.sourceLang ? { sourceLang: parsed.data.sourceLang } : {}),
        }),
      };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/glossaries/effective', async (req, reply) => {
    try {
      const parsed = z
        .object({
          manualId: z.string().min(1).optional(),
          sourceLang: z.string().min(2).max(35).optional(),
          targetLang: z.string().min(2).max(35),
        })
        .safeParse(req.query);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return options.glossaries.resolveEffectiveGlossary({
        manualId: parsed.data.manualId ?? null,
        sourceLang: parsed.data.sourceLang ?? null,
        targetLang: parsed.data.targetLang,
      });
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/glossaries', async (req, reply) => {
    try {
      const parsed = createGlossarySchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const glossary = options.glossaries.createGlossary(parsed.data, user(req));
      return reply.status(201).send({ glossary });
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.patch('/api/glossaries/:id', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const parsed = updateGlossarySchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return { glossary: options.glossaries.updateGlossary(id, parsed.data, user(req)) };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.delete('/api/glossaries/:id', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      return options.glossaries.deleteGlossary(id, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/glossaries/:id', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      return { glossary: options.glossaries.getGlossary(id) };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/glossaries/:id/terms', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const parsed = z
        .object({
          q: z.string().optional(),
          status: z.string().optional(),
          targetLang: z.string().min(2).max(35).optional(),
        })
        .safeParse(req.query);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const statuses = parsed.data.status
        ?.split(',')
        .map((entry) => entry.trim())
        .filter((entry): entry is GlossaryTermStatus =>
          (['approved', 'draft', 'deprecated'] as readonly string[]).includes(entry),
        );
      return {
        terms: options.glossaries.listTerms(id, {
          ...(parsed.data.q ? { search: parsed.data.q } : {}),
          ...(statuses && statuses.length > 0 ? { status: statuses } : {}),
          ...(parsed.data.targetLang ? { targetLang: parsed.data.targetLang } : {}),
        }),
      };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/glossaries/:id/terms', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const parsed = createTermSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const term = options.glossaries.createTerm(id, parsed.data, user(req));
      return reply.status(201).send({ term });
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.patch('/api/glossaries/terms/:termId', async (req, reply) => {
    try {
      const { termId } = z.object({ termId: z.string().min(1) }).parse(req.params);
      const parsed = updateTermSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return { term: options.glossaries.updateTerm(termId, parsed.data, user(req)) };
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.delete('/api/glossaries/terms/:termId', async (req, reply) => {
    try {
      const { termId } = z.object({ termId: z.string().min(1) }).parse(req.params);
      return options.glossaries.deleteTerm(termId, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.post('/api/glossaries/:id/import', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      return options.glossaries.importGlossary(id, parsed.data, user(req));
    } catch (err) {
      return handleError(req, reply, err);
    }
  });

  app.get('/api/glossaries/:id/export', async (req, reply) => {
    try {
      const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
      const parsed = z
        .object({
          format: z.enum(['csv', 'json', 'tbx']).default('csv'),
          targetLang: z.string().min(2).max(35).optional(),
        })
        .safeParse(req.query);
      if (!parsed.success) return invalid(req, reply, parsed.error);
      const exported = options.glossaries.exportGlossary(id, {
        format: parsed.data.format,
        ...(parsed.data.targetLang ? { targetLang: parsed.data.targetLang } : {}),
      });
      reply.header('content-type', exported.contentType);
      reply.header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
      );
      return reply.send(exported.content);
    } catch (err) {
      return handleError(req, reply, err);
    }
  });
}
