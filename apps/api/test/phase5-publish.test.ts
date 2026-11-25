import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import { parseDitaLog } from '../src/modules/dita-ot/dita-log-parser.js';
import { resetDitaRuntimeCache } from '../src/modules/dita-ot/dita-runtime.js';

const tempDirs: string[] = [];
const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const PLUGIN_DIR = path.resolve(__dirname, '../../../dita-ot-plugins/com.ditaeditor.pdf-cjk');
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
for arg in "$@"; do
  case "$arg" in
    --input=*) input="\${arg#--input=}" ;;
    --format=*) format="\${arg#--format=}" ;;
    --output=*) output="\${arg#--output=}" ;;
  esac
done
echo "fake-dita: input=$input format=$format"
echo "fake-dita: validating with DITA 1.3 DTD/RNG"
if grep -q "CONKEY" "$input" 2>/dev/null; then
  echo "Error: $input:4:9: [DOTJ046E] The @conkeyref attribute value 'missing/key' cannot be resolved." >&2
fi
if grep -q "DITA_STALE" "$input" 2>/dev/null; then
  echo "[DOTJ013E][ERROR] Failed to parse input" >&2
  echo "$input:12:5: [DOTX0120E][ERROR] Element \\"foo\\" not allowed. DITA_STALE" >&2
  exit 1
fi
mkdir -p "$output"
stem="$(basename "$input")"
stem="\${stem%%.*}"
if [ "$format" = "pdf" ]; then
  printf '%%PDF-1.4\\nfake pdf for %s\\n' "$stem" > "$output/$stem.pdf"
else
  printf '<!doctype html><html><body><h1>%s</h1></body></html>' "$stem" > "$output/index.html"
  printf '<!doctype html><html><body>topic</body></html>' > "$output/topic.html"
fi
sleep "\${FAKE_DITA_SLEEP:-0}"
echo "fake-dita: build complete -> $output"
exit 0
`;

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase5-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  const importsDir = path.join(root, 'imports');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  const fakeDita = path.join(root, 'fake-dita.sh');
  writeFileSync(fakeDita, FAKE_DITA, 'utf8');
  chmodSync(fakeDita, 0o755);
  return {
    root,
    projectDir,
    importsDir,
    fakeDita,
    dbPath: path.join(root, 'phase5.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
  };
}

function createApp(fixture: ReturnType<typeof createFixture>) {
  resetDitaRuntimeCache();
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    publishRootDir: fixture.publishRootDir,
    publishConcurrency: 1,
    ditaRuntime: {
      command: fixture.fakeDita,
      pluginDir: PLUGIN_DIR,
      fopConfigPath: path.join(PLUGIN_DIR, 'fop.xconf'),
      notoFontDir: path.join(fixture.root, 'fonts'),
    },
    logger: false,
  });
}

async function waitForJob(
  app: ReturnType<typeof createApp>,
  id: string,
  headers: Record<string, string>,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${id}`,
      headers,
    });
    if (response.statusCode !== 200) throw new Error(response.body);
    last = response.json().job;
    const status = last?.status;
    if (status === 'succeeded' || status === 'failed' || status === 'cancelled') return last;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`job did not finish: ${JSON.stringify(last)}`);
}

afterEach(() => {
  delete process.env.FAKE_DITA_SLEEP;
  resetDitaRuntimeCache();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('DITA-OT log parser', () => {
  it('normalizes locations, strips snapshot roots and keeps DOT codes', () => {
    const diagnostics = parseDitaLog(
      [
        '[DOTJ013E][ERROR] Failed to parse input',
        '/tmp/publish/jobs/job1/snapshot/concepts/broken.dita:12:5: [DOTX0120E][ERROR] Element "foo" not allowed.',
        '[DOTX0300W][WARN] Unresolved keyref: prod_name',
        '  /tmp/publish/jobs/job1/snapshot/topics/a.dita:8:3: [DOTX0300W][WARN] Unresolved keyref: prod_name',
      ].join('\n'),
      {
        roots: [
          {
            absolute: '/tmp/publish/jobs/job1/snapshot',
            displayPrefix: '',
          },
        ],
      },
    );

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      filePath: 'concepts/broken.dita',
      line: 12,
      column: 5,
      severity: 'error',
      code: 'DOTX0120E',
    });
    expect(diagnostics[0]?.message).toContain('Element "foo" not allowed');
    expect(diagnostics[1]).toMatchObject({
      filePath: 'topics/a.dita',
      line: 8,
      severity: 'warning',
      code: 'DOTX0300W',
    });
  });

  it('keeps POSIX file: URLs project-relative and parses fatal DOT codes', () => {
    const [diagnostic] = parseDitaLog(
      'Error: Build failed with an exception: [DOTJ012F] Failed to parse the input resource \'file:/tmp/proj/references/bad.dita\'.: file:/tmp/proj/references/bad.dita:9:175: Element type "acme-tag" must be declared.',
      { roots: [{ absolute: '/tmp/proj', displayPrefix: '' }] },
    );
    expect(diagnostic).toMatchObject({
      filePath: 'references/bad.dita',
      line: 9,
      column: 175,
      severity: 'error',
      code: 'DOTJ012F',
    });
    expect(diagnostic?.message).toContain('Element type "acme-tag" must be declared');
  });
});

