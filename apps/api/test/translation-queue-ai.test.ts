import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessage } from '@langchain/core/messages';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER_A = { 'x-dita-user-id': 'u-writer-lin' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const ROOT_MAP = 'product-manual.ditamap';
const NAV_MAP = 'maps/guide.ditamap';

/** Map whose navigation labels live in `navtitle`/`title` attributes, not in child elements. */
const NAV_MAP_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- nav labels live in attributes -->
<map id="guide" title="Product Guide" xml:lang="en-US">
  <topichead navtitle="Getting started">
    <topicref href="topics/task-install.dita" type="task" format="dita" navtitle="Install &amp; configure" rev="1.2"/>
  </topichead>
  <mapref href="maps/reference.ditamap" format="ditamap" navtitle="Reference"/>
</map>`;

const TASK = 'topics/task-install.dita';
const CONCEPT = 'topics/concept-overview.dita';

const TASK_SOURCE_V1 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task-install" xml:lang="en-US">
  <title>Install the product</title>
  <taskbody>
    <steps>
      <step><cmd>Download the installer package.</cmd></step>
      <step><cmd>Run the installer as an administrator.</cmd></step>
      <step><cmd>Confirm the <b>license agreement</b> to continue.</cmd></step>
    </steps>
  </taskbody>
</task>
`;

const TASK_SOURCE_V2 = TASK_SOURCE_V1.replace(
  'Run the installer as an administrator.',
  'Run the signed installer as an administrator.',
);

const TASK_TARGET_V0 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task-install" xml:lang="zh-CN">
  <title>安装产品</title>
  <taskbody>
    <steps>
      <step><cmd>下载安装程序包。</cmd></step>
      <step><cmd>以管理员身份运行安装程序。</cmd></step>
      <step><cmd>确认<b>许可协议</b>以继续。</cmd></step>
    </steps>
  </taskbody>
</task>
`;

// 1x1 transparent PNG used to prove binary assets are rejected by the queue.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const CONCEPT_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept-overview" xml:lang="en-US">
  <title>Product overview</title>
  <conbody>
    <p>The product ships with a guided installer.</p>
  </conbody>
</concept>
`;

function rootMap(lang = 'en-US'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="product-manual" xml:lang="${lang}">
  <title>Product Manual</title>
  <topicref href="${TASK}"/>
  <topicref href="${CONCEPT}"/>
</map>
`;
}

interface Fixture {
  root: string;
  projectDir: string;
  importsDir: string;
  draftAssetsDir: string;
  dbPath: string;
  worktreesRootDir: string;
  publishRootDir: string;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-translation-queue-'));
  const projectDir = path.join(root, 'workspace');
  const importsDir = path.join(root, 'manuals');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(importsDir, { recursive: true });
  return {
    root,
    projectDir,
    importsDir,
    draftAssetsDir: path.join(root, 'draft-assets'),
    dbPath: path.join(root, 'translation.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
  };
}

interface AppOptions {
  aiModelFactory?: AiModelFactory;
  translationConcurrency?: number;
}

function createApp(fixture: Fixture, options: AppOptions = {}) {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    draftAssetsRootDir: fixture.draftAssetsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    publishRootDir: fixture.publishRootDir,
    publishConcurrency: 1,
    ...(options.aiModelFactory ? { aiModelFactory: options.aiModelFactory } : {}),
    ...(options.translationConcurrency ? { translationConcurrency: options.translationConcurrency } : {}),
    logger: false,
  });
}

type App = ReturnType<typeof createApp>;

/* -------------------------------------------------------------------------- */
/* Git / SQLite helpers                                                        */
/* -------------------------------------------------------------------------- */

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
}

function porcelain(cwd: string): string {
  return git(cwd, 'status --porcelain');
}

function commitAll(cwd: string, message: string): void {
  git(cwd, 'add -A');
  git(cwd, `commit -m "${message}"`);
}

function sqliteRows<T>(dbPath: string, sql: string, params: unknown[] = []): T[] {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare(sql).all(...params) as T[];
  } finally {
    db.close();
  }
}

function sqliteRun(dbPath: string, sql: string, params: unknown[] = []): void {
  const db = new Database(dbPath);
  try {
    db.prepare(sql).run(...params);
  } finally {
    db.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Scripted model                                                              */
/* -------------------------------------------------------------------------- */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return JSON.stringify(content);
  return String(content ?? '');
}

/** Extracts the `<tsegment id="…">` ids the orchestrator asked us to translate. */
function segmentIds(prompt: string): string[] {
  return [...prompt.matchAll(/<tsegment id="([^"]+)"/g)].map((match) => match[1] ?? '');
}

function currentSource(prompt: string, segmentId: string): string {
  const escaped = segmentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<tsegment id="${escaped}"[^>]*>\\s*(?:<prev_source>[\\s\\S]*?</prev_source>\\s*)?<curr_source>([\\s\\S]*?)</curr_source>`,
  );
  return pattern.exec(prompt)?.[1] ?? '';
}

