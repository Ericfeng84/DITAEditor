import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import { openDatabase } from '../src/db/client.js';
import { AiService } from '../src/modules/ai/ai-service.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';
import { AiSettingsService } from '../src/modules/ai/ai-settings-service.js';
import { AiUsageService } from '../src/modules/ai/ai-usage-service.js';
import type { AiStreamRequest } from '../src/modules/ai/types.js';
import { WorkspaceManager } from '../src/modules/files/workspace-fs.js';
import type { IdentityUser } from '../src/modules/identity/identity-service.js';
import { WorkspaceSemanticIndexer } from '../src/modules/indexer/semantic-indexer.js';
import type {
  AiDonePayload,
  AiMetaPayload,
  AiProposal,
  AiUsageSummary,
} from '../src/modules/ai/types.js';

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const TOPIC = 'concepts/workspace-model.dita';
const ROOT_MAP = 'product-manual.ditamap';

const tempDirs: string[] = [];
const originalEnvKey = process.env.DEEPSEEK_API_KEY;

interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase6-ai-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  const importsDir = path.join(root, 'imports');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    root,
    projectDir,
    importsDir,
    dbPath: path.join(root, 'ai.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
  };
}

type Fixture = ReturnType<typeof createFixture>;

function createApp(fixture: Fixture, modelFactory: AiModelFactory) {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    aiModelFactory: modelFactory,
    logger: false,
  });
}

function parseSse(body: string): SseFrame[] {
  return body
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.startsWith('event:'))
    .map((block) => {
      const lines = block.split('\n');
      const event = lines[0]!.slice('event:'.length).trim();
      const dataLine = lines.find((line) => line.startsWith('data:')) ?? 'data:{}';
      return { event, data: JSON.parse(dataLine.slice('data:'.length).trim()) as Record<string, unknown> };
    });
}

function eventsOf(frames: SseFrame[], event: string): SseFrame[] {
  return frames.filter((frame) => frame.event === event);
}

function usageOfChunk(text: string): AIMessageChunk {
  return new AIMessageChunk({
    content: text,
    usage_metadata: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
  });
}

function scriptedFactory(scripts: string[][]): { factory: AiModelFactory; calls: () => number } {
  let calls = 0;
  const factory: AiModelFactory = () => ({
    async *stream(_messages, { signal }) {
      const chunks = scripts[calls] ?? [];
      calls += 1;
      for (const text of chunks) {
        if (signal?.aborted) throw new Error('aborted');
        yield usageOfChunk(text);
      }
    },
    async invoke() {
      return new AIMessage('pong');
    },
  });
  return { factory, calls: () => calls };
}

function streamPayload(overrides: Record<string, unknown> = {}) {
  return {
    projectPath: TOPIC,
    rootMapPath: ROOT_MAP,
    taskType: 'authoring',
    instruction: '请把这段改写得更加清晰。',
    target: { mode: 'element', elementPath: [2, 0] },
    history: [],
    ...overrides,
  };
}

async function injectStream(
  app: ReturnType<typeof createApp>,
  payload: Record<string, unknown>,
  headers = ADMIN,
) {
  return app.inject({
    method: 'POST',
    url: '/api/ai/stream',
    headers,
    payload,
  });
}

async function readUsage(app: ReturnType<typeof createApp>): Promise<AiUsageSummary> {
  const response = await app.inject({
    method: 'GET',
    url: '/api/ai/usage?days=30&limit=20',
    headers: ADMIN,
  });
  expect(response.statusCode).toBe(200);
  return response.json<AiUsageSummary>();
}

async function waitForUsage(
  app: ReturnType<typeof createApp>,
  predicate: (summary: AiUsageSummary) => boolean,
  timeoutMs = 3000,
): Promise<AiUsageSummary> {
  const deadline = Date.now() + timeoutMs;
  let last: AiUsageSummary | null = null;
  while (Date.now() < deadline) {
    last = await readUsage(app);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error(`usage did not match: ${JSON.stringify(last)}`);
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'sk-test-1234567890abcd';
});

