import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  translationFileStates,
  translationItems,
  translationJobs,
  type TranslationItemRow,
  type TranslationJobRow,
  type TranslationLinkRow,
} from '../../db/schema.js';
import { httpError, isHttpError } from '../errors.js';
import type { GitManager } from '../git/git-manager.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import type { AiTranslationOrchestrator } from './ai-translator.js';
import type {
  TranslationDitaOtValidator,
  ValidatedTranslationItem,
} from './dita-ot-validator.js';
import { readLinkRow, type TranslationLinkService } from './link-service.js';
import {
  classifyTranslationFileKind,
  isIgnoredTranslationPath,
  type IncrementalSyncService,
} from './sync-service.js';
import {
  RUNNING_ITEM_STATUSES,
  isTerminalJobStatus,
  parseAiReviewReport,
  parseDitaOtItemReport,
  parseJobValidationReport,
  type EnqueueTranslationJobInput,
  type TranslationItemStatus,
  type TranslationItemView,
  type TranslationJobFilter,
  type TranslationJobMode,
  type TranslationJobSnapshot,
  type TranslationJobStatus,
  type TranslationJobView,
  type TranslationStreamEvent,
} from './types.js';

/** Files the AI queue can translate. Assets never reach the model. */
const TRANSLATABLE_KINDS = new Set(['topic', 'map', 'keydef_map', 'ditaval']);

/** Items that count as "work finished" for the parent job's progress counters. */
const COMPLETED_ITEM_STATUSES = ['ready_for_review', 'in_review', 'approved_draft', 'checked_in'] as const;

/** A single item that failed this many times is not retried automatically again. */
const MAX_ITEM_ATTEMPTS = 3;

const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 8;

export interface TranslationQueueServiceOptions {
  db: DitaDatabase;
  git: GitManager;
  registry: ManualRegistryService;
  links: TranslationLinkService;
  sync: IncrementalSyncService;
  translator: AiTranslationOrchestrator;
  /** Phase 16: job-level DITA-OT strict validation; absent disables the `validating` stage. */
  ditaOtValidator?: TranslationDitaOtValidator;
  identity?: IdentityService;
  concurrency?: number;
  logger?: (message: string, error?: unknown) => void;
}

export type TranslationStreamListener = (event: TranslationStreamEvent) => void;

interface ResolvedQueueLink {
  link: TranslationLinkRow;
  sourceWorkDir: string;
  targetWorkDir: string | null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function assertSafePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\u0000') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw httpError(400, 'translation.invalidPath', { path: filePath });
  }
  return normalized;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A cancelled run surfaces as an abort in whichever layer noticed first. */
function isAbortLike(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function resolveConcurrency(explicit?: number): number {
  const fromEnv = Number(process.env.DITA_TRANSLATION_CONCURRENCY);
  const raw = explicit ?? (Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_CONCURRENCY);
  const rounded = Math.round(raw);
  if (!Number.isFinite(rounded)) return DEFAULT_CONCURRENCY;
  return Math.min(MAX_CONCURRENCY, Math.max(1, rounded));
}

/** Options the queue reads off the `translation_links.options_json` column. */
export interface TranslationQueueLinkOptions {
  aiReviewEnabled: boolean;
  ditaOtStrictEnabled: boolean;
  maxQaRepairRounds: number;
  qaStrict: boolean;
}

const DEFAULT_MAX_QA_REPAIR_ROUNDS = 2;

function clampRepairRounds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MAX_QA_REPAIR_ROUNDS;
  return Math.min(3, Math.max(0, Math.trunc(value)));
}

/** Reads the Phase 16 switches off a link; unknown JSON degrades to the defaults. */
export function parseLinkOptions(optionsJson: string): TranslationQueueLinkOptions {
  try {
    const parsed = JSON.parse(optionsJson) as Record<string, unknown>;
    return {
      aiReviewEnabled: parsed['aiReviewEnabled'] !== false,
      ditaOtStrictEnabled: parsed['ditaOtStrictEnabled'] !== false,
      maxQaRepairRounds: clampRepairRounds(parsed['maxQaRepairRounds']),
      qaStrict: parsed['qaStrict'] === true,
    };
  } catch {
    return {
      aiReviewEnabled: true,
      ditaOtStrictEnabled: true,
      maxQaRepairRounds: DEFAULT_MAX_QA_REPAIR_ROUNDS,
      qaStrict: false,
    };
  }
}

function toJobView(row: TranslationJobRow): TranslationJobView {
  return {
    id: row.id,
    linkId: row.linkId,
    userId: row.userId,
    mode: row.mode as TranslationJobMode,
    status: row.status as TranslationJobStatus,
    sourceCommit: row.sourceCommit,
    totalItems: row.totalItems,
    completedItems: row.completedItems,
    failedItems: row.failedItems,
    cancelRequested: row.cancelRequested === 1,
    validationReport: parseJobValidationReport(row.validationReportJson),
    createdAt: toIso(row.createdAt),
    startedAt: row.startedAt === null ? null : toIso(row.startedAt),
    finishedAt: row.finishedAt === null ? null : toIso(row.finishedAt),
  };
}

