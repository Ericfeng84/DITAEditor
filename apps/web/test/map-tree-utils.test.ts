import { describe, expect, it } from 'vitest';
import { createMapTemplate, parseDitaMap } from '@dita/core';
import {
  buildCompositeMapTree,
  planMapNodeMove,
  resolveMapTargetStatus,
} from '../src/map-tree/map-tree-utils';

const ROOT_MAP = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="root_manual" xml:lang="zh-CN">
  <title>Root Manual</title>
  <topichead navtitle="Concepts">
    <topicref href="concepts/overview.dita" type="concept"/>
  </topichead>
  <mapref href="maps/tasks.ditamap" format="ditamap" navtitle="Tasks Submap"/>
  <topicref href="missing/broken.dita" navtitle="Missing Topic"/>
</map>
`;

const SUB_MAP = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="tasks_submap" xml:lang="zh-CN">
  <title>Tasks Submap</title>
  <topicref href="../tasks/install.dita" type="task"/>
  <topicref href="../tasks/verify.dita" type="task"/>
</map>
`;

describe('Phase 2 Composite Map Tree & Cross-Map Move Utilities', () => {
  const fileSet = new Set([
    'root.ditamap',
    'maps/tasks.ditamap',
    'concepts/overview.dita',
    'tasks/install.dita',
    'tasks/verify.dita',
  ]);
  const topicTitles = {
    'concepts/overview.dita': 'Architecture Overview',
    'tasks/install.dita': 'Install Server',
    'tasks/verify.dita': 'Verify Installation',
  };

  it('expands nested <mapref> trees and flags missing targets & cycles cleanly', () => {
    const mapBuffers = {
      'root.ditamap': { xml: ROOT_MAP },
      'maps/tasks.ditamap': { xml: SUB_MAP },
    };

    const res = buildCompositeMapTree('root.ditamap', mapBuffers, fileSet, topicTitles);
    expect(res.parseError).toBeNull();
    expect(res.nodes).toHaveLength(3);

    // Topic title resolved for concept node without explicit navtitle
    expect(res.nodes[0]!.children?.[0]?.label).toBe('Architecture Overview');
    expect(res.nodes[0]!.children?.[0]?.targetExists).toBe(true);

    // Nested <mapref> expanded transparently
    const maprefNode = res.nodes[1]!;
    expect(maprefNode.isSubmapRef).toBe(true);
    expect(maprefNode.children).toHaveLength(2);
    expect(maprefNode.children?.[0]?.ownerMapPath).toBe('maps/tasks.ditamap');
    expect(maprefNode.children?.[0]?.isSubmapChild).toBe(true);
    expect(maprefNode.children?.[0]?.label).toBe('Install Server');

    // Broken topicref flagged
    expect(res.nodes[2]!.targetExists).toBe(false);
    // A dangling href is a “not created yet” hint, never a hard error.
    expect(res.nodes[2]!.targetStatus).toBe('missing');
    expect(res.nodes[0]!.children?.[0]?.targetStatus).toBe('ok');

    // Circular mapref cycle detection
    const cyclicSub = SUB_MAP.replace(
      '</map>',
      '  <mapref href="../root.ditamap" format="ditamap"/>\n</map>',
    );
    const cyclicTree = buildCompositeMapTree(
      'root.ditamap',
      {
        'root.ditamap': { xml: ROOT_MAP },
        'maps/tasks.ditamap': { xml: cyclicSub },
      },
      fileSet,
      topicTitles,
    );
    const expandedSubChildren = cyclicTree.nodes[1]!.children!;
    expect(expandedSubChildren[2]!.isCyclicRef).toBe(true);
    expect(expandedSubChildren[2]!.targetStatus).toBe('cycle');
  });

  it('classifies every map target with one shared verdict (ok / missing / escaped / external)', () => {
    const files = new Set(['concepts/overview.dita']);

    expect(resolveMapTargetStatus('root.ditamap', 'concepts/overview.dita', files)).toEqual({
      status: 'ok',
      targetPath: 'concepts/overview.dita',
      exists: true,
    });

    // Valid path, file not authored yet: the Map Tree renders this as an actionable hint.
    expect(resolveMapTargetStatus('root.ditamap', 'concepts/not-yet.dita', files)).toEqual({
      status: 'missing',
      targetPath: 'concepts/not-yet.dita',
      exists: false,
    });

    // Escaping the workspace is a real authoring error, not a to-do.
    const escaped = resolveMapTargetStatus('root.ditamap', '../outside/secret.dita', files);
    expect(escaped.status).toBe('escaped');
    expect(escaped.exists).toBe(false);

    // External / peer scopes never become errors and never resolve to a local file.
    for (const scope of ['external', 'peer']) {
      expect(resolveMapTargetStatus('root.ditamap', 'https://example.com/a.dita', files, scope)).toEqual({
        status: 'external',
        exists: true,
      });
    }
    expect(resolveMapTargetStatus('root.ditamap', 'https://example.com/a.dita', files)).toEqual({
      status: 'external',
      exists: true,
    });

    // Sub-paths are resolved relative to the map that owns the topicref.
    expect(resolveMapTargetStatus('maps/tasks.ditamap', '../concepts/overview.dita', files)).toEqual({
      status: 'ok',
      targetPath: 'concepts/overview.dita',
      exists: true,
    });
  });

  it('prefers the scanned topic type of the referenced file when the topicref has no type attribute', () => {
    const untypedMap = ROOT_MAP.replace(' type="concept"', '');
    const mapBuffers = {
      'root.ditamap': { xml: untypedMap },
      'maps/tasks.ditamap': { xml: SUB_MAP },
    };

    const withoutTypes = buildCompositeMapTree('root.ditamap', mapBuffers, fileSet, topicTitles);
    expect(withoutTypes.nodes[0]!.children?.[0]?.topicType).toBeUndefined();

    const withTypes = buildCompositeMapTree('root.ditamap', mapBuffers, fileSet, topicTitles, {
      topicTypes: {
        'concepts/overview.dita': 'concept',
        'tasks/install.dita': 'task',
      },
    });
    expect(withTypes.nodes[0]!.children?.[0]?.topicType).toBe('concept');
    expect(withTypes.nodes[1]!.children?.[0]?.topicType).toBe('task');

    // An explicit topicref type attribute always wins over the scanned root element.
    const typed = buildCompositeMapTree(
      'root.ditamap',
      { ...mapBuffers, 'root.ditamap': { xml: ROOT_MAP } },
      fileSet,
      topicTitles,
      { topicTypes: { 'concepts/overview.dita': 'reference' } },
    );
    expect(typed.nodes[0]!.children?.[0]?.topicType).toBe('concept');
  });

  it('plans same-map moves and cross-map subtree moves with automatic POSIX href rewriting', () => {
    const mapBuffers = {
      'root.ditamap': { xml: ROOT_MAP },
      'maps/tasks.ditamap': { xml: SUB_MAP },
    };
    const tree = buildCompositeMapTree('root.ditamap', mapBuffers, fileSet, topicTitles);

    // 1. Same-map reorder: move Concepts topichead after Missing Topic
    const conceptsNode = tree.nodes[0]!;
    const sameMove = planMapNodeMove({
      rootMapPath: 'root.ditamap',
      dragNodes: [conceptsNode],
      targetParentNode: null,
      targetIndex: 3,
      mapBuffers,
    });
    expect(sameMove.ok).toBe(true);
    expect(sameMove.updates).toHaveLength(1);
    expect(parseDitaMap(sameMove.updates[0]!.xml).nodes.map((n) => n.tagName)).toEqual([
      'mapref',
      'topicref',
      'topichead',
    ]);

    // 2. Cross-map move: drag ../tasks/install.dita from maps/tasks.ditamap into Concepts in root.ditamap
    const installNode = tree.nodes[1]!.children![0]!;
    const crossMove = planMapNodeMove({
      rootMapPath: 'root.ditamap',
      dragNodes: [installNode],
      targetParentNode: conceptsNode,
      targetIndex: 1,
      mapBuffers,
    });
    expect(crossMove.ok).toBe(true);
    expect(crossMove.updates).toHaveLength(2);

    const updatedRoot = parseDitaMap(
      crossMove.updates.find((u) => u.mapPath === 'root.ditamap')!.xml,
    );
    const updatedSub = parseDitaMap(
      crossMove.updates.find((u) => u.mapPath === 'maps/tasks.ditamap')!.xml,
    );
    // Href rewritten from "../tasks/install.dita" -> "tasks/install.dita"
    expect(updatedRoot.nodes[0]!.children?.[1]?.href).toBe('tasks/install.dita');
    expect(updatedSub.nodes).toHaveLength(1);

    // 3. Reject dragging <mapref> into itself
    const selfMaprefDrop = planMapNodeMove({
      rootMapPath: 'root.ditamap',
      dragNodes: [tree.nodes[1]!],
      targetParentNode: tree.nodes[1]!,
      targetIndex: 0,
      mapBuffers,
    });
    expect(selfMaprefDrop.ok).toBe(false);
    void createMapTemplate;
  });
});
