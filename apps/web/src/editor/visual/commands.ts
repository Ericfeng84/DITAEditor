import { Fragment, type Node as PMNode } from 'prosemirror-model';
import {
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import {
  ditaSchema,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  MODELED_INLINE_TAGS,
  removeRawAttr,
  setRawAttr,
  type RawAttrs,
} from '@dita/core';
import { findLegalAncestorDepthForBlock } from './selection-info';

const EMPTY_ATTRS: RawAttrs = [];

function makeNode(
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

function textNode(text: string): PMNode {
  return ditaSchema.text(text);
}

/**
 * Build a clean, valid DITA 1.3 ProseMirror skeleton node for any supported block or inline tag.
 */
export function createDitaElementSkeleton(
  tagName: string,
  initialAttrs: RawAttrs = EMPTY_ATTRS,
  inlineContent?: Fragment,
): PMNode | null {
  // Inline modeled tags
  const inlineType = MODELED_INLINE_TAGS.get(tagName);
  if (inlineType) {
    if (tagName === 'menucascade' && (!inlineContent || inlineContent.childCount === 0)) {
      return makeNode(inlineType, initialAttrs, [
        makeNode('dita_uicontrol', EMPTY_ATTRS, [textNode('菜单')]),
        makeNode('dita_uicontrol', EMPTY_ATTRS, [textNode('选项')]),
      ]);
    }
    const type = ditaSchema.nodes[inlineType]!;
    return type.create({ rawAttrs: initialAttrs, namespaceURI: null }, inlineContent);
  }

  switch (tagName) {
    case 'p':
      return makeNode('dita_p', initialAttrs);
    case 'title':
      return makeNode('dita_title', initialAttrs);
    case 'shortdesc':
      return makeNode('dita_shortdesc', initialAttrs);
    case 'cmd':
      return makeNode('dita_cmd', initialAttrs);
    case 'dt':
      return makeNode('dita_dt', initialAttrs);
    case 'desc':
      return makeNode('dita_desc', initialAttrs);
    case 'dd':
      return makeNode('dita_dd', initialAttrs, [makeNode('xml_text_block')]);
    case 'codeblock': {
      const attrs =
        initialAttrs.length > 0
          ? initialAttrs
          : [{ name: 'outputclass', value: 'language-xml', namespaceURI: null }];
      return makeNode('dita_codeblock', attrs);
    }
    case 'pre':
      return makeNode('dita_pre', initialAttrs);
    case 'section':
      return makeNode('dita_section', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode('新章节标题')]),
        makeNode('dita_p'),
      ]);
    case 'example':
      return makeNode('dita_example', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode('示例')]),
        makeNode('dita_p'),
      ]);
    case 'refsyn':
      return makeNode('dita_refsyn', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode('语法')]),
        makeNode('dita_codeblock'),
      ]);
    case 'note': {
      const attrs =
        initialAttrs.length > 0
          ? initialAttrs
          : [{ name: 'type', value: 'note', namespaceURI: null }];
      return makeNode('dita_note', attrs, [makeNode('dita_p')]);
    }
    case 'ul':
      return makeNode('dita_ul', initialAttrs, [
        makeNode('dita_li', EMPTY_ATTRS, [makeNode('xml_text_block')]),
      ]);
    case 'ol':
      return makeNode('dita_ol', initialAttrs, [
        makeNode('dita_li', EMPTY_ATTRS, [makeNode('xml_text_block')]),
      ]);
    case 'li':
      return makeNode('dita_li', initialAttrs, [makeNode('xml_text_block')]);
    case 'dl':
      return makeNode('dita_dl', initialAttrs, [
        makeNode('dita_dlentry', EMPTY_ATTRS, [
          makeNode('dita_dt', EMPTY_ATTRS, [textNode('术语')]),
          makeNode('dita_dd', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('定义说明')])]),
        ]),
      ]);
    case 'dlentry':
      return makeNode('dita_dlentry', initialAttrs, [
        makeNode('dita_dt'),
        makeNode('dita_dd', EMPTY_ATTRS, [makeNode('xml_text_block')]),
      ]);
    case 'fig':
      return makeNode('dita_fig', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode('插图标题')]),
        makeNode('dita_image_block', [
          { name: 'href', value: '../images/example.svg', namespaceURI: null },
          { name: 'placement', value: 'break', namespaceURI: null },
          { name: 'alt', value: '示意图', namespaceURI: null },
        ]),
      ]);
    case 'image': {
      const hasPlacement = initialAttrs.some((a) => a.name === 'placement');
      const attrs = hasPlacement
        ? initialAttrs
        : [
            ...initialAttrs,
            ...(initialAttrs.some((a) => a.name === 'href')
              ? []
              : [{ name: 'href', value: '../images/diagram.svg', namespaceURI: null }]),
            { name: 'placement', value: 'break', namespaceURI: null },
          ];
      return makeNode('dita_image_block', attrs);
    }
    case 'prereq':
      return makeNode('dita_prereq', initialAttrs, [makeNode('dita_p')]);
    case 'context':
      return makeNode('dita_context', initialAttrs, [makeNode('dita_p')]);
    case 'steps':
      return makeNode('dita_steps', initialAttrs, [
        makeNode('dita_step', EMPTY_ATTRS, [makeNode('dita_cmd')]),
      ]);
    case 'steps-unordered':
      return makeNode('dita_steps_unordered', initialAttrs, [
        makeNode('dita_step', EMPTY_ATTRS, [makeNode('dita_cmd')]),
      ]);
    case 'step':
      return makeNode('dita_step', initialAttrs, [makeNode('dita_cmd')]);
    case 'substeps':
      return makeNode('dita_substeps', initialAttrs, [
        makeNode('dita_substep', EMPTY_ATTRS, [makeNode('dita_cmd')]),
      ]);
    case 'substep':
      return makeNode('dita_substep', initialAttrs, [makeNode('dita_cmd')]);
    case 'choices':
      return makeNode('dita_choices', initialAttrs, [
        makeNode('dita_choice', EMPTY_ATTRS, [makeNode('xml_text_block')]),
      ]);
    case 'choice':
      return makeNode('dita_choice', initialAttrs, [makeNode('xml_text_block')]);
    case 'info':
      return makeNode('dita_info', initialAttrs, [makeNode('dita_p')]);
    case 'stepxmp':
      return makeNode('dita_stepxmp', initialAttrs, [makeNode('dita_p')]);
    case 'stepresult':
      return makeNode('dita_stepresult', initialAttrs, [makeNode('dita_p')]);
    case 'result':
      return makeNode('dita_result', initialAttrs, [makeNode('dita_p')]);
    case 'postreq':
      return makeNode('dita_postreq', initialAttrs, [makeNode('dita_p')]);
    case 'related-links':
      return makeNode('dita_related_links', initialAttrs, [
        makeNode('dita_link', [
          { name: 'href', value: '../concepts/overview.dita', namespaceURI: null },
          { name: 'format', value: 'dita', namespaceURI: null },
        ]),
      ]);
    case 'link': {
      const attrs =
        initialAttrs.length > 0
          ? initialAttrs
          : [
              { name: 'href', value: '../concepts/overview.dita', namespaceURI: null },
              { name: 'format', value: 'dita', namespaceURI: null },
            ];
      return makeNode('dita_link', attrs);
    }
    case 'prolog':
      return makeNode('dita_prolog', initialAttrs, [
        makeNode(
          'unknown_block',
          [{ name: 'type', value: 'creator', namespaceURI: null }],
          [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('Author')])],
          { tagName: 'author', preserveWhitespace: false },
        ),
      ]);
    case 'simpletable':
      return makeNode(
        'dita_simpletable',
        initialAttrs.length > 0
          ? initialAttrs
          : [{ name: 'relcolwidth', value: '1* 1* 2*', namespaceURI: null }],
        [
          makeNode('dita_sthead', EMPTY_ATTRS, [
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('字段')])]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('类型')])]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('说明')])]),
          ]),
          makeNode('dita_strow', EMPTY_ATTRS, [
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block')]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block')]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block')]),
          ]),
        ],
      );
    case 'table':
      return makeNode(
        'cals_table',
        initialAttrs.length > 0
          ? initialAttrs
          : [
              { name: 'frame', value: 'all', namespaceURI: null },
              { name: 'colsep', value: '1', namespaceURI: null },
              { name: 'rowsep', value: '1', namespaceURI: null },
            ],
        [
          makeNode('dita_title', EMPTY_ATTRS, [textNode('CALS 表格标题')]),
          makeNode(
            'cals_tgroup',
            [{ name: 'cols', value: '3', namespaceURI: null }],
            [
              makeNode(
                'cals_colspec',
                [
                  { name: 'colnum', value: '1', namespaceURI: null },
                  { name: 'colname', value: 'c1', namespaceURI: null },
                  { name: 'colwidth', value: '1*', namespaceURI: null },
                ],
                [],
                { colnum: 1, colname: 'c1', colwidth: '1*' },
              ),
              makeNode(
                'cals_colspec',
                [
                  { name: 'colnum', value: '2', namespaceURI: null },
                  { name: 'colname', value: 'c2', namespaceURI: null },
                  { name: 'colwidth', value: '1*', namespaceURI: null },
                ],
                [],
                { colnum: 2, colname: 'c2', colwidth: '1*' },
              ),
              makeNode(
                'cals_colspec',
                [
                  { name: 'colnum', value: '3', namespaceURI: null },
                  { name: 'colname', value: 'c3', namespaceURI: null },
                  { name: 'colwidth', value: '2*', namespaceURI: null },
                ],
                [],
                { colnum: 3, colname: 'c3', colwidth: '2*' },
              ),
              makeNode('cals_thead', EMPTY_ATTRS, [
                makeNode('cals_row', EMPTY_ATTRS, [
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('列 1')])], { colspan: 1, rowspan: 1 }),
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('列 2')])], { colspan: 1, rowspan: 1 }),
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode('列 3')])], { colspan: 1, rowspan: 1 }),
                ]),
              ]),
              makeNode('cals_tbody', EMPTY_ATTRS, [
                makeNode('cals_row', EMPTY_ATTRS, [
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block')], { colspan: 1, rowspan: 1 }),
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block')], { colspan: 1, rowspan: 1 }),
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block')], { colspan: 1, rowspan: 1 }),
                ]),
              ]),
            ],
            { cols: 3 },
          ),
        ],
      );
    default:
      return null;
  }
}

