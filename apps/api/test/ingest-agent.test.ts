import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { parseMarkdownOutline } from '@dita/core';
import type {
  GeneratedTopicArtifact,
  IngestOutlinePlan,
  PlannedTopicNode,
} from '@dita/core';
import { openDatabase, type DitaDatabase, type DitaDatabaseHandle } from '../src/db/client.js';
import { aiUsageLogs } from '../src/db/schema.js';
import { AiSettingsService } from '../src/modules/ai/ai-settings-service.js';
import { AiUsageService } from '../src/modules/ai/ai-usage-service.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';
import type { IdentityUser } from '../src/modules/identity/identity-service.js';
import type { AiTaskType } from '../src/modules/ai/types.js';
import type {
  StrictDiagnostic,
  StrictValidationResult,
} from '../src/modules/validate/strict-validator.js';
import {
  IngestAgentAbortedError,
  draftAndVerifyTopic,
  draftTopicWithAgent,
  draftTopicsConcurrently,
  postProcessGeneratedTopicXml,
  planDocumentOutline,
  validateAndRepairBatch,
  validateTopicLayer1,
  type IngestAgentCallbacks,
  type IngestAgentContext,
  type IngestAgentDeps,
} from '../src/modules/ingest/agent/index.js';

const USER: IdentityUser = {
  id: 'u-admin',
  displayName: 'Admin',
  role: 'admin',
  email: 'admin@example.com',
  color: '#336699',
  initials: 'AD',
};

const MARKDOWN = [
  '# Product Overview',
  '',
  'The product ships with a workspace model.',
  '',
  '## Key Features',
  '',
  '- Structured editing',
  '- Lossless XML',
  '',
  '# Install the Product',
  '',
  'Run the installer.',
  '',
  '## Requirements',
  '',
  'Java 21 and Node 22.',
  '',
].join('\n');

const SECTIONS = parseMarkdownOutline(MARKDOWN);

const ORIGINAL_ENV_KEY = process.env.DEEPSEEK_API_KEY;
const ORIGINAL_ENV_MODEL = process.env.DEEPSEEK_MODEL;

let handle: DitaDatabaseHandle | undefined;
let db: DitaDatabase;
let settings: AiSettingsService;
let usage: AiUsageService;

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = 'sk-test-ingest-agent';
  process.env.DEEPSEEK_MODEL = 'deepseek-chat';
  handle = openDatabase(':memory:');
  db = handle.db;
  settings = new AiSettingsService(db);
  usage = new AiUsageService(db);
});

afterEach(() => {
  handle?.close();
  handle = undefined;
  if (ORIGINAL_ENV_KEY === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = ORIGINAL_ENV_KEY;
  if (ORIGINAL_ENV_MODEL === undefined) delete process.env.DEEPSEEK_MODEL;
  else process.env.DEEPSEEK_MODEL = ORIGINAL_ENV_MODEL;
});

/* ------------------------------------------------------------------------------------------ */
/* Scripted model factory                                                                     */
/* ------------------------------------------------------------------------------------------ */

type Role = 'planner' | 'writer' | 'repair';

interface ScriptedModelOptions {
  planner?: string[];
  writer?: string[];
  repair?: string[];
  onInvoke?(role: Role, index: number, messages: BaseMessage[]): void;
}

interface ScriptedModel {
  factory: AiModelFactory;
  calls: Record<Role, number>;
}

function roleOf(messages: BaseMessage[]): Role {
  const system = messages[0];
  const text = typeof system?.content === 'string' ? system.content : '';
  if (text.includes('Planning agent')) return 'planner';
  if (text.includes('Writing agent')) return 'writer';
  return 'repair';
}

function scriptedModel(options: ScriptedModelOptions): ScriptedModel {
  const calls: Record<Role, number> = { planner: 0, writer: 0, repair: 0 };
  const queues: Record<Role, string[]> = {
    planner: [...(options.planner ?? [])],
    writer: [...(options.writer ?? [])],
    repair: [...(options.repair ?? [])],
  };
  const factory: AiModelFactory = () => ({
    invoke: async (messages) => {
      const role = roleOf(messages);
      const index = calls[role];
      calls[role] += 1;
      options.onInvoke?.(role, index, messages);
      const queue = queues[role];
      const reply = queue.length > 1 ? queue.shift() : queue[0];
      if (reply === undefined) throw new Error(`No scripted ${role} reply #${index}`);
      return new AIMessage({
        content: reply,
        usage_metadata: { input_tokens: 120, output_tokens: 60, total_tokens: 180 },
      });
    },
    // The ingest agents only use `invoke`; streaming is unused but must exist on the interface.
    async *stream() {
      // no chunks are produced in these tests
    },
  });
  return { factory, calls };
}

/* ------------------------------------------------------------------------------------------ */
/* Fixtures & helpers                                                                         */
/* ------------------------------------------------------------------------------------------ */

function makeDeps(factory: AiModelFactory, strictValidator?: IngestAgentDeps['strictValidator']): IngestAgentDeps {
  return {
    settings,
    usage,
    modelFactory: factory,
    ...(strictValidator ? { strictValidator } : {}),
  };
}

function makeContext(overrides: Partial<IngestAgentContext> = {}): IngestAgentContext {
  return {
    projectId: 'manual-1',
    branch: 'main',
    user: USER,
    locale: 'en',
    ...overrides,
  };
}

function makePlan(overrides: Partial<IngestOutlinePlan> = {}): IngestOutlinePlan {
  return {
    title: 'Demo Manual',
    language: 'en',
    targetMode: 'multi_topic',
    mapKind: 'map',
    rootMapPath: 'demo-manual.ditamap',
    topicType: 'auto',
    createKeysMap: false,
    suggestedKeys: [],
    topics: [],
    ...overrides,
  };
}

function makeNode(overrides: Partial<PlannedTopicNode> = {}): PlannedTopicNode {
  return {
    topicId: 'concept_overview',
    title: 'Product Overview',
    type: 'concept',
    filePath: 'concepts/overview.dita',
    ...overrides,
  };
}

function posix(value: string | undefined): string {
  return String(value ?? '').replaceAll('\\', '/');
}

function usageRows(): Array<{ task_type: string; sub_action: string; status: string; retry_count: number }> {
  const rows = db.select().from(aiUsageLogs).all();
  return rows.map((row) => ({
    task_type: row.taskType as string,
    sub_action: row.subAction,
    status: row.status,
    retry_count: row.retryCount,
  }));
}

function usageTaskTypes(): AiTaskType[] {
  return db
    .select()
    .from(aiUsageLogs)
    .all()
    .map((row) => row.taskType as AiTaskType);
}

function layer1(xml: string, node = makeNode(), assets: string[] = []): ReturnType<typeof validateTopicLayer1> {
  return validateTopicLayer1({
    node,
    xml,
    locale: 'en',
    availableAssetPaths: new Set(assets),
  });
}

function minimalStrictResult(overrides: Partial<StrictValidationResult> = {}): StrictValidationResult {
  return {
    available: true,
    ok: true,
    targets: [],
    diagnostics: [],
    durationMs: 5,
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
    ...overrides,
  };
}

const VALID_CONCEPT_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
  '<concept id="concept_overview" xml:lang="en"><title>Product Overview</title>',
  '<conbody><p>Text</p></conbody></concept>',
  '',
].join('\n');

