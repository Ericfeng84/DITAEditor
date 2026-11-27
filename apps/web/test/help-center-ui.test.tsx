// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HelpCenterHost } from '../src/components/help/HelpCenterHost';
import {
  buildHelpSections,
  filterHelpSections,
  helpEntryCount,
  sectionTexts,
} from '../src/components/help/help-sections';
import { HubHeader } from '../src/workbench/HubHeader';
import { t } from '../src/i18n/index.js';
import { switchLocale } from '../src/i18n/locale.js';
import { helpDocsUrl } from '../src/lib/help-links.js';
import { useHelpCenterStore } from '../src/store/help-center-store';

/**
 * The help center must stay truthful about DITA: element/attribute facts are derived from
 * `@dita/core`, so these assertions check both the derived content and the interaction contract
 * (nav, filter, `?` shortcut, Esc, and external links that survive the Electron handler).
 */

const SECTIONS = buildHelpSections('zh-CN');

function sectionById(id: string) {
  const section = SECTIONS.find((entry) => entry.id === id);
  if (!section) throw new Error(`missing help section: ${id}`);
  return section;
}

/** `table` blocks are rendered as `<dl>` rows, so collect label/detail/meta text for assertions. */
function tableRows(caption?: string): string[] {
  const rows = SECTIONS.flatMap((section) =>
    section.blocks.flatMap((block) =>
      block.kind === 'table' && (!caption || block.caption === caption) ? block.rows : [],
    ),
  );
  return rows.map((row) =>
    [`${row.label} :: ${row.detail}`, ...(row.meta ?? []).map((meta) => `${meta.label} ${meta.text}`)].join(' :: '),
  );
}

beforeEach(() => {
  useHelpCenterStore.setState({ isOpen: false });
  switchLocale('zh-CN');
});

afterEach(() => {
  cleanup();
  useHelpCenterStore.setState({ isOpen: false });
});

describe('help center content', () => {
  it('ships the seven author-facing sections with bilingual chrome', () => {
    expect(SECTIONS.map((section) => section.id)).toEqual([
      'quickstart',
      'authoring',
      'dita',
      'validation',
      'collab',
      'shortcuts',
      'links',
    ]);
    for (const section of SECTIONS) {
      expect(section.title.trim().length).toBeGreaterThan(0);
      expect(section.intro.trim().length).toBeGreaterThan(0);
      expect(section.blocks.length).toBeGreaterThan(0);
      expect(sectionTexts(section).length).toBeGreaterThan(2);
    }
    expect(helpEntryCount(SECTIONS)).toBeGreaterThan(60);

    const english = buildHelpSections('en');
    expect(english.map((section) => section.title)).not.toEqual(SECTIONS.map((section) => section.title));
    expect(helpEntryCount(english)).toBe(helpEntryCount(SECTIONS));
  });

  it('derives topic-type structure from @dita/core instead of hardcoding it', () => {
    const types = tableRows(t('help.dita.typesLabel'));
    expect(types).toHaveLength(4);
    expect(types[0]).toContain('<concept>');
    expect(types.join('\n')).toMatch(/<task>.*<title>/);
    // Concept bodies require at least one body-level child, task bodies do not.
    expect(types[0]).toContain(t('help.dita.typesRequired'));
  });

  it('keeps ordered containers and the required-id note in sync with the registry', () => {
    const ordered = tableRows(t('help.dita.typesOrder'));
    expect(ordered.length).toBeGreaterThanOrEqual(4);
    expect(ordered[0]).toMatch(/^<conbody> :: <p>/);
    expect(ordered[0]).toContain('*');

    const attributes = tableRows(t('help.dita.attrsLabel'));
    const idRow = attributes.find((row) => row.startsWith('id ·'));
    expect(idRow).toContain(t('help.dita.colRequiredOn'));
    expect(idRow).toContain('<concept>');
    const conrefRow = attributes.find((row) => row.startsWith('conref ·'));
    expect(conrefRow).toBeDefined();
    expect(conrefRow).not.toContain(t('help.dita.colRequiredOn'));
  });

  it('filters by title, body copy and derived element names', () => {
    expect(filterHelpSections(SECTIONS, 'conref').length).toBeGreaterThanOrEqual(2);
    const filtered = filterHelpSections(SECTIONS, 'conref');
    expect(filtered.some((section) => section.id === 'dita')).toBe(true);
    expect(filtered.some((section) => section.id === 'quickstart')).toBe(false);

    // A section-title match keeps the whole section.
    const byTitle = filterHelpSections(SECTIONS, t('help.shortcuts.title'));
    expect(byTitle.map((section) => section.id)).toEqual(['shortcuts']);

    expect(filterHelpSections(SECTIONS, 'zzz-no-such-topic')).toEqual([]);
    expect(filterHelpSections(SECTIONS, '   ')).toHaveLength(SECTIONS.length);
  });

  it('exposes external links that survive the Electron window-open handler', () => {
    const links = sectionById('links').blocks.find((block) => block.kind === 'links');
    expect(links?.kind).toBe('links');
    if (!links || links.kind !== 'links') return;
    for (const item of links.items) {
      expect(item.href.startsWith('https://')).toBe(true);
    }
    expect(links.items.some((item) => item.href.includes('oasis-open.org'))).toBe(true);
  });

  it('illustrates the quick start with bundled, per-locale screenshots', () => {
    const quickstart = SECTIONS.find((section) => section.id === 'quickstart');
    const steps = quickstart?.blocks.find((block) => block.kind === 'steps');
    if (!steps || steps.kind !== 'steps') throw new Error('missing quick-start steps');

    const illustrated = steps.items.filter((item) => item.image);
    expect(steps.items).toHaveLength(6);
    expect(illustrated).toHaveLength(4);
    for (const step of illustrated) {
      expect(step.image?.src.endsWith('.png')).toBe(true);
      // Bundled by Vite, never a remote URL: the help center has to work offline.
      expect(step.image?.src.startsWith('http')).toBe(false);
      expect(step.image?.alt.length).toBeGreaterThan(10);
    }

    const englishSteps = buildHelpSections('en').find((section) => section.id === 'quickstart')?.blocks[0];
    if (!englishSteps || englishSteps.kind !== 'steps') throw new Error('missing English steps');
    const zhSrc = illustrated[0]?.image?.src;
    const enSrc = englishSteps.items.find((item) => item.image)?.image?.src;
    expect(enSrc).toBeTruthy();
    expect(enSrc).not.toBe(zhSrc);
  });

  it('points the docs link at the sub-path deployment and keeps the locale prefix', () => {
    const links = sectionById('links').blocks.find((block) => block.kind === 'links');
    if (!links || links.kind !== 'links') throw new Error('missing links block');
    const docs = links.items.find((item) => item.href.includes('/docs'));
    expect(docs?.href).toBe('https://ericfeng84.github.io/DITAEditor/docs');

    expect(helpDocsUrl('en', 'authoring-guide')).toBe(
      'https://ericfeng84.github.io/DITAEditor/en/docs/authoring-guide',
    );
  });
});