interface ScriptedModel {
  prompts: string[];
  factory: AiModelFactory;
}

/**
 * Builds an `AiModelFactory` that records every human prompt and answers with whatever the
 * handler returns. Token usage is attached so the `ai_usage_logs` assertions are meaningful.
 */
function scriptedModel(
  handler: (prompt: string, callIndex: number) => string | Promise<string>,
  options: { delayMs?: number } = {},
): ScriptedModel {
  const prompts: string[] = [];
  const factory: AiModelFactory = () => ({
    // eslint-disable-next-line require-yield
    async *stream() {
      throw new Error('streaming is not used by the translation orchestrator');
    },
    async invoke(messages) {
      const last = messages[messages.length - 1];
      const prompt = humanText(last?.content);
      prompts.push(prompt);
      const callIndex = prompts.length - 1;
      if (options.delayMs) await sleep(options.delayMs);
      const content = await handler(prompt, callIndex);
      return new AIMessage({
        content,
        usage_metadata: { input_tokens: 120, output_tokens: 40, total_tokens: 160 },
      });
    },
  });
  return { prompts, factory };
}

/** Default reply: one well-formed `<tblock>` per requested segment. */
function replyAll(prompt: string, translate: (segmentId: string, sourceXml: string) => string): string {
  return segmentIds(prompt)
    .map((id) => `<tblock id="${id}">${translate(id, currentSource(prompt, id))}</tblock>`)
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/* Translation setup helpers                                                   */
/* -------------------------------------------------------------------------- */

interface ManualLite {
  id: string;
  name: string;
  rootDir: string;
  sourceLang?: string | null;
}

interface LinkLite {
  id: string;
  sourceManualId: string;
  targetManualId: string;
  sourceBranch: string;
  targetBranch: string;
  sourceLang: string;
  targetLang: string;
  targetManual: ManualLite;
}

async function createSourceManual(app: App, files?: Array<{ path: string; content: string }>): Promise<ManualLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/manuals',
    headers: ADMIN,
    payload: {
      mode: 'import',
      name: 'Source Manual',
      initGit: true,
      files: files ?? [
        { path: ROOT_MAP, content: rootMap() },
        { path: TASK, content: TASK_SOURCE_V1 },
        { path: CONCEPT, content: CONCEPT_SOURCE },
        { path: 'images/logo.png', content: PNG_BASE64, encoding: 'base64' },
      ],
    },
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { manual: ManualLite }).manual;
}

async function createLink(app: App, sourceManualId: string, headers = WRITER_A): Promise<LinkLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/translation/links',
    headers,
    payload: {
      sourceManualId,
      targetLang: 'zh-CN',
      // Phase 16: the dual-AI review loop and the job-level DITA-OT pass have their own suite
      // (`translation-review-and-strict.test.ts`); these legacy queue/review tests stay
      // deterministic and fast by turning both off at the link level.
      options: { aiReviewEnabled: false, ditaOtStrictEnabled: false, maxQaRepairRounds: 0 },
    },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { link: LinkLite }).link;
}

