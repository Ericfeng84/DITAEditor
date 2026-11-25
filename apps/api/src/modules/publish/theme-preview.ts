import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApiLocale } from '../../i18n/locale.js';
import {
  DEFAULT_HTML_FEATURES,
  getHtmlTheme,
  HTML_THEME_LABELS,
  isHtmlThemeId,
  resolveThemeOptions,
  type HtmlThemeId,
  type HtmlThemeFeatures,
  type HtmlThemeLabels,
  type HtmlThemeOptions,
} from './html-themes.js';
import { buildBrandVarsCss, escapeHtmlText, serializeInlineJson } from './theme-enhancer.js';

/**
 * Phase 12: self-contained theme preview.
 *
 * The web workbench renders this document inside a sandboxed `<iframe srcDoc>`.
 * Every stylesheet and script is inlined and every href is relative, so the
 * preview needs no network access and no `_ditaeditor` files on disk.
 */

export interface HtmlThemePreviewInput {
  themeId: string;
  options: HtmlThemeOptions;
  themesDir: string;
  locale: ApiLocale;
}

/** Typed failure so the route layer can map an unknown theme to HTTP 404. */
export class HtmlThemePreviewError extends Error {
  readonly code = 'theme-not-found';
  readonly themeId: string;

  constructor(themeId: string) {
    super(`html theme not found: ${themeId}`);
    this.name = 'HtmlThemePreviewError';
    this.themeId = themeId;
  }
}

const SAMPLE_SEARCH_ENTRIES = [
  {
    href: 'index.html',
    title: 'Documentation home',
    summary: 'Start here for the documentation set.',
    text: 'Documentation home Start here for the documentation set. Overview concepts tasks reference.',
  },
  {
    href: 'concepts/architecture.html',
    title: 'Architecture overview',
    summary: 'How the editor, API and DITA-OT runtime fit together.',
    text: 'Architecture overview How the editor, API and DITA-OT runtime fit together. ProseMirror XML API.',
  },
  {
    href: 'concepts/parser.html',
    title: 'XML parser',
    summary: 'Position-tracking parser built on slimdom.',
    text: 'XML parser Position-tracking parser built on slimdom. Source positions comments processing instructions.',
  },
  {
    href: 'concepts/serializer.html',
    title: 'Deterministic serializer',
    summary: 'Lossless round-trip and minimal Git diffs.',
    text: 'Deterministic serializer Lossless round-trip and minimal Git diffs. attributes order whitespace.',
  },
  {
    href: 'tasks/deploy.html',
    title: 'Deploy the workbench',
    summary: 'Install dependencies, configure the API and publish HTML5 output.',
    text: 'Deploy the workbench Install dependencies, configure the API and publish HTML5 output. Docker desktop.',
  },
  {
    href: 'tasks/docker.html',
    title: 'Run with Docker',
    summary: 'Build the single container image with DITA-OT and Noto CJK.',
    text: 'Run with Docker Build the single container image with DITA-OT and Noto CJK. Node JRE.',
  },
  {
    href: 'tasks/desktop.html',
    title: 'Desktop build',
    summary: 'Package the Electron shell for offline authoring.',
    text: 'Desktop build Package the Electron shell for offline authoring. Windows macOS Linux.',
  },
  {
    href: 'reference/api.html',
    title: 'API reference',
    summary: 'REST endpoints for projects, locks, publishing and AI.',
    text: 'API reference REST endpoints for projects, locks, publishing and AI. Fastify Zod SQLite.',
  },
] as const;

