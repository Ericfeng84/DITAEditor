import { describe, expect, it } from 'vitest';
import type {
  HtmlThemeDescriptor,
  ManualPublishProfile,
} from '../src/services/publish-api.js';
import type { WorkspaceFileNode } from '../src/services/workspace-api.js';
import {
  applyThemeSelection,
  collectThemeAssetPaths,
  defaultThemeDraft,
  normalizeAccentColor,
  normalizeThemeDraft,
  themeDraftFromProfile,
  themeOptionsFromDraft,
  themeThumbnailStyle,
} from '../src/components/publish/html-theme-model.js';
import { htmlThemePreviewUrl } from '../src/services/publish-api.js';
import { usePublishStore } from '../src/store/publish-store.js';

/**
 * Phase 12 stage 4 unit coverage for the HTML5 theme picker. Everything asserted here is pure:
 * draft mapping to the request contract, the preview iframe URL, the CSS-only thumbnail palette
 * and the store's initial surface. The React components themselves are exercised by the app.
 */

function makeDescriptor(overrides: Partial<HtmlThemeDescriptor> = {}): HtmlThemeDescriptor {
  return {
    id: 'tech-docs',
    name: 'Tech Docs',
    description: 'Modern three column layout',
    tags: ['Modern', 'Default'],
    defaultAccent: '#2563eb',
    defaultMode: 'light',
    supportsCustomization: true,
    previewPalette: {
      bg: '#ffffff',
      surface: '#f8fafc',
      header: '#ffffff',
      text: '#0f172a',
      accent: '#2563eb',
      border: '#e2e8f0',
    },
    defaultFeatures: { search: true, toc: true, codeCopy: true, colorModeToggle: true },
    ...overrides,
  };
}

const VANILLA = makeDescriptor({
  id: 'vanilla',
  name: 'Native output',
  defaultAccent: '#2e5a88',
  supportsCustomization: false,
  defaultFeatures: { search: false, toc: false, codeCopy: false, colorModeToggle: false },
});

const EDITORIAL = makeDescriptor({
  id: 'editorial-paper',
  name: 'Editorial paper',
  defaultAccent: '#b45309',
  previewPalette: {
    bg: '#faf8f5',
    surface: '#f5f1ea',
    header: '#faf8f5',
    text: '#1c1917',
    accent: '#b45309',
    border: '#e2dbd1',
  },
});

