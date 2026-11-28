/**
 * Phase 16 — pure workflow projection of the translation file matrix.
 *
 * These tests pin the *legality* matrix rather than the rendering: which workspace scope owns a
 * row, which pipeline stage it sits in, which scenario the banner should recommend, and — most
 * importantly — that AI translation is never offered on an asset, a DITAVAL file or a deleted
 * source. `TranslationFilesTab` renders whatever this module returns, so a regression here is a
 * regression in the UI.
 */
import { describe, expect, it } from 'vitest';

import type {
  TranslationFileKind,
  TranslationFileStateView,
  TranslationFileStatus,
  TranslationItemView,
  TranslationJobView,
} from '../src/services/translation-api.js';
import {
  classifyWorkspaceScope,
  computeScopeCounts,
  computeStageCounts,
  deriveRecommendedScenario,
  firstActiveItemId,
  getBatchCapabilities,
  getRowCapabilities,
  isForeignDraft,
  isSvgAssetPath,
  stageOfFile,
  type FileStage,
  type RowActionId,
  type ScenarioId,
  type WorkspaceScope,
} from '../src/translation/translation-workflow.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const ALL_KINDS: readonly TranslationFileKind[] = ['topic', 'map', 'keydef_map', 'ditaval', 'asset'];

const ALL_STATUSES: readonly TranslationFileStatus[] = [
  'untranslated',
  'outdated',
  'outdated_metadata_only',
  'source_renamed',
  'source_deleted',
  'in_queue',
  'in_review',
  'draft_ready',
  'synced',
];

const EXPECTED_SCOPE: Record<TranslationFileKind, WorkspaceScope> = {
  topic: 'docs',
  map: 'docs',
  keydef_map: 'docs',
  ditaval: 'structure',
  asset: 'assets',
};

const EXPECTED_STAGE: Record<TranslationFileStatus, FileStage> = {
  untranslated: 'todo',
  outdated: 'todo',
  outdated_metadata_only: 'todo',
  source_renamed: 'todo',
  source_deleted: 'todo',
  in_queue: 'translating',
  in_review: 'review',
  draft_ready: 'checkin',
  synced: 'synced',
};

const DOC_STATUSES: readonly TranslationFileStatus[] = [
  'untranslated',
  'outdated',
  'source_deleted',
  'outdated_metadata_only',
  'source_renamed',
];

const ASSET_STATUSES: readonly TranslationFileStatus[] = [
  'untranslated',
  'outdated',
  'source_deleted',
  'outdated_metadata_only',
];

const ITEM: TranslationItemView = {
  id: 'item-1',
  jobId: 'job-1',
  linkId: 'link-1',
  sourcePath: 'topics/gateway.dita',
  targetPath: 'topics/gateway-zh.dita',
  status: 'ready_for_review',
  modeUsed: 'incremental',
  sourceCommit: 'abc1234',
  prevSourceCommit: 'abc0000',
  reviewerId: null,
  reusedSegments: 4,
  translatedSegments: 2,
  retryCount: 0,
  error: null,
  qaErrorCount: 0,
  qaWarningCount: 0,
  updatedAt: '2026-01-03T00:00:00.000Z',
};

function pathForKind(kind: TranslationFileKind, status: TranslationFileStatus): string {
  switch (kind) {
    case 'asset':
      return status === 'untranslated' ? 'images/diagram.svg' : 'images/screenshot.png';
    case 'ditaval':
      return 'ditaval/flags.ditaval';
    case 'map':
      return 'maps/root.ditamap';
    case 'keydef_map':
      return 'maps/keys.ditamap';
    case 'topic':
      return `topics/${status}.dita`;
  }
}

function makeFile(
  kind: TranslationFileKind,
  status: TranslationFileStatus,
  overrides: Partial<TranslationFileStateView> = {},
): TranslationFileStateView {
  const sourcePath = pathForKind(kind, status);
  return {
    id: `${kind}-${status}`,
    linkId: 'link-1',
    sourcePath,
    targetPath: sourcePath,
    fileKind: kind,
    status,
    lastSourceCommit: 'abc1234',
    lastSourceBlobHash: 'b1',
    lastSourceTranslatableHash: 'h1',
    lastTargetCommit: null,
    lastTargetBlobHash: null,
    renamedFromPath: status === 'source_renamed' ? `${sourcePath}.old` : null,
    localizedAssetOverride: false,
    needsHumanReview: false,
    updatedAt: '2026-01-03T00:00:00.000Z',
    activeItem: null,
    ...overrides,
  };
}