/**
 * Place cursor inside the first editable textblock of an inserted subtree.
 */
function selectFirstEditablePos(tr: Transaction, insertPos: number, insertedNode: PMNode): void {
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
        const nextPos = Math.min(start + ancestor.content.size, tr.doc.content.size);
        tr.setSelection(TextSelection.create(tr.doc, nextPos));
        dispatch(tr.scrollIntoView());
        return true;
      }
    }

    if (!$from.parent.inlineContent) return false;

    // 2. Non-empty selection within the same inline parent -> wrap selected fragment cleanly
    if (selection.from < selection.to) {
      if ($from.sameParent($to)) {
        const selectedFragment = $from.parent.content.cut(
          $from.parentOffset,
          $to.parentOffset,
        );
        const wrapped = createDitaElementSkeleton(tagName, initialAttrs, selectedFragment);
        if (!wrapped) return false;
        if (!dispatch) return true;
        const tr = state.tr.replaceWith(selection.from, selection.to, wrapped);
        // Select the text inside the newly wrapped inline node
        tr.setSelection(
          TextSelection.create(
            tr.doc,
            selection.from + 1,
            selection.from + 1 + selectedFragment.size,
          ),
        );
        dispatch(tr.scrollIntoView());
        return true;
      }

      // Cross-inline-boundary inside the same textblock: extract plain inline text safely
      const text = state.doc.textBetween(selection.from, selection.to, '');
      if (text.length > 0) {
        const wrapped = createDitaElementSkeleton(
          tagName,
          initialAttrs,
          Fragment.from(textNode(text)),
        );
        if (!wrapped) return false;
        if (!dispatch) return true;
        const tr = state.tr.replaceWith(selection.from, selection.to, wrapped);
        tr.setSelection(
          TextSelection.create(tr.doc, selection.from + 1, selection.from + 1 + text.length),
        );
        dispatch(tr.scrollIntoView());
        return true;
      }
      return false;
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

    // Determine exact insertion position inside the target container
    let insertPos: number;

    if (tagName === 'title') {
      // `<title>` always belongs at the very start of its container (section/fig/table/topic)
      insertPos = containerStart;
    } else if (tagName === 'shortdesc') {
      // `<shortdesc>` goes right after `<title>` if present
      const firstChild = containerNode.firstChild;
      insertPos =
        firstChild && firstChild.type.name === 'dita_title'
          ? containerStart + firstChild.nodeSize
          : containerStart;
    } else if (tagName === 'prereq') {
      insertPos = containerStart;
    } else if (tagName === 'postreq' || tagName === 'related-links') {
      insertPos = $from.end(containerDepth);
    } else if ($from.depth > containerDepth) {
      // Insert directly after the current child of `containerDepth`
      insertPos = $from.after(containerDepth + 1);
    } else {
      insertPos = $from.end(containerDepth);
    }

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
    if (!dispatch) return true;

    const tr = state.tr.insert(insertPos, newNode);
    selectFirstEditablePos(tr, insertPos, newNode);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

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

/**
 * Guard Backspace so structural anchors (`<title>` of topic root, root element, body) are never accidentally destroyed.
 */
export const handleDitaBackspace: Command = (state, dispatch) => {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.parentOffset !== 0) return false;

  const parent = $from.parent;

  // Never delete or merge topic-level <title> or <shortdesc> backward into nothing
  if (
    (parent.type.name === 'dita_title' || parent.type.name === 'dita_shortdesc') &&
    $from.depth === 2
  ) {
    return true; // consume safely
  }

  // Inside an empty inline node (e.g. empty <b></b> or <codeph></codeph>) -> unwrap cleanly
  if (parent.isInline && parent.content.size === 0 && $from.depth >= 2) {
    if (!dispatch) return true;
    const start = $from.before($from.depth);
    const end = $from.after($from.depth);
    const tr = state.tr.delete(start, end);
    tr.setSelection(TextSelection.create(tr.doc, start));
    dispatch(tr.scrollIntoView());
    return true;
  }

  // Empty <p> inside a container with siblings -> remove cleanly and move cursor to previous sibling
  if (parent.type.name === 'dita_p' && parent.content.size === 0 && $from.depth >= 2) {
    const container = $from.node($from.depth - 1);
    if (container.childCount > 1) {
      if (!dispatch) return true;
      const start = $from.before($from.depth);
      const end = $from.after($from.depth);
      const tr = state.tr.delete(start, end);
      tr.setSelection(Selection.near(tr.doc.resolve(Math.max(1, start - 1)), -1));
      dispatch(tr.scrollIntoView());
      return true;
    }
  }

  return false;
};

