/**
 * Writer role — one planned topic → deterministic, standards-correct DITA 1.3 XML.
 *
 * The model only proposes XML; `postProcessGeneratedTopicXml()` is the authority on the final
 * bytes: canonical prolog + OASIS DOCTYPE, `id`/`xml:lang` synchronisation, exact relative asset
 * hrefs and deterministic serialization.
 */

import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import {
  buildDitaConstraintSummary,
  computeRelativeDitaHref,
  normalizeCandidateXml,
  parseXml,
  serializeXml,
  sliceMarkdownForTopic,
  type DitaTopicTemplateType,
  type ExtractedIngestAsset,
  type PlannedTopicNode,
  type XmlDoctypeInfo,
  type XmlDeclaration,
} from '@dita/core';
import type { ResolvedAiConfig } from '../../ai/ai-settings-service.js';
import {
  throwIfAborted,
  type ConcurrentDraftOptions,
  type DraftTopicInput,
  type DraftTopicResult,
  type IngestAgentContext,
  type IngestAgentDeps,
  type PostProcessTopicOptions,
} from './types.js';

const XML_DECLARATION_RAW = '<?xml version="1.0" encoding="UTF-8"?>';
const XML_DECLARATION: XmlDeclaration = { raw: XML_DECLARATION_RAW, version: '1.0', encoding: 'UTF-8' };

/** Canonical OASIS DITA 1.3 topic DOCTYPEs (one per modeled topic type). */
const TOPIC_DOCTYPES: Record<DitaTopicTemplateType, XmlDoctypeInfo> = {
  concept: {
    name: 'concept',
    publicId: '-//OASIS//DTD DITA Concept//EN',
    systemId: 'concept.dtd',
    raw: '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
  },
  task: {
    name: 'task',
    publicId: '-//OASIS//DTD DITA Task//EN',
    systemId: 'task.dtd',
    raw: '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
  },
  reference: {
    name: 'reference',
    publicId: '-//OASIS//DTD DITA Reference//EN',
    systemId: 'reference.dtd',
    raw: '<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">',
  },
  topic: {
    name: 'topic',
    publicId: '-//OASIS//DTD DITA Topic//EN',
    systemId: 'topic.dtd',
    raw: '<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">',
  },
};

const TOPIC_TAGS = new Set<string>(['concept', 'task', 'reference', 'topic']);
const DEFAULT_LANGUAGE = 'en';
const ELEMENT_NODE = 1;
const XML_LANG_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
/** Absolute, non-DITA hrefs that always need `scope="external"`. */
const EXTERNAL_LINK_HREF = /^(?:https?:\/\/|mailto:)/iu;
const HTTP_LINK_HREF = /^https?:\/\//iu;

/** Non-null element handle for the slimdom documents produced by `parseXml`. */
type XmlElementNode = NonNullable<ReturnType<typeof parseXml>['document']['documentElement']>;

/** Canonical DOCTYPE for a modeled topic type (exported for Stage 3 / tests). */
export function topicDoctypeFor(type: DitaTopicTemplateType): XmlDoctypeInfo {
  return TOPIC_DOCTYPES[type] ?? TOPIC_DOCTYPES.topic;
}

/* ------------------------------------------------------------------------------------------ */
/* Post-processing                                                                            */
/* ------------------------------------------------------------------------------------------ */

/**
 * Turns arbitrary model output into the final topic XML.
 *
 * Handles `<dita_topic>` / `<dita_patch>` wrappers, fenced code, bare XML and malformed prologs.
 * Never throws: an unparseable reply still gets a repaired prolog so Layer 1 can report the exact
 * well-formedness error with line numbers.
 */
