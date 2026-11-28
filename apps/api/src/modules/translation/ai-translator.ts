import { HumanMessage, SystemMessage, type BaseMessage } from '@langchain/core/messages';
import {
  assembleTranslatedXml,
  checkXmlWellFormed,
  extractPlainText,
  extractTranslatableSegments,
  matchGlossaryTerms,
  parseXml,
  planIncrementalTranslation,
  runTranslationQa,
  xmlToPmDoc,
  type AlignedTranslationSegment,
  type GlossaryEntryForMatch,
  type GlossaryMatchHit,
  type TranslationQaIssue,
} from '@dita/core';
import type { TranslationLinkRow } from '../../db/schema.js';
import type { AiModelFactory } from '../ai/ai-model-factory.js';
import type { AiSettingsService } from '../ai/ai-settings-service.js';
import type { AiUsageService } from '../ai/ai-usage-service.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { AiTranslationReviewer } from './ai-reviewer.js';
import {
  summarizeQaIssues,
  type TranslationAiReviewIssue,
  type TranslationAiReviewReport,
  type TranslationDitaOtDiagnostic,
  type TranslationJobMode,
  type TranslationQaReport,
} from './types.js';

/**
 * Phase 16 Stage 3 — the block-level AI translation orchestrator.
 *
 * The orchestrator is deliberately free of persistence: it receives the three files of the
 * three-way diff (`S0` / `S1` / `T0`), returns one assembled proposal plus its segment list and QA
 * report, and records token usage. The queue service owns SQLite, Git and abort wiring, so the
 * same class can serve a queued job, a manual re-run and a single-block refinement.
 *
 * Token economy is a hard requirement: unchanged blocks reuse `T0` verbatim and never reach the
 * model, protected blocks (`codeph`, `conref`, `translate="no"`, …) are copied from `S1`, and a
 * batch that is already fully translated never calls the model at all.
 */

/** Soft cap per model call: ~6,000 characters of source text (§3.3). */
const MAX_BATCH_CHARS = 6_000;

/** Tag the model must use for each translated block. */
const BLOCK_TAG = 'tblock';

/** Phase 16: targeted QA repair rounds per file (clamped 0..3). */
const DEFAULT_MAX_QA_REPAIR_ROUNDS = 2;

const TBLOCK_PATTERN =
  /<tblock\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/tblock>/g;

export interface TranslateDocumentInput {
  link: TranslationLinkRow;
  sourcePath: string;
  /** `S1` — the current source file. */
  sourceXml: string;
  /** `S0` — the previously translated source snapshot. */
  prevSourceXml?: string | null;
  /** `T0` — the current target-language file. */
  prevTargetXml?: string | null;
  mode: TranslationJobMode;
  customInstruction?: string;
  user: IdentityUser;
  signal?: AbortSignal;
  /** Phase 16: run the independent reviewer AI (default `true`). */
  aiReviewEnabled?: boolean;
  /** Phase 16: targeted repair rounds, clamped to `0..3` (default `2`). */
  maxQaRepairRounds?: number;
  /** Phase 16: lets the queue surface `AI 审查修复中` while the reviewer/repair loop runs. */
  onPhaseChange?: (phase: 'ai_translating' | 'ai_reviewing') => void;
}

export interface TranslateDocumentResult {
  proposedXml: string;
  segments: AlignedTranslationSegment[];
  qaReport: TranslationQaReport;
  modeUsed: TranslationJobMode;
  /** Segments that consumed no AI tokens (unchanged reuse + protected passthrough). */
  reusedSegments: number;
  translatedSegments: number;
  warnings: string[];
  structuralDivergence: boolean;
  /** Phase 16: reviewer verdict, repair statistics and the remaining QA findings. */
  aiReview: TranslationAiReviewReport;
}

export interface RefineSegmentInput {
  link: TranslationLinkRow;
  sourcePath: string;
  segment: AlignedTranslationSegment;
  instruction: string;
  currentTargetXml?: string | null;
  user: IdentityUser;
  signal?: AbortSignal;
}

export interface RefineSegmentResult {
  segmentId: string;
  proposedTargetXml: string;
  proposedTargetText: string;
  qaIssues: TranslationQaIssue[];
}

/** One block the QA repair loop wants rewritten, with every finding that applies to it. */
export interface RepairSegmentRequest {
  segment: AlignedTranslationSegment;
  hits: GlossaryMatchHit[];
  qaIssues: TranslationQaIssue[];
  reviewIssues: TranslationAiReviewIssue[];
}

export interface RepairSegmentsInput {
  link: TranslationLinkRow;
  sourcePath: string;
  user: IdentityUser;
  requests: RepairSegmentRequest[];
  customInstruction?: string;
  signal?: AbortSignal;
}

export interface RepairDocumentForDitaOtInput {
  link: TranslationLinkRow;
  sourcePath: string;
  user: IdentityUser;
  /** `S1` — the source document, the semantic reference for the repair. */
  sourceXml: string;
  /** The target proposal DITA-OT rejected. */
  proposedXml: string;
  filePath: string;
  sourceLang: string;
  targetLang: string;
  ditaOtDiagnostics: TranslationDitaOtDiagnostic[];
  glossary?: GlossaryEntryForMatch[];
  customInstruction?: string;
  signal?: AbortSignal;
}

export interface RepairDocumentForDitaOtResult {
  repaired: boolean;
  /** Always safe to write: the original proposal whenever the repair failed a guard. */
  xml: string;
  message?: string;
}

export interface AiTranslationOrchestratorOptions {
  aiSettings: AiSettingsService;
  aiUsage: AiUsageService;
  modelFactory: AiModelFactory;
  /** Phase 16: the independent reviewer AI; absent means "deterministic QA only". */
  reviewer?: AiTranslationReviewer;
  glossaries: {
    resolveEffectiveGlossary(query: {
      manualId?: string | null;
      sourceLang?: string | null;
      targetLang: string;
    }): { entries: GlossaryEntryForMatch[] };
  };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/** Model replies occasionally arrive as content parts; flatten them into one string. */
export function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const part of content) {
    if (typeof part === 'string') {
      parts.push(part);
      continue;
    }
    if (part && typeof part === 'object' && 'text' in part) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string') parts.push(text);
    }
  }
  return parts.join('');
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export const ZERO_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

export function readUsage(message: {
  usage_metadata?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
}): TokenUsage {
  const usage = message.usage_metadata;
  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
  };
}

export function addUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    completionTokens: left.completionTokens + right.completionTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

/** Strips markdown fences and stray prose padding around a model-supplied XML fragment. */
export function normalizeSnippet(raw: string): string {
  let text = raw.trim();
  const fence = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/;
  const match = fence.exec(text);
  if (match?.[1] !== undefined) text = match[1].trim();
  return text;
}

