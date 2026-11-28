/**
 * Phase 16 Stage 1 — DITA translatable block extraction (isomorphic).
 *
 * Walks a lossless `slimdom` tree and yields the block units a translation pipeline may touch:
 * `<title>`, `<shortdesc>`, `<p>`, `<cmd>`, `<entry>`, `<glossdef>`, … plus *protected* blocks
 * (`codeblock`/`pre`/`lines`/`screen`/`msgblock`, `conref`/`conkeyref` carriers and any subtree
 * under `translate="no"`) that must be carried through verbatim.
 *
 * Structural paths are deterministic and are the join key of the whole Phase 16 pipeline:
 * `/task[0]/taskbody[0]/steps[0]/step[1]/cmd[0]` addresses the same block in `S0`, `S1` and `T0`.
 *
 * No `node:*` imports — this module runs in the browser playground as well as in `@dita/api`.
 */

import type * as slimdom from 'slimdom';
import {
  DITA_MAP_ROOT_TAGS,
  isBlockElementName,
  isInlineElementName,
  isWhitespacePreservingElement,
} from '../model/dita-elements.js';
import { parseXml } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import type {
  SegmentProtectedReason,
  TranslatableSegment,
} from './types.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

/**
 * Leaf-ish block units that carry prose. A unit is extracted as a single segment unless it
 * contains block element children — then the container is descended into instead, so a `<li>`
 * wrapping `<p>`s never collapses its paragraphs into one opaque segment.
 */
const TRANSLATABLE_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'title',
  'navtitle',
  'searchtitle',
  'shortdesc',
  'p',
  'cmd',
  'info',
  'stepxmp',
  'stepresult',
  'tutorialinfo',
  'steptroubleshooting',
  'tasktroubleshooting',
  'prereq',
  'context',
  'result',
  'postreq',
  'dt',
  'dd',
  'li',
  'sli',
  'note',
  'lq',
  'desc',
  'alt',
  'entry',
  'stentry',
  'choption',
  'chdesc',
  'choptionhd',
  'chdeschd',
  'proptype',
  'propvalue',
  'propdesc',
  'proptypehd',
  'propvaluehd',
  'propdeschd',
  'linktext',
  'linkinfo',
  'glossterm',
  'glossdef',
  'typeofhazard',
  'consequence',
  'howtoavoid',
  'condition',
  'cause',
  'remedy',
]);

/** Map metadata blocks translated alongside `.ditamap` navigation entries. */
const MAP_META_TAGS: ReadonlySet<string> = new Set([
  'title',
  'navtitle',
  'searchtitle',
  'shortdesc',
  'linktext',
  'mainbooktitle',
  'booktitlealt',
  'booklibrary',
]);

/** Trailing `/@attrName` of an attribute segment's structural path. */
const ATTRIBUTE_PATH_SUFFIX = /^(.*)\/@([A-Za-z_][\w.:-]*)$/;

/**
 * Split an attribute segment's structural path (`/map[0]/topichead[0]/@navtitle`) into the owning
 * element path and the attribute name. Returns `null` for ordinary element paths.
 */
export function parseAttributeStructuralPath(
  structuralPath: string,
): { elementPath: string; attributeName: string } | null {
  const match = ATTRIBUTE_PATH_SUFFIX.exec(structuralPath);
  if (!match) return null;
  const elementPath = match[1] ?? '';
  const attributeName = match[2];
  if (!attributeName) return null;
  return { elementPath, attributeName };
}

const STRUCTURAL_PATH_SEGMENT = /^([^[\]]+)\[(\d+)\]$/;

/**
 * Deterministic, dependency-free 64-bit-ish content hash (dual 32-bit FNV-1a).
 *
 * Deliberately not `node:crypto`: `@dita/core` must stay isomorphic, and a stable 16-hex-char
 * digest is all the incremental engine needs to compare block payloads.
 */
export function hashText(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    a ^= code & 0xff;
    a = Math.imul(a, 0x01000193) >>> 0;
    a ^= (code >>> 8) & 0xff;
    a = Math.imul(a, 0x01000193) >>> 0;
    b ^= code & 0xff;
    b = Math.imul(b, 0x85ebca6b) >>> 0;
    b ^= (code >>> 8) & 0xff;
    b = Math.imul(b, 0x85ebca6b) >>> 0;
  }
  b ^= b >>> 15;
  b = Math.imul(b, 0x2545f491) >>> 0;
  b ^= b >>> 13;
  return `${hex8(a)}${hex8(b)}${hex8(input.length >>> 0)}`;
}

