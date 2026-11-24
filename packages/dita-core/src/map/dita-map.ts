import type * as slimdom from 'slimdom';
import { extractElementAttrs } from '../cals/cals-table.js';
import {
  DITA_MAP_CONTAINER_NODE_TAGS,
  DITA_MAP_ROOT_TAGS,
  DITA_MAP_TREE_NODE_TAGS,
  DITA_TOPIC_ROOT_TAGS,
} from '../model/dita-elements.js';
import { getRawAttr, setRawAttr } from '../model/dita-rules.js';
import { getNodeSourceRange, parseXml } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import type { DitaTopicTemplateType } from '../templates/topic-templates.js';
import type { ParsedXmlDocument, XmlAttributeEntry } from '../xml/types.js';
import { findDomElementByPath } from '../prosemirror/helpers.js';

const ELEMENT_NODE = 1;
const COMMENT_NODE = 8;
const PROCESSING_INSTRUCTION_NODE = 7;

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

export type DitaMapKind = 'map' | 'bookmap';

export interface DitaMapTreeNode {
  /** Deterministic node identifier within this map (`node:<elementPath>`). */
  id: string;
  /** 0-based element child index path from the document root element. */
  elementPath: number[];
  tagName: string;
  label: string;
  href?: string;
  keys?: string;
  keyref?: string;
  navtitle?: string;
  format?: string;
  scope?: string;
  processingRole?: string;
  toc?: string;
  topicType?: string;
  rawAttrs: XmlAttributeEntry[];
  isSubmapRef: boolean;
  line?: number;
  column?: number;
  /** Empty array `[]` for container-capable nodes so tree widgets allow dropping inside them. */
  children?: DitaMapTreeNode[];
}

export interface DitaMapReferenceInfo {
  elementPath: number[];
  tagName: string;
  href: string;
  format?: string;
  scope?: string;
  isSubmapRef: boolean;
  line?: number;
  column?: number;
}

export interface ParsedDitaMap {
  kind: DitaMapKind;
  rootTag: string;
  id?: string;
  title: string;
  rootAttrs: XmlAttributeEntry[];
  nodes: DitaMapTreeNode[];
  preservedMetaSummary: {
    hasDoctype: boolean;
    commentCount: number;
    piCount: number;
    hasReltable: boolean;
    hasBookmeta: boolean;
    hasTopicmeta: boolean;
  };
  references: DitaMapReferenceInfo[];
}

/**
 * Quickly check if an XML string has a `<map>` or `<bookmap>` root element.
 */
export function isDitaMapXml(xml: string): boolean {
  try {
    const parsed = parseXml(xml, { position: false });
    const rootTag = parsed.document.documentElement?.tagName ?? '';
    return DITA_MAP_ROOT_TAGS.has(rootTag);
  } catch {
    return false;
  }
}

function findDirectChildElement(
  parent: slimdom.Element,
  tagName: string,
): slimdom.Element | null {
  for (const child of parent.childNodes) {
    if (child.nodeType === ELEMENT_NODE && (child as slimdom.Element).tagName === tagName) {
      return child as slimdom.Element;
    }
  }
  return null;
}

function extractElementPlainText(el: slimdom.Element | null): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Extract the display title of a DITA topic, map, or bookmap from an
 * already-parsed XML document. Callers that already parsed the XML should use
 * this to avoid a second full parse.
 */
export function extractDitaDocumentTitleFromDocument(document: slimdom.Document): string | null {
  const root = document.documentElement;
  if (!root) return null;

  if (root.tagName === 'bookmap') {
    const booktitle = findDirectChildElement(root, 'booktitle');
    const mainbooktitle = booktitle
      ? findDirectChildElement(booktitle, 'mainbooktitle')
      : null;
    const mainText = extractElementPlainText(mainbooktitle);
    if (mainText) return mainText;
  }

  const titleEl = findDirectChildElement(root, 'title');
  const titleText = extractElementPlainText(titleEl);
  if (titleText) return titleText;

  const attrTitle = root.getAttribute('title')?.trim();
  return attrTitle || null;
}

