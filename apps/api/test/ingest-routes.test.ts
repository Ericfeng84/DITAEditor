import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';
import type {
  StrictDiagnostic,
  StrictValidationResult,
} from '../src/modules/validate/strict-validator.js';
import type { IngestStreamEvent } from '../src/modules/ingest/ingest-service.js';

/* ------------------------------------------------------------------------------------------ */
/* Fixtures                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const ROOT_MAP = 'product-manual.ditamap';

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ONE_TOPIC_MARKDOWN = [
  '# Product Overview',
  '',
  `![diagram](data:image/png;base64,${PNG_BASE64})`,
  '',
  'The product ships with a workspace model.',
  '',
].join('\n');

const TWO_TOPIC_MARKDOWN = [
  '# Imported Overview',
  '',
  'The imported guide explains the workspace model.',
  '',
  '# Imported Install',
  '',
  'Run the installer.',
  '',
].join('\n');

const ORIGINAL_ENV_KEY = process.env.DEEPSEEK_API_KEY;
const ORIGINAL_ENV_MODEL = process.env.DEEPSEEK_MODEL;

interface Fixture {
  root: string;
  projectDir: string;
  importsDir: string;
  ingestRootDir: string;
  dbPath: string;
  worktreesRootDir: string;
  draftAssetsDir: string;
}

const tempDirs: string[] = [];

function createFixture(): Fixture {
  process.env.DEEPSEEK_API_KEY = 'sk-test-ingest-routes';
  process.env.DEEPSEEK_MODEL = 'deepseek-chat';
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-ingest-routes-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    root,
    projectDir,
    importsDir: path.join(root, 'imports'),
    ingestRootDir: path.join(root, 'ingest-jobs'),
    dbPath: path.join(root, 'ingest.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    draftAssetsDir: path.join(root, 'draft-assets'),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Scripted model                                                                             */
/* ------------------------------------------------------------------------------------------ */

type Role = 'planner' | 'writer' | 'repair';

function roleOf(messages: BaseMessage[]): Role {
  const system = messages[0];
  const text = typeof system?.content === 'string' ? system.content : '';
  if (text.includes('Planning agent')) return 'planner';
  if (text.includes('Writing agent')) return 'writer';
  return 'repair';
}

function scriptedModel(script: { planner: string[]; writer: string[]; repair?: string[] }) {
  const queues: Record<Role, string[]> = {
    planner: [...script.planner],
    writer: [...script.writer],
    repair: [...(script.repair ?? [])],
  };
  const calls: Record<Role, number> = { planner: 0, writer: 0, repair: 0 };
  const factory: AiModelFactory = () => ({
    async invoke(messages) {
      const role = roleOf(messages);
      calls[role] += 1;
      const queue = queues[role];
      const reply = queue.length > 1 ? queue.shift() : queue[0];
      if (reply === undefined) throw new Error(`No scripted ${role} reply`);
      return new AIMessage({
        content: reply,
        usage_metadata: { input_tokens: 90, output_tokens: 40, total_tokens: 130 },
      });
    },
    async *stream() {
      // ingest agents only use `invoke`
    },
  });
  return { factory, calls };
}

function planReply(input: {
  title: string;
  rootMapPath: string;
  topics: { topicId: string; title: string; type: string; filePath: string }[];
}): string {
  return JSON.stringify({
    title: input.title,
    language: 'en',
    mapKind: 'map',
    rootMapPath: input.rootMapPath,
    createKeysMap: false,
    topics: input.topics,
  });
}

function conceptReply(node: { topicId: string; title: string; image?: boolean }): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
    `<concept id="${node.topicId}" xml:lang="en"><title>${node.title}</title>`,
    '<conbody><p>Generated content.</p>',
    ...(node.image ? ['<p><image href="asset://img_001" alt="diagram"/></p>'] : []),
    '</conbody></concept>',
    '',
  ].join('\n');
}

