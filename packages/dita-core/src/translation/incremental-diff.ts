/**
 * Phase 16 Stage 1 — three-way incremental translation engine (`S0 × S1 × T0 → T1`).
 *
 * `planIncrementalTranslation()` aligns the previously translated source (`S0`) and its target
 * (`T0`) against the current source (`S1`) so untouched blocks reuse the human-reviewed target
 * with **zero tokens**, and `assembleTranslatedXml()` splices the result back into the lossless
 * `S1` skeleton (prolog, DOCTYPE, comments, PIs, attribute order all preserved).
 *
 * Alignment is deliberately multi-signal and never silent: when `S0 ↔ T0` diverges beyond the
 * 0.5 match ratio the plan degrades to `full_with_reference` instead of misaligning blocks.
 */

import type * as slimdom from 'slimdom';
import { DITA_TOPIC_ROOT_TAGS } from '../model/dita-elements.js';
import { xmlToPmDoc } from '../prosemirror/converter.js';
import { checkXmlWellFormed, parseXml } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import { checkXmlStructure, type XmlStructureIssue } from '../xml/structure-check.js';
import {
  computeTranslatableDocumentFingerprint,
  extractPlainText,
  extractTranslatableSegments,
  findElementByStructuralPath,
  parseAttributeStructuralPath,
} from './segment-extractor.js';
import type {
  AlignedTranslationSegment,
  AssembleResult,
  DeletedTranslationSegment,
  IncrementalPlanMode,
  IncrementalTranslationPlan,
  SegmentChangeKind,
  SegmentMatchStrategy,
  TranslatableSegment,
} from './types.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

/** `S0 ↔ T0` below this ratio is treated as structural divergence, never as a valid alignment. */
export const STRUCTURAL_DIVERGENCE_THRESHOLD = 0.5;

/** Above this DP size the LCS pass degrades to a linear greedy scan (huge topics stay fast). */
const MAX_LCS_CELLS = 400_000;

const FRAGMENT_WRAPPER = 'ditaeditor_translation_fragment';

interface AlignmentResult {
  /** left index -> right index */
  leftToRight: Map<number, number>;
  /** left index -> strategy that produced the match */
  strategies: Map<number, SegmentMatchStrategy>;
}

function emptyAlignment(): AlignmentResult {
  return { leftToRight: new Map(), strategies: new Map() };
}

function identityKey(segment: TranslatableSegment): string {
  return `${segment.elementTag}\u0001${segment.elementId}\u0001${segment.attributeName ?? ''}`;
}

function pathKey(segment: TranslatableSegment): string {
  return `${segment.elementTag}\u0001${segment.structuralPath}\u0001${segment.attributeName ?? ''}`;
}

/** LCS key for pass 3b: an attribute segment never pairs with an element of the same tag. */
function tagKey(segment: TranslatableSegment): string {
  return segment.attributeName ? `${segment.elementTag}/@${segment.attributeName}` : segment.elementTag;
}

