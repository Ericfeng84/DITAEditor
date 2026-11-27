/**
 * Planner role — Markdown outline → validated `IngestOutlinePlan`.
 *
 * The Planner is the only role allowed to invent structure (paths, titles, topic types). It never
 * writes DITA XML: the Writer consumes its plan, and `normalizePlanPaths()` keeps the result
 * collision-free with the branch work tree.
 */

import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import {
  buildFallbackOutlinePlan,
  buildPlannerOutlineDigest,
  normalizePlanPaths,
  parseMarkdownOutline,
  type DitaMapTemplateType,
  type DitaTopicTemplateType,
  type IngestDiagnosticItem,
  type IngestOutlinePlan,
  type IngestSuggestedKey,
  type MarkdownSection,
  type PlannedTopicNode,
} from '@dita/core';
import { z, type ZodTypeDef } from 'zod';
import type { ResolvedAiConfig } from '../../ai/ai-settings-service.js';
import {
  IngestAgentAbortedError,
  throwIfAborted,
  type IngestAgentContext,
  type IngestAgentDeps,
  type PlanOutlineInput,
  type PlanOutlineResult,
} from './types.js';

/** Bytes/chars of model output kept out of usage rows and logs. */
const MAX_PROMPT_SECTIONS = 600;
const MAX_SUGGESTED_KEYS = 200;

/** Raw (pre-coercion) topic shape accepted from the model; every field except `title` is optional. */
interface RawPlannedTopic {
  topicId?: string;
  title: string;
  type?: DitaTopicTemplateType;
  filePath?: string;
  navTitle?: string;
  summary?: string;
  sectionIds?: string[];
  children?: RawPlannedTopic[];
}

/** Raw (pre-coercion) plan shape accepted from the model. */
interface RawPlanShape {
  title: string;
  language?: string;
  mapKind?: DitaMapTemplateType;
  rootMapPath?: string;
  topicType?: DitaTopicTemplateType | 'auto';
  summary?: string;
  createKeysMap?: boolean;
  suggestedKeys?: Array<{ keys: string; keyword?: string }>;
  topics: RawPlannedTopic[];
}

const topicSchema: z.ZodType<RawPlannedTopic, ZodTypeDef, unknown> = z.lazy(() =>
  z.object({
    topicId: z.string().max(200).optional(),
    title: z.string().min(1).max(400),
    type: z.enum(['concept', 'task', 'reference', 'topic']).optional(),
    filePath: z.string().max(600).optional(),
    navTitle: z.string().max(400).optional(),
    summary: z.string().max(4_000).optional(),
    sectionIds: z.array(z.string().max(120)).max(500).optional(),
    children: z.array(topicSchema).max(200).optional(),
  }),
);

const planSchema: z.ZodType<RawPlanShape, ZodTypeDef, unknown> = z.object({
  title: z.string().min(1).max(400),
  language: z.string().max(40).optional(),
  mapKind: z.enum(['map']).optional(),
  rootMapPath: z.string().max(600).optional(),
  topicType: z.enum(['concept', 'task', 'reference', 'topic', 'auto']).optional(),
  summary: z.string().max(4_000).optional(),
  createKeysMap: z.boolean().optional(),
  suggestedKeys: z
    .array(z.object({ keys: z.string().min(1).max(128), keyword: z.string().max(400).optional() }))
    .max(MAX_SUGGESTED_KEYS)
    .optional(),
  topics: z.array(topicSchema).min(1).max(MAX_PROMPT_SECTIONS),
});

/** A model reply that parsed as JSON but violates the plan contract (mode/shape mismatch). */
class PlanShapeError extends Error {}

/**
 * Plans the DITA outline for one Markdown import.
 *
 * Flow: compact outline digest → LLM JSON (one retry with exact error feedback) → Zod validation →
 * target-mode enforcement → `normalizePlanPaths()`. Any persistent failure degrades to
 * `buildFallbackOutlinePlan()` with a warning instead of throwing, so an import never dead-ends.
 */
