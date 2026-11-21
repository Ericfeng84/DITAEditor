/**
 * DITA 1.3 core element classification and metadata registry.
 * Shared across XML serialization, ProseMirror schema mapping, and future editor intelligence.
 */

export type DitaElementKind =
  | 'topic-root'
  | 'structural'
  | 'block-container'
  | 'textblock'
  | 'codeblock'
  | 'table'
  | 'inline'
  | 'void-inline';

export const DITA_WHITESPACE_PRESERVE_TAGS = new Set<string>([
  'codeblock',
  'pre',
  'lines',
  'screen',
  'msgblock',
]);

/**
 * Element-only structural containers whose direct element children should be formatted
 * on indented lines even if those children (such as `<keyword>` or `<kwd>`) are normally
 * inline elements in prose contexts.
 */
export const DITA_STRUCTURAL_ELEMENT_CONTAINERS = new Set<string>([
  'keywords',
  'groupseq',
  'groupchoice',
  'groupcomp',
  'metadata',
  'prolog',
  'critdates',
  'prodinfo',
  'vrmlist',
  'related-links',
  'linklist',
  'linkpool',
]);

export const DITA_TOPIC_ROOT_TAGS = new Set<string>([
  'topic',
  'concept',
  'task',
  'reference',
]);

/**
 * Elements that are structurally block-level in DITA 1.3.
 * Used for both deterministic XML formatting and ProseMirror block vs inline classification.
 */
export const DITA_BLOCK_TAGS = new Set<string>([
  // Topic roots & wrappers
  'dita',
  'topic',
  'concept',
  'task',
  'reference',
  // Map roots & entries (for map XML formatting support)
  'map',
  'bookmap',
  'topicref',
  'mapref',
  'topichead',
  'topicgroup',
  'keydef',
  'chapter',
  'part',
  'appendix',
  'topicmeta',
  'reltable',
  'relheader',
  'relcolspec',
  'relrow',
  'relcell',
  // Topic metadata & headers
  'title',
  'navtitle',
  'searchtitle',
  'titlealts',
  'shortdesc',
  'abstract',
  'prolog',
  'author',
  'source',
  'publisher',
  'copyright',
  'copyryear',
  'copyrholder',
  'critdates',
  'created',
  'revised',
  'permissions',
  'metadata',
  'audience',
  'category',
  'keywords',
  'prodinfo',
  'prodname',
  'vrmlist',
  'vrm',
  'resourceid',
  'othermeta',
  'data-about',
  // Topic bodies & sections
  'body',
  'conbody',
  'taskbody',
  'refbody',
  'section',
  'sectiondiv',
  'bodydiv',
  'example',
  'refsyn',
  'related-links',
  'linklist',
  'linkpool',
  'link',
  'linkinfo',
  'linktext',
  // Task elements
  'prereq',
  'context',
  'steps',
  'steps-unordered',
  'steps-informal',
  'stepsection',
  'step',
  'cmd',
  'info',
  'substeps',
  'substep',
  'stepxmp',
  'choices',
  'choice',
  'choicetable',
  'chhead',
  'choptionhd',
  'chdeschd',
  'chrow',
  'choption',
  'chdesc',
  'stepresult',
  'tutorialinfo',
  'result',
  'postreq',
  // Reference properties table
  'properties',
  'prophead',
  'proptypehd',
  'propvaluehd',
  'propdeschd',
  'property',
  'proptype',
  'propvalue',
  'propdesc',
  // General blocks
  'p',
  'note',
  'lq',
  'div',
  'ul',
  'ol',
  'sl',
  'li',
  'sli',
  'itemgroup',
  'dl',
  'dlhead',
  'dthd',
  'ddhd',
  'dlentry',
  'dt',
  'dd',
  'fig',
  'figgroup',
  'desc',
  'alt',
  'codeblock',
  'pre',
  'lines',
  'screen',
  'msgblock',
  'object',
  'param',
  // Tables (simpletable & CALS)
  'simpletable',
  'sthead',
  'strow',
  'stentry',
  'table',
  'tgroup',
  'colspec',
  'spanspec',
  'thead',
  'tbody',
  'row',
  'entry',
  // Specialized DITA 1.3 block elements commonly seen in real docs
  'hazardstatement',
  'messagepanel',
  'typeofhazard',
  'consequence',
  'howtoavoid',
  'hazardsymbol',
  'syntaxdiagram',
  'groupseq',
  'groupchoice',
  'groupcomp',
  'fragment',
  'fragref',
  'synblk',
  'synnote',
  'troubleshooting',
  'troublebody',
  'condition',
  'troubleSolution',
  'cause',
  'remedy',
  'responsibleParty',
  'glossentry',
  'glossterm',
  'glossdef',
  'glossBody',
  'glossSurfaceForm',
  'glossAlt',
  'glossAcronym',
]);

/**
 * Elements that are strictly inline in DITA 1.3.
 */
export const DITA_INLINE_TAGS = new Set<string>([
  'b',
  'i',
  'u',
  'tt',
  'sup',
  'sub',
  'line-through',
  'overline',
  'codeph',
  'uicontrol',
  'filepath',
  'varname',
  'ph',
  'keyword',
  'xref',
  'fn',
  'term',
  'menucascade',
  'wintitle',
  'parmname',
  'option',
  'cmdname',
  'apiname',
  'userinput',
  'systemoutput',
  'cite',
  'q',
  'tm',
  'abbreviated-form',
  'indexterm',
  'draft-comment',
  'state',
  'boolean',
  'text',
  'shortcut',
  'msgnum',
  'msgph',
  'synph',
  'kwd',
  'var',
  'oper',
  'delim',
  'sep',
  'repsep',
  'data',
  'image',
]);

