import type { Node as PMNode, ResolvedPos } from 'prosemirror-model';
import type { Command, Transaction } from 'prosemirror-state';
import {
  getInsertionSlot,
  getPmChildTags,
  getPmNodeTagName,
  hasSequenceModel,
  isChildAllowed,
  type RawAttrs,
  type TaskContentModel,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../../structure-options';
import { findLegalAncestorDepthForBlock } from '../selection-info';
import { createDitaElementSkeleton } from './element-skeleton.js';
import { EMPTY_ATTRS, selectFirstEditablePos } from './node-helpers.js';
/**
 * Resolve the sequence-correct insertion offset for `tagName` inside `containerNode`.
 *
 * When `preferredPos` (from the cursor or a clicked between-block `+` gap) already falls inside
 * the legal `[minIndex, maxIndex]` range — e.g. inserting a `<li>` or `<step>` in the middle of
 * a list — `preferredPos` is preserved verbatim. When it falls outside the legal range, the
 * insertion is re-anchored to the DTD-correct slot.
 */
function resolveSequenceAnchor(
  containerNode: PMNode,
  containerStart: number,
  containerTag: string,
  tagName: string,
  preferredPos: number,
  taskModel: TaskContentModel = 'strict',
): { ok: boolean; pos: number } {
  if (!hasSequenceModel(containerTag)) return { ok: true, pos: preferredPos };

  // Element children only: comments / PIs / xml_text wrappers are invisible to DITA content models.
  const elementChildren: { tag: string; pos: number; size: number }[] = [];
  let offset = containerStart;
  containerNode.forEach((child) => {
    const childTag = getPmNodeTagName(child);
    if (childTag) elementChildren.push({ tag: childTag, pos: offset, size: child.nodeSize });
    offset += child.nodeSize;
  });

  let preferredIndex = 0;
  for (const child of elementChildren) {
    if (child.pos + child.size <= preferredPos) {
      preferredIndex++;
    } else {
      break;
    }
  }

  const slot = getInsertionSlot(
    containerTag,
    elementChildren.map((child) => child.tag),
    tagName,
    preferredIndex,
    taskModel,
  );
  if (!slot.ok) return { ok: false, pos: -1 };
  if (slot.index === preferredIndex) {
    return { ok: true, pos: preferredPos };
  }
  const anchor = slot.index > 0 ? elementChildren[slot.index - 1] : undefined;
  return { ok: true, pos: anchor ? anchor.pos + anchor.size : containerStart };
}

/**
 * Insert a DITA block element into a legal ancestor container according to DITA 1.3 content rules.
 */
export function insertBlockDitaElement(
  tagName: string,
  targetContainerDepth?: number,
  initialAttrs: RawAttrs = EMPTY_ATTRS,
): Command {
  return (state, dispatch) => {
    const newNode = createDitaElementSkeleton(tagName, initialAttrs);
    if (!newNode) return false;

    const { $from } = state.selection;
    const taskModel = resolveTaskModelForDocument(state.doc);
    let containerDepth = targetContainerDepth ?? findLegalAncestorDepthForBlock(state, tagName);
    if (containerDepth === null || containerDepth < 1 || containerDepth > $from.depth) return false;

    // A leaf textblock (`<p>`, `<cmd>`, `<title>`, …) or an inline node can never host a block
    // child. Inserting into it splits the textblock and produces invalid DITA (a `<step>` inside
    // `<cmd>`, a second `<cmd>`, …), so walk up to the nearest non-textblock ancestor that accepts
    // the element instead of ever writing inside the leaf.
    let containerNode = $from.node(containerDepth);
    while (
      containerDepth > 1 &&
      (containerNode.isTextblock ||
        containerNode.isInline ||
        !isChildAllowed(getPmNodeTagName(containerNode) ?? '', tagName, taskModel))
    ) {
      containerDepth -= 1;
      containerNode = $from.node(containerDepth);
    }
    if (containerNode.isTextblock || containerNode.isInline) return false;

    const containerStart = $from.start(containerDepth);
    const containerTag = getPmNodeTagName(containerNode) ?? '';
    if (!isChildAllowed(containerTag, tagName, taskModel)) return false;

    const preferredPos =
      $from.depth > containerDepth
        ? $from.after(containerDepth + 1)
        : $from.end(containerDepth);

    // Keep cursor-relative placement when valid (e.g. repeating lists/steps), or re-anchor to the
    // DTD-correct slot when out of order (title-first, prereq -> context -> steps -> result -> postreq, ...).
    const sequence = resolveSequenceAnchor(
      containerNode,
      containerStart,
      containerTag,
      tagName,
      preferredPos,
      taskModel,
    );
    if (!sequence.ok) return false;
    const insertPos = sequence.pos;

    if (!dispatch) return true;
    const tr = state.tr.insert(insertPos, newNode);
    selectFirstEditablePos(tr, insertPos, newNode);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Nearest ancestor container that legally accepts `tagName` as a direct block child.
 *
 * A between-block `+` widget keeps its offset in the DOM, but the document may have grown under it
 * (text typed in the same paragraph / `<cmd>`). Resolving that offset can land *inside* a leaf
 * textblock or an inline node, and inserting there splits `<p>` / `<cmd>` into two elements. Walk up
 * to the nearest enclosing non-inline, non-textblock container whose DITA tag accepts `tagName` and
 * insert at the gap right after the child that held the offset.
 */
function resolveLegalBlockInsertion(
  $pos: ResolvedPos,
  tagName: string,
  insertPos: number,
  taskModel: TaskContentModel,
): {
  containerNode: PMNode;
  containerStart: number;
  containerTag: string;
  preferredPos: number;
} | null {
  for (let depth = $pos.depth; depth >= 1; depth -= 1) {
    const containerNode = $pos.node(depth);
    if (containerNode.isInline || containerNode.isTextblock) continue;
    const containerTag = getPmNodeTagName(containerNode);
    if (!containerTag || !isChildAllowed(containerTag, tagName, taskModel)) continue;
    return {
      containerNode,
      containerStart: $pos.start(depth),
      containerTag,
      // Inside a textblock / non-accepting descendant: re-anchor to the gap immediately AFTER that
      // descendant inside the accepting container, never into its content.
      preferredPos: depth === $pos.depth ? insertPos : $pos.after(depth + 1),
    };
  }
  return null;
}

/**
 * Insert a DITA block element at an exact ProseMirror gap offset (used by Jupyter-style between-block `+` inserters).
 */
export function insertBlockDitaElementAtPos(
  tagName: string,
  insertPos: number,
  initialAttrs: RawAttrs = EMPTY_ATTRS,
): Command {
  return (state, dispatch) => {
    if (insertPos < 0 || insertPos > state.doc.content.size) return false;
    const newNode = createDitaElementSkeleton(tagName, initialAttrs);
    if (!newNode) return false;

    const taskModel = resolveTaskModelForDocument(state.doc);
    const $pos = state.doc.resolve(insertPos);

    // A gap widget can be clicked after the document moved under it. Never insert blindly into a
    // textblock / inline node or a container that does not accept the element: re-anchor to the
    // nearest legal ancestor container so `<p>` / `<cmd>` are never split.
    const anchor = resolveLegalBlockInsertion($pos, tagName, insertPos, taskModel);
    if (!anchor) return false;

    // Even for an explicit gap, keep ordered content models correct: a `+` divider sitting after
    // `<steps>` re-anchors `<prereq>` to its legal slot, while a gap between two `<step>` / `<li>`
    // items stays right where the user clicked.
    const sequence = resolveSequenceAnchor(
      anchor.containerNode,
      anchor.containerStart,
      anchor.containerTag,
      tagName,
      anchor.preferredPos,
      taskModel,
    );
    if (!sequence.ok) return false;
    const targetPos = sequence.pos;

    if (!dispatch) return true;
    const tr = state.tr.insert(targetPos, newNode);
    selectFirstEditablePos(tr, targetPos, newNode);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Topic root -> its mandatory body wrapper. `body`/`conbody`/`taskbody`/`refbody` are the only
 * legal parents for prose blocks, so a topic that arrives without one cannot accept any content
 * until the wrapper exists.
 */
const TOPIC_BODY_WRAPPER: Readonly<Record<string, string>> = {
  topic: 'body',
  concept: 'conbody',
  task: 'taskbody',
  reference: 'refbody',
};

/**
 * Insert the topic root's missing body wrapper at its DTD-correct slot and focus its first
 * editable textblock. Returns false when the root is not a topic root or already has its wrapper.
 */
export function insertMissingTopicBody(
  tr: Transaction,
  rootNode: PMNode,
  rootStart: number,
  rootTag: string,
  preferredPos: number,
  taskModel: TaskContentModel = 'strict',
): boolean {
  const bodyTag = TOPIC_BODY_WRAPPER[rootTag];
  if (!bodyTag) return false;
  if (getPmChildTags(rootNode).includes(bodyTag)) return false;
  const bodyNode = createDitaElementSkeleton(bodyTag);
  if (!bodyNode) return false;
  // Re-anchor to the legal slot so a body inserted while `<related-links>` is present still
  // lands before it.
  const anchor = resolveSequenceAnchor(
    rootNode,
    rootStart,
    rootTag,
    bodyTag,
    preferredPos,
    taskModel,
  );
  if (!anchor.ok) return false;
  tr.insert(anchor.pos, bodyNode);
  selectFirstEditablePos(tr, anchor.pos, bodyNode);
  return true;
}
