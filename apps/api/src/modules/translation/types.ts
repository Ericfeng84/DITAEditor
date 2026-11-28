import type {
  GlossaryEntryForMatch,
  TranslationFileStatus,
  TranslationQaIssue,
  TranslationQaIssueCode,
} from '@dita/core';

/**
 * Phase 16 Stage 2 — server-side translation contracts.
 *
 * These types are the wire shape of `/api/translation/*` and `/api/glossaries/*`. They live next
 * to (never inside) `@dita/core`, because they describe SQLite rows and HTTP payloads rather than
 * the isomorphic translation kernel. Binding blueprint: docs/plans/phase16-translation.md §3.2–3.3.
 */

/** BCP 47-ish language tag as accepted by the API: `en`, `zh-CN`, `pt-BR`, `zh-Hant-TW`. */
export const LANGUAGE_TAG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export function isValidLangTag(value: string | null | undefined): boolean {
  return typeof value === 'string' && LANGUAGE_TAG_PATTERN.test(value.trim());
}

/** Trims and canonicalises a language tag (`zh-cn` → `zh-CN`); `null` for an empty value. */
export function normalizeLangTag(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [head, ...rest] = trimmed.split('-');
  if (!head) return null;
  const canonical = rest.map((part) => (part.length === 2 ? part.toUpperCase() : part));
  return [head.toLowerCase(), ...canonical].join('-');
}

/**
 * Two tags match when they are equal or one is a prefix of the other (`zh` ↔ `zh-CN`).
 * Used by the glossary resolver so a `zh` glossary still serves a `zh-CN` translation.
 */
export function langTagsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeLangTag(a);
  const right = normalizeLangTag(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(`${right}-`) || right.startsWith(`${left}-`);
}

/** What one source file contributes to the target manual. */
export type TranslationFileKind = 'topic' | 'map' | 'keydef_map' | 'ditaval' | 'asset';

export type { TranslationFileStatus };

/** Minimal manual projection embedded in a link view (never the whole registry row). */
export interface TranslationManualSummary {
  id: string;
  name: string;
  rootDir: string;
  exists: boolean;
  sourceLang: string | null;
}

/** Aggregated per-file progress for one link. */
export interface TranslationFileCounts {
  total: number;
  synced: number;
  outdated: number;
  untranslated: number;
  inQueue: number;
  inReview: number;
  draftReady: number;
  metadataOnly: number;
  sourceDeleted: number;
  sourceRenamed: number;
  /** `0–100`, rounded: files that need no further translation work (`synced`). */
  progressPercent: number;
}

export interface TranslationLinkView {
  id: string;
  sourceManualId: string;
  sourceBranch: string;
  sourceLang: string;
  targetManualId: string;
  targetBranch: string;
  targetLang: string;
  options: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sourceManual: TranslationManualSummary | null;
  targetManual: TranslationManualSummary | null;
  counts: TranslationFileCounts;
}

export interface CreateTranslationLinkInput {
  sourceManualId: string;
  sourceBranch?: string;
  sourceLang?: string;
  targetLang: string;
  /** Bind an existing manual instead of creating one. */
  targetManualId?: string;
  targetBranch?: string;
  /** Create a new target manual (default when `targetManualId` is omitted). */
  createTargetManual?: boolean;
  targetManualName?: string;
  options?: Record<string, unknown>;
}

export interface UpdateTranslationLinkInput {
  sourceBranch?: string;
  targetBranch?: string;
  targetLang?: string;
  options?: Record<string, unknown>;
}

/**
 * Active workflow metadata attached to a file state so the workbench can jump straight to the
 * review item instead of re-querying the queue per row.
 */
export interface TranslationActiveItem {
  id: string;
  jobId: string;
  status: string;
  reviewerId: string | null;
  updatedAt: string;
}

/**
 * Phase 13 ownership of a `draft_ready` file's draft overlay row.
 *
 * Only the owner can check the draft in, so the translation center shows who holds it instead of
 * offering every writer the same check-in button.
 */
export interface TranslationDraftOwner {
  userId: string;
  userName: string;
  /** `true` when the draft belongs to the user who issued the request. */
  isMine: boolean;
}

