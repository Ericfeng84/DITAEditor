/**
 * Phase 16 Stage 4 — typed client for `/api/translation/*` and `/api/glossaries/*`.
 *
 * Everything goes through `requestJson` so the `BASE_URL` sub-path, `x-dita-user-id`,
 * `x-dita-locale` and the `x-dita-manual-id` / `x-dita-branch` scope headers are applied once
 * (see `services/workspace-api.ts`). The job progress stream uses `fetch()` with
 * `Accept: text/event-stream` for the same reason: `EventSource` cannot send those headers.
 *
 * Wire shapes mirror `apps/api/src/modules/translation/types.ts` exactly — keep them in sync.
 */
import type { GlossaryEntryForMatch, TranslationQaIssue } from '@dita/core';
import { getCurrentLocale, translate } from '../i18n/index.js';
import { applyScopeHeaders } from './active-scope.js';
import { apiUrl } from './api-base.js';
import { getCurrentUserId } from './identity-api.js';
import { ApiHttpError, requestJson } from './workspace-api.js';

/* -------------------------------------------------------------------------- */
/* Links, file states & scan                                                   */
/* -------------------------------------------------------------------------- */

export type TranslationFileKind = 'topic' | 'map' | 'keydef_map' | 'ditaval' | 'asset';

export type TranslationFileStatus =
  | 'untranslated'
  | 'outdated'
  | 'outdated_metadata_only'
  | 'in_queue'
  | 'in_review'
  | 'draft_ready'
  | 'synced'
  | 'source_deleted'
  | 'source_renamed';

export interface TranslationManualSummary {
  id: string;
  name: string;
  rootDir: string;
  exists: boolean;
  sourceLang: string | null;
}

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
  targetManualId?: string;
  targetBranch?: string;
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

export interface TranslationActiveItem {
  id: string;
  jobId: string;
  status: string;
  reviewerId: string | null;
  updatedAt: string;
}

/** Phase 13 draft ownership of a `draft_ready` file (only the owner may check it in). */
export interface TranslationDraftOwner {
  userId: string;
  userName: string;
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
  needsHumanReview: boolean;
  updatedAt: string;
  activeItem: TranslationActiveItem | null;
  /** `null`/absent when nobody holds a draft for `targetPath` (treated as checkin-able). */
  draftOwner?: TranslationDraftOwner | null;
}

export interface TranslationScanSummary {
  sourceCommit: string | null;
  targetCommit: string | null;
  total: number;
  created: number;
  updated: number;
  removed: number;
  renames: number;
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
  search?: string;
}

export interface LockedAssetSkip {
  path: string;
  userId: string | null;
  userName: string | null;
  lockedAt: string | null;
}

export interface SyncAssetsResult {
  synced: string[];
  skippedLocked: LockedAssetSkip[];
  skippedOverride: string[];
  skippedUnknown: string[];
}

export interface MarkSyncedResult {
  marked: string[];
  skippedUnknown: string[];
}

/**
 * Phase 16 — passthrough sync (`*.ditaval`). These files are copied verbatim into the caller's
 * draft overlay instead of being translated, so the result mirrors `SyncAssetsResult` without the
 * localized-override bucket.
 */
export interface SyncPassthroughResult {
  synced: string[];
  skippedLocked: LockedAssetSkip[];
  skippedUnknown: string[];
}

/**
 * Phase 16 — how to resolve a tracked row whose source file was deleted upstream.
 * `stage_delete` removes the translated target from the draft overlay; `keep_target` keeps the
 * translated file (a deliberately localized asset) and only drops the tracking row.
 */
export type ResolveDeletedAction = 'stage_delete' | 'keep_target';

export interface ResolveDeletedResult {
  staged: string[];
  dismissed: string[];
  skippedLocked: LockedAssetSkip[];
  skippedUnknown: string[];
}

/* -------------------------------------------------------------------------- */
/* Jobs, items & review                                                        */
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
  /** Phase 16 — the independent reviewer model is reading the draft (between translate & validate). */
  | 'ai_reviewing'
  | 'validating'
  | 'ready_for_review'
  | 'in_review'
  | 'approved_draft'
  | 'checked_in'
  | 'failed'
  | 'cancelled';

export const TERMINAL_JOB_STATUSES: readonly TranslationJobStatus[] = [
  'completed',
  'completed_with_errors',
  'failed',
  'cancelled',
];

export function isTerminalJobStatus(status: string): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status);
}

