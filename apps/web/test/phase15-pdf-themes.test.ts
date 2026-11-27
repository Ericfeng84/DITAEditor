// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The publish dialog pulls Git tags on open; keep the regression test network-free.
vi.mock('../src/services/git-api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/git-api.js')>();
  return { ...actual, fetchGitTags: async () => ({ tags: [] }) };
});
import type {
  HtmlThemeDescriptor,
  ManualPublishProfile,
  PdfThemeDescriptor,
} from '../src/services/publish-api.js';
import type { WorkspaceFileNode } from '../src/services/workspace-api.js';
import {
  PDF_PAGE_RATIO,
  PDF_THEME_TEXT_LIMITS,
  applyPdfThemeSelection,
  collectPdfLogoPaths,
  defaultPdfThemeDraft,
  normalizePdfAccentColor,
  normalizePdfThemeDraft,
  pdfThemeDraftFromProfile,
  pdfThemeOptionsFromDraft,
  pdfThumbnailStyle,
} from '../src/components/publish/pdf-theme-model.js';
import { defaultThemeDraft } from '../src/components/publish/html-theme-model.js';
import { HtmlThemeSelector } from '../src/components/publish/HtmlThemeSelector';
import { PdfThemeSelector } from '../src/components/publish/PdfThemeSelector';
import { pdfThemePreviewUrl } from '../src/services/publish-api.js';
import { getCurrentLocale, translate } from '../src/i18n/index.js';
import { PublishDialog } from '../src/components/publish/PublishDialog';
import { usePublishStore } from '../src/store/publish-store.js';

/**
 * Phase 15 unit coverage for the PDF theme picker. Everything asserted here is pure: draft
 * mapping to the request/profile contract, theme switching memory, the preview URL, logo
 * filtering (WebP is unsupported by FOP 2.9) and the store's PDF surface.
 */

function makeDescriptor(overrides: Partial<PdfThemeDescriptor> = {}): PdfThemeDescriptor {
  return {
    id: 'tech-manual',
    name: 'Tech manual',
    description: 'Blueprint header with a left accent rule',
    tags: ['Default', 'Sans'],
    defaultAccent: '#1d4ed8',
    defaultPageSize: 'A4',
    defaultFontFamily: 'sans',
    defaultFontSize: '10pt',
    defaultMargins: 'normal',
    coverStyle: 'left-accent',
    supportsCustomization: true,
    previewPalette: {
      page: '#ffffff',
      header: '#f8fafc',
      text: '#0f172a',
      muted: '#94a3b8',
      accent: '#1d4ed8',
      border: '#e2e8f0',
      codeBg: '#f1f5f9',
    },
    defaultFeatures: {
      showCover: true,
      showToc: true,
      chapterNumbers: true,
      taskLabels: true,
      mirrorMargins: false,
    },
    ...overrides,
  };
}

const VANILLA = makeDescriptor({
  id: 'vanilla',
  name: 'Native output',
  description: 'Untouched DITA-OT PDF2 layout',
  coverStyle: 'vanilla',
  supportsCustomization: false,
  defaultFeatures: {
    showCover: false,
    showToc: false,
    chapterNumbers: false,
    taskLabels: false,
    mirrorMargins: false,
  },
});

const COMPACT = makeDescriptor({
  id: 'compact-guide',
  name: 'Compact guide',
  defaultAccent: '#0f766e',
  defaultPageSize: 'B5',
  defaultFontSize: '9pt',
  defaultMargins: 'compact',
  coverStyle: 'compact-header',
  defaultFeatures: {
    showCover: true,
    showToc: true,
    chapterNumbers: false,
    taskLabels: true,
    mirrorMargins: true,
  },
});

const EDITORIAL = makeDescriptor({
  id: 'editorial-book',
  name: 'Editorial book',
  defaultAccent: '#7c2d12',
  defaultFontFamily: 'serif',
  defaultFontSize: '11pt',
  defaultMargins: 'wide',
  coverStyle: 'editorial-center',
});

