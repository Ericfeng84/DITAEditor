/**
 * DITA 1.3 drag-and-drop validation for the document outline.
 *
 * Every outline drop is evaluated against the real OASIS content models *before* touching the
 * document: membership (`isChildAllowed`), ordered sequence / cardinality
 * (`validateChildSequence`, `getInsertionSlot`), required-child removal policy
 * (`checkChildRemoval`) and ProseMirror schema fit (`canReplaceWith`).
 *
 * The evaluator only computes a plan — it never mutates the document. The visual command
 * (`moveDitaNodeByOutline`) applies the plan as one transaction.
 */

import type { Node as PMNode } from 'prosemirror-model';
import {
  checkChildRemoval,
  getInsertionSlot,
  getPmChildTags,
  getPmNodeTagName,
  hasSequenceModel,
  isChildAllowed,
  isUnknownPmNode,
  validateChildSequence,
  type StructureIssue,
  type StructureIssueCode,
  type TaskContentModel,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../structure-options.js';
import { PINNED_OUTLINE_TAGS } from './outline-model.js';

export type OutlineDropPlacement = 'before' | 'inside' | 'after';

export type OutlineDropBlockReason =
  /** Dropping a node onto itself, or into the position it already occupies. */
  | 'noop'
  /** The drop target sits inside the dragged node. */
  | 'self-or-descendant'
  /** Root element, `<title>`, `<colspec>`, `<thead>`, `<tgroup>`, `<sthead>` — pinned structure. */
  | 'pinned-node'
  /** The computed destination parent cannot hold block children (textblock / atom / inline). */
  | 'target-not-container'
  /** Removing the source would violate a required slot (`<cmd>`, last `<step>`, `<taskbody>`). */
  | 'source-required'
  /** DITA 1.3 content model does not allow the source element in the destination parent. */
  | 'not-allowed-in-target'
  /** The move would break the declared child order. */
  | 'out-of-order'
  /** The destination slot is full (`?` / bare) or an exclusive `|` alternative is taken. */
  | 'cardinality-limit'
  /** ProseMirror's schema refuses the node type at the destination gap. */
  | 'schema-incompatible';

export interface OutlineDropEvaluation {
  ok: boolean;
  placement: OutlineDropPlacement;
  sourcePos: number;
  targetPos: number;
  sourceTag?: string;
  targetTag?: string;
  destParentTag?: string;
  destParentPos?: number;
  /**
   * Position (in pre-move document coordinates) where the source node is inserted; callers must
   * shift it by `-sourceNode.nodeSize` when it lies after `sourcePos`.
   */
  insertGapPos?: number;
  /** 0-based DITA element index inside `destParent`, in pre-move child coordinates. */
  destElementIndex?: number;
  reason?: OutlineDropBlockReason;
}

interface OutlineElementEntry {
  tag: string;
  rawIndex: number;
  pos: number;
  nodeSize: number;
}

function collectElementEntries(parent: PMNode, parentPos: number): OutlineElementEntry[] {
  const entries: OutlineElementEntry[] = [];
  parent.forEach((child, offset, rawIndex) => {
    const tag = getPmNodeTagName(child);
    if (!tag) return;
    entries.push({
      tag,
      rawIndex,
      pos: parentPos + 1 + offset,
      nodeSize: child.nodeSize,
    });
  });
  return entries;
}

/** Gap position (pre-move coordinates) for inserting at 0-based element `index`. */
function gapPosForElementIndex(
  entries: readonly OutlineElementEntry[],
  destParentPos: number,
  index: number,
): number {
  const entry = entries[index];
  if (entry) return entry.pos;
  const last = entries[entries.length - 1];
  if (last) return last.pos + last.nodeSize;
  return destParentPos + 1;
}

/** Raw ProseMirror child index for a gap, so `canReplaceWith` sees comments/PIs too. */
function rawIndexForGap(parent: PMNode, parentPos: number, gapPos: number): number {
  let rawIndex = 0;
  let offset = parentPos + 1;
  for (let i = 0; i < parent.childCount; i += 1) {
    if (offset >= gapPos) break;
    offset += parent.child(i).nodeSize;
    rawIndex += 1;
  }
  return rawIndex;
}

function countEntriesBefore(
  entries: readonly OutlineElementEntry[],
  pos: number,
): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.pos >= pos) break;
    count += 1;
  }
  return count;
}

