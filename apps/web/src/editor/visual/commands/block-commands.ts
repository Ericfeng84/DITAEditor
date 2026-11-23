import type { Node as PMNode } from 'prosemirror-model';
import type { Command, Transaction } from 'prosemirror-state';
import {
  getInsertionSlot,
  getPmChildTags,
  getPmNodeTagName,
  hasSequenceModel,
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
    const containerDepth =
      targetContainerDepth ?? findLegalAncestorDepthForBlock(state, tagName);
    if (containerDepth === null || containerDepth < 1) return false;

    const newNode = createDitaElementSkeleton(tagName, initialAttrs);
    if (!newNode) return false;

    const { $from } = state.selection;
    if (containerDepth > $from.depth) return false;

    const containerNode = $from.node(containerDepth);
    const containerStart = $from.start(containerDepth);
    const containerTag = getPmNodeTagName(containerNode) ?? '';

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
      resolveTaskModelForDocument(state.doc),
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

    // Even for an explicit gap, keep ordered content models correct: a `+` divider sitting after
    // `<steps>` re-anchors `<prereq>` to its legal slot, while a gap between two `<step>` / `<li>`
    // items stays right where the user clicked.
    const $pos = state.doc.resolve(insertPos);
    const parentTag = getPmNodeTagName($pos.parent) ?? '';
    const sequence = resolveSequenceAnchor(
      $pos.parent,
      $pos.start($pos.depth),
      parentTag,
      tagName,
      insertPos,
      resolveTaskModelForDocument(state.doc),
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