/**
 * Extract the display title of any DITA topic, map, or bookmap document.
 */
export function extractDitaDocumentTitle(xml: string): string | null {
  try {
    const parsed = parseXml(xml, { position: false });
    return extractDitaDocumentTitleFromDocument(parsed.document);
  } catch {
    return null;
  }
}

/**
 * Detect which DITA topic type a document's root element declares.
 *
 * Specialized or non-topic roots return `null`, so callers can keep showing a neutral
 * icon instead of guessing. Used by the workspace scan to label map-tree rows with the
 * real type of the referenced file rather than the optional `type=` attribute.
 */
export function extractDitaTopicTypeFromDocument(
  document: slimdom.Document,
): DitaTopicTemplateType | null {
  const root = document.documentElement;
  if (!root) return null;
  const tagName = root.tagName;
  if (!DITA_TOPIC_ROOT_TAGS.has(tagName)) return null;
  return tagName as DitaTopicTemplateType;
}

/** Detect the DITA topic type of a topic XML string (`null` when unknown or not a topic). */
export function extractDitaTopicType(xml: string): DitaTopicTemplateType | null {
  try {
    const parsed = parseXml(xml, { position: false });
    return extractDitaTopicTypeFromDocument(parsed.document);
  } catch {
    return null;
  }
}

function isSubmapElement(tagName: string, href?: string, format?: string): boolean {
  if (tagName === 'mapref' || format === 'ditamap') return true;
  if (!href) return false;
  return /\.(ditamap|bookmap)(#|$)/i.test(href.trim());
}

function resolveMapNodeLabel(el: slimdom.Element, rawAttrs: XmlAttributeEntry[]): string {
  const navtitleAttr = getRawAttr(rawAttrs, 'navtitle')?.trim();
  if (navtitleAttr) return navtitleAttr;

  const topicmeta = findDirectChildElement(el, 'topicmeta');
  const metaNavtitle = topicmeta
    ? extractElementPlainText(findDirectChildElement(topicmeta, 'navtitle'))
    : '';
  if (metaNavtitle) return metaNavtitle;

  const keys = getRawAttr(rawAttrs, 'keys')?.trim();
  if (keys) return `key: ${keys}`;

  const href = getRawAttr(rawAttrs, 'href')?.trim();
  if (href) return href;

  return `<${el.tagName}>`;
}

function getDirectTreeChildrenElements(parent: slimdom.Element): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeType !== ELEMENT_NODE) continue;
    const el = child as slimdom.Element;
    if (DITA_MAP_TREE_NODE_TAGS.has(el.tagName)) {
      out.push(el);
    }
  }
  return out;
}

function computeElementPath(root: slimdom.Element, target: slimdom.Element): number[] {
  const path: number[] = [];
  let current: slimdom.Node | null = target;

  while (current && current !== root) {
    const parent: slimdom.Node | null = current.parentNode;
    if (!parent || parent.nodeType !== ELEMENT_NODE) break;

    let elemIdx = 0;
    for (const child of parent.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      if (child === current) {
        path.unshift(elemIdx);
        break;
      }
      elemIdx++;
    }
    current = parent;
  }

  return path;
}

function countCommentsAndPis(root: slimdom.Element): { commentCount: number; piCount: number } {
  let commentCount = 0;
  let piCount = 0;

  const walk = (node: slimdom.Node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === COMMENT_NODE) {
        commentCount++;
      } else if (child.nodeType === PROCESSING_INSTRUCTION_NODE) {
        piCount++;
      } else if (child.nodeType === ELEMENT_NODE) {
        walk(child);
      }
    }
  };

  if (root.ownerDocument) {
    walk(root.ownerDocument);
  } else {
    walk(root);
  }
  return { commentCount, piCount };
}

