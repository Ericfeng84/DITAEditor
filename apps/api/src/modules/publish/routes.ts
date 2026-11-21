import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { resolveSafeWorkspacePath } from '../files/workspace-fs.js';
import {
  handlePhase4Error,
  resolvePhase4Scope,
  type LockRouteOptions,
} from '../locks/routes.js';
import type { PublishJobRow } from '../../db/schema.js';
import type { PublishService } from './publish-service.js';

const createJobSchema = z.object({
  rootMap: z.string().min(1),
  format: z.enum(['html5', 'pdf']),
  ditaval: z.string().min(1).nullable().optional(),
  title: z.string().trim().max(120).optional(),
});

export interface PublishRouteOptions extends LockRouteOptions {
  publish: PublishService;
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
    throw new HttpError(404, '发布任务不存在');
  }
  return job;
}

function requirePublisher(user: IdentityUser): void {
  if (user.role === 'viewer') {
    throw new HttpError(403, '只读角色无权发布或取消发布任务');
  }
}

async function resolveWorkspacePath(
  workDir: string,
  rawPath: string,
  extensions: string[],
  label: string,
): Promise<string> {
  const safe = await resolveSafeWorkspacePath(workDir, rawPath);
  if (!extensions.includes(extname(safe.posixPath).toLowerCase())) {
    throw new HttpError(400, `${label} 文件类型不受支持：${safe.posixPath}`);
  }
  try {
    const info = await stat(safe.absPath);
    if (!info.isFile()) throw new Error('not a file');
  } catch {
    throw new HttpError(404, `${label} 文件不存在：${safe.posixPath}`);
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
  app.get('/api/publish/runtime', async (_req, reply) => {
    try {
      const runtime = await options.publish.getRuntime(true);
      return { runtime, publishRootDir: options.publish.rootDir };
    } catch (err) {
      return handlePhase4Error(err, reply);
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
      return handlePhase4Error(err, reply);
    }
  });

  app.post('/api/publish/jobs', async (req, reply) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? '参数错误' });
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
      const job = await options.publish.createJob({
        user: scope.user,
        workDir: scope.workDir,
        projectId: scope.projectId,
        branch: scope.branch,
        rootMap,
        format: parsed.data.format,
        ditaval,
        title: parsed.data.title,
      });
      return reply.status(202).send({ job });
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/publish/jobs/:id', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      const job = options.publish.getJob(requireJob(options, id, scope.projectId).id);
      return { job };
    } catch (err) {
      return handlePhase4Error(err, reply);
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
      return handlePhase4Error(err, reply);
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
      return handlePhase4Error(err, reply);
    }
  });

  app.get('/api/publish/jobs/:id/events', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      requireJob(options, id, scope.projectId);
    } catch (err) {
      return handlePhase4Error(err, reply);
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
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      const row = requireJob(options, id, scope.projectId);
      if (row.format !== 'html5' || row.status !== 'succeeded' || !row.outputPath) {
        throw new HttpError(404, '该任务没有可预览的 HTML5 输出');
      }
      const wildcard = (req.params as { '*': string })['*'] ?? '';
      const filePath = await resolvePreviewFile(row.outputPath, wildcard);
      if (!filePath) {
        throw new HttpError(404, '预览文件不存在');
      }
      const extension = extname(filePath).toLowerCase();
      reply.header('cache-control', extension === '.html' ? 'no-cache' : 'public, max-age=300');
      reply.type(MIME_TYPES[extension] ?? 'application/octet-stream');
      return reply.send(createReadStream(filePath));
    } catch (err) {
      return handlePhase4Error(err, reply);
    }
  };
  app.get('/api/publish/jobs/:id/preview', previewHandler);
  app.get('/api/publish/jobs/:id/preview/*', previewHandler);

  app.get('/api/publish/jobs/:id/artifact', async (req, reply) => {
    try {
      const scope = await resolvePhase4Scope(req, options);
      const { id } = req.params as { id: string };
      const row = requireJob(options, id, scope.projectId);
      if (row.status !== 'succeeded' || !row.artifactPath) {
        throw new HttpError(404, '该任务还没有可下载的产物');
      }
      let info;
      try {
        info = await stat(row.artifactPath);
      } catch {
        throw new HttpError(404, '产物文件已被清理');
      }
      if (!info.isFile()) throw new HttpError(404, '产物文件不存在');
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
      return handlePhase4Error(err, reply);
    }
  });
}
