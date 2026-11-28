/**
 * Lossless helpers for the single-segment XML that the bilingual review workbench edits.
 *
 * A review segment never carries a full document: it carries one DITA element (`<p>…</p>`) or,
 * for translatable attributes (`@navtitle`, map `title`), a bare text payload. These helpers are
 * deliberately string based — they only ever slice tags off, never re-indent or re-order — so a
 * reviewer who does not touch a segment keeps its exact bytes, which is what makes the check-in
 * diff minimal.
 *
 * `parseInnerFragment()` is the only place that parses XML, and it inspects `node.nodeType`
 * numbers instead of `instanceof slimdom.*`: `@dita/core` builds documents with `slimdom@4` while
 * the parser bundles `slimdom@3` internally, so class checks silently fail across the boundary.
 */
import { parseXml } from '@dita/core';
import type { TranslationSegmentReviewView } from '../../services/translation-api.js';

/** Synthetic wrapper used to parse a bare inline fragment into a node list. */
export const FRAGMENT_WRAPPER = 'ditaeditor_review_fragment';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

/**
 * Inline DITA elements whose loss silently corrupts the target topic. Block containers are not
 * listed: a review segment holds exactly one block, so anything else is inline by construction.
 */
const INLINE_TAGS = new Set([
  'b',
  'i',
  'u',
  'sup',
  'sub',
  'tt',
  'codeph',
  'cmdname',
  'msgnum',
  'parmname',
  'option',
  'apiname',
  'filepath',
  'varname',
  'userinput',
  'systemoutput',
  'wintitle',
  'menucascade',
  'uicontrol',
  'term',
  'keyword',
  'xref',
  'cite',
  'ph',
  'fn',
  'image',
  'draft-comment',
  'foreign',
  'text',
]);

/* ------------------------------------------------------------------ */
/* Minimal DOM shape (structural, never `instanceof`)                  */
/* ------------------------------------------------------------------ */

export interface DomAttributeLike {
  name: string;
  value: string;
  namespaceURI?: string | null;
}

export interface DomNodeLike {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  namespaceURI?: string | null;
  data?: string;
  textContent?: string | null;
  attributes?: ArrayLike<DomAttributeLike>;
  childNodes: ArrayLike<DomNodeLike>;
}

interface ParsedFragment {
  documentElement: DomNodeLike;
}

/** One inline element the source carries but the translation dropped. */
export interface MissingInlineTag {
  tagName: string;
  /** `keyref` value for `<keyword keyref="…"/>`, if any. */
  keyref: string | null;
  /** `href` value for `<xref href="…">`, if any. */
  href: string | null;
  /** Faithful XML for the dropped element, ready to splice back into the translation. */
  snippet: string;
  /** Compact UI label: `<uicontrol>` or `key:prod_name`. */
  label: string;
}

/* ------------------------------------------------------------------ */
/* String-level tag slicing                                            */
/* ------------------------------------------------------------------ */

/** Index of the `>` that closes the tag opening at `start`, skipping quoted attribute values. */
export function findTagEnd(xml: string, start: number): number {
  let quote: string | null = null;
  for (let index = start; index < xml.length; index += 1) {
    const char = xml[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  return -1;
}

export function isSelfClosingElement(openTag: string): boolean {
  return /\/\s*>$/.test(openTag);
}

export interface SplitOuterResult {
  openTag: string;
  innerXml: string;
  closeTag: string;
}

/**
 * Split `currSourceXml` into its outer tag and inner XML.
 *
 * Returns `null` when the payload has no single outer element — attribute segments, CDATA,
 * comments, processing instructions and bare text all take that path.
 */
export function splitOuterElement(xml: string): SplitOuterResult | null {
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<')) return null;
  if (
    trimmed.startsWith('<?') ||
    trimmed.startsWith('<!--') ||
    trimmed.startsWith('<![CDATA[') ||
    trimmed.startsWith('<!')
  ) {
    return null;
  }
  const openEnd = findTagEnd(trimmed, 0);
  if (openEnd < 0) return null;
  const openTag = trimmed.slice(0, openEnd + 1);
  if (isSelfClosingElement(openTag)) return { openTag, innerXml: '', closeTag: '' };
  const closeStart = trimmed.lastIndexOf('</');
  if (closeStart <= openEnd) return null;
  const closeTag = trimmed.slice(closeStart);
  if (!closeTag.endsWith('>')) return null;
  return { openTag, innerXml: trimmed.slice(openEnd + 1, closeStart), closeTag };
}

export function extractInnerXml(xml: string): string {
  const outer = splitOuterElement(xml);
  if (!outer) return xml;
  return outer.innerXml;
}

/** Decode the five XML entities plus numeric references (attribute payloads are escaped once). */
export function decodeXmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    switch (entity) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return match;
    }
  });
}