/**
 * Update a single attribute on the ProseMirror node at `nodePos` in-place (preserving exact rawAttrs order).
 */
export function updateNodeRawAttr(
  nodePos: number,
  attrName: string,
  value: string | null,
): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    const currentRaw = getPmNodeRawAttrs(node);
    const nextRaw = setRawAttr(currentRaw, attrName, value);

    const nextAttrs: Record<string, unknown> = {
      ...node.attrs,
      rawAttrs: nextRaw,
    };

    // Keep synced typed attrs on CALS nodes if edited through Attributes Panel
    if (node.type.name === 'cals_tgroup' && attrName === 'cols' && value && /^\d+$/.test(value)) {
      nextAttrs.cols = Number(value);
    } else if (node.type.name === 'cals_colspec') {
      if (attrName === 'colnum' && value && /^\d+$/.test(value)) {
        nextAttrs.colnum = Number(value);
      } else if (attrName === 'colname') {
        nextAttrs.colname = value ?? '';
      } else if (attrName === 'colwidth') {
        nextAttrs.colwidth = value;
      }
    } else if (node.type.name === 'cals_entry' && attrName === 'morerows') {
      nextAttrs.rowspan = value && /^\d+$/.test(value) ? Number(value) + 1 : 1;
    }

    if (!dispatch) return true;
    const tr = state.tr.setNodeMarkup(nodePos, undefined, nextAttrs);
    dispatch(tr);
    return true;
  };
}

