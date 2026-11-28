import { z } from 'zod';
import type { AlignedTranslationSegment, GlossaryMatchHit, TranslationQaIssue } from '@dita/core';
import type { TranslationLinkRow } from '../../db/schema.js';
import type { AiModelFactory } from '../ai/ai-model-factory.js';
import type { AiSettingsService } from '../ai/ai-settings-service.js';
import type { AiUsageService } from '../ai/ai-usage-service.js';
import type { IdentityUser } from '../identity/identity-service.js';
import {
  ZERO_USAGE,
  addUsage,
  buildMessages,
  describeError,
  describeGlossaryHit,
  isAbortError,
  messageText,
  readUsage,
  type TokenUsage,
} from './ai-translator.js';
import type { TranslationAiReviewCategory, TranslationAiReviewIssue } from './types.js';

/**
 * Phase 16 — the independent Reviewer AI.
 *
 * The reviewer never rewrites a document: it reads one proposed target block together with its
 * source block, the glossary entries the translator had to honour, and the deterministic QA
 * findings, and answers with strict JSON findings. That separation is the whole point of the dual
 * AI loop: a second, colder model catches what the translator itself cannot see.
 *
 * The reviewer config is resolved through `AiSettingsService.resolveReviewerConfig()`, so it
 * inherits the primary model unless the admin configured a dedicated reviewer base URL / model /
 * key / temperature. Reviewer failures never discard a translation: they degrade to
 * `verdict: 'error'` so the proposal still reaches the human reviewer.
 */

/** Soft cap per review call (source + target characters of the reviewed blocks). */
export const MAX_REVIEW_BATCH_CHARS = 6_000;

/** One model attempt plus one format-repair retry. */
const MAX_FORMAT_ATTEMPTS = 2;

export const aiReviewCategorySchema = z.enum([
  'accuracy',
  'omission',
  'terminology',
  'markup',
  'style',
  'qa_violation',
]);

export const aiReviewIssueSchema = z.object({
  segmentId: z.string().trim().min(1).max(200),
  severity: z.enum(['error', 'warning']),
  category: aiReviewCategorySchema,
  message: z.string().trim().min(1).max(1_500),
  suggestion: z.string().trim().max(1_500).default(''),
});

export const aiReviewReplySchema = z.object({
  verdict: z.enum(['pass', 'revise']),
  summary: z.string().trim().max(2_000).default(''),
  issues: z.array(aiReviewIssueSchema).max(80).default([]),
});
export type AiReviewReply = z.infer<typeof aiReviewReplySchema>;

/** One block handed to the reviewer. */
export interface ReviewSegmentBundle {
  segment: AlignedTranslationSegment;
  /** Glossary entries matched inside the source block. */
  hits: GlossaryMatchHit[];
  /** Deterministic QA findings for this block (empty when the block is clean). */
  qaIssues: TranslationQaIssue[];
}

export interface ReviewSegmentsInput {
  link: TranslationLinkRow;
  sourcePath: string;
  user: IdentityUser;
  bundles: ReviewSegmentBundle[];
  /** `qa_review` for the first pass, `qa_recheck` for the post-repair confirmation pass. */
  subAction: 'qa_review' | 'qa_recheck';
  customInstruction?: string;
  signal?: AbortSignal;
}

export interface ReviewSegmentsResult {
  verdict: 'pass' | 'revise' | 'error';
  summary: string;
  issues: TranslationAiReviewIssue[];
  model: string | null;
  isDedicatedModel: boolean;
  /** Model calls performed (batches × attempts). */
  rounds: number;
  usage: TokenUsage;
}

export interface AiTranslationReviewerOptions {
  aiSettings: AiSettingsService;
  aiUsage: AiUsageService;
  modelFactory: AiModelFactory;
}

function buildReviewSystemPrompt(
  sourceLang: string,
  targetLang: string,
  customInstruction?: string,
): string {
  const lines = [
    `You are an independent DITA 1.3 technical translation reviewer for ${sourceLang} → ${targetLang}.`,
    'You do NOT translate and you NEVER rewrite or return XML documents: you only review the',
    'proposed target blocks you are given and report concrete, actionable findings.',
    '',
    'Answer with ONE JSON object and nothing else (no prose, no markdown fences):',
    '{"verdict":"pass"|"revise","summary":"one or two sentences",',
    ' "issues":[{"segmentId":"…","severity":"error"|"warning",',
    '  "category":"accuracy"|"omission"|"terminology"|"markup"|"style"|"qa_violation",',
    '  "message":"what is wrong","suggestion":"how to fix it"}]}',
    '',
    'Severity rules:',
    '- "error": the block would mislead a reader or breaks a hard rule — wrong or missing meaning,',
    '  omitted content, a forbidden glossary target, a missing mandated glossary target, changed or',
    '  dropped inline DITA markup/attributes, translated do-not-translate text, a lost placeholder,',
    '  or an unresolved deterministic QA finding listed for that block.',
    '- "warning": a legitimate but improvable style/terminology choice.',
    '- Every issue must repeat the exact segmentId of the block it belongs to.',
    '- Use verdict "pass" with an empty issue list when nothing is worth reporting.',
  ];
  const instruction = customInstruction?.trim();
  if (instruction) {
    lines.push('', 'Additional project instruction to honour while reviewing:', instruction);
  }
  return lines.join('\n');
}

