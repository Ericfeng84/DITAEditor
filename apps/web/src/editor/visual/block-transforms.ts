import { Fragment, type Node as PMNode } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';
import {
  DITA_CONTENT_MODEL,
  checkChildRemoval,
  ditaSchema,
  getAllowedChildElements,
  getElementSpec,
  getInsertableTagsBySequence,
  getPmChildTags,
  getPmNodeTagName,
  hasSequenceModel,
  isChildAllowed,
  validateChildSequence,
  type ChildRemovalObstacle,
  type DitaElementSpec,
  type TaskContentModel,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../structure-options';

/**
 * Block containers whose children can be reordered with the Notion-style drag handle.
 * Every entry models "a list of sibling blocks", so moving a child between the gaps of
 * one container never breaks the DITA 1.3 content model.
 */
export const BLOCK_CONTAINER_TAGS: ReadonlySet<string> = new Set([
  'body',
  'bodydiv',
  'conbody',
  'conbodydiv',
  'sectiondiv',
  'taskbody',
  'refbody',
  'refbodydiv',
  'properties',
  'abstract',
  'section',
  'example',
  'refsyn',
  'prereq',
  'context',
  'steps',
  'substeps',
  'choices',
  'result',
  'postreq',
  'tasktroubleshooting',
  'steps-informal',
  'steptroubleshooting',
  'tutorialinfo',
  'itemgroup',
  'choicetable',
  'related-links',
  'linklist',
  'linkpool',
  'linkinfo',
  'step',
  'note',
  'li',
  'dd',
  'div',
  'info',
  'lq',
  'ul',
  'ol',
  'sl',
  'dl',
  'simpletable',
  'table',
]);

/** Blocks that must keep their position inside the parent (title first, metadata, colspecs). */
const PINNED_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'title',
  'shortdesc',
  'prolog',
  'colspec',
  'thead',
  'shortdesc',
]);

/** Never offered as conversion targets: document scaffolding and table internals. */
const NON_CONVERTIBLE_TAGS: ReadonlySet<string> = new Set([
  'topic',
  'concept',
  'task',
  'reference',
  'glossentry',
  'body',
  'conbody',
  'taskbody',
  'refbody',
  'prolog',
  'related-links',
  'title',
  'shortdesc',
  'tgroup',
  'colspec',
  'thead',
  'tbody',
  'row',
  'entry',
  'sthead',
  'strow',
  'stentry',
  'image',
  'xref',
  'fn',
]);

/**
 * Blocks whose content model is "phrasing content + mixed text": a conversion can move the
 * original inline content straight into them (e.g. `<p>` → `<li>`).
 */
const INLINE_HOST_TAGS: ReadonlySet<string> = new Set([
  'p',
  'li',
  'dd',
  'dt',
  'entry',
  'stentry',
  'cmd',
  'stepresult',
  'stepxmp',
  'info',
  'title',
  'shortdesc',
  'desc',
  'linktext',
  'searchtitle',
  'navtitle',
]);

/** Tags that only hold code/verbatim text: conversions flatten their content to plain text. */
const TEXT_ONLY_TAGS: ReadonlySet<string> = new Set([
  'codeblock',
  'pre',
  'lines',
  'screen',
  'msgblock',
]);

function isInlineOnlyContent(node: PMNode): boolean {
  let inlineOnly = true;
  node.forEach((child) => {
    if (!child.isText && !child.isInline) inlineOnly = false;
  });
  return inlineOnly;
}

function acceptsBlockContent(tag: string): boolean {
  const model = DITA_CONTENT_MODEL[tag] ?? [];
  return model.some((childTag) => (getElementSpec(childTag)?.kind ?? 'block') === 'block');
}

function resolveConvertMode(src: PMNode, srcTag: string, targetTag: string): BlockConvertMode | null {
  const inlineOnly = isInlineOnlyContent(src);
  if (!inlineOnly) {
    return isChildAllowed(targetTag, srcTag) ? 'wrap-block' : null;
  }
  if (INLINE_HOST_TAGS.has(targetTag)) return 'inline';
  if (TEXT_ONLY_TAGS.has(targetTag)) return 'text';
  if (isChildAllowed(targetTag, 'p')) return 'wrap-inline';
  if (acceptsBlockContent(targetTag) && isChildAllowed(targetTag, srcTag)) return 'wrap-block';
  return null;
}

