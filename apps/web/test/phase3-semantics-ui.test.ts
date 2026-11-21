import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import {
  DitaSemanticIndex,
  parseDitaval,
  pmDocToXml,
  xmlToPmDoc,
} from '@dita/core';
import { createDitaXmlCompletionSource } from '../src/editor/source/dita-completion';
import {
  collectDitaDecorations,
  type DitaDecorationsCallbacks,
} from '../src/editor/visual/decorations';
import { buildCompositeMapTree } from '../src/map-tree/map-tree-utils';

const noopCallbacks: DitaDecorationsCallbacks = {
  onSelectTagNode: () => {},
  onQuickInsertBlock: () => {},
  onOpenGapInsertMenu: () => {},
  onJumpToSource: () => {},
};

describe('Phase 3 Visual Editor Semantic Decorations (Conref + DITAVAL lossless projection)', () => {
  const topicXml = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="c_sem">
  <title>Semantic Preview</title>
  <conbody>
    <note conkeyref="common_reuse/n_cloud"/>
    <p id="p_self" conref="#c_sem/p_self"/>
    <p product="onprem">On-Premises only paragraph.</p>
    <p product="cloud">Cloud flagged paragraph.</p>
  </conbody>
</concept>`;

  const reuseXml = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="reuse_lib">
  <title>Reuse</title>
  <body>
    <note id="n_cloud" type="tip"><p>Cloud tip text.</p></note>
  </body>
</topic>`;

  const mapXml = `<?xml version="1.0" encoding="UTF-8"?>
<map id="m_sem">
  <title>Semantic Map</title>
  <keydef keys="common_reuse" href="shared/reuse.dita" processing-role="resource-only"/>
  <topicref href="concepts/sem.dita"/>
</map>`;

  const ditavalXml = `<?xml version="1.0" encoding="UTF-8"?>
<val>
  <prop action="exclude" att="product" val="onprem"/>
  <prop action="flag" att="product" val="cloud" color="#0369a1" backcolor="#e0f2fe">
    <startflag><alt-text>Cloud</alt-text></startflag>
  </prop>
</val>`;

  it('decorates resolved conkeyref, conref cycles, and all 3 DITAVAL modes without mutating XML', () => {
    const index = new DitaSemanticIndex();
    index.loadFiles({
      'root.ditamap': mapXml,
      'shared/reuse.dita': reuseXml,
      'concepts/sem.dita': topicXml,
    });

    const overlay = index.buildDocumentOverlay('concepts/sem.dita', 'root.ditamap');
    const parsedDv = parseDitaval(ditavalXml);

    const { pmDoc } = xmlToPmDoc(topicXml);
    const baselineXml = pmDocToXml(pmDoc);

    const inspectClasses = (mode: 'show-all' | 'dim-excluded' | 'hide-excluded') => {
      const decos = collectDitaDecorations(pmDoc, 'none', null, noopCallbacks, 1, {
        overlay,
        ditaval: parsedDv,
        ditavalDisplayMode: mode,
      });
      const all = decos.find();
      return all.map((d) => {
        const spec = (d as unknown as { type?: { attrs?: { class?: string } } }).type?.attrs;
        return spec?.class ?? '';
      });
    };

    const dimClasses = inspectClasses('dim-excluded');
    expect(dimClasses.some((c) => c.includes('dita-conref-resolved'))).toBe(true);
    expect(dimClasses.some((c) => c.includes('dita-conref-cycle'))).toBe(true);
    expect(dimClasses.some((c) => c.includes('dita-ditaval-excluded-dim'))).toBe(true);
    expect(dimClasses.some((c) => c.includes('dita-ditaval-flagged'))).toBe(true);

    const hideClasses = inspectClasses('hide-excluded');
    expect(hideClasses.some((c) => c.includes('dita-ditaval-excluded-hide'))).toBe(true);

    const showAllClasses = inspectClasses('show-all');
    expect(showAllClasses.some((c) => c.includes('dita-ditaval-excluded-outline'))).toBe(true);

    // Non-negotiable invariant: ProseMirror Doc & serialized XML remain 100% untouched
    const afterXml = pmDocToXml(pmDoc);
    expect(afterXml).toBe(baselineXml);
  });
});

