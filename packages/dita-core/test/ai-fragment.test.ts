import { describe, expect, it, vi } from 'vitest';
import {
  buildDitaConstraintSummary,
  checkXmlWellFormed,
  extractTargetFragment,
  getAllowedChildElementTags,
  isChildAllowed,
  normalizeCandidateXml,
  parseXml,
  spliceAndVerifyAiXml,
  widenAiFixTarget,
  type AiFragmentExtraction,
  type AiSpliceFailure,
  type AiSpliceResult,
  type AiSpliceSuccess,
} from '../src/index.js';

// The converter is intentionally permissive for well-formed DITA XML, so the
// `prosemirror-incompatible` guard is exercised by simulating a converter regression.
const pmMock = vi.hoisted(() => ({ fail: false }));

vi.mock('../src/prosemirror/converter.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/prosemirror/converter.js')>();
  return {
    ...actual,
    xmlToPmDoc: (xml: string, options?: Parameters<typeof actual.xmlToPmDoc>[1]) => {
      if (pmMock.fail) throw new Error('模拟 ProseMirror 转换失败');
      return actual.xmlToPmDoc(xml, options);
    },
  };
});

const PROLOG =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<?xml-model href="concept.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n' +
  '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n';

const DOC =
  `${PROLOG}<concept id="topic_ai">\n` +
  '  <title>AI 片段引擎</title>\n' +
  '  <conbody>\n' +
  '    <p>前 <b>粗体</b> <!-- 行内注释 --> 后</p>\n' +
  '    <p><image href="assets/a.png" placement="break"/></p>\n' +
  '    <section id="sec_code">\n' +
  '      <title>代码</title>\n' +
  '      <codeblock xml:space="preserve" outputclass="language-xml">line1\n' +
  '    line2\n' +
  '        line3</codeblock>\n' +
  '    </section>\n' +
  '  </conbody>\n' +
  '</concept>';

const SIMPLE = '<concept id="c"><title>t</title><conbody><p>x</p></conbody></concept>';

function expectSuccess(result: AiSpliceResult): AiSpliceSuccess {
  if (!result.ok) {
    throw new Error(`期望回拼成功，但失败：${result.errorCode} ${result.errorMessage}`);
  }
  return result;
}

function expectFailure(result: AiSpliceResult): AiSpliceFailure {
  if (result.ok) {
    throw new Error('期望回拼失败，但回拼成功了。');
  }
  return result;
}

function extract(xml: string, path: readonly number[]): AiFragmentExtraction {
  return extractTargetFragment(xml, { mode: 'element', elementPath: path });
}