function applyElementAttrsPreservingOrder(
  doc: slimdom.Document,
  el: slimdom.Element,
  nextRawAttrs: readonly XmlAttributeEntry[],
): void {
  const existing = Array.from(el.attributes);
  for (const attr of existing) {
    el.removeAttributeNode(attr);
  }

  for (const entry of nextRawAttrs) {
    let ns: string | null = entry.namespaceURI ?? null;
    if (entry.name === 'xmlns' || entry.name.startsWith('xmlns:')) {
      ns = XMLNS_NS;
    } else if (entry.name.startsWith('xml:')) {
      ns = XML_NS;
    }
    const attrNode = doc.createAttributeNS(ns, entry.name);
    attrNode.value = entry.value;
    el.setAttributeNodeNS(attrNode);
  }
}

/**
 * Find the DOM sibling node before which a newly moved/inserted tree element should be placed
 * inside `parentEl` so non-tree metadata (`<title>`, `<booktitle>`, `<bookmeta>`, `<topicmeta>`)
 * stays at the top and trailing `<reltable>` remains at the end.
 */
function findDomInsertionAnchor(
  parentEl: slimdom.Element,
  remainingTreeChildren: readonly slimdom.Element[],
  adjustedTreeIndex: number,
): slimdom.Node | null {
  const clamped = Math.max(0, Math.min(adjustedTreeIndex, remainingTreeChildren.length));
  if (clamped < remainingTreeChildren.length) {
    return remainingTreeChildren[clamped]!;
  }
  if (remainingTreeChildren.length > 0) {
    return remainingTreeChildren[remainingTreeChildren.length - 1]!.nextSibling;
  }

  for (const child of parentEl.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      const childEl = child as slimdom.Element;
      if (childEl.tagName === 'reltable') {
        return childEl;
      }
    }
  }
  return null;
}

/**
 * Parse a DITA `.ditamap` or `.bookmap` into a structured `ParsedDitaMap` tree while
 * capturing exact element paths, attributes in original XML order, and source positions.
 */
