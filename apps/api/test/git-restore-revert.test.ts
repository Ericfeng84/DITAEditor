import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { apiT } from '../src/i18n/messages.js';
import { createServer } from '../src/index.js';

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER_A = { 'x-dita-user-id': 'u-writer-lin' };
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };

const TOPIC_A = 'concepts/workspace-model.dita';
const TOPIC_B = 'concepts/single-sourcing.dita';
const TOPIC_D = 'references/rest-api-endpoints.dita';

interface Fixture {
  projectDir: string;
  importsDir: string;
  dbPath: string;
  worktreesRootDir: string;
}

interface GitStatusBody {
  initialized: boolean;
  branch: string;
  locks: { filePath: string; userId: string; userName: string }[];
  userDrafts: {
    filePath: string;
    userId: string;
    op: string;
    originalPath: string | null;
    contentHash: string | null;
  }[];
}

interface ContentBody {
  path: string;
  content: string;
  contentHash: string;
}

interface DiffBody {
  additions: number;
  deletions: number;
  oldExists: boolean;
  newExists: boolean;
  binary: boolean;
}

interface RestoreBody {
  path: string;
  revision: string;
  mode: string;
  unchanged: boolean;
  clearedDraft?: boolean;
  contentHash?: string;
}

const tempDirs: string[] = [];
const openApps: { close: () => Promise<void> }[] = [];

afterEach(async () => {
  while (openApps.length > 0) {
    await openApps.pop()?.close();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function createFixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-restore-revert-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  // Start from a pristine, non-Git workspace even if the sample carries a local repository.
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    projectDir,
    importsDir: path.join(root, 'imports'),
    dbPath: path.join(root, 'restore-revert.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
  };
}

type App = ReturnType<typeof createServer>;

async function createApp(): Promise<{ app: App; fixture: Fixture }> {
  const fixture = createFixture();
  const app = createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    logger: false,
  });
  await app.ready();
  openApps.push(app);
  return { app, fixture };
}

// --- Fixture helpers (the shared work dir always mirrors the baseline) ---

function git(fixture: Fixture, args: string[]): string {
  return execFileSync('git', args, { cwd: fixture.projectDir, encoding: 'utf8' }).trim();
}

function headRevision(fixture: Fixture): string {
  return git(fixture, ['rev-parse', 'HEAD']);
}

/** Commits an out-of-band baseline change, mirroring a desktop editor / external tool. */
function commitOnDisk(fixture: Fixture, message: string): string {
  const options = { cwd: fixture.projectDir, encoding: 'utf8' as const };
  execFileSync('git', ['add', '-A'], options);
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Restore Revert Test',
      '-c',
      'user.email=restore-revert@example.com',
      'commit',
      '--no-gpg-sign',
      '-m',
      message,
    ],
    options,
  );
  return headRevision(fixture);
}

function porcelain(fixture: Fixture): string {
  try {
    return git(fixture, ['status', '--porcelain']);
  } catch {
    return '';
  }
}

/** A revert left mid-flight would keep `REVERT_HEAD` behind; it must never survive an error. */
function hasRevertHead(fixture: Fixture): boolean {
  try {
    git(fixture, ['rev-parse', '--verify', 'REVERT_HEAD']);
    return true;
  } catch {
    return false;
  }
}

function baselinePath(fixture: Fixture, filePath: string): string {
  return path.join(fixture.projectDir, filePath);
}

function readBaseline(fixture: Fixture, filePath: string): string {
  return readFileSync(baselinePath(fixture, filePath), 'utf8');
}

function writeBaseline(fixture: Fixture, filePath: string, content: string): void {
  writeFileSync(baselinePath(fixture, filePath), content, 'utf8');
}

/**
 * Rewrites the single `<title>` line, so the resulting diff is exactly one addition and one
 * deletion while the file keeps the same number of lines.
 */
function withTitleMarker(content: string, marker: string): string {
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.includes('<title>') && line.includes('</title>'));
  if (index === -1) throw new Error('The fixture topic has no single-line <title>.');
  const line = lines[index]!;
  const start = line.indexOf('<title>') + '<title>'.length;
  const title = line.slice(start, line.indexOf('</title>'));
  lines[index] = line.replace(`<title>${title}</title>`, `<title>${title} ${marker}</title>`);
  return lines.join('\n');
}

// --- API helpers ---