afterEach(() => {
  if (originalEnvKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalEnvKey;
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('POST /api/ai/stream', () => {
  it('streams meta, explanation deltas, a verified proposal and done', async () => {
    const fixture = createFixture();
    const { factory } = scriptedFactory([
      [
        '<explanation>已把段落改写为更清晰的说明。</explanation>',
        '<dita_patch><p>更新后的段落，包含 <codeph>workspace</codeph> 说明。</p></dita_patch>',
      ],
    ]);
    const app = createApp(fixture, factory);

    const response = await injectStream(app, streamPayload());
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    const frames = parseSse(response.body);
    expect(frames.map((frame) => frame.event)).toEqual([
      'meta',
      'delta',
      'proposal',
      'done',
    ]);

    const meta = eventsOf(frames, 'meta')[0]!.data as unknown as AiMetaPayload;
    expect(meta.model).toBe('deepseek-flash');
    expect(meta.targetMode).toBe('element');
    expect(meta.targetTag).toBe('p');
    expect(meta.contextBadges.join(' ')).toContain('键空间');
    expect(meta.requestId).toMatch(/[0-9a-f-]{36}/);

    const deltaText = eventsOf(frames, 'delta')
      .map((frame) => String(frame.data.text))
      .join('');
    expect(deltaText).toBe('已把段落改写为更清晰的说明。');
    expect(deltaText).not.toContain('dita_patch');

    const proposal = eventsOf(frames, 'proposal')[0]!.data as unknown as AiProposal;
    expect(proposal.targetMode).toBe('element');
    expect(proposal.targetTag).toBe('p');
    expect(proposal.explanation).toBe('已把段落改写为更清晰的说明。');
    expect(proposal.patchedXml).toContain('<p>更新后的段落，包含 <codeph>workspace</codeph> 说明。</p>');
    expect(proposal.patchedXml).toContain('<!DOCTYPE concept PUBLIC');
    expect(proposal.originalXml).toContain('多文件工作区与 Git 隔离模型');
    expect(proposal.changesSummary.length).toBeGreaterThan(0);
    expect(proposal.changesSummary.length).toBeLessThanOrEqual(4);
    expect(proposal.verification).toMatchObject({
      wellFormed: true,
      prosemirrorCompatible: true,
      preservedDoctype: true,
      retryCount: 0,
    });
    expect(proposal.canRevalidateStrict).toBe(true);

    const done = eventsOf(frames, 'done')[0]!.data as unknown as AiDonePayload;
    expect(done.status).toBe('succeeded');
    expect(done.usage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });

    const usage = await readUsage(app);
    expect(usage.recent[0]).toMatchObject({
      taskType: 'authoring',
      status: 'succeeded',
      model: 'deepseek-flash',
      retryCount: 0,
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    expect(JSON.stringify(usage)).not.toContain('更新后的段落');
    await app.close();
  });

  it('retries once after a malformed patch and reports retryCount', async () => {
    const fixture = createFixture();
    const { factory, calls } = scriptedFactory([
      [
        '<explanation>第一次尝试。</explanation>',
        '<dita_patch><p>未闭合',
      ],
      [
        '<explanation>已修复结构。</explanation>',
        '<dita_patch><p>修复后的段落。</p></dita_patch>',
      ],
    ]);
    const app = createApp(fixture, factory);

    const response = await injectStream(app, streamPayload());
    const frames = parseSse(response.body);
    expect(eventsOf(frames, 'retry')).toHaveLength(1);
    expect(eventsOf(frames, 'retry')[0]!.data).toMatchObject({
      attempt: 1,
      maxRetries: 2,
    });
    expect(eventsOf(frames, 'proposal')).toHaveLength(1);
    const proposal = eventsOf(frames, 'proposal')[0]!.data as unknown as AiProposal;
    expect(proposal.verification.retryCount).toBe(1);
    expect(proposal.patchedXml).toContain('<p>修复后的段落。</p>');
    expect((eventsOf(frames, 'done')[0]!.data as unknown as AiDonePayload).status).toBe('succeeded');
    expect(calls()).toBe(2);
    await app.close();
  });

  it('answers ask tasks without a proposal', async () => {
    const fixture = createFixture();
    const { factory } = scriptedFactory([
      ['<explanation>建议把步骤拆分为三个 <step>。</explanation>'],
    ]);
    const app = createApp(fixture, factory);

    const response = await injectStream(
      app,
      streamPayload({ taskType: 'ask', instruction: '这段应该如何拆分步骤？' }),
    );
    const frames = parseSse(response.body);
    expect(eventsOf(frames, 'proposal')).toHaveLength(0);
    expect(eventsOf(frames, 'done')[0]!.data).toMatchObject({ status: 'succeeded' });
    const deltaText = eventsOf(frames, 'delta')
      .map((frame) => String(frame.data.text))
      .join('');
    expect(deltaText).toContain('建议把步骤拆分为三个 <step>。');
    await app.close();
  });

  it('falls back to a line window when element targeting fails on malformed XML from the request', async () => {
    const fixture = createFixture();
    const { factory } = scriptedFactory([
      ['<explanation>按行修复未闭合段落。</explanation>', '<dita_patch><p>fixed paragraph</p></dita_patch>'],
    ]);
    const app = createApp(fixture, factory);

    const malformedXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
      '<concept id="broken">',
      '  <title>坏文档</title>',
      '  <p>broken',
      '</concept>',
      '',
    ].join('\n');

    const response = await injectStream(
      app,
      streamPayload({
        xml: malformedXml,
        target: { mode: 'element', elementPath: [2, 0], line: 5 },
      }),
    );
    const frames = parseSse(response.body);
    const meta = eventsOf(frames, 'meta')[0]!.data as unknown as AiMetaPayload;
    expect(meta.targetMode).toBe('line-window');
    expect(meta.contextBadges.join(' ')).toContain('回退行窗口');
    const proposal = eventsOf(frames, 'proposal')[0]!.data as unknown as AiProposal;
    expect(proposal.targetMode).toBe('line-window');
    expect(proposal.targetTag).toBeNull();
    expect(proposal.patchedXml).toContain('<p>fixed paragraph</p>');
    expect(proposal.patchedXml).toContain('<title>坏文档</title>');
    await app.close();
  });

  it('uses request.xml instead of the file on disk', async () => {
    const fixture = createFixture();
    const { factory } = scriptedFactory([
      ['<explanation>基于请求内 XML 修改标题。</explanation>', '<dita_patch><title>请求标题已改写</title></dita_patch>'],
    ]);
    const app = createApp(fixture, factory);

    const requestXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<concept id="from_request">',
      '  <title>来自请求的标题</title>',
      '  <p>来自请求的正文。</p>',
      '</concept>',
      '',
    ].join('\n');

    const response = await injectStream(
      app,
      streamPayload({
        xml: requestXml,
        target: { mode: 'element', elementPath: [0] },
      }),
    );
    const frames = parseSse(response.body);
    const proposal = eventsOf(frames, 'proposal')[0]!.data as unknown as AiProposal;
    expect(proposal.originalXml).toContain('来自请求的标题');
    expect(proposal.originalXml).not.toContain('多文件工作区与 Git 隔离模型');
    expect(proposal.patchedXml).toContain('<title>请求标题已改写</title>');
    expect(proposal.patchedXml).toContain('来自请求的正文。');
    await app.close();
  });

  it('rejects requests when no API key is configured', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fixture = createFixture();
    const { factory } = scriptedFactory([]);
    const app = createApp(fixture, factory);
    const response = await injectStream(app, streamPayload());
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('AI 未配置 API Key');
    await app.close();
  });

  it('stores a cancelled usage row when the caller aborts the stream', async () => {
    const fixture = createFixture();
    let started = false;
    const factory: AiModelFactory = () => ({
      async *stream(_messages, { signal }) {
        started = true;
        yield usageOfChunk('<explanation>正在处理');
        if (signal?.aborted) throw new Error('aborted');
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new Error('aborted'));
            },
            { once: true },
          );
        });
        yield usageOfChunk('后续内容</explanation>');
      },
      async invoke() {
        return new AIMessage('pong');
      },
    });

    const database = openDatabase(fixture.dbPath);
    const workspace = new WorkspaceManager({ workspaceDir: fixture.projectDir });
    const settings = new AiSettingsService(database.db);
    const usage = new AiUsageService(database.db);
    const service = new AiService({
      workspace,
      indexer: new WorkspaceSemanticIndexer(workspace),
      settings,
      usage,
      modelFactory: factory,
    });
    const user: IdentityUser = {
      id: 'u-admin',
      displayName: '系统管理员',
      role: 'admin',
      email: 'admin@ditaeditor.local',
      color: '#2563eb',
      initials: 'AD',
    };
    const request = streamPayload({ includeProjectContext: false }) as unknown as AiStreamRequest;
    const controller = new AbortController();
    const events: string[] = [];
    const doneStatuses: string[] = [];

    for await (const event of service.stream(request, user, { signal: controller.signal })) {
      events.push(event.event);
      if (event.event === 'delta') controller.abort();
      if (event.event === 'done') doneStatuses.push(event.data.status);
    }

    expect(started).toBe(true);
    expect(doneStatuses).toEqual(['cancelled']);
    expect(events).not.toContain('proposal');
    const summary = usage.summary({ days: 30, limit: 10 });
    expect(summary.recent[0]).toMatchObject({ status: 'cancelled', taskType: 'authoring' });
    database.close();
  });

  it('aggregates usage by task, user and model for admins only', async () => {
    const fixture = createFixture();
    const { factory } = scriptedFactory([
      ['<explanation>写作完成。</explanation>', '<dita_patch><p>写作结果。</p></dita_patch>'],
      ['<explanation>问答回答。</explanation>'],
    ]);
    const app = createApp(fixture, factory);

    await injectStream(app, streamPayload(), ADMIN);
    await injectStream(app, streamPayload({ taskType: 'ask' }), WRITER);

    const usage = await readUsage(app);
    expect(usage.totals).toMatchObject({ calls: 2, succeeded: 2, failed: 0, cancelled: 0 });
    expect(usage.byTask).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskType: 'authoring', calls: 1 }),
        expect.objectContaining({ taskType: 'ask', calls: 1 }),
      ]),
    );
    expect(usage.byUser).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'u-admin', calls: 1 }),
        expect.objectContaining({ userId: 'u-writer-lin', calls: 1 }),
      ]),
    );
    expect(usage.byModel).toEqual(
      expect.arrayContaining([expect.objectContaining({ model: 'deepseek-flash', calls: 2 })]),
    );
    expect(usage.byDay.length).toBeGreaterThan(0);
    // Field names are a public contract with apps/web/src/ai/ai-types.ts — a rename here
    // silently broke the web usage panel once, so pin the exact shapes.
    expect(Object.keys(usage.totals).sort()).toEqual(
      [
        'avgDurationMs',
        'calls',
        'cancelled',
        'completionTokens',
        'failed',
        'promptTokens',
        'succeeded',
        'totalTokens',
      ].sort(),
    );
    expect(Object.keys(usage.byDay[0] ?? {}).sort()).toEqual(
      ['calls', 'completionTokens', 'day', 'promptTokens', 'totalTokens'].sort(),
    );
    expect(Object.keys(usage.byTask[0] ?? {}).sort()).toEqual(
      ['calls', 'completionTokens', 'promptTokens', 'taskType', 'totalTokens'].sort(),
    );
    expect(Object.keys(usage.byUser[0] ?? {}).sort()).toEqual(
      ['calls', 'completionTokens', 'displayName', 'promptTokens', 'totalTokens', 'userId'].sort(),
    );
    expect(Object.keys(usage.byModel[0] ?? {}).sort()).toEqual(
      ['calls', 'completionTokens', 'model', 'promptTokens', 'totalTokens'].sort(),
    );
    expect(Object.keys(usage.recent[0] ?? {})).toEqual(
      expect.arrayContaining([
        'id',
        'taskType',
        'subAction',
        'status',
        'userDisplayName',
        'model',
        'filePath',
        'retryCount',
        'promptTokens',
        'completionTokens',
        'totalTokens',
        'durationMs',
        'createdAt',
      ]),
    );
    await app.close();
  });
});