describe('help center interaction', () => {
  it('opens from the workbench header and closes with Escape', () => {
    render(<HelpCenterHost />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => useHelpCenterStore.getState().open());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: t('help.quickstart.title') })).toBeTruthy();
    expect(within(dialog).getByText(t('help.quickstart.s1'))).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('switches sections through the nav and narrows results through the filter', () => {
    render(<HelpCenterHost />);
    act(() => useHelpCenterStore.setState({ isOpen: true }));
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: t('help.nav.shortcuts') }));
    expect(within(dialog).getByText('⌘/Ctrl + S')).toBeTruthy();

    const filter = within(dialog).getByLabelText(t('help.filterLabel'));
    fireEvent.change(filter, { target: { value: 'conref' } });
    expect(within(dialog).getByRole('heading', { name: t('help.dita.title') })).toBeTruthy();
    expect(within(dialog).queryByText(t('help.quickstart.s1'))).toBeNull();

    fireEvent.change(filter, { target: { value: 'zzz-no-such-topic' } });
    expect(within(dialog).getByText(t('help.filterEmpty'))).toBeTruthy();
  });

  it('toggles with ? but never steals keys from a text field', () => {
    render(
      <>
        <HelpCenterHost />
        <textarea aria-label="editor-content" />
      </>,
    );

    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByRole('dialog')).toBeNull();

    const textarea = screen.getByLabelText('editor-content');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: '?' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('enlarges a step screenshot and closes only the enlargement on Escape', () => {
    render(<HelpCenterHost />);
    act(() => useHelpCenterStore.getState().open());

    const alt = t('help.quickstart.img1Alt');
    const [thumbnail] = screen.getAllByAltText(alt);
    const button = thumbnail?.closest('button');
    expect(button).toBeTruthy();
    fireEvent.click(button as HTMLButtonElement);
    expect(screen.getAllByAltText(alt)).toHaveLength(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getAllByAltText(alt)).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not fire on modified keystrokes so ⌘? stays available to the OS', () => {
    render(<HelpCenterHost />);
    fireEvent.keyDown(window, { key: '?', metaKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the hub entry button that opens the center', () => {
    render(
      <HubHeader
        identity={null}
        currentUser={null}
        onSwitchIdentity={() => {}}
        onRefresh={() => {}}
        loading={false}
        offline={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t('help.openAria') }));
    expect(useHelpCenterStore.getState().isOpen).toBe(true);
  });
});
