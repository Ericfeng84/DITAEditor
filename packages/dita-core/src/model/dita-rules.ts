/**
 * DITA 1.3 content model rules, element display metadata, and attribute definitions.
 * Shared across Visual Editor (context-aware insert menu, breadcrumb, attributes panel)
 * and CodeMirror 6 XML Source Editor (context-aware tag & attribute autocomplete).
 */

import type { UiLocale } from '../i18n/locale.js';
import type { XmlAttributeEntry } from '../xml/types.js';
import type { TaskContentModel } from './task-model.js';

export type DitaElementCategory =
  | 'topic'
  | 'map'
  | 'structure'
  | 'task'
  | 'block'
  | 'table'
  | 'inline'
  | 'metadata';

export interface DitaElementSpec {
  tag: string;
  /** English display label (OASIS terminology). */
  label: string;
  labelZh: string;
  /** English description. */
  description: string;
  /** Optional Chinese description; falls back to `description`. */
  descriptionZh?: string;
  category: DitaElementCategory;
  kind: 'block' | 'inline';
  pmNodeType?: string;
  shortcut?: string;
  keywords?: readonly string[];
}

export type DitaAttributeGroup =
  | 'element'
  | 'core'
  | 'profiling'
  | 'reuse'
  | 'presentation';

export interface DitaAttributeSpec {
  name: string;
  /** English label. */
  label: string;
  labelZh?: string;
  group: DitaAttributeGroup;
  /** English description. */
  description: string;
  descriptionZh?: string;
  required?: boolean;
  values?: readonly string[];
  /** English placeholder. */
  placeholder?: string;
  placeholderZh?: string;
}

export const DITA_CORE_INLINE_TAGS: readonly string[] = [
  'b',
  'i',
  'u',
  'codeph',
  'uicontrol',
  'filepath',
  'varname',
  'ph',
  'keyword',
  'xref',
  'fn',
  'image',
  'cmdname',
  'parmname',
  'userinput',
  'systemoutput',
  'wintitle',
  'menucascade',
  'term',
  'option',
  'apiname',
];

const FLOW_BLOCKS: readonly string[] = [
  'p',
  'note',
  'hazardstatement',
  'ul',
  'ol',
  'dl',
  'codeblock',
  'pre',
  'fig',
  'image',
  'simpletable',
  'table',
];

const BODY_BLOCKS: readonly string[] = [
  'p',
  'section',
  'example',
  'note',
  'hazardstatement',
  'ul',
  'ol',
  'dl',
  'codeblock',
  'pre',
  'fig',
  'image',
  'simpletable',
  'table',
];

/**
 * `conbody` reuses the body blocks plus DITA 1.3 `<conbodydiv>`:
 * `((body.cnt)*, (section | example | conbodydiv)*)` (concept.mod).
 */
const CONBODY_BLOCKS: readonly string[] = [...BODY_BLOCKS, 'conbodydiv'];

const MIXED_CONTAINER_CHILDREN: readonly string[] = [
  ...FLOW_BLOCKS,
  ...DITA_CORE_INLINE_TAGS,
];

/**
 * DITA 1.3 parent element -> allowed direct child elements.
 * Used for both Visual context-aware insert menus and CodeMirror 6 XML tag completion.
 */