describe('Phase 3 Map Tree DITAVAL Projection', () => {
  const rootMap = `<?xml version="1.0" encoding="UTF-8"?>
<map id="proj_map">
  <title>Projected Map</title>
  <topicref href="a.dita" product="cloud"/>
  <topicref href="b.dita" product="onprem">
    <topicref href="b-child.dita"/>
  </topicref>
</map>`;

  const dv = parseDitaval(`<?xml version="1.0" encoding="UTF-8"?>
<val>
  <prop action="exclude" att="product" val="onprem"/>
  <prop action="flag" att="product" val="cloud" color="#0369a1"/>
</val>`);

  it('marks excluded branches in dim-excluded mode and filters them with hiddenCount in hide-excluded mode', () => {
    const buffers = { 'root.ditamap': { xml: rootMap } };
    const fileSet = new Set(['root.ditamap', 'a.dita', 'b.dita', 'b-child.dita']);
    const titles = { 'a.dita': 'Cloud A', 'b.dita': 'OnPrem B', 'b-child.dita': 'Child B' };

    const dimResult = buildCompositeMapTree('root.ditamap', buffers, fileSet, titles, {
      ditaval: dv,
      ditavalDisplayMode: 'dim-excluded',
    });
    expect(dimResult.nodes).toHaveLength(2);
    expect(dimResult.excludedCount).toBe(2); // b.dita + inherited b-child.dita
    expect(dimResult.flaggedCount).toBe(1);
    expect(dimResult.hiddenCount).toBe(0);
    expect(dimResult.nodes[1]?.isExcluded).toBe(true);
    expect(dimResult.nodes[1]?.children?.[0]?.isExcluded).toBe(true);

    const hideResult = buildCompositeMapTree('root.ditamap', buffers, fileSet, titles, {
      ditaval: dv,
      ditavalDisplayMode: 'hide-excluded',
    });
    expect(hideResult.nodes).toHaveLength(1);
    expect(hideResult.nodes[0]?.href).toBe('a.dita');
    expect(hideResult.hiddenCount).toBe(1);
  });
});

describe('Phase 3 CodeMirror 6 Semantic Autocomplete', () => {
  const index = new DitaSemanticIndex();
  index.loadFiles({
    'root.ditamap': `<map id="m">
      <keydef keys="prod_name"><topicmeta><keywords><keyword>Nebula</keyword></keywords></topicmeta></keydef>
      <keydef keys="common_reuse" href="shared/reuse.dita" processing-role="resource-only"/>
    </map>`,
    'shared/reuse.dita': `<topic id="r"><title>R</title><body>
      <note id="note_warn" type="warning"><p>Warn</p></note>
      <p id="para_info">Info</p>
    </body></topic>`,
    'filters/cloud.ditaval': `<val>
      <prop action="include" att="platform" val="linux"/>
      <prop action="include" att="platform" val="macos"/>
      <prop action="exclude" att="platform" val="windows"/>
    </val>`,
  });

  const completionSource = createDitaXmlCompletionSource(() => ({
    keyspace: index.getKeyspace('root.ditamap'),
    topicIndices: index.getAllTopicIndices(),
    profilingCatalog: index.getProfilingCatalog(),
  }));

  function completeAtEnd(doc: string) {
    const state = EditorState.create({ doc });
    const ctx = new CompletionContext(state, doc.length, true);
    return completionSource(ctx);
  }

  it('completes keyref values from active Root Map keyspace', () => {
    const res = completeAtEnd('<topic id="t"><body><p><keyword keyref="pr');
    expect(res).not.toBeNull();
    expect(res!.options.some((o) => o.label === 'prod_name')).toBe(true);
    expect(res!.from).toBe('<topic id="t"><body><p><keyword keyref="'.length);
  });

  it('completes compatible element IDs after conkeyref="key/"', () => {
    const res = completeAtEnd('<topic id="t"><body><note conkeyref="common_reuse/');
    expect(res).not.toBeNull();
    const labels = res!.options.map((o) => o.label);
    expect(labels).toContain('note_warn');
    expect(labels).not.toContain('para_info'); // <p> is incompatible with <note>
  });

  it('completes multi-token profiling attributes replacing only the trailing token', () => {
    const doc = '<topic id="t"><body><p platform="linux ma';
    const res = completeAtEnd(doc);
    expect(res).not.toBeNull();
    expect(res!.from).toBe('<topic id="t"><body><p platform="linux '.length);
    const labels = res!.options.map((o) => o.label);
    expect(labels).toContain('macos');
    expect(labels).not.toContain('linux'); // already used in attribute value
  });
});
