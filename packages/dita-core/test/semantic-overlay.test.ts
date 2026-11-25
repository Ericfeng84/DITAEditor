import { describe, expect, it } from 'vitest';
import { DitaSemanticIndex, type SemanticOverlayOperation } from '../src/index.js';

const BASE_FILES: Record<string, string> = {
  'root.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="root_map">
  <title>Root Map</title>
  <keydef keys="prod_name" audience="admin"><topicmeta><keywords><keyword>NovaSuite</keyword></keywords></topicmeta></keydef>
  <mapref href="sub.ditamap"/>
  <topicref href="topics/intro.dita"/>
  <topicref href="topics/other.dita"/>
</map>`,
  'sub.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="sub_map">
  <title>Sub Map</title>
  <keydef keys="sub_version" platform="web"><topicmeta><keywords><keyword>2.0</keyword></keywords></topicmeta></keydef>
</map>`,
  'topics/intro.dita': `<?xml version="1.0" encoding="UTF-8"?>
<concept id="intro" audience="expert">
  <title>Intro Title</title>
  <conbody><p>Hello <keyword keyref="prod_name"/></p></conbody>
</concept>`,
  'topics/other.dita': `<?xml version="1.0" encoding="UTF-8"?>
<task id="other">
  <title>Other Title</title>
  <taskbody><steps><step><cmd>Do it</cmd></step></steps></taskbody>
</task>`,
  'profile.ditaval': `<?xml version="1.0" encoding="UTF-8"?>
<val><prop att="product" val="mobile" action="include"/></val>`,
};

function createBaseIndex(): DitaSemanticIndex {
  const index = new DitaSemanticIndex();
  index.loadFiles(BASE_FILES);
  return index;
}

const MALFORMED_TASK = `<?xml version="1.0" encoding="UTF-8"?>
<task id="other"><title>Broken</task>`;

describe('DitaSemanticIndex.cloneWithOverlay: empty overlay', () => {
  it('returns an isolated clone with identical keyspace, topic indices, profiling catalog and diagnostics', () => {
    const base = createBaseIndex();
    expect(base.collectSemanticDiagnostics('root.ditamap')).toEqual([]);

    const baseKeyspace = base.getKeyspace('root.ditamap');
    const clone = base.cloneWithOverlay([]);

    expect(clone).toBeInstanceOf(DitaSemanticIndex);
    expect(clone).not.toBe(base);

    expect(clone.getFilePaths()).toEqual(base.getFilePaths());
    expect(clone.getAllTopicIndices()).toEqual(base.getAllTopicIndices());
    expect(clone.getTopicTitles()).toEqual(base.getTopicTitles());
    expect(clone.getProfilingCatalog()).toEqual(base.getProfilingCatalog());
    expect(clone.getKeyspace('root.ditamap')).toEqual(baseKeyspace);
    expect(clone.collectSemanticDiagnostics('root.ditamap')).toEqual([]);
  });

  it('does not leak subsequent clone mutations back into the base index', () => {
    const base = createBaseIndex();
    // Warm the shared caches before cloning so mutation leaks would be detectable.
    const baseKeyspace = base.getKeyspace('root.ditamap');
    const baseProfiling = base.getProfilingCatalog();

    const clone = base.cloneWithOverlay([]);
    const updatedMap = `<?xml version="1.0" encoding="UTF-8"?>
<map id="root_map">
  <title>Root Map</title>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>ChangedProduct</keyword></keywords></topicmeta></keydef>
  <mapref href="sub.ditamap"/>
  <topicref href="topics/intro.dita"/>
</map>`;
    clone.updateFile('root.ditamap', updatedMap);
    clone.updateFile(
      'topics/intro.dita',
      `<concept id="intro"><title>Clone Title</title><conbody><p>Hello</p></conbody></concept>`,
    );
    clone.removeFile('profile.ditaval');

    expect(clone.getKeyspace('root.ditamap').keys['prod_name']?.inlineText).toBe('ChangedProduct');
    expect(clone.getTopicIndex('topics/intro.dita')?.title).toBe('Clone Title');
    expect(clone.hasFile('profile.ditaval')).toBe(false);

    // Base is fully untouched: same cached results, same content, same topics.
    expect(base.getKeyspace('root.ditamap')).toBe(baseKeyspace);
    expect(baseKeyspace.keys['prod_name']?.inlineText).toBe('NovaSuite');
    expect(base.getProfilingCatalog()).toBe(baseProfiling);
    expect(base.getTopicIndex('topics/intro.dita')?.title).toBe('Intro Title');
    expect(base.hasFile('profile.ditaval')).toBe(true);
  });
});