export function parseDitaMap(xml: string): ParsedDitaMap {
  const parsed = parseXml(xml, { position: true });
  const root = parsed.document.documentElement;
  if (!root || !DITA_MAP_ROOT_TAGS.has(root.tagName)) {
    throw new Error(
      `Expected <map> or <bookmap> root element, got <${root?.tagName ?? 'none'}>.`,
    );
  }

  const kind: DitaMapKind = root.tagName === 'bookmap' ? 'bookmap' : 'map';
  const rootAttrs = extractElementAttrs(root);
  const title =
    extractDitaDocumentTitleFromDocument(parsed.document) ??
    (kind === 'bookmap' ? 'Untitled Bookmap' : 'Untitled Map');

  const references: DitaMapReferenceInfo[] = [];
  let hasReltable = false;
  let hasBookmeta = false;
  let hasTopicmeta = false;

  const collectSubtreeRefs = (container: slimdom.Element, containerPath: number[]) => {
    let elemIdx = 0;
    for (const child of container.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const el = child as slimdom.Element;
      const currentPath = [...containerPath, elemIdx];
      elemIdx++;

      const href = el.getAttribute('href');
      if (href) {
        const format = el.getAttribute('format') ?? undefined;
        const scope = el.getAttribute('scope') ?? undefined;
        const range = getNodeSourceRange(el);
        references.push({
          elementPath: currentPath,
          tagName: el.tagName,
          href,
          format,
          scope,
          isSubmapRef: isSubmapElement(el.tagName, href, format),
          line: range.open?.line,
          column: range.open?.column,
        });
      }
      collectSubtreeRefs(el, currentPath);
    }
  };

  const collectTreeNodes = (parent: slimdom.Element, parentPath: number[]): DitaMapTreeNode[] => {
    const result: DitaMapTreeNode[] = [];
    let elemIdx = 0;

    for (const child of parent.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const el = child as slimdom.Element;
      const currentPath = [...parentPath, elemIdx];
      elemIdx++;

      if (el.tagName === 'reltable') hasReltable = true;
      if (el.tagName === 'bookmeta') hasBookmeta = true;
      if (el.tagName === 'topicmeta') hasTopicmeta = true;

      if (!DITA_MAP_TREE_NODE_TAGS.has(el.tagName)) {
        // Non-tree metadata or <reltable> subtree: still inspect descendants for href references
        const href = el.getAttribute('href');
        if (href) {
          const format = el.getAttribute('format') ?? undefined;
          const scope = el.getAttribute('scope') ?? undefined;
          const range = getNodeSourceRange(el);
          references.push({
            elementPath: currentPath,
            tagName: el.tagName,
            href,
            format,
            scope,
            isSubmapRef: isSubmapElement(el.tagName, href, format),
            line: range.open?.line,
            column: range.open?.column,
          });
        }
        collectSubtreeRefs(el, currentPath);
        continue;
      }

      const rawAttrs = extractElementAttrs(el);
      const href = getRawAttr(rawAttrs, 'href');
      const format = getRawAttr(rawAttrs, 'format');
      const scope = getRawAttr(rawAttrs, 'scope');
      const submap = isSubmapElement(el.tagName, href, format);
      const range = getNodeSourceRange(el);
      const topicmeta = findDirectChildElement(el, 'topicmeta');
      const metaNavtitle = topicmeta
        ? extractElementPlainText(findDirectChildElement(topicmeta, 'navtitle'))
        : '';

      if (href) {
        references.push({
          elementPath: currentPath,
          tagName: el.tagName,
          href,
          format,
          scope,
          isSubmapRef: submap,
          line: range.open?.line,
          column: range.open?.column,
        });
      }

      const childNodes = collectTreeNodes(el, currentPath);
      const canContainChildren = DITA_MAP_CONTAINER_NODE_TAGS.has(el.tagName);

      result.push({
        id: `node:${currentPath.join('.')}`,
        elementPath: currentPath,
        tagName: el.tagName,
        label: resolveMapNodeLabel(el, rawAttrs),
        href,
        keys: getRawAttr(rawAttrs, 'keys'),
        keyref: getRawAttr(rawAttrs, 'keyref'),
        navtitle: getRawAttr(rawAttrs, 'navtitle') ?? (metaNavtitle || undefined),
        format,
        scope,
        processingRole: getRawAttr(rawAttrs, 'processing-role'),
        toc: getRawAttr(rawAttrs, 'toc'),
        topicType: getRawAttr(rawAttrs, 'type'),
        rawAttrs,
        isSubmapRef: submap,
        line: range.open?.line,
        column: range.open?.column,
        children: canContainChildren
          ? childNodes
          : childNodes.length > 0
            ? childNodes
            : undefined,
      });
    }

    return result;
  };

  const nodes = collectTreeNodes(root, []);
  const { commentCount, piCount } = countCommentsAndPis(root);

  return {
    kind,
    rootTag: root.tagName,
    id: getRawAttr(rootAttrs, 'id'),
    title,
    rootAttrs,
    nodes,
    preservedMetaSummary: {
      hasDoctype: Boolean(parsed.doctype),
      commentCount,
      piCount,
      hasReltable,
      hasBookmeta,
      hasTopicmeta,
    },
    references,
  };
}

function isDescendantOrSelf(candidate: slimdom.Element, potentialAncestor: slimdom.Element): boolean {
  let curr: slimdom.Node | null = candidate;
  while (curr) {
    if (curr === potentialAncestor) return true;
    curr = curr.parentNode;
  }
  return false;
}

function resolveTargetParentElement(
  parsed: ParsedXmlDocument,
  parentPath: number[] | null,
): slimdom.Element | null {
  const root = parsed.document.documentElement;
  if (!root) return null;
  if (!parentPath || parentPath.length === 0) return root;
  return findDomElementByPath(parsed.document, parentPath);
}

/**
 * Move one or more map tree nodes inside the same `.ditamap` / `.bookmap` DOM while preserving
 * all metadata, comments, PIs, DOCTYPE, and attribute order.
 * Follows `react-arborist` pre-removal `index` semantics.
 */
