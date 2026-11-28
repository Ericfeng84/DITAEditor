import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const ROOT_MAP = 'product-manual.ditamap';
const DETAIL_MAP = 'maps/guide.ditamap';
const TASK = 'topics/task-install.dita';
const CONCEPT = 'topics/concept-overview.dita';
/** Third translatable topic of the bulk-apply fixture (its target file is locked by another writer). */
const CLI = 'topics/reference-cli.dita';
/** Fourth topic that never runs through a job, so it has no proposal at all. */
const PENDING = 'topics/concept-pending.dita';
/** Binary asset used by the Phase 16 direct-downstream auto-rescan test. */
const ASSET = 'images/diagram.png';

// 1×1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TASK_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task-install" xml:lang="en-US">
  <title>Install the product</title>
  <taskbody>
    <steps>
      <step><cmd>Download the installer package.</cmd></step>
      <step><cmd>Run the installer as an administrator.</cmd></step>
    </steps>
  </taskbody>
</task>
`;

const CONCEPT_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept-overview" xml:lang="en-US">
  <title>Product overview</title>
  <conbody>
    <p>The product ships with a guided installer.</p>
  </conbody>
</concept>
`;

/** A finished proposal the human reviewer would already have accepted (incremental seed). */
const TASK_TARGET_V0 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task-install" xml:lang="zh-CN">
  <title>安装产品</title>
  <taskbody>
    <steps>
      <step><cmd>下载安装程序包。</cmd></step>
      <step><cmd>以管理员身份运行安装程序。</cmd></step>
    </steps>
  </taskbody>
</task>
`;

const CLI_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="reference-cli" xml:lang="en-US">
  <title>Command line reference</title>
  <refbody>
    <section><p>Run the installer from the command line.</p></section>
  </refbody>
</reference>
`;

const PENDING_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept-pending" xml:lang="en-US">
  <title>Pending concept</title>
  <conbody>
    <p>This topic was never sent through a translation job.</p>
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

/** A real-world map shape: navigation labels live in `navtitle`/`title` attributes, not children. */
function detailMap(lang = 'en-US'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- navigation labels live in navtitle attributes -->
<map id="guide-map" title="Product Guide" xml:lang="${lang}">
  <topicmeta>
    <keywords><keyword>product guide</keyword></keywords>
  </topicmeta>
  <topichead navtitle="Getting started">
    <topicref href="${TASK}" type="task" format="dita" navtitle="Install &amp; configure" rev="1.2"/>
    <topicref href="${CONCEPT}" type="concept" navtitle="Concepts"/>
  </topichead>
  <mapref href="maps/reference.ditamap" format="ditamap" navtitle="Reference"/>
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-translation-review-'));
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

function createApp(fixture: Fixture, aiModelFactory: AiModelFactory) {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    draftAssetsRootDir: fixture.draftAssetsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    publishRootDir: fixture.publishRootDir,
    publishConcurrency: 1,
    translationConcurrency: 1,
    aiModelFactory,
    logger: false,
  });
}

type App = ReturnType<typeof createApp>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
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

/** Seeds one historical `translation_items` row (the queue never writes these in tests). */
function insertItemRow(
  dbPath: string,
  row: {
    id: string;
    jobId: string;
    linkId: string;
    sourcePath: string;
    targetPath: string;
    status: string;
    updatedAt: number;
    qaErrorCount?: number;
    qaWarningCount?: number;
  },
): void {
  const qaReportJson =
    row.qaErrorCount === undefined && row.qaWarningCount === undefined
      ? null
      : JSON.stringify({
          issues: [],
          errorCount: row.qaErrorCount ?? 0,
          warningCount: row.qaWarningCount ?? 0,
          checkedSegments: 3,
        });
  const db = new Database(dbPath);
  try {
    db.prepare(
      `INSERT INTO translation_items
         (id, job_id, link_id, source_path, target_path, status, qa_report_json,
          reused_segments, translated_segments, retry_count, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
    ).run(
      row.id,
      row.jobId,
      row.linkId,
      row.sourcePath,
      row.targetPath,
      row.status,
      qaReportJson,
      row.updatedAt,
    );
  } finally {
    db.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return JSON.stringify(content);
  return String(content ?? '');
}

function segmentIds(prompt: string): string[] {
  return [...prompt.matchAll(/<tsegment id="([^"]+)"/g)].map((match) => match[1] ?? '');
}

/** Default scripted translator: mirrors the source text into a marker translation per block. */
function translationModel(prefix = '译文'): { prompts: string[]; factory: AiModelFactory } {
  const prompts: string[] = [];
  const factory: AiModelFactory = () => ({
    // eslint-disable-next-line require-yield
    async *stream() {
      throw new Error('streaming is not used by the translation orchestrator');
    },
    async invoke(messages) {
      const prompt = humanText(messages[messages.length - 1]?.content);
      prompts.push(prompt);
      const blocks = segmentIds(prompt).map((id) => {
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const inner =
          new RegExp(`<tsegment id="${escaped}"[^>]*>[\\s\\S]*?<curr_source>([\\s\\S]*?)</curr_source>`)
            .exec(prompt)?.[1] ?? '';
        return `<tblock id="${id}">${prefix}：${inner.replace(/<[^>]+>/g, '')}</tblock>`;
      });
      return new AIMessage({
        content: blocks.join('\n'),
        usage_metadata: { input_tokens: 90, output_tokens: 30, total_tokens: 120 },
      });
    },
  });
  return { prompts, factory };
}

interface ManualLite {
  id: string;
  name: string;
  rootDir: string;
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

async function createSourceManual(
  app: App,
  extraFiles: Array<{ path: string; content: string; encoding?: 'base64' }> = [],
  lang = 'en-US',
): Promise<ManualLite> {
  const localize = (xml: string) => xml.replace('xml:lang="en-US"', `xml:lang="${lang}"`);
  const response = await app.inject({
    method: 'POST',
    url: '/api/manuals',
    headers: ADMIN,
    payload: {
      mode: 'import',
      name: 'Source Manual',
      initGit: true,
      files: [
        { path: ROOT_MAP, content: rootMap(lang) },
        { path: TASK, content: localize(TASK_SOURCE) },
        { path: CONCEPT, content: localize(CONCEPT_SOURCE) },
        ...extraFiles,
      ],
    },
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { manual: ManualLite }).manual;
}

async function createLink(
  app: App,
  sourceManualId: string,
  targetLang = 'zh-CN',
): Promise<LinkLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/translation/links',
    headers: WRITER_A,
    payload: {
      sourceManualId,
      targetLang,
      // Phase 16: the dual-AI review loop and the job-level DITA-OT pass have their own suite
      // (`translation-review-and-strict.test.ts`); these legacy queue/review tests stay
      // deterministic and fast by turning both off at the link level.
      options: { aiReviewEnabled: false, ditaOtStrictEnabled: false, maxQaRepairRounds: 0 },
    },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { link: LinkLite }).link;
}

/** `translation_jobs` count — proves an auto-rescan never enqueues AI work. */
function jobCount(dbPath: string): number {
  return sqliteRows<{ c: number }>(dbPath, 'select count(*) as c from translation_jobs')[0]?.c ?? 0;
}

async function stateOf(app: App, linkId: string, sourcePath: string): Promise<string | undefined> {
  return (await fileStates(app, linkId)).find((file) => file.sourcePath === sourcePath)?.status;
}

async function scanLink(app: App, linkId: string): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/translation/links/${linkId}/scan`,
    headers: WRITER_A,
  });
  expect(response.statusCode).toBe(200);
}

