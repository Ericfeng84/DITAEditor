/**
 * Document outline model.
 *
 * Derives a stable tree of block-level DITA elements from a live ProseMirror `Doc`:
 *
 * - every node carries a 0-based XML element path (`elementPath`) that matches
 *   `resolvePmElementPath()` / `findDomElementByPath()`, so visual and source mode agree;
 * - `structure` density keeps the document skeleton (topics, bodies, sections, task workflow,
 *   titled media/tables) while `all` density exposes every block element;
 * - titles / `<cmd>` / `<dt>` / `<note>` / `<image>` / `<link>` are reduced to a short display
 *   label; localization comes from `@dita/core`'s element catalog (never hardcoded CJK);
 * - `validatePmStructure()` runs once per build so nodes with DITA 1.3 ordering issues can carry
 *   a localized diagnostic message.
 */

import type { Node as PMNode } from 'prosemirror-model';
import {
  getElementLabel,
  getElementSpec,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  getRawAttr,
  isUnknownPmNode,
  validatePmStructure,
  type TaskContentModel,
  type UiLocale,
} from '@dita/core';
import { getCurrentLocale } from '../../i18n/index.js';
import { resolveTaskModelForDocument } from '../structure-options.js';
import { describeStructureIssue } from '../structure-messages.js';

export type OutlineDensity = 'structure' | 'all';

/** Semantic grouping used by the outline UI to pick an icon / accent colour. */
export type OutlineNodeCategory =
  | 'topic'
  | 'section'
  | 'task'
  | 'step'
  | 'media'
  | 'table'
  | 'list'
  | 'code'
  | 'note'
  | 'metadata'
  | 'block';

export interface OutlineNode {
  /** Stable identifier derived from `elementPath` (`root` or `0/2/1`). */
  id: string;
  /** 0-based XML element path from the document root element. */
  elementPath: number[];
  pmPos: number;
  pmEndPos: number;
  tagName: string;
  label: string;
  /** XML `@id` attribute, when present. */
  ditaId?: string;
  category: OutlineNodeCategory;
  depth: number;
  canDrag: boolean;
  canAcceptChildren: boolean;
  /** Number of omitted block descendants in `structure` density (badge hint). */
  hiddenChildCount: number;
  structureIssueMessage?: string;
  isUnknown: boolean;
  children: OutlineNode[];
}

export interface BuildDocumentOutlineOptions {
  density?: OutlineDensity;
  taskModel?: TaskContentModel;
  locale?: UiLocale | string;
}

/** Nodes that must never become a drag source (and never receive a "before" drop). */
export const PINNED_OUTLINE_TAGS: ReadonlySet<string> = new Set([
  'title',
  'colspec',
  'thead',
  'tgroup',
  'sthead',
]);

/**
 * Elements that only ever serve as their parent's display label (`<title>`, `<cmd>`, `<dt>`).
 * They never become outline rows and never count as hidden children.
 */
export const LABEL_SOURCE_TAGS: ReadonlySet<string> = new Set(['title', 'cmd', 'dt']);

/**
 * Table internals are modelled for lossless CALS editing but are noise in a document outline,
 * so their whole subtree is skipped in both densities.
 */
export const OUTLINE_TABLE_INTERNAL_TAGS: ReadonlySet<string> = new Set([
  'tgroup',
  'colspec',
  'thead',
  'tbody',
  'row',
  'entry',
  'sthead',
  'strow',
  'stentry',
  'prophead',
  'property',
  'proptype',
  'propvalue',
  'propdesc',
  'chhead',
  'choptionhd',
  'chdeschd',
  'chrow',
  'choption',
  'chdesc',
]);

