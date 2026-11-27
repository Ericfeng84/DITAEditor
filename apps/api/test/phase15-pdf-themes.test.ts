import { execFile } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type CreateServerOptions } from '../src/index.js';
import { resetDitaRuntimeCache } from '../src/modules/dita-ot/dita-runtime.js';
import { preparePdfCustomizationDir } from '../src/modules/publish/pdf-customization.js';
import { renderPdfThemePreview } from '../src/modules/publish/pdf-theme-preview.js';
import {
  PDF_THEME_IDS,
  getPdfTheme,
  listPdfThemes,
  resolvePdfTheme,
  resolvePdfThemeOptions,
} from '../src/modules/publish/pdf-themes.js';
import { mergePdfThemeOptions } from '../src/modules/publish/publish-profiles.js';

const execFileAsync = promisify(execFile);

const tempDirs: string[] = [];
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };
const EN = { ...WRITER, 'x-dita-locale': 'en' };
const ADMIN = { 'x-dita-user-id': 'u-admin' };

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const PDF_THEMES_DIR = path.resolve(__dirname, '../../../dita-ot-plugins/pdf-themes');
const PLUGIN_DIR = path.resolve(__dirname, '../../../dita-ot-plugins/com.ditaeditor.pdf-cjk');
const ROOT_MAP = 'product-manual.ditamap';
const LOCAL_DITA = '/Users/fengkang/.local/share/dita-ot/bin/dita';

const FAKE_DITA = `#!/usr/bin/env bash
set -u
if [ "\${1:-}" = "--version" ]; then
  echo "DITA-OT 4.2.1"
  exit 0
fi
input=""
format="html5"
output=""
customization=""
for arg in "$@"; do
  case "$arg" in
    --input=*) input="\${arg#--input=}" ;;
    --format=*) format="\${arg#--format=}" ;;
    --output=*) output="\${arg#--output=}" ;;
    --customization.dir=*) customization="\${arg#--customization.dir=}" ;;
  esac
done
echo "fake-dita: input=$input format=$format customization=$customization"
mkdir -p "$output"
if [ "$format" = "pdf" ]; then
  printf '%%PDF-1.4\\nfake pdf\\n' > "$output/manual.pdf"
else
  printf '<!doctype html>\\n<html lang="en"><head><meta charset="utf-8"><title>Manual</title></head><body><main role="main"><h1>Manual</h1></main></body></html>\\n' > "$output/index.html"
fi
exit 0
`;

/** 1x1 transparent PNG (enough for the extension + size validation). */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+4xQkAAAAAElFTkSuQmCC',
  'base64',
);

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase15-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  const fakeDita = path.join(root, 'fake-dita.sh');
  writeFileSync(fakeDita, FAKE_DITA, 'utf8');
  chmodSync(fakeDita, 0o755);
  const jobDir = path.join(root, 'job');
  mkdirSync(jobDir, { recursive: true });
  return {
    root,
    projectDir,
    jobDir,
    fakeDita,
    dbPath: path.join(root, 'phase15.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
    importsDir: path.join(root, 'imports'),
  };
}

type Fixture = ReturnType<typeof createFixture>;

function createApp(fixture: Fixture, overrides: Partial<CreateServerOptions> = {}) {
  resetDitaRuntimeCache();
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    publishRootDir: fixture.publishRootDir,
    publishConcurrency: 1,
    pdfThemesDir: PDF_THEMES_DIR,
    ditaRuntime: { command: fixture.fakeDita, pluginDir: PLUGIN_DIR },
    logger: false,
    ...overrides,
  });
}

type TestApp = ReturnType<typeof createApp>;

interface PdfJobJson {
  id: string;
  status: string;
  error: string | null;
  themeId: string | null;
  themeOptions: unknown;
  pdfThemeId: string | null;
  pdfThemeOptions: { accentColor?: string; features?: Record<string, boolean> } | null;
}

async function waitForJob(
  app: TestApp,
  id: string,
  headers: Record<string, string>,
  timeoutMs = 10_000,
): Promise<PdfJobJson> {
  const deadline = Date.now() + timeoutMs;
  let last: PdfJobJson | null = null;
  while (Date.now() < deadline) {
    const response = await app.inject({ method: 'GET', url: `/api/publish/jobs/${id}`, headers });
    if (response.statusCode !== 200) throw new Error(response.body);
    last = response.json().job as PdfJobJson;
    if (['succeeded', 'failed', 'cancelled'].includes(last.status)) return last;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
  }
  throw new Error(`job did not finish: ${JSON.stringify(last)}`);
}

