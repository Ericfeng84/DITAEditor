import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import type { TranslationLinkRow } from '../src/db/schema.js';
import { createServer } from '../src/index.js';
import {
  collectFamilyLanguages,
  collectFamilyLinkRows,
} from '../src/modules/translation/link-service.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER_A = { 'x-dita-user-id': 'u-writer-lin' };
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const ROOT_MAP = 'product-manual.ditamap';
const KEYS_MAP = 'keys.ditamap';
const DITAVAL = 'filters/product.ditaval';
const TOPIC_INSTALL = 'topics/install.dita';
const TOPIC_CONFIGURE = 'topics/configure.dita';
const TOPIC_RETIRE = 'topics/retire.dita';
const LOGO = 'images/logo.png';
const SCREENSHOT = 'images/screenshot.png';

// 1×1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function rootMap(lang = 'en-US'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="product-manual" xml:lang="${lang}">
  <title>Product Manual</title>
  <topicref href="${TOPIC_INSTALL}"/>
  <topicref href="${TOPIC_CONFIGURE}"/>
  <topicref href="${TOPIC_RETIRE}"/>
</map>
`;
}

function topic(id: string, title: string, lang = 'en-US'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="${id}" xml:lang="${lang}">
  <title>${title}</title>
  <body><p>Body of ${title}.</p></body>
</topic>
`;
}

function keysMap(lang = 'en-US'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<map id="product-keys" xml:lang="${lang}">
  <title>Product keys</title>
  <keydef keys="product_name" href="${TOPIC_INSTALL}"/>
</map>
`;
}

const DITAVAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<val>
  <prop att="audience" val="admin" action="include"/>
</val>
`;

interface Fixture {
  root: string;
  projectDir: string;
  importsDir: string;
  draftAssetsDir: string;
  dbPath: string;
  worktreesRootDir: string;
  publishRootDir: string;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-translation-'));
  const projectDir = path.join(root, 'workspace');
  const importsDir = path.join(root, 'manuals');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(importsDir, { recursive: true });
  return {
    root,
    projectDir,
    importsDir,
    draftAssetsDir: path.join(root, 'draft-assets'),
    dbPath: path.join(root, 'translation.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
  };
}

function createApp(fixture: Fixture) {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    draftAssetsRootDir: fixture.draftAssetsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    publishRootDir: fixture.publishRootDir,
    publishConcurrency: 1,
    logger: false,
  });
}

type App = ReturnType<typeof createApp>;

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
}

function porcelain(cwd: string): string {
  return git(cwd, 'status --porcelain');
}

function commitAll(cwd: string, message: string): void {
  git(cwd, 'add -A');
  git(cwd, `commit -m "${message}"`);
}

interface ManualLite {
  id: string;
  name: string;
  rootDir: string;
  sourceLang?: string | null;
  defaultRootMap?: string | null;
}

async function createSourceManual(app: App, lang = 'en-US'): Promise<ManualLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/manuals',
    headers: ADMIN,
    payload: {
      mode: 'import',
      name: 'Source Manual',
      initGit: true,
      files: [
        { path: ROOT_MAP, content: rootMap(lang) },
        { path: KEYS_MAP, content: keysMap(lang) },
        { path: DITAVAL, content: DITAVAL_XML },
        { path: TOPIC_INSTALL, content: topic('install', 'Install', lang) },
        { path: TOPIC_CONFIGURE, content: topic('configure', 'Configure', lang) },
        { path: TOPIC_RETIRE, content: topic('retire', 'Retire', lang) },
        { path: LOGO, content: PNG_BASE64, encoding: 'base64' },
      ],
    },
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { manual: ManualLite }).manual;
}

async function createBareManual(app: App, name: string, lang: string): Promise<ManualLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/manuals',
    headers: ADMIN,
    payload: {
      mode: 'import',
      name,
      initGit: true,
      files: [
        { path: ROOT_MAP, content: rootMap(lang) },
        { path: `topics/${lang}-intro.dita`, content: topic(`${lang}-intro`, `${name} intro`, lang) },
      ],
    },
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { manual: ManualLite }).manual;
}

async function createLink(app: App, payload: Record<string, unknown>, headers = WRITER_A) {
  return await app.inject({ method: 'POST', url: '/api/translation/links', headers, payload });
}

