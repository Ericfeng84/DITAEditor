import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessage } from '@langchain/core/messages';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';
import type { ResolvedAiConfig } from '../src/modules/ai/ai-settings-service.js';
import type {
  StrictValidationInput,
  StrictValidationResult,
} from '../src/modules/validate/strict-validator.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };

const ROOT_MAP = 'product-manual.ditamap';
const TASK = 'topics/task-install.dita';
const CONCEPT = 'topics/concept-overview.dita';

const TASK_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD Task//EN" "task.dtd">
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
<!DOCTYPE concept PUBLIC "-//OASIS//DTD Concept//EN" "concept.dtd">
<concept id="concept-overview" xml:lang="en-US">
  <title>Product overview</title>
  <conbody>
    <p>The product ships with a guided installer.</p>
  </conbody>
</concept>
`;

const TASK_TARGET = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD Task//EN" "task.dtd">
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

function rootMap(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="product-manual" xml:lang="en-US">
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-translation-phase16-'));
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
  strictValidator?: typeof import('../src/modules/validate/strict-validator.js').validateStrict;
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
    translationConcurrency: 1,
    ...(options.aiModelFactory ? { aiModelFactory: options.aiModelFactory } : {}),
    ...(options.strictValidator ? { translationStrictValidator: options.strictValidator } : {}),
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

/** `<tsegment id="…">` ids of a translate/repair prompt. */
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

const isReviewPrompt = (prompt: string): boolean => prompt.includes('<reviewsegments>');
const isSegmentRepairPrompt = (prompt: string): boolean => prompt.includes('Blocks to repair');
const isDitaOtRepairPrompt = (prompt: string): boolean =>
  prompt.includes('DITA-OT strict validation diagnostics to fix');

interface ScriptedModel {
  prompts: string[];
  /** Prompts that are not reviewer-AI calls. */
  translationPrompts: () => string[];
  factory: AiModelFactory;
}

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
  return {
    prompts,
    translationPrompts: () => prompts.filter((prompt) => !isReviewPrompt(prompt)),
    factory,
  };
}

/** Default reply: one well-formed `<tblock>` per requested segment. */
function replyAll(
  prompt: string,
  translate: (segmentId: string, sourceXml: string) => string,
): string {
  return segmentIds(prompt)
    .map((id) => `<tblock id="${id}">${translate(id, currentSource(prompt, id))}</tblock>`)
    .join('\n');
}

/** Reviewer reply with no findings. */
const PASS_REVIEW = JSON.stringify({ verdict: 'pass', summary: 'No issues.', issues: [] });

/** Reviewer reply flagging the one reviewed block whose target uses a forbidden term. */
function reviewReply(prompt: string, forbidden: string): string {
  const blocks = [
    ...prompt.matchAll(/<rsegment id="([^"]+)"[^>]*>([\s\S]*?)<\/rsegment>/g),
  ];
  const bad = blocks.find((match) => {
    const target = /<target>([\s\S]*?)<\/target>/.exec(match[2] ?? '')?.[1] ?? '';
    return target.includes(forbidden);
  });
  if (!bad) return JSON.stringify({ verdict: 'pass', summary: 'No issues.', issues: [] });
  return JSON.stringify({
    verdict: 'revise',
    summary: 'The forbidden glossary rendering must be fixed.',
    issues: [
      {
        segmentId: bad[1],
        severity: 'error',
        category: 'terminology',
        message: `Forbidden rendering "${forbidden}" is used.`,
        suggestion: 'Use the approved glossary term.',
      },
    ],
  });
}

/** A DITA-OT repair reply: the current document with a recognizable marker injected. */
function documentRepairReply(prompt: string, marker?: string): string {
  const current = /<current_document>([\s\S]*?)<\/current_document>/.exec(prompt)?.[1] ?? '';
  const trimmed = current.trim();
  if (!marker) return trimmed;
  return trimmed.replace('</taskbody>', `  <!-- ${marker} -->\n  </taskbody>`);
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

interface LinkOptionsInput {
  aiReviewEnabled?: boolean;
  ditaOtStrictEnabled?: boolean;
  maxQaRepairRounds?: number;
  qaStrict?: boolean;
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
        { path: TASK, content: TASK_SOURCE },
        { path: CONCEPT, content: CONCEPT_SOURCE },
      ],
    },
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { manual: ManualLite }).manual;
}

async function createLink(
  app: App,
  sourceManualId: string,
  options: LinkOptionsInput = {},
): Promise<LinkLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/translation/links',
    headers: WRITER,
    payload: { sourceManualId, targetLang: 'zh-CN', options },
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { link: LinkLite }).link;
}

async function markSynced(app: App, linkId: string, paths: string[]): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/translation/links/${linkId}/mark-synced`,
    headers: WRITER,
    payload: { paths },
  });
  expect(response.statusCode).toBe(200);
}

