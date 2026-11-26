import { describe, expect, it } from 'vitest';
import {
  DITA_KEY_NAME_PATTERN,
  classifyDitaFileKind,
  computeRelativeDitaHref,
  createMapTemplate,
  deleteMapNode,
  extractDitaDocumentTitle,
  extractDitaTopicType,
  insertMapNode,
  isDitaMapXml,
  moveMapNodes,
  normalizePosixPath,
  parseDitaMap,
  parseXml,
  removeMapNodeKey,
  renameMapNodeKeyToken,
  resolveDitaHref,
  serializeXml,
  transferMapNode,
  updateMapKeyValueText,
  updateMapNodeAttr,
  updateMapNodeNavtitle,
  updateMapTitle,
  upsertMapKeyInlineText,
} from '../src/index.js';

const SAMPLE_DITAMAP = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="urn:oasis:names:tc:dita:rng:map.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- Root map editorial comment -->
<map id="product_manual" xml:lang="zh-CN">
  <title>DITAEditor 产品手册</title>
  <topicmeta>
    <author>Docs Team</author>
    <keywords>
      <keyword>DITA 1.3</keyword>
    </keywords>
  </topicmeta>
  <keydef keys="prod_name" processing-role="resource-only">
    <topicmeta>
      <keywords>
        <keyword>DITAEditor</keyword>
      </keywords>
    </topicmeta>
  </keydef>
  <topicref id="ref_arch" href="concepts/dita-architecture.dita" type="concept" navtitle="架构概述">
    <topicref id="ref_single" href="concepts/single-sourcing.dita" type="concept"/>
  </topicref>
  <topichead navtitle="操作指南">
    <topicref href="tasks/deploy-worker.dita" type="task"/>
  </topichead>
  <mapref href="maps/reference-guide.ditamap" format="ditamap"/>
  <reltable>
    <relheader>
      <relcolspec type="concept"/>
      <relcolspec type="task"/>
    </relheader>
    <relrow>
      <relcell>
        <topicref href="concepts/dita-architecture.dita"/>
      </relcell>
      <relcell>
        <topicref href="tasks/deploy-worker.dita"/>
      </relcell>
    </relrow>
  </reltable>
</map>
`;

const SAMPLE_BOOKMAP = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE bookmap PUBLIC "-//OASIS//DTD DITA BookMap//EN" "bookmap.dtd">
<bookmap id="admin_book" xml:lang="zh-CN">
  <booktitle>
    <mainbooktitle>企业管理手册</mainbooktitle>
    <booktitlealt>v2.0</booktitlealt>
  </booktitle>
  <bookmeta>
    <author>Platform Docs</author>
  </bookmeta>
  <frontmatter>
    <booklists>
      <toc/>
    </booklists>
  </frontmatter>
  <part navtitle="核心概念篇">
    <chapter href="concepts/dita-architecture.dita" navtitle="架构原理"/>
  </part>
  <appendix href="references/server-sizing-cals.dita" navtitle="附录：服务器规格"/>
</bookmap>
`;