async function builtinManualId(app: TestApp): Promise<string> {
  const list = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
  expect(list.statusCode).toBe(200);
  return list.json().manuals[0].id as string;
}

afterEach(() => {
  resetDitaRuntimeCache();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 15 PDF theme registry', () => {
  it('exposes five localized descriptors with paper defaults', () => {
    expect(listPdfThemes('en').map((theme) => theme.id)).toEqual([...PDF_THEME_IDS]);
    expect(getPdfTheme('zh-CN', 'tech-manual')?.name).toBe('技术手册');
    expect(getPdfTheme('en', 'enterprise-spec')).toMatchObject({
      id: 'enterprise-spec',
      name: 'Enterprise Spec',
      defaultPageSize: 'A4',
      supportsCustomization: true,
    });
    expect(getPdfTheme('en', 'editorial-book')?.defaultFeatures).toMatchObject({
      showCover: true,
      chapterNumbers: true,
      mirrorMargins: true,
    });
    expect(getPdfTheme('en', 'compact-guide')?.defaultFeatures.mirrorMargins).toBe(true);
    expect(getPdfTheme('en', 'vanilla')).toMatchObject({
      supportsCustomization: false,
      coverStyle: 'vanilla',
      // vanilla keeps DITA-OT's own cover/TOC; only the theme-specific features are off.
      defaultFeatures: { showCover: true, showToc: true, chapterNumbers: false },
    });
    expect(getPdfTheme('en', 'nope')).toBeUndefined();
  });

  it('sanitizes untrusted option payloads and keeps theme defaults', () => {
    const fallback = resolvePdfThemeOptions('tech-manual', 'nonsense');
    // Feature flags are always materialized from the theme defaults so callers never have to
    // re-implement "unset means the theme decides".
    expect(fallback).toEqual({
      features: {
        showCover: true,
        showToc: true,
        chapterNumbers: false,
        taskLabels: true,
        mirrorMargins: false,
      },
    });

    const sanitized = resolvePdfThemeOptions('tech-manual', {
      accentColor: 'B45309',
      pageSize: 'A3',
      fontFamily: 'mono',
      fontSize: '10pt',
      margins: 'wide',
      coverSubtitle: '   ',
      headerText: 'H'.repeat(200),
      footerText: 'Internal',
      logoPath: 42,
      features: { showCover: 'yes', chapterNumbers: true, mirrorMargins: false },
    });
    expect(sanitized).toMatchObject({
      accentColor: '#b45309',
      fontSize: '10pt',
      margins: 'wide',
      footerText: 'Internal',
      features: { chapterNumbers: true },
    });
    expect(sanitized.pageSize).toBeUndefined();
    expect(sanitized.fontFamily).toBeUndefined();
    expect(sanitized.coverSubtitle).toBeUndefined();
    expect(sanitized.logoPath).toBeUndefined();
    expect(sanitized.headerText?.length).toBe(120);

    const resolved = resolvePdfTheme('editorial-book', {});
    expect(resolved).toMatchObject({
      fontFamily: 'serif',
      fontKey: 'serif',
      fontSize: '11pt',
      margins: 'wide',
      pageSize: 'A4',
    });
    expect(resolved.features.mirrorMargins).toBe(true);
  });

  it('merges stored PDF options with request overrides', () => {
    const merged = mergePdfThemeOptions(
      'tech-manual',
      { accentColor: '#0ea5e9', pageSize: 'B5', features: { showToc: false } },
      { fontSize: '9pt', features: { chapterNumbers: true } },
    );
    expect(merged).toMatchObject({
      accentColor: '#0ea5e9',
      pageSize: 'B5',
      fontSize: '9pt',
      features: { showToc: false, chapterNumbers: true },
    });
  });
});

