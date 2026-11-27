/**
 * Reuse Warehouse ("warehouse topic") helpers.
 *
 * A warehouse topic is a plain `<topic>` kept out of navigation (`processing-role="resource-only"`)
 * that stores shared `<note>`, `<ph>`, `<table>` or `<section>` fragments for `conref` / `conkeyref`.
 * Every reusable fragment needs a globally unique, self-describing `@id`, so these helpers keep ID
 * generation, ID uniqueness and DITA 1.3 container placement deterministic — the exact concerns
 * described in `docs/dita/dita_topic.md` §7.
 *
 * Everything here works on plain XML strings and never mutates the input document; unknown or
 * specialized elements and the document prolog (XML declaration, DOCTYPE, comments, PIs) survive
 * untouched because the document is parsed and re-serialized by the shared lossless XML layer.
 */

import type * as slimdom from 'slimdom';
import {
  DITA_TOPIC_ROOT_TAGS,
  isBlockElementName,
  isInlineElementName,
} from '../model/dita-elements.js';
import { parseXml } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

/** DITA `@id` values must be an XML name: letter/underscore first, then name characters. */
const DITA_ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

const MAX_ID_LENGTH = 64;
const MAX_TEXT_TOKENS = 3;
const MAX_TOKEN_LENGTH = 20;

/** Body wrappers that may hold reusable fragments, in DITA 1.3 topic type order. */
const BODY_WRAPPER_TAGS: ReadonlySet<string> = new Set([
  'body',
  'conbody',
  'taskbody',
  'refbody',
]);

/** Default body wrapper per topic root (used when the root has no wrapper yet). */
const BODY_WRAPPER_BY_ROOT: Readonly<Record<string, string>> = {
  topic: 'body',
  concept: 'conbody',
  task: 'taskbody',
  reference: 'refbody',
  dita: 'body',
};

/** Elements that a `<body>` / `<conbody>` / `<refbody>` may hold directly as reusable blocks. */
const REUSABLE_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'p',
  'note',
  'section',
  'codeblock',
  'pre',
  'ul',
  'ol',
  'dl',
  'fig',
  'simpletable',
  'table',
  'example',
  'bodydiv',
]);

/** Strict `taskbody` slot order (task.dtd + strictTaskbodyConstraint.mod). */
const TASKBODY_SLOT_ORDER: readonly string[] = [
  'prereq',
  'context',
  'steps',
  'steps-unordered',
  'steps-informal',
  'result',
  'tasktroubleshooting',
  'example',
  'postreq',
];

/** Flow blocks that Strict Task only accepts inside `<context>` (or another flow container). */
const TASKBODY_FLOW_TAGS: ReadonlySet<string> = new Set([
  'p',
  'note',
  'ul',
  'ol',
  'dl',
  'codeblock',
  'pre',
  'fig',
  'image',
  'simpletable',
  'table',
  'hazardstatement',
]);

/** `<section>` is not legal in a Strict Task `<taskbody>`; `<example>` is its legal slot. */
const TASKBODY_SECTION_TAGS: ReadonlySet<string> = new Set([
  'section',
  'sectiondiv',
  'bodydiv',
  'conbodydiv',
]);

/** Attributes that would turn a new warehouse fragment into a reused one. */
const CONREF_ATTRIBUTES: readonly string[] = ['conref', 'conkeyref', 'conrefend'];

function childElements(parent: slimdom.Node): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeType === ELEMENT_NODE) out.push(child as slimdom.Element);
  }
  return out;
}

function walkElements(doc: slimdom.Document): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  const visit = (node: slimdom.Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      out.push(child as slimdom.Element);
      visit(child);
    }
  };
  visit(doc);
  return out;
}

/**
 * Deep clone a node parsed from another document into `doc`, preserving element attributes
 * (including namespace-qualified ones) in original document order.
 *
 * `instanceof slimdom.*` is deliberately avoided: `slimdom-sax-parser` bundles slimdom v3 while
 * this package constructs nodes with slimdom v4, so only `nodeType` can be trusted.
 */