describe('DitaSemanticIndex.cloneWithOverlay: edit', () => {
  it('surfaces malformed XML only in the affected user overlay', () => {
    const base = createBaseIndex();
    const userA: readonly SemanticOverlayOperation[] = [
      { op: 'edit', filePath: 'topics/other.dita', content: MALFORMED_TASK },
    ];
    const overlayA = base.cloneWithOverlay(userA);
    const overlayB = base.cloneWithOverlay([]);

    const diagsA = overlayA.collectSemanticDiagnostics('root.ditamap');
    expect(
      diagsA.some((d) => d.source === 'xml' && d.filePath === 'topics/other.dita'),
    ).toBe(true);
    expect(overlayA.getTopicIndex('topics/other.dita')?.wellFormed).toBe(false);

    // Base and the other user's overlay stay completely clean.
    expect(base.collectSemanticDiagnostics('root.ditamap')).toEqual([]);
    expect(overlayB.collectSemanticDiagnostics('root.ditamap')).toEqual([]);
    expect(base.getTopicIndex('topics/other.dita')?.wellFormed).toBe(true);
    expect(overlayA.getUiLocale()).toBe(base.getUiLocale());
  });
});

describe('DitaSemanticIndex.cloneWithOverlay: create', () => {
  it('exposes created topics/maps through topic index, keyspace, diagnostics and profiling catalog only in the overlay', () => {
    const base = createBaseIndex();
    const overlay = base.cloneWithOverlay([
      {
        op: 'create',
        filePath: 'topics/created.dita',
        content: `<concept id="created" audience="newbie"><title>Created Title</title><conbody><p>New</p></conbody></concept>`,
      },
      {
        op: 'create',
        filePath: 'extra.ditamap',
        content: `<map id="extra_map">
  <title>Extra Map</title>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>ExtraProduct</keyword></keywords></topicmeta></keydef>
  <keydef keys="extra_key"><topicmeta><keywords><keyword>ExtraValue</keyword></keywords></topicmeta></keydef>
  <topicref href="topics/created.dita"/>
</map>`,
      },
    ]);

    // Topic index
    expect(base.getTopicIndex('topics/created.dita')).toBeNull();
    expect(overlay.getTopicIndex('topics/created.dita')?.title).toBe('Created Title');
    expect(overlay.getTopicIndex('topics/created.dita')?.rootTopicId).toBe('created');
    expect(overlay.getFilePaths()).toContain('extra.ditamap');
    expect(base.hasFile('extra.ditamap')).toBe(false);

    // Keyspace
    expect(base.getKeyspace('extra.ditamap').keys['extra_key']).toBeUndefined();
    expect(overlay.getKeyspace('extra.ditamap').keys['extra_key']?.inlineText).toBe(
      'ExtraValue',
    );
    expect(overlay.getKeyspace('extra.ditamap').referencedTopics).toContain(
      'topics/created.dita',
    );

    // Diagnostics: created map resolves the created topic, nothing is missing.
    expect(overlay.collectSemanticDiagnostics('extra.ditamap')).toEqual([]);
    expect(overlay.collectSemanticDiagnostics('root.ditamap')).toEqual([]);
    expect(base.collectSemanticDiagnostics('extra.ditamap')).toEqual([]);

    // Profiling catalog
    expect(overlay.getProfilingCatalog().audience).toContain('newbie');
    expect(base.getProfilingCatalog().audience).not.toContain('newbie');
  });
});

