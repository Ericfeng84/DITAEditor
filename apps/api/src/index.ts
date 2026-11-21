import path from 'node:path';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { DITA_CORE_VERSION } from '@dita/core';
import { openDatabase } from './db/client.js';
import { registerAssetRoutes } from './modules/files/asset-routes.js';
import { registerWorkspaceFileRoutes } from './modules/files/routes.js';
import { WorkspaceManager } from './modules/files/workspace-fs.js';
import { GitManager } from './modules/git/git-manager.js';
import { registerGitRoutes } from './modules/git/routes.js';
import { IdentityService } from './modules/identity/identity-service.js';
import { registerIdentityRoutes } from './modules/identity/routes.js';
import { registerSemanticIndexerRoutes } from './modules/indexer/routes.js';
import { WorkspaceSemanticIndexer } from './modules/indexer/semantic-indexer.js';
import { LockService } from './modules/locks/lock-service.js';
import { registerLockRoutes } from './modules/locks/routes.js';

export interface CreateServerOptions {
  workspaceDir?: string;
  importsRootDir?: string;
  registryPath?: string;
  dbPath?: string;
  worktreesRootDir?: string;
  logger?: boolean;
}

export function createServer(options: CreateServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const workspace = new WorkspaceManager({
    workspaceDir: options.workspaceDir,
    importsRootDir: options.importsRootDir,
    registryPath: options.registryPath,
  });
  const database = openDatabase(
    options.dbPath ?? path.join(workspace.importsRootDir, 'dita-editor.sqlite'),
  );
  const identity = new IdentityService(database.db);
  const git = new GitManager({
    worktreesRootDir:
      options.worktreesRootDir ?? path.join(workspace.importsRootDir, 'git-worktrees'),
  });
  const locks = new LockService(database.db, git);
  app.addHook('onClose', async () => {
    database.close();
  });
  const indexer = new WorkspaceSemanticIndexer(workspace);
  workspace.setMutationCallbacks({
    onFileWritten: (posixPath, content) => indexer.onFileWritten(posixPath, content),
    onAssetAdded: (posixPath) => indexer.onAssetAdded(posixPath),
    onFileDeleted: (posixPath) => indexer.onFileDeleted(posixPath),
    onFileRenamed: (fromPath, toPath) => indexer.onFileRenamed(fromPath, toPath),
    onWorkspaceChanged: (newRootDir) => indexer.onWorkspaceChanged(newRootDir),
  });

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
  }));

  registerIdentityRoutes(app, identity);
  registerWorkspaceFileRoutes(app, workspace, indexer, { identity, locks });
  registerAssetRoutes(app, workspace, identity);
  registerSemanticIndexerRoutes(app, indexer);
  const phase4 = {
    workspace,
    git,
    identity,
    locks,
    onBranchChanged: async (workDir: string) => {
      await indexer.onWorkspaceChanged(workDir);
    },
  };
  registerLockRoutes(app, phase4);
  registerGitRoutes(app, phase4);

  return app;
}

const isEntrypoint = import.meta.url === `file://${process.argv[1]}`;
if (isEntrypoint) {
  const app = createServer();
  const port = Number(process.env.PORT ?? 3001);
  app.listen({ port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
