import { describe, expect, it } from 'vitest';
import {
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
  resolveDitaHref,
  serializeXml,
  transferMapNode,
  updateMapNodeAttr,
  updateMapNodeNavtitle,
  updateMapTitle,
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