/** Skeleton landmarks shown in `structure` density. */
const STRUCTURE_TAGS: ReadonlySet<string> = new Set([
  // Topic roots & nested topics
  'topic',
  'concept',
  'task',
  'reference',
  'glossentry',
  // Headline metadata
  'shortdesc',
  'abstract',
  'prolog',
  // Body wrappers
  'body',
  'conbody',
  'conbodydiv',
  'bodydiv',
  'taskbody',
  'refbody',
  'refbodydiv',
  // Sections
  'section',
  'sectiondiv',
  'example',
  'refsyn',
  // Task workflow
  'prereq',
  'context',
  'steps',
  'steps-unordered',
  'steps-informal',
  'stepsection',
  'step',
  'substeps',
  'substep',
  'choices',
  'choicetable',
  'result',
  'tasktroubleshooting',
  'postreq',
  'properties',
  // Links
  'related-links',
  'linklist',
  'linkpool',
  // Titled media / tables
  'table',
  'simpletable',
  'fig',
]);

/** Extra block elements revealed only in `all` density. */
const ALL_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'p',
  'note',
  'hazardstatement',
  'ul',
  'ol',
  'sl',
  'li',
  'sli',
  'dl',
  'dlentry',
  'codeblock',
  'pre',
  'lines',
  'screen',
  'msgblock',
  'image',
  'lq',
  'div',
  'info',
  'stepxmp',
  'stepresult',
  'steptroubleshooting',
  'tutorialinfo',
  'choice',
  'link',
]);

/** Containers whose label is their localized element name rather than a text snippet. */
const STRUCTURAL_LABEL_TAGS: ReadonlySet<string> = new Set([
  'topic',
  'concept',
  'task',
  'reference',
  'glossentry',
  'shortdesc',
  'abstract',
  'prolog',
  'body',
  'conbody',
  'conbodydiv',
  'bodydiv',
  'taskbody',
  'refbody',
  'refbodydiv',
  'section',
  'sectiondiv',
  'example',
  'refsyn',
  'prereq',
  'context',
  'steps',
  'steps-unordered',
  'steps-informal',
  'stepsection',
  'substeps',
  'choices',
  'choicetable',
  'result',
  'tasktroubleshooting',
  'postreq',
  'properties',
  'related-links',
  'linklist',
  'linkpool',
]);

const CATEGORY_BY_TAG: Readonly<Record<string, OutlineNodeCategory>> = {
  topic: 'topic',
  concept: 'topic',
  task: 'topic',
  reference: 'topic',
  glossentry: 'topic',

  section: 'section',
  sectiondiv: 'section',
  example: 'section',
  refsyn: 'section',
  body: 'section',
  conbody: 'section',
  conbodydiv: 'section',
  bodydiv: 'section',
  taskbody: 'section',
  refbody: 'section',
  refbodydiv: 'section',

  prereq: 'task',
  context: 'task',
  steps: 'task',
  'steps-unordered': 'task',
  'steps-informal': 'task',
  result: 'task',
  tasktroubleshooting: 'task',
  postreq: 'task',
  choices: 'task',
  choicetable: 'task',
  info: 'task',
  stepxmp: 'task',
  stepresult: 'task',
  steptroubleshooting: 'task',
  tutorialinfo: 'task',

  stepsection: 'step',
  step: 'step',
  substeps: 'step',
  substep: 'step',
  choice: 'step',

  fig: 'media',
  image: 'media',

  table: 'table',
  simpletable: 'table',
  properties: 'table',

  ul: 'list',
  ol: 'list',
  sl: 'list',
  li: 'list',
  sli: 'list',
  dl: 'list',
  dlentry: 'list',

  codeblock: 'code',
  pre: 'code',
  lines: 'code',
  screen: 'code',
  msgblock: 'code',

  note: 'note',
  hazardstatement: 'note',

  shortdesc: 'metadata',
  abstract: 'metadata',
  prolog: 'metadata',
  'related-links': 'metadata',
  linklist: 'metadata',
  linkpool: 'metadata',
  link: 'metadata',
};

const MAX_LABEL_LENGTH = 48;