describe('DITA Map / Bookmap Lossless Engine & Path Utils', () => {
  it('resolves and computes POSIX relative DITA href paths safely', () => {
    expect(normalizePosixPath('maps\\sub/../guide.ditamap')).toBe('maps/guide.ditamap');

    expect(resolveDitaHref('maps/getting-started.ditamap', '../concepts/arch.dita#c1/p1')).toEqual({
      targetPath: 'concepts/arch.dita',
      fragment: 'c1/p1',
      isExternal: false,
      escapesRoot: false,
    });

    expect(resolveDitaHref('maps/sub.ditamap', '../../outside/secret.dita')).toEqual({
      targetPath: '',
      fragment: undefined,
      isExternal: false,
      escapesRoot: true,
    });

    expect(resolveDitaHref('product-manual.ditamap', 'https://docs.oasis-open.org/dita')).toEqual({
      targetPath: '',
      isExternal: true,
      escapesRoot: false,
    });

    expect(
      computeRelativeDitaHref('maps/nested/sub.ditamap', 'concepts/dita-architecture.dita'),
    ).toBe('../../concepts/dita-architecture.dita');
    expect(computeRelativeDitaHref('product-manual.ditamap', 'tasks/deploy-worker.dita')).toBe(
      'tasks/deploy-worker.dita',
    );

    expect(classifyDitaFileKind('admin.bookmap')).toBe('bookmap');
    expect(classifyDitaFileKind('root.ditamap')).toBe('ditamap');
    expect(classifyDitaFileKind('intro.dita')).toBe('topic');
    expect(classifyDitaFileKind('cloud.ditaval')).toBe('ditaval');
    expect(classifyDitaFileKind('images/arch.svg')).toBe('image');
  });

  it('parses .ditamap and .bookmap trees with metadata summary and source locations', () => {
    expect(isDitaMapXml(SAMPLE_DITAMAP)).toBe(true);
    expect(isDitaMapXml(SAMPLE_BOOKMAP)).toBe(true);
    expect(isDitaMapXml('<topic id="t1"><title>T</title></topic>')).toBe(false);

    const parsedMap = parseDitaMap(SAMPLE_DITAMAP);
    expect(parsedMap.kind).toBe('map');
    expect(parsedMap.title).toBe('DITAEditor 产品手册');
    expect(parsedMap.nodes.map((n) => n.tagName)).toEqual([
      'keydef',
      'topicref',
      'topichead',
      'mapref',
    ]);
    expect(parsedMap.nodes[0]!.label).toBe('key: prod_name');
    expect(parsedMap.nodes[1]!.label).toBe('架构概述');
    expect(parsedMap.nodes[1]!.children).toHaveLength(1);
    expect(parsedMap.nodes[1]!.children![0]!.children).toEqual([]);
    expect(parsedMap.nodes[3]!.isSubmapRef).toBe(true);
    expect(parsedMap.nodes[1]!.line).toBeGreaterThan(15);
    expect(parsedMap.preservedMetaSummary).toEqual({
      hasDoctype: true,
      commentCount: 1,
      piCount: 1,
      hasReltable: true,
      hasBookmeta: false,
      hasTopicmeta: true,
    });
    // Includes reltable topicrefs as well as main tree nodes
    expect(parsedMap.references.length).toBeGreaterThanOrEqual(6);

    const parsedBook = parseDitaMap(SAMPLE_BOOKMAP);
    expect(parsedBook.kind).toBe('bookmap');
    expect(parsedBook.title).toBe('企业管理手册');
    expect(parsedBook.nodes.map((n) => n.tagName)).toEqual(['frontmatter', 'part', 'appendix']);
    expect(parsedBook.preservedMetaSummary.hasBookmeta).toBe(true);
    expect(extractDitaDocumentTitle(SAMPLE_BOOKMAP)).toBe('企业管理手册');
  });

  it('detects the topic type from the root element and reports null for non-topic roots', () => {
    expect(extractDitaTopicType('<concept id="a"><title>A</title></concept>')).toBe('concept');
    expect(extractDitaTopicType('<task id="b"><title>B</title></task>')).toBe('task');
    expect(extractDitaTopicType('<reference id="c"><title>C</title></reference>')).toBe('reference');
    expect(extractDitaTopicType('<topic id="d"><title>D</title></topic>')).toBe('topic');
    expect(extractDitaTopicType(SAMPLE_DITAMAP)).toBeNull();
    expect(extractDitaTopicType('<mySpecialization id="e"/>')).toBeNull();
    expect(extractDitaTopicType('not xml')).toBeNull();
  });

  it('reorders, nests, and un-nests map nodes losslessly without disturbing metadata or reltable', () => {
    const initial = parseDitaMap(SAMPLE_DITAMAP);
    // Tree nodes at root: [0]=keydef, [1]=topicref(ref_arch), [2]=topichead, [3]=mapref
    const archPath = initial.nodes[1]!.elementPath;
    const topicheadPath = initial.nodes[2]!.elementPath;
    const maprefPath = initial.nodes[3]!.elementPath;

    // 1. Reorder topichead (pre-removal index 2 -> drag down to slot 4, after mapref)
    const step1 = moveMapNodes(SAMPLE_DITAMAP, [topicheadPath], null, 4);
    expect(step1.moved).toBe(true);
    const after1 = parseDitaMap(step1.xml);
    expect(after1.nodes.map((n) => n.tagName)).toEqual(['keydef', 'topicref', 'mapref', 'topichead']);
    // Ensure <reltable> remained at the very end after the last tree node!
    expect(step1.xml.indexOf('</topichead>')).toBeLessThan(step1.xml.indexOf('<reltable>'));
    expect(step1.xml).toContain('<!-- Root map editorial comment -->');
    expect(step1.xml).toContain('<?xml-model');
    expect(step1.xml).toContain('<!DOCTYPE map PUBLIC');

    // 2. Nest mapref inside topicref(ref_arch)
    const step2 = moveMapNodes(
      step1.xml,
      [after1.nodes[2]!.elementPath],
      after1.nodes[1]!.elementPath,
      1,
    );
    expect(step2.moved).toBe(true);
    const after2 = parseDitaMap(step2.xml);
    expect(after2.nodes.map((n) => n.tagName)).toEqual(['keydef', 'topicref', 'topichead']);
    expect(after2.nodes[1]!.children?.map((c) => c.tagName)).toEqual(['topicref', 'mapref']);

    // 3. Cycle guard: dragging parent into its own descendant must be rejected
    const cyclic = moveMapNodes(
      step2.xml,
      [after2.nodes[1]!.elementPath],
      after2.nodes[1]!.children![0]!.elementPath,
      0,
    );
    expect(cyclic.moved).toBe(false);
    expect(cyclic.xml).toBe(step2.xml);

    // 4. Reorder up within same parent: move ref_single into index 0 before keydef
    const nestedChildPath = after2.nodes[1]!.children![0]!.elementPath;
    const step4 = moveMapNodes(step2.xml, [nestedChildPath], null, 0);
    expect(step4.moved).toBe(true);
    const after4 = parseDitaMap(step4.xml);
    expect(after4.nodes[0]!.href).toBe('concepts/single-sourcing.dita');
    expect(after4.nodes[0]!.rawAttrs.map((a) => a.name)).toEqual(['id', 'href', 'type']);

    // Idempotent deterministic serialization check
    expect(serializeXml(parseXml(step4.xml))).toBe(step4.xml);
    void archPath;
    void maprefPath;
  });

  it('inserts, updates attributes/navtitle/title, and deletes map nodes preserving attribute order', () => {
    const inserted = insertMapNode(SAMPLE_DITAMAP, {
      parentPath: null,
      index: 2,
      tagName: 'topicref',
      attrs: [
        { name: 'href', value: 'tasks/new-guide.dita', namespaceURI: null },
        { name: 'type', value: 'task', namespaceURI: null },
      ],
      navtitle: '新建向导任务',
    });

    const parsedInserted = parseDitaMap(inserted.xml);
    const newNode = parsedInserted.nodes[2]!;
    expect(newNode.href).toBe('tasks/new-guide.dita');
    expect(newNode.navtitle).toBe('新建向导任务');
    expect(newNode.rawAttrs.map((a) => a.name)).toEqual(['href', 'type', 'navtitle']);

    // Update attribute in-place preserving exact order
    const attrUpdated = updateMapNodeAttr(inserted.xml, newNode.elementPath, 'type', 'reference');
    const parsedAttrUpdated = parseDitaMap(attrUpdated.xml);
    expect(parsedAttrUpdated.nodes[2]!.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'href=tasks/new-guide.dita',
      'type=reference',
      'navtitle=新建向导任务',
    ]);

    // Update navtitle and root title
    const navUpdated = updateMapNodeNavtitle(
      attrUpdated.xml,
      newNode.elementPath,
      '更新后的向导标题',
    );
    expect(parseDitaMap(navUpdated.xml).nodes[2]!.label).toBe('更新后的向导标题');

    const titleUpdated = updateMapTitle(navUpdated.xml, '新版产品手册 v2');
    expect(parseDitaMap(titleUpdated.xml).title).toBe('新版产品手册 v2');

    // Bookmap title update targets <booktitle>/<mainbooktitle>
    const bookTitleUpdated = updateMapTitle(SAMPLE_BOOKMAP, '企业管理手册（修订版）');
    expect(parseDitaMap(bookTitleUpdated.xml).title).toBe('企业管理手册（修订版）');

    // Delete inserted node
    const deleted = deleteMapNode(titleUpdated.xml, newNode.elementPath);
    expect(deleted.deleted).toBe(true);
    expect(parseDitaMap(deleted.xml).nodes.map((n) => n.tagName)).toEqual([
      'keydef',
      'topicref',
      'topichead',
      'mapref',
    ]);
  });

  it('renames one keys token without touching sibling tokens or attribute order', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="keys_map" keys="root_key">
  <keydef keys="prod_name cloud_endpoint" href="concepts/intro.dita" type="concept" scope="peer"/>
  <keydef keys="prod_name" processing-role="resource-only">
    <topicmeta>
      <keywords>
        <keyword>DITAEditor</keyword>
      </keywords>
    </topicmeta>
  </keydef>
</map>
`;

    const node = parseDitaMap(xml).nodes[0]!;
    const renamed = renameMapNodeKeyToken(xml, node.elementPath, 'cloud_endpoint', 'cloud_api');
    expect(renamed.changed).toBe(true);
    expect(parseDitaMap(renamed.xml).nodes[0]!.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'keys=prod_name cloud_api',
      'href=concepts/intro.dita',
      'type=concept',
      'scope=peer',
    ]);
    // Round-trip stays deterministic and lossless (declaration, DOCTYPE, comments, other keys).
    expect(serializeXml(parseXml(renamed.xml))).toBe(renamed.xml);
    expect(renamed.xml).toContain('<map id="keys_map" keys="root_key">');

    // Renaming the root map's own keys token works without an element path.
    const rootRenamed = renameMapNodeKeyToken(xml, null, 'root_key', 'workspace_root');
    expect(rootRenamed.changed).toBe(true);
    expect(rootRenamed.xml).toContain('<map id="keys_map" keys="workspace_root">');

    // Unknown tokens and missing attributes are reported as no-ops instead of corrupting the map.
    expect(renameMapNodeKeyToken(xml, node.elementPath, 'missing_key', 'x').changed).toBe(false);
    expect(renameMapNodeKeyToken(xml, node.elementPath, 'prod_name', '  ').changed).toBe(false);
  });

  it('rewrites a key value in place and refuses to flatten inline markup', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="value_map">
  <keydef keys="prod_name" processing-role="resource-only">
    <topicmeta>
      <keywords>
        <keyword>DITAEditor</keyword>
      </keywords>
    </topicmeta>
  </keydef>
  <keydef keys="rich_name" processing-role="resource-only">
    <topicmeta>
      <keywords>
        <keyword>DITA <ph>markup</ph></keyword>
      </keywords>
    </topicmeta>
  </keydef>
  <topicref keys="legacy_title" href="concepts/intro.dita" navtitle="旧标题"/>
</map>
`;

    const nodes = parseDitaMap(xml).nodes;
    const keywordDef = nodes[0]!;
    const updated = updateMapKeyValueText(xml, keywordDef.elementPath, 'keyword', 'DITAEditor Enterprise');
    expect(updated.changed).toBe(true);
    expect(updated.xml).toContain('<keyword>DITAEditor Enterprise</keyword>');
    // Value element and attributes are untouched, and formatting stays deterministic.
    expect(parseDitaMap(updated.xml).nodes[0]!.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'keys=prod_name',
      'processing-role=resource-only',
    ]);
    expect(serializeXml(parseXml(updated.xml))).toBe(updated.xml);

    // Inline markup inside the value is never flattened into plain text.
    const richDef = nodes[1]!;
    const rich = updateMapKeyValueText(xml, richDef.elementPath, 'keyword', 'flattened');
    expect(rich.changed).toBe(false);
    expect(rich.xml).toBe(xml);

    // Keys whose value lives in `@navtitle` update the attribute and keep attribute order.
    const legacyDef = nodes[2]!;
    const legacy = updateMapKeyValueText(xml, legacyDef.elementPath, 'navtitle', '新标题');
    expect(legacy.changed).toBe(true);
    expect(parseDitaMap(legacy.xml).nodes[2]!.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'keys=legacy_title',
      'href=concepts/intro.dita',
      'navtitle=新标题',
    ]);

    // Empty values and mismatched sources are reported as no-ops.
    expect(updateMapKeyValueText(xml, keywordDef.elementPath, 'keyword', '   ').changed).toBe(false);
    expect(updateMapKeyValueText(xml, legacyDef.elementPath, 'linktext', 'x').changed).toBe(false);
  });

  it('creates clean lossless .ditamap and .bookmap templates', () => {
    const mapXml = createMapTemplate('map', { id: 'my_map', title: '测试地图' });
    const parsedMap = parseDitaMap(mapXml);
    expect(parsedMap.kind).toBe('map');
    expect(parsedMap.title).toBe('测试地图');
    expect(serializeXml(parseXml(mapXml))).toBe(mapXml);

    const bookXml = createMapTemplate('bookmap', { id: 'my_book', title: '测试手册' });
    const parsedBook = parseDitaMap(bookXml);
    expect(parsedBook.kind).toBe('bookmap');
    expect(parsedBook.title).toBe('测试手册');
    expect(serializeXml(parseXml(bookXml))).toBe(bookXml);
  });

  it('transfers a map subtree across two maps while rewriting relative hrefs losslessly', () => {
    const submapXml = createMapTemplate('map', { id: 'sub', title: 'Submap' });
    const parsedRoot = parseDitaMap(SAMPLE_DITAMAP);
    // Node [1] is <topicref href="concepts/dita-architecture.dita"> with nested child
    const archPath = parsedRoot.nodes[1]!.elementPath;

    const transferred = transferMapNode(
      SAMPLE_DITAMAP,
      archPath,
      submapXml,
      null,
      1,
      (href) =>
        computeRelativeDitaHref(
          'maps/sub.ditamap',
          resolveDitaHref('product-manual.ditamap', href).targetPath,
        ),
    );
    expect(transferred.moved).toBe(true);

    const nextRoot = parseDitaMap(transferred.sourceXml);
    expect(nextRoot.nodes.map((n) => n.tagName)).toEqual(['keydef', 'topichead', 'mapref']);
    expect(transferred.sourceXml).toContain('<reltable>');

    const nextSub = parseDitaMap(transferred.targetXml);
    expect(nextSub.nodes[1]!.href).toBe('../concepts/dita-architecture.dita');
    expect(nextSub.nodes[1]!.children?.[0]?.href).toBe('../concepts/single-sourcing.dita');
  });
});