export function moveMapNodes(
  xml: string,
  dragPaths: readonly (readonly number[])[],
  targetParentPath: number[] | null,
  targetTreeIndex: number,
): { xml: string; moved: boolean } {
  if (dragPaths.length === 0) return { xml, moved: false };

  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return { xml, moved: false };

  const targetParentEl = resolveTargetParentElement(parsed, targetParentPath);
  if (!targetParentEl) return { xml, moved: false };

  const rawDragged: slimdom.Element[] = [];
  for (const path of dragPaths) {
    if (path.length === 0) continue;
    const el = findDomElementByPath(parsed.document, path);
    if (el && el !== root && !rawDragged.includes(el)) {
      rawDragged.push(el);
    }
  }
  if (rawDragged.length === 0) return { xml, moved: false };

  // Filter out dragged nodes whose ancestor is also dragged, preserving selection order
  const draggedSet = new Set(rawDragged);
  const topDragged = rawDragged.filter((el) => {
    let p = el.parentNode;
    while (p && p.nodeType === ELEMENT_NODE) {
      if (draggedSet.has(p as slimdom.Element)) return false;
      p = p.parentNode;
    }
    return true;
  });

  // Prevent cycles: target parent cannot be inside (or equal to) any dragged element
  for (const el of topDragged) {
    if (isDescendantOrSelf(targetParentEl, el)) {
      return { xml, moved: false };
    }
  }

  // Compute post-removal index matching react-arborist pre-removal slot semantics
  const preRemovalTreeChildren = getDirectTreeChildrenElements(targetParentEl);
  const slot = Math.max(0, Math.min(targetTreeIndex, preRemovalTreeChildren.length));
  const topDraggedSet = new Set(topDragged);
  let shift = 0;
  for (let i = 0; i < slot; i++) {
    if (topDraggedSet.has(preRemovalTreeChildren[i]!)) {
      shift++;
    }
  }
  const adjustedTreeIndex = slot - shift;

  for (const el of topDragged) {
    el.parentNode?.removeChild(el);
  }

  const remainingTreeChildren = getDirectTreeChildrenElements(targetParentEl);
  const anchor = findDomInsertionAnchor(targetParentEl, remainingTreeChildren, adjustedTreeIndex);

  for (const el of topDragged) {
    targetParentEl.insertBefore(el, anchor);
  }

  return {
    xml: serializeXml(parsed),
    moved: true,
  };
}

function rewriteSubtreeHrefs(
  el: slimdom.Element,
  rewriteHref: (href: string) => string,
): void {
  const href = el.getAttribute('href');
  if (href) {
    el.setAttribute('href', rewriteHref(href));
  }
  for (const child of el.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      rewriteSubtreeHrefs(child as slimdom.Element, rewriteHref);
    }
  }
}

/**
 * Move a map node (and its entire subtree, metadata, comments, and attributes)
 * from `sourceXml` into `targetXml` at `targetParentPath` / `targetTreeIndex`,
 * optionally rewriting local `href` attributes to match the destination map's directory.
 */