interface BuildContext {
  density: OutlineDensity;
  locale: UiLocale | string;
  issuesByPos: ReadonlyMap<number, string>;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string): string {
  if (value.length <= MAX_LABEL_LENGTH) return value;
  return `${value.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

function localizedTagLabel(tag: string, locale: UiLocale | string): string {
  const spec = getElementSpec(tag);
  return spec ? getElementLabel(spec, locale === 'en' ? 'en' : 'zh-CN') : `<${tag}>`;
}

function findDirectChildByTag(node: PMNode, tag: string): PMNode | null {
  for (let i = 0; i < node.childCount; i += 1) {
    const child = node.child(i);
    if (getPmNodeTagName(child) === tag) return child;
  }
  return null;
}

function findDirectChildText(node: PMNode, tag: string): string {
  const child = findDirectChildByTag(node, tag);
  return child ? normalizeText(child.textContent) : '';
}

function baseName(href: string): string {
  const withoutQuery = href.split(/[?#]/, 1)[0] ?? href;
  const segments = withoutQuery.split('/');
  const last = segments[segments.length - 1];
  return last && last.length > 0 ? last : href;
}

function categoryForTag(tag: string): OutlineNodeCategory {
  return CATEGORY_BY_TAG[tag] ?? 'block';
}

function isIncludedTag(tag: string, node: PMNode, density: OutlineDensity): boolean {
  if (STRUCTURE_TAGS.has(tag)) return true;
  if (density !== 'all') return false;
  if (node.type.name === 'unknown_block' || node.type.name === 'unknown_pre_block') return true;
  return ALL_BLOCK_TAGS.has(tag);
}

/** Count DITA element children of `xml_text_block`, which are flattened on XML serialization. */
function countFlattenedElements(node: PMNode): number {
  let count = 0;
  node.forEach((child) => {
    const tag = getPmNodeTagName(child);
    if (tag !== null) {
      count += 1;
    } else if (child.type.name === 'xml_text_block') {
      count += countFlattenedElements(child);
    }
  });
  return count;
}

/** Count omitted block descendants of a node that is not represented in the outline. */
function countHiddenBlocks(node: PMNode): number {
  let count = 0;
  node.forEach((child) => {
    if (child.isInline) return;
    const tag = getPmNodeTagName(child);
    if (tag === null) {
      count += countHiddenBlocks(child);
      return;
    }
    if (tag === 'title' || LABEL_SOURCE_TAGS.has(tag)) return;
    if (OUTLINE_TABLE_INTERNAL_TAGS.has(tag)) return;
    count += 1 + countHiddenBlocks(child);
  });
  return count;
}

function extractLabel(node: PMNode, tag: string, locale: UiLocale | string): string {
  const title = findDirectChildText(node, 'title');
  if (title) return truncate(title);

  if (tag === 'step' || tag === 'substep') {
    const cmd = findDirectChildText(node, 'cmd');
    if (cmd) return truncate(cmd);
  }

  if (tag === 'dlentry') {
    const dt = findDirectChildText(node, 'dt');
    if (dt) return truncate(dt);
  }

  if (tag === 'note' || tag === 'hazardstatement') {
    const type = getRawAttr(getPmNodeRawAttrs(node), 'type');
    const head = type ? `${localizedTagLabel(tag, locale)} (${type})` : localizedTagLabel(tag, locale);
    const snippet = truncate(normalizeText(node.textContent));
    return snippet ? `${head}: ${snippet}` : head;
  }

  if (tag === 'image') {
    const alt = findDirectChildText(node, 'alt');
    if (alt) return truncate(alt);
    const rawAttrs = getPmNodeRawAttrs(node);
    const href = getRawAttr(rawAttrs, 'href');
    if (href) return truncate(baseName(href));
    const keyref = getRawAttr(rawAttrs, 'keyref');
    if (keyref) return truncate(keyref);
    return localizedTagLabel(tag, locale);
  }

  if (tag === 'link') {
    const linktext = findDirectChildText(node, 'linktext');
    if (linktext) return truncate(linktext);
    const rawAttrs = getPmNodeRawAttrs(node);
    const href = getRawAttr(rawAttrs, 'href');
    if (href) return truncate(href);
    const keyref = getRawAttr(rawAttrs, 'keyref');
    if (keyref) return truncate(keyref);
    return localizedTagLabel(tag, locale);
  }

  if (STRUCTURAL_LABEL_TAGS.has(tag)) return truncate(localizedTagLabel(tag, locale));

  const snippet = truncate(normalizeText(node.textContent));
  if (snippet) return snippet;
  return localizedTagLabel(tag, locale);
}

function buildOutlineNode(
  node: PMNode,
  pos: number,
  elementPath: number[],
  depth: number,
  ctx: BuildContext,
): OutlineNode {
  const tagName = getPmNodeTagName(node) ?? '';
  let children: OutlineNode[] = [];
  let hiddenChildCount = 0;

  if (!node.isTextblock && !node.isAtom && !node.isInline) {
    const childResult = buildChildOutlineNodes(node, pos, elementPath, depth, ctx);
    children = childResult.nodes;
    hiddenChildCount = childResult.hidden;
  }

  const rawAttrs = getPmNodeRawAttrs(node);
  const ditaId = getRawAttr(rawAttrs, 'id');
  const structureIssueMessage = ctx.issuesByPos.get(pos);

  const outlineNode: OutlineNode = {
    id: elementPath.length === 0 ? 'root' : elementPath.join('/'),
    elementPath,
    pmPos: pos,
    pmEndPos: pos + node.nodeSize,
    tagName,
    label: extractLabel(node, tagName, ctx.locale),
    category: categoryForTag(tagName),
    depth,
    canDrag: pos > 0 && !PINNED_OUTLINE_TAGS.has(tagName),
    canAcceptChildren:
      !node.isTextblock &&
      !node.isAtom &&
      !node.isInline &&
      !OUTLINE_TABLE_INTERNAL_TAGS.has(tagName),
    hiddenChildCount,
    isUnknown: isUnknownPmNode(node),
    children,
  };
  if (ditaId) outlineNode.ditaId = ditaId;
  if (structureIssueMessage) outlineNode.structureIssueMessage = structureIssueMessage;
  return outlineNode;
}

function buildChildOutlineNodes(
  parent: PMNode,
  parentPos: number,
  parentPath: number[],
  parentDepth: number,
  ctx: BuildContext,
): { nodes: OutlineNode[]; hidden: number } {
  const nodes: OutlineNode[] = [];
  let hidden = 0;
  let elementIndex = 0;
  let offset = parentPos + 1;

  for (let i = 0; i < parent.childCount; i += 1) {
    const child = parent.child(i);
    const tag = getPmNodeTagName(child);

    if (tag === null) {
      if (child.type.name === 'xml_text_block') {
        elementIndex += countFlattenedElements(child);
      }
      offset += child.nodeSize;
      continue;
    }

    const childPath = [...parentPath, elementIndex];
    elementIndex += 1;
    const childPos = offset;
    offset += child.nodeSize;

    if (child.isInline) continue;
    if (tag === 'title') continue;
    // `cmd` / `dt` are the display labels of their parent, never outline rows.
    if (LABEL_SOURCE_TAGS.has(tag)) continue;
    if (OUTLINE_TABLE_INTERNAL_TAGS.has(tag)) continue;

    if (isIncludedTag(tag, child, ctx.density)) {
      nodes.push(buildOutlineNode(child, childPos, childPath, parentDepth + 1, ctx));
    } else {
      hidden += 1 + countHiddenBlocks(child);
    }
  }

  return { nodes, hidden };
}

/** Build the outline tree of a ProseMirror document. */
export function buildDocumentOutline(
  doc: PMNode,
  options: BuildDocumentOutlineOptions = {},
): OutlineNode[] {
  const density = options.density ?? 'structure';
  const locale = options.locale ?? getCurrentLocale();
  const taskModel = options.taskModel ?? resolveTaskModelForDocument(doc);

  const issuesByPos = new Map<number, string>();
  for (const issue of validatePmStructure(doc, { taskModel })) {
    if (issue.size <= 0) continue;
    if (!issuesByPos.has(issue.pos)) {
      issuesByPos.set(issue.pos, describeStructureIssue(issue, locale));
    }
  }

  let rootNode: PMNode | null = null;
  let rootPos = 0;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const child = doc.child(i);
    if (getPmNodeTagName(child) !== null) {
      rootNode = child;
      rootPos = offset;
      break;
    }
    offset += child.nodeSize;
  }
  if (!rootNode) return [];

  return [
    buildOutlineNode(rootNode, rootPos, [], 0, { density, locale, issuesByPos }),
  ];
}

/**
 * Filter the outline by free text, `<tag>` or `#id`, keeping the ancestor chain of every match.
 * A matched node keeps its whole subtree (so collapsing state stays predictable).
 */
export function filterOutlineTree(
  nodes: readonly OutlineNode[],
  query: string,
): OutlineNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...nodes];

  const withoutAngles =
    normalized.startsWith('<') && normalized.endsWith('>')
      ? normalized.slice(1, -1)
      : normalized;
  const idOnly = withoutAngles.startsWith('#');
  const term = idOnly ? withoutAngles.slice(1) : withoutAngles;
  if (!term) return [...nodes];

  const matches = (node: OutlineNode): boolean => {
    const ditaId = (node.ditaId ?? '').toLowerCase();
    if (idOnly) return ditaId.includes(term);
    return (
      node.label.toLowerCase().includes(term) ||
      node.tagName.toLowerCase().includes(term) ||
      ditaId.includes(term)
    );
  };

  const walk = (list: readonly OutlineNode[]): OutlineNode[] => {
    const result: OutlineNode[] = [];
    for (const node of list) {
      if (matches(node)) {
        result.push(node);
        continue;
      }
      const filteredChildren = walk(node.children);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }
    return result;
  };

  return walk(nodes);
}

