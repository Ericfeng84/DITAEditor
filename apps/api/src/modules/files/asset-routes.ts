import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  computeRelativeDitaHref,
  resolveDitaHref,
} from '@dita/core';
import type { IdentityService } from '../identity/identity-service.js';
import { handleWorkspaceError } from './routes.js';
import { resolveSafeWorkspacePath, type WorkspaceManager } from './workspace-fs.js';

const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
]);

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
};

function sanitizeAssetFilename(rawName: string): string {
  const base = path.basename(rawName.trim());
  const ext = path.extname(base).toLowerCase();
  const stem = base
    .slice(0, base.length - ext.length)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || 'image'}${ext}`;
}

export function registerAssetRoutes(
  app: FastifyInstance,
  workspace: WorkspaceManager,
  identity?: IdentityService,
): void {
  app.post('/api/assets/upload', async (req, reply) => {
    try {
      if (identity) {
        const user = identity.resolve(req.headers['x-dita-user-id']);
        identity.requireRole(user, ['admin', 'writer']);
      }
      let targetDir = 'images';
      let fromDocPath = '';
      let uploadedFileName = '';
      let fileBuffer: Buffer | null = null;
      let mimeType = 'application/octet-stream';

      for await (const part of req.parts()) {
        if (part.type === 'field') {
          if (part.fieldname === 'targetDir' && typeof part.value === 'string' && part.value.trim()) {
            targetDir = part.value.trim();
          } else if (
            part.fieldname === 'fromDocPath' &&
            typeof part.value === 'string' &&
            part.value.trim()
          ) {
            fromDocPath = part.value.trim();
          }
        } else if (part.type === 'file' && !fileBuffer) {
          uploadedFileName = part.filename || 'asset.png';
          mimeType = part.mimetype || mimeType;
          fileBuffer = await part.toBuffer();
        }
      }

      if (!fileBuffer || !uploadedFileName) {
        return reply.status(400).send({ error: 'Missing multipart file field.' });
      }

      const ext = path.extname(uploadedFileName).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        return reply.status(400).send({
          error: `Unsupported image extension "${ext}". Allowed: ${Array.from(ALLOWED_IMAGE_EXTENSIONS).join(', ')}`,
        });
      }

      const rootDir = workspace.getRootDir();
      const safeDir = await resolveSafeWorkspacePath(rootDir, targetDir);
      await fs.mkdir(safeDir.absPath, { recursive: true });

      const cleanName = sanitizeAssetFilename(uploadedFileName);
      const stem = cleanName.slice(0, cleanName.length - ext.length);
      let finalName = cleanName;
      let candidatePosix = safeDir.posixPath ? `${safeDir.posixPath}/${finalName}` : finalName;
      let safeTarget = await resolveSafeWorkspacePath(rootDir, candidatePosix);

      if (existsSync(safeTarget.absPath)) {
        finalName = `${stem}-${Date.now().toString(36).slice(-4)}${ext}`;
        candidatePosix = safeDir.posixPath ? `${safeDir.posixPath}/${finalName}` : finalName;
        safeTarget = await resolveSafeWorkspacePath(rootDir, candidatePosix);
      }

      await fs.writeFile(safeTarget.absPath, fileBuffer);
      await workspace.notifyAssetAdded(safeTarget.posixPath);

      const relativeHref = fromDocPath
        ? computeRelativeDitaHref(fromDocPath, safeTarget.posixPath)
        : safeTarget.posixPath;

      return {
        path: safeTarget.posixPath,
        fileName: finalName,
        relativeHref,
        previewUrl: `/api/assets/raw?path=${encodeURIComponent(safeTarget.posixPath)}`,
        mimeType: MIME_TYPES[ext] ?? mimeType,
        size: fileBuffer.length,
      };
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/assets/raw', async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      const asset = await workspace.readBinaryAsset(query.path);
      const contentType = MIME_TYPES[asset.ext] ?? 'application/octet-stream';
      return reply
        .header('Content-Type', contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'no-cache')
        .send(asset.buffer);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });

  app.get('/api/assets/resolve', async (req, reply) => {
    const query = req.query as { from?: string; href?: string };
    if (!query.href) {
      return reply.status(400).send({ error: 'Missing required query parameter: href' });
    }
    const resolved = resolveDitaHref(query.from ?? '', query.href);
    if (resolved.isExternal || resolved.escapesRoot || !resolved.targetPath) {
      return reply.status(400).send({
        error: `Cannot resolve local workspace asset for href "${query.href}".`,
      });
    }
    try {
      const asset = await workspace.readBinaryAsset(resolved.targetPath);
      const contentType = MIME_TYPES[asset.ext] ?? 'application/octet-stream';
      return reply
        .header('Content-Type', contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'no-cache')
        .send(asset.buffer);
    } catch (err) {
      return handleWorkspaceError(err, reply);
    }
  });
}
