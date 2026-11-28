/**
 * Phase 16 Stage 1 — post-translation QA (deterministic, pre-review gate).
 *
 * These checks never call a model: they catch the failure modes that translation memories and LLMs
 * produce most often — dropped inline markup, rewritten `href`/`keyref`, lost `{0}` placeholders,
 * ignored glossary terms and translated do-not-translate strings.
 */

import type * as slimdom from 'slimdom';
import { isInlineElementName } from '../model/dita-elements.js';
import { checkXmlWellFormed, parseXml } from '../xml/parser.js';
import { matchGlossaryTerms } from './glossary-matcher.js';
import type {
  GlossaryEntryForMatch,
  RunTranslationQaInput,
  TranslationQaIssue,
  TranslationQaSegmentInput,
} from './types.js';

const ELEMENT_NODE = 1;
const QA_WRAPPER = 'ditaeditor_qa_fragment';

/** Attributes a translation must copy verbatim; the source value is the only valid value. */
const PROTECTED_ATTRIBUTES = [
  'id',
  'href',
  'keyref',
  'conref',
  'conkeyref',
  'scope',
  'format',
] as const;

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\{\d+\}/g,
  /\{\{[A-Za-z0-9_.-]+\}\}/g,
  /%(\d+\$)?[sdif]/g,
  /\$\{[A-Za-z0-9_.-]+\}/g,
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Parse a segment payload into a root element, unwrapping a bare inner fragment. */
function parseSegmentElement(xml: string): slimdom.Element | null {
  const text = xml.trim();
  if (text.length === 0) return null;
  try {
    const parsed = parseXml(`<${QA_WRAPPER}>${text}</${QA_WRAPPER}>`, { position: false });
    const wrapper = parsed.document.documentElement;
    if (!wrapper) return null;
    const elementChildren: slimdom.Element[] = [];
    for (const child of Array.from(wrapper.childNodes)) {
      if (child.nodeType === ELEMENT_NODE) elementChildren.push(child as slimdom.Element);
    }
    if (elementChildren.length === 1 && wrapper.childNodes.length === 1) {
      return elementChildren[0]!;
    }
    return wrapper;
  } catch {
    return null;
  }
}

function collectInlineTags(root: slimdom.Element): string[] {
  const tags: string[] = [];
  const walk = (el: slimdom.Element): void => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const childEl = child as slimdom.Element;
      if (isInlineElementName(childEl.tagName)) tags.push(childEl.tagName);
      walk(childEl);
    }
  };
  walk(root);
  return tags;
}

interface ProtectedAttributeOccurrence {
  tagName: string;
  attrName: string;
  value: string;
}

/**
 * Collect the protected attributes of `root`'s **descendant** elements, not of `root` itself.
 *
 * `root` is excluded on purpose: `assembleTranslatedXml()` always keeps the outer block element's
 * own attributes (`id`, conditional profiling, `xml:space`, …) from `S1` and only splices the
 * children of the translated snippet, so a target payload such as `<p id="p1">译文</p>` and a bare
 * inner fragment `译文` are both legitimate and neither may be judged against `S1`'s `<p>` here.
 */
function collectProtectedAttributes(root: slimdom.Element): ProtectedAttributeOccurrence[] {
  const out: ProtectedAttributeOccurrence[] = [];
  const walk = (el: slimdom.Element): void => {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const childEl = child as slimdom.Element;
      for (const name of PROTECTED_ATTRIBUTES) {
        const value = childEl.getAttribute(name);
        if (value === null) continue;
        out.push({ tagName: childEl.tagName, attrName: name, value });
      }
      walk(childEl);
    }
  };
  walk(root);
  return out;
}