function describeQaIssue(issue: TranslationQaIssue): string {
  const detail =
    issue.expected !== undefined || issue.actual !== undefined
      ? ` (expected: ${issue.expected ?? '—'}; actual: ${issue.actual ?? '—'})`
      : '';
  return `- [${issue.severity}] ${issue.code}: ${issue.message}${detail}`;
}

function describeReviewSegment(bundle: ReviewSegmentBundle): string {
  const segment = bundle.segment;
  const attrs = [`id="${segment.segmentId}"`, `tag="${segment.elementTag}"`];
  if (segment.attributeName) attrs.push(`attr="${segment.attributeName}"`);
  const lines = [`<rsegment ${attrs.join(' ')}>`];
  lines.push(`<source>${segment.currSourceXml}</source>`);
  lines.push(`<target>${segment.proposedTargetXml ?? ''}</target>`);
  const glossary = new Set<string>();
  for (const hit of bundle.hits) glossary.add(describeGlossaryHit(hit));
  if (glossary.size > 0) {
    lines.push('<glossary>');
    for (const entry of glossary) lines.push(entry);
    lines.push('</glossary>');
  }
  if (bundle.qaIssues.length > 0) {
    lines.push('<qa_issues>');
    for (const issue of bundle.qaIssues) lines.push(describeQaIssue(issue));
    lines.push('</qa_issues>');
  }
  lines.push('</rsegment>');
  return lines.join('\n');
}

function buildReviewHumanPrompt(
  bundles: ReviewSegmentBundle[],
  targetLang: string,
  reminder?: string,
): string {
  const lines: string[] = [`Target language: ${targetLang}`, ''];
  if (reminder) {
    lines.push('Your previous reply could not be parsed. Answer with the JSON object only.', reminder, '');
  }
  lines.push(`Blocks to review (${bundles.length}):`);
  lines.push('<reviewsegments>');
  for (const bundle of bundles) lines.push(describeReviewSegment(bundle));
  lines.push('</reviewsegments>');
  lines.push('');
  lines.push('Reply with the JSON object only.');
  return lines.join('\n');
}

