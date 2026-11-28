import { describe, expect, it } from 'vitest';
import {
  GLOSSARY_CSV_COLUMNS,
  matchGlossaryTerms,
  mergeGlossaryEntries,
  parseGlossaryCsv,
  parseGlossaryJson,
  parseGlossaryTbx,
  previewGlossaryImport,
  runTranslationQa,
  serializeGlossaryCsv,
  serializeGlossaryJson,
  serializeGlossaryTbx,
} from '../src/translation/index.js';
import type { GlossaryEntryForMatch } from '../src/translation/index.js';
import { checkXmlWellFormed } from '../src/xml/parser.js';

function entry(overrides: Partial<GlossaryEntryForMatch> & { sourceTerm: string }): GlossaryEntryForMatch {
  return {
    termId: overrides.termId ?? `term-${overrides.sourceTerm}`,
    glossaryId: 'glossary-1',
    scope: overrides.scope ?? 'global',
    sourceTerm: overrides.sourceTerm,
    targetTerm: overrides.targetTerm ?? overrides.sourceTerm,
    caseSensitive: overrides.caseSensitive ?? false,
    doNotTranslate: overrides.doNotTranslate ?? false,
    ...overrides,
  };
}

const WIDGET = entry({
  termId: 'g-widget',
  scope: 'global',
  sourceTerm: 'widget',
  targetTerm: 'gadget',
});
const WIDGET_OVERRIDE = entry({
  termId: 'g-widget-manual',
  scope: 'manual',
  sourceTerm: 'Widget',
  targetTerm: '小组件',
  forbiddenTargets: ['部件'],
});
const ACME = entry({
  termId: 'g-acme',
  sourceTerm: 'ACME',
  targetTerm: 'ACME',
  caseSensitive: true,
  doNotTranslate: true,
});
const CAT = entry({ termId: 'g-cat', sourceTerm: 'cat', targetTerm: '猫' });
const CJK = entry({ termId: 'g-cjk', sourceTerm: '小组件', targetTerm: 'widget' });

describe('mergeGlossaryEntries', () => {
  it('deduplicates case-insensitively and lets manual scope win', () => {
    const merged = mergeGlossaryEntries([WIDGET, WIDGET_OVERRIDE, ACME, CAT]);
    expect(merged).toHaveLength(3);
    const widget = merged.find((item) => item.sourceTerm.toLowerCase() === 'widget');
    expect(widget?.termId).toBe('g-widget-manual');
    expect(widget?.scope).toBe('manual');
    expect(widget?.targetTerm).toBe('小组件');
  });

  it('keeps case-sensitive entries apart and drops empty terms', () => {
    const merged = mergeGlossaryEntries([
      entry({ sourceTerm: 'Acme', caseSensitive: true }),
      entry({ sourceTerm: 'ACME', caseSensitive: true }),
      entry({ sourceTerm: '   ' }),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.map((item) => item.sourceTerm)).toEqual(['Acme', 'ACME']);
  });
});

describe('matchGlossaryTerms', () => {
  it('matches longest span first without overlaps', () => {
    const long = entry({ termId: 'long', sourceTerm: 'widget set', targetTerm: '组件集' });
    const hits = matchGlossaryTerms('Open the widget set now.', [WIDGET_OVERRIDE, long]);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.matchedText).toBe('widget set');
    expect(hits[0]!.entry.termId).toBe('long');
  });

  it('enforces word boundaries for Latin terms and matches CJK by substring', () => {
    const latin = matchGlossaryTerms('The concatenate widget and cat ACME.', [
      WIDGET_OVERRIDE,
      CAT,
      ACME,
    ]);
    expect(latin.map((hit) => hit.matchedText)).toEqual(['widget', 'cat', 'ACME']);

    const cjk = matchGlossaryTerms('安装小组件完成', [CJK]);
    expect(cjk).toHaveLength(1);
    expect(cjk[0]!.start).toBe(2);
    expect(cjk[0]!.end).toBe(5);
  });

  it('matches declared synonyms and respects case sensitivity', () => {
    const synonym = entry({
      termId: 'syn',
      sourceTerm: 'widget',
      synonyms: ['gadget'],
      targetTerm: '小组件',
    });
    expect(matchGlossaryTerms('A gadget here.', [synonym]).map((hit) => hit.matchedText)).toEqual([
      'gadget',
    ]);
    expect(matchGlossaryTerms('acme', [ACME])).toHaveLength(0);
    expect(matchGlossaryTerms('ACME', [ACME])).toHaveLength(1);
  });

  it('returns nothing for empty text or entries', () => {
    expect(matchGlossaryTerms('', [WIDGET_OVERRIDE])).toEqual([]);
    expect(matchGlossaryTerms('widget', [])).toEqual([]);
  });
});