function makeProfile(overrides: Partial<ManualPublishProfile> = {}): ManualPublishProfile {
  return {
    manualId: 'manual-1',
    htmlThemeId: 'tech-docs',
    htmlThemeOptions: {},
    pdfThemeId: 'tech-manual',
    pdfThemeOptions: {},
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('PDF theme draft model', () => {
  it('seeds layout defaults, empty brand fields and a copied feature set', () => {
    const draft = defaultPdfThemeDraft(EDITORIAL);
    expect(draft.themeId).toBe('editorial-book');
    expect(draft.accentColor).toBe('#7c2d12');
    expect(draft.pageSize).toBe('A4');
    expect(draft.fontFamily).toBe('serif');
    expect(draft.fontSize).toBe('11pt');
    expect(draft.margins).toBe('wide');
    expect(draft.coverSubtitle).toBe('');
    expect(draft.headerText).toBe('');
    expect(draft.footerText).toBe('');
    expect(draft.logoPath).toBe('');
    expect(draft.features).toEqual(EDITORIAL.defaultFeatures);
    draft.features.showToc = false;
    expect(EDITORIAL.defaultFeatures.showToc).toBe(true);
  });

  it('normalizes accent values and rejects malformed ones', () => {
    expect(normalizePdfAccentColor('ABCDEF', '#000000')).toBe('#abcdef');
    expect(normalizePdfAccentColor('  #1D4ED8 ', '#000000')).toBe('#1d4ed8');
    expect(normalizePdfAccentColor('blue', '#1d4ed8')).toBe('#1d4ed8');
    expect(normalizePdfAccentColor('', '#1D4ED8')).toBe('#1d4ed8');
  });

  it('clamps brand text and repairs out-of-range enum values', () => {
    const draft = normalizePdfThemeDraft(
      {
        ...defaultPdfThemeDraft(COMPACT),
        pageSize: 'Legal' as never,
        fontFamily: 'mono' as never,
        margins: 'huge' as never,
        fontSize: '7pt' as never,
        coverSubtitle: `  ${'x'.repeat(200)}  `,
      },
      COMPACT,
    );
    expect(draft.pageSize).toBe('B5');
    expect(draft.fontFamily).toBe('sans');
    expect(draft.margins).toBe('compact');
    expect(draft.fontSize).toBe('9pt');
    expect(draft.coverSubtitle).toHaveLength(PDF_THEME_TEXT_LIMITS.coverSubtitle);
    expect(draft.coverSubtitle.startsWith(' ')).toBe(false);
  });

  it('seeds a draft from the saved manual profile', () => {
    const draft = pdfThemeDraftFromProfile(
      makeProfile({
        pdfThemeOptions: {
          accentColor: '#112233',
          pageSize: 'Letter',
          fontSize: '11pt',
          coverSubtitle: 'Release 4.2',
          features: { mirrorMargins: true },
        },
      }),
      COMPACT,
    );
    expect(draft.themeId).toBe('compact-guide');
    expect(draft.accentColor).toBe('#112233');
    expect(draft.pageSize).toBe('Letter');
    expect(draft.fontFamily).toBe('sans');
    expect(draft.fontSize).toBe('11pt');
    expect(draft.margins).toBe('compact');
    expect(draft.coverSubtitle).toBe('Release 4.2');
    expect(draft.features.mirrorMargins).toBe(true);
    // Untouched flags keep the theme defaults.
    expect(draft.features.showCover).toBe(true);
  });

  it('falls back to the theme defaults for a profile without PDF options', () => {
    const draft = pdfThemeDraftFromProfile(makeProfile(), EDITORIAL);
    expect(draft.themeId).toBe('editorial-book');
    expect(draft.accentColor).toBe('#7c2d12');
    expect(draft.fontFamily).toBe('serif');
    expect(draft.pageSize).toBe('A4');
    expect(draft.features).toEqual(EDITORIAL.defaultFeatures);
  });
});

describe('PDF theme selection switching', () => {
  it('re-seeds layout and features but keeps brand text and logo', () => {
    const current: ReturnType<typeof defaultPdfThemeDraft> = {
      ...defaultPdfThemeDraft(makeDescriptor()),
      coverSubtitle: 'Platform handbook',
      headerText: 'ACME Platform',
      footerText: '© ACME',
      logoPath: 'assets/logo.png',
      pageSize: 'Letter',
      fontSize: '11pt',
    };
    const next = applyPdfThemeSelection(current, makeDescriptor(), COMPACT);
    expect(next.themeId).toBe('compact-guide');
    expect(next.coverSubtitle).toBe('Platform handbook');
    expect(next.headerText).toBe('ACME Platform');
    expect(next.footerText).toBe('© ACME');
    expect(next.logoPath).toBe('assets/logo.png');
    expect(next.pageSize).toBe('B5');
    expect(next.fontSize).toBe('9pt');
    expect(next.margins).toBe('compact');
    expect(next.features).toEqual(COMPACT.defaultFeatures);
  });

  it('re-seeds the accent when the user never changed it', () => {
    const current = defaultPdfThemeDraft(makeDescriptor());
    const next = applyPdfThemeSelection(current, makeDescriptor(), COMPACT);
    expect(next.accentColor).toBe('#0f766e');
  });

  it('keeps a hand-picked accent across themes', () => {
    const current = { ...defaultPdfThemeDraft(makeDescriptor()), accentColor: '#ff8800' };
    const next = applyPdfThemeSelection(current, makeDescriptor(), COMPACT);
    expect(next.accentColor).toBe('#ff8800');
  });

  it('clears customization when switching to the untouched vanilla theme', () => {
    const current = {
      ...defaultPdfThemeDraft(makeDescriptor()),
      coverSubtitle: 'Keep me?',
      accentColor: '#ff8800',
    };
    const next = applyPdfThemeSelection(current, makeDescriptor(), VANILLA);
    expect(next).toEqual(defaultPdfThemeDraft(VANILLA));
    expect(next.coverSubtitle).toBe('');
    expect(next.accentColor).toBe(VANILLA.defaultAccent);
  });
});

describe('PDF theme options mapping', () => {
  it('omits values that still equal the theme defaults', () => {
    const descriptor = makeDescriptor();
    const options = pdfThemeOptionsFromDraft(defaultPdfThemeDraft(descriptor), descriptor);
    expect(options.accentColor).toBeUndefined();
    expect(options.pageSize).toBeUndefined();
    expect(options.fontFamily).toBeUndefined();
    expect(options.fontSize).toBeUndefined();
    expect(options.margins).toBeUndefined();
    expect(options.coverSubtitle).toBeUndefined();
    expect(options.headerText).toBeUndefined();
    expect(options.footerText).toBeUndefined();
    expect(options.logoPath).toBeUndefined();
    // Features always travel as an explicit snapshot so the server need not re-derive defaults.
    expect(options.features).toEqual(descriptor.defaultFeatures);
  });

  it('sends every override, normalized and trimmed', () => {
    const descriptor = makeDescriptor();
    const draft = {
      ...defaultPdfThemeDraft(descriptor),
      accentColor: '#AA0000',
      pageSize: 'B5' as const,
      fontFamily: 'serif' as const,
      fontSize: '9pt' as const,
      margins: 'wide' as const,
      coverSubtitle: '  Release 2  ',
      headerText: ' ACME ',
      footerText: ' © ACME 2026 ',
      logoPath: ' assets/logo.svg ',
      features: { ...descriptor.defaultFeatures, mirrorMargins: true },
    };
    const options = pdfThemeOptionsFromDraft(draft, descriptor);
    expect(options).toEqual({
      features: { ...descriptor.defaultFeatures, mirrorMargins: true },
      accentColor: '#aa0000',
      pageSize: 'B5',
      fontFamily: 'serif',
      fontSize: '9pt',
      margins: 'wide',
      coverSubtitle: 'Release 2',
      headerText: 'ACME',
      footerText: '© ACME 2026',
      logoPath: 'assets/logo.svg',
    });
  });

  it('returns an empty option bag for the vanilla theme', () => {
    const draft = {
      ...defaultPdfThemeDraft(VANILLA),
      accentColor: '#ff8800',
      logoPath: 'assets/logo.png',
    };
    expect(pdfThemeOptionsFromDraft(draft, VANILLA)).toEqual({});
  });
});

describe('PDF theme preview URL', () => {
  function parse(url: string): URLSearchParams {
    return new URL(url, 'http://localhost:5173').searchParams;
  }

  it('encodes the theme, layout, features and scope', () => {
    const url = pdfThemePreviewUrl({
      themeId: 'editorial-book',
      options: {
        accentColor: '#AA0000',
        pageSize: 'B5',
        fontFamily: 'serif',
        fontSize: '11pt',
        margins: 'wide',
        coverSubtitle: 'Release 4.2',
        headerText: 'ACME',
        footerText: '© ACME',
        features: {
          showCover: true,
          showToc: false,
          chapterNumbers: true,
          taskLabels: false,
          mirrorMargins: true,
        },
      },
      locale: 'zh-CN',
      manualId: 'manual-1',
      branch: 'feature/themes',
      cacheBust: 42,
    });
    expect(url.startsWith('/api/publish/pdf-themes/editorial-book/preview?')).toBe(true);
    const query = parse(url);
    expect(query.get('accent')).toBe('aa0000');
    expect(query.get('pageSize')).toBe('B5');
    expect(query.get('fontFamily')).toBe('serif');
    expect(query.get('fontSize')).toBe('11pt');
    expect(query.get('margins')).toBe('wide');
    expect(query.get('coverSubtitle')).toBe('Release 4.2');
    expect(query.get('headerText')).toBe('ACME');
    expect(query.get('footerText')).toBe('© ACME');
    expect(query.get('showCover')).toBe('1');
    expect(query.get('showToc')).toBe('0');
    expect(query.get('chapterNumbers')).toBe('1');
    expect(query.get('taskLabels')).toBe('0');
    expect(query.get('mirrorMargins')).toBe('1');
    expect(query.get('locale')).toBe('zh-CN');
    expect(query.get('manualId')).toBe('manual-1');
    expect(query.get('branch')).toBe('feature/themes');
    expect(query.get('_')).toBe('42');
  });

  it('drops an invalid accent and unset optional fields', () => {
    const url = pdfThemePreviewUrl({
      themeId: 'vanilla',
      options: { accentColor: 'blue' },
      locale: 'en',
    });
    const query = parse(url);
    expect(query.get('accent')).toBeNull();
    expect(query.get('pageSize')).toBeNull();
    expect(query.get('logoPath')).toBeNull();
    expect(query.get('showCover')).toBeNull();
    expect(query.get('locale')).toBe('en');
    expect(query.get('manualId')).toBeNull();
    expect(query.get('_')).toBeNull();
  });
});

describe('PDF theme thumbnails and logo discovery', () => {
  it('maps the palette into deterministic paper-thumbnail styles', () => {
    const styles = pdfThumbnailStyle(makeDescriptor());
    expect(styles.coverStyle).toBe('left-accent');
    expect(styles.aspectRatio).toBe(PDF_PAGE_RATIO.A4);
    expect(styles.page).toEqual({ backgroundColor: '#ffffff', borderColor: '#e2e8f0' });
    expect(styles.band).toEqual({
      backgroundColor: '#f8fafc',
      borderBottomColor: '#e2e8f0',
    });
    expect(styles.accentBar).toEqual({ backgroundColor: '#1d4ed8' });
    expect(styles.title).toEqual({ backgroundColor: '#0f172a' });
    expect(styles.line).toEqual({ backgroundColor: '#e2e8f0' });
    expect(styles.code).toEqual({ backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' });
  });

  it('scales the sheet to the theme paper size', () => {
    expect(pdfThumbnailStyle(COMPACT).aspectRatio).toBe(PDF_PAGE_RATIO.B5);
    expect(pdfThumbnailStyle(VANILLA).coverStyle).toBe('vanilla');
  });

  it('offers PNG, JPEG and SVG logos but filters WebP out', () => {
    const tree: WorkspaceFileNode[] = [
      {
        name: 'assets',
        path: 'assets',
        kind: 'directory',
        children: [
          { name: 'logo.png', path: 'assets/logo.png', kind: 'image' },
          { name: 'mark.JPG', path: 'assets/mark.JPG', kind: 'image' },
          { name: 'hero.webp', path: 'assets/hero.webp', kind: 'image' },
          { name: 'diagram.svg', path: 'assets/diagram.svg', kind: 'image' },
          { name: 'brand.css', path: 'assets/brand.css', kind: 'other' },
        ],
      },
      { name: 'cover.jpeg', path: 'cover.jpeg', kind: 'image' },
      { name: 'shot.webp', path: 'shot.webp', kind: 'image' },
    ];
    expect(collectPdfLogoPaths(tree)).toEqual([
      'assets/diagram.svg',
      'assets/logo.png',
      'assets/mark.JPG',
      'cover.jpeg',
    ]);
    expect(collectPdfLogoPaths([])).toEqual([]);
  });
});

describe('publish store PDF theme surface', () => {
  it('starts idle without a PDF catalogue while the HTML5 surface stays', () => {
    const state = usePublishStore.getState();
    expect(state.pdfThemes).toEqual([]);
    expect(state.pdfThemesStatus).toBe('idle');
    expect(state.pdfThemesError).toBeNull();
    expect(state.themes).toEqual([]);
    expect(state.profile).toBeNull();
    expect(typeof state.loadPdfThemes).toBe('function');
    expect(typeof state.savePdfProfile).toBe('function');
  });
});

/**
 * Regression: when the PDF catalogue request fails and no draft could be seeded, the dialog used
 * to show a muted grey paragraph with a permanently frozen `animate-spin` spinner and no way to
 * recover. It must mirror the HTML5 branch: a rose banner plus a working Retry button.
 */
describe('PublishDialog PDF catalogue failure', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the rose error banner with a Retry that reloads the catalogue and no spinner', () => {
    usePublishStore.setState({
      runtime: null,
      runtimeLoading: false,
      runtimeError: null,
      jobs: [],
      jobsLoading: false,
      activeJobId: null,
      actionError: null,
      submitting: false,
      cancelling: false,
      themes: [],
      themesStatus: 'idle',
      themesError: null,
      pdfThemes: [],
      pdfThemesStatus: 'error',
      pdfThemesError: 'pdf catalogue unreachable',
      profile: null,
      profileStatus: 'ready',
      profileError: null,
      savingProfile: false,
      profileSaveError: null,
      profileSaved: false,
    });

    const state = usePublishStore.getState();
    // The dialog re-runs every loader on open; stub them so the failure state stays put and the
    // only observable network-ish call is the one the Retry button makes.
    vi.spyOn(state, 'loadRuntime').mockResolvedValue(undefined);
    vi.spyOn(state, 'loadJobs').mockResolvedValue(undefined);
    vi.spyOn(state, 'loadThemes').mockResolvedValue(undefined);
    vi.spyOn(state, 'loadProfile').mockResolvedValue(undefined);
    const loadPdfThemes = vi.spyOn(state, 'loadPdfThemes').mockResolvedValue(undefined);

    render(
      createElement(PublishDialog, {
        open: true,
        rootMaps: [],
        ditavals: [],
        activeRootMapPath: null,
        activeDitavalPath: null,
        role: 'writer',
        onClose: () => undefined,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }));

    const locale = getCurrentLocale();
    const errorText = translate(locale, 'publish.pdf.themesLoadFailed', {
      message: 'pdf catalogue unreachable',
    });
    const banner = screen.getByText(errorText).closest('div');
    expect(banner).not.toBeNull();
    const box = banner as HTMLElement;
    expect(box.className).toContain('border-rose-200');
    expect(box.className).toContain('bg-rose-50');
    expect(box.className).toContain('text-rose-800');
    // No frozen spinner and no misleading "loading" copy in the failure branch.
    expect(box.querySelector('.animate-spin')).toBeNull();
    expect(screen.queryByText(translate(locale, 'publish.pdf.loading'))).toBeNull();

    loadPdfThemes.mockClear();
    const retry = within(box).getByRole('button', {
      name: translate(locale, 'publish.theme.retry'),
    });
    fireEvent.click(retry);
    expect(loadPdfThemes).toHaveBeenCalledTimes(1);
  });
});

/**
 * Design review follow-up: the customization panel moved from a bottom accordion to a sticky tab
 * bar. Both selectors must default to the card grid, reveal the panel from the second tab, and
 * bounce back to the grid whenever a non-customizable (`vanilla`) theme is selected.
 */

function makeHtmlDescriptor(overrides: Partial<HtmlThemeDescriptor> = {}): HtmlThemeDescriptor {
  return {
    id: 'tech-docs',
    name: 'Tech docs',
    description: 'Three-column documentation layout',
    tags: ['Default'],
    defaultAccent: '#2563eb',
    defaultMode: 'light',
    supportsCustomization: true,
    previewPalette: {
      bg: '#ffffff',
      surface: '#f8fafc',
      header: '#f1f5f9',
      text: '#0f172a',
      accent: '#2563eb',
      border: '#e2e8f0',
    },
    defaultFeatures: { search: true, toc: true, codeCopy: true, colorModeToggle: false },
    ...overrides,
  };
}

const HTML_TECH = makeHtmlDescriptor();
const HTML_VANILLA = makeHtmlDescriptor({
  id: 'vanilla',
  name: 'Native HTML5',
  description: 'Untouched DITA-OT output',
  supportsCustomization: false,
});

function htmlSelectorProps(
  draftTheme: HtmlThemeDescriptor = HTML_TECH,
): Parameters<typeof HtmlThemeSelector>[0] {
  return {
    descriptors: [HTML_TECH, HTML_VANILLA],
    status: 'ready',
    error: null,
    draft: defaultThemeDraft(draftTheme),
    defaultThemeId: null,
    files: [],
    onChange: vi.fn(),
    onRetry: vi.fn(),
    onPreview: vi.fn(),
    onSaveDefault: vi.fn(),
    savingDefault: false,
    savedDefault: false,
    saveError: null,
  };
}

function renderHtmlSelector(
  overrides: Partial<Parameters<typeof HtmlThemeSelector>[0]> = {},
) {
  const onChange = vi.fn();
  const view = render(createElement(HtmlThemeSelector, { ...htmlSelectorProps(), onChange, ...overrides }));
  return { ...view, onChange };
}

function pdfSelectorProps(
  draftTheme: PdfThemeDescriptor = makeDescriptor(),
): Parameters<typeof PdfThemeSelector>[0] {
  return {
    descriptors: [makeDescriptor(), VANILLA],
    status: 'ready',
    error: null,
    draft: defaultPdfThemeDraft(draftTheme),
    defaultThemeId: null,
    files: [],
    onChange: vi.fn(),
    onSelectTheme: vi.fn(),
    onRetry: vi.fn(),
    onPreview: vi.fn(),
    onSaveDefault: vi.fn(),
    savingDefault: false,
    savedDefault: false,
    saveError: null,
  };
}

function renderPdfSelector(
  overrides: Partial<Parameters<typeof PdfThemeSelector>[0]> = {},
) {
  const onChange = vi.fn();
  const onSelectTheme = vi.fn();
  const view = render(
    createElement(PdfThemeSelector, { ...pdfSelectorProps(), onChange, onSelectTheme, ...overrides }),
  );
  return { ...view, onChange, onSelectTheme };
}

function tabByIndex(index: number): HTMLButtonElement {
  const tab = screen.getAllByRole('tab')[index];
  if (!tab) throw new Error(`missing tab ${index}`);
  return tab as HTMLButtonElement;
}

function activePanelId(): string | null {
  return screen.getByRole('tabpanel').getAttribute('id');
}

describe('HtmlThemeSelector tab bar', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens on the templates tab with the card grid and no brand panel', () => {
    const locale = getCurrentLocale();
    renderHtmlSelector();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabByIndex(0).getAttribute('aria-selected')).toBe('true');
    expect(tabByIndex(1).getAttribute('aria-selected')).toBe('false');
    // The inactive tab's own controls stay keyboard-unreachable.
    expect(tabByIndex(0).getAttribute('tabindex')).toBe('0');
    expect(tabByIndex(1).getAttribute('tabindex')).toBe('-1');

    expect(activePanelId()).toBe('html-theme-panel-templates');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.getByLabelText(translate(locale, 'publish.theme.cardAria', { name: HTML_TECH.name })),
    ).toBeTruthy();
    // Brand controls only exist inside the second panel.
    expect(
      screen.queryByRole('button', {
        name: translate(locale, 'publish.theme.previewButton'),
      }),
    ).toBeNull();
    expect(screen.queryByLabelText(translate(locale, 'publish.theme.accentLabel'))).toBeNull();
  });

  it('swaps the grid for the brand controls when the customize tab is clicked', () => {
    const locale = getCurrentLocale();
    renderHtmlSelector();

    fireEvent.click(tabByIndex(1));

    expect(tabByIndex(1).getAttribute('aria-selected')).toBe('true');
    expect(tabByIndex(0).getAttribute('aria-selected')).toBe('false');
    expect(activePanelId()).toBe('html-theme-panel-customize');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByLabelText(translate(locale, 'publish.theme.accentLabel'))).toBeTruthy();
    expect(
      screen.getByRole('button', { name: translate(locale, 'publish.theme.previewButton') }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: translate(locale, 'publish.theme.saveButton') }),
    ).toBeTruthy();

    // Tab keys move between the two tabs and support Home/End.
    fireEvent.keyDown(tabByIndex(1), { key: 'ArrowLeft' });
    expect(tabByIndex(0).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabByIndex(0), { key: 'End' });
    expect(tabByIndex(1).getAttribute('aria-selected')).toBe('true');
  });

  it('disables the customize tab and shows the vanilla hint for non-customizable themes', () => {
    const locale = getCurrentLocale();
    const { rerender } = renderHtmlSelector();

    // A user parked on the brand panel must be bounced back to the grid.
    fireEvent.click(tabByIndex(1));
    expect(activePanelId()).toBe('html-theme-panel-customize');

    rerender(createElement(HtmlThemeSelector, htmlSelectorProps(HTML_VANILLA)));

    expect(tabByIndex(1).disabled).toBe(true);
    expect(tabByIndex(1).getAttribute('aria-disabled')).toBe('true');
    expect(tabByIndex(1).getAttribute('tabindex')).toBe('-1');
    expect(activePanelId()).toBe('html-theme-panel-templates');
    expect(screen.getByText(translate(locale, 'publish.theme.vanillaHint'))).toBeTruthy();
  });
});

