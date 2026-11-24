import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';

const tempDirs: string[] = [];
const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const TOPIC = 'concepts/single-sourcing.dita';

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase10-manuals-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'manual-a');
  const otherDir = path.join(root, 'manual-b');
  const importsDir = path.join(root, 'imports');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  cpSync(SAMPLE_ROOT, otherDir, { recursive: true });
  for (const dir of [projectDir, otherDir]) {
    rmSync(path.join(dir, '.git'), { recursive: true, force: true });
    rmSync(path.join(dir, '.gitignore'), { force: true });
  }
  return {
    root,
    projectDir,
    otherDir,
    importsDir,
    dbPath: path.join(root, 'phase10-manuals.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 10 manual workbench API', () => {
  it('registers the builtin manual, creates/attaches manuals and isolates reads per manual', async () => {
    const fixture = createFixture();
    const app = createServer({
      workspaceDir: fixture.projectDir,
      importsRootDir: fixture.importsDir,
      dbPath: fixture.dbPath,
      worktreesRootDir: fixture.worktreesRootDir,
      logger: false,
    });
    await app.ready();

    // The legacy default workspace is adopted as the builtin manual on startup.
    const listResponse = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.json();
    expect(list.manuals).toHaveLength(1);
    expect(list.manuals[0]).toMatchObject({ isBuiltin: true, exists: true, archived: false });
    expect(list.manuals[0].rootDir).toBe(fixture.projectDir);
    expect(list.manuals[0].stats.totalTopics).toBeGreaterThan(0);
    expect(list.activeManualId).toBe(list.manuals[0].id);
    const builtinId: string = list.manuals[0].id;

    // Create a brand new manual inside the imports root.
    const created = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: WRITER,
      payload: { name: '产品手册 2026', description: '新手册', scaffold: 'starter' },
    });
    expect(created.statusCode).toBe(200);
    const createdManual = created.json().manual;
    expect(createdManual.name).toBe('产品手册 2026');
    expect(createdManual.description).toBe('新手册');
    expect(existsSync(createdManual.rootDir)).toBe(true);

    // Attach an existing directory as a manual.
    const attached = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: ADMIN,
      payload: { mode: 'attach', rootDir: fixture.otherDir },
    });
    expect(attached.statusCode).toBe(200);
    const attachedManual = attached.json().manual;
    expect(attachedManual.rootDir).toBe(fixture.otherDir);
    expect(attachedManual.stats.totalTopics).toBeGreaterThan(0);

    // Attaching twice is idempotent (same manual id).
    const reattached = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: ADMIN,
      payload: { mode: 'attach', rootDir: fixture.otherDir },
    });
    expect(reattached.json().manual.id).toBe(attachedManual.id);

    // Every read route follows x-dita-manual-id instead of one mutable process singleton.
    const readA = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: { ...ADMIN, 'x-dita-manual-id': builtinId },
    });
    const readB = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: { ...ADMIN, 'x-dita-manual-id': attachedManual.id },
    });
    expect(readA.json().projectRootDir).toBe(fixture.projectDir);
    expect(readB.json().projectRootDir).toBe(fixture.otherDir);

    // Writing in manual B never leaks into manual A (writes need an exclusive checkout first).
    const checkoutB = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: { ...WRITER, 'x-dita-manual-id': attachedManual.id },
      payload: { path: TOPIC },
    });
    expect(checkoutB.statusCode).toBe(200);
    const writeB = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: { ...WRITER, 'x-dita-manual-id': attachedManual.id },
      payload: { path: TOPIC, content: '<?xml version="1.0"?><concept id="x"><title>B</title></concept>' },
    });
    expect(writeB.statusCode).toBe(200);
    const contentA = await app.inject({
      method: 'GET',
      url: `/api/files/content?path=${encodeURIComponent(TOPIC)}`,
      headers: { ...ADMIN, 'x-dita-manual-id': builtinId },
    });
    expect(contentA.json().content).not.toContain('<title>B</title>');
    const contentB = await app.inject({
      method: 'GET',
      url: `/api/files/content?path=${encodeURIComponent(TOPIC)}`,
      headers: { ...ADMIN, 'x-dita-manual-id': attachedManual.id },
    });
    expect(contentB.json().content).toContain('<title>B</title>');

    // Metadata edits, archive filtering and touch bookkeeping.
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/manuals/${attachedManual.id}`,
      headers: ADMIN,
      payload: { name: '术语手册' },
    });
    expect(renamed.json().manual.name).toBe('术语手册');
    const archived = await app.inject({
      method: 'PATCH',
      url: `/api/manuals/${attachedManual.id}`,
      headers: ADMIN,
      payload: { archived: true },
    });
    expect(archived.json().manual.archived).toBe(true);
    const visible = await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN });
    expect(visible.json().manuals.some((m: { id: string }) => m.id === attachedManual.id)).toBe(false);
    const withArchived = await app.inject({
      method: 'GET',
      url: '/api/manuals?includeArchived=1',
      headers: ADMIN,
    });
    expect(withArchived.json().manuals.some((m: { id: string }) => m.id === attachedManual.id)).toBe(true);

    const touched = await app.inject({
      method: 'POST',
      url: `/api/manuals/${attachedManual.id}/touch`,
      headers: ADMIN,
    });
    expect(touched.json().manual.lastOpenedAt).toBeTruthy();

    // Guard rails.
    const viewerCreate = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: VIEWER,
      payload: { name: '不应创建' },
    });
    expect(viewerCreate.statusCode).toBe(403);
    const removeBuiltin = await app.inject({
      method: 'DELETE',
      url: `/api/manuals/${builtinId}`,
      headers: ADMIN,
    });
    expect(removeBuiltin.statusCode).toBe(403);
    const missing = await app.inject({ method: 'GET', url: '/api/manuals/manual_missing' });
    expect(missing.statusCode).toBe(404);

    // Removing a manual never deletes the folder on disk.
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/manuals/${attachedManual.id}`,
      headers: ADMIN,
    });
    expect(removed.statusCode).toBe(200);
    expect(existsSync(fixture.otherDir)).toBe(true);
    expect(readFileSync(path.join(fixture.otherDir, TOPIC), 'utf8')).toContain('<title>B</title>');

    await app.close();
  }, 30_000);

  it('keeps branches isolated per manual without cross-talk', async () => {
    const fixture = createFixture();
    const app = createServer({
      workspaceDir: fixture.projectDir,
      importsRootDir: fixture.importsDir,
      dbPath: fixture.dbPath,
      worktreesRootDir: fixture.worktreesRootDir,
      logger: false,
    });
    await app.ready();

    const list = (await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN })).json();
    const manualId: string = list.manuals[0].id;
    const scoped = { ...ADMIN, 'x-dita-manual-id': manualId };

    await app.inject({ method: 'POST', url: '/api/git/init', headers: scoped });
    await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: scoped,
      payload: { path: TOPIC },
    });
    const source = readFileSync(path.join(fixture.projectDir, TOPIC), 'utf8');
    await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: scoped,
      payload: { path: TOPIC, content: source.replace('</concept>', '  <p>基线</p>\n</concept>') },
    });
    const commit = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: scoped,
      payload: { paths: [TOPIC], message: 'docs: 初始化手册基线' },
    });
    expect(commit.statusCode).toBe(200);
    const branch = await app.inject({
      method: 'POST',
      url: '/api/git/branches',
      headers: scoped,
      payload: { name: 'release/2026' },
    });
    expect(branch.statusCode).toBe(200);

    const switched = await app.inject({
      method: 'POST',
      url: '/api/git/switch-branch',
      headers: scoped,
      payload: { branch: 'release/2026' },
    });
    expect(switched.statusCode).toBe(200);
    const worktree = switched.json().workDir;
    expect(worktree).not.toBe(fixture.projectDir);
    expect(switched.json().snapshot.projectRootDir).toBe(fixture.projectDir);

    // Explicit branch header wins; the branch the client switched to stays remembered.
    const onBranch = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: { ...ADMIN, 'x-dita-manual-id': manualId, 'x-dita-branch': 'release/2026' },
    });
    expect(realpathSync(onBranch.json().rootDir)).toBe(realpathSync(worktree));
    const remembered = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: scoped,
    });
    expect(remembered.json().projectRootDir).toBe(fixture.projectDir);
    expect(realpathSync(remembered.json().rootDir)).toBe(realpathSync(worktree));

    const backOnMain = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: { ...ADMIN, 'x-dita-manual-id': manualId, 'x-dita-branch': 'main' },
    });
    expect(realpathSync(backOnMain.json().rootDir)).toBe(realpathSync(fixture.projectDir));

    const unknownManual = await app.inject({
      method: 'GET',
      url: '/api/workspace',
      headers: { ...ADMIN, 'x-dita-manual-id': 'manual_unknown' },
    });
    expect(unknownManual.statusCode).toBe(404);

    await app.close();
  }, 30_000);

  it('bridges the legacy workspace routes onto the manual registry', async () => {
    const fixture = createFixture();
    const app = createServer({
      workspaceDir: fixture.projectDir,
      importsRootDir: fixture.importsDir,
      dbPath: fixture.dbPath,
      worktreesRootDir: fixture.worktreesRootDir,
      logger: false,
    });
    await app.ready();

    const created = await app.inject({
      method: 'POST',
      url: '/api/workspaces/create',
      headers: ADMIN,
      payload: { name: 'legacy-bridge' },
    });
    expect(created.statusCode).toBe(200);
    const createdDir: string = created.json().rootDir;

    const list = (await app.inject({ method: 'GET', url: '/api/manuals', headers: ADMIN })).json();
    const bridged = list.manuals.find((m: { rootDir: string }) => m.rootDir === createdDir);
    expect(bridged).toBeTruthy();
    expect(list.activeManualId).toBe(bridged.id);

    // A header-less request follows the last opened manual.
    const headerless = await app.inject({ method: 'GET', url: '/api/workspace', headers: ADMIN });
    expect(headerless.json().projectRootDir).toBe(createdDir);

    writeFileSync(path.join(createdDir, 'topics', 'note.txt'), 'keep me', 'utf8');
    const forgotten = await app.inject({
      method: 'POST',
      url: '/api/workspaces/forget',
      headers: ADMIN,
      payload: { path: createdDir },
    });
    expect(forgotten.statusCode).toBe(200);
    const afterForget = (await app.inject({ method: 'GET', url: '/api/manuals?includeArchived=1', headers: ADMIN })).json();
    expect(afterForget.manuals.some((m: { rootDir: string }) => m.rootDir === createdDir)).toBe(false);
    expect(existsSync(createdDir)).toBe(true);

    await app.close();
  }, 30_000);
});
