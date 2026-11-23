import { Fragment } from 'prosemirror-model';
import { TextSelection, type Command } from 'prosemirror-state';
import { ditaSchema, MODELED_INLINE_TAGS, type RawAttrs } from '@dita/core';
import {
  findSharedInlineTextblock,
  flattenSameTypeInline,
  isCodeTextblock,
  sliceInlineContent,
} from '../inline-selection';
import { createDitaElementSkeleton } from './element-skeleton.js';
import { EMPTY_ATTRS, makeNode, textNode } from './node-helpers.js';
/**
 * Toggle (wrap or unwrap) a DITA inline element node (`<b>`, `<i>`, `<codeph>`, `<xref>`, etc.).
 * Strictly uses ProseMirror inline nodes (NOT Marks) to preserve exact nesting order and per-element `rawAttrs`.
 */
export function toggleInlineDitaElement(
  tagName: string,
  initialAttrs: RawAttrs = EMPTY_ATTRS,
  defaultText?: string,
): Command {
  return (state, dispatch) => {
    if (tagName === 'image') {
      return insertInlineImage(initialAttrs)(state, dispatch);
    }

    const nodeTypeName = MODELED_INLINE_TAGS.get(tagName);
    if (!nodeTypeName) return false;
    const nodeType = ditaSchema.nodes[nodeTypeName];
    if (!nodeType) return false;

    const { selection } = state;
    const { $from, $to } = selection;

    // 1. Check if selection is already inside this exact inline element -> unwrap it
    for (let d = $from.depth; d >= 1; d--) {
      const ancestor = $from.node(d);
      if (ancestor.type === nodeType && d <= $to.depth && $to.node(d) === ancestor) {
        if (!dispatch) return true;
        const start = $from.before(d);
        const end = $from.after(d);
        const tr = state.tr.replaceWith(start, end, ancestor.content);
        // Keep the unwrapped content highlighted so the quick bubble reflects the new state
        const contentSize = ancestor.content.size;
        tr.setSelection(
          contentSize > 0
            ? TextSelection.create(tr.doc, start, start + contentSize)
            : TextSelection.create(tr.doc, Math.min(start, tr.doc.content.size)),
        );
        dispatch(tr.scrollIntoView());
        return true;
      }
    }

    if (!$from.parent.inlineContent) return false;

    // 2. Non-empty selection inside ONE textblock -> wrap the selected fragment cleanly.
    //    Uses a lossless inline slice (never flattens to plain text) and drops nested
    //    wrappers of the same tag so `<b>` can never contain another `<b>`.
    if (selection.from < selection.to) {
      const textblock = findSharedInlineTextblock(state, selection.from, selection.to);
      if (!textblock || isCodeTextblock(textblock.node)) return false;

      const sliced = sliceInlineContent(
        textblock.node,
        selection.from - textblock.startPos,
        selection.to - textblock.startPos,
      );
      if (sliced.length === 0) return false;

      const flattened = flattenSameTypeInline(sliced, nodeType);
      if (flattened.length === 0) return false;

      const selectedFragment = Fragment.fromArray(flattened);
      const wrapped = createDitaElementSkeleton(tagName, initialAttrs, selectedFragment);
      if (!wrapped) return false;
      if (!dispatch) return true;

      const tr = state.tr.replaceWith(selection.from, selection.to, wrapped);
      // Select the content inside the newly wrapped inline node
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          selection.from + 1,
          selection.from + 1 + wrapped.content.size,
        ),
      );
      dispatch(tr.scrollIntoView());
      return true;
    }

    // 3. Collapsed cursor -> insert inline element (with optional default text or empty for keyref)
    const content =
      defaultText && defaultText.length > 0 ? Fragment.from(textNode(defaultText)) : Fragment.empty;
    const inlineNode = createDitaElementSkeleton(tagName, initialAttrs, content);
    if (!inlineNode) return false;

    if (!dispatch) return true;
    const insertPos = selection.from;
    const tr = state.tr.insert(insertPos, inlineNode);

    // If it's a keyref-only empty <keyword keyref="..."/>, place cursor after it; otherwise inside it
    const isEmptyKeyref =
      inlineNode.content.size === 0 && initialAttrs.some((a) => a.name === 'keyref');
    if (isEmptyKeyref) {
      tr.setSelection(TextSelection.create(tr.doc, insertPos + inlineNode.nodeSize));
    } else {
      tr.setSelection(
        TextSelection.create(
          tr.doc,
          insertPos + 1,
          insertPos + 1 + inlineNode.content.size,
        ),
      );
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export function insertInlineImage(initialAttrs: RawAttrs = EMPTY_ATTRS): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    if (!$from.parent.inlineContent) return false;
    const attrs =
      initialAttrs.length > 0
        ? initialAttrs
        : [
            { name: 'href', value: '../images/icon.svg', namespaceURI: null },
            { name: 'placement', value: 'inline', namespaceURI: null },
            { name: 'alt', value: 'Inline image', namespaceURI: null },
          ];
    const node = makeNode('dita_image_inline', attrs);
    if (!dispatch) return true;
    const pos = state.selection.from;
    const tr = state.tr.insert(pos, node);
    tr.setSelection(TextSelection.create(tr.doc, pos + node.nodeSize));
    dispatch(tr.scrollIntoView());
    return true;
  };
}