export interface TranslationQaReport {
  issues: TranslationQaIssue[];
  errorCount: number;
  warningCount: number;
  checkedSegments: number;
}

/* -------------------------------------------------------------------------- */
/* Phase 16 — independent reviewer + DITA-OT strict validation reports         */
/* -------------------------------------------------------------------------- */

/** What the reviewer model complained about (`qa_violation` = a deterministic QA rule failed). */
export type TranslationAiReviewCategory =
  | 'accuracy'
  | 'omission'
  | 'terminology'
  | 'markup'
  | 'style'
  | 'qa_violation';

export interface TranslationAiReviewIssue {
  segmentId: string;
  severity: 'error' | 'warning';
  category: TranslationAiReviewCategory;
  message: string;
  suggestion: string;
}

/**
 * Reviewer verdict for one item.
 *
 * `model` is the reviewer model that actually ran (so a reviewer swapped after the fact leaves a
 * trace), and `isDedicatedModel` records whether it was the dedicated reviewer or the inherited
 * primary one. `stale` is set by the backend when the item changed after the report was written.
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

/** One item's DITA-OT strict outcome (per-topic override + repaired flag). */
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

/** Job-level roll-up written after the post-batch strict validation pass. */
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
  qaErrorCount: number;
  qaWarningCount: number;
  updatedAt: string;
  /* Phase 16 items — all optional so a pre-Phase-16 API row still type-checks. */
  /** Reviewer verdict of the last quality pass (`null` when the pass was disabled or pending). */
  aiReviewVerdict?: TranslationAiReviewReport['verdict'] | null;
  aiReviewErrorCount?: number;
  aiReviewWarningCount?: number;
  /** Segments the deterministic QA auto-repair loop fixed without human help. */
  qaRepairedCount?: number;
  ditaOtStatus?: TranslationDitaOtStatus | null;
  ditaOtErrorCount?: number;
  ditaOtWarningCount?: number;
}

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
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** Job-level DITA-OT strict validation summary (Phase 16, absent before it ran). */
  validationReport?: TranslationJobValidationReport | null;
}

export interface TranslationJobSnapshot {
  job: TranslationJobView;
  items: TranslationItemView[];
}

export interface EnqueueTranslationJobInput {
  linkId: string;
  paths: string[];
  mode?: TranslationJobMode;
  customInstruction?: string;
  reviewerId?: string;
}

export interface TranslationJobFilter {
  linkId?: string;
  status?: TranslationJobStatus;
  limit?: number;
}

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
  currSourceXml: string;
  sourceText: string;
  prevSourceText: string | null;
  prevTargetText: string | null;
  proposedTargetXml: string | null;
  proposedTargetText: string | null;
  glossaryHits: TranslationGlossaryHitView[];
  qaIssues: Array<{
    code: TranslationQaIssue['code'];
    severity: 'error' | 'warning';
    message: string;
    termId?: string;
    sourceTerm?: string;
  }>;
}

/**
 * Phase 16 review navigation: one entry per reviewable file of the same language pair.
 *
 * Mirrors `TranslationReviewSiblingView` in `apps/api/src/modules/translation/types.ts`. The
 * backend sorts by `sourcePath` so "apply to draft" never reorders the review queue while the
 * reviewer walks through it; the web layer keeps the field optional so an older API build (or a
 * mocked payload) still renders, degrading to a single-file navigator.
 */
export interface TranslationReviewSiblingView {
  itemId: string;
  sourcePath: string;
  targetPath: string;
  status: TranslationItemStatus;
  qaErrorCount: number;
  qaWarningCount: number;
}

export interface TranslationLockInfo {
  userId: string;
  userName: string | null;
  lockedAt: string | null;
  updatedAt: string | null;
  isMine: boolean;
}

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
  sourceXml: string;
  prevSourceXml: string | null;
  targetBaselineXml: string | null;
  proposedXml: string;
  segments: TranslationSegmentReviewView[];
  glossary: GlossaryEntryForMatch[];
  qaReport: TranslationQaReport;
  lock: TranslationLockInfo | null;
  canReview: boolean;
  /** Reviewable files of this language pair, sorted by `sourcePath` (Phase 16 navigation). */
  siblings?: TranslationReviewSiblingView[];
  /** Phase 16 — independent reviewer report of the last quality pass. */
  aiReview?: TranslationAiReviewReport | null;
  /** Phase 16 — per-item DITA-OT strict validation report. */
  ditaOtReport?: TranslationDitaOtItemReport | null;
}

