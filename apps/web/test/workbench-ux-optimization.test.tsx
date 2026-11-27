import React from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// React 19 `renderToStaticMarkup` reads Zustand's `getServerSnapshot` in a Node environment,
// which returns the store's initial state. Point `useStore` at `getState()` so components render
// against the state each test seeds. Same shim as `key-management-integration.test.tsx`.
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

import type { CompositeMapTreeNode, MapBufferState } from '../src/map-tree/map-tree-utils';
import { BreadcrumbBar } from '../src/editor/visual/BreadcrumbBar';
import { IdentitySwitcher } from '../src/components/IdentitySwitcher';
import { MapTreePanel } from '../src/map-tree/MapTreePanel';
import { SaveControls } from '../src/components/SaveControls';
import { TopicGuideChip } from '../src/components/TopicAuthoringGuide';
import { LeftSidebar } from '../src/components/LeftSidebar';
import { WorkbenchHeader } from '../src/components/WorkbenchHeader';
import { isReadOnlyEditKeystroke } from '../src/editor/visual/readonly-nudge';
import { t as tRaw, useLocaleStore } from '../src/i18n/index.js';
import type { IdentityResponse, IdentityUser } from '../src/services/identity-api';
import type { BreadcrumbItem } from '../src/editor/visual/selection-info';

// `apps/web/test/setup-locale.ts` pins the module-level `t` to zh-CN. React 19's
// `renderToStaticMarkup` reads zustand's `getServerSnapshot` (created with Node's `en-US`), so pin
// the store to `en` and compare every assertion against the same catalogue.
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

const t = (key: Parameters<typeof tRaw>[0], params?: Parameters<typeof tRaw>[1]): string =>
  escapeHtml(tRaw(key, params));

const MAP_PATH = 'maps/product-manual.ditamap';
const TOPIC_PATH = 'topics/intro.dita';

const MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map title="Product Manual">
  <topicref href="${TOPIC_PATH}" type="topic" />