interface JobItem {
  id: string;
  jobId: string;
  linkId: string;
  sourcePath: string;
  targetPath: string;
  status: string;
  modeUsed: string | null;
  translatorStatus?: string;
  qaErrorCount: number;
  qaWarningCount: number;
  error: string | null;
}

interface JobSnapshot {
  job: { id: string; status: string; totalItems: number };
  items: JobItem[];
}

async function runJob(app: App, linkId: string, paths: string[], mode?: 'incremental' | 'full'): Promise<JobSnapshot> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/translation/jobs',
    headers: WRITER_A,
    payload: { linkId, paths, ...(mode ? { mode } : {}) },
  });
  expect(created.statusCode).toBe(201);
  const jobId = (created.json() as JobSnapshot).job.id;
  const deadline = Date.now() + 20_000;
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
    if (Date.now() > deadline) throw new Error(`job ${jobId} stuck in ${snapshot.job.status}`);
    await sleep(20);
  }
}

interface ReviewPayload {
  item: JobItem;
  sourcePath: string;
  targetPath: string;
  sourceXml: string;
  targetBaselineXml: string | null;
  proposedXml: string;
  segments: Array<{
    segmentId: string;
    elementTag: string;
    changeKind: string;
    attributeName?: string | null;
    proposedTargetXml: string | null;
    proposedTargetText: string | null;
    qaIssues: Array<{ code: string }>;
    glossaryHits: Array<{ sourceTerm: string; targetTerm: string }>;
  }>;
  glossary: Array<{ sourceTerm: string; targetTerm: string }>;
  qaReport: { issues: Array<{ code: string }>; errorCount: number; warningCount: number; checkedSegments: number };
  lock: { userId: string; userName: string; isMine: boolean } | null;
  canReview: boolean;
  siblings?: Array<{
    itemId: string;
    jobId: string;
    sourcePath: string;
    targetPath: string;
    status: string;
    qaErrorCount: number;
    qaWarningCount: number;
  }>;
}

async function getReview(app: App, itemId: string, headers = WRITER_A): Promise<ReviewPayload> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/translation/items/${itemId}/review`,
    headers,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as ReviewPayload;
}

async function applyDraft(app: App, itemId: string, headers = WRITER_A) {
  return await app.inject({
    method: 'POST',
    url: `/api/translation/items/${itemId}/apply-draft`,
    headers,
  });
}

async function fileStates(app: App, linkId: string, headers: Record<string, string> = ADMIN) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/translation/links/${linkId}/files`,
    headers,
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as {
    files: Array<{
      sourcePath: string;
      targetPath: string;
      status: string;
      draftOwner?: { userId: string; userName: string; isMine: boolean } | null;
    }>;
  }).files;
}

let cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
  cleanup = [];
});

function boot(factory: AiModelFactory) {
  const fixture = makeFixture();
  const app = createApp(fixture, factory);
  cleanup.push(async () => {
    await app.close();
    rmSync(fixture.root, { recursive: true, force: true });
  });
  return { fixture, app };
}

function targetHeaders(link: LinkLite) {
  return {
    ...WRITER_A,
    'x-dita-manual-id': link.targetManualId,
    'x-dita-branch': link.targetBranch,
  };
}

/* -------------------------------------------------------------------------- */
/* Review                                                                      */
/* -------------------------------------------------------------------------- */