/** Parser for the echo wrapper an attribute segment's reply may arrive in. */
function attributeEchoPattern(attributeName: string): RegExp {
  const escaped = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^<${escaped}\\b([^>]*)>([\\s\\S]*)</${escaped}>$`);
}

/**
 * Attribute segments (`navtitle="…"`, map `title="…"`) are plain text, not XML.
 *
 * Models reliably answer with bare text, sometimes with an unescaped `&` (`CI & CD`) and
 * sometimes with the element echoed back (`<navtitle>概念</navtitle>`). Both are normalised here so
 * validation and `assembleTranslatedXml()` only ever see clean, escaped attribute text.
 */
export function normalizeAttributeSnippet(raw: string, attributeName: string): string {
  let text = normalizeSnippet(raw);
  for (const tag of [attributeName, 'title', 'navtitle']) {
    const match = attributeEchoPattern(tag).exec(text);
    if (match) {
      const body = match[2];
      if (body !== undefined) {
        text = body.trim();
        break;
      }
    }
  }
  if (!text.includes('<') && !text.includes('>')) {
    text = text
      .replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);)/g, '&amp;')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return text;
}

/** Parses `<tblock id="…">…</tblock>` blocks out of a model reply. */
export function parseTranslatedBlocks(reply: string): Map<string, string> {
  const blocks = new Map<string, string>();
  for (const match of reply.matchAll(TBLOCK_PATTERN)) {
    const id = match[1]?.trim();
    const body = match[2];
    if (!id || body === undefined) continue;
    blocks.set(id, normalizeSnippet(body));
  }
  return blocks;
}

/** `true` when the fragment is well-formed once wrapped in its own DITA element. */
export function isWellFormedFragment(fragment: string, elementTag: string): boolean {
  const tag = elementTag || 'p';
  return checkXmlWellFormed(`<${tag}>${fragment}</${tag}>`, { position: false }).ok;
}

/** Tag-stripped text of a translated fragment, used for glossary/placeholder QA. */
export function fragmentText(fragment: string, elementTag: string): string {
  const tag = elementTag || 'p';
  try {
    const parsed = parseXml(`<${tag}>${fragment}</${tag}>`, { position: false });
    const root = parsed.document.documentElement;
    return root ? extractPlainText(root) : fragment.replace(/<[^>]+>/g, ' ');
  } catch {
    return fragment.replace(/<[^>]+>/g, ' ');
  }
}

/** One segment plus the glossary hits found inside its source text. */
export interface SegmentWork {
  segment: AlignedTranslationSegment;
  hits: GlossaryMatchHit[];
}

function segmentWeight(segment: AlignedTranslationSegment): number {
  return Math.max(segment.currSourceXml.length, segment.currSourceText.length, 1);
}

/** Greedy, order-preserving batching so a batch never reorders the document. */
function buildBatches(segments: SegmentWork[], maxChars = MAX_BATCH_CHARS): SegmentWork[][] {
  const batches: SegmentWork[][] = [];
  let current: SegmentWork[] = [];
  let size = 0;
  for (const work of segments) {
    const weight = segmentWeight(work.segment);
    if (current.length > 0 && size + weight > maxChars) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(work);
    size += weight;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function describeGlossaryHit(hit: GlossaryMatchHit): string {
  const entry = hit.entry;
  const flags: string[] = [];
  if (entry.caseSensitive) flags.push('case-sensitive');
  if (entry.doNotTranslate) flags.push('do-not-translate');
  const forbidden = (entry.forbiddenTargets ?? []).filter((term) => term.trim().length > 0);
  const tail: string[] = [];
  if (forbidden.length > 0) tail.push(`forbidden: ${forbidden.join(' | ')}`);
  if (entry.contextNote?.trim()) tail.push(`note: ${entry.contextNote.trim()}`);
  const suffix = [...flags, ...tail].length > 0 ? ` (${[...flags, ...tail].join('; ')})` : '';
  return `- "${hit.matchedText}" => "${entry.targetTerm}"${suffix}`;
}

function buildSystemPrompt(targetLang: string, sourceLang: string, customInstruction?: string): string {
  const lines = [
    `You are a professional DITA 1.3 technical translator working from ${sourceLang} into ${targetLang}.`,
    '',
    'Rules:',
    '1. Return EXACTLY one block per input segment, shaped like:',
    `   <${BLOCK_TAG} id="SEGMENT_ID">translated XML</${BLOCK_TAG}>`,
    '   Never add prose, numbering, markdown fences or extra blocks.',
    '2. Translate only human-readable text (titles, paragraphs, list items, table cells, notes,',
    '   short descriptions, navigation titles).',
    '3. Copy every inline DITA element and each of its attributes verbatim: <b>, <i>, <u>,',
    '   <codeph>, <filepath>, <varname>, <cmdname>, <apiname>, <parmname>, <uicontrol>,',
    '   <wintitle>, <menucascade>, <xref>, <link>, <keyword>, <ph>, <term>, <cite>, <q>,',
    '   <abbreviated-form>, <image>, <fn>. Never add, remove, reorder or re-nest them.',
    '4. Never change id, conref, conkeyref, href, keyref, scope, format, class, props,',
    '   platform, product, audience, otherprops, importance or any CALS span attribute.',
    '5. Keep product names, command names, code, file paths, key names and placeholders',
    '   ({0}, {{name}}, %s, ${var}) exactly as written.',
    '6. Honour every glossary entry: use the mandated target term, never use a forbidden one.',
    '7. Preserve {variables} and inline markup positions so the target reads naturally.',
    '8. Output the inner XML of the segment only — do not repeat the segment element itself',
    '   unless it is a single nested element that belongs to the content.',
    '9. Segments marked attr="navtitle" or attr="title" are XML attributes, not elements: reply',
    '   with the plain translated text only, with no XML tags, and escape & as &amp;.',
  ];
  const instruction = customInstruction?.trim();
  if (instruction) {
    lines.push('', 'Additional project instruction (highest priority after the rules above):', instruction);
  }
  return lines.join('\n');
}

function buildBatchPrompt(
  batch: SegmentWork[],
  targetLang: string,
  problems: string[],
): string {
  const glossary = new Map<string, string>();
  for (const work of batch) {
    for (const hit of work.hits) {
      const key = `${hit.entry.termId}\u0000${hit.matchedText}`;
      if (!glossary.has(key)) glossary.set(key, describeGlossaryHit(hit));
    }
  }

  const lines: string[] = [`Target language: ${targetLang}`, ''];
  if (glossary.size > 0) {
    lines.push('Mandatory glossary entries matched in these segments:');
    for (const entry of glossary.values()) lines.push(entry);
    lines.push('');
  }
  if (problems.length > 0) {
    lines.push('The previous attempt had problems — fix them in this reply:');
    for (const problem of problems) lines.push(`- ${problem}`);
    lines.push('');
  }
  lines.push(`Segments to translate (${batch.length}):`);
  for (const work of batch) {
    const segment = work.segment;
    const attrs = [`id="${segment.segmentId}"`, `tag="${segment.elementTag}"`, `change="${segment.changeKind}"`];
    if (segment.attributeName) attrs.push(`attr="${segment.attributeName}"`);
    lines.push(`<tsegment ${attrs.join(' ')}>`);
    if (segment.prevSourceXml !== undefined) {
      lines.push(`<prev_source>${segment.prevSourceXml}</prev_source>`);
    }
    lines.push(`<curr_source>${segment.currSourceXml}</curr_source>`);
    if (segment.prevTargetXml !== undefined) {
      lines.push(`<prev_target>${segment.prevTargetXml}</prev_target>`);
    }
    lines.push('</tsegment>');
  }
  lines.push('');
  lines.push(`Reply with ${batch.length} <${BLOCK_TAG}> block(s) in the same order.`);
  return lines.join('\n');
}

function buildRefinePrompt(
  segment: AlignedTranslationSegment,
  hits: GlossaryMatchHit[],
  targetLang: string,
  instruction: string,
  currentTargetXml: string | null,
): string {
  const lines = [`Target language: ${targetLang}`, ''];
  if (hits.length > 0) {
    lines.push('Mandatory glossary entries matched in this segment:');
    for (const hit of hits) lines.push(describeGlossaryHit(hit));
    lines.push('');
  }
  lines.push('Reviewer instruction (must be followed):', instruction, '');
  const refineAttrs = [
    `id="${segment.segmentId}"`,
    `tag="${segment.elementTag}"`,
    `change="${segment.changeKind}"`,
  ];
  if (segment.attributeName) refineAttrs.push(`attr="${segment.attributeName}"`);
  lines.push(`<tsegment ${refineAttrs.join(' ')}>`);
  if (segment.prevSourceXml !== undefined) {
    lines.push(`<prev_source>${segment.prevSourceXml}</prev_source>`);
  }
  lines.push(`<curr_source>${segment.currSourceXml}</curr_source>`);
  if (currentTargetXml?.trim()) {
    lines.push(`<current_target>${currentTargetXml.trim()}</current_target>`);
  } else if (segment.prevTargetXml !== undefined) {
    lines.push(`<prev_target>${segment.prevTargetXml}</prev_target>`);
  }
  lines.push('</tsegment>', '');
  lines.push(`Reply with exactly one <${BLOCK_TAG} id="${segment.segmentId}"> block.`);
  return lines.join('\n');
}

export function buildMessages(system: string, human: string): BaseMessage[] {
  return [new SystemMessage(system), new HumanMessage(human)];
}

/** The plan's `unchanged` segments already carry `T0`; those are the zero-token wins. */
function isAiWork(segment: AlignedTranslationSegment, mode: TranslationJobMode, planDeclined: boolean): boolean {
  if (segment.protected) return false;
  if (mode === 'incremental' && !planDeclined) {
    return segment.changeKind === 'modified' || segment.changeKind === 'added';
  }
  return true;
}

export function qaInputs(
  segments: AlignedTranslationSegment[],
): Array<{
  segmentId: string;
  sourceXml: string;
  sourceText: string;
  targetXml: string;
  targetText: string;
  protected?: boolean;
}> {
  const inputs = [];
  for (const segment of segments) {
    const targetXml = segment.proposedTargetXml;
    if (targetXml === undefined) continue;
    inputs.push({
      segmentId: segment.segmentId,
      sourceXml: segment.currSourceXml,
      sourceText: segment.currSourceText,
      targetXml,
      targetText: segment.proposedTargetText ?? fragmentText(targetXml, segment.elementTag),
      ...(segment.protected ? { protected: true } : {}),
    });
  }
  return inputs;
}

/** Deterministic QA findings grouped by the block they belong to. */
function groupQaBySegment(issues: readonly TranslationQaIssue[]): Map<string, TranslationQaIssue[]> {
  const grouped = new Map<string, TranslationQaIssue[]>();
  for (const issue of issues) {
    const segmentId = issue.segmentId?.trim();
    if (!segmentId) continue;
    const bucket = grouped.get(segmentId);
    if (bucket) bucket.push(issue);
    else grouped.set(segmentId, [issue]);
  }
  return grouped;
}

function describeRepairQaIssue(issue: TranslationQaIssue): string {
  const detail =
    issue.expected !== undefined || issue.actual !== undefined
      ? ` (expected: ${issue.expected ?? '—'}; actual: ${issue.actual ?? '—'})`
      : '';
  return `- [SEGMENT ${issue.segmentId ?? '?'}] ${issue.code}: ${issue.message}${detail}`;
}

function describeReviewerIssue(issue: TranslationAiReviewIssue): string {
  const suggestion = issue.suggestion.trim() ? ` — fix: ${issue.suggestion.trim()}` : '';
  return `- [SEGMENT ${issue.segmentId}] ${issue.category}: ${issue.message}${suggestion}`;
}

/**
 * Repair-only system prompt: the translator keeps the same DITA 1.3 rules as a normal translation
 * pass, but may only touch the blocks listed in the request.
 */
function buildRepairSystemPrompt(
  targetLang: string,
  sourceLang: string,
  customInstruction?: string,
): string {
  const lines = [
    `You are a professional DITA 1.3 technical translator repairing ${sourceLang} → ${targetLang} output.`,
    '',
    'Rules:',
    '1. Return EXACTLY one block per listed segment:',
    `   <${BLOCK_TAG} id="SEGMENT_ID">repaired XML</${BLOCK_TAG}>`,
    '   No prose, no numbering, no markdown fences, no extra blocks.',
    '2. Change ONLY what the [QA ERROR] and [REVIEWER FEEDBACK] findings require; keep every',
    '   already-correct sentence untouched.',
    '3. Copy every inline DITA element and attribute verbatim (<b>, <i>, <codeph>, <filepath>,',
    '   <xref>, <keyword>, <ph>, <image>, …). Never add, remove, reorder or re-nest them.',
    '4. Never change id, conref, conkeyref, href, keyref, scope, format, class or CALS spans.',
    '5. Keep product names, commands, code, file paths, key names and placeholders ({0}, {{name}},',
    '   %s, ${var}) exactly as written.',
    '6. Honour the glossary: use the mandated target term and never a forbidden one.',
    '7. Segments marked attr="navtitle" or attr="title" are attribute text: reply with plain text',
    '   only (no XML tags), escaping & as &amp;.',
  ];
  const instruction = customInstruction?.trim();
  if (instruction) {
    lines.push('', 'Additional project instruction (highest priority after the rules above):', instruction);
  }
  return lines.join('\n');
}

/** Human prompt for the targeted repair pass: only the offending blocks travel to the model. */
function buildRepairPrompt(
  requests: RepairSegmentRequest[],
  targetLang: string,
  problems: string[],
): string {
  const lines: string[] = [`Target language: ${targetLang}`, ''];
  if (problems.length > 0) {
    lines.push('The previous repair attempt had problems — fix them in this reply:');
    for (const problem of problems) lines.push(`- ${problem}`);
    lines.push('');
  }
  lines.push(`Blocks to repair (${requests.length}):`);
  for (const request of requests) {
    const segment = request.segment;
    const attrs = [`id="${segment.segmentId}"`, `tag="${segment.elementTag}"`];
    if (segment.attributeName) attrs.push(`attr="${segment.attributeName}"`);
    lines.push(`<tsegment ${attrs.join(' ')}>`);
    lines.push(`<curr_source>${segment.currSourceXml}</curr_source>`);
    lines.push(`<current_target>${segment.proposedTargetXml ?? ''}</current_target>`);
    const glossary = new Set<string>();
    for (const hit of request.hits) glossary.add(describeGlossaryHit(hit));
    if (glossary.size > 0) {
      lines.push('<glossary>');
      for (const entry of glossary) lines.push(entry);
      lines.push('</glossary>');
    }
    const qaErrors = request.qaIssues.filter((issue) => issue.severity === 'error');
    if (qaErrors.length > 0) {
      lines.push('<qa_errors>');
      for (const issue of qaErrors) lines.push(describeRepairQaIssue(issue));
      lines.push('</qa_errors>');
    }
    const feedback = request.reviewIssues.filter((issue) => issue.severity === 'error');
    if (feedback.length > 0) {
      lines.push('<reviewer_feedback>');
      for (const issue of feedback) lines.push(describeReviewerIssue(issue));
      lines.push('</reviewer_feedback>');
    }
    lines.push('</tsegment>');
  }
  lines.push('');
  lines.push(`Reply with ${requests.length} <${BLOCK_TAG}> block(s) in the same order.`);
  return lines.join('\n');
}

function buildDitaOtRepairPrompt(
  input: RepairDocumentForDitaOtInput,
  problems: string[],
): string {
  const lines = [
    `Source language: ${input.sourceLang}`,
    `Target language: ${input.targetLang}`,
    `File: ${input.filePath}`,
    '',
  ];
  if (problems.length > 0) {
    lines.push('The previous repair attempt had problems — fix them in this reply:');
    for (const problem of problems) lines.push(`- ${problem}`);
    lines.push('');
  }
  lines.push('DITA-OT strict validation diagnostics to fix:');
  for (const diagnostic of input.ditaOtDiagnostics) {
    const location = diagnostic.filePath
      ? `${diagnostic.filePath}${diagnostic.line ? `:${diagnostic.line}` : ''}`
      : input.filePath;
    const code = diagnostic.code ? `[${diagnostic.code}] ` : '';
    lines.push(`- ${location} ${diagnostic.severity}: ${code}${diagnostic.message}`);
  }
  lines.push('');
  if (input.glossary && input.glossary.length > 0) {
    lines.push('Mandatory glossary entries (do not violate them while repairing):');
    for (const entry of input.glossary) {
      const forbidden = (entry.forbiddenTargets ?? []).filter((term) => term.trim().length > 0);
      const tail = forbidden.length > 0 ? ` (forbidden: ${forbidden.join(' | ')})` : '';
      lines.push(`- "${entry.sourceTerm}" => "${entry.targetTerm}"${tail}`);
    }
    lines.push('');
  }
  lines.push('<source_document>', input.sourceXml.trim(), '</source_document>', '');
  lines.push('<current_document>', input.proposedXml.trim(), '</current_document>', '');
  lines.push(
    'Reply with the corrected target document XML only: keep the XML declaration, the DOCTYPE',
    'declaration, the root element name and xml:lang exactly as they are; fix only what makes',
    'DITA-OT fail. No prose and no markdown fences.',
  );
  return lines.join('\n');
}

/** Third-party vocabulary for the `<source_document>`/`<current_document>` markers only. */
interface ParsedDocumentFingerprint {
  rootTag: string;
  doctype: string;
  xmlLang: string | null;
}

function readDocumentFingerprint(xml: string): ParsedDocumentFingerprint | null {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return null;
  return {
    rootTag: root.tagName,
    doctype: JSON.stringify(parsed.doctype ?? null),
    xmlLang: root.getAttribute('xml:lang'),
  };
}

/** Strips markdown fences a model may wrap a whole document in. */
function normalizeDocumentReply(reply: string): string {
  let text = reply.trim();
  const fence = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n?```$/.exec(text);
  if (fence?.[1] !== undefined) text = fence[1].trim();
  return text;
}