function mapIssueCodeToReason(code: StructureIssueCode | undefined): OutlineDropBlockReason {
  switch (code) {
    case 'child-out-of-order':
      return 'out-of-order';
    case 'child-cardinality':
    case 'slot-exclusive':
      return 'cardinality-limit';
    case 'child-not-allowed':
      return 'not-allowed-in-target';
    default:
      return 'not-allowed-in-target';
  }
}

const SEQUENCE_VIOLATION_CODES: ReadonlySet<StructureIssueCode> = new Set([
  'child-out-of-order',
  'child-cardinality',
  'slot-exclusive',
  'child-not-allowed',
]);

/**
 * Return the first sequence violation that is only present *after* the move.
 * Existing problems under the destination parent never block a drop.
 */
function introducedSequenceViolation(
  baseline: readonly StructureIssue[],
  next: readonly StructureIssue[],
): StructureIssue | null {
  const budget = new Map<string, number>();
  for (const issue of baseline) {
    if (!SEQUENCE_VIOLATION_CODES.has(issue.code)) continue;
    const key = `${issue.code}|${issue.childTag}`;
    budget.set(key, (budget.get(key) ?? 0) + 1);
  }
  for (const issue of next) {
    if (!SEQUENCE_VIOLATION_CODES.has(issue.code)) continue;
    const key = `${issue.code}|${issue.childTag}`;
    const remaining = budget.get(key) ?? 0;
    if (remaining > 0) {
      budget.set(key, remaining - 1);
      continue;
    }
    return issue;
  }
  return null;
}

function isOutlineContainer(node: PMNode): boolean {
  return !node.isTextblock && !node.isAtom && !node.isInline;
}

/**
 * Evaluate whether `sourcePos` may move next to / into `targetPos`.
 *
 * @param placement `before` / `after` place the node as a sibling of the target; `inside` appends
 *   it as the target's last child (sequence-aware, so `inside <section>` lands after `<title>`).
 * @param taskModel defaults to the document's own task shell variant.
 */
