import { describe, expect, it } from 'vitest';
import {
  DITA_CONTENT_MODEL,
  DITA_SEQUENCE_MODEL,
  DITA_ELEMENT_SPECS,
  checkXmlStructure,
  getAllowedChildElementTags,
  getElementSpec,
  getInsertableTagsBySequence,
  getInsertionSlot,
  isChildAllowed,
  pmDocToXml,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '../src/index.js';

/**
 * Concept-topic grammar (OASIS DITA 1.3 `concept.dtd`), verified against the real DTD with
 * Xerces: every XML literal below validates, so the engine must model them without inventing
 * structural warnings.
 *
 *   concept  = (title, titlealts?, (abstract | shortdesc)?, prolog?, conbody?, related-links?,
 *               concept-info-types*)
 *   conbody  = ((body.cnt)*, (section | example | conbodydiv)*)   <- ordered!
 *   section  = (section.cnt)*   // no nested section, no example, but sectiondiv is legal
 */
const EXTENDED_CONCEPT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept_overview">
  <title>Concept Overview</title>
  <shortdesc>Summary of the concept.</shortdesc>
  <conbody>
    <p>Intro paragraph citing <cite>RFC 6749</cite> and the <term>issuer</term>.</p>
    <conbodydiv>
      <section id="sec_a">
        <title>Section A</title>
        <sectiondiv>
          <p>Grouped paragraph.</p>
        </sectiondiv>
      </section>
      <example id="ex_a">
        <title>Example</title>
        <p>Sample.</p>
      </example>
    </conbodydiv>
  </conbody>
  <concept id="concept_child">
    <title>Child Concept</title>
    <conbody>
      <p>Child body.</p>
    </conbody>
  </concept>
</concept>
`;

const TRAILING_PARAGRAPH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept_trailing">
  <title>Trailing Paragraph</title>
  <conbody>
    <section id="sec_a">
      <title>Section A</title>
      <p>Section paragraph.</p>
    </section>
    <p>Orphan paragraph after the section.</p>
  </conbody>
</concept>
`;

const TOPIC_TRAILING_PARAGRAPH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="topic_trailing">
  <title>Trailing Paragraph</title>
  <body>
    <section id="sec_a">
      <title>Section A</title>
      <p>Section paragraph.</p>
    </section>
    <p>Paragraph after the section (legal inside body).</p>
  </body>
</topic>
`;

describe('concept grammar (DITA 1.3 concept.dtd)', () => {
  it('models the DITA 1.3 concept-body divisions', () => {
    for (const tag of ['conbodydiv', 'sectiondiv']) {
      const spec = DITA_ELEMENT_SPECS.get(tag);
      expect(spec, tag).toBeDefined();
      expect(spec!.kind).toBe('block');
      expect(spec!.pmNodeType).toBe(`dita_${tag.replace(/-/g, '_')}`);
    }

    // concept.mod: (body.cnt)*, (section | example | conbodydiv)*
    expect(getAllowedChildElementTags('conbody')).toEqual(
      expect.arrayContaining(['section', 'example', 'conbodydiv', 'p']),
    );
    // conbodydiv holds only sections and examples.
    expect(getAllowedChildElementTags('conbodydiv')).toEqual(['section', 'example']);
    // section.cnt has no nested <section> / <example>, but does allow <sectiondiv>.
    expect(isChildAllowed('section', 'sectiondiv')).toBe(true);
    expect(isChildAllowed('section', 'section')).toBe(false);
    expect(isChildAllowed('section', 'example')).toBe(false);
    expect(isChildAllowed('sectiondiv', 'sectiondiv')).toBe(true);
  });

  it('allows a concept to nest concepts (info-types override) but not other topic types', () => {
    expect(isChildAllowed('concept', 'concept')).toBe(true);
    expect(isChildAllowed('concept', 'task')).toBe(false);
    expect(isChildAllowed('task', 'task')).toBe(true);
    expect(isChildAllowed('concept', 'concept')).toBe(true);
    const slots = DITA_SEQUENCE_MODEL.concept ?? [];
    expect(slots.at(-1)).toMatchObject({ tags: ['concept'], occurrence: 'zeroOrMore' });
  });

  it('orders conbody children but leaves topic/body unordered', () => {
    expect(validateChildSequence('conbody', ['p', 'section', 'example'])).toEqual([]);
    expect(validateChildSequence('conbody', ['section', 'p'])[0]).toMatchObject({
      code: 'child-out-of-order',
      parentTag: 'conbody',
      childTag: 'p',
    });
    expect(validateChildSequence('body', ['section', 'p'])).toEqual([]);
  });

  it('moves an out-of-order insert to a legal index instead of producing invalid XML', () => {
    // A paragraph requested after an existing section is slotted in front of it.
    expect(getInsertionSlot('conbody', ['section'], 'p')).toMatchObject({ ok: true, index: 0 });
    expect(getInsertionSlot('conbody', ['p', 'section'], 'example')).toMatchObject({
      ok: true,
      index: 2,
    });
    expect(getInsertionSlot('concept', ['title', 'conbody'], 'concept')).toMatchObject({
      ok: true,
      index: 2,
    });
  });

  it('offers the concept-body divisions in the insert menu', () => {
    expect(getInsertableTagsBySequence('conbody', ['p'], ['section', 'conbodydiv', 'p'])).toEqual([
      'section',
      'conbodydiv',
      'p',
    ]);
    expect(getInsertableTagsBySequence('section', ['title'], ['sectiondiv', 'p', 'example'])).toEqual(
      ['sectiondiv', 'p', 'example'],
    );
    // concept-body division contents
    expect(getInsertableTagsBySequence('conbodydiv', [], ['section', 'example', 'p'])).toEqual([
      'section',
      'example',
      'p',
    ]);
  });

  it('round-trips the extended concept losslessly and without structure warnings', () => {
    const { pmDoc } = xmlToPmDoc(EXTENDED_CONCEPT_XML, { position: false });
    expect(validatePmStructure(pmDoc)).toEqual([]);
    expect(pmDocToXml(pmDoc)).toBe(EXTENDED_CONCEPT_XML);
    // Idempotency: a second pass is byte-identical.
    const again = pmDocToXml(xmlToPmDoc(EXTENDED_CONCEPT_XML, { position: false }).pmDoc);
    expect(again).toBe(EXTENDED_CONCEPT_XML);

    const check = checkXmlStructure(EXTENDED_CONCEPT_XML);
    expect(check.ok && check.issues).toEqual([]);
  });

  it('flags a trailing paragraph after a section inside conbody', () => {
    const { pmDoc } = xmlToPmDoc(TRAILING_PARAGRAPH_XML, { position: false });
    const pmIssues = validatePmStructure(pmDoc);
    expect(pmIssues).toHaveLength(1);
    expect(pmIssues[0]).toMatchObject({
      code: 'child-out-of-order',
      parentTag: 'conbody',
      childTag: 'p',
    });

    const check = checkXmlStructure(TRAILING_PARAGRAPH_XML);
    expect(check.ok).toBe(true);
    expect(check.ok && check.issues.some((issue) => issue.code === 'child-out-of-order')).toBe(true);
  });

  it('does not flag the same paragraph layout inside a base topic body', () => {
    const { pmDoc } = xmlToPmDoc(TOPIC_TRAILING_PARAGRAPH_XML, { position: false });
    expect(validatePmStructure(pmDoc)).toEqual([]);
    const check = checkXmlStructure(TOPIC_TRAILING_PARAGRAPH_XML);
    expect(check.ok && check.issues).toEqual([]);
    expect(pmDocToXml(pmDoc)).toBe(TOPIC_TRAILING_PARAGRAPH_XML);
  });

  it('models <cite> as an inline node and keeps <alt> a lossless passthrough', () => {
    expect(getElementSpec('cite')).toMatchObject({ kind: 'inline', pmNodeType: 'dita_cite' });
    // <alt> lives inside <image>, whose children keep the source layout, so it stays passthrough.
    expect(getElementSpec('alt')).toMatchObject({ kind: 'inline' });
    expect(getElementSpec('alt')?.pmNodeType).toBeUndefined();

    const inline = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="concept_cite">
  <title>Cite</title>
  <conbody>
    <p>See <cite>OASIS DITA 1.3</cite>.</p>
    <fig>
      <image href="a.png">
        <alt>Alt text</alt>
      </image>
    </fig>
  </conbody>
</concept>
`;
    const { pmDoc } = xmlToPmDoc(inline, { position: false });
    const names: string[] = [];
    pmDoc.descendants((node) => {
      names.push(node.type.name);
      return true;
    });
    expect(names).toContain('dita_cite');
    expect(names).toContain('unknown_inline');

    // `<alt>` keeps its content and attributes; only the whitespace layout inside `<image>` is
    // normalized by the deterministic serializer (hence the idempotency assertion).
    const back = pmDocToXml(pmDoc);
    expect(back).toContain('<cite>OASIS DITA 1.3</cite>');
    expect(back).toContain('<alt>Alt text</alt>');
    expect(pmDocToXml(xmlToPmDoc(back, { position: false }).pmDoc)).toBe(back);
  });

  it('keeps nested <concept> out of unrelated containers', () => {
    expect(DITA_CONTENT_MODEL.conbody).not.toContain('concept');
    expect(isChildAllowed('conbody', 'concept')).toBe(false);
    expect(isChildAllowed('section', 'concept')).toBe(false);
  });
});