/**
 * Core DITA 1.3 inline elements explicitly modeled as dedicated ProseMirror node types.
 */
export const MODELED_INLINE_TAGS: ReadonlyMap<string, string> = new Map([
  ['b', 'dita_b'],
  ['i', 'dita_i'],
  ['u', 'dita_u'],
  ['codeph', 'dita_codeph'],
  ['uicontrol', 'dita_uicontrol'],
  ['filepath', 'dita_filepath'],
  ['varname', 'dita_varname'],
  ['ph', 'dita_ph'],
  ['keyword', 'dita_keyword'],
  ['xref', 'dita_xref'],
  ['fn', 'dita_fn'],
  ['cmdname', 'dita_cmdname'],
  ['parmname', 'dita_parmname'],
  ['userinput', 'dita_userinput'],
  ['systemoutput', 'dita_systemoutput'],
  ['wintitle', 'dita_wintitle'],
  ['menucascade', 'dita_menucascade'],
  ['term', 'dita_term'],
  ['option', 'dita_option'],
  ['apiname', 'dita_apiname'],
]);

/**
 * Reverse map from ProseMirror node type name -> DITA XML tag name.
 */
export const PM_NODE_TO_DITA_TAG: ReadonlyMap<string, string> = new Map([
  // Topic roots
  ['dita_topic', 'topic'],
  ['dita_concept', 'concept'],
  ['dita_task', 'task'],
  ['dita_reference', 'reference'],
  // Headers & metadata
  ['dita_title', 'title'],
  ['dita_shortdesc', 'shortdesc'],
  ['dita_prolog', 'prolog'],
  // Bodies & structural
  ['dita_body', 'body'],
  ['dita_conbody', 'conbody'],
  ['dita_taskbody', 'taskbody'],
  ['dita_refbody', 'refbody'],
  ['dita_section', 'section'],
  ['dita_example', 'example'],
  ['dita_refsyn', 'refsyn'],
  ['dita_prereq', 'prereq'],
  ['dita_context', 'context'],
  ['dita_steps', 'steps'],
  ['dita_steps_unordered', 'steps-unordered'],
  ['dita_step', 'step'],
  ['dita_cmd', 'cmd'],
  ['dita_info', 'info'],
  ['dita_stepxmp', 'stepxmp'],
  ['dita_stepresult', 'stepresult'],
  ['dita_substeps', 'substeps'],
  ['dita_substep', 'substep'],
  ['dita_choices', 'choices'],
  ['dita_choice', 'choice'],
  ['dita_result', 'result'],
  ['dita_postreq', 'postreq'],
  ['dita_related_links', 'related-links'],
  ['dita_link', 'link'],
  // Blocks
  ['dita_p', 'p'],
  ['dita_p_block', 'p'],
  ['dita_note', 'note'],
  ['dita_ul', 'ul'],
  ['dita_ol', 'ol'],
  ['dita_li', 'li'],
  ['dita_dl', 'dl'],
  ['dita_dlentry', 'dlentry'],
  ['dita_dt', 'dt'],
  ['dita_dd', 'dd'],
  ['dita_fig', 'fig'],
  ['dita_desc', 'desc'],
  ['dita_codeblock', 'codeblock'],
  ['dita_pre', 'pre'],
  ['dita_image_block', 'image'],
  // Simpletable
  ['dita_simpletable', 'simpletable'],
  ['dita_sthead', 'sthead'],
  ['dita_strow', 'strow'],
  ['dita_stentry', 'stentry'],
  // CALS table
  ['cals_table', 'table'],
  ['cals_tgroup', 'tgroup'],
  ['cals_thead', 'thead'],
  ['cals_tbody', 'tbody'],
  ['cals_row', 'row'],
  ['cals_entry', 'entry'],
  // Inline
  ['dita_b', 'b'],
  ['dita_i', 'i'],
  ['dita_u', 'u'],
  ['dita_codeph', 'codeph'],
  ['dita_uicontrol', 'uicontrol'],
  ['dita_filepath', 'filepath'],
  ['dita_varname', 'varname'],
  ['dita_ph', 'ph'],
  ['dita_keyword', 'keyword'],
  ['dita_xref', 'xref'],
  ['dita_fn', 'fn'],
  ['dita_image_inline', 'image'],
  ['dita_cmdname', 'cmdname'],
  ['dita_parmname', 'parmname'],
  ['dita_userinput', 'userinput'],
  ['dita_systemoutput', 'systemoutput'],
  ['dita_wintitle', 'wintitle'],
  ['dita_menucascade', 'menucascade'],
  ['dita_term', 'term'],
  ['dita_option', 'option'],
  ['dita_apiname', 'apiname'],
]);

export function isWhitespacePreservingElement(tagName: string, xmlSpaceAttr?: string | null): boolean {
  if (xmlSpaceAttr === 'preserve') return true;
  return DITA_WHITESPACE_PRESERVE_TAGS.has(tagName);
}

/**
 * Determine whether an XML element should be treated as block-level in the given context.
 */
export function isBlockElementName(tagName: string): boolean {
  return DITA_BLOCK_TAGS.has(tagName);
}

export function isInlineElementName(tagName: string): boolean {
  return DITA_INLINE_TAGS.has(tagName);
}
