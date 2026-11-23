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
  checkChildRemoval,
  ditaSchema,
  getElementSpec,
  getInsertionSlot,
  getPmChildTags,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  hasSequenceModel,
  isChildAllowed,
  MODELED_INLINE_TAGS,
  removeRawAttr,
  setRawAttr,
  type RawAttrs,
  type TaskContentModel,
} from '@dita/core';
import { resolveTaskModelForDocument } from '../structure-options';
import { findLegalAncestorDepthForBlock } from './selection-info';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import { buildConvertedBlock, isBlockMoveOrderSafe, planBlockMove } from './block-transforms';
import {
  findSharedInlineTextblock,
  flattenSameTypeInline,
  isCodeTextblock,
  sliceInlineContent,
} from './inline-selection';

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
  const isConrefSkeleton = initialAttrs.some(
    (a) => (a.name === 'conref' || a.name === 'conkeyref') && a.value.trim().length > 0,
  );

  // Inline modeled tags
  const inlineType = MODELED_INLINE_TAGS.get(tagName);
  if (inlineType) {
    if (
      !isConrefSkeleton &&
      tagName === 'menucascade' &&
      (!inlineContent || inlineContent.childCount === 0)
    ) {
      return makeNode(inlineType, initialAttrs, [
        makeNode('dita_uicontrol', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.menu'))]),
        makeNode('dita_uicontrol', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.option'))]),
      ]);
    }
    const type = ditaSchema.nodes[inlineType]!;
    return type.create({ rawAttrs: initialAttrs, namespaceURI: null }, inlineContent);
  }

  // Empty-container skeleton when inserting a block element carrying conref/conkeyref
  if (isConrefSkeleton) {
    const blockTypeMap: Record<string, string> = {
      p: 'dita_p',
      title: 'dita_title',
      shortdesc: 'dita_shortdesc',
      cmd: 'dita_cmd',
      dt: 'dita_dt',
      desc: 'dita_desc',
      dd: 'dita_dd',
      codeblock: 'dita_codeblock',
      pre: 'dita_pre',
      section: 'dita_section',
      example: 'dita_example',
      refsyn: 'dita_refsyn',
      note: 'dita_note',
      ul: 'dita_ul',
      ol: 'dita_ol',
      li: 'dita_li',
      dl: 'dita_dl',
      dlentry: 'dita_dlentry',
      fig: 'dita_fig',
      image: 'dita_image_block',
      prereq: 'dita_prereq',
      context: 'dita_context',
      steps: 'dita_steps',
      'steps-unordered': 'dita_steps_unordered',
      step: 'dita_step',
      substeps: 'dita_substeps',
      substep: 'dita_substep',
      choices: 'dita_choices',
      choice: 'dita_choice',
      info: 'dita_info',
      stepxmp: 'dita_stepxmp',
      stepresult: 'dita_stepresult',
      result: 'dita_result',
      postreq: 'dita_postreq',
      titlealts: 'dita_titlealts',
      navtitle: 'dita_navtitle',
      searchtitle: 'dita_searchtitle',
      'related-links': 'dita_related_links',
      link: 'dita_link',
      linklist: 'dita_linklist',
      linkpool: 'dita_linkpool',
      linkinfo: 'dita_linkinfo',
      prolog: 'dita_prolog',
      simpletable: 'dita_simpletable',
      table: 'cals_table',
      body: 'dita_body',
      bodydiv: 'dita_bodydiv',
      conbody: 'dita_conbody',
      conbodydiv: 'dita_conbodydiv',
      sectiondiv: 'dita_sectiondiv',
      taskbody: 'dita_taskbody',
      refbody: 'dita_refbody',
      refbodydiv: 'dita_refbodydiv',
      properties: 'dita_properties',
      abstract: 'dita_abstract',
      tasktroubleshooting: 'dita_tasktroubleshooting',
      'steps-informal': 'dita_steps_informal',
      stepsection: 'dita_stepsection',
      steptroubleshooting: 'dita_steptroubleshooting',
      tutorialinfo: 'dita_tutorialinfo',
      itemgroup: 'dita_itemgroup',
      choicetable: 'dita_choicetable',
    };
    const mappedType = blockTypeMap[tagName];
    if (mappedType) {
      const schemaType = ditaSchema.nodes[mappedType];
      if (schemaType && schemaType.contentMatch.validEnd) {
        return makeNode(mappedType, initialAttrs, []);
      }
    }
  }

  switch (tagName) {
    case 'p':
      return makeNode('dita_p', initialAttrs);
    case 'title':
      return makeNode('dita_title', initialAttrs);
    case 'shortdesc':
      return makeNode('dita_shortdesc', initialAttrs);
    // `<abstract>` is the multi-block alternative to `<shortdesc>`, so it starts with one paragraph.
    case 'abstract':
      return makeNode('dita_abstract', initialAttrs, [makeNode('dita_p')]);
    // Body wrappers: a topic can legitimately arrive without one (hand-edited XML, paste,
    // specialized shell topic), and every block element needs it as a legal insertion target.
    case 'body':
      return makeNode('dita_body', initialAttrs, [makeNode('dita_p')]);
    case 'conbody':
      return makeNode('dita_conbody', initialAttrs, [makeNode('dita_p')]);
    // `<conbodydiv>` may only hold `<section>` / `<example>`, so seed one titled section.
    case 'conbodydiv':
      return makeNode('dita_conbodydiv', initialAttrs, [
        makeNode('dita_section', EMPTY_ATTRS, [
          makeNode('dita_title'),
          makeNode('dita_p'),
        ]),
      ]);
    // `<sectiondiv>` groups blocks without adding a title.
    case 'sectiondiv':
      return makeNode('dita_sectiondiv', initialAttrs, [makeNode('dita_p')]);
    // Nested topics: each shell DTD narrows `%info-types;` to the topic's own type, so a concept
    // may hold concepts, a task tasks, and so on.
    case 'concept':
      return makeNode('dita_concept', initialAttrs, [
        makeNode('dita_title'),
        makeNode('dita_conbody', EMPTY_ATTRS, [makeNode('dita_p')]),
      ]);
    case 'topic':
      return makeNode('dita_topic', initialAttrs, [
        makeNode('dita_title'),
        makeNode('dita_body', EMPTY_ATTRS, [makeNode('dita_p')]),
      ]);
    case 'task':
      return makeNode('dita_task', initialAttrs, [
        makeNode('dita_title'),
        makeNode('dita_taskbody', EMPTY_ATTRS, [
          makeNode('dita_steps', EMPTY_ATTRS, [
            makeNode('dita_step', EMPTY_ATTRS, [makeNode('dita_cmd')]),
          ]),
        ]),
      ]);
    case 'reference':
      return makeNode('dita_reference', initialAttrs, [
        makeNode('dita_title'),
        makeNode('dita_refbody', EMPTY_ATTRS, [makeNode('dita_p')]),
      ]);
    case 'taskbody':
      // Strict task model forbids `<p>` directly inside `<taskbody>`, so seed the canonical
      // minimal workflow `<steps><step><cmd/></step></steps>` to give the user an editable slot.
      return makeNode('dita_taskbody', initialAttrs, [
        makeNode('dita_steps', EMPTY_ATTRS, [
          makeNode('dita_step', EMPTY_ATTRS, [makeNode('dita_cmd')]),
        ]),
      ]);
    case 'refbody':
      return makeNode('dita_refbody', initialAttrs, [makeNode('dita_refsyn', EMPTY_ATTRS, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.syntax'))]),
        makeNode('dita_codeblock'),
      ])]);
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
        makeNode('dita_title', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.sectionTitle'))]),
        makeNode('dita_p'),
      ]);
    case 'bodydiv':
      return makeNode('dita_bodydiv', initialAttrs, [makeNode('dita_p')]);
    case 'linklist':
      return makeNode('dita_linklist', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [
          textNode(translate(getCurrentLocale(), 'insertSample.linkListTitle')),
        ]),
        makeNode('dita_link', [
          { name: 'href', value: '../concepts/overview.dita', namespaceURI: null },
          { name: 'format', value: 'dita', namespaceURI: null },
        ]),
      ]);
    case 'linkpool':
      return makeNode('dita_linkpool', initialAttrs, [
        makeNode('dita_link', [
          { name: 'href', value: '../concepts/overview.dita', namespaceURI: null },
          { name: 'format', value: 'dita', namespaceURI: null },
        ]),
      ]);
    case 'linkinfo':
      return makeNode('dita_linkinfo', initialAttrs, [makeNode('dita_p')]);
    case 'example':
      return makeNode('dita_example', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.example'))]),
        makeNode('dita_p'),
      ]);
    case 'refsyn':
      return makeNode('dita_refsyn', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.syntax'))]),
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
          makeNode('dita_dt', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.term'))]),
          makeNode('dita_dd', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.definition'))])]),
        ]),
      ]);
    case 'dlentry':
      return makeNode('dita_dlentry', initialAttrs, [
        makeNode('dita_dt'),
        makeNode('dita_dd', EMPTY_ATTRS, [makeNode('xml_text_block')]),
      ]);
    case 'fig':
      return makeNode('dita_fig', initialAttrs, [
        makeNode('dita_title', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.figureTitle'))]),
        makeNode('dita_image_block', [
          { name: 'href', value: '../images/example.svg', namespaceURI: null },
          { name: 'placement', value: 'break', namespaceURI: null },
          { name: 'alt', value: translate(getCurrentLocale(), 'insertSample.diagramAlt'), namespaceURI: null },
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
    case 'tasktroubleshooting':
      return makeNode('dita_tasktroubleshooting', initialAttrs, [makeNode('dita_p')]);
    case 'steps-informal':
      return makeNode('dita_steps_informal', initialAttrs, [makeNode('dita_p')]);
    // `<stepsection>` is a title-like divider (`(listitem.cnt)*`), so it seeds bare text.
    case 'stepsection':
      return makeNode('dita_stepsection', initialAttrs, [makeNode('xml_text_block')]);
    case 'steptroubleshooting':
      return makeNode('dita_steptroubleshooting', initialAttrs, [makeNode('dita_p')]);
    case 'tutorialinfo':
      return makeNode('dita_tutorialinfo', initialAttrs, [makeNode('dita_p')]);
    case 'itemgroup':
      return makeNode('dita_itemgroup', initialAttrs, [makeNode('dita_p')]);
    // `<choicetable>` rows are lossless passthrough nodes (`choption` / `chdesc` carry the text).
    case 'choicetable':
      return makeNode('dita_choicetable', initialAttrs, [
        makeNode(
          'unknown_block',
          EMPTY_ATTRS,
          [
            makeNode(
              'unknown_block',
              EMPTY_ATTRS,
              [
                makeNode('xml_text_block', EMPTY_ATTRS, [
                  textNode(translate(getCurrentLocale(), 'insertSample.option')),
                ]),
              ],
              { tagName: 'choption', preserveWhitespace: false },
            ),
            makeNode(
              'unknown_block',
              EMPTY_ATTRS,
              [
                makeNode('xml_text_block', EMPTY_ATTRS, [
                  textNode(translate(getCurrentLocale(), 'insertSample.description')),
                ]),
              ],
              { tagName: 'chdesc', preserveWhitespace: false },
            ),
          ],
          { tagName: 'chrow', preserveWhitespace: false },
        ),
      ]);
    // The DITA 1.3 hazardstatement family is deliberately left unmodeled (it is the canonical
    // unknown/specialized passthrough regression fixture), so the skeleton is assembled from
    // `unknown_block` nodes that carry the exact DTD tag names and stay 100% lossless.
    case 'hazardstatement': {
      const attrs =
        initialAttrs.length > 0
          ? initialAttrs
          : [{ name: 'type', value: 'warning', namespaceURI: null }];
      const locale = getCurrentLocale();
      const hazardText = (key: 'insertSample.hazardType' | 'insertSample.hazardConsequence') =>
        makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(locale, key))]);
      return makeNode(
        'unknown_block',
        attrs,
        [
          makeNode(
            'unknown_block',
            EMPTY_ATTRS,
            [
              makeNode('unknown_block', EMPTY_ATTRS, [hazardText('insertSample.hazardType')], {
                tagName: 'typeofhazard',
                preserveWhitespace: false,
              }),
              makeNode('unknown_block', EMPTY_ATTRS, [hazardText('insertSample.hazardConsequence')], {
                tagName: 'consequence',
                preserveWhitespace: false,
              }),
              makeNode(
                'unknown_block',
                EMPTY_ATTRS,
                [
                  makeNode('dita_p', EMPTY_ATTRS, [
                    textNode(translate(locale, 'insertSample.hazardAvoid')),
                  ]),
                ],
                { tagName: 'howtoavoid', preserveWhitespace: false },
              ),
            ],
            { tagName: 'messagepanel', preserveWhitespace: false },
          ),
        ],
        { tagName: 'hazardstatement', preserveWhitespace: false },
      );
    }
    case 'titlealts':
      return makeNode('dita_titlealts', initialAttrs, [
        makeNode('dita_navtitle', EMPTY_ATTRS, [
          textNode(translate(getCurrentLocale(), 'insertSample.navTitle')),
        ]),
      ]);
    case 'navtitle':
      return makeNode('dita_navtitle', initialAttrs, [
        textNode(translate(getCurrentLocale(), 'insertSample.navTitle')),
      ]);
    case 'searchtitle':
      return makeNode('dita_searchtitle', initialAttrs, [
        textNode(translate(getCurrentLocale(), 'insertSample.searchTitle')),
      ]);
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
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.field'))])]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.type'))])]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.description'))])]),
          ]),
          makeNode('dita_strow', EMPTY_ATTRS, [
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block')]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block')]),
            makeNode('dita_stentry', EMPTY_ATTRS, [makeNode('xml_text_block')]),
          ]),
        ],
      );
    case 'refbodydiv':
      return makeNode('dita_refbodydiv', initialAttrs, [
        makeNode('dita_section', EMPTY_ATTRS, [
          makeNode('dita_title'),
          makeNode('dita_p'),
        ]),
      ]);
    // `properties` = `(prophead?, property+)`; seed one header row and one parameter row so the
    // three-column shape is visible right after insertion (reference.mod).
    case 'properties':
      return makeNode('dita_properties', initialAttrs, [
        makeNode('dita_prophead', EMPTY_ATTRS, [
          makeNode('dita_proptypehd', EMPTY_ATTRS, [
            textNode(translate(getCurrentLocale(), 'insertSample.propType')),
          ]),
          makeNode('dita_propvaluehd', EMPTY_ATTRS, [
            textNode(translate(getCurrentLocale(), 'insertSample.propValue')),
          ]),
          makeNode('dita_propdeschd', EMPTY_ATTRS, [
            textNode(translate(getCurrentLocale(), 'insertSample.description')),
          ]),
        ]),
        makeNode('dita_property', EMPTY_ATTRS, [
          makeNode('dita_proptype', EMPTY_ATTRS, [
            textNode(translate(getCurrentLocale(), 'insertSample.propTypeSample')),
          ]),
          makeNode('dita_propvalue', EMPTY_ATTRS, [
            textNode(translate(getCurrentLocale(), 'insertSample.propValueSample')),
          ]),
          makeNode('dita_propdesc', EMPTY_ATTRS, [
            textNode(translate(getCurrentLocale(), 'insertSample.description')),
          ]),
        ]),
      ]);
    // Header / body rows of a properties table (empty on purpose: the author fills the cells).
    case 'prophead':
      return makeNode('dita_prophead', initialAttrs);
    case 'property':
      return makeNode('dita_property', initialAttrs);
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
          makeNode('dita_title', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.calsCaption'))]),
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
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.column', { index: 1 }))])], { colspan: 1, rowspan: 1 }),
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.column', { index: 2 }))])], { colspan: 1, rowspan: 1 }),
                  makeNode('cals_entry', EMPTY_ATTRS, [makeNode('xml_text_block', EMPTY_ATTRS, [textNode(translate(getCurrentLocale(), 'insertSample.column', { index: 3 }))])], { colspan: 1, rowspan: 1 }),
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

/**
 * Resolve the sequence-correct insertion offset for `tagName` inside `containerNode`.
 *
 * When `preferredPos` (from the cursor or a clicked between-block `+` gap) already falls inside
 * the legal `[minIndex, maxIndex]` range — e.g. inserting a `<li>` or `<step>` in the middle of
 * a list — `preferredPos` is preserved verbatim. When it falls outside the legal range, the
 * insertion is re-anchored to the DTD-correct slot.
 */
function resolveSequenceAnchor(
  containerNode: PMNode,
  containerStart: number,
  containerTag: string,
  tagName: string,
  preferredPos: number,
  taskModel: TaskContentModel = 'strict',
): { ok: boolean; pos: number } {
  if (!hasSequenceModel(containerTag)) return { ok: true, pos: preferredPos };

  // Element children only: comments / PIs / xml_text wrappers are invisible to DITA content models.
  const elementChildren: { tag: string; pos: number; size: number }[] = [];
  let offset = containerStart;
  containerNode.forEach((child) => {
    const childTag = getPmNodeTagName(child);
    if (childTag) elementChildren.push({ tag: childTag, pos: offset, size: child.nodeSize });
    offset += child.nodeSize;
  });

  let preferredIndex = 0;
  for (const child of elementChildren) {
    if (child.pos + child.size <= preferredPos) {
      preferredIndex++;
    } else {
      break;
    }
  }

  const slot = getInsertionSlot(
    containerTag,
    elementChildren.map((child) => child.tag),
    tagName,
    preferredIndex,
    taskModel,
  );
  if (!slot.ok) return { ok: false, pos: -1 };
  if (slot.index === preferredIndex) {
    return { ok: true, pos: preferredPos };
  }
  const anchor = slot.index > 0 ? elementChildren[slot.index - 1] : undefined;
  return { ok: true, pos: anchor ? anchor.pos + anchor.size : containerStart };
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
    const containerTag = getPmNodeTagName(containerNode) ?? '';

    const preferredPos =
      $from.depth > containerDepth
        ? $from.after(containerDepth + 1)
        : $from.end(containerDepth);

    // Keep cursor-relative placement when valid (e.g. repeating lists/steps), or re-anchor to the
    // DTD-correct slot when out of order (title-first, prereq -> context -> steps -> result -> postreq, ...).
    const sequence = resolveSequenceAnchor(
      containerNode,
      containerStart,
      containerTag,
      tagName,
      preferredPos,
      resolveTaskModelForDocument(state.doc),
    );
    if (!sequence.ok) return false;
    const insertPos = sequence.pos;

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

    // Even for an explicit gap, keep ordered content models correct: a `+` divider sitting after
    // `<steps>` re-anchors `<prereq>` to its legal slot, while a gap between two `<step>` / `<li>`
    // items stays right where the user clicked.
    const $pos = state.doc.resolve(insertPos);
    const parentTag = getPmNodeTagName($pos.parent) ?? '';
    const sequence = resolveSequenceAnchor(
      $pos.parent,
      $pos.start($pos.depth),
      parentTag,
      tagName,
      insertPos,
      resolveTaskModelForDocument(state.doc),
    );
    if (!sequence.ok) return false;
    const targetPos = sequence.pos;

    if (!dispatch) return true;
    const tr = state.tr.insert(targetPos, newNode);
    selectFirstEditablePos(tr, targetPos, newNode);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Topic root -> its mandatory body wrapper. `body`/`conbody`/`taskbody`/`refbody` are the only
 * legal parents for prose blocks, so a topic that arrives without one cannot accept any content
 * until the wrapper exists.
 */
const TOPIC_BODY_WRAPPER: Readonly<Record<string, string>> = {
  topic: 'body',
  concept: 'conbody',
  task: 'taskbody',
  reference: 'refbody',
};

/**
 * Insert the topic root's missing body wrapper at its DTD-correct slot and focus its first
 * editable textblock. Returns false when the root is not a topic root or already has its wrapper.
 */
function insertMissingTopicBody(
  tr: Transaction,
  rootNode: PMNode,
  rootStart: number,
  rootTag: string,
  preferredPos: number,
  taskModel: TaskContentModel = 'strict',
): boolean {
  const bodyTag = TOPIC_BODY_WRAPPER[rootTag];
  if (!bodyTag) return false;
  if (getPmChildTags(rootNode).includes(bodyTag)) return false;
  const bodyNode = createDitaElementSkeleton(bodyTag);
  if (!bodyNode) return false;
  // Re-anchor to the legal slot so a body inserted while `<related-links>` is present still
  // lands before it.
  const anchor = resolveSequenceAnchor(
    rootNode,
    rootStart,
    rootTag,
    bodyTag,
    preferredPos,
    taskModel,
  );
  if (!anchor.ok) return false;
  tr.insert(anchor.pos, bodyNode);
  selectFirstEditablePos(tr, anchor.pos, bodyNode);
  return true;
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
 * Delete a specific DITA element at `nodePos`.
 *
 * The guard is the DITA 1.3 content model, not a tag whitelist: the document root, children of a
 * `required` slot (e.g. the `<cmd>` of a `<step>`) and the last item of a `oneOrMore` slot (e.g. the
 * only `<step>` of `<steps>`) are refused; everything else is deletable.
 */
export function deleteDitaNodeAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false; // Never delete the root element
    const node = state.doc.nodeAt(nodePos);
    if (!node) return false;
    const $pos = state.doc.resolve(nodePos);
    const parentTag = getPmNodeTagName($pos.parent) ?? '';
    const nodeTag = getPmNodeTagName(node) ?? '';
    if (
      checkChildRemoval(
        parentTag,
        nodeTag,
        getPmChildTags($pos.parent),
        resolveTaskModelForDocument(state.doc),
      )
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

    // Ordered content models (taskbody workflow slots, `<title>`-first containers, …) must keep
    // their slot order: swapping two neighbours is only legal when the reordered tags validate.
    const parentTag = getPmNodeTagName(parent) ?? '';
    if (!isBlockMoveOrderSafe(parentTag, getPmChildTags(parent), index, direction === 'up' ? index - 1 : index + 2)) {
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
 * Turn a block into another DITA block tag (Notion-style "Turn into"), keeping its text.
 */
export function convertDitaBlockAtPos(tagName: string, nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    const spec = getElementSpec(tagName);
    if (!spec || spec.tag === getPmNodeTagName(node)) return false;
    const parentTag = getPmNodeTagName(state.doc.resolve(nodePos).parent);
    if (
      !parentTag ||
      !isChildAllowed(parentTag, spec.tag, resolveTaskModelForDocument(state.doc))
    ) {
      return false;
    }
    const converted = buildConvertedBlock(node, spec);
    if (!converted) return false;
    if (!dispatch) return true;

    const tr = state.tr.replaceWith(nodePos, nodePos + node.nodeSize, converted);
    const caret = Math.min(nodePos + 1, tr.doc.content.size);
    tr.setSelection(Selection.near(tr.doc.resolve(caret), -1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/** Duplicate a block right below itself. */
export function duplicateDitaBlockAtPos(nodePos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    if (!dispatch) return true;
    const insertAt = nodePos + node.nodeSize;
    const tr = state.tr.insert(insertAt, node);
    tr.setSelection(Selection.near(tr.doc.resolve(insertAt + 1), 1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Move a block into one of the gaps of its own container (drag & drop from the gutter handle).
 */
export function moveDitaBlockToGap(nodePos: number, gapPos: number): Command {
  return (state, dispatch) => {
    if (nodePos <= 0) return false;
    const node = state.doc.nodeAt(nodePos);
    if (!node || node.isInline) return false;
    const plan = planBlockMove(nodePos, node.nodeSize, gapPos);
    if (!plan) return false;

    // Reordering must keep the ordered content model intact (drag is a *move*, not a re-slot).
    const $pos = state.doc.resolve(nodePos);
    if ($pos.depth < 1) return false;
    const parent = $pos.parent;
    const fromIndex = $pos.index($pos.depth);
    const parentStart = $pos.start($pos.depth);
    let gapIndex = 0;
    let offset = parentStart;
    while (gapIndex < parent.childCount && offset !== gapPos) {
      offset += parent.child(gapIndex)!.nodeSize;
      gapIndex += 1;
    }
    if (
      !isBlockMoveOrderSafe(
        getPmNodeTagName(parent) ?? '',
        getPmChildTags(parent),
        fromIndex,
        gapIndex,
      )
    ) {
      return false;
    }

    if (!dispatch) return true;

    const tr = state.tr.delete(plan.from, plan.to);
    tr.insert(plan.insertAt, node);
    tr.setSelection(Selection.near(tr.doc.resolve(plan.insertAt + 1), 1));
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
