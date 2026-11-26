/**
 * Phase 14 Stage 3 — queue-backed document ingest orchestration.
 *
 * A job moves through a deterministic state machine persisted in `ingest_jobs`:
 *
 * ```
 * queued ─▶ parsing ─▶ planning ─┬▶ awaiting_plan_approval ─(approve)─┐
 *                                └▶ writing ◀──────────────────────────┘
 * writing ─▶ validating ─▶ repairing ─▶ materializing ─▶ succeeded
 * ```
 *
 * Phase A (parse + plan) always writes `parsed.md` / `assets_json` / `plan_json` before the
 * optional human approval pause; Phase B (write + Layer 1/2 + materialize) can therefore be
 * re-entered from the stored plan. Staging lives in `<ingestRootDir>/<jobId>/`, so a job never
 * touches a shared work tree until the materializer runs.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import {
  DitaSemanticIndex,
  normalizePlanPaths,
  parseMarkdownOutline,
  type DitaMapTemplateType,
  type DitaTopicTemplateType,
  type ExtractedIngestAsset,
  type IngestJobProgress,
  type IngestJobResult,
  type IngestJobStatus,
  type IngestOutlinePlan,
  type IngestTopicProgress,
  type IngestValidationReport,
  type MarkdownSection,
} from '@dita/core';
import type { IngestEngineChoice } from '@dita/core';
import type { DitaDatabase } from '../../db/client.js';
import { ingestJobs, type IngestJobRow } from '../../db/schema.js';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import { httpError, localizeErrorMessage } from '../errors.js';
import type { AiModelFactory } from '../ai/ai-model-factory.js';
import type { AiSettingsService } from '../ai/ai-settings-service.js';
import type { AiUsageService } from '../ai/ai-usage-service.js';
import type { DitaRuntimeOptions } from '../dita-ot/dita-runtime.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { WorkspaceFileNode } from '../files/workspace-fs.js';
import type { DraftService } from '../locks/draft-service.js';
import type { LockService } from '../locks/lock-service.js';
import type { ManualContextResolver, ManualSession } from '../manuals/manual-context-resolver.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import type { GitManager } from '../git/git-manager.js';
import type { GeneratedTopicArtifact, IngestStrictValidator } from './agent/types.js';
import {
  draftAndVerifyTopic,
  planDocumentOutline,
  runWithConcurrency,
  validateAndRepairBatch,
  type IngestAgentCallbacks,
  type IngestAgentDeps,
  type ValidateBatchResult,
} from './agent/index.js';
import {
  collectExistingPaths,
  defaultAssetPlacements,
  materializeIntoExistingManual,
  materializeNewManual,
  resolveExistingManualAssetPlacements,
  type IngestAssetPlacement,
  type MaterializerDeps,
} from './materializer.js';
import { parseDocumentToMarkdown } from './parsers/parser-router.js';
import type { ParseDocumentInput, ParsedDocumentOutput } from './parsers/types.js';
import type { ParserSettingsService } from './parser-settings-service.js';

export type IngestTargetMode = 'new_manual' | 'single_topic' | 'multi_topic';

const NON_TERMINAL_STATUSES: IngestJobStatus[] = [
  'queued',
  'parsing',
  'planning',
  'awaiting_plan_approval',
  'writing',
  'validating',
  'repairing',
  'materializing',
];

const TERMINAL_STATUSES: IngestJobStatus[] = ['succeeded', 'failed', 'cancelled'];

const ACTIVE_STATUSES: IngestJobStatus[] = [
  'queued',
  'parsing',
  'planning',
  'writing',
  'validating',
  'repairing',
  'materializing',
];

/** Everything the wizard may tune for one import. Persisted in `ingest_jobs.options_json`. */
export interface IngestJobOptions {
  engine: IngestEngineChoice;
  language?: string;
  mapKind?: DitaMapTemplateType;
  topicType?: DitaTopicTemplateType | 'auto';
  targetDir?: string;
  instruction?: string;
  maxTopics?: number;
  manualName?: string;
  manualDescription?: string;
  mountMapPath?: string | null;
  mountParentPath?: number[] | null;
  /** Request locale persisted with the job so stored errors match the caller's UI. */
  locale?: ApiLocale;
}

export interface CreateIngestJobInput {
  user: IdentityUser;
  locale: ApiLocale;
  targetMode: IngestTargetMode;
  sourceFilename: string;
  extension: string;
  buffer: Buffer;
  requestedEngine: IngestEngineChoice;
  autoApprove: boolean;
  options: IngestJobOptions;
  /** Existing-manual targets: resolved by `ManualContextResolver` in the route. */
  projectId?: string | null;
  branch?: string | null;
}

