import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type CreateServerOptions } from '../src/index.js';
import { resetDitaRuntimeCache } from '../src/modules/dita-ot/dita-runtime.js';
import { mergeThemeOptions } from '../src/modules/publish/publish-profiles.js';

const tempDirs: string[] = [];
const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };
const EN = { ...WRITER, 'x-dita-locale': 'en' };

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const THEMES_DIR = path.resolve(__dirname, '../../../dita-ot-plugins/html5-themes');
const ROOT_MAP = 'product-manual.ditamap';

const FAKE_DITA = `#!/usr/bin/env bash
set -u
if [ "\${1:-}" = "--version" ]; then
  echo "DITA-OT 4.2.1"
  exit 0
fi
input=""
format="html5"
output=""
navtoc="none"
for arg in "$@"; do
  case "$arg" in
    --input=*) input="\${arg#--input=}" ;;
    --format=*) format="\${arg#--format=}" ;;
    --output=*) output="\${arg#--output=}" ;;
    --nav-toc=*) navtoc="\${arg#--nav-toc=}" ;;
  esac
done
echo "fake-dita: input=$input format=$format navtoc=$navtoc"
mkdir -p "$output"
if [ "$format" = "pdf" ]; then
  printf '%%PDF-1.4\\nfake pdf\\n' > "$output/manual.pdf"
else
  printf '<!doctype html>\\n<html lang="en"><head><meta charset="utf-8"><title>Manual</title></head><body><main role="main"><h1>Manual</h1><p>Body text</p></main></body></html>\\n' > "$output/index.html"
  mkdir -p "$output/concepts"
  printf '<!doctype html>\\n<html lang="en"><head><meta charset="utf-8"><title>Intro</title></head><body><main role="main"><h1>Intro</h1><p>Intro body</p></main></body></html>\\n' > "$output/concepts/intro.html"
fi
echo "fake-dita: build complete"
exit 0
`;

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase12-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  const otherDir = path.join(root, 'other-project');
  cpSync(projectDir, otherDir, { recursive: true });
  const fakeDita = path.join(root, 'fake-dita.sh');
  writeFileSync(fakeDita, FAKE_DITA, 'utf8');
  chmodSync(fakeDita, 0o755);
  return {
    root,
    projectDir,
    otherDir,
    importsDir: path.join(root, 'imports'),
    fakeDita,
    dbPath: path.join(root, 'phase12.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
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
    htmlThemesDir: THEMES_DIR,
    ditaRuntime: {
      command: fixture.fakeDita,
      pluginDir: path.resolve(__dirname, '../../../dita-ot-plugins/com.ditaeditor.pdf-cjk'),
    },
    logger: false,
    ...overrides,
  });
}

type TestApp = ReturnType<typeof createApp>;

interface JobJson {
  id: string;
  status: string;
  themeId: string | null;
  themeOptions: {
    accentColor?: string;
    siteTitle?: string;
    features?: Record<string, boolean>;
  } | null;
  error: string | null;
  artifactUrl: string | null;
}

async function waitForJob(
  app: TestApp,
  id: string,
  headers: Record<string, string>,
  timeoutMs = 10_000,
): Promise<JobJson> {
  const deadline = Date.now() + timeoutMs;
  let last: JobJson | null = null;
  while (Date.now() < deadline) {
    const response = await app.inject({ method: 'GET', url: `/api/publish/jobs/${id}`, headers });
    if (response.statusCode !== 200) throw new Error(response.body);
    last = response.json().job as JobJson;
    const status = last?.status;
    if (status === 'succeeded' || status === 'failed' || status === 'cancelled') return last;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`job did not finish: ${JSON.stringify(last)}`);
}

function jobOutputDir(fixture: Fixture, jobId: string): string {
  return path.join(fixture.publishRootDir, 'jobs', jobId, 'output');
}

