import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  accentScale,
  DEFAULT_HTML_THEME_ID,
  getHtmlTheme,
  HTML_THEME_IDS,
  HTML_THEME_LABELS,
  htmlThemeOptionsSchema,
  isHtmlThemeId,
  isValidAccent,
  listHtmlThemes,
  relativeLuminance,
  resolveHtmlThemesDir,
  resolveThemeOptions,
  THEME_OPTION_LIMITS,
} from '../src/modules/publish/html-themes.js';
import {
  buildBrandVarsCss,
  enhanceHtml5Output,
  escapeHtmlText,
  serializeInlineJson,
  type HtmlThemeSearchEntry,
} from '../src/modules/publish/theme-enhancer.js';
import {
  HtmlThemePreviewError,
  renderHtmlThemePreview,
} from '../src/modules/publish/theme-preview.js';

const tempDirs: string[] = [];
const THEMES_DIR = resolveHtmlThemesDir();

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeTree(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dita-theme-'));
  tempDirs.push(dir);
  for (const [relative, content] of Object.entries(files)) {
    const abs = path.join(dir, relative);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }
  return dir;
}

const OUTPUT_FILES: Record<string, string> = {
  'index.html': [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>Product Docs</title></head>',
    '<body class="theme-default de-existing">',
    '<main role="main">',
    '<h1 class="topictitle1">Getting started</h1>',
    '<p class="shortdesc">Install the workbench and publish your first HTML5 output.</p>',
    '<p>Body copy for the search index.</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('\n'),
  'concepts/arch.html': [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head><title>Architecture - Product Docs</title></head>',
    '<body>',
    '<main role="main"><h1 class="topictitle1">Architecture</h1>',
    '<p class="shortdesc">How packages fit together.</p>',
    '<p>Content with <b>bold</b> text.</p></main>',
    '</body>',
    '</html>',
  ].join('\n'),
  'concepts/deep/nested.html': [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head><title>Topic - Product Docs</title>',
    '<meta name="description" content="Deep nested topic summary."></head>',
    '<body><main role="main"><p>No heading here.</p></main></body>',
    '</html>',
  ].join('\n'),
  'pre-themed.html': [
    '<!DOCTYPE html>',
    '<html lang="en" data-de-theme="dev-dark">',
    '<head></head><body class="de-theme-dev-dark"><p>already themed</p></body>',
    '</html>',
  ].join('\n'),
  'no-body.html': [
    '<!DOCTYPE html>',
    '<html lang="en"><head><title>Broken</title></head><body><p>broken',
  ].join('\n'),
  '_ditaeditor/skip.html': '<html><body><p>generated asset</p></body></html>',
};

function baseEnhanceInput(outputDir: string, overrides: Record<string, unknown> = {}) {
  return {
    outputDir,
    themeId: 'tech-docs' as const,
    options: resolveThemeOptions({
      accentColor: '#7c3aed',
      siteTitle: 'Product Docs',
      footerText: '© DITAEditor',
    }),
    themesDir: THEMES_DIR,
    workspaceRoot: outputDir,
    locale: 'en' as const,
    ...overrides,
  };
}

async function readSearchIndex(outputDir: string): Promise<HtmlThemeSearchEntry[]> {
  const raw = readFileSync(path.join(outputDir, '_ditaeditor', 'search-index.js'), 'utf8');
  return JSON.parse(raw.slice(raw.indexOf('= ') + 2, raw.lastIndexOf(';'))) as HtmlThemeSearchEntry[];
}

function pageHtml(outputDir: string, relative: string): string {
  return readFileSync(path.join(outputDir, relative), 'utf8');
}

describe('Phase 12 HTML theme registry', () => {
  it('exposes the five fixed ids with tech-docs as the default', () => {
    expect(HTML_THEME_IDS).toEqual([
      'tech-docs',
      'editorial-paper',
      'enterprise-manual',
      'dev-dark',
      'vanilla',
    ]);
    expect(DEFAULT_HTML_THEME_ID).toBe('tech-docs');
    expect(listHtmlThemes('en').map((theme) => theme.id)).toEqual([...HTML_THEME_IDS]);
  });

  it('localizes names, descriptions and tags', () => {
    const en = listHtmlThemes('en');
    const zh = listHtmlThemes('zh-CN');
    expect(en[0]!.name).toBe('Tech Docs');
    expect(zh[0]!.name).toBe('技术文档');
    for (let i = 0; i < en.length; i += 1) {
      expect(en[i]!.name).not.toBe(zh[i]!.name);
      expect(zh[i]!.description.length).toBeGreaterThan(0);
      expect(en[i]!.description.length).toBeGreaterThan(0);
      expect(zh[i]!.tags.length).toBeGreaterThan(0);
      expect(zh[i]!.tags).toHaveLength(en[i]!.tags.length);
    }
    expect(en.find((theme) => theme.id === 'dev-dark')!.defaultMode).toBe('dark');
    expect(en.find((theme) => theme.id === 'vanilla')!.supportsCustomization).toBe(false);
  });

  it('looks up descriptors and validates ids', () => {
    expect(getHtmlTheme('tech-docs', 'en')?.defaultAccent).toBe('#2563eb');
    expect(getHtmlTheme('nope', 'en')).toBeNull();
    expect(isHtmlThemeId('dev-dark')).toBe(true);
    expect(isHtmlThemeId('Dev-Dark')).toBe(false);
    expect(isHtmlThemeId(null)).toBe(false);
    expect(isHtmlThemeId(42)).toBe(false);
  });

  it('keeps the 13 runtime labels in both locales', () => {
    expect(Object.keys(HTML_THEME_LABELS.en)).toHaveLength(13);
    expect(Object.keys(HTML_THEME_LABELS['zh-CN'])).toHaveLength(13);
    expect(HTML_THEME_LABELS.en.shortcutHint).toBe('Ctrl K');
    expect(HTML_THEME_LABELS['zh-CN'].onThisPage).toBe('本页目录');
  });
});

describe('Phase 12 theme options', () => {
  it('never throws on junk input and falls back to defaults', () => {
    for (const junk of [null, undefined, 'junk', 42, [], true]) {
      const options = resolveThemeOptions(junk);
      expect(options.features).toEqual({
        search: true,
        toc: true,
        codeCopy: true,
        colorModeToggle: true,
      });
      expect(options.accentColor).toBeUndefined();
      expect(options.siteTitle).toBeUndefined();
    }
  });

  it('trims text, caps lengths, drops empties and normalizes the accent', () => {
    const options = resolveThemeOptions({
      accentColor: '7C3AED',
      siteTitle: `  ${'t'.repeat(200)}  `,
      footerText: '   ',
      logoPath: '   ',
      unknownKey: 'ignored',
      features: { search: false, toc: 'yes', codeCopy: true },
    });
    expect(options.accentColor).toBe('#7c3aed');
    expect(options.siteTitle).toHaveLength(THEME_OPTION_LIMITS.siteTitle);
    expect(options.footerText).toBeUndefined();
    expect(options.logoPath).toBeUndefined();
    expect(options.features).toEqual({
      search: false,
      toc: true,
      codeCopy: true,
      colorModeToggle: true,
    });
    expect('unknownKey' in options).toBe(false);
    expect(resolveThemeOptions({ accentColor: '#zzzzzz' }).accentColor).toBeUndefined();
  });

  it('validates accents and strips unknown zod keys', () => {
    expect(isValidAccent('#2563eb')).toBe(true);
    expect(isValidAccent('2563EB')).toBe(true);
    expect(isValidAccent('#2563e')).toBe(false);
    expect(isValidAccent('red')).toBe(false);
    const parsed = htmlThemeOptionsSchema.parse({
      accentColor: '#16a34a',
      siteTitle: 'Docs',
      extra: 'stripped',
      features: { search: false },
    });
    expect(parsed).toEqual({ accentColor: '#16a34a', siteTitle: 'Docs', features: { search: false } });
  });

  it('derives accent scales with readable contrast colours', () => {
    const blue = accentScale('#2563eb');
    expect(blue.accent).toBe('#2563eb');
    expect(blue.contrast).toBe('#ffffff');
    expect(blue.hover).not.toBe(blue.accent);
    expect(blue.soft.startsWith('#')).toBe(true);

    const amber = accentScale('#facc15');
    expect(amber.contrast).toBe('#0b0f17');
    expect(amber.soft).toMatch(/^rgba\(250, 204, 21, 0\.16\)$/);

    expect(accentScale('not-a-colour').accent).toBe('#2563eb');
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(buildBrandVarsCss('tech-docs', {})).toContain('--de-accent: #2563eb;');
    expect(buildBrandVarsCss('dev-dark', {})).toContain('--de-accent: #38bdf8;');
    expect(buildBrandVarsCss('tech-docs', { accentColor: '#7c3aed' })).toContain(
      '--de-accent: #7c3aed;',
    );
  });
});

describe('Phase 12 theme asset directory resolution', () => {
  it('finds the repository html-themes assets', () => {
    expect(existsSync(path.join(THEMES_DIR, 'shared', 'theme-base.css'))).toBe(true);
    expect(resolveHtmlThemesDir(THEMES_DIR)).toBe(THEMES_DIR);
  });

  it('rejects a configured directory without the shared assets', () => {
    const empty = makeTree({ 'placeholder.txt': '' });
    expect(() => resolveHtmlThemesDir(empty)).toThrow(`html-themes assets not found: ${empty}`);
  });

  it('honours the DITAEDITOR_HTML_THEMES_DIR environment variable', () => {
    const previous = process.env.DITAEDITOR_HTML_THEMES_DIR;
    process.env.DITAEDITOR_HTML_THEMES_DIR = THEMES_DIR;
    try {
      expect(resolveHtmlThemesDir()).toBe(THEMES_DIR);
    } finally {
      if (previous === undefined) delete process.env.DITAEDITOR_HTML_THEMES_DIR;
      else process.env.DITAEDITOR_HTML_THEMES_DIR = previous;
    }
  });
});

describe('Phase 12 HTML5 enhancement', () => {
  it('copies the shared asset set and injects every page', async () => {
    const outputDir = makeTree(OUTPUT_FILES);
    const result = await enhanceHtml5Output(baseEnhanceInput(outputDir));

    expect(result.themeId).toBe('tech-docs');
    expect(result.pages).toBe(3);
    expect(result.warnings).toContain(
      `html page skipped (missing </head> or </body>): no-body.html`,
    );
    expect(result.assets).toEqual([
      '_ditaeditor/theme-base.css',
      '_ditaeditor/theme.css',
      '_ditaeditor/theme-runtime.js',
      '_ditaeditor/brand-vars.css',
      '_ditaeditor/search-index.js',
    ]);
    for (const asset of result.assets) {
      expect(existsSync(path.join(outputDir, asset))).toBe(true);
    }
    expect(pageHtml(outputDir, '_ditaeditor/skip.html')).toBe(
      '<html><body><p>generated asset</p></body></html>',
    );

    const root = pageHtml(outputDir, 'index.html');
    const arch = pageHtml(outputDir, 'concepts/arch.html');
    const nested = pageHtml(outputDir, 'concepts/deep/nested.html');
    const preThemed = pageHtml(outputDir, 'pre-themed.html');

    expect(root.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(root).toContain('<html lang="en" data-de-theme="tech-docs" data-de-root="./"');
    expect(root).toContain('data-de-mode="light"');
    expect(root).toContain('data-de-portal="true"');
    expect(root).toContain('class="theme-default de-existing de-theme-tech-docs de-portal"');
    expect(arch).toContain('data-de-root="../"');
    expect(arch).not.toMatch(/<body[^>]*\bde-portal\b/);
    expect(arch).toContain('data-de-portal="false"');
    expect(nested).toContain('data-de-root="../../"');
    expect(preThemed).toContain('data-de-theme="dev-dark"');
    expect(preThemed.match(/data-de-theme=/g)).toHaveLength(1);
  });

  it('injects head links, config, header, footer and the deferred scripts in order', async () => {
    const outputDir = makeTree(OUTPUT_FILES);
    await enhanceHtml5Output(baseEnhanceInput(outputDir));
    const html = pageHtml(outputDir, 'index.html');

    const baseLink = html.indexOf('href="./_ditaeditor/theme-base.css"');
    const themeLink = html.indexOf('href="./_ditaeditor/theme.css"');
    const brandLink = html.indexOf('href="./_ditaeditor/brand-vars.css"');
    const config = html.indexOf('window.__DITA_THEME_CONFIG__');
    expect(baseLink).toBeGreaterThan(-1);
    expect(themeLink).toBeGreaterThan(baseLink);
    expect(brandLink).toBeGreaterThan(themeLink);
    expect(config).toBeGreaterThan(brandLink);
    expect(config).toBeLessThan(html.indexOf('</head>'));

    expect(html).toMatch(/<body[^>]*>\s*<header class="de-header">/);
    expect(html).toContain('<a class="de-brand" href="./index.html">');
    expect(html).toContain('<span class="de-brand-title">Product Docs</span>');
    expect(html).toContain('class="de-kbd">Ctrl K</span>');
    expect(html).toContain('data-de="search-trigger"');
    expect(html).toContain('data-de="mode-toggle"');
    expect(html).toContain('data-de="nav-toggle"');

    expect(html).toContain('<footer class="de-footer"><p>© DITAEditor</p></footer>');
    expect(html).toContain('<div class="de-search" data-de="search" hidden></div>');
    expect(html).toContain('<div class="de-backdrop" data-de="backdrop" hidden></div>');
    const footer = html.indexOf('de-footer');
    const searchIndex = html.indexOf('src="./_ditaeditor/search-index.js"');
    const runtime = html.indexOf('src="./_ditaeditor/theme-runtime.js"');
    expect(searchIndex).toBeGreaterThan(footer);
    expect(runtime).toBeGreaterThan(searchIndex);
    expect(runtime).toBeLessThan(html.indexOf('</body>'));
    expect(html).toContain('<script defer src="./_ditaeditor/search-index.js"></script>');

    const embedded = /<script>window\.__DITA_THEME_CONFIG__ = (.*);<\/script>/.exec(html);
    expect(embedded).not.toBeNull();
    const parsed = JSON.parse(embedded![1]!) as {
      themeId: string;
      locale: string;
      siteTitle: string;
      portal: boolean;
      labels: Record<string, string>;
    };
    expect(parsed.themeId).toBe('tech-docs');
    expect(parsed.locale).toBe('en');
    expect(parsed.siteTitle).toBe('Product Docs');
    expect(parsed.portal).toBe(true);
    expect(parsed.labels.search).toBe('Search');
  });

  it('writes a sorted search index with relative hrefs and plain text', async () => {
    const outputDir = makeTree(OUTPUT_FILES);
    const result = await enhanceHtml5Output(baseEnhanceInput(outputDir));
    const entries = await readSearchIndex(outputDir);

    expect(entries).toEqual(result.searchEntries);
    const hrefs = entries.map((entry) => entry.href);
    expect(hrefs).toEqual([...hrefs].sort());
    expect(hrefs).toContain('index.html');
    expect(hrefs).toContain('concepts/arch.html');
    expect(hrefs).toContain('concepts/deep/nested.html');
    expect(hrefs.every((href) => !href.startsWith('/') && !href.startsWith('../'))).toBe(true);

    const arch = entries.find((entry) => entry.href === 'concepts/arch.html')!;
    expect(arch.title).toBe('Architecture');
    expect(arch.summary).toBe('How packages fit together.');
    expect(arch.text).toContain('Content with bold text.');

    const nested = entries.find((entry) => entry.href === 'concepts/deep/nested.html')!;
    expect(nested.title).toBe('Topic');
    expect(nested.summary).toBe('Deep nested topic summary.');

    const root = entries.find((entry) => entry.href === 'index.html')!;
    expect(root.title).toBe('Getting started');
    expect(root.summary).toBe('Install the workbench and publish your first HTML5 output.');
    expect(root.text).not.toContain('<');
  });

  it('is idempotent on a second run', async () => {
    const outputDir = makeTree(OUTPUT_FILES);
    await enhanceHtml5Output(baseEnhanceInput(outputDir));
    const before = ['index.html', 'concepts/arch.html', 'concepts/deep/nested.html'].map((relative) =>
      pageHtml(outputDir, relative),
    );

    const second = await enhanceHtml5Output(baseEnhanceInput(outputDir));
    const after = ['index.html', 'concepts/arch.html', 'concepts/deep/nested.html'].map((relative) =>
      pageHtml(outputDir, relative),
    );

    expect(second.pages).toBe(0);
    expect(after).toEqual(before);
    expect(after[0]!.match(/data-de-theme="tech-docs"/g)).toHaveLength(1);
    expect(second.assets).toContain('_ditaeditor/search-index.js');
  });

  it('escapes option text and inline JSON', async () => {
    const outputDir = makeTree({
      'index.html':
        '<!DOCTYPE html><html lang="en"><head><title>T</title></head><body><main role="main"><h1>Home</h1></main></body></html>',
    });
    const input = baseEnhanceInput(outputDir, {
      options: resolveThemeOptions({
        siteTitle: 'Docs </script> & "Q" $&',
        footerText: 'Legal </script> & more',
      }),
    });
    const result = await enhanceHtml5Output(input);
    const html = pageHtml(outputDir, 'index.html');

    expect(result.pages).toBe(1);
    expect(html).toContain('Docs &lt;/script&gt; &amp; &quot;Q&quot; $&amp;');
    expect(html).toContain('Legal &lt;/script&gt; &amp; more');
    expect(html).toContain('\\u003c/script>');
    expect(html.match(/<\/script>/g)).toHaveLength(3);

    const embedded = /<script>window\.__DITA_THEME_CONFIG__ = (.*);<\/script>/.exec(html);
    const parsed = JSON.parse(embedded![1]!) as { siteTitle: string };
    expect(parsed.siteTitle).toBe('Docs </script> & "Q" $&');
    expect(escapeHtmlText('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;');
    expect(serializeInlineJson({ a: '</script>', b: '\u2028' })).toBe(
      '{"a":"\\u003c/script>","b":"\\u2028"}',
    );
  });

  it('copies a workspace logo and custom css', async () => {
    const outputDir = makeTree({
      'index.html':
        '<!DOCTYPE html><html lang="en"><head><title>T</title></head><body><main role="main"><h1>Home</h1></main></body></html>',
    });
    const workspaceRoot = makeTree({
      'assets/brand.css': 'body { letter-spacing: 0; }',
      'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    });
    const result = await enhanceHtml5Output(
      baseEnhanceInput(outputDir, {
        workspaceRoot,
        options: resolveThemeOptions({
          siteTitle: 'Brand',
          logoPath: 'assets/logo.svg',
          customCssPath: 'assets/brand.css',
        }),
      }),
    );
    const html = pageHtml(outputDir, 'index.html');

    expect(result.logo).toBe('_ditaeditor/logo.svg');
    expect(result.customCss).toBe('_ditaeditor/custom.css');
    expect(result.assets).toContain('_ditaeditor/logo.svg');
    expect(result.assets).toContain('_ditaeditor/custom.css');
    expect(html).toContain('<img class="de-logo" src="./_ditaeditor/logo.svg" alt="">');
    expect(html).toContain('href="./_ditaeditor/custom.css"');
    expect(html.indexOf('brand-vars.css')).toBeLessThan(html.indexOf('custom.css'));
    expect(readFileSync(path.join(outputDir, '_ditaeditor', 'custom.css'), 'utf8')).toBe(
      'body { letter-spacing: 0; }',
    );
  });

  it('rejects traversal and missing customization files with warnings', async () => {
    const outputDir = makeTree({
      'index.html':
        '<!DOCTYPE html><html lang="en"><head><title>T</title></head><body><main role="main"><h1>Home</h1></main></body></html>',
    });
    const result = await enhanceHtml5Output(
      baseEnhanceInput(outputDir, {
        options: resolveThemeOptions({
          logoPath: '../outside.png',
          customCssPath: 'assets/missing.css',
        }),
        workspaceRoot: outputDir,
      }),
    );

    expect(result.logo).toBeNull();
    expect(result.customCss).toBeNull();
    expect(result.warnings.some((message) => message.includes('theme logo skipped'))).toBe(true);
    expect(result.warnings.some((message) => message.includes('custom css skipped'))).toBe(true);
    expect(pageHtml(outputDir, 'index.html')).not.toContain('de-logo');
  });

  it('still copies assets when every page is already themed', async () => {
    const outputDir = makeTree({
      'index.html':
        '<!DOCTYPE html><html data-de-theme="dev-dark"><head></head><body class="de-theme-dev-dark"><p>x</p></body></html>',
    });
    const result = await enhanceHtml5Output(baseEnhanceInput(outputDir, { themeId: 'dev-dark' }));

    expect(result.pages).toBe(0);
    expect(result.assets).toEqual([
      '_ditaeditor/theme-base.css',
      '_ditaeditor/theme.css',
      '_ditaeditor/theme-runtime.js',
      '_ditaeditor/brand-vars.css',
      '_ditaeditor/search-index.js',
    ]);
    expect(await readSearchIndex(outputDir)).toHaveLength(0);
  });

  it('does nothing for the vanilla theme', async () => {
    const outputDir = makeTree(OUTPUT_FILES);
    const before = pageHtml(outputDir, 'index.html');
    const result = await enhanceHtml5Output(baseEnhanceInput(outputDir, { themeId: 'vanilla' }));

    expect(result.pages).toBe(0);
    expect(result.assets).toEqual([]);
    expect(result.searchEntries).toEqual([]);
    expect(pageHtml(outputDir, 'index.html')).toBe(before);
    expect(readdirSync(path.join(outputDir, '_ditaeditor'))).toEqual(['skip.html']);
  });

  it('warns about missing theme assets but still injects pages', async () => {
    const outputDir = makeTree({
      'index.html':
        '<!DOCTYPE html><html lang="en"><head><title>T</title></head><body><main role="main"><h1>Home</h1></main></body></html>',
    });
    const partialThemesDir = makeTree({
      'shared/theme-base.css': ':root[data-de-theme] { --de-accent: #2563eb; }',
    });
    const result = await enhanceHtml5Output(
      baseEnhanceInput(outputDir, { themesDir: partialThemesDir, options: resolveThemeOptions({}) }),
    );

    expect(result.pages).toBe(1);
    expect(result.warnings.some((message) => message.includes('theme.css'))).toBe(true);
    expect(result.warnings.some((message) => message.includes('theme-runtime.js'))).toBe(true);
    expect(result.assets).toEqual([
      '_ditaeditor/theme-base.css',
      '_ditaeditor/brand-vars.css',
      '_ditaeditor/search-index.js',
    ]);
    expect(pageHtml(outputDir, 'index.html')).toContain('data-de-theme="tech-docs"');
  });
});

describe('Phase 12 theme preview', () => {
  it('inlines stylesheets, runtime, config and the sample document', async () => {
    const html = await renderHtmlThemePreview({
      themeId: 'tech-docs',
      options: resolveThemeOptions({
        accentColor: '#16a34a',
        siteTitle: '<Preview> & "test"',
        footerText: 'Footer </script>',
      }),
      themesDir: THEMES_DIR,
      locale: 'en',
    });

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('data-de-theme="tech-docs"');
    expect(html).toContain('data-de-root="./"');
    expect(html).toContain('DITAEditor theme: tech-docs');
    expect(html).toContain('--de-accent: #16a34a;');
    expect(html).toContain('window.__DITA_THEME_CONFIG__');
    expect(html).toContain('window.__DITA_SEARCH_INDEX__');
    expect(html).toContain('function boot()');
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).not.toContain('_ditaeditor/');

    expect(html).toContain('&lt;Preview&gt; &amp; &quot;test&quot;');
    expect(html).not.toContain('<Preview>');
    expect(html).toContain('Footer &lt;/script&gt;');

    expect(html).toContain('<nav class="toc"');
    expect(html.match(/<li><a href=/g)?.length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('class="shortdesc"');
    expect(html).toContain('class="note tip"');
    expect(html).toContain('class="note warning"');
    expect(html).toContain('<ol class="steps">');
    expect(html).toContain('class="cmd"');
    expect(html).toContain('class="stepresult"');
    expect(html).toContain('class="codeph"');
    expect(html).toContain('class="filepath"');
    expect(html).toContain('class="uicontrol"');
    expect(html).toContain('class="menucascade"');
    expect(html).toContain('class="table"');
    expect(html).toContain('colspan="2"');
    expect(html).toContain('<dl>');
    expect(html).toContain('<figure class="fig"');
    expect(html).toContain('<svg ');
    expect(html).toContain('class="related-links"');
    expect(html).toContain('class="de-pager"');
    expect(html).toContain('class="de-search" data-de="search"');
    expect(html).toContain('class="de-backdrop" data-de="backdrop"');
  });

  it('emits no external requests and escapes inline JSON', async () => {
    const html = await renderHtmlThemePreview({
      themeId: 'dev-dark',
      options: resolveThemeOptions({ siteTitle: 'A </script> B' }),
      themesDir: THEMES_DIR,
      locale: 'en',
    });
    expect(html).not.toMatch(/(?:href|src)=["']https?:/i);
    expect(html).not.toMatch(/url\(\s*["']?https?:/i);
    expect(html).toContain('data-de-mode="dark"');
    expect(html.match(/<\/script>/g)).toHaveLength(3);
    const embedded = /<script>window\.__DITA_THEME_CONFIG__ = (.*);<\/script>/.exec(html);
    const parsed = JSON.parse(embedded![1]!) as { siteTitle: string; defaultMode: string };
    expect(parsed.siteTitle).toBe('A </script> B');
    expect(parsed.defaultMode).toBe('dark');
  });

  it('uses the requested locale labels', async () => {
    const html = await renderHtmlThemePreview({
      themeId: 'editorial-paper',
      options: resolveThemeOptions({}),
      themesDir: THEMES_DIR,
      locale: 'zh-CN',
    });
    expect(html).toContain('"searchPlaceholder":"搜索本手册内容"');
    expect(html).toContain('"onThisPage":"本页目录"');
    expect(html).toContain('lang="zh-CN"');
  });

  it('throws a typed error for unknown theme ids', async () => {
    await expect(
      renderHtmlThemePreview({
        themeId: 'does-not-exist',
        options: resolveThemeOptions({}),
        themesDir: THEMES_DIR,
        locale: 'en',
      }),
    ).rejects.toBeInstanceOf(HtmlThemePreviewError);
    try {
      await renderHtmlThemePreview({
        themeId: 'nope',
        options: {},
        themesDir: THEMES_DIR,
        locale: 'en',
      });
    } catch (error) {
      expect((error as HtmlThemePreviewError).code).toBe('theme-not-found');
    }
  });
});
