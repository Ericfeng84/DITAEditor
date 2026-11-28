/**
 * Phase 16 — multi-level translation lineage (pure kernels).
 *
 * The lineage tree is the one projection the sidebar, the derive dialog, the settings tab and the
 * hub/editor language strips all share, so these tests drive it with flat link lists only: no DOM,
 * no store, no fetch.
 */
import { describe, expect, it } from 'vitest';

import type { Manual } from '../src/services/manuals-api.js';
import type { TranslationLinkView } from '../src/services/translation-api.js';
import { buildTranslationLineage, pickDefaultActiveLink } from '../src/translation/translation-lineage.js';
import {
  buildSessionLanguageEditions,
  groupHubManualsByLanguageFamily,
} from '../src/workbench/manual-language-families.js';

function makeLink(overrides: Partial<TranslationLinkView> = {}): TranslationLinkView {
  const link: TranslationLinkView = {
    id: 'link-1',
    sourceManualId: 'manual-src',
    sourceBranch: 'main',
    sourceLang: 'en-US',
    targetManualId: 'manual-zh',
    targetBranch: 'main',
    targetLang: 'zh-CN',
    options: {},
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sourceManual: {
      id: 'manual-src',
      name: 'Gateway Manual',
      rootDir: '/tmp/gateway',
      exists: true,
      sourceLang: 'en-US',
    },
    targetManual: {
      id: 'manual-zh',
      name: '网关手册',
      rootDir: '/tmp/gateway-zh',
      exists: true,
      sourceLang: 'zh-CN',
    },
    counts: {
      total: 4,
      synced: 2,
      outdated: 1,
      untranslated: 1,
      inQueue: 0,
      inReview: 0,
      draftReady: 0,
      metadataOnly: 0,
      sourceDeleted: 0,
      sourceRenamed: 0,
      progressPercent: 50,
    },
    ...overrides,
  };
  return link;
}

function makeManual(overrides: Partial<Manual> & { id: string; name: string }): Manual {
  return {
    description: '',
    rootDir: `/tmp/${overrides.id}`,
    defaultRootMap: null,
    isBuiltin: false,
    archived: false,
    exists: true,
    sourceLang: 'en-US',
    currentBranch: 'main',
    stats: { totalTopics: 1, totalMaps: 1 },
    activeAssignmentCount: 0,
    myActiveAssignmentCount: 0,
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastOpenedAt: null,
    ...overrides,
  };
}

/** `en-US → zh-CN → ar-SA` plus a sibling `en-US → es-ES` derived from the root. */
function multiLevelLinks(): TranslationLinkView[] {
  return [
    makeLink({ id: 'link-zh', sourceLang: 'en-US', targetLang: 'zh-CN' }),
    makeLink({
      id: 'link-ar',
      sourceManualId: 'manual-zh',
      sourceBranch: 'main',
      sourceLang: 'zh-CN',
      targetManualId: 'manual-ar',
      targetBranch: 'main',
      targetLang: 'ar-SA',
      sourceManual: {
        id: 'manual-zh',
        name: '网关手册',
        rootDir: '/tmp/gateway-zh',
        exists: true,
        sourceLang: 'zh-CN',
      },
      targetManual: {
        id: 'manual-ar',
        name: 'دليل البوابة',
        rootDir: '/tmp/gateway-ar',
        exists: false,
        sourceLang: 'ar-SA',
      },
      counts: { ...makeLink().counts, progressPercent: 10 },
    }),
    makeLink({
      id: 'link-es',
      targetManualId: 'manual-es',
      targetLang: 'es-ES',
      counts: { ...makeLink().counts, progressPercent: 80 },
    }),
  ];
}