type TranslationState =
  | {
      ok: true;
      xml: string;
      segments: AlignedTranslationSegment[];
      qa: TranslationQaReport;
      warnings: string[];
    }
  | { ok: false; reason: string };

function countSegmentQaErrors(state: TranslationState, segmentId: string): number {
  if (!state.ok) return Number.POSITIVE_INFINITY;
  let errors = 0;
  for (const issue of state.qa.issues) {
    if (issue.severity === 'error' && issue.segmentId === segmentId) errors += 1;
  }
  return errors;
}

/**
 * Deterministic guards for a DITA-OT repair candidate: well-formed, same DOCTYPE, same root
 * element, same `xml:lang`, and (for topics) still convertible to ProseMirror. Returns the
 * rejection reason, or `null` when the document is safe to write.
 */
function validateRepairedDocument(
  candidate: string,
  fingerprint: ParsedDocumentFingerprint,
  isTopic: boolean,
): string | null {
  const trimmed = candidate.trim();
  if (!trimmed) return 'the reply was empty';
  if (!trimmed.startsWith('<')) return 'the reply was not XML';
  const wellFormed = checkXmlWellFormed(trimmed, { position: false });
  if (!wellFormed.ok) return `the repaired XML is not well-formed: ${wellFormed.error.message}`;
  let next: ParsedDocumentFingerprint | null;
  try {
    next = readDocumentFingerprint(trimmed);
  } catch (error) {
    return `the repaired XML could not be parsed: ${describeError(error)}`;
  }
  if (!next) return 'the repaired XML has no root element';
  if (next.rootTag !== fingerprint.rootTag) {
    return `the root element changed from <${fingerprint.rootTag}> to <${next.rootTag}>`;
  }
  if (next.doctype !== fingerprint.doctype) {
    return 'the DOCTYPE declaration changed';
  }
  if (next.xmlLang !== fingerprint.xmlLang) {
    return `xml:lang changed from "${fingerprint.xmlLang ?? ''}" to "${next.xmlLang ?? ''}"`;
  }
  if (isTopic) {
    try {
      xmlToPmDoc(trimmed, { position: false });
    } catch (error) {
      return `the repaired topic is not ProseMirror-compatible: ${describeError(error)}`;
    }
  }
  return null;
}

