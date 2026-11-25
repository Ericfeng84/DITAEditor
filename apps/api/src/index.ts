import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { DITA_CORE_VERSION } from '@dita/core';
import { openDatabase } from './db/client.js';
import { isHttpError, localizeErrorMessage } from './modules/errors.js';
import { resolveRequestLocale } from './i18n/locale.js';
import { AiSettingsService } from './modules/ai/ai-settings-service.js';
import { AiUsageService } from './modules/ai/ai-usage-service.js';
import { createLangChainModelFactory, type AiModelFactory } from './modules/ai/ai-model-factory.js';
import { registerAiRoutes } from './modules/ai/routes.js';
import { registerAssetRoutes } from './modules/files/asset-routes.js';
import { registerWorkspaceFileRoutes } from './modules/files/routes.js';
import { WorkspaceManager } from './modules/files/workspace-fs.js';
import { GitManager } from './modules/git/git-manager.js';
import { VersionAuditService } from './modules/git/audit-service.js';
import { MergeService } from './modules/git/merge-service.js';
import { registerGitRoutes } from './modules/git/routes.js';
import { IdentityService } from './modules/identity/identity-service.js';
import { registerIdentityRoutes } from './modules/identity/routes.js';
import { registerSemanticIndexerRoutes } from './modules/indexer/routes.js';
import { WorkspaceSemanticIndexer } from './modules/indexer/semantic-indexer.js';
import { DraftService } from './modules/locks/draft-service.js';
import { LockService } from './modules/locks/lock-service.js';
import { registerLockRoutes, type BaselineChangeInfo, type Phase4Scope } from './modules/locks/routes.js';
import { ManualContextResolver } from './modules/manuals/manual-context-resolver.js';
import { ManualRegistryService } from './modules/manuals/manual-registry-service.js';
import { registerManualRoutes } from './modules/manuals/routes.js';
import { AssignmentService } from './modules/assignments/assignment-service.js';
import { registerAssignmentRoutes } from './modules/assignments/routes.js';
import { registerPublishRoutes } from './modules/publish/routes.js';
import { PublishProfileService } from './modules/publish/publish-profiles.js';
import { PublishService } from './modules/publish/publish-service.js';
import { defaultWebDistDir, registerWebStaticRoutes } from './modules/static/web-static.js';
import { registerStrictValidationRoutes } from './modules/validate/routes.js';
import type { DitaRuntimeOptions } from './modules/dita-ot/dita-runtime.js';

export interface CreateServerOptions {
  workspaceDir?: string;
  importsRootDir?: string;
  registryPath?: string;
  dbPath?: string;
  worktreesRootDir?: string;
  publishRootDir?: string;
  publishConcurrency?: number;
  publishTimeoutMs?: number;
  publishRetentionDays?: number;
  /** Overrides the bundled `dita-ot-plugins/html5-themes` asset directory. */
  htmlThemesDir?: string;
  /**
   * Phase 13: where user draft binary assets live. Defaults to
   * `<data root>/draft-assets`, outside every shared Git worktree.
   */
  draftAssetsRootDir?: string;
  ditaRuntime?: DitaRuntimeOptions;
  webDistDir?: string;
  /** Optional reverse-proxy subpath prefix (e.g. `/dita`) stripped before routing. */
  basePath?: string;
  logger?: boolean;
  aiModelFactory?: AiModelFactory;
}

