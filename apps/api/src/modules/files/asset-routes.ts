import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  computeRelativeDitaHref,
  resolveDitaHref,
} from '@dita/core';
import type { IdentityService } from '../identity/identity-service.js';
import type { GitManager } from '../git/git-manager.js';
import type { DraftService } from '../locks/draft-service.js';
import type { LockService } from '../locks/lock-service.js';
import type { ManualContextResolver } from '../manuals/manual-context-resolver.js';
import { handleWorkspaceError } from './routes.js';
import {
  fileExistsInOverlay,
  readBinaryAssetWithOverlay,
  type OverlayScope,
} from './overlay-workspace.js';
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

/** Phase 13: optional draft-overlay collaborators for the asset routes. */
export interface AssetRouteOptions {
  drafts?: DraftService;
  locks?: LockService;
  git?: GitManager;
}

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
  context?: ManualContextResolver,
  options?: AssetRouteOptions,
): void {
  /** Phase 10: assets belong to the manual + branch session of the request. */
  const workspaceFor = async (req: FastifyRequest) =>
    context ? (await context.resolveRequest(req)).workspace : workspace;

  /**
   * Phase 13: the caller's draft overlay scope. `userId` travels in the header or the
   * `?userId=` query so a draft image only renders for its owner.
   */
  const userIdFor = (req: FastifyRequest): string | undefined => {
    const raw = req.headers['x-dita-user-id'];
    const headerValue = Array.isArray(raw) ? raw[0] : raw;
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return identity ? identity.resolve(headerValue).id : headerValue.trim();
    }
    const query = (req.query as { userId?: unknown } | undefined)?.userId;
    if (typeof query === 'string' && query.trim()) return query.trim();
    return identity ? identity.resolve(undefined).id : undefined;
  };

  const overlayScopeFor = async (req: FastifyRequest): Promise<OverlayScope | null> => {
    if (!options?.drafts || !options.locks) return null;
    const userId = userIdFor(req);
    if (!userId) return null;
    const session = context ? await context.resolveRequest(req) : null;
    const ws = session?.workspace ?? workspace;
    const projectRootDir = session?.projectRootDir ?? ws.getProjectRootDir();
    const branch =
      session?.branch ??
      (options.git
        ? await options.git.currentBranch(session?.workDir ?? ws.getRootDir())
        : 'main');
    return {
      projectId: options.locks.ensureRepository(projectRootDir),
      branch,
      userId,
    };
  };

  app.post('/api/assets/upload', async (req, reply) => {
    try {
      const user = identity ? identity.resolve(req.headers['x-dita-user-id']) : undefined;
      if (identity && user) {
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

      const sessionWorkspace = await workspaceFor(req);
      const rootDir = sessionWorkspace.getRootDir();
      const safeDir = await resolveSafeWorkspacePath(rootDir, targetDir);

      const cleanName = sanitizeAssetFilename(uploadedFileName);
      const stem = cleanName.slice(0, cleanName.length - ext.length);
      let finalName = cleanName;
      let candidatePosix = safeDir.posixPath ? `${safeDir.posixPath}/${finalName}` : finalName;
      let safeTarget = await resolveSafeWorkspacePath(rootDir, candidatePosix);

      const overlay = await overlayScopeFor(req);
      const drafts = options?.drafts;

      const assetExists = async (posixPath: string): Promise<boolean> => {
        if (overlay && drafts) {
          const info = await fileExistsInOverlay(sessionWorkspace, drafts, overlay, posixPath);
          return info.exists;
        }
        const safe = await resolveSafeWorkspacePath(rootDir, posixPath);
        return existsSync(safe.absPath);
      };

      if (await assetExists(candidatePosix)) {
        finalName = `${stem}-${Date.now().toString(36).slice(-4)}${ext}`;
        candidatePosix = safeDir.posixPath ? `${safeDir.posixPath}/${finalName}` : finalName;
        safeTarget = await resolveSafeWorkspacePath(rootDir, candidatePosix);
      }

      let isDraft = false;
      if (overlay && drafts) {
        if (user) {
          await options?.locks?.authorizeWrite({
            workDir: sessionWorkspace.getRootDir(),
            projectRootDir: sessionWorkspace.getProjectRootDir(),
            filePath: candidatePosix,
            user,
            exists: false,
          });
        }
        let baseCommit: string | null = null;
        if (options?.git) {
          try {
            baseCommit = await options.git.headCommit(sessionWorkspace.getRootDir());
          } catch {
            baseCommit = null;
          }
        }
        drafts.upsertBinaryDraft({
          projectId: overlay.projectId,
          branch: overlay.branch,
          filePath: candidatePosix,
          userId: overlay.userId,
          op: 'create',
          buffer: fileBuffer,
          ext,
          baseCommit,
        });
        isDraft = true;
      } else {
        await fs.mkdir(safeDir.absPath, { recursive: true });
        await fs.writeFile(safeTarget.absPath, fileBuffer);
        await sessionWorkspace.notifyAssetAdded(safeTarget.posixPath);
      }

      const relativeHref = fromDocPath
        ? computeRelativeDitaHref(fromDocPath, safeTarget.posixPath)
        : safeTarget.posixPath;

      const previewParams = new URLSearchParams({ path: safeTarget.posixPath });
      if (isDraft && overlay) previewParams.set('userId', overlay.userId);

      return {
        path: safeTarget.posixPath,
        fileName: finalName,
        relativeHref,
        previewUrl: `/api/assets/raw?${previewParams.toString()}`,
        mimeType: MIME_TYPES[ext] ?? mimeType,
        size: fileBuffer.length,
        ...(isDraft ? { isDraft: true } : {}),
      };
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });

  app.get('/api/assets/raw', async (req, reply) => {
    const query = req.query as { path?: string };
    if (!query.path) {
      return reply.status(400).send({ error: 'Missing required query parameter: path' });
    }
    try {
      const sessionWorkspace = await workspaceFor(req);
      const overlay = await overlayScopeFor(req);
      const drafts = options?.drafts;
      const safePath = (await resolveSafeWorkspacePath(sessionWorkspace.getRootDir(), query.path))
        .posixPath;
      const asset =
        overlay && drafts
          ? await readBinaryAssetWithOverlay(sessionWorkspace, drafts, overlay, safePath)
          : await sessionWorkspace.readBinaryAsset(query.path);
      const contentType = MIME_TYPES[asset.ext] ?? 'application/octet-stream';
      return reply
        .header('Content-Type', contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'no-cache')
        .send(asset.buffer);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
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
      const sessionWorkspace = await workspaceFor(req);
      const overlay = await overlayScopeFor(req);
      const drafts = options?.drafts;
      const asset =
        overlay && drafts
          ? await readBinaryAssetWithOverlay(
              sessionWorkspace,
              drafts,
              overlay,
              resolved.targetPath,
            )
          : await sessionWorkspace.readBinaryAsset(resolved.targetPath);
      const contentType = MIME_TYPES[asset.ext] ?? 'application/octet-stream';
      return reply
        .header('Content-Type', contentType)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'no-cache')
        .send(asset.buffer);
    } catch (err) {
      return handleWorkspaceError(err, req, reply);
    }
  });
}