function hex8(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

function scratchDocument(owner: slimdom.Document | null): slimdom.Document {
  // Nodes are cloned within the same slimdom implementation instance: `slimdom-sax-parser`
  // bundles its own slimdom copy, so `new slimdom.Document()` here would reject parsed nodes.
  if (!owner) throw new Error('Element is detached from a document.');
  return owner.implementation.createDocument(null, null, null);
}

function serializeScratchElement(el: slimdom.Element): string {
  const tmp = scratchDocument(el.ownerDocument);
  tmp.appendChild(el.cloneNode(true));
  return serializeXml(tmp, { includeXmlDeclaration: false, trailingNewline: false });
}

/** Lossless XML of one element (attributes, CDATA, comments, PIs and exact order preserved). */
export function serializeElementXml(el: slimdom.Element): string {
  return serializeScratchElement(el);
}

/** Lossless XML of an element's children only — the fragment an AI model actually translates. */
export function serializeInnerXml(el: slimdom.Element): string {
  const tag = el.tagName;
  if (el.childNodes.length === 0) return '';

  const tmp = scratchDocument(el.ownerDocument);
  const wrapper = tmp.createElement(tag);
  tmp.appendChild(wrapper);
  for (const child of Array.from(el.childNodes)) {
    wrapper.appendChild(child.cloneNode(true));
  }
  const full = serializeXml(tmp, { includeXmlDeclaration: false, trailingNewline: false });
  if (full === `<${tag}/>`) return '';
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  if (full.startsWith(open) && full.endsWith(close)) {
    return full.slice(open.length, full.length - close.length);
  }
  return full;
}

export interface ExtractPlainTextOptions {
  /** Keep inner whitespace verbatim (code blocks / `xml:space="preserve"`). */
  preserveWhitespace?: boolean;
}

/** Tag-stripped text of an element, whitespace-normalised for hashing, matching and QA. */
export function extractPlainText(
  el: slimdom.Element,
  options: ExtractPlainTextOptions = {},
): string {
  let raw = '';
  const walk = (node: slimdom.Node): void => {
    switch (node.nodeType) {
      case TEXT_NODE:
      case CDATA_SECTION_NODE:
        raw += node.nodeValue ?? '';
        return;
      default:
        for (const child of Array.from(node.childNodes)) walk(child);
    }
  };
  for (const child of Array.from(el.childNodes)) walk(child);

  if (options.preserveWhitespace) {
    return raw.replace(/\r\n?/g, '\n').trim();
  }
  return raw.replace(/\s+/g, ' ').trim();
}

function elementChildren(el: slimdom.Element): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === ELEMENT_NODE) out.push(child as slimdom.Element);
  }
  return out;
}

function resolveEffectiveTranslate(el: slimdom.Element, inherited: boolean): boolean {
  const raw = el.getAttribute('translate');
  if (raw === 'no') return false;
  if (raw === 'yes') return true;
  return inherited;
}

function protectedReasonFor(
  el: slimdom.Element,
  effectiveTranslate: boolean,
): SegmentProtectedReason | undefined {
  if (isWhitespacePreservingElement(el.tagName, el.getAttribute('xml:space'))) {
    return 'code_or_pre';
  }
  if (el.hasAttribute('conref') || el.hasAttribute('conkeyref')) {
    return 'conref';
  }
  if (!effectiveTranslate) return 'translate_no';
  return undefined;
}

function isBlockLikeChild(el: slimdom.Element): boolean {
  if (isBlockElementName(el.tagName)) return true;
  if (isWhitespacePreservingElement(el.tagName, el.getAttribute('xml:space'))) return true;
  return TRANSLATABLE_BLOCK_TAGS.has(el.tagName) && !isInlineElementName(el.tagName);
}

