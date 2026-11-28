import { describe, expect, it } from 'vitest';
import {
  assembleTranslatedXml,
  computeTranslatableDocumentFingerprint,
  extractTranslatableSegments,
  findElementByStructuralPath,
  hashText,
  parseAttributeStructuralPath,
  planIncrementalTranslation,
  setRootXmlLang,
} from '../src/translation/index.js';
import { checkXmlWellFormed, parseXml } from '../src/xml/parser.js';
import { serializeXml } from '../src/xml/serializer.js';

const S0 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<?xml-model href="task.rng"?>
<!-- keep this comment -->
<task id="t1" xml:lang="en-US" xmlns:ditaarch="http://dita.oasis-open.org/architecture/2005/">
  <title>Install the widget</title>
  <shortdesc>Quick <b>guide</b> for {0}.</shortdesc>
  <taskbody>
    <prereq><p>Have a <b>license</b>.</p></prereq>
    <steps>
      <step id="s1"><cmd>Open the app</cmd><info>Then wait</info></step>
      <step id="s2"><cmd>Run <codeph>setup</codeph></cmd></step>
    </steps>
    <result><p>Done.</p></result>
  </taskbody>
</task>`;

/** `T0`: the same document already translated, so structure matches `S0` one-to-one. */
const T0 = S0.replace('Install the widget', '安装小组件')
  .replace('Quick <b>guide</b> for {0}.', '快速 <b>指南</b>，用于 {0}。')
  .replace('Have a <b>license</b>.', '准备好<b>许可证</b>。')
  .replace('Open the app', '打开应用')
  .replace('Then wait', '然后等待')
  .replace('Run <codeph>setup</codeph>', '运行 <codeph>setup</codeph>')
  .replace('<p>Done.</p>', '<p>完成。</p>')
  .replace('xml:lang="en-US"', 'xml:lang="zh-CN"');

const SEGMENT_IDS = [
  'task[0]/title[0]',
  'task[0]/shortdesc[0]',
  'task[0]/taskbody[0]/prereq[0]/p[0]',
  'task[0]/taskbody[0]/steps[0]/step[0]/cmd[0]',
  'task[0]/taskbody[0]/steps[0]/step[0]/info[0]',
  'task[0]/taskbody[0]/steps[0]/step[1]/cmd[0]',
  'task[0]/taskbody[0]/result[0]/p[0]',
];

/** A `product-manual.ditamap`-shaped map: legacy root `title`, `topichead`/`topicref`/`mapref` navtitles. */
const ATTR_MAP = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- keep this comment -->
<map id="m1" title="Product Manual" xml:lang="en-US">
  <topichead navtitle="Concepts &amp; Tasks">
    <topicref href="a.dita" type="concept" format="dita" navtitle="Arch &quot;A&quot;" rev="1.0"/>
  </topichead>
  <mapref href="sub.ditamap" format="ditamap" navtitle="Refs"/>
</map>`;

/** Same map with a `translate="no"` subtree, to prove protected navtitles still surface. */
const ATTR_MAP_LOCKED = `<map id="m2">
  <topicref href="a.dita" translate="no" navtitle="Locked parent">
    <topicref href="b.dita" navtitle="Locked child"/>
  </topicref>
</map>`;

/** `bookmap` root: prose title parts plus `chapter`/`part` navtitle attributes. */
const BOOKMAP = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE bookmap PUBLIC "-//OASIS//DTD DITA BookMap//EN" "bookmap.dtd">
<bookmap id="bm1" xml:lang="en-US">
  <booktitle>
    <mainbooktitle>Administering DITAEditor</mainbooktitle>
    <booktitlealt>Admin Guide</booktitlealt>
    <shortdesc>Quick start</shortdesc>
  </booktitle>
  <booklibrary>DITAEditor Library</booklibrary>
  <chapter href="ch1.dita" navtitle="Install &amp; Configure">
    <topicref href="ch1/t1.dita" navtitle="Prerequisites"/>
  </chapter>
  <part href="part2.dita" navtitle="Reference"/>
