import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessageChunk } from '@langchain/core/messages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const TOPIC = 'concepts/workspace-model.dita';

/**
 * Regression: the route used to abort the model stream from `req.raw.on('close')`, which Node
 * emits as soon as the JSON body has been consumed. Over a real socket that cancelled every
 * request before the first event and produced an empty SSE body (unit tests using
 * light-my-request never saw it). This test binds a real port and reads the raw stream.
 */
describe('Phase 6 AI SSE over a real socket', () => {
  const tempDirs: string[] = [];
  const originalKey = process.env.DEEPSEEK_API_KEY;
  let server: ReturnType<typeof createServer> | null = null;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
    process.env.DEEPSEEK_API_KEY = originalKey;
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('streams meta, delta and done frames to a real HTTP client', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase6-sse-'));
    tempDirs.push(root);
    const projectDir = path.join(root, 'project');
    cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
    rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
    rmSync(path.join(projectDir, '.gitignore'), { force: true });

    const modelFactory: AiModelFactory = () => ({
      async *stream() {
        yield new AIMessageChunk({ content: '<explanation>这是说明</explanation>' });
      },
      async invoke() {
        throw new Error('not used');
      },
    });

    server = createServer({
      workspaceDir: projectDir,
      importsRootDir: path.join(root, 'imports'),
      dbPath: path.join(root, 'ai.sqlite'),
      worktreesRootDir: path.join(root, 'worktrees'),
      webDistDir: path.join(root, 'missing-web-dist'),
      logger: false,
      aiModelFactory: modelFactory,
    });
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('no bound port');
    const base = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${base}/api/ai/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dita-user-id': 'u-admin' },
      body: JSON.stringify({
        projectPath: TOPIC,
        taskType: 'ask',
        instruction: '这个主题讲什么？',
        target: { mode: 'full-document' },
        includeProjectContext: false,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const body = await response.text();
    expect(body).toContain('event: meta');
    expect(body).toContain('event: delta');
    expect(body).toContain('这是说明');
    expect(body).toContain('event: done');
    expect(body).toContain('"status":"succeeded"');
  });
});