async function bootstrap(app: App): Promise<void> {
  const response = await app.inject({ method: 'POST', url: '/api/git/init', headers: ADMIN });
  expect(response.statusCode).toBe(200);
  expect(response.json<{ created: boolean }>().created).toBe(true);
}

async function statusOf(app: App, headers: Record<string, string>): Promise<GitStatusBody> {
  const response = await app.inject({ method: 'GET', url: '/api/git/status', headers });
  expect(response.statusCode).toBe(200);
  return response.json<GitStatusBody>();
}

async function contentOf(
  app: App,
  headers: Record<string, string>,
  filePath: string,
): Promise<ContentBody> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/files/content?path=${encodeURIComponent(filePath)}`,
    headers,
  });
  expect(response.statusCode).toBe(200);
  return response.json<ContentBody>();
}

async function checkout(app: App, headers: Record<string, string>, filePath: string): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/locks/checkout',
    headers,
    payload: { path: filePath },
  });
  expect(response.statusCode).toBe(200);
}

async function saveContent(
  app: App,
  headers: Record<string, string>,
  filePath: string,
  content: string,
): Promise<ContentBody> {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/files/content',
    headers,
    payload: { path: filePath, content },
  });
  expect(response.statusCode).toBe(200);
  return response.json<ContentBody>();
}

async function checkin(
  app: App,
  headers: Record<string, string>,
  paths: string[],
  message: string,
): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/locks/checkin',
    headers,
    payload: { paths, message },
  });
  expect(response.statusCode).toBe(200);
}

function revertCommit(app: App, headers: Record<string, string>, commitHash: string) {
  return app.inject({
    method: 'POST',
    url: '/api/git/revert-commit',
    headers,
    payload: { commitHash },
  });
}

function restoreFile(
  app: App,
  headers: Record<string, string>,
  filePath: string,
  revision: string,
) {
  return app.inject({
    method: 'POST',
    url: '/api/git/restore-file',
    headers,
    payload: { path: filePath, revision, mode: 'draft' },
  });
}

async function diffStats(
  app: App,
  headers: Record<string, string>,
  filePath: string,
): Promise<DiffBody> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/git/diff?path=${encodeURIComponent(filePath)}`,
    headers,
  });
  expect(response.statusCode).toBe(200);
  return response.json<DiffBody>();
}

/** Creates the "modify one topic + delete another" commit shared by the revert scenarios. */
function commitWithModifyAndDelete(fixture: Fixture): { target: string; before: string } {
  const before = readBaseline(fixture, TOPIC_A);
  writeBaseline(fixture, TOPIC_A, withTitleMarker(before, 'REVERT_ME'));
  rmSync(baselinePath(fixture, TOPIC_D));
  const target = commitOnDisk(fixture, 'test: modify a topic and drop an outdated reference');
  return { target, before };
}

