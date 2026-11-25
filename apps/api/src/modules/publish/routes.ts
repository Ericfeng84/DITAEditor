import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError, httpError, localizeErrorMessage } from '../errors.js';
import { resolveRequestLocale } from '../../i18n/locale.js';
import { apiT } from '../../i18n/messages.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { resolveSafeWorkspacePath } from '../files/workspace-fs.js';
import {
  handlePhase4Error,
  resolvePhase4Scope,
  type LockRouteOptions,
} from '../locks/routes.js';
import type { PublishJobRow } from '../../db/schema.js';
import type { PublishService } from './publish-service.js';
import {
  THEME_OPTION_LIMITS,
  getHtmlTheme,
  htmlThemeIdSchema,
  htmlThemeOptionsSchema,
  isValidAccent,
  listHtmlThemes,
  resolveHtmlThemesDir,
  type HtmlThemeFeatures,
  type HtmlThemeId,
  type HtmlThemeOptions,
} from './html-themes.js';
import { HtmlThemePreviewError, renderHtmlThemePreview } from './theme-preview.js';
import { mergeThemeOptions, type PublishProfileService } from './publish-profiles.js';

const createJobSchema = z.object({
  rootMap: z.string().min(1),
  format: z.enum(['html5', 'pdf']),
  ditaval: z.string().min(1).nullable().optional(),
  title: z.string().trim().max(120).optional(),
  themeId: htmlThemeIdSchema.optional(),
  htmlThemeOptions: htmlThemeOptionsSchema.optional(),
  saveAsDefault: z.boolean().optional(),
});

const saveProfileSchema = z.object({
  themeId: htmlThemeIdSchema,
  themeOptions: htmlThemeOptionsSchema.optional(),
});

export interface PublishRouteOptions extends LockRouteOptions {
  publish: PublishService;
  profiles: PublishProfileService;
  /** Overrides the bundled `dita-ot-plugins/html5-themes` asset directory. */
  htmlThemesDir?: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function parseLimit(raw: unknown): number {
  if (typeof raw !== 'string') return 20;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 20;
}

function requireJob(options: PublishRouteOptions, id: string, projectId: string): PublishJobRow {
  const job = options.publish.getJobRow(id);
  if (!job || job.projectId !== projectId) {
    throw httpError(404, 'publish.jobNotFound');
  }
  return job;
}

/**
 * Published artifacts (`previewUrl`, `artifactUrl`) are opened by the browser itself — a new tab,
 * an `<a download>`, or the relative CSS/JS/topic requests below the preview document — and a
 * browser navigation cannot send `x-dita-manual-id` / `x-dita-branch`. Resolving the manual from
 * headers would silently fall back to the most recently activated manual and answer 404 for any
 * other manual in the workbench. The job id already pins the published manual, so these read-only
 * routes look the job up directly instead of trusting the (absent) scope headers.
 */
function requirePublishedJob(options: PublishRouteOptions, id: string): PublishJobRow {
  const job = options.publish.getJobRow(id);
  if (!job) {
    throw httpError(404, 'publish.jobNotFound');
  }
  return job;
}

function requirePublisher(user: IdentityUser): void {
  if (user.role === 'viewer') {
    throw httpError(403, 'publish.viewerForbidden');
  }
}

/** Profile rows are scoped per manual; legacy callers without a manual fall back to the project. */
function profileManualId(scope: { manualId?: string; projectId: string }): string {
  return scope.manualId ?? scope.projectId;
}

const PREVIEW_FEATURE_KEYS = ['search', 'toc', 'codeCopy', 'colorModeToggle'] as const;

function previewFlag(raw: unknown): boolean | undefined {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return undefined;
}

function previewText(raw: unknown, limit: number): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
}