describe('Phase 5 DITA-OT validation and publishing', () => {
  it('detects the runtime, runs strict validation and reports located errors', async () => {
    const fixture = createFixture();
    writeFileSync(
      path.join(fixture.projectDir, 'concepts', 'broken-topic.dita'),
      '<?xml version="1.0" encoding="UTF-8"?>\n<topic id="broken"><title>Broken</title><foo>DITA_STALE</foo></topic>\n',
      'utf8',
    );
    const app = createApp(fixture);
    await app.ready();

    const runtime = await app.inject({ method: 'GET', url: '/api/validate/runtime' });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json().runtime).toMatchObject({
      available: true,
      version: 'DITA-OT 4.2.1',
      pluginInstalled: true,
    });

    const ok = await app.inject({
      method: 'POST',
      url: '/api/validate/strict',
      headers: WRITER,
      payload: { paths: ['concepts/single-sourcing.dita'] },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ available: true, ok: true, diagnostics: [] });
    expect(ok.json().targets).toEqual(['concepts/single-sourcing.dita']);

    const failed = await app.inject({
      method: 'POST',
      url: '/api/validate/strict',
      headers: WRITER,
      payload: { paths: ['concepts/broken-topic.dita'] },
    });
    expect(failed.statusCode).toBe(200);
    const failedBody = failed.json();
    expect(failedBody.available).toBe(true);
    expect(failedBody.ok).toBe(false);
    expect(failedBody.diagnostics[0]).toMatchObject({
      filePath: 'concepts/broken-topic.dita',
      line: 12,
      column: 5,
      severity: 'error',
    });

    writeFileSync(
      path.join(fixture.projectDir, 'concepts', 'conkeyref-topic.dita'),
      '<?xml version="1.0" encoding="UTF-8"?>\n<topic id="ck"><title>CK</title><p><keyword conkeyref="missing/key">CONKEY</keyword></p></topic>\n',
      'utf8',
    );
    const standalone = await app.inject({
      method: 'POST',
      url: '/api/validate/strict',
      headers: WRITER,
      payload: { paths: ['concepts/conkeyref-topic.dita'] },
    });
    expect(standalone.json().ok).toBe(true);
    expect(standalone.json().diagnostics[0]).toMatchObject({
      code: 'DOTJ046E',
      severity: 'warning',
      filePath: 'concepts/conkeyref-topic.dita',
    });

    const contextual = await app.inject({
      method: 'POST',
      url: '/api/validate/strict',
      headers: WRITER,
      payload: { paths: ['concepts/single-sourcing.dita'], rootMapPath: ROOT_MAP },
    });
    expect(contextual.json().ok).toBe(true);
    expect(contextual.json().entryPoint).toBe(ROOT_MAP);

    const viewerRun = await app.inject({
      method: 'POST',
      url: '/api/validate/strict',
      headers: VIEWER,
      payload: { paths: ['concepts/single-sourcing.dita'] },
    });
    // Viewers may run read-only strict validation.
    expect(viewerRun.statusCode).toBe(200);
    expect(viewerRun.json().ok).toBe(true);

    await app.close();
  });

  it('keeps DITAVAL filters inside the workspace', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    try {
      await app.ready();
      const response = await app.inject({
        method: 'POST',
        url: '/api/validate/strict',
        headers: WRITER,
        payload: {
          paths: ['concepts/single-sourcing.dita'],
          rootMapPath: ROOT_MAP,
          ditavalPath: '../../outside.ditaval',
        },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.ok).toBe(false);
      expect(body.message).toContain('超出工作区');
      expect(body.diagnostics).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('publishes HTML5 ZIP + preview and PDF with role rules, history and logs', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();

    const runtime = await app.inject({ method: 'GET', url: '/api/publish/runtime', headers: WRITER });
    expect(runtime.statusCode).toBe(200);
    expect(runtime.json().runtime.available).toBe(true);

    const viewerCreate = await app.inject({
      method: 'POST',
      url: '/api/publish/jobs',
      headers: VIEWER,
      payload: { rootMap: ROOT_MAP, format: 'html5' },
    });
    expect(viewerCreate.statusCode).toBe(403);

    const created = await app.inject({
      method: 'POST',
      url: '/api/publish/jobs',
      headers: WRITER,
      payload: {
        rootMap: ROOT_MAP,
        format: 'html5',
        ditavalPath: 'filters/cloud-edition.ditaval',
        title: '中文产品手册',
      },
    });
    expect(created.statusCode).toBe(202);
    const htmlJob = await waitForJob(app, created.json().job.id, WRITER);
    expect(htmlJob.status).toBe('succeeded');
    expect(htmlJob.artifactName).toBe('中文产品手册-html5.zip');
    expect(htmlJob.previewUrl).toContain('/preview/');
    expect(htmlJob.diagnostics).toEqual([]);

    const preview = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${htmlJob.id}/preview/`,
      headers: WRITER,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.headers['content-type']).toContain('text/html');
    expect(preview.body).toContain('<h1>');

    const artifact = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${htmlJob.id}/artifact`,
      headers: VIEWER,
    });
    expect(artifact.statusCode).toBe(200);
    expect(artifact.headers['content-type']).toContain('application/zip');
    expect(artifact.rawPayload.subarray(0, 2).toString('latin1')).toBe('PK');

    const log = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${htmlJob.id}/log`,
      headers: WRITER,
    });
    expect(log.statusCode).toBe(200);
    expect(log.json().content).toContain('fake-dita: validating');
    expect(log.json().complete).toBe(true);

    const events = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${htmlJob.id}/events`,
      headers: WRITER,
    });
    expect(events.statusCode).toBe(200);
    expect(events.headers['content-type']).toContain('text/event-stream');
    expect(events.body).toContain('event: log');
    expect(events.body).toContain('event: status');
    expect(events.body).toContain('event: end');

    const pdfCreated = await app.inject({
      method: 'POST',
      url: '/api/publish/jobs',
      headers: WRITER,
      payload: { rootMap: ROOT_MAP, format: 'pdf', title: '中文 PDF 手册' },
    });
    expect(pdfCreated.statusCode).toBe(202);
    const pdfJob = await waitForJob(app, pdfCreated.json().job.id, WRITER);
    expect(pdfJob.status).toBe('succeeded');
    expect(pdfJob.artifactName).toBe('中文 PDF 手册.pdf');

    const pdf = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${pdfJob.id}/artifact?inline=1`,
      headers: VIEWER,
    });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.rawPayload.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    const history = await app.inject({
      method: 'GET',
      url: '/api/publish/jobs',
      headers: VIEWER,
    });
    expect(history.statusCode).toBe(200);
    expect(history.json().jobs).toHaveLength(2);
    expect(history.json().jobs.map((job: { format: string }) => job.format)).toEqual([
      'pdf',
      'html5',
    ]);

    await app.close();
  }, 30_000);

  it('serves previews and artifacts without scope headers (plain browser navigation)', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const created = await app.inject({
        method: 'POST',
        url: '/api/publish/jobs',
        headers: WRITER,
        payload: { rootMap: ROOT_MAP, format: 'html5' },
      });
      expect(created.statusCode).toBe(202);
      const job = await waitForJob(app, created.json().job.id, WRITER);
      expect(job.status).toBe('succeeded');

      // Attach a second manual and make it the most recently opened one, so a header-less
      // request resolves away from the manual that produced the job.
      const otherDir = path.join(fixture.root, 'other-manual');
      cpSync(SAMPLE_ROOT, otherDir, { recursive: true });
      rmSync(path.join(otherDir, '.git'), { recursive: true, force: true });
      const attached = await app.inject({
        method: 'POST',
        url: '/api/manuals',
        headers: ADMIN,
        payload: { mode: 'attach', rootDir: otherDir },
      });
      expect(attached.statusCode).toBe(200);
      const touched = await app.inject({
        method: 'POST',
        url: `/api/manuals/${attached.json().manual.id}/touch`,
      });
      expect(touched.statusCode).toBe(200);

      // New tabs, ZIP downloads and relative CSS/topic requests never carry
      // `x-dita-manual-id`; each one must still resolve the job by its own id.
      const urls = [
        `/api/publish/jobs/${job.id}/preview/`,
        `/api/publish/jobs/${job.id}/preview/topic.html`,
        `/api/publish/jobs/${job.id}/artifact`,
      ];
      for (const url of urls) {
        const response = await app.inject({ method: 'GET', url });
        expect(response.statusCode, url).toBe(200);
      }
    } finally {
      await app.close();
    }
  }, 30_000);

  it('queues builds, streams log output and cancels a running job', async () => {
    const fixture = createFixture();
    process.env.FAKE_DITA_SLEEP = '3';
    const app = createApp(fixture);
    await app.ready();

    const created = await app.inject({
      method: 'POST',
      url: '/api/publish/jobs',
      headers: WRITER,
      payload: { rootMap: ROOT_MAP, format: 'html5', title: '慢速构建' },
    });
    expect(created.statusCode).toBe(202);
    const id = created.json().job.id;

    await new Promise((resolve) => setTimeout(resolve, 400));
    const running = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${id}`,
      headers: WRITER,
    });
    expect(running.json().job.status).toBe('running');

    const partialLog = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${id}/log`,
      headers: WRITER,
    });
    expect(partialLog.json().content).toContain('fake-dita');
    expect(partialLog.json().complete).toBe(false);

    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/publish/jobs/${id}/cancel`,
      headers: WRITER,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().job.cancelRequested).toBe(true);

    const finished = await waitForJob(app, id, WRITER);
    expect(finished.status).toBe('cancelled');
    expect(finished.error).toContain('取消');

    const rerun = await app.inject({
      method: 'POST',
      url: `/api/publish/jobs/${id}/cancel`,
      headers: WRITER,
    });
    expect(rerun.statusCode).toBe(409);

    await app.close();
  }, 20_000);
});