async function addGlossary(app: App): Promise<void> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/glossaries',
    headers: ADMIN,
    payload: { scope: 'global', name: 'UI terms', sourceLang: 'en-US' },
  });
  expect(created.statusCode).toBe(201);
  const glossaryId = (created.json() as { glossary: { id: string } }).glossary.id;
  const term = await app.inject({
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
  expect(term.statusCode).toBe(201);
}

async function enqueue(app: App, linkId: string, paths: string[]) {
  return await app.inject({
    method: 'POST',
    url: '/api/translation/jobs',
    headers: WRITER,
    payload: { linkId, paths, mode: 'incremental' },
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
  aiReviewVerdict: string | null;
  aiReviewErrorCount: number;
  aiReviewWarningCount: number;
  qaRepairedCount: number;
  ditaOtStatus: string | null;
  ditaOtErrorCount: number;
  ditaOtWarningCount: number;
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
    validationReport: {
      status: string;
      checkedFiles: number;
      errorFiles: number;
      repairedFiles: number;
      remainingErrorFiles: number;
      reason?: string;
    } | null;
  };
  items: JobItem[];
}

interface ReviewPayload {
  item: JobItem;
  proposedXml: string;
  qaReport: { issues: Array<{ code: string; segmentId?: string | null }>; errorCount: number; warningCount: number };
  aiReview: {
    verdict: string;
    summary: string;
    reviewRounds: number;
    qaRepairRounds: number;
    repairedSegments: number;
    initialQaErrors: number;
    remainingQaErrors: number;
    issues: Array<{ segmentId: string; severity: string; category: string }>;
    stale?: boolean;
  } | null;
  ditaOtReport: {
    status: string;
    repaired: boolean;
    errorCount: number;
    diagnostics: Array<{ severity: string; code?: string; message: string }>;
    stale?: boolean;
  } | null;
  segments: Array<{ segmentId: string; proposedTargetXml: string | null }>;
}

async function awaitJob(app: App, jobId: string, timeoutMs = 30_000): Promise<JobSnapshot> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/translation/jobs/${jobId}`,
      headers: WRITER,
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

async function review(app: App, itemId: string): Promise<ReviewPayload> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/translation/items/${itemId}/review`,
    headers: WRITER,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as ReviewPayload;
}

let cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
  cleanup = [];
});

function boot(options: AppOptions = {}) {
  const fixture = makeFixture();
  const app = createApp(fixture, options);
  cleanup.push(async () => {
    await app.close();
    rmSync(fixture.root, { recursive: true, force: true });
  });
  return { fixture, app };
}

/* -------------------------------------------------------------------------- */
/* Scripted DITA-OT                                                            */
/* -------------------------------------------------------------------------- */

type StrictHandler = (input: StrictValidationInput) => StrictValidationResult | Promise<StrictValidationResult>;

interface StrictCall {
  workDir: string;
  paths: string[];
  processingMode: string;
}

