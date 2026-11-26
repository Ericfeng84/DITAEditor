import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NodeRendererProps } from 'react-arborist';
import { describe, expect, it } from 'vitest';
import { MapTargetFixPopover } from '../src/map-tree/MapTargetFixPopover';
import { createMapTreeNodeRenderer } from '../src/map-tree/MapTreeNodeRenderer';
import { buildCompositeMapTree, type CompositeMapTreeNode } from '../src/map-tree/map-tree-utils';
import { translate, type MessageKey } from '../src/i18n/index.js';

/**
 * Row/popover copy is locale-dependent (the i18n store resolves the Node `navigator` locale), so
 * assert that the message key was rendered in whichever locale is active.
 */
function expectCopy(html: string, key: MessageKey) {
  const zh = translate('zh-CN', key);
  const en = translate('en', key);
  expect(html.includes(zh) || html.includes(en), `${key} was not rendered`).toBe(true);
}

/**
 * The Map Tree must distinguish “not authored yet” from “genuinely broken”.
 *
 * A dangling `href` is normal mid-authoring (the map is written before the topic, or the topic
 * lives in someone's private draft). Rendering it in error red made a successful
 * edit-and-save look like a failure, so `missing` now renders as an amber, clickable hint while
 * only `escaped` / `cycle` stay red.
 */

const MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="root_manual" xml:lang="zh-CN">
  <title>Root Manual</title>
  <topicref href="concepts/overview.dita" type="concept"/>
  <topicref href="concepts/pending.dita" navtitle="Pending Topic"/>
  <topicref href="../outside/secret.dita" navtitle="Escaped Topic"/>
</map>
`;

const fileSet = new Set(['root.ditamap', 'concepts/overview.dita']);
const topicTitles = { 'concepts/overview.dita': 'Architecture Overview' };

function buildNodes() {
  const tree = buildCompositeMapTree(
    'root.ditamap',
    { 'root.ditamap': { xml: MAP_XML } },
    fileSet,
    topicTitles,
  );
  expect(tree.parseError).toBeNull();
  return tree.nodes;
}

/** Minimal `react-arborist` row props: the renderer only reads these fields. */
function rowProps(data: CompositeMapTreeNode): NodeRendererProps<CompositeMapTreeNode> {
  return {
    node: {
      data,
      isSelected: false,
      isOpen: true,
      isLeaf: !data.children?.length,
      willReceiveDrop: false,
      toggle: () => undefined,
      select: () => undefined,
      open: () => undefined,
      close: () => undefined,
      focus: () => undefined,
    },
    style: {},
    dragHandle: null,
    tree: {},
    index: 0,
    path: [0],
  } as unknown as NodeRendererProps<CompositeMapTreeNode>;
}

function renderRow(data: CompositeMapTreeNode, textMarkup = (html: string) => html) {
  const Renderer = createMapTreeNodeRenderer({
    onOpenTarget: () => undefined,
    onOpenContextMenu: () => undefined,
    onOpenTargetFix: () => undefined,
    onQuickAddChildTopic: () => undefined,
  });
  return textMarkup(renderToStaticMarkup(<Renderer {...rowProps(data)} />));
}

describe('Map Tree dangling-target presentation', () => {
  const nodes = buildNodes();
  const okNode = nodes[0]!;
  const pendingNode = nodes[1]!;
  const escapedNode = nodes[2]!;

  it('keeps a not-yet-created target out of error red and offers a quick fix instead', () => {
    expect(pendingNode.targetStatus).toBe('missing');
    expect(pendingNode.targetExists).toBe(false);

    const html = renderRow(pendingNode);
    // No red label: an unfinished target is a to-do, not a failure.
    expect(html).not.toContain('text-rose-700');
    // Amber, clickable badge wired to the quick-fix popover.
    expect(html).toContain('bg-amber-100');
    expectCopy(html, 'mapNode.targetPendingBadge');
    expect(html).toContain('h-2.5 w-2.5');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain(`href: ${pendingNode.href}`);
  });

  it('keeps genuinely broken references red', () => {
    expect(escapedNode.targetStatus).toBe('escaped');

    const html = renderRow(escapedNode);
    expect(html).toContain('text-rose-700');
    expect(html).toContain('text-rose-500');
    expect(html).not.toContain(translate('zh-CN', 'mapNode.targetPendingBadge'));
  });

  it('renders a healthy target without any warning affordance', () => {
    expect(okNode.targetStatus).toBe('ok');

    const html = renderRow(okNode);
    expect(html).not.toContain('text-rose-700');
    expect(html).not.toContain(translate('zh-CN', 'mapNode.targetPendingBadge'));
    expect(html).not.toContain(translate('en', 'mapNode.targetPendingBadge'));
    expect(html).not.toContain('aria-haspopup="menu"');
  });
});

describe('MapTargetFixPopover', () => {
  const nodes = buildNodes();
  const pendingNode = nodes[1]!;

  const render = (node: CompositeMapTreeNode, targetPathOverride?: string) =>
    renderToStaticMarkup(
      <MapTargetFixPopover
        target={{
          node: targetPathOverride
            ? { ...node, href: targetPathOverride, resolvedTargetPath: targetPathOverride }
            : node,
          x: 0,
          y: 0,
          openedByKeyboard: false,
          restoreEl: null,
        }}
        onClose={() => undefined}
        onCreateTarget={() => undefined}
        onEditHref={() => undefined}
        onRemoveNode={() => undefined}
      />,
    );

  it('offers create / repoint / copy / remove for a missing topic target', () => {
    const html = render(pendingNode);
    expectCopy(html, 'mapTargetFix.title');
    expect(html).toContain('concepts/pending.dita');
    expectCopy(html, 'mapTargetFix.create');
    expectCopy(html, 'mapTargetFix.createSub');
    expectCopy(html, 'mapTargetFix.editHref');
    expectCopy(html, 'mapTargetFix.copyHref');
    expectCopy(html, 'mapTargetFix.remove');
    // A plain topic can be generated, so the create action is enabled.
    expect(html).not.toContain('disabled');
  });

  it('disables one-click creation when the href points at another map', () => {
    expect(render(pendingNode, 'maps/sub.ditamap')).toContain('disabled');
  });
});
