import type { Node as PMNode } from 'prosemirror-model';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import type { EditorState } from 'prosemirror-state';
import { NodeSelection } from 'prosemirror-state';
import {
  getAllowedChildElements,
  getElementSpec,
  getInsertableTagsBySequence,
  getInsertionSlot,
  getPmChildTags,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  getRawAttr,
  isUnknownPmNode,
  pmHasMultipleTgroups,
  type DitaElementSpec,
  type RawAttrs,
  type TaskContentModel,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../structure-options';

export interface BreadcrumbItem {
  depth: number;
  pos: number; // Node start pos inside doc (suitable for NodeSelection / setNodeMarkup)
  tagName: string;
  nodeTypeName: string;
  id?: string;
  label: string;
  isUnknown: boolean;
  isAtom: boolean;
  node: PMNode;
}

export interface InsertContextGroup {
  containerTag: string;
  containerDepth: number;
  containerLabel: string;
  insertKind: 'inline' | 'block';
  items: DitaElementSpec[];
}

export interface ActiveTableInfo {
  kind: 'simpletable' | 'cals';
  tableDepth: number;
  tablePos: number;
  isMultiTgroup: boolean;
  inHeader: boolean;
  canMergeRight: boolean;
  canMergeDown: boolean;
  canSplitCell: boolean;
  colspan: number;
  rowspan: number;
  cols: number;
}

export interface EditorSelectionSnapshot {
  breadcrumbs: BreadcrumbItem[];
  /** Currently inspected node (either selected explicitly via breadcrumb or deepest DITA element at cursor). */
  activeItem: BreadcrumbItem | null;
  activeInlineTags: Set<string>;
  insertGroups: InsertContextGroup[];
  tableInfo: ActiveTableInfo | null;
  rootTagName: string | null;
  from: number;
  to: number;
  rawAttrs: RawAttrs;
}

function makeBreadcrumbItem(node: PMNode, depth: number, pos: number): BreadcrumbItem | null {
  const tagName = getPmNodeTagName(node);
  if (!tagName) return null;
  const rawAttrs = getPmNodeRawAttrs(node);
  const id = getRawAttr(rawAttrs, 'id');
  const spec = getElementSpec(tagName);
  return {
    depth,
    pos,
    tagName,
    nodeTypeName: node.type.name,
    id,
    label: spec?.labelZh ?? tagName,
    isUnknown: isUnknownPmNode(node),
    isAtom: node.isAtom,
    node,
  };
}

/**
 * Inspect the current ProseMirror EditorState to extract:
 * - Clickable DITA element breadcrumb path
 * - Active inline formatting tags around cursor
 * - Legal DITA 1.3 elements insertable at the current cursor context
 * - Active table context (simpletable or CALS)
 */
export function getSelectionSnapshot(
  state: EditorState,
  pinnedBreadcrumbPos?: number | null,
): EditorSelectionSnapshot {
  const { selection, doc } = state;
  const $pos = selection.$from;
  const breadcrumbs: BreadcrumbItem[] = [];
  const activeInlineTags = new Set<string>();

  for (let d = 1; d <= $pos.depth; d++) {
    const node = $pos.node(d);
    const item = makeBreadcrumbItem(node, d, $pos.before(d));
    if (item) {
      breadcrumbs.push(item);
      if (node.isInline) {
        activeInlineTags.add(item.tagName);
      }
    }
  }

  // Include selected atom/node if NodeSelection targets a DITA element (e.g. <image>, <colspec>, <keyword>)
  if (selection instanceof NodeSelection) {
    const item = makeBreadcrumbItem(selection.node, $pos.depth + 1, selection.from);
    if (item) {
      breadcrumbs.push(item);
      if (selection.node.isInline) {
        activeInlineTags.add(item.tagName);
      }
    }
  }

  // Also check if cursor is immediately inside/touching an inline node when selection spans a single inline node
  if (
    !(selection instanceof NodeSelection) &&
    selection.from < selection.to &&
    $pos.parent === selection.$to.parent
  ) {
    const nodeAfter = $pos.nodeAfter;
    if (
      nodeAfter &&
      nodeAfter.isInline &&
      selection.from + nodeAfter.nodeSize === selection.to
    ) {
      const tag = getPmNodeTagName(nodeAfter);
      if (tag) {
        activeInlineTags.add(tag);
      }
    }
  }

  // Resolve inspected item (pinned via breadcrumb click if still present in the current ancestor chain)
  let activeItem: BreadcrumbItem | null =
    breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1]! : null;
  if (pinnedBreadcrumbPos !== null && pinnedBreadcrumbPos !== undefined) {
    const match = breadcrumbs.find((b) => b.pos === pinnedBreadcrumbPos);
    if (match) {
      activeItem = match;
    }
  }

  // Build context-aware insert groups (inline at current textblock + block in enclosing containers)
  const taskModel = resolveTaskModelForDocument(doc);
  const insertGroups = buildInsertContextGroups(breadcrumbs, taskModel);

  // Detect active table context
  const tableInfo = extractActiveTableInfo(state, breadcrumbs);

  const rootTagName = doc.firstChild ? getPmNodeTagName(doc.firstChild) : null;

  return {
    breadcrumbs,
    activeItem,
    activeInlineTags,
    insertGroups,
    tableInfo,
    rootTagName,
    from: selection.from,
    to: selection.to,
    rawAttrs: activeItem ? getPmNodeRawAttrs(activeItem.node) : [],
  };
}

