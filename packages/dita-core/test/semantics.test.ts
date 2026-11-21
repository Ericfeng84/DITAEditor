import { describe, expect, it } from 'vitest';
import {
  areConrefTagsCompatible,
  buildKeyspace,
  DitaSemanticIndex,
  findPmPosByDitaId,
  resolveKeyrefInKeyspace,
  xmlToPmDoc,
} from '../src/index.js';

describe('Root Map Keyspace (BFS + First Definition Wins + keyscope)', () => {
  it('enforces BFS First Definition Wins and records shadowed counts', () => {
    const files: Record<string, string> = {
      'root.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="root_map">
  <title>Root</title>
  <mapref href="sub/child.ditamap"/>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>Root Product</keyword></keywords></topicmeta></keydef>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>Duplicate Root Product</keyword></keywords></topicmeta></keydef>
</map>`,
      'sub/child.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="child_map">
  <title>Child</title>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>Child Product</keyword></keywords></topicmeta></keydef>
  <keydef keys="child_only" href="../topics/intro.dita"/>
</map>`,
      'topics/intro.dita': `<?xml version="1.0" encoding="UTF-8"?>
<concept id="intro"><title>Intro Title</title><conbody><p>Hello</p></conbody></concept>`,
    };

    const ks = buildKeyspace('root.ditamap', (p) => files[p] ?? null, {
      topicTitles: {
        'topics/intro.dita': 'Intro Title',
      },
    });

    // Root map's first definition wins over both duplicate root def and earlier-listed submap def (BFS!)
    expect(ks.keys['prod_name']?.inlineText).toBe('Root Product');
    expect(ks.keys['prod_name']?.sourceMapPath).toBe('root.ditamap');
    expect(ks.keys['prod_name']?.shadowedCount).toBe(2);

    // Child map key resolves relative href against sub/child.ditamap -> topics/intro.dita
    expect(ks.keys['child_only']?.resolvedHref).toBe('topics/intro.dita');
    expect(ks.keys['child_only']?.targetTitle).toBe('Intro Title');
    expect(ks.mapCycles).toHaveLength(0);
  });

  it('supports keyscope isolation and allows reusing the same submap under multiple scopes without false cycles', () => {
    const files: Record<string, string> = {
      'root.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="root_scopes">
  <title>Multi-Scope Root</title>
  <topicgroup keyscope="cloud">
    <keydef keys="edition"><topicmeta><keywords><keyword>Cloud</keyword></keywords></topicmeta></keydef>
    <mapref href="shared-sub.ditamap"/>
  </topicgroup>
  <topicgroup keyscope="onprem">
    <keydef keys="edition"><topicmeta><keywords><keyword>On-Prem</keyword></keywords></topicmeta></keydef>
    <mapref href="shared-sub.ditamap"/>
  </topicgroup>
</map>`,
      'shared-sub.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="shared_sub">
  <keydef keys="sub_flag"><topicmeta><keywords><keyword>SharedSub</keyword></keywords></topicmeta></keydef>
</map>`,
    };

    const ks = buildKeyspace('root.ditamap', (p) => files[p] ?? null);
    expect(ks.mapCycles).toHaveLength(0);
    expect(ks.scopes).toEqual(['cloud', 'onprem']);
    expect(ks.keys['cloud.edition']?.inlineText).toBe('Cloud');
    expect(ks.keys['onprem.edition']?.inlineText).toBe('On-Prem');
    expect(ks.keys['cloud.sub_flag']?.inlineText).toBe('SharedSub');
    expect(ks.keys['onprem.sub_flag']?.inlineText).toBe('SharedSub');

    expect(resolveKeyrefInKeyspace('edition', ks, ['cloud']).resolvedText).toBe('Cloud');
    expect(resolveKeyrefInKeyspace('edition', ks, ['onprem']).resolvedText).toBe('On-Prem');
    expect(resolveKeyrefInKeyspace('onprem.edition', ks).resolvedText).toBe('On-Prem');
  });

  it('detects genuine circular <mapref> cycles without infinite loops', () => {
    const files: Record<string, string> = {
      'a.ditamap': `<map id="a"><mapref href="b.ditamap"/></map>`,
      'b.ditamap': `<map id="b"><mapref href="a.ditamap"/></map>`,
    };
    const ks = buildKeyspace('a.ditamap', (p) => files[p] ?? null);
    expect(ks.mapCycles.length).toBeGreaterThan(0);
    expect(ks.mapCycles[0]?.toMap).toBe('a.ditamap');
  });
});