export function createServer(options: CreateServerOptions = {}) {
  const normalizedBasePath = (options.basePath ?? process.env.DITA_BASE_PATH ?? '')
    .trim()
    .replace(/\/+$/, '');
  const fastifyOptions: FastifyServerOptions = {
    logger: options.logger ?? true,
  };
  if (normalizedBasePath && normalizedBasePath.startsWith('/')) {
    fastifyOptions.rewriteUrl = (req) => {
      const raw = req.url ?? '/';
      if (raw === normalizedBasePath) return '/';
      if (
        raw.startsWith(`${normalizedBasePath}/`) ||
        raw.startsWith(`${normalizedBasePath}?`)
      ) {
        return raw.slice(normalizedBasePath.length) || '/';
      }
      return raw;
    };
  }
  const app = Fastify(fastifyOptions);
  const workspace = new WorkspaceManager({
    workspaceDir: options.workspaceDir,
    importsRootDir: options.importsRootDir,
    registryPath: options.registryPath,
  });
  const database = openDatabase(
    options.dbPath ?? path.join(workspace.importsRootDir, 'dita-editor.sqlite'),
  );
  const identity = new IdentityService(database.db);
  const aiSettings = new AiSettingsService(database.db);
  const aiUsage = new AiUsageService(database.db);
  const git = new GitManager({
    worktreesRootDir:
      options.worktreesRootDir ?? path.join(workspace.importsRootDir, 'git-worktrees'),
  });
  // Phase 13: user drafts are SQLite rows plus out-of-repo binary assets, so the shared
  // branch worktree can stay permanently clean at HEAD.
  const drafts = new DraftService({
    db: database.db,
    draftAssetsRootDir:
      options.draftAssetsRootDir ?? path.join(workspace.importsRootDir, 'draft-assets'),
  });
  const audit = new VersionAuditService(database.db);
  const locks = new LockService(database.db, git, drafts, audit);
  const publishProfiles = new PublishProfileService(database.db);
  const publish = new PublishService({
    db: database.db,
    workspace,
    publishRootDir: options.publishRootDir,
    concurrency: options.publishConcurrency,
    timeoutMs: options.publishTimeoutMs,
    retentionDays: options.publishRetentionDays,
    htmlThemesDir: options.htmlThemesDir,
    runtime: options.ditaRuntime,
    git,
    drafts,
    audit,
    logger: (message, error) => {
      if (options.logger === false) return;
      app.log.warn({ err: error }, message);
    },
  });
  app.addHook('onReady', async () => {
    await registry.syncLegacyWorkspaces();
    await publish.start();
  });
  app.addHook('onClose', async () => {
    clearInterval(maintenanceTimer);
    await publish.stop();
    database.close();
  });
  // Phase 10: one manual = one independent workspace (its own directory + git repository).
  // The registry is the SQLite source of truth; the resolver hands every request its own
  // (manual, branch) workspace + semantic indexer so concurrent manuals never interfere.
  const registry = new ManualRegistryService({
    db: database.db,
    git,
    defaultRootDir: workspace.defaultRootDir,
    importsRootDir: workspace.importsRootDir,
    registryWorkspace: workspace,
  });
  const context = new ManualContextResolver({
    registry,
    git,
    importsRootDir: workspace.importsRootDir,
    registryPath: workspace.registryPath,
    defaultRootDir: workspace.defaultRootDir,
    drafts,
  });
  const assignments = new AssignmentService({ db: database.db, identity, git });

  const merge = new MergeService({ git, locks, drafts, audit, registry });
  const indexer = new WorkspaceSemanticIndexer(workspace);
  workspace.setMutationCallbacks({
    onFileWritten: (posixPath, content) => indexer.onFileWritten(posixPath, content),
    onAssetAdded: (posixPath) => indexer.onAssetAdded(posixPath),
    onFileDeleted: (posixPath) => indexer.onFileDeleted(posixPath),
    onFileRenamed: (fromPath, toPath) => indexer.onFileRenamed(fromPath, toPath),
    onWorkspaceChanged: (newRootDir) => indexer.onWorkspaceChanged(newRootDir),
  });

  // Phase 13 housekeeping: orphan worktrees, orphan draft blobs and idle manual sessions.
  // A single unref'd timer keeps the process free to exit and never blocks readiness.
  const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const maintenanceTimer = setInterval(() => {
    void git.pruneOrphanWorktrees().catch(() => undefined);
    void drafts.pruneOrphanDraftBlobs().catch(() => undefined);
    context.evictIdleSessions();
  }, MAINTENANCE_INTERVAL_MS);
  maintenanceTimer.unref?.();

  app.register(cors, { origin: true });
  app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  app.get('/health', async () => ({
    status: 'ok',
    coreVersion: DITA_CORE_VERSION,
    workspaceDir: workspace.getRootDir(),
    defaultRootDir: workspace.defaultRootDir,
  }));

  registerIdentityRoutes(app, identity);
  // Phase 10 routes live in their own encapsulated scope so every failure (missing manual,
  // viewer role, duplicate active assignment) answers with one localized `{ error }` shape.
  app.register(async (scope) => {
    scope.setErrorHandler((err, req, reply) => {
      const locale = resolveRequestLocale(req);
      if (isHttpError(err)) {
        return reply
          .status(err.statusCode)
          .send({ error: localizeErrorMessage(err, locale), ...(err.details ?? {}) });
      }
      const statusCode =
        typeof (err as { statusCode?: number }).statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(statusCode).send({ error: message });
    });
    registerManualRoutes(scope, { registry, resolver: context, identity });
    registerAssignmentRoutes(scope, { assignments, identity, context });
  });
  registerWorkspaceFileRoutes(app, workspace, indexer, {
    identity,
    locks,
    context,
    registry,
    drafts,
    git,
  });
  registerAssetRoutes(app, workspace, identity, context, { drafts, locks, git });
  registerSemanticIndexerRoutes(app, indexer, context, identity);
  const phase4 = {
    workspace,
    git,
    identity,
    locks,
    context,
    drafts,
    audit,
    onBranchChanged: async (workDir: string) => {
      await indexer.onWorkspaceChanged(workDir);
    },
    // Check-in / merge / restore / revert advance the shared baseline: refresh only
    // that manual's branch baseline index instead of rebuilding every cached session.
    onBaselineChanged: async (scope: Phase4Scope, info?: BaselineChangeInfo) => {
      try {
        if (scope.session) {
          await scope.session.indexer.refreshFromBaselineDisk(scope.branch, info);
          return;
        }
        await indexer.onWorkspaceChanged(scope.workDir);
      } catch {
        // Indexing is advisory; a failed refresh must never fail the commit response.
      }
    },
    // Phase 13: a draft rename only moves topic assignments once the baseline commits it.
    onRenameCommitted: (input: {
      manualId: string;
      branch: string;
      fromPath: string;
      toPath: string;
    }) => assignments.syncRename(input),
    // Soft assignment linkage: check-out starts the caller's assignment, check-in may close it.
    onCheckout: async ({
      scope,
      filePath,
    }: {
      scope: { manualId?: string; branch: string; user: { id: string } };
      filePath: string;
    }) =>
      scope.manualId
        ? assignments.markInProgressForCheckout({
            manualId: scope.manualId,
            branch: scope.branch,
            topicPath: filePath,
            userId: scope.user.id,
          })
        : null,
    onCheckin: async ({
      scope,
      paths,
      completeAssignmentIds,
      completeMyAssignments,
    }: {
      scope: { manualId?: string; branch: string; user: { id: string } };
      paths: string[];
      completeAssignmentIds?: string[];
      completeMyAssignments?: boolean;
    }) => {
      const explicit = completeAssignmentIds?.length ? completeAssignmentIds : undefined;
      if (!scope.manualId || (!completeMyAssignments && !explicit)) return [];
      return assignments.completeOnCheckin({
        manualId: scope.manualId,
        branch: scope.branch,
        paths: completeMyAssignments ? paths : [],
        userId: scope.user.id,
        ids: explicit,
      });
    },
  };
  registerLockRoutes(app, phase4);
  registerGitRoutes(app, { ...phase4, merge, registry });
  registerStrictValidationRoutes(app, {
    workspace,
    runtime: options.ditaRuntime,
    context,
    identity,
    drafts,
    locks,
  });
  registerPublishRoutes(app, {
    ...phase4,
    publish,
    profiles: publishProfiles,
    htmlThemesDir: options.htmlThemesDir,
  });
  registerAiRoutes(app, {
    workspace,
    indexer,
    context,
    identity,
    drafts,
    settings: aiSettings,
    usage: aiUsage,
    modelFactory: options.aiModelFactory ?? createLangChainModelFactory(),
    logger: {
      warn: (message: string) => {
        if (options.logger === false) return;
        app.log.warn(message);
      },
    },
  });
  registerWebStaticRoutes(app, options.webDistDir ?? defaultWebDistDir());

  return app;
}

const entryArg = process.argv[1];
const isEntrypoint =
  typeof entryArg === 'string' && import.meta.url === pathToFileURL(entryArg).href;
if (isEntrypoint) {
  const app = createServer();
  const port = Number(process.env.PORT ?? 3001);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