function qaCountsFromReport(reportJson: string | null): { errors: number; warnings: number } {
  if (!reportJson) return { errors: 0, warnings: 0 };
  try {
    const parsed = JSON.parse(reportJson) as { errorCount?: unknown; warningCount?: unknown };
    return {
      errors: typeof parsed.errorCount === 'number' ? parsed.errorCount : 0,
      warnings: typeof parsed.warningCount === 'number' ? parsed.warningCount : 0,
    };
  } catch {
    return { errors: 0, warnings: 0 };
  }
}

function itemView(row: TranslationItemRow): TranslationItemView {
  const qa = qaCountsFromReport(row.qaReportJson);
  const aiReview = parseAiReviewReport(row.aiReviewJson);
  const ditaOt = parseDitaOtItemReport(row.ditaOtReportJson);
  return {
    id: row.id,
    jobId: row.jobId,
    linkId: row.linkId,
    sourcePath: row.sourcePath,
    targetPath: row.targetPath,
    status: row.status as TranslationItemStatus,
    modeUsed: (row.modeUsed as TranslationJobMode | null) ?? null,
    sourceCommit: row.sourceCommit,
    prevSourceCommit: row.prevSourceCommit,
    reviewerId: row.reviewerId,
    reusedSegments: row.reusedSegments,
    translatedSegments: row.translatedSegments,
    retryCount: row.retryCount,
    error: row.error,
    qaErrorCount: qa.errors,
    qaWarningCount: qa.warnings,
    aiReviewVerdict: aiReview?.verdict ?? null,
    aiReviewErrorCount: aiReview
      ? aiReview.issues.filter((issue) => issue.severity === 'error').length
      : 0,
    aiReviewWarningCount: aiReview
      ? aiReview.issues.filter((issue) => issue.severity === 'warning').length
      : 0,
    qaRepairedCount: aiReview?.repairedSegments ?? 0,
    ditaOtStatus: ditaOt?.status ?? null,
    ditaOtErrorCount: ditaOt?.errorCount ?? 0,
    ditaOtWarningCount: ditaOt?.warningCount ?? 0,
    updatedAt: toIso(row.updatedAt),
  };
}

/**
 * Phase 16 Stage 3 — the persistent AI translation queue.
 *
 * The queue is a strict Phase 13 citizen: it never writes into a shared `workDir`, never creates a
 * worktree (`createIfMissing: false`), and never touches `file_locks`. Its only outputs are rows in
 * `translation_items` (`proposed_xml`) plus SSE progress events, so a crash can never leave a
 * half-translated baseline behind — startup recovery simply re-queues the interrupted items.
 */
export class TranslationQueueService {
  private readonly db: DitaDatabase;
  private readonly git: GitManager;
  private readonly registry: ManualRegistryService;
  private readonly links: TranslationLinkService;
  private readonly translator: AiTranslationOrchestrator;
  private readonly ditaOtValidator: TranslationDitaOtValidator | null;
  private readonly identity: IdentityService | null;
  private readonly logger: (message: string, error?: unknown) => void;
  private readonly concurrency: number;

  private readonly controllers = new Map<string, AbortController>();
  private readonly active = new Map<string, Promise<void>>();
  private readonly listeners = new Map<string, Set<TranslationStreamListener>>();
  /** Phase 16 job-level DITA-OT barrier: one run per job, plus its own abort + completion handle. */
  private readonly validatingJobs = new Set<string>();
  private readonly validationControllers = new Map<string, AbortController>();
  private readonly validationRuns = new Map<string, Promise<void>>();
  private shuttingDown = false;
  private started = false;

  constructor(options: TranslationQueueServiceOptions) {
    this.db = options.db;
    this.git = options.git;
    this.registry = options.registry;
    this.links = options.links;
    this.translator = options.translator;
    this.ditaOtValidator = options.ditaOtValidator ?? null;
    this.identity = options.identity ?? null;
    this.logger = options.logger ?? (() => undefined);
    this.concurrency = resolveConcurrency(options.concurrency);
  }

  /** Effective worker count — exposed for tests and startup logging. */
  get workerCount(): number {
    return this.concurrency;
  }