function buildInsertContextGroups(
  breadcrumbs: BreadcrumbItem[],
  taskModel: TaskContentModel = 'strict',
): InsertContextGroup[] {
  const groups: InsertContextGroup[] = [];
  const seenTags = new Set<string>();

  if (breadcrumbs.length === 0) return groups;

  // 1. Inline elements allowed inside the deepest textblock/inline container.
  //    Collected up-front but listed AFTER the block groups: authors reach for block
  //    structures (`<p>`, `<section>`, `<steps>`, `<table>`) far more often, and the
  //    menu's first section is what the arrow keys land on.
  const deepest = breadcrumbs[breadcrumbs.length - 1]!;
  const inlineCandidates = getAllowedChildElements(deepest.tagName, 'inline', taskModel);
  const inlineGroup: InsertContextGroup | null =
    inlineCandidates.length > 0
      ? {
          containerTag: deepest.tagName,
          containerDepth: deepest.depth,
          containerLabel: translate(getCurrentLocale(), 'insertMenu.groupInline', { tag: deepest.tagName }),
          insertKind: 'inline',
          items: inlineCandidates,
        }
      : null;
  if (inlineGroup) {
    for (const item of inlineCandidates) {
      seenTags.add(`inline:${item.tag}`);
    }
  }

  // 2. Block elements allowed in the nearest 2–3 enclosing structural containers
  for (let i = breadcrumbs.length - 1; i >= 0; i--) {
    const crumb = breadcrumbs[i]!;
    // Leaf textblocks (`<p>`, `<cmd>`, `<title>`, `<li>` mixed text, …) cannot host a block child:
    // inserting there would split the textblock. Offer block elements from the enclosing
    // structural container instead even when the caret sits inside `<p>` or an inline tag in it.
    if (crumb.node.isInline || crumb.node.isTextblock) continue;

    const blockCandidates = getAllowedChildElements(crumb.tagName, 'block', taskModel).filter(
      (spec) => {
        // Avoid offering redundant inline-only items here, and avoid duplicate block tags across nested levels
        if (seenTags.has(`block:${spec.tag}`)) return false;
        // Don't offer inserting <p> directly inside <p> textblock when a parent container already accepts <p>
        if (crumb.tagName === 'p' && spec.tag === 'p') return false;
        // Keep structural table sub-elements managed by dedicated table toolbar, not cluttering generic insert
        if (
          [
            'sthead',
            'strow',
            'stentry',
            'tgroup',
            'colspec',
            'thead',
            'tbody',
            'row',
            'entry',
          ].includes(spec.tag)
        ) {
          return false;
        }
        return true;
      },
    );

    if (blockCandidates.length > 0) {
      // DITA 1.3 cardinality / choice filter: do not offer a slot that is already filled
      // (single-occurrence tags) or blocked by an exclusive alternative (steps | steps-unordered).
      const insertable = new Set(
        getInsertableTagsBySequence(
          crumb.tagName,
          getPmChildTags(crumb.node),
          blockCandidates.map((spec) => spec.tag),
          taskModel,
        ),
      );
      const availableCandidates = blockCandidates.filter((spec) => insertable.has(spec.tag));
      if (availableCandidates.length === 0) continue;

      for (const item of availableCandidates) {
        seenTags.add(`block:${item.tag}`);
      }
      groups.push({
        containerTag: crumb.tagName,
        containerDepth: crumb.depth,
        containerLabel: translate(getCurrentLocale(), 'insertMenu.groupBlock', { tag: crumb.tagName }),
        insertKind: 'block',
        items: availableCandidates,
      });
    }

    // Stop after topic body/root level to keep the menu focused and relevant
    if (['body', 'conbody', 'taskbody', 'refbody', 'topic', 'concept', 'task', 'reference'].includes(crumb.tagName)) {
      // Allow stepping one more up from body -> topic root if shortdesc/related-links could be inserted
      if (['topic', 'concept', 'task', 'reference'].includes(crumb.tagName)) {
        break;
      }
    }
  }

  // Block groups first, inline group last (see note in step 1).
  return inlineGroup ? [...groups, inlineGroup] : groups;
}