describe('Conref / Conkeyref resolution & DFS cycle detection', () => {
  it('validates element tag compatibility including DITA specialization pairs', () => {
    expect(areConrefTagsCompatible('note', 'note')).toBe(true);
    expect(areConrefTagsCompatible('li', 'step')).toBe(true);
    expect(areConrefTagsCompatible('pre', 'codeblock')).toBe(true);
    expect(areConrefTagsCompatible('section', 'prereq')).toBe(true);
    expect(areConrefTagsCompatible('ph', 'codeph')).toBe(true);
    expect(areConrefTagsCompatible('step', 'li')).toBe(false);
    expect(areConrefTagsCompatible('p', 'note')).toBe(false);
    expect(areConrefTagsCompatible('table', 'simpletable')).toBe(false);
  });

  it('resolves conref, conkeyref, same-topic #./id, conrefend ranges, and nested keyrefs', () => {
    const index = new DitaSemanticIndex();
    index.loadFiles({
      'root.ditamap': `<?xml version="1.0" encoding="UTF-8"?>
<map id="m">
  <title>Map</title>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>NovaSuite</keyword></keywords></topicmeta></keydef>
  <keydef keys="common_reuse" href="shared/reuse.dita" processing-role="resource-only"/>
  <topicref href="topics/guide.dita"/>
</map>`,
      'shared/reuse.dita': `<?xml version="1.0" encoding="UTF-8"?>
<topic id="reuse_lib">
  <title>Reuse Library</title>
  <body>
    <note id="n_warn" type="warning"><p>Backup <keyword keyref="prod_name"/> first.</p></note>
    <p id="p_a">Alpha</p>
    <p id="p_b">Beta</p>
    <p id="p_c">Gamma</p>
  </body>
</topic>`,
      'topics/guide.dita': `<?xml version="1.0" encoding="UTF-8"?>
<concept id="guide">
  <title>Guide</title>
  <conbody>
    <p id="local_src">Local Reusable Paragraph</p>
    <p conref="#./local_src"/>
    <note conkeyref="common_reuse/n_warn"/>
    <p conref="../shared/reuse.dita#reuse_lib/p_a" conrefend="../shared/reuse.dita#reuse_lib/p_c"/>
  </conbody>
</concept>`,
    });

    // 1. Same-topic #./id
    const sameTopic = index.resolveConref({
      sourceFilePath: 'topics/guide.dita',
      sourceTagName: 'p',
      attrName: 'conref',
      rawValue: '#./local_src',
      sourceTopicId: 'guide',
      rootMapPath: 'root.ditamap',
    });
    expect(sameTopic.status).toBe('resolved');
    expect(sameTopic.resolvedText).toContain('Local Reusable Paragraph');

    // 2. Indirect conkeyref + nested <keyword keyref="prod_name"/> expansion
    const viaKey = index.resolveConref({
      sourceFilePath: 'topics/guide.dita',
      sourceTagName: 'note',
      attrName: 'conkeyref',
      rawValue: 'common_reuse/n_warn',
      sourceTopicId: 'guide',
      rootMapPath: 'root.ditamap',
    });
    expect(viaKey.status).toBe('resolved');
    expect(viaKey.targetFilePath).toBe('shared/reuse.dita');
    expect(viaKey.resolvedText).toContain('NovaSuite');

    // 3. Range conref + conrefend
    const ranged = index.resolveConref({
      sourceFilePath: 'topics/guide.dita',
      sourceTagName: 'p',
      attrName: 'conref',
      rawValue: '../shared/reuse.dita#reuse_lib/p_a',
      conrefend: '../shared/reuse.dita#reuse_lib/p_c',
      sourceTopicId: 'guide',
      rootMapPath: 'root.ditamap',
    });
    expect(ranged.status).toBe('resolved');
    expect(ranged.resolvedText).toContain('Alpha');
    expect(ranged.resolvedText).toContain('Beta');
    expect(ranged.resolvedText).toContain('Gamma');

    // Clean diagnostics on valid project
    const diags = index.collectSemanticDiagnostics('root.ditamap');
    expect(diags).toEqual([]);
  });

  it('detects self, 2-node, 3-node, and nested-child conref cycles while allowing diamond DAGs', () => {
    const index = new DitaSemanticIndex();
    index.loadFiles({
      'cycles.dita': `<?xml version="1.0" encoding="UTF-8"?>
<topic id="cyc">
  <title>Cycles</title>
  <body>
    <p id="self_p" conref="#cyc/self_p"/>
    <p id="a2" conref="#cyc/b2"/>
    <p id="b2" conref="#cyc/a2"/>
    <p id="a3" conref="#cyc/b3"/>
    <p id="b3" conref="#cyc/c3"/>
    <p id="c3" conref="#cyc/a3"/>
    <section id="nest_a"><p conref="#cyc/nest_b_p"/></section>
    <section id="nest_b"><p id="nest_b_p">Loop<ph conref="#cyc/nest_a_ph"/></p></section>
    <ph id="nest_a_ph" conref="#cyc/nest_b_p"/>
    <section id="diamond_root">
      <p conref="#cyc/diamond_left"/>
      <p conref="#cyc/diamond_right"/>
    </section>
    <p id="diamond_left">L:<ph conref="#cyc/diamond_leaf"/></p>
    <p id="diamond_right">R:<ph conref="#cyc/diamond_leaf"/></p>
    <ph id="diamond_leaf">SharedLeaf</ph>
  </body>
</topic>`,
    });

    const selfRes = index.resolveConref({
      sourceFilePath: 'cycles.dita',
      sourceTagName: 'p',
      attrName: 'conref',
      rawValue: '#cyc/self_p',
      sourceTopicId: 'cyc',
      sourceElementId: 'self_p',
      rootMapPath: null,
    });
    expect(selfRes.status).toBe('cycle');
    expect(selfRes.cycleChain?.length).toBeGreaterThanOrEqual(2);

    const twoNode = index.resolveConref({
      sourceFilePath: 'cycles.dita',
      sourceTagName: 'p',
      attrName: 'conref',
      rawValue: '#cyc/b2',
      sourceTopicId: 'cyc',
      sourceElementId: 'a2',
      rootMapPath: null,
    });
    expect(twoNode.status).toBe('cycle');
    expect(twoNode.cycleChain).toContain('cycles.dita#cyc/a2');
    expect(twoNode.cycleChain).toContain('cycles.dita#cyc/b2');

    const threeNode = index.resolveConref({
      sourceFilePath: 'cycles.dita',
      sourceTagName: 'p',
      attrName: 'conref',
      rawValue: '#cyc/b3',
      sourceTopicId: 'cyc',
      sourceElementId: 'a3',
      rootMapPath: null,
    });
    expect(threeNode.status).toBe('cycle');
    expect(threeNode.cycleChain).toContain('cycles.dita#cyc/c3');

    // Diamond DAG must resolve cleanly without false cycle
    const diamond = index.resolveConref({
      sourceFilePath: 'cycles.dita',
      sourceTagName: 'section',
      attrName: 'conref',
      rawValue: '#cyc/diamond_root',
      sourceTopicId: 'cyc',
      rootMapPath: null,
    });
    expect(diamond.status).toBe('resolved');
    expect(diamond.resolvedText).toContain('SharedLeaf');
  });

  it('supports incremental updateFile invalidation and reports semantic diagnostics', () => {
    const index = new DitaSemanticIndex();
    index.loadFiles({
      'root.ditamap': `<map id="m"><keydef keys="ver"><topicmeta><keywords><keyword>1.0</keyword></keywords></topicmeta></keydef><topicref href="t.dita"/></map>`,
      't.dita': `<topic id="t"><title>T</title><body><p><keyword keyref="ver"/></p></body></topic>`,
    });

    expect(index.resolveKeyref('ver', 'root.ditamap').resolvedText).toBe('1.0');
    expect(index.collectSemanticDiagnostics('root.ditamap')).toEqual([]);

    // Incrementally update map keydef
    const updateRes = index.updateFile(
      'root.ditamap',
      `<map id="m"><keydef keys="ver"><topicmeta><keywords><keyword>2.5</keyword></keywords></topicmeta></keydef><topicref href="t.dita"/></map>`,
    );
    expect(updateRes.changed).toBe(true);
    expect(updateRes.invalidatedKeyspaces).toBe(true);
    expect(index.resolveKeyref('ver', 'root.ditamap').resolvedText).toBe('2.5');

    // Inject undefined keyref and incompatible conref
    index.updateFile(
      't.dita',
      `<topic id="t"><title>T</title><body><note id="n1"><p>N</p></note><p><keyword keyref="missing_k"/></p><p conref="#t/n1"/></body></topic>`,
    );
    const diags = index.collectSemanticDiagnostics('root.ditamap');
    expect(diags.some((d) => d.source === 'keyref' && d.keyName === 'missing_k')).toBe(true);
    expect(diags.some((d) => d.source === 'conref')).toBe(true);
  });

  it('finds exact ProseMirror node position by DITA @id', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="c_main">
  <title>Main</title>
  <conbody>
    <p id="target_p">Jump here</p>
  </conbody>
</concept>`;
    const { pmDoc } = xmlToPmDoc(xml);
    const pos = findPmPosByDitaId(pmDoc, 'target_p');
    expect(pos).not.toBeNull();
    expect(pmDoc.nodeAt(pos!)?.textContent).toBe('Jump here');
    expect(findPmPosByDitaId(pmDoc, 'nonexistent')).toBeNull();
  });
});