describe('extractTargetFragment — element / line-window / full-document targeting', () => {
  it('extracts a nested inline element with mixed text and comments byte-exactly', () => {
    const extraction = extract(DOC, [1, 0, 0]);

    expect(extraction.targetXml).toBe('<b>粗体</b>');
    expect(extraction.startOffset).toBe(DOC.indexOf('<b>'));
    expect(extraction.endOffset).toBe(DOC.indexOf('<b>') + '<b>粗体</b>'.length);
    expect(extraction.rootTagName).toBe('concept');
    expect(extraction.targetTag).toBe('b');
    expect(extraction.parentTag).toBe('p');
    expect(extraction.lineStart).toBe(7);
    expect(extraction.lineEnd).toBe(7);
    expect(DOC.slice(extraction.startOffset, extraction.endOffset)).toBe(extraction.targetXml);

    const result = expectSuccess(spliceAndVerifyAiXml(DOC, extraction, '<b>重点</b>'));
    expect(result.patchedXml).toBe(DOC.replace('<b>粗体</b>', '<b>重点</b>'));
    expect(result.patchedXml.slice(0, extraction.startOffset)).toBe(
      DOC.slice(0, extraction.startOffset),
    );
    expect(checkXmlWellFormed(result.patchedXml).ok).toBe(true);
    expect(result.verification.preservedDoctype).toBe(true);
    expect(result.verification.preservedXmlDeclaration).toBe(true);
    expect(result.verification.structureValid).toBe(true);
    expect(result.verification.prosemirrorCompatible).toBe(true);
  });

  it('handles a self-closing element target without losing the trailing source', () => {
    const extraction = extract(DOC, [1, 1, 0]);

    expect(extraction.targetXml).toBe('<image href="assets/a.png" placement="break"/>');
    expect(extraction.endOffset - extraction.startOffset).toBe(extraction.targetXml.length);
    expect(extraction.targetTag).toBe('image');
    expect(extraction.parentTag).toBe('p');

    const result = expectSuccess(
      spliceAndVerifyAiXml(DOC, extraction, '<image href="assets/b.png" placement="break"/>'),
    );
    expect(result.patchedXml).toBe(
      DOC.replace(
        '<image href="assets/a.png" placement="break"/>',
        '<image href="assets/b.png" placement="break"/>',
      ),
    );
  });

  it('treats an empty elementPath as the root element and never reserializes the prolog', () => {
    const extraction = extract(DOC, []);

    expect(extraction.targetTag).toBe('concept');
    expect(extraction.parentTag).toBeNull();
    expect(extraction.rootTagName).toBe('concept');
    expect(extraction.startOffset).toBe(DOC.indexOf('<concept'));
    expect(extraction.targetXml.startsWith('<concept id="topic_ai">')).toBe(true);
    expect(extraction.targetXml.endsWith('</concept>')).toBe(true);

    const candidate = '<concept id="topic_ai"><title>新标题</title><conbody><p>正文</p></conbody></concept>';
    const result = expectSuccess(spliceAndVerifyAiXml(DOC, extraction, candidate));
    expect(result.patchedXml).toBe(`${PROLOG}${candidate}`);
    expect(result.patchedXml.startsWith(PROLOG)).toBe(true);
  });

  it('locates a line window inside malformed XML without parsing it', () => {
    const malformed = '<concept id="c"><title>标题</title><p>未闭合</concept>';
    expect(checkXmlWellFormed(malformed).ok).toBe(false);

    const extraction = extractTargetFragment(malformed, { mode: 'line-window', line: 1 });
    expect(extraction.targetXml).toBe(malformed);
    expect(extraction.startOffset).toBe(0);
    expect(extraction.endOffset).toBe(malformed.length);
    expect(extraction.targetTag).toBeNull();
    expect(extraction.parentTag).toBeNull();
    expect(extraction.rootTagName).toBe('concept');
    expect(extraction.lineStart).toBe(1);

    const candidate = '<concept id="c"><title>标题</title><p>已修复</p></concept>';
    const result = expectSuccess(spliceAndVerifyAiXml(malformed, extraction, candidate));
    expect(result.patchedXml).toBe(candidate);
    expect(checkXmlWellFormed(result.patchedXml).ok).toBe(true);
  });

  it('defaults the line window to line 1 when no line is supplied', () => {
    const malformed = '<concept id="c">\n  <p>未闭合</concept>';
    const byDefault = extractTargetFragment(malformed, { mode: 'line-window' });
    const explicit = extractTargetFragment(malformed, { mode: 'line-window', line: 1 });

    expect(byDefault.lineStart).toBe(1);
    expect(byDefault.lineEnd).toBe(1);
    expect(byDefault.targetXml).toBe('<concept id="c">');
    expect(byDefault.startOffset).toBe(explicit.startOffset);
    expect(byDefault.endOffset).toBe(explicit.endOffset);
  });

  it('replaces a multi-line line window and keeps the surrounding lines untouched', () => {
    const broken = [
      '<concept id="c">',
      '  <title>标题</title>',
      '  <p>第一行',
      '     第二行</concept>',
      '</concept>',
    ].join('\n');
    expect(checkXmlWellFormed(broken).ok).toBe(false);

    const extraction = extractTargetFragment(broken, {
      mode: 'line-window',
      line: 3,
      lineEnd: 4,
    });
    expect(extraction.lineStart).toBe(3);
    expect(extraction.lineEnd).toBe(4);
    expect(extraction.targetXml).toBe('  <p>第一行\n     第二行</concept>');

    const candidate = '<p>已修复的第一行\n     已修复的第二行</p>';
    const result = expectSuccess(spliceAndVerifyAiXml(broken, extraction, candidate));
    expect(result.patchedXml).toBe(
      [
        '<concept id="c">',
        '  <title>标题</title>',
        '<p>已修复的第一行',
        '     已修复的第二行</p>',
        '</concept>',
      ].join('\n'),
    );
    expect(checkXmlWellFormed(result.patchedXml).ok).toBe(true);
  });

  it('accepts a sibling run as a line-window candidate (patched document is the gate)', () => {
    const xml = [
      '<concept id="c">',
      '  <conbody>',
      '    <p>one</p>',
      '    <p>two</p>',
      '  </conbody>',
      '</concept>',
    ].join('\n');
    const extraction = extractTargetFragment(xml, { mode: 'line-window', line: 3 });

    const result = expectSuccess(
      spliceAndVerifyAiXml(xml, extraction, '<p>a</p>\n    <p>b</p>'),
    );
    expect(result.patchedXml).toContain('<p>a</p>\n    <p>b</p>\n    <p>two</p>');
    expect(checkXmlWellFormed(result.patchedXml).ok).toBe(true);
  });

  it('reuses the original prolog verbatim for full-document targets', () => {
    const extraction = extractTargetFragment(DOC, { mode: 'full-document' });
    expect(extraction.startOffset).toBe(0);
    expect(extraction.endOffset).toBe(DOC.length);
    expect(extraction.targetXml).toBe(DOC);
    expect(extraction.rootTagName).toBe('concept');
    expect(extraction.lineStart).toBe(1);

    const candidate =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n' +
      '<concept id="generated"><title>生成的主题</title><conbody><p>正文</p></conbody></concept>';
    const result = expectSuccess(spliceAndVerifyAiXml(DOC, extraction, candidate));

    expect(result.patchedXml.startsWith(PROLOG)).toBe(true);
    expect(result.patchedXml.match(/<\?xml /g)).toHaveLength(1);
    expect(result.patchedXml.match(/<!DOCTYPE /g)).toHaveLength(1);
    expect(result.patchedXml).toContain('<?xml-model');
    expect(result.patchedXml.endsWith('</concept>')).toBe(true);
    expect(result.targetXml).toBe(
      '<concept id="generated"><title>生成的主题</title><conbody><p>正文</p></conbody></concept>',
    );
    expect(result.verification.preservedDoctype).toBe(true);
    expect(result.verification.preservedXmlDeclaration).toBe(true);
  });

  it('caps contextXml by maxContextChars while keeping the target in place', () => {
    const extraction = extractTargetFragment(
      DOC,
      { mode: 'element', elementPath: [1, 0, 0] },
      { maxContextChars: 80 },
    );

    expect(extraction.contextXml.length).toBeLessThanOrEqual(80);
    expect(extraction.contextXml).toContain('<b>粗体</b>');
    expect(extraction.truncated).toBe(true);
    // The replace range is never truncated.
    expect(extraction.targetXml).toBe('<b>粗体</b>');
  });

  it('only flips truncated for maxTargetChars and never shortens the replace range', () => {
    const extraction = extractTargetFragment(DOC, { mode: 'full-document' }, { maxTargetChars: 64 });

    expect(extraction.truncated).toBe(true);
    expect(extraction.targetXml).toBe(DOC);
    expect(extraction.endOffset).toBe(DOC.length);

    const relaxed = extractTargetFragment(DOC, { mode: 'full-document' });
    expect(relaxed.truncated).toBe(false);
  });

  it('includes ±contextLines complete lines around the target', () => {
    const extraction = extractTargetFragment(
      DOC,
      { mode: 'element', elementPath: [1, 0, 0] },
      { contextLines: 1 },
    );

    expect(extraction.contextXml).toBe(
      '  <conbody>\n' +
        '    <p>前 <b>粗体</b> <!-- 行内注释 --> 后</p>\n' +
        '    <p><image href="assets/a.png" placement="break"/></p>\n',
    );
  });

  it('rejects unusable element paths with a readable Chinese error', () => {
    expect(() => extract(DOC, [9])).toThrow(/elementPath 越界/);
    expect(() => extract(DOC, [1.5])).toThrow(/elementPath 含非法下标/);
    expect(() =>
      extractTargetFragment('<concept><p>未闭合</concept>', { mode: 'element', elementPath: [] }),
    ).toThrow(/元素靶向定位需要良构的 XML/);
  });
});