const KEY_MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="urn:oasis:names:tc:dita:rng:map.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- Key management fixture: keep this comment -->
<map id="key_map" xml:lang="zh-CN">
  <title>Key Map</title>
  <keydef keys="prod_name" processing-role="resource-only"/>
  <keydef keys="doc_url" href="https://example.com/doc" format="html" scope="external">
    <topicmeta>
      <navtitle>External Docs</navtitle>
      <shortdesc>Reference site</shortdesc>
    </topicmeta>
  </keydef>
  <keydef keys="rich_name">
    <topicmeta>
      <keywords>
        <keyword>DITA <ph>markup</ph></keyword>
      </keywords>
    </topicmeta>
  </keydef>
  <topicref keys="legacy" href="concepts/legacy.dita" type="concept">
    <topicref href="concepts/child.dita"/>
  </topicref>
</map>
`;

describe('Key name validation', () => {
  it('accepts DITA 1.3 NMTOKEN-shaped key names and rejects unsafe ones', () => {
    for (const name of ['prod_name', 'a', 'A1.b-c_d', '_private', '0zero', 'key.with.dots']) {
      expect(DITA_KEY_NAME_PATTERN.test(name)).toBe(true);
    }
    for (const name of ['', ' spaced', 'with space', '-leading', '.leading', 'a/b', 'a#b', 'key$x', '键值']) {
      expect(DITA_KEY_NAME_PATTERN.test(name)).toBe(false);
    }
  });
});

describe('DITA Map key inline text extraction (parseDitaMap)', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<map id="inline_map">
  <keydef keys="k_keyword">
    <topicmeta>
      <keywords>
        <keyword>Keyword Value</keyword>
      </keywords>
      <linktext>Linktext Value</linktext>
      <navtitle>Navtitle Value</navtitle>
    </topicmeta>
  </keydef>
  <keydef keys="k_linktext">
    <topicmeta>
      <linktext>Linktext Only</linktext>
      <navtitle>Navtitle Only</navtitle>
    </topicmeta>
  </keydef>
  <keydef keys="k_navtitle">
    <topicmeta>
      <navtitle>Meta Navtitle</navtitle>
    </topicmeta>
  </keydef>
  <keydef keys="k_attr" navtitle="Attr Navtitle"/>
  <keydef keys="k_none"/>
</map>
`;

  it('follows the Keyspace priority keyword > linktext > topicmeta navtitle > @navtitle', () => {
    const nodes = parseDitaMap(xml).nodes;
    expect(nodes.map((n) => n.inlineText)).toEqual([
      'Keyword Value',
      'Linktext Only',
      'Meta Navtitle',
      'Attr Navtitle',
      undefined,
    ]);
    expect(nodes.map((n) => n.inlineTextSource)).toEqual([
      'keyword',
      'linktext',
      'navtitle',
      'navtitle',
      'none',
    ]);
  });

  it('reports keyword-sourced inline text for the shared sample map', () => {
    const keydef = parseDitaMap(SAMPLE_DITAMAP).nodes[0]!;
    expect(keydef.inlineText).toBe('DITAEditor');
    expect(keydef.inlineTextSource).toBe('keyword');
  });
});

