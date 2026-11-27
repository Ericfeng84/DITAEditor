import { execSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AIMessage, AIMessageChunk } from '@langchain/core/messages';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import { openDatabase } from '../src/db/client.js';
import { lockBackups } from '../src/db/schema.js';
import type { AiModelFactory } from '../src/modules/ai/ai-model-factory.js';
import { resetDitaRuntimeCache } from '../src/modules/dita-ot/dita-runtime.js';

/* -------------------------------------------------------------------------- */
/* Fixtures & helpers                                                          */
/* -------------------------------------------------------------------------- */

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const PLUGIN_DIR = path.resolve(__dirname, '../../../dita-ot-plugins/com.ditaeditor.pdf-cjk');
const ROOT_MAP = 'product-manual.ditamap';

const TOPIC_A = 'concepts/workspace-model.dita';
const TOPIC_B = 'tasks/deploy-worker.dita';
const TOPIC_C = 'tasks/create-map-structure.dita';
const TOPIC_D = 'references/rest-api-endpoints.dita';
const TOPIC_E = 'tasks/configure-cjk-pdf.dita';

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER_A = { 'x-dita-user-id': 'u-writer-lin' };
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const A_BROKEN_MARKER = 'A_BROKEN_MARKER';
const B_OVERLAY_MARKER = 'B_OVERLAY_MARKER';
const TAG_LATER_MARKER = 'TAG_LATER_MARKER';

const BROKEN_XML = `<concept id="broken"><title>${A_BROKEN_MARKER}</title>\n  <p>unclosed paragraph\n`;

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
mkdir -p "$output"
probe=""
input_dir="$(dirname "$input")"
for marker in A_BROKEN_MARKER B_OVERLAY_MARKER TAG_LATER_MARKER; do
  if grep -rq -- "$marker" "$input_dir" 2>/dev/null; then
    probe="$probe marker:$marker=present"
  else
    probe="$probe marker:$marker=absent"
  fi
done
echo "$probe"
printf '%s\n' "$probe" > "$output/phase13-markers.txt"
stem="$(basename "$input")"
stem="\${stem%%.*}"
if [ "$format" = "pdf" ]; then
  printf '%%PDF-1.4\\nfake pdf for %s\\n' "$stem" > "$output/$stem.pdf"
else
  printf '<!doctype html><html><body><h1>%s</h1></body></html>' "$stem" > "$output/index.html"
  printf '<!doctype html><html><body>topic</body></html>' > "$output/topic.html"
fi
echo "fake-dita: build complete -> $output"
exit 0
`;

const tempDirs: string[] = [];
const originalTtl = process.env.DITA_LOCK_TTL_HOURS;
const originalApiKey = process.env.DEEPSEEK_API_KEY;

interface Fixture {
  root: string;
  projectDir: string;
  importsDir: string;
  draftAssetsDir: string;
  fakeDita: string;
  dbPath: string;
  worktreesRootDir: string;
  publishRootDir: string;
}

function createFixture(): Fixture {
  // The AI runtime needs a configured key; the model itself is the injected factory below.
  process.env.DEEPSEEK_API_KEY = 'sk-test-1234567890abcd';
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase13-'));
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
    draftAssetsDir: path.join(root, 'draft-assets'),
    fakeDita,
    dbPath: path.join(root, 'phase13.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
  };
}

interface CapturedPrompt {
  messages: unknown[];
}

function createApp(fixture: Fixture, captured: CapturedPrompt[] = []) {
  resetDitaRuntimeCache();
  const aiModelFactory: AiModelFactory = () => ({
    async *stream(messages) {
      captured.push({ messages });
      yield new AIMessageChunk({
        content: '<explanation>ok</explanation>',
        usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      });
    },
    async invoke() {
      return new AIMessage('pong');
    },
  });
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    draftAssetsRootDir: fixture.draftAssetsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    publishRootDir: fixture.publishRootDir,
    publishConcurrency: 1,
    aiModelFactory,
    ditaRuntime: {
      command: fixture.fakeDita,
      pluginDir: PLUGIN_DIR,
      fopConfigPath: path.join(PLUGIN_DIR, 'fop.xconf'),
      notoFontDir: path.join(fixture.root, 'fonts'),
    },
    logger: false,
  });
}

type App = ReturnType<typeof createApp>;

function git(fixture: Fixture, args: string): string {
  return execSync(`git ${args}`, { cwd: fixture.projectDir, encoding: 'utf8' }).trim();
}

function porcelain(fixture: Fixture): string {
  return execSync('git status --porcelain', {
    cwd: fixture.projectDir,
    encoding: 'utf8',
  }).trim();
}

function branches(fixture: Fixture): string[] {
  return git(fixture, 'branch --format="%(refname:short)"')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function worktrees(fixture: Fixture): string[] {
  return git(fixture, 'worktree list --porcelain')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length));
}

/** Flatten a `/api/workspace` file tree into the workspace-relative paths the UI uses. */
function flattenFilePaths(
  nodes: { path: string; kind: string; children?: unknown[] }[],
): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind === 'directory') {
      out.push(...flattenFilePaths((node.children ?? []) as typeof nodes));
    } else {
      out.push(node.path);
    }
  }
  return out;
}

/** Creates the repository, an initial full commit and returns the scoped builtin manual id. */
async function bootstrap(app: App, fixture: Fixture): Promise<string> {
  // `POST /api/git/init` already commits the whole sample tree as the initial baseline.
  const init = await app.inject({ method: 'POST', url: '/api/git/init', headers: ADMIN });
  expect(init.statusCode).toBe(200);
  const manuals = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
  expect(manuals.statusCode).toBe(200);
  const body = manuals.json() as { manuals: { id: string; rootDir: string }[] };
  const match = body.manuals.find((manual) => manual.rootDir === fixture.projectDir);
  expect(match).toBeTruthy();
  return match!.id;
}

function scoped(
  user: Record<string, string>,
  options: { manualId?: string; branch?: string } = {},
): Record<string, string> {
  return {
    ...user,
    ...(options.manualId ? { 'x-dita-manual-id': options.manualId } : {}),
    ...(options.branch ? { 'x-dita-branch': options.branch } : {}),
  };
}

async function getContent(app: App, headers: Record<string, string>, filePath: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/files/content?path=${encodeURIComponent(filePath)}`,
    headers,
  });
  return response;
}

async function checkout(app: App, headers: Record<string, string>, filePath: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/locks/checkout',
    headers,
    payload: { path: filePath },
  });
  expect(response.statusCode).toBe(200);
}