const STRICT_OK: StrictValidationResult = {
  available: true,
  ok: true,
  targets: [],
  diagnostics: [],
  durationMs: 3,
  command: 'dita --validate',
  logTail: '',
  runtime: {
    available: true,
    command: '/opt/dita/bin/dita',
    ditaHome: '/opt/dita',
    version: '4.2.1',
    pluginInstalled: true,
    pluginPath: '/opt/dita/plugins/com.ditaeditor.pdf-cjk',
    fopConfigPath: '/opt/dita/fop.xconf',
    fontsAvailable: true,
    fontsPath: '/usr/share/fonts/noto-cjk',
    checkedAt: Date.now(),
  },
};

/* ------------------------------------------------------------------------------------------ */
/* App + HTTP helpers                                                                         */
/* ------------------------------------------------------------------------------------------ */

type App = ReturnType<typeof createServer>;

function createApp(
  fixture: Fixture,
  factory: AiModelFactory,
  strictValidator: () => Promise<StrictValidationResult> = async () => STRICT_OK,
): App {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    draftAssetsRootDir: fixture.draftAssetsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    ingestRootDir: fixture.ingestRootDir,
    ingestStrictValidator: strictValidator,
    aiModelFactory: factory,
    logger: false,
  });
}

/** Registers the sample project as a manual via the normal git init path. */
async function bootstrap(app: App, fixture: Fixture): Promise<string> {
  const init = await app.inject({ method: 'POST', url: '/api/git/init', headers: ADMIN });
  expect(init.statusCode).toBe(200);
  const manuals = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
  expect(manuals.statusCode).toBe(200);
  const body = manuals.json() as { manuals: { id: string; rootDir: string }[] };
  const match = body.manuals.find((manual) => manual.rootDir === fixture.projectDir);
  expect(match).toBeTruthy();
  return match!.id;
}

function scoped(
  user: Record<string, string>,
  options: { manualId?: string; branch?: string } = {},
): Record<string, string> {
  return {
    ...user,
    ...(options.manualId ? { 'x-dita-manual-id': options.manualId } : {}),
    ...(options.branch ? { 'x-dita-branch': options.branch } : {}),
  };
}

function multipart(
  fields: Record<string, string | number | boolean | undefined>,
  file: { filename: string; content: string | Buffer },
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `----ditaingest${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`,
      ),
    );
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
  );
  chunks.push(Buffer.from(file.content));
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

async function upload(
  app: App,
  headers: Record<string, string>,
  fields: Record<string, string | number | boolean | undefined>,
  file: { filename: string; content: string | Buffer } = {
    filename: 'import.md',
    content: ONE_TOPIC_MARKDOWN,
  },
): Promise<ReturnType<App['inject']> extends Promise<infer R> ? R : never> {
  const body = multipart(fields, file);
  const response = await app.inject({
    method: 'POST',
    url: '/api/ingest/jobs',
    headers: { ...headers, ...body.headers },
    payload: body.payload,
  });
  return response;
}

