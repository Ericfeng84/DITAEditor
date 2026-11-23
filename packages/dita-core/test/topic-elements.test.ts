import { describe, expect, it } from 'vitest';

import {
  DITA_CONTENT_MODEL,
  DITA_ELEMENT_SPECS,
  checkXmlStructure,
  getAllowedChildElementTags,
  getInsertionSlot,
  getPmNodeTagName,
  isChildAllowed,
  pmDocToXml,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '../src/index.js';

/**
 * Base `<topic>` grammar per OASIS DITA 1.3 `topic.mod` (topic.dtd):
 *
 *   body            = (body.cnt | bodydiv | example | section)*
 *   bodydiv         = (bodydiv.cnt | bodydiv | section)*
 *   related-links   = (link | linklist | linkpool)*
 *   link            = (linktext?, desc?)
 *   linklist        = (title?, desc?, (linklist | link)*, linkinfo?)
 *   linkpool        = (linkpool | link)*
 *   linkinfo        = (desc.cnt)*
 */
const TOPIC_XML = `<topic id="topic_release_notes" xml:lang="zh-CN">
  <title>v3.2.0 版本发布说明</title>
  <shortdesc>本版本新增 Webhook 重试、审计日志导出与性能改进。</shortdesc>
  <body>
    <p>本版本聚焦稳定性与可观测性。</p>
    <bodydiv id="div_highlights">
      <p>本分组成组复用，可在其他手册中通过 conref 引用。</p>
      <note type="important">升级前请备份配置。</note>
    </bodydiv>
    <section id="sec_new_features">
      <title>新特性</title>
      <ul>
        <li>Webhook 失败自动重试。</li>
        <li>审计日志支持导出 CSV。</li>
      </ul>
    </section>
    <example>
      <title>示例</title>
      <p>导出命令示例。</p>
    </example>
  </body>
  <related-links>
    <link href="concept_architecture.dita"/>
    <linklist>
      <title>延伸阅读</title>
      <link href="task_quick_start.dita"/>
      <link href="reference_rest_api.dita"/>
    </linklist>
    <linkpool>
      <link href="topic_legal_notice.dita"/>
    </linkpool>
  </related-links>
</topic>
`;

describe('DITA 1.3 base topic grammar (topic.dtd)', () => {
  it('models <bodydiv> and the related-links family', () => {
    const expected: ReadonlyArray<readonly [string, string]> = [
      ['bodydiv', 'dita_bodydiv'],
      ['linklist', 'dita_linklist'],
      ['linkpool', 'dita_linkpool'],
      ['linkinfo', 'dita_linkinfo'],
    ];
    for (const [tag, pmNodeType] of expected) {
      const spec = DITA_ELEMENT_SPECS.get(tag);
      expect(spec, tag).toBeDefined();
      expect(spec!.pmNodeType, tag).toBe(pmNodeType);
    }
    // `<linktext>` overrides the rendered link title; it stays a lossless passthrough child.
    const linktext = DITA_ELEMENT_SPECS.get('linktext');
    expect(linktext).toBeDefined();
    expect(linktext!.kind).toBe('inline');
  });

  it('models <titlealts> with its ordered navtitle / searchtitle slots', () => {
    const expected: ReadonlyArray<readonly [string, string]> = [
      ['titlealts', 'dita_titlealts'],
      ['navtitle', 'dita_navtitle'],
      ['searchtitle', 'dita_searchtitle'],
    ];
    for (const [tag, pmNodeType] of expected) {
      expect(DITA_ELEMENT_SPECS.get(tag)?.pmNodeType, tag).toBe(pmNodeType);
    }
    expect(getAllowedChildElementTags('titlealts')).toEqual(['navtitle', 'searchtitle']);
    expect(validateChildSequence('titlealts', ['navtitle', 'searchtitle'])).toEqual([]);
    expect(validateChildSequence('titlealts', ['searchtitle', 'navtitle'])).toEqual([
      expect.objectContaining({
        code: 'child-out-of-order',
        parentTag: 'titlealts',
        childTag: 'navtitle',
        index: 1,
      }),
    ]);

    const xml = `<topic id="t">\n  <title>正文标题很长很长</title>\n  <titlealts>\n    <navtitle>短标题</navtitle>\n    <searchtitle>搜索用标题</searchtitle>\n  </titlealts>\n  <body>\n    <p>x</p>\n  </body>\n</topic>`;
    const { pmDoc } = xmlToPmDoc(xml);
    expect(pmDocToXml(pmDoc)).toBe(`${xml}\n`);
  });

  it('enforces the topic-body membership rules', () => {
    expect(getAllowedChildElementTags('body')).toContain('bodydiv');
    expect(getAllowedChildElementTags('bodydiv')).toEqual([
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
      'section',
      'bodydiv',
    ]);
    // `bodydiv` only belongs to `body` — concept/ task/ reference bodies use their own divisions.
    expect(isChildAllowed('body', 'bodydiv')).toBe(true);
    expect(isChildAllowed('conbody', 'bodydiv')).toBe(false);
    expect(isChildAllowed('taskbody', 'bodydiv')).toBe(false);
    expect(isChildAllowed('refbody', 'bodydiv')).toBe(false);
    // `example` is a `body` child, never a `bodydiv` child (`bodydiv.content` ends with section).
    expect(isChildAllowed('bodydiv', 'example')).toBe(false);

    expect(getAllowedChildElementTags('related-links')).toEqual(['link', 'linklist', 'linkpool']);
    expect(getAllowedChildElementTags('linklist')).toEqual([
      'title',
      'desc',
      'link',
      'linklist',
      'linkinfo',
    ]);
    expect(getAllowedChildElementTags('linkpool')).toEqual(['link', 'linkpool']);
  });

  it('orders linklist children and keeps linkpool a repeating link list', () => {
    expect(validateChildSequence('linklist', ['title', 'desc', 'link', 'linkinfo'])).toEqual([]);
    expect(validateChildSequence('linklist', ['link', 'title'])).toEqual([
      expect.objectContaining({
        code: 'child-out-of-order',
        parentTag: 'linklist',
        childTag: 'title',
        index: 1,
      }),
    ]);
    // `linkinfo` must come after every link and may only appear once.
    expect(validateChildSequence('linklist', ['link', 'linkinfo', 'link'])[0]).toMatchObject({
      code: 'child-out-of-order',
      parentTag: 'linklist',
      childTag: 'link',
      index: 2,
    });
    expect(validateChildSequence('linklist', ['link', 'linkinfo', 'linkinfo'])).toEqual([
      expect.objectContaining({ code: 'child-cardinality', childTag: 'linkinfo', index: 2 }),
    ]);

    expect(validateChildSequence('linkpool', ['link', 'link', 'link'])).toEqual([]);
    expect(validateChildSequence('bodydiv', ['section', 'p'])).toEqual([]);
  });

  it('re-anchors a paragraph inserted after a section inside a bodydiv', () => {
    expect(getInsertionSlot('linklist', ['title'], 'link')).toMatchObject({ ok: true, index: 1 });
    expect(getInsertionSlot('linklist', ['link'], 'title')).toMatchObject({ ok: true, index: 0 });
    expect(getInsertionSlot('linklist', ['title', 'link'], 'linkinfo')).toMatchObject({
      ok: true,
      index: 2,
    });
  });

  it('round-trips a base topic losslessly and idempotently', () => {
    const check = checkXmlStructure(TOPIC_XML);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.issues).toEqual([]);

    const { pmDoc } = xmlToPmDoc(TOPIC_XML);
    expect(validatePmStructure(pmDoc)).toEqual([]);

    const once = pmDocToXml(pmDoc);
    expect(once).toBe(TOPIC_XML);
    expect(pmDocToXml(xmlToPmDoc(once).pmDoc)).toBe(once);

    // Every modeled element keeps its DITA tag name, so no node degrades into `unknown_block`.
    const seen: string[] = [];
    pmDoc.descendants((node) => {
      if (node.isText || node.type.name === 'doc') return true;
      seen.push(getPmNodeTagName(node) ?? node.type.name);
      return true;
    });
    expect(seen).toContain('bodydiv');
    expect(seen).toContain('linklist');
    expect(seen).toContain('linkpool');
    expect(seen).not.toContain('unknown_block');
  });

  it('reports the illegal <bodydiv> locations DITA 1.3 forbids', () => {
    // `conbody`/`refbody` are not exhaustive membership containers, but `section` is: a
    // `<bodydiv>` inside a section must be reported instead of silently disappearing.
    const badXml = `<topic id="t"><title>T</title><body><section><title>S</title><bodydiv><p>x</p></bodydiv></section></body></topic>`;
    const check = checkXmlStructure(badXml);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.issues).toEqual([
      expect.objectContaining({
        code: 'child-not-allowed',
        parentTag: 'section',
        childTag: 'bodydiv',
      }),
    ]);
  });

  it('documents the bodydiv content model next to the other structural containers', () => {
    expect(DITA_CONTENT_MODEL.bodydiv).toEqual(DITA_ELEMENT_SPECS.get('bodydiv') ? expect.any(Array) : undefined);
    expect(DITA_CONTENT_MODEL['related-links']).toEqual(['link', 'linklist', 'linkpool']);
  });
});
