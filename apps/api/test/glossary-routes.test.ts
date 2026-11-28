import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';

const ADMIN = { 'x-dita-user-id': 'u-admin' };
const WRITER = { 'x-dita-user-id': 'u-writer-lin' };
const VIEWER = { 'x-dita-user-id': 'u-viewer-zhou' };

const CSV_CONTENT = `sourceTerm,synonyms,targetLang,targetTerm,forbiddenTargets,doNotTranslate,caseSensitive,status
gateway,"edge node|proxy",zh-CN,网关,门户,false,true,approved
brand,,zh-CN,品牌,,true,false,approved
`;

interface GlossaryLite {
  id: string;
  scope: string;
  manualId: string | null;
  name: string;
  sourceLang: string;
  enabled: boolean;
  termCount: number;
}

interface TermLite {
  id: string;
  glossaryId: string;
  sourceTerm: string;
  synonyms: string[];
  caseSensitive: boolean;
  doNotTranslate: boolean;
  status: string;
  translations: Array<{ targetLang: string; targetTerm: string; forbiddenTargets: string[] }>;
}

function makeFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-glossary-'));
  const projectDir = path.join(root, 'workspace');
  const importsDir = path.join(root, 'manuals');
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(importsDir, { recursive: true });
  return {
    root,
    projectDir,
    importsDir,
    draftAssetsDir: path.join(root, 'draft-assets'),
    dbPath: path.join(root, 'glossary.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
  };
}

function createApp(fixture: ReturnType<typeof makeFixture>) {
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

let cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const dispose of cleanups.reverse()) await dispose();
  cleanups = [];
});

function boot() {
  const fixture = makeFixture();
  const app = createApp(fixture);
  cleanups.push(async () => {
    await app.close();
    rmSync(fixture.root, { recursive: true, force: true });
  });
  return { fixture, app };
}

async function createGlossary(
  app: App,
  payload: Record<string, unknown>,
  headers: Record<string, string> = WRITER,
): Promise<GlossaryLite> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/glossaries',
    headers,
    payload,
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { glossary: GlossaryLite }).glossary;
}

async function createTerm(
  app: App,
  glossaryId: string,
  payload: Record<string, unknown>,
  headers: Record<string, string> = WRITER,
): Promise<TermLite> {
  const response = await app.inject({
    method: 'POST',
    url: `/api/glossaries/${glossaryId}/terms`,
    headers,
    payload,
  });
  expect(response.statusCode).toBe(201);
  return (response.json() as { term: TermLite }).term;
}