function strictRuntime(): StrictValidationResult['runtime'] {
  return {
    available: true,
    command: '/opt/dita/bin/dita',
    ditaHome: '/opt/dita',
    version: '4.2.1',
    pluginInstalled: true,
    pluginPath: '/opt/dita/plugins/com.ditaeditor.pdf-cjk',
    fopConfigPath: '/opt/dita/fop.xconf',
    fontsAvailable: true,
    fontsPath: '/usr/share/fonts/noto-cjk',
    checkedAt: new Date().toISOString(),
  };
}

function strictResult(
  input: StrictValidationInput,
  diagnostics: StrictValidationResult['diagnostics'],
): StrictValidationResult {
  return {
    available: true,
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    targets: input.paths,
    diagnostics,
    durationMs: 4,
    command: 'dita --validate',
    logTail: '',
    runtime: strictRuntime(),
  };
}

function scriptedStrict(handler: StrictHandler): {
  calls: StrictCall[];
  validator: typeof import('../src/modules/validate/strict-validator.js').validateStrict;
} {
  const calls: StrictCall[] = [];
  const validator = (async (input: StrictValidationInput) => {
    calls.push({
      workDir: input.workDir,
      paths: [...input.paths],
      processingMode: input.processingMode ?? 'strict',
    });
    return await handler(input);
  }) as typeof import('../src/modules/validate/strict-validator.js').validateStrict;
  return { calls, validator };
}

/* -------------------------------------------------------------------------- */
/* 1. Reviewer AI configuration                                                */
/* -------------------------------------------------------------------------- */

interface ReviewerConfig {
  configured: boolean;
  isDedicated: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeySource: string;
  maskedApiKey: string | null;
  temperature: number;
  hasDedicatedBaseUrl: boolean;
  hasDedicatedModel: boolean;
  hasDedicatedApiKey: boolean;
  hasDedicatedTemperature: boolean;
}

interface AiConfigResponse {
  configured: boolean;
  baseUrl: string;
  model: string;
  temperature: number;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  reviewer: ReviewerConfig;
}