/**
 * Delete a specific DITA element at `nodePos` (protecting the topic root and required root title).
 */
export function deleteDitaNodeAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false; // Never delete root topic
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    const $pos = state.doc.resolve(nodePos);
    // Protect root topic's <title>
    if (node.type.name === 'dita_title' && $pos.depth === 1) return false;
    // Protect body containers directly under root
    if (
      ['dita_body', 'dita_conbody', 'dita_taskbody', 'dita_refbody'].includes(node.type.name) &&
      $pos.depth === 1
    ) {
      return false;
    }

    if (!dispatch) return true;
    const tr = state.tr.delete(nodePos, nodePos + node.nodeSize);
    const target = Math.min(Math.max(1, nodePos), tr.doc.content.size);
    tr.setSelection(Selection.near(tr.doc.resolve(target), -1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Move a DITA block node up or down among its siblings inside its parent container.
 */
export function moveDitaNodeSibling(nodePos: number, direction: 'up' | 'down'): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    const $pos = state.doc.resolve(nodePos);
    if ($pos.depth < 1) return false;

    const parent = $pos.parent;
    const index = $pos.index($pos.depth);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= parent.childCount) return false;

    const sibling = parent.child(swapIndex);
    // Do not move blocks above a container's `<title>` or `<colspec>`
    if (
      direction === 'up' &&
      (sibling.type.name === 'dita_title' || sibling.type.name === 'cals_colspec')
    ) {
      return false;
    }
    if (node.type.name === 'dita_title' || node.type.name === 'cals_colspec') {
      return false;
    }

    if (!dispatch) return true;

    const parentStart = $pos.start($pos.depth);
    let offset = parentStart;
    for (let i = 0; i < Math.min(index, swapIndex); i++) {
      offset += parent.child(i).nodeSize;
    }

    const first = direction === 'up' ? sibling : node;
    const second = direction === 'up' ? node : sibling;
    const rangeEnd = offset + first.nodeSize + second.nodeSize;

    const tr = state.tr.replaceWith(offset, rangeEnd, [second, first]);
    const newPos = direction === 'up' ? offset : offset + second.nodeSize;
    tr.setSelection(Selection.near(tr.doc.resolve(newPos + 1), 1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Select a specific node from the Breadcrumb bar (moving cursor inside it or NodeSelecting atoms).
 */
export function selectNodeAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    if (!dispatch) return true;
    const tr = state.tr;
    if (node.isAtom) {
      tr.setSelection(NodeSelection.create(state.doc, nodePos));
    } else {
      tr.setSelection(Selection.near(state.doc.resolve(nodePos + 1), 1));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Ensure an empty mixed-content block container (like `<entry/>`, `<stentry/>`, `<li/>`)
 * receives an editable `xml_text_block` on click or Tab navigation.
 * Note: empty `xml_text_block` serializes to ZERO XML tags, preserving 100% lossless round-trip!
 */
export function hydrateEmptyContainerAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.childCount > 0 || node.isAtom || node.isTextblock) return false;

    const hydratable = new Set([
      'cals_entry',
      'dita_stentry',
      'dita_li',
      'dita_dd',
      'dita_note',
      'dita_choice',
      'dita_info',
      'dita_stepxmp',
      'dita_stepresult',
    ]);
    if (!hydratable.has(node.type.name)) return false;

    if (!dispatch) return true;
    const textBlock = makeNode('xml_text_block');
    const tr = state.tr.insert(nodePos + 1, textBlock);
    tr.setSelection(TextSelection.create(tr.doc, nodePos + 2));
    dispatch(tr.scrollIntoView());
    return true;
  };
}