export function postProcessGeneratedTopicXml(rawOutput: string, options: PostProcessTopicOptions): string {
  const assetRewritten = rewriteAssetReferences(extractTopicXml(rawOutput), options);
  const doctype = topicDoctypeFor(options.node.type);

  const parsed = tryParse(assetRewritten);
  if (!parsed) {
    return repairPrologTextually(assetRewritten, doctype);
  }

  const document = parsed.document;
  const root = coerceRootElement(document, options.node.type);
  if (!root) return repairPrologTextually(assetRewritten, doctype);
  setAttribute(root, 'id', options.node.topicId);
  setAttribute(root, 'xml:lang', options.language || DEFAULT_LANGUAGE);
  normalizeExternalLinkTargets(root);

  const xml = serializeXml({ document, xmlDeclaration: XML_DECLARATION, doctype });
  return xml.endsWith('\n') ? xml : `${xml}\n`;
}

/** Strips `<dita_topic>` / `<dita_patch>` wrappers and markdown fences; falls back to bare XML. */
export function extractTopicXml(rawOutput: string): string {
  const trimmed = rawOutput.trim();
  const topic = sliceBetween(trimmed, '<dita_topic>', '</dita_topic>');
  if (topic !== null) return normalizeCandidateXml(topic);
  const patch = sliceBetween(trimmed, '<dita_patch>', '</dita_patch>');
  if (patch !== null) return normalizeCandidateXml(patch);
  return normalizeCandidateXml(rewriteBareTopicFence(trimmed));
}

function rewriteBareTopicFence(raw: string): string {
  const fence = /```(?:xml|XML|dita|DITA)?\s*\n?([\s\S]*?)```/u.exec(raw);
  if (fence?.[1]?.includes('<')) return fence[1].trim();
  return raw;
}

function sliceBetween(raw: string, open: string, close: string): string | null {
  const start = raw.indexOf(open);
  if (start === -1) return null;
  const end = raw.lastIndexOf(close);
  if (end <= start) return null;
  return raw.slice(start + open.length, end);
}

/** Rewrites every `asset://img_NNN[.ext]` reference to the exact relative DITA href. */
export function rewriteAssetReferences(
  xml: string,
  options: { node: PlannedTopicNode; assetPathById: ReadonlyMap<string, string> },
): string {
  return xml.replace(/asset:\/\/([^\s"'<>)]+)/gu, (match, token: string) => {
    const hashIndex = token.indexOf('#');
    const fragment = hashIndex >= 0 ? token.slice(hashIndex) : '';
    const bare = hashIndex >= 0 ? token.slice(0, hashIndex) : token;
    const candidates = [bare, bare.replace(/\.[A-Za-z0-9]+$/u, '')];
    for (const candidate of candidates) {
      const workspacePath = options.assetPathById.get(candidate);
      if (workspacePath) {
        return `${computeRelativeDitaHref(options.node.filePath, workspacePath)}${fragment}`;
      }
    }
    return match;
  });
}

function tryParse(xml: string): { document: ReturnType<typeof parseXml>['document'] } | null {
  try {
    return { document: parseXml(xml).document };
  } catch {
    return null;
  }
}

/** Ensures the root element is the planned topic type, wrapping fragments when needed. */
function coerceRootElement(
  document: ReturnType<typeof parseXml>['document'],
  type: DitaTopicTemplateType,
): ReturnType<typeof parseXml>['document']['documentElement'] {
  const root = document.documentElement;
  if (!root) return null;
  if (root.localName === type) return root;

  const replacement = document.createElementNS(null, type);
  if (TOPIC_TAGS.has(root.localName)) {
    // Same content model family: keep the existing children/attributes, just rename the root.
    for (const attr of Array.from(root.attributes)) {
      replacement.setAttribute(attr.name, attr.value);
    }
    while (root.firstChild) replacement.appendChild(root.firstChild);
  } else {
    // A fragment (e.g. bare `<section>`): nest it so the topic stays schema-valid.
    replacement.appendChild(root);
  }
  document.replaceChild(replacement, root);
  return replacement;
}

function setAttribute(element: { setAttribute(name: string, value: string): void; setAttributeNS(ns: string, name: string, value: string): void }, name: string, value: string): void {
  if (name === 'xml:lang') {
    try {
      element.setAttributeNS(XML_LANG_NAMESPACE, name, value);
      return;
    } catch {
      // Fall through to the prefix-preserving plain attribute below.
    }
  }
  element.setAttribute(name, value);
}

/**
 * Deterministic post-processing of external links: DITA requires `scope="external"` on any
 * `<xref>` / `<link>` that leaves the map, and a `format` hint for HTTP(S) targets. The model is
 * unreliable here, so the workbench enforces it in code — and only adds what is missing, which
 * keeps the pass idempotent.
 *
 * Walks via `nodeType` / `childNodes[i]` (AGENTS.md §4.5) — never `instanceof slimdom.*`.
 */
function normalizeExternalLinkTargets(root: XmlElementNode | null): void {
  if (!root || root.nodeType !== ELEMENT_NODE) return;
  const tagName = root.localName ?? '';
  if (tagName === 'xref' || tagName === 'link') normalizeExternalLinkAttributes(root);
  const children = root.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child && child.nodeType === ELEMENT_NODE) {
      normalizeExternalLinkTargets(child as XmlElementNode);
    }
  }
}

