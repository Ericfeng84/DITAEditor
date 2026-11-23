import type { Node as PMNode } from 'prosemirror-model';
import { Selection, TextSelection, type Transaction } from 'prosemirror-state';
import { ditaSchema, type RawAttrs } from '@dita/core';

export const EMPTY_ATTRS: RawAttrs = [];
export function makeNode(
  typeName: string,
  rawAttrs: RawAttrs = EMPTY_ATTRS,
  children: PMNode[] = [],
  extraAttrs: Record<string, unknown> = {},
): PMNode {
  const type = ditaSchema.nodes[typeName];
  if (!type) {
    throw new Error(`Unknown ProseMirror node type: ${typeName}`);
  }
  if (typeName === 'xml_text_block') {
    return type.create(null, children);
  }
  return type.create({ rawAttrs, namespaceURI: null, ...extraAttrs }, children);
}

export function textNode(text: string): PMNode {
  return ditaSchema.text(text);
}

/**
 * Build a clean, valid DITA 1.3 ProseMirror skeleton node for any supported block or inline tag.
 */

export function selectFirstEditablePos(tr: Transaction, insertPos: number, insertedNode: PMNode): void {
  let targetPos: number | null = null;
  insertedNode.descendants((node, relPos) => {
    if (targetPos !== null) return false;
    if (node.isTextblock) {
      // Position at end of any default placeholder text so user can immediately edit or type
      targetPos = insertPos + 1 + relPos + 1 + node.content.size;
      return false;
    }
    return true;
  });

  if (targetPos !== null) {
    tr.setSelection(TextSelection.create(tr.doc, targetPos));
  } else {
    tr.setSelection(Selection.near(tr.doc.resolve(Math.min(insertPos + 1, tr.doc.content.size))));
  }
}

/**
 * Toggle (wrap or unwrap) a DITA inline element node (`<b>`, `<i>`, `<codeph>`, `<xref>`, etc.).
 * Strictly uses ProseMirror inline nodes (NOT Marks) to preserve exact nesting order and per-element `rawAttrs`.
 */