  /**
   * Startup recovery. An unclean shutdown leaves items in `ai_translating` (or `validating`);
   * those are re-queued so the next drain picks them up, and their parents are un-stuck.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.shuttingDown = false;
    const now = Date.now();
    const orphans = this.db
      .select()
      .from(translationItems)
      .where(inArray(translationItems.status, [...RUNNING_ITEM_STATUSES]))
      .all();
    // Phase 16: an item that already produced a proposal died in the DITA-OT barrier, not while
    // translating — re-translating it would throw away a reviewed proposal and burn tokens.
    const pendingValidation = new Set<string>();
    for (const orphan of orphans) {
      if (orphan.status === 'validating' && (orphan.proposedXml ?? '').trim().length > 0) {
        pendingValidation.add(orphan.jobId);
        continue;
      }
      const exhausted = orphan.retryCount >= MAX_ITEM_ATTEMPTS;
      this.db
        .update(translationItems)
        .set({
          status: exhausted ? 'failed' : 'queued',
          error: exhausted ? 'translation.interrupted' : null,
          updatedAt: now,
        })
        .where(eq(translationItems.id, orphan.id))
        .run();
      if (exhausted) {
        this.setFileStateStatus(orphan.linkId, orphan.sourcePath, 'in_review');
      } else {
        this.setFileStateStatus(orphan.linkId, orphan.sourcePath, 'in_queue');
      }
    }

    const stuckJobs = this.db
      .select()
      .from(translationJobs)
      .where(inArray(translationJobs.status, ['queued', 'running']))
      .all();
    for (const job of stuckJobs) {
      const items = this.db
        .select()
        .from(translationItems)
        .where(eq(translationItems.jobId, job.id))
        .all();
      if (items.length === 0) continue;
      const hasQueued = items.some((item) => item.status === 'queued');
      this.db
        .update(translationJobs)
        .set({
          status: job.cancelRequested === 1 ? job.status : hasQueued ? 'queued' : 'running',
        })
        .where(eq(translationJobs.id, job.id))
        .run();
    }

    this.drain();
    for (const jobId of pendingValidation) this.maybeRunJobValidation(jobId);
  }

  /** Marks the queue as shutting down, aborts in-flight work and waits for the workers. */
  async stop(): Promise<void> {
    this.shuttingDown = true;
    for (const controller of this.controllers.values()) {
      controller.abort();
    }
    for (const controller of this.validationControllers.values()) {
      controller.abort();
    }
    await Promise.allSettled([...this.active.values()]);
    await Promise.allSettled([...this.validationRuns.values()]);
    this.controllers.clear();
    this.active.clear();
    this.validationControllers.clear();
    this.validationRuns.clear();
    this.validatingJobs.clear();
    this.started = false;
  }