async function waitForJob(
  app: App,
  id: string,
  headers: Record<string, string>,
  target: string[],
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/ingest/jobs/${id}`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    last = response.json() as Record<string, unknown>;
    if (target.includes(String(last.status))) return last;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`job ${id} never reached ${target.join('|')}: ${JSON.stringify(last)}`);
}

function porcelain(dir: string): string {
  return execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim();
}

function head(dir: string): string {
  return execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim();
}

async function readContent(
  app: App,
  headers: Record<string, string>,
  filePath: string,
): Promise<ReturnType<App['inject']> extends Promise<infer R> ? R : never> {
  return app.inject({
    method: 'GET',
    url: `/api/files/content?path=${encodeURIComponent(filePath)}`,
    headers,
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Tests                                                                                      */
/* ------------------------------------------------------------------------------------------ */

let fixture: Fixture;
let app: App | undefined;

beforeEach(() => {
  fixture = createFixture();
});

afterEach(async () => {
  if (app) await app.close();
  app = undefined;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  if (ORIGINAL_ENV_KEY === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = ORIGINAL_ENV_KEY;
  if (ORIGINAL_ENV_MODEL === undefined) delete process.env.DEEPSEEK_MODEL;
  else process.env.DEEPSEEK_MODEL = ORIGINAL_ENV_MODEL;
});

describe('ingest parser configuration', () => {
  it('serves the config to every role but only admins may change or probe it', async () => {
    const script = scriptedModel({ planner: [planReply({ title: 'X', rootMapPath: 'x.ditamap', topics: [] })], writer: [conceptReply({ topicId: 'c', title: 'C' })] });
    app = createApp(fixture, script.factory);

    const asWriter = await app.inject({ method: 'GET', url: '/api/ingest/config', headers: WRITER });
    expect(asWriter.statusCode).toBe(200);
    const writerConfig = asWriter.json() as Record<string, unknown>;
    expect(writerConfig.canEdit).toBe(false);
    expect(writerConfig.maskedDoclingApiKey).toBeNull();
    expect(Array.isArray(writerConfig.supportedExtensions)).toBe(true);

    const viewerPut = await app.inject({
      method: 'PUT',
      url: '/api/ingest/config',
      headers: VIEWER,
      payload: { maxFileMb: 10 },
    });
    expect(viewerPut.statusCode).toBe(403);

    const writerPut = await app.inject({
      method: 'PUT',
      url: '/api/ingest/config',
      headers: WRITER,
      payload: { maxFileMb: 10 },
    });
    expect(writerPut.statusCode).toBe(403);

    const writerProbe = await app.inject({
      method: 'POST',
      url: '/api/ingest/config/test',
      headers: WRITER,
    });
    expect(writerProbe.statusCode).toBe(403);

    const adminPut = await app.inject({
      method: 'PUT',
      url: '/api/ingest/config',
      headers: ADMIN,
      payload: { doclingApiKey: 'sk-secret-value-9876', doclingMode: 'off', maxFileMb: 12 },
    });
    expect(adminPut.statusCode).toBe(200);
    const saved = adminPut.json() as Record<string, unknown>;
    expect(saved.hasDoclingApiKey).toBe(true);
    expect(saved.doclingApiKey).toBeUndefined();
    expect(String(saved.maskedDoclingApiKey)).toContain('9876');
    expect(saved.maxFileMb).toBe(12);
    expect(JSON.stringify(saved)).not.toContain('sk-secret-value-9876');

    const probe = await app.inject({
      method: 'POST',
      url: '/api/ingest/config/test',
      headers: ADMIN,
    });
    expect(probe.statusCode).toBe(200);
    const detection = probe.json() as {
      direct: { available: boolean };
      supportedExtensions: string[];
    };
    expect(detection.direct.available).toBe(true);
    expect(detection.supportedExtensions).toContain('.md');
  });

  it('blocks viewers from uploading documents', async () => {
    const script = scriptedModel({ planner: ['{}'], writer: [conceptReply({ topicId: 'c', title: 'C' })] });
    app = createApp(fixture, script.factory);
    const response = await upload(app, VIEWER, { targetMode: 'new_manual', autoApprove: true });
    expect(response.statusCode).toBe(403);
  });
});

describe('new manual import', () => {
  it('pauses for approval, exposes markdown/assets, then materializes a clean git manual', async () => {
    const script = scriptedModel({
      planner: [
        planReply({
          title: 'Imported Guide',
          rootMapPath: 'imported-guide.ditamap',
          topics: [
            {
              topicId: 'concept_overview',
              title: 'Product Overview',
              type: 'concept',
              filePath: 'overview.dita',
            },
          ],
        }),
      ],
      writer: [conceptReply({ topicId: 'concept_overview', title: 'Product Overview', image: true })],
    });
    app = createApp(fixture, script.factory);

    const created = await upload(app, ADMIN, {
      targetMode: 'new_manual',
      autoApprove: false,
      manualName: 'Imported Guide',
      language: 'en',
    });
    expect(created.statusCode).toBe(202);
    const job = created.json() as { id: string; status: string };
    expect(job.id).toBeTruthy();

    const paused = await waitForJob(app, job.id, ADMIN, ['awaiting_plan_approval', 'failed']);
    expect(paused.status).toBe('awaiting_plan_approval');
    expect((paused.progress as { planReady: boolean }).planReady).toBe(true);
    expect((paused.assets as { assetId: string; fileName: string }[]).length).toBe(1);
    const assetId = (paused.assets as { assetId: string }[])[0]!.assetId;

    const markdown = await app.inject({
      method: 'GET',
      url: `/api/ingest/jobs/${job.id}/markdown`,
      headers: ADMIN,
    });
    expect(markdown.statusCode).toBe(200);
    const markdownBody = markdown.json() as { markdown: string; sections: unknown[] };
    expect(markdownBody.markdown).toContain('Product Overview');
    expect(markdownBody.sections.length).toBeGreaterThan(0);

    const asset = await app.inject({
      method: 'GET',
      url: `/api/ingest/jobs/${job.id}/assets/${assetId}`,
      headers: ADMIN,
    });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['content-type']).toMatch(/image\/png/);
    expect(asset.rawPayload.subarray(0, 4).toString('hex')).toBe('89504e47');

    const otherAssets = await app.inject({
      method: 'GET',
      url: `/api/ingest/jobs/${job.id}/assets/..%2Fparsed.md`,
      headers: ADMIN,
    });
    expect(otherAssets.statusCode).toBe(404);

    const edited = `${markdownBody.markdown}\n## Extra Notes\n\nEdited by the reviewer.\n`;
    const saved = await app.inject({
      method: 'PUT',
      url: `/api/ingest/jobs/${job.id}/markdown`,
      headers: ADMIN,
      payload: { markdown: edited },
    });
    expect(saved.statusCode).toBe(200);
    expect((saved.json() as { markdown: string }).markdown).toContain('Extra Notes');

    const approved = await app.inject({
      method: 'POST',
      url: `/api/ingest/jobs/${job.id}/approve`,
      headers: ADMIN,
      payload: {},
    });
    expect(approved.statusCode).toBe(200);

    const done = await waitForJob(app, job.id, ADMIN, ['succeeded', 'failed']);
    expect(done.status).toBe('succeeded');
    const result = done.result as {
      manualId: string;
      rootMapPath: string;
      topics: { filePath: string }[];
      assets: { filePath: string }[];
      commitHash: string;
    };
    expect(result.manualId).toBeTruthy();
    expect(result.rootMapPath).toBe('imported-guide.ditamap');
    const topicPath = result.topics[0]!.filePath;
    expect(topicPath).toMatch(/overview\.dita$/);
    expect(result.assets[0]?.filePath).toMatch(/^images\//);
    expect(result.commitHash).toBeTruthy();

    const manuals = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
    const listed = manuals.json() as { manuals: { id: string; name: string; rootDir: string }[] };
    const manual = listed.manuals.find((entry) => entry.id === result.manualId);
    expect(manual).toBeTruthy();
    expect(manual!.name).toBe('Imported Guide');
    expect(existsSync(path.join(manual!.rootDir, 'imported-guide.ditamap'))).toBe(true);
    expect(existsSync(path.join(manual!.rootDir, topicPath))).toBe(true);
    expect(existsSync(path.join(manual!.rootDir, result.assets[0]!.filePath))).toBe(true);
    expect(porcelain(manual!.rootDir)).toBe('');
    expect(head(manual!.rootDir)).toBe(result.commitHash);
  });
});