</bookmap>`;

describe('hashText', () => {
  it('is deterministic, pure-JS hex and input sensitive', () => {
    expect(hashText('hello')).toBe(hashText('hello'));
    expect(hashText('hello')).not.toBe(hashText('Hello'));
    expect(hashText('')).toMatch(/^[0-9a-f]{16,}$/);
    expect(hashText('a'.repeat(5000))).toMatch(/^[0-9a-f]{16,}$/);
  });
});

describe('extractTranslatableSegments', () => {
  it('extracts deterministic leaf blocks in document order', () => {
    const segments = extractTranslatableSegments(S0);
    expect(segments.map((segment) => segment.segmentId)).toEqual(SEGMENT_IDS);
    expect(segments.every((segment) => segment.protected === false)).toBe(true);
    expect(segments[0]!.elementTag).toBe('title');
    expect(segments[0]!.elementId).toBe('');
    expect(segments[0]!.plainText).toBe('Install the widget');
    expect(segments[1]!.innerXml).toBe('Quick <b>guide</b> for {0}.');
    expect(segments[1]!.plainText).toBe('Quick guide for {0}.');
    expect(segments[1]!.sourceXml.startsWith('<shortdesc>')).toBe(true);
  });

  it('produces stable hashes across re-indentation but not across content edits', () => {
    const reformatted = S0.replace(/\n {2}/g, '\n      ');
    const original = extractTranslatableSegments(S0);
    const shuffled = extractTranslatableSegments(reformatted);
    expect(shuffled.map((segment) => segment.contentHash)).toEqual(
      original.map((segment) => segment.contentHash),
    );
    expect(computeTranslatableDocumentFingerprint(reformatted)).toBe(
      computeTranslatableDocumentFingerprint(S0),
    );
    expect(computeTranslatableDocumentFingerprint(S0.replace('Done.', 'Finished.'))).not.toBe(
      computeTranslatableDocumentFingerprint(S0),
    );
  });

  it('marks code, conref and translate="no" blocks as protected', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<reference id="r1"><title>Ref</title>
<body>
  <section id="code"><title>Code</title>
    <codeblock xml:space="preserve">  x = 1;
  y = 2;</codeblock>
    <p>Normal <ph conref="common.dita#c/p1"/> text</p>
    <p translate="no">Brand ACME</p>
    <section conref="common.dita#c/s1"/>
  </section>
</body>
</reference>`;
    const segments = extractTranslatableSegments(xml);
    const byPath = new Map(segments.map((segment) => [segment.structuralPath, segment]));

    const code = byPath.get('/reference[0]/body[0]/section[0]/codeblock[0]');
    expect(code?.protected).toBe(true);
    expect(code?.protectedReason).toBe('code_or_pre');
    expect(code?.plainText).toBe('x = 1;\n  y = 2;');

    const conref = byPath.get('/reference[0]/body[0]/section[0]/section[0]');
    expect(conref?.protectedReason).toBe('conref');

    const noTranslate = byPath.get('/reference[0]/body[0]/section[0]/p[1]');
    expect(noTranslate?.protectedReason).toBe('translate_no');

    // The inline `<ph conref>` carrier stays inside its parent block instead of becoming a segment.
    const inlineCarrier = byPath.get('/reference[0]/body[0]/section[0]/p[0]');
    expect(inlineCarrier?.protected).toBe(false);
    expect(segments.some((segment) => segment.elementTag === 'ph')).toBe(false);
  });

  it('re-enables translation below a translate="no" ancestor', () => {
    const xml = '<topic id="t"><title>T</title><body><section translate="no"><p>Keep</p><p translate="yes">Translate me</p></section></body></topic>';
    const segments = extractTranslatableSegments(xml);
    const paths = segments.map((segment) => [segment.structuralPath, segment.protected]);
    expect(paths).toEqual([
      ['/topic[0]/title[0]', false],
      ['/topic[0]/body[0]/section[0]/p[0]', true],
      ['/topic[0]/body[0]/section[0]/p[1]', false],
    ]);
  });

  it('extracts map metadata with locked keys/href', () => {
    const map = `<?xml version="1.0" encoding="UTF-8"?>
<map id="m1" title="Product Map">
  <topicmeta>
    <title>Product Map</title>
    <navtitle>Nav title</navtitle>
    <keywords><keyword>kw one</keyword><keyword translate="no">ACME</keyword></keywords>
  </topicmeta>
  <topicref href="a.dita" keys="a"><topicmeta><linktext>Link A</linktext></topicmeta></topicref>
</map>`;
    const segments = extractTranslatableSegments(map);
    expect(segments.map((segment) => [segment.elementTag, segment.isMapMeta])).toEqual([
      // The legacy `title="…"` map attribute comes first, in document order.
      ['map', true],
      ['title', true],
      ['navtitle', true],
      ['keyword', true],
      ['linktext', true],
    ]);
    expect(segments[0]!.attributeName).toBe('title');
    expect(segments[0]!.structuralPath).toBe('/map[0]/@title');
    expect(segments[0]!.sourceXml).toBe('Product Map');
    expect(segments[2]!.sourceXml).toBe('<navtitle>Nav title</navtitle>');
    expect(segments[4]!.structuralPath).toBe('/map[0]/topicref[0]/topicmeta[0]/linktext[0]');
    // A META element is still a single segment: `navtitle="…"` attributes live on topicrefs.
    // `translate="no"` keeps the keyword out of the translatable set entirely.
    expect(segments.map((segment) => segment.attributeName ?? '')).toEqual([
      'title',
      '',
      '',
      '',
      '',
    ]);
  });

  it('extracts navtitle attributes from the map tree in document order', () => {
    const segments = extractTranslatableSegments(ATTR_MAP);
    expect(
      segments.map((segment) => [segment.segmentId, segment.elementTag, segment.attributeName]),
    ).toEqual([
      ['map[0]/@title', 'map', 'title'],
      ['map[0]/topichead[0]/@navtitle', 'topichead', 'navtitle'],
      ['map[0]/topichead[0]/topicref[0]/@navtitle', 'topicref', 'navtitle'],
      ['map[0]/mapref[0]/@navtitle', 'mapref', 'navtitle'],
    ]);
    const [mapTitle, topichead, topicref, mapref] = segments;
    // Attribute segments carry whitespace-normalised, XML-escaped text — never the element.
    expect(mapTitle!.sourceXml).toBe('Product Manual');
    expect(mapTitle!.plainText).toBe('Product Manual');
    expect(topichead!.sourceXml).toBe('Concepts &amp; Tasks');
    expect(topichead!.plainText).toBe('Concepts & Tasks');
    expect(topicref!.plainText).toBe('Arch "A"');
    expect(mapref!.structuralPath).toBe('/map[0]/mapref[0]/@navtitle');
    expect(segments.every((segment) => segment.isMapMeta)).toBe(true);
    // The hash covers `tag/@attr` + the attribute text only, so re-indentation cannot move it.
    const reindented = extractTranslatableSegments(ATTR_MAP.replace(/\n\s*/g, '\n      '));
    expect(reindented[1]!.contentHash).toBe(topichead!.contentHash);
    expect(
      extractTranslatableSegments(ATTR_MAP.replace('Concepts &amp; Tasks', 'Concepts'))[1]!
        .contentHash,
    ).not.toBe(topichead!.contentHash);
  });

  it('emits the printed navtitle of a translate="no" map branch as protected', () => {
    const segments = extractTranslatableSegments(ATTR_MAP_LOCKED);
    // A locked branch is not walked into, exactly like a `translate="no"` topic section.
    expect(segments.map((segment) => [segment.elementTag, segment.attributeName ?? ''])).toEqual([
      ['topicref', 'navtitle'],
    ]);
    // The locked parent's navtitle is carried (and shown) but never machine-translated.
    const parent = segments[0]!;
    expect(parent.protected).toBe(true);
    expect(parent.protectedReason).toBe('translate_no');
    expect(parent.sourceXml).toBe('Locked parent');
    // A `translate="yes"` child below it re-opens translation, like topic mode.
    const reopened = extractTranslatableSegments(
      ATTR_MAP_LOCKED.replace('navtitle="Locked child"', 'translate="yes" navtitle="Open child"'),
    );
    expect(reopened.map((segment) => [segment.structuralPath, segment.protected])).toEqual([
      ['/map[0]/topicref[0]/topicref[0]/@navtitle', false],
    ]);
  });

  it('extracts bookmap prose and chapter/part navtitle attributes', () => {
    const segments = extractTranslatableSegments(BOOKMAP);
    expect(segments.map((segment) => [segment.elementTag, segment.attributeName ?? ''])).toEqual([
      ['mainbooktitle', ''],
      ['booktitlealt', ''],
      ['shortdesc', ''],
      ['booklibrary', ''],
      ['chapter', 'navtitle'],
      ['topicref', 'navtitle'],
      ['part', 'navtitle'],
    ]);
    expect(segments.every((segment) => segment.isMapMeta)).toBe(true);
    expect(segments[4]!.plainText).toBe('Install & Configure');
    expect(segments[5]!.structuralPath).toBe('/bookmap[0]/chapter[0]/topicref[0]/@navtitle');
    expect(segments[5]!.segmentId).toBe('bookmap[0]/chapter[0]/topicref[0]/@navtitle');
  });

  it('parses attribute structural paths without touching element paths', () => {
    expect(parseAttributeStructuralPath('/map[0]/topichead[0]/@navtitle')).toEqual({
      elementPath: '/map[0]/topichead[0]',
      attributeName: 'navtitle',
    });
    expect(parseAttributeStructuralPath('/map[0]/@xml:lang')).toEqual({
      elementPath: '/map[0]',
      attributeName: 'xml:lang',
    });
    expect(parseAttributeStructuralPath('/map[0]/topichead[0]')).toBeNull();
    expect(parseAttributeStructuralPath('/map[0]/@1bad')).toBeNull();
    expect(parseAttributeStructuralPath('')).toBeNull();
  });

  it('resolves every structural path back to its element', () => {
    const doc = parseXml(S0, { position: false }).document;
    for (const segment of extractTranslatableSegments(S0)) {
      const element = findElementByStructuralPath(doc, segment.structuralPath);
      expect(element?.tagName).toBe(segment.elementTag);
    }
    expect(findElementByStructuralPath(doc, '/task[9]/title[0]')).toBeNull();
    expect(findElementByStructuralPath(doc, '')).toBeNull();
  });

  it('resolves an attribute path to the owning element', () => {
    const doc = parseXml(ATTR_MAP, { position: false }).document;
    const owner = findElementByStructuralPath(doc, '/map[0]/topichead[0]/@navtitle');
    expect(owner?.tagName).toBe('topichead');
    expect(owner?.getAttribute('navtitle')).toBe('Concepts & Tasks');
    expect(findElementByStructuralPath(doc, '/map[0]/mapref[9]/@navtitle')).toBeNull();
  });
});

