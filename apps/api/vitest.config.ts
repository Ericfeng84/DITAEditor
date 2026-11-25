import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Every suite here boots a real Fastify server, a SQLite database and (for several of them) a
    // Git repository. The Phase 13 overlay/versioning scenarios additionally drive worktrees and a
    // stubbed DITA-OT CLI, so the default 5s ceiling is too tight once files run in parallel.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
