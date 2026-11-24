import { TextSelection, type Command } from 'prosemirror-state';
import {
  MODELED_INLINE_TAGS,
  ditaSchema,
  getAllowedChildElements,
  getPmNodeTagName,
  type RawAttrs,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../../structure-options';
import { insertBlockDitaElementAtPos } from './block-commands.js';
import { createDitaElementSkeleton } from './element-skeleton.js';
import { EMPTY_ATTRS } from './node-helpers.js';

/**
 * Insert a reuse element (conref / conkeyref) at an exact drop position.
 *
 * Inline targets (`<ph>`, `<keyword>`, `<xref>`, …) go straight into the textblock under the
 * drop point. Block targets (`<note>`, `<li>`, `<step>`, …) are re-anchored to the nearest
 * enclosing container that legally accepts them, so dropping onto a paragraph inserts after
 * that paragraph instead of producing invalid nesting. Ordered content models are still
 * resolved by `insertBlockDitaElementAtPos`.
 */
export function insertReuseElementAtPos(
  tagName: string,
  insertPos: number,
  initialAttrs: RawAttrs = EMPTY_ATTRS,
): Command {
  return (state, dispatch) => {
    if (insertPos < 0 || insertPos > state.doc.content.size) return false;

    const inlineTypeName = MODELED_INLINE_TAGS.get(tagName);
    if (inlineTypeName) {
      const $pos = state.doc.resolve(insertPos);
      if ($pos.parent.inlineContent) {
        const nodeType = ditaSchema.nodes[inlineTypeName];
        const inlineNode = createDitaElementSkeleton(tagName, initialAttrs);
        if (!nodeType || !nodeType.isInline || !inlineNode) return false;
        if (!dispatch) return true;
        const tr = state.tr.insert(insertPos, inlineNode);
        tr.setSelection(
          inlineNode.content.size > 0
            ? TextSelection.create(tr.doc, insertPos + 1, insertPos + 1 + inlineNode.content.size)
            : TextSelection.create(tr.doc, insertPos + inlineNode.nodeSize),
        );
        dispatch(tr.scrollIntoView());
        return true;
      }
      // Dropped on a block gap: fall into the textblock that follows when there is one.
      const next = $pos.nodeAfter;
      if (next?.isTextblock) {
        return insertReuseElementAtPos(tagName, insertPos + 1, initialAttrs)(state, dispatch);
      }
      return false;
    }

    const taskModel = resolveTaskModelForDocument(state.doc);
    const $pos = state.doc.resolve(insertPos);
    for (let depth = $pos.depth; depth >= 1; depth -= 1) {
      const container = $pos.node(depth);
      if (container.isInline || container.isTextblock) continue;
      const containerTag = getPmNodeTagName(container);
      if (!containerTag) continue;
      const allowed = getAllowedChildElements(containerTag, 'block', taskModel);
      if (!allowed.some((spec) => spec.tag === tagName)) continue;
      // Drop directly between children keeps its position; a drop inside a child moves the
      // insertion to the gap right AFTER that child (never inside a textblock).
      const anchorPos = depth === $pos.depth ? insertPos : $pos.after(depth + 1);
      return insertBlockDitaElementAtPos(tagName, anchorPos, initialAttrs)(state, dispatch);
    }
    return false;
  };
}