describe('bilingual review — payload, edits and refinement', () => {
  it('serves a review payload, re-assembles manual segment edits and re-runs QA', async () => {
    const model = translationModel();
    const { app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');

    const payload = await getReview(app, item.id);
    expect(payload.item.status).toBe('in_review');
    expect(payload.sourcePath).toBe(TASK);
    expect(payload.targetPath).toBe(TASK);
    expect(payload.sourceXml).toContain('Install the product');
    expect(payload.targetBaselineXml).toBeNull();
    expect(payload.segments.length).toBeGreaterThanOrEqual(1);
    expect(payload.proposedXml).toContain('译文：');
    expect(payload.qaReport.checkedSegments).toBeGreaterThan(0);
    expect(payload.lock).toBeNull();
    expect(payload.canReview).toBe(true);

    // The reviewer replaces one block; the assembled XML must contain it verbatim.
    const target = payload.segments.find((segment) => segment.elementTag === 'cmd') ?? payload.segments[0]!;
    const edit = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: {
        segments: [{ segmentId: target.segmentId, proposedTargetXml: '<cmd>人工修订的命令。</cmd>' }],
      },
    });
    expect(edit.statusCode).toBe(200);
    const edited = edit.json() as ReviewPayload;
    expect(edited.proposedXml).toContain('人工修订的命令。');
    expect(edited.qaReport.checkedSegments).toBeGreaterThan(0);
    expect(edited.segments.find((segment) => segment.segmentId === target.segmentId)?.proposedTargetText).toContain(
      '人工修订的命令。',
    );
    expect(edited.item.status).toBe('in_review');

    // Unknown segment ids are rejected instead of silently ignored.
    const unknown = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: { segments: [{ segmentId: 'nope/nope[0]', proposedTargetXml: '<cmd>x</cmd>' }] },
    });
    expect(unknown.statusCode).toBe(400);

    // A whole-file edit is validated (well-formedness + ProseMirror) and re-aligned.
    const broken = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: { proposedXml: '<task id="task-install"><title>未闭合</title>' },
    });
    expect(broken.statusCode).toBe(400);

    const wholeFile = (edited.proposedXml ?? '').replace('人工修订的命令。', '整文件替换的命令。');
    const replaced = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: { proposedXml: wholeFile },
    });
    expect(replaced.statusCode).toBe(200);
    const replacedPayload = replaced.json() as ReviewPayload;
    expect(replacedPayload.proposedXml).toContain('整文件替换的命令。');
    expect(replacedPayload.segments.length).toBe(edited.segments.length);

    // Viewers can read the payload but never mutate it.
    const viewerRead = await getReview(app, item.id, VIEWER);
    expect(viewerRead.canReview).toBe(false);
    const viewerWrite = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: VIEWER,
      payload: { segments: [{ segmentId: target.segmentId, proposedTargetXml: '<cmd>x</cmd>' }] },
    });
    expect(viewerWrite.statusCode).toBe(403);
  }, 40_000);

  it('refines a single segment on reviewer instruction and records translate_refine usage', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const item = snapshot.items[0]!;
    const payload = await getReview(app, item.id);
    const target = payload.segments.find((segment) => segment.elementTag === 'cmd') ?? payload.segments[0]!;

    const response = await app.inject({
      method: 'POST',
      url: `/api/translation/items/${item.id}/ai-refine`,
      headers: WRITER_A,
      payload: {
        segmentId: target.segmentId,
        instruction: '更正式的技术文档语气',
        currentTargetXml: target.proposedTargetXml,
      },
    });
    expect(response.statusCode).toBe(200);
    const refined = response.json() as {
      segmentId: string;
      proposedTargetXml: string;
      proposedTargetText: string;
      qaIssues: Array<{ code: string }>;
    };
    expect(refined.segmentId).toBe(target.segmentId);
    expect(refined.proposedTargetXml.length).toBeGreaterThan(0);
    // The refinement prompt carried the reviewer instruction and the current translation.
    expect(model.prompts.at(-1)).toContain('更正式的技术文档语气');
    expect(model.prompts.at(-1)).toContain('Reviewer instruction (must be followed)');

    const usage = sqliteRows<{ task_type: string; sub_action: string; status: string; file_path: string }>(
      fixture.dbPath,
      'select task_type, sub_action, status, file_path from ai_usage_logs order by rowid',
    );
    expect(usage.filter((row) => row.task_type === 'translate_refine')).toHaveLength(1);
    const refineRow = usage.find((row) => row.task_type === 'translate_refine')!;
    expect(refineRow.sub_action).toBe('refine');
    expect(refineRow.status).toBe('succeeded');
    expect(refineRow.file_path).toBe(TASK);

    // Viewers cannot refine.
    const viewer = await app.inject({
      method: 'POST',
      url: `/api/translation/items/${item.id}/ai-refine`,
      headers: VIEWER,
      payload: { segmentId: target.segmentId, instruction: 'x' },
    });
    expect(viewer.statusCode).toBe(403);
  }, 40_000);

  it('exposes glossary hits and live QA issues in the review payload', async () => {
    const model = translationModel('忽略术语');
    const { app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

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
        translations: [{ targetLang: 'zh-CN', targetTerm: '安装程序', forbiddenTargets: ['安装包'] }],
      },
    });

    const snapshot = await runJob(app, link.id, [TASK]);
    const payload = await getReview(app, snapshot.items[0]!.id);
    expect(payload.glossary.some((entry) => entry.sourceTerm === 'installer')).toBe(true);
    const withHit = payload.segments.find((segment) => segment.glossaryHits.length > 0);
    expect(withHit).toBeDefined();
    expect(withHit!.glossaryHits[0]!.targetTerm).toBe('安装程序');
    const codes = payload.qaReport.issues.map((issue) => issue.code);
    expect(codes).toContain('missing_glossary_term');
    expect(withHit!.qaIssues.length).toBeGreaterThan(0);
  }, 40_000);

  it('translates map navtitle/title attributes and saves an attribute edit cleanly', async () => {
    const model = translationModel();
    const { app } = boot(model.factory);
    const source = await createSourceManual(app, [{ path: DETAIL_MAP, content: detailMap() }]);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [DETAIL_MAP]);
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');
    // Attribute segments are announced to the model, so it can answer with plain text.
    expect(model.prompts.some((prompt) => prompt.includes('attr="navtitle"'))).toBe(true);

    const payload = await getReview(app, item.id);
    expect(
      payload.segments
        .filter((segment) => segment.attributeName)
        .map((segment) => [segment.elementTag, segment.attributeName]),
    ).toEqual([
      ['map', 'title'],
      ['topichead', 'navtitle'],
      ['topicref', 'navtitle'],
      ['topicref', 'navtitle'],
      ['mapref', 'navtitle'],
    ]);

    const xml = payload.proposedXml;
    expect(xml).toContain('<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">');
    expect(xml).toContain('<!-- navigation labels live in navtitle attributes -->');
    expect(xml).toContain('<map id="guide-map" title="译文：Product Guide" xml:lang="zh-CN">');
    expect(xml).toContain('<topichead navtitle="译文：Getting started">');
    expect(xml).toContain('<mapref href="maps/reference.ditamap" format="ditamap" navtitle="译文：Reference"/>');
    // `href`/`type`/`format`/`rev` keep their source values and their exact order.
    expect(xml).toContain(
      `<topicref href="${TASK}" type="task" format="dita" navtitle="译文：Install &amp; configure" rev="1.2"/>`,
    );
    expect(xml).not.toContain('navtitle="Getting started"');
    expect(xml).not.toContain('navtitle="Reference"');

    // A reviewer edit updates the attribute in place — no stray child element, order intact.
    const edit = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: {
        segments: [
          {
            segmentId: 'map[0]/topichead[0]/@navtitle',
            proposedTargetXml: '入门 &amp; 安装',
          },
        ],
      },
    });
    expect(edit.statusCode).toBe(200);
    const edited = edit.json() as ReviewPayload;
    expect(edited.proposedXml).toContain('<topichead navtitle="入门 &amp; 安装">');
    expect(edited.proposedXml).not.toContain('<navtitle>');
    const editedSegment = edited.segments.find(
      (segment) => segment.segmentId === 'map[0]/topichead[0]/@navtitle',
    );
    expect(editedSegment?.attributeName).toBe('navtitle');
    expect(editedSegment?.proposedTargetText).toBe('入门 & 安装');
    expect(edited.proposedXml).toContain(
      `<topicref href="${TASK}" type="task" format="dita" navtitle="译文：Install &amp; configure" rev="1.2"/>`,
    );

    // A whole-file map save is accepted (maps skip the ProseMirror probe) and re-aligns attributes.
    const wholeFile = (edited.proposedXml ?? '').replace(
      'navtitle="译文：Reference"',
      'navtitle="整文件参考"',
    );
    const replaced = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: { proposedXml: wholeFile },
    });
    expect(replaced.statusCode).toBe(200);
    const replacedPayload = replaced.json() as ReviewPayload;
    expect(replacedPayload.proposedXml).toContain('navtitle="整文件参考"');
    expect(
      replacedPayload.segments.find((segment) => segment.segmentId === 'map[0]/mapref[0]/@navtitle')
        ?.proposedTargetText,
    ).toBe('整文件参考');
    expect(replacedPayload.segments.length).toBe(edited.segments.length);
  }, 40_000);
});

/* -------------------------------------------------------------------------- */
/* Phase 13 overlay bridge                                                     */
/* -------------------------------------------------------------------------- */