/** Group occurrences by `(tagName, attrName)` so comparison is reorder-tolerant. */
function groupProtectedAttributes(
  occurrences: ProtectedAttributeOccurrence[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.tagName}\u0001${occurrence.attrName}`;
    const bucket = out.get(key);
    if (bucket) bucket.push(occurrence.value);
    else out.set(key, [occurrence.value]);
  }
  return out;
}

/** Values of `left` that have no counterpart in `right` (multiset difference, stable order). */
function multisetSubtract(left: string[], right: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const value of right) remaining.set(value, (remaining.get(value) ?? 0) + 1);
  const out: string[] = [];
  for (const value of left) {
    const count = remaining.get(value) ?? 0;
    if (count > 0) remaining.set(value, count - 1);
    else out.push(value);
  }
  return out;
}

function extractPlaceholders(text: string): string[] {
  const found: string[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) found.push(match[0]);
    }
  }
  return found.sort();
}

function describeAttributeKey(key: string): string {
  const [tagName, attrName] = key.split('\u0001');
  return `<${tagName ?? '?'} ${attrName ?? '?'}>`;
}

function containsTerm(haystack: string, needle: string, caseSensitive: boolean): boolean {
  if (needle.length === 0) return true;
  if (caseSensitive) return haystack.includes(needle);
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function checkSegment(
  segment: TranslationQaSegmentInput,
  glossary: GlossaryEntryForMatch[],
): TranslationQaIssue[] {
  const issues: TranslationQaIssue[] = [];
  const push = (issue: TranslationQaIssue): void => {
    issues.push({ ...issue, segmentId: segment.segmentId });
  };

  const targetWellFormed = checkXmlWellFormed(`<${QA_WRAPPER}>${segment.targetXml}</${QA_WRAPPER}>`, {
    position: false,
  });
  if (!targetWellFormed.ok) {
    push({
      code: 'xml_malformed',
      severity: 'error',
      message: `Translated XML is not well-formed: ${targetWellFormed.error.message}`,
    });
  }

  if (segment.protected === true) {
    // Protected blocks are copied verbatim by design; only well-formedness matters.
    return issues;
  }

  const sourceRoot = parseSegmentElement(segment.sourceXml);
  const targetRoot = parseSegmentElement(segment.targetXml);

  if (sourceRoot && targetRoot) {
    const sourceInline = collectInlineTags(sourceRoot);
    const targetInline = collectInlineTags(targetRoot);
    const sourceCounts = new Map<string, number>();
    for (const tag of sourceInline) sourceCounts.set(tag, (sourceCounts.get(tag) ?? 0) + 1);
    const targetCounts = new Map<string, number>();
    for (const tag of targetInline) targetCounts.set(tag, (targetCounts.get(tag) ?? 0) + 1);
    const allTags = new Set([...sourceCounts.keys(), ...targetCounts.keys()]);
    for (const tag of allTags) {
      const expected = sourceCounts.get(tag) ?? 0;
      const actual = targetCounts.get(tag) ?? 0;
      if (expected === actual) continue;
      push({
        code: 'inline_tag_mismatch',
        severity: 'error',
        message: `Inline element <${tag}> count changed: source has ${expected}, translation has ${actual}.`,
        expected: `${expected}×<${tag}>`,
        actual: `${actual}×<${tag}>`,
      });
    }

    // Compare protected attributes per (tagName, attrName) as sorted multisets: swapping two inline
    // elements for natural target-language word order is legitimate, while dropping or mutating any
    // `href`/`keyref`/`conref`/`conkeyref`/`scope`/`format`/`id` is still reported with exact values.
    const sourceAttrs = groupProtectedAttributes(collectProtectedAttributes(sourceRoot));
    const targetAttrs = groupProtectedAttributes(collectProtectedAttributes(targetRoot));
    const attrKeys = [...new Set([...sourceAttrs.keys(), ...targetAttrs.keys()])].sort();
    for (const key of attrKeys) {
      const expectedValues = sourceAttrs.get(key) ?? [];
      const actualValues = targetAttrs.get(key) ?? [];
      const missing = multisetSubtract(expectedValues, actualValues);
      const unexpected = multisetSubtract(actualValues, expectedValues);
      if (missing.length === 0 && unexpected.length === 0) continue;

      const label = describeAttributeKey(key);
      const reports = Math.max(missing.length, unexpected.length, 1);
      for (let index = 0; index < reports; index += 1) {
        const expected = missing[index] ?? '';
        const actual = unexpected[index] ?? '';
        push({
          code: 'protected_attr_modified',
          severity: 'error',
          message: `Protected attribute ${label} must stay "${expected}" but the translation has "${actual}".`,
          expected,
          actual,
        });
      }
    }
  }

  const sourcePlaceholders = extractPlaceholders(segment.sourceText);
  const targetPlaceholders = extractPlaceholders(segment.targetText);
  if (sourcePlaceholders.join('\u0001') !== targetPlaceholders.join('\u0001')) {
    push({
      code: 'placeholder_mismatch',
      severity: 'error',
      message: `Placeholders differ: source has [${sourcePlaceholders.join(', ')}], translation has [${targetPlaceholders.join(', ')}].`,
      expected: sourcePlaceholders.join(', '),
      actual: targetPlaceholders.join(', '),
    });
  }

  if (glossary.length > 0) {
    const sourceHits = matchGlossaryTerms(segment.sourceText, glossary);
    const seen = new Set<string>();
    for (const hit of sourceHits) {
      const entry = hit.entry;
      if (seen.has(entry.termId)) continue;
      seen.add(entry.termId);

      if (entry.doNotTranslate) {
        if (!containsTerm(segment.targetText, entry.sourceTerm, entry.caseSensitive)) {
          push({
            code: 'dnt_modified',
            severity: 'error',
            message: `Do-not-translate term "${entry.sourceTerm}" must appear unchanged in the translation.`,
            termId: entry.termId,
            sourceTerm: entry.sourceTerm,
            expected: entry.sourceTerm,
          });
        }
        continue;
      }

      if (!containsTerm(segment.targetText, entry.targetTerm, entry.caseSensitive)) {
        push({
          code: 'missing_glossary_term',
          severity: 'error',
          message: `Glossary term "${entry.sourceTerm}" must be translated as "${entry.targetTerm}".`,
          termId: entry.termId,
          sourceTerm: entry.sourceTerm,
          expected: entry.targetTerm,
        });
      }

      for (const forbidden of entry.forbiddenTargets ?? []) {
        if (forbidden.trim().length === 0) continue;
        if (!containsTerm(segment.targetText, forbidden, entry.caseSensitive)) continue;
        push({
          code: 'forbidden_translation',
          severity: 'error',
          message: `Forbidden translation "${forbidden}" was used for glossary term "${entry.sourceTerm}".`,
          termId: entry.termId,
          sourceTerm: entry.sourceTerm,
          expected: entry.targetTerm,
          actual: forbidden,
        });
      }
    }
  }

  return issues;
}

/**
 * Run every deterministic QA gate over already-translated blocks.
 *
 * Issues are ordered by segment and then by check, so the review UI can group them stably.
 */
export function runTranslationQa(input: RunTranslationQaInput): TranslationQaIssue[] {
  const issues: TranslationQaIssue[] = [];
  for (const segment of input.segments) {
    try {
      issues.push(...checkSegment(segment, input.glossary));
    } catch (err) {
      issues.push({
        code: 'structure_warning',
        severity: 'warning',
        segmentId: segment.segmentId,
        message: `QA could not inspect this segment: ${errorMessage(err)}`,
      });
    }
  }
  return issues;
}