export function evaluateOutlineDrop(
  doc: PMNode,
  sourcePos: number,
  targetPos: number,
  placement: OutlineDropPlacement,
  taskModel?: TaskContentModel,
): OutlineDropEvaluation {
  const model = taskModel ?? resolveTaskModelForDocument(doc);
  const base = { placement, sourcePos, targetPos };
  const fail = (
    reason: OutlineDropBlockReason,
    extra: Partial<OutlineDropEvaluation> = {},
  ): OutlineDropEvaluation => ({ ok: false, ...base, reason, ...extra });

  if (!Number.isInteger(sourcePos) || !Number.isInteger(targetPos)) {
    return fail('pinned-node');
  }
  if (sourcePos <= 0 || targetPos < 0 || targetPos > doc.content.size) {
    return fail('pinned-node');
  }

  const sourceNode = doc.nodeAt(sourcePos);
  if (!sourceNode) return fail('pinned-node');
  const sourceTag = getPmNodeTagName(sourceNode);
  if (!sourceTag) return fail('pinned-node');
  if (PINNED_OUTLINE_TAGS.has(sourceTag)) {
    return fail('pinned-node', { sourceTag });
  }

  const sourceEnd = sourcePos + sourceNode.nodeSize;
  if (targetPos >= sourcePos && targetPos < sourceEnd) {
    return fail('self-or-descendant', { sourceTag });
  }

  const targetNode = doc.nodeAt(targetPos);
  if (!targetNode) return fail('target-not-container', { sourceTag });
  const targetTag = getPmNodeTagName(targetNode);
  if (!targetTag) return fail('target-not-container', { sourceTag });

  const targetResolved = doc.resolve(targetPos);
  const destParent = placement === 'inside' ? targetNode : targetResolved.parent;
  // `destParentPos` is always the node start of the destination parent so that
  // `collectElementEntries(parent, pos)` can compute `pos + 1 + offset` exactly.
  const destParentPos =
    placement === 'inside' ? targetPos : targetPos - targetResolved.parentOffset - 1;
  const destParentTag = getPmNodeTagName(destParent);
  if (!destParentTag) return fail('target-not-container', { sourceTag, targetTag });
  if (placement === 'inside' && !isOutlineContainer(targetNode)) {
    return fail('target-not-container', { sourceTag, targetTag, destParentTag });
  }

  const sourceResolved = doc.resolve(sourcePos);
  const sourceParent = sourceResolved.parent;
  const sourceParentPos = sourcePos - sourceResolved.parentOffset - 1;
  const sourceParentTag = getPmNodeTagName(sourceParent) ?? '';
  const sameContainer = destParent === sourceParent && destParentPos === sourceParentPos;

  const entries = collectElementEntries(destParent, destParentPos);
  const destElementTags = entries.map((entry) => entry.tag);

  let destElementIndex: number;
  if (placement === 'inside') {
    destElementIndex = destElementTags.length;
  } else {
    destElementIndex = countEntriesBefore(entries, targetPos);
    if (placement === 'after') destElementIndex += 1;
  }

  const context: Partial<OutlineDropEvaluation> = {
    sourceTag,
    targetTag,
    destParentTag,
    destParentPos,
  };

  // Never drop a node before a container's leading `<title>` / `<colspec>`, whatever the
  // container's content model says about the sibling order.
  if (placement !== 'inside' && destElementIndex === 0) {
    const leading = entries[0];
    if (leading && PINNED_OUTLINE_TAGS.has(leading.tag)) {
      return fail('pinned-node', context);
    }
  }

  if (!sameContainer) {
    if (!sourceParentTag) return fail('source-required', context);
    const removalObstacle = checkChildRemoval(
      sourceParentTag,
      sourceTag,
      getPmChildTags(sourceParent),
      model,
    );
    if (removalObstacle) {
      return fail('source-required', context);
    }

    const isKnownSource = !isUnknownPmNode(sourceNode);
    if (isKnownSource && !isChildAllowed(destParentTag, sourceTag, model)) {
      return fail('not-allowed-in-target', context);
    }

    if (placement === 'inside' && hasSequenceModel(destParentTag)) {
      const slot = getInsertionSlot(
        destParentTag,
        destElementTags,
        sourceTag,
        destElementTags.length,
        model,
      );
      if (!slot.ok) {
        return fail(mapIssueCodeToReason(slot.issue?.code), context);
      }
      destElementIndex = Math.max(0, Math.min(destElementTags.length, slot.index));
    }

    if (placement !== 'inside' && hasSequenceModel(destParentTag)) {
      const reordered = [...destElementTags];
      reordered.splice(destElementIndex, 0, sourceTag);
      const baseline = validateChildSequence(destParentTag, destElementTags, {
        taskModel: model,
      });
      const next = validateChildSequence(destParentTag, reordered, { taskModel: model });
      const introduced = introducedSequenceViolation(baseline, next);
      if (introduced) return fail(mapIssueCodeToReason(introduced.code), context);
    }

    const insertGapPos = gapPosForElementIndex(entries, destParentPos, destElementIndex);
    const destRawIndex = rawIndexForGap(destParent, destParentPos, insertGapPos);
    if (!destParent.canReplaceWith(destRawIndex, destRawIndex, sourceNode.type)) {
      return fail('schema-incompatible', { ...context, insertGapPos, destElementIndex });
    }

    return {
      ok: true,
      ...base,
      ...context,
      insertGapPos,
      destElementIndex,
    };
  }

  // --- Same-container reorder -------------------------------------------------------------
  const sourceElementIndex = entries.findIndex((entry) => entry.pos === sourcePos);
  if (sourceElementIndex < 0) return fail('source-required', context);

  if (
    destElementIndex === 0 &&
    sourceElementIndex !== 0 &&
    entries[0] !== undefined &&
    PINNED_OUTLINE_TAGS.has(entries[0].tag)
  ) {
    return fail('pinned-node', context);
  }

  if (destElementIndex === sourceElementIndex || destElementIndex === sourceElementIndex + 1) {
    return fail('noop', context);
  }

  const withoutSource = destElementTags.filter((_, index) => index !== sourceElementIndex);
  const insertAt =
    destElementIndex > sourceElementIndex ? destElementIndex - 1 : destElementIndex;
  const reordered = [
    ...withoutSource.slice(0, insertAt),
    sourceTag,
    ...withoutSource.slice(insertAt),
  ];
  const issues = validateChildSequence(destParentTag, reordered, { taskModel: model });
  if (issues.some((issue) => issue.code === 'child-out-of-order')) {
    return fail('out-of-order', context);
  }

  const insertGapPos = gapPosForElementIndex(entries, destParentPos, destElementIndex);
  return {
    ok: true,
    ...base,
    ...context,
    insertGapPos,
    destElementIndex,
  };
}