export interface TranslationFileStateView {
  id: string;
  linkId: string;
  sourcePath: string;
  targetPath: string;
  fileKind: TranslationFileKind;
  status: TranslationFileStatus;
  lastSourceCommit: string | null;
  lastSourceBlobHash: string | null;
  lastSourceTranslatableHash: string | null;
  lastTargetCommit: string | null;
  lastTargetBlobHash: string | null;
  renamedFromPath: string | null;
  localizedAssetOverride: boolean;
  /** `keys.ditamap`-style files that must be reviewed by a human (§1.2 default #3). */
  needsHumanReview: boolean;
  updatedAt: string;
  activeItem: TranslationActiveItem | null;
  /** Draft overlay owner (`null` when nobody has a draft for `targetPath`). */
  draftOwner?: TranslationDraftOwner | null;
}

export interface TranslationScanSummary {
  sourceCommit: string | null;
  targetCommit: string | null;
  total: number;
  created: number;
  updated: number;
  removed: number;
  /** Renames detected through `git diff -M`. */
  renames: number;
  /** Files whose source blob vanished from the source tree. */
  deleted: number;
  counts: TranslationFileCounts;
}

export interface TranslationScanResult {
  summary: TranslationScanSummary;
  files: TranslationFileStateView[];
}

export interface TranslationFileStateFilter {
  status?: TranslationFileStatus | TranslationFileStatus[];
  kind?: TranslationFileKind | TranslationFileKind[];
  /** Case-insensitive substring match on `sourcePath` / `targetPath`. */
  search?: string;
  /** Include `source_deleted` / `source_renamed` rows (default: included). */
  includeRemoved?: boolean;
}

export interface LockedAssetSkip {
  path: string;
  userId: string | null;
  userName: string | null;
  lockedAt: string | null;
}

export interface SyncAssetsResult {
  synced: string[];
  /** Files checked out by another user — skipped, never stolen (Phase 13 boundary). */
  skippedLocked: LockedAssetSkip[];
  /** Translator-localised images preserved because `localizedAssetOverride` is set. */
  skippedOverride: string[];
  /** Requested paths that are not tracked asset states on this link. */
  skippedUnknown: string[];
}

export interface MarkSyncedResult {
  marked: string[];
  skippedUnknown: string[];
}

/**
 * Result of syncing non-translatable passthrough files (`*.ditaval`) into the
 * caller's Phase 13 draft overlay. Mirrors `SyncAssetsResult` so the UI can
 * reuse the same skip buckets.
 */
export interface SyncPassthroughResult {
  synced: string[];
  /** Files checked out by another user — skipped, never stolen (Phase 13 boundary). */
  skippedLocked: LockedAssetSkip[];
  /** Requested paths that are not tracked passthrough states on this link. */
  skippedUnknown: string[];
}

/**
 * Resolution for rows whose source file was deleted upstream:
 * - `stage_delete` removes the translated target in the draft overlay;
 * - `keep_target` keeps the translated file and only drops the tracking row.
 */
export type ResolveDeletedAction = 'stage_delete' | 'keep_target';

export interface ResolveDeletedResult {
  /** Target files staged for deletion in the draft overlay (`stage_delete`). */
  staged: string[];
  /** Tracking rows removed without touching the target file (`keep_target`). */
  dismissed: string[];
  /** Files checked out by another user — skipped, never stolen (Phase 13 boundary). */
  skippedLocked: LockedAssetSkip[];
  /** Requested paths that are not `source_deleted` states on this link. */
  skippedUnknown: string[];
}

/* -------------------------------------------------------------------------- */
/* Stage 3 — AI translation jobs, review & check-in linkage                    */
/* -------------------------------------------------------------------------- */

export type TranslationJobMode = 'incremental' | 'full';

export type TranslationJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type TranslationItemStatus =
  | 'queued'
  | 'ai_translating'
  /** Phase 16: independent reviewer AI is reviewing / the translator is repairing QA findings. */
  | 'ai_reviewing'
  | 'validating'
  | 'ready_for_review'
  | 'in_review'
  | 'approved_draft'
  | 'checked_in'
  | 'failed'
  | 'cancelled';

/** Terminal job statuses: nothing else will ever be emitted for such a job. */
export const TERMINAL_JOB_STATUSES: readonly TranslationJobStatus[] = [
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
];

export function isTerminalJobStatus(status: string): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

/** Item statuses that still occupy a queue slot. */
export const RUNNING_ITEM_STATUSES: readonly TranslationItemStatus[] = [
  'queued',
  'ai_translating',
  'ai_reviewing',
  'validating',
];

/** Deterministic QA report persisted in `translation_items.qa_report_json`. */
export interface TranslationQaReport {
  issues: TranslationQaIssue[];
  errorCount: number;
  warningCount: number;
  /** Segments the deterministic gate actually inspected. */
  checkedSegments: number;
}

