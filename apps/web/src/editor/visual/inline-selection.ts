import { Fragment, type Node as PMNode, type NodeType } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';
import {
  getAllowedChildElements,
  getPmNodeTagName,
  MODELED_INLINE_TAGS,
  type DitaElementSpec,
} from '@dita/core';

/**
 * Visually preferred inline tags shown first in the selection bubble toolbar.
 * Everything else legal at the caret stays reachable via the "更多元素" menu.
 */
export const INLINE_BUBBLE_QUICK_TAGS: readonly string[] = [
  'b',
  'i',
  'u',
  'codeph',
  'uicontrol',
  'filepath',
  'varname',
  'keyword',
];

const MAX_BUBBLE_ITEMS = 10;

/** Textblocks whose content is literal text only — DITA forbids inline markup inside them. */
const CODE_TEXTBLOCK_TYPES = new Set(['dita_codeblock', 'dita_pre', 'unknown_pre_block']);

export interface SharedInlineTextblock {
  node: PMNode;
  depth: number;
  /** ProseMirror position where `node.content` starts (i.e. `node` start pos + 1). */
  startPos: number;
}

export function isCodeTextblock(node: PMNode): boolean {
  return CODE_TEXTBLOCK_TYPES.has(node.type.name);
}

/**
 * Resolve the single textblock shared by both selection endpoints.
 * Returns `null` whenever the selection crosses a block boundary (two paragraphs,
 * list items, table cells, ...), because an inline element cannot wrap block content.
 */
export function findSharedInlineTextblock(
  state: EditorState,
  from: number,
  to: number,
): SharedInlineTextblock | null {
  if (to <= from) return null;
  const $from = state.doc.resolve(from);
  const sharedDepth = $from.sharedDepth(to);
  for (let d = sharedDepth; d >= 1; d--) {
    const node = $from.node(d);
    if (node.isTextblock) {
      return { node, depth: d, startPos: $from.start(d) };
    }
    if (!node.isInline) return null;
  }
  return null;
}

/**
 * Slice a lossless inline fragment out of `parent.content` between the given offsets.
 * Preserves surrounding inline nodes (`<b>`, `<i>`, `<codeph>`, comments, ...) by
 * recursively clipping partially covered children instead of flattening to plain text.
 */
export function sliceInlineContent(parent: PMNode, from: number, to: number): PMNode[] {
  const out: PMNode[] = [];
  let offset = 0;
  parent.forEach((child) => {
    const start = offset;
    const end = offset + child.nodeSize;
    offset = end;
    if (end <= from || start >= to) return;

    const localFrom = Math.max(0, from - start);
    const localTo = Math.min(child.nodeSize, to - start);

    if (child.isText) {
      const text = child.text ?? '';
      const piece = text.slice(localFrom, localTo);
      if (piece.length > 0) {
        out.push(child.type.schema.text(piece, child.marks));
      }
      return;
    }

    // Whole inline node inside the range -> keep it untouched (rawAttrs and nesting intact)
    if (localFrom === 0 && localTo === child.nodeSize) {
      out.push(child);
      return;
    }

    // Partially covered leaf/atom inline node cannot be sliced
    if (child.isLeaf) return;

    const innerFrom = Math.max(0, localFrom - 1);
    const innerTo = Math.min(child.content.size, localTo - 1);
    const inner = sliceInlineContent(child, innerFrom, innerTo);
    if (inner.length === 0) return;
    out.push(child.copy(Fragment.fromArray(inner)));
  });
  return out;
}

/**
 * Strip inline wrappers of the same type as the element being applied, so wrapping a
 * selection that already contains `<b>` never produces `<b>...<b>...</b>...</b>`.
 */
export function flattenSameTypeInline(
  nodes: readonly PMNode[],
  nodeType: NodeType,
): PMNode[] {
  const out: PMNode[] = [];
  for (const child of nodes) {
    if (child.isText || child.isLeaf || !child.isInline) {
      out.push(child);
      continue;
    }
    if (child.type === nodeType) {
      const inner: PMNode[] = [];
      child.forEach((grandChild) => {
        inner.push(grandChild);
      });
      out.push(...flattenSameTypeInline(inner, nodeType));
      continue;
    }
    const inner: PMNode[] = [];
    child.forEach((grandChild) => {
      inner.push(grandChild);
    });
    const flattened = flattenSameTypeInline(inner, nodeType);
    if (flattened.length === 0) continue;
    out.push(child.copy(Fragment.fromArray(flattened)));
  }
  return out;
}