async function scan(app: App, linkId: string, headers = WRITER_A) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/translation/links/${linkId}/scan`,
    headers,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as {
    summary: { total: number; created: number; updated: number; renames: number; deleted: number };
    files: Array<{
      id: string;
      sourcePath: string;
      targetPath: string;
      fileKind: string;
      status: string;
      renamedFromPath: string | null;
      localizedAssetOverride: boolean;
      needsHumanReview: boolean;
    }>;
  };
}

function byPath(
  files: Array<{ sourcePath: string; status: string }>,
  sourcePath: string,
): { sourcePath: string; status: string } | undefined {
  return files.find((file) => file.sourcePath === sourcePath);
}

function draftPaths(dbPath: string): Array<{ file_path: string; op: string; user_id: string }> {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare('select file_path, op, user_id from working_drafts order by file_path')
      .all() as Array<{ file_path: string; op: string; user_id: string }>;
  } finally {
    db.close();
  }
}

interface FileStateRowLite {
  status: string;
  renamed_from_path: string | null;
  localized_asset_override: number;
}

function fileStateRow(dbPath: string, linkId: string, sourcePath: string): FileStateRowLite | undefined {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare(
        'select status, renamed_from_path, localized_asset_override from translation_file_states where link_id = ? and source_path = ?',
      )
      .get(linkId, sourcePath) as FileStateRowLite | undefined;
  } finally {
    db.close();
  }
}

async function batchCheckin(
  app: App,
  linkId: string,
  payload: { paths?: string[]; message: string },
  headers = WRITER_A,
) {
  return await app.inject({
    method: 'POST',
    url: `/api/translation/links/${linkId}/batch-checkin`,
    headers,
    payload,
  });
}

interface FamilyLink {
  id: string;
  sourceManualId: string;
  targetManualId: string;
  sourceLang: string;
  targetLang: string;
  targetBranch: string;
  targetManual: ManualLite;
}

async function addLink(app: App, sourceManualId: string, targetLang: string): Promise<FamilyLink> {
  const response = await createLink(app, { sourceManualId, targetLang });
  expect(response.statusCode).toBe(201);
  return (response.json() as { link: FamilyLink }).link;
}

async function familyLinks(app: App, manualId: string, branch?: string): Promise<FamilyLink[]> {
  const query = branch ? `?manualId=${manualId}&branch=${branch}` : `?manualId=${manualId}`;
  const response = await app.inject({
    method: 'GET',
    url: `/api/translation/links${query}`,
    headers: ADMIN,
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { links: FamilyLink[] }).links;
}

function familyIds(links: FamilyLink[]): string[] {
  return links.map((link) => link.id).sort();
}

function manualHeaders(manualId: string, branch = 'main'): Record<string, string> {
  return { ...WRITER_A, 'x-dita-manual-id': manualId, 'x-dita-branch': branch };
}

let cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const dispose of cleanup.reverse()) await dispose();
  cleanup = [];
});

function boot() {
  const fixture = makeFixture();
  const app = createApp(fixture);
  cleanup.push(async () => {
    await app.close();
    rmSync(fixture.root, { recursive: true, force: true });
  });
  return { fixture, app };
}

/* -------------------------------------------------------------------------- */
/* Pairing                                                                     */
/* -------------------------------------------------------------------------- */

describe('translation links — pairing two manuals', () => {
  it('creates a paired target manual with the skeleton map, images and no topics', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);

    const response = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-cn' });
    expect(response.statusCode).toBe(201);
    const { link } = response.json() as {
      link: {
        id: string;
        sourceLang: string;
        targetLang: string;
        sourceBranch: string;
        targetBranch: string;
        targetManualId: string;
        targetManual: ManualLite;
        counts: { total: number; synced: number; untranslated: number };
      };
    };

    expect(link.sourceLang).toBe('en-US');
    expect(link.targetLang).toBe('zh-CN');
    expect(link.sourceBranch).toBe('main');
    expect(link.targetBranch).toBe('main');
    expect(link.targetManual.name).toBe('Source Manual (zh-CN)');
    expect(link.targetManual.id).not.toBe(source.id);
    expect(link.targetManual.sourceLang).toBe('zh-CN');

    const targetRoot = link.targetManual.rootDir;
    expect(existsSync(path.join(targetRoot, ROOT_MAP))).toBe(true);
    expect(existsSync(path.join(targetRoot, LOGO))).toBe(true);
    // §1.2 default #1: topics are deferred until a reviewed check-in.
    expect(existsSync(path.join(targetRoot, TOPIC_INSTALL))).toBe(false);
    expect(existsSync(path.join(targetRoot, KEYS_MAP))).toBe(false);

    const skeleton = execSync('cat product-manual.ditamap', { cwd: targetRoot, encoding: 'utf8' });
    expect(skeleton).toContain('xml:lang="zh-CN"');
    expect(skeleton).not.toContain('xml:lang="en-US"');
    expect(git(targetRoot, 'log --oneline')).toContain('seed zh-CN skeleton');

    // Both shared worktrees stay clean at HEAD (Phase 13 boundary).
    expect(porcelain(source.rootDir)).toBe('');
    expect(porcelain(targetRoot)).toBe('');

    // Source language is inferred from the root map and persisted.
    const manual = await app.inject({ method: 'GET', url: `/api/manuals/${source.id}`, headers: ADMIN });
    expect((manual.json() as { manual: ManualLite }).manual.sourceLang).toBe('en-US');

    // The initial scan already populated file states: the skeleton pair starts `synced`.
    const files = await app.inject({
      method: 'GET',
      url: `/api/translation/links/${link.id}/files`,
      headers: ADMIN,
    });
    expect(files.statusCode).toBe(200);
    const body = files.json() as {
      files: Array<{ sourcePath: string; status: string; fileKind: string; needsHumanReview: boolean }>;
      counts: { total: number; synced: number; untranslated: number };
    };
    expect(body.files).toHaveLength(7);
    expect(byPath(body.files, ROOT_MAP)?.status).toBe('synced');
    expect(byPath(body.files, LOGO)?.status).toBe('synced');
    expect(byPath(body.files, TOPIC_INSTALL)?.status).toBe('untranslated');
    expect(byPath(body.files, DITAVAL)?.status).toBe('untranslated');
    const keys = body.files.find((file) => file.sourcePath === KEYS_MAP);
    expect(keys?.fileKind).toBe('keydef_map');
    expect(keys?.needsHumanReview).toBe(true);
    expect(body.counts.total).toBe(7);
    expect(body.counts.synced).toBe(2);
    expect(body.counts.untranslated).toBe(5);
    expect(fixture.dbPath).toContain('translation.sqlite');
  });

  it('binds an existing manual and rejects self-links, duplicate languages and cycles', async () => {
    const { app } = boot();
    const source = await createSourceManual(app);
    const legacy = await createBareManual(app, 'Legacy Chinese', 'zh-CN');

    const self = await createLink(app, { sourceManualId: source.id, targetManualId: source.id, targetLang: 'zh-CN' });
    expect(self.statusCode).toBe(400);
    expect((self.json() as { error: string }).error).toContain('自身');

    const bound = await createLink(app, {
      sourceManualId: source.id,
      targetLang: 'zh-CN',
      targetManualId: legacy.id,
    });
    expect(bound.statusCode).toBe(201);
    const boundBody = bound.json() as { link: { id: string; targetManualId: string; sourceLang: string } };
    expect(boundBody.link.targetManualId).toBe(legacy.id);

    const legacyRow = await app.inject({
      method: 'GET',
      url: `/api/manuals/${legacy.id}`,
      headers: ADMIN,
    });
    expect((legacyRow.json() as { manual: ManualLite }).manual.sourceLang).toBe('zh-CN');

    const duplicate = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    expect(duplicate.statusCode).toBe(409);
    expect((duplicate.json() as { error: string }).error).toContain('zh-CN');

    const sameLang = await createLink(app, { sourceManualId: source.id, targetLang: 'en-US' });
    expect(sameLang.statusCode).toBe(400);

    // Phase 16 Q3: the root language is already part of the family, so a back-link into the
    // root is rejected by the family-language guard before `findCyclePath()` can speak. The
    // cycle guard stays in place as defence in depth (covered by `collectFamilyLinkRows` tests).
    const cycle = await createLink(app, {
      sourceManualId: legacy.id,
      targetLang: 'en-US',
      targetManualId: source.id,
    });
    expect(cycle.statusCode).toBe(409);
    expect((cycle.json() as { error: string }).error).toContain('当前语言家族中已存在 en-US');

    const family = await app.inject({
      method: 'GET',
      url: `/api/translation/links?manualId=${legacy.id}`,
      headers: ADMIN,
    });
    const familyBody = family.json() as { links: Array<{ id: string }> };
    expect(familyBody.links.map((link) => link.id)).toEqual([boundBody.link.id]);
  });
});

/* -------------------------------------------------------------------------- */
/* Incremental scan                                                            */
/* -------------------------------------------------------------------------- */

describe('translation links — incremental scan', () => {
  it('classifies untranslated, synced, outdated, metadata-only, renamed and deleted files', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);
    const created = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    expect(created.statusCode).toBe(201);
    const link = (created.json() as { link: { id: string; targetManual: ManualLite } }).link;
    // Keep the fixture referenced so the temp dir lifetime is explicit in this test.
    expect(existsSync(fixture.dbPath)).toBe(true);

    // Seed a translated topic into the target baseline so the pair starts `synced`.
    writeFileSync(
      path.join(link.targetManual.rootDir, TOPIC_INSTALL),
      topic('install', '安装', 'zh-CN'),
      'utf8',
    );
    commitAll(link.targetManual.rootDir, 'translation: first pass on install');
    const seeded = await scan(app, link.id);
    expect(byPath(seeded.files, TOPIC_INSTALL)?.status).toBe('synced');

    // A content change to one topic => `outdated`.
    writeFileSync(
      path.join(source.rootDir, TOPIC_INSTALL),
      topic('install', 'Install the product'),
      'utf8',
    );
    commitAll(source.rootDir, 'docs: edit install topic');
    const afterEdit = await scan(app, link.id);
    expect(byPath(afterEdit.files, TOPIC_INSTALL)?.status).toBe('outdated');
    expect(byPath(afterEdit.files, ROOT_MAP)?.status).toBe('synced');
    expect(afterEdit.summary.renames).toBe(0);

    // A comment-only change keeps the translatable fingerprint => `outdated_metadata_only`.
    const mapPath = path.join(source.rootDir, ROOT_MAP);
    writeFileSync(
      mapPath,
      rootMap().replace('  <topicref href="topics/install.dita"/>', `  <!-- reviewer note -->\n  <topicref href="topics/install.dita"/>`),
      'utf8',
    );
    commitAll(source.rootDir, 'docs: comment only');
    const afterComment = await scan(app, link.id);
    expect(byPath(afterComment.files, ROOT_MAP)?.status).toBe('outdated_metadata_only');

    // A manual verification can accept the metadata-only change.
    const markSynced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/mark-synced`,
      headers: WRITER_A,
      payload: { paths: [ROOT_MAP] },
    });
    expect(markSynced.statusCode).toBe(200);
    const markBody = markSynced.json() as { marked: string[]; skippedUnknown: string[] };
    expect(markBody.marked).toContain(ROOT_MAP);
    const afterMark = await scan(app, link.id);
    expect(byPath(afterMark.files, ROOT_MAP)?.status).toBe('synced');

    // `git diff -M` rename detection keeps the row and flags `source_renamed`.
    git(source.rootDir, `mv ${TOPIC_CONFIGURE} topics/configure-v2.dita`);
    commitAll(source.rootDir, 'docs: rename configure topic');
    const afterRename = await scan(app, link.id);
    const renamed = byPath(afterRename.files, 'topics/configure-v2.dita') as
      | { status: string; renamedFromPath: string | null }
      | undefined;
    expect(renamed?.status).toBe('source_renamed');
    expect(renamed?.renamedFromPath).toBe(TOPIC_CONFIGURE);
    expect(byPath(afterRename.files, TOPIC_CONFIGURE)).toBeUndefined();
    expect(afterRename.summary.renames).toBe(1);

    // A deleted source file becomes `source_deleted` and is excluded from progress.
    git(source.rootDir, `rm -q ${TOPIC_RETIRE}`);
    commitAll(source.rootDir, 'docs: drop retire topic');
    const afterDelete = await scan(app, link.id);
    expect(byPath(afterDelete.files, TOPIC_RETIRE)?.status).toBe('source_deleted');
    expect(afterDelete.summary.deleted).toBe(1);

    // Viewer cannot trigger a scan (it mutates SQLite).
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/scan`,
      headers: VIEWER,
    });
    expect(forbidden.statusCode).toBe(403);

    // The shared source worktree stays clean: scanning never writes files.
    expect(porcelain(source.rootDir)).toBe('');
    expect(porcelain(link.targetManual.rootDir)).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* Asset sync                                                                  */
/* -------------------------------------------------------------------------- */

describe('translation links — asset sync', () => {
  it('writes assets into the target draft overlay only and preserves localized overrides', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);
    const created = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    expect(created.statusCode).toBe(201);
    const link = (created.json() as { link: { id: string; targetManual: ManualLite } }).link;
    const targetRoot = link.targetManual.rootDir;

    // A brand-new source image starts `untranslated`.
    writeFileSync(path.join(source.rootDir, SCREENSHOT), Buffer.from(PNG_BASE64, 'base64'));
    commitAll(source.rootDir, 'docs: add screenshot');
    const scanned = await scan(app, link.id);
    expect(byPath(scanned.files, SCREENSHOT)?.status).toBe('untranslated');

    const synced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_A,
      payload: { paths: [SCREENSHOT] },
    });
    expect(synced.statusCode).toBe(200);
    expect((synced.json() as { synced: string[] }).synced).toEqual([SCREENSHOT]);

    // Phase 13: the binary lands in `working_drafts`, never in the shared workDir.
    expect(existsSync(path.join(targetRoot, SCREENSHOT))).toBe(false);
    expect(porcelain(targetRoot)).toBe('');
    const drafts = draftPaths(fixture.dbPath);
    expect(drafts.map((draft) => [draft.file_path, draft.op])).toEqual([[SCREENSHOT, 'create']]);
    expect(drafts[0]?.user_id).toBe('u-writer-lin');

    // Another user never steals the lock.
    const stolen = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_B,
      payload: { paths: [SCREENSHOT] },
    });
    expect(stolen.statusCode).toBe(200);
    const stolenBody = stolen.json() as {
      synced: string[];
      skippedLocked: Array<{ path: string; userId: string | null }>;
    };
    expect(stolenBody.synced).toEqual([]);
    expect(stolenBody.skippedLocked.map((entry) => entry.path)).toEqual([SCREENSHOT]);
    expect(stolenBody.skippedLocked[0]?.userId).toBe('u-writer-lin');

    // A translator-localised screenshot is preserved on the next scan.
    writeFileSync(path.join(targetRoot, LOGO), Buffer.from('localized-logo-bytes', 'utf8'));
    commitAll(targetRoot, 'translation: localize logo');
    const afterOverride = await scan(app, link.id);
    const logo = afterOverride.files.find((file) => file.sourcePath === LOGO);
    expect(logo?.localizedAssetOverride).toBe(true);

    const skipped = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_A,
      payload: {},
    });
    expect(skipped.statusCode).toBe(200);
    const skippedBody = skipped.json() as { synced: string[]; skippedOverride: string[] };
    expect(skippedBody.skippedOverride).toEqual([LOGO]);
    expect(skippedBody.synced).toEqual([SCREENSHOT]);

    // `force: true` is the explicit opt-in that overwrites the localised asset.
    const forced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_A,
      payload: { paths: [LOGO], force: true },
    });
    expect(forced.statusCode).toBe(200);
    expect((forced.json() as { synced: string[] }).synced).toEqual([LOGO]);

    // Nothing leaked into either shared worktree.
    expect(porcelain(targetRoot)).toBe('');
    expect(porcelain(source.rootDir)).toBe('');
  });
});

/* -------------------------------------------------------------------------- */
/* Phase 16 — closed loop: draft_ready → batch check-in → synced               */
/* -------------------------------------------------------------------------- */

describe('translation links — Phase 16 closed loop', () => {
  it('drives an asset from untranslated → draft_ready → synced and lets force reset a localised override', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);
    const created = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    expect(created.statusCode).toBe(201);
    const link = (created.json() as { link: { id: string; targetManual: ManualLite } }).link;
    const targetRoot = link.targetManual.rootDir;

    writeFileSync(path.join(source.rootDir, SCREENSHOT), Buffer.from(PNG_BASE64, 'base64'));
    commitAll(source.rootDir, 'docs: add screenshot');
    const initial = await scan(app, link.id);
    expect(byPath(initial.files, SCREENSHOT)?.status).toBe('untranslated');

    const synced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_A,
      payload: { paths: [SCREENSHOT] },
    });
    expect(synced.statusCode).toBe(200);
    expect((synced.json() as { synced: string[] }).synced).toEqual([SCREENSHOT]);
    expect(fileStateRow(fixture.dbPath, link.id, SCREENSHOT)?.status).toBe('draft_ready');

    // Rescanning must not clobber the synced asset back to `untranslated`.
    const rescanned = await scan(app, link.id);
    expect(byPath(rescanned.files, SCREENSHOT)?.status).toBe('draft_ready');
    expect(porcelain(targetRoot)).toBe('');

    const checkin = await batchCheckin(app, link.id, {
      paths: [SCREENSHOT],
      message: 'translation: sync screenshot',
    });
    expect(checkin.statusCode).toBe(200);
    const committed = checkin.json() as { checkedInPaths: string[]; syncedFiles: string[] };
    expect(committed.checkedInPaths).toEqual([SCREENSHOT]);
    expect(committed.syncedFiles).toContain(SCREENSHOT);
    expect(existsSync(path.join(targetRoot, SCREENSHOT))).toBe(true);
    expect(porcelain(targetRoot)).toBe('');
    expect(draftPaths(fixture.dbPath)).toEqual([]);
    const afterCheckin = await scan(app, link.id);
    expect(byPath(afterCheckin.files, SCREENSHOT)?.status).toBe('synced');

    // A translator-localised logo — `force: true` is the only way to overwrite and reset the flag.
    writeFileSync(path.join(targetRoot, LOGO), Buffer.from('localized-logo-bytes', 'utf8'));
    commitAll(targetRoot, 'translation: localize logo');
    await scan(app, link.id);
    expect(fileStateRow(fixture.dbPath, link.id, LOGO)?.localized_asset_override).toBe(1);

    const forced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-assets`,
      headers: WRITER_A,
      payload: { paths: [LOGO], force: true },
    });
    expect(forced.statusCode).toBe(200);
    expect((forced.json() as { synced: string[] }).synced).toEqual([LOGO]);
    expect(fileStateRow(fixture.dbPath, link.id, LOGO)).toMatchObject({
      status: 'draft_ready',
      localized_asset_override: 0,
    });
    expect(porcelain(targetRoot)).toBe('');
    expect(porcelain(source.rootDir)).toBe('');
  });

  it('syncs a DITAVAL passthrough file, honours foreign locks and checks it in', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);
    const created = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    const link = (created.json() as { link: { id: string; targetManual: ManualLite } }).link;
    const targetRoot = link.targetManual.rootDir;

    const synced = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-passthrough`,
      headers: WRITER_A,
      payload: {},
    });
    expect(synced.statusCode).toBe(200);
    expect((synced.json() as { synced: string[] }).synced).toEqual([DITAVAL]);
    expect(fileStateRow(fixture.dbPath, link.id, DITAVAL)?.status).toBe('draft_ready');
    expect(draftPaths(fixture.dbPath)).toEqual([
      { file_path: DITAVAL, op: 'create', user_id: 'u-writer-lin' },
    ]);
    expect(porcelain(targetRoot)).toBe('');

    // A second writer never steals the lock.
    const stolen = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-passthrough`,
      headers: WRITER_B,
      payload: { paths: [DITAVAL] },
    });
    expect(stolen.statusCode).toBe(200);
    const stolenBody = stolen.json() as {
      synced: string[];
      skippedLocked: Array<{ path: string; userId: string | null }>;
    };
    expect(stolenBody.synced).toEqual([]);
    expect(stolenBody.skippedLocked).toEqual([
      { path: DITAVAL, userId: 'u-writer-lin', userName: expect.any(String), lockedAt: expect.any(String) },
    ]);

    // A translatable topic is not a passthrough candidate.
    const notPassthrough = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-passthrough`,
      headers: WRITER_A,
      payload: { paths: [TOPIC_INSTALL] },
    });
    expect(notPassthrough.statusCode).toBe(400);
    expect((notPassthrough.json() as { error: string }).error).toContain('DITAVAL');

    const viewer = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/sync-passthrough`,
      headers: VIEWER,
      payload: {},
    });
    expect(viewer.statusCode).toBe(403);

    const rescanned = await scan(app, link.id);
    expect(byPath(rescanned.files, DITAVAL)?.status).toBe('draft_ready');

    const checkin = await batchCheckin(app, link.id, {
      paths: [DITAVAL],
      message: 'translation: sync ditaval filter',
    });
    expect(checkin.statusCode).toBe(200);
    const committed = checkin.json() as { checkedInPaths: string[]; syncedFiles: string[] };
    expect(committed.checkedInPaths).toEqual([DITAVAL]);
    expect(committed.syncedFiles).toContain(DITAVAL);
    expect(existsSync(path.join(targetRoot, DITAVAL))).toBe(true);
    expect(porcelain(targetRoot)).toBe('');
    const finalScan = await scan(app, link.id);
    expect(byPath(finalScan.files, DITAVAL)?.status).toBe('synced');
  });

  it('resolves deleted sources with stage_delete and keep_target', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);
    const created = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    const link = (created.json() as {
      link: { id: string; targetBranch: string; targetManual: ManualLite };
    }).link;
    const targetRoot = link.targetManual.rootDir;

    // Both target files exist and are in sync before the sources disappear.
    for (const [file, title] of [
      [TOPIC_CONFIGURE, '配置'],
      [TOPIC_RETIRE, '淘汰'],
    ] as const) {
      mkdirSync(path.dirname(path.join(targetRoot, file)), { recursive: true });
      writeFileSync(path.join(targetRoot, file), topic(file.split('/').pop()!.replace('.dita', ''), title, 'zh-CN'), 'utf8');
    }
    commitAll(targetRoot, 'translation: first pass on configure and retire');
    const syncedScan = await scan(app, link.id);
    expect(byPath(syncedScan.files, TOPIC_CONFIGURE)?.status).toBe('synced');
    expect(byPath(syncedScan.files, TOPIC_RETIRE)?.status).toBe('synced');

    git(source.rootDir, `rm -q ${TOPIC_CONFIGURE} ${TOPIC_RETIRE}`);
    commitAll(source.rootDir, 'docs: drop configure and retire topics');
    const deletedScan = await scan(app, link.id);
    expect(byPath(deletedScan.files, TOPIC_CONFIGURE)?.status).toBe('source_deleted');
    expect(byPath(deletedScan.files, TOPIC_RETIRE)?.status).toBe('source_deleted');

    // Nothing to resolve → 400 instead of a silent no-op.
    const empty = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/resolve-deleted`,
      headers: WRITER_A,
      payload: { paths: [TOPIC_INSTALL], action: 'keep_target' },
    });
    expect(empty.statusCode).toBe(400);

    const viewer = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/resolve-deleted`,
      headers: VIEWER,
      payload: { paths: [TOPIC_CONFIGURE], action: 'keep_target' },
    });
    expect(viewer.statusCode).toBe(403);

    // Another writer already checked the translated file out: never steal that lock.
    const foreignLock = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers: {
        ...WRITER_B,
        'x-dita-manual-id': link.targetManual.id,
        'x-dita-branch': link.targetBranch,
      },
      payload: { path: TOPIC_CONFIGURE },
    });
    expect(foreignLock.statusCode).toBe(200);

    const blocked = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/resolve-deleted`,
      headers: WRITER_A,
      payload: { paths: [TOPIC_CONFIGURE, 'topics/ghost.dita'], action: 'stage_delete' },
    });
    expect(blocked.statusCode).toBe(200);
    const blockedBody = blocked.json() as {
      staged: string[];
      dismissed: string[];
      skippedLocked: Array<{ path: string; userId: string | null }>;
      skippedUnknown: string[];
    };
    expect(blockedBody.staged).toEqual([]);
    expect(blockedBody.dismissed).toEqual([]);
    expect(blockedBody.skippedLocked.map((entry) => [entry.path, entry.userId])).toEqual([
      [TOPIC_CONFIGURE, 'u-writer-chen'],
    ]);
    expect(blockedBody.skippedUnknown).toEqual(['topics/ghost.dita']);
    expect(fileStateRow(fixture.dbPath, link.id, TOPIC_CONFIGURE)?.status).toBe('source_deleted');

    // stage_delete: the translated file is marked deleted in the lock owner's overlay only.
    const staged = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/resolve-deleted`,
      headers: WRITER_B,
      payload: { paths: [TOPIC_CONFIGURE], action: 'stage_delete' },
    });
    expect(staged.statusCode).toBe(200);
    const stagedBody = staged.json() as { staged: string[]; dismissed: string[] };
    expect(stagedBody.staged).toEqual([TOPIC_CONFIGURE]);
    expect(stagedBody.dismissed).toEqual([]);
    expect(fileStateRow(fixture.dbPath, link.id, TOPIC_CONFIGURE)?.status).toBe('draft_ready');
    expect(existsSync(path.join(targetRoot, TOPIC_CONFIGURE))).toBe(true);
    expect(porcelain(targetRoot)).toBe('');
    expect(draftPaths(fixture.dbPath)).toEqual([
      { file_path: TOPIC_CONFIGURE, op: 'delete', user_id: 'u-writer-chen' },
    ]);

    // The staged delete survives a rescan.
    const rescanned = await scan(app, link.id);
    expect(byPath(rescanned.files, TOPIC_CONFIGURE)?.status).toBe('draft_ready');

    // keep_target: the tracking row disappears, the translated file stays.
    const kept = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/resolve-deleted`,
      headers: WRITER_A,
      payload: { paths: [TOPIC_RETIRE], action: 'keep_target' },
    });
    expect(kept.statusCode).toBe(200);
    expect((kept.json() as { dismissed: string[] }).dismissed).toEqual([TOPIC_RETIRE]);
    expect(fileStateRow(fixture.dbPath, link.id, TOPIC_RETIRE)).toBeUndefined();
    expect(existsSync(path.join(targetRoot, TOPIC_RETIRE))).toBe(true);
    expect(porcelain(targetRoot)).toBe('');

    // Check-in removes the staged file from the target Git HEAD and drops its row.
    const checkin = await batchCheckin(
      app,
      link.id,
      { paths: [TOPIC_CONFIGURE], message: 'translation: drop configure topic' },
      WRITER_B,
    );
    expect(checkin.statusCode).toBe(200);
    const committed = checkin.json() as { checkedInPaths: string[]; syncedFiles: string[] };
    expect(committed.checkedInPaths).toEqual([TOPIC_CONFIGURE]);
    expect(committed.syncedFiles).toContain(TOPIC_CONFIGURE);
    expect(existsSync(path.join(targetRoot, TOPIC_CONFIGURE))).toBe(false);
    expect(porcelain(targetRoot)).toBe('');
    expect(fileStateRow(fixture.dbPath, link.id, TOPIC_CONFIGURE)).toBeUndefined();
    const finalFiles = await app.inject({
      method: 'GET',
      url: `/api/translation/links/${link.id}/files`,
      headers: ADMIN,
    });
    const finalBody = finalFiles.json() as { files: Array<{ sourcePath: string }> };
    expect(finalBody.files.map((file) => file.sourcePath)).not.toContain(TOPIC_CONFIGURE);
    expect(porcelain(source.rootDir)).toBe('');
  }, 60_000);

  it('markSynced clears renamedFromPath', async () => {
    const { fixture, app } = boot();
    const source = await createSourceManual(app);
    const created = await createLink(app, { sourceManualId: source.id, targetLang: 'zh-CN' });
    const link = (created.json() as { link: { id: string } }).link;

    git(source.rootDir, `mv ${TOPIC_CONFIGURE} topics/configure-v2.dita`);
    commitAll(source.rootDir, 'docs: rename configure topic');
    const afterRename = await scan(app, link.id);
    const renamedPath = 'topics/configure-v2.dita';
    expect(byPath(afterRename.files, renamedPath)?.status).toBe('source_renamed');
    expect(fileStateRow(fixture.dbPath, link.id, renamedPath)?.renamed_from_path).toBe(TOPIC_CONFIGURE);

    const marked = await app.inject({
      method: 'POST',
      url: `/api/translation/links/${link.id}/mark-synced`,
      headers: WRITER_A,
      payload: { paths: [renamedPath] },
    });
    expect(marked.statusCode).toBe(200);
    expect((marked.json() as { marked: string[] }).marked).toEqual([renamedPath]);
    expect(fileStateRow(fixture.dbPath, link.id, renamedPath)).toMatchObject({
      status: 'synced',
      renamed_from_path: null,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Phase 16: multi-level lineage                                               */
/* -------------------------------------------------------------------------- */

function jobCount(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  try {
    return (db.prepare('select count(*) as c from translation_jobs').get() as { c: number }).c;
  } finally {
    db.close();
  }
}

/** Translation routes answer `{ error: '<localized message>' }` — assert on the text. */
function errorMessage(response: { json: () => unknown }): string {
  return (response.json() as { error: string }).error;
}

function expectFamilyLangConflict(response: { statusCode: number; json: () => unknown }, lang: string): void {
  expect(response.statusCode).toBe(409);
  const message = errorMessage(response);
  expect(message).toContain('当前语言家族中已存在');
  expect(message).toContain(lang);
}

describe('Phase 16 multi-level translation lineage', () => {
  it('returns the whole family from root, middle and leaf, and keeps branches isolated', async () => {
    const { app } = boot();
    const zh = await createSourceManual(app, 'zh-CN');
    const zhToEn = await addLink(app, zh.id, 'en-US');
    const zhToEs = await addLink(app, zh.id, 'es-ES');
    const enToAr = await addLink(app, zhToEn.targetManualId, 'ar-SA');

    expect(zhToEn.sourceLang).toBe('zh-CN');
    expect(zhToEn.targetLang).toBe('en-US');
    expect(enToAr.sourceLang).toBe('en-US');
    expect(enToAr.targetLang).toBe('ar-SA');

    const expected = [zhToEn.id, zhToEs.id, enToAr.id].sort();
    for (const manualId of [zh.id, zhToEn.targetManualId, enToAr.targetManualId]) {
      expect(familyIds(await familyLinks(app, manualId))).toEqual(expected);
      expect(familyIds(await familyLinks(app, manualId, 'main'))).toEqual(expected);
    }

    // `(en-US, feature)` has no edges of its own: the family is (manualId, branch) scoped.
    expect(await familyLinks(app, zhToEn.targetManualId, 'feature')).toEqual([]);

    // An unrelated family never leaks into the answer.
    const fr = await createBareManual(app, 'French Manual', 'fr-FR');
    const frToIt = await addLink(app, fr.id, 'it-IT');
    expect(familyIds(await familyLinks(app, zh.id))).toEqual(expected);
    expect(familyIds(await familyLinks(app, fr.id))).toEqual([frToIt.id]);
  }, 60_000);

  it('rejects a language that already exists anywhere in the family', async () => {
    const { app } = boot();
    const zh = await createSourceManual(app, 'zh-CN');
    const zhToEn = await addLink(app, zh.id, 'en-US');
    const zhToEs = await addLink(app, zh.id, 'es-ES');
    const enToAr = await addLink(app, zhToEn.targetManualId, 'ar-SA');

    // Back-translation into the root language.
    const back = await createLink(app, { sourceManualId: enToAr.targetManualId, targetLang: 'zh-CN' });
    expectFamilyLangConflict(back, 'zh-CN');

    // A sibling branch of the same manual shares the language family.
    git(zh.rootDir, 'branch dev');
    const crossBranch = await createLink(app, {
      sourceManualId: zh.id,
      sourceBranch: 'dev',
      targetLang: 'en-US',
    });
    expectFamilyLangConflict(crossBranch, 'en-US');

    // Binding an existing subtree that overlaps the family must not duplicate a language.
    const it = await createBareManual(app, 'Italian Manual', 'it-IT');
    const itToAr = await addLink(app, it.id, 'ar-SA');
    const bindCollision = await createLink(app, {
      sourceManualId: zh.id,
      targetLang: 'it-IT',
      targetManualId: it.id,
    });
    expectFamilyLangConflict(bindCollision, 'ar-SA');
    expect(familyIds(await familyLinks(app, it.id))).toEqual([itToAr.id]);

    // updateLink cannot move a link onto a language the family already owns, even when the
    // owner sits on another edge (`ar-SA` belongs to `zh-CN -> en-US -> ar-SA`).
    const collision = await app.inject({
      method: 'PATCH',
      url: `/api/translation/links/${zhToEs.id}`,
      headers: WRITER_A,
      payload: { targetLang: 'ar-SA' },
    });
    expectFamilyLangConflict(collision, 'ar-SA');
    expect(zhToEs.targetLang).toBe('es-ES');

    // The narrower same-source duplicate check still answers first on the same branch.
    const sameSource = await app.inject({
      method: 'PATCH',
      url: `/api/translation/links/${zhToEn.id}`,
      headers: WRITER_A,
      payload: { targetLang: 'es-ES' },
    });
    expect(sameSource.statusCode).toBe(409);
    expect(errorMessage(sameSource)).toContain('es-ES');
    expect(zhToEn.targetLang).toBe('en-US');

    // Relabelling to a free language cascades onto the target manual and its direct children.
    const relabel = await app.inject({
      method: 'PATCH',
      url: `/api/translation/links/${zhToEn.id}`,
      headers: WRITER_A,
      payload: { targetLang: 'fr-FR' },
    });
    expect(relabel.statusCode).toBe(200);
    expect((relabel.json() as { link: FamilyLink }).link.targetLang).toBe('fr-FR');

    const middleFamily = await familyLinks(app, zhToEn.targetManualId);
    expect(middleFamily.find((link) => link.id === zhToEn.id)?.targetLang).toBe('fr-FR');
    expect(middleFamily.find((link) => link.id === enToAr.id)?.sourceLang).toBe('fr-FR');

    const middleManual = await app.inject({
      method: 'GET',
      url: `/api/manuals/${zhToEn.targetManualId}`,
      headers: ADMIN,
    });
    expect((middleManual.json() as { manual: ManualLite }).manual.sourceLang).toBe('fr-FR');
  }, 60_000);

  it('deleting an intermediate link keeps the downstream subtree alive as its own family', async () => {
    const { fixture, app } = boot();
    const zh = await createSourceManual(app, 'zh-CN');
    const zhToEn = await addLink(app, zh.id, 'en-US');
    const zhToEs = await addLink(app, zh.id, 'es-ES');
    const enToAr = await addLink(app, zhToEn.targetManualId, 'ar-SA');

    const middleRoot = zhToEn.targetManual.rootDir;
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/translation/links/${zhToEn.id}`,
      headers: WRITER_A,
    });
    expect(removed.statusCode).toBe(200);
    expect((removed.json() as { deleted: boolean }).deleted).toBe(true);

    expect(familyIds(await familyLinks(app, zh.id))).toEqual([zhToEs.id]);
    expect(familyIds(await familyLinks(app, zhToEn.targetManualId))).toEqual([enToAr.id]);
    expect(familyIds(await familyLinks(app, enToAr.targetManualId))).toEqual([enToAr.id]);

    // Downstream metadata, files and the middle manual itself survive untouched.
    expect(fileStateRow(fixture.dbPath, zhToEn.id, ROOT_MAP)).toBeUndefined();
    expect(fileStateRow(fixture.dbPath, enToAr.id, ROOT_MAP)?.status).toBe('synced');
    expect(existsSync(path.join(middleRoot, ROOT_MAP))).toBe(true);
    const downstream = await app.inject({
      method: 'GET',
      url: `/api/translation/links/${enToAr.id}/files`,
      headers: ADMIN,
    });
    expect((downstream.json() as { files: Array<{ sourcePath: string }> }).files.map((f) => f.sourcePath)).toContain(
      ROOT_MAP,
    );

    // The detached tree is now an independent language family: ar-SA is free again for zh-CN.
    const reAr = await createLink(app, { sourceManualId: zh.id, targetLang: 'ar-SA' });
    expect(reAr.statusCode).toBe(201);
  }, 60_000);

  it('root check-in rescans direct children even though the root has no incoming links', async () => {
    const { fixture, app } = boot();
    const zh = await createSourceManual(app, 'zh-CN');
    const zhToEn = await addLink(app, zh.id, 'en-US');
    const zhToEs = await addLink(app, zh.id, 'es-ES');
    expect(fileStateRow(fixture.dbPath, zhToEn.id, ROOT_MAP)?.status).toBe('synced');
    expect(fileStateRow(fixture.dbPath, zhToEs.id, ROOT_MAP)?.status).toBe('synced');

    const headers = manualHeaders(zh.id, 'main');
    const checkout = await app.inject({
      method: 'POST',
      url: '/api/locks/checkout',
      headers,
      payload: { path: ROOT_MAP },
    });
    expect(checkout.statusCode).toBe(200);
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      headers,
      payload: {
        path: ROOT_MAP,
        content: rootMap('zh-CN').replace('<title>Product Manual</title>', '<title>产品手册</title>'),
      },
    });
    expect(saved.statusCode).toBe(200);
    const checkin = await app.inject({
      method: 'POST',
      url: '/api/locks/checkin',
      headers,
      payload: { paths: [ROOT_MAP], message: 'docs: 更新中文手册标题' },
    });
    expect(checkin.statusCode).toBe(200);

    expect(fileStateRow(fixture.dbPath, zhToEn.id, ROOT_MAP)?.status).toBe('outdated');
    expect(fileStateRow(fixture.dbPath, zhToEs.id, ROOT_MAP)?.status).toBe('outdated');
    // Auto-rescan never enqueues AI work.
    expect(jobCount(fixture.dbPath)).toBe(0);
  }, 60_000);
});

