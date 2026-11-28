/**
 * Phase 16 — pure workflow projection for the translation center.
 *
 * The translation center used to be a state table: eleven status filters and every action on every
 * row, so a user had to *know* the pipeline to find the next step. This module turns the same file
 * matrix into a small workflow model that the Files tab renders directly:
 *
 * - `classifyWorkspaceScope` splits tracked files into the three things a translator actually
 *   thinks about: document content, binary assets, and configuration/structure changes.
 * - `stageOfFile` folds the nine sync statuses into the five pipeline stages, so the pipeline bar
 *   and the batch toolbar speak one language.
 * - `deriveRecommendedScenario` answers "what should I do next?" deterministically.
 * - `getRowCapabilities` / `getBatchCapabilities` are the only place that decides which action is
 *   *legal* for a file, which is what keeps AI translation away from assets, DITAVAL files and
 *   deleted sources.
 *
 * Everything here is a pure function of the file states: no store, no fetch, no React. That keeps
 * the legality matrix unit-testable (see `apps/web/test/translation-workflow.test.ts`) instead of
 * leaving it buried in JSX branches.
 */
import type {
  TranslationFileKind,
  TranslationFileStateView,
  TranslationFileStatus,
  TranslationJobView,
} from '../services/translation-api.js';

/** The three workspace tabs of the Files panel. */
export type WorkspaceScope = 'docs' | 'assets' | 'structure';

/** The five pipeline stages plus the "show everything" pseudo stage. */
export type PipelineStage = 'all' | 'todo' | 'translating' | 'review' | 'checkin' | 'synced';

/** A concrete stage (the pipeline bar's `all` tab is not a stage of a file). */
export type FileStage = Exclude<PipelineStage, 'all'>;

/** Scope filter used by the workspace tabs (`all` only exists for counting). */
export type WorkspaceScopeFilter = WorkspaceScope | 'all';

/**
 * `true` when a `draft_ready` row holds a draft that belongs to *another* user.
 *
 * Phase 13 boundary: only the draft owner can check a draft in, so the UI must not offer a
 * check-in button that is guaranteed to fail. A row without `draftOwner` (older API responses,
 * fixtures in tests) is treated as own — that keeps every pre-existing selection checkin-able.
 */
export function isForeignDraft(file: TranslationFileStateView): boolean {
  return file.status === 'draft_ready' && Boolean(file.draftOwner && !file.draftOwner.isMine);
}

/** Unique, non-empty owner display names of a set of foreign drafts, in first-seen order. */
function foreignOwnerNames(files: readonly TranslationFileStateView[]): string[] {
  const owners: string[] = [];
  for (const file of files) {
    const name = file.draftOwner?.userName;
    if (name && !owners.includes(name)) owners.push(name);
  }
  return owners;
}

export interface ScopeCounts {
  docs: number;
  assets: number;
  structure: number;
  total: number;
}

export interface StageCounts {
  all: number;
  todo: number;
  translating: number;
  review: number;
  checkin: number;
  synced: number;
}

/** `true` for `.svg` paths — SVG is the one asset kind whose *text* needs localization. */
export function isSvgAssetPath(filePath: string): boolean {
  return /\.svg$/i.test(filePath.trim());
}

/**
 * Which workspace tab owns this file.
 *
 * Structure wins over the file kind because a renamed/deleted/metadata-only row is a *sync*
 * problem, not a translation problem: the row must explain the structural change even when the
 * file itself is a topic.
 */
export function classifyWorkspaceScope(file: TranslationFileStateView): WorkspaceScope {
  if (
    file.fileKind === 'ditaval' ||
    file.status === 'outdated_metadata_only' ||
    file.status === 'source_deleted' ||
    file.status === 'source_renamed'
  ) {
    return 'structure';
  }
  if (file.fileKind === 'asset') return 'assets';
  return 'docs';
}