describe('DITA Map key insertion with keyword & linktext', () => {
  it('writes <navtitle> -> <linktext> -> <keywords> inside topicmeta in DITA 1.3 order', () => {
    const inserted = insertMapNode(KEY_MAP_XML, {
      parentPath: null,
      index: 0,
      tagName: 'keydef',
      attrs: [
        { name: 'keys', value: 'doc_external', namespaceURI: null },
        { name: 'href', value: 'https://example.com/guide', namespaceURI: null },
        { name: 'format', value: 'html', namespaceURI: null },
        { name: 'scope', value: 'external', namespaceURI: null },
      ],
      navtitle: '外部文档',
      useTopicmetaNavtitle: true,
      keydefLinktext: 'Example Guide',
      keydefKeyword: 'example_key',
    });

    const node = parseDitaMap(inserted.xml).nodes[0]!;
    expect(node.tagName).toBe('keydef');
    // keyword wins the extraction priority even when navtitle and linktext also exist
    expect(node.inlineText).toBe('example_key');
    expect(node.inlineTextSource).toBe('keyword');
    expect(node.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'keys=doc_external',
      'href=https://example.com/guide',
      'format=html',
      'scope=external',
    ]);

    const navIdx = inserted.xml.indexOf('<navtitle>外部文档</navtitle>');
    const linkIdx = inserted.xml.indexOf('<linktext>Example Guide</linktext>');
    const keywordsIdx = inserted.xml.indexOf('<keywords>');
    expect(navIdx).toBeGreaterThan(-1);
    expect(linkIdx).toBeGreaterThan(navIdx);
    expect(keywordsIdx).toBeGreaterThan(linkIdx);
    expect(inserted.xml).toContain('<keyword>example_key</keyword>');

    // Lossless: declaration, xml-model PI, DOCTYPE, comment all survive.
    expect(inserted.xml).toContain('<!DOCTYPE map PUBLIC');
    expect(inserted.xml).toContain('<?xml-model');
    expect(inserted.xml).toContain('<!-- Key management fixture: keep this comment -->');
    expect(serializeXml(parseXml(inserted.xml))).toBe(inserted.xml);
  });

  it('ignores blank keyword/linktext options and keeps a plain node when nothing is provided', () => {
    const inserted = insertMapNode(KEY_MAP_XML, {
      parentPath: null,
      index: 0,
      tagName: 'keydef',
      attrs: [{ name: 'keys', value: 'blank_key', namespaceURI: null }],
      keydefLinktext: '   ',
      keydefKeyword: '  ',
    });
    expect(inserted.xml).toContain('<keydef keys="blank_key"/>');
    expect(parseDitaMap(inserted.xml).nodes[0]!.inlineTextSource).toBe('none');
  });
});

