import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';

const tempDirs: string[] = [];
const ADMIN = { 'x-dita-user-id': 'u-admin' };
const LIN = { 'x-dita-user-id': 'u-writer-lin' };
const CHEN = { 'x-dita-user-id': 'u-writer-chen' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const TOPIC = 'concepts/single-sourcing.dita';
const OTHER_TOPIC = 'concepts/dita-architecture.dita';

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase10-assignments-'));
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
    dbPath: path.join(root, 'phase10-assignments.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

async function bootstrap() {
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
  const manualId: string = list.activeManualId;
  const scoped = (headers: Record<string, string>) => ({ ...headers, 'x-dita-manual-id': manualId });
  return { fixture, app, manualId, scoped };
}

describe('Phase 10 topic assignment API', () => {
  it('creates, filters, guards and completes assignments through check-out/check-in', async () => {
    const { fixture, app, manualId, scoped } = await bootstrap();

    const created = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: TOPIC, assigneeId: 'u-writer-chen', note: '请补全单源示例' },
    });
    expect(created.statusCode).toBe(200);
    const assignment = created.json().assignment;
    expect(assignment).toMatchObject({
      manualId,
      branch: 'main',
      topicPath: TOPIC,
      status: 'pending',
      topicExists: true,
      overdue: false,
      assignee: { id: 'u-writer-chen' },
      assigner: { id: 'u-writer-lin' },
    });
    expect(assignment.topicTitle).toBeTruthy();

    const delegated = await app.inject({
      method: 'GET',
      url: '/api/assignments?scope=delegated&status=active',
      headers: scoped(LIN),
    });
    expect(delegated.json().assignments.map((a: { id: string }) => a.id)).toContain(assignment.id);

    const mine = await app.inject({
      method: 'GET',
      url: '/api/assignments?scope=mine&status=active',
      headers: scoped(CHEN),
    });
    expect(mine.json().assignments).toHaveLength(1);
    const summary = await app.inject({
      method: 'GET',
      url: '/api/assignments/summary',
      headers: scoped(CHEN),
    });
    expect(summary.json().summary).toMatchObject({ myPending: 1, myInProgress: 0, delegatedActive: 0 });

    const byTopic = await app.inject({
      method: 'GET',
      url: `/api/assignments/manual/${manualId}/topic?topicPath=${encodeURIComponent(TOPIC)}`,
      headers: ADMIN,
    });
    expect(byTopic.json().assignment.id).toBe(assignment.id);

    // Duplicate active delegation is rejected with the existing record attached.
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: TOPIC, assigneeId: 'u-writer-lin' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().existingAssignment.id).toBe(assignment.id);

    const mapTarget = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: 'index.ditamap', assigneeId: 'u-writer-chen' },
    });
    expect(mapTarget.statusCode).toBe(400);

    const missingTopic = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: 'topics/nope.dita', assigneeId: 'u-writer-chen' },
    });
    expect(missingTopic.statusCode).toBe(404);

    const viewerAssignee = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: OTHER_TOPIC, assigneeId: 'u-viewer-zhou' },
    });
    expect(viewerAssignee.statusCode).toBe(403);

    const viewerAssigner = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(VIEWER),
      payload: { topicPath: OTHER_TOPIC, assigneeId: 'u-writer-chen' },
    });
    expect(viewerAssigner.statusCode).toBe(403);

    const badDueDate = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: OTHER_TOPIC, assigneeId: 'u-writer-chen', dueDate: '2026/01/01' },
    });
    expect(badDueDate.statusCode).toBe(400);

    // Manual scoping never leaks assignments across manuals.
    const otherManual = await app.inject({
      method: 'POST',
      url: '/api/manuals',
      headers: ADMIN,
      payload: { mode: 'attach', rootDir: fixture.otherDir },
    });
    const otherManualId: string = otherManual.json().manual.id;
    const otherTopic = 'concepts/workspace-model.dita';
    const crossManualCreate = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: { ...LIN, 'x-dita-manual-id': otherManualId },
      payload: { topicPath: otherTopic, assigneeId: 'u-writer-chen' },
    });
    expect(crossManualCreate.statusCode).toBe(200);
    const scopedList = await app.inject({
      method: 'GET',
      url: '/api/assignments?status=all',
      headers: scoped(CHEN),
    });
    expect(scopedList.json().assignments).toHaveLength(1);
    const allManuals = await app.inject({
      method: 'GET',
      url: '/api/assignments?status=all',
      headers: CHEN,
    });
    expect(allManuals.json().assignments).toHaveLength(2);

    // Check-out promotes the assignee's pending assignment to in_progress.
    const checkout = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: scoped(CHEN),
      payload: { path: TOPIC },
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().updatedAssignment.status).toBe('in_progress');
    const progressed = await app.inject({
      method: 'GET',
      url: '/api/assignments/summary',
      headers: scoped(CHEN),
    });
    expect(progressed.json().summary).toMatchObject({ myPending: 0, myInProgress: 1 });

    // Check-in with the dialog checkbox completes the assignment.
    const source = readFileSync(path.join(fixture.projectDir, TOPIC), 'utf8');
    await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers: scoped(CHEN),
      payload: { path: TOPIC, content: source.replace('</concept>', '  <p>单源补充</p>\n</concept>') },
    });
    const checkin = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: scoped(CHEN),
      payload: {
        paths: [TOPIC],
        message: 'docs: 完成单源委派',
        completeMyAssignments: true,
      },
    });
    expect(checkin.statusCode).toBe(200);
    expect(checkin.json().completedAssignments).toHaveLength(1);
    expect(checkin.json().completedAssignments[0]).toMatchObject({ id: assignment.id, status: 'done' });

    const afterCheckin = await app.inject({
      method: 'GET',
      url: '/api/assignments?scope=all&status=all',
      headers: scoped(LIN),
    });
    const done = afterCheckin
      .json()
      .assignments.find((a: { id: string }) => a.id === assignment.id);
    expect(done.status).toBe('done');
    expect(done.completedAt).toBeTruthy();

    // A completed assignment frees the topic for a new delegation.
    const redelegated = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: TOPIC, assigneeId: 'u-writer-lin' },
    });
    expect(redelegated.statusCode).toBe(200);

    await app.close();
  }, 30_000);

  it('tracks due dates, reassignment, cancellation and topic renames', async () => {
    const { fixture, app, manualId, scoped } = await bootstrap();

    const overdue = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: TOPIC, assigneeId: 'u-writer-chen', dueDate: '2020-01-01' },
    });
    expect(overdue.statusCode).toBe(200);
    const overdueAssignment = overdue.json().assignment;
    expect(overdueAssignment.overdue).toBe(true);
    expect(overdueAssignment.dueDate).toBe('2020-01-01');

    const overdueSummary = await app.inject({
      method: 'GET',
      url: '/api/assignments/summary',
      headers: scoped(CHEN),
    });
    expect(overdueSummary.json().summary.myOverdue).toBe(1);

    // Only the assigner, assignee or admin may mutate an assignment.
    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/api/assignments/${overdueAssignment.id}`,
      headers: { ...ADMIN, 'x-dita-user-id': 'u-writer-chen' },
      payload: {},
    });
    expect([200, 403]).toContain(forbidden.statusCode);

    const strangerPatch = await app.inject({
      method: 'PATCH',
      url: `/api/assignments/${overdueAssignment.id}`,
      headers: scoped(VIEWER),
      payload: { note: '不应该生效' },
    });
    expect(strangerPatch.statusCode).toBe(403);

    // Reassigning to another writer reopens nothing but moves ownership.
    const reassigned = await app.inject({
      method: 'PATCH',
      url: `/api/assignments/${overdueAssignment.id}`,
      headers: scoped(LIN),
      payload: { assigneeId: 'u-writer-lin' },
    });
    expect(reassigned.statusCode).toBe(200);
    expect(reassigned.json().assignment.assignee.id).toBe('u-writer-lin');

    // Re-assigning to the same person is a harmless no-op.
    const sameAssignee = await app.inject({
      method: 'PATCH',
      url: `/api/assignments/${overdueAssignment.id}`,
      headers: scoped(LIN),
      payload: { assigneeId: 'u-writer-lin' },
    });
    expect(sameAssignee.statusCode).toBe(200);
    expect(sameAssignee.json().assignment.assignee.id).toBe('u-writer-lin');

    // Cancel frees the slot and keeps the record for history.
    const cancelled = await app.inject({
      method: 'DELETE',
      url: `/api/assignments/${overdueAssignment.id}`,
      headers: scoped(LIN),
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().assignment.status).toBe('cancelled');
    const history = await app.inject({
      method: 'GET',
      url: '/api/assignments?scope=all&status=cancelled',
      headers: scoped(LIN),
    });
    expect(history.json().assignments.map((a: { id: string }) => a.id)).toContain(overdueAssignment.id);

    const hardDelete = await app.inject({
      method: 'DELETE',
      url: `/api/assignments/${overdueAssignment.id}?hard=1`,
      headers: scoped(LIN),
    });
    expect(hardDelete.statusCode).toBe(200);
    const missing = await app.inject({
      method: 'GET',
      url: '/api/assignments/manual/' + manualId + '/topic?topicPath=' + encodeURIComponent(TOPIC),
      headers: ADMIN,
    });
    expect(missing.json().assignment).toBeNull();

    // Renaming a delegated topic keeps the assignment pointing at the file.
    const renameTarget = await app.inject({
      method: 'POST',
      url: '/api/assignments',
      headers: scoped(LIN),
      payload: { topicPath: OTHER_TOPIC, assigneeId: 'u-writer-chen' },
    });
    const renameAssignmentId = renameTarget.json().assignment.id;
    const renamedPath = 'concepts/dita-architecture-v2.dita';
    await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: scoped(LIN),
      payload: { path: OTHER_TOPIC },
    });
    const rename = await app.inject({
      method: 'POST',
      url: '/api/files/rename',
      headers: scoped(LIN),
      payload: { fromPath: OTHER_TOPIC, toPath: renamedPath },
    });
    expect(rename.statusCode).toBe(200);
    // Phase 13: topic_assignments.topic_path follows the rename on check-in, not on draft rename.
    const checkinRename = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers: scoped(LIN),
      payload: { paths: [renamedPath], message: 'chore: 重命名代理主题' },
    });
    expect(checkinRename.statusCode).toBe(200);
    const afterRename = await app.inject({
      method: 'GET',
      url: '/api/assignments?status=all',
      headers: scoped(LIN),
    });
    const moved = afterRename
      .json()
      .assignments.find((a: { id: string }) => a.id === renameAssignmentId);
    expect(moved.topicPath).toBe(renamedPath);
    expect(moved.topicExists).toBe(true);

    await app.close();
  }, 30_000);
});