export function summarizeQaIssues(
  issues: readonly TranslationQaIssue[],
  checkedSegments: number,
): TranslationQaReport {
  let errorCount = 0;
  let warningCount = 0;
  for (const issue of issues) {
    if (issue.severity === 'error') errorCount += 1;
    else warningCount += 1;
  }
  return { issues: [...issues], errorCount, warningCount, checkedSegments };
}

/* -------------------------------------------------------------------------- */
/* Phase 16 — independent reviewer AI + DITA-OT strict validation contracts    */
/* -------------------------------------------------------------------------- */

export type TranslationAiReviewCategory =
  | 'accuracy'
  | 'omission'
  | 'terminology'
  | 'markup'
  | 'style'
  | 'qa_violation';

/** One reviewer finding. `segmentId` lets the translator repair exactly the affected blocks. */
export interface TranslationAiReviewIssue {
  segmentId: string;
  severity: 'error' | 'warning';
  category: TranslationAiReviewCategory;
  message: string;
  suggestion: string;
}

/**
 * Persisted in `translation_items.ai_review_json`. `verdict: 'skipped'` means the 0-token
 * incremental path never needed a review; `'error'` means the reviewer failed but the proposal was
 * preserved (graceful degradation).
 */
export interface TranslationAiReviewReport {
  verdict: 'pass' | 'revise' | 'skipped' | 'error';
  model: string | null;
  isDedicatedModel: boolean;
  summary: string;
  reviewRounds: number;
  qaRepairRounds: number;
  repairedSegments: number;
  initialQaErrors: number;
  remainingQaErrors: number;
  issues: TranslationAiReviewIssue[];
  /** Set when the reviewer text no longer matches the stored proposal (manual edits). */
  stale?: boolean;
  updatedAt: string;
}

export interface TranslationDitaOtDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code?: string;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
}

export type TranslationDitaOtStatus = 'passed' | 'failed' | 'skipped';

/** Persisted in `translation_items.dita_ot_report_json`. */
export interface TranslationDitaOtItemReport {
  status: TranslationDitaOtStatus;
  repaired: boolean;
  repairAttempts: number;
  errorCount: number;
  warningCount: number;
  diagnostics: TranslationDitaOtDiagnostic[];
  reason?: string;
  stale?: boolean;
  updatedAt: string;
}

/** Persisted in `translation_jobs.validation_report_json`. */
export interface TranslationJobValidationReport {
  status: TranslationDitaOtStatus;
  checkedFiles: number;
  errorFiles: number;
  repairedFiles: number;
  remainingErrorFiles: number;
  durationMs: number;
  reason?: string;
  updatedAt: string;
}

/** Parses a stored `ai_review_json` column; `null` when absent or corrupt. */
export function parseAiReviewReport(json: string | null): TranslationAiReviewReport | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as TranslationAiReviewReport;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!['pass', 'revise', 'skipped', 'error'].includes(parsed.verdict)) return null;
    return {
      ...parsed,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      reviewRounds: typeof parsed.reviewRounds === 'number' ? parsed.reviewRounds : 0,
      qaRepairRounds: typeof parsed.qaRepairRounds === 'number' ? parsed.qaRepairRounds : 0,
      repairedSegments: typeof parsed.repairedSegments === 'number' ? parsed.repairedSegments : 0,
      initialQaErrors: typeof parsed.initialQaErrors === 'number' ? parsed.initialQaErrors : 0,
      remainingQaErrors:
        typeof parsed.remainingQaErrors === 'number' ? parsed.remainingQaErrors : 0,
    };
  } catch {
    return null;
  }
}

/** Parses a stored `dita_ot_report_json` column; `null` when absent or corrupt. */
export function parseDitaOtItemReport(json: string | null): TranslationDitaOtItemReport | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as TranslationDitaOtItemReport;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!['passed', 'failed', 'skipped'].includes(parsed.status)) return null;
    return {
      ...parsed,
      repaired: parsed.repaired === true,
      repairAttempts: typeof parsed.repairAttempts === 'number' ? parsed.repairAttempts : 0,
      errorCount: typeof parsed.errorCount === 'number' ? parsed.errorCount : 0,
      warningCount: typeof parsed.warningCount === 'number' ? parsed.warningCount : 0,
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
    };
  } catch {
    return null;
  }
}

