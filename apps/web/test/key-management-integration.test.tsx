import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 `renderToStaticMarkup` reads Zustand's `getServerSnapshot` in a Node environment,
// which returns the store's initial state. Point `useStore` at `getState()` so components render
// against the state each test seeds. Same shim as `phase13-ui-components.test.tsx`.
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

import {
  buildKeydefPreviewXml,
  buildNewKeyOptions,
  NewKeyDialog,
  type NewKeyDraft,
} from '../src/components/NewKeyDialog';
import { t as tRaw, useLocaleStore } from '../src/i18n/index.js';
import type { CompositeMapTreeNode, MapBufferState } from '../src/map-tree/map-tree-utils';
import { AttributesPanel } from '../src/editor/visual/AttributesPanel';
import type { EditorSelectionSnapshot } from '../src/editor/visual/selection-info';
import { InsertKeyrefDialog } from '../src/components/InsertKeyrefDialog';
import { KeyspacePanel } from '../src/components/KeyspacePanel';
import { LeftSidebar } from '../src/components/LeftSidebar';
import { MapNodeInspector } from '../src/map-tree/MapNodeInspector';
import { MapTreePanel } from '../src/map-tree/MapTreePanel';
import { useEditorStore } from '../src/store/editor-store';
import { useGitStore } from '../src/store/git-store';
import type { FileLock } from '../src/services/git-api';
import { canManageMapKeys, resolveFileEditability } from '../src/services/lock-helpers';
import type { IdentityUser } from '../src/services/identity-api';
import {
  type DocumentSemanticOverlay,
  type KeyDefinition,
  type KeyspaceResult,
  type ResolvedKeyrefResult,
  getPmNodeTagName,
  resolveKeyrefInKeyspace,
  xmlToPmDoc,
} from '@dita/core';

// `apps/web/test/setup-locale.ts` pins the suite to zh-CN for the module-level `t`.
// React 19's `renderToStaticMarkup` reads zustand's `getServerSnapshot`, which is the locale the
// store was created with (Node reports `navigator.language === 'en-US'`). Pinning to `en` here
// lines both paths up so every assertion can compare against the same `t(key, params)` string.
beforeEach(() => {
  useLocaleStore.setState({ locale: 'en' });
});

/** React escapes `& < > " '` in text and attribute values; compare against the rendered form. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Asserts against markup, so every catalogue string is compared in its escaped rendering. */
const t = (key: Parameters<typeof tRaw>[0], params?: Parameters<typeof tRaw>[1]): string =>
  escapeHtml(tRaw(key, params));

const MAP_PATH = 'maps/product-manual.ditamap';
const TOPIC_PATH = 'topics/intro.dita';

const MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="manual">
  <title>Product Manual</title>
  <keydef keys="prod_name" processing-role="resource-only">
    <topicmeta>
      <keywords>
        <keyword>ACME Widget</keyword>
      </keywords>
    </topicmeta>
  </keydef>
  <topicref href="../topics/intro.dita" type="topic" id="intro"/>