describe('apply-draft — Phase 13 overlay and target check-in watermarks', () => {
  it('writes only the caller draft, keeps the shared workDir clean and 409s a foreign lock', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const item = snapshot.items[0]!;

    const applied = await applyDraft(app, item.id);
    expect(applied.statusCode).toBe(200);
    const body = applied.json() as {
      item: JobItem;
      draft: { filePath: string; op: string; baseCommit: string | null; updatedAt: string };
      lock: { userId: string; isMine: boolean };
    };
    expect(body.item.status).toBe('approved_draft');
    expect(body.draft.filePath).toBe(TASK);
    expect(body.draft.op).toBe('create');
    expect(body.lock.userId).toBe('u-writer-lin');
    expect(body.lock.isMine).toBe(true);

    // Phase 13 invariant: the shared target worktree never sees the proposal.
    const targetRoot = link.targetManual.rootDir;
    expect(porcelain(targetRoot)).toBe('');
    expect(existsSync(path.join(targetRoot, TASK))).toBe(false);
    const drafts = sqliteRows<{ file_path: string; op: string; user_id: string }>(
      fixture.dbPath,
      'select file_path, op, user_id from working_drafts',
    );
    expect(drafts).toEqual([{ file_path: TASK, op: 'create', user_id: 'u-writer-lin' }]);

    // Another writer cannot steal the target lock.
    const foreign = await applyDraft(app, item.id, WRITER_B);
    expect(foreign.statusCode).toBe(409);
    const foreignBody = foreign.json() as { error: string; lock?: { userId: string } };
    expect(foreignBody.error.length).toBeGreaterThan(0);
    if (foreignBody.lock) expect(foreignBody.lock.userId).toBe('u-writer-lin');

    // File state already says "draft ready".
    const ready = await fileStates(app, link.id);
    expect(ready.find((file) => file.sourcePath === TASK)?.status).toBe('draft_ready');

    // A regular Phase 13 check-in on the target manual advances every watermark.
    const checkin = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: targetHeaders(link),
      payload: { paths: [TASK], message: '翻译：安装任务' },
    });
    expect(checkin.statusCode).toBe(200);
    const commit = (checkin.json() as { commit: { hash: string } }).commit;
    expect(commit.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(porcelain(targetRoot)).toBe('');
    expect(existsSync(path.join(targetRoot, TASK))).toBe(true);
    expect(git(targetRoot, 'log -1 --pretty=%s')).toBe('翻译：安装任务');

    const after = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs/${snapshot.job.id}`,
      headers: WRITER_A,
    });
    expect((after.json() as JobSnapshot).items[0]!.status).toBe('checked_in');

    const synced = await fileStates(app, link.id);
    expect(synced.find((file) => file.sourcePath === TASK)?.status).toBe('synced');
    const state = sqliteRows<{
      last_source_commit: string | null;
      last_target_commit: string | null;
      last_source_blob_hash: string | null;
      last_target_blob_hash: string | null;
      renamed_from_path: string | null;
    }>(fixture.dbPath, 'select * from translation_file_states where source_path = ?', [TASK]);
    expect(state).toHaveLength(1);
    expect(state[0]!.last_source_commit).toMatch(/^[0-9a-f]{40}$/);
    expect(state[0]!.last_target_commit).toBe(commit.hash);
    expect(state[0]!.last_source_blob_hash).not.toBeNull();
    expect(state[0]!.last_target_blob_hash).not.toBeNull();
    expect(state[0]!.renamed_from_path).toBeNull();
  }, 60_000);

  it('moves the file state back to in_review when the proposal is edited after it landed in the draft', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const item = snapshot.items[0]!;

    const applied = await applyDraft(app, item.id);
    expect(applied.statusCode).toBe(200);

    // Applying the proposal is what puts the file into `draft_ready`…
    const ready = await fileStates(app, link.id);
    expect(ready.find((file) => file.sourcePath === TASK)?.status).toBe('draft_ready');

    // …but a later reviewer edit means the target draft is stale again, so the file is back in review.
    const review = await getReview(app, item.id);
    const edited = await app.inject({
      method: 'PUT',
      url: `/api/translation/items/${item.id}/review`,
      headers: WRITER_A,
      payload: {
        proposedXml: (review.proposedXml ?? '').replace(
          '译文：Install the product',
          '译文：安装本产品',
        ),
      },
    });
    expect(edited.statusCode).toBe(200);
    expect((edited.json() as ReviewPayload).item.status).toBe('in_review');

    const again = await fileStates(app, link.id);
    expect(again.find((file) => file.sourcePath === TASK)?.status).toBe('in_review');
    const state = sqliteRows<{ status: string; updated_at: number }>(
      fixture.dbPath,
      'select status, updated_at from translation_file_states where source_path = ?',
      [TASK],
    );
    expect(state).toHaveLength(1);
    expect(state[0]!.status).toBe('in_review');

    // The caller draft is untouched by the edit: only the proposal changed.
    expect(porcelain(link.targetManual.rootDir)).toBe('');
  }, 60_000);

  it('edits an existing target topic instead of creating it', async () => {
    const model = translationModel();
    const { app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    // Seed an existing (untranslated copy of the) target topic, then translate incrementally.
    const targetRoot = link.targetManual.rootDir;
    mkdirSync(path.join(targetRoot, path.dirname(TASK)), { recursive: true });
    writeFileSync(path.join(targetRoot, TASK), TASK_TARGET_V0, 'utf8');
    commitAll(targetRoot, 'seed target topic');
    await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/mark-synced`,
      headers: WRITER_A,
      payload: { paths: [TASK] },
    });
    writeFileSync(
      path.join(source.rootDir, TASK),
      TASK_SOURCE.replace('Download the installer package.', 'Download the signed installer package.'),
      'utf8',
    );
    commitAll(source.rootDir, 'clarify download step');

    const snapshot = await runJob(app, link.id, [TASK], 'incremental');
    const item = snapshot.items[0]!;
    expect(item.modeUsed).toBe('incremental');

    const applied = await applyDraft(app, item.id);
    expect(applied.statusCode).toBe(200);
    const body = applied.json() as { draft: { op: string } };
    expect(body.draft.op).toBe('edit');
    expect(porcelain(targetRoot)).toBe('');
  }, 60_000);

  it('commits several approved drafts in one batch check-in and syncs the watermarks', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK, CONCEPT]);
    expect(snapshot.items).toHaveLength(2);

    for (const item of snapshot.items) {
      const applied = await applyDraft(app, item.id);
      expect(applied.statusCode).toBe(200);
    }

    const batch = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { message: '翻译：批量提交' },
    });
    expect(batch.statusCode).toBe(200);
    const result = batch.json() as {
      commit: { hash: string; shortHash: string; message: string; author: string; date: string };
      checkedInPaths: string[];
      syncedFiles: string[];
    };
    expect(result.commit.message).toBe('翻译：批量提交');
    expect(result.commit.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(result.commit.shortHash.length).toBeGreaterThanOrEqual(7);
    expect(result.checkedInPaths.sort()).toEqual([CONCEPT, TASK].sort());
    expect(result.syncedFiles.sort()).toEqual([CONCEPT, TASK].sort());

    const targetRoot = link.targetManual.rootDir;
    expect(porcelain(targetRoot)).toBe('');
    expect(git(targetRoot, 'log -1 --pretty=%s')).toBe('翻译：批量提交');
    expect(sqliteRows(fixture.dbPath, 'select * from working_drafts')).toHaveLength(0);

    const after = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs/${snapshot.job.id}`,
      headers: WRITER_A,
    });
    expect((after.json() as JobSnapshot).items.map((item) => item.status)).toEqual(['checked_in', 'checked_in']);

    const states = await fileStates(app, link.id);
    expect(states.find((file) => file.sourcePath === TASK)?.status).toBe('synced');
    expect(states.find((file) => file.sourcePath === CONCEPT)?.status).toBe('synced');

    // Nothing left to commit once every draft landed.
    const again = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { message: '翻译：批量提交' },
    });
    expect(again.statusCode).toBe(400);

    // Viewers and foreign writers can never batch-commit.
    const viewer = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: VIEWER,
      payload: { message: 'x' },
    });
    expect(viewer.statusCode).toBe(403);
  }, 60_000);

  it('rejects viewers on apply-draft and batch check-in', async () => {
    const model = translationModel();
    const { app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const item = snapshot.items[0]!;

    const viewerApply = await applyDraft(app, item.id, VIEWER);
    expect(viewerApply.statusCode).toBe(403);

    const viewerBatch = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: VIEWER,
      payload: { message: 'x' },
    });
    expect(viewerBatch.statusCode).toBe(403);
  }, 40_000);

  it('bulk-applies every reviewed proposal into the caller drafts and then batch-commits them', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app, [
      { path: CLI, content: CLI_SOURCE },
      { path: PENDING, content: PENDING_SOURCE },
    ]);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK, CONCEPT, CLI]);
    expect(snapshot.items).toHaveLength(3);
    expect(snapshot.items.every((item) => item.status === 'ready_for_review')).toBe(true);
    const cliItem = snapshot.items.find((item) => item.sourcePath === CLI)!;

    // Another writer already owns the CLI target file: the batch must skip it, never steal the lock.
    const targetRoot = link.targetManual.rootDir;
    mkdirSync(path.join(targetRoot, path.dirname(CLI)), { recursive: true });
    writeFileSync(path.join(targetRoot, CLI), CLI_SOURCE.replace('en-US', 'zh-CN'), 'utf8');
    commitAll(targetRoot, 'seed cli target topic');
    const foreignLock = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: {
        ...WRITER_B,
        'x-dita-manual-id': link.targetManualId,
        'x-dita-branch': link.targetBranch,
      },
      payload: { path: CLI },
    });
    expect(foreignLock.statusCode).toBe(200);

    const batch = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-apply-draft`,
      headers: WRITER_A,
      payload: { paths: [TASK, CONCEPT, CLI, PENDING] },
    });
    expect(batch.statusCode).toBe(200);
    const result = batch.json() as {
      applied: Array<{ itemId: string; sourcePath: string; targetPath: string }>;
      skippedLocked: Array<{ path: string; itemId: string; reason: string }>;
      skippedInvalid: Array<{ path: string; itemId: string; reason: string }>;
      skippedNoProposal: string[];
    };
    expect(result.applied.map((entry) => entry.sourcePath).sort()).toEqual([CONCEPT, TASK].sort());
    expect(result.applied.every((entry) => entry.sourcePath === entry.targetPath)).toBe(true);
    expect(result.skippedInvalid).toEqual([]);
    expect(result.skippedLocked).toHaveLength(1);
    expect(result.skippedLocked[0]!.path).toBe(CLI);
    expect(result.skippedLocked[0]!.itemId).toBe(cliItem.id);
    expect(result.skippedLocked[0]!.reason.length).toBeGreaterThan(0);
    expect(result.skippedNoProposal).toEqual([PENDING]);

    // Phase 13 invariant: only the caller overlay changed, the shared worktree stays at HEAD.
    expect(porcelain(targetRoot)).toBe('');
    expect(existsSync(path.join(targetRoot, TASK))).toBe(false);
    const drafts = sqliteRows<{ file_path: string; user_id: string; op: string }>(
      fixture.dbPath,
      'select file_path, user_id, op from working_drafts order by file_path',
    );
    expect(drafts).toEqual([
      { file_path: CONCEPT, user_id: 'u-writer-lin', op: 'create' },
      { file_path: TASK, user_id: 'u-writer-lin', op: 'create' },
    ]);
    const locks = sqliteRows<{ file_path: string; user_id: string }>(
      fixture.dbPath,
      'select file_path, user_id from file_locks where file_path = ?',
      [CLI],
    );
    expect(locks).toEqual([{ file_path: CLI, user_id: 'u-writer-chen' }]);

    const checkin = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { paths: [TASK, CONCEPT], message: '翻译：批量应用并提交' },
    });
    expect(checkin.statusCode).toBe(200);
    const committed = checkin.json() as { commit: { message: string }; checkedInPaths: string[]; syncedFiles: string[] };
    expect(committed.commit.message).toBe('翻译：批量应用并提交');
    expect(committed.checkedInPaths.sort()).toEqual([CONCEPT, TASK].sort());
    expect(committed.syncedFiles.sort()).toEqual([CONCEPT, TASK].sort());
    expect(porcelain(targetRoot)).toBe('');
    expect(existsSync(path.join(targetRoot, TASK))).toBe(true);
    expect(existsSync(path.join(targetRoot, CONCEPT))).toBe(true);
    expect(sqliteRows(fixture.dbPath, 'select * from working_drafts')).toHaveLength(0);

    const after = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs/${snapshot.job.id}`,
      headers: WRITER_A,
    });
    const statuses = new Map(
      (after.json() as JobSnapshot).items.map((item) => [item.sourcePath, item.status]),
    );
    expect(statuses.get(TASK)).toBe('checked_in');
    expect(statuses.get(CONCEPT)).toBe('checked_in');
    expect(statuses.get(CLI)).toBe('ready_for_review');
    const states = await fileStates(app, link.id);
    expect(states.find((file) => file.sourcePath === TASK)?.status).toBe('synced');
    expect(states.find((file) => file.sourcePath === CONCEPT)?.status).toBe('synced');
    expect(states.find((file) => file.sourcePath === CLI)?.status).not.toBe('synced');

    const viewer = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-apply-draft`,
      headers: VIEWER,
      payload: { paths: [TASK] },
    });
    expect(viewer.statusCode).toBe(403);
  }, 60_000);
});