export interface SaveReviewEditsInput {
  segments?: Array<{ segmentId: string; proposedTargetXml: string }>;
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
  /** `null` when the baseline already carried this exact translation (nothing to apply). */
  draft: { filePath: string; op: string; baseCommit: string | null; updatedAt: string } | null;
  lock: TranslationLockInfo | null;
  alreadyApplied?: boolean;
}

export interface BatchCheckinInput {
  paths?: string[];
  itemIds?: string[];
  message: string;
}

export interface BatchCheckinResult {
  /** `null` when every selected draft already matched the baseline, so nothing was committed. */
  commit: { hash: string; shortHash: string; message: string; author: string; date: string } | null;
  checkedInPaths: string[];
  syncedFiles: string[];
  alreadySyncedPaths?: string[];
}

export interface BatchApplyDraftInput {
  paths?: string[];
  itemIds?: string[];
}

export interface BatchApplyDraftSkip {
  path: string;
  itemId: string;
  reason: string;
}

export interface BatchApplyDraftResult {
  applied: Array<{ itemId: string; sourcePath: string; targetPath: string }>;
  skippedLocked: BatchApplyDraftSkip[];
  skippedInvalid: BatchApplyDraftSkip[];
  skippedNoProposal: string[];
}

/* -------------------------------------------------------------------------- */
/* Glossaries                                                                  */
/* -------------------------------------------------------------------------- */

export type GlossaryScope = 'global' | 'manual';
export type GlossaryTermStatus = 'approved' | 'draft' | 'deprecated';
export type GlossaryExchangeFormat = 'csv' | 'json' | 'tbx';

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
  replaceTranslations?: boolean;
}

export interface GlossaryTermFilter {
  search?: string;
  status?: GlossaryTermStatus | GlossaryTermStatus[];
  targetLang?: string;
}

export interface GlossaryImportInput {
  format: GlossaryExchangeFormat;
  content: string;
  dryRun?: boolean;
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

/* -------------------------------------------------------------------------- */
/* Transport helpers                                                           */
/* -------------------------------------------------------------------------- */

function encode(value: string): string {
  return encodeURIComponent(value);
}

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : '';
}

function listParam(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return value.length > 0 ? value.join(',') : undefined;
}

function jsonBody(method: 'POST' | 'PATCH' | 'PUT', body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  };
}

const LINKS = '/api/translation/links';
const JOBS = '/api/translation/jobs';
const ITEMS = '/api/translation/items';
const GLOSSARIES = '/api/glossaries';

/* -------------------------------------------------------------------------- */
/* Links                                                                       */
/* -------------------------------------------------------------------------- */

export function fetchTranslationLinks(
  filter: { manualId?: string; branch?: string } = {},
): Promise<{ links: TranslationLinkView[] }> {
  return requestJson<{ links: TranslationLinkView[] }>(
    `${LINKS}${toQuery({ manualId: filter.manualId, branch: filter.branch })}`,
  );
}

export function fetchTranslationLink(linkId: string): Promise<{ link: TranslationLinkView }> {
  return requestJson<{ link: TranslationLinkView }>(`${LINKS}/${encode(linkId)}`);
}

export function createTranslationLink(
  input: CreateTranslationLinkInput,
): Promise<{ link: TranslationLinkView }> {
  return requestJson<{ link: TranslationLinkView }>(LINKS, jsonBody('POST', input));
}

export function updateTranslationLink(
  linkId: string,
  patch: UpdateTranslationLinkInput,
): Promise<{ link: TranslationLinkView }> {
  return requestJson<{ link: TranslationLinkView }>(
    `${LINKS}/${encode(linkId)}`,
    jsonBody('PATCH', patch),
  );
}

export function deleteTranslationLink(
  linkId: string,
): Promise<{ removed?: string; links?: TranslationLinkView[] }> {
  return requestJson<{ removed?: string; links?: TranslationLinkView[] }>(
    `${LINKS}/${encode(linkId)}`,
    { method: 'DELETE' },
  );
}

/* -------------------------------------------------------------------------- */
/* Incremental sync, assets & batch check-in                                   */
/* -------------------------------------------------------------------------- */

export function scanTranslationLink(linkId: string): Promise<TranslationScanResult> {
  return requestJson<TranslationScanResult>(`${LINKS}/${encode(linkId)}/scan`, { method: 'POST' });
}