</map>
`;

const WRITER: IdentityUser = {
  id: 'u-writer-lin',
  displayName: '林知远',
  initials: 'LZ',
  email: 'lin@example.com',
  color: '#2563eb',
  role: 'writer',
};

const OTHER_WRITER: IdentityUser = { ...WRITER, id: 'u-writer-chen', displayName: '陈曦' };

function makeLock(filePath: string, user: IdentityUser): FileLock {
  return {
    id: `lock-${user.id}`,
    projectId: 'p1',
    branch: 'main',
    filePath,
    userId: user.id,
    userName: user.displayName,
    userColor: user.color,
    userRole: user.role,
    lockedAt: '2026-11-25T00:00:00.000Z',
    updatedAt: '2026-11-25T00:00:00.000Z',
    expired: false,
  };
}

function makeKeyDef(overrides: Partial<KeyDefinition> = {}): KeyDefinition {
  return {
    key: 'prod_name',
    qualifiedKey: 'prod_name',
    sourceMapPath: MAP_PATH,
    elementPath: [1],
    tagName: 'keydef',
    line: 4,
    column: 3,
    isExternal: false,
    inlineText: 'ACME Widget',
    inlineTextSource: 'keyword',
    shadowedCount: 0,
    ...overrides,
  };
}

function makeKeyspace(defs: KeyDefinition[] = [makeKeyDef()]): KeyspaceResult {
  const keys: Record<string, KeyDefinition> = {};
  for (const def of defs) keys[def.qualifiedKey] = def;
  return {
    rootMapPath: MAP_PATH,
    keys,
    allDefinitions: defs,
    scopes: defs.map((def) => def.keyscope).filter((scope): scope is string => Boolean(scope)),
    referencedTopics: [TOPIC_PATH],
    mapCycles: [],
  };
}

function makeBuffer(xml = MAP_XML): MapBufferState {
  return { path: MAP_PATH, xml, baselineXml: xml, undoStack: [], redoStack: [], xmlError: null };
}

/** The subset of `MapTreePanelProps` a markup assertion needs; the rest are inert stubs. */
function mapTreeProps(overrides: Partial<React.ComponentProps<typeof MapTreePanel>> = {}) {
  return {
    rootMapPath: MAP_PATH,
    mapBuffers: { [MAP_PATH]: makeBuffer() },
    fileSet: new Set<string>([TOPIC_PATH]),
    topicTitles: { [TOPIC_PATH]: 'Introduction' },
    ditavals: [],
    activeDitavalPath: null,
    activeDitaval: null,
    onSelectDitaval: () => {},
    onChangeDitavalDisplayMode: () => {},
    selectedMapNode: null,
    onSelectMapNode: () => {},
    onMoveNodes: () => {},
    onOpenTopicOrMap: () => {},
    onJumpToSource: () => {},
    onOpenCreateAndMount: () => {},
    onOpenMountExisting: () => {},
    onInsertStructure: () => {},
    onDeleteNode: () => {},
    onCreateMissingTarget: (_node: CompositeMapTreeNode) => {},
    onUndoMap: () => {},
    onRedoMap: () => {},
    onOpenPublish: () => {},
    viewMode: 'tree' as const,
    onChangeViewMode: () => {},
    keyCount: 1,
    keyspaceSlot: <p id="keyspace-slot">keyspace slot</p>,
    ...overrides,
  };
}

/** A selection snapshot pointing at an inline `<keyword keyref="…"/>`. */
function makeKeywordSnapshot(keyref: string): EditorSelectionSnapshot {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="intro"><title>Intro</title><body><p>Run <keyword keyref="${keyref}"/> now.</p></body></topic>`;
  const { pmDoc } = xmlToPmDoc(xml, { position: false });
  let keywordNode: EditorSelectionSnapshot['activeItem'] = null;
  let keywordPos = 0;
  pmDoc.descendants((node, pos) => {
    if (node.isInline && getPmNodeTagName(node) === 'keyword') {
      keywordPos = pos;
      keywordNode = {
        depth: 3,
        pos,
        tagName: 'keyword',
        nodeTypeName: node.type.name,
        label: 'keyword',
        isUnknown: false,
        isAtom: true,
        node,
      };
      return false;
    }
    return true;
  });
  const snapshot: EditorSelectionSnapshot = {
    breadcrumbs: [
      {
        depth: 1,
        pos: 0,
        tagName: 'topic',
        nodeTypeName: pmDoc.type.name,
        label: 'Intro',
        isUnknown: false,
        isAtom: false,
        node: pmDoc,
      },
      {
        depth: 2,
        pos: 1,
        tagName: 'p',
        nodeTypeName: 'dita_p',
        label: 'p',
        isUnknown: false,
        isAtom: false,
        node: pmDoc,
      },
      keywordNode!,
    ],
    activeItem: keywordNode,
    activeInlineTags: new Set<string>(['keyword']),
    insertGroups: [],
    tableInfo: null,
    rootTagName: 'topic',
    from: keywordPos,
    to: keywordPos + 1,
    rawAttrs: [{ name: 'keyref', value: keyref, namespaceURI: null }],
  };
  return snapshot;
}

function makeOverlay(keyref: string, keyspace: KeyspaceResult): DocumentSemanticOverlay {
  const resolved: ResolvedKeyrefResult = resolveKeyrefInKeyspace(keyref, keyspace);
  return {
    filePath: TOPIC_PATH,
    rootMapPath: MAP_PATH,
    keyrefs: { [keyref]: resolved },
    conrefs: {},
    diagnostics: [],
  };
}