function cloneNodeInto(doc: slimdom.Document, source: slimdom.Node): slimdom.Node | null {
  switch (source.nodeType) {
    case ELEMENT_NODE: {
      const el = source as slimdom.Element;
      const clone = doc.createElementNS(el.namespaceURI ?? null, el.tagName);
      for (const attr of el.attributes) {
        if (attr.namespaceURI) {
          clone.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
        } else {
          clone.setAttribute(attr.name, attr.value);
        }
      }
      for (const child of el.childNodes) {
        const clonedChild = cloneNodeInto(doc, child);
        if (clonedChild) clone.appendChild(clonedChild);
      }
      return clone;
    }
    case TEXT_NODE:
      return doc.createTextNode(source.nodeValue ?? '');
    case CDATA_SECTION_NODE:
      return doc.createCDATASection(source.nodeValue ?? '');
    case PROCESSING_INSTRUCTION_NODE: {
      const pi = source as slimdom.ProcessingInstruction;
      return doc.createProcessingInstruction(pi.target, pi.data ?? '');
    }
    case COMMENT_NODE:
      return doc.createComment(source.nodeValue ?? '');
    default:
      return null;
  }
}

function sanitizeIdSegment(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^[_.-]+/, '')
    .replace(/[_.-]+$/, '');
}

/** Extract up to `MAX_TEXT_TOKENS` short ASCII tokens from a human-readable text preview. */
function asciiIdTokens(textPreview: string): string[] {
  const matches = textPreview.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens: string[] = [];
  for (const match of matches) {
    if (/^[0-9]+$/.test(match)) continue;
    const token = match.slice(0, MAX_TOKEN_LENGTH);
    if (!token) continue;
    tokens.push(token);
    if (tokens.length >= MAX_TEXT_TOKENS) break;
  }
  return tokens;
}

/**
 * Derive a clean, self-describing DITA `@id` from an element tag plus ASCII words of its content,
 * falling back to a numbered `<tag>_<n>` suffix when the preview carries no ASCII tokens or the
 * derived ID is already taken. Non-ASCII previews (Chinese, Japanese, …) therefore stay valid.
 */
export function generateSemanticElementId(
  tagName: string,
  textPreview: string,
  existingIds: ReadonlySet<string>,
): string {
  const tagBase = sanitizeIdSegment(tagName) || 'element';
  const tokens = asciiIdTokens(textPreview);
  const stem = tokens.length > 0 ? `${tagBase}_${tokens.join('_')}` : tagBase;
  const candidate = stem.slice(0, MAX_ID_LENGTH).replace(/[_.-]+$/, '');

  if (!existingIds.has(candidate)) return candidate;

  let n = 1;
  while (existingIds.has(`${stem}_${n}`)) n += 1;
  return `${stem}_${n}`.slice(0, MAX_ID_LENGTH);
}