describe('upsertMapKeyInlineText', () => {
  it('creates <topicmeta><keywords><keyword> when the key has no metadata yet', () => {
    const target = parseDitaMap(KEY_MAP_XML).nodes[0]!;
    const result = upsertMapKeyInlineText(KEY_MAP_XML, target.elementPath, 'keyword', 'DITAEditor Enterprise');
    expect(result.changed).toBe(true);

    const node = parseDitaMap(result.xml).nodes[0]!;
    expect(node.inlineText).toBe('DITAEditor Enterprise');
    expect(node.inlineTextSource).toBe('keyword');
    // Attributes keep their exact order and value.
    expect(node.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'keys=prod_name',
      'processing-role=resource-only',
    ]);
    expect(result.xml).toContain('<keyword>DITAEditor Enterprise</keyword>');
    // Surrounding XML is untouched.
    expect(result.xml).toContain('<!DOCTYPE map PUBLIC');
    expect(result.xml).toContain('<?xml-model');
    expect(result.xml).toContain('<!-- Key management fixture: keep this comment -->');
    expect(serializeXml(parseXml(result.xml))).toBe(result.xml);
  });

  it('updates an existing pure-text <keyword> in place without duplicating the container', () => {
    const target = parseDitaMap(KEY_MAP_XML).nodes[0]!;
    const created = upsertMapKeyInlineText(KEY_MAP_XML, target.elementPath, 'keyword', 'First Value');
    const updated = upsertMapKeyInlineText(created.xml, target.elementPath, 'keyword', 'Second Value');
    expect(updated.changed).toBe(true);
    expect(updated.xml).toContain('<keyword>Second Value</keyword>');
    expect(updated.xml).not.toContain('First Value');
    expect(updated.xml.match(/Second Value/g)).toHaveLength(1);
    expect(updated.xml).not.toContain('<keyword>First Value</keyword>');
    expect(serializeXml(parseXml(updated.xml))).toBe(updated.xml);
  });

  it('inserts <keywords> after existing navtitle/shortdesc and <linktext> before them per DITA order', () => {
    const nodes = parseDitaMap(KEY_MAP_XML).nodes;
    const docUrlPath = nodes[1]!.elementPath;

    const withKeyword = upsertMapKeyInlineText(KEY_MAP_XML, docUrlPath, 'keyword', 'External Doc');
    expect(withKeyword.changed).toBe(true);
    const afterKeyword = withKeyword.xml;
    expect(afterKeyword.indexOf('<navtitle>External Docs</navtitle>')).toBeLessThan(
      afterKeyword.indexOf('<shortdesc>Reference site</shortdesc>'),
    );
    expect(afterKeyword.indexOf('<shortdesc>Reference site</shortdesc>')).toBeLessThan(
      afterKeyword.indexOf('<keywords>'),
    );
    // Existing sibling metadata survives.
    expect(parseDitaMap(afterKeyword).nodes[1]!.inlineText).toBe('External Doc');
    expect(parseDitaMap(afterKeyword).nodes[1]!.rawAttrs.map((a) => a.name)).toEqual([
      'keys',
      'href',
      'format',
      'scope',
    ]);

    const withLinktext = upsertMapKeyInlineText(afterKeyword, docUrlPath, 'linktext', 'Example Docs');
    expect(withLinktext.changed).toBe(true);
    expect(withLinktext.xml.indexOf('<navtitle>External Docs</navtitle>')).toBeLessThan(
      withLinktext.xml.indexOf('<linktext>Example Docs</linktext>'),
    );
    expect(withLinktext.xml.indexOf('<linktext>Example Docs</linktext>')).toBeLessThan(
      withLinktext.xml.indexOf('<shortdesc>Reference site</shortdesc>'),
    );
    // <keyword> still wins the extraction priority.
    expect(parseDitaMap(withLinktext.xml).nodes[1]!.inlineTextSource).toBe('keyword');
    expect(serializeXml(parseXml(withLinktext.xml))).toBe(withLinktext.xml);
  });

  it('creates <topicmeta> before non-metadata children of a topicref', () => {
    const nodes = parseDitaMap(KEY_MAP_XML).nodes;
    const legacyPath = nodes[3]!.elementPath;
    const result = upsertMapKeyInlineText(KEY_MAP_XML, legacyPath, 'linktext', 'Legacy Guide');
    expect(result.changed).toBe(true);

    const legacy = parseDitaMap(result.xml).nodes[3]!;
    expect(legacy.inlineText).toBe('Legacy Guide');
    expect(legacy.inlineTextSource).toBe('linktext');
    expect(legacy.children?.map((c) => c.tagName)).toEqual(['topicref']);
    // topicmeta sits between the parent topicref tag and its first child topicref
    const parentOpen = result.xml.indexOf('<topicref keys="legacy" href="concepts/legacy.dita" type="concept">');
    const topicmetaIdx = result.xml.indexOf('<topicmeta>', parentOpen);
    const childIdx = result.xml.indexOf('<topicref href="concepts/child.dita"/>');
    expect(parentOpen).toBeGreaterThan(-1);
    expect(topicmetaIdx).toBeGreaterThan(parentOpen);
    expect(childIdx).toBeGreaterThan(topicmetaIdx);
    expect(serializeXml(parseXml(result.xml))).toBe(result.xml);
  });

  it('refuses to flatten inline markup inside the value holder', () => {
    const richPath = parseDitaMap(KEY_MAP_XML).nodes[2]!.elementPath;
    const refused = upsertMapKeyInlineText(KEY_MAP_XML, richPath, 'keyword', 'flattened');
    expect(refused.changed).toBe(false);
    expect(refused.xml).toBe(KEY_MAP_XML);

    const cleared = upsertMapKeyInlineText(KEY_MAP_XML, richPath, 'keyword', null);
    expect(cleared.changed).toBe(false);
    expect(cleared.xml).toBe(KEY_MAP_XML);
  });

  it('clears the value and drops empty <keywords>/<topicmeta> containers', () => {
    const target = parseDitaMap(KEY_MAP_XML).nodes[0]!;
    const created = upsertMapKeyInlineText(KEY_MAP_XML, target.elementPath, 'keyword', 'Temp Value');
    const cleared = upsertMapKeyInlineText(created.xml, target.elementPath, 'keyword', null);
    expect(cleared.changed).toBe(true);
    expect(cleared.xml).not.toContain('Temp Value');
    // Only the pre-existing rich_name keywords container remains.
    expect(cleared.xml.match(/<keywords>/g)).toHaveLength(1);
    expect(cleared.xml).toContain('<keydef keys="prod_name" processing-role="resource-only"/>');
    expect(parseDitaMap(cleared.xml).nodes[0]!.inlineTextSource).toBe('none');
    expect(serializeXml(parseXml(cleared.xml))).toBe(cleared.xml);
  });

  it('keeps <topicmeta> siblings when only the cleared container becomes empty', () => {
    const docUrlPath = parseDitaMap(KEY_MAP_XML).nodes[1]!.elementPath;
    const withKeyword = upsertMapKeyInlineText(KEY_MAP_XML, docUrlPath, 'keyword', 'Temporary');
    const cleared = upsertMapKeyInlineText(withKeyword.xml, docUrlPath, 'keyword', '   ');
    expect(cleared.changed).toBe(true);
    // Only the pre-existing rich_name keywords container remains.
    expect(cleared.xml.match(/<keywords>/g)).toHaveLength(1);
    expect(cleared.xml).toContain('<navtitle>External Docs</navtitle>');
    expect(cleared.xml).toContain('<shortdesc>Reference site</shortdesc>');
    expect(cleared.xml).toContain('<topicmeta>');
    // navtitle is now the highest-priority value again.
    expect(parseDitaMap(cleared.xml).nodes[1]!.inlineTextSource).toBe('navtitle');
    expect(serializeXml(parseXml(cleared.xml))).toBe(cleared.xml);
  });

  it('removes only <linktext> and keeps other metadata when clearing a linktext value', () => {
    const nodes = parseDitaMap(KEY_MAP_XML).nodes;
    const docUrlPath = nodes[1]!.elementPath;
    const withLinktext = upsertMapKeyInlineText(KEY_MAP_XML, docUrlPath, 'linktext', 'Example Docs');
    const cleared = upsertMapKeyInlineText(withLinktext.xml, docUrlPath, 'linktext', null);
    expect(cleared.changed).toBe(true);
    expect(cleared.xml).not.toContain('<linktext>');
    expect(cleared.xml).toContain('<navtitle>External Docs</navtitle>');
    expect(cleared.xml).toContain('<topicmeta>');

    // Clearing a linktext that never existed is a no-op.
    const noop = upsertMapKeyInlineText(KEY_MAP_XML, docUrlPath, 'linktext', null);
    expect(noop.changed).toBe(false);
    expect(noop.xml).toBe(KEY_MAP_XML);
  });

  it('rejects empty paths, root targets, and unknown paths without touching the XML', () => {
    expect(upsertMapKeyInlineText(KEY_MAP_XML, [], 'keyword', 'x')).toEqual({
      xml: KEY_MAP_XML,
      changed: false,
    });
    expect(upsertMapKeyInlineText(KEY_MAP_XML, [99], 'keyword', 'x').changed).toBe(false);
  });
});