  /** Subscribes one SSE client to a job's progress events. */
  subscribe(jobId: string, listener: TranslationStreamListener): () => void {
    const set = this.listeners.get(jobId) ?? new Set<TranslationStreamListener>();
    set.add(listener);
    this.listeners.set(jobId, set);
    return () => {
      const current = this.listeners.get(jobId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(jobId);
    };
  }

  private broadcast(jobId: string, event: TranslationStreamEvent): void {
    const set = this.listeners.get(jobId);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(event);
      } catch (error) {
        this.logger('translation SSE listener failed', error);
      }
    }
  }

  private emitItem(row: TranslationItemRow): void {
    this.broadcast(row.jobId, { event: 'item.updated', data: itemView(row) });
  }

  private emitJob(row: TranslationJobRow, terminal = false): void {
    this.broadcast(row.id, {
      event: terminal ? 'job.completed' : 'job.updated',
      data: toJobView(row),
    });
  }

  /** Keeps `translation_file_states` aligned with the item workflow (rows may not exist yet). */
  private setFileStateStatus(linkId: string, sourcePath: string, status: string): void {
    this.db
      .update(translationFileStates)
      .set({ status, updatedAt: Date.now() })
      .where(and(eq(translationFileStates.linkId, linkId), eq(translationFileStates.sourcePath, sourcePath)))
      .run();
  }

  private requireWriter(user: IdentityUser): void {
    if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
  }

  private readJob(jobId: string): TranslationJobRow {
    const row = this.db
      .select()
      .from(translationJobs)
      .where(eq(translationJobs.id, jobId))
      .get();
    if (!row) throw httpError(404, 'translation.jobNotFound', { path: jobId });
    return row;
  }

  private readItem(itemId: string): TranslationItemRow {
    const row = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.id, itemId))
      .get();
    if (!row) throw httpError(404, 'translation.itemNotFound', { path: itemId });
    return row;
  }

  private async resolveLink(linkId: string): Promise<ResolvedQueueLink> {
    const link = readLinkRow(this.db, linkId);
    const sourceWorkDir = await this.workDirFor(link.sourceManualId, link.sourceBranch, 'translation.sourceManualMissing');
    let targetWorkDir: string | null = null;
    try {
      targetWorkDir = await this.workDirFor(link.targetManualId, link.targetBranch, 'translation.targetManualMissing');
    } catch (error) {
      // A missing target worktree only means "no T0 yet"; the job still runs.
      if (!isHttpError(error)) throw error;
    }
    return { link, sourceWorkDir, targetWorkDir };
  }

  private async workDirFor(
    manualId: string,
    branch: string,
    missingKey: 'translation.sourceManualMissing' | 'translation.targetManualMissing',
  ): Promise<string> {
    const row = await this.registry.requireRow(manualId).catch(() => {
      throw httpError(404, missingKey, { path: manualId });
    });
    const rootDir = path.resolve(row.rootDir);
    if (!existsSync(rootDir)) throw httpError(404, missingKey, { path: row.rootDir });
    if (!this.git.isRepository(rootDir)) return rootDir;
    const targetBranch = (branch ?? '').trim() || (await this.git.currentBranch(rootDir));
    return await this.git.ensureWorktree(rootDir, targetBranch, { createIfMissing: false });
  }

  /**
   * Creates a translation job plus one `queued` item per requested file and starts the workers.
   * Paths are validated against the source `HEAD` tree, so a stale UI can never enqueue a binary
   * asset or a file that does not exist.
   */
  async enqueueJob(input: EnqueueTranslationJobInput & { user: IdentityUser }): Promise<TranslationJobSnapshot> {
    this.requireWriter(input.user);
    const { link, sourceWorkDir } = await this.resolveLink(input.linkId);
    // 404s when the link vanished between the route's header read and this call.
    this.links.getLink(link.id);
    const sourceCommit = await this.git.headCommit(sourceWorkDir);
    if (!sourceCommit) throw httpError(409, 'translation.noSourceCommit', { path: link.sourceManualId });

    const requested = Array.isArray(input.paths) ? input.paths : [];
    if (requested.length === 0) throw httpError(400, 'translation.invalidParams', { field: 'paths' });

    const tree = new Map(
      (await this.git.listTreeFiles(sourceWorkDir, sourceCommit)).map((file) => [file.path, file.blobHash]),
    );

    const paths: string[] = [];
    const seen = new Set<string>();
    for (const raw of requested) {
      const sourcePath = assertSafePath(String(raw));
      if (seen.has(sourcePath)) continue;
      if (isIgnoredTranslationPath(sourcePath)) continue;
      if (!tree.has(sourcePath)) throw httpError(404, 'translation.fileNotFound', { path: sourcePath });
      const preliminary = classifyTranslationFileKind(sourcePath);
      let kind = preliminary;
      if (preliminary === 'map' || preliminary === 'keydef_map') {
        const content = await this.git.fileAtRevision(sourceWorkDir, sourceCommit, sourcePath);
        kind = classifyTranslationFileKind(sourcePath, content) ?? preliminary;
      }
      if (!kind || !TRANSLATABLE_KINDS.has(kind)) {
        throw httpError(400, 'translation.notTranslatable', { path: sourcePath });
      }
      seen.add(sourcePath);
      paths.push(sourcePath);
    }
    if (paths.length === 0) throw httpError(400, 'translation.invalidParams', { field: 'paths' });

    const mode: TranslationJobMode = input.mode === 'full' ? 'full' : 'incremental';
    const jobId = randomUUID();
    const now = Date.now();
    const optionsJson = JSON.stringify({
      ...(input.customInstruction?.trim() ? { customInstruction: input.customInstruction.trim() } : {}),
      ...(input.reviewerId ? { reviewerId: input.reviewerId } : {}),
    });

    const existingStates = new Map(
      this.db
        .select()
        .from(translationFileStates)
        .where(eq(translationFileStates.linkId, link.id))
        .all()
        .map((row) => [row.sourcePath, row] as const),
    );

    const itemRows: TranslationItemRow[] = paths.map((sourcePath) => ({
      id: randomUUID(),
      jobId,
      linkId: link.id,
      sourcePath,
      targetPath: sourcePath,
      status: 'queued' as const,
      modeUsed: null,
      sourceCommit,
      prevSourceCommit: existingStates.get(sourcePath)?.lastSourceCommit ?? null,
      reviewerId: input.reviewerId ?? null,
      proposedXml: null,
      segmentsJson: null,
      qaReportJson: null,
      aiReviewJson: null,
      ditaOtReportJson: null,
      reusedSegments: 0,
      translatedSegments: 0,
      retryCount: 0,
      error: null,
      updatedAt: now,
    }));

    this.db.transaction((tx) => {
      tx.insert(translationJobs)
        .values({
          id: jobId,
          linkId: link.id,
          userId: input.user.id,
          mode,
          status: 'queued',
          sourceCommit,
          totalItems: itemRows.length,
          completedItems: 0,
          failedItems: 0,
          optionsJson,
          validationReportJson: null,
          cancelRequested: 0,
          createdAt: now,
          startedAt: null,
          finishedAt: null,
        })
        .run();
      for (const item of itemRows) {
        tx.insert(translationItems).values(item).run();
      }
      for (const item of itemRows) {
        const existing = existingStates.get(item.sourcePath);
        if (existing) {
          tx.update(translationFileStates)
            .set({ status: 'in_queue', updatedAt: now })
            .where(eq(translationFileStates.id, existing.id))
            .run();
        } else {
          tx.insert(translationFileStates)
            .values({
              id: randomUUID(),
              linkId: link.id,
              sourcePath: item.sourcePath,
              targetPath: item.targetPath,
              fileKind: classifyTranslationFileKind(item.sourcePath) ?? 'topic',
              status: 'in_queue',
              // Nothing is translated yet, so there is no `S0` baseline to point at. Writing
              // `sourceCommit` here would make a later incremental retry (after a failed or
              // cancelled job) diff that source against itself and reuse a missing translation.
              lastSourceCommit: null,
              lastSourceBlobHash: tree.get(item.sourcePath) ?? null,
              lastSourceTranslatableHash: null,
              lastTargetCommit: null,
              lastTargetBlobHash: null,
              renamedFromPath: null,
              localizedAssetOverride: 0,
              updatedAt: now,
            })
            .run();
        }
      }
    });

    const job = this.readJob(jobId);
    const items = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.jobId, jobId))
      .all();

    this.emitJob(job);
    for (const item of items) this.emitItem(item);
    this.drain();

    return { job: toJobView(job), items: items.map(itemView) };
  }

  listJobs(filter: TranslationJobFilter = {}): TranslationJobView[] {
    const conditions = [];
    if (filter.linkId) conditions.push(eq(translationJobs.linkId, filter.linkId));
    if (filter.status) conditions.push(eq(translationJobs.status, filter.status as never));
    const limit = Math.min(200, Math.max(1, filter.limit ?? 50));
    const rows = this.db
      .select()
      .from(translationJobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(translationJobs.createdAt))
      .limit(limit)
      .all();
    return rows.map(toJobView);
  }

  getJob(jobId: string): TranslationJobSnapshot {
    const job = this.readJob(jobId);
    const items = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.jobId, jobId))
      .orderBy(asc(translationItems.updatedAt))
      .all();
    return { job: toJobView(job), items: items.map(itemView) };
  }

  /** Cancels a job: queued items flip immediately, running ones abort at their next await. */
  cancelJob(jobId: string, user: IdentityUser): TranslationJobSnapshot {
    this.requireWriter(user);
    const job = this.readJob(jobId);
    if (isTerminalJobStatus(job.status)) {
      throw httpError(409, 'translation.jobNotCancellable', { path: jobId, status: job.status });
    }
    const now = Date.now();
    this.db
      .update(translationJobs)
      .set({ cancelRequested: 1 })
      .where(eq(translationJobs.id, jobId))
      .run();

    const items = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.jobId, jobId))
      .all();
    this.validationControllers.get(jobId)?.abort();
    for (const item of items) {
      if (item.status === 'queued' || item.status === 'validating') {
        this.db
          .update(translationItems)
          .set({ status: 'cancelled', error: null, updatedAt: now })
          .where(eq(translationItems.id, item.id))
          .run();
        this.setFileStateStatus(item.linkId, item.sourcePath, 'outdated');
      }
      this.controllers.get(item.id)?.abort();
    }

    const finished = this.refreshJob(jobId);
    return {
      job: toJobView(finished),
      items: this.db
        .select()
        .from(translationItems)
        .where(eq(translationItems.jobId, jobId))
        .orderBy(asc(translationItems.updatedAt))
        .all()
        .map(itemView),
    };
  }

  /** Re-queues only the `failed` items of a job and restarts the workers. */
  retryFailed(jobId: string, user: IdentityUser): TranslationJobSnapshot {
    this.requireWriter(user);
    const job = this.readJob(jobId);
    const failed = this.db
      .select()
      .from(translationItems)
      .where(and(eq(translationItems.jobId, jobId), eq(translationItems.status, 'failed')))
      .all();
    if (failed.length === 0) throw httpError(400, 'translation.noFailedItems', { path: jobId });

    const now = Date.now();
    for (const item of failed) {
      this.db
        .update(translationItems)
        .set({ status: 'queued', error: null, updatedAt: now })
        .where(eq(translationItems.id, item.id))
        .run();
      this.setFileStateStatus(item.linkId, item.sourcePath, 'in_queue');
    }
    this.db
      .update(translationJobs)
      .set({
        status: 'queued',
        failedItems: 0,
        finishedAt: null,
        cancelRequested: job.cancelRequested,
      })
      .where(eq(translationJobs.id, jobId))
      .run();

    const refreshed = this.readJob(jobId);
    this.emitJob(refreshed);
    this.drain();
    return this.getJob(jobId);
  }

  assignReviewer(itemId: string, reviewerId: string | null, user: IdentityUser): TranslationItemView {
    this.requireWriter(user);
    const item = this.readItem(itemId);
    if (reviewerId) {
      const reviewer = this.identity?.get(reviewerId);
      if (!reviewer) throw httpError(404, 'identity.userNotFound', { path: reviewerId });
      if (reviewer.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
    }
    this.db
      .update(translationItems)
      .set({ reviewerId, updatedAt: Date.now() })
      .where(eq(translationItems.id, item.id))
      .run();
    const updated = this.readItem(itemId);
    this.emitItem(updated);
    return itemView(updated);
  }

  // ---------------------------------------------------------------- worker pool

  private drain(): void {
    if (this.shuttingDown || !this.started) return;
    while (this.active.size < this.concurrency) {
      const claimed = this.claimNextItem();
      if (!claimed) return;
      this.controllers.set(
        claimed.id,
        new AbortController(),
      );
      const run = (async () => {
        try {
          await this.processItem(claimed);
        } catch (error) {
          this.logger('translation queue item crashed', error);
        } finally {
          this.controllers.delete(claimed.id);
          this.active.delete(claimed.id);
          this.drain();
        }
      })();
      this.active.set(claimed.id, run);
    }
  }

  private claimNextItem(): TranslationItemRow | null {
    for (;;) {
      const candidate = this.db
        .select()
        .from(translationItems)
        .where(eq(translationItems.status, 'queued'))
        .orderBy(asc(translationItems.updatedAt))
        .limit(1)
        .get();
      if (!candidate) return null;
      const job = this.db
        .select()
        .from(translationJobs)
        .where(eq(translationJobs.id, candidate.jobId))
        .get();
      if (job && job.cancelRequested === 1) {
        this.db
          .update(translationItems)
          .set({ status: 'cancelled', error: null, updatedAt: Date.now() })
          .where(eq(translationItems.id, candidate.id))
          .run();
        this.setFileStateStatus(candidate.linkId, candidate.sourcePath, 'outdated');
        this.refreshJob(candidate.jobId);
        continue;
      }
      const now = Date.now();
      this.db
        .update(translationItems)
        .set({ status: 'ai_translating', error: null, updatedAt: now })
        .where(eq(translationItems.id, candidate.id))
        .run();
      this.db
        .update(translationJobs)
        .set({ status: 'running', startedAt: job?.startedAt ?? now })
        .where(eq(translationJobs.id, candidate.jobId))
        .run();
      const claimed = this.readItem(candidate.id);
      this.emitItem(claimed);
      const parent = this.readJob(claimed.jobId);
      this.emitJob(parent);
      return claimed;
    }
  }

  /** Translates one item: read `S0`/`S1`/`T0` from Git, call the orchestrator, persist the proposal. */
  private async processItem(item: TranslationItemRow): Promise<void> {
    const controller = this.controllers.get(item.id);
    const signal = controller?.signal ?? new AbortController().signal;
    try {
      const job = this.readJob(item.jobId);
      const { link, sourceWorkDir, targetWorkDir } = await this.resolveLink(item.linkId);
      const sourceCommit = item.sourceCommit ?? job.sourceCommit;
      const sourceXml = await this.git.fileAtRevision(sourceWorkDir, sourceCommit ?? 'HEAD', item.sourcePath);
      if (!sourceXml) throw httpError(404, 'translation.fileNotFound', { path: item.sourcePath });

      const prevSourceXml = item.prevSourceCommit
        ? await this.git.fileAtRevision(sourceWorkDir, item.prevSourceCommit, item.sourcePath)
        : null;
      const prevTargetXml = targetWorkDir
        ? await this.git.fileAtRevision(targetWorkDir, 'HEAD', item.targetPath)
        : null;

      const options = this.parseJobOptions(job.optionsJson);
      const linkOptions = parseLinkOptions(link.optionsJson);
      const result = await this.translator.translateDocument({
        link,
        sourcePath: item.sourcePath,
        sourceXml,
        prevSourceXml,
        prevTargetXml,
        mode: job.mode as TranslationJobMode,
        ...(options.customInstruction ? { customInstruction: options.customInstruction } : {}),
        aiReviewEnabled: linkOptions.aiReviewEnabled,
        maxQaRepairRounds: linkOptions.maxQaRepairRounds,
        onPhaseChange: (phase) => {
          // Phase 16: surface `AI 审查修复中` while the reviewer/repair loop runs.
          if (phase !== 'ai_reviewing') return;
          const changed = this.db
            .update(translationItems)
            .set({ status: 'ai_reviewing', updatedAt: Date.now() })
            .where(and(eq(translationItems.id, item.id), eq(translationItems.status, 'ai_translating')))
            .run();
          if (changed.changes > 0) this.emitItem(this.readItem(item.id));
        },
        user: this.userForJob(job),
        signal,
      });

      if (signal.aborted) throw Object.assign(new Error('translation.cancelled'), { name: 'AbortError' });

      const validatingAt = Date.now();
      this.db
        .update(translationItems)
        .set({
          status: 'validating',
          proposedXml: result.proposedXml,
          segmentsJson: JSON.stringify(result.segments),
          qaReportJson: JSON.stringify(result.qaReport),
          aiReviewJson: JSON.stringify(result.aiReview),
          ditaOtReportJson: null,
          modeUsed: result.modeUsed,
          reusedSegments: result.reusedSegments,
          translatedSegments: result.translatedSegments,
          error: result.warnings.length > 0 ? result.warnings.join('\n') : null,
          updatedAt: validatingAt,
        })
        .where(eq(translationItems.id, item.id))
        .run();
      this.emitItem(this.readItem(item.id));
      this.refreshJob(item.jobId);
      // The job-level DITA-OT barrier only starts once every item of the job stopped translating.
      this.maybeRunJobValidation(item.jobId);
    } catch (error) {
      const cancelled = signal.aborted || isAbortLike(error, signal) || (await this.jobCancelled(item.jobId));
      const now = Date.now();
      if (cancelled) {
        this.db
          .update(translationItems)
          .set({ status: 'cancelled', error: null, updatedAt: now })
          .where(eq(translationItems.id, item.id))
          .run();
        this.setFileStateStatus(item.linkId, item.sourcePath, 'outdated');
      } else {
        this.db
          .update(translationItems)
          .set({
            status: 'failed',
            error: describeError(error).slice(0, 2000),
            retryCount: item.retryCount + 1,
            updatedAt: now,
          })
          .where(eq(translationItems.id, item.id))
          .run();
        this.setFileStateStatus(item.linkId, item.sourcePath, 'outdated');
      }
      this.emitItem(this.readItem(item.id));
      this.refreshJob(item.jobId);
      this.maybeRunJobValidation(item.jobId);
    }
  }

  // ------------------------------------------------------------ job validation barrier

  /**
   * Phase 16 job barrier: DITA-OT strict validation runs **once per job**, after the last item
   * stopped translating/reviewing. Nothing is released to `ready_for_review` before that run — the
   * reviewer must never see a proposal whose DITA-OT verdict is still unknown.
   */
  private maybeRunJobValidation(jobId: string): void {
    if (this.shuttingDown) return;
    if (this.validatingJobs.has(jobId)) return;
    const items = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.jobId, jobId))
      .all();
    const busy = items.some(
      (item) =>
        item.status === 'queued' || item.status === 'ai_translating' || item.status === 'ai_reviewing',
    );
    if (busy) return;
    if (!items.some((item) => item.status === 'validating')) return;

    this.validatingJobs.add(jobId);
    const controller = new AbortController();
    this.validationControllers.set(jobId, controller);
    const run = (async () => {
      try {
        await this.runJobValidation(jobId, controller);
      } catch (error) {
        this.logger('translation job validation crashed', error);
        // Never strand items in `validating`: a crashed validation still releases the proposal.
        this.releaseValidatingItems(jobId, controller.signal.aborted ? null : describeError(error));
      } finally {
        this.validatingJobs.delete(jobId);
        this.validationControllers.delete(jobId);
        this.validationRuns.delete(jobId);
        this.drain();
      }
    })();
    this.validationRuns.set(jobId, run);
  }

  private async runJobValidation(jobId: string, controller: AbortController): Promise<void> {
    const job = this.readJob(jobId);
    const items = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.jobId, jobId))
      .all();
    if (items.some((item) => item.status === 'queued' || item.status === 'ai_translating' || item.status === 'ai_reviewing')) {
      return;
    }
    const work = items.filter(
      (item) => item.status === 'validating' && (item.proposedXml ?? '').trim().length > 0,
    );
    if (work.length === 0) {
      this.releaseValidatingItems(jobId, 'translation.ditaOtNoTargets');
      return;
    }
    if (!this.ditaOtValidator) {
      this.releaseValidatingItems(jobId, 'translation.ditaOtUnavailable');
      return;
    }

    const { link, sourceWorkDir, targetWorkDir } = await this.resolveLink(job.linkId);
    const linkOptions = parseLinkOptions(link.optionsJson);
    const jobOptions = this.parseJobOptions(job.optionsJson);
    const targets = [];
    for (const item of work) {
      let itemSourceXml = '';
      try {
        itemSourceXml =
          (await this.git.fileAtRevision(
            sourceWorkDir,
            item.sourceCommit ?? job.sourceCommit ?? 'HEAD',
            item.sourcePath,
          )) ?? '';
      } catch (error) {
        this.logger(`translation source read failed for ${item.sourcePath}`, error);
      }
      targets.push({
        itemId: item.id,
        targetPath: item.targetPath,
        proposedXml: item.proposedXml ?? '',
        sourceXml: itemSourceXml,
        segmentsJson: item.segmentsJson,
      });
    }

    const result = await this.ditaOtValidator.validateJobBatch({
      jobId,
      link,
      userId: job.userId,
      sourceWorkDir,
      targetWorkDir,
      items: targets,
      ditaOtStrictEnabled: linkOptions.ditaOtStrictEnabled,
      ...(jobOptions.customInstruction ? { customInstruction: jobOptions.customInstruction } : {}),
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;

    const byItem = new Map<string, ValidatedTranslationItem>(
      result.items.map((entry) => [entry.itemId, entry] as const),
    );
    const now = Date.now();
    this.db.transaction((tx) => {
      for (const item of work) {
        const validated = byItem.get(item.id);
        if (!validated) continue;
        tx.update(translationItems)
          .set({
            status: 'ready_for_review',
            ditaOtReportJson: JSON.stringify(validated.report),
            ...(validated.proposedXml !== undefined ? { proposedXml: validated.proposedXml } : {}),
            ...(validated.segmentsJson !== undefined ? { segmentsJson: validated.segmentsJson } : {}),
            ...(validated.qaReportJson !== undefined ? { qaReportJson: validated.qaReportJson } : {}),
            updatedAt: now,
          })
          .where(eq(translationItems.id, item.id))
          .run();
      }
      tx.update(translationJobs)
        .set({ validationReportJson: JSON.stringify(result.validationReport) })
        .where(eq(translationJobs.id, jobId))
        .run();
    });

    for (const item of work) {
      this.setFileStateStatus(item.linkId, item.sourcePath, 'in_review');
      this.emitItem(this.readItem(item.id));
    }
    this.refreshJob(jobId);
  }

  /**
   * Releases every `validating` item of a job without a DITA-OT verdict (disabled/unavailable/
   * cancelled/crashed). The proposal is preserved: Phase 16 never discards a translation, `qaStrict`
   * is what later blocks applying it.
   */
  private releaseValidatingItems(jobId: string, reasonKey: string | null): void {
    const items = this.db
      .select()
      .from(translationItems)
      .where(and(eq(translationItems.jobId, jobId), eq(translationItems.status, 'validating')))
      .all();
    if (items.length === 0) return;
    const now = Date.now();
    const report = {
      status: 'skipped',
      repaired: false,
      repairAttempts: 0,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [],
      ...(reasonKey ? { reason: reasonKey } : {}),
      stale: false,
      updatedAt: toIso(now),
    };
    this.db.transaction((tx) => {
      for (const item of items) {
        tx.update(translationItems)
          .set({
            status: 'ready_for_review',
            ditaOtReportJson: JSON.stringify(report),
            updatedAt: now,
          })
          .where(eq(translationItems.id, item.id))
          .run();
      }
      tx.update(translationJobs)
        .set({
          validationReportJson: JSON.stringify({
            status: 'skipped',
            checkedFiles: 0,
            errorFiles: 0,
            repairedFiles: 0,
            remainingErrorFiles: 0,
            durationMs: 0,
            ...(reasonKey ? { reason: reasonKey } : {}),
            updatedAt: toIso(now),
          }),
        })
        .where(eq(translationJobs.id, jobId))
        .run();
    });
    for (const item of items) {
      this.setFileStateStatus(item.linkId, item.sourcePath, 'in_review');
      this.emitItem(this.readItem(item.id));
    }
    this.refreshJob(jobId);
  }

  private async jobCancelled(jobId: string): Promise<boolean> {
    const job = this.db.select().from(translationJobs).where(eq(translationJobs.id, jobId)).get();
    return job ? job.cancelRequested === 1 : true;
  }

  private userForJob(job: TranslationJobRow): IdentityUser {
    const known = this.identity?.get(job.userId);
    if (known) return known;
    // The job outlives the identity row only in tests/fixtures; keep usage attribution intact.
    return {
      id: job.userId,
      displayName: job.userId,
      role: 'writer',
      email: '',
      color: '#64748b',
      initials: 'TR',
    };
  }

  private parseJobOptions(optionsJson: string): { customInstruction?: string; reviewerId?: string } {
    try {
      const parsed = JSON.parse(optionsJson) as { customInstruction?: unknown; reviewerId?: unknown };
      return {
        ...(typeof parsed.customInstruction === 'string' ? { customInstruction: parsed.customInstruction } : {}),
        ...(typeof parsed.reviewerId === 'string' ? { reviewerId: parsed.reviewerId } : {}),
      };
    } catch {
      return {};
    }
  }

  /** Recomputes the parent job's counters and terminal status, then broadcasts it. */
  private refreshJob(jobId: string): TranslationJobRow {
    const job = this.db.select().from(translationJobs).where(eq(translationJobs.id, jobId)).get();
    if (!job) throw httpError(404, 'translation.jobNotFound', { path: jobId });
    const items = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.jobId, jobId))
      .all();

    const isCompleted = (status: string): boolean =>
      (COMPLETED_ITEM_STATUSES as readonly string[]).includes(status);
    const isFailed = (status: string): boolean => status === 'failed';
    const isCancelled = (status: string): boolean => status === 'cancelled';
    const isRunning = (status: string): boolean => (RUNNING_ITEM_STATUSES as readonly string[]).includes(status);

    const completedItems = items.filter((item) => isCompleted(item.status)).length;
    const failedItems = items.filter((item) => isFailed(item.status)).length;
    const cancelledItems = items.filter((item) => isCancelled(item.status)).length;
    const runningItems = items.filter((item) => isRunning(item.status)).length;

    let status: TranslationJobStatus;
    let finishedAt = job.finishedAt;
    if (runningItems > 0) {
      status = 'running';
    } else if (job.cancelRequested === 1 && completedItems === 0) {
      status = 'cancelled';
      finishedAt = job.finishedAt ?? Date.now();
    } else if (completedItems > 0 && failedItems > 0) {
      status = 'completed_with_errors';
      finishedAt = job.finishedAt ?? Date.now();
    } else if (completedItems > 0) {
      status = 'completed';
      finishedAt = job.finishedAt ?? Date.now();
    } else if (failedItems > 0) {
      status = 'failed';
      finishedAt = job.finishedAt ?? Date.now();
    } else if (cancelledItems > 0) {
      status = 'cancelled';
      finishedAt = job.finishedAt ?? Date.now();
    } else {
      status = items.length === 0 ? 'completed' : 'queued';
      if (items.length === 0) finishedAt = job.finishedAt ?? Date.now();
    }

    this.db
      .update(translationJobs)
      .set({
        status,
        completedItems,
        failedItems,
        finishedAt,
      })
      .where(eq(translationJobs.id, jobId))
      .run();

    const updated = this.readJob(jobId);
    this.emitJob(updated, isTerminalJobStatus(updated.status));
    return updated;
  }
}

export { MAX_ITEM_ATTEMPTS as TRANSLATION_MAX_ITEM_ATTEMPTS };