</map>`;

function makeBuffer(xml = MAP_XML): MapBufferState {
  return { path: MAP_PATH, xml, baselineXml: xml, undoStack: [], redoStack: [], xmlError: null };
}

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
    viewMode: 'tree' as const,
    onChangeViewMode: () => {},
    keyCount: 1,
    keyspaceSlot: <p id="keyspace-slot">keyspace slot</p>,
    ...overrides,
  };
}

const WRITER: IdentityUser = {
  id: 'user-1',
  displayName: 'Ada Writer',
  initials: 'AW',
  color: '#2563eb',
  role: 'writer',
};

const IDENTITY: IdentityResponse = {
  users: [WRITER],
  currentUser: WRITER,
};

function headerProps(overrides: Partial<React.ComponentProps<typeof WorkbenchHeader>> = {}) {
  return {
    showBrand: false,
    activeTab: null,
    mode: 'visual' as const,
    xmlError: null,
    leftSidebarOpen: true,
    problemsOpen: false,
    errorCount: 0,
    warningCount: 0,
    dirtyCount: 0,
    identity: IDENTITY,
    currentUser: WRITER,
    onSwitchIdentity: () => {},
    onToggleLeftSidebar: () => {},
    onChangeMode: () => {},
    onToggleProblems: () => {},
    showInspectorExpand: false,
    onExpandInspector: () => {},
    ...overrides,
  };
}

describe('WorkbenchHeader: shell containment', () => {
  it('hides the sidebar toggle while the sidebar is open (symmetric with the inspector)', () => {
    const open = renderToStaticMarkup(<WorkbenchHeader {...headerProps()} />);
    expect(open).not.toContain(t('header.toggleExpandAria'));
    expect(open).not.toContain(t('header.toggleCollapseAria'));
  });

  it('offers an expand toggle once the sidebar is collapsed', () => {
    const collapsed = renderToStaticMarkup(
      <WorkbenchHeader {...headerProps({ leftSidebarOpen: false, showBrand: true })} />,
    );
    expect(collapsed).toContain(t('header.toggleExpandAria'));
    // Expanding (never collapsing) from the header: the sidebar strip owns its own collapse.
    expect(collapsed).not.toContain(t('header.toggleCollapseAria'));
    expect(collapsed).toContain('aria-pressed="false"');
  });

  it('orders the right cluster publish → diagnostics → settings and closes the bar with the gear', () => {
    const html = renderToStaticMarkup(
      <WorkbenchHeader {...headerProps({ onOpenPublish: () => {} })} />,
    );
    const publish = html.indexOf(t('mapTree.publish'));
    const diagnostics = html.indexOf(t('header.problems.toggleTitle'));
    const settings = html.indexOf('data-testid="header-settings-button"');
    for (const index of [publish, diagnostics, settings]) expect(index).toBeGreaterThan(-1);
    // Publish leads (primary action); document state follows; session chrome closes the bar.
    expect(publish).toBeLessThan(diagnostics);
    expect(diagnostics).toBeLessThan(settings);
    // Last control on the bar: no button may open after the settings gear.
    expect(html.indexOf('<button', settings)).toBe(-1);
  });

  it('keeps identity and help out of the bar — they live in the settings menu', () => {
    const html = renderToStaticMarkup(
      <WorkbenchHeader {...headerProps({ showInspectorExpand: true, dirtyCount: 3, errorCount: 1 })} />,
    );
    // The inspector expander is the only chrome control left after the gear.
    expect(html.indexOf(t('header.inspector.expandAria'))).toBeGreaterThan(
      html.indexOf('data-testid="header-settings-button"'),
    );
    // Closed menu: neither the identity select nor a help button renders in the bar.
    expect(html).not.toContain(`aria-label="${t('identity.switchAria')}"`);
    expect(html).not.toContain(`aria-label="${t('help.openAria')}"`);
    expect(html).not.toContain(`title="${t('help.openTitle')}"`);
  });

  it('hides identity, language and help behind the settings menu instead of inlining them', () => {
    const html = renderToStaticMarkup(<WorkbenchHeader {...headerProps()} />);
    const settingsButton = html.indexOf('data-testid="header-settings-button"');
    expect(settingsButton).toBeGreaterThan(-1);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`aria-label="${t('header.settings.aria')}"`);
    expect(html).toContain(`title="${t('header.settings.title')}"`);
    // Closed by default: neither the menu nor any of its session controls may render.
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain(`aria-label="${t('locale.group')}"`);
    expect(html).not.toContain(`aria-label="${t('identity.switchAria')}"`);
    expect(html).not.toContain(`aria-label="${t('help.openAria')}"`);
  });

  it('omits the publish CTA when no publish handler is wired', () => {
    const html = renderToStaticMarkup(<WorkbenchHeader {...headerProps()} />);
    expect(html).not.toContain(t('mapTree.publish'));
  });

  it('keeps the diagnostics pill as the single problems entry point', () => {
    const html = renderToStaticMarkup(
      <WorkbenchHeader {...headerProps({ errorCount: 2, warningCount: 1 })} />,
    );
    expect(html).toContain(t('header.problems.summary', { errors: 2, warnings: 1 }));
    expect(html).toContain(`title="${t('header.problems.toggleTitle')}"`);
    // Exactly one problems toggle lives in the header (the footer duplicate is gone).
    expect(html.split(t('header.problems.toggleTitle')).length - 1).toBe(1);
  });
});

describe('IdentitySwitcher: no duplicated role', () => {
  it('shows the role only inside the select options', () => {
    const html = renderToStaticMarkup(
      <IdentitySwitcher identity={IDENTITY} currentUser={WRITER} onChange={() => {}} />,
    );
    // `Ada Writer · Writer` was the bug: the select already renders `displayName · role`, so a
    // standalone trailing pill must not repeat the role.
    expect(html).not.toContain('>Writer<');
    expect(html).toContain('Ada Writer · Writer');
    expect(html).not.toContain('uppercase tracking-wide');
  });
});

describe('TopicGuideChip: one merged pill', () => {
  const chipProps = {
    docType: 'concept' as const,
    expanded: false,
    onToggle: () => {},
  };

  it('merges the type badge and the expand affordance into a single aria-expanded button', () => {
    const html = renderToStaticMarkup(<TopicGuideChip {...chipProps} />);
    expect(html).toContain('aria-expanded="false"');
    const buttons = html.split('<button').length - 1;
    expect(buttons).toBe(1);
  });

  it('keeps the structure-issue alert as a separate button', () => {
    const html = renderToStaticMarkup(
      <TopicGuideChip {...chipProps} structureIssueCount={3} onOpenProblems={() => {}} />,
    );
    const buttons = html.split('<button').length - 1;
    expect(buttons).toBe(2);
    expect(html).toContain(t('guide.issuesBadge', { count: 3 }));
  });

  it('flips the chevron and the expanded state together', () => {
    const html = renderToStaticMarkup(<TopicGuideChip {...chipProps} expanded />);
    expect(html).toContain('aria-expanded="true"');
  });
});

describe('SaveControls: read-only views have no save affordance', () => {
  const base = {
    dirtyCount: 0,
    isCurrentDirty: false,
    saving: false,
    onSave: () => {},
    onResetBaseline: () => {},
  };

  it('renders nothing when read-only and nothing is pending', () => {
    expect(renderToStaticMarkup(<SaveControls {...base} readOnly />)).toBe('');
  });

  it('still renders for editable documents with nothing pending', () => {
    const html = renderToStaticMarkup(<SaveControls {...base} />);
    expect(html).toContain(t('common.save'));
    expect(html).toContain('disabled');
  });

  it('renders a pending draft even in a read-only shell', () => {
    const html = renderToStaticMarkup(<SaveControls {...base} dirtyCount={2} readOnly />);
    expect(html).toContain(t('header.save.saveAll', { count: 2 }));
  });
});

describe('BreadcrumbBar: decluttering', () => {
  const crumbs: BreadcrumbItem[] = [
    { depth: 1, pos: 0, tagName: 'topic', label: 'topic' },
    { depth: 2, pos: 5, tagName: 'p', label: 'p' },
  ];
  const diffStats = { changedLines: 0, addedLines: 0, removedLines: 0, isIdentical: true };

  function render(props: Partial<React.ComponentProps<typeof BreadcrumbBar>> = {}) {
    return renderToStaticMarkup(
      <BreadcrumbBar
        breadcrumbs={crumbs}
        activePos={5}
        onSelectCrumb={() => {}}
        diffStats={diffStats}
        mode="visual"
        {...props}
      />,
    );
  }

  it('drops the duplicated diagnostics button even when a handler is still passed', () => {
    const html = render({ diagnosticsCount: 4, onToggleProblems: () => {} });
    expect(html).not.toContain(t('breadcrumb.diagnostics', { count: 4 }));
    expect(html).not.toContain(t('breadcrumb.diagnostics', { count: 0 }));
  });

  it('keeps the kernel marker as an icon-only badge with an accessible name', () => {
    const html = render();
    expect(html).toContain(`title="${t('breadcrumb.kernel')}"`);
    expect(html).toContain(`aria-label="${t('breadcrumb.kernel')}"`);
    // The permanent text label would compete with the breadcrumb trail.
    expect(html).not.toContain(`>${t('breadcrumb.kernel')}<`);
  });
});

describe('MapTreePanel: left sidebar chrome', () => {
  const DITAVALS = [
    { path: 'ditavals/print.ditaval', name: 'print', ruleCount: 3 },
  ];

  it('orders root header → tree/keys tabs → tree actions', () => {
    const html = renderToStaticMarkup(<MapTreePanel {...mapTreeProps()} />);
    const root = html.indexOf(t('mapTree.sourceTooltip'));
    const tabs = html.indexOf('role="tablist"');
    const actions = html.indexOf(t('mapTree.mountMenuTooltip'));
    expect(root).toBeGreaterThan(-1);
    expect(tabs).toBeGreaterThan(root);
    expect(actions).toBeGreaterThan(tabs);
  });

  it('keeps publishing out of the tree action row', () => {
    const html = renderToStaticMarkup(<MapTreePanel {...mapTreeProps()} />);
    expect(html).not.toContain(t('mapTree.publish'));
  });

  it('hides the DITAVAL projection controls while no profile is active', () => {
    const html = renderToStaticMarkup(<MapTreePanel {...mapTreeProps({ ditavals: DITAVALS })} />);
    // The compact toggle is there, the strip (select + 3 modes + stats) is not.
    expect(html).toContain(t('mapTree.ditavalToggleAria'));
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="map-ditaval-select"');
    expect(html).not.toContain(t('mapTree.view.showAll'));
    expect(html).not.toContain(t('mapTree.view.dim'));
    expect(html).not.toContain(t('mapTree.view.hide'));
  });

  it('reveals the teal DITAVAL strip when a profile becomes active', () => {
    const html = renderToStaticMarkup(
      <MapTreePanel
        {...mapTreeProps({
          ditavals: DITAVALS,
          activeDitavalPath: 'ditavals/print.ditaval',
          activeDitaval: {
            path: 'ditavals/print.ditaval',
            name: 'print',
            rules: [],
            topics: [],
          } as unknown as React.ComponentProps<typeof MapTreePanel>['activeDitaval'],
        })}
      />,
    );
    expect(html).toContain('id="map-ditaval-select"');
    expect(html).toContain(t('mapTree.view.showAll'));
    expect(html).toContain(t('mapTree.view.dim'));
    expect(html).toContain(t('mapTree.view.hide'));
    expect(html).toContain('aria-expanded="true"');
  });

  it('puts search and the filter toggle on the same row', () => {
    const html = renderToStaticMarkup(<MapTreePanel {...mapTreeProps({ ditavals: DITAVALS })} />);
    const search = html.indexOf(t('mapTree.searchAria'));
    const filter = html.indexOf(t('mapTree.ditavalToggleAria'));
    expect(search).toBeGreaterThan(-1);
    expect(filter).toBeGreaterThan(search);
    // Same wrapper element: no second `border-b` row between the two controls.
    const between = html.slice(search, filter);
    expect(between).not.toContain('border-b border-slate-100');
    expect(between).not.toContain('</div></div><div');
  });

  it('drops the permanent footer hint and keeps it in the empty state', () => {
    const emptyHtml = renderToStaticMarkup(
      <MapTreePanel
        {...mapTreeProps({
          mapBuffers: {
            [MAP_PATH]: makeBuffer(
              `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map title="Empty Manual" />`,
            ),
          },
        })}
      />,
    );
    expect(emptyHtml).toContain(t('mapTree.footerHint'));
    // Inside the empty state, not in a permanent bordered footer.
    expect(emptyHtml).not.toContain(`border-t border-slate-100 bg-slate-50/70`);
  });
});

describe('isReadOnlyEditKeystroke', () => {
  it('flags typing, Backspace, Delete and Enter as edit intent', () => {
    expect(isReadOnlyEditKeystroke({ key: 'a' })).toBe(true);
    expect(isReadOnlyEditKeystroke({ key: ' ' })).toBe(true);
    expect(isReadOnlyEditKeystroke({ key: 'Backspace' })).toBe(true);
    expect(isReadOnlyEditKeystroke({ key: 'Delete' })).toBe(true);
    expect(isReadOnlyEditKeystroke({ key: 'Enter' })).toBe(true);
    expect(isReadOnlyEditKeystroke({ key: '中' })).toBe(true);
  });

  it('ignores navigation, Escape and shortcut chords', () => {
    expect(isReadOnlyEditKeystroke({ key: 'ArrowDown' })).toBe(false);
    expect(isReadOnlyEditKeystroke({ key: 'Tab' })).toBe(false);
    expect(isReadOnlyEditKeystroke({ key: 'Escape' })).toBe(false);
    expect(isReadOnlyEditKeystroke({ key: 'PageDown' })).toBe(false);
    expect(isReadOnlyEditKeystroke({ key: 'a', ctrlKey: true })).toBe(false);
    expect(isReadOnlyEditKeystroke({ key: 'f', metaKey: true })).toBe(false);
    expect(isReadOnlyEditKeystroke({ key: 'ArrowLeft', altKey: true })).toBe(false);
  });
});

describe('LeftSidebar: tab rail at the bottom', () => {
  const sidebarProps = {
    activeTab: 'map' as const,
    onChangeTab: () => {},
    onCollapse: () => {},
    workspaceName: 'Product Manual',
    workspaceMode: 'api' as const,
    onOpenWorkspaceDialog: () => {},
    mapTreeSlot: <p id="map-slot">map</p>,
    fileExplorerSlot: <p id="files-slot">files</p>,
    gitSlot: <p id="git-slot">git</p>,
    assignmentsSlot: <p id="assignments-slot">assignments</p>,
  };

  it('renders the tablist after every tabpanel so the rail closes the column', () => {
    const html = renderToStaticMarkup(<LeftSidebar {...sidebarProps} />);
    const tablist = html.indexOf('dita-sidebar-tablist');
    expect(tablist).toBeGreaterThan(-1);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
    // The rail sits below the panel stack: its index exceeds every tabpanel's index.
    const tabpanelIndexes = [...html.matchAll(/role="tabpanel"/g)].map((match) => match.index ?? 0);
    for (const index of tabpanelIndexes) expect(tablist).toBeGreaterThan(index);
    // Divider flipped to point up into the panel it labels.
    expect(html).toContain('border-t border-slate-200 bg-slate-50');
    expect(html).not.toContain('border-b border-slate-200 bg-slate-50');
    // Panel stack keeps its shape (guards the key-management grid contract).
    expect(html).toContain('grid-cols-[0.9fr_1.2fr_0.75fr_1.15fr]');
  });
});

// `EditorToolbar`'s root is `min-w-0 flex-1` (it fills the horizontal row in the visual pane). As a
// direct child of VisualEditor's `flex flex-col` shell that `flex-1` stretched it to half the
// viewport height, pushing the `.dita-paper` document card down the screen — so the slot must be
// wrapped in a non-shrinking, explicitly horizontal bar. VisualEditor needs a live ProseMirror
// view to mount, so the regression is asserted against its JSX source.
describe('VisualEditor: formatting bar containment', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/editor/visual/VisualEditor.tsx', import.meta.url)),
    'utf8',
  );

  it('wraps formattingBarSlot in a flex shrink-0 row instead of a bare flex-col child', () => {
    const start = source.indexOf('{formattingBarSlot ? (');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{guidePanel}', start);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);

    const className = /data-testid="visual-formatting-bar"\s+className="([^"]+)"/.exec(block)?.[1];
    expect(className).toBeDefined();
    expect(className).toContain('flex');
    expect(className).toContain('shrink-0');
    expect(className).toContain('items-center');
    // `flex-1` / `flex-col` here would reintroduce the vertical stretch.
    expect(className).not.toContain('flex-1');
    expect(className).not.toContain('flex-col');

    expect(block).toContain('{formattingBarSlot}');
    // Nothing renders at all when no toolbar is supplied (source-only / map layouts).
    expect(block).toContain(') : null}');
  });
});
