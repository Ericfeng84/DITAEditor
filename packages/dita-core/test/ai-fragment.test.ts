import { describe, expect, it, vi } from 'vitest';
import {
  buildDitaConstraintSummary,
  checkXmlStructure,
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

/**
 * Step 1 regression tests (docs/plans/checkin-validation-ai-fix.md §5.1 CORE-1..CORE-6): a reported
 * line is often a symptom in a sibling, so a single-line child widens to its container, and
 * structure diagnostics (`expandToParent`) buy container visibility so deduplication / reordering /
 * slot-exclusivity fixes are not applied to a too-narrow fragment.
 */
const DUPLICATE_CMD_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<?xml-model href="task.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>', // 2
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">', // 3
  '<task id="create-map-structure">', // 4
  '  <title>Create a map structure</title>', // 5
  '  <taskbody>', // 6
  '    <context><p>Create a map structure. <!-- keep one cmd per step --></p></context>', // 7
  '    <steps>', // 8
  '      <step>', // 9
  '        <cmd>Open the map editor.</cmd>', // 10
  '      </step>', // 11
  '      <step>', // 12
  '        <cmd>Choose the DITA map template.</cmd>', // 13
  '      </step>', // 14
  '      <step>', // 15
  '        <cmd>Type a map title.</cmd>', // 16
  '        <cmd>Type a map title.</cmd>', // 17
  '      </step>', // 18
  '    </steps>', // 19
  '  </taskbody>', // 20
  '</task>', // 21
].join('\n');

const MULTILINE_CMD_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">', // 2
  '<task id="t">', // 3
  '  <title>T</title>', // 4
  '  <taskbody>', // 5
  '    <context>', // 6
  '      <p>Create the map structure.</p>', // 7
  '      <p>Keep the structure flat.</p>', // 8
  '      <p>Review every step.</p>', // 9
  '    </context>', // 10
  '    <steps>', // 11
  '      <step>', // 12
  '        <cmd>Open the map editor.</cmd>', // 13
  '      </step>', // 14
  '      <step>', // 15
  '        <cmd>Choose the DITA map template.</cmd>', // 16
  '        <cmd>Type the map title and', // 17
  '  confirm the structure before', // 18
  '  saving the map.</cmd>', // 19
  '      </step>', // 20
  '    </steps>', // 21
  '  </taskbody>', // 22
  '</task>', // 23
].join('\n');

const OUT_OF_ORDER_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">', // 2
  '<task id="t">', // 3
  '  <title>T</title>', // 4
  '  <taskbody>', // 5
  '    <prereq>', // 6
  '      <p>Install the editor.</p>', // 7
  '    </prereq>', // 8
  '    <result>', // 9
  '      <p>The task finished.</p>', // 10
  '    </result>', // 11
  '    <steps>', // 12
  '      <step><cmd>Go</cmd></step>', // 13
  '    </steps>', // 14
  '  </taskbody>', // 15
  '</task>', // 16
].join('\n');

const SLOT_EXCLUSIVE_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">', // 2
  '<task id="t">', // 3
  '  <title>T</title>', // 4
  '  <taskbody>', // 5
  '    <steps>', // 6
  '      <step><cmd>Go</cmd></step>', // 7
  '    </steps>', // 8
  '    <steps-unordered>', // 9
  '      <step><cmd>Again</cmd></step>', // 10
  '    </steps-unordered>', // 11
  '  </taskbody>', // 12
  '</task>', // 13
].join('\n');

const MISSING_CMD_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">', // 2
  '<task id="t">', // 3
  '  <title>T</title>', // 4
  '  <taskbody>', // 5
  '    <steps>', // 6
  '      <step/>', // 7
  '    </steps>', // 8
  '  </taskbody>', // 9
  '</task>', // 10
].join('\n');

const MISSING_CMD_BLOCK_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>', // 1
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">', // 2
  '<task id="t">', // 3
  '  <title>T</title>', // 4
  '  <taskbody>', // 5
  '    <steps>', // 6
  '      <step>', // 7
  '        <info>Only info, no cmd.</info>', // 8
  '      </step>', // 9
  '    </steps>', // 10
  '  </taskbody>', // 11
  '</task>', // 12
].join('\n');

/** Assert a widened target is a line window and return it typed. */
function asLineWindow(target: ReturnType<typeof widenAiFixTarget>) {
  if (target.mode !== 'line-window') throw new Error(`expected line-window, got ${target.mode}`);
  return target;
}