describe('left sidebar keeps four tabs', () => {
  const render = () =>
    renderToStaticMarkup(
      <LeftSidebar
        activeTab="map"
        onChangeTab={() => {}}
        onCollapse={() => {}}
        workspaceName="Demo manual"
        workspaceMode="memory"
        onOpenWorkspaceDialog={() => {}}
        mapTreeSlot={<p id="map-slot">map tree</p>}
        fileExplorerSlot={<p id="files-slot">files</p>}
        gitSlot={<p id="git-slot">git</p>}
        assignmentsSlot={<p id="assignments-slot">assignments</p>}
      />,
    );

  it('renders exactly four tabs and no standalone Keys tab', () => {
    const html = render();
    expect(html.match(/aria-selected="(true|false)"/g) ?? []).toHaveLength(4);
    expect(html).not.toContain('>Keys<');
    expect(html).not.toContain('keyspanel');
  });

  it('uses the rebalanced four-column tablist', () => {
    expect(render()).toContain('grid-cols-[0.9fr_1.2fr_0.75fr_1.15fr]');
  });

  it('renders one tabpanel per slot', () => {
    const html = render();
    expect(html).toContain('map-slot');
    expect(html).toContain('files-slot');
    expect(html).toContain('git-slot');
    expect(html).toContain('assignments-slot');
    expect(html.match(/role="tabpanel"/g) ?? []).toHaveLength(4);
  });
});

describe('map panel hosts the keyspace behind a two-segment toggle', () => {
  it('renders both segments and marks the tree segment active in tree mode', () => {
    const html = renderToStaticMarkup(<MapTreePanel {...mapTreeProps()} />);
    expect(html).toContain(t('mapPanel.tree'));
    expect(html).toContain(t('mapPanel.keys', { count: 1 }));
    expect(html).toContain(t('mapPanel.switchAria'));
    expect(html.match(/role="tab"/g) ?? []).toHaveLength(2);
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain('keyspace-slot');
    // Keys are created from the Keyspace tab only — the structure chrome has no key entry point.
    expect(html).not.toContain(t('keyspace.newKeyTooltip'));
  });

  it('renders the keyspace slot instead of the tree chrome in keys mode', () => {
    const html = renderToStaticMarkup(<MapTreePanel {...mapTreeProps({ viewMode: 'keys' })} />);
    expect(html).toContain('keyspace-slot');
    expect(html).not.toContain(t('mapTree.createMounted'));
    expect(html).toContain(t('mapPanel.keys', { count: 1 }));
  });
});

describe('keyspace panel inside the map panel', () => {
  const render = (overrides: Partial<React.ComponentProps<typeof KeyspacePanel>> = {}) =>
    renderToStaticMarkup(
      <KeyspacePanel
        embedded
        rootMapPath={MAP_PATH}
        keyspace={makeKeyspace()}
        canInsertInTopic={false}
        canEditKeys
        onInsertKeyref={() => {}}
        onJumpToKeyDef={() => {}}
        {...overrides}
      />,
    );

  it('offers the create / inspect / delete affordances', () => {
    const html = render({
      onOpenNewKey: () => {},
      onInspectKeyDef: () => {},
      onDeleteKey: async () => true,
    });
    expect(html).toContain(t('keyspace.newKey'));
    expect(html).toContain(t('keyspace.count', { count: 1 }));
    expect(html).toContain('prod_name');
    expect(html).toContain(t('keyspace.inspectTooltip'));
    expect(html).toContain(t('keyspace.deleteTooltip'));
    // The destructive path always asks once before deleting.
    expect(html).not.toContain(t('common.confirm'));
  });

  it('hides the create and delete affordances without edit rights', () => {
    const html = render({ canEditKeys: false, onDeleteKey: async () => true });
    expect(html).not.toContain(t('keyspace.newKey'));
    expect(html).not.toContain(t('keyspace.deleteTooltip'));
  });

  it('highlights the card of the selected `<keydef>`', () => {
    const selected = render({
      selectedMapNode: { mapPath: MAP_PATH, elementPath: [1] },
      onInspectKeyDef: () => {},
    });
    const idle = render({ selectedMapNode: null, onInspectKeyDef: () => {} });
    expect(selected).toContain('ring-1 ring-blue-200');
    expect(idle).not.toContain('ring-1 ring-blue-200');
  });

  it('turns the empty state into a call to action', () => {
    const html = render({ keyspace: makeKeyspace([]), onOpenNewKey: () => {} });
    expect(html).toContain(t('keyspace.emptyRoot'));
    expect(html).toContain(t('keyspace.emptyCta'));
  });
});