function makeProfile(overrides: Partial<ManualPublishProfile> = {}): ManualPublishProfile {
  return {
    manualId: 'manual-1',
    htmlThemeId: 'tech-docs',
    htmlThemeOptions: {},
    // Phase 15 added the PDF pair to the profile; the HTML5 rules are unaffected by it.
    pdfThemeId: 'tech-manual',
    pdfThemeOptions: {},
    updatedBy: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('HTML5 theme draft model', () => {
  it('seeds a theme default draft without sharing the feature object', () => {
    const draft = defaultThemeDraft(EDITORIAL);
    expect(draft.themeId).toBe('editorial-paper');
    expect(draft.mode).toBe('light');
    expect(draft.accentColor).toBe('#b45309');
    expect(draft.siteTitle).toBe('');
    expect(draft.features).toEqual(EDITORIAL.defaultFeatures);
    draft.features.search = false;
    expect(EDITORIAL.defaultFeatures.search).toBe(true);
  });

  it('normalizes accent values and falls back for invalid input', () => {
    expect(normalizeAccentColor('ABCDEF', '#000000')).toBe('#abcdef');
    expect(normalizeAccentColor(' #AbCdEf ', '#000000')).toBe('#abcdef');
    expect(normalizeAccentColor('blue', '#2563eb')).toBe('#2563eb');
    expect(normalizeAccentColor('', '#2563EB')).toBe('#2563eb');
  });

  it('builds a draft from the profile options and clamps long text', () => {
    const profile = makeProfile({
      htmlThemeOptions: {
        accentColor: 'ff8800',
        siteTitle: `  ${'t'.repeat(200)}  `,
        footerText: `  ${'f'.repeat(400)}  `,
        logoPath: ' assets/logo.png ',
        customCssPath: 'assets/brand.css',
        features: { toc: false },
      },
    });
    const draft = themeDraftFromProfile(profile, EDITORIAL);
    expect(draft.accentColor).toBe('#ff8800');
    expect(draft.siteTitle).toHaveLength(120);
    expect(draft.footerText).toHaveLength(240);
    expect(draft.logoPath).toBe('assets/logo.png');
    expect(draft.customCssPath).toBe('assets/brand.css');
    expect(draft.features).toEqual({ search: true, toc: false, codeCopy: true, colorModeToggle: true });
  });

  it('normalizes an incoming draft against the descriptor', () => {
    const safe = normalizeThemeDraft(
      {
        themeId: 'tech-docs',
        mode: 'dark',
        accentColor: 'nope',
        siteTitle: 'x'.repeat(300),
        footerText: 'y'.repeat(300),
        logoPath: '  ',
        customCssPath: ' theme.css ',
        features: {
          search: false,
          toc: 'not-a-boolean' as unknown as boolean,
          codeCopy: true,
          colorModeToggle: true,
        },
      },
      makeDescriptor(),
    );
    expect(safe.mode).toBe('light');
    expect(safe.accentColor).toBe('#2563eb');
    expect(safe.siteTitle).toHaveLength(120);
    expect(safe.footerText).toHaveLength(240);
    expect(safe.logoPath).toBe('');
    expect(safe.customCssPath).toBe('theme.css');
    expect(safe.features).toEqual({ search: false, toc: true, codeCopy: true, colorModeToggle: true });
  });
});

describe('HTML5 theme selection switching', () => {
  it('keeps brand text and a hand-picked accent but reseeds features', () => {
    const base = defaultThemeDraft(makeDescriptor());
    const draft = {
      ...base,
      accentColor: '#aa0000',
      siteTitle: 'Product Manual',
      footerText: '© ACME',
      logoPath: 'assets/logo.png',
      customCssPath: 'assets/brand.css',
      features: { search: false, toc: false, codeCopy: false, colorModeToggle: false },
    };
    const next = applyThemeSelection(draft, makeDescriptor(), EDITORIAL);
    expect(next.themeId).toBe('editorial-paper');
    expect(next.accentColor).toBe('#aa0000');
    expect(next.siteTitle).toBe('Product Manual');
    expect(next.footerText).toBe('© ACME');
    expect(next.logoPath).toBe('assets/logo.png');
    expect(next.customCssPath).toBe('assets/brand.css');
    expect(next.features).toEqual(EDITORIAL.defaultFeatures);
  });

  it('adopts the next theme accent when the previous accent was untouched', () => {
    const draft = defaultThemeDraft(makeDescriptor());
    const next = applyThemeSelection(draft, makeDescriptor(), EDITORIAL);
    expect(next.accentColor).toBe('#b45309');
  });

  it('drops all customization when switching to vanilla', () => {
    const draft = {
      ...defaultThemeDraft(makeDescriptor()),
      accentColor: '#aa0000',
      siteTitle: 'Product Manual',
      logoPath: 'assets/logo.png',
    };
    const next = applyThemeSelection(draft, makeDescriptor(), VANILLA);
    expect(next).toEqual(defaultThemeDraft(VANILLA));
  });

  it('maps the draft onto request options and omits theme defaults', () => {
    const defaultOptions = themeOptionsFromDraft(defaultThemeDraft(makeDescriptor()), makeDescriptor());
    expect(defaultOptions.accentColor).toBeUndefined();
    expect(defaultOptions.features).toEqual({
      search: true,
      toc: true,
      codeCopy: true,
      colorModeToggle: true,
    });

    const custom = themeOptionsFromDraft(
      {
        ...defaultThemeDraft(makeDescriptor()),
        accentColor: '#aa0000',
        siteTitle: '  Product Manual  ',
        footerText: '   ',
        logoPath: 'assets/logo.png',
      },
      makeDescriptor(),
    );
    expect(custom.accentColor).toBe('#aa0000');
    expect(custom.siteTitle).toBe('Product Manual');
    expect(custom.footerText).toBeUndefined();
    expect(custom.logoPath).toBe('assets/logo.png');
  });

  it('sends no options for the vanilla theme', () => {
    expect(themeOptionsFromDraft({ ...defaultThemeDraft(VANILLA), siteTitle: 'ignored' }, VANILLA)).toEqual(
      {},
    );
  });
});

describe('HTML5 theme preview URL', () => {
  function parse(url: string): URLSearchParams {
    return new URL(url, 'http://localhost:5173').searchParams;
  }

  it('encodes the theme, accent, features and scope', () => {
    const url = htmlThemePreviewUrl({
      themeId: 'tech-docs',
      mode: 'dark',
      options: {
        accentColor: '#AA0000',
        siteTitle: 'Product Manual',
        footerText: 'ACME',
        features: { search: true, toc: false, codeCopy: true, colorModeToggle: false },
      },
      locale: 'zh-CN',
      manualId: 'manual-1',
      branch: 'feature/themes',
      cacheBust: 42,
    });
    expect(url.startsWith('/api/publish/themes/tech-docs/preview?')).toBe(true);
    const query = parse(url);
    expect(query.get('accent')).toBe('aa0000');
    expect(query.get('title')).toBe('Product Manual');
    expect(query.get('footer')).toBe('ACME');
    expect(query.get('search')).toBe('1');
    expect(query.get('toc')).toBe('0');
    expect(query.get('codeCopy')).toBe('1');
    expect(query.get('colorModeToggle')).toBe('0');
    expect(query.get('mode')).toBe('dark');
    expect(query.get('locale')).toBe('zh-CN');
    expect(query.get('manualId')).toBe('manual-1');
    expect(query.get('branch')).toBe('feature/themes');
    expect(query.get('_')).toBe('42');
  });

  it('drops an invalid accent and unset optional fields', () => {
    const url = htmlThemePreviewUrl({
      themeId: 'dev-dark',
      mode: 'light',
      options: { accentColor: 'blue', features: {} },
      locale: 'en',
    });
    const query = parse(url);
    expect(query.get('accent')).toBeNull();
    expect(query.get('title')).toBeNull();
    expect(query.get('footer')).toBeNull();
    expect(query.get('search')).toBeNull();
    expect(query.get('mode')).toBe('light');
    expect(query.get('locale')).toBe('en');
    expect(query.get('manualId')).toBeNull();
    expect(query.get('_')).toBeNull();
  });
});

describe('HTML5 theme thumbnails and workspace assets', () => {
  it('maps the palette into deterministic thumbnail styles', () => {
    const styles = themeThumbnailStyle(makeDescriptor().previewPalette);
    expect(styles).toEqual({
      frame: { backgroundColor: '#ffffff', borderColor: '#e2e8f0' },
      header: { backgroundColor: '#ffffff', borderBottomColor: '#e2e8f0' },
      sidebar: { backgroundColor: '#f8fafc', borderRightColor: '#e2e8f0' },
      sidebarLine: { backgroundColor: '#e2e8f0' },
      title: { backgroundColor: '#0f172a' },
      line: { backgroundColor: '#e2e8f0' },
      button: { backgroundColor: '#2563eb' },
    });
    const palette = makeDescriptor().previewPalette;
    palette.accent = '#000000';
    expect(styles.button.backgroundColor).toBe('#2563eb');
  });

  it('collects logo images and stylesheets from the workspace tree', () => {
    const tree: WorkspaceFileNode[] = [
      {
        name: 'assets',
        path: 'assets',
        kind: 'directory',
        children: [
          { name: 'logo.png', path: 'assets/logo.png', kind: 'image' },
          { name: 'brand.css', path: 'assets/brand.css', kind: 'other' },
          { name: 'notes.txt', path: 'assets/notes.txt', kind: 'other' },
          { name: 'topic.dita', path: 'assets/topic.dita', kind: 'topic' },
        ],
      },
      { name: 'hero.webp', path: 'hero.webp', kind: 'image' },
      { name: 'root.css', path: 'root.css', kind: 'other' },
    ];
    expect(collectThemeAssetPaths(tree, 'logo')).toEqual(['assets/logo.png', 'hero.webp']);
    expect(collectThemeAssetPaths(tree, 'css')).toEqual(['assets/brand.css', 'root.css']);
    expect(collectThemeAssetPaths([], 'logo')).toEqual([]);
  });
});

describe('publish store theme surface', () => {
  it('starts idle with no theme catalogue or profile loaded', () => {
    const state = usePublishStore.getState();
    expect(state.themes).toEqual([]);
    expect(state.themesStatus).toBe('idle');
    expect(state.themesError).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.profileStatus).toBe('idle');
    expect(state.profileError).toBeNull();
    expect(state.savingProfile).toBe(false);
    expect(state.profileSaved).toBe(false);
    expect(typeof state.loadThemes).toBe('function');
    expect(typeof state.loadProfile).toBe('function');
    expect(typeof state.saveProfile).toBe('function');
  });
});