/* ------------------------------------------------------------------------------------------ */
/* 1. Planner                                                                                 */
/* ------------------------------------------------------------------------------------------ */

describe('planner agent', () => {
  it('accepts a valid JSON plan and normalizes colliding paths', async () => {
    const script = scriptedModel({
      planner: [
        JSON.stringify({
          title: 'Demo Manual',
          language: 'en',
          mapKind: 'map',
          rootMapPath: 'demo-manual.ditamap',
          createKeysMap: false,
          topics: [
            {
              topicId: 'concept_overview',
              title: 'Product Overview',
              type: 'concept',
              filePath: 'concepts/overview.dita',
              sectionIds: ['sec_001', 'sec_002'],
            },
            {
              topicId: 'task_install',
              title: 'Install the Product',
              type: 'task',
              filePath: 'tasks/install.dita',
              sectionIds: ['sec_003', 'sec_004'],
            },
          ],
        }),
      ],
    });

    const result = await planDocumentOutline(
      {
        markdown: MARKDOWN,
        sourceFilename: 'product.md',
        targetMode: 'multi_topic',
        language: 'en',
      },
      makeDeps(script.factory),
      makeContext({ existingPaths: new Set(['concepts/overview.dita']) }),
    );

    expect(result.usedFallback).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.plan.topics).toHaveLength(2);
    expect(result.plan.topics[0]?.filePath).toBe('concepts/overview_2.dita');
    expect(result.plan.topics[1]?.filePath).toBe('tasks/install.dita');
    expect(result.plan.topics[1]?.type).toBe('task');
    expect(result.plan.topics[0]?.sectionIds).toEqual(['sec_001', 'sec_002']);
    expect(result.plan.rootMapPath).toBe('demo-manual.ditamap');

    const rows = usageRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ task_type: 'ingest_plan', sub_action: 'multi_topic', status: 'succeeded' });
    // The plan prompt must never persist document bodies in usage rows.
    expect(JSON.stringify(rows)).not.toContain('workspace model');
  });

  it('recovers from malformed JSON on the first retry', async () => {
    const validPlan = JSON.stringify({
      title: 'Demo Manual',
      topics: [
        {
          topicId: 'concept_overview',
          title: 'Product Overview',
          type: 'concept',
          filePath: 'concepts/overview.dita',
        },
      ],
    });
    const script = scriptedModel({ planner: ['{"title": "Demo Manual", "topics": [ }', validPlan] });

    const result = await planDocumentOutline(
      { markdown: MARKDOWN, sourceFilename: 'product.md', targetMode: 'multi_topic' },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(script.calls.planner).toBe(2);
    expect(result.usedFallback).toBe(false);
    expect(result.plan.topics).toHaveLength(1);
    const rows = usageRows();
    expect(rows.map((row) => row.status)).toEqual(['failed', 'succeeded']);
    expect(rows[1]?.retry_count).toBe(1);
  });

  it('falls back deterministically when the model keeps failing', async () => {
    const script = scriptedModel({ planner: ['not json at all', 'still not json'] });

    const result = await planDocumentOutline(
      { markdown: MARKDOWN, sourceFilename: 'product.md', targetMode: 'multi_topic' },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(result.usedFallback).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.plan.topics.length).toBeGreaterThanOrEqual(2);
    expect(result.plan.rootMapPath).toMatch(/\.ditamap$/u);
    expect(script.calls.planner).toBe(2);
  });

  it('enforces exactly one root topic for single_topic imports', async () => {
    const twoTopicPlan = JSON.stringify({
      title: 'Demo Topic',
      topics: [
        { title: 'Product Overview', type: 'concept', filePath: 'concepts/overview.dita', sectionIds: ['sec_001'] },
        { title: 'Install the Product', type: 'task', filePath: 'tasks/install.dita', sectionIds: ['sec_003'] },
      ],
    });
    const script = scriptedModel({ planner: [twoTopicPlan] });

    const result = await planDocumentOutline(
      { markdown: MARKDOWN, sourceFilename: 'product.md', targetMode: 'single_topic' },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(result.plan.topics).toHaveLength(1);
    expect(result.plan.targetMode).toBe('single_topic');
    // The mode violation is retried once, then downgraded to the deterministic fallback.
    expect(script.calls.planner).toBe(2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('falls back without calling the model when no API key is configured', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const script = scriptedModel({ planner: ['{}'] });

    const result = await planDocumentOutline(
      { markdown: MARKDOWN, sourceFilename: 'product.md', targetMode: 'multi_topic' },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(script.calls.planner).toBe(0);
    expect(result.usedFallback).toBe(true);
    expect(result.plan.topics.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* 2. Writer                                                                                  */
/* ------------------------------------------------------------------------------------------ */

describe('writer agent', () => {
  it('rewrites asset placeholders to exact relative hrefs and injects prolog/id/xml:lang', async () => {
    const node = makeNode({ topicId: 'task_setup', title: 'Set up', type: 'task', filePath: 'tasks/setup.dita' });
    const script = scriptedModel({
      writer: [
        [
          '```xml',
          '<task>',
          '  <title>Set up the workspace</title>',
          '  <taskbody>',
          '    <steps>',
          '      <step><cmd>Look at the screenshot</cmd>',
          '        <info><image href="asset://img_001.png"><alt>Setup screen</alt></image></info>',
          '      </step>',
          '      <step><cmd>Second shot</cmd>',
          '        <info><image href="asset://img_002"><alt>Second</alt></image></info>',
          '      </step>',
          '    </steps>',
          '  </taskbody>',
          '</task>',
          '```',
        ].join('\n'),
      ],
    });

    const result = await draftTopicWithAgent(
      {
        markdown: MARKDOWN,
        sections: SECTIONS,
        plan: makePlan({ topics: [node] }),
        node,
        language: 'en',
        assetPathById: new Map([
          ['img_001', 'images/img_001.png'],
          ['img_002', 'images/img_002.png'],
        ]),
      },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(result.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(result.xml).toContain('<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">');
    expect(result.xml).toContain('<task id="task_setup" xml:lang="en">');
    expect(result.xml).toContain('href="../images/img_001.png"');
    expect(result.xml).toContain('href="../images/img_002.png"');
    expect(result.xml).not.toContain('asset://');
    expect(result.xml).not.toContain('```');

    const rows = usageRows();
    expect(rows[0]).toMatchObject({ task_type: 'ingest_write', sub_action: 'task', status: 'succeeded' });
    expect(layer1(result.xml, node, ['images/img_001.png', 'images/img_002.png']).ok).toBe(true);
  });

  it('injects type-correct DOCTYPEs for concept and reference topics', () => {
    const conceptNode = makeNode();
    const conceptXml = postProcessGeneratedTopicXml(
      '<concept><title>Overview</title><conbody><p>Text</p></conbody></concept>',
      { node: conceptNode, language: 'zh-CN', assetPathById: new Map() },
    );
    expect(conceptXml).toContain('<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">');
    expect(conceptXml).toContain('id="concept_overview"');
    expect(conceptXml).toContain('xml:lang="zh-CN"');
    expect(layer1(conceptXml, conceptNode).ok).toBe(true);

    const referenceNode = makeNode({ topicId: 'reference_api', title: 'API', type: 'reference', filePath: 'reference/api.dita' });
    const referenceXml = postProcessGeneratedTopicXml(
      '<reference><title>API</title><refbody><section><p>Text</p></section></refbody></reference>',
      { node: referenceNode, language: 'en', assetPathById: new Map() },
    );
    expect(referenceXml).toContain('<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">');
    expect(layer1(referenceXml, referenceNode).ok).toBe(true);
  });

  it('replaces a broken DOCTYPE and keeps determinism across a second pass', () => {
    const node = makeNode({ topicId: 'concept_overview', title: 'Overview', type: 'concept' });
    const broken = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE concept SYSTEM "concept.dtd">',
      '<concept id="old_id"><title>Overview</title><conbody><p>Text</p></conbody></concept>',
    ].join('\n');

    const once = postProcessGeneratedTopicXml(broken, { node, language: 'en', assetPathById: new Map() });
    const twice = postProcessGeneratedTopicXml(once, { node, language: 'en', assetPathById: new Map() });

    expect(once).toBe(twice);
    expect(once).toContain('<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">');
    expect(once).toContain('id="concept_overview"');
    expect(once).not.toContain('id="old_id"');
  });

  it('drafts topics with bounded concurrency and preserves input order', async () => {
    const nodes = [
      makeNode({ topicId: 'concept_a', title: 'A', filePath: 'concepts/a.dita' }),
      makeNode({ topicId: 'concept_b', title: 'B', filePath: 'concepts/b.dita' }),
      makeNode({ topicId: 'concept_c', title: 'C', filePath: 'concepts/c.dita' }),
    ];
    let active = 0;
    let maxActive = 0;
    const factory: AiModelFactory = () => ({
      invoke: async (messages) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        const title = String(messages[1]?.content ?? '').includes('title: B') ? 'B' : 'A';
        return new AIMessage({
          content: `<concept><title>${title}</title><conbody><p>${title}</p></conbody></concept>`,
          usage_metadata: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        });
      },
      async *stream() {
        // unused
      },
    });

    const drafts = await draftTopicsConcurrently(
      nodes,
      {
        markdown: MARKDOWN,
        sections: SECTIONS,
        plan: makePlan({ topics: nodes }),
        language: 'en',
      },
      makeDeps(factory),
      makeContext(),
    );

    expect(drafts.map((draft) => draft.node.topicId)).toEqual(['concept_a', 'concept_b', 'concept_c']);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(drafts.every((draft) => draft.xml.includes('<concept'))).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* 3. Layer 1 self-healing                                                                    */
/* ------------------------------------------------------------------------------------------ */

describe('layer 1 validator/repairer', () => {
  it('flags duplicate <cmd> in a step and repairs it on the first pass', async () => {
    const node = makeNode({ topicId: 'task_setup', title: 'Set up', type: 'task', filePath: 'tasks/setup.dita' });
    const broken = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
      '<task id="task_setup" xml:lang="en"><title>Set up</title>',
      '<taskbody><steps><step><cmd>One</cmd><cmd>Two</cmd></step></steps></taskbody></task>',
    ].join('\n');
    const fixed = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
      '<task id="task_setup" xml:lang="en"><title>Set up</title>',
      '<taskbody><steps><step><cmd>One</cmd></step></steps></taskbody></task>',
    ].join('\n');

    // Sanity: the broken draft really is invalid for Layer 1.
    expect(layer1(broken, node).ok).toBe(false);

    const script = scriptedModel({ writer: [broken], repair: [fixed] });
    const statuses: string[] = [];

    const artifact = await draftAndVerifyTopic(
      {
        markdown: MARKDOWN,
        sections: SECTIONS,
        plan: makePlan({ topics: [node] }),
        node,
        language: 'en',
        maxLayer1Retries: 2,
        callbacks: {
          onTopicStatus: (update) => statuses.push(update.status),
        },
      },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(artifact.ok).toBe(true);
    expect(artifact.repaired).toBe(true);
    expect(artifact.repairAttempts).toBe(1);
    expect(artifact.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(script.calls.repair).toBe(1);
    expect(statuses).toEqual(['writing', 'repairing', 'done']);
    expect(usageTaskTypes()).toContain('ingest_repair');
    expect(usageRows().find((row) => row.task_type === 'ingest_repair')).toMatchObject({
      sub_action: 'layer1',
      status: 'succeeded',
    });
  });

  it('reports unruly drafts as failed after exhausting retries', async () => {
    const node = makeNode({ type: 'concept' });
    const broken = '<concept><title>Overview</title><conbody><p>text';
    const script = scriptedModel({ writer: [broken], repair: [broken] });

    const artifact = await draftAndVerifyTopic(
      {
        markdown: MARKDOWN,
        sections: SECTIONS,
        plan: makePlan({ topics: [node] }),
        node,
        language: 'en',
        maxLayer1Retries: 1,
      },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(artifact.ok).toBe(false);
    expect(artifact.repairAttempts).toBe(1);
    expect(script.calls.repair).toBe(1);
    expect(artifact.issues.some((issue) => issue.code === 'xml-not-well-formed')).toBe(true);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* 4 & 5. Layer 2 DITA-OT strict validation                                                   */
/* ------------------------------------------------------------------------------------------ */

function makeArtifact(node: PlannedTopicNode, xml: string): GeneratedTopicArtifact {
  return { node, xml, repairAttempts: 0, repaired: false, issues: [], ok: true };
}

describe('layer 2 strict validation & repair', () => {
  it('repairs a DOTJ error and confirms convergence with a second strict run', async () => {
    const node = makeNode();
    const plan = makePlan({
      rootMapPath: 'demo-manual.ditamap',
      topics: [node],
    });
    const artifact = makeArtifact(node, VALID_CONCEPT_XML);

    const strictCalls: StrictValidationResult[] = [];
    const strictValidator = async (): Promise<StrictValidationResult> => {
      strictCalls.push(minimalStrictResult());
      if (strictCalls.length === 1) {
        return minimalStrictResult({
          ok: false,
          diagnostics: [
            {
              id: 'dotj-1',
              filePath: node.filePath,
              line: 3,
              column: 1,
              severity: 'error',
              message: 'DOTJ037E: element "p" not allowed here',
              code: 'DOTJ037E',
            },
          ],
          message: 'DITA-OT strict validation reported 1 error.',
        });
      }
      return minimalStrictResult({ ok: true, targets: [node.filePath] });
    };

    const repairedXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
      '<concept id="concept_overview" xml:lang="en"><title>Product Overview</title>',
      '<conbody><p>Fixed content</p></conbody></concept>',
      '',
    ].join('\n');

    const script = scriptedModel({ repair: [repairedXml] });
    const result = await validateAndRepairBatch(
      { plan, artifacts: [artifact], maxLayer2Retries: 2 },
      makeDeps(script.factory, strictValidator),
      makeContext(),
    );

    expect(strictCalls).toHaveLength(2);
    expect(script.calls.repair).toBe(1);
    expect(result.validationReport.layer2.status).toBe('passed');
    expect(result.validationReport.ok).toBe(true);
    expect(result.artifacts[0]?.repaired).toBe(true);
    expect(result.artifacts[0]?.repairAttempts).toBe(1);
    expect(usageRows().find((row) => row.task_type === 'ingest_repair')).toMatchObject({
      sub_action: 'layer2_strict',
    });
  });

  it('degrades gracefully when DITA-OT is unavailable', async () => {
    const node = makeNode({ topicId: 'concept_overview', title: 'Product Overview' });
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: [node] });
    const artifact = makeArtifact(
      node,
      '<concept><title>Product Overview</title><conbody><p>Text</p></conbody></concept>',
    );

    const script = scriptedModel({});
    const result = await validateAndRepairBatch(
      { plan, artifacts: [artifact] },
      { ...makeDeps(script.factory), ditaRuntime: { command: 'dita-definitely-missing-xyz' } },
      makeContext(),
    );

    expect(result.validationReport.layer2.status).toBe('skipped');
    expect(result.validationReport.layer2.reason).toMatch(/DITA-OT|dita/u);
    expect(result.validationReport.layer1.ok).toBe(true);
    expect(result.validationReport.ok).toBe(true);
    expect(script.calls.repair).toBe(0);
  });

  it('reports semantic misses (broken cross-topic reuse) without failing on unrelated baseline files', async () => {
    const node = makeNode();
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: [node] });
    const xmlWithLink = [
      '<concept id="concept_overview" xml:lang="en"><title>Product Overview</title>',
      '<conbody><p conref="concepts/missing.dita#missing/p"/></conbody></concept>',
    ].join('\n');
    const artifact = makeArtifact(node, xmlWithLink);

    const strictValidator = async (): Promise<StrictValidationResult> =>
      minimalStrictResult({ ok: true, targets: [node.filePath] });

    const script = scriptedModel({});
    const result = await validateAndRepairBatch(
      {
        plan,
        artifacts: [artifact],
        baselineFiles: {
          'concepts/baseline.dita':
            '<concept id="concept_baseline"><title>B</title><conbody><p conref="concepts/also-missing.dita#x/p"/></conbody></concept>',
        },
      },
      makeDeps(script.factory, strictValidator),
      makeContext(),
    );

    const semanticIssues = result.validationReport.layer1.issues.filter((issue) => issue.source === 'semantic');
    expect(semanticIssues.length).toBeGreaterThan(0);
    expect(semanticIssues.every((issue) => posix(issue.path) === node.filePath)).toBe(true);
    expect(result.validationReport.layer1.ok).toBe(false);
    expect(result.validationReport.ok).toBe(false);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* 6. Cancellation                                                                            */
/* ------------------------------------------------------------------------------------------ */

describe('abort handling', () => {
  it('stops concurrent writers cleanly when the signal fires', async () => {
    const controller = new AbortController();
    const nodes = [
      makeNode({ topicId: 'concept_a', filePath: 'concepts/a.dita' }),
      makeNode({ topicId: 'concept_b', filePath: 'concepts/b.dita' }),
      makeNode({ topicId: 'concept_c', filePath: 'concepts/c.dita' }),
    ];
    let invocations = 0;
    const factory: AiModelFactory = () => ({
      invoke: async () => {
        invocations += 1;
        controller.abort();
        return new AIMessage({
          content: '<concept><title>A</title><conbody><p>A</p></conbody></concept>',
          usage_metadata: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
        });
      },
      async *stream() {
        // unused
      },
    });

    await expect(
      draftTopicsConcurrently(
        nodes,
        {
          markdown: MARKDOWN,
          sections: SECTIONS,
          plan: makePlan({ topics: nodes }),
          language: 'en',
        },
        makeDeps(factory),
        makeContext({ signal: controller.signal }),
      ),
    ).rejects.toBeInstanceOf(IngestAgentAbortedError);
    expect(invocations).toBeLessThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* 7. Writer external links, Layer 1 topic-root children, Layer 2 tool agent                   */
/* ------------------------------------------------------------------------------------------ */

const BROKEN_MARKER = 'BROKEN_MARKER';

function conceptXml(topicId: string, title: string, body: string): string {
  return `<concept id="${topicId}" xml:lang="en"><title>${title}</title><conbody>${body}</conbody></concept>`;
}

/**
 * A DITA-OT stand-in that really reads the staged files: a topic fails while it still contains the
 * marker. `reportFirstOnly` mimics `--processing-mode=strict`, which aborts on the first error.
 */
function stagingValidator(
  options: { reportFirstOnly?: boolean; requireMapNavtitle?: boolean } = {},
): NonNullable<IngestAgentDeps['strictValidator']> {
  return async (input) => {
    const targets = input.paths.map((value) => posix(value));
    const root = input.rootMapPath && options.requireMapNavtitle ? posix(input.rootMapPath) : null;
    const files = root && !targets.includes(root) ? [root, ...targets] : targets;
    const diagnostics: StrictDiagnostic[] = [];
    for (const relative of files) {
      const absolute = path.join(input.workDir, ...relative.split('/'));
      const text = await readFile(absolute, 'utf8').catch(() => '');
      // The generated map lacks a `<navtitle>`, so map mode fails until the agent writes one.
      const marker = relative.endsWith('.ditamap') ? '<navtitle>' : BROKEN_MARKER;
      const at = text.indexOf(marker);
      if (marker === '<navtitle>' ? at >= 0 : at < 0) continue;
      const line = at < 0 ? 1 : text.slice(0, at).split('\n').length;
      diagnostics.push({
        id: `dotj-${relative}`,
        filePath: relative,
        line,
        column: 1,
        severity: 'error',
        message: `DOTJ013E: "${relative}" contains a content-model violation.`,
        code: 'DOTJ013E',
      });
      if (options.reportFirstOnly) break;
    }
    return minimalStrictResult({
      ok: diagnostics.length === 0,
      diagnostics,
      targets: files,
      ...(diagnostics.length > 0 ? { message: 'DITA-OT strict validation reported errors.' } : {}),
    });
  };
}

function countingValidator(
  inner: NonNullable<IngestAgentDeps['strictValidator']>,
  counts: { strict: number; lax: number },
): NonNullable<IngestAgentDeps['strictValidator']> {
  return async (input) => {
    if (input.processingMode === 'lax') counts.lax += 1;
    else counts.strict += 1;
    return inner(input);
  };
}

interface ScriptedToolCall {
  name: string;
  args?: Record<string, unknown>;
}

/** A model that answers with scripted tool-call batches, one batch per turn. */
function toolScriptedModel(
  batches: readonly ScriptedToolCall[][],
  hooks: { beforeStep?(step: number): void } = {},
): { factory: AiModelFactory; counter: { steps: number } } {
  const counter = { steps: 0 };
  const respond = (messages: BaseMessage[]): AIMessage => {
    hooks.beforeStep?.(counter.steps + 1);
    const batch = batches[counter.steps] ?? [];
    counter.steps += 1;
    const usage_metadata = { input_tokens: 90, output_tokens: 30, total_tokens: 120 };
    if (batch.length === 0) return new AIMessage({ content: 'All staged files are repaired.', usage_metadata });
    return new AIMessage({
      content: '',
      tool_calls: batch.map((call, index) => ({
        name: call.name,
        args: call.args ?? {},
        id: `call_${counter.steps}_${index}`,
        type: 'tool_call' as const,
      })),
      usage_metadata,
    });
  };
  const factory: AiModelFactory = () => ({
    invoke: async (messages) => respond(messages),
    bindTools: () => ({ invoke: async (messages: BaseMessage[]) => respond(messages) }),
    async *stream() {
      // unused: the repair agent only invokes the bound model
    },
  });
  return { factory, counter };
}

describe('writer agent external links', () => {
  it('adds scope/format to external xrefs without touching internal ones, idempotently', () => {
    const node = makeNode();
    const raw = [
      '<concept><title>Overview</title><conbody><p>See ',
      '<xref href="https://example.com/docs"/>, ',
      '<xref href="https://example.com/manual.pdf"/>, ',
      '<xref href="mailto:support@example.com"/>, ',
      '<xref href="other.dita#topic/p"/>, ',
      '<xref href="https://example.com/kept" scope="external" format="pdf"/>.',
      '</p></conbody></concept>',
    ].join('');

    const once = postProcessGeneratedTopicXml(raw, { node, language: 'en', assetPathById: new Map() });
    expect(once).toMatch(/href="https:\/\/example\.com\/docs"[^>]*scope="external"/u);
    expect(once).toMatch(/href="https:\/\/example\.com\/docs"[^>]*format="html"/u);
    expect(once).toMatch(/href="https:\/\/example\.com\/manual\.pdf"[^>]*format="pdf"/u);
    expect(once).toMatch(/href="mailto:support@example\.com"[^>]*scope="external"/u);
    expect(once).not.toMatch(/href="mailto:support@example\.com"[^>]*format=/u);
    expect(once).not.toMatch(/href="other\.dita#topic\/p"[^>]*scope=/u);
    // An explicit model-authored format is kept as-is.
    expect(once).toMatch(/href="https:\/\/example\.com\/kept"[^>]*format="pdf"/u);

    const twice = postProcessGeneratedTopicXml(once, { node, language: 'en', assetPathById: new Map() });
    expect(twice).toBe(once);
  });

  it('tells the writing model to use <taskbody> and external link attributes', async () => {
    const node = makeNode({ topicId: 'task_setup', title: 'Set up', type: 'task', filePath: 'tasks/setup.dita' });
    let systemPrompt = '';
    const script = scriptedModel({
      writer: ['<task><title>Set up</title><taskbody><context><p>Text</p></context></taskbody></task>'],
      onInvoke: (role, _index, messages) => {
        if (role !== 'writer') return;
        const first = messages[0];
        systemPrompt = typeof first?.content === 'string' ? first.content : '';
      },
    });

    await draftTopicWithAgent(
      {
        markdown: MARKDOWN,
        sections: SECTIONS,
        plan: makePlan({ topics: [node] }),
        node,
        language: 'en',
      },
      makeDeps(script.factory),
      makeContext(),
    );

    expect(systemPrompt).toContain('<taskbody>');
    expect(systemPrompt).toContain('never put <result> inside <step>');
    expect(systemPrompt).toContain('scope="external"');
    expect(systemPrompt).toContain('format="html"');
  });
});

describe('layer 1 topic-root direct children', () => {
  it('rejects <steps> directly under <task> and accepts unknown specializations', () => {
    const taskNode = makeNode({ topicId: 'task_bad', title: 'Bad', type: 'task', filePath: 'tasks/bad.dita' });
    const straySteps = validateTopicLayer1({
      node: taskNode,
      xml: '<task id="task_bad" xml:lang="en"><title>Bad</title><steps><step><cmd>Go</cmd></step></steps></task>',
      locale: 'en',
    });
    const guard = straySteps.issues.filter((issue) => issue.code === 'invalid-topic-root-child');
    expect(guard).toHaveLength(1);
    expect(guard[0]).toMatchObject({ severity: 'error', source: 'structure' });
    expect(guard[0]?.message).toContain('<steps>');
    expect(straySteps.ok).toBe(false);

    const straySection = validateTopicLayer1({
      node: taskNode,
      xml: '<task id="task_bad" xml:lang="en"><title>Bad</title><section><p>Text</p></section></task>',
      locale: 'en',
    });
    expect(straySection.issues.some((issue) => issue.code === 'invalid-topic-root-child')).toBe(true);

    const customized = validateTopicLayer1({
      node: makeNode(),
      xml: [
        '<concept id="concept_overview" xml:lang="en"><title>Product Overview</title>',
        '<my-custom-widget><p>Specialized</p></my-custom-widget>',
        '<conbody><p>Text</p></conbody></concept>',
      ].join(''),
      locale: 'en',
    });
    expect(customized.issues.some((issue) => issue.code === 'invalid-topic-root-child')).toBe(false);
  });

  it('accepts legal task roots whose content lives inside <taskbody>', () => {
    const node = makeNode({ topicId: 'task_ok', title: 'Ok', type: 'task', filePath: 'tasks/ok.dita' });
    const result = validateTopicLayer1({
      node,
      xml: [
        '<task id="task_ok" xml:lang="en"><title>Ok</title><shortdesc>Short</shortdesc>',
        '<taskbody><prereq><p>Ready</p></prereq><steps><step><cmd>Go</cmd></step></steps>',
        '<result><p>Done</p></result></taskbody></task>',
      ].join(''),
      locale: 'en',
    });
    expect(result.issues.some((issue) => issue.code === 'invalid-topic-root-child')).toBe(false);
  });
});

describe('layer 2 tool agent', () => {
  it('repairs three broken topics in one pass (lax scan, batch writes, strict verify)', async () => {
    const nodes = [
      makeNode({ topicId: 'concept_a', title: 'A', filePath: 'concepts/a.dita' }),
      makeNode({ topicId: 'concept_b', title: 'B', filePath: 'concepts/b.dita' }),
      makeNode({ topicId: 'concept_c', title: 'C', filePath: 'concepts/c.dita' }),
    ];
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: nodes });
    const broken = nodes.map((node) => conceptXml(node.topicId, node.title, `<p>${BROKEN_MARKER}</p>`));
    const fixed = nodes.map((node, index) => conceptXml(node.topicId, node.title, `<p>Fixed ${index + 1}</p>`));
    const artifacts = nodes.map((node, index) => makeArtifact(node, broken[index]!));

    const counts = { strict: 0, lax: 0 };
    const strictValidator = countingValidator(stagingValidator(), counts);
    const repairs: Array<{ filePath: string; attempt: number }> = [];
    const statuses: Array<{ filePath: string; status: string }> = [];
    const callbacks: IngestAgentCallbacks = {
      onLayer2Repair: (info) => repairs.push({ filePath: info.filePath, attempt: info.attempt }),
      onTopicStatus: (update) => statuses.push({ filePath: update.filePath, status: update.status }),
    };

    const script = toolScriptedModel([
      [{ name: 'dita_ot_validate', args: { mode: 'lax' } }],
      nodes.map((node) => ({ name: 'read_staged_file', args: { path: node.filePath } })),
      nodes.map((node, index) => ({
        name: 'write_staged_file',
        args: { path: node.filePath, xml: fixed[index]! },
      })),
      [{ name: 'dita_ot_validate', args: { mode: 'strict' } }],
      [],
    ]);

    const result = await validateAndRepairBatch(
      { plan, artifacts, callbacks },
      makeDeps(script.factory, strictValidator),
      makeContext(),
    );

    expect(result.validationReport.layer2.status).toBe('passed');
    expect(result.validationReport.ok).toBe(true);
    // 1 outer strict + 1 outer lax pre-scan + 1 agent lax + 1 agent strict; no final gate needed.
    expect(counts).toEqual({ strict: 2, lax: 2 });
    expect(repairs.map((entry) => entry.filePath)).toEqual([
      'concepts/a.dita',
      'concepts/b.dita',
      'concepts/c.dita',
    ]);
    expect(repairs.every((entry) => entry.attempt === 1)).toBe(true);
    expect(result.artifacts.map((artifact) => artifact.repairAttempts)).toEqual([1, 1, 1]);
    expect(result.artifacts.every((artifact) => artifact.repaired)).toBe(true);
    const doneTopics = statuses.filter((entry) => entry.status === 'done').map((entry) => entry.filePath);
    expect([...new Set(doneTopics)].sort()).toEqual(['concepts/a.dita', 'concepts/b.dita', 'concepts/c.dita']);
    expect(
      usageRows().some((row) => row.task_type === 'ingest_repair' && row.sub_action === 'layer2_agent'),
    ).toBe(true);
  });

  it('repairs the generated map across files and returns it as fileOverrides', async () => {
    const node = makeNode();
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: [node] });
    const artifact = makeArtifact(node, conceptXml('concept_overview', 'Product Overview', '<p>Text</p>'));
    const repairedMap = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
      '<map id="demo_manual" xml:lang="en">',
      '  <title>Demo Manual</title>',
      '  <topicmeta><navtitle>Demo Manual</navtitle></topicmeta>',
      '  <topicref href="concepts/overview.dita"/>',
      '</map>',
      '',
    ].join('\n');

    const counts = { strict: 0, lax: 0 };
    const script = toolScriptedModel([
      [{ name: 'read_staged_file', args: { path: 'demo-manual.ditamap' } }],
      [{ name: 'write_staged_file', args: { path: 'demo-manual.ditamap', xml: repairedMap } }],
      [{ name: 'dita_ot_validate', args: { mode: 'strict' } }],
      [],
    ]);

    const result = await validateAndRepairBatch(
      { plan, artifacts: [artifact] },
      makeDeps(script.factory, countingValidator(stagingValidator({ requireMapNavtitle: true }), counts)),
      makeContext(),
    );

    expect(result.validationReport.layer2.status).toBe('passed');
    expect(result.repairedFiles?.['demo-manual.ditamap']).toBe(repairedMap);
    expect(result.validationReport.ok).toBe(true);
  });

  it('runs a deterministic strict gate when the agent stops without verifying', async () => {
    const node = makeNode();
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: [node] });
    const artifact = makeArtifact(node, conceptXml('concept_overview', 'Product Overview', `<p>${BROKEN_MARKER}</p>`));

    const counts = { strict: 0, lax: 0 };
    const script = toolScriptedModel([
      [{ name: 'read_staged_file', args: { path: node.filePath } }],
      [],
    ]);

    const result = await validateAndRepairBatch(
      { plan, artifacts: [artifact] },
      makeDeps(script.factory, countingValidator(stagingValidator(), counts)),
      makeContext(),
    );

    expect(result.validationReport.layer2.status).toBe('failed');
    expect(result.validationReport.ok).toBe(false);
    // 1 initial strict + 1 final gate strict.
    expect(counts).toEqual({ strict: 2, lax: 0 });
    expect(result.validationReport.layer2.issues.some((issue) => issue.code === 'DOTJ013E')).toBe(true);
  });

  it('stops early when two validations report the same errors (no-progress breaker)', async () => {
    const node = makeNode();
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: [node] });
    const artifact = makeArtifact(node, conceptXml('concept_overview', 'Product Overview', `<p>${BROKEN_MARKER}</p>`));

    const counts = { strict: 0, lax: 0 };
    const script = toolScriptedModel([
      [{ name: 'dita_ot_validate', args: { mode: 'lax' } }],
      [{ name: 'dita_ot_validate', args: { mode: 'lax' } }],
      // Unreachable: the breaker must stop before this batch.
      [{ name: 'dita_ot_validate', args: { mode: 'lax' } }],
      [],
    ]);

    const result = await validateAndRepairBatch(
      { plan, artifacts: [artifact] },
      makeDeps(script.factory, countingValidator(stagingValidator(), counts)),
      makeContext(),
    );

    expect(script.counter.steps).toBe(2);
    expect(result.validationReport.layer2.status).toBe('failed');
    expect(counts.strict).toBe(2);
  });

  it('aborts cleanly while the tool agent is running', async () => {
    const controller = new AbortController();
    const node = makeNode();
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: [node] });
    const artifact = makeArtifact(node, conceptXml('concept_overview', 'Product Overview', `<p>${BROKEN_MARKER}</p>`));

    const script = toolScriptedModel(
      [
        [{ name: 'read_staged_file', args: { path: node.filePath } }],
        [{ name: 'dita_ot_validate', args: { mode: 'lax' } }],
      ],
      {
        beforeStep: (step) => {
          if (step === 2) controller.abort();
        },
      },
    );

    await expect(
      validateAndRepairBatch(
        { plan, artifacts: [artifact] },
        makeDeps(script.factory, stagingValidator()),
        makeContext({ signal: controller.signal }),
      ),
    ).rejects.toBeInstanceOf(IngestAgentAbortedError);
  });

  it('gives every topic its own repair budget when DITA-OT fails fast', async () => {
    // Regression for the real 20-topic import: a global 2-round cap starved the third broken topic.
    const nodes = [
      makeNode({ topicId: 'concept_a', title: 'A', filePath: 'concepts/a.dita' }),
      makeNode({ topicId: 'concept_b', title: 'B', filePath: 'concepts/b.dita' }),
      makeNode({ topicId: 'concept_c', title: 'C', filePath: 'concepts/c.dita' }),
    ];
    const plan = makePlan({ rootMapPath: 'demo-manual.ditamap', topics: nodes });
    const artifacts = nodes.map((node) => makeArtifact(node, conceptXml(node.topicId, node.title, `<p>${BROKEN_MARKER}</p>`)));
    const repairs = nodes.map((node, index) => conceptXml(node.topicId, node.title, `<p>Fixed ${index + 1}</p>`));

    const counts = { strict: 0, lax: 0 };
    const strictValidator = countingValidator(stagingValidator({ reportFirstOnly: true }), counts);
    // No `bindTools` on this model: the deterministic fallback must carry the batch.
    const script = scriptedModel({ repair: repairs });

    const result = await validateAndRepairBatch(
      { plan, artifacts, maxLayer2Retries: 2 },
      makeDeps(script.factory, strictValidator),
      makeContext(),
    );

    expect(result.validationReport.layer2.status).toBe('passed');
    expect(result.validationReport.ok).toBe(true);
    expect(result.artifacts.map((artifact) => artifact.repairAttempts)).toEqual([1, 1, 1]);
    expect(script.calls.repair).toBe(3);
    // 1 initial strict + 3 confirming strict runs (one per repaired topic).
    expect(counts.strict).toBe(4);
  });
});