describe('DitaSemanticIndex.cloneWithOverlay: delete', () => {
  it('removes a deleted topic and ditaval in the overlay only', () => {
    const base = createBaseIndex();
    const overlay = base.cloneWithOverlay([
      { op: 'delete', filePath: 'topics/other.dita' },
      { op: 'delete', filePath: 'profile.ditaval' },
    ]);

    expect(overlay.hasFile('topics/other.dita')).toBe(false);
    expect(overlay.getTopicIndex('topics/other.dita')).toBeNull();
    expect(overlay.hasFile('profile.ditaval')).toBe(false);
    expect(overlay.getDitaval('profile.ditaval')).toBeNull();

    const overlayDiags = overlay.collectSemanticDiagnostics('root.ditamap');
    expect(
      overlayDiags.some(
        (d) => d.source === 'map-ref' && d.targetHref === 'topics/other.dita',
      ),
    ).toBe(true);

    // Base still owns the deleted files and remains diagnostic-clean.
    expect(base.hasFile('topics/other.dita')).toBe(true);
    expect(base.getTopicIndex('topics/other.dita')?.title).toBe('Other Title');
    expect(base.getDitaval('profile.ditaval')?.ok).toBe(true);
    expect(base.collectSemanticDiagnostics('root.ditamap')).toEqual([]);
  });

  it('removes a deleted sub-map (and its keys) from the overlay keyspace', () => {
    const base = createBaseIndex();
    const overlay = base.cloneWithOverlay([{ op: 'delete', filePath: 'sub.ditamap' }]);

    expect(overlay.hasFile('sub.ditamap')).toBe(false);
    expect(overlay.getKeyspace('root.ditamap').keys['sub_version']).toBeUndefined();
    expect(
      overlay
        .collectSemanticDiagnostics('root.ditamap')
        .some((d) => d.source === 'map-ref' && d.targetHref === 'sub.ditamap'),
    ).toBe(true);

    expect(base.hasFile('sub.ditamap')).toBe(true);
    expect(base.getKeyspace('root.ditamap').keys['sub_version']?.inlineText).toBe('2.0');
  });
});

describe('DitaSemanticIndex.cloneWithOverlay: rename', () => {
  it('moves topic ids/titles to the new path without modified content', () => {
    const base = createBaseIndex();
    const overlay = base.cloneWithOverlay([
      {
        op: 'rename',
        originalPath: 'topics/intro.dita',
        filePath: 'topics/intro-renamed.dita',
      },
    ]);

    expect(overlay.getFilePaths()).toContain('topics/intro-renamed.dita');
    expect(overlay.getFilePaths()).not.toContain('topics/intro.dita');
    expect(overlay.getTopicIndex('topics/intro.dita')).toBeNull();
    expect(overlay.getTopicIndex('topics/intro-renamed.dita')?.rootTopicId).toBe('intro');
    expect(overlay.getTopicIndex('topics/intro-renamed.dita')?.title).toBe('Intro Title');
    expect(overlay.getTopicTitles()['topics/intro-renamed.dita']).toBe('Intro Title');
    expect(
      overlay
        .collectSemanticDiagnostics('root.ditamap')
        .some((d) => d.source === 'map-ref' && d.targetHref === 'topics/intro.dita'),
    ).toBe(true);

    // Base keeps the original path untouched.
    expect(base.hasFile('topics/intro.dita')).toBe(true);
    expect(base.hasFile('topics/intro-renamed.dita')).toBe(false);
    expect(base.getTopicIndex('topics/intro.dita')?.title).toBe('Intro Title');
    expect(base.collectSemanticDiagnostics('root.ditamap')).toEqual([]);
  });

  it('applies modified content supplied with the rename', () => {
    const base = createBaseIndex();
    const overlay = base.cloneWithOverlay([
      {
        op: 'rename',
        originalPath: 'topics/other.dita',
        filePath: 'topics/other2.dita',
        content: `<task id="other2"><title>Other Renamed</title><taskbody><steps><step><cmd>Do it again</cmd></step></steps></taskbody></task>`,
      },
    ]);

    expect(overlay.getTopicIndex('topics/other.dita')).toBeNull();
    expect(overlay.getTopicIndex('topics/other2.dita')?.rootTopicId).toBe('other2');
    expect(overlay.getTopicIndex('topics/other2.dita')?.title).toBe('Other Renamed');
    expect(overlay.getFilePaths()).not.toContain('topics/other.dita');

    expect(base.getTopicIndex('topics/other.dita')?.rootTopicId).toBe('other');
    expect(base.getTopicIndex('topics/other.dita')?.title).toBe('Other Title');
    expect(base.hasFile('topics/other2.dita')).toBe(false);
  });

  it('falls back to a plain rename when content is null', () => {
    const base = createBaseIndex();
    const overlay = base.cloneWithOverlay([
      {
        op: 'rename',
        originalPath: 'topics/intro.dita',
        filePath: 'topics/intro-moved.dita',
        content: null,
      },
    ]);

    expect(overlay.getTopicIndex('topics/intro-moved.dita')?.title).toBe('Intro Title');
    expect(overlay.getTopicIndex('topics/intro.dita')).toBeNull();
    expect(base.getTopicIndex('topics/intro.dita')?.title).toBe('Intro Title');
  });
});