describe('Phase 15 PDF customization directory', () => {
  it('returns the plugin directory unchanged for the vanilla theme', async () => {
    const fixture = createFixture();
    const result = await preparePdfCustomizationDir({
      jobDir: fixture.jobDir,
      snapshotDir: fixture.projectDir,
      themeId: 'vanilla',
      themeOptions: { accentColor: '#123456', features: { taskLabels: true } },
      themesDir: PDF_THEMES_DIR,
      pluginDir: PLUGIN_DIR,
    });
    expect(result.customizationDir).toBe(PLUGIN_DIR);
    expect(result.extraDitaArgs).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(existsSync(path.join(fixture.jobDir, 'customization'))).toBe(false);
  });

  it('stages catalog, CJK font mappings and well-formed XSLT for a theme', async () => {
    const fixture = createFixture();
    const result = await preparePdfCustomizationDir({
      jobDir: fixture.jobDir,
      snapshotDir: fixture.projectDir,
      themeId: 'enterprise-spec',
      themeOptions: {
        accentColor: '#0f2942',
        pageSize: 'B5',
        fontFamily: 'serif',
        fontSize: '11pt',
        margins: 'wide',
        coverSubtitle: 'Release <2026>',
        headerText: 'Acme Docs',
        footerText: 'Internal use',
        features: { taskLabels: true, mirrorMargins: true, showCover: true },
      },
      themesDir: PDF_THEMES_DIR,
      pluginDir: PLUGIN_DIR,
    });
    expect(result.customizationDir).toBe(path.join(fixture.jobDir, 'customization'));
    expect(result.extraDitaArgs).toEqual(['--args.gen.task.lbl=YES']);
    expect(result.warnings).toEqual([]);

    const customization = result.customizationDir;
    const catalog = readFileSync(path.join(customization, 'catalog.xml'), 'utf8');
    expect(catalog).toContain('cfg:fo/font-mappings.xml');
    expect(catalog).toContain('cfg:fo/attrs/custom.xsl');
    expect(catalog).toContain('cfg:fo/xsl/custom.xsl');

    // CJK mappings must survive every theme.
    const fontMappings = readFileSync(
      path.join(customization, 'cfg', 'fo', 'font-mappings.xml'),
      'utf8',
    );
    expect(fontMappings).toContain('font-mappings');
    expect(fontMappings).toBe(
      readFileSync(path.join(PLUGIN_DIR, 'cfg', 'fo', 'font-mappings.xml'), 'utf8'),
    );

    const attrs = readFileSync(path.join(customization, 'fo', 'attrs', 'custom.xsl'), 'utf8');
    expect(attrs).toContain('shared/attrs-base.xsl');
    expect(attrs).toContain('enterprise-spec/attrs.xsl');
    expect(attrs).toContain('theme-vars.xsl');

    const xsl = readFileSync(path.join(customization, 'fo', 'xsl', 'custom.xsl'), 'utf8');
    expect(xsl).toContain('<xsl:import');
    expect(xsl).toContain('<xsl:include');
    expect(xsl).toContain('shared/xsl-base.xsl');

    const vars = readFileSync(path.join(customization, 'fo', 'attrs', 'theme-vars.xsl'), 'utf8');
    expect(vars).toContain('name="de-page-width" select="\'176mm\'"');
    expect(vars).toContain('name="de-font-family" select="\'Serif\'"');
    expect(vars).toContain('name="de-font-size" select="\'11pt\'"');
    expect(vars).toContain('name="de-mirror-margins" select="true()"');
    expect(vars).toContain('name="de-accent" select="\'#0f2942\'"');
    expect(vars).toContain("name=\"de-cover-subtitle\" select=\"'Release &lt;2026&gt;'\"");
    expect(vars).toContain('name="de-logo-uri" select="\'\'"');
  });

  it('stages a valid logo and warns instead of failing for bad ones', async () => {
    const fixture = createFixture();
    const assetDir = path.join(fixture.projectDir, 'assets');
    mkdirSync(assetDir, { recursive: true });
    writeFileSync(path.join(assetDir, 'logo.png'), PNG_BYTES);
    writeFileSync(path.join(assetDir, 'logo.webp'), PNG_BYTES);
    writeFileSync(path.join(assetDir, 'big.png'), Buffer.alloc(2 * 1024 * 1024 + 1));
    mkdirSync(path.join(fixture.root, 'outside.png'), { recursive: true });

    const base = {
      jobDir: fixture.jobDir,
      snapshotDir: fixture.projectDir,
      themeId: 'tech-manual' as const,
      themesDir: PDF_THEMES_DIR,
      pluginDir: PLUGIN_DIR,
    };

    const withLogo = await preparePdfCustomizationDir({
      ...base,
      themeOptions: { logoPath: 'assets/logo.png' },
    });
    expect(withLogo.warnings).toEqual([]);
    const staged = path.join(withLogo.customizationDir, 'common', 'artwork', 'logo.png');
    expect(existsSync(staged)).toBe(true);
    expect(readFileSync(path.join(withLogo.customizationDir, 'fo', 'attrs', 'theme-vars.xsl'), 'utf8'))
      .toContain('logo.png');

    const webp = await preparePdfCustomizationDir({
      ...base,
      jobDir: path.join(fixture.root, 'job-webp'),
      themeOptions: { logoPath: 'assets/logo.webp' },
    });
    expect(webp.warnings.join('\n')).toContain('unsupported file type');

    const big = await preparePdfCustomizationDir({
      ...base,
      jobDir: path.join(fixture.root, 'job-big'),
      themeOptions: { logoPath: 'assets/big.png' },
    });
    expect(big.warnings.join('\n')).toContain('larger than 2048 KB');

    const escaping = await preparePdfCustomizationDir({
      ...base,
      jobDir: path.join(fixture.root, 'job-escape'),
      themeOptions: { logoPath: '../outside.png' },
    });
    expect(escaping.warnings.join('\n')).toContain('escapes the project workspace');

    const missing = await preparePdfCustomizationDir({
      ...base,
      jobDir: path.join(fixture.root, 'job-missing'),
      themeOptions: { logoPath: 'assets/missing.png' },
    });
    expect(missing.warnings.join('\n')).toContain('file not found');
  });

  it('fails with a localized error when the theme assets are missing', async () => {
    const fixture = createFixture();
    await expect(
      preparePdfCustomizationDir({
        jobDir: fixture.jobDir,
        snapshotDir: fixture.projectDir,
        themeId: 'tech-manual',
        themeOptions: {},
        themesDir: path.join(fixture.root, 'no-themes'),
        pluginDir: PLUGIN_DIR,
      }),
    ).rejects.toThrow(/PDF 主题资源/);
  });
});