/**
 * Re-derives aligned segments from a whole-file replacement (Phase 16 DITA-OT repair, and the
 * review pane's manual whole-file edits share the same structural-path lookup).
 *
 * Returns `null` when the stored segment list or the replacement cannot be aligned, so callers keep
 * the previous segments instead of persisting an inconsistent proposal.
 */
export function realignProposalAfterRepair(input: {
  segmentsJson: string | null;
  proposedXml: string;
  glossary: readonly GlossaryEntryForMatch[];
}): { segmentsJson: string; qaReportJson: string } | null {
  if (!input.segmentsJson) return null;
  let stored: AlignedTranslationSegment[];
  try {
    const parsed = JSON.parse(input.segmentsJson) as unknown;
    if (!Array.isArray(parsed)) return null;
    stored = parsed as AlignedTranslationSegment[];
  } catch {
    return null;
  }
  let extracted: ReturnType<typeof extractTranslatableSegments>;
  try {
    extracted = extractTranslatableSegments(input.proposedXml);
  } catch {
    return null;
  }
  const byPath = new Map(extracted.map((segment) => [segment.structuralPath, segment] as const));
  const segments = stored.map((segment) => {
    const target = byPath.get(segment.structuralPath);
    if (!target) {
      return { ...segment, proposedTargetXml: undefined, proposedTargetText: undefined };
    }
    return {
      ...segment,
      proposedTargetXml: target.innerXml,
      proposedTargetText: target.plainText,
    };
  });
  const inputs = qaInputs(segments);
  const report = summarizeQaIssues(
    runTranslationQa({ segments: inputs, glossary: [...input.glossary] }),
    inputs.length,
  );
  return { segmentsJson: JSON.stringify(segments), qaReportJson: JSON.stringify(report) };
}

export class AiTranslationOrchestrator {
  private readonly aiSettings: AiSettingsService;
  private readonly aiUsage: AiUsageService;
  private readonly modelFactory: AiModelFactory;
  private readonly glossaries: AiTranslationOrchestratorOptions['glossaries'];
  private readonly reviewer: AiTranslationReviewer | null;

  constructor(options: AiTranslationOrchestratorOptions) {
    this.aiSettings = options.aiSettings;
    this.aiUsage = options.aiUsage;
    this.modelFactory = options.modelFactory;
    this.glossaries = options.glossaries;
    this.reviewer = options.reviewer ?? null;
  }