const STAGE_OF_STATUS: Record<TranslationFileStatus, FileStage> = {
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

export function stageOfFile(file: TranslationFileStateView): FileStage {
  return STAGE_OF_STATUS[file.status] ?? 'todo';
}

export function computeScopeCounts(files: readonly TranslationFileStateView[]): ScopeCounts {
  const counts: ScopeCounts = { docs: 0, assets: 0, structure: 0, total: files.length };
  for (const file of files) counts[classifyWorkspaceScope(file)] += 1;
  return counts;
}

/**
 * Stage counters for one scope (`all` counts every file). The `all` bucket is always the sum of the
 * five real stages, so the pipeline bar can never show a total that disagrees with its segments.
 */
export function computeStageCounts(
  files: readonly TranslationFileStateView[],
  scope: WorkspaceScopeFilter = 'all',
): StageCounts {
  const counts: StageCounts = {
    all: 0,
    todo: 0,
    translating: 0,
    review: 0,
    checkin: 0,
    synced: 0,
  };
  for (const file of files) {
    if (scope !== 'all' && classifyWorkspaceScope(file) !== scope) continue;
    counts.all += 1;
    counts[stageOfFile(file)] += 1;
  }
  return counts;
}

/* -------------------------------------------------------------------------- */
/* Scenario resolver                                                           */
/* -------------------------------------------------------------------------- */

export type ScenarioId =
  | 'empty'
  | 'running_job'
  | 'draft_ready'
  | 'in_review'
  | 'first_translation'
  | 'source_updated'
  | 'assets_or_structure'
  | 'all_synced';

export interface RecommendedScenario {
  id: ScenarioId;
  /** Scope tab the CTA belongs to; `null` when the action is not scope specific. */
  scope: WorkspaceScope | null;
  /** How many files the primary CTA will act on. */
  count: number;
  /** Live job driving the progress card (`running_job` only). */
  job: TranslationJobView | null;
  /** Item to open first when the CTA starts a bilingual review. */
  itemId: string | null;
  /**
   * Display names of users who own the `draft_ready` drafts of this link (`draft_ready` only).
   * When every draft belongs to someone else the banner must explain that instead of offering a
   * check-in that Phase 13 would reject.
   */
  foreignDraftOwners?: string[];
  /** `true` when the link only has `draft_ready` drafts owned by other users. */
  foreignOnly?: boolean;
}

function isLiveJob(job: TranslationJobView | null): job is TranslationJobView {
  return Boolean(job && (job.status === 'queued' || job.status === 'running'));
}

function firstReviewItemId(files: readonly TranslationFileStateView[]): string | null {
  for (const file of files) {
    if (file.status === 'in_review' && file.activeItem) return file.activeItem.id;
  }
  for (const file of files) {
    if (file.activeItem?.status === 'ready_for_review') return file.activeItem.id;
  }
  return null;
}

/**
 * The single "next step" the banner offers. The order is fixed so two users looking at the same
 * matrix always see the same recommendation:
 *
 * 1. an in-flight job (never start a second one underneath it),
 * 2. drafts waiting to be checked in,
 * 3. files waiting for review,
 * 4. the very first translation of a pair,
 * 5. incremental updates once a baseline exists,
 * 6. leftover assets / structure changes,
 * 7. everything synced.
 */
export function deriveRecommendedScenario(
  files: readonly TranslationFileStateView[],
  activeJob: TranslationJobView | null = null,
): RecommendedScenario {
  const stages = computeStageCounts(files);
  const ownDraftReady = files.filter(
    (file) => file.status === 'draft_ready' && !isForeignDraft(file),
  );
  const foreignDraftReady = files.filter(isForeignDraft);
  if (files.length === 0) {
    return { id: 'empty', scope: null, count: 0, job: null, itemId: null };
  }
  if (isLiveJob(activeJob)) {
    return {
      id: 'running_job',
      scope: null,
      count: Math.max(activeJob.totalItems - activeJob.completedItems, stages.translating),
      job: activeJob,
      itemId: null,
    };
  }
  if (stages.translating > 0) {
    return { id: 'running_job', scope: null, count: stages.translating, job: null, itemId: null };
  }
  if (ownDraftReady.length > 0) {
    const foreignOwners = foreignOwnerNames(foreignDraftReady);
    return {
      id: 'draft_ready',
      scope: 'docs',
      // Only own drafts: a foreign draft cannot be committed by this user.
      count: ownDraftReady.length,
      job: null,
      itemId: null,
      ...(foreignDraftReady.length > 0
        ? { foreignDraftOwners: foreignOwners, foreignOnly: false }
        : {}),
    };
  }
  if (foreignDraftReady.length > 0) {
    return {
      id: 'draft_ready',
      scope: 'docs',
      count: foreignDraftReady.length,
      job: null,
      itemId: null,
      foreignDraftOwners: foreignOwnerNames(foreignDraftReady),
      foreignOnly: true,
    };
  }
  if (stages.review > 0) {
    return {
      id: 'in_review',
      scope: 'docs',
      count: stages.review,
      job: null,
      itemId: firstReviewItemId(files),
    };
  }
  const docs = computeStageCounts(files, 'docs');
  if (docs.todo > 0) {
    return {
      id: stages.synced === 0 ? 'first_translation' : 'source_updated',
      scope: 'docs',
      count: docs.todo,
      job: null,
      itemId: null,
    };
  }
  const assets = computeStageCounts(files, 'assets');
  const structure = computeStageCounts(files, 'structure');
  if (assets.todo > 0 || structure.todo > 0) {
    return {
      id: 'assets_or_structure',
      scope: assets.todo > 0 ? 'assets' : 'structure',
      count: assets.todo + structure.todo,
      job: null,
      itemId: null,
    };
  }
  return { id: 'all_synced', scope: null, count: files.length, job: null, itemId: null };
}

/* -------------------------------------------------------------------------- */
/* Row capabilities                                                            */
/* -------------------------------------------------------------------------- */

export type RowActionId =
  | 'ai_translate'
  | 'retranslate'
  | 'open_queue'
  | 'open_review'
  | 'apply_draft'
  | 'checkin'
  | 'mark_synced'
  | 'sync_asset'
  | 'keep_local_version'
  | 'override_with_source'
  | 'sync_passthrough'
  | 'stage_delete'
  | 'keep_target'
  | 'open_target_editor';

export type RowHintId =
  | 'keydef_map'
  | 'map'
  | 'svg'
  | 'asset_override'
  | 'metadata_only'
  | 'renamed'
  | 'deleted';

export interface RowCapabilities {
  /** Filled or blue-outlined buttons rendered first. */
  primary: RowActionId[];
  /** Quiet text buttons after the primary one. */
  secondary: RowActionId[];
  /** Destructive buttons, rendered last with the rose tone. */
  danger: RowActionId[];
  /** One-line sub-hint under the status badge. */
  hint: RowHintId | null;
}

function docHint(file: TranslationFileStateView): RowHintId | null {
  if (file.fileKind === 'keydef_map') return 'keydef_map';
  if (file.fileKind === 'map') return 'map';
  return null;
}

function emptyCapabilities(hint: RowHintId | null = null): RowCapabilities {
  return { primary: [], secondary: [], danger: [], hint };
}

function docsCapabilities(file: TranslationFileStateView): RowCapabilities {
  const hint = docHint(file);
  switch (file.status) {
    case 'untranslated':
    case 'outdated':
      return { primary: ['ai_translate'], secondary: ['open_target_editor'], danger: [], hint };
    case 'in_queue':
      return { primary: ['open_queue'], secondary: [], danger: [], hint };
    case 'in_review':
      return { primary: ['open_review'], secondary: ['apply_draft'], danger: [], hint };
    case 'draft_ready':
      return { primary: ['checkin'], secondary: ['open_review'], danger: [], hint };
    case 'synced':
      // A synced topic can still be re-translated in full mode; the button stays quiet.
      return { primary: [], secondary: ['retranslate'], danger: [], hint };
    case 'outdated_metadata_only':
    case 'source_renamed':
    case 'source_deleted':
      // Unreachable through `getRowCapabilities` (those statuses live in the structure scope);
      // kept as a non-AI fallback so a future scope change still cannot expose AI translation.
      return { primary: ['mark_synced'], secondary: [], danger: [], hint };
  }
}

function assetCapabilities(file: TranslationFileStateView): RowCapabilities {
  const hint: RowHintId | null = isSvgAssetPath(file.sourcePath) ? 'svg' : null;
  switch (file.status) {
    case 'draft_ready':
      return {
        primary: ['checkin'],
        secondary: ['open_target_editor'],
        danger: [],
        hint,
      };
    case 'synced':
      return { primary: [], secondary: ['open_target_editor'], danger: [], hint };
    case 'in_queue':
      // Assets never enter an AI job; if a stale row says otherwise, only expose the queue.
      return { primary: ['open_queue'], secondary: [], danger: [], hint };
    case 'in_review':
      return { primary: ['open_review'], secondary: [], danger: [], hint };
    case 'outdated_metadata_only':
      return { primary: ['mark_synced'], secondary: [], danger: [], hint: 'metadata_only' };
    case 'source_renamed':
      return { primary: ['sync_asset'], secondary: ['mark_synced'], danger: [], hint: 'renamed' };
    case 'source_deleted':
      return {
        primary: ['keep_target'],
        secondary: [],
        danger: ['stage_delete'],
        hint: 'deleted',
      };
    case 'untranslated':
    case 'outdated':
      if (file.localizedAssetOverride) {
        return {
          primary: ['keep_local_version'],
          secondary: ['override_with_source', 'open_target_editor'],
          danger: [],
          hint: 'asset_override',
        };
      }
      // Reuse the source bitmap/SVG verbatim — never a machine translation.
      return { primary: ['sync_asset'], secondary: ['open_target_editor'], danger: [], hint };
  }
}

function structureCapabilities(file: TranslationFileStateView): RowCapabilities {
  switch (file.status) {
    case 'source_deleted':
      return {
        primary: ['keep_target'],
        secondary: [],
        danger: ['stage_delete'],
        hint: 'deleted',
      };
    case 'source_renamed':
      return {
        primary: [
          file.fileKind === 'asset'
            ? 'sync_asset'
            : file.fileKind === 'ditaval'
              ? 'sync_passthrough'
              : 'ai_translate',
        ],
        secondary: ['mark_synced'],
        danger: [],
        hint: 'renamed',
      };
    case 'outdated_metadata_only':
      return { primary: ['mark_synced'], secondary: [], danger: [], hint: 'metadata_only' };
    case 'draft_ready':
      return { primary: ['checkin'], secondary: ['open_review'], danger: [], hint: null };
    case 'in_queue':
      return { primary: ['open_queue'], secondary: [], danger: [], hint: null };
    case 'in_review':
      return { primary: ['open_review'], secondary: ['apply_draft'], danger: [], hint: null };
    case 'synced':
      return { primary: [], secondary: ['open_target_editor'], danger: [], hint: null };
    case 'untranslated':
    case 'outdated':
      if (file.fileKind === 'ditaval') {
        return { primary: ['sync_passthrough'], secondary: ['mark_synced'], danger: [], hint: null };
      }
      if (file.fileKind === 'asset') {
        return { primary: ['sync_asset'], secondary: ['open_target_editor'], danger: [], hint: null };
      }
      return { primary: ['ai_translate'], secondary: [], danger: [], hint: null };
  }
}

/**
 * The only legal actions for one row. AI translation is impossible on assets, DITAVAL files and
 * deleted sources — that invariant is enforced here instead of being repeated in every JSX branch.
 */
export function getRowCapabilities(file: TranslationFileStateView): RowCapabilities {
  const scope = classifyWorkspaceScope(file);
  const base =
    scope === 'assets'
      ? assetCapabilities(file)
      : scope === 'structure'
        ? structureCapabilities(file)
        : docsCapabilities(file);
  // A draft owned by someone else cannot be checked in by this user, so the button is not offered
  // (the row keeps its editor/review links and renders an owner badge instead).
  const capabilities: RowCapabilities = isForeignDraft(file)
    ? { ...base, primary: base.primary.filter((action) => action !== 'checkin') }
    : base;
  if (file.fileKind !== 'topic' && file.fileKind !== 'map' && file.fileKind !== 'keydef_map') {
    return {
      ...capabilities,
      primary: capabilities.primary.filter((action) => action !== 'ai_translate'),
      secondary: capabilities.secondary.filter((action) => action !== 'ai_translate'),
      danger: capabilities.danger.filter((action) => action !== 'ai_translate'),
    };
  }
  if (file.status === 'source_deleted' || file.status === 'outdated_metadata_only') {
    return {
      ...capabilities,
      primary: capabilities.primary.filter((action) => action !== 'ai_translate'),
      secondary: capabilities.secondary.filter((action) => action !== 'ai_translate'),
    };
  }
  return capabilities;
}

/* -------------------------------------------------------------------------- */
/* Batch capabilities                                                         */
/* -------------------------------------------------------------------------- */

export interface BatchCapabilities {
  /** Document files an AI job may translate. */
  translatablePaths: string[];
  /** Files with an active translation item that can be reviewed (`in_review` + `draft_ready`). */
  reviewablePaths: string[];
  /**
   * Files whose active review item can be *applied* to the target draft overlay.
   *
   * Deliberately narrower than `reviewablePaths`: a `draft_ready` file already has its draft, so
   * "apply to target draft" / "apply & check in" would only re-apply a finished item.
   */
  applicablePaths: string[];
  /** Files whose own draft is finished and waiting for check-in (any kind). */
  draftReadyPaths: string[];
  /** `draft_ready` files whose draft belongs to another user (never checkin-able here). */
  foreignDraftReadyPaths: string[];
  /** Unique display names of the owners of `foreignDraftReadyPaths`. */
  foreignDraftOwners: string[];
  /** Assets that can be copied from the source (no localized override yet). */
  syncableAssetPaths: string[];
  /** Assets whose source changed but a localized override is kept. */
  overrideAssetPaths: string[];
  /** Assets whose localized override should be accepted as-is. */
  keepLocalPaths: string[];
  /** `*.ditaval` files copied verbatim into the draft overlay. */
  syncableDitavalPaths: string[];
  /** Metadata-only changes that need no re-translation. */
  metadataOnlyPaths: string[];
  /** Rows whose source file no longer exists. */
  deletedPaths: string[];
  /** Rows whose source file was renamed upstream. */
  renamedPaths: string[];
}

function isDocKind(kind: TranslationFileKind): boolean {
  return kind === 'topic' || kind === 'map' || kind === 'keydef_map';
}

/**
 * Exact eligible path subsets for the current selection. The batch toolbar renders a button only
 * when its list is non-empty, and always shows that list's length — so a mixed selection can never
 * silently apply AI translation to an image.
 */
export function getBatchCapabilities(
  selectedFiles: readonly TranslationFileStateView[],
): BatchCapabilities {
  const capabilities: BatchCapabilities = {
    translatablePaths: [],
    reviewablePaths: [],
    applicablePaths: [],
    draftReadyPaths: [],
    foreignDraftReadyPaths: [],
    foreignDraftOwners: [],
    syncableAssetPaths: [],
    overrideAssetPaths: [],
    keepLocalPaths: [],
    syncableDitavalPaths: [],
    metadataOnlyPaths: [],
    deletedPaths: [],
    renamedPaths: [],
  };
  for (const file of selectedFiles) {
    const path = file.sourcePath;
    const scope = classifyWorkspaceScope(file);
    if (
      scope === 'docs' &&
      isDocKind(file.fileKind) &&
      (file.status === 'untranslated' || file.status === 'outdated')
    ) {
      capabilities.translatablePaths.push(path);
    }
    if (file.activeItem && (file.status === 'in_review' || file.status === 'draft_ready')) {
      capabilities.reviewablePaths.push(path);
    }
    if (file.status === 'in_review' && file.activeItem) capabilities.applicablePaths.push(path);
    if (file.status === 'draft_ready') {
      if (isForeignDraft(file)) {
        capabilities.foreignDraftReadyPaths.push(path);
        const owner = file.draftOwner?.userName;
        if (owner && !capabilities.foreignDraftOwners.includes(owner)) {
          capabilities.foreignDraftOwners.push(owner);
        }
      } else {
        capabilities.draftReadyPaths.push(path);
      }
    }
    if (file.fileKind === 'asset') {
      if (file.status === 'untranslated' || file.status === 'outdated') {
        if (file.localizedAssetOverride) {
          capabilities.overrideAssetPaths.push(path);
          capabilities.keepLocalPaths.push(path);
        } else {
          capabilities.syncableAssetPaths.push(path);
        }
      }
    }
    if (
      file.fileKind === 'ditaval' &&
      (file.status === 'untranslated' || file.status === 'outdated')
    ) {
      capabilities.syncableDitavalPaths.push(path);
    }
    if (file.status === 'outdated_metadata_only') capabilities.metadataOnlyPaths.push(path);
    if (file.status === 'source_deleted') capabilities.deletedPaths.push(path);
    if (file.status === 'source_renamed') capabilities.renamedPaths.push(path);
  }
  return capabilities;
}

/** First active item inside the given paths — the review CTA's deep link. */
export function firstActiveItemId(
  files: readonly TranslationFileStateView[],
  paths: readonly string[],
): string | null {
  const wanted = new Set(paths);
  for (const file of files) {
    if (wanted.has(file.sourcePath) && file.activeItem) return file.activeItem.id;
  }
  return null;
}
