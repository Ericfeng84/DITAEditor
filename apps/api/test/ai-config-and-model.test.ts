import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessage, AIMessageChunk, type BaseMessage } from '@langchain/core/messages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import type { AiChatModel, AiModelFactory } from '../src/modules/ai/ai-model-factory.js';
import type { AiConfigTestResult, AiPublicConfig } from '../src/modules/ai/types.js';

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const tempDirs: string[] = [];
const originalEnvKey = process.env.DEEPSEEK_API_KEY;

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase6-config-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  const importsDir = path.join(root, 'imports');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(importsDir, { recursive: true });
  return { root, projectDir, importsDir, dbPath: path.join(root, 'config.sqlite') };
}

function createApp(modelFactory: AiModelFactory) {
  const fixture = createFixture();
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: path.join(fixture.root, 'worktrees'),
    aiModelFactory: modelFactory,
    logger: false,
  });
}

function modelReturning(message: string): AiChatModel {
  return {
    // Not used by these tests.
    async *stream() {
      yield new AIMessageChunk({ content: message });
    },
    async invoke(_messages: BaseMessage[]) {
      return new AIMessage(message);
    },
  };
}

beforeEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
});

afterEach(() => {
  if (originalEnvKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalEnvKey;
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('AI config routes', () => {
  it('reports an unconfigured default without leaking a key', async () => {
    const app = createApp(() => modelReturning('pong'));
    const response = await app.inject({
      method: 'GET',
      url: '/api/ai/config',
      headers: WRITER,
    });
    expect(response.statusCode).toBe(200);
    const config = response.json<AiPublicConfig>();
    expect(config).toMatchObject({
      configured: false,
      hasApiKey: false,
      apiKeySource: 'none',
      maskedApiKey: null,
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-flash',
      temperature: 0.2,
      maxRetries: 2,
      timeoutMs: 45_000,
      maxContextChars: 24_000,
      canEdit: false,
    });
    await app.close();
  });

  it('forbids writers from changing configuration', async () => {
    const app = createApp(() => modelReturning('pong'));
    const response = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: WRITER,
      payload: { apiKey: 'sk-writer-secret' },
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('persists an admin key but only returns a masked value', async () => {
    const app = createApp(() => modelReturning('pong'));
    const fullKey = 'sk-test-1234567890abcd';
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: ADMIN,
      payload: {
        apiKey: fullKey,
        model: 'deepseek-chat',
        temperature: 0.3,
        maxRetries: 1,
        timeoutMs: 30_000,
      },
    });
    expect(saved.statusCode).toBe(200);
    const savedConfig = saved.json<AiPublicConfig>();
    expect(savedConfig).toMatchObject({
      configured: true,
      hasApiKey: true,
      apiKeySource: 'db',
      maskedApiKey: 'sk-****abcd',
      model: 'deepseek-chat',
      temperature: 0.3,
      maxRetries: 1,
      timeoutMs: 30_000,
      canEdit: true,
    });
    expect(saved.body).not.toContain(fullKey);

    const read = await app.inject({ method: 'GET', url: '/api/ai/config', headers: ADMIN });
    expect(read.json<AiPublicConfig>().maskedApiKey).toBe('sk-****abcd');
    expect(read.body).not.toContain(fullKey);
    await app.close();
  });

  it('falls back to the environment key and can clear the stored key', async () => {
    const envKey = 'sk-env-1234567890wxyz';
    process.env.DEEPSEEK_API_KEY = envKey;
    const app = createApp(() => modelReturning('pong'));

    const fromEnv = await app.inject({ method: 'GET', url: '/api/ai/config', headers: ADMIN });
    expect(fromEnv.json<AiPublicConfig>()).toMatchObject({
      configured: true,
      apiKeySource: 'env',
      maskedApiKey: 'sk-****wxyz',
    });

    const stored = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: ADMIN,
      payload: { apiKey: 'sk-db-9876543210lmno' },
    });
    expect(stored.json<AiPublicConfig>().apiKeySource).toBe('db');

    const cleared = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: ADMIN,
      payload: { apiKey: null },
    });
    expect(cleared.json<AiPublicConfig>()).toMatchObject({
      configured: true,
      apiKeySource: 'env',
      maskedApiKey: 'sk-****wxyz',
    });
    expect(cleared.body).not.toContain(envKey);
    await app.close();
  });

  it('tests the connection without echoing the API key', async () => {
    const app = createApp((config) => {
      if (config.apiKey === 'sk-broken-1234567890oops') {
        return {
          async *stream() {
            yield new AIMessageChunk({ content: '' });
          },
          async invoke() {
            throw new Error(`401 invalid key ${config.apiKey}`);
          },
        };
      }
      return modelReturning('pong');
    });

    const ok = await app.inject({
      method: 'POST',
      url: '/api/ai/config/test',
      headers: ADMIN,
      payload: { apiKey: 'sk-good-1234567890fine', model: 'deepseek-chat' },
    });
    expect(ok.statusCode).toBe(200);
    const okResult = ok.json<AiConfigTestResult>();
    expect(okResult.ok).toBe(true);
    expect(okResult.model).toBe('deepseek-chat');
    expect(okResult.latencyMs).toBeGreaterThanOrEqual(0);

    const broken = await app.inject({
      method: 'POST',
      url: '/api/ai/config/test',
      headers: ADMIN,
      payload: { apiKey: 'sk-broken-1234567890oops' },
    });
    expect(broken.statusCode).toBe(200);
    const brokenResult = broken.json<AiConfigTestResult>();
    expect(brokenResult.ok).toBe(false);
    expect(brokenResult.message).toBeTruthy();
    expect(broken.body).not.toContain('sk-broken-1234567890oops');
    await app.close();
  });

  it('forbids writers from reading usage', async () => {
    const app = createApp(() => modelReturning('pong'));
    const response = await app.inject({
      method: 'GET',
      url: '/api/ai/usage',
      headers: WRITER,
    });
    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