/* -------------------------------------------------------------------------- */
/* No-op drafts: a re-run that changes nothing must not dead-end the batch     */
/* -------------------------------------------------------------------------- */

describe('no-op drafts — identical to the target baseline', () => {
  /**
   * Reproduces the live failure where a re-translated file was already committed to the target
   * branch, so the draft held byte-identical content and the check-in aborted with
   * `git.noCommitChanges` ("no committable changes in the selected files").
   */
  async function staleIdenticalDraft() {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const item = snapshot.items[0]!;
    expect((await applyDraft(app, item.id)).statusCode).toBe(200);

    const draftRows = sqliteRows<{ content: string | null }>(
      fixture.dbPath,
      'select content from working_drafts where file_path = ?',
      [TASK],
    );
    const content = draftRows[0]!.content!;

    // The target branch picks up the very same bytes outside the translation flow (an editor
    // commit, a merge, or a re-run of the job after the check-in already landed).
    const targetRoot = link.targetManual.rootDir;
    writeFileSync(path.join(targetRoot, TASK), content, 'utf8');
    commitAll(targetRoot, '编辑：目标文件已写入相同译文');
    expect(porcelain(targetRoot)).toBe('');

    return { fixture, app, link, item, targetRoot, content };
  }

  it('closes an identical draft as synced instead of aborting the batch check-in', async () => {
    const { fixture, app, link, item, targetRoot } = await staleIdenticalDraft();
    const headBefore = git(targetRoot, 'rev-parse HEAD');

    const checkin = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { paths: [TASK], message: '翻译：重复签入相同译文' },
    });
    expect(checkin.statusCode).toBe(200);
    const body = checkin.json() as {
      commit: { message: string } | null;
      checkedInPaths: string[];
      syncedFiles: string[];
      alreadySyncedPaths?: string[];
    };
    expect(body.commit).toBeNull();
    expect(body.checkedInPaths).toEqual([]);
    expect(body.alreadySyncedPaths).toEqual([TASK]);
    expect(body.syncedFiles).toContain(TASK);

    // Nothing was committed, the no-op draft and its lock are gone, and the state closed the loop.
    expect(git(targetRoot, 'rev-parse HEAD')).toBe(headBefore);
    expect(porcelain(targetRoot)).toBe('');
    expect(sqliteRows(fixture.dbPath, 'select * from working_drafts')).toHaveLength(0);
    expect(sqliteRows(fixture.dbPath, 'select * from file_locks')).toHaveLength(0);
    expect((await fileStates(app, link.id)).find((file) => file.sourcePath === TASK)?.status).toBe(
      'synced',
    );
    const jobs = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs/${item.jobId}`,
      headers: WRITER_A,
    });
    expect((jobs.json() as JobSnapshot).items[0]!.status).toBe('checked_in');
  }, 60_000);

  it('skips creating a draft when the proposal already matches the baseline', async () => {
    const { fixture, app, link, item } = await staleIdenticalDraft();

    const applied = await applyDraft(app, item.id);
    expect(applied.statusCode).toBe(200);
    const body = applied.json() as {
      item: JobItem;
      draft: unknown;
      alreadyApplied?: boolean;
    };
    expect(body.alreadyApplied).toBe(true);
    expect(body.draft).toBeNull();
    expect(body.item.status).toBe('checked_in');

    expect(sqliteRows(fixture.dbPath, 'select * from working_drafts')).toHaveLength(0);
    expect(sqliteRows(fixture.dbPath, 'select * from file_locks')).toHaveLength(0);
    expect((await fileStates(app, link.id)).find((file) => file.sourcePath === TASK)?.status).toBe(
      'synced',
    );
  }, 60_000);
});

/* -------------------------------------------------------------------------- */
/* Review navigation siblings (Phase 16)                                       */
/* -------------------------------------------------------------------------- */

describe('bilingual review — sibling file navigation', () => {
  it('lists every reviewable file of the link sorted by sourcePath with live QA counts', async () => {
    const model = translationModel();
    const { app } = boot(model.factory);
    const source = await createSourceManual(app, [{ path: CLI, content: CLI_SOURCE }]);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK, CONCEPT, CLI]);

    const taskItem = snapshot.items.find((entry) => entry.sourcePath === TASK)!;
    const payload = await getReview(app, taskItem.id);
    const siblings = payload.siblings ?? [];

    expect(siblings.map((sibling) => sibling.sourcePath)).toEqual([CONCEPT, CLI, TASK]);
    expect(new Set(siblings.map((sibling) => sibling.sourcePath)).size).toBe(siblings.length);
    expect(siblings.every((sibling) => sibling.targetPath === sibling.sourcePath)).toBe(true);
    expect(siblings.every((sibling) => sibling.jobId === snapshot.job.id)).toBe(true);

    const current = siblings.find((sibling) => sibling.sourcePath === TASK)!;
    expect(current.itemId).toBe(taskItem.id);
    expect(current.status).toBe('in_review');
    expect(current.qaErrorCount).toBe(payload.qaReport.errorCount);
    expect(current.qaWarningCount).toBe(payload.qaReport.warningCount);

    const concept = siblings.find((sibling) => sibling.sourcePath === CONCEPT)!;
    expect(concept.status).toBe('ready_for_review');
    expect(concept.itemId).toBe(snapshot.items.find((entry) => entry.sourcePath === CONCEPT)!.id);

    // Re-reading keeps the same order and ids, so "apply draft" never makes the position jump.
    const again = await getReview(app, taskItem.id);
    expect((again.siblings ?? []).map((sibling) => sibling.itemId)).toEqual(
      siblings.map((sibling) => sibling.itemId),
    );
  }, 60_000);

  it('keeps one entry per sourcePath (latest wins) and always includes the current item', async () => {
    const model = translationModel();
    const { app, fixture } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK, CONCEPT]);
    const taskItem = snapshot.items.find((entry) => entry.sourcePath === TASK)!;
    const conceptItem = snapshot.items.find((entry) => entry.sourcePath === CONCEPT)!;

    const legacy = 'topics/legacy-notes.dita';
    const base = { jobId: snapshot.job.id, linkId: link.id, targetPath: legacy };
    // Two historical translation runs of the same file: only the freshest row may show up.
    insertItemRow(fixture.dbPath, {
      ...base,
      id: 'item-legacy-old',
      sourcePath: legacy,
      status: 'approved_draft',
      updatedAt: 1_000,
      qaErrorCount: 1,
      qaWarningCount: 2,
    });
    insertItemRow(fixture.dbPath, {
      ...base,
      id: 'item-legacy-new',
      sourcePath: legacy,
      status: 'checked_in',
      updatedAt: 2_000,
      qaErrorCount: 3,
      qaWarningCount: 4,
    });
    // Failed items are not reviewable, so they never appear in the navigation list.
    insertItemRow(fixture.dbPath, {
      ...base,
      id: 'item-abandoned',
      sourcePath: 'topics/abandoned.dita',
      targetPath: 'topics/abandoned.dita',
      status: 'failed',
      updatedAt: 3_000,
    });
    // Stale duplicate of a real file: the newest row (the job item) must win.
    insertItemRow(fixture.dbPath, {
      ...base,
      id: 'item-concept-stale',
      sourcePath: CONCEPT,
      targetPath: CONCEPT,
      status: 'approved_draft',
      updatedAt: 4_000,
      qaErrorCount: 7,
      qaWarningCount: 8,
    });
    // Even a newer duplicate of the *current* file must not replace it: live status/QA wins.
    insertItemRow(fixture.dbPath, {
      ...base,
      id: 'item-task-stale',
      sourcePath: TASK,
      targetPath: TASK,
      status: 'checked_in',
      updatedAt: 9_999_999_999_999,
      qaErrorCount: 9,
      qaWarningCount: 9,
    });

    const payload = await getReview(app, taskItem.id);
    const siblings = payload.siblings ?? [];
    expect(siblings.map((sibling) => sibling.sourcePath)).toEqual([CONCEPT, legacy, TASK]);

    const legacyEntry = siblings.find((sibling) => sibling.sourcePath === legacy)!;
    expect(legacyEntry.itemId).toBe('item-legacy-new');
    expect(legacyEntry.status).toBe('checked_in');
    expect(legacyEntry.qaErrorCount).toBe(3);
    expect(legacyEntry.qaWarningCount).toBe(4);

    const conceptEntry = siblings.find((sibling) => sibling.sourcePath === CONCEPT)!;
    expect(conceptEntry.itemId).toBe(conceptItem.id);
    expect(conceptEntry.status).toBe('ready_for_review');

    const current = siblings.find((sibling) => sibling.sourcePath === TASK)!;
    expect(current.itemId).toBe(taskItem.id);
    expect(current.jobId).toBe(snapshot.job.id);
    expect(current.status).toBe('in_review');
    expect(current.qaErrorCount).toBe(payload.qaReport.errorCount);
    expect(current.qaWarningCount).toBe(payload.qaReport.warningCount);

    expect(siblings.some((sibling) => sibling.itemId === 'item-abandoned')).toBe(false);
  }, 60_000);
});

/* -------------------------------------------------------------------------- */
/* Phase 16 — draft_ready files without any translation item                   */
/* -------------------------------------------------------------------------- */

describe('bilingual review — Phase 16 non-item drafts', () => {
  it('batch-checks-in a synced asset from its draft_ready state alone', async () => {
    const IMAGE = 'images/diagram.png';
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app, [{ path: IMAGE, content: 'fake-png-bytes' }]);
    const link = await createLink(app, source.id);
    const targetRoot = link.targetManual.rootDir;

    // The target skeleton copied the first image, so a source update makes the pair `outdated`.
    writeFileSync(path.join(source.rootDir, IMAGE), 'updated-png-bytes', 'utf8');
    commitAll(source.rootDir, 'docs: refresh diagram');
    const rescanned = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/scan`,
      headers: WRITER_A,
    });
    expect(rescanned.statusCode).toBe(200);
    expect((await fileStates(app, link.id)).find((file) => file.sourcePath === IMAGE)?.status).toBe(
      'outdated',
    );

    const synced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_A,
      payload: { paths: [IMAGE] },
    });
    expect(synced.statusCode).toBe(200);
    expect((await fileStates(app, link.id)).find((file) => file.sourcePath === IMAGE)?.status).toBe(
      'draft_ready',
    );

    // No `translation_items` row exists at all: `batchCheckin` must still pick the state up.
    const checkin = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { message: '翻译：同步插图' },
    });
    expect(checkin.statusCode).toBe(200);
    const committed = checkin.json() as { checkedInPaths: string[]; syncedFiles: string[] };
    expect(committed.checkedInPaths).toEqual([IMAGE]);
    expect(committed.syncedFiles).toContain(IMAGE);
    expect(existsSync(path.join(targetRoot, IMAGE))).toBe(true);
    expect(porcelain(targetRoot)).toBe('');
    expect(sqliteRows<{ file_path: string }>(fixture.dbPath, 'select file_path from working_drafts')).toEqual(
      [],
    );
    expect((await fileStates(app, link.id)).find((file) => file.sourcePath === IMAGE)?.status).toBe(
      'synced',
    );
  }, 60_000);
});