async function writeFile(
  app: App,
  headers: Record<string, string>,
  filePath: string,
  content: string,
  expectedHash?: string,
) {
  return app.inject({
    method: 'PUT',
    url: '/api/files/content',
    headers,
    payload: { path: filePath, content, ...(expectedHash ? { expectedHash } : {}) },
  });
}

async function checkin(
  app: App,
  headers: Record<string, string>,
  paths: string[],
  message = 'feat: phase13 acceptance',
) {
  return app.inject({
    method: 'POST',
    url: '/api/locks/checkin',
    headers,
    payload: { paths, message },
  });
}

function withTitle(content: string, title: string): string {
  return content.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

async function waitForJob(app: App, id: string, headers: Record<string, string>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    const response = await app.inject({
      method: 'GET',
      url: `/api/publish/jobs/${id}`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    last = response.json().job as Record<string, unknown>;
    if (['succeeded', 'failed', 'cancelled'].includes(String(last.status))) return last;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Publish job ${id} did not settle: ${JSON.stringify(last)}`);
}

async function startPublish(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/publish/jobs',
    headers,
    payload: { rootMap: ROOT_MAP, format: 'html5', ...payload },
  });
  expect(response.statusCode).toBe(202);
  const job = response.json().job as Record<string, unknown>;
  return waitForJob(app, String(job.id), headers);
}

function markerProbeFiles(fixture: Fixture): string[] {
  if (!existsSync(fixture.publishRootDir)) return [];
  const listing = execSync(`find "${fixture.publishRootDir}" -name phase13-markers.txt -print`, {
    encoding: 'utf8',
  }).trim();
  return listing ? listing.split('\n').map((entry) => entry.trim()).filter(Boolean) : [];
}

function freshProbes(fixture: Fixture, before: string[]): string[] {
  return markerProbeFiles(fixture)
    .filter((file) => !before.includes(file))
    .map((file) => readFileSync(file, 'utf8'));
}

function uploadedSvg(boundary: string, targetDir: string, fileName: string): string {
  return [
    `--${boundary}`,
    'Content-Disposition: form-data; name="targetDir"',
    '',
    targetDir,
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="' + fileName + '"',
    'Content-Type: image/svg+xml',
    '',
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

afterEach(() => {
  if (originalTtl === undefined) delete process.env.DITA_LOCK_TTL_HOURS;
  else process.env.DITA_LOCK_TTL_HOURS = originalTtl;
  if (originalApiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalApiKey;
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -------------------------------------------------------------------------- */
/* 1. Same-branch draft isolation                                             */
/* -------------------------------------------------------------------------- */

describe('Phase 13 §6.1 same-branch draft isolation', () => {
  it('keeps a broken draft private across content, workspace, diagnostics, semantics, assets and AI', async () => {
    const fixture = createFixture();
    const captured: CapturedPrompt[] = [];
    const app = createApp(fixture, captured);
    await bootstrap(app, fixture);

    const baselineB = (await getContent(app, WRITER_B, TOPIC_B)).json().content as string;
    const bDraft = withTitle(baselineB, B_OVERLAY_MARKER);

    // User A: broken XML draft; User B: valid draft on another topic.
    await checkout(app, WRITER_A, TOPIC_A);
    const brokenSave = await writeFile(app, WRITER_A, TOPIC_A, BROKEN_XML);
    expect(brokenSave.statusCode).toBe(200);

    await checkout(app, WRITER_B, TOPIC_B);
    const validSave = await writeFile(app, WRITER_B, TOPIC_B, bDraft);
    expect(validSave.statusCode).toBe(200);

    // The shared workDir is untouched by any draft.
    expect(porcelain(fixture)).toBe('');
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_A), 'utf8')).not.toContain(A_BROKEN_MARKER);
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_B), 'utf8')).not.toContain(B_OVERLAY_MARKER);

    // A sees the broken draft, B sees the baseline.
    const aContent = await getContent(app, WRITER_A, TOPIC_A);
    expect(aContent.json().content).toContain(A_BROKEN_MARKER);
    expect(aContent.json().wellFormed).toBe(false);
    const bContent = await getContent(app, WRITER_B, TOPIC_A);
    expect(bContent.json().content).not.toContain(A_BROKEN_MARKER);
    expect(bContent.json().wellFormed).toBe(true);

    // Workspace tree: B's scan never exposes A's broken draft.
    const bWorkspace = await app.inject({ method: 'GET', url: '/api/workspace', headers: WRITER_B });
    expect(bWorkspace.statusCode).toBe(200);
    expect(bWorkspace.statusCode).toBe(200);
    expect(bWorkspace.body).not.toContain(A_BROKEN_MARKER);
    expect(bWorkspace.json().topicTitles[TOPIC_A]).toBe('手册、分支与个人草稿');
    const aWorkspace = await app.inject({ method: 'GET', url: '/api/workspace', headers: WRITER_A });
    expect(aWorkspace.json().files.some((node: { path: string }) => node.path === 'concepts')).toBe(true);
    expect(aWorkspace.body).not.toContain(A_BROKEN_MARKER);

    // Nested file nodes must keep their FULL workspace path: a draft overlay used to rewrite
    // `concepts/workspace-model.dita` to `workspace-model.dita`, so `fileSet` no longer matched
    // the map's `href` and the Map Tree flagged a perfectly valid target as missing.
    expect(flattenFilePaths(aWorkspace.json().files)).toContain(TOPIC_A);
    expect(flattenFilePaths(aWorkspace.json().files)).not.toContain('workspace-model.dita');

    // Diagnostics: A reports its XML error, B stays clean.
    const aDiagnostics = (
      await app.inject({ method: 'GET', url: '/api/diagnostics', headers: WRITER_A })
    ).json().diagnostics as { filePath: string; severity: string; message: string }[];
    expect(
      aDiagnostics.some((entry) => entry.filePath === TOPIC_A && entry.severity === 'error'),
    ).toBe(true);
    const bDiagnostics = (
      await app.inject({ method: 'GET', url: '/api/diagnostics', headers: WRITER_B })
    ).json().diagnostics as { filePath: string; severity: string; message: string }[];
    expect(
      bDiagnostics.some((entry) => entry.filePath === TOPIC_A && entry.severity === 'error'),
    ).toBe(false);
    expect(JSON.stringify(bDiagnostics)).not.toContain(A_BROKEN_MARKER);

    // Semantic context for B never indexes A's draft.
    const bSemantics = await app.inject({
      method: 'GET',
      url: `/api/semantics/context?rootMap=${encodeURIComponent(ROOT_MAP)}`,
      headers: WRITER_B,
    });
    expect(bSemantics.statusCode).toBe(200);
    expect(bSemantics.body).not.toContain(A_BROKEN_MARKER);
    const aSemantics = await app.inject({
      method: 'GET',
      url: `/api/semantics/context?rootMap=${encodeURIComponent(ROOT_MAP)}`,
      headers: WRITER_A,
    });
    // A's overlay makes the topic visibly malformed; the raw draft text never appears.
    type SemanticTopicIndex = { filePath: string; wellFormed: boolean; rootTag: string };
    const aTopics = aSemantics.json().topicIndices as SemanticTopicIndex[];
    const aTopic = aTopics.find((entry) => entry.filePath === TOPIC_A);
    expect(aTopic).toBeDefined();
    expect(aTopic!.wellFormed).toBe(false);
    expect(aTopic!.rootTag).toBe('');
    const bTopics = bSemantics.json().topicIndices as SemanticTopicIndex[];
    expect(bTopics.find((entry) => entry.filePath === TOPIC_A)?.wellFormed).toBe(true);

    // AI context is built from the caller's overlay only.
    const aiResponse = await app.inject({
      method: 'POST',
      url: '/api/ai/stream',
      headers: WRITER_B,
      payload: {
        projectPath: TOPIC_B,
        rootMapPath: ROOT_MAP,
        taskType: 'authoring',
        instruction: '请把这段改写得更加清晰。',
        target: { mode: 'element', elementPath: [2, 0] },
        history: [],
      },
    });
    expect(aiResponse.statusCode).toBe(200);
    expect(captured.length).toBeGreaterThan(0);
    for (const call of captured) {
      expect(JSON.stringify(call.messages)).not.toContain(A_BROKEN_MARKER);
    }

    // Draft image: private to its uploader until check-in, never written to the shared workDir.
    const boundary = '----Phase13Boundary';
    const upload = await app.inject({
      method: 'POST',
      url: '/api/assets/upload',
      headers: { ...WRITER_A, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: uploadedSvg(boundary, 'images', 'draft-image.svg'),
    });
    expect(upload.statusCode).toBe(200);
    const imagePath = 'images/draft-image.svg';
    expect(existsSync(path.join(fixture.projectDir, imagePath))).toBe(false);
    expect(porcelain(fixture)).toBe('');

    const ownRead = await app.inject({
      method: 'GET',
      url: `/api/assets/raw?path=${encodeURIComponent(imagePath)}&userId=u-writer-lin`,
      headers: WRITER_A,
    });
    expect(ownRead.statusCode).toBe(200);
    const otherRead = await app.inject({
      method: 'GET',
      url: `/api/assets/raw?path=${encodeURIComponent(imagePath)}&userId=u-writer-chen`,
      headers: WRITER_B,
    });
    expect(otherRead.statusCode).toBe(404);

    // Only check-in materializes the draft asset into the shared baseline.
    const checkedIn = await checkin(app, WRITER_A, [imagePath], 'feat: add draft image');
    expect(checkedIn.statusCode).toBe(200);
    expect(existsSync(path.join(fixture.projectDir, imagePath))).toBe(true);
    expect(porcelain(fixture)).toBe('');
  });

  it('materializes only the caller overlay for strict validation scopes', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    await checkout(app, WRITER_A, TOPIC_A);
    expect((await writeFile(app, WRITER_A, TOPIC_A, BROKEN_XML)).statusCode).toBe(200);

    const baselineB = (await getContent(app, WRITER_B, TOPIC_B)).json().content as string;
    await checkout(app, WRITER_B, TOPIC_B);
    expect(
      (await writeFile(app, WRITER_B, TOPIC_B, withTitle(baselineB, B_OVERLAY_MARKER))).statusCode,
    ).toBe(200);

    const validate = (headers: Record<string, string>, scope: string, paths: string[]) =>
      app.inject({
        method: 'POST',
        url: '/api/validate/strict',
        headers,
        payload: { scope, paths },
      });

    const myDraftsB = await validate(WRITER_B, 'my_drafts', [TOPIC_A, TOPIC_B]);
    expect(myDraftsB.statusCode).toBe(200);
    expect(myDraftsB.json().ok).toBe(true);
    const logB = myDraftsB.json().logTail as string;
    expect(logB).toContain(`marker:${B_OVERLAY_MARKER}=present`);
    expect(logB).toContain(`marker:${A_BROKEN_MARKER}=absent`);

    const myDraftsA = await validate(WRITER_A, 'my_drafts', [TOPIC_A, TOPIC_B]);
    expect(myDraftsA.statusCode).toBe(200);
    const logA = myDraftsA.json().logTail as string;
    expect(logA).toContain(`marker:${A_BROKEN_MARKER}=present`);
    expect(logA).toContain(`marker:${B_OVERLAY_MARKER}=absent`);

    const baseline = await validate(WRITER_B, 'baseline', [TOPIC_A, TOPIC_B]);
    expect(baseline.statusCode).toBe(200);
    const logBaseline = baseline.json().logTail as string;
    expect(logBaseline).toContain(`marker:${A_BROKEN_MARKER}=absent`);
    expect(logBaseline).toContain(`marker:${B_OVERLAY_MARKER}=absent`);
    expect(porcelain(fixture)).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Delete / Rename / Handoff / Cancel lifecycle                            */
/* -------------------------------------------------------------------------- */

describe('Phase 13 §6.2 delete, rename, handoff and cancel', () => {
  it('hides deletes and renames from the shared baseline until check-in', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    const manualId = await bootstrap(app, fixture);

    // --- delete then cancel restores instantly, without touching Git ---
    await checkout(app, WRITER_A, TOPIC_A);
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/files?path=${encodeURIComponent(TOPIC_A)}`,
      headers: WRITER_A,
    });
    expect(deleted.statusCode).toBe(200);
    expect(existsSync(path.join(fixture.projectDir, TOPIC_A))).toBe(true);
    expect((await getContent(app, WRITER_A, TOPIC_A)).statusCode).toBe(404);
    expect((await getContent(app, WRITER_B, TOPIC_A)).statusCode).toBe(200);

    const cancelDelete = await app.inject({
      method: 'POST',
      url: '/api/locks/cancel',
      headers: WRITER_A,
      payload: { path: TOPIC_A },
    });
    expect(cancelDelete.statusCode).toBe(200);
    expect((await getContent(app, WRITER_A, TOPIC_A)).statusCode).toBe(200);

    // --- delete then check-in commits a real Git deletion ---
    await checkout(app, WRITER_A, TOPIC_B);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/files?path=${encodeURIComponent(TOPIC_B)}`,
          headers: WRITER_A,
        })
      ).statusCode,
    ).toBe(200);
    expect(existsSync(path.join(fixture.projectDir, TOPIC_B))).toBe(true);
    const deleteCommit = await checkin(app, WRITER_A, [TOPIC_B], 'chore: delete topic B');
    expect(deleteCommit.statusCode).toBe(200);
    expect(existsSync(path.join(fixture.projectDir, TOPIC_B))).toBe(false);
    expect(porcelain(fixture)).toBe('');
    expect(git(fixture, 'log -1 --format=%s')).toBe('chore: delete topic B');

    // --- rename with an active topic assignment ---
    const assignment = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: WRITER_A,
      payload: { manualId, branch: 'main', topicPath: TOPIC_C, assigneeId: 'u-writer-lin' },
    });
    expect(assignment.statusCode).toBe(200);

    const renamedPath = 'tasks/create-map-structure-v2.dita';
    await checkout(app, WRITER_A, TOPIC_C);
    const renamed = await app.inject({
      method: 'POST',
      url: '/api/files/rename',
      headers: WRITER_A,
      payload: { fromPath: TOPIC_C, toPath: renamedPath },
    });
    expect(renamed.statusCode).toBe(200);

    expect(existsSync(path.join(fixture.projectDir, TOPIC_C))).toBe(true);
    expect(existsSync(path.join(fixture.projectDir, renamedPath))).toBe(false);
    expect((await getContent(app, WRITER_B, TOPIC_C)).statusCode).toBe(200);
    expect(porcelain(fixture)).toBe('');
    const beforeCheckin = (
      await app.inject({ method: 'GET', url: '/api/assignments?scope=all', headers: WRITER_A })
    ).json().assignments as { id: string; topicPath: string }[];
    expect(beforeCheckin.find((row) => row.id === assignment.json().assignment.id)?.topicPath).toBe(
      TOPIC_C,
    );

    const renameCommit = await checkin(app, WRITER_A, [renamedPath], 'chore: rename topic C');
    expect(renameCommit.statusCode).toBe(200);
    expect(existsSync(path.join(fixture.projectDir, renamedPath))).toBe(true);
    expect(existsSync(path.join(fixture.projectDir, TOPIC_C))).toBe(false);
    expect(porcelain(fixture)).toBe('');
    const renameStatus = git(fixture, `log -1 --name-status --format= -M`);
    expect(renameStatus).toMatch(/^R\d*\s+.*create-map-structure\.dita\s+.*create-map-structure-v2\.dita$/m);

    const afterCheckin = (
      await app.inject({ method: 'GET', url: '/api/assignments?scope=all', headers: WRITER_A })
    ).json().assignments as { id: string; topicPath: string }[];
    expect(afterCheckin.find((row) => row.id === assignment.json().assignment.id)?.topicPath).toBe(
      renamedPath,
    );
    const locksAfter = await app.inject({ method: 'GET', url: '/api/locks', headers: WRITER_A });
    expect(locksAfter.json().locks).toEqual([]);
    expect(locksAfter.json().drafts).toEqual([]);
  });

  it('rejects dirty releases, transfers handoff atomically and discards cancels', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    // Dirty release is refused; a clean checkout releases fine.
    await checkout(app, WRITER_A, TOPIC_D);
    const baselineD = (await getContent(app, WRITER_A, TOPIC_D)).json().content as string;
    expect((await writeFile(app, WRITER_A, TOPIC_D, withTitle(baselineD, 'HANDOFF_TITLE'))).statusCode).toBe(
      200,
    );
    const dirtyRelease = await app.inject({
      method: 'POST',
      url: '/api/locks/release',
      headers: WRITER_A,
      payload: { path: TOPIC_D },
    });
    expect(dirtyRelease.statusCode).toBe(409);

    await checkout(app, WRITER_A, TOPIC_E);
    const cleanRelease = await app.inject({
      method: 'POST',
      url: '/api/locks/release',
      headers: WRITER_A,
      payload: { path: TOPIC_E },
    });
    expect(cleanRelease.statusCode).toBe(200);

    // Handoff moves lock + draft to User B atomically.
    const viewerTarget = await app.inject({
      method: 'POST',
      url: '/api/locks/handoff',
      headers: WRITER_A,
      payload: { path: TOPIC_D, targetUserId: 'u-viewer-zhou' },
    });
    expect(viewerTarget.statusCode).toBe(403);

    const handoff = await app.inject({
      method: 'POST',
      url: '/api/locks/handoff',
      headers: WRITER_A,
      payload: { path: TOPIC_D, targetUserId: 'u-writer-chen' },
    });
    expect(handoff.statusCode).toBe(200);

    const bSeesDraft = await getContent(app, WRITER_B, TOPIC_D);
    expect(bSeesDraft.json().content).toContain('HANDOFF_TITLE');
    const handedIn = await checkin(app, WRITER_B, [TOPIC_D], 'feat: finish handed-off topic');
    expect(handedIn.statusCode).toBe(200);
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_D), 'utf8')).toContain('HANDOFF_TITLE');
    expect(porcelain(fixture)).toBe('');

    // Cancel discards text draft, draft image and lock without dirtying the workDir.
    await checkout(app, WRITER_A, TOPIC_C);
    const baselineC = (await getContent(app, WRITER_A, TOPIC_C)).json().content as string;
    expect((await writeFile(app, WRITER_A, TOPIC_C, withTitle(baselineC, 'CANCEL_TITLE'))).statusCode).toBe(
      200,
    );

    const boundary = '----Phase13CancelBoundary';
    const upload = await app.inject({
      method: 'POST',
      url: '/api/assets/upload',
      headers: { ...WRITER_A, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: uploadedSvg(boundary, 'images', 'cancel-image.svg'),
    });
    expect(upload.statusCode).toBe(200);

    for (const target of [TOPIC_C, 'images/cancel-image.svg']) {
      const cancel = await app.inject({
        method: 'POST',
        url: '/api/locks/cancel',
        headers: WRITER_A,
        payload: { path: target },
      });
      expect(cancel.statusCode).toBe(200);
    }

    expect((await getContent(app, WRITER_A, TOPIC_C)).json().content).not.toContain('CANCEL_TITLE');
    const rawAfterCancel = await app.inject({
      method: 'GET',
      url: '/api/assets/raw?path=images%2Fcancel-image.svg&userId=u-writer-lin',
      headers: WRITER_A,
    });
    expect(rawAfterCancel.statusCode).toBe(404);
    expect(existsSync(path.join(fixture.projectDir, 'images/cancel-image.svg'))).toBe(false);
    expect(execSync(`find "${fixture.draftAssetsDir}" -type f | wc -l`, { encoding: 'utf8' }).trim()).toBe(
      '0',
    );

    const state = (await app.inject({ method: 'GET', url: '/api/locks', headers: WRITER_A })).json();
    expect(state.locks).toEqual([]);
    expect(state.drafts).toEqual([]);
    expect(porcelain(fixture)).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Read-only safety, single-flight worktrees, admin rules                  */
/* -------------------------------------------------------------------------- */

describe('Phase 13 §6.3 read-only safety, worktree single-flight and admin rules', () => {
  it('answers read-only requests for a missing branch with 404 and creates nothing', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);
    const branchesBefore = branches(fixture);
    const worktreesBefore = worktrees(fixture);

    const workspaceMiss = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: scoped(VIEWER, { branch: 'feature/missing' }),
    });
    expect(workspaceMiss.statusCode).toBe(404);

    const treeMiss = await app.inject({
      method: 'GET',
      url: '/api/files/tree',
      headers: scoped(VIEWER, { branch: 'feature/missing' }),
    });
    expect(treeMiss.statusCode).toBe(404);

    expect(branches(fixture)).toEqual(branchesBefore);
    expect(worktrees(fixture)).toEqual(worktreesBefore);

    // Viewers may still switch to an existing branch.
    const created = await app.inject({
      method: 'POST',
      url: '/api/git/branches',
      headers: ADMIN,
      payload: { name: 'feature/existing' },
    });
    expect(created.statusCode).toBe(200);
    const switched = await app.inject({
      method: 'POST',
      url: '/api/git/switch-branch',
      headers: VIEWER,
      payload: { branch: 'feature/existing' },
    });
    expect(switched.statusCode).toBe(200);
    expect(switched.json().branch).toBe('feature/existing');
  });

  it('serves 10 concurrent workspace reads with exactly one worktree per branch', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    const created = await app.inject({
      method: 'POST',
      url: '/api/git/branches',
      headers: ADMIN,
      payload: { name: 'feature/concurrent' },
    });
    expect(created.statusCode).toBe(200);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/workspace',
          headers: scoped(WRITER_B, { branch: 'feature/concurrent' }),
        }),
      ),
    );
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
    }

    const featureWorktrees = worktrees(fixture).filter((entry) => entry.includes('feature__concurrent'));
    expect(featureWorktrees).toHaveLength(1);
    expect(worktrees(fixture)).toHaveLength(2);
  });

  it('keeps colliding branch slugs in distinct worktree directories', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    for (const name of ['release/2.0', 'release__2.0']) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/git/branches',
        headers: ADMIN,
        payload: { name },
      });
      expect(created.statusCode).toBe(200);
    }

    const slash = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: scoped(WRITER_B, { branch: 'release/2.0' }),
    });
    const underscore = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: scoped(WRITER_B, { branch: 'release__2.0' }),
    });
    expect(slash.statusCode).toBe(200);
    expect(underscore.statusCode).toBe(200);
    expect(slash.json().rootDir).not.toBe(underscore.json().rootDir);

    const entries = worktrees(fixture);
    expect(entries).toHaveLength(3);
    expect(new Set(entries).size).toBe(3);
  });

  it('denies admin writes on a writer lock until force-unlock backs up the draft', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    await checkout(app, WRITER_A, TOPIC_A);
    const baselineA = (await getContent(app, WRITER_A, TOPIC_A)).json().content as string;
    expect((await writeFile(app, WRITER_A, TOPIC_A, withTitle(baselineA, 'LOCKED_BY_A'))).statusCode).toBe(
      200,
    );

    const adminWrite = await writeFile(app, ADMIN, TOPIC_A, withTitle(baselineA, 'ADMIN_OVERWRITE'));
    expect(adminWrite.statusCode).toBe(409);

    const forced = await app.inject({
      method: 'POST',
      url: '/api/locks/force-unlock',
      headers: ADMIN,
      payload: { path: TOPIC_A, reason: 'handover' },
    });
    expect(forced.statusCode).toBe(200);

    const handle = openDatabase(fixture.dbPath);
    const backups = handle.db.select().from(lockBackups).all();
    handle.close();
    expect(backups.some((row) => row.filePath === TOPIC_A && row.content?.includes('LOCKED_BY_A'))).toBe(
      true,
    );

    // The admin can now edit, and User A's draft is gone.
    const afterForce = await getContent(app, WRITER_A, TOPIC_A);
    expect(afterForce.json().content).not.toContain('LOCKED_BY_A');
    const adminWriteAfter = await writeFile(app, ADMIN, TOPIC_A, withTitle(baselineA, 'ADMIN_AFTER_FORCE'));
    expect(adminWriteAfter.statusCode).toBe(200);
    const adminCheckin = await checkin(app, ADMIN, [TOPIC_A], 'feat: admin takeover');
    expect(adminCheckin.statusCode).toBe(200);
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_A), 'utf8')).toContain('ADMIN_AFTER_FORCE');
    expect(porcelain(fixture)).toBe('');
  });

  it('expires locks by updatedAt and refreshes the TTL on re-checkout', async () => {
    process.env.DITA_LOCK_TTL_HOURS = '0.0002'; // 720ms
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    await checkout(app, WRITER_A, TOPIC_A);
    const first = (await app.inject({ method: 'GET', url: '/api/locks', headers: WRITER_A })).json()
      .locks as { filePath: string; expired: boolean; updatedAt: unknown }[];
    expect(first.find((lock) => lock.filePath === TOPIC_A)?.expired).toBe(false);
    const firstUpdatedAt = first.find((lock) => lock.filePath === TOPIC_A)!.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 900));
    const expired = (await app.inject({ method: 'GET', url: '/api/locks', headers: WRITER_A })).json()
      .locks as { filePath: string; expired: boolean }[];
    expect(expired.find((lock) => lock.filePath === TOPIC_A)?.expired).toBe(true);

    await checkout(app, WRITER_A, TOPIC_A);
    const refreshed = (await app.inject({ method: 'GET', url: '/api/locks', headers: WRITER_A })).json()
      .locks as { filePath: string; expired: boolean; updatedAt: unknown }[];
    const refreshedLock = refreshed.find((lock) => lock.filePath === TOPIC_A)!;
    expect(refreshedLock.expired).toBe(false);
    expect(String(refreshedLock.updatedAt)).not.toBe(String(firstUpdatedAt));
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Baseline publish, tags, optimistic locking, path decoupling & audit     */
/* -------------------------------------------------------------------------- */

describe('Phase 13 §6.4 publish provenance, optimistic locking, path decoupling, audit', () => {
  it('publishes the clean baseline and the caller overlay while another writer is dirty', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);
    const headCommit = git(fixture, 'rev-parse HEAD');

    // User A holds a broken draft on main; User B holds a valid one.
    await checkout(app, WRITER_A, TOPIC_A);
    expect((await writeFile(app, WRITER_A, TOPIC_A, BROKEN_XML)).statusCode).toBe(200);
    const baselineB = (await getContent(app, WRITER_B, TOPIC_B)).json().content as string;
    await checkout(app, WRITER_B, TOPIC_B);
    expect(
      (await writeFile(app, WRITER_B, TOPIC_B, withTitle(baselineB, B_OVERLAY_MARKER))).statusCode,
    ).toBe(200);

    const probesBeforeBaseline = markerProbeFiles(fixture);
    const baselineJob = await startPublish(app, WRITER_B, {
      themeId: 'dev-dark',
      htmlThemeOptions: { accentColor: '#123456', logoPath: 'images/architecture.svg' },
    });
    expect(baselineJob).toMatchObject({
      status: 'succeeded',
      sourceMode: 'baseline',
      isDirty: false,
      commitHash: headCommit,
    });
    const baselineProbe = freshProbes(fixture, probesBeforeBaseline).join('\n');
    expect(baselineProbe).toContain(`marker:${A_BROKEN_MARKER}=absent`);
    expect(baselineProbe).toContain(`marker:${B_OVERLAY_MARKER}=absent`);

    // HTML5 theme assets are resolved from the build snapshot and enhanced from the theme dir.
    const brandVars = execSync(
      `find "${fixture.publishRootDir}" -path '*_ditaeditor/brand-vars.css' -print -quit`,
      { encoding: 'utf8' },
    ).trim();
    expect(brandVars).not.toBe('');
    expect(readFileSync(brandVars, 'utf8')).toContain('#123456');

    const probesBeforeDrafts = markerProbeFiles(fixture);
    const draftsJob = await startPublish(app, WRITER_B, { sourceMode: 'my_drafts' });
    expect(draftsJob).toMatchObject({
      status: 'succeeded',
      sourceMode: 'my_drafts',
      isDirty: true,
    });
    expect(draftsJob.commitHash).toBe(headCommit);
    expect(draftsJob.dirtyFiles).toEqual([TOPIC_B]);
    const draftsProbe = freshProbes(fixture, probesBeforeDrafts).join('\n');
    expect(draftsProbe).toContain(`marker:${B_OVERLAY_MARKER}=present`);
    expect(draftsProbe).toContain(`marker:${A_BROKEN_MARKER}=absent`);
    expect(porcelain(fixture)).toBe('');

    // Audit trail records check-out and both publish jobs.
    const audit = (
      await app.inject({ method: 'GET', url: '/api/git/audit?limit=100', headers: ADMIN })
    ).json().logs as { action: string }[];
    const actions = audit.map((entry) => entry.action);
    expect(actions).toContain('checkout');
    expect(actions).toContain('publish');
  });

  it('publishes an exact historical tag snapshot', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    const tag = await app.inject({
      method: 'POST',
      url: '/api/git/tags',
      headers: ADMIN,
      payload: { name: 'v1.0.0', message: 'release 1.0' },
    });
    expect(tag.statusCode).toBe(200);
    const taggedCommit = git(fixture, 'rev-parse HEAD');

    // A later commit must never leak into the tag build.
    await checkout(app, ADMIN, TOPIC_A);
    const baselineA = (await getContent(app, ADMIN, TOPIC_A)).json().content as string;
    expect(
      (await writeFile(app, ADMIN, TOPIC_A, withTitle(baselineA, TAG_LATER_MARKER))).statusCode,
    ).toBe(200);
    expect((await checkin(app, ADMIN, [TOPIC_A], 'feat: later change')).statusCode).toBe(200);
    expect(git(fixture, 'rev-parse HEAD')).not.toBe(taggedCommit);

    const probesBeforeTag = markerProbeFiles(fixture);
    const tagJob = await startPublish(app, WRITER_B, {
      sourceMode: 'tag',
      sourceRef: 'v1.0.0',
    });
    expect(tagJob).toMatchObject({
      status: 'succeeded',
      sourceMode: 'tag',
      sourceRef: 'v1.0.0',
      isDirty: false,
      commitHash: taggedCommit,
    });
    const tagProbe = freshProbes(fixture, probesBeforeTag).join('\n');
    expect(tagProbe).toContain(`marker:${TAG_LATER_MARKER}=absent`);

    const audit = (
      await app.inject({ method: 'GET', url: '/api/git/audit?limit=100', headers: ADMIN })
    ).json().logs as { action: string }[];
    expect(audit.map((entry) => entry.action)).toContain('tag_create');
  });

  it('rejects stale expectedHash saves and never accepts a replayed edit', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    await checkout(app, WRITER_B, TOPIC_B);
    const read = await getContent(app, WRITER_B, TOPIC_B);
    const firstHash = read.json().contentHash as string;
    const content = read.json().content as string;

    const firstSave = await writeFile(app, WRITER_B, TOPIC_B, withTitle(content, 'FIRST_SAVE'), firstHash);
    expect(firstSave.statusCode).toBe(200);
    expect(firstSave.json().contentHash).toBeTruthy();
    expect(firstSave.json().contentHash).not.toBe(firstHash);

    const replay = await writeFile(app, WRITER_B, TOPIC_B, withTitle(content, 'SECOND_SAVE'), firstHash);
    expect(replay.statusCode).toBe(409);
    expect(replay.json().code).toBe('files.staleContent');
    expect(replay.json().currentHash).toBe(firstSave.json().contentHash);
    expect((await getContent(app, WRITER_B, TOPIC_B)).json().content).toContain('FIRST_SAVE');
    expect(porcelain(fixture)).toBe('');
  });

  it('keeps the manual identity when the directory moves on disk', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);

    const created = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: ADMIN,
      payload: {
        mode: 'create',
        name: 'Path Manual',
        parentDir: fixture.root,
        scaffold: 'blank',
        initGit: true,
      },
    });
    expect(created.statusCode).toBe(200);
    const manual = created.json().manual as { id: string; rootDir: string };
    const originalPath = manual.rootDir;
    expect(originalPath).toBe(realpathSync(path.join(fixture.root, 'Path-Manual')));
    const markerPath = path.join(originalPath, '.git', 'ditaeditor-id');
    expect(existsSync(markerPath)).toBe(true);
    expect(readFileSync(markerPath, 'utf8').trim()).toBe(manual.id);
    expect(execSync('git status --porcelain', { cwd: originalPath, encoding: 'utf8' }).trim()).toBe('');

    const movedPath = path.join(fixture.root, 'manual-moved');
    renameSync(originalPath, movedPath);
    expect(existsSync(originalPath)).toBe(false);

    const attached = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: ADMIN,
      payload: { mode: 'attach', rootDir: movedPath },
    });
    expect(attached.statusCode).toBe(200);
    expect(attached.json().manual.id).toBe(manual.id);
    expect(realpathSync(attached.json().manual.rootDir)).toBe(realpathSync(movedPath));
    expect(execSync('git status --porcelain', { cwd: movedPath, encoding: 'utf8' }).trim()).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Clean merge, restore / revert, branch cleanup                           */
/* -------------------------------------------------------------------------- */

describe('Phase 13 §6.5 merge, restore, revert and branch cleanup', () => {
  it('merges a feature branch cleanly and blocks merges under active locks', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    const created = await app.inject({
      method: 'POST',
      url: '/api/git/branches',
      headers: ADMIN,
      payload: { name: 'feature-merge' },
    });
    expect(created.statusCode).toBe(200);

    // Feature commit.
    const featureHeaders = scoped(WRITER_A, { branch: 'feature-merge' });
    await checkout(app, featureHeaders, TOPIC_E);
    const baselineE = (await getContent(app, featureHeaders, TOPIC_E)).json().content as string;
    expect((await writeFile(app, featureHeaders, TOPIC_E, withTitle(baselineE, 'FEATURE_TITLE'))).statusCode).toBe(
      200,
    );
    expect((await checkin(app, featureHeaders, [TOPIC_E], 'feat: feature title')).statusCode).toBe(200);

    // A lock on the target blocks the merge until it is released.
    await checkout(app, WRITER_B, TOPIC_E);
    const blockedPreview = await app.inject({
      method: 'GET',
      url: '/api/git/merge-preview?source=feature-merge&target=main',
      headers: ADMIN,
    });
    expect(blockedPreview.statusCode).toBe(200);
    expect((blockedPreview.json().blockingLocks as unknown[]).length).toBeGreaterThan(0);
    const blockedMerge = await app.inject({
      method: 'POST',
      url: '/api/git/merge',
      headers: ADMIN,
      payload: { sourceBranch: 'feature-merge' },
    });
    expect(blockedMerge.statusCode).toBe(409);
    await app.inject({
      method: 'POST',
      url: '/api/locks/cancel',
      headers: WRITER_B,
      payload: { path: TOPIC_E },
    });

    const preview = await app.inject({
      method: 'GET',
      url: '/api/git/merge-preview?source=feature-merge&target=main',
      headers: ADMIN,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ ahead: 1, hasConflicts: false });

    const merged = await app.inject({
      method: 'POST',
      url: '/api/git/merge',
      headers: ADMIN,
      payload: { sourceBranch: 'feature-merge' },
    });
    expect(merged.statusCode).toBe(200);
    expect(merged.json().changedFiles).toContain(TOPIC_E);
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_E), 'utf8')).toContain('FEATURE_TITLE');
    expect(porcelain(fixture)).toBe('');
  });

  it('previews conflicts, rejects malformed resolutions and merges a valid one', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    const created = await app.inject({
      method: 'POST',
      url: '/api/git/branches',
      headers: ADMIN,
      payload: { name: 'feature-conflict' },
    });
    expect(created.statusCode).toBe(200);

    const featureHeaders = scoped(WRITER_A, { branch: 'feature-conflict' });
    await checkout(app, featureHeaders, TOPIC_A);
    const featureBase = (await getContent(app, featureHeaders, TOPIC_A)).json().content as string;
    expect((await writeFile(app, featureHeaders, TOPIC_A, withTitle(featureBase, 'FEATURE_SIDE'))).statusCode).toBe(
      200,
    );
    expect((await checkin(app, featureHeaders, [TOPIC_A], 'feat: feature side')).statusCode).toBe(200);

    await checkout(app, WRITER_B, TOPIC_A);
    const mainBase = (await getContent(app, WRITER_B, TOPIC_A)).json().content as string;
    expect((await writeFile(app, WRITER_B, TOPIC_A, withTitle(mainBase, 'MAIN_SIDE'))).statusCode).toBe(200);
    expect((await checkin(app, WRITER_B, [TOPIC_A], 'feat: main side')).statusCode).toBe(200);

    const preview = await app.inject({
      method: 'GET',
      url: '/api/git/merge-preview?source=feature-conflict&target=main',
      headers: ADMIN,
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().hasConflicts).toBe(true);
    expect(preview.json().conflicts[0].path).toBe(TOPIC_A);

    const conflict = await app.inject({
      method: 'GET',
      url: `/api/git/merge-conflict?source=feature-conflict&target=main&path=${encodeURIComponent(TOPIC_A)}`,
      headers: ADMIN,
    });
    expect(conflict.statusCode).toBe(200);
    expect(conflict.json().ours).toContain('MAIN_SIDE');
    expect(conflict.json().theirs).toContain('FEATURE_SIDE');
    expect(typeof conflict.json().base).toBe('string');

    const malformed = await app.inject({
      method: 'POST',
      url: '/api/git/merge',
      headers: ADMIN,
      payload: {
        sourceBranch: 'feature-conflict',
        resolutions: { [TOPIC_A]: '<concept><title>RESOLVED_TITLE</title>' },
      },
    });
    expect(malformed.statusCode).toBe(422);
    expect(existsSync(path.join(fixture.projectDir, '.git', 'MERGE_HEAD'))).toBe(false);
    expect(porcelain(fixture)).toBe('');

    const resolved = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="workspace-model"><title>RESOLVED_TITLE</title><shortdesc>resolved</shortdesc><conbody><p>merged</p></conbody></concept>
`;
    const merged = await app.inject({
      method: 'POST',
      url: '/api/git/merge',
      headers: ADMIN,
      payload: { sourceBranch: 'feature-conflict', resolutions: { [TOPIC_A]: resolved } },
    });
    expect(merged.statusCode).toBe(200);
    expect((merged.json().changedFiles as string[]).length).toBeGreaterThan(0);
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_A), 'utf8')).toContain('RESOLVED_TITLE');
    expect(porcelain(fixture)).toBe('');
  });

  it('restores files in draft and commit mode, reverts cleanly and aborts conflicting reverts', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    // Create a second revision of TOPIC_A.
    await checkout(app, WRITER_A, TOPIC_A);
    const v1 = (await getContent(app, WRITER_A, TOPIC_A)).json().content as string;
    expect((await writeFile(app, WRITER_A, TOPIC_A, withTitle(v1, 'SECOND_REVISION'))).statusCode).toBe(200);
    expect((await checkin(app, WRITER_A, [TOPIC_A], 'feat: second revision')).statusCode).toBe(200);
    const secondRevisionCommit = git(fixture, 'rev-parse HEAD');

    // Draft-mode restore keeps the baseline untouched.
    const draftRestore = await app.inject({
      method: 'POST',
      url: '/api/git/restore-file',
      headers: WRITER_A,
      payload: { path: TOPIC_A, revision: 'HEAD~1', mode: 'draft' },
    });
    expect(draftRestore.statusCode).toBe(200);
    expect(draftRestore.json().mode).toBe('draft');
    expect(draftRestore.json().contentHash).toBeTruthy();
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_A), 'utf8')).toContain('SECOND_REVISION');
    expect((await getContent(app, WRITER_A, TOPIC_A)).json().content).not.toContain('SECOND_REVISION');
    expect(porcelain(fixture)).toBe('');
    await app.inject({
      method: 'POST',
      url: '/api/locks/cancel',
      headers: WRITER_A,
      payload: { path: TOPIC_A },
    });

    // Commit-mode restore rewrites the shared baseline.
    const commitRestore = await app.inject({
      method: 'POST',
      url: '/api/git/restore-file',
      headers: WRITER_B,
      payload: { path: TOPIC_A, revision: 'HEAD~1', mode: 'commit' },
    });
    expect(commitRestore.statusCode).toBe(200);
    expect(commitRestore.json().mode).toBe('commit');
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_A), 'utf8')).not.toContain('SECOND_REVISION');
    expect(porcelain(fixture)).toBe('');

    // Two further revisions of TOPIC_B give revert a clean and a conflicting target.
    await checkout(app, WRITER_A, TOPIC_B);
    const topicB = (await getContent(app, WRITER_A, TOPIC_B)).json().content as string;
    expect((await writeFile(app, WRITER_A, TOPIC_B, withTitle(topicB, 'B_SECOND'))).statusCode).toBe(200);
    expect((await checkin(app, WRITER_A, [TOPIC_B], 'feat: b second')).statusCode).toBe(200);
    const bSecondCommit = git(fixture, 'rev-parse HEAD');

    await checkout(app, WRITER_A, TOPIC_B);
    expect((await writeFile(app, WRITER_A, TOPIC_B, withTitle(topicB, 'B_THIRD'))).statusCode).toBe(200);
    expect((await checkin(app, WRITER_A, [TOPIC_B], 'feat: b third')).statusCode).toBe(200);
    const bThirdCommit = git(fixture, 'rev-parse HEAD');
    expect(bThirdCommit).not.toBe(bSecondCommit);
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_B), 'utf8')).toContain('B_THIRD');

    // Reverting the overwritten revision conflicts and leaves no merge/revert state behind.
    const conflictingRevert = await app.inject({
      method: 'POST',
      url: '/api/git/revert-commit',
      headers: WRITER_B,
      payload: { commitHash: bSecondCommit },
    });
    expect(conflictingRevert.statusCode).toBe(409);
    expect(existsSync(path.join(fixture.projectDir, '.git', 'REVERT_HEAD'))).toBe(false);
    expect(existsSync(path.join(fixture.projectDir, '.git', 'MERGE_HEAD'))).toBe(false);
    expect(porcelain(fixture)).toBe('');
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_B), 'utf8')).toContain('B_THIRD');

    // A revert whose inverse still applies cleanly succeeds.
    const cleanRevert = await app.inject({
      method: 'POST',
      url: '/api/git/revert-commit',
      headers: WRITER_B,
      payload: { commitHash: bThirdCommit },
    });
    expect(cleanRevert.statusCode).toBe(200);
    expect(cleanRevert.json().commit.hash).toBeTruthy();
    expect(readFileSync(path.join(fixture.projectDir, TOPIC_B), 'utf8')).toContain('B_SECOND');
    expect(porcelain(fixture)).toBe('');
    expect(existsSync(path.join(fixture.projectDir, '.git', 'REVERT_HEAD'))).toBe(false);

    const audit = (
      await app.inject({ method: 'GET', url: '/api/git/audit?limit=100', headers: WRITER_B })
    ).json().logs as { action: string }[];
    const actions = audit.map((entry) => entry.action);
    expect(actions).toContain('restore');
    expect(actions).toContain('revert');
  });

  it('protects main and deletes an unprotected branch together with its worktree', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await bootstrap(app, fixture);

    const created = await app.inject({
      method: 'POST',
      url: '/api/git/branches',
      headers: ADMIN,
      payload: { name: 'feature-cleanup' },
    });
    expect(created.statusCode).toBe(200);

    // Materialize its worktree first.
    const workspace = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: scoped(WRITER_B, { branch: 'feature-cleanup' }),
    });
    expect(workspace.statusCode).toBe(200);
    const worktreePath = workspace.json().rootDir as string;
    expect(existsSync(worktreePath)).toBe(true);

    const protectedDelete = await app.inject({
      method: 'DELETE',
      url: '/api/git/branches/main',
      headers: scoped(ADMIN, { branch: 'feature-cleanup' }),
    });
    expect(protectedDelete.statusCode).toBe(403);

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/api/git/branches/feature-cleanup?force=true',
      headers: ADMIN,
    });
    expect(deleted.statusCode).toBe(200);
    expect(branches(fixture)).not.toContain('feature-cleanup');
    expect(existsSync(worktreePath)).toBe(false);
    expect(worktrees(fixture)).toHaveLength(1);
  });
});