describe('existing manual import', () => {
  it('writes topics, image and map only into the caller overlay while the shared workdir stays clean', async () => {
    const script = scriptedModel({
      planner: [
        planReply({
          title: 'Imported Guide',
          rootMapPath: 'imported-guide.ditamap',
          topics: [
            {
              topicId: 'concept_imported_overview',
              title: 'Imported Overview',
              type: 'concept',
              filePath: 'ingest/overview.dita',
            },
            {
              topicId: 'concept_imported_install',
              title: 'Imported Install',
              type: 'concept',
              filePath: 'ingest/install.dita',
            },
          ],
        }),
      ],
      writer: [
        conceptReply({ topicId: 'concept_imported_overview', title: 'Imported Overview' }),
        conceptReply({ topicId: 'concept_imported_install', title: 'Imported Install' }),
      ],
    });
    app = createApp(fixture, script.factory);
    const manualId = await bootstrap(app, fixture);
    const baselineHead = head(fixture.projectDir);
    const baselineMap = readFileSync(path.join(fixture.projectDir, ROOT_MAP), 'utf8');

    const created = await upload(
      app,
      ADMIN,
      {
        targetMode: 'multi_topic',
        autoApprove: true,
        manualId,
        branch: 'main',
        mountMapPath: ROOT_MAP,
        language: 'en',
      },
      { filename: 'guide.md', content: TWO_TOPIC_MARKDOWN },
    );
    expect(created.statusCode).toBe(202);
    const jobId = (created.json() as { id: string }).id;

    const done = await waitForJob(app, jobId, ADMIN, ['succeeded', 'failed']);
    expect(done.status, JSON.stringify(done.error)).toBe('succeeded');
    const result = done.result as {
      mountedMapPath?: string;
      topics: { filePath: string }[];
      draftCount?: number;
      warnings?: string[];
    };
    expect(result.mountedMapPath).toBe(ROOT_MAP);
    expect(result.draftCount).toBe(3);
    expect(result.warnings ?? []).toEqual([]);

    // Phase 13 invariant: the shared baseline worktree never moves.
    expect(porcelain(fixture.projectDir)).toBe('');
    expect(head(fixture.projectDir)).toBe(baselineHead);

    const adminHeaders = scoped(ADMIN, { manualId, branch: 'main' });
    const overview = await readContent(app, adminHeaders, 'ingest/overview.dita');
    expect(overview.statusCode).toBe(200);
    expect((overview.json() as { content: string; isDraft: boolean }).isDraft).toBe(true);

    const map = await readContent(app, adminHeaders, ROOT_MAP);
    expect(map.statusCode).toBe(200);
    const mapBody = map.json() as { content: string; isDraft: boolean };
    expect(mapBody.isDraft).toBe(true);
    expect(mapBody.content).toContain('ingest/overview.dita');
    expect(mapBody.content).toContain('ingest/install.dita');
    expect(baselineMap).not.toContain('ingest/overview.dita');

    // A second user sees neither the generated topics nor the edited map.
    const otherHeaders = scoped(WRITER, { manualId, branch: 'main' });
    const hidden = await readContent(app, otherHeaders, 'ingest/overview.dita');
    expect(hidden.statusCode).toBe(404);
    const otherMap = await readContent(app, otherHeaders, ROOT_MAP);
    expect((otherMap.json() as { content: string }).content).not.toContain('ingest/overview.dita');
  });

  it('does not steal a map lock held by another user and still writes the topic drafts', async () => {
    const script = scriptedModel({
      planner: [
        planReply({
          title: 'Imported Guide',
          rootMapPath: 'imported-guide.ditamap',
          topics: [
            {
              topicId: 'concept_imported_overview',
              title: 'Imported Overview',
              type: 'concept',
              filePath: 'ingest/overview.dita',
            },
          ],
        }),
      ],
      writer: [
        conceptReply({ topicId: 'concept_imported_overview', title: 'Imported Overview' }),
      ],
    });
    app = createApp(fixture, script.factory);
    const manualId = await bootstrap(app, fixture);

    const lock = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: scoped(WRITER_B, { manualId, branch: 'main' }),
      payload: { path: ROOT_MAP },
    });
    expect(lock.statusCode).toBe(200);

    const created = await upload(
      app,
      ADMIN,
      {
        targetMode: 'single_topic',
        autoApprove: true,
        manualId,
        branch: 'main',
        mountMapPath: ROOT_MAP,
        language: 'en',
      },
      { filename: 'guide.md', content: ONE_TOPIC_MARKDOWN },
    );
    expect(created.statusCode).toBe(202);
    const done = await waitForJob(app, (created.json() as { id: string }).id, ADMIN, [
      'succeeded',
      'failed',
    ]);
    expect(done.status, JSON.stringify(done.error)).toBe('succeeded');
    const result = done.result as { mountedMapPath?: string; topics: { filePath: string }[]; warnings: string[] };
    expect(result.mountedMapPath).toBeUndefined();
    expect(result.topics.map((topic) => topic.filePath)).toContain('ingest/overview.dita');
    expect(result.warnings.join(' ')).toContain(ROOT_MAP);

    const adminHeaders = scoped(ADMIN, { manualId, branch: 'main' });
    const topic = await readContent(app, adminHeaders, 'ingest/overview.dita');
    expect(topic.statusCode).toBe(200);
    const map = await readContent(app, adminHeaders, ROOT_MAP);
    expect((map.json() as { content: string }).content).not.toContain('ingest/overview.dita');

    // The other user's lock survives untouched.
    const locks = await app.inject({
      method: 'GET',
      url: '/api/locks',
      headers: scoped(ADMIN, { manualId, branch: 'main' }),
    });
    const lockRows = (locks.json() as { locks: { filePath: string; userId: string }[] }).locks;
    expect(lockRows.find((row) => row.filePath === ROOT_MAP)?.userId).toBe('u-writer-chen');
    expect(porcelain(fixture.projectDir)).toBe('');
  });
});