/** Flat `id -> node` index of an outline tree (used for active-node resolution). */
export function indexOutlineNodes(nodes: readonly OutlineNode[]): Map<string, OutlineNode> {
  const map = new Map<string, OutlineNode>();
  const walk = (list: readonly OutlineNode[]): void => {
    for (const node of list) {
      map.set(node.id, node);
      walk(node.children);
    }
  };
  walk(nodes);
  return map;
}

export interface OutlineBreadcrumbLike {
  pos: number;
}

/**
 * Ids of every expandable ancestor of `targetId`, outermost first.
 * Returns `[]` when the target is a root node or not part of the tree, so callers can treat
 * "nothing to reveal" and "nothing found" the same way.
 */
export function collectOutlineAncestorIds(
  nodes: readonly OutlineNode[],
  targetId: string,
): string[] {
  const ancestors: string[] = [];
  const walk = (list: readonly OutlineNode[]): boolean => {
    for (const node of list) {
      if (node.id === targetId) return true;
      ancestors.push(node.id);
      if (walk(node.children)) return true;
      ancestors.pop();
    }
    return false;
  };
  return walk(nodes) ? ancestors : [];
}

/**
 * Resolve the nearest visible outline node for the current cursor breadcrumbs.
 * Breadcrumbs run root -> deepest, so walking backwards finds the closest visible ancestor
 * (e.g. the enclosing `<section>` when the caret sits in a `<p>` that `structure` density hides).
 */