async function listTerms(app: App, glossaryId: string, query = ''): Promise<TermLite[]> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/glossaries/${glossaryId}/terms${query}`,
    headers: ADMIN,
  });
  expect(response.statusCode).toBe(200);
  return (response.json() as { terms: TermLite[] }).terms;
}

async function effective(
  app: App,
  query: string,
): Promise<{
  sourceLang: string | null;
  targetLang: string;
  entries: Array<{
    sourceTerm: string;
    targetTerm: string;
    scope: string;
    synonyms: string[];
    forbiddenTargets: string[];
    doNotTranslate: boolean;
    caseSensitive: boolean;
  }>;
}> {
  const response = await app.inject({
    method: 'GET',
    url: `/api/glossaries/effective?${query}`,
    headers: ADMIN,
  });
  expect(response.statusCode).toBe(200);
  return response.json() as Awaited<ReturnType<typeof effective>>;
}

describe('glossaries — CRUD', () => {
  it('creates, updates, lists and deletes glossaries and their terms', async () => {
    const { app } = boot();
    const glossary = await createGlossary(app, {
      name: 'Core terminology',
      description: 'Company wide',
      sourceLang: 'en-US',
    });
    expect(glossary.scope).toBe('global');
    expect(glossary.manualId).toBeNull();
    expect(glossary.enabled).toBe(true);
    expect(glossary.termCount).toBe(0);

    const manual = await createGlossary(app, {
      scope: 'manual',
      manualId: 'manual-demo',
      name: 'Demo manual terms',
      sourceLang: 'en',
    });
    expect(manual.scope).toBe('manual');
    expect(manual.manualId).toBe('manual-demo');

    const list = await app.inject({ method: 'GET', url: '/api/glossaries', headers: ADMIN });
    const listBody = list.json() as { glossaries: GlossaryLite[] };
    expect(listBody.glossaries.map((entry) => entry.name).sort()).toEqual([
      'Core terminology',
      'Demo manual terms',
    ]);

    const scoped = await app.inject({
      method: 'GET',
      url: '/api/glossaries?manualId=manual-demo',
      headers: ADMIN,
    });
    // A manual sees the global glossaries plus its own.
    expect((scoped.json() as { glossaries: GlossaryLite[] }).glossaries).toHaveLength(2);

    const term = await createTerm(app, glossary.id, {
      sourceTerm: 'topic',
      synonyms: ['subject'],
      translations: [{ targetLang: 'zh-CN', targetTerm: '主题', forbiddenTargets: ['话题'] }],
    });
    expect(term.synonyms).toEqual(['subject']);
    expect(term.translations[0]?.targetTerm).toBe('主题');
    expect(term.translations[0]?.forbiddenTargets).toEqual(['话题']);

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/terms`,
      headers: WRITER,
      payload: { sourceTerm: 'topic' },
    });
    expect(duplicate.statusCode).toBe(409);

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/glossaries/terms/${term.id}`,
      headers: WRITER,
      payload: {
        status: 'draft',
        translations: [{ targetLang: 'zh-CN', targetTerm: '主题域' }],
      },
    });
    expect(patched.statusCode).toBe(200);
    const patchedTerm = (patched.json() as { term: TermLite }).term;
    expect(patchedTerm.status).toBe('draft');
    expect(patchedTerm.translations[0]?.targetTerm).toBe('主题域');

    const afterTerm = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}`,
      headers: ADMIN,
    });
    expect((afterTerm.json() as { glossary: GlossaryLite }).glossary.termCount).toBe(1);

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/glossaries/${glossary.id}`,
      headers: WRITER,
      payload: { name: 'Core terminology (v2)', enabled: false },
    });
    expect(renamed.statusCode).toBe(200);
    const renamedBody = (renamed.json() as { glossary: GlossaryLite }).glossary;
    expect(renamedBody.name).toBe('Core terminology (v2)');
    expect(renamedBody.enabled).toBe(false);

    const deletedTerm = await app.inject({
      method: 'DELETE',
      url: `/api/glossaries/terms/${term.id}`,
      headers: WRITER,
    });
    expect(deletedTerm.statusCode).toBe(200);
    expect(await listTerms(app, glossary.id)).toHaveLength(0);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/glossaries/${glossary.id}`,
      headers: WRITER,
    });
    expect(deleted.statusCode).toBe(200);
    const missing = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}`,
      headers: ADMIN,
    });
    expect(missing.statusCode).toBe(404);

    const missingTerms = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}/terms`,
      headers: ADMIN,
    });
    expect(missingTerms.statusCode).toBe(404);
  });

  it('rejects viewer mutations with 403 and validates the payload', async () => {
    const { app } = boot();
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/glossaries',
      headers: VIEWER,
      payload: { name: 'Nope', sourceLang: 'en' },
    });
    expect(forbidden.statusCode).toBe(403);
    expect((forbidden.json() as { error: string }).error).toContain('只读');

    const missingManual = await app.inject({
      method: 'POST',
      url: '/api/glossaries',
      headers: WRITER,
      payload: { scope: 'manual', name: 'No manual', sourceLang: 'en' },
    });
    expect(missingManual.statusCode).toBe(400);

    const badLang = await app.inject({
      method: 'POST',
      url: '/api/glossaries',
      headers: WRITER,
      payload: { name: 'Bad lang', sourceLang: 'not a lang!' },
    });
    expect(badLang.statusCode).toBe(400);

    const glossary = await createGlossary(app, { name: 'Read only check', sourceLang: 'en' });
    const viewerTerm = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/terms`,
      headers: VIEWER,
      payload: { sourceTerm: 'nope' },
    });
    expect(viewerTerm.statusCode).toBe(403);

    const emptyTerm = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/terms`,
      headers: WRITER,
      payload: { sourceTerm: '   ' },
    });
    expect(emptyTerm.statusCode).toBe(400);
  });
});