function hasSignificantInlineContent(el: slimdom.Element): boolean {
  for (const child of Array.from(el.childNodes)) {
    switch (child.nodeType) {
      case TEXT_NODE:
        if ((child.nodeValue ?? '').trim().length > 0) return true;
        break;
      case CDATA_SECTION_NODE:
        return true;
      case ELEMENT_NODE: {
        const childEl = child as slimdom.Element;
        if (!isBlockLikeChild(childEl) || isInlineElementName(childEl.tagName)) {
          if (extractPlainText(childEl).length > 0) return true;
        }
        break;
      }
      default:
        break;
    }
  }
  return false;
}

/** Canonical payload used for `contentHash`: formatting whitespace never creates diff noise. */
function canonicalSegmentPayload(tag: string, innerXml: string, preserve: boolean): string {
  if (preserve) {
    return `${tag}|${innerXml.replace(/\r\n?/g, '\n')}`;
  }
  const collapsed = innerXml
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
  return `${tag}|${collapsed}`;
}

function segmentIdFor(structuralPath: string): string {
  return structuralPath.startsWith('/') ? structuralPath.slice(1) : structuralPath;
}

/** Attribute values are plain text: only the three markup-significant characters are escaped. */
function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build the segment for a translatable *attribute* (`navtitle="…"`, map `title="…"`).
 *
 * The payload is plain text, so `innerXml`/`sourceXml` hold the XML-escaped value and
 * `structuralPath` ends with `/@attrName`. Assembly then resolves the owning element and sets the
 * attribute in place, which is what keeps attribute order, quoting and the rest of the tag intact.
 */
function makeAttributeSegment(
  el: slimdom.Element,
  elementPath: string,
  attributeName: string,
  protectedReason?: SegmentProtectedReason,
  isMapMeta = true,
): TranslatableSegment {
  const structuralPath = `${elementPath}/@${attributeName}`;
  const plainText = (el.getAttribute(attributeName) ?? '').replace(/\s+/g, ' ').trim();
  const innerXml = escapeXmlText(plainText);
  const contentHash = hashText(
    canonicalSegmentPayload(`${el.tagName}/@${attributeName}`, innerXml, false),
  );
  const segment: TranslatableSegment = {
    segmentId: segmentIdFor(structuralPath),
    elementTag: el.tagName,
    elementId: el.getAttribute('id') ?? '',
    structuralPath,
    sourceXml: innerXml,
    innerXml,
    plainText,
    contentHash,
    protected: protectedReason !== undefined,
    attributeName,
  };
  if (protectedReason) segment.protectedReason = protectedReason;
  if (isMapMeta) segment.isMapMeta = true;
  return segment;
}

function makeSegment(
  el: slimdom.Element,
  structuralPath: string,
  protectedReason?: SegmentProtectedReason,
  isMapMeta = false,
): TranslatableSegment {
  const preserve = isWhitespacePreservingElement(el.tagName, el.getAttribute('xml:space'));
  const innerXml = serializeInnerXml(el);
  const plainText = extractPlainText(el, { preserveWhitespace: preserve });
  const contentHash = hashText(canonicalSegmentPayload(el.tagName, innerXml, preserve));
  const segment: TranslatableSegment = {
    segmentId: segmentIdFor(structuralPath),
    elementTag: el.tagName,
    elementId: el.getAttribute('id') ?? '',
    structuralPath,
    sourceXml: serializeScratchElement(el),
    innerXml,
    plainText,
    contentHash,
    protected: protectedReason !== undefined,
  };
  if (protectedReason) segment.protectedReason = protectedReason;
  if (isMapMeta) segment.isMapMeta = true;
  return segment;
}

function hasTranslateYesDescendant(el: slimdom.Element): boolean {
  for (const child of elementChildren(el)) {
    if (child.getAttribute('translate') === 'yes') return true;
    if (hasTranslateYesDescendant(child)) return true;
  }
  return false;
}

interface ExtractionState {
  segments: TranslatableSegment[];
  isMap: boolean;
  includeMapMeta: boolean;
}

