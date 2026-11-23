import { Fragment, type Node as PMNode } from 'prosemirror-model';
import {
  ditaSchema,
  MODELED_INLINE_TAGS,
  type RawAttrs,
} from '@dita/core';
import { getCurrentLocale, translate } from '../../../i18n/index.js';
import { EMPTY_ATTRS, makeNode, textNode } from './node-helpers.js';

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
