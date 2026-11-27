import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync, type WriteStream } from 'node:fs';
import {
  appendFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { checkXmlWellFormed } from '@dita/core';
import type { DitaDatabase } from '../../db/client.js';
import { publishJobs, type PublishJobRow } from '../../db/schema.js';
import type { VersionAuditService } from '../git/audit-service.js';
import type { GitManager } from '../git/git-manager.js';
import type { DraftService } from '../locks/draft-service.js';
import { HttpError, httpError, localizeErrorMessage } from '../errors.js';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type { WorkspaceManager } from '../files/workspace-fs.js';
import {
  defaultPluginDir,
  detectDitaRuntime,
  resolveDitaCommand,
  resolveFopConfig,
  resolveNotoFontDir,
  runDita,
  type DitaRuntimeInfo,
  type DitaRuntimeOptions,
} from '../dita-ot/dita-runtime.js';
import {
  fallbackDitaDiagnostic,
  parseDitaLog,
  type DitaDiagnostic,
} from '../dita-ot/dita-log-parser.js';
import {
  applyFopFontEntries,
  applyFontBase,
  discoverNotoCjkFontFiles,
  fontFailureHintKey,
  materializeNotoFopFonts,
  planNotoFopFonts,
} from '../dita-ot/fop-font-config.js';
import { PublishQueue } from './publish-queue.js';
import { createZipFromDirectory } from './zip-store.js';
import {
  DEFAULT_HTML_THEME_ID,
  isHtmlThemeId,
  resolveHtmlThemesDir,
  resolveThemeOptions,
  type HtmlThemeId,
  type HtmlThemeOptions,
} from './html-themes.js';
import {
  DEFAULT_PDF_THEME_ID,
  isPdfThemeId,
  resolvePdfTheme,
  resolvePdfThemeOptions,
  type PdfThemeId,
  type PdfThemeOptions,
} from './pdf-themes.js';
import { preparePdfCustomizationDir } from './pdf-customization.js';
import { enhanceHtml5Output } from './theme-enhancer.js';

export type PublishFormat = 'html5' | 'pdf';
export type PublishStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
/** Phase 13: what a build reads from — the clean baseline by default, never other users' drafts. */
export type PublishSourceMode = 'baseline' | 'tag' | 'commit' | 'my_drafts';

export interface CreatePublishJobInput {
  user: IdentityUser;
  workDir: string;
  projectId: string;
  branch: string;
  rootMap: string;
  format: PublishFormat;
  ditaval?: string | null;
  title?: string;
  /** UI locale of the requesting client, persisted with the job so stored build errors match it. */
  locale?: ApiLocale;
  /** HTML5 portal theme; ignored for PDF jobs. */
  themeId?: HtmlThemeId;
  /** Normalized portal theme options; ignored for PDF jobs. */
  themeOptions?: HtmlThemeOptions;
  /** Phase 15: PDF style theme; ignored for HTML5 jobs. */
  pdfThemeId?: PdfThemeId;
  /** Phase 15: normalized PDF theme options; ignored for HTML5 jobs. */
  pdfThemeOptions?: PdfThemeOptions;
  /** Phase 13: build source; omitted keeps the historical baseline behavior. */
  sourceMode?: PublishSourceMode;
  /** Phase 13: tag or commit for `tag` / `commit` source modes. */
  sourceRef?: string | null;
  /** Phase 13: repository root used for `git archive` (defaults to the work dir). */
  projectRootDir?: string;
}

export interface PublishJobView {
  id: string;
  projectId: string;
  branch: string;
  userId: string;
  rootMap: string;
  format: PublishFormat;
  ditaval: string | null;
  title: string;
  status: PublishStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  error: string | null;
  artifactName: string | null;
  artifactSize: number | null;
  diagnostics: DitaDiagnostic[];
  previewUrl: string | null;
  artifactUrl: string | null;
  logUrl: string;
  cancelRequested: boolean;
  /** `null` for PDF jobs and for HTML5 jobs published before Phase 12 themes. */
  themeId: HtmlThemeId | null;
  themeOptions: HtmlThemeOptions | null;
  /**
   * Phase 15 PDF theme snapshot. `null` for HTML5 jobs and for PDF jobs published before
   * Phase 15, which renders exactly like the `vanilla` theme.
   */
  pdfThemeId: PdfThemeId | null;
  pdfThemeOptions: PdfThemeOptions | null;
  /** Phase 13 provenance: what was published and whether the work tree was dirty. */
  sourceMode: PublishSourceMode;
  sourceRef: string | null;
  commitHash: string | null;
  isDirty: boolean;
  dirtyFiles: string[];
}

export interface PublishServiceOptions {
  db: DitaDatabase;
  workspace: WorkspaceManager;
  publishRootDir?: string;
  concurrency?: number;
  runtime?: DitaRuntimeOptions;
  timeoutMs?: number;
  retentionDays?: number;
  logger?: (message: string, error?: unknown) => void;
  /** Overrides the bundled `dita-ot-plugins/html5-themes` asset directory. */
  htmlThemesDir?: string;
  /** Overrides the bundled `dita-ot-plugins/pdf-themes` asset directory (Phase 15). */
  pdfThemesDir?: string;
  /** Phase 13: enables `tag` / `commit` archive builds and baseline SHA stamping. */
  git?: GitManager;
  /** Phase 13: enables `my_drafts` builds that overlay only the requester's drafts. */
  drafts?: DraftService;
  /** Phase 13: records a `publish` entry in the version audit log. */
  audit?: VersionAuditService;
}

const EXCLUDED_SNAPSHOT_ENTRIES = new Set([
  '.git',
  '.gitignore',
  '.DS_Store',
  'node_modules',
  'dist',
  'out',
  '.turbo',
  '.dita-workspaces',
]);

const TERMINAL_STATUSES: PublishStatus[] = ['succeeded', 'failed', 'cancelled'];
type PublishJobPatch = Partial<typeof publishJobs.$inferInsert>;

function toIso(value: number | null): string | null {
  return value == null ? null : new Date(value).toISOString();
}

function sanitizeFileStem(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'publish';
}

function parseDiagnostics(raw: string | null): DitaDiagnostic[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DitaDiagnostic[]) : [];
  } catch {
    return [];
  }
}