function visitElement(
  el: slimdom.Element,
  structuralPath: string,
  inheritedTranslate: boolean,
  inKeywords: boolean,
  state: ExtractionState,
): void {
  const tag = el.tagName;
  const effectiveTranslate = resolveEffectiveTranslate(el, inheritedTranslate);
  const protectedReason = protectedReasonFor(el, effectiveTranslate);

  if (state.isMap) {
    if (!state.includeMapMeta) return;
    if (protectedReason) {
      // `<topichead translate="no">…<topicref translate="yes">`: descend so the re-enabled child
      // is still translated, exactly like the topic branch below.
      if (protectedReason === 'translate_no' && hasTranslateYesDescendant(el)) {
        walkChildren(el, structuralPath, effectiveTranslate, false, state);
        return;
      }
      if (!isInlineElementName(tag)) {
        const protectedNavtitle = el.getAttribute('navtitle')?.trim() ?? '';
        if (protectedNavtitle.length > 0) {
          state.segments.push(
            makeAttributeSegment(el, structuralPath, 'navtitle', protectedReason, true),
          );
        }
        // A navtitle attribute and a map-meta element body are separate payloads: keep the element
        // segment (e.g. `<topicmeta><title translate="no">`) unless the attribute already carried it.
        if (MAP_META_TAGS.has(tag) || protectedNavtitle.length === 0) {
          state.segments.push(makeSegment(el, structuralPath, protectedReason, true));
        }
      }
      return;
    }
    if (MAP_META_TAGS.has(tag)) {
      state.segments.push(makeSegment(el, structuralPath, undefined, true));
      return;
    }
    if (tag === 'keyword' && inKeywords) {
      state.segments.push(makeSegment(el, structuralPath, undefined, true));
      return;
    }
    // Navigation labels live in the `navtitle` attribute, not in `<topicmeta>`: without this the
    // map tree / TOC keeps the source language after translation.
    const navtitle = el.getAttribute('navtitle')?.trim() ?? '';
    if (navtitle.length > 0) {
      state.segments.push(makeAttributeSegment(el, structuralPath, 'navtitle', undefined, true));
    }
    walkChildren(el, structuralPath, effectiveTranslate, inKeywords || tag === 'keywords', state);
    return;
  }

  if (protectedReason) {
    // Protected subtrees are carried through verbatim and never descended into. Inline carriers
    // (`<ph conref>`, `<keyword translate="no">`) stay inside their parent block segment.
    if (isInlineElementName(tag)) return;
    if (protectedReason === 'translate_no') {
      // `<section translate="no">…<p translate="yes">`: the re-enabled child is translatable, so
      // descend instead of collapsing the whole subtree into one opaque protected block.
      const reEnables = elementChildren(el).some(
        (child) => child.getAttribute('translate') === 'yes' || hasTranslateYesDescendant(child),
      );
      if (reEnables) {
        walkChildren(el, structuralPath, effectiveTranslate, false, state);
        return;
      }
    }
    state.segments.push(makeSegment(el, structuralPath, protectedReason));
    return;
  }

  if (TRANSLATABLE_BLOCK_TAGS.has(tag)) {
    const hasBlockChildren = elementChildren(el).some(isBlockLikeChild);
    if (hasBlockChildren && !hasSignificantInlineContent(el)) {
      // `<li><p>…</p><p>…</p></li>`: descend so each paragraph keeps its own segment.
      walkChildren(el, structuralPath, effectiveTranslate, false, state);
      return;
    }
    state.segments.push(makeSegment(el, structuralPath));
    return;
  }

  walkChildren(el, structuralPath, effectiveTranslate, false, state);
}

function walkChildren(
  parent: slimdom.Element,
  parentPath: string,
  inheritedTranslate: boolean,
  inKeywords: boolean,
  state: ExtractionState,
): void {
  const counters = new Map<string, number>();
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType !== ELEMENT_NODE) continue;
    const childEl = child as slimdom.Element;
    const tag = childEl.tagName;
    const index = counters.get(tag) ?? 0;
    counters.set(tag, index + 1);
    visitElement(
      childEl,
      `${parentPath}/${tag}[${index}]`,
      inheritedTranslate,
      inKeywords,
      state,
    );
  }
}

export interface ExtractTranslatableSegmentsOptions {
  /** `.ditamap` map metadata extraction is on by default; set `false` to skip it entirely. */
  includeMapMeta?: boolean;
}

/**
 * Extract every translatable (and protected) block of a DITA topic or map.
 * Throws `DitaXmlParseError` for malformed XML — callers gate on `checkXmlWellFormed()` first.
 */