function lcsPairs<T>(left: readonly T[], right: readonly T[]): Array<[number, number]> {
  const n = left.length;
  const m = right.length;
  if (n === 0 || m === 0) return [];

  if (n * m > MAX_LCS_CELLS) {
    // Degrade gracefully: pair equal keys in source order.
    const pairs: Array<[number, number]> = [];
    let cursor = 0;
    for (let i = 0; i < n; i += 1) {
      for (let j = cursor; j < m; j += 1) {
        if (left[i] === right[j]) {
          pairs.push([i, j]);
          cursor = j + 1;
          break;
        }
      }
    }
    return pairs;
  }

  const stride = m + 1;
  const dp = new Uint32Array((n + 1) * stride);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * stride + j] =
        left[i] === right[j]
          ? dp[(i + 1) * stride + (j + 1)]! + 1
          : Math.max(dp[(i + 1) * stride + j]!, dp[i * stride + (j + 1)]!);
    }
  }

  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (dp[(i + 1) * stride + j]! >= dp[i * stride + (j + 1)]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

interface AlignSegmentsOptions {
  /** Prefer an LCS pass on `contentHash` before falling back to `elementTag`. */
  contentHashLcsFirst?: boolean;
}

function alignSegments(
  left: readonly TranslatableSegment[],
  right: readonly TranslatableSegment[],
  options: AlignSegmentsOptions = {},
): AlignmentResult {
  const result = emptyAlignment();
  if (left.length === 0 || right.length === 0) return result;

  const usedRight = new Set<number>();

  const assign = (leftIndex: number, rightIndex: number, strategy: SegmentMatchStrategy): void => {
    if (result.leftToRight.has(leftIndex) || usedRight.has(rightIndex)) return;
    result.leftToRight.set(leftIndex, rightIndex);
    result.strategies.set(leftIndex, strategy);
    usedRight.add(rightIndex);
  };

  // Pass 1 — stable DITA `id` + tag (survives structural re-ordering).
  const rightByIdentity = new Map<string, number[]>();
  right.forEach((segment, index) => {
    if (!segment.elementId) return;
    const key = identityKey(segment);
    const bucket = rightByIdentity.get(key);
    if (bucket) bucket.push(index);
    else rightByIdentity.set(key, [index]);
  });
  left.forEach((segment, index) => {
    if (!segment.elementId) return;
    const bucket = rightByIdentity.get(identityKey(segment));
    if (!bucket) return;
    for (const candidate of bucket) {
      if (usedRight.has(candidate)) continue;
      assign(index, candidate, 'element_id');
      return;
    }
  });

  // Pass 2 — exact structural path + tag.
  const rightByPath = new Map<string, number>();
  right.forEach((segment, index) => {
    const key = pathKey(segment);
    if (!rightByPath.has(key)) rightByPath.set(key, index);
  });
  left.forEach((segment, index) => {
    if (result.leftToRight.has(index)) return;
    const candidate = rightByPath.get(pathKey(segment));
    if (candidate === undefined) return;
    assign(index, candidate, 'structural_path');
  });

  const remainingLeft: number[] = [];
  left.forEach((_segment, index) => {
    if (!result.leftToRight.has(index)) remainingLeft.push(index);
  });
  if (remainingLeft.length === 0) return result;
  const remainingRight: number[] = [];
  right.forEach((_segment, index) => {
    if (!usedRight.has(index)) remainingRight.push(index);
  });
  if (remainingRight.length === 0) return result;

  // Pass 3a — LCS on the block payload hash (identical text, moved block).
  if (options.contentHashLcsFirst) {
    const hashPairs = lcsPairs(
      remainingLeft.map((index) => left[index]!.contentHash),
      remainingRight.map((index) => right[index]!.contentHash),
    );
    for (const [leftPos, rightPos] of hashPairs) {
      assign(remainingLeft[leftPos]!, remainingRight[rightPos]!, 'content_hash');
    }
  }

  // Pass 3b — LCS on the element tag (same shape, edited text).
  const leftStillOpen: number[] = [];
  remainingLeft.forEach((index) => {
    if (!result.leftToRight.has(index)) leftStillOpen.push(index);
  });
  const rightStillOpen: number[] = [];
  remainingRight.forEach((index) => {
    if (!usedRight.has(index)) rightStillOpen.push(index);
  });
  if (leftStillOpen.length === 0 || rightStillOpen.length === 0) return result;

  const tagPairs = lcsPairs(
    leftStillOpen.map((index) => tagKey(left[index]!)),
    rightStillOpen.map((index) => tagKey(right[index]!)),
  );
  for (const [leftPos, rightPos] of tagPairs) {
    assign(leftStillOpen[leftPos]!, rightStillOpen[rightPos]!, 'tag_lcs');
  }

  return result;
}

export interface PlanIncrementalTranslationInput {
  /** Previous translated source snapshot (`git show last_source_commit:path`); omit for first run. */
  prevSourceXml?: string | null;
  /** Current source HEAD baseline (`S1`). */
  currSourceXml: string;
  /** Current target-language translation (`T0`); omit when the file was never translated. */
  prevTargetXml?: string | null;
}

function safeExtract(xml: string | null | undefined): TranslatableSegment[] {
  if (!xml) return [];
  try {
    return extractTranslatableSegments(xml);
  } catch {
    return [];
  }
}

/**
 * Build the deterministic three-way incremental plan for one file.
 * Throws `DitaXmlParseError` only when `currSourceXml` itself is malformed.
 */
export function planIncrementalTranslation(
  input: PlanIncrementalTranslationInput,
): IncrementalTranslationPlan {
  const prevSourceXml = input.prevSourceXml ?? null;
  const prevTargetXml = input.prevTargetXml ?? null;

  const s0 = safeExtract(prevSourceXml);
  const s1 = extractTranslatableSegments(input.currSourceXml);
  const t0 = safeExtract(prevTargetXml);

  const s0t0 = alignSegments(s0, t0);
  const s0s1 = alignSegments(s0, s1, { contentHashLcsFirst: true });

  let s0NonProtected = 0;
  let s0MatchedNonProtected = 0;
  s0.forEach((segment, index) => {
    if (segment.protected) return;
    s0NonProtected += 1;
    if (s0t0.leftToRight.has(index)) s0MatchedNonProtected += 1;
  });
  const matchRatio = s0NonProtected === 0 ? 1 : s0MatchedNonProtected / s0NonProtected;

  const structuralDivergence =
    Boolean(prevSourceXml) &&
    Boolean(prevTargetXml) &&
    s0NonProtected > 0 &&
    matchRatio < STRUCTURAL_DIVERGENCE_THRESHOLD;

  let mode: IncrementalPlanMode = 'incremental';
  if (!prevSourceXml || !prevTargetXml) mode = 'full';
  if (structuralDivergence) mode = 'full_with_reference';

  const s1ToS0 = new Map<number, number>();
  const strategyByS1 = new Map<number, SegmentMatchStrategy>();
  for (const [s0Index, s1Index] of s0s1.leftToRight) {
    s1ToS0.set(s1Index, s0Index);
    const strategy = s0s1.strategies.get(s0Index);
    if (strategy) strategyByS1.set(s1Index, strategy);
  }

  const segments: AlignedTranslationSegment[] = [];
  const stats = { total: 0, unchanged: 0, modified: 0, added: 0, protected: 0, deleted: 0 };

  s1.forEach((segment, index) => {
    const prevIndex = s1ToS0.get(index);
    const prevSource = prevIndex !== undefined ? s0[prevIndex] : undefined;

    let changeKind: SegmentChangeKind;
    let prevTarget: TranslatableSegment | undefined;

    if (segment.protected) {
      changeKind = 'protected';
    } else if (prevSource) {
      const targetIndex = prevIndex !== undefined ? s0t0.leftToRight.get(prevIndex) : undefined;
      prevTarget = targetIndex !== undefined ? t0[targetIndex] : undefined;
      if (!structuralDivergence && prevTarget && prevSource.contentHash === segment.contentHash) {
        changeKind = 'unchanged';
      } else {
        changeKind = 'modified';
      }
    } else {
      changeKind = 'added';
    }

    const aligned: AlignedTranslationSegment = {
      segmentId: segment.segmentId,
      changeKind,
      elementTag: segment.elementTag,
      elementId: segment.elementId,
      structuralPath: segment.structuralPath,
      currSourceXml: segment.sourceXml,
      currSourceText: segment.plainText,
      sourceContentHash: segment.contentHash,
      protected: segment.protected,
    };
    if (segment.protectedReason) aligned.protectedReason = segment.protectedReason;
    if (segment.attributeName) aligned.attributeName = segment.attributeName;
    if (prevSource) {
      aligned.prevSourceXml = prevSource.sourceXml;
      aligned.prevSourceText = prevSource.plainText;
      const matchedBy = strategyByS1.get(index);
      if (matchedBy) aligned.matchedBy = matchedBy;
    }
    if (prevSource && prevTarget) {
      aligned.prevTargetXml = prevTarget.sourceXml;
      aligned.prevTargetText = prevTarget.plainText;
    }
    if (changeKind === 'unchanged' && prevTarget) {
      aligned.proposedTargetXml = prevTarget.sourceXml;
      aligned.proposedTargetText = prevTarget.plainText;
    }
    if (changeKind === 'modified' || changeKind === 'added') {
      aligned.needsReview = true;
    }

    segments.push(aligned);
    stats.total += 1;
    switch (changeKind) {
      case 'unchanged':
        stats.unchanged += 1;
        break;
      case 'modified':
        stats.modified += 1;
        break;
      case 'added':
        stats.added += 1;
        break;
      case 'protected':
        stats.protected += 1;
        break;
      default:
        break;
    }
  });

  const deletedSegments: DeletedTranslationSegment[] = [];
  s0.forEach((segment, index) => {
    if (s0s1.leftToRight.has(index)) return;
    const targetIndex = s0t0.leftToRight.get(index);
    const prevTarget = targetIndex !== undefined ? t0[targetIndex] : undefined;
    const deleted: DeletedTranslationSegment = {
      segmentId: segment.segmentId,
      elementTag: segment.elementTag,
      elementId: segment.elementId,
      structuralPath: segment.structuralPath,
      prevSourceXml: segment.sourceXml,
    };
    if (prevTarget) deleted.prevTargetXml = prevTarget.sourceXml;
    if (segment.attributeName) deleted.attributeName = segment.attributeName;
    deletedSegments.push(deleted);
  });
  stats.deleted = deletedSegments.length;

  const sourceTranslatableHash = computeTranslatableDocumentFingerprint(input.currSourceXml);
  const metadataOnlyChange =
    Boolean(prevSourceXml) &&
    prevSourceXml !== input.currSourceXml &&
    computeTranslatableDocumentFingerprint(prevSourceXml as string) === sourceTranslatableHash;

  return {
    mode,
    matchRatio,
    structuralDivergence,
    segments,
    deletedSegments,
    stats,
    sourceTranslatableHash,
    metadataOnlyChange,
  };
}

export interface AssembleTranslatedXmlInput {
  /** Current source (`S1`) used as the lossless skeleton. */
  sourceXml: string;
  /** Target BCP 47 language applied to the root `xml:lang`. */
  targetLang?: string;
  /** `segmentId` (or structural path) -> translated XML (full element or inner fragment). */
  translatedSegments: Map<string, string> | Record<string, string>;
  /** Plan whose `unchanged` segments are reused deterministically before the overrides apply. */
  plan?: IncrementalTranslationPlan;
  /** Topic-root ProseMirror compatibility probe; defaults to `true`. */
  checkPm?: boolean;
}

function elementChildrenOf(el: slimdom.Element): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === ELEMENT_NODE) out.push(child as slimdom.Element);
  }
  return out;
}

