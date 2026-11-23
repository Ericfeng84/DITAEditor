import { describe, expect, it } from 'vitest';
import {
  createTopicTemplate,
  DITA_SAMPLE_DOCUMENTS,
  findDomElementByPath,
  findElementPathAtOffset,
  findPmPosByElementPath,
  getAllowedChildElements,
  getAllowedChildElementTags,
  getAttributesForElement,
  getNodeSourceRange,
  getPmNodeTagName,
  getRawAttr,
  isChildAllowed,
  parseXml,
  resolvePmElementPath,
  roundTripXmlThroughPm,
  setRawAttr,
  type DitaTopicTemplateType,
} from '../src/index.js';

describe('DITA 1.3 Rules, Templates, and Bidirectional Path Mapping', () => {
  const templateTypes: DitaTopicTemplateType[] = ['concept', 'task', 'reference', 'topic'];

  for (const type of templateTypes) {
    it(`creates a valid lossless ${type} template`, () => {
      const xml = createTopicTemplate(type, { id: `test_${type}`, title: `Sample ${type}` });
      const pass1 = roundTripXmlThroughPm(xml);
      expect(pass1.xml).toBe(xml);
      const pass2 = roundTripXmlThroughPm(pass1.xml);
      expect(pass2.xml).toBe(xml);
    });
  }

  for (const sample of DITA_SAMPLE_DOCUMENTS) {
    it(`round-trips built-in sample "${sample.id}" with zero diff`, () => {
      const pass1 = roundTripXmlThroughPm(sample.xml);
      expect(pass1.xml).toBe(sample.xml);
      const pass2 = roundTripXmlThroughPm(pass1.xml);
      expect(pass2.xml).toBe(sample.xml);
    });
  }

  it('enforces DITA 1.3 parent -> child content model rules', () => {
    expect(getAllowedChildElementTags('steps')).toEqual(['stepsection', 'step']);
    expect(isChildAllowed('steps', 'step')).toBe(true);
    expect(isChildAllowed('steps', 'stepsection')).toBe(true);
    expect(isChildAllowed('steps', 'p')).toBe(false);

    expect(isChildAllowed('taskbody', 'steps')).toBe(true);
    expect(isChildAllowed('taskbody', 'prereq')).toBe(true);
    expect(isChildAllowed('taskbody', 'p')).toBe(false);

    const stepBlocks = getAllowedChildElements('step', 'block').map((s) => s.tag);
    expect(stepBlocks).toContain('cmd');
    expect(stepBlocks).toContain('info');
    expect(stepBlocks).toContain('substeps');
    expect(stepBlocks).toContain('choices');
    expect(stepBlocks).toContain('stepresult');

    const titleInline = getAllowedChildElements('title', 'inline').map((s) => s.tag);
    expect(titleInline).toContain('codeph');
    expect(titleInline).toContain('keyword');
    expect(getAllowedChildElements('title', 'block').map((s) => s.tag)).not.toContain('p');
  });

  it('provides element-specific, core, profiling, and reuse attributes', () => {
    const noteAttrs = getAttributesForElement('note');
    const noteType = noteAttrs.find((a) => a.name === 'type');
    expect(noteType?.values).toContain('tip');
    expect(noteType?.values).toContain('warning');
    expect(noteAttrs.some((a) => a.name === 'audience' && a.group === 'profiling')).toBe(true);
    expect(noteAttrs.some((a) => a.name === 'conref' && a.group === 'reuse')).toBe(true);

    const xrefAttrs = getAttributesForElement('xref');
    expect(xrefAttrs.find((a) => a.name === 'scope')?.values).toEqual(['local', 'peer', 'external']);
  });

  it('updates rawAttrs in-place without reordering unrelated attributes', () => {
    const initial = [
      { name: 'id', value: 'n1', namespaceURI: null },
      { name: 'type', value: 'note', namespaceURI: null },
      { name: 'audience', value: 'dev', namespaceURI: null },
    ];

    const updated = setRawAttr(initial, 'type', 'warning');
    expect(updated.map((a) => a.name)).toEqual(['id', 'type', 'audience']);
    expect(getRawAttr(updated, 'type')).toBe('warning');

    const appended = setRawAttr(updated, 'product', 'cloud');
    expect(appended.map((a) => a.name)).toEqual(['id', 'type', 'audience', 'product']);

    const removed = setRawAttr(appended, 'type', null);
    expect(removed.map((a) => a.name)).toEqual(['id', 'audience', 'product']);
  });

  it('maps ProseMirror element positions to XML source line/offset and back', () => {
    const sample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-reference')!;
    const { pmDoc } = roundTripXmlThroughPm(sample.xml);
    const parsed = parseXml(sample.xml, { position: true });

    // Locate the first <entry> containing "Java Worker" in ProseMirror
    let targetPos = -1;
    pmDoc.descendants((node, pos) => {
      if (node.type.name === 'cals_entry' && node.textContent.includes('Java Worker')) {
        targetPos = pos + 2; // inside xml_text_block -> text
        return false;
      }
      return true;
    });
    expect(targetPos).toBeGreaterThan(0);

    const path = resolvePmElementPath(pmDoc, targetPos);
    expect(path.length).toBeGreaterThan(3);

    const domEl = findDomElementByPath(parsed.document, path);
    expect(domEl?.tagName).toBe('entry');
    expect(domEl?.textContent).toBe('Java Worker');

    const range = getNodeSourceRange(domEl!);
    expect(range.open?.line).toBeGreaterThan(20);
    expect(range.open?.start).toBeGreaterThan(0);

    // Reverse lookup: XML offset -> path -> ProseMirror pos
    const reversePath = findElementPathAtOffset(parsed.document, range.open!.start + 2);
    expect(reversePath).toEqual(path);

    const resolvedPmPos = findPmPosByElementPath(pmDoc, reversePath);
    expect(resolvedPmPos).not.toBeNull();
    const $resolved = pmDoc.resolve(resolvedPmPos!);
    expect(getPmNodeTagName($resolved.parent)).toBe('entry');
  });
});
