import { Schema, type NodeSpec } from 'prosemirror-model';
import type {
  XmlAttributeEntry,
  XmlDeclaration,
  XmlPrologItem,
} from '../xml/types.js';

export type RawAttrs = XmlAttributeEntry[];

function baseAttrs(extra: Record<string, { default: unknown }> = {}) {
  return {
    rawAttrs: { default: [] as RawAttrs },
    namespaceURI: { default: null as string | null },
    ...extra,
  };
}

function attrsToDomDataset(tagName: string, rawAttrs: RawAttrs): Record<string, string> {
  const domAttrs: Record<string, string> = {
    'data-dita-tag': tagName,
  };
  for (const attr of rawAttrs) {
    if (attr.name === 'id') {
      domAttrs['data-dita-id'] = attr.value;
    } else if (attr.name === 'keyref') {
      domAttrs['data-dita-keyref'] = attr.value;
    } else if (attr.name === 'conref') {
      domAttrs['data-dita-conref'] = attr.value;
    } else if (attr.name === 'conkeyref') {
      domAttrs['data-dita-conkeyref'] = attr.value;
    } else if (attr.name === 'type') {
      domAttrs['data-dita-type'] = attr.value;
    }
  }
  return domAttrs;
}

function makeBlockContainerSpec(
  tagName: string,
  domTag: string,
  content = 'any_block*',
  group = 'any_block',
): NodeSpec {
  return {
    group,
    content,
    attrs: baseAttrs(),
    toDOM(node) {
      return [domTag, attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs), 0];
    },
  };
}

function makeTextBlockSpec(
  tagName: string,
  domTag: string,
  options: {
    group?: string;
    code?: boolean;
    whitespace?: 'pre' | 'normal';
  } = {},
): NodeSpec {
  return {
    group: options.group ?? 'any_block',
    content: 'inline*',
    code: options.code,
    whitespace: options.whitespace,
    attrs: baseAttrs(),
    toDOM(node) {
      return [domTag, attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs), 0];
    },
  };
}