describe('Phase 13 restore / revert backend fixes', () => {
  it('API-1: reverts a commit that modified and deleted files and reports changedFiles', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const { target, before } = commitWithModifyAndDelete(fixture);
    // The committed change is on disk before the revert touches it.
    expect(readBaseline(fixture, TOPIC_A)).toContain('REVERT_ME');
    expect(existsSync(baselinePath(fixture, TOPIC_D))).toBe(false);

    const response = await revertCommit(app, WRITER_B, target);
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      commit: { hash: string };
      changedFiles: string[];
      status: GitStatusBody;
    }>();

    expect(body.commit.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(body.commit.hash).toBe(headRevision(fixture));
    expect([...body.changedFiles].sort()).toEqual([TOPIC_A, TOPIC_D].sort());
    expect(body.status.branch).toBe('main');

    // Baseline restored: the edit is gone and the deleted topic is back on disk.
    expect(readBaseline(fixture, TOPIC_A)).toBe(before);
    expect(existsSync(baselinePath(fixture, TOPIC_D))).toBe(true);
    expect(porcelain(fixture)).toBe('');
    expect(hasRevertHead(fixture)).toBe(false);
  });

  it("API-2: blocks the revert while another member holds a lock on an affected file", async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const { target, before } = commitWithModifyAndDelete(fixture);
    await checkout(app, WRITER_B, TOPIC_A);

    const headBefore = headRevision(fixture);
    const response = await revertCommit(app, WRITER_A, target);

    expect(response.statusCode).toBe(409);
    const body = response.json<{
      error: string;
      paths: string[];
      locks: { filePath: string; userId: string }[];
    }>();
    expect(body.error).toBe(apiT('zh-CN', 'git.revertBlockedByLocks', { paths: TOPIC_A }));
    expect(body.paths).toEqual([TOPIC_A]);
    expect(body.locks.map((lock) => lock.filePath)).toEqual([TOPIC_A]);
    expect(body.locks.map((lock) => lock.userId)).toEqual([WRITER_B['x-dita-user-id']]);

    // Nothing happened: same HEAD, same baseline, no half-finished revert on disk.
    expect(headRevision(fixture)).toBe(headBefore);
    expect(readBaseline(fixture, TOPIC_A)).toBe(withTitleMarker(before, 'REVERT_ME'));
    expect(existsSync(baselinePath(fixture, TOPIC_D))).toBe(false);
    expect(porcelain(fixture)).toBe('');
    expect(hasRevertHead(fixture)).toBe(false);
  });

  it('API-3: blocks the revert while the caller has an uncommitted draft on an affected file', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const before = readBaseline(fixture, TOPIC_B);
    writeBaseline(fixture, TOPIC_B, withTitleMarker(before, 'COMMITTED_ELSEWHERE'));
    const target = commitOnDisk(fixture, 'test: revise a topic that another member is editing');

    await checkout(app, WRITER_A, TOPIC_B);
    const draftContent = withTitleMarker(readBaseline(fixture, TOPIC_B), 'LOCAL_DRAFT');
    await saveContent(app, WRITER_A, TOPIC_B, draftContent);
    const beforeStatus = await statusOf(app, WRITER_A);
    expect(beforeStatus.userDrafts.map((draft) => draft.filePath)).toEqual([TOPIC_B]);

    const response = await revertCommit(app, WRITER_A, target);

    expect(response.statusCode).toBe(409);
    const body = response.json<{ error: string; paths: string[] }>();
    expect(body.error).toBe(apiT('zh-CN', 'git.revertBlockedByDrafts', { paths: TOPIC_B }));
    expect(body.paths).toEqual([TOPIC_B]);

    // The draft survives untouched and the baseline still carries the committed revision.
    const afterStatus = await statusOf(app, WRITER_A);
    expect(afterStatus.userDrafts).toEqual(beforeStatus.userDrafts);
    expect((await contentOf(app, WRITER_A, TOPIC_B)).content).toBe(draftContent);
    expect(headRevision(fixture)).toBe(target);
    expect(readBaseline(fixture, TOPIC_B)).toBe(withTitleMarker(before, 'COMMITTED_ELSEWHERE'));
    expect(porcelain(fixture)).toBe('');
  });

  it('API-4: restores an older revision into the caller personal draft', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const original = readBaseline(fixture, TOPIC_A);

    await checkout(app, WRITER_A, TOPIC_A);
    await saveContent(app, WRITER_A, TOPIC_A, withTitleMarker(original, 'SECOND_REVISION'));
    await checkin(app, WRITER_A, [TOPIC_A], 'test: publish a second revision');
    const published = readBaseline(fixture, TOPIC_A);
    expect(published).toContain('SECOND_REVISION');

    const response = await restoreFile(app, WRITER_B, TOPIC_A, 'HEAD~1');
    expect(response.statusCode).toBe(200);
    const body = response.json<RestoreBody>();
    expect(body.path).toBe(TOPIC_A);
    expect(body.mode).toBe('draft');
    expect(body.unchanged).toBe(false);
    expect(body.contentHash).toBeTruthy();

    // The personal draft now serves the historical revision while the baseline keeps HEAD.
    const restored = await contentOf(app, WRITER_B, TOPIC_A);
    expect(restored.content).not.toBe(published);
    expect(restored.content).not.toContain('SECOND_REVISION');
    expect(restored.content).toBe(original);
    expect(restored.contentHash).toBe(body.contentHash);
    expect(readBaseline(fixture, TOPIC_A)).toBe(published);

    const status = await statusOf(app, WRITER_B);
    expect(status.userDrafts.map((draft) => draft.filePath)).toEqual([TOPIC_A]);
    expect(status.userDrafts[0]?.op).toBe('edit');
    // Restoring into a draft still requires the check-out that guards the write.
    expect(status.locks.map((lock) => lock.filePath)).toContain(TOPIC_A);
    expect(porcelain(fixture)).toBe('');
  });

  it('API-5: reports unchanged and skips the check-out when HEAD already matches', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const head = headRevision(fixture);
    const headContent = readBaseline(fixture, TOPIC_A);

    const response = await restoreFile(app, WRITER_B, TOPIC_A, head);
    expect(response.statusCode).toBe(200);
    const body = response.json<RestoreBody>();
    expect(body.unchanged).toBe(true);
    expect(body.clearedDraft).toBeUndefined();
    expect(body.contentHash).toBe((await contentOf(app, WRITER_B, TOPIC_A)).contentHash);

    // No ghost lock, no zero-diff draft.
    const status = await statusOf(app, WRITER_B);
    expect(status.userDrafts).toEqual([]);
    expect(status.locks).toEqual([]);
    expect(readBaseline(fixture, TOPIC_A)).toBe(headContent);
    expect(porcelain(fixture)).toBe('');
  });

  it('API-6: clears a redundant draft when the restored revision matches HEAD', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const headContent = readBaseline(fixture, TOPIC_A);

    await checkout(app, WRITER_A, TOPIC_A);
    await saveContent(app, WRITER_A, TOPIC_A, withTitleMarker(headContent, 'LOCAL_ONLY'));
    expect((await statusOf(app, WRITER_A)).userDrafts).toHaveLength(1);

    const response = await restoreFile(app, WRITER_A, TOPIC_A, 'HEAD');
    expect(response.statusCode).toBe(200);
    const body = response.json<RestoreBody>();
    expect(body.unchanged).toBe(false);
    expect(body.clearedDraft).toBe(true);
    expect(body.contentHash).toBe((await contentOf(app, WRITER_A, TOPIC_A)).contentHash);

    // The ghost draft is gone and the caller reads the plain baseline again.
    expect((await contentOf(app, WRITER_A, TOPIC_A)).content).toBe(headContent);
    const status = await statusOf(app, WRITER_A);
    expect(status.userDrafts).toEqual([]);
    expect(status.locks).toEqual([]);
    expect(readBaseline(fixture, TOPIC_A)).toBe(headContent);
    expect(porcelain(fixture)).toBe('');
  });

  it('API-7: restores a file deleted in HEAD as a fresh create draft', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const original = readBaseline(fixture, TOPIC_D);
    const lastRevisionWithFile = headRevision(fixture);

    rmSync(baselinePath(fixture, TOPIC_D));
    commitOnDisk(fixture, 'test: drop an outdated reference');
    expect(existsSync(baselinePath(fixture, TOPIC_D))).toBe(false);

    const response = await restoreFile(app, WRITER_A, TOPIC_D, lastRevisionWithFile);
    expect(response.statusCode).toBe(200);
    const body = response.json<RestoreBody>();
    expect(body.unchanged).toBe(false);
    expect(body.clearedDraft).toBeUndefined();

    const status = await statusOf(app, WRITER_A);
    expect(status.userDrafts.map((draft) => draft.filePath)).toEqual([TOPIC_D]);
    // The file is absent from the baseline, so the draft must be a create, not an edit.
    expect(status.userDrafts[0]?.op).toBe('create');
    expect((await contentOf(app, WRITER_A, TOPIC_D)).content).toBe(original);
    // The restored file lives in the personal overlay only.
    expect(existsSync(baselinePath(fixture, TOPIC_D))).toBe(false);
    expect(porcelain(fixture)).toBe('');
  });

  it('API-8: reports exact line stats for identical content and single-line edits', async () => {
    const { app, fixture } = await createApp();
    await bootstrap(app);
    const baseline = readBaseline(fixture, TOPIC_A);

    await checkout(app, WRITER_A, TOPIC_A);
    await saveContent(app, WRITER_A, TOPIC_A, baseline);
    const identical = await diffStats(app, WRITER_A, TOPIC_A);
    expect(identical.oldExists).toBe(true);
    expect(identical.newExists).toBe(true);
    expect(identical.binary).toBe(false);
    expect(identical.additions).toBe(0);
    expect(identical.deletions).toBe(0);

    await saveContent(app, WRITER_A, TOPIC_A, withTitleMarker(baseline, 'ONE_LINE_EDIT'));
    const edited = await diffStats(app, WRITER_A, TOPIC_A);
    expect(edited.additions).toBe(1);
    expect(edited.deletions).toBe(1);
    expect(porcelain(fixture)).toBe('');
  });
});