/** Query-string theme options for the live preview; invalid accents are rejected, not coerced. */
function previewOptions(query: Record<string, unknown>): HtmlThemeOptions {
  const options: HtmlThemeOptions = {};
  const accent = typeof query.accent === 'string' ? query.accent.trim() : '';
  if (accent) {
    if (!isValidAccent(accent)) {
      throw httpError(400, 'publish.invalidThemeOptions', undefined, { accent });
    }
    options.accentColor = accent.startsWith('#') ? accent.toLowerCase() : `#${accent.toLowerCase()}`;
  }
  const siteTitle = previewText(query.title, THEME_OPTION_LIMITS.siteTitle);
  if (siteTitle) options.siteTitle = siteTitle;
  const footerText = previewText(query.footer, THEME_OPTION_LIMITS.footerText);
  if (footerText) options.footerText = footerText;
  const features: Partial<HtmlThemeFeatures> = {};
  for (const key of PREVIEW_FEATURE_KEYS) {
    const flag = previewFlag(query[key]);
    if (flag !== undefined) features[key] = flag;
  }
  if (Object.keys(features).length > 0) options.features = features;
  return options;
}

async function resolveWorkspacePath(
  workDir: string,
  rawPath: string,
  extensions: string[],
  label: string,
): Promise<string> {
  const safe = await resolveSafeWorkspacePath(workDir, rawPath);
  if (!extensions.includes(extname(safe.posixPath).toLowerCase())) {
    throw httpError(400, 'publish.unsupportedFile', { label, path: safe.posixPath });
  }
  try {
    const info = await stat(safe.absPath);
    if (!info.isFile()) throw new Error('not a file');
  } catch {
    throw httpError(404, 'publish.fileNotFound', { label, path: safe.posixPath });
  }
  return safe.posixPath;
}

function disposition(kind: 'attachment' | 'inline', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function resolvePreviewFile(outputPath: string, wildcard: string): Promise<string | null> {
  const outputRoot = await realpath(outputPath);
  const relativePath = (wildcard || '').replace(/^\/+/, '');
  const requested = resolve(outputRoot, relativePath || 'index.html');
  if (!isInside(outputRoot, requested)) return null;
  let target = requested;
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, 'index.html');
  } catch {
    return null;
  }
  let realTarget: string;
  try {
    realTarget = await realpath(target);
  } catch {
    return null;
  }
  return isInside(outputRoot, realTarget) ? realTarget : null;
}

