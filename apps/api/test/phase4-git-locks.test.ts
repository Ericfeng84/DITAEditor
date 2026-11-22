import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';

const tempDirs: string[] = [];
const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER_A = { 'x-dita-user-id': 'u-writer-lin' };
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const FILE_A = 'concepts/single-sourcing.dita';
const FILE_B = 'concepts/workspace-model.dita';

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase4-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  const importsDir = path.join(root, 'imports');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  // The checked-in sample may have a local Git repository after manual use;
  // each test starts from a pristine, non-Git workspace.
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    root,
    projectDir,
    importsDir,
    dbPath: path.join(root, 'phase4.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 4 Git + check-out locks', () => {
  // Full end-to-end git + lock flow (checkout, commit, diff, worktree branch); it needs more
  // than Vitest's 5 s default when the workspace test matrix runs in parallel.
  it('enforces role/lock rules, commits, diffs and branch isolation', async () => {
    const fixture = createFixture();
    const app = createServer({
      workspaceDir: fixture.projectDir,
      importsRootDir: fixture.importsDir,
      dbPath: fixture.dbPath,
      worktreesRootDir: fixture.worktreesRootDir,
      logger: false,
    });
    await app.ready();

    // Identity + roles
    const identityResponse = await app.inject({ method: 'GET', url: '/api/identity' });
    expect(identityResponse.statusCode).toBe(200);
    const identity = identityResponse.json();
    expect(identity.currentUser).toMatchObject({ id: 'u-admin', role: 'admin' });
    expect(identity.users.map((user: { role: string }) => user.role)).toEqual([
      'admin',
      'writer',
      'writer',
      'viewer',
    ]);

    // Git starts uninitialized
    const initialStatus = await app.inject({
      method: 'GET',
      url: '/api/git/status',
      headers: ADMIN,
    });
    expect(initialStatus.statusCode).toBe(200);
    expect(initialStatus.json().initialized).toBe(false);

    const initResponse = await app.inject({
      method: 'POST',
      url: '/api/git/init',
      headers: ADMIN,
      payload: {},
    });
    expect(initResponse.statusCode).toBe(200);
    expect(initResponse.json().status.initialized).toBe(true);

    // Viewer cannot initialize or check out
    const viewerInit = await app.inject({
      method: 'POST',
      url: '/api/git/init',
      headers: VIEWER,
      payload: {},
    });
    expect(viewerInit.statusCode).toBe(403);

    // Writer A checks out FILE_A
    const checkoutA = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: WRITER_A,
      payload: { path: FILE_A },
    });
    expect(checkoutA.statusCode).toBe(200);
    expect(checkoutA.json().lock).toMatchObject({ filePath: FILE_A, userId: 'u-writer-lin' });

    // Writer B is blocked on the same file, but free on a different file
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: WRITER_B,
      payload: { path: FILE_A },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toContain('林知远');

    const checkoutB = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: WRITER_B,
      payload: { path: FILE_B },
    });
    expect(checkoutB.statusCode).toBe(200);

    const viewerCheckout = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: VIEWER,
      payload: { path: FILE_B },
    });
    expect(viewerCheckout.statusCode).toBe(403);

    // Only the lock owner may save
    const contentA = readFileSync(path.join(fixture.projectDir, FILE_A), 'utf8');
    const saveA = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: WRITER_A,
      payload: { path: FILE_A, content: `${contentA}\n<!-- writer A edit -->\n` },
    });
    expect(saveA.statusCode).toBe(200);

    const blockedSave = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: WRITER_B,
      payload: { path: FILE_A, content: 'should not be saved' },
    });
    expect(blockedSave.statusCode).toBe(409);

    const contentB = readFileSync(path.join(fixture.projectDir, FILE_B), 'utf8');
    const saveB = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: WRITER_B,
      payload: { path: FILE_B, content: `${contentB}\n<!-- writer B edit -->\n` },
    });
    expect(saveB.statusCode).toBe(200);

    const viewerSave = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: VIEWER,
      payload: { path: FILE_B, content: 'read-only' },
    });
    expect(viewerSave.statusCode).toBe(403);

    const dirtyStatus = await app.inject({
      method: 'GET',
      url: '/api/git/status',
      headers: WRITER_B,
    });
    expect(dirtyStatus.statusCode).toBe(200);
    const dirtyPaths = dirtyStatus.json().dirtyFiles.map((file: { path: string }) => file.path);
    expect(dirtyPaths).toContain(FILE_A);
    expect(dirtyPaths).toContain(FILE_B);

    // Check-in commits only own files and releases the lock
    const checkin = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: WRITER_A,
      payload: { paths: [FILE_A], message: 'docs: 更新单源化概念' },
    });
    expect(checkin.statusCode).toBe(200);
    expect(checkin.json().commit.message).toBe('docs: 更新单源化概念');
    expect(checkin.json().commit.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(checkin.json().locks.map((lock: { filePath: string }) => lock.filePath)).not.toContain(FILE_A);

    const checkinOther = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: WRITER_A,
      payload: { paths: [FILE_B], message: 'steal' },
    });
    expect(checkinOther.statusCode).toBe(403);

    // History + diff of two versions
    const log = await app.inject({
      method: 'GET',
      url: `/api/git/log?path=${encodeURIComponent(FILE_A)}`,
      headers: WRITER_B,
    });
    expect(log.statusCode).toBe(200);
    expect(log.json().commits[0].message).toBe('docs: 更新单源化概念');

    const diff = await app.inject({
      method: 'GET',
      url: `/api/git/diff?path=${encodeURIComponent(FILE_A)}&from=HEAD~1&to=HEAD`,
      headers: WRITER_B,
    });
    expect(diff.statusCode).toBe(200);
    expect(diff.json().oldText).not.toContain('writer A edit');
    expect(diff.json().newText).toContain('writer A edit');
    expect(diff.json().additions).toBeGreaterThan(0);

    const headFile = await app.inject({
      method: 'GET',
      url: `/api/git/file?path=${encodeURIComponent(FILE_A)}&rev=HEAD`,
      headers: WRITER_B,
    });
    expect(headFile.statusCode).toBe(200);
    expect(headFile.json().content).toContain('writer A edit');

    // New files are locked implicitly for writers
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/files/create',
      headers: WRITER_B,
      payload: {
        path: 'concepts/branch-note.dita',
        kind: 'concept',
        id: 'branch-note',
        title: 'Branch Note',
      },
    });
    expect(createResponse.statusCode).toBe(200);
    const newFileLocks = await app.inject({
      method: 'GET',
      url: '/api/locks',
      headers: WRITER_B,
    });
    expect(
      newFileLocks
        .json()
        .locks.some((lock: { filePath: string }) => lock.filePath === 'concepts/branch-note.dita'),
    ).toBe(true);

    // Branch isolation: the same file can be locked on another branch
    const switchBranch = await app.inject({
      method: 'POST',
      url: '/api/git/switch-branch',
      headers: WRITER_A,
      payload: { branch: 'release/2.0' },
    });
    expect(switchBranch.statusCode).toBe(200);
    const switched = switchBranch.json();
    expect(switched.branch).toBe('release/2.0');
    expect(switched.workDir).not.toBe(fixture.projectDir);
    expect(switched.snapshot.rootDir).toBe(switched.workDir);
    expect(switched.snapshot.projectRootDir).toBe(fixture.projectDir);

    const branchCheckout = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: WRITER_B,
      payload: { path: FILE_B },
    });
    expect(branchCheckout.statusCode).toBe(200);
    expect(branchCheckout.json().branch).toBe('release/2.0');
    expect(branchCheckout.json().lock.userId).toBe('u-writer-chen');

    const branchLocks = await app.inject({
      method: 'GET',
      url: '/api/locks',
      headers: WRITER_A,
    });
    expect(branchLocks.json().branch).toBe('release/2.0');
    expect(branchLocks.json().locks).toHaveLength(1);

    // Switching back restores the main worktree and its locks
    const switchBack = await app.inject({
      method: 'POST',
      url: '/api/git/switch-branch',
      headers: WRITER_A,
      payload: { branch: 'main' },
    });
    expect(switchBack.statusCode).toBe(200);
    expect(switchBack.json().workDir).toBe(fixture.projectDir);
    expect(switchBack.json().locks.some((lock: { filePath: string }) => lock.filePath === FILE_B)).toBe(
      true,
    );

    // Cancel checkout restores the committed content and releases the lock
    const headBeforeCancel = await app.inject({
      method: 'GET',
      url: `/api/git/file?path=${encodeURIComponent(FILE_B)}&rev=HEAD`,
      headers: WRITER_B,
    });
    expect(headBeforeCancel.statusCode).toBe(200);
    const cancel = await app.inject({
      method: 'POST',
      url: '/api/locks/cancel',
      headers: WRITER_B,
      payload: { path: FILE_B },
    });
    expect(cancel.statusCode).toBe(200);
    const restored = await app.inject({
      method: 'GET',
      url: `/api/files/content?path=${encodeURIComponent(FILE_B)}`,
      headers: WRITER_B,
    });
    expect(restored.json().content).toBe(headBeforeCancel.json().content);
    expect(
      cancel.json().locks.some((lock: { filePath: string }) => lock.filePath === FILE_B),
    ).toBe(false);

    // Admin force unlock stores a content backup
    await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: WRITER_A,
      payload: { path: FILE_A },
    });
    const forceContent = readFileSync(path.join(fixture.projectDir, FILE_A), 'utf8');
    await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: WRITER_A,
      payload: { path: FILE_A, content: `${forceContent}\n<!-- force backup -->\n` },
    });
    const forceUnlock = await app.inject({
      method: 'POST',
      url: '/api/locks/force-unlock',
      headers: ADMIN,
      payload: { path: FILE_A, reason: '紧急回收' },
    });
    expect(forceUnlock.statusCode).toBe(200);
    expect(forceUnlock.json().released.userId).toBe('u-writer-lin');
    expect(forceUnlock.json().backup.hasContent).toBe(true);
    expect(forceUnlock.json().backup.patchPreview.length).toBeGreaterThan(0);

    const nonAdminForce = await app.inject({
      method: 'POST',
      url: '/api/locks/force-unlock',
      headers: WRITER_B,
      payload: { path: FILE_A },
    });
    expect(nonAdminForce.statusCode).toBe(403);

    await app.close();
  }, 30_000);
});