export function fetchTranslationFiles(
  linkId: string,
  filter: TranslationFileStateFilter = {},
): Promise<{ files: TranslationFileStateView[]; counts: TranslationFileCounts }> {
  const query = toQuery({
    status: listParam(filter.status),
    kind: listParam(filter.kind),
    q: filter.search,
  });
  return requestJson<{ files: TranslationFileStateView[]; counts: TranslationFileCounts }>(
    `${LINKS}/${encode(linkId)}/files${query}`,
  );
}

export function syncTranslationAssets(
  linkId: string,
  input: { paths?: string[]; force?: boolean } = {},
): Promise<SyncAssetsResult> {
  return requestJson<SyncAssetsResult>(
    `${LINKS}/${encode(linkId)}/sync-assets`,
    jsonBody('POST', input),
  );
}

/** Copies passthrough files (`*.ditaval`) into the caller's draft overlay (no AI translation). */
export function syncTranslationPassthrough(
  linkId: string,
  input: { paths?: string[] } = {},
): Promise<SyncPassthroughResult> {
  return requestJson<SyncPassthroughResult>(
    `${LINKS}/${encode(linkId)}/sync-passthrough`,
    jsonBody('POST', input),
  );
}

/** Resolves rows whose source file was deleted upstream (delete the target or keep it). */
export function resolveDeletedTranslationFiles(
  linkId: string,
  input: { paths: string[]; action: ResolveDeletedAction },
): Promise<ResolveDeletedResult> {
  return requestJson<ResolveDeletedResult>(
    `${LINKS}/${encode(linkId)}/resolve-deleted`,
    jsonBody('POST', input),
  );
}

export function markTranslationFilesSynced(
  linkId: string,
  paths: string[],
): Promise<MarkSyncedResult> {
  return requestJson<MarkSyncedResult>(
    `${LINKS}/${encode(linkId)}/mark-synced`,
    jsonBody('POST', { paths }),
  );
}

export function batchApplyTranslationDrafts(
  linkId: string,
  input: BatchApplyDraftInput,
): Promise<BatchApplyDraftResult> {
  return requestJson<BatchApplyDraftResult>(
    `${LINKS}/${encode(linkId)}/batch-apply-draft`,
    jsonBody('POST', input),
  );
}