function sampleContent(locale: ApiLocale): string {
  const labels = HTML_THEME_LABELS[locale];
  return [
    '<article class="topic">',
    '<h1 class="topictitle1">Deploy the workbench</h1>',
    '<p class="shortdesc">Install dependencies, configure the API and publish a documentation set with the selected HTML5 theme.</p>',
    '<section>',
    '<h2 id="preview-before">Before you begin</h2>',
    '<p>The preview uses the same stylesheet and runtime as the published output, so spacing, tables and callouts stay identical.</p>',
    '<div class="note tip"><span class="notetitle">Tip:</span> Run <code class="codeph">pnpm -r build</code> once before starting the workbench.</div>',
    '<div class="note warning"><span class="notetitle">Warning:</span> Publishing replaces the existing output folder; lock the topic before editing.</div>',
    '</section>',
    '<section>',
    '<h2 id="preview-steps">Deployment steps</h2>',
    '<h3 id="preview-step-1">Prepare the environment</h3>',
    '<ol class="steps">',
    '<li class="step"><span class="cmd">pnpm install</span><div class="info">Installs workspace dependencies from the lockfile.</div>',
    '<div class="stepresult">Every package links into the workspace.</div></li>',
    '<li class="step"><span class="cmd">pnpm --filter @dita/api dev</span><div class="info">Starts Fastify on port 3001.</div>',
    '<div class="stepresult">The health endpoint answers with <code class="codeph">{"status":"ok"}</code>.</div></li>',
    '</ol>',
    '<pre class="codeblock"><code>pnpm publish --theme tech-docs --locale en\nopen output/index.html</code></pre>',
    '<p>Edit <span class="filepath">apps/api/src/modules/publish/routes.ts</span>, then choose <span class="menucascade"><span class="uicontrol">File</span> &gt; <span class="uicontrol">Publish</span> &gt; <span class="uicontrol">HTML5</span></span>.</p>',
    '</section>',
    '<section>',
    '<h2 id="preview-reference">Configuration reference</h2>',
    '<table class="table">',
    '<caption>Publish options used by this preview</caption>',
    '<thead><tr><th scope="col">Option</th><th scope="col">Default</th><th scope="col">Notes</th></tr></thead>',
    '<tbody>',
    '<tr><td>theme</td><td>tech-docs</td><td>Selected HTML5 theme.</td></tr>',
    '<tr><td colspan="2">Accent colour</td><td>Derived hover, soft and contrast tokens.</td></tr>',
    '</tbody>',
    '</table>',
    '<dl><dt>Site title</dt><dd>Shown in the header, the browser tab and the search panel.</dd>',
    '<dt>Footer</dt><dd>Optional copyright or legal line.</dd></dl>',
    '<ul><li>Offline search index</li><li>Color mode toggle</li><li>Copy buttons on code blocks</li></ul>',
    '<figure class="fig"><svg viewBox="0 0 240 96" width="240" height="96" role="img" aria-label="Publish pipeline diagram">',
    '<rect x="4" y="28" width="72" height="40" rx="8" fill="var(--de-accent-soft)" stroke="var(--de-accent)"></rect>',
    '<text x="40" y="53" text-anchor="middle" font-size="13" fill="var(--de-text)">DITA XML</text>',
    '<line x1="80" y1="48" x2="152" y2="48" stroke="var(--de-accent)" stroke-width="3"></line>',
    '<rect x="156" y="28" width="80" height="40" rx="8" fill="var(--de-accent)"></rect>',
    '<text x="196" y="53" text-anchor="middle" font-size="13" fill="var(--de-accent-contrast)">HTML5</text>',
    '</svg>',
    '<figcaption class="figcap">Figure 1. Publishing pipeline.</figcaption></figure>',
    '<div class="related-links"><h2>Related links</h2><ul class="ullinks">',
    '<li><a href="concepts/architecture.html">Architecture overview</a></li>',
    '<li><a href="reference/api.html">API reference</a></li>',
    '</ul></div>',
    '</section>',
    '</article>',
    `<nav class="de-pager" aria-label="${escapeHtmlText(labels.menu)}">`,
    `<a class="de-pager-link de-pager-prev" href="concepts/serializer.html"><span class="de-pager-label">${escapeHtmlText(labels.prev)}</span><span class="de-pager-title">Deterministic serializer</span></a>`,
    `<a class="de-pager-link de-pager-next" href="reference/api.html"><span class="de-pager-label">${escapeHtmlText(labels.next)}</span><span class="de-pager-title">API reference</span></a>`,
    '</nav>',
  ].join('\n');
}

