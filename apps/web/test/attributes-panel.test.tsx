import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 `renderToStaticMarkup` reads Zustand's `getServerSnapshot`, which is pinned to the
// store's initial state instead of the state a test seeds. Point `useStore` at `getState()` so the
// panels render against the seeded locale. Same shim as `key-management-integration.test.tsx`.
vi.mock('zustand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zustand')>();
  return {
    ...actual,
    create: <T,>(initializer: Parameters<typeof actual.create<T>>[0]) => {
      const store = actual.create(initializer);
      const bound = ((selector?: (state: T) => unknown) => {
        const current = store.getState();
        return selector ? selector(current) : current;
      }) as typeof store;
      Object.assign(bound, store);
      return bound;
    },
  };
});

import type { Node as PMNode } from 'prosemirror-model';
import {
  formatAttributeOptionLabel,
  getAttributeLabel,
  getAttributesForElement,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  isUnknownPmNode,
  parseDitaMap,
  xmlToPmDoc,
  type DitaAttributeGroup,
  type DitaAttributeSpec,
  type XmlAttributeEntry,
} from '@dita/core';
import { useLocaleStore, t } from '../src/i18n/index.js';
import type { BreadcrumbItem, EditorSelectionSnapshot } from '../src/editor/visual/selection-info';
import { AttributesPanel } from '../src/editor/visual/AttributesPanel';
import { MapNodeInspector } from '../src/map-tree/MapNodeInspector';
import type { MapBufferState } from '../src/map-tree/map-tree-utils';
import {
  attributeMatchesQuery,
  filterGroupedAttributes,
} from '../src/components/attributes/filter-attrs';

beforeEach(() => {
  useLocaleStore.setState({ locale: 'en' });
});

// U+7FFB U+8BD1 — "translate" in zh-CN, kept as escapes so this file stays free of CJK literals.
const ZH_TRANSLATE = '\u7ffb\u8bd1';

function groupedFor(tagName: string): Map<DitaAttributeGroup, DitaAttributeSpec[]> {
  const grouped = new Map<DitaAttributeGroup, DitaAttributeSpec[]>();
  for (const spec of getAttributesForElement(tagName)) {
    const list = grouped.get(spec.group) ?? [];
    list.push(spec);
    grouped.set(spec.group, list);
  }
  return grouped;
}

function specOf(tagName: string, attrName: string): DitaAttributeSpec {
  const spec = getAttributesForElement(tagName).find((item) => item.name === attrName);
  if (!spec) throw new Error(`no ${attrName} attribute modeled on <${tagName}>`);
  return spec;
}

