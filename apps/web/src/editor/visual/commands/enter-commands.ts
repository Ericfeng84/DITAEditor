import { Selection, TextSelection, type Command } from 'prosemirror-state';
import {
  ditaSchema,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  removeRawAttr,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../../structure-options';
import { insertMissingTopicBody } from './block-commands.js';
import { createDitaElementSkeleton } from './element-skeleton.js';
import { EMPTY_ATTRS, makeNode, selectFirstEditablePos } from './node-helpers.js';
/**
 * DITA-aware Enter handler:
 * - Inside `<codeblock>` / `<pre>` / `unknown_pre_block`: inserts literal newline `\n`
 * - Inside `<title>`: never creates a second `<title>`; creates/moves to next body paragraph or `<shortdesc>`
 * - Inside `<shortdesc>`: moves to or creates first block inside body
 * - Inside `<cmd>` (within `<step>` or `<substep>`): creates a new sibling `<step><cmd/></step>`
 * - Inside `<dt>`: focuses or inserts `<dd>` inside `<dlentry>`
 * - Inside `<li>` / `<choice>`: creates new sibling `<li>` / `<choice>`, or exits list if empty
 * - Inside `<p>`: splits cleanly into two `<p>` nodes (stripping `id` from the second so XML IDs stay unique!)
 */
export const handleDitaEnter: Command = (state, dispatch) => {
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return false;

  const { $from } = selection;
  const parent = $from.parent;
  const parentTag = getPmNodeTagName(parent);

  // 1. Codeblock / Pre / unknown_pre_block -> literal newline
  if (
    parent.type.name === 'dita_codeblock' ||
    parent.type.name === 'dita_pre' ||
    parent.type.name === 'unknown_pre_block'
  ) {
    if (!dispatch) return true;
    dispatch(state.tr.insertText('\n').scrollIntoView());
    return true;
  }

  // 2. <title> -> jump into next sibling or insert <p> after <title>
  if (parent.type.name === 'dita_title' && $from.depth >= 2) {
    const owner = $from.node($from.depth - 1);
    const ownerTag = getPmNodeTagName(owner);
    const afterTitlePos = $from.after($from.depth);

    if (!dispatch) return true;
    const tr = state.tr;

    // Inside section/example/refsyn/fig -> insert <p> right after <title>
    if (ownerTag === 'section' || ownerTag === 'example' || ownerTag === 'refsyn') {
      const pNode = makeNode('dita_p');
      tr.insert(afterTitlePos, pNode);
      tr.setSelection(TextSelection.create(tr.doc, afterTitlePos + 1));
      dispatch(tr.scrollIntoView());
      return true;
    }

    // Topic root title -> move cursor to next sibling (shortdesc or body)
    if (afterTitlePos < $from.end($from.depth - 1)) {
      tr.setSelection(Selection.near(tr.doc.resolve(afterTitlePos), 1));
      dispatch(tr.scrollIntoView());
      return true;
    }

    // Topic root without any following sibling: create the missing body wrapper instead of
    // falling through to `splitBlock`, which would duplicate the single-occurrence <title>.
    if (
      insertMissingTopicBody(
        tr,
        owner,
        $from.start($from.depth - 1),
        ownerTag ?? '',
        afterTitlePos,
        resolveTaskModelForDocument(state.doc),
      )
    ) {
      dispatch(tr.scrollIntoView());
      return true;
    }
    return false;
  }

  // 3. <shortdesc> -> move cursor to body's first editable position
  if (parent.type.name === 'dita_shortdesc' && $from.depth >= 2) {
    const afterPos = $from.after($from.depth);
    if (afterPos < $from.end($from.depth - 1)) {
      if (!dispatch) return true;
      const tr = state.tr;
      tr.setSelection(Selection.near(tr.doc.resolve(afterPos), 1));
      dispatch(tr.scrollIntoView());
      return true;
    }

    const owner = $from.node($from.depth - 1);
    const ownerTag = getPmNodeTagName(owner) ?? '';
    if (!dispatch) return true;
    const tr = state.tr;
    // Same as <title>: a topic root with <shortdesc> but no body must materialize the body
    // wrapper, otherwise `splitBlock` would create a second illegal <shortdesc>.
    if (
      insertMissingTopicBody(
        tr,
        owner,
        $from.start($from.depth - 1),
        ownerTag,
        afterPos,
        resolveTaskModelForDocument(state.doc),
      )
    ) {
      dispatch(tr.scrollIntoView());
      return true;
    }
    return false;
  }

  // 4. <cmd> inside <step> or <substep> -> create sibling <step><cmd/></step> or <substep><cmd/></substep>
  if (parent.type.name === 'dita_cmd' && $from.depth >= 3) {
    const stepDepth = $from.depth - 1;
    const stepNode = $from.node(stepDepth);
    if (stepNode.type.name === 'dita_step' || stepNode.type.name === 'dita_substep') {
      if (!dispatch) return true;
      const tr = state.tr;
      // Carry trailing text after cursor into the new step's <cmd>
      const tailContent = parent.content.cut($from.parentOffset);
      if (tailContent.size > 0) {
        tr.delete(selection.from, $from.end($from.depth));
      }
      const mappedAfterStep = tr.mapping.map($from.after(stepDepth));
      const newStep = makeNode(stepNode.type.name, EMPTY_ATTRS, [
        makeNode('dita_cmd', EMPTY_ATTRS, []),
      ]);
      const newStepWithTail =
        tailContent.size > 0
          ? makeNode(stepNode.type.name, EMPTY_ATTRS, [
              ditaSchema.nodes.dita_cmd!.create(
                { rawAttrs: EMPTY_ATTRS, namespaceURI: null },
                tailContent,
              ),
            ])
          : newStep;
      tr.insert(mappedAfterStep, newStepWithTail);
      // Place cursor at start of new <cmd>
      tr.setSelection(TextSelection.create(tr.doc, mappedAfterStep + 2));
      dispatch(tr.scrollIntoView());
      return true;
    }
  }

  // 5. <dt> inside <dlentry> -> focus sibling <dd> or create one
  if (parent.type.name === 'dita_dt' && $from.depth >= 2) {
    const afterDt = $from.after($from.depth);
    if (!dispatch) return true;
    const tr = state.tr;
    if (afterDt < $from.end($from.depth - 1)) {
      tr.setSelection(Selection.near(tr.doc.resolve(afterDt), 1));
    } else {
      const dd = makeNode('dita_dd', EMPTY_ATTRS, [makeNode('xml_text_block')]);
      tr.insert(afterDt, dd);
      tr.setSelection(TextSelection.create(tr.doc, afterDt + 2));
    }
    dispatch(tr.scrollIntoView());
    return true;
  }

  // 6. Inside <li> or <choice> (via xml_text_block or <p>): split into new item or exit empty list item
  for (let d = $from.depth - 1; d >= 2; d--) {
    const ancestor = $from.node(d);
    if (ancestor.type.name === 'dita_li' || ancestor.type.name === 'dita_choice') {
      const listDepth = d - 1;
      const listNode = $from.node(listDepth);
      const isEmptyItem = ancestor.textContent.trim().length === 0 && ancestor.childCount <= 1;

      if (isEmptyItem && listNode.childCount > 1 && listDepth >= 2) {
        // Exit list: delete empty item and insert a <p> right after the list
        if (!dispatch) return true;
        const tr = state.tr;
        const itemStart = $from.before(d);
        const itemEnd = $from.after(d);
        tr.delete(itemStart, itemEnd);
        const afterList = tr.mapping.map($from.after(listDepth));
        const pNode = makeNode('dita_p');
        tr.insert(afterList, pNode);
        tr.setSelection(TextSelection.create(tr.doc, afterList + 1));
        dispatch(tr.scrollIntoView());
        return true;
      }

      if (parent.type.name === 'xml_text_block' && d === $from.depth - 1) {
        if (!dispatch) return true;
        const tr = state.tr;
        const tail = parent.content.cut($from.parentOffset);
        if (tail.size > 0) {
          tr.delete(selection.from, $from.end($from.depth));
        }
        const afterItem = tr.mapping.map($from.after(d));
        const nextItem = makeNode(ancestor.type.name, EMPTY_ATTRS, [
          ditaSchema.nodes.xml_text_block!.create(null, tail),
        ]);
        tr.insert(afterItem, nextItem);
        tr.setSelection(TextSelection.create(tr.doc, afterItem + 2));
        dispatch(tr.scrollIntoView());
        return true;
      }
      break;
    }
  }

  // 7. Standard <p> split -> strip `id` from second <p> so IDs are never duplicated
  if (parent.type.name === 'dita_p') {
    if (!dispatch) return true;
    const tr = state.tr;
    if (selection.from !== selection.to) {
      tr.deleteSelection();
    }
    const $mappedFrom = tr.doc.resolve(tr.mapping.map(selection.from));
    const currentP = $mappedFrom.parent;
    const rawAttrs = getPmNodeRawAttrs(currentP);
    const cleanedAttrs = removeRawAttr(rawAttrs, 'id');
    tr.split($mappedFrom.pos, 1, [
      {
        type: ditaSchema.nodes.dita_p!,
        attrs: { rawAttrs: cleanedAttrs, namespaceURI: currentP.attrs.namespaceURI ?? null },
      },
    ]);
    dispatch(tr.scrollIntoView());
    return true;
  }

  // 8. Generic textblock inside xml_text_block (e.g. inside <dd>, <entry>, <stentry>) -> insert <p> or split
  if (parent.type.name === 'xml_text_block' && $from.depth >= 2) {
    if (!dispatch) return true;
    const tr = state.tr;
    if (selection.from !== selection.to) {
      tr.deleteSelection();
    }
    const $mapped = tr.doc.resolve(tr.mapping.map(selection.from));
    const container = $mapped.node($mapped.depth - 1);
    const containerTag = getPmNodeTagName(container);

    // Inside <dd>, pressing Enter on empty trailing block creates a new <dlentry>
    if (
      containerTag === 'dd' &&
      parent.content.size === 0 &&
      $mapped.depth >= 3 &&
      $mapped.node($mapped.depth - 2).type.name === 'dita_dlentry'
    ) {
      const dlentryDepth = $mapped.depth - 2;
      const afterEntry = $mapped.after(dlentryDepth);
      const newEntry = createDitaElementSkeleton('dlentry')!;
      tr.insert(afterEntry, newEntry);
      selectFirstEditablePos(tr, afterEntry, newEntry);
      dispatch(tr.scrollIntoView());
      return true;
    }

    // Otherwise split xml_text_block into two <p> paragraphs inside the mixed container
    const leftContent = $mapped.parent.content.cut(0, $mapped.parentOffset);
    const rightContent = $mapped.parent.content.cut($mapped.parentOffset);
    const p1 = ditaSchema.nodes.dita_p!.create({ rawAttrs: EMPTY_ATTRS, namespaceURI: null }, leftContent);
    const p2 = ditaSchema.nodes.dita_p!.create({ rawAttrs: EMPTY_ATTRS, namespaceURI: null }, rightContent);
    const start = $mapped.before($mapped.depth);
    const end = $mapped.after($mapped.depth);
    tr.replaceWith(start, end, [p1, p2]);
    tr.setSelection(TextSelection.create(tr.doc, start + p1.nodeSize + 1));
    dispatch(tr.scrollIntoView());
    return true;
  }

  // 9. Inside inline node (e.g. <b>, <codeph>) -> exit inline node if at end, or split enclosing <p>
  if (parent.isInline && $from.depth >= 2) {
    if (!dispatch) return true;
    const afterInline = $from.after($from.depth);
    const tr = state.tr.setSelection(TextSelection.create(state.doc, afterInline));
    dispatch(tr.scrollIntoView());
    return true;
  }

  void parentTag;
  return false;
};

/**
 * Exit `<codeblock>` / `<pre>` with Mod+Enter or Shift+Enter into a new `<p>` below.
 */
export const exitCodeblockToParagraph: Command = (state, dispatch) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d >= 2; d--) {
    const node = $from.node(d);
    if (
      node.type.name === 'dita_codeblock' ||
      node.type.name === 'dita_pre' ||
      node.type.name === 'unknown_pre_block'
    ) {
      const parentTag = getPmNodeTagName($from.node(d - 1));
      if (!parentTag) return false;
      if (!dispatch) return true;
      const afterPos = $from.after(d);
      const pNode = makeNode('dita_p');
      const tr = state.tr.insert(afterPos, pNode);
      tr.setSelection(TextSelection.create(tr.doc, afterPos + 1));
      dispatch(tr.scrollIntoView());
      return true;
    }
  }
  return false;
};