export async function planDocumentOutline(
  input: PlanOutlineInput,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<PlanOutlineResult> {
  throwIfAborted(ctx.signal);
  const language = input.language ?? 'en';
  const warnings: string[] = [];
  const sections = parseMarkdownOutline(input.markdown);
  const digest = buildPlannerOutlineDigest(input.markdown, sections);

  const config = deps.settings.resolveConfig();
  if (!config.apiKey) {
    // No key configured: deterministic fallback, never a failed import.
    return withFallback('AI model is not configured (no API key).');
  }

  const messages: BaseMessage[] = [
    new SystemMessage(buildPlannerSystemPrompt(input, language)),
    new HumanMessage(buildPlannerUserPrompt(input, digest, language)),
  ];

  let lastError = '';
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    throwIfAborted(ctx.signal);
    try {
      const plan = await invokePlanner(config, messages, input, language, deps, ctx, attempt);
      input.callbacks?.onLog?.({
        level: 'info',
        message: `Planner produced ${plan.topics.length} root topic(s) for ${input.sourceFilename}.`,
      });
      return {
        plan: normalizePlanPaths(plan, { existingPaths: ctx.existingPaths, targetDir: input.targetDir }),
        usedFallback: false,
        warnings,
      };
    } catch (error) {
      if (error instanceof IngestAgentAbortedError) throw error;
      lastError = describeError(error);
      input.callbacks?.onLog?.({
        level: 'warn',
        message: `Planner attempt ${attempt + 1} failed: ${lastError}`,
      });
      messages.push(
        new AIMessage(
          'The previous reply could not be used. Reply again with the complete corrected JSON plan only.',
        ),
        new HumanMessage(
          [
            `Your previous reply was rejected: ${lastError}`,
            'Fix exactly that problem and reply with the full JSON object again.',
            'Do not explain, do not use markdown fences, and keep every topic non-empty.',
          ].join('\n'),
        ),
      );
    }
  }

  return withFallback(lastError);

  function withFallback(reason: string): PlanOutlineResult {
    warnings.push(`Planner fell back to the deterministic outline: ${reason}`);
    const plan = enforceTargetMode(
      buildFallbackOutlinePlan(input.markdown, {
        sourceFilename: input.sourceFilename,
        targetMode: input.targetMode,
        language,
        ...(input.mapKind ? { mapKind: input.mapKind } : {}),
        ...(input.topicType ? { topicType: input.topicType } : {}),
        ...(input.targetDir ? { targetDir: input.targetDir } : {}),
      }),
      input.targetMode,
      warnings,
    );
    return {
      plan: normalizePlanPaths(plan, { existingPaths: ctx.existingPaths, targetDir: input.targetDir }),
      usedFallback: true,
      warnings,
    };
  }
}

async function invokePlanner(
  config: ResolvedAiConfig,
  messages: BaseMessage[],
  input: PlanOutlineInput,
  language: string,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
  attempt: number,
): Promise<IngestOutlinePlan> {
  const model = deps.modelFactory(config);
  const startedAt = Date.now();
  let message: AIMessage;
  try {
    message = await model.invoke(messages);
    throwIfAborted(ctx.signal);
  } catch (error) {
    recordUsage(deps, ctx, {
      status: ctx.signal?.aborted ? 'cancelled' : 'failed',
      model: config.model,
      attempt,
      durationMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorMessage: describeError(error),
      subAction: input.targetMode,
    });
    throw error;
  }

  const usage = readUsage(message);
  const text = readMessageText(message);
  try {
    const plan = parseAndCoercePlan(text, input, language);
    recordUsage(deps, ctx, {
      status: 'succeeded',
      model: config.model,
      attempt,
      durationMs: Date.now() - startedAt,
      ...usage,
      subAction: input.targetMode,
    });
    return plan;
  } catch (error) {
    recordUsage(deps, ctx, {
      status: 'failed',
      model: config.model,
      attempt,
      durationMs: Date.now() - startedAt,
      ...usage,
      errorMessage: describeError(error),
      subAction: input.targetMode,
    });
    throw error;
  }
}

/**
 * Records planner usage. `taskType: 'ingest_plan'`, `subAction: targetMode` (never the document body).
 */
function recordUsage(
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
  input: {
    status: 'succeeded' | 'failed' | 'cancelled';
    model: string;
    attempt: number;
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    errorMessage?: string;
    subAction: string;
  },
): void {
  try {
    deps.usage.record({
      projectId: ctx.projectId,
      branch: ctx.branch,
      userId: ctx.user.id,
      userDisplayName: ctx.user.displayName,
      taskType: 'ingest_plan',
      subAction: input.subAction,
      filePath: null,
      model: input.model,
      status: input.status,
      retryCount: input.attempt,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      durationMs: input.durationMs,
      errorMessage: input.errorMessage ?? null,
    });
  } catch {
    // Usage accounting must never break an import.
  }
}

