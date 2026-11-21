import { createReadStream, existsSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
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
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

export function defaultWebDistDir(): string {
  return (
    process.env.DITA_WEB_DIST ??
    fileURLToPath(new URL('../../../../web/dist/', import.meta.url))
  );
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Serve the built workbench from the same origin as the API (single-container deployment).
 * API routes and SSE endpoints are registered first; this catch-all only handles the SPA.
 */
export function registerWebStaticRoutes(app: FastifyInstance, webDistDir: string): boolean {
  const rootDir = resolve(webDistDir);
  if (!existsSync(join(rootDir, 'index.html'))) return false;

  app.get('/*', async (req, reply) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/') || pathname === '/api') {
        return reply.status(404).send({ error: 'Not found' });
      }
      const realRoot = await realpath(rootDir);
      const requested = resolve(realRoot, `.${pathname}`);
      if (!isInside(realRoot, requested)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      let filePath = requested;
      let fileInfo;
      try {
        fileInfo = await stat(filePath);
      } catch {
        fileInfo = null;
      }
      if (!fileInfo || fileInfo.isDirectory()) {
        if (extname(pathname)) {
          return reply.status(404).send({ error: 'Not found' });
        }
        filePath = join(realRoot, 'index.html');
        fileInfo = await stat(filePath);
      }
      const realFile = await realpath(filePath);
      if (!isInside(realRoot, realFile)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const extension = extname(realFile).toLowerCase();
      reply.header(
        'cache-control',
        pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      reply.type(MIME_TYPES[extension] ?? 'application/octet-stream');
      reply.header('content-length', String(fileInfo.size));
      return reply.send(createReadStream(realFile));
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });
  return true;
}