describe('Phase 15 PDF theme preview', () => {
  it('renders paper geometry, accent and feature toggles', () => {
    const html = renderPdfThemePreview({
      themeId: 'compact-guide',
      options: {
        accentColor: '#2563eb',
        pageSize: 'B5',
        fontFamily: 'serif',
        fontSize: '9pt',
        margins: 'compact',
        headerText: 'Acme',
        features: { showCover: false, mirrorMargins: true },
      },
      locale: 'en',
    });
    expect(html).toContain('width:176mm');
    expect(html).toContain('height:250mm');
    expect(html).toContain('#2563eb');
    expect(html).toContain('Noto Serif CJK SC');
    expect(html).toContain('font-size:9pt');
    expect(html).toContain('Acme');
    // showCover: false -> no cover section
    expect(html).not.toContain('class="cover');
    expect(html).toContain('class="toc-page"');
  });

  it('escapes user supplied text', () => {
    const html = renderPdfThemePreview({
      themeId: 'tech-manual',
      options: { coverSubtitle: '<script>alert(1)</script>', headerText: '"&<>' },
      locale: 'zh-CN',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('rejects unknown themes', () => {
    expect(() =>
      renderPdfThemePreview({ themeId: 'nope', options: {}, locale: 'en' }),
    ).toThrow(/pdf theme not found/);
  });
});

describe('Phase 15 PDF theme routes', () => {
  it('serves localized descriptors with locale-aware caching', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const zh = await app.inject({ method: 'GET', url: '/api/publish/pdf-themes', headers: WRITER });
      expect(zh.statusCode).toBe(200);
      expect(zh.headers['cache-control']).toBe('no-cache');
      expect(String(zh.headers['vary'])).toContain('x-dita-locale');
      const themes = zh.json().themes as Array<{ id: string; name: string }>;
      expect(themes.map((theme) => theme.id)).toEqual([...PDF_THEME_IDS]);
      expect(themes[0]?.name).toBe('技术手册');

      const en = await app.inject({ method: 'GET', url: '/api/publish/pdf-themes', headers: EN });
      expect(en.json().themes[1]?.name).toBe('Enterprise Spec');

      // Viewers may browse themes.
      const viewer = await app.inject({
        method: 'GET',
        url: '/api/publish/pdf-themes',
        headers: VIEWER,
      });
      expect(viewer.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('renders previews and rejects unknown ids and malformed accents', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const preview = await app.inject({
        method: 'GET',
        url: '/api/publish/pdf-themes/editorial-book/preview?accent=9a3412&pageSize=Letter&fontFamily=serif&fontSize=11pt&margins=wide&coverSubtitle=Release%20notes&headerText=Acme&footerText=Internal&showToc=0&chapterNumbers=1&locale=en',
        headers: WRITER,
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(preview.headers['cache-control']).toBe('no-store');
      expect(preview.body).toContain('width:215.9mm');
      expect(preview.body).toContain('#9a3412');
      expect(preview.body).toContain('Release notes');
      expect(preview.body).toContain('Editorial Book');
      expect(preview.body).not.toContain('class="toc-page"');

      const unknown = await app.inject({
        method: 'GET',
        url: '/api/publish/pdf-themes/nope/preview',
        headers: WRITER,
      });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json().error).toContain('PDF');

      const badAccent = await app.inject({
        method: 'GET',
        url: '/api/publish/pdf-themes/tech-manual/preview?accent=zzzzzz',
        headers: WRITER,
      });
      expect(badAccent.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('updates only the supplied profile side', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await builtinManualId(app);
      const initial = await app.inject({ method: 'GET', url: '/api/publish/profile', headers: WRITER });
      expect(initial.json().profile).toEqual({
        manualId,
        htmlThemeId: 'tech-docs',
        htmlThemeOptions: {},
        pdfThemeId: 'tech-manual',
        pdfThemeOptions: {},
        updatedBy: null,
        updatedAt: null,
      });

      const pdfSaved = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: {
          pdfThemeId: 'editorial-book',
          pdfThemeOptions: { accentColor: '#9a3412', features: { mirrorMargins: false } },
        },
      });
      expect(pdfSaved.statusCode).toBe(200);
      expect(pdfSaved.json().profile).toMatchObject({
        htmlThemeId: 'tech-docs',
        htmlThemeOptions: {},
        pdfThemeId: 'editorial-book',
        pdfThemeOptions: {
          accentColor: '#9a3412',
          features: { mirrorMargins: false, showCover: true },
        },
        updatedBy: 'u-writer-lin',
      });

      // A later HTML5 save must not reset the PDF side.
      const htmlSaved = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: { themeId: 'dev-dark', themeOptions: { features: { search: false } } },
      });
      expect(htmlSaved.statusCode).toBe(200);
      expect(htmlSaved.json().profile).toMatchObject({
        htmlThemeId: 'dev-dark',
        pdfThemeId: 'editorial-book',
        pdfThemeOptions: { accentColor: '#9a3412' },
      });

      const neither = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: { themeOptions: { accentColor: '#123456' } },
      });
      expect(neither.statusCode).toBe(400);

      const viewerSave = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: VIEWER,
        payload: { pdfThemeId: 'tech-manual' },
      });
      expect(viewerSave.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('snapshots the PDF theme on jobs and can persist it as the manual default', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: {
          rootMap: ROOT_MAP,
          format: 'pdf',
          pdfThemeId: 'enterprise-spec',
          pdfThemeOptions: { accentColor: '#0f2942', features: { taskLabels: true } },
          saveAsDefault: true,
        },
      });
      expect(created.statusCode).toBe(202);
      expect(created.json().job).toMatchObject({
        format: 'pdf',
        themeId: null,
        themeOptions: null,
        pdfThemeId: 'enterprise-spec',
        pdfThemeOptions: { accentColor: '#0f2942' },
      });

      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job.status).toBe('succeeded');
      expect(job).toMatchObject({
        pdfThemeId: 'enterprise-spec',
        pdfThemeOptions: { features: { taskLabels: true, showCover: true } },
      });

      const log = await app.inject({
        method: 'GET',
        url: `/api/publish/jobs/${job.id}/log`,
        headers: WRITER,
      });
      const content = log.json().content as string;
      expect(content).toContain('# pdf theme: enterprise-spec');
      expect(content).toContain('--customization.dir=');
      expect(content).toContain('--args.gen.task.lbl=YES');

      const customization = path.join(fixture.publishRootDir, 'jobs', job.id, 'customization');
      expect(existsSync(path.join(customization, 'catalog.xml'))).toBe(true);
      expect(existsSync(path.join(customization, 'cfg', 'fo', 'font-mappings.xml'))).toBe(true);
      expect(existsSync(path.join(customization, 'common', 'artwork'))).toBe(true);

      const profile = await app.inject({ method: 'GET', url: '/api/publish/profile', headers: WRITER });
      expect(profile.json().profile).toMatchObject({
        pdfThemeId: 'enterprise-spec',
        pdfThemeOptions: { accentColor: '#0f2942' },
      });
    } finally {
      await app.close();
    }
  });

  it('keeps HTML5 jobs free of PDF theme data and never persists vanilla', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'html5', themeId: 'tech-docs' },
      });
      expect(created.statusCode).toBe(202);
      expect(created.json().job).toMatchObject({
        pdfThemeId: null,
        pdfThemeOptions: null,
        themeId: 'tech-docs',
      });

      const pdf = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'pdf', pdfThemeId: 'vanilla', saveAsDefault: true },
      });
      expect(pdf.statusCode).toBe(202);
      expect(pdf.json().job).toMatchObject({
        pdfThemeId: 'vanilla',
        pdfThemeOptions: {},
        themeId: null,
      });
      const job = await waitForJob(app, pdf.json().job.id, WRITER);
      expect(job.status).toBe('succeeded');
      const log = await app.inject({
        method: 'GET',
        url: `/api/publish/jobs/${job.id}/log`,
        headers: WRITER,
      });
      expect(log.json().content).toContain('# pdf theme: vanilla');
      // vanilla publishes with the plugin directory, so no job-local customization exists.
      expect(
        existsSync(path.join(fixture.publishRootDir, 'jobs', job.id, 'customization')),
      ).toBe(false);

      const profile = await app.inject({ method: 'GET', url: '/api/publish/profile', headers: WRITER });
      expect(profile.json().profile).toMatchObject({ pdfThemeId: 'tech-manual' });
    } finally {
      await app.close();
    }
  });

  it('fails PDF jobs with a localized message when theme assets are missing', async () => {
    const fixture = createFixture();
    const app = createApp(fixture, { pdfThemesDir: path.join(fixture.root, 'missing-themes') });
    await app.ready();
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'pdf', pdfThemeId: 'tech-manual' },
      });
      expect(created.statusCode).toBe(202);
      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job.status).toBe('failed');
      expect(job.error).toContain('PDF 主题资源');

      const enJob = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: EN,
        payload: { rootMap: ROOT_MAP, format: 'pdf', pdfThemeId: 'tech-manual' },
      });
      const failed = await waitForJob(app, enJob.json().job.id, EN);
      expect(failed.error).toContain('PDF theme assets not found');
    } finally {
      await app.close();
    }
  });
});