/** A `draft_ready` row whose Phase 13 draft belongs to another writer. */
function foreignDraft(
  kind: TranslationFileKind = 'topic',
  owner = { userId: 'u-admin', userName: 'Admin', isMine: false },
): TranslationFileStateView {
  const file = makeFile(kind, 'draft_ready', { activeItem: ITEM, draftOwner: owner });
  return { ...file, id: `${file.id}-foreign` };
}

function makeJob(overrides: Partial<TranslationJobView> = {}): TranslationJobView {
  return {
    id: 'job-1',
    linkId: 'link-1',
    userId: 'u-1',
    mode: 'incremental',
    status: 'running',
    sourceCommit: 'abc1234',
    totalItems: 4,
    completedItems: 1,
    failedItems: 0,
    cancelRequested: false,
    createdAt: '2026-01-03T00:00:00.000Z',
    startedAt: '2026-01-03T00:00:01.000Z',
    finishedAt: null,
    ...overrides,
  };
}

/** Every action a file may ever expose — used to assert the AI-translation ban. */
function allActions(file: TranslationFileStateView): RowActionId[] {
  const capabilities = getRowCapabilities(file);
  return [...capabilities.primary, ...capabilities.secondary, ...capabilities.danger];
}

/* -------------------------------------------------------------------------- */
/* 1. Scope + stage classification                                            */
/* -------------------------------------------------------------------------- */