export function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeXmlAttr(text: string): string {
  return escapeXmlText(text).replace(/"/g, '&quot;');
}

/** Serialize the outer element of a segment with a new inner XML payload. */
export function buildTargetXmlForSave(
  segment: Pick<TranslationSegmentReviewView, 'currSourceXml' | 'attributeName'>,
  draftInnerXml: string,
): string {
  const outer = splitOuterElement(segment.currSourceXml);
  if (!outer) {
    // Attribute payloads (`@navtitle`) travel as bare text and must be escaped exactly once.
    return segment.attributeName ? escapeXmlText(draftInnerXml) : draftInnerXml;
  }
  // Text that carries no markup is escaped; markup is passed through verbatim so a reviewer's
  // `<b>`/`<codeph>` bytes are never re-encoded on the way back to the target topic.
  const inner = draftInnerXml.includes('<') ? draftInnerXml : escapeXmlText(draftInnerXml);
  return `${outer.openTag}${inner}${outer.closeTag}`;
}

/** Visible text of a fragment: tags stripped, entities decoded, whitespace collapsed. */
export function fragmentToPlainText(xml: string): string {
  const withoutComments = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeXmlEntities(withoutComments.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alias kept for callers that only need to read text out of a draft payload. */
export const stripTagsToText = fragmentToPlainText;

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse an inner-XML fragment into DOM child nodes.
 *
 * Returns `null` for anything that is not well-formed, which the editors surface as "raw XML only"
 * instead of silently rewriting the segment.
 */
export function parseInnerFragment(innerXml: string): DomNodeLike[] | null {
  try {
    const parsed = parseXml(
      `<${FRAGMENT_WRAPPER}>${innerXml}</${FRAGMENT_WRAPPER}>`,
    ) as unknown as { document: ParsedFragment };
    const root = parsed.document.documentElement;
    return Array.from(root.childNodes);
  } catch {
    return null;
  }
}

export function isWellFormedFragment(innerXml: string): boolean {
  return parseInnerFragment(innerXml) !== null;
}

export function nodeValue(node: DomNodeLike): string {
  if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_NODE) return node.data ?? '';
  return node.textContent ?? '';
}

function readAttributes(node: DomNodeLike): Array<{ name: string; value: string }> {
  const attributes = node.attributes;
  if (!attributes) return [];
  return Array.from(attributes).map((attribute) => ({
    name: attribute.name,
    value: attribute.value,
  }));
}

export function attributeValue(node: DomNodeLike, name: string): string | null {
  const found = readAttributes(node).find((attribute) => attribute.name === name);
  return found ? found.value : null;
}

export function elementName(node: DomNodeLike): string {
  const local = node.localName ?? node.nodeName;
  const colon = local.indexOf(':');
  return (colon >= 0 ? local.slice(colon + 1) : local).toLowerCase();
}

/** Serialize one parsed node back to XML, preserving attribute order and self-closing tags. */
export function serializeNode(node: DomNodeLike): string {
  switch (node.nodeType) {
    case TEXT_NODE:
      return escapeXmlText(nodeValue(node));
    case CDATA_NODE:
      return `<![CDATA[${nodeValue(node)}]]>`;
    case COMMENT_NODE:
      return `<!--${nodeValue(node)}-->`;
    case PROCESSING_INSTRUCTION_NODE:
      return `<?${node.nodeName} ${nodeValue(node)}?>`;
    case ELEMENT_NODE: {
      const name = node.localName ?? node.nodeName;
      const attributes = readAttributes(node)
        .map((attribute) => ` ${attribute.name}="${escapeXmlAttr(attribute.value)}"`)
        .join('');
      const children = Array.from(node.childNodes);
      if (children.length === 0) return `<${name}${attributes}/>`;
      const inner = children.map(serializeNode).join('');
      return `<${name}${attributes}>${inner}</${name}>`;
    }
    default:
      return '';
  }
}

/** The attributes that identify an inline element regardless of translated text. */
function inlineSignature(node: DomNodeLike): string {
  return [
    elementName(node),
    attributeValue(node, 'keyref') ?? '',
    attributeValue(node, 'href') ?? '',
    attributeValue(node, 'conkeyref') ?? '',
  ].join('|');
}

function inlineLabel(node: DomNodeLike): string {
  const target = elementName(node);
  const keyref = attributeValue(node, 'keyref');
  if (keyref) return `key:${keyref}`;
  return `<${target}>`;
}

function collectInlineElements(innerXml: string): DomNodeLike[] {
  const nodes = parseInnerFragment(innerXml);
  if (!nodes) return [];
  const collected: DomNodeLike[] = [];
  const walk = (node: DomNodeLike): void => {
    for (const child of Array.from(node.childNodes ?? [])) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      if (INLINE_TAGS.has(elementName(child))) collected.push(child);
      walk(child);
    }
  };
  for (const node of nodes) {
    if (node.nodeType !== ELEMENT_NODE) continue;
    if (INLINE_TAGS.has(elementName(node))) collected.push(node);
    walk(node);
  }
  return collected;
}

/**
 * Source inline elements whose counterpart the translation lost.
 *
 * Comparison is a multiset over element identity (tag + `keyref`/`href`), never over text: a
 * correctly translated `<uicontrol>Save</uicontrol>` is not "missing" just because the words
 * changed. Each reported entry carries the original XML so the reviewer can splice it back with
 * one click instead of retyping tags.
 */
export function findMissingSourceInlineTags(
  sourceInnerXml: string,
  targetInnerXml: string,
): MissingInlineTag[] {
  const source = collectInlineElements(sourceInnerXml);
  if (source.length === 0) return [];
  const remaining = new Map<string, number>();
  for (const node of collectInlineElements(targetInnerXml)) {
    const signature = inlineSignature(node);
    remaining.set(signature, (remaining.get(signature) ?? 0) + 1);
  }
  const missing: MissingInlineTag[] = [];
  for (const node of source) {
    const signature = inlineSignature(node);
    const count = remaining.get(signature) ?? 0;
    if (count > 0) {
      remaining.set(signature, count - 1);
      continue;
    }
    missing.push({
      tagName: elementName(node),
      keyref: attributeValue(node, 'keyref'),
      href: attributeValue(node, 'href'),
      snippet: serializeNode(node),
      label: inlineLabel(node),
    });
  }
  return missing;
}

/** True when the draft carries any markup at all (used to skip the rich editor for plain text). */
export function hasInlineMarkup(innerXml: string): boolean {
  return /<[a-zA-Z/!?]/.test(innerXml);
}

/** Join a text insertion with the existing content, avoiding a dangling space. */
export function appendInlineSnippet(innerXml: string, snippet: string): string {
  if (!innerXml.trim()) return snippet;
  return /\s$/.test(innerXml) ? `${innerXml}${snippet}` : `${innerXml} ${snippet}`;
}