const runRealDita = process.env.DITAEDITOR_PDF_REAL_BUILD === '1' && existsSync(LOCAL_DITA);

describe.skipIf(!runRealDita)('Phase 15 real DITA-OT PDF builds', () => {
  it('compiles every theme to a non-empty PDF', async () => {
    const fixture = createFixture();
    for (const themeId of PDF_THEME_IDS) {
      const jobDir = path.join(fixture.root, `real-${themeId}`);
      mkdirSync(jobDir, { recursive: true });
      const customization = await preparePdfCustomizationDir({
        jobDir,
        snapshotDir: SAMPLE_ROOT,
        themeId,
        themeOptions: {
          accentColor: '#b45309',
          coverSubtitle: 'Install & publish',
          headerText: 'DITAEditor',
          footerText: 'Internal',
          features: { taskLabels: true, mirrorMargins: true },
        },
        themesDir: PDF_THEMES_DIR,
        pluginDir: PLUGIN_DIR,
      });
      const outputDir = path.join(jobDir, 'output');
      const result = await execFileAsync(LOCAL_DITA, [
        `--input=${path.join(SAMPLE_ROOT, ROOT_MAP)}`,
        '--format=pdf',
        `--output=${outputDir}`,
        '--validate=yes',
        '--processing-mode=strict',
        `--customization.dir=${customization.customizationDir}`,
        ...customization.extraDitaArgs,
      ]).then(
        (value) => ({ ...value, code: 0 }),
        (error: { code?: number; stdout?: string; stderr?: string }) => ({
          code: error.code ?? 1,
          stdout: error.stdout ?? '',
          stderr: error.stderr ?? '',
        }),
      );
      expect(result.code, `theme ${themeId}: ${result.stderr}`).toBe(0);
      expect(result.stderr).not.toMatch(/\[PDFX|\[FOP|XTSE/);
      const pdf = path.join(outputDir, 'product-manual.pdf');
      expect(existsSync(pdf), `theme ${themeId} produced ${pdf}`).toBe(true);
      expect(readFileSync(pdf).byteLength).toBeGreaterThan(1000);
    }
  }, 300_000);
});