export function resolveActiveOutlineId(
  breadcrumbs: readonly OutlineBreadcrumbLike[],
  nodeMap: ReadonlyMap<string, OutlineNode>,
): string | null {
  if (breadcrumbs.length === 0) return null;

  const idByPos = new Map<number, string>();
  for (const [id, node] of nodeMap) {
    if (!idByPos.has(node.pmPos)) idByPos.set(node.pmPos, id);
  }

  for (let i = breadcrumbs.length - 1; i >= 0; i -= 1) {
    const crumb = breadcrumbs[i];
    if (!crumb) continue;
    const id = idByPos.get(crumb.pos);
    if (id) return id;
  }
  return null;
}

/** Resolve the deepest outline node whose `elementPath` prefixes `elementPath`. */
export function resolveActiveOutlineIdByPath(
  elementPath: readonly number[],
  nodeMap: ReadonlyMap<string, OutlineNode>,
): string | null {
  let best: OutlineNode | null = null;
  for (const node of nodeMap.values()) {
    const path = node.elementPath;
    if (path.length > elementPath.length) continue;
    let isPrefix = true;
    for (let i = 0; i < path.length; i += 1) {
      if (path[i] !== elementPath[i]) {
        isPrefix = false;
        break;
      }
    }
    if (!isPrefix) continue;
    if (!best || path.length > best.elementPath.length) best = node;
  }
  return best?.id ?? null;
}