describe('DitaSemanticIndex.cloneWithOverlay: zero re-parsing', () => {
  it('shares ParsedXmlDocument references for unchanged files and re-parses only touched ones', () => {
    const base = createBaseIndex();
    const baseIntroDoc = base.getParsedDoc('topics/intro.dita');
    const baseRootMapDoc = base.getParsedDoc('root.ditamap');
    const baseOtherDoc = base.getParsedDoc('topics/other.dita');
    expect(baseIntroDoc).not.toBeNull();
    expect(baseRootMapDoc).not.toBeNull();

    const overlay = base.cloneWithOverlay([
      {
        op: 'edit',
        filePath: 'topics/other.dita',
        content: `<task id="other"><title>Other Title v2</title><taskbody><steps><step><cmd>Do it</cmd></step></steps></taskbody></task>`,
      },
    ]);

    expect(overlay.getParsedDoc('topics/intro.dita')).toBe(baseIntroDoc);
    expect(overlay.getParsedDoc('root.ditamap')).toBe(baseRootMapDoc);
    expect(overlay.getParsedDoc('sub.ditamap')).toBe(base.getParsedDoc('sub.ditamap'));
    expect(overlay.getParsedDoc('topics/other.dita')).not.toBe(baseOtherDoc);
    expect(overlay.getTopicIndex('topics/other.dita')?.title).toBe('Other Title v2');
    expect(base.getTopicIndex('topics/other.dita')?.title).toBe('Other Title');
  });
});

describe('DitaSemanticIndex.cloneWithOverlay: locale', () => {
  it('preserves uiLocale and emits overlay diagnostics in that locale', () => {
    const base = createBaseIndex();
    base.setUiLocale('en');

    const emptyClone = base.cloneWithOverlay([]);
    expect(emptyClone.getUiLocale()).toBe('en');

    const overlay = base.cloneWithOverlay([
      { op: 'edit', filePath: 'topics/other.dita', content: MALFORMED_TASK },
    ]);
    expect(overlay.getUiLocale()).toBe('en');
    const xmlDiag = overlay
      .collectSemanticDiagnostics('root.ditamap')
      .find((d) => d.source === 'xml' && d.filePath === 'topics/other.dita');
    expect(xmlDiag?.message).toContain('XML well-formedness error');
    expect(base.getUiLocale()).toBe('en');
  });
});
