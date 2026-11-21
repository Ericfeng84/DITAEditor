import Fastify from 'fastify';
import { DITA_CORE_VERSION } from '@dita/core';

export function createServer() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({
    status: 'ok',
    coreVersion: DITA_CORE_VERSION,
  }));

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
