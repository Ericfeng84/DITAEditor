import { describe, expect, it } from 'vitest';
import {
  buildFallbackOutlinePlan,
  buildKeysMapXml,
  buildMapXmlFromPlan,
  buildPlannerOutlineDigest,
  extractDataUriImages,
  flattenPlannedTopics,
  keysMapPathFor,
  mountTopicsIntoExistingMap,
  normalizePlanPaths,
  parseMarkdownOutline,
  parseXml,
  sanitizeDitaTopicId,
  serializeXml,
  sliceMarkdownForTopic,
  type IngestOutlinePlan,
  type PlannedTopicNode,
} from '../src/index.js';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function samplePlan(overrides: Partial<IngestOutlinePlan> = {}): IngestOutlinePlan {
  return {
    title: 'Security Guide',
    language: 'en',
    targetMode: 'new_manual',
    mapKind: 'map',
    rootMapPath: 'security-guide.ditamap',
    topicType: 'auto',
    createKeysMap: false,
    suggestedKeys: [],
    topics: [
      {
        topicId: 'overview',
        title: 'Overview',
        type: 'concept',
        filePath: 'concepts/overview.dita',
      },
      {
        topicId: 'install',
        title: 'Install Steps',
        type: 'task',
        filePath: 'tasks/install.dita',
        children: [
          {
            topicId: 'install_linux',
            title: 'Linux',
            type: 'task',
            filePath: 'tasks/install_linux.dita',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('extractDataUriImages', () => {
  it('lifts Markdown data URIs out and preserves alt text', () => {
    const markdown = `# Doc\n\n![Architecture diagram](data:image/png;base64,${PNG_BASE64})\n`;
    const result = extractDataUriImages(markdown);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      assetId: 'img_001',
      fileName: 'img_001.png',
      extension: 'png',
      mimeType: 'image/png',
      alt: 'Architecture diagram',
    });
    expect(result.images[0]!.byteLength).toBeGreaterThan(0);
    expect(result.markdown).toContain('![Architecture diagram](asset://img_001.png)');
    expect(result.markdown).not.toContain('data:image');
  });

  it('rewrites HTML <img src="..."> while keeping the rest of the tag', () => {
    const markdown = `<p><img alt="Logo" src="data:image/jpeg;base64,${PNG_BASE64}" width="120"/></p>`;
    const result = extractDataUriImages(markdown);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({ fileName: 'img_001.jpg', alt: 'Logo' });
    expect(result.markdown).toBe(
      '<p><img alt="Logo" src="asset://img_001.jpg" width="120"/></p>',
    );
  });

  it('handles multiline base64 and continues numbering after existing assets', () => {
    const multiline = `${PNG_BASE64.slice(0, 40)}\n${PNG_BASE64.slice(40, 80)}\r\n${PNG_BASE64.slice(80)}`;
    const markdown = [
      '![one](asset://img_007.png)',
      `![two](data:image/gif;base64,${multiline})`,
      `<img src='data:image/webp;base64,${multiline}'>`,
    ].join('\n');
    const result = extractDataUriImages(markdown);

    expect(result.images.map((image) => image.assetId)).toEqual(['img_008', 'img_009']);
    expect(result.images[0]!.base64).not.toMatch(/\s/);
    expect(result.markdown).toContain('![two](asset://img_008.gif)');
    expect(result.markdown).toContain("<img src='asset://img_009.webp'>");
  });

  it('leaves unsupported or plain content untouched', () => {
    const markdown = '![remote](https://example.com/a.png)\n\nNo images here.';
    const result = extractDataUriImages(markdown);
    expect(result.images).toHaveLength(0);
    expect(result.markdown).toBe(markdown);
  });
});

describe('parseMarkdownOutline', () => {
  const markdown = [
    'Intro paragraph before any heading.',
    '',
    '# Main Title',
    '',
    'Short intro.',
    '',
    '## Steps',
    '',
    '| a | b |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '```bash',
    '# not a heading',
    'echo hi',
    '```',
    '',
    'Setext Section',
    '--------------',
    '',
    `![shot](asset://img_003.png)`,
  ].join('\n');

  it('parses ATX/Setext headings, skips fences, and records features', () => {
    const sections = parseMarkdownOutline(markdown);

    expect(sections.map((section) => section.id)).toEqual([
      'sec_001',
      'sec_002',
      'sec_003',
      'sec_004',
    ]);
    expect(sections[0]).toMatchObject({ level: 0, heading: '', startLine: 1, endLine: 2 });
    expect(sections[1]).toMatchObject({ level: 1, heading: 'Main Title', startLine: 3 });
    expect(sections[2]).toMatchObject({
      level: 2,
      heading: 'Steps',
      hasTable: true,
      hasCode: true,
    });
    expect(sections[3]).toMatchObject({
      level: 2,
      heading: 'Setext Section',
      imageAssetIds: ['img_003.png'],
    });
    expect(sections.every((section) => section.charCount > 0)).toBe(true);
  });

  it('returns a single section when there are no headings', () => {
    const plain = 'just text\nand more text';
    const sections = parseMarkdownOutline(plain);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ id: 'sec_001', level: 1, heading: '', startLine: 1 });
    expect(sections[0]!.charCount).toBe(plain.length);
  });

  it('does not treat a "#" inside a fence as a heading', () => {
    const fenced = ['```', '# nope', '```', '# Yes'].join('\n');
    const sections = parseMarkdownOutline(fenced);
    expect(sections.map((section) => section.heading)).toEqual(['', 'Yes']);
  });
});

describe('planner digest and topic slicing', () => {
  const markdown = [
    '# Alpha',
    '',
    'Alpha body text that explains the first area in enough detail.',
    '',
    '## Alpha Detail',
    '',
    'More alpha detail.',
    '',
    '# Beta',
    '',
    'Beta body text.',
  ].join('\n');

  it('builds a bounded digest with section ids and excerpts', () => {
    const sections = parseMarkdownOutline(markdown);
    const digest = buildPlannerOutlineDigest(markdown, sections, 4000);
    expect(digest).toContain('sec_001');
    expect(digest).toContain('Alpha body text');
    expect(digest.length).toBeLessThanOrEqual(4000);

    const tiny = buildPlannerOutlineDigest(markdown, sections, 120);
    expect(tiny.length).toBeLessThanOrEqual(120);
  });

  it('slices exact section ranges and falls back to the whole document', () => {
    const sections = parseMarkdownOutline(markdown);
    const alpha = sliceMarkdownForTopic(markdown, sections, ['sec_001', 'sec_002']);
    expect(alpha.markdown).toContain('# Alpha');
    expect(alpha.markdown).toContain('More alpha detail.');
    expect(alpha.markdown).not.toContain('# Beta');
    expect(alpha.truncated).toBe(false);

    const all = sliceMarkdownForTopic(markdown, sections, []);
    expect(all.markdown).toBe(markdown);

    const truncated = sliceMarkdownForTopic(markdown, sections, [], 30);
    expect(truncated.truncated).toBe(true);
    expect(truncated.markdown.length).toBeLessThanOrEqual(30);
  });
});

describe('sanitizeDitaTopicId / flattenPlannedTopics', () => {
  it('produces valid ids and falls back for non-ASCII titles', () => {
    expect(sanitizeDitaTopicId('Install Guide!', 'x')).toBe('install_guide');
    expect(sanitizeDitaTopicId('123 Start', 'x')).toBe('id_123_start');
    expect(sanitizeDitaTopicId('__', 'fallback name')).toBe('fallback_name');
    expect(sanitizeDitaTopicId('产品安装', 'topic_1')).toBe('topic_1');
    expect(sanitizeDitaTopicId('', '')).toBe('topic');
  });

  it('flattens depth-first in document order', () => {
    const plan = samplePlan();
    expect(flattenPlannedTopics(plan.topics).map((node) => node.topicId)).toEqual([
      'overview',
      'install',
      'install_linux',
    ]);
  });
});

describe('normalizePlanPaths', () => {
  it('sanitizes ids and paths, guarantees uniqueness and extensions', () => {
    const plan = normalizePlanPaths(samplePlan(), {
      existingPaths: new Set(['concepts/overview.dita']),
    });
    const flat = flattenPlannedTopics(plan.topics);

    expect(plan.rootMapPath).toBe('security-guide.ditamap');
    expect(flat.map((node) => node.topicId)).toEqual(['overview', 'install', 'install_linux']);
    expect(flat[0]!.filePath).toBe('concepts/overview_2.dita');
    expect(flat.every((node) => node.filePath.endsWith('.dita'))).toBe(true);
    expect(new Set(flat.map((node) => node.filePath)).size).toBe(flat.length);
  });

  it('uses type folders, targetDir, and never emits .. segments', () => {
    const plan = normalizePlanPaths(
      samplePlan({
        rootMapPath: '../../evil.ditamap',
        topics: [
          { topicId: 'a', title: 'A', type: 'concept', filePath: '' },
          { topicId: 'b', title: 'B', type: 'task', filePath: '../escape/../b.xml' },
          { topicId: 'c', title: 'C', type: 'reference', filePath: 'flat' },
        ],
      }),
      { targetDir: 'docs/topics' },
    );
    const flat = flattenPlannedTopics(plan.topics);

    expect(plan.rootMapPath).toBe('evil.ditamap');
    expect(flat[0]!.filePath).toBe('docs/topics/a.dita');
    expect(flat[1]!.filePath).toBe('escape/b.dita');
    expect(flat[2]!.filePath).toBe('docs/topics/flat.dita');
    expect(flat.some((node) => node.filePath.includes('..'))).toBe(false);
  });

  it('normalizes the root map extension to .ditamap', () => {
    const plan = normalizePlanPaths(samplePlan({ rootMapPath: 'book' }));
    expect(plan.rootMapPath).toBe('book.ditamap');
  });
});

describe('buildMapXmlFromPlan / buildKeysMapXml', () => {
  it('generates a valid DITA 1.3 map with relative topicrefs', () => {
    const plan = normalizePlanPaths(
      samplePlan({ rootMapPath: 'maps/root.ditamap', createKeysMap: true, suggestedKeys: [{ keys: 'product_name', keyword: 'Acme' }] }),
    );
    const xml = buildMapXmlFromPlan(plan);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">');
    expect(xml).toContain('<title>Security Guide</title>');
    expect(xml).toContain('<mapref href="keys.ditamap" processing-role="resource-only"/>');
    expect(xml).toContain('<topicref href="../concepts/overview.dita"/>');
    expect(xml).toContain('<topicref href="../tasks/install.dita">');
    expect(xml).toContain('<topicref href="../tasks/install_linux.dita"/>');
    expect(() => parseXml(xml)).not.toThrow();
  });

  it('generates a keys map with sanitized, deduplicated keydefs', () => {
    const plan = normalizePlanPaths(
      samplePlan({
        createKeysMap: true,
        suggestedKeys: [
          { keys: 'product name', keyword: 'Acme <One>' },
          { keys: 'product_name', keyword: 'Duplicate' },
          { keys: '#bad key', keyword: 'Bad' },
        ],
      }),
    );
    expect(keysMapPathFor(plan.rootMapPath)).toBe('keys.ditamap');
    const xml = buildKeysMapXml(plan);

    expect(xml).toContain('<keydef keys="product_name">');
    expect(xml).toContain('<keyword>Acme &lt;One&gt;</keyword>');
    expect(xml.match(/<keydef /g)).toHaveLength(2);
    expect(xml).not.toContain('Duplicate');
    expect(() => parseXml(xml)).not.toThrow();
  });
});

describe('mountTopicsIntoExistingMap', () => {
  const existingMap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
    '<!-- keep this comment -->',
    '<?xml-model href="map.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>',
    '<map id="root" xml:lang="en" xmlns:ditaarch="http://dita.oasis-open.org/architecture/2005/">',
    '  <title>Existing Map</title>',
    '  <topicref href="intro.dita" navtitle="Intro" keys="intro"/>',
    '  <reltable>',
    '    <relheader>',
    '      <relcolspec/>',
    '    </relheader>',
    '  </reltable>',
    '</map>',
    '',
  ].join('\n');

  const topics: PlannedTopicNode[] = [
    {
      topicId: 'new_topic',
      title: 'New Topic',
      type: 'concept',
      filePath: 'concepts/new_topic.dita',
    },
    {
      topicId: 'parent',
      title: 'Parent',
      type: 'task',
      filePath: 'tasks/parent.dita',
      children: [
        { topicId: 'child', title: 'Child', type: 'task', filePath: 'tasks/child.dita', navTitle: 'Child Task' },
      ],
    },
  ];

  it('mounts nested topicrefs before reltable without touching the prolog', () => {
    const mounted = mountTopicsIntoExistingMap(existingMap, {
      mapPath: 'root.ditamap',
      parentElementPath: null,
      topics,
    });

    expect(mounted).toContain('<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">');
    expect(mounted).toContain('<!-- keep this comment -->');
    expect(mounted).toContain('<?xml-model href="map.rng"');
    expect(mounted).toContain('<topicref href="intro.dita" navtitle="Intro" keys="intro"/>');
    expect(mounted).toContain('<topicref href="concepts/new_topic.dita"/>');
    expect(mounted).toContain('<topicref href="tasks/parent.dita">');
    expect(mounted).toContain('<topicref href="tasks/child.dita" navtitle="Child Task"/>');
    expect(mounted.indexOf('concepts/new_topic.dita')).toBeLessThan(mounted.indexOf('<reltable>'));
    expect(mounted).toContain('xmlns:ditaarch="http://dita.oasis-open.org/architecture/2005/"');

    // Deterministic: serializing the mounted document again is a fixed point.
    expect(serializeXml(parseXml(mounted))).toBe(mounted);
  });

  it('mounts into an explicit parent element path', () => {
    const mounted = mountTopicsIntoExistingMap(existingMap, {
      mapPath: 'root.ditamap',
      parentElementPath: [1],
      topics: [topics[0]!],
    });
    const nested = mounted.slice(mounted.indexOf('<topicref href="intro.dita"'));
    expect(nested).toContain('<topicref href="concepts/new_topic.dita"/>');
    expect(mounted).toContain('<reltable>');
  });

  it('throws for an unresolvable parent path', () => {
    expect(() =>
      mountTopicsIntoExistingMap(existingMap, {
        mapPath: 'root.ditamap',
        parentElementPath: [99],
        topics,
      }),
    ).toThrow(/does not resolve/);
  });
});

describe('buildFallbackOutlinePlan', () => {
  const markdown = [
    '# Installation',
    '',
    'Follow these steps to install the product.',
    '',
    '## Step 1',
    '',
    'Download the package.',
    '',
    '# Command Reference',
    '',
    '| Option | Meaning |',
    '| --- | --- |',
    '| -v | verbose |',
  ].join('\n');

  it('builds typed topics from headings with section ids', () => {
    const plan = buildFallbackOutlinePlan(markdown, {
      sourceFilename: 'my-manual.docx',
      targetMode: 'new_manual',
    });

    expect(plan.title).toBe('Installation');
    expect(plan.rootMapPath).toBe('installation.ditamap');
    expect(plan.topics).toHaveLength(2);
    expect(plan.topics[0]).toMatchObject({ title: 'Installation', type: 'task' });
    expect(plan.topics[0]!.filePath).toBe('tasks/installation.dita');
    expect(plan.topics[0]!.sectionIds?.length).toBe(2);
    expect(plan.topics[1]).toMatchObject({ title: 'Command Reference', type: 'reference' });
    expect(plan.topics[1]!.filePath).toBe('references/command_reference.dita');
  });

  it('falls back to a single topic when the document has no headings', () => {
    const plan = buildFallbackOutlinePlan('Only body text.', {
      sourceFilename: 'notes.txt',
      targetMode: 'single_topic',
      targetDir: 'topics/imported',
      topicType: 'concept',
    });
    expect(plan.title).toBe('notes');
    expect(plan.topics).toHaveLength(1);
    expect(plan.topics[0]!.filePath).toBe('topics/imported/notes.dita');
  });
});