describe('new key dialog', () => {
  const render = (overrides: Partial<React.ComponentProps<typeof NewKeyDialog>> = {}) =>
    renderToStaticMarkup(
      <NewKeyDialog
        open
        context={{ mapPath: MAP_PATH, parentPath: null, parentLabel: 'Product Manual' }}
        availableMaps={[MAP_PATH]}
        availableFiles={[TOPIC_PATH, 'images/logo.png']}
        topicTitles={{ [TOPIC_PATH]: 'Introduction' }}
        keyspace={makeKeyspace()}
        onClose={() => {}}
        onCreate={async () => ({ ok: true })}
        {...overrides}
      />,
    );

  it('renders the three binding kinds and the text field by default', () => {
    const html = render();
    expect(html.match(/role="tab"/g) ?? []).toHaveLength(3);
    expect(html).toContain(t('newKey.kind.text'));
    expect(html).toContain(t('newKey.kind.file'));
    expect(html).toContain(t('newKey.kind.external'));
    expect(html).toContain('new-key-text');
    expect(html).not.toContain('new-key-url');
    expect(html).toContain(t('newKey.placementRoot'));
  });

  it('warns when the key name already exists in the keyspace', () => {
    const html = render({
      context: { mapPath: MAP_PATH, parentPath: null, initialKeyName: 'prod_name' },
    });
    expect(html).toContain(t('newKey.nameDuplicate', { key: 'prod_name' }));
  });

  it('rejects a key name outside the DITA key pattern', () => {
    const html = render({
      context: { mapPath: MAP_PATH, parentPath: null, initialKeyName: 'bad key!' },
    });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(t('newKey.nameInvalid'));
  });

  it('switches to file and external URL bindings from the context', () => {
    const fileHtml = render({
      context: {
        mapPath: MAP_PATH,
        parentPath: null,
        initialKeyName: 'intro_topic',
        initialKind: 'file',
      },
    });
    expect(fileHtml).toContain('new-key-file');
    expect(fileHtml).toContain('new-key-file-keyword');
    expect(fileHtml).not.toContain('new-key-url');

    const externalHtml = render({
      context: {
        mapPath: MAP_PATH,
        parentPath: null,
        initialKeyName: 'vendor_site',
        initialKind: 'external',
      },
    });
    expect(externalHtml).toContain('new-key-url');
    expect(externalHtml).toContain('new-key-linktext');
    expect(externalHtml).toContain(t('newKey.urlInvalid'));
  });

  it('shows a fixed placement badge for a nested parent and a map switch at the root', () => {
    const nested = render({
      context: { mapPath: MAP_PATH, parentPath: [2], parentLabel: 'Intro chapter' },
      availableMaps: [MAP_PATH, 'maps/other.ditamap'],
    });
    expect(nested).toContain(t('newKey.placementChild', { label: 'Intro chapter' }));
    expect(nested).not.toContain('<select');

    const root = render({ availableMaps: [MAP_PATH, 'maps/other.ditamap'] });
    expect(root).toContain('maps/other.ditamap');
  });
});

