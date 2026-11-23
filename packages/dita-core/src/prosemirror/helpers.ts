import type { Node as PMNode } from 'prosemirror-model';
import type * as slimdom from 'slimdom';
import type { CalsColSpec } from '../cals/cals-table.js';
import { PM_NODE_TO_DITA_TAG } from '../model/dita-elements.js';
import { getRawAttr } from '../model/dita-rules.js';
import { getNodeSourceRange } from '../xml/parser.js';
import type { RawAttrs } from './schema.js';

const ELEMENT_NODE = 1;

const UNKNOWN_NODE_TYPES = new Set([
  'unknown_block',
  'unknown_pre_block',
  'unknown_inline',
  'unknown_inline_block',
]);

const XML_META_NODE_TYPES = new Set([
  'xml_text_block',
  'xml_comment_block',
  'xml_comment_inline',
  'xml_pi_block',
  'xml_pi_inline',
  'xml_cdata_block',
  'xml_cdata_inline',
]);

/**
 * Resolve the underlying DITA/XML tag name for any ProseMirror node in `ditaSchema`.
 * Returns `null` for `doc`, `text`, `xml_text_block`, comments, PIs, and CDATA.
 */
export function getPmNodeTagName(node: PMNode): string | null {
  const typeName = node.type.name;
  if (UNKNOWN_NODE_TYPES.has(typeName)) {
    return String(node.attrs.tagName ?? '');
  }
  if (typeName === 'dita_fn_block') return 'fn';
  if (typeName === 'cals_colspec') return 'colspec';
  return PM_NODE_TO_DITA_TAG.get(typeName) ?? null;
}

export function isUnknownPmNode(node: PMNode): boolean {
  return UNKNOWN_NODE_TYPES.has(node.type.name);
}

export function isXmlMetadataPmNode(node: PMNode): boolean {
  return XML_META_NODE_TYPES.has(node.type.name);
}

export function isDitaElementPmNode(node: PMNode): boolean {
  return getPmNodeTagName(node) !== null;
}

export function getPmNodeRawAttrs(node: PMNode): RawAttrs {
  const attrs = node.attrs.rawAttrs;
  return Array.isArray(attrs) ? (attrs as RawAttrs) : [];
}

function findDirectPmChildByTag(node: PMNode, tagName: string): PMNode | null {
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    if (getPmNodeTagName(child) === tagName) return child;
  }
  return null;
}