/** Greedy, order-preserving batching over the reviewed source + target text. */
function buildReviewBatches(
  bundles: ReviewSegmentBundle[],
  maxChars = MAX_REVIEW_BATCH_CHARS,
): ReviewSegmentBundle[][] {
  const batches: ReviewSegmentBundle[][] = [];
  let current: ReviewSegmentBundle[] = [];
  let size = 0;
  for (const bundle of bundles) {
    const weight = Math.max(
      bundle.segment.currSourceXml.length + (bundle.segment.proposedTargetXml?.length ?? 0),
      1,
    );
    if (current.length > 0 && size + weight > maxChars) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(bundle);
    size += weight;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Strips markdown fences and slices out the outermost JSON object. */
function extractJsonObject(reply: string): string | null {
  let text = reply.trim();
  const fence = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/;
  const fenced = fence.exec(text);
  if (fenced?.[1] !== undefined) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseReviewReply(reply: string): { ok: true; reply: AiReviewReply } | { ok: false; error: string } {
  const json = extractJsonObject(reply);
  if (!json) return { ok: false, error: 'the reply contained no JSON object' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { ok: false, error: `the reply was not valid JSON (${describeError(error)})` };
  }
  const parsed = aiReviewReplySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join('.') ?? 'root';
    return { ok: false, error: `the JSON did not match the review contract at ${path}: ${first?.message ?? 'invalid'}` };
  }
  return { ok: true, reply: parsed.data };
}

export class AiTranslationReviewer {
  private readonly aiSettings: AiSettingsService;
  private readonly aiUsage: AiUsageService;
  private readonly modelFactory: AiModelFactory;

  constructor(options: AiTranslationReviewerOptions) {
    this.aiSettings = options.aiSettings;
    this.aiUsage = options.aiUsage;
    this.modelFactory = options.modelFactory;
  }

  /**
   * Reviews every bundle and folds the per-batch answers into one report.
   *
   * A reviewer failure (model error or unparsable reply after the format retry) degrades to
   * `verdict: 'error'` and keeps whatever findings the successful batches produced — the proposal
   * itself is never thrown away because of the reviewer.
   */
  async reviewSegments(input: ReviewSegmentsInput): Promise<ReviewSegmentsResult> {
    const bundles = input.bundles.filter(
      (bundle) => bundle.segment.proposedTargetXml !== undefined,
    );
    if (bundles.length === 0) {
      return {
        verdict: 'pass',
        summary: 'No translated blocks needed review.',
        issues: [],
        model: null,
        isDedicatedModel: false,
        rounds: 0,
        usage: ZERO_USAGE,
      };
    }

    const startedAt = Date.now();
    const config = this.aiSettings.resolveReviewerConfig();
    const model = this.modelFactory(config);
    const system = buildReviewSystemPrompt(
      input.link.sourceLang,
      input.link.targetLang,
      input.customInstruction,
    );
    const knownSegments = new Set(bundles.map((bundle) => bundle.segment.segmentId));

    let usage = ZERO_USAGE;
    let rounds = 0;
    let verdict: 'pass' | 'revise' | 'error' = 'pass';
    const issues: TranslationAiReviewIssue[] = [];
    const summaries: string[] = [];
    let failure: string | null = null;

    for (const batch of buildReviewBatches(bundles)) {
      let reminder: string | undefined;
      let accepted: AiReviewReply | null = null;
      let lastError: string | null = null;
      for (let attempt = 0; attempt < MAX_FORMAT_ATTEMPTS && accepted === null; attempt += 1) {
        const human = buildReviewHumanPrompt(batch, input.link.targetLang, reminder);
        rounds += 1;
        let reply: string;
        try {
          const message = await model.invoke(buildMessages(system, human), {
            ...(input.signal ? { signal: input.signal } : {}),
          });
          usage = addUsage(usage, readUsage(message));
          reply = messageText(message.content);
        } catch (error) {
          if (isAbortError(error, input.signal)) throw error;
          lastError = describeError(error);
          break;
        }
        const parsed = parseReviewReply(reply);
        if (parsed.ok) {
          accepted = parsed.reply;
          break;
        }
        lastError = parsed.error;
        reminder =
          'Expected shape: {"verdict":"pass"|"revise","summary":"…","issues":[{"segmentId":"…","severity":"error"|"warning","category":"accuracy"|"omission"|"terminology"|"markup"|"style"|"qa_violation","message":"…","suggestion":"…"}]}';
      }

      if (!accepted) {
        verdict = 'error';
        failure = failure ?? (lastError ?? 'the reviewer returned no usable answer');
        continue;
      }
      if (accepted.verdict === 'revise') verdict = 'revise';
      if (accepted.summary.trim()) summaries.push(accepted.summary.trim());
      for (const issue of accepted.issues) {
        // A reviewer may only report on blocks it was given; anything else is dropped so the repair
        // loop can never be pointed at an untouched block.
        if (!knownSegments.has(issue.segmentId)) continue;
        issues.push({
          segmentId: issue.segmentId,
          severity: issue.severity,
          category: issue.category as TranslationAiReviewCategory,
          message: issue.message,
          suggestion: issue.suggestion,
        });
      }
    }

    // A revise verdict is only meaningful with at least one finding.
    if (verdict === 'revise' && issues.length === 0) verdict = 'pass';
    const summary =
      verdict === 'error'
        ? `Reviewer AI failed: ${failure ?? 'unknown error'}. The translation proposal was preserved.`
        : summaries.length > 0
          ? summaries.join(' ')
          : verdict === 'revise'
            ? `${issues.length} review finding(s) need repair.`
            : 'The reviewer found no blocking issues.';

    this.recordUsage(input, config.model, usage, rounds, verdict, failure, Date.now() - startedAt);

    return {
      verdict,
      summary,
      issues,
      model: config.model,
      isDedicatedModel: config.isDedicated,
      rounds,
      usage,
    };
  }

  private recordUsage(
    input: ReviewSegmentsInput,
    model: string,
    usage: TokenUsage,
    rounds: number,
    verdict: 'pass' | 'revise' | 'error',
    failure: string | null,
    durationMs: number,
  ): void {
    try {
      this.aiUsage.record({
        projectId: input.link.targetManualId,
        branch: input.link.targetBranch,
        userId: input.user.id,
        userDisplayName: input.user.displayName,
        taskType: 'translate_review',
        subAction: input.subAction,
        filePath: input.sourcePath,
        model,
        status: verdict === 'error' ? 'failed' : 'succeeded',
        retryCount: Math.max(0, rounds - 1),
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs,
        errorMessage: verdict === 'error' ? failure : null,
      });
    } catch {
      // Usage accounting must never break a translation run.
    }
  }
}