async function jobLog(app: TestApp, jobId: string): Promise<string> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/publish/jobs/${jobId}/log`,
    headers: WRITER,
  });
  expect(response.statusCode).toBe(200);
  return response.json().content as string;
}

async function builtinManualId(app: TestApp): Promise<string> {
  const list = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
  expect(list.statusCode).toBe(200);
  return list.json().manuals[0].id;
}

afterEach(() => {
  resetDitaRuntimeCache();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 12 theme option merging', () => {
  it('keeps base options and merges feature flags per key', () => {
    const merged = mergeThemeOptions(
      { accentColor: '#0ea5e9', features: { search: false, toc: true } },
      { siteTitle: 'Acme', features: { toc: false } },
    );
    expect(merged).toMatchObject({
      accentColor: '#0ea5e9',
      siteTitle: 'Acme',
      features: { search: false, toc: false, codeCopy: true, colorModeToggle: true },
    });
  });

  it('ignores malformed option payloads', () => {
    expect(mergeThemeOptions(null, 'nonsense')).toMatchObject({
      features: { search: true, toc: true, codeCopy: true, colorModeToggle: true },
    });
  });
});

describe('Phase 12 theme registry routes', () => {
  it('serves five localized descriptors with locale-aware caching', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const zh = await app.inject({ method: 'GET', url: '/api/publish/themes', headers: WRITER });
      expect(zh.statusCode).toBe(200);
      expect(zh.headers['cache-control']).toBe('no-cache');
      expect(String(zh.headers['vary'])).toContain('x-dita-locale');
      const themes = zh.json().themes as Array<{ id: string; name: string; defaultMode: string }>;
      expect(themes.map((theme) => theme.id)).toEqual([
        'tech-docs',
        'editorial-paper',
        'enterprise-manual',
        'dev-dark',
        'vanilla',
      ]);
      expect(themes[0]?.name).toBe('技术文档');

      const en = await app.inject({ method: 'GET', url: '/api/publish/themes', headers: EN });
      expect(en.json().themes[0]?.name).toBe('Tech Docs');
      expect(en.json().themes[3]).toMatchObject({ id: 'dev-dark', defaultMode: 'dark' });

      // Viewers may browse themes; publishing itself stays blocked.
      const viewer = await app.inject({ method: 'GET', url: '/api/publish/themes', headers: VIEWER });
      expect(viewer.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('renders an inline-styled preview that reflects query options', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const preview = await app.inject({
        method: 'GET',
        url: '/api/publish/themes/tech-docs/preview?accent=7c3aed&title=Acme%20Docs&search=0',
        headers: WRITER,
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(preview.headers['cache-control']).toBe('no-store');
      expect(preview.body).toContain('<style>');
      expect(preview.body).toContain('data-de-theme="tech-docs"');
      expect(preview.body).toContain('--de-accent: #7c3aed');
      expect(preview.body).toContain('Acme Docs');
      expect(preview.body).toContain('"search":false');

      const dark = await app.inject({
        method: 'GET',
        url: '/api/publish/themes/dev-dark/preview',
        headers: WRITER,
      });
      expect(dark.body).toContain('data-de-mode="dark"');
    } finally {
      await app.close();
    }
  });

  it('rejects unknown themes and invalid accents', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const unknown = await app.inject({
        method: 'GET',
        url: '/api/publish/themes/neon/preview',
        headers: WRITER,
      });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json().error).toContain('发布主题不存在');

      const localized = await app.inject({
        method: 'GET',
        url: '/api/publish/themes/neon/preview',
        headers: EN,
      });
      expect(localized.statusCode).toBe(404);
      expect(localized.json().error).toContain('Publish theme not found');

      const badAccent = await app.inject({
        method: 'GET',
        url: '/api/publish/themes/tech-docs/preview?accent=zzz',
        headers: WRITER,
      });
      expect(badAccent.statusCode).toBe(400);
      expect(badAccent.json().error).toBe('主题参数无效');
    } finally {
      await app.close();
    }
  });
});

describe('Phase 12 publish profile store', () => {
  it('returns defaults and persists publisher edits', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await builtinManualId(app);
      const initial = await app.inject({ method: 'GET', url: '/api/publish/profile', headers: WRITER });
      expect(initial.statusCode).toBe(200);
      expect(initial.json().profile).toEqual({
        manualId,
        htmlThemeId: 'tech-docs',
        htmlThemeOptions: {},
        // Phase 15: the PDF side of the profile is independent and defaults to `tech-manual`.
        pdfThemeId: 'tech-manual',
        pdfThemeOptions: {},
        updatedBy: null,
        updatedAt: null,
      });

      const saved = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: {
          themeId: 'dev-dark',
          themeOptions: {
            accentColor: '#0ea5e9',
            siteTitle: 'Acme Docs',
            features: { search: false },
          },
        },
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().profile).toMatchObject({
        manualId,
        htmlThemeId: 'dev-dark',
        htmlThemeOptions: {
          accentColor: '#0ea5e9',
          siteTitle: 'Acme Docs',
          features: { search: false, toc: true, codeCopy: true, colorModeToggle: true },
        },
        updatedBy: 'u-writer-lin',
      });
      expect(typeof saved.json().profile.updatedAt).toBe('string');

      const reread = await app.inject({ method: 'GET', url: '/api/publish/profile', headers: WRITER });
      expect(reread.json().profile.htmlThemeId).toBe('dev-dark');

      const viewer = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: VIEWER,
        payload: { themeId: 'editorial-paper' },
      });
      expect(viewer.statusCode).toBe(403);

      const invalid = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: { themeId: 'neon' },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error).toBe('主题参数无效');

      const badAccent = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: { themeId: 'dev-dark', themeOptions: { accentColor: 'blue' } },
      });
      expect(badAccent.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('keeps profiles isolated per manual', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const builtinId = await builtinManualId(app);
      const attached = await app.inject({
        method: 'POST',
        url: '/api/manuals',
        headers: ADMIN,
        payload: { mode: 'attach', rootDir: fixture.otherDir },
      });
      expect(attached.statusCode).toBe(200);
      const attachedId: string = attached.json().manual.id;

      const saved = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: { ...WRITER, 'x-dita-manual-id': builtinId },
        payload: { themeId: 'enterprise-manual' },
      });
      expect(saved.statusCode).toBe(200);

      const other = await app.inject({
        method: 'GET',
        url: '/api/publish/profile',
        headers: { ...WRITER, 'x-dita-manual-id': attachedId },
      });
      expect(other.json().profile).toMatchObject({
        manualId: attachedId,
        htmlThemeId: 'tech-docs',
        updatedAt: null,
      });

      const builtin = await app.inject({
        method: 'GET',
        url: '/api/publish/profile',
        headers: { ...WRITER, 'x-dita-manual-id': builtinId },
      });
      expect(builtin.json().profile.htmlThemeId).toBe('enterprise-manual');
    } finally {
      await app.close();
    }
  });
});

describe('Phase 12 themed publishing jobs', () => {
  it('applies the saved theme, portal flags and zips the enhanced output', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: {
          themeId: 'dev-dark',
          themeOptions: { accentColor: '#0ea5e9', siteTitle: 'Acme Docs' },
        },
      });
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'html5' },
      });
      expect(created.statusCode).toBe(202);
      expect(created.json().job).toMatchObject({
        themeId: 'dev-dark',
        themeOptions: { accentColor: '#0ea5e9', siteTitle: 'Acme Docs' },
      });

      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job).toMatchObject({ status: 'succeeded', themeId: 'dev-dark' });
      expect(job.themeOptions?.features).toEqual({
        search: true,
        toc: true,
        codeCopy: true,
        colorModeToggle: true,
      });

      const log = await jobLog(app, job.id);
      expect(log).toContain('--nav-toc=full');
      expect(log).toContain('--args.gen.task.lbl=YES');
      expect(log).toContain('# theme dev-dark:');
      expect(log).toContain('2 pages');

      const output = jobOutputDir(fixture, job.id);
      expect(existsSync(path.join(output, '_ditaeditor', 'theme.css'))).toBe(true);
      expect(existsSync(path.join(output, '_ditaeditor', 'search-index.js'))).toBe(true);
      expect(readFileSync(path.join(output, '_ditaeditor', 'brand-vars.css'), 'utf8')).toContain(
        '#0ea5e9',
      );
      const indexHtml = readFileSync(path.join(output, 'index.html'), 'utf8');
      expect(indexHtml).toContain('data-de-theme="dev-dark"');
      expect(indexHtml).toContain('<header class="de-header"');
      expect(indexHtml).toContain('_ditaeditor/search-index.js');
      expect(indexHtml).toContain('de-theme-dev-dark');

      const artifact = await app.inject({
        method: 'GET',
        url: `/api/publish/jobs/${job.id}/artifact`,
        headers: WRITER,
      });
      expect(artifact.statusCode).toBe(200);
      const archive = artifact.rawPayload.toString('latin1');
      expect(archive).toContain('_ditaeditor/theme.css');
      expect(archive).toContain('_ditaeditor/search-index.js');
    } finally {
      await app.close();
    }
  });

  it('lets an explicit job theme override the profile without saving it', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: { themeId: 'dev-dark' },
      });
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'html5', themeId: 'editorial-paper' },
      });
      expect(created.statusCode).toBe(202);
      expect(created.json().job.themeId).toBe('editorial-paper');

      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job).toMatchObject({ status: 'succeeded', themeId: 'editorial-paper' });
      const output = jobOutputDir(fixture, job.id);
      expect(existsSync(path.join(output, '_ditaeditor', 'theme.css'))).toBe(true);

      const profile = await app.inject({
        method: 'GET',
        url: '/api/publish/profile',
        headers: WRITER,
      });
      expect(profile.json().profile.htmlThemeId).toBe('dev-dark');
    } finally {
      await app.close();
    }
  });

  it('saveAsDefault persists the theme used by the job', async () => {
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
          format: 'html5',
          themeId: 'enterprise-manual',
          htmlThemeOptions: { accentColor: '#1d4ed8' },
          saveAsDefault: true,
        },
      });
      expect(created.statusCode).toBe(202);
      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job.status).toBe('succeeded');

      const profile = await app.inject({
        method: 'GET',
        url: '/api/publish/profile',
        headers: WRITER,
      });
      expect(profile.json().profile).toMatchObject({
        htmlThemeId: 'enterprise-manual',
        htmlThemeOptions: { accentColor: '#1d4ed8' },
      });
    } finally {
      await app.close();
    }
  });

  it('keeps vanilla publishing free of theme flags and portal assets', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const saved = await app.inject({
        method: 'PUT',
        url: '/api/publish/profile',
        headers: WRITER,
        payload: { themeId: 'vanilla', themeOptions: { siteTitle: 'ignored' } },
      });
      expect(saved.json().profile).toMatchObject({ htmlThemeId: 'vanilla', htmlThemeOptions: {} });

      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'html5' },
      });
      expect(created.statusCode).toBe(202);
      expect(created.json().job).toMatchObject({ themeId: 'vanilla', themeOptions: {} });

      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job.status).toBe('succeeded');
      const log = await jobLog(app, job.id);
      expect(log).toContain('navtoc=none');
      expect(log).not.toContain('--nav-toc=full');

      const output = jobOutputDir(fixture, job.id);
      expect(existsSync(path.join(output, '_ditaeditor'))).toBe(false);
      const indexHtml = readFileSync(path.join(output, 'index.html'), 'utf8');
      expect(indexHtml).not.toContain('data-de-theme');

      const artifact = await app.inject({
        method: 'GET',
        url: `/api/publish/jobs/${job.id}/artifact`,
        headers: WRITER,
      });
      expect(artifact.rawPayload.toString('latin1')).not.toContain('_ditaeditor');
    } finally {
      await app.close();
    }
  });

  it('records no theme for PDF jobs', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'pdf', themeId: 'dev-dark' },
      });
      expect(created.statusCode).toBe(202);
      expect(created.json().job).toMatchObject({ themeId: null, themeOptions: null });

      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job).toMatchObject({ status: 'succeeded', themeId: null, themeOptions: null });
      const log = await jobLog(app, job.id);
      expect(log).not.toContain('--nav-toc');
    } finally {
      await app.close();
    }
  });

  it('fails html5 jobs with a localized message when theme assets are missing', async () => {
    const fixture = createFixture();
    const app = createApp(fixture, { htmlThemesDir: path.join(fixture.root, 'missing-themes') });
    await app.ready();
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'html5', themeId: 'tech-docs' },
      });
      expect(created.statusCode).toBe(202);
      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job.status).toBe('failed');
      expect(job.error).toContain('未找到 HTML 主题资源');
      expect(job.artifactUrl).toBeNull();
      expect(existsSync(path.join(fixture.publishRootDir, 'jobs', String(job.id), 'snapshot'))).toBe(
        true,
      );
    } finally {
      await app.close();
    }
  });
});