describe('PdfThemeSelector tab bar', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens on the templates tab with the card grid and no layout panel', () => {
    const locale = getCurrentLocale();
    renderPdfSelector();

    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(tabByIndex(0).getAttribute('aria-selected')).toBe('true');
    expect(activePanelId()).toBe('pdf-theme-panel-templates');
    expect(
      screen.getByLabelText(translate(locale, 'publish.pdf.cardAria', { name: 'Tech manual' })),
    ).toBeTruthy();
    expect(screen.queryByText(translate(locale, 'publish.pdf.pageSizeLabel'))).toBeNull();
    expect(screen.queryByText(translate(locale, 'publish.pdf.fontFamilyLabel'))).toBeNull();
    expect(
      screen.queryByRole('button', { name: translate(locale, 'publish.pdf.previewButton') }),
    ).toBeNull();
  });

  it('swaps the grid for the layout controls when the customize tab is clicked', () => {
    const locale = getCurrentLocale();
    const { onChange } = renderPdfSelector();

    fireEvent.click(tabByIndex(1));

    expect(tabByIndex(1).getAttribute('aria-selected')).toBe('true');
    expect(activePanelId()).toBe('pdf-theme-panel-customize');
    expect(
      screen.queryByLabelText(translate(locale, 'publish.pdf.cardAria', { name: 'Tech manual' })),
    ).toBeNull();
    expect(screen.getByText(translate(locale, 'publish.pdf.pageSizeLabel'))).toBeTruthy();
    expect(screen.getByText(translate(locale, 'publish.pdf.fontFamilyLabel'))).toBeTruthy();
    expect(screen.getByText(translate(locale, 'publish.pdf.fontSizeLabel'))).toBeTruthy();
    expect(screen.getByText(translate(locale, 'publish.pdf.marginsLabel'))).toBeTruthy();
    expect(
      screen.getByRole('button', { name: translate(locale, 'publish.pdf.saveButton') }),
    ).toBeTruthy();

    // The paper size control still patches the draft from inside the tab panel.
    fireEvent.click(
      within(
        screen.getByRole('radiogroup', {
          name: translate(locale, 'publish.pdf.pageSizeLabel'),
        }),
      ).getByRole('radio', { name: translate(locale, 'publish.pdf.pageSize.Letter') }),
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 'Letter' }));
  });

  it('disables the customize tab and falls back to the grid for a vanilla theme', () => {
    const locale = getCurrentLocale();
    const { rerender } = renderPdfSelector();

    fireEvent.click(tabByIndex(1));
    expect(activePanelId()).toBe('pdf-theme-panel-customize');

    rerender(createElement(PdfThemeSelector, pdfSelectorProps(VANILLA)));

    expect(tabByIndex(1).disabled).toBe(true);
    expect(tabByIndex(1).getAttribute('aria-disabled')).toBe('true');
    expect(activePanelId()).toBe('pdf-theme-panel-templates');
    expect(screen.getByText(translate(locale, 'publish.pdf.vanillaHint'))).toBeTruthy();
  });
});