async function markSynced(app: App, linkId: string, paths: string[]): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/translation/links/${linkId}/mark-synced`,
    headers: WRITER_A,
    payload: { paths },
  });
  expect(response.statusCode).toBe(200);
}

async function enqueue(
  app: App,
  linkId: string,
  paths: string[],
  options: { mode?: 'incremental' | 'full'; headers?: Record<string, string> } = {},
) {
  return await app.inject({
    method: 'POST',
    url: '/api/translation/jobs',
    headers: options.headers ?? WRITER_A,
    payload: { linkId, paths, ...(options.mode ? { mode: options.mode } : {}) },
  });
}

interface JobItem {
  id: string;
  jobId: string;
  linkId: string;
  sourcePath: string;
  targetPath: string;
  status: string;
  modeUsed: string | null;
  reusedSegments: number;
  translatedSegments: number;
  qaErrorCount: number;
  qaWarningCount: number;
  error: string | null;
  retryCount: number;
}

interface JobSnapshot {
  job: {
    id: string;
    status: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    mode: string;
    cancelRequested: boolean;
  };
  items: JobItem[];
}

interface JobSeed {
  link: LinkLite;
  /** Source manual root (shared workDir of the source branch). */
  sourceRoot: string;
  /** Target manual root (shared workDir of the target branch). */
  targetRoot: string;
}

/**
 * Source manual with one translated target topic (`T0`) whose watermarks are recorded, then an
 * edited source (`S1`) on top of the translated source snapshot (`S0`). This is exactly the state
 * a real incremental translation starts from.
 */
async function seedTranslatedPair(
  app: App,
  options: { targetXml?: string; translated?: boolean } = {},
): Promise<JobSeed> {
  const source = await createSourceManual(app);
  const link = await createLink(app, source.id);

  if (options.translated !== false) {
    const targetRoot = link.targetManual.rootDir;
    mkdirSync(path.join(targetRoot, path.dirname(TASK)), { recursive: true });
    writeFileSync(path.join(targetRoot, TASK), options.targetXml ?? TASK_TARGET_V0, 'utf8');
    commitAll(targetRoot, 'translate task');
    await markSynced(app, link.id, [TASK]);

    // `S0` → `S1`: one sentence changes inside the second step.
    writeFileSync(path.join(source.rootDir, TASK), TASK_SOURCE_V2, 'utf8');
    commitAll(source.rootDir, 'update install step');
  }

  return { link, sourceRoot: source.rootDir, targetRoot: link.targetManual.rootDir };
}

async function awaitJob(app: App, jobId: string, timeoutMs = 20_000): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs/${jobId}`,
      headers: WRITER_A,
    });
    expect(response.statusCode).toBe(200);
    const snapshot = response.json() as JobSnapshot;
    if (['completed', 'completed_with_errors', 'failed', 'cancelled'].includes(snapshot.job.status)) {
      return snapshot;
    }
    if (Date.now() > deadline) {
      throw new Error(`job ${jobId} did not finish: ${snapshot.job.status}`);
    }
    await sleep(20);
  }
}