describe('new key payload builders', () => {
  const draft = (overrides: Partial<NewKeyDraft> = {}): NewKeyDraft => ({
    keyName: 'prod_name',
    kind: 'text',
    textValue: 'ACME Widget',
    targetFilePath: '',
    externalUrl: '',
    linkText: '',
    format: '',
    keyscope: '',
    ...overrides,
  });

  it('maps a text variable onto CreateMapKeyOptions', () => {
    expect(buildNewKeyOptions(draft(), { mapPath: MAP_PATH, parentPath: null })).toEqual({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'prod_name',
      bindingKind: 'text',
      textValue: 'ACME Widget',
      targetFilePath: undefined,
      externalUrl: undefined,
      linkText: undefined,
      format: undefined,
      keyscope: undefined,
    });
  });

  it('infers the @format for a file binding and keeps the link text', () => {
    const options = buildNewKeyOptions(
      draft({
        keyName: 'logo',
        kind: 'file',
        textValue: '',
        targetFilePath: 'images/logo.png',
        keyscope: 'brand',
      }),
      { mapPath: MAP_PATH, parentPath: [3] },
    );
    expect(options.bindingKind).toBe('file');
    expect(options.targetFilePath).toBe('images/logo.png');
    expect(options.format).toBe('png');
    expect(options.keyscope).toBe('brand');
    expect(options.parentPath).toEqual([3]);
    expect(options.externalUrl).toBeUndefined();
  });

  it('keeps the explicit format and external URL binding', () => {
    const options = buildNewKeyOptions(
      draft({
        keyName: 'vendor',
        kind: 'external',
        textValue: '',
        externalUrl: 'https://example.com/docs',
        linkText: 'Vendor docs',
        format: 'html',
      }),
      { mapPath: MAP_PATH, parentPath: null },
    );
    expect(options.externalUrl).toBe('https://example.com/docs');
    expect(options.linkText).toBe('Vendor docs');
    expect(options.format).toBe('html');
    expect(options.textValue).toBeUndefined();
  });

  it('previews the exact <keydef> markup for every binding kind', () => {
    expect(buildKeydefPreviewXml(draft())).toBe(
      [
        '<keydef keys="prod_name" processing-role="resource-only">',
        '  <topicmeta>',
        '    <keywords>',
        '      <keyword>ACME Widget</keyword>',
        '    </keywords>',
        '  </topicmeta>',
        '</keydef>',
      ].join('\n'),
    );
    expect(
      buildKeydefPreviewXml(
        draft({ keyName: 'logo', kind: 'file', textValue: '', targetFilePath: 'images/logo.png' }),
      ),
    ).toBe('<keydef keys="logo" href="images/logo.png" format="png" processing-role="resource-only"></keydef>');
    expect(
      buildKeydefPreviewXml(
        draft({
          keyName: 'vendor',
          kind: 'external',
          textValue: '',
          externalUrl: 'https://example.com',
          linkText: 'Vendor',
        }),
      ),
    ).toContain('scope="external"');
    expect(buildKeydefPreviewXml(draft({ keyName: '' }))).toBe('');
    expect(buildKeydefPreviewXml(draft({ textValue: '' }))).toBe('');
  });
});

describe('map node inspector edits a key definition', () => {
  const render = (overrides: Partial<React.ComponentProps<typeof MapNodeInspector>> = {}) =>
    renderToStaticMarkup(
      <MapNodeInspector
        selected={{ mapPath: MAP_PATH, elementPath: [1] }}
        mapBuffers={{ [MAP_PATH]: makeBuffer() }}
        availableFiles={[TOPIC_PATH]}
        onUpdateAttr={() => {}}
        onUpdateNavtitle={() => {}}
        onUpdateRootTitle={() => {}}
        onOpenTargetFile={() => {}}
        onJumpToSource={() => {}}
        onDeleteNode={() => {}}
        keyspace={makeKeyspace()}
        canEditKeys
        onUpsertKeyText={async () => true}
        onOpenNewKey={() => {}}
        onOpenKeysView={() => {}}
        {...overrides}
      />,
    );

  it('shows the Key Definition card instead of the generic navtitle block', () => {
    const html = render();
    expect(html).toContain(t('mapNodeInspector.keysTitle'));
    expect(html).toContain('map-key-keys-input');
    expect(html).toContain('value="prod_name"');
    expect(html).toContain('map-key-inline-text-input');
    expect(html).toContain('value="ACME Widget"');
    expect(html).toContain(t('mapNodeInspector.inlineTextSave'));
    expect(html).toContain(t('mapNodeInspector.inlineTextClear'));
    expect(html).toContain(t('mapNodeInspector.hrefHint'));
    expect(html).not.toContain('map-node-navtitle-input');
  });

  it('offers + 新建 Key for the root map and for container nodes', () => {
    const root = render({ selected: { mapPath: MAP_PATH, elementPath: null } });
    expect(root).toContain(t('mapNodeInspector.newKey'));
    expect(root).toContain(t('mapNodeInspector.keysCount', { count: 1 }));
    expect(root).toContain('map-root-title-input');
  });

  it('hides key editing affordances without edit rights', () => {
    const html = render({ canEditKeys: false, onUpsertKeyText: undefined });
    expect(html).toContain(t('mapNodeInspector.keysTitle'));
    expect(html).not.toContain(t('mapNodeInspector.inlineTextSave'));
  });
});