  private recordUsage(input: {
    link: TranslationLinkRow;
    sourcePath: string;
    user: IdentityUser;
    model: string;
    taskType:
      | 'translate_batch'
      | 'translate_block'
      | 'translate_refine'
      | 'translate_repair';
    subAction: string;
    status: 'succeeded' | 'failed' | 'cancelled';
    retryCount: number;
    usage: TokenUsage;
    durationMs: number;
    errorMessage?: string | null;
  }): void {
    try {
      // Never store document content here: tokens, timing and the file path only.
      this.aiUsage.record({
        projectId: input.link.targetManualId,
        branch: input.link.targetBranch,
        userId: input.user.id,
        userDisplayName: input.user.displayName,
        taskType: input.taskType,
        subAction: input.subAction,
        filePath: input.sourcePath,
        model: input.model,
        status: input.status,
        retryCount: input.retryCount,
        promptTokens: input.usage.promptTokens,
        completionTokens: input.usage.completionTokens,
        totalTokens: input.usage.totalTokens,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage ?? null,
      });
    } catch {
      // Usage accounting must never break a translation run.
    }
  }

  private resolveGlossary(link: TranslationLinkRow): GlossaryEntryForMatch[] {
    try {
      return this.glossaries.resolveEffectiveGlossary({
        manualId: link.sourceManualId,
        sourceLang: link.sourceLang,
        targetLang: link.targetLang,
      }).entries;
    } catch {
      // A broken glossary must degrade to "no glossary", never to a failed translation.
      return [];
    }
  }

  /**
   * Translates one file.
   *
   * `mode: 'incremental'` sends only modified/added blocks when a truthful three-way plan exists;
   * `mode: 'full'` re-translates every non-protected block while still passing `T0` as reference.
   */
  async translateDocument(input: TranslateDocumentInput): Promise<TranslateDocumentResult> {
    const { link, sourcePath, sourceXml } = input;
    const config = this.aiSettings.resolveConfig();
    const glossary = this.resolveGlossary(link);

    const plan = planIncrementalTranslation({
      prevSourceXml: input.prevSourceXml ?? null,
      currSourceXml: sourceXml,
      prevTargetXml: input.prevTargetXml ?? null,
    });
    const planDeclined = plan.mode !== 'incremental';

    const work: SegmentWork[] = [];
    for (const segment of plan.segments) {
      if (!isAiWork(segment, input.mode, planDeclined)) continue;
      work.push({ segment, hits: matchGlossaryTerms(segment.currSourceText, glossary) });
    }

    const translations = new Map<string, string>();
    const warnings: string[] = [];
    const modelName = config.model;

    if (work.length > 0) {
      const model = this.modelFactory(config);
      const system = buildSystemPrompt(link.targetLang, link.sourceLang, input.customInstruction);
      const batches = buildBatches(work);
      for (const batch of batches) {
        const batchTranslations = await this.translateBatch({
          batch,
          system,
          targetLang: link.targetLang,
          link,
          sourcePath,
          user: input.user,
          model,
          modelName,
          maxRetries: Math.max(0, config.maxRetries),
          mode: input.mode,
          ...(input.signal ? { signal: input.signal } : {}),
        });
        for (const [key, value] of batchTranslations) translations.set(key, value);
      }
    }

    const initialState = this.buildState({
      sourceXml,
      targetLang: link.targetLang,
      plan,
      translations,
      glossary,
    });
    if (!initialState.ok) {
      throw new Error(initialState.reason);
    }
    warnings.push(...initialState.warnings);

    // Phase 16 dual-AI loop: independent review → targeted repair → deterministic re-verification.
    const review = await this.runDualAiReview({
      base: input,
      link,
      glossary,
      plan,
      translations,
      work,
      state: initialState,
      translatedSegmentIds: new Set(translations.keys()),
    });
    const state = review.state ?? initialState;
    warnings.push(...review.warnings);

    const translatedSegments = translations.size;
    // `modeUsed` reports what actually ran: a declined plan (structural divergence or a missing
    // baseline) silently degrades an incremental request into a full re-translation.
    const modeUsed: TranslationJobMode =
      input.mode === 'full' || planDeclined ? 'full' : 'incremental';
    return {
      proposedXml: state.xml,
      segments: state.segments,
      qaReport: state.qa,
      modeUsed,
      reusedSegments: state.segments.length - translatedSegments,
      translatedSegments,
      warnings,
      structuralDivergence: plan.structuralDivergence,
      aiReview: review.report,
    };
  }

  /**
   * One batch: prompt → parse `<tblock>` blocks → validate → retry the missing/malformed ones.
   * Every attempt is bounded by `maxRetries`, and usage is recorded once per batch.
   */
  private async translateBatch(input: {
    batch: SegmentWork[];
    system: string;
    targetLang: string;
    link: TranslationLinkRow;
    sourcePath: string;
    user: IdentityUser;
    model: ReturnType<AiModelFactory>;
    modelName: string;
    maxRetries: number;
    mode: TranslationJobMode;
    signal?: AbortSignal;
  }): Promise<Map<string, string>> {
    let pending = new Map(input.batch.map((work) => [work.segment.segmentId, work] as const));
    const translated = new Map<string, string>();
    let problems: string[] = [];
    let usage = ZERO_USAGE;
    let attempts = 0;
    let lastError: string | null = null;
    const startedAt = Date.now();

    while (pending.size > 0 && attempts <= input.maxRetries) {
      const batch = [...pending.values()];
      const human = buildBatchPrompt(batch, input.targetLang, problems);
      attempts += 1;
      let reply: string;
      try {
        const message = await input.model.invoke(buildMessages(input.system, human), {
          ...(input.signal ? { signal: input.signal } : {}),
        });
        usage = addUsage(usage, readUsage(message));
        reply = messageText(message.content);
      } catch (error) {
        if (isAbortError(error, input.signal)) {
          this.recordUsage({
            link: input.link,
            sourcePath: input.sourcePath,
            user: input.user,
            model: input.modelName,
            taskType: 'translate_batch',
            subAction: input.mode,
            status: 'cancelled',
            retryCount: attempts - 1,
            usage,
            durationMs: Date.now() - startedAt,
            errorMessage: describeError(error),
          });
          throw error;
        }
        lastError = describeError(error);
        problems = [`the model call failed: ${lastError}`];
        continue;
      }

      const blocks = parseTranslatedBlocks(reply);
      const nextProblems: string[] = [];
      const nextPending = new Map(pending);
      for (const [segmentId, work] of pending) {
        const raw = blocks.get(segmentId);
        if (raw === undefined || raw.trim().length === 0) {
          nextProblems.push(`segment "${segmentId}" returned no <${BLOCK_TAG}> block`);
          continue;
        }
        const fragment = work.segment.attributeName
          ? normalizeAttributeSnippet(raw, work.segment.attributeName)
          : normalizeSnippet(raw);
        if (!isWellFormedFragment(fragment, work.segment.elementTag)) {
          nextProblems.push(
            `segment "${segmentId}" returned XML that is not well-formed inside <${work.segment.elementTag}>`,
          );
          continue;
        }
        translated.set(segmentId, fragment);
        nextPending.delete(segmentId);
      }
      pending = nextPending;
      problems = nextProblems;
    }

    const failed = pending.size > 0;
    this.recordUsage({
      link: input.link,
      sourcePath: input.sourcePath,
      user: input.user,
      model: input.modelName,
      taskType: 'translate_batch',
      subAction: input.mode,
      status: failed ? 'failed' : 'succeeded',
      retryCount: Math.max(0, attempts - 1),
      usage,
      durationMs: Date.now() - startedAt,
      errorMessage: failed
        ? `Missing or malformed translation blocks after ${attempts} attempt(s): ${[...pending.keys()].join(', ')}${
            lastError ? ` (last error: ${lastError})` : ''
          }`
        : null,
    });

    if (failed) {
      throw new Error(
        `AI translation did not return valid XML for ${pending.size} segment(s) after ${attempts} attempt(s): ${[
          ...pending.keys(),
        ].join(', ')}${lastError ? ` (last error: ${lastError})` : ''}`,
      );
    }
    return translated;
  }