/** Tolerant JSON extraction: fenced ```json blocks, bare objects, or a `plan` wrapper. */
export function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fence = /```(?:json|JSON)?\s*\n?([\s\S]*?)```/u.exec(trimmed);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return candidate;
  return candidate.slice(start, end + 1);
}

function parseAndCoercePlan(raw: string, input: PlanOutlineInput, language: string): IngestOutlinePlan {
  const candidate = extractJsonCandidate(raw);
  let json: unknown;
  try {
    json = JSON.parse(candidate) as unknown;
  } catch (error) {
    throw new PlanShapeError(`Reply is not valid JSON (${describeError(error)}).`);
  }
  if (json && typeof json === 'object' && !Array.isArray(json) && !('topics' in json)) {
    const wrapped = (json as { plan?: unknown }).plan;
    if (wrapped && typeof wrapped === 'object') json = wrapped;
  }
  const parsed = planSchema.safeParse(json);
  if (!parsed.success) {
    throw new PlanShapeError(`Reply does not match the plan schema: ${summarizeZodError(parsed.error)}`);
  }
  const modeProblems = targetModeProblems(parsed.data.topics, input.targetMode);
  if (modeProblems.length > 0) throw new PlanShapeError(modeProblems.join(' '));

  return coercePlan(parsed.data, input, language);
}

function targetModeProblems(topics: readonly RawPlannedTopic[], mode: PlanOutlineInput['targetMode']): string[] {
  if (mode === 'single_topic' && topics.length !== 1) {
    return [`targetMode "single_topic" requires exactly 1 root topic but the reply had ${topics.length}.`];
  }
  if (mode === 'multi_topic' && topics.length < 1) {
    return ['targetMode "multi_topic" requires at least 1 root topic.'];
  }
  return [];
}

function coercePlan(raw: RawPlanShape, input: PlanOutlineInput, language: string): IngestOutlinePlan {
  const mapKind: DitaMapTemplateType = raw.mapKind ?? input.mapKind ?? 'map';
  const topicType: DitaTopicTemplateType | 'auto' = raw.topicType ?? input.topicType ?? 'auto';
  const plan: IngestOutlinePlan = {
    title: raw.title.trim(),
    language: raw.language?.trim() || language,
    targetMode: input.targetMode,
    mapKind,
    rootMapPath: (raw.rootMapPath ?? '').trim(),
    topicType,
    ...(input.targetDir ? { targetDir: input.targetDir } : {}),
    ...(raw.summary ? { summary: raw.summary } : {}),
    createKeysMap: raw.createKeysMap ?? defaultCreateKeysMap(input.targetMode),
    suggestedKeys: (raw.suggestedKeys ?? [])
      .filter((entry) => entry.keys.trim().length > 0)
      .slice(0, MAX_SUGGESTED_KEYS)
      .map<IngestSuggestedKey>((entry) => ({
        keys: entry.keys.trim(),
        keyword: entry.keyword?.trim() ?? '',
      })),
    topics: raw.topics.map((topic) => coerceTopic(topic, topicType)),
  };
  return plan;
}

function coerceTopic(raw: RawPlannedTopic, fallbackType: DitaTopicTemplateType | 'auto'): PlannedTopicNode {
  const type: DitaTopicTemplateType =
    raw.type ?? (fallbackType === 'auto' ? 'concept' : fallbackType);
  const node: PlannedTopicNode = {
    topicId: (raw.topicId ?? '').trim(),
    title: raw.title.trim(),
    type,
    filePath: (raw.filePath ?? '').trim(),
    ...(raw.navTitle ? { navTitle: raw.navTitle } : {}),
    ...(raw.summary ? { summary: raw.summary } : {}),
    ...(raw.sectionIds && raw.sectionIds.length > 0 ? { sectionIds: raw.sectionIds } : {}),
    ...(raw.children && raw.children.length > 0
      ? { children: raw.children.map((child) => coerceTopic(child, fallbackType)) }
      : {}),
  };
  return node;
}

/**
 * Guarantees the target-mode contract even for model plans/fallbacks.
 *
 * `single_topic` imports must produce exactly one self-contained topic: nested child topics are
 * folded away but their `sectionIds` are carried onto the parent, so no Markdown section is lost.
 */
