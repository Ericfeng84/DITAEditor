import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMapTemplate,
  createTopicTemplate,
  insertMapNode,
  moveMapNodes,
  parseDitaMap,
  updateMapNodeAttr,
} from '@dita/core';
import { createServer } from '../src/index.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function buildScaleDitaProject(rootDir: string): void {
  mkdirSync(path.join(rootDir, 'maps'), { recursive: true });
  mkdirSync(path.join(rootDir, 'topics', 'section-a'), { recursive: true });
  mkdirSync(path.join(rootDir, 'topics', 'section-b'), { recursive: true });
  mkdirSync(path.join(rootDir, 'images'), { recursive: true });

  // Sample SVG image
  writeFileSync(
    path.join(rootDir, 'images', 'diagram.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="#4f46e5"/></svg>\n',
    'utf8',
  );

  // Create 55 topics across two folders
  const submapTopicRefs: string[][] = [[], [], [], []];
  for (let i = 1; i <= 55; i++) {
    const folder = i <= 28 ? 'topics/section-a' : 'topics/section-b';
    const kind = i % 3 === 0 ? 'task' : i % 3 === 1 ? 'concept' : 'reference';
    const fileName = `topic-${String(i).padStart(2, '0')}.dita`;
    const relPath = `${folder}/${fileName}`;
    const xml = createTopicTemplate(kind, {
      id: `topic_${i}`,
      title: `Scale Topic ${i}`,
    });
    writeFileSync(path.join(rootDir, relPath), xml, 'utf8');

    const bucket = (i - 1) % 4;
    submapTopicRefs[bucket]!.push(`    <topicref href="../${relPath}" type="${kind}" navtitle="Topic ${i}"/>`);
  }

  // Create 4 nested sub-maps
  for (let m = 0; m < 4; m++) {
    const subXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
      `<map id="submap_${m + 1}" xml:lang="zh-CN">`,
      `  <title>Submap ${m + 1}</title>`,
      ...submapTopicRefs[m]!,
      '</map>',
      '',
    ].join('\n');
    writeFileSync(path.join(rootDir, 'maps', `submap-${m + 1}.ditamap`), subXml, 'utf8');
  }

  // Root ditamap with comments, reltable, keydef, and 4 maprefs
  const rootMap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
    '<!-- Preserved root map editorial comment -->',
    '<map id="scale_root_map" xml:lang="zh-CN">',
    '  <title>55-Topic Scale Project Map</title>',
    '  <keydef keys="product" processing-role="resource-only">',
    '    <topicmeta><keywords><keyword>DITAEditor</keyword></keywords></topicmeta>',
    '  </keydef>',
    '  <mapref href="maps/submap-1.ditamap" format="ditamap"/>',
    '  <mapref href="maps/submap-2.ditamap" format="ditamap"/>',
    '  <mapref href="maps/submap-3.ditamap" format="ditamap"/>',
    '  <mapref href="maps/submap-4.ditamap" format="ditamap"/>',
    '  <reltable>',
    '    <relrow>',
    '      <relcell><topicref href="topics/section-a/topic-01.dita"/></relcell>',
    '      <relcell><topicref href="topics/section-b/topic-29.dita"/></relcell>',
    '    </relrow>',
    '  </reltable>',
    '</map>',
    '',
  ].join('\n');
  writeFileSync(path.join(rootDir, 'root-manual.ditamap'), rootMap, 'utf8');

  // Root secondary map
  const adminGuide = createMapTemplate('map', { id: 'scale_book', title: '55-Topic Admin Guide' });
  writeFileSync(path.join(rootDir, 'admin-guide.ditamap'), adminGuide, 'utf8');
}