describe('normalizeCandidateXml — model reply cleanup', () => {
  it('strips markdown fences, wrapper elements, XML declaration and DOCTYPE', () => {
    const fenced =
      '```xml\n<dita_patch>\n<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n' +
      '<concept id="c"><title>t</title></concept>\n</dita_patch>\n```';

    expect(normalizeCandidateXml(fenced)).toBe('<concept id="c"><title>t</title></concept>');
    expect(normalizeCandidateXml('```xml <p>x</p> ```')).toBe('<p>x</p>');
    expect(normalizeCandidateXml('<dita_document><p>x</p></dita_document>')).toBe('<p>x</p>');
    expect(normalizeCandidateXml('<?xml version="1.0"?><p>x</p>')).toBe('<p>x</p>');
  });

  it('is idempotent and keeps the candidate indentation verbatim', () => {
    const candidate = '  <codeblock xml:space="preserve">a\n    b\n        c</codeblock>\n';
    const once = normalizeCandidateXml(candidate);

    expect(once).toBe('<codeblock xml:space="preserve">a\n    b\n        c</codeblock>');
    expect(normalizeCandidateXml(once)).toBe(once);
  });
});

describe('spliceAndVerifyAiXml — verified lossless splicing', () => {
  it('rejects an empty candidate', () => {
    const extraction = extract(DOC, [1, 0, 0]);
    const result = expectFailure(spliceAndVerifyAiXml(DOC, extraction, '  \n  '));

    expect(result.errorCode).toBe('candidate-empty');
    expect(result.patchedXml).toBeNull();
    expect(result.verification.wellFormed).toBe(false);
    expect(result.verification.warnings.length).toBeGreaterThan(0);
  });

  it('rejects a candidate that is not a single well-formed element', () => {
    const extraction = extract(DOC, [1, 0, 0]);
    const result = expectFailure(spliceAndVerifyAiXml(DOC, extraction, '<b>a</b><b>b</b>'));

    expect(result.errorCode).toBe('candidate-malformed');
    expect(result.patchedXml).toBeNull();
  });

  it('rejects a patch that drops the DOCTYPE', () => {
    const xml =
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">\n' +
      '<concept id="c"><title>t</title></concept>';
    const extraction = extractTargetFragment(xml, { mode: 'line-window', line: 1, lineEnd: 2 });
    const candidate = '<concept id="c"><title>t</title><conbody><p>x</p></conbody></concept>';
    const result = expectFailure(spliceAndVerifyAiXml(xml, extraction, candidate));

    expect(result.errorCode).toBe('doctype-changed');
    expect(result.patchedXml).toBe(candidate);
    expect(result.verification.wellFormed).toBe(true);
    expect(result.verification.preservedDoctype).toBe(false);
    expect(result.verification.preservedXmlDeclaration).toBe(true);
  });

  it('rejects a patch that drops the XML declaration', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<concept id="c"><title>t</title><conbody><p>x</p></conbody></concept>';
    const extraction = extractTargetFragment(xml, { mode: 'line-window', line: 1, lineEnd: 2 });
    const candidate = '<concept id="c"><title>t</title><conbody><p>y</p></conbody></concept>';
    const result = expectFailure(spliceAndVerifyAiXml(xml, extraction, candidate));

    expect(result.errorCode).toBe('xml-declaration-changed');
    expect(result.verification.wellFormed).toBe(true);
    expect(result.verification.preservedXmlDeclaration).toBe(false);
  });

  it('rejects a candidate element the parent model does not allow', () => {
    expect(isChildAllowed('concept', 'p')).toBe(false);
    const extraction = extract(SIMPLE, [0]);
    expect(extraction.targetTag).toBe('title');
    expect(extraction.parentTag).toBe('concept');

    const result = expectFailure(spliceAndVerifyAiXml(SIMPLE, extraction, '<p>不该出现在这里</p>'));
    expect(result.errorCode).toBe('structure-invalid');
    expect(result.verification.structureValid).toBe(false);
    expect(result.verification.wellFormed).toBe(true);
    expect(result.patchedXml).not.toBeNull();
    expect(result.errorMessage).toContain('不允许');
  });

  it('rejects a patch that changes the document root tag', () => {
    const extraction = extract(SIMPLE, []);
    const candidate = '<task id="t"><title>t</title><taskbody><p>x</p></taskbody></task>';
    const result = expectFailure(spliceAndVerifyAiXml(SIMPLE, extraction, candidate));

    expect(result.errorCode).toBe('structure-invalid');
    expect(result.verification.structureValid).toBe(false);
    expect(result.errorMessage).toContain('根元素被改动');
  });

  it('rejects a candidate the Visual ProseMirror converter cannot handle', () => {
    const extraction = extract(SIMPLE, [1, 0]);
    pmMock.fail = true;
    try {
      const result = expectFailure(spliceAndVerifyAiXml(SIMPLE, extraction, '<p>来自 AI</p>'));
      expect(result.errorCode).toBe('prosemirror-incompatible');
      expect(result.verification.wellFormed).toBe(true);
      expect(result.verification.prosemirrorCompatible).toBe(false);
      expect(result.patchedXml).not.toBeNull();
    } finally {
      pmMock.fail = false;
    }

    const recovered = expectSuccess(spliceAndVerifyAiXml(SIMPLE, extraction, '<p>来自 AI</p>'));
    expect(recovered.verification.prosemirrorCompatible).toBe(true);
  });

  it('rejects a patch that breaks well-formedness', () => {
    const extraction = extract(SIMPLE, [1, 0]);
    const result = expectFailure(spliceAndVerifyAiXml(SIMPLE, extraction, '<p>未闭合'));

    expect(result.errorCode).toBe('candidate-malformed');
    expect(result.patchedXml).toBeNull();
  });

  it('preserves codeblock whitespace verbatim', () => {
    const extraction = extract(DOC, [1, 2, 1]);
    expect(extraction.targetTag).toBe('codeblock');
    expect(extraction.parentTag).toBe('section');

    const candidate =
      '<codeblock xml:space="preserve" outputclass="language-xml">line1\n' +
      '  line2\n' +
      '      line3</codeblock>';
    const result = expectSuccess(spliceAndVerifyAiXml(DOC, extraction, candidate));

    expect(normalizeCandidateXml(candidate)).toBe(candidate);
    expect(result.patchedXml).toContain(candidate);
    expect(result.patchedXml).toBe(DOC.replace(extraction.targetXml, candidate));
  });

  it('is idempotent: splicing the extracted target back yields the original document', () => {
    const extraction = extract(DOC, [1, 0]);
    const result = expectSuccess(spliceAndVerifyAiXml(DOC, extraction, extraction.targetXml));

    expect(result.patchedXml).toBe(DOC);
    expect(result.targetXml).toBe(extraction.targetXml);
  });

  it('keeps entities and xml:space untouched', () => {
    const xml =
      '<concept id="c"><title>t</title><conbody>' +
      '<p xml:space="preserve">a &amp; b &lt;tag&gt;</p>' +
      '</conbody></concept>';
    const extraction = extract(xml, [1, 0]);
    expect(extraction.targetXml).toBe('<p xml:space="preserve">a &amp; b &lt;tag&gt;</p>');

    const candidate = '<p xml:space="preserve">a &amp; b &lt;tag&gt; 与 &quot;引号&quot;</p>';
    const result = expectSuccess(spliceAndVerifyAiXml(xml, extraction, candidate));

    expect(result.patchedXml).toContain('&amp; b &lt;tag&gt;');
    expect(result.patchedXml).toContain('&quot;引号&quot;');

    const parsed = checkXmlWellFormed(result.patchedXml);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const p = parsed.parsed.document.documentElement.getElementsByTagName('p')[0]!;
      expect(p.textContent).toBe('a & b <tag> 与 "引号"');
      expect(p.getAttribute('xml:space')).toBe('preserve');
    }

    const reparsed = parseXml(result.patchedXml);
    expect(reparsed.document.documentElement.tagName).toBe('concept');
  });

  it('rejects an extraction whose offsets no longer match the original XML', () => {
    const extraction = extract(SIMPLE, [1, 0]);
    const result = expectFailure(
      spliceAndVerifyAiXml(`${SIMPLE}\n`, extraction, '<p>来自 AI</p>'),
    );
    expect(result.errorCode).toBe('invalid-target');
  });
});