describe('job cancellation', () => {
  it('cancels a job waiting for plan approval', async () => {
    const script = scriptedModel({
      planner: [
        planReply({
          title: 'Cancel Me',
          rootMapPath: 'cancel-me.ditamap',
          topics: [
            { topicId: 'concept_cancel', title: 'Cancel', type: 'concept', filePath: 'cancel.dita' },
          ],
        }),
      ],
      writer: [conceptReply({ topicId: 'concept_cancel', title: 'Cancel' })],
    });
    app = createApp(fixture, script.factory);

    const created = await upload(app, ADMIN, { targetMode: 'new_manual', autoApprove: false });
    expect(created.statusCode).toBe(202);
    const jobId = (created.json() as { id: string }).id;
    const paused = await waitForJob(app, jobId, ADMIN, ['awaiting_plan_approval', 'failed']);
    expect(paused.status).toBe('awaiting_plan_approval');

    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/ingest/jobs/${jobId}/cancel`,
      headers: ADMIN,
    });
    expect(cancelled.statusCode).toBe(200);
    expect((cancelled.json() as { status: string }).status).toBe('cancelled');

    const approvalAfterCancel = await app.inject({
      method: 'POST',
      url: `/api/ingest/jobs/${jobId}/approve`,
      headers: ADMIN,
      payload: {},
    });
    expect(approvalAfterCancel.statusCode).toBe(409);

    const listed = await app.inject({ method: 'GET', url: '/api/ingest/jobs', headers: ADMIN });
    const jobs = (listed.json() as { jobs: { id: string; status: string }[] }).jobs;
    expect(jobs.find((job) => job.id === jobId)?.status).toBe('cancelled');
  });

  it('streams typed SSE events for the owning user', async () => {
    const script = scriptedModel({
      planner: [
        planReply({
          title: 'Stream Me',
          rootMapPath: 'stream.ditamap',
          topics: [
            { topicId: 'concept_stream', title: 'Stream', type: 'concept', filePath: 'stream.dita' },
          ],
        }),
      ],
      writer: [conceptReply({ topicId: 'concept_stream', title: 'Stream' })],
    });
    app = createApp(fixture, script.factory);
    const created = await upload(app, ADMIN, { targetMode: 'new_manual', autoApprove: false });
    const jobId = (created.json() as { id: string }).id;
    await waitForJob(app, jobId, ADMIN, ['awaiting_plan_approval', 'failed']);

    const events: IngestStreamEvent[] = [];
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const controller = new AbortController();
    const response = await fetch(`${address}/api/ingest/jobs/${jobId}/stream`, {
      headers: ADMIN,
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    const deadline = Date.now() + 10_000;
    let buffer = '';
    while (Date.now() < deadline && events.length < 1) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += Buffer.from(chunk.value).toString('utf8');
      if (buffer.includes('\n\n')) {
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
          if (dataLine) events.push(JSON.parse(dataLine.slice(6)) as IngestStreamEvent);
        }
      }
    }
    controller.abort();
    expect(events[0]?.type).toBe('snapshot');
    expect((events[0] as { job: { id: string } }).job.id).toBe(jobId);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Validation failure reporting                                                               */
/* ------------------------------------------------------------------------------------------ */

describe('ingest validation failure reporting', () => {
  it('prefers the blocking DOTJ013E error over the DOTJ076W external-link warnings', async () => {
    const node = { topicId: 'concept_overview', title: 'Product Overview', type: 'concept', filePath: 'overview.dita' };
    const script = scriptedModel({
      planner: [
        planReply({
          title: 'Imported Guide',
          rootMapPath: 'imported-guide.ditamap',
          topics: [node],
        }),
      ],
      writer: [conceptReply(node)],
      repair: [conceptReply(node)],
    });

    // Real-world shape: 12 external-link warnings come first, the single blocking error last.
    // The plan normalizes `overview.dita` to `concepts/overview.dita`, which is what DITA-OT reports.
    const generatedPath = 'concepts/overview.dita';
    const warnings: StrictDiagnostic[] = Array.from({ length: 12 }, (_value, index) => ({
      id: `dotj-warning-${index}`,
      filePath: generatedPath,
      line: 4,
      column: 1,
      severity: 'warning',
      message: `DOTJ076W: External link target ${index} was not resolved.`,
      code: 'DOTJ076W',
    }));
    const blocking: StrictDiagnostic = {
      id: 'dotj-error',
      filePath: generatedPath,
      line: 7,
      column: 3,
      severity: 'error',
      message: 'DOTJ013E: Failed to parse document: element "steps" not allowed here.',
      code: 'DOTJ013E',
    };
    const failingStrict = async (): Promise<StrictValidationResult> => ({
      ...STRICT_OK,
      ok: false,
      diagnostics: [...warnings, blocking],
      targets: [generatedPath],
      message: 'DITA-OT strict validation reported 1 error.',
    });

    app = createApp(fixture, script.factory, failingStrict);
    const created = await upload(app, ADMIN, {
      targetMode: 'new_manual',
      autoApprove: true,
      manualName: 'Imported Guide',
      language: 'en',
    });
    const jobId = (created.json() as { id: string }).id;
    const finished = await waitForJob(app, jobId, ADMIN, ['failed', 'succeeded']);
    expect(finished.status).toBe('failed');

    const error = String(finished.error ?? '');
    expect(error).toContain('DOTJ013E');
    expect(error).not.toContain('DOTJ076W');

    const progress = finished.progress as { stage: string; topics: { status: string; attempts: number }[] };
    // The stepper must stay on the stage where the job stopped, and the topic must show the failure.
    expect(progress.stage).toBe('validating');
    expect(progress.topics[0]).toMatchObject({ status: 'failed' });
  });
});