export interface IngestJobView {
  id: string;
  targetMode: IngestTargetMode;
  projectId: string | null;
  branch: string | null;
  userId: string;
  sourceFilename: string;
  sourceExt: string;
  sourceSize: number;
  requestedEngine: IngestEngineChoice;
  engineUsed: string | null;
  status: IngestJobStatus;
  autoApprove: boolean;
  options: IngestJobOptions;
  assets: ExtractedIngestAsset[];
  plan: IngestOutlinePlan | null;
  progress: IngestJobProgress | null;
  validation: IngestValidationReport | null;
  result: IngestJobResult | null;
  createdManualId: string | null;
  error: string | null;
  cancelRequested: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface IngestMarkdownView {
  jobId: string;
  status: IngestJobStatus;
  markdown: string;
  sections: MarkdownSection[];
  assets: ExtractedIngestAsset[];
  plan: IngestOutlinePlan | null;
}

export interface ReplanOptions {
  language?: string;
  mapKind?: DitaMapTemplateType;
  topicType?: DitaTopicTemplateType | 'auto';
  targetDir?: string;
  instruction?: string;
  maxTopics?: number;
}

export type IngestStreamEvent =
  | { type: 'snapshot'; job: IngestJobView }
  | { type: 'status'; status: IngestJobStatus; progress: IngestJobProgress | null; message?: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | {
      type: 'plan_ready';
      plan: IngestOutlinePlan;
      assets: ExtractedIngestAsset[];
      warnings: string[];
    }
  | { type: 'topic_progress'; topic: IngestTopicProgress }
  | { type: 'validation'; report: IngestValidationReport }
  | { type: 'done'; job: IngestJobView }
  | { type: 'error'; message: string }
  | { type: 'cancelled'; job: IngestJobView };

export type IngestStreamListener = (event: IngestStreamEvent) => void;

export interface IngestServiceOptions {
  db: DitaDatabase;
  settings: ParserSettingsService;
  aiSettings: AiSettingsService;
  aiUsage: AiUsageService;
  modelFactory: AiModelFactory;
  git: GitManager;
  registry: ManualRegistryService;
  context: ManualContextResolver;
  identity: IdentityService;
  drafts: DraftService;
  locks: LockService;
  importsRootDir: string;
  ingestRootDir?: string;
  concurrency?: number;
  writerConcurrency?: number;
  retentionDays?: number;
  ditaRuntime?: DitaRuntimeOptions;
  strictValidator?: IngestStrictValidator;
  fetchImpl?: typeof fetch;
  commandRunner?: ParseDocumentInput['commandRunner'];
  parseDocumentOverride?: (input: ParseDocumentInput) => Promise<ParsedDocumentOutput>;
  logger?: (message: string, error?: unknown) => void;
}

/** In-memory state that cannot survive a restart (queue slot, abort controller, SSE fans). */
interface JobRuntime {
  controller: AbortController;
  phase: 'A' | 'B';
}

interface PendingJob {
  jobId: string;
  phase: 'A' | 'B';
}

type IngestJobPatch = Partial<typeof ingestJobs.$inferInsert>;

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toIso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function isTerminal(status: IngestJobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === 'object' && (error as { name?: string }).name === 'AbortError') return true;
  if (typeof error === 'object' && (error as { name?: string }).name === 'IngestAgentAbortedError') {
    return true;
  }
  const code = (error as { code?: string }).code;
  return code === 'cancelled';
}

/** Default job options merged with the wizard payload, so stored rows are always complete. */
export function normalizeIngestOptions(input: Partial<IngestJobOptions>): IngestJobOptions {
  const options: IngestJobOptions = { engine: input.engine ?? 'auto' };
  if (input.language) options.language = input.language;
  if (input.mapKind) options.mapKind = input.mapKind;
  if (input.topicType) options.topicType = input.topicType;
  if (input.targetDir) options.targetDir = input.targetDir;
  if (input.instruction) options.instruction = input.instruction;
  if (typeof input.maxTopics === 'number' && Number.isFinite(input.maxTopics)) {
    options.maxTopics = input.maxTopics;
  }
  if (input.manualName) options.manualName = input.manualName;
  if (input.manualDescription) options.manualDescription = input.manualDescription;
  if (input.mountMapPath) options.mountMapPath = input.mountMapPath;
  if (Array.isArray(input.mountParentPath) && input.mountParentPath.length > 0) {
    options.mountParentPath = [...input.mountParentPath];
  }
  if (input.locale) options.locale = input.locale;
  return options;
}

export class IngestService {
  private readonly db: DitaDatabase;
  private readonly settings: ParserSettingsService;
  private readonly git: GitManager;
  private readonly registry: ManualRegistryService;
  private readonly context: ManualContextResolver;
  private readonly identity: IdentityService;
  private readonly drafts: DraftService;
  private readonly locks: LockService;
  private readonly importsRootDir: string;
  private readonly ingestRootDir: string;
  private readonly concurrency: number;
  private readonly writerConcurrency: number;
  private readonly retentionDays: number;
  private readonly agentDeps: IngestAgentDeps;
  private readonly materializerDeps: MaterializerDeps;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly commandRunner: ParseDocumentInput['commandRunner'];
  private readonly parseDocument: (input: ParseDocumentInput) => Promise<ParsedDocumentOutput>;
  private readonly logger: (message: string, error?: unknown) => void;

  private readonly pending: PendingJob[] = [];
  private readonly runtimes = new Map<string, JobRuntime>();
  private readonly listeners = new Map<string, Set<IngestStreamListener>>();
  private running = 0;
  private stopped = false;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: IngestServiceOptions) {
    this.db = options.db;
    this.settings = options.settings;
    this.git = options.git;
    this.registry = options.registry;
    this.context = options.context;
    this.identity = options.identity;
    this.drafts = options.drafts;
    this.locks = options.locks;
    this.importsRootDir = options.importsRootDir;
    this.ingestRootDir = path.resolve(
      options.ingestRootDir ??
        process.env.DITA_INGEST_DIR ??
        path.join(options.importsRootDir, 'ingest'),
    );
    this.concurrency = Math.max(
      1,
      (options.concurrency ?? Number(process.env.DITA_INGEST_CONCURRENCY ?? 1)) || 1,
    );
    this.writerConcurrency = Math.max(1, options.writerConcurrency ?? 2);
    this.retentionDays = Math.max(0, options.retentionDays ?? 7);
    this.fetchImpl = options.fetchImpl;
    this.commandRunner = options.commandRunner;
    this.parseDocument = options.parseDocumentOverride ?? parseDocumentToMarkdown;
    this.logger = options.logger ?? (() => undefined);
    this.agentDeps = {
      settings: options.aiSettings,
      usage: options.aiUsage,
      modelFactory: options.modelFactory,
      ...(options.ditaRuntime ? { ditaRuntime: options.ditaRuntime } : {}),
      ...(options.strictValidator ? { strictValidator: options.strictValidator } : {}),
    };
    this.materializerDeps = {
      git: options.git,
      registry: options.registry,
      drafts: options.drafts,
      locks: options.locks,
      importsRootDir: options.importsRootDir,
    };
  }

  get rootDir(): string {
    return this.ingestRootDir;
  }