describe('widenAiFixTarget — parent container expansion (CORE-1..CORE-5)', () => {
  it('CORE-1: widens a single-line duplicated <cmd> to the enclosing <step> instead of itself', () => {
    const target = { mode: 'line-window' as const, line: 17, column: 1, lineEnd: 17 };
    const widened = asLineWindow(widenAiFixTarget(DUPLICATE_CMD_TASK, target, { expandToParent: true }));
    // The cause (two sibling <cmd> elements) lives in the *step*, so the window must never stay
    // pinned to the single reported line.
    expect(widened.line === 17 && widened.lineEnd === 17).toBe(false);
    expect(widened.line).toBeLessThanOrEqual(15);
    expect(widened.lineEnd).toBeGreaterThanOrEqual(18);
    // Both <cmd> lines (16 and 17) are inside the window.
    expect(widened.line).toBeLessThanOrEqual(16);
    expect(widened.lineEnd).toBeGreaterThanOrEqual(17);
    // The structure validator really does report the duplicate at line 17, column 9.
    const structure = checkXmlStructure(DUPLICATE_CMD_TASK, { taskModel: 'auto' });
    if (!structure.ok) throw new Error('fixture must be well-formed');
    expect(structure.issues.map((issue) => [issue.code, issue.line, issue.column])).toEqual([
      ['child-cardinality', 17, 9],
    ]);
    // With the reported column the widening stops at <step> (lines 15-18).
    const byColumn = widenAiFixTarget(
      DUPLICATE_CMD_TASK,
      { mode: 'line-window', line: 17, column: 9, lineEnd: 17 },
      { expandToParent: true },
    );
    expect(byColumn).toEqual({ mode: 'line-window', line: 15, column: 9, lineEnd: 18 });
  });

  it('CORE-2: expands one level from a multi-line <cmd> so sibling slots stay visible', () => {
    const target = { mode: 'line-window' as const, line: 17, column: 9, lineEnd: 17 };
    const widened = asLineWindow(widenAiFixTarget(MULTILINE_CMD_TASK, target, { expandToParent: true }));
    expect(widened).toEqual({ mode: 'line-window', line: 15, column: 9, lineEnd: 20 });
    const fragment = MULTILINE_CMD_TASK.split('\n').slice(widened.line - 1, widened.lineEnd).join('\n');
    expect(fragment).toContain('<step>');
    expect(fragment).toContain('</step>');
    expect(fragment.match(/<cmd>/g)?.length).toBe(2);
    // Without the flag the multi-line child is already wide enough and stays as reported.
    expect(
      widenAiFixTarget(MULTILINE_CMD_TASK, { mode: 'line-window', line: 17, lineEnd: 19, column: 9 }),
    ).toEqual({ mode: 'line-window', line: 17, lineEnd: 19, column: 9 });
  });

  it('CORE-3: widens <steps> / <steps-unordered> reports to <taskbody>, downgrading when too wide', () => {
    const order = widenAiFixTarget(
      OUT_OF_ORDER_TASK,
      { mode: 'line-window', line: 12, column: 5, lineEnd: 12 },
      { expandToParent: true },
    );
    expect(order).toEqual({ mode: 'line-window', line: 5, column: 5, lineEnd: 15 });
    expect(
      widenAiFixTarget(
        OUT_OF_ORDER_TASK,
        { mode: 'line-window', line: 12, column: 5, lineEnd: 12 },
        { expandToParent: true, maxLines: 10 },
      ),
    ).toEqual({ mode: 'full-document' });

    const slot = widenAiFixTarget(
      SLOT_EXCLUSIVE_TASK,
      { mode: 'line-window', line: 9, column: 5, lineEnd: 9 },
      { expandToParent: true },
    );
    expect(slot).toEqual({ mode: 'line-window', line: 5, column: 5, lineEnd: 12 });
    // <taskbody> is on the second level, not the root, so the window is never empty.
    expect(slot.mode === 'line-window' && slot.lineEnd > slot.line).toBe(true);
  });

  it('CORE-4: keeps <step> inside the window when the required <cmd> is missing', () => {
    const structure = checkXmlStructure(MISSING_CMD_TASK, { taskModel: 'auto' });
    if (!structure.ok) throw new Error('fixture must be well-formed');
    const [issue] = structure.issues;
    expect(issue?.code).toBe('missing-required-child');
    expect(issue?.line).toBe(7);
    const widened = widenAiFixTarget(
      MISSING_CMD_TASK,
      { mode: 'line-window', line: issue!.line!, column: issue!.column!, lineEnd: issue!.line! },
      { expandToParent: true },
    );
    expect(widened).toEqual({ mode: 'line-window', line: 6, column: 7, lineEnd: 8 });

    const block = widenAiFixTarget(
      MISSING_CMD_BLOCK_TASK,
      { mode: 'line-window', line: 7, column: 7, lineEnd: 7 },
      { expandToParent: true },
    );
    expect(block).toEqual({ mode: 'line-window', line: 6, column: 7, lineEnd: 10 });
    const lines = MISSING_CMD_BLOCK_TASK.split('\n').slice(5, 10);
    expect(lines[0]).toBe('    <steps>');
    expect(lines[4]).toBe('    </steps>');
  });

  it('CORE-5: returns the target untouched for malformed XML, even with expandToParent', () => {
    const broken = DUPLICATE_CMD_TASK.replace(
      '        <cmd>Type a map title.</cmd>',
      '        <cmd>Type a map title.',
    );
    expect(checkXmlWellFormed(broken).ok).toBe(false);
    const target = { mode: 'line-window' as const, line: 17, column: 1, lineEnd: 17 };
    expect(widenAiFixTarget(broken, target, { expandToParent: true })).toEqual(target);
    // A non line-window target never enters the widening path at all.
    const full = { mode: 'full-document' as const };
    expect(widenAiFixTarget(broken, full, { expandToParent: true })).toBe(full);
  });
});