  /** Reviewer-driven single-block refinement (`translate_refine` usage). */
  async refineSegment(input: RefineSegmentInput): Promise<RefineSegmentResult> {
    const { link, segment } = input;
    const config = this.aiSettings.resolveConfig();
    const glossary = this.resolveGlossary(link);
    const hits = matchGlossaryTerms(segment.currSourceText, glossary);
    const model = this.modelFactory(config);
    const system = buildSystemPrompt(link.targetLang, link.sourceLang);
    const human = buildRefinePrompt(
      segment,
      hits,
      link.targetLang,
      input.instruction,
      input.currentTargetXml ?? segment.proposedTargetXml ?? null,
    );

    let usage = ZERO_USAGE;
    let attempts = 0;
    let lastError: string | null = null;
    const startedAt = Date.now();
    let refined: string | null = null;

    while (refined === null && attempts <= Math.max(0, config.maxRetries)) {
      attempts += 1;
      try {
        const message = await model.invoke(buildMessages(system, human), {
          ...(input.signal ? { signal: input.signal } : {}),
        });
        usage = addUsage(usage, readUsage(message));
        const blocks = parseTranslatedBlocks(messageText(message.content));
        const raw = blocks.get(segment.segmentId) ?? normalizeSnippet(messageText(message.content));
        const fragment = segment.attributeName
          ? normalizeAttributeSnippet(raw, segment.attributeName)
          : normalizeSnippet(raw);
        if (fragment.length === 0) {
          lastError = 'the model returned no translation block';
        } else if (!isWellFormedFragment(fragment, segment.elementTag)) {
          lastError = 'the returned XML was not well-formed';
        } else {
          refined = fragment;
        }
      } catch (error) {
        if (isAbortError(error, input.signal)) {
          this.recordUsage({
            link,
            sourcePath: input.sourcePath,
            user: input.user,
            model: config.model,
            taskType: 'translate_refine',
            subAction: 'refine',
            status: 'cancelled',
            retryCount: attempts - 1,
            usage,
            durationMs: Date.now() - startedAt,
            errorMessage: describeError(error),
          });
          throw error;
        }
        lastError = describeError(error);
      }
    }

    this.recordUsage({
      link,
      sourcePath: input.sourcePath,
      user: input.user,
      model: config.model,
      taskType: 'translate_refine',
      subAction: 'refine',
      status: refined === null ? 'failed' : 'succeeded',
      retryCount: Math.max(0, attempts - 1),
      usage,
      durationMs: Date.now() - startedAt,
      errorMessage: refined === null ? (lastError ?? 'refinement failed') : null,
    });

    if (refined === null) {
      throw new Error(`AI refinement failed after ${attempts} attempt(s): ${lastError ?? 'unknown error'}`);
    }

    const proposedTargetText = fragmentText(refined, segment.elementTag);
    const qaIssues = runTranslationQa({
      segments: [
        {
          segmentId: segment.segmentId,
          sourceXml: segment.currSourceXml,
          sourceText: segment.currSourceText,
          targetXml: refined,
          targetText: proposedTargetText,
        },
      ],
      glossary,
    });

    return {
      segmentId: segment.segmentId,
      proposedTargetXml: refined,
      proposedTargetText,
      qaIssues,
    };
  }

  /** Assembles a translation map into a proposal and runs the deterministic QA gate. */
  private buildState(input: {
    sourceXml: string;
    targetLang: string;
    plan: ReturnType<typeof planIncrementalTranslation>;
    translations: Map<string, string>;
    glossary: GlossaryEntryForMatch[];
  }): TranslationState {
    const segments = input.plan.segments.map((segment) => {
      const translated = input.translations.get(segment.segmentId);
      if (translated === undefined) return segment;
      return {
        ...segment,
        proposedTargetXml: translated,
        proposedTargetText: fragmentText(translated, segment.elementTag),
      };
    });
    const assembled = assembleTranslatedXml({
      sourceXml: input.sourceXml,
      targetLang: input.targetLang,
      translatedSegments: input.translations,
      plan: input.plan,
      checkPm: true,
    });
    if (!assembled.ok) {
      return {
        ok: false,
        reason: assembled.pmError
          ? `ProseMirror is not compatible with the translated document: ${assembled.pmError}`
          : assembled.wellFormedError
            ? `Assembled XML is not well-formed: ${assembled.wellFormedError.message}`
            : 'Assembled XML failed the ProseMirror compatibility probe.',
      };
    }
    const inputs = qaInputs(segments);
    return {
      ok: true,
      xml: assembled.xml,
      segments,
      qa: summarizeQaIssues(
        runTranslationQa({ segments: inputs, glossary: input.glossary }),
        inputs.length,
      ),
      warnings: [...assembled.warnings],
    };
  }