  stagingDirFor(jobId: string): string {
    return path.join(this.ingestRootDir, jobId);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Lifecycle                                                                                */
  /* ---------------------------------------------------------------------------------------- */

  async start(): Promise<void> {
    // A process restart kills the queue and every parser child process, so resurrecting a
    // half-done job is impossible: mark stale rows failed with a clear, localized message.
    const interrupted = this.db
      .select()
      .from(ingestJobs)
      .where(inArray(ingestJobs.status, NON_TERMINAL_STATUSES))
      .all();
    for (const job of interrupted) {
      const locale = this.localeForRow(job);
      this.db
        .update(ingestJobs)
        .set({
          status: 'failed',
          error: apiT(locale, 'ingest.interrupted'),
          finishedAt: Date.now(),
        })
        .where(eq(ingestJobs.id, job.id))
        .run();
    }
    await this.pruneExpiredJobs();
    if (this.retentionDays > 0) {
      this.cleanupTimer = setInterval(() => {
        void this.pruneExpiredJobs().catch((error) => this.logger('ingest prune failed', error));
      }, 6 * 60 * 60 * 1000);
      this.cleanupTimer.unref?.();
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const runtime of this.runtimes.values()) {
      runtime.controller.abort();
    }
    this.pending.length = 0;
  }

  /** Deletes terminal jobs (and their staging folders) older than the retention window. */
  async pruneExpiredJobs(retentionDays = this.retentionDays): Promise<void> {
    if (!existsSync(this.ingestRootDir)) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    if (retentionDays > 0) {
      const expired = this.db
        .select()
        .from(ingestJobs)
        .where(and(inArray(ingestJobs.status, TERMINAL_STATUSES), lt(ingestJobs.createdAt, cutoff)))
        .all();
      for (const job of expired) {
        this.db.delete(ingestJobs).where(eq(ingestJobs.id, job.id)).run();
      }
    }
    const known = new Set(
      this.db
        .select({ id: ingestJobs.id })
        .from(ingestJobs)
        .all()
        .map((row) => row.id),
    );
    const entries = await fs.readdir(this.ingestRootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || known.has(entry.name)) continue;
      await fs
        .rm(path.join(this.ingestRootDir, entry.name), { recursive: true, force: true })
        .catch(() => undefined);
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Job creation & listing                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  async createJob(input: CreateIngestJobInput): Promise<IngestJobView> {
    const locale = input.locale;
    if (input.user.role === 'viewer') {
      throw httpError(403, 'ingest.viewerForbidden');
    }
    const options = normalizeIngestOptions({
      ...input.options,
      engine: input.requestedEngine,
      locale,
    });
    const id = `ing-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const stagingDir = this.stagingDirFor(id);
    await fs.mkdir(path.join(stagingDir, 'assets'), { recursive: true });
    await fs.mkdir(path.join(stagingDir, 'staged'), { recursive: true });
    const sourcePath = path.join(stagingDir, `source${input.extension}`);
    await fs.writeFile(sourcePath, input.buffer);

    const now = Date.now();
    this.db
      .insert(ingestJobs)
      .values({
        id,
        targetMode: input.targetMode,
        projectId: input.projectId ?? null,
        branch: input.branch ?? null,
        userId: input.user.id,
        sourceFilename: input.sourceFilename,
        sourceExt: input.extension,
        sourceSize: input.buffer.byteLength,
        requestedEngine: input.requestedEngine,
        status: 'queued',
        autoApprove: input.autoApprove ? 1 : 0,
        optionsJson: JSON.stringify(options),
        createdAt: now,
      })
      .run();

    const view = this.getJob(id);
    this.enqueue(id, 'A');
    this.logger(
      `ingest job ${id} queued (${locale}) mode=${input.targetMode} autoApprove=${input.autoApprove}`,
    );
    return view;
  }

  listJobs(user: IdentityUser, options: { limit?: number } = {}): IngestJobView[] {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
    const rows =
      user.role === 'admin'
        ? this.db.select().from(ingestJobs).orderBy(desc(ingestJobs.createdAt)).limit(limit).all()
        : this.db
            .select()
            .from(ingestJobs)
            .where(eq(ingestJobs.userId, user.id))
            .orderBy(desc(ingestJobs.createdAt))
            .limit(limit)
            .all();
    return rows.map((row) => this.toView(row));
  }

  getJob(jobId: string): IngestJobView {
    return this.toView(this.requireRow(jobId));
  }

  /** Owner-or-admin access check shared by every read endpoint. */
  getJobForUser(jobId: string, user: IdentityUser): IngestJobView {
    const row = this.requireRow(jobId);
    this.assertOwnership(row, user);
    return this.toView(row);
  }

  private assertOwnership(row: IngestJobRow, user: IdentityUser): void {
    if (row.userId === user.id || user.role === 'admin') return;
    throw httpError(404, 'ingest.jobNotFound', { id: row.id });
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Interactive plan review                                                                  */
  /* ---------------------------------------------------------------------------------------- */

  async getMarkdown(jobId: string, user: IdentityUser): Promise<IngestMarkdownView> {
    const row = this.requireForUser(jobId, user);
    const markdownPath = row.markdownPath;
    let markdown = '';
    if (markdownPath && existsSync(markdownPath)) {
      markdown = await fs.readFile(markdownPath, 'utf8');
    } else {
      throw httpError(404, 'ingest.markdownMissing', { id: row.id });
    }
    return {
      jobId: row.id,
      status: this.statusOf(row),
      markdown,
      sections: parseMarkdownOutline(markdown),
      assets: parseJson<ExtractedIngestAsset[]>(row.assetsJson, []),
      plan: parseJson<IngestOutlinePlan | null>(row.planJson, null),
    };
  }

  async updateMarkdown(
    jobId: string,
    markdown: string,
    user: IdentityUser,
  ): Promise<IngestMarkdownView> {
    const row = this.requireForUser(jobId, user);
    if (this.statusOf(row) !== 'awaiting_plan_approval') {
      throw httpError(409, 'ingest.notAwaitingApproval', { id: row.id });
    }
    const stagingDir = this.stagingDirFor(row.id);
    const markdownPath = row.markdownPath ?? path.join(stagingDir, 'parsed.md');
    await fs.writeFile(markdownPath, markdown, 'utf8');
    this.db
      .update(ingestJobs)
      .set({ markdownPath })
      .where(eq(ingestJobs.id, row.id))
      .run();
    const refreshed = this.requireRow(row.id);
    const sections = parseMarkdownOutline(markdown);
    this.emit(row.id, {
      type: 'log',
      level: 'info',
      message: `Markdown reviewed (${sections.length} section(s)).`,
    });
    return {
      jobId: row.id,
      status: this.statusOf(refreshed),
      markdown,
      sections,
      assets: parseJson<ExtractedIngestAsset[]>(refreshed.assetsJson, []),
      plan: parseJson<IngestOutlinePlan | null>(refreshed.planJson, null),
    };
  }

  async replan(
    jobId: string,
    options: ReplanOptions,
    user: IdentityUser,
  ): Promise<IngestJobView> {
    const row = this.requireForUser(jobId, user);
    if (this.statusOf(row) !== 'awaiting_plan_approval') {
      throw httpError(409, 'ingest.notAwaitingApproval', { id: row.id });
    }
    const markdown = row.markdownPath && existsSync(row.markdownPath)
      ? await fs.readFile(row.markdownPath, 'utf8')
      : '';
    if (!markdown.trim()) throw httpError(409, 'ingest.markdownMissing', { id: row.id });

    this.patchJob(row.id, { status: 'planning', error: null });
    this.emitStatus(row.id, 'planning');
    const locale = this.localeForRow(row);
    const stored = parseJson<IngestJobOptions>(row.optionsJson, { engine: 'auto' });
    const merged = normalizeIngestOptions({ ...stored, ...options, engine: stored.engine });
    const existingPaths = await this.collectExistingPathsForRow(row);
    const planned = await planDocumentOutline(
      {
        markdown,
        sourceFilename: row.sourceFilename,
        targetMode: row.targetMode,
        language: merged.language,
        mapKind: merged.mapKind,
        topicType: merged.topicType,
        targetDir: merged.targetDir,
        instruction: merged.instruction,
        maxTopics: merged.maxTopics,
      },
      this.agentDeps,
      this.ctxForRow(row, locale, existingPaths),
    );
    this.savePlan(row.id, planned.plan, merged, planned.warnings);
    this.patchJob(row.id, { status: 'awaiting_plan_approval' });
    this.emitStatus(row.id, 'awaiting_plan_approval');
    const refreshed = this.requireRow(row.id);
    this.emitPlanReady(row.id, planned.plan, refreshed);
    return this.toView(refreshed);
  }

  async approve(
    jobId: string,
    plan: IngestOutlinePlan | null | undefined,
    user: IdentityUser,
  ): Promise<IngestJobView> {
    const row = this.requireForUser(jobId, user);
    if (this.statusOf(row) !== 'awaiting_plan_approval') {
      throw httpError(409, 'ingest.notAwaitingApproval', { id: row.id });
    }
    const stored = parseJson<IngestOutlinePlan | null>(row.planJson, null);
    const effective = plan ?? stored;
    if (!effective) throw httpError(409, 'ingest.planMissing', { id: row.id });

    const options = parseJson<IngestJobOptions>(row.optionsJson, { engine: 'auto' });
    const existingPaths = await this.collectExistingPathsForRow(row);
    const targetDir = options.targetDir ?? effective.targetDir;
    const normalized = normalizePlanPaths(effective, {
      existingPaths,
      ...(targetDir ? { targetDir } : {}),
    });

    this.savePlan(row.id, normalized, options, []);
    this.patchJob(row.id, { status: 'queued', cancelRequested: 0 });
    this.emitStatus(row.id, 'queued');
    this.enqueue(row.id, 'B');
    return this.getJobForUser(row.id, user);
  }

  async cancel(jobId: string, user: IdentityUser): Promise<IngestJobView> {
    const row = this.requireForUser(jobId, user);
    const status = this.statusOf(row);
    if (isTerminal(status)) return this.toView(row);

    this.patchJob(row.id, { cancelRequested: 1 });
    this.runtimes.get(row.id)?.controller.abort();

    if (status === 'queued' || status === 'awaiting_plan_approval') {
      this.pending.splice(
        0,
        this.pending.length,
        ...this.pending.filter((entry) => entry.jobId !== row.id),
      );
      this.markCancelled(row.id);
    }
    return this.toView(this.requireRow(row.id));
  }

  async readAsset(
    jobId: string,
    assetId: string,
  ): Promise<{ buffer: Buffer; fileName: string; mediaType: string }> {
    const row = this.requireRow(jobId);
    const assets = parseJson<ExtractedIngestAsset[]>(row.assetsJson, []);
    const asset = assets.find((entry) => entry.assetId === assetId);
    if (!asset) throw httpError(404, 'ingest.assetNotFound', { id: assetId });
    const assetsDir = path.join(this.stagingDirFor(row.id), 'assets');
    const fileName = path.basename(asset.fileName.replace(/\\/g, '/'));
    const absPath = path.join(assetsDir, fileName);
    if (!absPath.startsWith(`${assetsDir}${path.sep}`) && absPath !== assetsDir) {
      throw httpError(400, 'ingest.assetNotFound', { id: assetId });
    }
    const buffer = await fs.readFile(absPath).catch(() => null);
    if (!buffer) throw httpError(404, 'ingest.assetNotFound', { id: assetId });
    return { buffer, fileName, mediaType: asset.mediaType };
  }

  /* ---------------------------------------------------------------------------------------- */
  /* SSE                                                                                      */
  /* ---------------------------------------------------------------------------------------- */

  subscribe(jobId: string, listener: IngestStreamListener): () => void {
    let bucket = this.listeners.get(jobId);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(jobId, bucket);
    }
    bucket.add(listener);
    return () => {
      const current = this.listeners.get(jobId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(jobId);
    };
  }

  private emit(jobId: string, event: IngestStreamEvent): void {
    const bucket = this.listeners.get(jobId);
    if (!bucket) return;
    for (const listener of bucket) {
      try {
        listener(event);
      } catch (error) {
        this.logger(`ingest SSE listener failed for ${jobId}`, error);
      }
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Queue                                                                                    */
  /* ---------------------------------------------------------------------------------------- */

  private enqueue(jobId: string, phase: 'A' | 'B'): void {
    if (this.stopped) return;
    this.pending.push({ jobId, phase });
    this.pump();
  }

  private pump(): void {
    while (!this.stopped && this.running < this.concurrency && this.pending.length > 0) {
      const next = this.pending.shift();
      if (!next) return;
      const row = this.rowOrNull(next.jobId);
      if (!row || isTerminal(this.statusOf(row))) continue;
      this.running += 1;
      void this.run(next.jobId, next.phase)
        .catch((error) => {
          this.logger(`ingest job ${next.jobId} crashed`, error);
        })
        .finally(() => {
          this.running -= 1;
          this.pump();
        });
    }
  }

  private async run(jobId: string, phase: 'A' | 'B'): Promise<void> {
    const row = this.rowOrNull(jobId);
    if (!row) return;
    if (row.cancelRequested && !isTerminal(this.statusOf(row))) {
      this.markCancelled(jobId);
      return;
    }
    const controller = new AbortController();
    this.runtimes.set(jobId, { controller, phase });
    const startedAt = row.startedAt ?? Date.now();
    this.patchJob(jobId, {
      startedAt,
      finishedAt: null,
      ...(phase === 'A' ? { status: 'parsing' as const } : { status: 'writing' as const }),
    });
    this.emitStatus(jobId, phase === 'A' ? 'parsing' : 'writing');

    try {
      if (phase === 'A') {
        const plan = await this.runPhaseA(jobId, controller.signal);
        const refreshed = this.requireRow(jobId);
        if (!plan) return;
        if (refreshed.autoApprove === 1 && !controller.signal.aborted) {
          await this.runPhaseB(jobId, controller.signal, plan);
        }
      } else {
        await this.runPhaseB(jobId, controller.signal);
      }
    } catch (error) {
      const current = this.rowOrNull(jobId);
      if (!current) return;
      const cancelled = isAbortError(error) || current.cancelRequested === 1;
      if (cancelled) {
        this.markCancelled(jobId);
      } else {
        const message = localizeErrorMessage(error, this.localeForRow(current));
        this.patchJob(jobId, {
          status: 'failed',
          error: message,
          finishedAt: Date.now(),
        });
        this.emit(jobId, { type: 'error', message });
        this.emitStatus(jobId, 'failed', message);
        this.logger(`ingest job ${jobId} failed: ${message}`, error);
      }
    } finally {
      this.runtimes.delete(jobId);
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Phase A — parse + plan                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  private async runPhaseA(jobId: string, signal: AbortSignal): Promise<IngestOutlinePlan | null> {
    const row = this.requireRow(jobId);
    const locale = this.localeForRow(row);
    const options = parseJson<IngestJobOptions>(row.optionsJson, { engine: 'auto' });
    const stagingDir = this.stagingDirFor(jobId);
    const assetsDir = path.join(stagingDir, 'assets');
    const config = this.settings.resolveConfig();
    const sourcePath = path.join(stagingDir, `source${row.sourceExt}`);

    this.setProgress(jobId, {
      stage: 'parsing',
      percent: 5,
      message: apiT(locale, 'ingest.progress.parsing'),
      planReady: false,
      topics: [],
    });

    const parsed = await this.parseDocument({
      inputPath: sourcePath,
      outputDir: stagingDir,
      assetsDir,
      extension: row.sourceExt,
      config,
      requestedEngine: row.requestedEngine,
      signal,
      ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
      ...(this.commandRunner ? { commandRunner: this.commandRunner } : {}),
    });
    if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });

    const markdownPath = path.join(stagingDir, 'parsed.md');
    await fs.writeFile(markdownPath, parsed.markdown, 'utf8');
    this.db
      .update(ingestJobs)
      .set({
        markdownPath,
        assetsJson: JSON.stringify(parsed.assets),
        engineUsed: parsed.engine,
      })
      .where(eq(ingestJobs.id, jobId))
      .run();
    for (const warning of parsed.warnings) {
      this.emit(jobId, { type: 'log', level: 'warn', message: warning });
    }

    this.patchJob(jobId, { status: 'planning' });
    this.setProgress(jobId, {
      stage: 'planning',
      percent: 25,
      message: apiT(locale, 'ingest.progress.planning'),
      planReady: false,
      topics: [],
    });
    this.emitStatus(jobId, 'planning');

    const existingPaths = await this.collectExistingPathsForRow(row);
    const planned = await planDocumentOutline(
      {
        markdown: parsed.markdown,
        sourceFilename: row.sourceFilename,
        targetMode: row.targetMode,
        language: options.language,
        mapKind: options.mapKind,
        topicType: options.topicType,
        targetDir: options.targetDir,
        instruction: options.instruction,
        maxTopics: options.maxTopics,
        callbacks: this.callbacksFor(jobId, row),
      },
      this.agentDeps,
      this.ctxForRow(row, locale, existingPaths, signal),
    );
    if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });

    this.savePlan(jobId, planned.plan, options, planned.warnings);

    const refreshed = this.requireRow(jobId);
    if (refreshed.autoApprove === 1) {
      this.emitPlanReady(jobId, planned.plan, refreshed);
      return planned.plan;
    }

    this.patchJob(jobId, { status: 'awaiting_plan_approval' });
    this.setProgress(jobId, {
      stage: 'awaiting_plan_approval',
      percent: 40,
      message: apiT(locale, 'ingest.progress.awaitingPlan'),
      planReady: true,
      topics: this.pendingTopicProgress(planned.plan),
    });
    this.emitStatus(jobId, 'awaiting_plan_approval');
    this.emitPlanReady(jobId, planned.plan, this.requireRow(jobId));
    return null;
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Phase B — write + validate/repair + materialize                                          */
  /* ---------------------------------------------------------------------------------------- */

  private async runPhaseB(
    jobId: string,
    signal: AbortSignal,
    preloadedPlan?: IngestOutlinePlan,
  ): Promise<void> {
    let row = this.requireRow(jobId);
    const locale = this.localeForRow(row);
    const options = parseJson<IngestJobOptions>(row.optionsJson, { engine: 'auto' });
    const plan = preloadedPlan ?? parseJson<IngestOutlinePlan | null>(row.planJson, null);
    if (!plan) throw httpError(409, 'ingest.planMissing', { id: jobId });
    const assets = parseJson<ExtractedIngestAsset[]>(row.assetsJson, []);
    const stagingDir = this.stagingDirFor(jobId);
    const assetsDir = path.join(stagingDir, 'assets');

    this.patchJob(jobId, { status: 'writing' });
    this.emitStatus(jobId, 'writing');

    const existingSession =
      row.targetMode === 'new_manual' ? null : await this.resolveSessionForRow(row);
    const projectId = existingSession
      ? this.locks.ensureRepository(existingSession.projectRootDir)
      : 'ingest';
    const branch = existingSession?.branch ?? row.branch ?? 'main';

    const existingPaths = existingSession
      ? await collectExistingPaths(existingSession, this.drafts, projectId, branch, row.userId)
      : new Set<string>();

    const planTargetDir = options.targetDir ?? plan.targetDir;
    const normalizedPlan = normalizePlanPaths(plan, {
      existingPaths,
      ...(planTargetDir ? { targetDir: planTargetDir } : {}),
    });
    const placements: IngestAssetPlacement[] = existingSession
      ? await resolveExistingManualAssetPlacements(
          { assets, session: existingSession, user: this.requireUser(row), plan: normalizedPlan },
          { ...this.materializerDeps, projectId },
        )
      : defaultAssetPlacements(assets);

    const assetPathById = new Map<string, string>();
    for (const placement of placements) {
      assetPathById.set(placement.asset.assetId, placement.filePath);
      const stem = path.posix.basename(
        placement.asset.fileName,
        path.posix.extname(placement.asset.fileName),
      );
      assetPathById.set(stem, placement.filePath);
    }
    const availableAssetPaths = new Set(placements.map((placement) => placement.filePath));
    if (existingSession) {
      for (const existing of existingPaths) availableAssetPaths.add(existing);
    }

    const flatNodes = planTopicNodes(normalizedPlan);
    const topics = this.pendingTopicProgress(normalizedPlan);
    const topicByPath = new Map(topics.map((topic) => [topic.filePath, topic]));
    this.setProgress(jobId, {
      stage: 'writing',
      percent: 45,
      message: apiT(locale, 'ingest.progress.writing'),
      planReady: true,
      topics,
    });

    const markdown =
      row.markdownPath && existsSync(row.markdownPath)
        ? await fs.readFile(row.markdownPath, 'utf8')
        : '';
    const sections = parseMarkdownOutline(markdown);
    const callbacks = this.callbacksFor(jobId, row);

    row = this.requireRow(jobId);
    const ctx = this.ctxForRow(
      row,
      locale,
      existingPaths,
      signal,
      projectId,
      branch,
    );

    const artifacts = await runWithConcurrency(
      flatNodes,
      this.writerConcurrency,
      async (node) => {
        const artifact = await draftAndVerifyTopic(
          {
            markdown,
            sections,
            plan: normalizedPlan,
            node,
            language: options.language ?? 'en',
            assets,
            assetPathById,
            availableAssetPaths,
            instruction: options.instruction,
            callbacks,
          },
          this.agentDeps,
          ctx,
        );
        return artifact;
      },
      signal,
    );

    for (const artifact of artifacts) {
      const topic = topicByPath.get(artifact.node.filePath);
      if (!topic) continue;
      topic.status = artifact.ok ? 'done' : 'failed';
      topic.attempts = artifact.repairAttempts;
      if (!artifact.ok && artifact.issues[0]) topic.error = artifact.issues[0].message;
    }
    this.setProgress(jobId, {
      stage: 'validating',
      percent: 70,
      message: apiT(locale, 'ingest.progress.validating'),
      planReady: true,
      topics,
    });
    this.patchJob(jobId, { status: 'validating' });
    this.emitStatus(jobId, 'validating');

    const baselineIndex = existingSession
      ? await this.buildOverlayIndex(existingSession, projectId, row.userId)
      : undefined;
    const prepareStagingDir = existingSession
      ? async (context: { workDir: string }) => {
          await this.drafts.materializeOverlayDir({
            baselineDir: existingSession.workDir,
            projectId,
            branch,
            userId: row.userId,
            destDir: context.workDir,
          });
        }
      : undefined;

    const validation: ValidateBatchResult = await validateAndRepairBatch(
      {
        plan: normalizedPlan,
        artifacts,
        assets,
        assetPathById,
        assetPaths: availableAssetPaths,
        availableAssetPaths,
        ...(baselineIndex ? { baselineIndex } : {}),
        ...(prepareStagingDir ? { prepareStagingDir } : {}),
        language: options.language,
        callbacks,
      },
      this.agentDeps,
      ctx,
    );

    this.db
      .update(ingestJobs)
      .set({
        validationJson: JSON.stringify(validation.validationReport),
      })
      .where(eq(ingestJobs.id, row.id))
      .run();
    this.emit(jobId, { type: 'validation', report: validation.validationReport });

    // Layer 2 may have repaired — or failed — topics after the pre-validation snapshot. Mirror the
    // authoritative per-topic report back into job progress, otherwise a topic DITA-OT rejected
    // keeps showing "written" in the wizard while the job itself fails.
    const changedTopics: IngestTopicProgress[] = [];
    for (const report of validation.validationReport.topics) {
      const topic = topicByPath.get(report.filePath);
      if (!topic) continue;
      const status: IngestTopicProgress['status'] = report.ok ? 'done' : 'failed';
      const error = report.ok
        ? undefined
        : report.issues.find((issue) => issue.severity === 'error')?.message;
      if (topic.status === status && topic.attempts === report.attempts && topic.error === error) continue;
      topic.status = status;
      topic.attempts = report.attempts;
      if (error) topic.error = error;
      else delete topic.error;
      changedTopics.push({ ...topic });
    }
    if (changedTopics.length > 0) {
      this.setProgress(jobId, {
        stage: 'validating',
        percent: 78,
        message: apiT(locale, 'ingest.progress.validating'),
        planReady: true,
        topics,
      });
      for (const topic of changedTopics) {
        this.emit(jobId, { type: 'topic_progress', topic });
      }
    }

    if (!validation.validationReport.ok) {
      // Real errors first: DITA-OT emits a `DOTJ076W` warning per external link, which used to push
      // the one actionable `DOTJ013E` error out of the first five reported messages.
      const allIssues = validation.validationReport.layer1.issues.concat(
        validation.validationReport.layer2.issues,
      );
      const errors = allIssues.filter((issue) => issue.severity === 'error');
      const issues = (errors.length > 0 ? errors : allIssues)
        .slice(0, 5)
        .map((issue) => `${issue.path ? `${issue.path}: ` : ''}${issue.message}`)
        .join('; ');
      throw new Error(
        apiT(locale, 'ingest.validationFailed', {
          issues: issues || validation.validationReport.layer2.reason || '-',
        }),
      );
    }
    this.patchJob(jobId, { status: 'materializing' });
    this.setProgress(jobId, {
      stage: 'materializing',
      percent: 90,
      message: apiT(locale, 'ingest.progress.materializing'),
      planReady: true,
      topics,
    });
    this.emitStatus(jobId, 'materializing');

    const user = this.requireUser(row);
    const result: IngestJobResult = existingSession
      ? await materializeIntoExistingManual(
          {
            plan: normalizedPlan,
            artifacts: validation.artifacts,
            assets,
            assetsDir,
            assetPlacements: placements,
            session: existingSession,
            user,
            locale,
            mountMapPath: options.mountMapPath ?? null,
            mountParentPath: options.mountParentPath ?? null,
          },
          this.materializerDeps,
        )
      : await materializeNewManual(
          {
            plan: normalizedPlan,
            artifacts: validation.artifacts,
            assets,
            assetsDir,
            assetPlacements: placements,
            user,
            locale,
            sourceFilename: row.sourceFilename,
            ...(validation.repairedFiles ? { fileOverrides: validation.repairedFiles } : {}),
          },
          this.materializerDeps,
        );

    this.setProgress(jobId, {
      stage: 'succeeded',
      percent: 100,
      message: apiT(locale, 'ingest.progress.succeeded'),
      planReady: true,
      topics: topics.map((topic) => ({ ...topic, status: 'done' as const })),
    });
    this.db
      .update(ingestJobs)
      .set({
        status: 'succeeded',
        resultJson: JSON.stringify(result),
        createdManualId: result.manualId ?? null,
        finishedAt: Date.now(),
      })
      .where(eq(ingestJobs.id, row.id))
      .run();
    const finished = this.requireRow(jobId);
    this.emitStatus(jobId, 'succeeded');
    this.emit(jobId, { type: 'done', job: this.toView(finished) });
    this.logger(`ingest job ${jobId} succeeded`);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Progress / persistence helpers                                                           */
  /* ---------------------------------------------------------------------------------------- */

  private pendingTopicProgress(plan: IngestOutlinePlan): IngestTopicProgress[] {
    return planTopicNodes(plan).map((node) => ({
      topicId: node.topicId,
      filePath: node.filePath,
      title: node.title,
      status: 'pending',
      attempts: 0,
    }));
  }

  private callbacksFor(jobId: string, row: IngestJobRow): IngestAgentCallbacks {
    return {
      onLog: (entry) => {
        this.emit(jobId, { type: 'log', level: entry.level, message: entry.message });
      },
      onTopicStatus: (update) => {
        const progress: IngestJobProgress =
          this.readProgress(jobId) ?? {
            stage: this.statusOf(this.requireRow(jobId)),
            percent: 40,
            planReady: true,
            topics: [],
            updatedAt: Date.now(),
          };
        const topics = progress.topics.filter((topic) => topic.filePath !== update.filePath);
        topics.push({
          topicId: update.topicId,
          filePath: update.filePath,
          title: update.title,
          status: update.status,
          attempts: update.attempts,
          ...(update.error ? { error: update.error } : {}),
        });
        this.setProgress(jobId, {
          stage: progress.stage,
          percent: progress.percent,
          message: progress.message,
          planReady: progress.planReady,
          topics,
        });
        this.emit(jobId, {
          type: 'topic_progress',
          topic: {
            topicId: update.topicId,
            filePath: update.filePath,
            title: update.title,
            status: update.status,
            attempts: update.attempts,
            ...(update.error ? { error: update.error } : {}),
          },
        });
      },
      onLayer2Start: (info) => {
        this.emit(jobId, {
          type: 'log',
          level: 'info',
          message: `DITA-OT strict validation: ${info.targets.length} file(s) from ${info.rootMapPath}.`,
        });
      },
      onLayer2Repair: (info) => {
        this.patchJob(jobId, { status: 'repairing' });
        this.emitStatus(jobId, 'repairing');
        this.emit(jobId, {
          type: 'log',
          level: 'warn',
          message: `Repairing ${info.filePath} (attempt ${info.attempt}, ${info.issues.length} issue(s)).`,
        });
      },
    };
  }

  private readProgress(jobId: string): IngestJobProgress | null {
    const row = this.rowOrNull(jobId);
    return row ? parseJson<IngestJobProgress | null>(row.progressJson, null) : null;
  }

  private setProgress(
    jobId: string,
    patch: {
      stage: IngestJobStatus;
      percent: number;
      message?: string;
      planReady: boolean;
      topics: IngestTopicProgress[];
    },
  ): void {
    const row = this.rowOrNull(jobId);
    if (!row) return;
    const previous = parseJson<IngestJobProgress | null>(row.progressJson, null);
    const percent = Math.max(previous?.percent ?? 0, Math.min(100, Math.round(patch.percent)));
    const progress: IngestJobProgress = {
      stage: patch.stage,
      percent,
      ...(patch.message ? { message: patch.message } : {}),
      planReady: patch.planReady,
      topics: patch.topics,
      updatedAt: Date.now(),
    };
    this.patchJob(jobId, { progressJson: JSON.stringify(progress) });
  }

  private emitStatus(jobId: string, status: IngestJobStatus, message?: string): void {
    this.emit(jobId, {
      type: 'status',
      status,
      progress: this.readProgress(jobId),
      ...(message ? { message } : {}),
    });
  }

  private savePlan(
    jobId: string,
    plan: IngestOutlinePlan,
    options: IngestJobOptions,
    warnings: readonly string[],
  ): void {
    this.db
      .update(ingestJobs)
      .set({
        planJson: JSON.stringify(plan),
        optionsJson: JSON.stringify(options),
      })
      .where(eq(ingestJobs.id, jobId))
      .run();
    for (const warning of warnings) {
      this.emit(jobId, { type: 'log', level: 'warn', message: warning });
    }
  }

  private emitPlanReady(jobId: string, plan: IngestOutlinePlan, row: IngestJobRow): void {
    this.emit(jobId, {
      type: 'plan_ready',
      plan,
      assets: parseJson<ExtractedIngestAsset[]>(row.assetsJson, []),
      warnings: [],
    });
  }

  private markCancelled(jobId: string): void {
    const row = this.rowOrNull(jobId);
    if (!row || isTerminal(this.statusOf(row))) return;
    const locale = this.localeForRow(row);
    this.setProgress(jobId, {
      stage: 'cancelled',
      percent: this.readProgress(jobId)?.percent ?? 0,
      message: apiT(locale, 'ingest.progress.cancelled'),
      planReady: Boolean(row.planJson),
      topics: this.readProgress(jobId)?.topics ?? [],
    });
    this.patchJob(jobId, { status: 'cancelled', finishedAt: Date.now(), cancelRequested: 1 });
    this.emitStatus(jobId, 'cancelled');
    this.emit(jobId, { type: 'cancelled', job: this.toView(this.requireRow(jobId)) });
  }

  private patchJob(jobId: string, patch: IngestJobPatch): void {
    this.db
      .update(ingestJobs)
      .set(patch)
      .where(eq(ingestJobs.id, jobId))
      .run();
  }

  private rowOrNull(jobId: string): IngestJobRow | null {
    const row = this.db.select().from(ingestJobs).where(eq(ingestJobs.id, jobId)).get();
    return row ?? null;
  }

  private requireRow(jobId: string): IngestJobRow {
    const row = this.rowOrNull(jobId);
    if (!row) throw httpError(404, 'ingest.jobNotFound', { id: jobId });
    return row;
  }

  private requireForUser(jobId: string, user: IdentityUser): IngestJobRow {
    const row = this.requireRow(jobId);
    this.assertOwnership(row, user);
    return row;
  }

  private statusOf(row: IngestJobRow): IngestJobStatus {
    return row.status as IngestJobStatus;
  }

  private localeForRow(row: IngestJobRow): ApiLocale {
    const options = parseJson<{ locale?: string }>(row.optionsJson, {});
    return options.locale === 'en' ? 'en' : 'zh-CN';
  }

  private requireUser(row: IngestJobRow): IdentityUser {
    const user = this.identity.get(row.userId);
    if (!user) throw httpError(500, 'identity.initFailed');
    return user;
  }

  private async resolveSessionForRow(row: IngestJobRow): Promise<ManualSession> {
    if (!row.projectId) throw httpError(409, 'ingest.manualContextMissing', { id: row.id });
    return this.context.resolve(row.projectId, row.branch ?? undefined);
  }

  private async collectExistingPathsForRow(row: IngestJobRow): Promise<Set<string>> {
    if (row.targetMode === 'new_manual' || !row.projectId) return new Set();
    const session = await this.resolveSessionForRow(row);
    const projectId = this.locks.ensureRepository(session.projectRootDir);
    return collectExistingPaths(session, this.drafts, projectId, session.branch, row.userId);
  }

  private ctxForRow(
    row: IngestJobRow,
    locale: ApiLocale,
    existingPaths: ReadonlySet<string>,
    signal?: AbortSignal,
    projectId?: string,
    branch?: string,
  ) {
    return {
      projectId: projectId ?? row.projectId ?? 'ingest',
      branch: branch ?? row.branch ?? 'main',
      user: this.requireUser(row),
      locale,
      ...(signal ? { signal } : {}),
      existingPaths,
    };
  }

  /** Builds the caller's real User Overlay index (baseline + own drafts) for strict validation. */
  private async buildOverlayIndex(
    session: ManualSession,
    projectId: string,
    userId: string,
  ): Promise<DitaSemanticIndex> {
    const snapshot = await session.workspace.scanWorkspace();
    const files: Record<string, string> = {};
    const collect = async (nodes: readonly WorkspaceFileNode[]): Promise<void> => {
      for (const node of nodes) {
        if (node.children) {
          await collect(node.children);
          continue;
        }
        if (!/\.(dita|ditamap|bookmap)$/iu.test(node.path)) continue;
        try {
          const content = await session.workspace.readFile(node.path);
          files[node.path] = content.content;
        } catch {
          // A binary or unreadable file cannot participate in semantic validation.
        }
      }
    };
    await collect(snapshot.files);
    const index = new DitaSemanticIndex();
    index.loadFiles(files);
    return index.cloneWithOverlay(
      this.drafts.toSemanticOverlayOps(projectId, session.branch, userId),
    );
  }

  /* ---------------------------------------------------------------------------------------- */
  /* View mapping                                                                             */
  /* ---------------------------------------------------------------------------------------- */

  private toView(row: IngestJobRow): IngestJobView {
    return {
      id: row.id,
      targetMode: row.targetMode as IngestTargetMode,
      projectId: row.projectId,
      branch: row.branch,
      userId: row.userId,
      sourceFilename: row.sourceFilename,
      sourceExt: row.sourceExt,
      sourceSize: row.sourceSize,
      requestedEngine: row.requestedEngine as IngestEngineChoice,
      engineUsed: row.engineUsed,
      status: this.statusOf(row),
      autoApprove: row.autoApprove === 1,
      options: parseJson<IngestJobOptions>(row.optionsJson, { engine: 'auto' }),
      assets: parseJson<ExtractedIngestAsset[]>(row.assetsJson, []),
      plan: parseJson<IngestOutlinePlan | null>(row.planJson, null),
      progress: parseJson<IngestJobProgress | null>(row.progressJson, null),
      validation: parseJson<IngestValidationReport | null>(row.validationJson, null),
      result: parseJson<IngestJobResult | null>(row.resultJson, null),
      createdManualId: row.createdManualId,
      error: row.error,
      cancelRequested: row.cancelRequested === 1,
      createdAt: toIso(row.createdAt) ?? '',
      startedAt: toIso(row.startedAt),
      finishedAt: toIso(row.finishedAt),
    };
  }
}

function planTopicNodes(plan: IngestOutlinePlan) {
  const result: IngestOutlinePlan['topics'] = [];
  const visit = (nodes: IngestOutlinePlan['topics']): void => {
    for (const node of nodes) {
      result.push(node);
      if (node.children && node.children.length > 0) visit(node.children);
    }
  };
  visit(plan.topics);
  return result;
}

/** Re-exported for routes/tests that want the canonical terminal list. */
export { ACTIVE_STATUSES, TERMINAL_STATUSES };