export interface BlockHandleTarget {
  /** Document position of the block node the handle manages. */
  blockPos: number;
  blockNode: PMNode;
  blockTag: string;
  /** Container the block lives in (its siblings are the drag/drop candidates). */
  containerPos: number;
  containerDepth: number;
  containerNode: PMNode;
  containerTag: string;
  /**
   * Dragging is only offered inside a movable container (a reorderable sibling list) and never
   * for pinned blocks (`<title>` / `<shortdesc>` / `<prolog>`), whose position is model-defined.
   */
  movable: boolean;
  /** `null` when the block may be deleted; otherwise the content-model reason it may not. */
  deleteObstacle: ChildRemovalObstacle | null;
}

function buildBlockHandleTarget(
  blockNode: PMNode,
  blockPos: number,
  containerNode: PMNode,
  containerPos: number,
  containerDepth: number,
  taskModel: TaskContentModel = 'strict',
): BlockHandleTarget | null {
  const blockTag = getPmNodeTagName(blockNode);
  const containerTag = getPmNodeTagName(containerNode);
  if (!blockTag || !containerTag) return null;
  const movable = BLOCK_CONTAINER_TAGS.has(containerTag) && !PINNED_BLOCK_TAGS.has(blockTag);
  return {
    blockPos,
    blockNode,
    blockTag,
    containerPos,
    containerDepth,
    containerNode,
    containerTag,
    movable,
    deleteObstacle: checkChildRemoval(
      containerTag,
      blockTag,
      getPmChildTags(containerNode),
      taskModel,
    ),
  };
}

/**
 * Resolve the block handle target for an explicitly selected element (tag pill, breadcrumb,
 * attribute inspector). Unlike the caret-based walk this also covers pinned blocks
 * (`<shortdesc>`, `<prolog>`) and structural children of a topic root (`<taskbody>`, `<steps>`),
 * so those elements get the same quick tools without becoming draggable.
 */
export function findBlockHandleTargetForNode(
  state: EditorState,
  nodePos: number,
): BlockHandleTarget | null {
  if (nodePos <= 0 || nodePos >= state.doc.content.size) return null;
  const node = state.doc.nodeAt(nodePos);
  if (!node || node.isInline || !node.type.isBlock) return null;
  let $pos;
  try {
    $pos = state.doc.resolve(nodePos);
  } catch {
    return null;
  }
  if ($pos.depth < 1) return null;
  return buildBlockHandleTarget(
    node,
    nodePos,
    $pos.parent,
    $pos.before($pos.depth),
    $pos.depth,
    resolveTaskModelForDocument(state.doc),
  );
}

/**
 * Resolve the block a left-gutter handle should manage for a document position:
 * the deepest modeled block element that sits directly inside a movable container.
 */
export function findBlockHandleTarget(state: EditorState, pos: number): BlockHandleTarget | null {
  const size = state.doc.content.size;
  const safePos = Math.max(0, Math.min(pos, size));
  let $pos;
  try {
    $pos = state.doc.resolve(safePos);
  } catch {
    return null;
  }

  for (let depth = $pos.depth; depth >= 1; depth -= 1) {
    const node = $pos.node(depth);
    if (node.isInline) continue;
    const tag = getPmNodeTagName(node);
    if (!tag || PINNED_BLOCK_TAGS.has(tag)) continue;
    const parent = $pos.node(depth - 1);
    const parentTag = getPmNodeTagName(parent);
    if (!parentTag || !BLOCK_CONTAINER_TAGS.has(parentTag)) continue;
    return buildBlockHandleTarget(
      node,
      $pos.before(depth),
      parent,
      $pos.before(depth - 1),
      depth - 1,
      resolveTaskModelForDocument(state.doc),
    );
  }
  return null;
}

/** Whether duplicating `blockTag` stays legal for the container's content model (one-shot slots are not). */
export function canDuplicateBlock(
  containerTag: string,
  containerNode: PMNode,
  blockTag: string,
  taskModel: TaskContentModel = 'strict',
): boolean {
  return (
    getInsertableTagsBySequence(containerTag, getPmChildTags(containerNode), [blockTag], taskModel)
      .length > 0
  );
}

/** Index of the handled block among its container's children, or -1 when it is not a child. */
export function blockIndexInContainer(target: BlockHandleTarget): number {
  return blockIndexInParent(target.containerPos, target.containerNode, target.blockPos);
}

