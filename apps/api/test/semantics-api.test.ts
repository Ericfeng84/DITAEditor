import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_SOURCE_DIR = path.resolve(__dirname, '../../../samples/demo-dita-project');

describe('Phase 3 Semantic Indexer API (/api/semantics/* & /api/diagnostics)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'dita-semantics-api-'));
    cpSync(DEMO_SOURCE_DIR, tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns workspace ditavals, root-map keyspaces, conref resolution, and zero demo diagnostics', async () => {
    const app = createServer({ workspaceDir: tempDir, logger: false });
    await app.ready();

    try {
      // 1. Workspace snapshot exposes .ditaval files
      const wsRes = await app.inject({ method: 'GET', url: '/api/workspace' });
      expect(wsRes.statusCode).toBe(200);
      const wsBody = wsRes.json() as {
        ditavals: { path: string; name: string }[];
      };
      expect(wsBody.ditavals.map((d) => d.path)).toEqual(
        expect.arrayContaining(['filters/cloud-edition.ditaval', 'filters/onprem-admin.ditaval']),
      );

      // 2. Semantic context for product-manual.ditamap + cloud-edition.ditaval
      const ctxRes = await app.inject({
        method: 'GET',
        url: '/api/semantics/context?rootMap=product-manual.ditamap&ditaval=filters/cloud-edition.ditaval',
      });
      expect(ctxRes.statusCode).toBe(200);
      const ctx = ctxRes.json() as {
        keyspace: { keys: Record<string, { inlineText?: string; resolvedHref?: string }> };
        activeDitaval: { defaultAction: string } | null;
        topicIndices: { filePath: string }[];
        profilingCatalog: Record<string, string[]>;
      };
      expect(ctx.keyspace.keys['prod_name']?.inlineText).toBe('DITAEditor Enterprise');
      expect(ctx.keyspace.keys['deployment_mode']?.inlineText).toBe('Cloud SaaS 多租户');
      expect(ctx.keyspace.keys['common_reuse']?.resolvedHref).toBe('shared/common-reuse.dita');
      expect(ctx.activeDitaval?.defaultAction).toBe('include');
      expect(ctx.topicIndices.some((t) => t.filePath === 'shared/common-reuse.dita')).toBe(true);
      expect(ctx.profilingCatalog['product']).toEqual(expect.arrayContaining(['cloud', 'onprem']));

      const cleanDiagRes = await app.inject({
        method: 'GET',
        url: '/api/diagnostics?rootMap=product-manual.ditamap',
      });
      expect(cleanDiagRes.statusCode).toBe(200);
      expect((cleanDiagRes.json() as { diagnostics: unknown[] }).diagnostics).toEqual([]);

      // 3. Switching Root Map to admin-book.bookmap swaps key values dynamically
      const bookKsRes = await app.inject({
        method: 'GET',
        url: '/api/semantics/keyspace?rootMap=admin-book.bookmap',
      });
      expect(bookKsRes.statusCode).toBe(200);
      const bookKs = bookKsRes.json() as {
        keyspace: { keys: Record<string, { inlineText?: string }> };
      };
      expect(bookKs.keyspace.keys['prod_name']?.inlineText).toBe('DITAEditor 私有化平台版');
      expect(bookKs.keyspace.keys['deployment_mode']?.inlineText).toBe('私有化内网集群');

      // 4. Resolve document overlay & single conkeyref preview
      const docRes = await app.inject({
        method: 'POST',
        url: '/api/semantics/resolve-document',
        payload: {
          filePath: 'concepts/single-sourcing.dita',
          rootMapPath: 'product-manual.ditamap',
        },
      });
      expect(docRes.statusCode).toBe(200);
      const overlay = docRes.json() as {
        keyrefs: Record<string, { status: string; resolvedText?: string }>;
        conrefs: Record<string, { status: string; resolvedText?: string }>;
        diagnostics: unknown[];
      };
      expect(overlay.keyrefs['prod_name']?.status).toBe('resolved');
      expect(overlay.keyrefs['prod_name']?.resolvedText).toBe('DITAEditor Enterprise');
      expect(Object.values(overlay.conrefs).some((c) => c.status === 'resolved')).toBe(true);
      expect(overlay.diagnostics).toEqual([]);

      const singleConrefRes = await app.inject({
        method: 'POST',
        url: '/api/semantics/resolve-conref',
        payload: {
          sourceFilePath: 'concepts/single-sourcing.dita',
          sourceTagName: 'note',
          attrName: 'conkeyref',
          rawValue: 'common_reuse/backup_warning',
          rootMapPath: 'product-manual.ditamap',
        },
      });
      expect(singleConrefRes.statusCode).toBe(200);
      const singleConref = singleConrefRes.json() as {
        status: string;
        targetFilePath?: string;
        resolvedText?: string;
      };
      expect(singleConref.status).toBe('resolved');
      expect(singleConref.targetFilePath).toBe('shared/common-reuse.dita');
      expect(singleConref.resolvedText).toContain('DITAEditor Enterprise');
    } finally {
      await app.close();
    }
  });

  it('incrementally updates keyspace and flags injected conref cycles & undefined keyrefs', async () => {
    const app = createServer({ workspaceDir: tempDir, logger: false });
    await app.ready();

    try {
      // 1. Update product-manual.ditamap keydef -> keyspace refreshes incrementally
      const mapGet = await app.inject({
        method: 'GET',
        url: '/api/files/content?path=product-manual.ditamap',
      });
      const mapXml = (mapGet.json() as { content: string }).content;
      const updatedMapXml = mapXml.replace('DITAEditor Enterprise', 'DITAEditor NextGen');

      const mapPut = await app.inject({
        method: 'PUT',
        url: '/api/files/content',
        payload: { path: 'product-manual.ditamap', content: updatedMapXml },
      });
      expect(mapPut.statusCode).toBe(200);

      const ksRes = await app.inject({
        method: 'GET',
        url: '/api/semantics/keyspace?rootMap=product-manual.ditamap',
      });
      const ksBody = ksRes.json() as {
        keyspace: { keys: Record<string, { inlineText?: string }> };
      };
      expect(ksBody.keyspace.keys['prod_name']?.inlineText).toBe('DITAEditor NextGen');

      // 2. Inject circular conref + undefined keyref in a topic -> /api/diagnostics catches both
      const badTopic = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="bad_loop">
  <title>Broken Topic</title>
  <body>
    <p><keyword keyref="no_such_key"/></p>
    <p id="loop_a" conref="#bad_loop/loop_b"/>
    <p id="loop_b" conref="#bad_loop/loop_a"/>
  </body>
</topic>`;
      const topicPut = await app.inject({
        method: 'PUT',
        url: '/api/files/content',
        payload: { path: 'concepts/broken-loop.dita', content: badTopic },
      });
      expect(topicPut.statusCode).toBe(200);

      const diagRes = await app.inject({
        method: 'GET',
        url: '/api/diagnostics?rootMap=product-manual.ditamap',
      });
      expect(diagRes.statusCode).toBe(200);
      const { diagnostics } = diagRes.json() as {
        diagnostics: {
          filePath: string;
          source: string;
          keyName?: string;
          cycleChain?: string[];
        }[];
      };
      expect(
        diagnostics.some(
          (d) =>
            d.filePath === 'concepts/broken-loop.dita' &&
            d.source === 'keyref' &&
            d.keyName === 'no_such_key',
        ),
      ).toBe(true);
      expect(
        diagnostics.some(
          (d) =>
            d.filePath === 'concepts/broken-loop.dita' &&
            d.source === 'conref-cycle' &&
            (d.cycleChain?.length ?? 0) >= 2,
        ),
      ).toBe(true);
    } finally {
      await app.close();
    }
  });
});