function sampleToc(labels: HtmlThemeLabels): string {
  return [
    `<nav class="toc" aria-label="${escapeHtmlText(labels.menu)}">`,
    '<ul>',
    '<li><a href="index.html">Documentation home</a></li>',
    '<li><a href="concepts/architecture.html">Architecture overview</a>',
    '<ul>',
    '<li><a href="concepts/parser.html">XML parser</a></li>',
    '<li><a href="concepts/serializer.html">Deterministic serializer</a></li>',
    '</ul></li>',
    '<li><a href="tasks/deploy.html">Deploy the workbench</a>',
    '<ul>',
    '<li><a href="tasks/docker.html">Run with Docker</a></li>',
    '<li><a href="tasks/desktop.html">Desktop build</a></li>',
    '</ul></li>',
    '<li><a href="reference/api.html">API reference</a></li>',
    '</ul>',
    '</nav>',
  ].join('\n');
}

function headerMarkup(siteTitle: string, labels: HtmlThemeLabels): string {
  return [
    '<header class="de-header">',
    '<a class="de-brand" href="index.html"><span class="de-brand-title">',
    escapeHtmlText(siteTitle),
    '</span></a>',
    '<div class="de-header-actions">',
    '<button class="de-icon-btn de-search-trigger" type="button" data-de="search-trigger">',
    `<span class="de-kbd">${escapeHtmlText(labels.shortcutHint)}</span>`,
    '</button>',
    '<button class="de-icon-btn de-mode-toggle" type="button" data-de="mode-toggle"></button>',
    '</div>',
    '<button class="de-icon-btn de-nav-toggle" type="button" data-de="nav-toggle"></button>',
    '</header>',
  ].join('');
}

async function readOptional(path: string): Promise<string> {
  return existsSync(path) ? readFile(path, 'utf8') : '';
}

export async function renderHtmlThemePreview(input: HtmlThemePreviewInput): Promise<string> {
  const themeId: HtmlThemeId | null = isHtmlThemeId(input.themeId) ? input.themeId : null;
  if (!themeId) throw new HtmlThemePreviewError(input.themeId);
  const descriptor = getHtmlTheme(themeId, input.locale);
  if (!descriptor) throw new HtmlThemePreviewError(input.themeId);

  const options = resolveThemeOptions(input.options);
  const labels = HTML_THEME_LABELS[input.locale];
  const siteTitle = options.siteTitle ?? descriptor.name;
  const footerText = options.footerText ?? '';
  const features: HtmlThemeFeatures = { ...DEFAULT_HTML_FEATURES, ...options.features };

  const baseCss = await readOptional(join(input.themesDir, 'shared', 'theme-base.css'));
  const themeCss = await readOptional(join(input.themesDir, themeId, 'theme.css'));
  const runtime = await readOptional(join(input.themesDir, 'shared', 'theme-runtime.js'));
  const brandVars = buildBrandVarsCss(themeId, options);
  const config = {
    themeId,
    locale: input.locale,
    siteTitle,
    defaultMode: descriptor.defaultMode,
    portal: false,
    features,
    labels,
  };

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtmlText(input.locale)}" data-de-theme="${themeId}" data-de-root="./" data-de-mode="${descriptor.defaultMode}" data-de-portal="false">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtmlText(siteTitle)}</title>`,
    `<style>${baseCss}</style>`,
    `<style>${themeCss}</style>`,
    `<style>${brandVars}</style>`,
    `<script>window.__DITA_THEME_CONFIG__ = ${serializeInlineJson(config)};</script>`,
    `<script>window.__DITA_SEARCH_INDEX__ = ${serializeInlineJson(SAMPLE_SEARCH_ENTRIES)};</script>`,
    '</head>',
    `<body class="de-theme-${themeId}">`,
    headerMarkup(siteTitle, labels),
    '<main role="main" class="de-main">',
    sampleContent(input.locale),
    '</main>',
    sampleToc(labels),
    `<footer class="de-footer"><p>${escapeHtmlText(footerText)}</p></footer>`,
    '<div class="de-search" data-de="search" hidden></div>',
    '<div class="de-backdrop" data-de="backdrop" hidden></div>',
    `<script>${runtime}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