function extractActiveTableInfo(
  _state: EditorState,
  breadcrumbs: BreadcrumbItem[],
): ActiveTableInfo | null {
  // Check simpletable first (innermost)
  for (let i = breadcrumbs.length - 1; i >= 0; i--) {
    const crumb = breadcrumbs[i]!;
    if (crumb.nodeTypeName === 'dita_simpletable') {
      const inHeader = breadcrumbs.some(
        (b) => b.depth > crumb.depth && b.nodeTypeName === 'dita_sthead',
      );
      let cols = 1;
      const firstRow = crumb.node.firstChild;
      if (firstRow) {
        let count = 0;
        firstRow.forEach((c) => {
          if (c.type.name === 'dita_stentry') count++;
        });
        cols = Math.max(1, count);
      }
      return {
        kind: 'simpletable',
        tableDepth: crumb.depth,
        tablePos: crumb.pos,
        isMultiTgroup: false,
        inHeader,
        canMergeRight: false,
        canMergeDown: false,
        canSplitCell: false,
        colspan: 1,
        rowspan: 1,
        cols,
      };
    }

    if (crumb.nodeTypeName === 'cals_table') {
      const isMultiTgroup = pmHasMultipleTgroups(crumb.node);
      const tgroupCrumb = breadcrumbs.find(
        (b) => b.depth > crumb.depth && b.nodeTypeName === 'cals_tgroup',
      );
      const entryCrumb = [...breadcrumbs]
        .reverse()
        .find((b) => b.depth > crumb.depth && b.nodeTypeName === 'cals_entry');
      const inHeader = breadcrumbs.some(
        (b) => b.depth > crumb.depth && b.nodeTypeName === 'cals_thead',
      );

      const cols = tgroupCrumb ? Number(tgroupCrumb.node.attrs.cols ?? 1) : 1;
      const colspan = entryCrumb ? Number(entryCrumb.node.attrs.colspan ?? 1) : 1;
      const rowspan = entryCrumb ? Number(entryCrumb.node.attrs.rowspan ?? 1) : 1;

      return {
        kind: 'cals',
        tableDepth: crumb.depth,
        tablePos: crumb.pos,
        isMultiTgroup,
        inHeader,
        canMergeRight: !isMultiTgroup && Boolean(entryCrumb) && colspan < cols,
        canMergeDown: !isMultiTgroup && Boolean(entryCrumb),
        canSplitCell: !isMultiTgroup && Boolean(entryCrumb) && (colspan > 1 || rowspan > 1),
        colspan,
        rowspan,
        cols,
      };
    }
  }

  return null;
}

/**
 * Determine whether a quick-insert block tag is legally allowed somewhere in the current ancestor chain.
 */
export function findLegalAncestorDepthForBlock(
  state: EditorState,
  tagName: string,
): number | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    const parentTag = getPmNodeTagName(node);
    if (!parentTag || node.isInline) continue;
    // Skip leaf textblocks for block insertion (prefer their structural parent)
    if (['p', 'title', 'shortdesc', 'cmd', 'dt', 'desc', 'codeblock', 'pre'].includes(parentTag)) {
      continue;
    }
    const taskModel = resolveTaskModelForDocument(state.doc);
    const allowed = getAllowedChildElements(parentTag, 'block', taskModel);
    if (
      allowed.some((s) => s.tag === tagName) &&
      getInsertionSlot(parentTag, getPmChildTags(node), tagName, undefined, taskModel).ok
    ) {
      return d;
    }
  }
  return null;
}

/**
 * Determine whether an inline tag is allowed at the current cursor position.
 */
export function isInlineTagAllowedAtSelection(state: EditorState, tagName: string): boolean {
  const { $from } = state.selection;
  if (!$from.parent.inlineContent) return false;

  // Walk up past xml_text_block to the real enclosing DITA element
  for (let d = $from.depth; d >= 1; d--) {
    const parentTag = getPmNodeTagName($from.node(d));
    if (!parentTag) continue;
    const allowed = getAllowedChildElements(parentTag, 'inline', resolveTaskModelForDocument(state.doc));
    if (allowed.length === 0 && isUnknownPmNode($from.node(d))) {
      return true;
    }
    return allowed.some((s) => s.tag === tagName);
  }
  return false;
}
