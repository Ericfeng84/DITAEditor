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
import type { DitaDatabase } from '../../db/client.js';
import { publishJobs, type PublishJobRow } from '../../db/schema.js';
import { HttpError } from '../errors.js';
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
import { PublishQueue } from './publish-queue.js';
import { createZipFromDirectory } from './zip-store.js';

export type PublishFormat = 'html5' | 'pdf';
export type PublishStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface CreatePublishJobInput {
  user: IdentityUser;
  workDir: string;
  projectId: string;
  branch: string;
  rootMap: string;
  format: PublishFormat;
  ditaval?: string | null;
  title?: string;
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

export class PublishService {
  private readonly db: DitaDatabase;
  private readonly workspace: WorkspaceManager;
  private readonly publishRootDir: string;
  private readonly runtimeOptions: DitaRuntimeOptions;
  private readonly timeoutMs: number;
  private readonly retentionDays: number;
  private readonly logger: (message: string, error?: unknown) => void;
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
          error: '服务重启后中断，请重新发布。',
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

  async getRuntime(force = true): Promise<DitaRuntimeInfo> {
    return detectDitaRuntime(this.runtimeOptions, { force });
  }

  async createJob(input: CreatePublishJobInput): Promise<PublishJobView> {
    const runtime = await this.getRuntime(false);
    if (!runtime.available) {
      throw new HttpError(
        503,
        runtime.error ??
          '未检测到 DITA-OT CLI。请安装 DITA-OT 4.x、设置 DITA_OT_HOME，或使用项目 Docker 镜像。',
        { runtime },
      );
    }
    const id = `pub-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();
    const jobDir = join(this.publishRootDir, 'jobs', id);
    await mkdir(join(jobDir, 'snapshot'), { recursive: true });
    await mkdir(join(jobDir, 'output'), { recursive: true });
    const logPath = join(jobDir, 'build.log');
    const fallbackTitle = basename(input.rootMap, extname(input.rootMap));
    const title = input.title?.trim() || fallbackTitle;

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
        optionsJson: JSON.stringify({ timeoutMs: this.timeoutMs }),
        createdAt: now,
        logPath,
        snapshotPath: join(jobDir, 'snapshot'),
        outputPath: join(jobDir, 'output'),
        cancelRequested: 0,
      })
      .run();

    this.queue.enqueue(id);
    const view = this.getJob(id);
    if (!view) throw new HttpError(500, '发布任务创建失败');
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
      throw new HttpError(403, '只能取消自己发起的发布任务');
    }
    if (TERMINAL_STATUSES.includes(job.status as PublishStatus)) {
      throw new HttpError(409, '任务已结束，无法取消');
    }
    const cancelled = this.queue.cancel(job.id);
    if (cancelled === 'queued') {
      this.db
        .update(publishJobs)
        .set({
          status: 'cancelled',
          error: '发布已取消',
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

  private toView(row: PublishJobRow): PublishJobView {
    const succeeded = row.status === 'succeeded';
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
          ? `/api/publish/jobs/${row.id}/preview/`
          : null,
      artifactUrl: succeeded && row.artifactPath ? `/api/publish/jobs/${row.id}/artifact` : null,
      logUrl: `/api/publish/jobs/${row.id}/log`,
      cancelRequested: row.cancelRequested === 1,
    };
  }

  private async runJob(jobId: string, signal: AbortSignal): Promise<void> {
    const row = this.getJobRow(jobId);
    if (!row || row.status !== 'queued' || row.cancelRequested === 1) {
      if (row && row.status === 'queued') {
        this.db
          .update(publishJobs)
          .set({ status: 'cancelled', error: '发布已取消', finishedAt: Date.now() })
          .where(eq(publishJobs.id, jobId))
          .run();
      }
      return;
    }

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

      const publishRoot = resolve(this.publishRootDir);
      await cp(this.workspace.getRootDir(), snapshotDir, {
        recursive: true,
        force: true,
        dereference: false,
        filter: (source) => {
          const absSource = resolve(source);
          if (isInside(publishRoot, absSource)) {
            return false;
          }
          const entry = basename(absSource);
          if (absSource !== resolve(this.workspace.getRootDir()) && EXCLUDED_SNAPSHOT_ENTRIES.has(entry)) {
            return false;
          }
          return true;
        },
      });

      const inputAbs = resolve(snapshotDir, row.rootMap);
      if (!isInside(snapshotDir, inputAbs) || !existsSync(inputAbs)) {
        throw new Error(`Root Map 不存在或已移动：${row.rootMap}`);
      }

      const format = row.format as PublishFormat;
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
          throw new Error(`DITAVAL 文件不存在：${row.ditaval}`);
        }
        args.push(`--filter=${ditavalAbs}`);
      }
      let fopConfig: string | null = null;
      if (format === 'pdf') {
        const customizationDir = resolve(
          this.runtimeOptions.pluginDir ?? defaultPluginDir(),
        );
        if (existsSync(join(customizationDir, 'catalog.xml'))) {
          args.push(`--customization.dir=${customizationDir}`);
        }
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
          error: '发布已取消',
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
              result.timedOut
                ? 'DITA-OT 发布超时。'
                : 'DITA-OT 发布失败，请查看构建日志。',
            ),
          ];
        }
        const firstError = diagnostics.find((diagnostic) => diagnostic.severity === 'error');
        finish({
          status: 'failed',
          error: (firstError?.message ?? 'DITA-OT 发布失败').slice(0, 2000),
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
          throw new Error('DITA-OT 未生成 PDF 文件，请查看构建日志。');
        }
        artifactPath = pdfPath;
        artifactName = `${sanitizeFileStem(row.title)}.pdf`;
      } else {
        const indexExists = existsSync(join(outputDir, 'index.html'));
        if (!indexExists) {
          throw new Error('DITA-OT 未生成 index.html，请查看构建日志。');
        }
        artifactPath = join(jobDir, 'artifact.zip');
        artifactName = `${sanitizeFileStem(row.title)}-html5.zip`;
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
      const message = err instanceof Error ? err.message : String(err);
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
        error: cancelled ? '发布已取消' : message.slice(0, 2000),
        finishedAt: Date.now(),
        diagnosticsJson: JSON.stringify(diagnostics),
      });
      this.logger(`publish job ${jobId} failed`, err);
    }
  }

  /**
   * The bundled fop.xconf targets the Debian/Docker font path. Local DITA-OT installs often keep
   * Noto CJK elsewhere, so materialise a job-local copy with the detected font-base directory.
   */
  private async prepareFopConfig(jobDir: string): Promise<string | null> {
    const template = resolveFopConfig(this.runtimeOptions);
    if (!template) return null;
    const fontDir = resolveNotoFontDir(this.runtimeOptions);
    if (!fontDir) return template;
    try {
      const content = await readFile(template, 'utf8');
      const escaped = fontDir
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const updated = content.replace(
        /<font-base>[^<]*<\/font-base>/,
        `<font-base>${escaped}</font-base>`,
      );
      if (updated === content) return template;
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
