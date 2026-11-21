import { Fragment, type Node as PMNode } from 'prosemirror-model';
import type { EditorState } from 'prosemirror-state';
import {
  DITA_CONTENT_MODEL,
  ditaSchema,
  getAllowedChildElements,
  getElementSpec,
  getPmNodeTagName,
  isChildAllowed,
  type DitaElementSpec,
} from '@dita/core';

/**
 * Block containers whose children can be reordered with the Notion-style drag handle.
 * Every entry models "a list of sibling blocks", so moving a child between the gaps of
 * one container never breaks the DITA 1.3 content model.
 */
export const BLOCK_CONTAINER_TAGS: ReadonlySet<string> = new Set([
  'body',
  'conbody',
  'taskbody',
  'refbody',
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
    return {
      blockPos: $pos.before(depth),
      blockNode: node,
      blockTag: tag,
      containerPos: $pos.before(depth - 1),
      containerDepth: depth - 1,
      containerNode: parent,
      containerTag: parentTag,
    };
  }
  return null;
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