describe('attributes panel resolves and repairs keyref', () => {
  const render = (overrides: Partial<React.ComponentProps<typeof AttributesPanel>> = {}) =>
    renderToStaticMarkup(
      <AttributesPanel
        snapshot={makeKeywordSnapshot('prod_name')}
        docMetadata={null}
        onUpdateAttr={() => {}}
        onSelectBreadcrumb={() => {}}
        onMoveNode={() => {}}
        onDeleteNode={() => {}}
        keyspace={makeKeyspace()}
        canEditKeys
        {...overrides}
      />,
    );

  it('renders the keyspace picker for the keyref field', () => {
    const html = render({ onOpenNewKey: () => {} });
    expect(html).toContain(t('attributes.keyrefPickerAria'));
    expect(html).toContain(`value="prod_name"`);
  });

  it('offers one-click creation for an unresolved keyref', () => {
    const keyspace = makeKeyspace();
    const html = render({
      snapshot: makeKeywordSnapshot('missing_key'),
      semanticOverlay: makeOverlay('missing_key', keyspace),
      onOpenNewKey: () => {},
    });
    expect(html).toContain(t('attributes.keyrefCreateNamed', { key: 'missing_key' }));
  });

  it('shows quick value edit and inspect for a resolved keyref', () => {
    const keyspace = makeKeyspace();
    const html = render({
      semanticOverlay: makeOverlay('prod_name', keyspace),
      onUpdateKeyValue: async () => true,
      onInspectKeyDef: () => {},
      onJumpToSource: () => {},
    });
    expect(html).toContain(t('attributes.keyrefEditValue'));
    expect(html).toContain(t('attributes.keyrefInspect'));
    expect(html).toContain(t('attributes.define'));
    expect(html).not.toContain(t('attributes.keyrefCreateNamed', { key: 'prod_name' }));
  });
});

describe('insert keyref dialog', () => {
  const render = (overrides: Partial<React.ComponentProps<typeof InsertKeyrefDialog>> = {}) =>
    renderToStaticMarkup(
      <InsertKeyrefDialog
        open
        keyspace={makeKeyspace()}
        rootMapPath={MAP_PATH}
        onClose={() => {}}
        onConfirm={() => {}}
        {...overrides}
      />,
    );

  it('offers to create a key next to the filter row', () => {
    const html = render({ canEditKeys: true, onRequestCreateKey: () => {} });
    expect(html).toContain(t('keyref.newKey'));
  });

  it('offers the create action in the empty state and hides it without edit rights', () => {
    const empty = render({
      keyspace: makeKeyspace([]),
      canEditKeys: true,
      onRequestCreateKey: () => {},
    });
    expect(empty).toContain(t('keyref.empty'));
    expect(empty).toContain(t('keyref.newKeyEmpty'));

    const readOnly = render({ keyspace: makeKeyspace([]), canEditKeys: false });
    expect(readOnly).not.toContain(t('keyref.newKeyEmpty'));
  });
});

interface ServerOptions {
  locks?: FileLock[];
  save?: () => { ok: boolean; status: number; error?: string } | undefined;
}

/** Minimal HTTP stand-in for `apps/web/src/services/*-api.ts` that records each call. */
function installServer(options: ServerOptions = {}) {
  const calls: string[] = [];
  let locks = options.locks ?? [];

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(`${method} ${url}`);
    const reply = (body: unknown, ok = true, status = 200) =>
      ({ ok, status, text: async () => JSON.stringify(body) }) as unknown as Response;

    if (url.endsWith('/api/locks/checkout')) {
      const filePath = JSON.parse(String(init?.body ?? '{}')).filePath as string | undefined;
      const lock = makeLock(filePath ?? MAP_PATH, WRITER);
      locks = [...locks.filter((item) => item.filePath !== lock.filePath), lock];
      return reply({
        locks,
        lock,
        branch: 'main',
        projectId: 'p1',
        workDir: '/tmp/work',
        projectRootDir: '/tmp/root',
      });
    }
    if (url.includes('/api/files/content')) {
      const result = options.save?.() ?? { ok: true, status: 200 };
      return reply(
        result.ok ? { path: 'saved' } : { error: result.error ?? `HTTP ${result.status}` },
        result.ok,
        result.status,
      );
    }
    if (url.includes('/api/git/status')) {
      return reply({
        initialized: true,
        branch: 'main',
        dirtyFiles: [],
        untrackedFiles: [],
        ahead: 0,
        behind: 0,
        lastCommit: null,
        workDir: '/tmp/work',
        projectRootDir: '/tmp/root',
        projectId: 'p1',
        locks,
      });
    }
    if (url.includes('/api/git/branches')) {
      return reply({
        initialized: true,
        branch: 'main',
        primaryBranch: 'main',
        branches: [{ name: 'main', current: true }],
      });
    }
    return reply({});
  });

  return calls;
}

