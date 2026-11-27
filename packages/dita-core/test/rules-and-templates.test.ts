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
  getAttributeDescription,
  getAttributeExample,
  getAttributeGroupMeta,
  getAttributeLabel,
  getAttributeUsage,
  getAttributeValueLabel,
  formatAttributeOptionLabel,
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

const ATTRIBUTE_GROUPS = ['element', 'core', 'localization', 'profiling', 'reuse', 'presentation'] as const;

/** Representative elements covering every registered attribute group and element-specific spec. */
const REPRESENTATIVE_ELEMENTS: readonly string[] = [
  'topic',
  'concept',
  'task',
  'reference',
  'map',
  'topicref',
  'mapref',
  'topichead',
  'topicgroup',
  'keydef',
  'note',
  'xref',
  'link',
  'image',
  'codeblock',
  'pre',
  'keyword',
  'ph',
  'term',
  'step',
  'simpletable',
  'table',
  'tgroup',
  'colspec',
  'entry',
  'fn',
  'p',
];

const DOCUMENT_ROOTS: readonly string[] = ['topic', 'concept', 'task', 'reference', 'map'];

function groupOf(tagName: string, attrName: string): string | undefined {
  return getAttributesForElement(tagName).find((a) => a.name === attrName)?.group;
}

describe('DITA attribute grouping (core vs localization, root xml:lang promotion)', () => {
  it('keeps only id and outputclass in the high-frequency core group', () => {
    for (const tagName of ['p', 'note', 'topicref', 'step', 'entry', 'keyword']) {
      const coreNames = getAttributesForElement(tagName)
        .filter((a) => a.group === 'core')
        .map((a) => a.name);
      expect(coreNames).toEqual(['id', 'outputclass']);
    }

    // `codeblock` narrows outputclass to a syntax-highlighting language hint.
    const codeblockAttrs = getAttributesForElement('codeblock');
    expect(codeblockAttrs.filter((a) => a.name === 'outputclass')).toHaveLength(1);
    expect(groupOf('codeblock', 'outputclass')).toBe('element');

    // Document roots own their required `id`, so it is promoted to the element group.
    for (const tagName of DOCUMENT_ROOTS) {
      const attrs = getAttributesForElement(tagName);
      expect(attrs.filter((a) => a.group === 'core').map((a) => a.name)).toEqual(['outputclass']);
      expect(attrs.filter((a) => a.name === 'id' && a.group === 'element')).toHaveLength(1);
    }
  });

  it('moves xml:lang, translate, status, and dir into the localization group on inner elements', () => {
    for (const tagName of ['p', 'note', 'topicref', 'xref', 'entry', 'codeblock']) {
      for (const attrName of ['xml:lang', 'translate', 'status', 'dir']) {
        expect(groupOf(tagName, attrName)).toBe('localization');
      }
    }
  });

  it('promotes xml:lang into the element group on document roots without duplicates', () => {
    for (const tagName of DOCUMENT_ROOTS) {
      const attrs = getAttributesForElement(tagName);
      const langAttrs = attrs.filter((a) => a.name === 'xml:lang');
      expect(langAttrs).toHaveLength(1);
      expect(langAttrs[0]?.group).toBe('element');
      // The promoted root spec still exposes the language enum for the select control.
      expect(langAttrs[0]?.values).toContain('zh-CN');
      expect(attrs.filter((a) => a.name === 'translate')[0]?.group).toBe('localization');
      // No attribute name may be returned twice for any element.
      const names = attrs.map((a) => a.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('returns deduplicated attributes for every representative element', () => {
    for (const tagName of REPRESENTATIVE_ELEMENTS) {
      const names = getAttributesForElement(tagName).map((a) => a.name);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe('Bilingual attribute documentation coverage', () => {
  const locales = ['zh-CN', 'en'] as const;

  it('has non-empty label, description, and usage for every attribute in both locales', () => {
    for (const tagName of REPRESENTATIVE_ELEMENTS) {
      for (const spec of getAttributesForElement(tagName)) {
        for (const locale of locales) {
          const where = `${tagName}/@${spec.name} (${locale})`;
          expect(getAttributeLabel(spec, locale).length, where).toBeGreaterThan(0);
          expect(getAttributeDescription(spec, locale).length, where).toBeGreaterThan(0);
          const usage = getAttributeUsage(spec, locale);
          expect(usage?.length ?? 0, where).toBeGreaterThan(0);
          // Usage scenarios come from the knowledge base, never a verbatim description fallback.
          expect(usage, where).not.toBe(spec.description);
          expect(usage, where).not.toBe(spec.descriptionZh);
        }
      }
    }
  });

  it('provides a concrete example for the most common attributes', () => {
    const samples = getAttributesForElement('topicref');
    for (const attrName of ['href', 'navtitle', 'keys', 'keyref', 'chunk', 'processing-role']) {
      const spec = samples.find((a) => a.name === attrName)!;
      expect(getAttributeExample(spec, 'zh-CN')?.length ?? 0).toBeGreaterThan(0);
      expect(getAttributeExample(spec, 'en')?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('labels every enum value and renders readable select options in both locales', () => {
    const seen = new Set<string>();
    for (const tagName of REPRESENTATIVE_ELEMENTS) {
      for (const spec of getAttributesForElement(tagName)) {
        const values = spec.values ?? [];
        for (const value of values) {
          for (const locale of locales) {
            const where = `${tagName}/@${spec.name}="${value}" (${locale})`;
            const label = getAttributeValueLabel(spec, value, locale);
            expect(label?.length ?? 0, where).toBeGreaterThan(0);
            expect(label, where).not.toBe(value);
            const optionLabel = formatAttributeOptionLabel(spec, value, locale);
            expect(optionLabel, where).toContain(value);
            expect(optionLabel.length, where).toBeGreaterThan(value.length);
          }
        }
        for (const value of values) seen.add(`${spec.name}=${value}`);
      }
    }
    // Sanity: the representative set really does exercise the enum dictionaries.
    expect(seen.size).toBeGreaterThan(70);
  });

  it('renders the documented option label format', () => {
    const dirSpec = getAttributesForElement('p').find((a) => a.name === 'dir')!;
    expect(formatAttributeOptionLabel(dirSpec, 'lro', 'zh-CN')).toBe('强制左到右覆盖 (lro)');
    expect(formatAttributeOptionLabel(dirSpec, 'lro', 'en')).toBe('Force LTR override (lro)');

    const processingRole = getAttributesForElement('topicref').find((a) => a.name === 'processing-role')!;
    expect(formatAttributeOptionLabel(processingRole, 'resource-only', 'zh-CN')).toBe(
      '仅作资源（不进正文） (resource-only)',
    );
    // Unknown/specialized values fall back to the raw XML value.
    expect(formatAttributeOptionLabel(dirSpec, 'custom-dir', 'zh-CN')).toBe('custom-dir');
  });

  it('returns group metadata for all six groups in both locales', () => {
    for (const group of ATTRIBUTE_GROUPS) {
      for (const locale of locales) {
        const meta = getAttributeGroupMeta(group, locale);
        expect(meta.title.length, `${group}/${locale}`).toBeGreaterThan(0);
        expect(meta.subtitle.length, `${group}/${locale}`).toBeGreaterThan(0);
        expect(meta.description.length, `${group}/${locale}`).toBeGreaterThan(0);
      }
      expect(getAttributeGroupMeta(group, 'zh-CN').title).not.toBe(getAttributeGroupMeta(group, 'en').title);
    }
    expect(getAttributeGroupMeta('localization', 'zh-CN').title).toBe('本地化与修订');
    expect(getAttributeGroupMeta('localization', 'en').title).toBe('Localization & status');
    expect(getAttributeGroupMeta('core', 'zh-CN').title).toBe('常用通用属性');
  });
});