describe('runTranslationQa', () => {
  const glossary = mergeGlossaryEntries([WIDGET_OVERRIDE, ACME, CAT]);

  it('passes a faithful translation', () => {
    const issues = runTranslationQa({
      glossary,
      segments: [
        {
          segmentId: 'ok',
          sourceXml: '<p>Use the <b>widget</b> for {0}.</p>',
          sourceText: 'Use the widget for {0}.',
          targetXml: '<p>使用<b>小组件</b>，共 {0} 次。</p>',
          targetText: '使用小组件，共 {0} 次。',
        },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('reports inline, placeholder, glossary and forbidden-translation problems', () => {
    const issues = runTranslationQa({
      glossary,
      segments: [
        {
          segmentId: 's1',
          sourceXml: '<p>Use the <b>widget</b> for {0}.</p>',
          sourceText: 'Use the widget for {0}.',
          targetXml: '<p>使用部件。</p>',
          targetText: '使用部件。',
        },
      ],
    });
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain('inline_tag_mismatch');
    expect(codes).toContain('placeholder_mismatch');
    expect(codes).toContain('missing_glossary_term');
    expect(codes).toContain('forbidden_translation');
    expect(issues.every((issue) => issue.segmentId === 's1')).toBe(true);
    expect(issues.every((issue) => issue.severity === 'error')).toBe(true);

    const forbidden = issues.find((issue) => issue.code === 'forbidden_translation');
    expect(forbidden?.expected).toBe('小组件');
    expect(forbidden?.actual).toBe('部件');
  });

  it('reports modified protected attributes', () => {
    const issues = runTranslationQa({
      glossary: [],
      segments: [
        {
          segmentId: 's2',
          sourceXml: '<p><xref href="x.dita" keyref="k1" scope="local"/></p>',
          sourceText: 'x',
          targetXml: '<p><xref href="y.dita" scope="external"/></p>',
          targetText: 'x',
        },
      ],
    });
    const attrIssues = issues.filter((issue) => issue.code === 'protected_attr_modified');
    expect(attrIssues).toHaveLength(3);
    expect(attrIssues.map((issue) => issue.expected).sort()).toEqual(['k1', 'local', 'x.dita']);
    expect(attrIssues.map((issue) => issue.actual).sort()).toEqual(['', 'external', 'y.dita']);
  });

  it('reports do-not-translate drift and malformed target XML', () => {
    const issues = runTranslationQa({
      glossary,
      segments: [
        {
          segmentId: 'dnt',
          sourceXml: '<p>ACME widget</p>',
          sourceText: 'ACME widget',
          targetXml: '<p>阿克米 小组件</p>',
          targetText: '阿克米 小组件',
        },
        {
          segmentId: 'broken',
          sourceXml: '<p>ok</p>',
          sourceText: 'ok',
          targetXml: '<p>bad',
          targetText: 'bad',
        },
      ],
    });
    expect(issues.some((issue) => issue.code === 'dnt_modified' && issue.segmentId === 'dnt')).toBe(
      true,
    );
    expect(
      issues.some((issue) => issue.code === 'xml_malformed' && issue.segmentId === 'broken'),
    ).toBe(true);
  });

  it('skips glossary/style gates for protected blocks', () => {
    const issues = runTranslationQa({
      glossary,
      segments: [
        {
          segmentId: 'protected',
          protected: true,
          sourceXml: '<codeblock>ACME widget()</codeblock>',
          sourceText: 'ACME widget()',
          targetXml: '<codeblock>ACME widget()</codeblock>',
          targetText: 'ACME widget()',
        },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('does not compare protected attributes of the outer block element itself', () => {
    // `assembleTranslatedXml` always keeps the S1 block element's own attributes, so a target
    // payload may be the full `<p id="p1">` element or a bare inner fragment; neither is a
    // protected-attribute change.
    const withWrapper = runTranslationQa({
      glossary: [],
      segments: [
        {
          segmentId: 'wrapper',
          sourceXml: '<p id="p1">Configure the gateway.</p>',
          sourceText: 'Configure the gateway.',
          targetXml: '<p id="p1">配置网关。</p>',
          targetText: '配置网关。',
        },
      ],
    });
    expect(withWrapper.filter((issue) => issue.code === 'protected_attr_modified')).toEqual([]);

    const bareFragment = runTranslationQa({
      glossary: [],
      segments: [
        {
          segmentId: 'bare',
          sourceXml: '<p id="p1">Configure the gateway.</p>',
          sourceText: 'Configure the gateway.',
          targetXml: '配置网关。',
          targetText: '配置网关。',
        },
      ],
    });
    expect(bareFragment).toEqual([]);
  });

  it('tolerates target-language reordering of inline elements with protected attributes', () => {
    const issues = runTranslationQa({
      glossary: [],
      segments: [
        {
          segmentId: 'reorder',
          sourceXml:
            '<p>Run <codeph>dita --install</codeph> to build <xref href="../a.dita" scope="local" format="dita">the theme</xref>.</p>',
          sourceText: 'Run dita --install to build the theme.',
          targetXml:
            '<p>构建<xref href="../a.dita" scope="local" format="dita">主题</xref>请运行<codeph>dita --install</codeph>。</p>',
          targetText: '构建主题请运行 dita --install。',
        },
      ],
    });
    expect(issues).toEqual([]);
  });

  it('still catches a dropped or mutated inline protected attribute', () => {
    const dropped = runTranslationQa({
      glossary: [],
      segments: [
        {
          segmentId: 'dropped',
          sourceXml: '<p>See <xref href="../a.dita" scope="local" format="dita">themes</xref>.</p>',
          sourceText: 'See themes.',
          targetXml: '<p>参见 <xref>主题</xref>。</p>',
          targetText: '参见 主题。',
        },
      ],
    });
    const droppedIssues = dropped.filter((issue) => issue.code === 'protected_attr_modified');
    expect(droppedIssues.map((issue) => issue.actual)).toEqual(['', '', '']);
    expect(droppedIssues.map((issue) => issue.expected).sort()).toEqual(
      ['../a.dita', 'dita', 'local'].sort(),
    );

    const mutated = runTranslationQa({
      glossary: [],
      segments: [
        {
          segmentId: 'mutated',
          sourceXml: '<p>See <xref href="../a.dita" scope="local">themes</xref>.</p>',
          sourceText: 'See themes.',
          targetXml: '<p>参见 <xref href="../b.dita" scope="external">主题</xref>。</p>',
          targetText: '参见 主题。',
        },
      ],
    });
    const mutatedIssues = mutated.filter((issue) => issue.code === 'protected_attr_modified');
    expect(mutatedIssues).toHaveLength(2);
    expect(mutatedIssues.every((issue) => issue.message.includes('<xref '))).toBe(true);
    expect(mutatedIssues.map((issue) => issue.expected).sort()).toEqual(
      ['../a.dita', 'local'].sort(),
    );
    expect(mutatedIssues.map((issue) => issue.actual).sort()).toEqual(
      ['../b.dita', 'external'].sort(),
    );
  });
});

describe('glossary codecs', () => {
  const rowWithEverything = {
    sourceTerm: 'widget, small',
    synonyms: ['gadget', 'thing'],
    targetLang: 'zh-CN',
    targetTerm: '小组件',
    forbiddenTargets: ['部件'],
    doNotTranslate: false,
    caseSensitive: false,
    contextNote: 'UI, general\nmulti-line',
    partOfSpeech: 'noun',
    status: 'approved' as const,
  };

  it('round-trips CSV with quoted commas, newlines and a BOM', () => {
    const csv = serializeGlossaryCsv([rowWithEverything]);
    expect(csv.startsWith(GLOSSARY_CSV_COLUMNS.join(','))).toBe(true);
    const parsed = parseGlossaryCsv(`\uFEFF${csv}`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toEqual(rowWithEverything);
  });

  it('accepts case-insensitive headers and reports invalid cells', () => {
    const parsed = parseGlossaryCsv(
      'sourceterm,targetterm,status\nwidget,小组件,approved\n,missing-source,approved\nbad,not-status,nope\n',
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]!.sourceTerm).toBe('widget');
    expect(parsed.errors.map((error) => error.row)).toEqual([2, 3]);

    const unclosed = parseGlossaryCsv('sourceTerm,targetTerm\n"unterminated,foo\n');
    expect(unclosed.rows).toEqual([]);
    expect(unclosed.errors[0]!.message).toContain('Unterminated');
  });

  it('round-trips JSON arrays and object wrappers', () => {
    const json = serializeGlossaryJson([rowWithEverything]);
    const fromArray = parseGlossaryJson(json);
    expect(fromArray.errors).toEqual([]);
    expect(fromArray.rows[0]).toMatchObject({ sourceTerm: 'widget, small', targetTerm: '小组件' });

    const fromObject = parseGlossaryJson(`{"terms":[{"sourceTerm":"a","targetTerm":"b"}]}`);
    expect(fromObject.rows).toHaveLength(1);

    expect(parseGlossaryJson('{ not json').errors[0]!.message).toContain('Invalid JSON');
    expect(parseGlossaryJson('{"foo":1}').errors).toHaveLength(1);
  });

  it('round-trips TBX-Basic with term notes and forbidden targets', () => {
    const tbx = serializeGlossaryTbx([rowWithEverything], 'en');
    expect(tbx).toContain('<martif type="TBX-Basic" xml:lang="en">');
    expect(tbx).toContain('<langSet xml:lang="zh-CN">');
    expect(checkXmlWellFormed(tbx).ok).toBe(true);

    const parsed = parseGlossaryTbx(tbx);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    const row = parsed.rows[0]!;
    expect(row.sourceTerm).toBe('widget, small');
    expect(row.synonyms).toEqual(['gadget', 'thing']);
    expect(row.targetLang).toBe('zh-CN');
    expect(row.targetTerm).toBe('小组件');
    expect(row.forbiddenTargets).toEqual(['部件']);
    expect(row.partOfSpeech).toBe('noun');
    expect(row.status).toBe('approved');
    expect(row.contextNote).toBe('UI, general\nmulti-line');
  });

  it('reports invalid TBX without throwing', () => {
    expect(parseGlossaryTbx('<not-tbx/>').errors).toHaveLength(1);
    expect(parseGlossaryTbx('<martif type="TBX-Basic"><text><body/></text></martif>').errors[0]!.message).toContain('termEntry');
    expect(parseGlossaryTbx('<martif').errors[0]!.message).toContain('Invalid TBX XML');
  });

  it('previews imports with new/update/invalid accounting', () => {
    const csv = serializeGlossaryCsv([
      rowWithEverything,
      { sourceTerm: 'license', targetTerm: '许可证' },
    ]);
    const preview = previewGlossaryImport('csv', csv, new Set(['license']));
    expect(preview.stats).toEqual({ total: 2, newCount: 1, updateCount: 1, invalidCount: 0 });
    expect(preview.rows).toHaveLength(2);
    expect(preview.errors).toEqual([]);

    const invalid = previewGlossaryImport(
      'json',
      JSON.stringify([
        { sourceTerm: 'a', targetTerm: 'b' },
        { sourceTerm: 'a', targetTerm: 'c' },
        { sourceTerm: 'd', targetTerm: 'x', targetLang: 'not a language' },
        { sourceTerm: 'e' },
      ]),
    );
    expect(invalid.rows).toHaveLength(1);
    expect(invalid.stats.total).toBe(4);
    expect(invalid.stats.invalidCount).toBe(3);
    expect(invalid.errors.map((error) => error.row).sort()).toEqual([2, 3, 4]);
  });
});