describe('workspace scope classification', () => {
  it('maps document kinds to docs while structural statuses win over the kind', () => {
    for (const kind of ['topic', 'map', 'keydef_map'] as const) {
      expect(classifyWorkspaceScope(makeFile(kind, 'untranslated'))).toBe('docs');
      expect(classifyWorkspaceScope(makeFile(kind, 'outdated'))).toBe('docs');
      expect(classifyWorkspaceScope(makeFile(kind, 'in_queue'))).toBe('docs');
      expect(classifyWorkspaceScope(makeFile(kind, 'in_review'))).toBe('docs');
      expect(classifyWorkspaceScope(makeFile(kind, 'draft_ready'))).toBe('docs');
      expect(classifyWorkspaceScope(makeFile(kind, 'synced'))).toBe('docs');
    }

    // A structural change on a topic is a sync problem, not a translation problem.
    for (const status of ['outdated_metadata_only', 'source_deleted', 'source_renamed'] as const) {
      expect(classifyWorkspaceScope(makeFile('topic', status))).toBe('structure');
      expect(classifyWorkspaceScope(makeFile('map', status))).toBe('structure');
    }

    // DITAVAL is configuration, whatever its status.
    expect(classifyWorkspaceScope(makeFile('ditaval', 'untranslated'))).toBe('structure');
    expect(classifyWorkspaceScope(makeFile('ditaval', 'draft_ready'))).toBe('structure');
  });

  it('treats every asset status as an asset, including structural ones', () => {
    for (const status of ASSET_STATUSES) {
      // `outdated_metadata_only` / `source_deleted` / `source_renamed` are structure-flavoured for
      // docs, but an image stays an image: the row lives in the assets tab.
      const expected = isStructureStatus(status) ? 'structure' : 'assets';
      expect(classifyWorkspaceScope(makeFile('asset', status))).toBe(expected);
    }
  });

  it('folds the nine sync statuses into the five pipeline stages', () => {
    for (const status of ALL_STATUSES) {
      expect(stageOfFile(makeFile('topic', status))).toBe(EXPECTED_STAGE[status]);
    }
  });

  it('counts every kind × status combination exactly once', () => {
    const files: TranslationFileStateView[] = [];
    for (const kind of ALL_KINDS) {
      for (const status of ALL_STATUSES) files.push(makeFile(kind, status));
    }
    expect(files).toHaveLength(45);

    const scopes = computeScopeCounts(files);
    expect(scopes.total).toBe(45);
    expect(scopes.docs + scopes.assets + scopes.structure).toBe(45);
    // 3 doc kinds × 6 plain statuses = 18 docs; the 3 structural statuses move 9 doc rows to
    // structure, all 9 DITAVAL rows land there too, and 3 of the 9 asset rows are structural.
    expect(scopes.docs).toBe(18);
    expect(scopes.assets).toBe(6);
    expect(scopes.structure).toBe(21);

    for (const file of files) {
      expect(classifyWorkspaceScope(file)).toBe(
        isStructureStatus(file.status) || file.fileKind === 'ditaval'
          ? 'structure'
          : EXPECTED_SCOPE[file.fileKind],
      );
    }
  });

  it('keeps the pipeline buckets consistent with the scope total', () => {
    const files = [
      makeFile('topic', 'untranslated'),
      makeFile('topic', 'outdated'),
      makeFile('topic', 'in_queue'),
      makeFile('topic', 'in_review'),
      makeFile('topic', 'draft_ready'),
      makeFile('topic', 'synced'),
    ];
    const counts = computeStageCounts(files);
    expect(counts).toEqual({
      all: 6,
      todo: 2,
      translating: 1,
      review: 1,
      checkin: 1,
      synced: 1,
    });

    const docs = computeStageCounts(files, 'docs');
    expect(docs).toEqual(counts);
    expect(computeStageCounts(files, 'assets').all).toBe(0);
    expect(computeStageCounts(files, 'structure').all).toBe(0);

    // Structural rows are excluded from the document pipeline.
    const mixed = computeStageCounts(
      [...files, makeFile('ditaval', 'untranslated'), makeFile('asset', 'outdated')],
      'docs',
    );
    expect(mixed.all).toBe(6);
    expect(computeStageCounts([...files, makeFile('ditaval', 'untranslated')], 'structure')).toEqual({
      all: 1,
      todo: 1,
      translating: 0,
      review: 0,
      checkin: 0,
      synced: 0,
    });
  });

  it('recognises SVG paths case-insensitively', () => {
    expect(isSvgAssetPath('images/flow.svg')).toBe(true);
    expect(isSvgAssetPath('images/FLOW.SVG')).toBe(true);
    expect(isSvgAssetPath(' images/flow.svg ')).toBe(true);
    expect(isSvgAssetPath('images/flow.png')).toBe(false);
    expect(isSvgAssetPath('images/svg')).toBe(false);
  });
});

