import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';
import { openDatabase } from '../src/db/client.js';
import { GitManager } from '../src/modules/git/git-manager.js';
import { IdentityService } from '../src/modules/identity/identity-service.js';
import { LockService } from '../src/modules/locks/lock-service.js';

/* -------------------------------------------------------------------------- */
/* Fixtures & helpers                                                          */
/* -------------------------------------------------------------------------- */

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const TOPIC = 'tasks/create-map-structure.dita';
const DITAVAL = 'filters/cloud-edition.ditaval';

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };

const GENERAL_TASK = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA General Task//EN" "generalTask.dtd">
<task id="api6_general_task">
  <title>General task check-in</title>
  <taskbody>
    <section>
      <title>Overview</title>
      <p>A general task may contain sections.</p>
    </section>
  </taskbody>
</task>
`;

const tempDirs: string[] = [];

interface Fixture {
  root: string;
  projectDir: string;
  importsDir: string;
  draftAssetsDir: string;
  worktreesRootDir: string;
  dbPath: string;
}

function createFixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-checkin-validation-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    root,
    projectDir,
    importsDir: path.join(root, 'imports'),
    draftAssetsDir: path.join(root, 'draft-assets'),
    worktreesRootDir: path.join(root, 'worktrees'),
    dbPath: path.join(root, 'checkin-validation.sqlite'),
  };
}

function createApp(fixture: Fixture) {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    draftAssetsRootDir: fixture.draftAssetsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    logger: false,
  });
}

type App = ReturnType<typeof createApp>;

function git(fixture: Fixture, args: string): string {
  return execSync(`git ${args}`, { cwd: fixture.projectDir, encoding: 'utf8' }).trim();
}

function head(fixture: Fixture): string {
  return git(fixture, 'rev-parse HEAD');
}

function disk(fixture: Fixture, filePath: string): string {
  return readFileSync(path.join(fixture.projectDir, filePath), 'utf8');
}

async function bootstrap(app: App, fixture: Fixture): Promise<string> {
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
  manualId: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return { ...user, 'x-dita-manual-id': manualId, ...extra };
}

async function getContent(app: App, headers: Record<string, string>, filePath: string) {
  const response = await app.inject({
    method: 'GET',
    url: `/api/files/content?path=${encodeURIComponent(filePath)}`,
    headers,
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { content: string }).content;
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

async function save(
  app: App,
  headers: Record<string, string>,
  filePath: string,
  content: string,
) {
  return app.inject({
    method: 'PUT',
    url: '/api/files/content',
    headers,
    payload: { path: filePath, content, createDirs: true },
  });
}

async function checkin(
  app: App,
  headers: Record<string, string>,
  paths: string[],
  message = 'feat: check-in validation',
) {
  return app.inject({
    method: 'POST',
    url: '/api/locks/checkin',
    headers,
    payload: { paths, message },
  });
}

async function gitCommit(
  app: App,
  headers: Record<string, string>,
  paths: string[],
  message = 'feat: legacy commit validation',
) {
  return app.inject({
    method: 'POST',
    url: '/api/git/commit',
    headers,
    payload: { paths, message },
  });
}

async function overlayState(app: App, headers: Record<string, string>) {
  const response = await app.inject({ method: 'GET', url: '/api/locks', headers });
  expect(response.statusCode).toBe(200);
  return response.json() as {
    locks: { filePath: string }[];
    drafts: { filePath: string; op: string }[];
  };
}

function duplicateFirstCmd(content: string): string {
  return content.replace(/(<cmd>[\s\S]*?<\/cmd>)/, '$1$1');
}

function breakFirstCmd(content: string): string {
  return content.replace(/<cmd>[\s\S]*?<\/cmd>/, '<cmd>未闭合</step>');
}

function withTitle(content: string, title: string): string {
  return content.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -------------------------------------------------------------------------- */
/* API-1 … API-10: check-in XML/DITA validation gate                          */
/* -------------------------------------------------------------------------- */

describe('check-in validation gate', () => {
  it('API-1 rejects a draft with a content-model violation and keeps overlay state intact', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      const broken = duplicateFirstCmd(baseline);
      expect((await save(app, headers, TOPIC, broken)).statusCode).toBe(200);

      const headBefore = head(fixture);
      const response = await checkin(app, headers, [TOPIC], 'feat: broken draft');
      expect(response.statusCode).toBe(422);
      const body = response.json() as {
        error: string;
        code: string;
        issues: { filePath: string; source: string; severity: string; line: number }[];
      };
      expect(body.code).toBe('checkin_validation_failed');
      expect(body.error).toContain('签入已阻止');
      expect(body.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filePath: TOPIC,
            source: 'structure',
            severity: 'error',
          }),
        ]),
      );
      expect(body.issues[0]!.line).toBeGreaterThan(0);

      // No write, no commit, lock still held, draft still present.
      expect(head(fixture)).toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(baseline);
      const state = await overlayState(app, headers);
      expect(state.locks.map((lock) => lock.filePath)).toContain(TOPIC);
      expect(state.drafts.map((draft) => draft.filePath)).toContain(TOPIC);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-2 rejects a draft whose XML is malformed', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      expect((await save(app, headers, TOPIC, breakFirstCmd(baseline))).statusCode).toBe(200);

      const headBefore = head(fixture);
      const response = await checkin(app, headers, [TOPIC]);
      expect(response.statusCode).toBe(422);
      const body = response.json() as {
        code: string;
        issues: { filePath: string; source: string; message: string }[];
      };
      expect(body.code).toBe('checkin_validation_failed');
      expect(body.issues[0]).toMatchObject({ filePath: TOPIC, source: 'xml' });
      expect(head(fixture)).toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(baseline);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-3 blocks POST /api/git/commit for the same malformed draft', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      expect((await save(app, headers, TOPIC, breakFirstCmd(baseline))).statusCode).toBe(200);

      const headBefore = head(fixture);
      const response = await gitCommit(app, headers, [TOPIC]);
      expect(response.statusCode).toBe(422);
      expect((response.json() as { code: string }).code).toBe('checkin_validation_failed');
      expect(head(fixture)).toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(baseline);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-4 rejects the whole batch and commits no file when one draft is invalid', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      expect((await save(app, headers, TOPIC, breakFirstCmd(baseline))).statusCode).toBe(200);

      const otherPath = 'tasks/deploy-worker.dita';
      await checkout(app, headers, otherPath);
      const otherBaseline = await getContent(app, headers, otherPath);
      const fixedOther = withTitle(otherBaseline, 'API-4 valid sibling draft');
      expect((await save(app, headers, otherPath, fixedOther)).statusCode).toBe(200);

      const headBefore = head(fixture);
      const response = await checkin(app, headers, [TOPIC, otherPath]);
      expect(response.statusCode).toBe(422);
      const body = response.json() as {
        code: string;
        issues: { filePath: string; severity: string }[];
      };
      expect(body.code).toBe('checkin_validation_failed');
      expect(body.issues.length).toBeGreaterThan(0);
      expect(body.issues.every((issue) => issue.filePath === TOPIC)).toBe(true);

      // Neither file reached the shared workDir / HEAD; both drafts and locks survive.
      expect(head(fixture)).toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(baseline);
      expect(disk(fixture, otherPath)).toBe(otherBaseline);
      const state = await overlayState(app, headers);
      expect(state.locks.map((lock) => lock.filePath)).toEqual(
        expect.arrayContaining([TOPIC, otherPath]),
      );
      expect(state.drafts.map((draft) => draft.filePath)).toEqual(
        expect.arrayContaining([TOPIC, otherPath]),
      );
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-5 lets the same file check in after the draft is fixed', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      expect((await save(app, headers, TOPIC, duplicateFirstCmd(baseline))).statusCode).toBe(200);
      expect((await checkin(app, headers, [TOPIC])).statusCode).toBe(422);

      const headBefore = head(fixture);
      const fixed = withTitle(baseline, 'API-5 fixed check-in');
      expect((await save(app, headers, TOPIC, fixed)).statusCode).toBe(200);
      const response = await checkin(app, headers, [TOPIC], 'feat: fixed draft');
      expect(response.statusCode).toBe(200);

      expect(head(fixture)).not.toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(fixed);
      const state = await overlayState(app, headers);
      expect(state.locks.map((lock) => lock.filePath)).not.toContain(TOPIC);
      expect(state.drafts.map((draft) => draft.filePath)).not.toContain(TOPIC);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-6 accepts a general task with a section inside taskbody', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      const newPath = 'tasks/api6-general-task.dita';
      expect((await save(app, headers, newPath, GENERAL_TASK)).statusCode).toBe(200);
      const headBefore = head(fixture);

      const response = await checkin(app, headers, [newPath], 'feat: general task');
      expect(response.statusCode).toBe(200);
      expect(head(fixture)).not.toBe(headBefore);
      expect(disk(fixture, newPath)).toBe(GENERAL_TASK);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-7 does not block a topic referencing a missing image (no reference checks)', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      const withImage = baseline.replace(
        '</p>',
        '<image href="../images/not-found.png" alt="missing"/></p>',
      );
      expect(withImage).not.toBe(baseline);
      expect((await save(app, headers, TOPIC, withImage)).statusCode).toBe(200);
      const headBefore = head(fixture);

      const response = await checkin(app, headers, [TOPIC], 'feat: missing image ref');
      expect(response.statusCode).toBe(200);
      expect(head(fixture)).not.toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(withImage);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-8 accepts a delete draft without XML validation', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, TOPIC);
      const removal = await app.inject({
        method: 'DELETE',
        url: `/api/files?path=${encodeURIComponent(TOPIC)}`,
        headers,
      });
      expect(removal.statusCode).toBe(200);
      const headBefore = head(fixture);

      const response = await checkin(app, headers, [TOPIC], 'chore: remove topic');
      expect(response.statusCode).toBe(200);
      expect(head(fixture)).not.toBe(headBefore);
      expect(existsSync(path.join(fixture.projectDir, TOPIC))).toBe(false);
      const state = await overlayState(app, headers);
      expect(state.drafts.map((draft) => draft.filePath)).not.toContain(TOPIC);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-9 rejects a syntactically broken .ditaval draft', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId);
      await checkout(app, headers, DITAVAL);
      const baseline = await getContent(app, headers, DITAVAL);
      const broken = '<val><prop att="platform">not closed';
      expect((await save(app, headers, DITAVAL, broken)).statusCode).toBe(200);

      const response = await checkin(app, headers, [DITAVAL]);
      expect(response.statusCode).toBe(422);
      const body = response.json() as {
        code: string;
        issues: { filePath: string; source: string; message: string }[];
      };
      expect(body.code).toBe('checkin_validation_failed');
      expect(body.issues[0]).toMatchObject({ filePath: DITAVAL, source: 'ditaval' });
      expect(disk(fixture, DITAVAL)).toBe(baseline);
    } finally {
      await app.close();
    }
  }, 30_000);

  it('API-10 localizes the 422 error and issue messages from Accept-Language', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const manualId = await bootstrap(app, fixture);
      const headers = scoped(WRITER, manualId, { 'accept-language': 'en' });
      await checkout(app, headers, TOPIC);
      const baseline = await getContent(app, headers, TOPIC);
      expect(
        (await save(app, headers, TOPIC, duplicateFirstCmd(baseline))).statusCode,
      ).toBe(200);

      const response = await checkin(app, headers, [TOPIC]);
      expect(response.statusCode).toBe(422);
      const body = response.json() as {
        error: string;
        code: string;
        issues: { message: string }[];
      };
      expect(body.code).toBe('checkin_validation_failed');
      expect(body.error).toContain('Check-in blocked');
      expect(body.issues[0]!.message).toContain('may appear at most once');
    } finally {
      await app.close();
    }
  }, 30_000);

  it('legacy mode validates on-disk files before git.commit()', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      await bootstrap(app, fixture);
    } finally {
      await app.close();
    }

    // No DraftService => the pre-Phase-13 path: the dirty content already lives on disk.
    const database = openDatabase(fixture.dbPath);
    try {
      const identity = new IdentityService(database.db);
      const gitManager = new GitManager({ worktreesRootDir: fixture.worktreesRootDir });
      await gitManager.ensureInitialized(fixture.projectDir);
      const locks = new LockService(database.db, gitManager);
      const user = identity.get('u-writer-lin');
      expect(user).toBeTruthy();
      locks.ensureRepository(fixture.projectDir);
      await locks.checkout({
        workDir: fixture.projectDir,
        projectRootDir: fixture.projectDir,
        filePath: TOPIC,
        user: user!,
      });

      const baseline = readFileSync(path.join(fixture.projectDir, TOPIC), 'utf8');
      writeFileSync(path.join(fixture.projectDir, TOPIC), breakFirstCmd(baseline), 'utf8');
      const headBefore = head(fixture);

      await expect(
        locks.checkin({
          workDir: fixture.projectDir,
          projectRootDir: fixture.projectDir,
          paths: [TOPIC],
          message: 'feat: legacy commit validation',
          user: user!,
          locale: 'en',
        }),
      ).rejects.toMatchObject({
        statusCode: 422,
        details: { code: 'checkin_validation_failed' },
      });
      expect(head(fixture)).toBe(headBefore);
      expect(disk(fixture, TOPIC)).toBe(breakFirstCmd(baseline));
    } finally {
      database.close();
    }
  }, 30_000);
});