export function transferMapNode(
  sourceXml: string,
  sourcePath: readonly number[],
  targetXml: string,
  targetParentPath: readonly number[] | null,
  targetTreeIndex: number,
  rewriteHref?: (href: string) => string,
): { sourceXml: string; targetXml: string; moved: boolean } {
  if (sourcePath.length === 0) {
    return { sourceXml, targetXml, moved: false };
  }

  const parsedSource = parseXml(sourceXml, { position: false });
  const sourceRoot = parsedSource.document.documentElement;
  if (!sourceRoot) return { sourceXml, targetXml, moved: false };

  const sourceEl = findDomElementByPath(parsedSource.document, sourcePath);
  if (!sourceEl || sourceEl === sourceRoot || !sourceEl.parentNode) {
    return { sourceXml, targetXml, moved: false };
  }

  const parsedTarget = parseXml(targetXml, { position: false });
  const targetRoot = parsedTarget.document.documentElement;
  if (!targetRoot) return { sourceXml, targetXml, moved: false };

  const targetParentEl = resolveTargetParentElement(
    parsedTarget,
    targetParentPath ? [...targetParentPath] : null,
  );
  if (!targetParentEl) return { sourceXml, targetXml, moved: false };

  // Import node deeply into target slimdom Document
  const imported = parsedTarget.document.importNode(sourceEl, true) as slimdom.Element;
  if (rewriteHref) {
    rewriteSubtreeHrefs(imported, rewriteHref);
  }

  const remainingTreeChildren = getDirectTreeChildrenElements(targetParentEl);
  const anchor = findDomInsertionAnchor(targetParentEl, remainingTreeChildren, targetTreeIndex);
  targetParentEl.insertBefore(imported, anchor);

  sourceEl.parentNode.removeChild(sourceEl);

  return {
    sourceXml: serializeXml(parsedSource),
    targetXml: serializeXml(parsedTarget),
    moved: true,
  };
}

export interface InsertMapNodeOptions {
  parentPath: number[] | null;
  index?: number;
  tagName: string;
  attrs?: readonly XmlAttributeEntry[];
  navtitle?: string;
  /** Optional inline keyword text nested inside `<topicmeta><keywords><keyword>...</keyword></keywords></topicmeta>` (useful for `<keydef>`). */
  keydefKeyword?: string;
  /** Store `navtitle` inside `<topicmeta><navtitle>` instead of `@navtitle` attribute. */
  useTopicmetaNavtitle?: boolean;
}

/**
 * Insert a new map tree entry (`topicref`, `mapref`, `topichead`, `topicgroup`, `keydef`, `chapter`, etc.)
 * into the DOM at the given parent path and tree index, returning serialized XML and the new element path.
 */
export function insertMapNode(
  xml: string,
  options: InsertMapNodeOptions,
): { xml: string; insertedPath: number[] } {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) {
    throw new Error('Cannot insert map node into an XML document without a root element.');
  }

  const doc = parsed.document;
  const parentEl = resolveTargetParentElement(parsed, options.parentPath) ?? root;
  const el = doc.createElementNS(null, options.tagName);

  let finalAttrs: XmlAttributeEntry[] = [...(options.attrs ?? [])];
  const trimmedNavtitle = options.navtitle?.trim();

  if (trimmedNavtitle && !options.useTopicmetaNavtitle && !getRawAttr(finalAttrs, 'navtitle')) {
    finalAttrs = setRawAttr(finalAttrs, 'navtitle', trimmedNavtitle);
  }

  applyElementAttrsPreservingOrder(doc, el, finalAttrs);

  if ((trimmedNavtitle && options.useTopicmetaNavtitle) || options.keydefKeyword?.trim()) {
    const topicmeta = doc.createElementNS(null, 'topicmeta');
    if (trimmedNavtitle && options.useTopicmetaNavtitle) {
      const navtitleEl = doc.createElementNS(null, 'navtitle');
      navtitleEl.appendChild(doc.createTextNode(trimmedNavtitle));
      topicmeta.appendChild(navtitleEl);
    }
    if (options.keydefKeyword?.trim()) {
      const keywords = doc.createElementNS(null, 'keywords');
      const kw = doc.createElementNS(null, 'keyword');
      kw.appendChild(doc.createTextNode(options.keydefKeyword.trim()));
      keywords.appendChild(kw);
      topicmeta.appendChild(keywords);
    }
    el.appendChild(topicmeta);
  }

  const existingTreeChildren = getDirectTreeChildrenElements(parentEl);
  const targetIdx =
    options.index === undefined
      ? existingTreeChildren.length
      : Math.max(0, Math.min(options.index, existingTreeChildren.length));
  const anchor = findDomInsertionAnchor(parentEl, existingTreeChildren, targetIdx);

  parentEl.insertBefore(el, anchor);

  return {
    xml: serializeXml(parsed),
    insertedPath: computeElementPath(root, el),
  };
}