describe('deduplicate + splice end-to-end (CORE-6)', () => {
  it('CORE-6: a widened <step> fragment can be deduplicated and spliced back losslessly', () => {
    const reported = { mode: 'line-window' as const, line: 17, column: 9, lineEnd: 17 };
    const widened = widenAiFixTarget(DUPLICATE_CMD_TASK, reported, { expandToParent: true });
    expect(widened).toEqual({ mode: 'line-window', line: 15, column: 9, lineEnd: 18 });

    const fragment = extractTargetFragment(DUPLICATE_CMD_TASK, widened);
    expect(fragment.mode).toBe('line-window');
    if (fragment.mode !== 'line-window') throw new Error('expected line-window');
    expect(fragment.lineStart).toBe(15);
    expect(fragment.lineEnd).toBe(18);
    expect(fragment.targetXml).toContain('      <step>');
    expect(fragment.targetXml).toContain('      </step>');
    expect(fragment.targetXml.match(/<cmd>/g)?.length).toBe(2);

    const candidateXml = fragment.targetXml.replace('        <cmd>Type a map title.</cmd>\n', '');
    const spliced = spliceAndVerifyAiXml(DUPLICATE_CMD_TASK, fragment, candidateXml);
    expect(spliced.ok).toBe(true);
    if (!spliced.ok) throw new Error(`splice rejected: ${spliced.errorCode} ${spliced.errorMessage}`);
    expect(spliced.verification.wellFormed).toBe(true);
    expect(spliced.verification.preservedDoctype).toBe(true);
    expect(spliced.verification.preservedXmlDeclaration).toBe(true);
    expect(spliced.verification.structureValid).toBe(true);
    const patched = spliced.patchedXml;
    expect(patched).not.toBe(DUPLICATE_CMD_TASK);

    // Everything outside the fragment is byte-identical: prolog, xml-model, DOCTYPE, comment,
    // and the neighbouring <step> blocks.
    expect(patched.slice(0, fragment.startOffset)).toBe(
      DUPLICATE_CMD_TASK.slice(0, fragment.startOffset),
    );
    expect(patched.slice(patched.length - (DUPLICATE_CMD_TASK.length - fragment.endOffset))).toBe(
      DUPLICATE_CMD_TASK.slice(fragment.endOffset),
    );
    expect(patched.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(patched).toContain('<?xml-model');
    expect(patched).toContain('<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">');
    expect(patched).toContain('<!-- keep one cmd per step -->');
    expect(patched).toContain('        <cmd>Open the map editor.</cmd>');
    expect(patched).toContain('        <cmd>Choose the DITA map template.</cmd>');
    // Exactly one <cmd> remains inside the deduplicated step.
    expect(patched.match(/<cmd>Type a map title\.<\/cmd>/g)?.length).toBe(1);

    const after = checkXmlStructure(patched, { taskModel: 'auto' });
    if (!after.ok) throw new Error('patched XML must stay well-formed');
    expect(after.issues).toEqual([]);
    expect(checkXmlWellFormed(patched).ok).toBe(true);
  });
});