function isStructureStatus(status: TranslationFileStatus): boolean {
  return (
    status === 'outdated_metadata_only' || status === 'source_deleted' || status === 'source_renamed'
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Scenario resolver                                                        */
/* -------------------------------------------------------------------------- */

describe('recommended scenario', () => {
  function scenarioOf(
    files: TranslationFileStateView[],
    job: TranslationJobView | null = null,
  ): ScenarioId {
    return deriveRecommendedScenario(files, job).id;
  }

  it('returns the empty scenario for a link without tracked files', () => {
    const scenario = deriveRecommendedScenario([]);
    expect(scenario).toEqual({ id: 'empty', scope: null, count: 0, job: null, itemId: null });
  });

  it('1. prefers the live job over everything else', () => {
    const job = makeJob({ status: 'running', totalItems: 6, completedItems: 2 });
    const files = [makeFile('topic', 'draft_ready'), makeFile('topic', 'in_review')];
    const scenario = deriveRecommendedScenario(files, job);
    expect(scenario.id).toBe('running_job');
    expect(scenario.job).toBe(job);
    expect(scenario.count).toBe(4);
  });

  it('1b. treats a queued job as live but ignores a finished one', () => {
    const files = [makeFile('topic', 'draft_ready')];
    expect(scenarioOf(files, makeJob({ status: 'queued' }))).toBe('running_job');
    expect(scenarioOf(files, makeJob({ status: 'completed' }))).toBe('draft_ready');
    expect(scenarioOf(files, makeJob({ status: 'failed' }))).toBe('draft_ready');
    expect(scenarioOf(files, makeJob({ status: 'cancelled' }))).toBe('draft_ready');
  });

  it('2. surfaces drafts waiting for check-in', () => {
    const files = [makeFile('topic', 'draft_ready'), makeFile('topic', 'draft_ready')];
    const scenario = deriveRecommendedScenario(files);
    expect(scenario).toMatchObject({ id: 'draft_ready', scope: 'docs', count: 2, job: null });
  });

  it('2b. explains drafts owned by someone else instead of offering a doomed check-in', () => {
    const foreign = deriveRecommendedScenario([foreignDraft(), foreignDraft('topic', {
      userId: 'u-writer-chen',
      userName: 'Chen',
      isMine: false,
    })]);
    expect(foreign).toMatchObject({
      id: 'draft_ready',
      scope: 'docs',
      count: 2,
      foreignOnly: true,
      foreignDraftOwners: ['Admin', 'Chen'],
    });

    // Own drafts win the count; the foreign ones are only reported alongside.
    const mixed = deriveRecommendedScenario([
      makeFile('topic', 'draft_ready'),
      foreignDraft(),
    ]);
    expect(mixed).toMatchObject({
      id: 'draft_ready',
      count: 1,
      foreignOnly: false,
      foreignDraftOwners: ['Admin'],
    });
  });

  it('3. surfaces files waiting for review with a deep-link item', () => {
    const files = [
      makeFile('topic', 'in_review', { activeItem: { ...ITEM, status: 'in_review' } }),
      makeFile('topic', 'in_review', { activeItem: ITEM }),
    ];
    const scenario = deriveRecommendedScenario(files);
    expect(scenario.id).toBe('in_review');
    expect(scenario.count).toBe(2);
    expect(scenario.itemId).toBe('item-1');
  });

  it('4. recommends the first translation when nothing was ever synced', () => {
    const files = [makeFile('topic', 'untranslated'), makeFile('topic', 'untranslated')];
    const scenario = deriveRecommendedScenario(files);
    expect(scenario).toMatchObject({ id: 'first_translation', scope: 'docs', count: 2 });
  });

  it('5. recommends an incremental update once a baseline exists', () => {
    const files = [makeFile('topic', 'synced'), makeFile('topic', 'outdated')];
    const scenario = deriveRecommendedScenario(files);
    expect(scenario).toMatchObject({ id: 'source_updated', scope: 'docs', count: 1 });
  });

  it('6. falls back to assets or structure once documents are done', () => {
    const assetsOnly = deriveRecommendedScenario([
      makeFile('topic', 'synced'),
      makeFile('asset', 'outdated'),
    ]);
    expect(assetsOnly).toMatchObject({ id: 'assets_or_structure', scope: 'assets', count: 1 });

    const structureOnly = deriveRecommendedScenario([
      makeFile('topic', 'synced'),
      makeFile('ditaval', 'untranslated'),
    ]);
    expect(structureOnly).toMatchObject({ id: 'assets_or_structure', scope: 'structure', count: 1 });

    const both = deriveRecommendedScenario([
      makeFile('topic', 'synced'),
      makeFile('asset', 'untranslated'),
      makeFile('ditaval', 'outdated'),
    ]);
    // Assets win the tie: a bitmap is one click, a config sync usually needs a human look.
    expect(both).toMatchObject({ id: 'assets_or_structure', scope: 'assets', count: 2 });
  });

  it('7. reports the all-synced state only when every tracked file is done', () => {
    const scenario = deriveRecommendedScenario([
      makeFile('topic', 'synced'),
      makeFile('asset', 'synced'),
      makeFile('ditaval', 'synced'),
    ]);
    expect(scenario).toMatchObject({ id: 'all_synced', scope: null, count: 3 });

    // A single metadata-only row keeps the workflow busy.
    expect(scenarioOf([makeFile('topic', 'synced'), makeFile('topic', 'outdated_metadata_only')])).toBe(
      'assets_or_structure',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Row capabilities                                                        */
/* -------------------------------------------------------------------------- */

describe('row capabilities', () => {
  it('offers AI translation only for pending documents', () => {
    for (const kind of ['topic', 'map', 'keydef_map'] as const) {
      for (const status of ['untranslated', 'outdated'] as const) {
        const capabilities = getRowCapabilities(makeFile(kind, status));
        expect(capabilities.primary).toContain('ai_translate');
      }
    }
  });

  it('lints the legal actions of every doc status', () => {
    expect(getRowCapabilities(makeFile('topic', 'in_queue')).primary).toEqual(['open_queue']);
    expect(getRowCapabilities(makeFile('topic', 'in_review')).primary).toEqual(['open_review']);
    expect(getRowCapabilities(makeFile('topic', 'in_review')).secondary).toEqual(['apply_draft']);
    expect(getRowCapabilities(makeFile('topic', 'draft_ready')).primary).toEqual(['checkin']);
    expect(getRowCapabilities(makeFile('topic', 'draft_ready')).secondary).toEqual(['open_review']);
    expect(getRowCapabilities(makeFile('topic', 'synced')).primary).toEqual([]);
    expect(getRowCapabilities(makeFile('topic', 'synced')).secondary).toEqual(['retranslate']);
  });

  it('keeps check-in away from a draft another user owns', () => {
    const foreign = foreignDraft();
    expect(isForeignDraft(foreign)).toBe(true);
    const capabilities = getRowCapabilities(foreign);
    expect(capabilities.primary).not.toContain('checkin');
    expect(capabilities.secondary).toContain('open_review');

    // Assets swap the primary for the target editor but still lose check-in.
    const foreignAsset = foreignDraft('asset');
    const assetCapabilities = getRowCapabilities(foreignAsset);
    expect(assetCapabilities.primary).not.toContain('checkin');
    expect(assetCapabilities.secondary).toContain('open_target_editor');

    // A draft without owner metadata (older API payloads, fixtures) stays checkin-able.
    const legacy = makeFile('topic', 'draft_ready', { activeItem: ITEM });
    expect(isForeignDraft(legacy)).toBe(false);
    expect(getRowCapabilities(legacy).primary).toEqual(['checkin']);
    // A foreign *in_review* row is not a draft yet, so it keeps its review actions.
    expect(isForeignDraft({ ...legacy, status: 'in_review', draftOwner: {
      userId: 'u-admin',
      userName: 'Admin',
      isMine: false,
    } })).toBe(false);
  });

  it('never exposes AI translation for assets, DITAVAL or deleted sources', () => {
    for (const kind of ALL_KINDS) {
      for (const status of ALL_STATUSES) {
        const file = makeFile(kind, status);
        const actions = allActions(file);
        const aiAllowed =
          (kind === 'topic' || kind === 'map' || kind === 'keydef_map') &&
          (status === 'untranslated' || status === 'outdated' || status === 'source_renamed');
        if (aiAllowed) {
          expect(actions).toContain('ai_translate');
        } else {
          expect(actions).not.toContain('ai_translate');
        }
      }
    }
    // Explicit spot checks so a future refactor cannot silently re-open the hole.
    for (const kind of ['asset', 'ditaval'] as const) {
      for (const status of DOC_STATUSES) {
        expect(allActions(makeFile(kind, status))).not.toContain('ai_translate');
      }
    }
    expect(allActions(makeFile('topic', 'source_deleted'))).not.toContain('ai_translate');
    expect(allActions(makeFile('map', 'source_deleted'))).not.toContain('ai_translate');
    expect(allActions(makeFile('asset', 'source_deleted'))).not.toContain('ai_translate');
  });

  it('gives an SVG asset the two-path reuse/override choice and the SVG hint', () => {
    const svg = makeFile('asset', 'outdated', { sourcePath: 'images/flow.svg' });
    expect(isSvgAssetPath(svg.sourcePath)).toBe(true);
    expect(getRowCapabilities(svg)).toEqual({
      primary: ['sync_asset'],
      secondary: ['open_target_editor'],
      danger: [],
      hint: 'svg',
    });

    const localized = makeFile('asset', 'outdated', { localizedAssetOverride: true });
    expect(getRowCapabilities(localized)).toEqual({
      primary: ['keep_local_version'],
      secondary: ['override_with_source', 'open_target_editor'],
      danger: [],
      hint: 'asset_override',
    });
  });

  it('gives bitmaps the same reuse-only path', () => {
    const png = makeFile('asset', 'untranslated', { sourcePath: 'images/flow.png' });
    expect(getRowCapabilities(png)).toEqual({
      primary: ['sync_asset'],
      secondary: ['open_target_editor'],
      danger: [],
      hint: null,
    });
  });

  it('routes a pending DITAVAL file to a verbatim config sync', () => {
    const ditaval = makeFile('ditaval', 'untranslated');
    expect(getRowCapabilities(ditaval)).toEqual({
      primary: ['sync_passthrough'],
      secondary: ['mark_synced'],
      danger: [],
      hint: null,
    });
    expect(getRowCapabilities(makeFile('ditaval', 'draft_ready')).primary).toEqual(['checkin']);
    expect(getRowCapabilities(makeFile('ditaval', 'source_deleted')).danger).toEqual([
      'stage_delete',
    ]);
  });

  it('asks a human to confirm metadata-only and renamed sources', () => {
    expect(getRowCapabilities(makeFile('topic', 'outdated_metadata_only'))).toEqual({
      primary: ['mark_synced'],
      secondary: [],
      danger: [],
      hint: 'metadata_only',
    });
    expect(getRowCapabilities(makeFile('topic', 'source_renamed'))).toEqual({
      primary: ['ai_translate'],
      secondary: ['mark_synced'],
      danger: [],
      hint: 'renamed',
    });
  });

  it('flags a deleted source with a destructive and a safe action', () => {
    const deleted = getRowCapabilities(makeFile('topic', 'source_deleted'));
    expect(deleted.primary).toEqual(['keep_target']);
    expect(deleted.danger).toEqual(['stage_delete']);
    expect(deleted.hint).toBe('deleted');
  });

  it('explains manual-review kinds without hiding their actions', () => {
    expect(getRowCapabilities(makeFile('keydef_map', 'untranslated')).hint).toBe('keydef_map');
    expect(getRowCapabilities(makeFile('map', 'outdated')).hint).toBe('map');
    expect(getRowCapabilities(makeFile('topic', 'outdated')).hint).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Batch capabilities                                                      */
/* -------------------------------------------------------------------------- */

describe('batch capabilities', () => {
  it('returns empty lists for an empty selection', () => {
    const batch = getBatchCapabilities([]);
    for (const paths of Object.values(batch)) expect(paths).toEqual([]);
  });

  it('splits a mixed selection into exact legal subsets', () => {
    const pendingDoc = makeFile('topic', 'untranslated', { sourcePath: 'topics/a.dita' });
    const outdatedDoc = makeFile('topic', 'outdated', { sourcePath: 'topics/b.dita' });
    const reviewDoc = makeFile('topic', 'in_review', {
      sourcePath: 'topics/c.dita',
      activeItem: { ...ITEM, status: 'in_review' },
    });
    const draft = makeFile('topic', 'draft_ready', {
      sourcePath: 'topics/d.dita',
      activeItem: ITEM,
    });
    const syncedDoc = makeFile('topic', 'synced', { sourcePath: 'topics/e.dita' });
    const plainAsset = makeFile('asset', 'outdated', {
      sourcePath: 'images/plain.png',
      localizedAssetOverride: false,
    });
    const svgAsset = makeFile('asset', 'untranslated', {
      sourcePath: 'images/flow.svg',
      localizedAssetOverride: false,
    });
    const overrideAsset = makeFile('asset', 'outdated', {
      sourcePath: 'images/kept.png',
      localizedAssetOverride: true,
    });
    const ditaval = makeFile('ditaval', 'untranslated', { sourcePath: 'ditaval/flags.ditaval' });
    const metadataOnly = makeFile('topic', 'outdated_metadata_only', {
      sourcePath: 'maps/meta.ditamap',
    });
    const renamed = makeFile('topic', 'source_renamed', { sourcePath: 'topics/moved.dita' });
    const deleted = makeFile('topic', 'source_deleted', { sourcePath: 'topics/gone.dita' });

    const batch = getBatchCapabilities([
      pendingDoc,
      outdatedDoc,
      reviewDoc,
      draft,
      syncedDoc,
      plainAsset,
      svgAsset,
      overrideAsset,
      ditaval,
      metadataOnly,
      renamed,
      deleted,
    ]);

    expect(batch.translatablePaths).toEqual(['topics/a.dita', 'topics/b.dita']);
    expect(batch.reviewablePaths).toEqual(['topics/c.dita', 'topics/d.dita']);
    // Apply is narrower than review: a `draft_ready` row already owns its target draft.
    expect(batch.applicablePaths).toEqual(['topics/c.dita']);
    expect(batch.draftReadyPaths).toEqual(['topics/d.dita']);
    expect(batch.foreignDraftReadyPaths).toEqual([]);
    expect(batch.foreignDraftOwners).toEqual([]);
    expect(batch.syncableAssetPaths).toEqual(['images/plain.png', 'images/flow.svg']);
    expect(batch.overrideAssetPaths).toEqual(['images/kept.png']);
    expect(batch.keepLocalPaths).toEqual(['images/kept.png']);
    expect(batch.syncableDitavalPaths).toEqual(['ditaval/flags.ditaval']);
    expect(batch.metadataOnlyPaths).toEqual(['maps/meta.ditamap']);
    expect(batch.deletedPaths).toEqual(['topics/gone.dita']);
    expect(batch.renamedPaths).toEqual(['topics/moved.dita']);
  });

  it('keeps draft-ready files reviewable but never applicable', () => {
    const draft = makeFile('topic', 'draft_ready', { activeItem: ITEM });
    const inReview = makeFile('topic', 'in_review', { activeItem: { ...ITEM, status: 'in_review' } });
    const batch = getBatchCapabilities([draft, inReview]);
    expect(batch.reviewablePaths).toEqual([draft.sourcePath, inReview.sourcePath]);
    expect(batch.applicablePaths).toEqual([inReview.sourcePath]);
    expect(batch.applicablePaths).not.toContain(draft.sourcePath);

    // `in_review` without an active item cannot be applied either (nothing to apply).
    const orphanReview = makeFile('topic', 'in_review', { activeItem: null });
    expect(getBatchCapabilities([orphanReview]).applicablePaths).toEqual([]);
  });

  it('splits foreign drafts out of the checkin-able selection', () => {
    const own = makeFile('topic', 'draft_ready', { sourcePath: 'topics/own.dita' });
    const batch = getBatchCapabilities([own, foreignDraft()]);
    const foreignPath = foreignDraft().sourcePath;

    expect(batch.draftReadyPaths).toEqual(['topics/own.dita']);
    expect(batch.foreignDraftReadyPaths).toEqual([foreignPath]);
    expect(batch.foreignDraftOwners).toEqual(['Admin']);
    // A foreign draft is still readable/reviewable, just not checkin-able.
    expect(batch.reviewablePaths).toContain(foreignPath);

    const onlyForeign = getBatchCapabilities([foreignDraft()]);
    expect(onlyForeign.draftReadyPaths).toEqual([]);
    expect(onlyForeign.foreignDraftReadyPaths).toEqual([foreignPath]);
  });

  it('never counts an asset or DITAVAL file as translatable', () => {
    const batch = getBatchCapabilities([
      makeFile('asset', 'untranslated'),
      makeFile('asset', 'outdated'),
      makeFile('ditaval', 'untranslated'),
      makeFile('ditaval', 'outdated'),
    ]);
    expect(batch.translatablePaths).toEqual([]);
    expect(batch.syncableAssetPaths).toHaveLength(2);
    expect(batch.syncableDitavalPaths).toHaveLength(2);
  });

  it('deep-links the first active item inside the selected paths', () => {
    const first = makeFile('topic', 'in_review', {
      sourcePath: 'topics/a.dita',
      activeItem: { ...ITEM, id: 'item-a', status: 'in_review' },
    });
    const second = makeFile('topic', 'draft_ready', {
      sourcePath: 'topics/b.dita',
      activeItem: { ...ITEM, id: 'item-b' },
    });
    const files = [first, second];
    expect(firstActiveItemId(files, ['topics/a.dita', 'topics/b.dita'])).toBe('item-a');
    expect(firstActiveItemId(files, ['topics/b.dita'])).toBe('item-b');
    expect(firstActiveItemId(files, ['topics/missing.dita'])).toBeNull();
  });
});