function normalizeTitleText(node: PMNode | null): string {
  if (!node) return '';
  return node
    .textBetween(0, node.content.size, '', (leaf) =>
      leaf.type.name === 'xml_cdata_inline' || leaf.type.name === 'xml_cdata_block'
        ? String(leaf.attrs.data ?? '')
        : '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the display title of the DITA document held by a ProseMirror doc,
 * without re-parsing XML. Mirrors `extractDitaDocumentTitle()`: bookmap falls
 * back to `booktitle/mainbooktitle`, then any root `title` child, then a root
 * `title` attribute (maps).
 *
 * Returns `null` when the document has no title.
 */
export function getPmDocTitle(doc: PMNode): string | null {
  let root: PMNode | null = null;
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (getPmNodeTagName(child) !== null) {
      root = child;
      break;
    }
  }
  if (!root) return null;

  if (getPmNodeTagName(root) === 'bookmap') {
    const booktitle = findDirectPmChildByTag(root, 'booktitle');
    const mainbooktitle = booktitle ? findDirectPmChildByTag(booktitle, 'mainbooktitle') : null;
    const mainText = normalizeTitleText(mainbooktitle);
    if (mainText) return mainText;
  }

  const titleText = normalizeTitleText(findDirectPmChildByTag(root, 'title'));
  if (titleText) return titleText;

  const attrTitle = getRawAttr(getPmNodeRawAttrs(root), 'title')?.trim();
  return attrTitle || null;
}

/**
 * Count direct `cals_tgroup` children inside a `cals_table` ProseMirror node.
 */
export function countCalsTgroups(tableNode: PMNode): number {
  let count = 0;
  tableNode.forEach((child) => {
    if (child.type.name === 'cals_tgroup') {
      count++;
    }
  });
  return count;
}

/**
 * Check if a ProseMirror `cals_table` node has multiple `<tgroup>` children.
 */
export function pmHasMultipleTgroups(tableNode: PMNode): boolean {
  return countCalsTgroups(tableNode) > 1;
}

/**
 * Extract `CalsColSpec[]` from a ProseMirror `cals_tgroup` node's `cals_colspec` children.
 */
export function getCalsColSpecsFromTgroup(tgroupNode: PMNode): CalsColSpec[] {
  const specs: CalsColSpec[] = [];
  let nextColnum = 1;

  tgroupNode.forEach((child) => {
    if (child.type.name !== 'cals_colspec') return;
    const rawAttrs = getPmNodeRawAttrs(child);
    const colnumAttr = getRawAttr(rawAttrs, 'colnum');
    const colnum =
      colnumAttr && /^\d+$/.test(colnumAttr)
        ? Number(colnumAttr)
        : typeof child.attrs.colnum === 'number' && child.attrs.colnum > 0
          ? child.attrs.colnum
          : nextColnum;
    nextColnum = colnum + 1;

    const colname =
      getRawAttr(rawAttrs, 'colname') ??
      (typeof child.attrs.colname === 'string' && child.attrs.colname
        ? child.attrs.colname
        : `col${colnum}`);

    specs.push({
      colnum,
      colname,
      colwidth: getRawAttr(rawAttrs, 'colwidth') ?? (child.attrs.colwidth as string | undefined) ?? undefined,
      align: getRawAttr(rawAttrs, 'align'),
      rawAttrs,
    });
  });

  return specs;
}

/**
 * Compute the 0-based XML element child-index path from the document root element
 * to the deepest DITA element enclosing ProseMirror position `pos`.
 * Skips virtual `xml_text_block`, text, comments, PIs, and CDATA nodes so indices match XML DOM elements.
 */
export function resolvePmElementPath(pmDoc: PMNode, pos: number): number[] {
  const clamped = Math.max(0, Math.min(pos, pmDoc.content.size));
  const $pos = pmDoc.resolve(clamped);
  const path: number[] = [];

  // depth 0 = doc, depth 1 = root XML element (e.g. <concept>), depth >= 2 = descendants
  for (let d = 2; d <= $pos.depth; d++) {
    const node = $pos.node(d);
    if (!isDitaElementPmNode(node)) {
      continue;
    }

    // Find the nearest ancestor at depth < d that is a real DITA element
    let parentDepth = d - 1;
    while (parentDepth >= 1 && !isDitaElementPmNode($pos.node(parentDepth))) {
      parentDepth--;
    }
    if (parentDepth < 1) break;

    const parentNode = $pos.node(parentDepth);
    const targetStartPos = $pos.before(d);
    const parentContentStart = $pos.start(parentDepth);

    const elementIndex = findDirectElementIndexInPmParent(
      parentNode,
      parentContentStart,
      targetStartPos,
    );
    if (elementIndex >= 0) {
      path.push(elementIndex);
    }
  }

  return path;
}

function findDirectElementIndexInPmParent(
  parentNode: PMNode,
  parentContentStart: number,
  targetStartPos: number,
): number {
  let elementIdx = 0;

  const visitChildren = (container: PMNode, containerContentStart: number): number => {
    let offset = containerContentStart;
    for (let i = 0; i < container.childCount; i++) {
      const child = container.child(i);
      const childEnd = offset + child.nodeSize;

      if (child.type.name === 'xml_text_block') {
        // Transparent wrapper in XML serialization: its children are direct children of `parentNode`
        const nested = visitChildren(child, offset + 1);
        if (nested >= 0) return nested;
      } else if (isDitaElementPmNode(child)) {
        if (offset === targetStartPos) {
          return elementIdx;
        }
        elementIdx++;
      }

      offset = childEnd;
    }
    return -1;
  };

  return visitChildren(parentNode, parentContentStart);
}

/**
 * Resolve a 0-based XML element path (from root element) to the start position inside
 * the matching ProseMirror node, or `null` if the path cannot be resolved.
 */
export function findPmPosByElementPath(pmDoc: PMNode, path: readonly number[]): number | null {
  const rootEl = pmDoc.firstChild;
  if (!rootEl || !isDitaElementPmNode(rootEl)) return null;

  let currentNode = rootEl;
  let currentNodeStart = 0; // start pos of rootEl inside pmDoc

  for (const targetIdx of path) {
    const found = findNthDirectElementChild(currentNode, currentNodeStart + 1, targetIdx);
    if (!found) {
      return currentNodeStart + 1;
    }
    currentNode = found.node;
    currentNodeStart = found.pos;
  }

  return currentNodeStart + 1;
}

/**
 * Find the start position of the first DITA element node carrying `id === elementId`
 * inside a ProseMirror Document, or `null` if not found.
 */
export function findPmPosByDitaId(pmDoc: PMNode, elementId: string): number | null {
  const targetId = elementId.trim();
  if (!targetId) return null;

  let matchedPos: number | null = null;
  pmDoc.descendants((node, pos) => {
    if (matchedPos !== null) return false;
    if (!isDitaElementPmNode(node)) return true;
    const idVal = getRawAttr(getPmNodeRawAttrs(node), 'id');
    if (idVal === targetId) {
      matchedPos = pos;
      return false;
    }
    return true;
  });
  return matchedPos;
}

function findNthDirectElementChild(
  parentNode: PMNode,
  parentContentStart: number,
  targetIdx: number,
): { node: PMNode; pos: number } | null {
  let currentIdx = 0;

  const search = (
    container: PMNode,
    containerContentStart: number,
  ): { node: PMNode; pos: number } | null => {
    let offset = containerContentStart;
    for (let i = 0; i < container.childCount; i++) {
      const child = container.child(i);
      if (child.type.name === 'xml_text_block') {
        const hit = search(child, offset + 1);
        if (hit) return hit;
      } else if (isDitaElementPmNode(child)) {
        if (currentIdx === targetIdx) {
          return { node: child, pos: offset };
        }
        currentIdx++;
      }
      offset += child.nodeSize;
    }
    return null;
  };

  return search(parentNode, parentContentStart);
}

/**
 * Walk a parsed slimdom Document by 0-based element child indices from `documentElement`.
 */
export function findDomElementByPath(
  doc: slimdom.Document,
  path: readonly number[],
): slimdom.Element | null {
  let current: slimdom.Element | null = doc.documentElement;
  if (!current) return null;

  for (const idx of path) {
    let elemCount = 0;
    let next: slimdom.Element | null = null;
    for (const child of current.childNodes) {
      if (child.nodeType === ELEMENT_NODE) {
        if (elemCount === idx) {
          next = child as slimdom.Element;
          break;
        }
        elemCount++;
      }
    }
    if (!next) return current;
    current = next;
  }

  return current;
}

/**
 * Given a character offset in the XML source string and a position-tracked slimdom Document,
 * find the element index path of the deepest element spanning `offset`.
 */
export function findElementPathAtOffset(doc: slimdom.Document, offset: number): number[] {
  const root = doc.documentElement;
  if (!root) return [];

  const path: number[] = [];
  let current: slimdom.Element = root;

  while (true) {
    let elemIdx = 0;
    let matchedChild: slimdom.Element | null = null;
    let matchedIdx = -1;

    for (const child of current.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      const el = child as slimdom.Element;
      const range = getNodeSourceRange(el);
      const start = range.open?.start;
      const end = range.close?.end ?? range.open?.end;

      if (start !== undefined && end !== undefined && offset >= start && offset <= end) {
        matchedChild = el;
        matchedIdx = elemIdx;
        break;
      }
      elemIdx++;
    }

    if (!matchedChild || matchedIdx < 0) {
      break;
    }
    path.push(matchedIdx);
    current = matchedChild;
  }

  return path;
}