export function enforceTargetMode(
  plan: IngestOutlinePlan,
  mode: PlanOutlineInput['targetMode'],
  warnings?: string[],
): IngestOutlinePlan {
  if (mode !== 'single_topic') return plan;
  const first = plan.topics[0];
  if (!first) return plan;
  if (plan.topics.length === 1 && (!first.children || first.children.length === 0)) return plan;

  const collected = new Set<string>(first.sectionIds ?? []);
  const walk = (nodes: readonly PlannedTopicNode[]): void => {
    for (const node of nodes) {
      for (const id of node.sectionIds ?? []) collected.add(id);
      if (node.children) walk(node.children);
    }
  };
  walk(first.children ?? []);
  const { children: _children, ...rest } = first;
  warnings?.push(
    plan.topics.length > 1
      ? `single_topic import folded ${plan.topics.length} planned topics into one topic.`
      : 'single_topic import folded child topics into one topic.',
  );
  return {
    ...plan,
    topics: [{ ...rest, ...(collected.size > 0 ? { sectionIds: [...collected] } : {}) }],
  };
}

function defaultCreateKeysMap(mode: PlanOutlineInput['targetMode']): boolean {
  return mode === 'new_manual';
}

function buildPlannerSystemPrompt(input: PlanOutlineInput, language: string): string {
  const modeRules =
    input.targetMode === 'single_topic'
      ? [
          '- targetMode is "single_topic": emit EXACTLY ONE root topic and no nested children.',
          '- Put every relevant markdown section id in that topic\'s "sectionIds".',
        ]
      : input.targetMode === 'multi_topic'
        ? [
            '- targetMode is "multi_topic": emit one root topic per major section (1 or more).',
            '- Nest sub-topics in "children" only when the content is genuinely subordinate.',
          ]
        : [
            '- targetMode is "new_manual": emit the full map hierarchy for a new manual.',
            '- Use "children" for chapters/sections and 2-8 root topics unless the document is tiny.',
            '- Set "createKeysMap" true and provide up to 12 "suggestedKeys" when product names repeat.',
          ];

  return [
    'You are the Planning agent of a DITA 1.3 authoring workbench.',
    'You convert a Markdown document outline into a topic plan. You never write XML.',
    '',
    'Reply with ONE JSON object and nothing else (no prose, no markdown fences) shaped like:',
    '{',
    '  "title": "Manual or topic title",',
    `  "language": "${language}",`,
    '  "mapKind": "map",',
    '  "rootMapPath": "product-manual.ditamap",',
    '  "topicType": "concept" | "task" | "reference" | "topic" | "auto",',
    '  "summary": "one sentence",',
    '  "createKeysMap": true,',
    '  "suggestedKeys": [{ "keys": "prod_name", "keyword": "Product Name" }],',
    '  "topics": [',
    '    {',
    '      "topicId": "concept_overview",',
    '      "title": "Overview",',
    '      "type": "concept",',
    '      "filePath": "concepts/overview.dita",',
    '      "navTitle": "Overview",',
    '      "summary": "one sentence",',
    '      "sectionIds": ["sec_001"],',
    '      "children": []',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Every topic needs a non-empty "title", a stable snake_case "topicId", and a unique relative',
    '  "filePath" (concepts/, tasks/, reference/, topics/).',
    '- Cover the whole document: assign every markdown section id to exactly one topic.',
    '- Prefer "task" for procedures, "reference" for tables/parameter lists, "concept" otherwise.',
    ...modeRules,
    '- Output must be valid JSON: double quotes, no trailing commas, no comments.',
  ].join('\n');
}

function buildPlannerUserPrompt(input: PlanOutlineInput, digest: string, language: string): string {
  const lines = [
    `Source file: ${input.sourceFilename}`,
    `targetMode: ${input.targetMode}`,
    `language: ${language}`,
  ];
  if (input.mapKind) lines.push(`requested mapKind: ${input.mapKind}`);
  if (input.topicType && input.topicType !== 'auto') lines.push(`requested topicType: ${input.topicType}`);
  if (input.targetDir) lines.push(`target directory: ${input.targetDir}`);
  if (input.maxTopics) lines.push(`soft maximum root topics: ${input.maxTopics}`);
  if (input.instruction?.trim()) lines.push(`author instruction: ${input.instruction.trim()}`);
  lines.push('', 'Markdown outline (line numbers and section ids are authoritative):', digest);
  return lines.join('\n');
}

function readUsage(message: AIMessage): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const usage = message.usage_metadata;
  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
  };
}

function readMessageText(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
  }
  return String(content ?? '');
}

function summarizeZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Re-exported for the service layer so plan digests stay in one place. */
export function outlineSectionsForPrompt(markdown: string): MarkdownSection[] {
  return parseMarkdownOutline(markdown);
}