async function findFirstPdf(dir: string): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstPdf(absPath);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      return absPath;
    }
  }
  return null;
}

async function readLogForDiagnostics(logPath: string): Promise<string> {
  try {
    const info = await stat(logPath);
    if (info.size <= 4 * 1024 * 1024) {
      return await readFile(logPath, 'utf8');
    }
    const content = await readFile(logPath);
    return content.subarray(content.length - 4 * 1024 * 1024).toString('utf8');
  } catch {
    return '';
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

const PUBLISH_SOURCE_MODES: PublishSourceMode[] = ['baseline', 'tag', 'commit', 'my_drafts'];

/**
 * FOP reports font trouble as a Java stack trace. Matching the stable headline fragments lets the
 * job error name the actual problem (no embeddable CJK font) instead of only a `[PDFX013F]` line.
 */
function withFontHint(locale: ApiLocale, logText: string, message: string): string {
  const key = fontFailureHintKey(logText);
  return key ? `${apiT(locale, key)}\n${message}` : message;
}

function normalizeSourceMode(value: string | null | undefined): PublishSourceMode {
  return PUBLISH_SOURCE_MODES.includes(value as PublishSourceMode)
    ? (value as PublishSourceMode)
    : 'baseline';
}

function parseDirtyFiles(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

export class PublishService {
  private readonly db: DitaDatabase;
  private readonly workspace: WorkspaceManager;
  private readonly publishRootDir: string;
  private readonly runtimeOptions: DitaRuntimeOptions;
  private readonly timeoutMs: number;
  private readonly retentionDays: number;
  private readonly logger: (message: string, error?: unknown) => void;
  private readonly htmlThemesDirOverride: string | undefined;
  private readonly pdfThemesDir: string | undefined;
  private readonly git: GitManager | undefined;
  private readonly drafts: DraftService | undefined;
  private readonly audit: VersionAuditService | undefined;
  private readonly queue: PublishQueue;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: PublishServiceOptions) {
    this.db = options.db;
    this.workspace = options.workspace;
    this.publishRootDir = resolve(
      options.publishRootDir ??
        process.env.DITA_PUBLISH_DIR ??
        join(options.workspace.importsRootDir, 'publish'),
    );
    this.runtimeOptions = options.runtime ?? {};
    this.timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
    this.retentionDays = options.retentionDays ?? 14;
    this.logger = options.logger ?? (() => undefined);
    this.htmlThemesDirOverride = options.htmlThemesDir;
    this.pdfThemesDir = options.pdfThemesDir;
    this.git = options.git;
    this.drafts = options.drafts;
    this.audit = options.audit;
    this.queue = new PublishQueue({
      concurrency: options.concurrency ?? Number(process.env.DITA_PUBLISH_CONCURRENCY ?? 1),
      run: (jobId, signal) => this.runJob(jobId, signal),
      logger: this.logger,
    });
  }

  get rootDir(): string {
    return this.publishRootDir;
  }

  async start(): Promise<void> {
    // Jobs cannot survive a process restart because the queue and JVM are gone. Mark them
    // failed instead of leaving a permanently "running" row in the history panel.
    const interrupted = this.db
      .select()
      .from(publishJobs)
      .where(inArray(publishJobs.status, ['queued', 'running']))
      .all();
    for (const job of interrupted) {
      this.db
        .update(publishJobs)
        .set({
          status: 'failed',
          error: apiT(this.localeForRow(job), 'publish.interrupted'),
          finishedAt: Date.now(),
        })
        .where(eq(publishJobs.id, job.id))
        .run();
    }
    await this.pruneExpired();
    if (this.retentionDays > 0) {
      this.cleanupTimer = setInterval(
        () => void this.pruneExpired(),
        6 * 60 * 60 * 1000,
      );
      this.cleanupTimer.unref?.();
    }
  }

  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.queue.shutdown();
  }

  async getRuntime(locale: ApiLocale = 'zh-CN', force = true): Promise<DitaRuntimeInfo> {
    return detectDitaRuntime(this.runtimeOptions, { force, locale });
  }

  async createJob(input: CreatePublishJobInput): Promise<PublishJobView> {
    const locale: ApiLocale = input.locale ?? 'zh-CN';
    const runtime = await this.getRuntime(locale, false);
    if (!runtime.available) {
      if (runtime.error) throw new HttpError(503, runtime.error, { runtime });
      throw httpError(503, 'publish.noCli', undefined, { runtime });
    }
    const provenance = await this.resolveProvenance(input);
    const id = `pub-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const jobDir = join(this.publishRootDir, 'jobs', id);
    await mkdir(join(jobDir, 'snapshot'), { recursive: true });
    await mkdir(join(jobDir, 'output'), { recursive: true });
    const logPath = join(jobDir, 'build.log');
    const fallbackTitle = basename(input.rootMap, extname(input.rootMap));
    const title = input.title?.trim() || fallbackTitle;
    const themeId = input.themeId ?? DEFAULT_HTML_THEME_ID;
    const themeOptions =
      themeId === 'vanilla' ? {} : resolveThemeOptions(input.themeOptions ?? {});
    const pdfThemeId = input.pdfThemeId ?? DEFAULT_PDF_THEME_ID;
    const pdfThemeOptions =
      pdfThemeId === 'vanilla'
        ? {}
        : resolvePdfThemeOptions(pdfThemeId, input.pdfThemeOptions ?? {});
    const baseOptions = {
      timeoutMs: this.timeoutMs,
      locale,
      workDir: input.workDir,
      projectRootDir: provenance.projectRootDir,
      sourceMode: provenance.sourceMode,
      sourceRef: provenance.sourceRef,
    };
    const optionsJson = JSON.stringify(
      input.format === 'html5'
        ? { ...baseOptions, htmlTheme: { themeId, options: themeOptions } }
        : { ...baseOptions, pdfTheme: { themeId: pdfThemeId, options: pdfThemeOptions } },
    );

    this.db
      .insert(publishJobs)
      .values({
        id,
        projectId: input.projectId,
        branch: input.branch,
        userId: input.user.id,
        rootMap: input.rootMap,
        format: input.format,
        ditaval: input.ditaval ?? null,
        title,
        status: 'queued',
        optionsJson,
        createdAt: now,
        logPath,
        snapshotPath: join(jobDir, 'snapshot'),
        outputPath: join(jobDir, 'output'),
        cancelRequested: 0,
        sourceMode: provenance.sourceMode,
        sourceRef: provenance.sourceRef,
        commitHash: provenance.commitHash,
        isDirty: provenance.isDirty ? 1 : 0,
        dirtyFilesJson:
          provenance.dirtyFiles.length > 0 ? JSON.stringify(provenance.dirtyFiles) : null,
      })
      .run();

    try {
      this.audit?.record({
        projectId: input.projectId,
        branch: input.branch,
        actorId: input.user.id,
        action: 'publish',
        targetPath: input.rootMap,
        details: {
          jobId: id,
          sourceMode: provenance.sourceMode,
          sourceRef: provenance.sourceRef,
          commitHash: provenance.commitHash,
          isDirty: provenance.isDirty,
          dirtyFiles: provenance.dirtyFiles,
        },
      });
    } catch (err) {
      this.logger('failed to record publish audit entry', err);
    }

    this.queue.enqueue(id);
    const view = this.getJob(id);
    if (!view) throw httpError(500, 'publish.createFailed');
    return view;
  }

  listJobs(projectId: string, branch: string, limit = 20): PublishJobView[] {
    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);
    return this.db
      .select()
      .from(publishJobs)
      .where(and(eq(publishJobs.projectId, projectId), eq(publishJobs.branch, branch)))
      .orderBy(desc(publishJobs.createdAt))
      .limit(safeLimit)
      .all()
      .map((row) => this.toView(row));
  }

  getJobRow(id: string): PublishJobRow | null {
    return this.db.select().from(publishJobs).where(eq(publishJobs.id, id)).get() ?? null;
  }

  getJob(id: string): PublishJobView | null {
    const row = this.getJobRow(id);
    return row ? this.toView(row) : null;
  }

  async cancelJob(job: PublishJobRow, user: IdentityUser): Promise<PublishJobView> {
    if (user.role !== 'admin' && job.userId !== user.id) {
      throw httpError(403, 'publish.cancelOwnOnly');
    }
    if (TERMINAL_STATUSES.includes(job.status as PublishStatus)) {
      throw httpError(409, 'publish.alreadyFinished');
    }
    const cancelled = this.queue.cancel(job.id);
    if (cancelled === 'queued') {
      this.db
        .update(publishJobs)
        .set({
          status: 'cancelled',
          error: apiT(this.localeForRow(job), 'publish.cancelled'),
          finishedAt: Date.now(),
          cancelRequested: 1,
        })
        .where(eq(publishJobs.id, job.id))
        .run();
    } else {
      this.db
        .update(publishJobs)
        .set({ cancelRequested: 1 })
        .where(eq(publishJobs.id, job.id))
        .run();
    }
    return this.getJob(job.id) ?? this.toView(job);
  }

  /**
   * Phase 13: resolve what the build actually reads and stamp it on the job. `tag` / `commit`
   * resolve to an immutable SHA; `baseline` records `HEAD`; `my_drafts` additionally records the
   * requester's own draft paths so a preview build is auditable without leaking anyone else's.
   */
  private async resolveProvenance(input: CreatePublishJobInput): Promise<{
    sourceMode: PublishSourceMode;
    sourceRef: string | null;
    commitHash: string | null;
    isDirty: boolean;
    dirtyFiles: string[];
    projectRootDir: string;
  }> {
    const sourceMode: PublishSourceMode = input.sourceMode ?? 'baseline';
    const sourceRef = input.sourceRef?.trim() || null;
    const projectRootDir = input.projectRootDir ?? input.workDir;
    const gitReady = Boolean(this.git?.isRepository(projectRootDir));

    if (sourceMode === 'tag' || sourceMode === 'commit') {
      if (!sourceRef) {
        throw new HttpError(400, `Publishing from a ${sourceMode} requires a reference.`);
      }
      if (!this.git || !gitReady) {
        throw new HttpError(400, 'Publishing from a Git reference requires a Git repository.');
      }
      const commitHash = await this.git.resolveCommit(projectRootDir, sourceRef);
      return { sourceMode, sourceRef, commitHash, isDirty: false, dirtyFiles: [], projectRootDir };
    }

    if (sourceMode === 'my_drafts' && !this.drafts) {
      throw new HttpError(400, 'Personal draft previews are not available.');
    }

    const commitHash = gitReady ? await this.git!.headCommit(input.workDir) : null;
    const dirtyFiles =
      sourceMode === 'my_drafts'
        ? (this.drafts?.listUserDrafts(input.projectId, input.branch, input.user.id) ?? []).map(
            (draft) => draft.filePath,
          )
        : [];
    return {
      sourceMode,
      sourceRef,
      commitHash,
      isDirty: dirtyFiles.length > 0,
      dirtyFiles,
      projectRootDir,
    };
  }

  private toView(row: PublishJobRow): PublishJobView {
    const succeeded = row.status === 'succeeded';
    const theme = this.themeForRow(row);
    const pdfTheme = this.pdfThemeForRow(row);
    return {
      id: row.id,
      projectId: row.projectId,
      branch: row.branch,
      userId: row.userId,
      rootMap: row.rootMap,
      format: row.format as PublishFormat,
      ditaval: row.ditaval,
      title: row.title,
      status: row.status as PublishStatus,
      createdAt: new Date(row.createdAt).toISOString(),
      startedAt: toIso(row.startedAt),
      finishedAt: toIso(row.finishedAt),
      durationMs:
        row.startedAt != null && row.finishedAt != null
          ? Math.max(0, row.finishedAt - row.startedAt)
          : null,
      exitCode: row.exitCode,
      error: row.error,
      artifactName: row.artifactName,
      artifactSize: row.artifactSize,
      diagnostics: parseDiagnostics(row.diagnosticsJson),
      previewUrl:
        succeeded && row.format === 'html5' && row.outputPath
          ? `/api/publish/jobs/${row.id}/preview/index.html`
          : null,
      artifactUrl: succeeded && row.artifactPath ? `/api/publish/jobs/${row.id}/artifact` : null,
      logUrl: `/api/publish/jobs/${row.id}/log`,
      cancelRequested: row.cancelRequested === 1,
      themeId: theme?.themeId ?? null,
      themeOptions: theme?.options ?? null,
      pdfThemeId: pdfTheme?.themeId ?? null,
      pdfThemeOptions: pdfTheme?.options ?? null,
      sourceMode: normalizeSourceMode(row.sourceMode),
      sourceRef: row.sourceRef ?? null,
      commitHash: row.commitHash ?? null,
      isDirty: row.isDirty === 1,
      dirtyFiles: parseDirtyFiles(row.dirtyFilesJson),
    };
  }

  /**
   * HTML5 theme snapshot stored in `optionsJson.htmlTheme`. Legacy rows (and every PDF job) have
   * no such key and resolve to `null`, so the view stays backwards compatible.
   */
  private themeForRow(
    row: PublishJobRow,
  ): { themeId: HtmlThemeId; options: HtmlThemeOptions } | null {
    if (!row.optionsJson) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.optionsJson);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const htmlTheme = (parsed as { htmlTheme?: unknown }).htmlTheme;
    if (typeof htmlTheme !== 'object' || htmlTheme === null) return null;
    const themeId = (htmlTheme as { themeId?: unknown }).themeId;
    if (!isHtmlThemeId(themeId)) return null;
    return {
      themeId,
      options:
        themeId === 'vanilla'
          ? {}
          : resolveThemeOptions((htmlTheme as { options?: unknown }).options),
    };
  }

  /**
   * PDF theme snapshot stored in `optionsJson.pdfTheme` (Phase 15). HTML5 jobs and legacy PDF
   * rows have no such key and resolve to `null`, which the build treats as `vanilla`.
   */
  private pdfThemeForRow(
    row: PublishJobRow,
  ): { themeId: PdfThemeId; options: PdfThemeOptions } | null {
    if (!row.optionsJson) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.optionsJson);
    } catch {
      return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const pdfTheme = (parsed as { pdfTheme?: unknown }).pdfTheme;
    if (typeof pdfTheme !== 'object' || pdfTheme === null) return null;
    const themeId = (pdfTheme as { themeId?: unknown }).themeId;
    if (!isPdfThemeId(themeId)) return null;
    return {
      themeId,
      options:
        themeId === 'vanilla'
          ? {}
          : resolvePdfThemeOptions(themeId, (pdfTheme as { options?: unknown }).options),
    };
  }

  /**
   * The manual/branch worktree snapshot source. Phase 10 makes workspaces per-request, so the
   * work dir is persisted with the job instead of read from a mutable process singleton.
   */
  private sourceDirForRow(row: PublishJobRow): string {
    if (row.optionsJson) {
      try {
        const parsed = JSON.parse(row.optionsJson) as { workDir?: string };
        if (parsed.workDir) return parsed.workDir;
      } catch {
        // fall through to the legacy singleton path
      }
    }
    return this.workspace.getRootDir();
  }

  /** Repository root persisted at job creation (`optionsJson.projectRootDir`). */
  private projectRootDirForRow(row: PublishJobRow): string {
    if (row.optionsJson) {
      try {
        const parsed = JSON.parse(row.optionsJson) as { projectRootDir?: string };
        if (parsed.projectRootDir) return parsed.projectRootDir;
      } catch {
        // fall through to the work dir / legacy singleton path
      }
    }
    return this.sourceDirForRow(row);
  }

  /** Locale persisted at job creation (`optionsJson.locale`), defaulting to zh-CN. */
  private localeForRow(row: PublishJobRow | null): ApiLocale {
    if (!row?.optionsJson) return 'zh-CN';
    try {
      const parsed = JSON.parse(row.optionsJson) as { locale?: string };
      return parsed.locale === 'en' ? 'en' : 'zh-CN';
    } catch {
      return 'zh-CN';
    }
  }

  private async runJob(jobId: string, signal: AbortSignal): Promise<void> {
    const row = this.getJobRow(jobId);
    if (!row || row.status !== 'queued' || row.cancelRequested === 1) {
      if (row && row.status === 'queued') {
        this.db
          .update(publishJobs)
          .set({
            status: 'cancelled',
            error: apiT(this.localeForRow(row), 'publish.cancelled'),
            finishedAt: Date.now(),
          })
          .where(eq(publishJobs.id, jobId))
          .run();
      }
      return;
    }

    const locale = this.localeForRow(row);
    const startedAt = Date.now();
    this.db
      .update(publishJobs)
      .set({ status: 'running', startedAt })
      .where(eq(publishJobs.id, jobId))
      .run();

    const jobDir = dirname(row.logPath ?? join(this.publishRootDir, 'jobs', jobId, 'build.log'));
    const snapshotDir = row.snapshotPath ?? join(jobDir, 'snapshot');
    const outputDir = row.outputPath ?? join(jobDir, 'output');
    const logPath = row.logPath ?? join(jobDir, 'build.log');
    let logStream: WriteStream | null = null;
    let logError: unknown = null;

    const finish = (patch: PublishJobPatch) => {
      this.db.update(publishJobs).set(patch).where(eq(publishJobs.id, jobId)).run();
    };

    try {
      await mkdir(jobDir, { recursive: true });
      await rm(snapshotDir, { recursive: true, force: true });
      await mkdir(snapshotDir, { recursive: true });
      await rm(outputDir, { recursive: true, force: true });
      await mkdir(outputDir, { recursive: true });

      await this.materializeSnapshot(row, snapshotDir, jobDir);

      const inputAbs = resolve(snapshotDir, row.rootMap);
      if (!isInside(snapshotDir, inputAbs) || !existsSync(inputAbs)) {
        throw new Error(apiT(locale, 'publish.rootMapMissing', { path: row.rootMap }));
      }

      const format = row.format as PublishFormat;
      const theme = format === 'html5' ? this.themeForRow(row) : null;
      const args = [
        `--input=${inputAbs}`,
        `--format=${format}`,
        `--output=${outputDir}`,
        '--validate=yes',
        '--processing-mode=strict',
      ];
      if (row.ditaval) {
        const ditavalAbs = resolve(snapshotDir, row.ditaval);
        if (!isInside(snapshotDir, ditavalAbs) || !existsSync(ditavalAbs)) {
          throw new Error(apiT(locale, 'publish.ditavalMissing', { path: row.ditaval }));
        }
        args.push(`--filter=${ditavalAbs}`);
      }
      if (theme && theme.themeId !== 'vanilla') {
        // The themed portal needs a full navigation TOC plus task labels, which the DITA-OT
        // default HTML5 transform leaves out.
        args.push('--nav-toc=full', '--args.gen.task.lbl=YES');
      }
      let fopConfig: string | null = null;
      let pdfThemeLog: string | null = null;
      let pdfWarnings: string[] = [];
      if (format === 'pdf') {
        const pdfTheme = this.pdfThemeForRow(row);
        const pdfThemeId = pdfTheme?.themeId ?? DEFAULT_PDF_THEME_ID;
        const resolvedPdfTheme = resolvePdfTheme(pdfThemeId, pdfTheme?.options ?? {});
        const customization = await preparePdfCustomizationDir({
          jobDir,
          snapshotDir,
          themeId: pdfThemeId,
          themeOptions: pdfTheme?.options ?? {},
          themesDir: this.pdfThemesDir,
          pluginDir: resolve(this.runtimeOptions.pluginDir ?? defaultPluginDir()),
        });
        args.push(`--customization.dir=${customization.customizationDir}`);
        args.push(...customization.extraDitaArgs);
        pdfWarnings = customization.warnings;
        pdfThemeLog =
          `# pdf theme: ${pdfThemeId} (pageSize=${resolvedPdfTheme.pageSize},` +
          ` fontFamily=${resolvedPdfTheme.fontFamily}, fontSize=${resolvedPdfTheme.fontSize},` +
          ` margins=${resolvedPdfTheme.margins}, accent=${resolvedPdfTheme.accent})\n`;
        fopConfig = await this.prepareFopConfig(jobDir);
        if (fopConfig) args.push(`--args.fo.userconfig=${fopConfig}`);
      }

      const command = resolveDitaCommand(this.runtimeOptions);
      const commandLine = [command, ...args]
        .map((part) => (part.includes(' ') ? JSON.stringify(part) : part))
        .join(' ');
      await writeFile(
        logPath,
        `# DITAEditor publish job ${jobId}\n# root map: ${row.rootMap}\n# format: ${format}\n# command: ${commandLine}\n\n`,
        'utf8',
      );
      logStream = createWriteStream(logPath, { flags: 'a' });
      logStream.on('error', (err) => {
        logError = err;
      });
      const stream = logStream;
      const appendLog = (line: string) => {
        try {
          stream.write(line);
        } catch (err) {
          logError = err;
        }
      };
      if (fopConfig) appendLog(`# FOP config: ${fopConfig}\n`);
      if (pdfThemeLog) appendLog(pdfThemeLog);
      for (const warning of pdfWarnings) appendLog(`# pdf theme warning: ${warning}\n`);
      appendLog(`# snapshot: ${snapshotDir}\n\n`);

      const result = await runDita({
        command,
        args,
        cwd: snapshotDir,
        timeoutMs: this.timeoutMs,
        signal,
        onOutput: (chunk) => appendLog(chunk),
      });
      appendLog(`\n# exit code: ${String(result.exitCode)}\n`);
      await new Promise<void>((resolvePromise) => {
        stream.end(() => resolvePromise());
      });
      logStream = null;
      if (logError) throw logError;

      const parsedDiagnostics = parseDitaLog(
        `${result.stdout}\n${result.stderr}`,
        {
          roots: [
            { absolute: snapshotDir, displayPrefix: '' },
            { absolute: outputDir, displayPrefix: '' },
          ],
          fallbackPath: row.rootMap,
        },
      );
      const logText = await readLogForDiagnostics(logPath);
      const logDiagnostics = parseDitaLog(logText, {
        roots: [
          { absolute: snapshotDir, displayPrefix: '' },
          { absolute: outputDir, displayPrefix: '' },
        ],
        fallbackPath: row.rootMap,
      });
      const diagnosticMap = new Map<string, DitaDiagnostic>();
      for (const diagnostic of [...parsedDiagnostics, ...logDiagnostics]) {
        diagnosticMap.set(
          `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code ?? ''}:${diagnostic.message}`,
          diagnostic,
        );
      }
      let diagnostics = [...diagnosticMap.values()];
      const cancelled = result.cancelled || signal.aborted;
      const failed = !cancelled && (result.exitCode !== 0 || result.timedOut);

      if (cancelled) {
        finish({
          status: 'cancelled',
          error: apiT(locale, 'publish.cancelled'),
          finishedAt: Date.now(),
          exitCode: result.exitCode,
          diagnosticsJson: JSON.stringify(diagnostics),
        });
        return;
      }

      if (failed) {
        if (diagnostics.length === 0) {
          diagnostics = [
            fallbackDitaDiagnostic(
              row.rootMap,
              result.timedOut ? apiT(locale, 'publish.timeout') : apiT(locale, 'publish.failed'),
            ),
          ];
        }
        const firstError = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
        finish({
          status: 'failed',
          error: withFontHint(
            locale,
            logText,
            (firstError?.message ?? apiT(locale, 'publish.failedShort')).slice(0, 2000),
          ),
          finishedAt: Date.now(),
          exitCode: result.exitCode,
          diagnosticsJson: JSON.stringify(diagnostics),
        });
        return;
      }

      let artifactPath: string;
      let artifactName: string;
      if (format === 'pdf') {
        const pdfPath = await findFirstPdf(outputDir);
        if (!pdfPath) {
          throw new Error(apiT(locale, 'publish.noPdf'));
        }
        artifactPath = pdfPath;
        artifactName = `${sanitizeFileStem(row.title)}.pdf`;
      } else {
        const indexExists = existsSync(join(outputDir, 'index.html'));
        if (!indexExists) {
          throw new Error(apiT(locale, 'publish.noIndexHtml'));
        }
        artifactPath = join(jobDir, 'artifact.zip');
        artifactName = `${sanitizeFileStem(row.title)}-html5.zip`;
        if (theme && theme.themeId !== 'vanilla') {
          await this.enhanceThemeOutput({
            jobId,
            themeId: theme.themeId,
            options: theme.options,
            outputDir,
            snapshotDir,
            logPath,
            locale,
          });
        }
        const zip = await createZipFromDirectory(outputDir, artifactPath);
        this.logger(`publish ${jobId}: zipped ${zip.entries} files (${zip.bytes} bytes)`);
      }
      const artifactInfo = await stat(artifactPath);
      finish({
        status: 'succeeded',
        error: null,
        finishedAt: Date.now(),
        exitCode: result.exitCode,
        artifactPath,
        artifactName,
        artifactSize: artifactInfo.size,
        diagnosticsJson: JSON.stringify(diagnostics),
      });
    } catch (err) {
      if (logStream) {
        try {
          logStream.end();
        } catch {
          // ignore
        }
      }
      const message = localizeErrorMessage(err, locale);
      const cancelled = signal.aborted;
      let diagnostics: DitaDiagnostic[] = [];
      try {
        const logText = await readLogForDiagnostics(logPath);
        diagnostics = parseDitaLog(logText, {
          roots: [
            { absolute: snapshotDir, displayPrefix: '' },
            { absolute: outputDir, displayPrefix: '' },
          ],
          fallbackPath: row.rootMap,
        });
      } catch {
        // log may not exist yet
      }
      if (diagnostics.length === 0) {
        diagnostics = [fallbackDitaDiagnostic(row.rootMap, message)];
      }
      finish({
        status: cancelled ? 'cancelled' : 'failed',
        error: cancelled ? apiT(locale, 'publish.cancelled') : message.slice(0, 2000),
        finishedAt: Date.now(),
        diagnosticsJson: JSON.stringify(diagnostics),
      });
      this.logger(`publish job ${jobId} failed`, err);
    }
  }

  /**
   * The bundled fop.xconf targets single-face Noto CJK OTFs, which is not what Debian ships:
   * FOP matches `sub-font` against a face's full name (and that name differs per weight), and
   * FOP 2.9 cannot embed a CFF collection at all (`'loca' table not found`). The job-local copy
   * is therefore rebuilt from the faces of the fonts that are actually installed, each
   * materialised as a standalone font file under `<job>/fonts`, and `<font-base>` is pointed at
   * that directory. Local DITA-OT installs with Noto CJK elsewhere get the same treatment.
   */
  private async prepareFopConfig(jobDir: string): Promise<string | null> {
    const template = resolveFopConfig(this.runtimeOptions);
    if (!template) return null;
    const fontDir = resolveNotoFontDir(this.runtimeOptions);
    if (!fontDir) return template;
    try {
      const content = await readFile(template, 'utf8');
      const files = await discoverNotoCjkFontFiles(fontDir);
      const targetDir = join(jobDir, 'fonts');
      const entries = await materializeNotoFopFonts({
        fontDir,
        targetDir,
        files,
        plan: planNotoFopFonts(files),
      });
      const updated = applyFopFontEntries(
        applyFontBase(content, entries.length > 0 ? targetDir : fontDir),
        entries,
      );
      if (entries.length === 0) {
        this.logger(
          `no Noto CJK faces found in ${fontDir}; PDF jobs fall back to the bundled fop.xconf font table`,
        );
      }
      // A malformed generated config fails deep inside FOP ("ConfigurationException: xml parse
      // error"), so refuse to hand FOP anything we cannot parse ourselves.
      if (!checkXmlWellFormed(updated).ok) {
        this.logger(
          `generated fop.xconf for ${jobDir} is not well-formed; publishing with ${template}`,
        );
        return template;
      }
      const target = join(jobDir, 'fop.xconf');
      await writeFile(target, updated, 'utf8');
      return target;
    } catch {
      return template;
    }
  }

  async pruneExpired(): Promise<number> {
    if (this.retentionDays <= 0) return 0;
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const rows = this.db
      .select()
      .from(publishJobs)
      .where(and(lt(publishJobs.createdAt, cutoff), inArray(publishJobs.status, TERMINAL_STATUSES)))
      .all();
    for (const row of rows) {
      const jobDir = row.logPath ? dirname(row.logPath) : join(this.publishRootDir, 'jobs', row.id);
      try {
        await rm(jobDir, { recursive: true, force: true });
      } catch (err) {
        this.logger(`failed to remove expired publish job ${row.id}`, err);
      }
      this.db.delete(publishJobs).where(eq(publishJobs.id, row.id)).run();
    }
    return rows.length;
  }

  /**
   * Applies the themed portal shell to a fresh DITA-OT HTML5 output. Assets are resolved lazily
   * so a server without the html-themes bundle can still publish PDF and vanilla HTML5 jobs.
   */
  /**
   * Phase 13: build the snapshot from an immutable commit/tag when possible, overlay only the
   * requester's own drafts for `my_drafts`, and never fall back to a dirty shared work dir for a
   * formal publish.
   */
  private async materializeSnapshot(
    row: PublishJobRow,
    snapshotDir: string,
    jobDir: string,
  ): Promise<void> {
    const sourceMode = normalizeSourceMode(row.sourceMode);
    const projectRootDir = this.projectRootDirForRow(row);
    const gitReady = Boolean(this.git?.isRepository(projectRootDir));
    const ref = row.commitHash ?? row.sourceRef ?? null;

    if (sourceMode === 'tag' || sourceMode === 'commit') {
      if (!this.git || !gitReady || !ref) {
        throw new Error(`Git reference ${row.sourceRef ?? ''} is no longer available.`);
      }
      await this.git.archiveRef(projectRootDir, ref, snapshotDir);
      return;
    }

    if (sourceMode === 'my_drafts') {
      const baselineDir = join(jobDir, 'baseline');
      await rm(baselineDir, { recursive: true, force: true });
      await mkdir(baselineDir, { recursive: true });
      try {
        if (this.git && gitReady && ref) {
          await this.git.archiveRef(projectRootDir, ref, baselineDir);
        } else {
          await this.copyWorkspace(this.sourceDirForRow(row), baselineDir);
        }
        if (this.drafts) {
          await this.drafts.materializeOverlayDir({
            baselineDir,
            projectId: row.projectId,
            branch: row.branch,
            userId: row.userId,
            destDir: snapshotDir,
          });
        } else {
          await this.copyWorkspace(baselineDir, snapshotDir);
        }
      } finally {
        await rm(baselineDir, { recursive: true, force: true });
      }
      return;
    }

    if (this.git && gitReady && ref) {
      await this.git.archiveRef(projectRootDir, ref, snapshotDir);
      return;
    }
    await this.copyWorkspace(this.sourceDirForRow(row), snapshotDir);
  }

  private async copyWorkspace(sourceDir: string, destDir: string): Promise<void> {
    const publishRoot = resolve(this.publishRootDir);
    await cp(sourceDir, destDir, {
      recursive: true,
      force: true,
      dereference: false,
      filter: (source) => {
        const absSource = resolve(source);
        if (isInside(publishRoot, absSource)) {
          return false;
        }
        const entry = basename(absSource);
        if (absSource !== resolve(sourceDir) && EXCLUDED_SNAPSHOT_ENTRIES.has(entry)) {
          return false;
        }
        return true;
      },
    });
  }

  private async enhanceThemeOutput(params: {
    jobId: string;
    themeId: HtmlThemeId;
    options: HtmlThemeOptions;
    outputDir: string;
    snapshotDir: string;
    logPath: string;
    locale: ApiLocale;
  }): Promise<void> {
    const { themeId, logPath, locale } = params;
    let themesDir: string;
    try {
      themesDir = resolveHtmlThemesDir(this.htmlThemesDirOverride);
    } catch (err) {
      this.logger(`publish ${params.jobId}: html-themes assets missing`, err);
      throw new Error(apiT(locale, 'publish.themeAssetsMissing'));
    }
    try {
      const result = await enhanceHtml5Output({
        outputDir: params.outputDir,
        themeId,
        options: params.options,
        themesDir,
        workspaceRoot: params.snapshotDir,
        locale,
        onWarn: (message) => void this.handleLog(logPath, `# theme warning: ${message}`),
      });
      await this.handleLog(
        logPath,
        `# theme ${themeId}: ${result.pages} pages, ${result.assets.length} assets, ` +
          `${result.searchEntries.length} search entries, ${result.warnings.length} warnings`,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await this.handleLog(logPath, `# theme ${themeId} failed: ${detail}`);
      this.logger(`publish ${params.jobId}: html theme enhancement failed`, err);
      throw new Error(apiT(locale, 'publish.themeEnhanceFailed', { message: detail }));
    }
  }

  /** Append a line to a job log after the build stream has been closed. */
  private async handleLog(logPath: string, line: string): Promise<void> {
    try {
      await appendFile(logPath, `${line}\n`, 'utf8');
    } catch {
      // the log file may be gone (retention pruning); the job result does not depend on it
    }
  }

  /** Append a line to a job log; used by routes for user actions such as cancellation. */
  async appendJobLog(jobId: string, line: string): Promise<void> {
    const row = this.getJobRow(jobId);
    if (!row?.logPath) return;
    try {
      await appendFile(row.logPath, `${line}\n`, 'utf8');
    } catch {
      // log may not exist yet (queued job)
    }
  }
}

export { TERMINAL_STATUSES };