export function registerPublishRoutes(app: FastifyInstance, options: PublishRouteOptions): void {
  app.get('/api/publish/runtime', async (req, reply) => {
    try {
      const runtime = await options.publish.getRuntime(resolveRequestLocale(req), true);
      return { runtime, publishRootDir: options.publish.rootDir };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/themes', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      options.identity.requireRole(scope.user, ['admin', 'writer', 'viewer']);
      // Descriptors are localized, so the response must not be reused across locales.
      reply.header('cache-control', 'no-cache');
      reply.header('vary', 'x-dita-locale');
      return { themes: listHtmlThemes(resolveRequestLocale(req)) };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/themes/:id/preview', async (req, reply) => {
    const locale = resolveRequestLocale(req);
    try {
      await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      const descriptor = getHtmlTheme(id, locale);
      if (!descriptor) {
        throw httpError(404, 'publish.themeNotFound', { id });
      }
      const previewThemeOptions = previewOptions((req.query ?? {}) as Record<string, unknown>);
      let html: string;
      try {
        html = await renderHtmlThemePreview({
          themeId: descriptor.id,
          options: previewThemeOptions,
          themesDir: resolveHtmlThemesDir(options.htmlThemesDir),
          locale,
        });
      } catch (err) {
        if (err instanceof HtmlThemePreviewError) {
          throw httpError(404, 'publish.themeNotFound', { id });
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw httpError(500, 'publish.themePreviewFailed', undefined, { reason });
      }
      reply.header('cache-control', 'no-store');
      reply.type('text/html; charset=utf-8');
      return reply.send(html);
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/profile', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      options.identity.requireRole(scope.user, ['admin', 'writer', 'viewer']);
      return { profile: options.profiles.get(profileManualId(scope)) };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.put('/api/publish/profile', async (req, reply) => {
    const locale = resolveRequestLocale(req);
    const parsed = saveProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: apiT(locale, 'publish.invalidThemeOptions') });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      requirePublisher(scope.user);
      const themeId = parsed.data.themeId;
      const profile = options.profiles.save(
        profileManualId(scope),
        themeId,
        themeId === 'vanilla' ? {} : parsed.data.themeOptions,
        scope.user.id,
      );
      return { profile };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/jobs', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      if (scope.user.role === 'viewer') {
        // Reading history is safe for viewers; publishing is not.
        options.identity.requireRole(scope.user, ['admin', 'writer', 'viewer']);
      }
      return {
        branch: scope.branch,
        jobs: options.publish.listJobs(scope.projectId, scope.branch, parseLimit(req.query && (req.query as { limit?: unknown }).limit)),
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/publish/jobs', async (req, reply) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({
          error: parsed.error.issues[0]?.message ?? apiT(resolveRequestLocale(req), 'publish.invalidParams'),
        });
    }
    try {
      const scope = await resolvePhase4Scope(req, options);
      requirePublisher(scope.user);
      const rootMap = await resolveWorkspacePath(
        scope.workDir,
        parsed.data.rootMap,
        ['.ditamap', '.bookmap'],
        'Root Map',
      );
      const ditaval = parsed.data.ditaval
        ? await resolveWorkspacePath(scope.workDir, parsed.data.ditaval, ['.ditaval'], 'DITAVAL')
        : null;
      const manualId = profileManualId(scope);
      let themeId: HtmlThemeId | null = null;
      let themeOptions: HtmlThemeOptions = {};
      if (parsed.data.format === 'html5') {
        const profile = options.profiles.get(manualId);
        themeId = parsed.data.themeId ?? profile.htmlThemeId;
        themeOptions =
          themeId === 'vanilla'
            ? {}
            : mergeThemeOptions(profile.htmlThemeOptions, parsed.data.htmlThemeOptions);
        if (parsed.data.saveAsDefault && themeId !== 'vanilla') {
          options.profiles.save(manualId, themeId, themeOptions, scope.user.id);
        }
      }
      const job = await options.publish.createJob({
        user: scope.user,
        workDir: scope.workDir,
        projectId: scope.projectId,
        branch: scope.branch,
        rootMap,
        format: parsed.data.format,
        ditaval,
        title: parsed.data.title,
        locale: resolveRequestLocale(req),
        ...(themeId ? { themeId, themeOptions } : {}),
      });
      return reply.status(202).send({ job });
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/jobs/:id', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      const job = options.publish.getJob(requireJob(options, id, scope.projectId).id);
      return { job };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.post('/api/publish/jobs/:id/cancel', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      options.identity.requireRole(scope.user, ['admin', 'writer']);
      const { id } = req.params as { id: string };
      const row = requireJob(options, id, scope.projectId);
      await options.publish.appendJobLog(id, `# cancellation requested by ${scope.user.displayName}`);
      const job = await options.publish.cancelJob(row, scope.user);
      return { job };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/jobs/:id/log', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      const row = requireJob(options, id, scope.projectId);
      if (!row.logPath) {
        return {
          content: '',
          offset: 0,
          size: 0,
          complete: row.status !== 'queued' && row.status !== 'running',
        };
      }
      let contentBuffer: Buffer;
      try {
        contentBuffer = await readFile(row.logPath);
      } catch {
        return { content: '', offset: 0, size: 0, complete: row.status !== 'queued' };
      }
      const query = (req.query ?? {}) as { offset?: unknown };
      const requested = typeof query.offset === 'string' ? Number(query.offset) : 0;
      const offset = Math.max(0, Math.min(Number.isFinite(requested) ? requested : 0, contentBuffer.length));
      const chunk = contentBuffer.subarray(offset, offset + 256 * 1024);
      const nextOffset = offset + chunk.length;
      return {
        content: chunk.toString('utf8'),
        offset: nextOffset,
        size: contentBuffer.length,
        complete:
          row.status !== 'queued' &&
          row.status !== 'running' &&
          nextOffset >= contentBuffer.length,
      };
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });

  app.get('/api/publish/jobs/:id/events', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      requireJob(options, id, scope.projectId);
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }

    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.write('retry: 1500\n\n');

    const { id } = req.params as { id: string };
    let offset = 0;
    let lastStatus = '';
    let closed = false;
    let ticking = false;

    const writeEvent = (event: string, data: unknown) => {
      if (closed || response.writableEnded) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const tick = async () => {
      if (closed || ticking) return;
      ticking = true;
      try {
        const row = options.publish.getJobRow(id);
        if (!row) {
          writeEvent('end', { reason: 'not-found' });
          cleanup();
          return;
        }
        if (row.logPath) {
          try {
            const buffer = await readFile(row.logPath);
            if (buffer.length > offset) {
              const chunk = buffer.subarray(offset, offset + 128 * 1024);
              offset += chunk.length;
              writeEvent('log', {
                content: chunk.toString('utf8'),
                offset,
                size: buffer.length,
              });
            }
          } catch {
            // log file may not exist while queued
          }
        }
        if (row.status !== lastStatus) {
          lastStatus = row.status;
          writeEvent('status', { job: options.publish.getJob(id) });
        }
        if (['succeeded', 'failed', 'cancelled'].includes(row.status)) {
          writeEvent('end', { job: options.publish.getJob(id) });
          cleanup();
        }
      } finally {
        ticking = false;
      }
    };

    const timer = setInterval(() => void tick(), 700);
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      try {
        response.end();
      } catch {
        // already ended
      }
    };
    req.raw.on('close', cleanup);
    void tick();
  });

  const previewHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const row = requirePublishedJob(options, id);
      if (row.format !== 'html5' || row.status !== 'succeeded' || !row.outputPath) {
        throw httpError(404, 'publish.noHtmlPreview');
      }
      const wildcard = (req.params as { '*': string })['*'] ?? '';
      const filePath = await resolvePreviewFile(row.outputPath, wildcard);
      if (!filePath) {
        throw httpError(404, 'publish.previewMissing');
      }
      const extension = extname(filePath).toLowerCase();
      reply.header('cache-control', extension === '.html' ? 'no-cache' : 'public, max-age=300');
      reply.type(MIME_TYPES[extension] ?? 'application/octet-stream');
      return reply.send(createReadStream(filePath));
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  };
  app.get('/api/publish/jobs/:id/preview', previewHandler);
  app.get('/api/publish/jobs/:id/preview/*', previewHandler);

  app.get('/api/publish/jobs/:id/artifact', async (req, reply) => {
    try {
      const { id } = req.params as { id: string };
      const row = requirePublishedJob(options, id);
      if (row.status !== 'succeeded' || !row.artifactPath) {
        throw httpError(404, 'publish.noArtifact');
      }
      let info;
      try {
        info = await stat(row.artifactPath);
      } catch {
        throw httpError(404, 'publish.artifactPruned');
      }
      if (!info.isFile()) throw httpError(404, 'publish.artifactMissing');
      const query = (req.query ?? {}) as { inline?: string };
      const inline = query.inline === '1' || query.inline === 'true';
      const name = row.artifactName ?? (row.format === 'pdf' ? 'publish.pdf' : 'publish-html5.zip');
      reply.header('content-disposition', disposition(inline ? 'inline' : 'attachment', name));
      reply.header('content-length', String(info.size));
      if (row.format === 'pdf') {
        reply.type('application/pdf');
      } else {
        reply.type('application/zip');
      }
      return reply.send(createReadStream(row.artifactPath));
    } catch (err) {
      return handlePhase4Error(err, req, reply);
    }
  });
}