describe('buildTranslationLineage', () => {
  it('builds a depth-first tree with depth, path languages and root metadata', () => {
    const lineage = buildTranslationLineage({
      links: multiLevelLinks(),
      entryManualId: 'manual-src',
      entryManualName: 'Gateway Manual',
      entrySourceLang: 'en-US',
      entryBranch: 'main',
    });

    expect(lineage.roots.map((root) => [root.manualId, root.depth, root.lang])).toEqual([
      ['manual-src', 0, 'en-US'],
    ]);
    expect(lineage.maxDepth).toBe(2);

    // Siblings are sorted by target language, and descendants follow their parent immediately.
    expect(lineage.orderedLinks.map((link) => link.id)).toEqual(['link-es', 'link-zh', 'link-ar']);

    expect([...lineage.familyLangs].sort()).toEqual(['ar-sa', 'en-us', 'es-es', 'zh-cn']);

    const zhNode = lineage.nodeByManualId.get('manual-zh');
    expect(zhNode).toMatchObject({
      depth: 1,
      pathLangs: ['en-US', 'zh-CN'],
      parentManualId: 'manual-src',
      branch: 'main',
    });
    const arNode = lineage.nodeByManualId.get('manual-ar');
    expect(arNode).toMatchObject({
      depth: 2,
      pathLangs: ['en-US', 'zh-CN', 'ar-SA'],
      exists: false,
    });
  });

  it('reports ancestors, descendants and only unsynced upstream links', () => {
    const links = multiLevelLinks().map((link) =>
      // zh-CN is fully synced, so it must not be reported as a pending ancestor.
      link.id === 'link-zh'
        ? { ...link, counts: { ...link.counts, synced: 4 } }
        : link,
    );
    const { linkMetaById } = buildTranslationLineage({
      links,
      entryManualId: 'manual-ar',
      entrySourceLang: 'ar-SA',
      entryBranch: 'main',
    });

    const zhMeta = linkMetaById.get('link-zh');
    expect(zhMeta?.depth).toBe(1);
    expect(zhMeta?.pathLangs).toEqual(['en-US', 'zh-CN']);
    expect(zhMeta?.ancestorLinks).toEqual([]);
    expect(zhMeta?.upstreamPending).toEqual([]);
    expect(zhMeta?.descendantLinks.map((link) => link.id)).toEqual(['link-ar']);
    expect(zhMeta?.descendantLangs).toEqual(['ar-SA']);

    const arMeta = linkMetaById.get('link-ar');
    expect(arMeta?.depth).toBe(2);
    expect(arMeta?.pathLangs).toEqual(['en-US', 'zh-CN', 'ar-SA']);
    expect(arMeta?.ancestorLinks.map((link) => link.id)).toEqual(['link-zh']);
    expect(arMeta?.upstreamPending).toEqual([]);

    const pending = buildTranslationLineage({
      links: multiLevelLinks(),
      entryManualId: 'manual-ar',
      entryBranch: 'main',
    });
    expect(pending.linkMetaById.get('link-ar')?.upstreamPending.map((link) => link.id)).toEqual([
      'link-zh',
    ]);
  });

  it('orders source candidates depth-first with their resolved progress', () => {
    const { sourceCandidates } = buildTranslationLineage({
      links: multiLevelLinks(),
      entryManualId: 'manual-src',
      entrySourceLang: 'en-US',
      entryBranch: 'main',
    });

    expect(
      sourceCandidates.map((candidate) => [candidate.manualId, candidate.depth, candidate.progressPercent]),
    ).toEqual([
      ['manual-src', 0, null],
      ['manual-es', 1, 80],
      ['manual-zh', 1, 50],
      ['manual-ar', 2, 10],
    ]);
    expect(sourceCandidates[3]).toMatchObject({
      lang: 'ar-SA',
      pathLangs: ['en-US', 'zh-CN', 'ar-SA'],
    });
  });

  it('keeps every link visible when the graph contains a cycle', () => {
    const lineage = buildTranslationLineage({
      links: [
        makeLink({ id: 'a-b', sourceManualId: 'a', targetManualId: 'b' }),
        makeLink({
          id: 'b-a',
          sourceManualId: 'b',
          sourceLang: 'zh-CN',
          targetManualId: 'a',
          targetLang: 'en-US',
        }),
      ],
      entryManualId: 'a',
      entryBranch: 'main',
    });

    expect(lineage.roots.map((root) => root.manualId)).toEqual(['a']);
    expect(lineage.orderedLinks.map((link) => link.id).sort()).toEqual(['a-b', 'b-a']);
    expect(lineage.maxDepth).toBe(2);
  });

  it('promotes disconnected components to their own roots instead of dropping them', () => {
    const lineage = buildTranslationLineage({
      links: [
        makeLink({ id: 'src-zh', targetManualId: 'manual-zh', targetLang: 'zh-CN' }),
        makeLink({
          id: 'x-y',
          sourceManualId: 'manual-x',
          sourceLang: 'ja-JP',
          targetManualId: 'manual-y',
          targetLang: 'ko-KR',
        }),
      ],
      entryManualId: 'manual-src',
      entrySourceLang: 'en-US',
      entryBranch: 'main',
    });

    expect(lineage.roots.map((root) => root.manualId)).toEqual(['manual-src', 'manual-x']);
    expect(lineage.nodeByManualId.get('manual-y')?.depth).toBe(1);
  });

  it('adds the entry manual as a lonely root before its first target language exists', () => {
    const lineage = buildTranslationLineage({
      links: [],
      entryManualId: 'manual-new',
      entryManualName: 'Draft Manual',
      entrySourceLang: 'en-US',
      entryBranch: 'main',
    });

    expect(lineage.roots).toHaveLength(1);
    expect(lineage.roots[0]).toMatchObject({
      manualId: 'manual-new',
      lang: 'en-US',
      manualName: 'Draft Manual',
      depth: 0,
    });
    expect(lineage.orderedLinks).toEqual([]);
    expect(lineage.maxDepth).toBe(0);
  });
});