describe('removeMapNodeKey', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<!-- Delete one key, keep everything else -->
<map id="remove_keys_map">
  <keydef keys="single_key" processing-role="resource-only"/>
  <keydef keys="multi_a multi_b" href="concepts/a.dita" type="concept" scope="local"/>
  <topicref keys="nav_a nav_b" href="concepts/nav.dita" type="task"/>
</map>
`;

  it('removes a single-key <keydef> element entirely', () => {
    const path = parseDitaMap(xml).nodes[0]!.elementPath;
    const result = removeMapNodeKey(xml, path, 'single_key');
    expect(result.changed).toBe(true);
    expect(result.removedElement).toBe(true);
    expect(result.xml).not.toContain('single_key');
    expect(result.xml).not.toContain('<keydef keys="single_key"');
    expect(result.xml).toContain('<!DOCTYPE map PUBLIC');
    expect(result.xml).toContain('<!-- Delete one key, keep everything else -->');
    expect(parseDitaMap(result.xml).nodes.map((n) => n.tagName)).toEqual(['keydef', 'topicref']);
    expect(serializeXml(parseXml(result.xml))).toBe(result.xml);
  });

  it('removes only one token from a multi-key <keydef> preserving attribute order', () => {
    const path = parseDitaMap(xml).nodes[1]!.elementPath;
    const result = removeMapNodeKey(xml, path, 'multi_a');
    expect(result.changed).toBe(true);
    expect(result.removedElement).toBe(false);
    expect(parseDitaMap(result.xml).nodes[1]!.rawAttrs.map((a) => `${a.name}=${a.value}`)).toEqual([
      'keys=multi_b',
      'href=concepts/a.dita',
      'type=concept',
      'scope=local',
    ]);
    expect(serializeXml(parseXml(result.xml))).toBe(result.xml);
  });

  it('removes a key token from a <topicref> and drops @keys when it becomes empty', () => {
    const path = parseDitaMap(xml).nodes[2]!.elementPath;
    const first = removeMapNodeKey(xml, path, 'nav_a');
    expect(first.changed).toBe(true);
    expect(first.removedElement).toBe(false);
    expect(parseDitaMap(first.xml).nodes[2]!.keys).toBe('nav_b');

    const second = removeMapNodeKey(first.xml, path, 'nav_b');
    expect(second.changed).toBe(true);
    expect(second.removedElement).toBe(false);
    expect(parseDitaMap(second.xml).nodes[2]!.keys).toBeUndefined();
    expect(second.xml).toContain('<topicref href="concepts/nav.dita" type="task"/>');
    expect(second.xml).not.toContain('<topicref keys=');
    expect(serializeXml(parseXml(second.xml))).toBe(second.xml);
  });

  it('keeps the element and reports no change for unknown keys, empty paths, and the map root', () => {
    const path = parseDitaMap(xml).nodes[1]!.elementPath;
    const unknown = removeMapNodeKey(xml, path, 'not_a_key');
    expect(unknown).toEqual({ xml, changed: false, removedElement: false });

    expect(removeMapNodeKey(xml, [], 'single_key')).toEqual({
      xml,
      changed: false,
      removedElement: false,
    });
    expect(removeMapNodeKey(xml, path, '   ').changed).toBe(false);
  });

  it('preserves comments and PIs around the removed key definition', () => {
    const withPi = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="urn:oasis:names:tc:dita:rng:map.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="pi_map">
  <!-- before -->
  <keydef keys="temp_key"/>
  <!-- after -->
  <?oxy_comment_start author="docs"?>
</map>
`;
    const result = removeMapNodeKey(withPi, [0], 'temp_key');
    expect(result.changed).toBe(true);
    expect(result.removedElement).toBe(true);
    expect(result.xml).toContain('<?xml-model');
    expect(result.xml).toContain('<!DOCTYPE map PUBLIC');
    expect(result.xml).toContain('<!-- before -->');
    expect(result.xml).toContain('<!-- after -->');
    expect(result.xml).toContain('<?oxy_comment_start author="docs"?>');
    expect(serializeXml(parseXml(result.xml))).toBe(result.xml);
  });
});