export function extractTranslatableSegments(
  xml: string,
  options: ExtractTranslatableSegmentsOptions = {},
): TranslatableSegment[] {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return [];

  const state: ExtractionState = {
    segments: [],
    // `.bookmap` is not in `DITA_MAP_ROOT_TAGS` (that set drives the map-tree editor), but it is
    // a map for translation purposes: its prose lives in `booktitle`/`chapter` metadata.
    isMap: DITA_MAP_ROOT_TAGS.has(root.tagName) || root.tagName === 'bookmap',
    includeMapMeta: options.includeMapMeta !== false,
  };

  const rootPath = `/${root.tagName}[0]`;
  const rootTranslate = resolveEffectiveTranslate(root, true);
  const rootReason = protectedReasonFor(root, rootTranslate);
  if (rootReason) {
    state.segments.push(makeSegment(root, rootPath, rootReason, state.isMap));
    return state.segments;
  }

  // Legacy `title="…"` attribute on `<map>` / `<bookmap>`: many toolchains render it as the map
  // title when `<topicmeta><title>` is absent, so it is prose the translator must handle.
  if (state.isMap && state.includeMapMeta && (root.getAttribute('title')?.trim() ?? '').length > 0) {
    state.segments.push(makeAttributeSegment(root, rootPath, 'title', undefined, true));
  }

  walkChildren(root, rootPath, rootTranslate, false, state);
  return state.segments;
}

/**
 * Fingerprint of the *translatable* payload only: `(elementTag, structuralPath, contentHash)` of
 * every non-protected block. Formatting, comment, prolog or `<prolog>`-metadata edits keep the
 * same fingerprint, which is what lets Phase 16 mark a file `outdated_metadata_only`.
 */
export function computeTranslatableDocumentFingerprint(xml: string): string {
  const segments = extractTranslatableSegments(xml);
  const lines: string[] = [];
  for (const segment of segments) {
    if (segment.protected) continue;
    lines.push(`${segment.elementTag}\u0001${segment.structuralPath}\u0001${segment.contentHash}`);
  }
  return hashText(lines.join('\n'));
}

/**
 * Set (or append) the root `xml:lang` while keeping the XML declaration, DOCTYPE, comments,
 * PIs and every other attribute in its exact original order.
 */
export function setRootXmlLang(xml: string, targetLang: string): string {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return xml;
  const lang = targetLang.trim();
  if (lang.length === 0) return xml;
  root.setAttribute('xml:lang', lang);
  return serializeXml(parsed);
}

interface ParsedPathSegment {
  tag: string;
  index: number;
}

function parsePathSegment(raw: string): ParsedPathSegment | null {
  const match = STRUCTURAL_PATH_SEGMENT.exec(raw);
  if (!match) return null;
  return { tag: match[1]!, index: Number(match[2]!) };
}

function nthElementChildByTag(
  parent: slimdom.Element,
  tag: string,
  index: number,
): slimdom.Element | null {
  let seen = 0;
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType !== ELEMENT_NODE) continue;
    const childEl = child as slimdom.Element;
    if (childEl.tagName !== tag) continue;
    if (seen === index) return childEl;
    seen += 1;
  }
  return null;
}

/**
 * Resolve a deterministic structural path (as produced by `extractTranslatableSegments`) back to
 * its element. Returns `null` when the path no longer addresses a node in the document.
 */
export function findElementByStructuralPath(
  doc: slimdom.Document,
  structuralPath: string,
): slimdom.Element | null {
  // Attribute segments (`/map[0]/topichead[0]/@navtitle`) resolve to their owning element.
  const attributeRef = parseAttributeStructuralPath(structuralPath);
  const elementPath = attributeRef ? attributeRef.elementPath : structuralPath;
  const parts = elementPath.split('/').filter((part) => part.length > 0);
  if (parts.length === 0) return null;

  let current: slimdom.Element | null = doc.documentElement;
  if (!current) return null;

  const rootPart = parsePathSegment(parts[0]!);
  if (!rootPart || rootPart.index !== 0 || current.tagName !== rootPart.tag) return null;

  for (let i = 1; i < parts.length; i += 1) {
    const part = parsePathSegment(parts[i]!);
    if (!part || !current) return null;
    current = nthElementChildByTag(current, part.tag, part.index);
    if (!current) return null;
  }
  return current;
}