describe('glossaries — effective resolution', () => {
  it('merges global and manual glossaries with manual precedence', async () => {
    const { app } = boot();
    const global = await createGlossary(app, { name: 'Global', sourceLang: 'en-US' });
    await createTerm(app, global.id, {
      sourceTerm: 'workspace',
      synonyms: ['project space'],
      translations: [{ targetLang: 'zh-CN', targetTerm: '工作区' }],
    });
    await createTerm(app, global.id, {
      sourceTerm: 'gateway',
      synonyms: ['portal'],
      translations: [{ targetLang: 'zh-CN', targetTerm: '网关', forbiddenTargets: ['门户'] }],
    });
    await createTerm(app, global.id, {
      sourceTerm: 'legacy-term',
      status: 'deprecated',
      translations: [{ targetLang: 'zh-CN', targetTerm: '旧词' }],
    });
    await createTerm(app, global.id, {
      sourceTerm: 'DITAEditor',
      doNotTranslate: true,
    });

    const manualScoped = await createGlossary(app, {
      scope: 'manual',
      manualId: 'manual-zh',
      name: 'Manual overrides',
      sourceLang: 'en',
    });
    await createTerm(app, manualScoped.id, {
      sourceTerm: 'workspace',
      translations: [{ targetLang: 'zh-CN', targetTerm: '工作空间' }],
    });

    const otherManual = await createGlossary(app, {
      scope: 'manual',
      manualId: 'manual-other',
      name: 'Other manual',
      sourceLang: 'en',
    });
    await createTerm(app, otherManual.id, {
      sourceTerm: 'workspace',
      translations: [{ targetLang: 'zh-CN', targetTerm: '不该出现' }],
    });

    const disabled = await createGlossary(app, { name: 'Disabled', sourceLang: 'en' });
    await createTerm(app, disabled.id, {
      sourceTerm: 'disabled-term',
      translations: [{ targetLang: 'zh-CN', targetTerm: '禁用术语' }],
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/glossaries/${disabled.id}`,
      headers: WRITER,
      payload: { enabled: false },
    });

    const result = await effective(
      app,
      'manualId=manual-zh&sourceLang=en-US&targetLang=zh-cn',
    );
    expect(result.targetLang).toBe('zh-CN');
    const terms = new Map(result.entries.map((entry) => [entry.sourceTerm, entry]));
    // `manual > global`
    expect(terms.get('workspace')?.targetTerm).toBe('工作空间');
    expect(terms.get('workspace')?.scope).toBe('manual');
    // The winning entry is taken wholesale, so the global synonyms do not leak in.
    expect(terms.get('workspace')?.synonyms).toEqual([]);
    expect(terms.get('gateway')?.synonyms).toEqual(['portal']);
    expect(terms.get('gateway')?.forbiddenTargets).toEqual(['门户']);
    // Deprecated and disabled glossaries never reach the editor.
    expect(terms.has('legacy-term')).toBe(false);
    expect(terms.has('disabled-term')).toBe(false);
    // A do-not-translate term keeps the source form.
    expect(terms.get('DITAEditor')?.targetTerm).toBe('DITAEditor');
    expect(terms.get('DITAEditor')?.doNotTranslate).toBe(true);

    // Without a manual only the globals apply, and the `en` ↔ `en-US` prefix match holds.
    const globalsOnly = await effective(app, 'targetLang=zh-CN&sourceLang=en-US');
    const globalTerms = new Map(globalsOnly.entries.map((entry) => [entry.sourceTerm, entry]));
    expect(globalTerms.get('workspace')?.targetTerm).toBe('工作区');
    expect(globalTerms.get('workspace')?.scope).toBe('global');

    const badLang = await app.inject({
      method: 'GET',
      url: '/api/glossaries/effective?targetLang=%%%',
      headers: ADMIN,
    });
    expect(badLang.statusCode).toBe(400);
  });
});

describe('glossaries — import and export', () => {
  it('previews, commits and round-trips CSV imports', async () => {
    const { app } = boot();
    const glossary = await createGlossary(app, { name: 'CSV terms', sourceLang: 'en-US' });

    const preview = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/import`,
      headers: WRITER,
      payload: { format: 'csv', content: CSV_CONTENT, dryRun: true },
    });
    expect(preview.statusCode).toBe(200);
    const previewBody = preview.json() as {
      dryRun: boolean;
      stats: {
        total: number;
        newCount: number;
        invalidCount: number;
        writtenTerms: number;
        writtenTranslations: number;
      };
      preview: Array<{ sourceTerm: string; action: string; targetLang: string | null }>;
    };
    expect(previewBody.dryRun).toBe(true);
    expect(previewBody.stats.total).toBe(2);
    expect(previewBody.stats.newCount).toBe(2);
    expect(previewBody.stats.writtenTerms).toBe(0);
    expect(previewBody.preview.map((row) => row.action)).toEqual(['create', 'create']);
    expect(await listTerms(app, glossary.id)).toHaveLength(0);

    const commit = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/import`,
      headers: WRITER,
      payload: { format: 'csv', content: CSV_CONTENT, dryRun: false },
    });
    expect(commit.statusCode).toBe(200);
    const commitBody = commit.json() as {
      dryRun: boolean;
      stats: { writtenTerms: number; writtenTranslations: number; newCount: number };
    };
    expect(commitBody.dryRun).toBe(false);
    expect(commitBody.stats.newCount).toBe(2);
    expect(commitBody.stats.writtenTerms).toBe(2);
    expect(commitBody.stats.writtenTranslations).toBe(2);

    const terms = await listTerms(app, glossary.id);
    expect(terms.map((term) => term.sourceTerm).sort()).toEqual(['brand', 'gateway']);
    const gateway = terms.find((term) => term.sourceTerm === 'gateway');
    expect(gateway?.translations[0]).toMatchObject({
      targetLang: 'zh-CN',
      targetTerm: '网关',
      forbiddenTargets: ['门户'],
    });
    expect(gateway?.caseSensitive).toBe(true);
    expect(gateway?.synonyms).toEqual(['edge node', 'proxy']);
    expect(terms.find((term) => term.sourceTerm === 'brand')?.doNotTranslate).toBe(true);

    // Re-importing the same content is an update, not a duplicate insert.
    const again = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/import`,
      headers: WRITER,
      payload: { format: 'csv', content: CSV_CONTENT, dryRun: false },
    });
    const againBody = again.json() as {
      stats: { newCount: number; updateCount: number; writtenTerms: number };
    };
    expect(againBody.stats.updateCount).toBe(2);
    expect(againBody.stats.newCount).toBe(0);
    expect(againBody.stats.writtenTerms).toBe(0);
    expect(await listTerms(app, glossary.id)).toHaveLength(2);

    // Filters
    expect(await listTerms(app, glossary.id, '?q=gate')).toHaveLength(1);
    expect(await listTerms(app, glossary.id, '?targetLang=zh-CN')).toHaveLength(2);
    expect(await listTerms(app, glossary.id, '?targetLang=ja')).toHaveLength(0);

    const exported = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}/export?format=csv&targetLang=zh-CN`,
      headers: ADMIN,
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.headers['content-disposition']).toContain('attachment');
    const csv = exported.body;
    expect(csv).toContain('sourceTerm');
    expect(csv).toContain('gateway');
    expect(csv).toContain('网关');

    // Round-trip into a fresh glossary.
    const clone = await createGlossary(app, { name: 'CSV clone', sourceLang: 'en-US' });
    const reimport = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${clone.id}/import`,
      headers: WRITER,
      payload: { format: 'csv', content: csv, dryRun: false },
    });
    expect(reimport.statusCode).toBe(200);
    const cloneTerms = await listTerms(app, clone.id);
    expect(cloneTerms).toHaveLength(2);
    const clonedGateway = cloneTerms.find((term) => term.sourceTerm === 'gateway');
    expect(clonedGateway?.translations[0]?.targetTerm).toBe('网关');
    expect(clonedGateway?.translations[0]?.forbiddenTargets).toEqual(['门户']);
  });

  it('round-trips JSON and TBX exports', async () => {
    const { app } = boot();
    const glossary = await createGlossary(app, { name: 'Exchange terms', sourceLang: 'en' });
    await createTerm(app, glossary.id, {
      sourceTerm: 'map',
      synonyms: ['ditamap'],
      translations: [{ targetLang: 'ja', targetTerm: 'マップ' }],
    });
    await createTerm(app, glossary.id, {
      sourceTerm: 'topic',
      translations: [{ targetLang: 'ja', targetTerm: 'トピック' }],
    });

    const jsonExport = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}/export?format=json`,
      headers: ADMIN,
    });
    expect(jsonExport.statusCode).toBe(200);
    expect(jsonExport.headers['content-type']).toContain('application/json');
    const rows = JSON.parse(jsonExport.body) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);

    const jsonClone = await createGlossary(app, { name: 'JSON clone', sourceLang: 'en' });
    const jsonImport = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${jsonClone.id}/import`,
      headers: WRITER,
      payload: { format: 'json', content: jsonExport.body, dryRun: false },
    });
    expect(jsonImport.statusCode).toBe(200);
    const jsonTerms = await listTerms(app, jsonClone.id);
    expect(jsonTerms).toHaveLength(2);
    expect(jsonTerms.find((term) => term.sourceTerm === 'map')?.translations[0]?.targetTerm).toBe(
      'マップ',
    );

    const tbxExport = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}/export?format=tbx&targetLang=ja`,
      headers: ADMIN,
    });
    expect(tbxExport.statusCode).toBe(200);
    expect(tbxExport.headers['content-type']).toContain('xml');
    expect(tbxExport.body).toContain('<martif');
    expect(tbxExport.body).toContain('TBX-Basic');
    expect(tbxExport.body).toContain('マップ');

    const tbxClone = await createGlossary(app, { name: 'TBX clone', sourceLang: 'en' });
    const tbxImport = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${tbxClone.id}/import`,
      headers: WRITER,
      payload: { format: 'tbx', content: tbxExport.body, dryRun: false },
    });
    expect(tbxImport.statusCode).toBe(200);
    const tbxBody = tbxImport.json() as {
      stats: { newCount: number; invalidCount: number };
      errors: Array<{ row: number; message: string }>;
    };
    expect(tbxBody.stats.invalidCount).toBe(0);
    expect(tbxBody.stats.newCount).toBe(2);
    const tbxTerms = await listTerms(app, tbxClone.id);
    expect(tbxTerms.map((term) => term.sourceTerm).sort()).toEqual(['map', 'topic']);
    expect(
      tbxTerms.find((term) => term.sourceTerm === 'topic')?.translations[0]?.targetTerm,
    ).toBe('トピック');
  });

  it('reports invalid rows without writing them', async () => {
    const { app } = boot();
    const glossary = await createGlossary(app, { name: 'Broken import', sourceLang: 'en' });
    const broken = `sourceTerm,targetLang,targetTerm
,,orphan
dup,zh-CN,一
dup,zh-CN,二
`;
    const response = await app.inject({
      method: 'POST',
      url: `/api/glossaries/${glossary.id}/import`,
      headers: WRITER,
      payload: { format: 'csv', content: broken, dryRun: false },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      stats: { invalidCount: number; writtenTerms: number };
      errors: Array<{ row: number; message: string }>;
    };
    expect(body.stats.invalidCount).toBeGreaterThan(0);
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.stats.writtenTerms).toBe(1);
    expect(await listTerms(app, glossary.id)).toHaveLength(1);

    const unsupported = await app.inject({
      method: 'GET',
      url: `/api/glossaries/${glossary.id}/export?format=yaml`,
      headers: ADMIN,
    });
    expect(unsupported.statusCode).toBe(400);
  });
});