/** Parses a stored `validation_report_json` column; `null` when absent or corrupt. */
export function parseJobValidationReport(
  json: string | null,
): TranslationJobValidationReport | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as TranslationJobValidationReport;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!['passed', 'failed', 'skipped'].includes(parsed.status)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Wire shape of one `translation_items` row (list views never carry the XML payload). */
export interface TranslationItemView {
  id: string;
  jobId: string;
  linkId: string;
  sourcePath: string;
  targetPath: string;
  status: TranslationItemStatus;
  modeUsed: string | null;
  sourceCommit: string | null;
  prevSourceCommit: string | null;
  reviewerId: string | null;
  reusedSegments: number;
  translatedSegments: number;
  retryCount: number;
  error: string | null;
  /** Number of QA `error` issues in the stored report (0 before validation). */
  qaErrorCount: number;
  qaWarningCount: number;
  /** Phase 16 reviewer verdict (null when the item was never reviewed). */
  aiReviewVerdict: TranslationAiReviewReport['verdict'] | null;
  aiReviewErrorCount: number;
  aiReviewWarningCount: number;
  /** Blocks rewritten by the targeted QA repair loop. */
  qaRepairedCount: number;
  ditaOtStatus: TranslationDitaOtStatus | null;
  ditaOtErrorCount: number;
  ditaOtWarningCount: number;
  updatedAt: string;
}