function normalizeExternalLinkAttributes(element: XmlElementNode): void {
  const href = element.getAttribute('href')?.trim() ?? '';
  if (!EXTERNAL_LINK_HREF.test(href)) return;
  if (element.getAttribute('scope') !== 'external') element.setAttribute('scope', 'external');
  if (!HTTP_LINK_HREF.test(href) || element.getAttribute('format')) return;
  const pathOnly = href.split(/[?#]/u)[0] ?? '';
  element.setAttribute('format', /\.pdf$/iu.test(pathOnly) ? 'pdf' : 'html');
}

/**
 * Last-resort prolog repair for unparseable replies: guarantees a declaration and a canonical
 * DOCTYPE, so Layer 1 reports the genuine content error rather than a missing-DOCTYPE error.
 */
function repairPrologTextually(xml: string, doctype: XmlDoctypeInfo): string {
  let body = xml.trim();
  body = body.replace(/^<\?xml\b[^>]*\?>\s*/u, '');
  body = body.replace(/<!DOCTYPE\b(?:[^>[]|\[[\s\S]*?\])*>\s*/u, '');
  const canonical = doctype.raw ?? `<!DOCTYPE ${doctype.name} PUBLIC "${doctype.publicId ?? ''}" "${doctype.systemId ?? ''}">`;
  return `${XML_DECLARATION_RAW}\n${canonical}\n${body}${body.endsWith('\n') ? '' : '\n'}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Drafting                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/**
 * Drafts a single topic. Usage is recorded as `ingest_write` / `subAction: node.type` with the
 * generated `filePath` — never the document body.
 */
export async function draftTopicWithAgent(
  input: DraftTopicInput,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<DraftTopicResult> {
  throwIfAborted(ctx.signal);
  const language = input.language || DEFAULT_LANGUAGE;
  const assetPathById = input.assetPathById ?? new Map<string, string>();
  const warnings: string[] = [];
  const slice = sliceMarkdownForTopic(input.markdown, input.sections, input.node.sectionIds ?? [], 18_000);
  if (slice.truncated) {
    warnings.push(`Markdown for ${input.node.filePath} was truncated to fit the writer prompt.`);
  }

  const config = deps.settings.resolveConfig();
  if (!config.apiKey) {
    throw new Error('AI model is not configured (no API key); cannot draft topics.');
  }

  const messages: BaseMessage[] = [
    new SystemMessage(buildWriterSystemPrompt(input.node, language, ctx)),
    new HumanMessage(buildWriterUserPrompt(input, slice.markdown, language, ctx, assetPathById)),
  ];
  const model = deps.modelFactory(config);
  const startedAt = Date.now();
  let message: AIMessage;
  try {
    message = await model.invoke(messages);
    throwIfAborted(ctx.signal);
  } catch (error) {
    recordWriterUsage(deps, ctx, input.node, config, {
      status: ctx.signal?.aborted ? 'cancelled' : 'failed',
      durationMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorMessage: describeError(error),
    });
    throw error;
  }

  const usage = readUsage(message);
  const xml = postProcessGeneratedTopicXml(readMessageText(message), {
    node: input.node,
    language,
    assetPathById,
  });
  recordWriterUsage(deps, ctx, input.node, config, {
    status: 'succeeded',
    durationMs: Date.now() - startedAt,
    ...usage,
  });
  return { xml, warnings };
}

/**
 * Drafts topics with a bounded worker pool (default concurrency 2) and respects `ctx.signal`
 * between every topic so a cancelled import stops cleanly.
 */
export async function draftTopicsConcurrently(
  nodes: readonly PlannedTopicNode[],
  options: ConcurrentDraftOptions,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<Array<{ node: PlannedTopicNode; xml: string; warnings: string[] }>> {
  const concurrency = options.concurrency ?? 2;
  return runWithConcurrency(
    nodes,
    concurrency,
    async (node) => {
      const draft = await draftTopicWithAgent({ ...options, node }, deps, ctx);
      return { node, xml: draft.xml, warnings: draft.warnings };
    },
    ctx.signal,
  );
}

/** Generic bounded concurrency pool that stops between items when the signal fires. */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(Math.floor(concurrency) || 1, items.length || 1));
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      throwIfAborted(signal);
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ------------------------------------------------------------------------------------------ */
/* Prompts & usage                                                                            */
/* ------------------------------------------------------------------------------------------ */

function buildWriterSystemPrompt(
  node: PlannedTopicNode,
  language: string,
  ctx: IngestAgentContext,
): string {
  return [
    'You are the Writing agent of a DITA 1.3 authoring workbench.',
    'You write ONE complete DITA topic as XML. Never explain, never summarize, never use markdown fences.',
    '',
    `Wrap the whole topic in <dita_topic>...</dita_topic>.`,
    `Topic type: ${node.type}. Root element must be <${node.type} id="${node.topicId}" xml:lang="${language}">.`,
    '',
    'OASIS DITA 1.3 authoring rules:',
    buildDitaConstraintSummary(node.type, null, ctx.locale),
    '- Every topic starts with <title>. Concepts use <shortdesc>, <conbody>.',
    '- <task> shape: <task id="…" xml:lang="…"><title>…</title><shortdesc>?</shortdesc>',
    '  <taskbody><prereq>?</prereq><context>?</context><steps><step><cmd>…</cmd><info>?</info>',
    '  <stepresult>?</stepresult></step></steps><result>?</result><tasktroubleshooting>?</tasktroubleshooting>',
    '  <example>?</example><postreq>?</postreq></taskbody></task>.',
    '  Never put <prereq>, <context>, <steps>, <section>, or <p> directly inside <task> outside',
    '  <taskbody>; never put <result> inside <step> (a <step> holds <cmd>, <info>, <stepxmp>,',
    '  <stepresult>, <substeps>, <choices>, <choicetable>, <steptroubleshooting>).',
    '- <reference> uses <refbody> with <section>, <properties>, <refsyn> or <table>.',
    '- Markdown tables become CALS <table> (with <tgroup cols="N">, <colspec>, <thead>/<tbody>,',
    '  <row>, <entry>) or <simpletable>; keep every cell as its own <entry>/<stentry>.',
    '- Fenced code becomes <codeblock> (preserve line breaks and indentation verbatim).',
    '- Admonitions/notes become <note type="note|tip|important|warning|attention|caution">.',
    '- Inline code becomes <codeph>, UI paths <filepath>, keys <uicontrol>, variables <varname>.',
    '- Images MUST use <fig><title>Title</title><image href="RELATIVE"><alt>alt</alt></image></fig>',
    '  (or <image> inline) with EXACTLY the href given in the image mapping list.',
    '- Cross-topic links use <xref href="relative/path.dita"/>, never absolute paths or URLs to local files.',
    '- External URLs (http://, https://, mailto:) inside <xref> MUST carry scope="external" and',
    '  format="html" (format="pdf" for .pdf targets).',
    '- Escape &, < and > in text. Do not invent conrefs, keys or metadata you were not given.',
    `- Write all prose in the language: ${language}.`,
  ].join('\n');
}

function buildWriterUserPrompt(
  input: DraftTopicInput,
  markdown: string,
  language: string,
  ctx: IngestAgentContext,
  assetPathById: ReadonlyMap<string, string>,
): string {
  const lines = [
    `Topic title: ${input.node.title}`,
    `Topic id: ${input.node.topicId}`,
    `Topic type: ${input.node.type}`,
    `File path: ${input.node.filePath}`,
    `Language: ${language}`,
  ];
  if (input.node.navTitle) lines.push(`Navigation title: ${input.node.navTitle}`);
  if (input.node.summary) lines.push(`Planner summary: ${input.node.summary}`);

  const imageLines = describeAssetMapping(input.node.filePath, input.assets, assetPathById);
  lines.push('', 'Image mapping (use the right-hand href verbatim):', imageLines.length > 0 ? imageLines.join('\n') : '(no images in this topic)');

  const siblings = (input.siblingPaths ?? []).filter((path) => path !== input.node.filePath).slice(0, 20);
  if (siblings.length > 0) {
    lines.push('', 'Sibling topics you may cross-reference with <xref>:', siblings.join('\n'));
  }
  if (ctx.keyspaceSummary && ctx.keyspaceSummary.length > 0) {
    lines.push(
      '',
      'Existing key definitions you may reference with keyref:',
      ctx.keyspaceSummary
        .slice(0, 25)
        .map((entry) => `${entry.keys}${entry.keyword ? ` = ${entry.keyword}` : ''}`)
        .join('\n'),
    );
  }
  if (input.instruction?.trim()) {
    lines.push('', `Author instruction: ${input.instruction.trim()}`);
  }
  lines.push('', 'Source Markdown for this topic:', markdown);
  return lines.join('\n');
}

/** `asset://img_001.png → ../images/img_001.png` lines for the writer prompt. */
function describeAssetMapping(
  topicFilePath: string,
  assets: readonly ExtractedIngestAsset[] | undefined,
  assetPathById: ReadonlyMap<string, string>,
): string[] {
  const lines: string[] = [];
  const byId = new Map<string, ExtractedIngestAsset>();
  for (const asset of assets ?? []) byId.set(asset.assetId, asset);
  for (const [assetId, workspacePath] of assetPathById) {
    const asset = byId.get(assetId);
    const token = asset ? `asset://${asset.assetId}.${asset.extension}` : `asset://${assetId}`;
    lines.push(`${token} → ${computeRelativeDitaHref(topicFilePath, workspacePath)}`);
  }
  return lines.sort();
}

function recordWriterUsage(
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
  node: PlannedTopicNode,
  config: ResolvedAiConfig,
  input: {
    status: 'succeeded' | 'failed' | 'cancelled';
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    errorMessage?: string;
  },
): void {
  try {
    deps.usage.record({
      projectId: ctx.projectId,
      branch: ctx.branch,
      userId: ctx.user.id,
      userDisplayName: ctx.user.displayName,
      taskType: 'ingest_write',
      subAction: node.type,
      filePath: node.filePath,
      model: config.model,
      status: input.status,
      retryCount: 0,
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

function readUsage(message: AIMessage): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const usage = message.usage_metadata;
  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;
  return { promptTokens, completionTokens, totalTokens: usage?.total_tokens ?? promptTokens + completionTokens };
}

function readMessageText(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return String(content ?? '');
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
