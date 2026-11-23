import {
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
} from 'prosemirror-state';
import {
  checkChildRemoval,
  getElementSpec,
  getPmChildTags,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  isChildAllowed,
  setRawAttr,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../../structure-options';
import { buildConvertedBlock, isBlockMoveOrderSafe, planBlockMove } from '../block-transforms';
import { makeNode } from './node-helpers.js';
/**
 * Guard Backspace so structural anchors (`<title>` of topic root, root element, body) are never accidentally destroyed.
 */
export const handleDitaBackspace: Command = (state, dispatch) => {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.parentOffset !== 0) return false;

  const parent = $from.parent;

  // Never delete or merge topic-level <title> or <shortdesc> backward into nothing
  if (
    (parent.type.name === 'dita_title' || parent.type.name === 'dita_shortdesc') &&
    $from.depth === 2
  ) {
    return true; // consume safely
  }

  // Inside an empty inline node (e.g. empty <b></b> or <codeph></codeph>) -> unwrap cleanly
  if (parent.isInline && parent.content.size === 0 && $from.depth >= 2) {
    if (!dispatch) return true;
    const start = $from.before($from.depth);
    const end = $from.after($from.depth);
    const tr = state.tr.delete(start, end);
    tr.setSelection(TextSelection.create(tr.doc, start));
    dispatch(tr.scrollIntoView());
    return true;
  }

  // Empty <p> inside a container with siblings -> remove cleanly and move cursor to previous sibling
  if (parent.type.name === 'dita_p' && parent.content.size === 0 && $from.depth >= 2) {
    const container = $from.node($from.depth - 1);
    if (container.childCount > 1) {
      if (!dispatch) return true;
      const start = $from.before($from.depth);
      const end = $from.after($from.depth);
      const tr = state.tr.delete(start, end);
      tr.setSelection(Selection.near(tr.doc.resolve(Math.max(1, start - 1)), -1));
      dispatch(tr.scrollIntoView());
      return true;
    }
  }

  return false;
};

/**
 * Update a single attribute on the ProseMirror node at `nodePos` in-place (preserving exact rawAttrs order).
 */
export function updateNodeRawAttr(
  nodePos: number,
  attrName: string,
  value: string | null,
): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    const currentRaw = getPmNodeRawAttrs(node);
    const nextRaw = setRawAttr(currentRaw, attrName, value);

    const nextAttrs: Record<string, unknown> = {
      ...node.attrs,
      rawAttrs: nextRaw,
    };

    // Keep synced typed attrs on CALS nodes if edited through Attributes Panel
    if (node.type.name === 'cals_tgroup' && attrName === 'cols' && value && /^\d+$/.test(value)) {
      nextAttrs.cols = Number(value);
    } else if (node.type.name === 'cals_colspec') {
      if (attrName === 'colnum' && value && /^\d+$/.test(value)) {
        nextAttrs.colnum = Number(value);
      } else if (attrName === 'colname') {
        nextAttrs.colname = value ?? '';
      } else if (attrName === 'colwidth') {
        nextAttrs.colwidth = value;
      }
    } else if (node.type.name === 'cals_entry' && attrName === 'morerows') {
      nextAttrs.rowspan = value && /^\d+$/.test(value) ? Number(value) + 1 : 1;
    }

    if (!dispatch) return true;
    const tr = state.tr.setNodeMarkup(nodePos, undefined, nextAttrs);
    dispatch(tr);
    return true;
  };
}

/**
 * Delete a specific DITA element at `nodePos`.
 *
 * The guard is the DITA 1.3 content model, not a tag whitelist: the document root, children of a
 * `required` slot (e.g. the `<cmd>` of a `<step>`) and the last item of a `oneOrMore` slot (e.g. the
 * only `<step>` of `<steps>`) are refused; everything else is deletable.
 */