/** Wire shape of one `translation_jobs` row. */
export interface TranslationJobView {
  id: string;
  linkId: string;
  userId: string;
  mode: TranslationJobMode;
  status: TranslationJobStatus;
  sourceCommit: string | null;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  cancelRequested: boolean;
  /** Phase 16 job-level DITA-OT strict validation summary. */
  validationReport: TranslationJobValidationReport | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TranslationJobSnapshot {
  job: TranslationJobView;
  items: TranslationItemView[];
}

export interface EnqueueTranslationJobInput {
  linkId: string;
  /** Source paths (`topics/a.dita`, `product.ditamap`, `filters/x.ditaval`). */
  paths: string[];
  mode?: TranslationJobMode;
  customInstruction?: string;
  /** Pre-assign a reviewer for every created item. */
  reviewerId?: string;
}

export interface TranslationJobFilter {
  linkId?: string;
  status?: TranslationJobStatus;
  limit?: number;
}

/** One glossary hit attached to a review segment so the editor can underline the term. */
export interface TranslationGlossaryHitView {
  termId: string;
  sourceTerm: string;
  targetTerm: string;
  matchedText: string;
  doNotTranslate: boolean;
  caseSensitive: boolean;
  forbiddenTargets: string[];
  contextNote: string | null;
}

/** One aligned block of the bilingual review payload. */
export interface TranslationSegmentReviewView {
  segmentId: string;
  elementTag: string;
  elementId: string | null;
  structuralPath: string;
  changeKind: string;
  protected: boolean;
  protectedReason: string | null;
  /** Set when this block is a translatable attribute (`navtitle`, map `title`). */
  attributeName?: string | null;
  /** `S1` — the current source block. */
  currSourceXml: string;
  sourceText: string;
  /** `S0` — the previous source block (3-way diff reference). */
  prevSourceText: string | null;
  /** `T0` — the previous human translation of this block. */
  prevTargetText: string | null;
  proposedTargetXml: string | null;
  proposedTargetText: string | null;
  glossaryHits: TranslationGlossaryHitView[];
  qaIssues: Array<{
    code: TranslationQaIssueCode;
    severity: 'error' | 'warning';
    message: string;
    termId?: string;
    sourceTerm?: string;
  }>;
}

/** Target-file lock projection used by the review header (`null` = free). */
export interface TranslationLockInfo {
  userId: string;
  userName: string | null;
  lockedAt: string | null;
  updatedAt: string | null;
  isMine: boolean;
}

/**
 * One file of the current `linkId` the reviewer can jump to from the review header
 * (`← 上一条` / `下一条 →`). Sorted deterministically by `sourcePath` so applying a draft never
 * reorders the navigation list.
 */
export interface TranslationReviewSiblingView {
  itemId: string;
  jobId: string;
  sourcePath: string;
  targetPath: string;
  status: TranslationItemStatus;
  qaErrorCount: number;
  qaWarningCount: number;
}

/** Full bilingual review payload for one item. */
export interface TranslationReviewPayload {
  item: TranslationItemView;
  link: {
    id: string;
    sourceManualId: string;
    targetManualId: string;
    sourceBranch: string;
    targetBranch: string;
    sourceLang: string;
    targetLang: string;
  };
  sourcePath: string;
  targetPath: string;
  /** `S1` — current source file XML. */
  sourceXml: string;
  /** `S0` — previous source file XML. */
  prevSourceXml: string | null;
  /** `T0` — current target baseline file XML. */
  targetBaselineXml: string | null;
  /** The assembled proposal the reviewer is editing. */
  proposedXml: string;
  segments: TranslationSegmentReviewView[];
  /** Effective glossary entries (normalised to the core matcher shape). */
  glossary: GlossaryEntryForMatch[];
  qaReport: TranslationQaReport;
  /** Phase 16: independent reviewer verdict and per-item DITA-OT strict report. */
  aiReview: TranslationAiReviewReport | null;
  ditaOtReport: TranslationDitaOtItemReport | null;
  lock: TranslationLockInfo | null;
  canReview: boolean;
  /**
   * Every reviewable file of the same translation link, including the current item with its live
   * status and QA counts (Phase 16 review navigation).
   */
  siblings?: TranslationReviewSiblingView[];
}

export interface SaveReviewEditsInput {
  segments?: Array<{ segmentId: string; proposedTargetXml: string }>;
  /** Whole-file replacement (the source editor tab); re-derived into segments. */
  proposedXml?: string;
}

export interface RefineTranslationSegmentInput {
  segmentId: string;
  instruction: string;
  currentTargetXml?: string;
}

export interface RefineTranslationSegmentResult {
  segmentId: string;
  proposedTargetXml: string;
  proposedTargetText: string;
  qaIssues: TranslationQaIssue[];
}

export interface ApplyTranslationDraftResult {
  item: TranslationItemView;
  /** `null` when nothing was applied because the baseline already carried this exact translation. */
  draft: {
    filePath: string;
    op: string;
    baseCommit: string | null;
    updatedAt: string;
  } | null;
  lock: TranslationLockInfo | null;
  /** No-op apply: the target branch already held these exact bytes, so the item is `checked_in`. */
  alreadyApplied?: boolean;
}

export interface BatchCheckinInput {
  paths?: string[];
  itemIds?: string[];
  message: string;
}

/**
 * Bulk "apply to target drafts" selection: either explicit review item ids or source/target
 * paths. Both empty means "every reviewable item of this link".
 */
export interface BatchApplyDraftInput {
  paths?: string[];
  itemIds?: string[];
}

/** One item the bulk apply had to leave alone, with the reason shown next to the row. */
export interface BatchApplyDraftSkip {
  path: string;
  itemId: string;
  reason: string;
}

export interface BatchApplyDraftResult {
  applied: Array<{ itemId: string; sourcePath: string; targetPath: string }>;
  skippedLocked: BatchApplyDraftSkip[];
  skippedInvalid: BatchApplyDraftSkip[];
  /** Requested paths that carry no reviewable proposal at all. */
  skippedNoProposal: string[];
}

export interface BatchCheckinResult {
  /** `null` when every selected draft was already in the baseline, so no commit was needed. */
  commit: {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
  } | null;
  checkedInPaths: string[];
  syncedFiles: string[];
  /** Drafts that materialized byte-identical content: dropped and marked `synced`, never committed. */
  alreadySyncedPaths?: string[];
}

/** Server-sent event emitted by `TranslationQueueService` for one job. */
export interface TranslationStreamEvent {
  event: 'job.snapshot' | 'job.updated' | 'job.completed' | 'item.updated';
  data: unknown;
}

/* -------------------------------------------------------------------------- */
/* Glossary contracts                                                          */
/* -------------------------------------------------------------------------- */

export type GlossaryScope = 'global' | 'manual';
export type GlossaryTermStatus = 'approved' | 'draft' | 'deprecated';

export interface GlossaryTranslationView {
  id: string;
  termId: string;
  targetLang: string;
  targetTerm: string;
  forbiddenTargets: string[];
  notes: string | null;
  updatedAt: string;
}

export interface GlossaryTermView {
  id: string;
  glossaryId: string;
  sourceTerm: string;
  synonyms: string[];
  caseSensitive: boolean;
  doNotTranslate: boolean;
  partOfSpeech: string | null;
  contextNote: string | null;
  status: GlossaryTermStatus;
  createdAt: string;
  updatedAt: string;
  translations: GlossaryTranslationView[];
}

export interface GlossaryView {
  id: string;
  scope: GlossaryScope;
  manualId: string | null;
  name: string;
  description: string;
  sourceLang: string;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  termCount: number;
}

export interface CreateGlossaryInput {
  scope?: GlossaryScope;
  manualId?: string | null;
  name: string;
  description?: string;
  sourceLang: string;
  enabled?: boolean;
}

export interface UpdateGlossaryInput {
  name?: string;
  description?: string;
  sourceLang?: string;
  enabled?: boolean;
}

export interface GlossaryTranslationInput {
  targetLang: string;
  targetTerm: string;
  forbiddenTargets?: string[];
  notes?: string | null;
}

export interface CreateGlossaryTermInput {
  sourceTerm: string;
  synonyms?: string[];
  caseSensitive?: boolean;
  doNotTranslate?: boolean;
  partOfSpeech?: string | null;
  contextNote?: string | null;
  status?: GlossaryTermStatus;
  translations?: GlossaryTranslationInput[];
}

export interface UpdateGlossaryTermInput extends Partial<CreateGlossaryTermInput> {
  /** Replace every translation row for this term (omitted `targetLang` rows are removed). */
  replaceTranslations?: boolean;
}

export interface GlossaryTermFilter {
  search?: string;
  status?: GlossaryTermStatus | GlossaryTermStatus[];
  targetLang?: string;
}

export interface GlossaryImportInput {
  format: 'csv' | 'json' | 'tbx';
  content: string;
  dryRun?: boolean;
  /** Forces every imported translation row onto one target language. */
  targetLang?: string;
}

export interface GlossaryImportResult {
  dryRun: boolean;
  stats: {
    total: number;
    newCount: number;
    updateCount: number;
    invalidCount: number;
    writtenTerms: number;
    writtenTranslations: number;
  };
  errors: Array<{ row: number; message: string }>;
  preview: Array<{
    sourceTerm: string;
    targetLang: string | null;
    targetTerm: string | null;
    action: 'create' | 'update' | 'invalid';
  }>;
}

export interface GlossaryExportResult {
  content: string;
  contentType: string;
  filename: string;
}

/** Effective, merged glossary entry used by the editor's term hints and QA. */
export interface EffectiveGlossaryResult {
  manualId: string | null;
  sourceLang: string | null;
  targetLang: string;
  entries: Array<{
    termId: string;
    glossaryId: string;
    scope: GlossaryScope;
    sourceTerm: string;
    synonyms: string[];
    targetTerm: string;
    forbiddenTargets: string[];
    caseSensitive: boolean;
    doNotTranslate: boolean;
    contextNote?: string;
    partOfSpeech?: string;
  }>;
}

/** All-zero counters, used before the first scan of a freshly created link. */
export function emptyFileCounts(): TranslationFileCounts {
  return {
    total: 0,
    synced: 0,
    outdated: 0,
    untranslated: 0,
    inQueue: 0,
    inReview: 0,
    draftReady: 0,
    metadataOnly: 0,
    sourceDeleted: 0,
    sourceRenamed: 0,
    progressPercent: 0,
  };
}

/**
 * Aggregates per-file statuses into the translation-center counters. `source_deleted` rows are
 * excluded from the progress denominator: a file that no longer exists in the source can never
 * be "translated", so counting it would pin progress below 100% forever.
 */
export function countFileStatuses(
  rows: ReadonlyArray<{ status: TranslationFileStatus | string }>,
): TranslationFileCounts {
  const counts = emptyFileCounts();
  for (const row of rows) {
    counts.total += 1;
    switch (row.status) {
      case 'synced':
        counts.synced += 1;
        break;
      case 'outdated':
        counts.outdated += 1;
        break;
      case 'outdated_metadata_only':
        counts.metadataOnly += 1;
        break;
      case 'untranslated':
        counts.untranslated += 1;
        break;
      case 'in_queue':
        counts.inQueue += 1;
        break;
      case 'in_review':
        counts.inReview += 1;
        break;
      case 'draft_ready':
        counts.draftReady += 1;
        break;
      case 'source_deleted':
        counts.sourceDeleted += 1;
        break;
      case 'source_renamed':
        counts.sourceRenamed += 1;
        break;
      default:
        break;
    }
  }
  const denominator = counts.total - counts.sourceDeleted;
  counts.progressPercent =
    denominator <= 0
      ? counts.total === 0
        ? 0
        : 100
      : Math.min(100, Math.round(((counts.synced + counts.draftReady) / denominator) * 100));
  return counts;
}