async function review(app: App, itemId: string): Promise<{
  item: JobItem;
  proposedXml: string;
  qaReport: { issues: Array<{ code: string; segmentId?: string | null }>; errorCount: number; warningCount: number };
  segments: Array<{
    segmentId: string;
    proposedTargetXml: string | null;
    proposedTargetText: string | null;
    attributeName?: string | null;
    qaIssues: Array<{ code: string }>;
  }>;
  glossary: unknown[];
}> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/translation/items/${itemId}/review`,
    headers: WRITER_A,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as never;
}

let cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
  cleanup = [];
});

function boot(options: AppOptions = {}) {
  const fixture = makeFixture();
  const app = createApp(fixture, options);
  const dispose = async () => {
    await app.close();
    rmSync(fixture.root, { recursive: true, force: true });
  };
  cleanup.push(dispose);
  return { fixture, app, dispose };
}

/* -------------------------------------------------------------------------- */
/* AI translation                                                              */
/* -------------------------------------------------------------------------- */

describe('AI block translator — three-way incremental translation', () => {
  it('sends only the modified block, reuses the human translation byte-for-byte and injects the glossary', async () => {
    const model = scriptedModel((prompt) =>
      replyAll(prompt, (_id, sourceXml) => {
        if (sourceXml.includes('signed installer')) return '以管理员身份运行已签名的安装程序。';
        return `译文：${sourceXml.replace(/<[^>]+>/g, '')}`;
      }),
    );
    const { fixture, app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    // Glossary: "installer" must be rendered as 安装程序, never 安装包.
    const glossaryResponse = await app.inject({
      method: 'POST',
      url: '/api/glossaries',
      headers: ADMIN,
      payload: { scope: 'global', name: 'UI terms', sourceLang: 'en-US' },
    });
    expect(glossaryResponse.statusCode).toBe(201);
    const glossaryId = (glossaryResponse.json() as { glossary: { id: string } }).glossary.id;
    const termResponse = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossaryId}/terms`,
      headers: ADMIN,
      payload: {
        sourceTerm: 'installer',
        translations: [
          {
            targetLang: 'zh-CN',
            targetTerm: '安装程序',
            forbiddenTargets: ['安装包'],
            contextNote: 'Ships with the product',
          },
        ],
      },
    });
    expect(termResponse.statusCode).toBe(201);

    const created = await enqueue(app, seed.link.id, [TASK], { mode: 'incremental' });
    expect(created.statusCode).toBe(201);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    expect(snapshot.job.status).toBe('completed');
    expect(snapshot.items).toHaveLength(1);
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');
    expect(item.modeUsed).toBe('incremental');
    // Exactly one block needed AI work; every other block was reused from the human translation.
    expect(item.translatedSegments).toBe(1);
    expect(item.reusedSegments).toBeGreaterThanOrEqual(3);

    expect(model.prompts).toHaveLength(1);
    const prompt = model.prompts[0]!;
    // Only the modified segment reached the model.
    expect(prompt).toContain('Run the signed installer as an administrator.');
    expect(prompt).toContain('<curr_source><cmd>');
    expect(prompt).not.toContain('Download the installer package.');
    expect(prompt).not.toContain('Confirm the ');
    // The three-way context and the matched glossary entry are both present.
    expect(prompt).toContain('<prev_source><cmd>Run the installer as an administrator.</cmd></prev_source>');
    expect(prompt).toContain('<prev_target><cmd>以管理员身份运行安装程序。</cmd></prev_target>');
    expect(prompt).toContain('- "installer" => "安装程序"');
    expect(prompt).toContain('forbidden: 安装包');

    const payload = await review(app, item.id);
    expect(payload.proposedXml).toContain('下载安装程序包。');
    expect(payload.proposedXml).toContain('确认<b>许可协议</b>以继续。');
    expect(payload.proposedXml).toContain('以管理员身份运行已签名的安装程序。');
    // The untouched human blocks survive byte-for-byte (including the inline <b> element).
    expect(payload.proposedXml).toContain('确认<b>许可协议</b>以继续。');

    // QA runs live and reports the glossary author's forbidden variant / missing term.
    expect(payload.glossary.length).toBeGreaterThanOrEqual(1);
    expect(payload.qaReport.errorCount + payload.qaReport.warningCount).toBeGreaterThanOrEqual(0);

    // Usage ledger: translate_batch, no document content.
    const usage = sqliteRows<{
      task_type: string;
      sub_action: string;
      status: string;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      file_path: string;
      model: string;
      error_message: string | null;
    }>(fixture.dbPath, 'select * from ai_usage_logs order by rowid');
    expect(usage).toHaveLength(1);
    expect(usage[0]!.task_type).toBe('translate_batch');
    expect(usage[0]!.status).toBe('succeeded');
    expect(usage[0]!.file_path).toBe(TASK);
    expect(usage[0]!.prompt_tokens).toBe(120);
    expect(usage[0]!.completion_tokens).toBe(40);
    expect(usage[0]!.total_tokens).toBe(160);
    expect(usage[0]!.error_message).toBeNull();
    const dump = JSON.stringify(usage);
    expect(dump).not.toContain('<tblock');
    expect(dump).not.toContain('installer');
  }, 40_000);


  it('normalizes navtitle attribute replies (echoed wrapper, bare &) and keeps the map intact', async () => {
    const model = scriptedModel((prompt) =>
      replyAll(prompt, (segmentId, sourceXml) => {
        // Models echo the element back for attribute segments — unwrap it, do not splice a child.
        if (segmentId.endsWith('topichead[0]/@navtitle')) return '<navtitle>入门 & 安装</navtitle>';
        // …and they forget to escape `&`, which must become `&amp;` in the attribute value.
        if (segmentId.endsWith('mapref[0]/@navtitle')) return '参考 & 索引';
        return `译文：${sourceXml}`;
      }),
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const source = await createSourceManual(app, [
      { path: ROOT_MAP, content: rootMap() },
      { path: TASK, content: TASK_SOURCE_V1 },
      { path: CONCEPT, content: CONCEPT_SOURCE },
      { path: NAV_MAP, content: NAV_MAP_SOURCE },
    ]);
    const link = await createLink(app, source.id);
    const created = await enqueue(app, link.id, [NAV_MAP], { mode: 'full' });
    expect(created.statusCode).toBe(201);
    const snapshot = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    expect(snapshot.job.status).toBe('completed');
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');

    // The prompt marks attribute segments so the model answers with plain text.
    const prompt = model.prompts[0]!;
    expect(prompt).toContain('attr="navtitle"');
    expect(prompt).toContain('attr="title"');
    expect(prompt).toContain('<curr_source>Getting started</curr_source>');

    const payload = await review(app, item.id);
    expect(payload.proposedXml).toContain('<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">');
    expect(payload.proposedXml).toContain('<!-- nav labels live in attributes -->');
    expect(payload.proposedXml).toContain('<topichead navtitle="入门 &amp; 安装">');
    expect(payload.proposedXml).toContain('<mapref href="maps/reference.ditamap" format="ditamap" navtitle="参考 &amp; 索引"/>');
    expect(payload.proposedXml).toContain(
      `<topicref href="${TASK}" type="task" format="dita" navtitle="译文：Install &amp; configure" rev="1.2"/>`,
    );
    expect(payload.proposedXml).toContain('<map id="guide" title="译文：Product Guide" xml:lang="zh-CN">');
    // No element ever replaced the attribute value.
    expect(payload.proposedXml).not.toContain('<navtitle>');
    expect(payload.proposedXml).not.toContain('navtitle="Getting started"');
    const attributes = payload.segments.filter((segment) => segment.attributeName);
    expect(attributes.map((segment) => [segment.segmentId, segment.attributeName])).toEqual([
      ['map[0]/@title', 'title'],
      ['map[0]/topichead[0]/@navtitle', 'navtitle'],
      ['map[0]/topichead[0]/topicref[0]/@navtitle', 'navtitle'],
      ['map[0]/mapref[0]/@navtitle', 'navtitle'],
    ]);
    expect(
      payload.segments.find((segment) => segment.segmentId === 'map[0]/mapref[0]/@navtitle')
        ?.proposedTargetText,
    ).toBe('参考 & 索引');
  });

  it('flags a missing glossary term in the QA report', async () => {
    const model = scriptedModel((prompt) =>
      // Deliberately drops the mandated term and uses the forbidden variant instead.
      replyAll(prompt, (_id, sourceXml) =>
        sourceXml.includes('signed installer') ? '使用安装包运行签名程序。' : `译文：${sourceXml}`,
      ),
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    const glossaryResponse = await app.inject({
      method: 'POST',
      url: '/api/glossaries',
      headers: ADMIN,
      payload: { scope: 'global', name: 'UI terms', sourceLang: 'en-US' },
    });
    const glossaryId = (glossaryResponse.json() as { glossary: { id: string } }).glossary.id;
    await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossaryId}/terms`,
      headers: ADMIN,
      payload: {
        sourceTerm: 'installer',
        translations: [
          { targetLang: 'zh-CN', targetTerm: '安装程序', forbiddenTargets: ['安装包'] },
        ],
      },
    });

    const created = await enqueue(app, seed.link.id, [TASK]);
    const snapshot = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');

    const payload = await review(app, item.id);
    const codes = payload.qaReport.issues.map((issue) => issue.code);
    expect(codes).toContain('missing_glossary_term');
    expect(codes).toContain('forbidden_translation');
    expect(payload.qaReport.errorCount).toBeGreaterThan(0);
    expect(item.qaErrorCount).toBeGreaterThan(0);
  }, 40_000);

  it('full mode re-translates every non-protected block and still passes T0 as reference', async () => {
    const model = scriptedModel((prompt) =>
      replyAll(prompt, (_id, sourceXml) => `全量：${sourceXml.replace(/<[^>]+>/g, '')}`),
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    const created = await enqueue(app, seed.link.id, [TASK], { mode: 'full' });
    const snapshot = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    expect(snapshot.job.status).toBe('completed');
    const item = snapshot.items[0]!;
    expect(item.modeUsed).toBe('full');
    expect(item.translatedSegments).toBeGreaterThan(1);
    expect(item.reusedSegments).toBe(0);

    const prompt = model.prompts[0]!;
    expect(prompt).toContain('Download the installer package.');
    expect(prompt).toContain('Confirm the ');
    expect(prompt).toContain('<prev_target>');
    expect(prompt).toContain('以管理员身份运行安装程序。');
  }, 40_000);

  it('retries a malformed model reply and recovers with explicit error feedback', async () => {
    const model = scriptedModel((prompt, callIndex) => {
      if (callIndex === 0) {
        // Correct ids, unclosed inline tag: well-formedness must reject this.
        return segmentIds(prompt)
          .map((id) => `<tblock id="${id}">译文 <b>未闭合</tblock>`)
          .join('\n');
      }
      return replyAll(prompt, (_id, sourceXml) => `修复：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    const created = await enqueue(app, seed.link.id, [TASK]);
    const snapshot = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    expect(snapshot.job.status).toBe('completed');
    expect(snapshot.items[0]!.status).toBe('ready_for_review');
    expect(model.prompts).toHaveLength(2);
    // The retry names the malformed segment and the reason.
    expect(model.prompts[1]).toContain('previous attempt had problems');
    expect(model.prompts[1]).toContain('not well-formed');

  }, 40_000);

  it('fails the item when every attempt is malformed and records the failure in the usage ledger', async () => {
    const model = scriptedModel((prompt) =>
      segmentIds(prompt)
        .map((id) => `<tblock id="${id}">译文 <b>未闭合</tblock>`)
        .join('\n'),
    );
    const { fixture, app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    const created = await enqueue(app, seed.link.id, [TASK]);
    const snapshot = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    expect(snapshot.job.status).toBe('failed');
    expect(snapshot.items[0]!.status).toBe('failed');
    expect(snapshot.items[0]!.error).toContain('did not return valid XML');

    const usage = sqliteRows<{ task_type: string; status: string; error_message: string | null }>(
      fixture.dbPath,
      'select task_type, status, error_message from ai_usage_logs order by rowid',
    );
    expect(usage).toHaveLength(1);
    expect(usage[0]!.status).toBe('failed');
    expect(usage[0]!.error_message).toContain('Missing or malformed translation blocks');
  }, 40_000);

  it('rejects viewers and non-translatable paths', async () => {
    const model = scriptedModel((prompt) => replyAll(prompt, (_id, sourceXml) => String(sourceXml)));
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    const viewer = await enqueue(app, seed.link.id, [TASK], { headers: VIEWER });
    expect(viewer.statusCode).toBe(403);

    const asset = await enqueue(app, seed.link.id, ['images/logo.png']);
    expect(asset.statusCode).toBe(400);

    const missing = await enqueue(app, seed.link.id, ['topics/nope.dita']);
    expect(missing.statusCode).toBe(404);
  }, 40_000);

  it('keeps the translated baseline when a scan runs between the source edit and the enqueue', async () => {
    const model = scriptedModel((prompt) =>
      replyAll(prompt, (_id, sourceXml) =>
        sourceXml.includes('signed installer')
          ? '以管理员身份运行已签名的安装程序。'
          : `译文：${sourceXml.replace(/<[^>]+>/g, '')}`,
      ),
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app);

    // The Translation Center rescans before it enqueues. That scan only *detects* the edit, so it
    // must not move the `S0` pointer onto the edited commit: the next plan would diff the new
    // source against itself, report every block `unchanged`, and reuse the stale translation.
    const scanned = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${seed.link.id}/scan`,
      headers: WRITER_A,
    });
    expect(scanned.statusCode).toBe(200);
    const scanBody = scanned.json() as {
      files: Array<{ sourcePath: string; status: string; lastSourceCommit: string | null }>;
    };
    const taskFile = scanBody.files.find((file) => file.sourcePath === TASK);
    expect(taskFile?.status).toBe('outdated');
    expect(taskFile?.lastSourceCommit).not.toBe(git(seed.sourceRoot, 'rev-parse HEAD'));

    const created = await enqueue(app, seed.link.id, [TASK], { mode: 'incremental' });
    expect(created.statusCode).toBe(201);
    const snapshot = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    expect(snapshot.job.status).toBe('completed');
    const item = snapshot.items[0]!;
    expect(item.modeUsed).toBe('incremental');
    expect(item.translatedSegments).toBe(1);
    expect(item.reusedSegments).toBeGreaterThanOrEqual(3);
    expect(model.prompts).toHaveLength(1);
    expect(model.prompts[0]).toContain('Run the signed installer as an administrator.');
  }, 40_000);

  it('does not record a source baseline before a translation exists', async () => {
    const model = scriptedModel((prompt) => replyAll(prompt, () => '译文'));
    const { fixture, app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK], { mode: 'incremental' });
    expect(created.statusCode).toBe(201);

    // A queued file has no translated snapshot yet: pointing `last_source_commit` at the source
    // HEAD would make a later retry (failed / cancelled job) reuse a translation that never
    // existed, so the baseline must stay empty until check-in or `mark-synced`.
    const state = sqliteRows<{ last_source_commit: string | null }>(
      fixture.dbPath,
      'select last_source_commit from translation_file_states where source_path = ?',
      [TASK],
    );
    expect(state).toHaveLength(1);
    expect(state[0]!.last_source_commit ?? null).toBeNull();
  }, 40_000);
});

/* -------------------------------------------------------------------------- */
/* Persistent queue                                                            */
/* -------------------------------------------------------------------------- */

describe('translation queue — jobs, SSE, cancel, retry, recovery', () => {
  it('streams job.snapshot → item.updated → job.completed and runs one worker at a time', async () => {
    const model = scriptedModel(
      (prompt) => replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`),
      { delayMs: 120 },
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app, { translated: false });

    const created = await enqueue(app, seed.link.id, [TASK, CONCEPT]);
    expect(created.statusCode).toBe(201);
    const jobId = (created.json() as JobSnapshot).job.id;

    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(`${address}/api/translation/jobs/${jobId}/stream`, {
      headers: WRITER_A,
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const decoder = new TextDecoder();
    let buffer = '';
    const events: Array<{ event: string; data: string }> = [];
    const reader = response.body!.getReader();
    while (events.at(-1)?.event !== 'job.completed') {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let split = buffer.indexOf('\n\n');
      while (split >= 0) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const event = /^event: (.+)$/m.exec(raw)?.[1];
        const data = /^data: (.+)$/m.exec(raw)?.[1];
        if (event && data) events.push({ event, data });
        split = buffer.indexOf('\n\n');
      }
    }
    clearTimeout(timeout);
    await reader.cancel().catch(() => undefined);

    expect(events[0]!.event).toBe('job.snapshot');
    const names = events.map((event) => event.event);
    expect(names).toContain('item.updated');
    expect(names).toContain('job.completed');
    const completed = JSON.parse(events.at(-1)!.data) as { status: string; totalItems: number };
    expect(completed.status).toBe('completed');
    expect(completed.totalItems).toBe(2);

    const snapshot = await awaitJob(app, jobId);
    expect(snapshot.items.map((item) => item.status)).toEqual(['ready_for_review', 'ready_for_review']);
    expect(snapshot.job.completedItems).toBe(2);
    expect(snapshot.job.failedItems).toBe(0);
  }, 40_000);

  it('cancels a running job and marks queued items cancelled', async () => {
    const model = scriptedModel(
      (prompt) => replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml}`),
      { delayMs: 400 },
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app, { translated: false });

    const created = await enqueue(app, seed.link.id, [TASK, CONCEPT, ROOT_MAP]);
    const jobId = (created.json() as JobSnapshot).job.id;

    // Wait until the first item is actually in flight before cancelling.
    let started = false;
    for (let attempt = 0; attempt < 200 && !started; attempt += 1) {
      const response = await app.inject({ method: 'GET', url: `/api/translation/jobs/${jobId}`, headers: WRITER_A });
      const snapshot = response.json() as JobSnapshot;
      started = snapshot.items.some((item) => item.status === 'ai_translating' || item.status === 'validating');
      if (!started) await sleep(10);
    }
    expect(started).toBe(true);

    const cancel = await app.inject({
      method: 'POST',
      url: `/api/translation/jobs/${jobId}/cancel`,
      headers: WRITER_A,
    });
    expect(cancel.statusCode).toBe(200);

    const snapshot = await awaitJob(app, jobId);
    expect(snapshot.job.status).toBe('cancelled');
    expect(snapshot.items.every((item) => item.status === 'cancelled')).toBe(true);
    expect(snapshot.items[0]!.translatedSegments).toBe(0);

    const again = await app.inject({
      method: 'POST',
      url: `/api/translation/jobs/${jobId}/cancel`,
      headers: WRITER_A,
    });
    expect(again.statusCode).toBe(409);
  }, 40_000);

  it('retries only failed items and keeps the completed ones', async () => {
    let attempts = 0;
    // `maxRetries` is 2, so the job burns three attempts before the item is marked failed.
    const model = scriptedModel((prompt) => {
      attempts += 1;
      if (attempts <= 3) throw new Error('provider exploded');
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app, { translated: false });

    const created = await enqueue(app, seed.link.id, [TASK]);
    const failed = await awaitJob(app, (created.json() as JobSnapshot).job.id);
    expect(failed.job.status).toBe('failed');
    expect(failed.items[0]!.status).toBe('failed');
    expect(failed.items[0]!.error).toContain('provider exploded');

    const retry = await app.inject({
      method: 'POST',
      url: `/api/translation/jobs/${failed.job.id}/retry-failed`,
      headers: WRITER_A,
    });
    expect(retry.statusCode).toBe(200);
    const snapshot = await awaitJob(app, failed.job.id);
    expect(snapshot.job.status).toBe('completed');
    expect(snapshot.items[0]!.status).toBe('ready_for_review');
    expect(snapshot.items[0]!.retryCount).toBe(1);

    // A job without failed items has nothing to retry.
    const none = await app.inject({
      method: 'POST',
      url: `/api/translation/jobs/${failed.job.id}/retry-failed`,
      headers: WRITER_A,
    });
    expect(none.statusCode).toBe(400);
  }, 40_000);

  it('recovers items orphaned in ai_translating after an unclean shutdown', async () => {
    const model = scriptedModel((prompt) =>
      replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`),
    );
    const fixture = makeFixture();
    const first = createApp(fixture, { aiModelFactory: model.factory, translationConcurrency: 1 });
    let restarted: App | null = null;
    cleanup.push(async () => {
      if (restarted) await restarted.close();
      rmSync(fixture.root, { recursive: true, force: true });
    });

    const seed = await seedTranslatedPair(first, { translated: false });
    const created = await enqueue(first, seed.link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    await awaitJob(first, jobId);

    // Simulate a crash mid-translation: the item is stuck in `ai_translating`.
    sqliteRun(fixture.dbPath, "update translation_items set status = 'ai_translating' where job_id = ?", [
      jobId,
    ]);
    sqliteRun(
      fixture.dbPath,
      "update translation_jobs set status = 'running', finished_at = null where id = ?",
      [jobId],
    );
    await first.close();

    restarted = createApp(fixture, { aiModelFactory: model.factory, translationConcurrency: 1 });
    const snapshot = await awaitJob(restarted, jobId);
    expect(snapshot.job.status).toBe('completed');
    expect(snapshot.items[0]!.status).toBe('ready_for_review');
  }, 40_000);

  it('lists jobs by link and status', async () => {
    const model = scriptedModel((prompt) =>
      replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`),
    );
    const { app } = boot({ aiModelFactory: model.factory, translationConcurrency: 1 });
    const seed = await seedTranslatedPair(app, { translated: false });

    const created = await enqueue(app, seed.link.id, [CONCEPT]);
    await awaitJob(app, (created.json() as JobSnapshot).job.id);

    const list = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs?linkId=${seed.link.id}&status=completed`,
      headers: WRITER_A,
    });
    expect(list.statusCode).toBe(200);
    const jobs = (list.json() as { jobs: Array<{ id: string; status: string }> }).jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe('completed');

    const empty = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs?status=running`,
      headers: WRITER_A,
    });
    expect((empty.json() as { jobs: unknown[] }).jobs).toHaveLength(0);
  }, 40_000);
});