describe('pickDefaultActiveLink', () => {
  const links = multiLevelLinks();
  const lineage = buildTranslationLineage({
    links,
    entryManualId: 'manual-src',
    entrySourceLang: 'en-US',
    entryBranch: 'main',
  });

  it('prefers the requested link from the URL', () => {
    expect(pickDefaultActiveLink(links, lineage, 'manual-src', 'link-ar')?.id).toBe('link-ar');
  });

  it('falls back to the entry manual as a source', () => {
    expect(pickDefaultActiveLink(links, lineage, 'manual-src', null)?.id).toBe('link-zh');
  });

  it('uses the incoming pair when the entry manual has no outgoing link', () => {
    expect(pickDefaultActiveLink(links, lineage, 'manual-ar', null)?.id).toBe('link-ar');
  });

  it('uses the first DFS link as a last resort', () => {
    expect(pickDefaultActiveLink(links, lineage, 'manual-unknown', 'missing')?.id).toBe('link-es');
    const empty = buildTranslationLineage({ links: [], entryManualId: 'manual-unknown' });
    expect(pickDefaultActiveLink([], empty, 'manual-unknown', null)).toBeNull();
  });
});

describe('groupHubManualsByLanguageFamily (multi-level)', () => {
  it('attaches grandchildren to the root card with their full lineage path', () => {
    const source = makeManual({ id: 'manual-src', name: 'Gateway Manual', sourceLang: 'en-US' });
    const zh = makeManual({ id: 'manual-zh', name: '网关手册', sourceLang: 'zh-CN' });
    const ar = makeManual({ id: 'manual-ar', name: 'دليل البوابة', sourceLang: 'ar-SA', exists: false });

    const { visibleManuals, editionsByManualId } = groupHubManualsByLanguageFamily(
      [source, zh, ar],
      multiLevelLinks(),
    );

    expect(visibleManuals.map((manual) => manual.id)).toEqual(['manual-src']);
    const editions = editionsByManualId.get('manual-src') ?? [];
    expect(editions.map((edition) => edition.lang)).toEqual(['en-US', 'es-ES', 'zh-CN', 'ar-SA']);
    expect(editions[2]).toMatchObject({
      depth: 1,
      parentLang: 'en-US',
      lineagePath: ['en-US', 'zh-CN'],
    });
    expect(editions[3]).toMatchObject({
      manualId: 'manual-ar',
      depth: 2,
      parentLang: 'zh-CN',
      lineagePath: ['en-US', 'zh-CN', 'ar-SA'],
      exists: false,
    });
    expect(editions[1]).toMatchObject({ depth: 1, lineagePath: ['en-US', 'es-ES'] });
  });
});

describe('buildSessionLanguageEditions (multi-level)', () => {
  const links = multiLevelLinks();

  it('climbs to the true root from a grandchild session and marks only the root as base', () => {
    const editions = buildSessionLanguageEditions({
      manualId: 'manual-ar',
      branch: 'main',
      manualName: 'دليل البوابة',
      sourceLang: 'ar-SA',
      links,
    });

    expect(editions.map((edition) => [edition.lang, edition.isBase, edition.isCurrent])).toEqual([
      ['en-US', true, false],
      ['es-ES', false, false],
      ['zh-CN', false, false],
      ['ar-SA', false, true],
    ]);
    expect(editions[0]).toMatchObject({ manualId: 'manual-src', manualName: 'Gateway Manual' });
    expect(editions[3]).toMatchObject({
      manualId: 'manual-ar',
      linkId: 'link-ar',
      progressPercent: 10,
      depth: 2,
      parentLang: 'zh-CN',
      lineagePath: ['en-US', 'zh-CN', 'ar-SA'],
    });
  });

  it('keeps siblings of an intermediate session visible and the root as the only base', () => {
    const editions = buildSessionLanguageEditions({
      manualId: 'manual-zh',
      branch: 'main',
      manualName: '网关手册',
      sourceLang: 'zh-CN',
      links,
    });

    expect(editions.map((edition) => [edition.lang, edition.isBase, edition.isCurrent])).toEqual([
      ['en-US', true, false],
      ['es-ES', false, false],
      ['zh-CN', false, true],
      ['ar-SA', false, false],
    ]);
    expect(editions.filter((edition) => edition.isBase)).toHaveLength(1);
  });
});
