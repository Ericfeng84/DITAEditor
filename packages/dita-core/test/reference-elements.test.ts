import { describe, expect, it } from 'vitest';

import {
  checkXmlStructure,
  getAllowedChildElementTags,
  getElementSpec,
  isChildAllowed,
  pmDocToXml,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '../src/index.js';

/**
 * A reference topic that exercises everything `reference.dtd` (DITA 1.3) allows in a body:
 * `refsyn`, a `properties` parameter table, and a `refbodydiv` grouping a section + example.
 * The XML is verified `VALID` against the OASIS DTD (DITA-OT 4.2.1 `reference.dtd`) with Xerces.
 */
const REFERENCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="reference_deploy_api" xml:lang="zh-CN">
  <title>部署服务 API</title>
  <shortdesc>用于触发部署、查询状态与回滚的端点说明。</shortdesc>
  <refbody>
    <refsyn>
      <title>语法</title>
      <codeblock>POST /api/v1/deployments</codeblock>
    </refsyn>
    <properties>
      <prophead>
        <proptypehd>类型</proptypehd>
        <propvaluehd>取值</propvaluehd>
        <propdeschd>说明</propdeschd>
      </prophead>
      <property>
        <proptype>string</proptype>
        <propvalue>production</propvalue>
        <propdesc>部署目标环境。</propdesc>
      </property>
      <property>
        <proptype>integer</proptype>
        <propvalue>30</propvalue>
        <propdesc>超时秒数。</propdesc>
      </property>
    </properties>
    <refbodydiv>
      <section id="sec_errors">
        <title>错误码</title>
        <simpletable>
          <sthead>
            <stentry>错误码</stentry>
            <stentry>说明</stentry>
          </sthead>
          <strow>
            <stentry><msgnum>E1024</msgnum></stentry>
            <stentry>超时。</stentry>
          </strow>
        </simpletable>
      </section>
      <example>
        <title>请求示例</title>
        <p>使用 <cmdname>curl</cmdname> 调用。</p>
      </example>
    </refbodydiv>
  </refbody>
</reference>
`;

describe('reference parameter tables (DITA 1.3 reference.dtd)', () => {
  it('models the properties family plus refbodydiv and msgnum', () => {
    const expectations: Array<[string, string | undefined]> = [
      ['refbodydiv', 'dita_refbodydiv'],
      ['properties', 'dita_properties'],
      ['prophead', 'dita_prophead'],
      ['property', 'dita_property'],
      ['proptypehd', 'dita_proptypehd'],
      ['propvaluehd', 'dita_propvaluehd'],
      ['propdeschd', 'dita_propdeschd'],
      ['proptype', 'dita_proptype'],
      ['propvalue', 'dita_propvalue'],
      ['propdesc', 'dita_propdesc'],
      ['msgnum', 'dita_msgnum'],
    ];

    for (const [tag, pmNodeType] of expectations) {
      const spec = getElementSpec(tag);
      expect(spec, `${tag} is missing a spec`).toBeDefined();
      expect(spec?.pmNodeType, `${tag} pmNodeType`).toBe(pmNodeType);
      expect(spec?.labelZh?.length, `${tag} zh label`).toBeGreaterThan(0);
    }
  });

  it('follows the reference.mod membership rules', () => {
    // `refbody` accepts only refsyn | properties | section | example | simpletable | table | refbodydiv
    for (const child of [
      'refsyn',
      'properties',
      'section',
      'example',
      'simpletable',
      'table',
      'refbodydiv',
    ]) {
      expect(isChildAllowed('refbody', child), `refbody > ${child}`).toBe(true);
    }
    for (const child of ['p', 'ul', 'ol', 'codeblock', 'note', 'fig']) {
      expect(isChildAllowed('refbody', child), `refbody > ${child}`).toBe(false);
    }

    // `section.cnt` has no `properties` / `refsyn` / `example`.
    for (const child of ['properties', 'refsyn', 'example', 'section']) {
      expect(isChildAllowed('section', child), `section > ${child}`).toBe(false);
    }

    // `properties` = `(prophead?, property+)`, `property` = `(proptype?, propvalue?, propdesc?)`.
    expect(isChildAllowed('properties', 'prophead')).toBe(true);
    expect(isChildAllowed('properties', 'property')).toBe(true);
    expect(isChildAllowed('properties', 'p')).toBe(false);
    for (const child of ['proptype', 'propvalue', 'propdesc']) {
      expect(isChildAllowed('property', child), `property > ${child}`).toBe(true);
    }
    expect(isChildAllowed('property', 'p')).toBe(false);

    // `refbodydiv` mirrors `refbody` and may nest itself.
    expect(isChildAllowed('refbodydiv', 'refbodydiv')).toBe(true);
    expect(getAllowedChildElementTags('refbodydiv')).toEqual(
      getAllowedChildElementTags('refbody'),
    );
  });

  it('orders the properties and property slots', () => {
    expect(validateChildSequence('properties', [])).toEqual([
      {
        code: 'missing-required-child',
        parentTag: 'properties',
        childTag: 'property',
        expectedTags: ['property'],
        severity: 'warning',
      },
    ]);

    expect(
      validateChildSequence('properties', ['property', 'prophead']).map((issue) => issue.code),
    ).toEqual(['child-out-of-order']);

    expect(validateChildSequence('properties', ['prophead', 'property', 'property'])).toEqual([]);

    expect(
      validateChildSequence('property', ['propdesc', 'proptype']).map((issue) => issue.code),
    ).toEqual(['child-out-of-order']);

    expect(validateChildSequence('property', ['proptype', 'propvalue', 'propdesc'])).toEqual([]);

    expect(
      validateChildSequence('prophead', ['propdeschd', 'proptypehd']).map((issue) => issue.code),
    ).toEqual(['child-out-of-order']);
  });

  it('reports declared DITA blocks that the DTD forbids inside exhaustive containers', () => {
    // The exact shape from an early draft of `docs/dita/dita_reference.md`: `<properties>`
    // wrapped in a `<section>` — DTD-invalid, and previously invisible to the editor.
    expect(validateChildSequence('section', ['title', 'properties'])).toMatchObject([
      { code: 'child-not-allowed', parentTag: 'section', childTag: 'properties', index: 1 },
    ]);

    // A bare `<p>` directly inside `<refbody>` is illegal (one of the doc's key warnings).
    expect(validateChildSequence('refbody', ['p'])).toMatchObject([
      { code: 'child-not-allowed', parentTag: 'refbody', childTag: 'p', index: 0 },
    ]);
    expect(validateChildSequence('refbodydiv', ['example', 'p'])).toMatchObject([
      { code: 'child-not-allowed', parentTag: 'refbodydiv', childTag: 'p', index: 1 },
    ]);
    expect(validateChildSequence('refsyn', ['example'])).toMatchObject([
      { code: 'child-not-allowed', parentTag: 'refsyn', childTag: 'example', index: 0 },
    ]);

    // Unknown / specialized elements must stay silent (lossless passthrough).
    expect(validateChildSequence('refbody', ['mySpecializedBlock'])).toEqual([]);
    // Containers with an open tail never report membership issues.
    expect(validateChildSequence('body', ['anything'])).toEqual([]);
  });

  it('round-trips a full reference topic losslessly', () => {
    const check = checkXmlStructure(REFERENCE_XML);
    expect(check.ok && check.issues).toEqual([]);

    const { pmDoc } = xmlToPmDoc(REFERENCE_XML, { position: false });
    expect(validatePmStructure(pmDoc)).toEqual([]);

    const once = pmDocToXml(pmDoc);
    for (const snippet of [
      '<properties>',
      '<prophead>',
      '<proptypehd>类型</proptypehd>',
      '<proptype>integer</proptype>',
      '<propdesc>超时秒数。</propdesc>',
      '<refbodydiv>',
      '<msgnum>E1024</msgnum>',
      '<refsyn>',
    ]) {
      expect(once).toContain(snippet);
    }
    expect(pmDocToXml(xmlToPmDoc(once, { position: false }).pmDoc)).toBe(once);
  });

  it('localizes the child-not-allowed diagnostic', () => {
    const issue = validateChildSequence('section', ['properties'])[0]!;
    expect(issue.code).toBe('child-not-allowed');

    const broken = checkXmlStructure(
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="reference_broken">
  <title>损坏的示例</title>
  <refbody>
    <section>
      <title>参数</title>
      <properties>
        <property>
          <propvalue>30</propvalue>
        </property>
      </properties>
    </section>
  </refbody>
</reference>
`,
    );

    expect(broken.ok).toBe(true);
    if (!broken.ok) return;
    expect(broken.issues.map((issue) => issue.code)).toEqual(['child-not-allowed']);
    expect(broken.issues[0]).toMatchObject({ parentTag: 'section', childTag: 'properties' });
  });
});