function seedWorkspace(input: { mode: 'memory' | 'api'; user?: IdentityUser; locks?: FileLock[] }) {
  useGitStore.setState({
    identity: null,
    currentUser: input.mode === 'api' ? (input.user ?? WRITER) : null,
    locks: input.locks ?? [],
    branch: 'main',
    projectId: input.mode === 'api' ? 'p1' : null,
    workDir: '/tmp/work',
    projectRootDir: '/tmp/root',
    status: null,
    busyPath: null,
    error: null,
    lastCommit: null,
  });
  useEditorStore.setState({
    workspaceMode: input.mode,
    mapBuffers: { [MAP_PATH]: makeBuffer() },
    activeRootMapPath: null,
    selectedMapNode: null,
    openTabs: [],
    activeTabPath: null,
    savingPaths: [],
    alert: null,
    lastSaveFailures: [],
    statusMessage: '',
  });
}

describe('key store actions', () => {
  beforeEach(() => {
    seedWorkspace({ mode: 'memory' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a text-bound <keydef> in memory mode and selects it', async () => {
    const result = await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'widget_name',
      bindingKind: 'text',
      textValue: 'ACME Widget',
    });

    expect(result.ok).toBe(true);
    expect(result.qualifiedKey).toBe('widget_name');
    const xml = useEditorStore.getState().mapBuffers[MAP_PATH]?.xml ?? '';
    expect(xml).toContain('<keydef keys="widget_name" processing-role="resource-only">');
    expect(xml).toContain('<keyword>ACME Widget</keyword>');
    expect(useEditorStore.getState().selectedMapNode).toEqual({
      mapPath: MAP_PATH,
      elementPath: result.elementPath,
    });
    expect(useEditorStore.getState().statusMessage).toBe(
      tRaw('status.keyCreated', { key: 'widget_name' }),
    );
  });

  it('rejects an invalid key name without touching the map', async () => {
    const result = await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'not a key',
      bindingKind: 'text',
      textValue: 'x',
    });
    expect(result).toEqual({ ok: false });
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(MAP_XML);
  });

  it('binds a workspace file with a relative href and an inferred format', async () => {
    const result = await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'brand_logo',
      bindingKind: 'file',
      targetFilePath: 'images/logo.png',
    });
    expect(result.ok).toBe(true);
    const xml = useEditorStore.getState().mapBuffers[MAP_PATH]?.xml ?? '';
    expect(xml).toContain('keys="brand_logo"');
    expect(xml).toContain('href="../images/logo.png"');
    expect(xml).toContain('format="png"');
  });

  it('binds an external URL with @scope and <linktext>', async () => {
    await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'vendor_site',
      bindingKind: 'external',
      externalUrl: 'https://example.com/docs',
      linkText: 'Vendor docs',
    });
    const xml = useEditorStore.getState().mapBuffers[MAP_PATH]?.xml ?? '';
    expect(xml).toContain('href="https://example.com/docs"');
    expect(xml).toContain('scope="external"');
    expect(xml).toContain('<linktext>Vendor docs</linktext>');
  });

  it('removes the whole <keydef> when it carries a single key', async () => {
    const result = await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'temp_key',
      bindingKind: 'text',
      textValue: 'temporary',
    });
    const removed = await useEditorStore.getState().deleteMapKey(
      makeKeyDef({
        key: 'temp_key',
        qualifiedKey: 'temp_key',
        elementPath: result.elementPath ?? [],
        inlineText: 'temporary',
      }),
    );
    expect(removed).toBe(true);
    const xml = useEditorStore.getState().mapBuffers[MAP_PATH]?.xml ?? '';
    expect(xml).not.toContain('temp_key');
    expect(useEditorStore.getState().statusMessage).toBe(
      tRaw('status.keyDeleted', { key: 'temp_key' }),
    );
  });

  it('rewrites the inline <keyword> value of a definition', async () => {
    const changed = await useEditorStore
      .getState()
      .upsertMapNodeKeyText(MAP_PATH, [1], 'keyword', 'ACME Widget Pro');
    expect(changed).toBe(true);
    const xml = useEditorStore.getState().mapBuffers[MAP_PATH]?.xml ?? '';
    expect(xml).toContain('<keyword>ACME Widget Pro</keyword>');
    expect(useEditorStore.getState().statusMessage).toBe(tRaw('status.keyTextUpdated'));

    await expect(
      useEditorStore.getState().upsertMapNodeKeyText(MAP_PATH, [1], 'keyword', 'ACME Widget Pro'),
    ).resolves.toBe(false);
  });

  it('takes the check-out lock before writing in API mode and persists the draft', async () => {
    seedWorkspace({ mode: 'api' });
    const calls = installServer();

    const result = await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'api_key',
      bindingKind: 'text',
      textValue: 'API value',
    });

    expect(result.ok).toBe(true);
    expect(calls).toContain('POST /api/locks/checkout');
    expect(calls.some((call) => call.startsWith('PUT ') && call.includes('/api/files/content'))).toBe(
      true,
    );
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toContain('api_key');
    expect(useGitStore.getState().locks.map((lock) => lock.filePath)).toContain(MAP_PATH);
  });

  it('refuses to create, delete or retype keys when another writer holds the map', async () => {
    seedWorkspace({ mode: 'api', locks: [makeLock(MAP_PATH, OTHER_WRITER)] });
    const calls = installServer({ locks: [makeLock(MAP_PATH, OTHER_WRITER)] });

    const created = await useEditorStore.getState().createMapKey({
      mapPath: MAP_PATH,
      parentPath: null,
      keyName: 'blocked_key',
      bindingKind: 'text',
      textValue: 'nope',
    });
    expect(created).toEqual({ ok: false });

    await expect(useEditorStore.getState().deleteMapKey(makeKeyDef())).resolves.toBe(false);
    await expect(
      useEditorStore.getState().upsertMapNodeKeyText(MAP_PATH, [1], 'keyword', 'nope'),
    ).resolves.toBe(false);

    expect(calls).toEqual([]);
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(MAP_XML);
    expect(useEditorStore.getState().alert?.message).toBe(
      tRaw('lock.mapBlocked', {
        path: MAP_PATH,
        message: tRaw('lock.checkedOutByOther', { user: OTHER_WRITER.displayName }),
      }),
    );
  });
});