describe('buildDitaConstraintSummary — prompt constraints', () => {
  it('stays within 2500 chars and mirrors dita-rules child models', () => {
    const summary = buildDitaConstraintSummary('concept', 'conbody');

    expect(summary.length).toBeLessThanOrEqual(2500);
    expect(summary).toContain('<concept>');
    expect(summary).toContain('<conbody>');
    expect(summary).toContain('codeph');
    for (const tag of ['p', 'ul', 'section'] as const) {
      expect(getAllowedChildElementTags('conbody')).toContain(tag);
      expect(summary).toContain(tag);
    }
    expect(summary).toMatch(/不要虚构/);

    expect(buildDitaConstraintSummary(null, null).length).toBeLessThanOrEqual(2500);
    expect(buildDitaConstraintSummary('concept', 'unmodeled_xyz').length).toBeLessThanOrEqual(
      2500,
    );
  });
});

describe('widenAiFixTarget — a reported line is not always the cause', () => {
  // DITA-OT reports the duplicated `<cmd>` on the step's `</step>` (line 5); the cause is line 4.
  const STEPS =
    '<task id="t"><title>T</title><taskbody><steps>\n' +
    '  <step>\n' +
    '    <cmd>a</cmd>\n' +
    '    <cmd>a</cmd>\n' +
    '  </step>\n' +
    '  <step><cmd>b</cmd></step>\n' +
    '</steps></taskbody></task>';

  it('expands the window to the enclosing element so the real cause is editable', () => {
    const widened = widenAiFixTarget(STEPS, { mode: 'line-window', line: 5, column: 3, lineEnd: 5 });

    expect(widened).toEqual({ mode: 'line-window', line: 2, column: 3, lineEnd: 5 });
  });

  it('lets the assistant delete the duplicated line the one-line window could never reach', () => {
    const target = widenAiFixTarget(STEPS, { mode: 'line-window', line: 5, lineEnd: 5 });
    const extraction = extractTargetFragment(STEPS, target);
    const candidate = '  <step>\n    <cmd>a</cmd>\n  </step>';
    const result = expectSuccess(spliceAndVerifyAiXml(STEPS, extraction, candidate, 'zh-CN'));

    expect(result.patchedXml).toBe(
      '<task id="t"><title>T</title><taskbody><steps>\n' +
        '  <step>\n' +
        '    <cmd>a</cmd>\n' +
        '  </step>\n' +
        '  <step><cmd>b</cmd></step>\n' +
        '</steps></taskbody></task>',
    );
  });

  it('falls back to the whole document when the enclosing element is too wide', () => {
    expect(
      widenAiFixTarget(STEPS, { mode: 'line-window', line: 5, lineEnd: 5 }, { maxLines: 3 }),
    ).toEqual({ mode: 'full-document' });
  });

  it('keeps element and full-document targets untouched', () => {
    const element = { mode: 'element' as const, elementPath: [1] };
    expect(widenAiFixTarget(STEPS, element)).toBe(element);
    const full = { mode: 'full-document' as const };
    expect(widenAiFixTarget(STEPS, full)).toBe(full);
  });

  it('leaves line windows alone when the XML cannot be parsed', () => {
    const broken = '<topic><title>T</title><body><p>oops</body></topic>';
    const target = { mode: 'line-window' as const, line: 1, column: 1, lineEnd: 1 };
    expect(widenAiFixTarget(broken, target)).toEqual(target);
  });

  it('keeps the reported line inside every widened window', () => {
    for (const line of [1, 2, 3, 4, 5, 6, 7]) {
      const widened = widenAiFixTarget(STEPS, { mode: 'line-window', line, lineEnd: line });
      if (widened.mode === 'full-document') continue;
      expect(widened.line).toBeLessThanOrEqual(line);
      expect(widened.lineEnd).toBeGreaterThanOrEqual(line);
    }
  });
});
