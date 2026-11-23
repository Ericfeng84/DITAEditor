import type { EditorView } from 'prosemirror-view';
import {
  getAllowedChildElements,
  getInsertableTagsBySequence,
  getPmChildTags,
  getPmNodeTagName,
  type TaskContentModel,
} from '@dita/core';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import type { InsertContextGroup } from './selection-info';

/** Table internals and metadata are never offered by the block insert menus. */
export const NON_INSERTABLE_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'sthead',
  'strow',
  'stentry',
  'tgroup',
  'colspec',
  'thead',
  'tbody',
  'row',
  'entry',
]);

/** Read the current element children of the ancestor container that owns a gap position. */
export function readGapContainerChildTags(
  view: EditorView | null,
  insertPos: number,
  containerTag: string,
): string[] {
  if (!view) return [];
  const clamped = Math.max(0, Math.min(insertPos, view.state.doc.content.size));
  const $pos = view.state.doc.resolve(clamped);
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (getPmNodeTagName(node) === containerTag) return getPmChildTags(node);
  }
  return [];
}

export function buildBlockInsertGroups(
  containerTag: string,
  containerDepth: number,
  childTags: readonly string[],
  taskModel: TaskContentModel = 'strict',
): InsertContextGroup[] {
  // DITA 1.3 cardinality / choice: never offer a filled single-occurrence slot or the losing side of
  // an exclusive alternative (steps | steps-unordered) in the gap inserter menu.
  const allowedSpecs = getAllowedChildElements(containerTag, 'block', taskModel);
  const insertable = new Set(
    getInsertableTagsBySequence(
      containerTag,
      childTags,
      allowedSpecs.map((spec) => spec.tag),
      taskModel,
    ),
  );
  return [
    {
      containerTag,
      containerDepth,
      containerLabel: translate(getCurrentLocale(), 'visual.insertHere', { tag: containerTag }),
      insertKind: 'block',
      items: allowedSpecs.filter(
        (spec) => insertable.has(spec.tag) && !NON_INSERTABLE_BLOCK_TAGS.has(spec.tag),
      ),
    },
  ];
}