describe('key management permission', () => {
  it('is granted to writers and admins even when the open topic is not checked out', () => {
    // The open topic tab is locked by someone else, so `canEdit` is false …
    const topicPath = '/project/topics/intro.dita';
    const topicEditability = resolveFileEditability({
      role: 'writer',
      userId: WRITER.id,
      filePath: topicPath,
      locks: [makeLock(topicPath, OTHER_WRITER)],
    }).editable;
    expect(topicEditability).toBe(false);

    // … yet key CRUD still needs to be available, because it writes the map, not that topic.
    const writerInput = { workspaceMode: 'api' as const, role: 'writer' as const, editable: topicEditability };
    const adminInput = { workspaceMode: 'api' as const, role: 'admin' as const, editable: topicEditability };
    expect(canManageMapKeys(writerInput)).toBe(true);
    expect(canManageMapKeys(adminInput)).toBe(true);
  });

  it('is denied to viewers outside memory mode and always allowed in memory mode', () => {
    expect(canManageMapKeys({ workspaceMode: 'api', role: 'viewer' })).toBe(false);
    expect(canManageMapKeys({ workspaceMode: 'api', role: null })).toBe(false);
    expect(canManageMapKeys({ workspaceMode: 'memory', role: 'viewer' })).toBe(true);
    expect(canManageMapKeys({ workspaceMode: 'memory', role: null })).toBe(true);
  });
});