describe('Phase 2 Fastify Workspace, Map Persistence & Asset API', () => {
  it('loads the curated demo-dita-project with zero broken links or XML errors', async () => {
    // Isolated imports root: the manual registry lives in the default sqlite DB, and a shared DB
    // (e.g. the one a local dev server created) would make headerless requests resolve to whatever
    // manual was touched last instead of the built-in demo project.
    const app = createServer({ importsRootDir: createTempDir('dita-imports-'), logger: false });
    const res = await app.inject({ method: 'GET', url: '/api/workspace' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.maps.length).toBeGreaterThanOrEqual(4);
    expect(body.stats.totalTopics).toBeGreaterThanOrEqual(9);

    const diagRes = await app.inject({
      method: 'GET',
      url: '/api/diagnostics?rootMap=product-manual.ditamap',
    });
    expect(diagRes.statusCode).toBe(200);
    expect(diagRes.json().diagnostics).toEqual([]);

    const assetRes = await app.inject({
      method: 'GET',
      url: '/api/assets/resolve?from=concepts/dita-architecture.dita&href=../images/architecture.svg',
    });
    expect(assetRes.statusCode).toBe(200);
    expect(assetRes.headers['content-type']).toContain('image/svg+xml');
    expect(assetRes.body).toContain('<svg');
    await app.close();
  });

  it('handles a 55-topic + 4-submap project: scans, restructures maps losslessly, uploads assets, and enforces security', async () => {
    const workspaceDir = createTempDir('dita-scale-');
    const importsDir = createTempDir('dita-imports-');
    buildScaleDitaProject(workspaceDir);

    const app = createServer({ workspaceDir, importsRootDir: importsDir, logger: false });

    // 1. Scan 55-topic project
    const wsRes = await app.inject({ method: 'GET', url: '/api/workspace' });
    expect(wsRes.statusCode).toBe(200);
    const ws = wsRes.json();
    expect(ws.stats.totalTopics).toBe(55);
    expect(ws.stats.totalMaps).toBe(6);
    expect(ws.topicTitles['topics/section-a/topic-01.dita']).toBe('Scale Topic 1');
    expect(ws.topicTitles['topics/section-b/topic-55.dita']).toBe('Scale Topic 55');
    expect(ws.topicTypes['topics/section-a/topic-01.dita']).toBe('concept');
    expect(ws.topicTypes['topics/section-a/topic-03.dita']).toBe('task');
    expect(ws.topicTypes['topics/section-a/topic-02.dita']).toBe('reference');

    // 2. Security guard against path traversal
    const traversal = await app.inject({
      method: 'GET',
      url: '/api/files/content?path=../../etc/passwd',
    });
    expect(traversal.statusCode).toBe(400);

    // 3. Create new topic from template + restructure root map + persist to disk
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/files/create',
      payload: {
        path: 'topics/section-a/topic-56.dita',
        kind: 'concept',
        id: 'topic_56',
        title: 'Newly Mounted Concept',
      },
    });
    expect(createRes.statusCode).toBe(200);
    expect(createRes.json().wellFormed).toBe(true);

    const mapRes = await app.inject({
      method: 'GET',
      url: '/api/files/content?path=root-manual.ditamap',
    });
    const originalMapXml = mapRes.json().content as string;
    const parsedInitial = parseDitaMap(originalMapXml);
    // Reorder submap-4 to slot 1 (right after keydef) and mount topic-56
    const reordered = moveMapNodes(
      originalMapXml,
      [parsedInitial.nodes[4]!.elementPath],
      null,
      1,
    );
    expect(reordered.moved).toBe(true);
    const inserted = insertMapNode(reordered.xml, {
      parentPath: null,
      tagName: 'topicref',
      attrs: [
        { name: 'href', value: 'topics/section-a/topic-56.dita', namespaceURI: null },
        { name: 'type', value: 'concept', namespaceURI: null },
      ],
      navtitle: 'Newly Mounted Concept',
    });
    const updatedAttr = updateMapNodeAttr(
      inserted.xml,
      inserted.insertedPath,
      'audience',
      'admin',
    );

    const saveMapRes = await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      payload: { path: 'root-manual.ditamap', content: updatedAttr.xml },
    });
    expect(saveMapRes.statusCode).toBe(200);

    // Verify lossless persistence on reload
    const reloadedMap = await app.inject({
      method: 'GET',
      url: '/api/files/content?path=root-manual.ditamap',
    });
    const reloadedXml = reloadedMap.json().content as string;
    expect(reloadedXml).toContain('<!-- Preserved root map editorial comment -->');
    expect(reloadedXml).toContain('<reltable>');
    expect(reloadedXml.indexOf('topic-56.dita')).toBeLessThan(reloadedXml.indexOf('<reltable>'));
    const parsedReloaded = parseDitaMap(reloadedXml);
    expect(parsedReloaded.nodes[1]!.href).toBe('maps/submap-4.ditamap');

    // 4. Multipart image upload + relative resolution
    const boundary = '----DitaTestBoundary12345';
    const svgPayload = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="fromDocPath"',
      '',
      'topics/section-a/topic-56.dita',
      `--${boundary}`,
      'Content-Disposition: form-data; name="targetDir"',
      '',
      'images',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="arch-upload.svg"',
      'Content-Type: image/svg+xml',
      '',
      svgPayload,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/assets/upload',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartBody,
    });
    expect(uploadRes.statusCode).toBe(200);
    const uploaded = uploadRes.json();
    expect(uploaded.relativeHref).toBe('../../images/arch-upload.svg');

    const resolvedImg = await app.inject({
      method: 'GET',
      url: `/api/assets/resolve?from=topics/section-a/topic-56.dita&href=${encodeURIComponent(uploaded.relativeHref)}`,
    });
    expect(resolvedImg.statusCode).toBe(200);
    expect(resolvedImg.body).toBe(svgPayload);

    // 5. Diagnostics detects broken href + malformed XML
    const submap1 = await app.inject({
      method: 'GET',
      url: '/api/files/content?path=maps/submap-1.ditamap',
    });
    const brokenSubmap = (submap1.json().content as string).replace(
      'topic-01.dita',
      'does-not-exist.dita',
    );
    await app.inject({
      method: 'PUT',
      url: '/api/files/content',
      payload: { path: 'maps/submap-1.ditamap', content: brokenSubmap },
    });

    const diagRes = await app.inject({
      method: 'GET',
      url: '/api/diagnostics?rootMap=root-manual.ditamap',
    });
    expect(diagRes.statusCode).toBe(200);
    const diags = diagRes.json().diagnostics as { source: string; targetHref?: string }[];
    expect(diags.some((d) => d.source === 'map-ref' && d.targetHref?.includes('does-not-exist.dita'))).toBe(true);

    // 6. Batch import workspace
    const importRes = await app.inject({
      method: 'POST',
      url: '/api/workspace/import',
      payload: {
        projectName: 'imported-suite',
        files: [
          {
            path: 'main.ditamap',
            content: createMapTemplate('map', { id: 'imp_map', title: 'Imported Map' }),
          },
          {
            path: 'intro.dita',
            content: createTopicTemplate('topic', { id: 'imp_intro', title: 'Imported Intro' }),
          },
        ],
      },
    });
    expect(importRes.statusCode).toBe(200);
    expect(importRes.json().maps[0].title).toBe('Imported Map');
    expect(importRes.json().stats.totalTopics).toBe(1);

    await app.close();
  });

  it('lists, creates, persists and forgets workspaces through the registry API', async () => {
    const workspaceDir = createTempDir('dita-ws-root-');
    const importsDir = createTempDir('dita-ws-imports-');
    mkdirSync(path.join(workspaceDir, 'topics'), { recursive: true });
    writeFileSync(
      path.join(workspaceDir, 'topics', 'intro.dita'),
      createTopicTemplate('topic', { id: 'intro', title: 'Intro' }),
      'utf8',
    );

    const app = createServer({ workspaceDir, importsRootDir: importsDir, logger: false });

    // 1. Initial picker snapshot seeds the active workspace
    const initial = await app.inject({ method: 'GET', url: '/api/workspaces' });
    expect(initial.statusCode).toBe(200);
    const initialBody = initial.json();
    expect(initialBody.importsRootDir).toBe(importsDir);
    expect(initialBody.current.path).toBe(realpathSync(workspaceDir));
    expect(initialBody.workspaces[0].isCurrent).toBe(true);

    // 2. Blank scaffold: standard directories, no maps/topics
    const blankRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces/create',
      payload: { name: 'blank-docs', parentDir: importsDir, scaffold: 'blank' },
    });
    expect(blankRes.statusCode).toBe(200);
    const blank = blankRes.json();
    const blankRoot = realpathSync(path.join(importsDir, 'blank-docs'));
    expect(blank.rootDir).toBe(blankRoot);
    expect(blank.maps).toEqual([]);
    expect(blank.stats.totalTopics).toBe(0);
    for (const dir of ['topics', 'maps', 'images']) {
      expect(existsSync(path.join(blankRoot, dir))).toBe(true);
    }
    expect(existsSync(path.join(importsDir, 'workspaces.json'))).toBe(true);

    // 3. Starter scaffold: index.ditamap + introduction topic
    const starterRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces/create',
      payload: { name: 'starter-manual', parentDir: importsDir, scaffold: 'starter' },
    });
    expect(starterRes.statusCode).toBe(200);
    const starter = starterRes.json();
    const starterRoot = realpathSync(path.join(importsDir, 'starter-manual'));
    expect(starter.rootDir).toBe(starterRoot);
    expect(starter.maps[0].path).toBe('index.ditamap');
    expect(starter.stats.totalTopics).toBe(1);
    expect(readFileSync(path.join(starterRoot, 'topics', 'introduction.dita'), 'utf8')).toContain(
      'starter-manual 项目介绍',
    );
    expect(readFileSync(path.join(starterRoot, 'index.ditamap'), 'utf8')).toContain(
      'href="topics/introduction.dita"',
    );

    // 4. Duplicate creation is rejected
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces/create',
      payload: { name: 'blank-docs', parentDir: importsDir, scaffold: 'blank' },
    });
    expect(duplicateRes.statusCode).toBe(409);

    // 5. Picker lists all workspaces, current points at the newest one
    const listed = await app.inject({ method: 'GET', url: '/api/workspaces' });
    expect(listed.statusCode).toBe(200);
    const listedBody = listed.json();
    expect(listedBody.current.path).toBe(starterRoot);
    const paths = (listedBody.workspaces as { path: string }[]).map((ws) => ws.path);
    expect(paths).toContain(blankRoot);
    expect(paths).toContain(starterRoot);

    // 6. Forget removes only the registry entry
    const forgetRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces/forget',
      payload: { path: blankRoot },
    });
    expect(forgetRes.statusCode).toBe(200);
    expect((forgetRes.json().workspaces as { path: string }[]).map((ws) => ws.path)).not.toContain(
      blankRoot,
    );
    expect(existsSync(blankRoot)).toBe(true);

    await app.close();

    // 7. Registry survives a server restart
    const restarted = createServer({ workspaceDir, importsRootDir: importsDir, logger: false });
    const afterRestart = await restarted.inject({ method: 'GET', url: '/api/workspaces' });
    const restartPaths = (afterRestart.json().workspaces as { path: string }[]).map(
      (ws) => ws.path,
    );
    expect(restartPaths).toContain(starterRoot);
    expect(restartPaths).not.toContain(blankRoot);
    await restarted.close();
  });

  it('discovers unregistered workspace dirs and hides forgotten ones across restarts', async () => {
    const workspaceDir = createTempDir('dita-ws-root-');
    const importsDir = createTempDir('dita-ws-imports-');

    // An orphan workspace directory that never went through the registry.
    const orphan = path.join(importsDir, 'legacy-cookbook');
    mkdirSync(path.join(orphan, 'topics'), { recursive: true });
    writeFileSync(
      path.join(orphan, 'topics', 'cookbook.dita'),
      createTopicTemplate('concept', { id: 'cookbook', title: 'Cookbook' }),
      'utf8',
    );
    // A plain file next to the dirs must not be treated as a workspace.
    writeFileSync(path.join(importsDir, 'notes.txt'), 'not a workspace', 'utf8');
    const orphanRoot = realpathSync(orphan);

    const app = createServer({ workspaceDir, importsRootDir: importsDir, logger: false });

    // 1. Discovery surfaces the orphan as an unregistered entry.
    const first = await app.inject({ method: 'GET', url: '/api/workspaces' });
    const firstBody = first.json();
    const discovered = (firstBody.workspaces as {
      path: string;
      name: string;
      unregistered?: boolean;
      exists: boolean;
    }[]).find((ws) => ws.path === orphanRoot);
    expect(discovered?.unregistered).toBe(true);
    expect(discovered?.name).toBe('legacy-cookbook');
    expect(discovered?.exists).toBe(true);
    expect(
      (firstBody.workspaces as { name: string }[]).some((ws) => ws.name === 'notes.txt'),
    ).toBe(false);

    // 2. Opening it registers it (no longer unregistered, becomes current).
    const opened = await app.inject({
      method: 'POST',
      url: '/api/workspace/open',
      payload: { rootDir: orphan },
    });
    expect(opened.statusCode).toBe(200);
    const afterOpen = await app.inject({ method: 'GET', url: '/api/workspaces' });
    const openedEntry = (afterOpen.json().workspaces as {
      path: string;
      unregistered?: boolean;
      isCurrent: boolean;
    }[]).find((ws) => ws.path === orphanRoot);
    expect(openedEntry?.unregistered).toBe(false);
    expect(openedEntry?.isCurrent).toBe(true);

    // 3. Switch back, then forget the orphan: it is hidden, not deleted.
    await app.inject({
      method: 'POST',
      url: '/api/workspace/open',
      payload: { rootDir: workspaceDir },
    });
    const forgetRes = await app.inject({
      method: 'POST',
      url: '/api/workspaces/forget',
      payload: { path: orphanRoot },
    });
    expect(forgetRes.statusCode).toBe(200);
    expect(
      (forgetRes.json().workspaces as { path: string }[]).map((ws) => ws.path),
    ).not.toContain(orphanRoot);
    expect(existsSync(orphanRoot)).toBe(true);

    const afterForget = await app.inject({ method: 'GET', url: '/api/workspaces' });
    expect(
      (afterForget.json().workspaces as { path: string }[]).map((ws) => ws.path),
    ).not.toContain(orphanRoot);

    await app.close();

    // 4. The hidden tombstone survives a restart, so discovery stays quiet.
    const restarted = createServer({ workspaceDir, importsRootDir: importsDir, logger: false });
    const afterRestart = await restarted.inject({ method: 'GET', url: '/api/workspaces' });
    expect(
      (afterRestart.json().workspaces as { path: string }[]).map((ws) => ws.path),
    ).not.toContain(orphanRoot);
    await restarted.close();
  });
});