export function deleteDitaNodeAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false; // Never delete the root element
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    const $pos = state.doc.resolve(nodePos);
    const parentTag = getPmNodeTagName($pos.parent) ?? '';
    const nodeTag = getPmNodeTagName(node) ?? '';
    if (
      checkChildRemoval(
        parentTag,
        nodeTag,
        getPmChildTags($pos.parent),
        resolveTaskModelForDocument(state.doc),
      )
    ) {
      return false;
    }

    if (!dispatch) return true;
    const tr = state.tr.delete(nodePos, nodePos + node.nodeSize);
    const target = Math.min(Math.max(1, nodePos), tr.doc.content.size);
    tr.setSelection(Selection.near(tr.doc.resolve(target), -1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Move a DITA block node up or down among its siblings inside its parent container.
 */
export function moveDitaNodeSibling(nodePos: number, direction: 'up' | 'down'): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    const $pos = state.doc.resolve(nodePos);
    if ($pos.depth < 1) return false;

    const parent = $pos.parent;
    const index = $pos.index($pos.depth);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= parent.childCount) return false;

    const sibling = parent.child(swapIndex);
    // Do not move blocks above a container's `<title>` or `<colspec>`
    if (
      direction === 'up' &&
      (sibling.type.name === 'dita_title' || sibling.type.name === 'cals_colspec')
    ) {
      return false;
    }
    if (node.type.name === 'dita_title' || node.type.name === 'cals_colspec') {
      return false;
    }

    // Ordered content models (taskbody workflow slots, `<title>`-first containers, …) must keep
    // their slot order: swapping two neighbours is only legal when the reordered tags validate.
    const parentTag = getPmNodeTagName(parent) ?? '';
    if (!isBlockMoveOrderSafe(parentTag, getPmChildTags(parent), index, direction === 'up' ? index - 1 : index + 2)) {
      return false;
    }

    if (!dispatch) return true;

    const parentStart = $pos.start($pos.depth);
    let offset = parentStart;
    for (let i = 0; i < Math.min(index, swapIndex); i++) {
      offset += parent.child(i).nodeSize;
    }

    const first = direction === 'up' ? sibling : node;
    const second = direction === 'up' ? node : sibling;
    const rangeEnd = offset + first.nodeSize + second.nodeSize;

    const tr = state.tr.replaceWith(offset, rangeEnd, [second, first]);
    const newPos = direction === 'up' ? offset : offset + second.nodeSize;
    tr.setSelection(Selection.near(tr.doc.resolve(newPos + 1), 1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Turn a block into another DITA block tag (Notion-style "Turn into"), keeping its text.
 */
export function convertDitaBlockAtPos(tagName: string, nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    const spec = getElementSpec(tagName);
    if (!spec || spec.tag === getPmNodeTagName(node)) return false;
    const parentTag = getPmNodeTagName(state.doc.resolve(nodePos).parent);
    if (
      !parentTag ||
      !isChildAllowed(parentTag, spec.tag, resolveTaskModelForDocument(state.doc))
    ) {
      return false;
    }
    const converted = buildConvertedBlock(node, spec);
    if (!converted) return false;
    if (!dispatch) return true;

    const tr = state.tr.replaceWith(nodePos, nodePos + node.nodeSize, converted);
    const caret = Math.min(nodePos + 1, tr.doc.content.size);
    tr.setSelection(Selection.near(tr.doc.resolve(caret), -1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Duplicate a block right below itself. */
export function duplicateDitaBlockAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    if (!dispatch) return true;
    const insertAt = nodePos + node.nodeSize;
    const tr = state.tr.insert(insertAt, node);
    tr.setSelection(Selection.near(tr.doc.resolve(insertAt + 1), 1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Move a block into one of the gaps of its own container (drag & drop from the gutter handle).
 */
export function moveDitaBlockToGap(nodePos: number, gapPos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    const plan = planBlockMove(nodePos, node.nodeSize, gapPos);
    if (!plan) return false;

    // Reordering must keep the ordered content model intact (drag is a *move*, not a re-slot).
    const $pos = state.doc.resolve(nodePos);
    if ($pos.depth < 1) return false;
    const parent = $pos.parent;
    const fromIndex = $pos.index($pos.depth);
    const parentStart = $pos.start($pos.depth);
    let gapIndex = 0;
    let offset = parentStart;
    while (gapIndex < parent.childCount && offset !== gapPos) {
      offset += parent.child(gapIndex)!.nodeSize;
      gapIndex += 1;
    }
    if (
      !isBlockMoveOrderSafe(
        getPmNodeTagName(parent) ?? '',
        getPmChildTags(parent),
        fromIndex,
        gapIndex,
      )
    ) {
      return false;
    }

    if (!dispatch) return true;

    const tr = state.tr.delete(plan.from, plan.to);
    tr.insert(plan.insertAt, node);
    tr.setSelection(Selection.near(tr.doc.resolve(plan.insertAt + 1), 1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Select a specific node from the Breadcrumb bar (moving cursor inside it or NodeSelecting atoms).
 */
export function selectNodeAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    if (!dispatch) return true;
    const tr = state.tr;
    if (node.isAtom) {
      tr.setSelection(NodeSelection.create(state.doc, nodePos));
    } else {
      tr.setSelection(Selection.near(state.doc.resolve(nodePos + 1), 1));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Ensure an empty mixed-content block container (like `<entry/>`, `<stentry/>`, `<li/>`)
 * receives an editable `xml_text_block` on click or Tab navigation.
 * Note: empty `xml_text_block` serializes to ZERO XML tags, preserving 100% lossless round-trip!
 */
export function hydrateEmptyContainerAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.childCount > 0 || node.isAtom || node.isTextblock) return false;

    const hydratable = new Set([
      'cals_entry',
      'dita_stentry',
      'dita_li',
      'dita_dd',
      'dita_note',
      'dita_choice',
      'dita_info',
      'dita_stepxmp',
      'dita_stepresult',
    ]);
    if (!hydratable.has(node.type.name)) return false;

    if (!dispatch) return true;
    const textBlock = makeNode('xml_text_block');
    const tr = state.tr.insert(nodePos + 1, textBlock);
    tr.setSelection(TextSelection.create(tr.doc, nodePos + 2));
    dispatch(tr.scrollIntoView());
    return true;
  };
}