describe('setRootXmlLang', () => {
  it('replaces an existing xml:lang in place and keeps the prolog byte-identical', () => {
    const updated = setRootXmlLang(S0, 'zh-CN');
    expect(updated.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(updated).toContain('<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">');
    expect(updated).toContain('<?xml-model href="task.rng"?>');
    expect(updated).toContain('<!-- keep this comment -->');
    expect(updated).toContain('xml:lang="zh-CN"');
    expect(updated).not.toContain('en-US');
    expect(updated.indexOf('id="t1"')).toBeLessThan(updated.indexOf('xml:lang="zh-CN"'));
    expect(updated.indexOf('xml:lang="zh-CN"')).toBeLessThan(
      updated.indexOf('xmlns:ditaarch='),
    );
    expect(setRootXmlLang(updated, 'zh-CN')).toBe(updated);
    expect(checkXmlWellFormed(updated).ok).toBe(true);
  });

  it('appends xml:lang when the root has none', () => {
    const updated = setRootXmlLang('<topic id="t"><title>T</title></topic>', 'ja-JP');
    expect(updated).toContain('<topic id="t" xml:lang="ja-JP">');
  });
});

describe('planIncrementalTranslation', () => {
  it('marks the edited block modified and reuses T0 for the rest', () => {
    const S1 = S0.replace('Install the widget', 'Install the new widget');
    const plan = planIncrementalTranslation({ prevSourceXml: S0, currSourceXml: S1, prevTargetXml: T0 });

    expect(plan.mode).toBe('incremental');
    expect(plan.structuralDivergence).toBe(false);
    expect(plan.matchRatio).toBe(1);
    expect(plan.metadataOnlyChange).toBe(false);
    expect(plan.stats).toEqual({
      total: 7,
      unchanged: 6,
      modified: 1,
      added: 0,
      protected: 0,
      deleted: 0,
    });

    const title = plan.segments[0]!;
    expect(title.changeKind).toBe('modified');
    expect(title.prevSourceXml).toBe('<title>Install the widget</title>');
    expect(title.prevTargetXml).toBe('<title>安装小组件</title>');
    expect(title.prevTargetText).toBe('安装小组件');
    expect(title.needsReview).toBe(true);
    expect(title.proposedTargetXml).toBeUndefined();

    const shortdesc = plan.segments[1]!;
    expect(shortdesc.changeKind).toBe('unchanged');
    expect(shortdesc.proposedTargetXml).toBe('<shortdesc>快速 <b>指南</b>，用于 {0}。</shortdesc>');
    expect(shortdesc.proposedTargetText).toBe('快速 指南，用于 {0}。');
    expect(shortdesc.needsReview).toBeUndefined();
  });

  it('tracks added and deleted blocks with their previous target text', () => {
    const S1 = S0.replace('<info>Then wait</info>', '').replace(
      '</result>',
      '<p>Extra step.</p></result>',
    );
    const plan = planIncrementalTranslation({ prevSourceXml: S0, currSourceXml: S1, prevTargetXml: T0 });

    expect(plan.stats.deleted).toBe(1);
    expect(plan.stats.added).toBe(1);
    expect(plan.deletedSegments).toHaveLength(1);
    expect(plan.deletedSegments[0]!.structuralPath).toBe(
      '/task[0]/taskbody[0]/steps[0]/step[0]/info[0]',
    );
    expect(plan.deletedSegments[0]!.prevTargetXml).toBe('<info>然后等待</info>');

    const added = plan.segments.find((segment) => segment.changeKind === 'added');
    expect(added?.currSourceXml).toBe('<p>Extra step.</p>');
    expect(added?.needsReview).toBe(true);
  });

  it('degrades to full_with_reference when S0 and T0 diverge structurally', () => {
    const S0Small = '<topic id="t"><title>Alpha</title><body><p>One</p><p>Two</p><p>Three</p><p>Four</p></body></topic>';
    const unrelatedTarget = '<topic id="t" xml:lang="de"><title>Ganz anders</title><body><p>Nur ein Absatz.</p></body></topic>';
    const plan = planIncrementalTranslation({
      prevSourceXml: S0Small,
      currSourceXml: S0Small,
      prevTargetXml: unrelatedTarget,
    });

    expect(plan.structuralDivergence).toBe(true);
    expect(plan.mode).toBe('full_with_reference');
    expect(plan.matchRatio).toBeLessThan(0.5);
    expect(plan.segments.every((segment) => segment.changeKind !== 'unchanged')).toBe(true);
  });

  it('reports metadata-only changes and first-run full mode', () => {
    const metadataS1 = S0.replace('<!-- keep this comment -->', '<!-- a different comment -->');
    const metadataPlan = planIncrementalTranslation({
      prevSourceXml: S0,
      currSourceXml: metadataS1,
      prevTargetXml: T0,
    });
    expect(metadataPlan.metadataOnlyChange).toBe(true);
    expect(metadataPlan.stats.modified).toBe(0);
    expect(metadataPlan.stats.unchanged).toBe(7);
    expect(metadataPlan.sourceTranslatableHash).toBe(
      computeTranslatableDocumentFingerprint(S0),
    );

    const firstRun = planIncrementalTranslation({ currSourceXml: S0 });
    expect(firstRun.mode).toBe('full');
    expect(firstRun.stats.unchanged).toBe(0);
    expect(firstRun.stats.added).toBe(7);
    expect(firstRun.matchRatio).toBe(1);

    const noTarget = planIncrementalTranslation({ prevSourceXml: S0, currSourceXml: S0 });
    expect(noTarget.mode).toBe('full');
    expect(noTarget.stats.unchanged).toBe(0);
  });

  it('treats a changed navtitle attribute as modified and reuses the rest at 0 tokens', () => {
    const target = assembleTranslatedXml({
      sourceXml: ATTR_MAP,
      targetLang: 'zh-CN',
      translatedSegments: {
        '/map[0]/@title': '产品手册',
        '/map[0]/topichead[0]/@navtitle': '概念与任务',
        '/map[0]/topichead[0]/topicref[0]/@navtitle': '架构“A”',
        '/map[0]/mapref[0]/@navtitle': '参考资料',
      },
    }).xml;
    const curr = ATTR_MAP.replace('Concepts &amp; Tasks', 'Concepts, Tasks &amp; More').replace(
      '  <mapref',
      '  <topicref href="b.dita" navtitle="Brand new"/>\n  <mapref',
    );
    const plan = planIncrementalTranslation({
      prevSourceXml: ATTR_MAP,
      currSourceXml: curr,
      prevTargetXml: target,
    });

    expect(plan.mode).toBe('incremental');
    expect(plan.metadataOnlyChange).toBe(false);
    expect(plan.stats).toEqual({
      total: 5,
      unchanged: 3,
      modified: 1,
      added: 1,
      protected: 0,
      deleted: 0,
    });

    const byId = new Map(plan.segments.map((segment) => [segment.segmentId, segment]));
    const changed = byId.get('map[0]/topichead[0]/@navtitle');
    expect(changed?.changeKind).toBe('modified');
    expect(changed?.attributeName).toBe('navtitle');
    expect(changed?.proposedTargetXml).toBeUndefined();

    const added = byId.get('map[0]/topicref[0]/@navtitle');
    expect(added?.changeKind).toBe('added');
    expect(added?.attributeName).toBe('navtitle');
    expect(added?.currSourceXml).toBe('Brand new');

    // Unchanged attribute segments reuse `T0` verbatim — no model call, no token spend.
    for (const id of ['map[0]/@title', 'map[0]/topichead[0]/topicref[0]/@navtitle', 'map[0]/mapref[0]/@navtitle']) {
      const segment = byId.get(id);
      expect(segment?.changeKind).toBe('unchanged');
      expect(segment?.proposedTargetXml).toBeDefined();
      expect(segment?.proposedTargetXml).not.toBe(segment?.currSourceXml);
    }
    expect(byId.get('map[0]/topichead[0]/topicref[0]/@navtitle')?.attributeName).toBe('navtitle');
    expect(byId.get('map[0]/mapref[0]/@navtitle')?.proposedTargetXml).toBe('参考资料');
    // Attribute and element segments never cross-align, even on a shared tag name.
    expect(byId.get('map[0]/topichead[0]/@navtitle')?.structuralPath).toBe(
      '/map[0]/topichead[0]/@navtitle',
    );
  });
});

describe('computeTranslatableDocumentFingerprint', () => {
  it('changes when a navtitle attribute is edited but not for rev or comment edits', () => {
    const base = computeTranslatableDocumentFingerprint(ATTR_MAP);
    expect(computeTranslatableDocumentFingerprint(ATTR_MAP)).toBe(base);
    expect(
      computeTranslatableDocumentFingerprint(
        ATTR_MAP.replace('Concepts &amp; Tasks', 'Concepts &amp; More'),
      ),
    ).not.toBe(base);
    // Locked metadata (`rev`, `id`, `xml:lang`) and comments are not translatable content.
    expect(
      computeTranslatableDocumentFingerprint(
        ATTR_MAP.replace('rev="1.0"', 'rev="2.0"').replace('<!-- keep this comment -->', '<!-- other -->'),
      ),
    ).toBe(base);
    // `bookmap` chapter/part navtitles are translatable content too.
    expect(computeTranslatableDocumentFingerprint(BOOKMAP)).not.toBe(
      computeTranslatableDocumentFingerprint(BOOKMAP.replace('navtitle="Reference"', 'navtitle="Ref"')),
    );
  });
});

describe('assembleTranslatedXml', () => {
  it('splices translations into the lossless S1 skeleton', () => {
    const S1 = S0.replace('Install the widget', 'Install the new widget');
    const plan = planIncrementalTranslation({ prevSourceXml: S0, currSourceXml: S1, prevTargetXml: T0 });
    const result = assembleTranslatedXml({
      sourceXml: S1,
      targetLang: 'zh-CN',
      plan,
      translatedSegments: new Map([
        [plan.segments[0]!.segmentId, '<title>安装新小组件</title>'],
      ]),
    });

    expect(result.ok).toBe(true);
    expect(result.pmCompatible).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.wellFormedError).toBeUndefined();
    expect(result.xml).toContain('<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">');
    expect(result.xml).toContain('<?xml-model href="task.rng"?>');
    expect(result.xml).toContain('<!-- keep this comment -->');
    expect(result.xml).toContain('<task id="t1" xml:lang="zh-CN"');
    expect(result.xml).toContain('xmlns:ditaarch="http://dita.oasis-open.org/architecture/2005/"');
    expect(result.xml).toContain('<title>安装新小组件</title>');
    // Unchanged blocks come from T0 without any model call.
    expect(result.xml).toContain('快速 <b>指南</b>，用于 {0}。');
    expect(result.xml).toContain('<info>然后等待</info>');
    // Protected/source-only structure is untouched.
    expect(result.xml).toContain('<codeph>setup</codeph>');
  });

  it('never lets a translation change the source element attributes or order', () => {
    const path = '/task[0]/taskbody[0]/prereq[0]/p[0]';
    const result = assembleTranslatedXml({
      sourceXml: S0,
      translatedSegments: {
        [path]: '<p id="evil" href="evil.dita" keyref="evil-key" conref="evil.dita#e/p">准备好<b>许可证</b>。</p>',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.xml).not.toContain('evil');
    expect(result.xml).toContain('<p>准备好<b>许可证</b>。</p>');
    // Root attributes are still the source ones, in the source order.
    expect(result.xml).toContain('<task id="t1" xml:lang="en-US" xmlns:ditaarch=');
  });

  it('keeps the original block when a translation snippet is malformed', () => {
    const path = '/task[0]/title[0]';
    const result = assembleTranslatedXml({
      sourceXml: S0,
      translatedSegments: { [path]: '<title>Broken <b>title</title>' },
    });

    expect(result.ok).toBe(true);
    expect(result.xml).toContain('<title>Install the widget</title>');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('not well-formed');
  });

  it('accepts bare inner fragments, markdown fences and warns on unknown keys', () => {
    const result = assembleTranslatedXml({
      sourceXml: S0,
      translatedSegments: {
        '/task[0]/title[0]': '```xml\n<title>用围栏包裹的标题</title>\n```',
        '/task[0]/taskbody[0]/result[0]/p[0]': '已完成。',
        'no-such-segment': '<p>ignored</p>',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.xml).toContain('<title>用围栏包裹的标题</title>');
    expect(result.xml).toContain('<p>已完成。</p>');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('no-such-segment');
  });

  it('reports malformed source instead of throwing', () => {
    const result = assembleTranslatedXml({
      sourceXml: '<topic><title>x</title>',
      translatedSegments: {},
    });
    expect(result.ok).toBe(false);
    expect(result.wellFormedError?.message.length).toBeGreaterThan(0);
    expect(result.pmCompatible).toBe(false);
  });

  it('is idempotent and serialize-stable', () => {
    const first = assembleTranslatedXml({
      sourceXml: S0,
      targetLang: 'ja-JP',
      translatedSegments: new Map([['/task[0]/title[0]', '<title>ウィジェットをインストール</title>']]),
    });
    const second = assembleTranslatedXml({ sourceXml: first.xml, translatedSegments: {} });
    expect(second.xml).toBe(first.xml);

    const reparsed = parseXml(first.xml, { position: false });
    expect(serializeXml(reparsed)).toBe(first.xml);
  });

  it('splices translated navtitle/title attributes without touching paths or order', () => {
    const result = assembleTranslatedXml({
      sourceXml: ATTR_MAP,
      targetLang: 'zh-CN',
      translatedSegments: {
        '/map[0]/@title': '产品手册',
        '/map[0]/topichead[0]/@navtitle': '概念与任务',
        '/map[0]/topichead[0]/topicref[0]/@navtitle': '架构“A”',
        '/map[0]/mapref[0]/@navtitle': '参考资料',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- keep this comment -->
<map id="m1" title="产品手册" xml:lang="zh-CN">
  <topichead navtitle="概念与任务">
    <topicref href="a.dita" type="concept" format="dita" navtitle="架构“A”" rev="1.0"/>
  </topichead>
  <mapref href="sub.ditamap" format="ditamap" navtitle="参考资料"/>
</map>
`);
    // `href`/`type`/`format`/`rev` keep their exact source order inside the element.
    expect(result.xml).toContain(
      '<topicref href="a.dita" type="concept" format="dita" navtitle="架构“A”" rev="1.0"/>',
    );
    expect(result.xml).toContain('<mapref href="sub.ditamap" format="ditamap" navtitle="参考资料"/>');
    expect(result.xml).not.toContain('title="Product Manual"');
    expect(result.xml).not.toContain('navtitle="Concepts');

    const again = assembleTranslatedXml({ sourceXml: result.xml, translatedSegments: {} });
    expect(again.xml).toBe(result.xml);
    expect(serializeXml(parseXml(result.xml, { position: false }))).toBe(result.xml);
    expect(checkXmlWellFormed(result.xml).ok).toBe(true);
  });

  it('accepts echoed wrapper elements, bare `&` and rejects tag noise for attributes', () => {
    const result = assembleTranslatedXml({
      sourceXml: ATTR_MAP,
      translatedSegments: {
        '/map[0]/@title': '<map title="回显"/>',
        '/map[0]/topichead[0]/@navtitle': '研发 &amp; 运维',
        '/map[0]/topichead[0]/topicref[0]/@navtitle': '坏 <b>标签',
        '/map[0]/mapref[0]/@navtitle': '<mapref navtitle="由元素包裹"/>',
      },
    });

    expect(result.xml).toContain('<map id="m1" title="回显" xml:lang="en-US">');
    expect(result.xml).toContain('<topichead navtitle="研发 &amp; 运维">');
    expect(result.xml).toContain('<mapref href="sub.ditamap" format="ditamap" navtitle="由元素包裹"/>');
    // Malformed tag noise falls back to the original source value with one warning.
    expect(result.xml).toContain('navtitle="Arch &quot;A&quot;" rev="1.0"');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('/map[0]/topichead[0]/topicref[0]/@navtitle');
    expect(result.warnings[0]).toContain('original attribute value was kept');
  });

  it('never cross-writes element content and attribute values', () => {
    const translated = assembleTranslatedXml({
      sourceXml: ATTR_MAP,
      translatedSegments: { '/map[0]/topichead[0]/@navtitle': '<navtitle>内联文本</navtitle>' },
    });
    expect(translated.xml).toContain('<topichead navtitle="内联文本">');
    expect(translated.xml).not.toContain('<navtitle>');

    const elementOnly = assembleTranslatedXml({
      sourceXml: ATTR_MAP,
      translatedSegments: { '/map[0]/topichead[0]': '覆盖不了' },
    });
    expect(elementOnly.xml).toContain('navtitle="Concepts &amp; Tasks"');
  });

  it('can skip the ProseMirror probe', () => {
    const checked = assembleTranslatedXml({
      sourceXml: S0,
      translatedSegments: {},
      checkPm: false,
    });
    expect(checked.pmCompatible).toBe(true);
    expect(checked.ok).toBe(true);
  });
});