  /**
   * Phase 16 dual-AI loop.
   *
   * 1. A 0-token run (nothing translated, no deterministic QA error) never calls the reviewer.
   * 2. The independent reviewer reads the freshly translated blocks plus every block with a
   *    deterministic QA error.
   * 3. The translator repairs only the union of "QA error" and "reviewer error" blocks, round by
   *    round, and each accepted block must survive `assembleTranslatedXml({ checkPm: true })` and
   *    must not increase the deterministic QA error count (no-regression guard).
   * 4. Repaired blocks get at most one confirmation review (`qa_recheck`).
   */
  private async runDualAiReview(input: {
    base: TranslateDocumentInput;
    link: TranslationLinkRow;
    glossary: GlossaryEntryForMatch[];
    plan: ReturnType<typeof planIncrementalTranslation>;
    translations: Map<string, string>;
    work: SegmentWork[];
    state: TranslationState & { ok: true };
    translatedSegmentIds: Set<string>;
  }): Promise<{
    state: (TranslationState & { ok: true }) | null;
    warnings: string[];
    report: TranslationAiReviewReport;
  }> {
    const { base, link, plan, translations } = input;
    const aiReviewEnabled = base.aiReviewEnabled !== false;
    const maxRepairRounds = Math.min(
      3,
      Math.max(0, Math.trunc(base.maxQaRepairRounds ?? DEFAULT_MAX_QA_REPAIR_ROUNDS)),
    );
    const initialQaErrors = input.state.qa.errorCount;
    const updatedAt = new Date().toISOString();
    const warnings: string[] = [];

    // Proposals live on the *assembled* segments (a freshly translated block has no
    // `proposedTargetXml` on the raw plan segment), so review/repair read `state.segments`.
    const segmentById = new Map(
      input.state.segments.map((segment) => [segment.segmentId, segment] as const),
    );
    const hitsBySegment = new Map(input.work.map((work) => [work.segment.segmentId, work.hits] as const));
    const errorSegmentIds = (state: TranslationState & { ok: true }): Set<string> => {
      const ids = new Set<string>();
      for (const issue of state.qa.issues) {
        if (issue.severity !== 'error' || !issue.segmentId) continue;
        if (segmentById.has(issue.segmentId)) ids.add(issue.segmentId);
      }
      return ids;
    };

    const skippedReport = (summary: string): TranslationAiReviewReport => ({
      verdict: 'skipped',
      model: null,
      isDedicatedModel: false,
      summary,
      reviewRounds: 0,
      qaRepairRounds: 0,
      repairedSegments: 0,
      initialQaErrors,
      remainingQaErrors: initialQaErrors,
      issues: [],
      updatedAt,
    });

    // 0-token incremental skip: nothing was translated and the deterministic gate is clean.
    if (input.translatedSegmentIds.size === 0 && initialQaErrors === 0) {
      return {
        state: null,
        warnings,
        report: skippedReport('No block needed translation, so the reviewer AI was skipped.'),
      };
    }

    const qaBySegment = groupQaBySegment(input.state.qa.issues);
    const reviewIds = new Set<string>();
    for (const segmentId of input.translatedSegmentIds) {
      const segment = segmentById.get(segmentId);
      if (segment?.proposedTargetXml !== undefined) reviewIds.add(segmentId);
    }
    for (const segmentId of errorSegmentIds(input.state)) reviewIds.add(segmentId);

    const reviewer = this.reviewer;
    let reviewRounds = 0;
    let reviewVerdict: 'pass' | 'revise' | 'skipped' | 'error' = 'skipped';
    let reviewIssues: TranslationAiReviewIssue[] = [];
    let reviewSummary = aiReviewEnabled
      ? 'The reviewer AI found no blocking issues.'
      : 'The reviewer AI is disabled for this translation.';
    let reviewModel: string | null = null;
    let reviewDedicated = false;

    if (aiReviewEnabled && reviewer && reviewIds.size > 0) {
      base.onPhaseChange?.('ai_reviewing');
      const result = await reviewer.reviewSegments({
        link,
        sourcePath: base.sourcePath,
        user: base.user,
        bundles: [...reviewIds].map((segmentId) => {
          const segment = segmentById.get(segmentId);
          if (!segment) throw new Error(`Unknown review segment: ${segmentId}`);
          return {
            segment,
            hits: hitsBySegment.get(segmentId) ?? [],
            qaIssues: qaBySegment.get(segmentId) ?? [],
          };
        }),
        subAction: 'qa_review',
        ...(base.customInstruction ? { customInstruction: base.customInstruction } : {}),
        ...(base.signal ? { signal: base.signal } : {}),
      });
      reviewRounds = 1;
      reviewVerdict = result.verdict;
      reviewIssues = result.issues;
      reviewSummary = result.summary;
      reviewModel = result.model;
      reviewDedicated = result.isDedicatedModel;
    } else if (aiReviewEnabled && !reviewer) {
      reviewSummary = 'The reviewer AI is not configured; only deterministic QA findings drove the repair loop.';
    }

    let state = input.state;
    let qaRepairRounds = 0;
    let repairedSegments = 0;
    const repairedIds = new Set<string>();

    const repairTargets = (): Set<string> => {
      const targets = new Set<string>(errorSegmentIds(state));
      if (aiReviewEnabled) {
        for (const issue of reviewIssues) {
          if (issue.severity === 'error') targets.add(issue.segmentId);
        }
      }
      // Only blocks that actually carry a proposal can be repaired.
      const proposals = new Set(
        state.segments
          .filter((segment) => segment.proposedTargetXml !== undefined)
          .map((segment) => segment.segmentId),
      );
      return new Set([...targets].filter((segmentId) => proposals.has(segmentId)));
    };

    while (qaRepairRounds < maxRepairRounds) {
      const targets = repairTargets();
      if (targets.size === 0) break;
      const roundQa = groupQaBySegment(state.qa.issues);
      const currentById = new Map(
        state.segments.map((segment) => [segment.segmentId, segment] as const),
      );
      const candidates = await this.repairSegments({
        link,
        sourcePath: base.sourcePath,
        user: base.user,
        requests: [...targets].map((segmentId) => {
          const segment = currentById.get(segmentId);
          if (!segment) throw new Error(`Unknown repair segment: ${segmentId}`);
          return {
            segment,
            hits: hitsBySegment.get(segmentId) ?? [],
            qaIssues: roundQa.get(segmentId) ?? [],
            reviewIssues: reviewIssues.filter((issue) => issue.segmentId === segmentId),
          };
        }),
        ...(base.customInstruction ? { customInstruction: base.customInstruction } : {}),
        ...(base.signal ? { signal: base.signal } : {}),
      });
      qaRepairRounds += 1;
      if (candidates.size === 0) break;

      let acceptedThisRound = 0;
      for (const [segmentId, fragment] of candidates) {
        const previous = translations.get(segmentId);
        const previousErrors = countSegmentQaErrors(state, segmentId);
        translations.set(segmentId, fragment);
        const trial = this.buildState({
          sourceXml: base.sourceXml,
          targetLang: link.targetLang,
          plan,
          translations,
          glossary: input.glossary,
        });
        const regressed = !trial.ok || countSegmentQaErrors(trial, segmentId) > previousErrors;
        if (regressed) {
          // No-regression guard: a repair that breaks the document or adds QA errors is reverted.
          if (previous === undefined) translations.delete(segmentId);
          else translations.set(segmentId, previous);
          warnings.push(
            `QA repair for segment ${segmentId} was reverted (${trial.ok ? 'it added deterministic QA errors' : trial.reason}).`,
          );
          continue;
        }
        state = trial;
        acceptedThisRound += 1;
        repairedIds.add(segmentId);
      }
      repairedSegments += acceptedThisRound;
      if (acceptedThisRound === 0) break;
      if (errorSegmentIds(state).size === 0) break;
    }

    // One confirmation review on the repaired blocks only, so the final report describes the
    // proposal that will actually reach the human reviewer.
    if (repairedSegments > 0 && aiReviewEnabled && reviewer && repairedIds.size > 0) {
      const repairedQa = groupQaBySegment(state.qa.issues);
      const recheckById = new Map(
        state.segments.map((segment) => [segment.segmentId, segment] as const),
      );
      const result = await reviewer.reviewSegments({
        link,
        sourcePath: base.sourcePath,
        user: base.user,
        bundles: [...repairedIds].map((segmentId) => {
          const segment = recheckById.get(segmentId);
          if (!segment) throw new Error(`Unknown review segment: ${segmentId}`);
          return {
            segment,
            hits: hitsBySegment.get(segmentId) ?? [],
            qaIssues: repairedQa.get(segmentId) ?? [],
          };
        }),
        subAction: 'qa_recheck',
        ...(base.customInstruction ? { customInstruction: base.customInstruction } : {}),
        ...(base.signal ? { signal: base.signal } : {}),
      });
      reviewRounds += 1;
      reviewVerdict = result.verdict;
      reviewIssues = result.issues;
      reviewSummary =
        result.verdict === 'pass'
          ? `${reviewSummary} Confirmation review passed after ${repairedSegments} repaired block(s).`
          : result.summary;
      reviewModel = result.model ?? reviewModel;
      reviewDedicated = result.isDedicatedModel || reviewDedicated;
    }

    const verdict: TranslationAiReviewReport['verdict'] = !aiReviewEnabled
      ? 'skipped'
      : reviewVerdict;
    return {
      state: repairedSegments > 0 ? state : null,
      warnings,
      report: {
        verdict,
        model: reviewModel,
        isDedicatedModel: reviewDedicated,
        summary: reviewSummary,
        reviewRounds,
        qaRepairRounds,
        repairedSegments,
        initialQaErrors,
        remainingQaErrors: state.qa.errorCount,
        issues: reviewIssues,
        updatedAt,
      },
    };
  }