/**
 * Remove a map node identified by `targetPath` from the Map DOM.
 */
export function deleteMapNode(
  xml: string,
  targetPath: readonly number[],
): { xml: string; deleted: boolean } {
  if (targetPath.length === 0) return { xml, deleted: false };
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return { xml, deleted: false };

  const target = findDomElementByPath(parsed.document, targetPath);
  if (!target || target === root || !target.parentNode) {
    return { xml, deleted: false };
  }

  target.parentNode.removeChild(target);
  return {
    xml: serializeXml(parsed),
    deleted: true,
  };
}

/**
 * Set, update in-place, or remove (`value === null`) an attribute on a map root or node
 * while preserving exact XML attribute ordering.
 */
export function updateMapNodeAttr(
  xml: string,
  targetPath: readonly number[] | null,
  attrName: string,
  value: string | null,
): { xml: string } {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return { xml };

  const target =
    !targetPath || targetPath.length === 0
      ? root
      : findDomElementByPath(parsed.document, targetPath);
  if (!target) return { xml };

  const existing = extractElementAttrs(target);
  const next = setRawAttr(existing, attrName, value);
  applyElementAttrsPreservingOrder(parsed.document, target, next);

  return {
    xml: serializeXml(parsed),
  };
}

/**
 * Update a map node's navigation title (preferring existing `<topicmeta>/<navtitle>`, otherwise `@navtitle`).
 */
export function updateMapNodeNavtitle(
  xml: string,
  targetPath: readonly number[],
  navtitle: string,
): { xml: string } {
  if (targetPath.length === 0) return { xml };
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return { xml };

  const target = findDomElementByPath(parsed.document, targetPath);
  if (!target || target === root) return { xml };

  const trimmed = navtitle.trim();
  const topicmeta = findDirectChildElement(target, 'topicmeta');
  const metaNav = topicmeta ? findDirectChildElement(topicmeta, 'navtitle') : null;

  if (metaNav) {
    while (metaNav.firstChild) {
      metaNav.removeChild(metaNav.firstChild);
    }
    if (trimmed) {
      metaNav.appendChild(parsed.document.createTextNode(trimmed));
    }
  } else {
    const existing = extractElementAttrs(target);
    const next = setRawAttr(existing, 'navtitle', trimmed ? trimmed : null);
    applyElementAttrsPreservingOrder(parsed.document, target, next);
  }

  return {
    xml: serializeXml(parsed),
  };
}

/**
 * Update the root title of a `.ditamap` (`<title>`) or `.bookmap` (`<booktitle>/<mainbooktitle>`).
 */
export function updateMapTitle(xml: string, newTitle: string): { xml: string } {
  const parsed = parseXml(xml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) return { xml };

  const doc = parsed.document;
  const trimmed = newTitle.trim() || 'Untitled Map';

  if (root.tagName === 'bookmap') {
    let booktitle = findDirectChildElement(root, 'booktitle');
    if (!booktitle) {
      booktitle = doc.createElementNS(null, 'booktitle');
      root.insertBefore(booktitle, root.firstChild);
    }
    let main = findDirectChildElement(booktitle, 'mainbooktitle');
    if (!main) {
      main = doc.createElementNS(null, 'mainbooktitle');
      booktitle.appendChild(main);
    }
    while (main.firstChild) main.removeChild(main.firstChild);
    main.appendChild(doc.createTextNode(trimmed));
  } else {
    let titleEl = findDirectChildElement(root, 'title');
    if (!titleEl) {
      titleEl = doc.createElementNS(null, 'title');
      root.insertBefore(titleEl, root.firstChild);
    }
    while (titleEl.firstChild) titleEl.removeChild(titleEl.firstChild);
    titleEl.appendChild(doc.createTextNode(trimmed));
  }

  return {
    xml: serializeXml(parsed),
  };
}