function makeInlineNodeSpec(tagName: string, domTag: string): NodeSpec {
  return {
    group: 'inline',
    inline: true,
    content: 'inline*',
    attrs: baseAttrs(),
    toDOM(node) {
      return [domTag, attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs), 0];
    },
  };
}

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'any_block+',
    attrs: {
      xmlDeclaration: { default: null as XmlDeclaration | null },
      prolog: { default: [] as XmlPrologItem[] },
      epilog: { default: [] as XmlPrologItem[] },
    },
  },

  text: {
    group: 'inline',
  },

  // --- Implicit mixed-content textblock (emits NO wrapper XML tag on serialization) ---
  xml_text_block: {
    group: 'any_block',
    content: 'inline*',
    toDOM() {
      return ['div', { 'data-dita-virtual': 'text-block' }, 0];
    },
  },

  // --- Lossless XML metadata nodes (comments, PIs, CDATA) ---
  xml_comment_block: {
    group: 'any_block',
    atom: true,
    attrs: {
      data: { default: '' },
    },
    toDOM(node) {
      return ['div', { 'data-xml-comment': 'true' }, `<!--${String(node.attrs.data)}-->`];
    },
  },

  xml_comment_inline: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      data: { default: '' },
    },
    toDOM(node) {
      return ['span', { 'data-xml-comment': 'true' }, `<!--${String(node.attrs.data)}-->`];
    },
  },

  xml_pi_block: {
    group: 'any_block',
    atom: true,
    attrs: {
      target: { default: '' },
      data: { default: '' },
    },
    toDOM(node) {
      const target = String(node.attrs.target);
      const data = String(node.attrs.data);
      return ['div', { 'data-xml-pi': target }, data ? `<?${target} ${data}?>` : `<?${target}?>`];
    },
  },

  xml_pi_inline: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      target: { default: '' },
      data: { default: '' },
    },
    toDOM(node) {
      const target = String(node.attrs.target);
      const data = String(node.attrs.data);
      return ['span', { 'data-xml-pi': target }, data ? `<?${target} ${data}?>` : `<?${target}?>`];
    },
  },

  xml_cdata_block: {
    group: 'any_block',
    atom: true,
    attrs: {
      data: { default: '' },
    },
    toDOM(node) {
      return ['pre', { 'data-xml-cdata': 'true' }, String(node.attrs.data)];
    },
  },

  xml_cdata_inline: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      data: { default: '' },
    },
    toDOM(node) {
      return ['code', { 'data-xml-cdata': 'true' }, String(node.attrs.data)];
    },
  },

  // --- DITA 1.3 Topic roots ---
  dita_topic: makeBlockContainerSpec('topic', 'article'),
  dita_concept: makeBlockContainerSpec('concept', 'article'),
  dita_task: makeBlockContainerSpec('task', 'article'),
  dita_reference: makeBlockContainerSpec('reference', 'article'),

  // --- Topic header & metadata ---
  dita_title: makeTextBlockSpec('title', 'h1'),
  dita_shortdesc: makeTextBlockSpec('shortdesc', 'p'),
  dita_prolog: makeBlockContainerSpec('prolog', 'aside'),

  // --- Bodies & structural sections ---
  dita_body: makeBlockContainerSpec('body', 'section'),
  dita_conbody: makeBlockContainerSpec('conbody', 'section'),
  dita_taskbody: makeBlockContainerSpec('taskbody', 'section'),
  dita_refbody: makeBlockContainerSpec('refbody', 'section'),
  dita_section: makeBlockContainerSpec('section', 'section'),
  dita_example: makeBlockContainerSpec('example', 'section'),
  dita_refsyn: makeBlockContainerSpec('refsyn', 'section'),

  // --- Task structures ---
  dita_prereq: makeBlockContainerSpec('prereq', 'section'),
  dita_context: makeBlockContainerSpec('context', 'section'),
  dita_steps: makeBlockContainerSpec('steps', 'ol'),
  dita_steps_unordered: makeBlockContainerSpec('steps-unordered', 'ul'),
  dita_step: makeBlockContainerSpec('step', 'li'),
  dita_cmd: makeTextBlockSpec('cmd', 'p'),
  dita_info: makeBlockContainerSpec('info', 'div'),
  dita_stepxmp: makeBlockContainerSpec('stepxmp', 'div'),
  dita_stepresult: makeBlockContainerSpec('stepresult', 'div'),
  dita_substeps: makeBlockContainerSpec('substeps', 'ol'),
  dita_substep: makeBlockContainerSpec('substep', 'li'),
  dita_choices: makeBlockContainerSpec('choices', 'ul'),
  dita_choice: makeBlockContainerSpec('choice', 'li'),
  dita_result: makeBlockContainerSpec('result', 'section'),
  dita_postreq: makeBlockContainerSpec('postreq', 'section'),

  // --- Related links ---
  dita_related_links: makeBlockContainerSpec('related-links', 'nav'),
  dita_link: makeBlockContainerSpec('link', 'div'),

  // --- Common block elements ---
  dita_p: makeTextBlockSpec('p', 'p'),
  /** Block-container variant of <p> when a DITA <p> contains nested block children (e.g. <ul>, <codeblock>). */
  dita_p_block: makeBlockContainerSpec('p', 'div'),
  dita_note: makeBlockContainerSpec('note', 'aside'),
  dita_ul: makeBlockContainerSpec('ul', 'ul'),
  dita_ol: makeBlockContainerSpec('ol', 'ol'),
  dita_li: makeBlockContainerSpec('li', 'li'),
  dita_dl: makeBlockContainerSpec('dl', 'dl'),
  dita_dlentry: makeBlockContainerSpec('dlentry', 'div'),
  dita_dt: makeTextBlockSpec('dt', 'dt'),
  dita_dd: makeBlockContainerSpec('dd', 'dd'),
  dita_fig: makeBlockContainerSpec('fig', 'figure'),
  dita_desc: makeTextBlockSpec('desc', 'figcaption'),
  dita_codeblock: makeTextBlockSpec('codeblock', 'pre', { code: true, whitespace: 'pre' }),
  dita_pre: makeTextBlockSpec('pre', 'pre', { code: true, whitespace: 'pre' }),
  dita_image_block: makeBlockContainerSpec('image', 'figure'),

  // --- Simpletable ---
  dita_simpletable: makeBlockContainerSpec('simpletable', 'table'),
  dita_sthead: makeBlockContainerSpec('sthead', 'tr'),
  dita_strow: makeBlockContainerSpec('strow', 'tr'),
  dita_stentry: makeBlockContainerSpec('stentry', 'td'),

  // --- OASIS CALS Table ---
  cals_table: makeBlockContainerSpec('table', 'div'),
  cals_tgroup: {
    group: 'any_block',
    content: 'any_block*',
    attrs: baseAttrs({
      cols: { default: 1 },
    }),
    toDOM(node) {
      return [
        'table',
        {
          ...attrsToDomDataset('tgroup', node.attrs.rawAttrs as RawAttrs),
          'data-cals-cols': String(node.attrs.cols),
        },
        0,
      ];
    },
  },
  cals_colspec: {
    group: 'any_block',
    atom: true,
    attrs: baseAttrs({
      colnum: { default: 1 },
      colname: { default: '' },
      colwidth: { default: null as string | null },
    }),
    toDOM(node) {
      return [
        'col',
        {
          'data-dita-tag': 'colspec',
          'data-colname': String(node.attrs.colname),
        },
      ];
    },
  },
  cals_thead: makeBlockContainerSpec('thead', 'thead'),
  cals_tbody: makeBlockContainerSpec('tbody', 'tbody'),
  cals_row: makeBlockContainerSpec('row', 'tr'),
  cals_entry: {
    group: 'any_block',
    content: 'any_block*',
    attrs: baseAttrs({
      colspan: { default: 1 },
      rowspan: { default: 1 },
    }),
    toDOM(node) {
      const domAttrs: Record<string, string> = attrsToDomDataset(
        'entry',
        node.attrs.rawAttrs as RawAttrs,
      );
      if (Number(node.attrs.colspan) > 1) {
        domAttrs.colspan = String(node.attrs.colspan);
      }
      if (Number(node.attrs.rowspan) > 1) {
        domAttrs.rowspan = String(node.attrs.rowspan);
      }
      return ['td', domAttrs, 0];
    },
  },

  // --- Core DITA 1.3 inline elements ---
  dita_b: makeInlineNodeSpec('b', 'strong'),
  dita_i: makeInlineNodeSpec('i', 'em'),
  dita_u: makeInlineNodeSpec('u', 'u'),
  dita_codeph: makeInlineNodeSpec('codeph', 'code'),
  dita_uicontrol: makeInlineNodeSpec('uicontrol', 'span'),
  dita_filepath: makeInlineNodeSpec('filepath', 'code'),
  dita_varname: makeInlineNodeSpec('varname', 'var'),
  dita_ph: makeInlineNodeSpec('ph', 'span'),
  dita_keyword: makeInlineNodeSpec('keyword', 'span'),
  dita_xref: makeInlineNodeSpec('xref', 'a'),
  dita_fn: makeInlineNodeSpec('fn', 'span'),
  /** Block-containing variant of inline <fn> (e.g., <fn><p>...</p></fn>). */
  dita_fn_block: {
    group: 'inline',
    inline: true,
    atom: true,
    content: 'any_block*',
    attrs: baseAttrs(),
    toDOM(node) {
      return ['span', attrsToDomDataset('fn', node.attrs.rawAttrs as RawAttrs), 0];
    },
  },
  dita_image_inline: makeInlineNodeSpec('image', 'span'),
  dita_cmdname: makeInlineNodeSpec('cmdname', 'code'),
  dita_parmname: makeInlineNodeSpec('parmname', 'code'),
  dita_userinput: makeInlineNodeSpec('userinput', 'kbd'),
  dita_systemoutput: makeInlineNodeSpec('systemoutput', 'samp'),
  dita_wintitle: makeInlineNodeSpec('wintitle', 'span'),
  dita_menucascade: makeInlineNodeSpec('menucascade', 'span'),
  dita_term: makeInlineNodeSpec('term', 'dfn'),
  dita_option: makeInlineNodeSpec('option', 'code'),
  dita_apiname: makeInlineNodeSpec('apiname', 'code'),

  // --- Passthrough fallback nodes for unknown / specialized DITA elements ---
  unknown_block: {
    group: 'any_block',
    content: 'any_block*',
    attrs: baseAttrs({
      tagName: { default: '' },
      preserveWhitespace: { default: false },
    }),
    toDOM(node) {
      const tagName = String(node.attrs.tagName);
      return [
        'div',
        {
          ...attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs),
          'data-dita-unknown': 'block',
        },
        0,
      ];
    },
  },

  /** Whitespace-preserving variant of unknown_block (e.g., <screen>, <lines>, <msgblock>, or xml:space="preserve"). */
  unknown_pre_block: {
    group: 'any_block',
    content: 'inline*',
    code: true,
    whitespace: 'pre',
    attrs: baseAttrs({
      tagName: { default: '' },
    }),
    toDOM(node) {
      const tagName = String(node.attrs.tagName);
      return [
        'pre',
        {
          ...attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs),
          'data-dita-unknown': 'pre-block',
        },
        0,
      ];
    },
  },

  unknown_inline: {
    group: 'inline',
    inline: true,
    content: 'inline*',
    attrs: baseAttrs({
      tagName: { default: '' },
    }),
    toDOM(node) {
      const tagName = String(node.attrs.tagName);
      return [
        'span',
        {
          ...attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs),
          'data-dita-unknown': 'inline',
        },
        0,
      ];
    },
  },

  /** Block-containing variant of unknown_inline when an inline specialized tag contains block children. */
  unknown_inline_block: {
    group: 'inline',
    inline: true,
    atom: true,
    content: 'any_block*',
    attrs: baseAttrs({
      tagName: { default: '' },
    }),
    toDOM(node) {
      const tagName = String(node.attrs.tagName);
      return [
        'span',
        {
          ...attrsToDomDataset(tagName, node.attrs.rawAttrs as RawAttrs),
          'data-dita-unknown': 'inline-block',
        },
        0,
      ];
    },
  },
};

export const ditaSchema = new Schema({ nodes, marks: {} });