  /**
   * Targeted QA repair (`translate_repair` / `qa_repair`): only the offending blocks travel to the
   * model, each with its `[QA ERROR]` and `[REVIEWER FEEDBACK]` context.
   */
  async repairSegments(input: RepairSegmentsInput): Promise<Map<string, string>> {
    const repaired = new Map<string, string>();
    if (input.requests.length === 0) return repaired;

    const { link } = input;
    const config = this.aiSettings.resolveConfig();
    const startedAt = Date.now();
    const system = buildRepairSystemPrompt(link.targetLang, link.sourceLang, input.customInstruction);
    let pending = new Map(input.requests.map((request) => [request.segment.segmentId, request] as const));
    let usage = ZERO_USAGE;
    let attempts = 0;
    let problems: string[] = [];
    let lastError: string | null = null;
    let model: ReturnType<AiModelFactory> | null = null;

    while (pending.size > 0 && attempts <= Math.max(0, config.maxRetries)) {
      attempts += 1;
      try {
        model = model ?? this.modelFactory(config);
        const message = await model.invoke(
          buildMessages(system, buildRepairPrompt([...pending.values()], link.targetLang, problems)),
          { ...(input.signal ? { signal: input.signal } : {}) },
        );
        usage = addUsage(usage, readUsage(message));
        const blocks = parseTranslatedBlocks(messageText(message.content));
        const nextPending = new Map(pending);
        const nextProblems: string[] = [];
        for (const [segmentId, request] of pending) {
          const raw = blocks.get(segmentId);
          if (raw === undefined || raw.trim().length === 0) {
            nextProblems.push(`segment "${segmentId}" returned no <${BLOCK_TAG}> block`);
            continue;
          }
          const fragment = request.segment.attributeName
            ? normalizeAttributeSnippet(raw, request.segment.attributeName)
            : normalizeSnippet(raw);
          if (fragment.length === 0) {
            nextProblems.push(`segment "${segmentId}" returned an empty repair`);
            continue;
          }
          if (!request.segment.attributeName && !isWellFormedFragment(fragment, request.segment.elementTag)) {
            nextProblems.push(
              `segment "${segmentId}" returned XML that is not well-formed inside <${request.segment.elementTag}>`,
            );
            continue;
          }
          repaired.set(segmentId, fragment);
          nextPending.delete(segmentId);
        }
        pending = nextPending;
        problems = nextProblems;
      } catch (error) {
        if (isAbortError(error, input.signal)) {
          this.recordUsage({
            link,
            sourcePath: input.sourcePath,
            user: input.user,
            model: config.model,
            taskType: 'translate_repair',
            subAction: 'qa_repair',
            status: 'cancelled',
            retryCount: attempts - 1,
            usage,
            durationMs: Date.now() - startedAt,
            errorMessage: describeError(error),
          });
          throw error;
        }
        lastError = describeError(error);
        problems = [`the model call failed: ${lastError}`];
      }
    }

    this.recordUsage({
      link,
      sourcePath: input.sourcePath,
      user: input.user,
      model: config.model,
      taskType: 'translate_repair',
      subAction: 'qa_repair',
      status: repaired.size > 0 ? 'succeeded' : 'failed',
      retryCount: Math.max(0, attempts - 1),
      usage,
      durationMs: Date.now() - startedAt,
      errorMessage:
        repaired.size > 0
          ? null
          : `No usable repair candidate after ${attempts} attempt(s)${lastError ? `: ${lastError}` : ''}`,
    });

    return repaired;
  }

  /**
   * Repairs a whole document rejected by DITA-OT strict validation (`translate_repair` /
   * `dita_ot_repair`). The result is only returned when it survives every structural guard, so the
   * caller can never write a corrupted document into the staging directory.
   */
  async repairDocumentForDitaOt(
    input: RepairDocumentForDitaOtInput,
  ): Promise<RepairDocumentForDitaOtResult> {
    const original = input.proposedXml;
    let fingerprint: ParsedDocumentFingerprint | null;
    try {
      fingerprint = readDocumentFingerprint(original);
    } catch (error) {
      // A proposal that is not even parseable cannot be fingerprinted; let DITA-OT's own failure
      // stand instead of risking a bogus "repair".
      return {
        repaired: false,
        xml: original,
        message: `The proposal could not be parsed: ${describeError(error)}`,
      };
    }
    if (!fingerprint) {
      return { repaired: false, xml: original, message: 'The proposal has no root element.' };
    }
    const isTopic = /\.dita$/i.test(input.filePath);

    const config = this.aiSettings.resolveConfig();
    const startedAt = Date.now();
    const system = [
      `You are a professional DITA 1.3 technical editor repairing ${input.sourceLang} → ${input.targetLang} output that fails DITA-OT strict validation.`,
      '',
      'Rules:',
      '1. Reply with the complete corrected target document XML and nothing else (no prose, no fences).',
      '2. Keep the XML declaration, the DOCTYPE declaration, the root element name and xml:lang unchanged.',
      `3. Fix ONLY what the diagnostics require: the root element must stay <${fingerprint.rootTag}>.`,
      '4. Never translate, reword or restructure content that DITA-OT did not complain about.',
      '5. Keep every id, conref, conkeyref, href, keyref, scope, format, class and CALS span attribute.',
    ].join('\n');
    const model = this.modelFactory(config);
    let usage = ZERO_USAGE;
    let attempts = 0;
    let problems: string[] = [];
    let lastError: string | null = null;
    let accepted: string | null = null;

    while (accepted === null && attempts <= Math.max(0, config.maxRetries)) {
      attempts += 1;
      try {
        const message = await model.invoke(
          buildMessages(system, buildDitaOtRepairPrompt(input, problems)),
          { ...(input.signal ? { signal: input.signal } : {}) },
        );
        usage = addUsage(usage, readUsage(message));
        const candidate = normalizeDocumentReply(messageText(message.content));
        const rejected = validateRepairedDocument(candidate, fingerprint, isTopic);
        if (rejected) {
          lastError = rejected;
          problems = [rejected];
        } else {
          accepted = candidate;
        }
      } catch (error) {
        if (isAbortError(error, input.signal)) {
          this.recordUsage({
            link: input.link,
            sourcePath: input.sourcePath,
            user: input.user,
            model: config.model,
            taskType: 'translate_repair',
            subAction: 'dita_ot_repair',
            status: 'cancelled',
            retryCount: attempts - 1,
            usage,
            durationMs: Date.now() - startedAt,
            errorMessage: describeError(error),
          });
          throw error;
        }
        lastError = describeError(error);
        problems = [`the model call failed: ${lastError}`];
      }
    }

    this.recordUsage({
      link: input.link,
      sourcePath: input.sourcePath,
      user: input.user,
      model: config.model,
      taskType: 'translate_repair',
      subAction: 'dita_ot_repair',
      status: accepted === null ? 'failed' : 'succeeded',
      retryCount: Math.max(0, attempts - 1),
      usage,
      durationMs: Date.now() - startedAt,
      errorMessage: accepted === null ? (lastError ?? 'no usable repair') : null,
    });

    if (accepted === null) {
      return {
        repaired: false,
        xml: original,
        message: `Repair failed after ${attempts} attempt(s): ${lastError ?? 'the model returned no usable document'}`,
      };
    }
    return { repaired: true, xml: accepted };
  }
}

/** Exported for tests: the character budget the batching respects. */
export const TRANSLATION_MAX_BATCH_CHARS = MAX_BATCH_CHARS;