export interface InlineBubbleInfo {
  visible: boolean;
  from: number;
  to: number;
  /** Innermost DITA element owning the selection text (e.g. `p`, `li`, `b`). */
  contextTag: string | null;
  /** Legal + modeled inline elements offered by the bubble, quick tags first. */
  items: DitaElementSpec[];
  /** Inline tags that already wrap the whole or part of the selection. */
  activeTags: Set<string>;
}

function emptyBubble(from: number, to: number): InlineBubbleInfo {
  return {
    visible: false,
    from,
    to,
    contextTag: null,
    items: [],
    activeTags: new Set<string>(),
  };
}

function resolveContextTag(state: EditorState, from: number, textblockDepth: number): string | null {
  const $from = state.doc.resolve(from);
  const deepest = Math.min($from.depth, textblockDepth);
  for (let d = deepest; d >= 1; d--) {
    const tag = getPmNodeTagName($from.node(d));
    if (tag) return tag;
  }
  return null;
}

function collectActiveInlineTags(state: EditorState, from: number, to: number): Set<string> {
  const active = new Set<string>();
  const $from = state.doc.resolve(from);
  // Inline ancestors around the selection start (e.g. cursor sits inside `<b>`)
  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    if (!node.isInline) break;
    const tag = getPmNodeTagName(node);
    if (tag) active.add(tag);
  }
  // Inline nodes fully covered by the selection
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return false;
    const tag = getPmNodeTagName(node);
    if (tag && pos >= from && pos + node.nodeSize <= to) {
      active.add(tag);
    }
    return true;
  });
  return active;
}

function buildBubbleItems(contextTag: string, activeTags: Set<string>): DitaElementSpec[] {
  const allowed = getAllowedChildElements(contextTag, 'inline').filter(
    (spec) =>
      spec.kind === 'inline' &&
      spec.tag !== 'image' &&
      MODELED_INLINE_TAGS.has(spec.tag),
  );
  const byTag = new Map(allowed.map((spec) => [spec.tag, spec]));
  const ordered: DitaElementSpec[] = [];
  const seen = new Set<string>();

  for (const tag of INLINE_BUBBLE_QUICK_TAGS) {
    const spec = byTag.get(tag);
    if (spec && !seen.has(tag)) {
      ordered.push(spec);
      seen.add(tag);
    }
  }
  // Keep already-active tags visible even when they are not part of the quick set
  for (const tag of activeTags) {
    const spec = byTag.get(tag);
    if (spec && !seen.has(tag)) {
      ordered.push(spec);
      seen.add(tag);
    }
  }
  for (const spec of allowed) {
    if (!seen.has(spec.tag)) {
      ordered.push(spec);
      seen.add(spec.tag);
    }
  }
  return ordered.slice(0, MAX_BUBBLE_ITEMS);
}

/**
 * Inspect the current selection to decide whether the floating inline-element
 * bubble toolbar should be shown, and which DITA inline elements it may offer.
 */
export function getInlineBubbleInfo(state: EditorState): InlineBubbleInfo {
  const { from, to } = state.selection;
  if (to <= from) return emptyBubble(from, to);

  const textblock = findSharedInlineTextblock(state, from, to);
  if (!textblock || isCodeTextblock(textblock.node)) {
    return emptyBubble(from, to);
  }

  if (state.doc.textBetween(from, to, '\n', '\n').trim().length === 0) {
    return emptyBubble(from, to);
  }

  const contextTag = resolveContextTag(state, from, textblock.depth);
  if (!contextTag) return emptyBubble(from, to);

  const activeTags = collectActiveInlineTags(state, from, to);
  const items = buildBubbleItems(contextTag, activeTags);
  if (items.length === 0) {
    return { ...emptyBubble(from, to), contextTag, activeTags };
  }

  return { visible: true, from, to, contextTag, items, activeTags };
}