export const DITA_CONTENT_MODEL: Readonly<Record<string, readonly string[]>> = {
  // Topic roots
  // The trailing `<topic>`/`<concept>`/… entry is the topic-nesting slot: each shell DTD
  // overrides `%info-types;` so a concept may only nest concepts, a task only tasks, etc.
  topic: ['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'body', 'related-links', 'topic'],
  concept: ['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'conbody', 'related-links', 'concept'],
  task: ['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'taskbody', 'related-links', 'task'],
  reference: ['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'refbody', 'related-links', 'reference'],

  // Topic alternate titles (topic.mod: titlealts = (navtitle?, searchtitle?))
  titlealts: ['navtitle', 'searchtitle'],

  // Map root and hierarchy containers
  map: ['title', 'topicmeta', 'topicref', 'mapref', 'topichead', 'topicgroup', 'keydef', 'topicset', 'ditavalref', 'reltable'],
  topicref: ['topicmeta', 'topicref', 'mapref', 'topichead', 'topicgroup', 'keydef'],
  topichead: ['topicmeta', 'topicref', 'mapref', 'topichead', 'topicgroup', 'keydef'],
  topicgroup: ['topicmeta', 'topicref', 'mapref', 'topichead', 'topicgroup', 'keydef'],
  topicset: ['topicmeta', 'topicref', 'mapref', 'topichead', 'topicgroup', 'keydef'],
  topicmeta: ['navtitle', 'linktext', 'shortdesc', 'keywords', 'author', 'critdates', 'othermeta'],
  keydef: ['topicmeta'],
  reltable: ['title', 'relheader', 'relrow'],
  relheader: ['relcolspec'],
  relrow: ['relcell'],
  relcell: ['topicref', 'topicgroup'],

  // Bodies
  // topic.mod `body.content` = (body.cnt | bodydiv | example | section)*
  body: [...BODY_BLOCKS, 'bodydiv'],
  // topic.mod `bodydiv.content` = (`bodydiv.cnt` | bodydiv | section)* — untitled, self-nesting legal.
  bodydiv: [...FLOW_BLOCKS, 'section', 'bodydiv'],
  conbody: CONBODY_BLOCKS,
  conbodydiv: ['section', 'example'],
  // Strict Task (task.dtd + strictTaskbodyConstraint.mod):
  // (prereq?, context?, (steps | steps-unordered)?, result?, tasktroubleshooting?,
  //  example?, postreq?). `section` / `steps-informal` only exist in the unconstrained
  // `generalTask.dtd` / `ditabase.dtd` models, so they are not offered here.
  taskbody: [
    'prereq',
    'context',
    'steps',
    'steps-unordered',
    'result',
    'tasktroubleshooting',
    'example',
    'postreq',
  ],
  tasktroubleshooting: FLOW_BLOCKS,
  abstract: BODY_BLOCKS,
  refbody: ['refsyn', 'properties', 'section', 'example', 'simpletable', 'table', 'refbodydiv'],
  // reference.mod `refbodydiv.cnt` mirrors `refbody.cnt` (self-nesting is legal).
  refbodydiv: ['refsyn', 'properties', 'section', 'example', 'simpletable', 'table', 'refbodydiv'],

  // Sections & examples (DITA 1.3 adds `<sectiondiv>` inside a section, but neither a nested
  // `<section>` nor an `<example>` is legal there — see topic.mod `section.cnt`).
  section: ['title', 'sectiondiv', ...FLOW_BLOCKS],
  // topic.mod `sectiondiv.cnt` = basic blocks/phrases plus nested `<sectiondiv>` (no title).
  sectiondiv: [...MIXED_CONTAINER_CHILDREN, 'sectiondiv'],
  example: ['title', ...FLOW_BLOCKS],
  refsyn: ['title', ...FLOW_BLOCKS],

  // Task children
  prereq: FLOW_BLOCKS,
  context: FLOW_BLOCKS,
  steps: ['stepsection', 'step'],
  'steps-unordered': ['stepsection', 'step'],
  // steps-informal is pure prose: it has no step structure at all.
  'steps-informal': FLOW_BLOCKS,
  stepsection: MIXED_CONTAINER_CHILDREN,
  // OASIS task.mod: (note*, cmd, (choices | choicetable | info | itemgroup | stepxmp | substeps
  //                          | tutorialinfo)*, stepresult?, steptroubleshooting?)
  step: [
    'note',
    'hazardstatement',
    'cmd',
    'info',
    'substeps',
    'choices',
    'choicetable',
    'itemgroup',
    'stepxmp',
    'tutorialinfo',
    'stepresult',
    'steptroubleshooting',
  ],
  substeps: ['substep'],
  substep: ['note', 'hazardstatement', 'cmd', 'info', 'itemgroup', 'stepxmp', 'tutorialinfo', 'stepresult'],
  choices: ['choice'],
  choice: MIXED_CONTAINER_CHILDREN,
  choicetable: ['chhead', 'chrow'],
  chhead: ['choptionhd', 'chdeschd'],
  chrow: ['choption', 'chdesc'],
  choption: MIXED_CONTAINER_CHILDREN,
  chdesc: MIXED_CONTAINER_CHILDREN,
  choptionhd: MIXED_CONTAINER_CHILDREN,
  chdeschd: MIXED_CONTAINER_CHILDREN,
  info: FLOW_BLOCKS,
  stepxmp: FLOW_BLOCKS,
  stepresult: FLOW_BLOCKS,
  steptroubleshooting: FLOW_BLOCKS,
  tutorialinfo: FLOW_BLOCKS,
  itemgroup: MIXED_CONTAINER_CHILDREN,
  result: FLOW_BLOCKS,
  postreq: FLOW_BLOCKS,

  // Related links & prolog
  // topic.mod `related-links.content` = (link | linklist | linkpool)*
  'related-links': ['link', 'linklist', 'linkpool'],
  link: ['linktext', 'desc'],
  // topic.mod `linklist.content` = (title?, desc?, (linklist | link)*, linkinfo?)
  linklist: ['title', 'desc', 'link', 'linklist', 'linkinfo'],
  // topic.mod `linkpool.content` = (linkpool | link)*
  linkpool: ['link', 'linkpool'],
  // topic.mod `linkinfo.content` = (desc.cnt)*
  linkinfo: FLOW_BLOCKS,
  prolog: ['author', 'critdates', 'metadata'],
  critdates: ['created', 'revised'],
  metadata: ['keywords', 'othermeta'],
  keywords: ['keyword'],

  // Textblocks
  title: DITA_CORE_INLINE_TAGS,
  shortdesc: DITA_CORE_INLINE_TAGS,
  cmd: DITA_CORE_INLINE_TAGS,
  dt: DITA_CORE_INLINE_TAGS,
  desc: DITA_CORE_INLINE_TAGS,
  p: [...DITA_CORE_INLINE_TAGS, 'ul', 'ol', 'dl', 'note', 'codeblock', 'pre', 'fig', 'simpletable', 'table'],
  codeblock: ['b', 'i', 'u', 'ph', 'keyword', 'varname', 'userinput', 'systemoutput', 'xref'],
  pre: ['b', 'i', 'u', 'ph', 'keyword', 'varname', 'userinput', 'systemoutput', 'xref'],

  // Lists & callouts
  ul: ['li'],
  ol: ['li'],
  li: MIXED_CONTAINER_CHILDREN,
  dl: ['dlentry'],
  dlentry: ['dt', 'dd'],
  dd: MIXED_CONTAINER_CHILDREN,
  note: MIXED_CONTAINER_CHILDREN,
  fig: ['title', 'desc', 'image', 'p', 'codeblock', 'pre', 'simpletable'],
  image: ['alt'],

  // Simpletable
  simpletable: ['sthead', 'strow'],
  sthead: ['stentry'],
  strow: ['stentry'],
  stentry: MIXED_CONTAINER_CHILDREN,

  // Reference parameter tables (reference.mod: `properties = (prophead?, property+)`).
  properties: ['prophead', 'property'],
  prophead: ['proptypehd', 'propvaluehd', 'propdeschd'],
  property: ['proptype', 'propvalue', 'propdesc'],

  // CALS table
  table: ['title', 'desc', 'tgroup'],
  tgroup: ['colspec', 'thead', 'tbody'],
  thead: ['row'],
  tbody: ['row'],
  row: ['entry'],
  entry: MIXED_CONTAINER_CHILDREN,

  // Inline containers
  b: DITA_CORE_INLINE_TAGS,
  i: DITA_CORE_INLINE_TAGS,
  u: DITA_CORE_INLINE_TAGS,
  ph: DITA_CORE_INLINE_TAGS,
  xref: ['b', 'i', 'u', 'codeph', 'uicontrol', 'filepath', 'varname', 'ph', 'keyword', 'image'],
  fn: ['p', 'ul', 'ol', 'note', 'codeblock', ...DITA_CORE_INLINE_TAGS],
  codeph: ['varname', 'ph', 'keyword', 'b', 'i'],
  uicontrol: ['keyword', 'ph', 'varname'],
  filepath: ['varname', 'keyword', 'ph'],
  varname: ['keyword', 'ph'],
  keyword: [],
  menucascade: ['uicontrol'],
  cmdname: ['keyword', 'ph'],
  parmname: ['keyword', 'ph'],
  userinput: ['varname', 'keyword', 'ph'],
  systemoutput: ['varname', 'keyword', 'ph'],
  wintitle: ['keyword', 'ph'],
  term: ['keyword', 'ph'],
  option: ['keyword', 'ph'],
  apiname: ['keyword', 'ph'],
};

const ELEMENT_SPEC_LIST: readonly DitaElementSpec[] = [
  // Topic roots
  { tag: 'topic', label: 'Topic', labelZh: '通用主题', description: 'Base DITA topic root element', category: 'topic', kind: 'block', pmNodeType: 'dita_topic' },
  { tag: 'concept', label: 'Concept', labelZh: '概念主题', description: 'Conceptual overview answering "what" and "why"', category: 'topic', kind: 'block', pmNodeType: 'dita_concept' },
  { tag: 'task', label: 'Task', labelZh: '任务主题', description: 'Step-by-step procedural guide', category: 'topic', kind: 'block', pmNodeType: 'dita_task' },
  { tag: 'reference', label: 'Reference', labelZh: '参考主题', description: 'Structured specifications, parameters, and tables', category: 'topic', kind: 'block', pmNodeType: 'dita_reference' },

  // Map elements
  { tag: 'map', label: 'DITA Map', labelZh: 'DITA 地图', description: 'Root navigation map assembling topics and sub-maps', category: 'map', kind: 'block', keywords: ['ditamap', 'toc', '目录'] },
  { tag: 'topicref', label: 'Topic Reference', labelZh: '主题引用', description: 'References a DITA topic or nests child topicrefs', category: 'map', kind: 'block', keywords: ['href', 'topic', '引用'] },
  { tag: 'mapref', label: 'Sub-map Reference', labelZh: '子 Map 引用', description: 'Includes a child .ditamap at this hierarchy position', category: 'map', kind: 'block', keywords: ['submap', 'ditamap', '子地图'] },
  { tag: 'topichead', label: 'Topic Heading', labelZh: '导航分组标题', description: 'Title-only navigation node without a target topic file', category: 'map', kind: 'block', keywords: ['folder', 'heading', '分组'] },
  { tag: 'topicgroup', label: 'Topic Group', labelZh: '无标题逻辑组', description: 'Groups topicrefs to share attributes or collection-type without adding a TOC heading', category: 'map', kind: 'block', keywords: ['group', '组'] },
  { tag: 'keydef', label: 'Key Definition', labelZh: 'Key 变量定义', description: 'Resource-only key definition binding a key name to a target or inline keyword', category: 'map', kind: 'block', keywords: ['keys', 'variable', '键值'] },
  { tag: 'topicmeta', label: 'Topic Metadata', labelZh: '节点元数据', description: 'Navigation title, keywords, and metadata for a map entry', category: 'map', kind: 'block' },
  { tag: 'navtitle', label: 'Navigation Title', labelZh: '导航标题', description: 'Override title shown in TOC and Map tree (inside titlealts)', category: 'structure', kind: 'block', pmNodeType: 'dita_navtitle', keywords: ['toc', '导航'] },
  { tag: 'titlealts', label: 'Title Alternatives', labelZh: '替代标题', description: 'Alternate titles for TOC (navtitle) and search results (searchtitle)', category: 'structure', kind: 'block', pmNodeType: 'dita_titlealts', keywords: ['navtitle', 'searchtitle', '替代标题'] },
  { tag: 'searchtitle', label: 'Search Title', labelZh: '检索标题', description: 'Title used by search engines and search results instead of the H1', category: 'structure', kind: 'block', pmNodeType: 'dita_searchtitle', keywords: ['search', '检索'] },
  { tag: 'reltable', label: 'Relationship Table', labelZh: '关联关系表', description: 'Defines non-hierarchical related links between topics', category: 'map', kind: 'block' },

  // Header & metadata
  { tag: 'title', label: 'Title', labelZh: '标题', description: 'Heading for a topic, section, figure, or table', category: 'structure', kind: 'block', pmNodeType: 'dita_title', keywords: ['heading', 'h1', '标题'] },
  { tag: 'shortdesc', label: 'Short Description', labelZh: '摘要', description: 'Concise topic summary used in previews and search', category: 'structure', kind: 'block', pmNodeType: 'dita_shortdesc', keywords: ['summary', 'abstract', '摘要'] },
  { tag: 'abstract', label: 'Abstract', labelZh: '摘要块', description: 'Multi-block topic summary; the alternative to shortdesc in (abstract | shortdesc)', category: 'structure', kind: 'block', pmNodeType: 'dita_abstract', keywords: ['summary', 'shortdesc', '摘要'] },
  { tag: 'prolog', label: 'Prolog', labelZh: '元数据区', description: 'Author, dates, keywords, and topic metadata', category: 'metadata', kind: 'block', pmNodeType: 'dita_prolog', keywords: ['meta', 'author', '元数据'] },
  { tag: 'related-links', label: 'Related Links', labelZh: '相关链接', description: 'Cross-references to related topics', category: 'structure', kind: 'block', pmNodeType: 'dita_related_links', keywords: ['links', '相关'] },
  { tag: 'link', label: 'Related Link', labelZh: '链接项', description: 'Single related topic link inside related-links', category: 'structure', kind: 'block', pmNodeType: 'dita_link', keywords: ['href', '链接'] },
  { tag: 'linklist', label: 'Link List', labelZh: '链接列表', description: 'Titled group of related links (title?, desc?, (linklist | link)*, linkinfo?)', category: 'structure', kind: 'block', pmNodeType: 'dita_linklist', keywords: ['links', 'related', '链接列表'] },
  { tag: 'linkpool', label: 'Link Pool', labelZh: '链接池', description: 'Title-less container of related links, usually filled by a relationship table', category: 'structure', kind: 'block', pmNodeType: 'dita_linkpool', keywords: ['links', 'pool', '链接池'] },
  { tag: 'linkinfo', label: 'Link Info', labelZh: '链接组说明', description: 'Extra prose appended after a link list (single occurrence, must be last)', category: 'structure', kind: 'block', pmNodeType: 'dita_linkinfo', keywords: ['prose', '链接说明'] },
  { tag: 'linktext', label: 'Link Text', labelZh: '链接文字', description: 'Overrides the target topic title as the rendered link text', category: 'inline', kind: 'inline', keywords: ['link title', '链接文字'] },

  // Bodies & sections
  { tag: 'body', label: 'Body', labelZh: '正文', description: 'Main body of a base topic', category: 'structure', kind: 'block', pmNodeType: 'dita_body' },
  { tag: 'bodydiv', label: 'Body Division', labelZh: '正文分组', description: 'Title-less group of body blocks that can carry an id for conref reuse', category: 'structure', kind: 'block', pmNodeType: 'dita_bodydiv', keywords: ['group', 'div', '正文分组'] },
  { tag: 'conbody', label: 'Concept Body', labelZh: '概念正文', description: 'Main body of a concept topic', category: 'structure', kind: 'block', pmNodeType: 'dita_conbody' },
  { tag: 'conbodydiv', label: 'Concept Body Division', labelZh: '正文分区', description: 'Groups sections and examples inside a concept body (DITA 1.3)', category: 'structure', kind: 'block', pmNodeType: 'dita_conbodydiv', keywords: ['group', 'div', '分区'] },
  { tag: 'taskbody', label: 'Task Body', labelZh: '任务正文', description: 'Structured body of a procedural task', category: 'structure', kind: 'block', pmNodeType: 'dita_taskbody' },
  { tag: 'refbody', label: 'Reference Body', labelZh: '参考正文', description: 'Main body of a reference topic', category: 'structure', kind: 'block', pmNodeType: 'dita_refbody' },
  { tag: 'section', label: 'Section', labelZh: '章节', description: 'Titled organizational division within a topic body', category: 'structure', kind: 'block', pmNodeType: 'dita_section', keywords: ['sec', '章节', '小节'] },
  { tag: 'sectiondiv', label: 'Section Division', labelZh: '章节分组', description: 'Groups blocks inside a section without adding a title (DITA 1.3)', category: 'structure', kind: 'block', pmNodeType: 'dita_sectiondiv', keywords: ['group', 'div', '分组'] },
  { tag: 'example', label: 'Example', labelZh: '示例块', description: 'Illustrates a concept, task, or reference usage', category: 'structure', kind: 'block', pmNodeType: 'dita_example', keywords: ['sample', '示例'] },
  { tag: 'refsyn', label: 'Reference Syntax', labelZh: '语法定义', description: 'Syntax signature or endpoint block in reference topics', category: 'structure', kind: 'block', pmNodeType: 'dita_refsyn', keywords: ['syntax', 'api', '语法'] },
  { tag: 'refbodydiv', label: 'Reference Body Division', labelZh: '参考正文分区', description: 'Groups reference bodies without adding a title (DITA 1.3)', category: 'structure', kind: 'block', pmNodeType: 'dita_refbodydiv', keywords: ['group', 'div', '分区'] },

  // Reference parameter tables (properties / prophead / property)
  { tag: 'properties', label: 'Properties Table', labelZh: '属性表', description: 'Two- or three-column parameter table: type, value, description', category: 'table', kind: 'block', pmNodeType: 'dita_properties', keywords: ['param', 'attribute', '参数', '属性'] },
  { tag: 'prophead', label: 'Properties Header', labelZh: '属性表头', description: 'Optional header row of a properties table', category: 'table', kind: 'block', pmNodeType: 'dita_prophead', keywords: ['header', '表头'] },
  { tag: 'property', label: 'Property Row', labelZh: '属性行', description: 'One parameter row: type, value and description', category: 'table', kind: 'block', pmNodeType: 'dita_property', keywords: ['row', '参数', '属性行'] },

  // Task workflow elements
  { tag: 'prereq', label: 'Prerequisites', labelZh: '前置条件', description: 'Conditions required before performing the task', category: 'task', kind: 'block', pmNodeType: 'dita_prereq', keywords: ['before', '前置'] },
  { tag: 'context', label: 'Context', labelZh: '背景说明', description: 'Background context for the procedure', category: 'task', kind: 'block', pmNodeType: 'dita_context', keywords: ['background', '背景'] },
  { tag: 'steps', label: 'Ordered Steps', labelZh: '有序步骤组', description: 'Numbered sequence of procedural steps', category: 'task', kind: 'block', pmNodeType: 'dita_steps', keywords: ['procedure', '步骤'] },
  { tag: 'steps-unordered', label: 'Unordered Steps', labelZh: '无序步骤组', description: 'Non-sequential procedural steps', category: 'task', kind: 'block', pmNodeType: 'dita_steps_unordered', keywords: ['unordered', '无序步骤'] },
  { tag: 'step', label: 'Step', labelZh: '操作步骤', description: 'Single action step containing a command (cmd)', category: 'task', kind: 'block', pmNodeType: 'dita_step', keywords: ['action', '步骤'] },
  { tag: 'cmd', label: 'Command', labelZh: '步骤指令', description: 'Required action instruction for a step', category: 'task', kind: 'block', pmNodeType: 'dita_cmd', keywords: ['command', '指令'] },
  { tag: 'info', label: 'Step Info', labelZh: '步骤补充说明', description: 'Additional details explaining a step', category: 'task', kind: 'block', pmNodeType: 'dita_info', keywords: ['detail', '说明'] },
  { tag: 'substeps', label: 'Substeps', labelZh: '子步骤组', description: 'Nested ordered sub-steps inside a step', category: 'task', kind: 'block', pmNodeType: 'dita_substeps', keywords: ['sub', '子步骤'] },
  { tag: 'substep', label: 'Substep', labelZh: '子步骤', description: 'Single nested sub-step with a cmd', category: 'task', kind: 'block', pmNodeType: 'dita_substep', keywords: ['子步骤'] },
  { tag: 'choices', label: 'Choices', labelZh: '分支选项组', description: 'Alternative options for completing a step', category: 'task', kind: 'block', pmNodeType: 'dita_choices', keywords: ['options', '选项'] },
  { tag: 'choice', label: 'Choice', labelZh: '分支选项', description: 'Single option within choices', category: 'task', kind: 'block', pmNodeType: 'dita_choice', keywords: ['选项'] },
  { tag: 'stepxmp', label: 'Step Example', labelZh: '步骤示例', description: 'Concrete example illustrating a step', category: 'task', kind: 'block', pmNodeType: 'dita_stepxmp', keywords: ['example', '示例'] },
  { tag: 'stepresult', label: 'Step Result', labelZh: '步骤预期结果', description: 'Expected outcome after completing a step', category: 'task', kind: 'block', pmNodeType: 'dita_stepresult', keywords: ['outcome', '结果'] },
  { tag: 'result', label: 'Task Result', labelZh: '任务结果', description: 'Overall expected result of the task', category: 'task', kind: 'block', pmNodeType: 'dita_result', keywords: ['outcome', '任务结果'] },
  { tag: 'postreq', label: 'Postrequisites', labelZh: '后续操作', description: 'Follow-up actions after finishing the task', category: 'task', kind: 'block', pmNodeType: 'dita_postreq', keywords: ['next', '后续'] },
  { tag: 'tasktroubleshooting', label: 'Task Troubleshooting', labelZh: '任务排障', description: 'Prose remedy section placed after result in a taskbody', category: 'task', kind: 'block', pmNodeType: 'dita_tasktroubleshooting', keywords: ['trouble', 'troubleshooting', '排障'] },
  { tag: 'steps-informal', label: 'Informal Steps', labelZh: '非正式步骤', description: 'Prose-only procedure without step structure (no cmd elements)', category: 'task', kind: 'block', pmNodeType: 'dita_steps_informal', keywords: ['prose', 'procedure', '非正式步骤'] },
  { tag: 'stepsection', label: 'Step Section', labelZh: '步骤分组', description: 'Titled divider that groups steps without restarting step numbering', category: 'task', kind: 'block', pmNodeType: 'dita_stepsection', keywords: ['group', 'phase', '分组'] },
  { tag: 'steptroubleshooting', label: 'Step Troubleshooting', labelZh: '步骤排障', description: 'Step-scoped remedy text after stepresult', category: 'task', kind: 'block', pmNodeType: 'dita_steptroubleshooting', keywords: ['trouble', '排障'] },
  { tag: 'tutorialinfo', label: 'Tutorial Info', labelZh: '教学提示', description: 'Teaching-oriented explanation or link attached to a step', category: 'task', kind: 'block', pmNodeType: 'dita_tutorialinfo', keywords: ['tutorial', 'teaching', '教学'] },
  { tag: 'itemgroup', label: 'Item Group', labelZh: '条目分组', description: 'Groups sibling items (li / sli / choice) inside info, stepxmp, or tutorialinfo', category: 'task', kind: 'block', pmNodeType: 'dita_itemgroup', keywords: ['group', '分组'] },
  { tag: 'choicetable', label: 'Choice Table', labelZh: '选项表格', description: 'Two-column table form of choices (choption / chdesc rows)', category: 'task', kind: 'block', pmNodeType: 'dita_choicetable', keywords: ['choice', 'table', '选项', '表格'] },

  // Common blocks
  { tag: 'p', label: 'Paragraph', labelZh: '段落', description: 'Standard text paragraph', category: 'block', kind: 'block', pmNodeType: 'dita_p', keywords: ['text', 'para', '段落'] },
  { tag: 'note', label: 'Note / Callout', labelZh: '提示框', description: 'Admonition block (note, tip, caution, warning, danger)', category: 'block', kind: 'block', pmNodeType: 'dita_note', keywords: ['tip', 'warning', 'caution', 'callout', '提示', '注意'] },
  // Kept as a lossless passthrough node: its messagepanel / typeofhazard / consequence children are
  // the canonical "unknown specialized element" regression fixture, so no PM node type is modeled.
  { tag: 'hazardstatement', label: 'Hazard Statement', labelZh: '危险警示', description: 'DITA 1.3 safety statement (messagepanel + hazardsymbol); inserted and preserved as passthrough', category: 'block', kind: 'block', keywords: ['safety', 'warning', 'danger', '安全', '警示'] },
  { tag: 'ul', label: 'Bulleted List', labelZh: '无序列表', description: 'Unordered bulleted list', category: 'block', kind: 'block', pmNodeType: 'dita_ul', keywords: ['list', 'bullet', '无序列表'] },
  { tag: 'ol', label: 'Numbered List', labelZh: '有序列表', description: 'Ordered numbered list', category: 'block', kind: 'block', pmNodeType: 'dita_ol', keywords: ['list', 'number', '有序列表'] },
  { tag: 'li', label: 'List Item', labelZh: '列表项', description: 'Item inside ul or ol', category: 'block', kind: 'block', pmNodeType: 'dita_li', keywords: ['item', '列表项'] },
  { tag: 'dl', label: 'Definition List', labelZh: '定义列表', description: 'Term and definition list', category: 'block', kind: 'block', pmNodeType: 'dita_dl', keywords: ['glossary', 'terms', '定义列表'] },
  { tag: 'dlentry', label: 'Definition Entry', labelZh: '定义条目', description: 'Term (dt) + description (dd) pair', category: 'block', kind: 'block', pmNodeType: 'dita_dlentry', keywords: ['条目'] },
  { tag: 'dt', label: 'Definition Term', labelZh: '术语名', description: 'Term defined in a dlentry', category: 'block', kind: 'block', pmNodeType: 'dita_dt' },
  { tag: 'dd', label: 'Definition Desc', labelZh: '术语解释', description: 'Explanation for a definition term', category: 'block', kind: 'block', pmNodeType: 'dita_dd' },
  { tag: 'codeblock', label: 'Code Block', labelZh: '代码块', description: 'Preformatted multi-line code snippet (preserves whitespace)', category: 'block', kind: 'block', pmNodeType: 'dita_codeblock', keywords: ['code', 'snippet', '代码'] },
  { tag: 'pre', label: 'Preformatted', labelZh: '预格式化文本', description: 'Whitespace-preserving preformatted text block', category: 'block', kind: 'block', pmNodeType: 'dita_pre', keywords: ['verbatim', '预格式'] },
  { tag: 'fig', label: 'Figure', labelZh: '插图容器', description: 'Titled figure wrapper for images or code', category: 'block', kind: 'block', pmNodeType: 'dita_fig', keywords: ['image', 'diagram', '图片', '插图'] },
  { tag: 'desc', label: 'Description', labelZh: '说明文字', description: 'Caption or description for a figure or table', category: 'block', kind: 'block', pmNodeType: 'dita_desc', keywords: ['caption', '说明'] },

  // Tables
  { tag: 'simpletable', label: 'Simple Table', labelZh: '简单表格', description: 'Lightweight uniform-column DITA table', category: 'table', kind: 'block', pmNodeType: 'dita_simpletable', keywords: ['table', 'grid', '简单表格'] },
  { tag: 'sthead', label: 'Simple Table Head', labelZh: '简单表头行', description: 'Header row in a simpletable', category: 'table', kind: 'block', pmNodeType: 'dita_sthead' },
  { tag: 'strow', label: 'Simple Table Row', labelZh: '简单表行', description: 'Body row in a simpletable', category: 'table', kind: 'block', pmNodeType: 'dita_strow' },
  { tag: 'stentry', label: 'Simple Table Cell', labelZh: '简单单元格', description: 'Cell inside sthead or strow', category: 'table', kind: 'block', pmNodeType: 'dita_stentry' },
  { tag: 'table', label: 'CALS Table', labelZh: 'CALS 复杂表格', description: 'OASIS CALS table supporting title, colspec, and merged cells', category: 'table', kind: 'block', pmNodeType: 'cals_table', keywords: ['cals', 'merge', 'colspan', 'rowspan', '表格'] },
  { tag: 'tgroup', label: 'Table Group', labelZh: 'CALS 表体组', description: 'Column group containing colspec, thead, and tbody', category: 'table', kind: 'block', pmNodeType: 'cals_tgroup' },
  { tag: 'colspec', label: 'Column Spec', labelZh: '列规格', description: 'Defines column name, number, width, and alignment', category: 'table', kind: 'block', pmNodeType: 'cals_colspec' },
  { tag: 'thead', label: 'Table Head', labelZh: '表头区', description: 'Header rows section of a CALS table', category: 'table', kind: 'block', pmNodeType: 'cals_thead' },
  { tag: 'tbody', label: 'Table Body', labelZh: '表体区', description: 'Body rows section of a CALS table', category: 'table', kind: 'block', pmNodeType: 'cals_tbody' },
  { tag: 'row', label: 'Table Row', labelZh: '表格行', description: 'Row inside CALS thead or tbody', category: 'table', kind: 'block', pmNodeType: 'cals_row' },
  { tag: 'entry', label: 'Table Cell', labelZh: '表格单元格', description: 'Cell inside a CALS row (supports namest/nameend/morerows)', category: 'table', kind: 'block', pmNodeType: 'cals_entry' },

  // Inline elements
  { tag: 'b', label: 'Bold', labelZh: '粗体', description: 'Bold emphasis', category: 'inline', kind: 'inline', pmNodeType: 'dita_b', shortcut: '⌘B', keywords: ['strong', '加粗'] },
  { tag: 'i', label: 'Italic', labelZh: '斜体', description: 'Italic emphasis', category: 'inline', kind: 'inline', pmNodeType: 'dita_i', shortcut: '⌘I', keywords: ['em', '斜体'] },
  { tag: 'u', label: 'Underline', labelZh: '下划线', description: 'Underlined text', category: 'inline', kind: 'inline', pmNodeType: 'dita_u', shortcut: '⌘U', keywords: ['下划线'] },
  { tag: 'codeph', label: 'Code Phrase', labelZh: '行内代码', description: 'Inline code snippet', category: 'inline', kind: 'inline', pmNodeType: 'dita_codeph', shortcut: '⌘E', keywords: ['code', 'inline', '代码'] },
  { tag: 'xref', label: 'Cross-Reference', labelZh: '交叉引用', description: 'Link to another topic, element, or external URL', category: 'inline', kind: 'inline', pmNodeType: 'dita_xref', shortcut: '⌘K', keywords: ['link', 'href', '引用', '链接'] },
  { tag: 'uicontrol', label: 'UI Control', labelZh: '界面控件', description: 'Button, menu item, or UI field label', category: 'inline', kind: 'inline', pmNodeType: 'dita_uicontrol', keywords: ['ui', 'button', '控件'] },
  { tag: 'filepath', label: 'File Path', labelZh: '文件路径', description: 'File or directory path', category: 'inline', kind: 'inline', pmNodeType: 'dita_filepath', keywords: ['path', 'file', '路径'] },
  { tag: 'varname', label: 'Variable', labelZh: '变量占位', description: 'Placeholder variable replaced by the reader', category: 'inline', kind: 'inline', pmNodeType: 'dita_varname', keywords: ['var', 'placeholder', '变量'] },
  { tag: 'ph', label: 'Phrase', labelZh: '语义短语', description: 'Reusable inline phrase container (conref/keyref/profiling)', category: 'inline', kind: 'inline', pmNodeType: 'dita_ph', keywords: ['span', 'reuse', '短语'] },
  { tag: 'keyword', label: 'Keyword', labelZh: '关键字/变量', description: 'Inline keyword or keyref variable reference', category: 'inline', kind: 'inline', pmNodeType: 'dita_keyword', keywords: ['keyref', 'var', '关键字'] },
  { tag: 'cmdname', label: 'Command Name', labelZh: '命令名', description: 'CLI command name', category: 'inline', kind: 'inline', pmNodeType: 'dita_cmdname', keywords: ['cli', '命令'] },
  { tag: 'parmname', label: 'Parameter Name', labelZh: '参数名', description: 'API or CLI parameter name', category: 'inline', kind: 'inline', pmNodeType: 'dita_parmname', keywords: ['param', 'arg', '参数'] },
  { tag: 'userinput', label: 'User Input', labelZh: '用户输入', description: 'Literal text typed by the user', category: 'inline', kind: 'inline', pmNodeType: 'dita_userinput', keywords: ['kbd', 'input', '输入'] },
  { tag: 'systemoutput', label: 'System Output', labelZh: '系统输出', description: 'Output returned by a system or terminal', category: 'inline', kind: 'inline', pmNodeType: 'dita_systemoutput', keywords: ['output', 'stdout', '输出'] },
  { tag: 'wintitle', label: 'Window Title', labelZh: '窗口标题', description: 'Dialog, panel, or window title', category: 'inline', kind: 'inline', pmNodeType: 'dita_wintitle', keywords: ['window', 'dialog', '窗口'] },
  { tag: 'menucascade', label: 'Menu Cascade', labelZh: '级联菜单', description: 'Sequence of UI menu navigation steps', category: 'inline', kind: 'inline', pmNodeType: 'dita_menucascade', keywords: ['menu', 'breadcrumb', '菜单路径'] },
  { tag: 'term', label: 'Term', labelZh: '术语引用', description: 'Glossary or technical term reference', category: 'inline', kind: 'inline', pmNodeType: 'dita_term', keywords: ['glossary', '术语'] },
  { tag: 'option', label: 'CLI Option', labelZh: '命令选项', description: 'Command-line flag or option', category: 'inline', kind: 'inline', pmNodeType: 'dita_option', keywords: ['flag', '选项'] },
  { tag: 'apiname', label: 'API Name', labelZh: 'API 名称', description: 'Endpoint, class, or function name', category: 'inline', kind: 'inline', pmNodeType: 'dita_apiname', keywords: ['api', 'endpoint', '接口'] },
  { tag: 'fn', label: 'Footnote', labelZh: '脚注', description: 'Inline footnote annotation', category: 'inline', kind: 'inline', pmNodeType: 'dita_fn', keywords: ['footnote', '脚注'] },
  { tag: 'cite', label: 'Citation', labelZh: '引用标题', description: 'Title of a referenced book, standard, or document', category: 'inline', kind: 'inline', pmNodeType: 'dita_cite', keywords: ['citation', 'book', '引用'] },
  // `<alt>` stays a lossless passthrough node: it lives inside `<image>`, whose children keep
  // their source whitespace layout, so a dedicated PM node type would reflow golden files.
  { tag: 'alt', label: 'Alternate Text', labelZh: '替代文本', description: 'Accessible text for an image or object (lossless passthrough)', category: 'inline', kind: 'inline', keywords: ['a11y', 'accessibility', '替代文本'] },
  { tag: 'msgnum', label: 'Message Number', labelZh: '错误码', description: 'Error or message code shown to the user', category: 'inline', kind: 'inline', pmNodeType: 'dita_msgnum', keywords: ['error', 'code', '错误码'] },
  { tag: 'proptypehd', label: 'Property Type Header', labelZh: '属性类型表头', description: 'Header cell for the type column of a properties table', category: 'table', kind: 'inline', pmNodeType: 'dita_proptypehd', keywords: ['header', '表头'] },
  { tag: 'propvaluehd', label: 'Property Value Header', labelZh: '属性值表头', description: 'Header cell for the value column of a properties table', category: 'table', kind: 'inline', pmNodeType: 'dita_propvaluehd', keywords: ['header', '表头'] },
  { tag: 'propdeschd', label: 'Property Description Header', labelZh: '属性说明表头', description: 'Header cell for the description column of a properties table', category: 'table', kind: 'inline', pmNodeType: 'dita_propdeschd', keywords: ['header', '表头'] },
  { tag: 'proptype', label: 'Property Type', labelZh: '属性类型', description: 'Data type of a parameter, e.g. integer or string', category: 'table', kind: 'inline', pmNodeType: 'dita_proptype', keywords: ['type', '类型'] },
  { tag: 'propvalue', label: 'Property Value', labelZh: '属性值', description: 'Default or allowed value of a parameter', category: 'table', kind: 'inline', pmNodeType: 'dita_propvalue', keywords: ['value', '取值'] },
  { tag: 'propdesc', label: 'Property Description', labelZh: '属性说明', description: 'Explanation of a parameter', category: 'table', kind: 'inline', pmNodeType: 'dita_propdesc', keywords: ['description', '说明'] },
  { tag: 'image', label: 'Image', labelZh: '图片', description: 'Referenced image asset (inline or placement="break")', category: 'block', kind: 'inline', pmNodeType: 'dita_image_block', keywords: ['img', 'graphic', '图片'] },
];

export const DITA_ELEMENT_SPECS: ReadonlyMap<string, DitaElementSpec> = new Map(
  ELEMENT_SPEC_LIST.map((spec) => [spec.tag, spec]),
);

// ---------------------------------------------------------------------------
// Bilingual display helpers (Phase 8)
// ---------------------------------------------------------------------------

export const DITA_CATEGORY_LABELS: Readonly<Record<UiLocale, Readonly<Record<DitaElementCategory, string>>>> = {
  'zh-CN': {
    topic: '主题根元素',
    map: 'Map 地图',
    structure: '结构分区',
    task: '任务流程',
    block: '块级内容',
    table: '表格',
    inline: '行内元素',
    metadata: '元数据',
  },
  en: {
    topic: 'Topic Roots',
    map: 'Map',
    structure: 'Structure',
    task: 'Task Flow',
    block: 'Block Content',
    table: 'Tables',
    inline: 'Inline Elements',
    metadata: 'Metadata',
  },
};

const ELEMENT_DESCRIPTIONS_ZH: Readonly<Record<string, string>> = {
  topic: '基础 DITA 主题根元素',
  concept: '回答“是什么”与“为什么”的概念说明主题',
  task: '分步骤的操作任务指南',
  reference: '结构化规格、参数与表格速查主题',
  map: '组织主题与子地图的根导航地图',
  topicref: '引用一个 DITA 主题或嵌套子主题引用',
  mapref: '在此层级引用子 .ditamap',
  topichead: '不带目标主题文件的纯标题导航节点',
  topicgroup: '共享属性或 collection-type 的无标题逻辑分组',
  keydef: '将 key 名称绑定到目标或内联关键字的资源型定义',
  topicmeta: '地图条目的导航标题、关键字与元数据',
  navtitle: '覆盖目录与 Map 树中显示的标题',
  reltable: '定义主题之间非层级性的相关链接',
  title: '主题、章节、插图或表格的标题',
  titlealts: '目录与检索使用的替代标题组',
  searchtitle: '供检索系统使用的标题',
  shortdesc: '用于预览与搜索的简明主题摘要',
  prolog: '作者、日期、关键字与主题元数据',
  'related-links': '指向相关主题的交叉引用',
  link: 'related-links 中的单条相关主题链接',
  linklist: '带标题的一组相关链接',
  linkpool: '不带标题的链接容器，通常由关系表自动填充',
  linkinfo: '链接列表之后的补充说明段落',
  linktext: '覆盖目标主题标题的链接文字',
  body: '基础主题的正文',
  conbody: '概念主题的正文',
  taskbody: '任务主题的结构化正文',
  refbody: '参考主题的正文',
  section: '主题正文中带标题的组织分区',
  bodydiv: '不带标题的正文分组容器，可为整组元素赋予 id 以便复用',
  example: '用于说明概念、任务或参考用法的示例块',
  refsyn: '参考主题中的语法签名或端点块',
  refbodydiv: '在不添加标题的前提下成组参考正文的块（DITA 1.3）',
  prereq: '执行任务前需要满足的条件',
  context: '操作流程的背景说明',
  steps: '按顺序编号的操作步骤',
  'steps-unordered': '不要求顺序的操作步骤',
  step: '包含指令（cmd）的单个操作步骤',
  cmd: '步骤中必须执行的操作指令',
  info: '补充解释该步骤的额外细节',
  substeps: '步骤内部嵌套的有序子步骤',
  substep: '带 cmd 的单个嵌套子步骤',
  choices: '完成步骤的可选分支',
  choice: 'choices 中的单个分支选项',
  stepxmp: '说明步骤的具体示例',
  stepresult: '完成步骤后的预期结果',
  result: '任务整体的预期结果',
  postreq: '完成任务后的后续操作',
  p: '标准文本段落',
  note: '提示框（note、tip、caution、warning、danger）',
  ul: '无序项目符号列表',
  ol: '有序编号列表',
  li: 'ul 或 ol 中的列表项',
  dl: '术语与定义列表',
  dlentry: '术语（dt）与解释（dd）的配对',
  dt: 'dlentry 中定义的术语',
  dd: '定义术语的说明',
  codeblock: '保留空白的多行代码片段（预格式化）',
  pre: '保留空白的预格式化文本块',
  fig: '承载图片或代码的带标题插图容器',
  desc: '插图或表格的题注与说明',
  simpletable: '轻量级等列 DITA 简单表格',
  sthead: '简单表格的表头行',
  strow: '简单表格的表体行',
  stentry: 'sthead 或 strow 中的单元格',
  properties: '由“类型 / 取值 / 说明”组成的参数表（至少一行）',
  prophead: '属性表可选的表头行',
  property: '属性表中的一行参数',
  proptypehd: '属性表“类型”列表头',
  propvaluehd: '属性表“取值”列表头',
  propdeschd: '属性表“说明”列表头',
  proptype: '参数的数据类型',
  propvalue: '参数的默认值或可选值',
  propdesc: '参数的用途说明',
  msgnum: '展示给用户的错误码或消息编号',
  table: '支持标题、colspec 与合并单元格的 OASIS CALS 表格',
  tgroup: '包含 colspec、thead 与 tbody 的列表组',
  colspec: '定义列名、序号、宽度与对齐方式',
  thead: 'CALS 表格的表头行区域',
  tbody: 'CALS 表格的表体行区域',
  row: 'CALS thead 或 tbody 中的表格行',
  entry: 'CALS 行中的单元格（支持 namest/nameend/morerows）',
  b: '粗体强调',
  i: '斜体强调',
  u: '下划线文本',
  codeph: '行内代码片段',
  xref: '指向其他主题、元素或外部 URL 的链接',
  uicontrol: '按钮、菜单项或界面控件标签',
  filepath: '文件或目录路径',
  varname: '由读者替换的变量占位符',
  ph: '可复用的行内短语容器（conref/keyref/条件属性）',
  keyword: '行内关键字或 keyref 变量引用',
  cmdname: '命令行命令名',
  parmname: 'API 或命令行参数名',
  userinput: '用户输入的原始文本',
  systemoutput: '系统或终端返回的输出',
  wintitle: '对话框、面板或窗口标题',
  menucascade: '依次导航的 UI 菜单路径',
  term: '术语表或技术术语引用',
  option: '命令行标志或选项',
  apiname: '端点、类或函数名',
  fn: '行内脚注注释',
  image: '引用的图片资源（行内或 placement="break"）',
};

export function getElementLabel(spec: DitaElementSpec, locale: UiLocale = 'zh-CN'): string {
  return locale === 'en' ? spec.label : spec.labelZh;
}

export function getElementDescription(
  spec: DitaElementSpec,
  locale: UiLocale = 'zh-CN',
): string {
  return locale === 'en' ? spec.description : (spec.descriptionZh ?? ELEMENT_DESCRIPTIONS_ZH[spec.tag] ?? spec.description);
}

export function getAttributeLabel(spec: DitaAttributeSpec, locale: UiLocale = 'zh-CN'): string {
  return locale === 'en' ? spec.label : (spec.labelZh ?? ATTRIBUTE_LABELS_ZH[spec.name] ?? spec.label);
}

export function getAttributeDescription(
  spec: DitaAttributeSpec,
  locale: UiLocale = 'zh-CN',
): string {
  return locale === 'en'
    ? spec.description
    : (spec.descriptionZh ?? ATTRIBUTE_DESCRIPTIONS_ZH[spec.name] ?? spec.description);
}

export function getAttributePlaceholder(
  spec: DitaAttributeSpec,
  locale: UiLocale = 'zh-CN',
): string | undefined {
  return locale === 'en' ? spec.placeholder : (spec.placeholderZh ?? spec.placeholder);
}

const ATTRIBUTE_LABELS_ZH: Readonly<Record<string, string>> = {
  id: 'ID',
  outputclass: '输出类',
  'xml:lang': '语言',
  translate: '可翻译',
  status: '状态',
  dir: '文本方向',
  audience: '受众',
  platform: '平台',
  product: '产品',
  otherprops: '其他属性',
  props: '条件属性',
  rev: '修订版本',
  conref: '内容引用',
  conkeyref: '键内容引用',
  conrefend: '引用结束',
  conaction: '内容引用动作',
  href: '目标链接',
  navtitle: '导航标题',
  keys: '键名',
  keyref: '键引用',
  keyscope: '键作用域',
  format: '格式',
  scope: '范围',
  type: '目标类型',
  'processing-role': '处理角色',
  toc: '包含在目录',
  linking: '链接规则',
  'collection-type': '集合类型',
  chunk: '分块指令',
  'copy-to': '复制到',
  locktitle: '锁定标题',
  title: '地图标题属性',
  othertype: '自定义类型',
  role: '关联角色',
  alt: '替代文本',
  placement: '放置方式',
  align: '对齐方式',
  width: '宽度',
  height: '高度',
  scalefit: '缩放适应',
  'xml:space': 'XML 空白',
  scale: '字号缩放 (%)',
  frame: '边框',
  importance: '重要性',
  relcolwidth: '相对列宽',
  keycol: '关键列',
  colsep: '列分隔线',
  rowsep: '行分隔线',
  pgwide: '占满页宽',
  cols: '列数',
  colnum: '列序号',
  colname: '列名',
  colwidth: '列宽',
  namest: '跨列起点',
  nameend: '跨列终点',
  morerows: '跨行数',
  valign: '垂直对齐',
  callout: '脚注符号',
};

const ATTRIBUTE_DESCRIPTIONS_ZH: Readonly<Record<string, string>> = {
  id: '用于交叉引用（xref）与内容复用（conref）的唯一标识符',
  outputclass: '传递给 HTML5/PDF 输出的 CSS 或发布角色提示',
  'xml:lang': 'BCP-47 语言标签（例如 zh-CN、en-US）',
  translate: '指示元素文本是否参与本地化',
  status: '编辑修订状态',
  dir: '双向文本覆盖方向',
  audience: '用于 DITAVAL 过滤的目标读者角色',
  platform: '目标操作系统或运行时平台',
  product: '目标产品版本或 SKU',
  otherprops: '自定义条件筛选标记',
  props: '基础条件属性',
  rev: '用于变更标记的产品/文档修订标识',
  conref: '直接内容引用（file.dita#topicId/elemId）',
  conkeyref: '基于 key 的内容引用（key/elemId）',
  conrefend: '区间内容引用的结束目标',
  conaction: '内容引用推送动作',
  href: '指向目标 .dita 主题、子地图或资源的相对路径',
  navtitle: '目录中显示的标题',
  keys: '绑定到该条目的 key 名称（空格分隔）',
  keyref: '通过根 Map 解析的间接键引用',
  keyscope: '嵌套 key 定义的作用域前缀',
  format: '目标文档格式',
  scope: '目标资源范围',
  type: '目标主题或元素类型',
  'processing-role': '条目出现在正常输出中或仅作为资源',
  toc: '条目是否包含在目录中',
  linking: '控制自动相关链接的生成方式',
  'collection-type': '子主题引用之间的同级关系语义',
  chunk: '输出分块指令（例如 to-content、by-topic）',
  'copy-to': '复用主题实例的备用输出文件名',
  locktitle: '在目录中使用 navtitle 而非目标主题标题',
  title: '旧版 @title 属性（建议改用 <title> 元素）',
  othertype: 'type="other" 时的自定义标签',
  role: '关联关系角色',
  alt: '用于无障碍访问的替代文本',
  placement: '行内流或独立块级放置',
  align: '水平对齐方式',
  width: '显示宽度（例如 480px、80%）',
  height: '显示高度',
  scalefit: '按容器边界缩放图片',
  'xml:space': '空白处理模式',
  scale: '相对字号百分比',
  frame: '边框样式',
  importance: '将步骤标记为可选或必需',
  relcolwidth: '空格分隔的比例列宽（例如 1* 2* 3*）',
  keycol: '作为行标题的列序号（从 1 开始）',
  colsep: '显示垂直列分隔线',
  rowsep: '显示水平行分隔线',
  pgwide: '在 PDF 中占满整页宽度',
  cols: '此 CALS tgroup 的列数',
  colnum: '列序号（从 1 开始）',
  colname: 'namest/nameend 使用的符号列名（例如 c1）',
  colwidth: '比例或固定列宽（例如 1.5*、120pt）',
  namest: '水平跨列的起始列名',
  nameend: '水平跨列的结束列名',
  morerows: '垂直跨行的额外行数（rowspan - 1）',
  valign: '单元格垂直对齐方式',
  callout: '自定义脚注标记符号（例如 *、a、1）',
};

export function getElementSpec(tagName: string): DitaElementSpec | undefined {
  return DITA_ELEMENT_SPECS.get(tagName);
}

/**
 * Children that are legal only in the unconstrained task shells (`generalTask.dtd` /
 * `ditabase.dtd`) — the strict `task.dtd` forbids them inside `<taskbody>`.
 */
export const GENERAL_TASK_CONTENT_MODEL: Readonly<Record<string, readonly string[]>> = {
  taskbody: [
    'prereq',
    'context',
    'section',
    'steps',
    'steps-unordered',
    'steps-informal',
    'result',
    'tasktroubleshooting',
    'example',
    'postreq',
  ],
};

export function getAllowedChildElementTags(
  parentTag: string,
  taskModel: TaskContentModel = 'strict',
): readonly string[] {
  const override = taskModel === 'general' ? GENERAL_TASK_CONTENT_MODEL[parentTag] : undefined;
  return override ?? DITA_CONTENT_MODEL[parentTag] ?? [];
}

export function isChildAllowed(
  parentTag: string,
  childTag: string,
  taskModel: TaskContentModel = 'strict',
): boolean {
  const allowed = getAllowedChildElementTags(parentTag, taskModel);
  if (allowed.length === 0 && !DITA_CONTENT_MODEL[parentTag]) {
    return true; // Permissive for unknown/specialized passthrough containers
  }
  return allowed.includes(childTag);
}

export function getAllowedChildElements(
  parentTag: string,
  filterKind: 'block' | 'inline' | 'all' = 'all',
  taskModel: TaskContentModel = 'strict',
): DitaElementSpec[] {
  const tags = getAllowedChildElementTags(parentTag, taskModel);
  const result: DitaElementSpec[] = [];
  for (const tag of tags) {
    const spec = DITA_ELEMENT_SPECS.get(tag);
    if (!spec) continue;
    // `image` can appear in both block and inline positions
    if (filterKind === 'block' && spec.kind !== 'block' && tag !== 'image') continue;
    if (filterKind === 'inline' && spec.kind !== 'inline') continue;
    result.push(spec);
  }
  return result;
}

// ---------------------------------------------------------------------------
// DITA 1.3 Attribute Metadata Registry
// ---------------------------------------------------------------------------

const UNIVERSAL_CORE_ATTRS: readonly DitaAttributeSpec[] = [
  { name: 'id', label: 'ID', group: 'core', description: 'Unique identifier for cross-references (xref) and reuse (conref)', placeholder: 'e.g. sec_overview' },
  { name: 'outputclass', label: 'Output Class', group: 'core', description: 'CSS/publishing role hint passed through to HTML5/PDF output', placeholder: 'e.g. highlight' },
  { name: 'xml:lang', label: 'Language', group: 'core', description: 'BCP-47 language tag (e.g. zh-CN, en-US)', values: ['zh-CN', 'en-US', 'ja-JP', 'de-DE'] },
  { name: 'translate', label: 'Translate', group: 'core', description: 'Indicates whether element text should be localized', values: ['yes', 'no'] },
  { name: 'status', label: 'Status', group: 'core', description: 'Editorial revision status', values: ['new', 'changed', 'deleted', 'unchanged'] },
  { name: 'dir', label: 'Text Direction', group: 'core', description: 'Bidirectional text override', values: ['ltr', 'rtl', 'lro', 'rlo'] },
];

const PROFILING_ATTRS: readonly DitaAttributeSpec[] = [
  { name: 'audience', label: 'Audience', group: 'profiling', description: 'Target reader role for DITAVAL filtering (space-separated)', placeholder: 'e.g. admin developer' },
  { name: 'platform', label: 'Platform', group: 'profiling', description: 'Target OS or runtime platform', placeholder: 'e.g. linux macos' },
  { name: 'product', label: 'Product', group: 'profiling', description: 'Target product edition or SKU', placeholder: 'e.g. enterprise cloud' },
  { name: 'otherprops', label: 'Other Props', group: 'profiling', description: 'Custom conditional profiling tokens', placeholder: 'e.g. beta' },
  { name: 'props', label: 'Props', group: 'profiling', description: 'Base conditional profiling attribute' },
  { name: 'rev', label: 'Revision', group: 'profiling', description: 'Product/document revision identifier for change flagging', placeholder: 'e.g. 2.1' },
];

const REUSE_ATTRS: readonly DitaAttributeSpec[] = [
  { name: 'conref', label: 'Conref', group: 'reuse', description: 'Direct content reference (file.dita#topicId/elemId)', placeholder: 'shared.dita#reuse/note_1' },
  { name: 'conkeyref', label: 'Conkeyref', group: 'reuse', description: 'Key-based content reference (key/elemId)', placeholder: 'shared_notes/note_1' },
  { name: 'conrefend', label: 'Conref End', group: 'reuse', description: 'End target for a range content reference' },
  { name: 'conaction', label: 'Conaction', group: 'reuse', description: 'Content reference push action', values: ['mark', 'pushafter', 'pushbefore', 'pushreplace', '-dita-use-conref-target'] },
];

const MAP_ENTRY_COMMON_ATTRS: readonly DitaAttributeSpec[] = [
  { name: 'href', label: 'Target Href', group: 'element', description: 'Relative path to target .dita topic, sub-map, or resource', placeholder: 'concepts/overview.dita' },
  { name: 'navtitle', label: 'Navigation Title', group: 'element', description: 'Display title in Table of Contents (TOC)', placeholder: '章节导航标题' },
  { name: 'keys', label: 'Keys', group: 'element', description: 'Space-separated key names bound to this entry', placeholder: 'e.g. prod_overview' },
  { name: 'keyref', label: 'Keyref', group: 'element', description: 'Indirect key reference resolved via Root Map', placeholder: 'key_name' },
  { name: 'keyscope', label: 'Key Scope', group: 'element', description: 'Scoped namespace prefix for nested key definitions', placeholder: 'e.g. cloud' },
  { name: 'format', label: 'Format', group: 'element', description: 'Target document format', values: ['dita', 'ditamap', 'html', 'pdf', 'markdown', 'png', 'svg'] },
  { name: 'scope', label: 'Scope', group: 'element', description: 'Target resource scope', values: ['local', 'peer', 'external'] },
  { name: 'type', label: 'Target Type', group: 'element', description: 'Target topic root type', values: ['topic', 'concept', 'task', 'reference', 'glossentry'] },
  { name: 'processing-role', label: 'Processing Role', group: 'element', description: 'Whether entry appears in normal output or is resource-only', values: ['normal', 'resource-only'] },
  { name: 'toc', label: 'Include in TOC', group: 'element', description: 'Whether entry is included in Table of Contents', values: ['yes', 'no'] },
  { name: 'linking', label: 'Linking', group: 'element', description: 'Controls automatic related-links generation', values: ['targetonly', 'sourceonly', 'normal', 'none'] },
  { name: 'collection-type', label: 'Collection Type', group: 'element', description: 'Sibling relationship semantics for child topicrefs', values: ['unordered', 'sequence', 'choice', 'family'] },
  { name: 'chunk', label: 'Chunk', group: 'element', description: 'Output chunking directive (e.g. to-content, by-topic)', values: ['to-content', 'to-navigation', 'by-topic', 'by-document', 'select-topic', 'select-document', 'select-branch'] },
  { name: 'copy-to', label: 'Copy To', group: 'element', description: 'Alternate output filename for reused topic instances', placeholder: 'reuse-alias.dita' },
  { name: 'locktitle', label: 'Lock Title', group: 'element', description: 'Use navtitle instead of target topic title in TOC', values: ['yes', 'no'] },
];

const ELEMENT_SPECIFIC_ATTRS: Readonly<Record<string, readonly DitaAttributeSpec[]>> = {
  map: [
    { name: 'id', label: 'Map ID', group: 'element', description: 'Root map identifier', placeholder: 'product_manual' },
    { name: 'title', label: 'Map Title Attr', group: 'element', description: 'Legacy @title attribute (prefer <title> element)', placeholder: 'Product Guide' },
    { name: 'collection-type', label: 'Collection Type', group: 'element', description: 'Default sibling linking behavior', values: ['unordered', 'sequence', 'choice', 'family'] },
    { name: 'linking', label: 'Linking', group: 'element', description: 'Default linking rule', values: ['normal', 'targetonly', 'sourceonly', 'none'] },
    { name: 'chunk', label: 'Chunk', group: 'element', description: 'Root chunking directive', values: ['to-content', 'to-navigation', 'by-topic', 'by-document'] },
  ],
  topicref: MAP_ENTRY_COMMON_ATTRS,
  topicset: MAP_ENTRY_COMMON_ATTRS,
  mapref: [
    { name: 'href', label: 'Sub-map Href', group: 'element', required: true, description: 'Relative path to child .ditamap', placeholder: 'maps/getting-started.ditamap' },
    { name: 'format', label: 'Format', group: 'element', description: 'Sub-map format (typically ditamap)', values: ['ditamap', 'dita'] },
    { name: 'navtitle', label: 'Navigation Title', group: 'element', description: 'Optional display title' },
    { name: 'keyscope', label: 'Key Scope', group: 'element', description: 'Scoped namespace prefix for included map' },
    { name: 'scope', label: 'Scope', group: 'element', description: 'Target resource scope', values: ['local', 'peer', 'external'] },
    { name: 'processing-role', label: 'Processing Role', group: 'element', description: 'Processing role', values: ['normal', 'resource-only'] },
    { name: 'toc', label: 'Include in TOC', group: 'element', description: 'Include sub-map entries in TOC', values: ['yes', 'no'] },
  ],
  topichead: [
    { name: 'navtitle', label: 'Heading Title', group: 'element', required: true, description: 'Navigation heading label', placeholder: '快速入门' },
    { name: 'toc', label: 'Include in TOC', group: 'element', description: 'Include heading in TOC', values: ['yes', 'no'] },
    { name: 'collection-type', label: 'Collection Type', group: 'element', description: 'Relationship between child topics', values: ['unordered', 'sequence', 'choice', 'family'] },
    { name: 'linking', label: 'Linking', group: 'element', description: 'Automatic linking mode', values: ['normal', 'targetonly', 'sourceonly', 'none'] },
    { name: 'locktitle', label: 'Lock Title', group: 'element', description: 'Lock navtitle', values: ['yes', 'no'] },
  ],
  topicgroup: [
    { name: 'collection-type', label: 'Collection Type', group: 'element', description: 'Relationship between grouped entries', values: ['unordered', 'sequence', 'choice', 'family'] },
    { name: 'linking', label: 'Linking', group: 'element', description: 'Automatic linking mode', values: ['normal', 'targetonly', 'sourceonly', 'none'] },
    { name: 'toc', label: 'Include in TOC', group: 'element', description: 'Propagated TOC setting', values: ['yes', 'no'] },
  ],
  keydef: [
    { name: 'keys', label: 'Keys', group: 'element', required: true, description: 'Key name(s) defined by this entry', placeholder: 'prod_name' },
    { name: 'keyscope', label: 'Key Scope', group: 'element', description: 'Scoped namespace prefix for this key definition' },
    { name: 'href', label: 'Target Href', group: 'element', description: 'Optional target topic, image, or external URL', placeholder: 'https://example.com' },
    { name: 'format', label: 'Format', group: 'element', description: 'Target format', values: ['dita', 'ditamap', 'html', 'pdf', 'png', 'svg'] },
    { name: 'scope', label: 'Scope', group: 'element', description: 'Target scope', values: ['local', 'peer', 'external'] },
    { name: 'processing-role', label: 'Processing Role', group: 'element', description: 'Typically resource-only for keydef', values: ['resource-only', 'normal'] },
    { name: 'navtitle', label: 'Navigation Title', group: 'element', description: 'Optional descriptive label' },
  ],
  topic: [
    { name: 'id', label: 'Topic ID', group: 'element', required: true, description: 'Required root topic identifier', placeholder: 'topic_id' },
  ],
  concept: [
    { name: 'id', label: 'Concept ID', group: 'element', required: true, description: 'Required concept topic identifier', placeholder: 'concept_id' },
  ],
  task: [
    { name: 'id', label: 'Task ID', group: 'element', required: true, description: 'Required task topic identifier', placeholder: 'task_id' },
  ],
  reference: [
    { name: 'id', label: 'Reference ID', group: 'element', required: true, description: 'Required reference topic identifier', placeholder: 'ref_id' },
  ],
  note: [
    {
      name: 'type',
      label: 'Note Type',
      group: 'element',
      description: 'Semantic admonition severity',
      values: ['note', 'tip', 'important', 'remember', 'attention', 'caution', 'notice', 'warning', 'danger', 'restriction', 'fastpath', 'trouble', 'other'],
    },
    { name: 'othertype', label: 'Other Type', group: 'element', description: 'Custom label when type="other"' },
  ],
  xref: [
    { name: 'href', label: 'Target Href', group: 'element', description: 'Relative path, #topicId/elemId, or external URL', placeholder: 'target.dita or https://...' },
    { name: 'keyref', label: 'Keyref', group: 'element', description: 'Key name resolved via Root Map keyspace', placeholder: 'key_name' },
    { name: 'scope', label: 'Scope', group: 'element', description: 'Target resource scope', values: ['local', 'peer', 'external'] },
    { name: 'format', label: 'Format', group: 'element', description: 'Target media format', values: ['dita', 'html', 'pdf', 'ditamap', 'markdown'] },
    { name: 'type', label: 'Target Type', group: 'element', description: 'Target DITA element/topic type', values: ['topic', 'concept', 'task', 'reference', 'section', 'fig', 'table', 'li', 'fn'] },
  ],
  link: [
    { name: 'href', label: 'Href', group: 'element', description: 'Related topic path or URL', placeholder: '../concepts/overview.dita' },
    { name: 'keyref', label: 'Keyref', group: 'element', description: 'Key name resolved via Root Map' },
    { name: 'scope', label: 'Scope', group: 'element', description: 'Target resource scope', values: ['local', 'peer', 'external'] },
    { name: 'format', label: 'Format', group: 'element', description: 'Target file format', values: ['dita', 'html', 'pdf'] },
    { name: 'type', label: 'Target Type', group: 'element', description: 'Target topic type', values: ['topic', 'concept', 'task', 'reference'] },
    { name: 'role', label: 'Role', group: 'element', description: 'Relationship role', values: ['parent', 'child', 'sibling', 'friend', 'next', 'previous', 'other'] },
  ],
  image: [
    { name: 'href', label: 'Image Href', group: 'element', description: 'Relative path or URL to the image asset', placeholder: '../images/diagram.svg' },
    { name: 'keyref', label: 'Keyref', group: 'element', description: 'Key reference to an image resource' },
    { name: 'alt', label: 'Alt Text', group: 'element', description: 'Alternative text for accessibility' },
    { name: 'placement', label: 'Placement', group: 'element', description: 'Inline flow or standalone block', values: ['inline', 'break'] },
    { name: 'align', label: 'Alignment', group: 'element', description: 'Horizontal alignment for block images', values: ['left', 'center', 'right', 'current'] },
    { name: 'width', label: 'Width', group: 'element', description: 'Display width (e.g. 480px, 80%)' },
    { name: 'height', label: 'Height', group: 'element', description: 'Display height' },
    { name: 'scalefit', label: 'Scale to Fit', group: 'element', description: 'Scale image to fit container bounds', values: ['yes', 'no'] },
  ],
  codeblock: [
    {
      name: 'outputclass',
      label: 'Syntax Language',
      group: 'element',
      description: 'Language class for syntax highlighting',
      values: ['language-xml', 'language-bash', 'language-typescript', 'language-json', 'language-yaml', 'language-java', 'language-sql'],
    },
    { name: 'xml:space', label: 'XML Space', group: 'element', description: 'Whitespace handling mode', values: ['preserve'] },
    { name: 'scale', label: 'Font Scale (%)', group: 'presentation', description: 'Relative font size percentage', values: ['50', '60', '70', '80', '90', '100', '110', '120'] },
  ],
  pre: [
    { name: 'xml:space', label: 'XML Space', group: 'element', description: 'Whitespace handling mode', values: ['preserve'] },
    { name: 'frame', label: 'Frame', group: 'presentation', description: 'Border style', values: ['top', 'bottom', 'topbot', 'all', 'sides', 'none'] },
  ],
  keyword: [
    { name: 'keyref', label: 'Keyref', group: 'element', description: 'Variable key name resolved via Root Map', placeholder: 'prod_name' },
  ],
  ph: [
    { name: 'keyref', label: 'Keyref', group: 'element', description: 'Variable key name resolved via Root Map' },
  ],
  term: [
    { name: 'keyref', label: 'Glossary Keyref', group: 'element', description: 'Glossary entry key reference' },
  ],
  step: [
    { name: 'importance', label: 'Importance', group: 'element', description: 'Mark step as optional or required', values: ['optional', 'required'] },
  ],
  simpletable: [
    { name: 'relcolwidth', label: 'Relative Column Widths', group: 'element', description: 'Space-separated proportional widths (e.g. 1* 2* 3*)', placeholder: '1* 2* 3*' },
    { name: 'keycol', label: 'Key Column', group: 'element', description: '1-based column index treated as row headers' },
    { name: 'frame', label: 'Frame', group: 'presentation', description: 'Outer table border', values: ['top', 'bottom', 'topbot', 'all', 'sides', 'none'] },
  ],
  table: [
    { name: 'frame', label: 'Frame', group: 'element', description: 'Outer border style', values: ['all', 'topbot', 'top', 'bottom', 'sides', 'none'] },
    { name: 'colsep', label: 'Column Rules', group: 'element', description: 'Show vertical column dividers', values: ['1', '0'] },
    { name: 'rowsep', label: 'Row Rules', group: 'element', description: 'Show horizontal row dividers', values: ['1', '0'] },
    { name: 'pgwide', label: 'Page Wide', group: 'presentation', description: 'Span full page width in PDF', values: ['1', '0'] },
  ],
  tgroup: [
    { name: 'cols', label: 'Columns Count', group: 'element', required: true, description: 'Number of columns in this CALS tgroup' },
    { name: 'align', label: 'Default Align', group: 'element', description: 'Default horizontal alignment', values: ['left', 'center', 'right', 'justify', 'char'] },
  ],
  colspec: [
    { name: 'colnum', label: 'Column Number', group: 'element', description: '1-based column ordinal' },
    { name: 'colname', label: 'Column Name', group: 'element', description: 'Symbolic name used by namest/nameend (e.g. c1)' },
    { name: 'colwidth', label: 'Column Width', group: 'element', description: 'Proportional or fixed width (e.g. 1.5*, 120pt)' },
    { name: 'align', label: 'Alignment', group: 'element', description: 'Column text alignment', values: ['left', 'center', 'right', 'justify', 'char'] },
  ],
  entry: [
    { name: 'colname', label: 'Column Name', group: 'element', description: 'Target colspec name' },
    { name: 'namest', label: 'Span Start', group: 'element', description: 'Start column name for horizontal span' },
    { name: 'nameend', label: 'Span End', group: 'element', description: 'End column name for horizontal span' },
    { name: 'morerows', label: 'More Rows', group: 'element', description: 'Number of additional rows spanned vertically (rowspan - 1)' },
    { name: 'align', label: 'Horizontal Align', group: 'element', description: 'Cell horizontal alignment', values: ['left', 'center', 'right', 'justify'] },
    { name: 'valign', label: 'Vertical Align', group: 'element', description: 'Cell vertical alignment', values: ['top', 'middle', 'bottom'] },
  ],
  fn: [
    { name: 'callout', label: 'Callout Symbol', group: 'element', description: 'Custom footnote marker symbol (e.g. *, a, 1)' },
  ],
};

/**
 * Return deduplicated attribute metadata specs for a given DITA element tag,
 * ordered by element-specific -> core -> profiling -> reuse.
 */
export function getAttributesForElement(tagName: string): DitaAttributeSpec[] {
  const specific = ELEMENT_SPECIFIC_ATTRS[tagName] ?? [];
  const seen = new Set<string>();
  const merged: DitaAttributeSpec[] = [];

  for (const list of [specific, UNIVERSAL_CORE_ATTRS, PROFILING_ATTRS, REUSE_ATTRS]) {
    for (const spec of list) {
      if (seen.has(spec.name)) continue;
      seen.add(spec.name);
      merged.push(spec);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Order-Preserving RawAttrs Helpers (Never converts rawAttrs to unordered maps)
// ---------------------------------------------------------------------------

export function getRawAttr(rawAttrs: readonly XmlAttributeEntry[], name: string): string | undefined {
  return rawAttrs.find((a) => a.name === name)?.value;
}

/**
 * Set, update in-place, or remove (`value === null`) an attribute while strictly
 * preserving the original order of all other attributes.
 */
export function setRawAttr(
  rawAttrs: readonly XmlAttributeEntry[],
  name: string,
  value: string | null,
  namespaceURI: string | null = null,
): XmlAttributeEntry[] {
  const existingIdx = rawAttrs.findIndex((a) => a.name === name);
  if (value === null) {
    if (existingIdx === -1) return [...rawAttrs];
    return rawAttrs.filter((_, idx) => idx !== existingIdx);
  }

  if (existingIdx !== -1) {
    const existing = rawAttrs[existingIdx]!;
    if (existing.value === value) return [...rawAttrs];
    const next = [...rawAttrs];
    next[existingIdx] = { ...existing, value };
    return next;
  }

  return [...rawAttrs, { name, value, namespaceURI }];
}

export function removeRawAttr(
  rawAttrs: readonly XmlAttributeEntry[],
  name: string,
): XmlAttributeEntry[] {
  return rawAttrs.filter((a) => a.name !== name);
}