/* -------------------------------------------------------------------------- */
/* Draft ownership visibility (Phase 16)                                       */
/* -------------------------------------------------------------------------- */

describe('draft ownership — who may check a personal draft in', () => {
  it('reports the draft owner per file and marks it as mine only for the owner', async () => {
    const model = translationModel();
    const { app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK, CONCEPT]);
    const taskItem = snapshot.items.find((item) => item.sourcePath === TASK)!;
    expect((await applyDraft(app, taskItem.id, WRITER_A)).statusCode).toBe(200);

    const mine = await fileStates(app, link.id, WRITER_A);
    const ownTask = mine.find((file) => file.sourcePath === TASK);
    expect(ownTask?.status).toBe('draft_ready');
    expect(ownTask?.draftOwner).toEqual({ userId: 'u-writer-lin', userName: '林知远', isMine: true });
    // A file without any draft in the target branch never reports an owner.
    expect(mine.find((file) => file.sourcePath === CONCEPT)?.draftOwner).toBeNull();

    const foreign = await fileStates(app, link.id, WRITER_B);
    expect(foreign.find((file) => file.sourcePath === TASK)?.draftOwner).toEqual({
      userId: 'u-writer-lin',
      userName: '林知远',
      isMine: false,
    });
    // The admin is not the owner either, so the same draft reads as foreign to them.
    expect((await fileStates(app, link.id)).find((file) => file.sourcePath === TASK)?.draftOwner).toEqual({
      userId: 'u-writer-lin',
      userName: '林知远',
      isMine: false,
    });
  }, 60_000);

  it('rejects a batch check-in of another user\'s draft with 409 and names the owner', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);
    const snapshot = await runJob(app, link.id, [TASK]);
    const taskItem = snapshot.items.find((item) => item.sourcePath === TASK)!;
    expect((await applyDraft(app, taskItem.id, WRITER_A)).statusCode).toBe(200);

    const stolen = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_B,
      payload: { paths: [TASK], message: '翻译：抢占提交' },
    });
    expect(stolen.statusCode).toBe(409);
    const body = stolen.json() as { error: string; owners?: string; count?: number };
    expect(body.error).toContain('林知远');
    expect(body.owners).toBe('林知远');
    expect(body.count).toBe(1);

    // The refusal is non-destructive: the draft stays in the owner's overlay and the worktree is clean.
    expect(
      sqliteRows<{ file_path: string; user_id: string }>(
        fixture.dbPath,
        'select file_path, user_id from working_drafts',
      ),
    ).toEqual([{ file_path: TASK, user_id: 'u-writer-lin' }]);
    expect(porcelain(link.targetManual.rootDir)).toBe('');
    expect((await fileStates(app, link.id, WRITER_A)).find((f) => f.sourcePath === TASK)?.status).toBe(
      'draft_ready',
    );

    // The owner can still check the very same draft in.
    const owned = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { paths: [TASK], message: '翻译：本人提交' },
    });
    expect(owned.statusCode).toBe(200);
    expect((owned.json() as { checkedInPaths: string[] }).checkedInPaths).toEqual([TASK]);
    expect(
      (await fileStates(app, link.id, WRITER_A)).find((f) => f.sourcePath === TASK)?.status,
    ).toBe('synced');
  }, 60_000);
});