function attr(name: string, value: string): XmlAttributeEntry {
  return { name, value, namespaceURI: name.startsWith('xml:') ? 'http://www.w3.org/XML/1998/namespace' : null };
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** SSR escapes `&`, `<`, `>` in text and attribute values; assert on the escaped form. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface SnapshotHit {
  active: BreadcrumbItem;
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Builds a real ProseMirror selection snapshot (no mocks) for the first element with `tagName`,
 * so `AttributesPanel` sees exactly the `rawAttrs` the XML round-trip produced.
 */
function makeSnapshot(xml: string, tagName: string): EditorSelectionSnapshot {
  const { pmDoc } = xmlToPmDoc(xml, { position: false });
  const found: { hit: SnapshotHit | null } = { hit: null };

  const makeItem = (node: PMNode, pos: number, depth: number): BreadcrumbItem => {
    const tag = getPmNodeTagName(node) ?? '';
    return {
      depth,
      pos,
      tagName: tag,
      nodeTypeName: node.type.name,
      label: tag,
      isUnknown: isUnknownPmNode(node),
      isAtom: node.isAtom,
      node,
    };
  };

  const root: PMNode | null = pmDoc.firstChild;
  const rootItem: BreadcrumbItem = root
    ? makeItem(root, 0, 1)
    : makeItem(pmDoc, 0, 1);
  if (rootItem.tagName === tagName) found.hit = { active: rootItem, breadcrumbs: [rootItem] };

  const visit = (node: PMNode, pos: number, depth: number, chain: BreadcrumbItem[]) => {
    node.forEach((child, offset) => {
      const tag = getPmNodeTagName(child);
      if (!tag) return;
      const childPos = pos + 1 + offset;
      const item = makeItem(child, childPos, depth + 1);
      const nextChain = [...chain, item];
      if (!found.hit && tag === tagName) {
        found.hit = { active: item, breadcrumbs: nextChain };
      }
      visit(child, childPos, depth + 1, nextChain);
    });
  };
  if (root) visit(root, 0, 1, [rootItem]);

  if (!found.hit) throw new Error(`<${tagName}> not found in snapshot fixture`);
  const { active, breadcrumbs } = found.hit;
  const rawAttrs = getPmNodeRawAttrs(active.node);

  return {
    breadcrumbs,
    activeItem: active,
    activeInlineTags: active.node.isInline ? new Set<string>([active.tagName]) : new Set<string>(),
    insertGroups: [],
    tableInfo: null,
    rootTagName: rootItem.tagName,
    from: active.pos,
    to: active.pos + 1,
    rawAttrs,
  };
}

const TOPIC_P = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="t_intro"><title>Intro</title><body><p id="p_lead" outputclass="lead">Hello</p></body></topic>`;

const CONCEPT_ROOT = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="c_root" xml:lang="zh-CN"><title>Root</title><conbody><p>Body</p></conbody></concept>`;

const TOPIC_NOTE = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="t_note"><title>Note</title><body><note id="n1" type="tip">Careful</note></body></topic>`;

const TOPIC_CODEBLOCK = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="t_code"><title>Code</title><body><codeblock id="c1" xml:space="preserve" scale="80">ls</codeblock></body></topic>`;

const TOPIC_CUSTOM_ATTR = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="t_custom"><title>Custom</title><body><p data-custom="keep-me">Hello</p></body></topic>`;

function renderPanel(
  snapshot: EditorSelectionSnapshot,
  overrides: Partial<React.ComponentProps<typeof AttributesPanel>> = {},
): string {
  return renderToStaticMarkup(
    <AttributesPanel
      snapshot={snapshot}
      docMetadata={null}
      onUpdateAttr={() => {}}
      onSelectBreadcrumb={() => {}}
      onMoveNode={() => {}}
      onDeleteNode={() => {}}
      {...overrides}
    />,
  );
}

describe('filterGroupedAttributes', () => {
  const pGrouped = groupedFor('p');

  it('matches by XML attribute name, case-insensitively and trimmed', () => {
    const byName = filterGroupedAttributes(pGrouped, [], { query: 'outputclass', locale: 'en' });
    // `status` also matches because its example snippet mentions outputclass.
    expect(byName.groups.get('core')?.map((s) => s.name)).toEqual(['outputclass']);
    expect(byName.total).toBeGreaterThanOrEqual(1);

    const padded = filterGroupedAttributes(pGrouped, [], { query: '  OutputClass  ', locale: 'en' });
    expect(padded.groups.get('core')?.map((s) => s.name)).toEqual(['outputclass']);
    expect(padded.total).toBe(byName.total);
  });

  it('matches by localized label', () => {
    const spec = specOf('p', 'xml:lang');
    const label = getAttributeLabel(spec, 'en');
    const result = filterGroupedAttributes(pGrouped, [], { query: label, locale: 'en' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.groups.get('localization')?.some((s) => s.name === 'xml:lang')).toBe(true);
  });

  it('matches English usage keywords in the description text', () => {
    const result = filterGroupedAttributes(pGrouped, [], { query: 'css', locale: 'en' });
    expect(result.groups.get('core')?.map((s) => s.name)).toContain('outputclass');
  });

  it('matches Chinese usage keywords through the localized docs', () => {
    const translate = specOf('p', 'translate');
    expect(attributeMatchesQuery(translate, ZH_TRANSLATE, 'zh-CN')).toBe(true);
    const result = filterGroupedAttributes(pGrouped, [], { query: ZH_TRANSLATE, locale: 'zh-CN' });
    const names = [...result.groups.values()].flat().map((s) => s.name);
    expect(names).toContain('translate');
  });

  it('keeps only set attributes in onlySet mode', () => {
    const result = filterGroupedAttributes(pGrouped, [attr('id', 'p_lead')], {
      onlySet: true,
      locale: 'en',
    });
    expect(result.total).toBe(1);
    expect([...result.groups.keys()]).toEqual(['core']);
    expect(result.groups.get('core')?.[0]?.name).toBe('id');

    const combined = filterGroupedAttributes(pGrouped, [attr('id', 'p_lead')], {
      onlySet: true,
      query: 'outputclass',
      locale: 'en',
    });
    expect(combined.total).toBe(0);
  });

  it('never mutates the input map and drops empty groups', () => {
    const before = [...pGrouped.keys()];
    const result = filterGroupedAttributes(pGrouped, [], { query: 'translate', locale: 'en' });
    expect([...pGrouped.keys()]).toEqual(before);
    for (const attrs of result.groups.values()) expect(attrs.length).toBeGreaterThan(0);
  });
});

describe('AttributesPanel shared primitives', () => {
  it('renders a compact core row: localized label, XML badge and help toggle', () => {
    const snapshot = makeSnapshot(TOPIC_P, 'p');
    const html = renderPanel(snapshot);

    // Filter bar is always present under the element header.
    expect(html).toContain(t('attributes.searchAria'));
    expect(html).toContain(t('attributes.onlySetAria'));

    const idSpec = specOf('p', 'id');
    const outputclassSpec = specOf('p', 'outputclass');
    expect(html).toContain(escapeHtml(getAttributeLabel(idSpec, 'en')));
    expect(html).toContain(escapeHtml(getAttributeLabel(outputclassSpec, 'en')));
    // Subtle monospace XML attribute name badges.
    expect(html).toContain('>id</code>');
    expect(html).toContain('>outputclass</code>');
    // `?` disclosure button per attribute.
    expect(html).toContain(t('attributes.helpToggleAria', { name: 'id' }));
    expect(html).toContain(t('attributes.helpToggleAria', { name: 'outputclass' }));
    expect(html).toContain('aria-expanded="false"');
    // Compact by default: no purpose/usage/example text inline.
    expect(html).not.toContain(t('attributes.helpPurpose'));
    expect(html).not.toContain(t('attributes.helpUsage'));
    expect(html).not.toContain(t('attributes.helpExample'));
    // The XML value is still the source of truth.
    expect(html).toContain('value="p_lead"');
    expect(html).toContain('value="lead"');
  });

  it('keeps localization and raw collapsed by default', () => {
    const html = renderPanel(makeSnapshot(TOPIC_P, 'p'));
    expect(html).toContain(`data-attribute-group="localization"`);
    expect(html).toContain(escapeHtml(t('attributes.group.localization')));
    // Collapsed groups render neither their purpose line nor their fields.
    expect(html).not.toContain('>xml:lang</code>');
    expect(html).not.toContain('>translate</code>');
    expect(html).not.toContain(t('attributes.rawDesc'));
    expect(html).toContain(escapeHtml(t('attributes.rawTitle')));
  });

  it('promotes xml:lang into the expanded element group on a root element without duplication', () => {
    const html = renderPanel(makeSnapshot(CONCEPT_ROOT, 'concept'));
    expect(count(html, '>xml:lang</code>')).toBe(1);
    expect(html).toContain(t('attributes.helpToggleAria', { name: 'xml:lang' }));
    // Still shown in the (collapsed) localization group header only.
    expect(html).toContain(escapeHtml(t('attributes.group.localization')));
    expect(html).not.toContain(t('attributes.rawDesc'));
  });

  it('renders readable dropdown option labels while keeping exact XML values', () => {
    const html = renderPanel(makeSnapshot(TOPIC_NOTE, 'note'));
    const typeSpec = specOf('note', 'type');
    const tipLabel = formatAttributeOptionLabel(typeSpec, 'tip', 'en');
    expect(html).toContain(`value="tip"`);
    expect(html).toContain(`>${escapeHtml(tipLabel)}</option>`);
    // The raw token alone must not be the only label any more.
    expect(tipLabel).not.toBe('tip');
  });

  it('renders readable labels for codeblock element dropdown values', () => {
    const html = renderPanel(makeSnapshot(TOPIC_CODEBLOCK, 'codeblock'));
    const spaceSpec = specOf('codeblock', 'xml:space');
    expect(html).toContain(`value="preserve"`);
    expect(html).toContain(
      `>${escapeHtml(formatAttributeOptionLabel(spaceSpec, 'preserve', 'en'))}</option>`,
    );
    // Presentation stays collapsed by default but is still listed.
    expect(html).toContain('data-attribute-group="presentation"');
    const scaleLabel = formatAttributeOptionLabel(specOf('codeblock', 'scale'), '80', 'en');
    expect(scaleLabel).not.toBe('80');
  });

  it('surfaces schema-unknown attributes through the amber raw badge while collapsed', () => {
    const html = renderPanel(makeSnapshot(TOPIC_CUSTOM_ATTR, 'p'));
    expect(html).toContain(t('attributes.rawCustomCount', { count: 1 }));
    expect(html).not.toContain(t('attributes.rawDesc'));
    // The raw section stays collapsed, yet the amber badge already flags the custom attribute.
    expect(html).toContain('bg-amber-100');
  });

  it('yields no attributes for a query that matches nothing (empty-state branch)', () => {
    const grouped = groupedFor('p');
    const result = filterGroupedAttributes(grouped, [], {
      query: 'zzz-not-an-attribute',
      locale: 'en',
    });
    expect(result.total).toBe(0);
    expect(result.groups.size).toBe(0);
  });

  it('ships non-empty filter copy in both locales', () => {
    expect(t('attributes.noMatches')).toBeTruthy();
    expect(t('attributes.resetFilter')).toBeTruthy();
    useLocaleStore.setState({ locale: 'zh-CN' });
    expect(t('attributes.noMatches')).not.toBe('attributes.noMatches');
    expect(t('attributes.resetFilter')).not.toBe('attributes.resetFilter');
    useLocaleStore.setState({ locale: 'en' });
  });
});

const MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<map title="Product map" xml:lang="zh-CN">
  <topicref href="topics/intro.dita" keys="intro" scope="local" processing-role="resource-only"/>
</map>`;

const MAP_PATH = 'maps/product.ditamap';

function makeMapBuffer(xml = MAP_XML): MapBufferState {
  return { path: MAP_PATH, xml, baselineXml: xml, undoStack: [], redoStack: [], xmlError: null };
}

function topicrefPath(): number[] {
  const parsed = parseDitaMap(MAP_XML);
  const stack = [...parsed.nodes];
  while (stack.length > 0) {
    const node = stack.shift()!;
    if (node.tagName === 'topicref') return node.elementPath;
    if (node.children) stack.push(...node.children);
  }
  throw new Error('topicref not found in map fixture');
}

function renderInspector(
  elementPath: number[] | null,
  overrides: Partial<React.ComponentProps<typeof MapNodeInspector>> = {},
): string {
  return renderToStaticMarkup(
    <MapNodeInspector
      selected={{ mapPath: MAP_PATH, elementPath }}
      mapBuffers={{ [MAP_PATH]: makeMapBuffer() }}
      availableFiles={['topics/intro.dita']}
      onUpdateAttr={() => {}}
      onUpdateNavtitle={() => {}}
      onUpdateRootTitle={() => {}}
      onOpenTargetFile={() => {}}
      onJumpToSource={() => {}}
      onDeleteNode={() => {}}
      {...overrides}
    />,
  );
}

describe('MapNodeInspector shared primitives', () => {
  it('renders the shared filter bar below the node header', () => {
    const html = renderInspector(null);
    expect(html).toContain(t('attributes.searchAria'));
    expect(html).toContain(t('attributes.onlySetAria'));
    expect(html).toContain(t('attributes.onlySet', { count: 2 }));
  });

  it('promotes xml:lang on the root <map> and keeps localization/raw collapsed', () => {
    const html = renderInspector(null);
    expect(count(html, '>xml:lang</code>')).toBe(1);
    expect(html).toContain(`data-attribute-group="localization"`);
    expect(html).not.toContain('>translate</code>');
    expect(html).not.toContain(t('attributes.rawDesc'));
    expect(html).toContain(escapeHtml(t('attributes.rawTitle')));
    // The map-specific title editor still owns the top slot.
    expect(html).toContain('map-root-title-input');
  });

  it('renders readable dropdown labels for <topicref>', () => {
    const html = renderInspector(topicrefPath());
    const scopeSpec = specOf('topicref', 'scope');
    const roleSpec = specOf('topicref', 'processing-role');
    expect(html).toContain(`>${escapeHtml(formatAttributeOptionLabel(scopeSpec, 'local', 'en'))}</option>`);
    expect(html).toContain(
      `>${escapeHtml(formatAttributeOptionLabel(roleSpec, 'resource-only', 'en'))}</option>`,
    );
    expect(html).toContain('value="local"');
    expect(html).toContain('value="resource-only"');
    // The Map `href` quick picker lives inside the shared field control.
    expect(html).toContain(t('mapNodeInspector.quickPick'));
  });
});