function collectIdsFromDocument(doc: slimdom.Document): Set<string> {
  const ids = new Set<string>();
  for (const el of walkElements(doc)) {
    const id = el.getAttribute('id');
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Collect every `@id` value in a topic document. Malformed XML yields an empty set so callers can
 * treat "unparseable" and "no IDs" alike.
 */
export function collectTopicElementIds(topicXml: string): Set<string> {
  try {
    const parsed = parseXml(topicXml, { position: false });
    return collectIdsFromDocument(parsed.document);
  } catch {
    return new Set<string>();
  }
}

export interface AppendReusableFragmentOptions {
  /** DITA element to append, e.g. `note`, `ph`, `section`, `li`. */
  tagName: string;
  /** Globally unique, self-describing `@id` for the new fragment. */
  elementId: string;
  /** Plain text content used when `fragmentXml` is not supplied. */
  textContent?: string;
  /** Full XML of the fragment (its root element becomes the appended element). */
  fragmentXml?: string;
}

export type AppendReusableFragmentResult =
  | {
      ok: true;
      xml: string;
      topicId: string;
      elementId: string;
      tagName: string;
    }
  | { ok: false; error: string };

/**
 * Clone a subtree into `doc` and force the reusable-fragment identity onto it: the caller's `@id`
 * and no `conref` / `conkeyref` / `conrefend` (a warehouse definition must not be a reuse itself).
 */
function cloneFragmentElement(
  doc: slimdom.Document,
  source: slimdom.Element,
  elementId: string,
): slimdom.Element {
  const clone = cloneNodeInto(doc, source) as slimdom.Element;
  applyFragmentIdentity(clone, elementId);
  return clone;
}

function applyFragmentIdentity(el: slimdom.Element, elementId: string): void {
  el.setAttribute('id', elementId);
  for (const attr of CONREF_ATTRIBUTES) {
    if (el.hasAttribute(attr)) el.removeAttribute(attr);
  }
}

function createElement(
  doc: slimdom.Document,
  tagName: string,
  textContent?: string,
): slimdom.Element {
  const el = doc.createElementNS(null, tagName);
  if (textContent && textContent.length > 0) {
    el.appendChild(doc.createTextNode(textContent));
  }
  return el;
}

/** Find the existing body wrapper (`body` / `conbody` / `taskbody` / `refbody`) of a topic root. */
function findBodyWrapper(root: slimdom.Element): slimdom.Element | null {
  for (const child of childElements(root)) {
    if (BODY_WRAPPER_TAGS.has(child.tagName)) return child;
  }
  return null;
}

/**
 * Create the missing body wrapper and insert it at its DTD slot: after `title`/`shortdesc`/
 * `prolog`, and before `related-links` or any nested topic.
 */
function createBodyWrapper(doc: slimdom.Document, root: slimdom.Element): slimdom.Element {
  const tagName = BODY_WRAPPER_BY_ROOT[root.tagName] ?? 'body';
  const wrapper = doc.createElementNS(null, tagName);

  const before = childElements(root).find(
    (child) => child.tagName === 'related-links' || DITA_TOPIC_ROOT_TAGS.has(child.tagName),
  );
  if (before) {
    root.insertBefore(wrapper, before);
  } else {
    root.appendChild(wrapper);
  }
  return wrapper;
}

/**
 * Insert a node into a Strict `<taskbody>` at the slot its tag belongs to.
 * Flow content (`<p>`, `<note>`, `<ul>`, …) is placed inside `<context>`; `<section>` is placed
 * inside `<example>`; `<example>` is placed in its own slot.
 */
function insertIntoTaskbody(
  doc: slimdom.Document,
  taskbody: slimdom.Element,
  node: slimdom.Element,
): void {
  const slot = node.tagName;
  const children = childElements(taskbody);

  if (slot === 'example') {
    insertBySlotOrder(taskbody, node, 'example');
    return;
  }

  if (TASKBODY_SECTION_TAGS.has(slot) || TASKBODY_FLOW_TAGS.has(slot) || isBlockElementName(slot)) {
    const containerTag = TASKBODY_SECTION_TAGS.has(slot) ? 'example' : 'context';
    const container = children.find((child) => child.tagName === containerTag);
    if (container) {
      container.appendChild(node);
      return;
    }
    const created = doc.createElementNS(null, containerTag);
    insertBySlotOrder(taskbody, created, containerTag);
    created.appendChild(node);
    return;
  }

  // Inline/unknown tags reach here only when wrapped in <p> by the caller, but stay defensive.
  const context = children.find((child) => child.tagName === 'context');
  if (context) {
    context.appendChild(node);
    return;
  }
  const created = doc.createElementNS(null, 'context');
  insertBySlotOrder(taskbody, created, 'context');
  created.appendChild(node);
}

function insertBySlotOrder(
  taskbody: slimdom.Element,
  node: slimdom.Element,
  slotTag: string,
): void {
  const targetIndex = TASKBODY_SLOT_ORDER.indexOf(slotTag);
  const before = childElements(taskbody).find((child) => {
    const childIndex = TASKBODY_SLOT_ORDER.indexOf(child.tagName);
    return childIndex > -1 && childIndex > targetIndex;
  });
  if (before) {
    taskbody.insertBefore(node, before);
  } else {
    taskbody.appendChild(node);
  }
}

/** Wrap inline fragments in `<p>` and `<li>` in `<ul>` so the DITA body stays DTD-valid. */
function wrapForBody(doc: slimdom.Document, element: slimdom.Element): slimdom.Element {
  const tag = element.tagName;
  if (tag === 'li') {
    const ul = doc.createElementNS(null, 'ul');
    ul.appendChild(element);
    return ul;
  }
  if (REUSABLE_BLOCK_TAGS.has(tag) || isBlockElementName(tag)) {
    return element;
  }
  if (isInlineElementName(tag) || !isBlockElementName(tag)) {
    const p = doc.createElementNS(null, 'p');
    p.appendChild(element);
    return p;
  }
  return element;
}

function parseFragment(fragmentXml: string): {
  ok: true;
  element: slimdom.Element;
} | { ok: false; error: string } {
  try {
    const parsed = parseXml(fragmentXml, { position: false });
    const element = parsed.document.documentElement;
    if (!element) {
      return { ok: false, error: 'Fragment XML has no root element.' };
    }
    return { ok: true, element };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Fragment XML is not well-formed: ${message}` };
  }
}

/**
 * Append a reusable fragment to a warehouse topic, guaranteeing a unique self-describing `@id`
 * and a DITA 1.3-valid container position (`body`/`conbody`/`refbody` direct, Strict Task wrapped
 * in `<context>` / `<example>`, inline tags wrapped in `<p>`, `<li>` wrapped in `<ul>`).
 *
 * The document prolog (XML declaration, DOCTYPE, comments, PIs) and attribute order are preserved
 * because the topic is round-tripped through the shared lossless parser/serializer.
 */
export function appendReusableFragmentToTopicXml(
  topicXml: string,
  options: AppendReusableFragmentOptions,
): AppendReusableFragmentResult {
  const requestedTag = options.tagName?.trim() ?? '';
  const elementId = options.elementId?.trim() ?? '';

  if (!requestedTag) {
    return { ok: false, error: 'A target element tag name is required.' };
  }
  if (!elementId) {
    return { ok: false, error: 'A reusable element id is required.' };
  }
  if (!DITA_ID_PATTERN.test(elementId)) {
    return {
      ok: false,
      error: `Invalid DITA element id "${elementId}": ids must match ${DITA_ID_PATTERN.source}.`,
    };
  }

  let parsed: ReturnType<typeof parseXml>;
  try {
    parsed = parseXml(topicXml, { position: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Topic XML is not well-formed: ${message}` };
  }

  const doc = parsed.document;
  const root = doc.documentElement;
  if (!root || !DITA_TOPIC_ROOT_TAGS.has(root.tagName)) {
    return {
      ok: false,
      error: `Root element <${root ? root.tagName : 'none'}> is not a DITA topic root.`,
    };
  }

  if (collectIdsFromDocument(doc).has(elementId)) {
    return { ok: false, error: `Element id "${elementId}" already exists in the topic.` };
  }

  let element: slimdom.Element;
  if (options.fragmentXml && options.fragmentXml.trim().length > 0) {
    const fragment = parseFragment(options.fragmentXml);
    if (!fragment.ok) return { ok: false, error: fragment.error };
    element = cloneFragmentElement(doc, fragment.element, elementId);
  } else {
    element = createElement(doc, requestedTag, options.textContent);
    applyFragmentIdentity(element, elementId);
  }

  const node = wrapForBody(doc, element);
  const wrapper = findBodyWrapper(root) ?? createBodyWrapper(doc, root);

  if (wrapper.tagName === 'taskbody') {
    insertIntoTaskbody(doc, wrapper, node);
  } else {
    wrapper.appendChild(node);
  }

  return {
    ok: true,
    xml: serializeXml(parsed),
    topicId: root.getAttribute('id') ?? '',
    elementId,
    tagName: element.tagName,
  };
}