/** Index of the child at `childPos` inside `parentNode` (whose own document position is `parentPos`). */
export function blockIndexInParent(
  parentPos: number,
  parentNode: PMNode,
  childPos: number,
): number {
  let offset = parentPos + 1;
  for (let index = 0; index < parentNode.childCount; index += 1) {
    if (offset === childPos) return index;
    offset += parentNode.child(index)!.nodeSize;
  }
  return -1;
}

/**
 * Whether dropping the block at `gapIndex` (the boundary before child `gapIndex`) keeps the ordered
 * content model valid — e.g. `<prereq>` must never land after `<steps>` inside `<taskbody>`.
 * Reordering only ever changes order, so `child-out-of-order` is the only issue that can appear.
 */
export function isBlockMoveOrderSafe(
  containerTag: string,
  childTags: readonly string[],
  fromIndex: number,
  gapIndex: number,
): boolean {
  if (fromIndex < 0 || fromIndex >= childTags.length) return false;
  if (!hasSequenceModel(containerTag)) return true;
  if (gapIndex === fromIndex || gapIndex === fromIndex + 1) return false;
  const reordered = [...childTags];
  const moved = reordered.splice(fromIndex, 1)[0];
  if (moved === undefined) return false;
  reordered.splice(gapIndex > fromIndex ? gapIndex - 1 : gapIndex, 0, moved);
  return !validateChildSequence(containerTag, reordered).some(
    (issue) => issue.code === 'child-out-of-order',
  );
}

/** Gap positions (before the first child, between children, after the last one). */
export function computeBlockGaps(containerPos: number, containerNode: PMNode): number[] {
  const gaps: number[] = [containerPos + 1];
  let offset = containerPos + 1;
  for (let index = 0; index < containerNode.childCount; index += 1) {
    offset += containerNode.child(index).nodeSize;
    gaps.push(offset);
  }
  return gaps;
}

export interface BlockMovePlan {
  from: number;
  to: number;
  insertAt: number;
}

/** Plan a move of `blockNode` to one of the container gaps, or null when it is a no-op. */
export function planBlockMove(blockPos: number, blockSize: number, gapPos: number): BlockMovePlan | null {
  if (gapPos === blockPos || gapPos === blockPos + blockSize) return null;
  return {
    from: blockPos,
    to: blockPos + blockSize,
    insertAt: gapPos > blockPos ? gapPos - blockSize : gapPos,
  };
}

export type BlockConvertMode = 'inline' | 'wrap-inline' | 'wrap-block' | 'text';

export interface BlockConvertOption {
  spec: DitaElementSpec;
  mode: BlockConvertMode;
}

/**
 * Blocks the current block can be turned into, restricted to tags legal for its container
 * and to conversions that keep the content model valid.
 */
export function getBlockConvertOptions(src: PMNode, parentTag: string): BlockConvertOption[] {
  const srcTag = getPmNodeTagName(src);
  if (!srcTag) return [];
  const options: BlockConvertOption[] = [];
  for (const spec of getAllowedChildElements(parentTag, 'block')) {
    if (spec.tag === srcTag || NON_CONVERTIBLE_TAGS.has(spec.tag)) continue;
    const mode = resolveConvertMode(src, srcTag, spec.tag);
    if (mode) options.push({ spec, mode });
  }
  return options;
}

function resolveNodeType(spec: DitaElementSpec) {
  const typeName = spec.pmNodeType ?? `dita_${spec.tag.replace(/-/g, '_')}`;
  return ditaSchema.nodes[typeName] ?? null;
}

/** Build the converted block node (attributes are dropped: they belong to the old tag). */
export function buildConvertedBlock(src: PMNode, spec: DitaElementSpec): PMNode | null {
  const type = resolveNodeType(spec);
  if (!type) return null;
  const srcTag = getPmNodeTagName(src) ?? '';
  const mode = resolveConvertMode(src, srcTag, spec.tag);
  if (!mode) return null;
  const attrs = { rawAttrs: [], namespaceURI: null };

  if (mode === 'inline') {
    return type.create(attrs, src.content);
  }
  if (mode === 'wrap-inline') {
    const paragraphType = ditaSchema.nodes['dita_p'];
    if (!paragraphType) return null;
    const paragraph = paragraphType.create(attrs, src.content);
    return type.create(attrs, Fragment.from(paragraph));
  }
  if (mode === 'text') {
    const text = src.textContent;
    return type.create(attrs, text.length > 0 ? ditaSchema.text(text) : null);
  }
  return type.create(attrs, Fragment.from(src));
}