export function batchCheckinTranslationLink(
  linkId: string,
  input: BatchCheckinInput,
): Promise<BatchCheckinResult> {
  return requestJson<BatchCheckinResult>(
    `${LINKS}/${encode(linkId)}/batch-checkin`,
    jsonBody('POST', input),
  );
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                        */
/* -------------------------------------------------------------------------- */

export function enqueueTranslationJob(
  input: EnqueueTranslationJobInput,
): Promise<TranslationJobSnapshot> {
  return requestJson<TranslationJobSnapshot>(JOBS, jsonBody('POST', input));
}

export function fetchTranslationJobs(
  filter: TranslationJobFilter = {},
): Promise<{ jobs: TranslationJobView[] }> {
  return requestJson<{ jobs: TranslationJobView[] }>(
    `${JOBS}${toQuery({ linkId: filter.linkId, status: filter.status, limit: filter.limit })}`,
  );
}

export function fetchTranslationJob(jobId: string): Promise<TranslationJobSnapshot> {
  return requestJson<TranslationJobSnapshot>(`${JOBS}/${encode(jobId)}`);
}

export function cancelTranslationJob(jobId: string): Promise<TranslationJobSnapshot> {
  return requestJson<TranslationJobSnapshot>(`${JOBS}/${encode(jobId)}/cancel`, { method: 'POST' });
}

export function retryFailedTranslationJob(jobId: string): Promise<TranslationJobSnapshot> {
  return requestJson<TranslationJobSnapshot>(`${JOBS}/${encode(jobId)}/retry-failed`, {
    method: 'POST',
  });
}

export function assignTranslationItemReviewer(
  itemId: string,
  reviewerId: string | null,
): Promise<{ item: TranslationItemView }> {
  return requestJson<{ item: TranslationItemView }>(
    `${ITEMS}/${encode(itemId)}/assign`,
    jsonBody('PATCH', { reviewerId }),
  );
}

/* -------------------------------------------------------------------------- */
/* SSE job progress                                                            */
/* -------------------------------------------------------------------------- */

export type TranslationStreamEventName =
  | 'job.snapshot'
  | 'job.updated'
  | 'job.completed'
  | 'item.updated';

export interface TranslationStreamEvent {
  event: TranslationStreamEventName;
  data: unknown;
}

const STREAM_EVENTS: readonly TranslationStreamEventName[] = [
  'job.snapshot',
  'job.updated',
  'job.completed',
  'item.updated',
];

/** Same header bag `requestJson` builds, but for the long-lived SSE request. */
function streamHeaders(): Record<string, string> {
  const headers = new Headers({ accept: 'text/event-stream' });
  const userId = getCurrentUserId();
  if (userId) headers.set('x-dita-user-id', userId);
  headers.set('x-dita-locale', getCurrentLocale());
  applyScopeHeaders(headers);
  const bag: Record<string, string> = {};
  headers.forEach((value, key) => {
    bag[key] = value;
  });
  return bag;
}

/** Parses one SSE frame (`event: name` + `data: json`); heartbeat comments are skipped. */
export function parseTranslationStreamFrame(frame: string): TranslationStreamEvent | null {
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  const name = eventName ?? 'job.snapshot';
  if (!(STREAM_EVENTS as readonly string[]).includes(name)) return null;
  if (dataLines.length === 0) return null;
  try {
    return {
      event: name as TranslationStreamEventName,
      data: JSON.parse(dataLines.join('\n')) as unknown,
    };
  } catch {
    return null;
  }
}

/**
 * Subscribes to `/api/translation/jobs/:id/stream`. Resolves when the server closes the stream
 * (terminal job) or when `signal` aborts; rejects only when the request itself fails.
 */
export async function subscribeTranslationJobStream(
  jobId: string,
  onEvent: (event: TranslationStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl(`${JOBS}/${encode(jobId)}/stream`), {
    method: 'GET',
    headers: streamHeaders(),
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiHttpError(
      response.status,
      payload.error ??
        translate(getCurrentLocale(), 'translation.error.loadFailed', {
          message: String(response.status),
        }),
    );
  }
  if (!response.body) {
    throw new Error(
      translate(getCurrentLocale(), 'translation.error.streamLost', {
        message: String(response.status),
      }),
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancel, { once: true });

  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseTranslationStreamFrame(frame);
        if (parsed) onEvent(parsed);
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

/* -------------------------------------------------------------------------- */
/* Review & apply                                                              */
/* -------------------------------------------------------------------------- */

export function fetchTranslationReview(itemId: string): Promise<TranslationReviewPayload> {
  return requestJson<TranslationReviewPayload>(`${ITEMS}/${encode(itemId)}/review`);
}

export function saveTranslationReview(
  itemId: string,
  input: SaveReviewEditsInput,
): Promise<TranslationReviewPayload> {
  return requestJson<TranslationReviewPayload>(
    `${ITEMS}/${encode(itemId)}/review`,
    jsonBody('PUT', input),
  );
}

export function refineTranslationSegment(
  itemId: string,
  input: RefineTranslationSegmentInput,
): Promise<RefineTranslationSegmentResult> {
  return requestJson<RefineTranslationSegmentResult>(
    `${ITEMS}/${encode(itemId)}/ai-refine`,
    jsonBody('POST', input),
  );
}

export function applyTranslationToDraft(itemId: string): Promise<ApplyTranslationDraftResult> {
  return requestJson<ApplyTranslationDraftResult>(`${ITEMS}/${encode(itemId)}/apply-draft`, {
    method: 'POST',
  });
}

/**
 * Phase 16 — re-run the per-item DITA-OT strict check on demand.
 *
 * Same deterministic gate the pipeline runs after batch translation, but scoped to one topic and
 * executed against a temp materialization of the reviewer's current proposal. The response carries
 * the refreshed item row so the caller does not need a second round-trip.
 */
export function validateTranslationItemStrict(
  itemId: string,
): Promise<{ item: TranslationItemView; ditaOtReport: TranslationDitaOtItemReport }> {
  return requestJson<{ item: TranslationItemView; ditaOtReport: TranslationDitaOtItemReport }>(
    `${ITEMS}/${encode(itemId)}/validate-strict`,
    { method: 'POST' },
  );
}

/* -------------------------------------------------------------------------- */
/* Glossaries                                                                  */
/* -------------------------------------------------------------------------- */

export function fetchGlossaries(
  filter: { scope?: GlossaryScope; manualId?: string; sourceLang?: string } = {},
): Promise<{ glossaries: GlossaryView[] }> {
  return requestJson<{ glossaries: GlossaryView[] }>(
    `${GLOSSARIES}${toQuery({
      scope: filter.scope,
      manualId: filter.manualId,
      sourceLang: filter.sourceLang,
    })}`,
  );
}

export function fetchGlossary(glossaryId: string): Promise<{ glossary: GlossaryView }> {
  return requestJson<{ glossary: GlossaryView }>(`${GLOSSARIES}/${encode(glossaryId)}`);
}

export function createGlossary(input: CreateGlossaryInput): Promise<{ glossary: GlossaryView }> {
  return requestJson<{ glossary: GlossaryView }>(GLOSSARIES, jsonBody('POST', input));
}

export function updateGlossary(
  glossaryId: string,
  patch: UpdateGlossaryInput,
): Promise<{ glossary: GlossaryView }> {
  return requestJson<{ glossary: GlossaryView }>(
    `${GLOSSARIES}/${encode(glossaryId)}`,
    jsonBody('PATCH', patch),
  );
}

export function deleteGlossary(
  glossaryId: string,
): Promise<{ removed?: string; glossaries?: GlossaryView[] }> {
  return requestJson<{ removed?: string; glossaries?: GlossaryView[] }>(
    `${GLOSSARIES}/${encode(glossaryId)}`,
    { method: 'DELETE' },
  );
}

export function fetchGlossaryTerms(
  glossaryId: string,
  filter: GlossaryTermFilter = {},
): Promise<{ terms: GlossaryTermView[] }> {
  return requestJson<{ terms: GlossaryTermView[] }>(
    `${GLOSSARIES}/${encode(glossaryId)}/terms${toQuery({
      q: filter.search,
      status: listParam(filter.status),
      targetLang: filter.targetLang,
    })}`,
  );
}

export function createGlossaryTerm(
  glossaryId: string,
  input: CreateGlossaryTermInput,
): Promise<{ term: GlossaryTermView }> {
  return requestJson<{ term: GlossaryTermView }>(
    `${GLOSSARIES}/${encode(glossaryId)}/terms`,
    jsonBody('POST', input),
  );
}

export function updateGlossaryTerm(
  termId: string,
  patch: UpdateGlossaryTermInput,
): Promise<{ term: GlossaryTermView }> {
  return requestJson<{ term: GlossaryTermView }>(
    `${GLOSSARIES}/terms/${encode(termId)}`,
    jsonBody('PATCH', patch),
  );
}

export function deleteGlossaryTerm(
  termId: string,
): Promise<{ removed?: string; terms?: GlossaryTermView[] }> {
  return requestJson<{ removed?: string; terms?: GlossaryTermView[] }>(
    `${GLOSSARIES}/terms/${encode(termId)}`,
    { method: 'DELETE' },
  );
}

export function importGlossary(
  glossaryId: string,
  input: GlossaryImportInput,
): Promise<GlossaryImportResult> {
  return requestJson<GlossaryImportResult>(
    `${GLOSSARIES}/${encode(glossaryId)}/import`,
    jsonBody('POST', input),
  );
}

/**
 * Glossary export is served as a downloadable text body (with `content-disposition`), so it
 * bypasses `requestJson`'s JSON parsing while still carrying every identity/scope header.
 */
export async function exportGlossary(
  glossaryId: string,
  options: { format: GlossaryExchangeFormat; targetLang?: string },
): Promise<GlossaryExportResult> {
  const headers = new Headers();
  const userId = getCurrentUserId();
  if (userId) headers.set('x-dita-user-id', userId);
  headers.set('x-dita-locale', getCurrentLocale());
  applyScopeHeaders(headers);
  const query = toQuery({ format: options.format, targetLang: options.targetLang });
  const response = await fetch(apiUrl(`${GLOSSARIES}/${encode(glossaryId)}/export${query}`), {
    headers,
  });
  const content = await response.text();
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = JSON.parse(content) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Non-JSON error body: keep the status line.
    }
    throw new ApiHttpError(response.status, message);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const filename = match?.[1]
    ? decodeURIComponent(match[1])
    : `glossary.${options.format === 'tbx' ? 'tbx' : options.format}`;
  return {
    content,
    filename,
    contentType: response.headers.get('content-type') ?? 'text/plain; charset=utf-8',
  };
}

export function fetchEffectiveGlossary(
  filter: { manualId?: string | null; sourceLang?: string | null; targetLang: string },
): Promise<EffectiveGlossaryResult> {
  return requestJson<EffectiveGlossaryResult>(
    `${GLOSSARIES}/effective${toQuery({
      manualId: filter.manualId ?? undefined,
      sourceLang: filter.sourceLang ?? undefined,
      targetLang: filter.targetLang,
    })}`,
  );
}