function cloneNodeIntoDocument(node: slimdom.Node, doc: slimdom.Document): slimdom.Node {
  switch (node.nodeType) {
    case ELEMENT_NODE: {
      const source = node as slimdom.Element;
      const el = doc.createElement(source.tagName);
      for (const attr of Array.from(source.attributes)) {
        try {
          if (attr.namespaceURI) {
            el.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
          } else {
            el.setAttribute(attr.name, attr.value);
          }
        } catch {
          el.setAttribute(attr.name, attr.value);
        }
      }
      for (const child of Array.from(source.childNodes)) {
        el.appendChild(cloneNodeIntoDocument(child, doc));
      }
      return el;
    }
    case TEXT_NODE:
      return doc.createTextNode(node.nodeValue ?? '');
    case CDATA_SECTION_NODE:
      return doc.createCDATASection(node.nodeValue ?? '');
    case PROCESSING_INSTRUCTION_NODE: {
      const pi = node as slimdom.ProcessingInstruction;
      return doc.createProcessingInstruction(pi.target, pi.data ?? '');
    }
    case COMMENT_NODE:
      return doc.createComment(node.nodeValue ?? '');
    default:
      return doc.createTextNode(node.nodeValue ?? '');
  }
}

function stripModelNoise(raw: string): string {
  let text = raw.trim();

  const fenced = /^```[A-Za-z0-9_-]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/.exec(text);
  if (fenced) text = fenced[1]!.trim();

  for (let pass = 0; pass < 2; pass += 1) {
    if (text.startsWith('<?xml')) {
      const end = text.indexOf('?>');
      if (end < 0) break;
      text = text.slice(end + 2).trim();
      continue;
    }
    if (text.startsWith('<!DOCTYPE')) {
      let depth = 0;
      let cut = -1;
      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '[') depth += 1;
        else if (ch === ']') depth -= 1;
        else if (ch === '>' && depth <= 0) {
          cut = i + 1;
          break;
        }
      }
      if (cut < 0) break;
      text = text.slice(cut).trim();
      continue;
    }
    break;
  }

  return text;
}

interface ParsedSnippet {
  nodes: slimdom.Node[];
  tagName: string | null;
}

/**
 * Parse a translated snippet. Accepts a full `<tag …>inner</tag>` element or a bare inner
 * fragment; for a full element only the children are used, because the target element keeps the
 * `S1` element's own attributes (`id`, `href`, `keyref`, `conref`, conditional/CALS attrs, order).
 */
function parseSnippet(xml: string, targetDoc: slimdom.Document): ParsedSnippet | null {
  const text = stripModelNoise(xml);
  if (text.length === 0) return { nodes: [], tagName: null };

  let parsed;
  try {
    parsed = parseXml(`<${FRAGMENT_WRAPPER}>${text}</${FRAGMENT_WRAPPER}>`, {
      position: false,
    });
  } catch {
    return null;
  }

  const wrapper = parsed.document.documentElement;
  if (!wrapper) return null;

  const children = elementChildrenOf(wrapper);
  const singleElement = children.length === 1 && wrapper.childNodes.length === 1;
  if (singleElement) {
    const element = children[0]!;
    const nodes = Array.from(element.childNodes).map((child) =>
      cloneNodeIntoDocument(child, targetDoc),
    );
    return { nodes, tagName: element.tagName };
  }

  const nodes = Array.from(wrapper.childNodes).map((child) =>
    cloneNodeIntoDocument(child, targetDoc),
  );
  return { nodes, tagName: null };
}

function replaceElementChildren(el: slimdom.Element, nodes: slimdom.Node[]): void {
  for (const child of Array.from(el.childNodes)) {
    el.removeChild(child);
  }
  for (const node of nodes) {
    el.appendChild(node);
  }
}

function asEntries(
  input: Map<string, string> | Record<string, string>,
): Array<[string, string]> {
  if (input instanceof Map) {
    return Array.from(input.entries()).map(([key, value]) => [String(key), String(value)]);
  }
  return Object.entries(input).map(([key, value]) => [key, String(value)]);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Resolve the plain-text value of a translated *attribute* segment.
 *
 * Returns `null` when the payload cannot be trusted, in which case the caller keeps the source
 * attribute value and records a warning — one bad model reply never rewrites a `href`/`navtitle`.
 */
function resolveAttributeSnippet(
  snippetXml: string,
  attributeName: string,
  structuralPath: string,
  warnings: string[],
): string | null {
  const text = stripModelNoise(snippetXml);
  if (text.length === 0) {
    warnings.push(
      `Segment "${structuralPath}" has an empty attribute translation; the original attribute value was kept.`,
    );
    return null;
  }

  let wrapper: slimdom.Element | null = null;
  try {
    wrapper = parseXml(`<${FRAGMENT_WRAPPER}>${text}</${FRAGMENT_WRAPPER}>`, {
      position: false,
    }).document.documentElement;
  } catch {
    wrapper = null;
  }

  if (wrapper) {
    const children = elementChildrenOf(wrapper);
    if (children.length === 1 && wrapper.childNodes.length === 1) {
      const element = children[0]!;
      const echoed = element.getAttribute(attributeName);
      // The model echoed the tag (`<topichead navtitle="Concepts"/>`): take its attribute value.
      if (echoed !== null && extractPlainText(element).length === 0) return echoed;
    }
    return extractPlainText(wrapper);
  }

  if (!text.includes('<') && !text.includes('>')) {
    // The common model reply for an attribute is bare text, so an unescaped `&` (`CI & CD`) is
    // expected here and must be accepted as plain text rather than rejected as malformed XML.
    return text.replace(/\s+/g, ' ').trim();
  }

  warnings.push(
    `Segment "${structuralPath}" translated attribute value is not well-formed XML; the original attribute value was kept.`,
  );
  return null;
}

/**
 * Splice translated blocks back into the `S1` skeleton and verify the result.
 *
 * Never throws for bad segment payloads: an unparsable snippet is reported in `warnings` and the
 * original `S1` block survives, so one broken model reply cannot destroy a whole document.
 */
export function assembleTranslatedXml(input: AssembleTranslatedXmlInput): AssembleResult {
  const warnings: string[] = [];
  const wellFormedSource = checkXmlWellFormed(input.sourceXml, { position: false });
  if (!wellFormedSource.ok) {
    return {
      ok: false,
      xml: input.sourceXml,
      wellFormedError: wellFormedSource.error,
      structureIssues: [],
      pmCompatible: false,
      warnings,
    };
  }

  const parsed = wellFormedSource.parsed;
  const doc = parsed.document;
  const root = doc.documentElement;
  if (!root) {
    return {
      ok: false,
      xml: input.sourceXml,
      wellFormedError: {
        line: 1,
        column: 1,
        offset: 0,
        message: 'Source XML has no root element.',
      },
      structureIssues: [],
      pmCompatible: false,
      warnings,
    };
  }

  if (input.targetLang && input.targetLang.trim().length > 0) {
    root.setAttribute('xml:lang', input.targetLang.trim());
  }

  const replacements = new Map<string, string>();
  const pathBySegmentId = new Map<string, string>();

  if (input.plan) {
    for (const segment of input.plan.segments) {
      pathBySegmentId.set(segment.segmentId, segment.structuralPath);
      if (segment.changeKind === 'unchanged' && segment.proposedTargetXml !== undefined) {
        replacements.set(segment.structuralPath, segment.proposedTargetXml);
      }
    }
  }

  for (const [key, value] of asEntries(input.translatedSegments)) {
    const path = pathBySegmentId.get(key) ?? (key.startsWith('/') ? key : undefined);
    if (!path) {
      warnings.push(
        `Unknown translation segment key "${key}": expected a segmentId or a structural path.`,
      );
      continue;
    }
    replacements.set(path, value);
  }

  for (const [structuralPath, snippetXml] of replacements) {
    // Attribute segments (`navtitle="…"`, map `title="…"`) update the owning element in place:
    // `setAttribute` preserves attribute order, quoting, DOCTYPE, comments and PIs, and
    // `serializeXml()` re-escapes `&`, `<` and `"` in the value.
    const attributeRef = parseAttributeStructuralPath(structuralPath);
    if (attributeRef) {
      const owner = findElementByStructuralPath(doc, attributeRef.elementPath);
      if (!owner) {
        warnings.push(
          `Segment "${structuralPath}" was not found in the current source; its translation was skipped.`,
        );
        continue;
      }
      const value = resolveAttributeSnippet(
        snippetXml,
        attributeRef.attributeName,
        structuralPath,
        warnings,
      );
      if (value === null) continue;
      owner.setAttribute(attributeRef.attributeName, value);
      continue;
    }

    const target = findElementByStructuralPath(doc, structuralPath);
    if (!target) {
      warnings.push(
        `Segment "${structuralPath}" was not found in the current source; its translation was skipped.`,
      );
      continue;
    }
    const snippet = parseSnippet(snippetXml, doc);
    if (!snippet) {
      warnings.push(
        `Segment "${structuralPath}" translated XML is not well-formed; the original source block was kept.`,
      );
      continue;
    }
    if (snippet.tagName && snippet.tagName !== target.tagName) {
      warnings.push(
        `Segment "${structuralPath}" translated element is <${snippet.tagName}> but the source element is <${target.tagName}>; only its children were applied.`,
      );
    }
    replaceElementChildren(target, snippet.nodes);
  }

  const xml = serializeXml(parsed);
  const wellFormed = checkXmlWellFormed(xml);
  if (!wellFormed.ok) {
    return {
      ok: false,
      xml,
      wellFormedError: wellFormed.error,
      structureIssues: [],
      pmCompatible: false,
      warnings,
    };
  }

  const structure = checkXmlStructure(xml);
  const structureIssues: XmlStructureIssue[] = structure.ok ? structure.issues : [];

  let pmCompatible = true;
  let pmError: string | undefined;
  const rootTag = root.tagName;
  if (input.checkPm !== false && DITA_TOPIC_ROOT_TAGS.has(rootTag)) {
    try {
      xmlToPmDoc(xml, { position: false });
    } catch (err) {
      pmCompatible = false;
      pmError = errorMessage(err);
    }
  }

  const result: AssembleResult = {
    ok: pmCompatible,
    xml,
    structureIssues: structureIssues as unknown as AssembleResult['structureIssues'],
    pmCompatible,
    warnings,
  };
  if (pmError !== undefined) result.pmError = pmError;
  return result;
}