describe('Phase 16 — reviewer AI configuration', () => {
  it('inherits the primary model, masks a dedicated key and clears back to inherit', async () => {
    const model = scriptedModel(() => 'pong');
    const { app } = boot({ aiModelFactory: model.factory });

    const initial = await app.inject({ method: 'GET', url: '/api/ai/config', headers: ADMIN });
    expect(initial.statusCode).toBe(200);
    const before = initial.json() as AiConfigResponse;
    expect(before.reviewer.configured).toBe(false);
    expect(before.reviewer.isDedicated).toBe(false);
    expect(before.reviewer.baseUrl).toBe(before.baseUrl);
    expect(before.reviewer.model).toBe(before.model);
    // Reviewer temperature inherits `min(primary, 0.1)` — a reviewer is a colder role than a writer.
    expect(before.reviewer.temperature).toBe(0.1);

    const primary = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: ADMIN,
      payload: {
        baseUrl: 'https://api.example.com/v1',
        model: 'primary-model',
        apiKey: 'sk-primary-key-1234',
        temperature: 0.7,
      },
    });
    expect(primary.statusCode).toBe(200);
    const inherited = primary.json() as AiConfigResponse;
    expect(inherited.reviewer.isDedicated).toBe(false);
    expect(inherited.reviewer.model).toBe('primary-model');
    expect(inherited.reviewer.baseUrl).toBe('https://api.example.com/v1');
    expect(inherited.reviewer.temperature).toBe(0.1);
    expect(inherited.reviewer.hasDedicatedTemperature).toBe(false);
    expect(inherited.reviewer.apiKeySource).toBe('db');

    const dedicated = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: ADMIN,
      payload: {
        reviewer: {
          baseUrl: 'https://review.example.com/v1',
          model: 'review-model',
          apiKey: 'sk-reviewer-secret-9876',
          temperature: 0.05,
        },
      },
    });
    expect(dedicated.statusCode).toBe(200);
    const reviewer = (dedicated.json() as AiConfigResponse).reviewer;
    expect(reviewer.configured).toBe(true);
    expect(reviewer.isDedicated).toBe(true);
    expect(reviewer.model).toBe('review-model');
    expect(reviewer.baseUrl).toBe('https://review.example.com/v1');
    expect(reviewer.temperature).toBe(0.05);
    expect(reviewer.hasDedicatedBaseUrl).toBe(true);
    expect(reviewer.hasDedicatedModel).toBe(true);
    expect(reviewer.hasDedicatedApiKey).toBe(true);
    expect(reviewer.hasDedicatedTemperature).toBe(true);
    expect(reviewer.maskedApiKey).not.toBeNull();
    expect(reviewer.maskedApiKey).toContain('****');
    expect(JSON.stringify(dedicated.json())).not.toContain('sk-reviewer-secret-9876');

    const cleared = await app.inject({
      method: 'PUT',
      url: '/api/ai/config',
      headers: ADMIN,
      payload: { reviewer: { baseUrl: '', model: null, apiKey: '', temperature: null } },
    });
    expect(cleared.statusCode).toBe(200);
    const back = (cleared.json() as AiConfigResponse).reviewer;
    expect(back.isDedicated).toBe(false);
    expect(back.model).toBe('primary-model');
    expect(back.baseUrl).toBe('https://api.example.com/v1');
    expect(back.temperature).toBe(0.1);
    expect(back.hasDedicatedBaseUrl).toBe(false);
    expect(back.hasDedicatedModel).toBe(false);
    expect(back.hasDedicatedApiKey).toBe(false);
    expect(back.hasDedicatedTemperature).toBe(false);
  });

  it('reads AI_REVIEWER_* env overrides and probes the reviewer role on demand', async () => {
    const model = scriptedModel(() => 'pong');
    const previous = process.env['AI_REVIEWER_MODEL'];
    process.env['AI_REVIEWER_MODEL'] = 'env-reviewer-model';
    try {
      const { app } = boot({ aiModelFactory: model.factory });
      await app.inject({
        method: 'PUT',
        url: '/api/ai/config',
        headers: ADMIN,
        payload: {
          baseUrl: 'https://api.example.com/v1',
          model: 'primary-model',
          apiKey: 'sk-primary-key-1234',
        },
      });

      const config = await app.inject({ method: 'GET', url: '/api/ai/config', headers: ADMIN });
      const body = config.json() as AiConfigResponse;
      expect(body.reviewer.model).toBe('env-reviewer-model');
      expect(body.reviewer.hasDedicatedModel).toBe(true);
      expect(body.reviewer.isDedicated).toBe(true);

      const probe = await app.inject({
        method: 'POST',
        url: '/api/ai/config/test',
        headers: ADMIN,
        payload: { role: 'reviewer' },
      });
      expect(probe.statusCode).toBe(200);
      const result = probe.json() as { ok: boolean; model: string };
      expect(result.ok).toBe(true);
      expect(result.model).toBe('env-reviewer-model');
      // The probe really went through the reviewer config, not the primary one.
      expect(model.prompts).toHaveLength(1);

      const primary = await app.inject({
        method: 'POST',
        url: '/api/ai/config/test',
        headers: ADMIN,
        payload: {},
      });
      expect((primary.json() as { model: string }).model).toBe('primary-model');
    } finally {
      if (previous === undefined) delete process.env['AI_REVIEWER_MODEL'];
      else process.env['AI_REVIEWER_MODEL'] = previous;
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Dual-AI QA repair loop                                                   */
/* -------------------------------------------------------------------------- */

const AVAILABLE_FALSE: StrictValidationResult = {
  available: false,
  ok: false,
  targets: [],
  diagnostics: [],
  durationMs: 1,
  command: 'dita --validate',
  logTail: '',
  runtime: { ...strictRuntime(), available: false },
  message: 'DITA-OT is not installed',
};

function unavailableStrict() {
  return scriptedStrict(() => AVAILABLE_FALSE);
}

describe('Phase 16 — dual-AI review and targeted QA repair', () => {
  it('repairs only the QA-error block, re-reviews it and records review/repair usage', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return reviewReply(prompt, '安装包');
      if (isSegmentRepairPrompt(prompt)) {
        return replyAll(prompt, (_id, sourceXml) =>
          sourceXml.includes('installer')
            ? '以管理员身份运行安装程序。'
            : `译文：${sourceXml.replace(/<[^>]+>/g, '')}`,
        );
      }
      // First pass: the model wrongly renders "installer" as the forbidden 安装包.
      return replyAll(prompt, (_id, sourceXml) => {
        if (sourceXml.includes('installer')) return '下载安装包。';
        return `译文：${sourceXml.replace(/<[^>]+>/g, '')}`;
      });
    });
    const strict = unavailableStrict();
    const { fixture, app } = boot({
      aiModelFactory: model.factory,
      strictValidator: strict.validator,
    });
    await addGlossary(app);
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK]);
    expect(created.statusCode).toBe(201);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);

    expect(snapshot.job.status).toBe('completed');
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');
    // Deterministic QA dropped to zero, so the repair really fixed the glossary violation.
    expect(item.qaErrorCount).toBe(0);
    // Both steps mention the glossary term, so both must be repaired by the translator AI.
    expect(item.qaRepairedCount).toBe(2);
    expect(item.aiReviewVerdict).toBe('pass');
    expect(item.aiReviewErrorCount).toBe(0);
    // DITA-OT was unavailable in this fixture, so the item is released with a `skipped` verdict.
    expect(item.ditaOtStatus).toBe('skipped');

    const payload = await review(app, item.id);
    expect(payload.proposedXml).toContain('安装程序');
    expect(payload.proposedXml).not.toContain('安装包');
    expect(payload.aiReview).not.toBeNull();
    expect(payload.aiReview?.verdict).toBe('pass');
    expect(payload.aiReview?.repairedSegments).toBe(2);
    expect(payload.aiReview?.initialQaErrors).toBeGreaterThan(0);
    expect(payload.aiReview?.remainingQaErrors).toBe(0);
    // First review round + one confirmation re-review of the repaired block.
    expect(payload.aiReview?.reviewRounds).toBe(2);
    expect(payload.aiReview?.qaRepairRounds).toBe(1);

    const usage = sqliteRows<{ task_type: string; sub_action: string }>(
      fixture.dbPath,
      'SELECT task_type, sub_action FROM ai_usage_logs ORDER BY created_at ASC',
    );
    const taskTypes = usage.map((row) => row.task_type);
    expect(taskTypes).toContain('translate_review');
    expect(taskTypes).toContain('translate_repair');
    const reviewActions = usage
      .filter((row) => row.task_type === 'translate_review')
      .map((row) => row.sub_action);
    expect(reviewActions).toContain('qa_review');
    expect(reviewActions).toContain('qa_recheck');
    expect(
      usage.filter((row) => row.task_type === 'translate_repair').map((row) => row.sub_action),
    ).toContain('qa_repair');
  });

  it('reverts a repair candidate that adds deterministic QA errors', async () => {
    // This topic carries an inline tag, so a candidate that drops it while keeping the forbidden
    // rendering adds a third deterministic error instead of fixing the two it started with.
    const taskWithInline = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD Task//EN" "task.dtd">
<task id="task-install" xml:lang="en-US">
  <title>Install the product</title>
  <taskbody>
    <steps>
      <step><cmd>Download the <b>installer</b> package.</cmd></step>
    </steps>
  </taskbody>
</task>
`;
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return reviewReply(prompt, '安装包');
      if (isSegmentRepairPrompt(prompt)) {
        // A bad candidate: it drops the inline tag and keeps the forbidden rendering.
        return replyAll(prompt, () => '下载安装包。');
      }
      return replyAll(prompt, (_id, sourceXml) =>
        sourceXml.includes('installer') ? '下载<b>安装包</b>包。' : `译文：${sourceXml}`,
      );
    });
    const strict = unavailableStrict();
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    await addGlossary(app);
    const source = await createSourceManual(app, [
      { path: ROOT_MAP, content: rootMap() },
      { path: TASK, content: taskWithInline },
    ]);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    const item = snapshot.items[0]!;

    // No-regression guard: nothing was accepted, so the original proposal survives untouched.
    expect(item.status).toBe('ready_for_review');
    expect(item.qaRepairedCount).toBe(0);
    expect(item.qaErrorCount).toBeGreaterThan(0);
    expect(item.aiReviewVerdict).toBe('revise');
    expect(item.aiReviewErrorCount).toBeGreaterThan(0);

    const payload = await review(app, item.id);
    expect(payload.proposedXml).toContain('安装包');
    expect(payload.proposedXml).toContain('<b>');
    expect(payload.aiReview?.issues.some((issue) => issue.severity === 'error')).toBe(true);
    expect(payload.aiReview?.summary.length).toBeGreaterThan(0);
  });

  it('degrades to verdict "error" when the reviewer never returns valid JSON', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return 'I think the translation is fine, no JSON here.';
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    const strict = unavailableStrict();
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    const item = snapshot.items[0]!;

    expect(item.status).toBe('ready_for_review');
    expect(item.aiReviewVerdict).toBe('error');
    expect(item.aiReviewErrorCount).toBe(0);
    expect(item.qaErrorCount).toBe(0);

    const payload = await review(app, item.id);
    // The proposal is preserved even though the reviewer failed.
    expect(payload.proposedXml.length).toBeGreaterThan(0);
    expect(payload.aiReview?.verdict).toBe('error');
    expect(payload.aiReview?.issues).toEqual([]);
    expect(payload.aiReview?.summary.length).toBeGreaterThan(0);
    // One attempt plus the single format reminder.
    expect(model.prompts.filter(isReviewPrompt)).toHaveLength(2);
  });

  it('skips the reviewer AI entirely when nothing needed translation (0 tokens)', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return PASS_REVIEW;
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    const strict = unavailableStrict();
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const targetRoot = link.targetManual.rootDir;
    mkdirSync(path.join(targetRoot, path.dirname(TASK)), { recursive: true });
    writeFileSync(path.join(targetRoot, TASK), TASK_TARGET, 'utf8');
    commitAll(targetRoot, 'translate task');
    await markSynced(app, link.id, [TASK]);

    const created = await enqueue(app, link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    const item = snapshot.items[0]!;

    expect(item.status).toBe('ready_for_review');
    expect(item.translatedSegments).toBe(0);
    expect(item.reusedSegments).toBeGreaterThan(0);
    expect(item.aiReviewVerdict).toBe('skipped');
    // Not a single model call: no translation work and nothing for the reviewer to read.
    expect(model.prompts).toHaveLength(0);

    const payload = await review(app, item.id);
    expect(payload.aiReview?.verdict).toBe('skipped');
    expect(payload.aiReview?.reviewRounds).toBe(0);
    expect(payload.proposedXml).toContain('安装产品');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Job-level DITA-OT strict validation                                      */
/* -------------------------------------------------------------------------- */

describe('Phase 16 — job-level DITA-OT strict validation', () => {
  it('runs once per job, stages in tmpdir, repairs only the broken file and confirms strictly', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return PASS_REVIEW;
      if (isDitaOtRepairPrompt(prompt)) return documentRepairReply(prompt, 'dita-ot repair');
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    let strictRuns = 0;
    const strict = scriptedStrict((input) => {
      strictRuns += 1;
      // First strict run: one real error in TASK, plus an unrelated baseline error elsewhere.
      if (strictRuns === 1) {
        return strictResult(input, [
          { severity: 'error', code: 'DITAOT001E', message: 'Invalid <cmd> content', filePath: TASK },
          {
            severity: 'error',
            code: 'DITAOT009E',
            message: 'Pre-existing baseline error',
            filePath: 'topics/unrelated-baseline.dita',
          },
        ]);
      }
      if (strictRuns === 2) {
        // Lax sweep: the same job error plus the unrelated one, both reported at once.
        return strictResult(input, [
          { severity: 'error', code: 'DITAOT001E', message: 'Invalid <cmd> content', filePath: TASK },
          {
            severity: 'error',
            code: 'DITAOT009E',
            message: 'Pre-existing baseline error',
            filePath: 'topics/unrelated-baseline.dita',
          },
        ]);
      }
      // Mandatory confirmation after the repair: clean.
      return strictResult(input, []);
    });
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK, CONCEPT]);
    expect(created.statusCode).toBe(201);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);

    expect(snapshot.job.status).toBe('completed');
    expect(snapshot.items).toHaveLength(2);
    for (const item of snapshot.items) expect(item.status).toBe('ready_for_review');

    const task = snapshot.items.find((item) => item.sourcePath === TASK)!;
    const concept = snapshot.items.find((item) => item.sourcePath === CONCEPT)!;
    expect(task.ditaOtStatus).toBe('passed');
    expect(concept.ditaOtStatus).toBe('passed');

    const report = snapshot.job.validationReport;
    expect(report).not.toBeNull();
    expect(report?.status).toBe('passed');
    expect(report?.checkedFiles).toBe(2);
    expect(report?.errorFiles).toBe(1);
    expect(report?.repairedFiles).toBe(1);
    expect(report?.remainingErrorFiles).toBe(0);

    // strict → lax (2 files, one broken) → mandatory strict confirmation.
    expect(strict.calls.map((call) => call.processingMode)).toEqual(['strict', 'lax', 'strict']);
    expect(strict.calls[0]?.paths.sort()).toEqual([CONCEPT, TASK].sort());
    // One batch call for the whole job, not one per file.
    expect(strict.calls[0]?.paths).toHaveLength(2);

    // Every run happened in an isolated staging tree that no longer exists.
    const sourceRoot = source.rootDir;
    const targetRoot = link.targetManual.rootDir;
    for (const call of strict.calls) {
      expect(call.workDir.startsWith(os.tmpdir())).toBe(true);
      expect(call.workDir).not.toBe(sourceRoot);
      expect(call.workDir).not.toBe(targetRoot);
      expect(existsSync(call.workDir)).toBe(false);
    }
    // … and the shared worktrees were never touched (Phase 13 clean baseline).
    expect(porcelain(sourceRoot)).toBe('');
    expect(porcelain(targetRoot)).toBe('');

    const repaired = await review(app, task.id);
    expect(repaired.proposedXml).toContain('dita-ot repair');
    expect(repaired.ditaOtReport?.status).toBe('passed');
    expect(repaired.ditaOtReport?.repaired).toBe(true);
    expect(repaired.aiReview?.verdict).toBe('pass');
    expect(repaired.aiReview?.reviewRounds).toBe(1);
    // The unrelated baseline error never reached the panel of a file this job owns.
    expect(repaired.ditaOtReport?.diagnostics).toEqual([]);
    const untouched = await review(app, concept.id);
    expect(untouched.proposedXml).not.toContain('dita-ot repair');
  });

  it('degrades to "skipped" when DITA-OT is unavailable', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return PASS_REVIEW;
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    const strict = unavailableStrict();
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    const item = snapshot.items[0]!;

    expect(item.status).toBe('ready_for_review');
    expect(item.ditaOtStatus).toBe('skipped');
    expect(snapshot.job.validationReport?.status).toBe('skipped');
    expect(snapshot.job.validationReport?.reason).toBeTruthy();
    expect(strict.calls).toHaveLength(1);
  });

  it('keeps residual DITA-OT errors visible but still releases the proposal', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return PASS_REVIEW;
      if (isDitaOtRepairPrompt(prompt)) return documentRepairReply(prompt);
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    const strict = scriptedStrict((input) =>
      strictResult(input, [
        { severity: 'error', code: 'DITAOT001E', message: 'Invalid <cmd> content', filePath: TASK },
      ]),
    );
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id);

    const created = await enqueue(app, link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    const item = snapshot.items[0]!;

    // Residual errors never block the human reviewer; `qaStrict` is what blocks applying.
    expect(item.status).toBe('ready_for_review');
    expect(item.ditaOtStatus).toBe('failed');
    expect(item.ditaOtErrorCount).toBe(1);
    expect(snapshot.job.status).toBe('completed');
    expect(snapshot.job.validationReport?.status).toBe('failed');
    expect(snapshot.job.validationReport?.remainingErrorFiles).toBe(1);

    const payload = await review(app, item.id);
    expect(payload.proposedXml.length).toBeGreaterThan(0);
    expect(payload.ditaOtReport?.status).toBe('failed');
    expect(payload.ditaOtReport?.diagnostics[0]?.code).toBe('DITAOT001E');
    // Exactly one repair attempt per item.
    expect(model.prompts.filter(isDitaOtRepairPrompt)).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Review → apply gate                                                      */
/* -------------------------------------------------------------------------- */

describe('Phase 16 — qaStrict gate and per-item strict validation', () => {
  it('blocks batch apply on a failed DITA-OT verdict until validate-strict clears it', async () => {
    const model = scriptedModel((prompt) => {
      if (isReviewPrompt(prompt)) return PASS_REVIEW;
      return replyAll(prompt, (_id, sourceXml) => `译文：${sourceXml.replace(/<[^>]+>/g, '')}`);
    });
    let failuresEnabled = true;
    const strict = scriptedStrict((input) =>
      failuresEnabled
        ? strictResult(input, [
            { severity: 'error', code: 'DITAOT001E', message: 'Invalid <cmd> content', filePath: TASK },
          ])
        : strictResult(input, []),
    );
    const { app } = boot({ aiModelFactory: model.factory, strictValidator: strict.validator });
    const source = await createSourceManual(app);
    const link = await createLink(app, source.id, { qaStrict: true });

    const created = await enqueue(app, link.id, [TASK]);
    const jobId = (created.json() as JobSnapshot).job.id;
    const snapshot = await awaitJob(app, jobId);
    const item = snapshot.items[0]!;
    expect(item.status).toBe('ready_for_review');
    expect(item.ditaOtStatus).toBe('failed');

    const blocked = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-apply-draft`,
      headers: WRITER,
      payload: { itemIds: [item.id] },
    });
    expect(blocked.statusCode).toBe(200);
    const blockedBody = blocked.json() as {
      applied: unknown[];
      skippedInvalid: Array<{ itemId: string; reason: string }>;
    };
    expect(blockedBody.applied).toHaveLength(0);
    expect(blockedBody.skippedInvalid).toHaveLength(1);
    expect(blockedBody.skippedInvalid[0]?.itemId).toBe(item.id);
    expect(blockedBody.skippedInvalid[0]?.reason).toContain(TASK);
    // Nothing was written into the caller's draft overlay.
    expect(porcelain(link.targetManual.rootDir)).toBe('');

    failuresEnabled = false;
    const validated = await app.inject({
      method: 'POST',
      url: `/api/translation/items/${item.id}/validate-strict`,
      headers: WRITER,
    });
    expect(validated.statusCode).toBe(200);
    const validatedBody = validated.json() as {
      item: JobItem;
      ditaOtReport: { status: string; stale?: boolean };
    };
    expect(validatedBody.ditaOtReport.status).toBe('passed');
    expect(validatedBody.item.ditaOtStatus).toBe('passed');

    const applied = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/batch-apply-draft`,
      headers: WRITER,
      payload: { itemIds: [item.id] },
    });
    expect(applied.statusCode).toBe(200);
    const appliedBody = applied.json() as {
      applied: Array<{ itemId: string }>;
      skippedInvalid: unknown[];
    };
    expect(appliedBody.skippedInvalid).toHaveLength(0);
    expect(appliedBody.applied.map((entry) => entry.itemId)).toEqual([item.id]);
  });
});