/* -------------------------------------------------------------------------- */
/* Phase 16: family graph helpers                                              */
/* -------------------------------------------------------------------------- */

function linkRow(
  id: string,
  sourceManualId: string,
  targetManualId: string,
  sourceLang: string,
  targetLang: string,
  sourceBranch = 'main',
  targetBranch = 'main',
): TranslationLinkRow {
  return {
    id,
    sourceManualId,
    sourceBranch,
    targetManualId,
    targetBranch,
    sourceLang,
    targetLang,
    optionsJson: '{}',
    createdBy: 'u-admin',
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('Phase 16 family graph helpers', () => {
  const rows: TranslationLinkRow[] = [
    linkRow('l-zh-en', 'm-zh', 'm-en', 'zh-CN', 'en-US'),
    linkRow('l-en-ar', 'm-en', 'm-ar', 'en-US', 'ar-SA'),
    linkRow('l-zh-es', 'm-zh', 'm-es', 'zh-CN', 'es-ES'),
    linkRow('l-zh-fr', 'm-zh', 'm-fr', 'zh-CN', 'fr-FR', 'release'),
  ];

  it('walks the family undirected from any node and keeps branches apart', () => {
    const fromMiddle = collectFamilyLinkRows(rows, 'm-en', 'main').map((row) => row.id);
    expect(fromMiddle.sort()).toEqual(['l-en-ar', 'l-zh-en', 'l-zh-es']);

    const fromLeaf = collectFamilyLinkRows(rows, 'm-ar').map((row) => row.id);
    expect(fromLeaf.sort()).toEqual(['l-en-ar', 'l-zh-en', 'l-zh-es']);

    const releaseBranch = collectFamilyLinkRows(rows, 'm-zh', 'release').map((row) => row.id);
    expect(releaseBranch).toEqual(['l-zh-fr']);

    // Without a branch the seed covers every `(m-zh, *)` node, i.e. the union of both branches.
    const everyBranch = collectFamilyLinkRows(rows, 'm-zh').map((row) => row.id);
    expect(everyBranch.sort()).toEqual(['l-en-ar', 'l-zh-en', 'l-zh-es', 'l-zh-fr']);

    expect(collectFamilyLinkRows(rows, 'm-unknown')).toEqual([]);
  });

  it('collects normalized family languages and honours excludeLinkId', () => {
    expect([...collectFamilyLanguages(rows, 'm-en', 'main')].sort()).toEqual([
      'ar-SA',
      'en-US',
      'es-ES',
      'zh-CN',
    ]);
    // A release-branch family is its own tree: excluding its only edge leaves nothing behind.
    expect([...collectFamilyLanguages(rows, 'm-zh', 'release', 'l-zh-fr')]).toEqual([]);
    expect([...collectFamilyLanguages(rows, 'm-zh', 'release')].sort()).toEqual(['fr-FR', 'zh-CN']);
    expect([...collectFamilyLanguages(rows, 'm-zh', 'main', 'l-en-ar')].sort()).toEqual([
      'en-US',
      'es-ES',
      'zh-CN',
    ]);
    // Branch-agnostic (no seedBranch) covers every edition of the manual.
    expect([...collectFamilyLanguages(rows, 'm-zh')].sort()).toEqual([
      'ar-SA',
      'en-US',
      'es-ES',
      'fr-FR',
      'zh-CN',
    ]);
  });
});
