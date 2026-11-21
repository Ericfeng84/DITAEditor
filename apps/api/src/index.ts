import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import { DITA_CORE_VERSION } from '@dita/core';
import { registerAssetRoutes } from './modules/files/asset-routes.js';
import { registerWorkspaceFileRoutes } from './modules/files/routes.js';
import { WorkspaceManager } from './modules/files/workspace-fs.js';

export interface CreateServerOptions {
  workspaceDir?: string;
  importsRootDir?: string;
  logger?: boolean;
}

export function createServer(options: CreateServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const workspace = new WorkspaceManager({
    workspaceDir: options.workspaceDir,
    importsRootDir: options.importsRootDir,
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

  registerWorkspaceFileRoutes(app, workspace);
  registerAssetRoutes(app, workspace);

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