/* -------------------------------------------------------------------------- */
/* Phase 16: direct downstream auto-rescan on check-in                         */
/* -------------------------------------------------------------------------- */

describe('Phase 16 multi-level lineage — check-in auto-rescan', () => {
  it('editor check-in on the middle manual syncs the inbound link and rescans the direct child', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(app, [], 'zh-CN');
    const zhToEn = await createLink(app, source.id, 'en-US');
    const enToAr = await createLink(app, zhToEn.targetManualId, 'ar-SA');
    expect(zhToEn.sourceLang).toBe('zh-CN');
    expect(zhToEn.targetLang).toBe('en-US');
    expect(enToAr.sourceLang).toBe('en-US');
    expect(enToAr.targetLang).toBe('ar-SA');
    expect(await stateOf(app, zhToEn.id, ROOT_MAP)).toBe('synced');
    expect(await stateOf(app, enToAr.id, ROOT_MAP)).toBe('synced');
    const jobsBefore = jobCount(fixture.dbPath);

    // A translator edits the middle (en-US) manual through the Phase 13 lock/draft flow.
    const checkout = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: targetHeaders(zhToEn),
      payload: { path: ROOT_MAP },
    });
    expect(checkout.statusCode).toBe(200);
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: targetHeaders(zhToEn),
      payload: {
        path: ROOT_MAP,
        content: rootMap('en-US').replace(
          '<title>Product Manual</title>',
          '<title>Product Manual EN</title>',
        ),
      },
    });
    expect(saved.statusCode).toBe(200);
    const checkin = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: targetHeaders(zhToEn),
      payload: { paths: [ROOT_MAP], message: '翻译：更新英文手册标题' },
    });
    expect(checkin.statusCode).toBe(200);
    const commit = (checkin.json() as { commit: { hash: string } }).commit;
    expect(porcelain(zhToEn.targetManual.rootDir)).toBe('');

    // Inbound link (zh-CN -> en-US) advanced its watermark …
    expect(await stateOf(app, zhToEn.id, ROOT_MAP)).toBe('synced');
    const state = sqliteRows<{ last_target_commit: string | null }>(
      fixture.dbPath,
      'select last_target_commit from translation_file_states where link_id = ? and source_path = ?',
      [zhToEn.id, ROOT_MAP],
    );
    expect(state[0]?.last_target_commit).toBe(commit.hash);

    // … and the direct child (en-US -> ar-SA) was rescanned because en-US changed.
    expect(await stateOf(app, enToAr.id, ROOT_MAP)).toBe('outdated');

    // Auto-rescan is metadata-only: no AI job, no model call.
    expect(jobCount(fixture.dbPath)).toBe(jobsBefore);
    expect(model.prompts).toHaveLength(0);
  }, 60_000);

  it('batch check-in on the middle manual advances the inbound link and rescans the direct child', async () => {
    const model = translationModel();
    const { fixture, app } = boot(model.factory);
    const source = await createSourceManual(
      app,
      [{ path: ASSET, content: PNG_BASE64, encoding: 'base64' }],
      'zh-CN',
    );
    const zhToEn = await createLink(app, source.id, 'en-US');
    const enToAr = await createLink(app, zhToEn.targetManualId, 'ar-SA');
    expect(await stateOf(app, zhToEn.id, ASSET)).toBe('synced');
    expect(await stateOf(app, enToAr.id, ASSET)).toBe('synced');
    const jobsBefore = jobCount(fixture.dbPath);

    // The screenshot changes upstream; the middle manual takes the new bytes via sync-assets.
    writeFileSync(path.join(source.rootDir, ASSET), Buffer.from('fresh-screenshot-bytes', 'utf8'));
    commitAll(source.rootDir, 'docs: refresh diagram');
    await scanLink(app, zhToEn.id);
    expect(await stateOf(app, zhToEn.id, ASSET)).toBe('outdated');
    const synced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${zhToEn.id}/sync-assets`,
      headers: WRITER_A,
      payload: { paths: [ASSET] },
    });
    expect(synced.statusCode).toBe(200);
    expect(await stateOf(app, zhToEn.id, ASSET)).toBe('draft_ready');

    // The batch check-in commits into en-US, which is both a target and a source of the family.
    const checkin = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${zhToEn.id}/batch-checkin`,
      headers: WRITER_A,
      payload: { paths: [ASSET], message: '翻译：同步图片' },
    });
    expect(checkin.statusCode).toBe(200);
    expect((checkin.json() as { checkedInPaths: string[] }).checkedInPaths).toEqual([ASSET]);
    expect(porcelain(zhToEn.targetManual.rootDir)).toBe('');

    expect(await stateOf(app, zhToEn.id, ASSET)).toBe('synced');
    // The child edition (ar-SA) is now behind its own source (en-US).
    expect(await stateOf(app, enToAr.id, ASSET)).toBe('outdated');
    expect(jobCount(fixture.dbPath)).toBe(jobsBefore);
    expect(model.prompts).toHaveLength(0);

    // A leaf check-in advances only its own inbound link; nothing has to rescan upstream.
    const leafHeaders = {
      ...WRITER_A,
      'x-dita-manual-id': enToAr.targetManualId,
      'x-dita-branch': enToAr.targetBranch,
    };
    const leafCheckout = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: leafHeaders,
      payload: { path: ROOT_MAP },
    });
    expect(leafCheckout.statusCode).toBe(200);
    const leafSaved = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: leafHeaders,
      payload: {
        path: ROOT_MAP,
        content: rootMap('ar-SA').replace(
          '<title>Product Manual</title>',
          '<title>دليل المنتج</title>',
        ),
      },
    });
    expect(leafSaved.statusCode).toBe(200);
    const leafCheckin = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: leafHeaders,
      payload: { paths: [ROOT_MAP], message: 'ترجمة: تحديث العنوان' },
    });
    expect(leafCheckin.statusCode).toBe(200);
    const leafCommit = (leafCheckin.json() as { commit: { hash: string } }).commit;

    expect(await stateOf(app, enToAr.id, ROOT_MAP)).toBe('synced');
    const watermarks = sqliteRows<{ link_id: string; last_target_commit: string | null }>(
      fixture.dbPath,
      'select link_id, last_target_commit from translation_file_states where source_path = ? order by link_id',
      [ROOT_MAP],
    );
    expect(watermarks.find((row) => row.link_id === enToAr.id)?.last_target_commit).toBe(
      leafCommit.hash,
    );
    expect(watermarks.find((row) => row.link_id === zhToEn.id)?.last_target_commit).not.toBe(
      leafCommit.hash,
    );
    // The leaf is behind on the asset only; the leaf check-in created no AI work.
    expect(await stateOf(app, enToAr.id, ASSET)).toBe('outdated');
    expect(jobCount(fixture.dbPath)).toBe(jobsBefore);
    expect(model.prompts).toHaveLength(0);
  }, 60_000);
});
