import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assembleTranslatedXml,
  checkXmlWellFormed,
  computeTranslatableDocumentFingerprint,
  extractPlainText,
  extractTranslatableSegments,
  matchGlossaryTerms,
  parseXml,
  runTranslationQa,
  xmlToPmDoc,
  type AlignedTranslationSegment,
  type GlossaryEntryForMatch,
  type TranslationQaIssue,
} from '@dita/core';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  translationFileStates,
  translationItems,
  translationLinks,
  type TranslationItemRow,
  type TranslationLinkRow,
  type WorkingDraftRow,
} from '../../db/schema.js';
import { httpError, isHttpError } from '../errors.js';
import type { GitCommitEntry, GitManager } from '../git/git-manager.js';
import type { IdentityService, IdentityUser } from '../identity/identity-service.js';
import type { DraftService } from '../locks/draft-service.js';
import type { LockService, LockView } from '../locks/lock-service.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import type { AiTranslationOrchestrator } from './ai-translator.js';
import type { TranslationDitaOtValidator } from './dita-ot-validator.js';
import type { GlossaryService } from './glossary-service.js';
import { parseLinkOptions } from './queue-service.js';
import { readLinkRow, type TranslationLinkService } from './link-service.js';
import {
  classifyTranslationFileKind,
  type IncrementalSyncService,
} from './sync-service.js';
import {
  parseAiReviewReport,
  parseDitaOtItemReport,
  summarizeQaIssues,
  type ApplyTranslationDraftResult,
  type BatchApplyDraftInput,
  type BatchApplyDraftResult,
  type BatchCheckinInput,
  type BatchCheckinResult,
  type RefineTranslationSegmentInput,
  type RefineTranslationSegmentResult,
  type SaveReviewEditsInput,
  type TranslationGlossaryHitView,
  type TranslationItemStatus,
  type TranslationLockInfo,
  type TranslationDitaOtItemReport,
  type TranslationItemView,
  type TranslationQaReport,
  type TranslationReviewPayload,
  type TranslationReviewSiblingView,
  type TranslationSegmentReviewView,
} from './types.js';

/**
 * Phase 16 Stage 3 — bilingual review, single-block refinement, and the Phase 13 bridge.
 *
 * Every write in this service is Phase 13-safe:
 * - review edits only touch `translation_items` (SQLite),
 * - `applyToDraft` takes the caller's lock and writes `working_drafts` only, so the shared
 *   `workDir` stays clean at `HEAD`,
 * - `batchCheckin` and `onTargetCheckinCommitted` reuse the exact `LockService.checkin` commit path
 *   the manual `POST /api/locks/checkin` uses, then advance the translation watermarks.
 */

export type ReviewGlossaryService = Pick<GlossaryService, 'resolveEffectiveGlossary'>;

/** `GlossaryService` yields nullable notes; the core matcher wants optional fields. */
type GlossaryServiceEntry = ReturnType<
  ReviewGlossaryService['resolveEffectiveGlossary']
>['entries'][number];

function toMatchEntries(
  entries: readonly GlossaryServiceEntry[],
): GlossaryEntryForMatch[] {
  return entries.map((entry) => ({
    termId: entry.termId,
    glossaryId: entry.glossaryId,
    scope: entry.scope,
    sourceTerm: entry.sourceTerm,
    ...(entry.synonyms ? { synonyms: entry.synonyms } : {}),
    targetTerm: entry.targetTerm,
    ...(entry.forbiddenTargets ? { forbiddenTargets: entry.forbiddenTargets } : {}),
    caseSensitive: entry.caseSensitive,
    doNotTranslate: entry.doNotTranslate,
    ...(entry.contextNote ? { contextNote: entry.contextNote } : {}),
    ...(entry.partOfSpeech ? { partOfSpeech: entry.partOfSpeech } : {}),
  }));
}

export interface TargetBaselineChangeInput {
  manualId: string;
  branch: string;
  user: IdentityUser;
  paths: string[];
  commit: GitCommitEntry;
}

export interface ReviewApplyServiceOptions {
  db: DitaDatabase;
  git: GitManager;
  registry: ManualRegistryService;
  locks: LockService;
  drafts: DraftService;
  audit?: unknown;
  links: TranslationLinkService;
  sync: IncrementalSyncService;
  glossaries: ReviewGlossaryService;
  translator: AiTranslationOrchestrator;
  /** Phase 16: per-item DITA-OT strict validation from the review pane. */
  ditaOtValidator?: TranslationDitaOtValidator;
  identity: IdentityService;
  /** Called after `batchCheckin` advanced the target branch (mirrors `phase4.onBaselineChanged`). */
  onTargetBaselineChanged?: (input: TargetBaselineChangeInput) => Promise<void> | void;
}

/** Resolved worktree pair for one translation link. */
interface ResolvedTarget {
  rootDir: string;
  workDir: string;
  head: string | null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseSegmentsJson(raw: string | null): AlignedTranslationSegment[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlignedTranslationSegment[]) : [];
  } catch {
    return [];
  }
}

function parseQaReport(raw: string | null): TranslationQaReport | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TranslationQaReport;
    return Array.isArray(parsed?.issues) ? parsed : null;
  } catch {
    return null;
  }
}

/** Counts reviewer issues of one severity (0 when the item was never reviewed). */
function countReviewIssues(
  report: ReturnType<typeof parseAiReviewReport>,
  severity: 'error' | 'warning',
): number {
  if (!report) return 0;
  return report.issues.filter((issue) => issue.severity === severity).length;
}

/**
 * Marks a stored Phase 16 report as stale without losing it: reviewer edits changed the proposal,
 * so the old AI/DITA-OT verdict no longer describes the current XML but is still worth showing.
 */
function markStale(raw: string | null): string | null {
  if (!raw) return raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return raw;
    return JSON.stringify({ ...parsed, stale: true });
  } catch {
    return raw;
  }
}

/** Tag-stripped text of a translated inner-XML fragment. */
function innerText(fragment: string, elementTag: string): string {
  const tag = elementTag || 'p';
  try {
    const parsed = parseXml(`<${tag}>${fragment}</${tag}>`, { position: false });
    const root = parsed.document.documentElement;
    return root ? extractPlainText(root) : fragment.replace(/<[^>]+>/g, ' ');
  } catch {
    return fragment.replace(/<[^>]+>/g, ' ');
  }
}

function toQaView(
  issues: readonly TranslationQaIssue[],
): TranslationSegmentReviewView['qaIssues'] {
  return issues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...(issue.termId === undefined ? {} : { termId: issue.termId }),
    ...(issue.sourceTerm === undefined ? {} : { sourceTerm: issue.sourceTerm }),
  }));
}

function toLockInfo(lock: LockView | null, user: IdentityUser): TranslationLockInfo | null {
  if (!lock) return null;
  return {
    userId: lock.userId,
    userName: lock.userName,
    lockedAt: lock.lockedAt,
    updatedAt: lock.updatedAt,
    isMine: lock.userId === user.id,
  };
}

function assertWriter(user: IdentityUser): void {
  if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
}

/** Item statuses that still represent a reviewable file (i.e. worth navigating to). */
const REVIEW_SIBLING_STATUSES: readonly TranslationItemStatus[] = [
  'ready_for_review',
  'in_review',
  'approved_draft',
  'checked_in',
];

export class ReviewApplyService {
  private readonly db: DitaDatabase;
  private readonly git: GitManager;
  private readonly registry: ManualRegistryService;
  private readonly locks: LockService;
  private readonly drafts: DraftService;
  private readonly links: TranslationLinkService;
  private readonly sync: IncrementalSyncService;
  private readonly glossaries: ReviewGlossaryService;
  private readonly translator: AiTranslationOrchestrator;
  private readonly ditaOtValidator: TranslationDitaOtValidator | null;
  private readonly identity: IdentityService;
  private readonly onTargetBaselineChanged?: ReviewApplyServiceOptions['onTargetBaselineChanged'];

  constructor(options: ReviewApplyServiceOptions) {
    this.db = options.db;
    this.git = options.git;
    this.registry = options.registry;
    this.locks = options.locks;
    this.drafts = options.drafts;
    this.links = options.links;
    this.sync = options.sync;
    this.glossaries = options.glossaries;
    this.translator = options.translator;
    this.ditaOtValidator = options.ditaOtValidator ?? null;
    this.identity = options.identity;
    this.onTargetBaselineChanged = options.onTargetBaselineChanged;
  }

  // ------------------------------------------------------------------ lookups

  private readItem(itemId: string): TranslationItemRow {
    const row = this.db
      .select()
      .from(translationItems)
      .where(eq(translationItems.id, itemId))
      .get();
    if (!row) throw httpError(404, 'translation.itemNotFound', { path: itemId });
    return row;
  }

  private async resolveWorkDir(manualId: string, branch: string, missingKey: 'translation.sourceManualMissing' | 'translation.targetManualMissing'): Promise<ResolvedTarget> {
    const row = await this.registry.requireRow(manualId).catch(() => {
      throw httpError(404, missingKey, { path: manualId });
    });
    const rootDir = path.resolve(row.rootDir);
    if (!existsSync(rootDir)) throw httpError(404, missingKey, { path: row.rootDir });
    if (!this.git.isRepository(rootDir)) {
      return { rootDir, workDir: rootDir, head: null };
    }
    const targetBranch = (branch ?? '').trim() || (await this.git.currentBranch(rootDir));
    const workDir = await this.git.ensureWorktree(rootDir, targetBranch, { createIfMissing: false });
    const head = await this.git.headCommit(workDir);
    return { rootDir, workDir, head };
  }

  private async resolveTarget(link: TranslationLinkRow): Promise<ResolvedTarget> {
    return await this.resolveWorkDir(
      link.targetManualId,
      link.targetBranch,
      'translation.targetManualMissing',
    );
  }

  private effectiveGlossary(link: TranslationLinkRow): GlossaryEntryForMatch[] {
    try {
      return toMatchEntries(
        this.glossaries.resolveEffectiveGlossary({
          manualId: link.sourceManualId,
          sourceLang: link.sourceLang,
          targetLang: link.targetLang,
        }).entries,
      );
    } catch {
      return [];
    }
  }

  private itemView(row: TranslationItemRow): TranslationItemView {
    const qa = parseQaReport(row.qaReportJson);
    const aiReview = parseAiReviewReport(row.aiReviewJson);
    const ditaOt = parseDitaOtItemReport(row.ditaOtReportJson);
    return {
      id: row.id,
      jobId: row.jobId,
      linkId: row.linkId,
      sourcePath: row.sourcePath,
      targetPath: row.targetPath,
      status: row.status as TranslationItemStatus,
      modeUsed: row.modeUsed,
      sourceCommit: row.sourceCommit,
      prevSourceCommit: row.prevSourceCommit,
      reviewerId: row.reviewerId,
      reusedSegments: row.reusedSegments,
      translatedSegments: row.translatedSegments,
      retryCount: row.retryCount,
      error: row.error,
      qaErrorCount: qa?.errorCount ?? 0,
      qaWarningCount: qa?.warningCount ?? 0,
      aiReviewVerdict: aiReview?.verdict ?? null,
      aiReviewErrorCount: countReviewIssues(aiReview, 'error'),
      aiReviewWarningCount: countReviewIssues(aiReview, 'warning'),
      qaRepairedCount: aiReview?.repairedSegments ?? 0,
      ditaOtStatus: ditaOt?.status ?? null,
      ditaOtErrorCount: ditaOt?.errorCount ?? 0,
      ditaOtWarningCount: ditaOt?.warningCount ?? 0,
      updatedAt: toIso(row.updatedAt),
    };
  }

  private linkPayload(link: TranslationLinkRow): TranslationReviewPayload['link'] {
    return {
      id: link.id,
      sourceManualId: link.sourceManualId,
      targetManualId: link.targetManualId,
      sourceBranch: link.sourceBranch,
      targetBranch: link.targetBranch,
      sourceLang: link.sourceLang,
      targetLang: link.targetLang,
    };
  }

  private currentLock(link: TranslationLinkRow, targetPath: string): LockView | null {
    try {
      return this.locks.find(link.targetManualId, link.targetBranch, targetPath);
    } catch {
      return null;
    }
  }

  /**
   * Live QA over the stored proposal. Re-running the deterministic gate on read keeps the review
   * pane honest even when a reviewer edited a block and the persisted report is one step behind.
   */
  private liveQa(
    segments: readonly AlignedTranslationSegment[],
    entries: readonly GlossaryEntryForMatch[],
  ): { report: TranslationQaReport; perSegment: Map<string, TranslationQaIssue[]> } {
    const inputs = [];
    for (const segment of segments) {
      const targetXml = segment.proposedTargetXml;
      if (targetXml === undefined) continue;
      inputs.push({
        segmentId: segment.segmentId,
        sourceXml: segment.currSourceXml,
        sourceText: segment.currSourceText,
        targetXml,
        targetText: segment.proposedTargetText ?? innerText(targetXml, segment.elementTag),
        ...(segment.protected ? { protected: true } : {}),
      });
    }
    const issues = runTranslationQa({ segments: inputs, glossary: [...entries] });
    const perSegment = new Map<string, TranslationQaIssue[]>();
    for (const issue of issues) {
      if (!issue.segmentId) continue;
      const bucket = perSegment.get(issue.segmentId) ?? [];
      bucket.push(issue);
      perSegment.set(issue.segmentId, bucket);
    }
    return { report: summarizeQaIssues(issues, inputs.length), perSegment };
  }

  private buildReviewPayload(
    item: TranslationItemRow,
    link: TranslationLinkRow,
    sourceXml: string,
    prevSourceXml: string | null,
    targetBaselineXml: string | null,
    user: IdentityUser,
  ): TranslationReviewPayload {
    const glossary = this.effectiveGlossary(link);
    const segments = parseSegmentsJson(item.segmentsJson);
    const { report, perSegment } = this.liveQa(segments, glossary);
    const lock = this.currentLock(link, item.targetPath);
    const siblings = this.listReviewSiblings(item.linkId, item, report);

    const segmentViews: TranslationSegmentReviewView[] = segments.map((segment) => {
      const hits: TranslationGlossaryHitView[] = matchGlossaryTerms(
        segment.currSourceText,
        glossary,
      ).map((hit) => ({
        termId: hit.entry.termId,
        sourceTerm: hit.entry.sourceTerm,
        targetTerm: hit.entry.targetTerm,
        matchedText: hit.matchedText,
        doNotTranslate: hit.entry.doNotTranslate,
        caseSensitive: hit.entry.caseSensitive,
        forbiddenTargets: [...(hit.entry.forbiddenTargets ?? [])],
        contextNote: hit.entry.contextNote ?? null,
      }));
      return {
        segmentId: segment.segmentId,
        elementTag: segment.elementTag,
        elementId: segment.elementId || null,
        structuralPath: segment.structuralPath,
        changeKind: segment.changeKind,
        protected: segment.protected,
        protectedReason: segment.protectedReason ?? null,
        attributeName: segment.attributeName ?? null,
        currSourceXml: segment.currSourceXml,
        sourceText: segment.currSourceText,
        prevSourceText: segment.prevSourceText ?? null,
        prevTargetText: segment.prevTargetText ?? null,
        proposedTargetXml: segment.proposedTargetXml ?? null,
        proposedTargetText: segment.proposedTargetText ?? null,
        glossaryHits: hits,
        qaIssues: toQaView(perSegment.get(segment.segmentId) ?? []),
      };
    });

    return {
      item: this.itemView(item),
      link: this.linkPayload(link),
      sourcePath: item.sourcePath,
      targetPath: item.targetPath,
      sourceXml,
      prevSourceXml,
      targetBaselineXml,
      proposedXml: item.proposedXml ?? '',
      segments: segmentViews,
      glossary,
      qaReport: report,
      aiReview: parseAiReviewReport(item.aiReviewJson),
      ditaOtReport: parseDitaOtItemReport(item.ditaOtReportJson),
      lock: toLockInfo(lock, user),
      canReview: user.role !== 'viewer',
      siblings,
    };
  }

  /**
   * Phase 16 review navigation — every reviewable file of the same link.
   *
   * Rows are read newest-first and de-duplicated by `sourcePath`, so a file re-translated several
   * times (one row per historical job) shows up exactly once, with the freshest status.
   * `currentItem` always wins for its own `sourcePath` and carries the live QA counts computed by
   * `buildReviewPayload`, which keeps the `n / m` header position stable and truthful.
   */
  private listReviewSiblings(
    linkId: string,
    currentItem: TranslationItemRow,
    currentQaReport?: TranslationQaReport,
  ): TranslationReviewSiblingView[] {
    const rows = this.db
      .select()
      .from(translationItems)
      .where(
        and(
          eq(translationItems.linkId, linkId),
          inArray(translationItems.status, [...REVIEW_SIBLING_STATUSES]),
        ),
      )
      .orderBy(desc(translationItems.updatedAt))
      .all();

    const bySourcePath = new Map<string, TranslationReviewSiblingView>();
    for (const row of rows) {
      if (bySourcePath.has(row.sourcePath)) continue;
      bySourcePath.set(row.sourcePath, this.reviewSiblingView(row));
    }

    // The current item is always present, even if its status is outside the reviewable set.
    bySourcePath.set(
      currentItem.sourcePath,
      this.reviewSiblingView(
        currentItem,
        currentQaReport ?? parseQaReport(currentItem.qaReportJson),
      ),
    );

    return [...bySourcePath.values()].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  }

  private reviewSiblingView(
    row: TranslationItemRow,
    qaReport: TranslationQaReport | null = parseQaReport(row.qaReportJson),
  ): TranslationReviewSiblingView {
    return {
      itemId: row.id,
      jobId: row.jobId,
      sourcePath: row.sourcePath,
      targetPath: row.targetPath,
      status: row.status as TranslationItemStatus,
      qaErrorCount: qaReport?.errorCount ?? 0,
      qaWarningCount: qaReport?.warningCount ?? 0,
    };
  }

  // ------------------------------------------------------------------ review

  /** Loads everything the bilingual review pane needs and opens the item for review. */
  async getReviewPayload(itemId: string, user: IdentityUser): Promise<TranslationReviewPayload> {
    const item = this.readItem(itemId);
    const link = readLinkRow(this.db, item.linkId);
    const source = await this.resolveWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const sourceXml =
      (await this.git.fileAtRevision(source.workDir, item.sourceCommit ?? 'HEAD', item.sourcePath)) ?? '';
    const prevSourceXml = item.prevSourceCommit
      ? await this.git.fileAtRevision(source.workDir, item.prevSourceCommit, item.sourcePath)
      : null;

    let targetBaselineXml: string | null = null;
    try {
      const target = await this.resolveTarget(link);
      targetBaselineXml = await this.git.fileAtRevision(target.workDir, 'HEAD', item.targetPath);
    } catch (error) {
      if (!isHttpError(error)) throw error;
    }

    if (item.status === 'ready_for_review' && user.role !== 'viewer') {
      this.db
        .update(translationItems)
        .set({ status: 'in_review', reviewerId: item.reviewerId ?? user.id, updatedAt: Date.now() })
        .where(eq(translationItems.id, item.id))
        .run();
      const refreshed = this.readItem(item.id);
      return this.buildReviewPayload(refreshed, link, sourceXml, prevSourceXml, targetBaselineXml, user);
    }

    return this.buildReviewPayload(item, link, sourceXml, prevSourceXml, targetBaselineXml, user);
  }

  /**
   * Persists reviewer edits. Block-level edits are re-assembled through the Phase 16 kernel, so a
   * broken block can never enter `proposed_xml`; a whole-file replacement is re-derived into
   * aligned segments again.
   */
  async saveReviewEdits(
    itemId: string,
    input: SaveReviewEditsInput,
    user: IdentityUser,
  ): Promise<TranslationReviewPayload> {
    assertWriter(user);
    const item = this.readItem(itemId);
    const link = readLinkRow(this.db, item.linkId);
    const source = await this.resolveWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const sourceXml =
      (await this.git.fileAtRevision(source.workDir, item.sourceCommit ?? 'HEAD', item.sourcePath)) ?? '';
    if (!sourceXml) throw httpError(409, 'translation.sourceMissing', { path: item.sourcePath });

    const glossary = this.effectiveGlossary(link);
    let segments = parseSegmentsJson(item.segmentsJson);
    let proposedXml = item.proposedXml ?? '';

    if (Array.isArray(input.segments) && input.segments.length > 0) {
      const edits = new Map<string, string>();
      for (const edit of input.segments) {
        if (typeof edit?.segmentId !== 'string' || typeof edit?.proposedTargetXml !== 'string') {
          throw httpError(400, 'translation.invalidParams', { field: 'segments' });
        }
        edits.set(edit.segmentId, edit.proposedTargetXml);
      }
      const known = new Set(segments.map((segment) => segment.segmentId));
      for (const segmentId of edits.keys()) {
        if (!known.has(segmentId)) {
          throw httpError(400, 'translation.segmentNotFound', { path: segmentId });
        }
      }
      segments = segments.map((segment) => {
        const next = edits.get(segment.segmentId);
        if (next === undefined) return segment;
        return {
          ...segment,
          proposedTargetXml: next,
          proposedTargetText: innerText(next, segment.elementTag),
        };
      });

      // Every segment with a target is re-supplied so unchanged blocks keep their human
      // translation. Keys are structural paths (with the leading slash `assembleTranslatedXml`
      // requires when no plan is supplied) because the stored segment ids are structural paths
      // too, and a plan is not persisted for a reviewed item. Attribute segments keep their own
      // `/@attrName` path, so they update the owning element's attribute instead of its children.
      const translatedSegments = new Map<string, string>();
      for (const segment of segments) {
        if (segment.proposedTargetXml !== undefined) {
          const path = segment.structuralPath.startsWith('/')
            ? segment.structuralPath
            : `/${segment.structuralPath}`;
          translatedSegments.set(path, segment.proposedTargetXml);
        }
      }
      const assembled = assembleTranslatedXml({
        sourceXml,
        targetLang: link.targetLang,
        translatedSegments,
        checkPm: true,
      });
      if (!assembled.ok) {
        throw httpError(400, 'translation.invalidTranslationXml', {
          path: item.sourcePath,
          reason: assembled.pmError ?? assembled.wellFormedError?.message ?? 'assemble failed',
        });
      }
      proposedXml = assembled.xml;
    } else if (typeof input.proposedXml === 'string') {
      const candidate = input.proposedXml;
      const wellFormed = checkXmlWellFormed(candidate, { position: false });
      if (!wellFormed.ok) {
        throw httpError(400, 'translation.invalidTranslationXml', {
          path: item.sourcePath,
          reason: wellFormed.error.message,
        });
      }
      const kind = classifyTranslationFileKind(item.targetPath);
      // Maps are not ProseMirror topics (their tree is edited in the map editor), so the visual
      // compatibility probe only applies to `.dita` topics — same rule as `assembleTranslatedXml`.
      if (kind === 'topic') {
        try {
          xmlToPmDoc(candidate, { position: false });
        } catch (error) {
          throw httpError(400, 'translation.invalidTranslationXml', {
            path: item.sourcePath,
            reason: describeError(error),
          });
        }
      }
      proposedXml = candidate;
      segments = this.realignSegments(segments, candidate);
    } else {
      throw httpError(400, 'translation.invalidParams', { field: 'segments' });
    }

    const { report } = this.liveQa(segments, glossary);
    const now = Date.now();
    this.db
      .update(translationItems)
      .set({
        proposedXml,
        segmentsJson: JSON.stringify(segments),
        qaReportJson: JSON.stringify(report),
        // Phase 16: reviewer edits invalidate the AI verdict and the DITA-OT verdict, but never
        // erase them — the review pane still shows what the reviewer said about the old proposal.
        aiReviewJson: markStale(item.aiReviewJson),
        ditaOtReportJson: markStale(item.ditaOtReportJson),
        status: 'in_review',
        reviewerId: item.reviewerId ?? user.id,
        error: null,
        updatedAt: now,
      })
      .where(eq(translationItems.id, item.id))
      .run();

    // The matrix row is what the Translation Center shows: once the proposal has newer reviewer
    // edits it is no longer "draft ready", so the file row has to follow the item back to review.
    this.db
      .update(translationFileStates)
      .set({ status: 'in_review', updatedAt: now })
      .where(
        and(
          eq(translationFileStates.linkId, item.linkId),
          eq(translationFileStates.sourcePath, item.sourcePath),
        ),
      )
      .run();

    return await this.getReviewPayload(item.id, user);
  }

  /** Re-derives aligned segments from a whole-file replacement (structure-preserving lookup). */
  private realignSegments(
    stored: readonly AlignedTranslationSegment[],
    proposedXml: string,
  ): AlignedTranslationSegment[] {
    let targetSegments: ReturnType<typeof extractTranslatableSegments> = [];
    try {
      targetSegments = extractTranslatableSegments(proposedXml);
    } catch {
      return [...stored];
    }
    const byPath = new Map(targetSegments.map((segment) => [segment.structuralPath, segment] as const));
    return stored.map((segment) => {
      const target = byPath.get(segment.structuralPath);
      if (!target) return { ...segment, proposedTargetXml: undefined, proposedTargetText: undefined };
      return {
        ...segment,
        proposedTargetXml: target.innerXml,
        proposedTargetText: target.plainText,
      };
    });
  }

  /** Single-block AI refinement; nothing is persisted until the reviewer saves. */
  async refineReviewSegment(
    itemId: string,
    input: RefineTranslationSegmentInput,
    user: IdentityUser,
  ): Promise<RefineTranslationSegmentResult> {
    assertWriter(user);
    const item = this.readItem(itemId);
    const link = readLinkRow(this.db, item.linkId);
    const segments = parseSegmentsJson(item.segmentsJson);
    const segment = segments.find((entry) => entry.segmentId === input.segmentId);
    if (!segment) throw httpError(404, 'translation.segmentNotFound', { path: input.segmentId });
    if (!input.instruction || !input.instruction.trim()) {
      throw httpError(400, 'translation.invalidParams', { field: 'instruction' });
    }

    const refined = await this.translator.refineSegment({
      link,
      sourcePath: item.sourcePath,
      segment,
      instruction: input.instruction.trim(),
      currentTargetXml:
        input.currentTargetXml ?? segment.proposedTargetXml ?? null,
      user,
    });

    return {
      segmentId: refined.segmentId,
      proposedTargetXml: refined.proposedTargetXml,
      proposedTargetText: refined.proposedTargetText,
      qaIssues: refined.qaIssues,
    };
  }

  // --------------------------------------------------------------- apply/checkin

  /**
   * Moves one approved proposal into the caller's Draft Overlay.
   *
   * The shared target `workDir` stays clean at `HEAD`: the lock is taken through the regular
   * `LockService.checkout` (a lock held by somebody else is a `409`, never stolen) and the XML is
   * written to `working_drafts` only.
   */
  async applyToDraft(itemId: string, user: IdentityUser): Promise<ApplyTranslationDraftResult> {
    assertWriter(user);
    const item = this.readItem(itemId);
    if (!item.proposedXml || item.proposedXml.trim().length === 0) {
      throw httpError(409, 'translation.noProposal', { path: item.sourcePath });
    }
    const wellFormed = checkXmlWellFormed(item.proposedXml, { position: false });
    if (!wellFormed.ok) {
      throw httpError(400, 'translation.invalidTranslationXml', {
        path: item.sourcePath,
        reason: wellFormed.error.message,
      });
    }

    const link = readLinkRow(this.db, item.linkId);
    const target = await this.resolveTarget(link);
    const existing = await this.git.fileAtRevision(target.workDir, 'HEAD', item.targetPath);

    // No-op guard: re-running a job on a file that is already translated can produce exactly the
    // bytes the target branch already holds. Writing a draft for it would flip the file to
    // `draft_ready` while materializing it changes nothing, so the later check-in would die on
    // `git.noCommitChanges` and re-lock the overlay forever. Record it as already in the baseline
    // instead: item `checked_in`, file state `synced`, no draft, no lock.
    if (existing !== null && existing === item.proposedXml) {
      // A draft left over from an earlier apply holds a lock and pins the file to `draft_ready`
      // even though it would stage nothing; drop it so the state can fall back to `synced`.
      const stale = this.drafts.getUserDraft(
        link.targetManualId,
        link.targetBranch,
        user.id,
        item.targetPath,
      );
      if (stale) {
        try {
          await this.locks.cancelCheckout({
            workDir: target.workDir,
            projectId: link.targetManualId,
            branch: link.targetBranch,
            filePath: item.targetPath,
            user,
          });
        } catch {
          // No own lock on the path any more: forgetting the draft row is enough.
          this.drafts.deleteUserDraft(
            link.targetManualId,
            link.targetBranch,
            user.id,
            item.targetPath,
          );
        }
      }
      const now = Date.now();
      this.db
        .update(translationItems)
        .set({ status: 'checked_in', error: null, updatedAt: now })
        .where(eq(translationItems.id, item.id))
        .run();
      await this.onTargetCheckinCommitted({
        manualId: link.targetManualId,
        branch: link.targetBranch,
        paths: [item.targetPath],
        userId: user.id,
      });
      return {
        item: this.itemView(this.readItem(item.id)),
        draft: null,
        lock: null,
        alreadyApplied: true,
      };
    }

    const lock = await this.locks.checkout({
      workDir: target.workDir,
      projectRootDir: target.rootDir,
      filePath: item.targetPath,
      user,
      allowMissing: existing === null,
    });

    const draft = this.drafts.upsertTextDraft({
      projectId: link.targetManualId,
      branch: link.targetBranch,
      filePath: item.targetPath,
      userId: user.id,
      op: existing === null ? 'create' : 'edit',
      content: item.proposedXml,
      baseCommit: target.head,
    });

    const now = Date.now();
    this.db
      .update(translationItems)
      .set({ status: 'approved_draft', reviewerId: item.reviewerId ?? user.id, updatedAt: now })
      .where(eq(translationItems.id, item.id))
      .run();
    this.db
      .update(translationFileStates)
      .set({ status: 'draft_ready', updatedAt: now })
      .where(
        and(
          eq(translationFileStates.linkId, item.linkId),
          eq(translationFileStates.sourcePath, item.sourcePath),
        ),
      )
      .run();

    const refreshed = this.readItem(item.id);
    return {
      item: this.itemView(refreshed),
      draft: {
        filePath: draft.filePath,
        op: draft.op,
        baseCommit: draft.baseCommit,
        updatedAt: toIso(draft.updatedAt),
      },
      lock: toLockInfo(lock, user) ?? {
        userId: user.id,
        userName: user.displayName,
        lockedAt: null,
        updatedAt: null,
        isMine: true,
      },
    };
  }

  /**
   * Bulk variant of `applyToDraft`: writes every selected reviewable proposal into the caller's
   * Draft Overlay (`working_drafts` + `file_locks`), leaving the shared target `workDir` at `HEAD`.
   *
   * Boundaries are enforced per item, never per batch: a file locked by somebody else is reported
   * back in `skippedLocked` instead of aborting the run or stealing the lock, an item without a
   * proposal lands in `skippedNoProposal`, and a malformed proposal lands in `skippedInvalid` so the
   * caller can still check in everything that did apply.
   */
  async batchApplyDrafts(
    linkId: string,
    input: BatchApplyDraftInput,
    user: IdentityUser,
    locale: ApiLocale = 'zh-CN',
  ): Promise<BatchApplyDraftResult> {
    assertWriter(user);
    const link = readLinkRow(this.db, linkId);
    const result: BatchApplyDraftResult = {
      applied: [],
      skippedLocked: [],
      skippedInvalid: [],
      skippedNoProposal: [],
    };

    const rows = this.db
      .select()
      .from(translationItems)
      .where(
        and(
          eq(translationItems.linkId, link.id),
          inArray(translationItems.status, ['ready_for_review', 'in_review'] as const),
        ),
      )
      .orderBy(desc(translationItems.updatedAt))
      .all();

    // Newest item per source file wins: an earlier job's proposal is historical, never "current".
    const latest = new Map<string, TranslationItemRow>();
    for (const row of rows) {
      if (!latest.has(row.sourcePath)) latest.set(row.sourcePath, row);
    }

    const normalize = (value: string): string => value.replace(/\\/g, '/').trim();
    const requestedPaths = [...new Set((input.paths ?? []).map(normalize).filter(Boolean))];
    const requestedItemIds = new Set((input.itemIds ?? []).map((entry) => String(entry)));
    const matchByPaths = requestedItemIds.size === 0 && requestedPaths.length > 0;

    const candidates: TranslationItemRow[] = [];
    const satisfiedPaths = new Set<string>();
    for (const row of latest.values()) {
      const sourcePath = normalize(row.sourcePath);
      const targetPath = normalize(row.targetPath);
      if (requestedItemIds.size > 0) {
        if (!requestedItemIds.has(row.id)) continue;
      } else if (matchByPaths) {
        if (!requestedPaths.includes(sourcePath) && !requestedPaths.includes(targetPath)) continue;
      }
      if (!row.proposedXml || row.proposedXml.trim().length === 0) continue;
      if (matchByPaths) {
        if (requestedPaths.includes(sourcePath)) satisfiedPaths.add(sourcePath);
        if (requestedPaths.includes(targetPath)) satisfiedPaths.add(targetPath);
      }
      candidates.push(row);
    }

    // Phase 16 `qaStrict`: only apply proposals whose QA, AI review and DITA-OT verdicts are clean.
    const qaStrict = parseLinkOptions(link.optionsJson).qaStrict;
    const strictGlossary = qaStrict ? this.effectiveGlossary(link) : [];

    for (const item of candidates) {
      if (qaStrict) {
        const blockers = this.strictBlockers(item, strictGlossary);
        if (blockers) {
          result.skippedInvalid.push({
            path: item.targetPath,
            itemId: item.id,
            reason: apiT(locale, 'translation.qaStrictBlocked', {
              path: item.targetPath,
              qa: blockers.qa,
              review: blockers.review,
              ditaOt: blockers.ditaOt,
            }),
          });
          if (matchByPaths) {
            if (requestedPaths.includes(normalize(item.sourcePath))) {
              satisfiedPaths.add(normalize(item.sourcePath));
            }
            if (requestedPaths.includes(normalize(item.targetPath))) {
              satisfiedPaths.add(normalize(item.targetPath));
            }
          }
          continue;
        }
      }
      try {
        const applied = await this.applyToDraft(item.id, user);
        result.applied.push({
          itemId: applied.item.id,
          sourcePath: item.sourcePath,
          targetPath: item.targetPath,
        });
      } catch (error) {
        if (!isHttpError(error)) throw error;
        if (error.statusCode === 409) {
          if (error.i18n?.key === 'translation.noProposal') {
            result.skippedNoProposal.push(item.sourcePath);
            continue;
          }
          result.skippedLocked.push({
            path: item.targetPath,
            itemId: item.id,
            reason: error.message,
          });
          continue;
        }
        if (error.statusCode === 400) {
          result.skippedInvalid.push({
            path: item.sourcePath,
            itemId: item.id,
            reason: error.message,
          });
          continue;
        }
        throw error;
      }
    }

    // A requested path that never met a reviewable proposal is reported, not silently dropped.
    if (matchByPaths) {
      for (const requestedPath of requestedPaths) {
        if (satisfiedPaths.has(requestedPath)) continue;
        if (result.skippedNoProposal.includes(requestedPath)) continue;
        result.skippedNoProposal.push(requestedPath);
      }
    }

    return result;
  }

  /**
   * Counts the unresolved blocking errors of one proposal for the `qaStrict` gate.
   *
   * Live deterministic QA is re-run (the stored report can lag behind reviewer block edits); the AI
   * review and the DITA-OT report only count while they are not `stale`.
   */
  private strictBlockers(
    item: TranslationItemRow,
    glossary: readonly GlossaryEntryForMatch[],
  ): { qa: number; review: number; ditaOt: number } | null {
    const segments = parseSegmentsJson(item.segmentsJson);
    const qaErrors = this.liveQa(segments, glossary).report.errorCount;
    const aiReview = parseAiReviewReport(item.aiReviewJson);
    const reviewErrors =
      aiReview && aiReview.stale !== true ? countReviewIssues(aiReview, 'error') : 0;
    const ditaOt = parseDitaOtItemReport(item.ditaOtReportJson);
    const ditaOtErrors =
      ditaOt && ditaOt.stale !== true && ditaOt.status === 'failed' ? ditaOt.errorCount : 0;
    if (qaErrors + reviewErrors + ditaOtErrors === 0) return null;
    return { qa: qaErrors, review: reviewErrors, ditaOt: ditaOtErrors };
  }

  /**
   * Phase 16 — DITA-OT strict validation for a single item from the review pane.
   *
   * Runs in an isolated staging tree (see `TranslationDitaOtValidator`), so the shared `workDir`
   * stays at `HEAD`; the verdict is persisted on the item with `stale: false`.
   */
  async validateItemStrict(
    itemId: string,
    user: IdentityUser,
    locale: ApiLocale = 'zh-CN',
  ): Promise<{ item: TranslationItemView; ditaOtReport: TranslationDitaOtItemReport }> {
    assertWriter(user);
    const item = this.readItem(itemId);
    const link = readLinkRow(this.db, item.linkId);
    const target = await this.resolveTarget(link);
    const source = await this.resolveWorkDir(
      link.sourceManualId,
      link.sourceBranch,
      'translation.sourceManualMissing',
    );
    const sourceXml = this.readSourceXml(source.workDir, item.sourcePath);
    const report = this.ditaOtValidator
      ? (
          await this.ditaOtValidator.validateSingleItem({
            link,
            userId: user.id,
            sourceWorkDir: source.workDir,
            targetWorkDir: target.workDir,
            item: {
              itemId: item.id,
              targetPath: item.targetPath,
              proposedXml: item.proposedXml ?? '',
              segmentsJson: item.segmentsJson,
              ...(sourceXml ? { sourceXml } : {}),
            },
            locale,
          })
        ).report
      : {
          status: 'skipped' as const,
          repaired: false,
          repairAttempts: 0,
          errorCount: 0,
          warningCount: 0,
          diagnostics: [],
          reason: apiT(locale, 'translation.ditaOtUnavailable'),
          stale: false,
          updatedAt: toIso(Date.now()),
        };

    this.db
      .update(translationItems)
      .set({ ditaOtReportJson: JSON.stringify(report), updatedAt: Date.now() })
      .where(eq(translationItems.id, item.id))
      .run();
    return { item: this.itemView(this.readItem(item.id)), ditaOtReport: report };
  }

  private readSourceXml(workDir: string, sourcePath: string): string | null {
    try {
      return readFileSync(path.join(workDir, sourcePath), 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * Commits several approved drafts of one link in a single atomic check-in, reusing the Phase 13
   * commit path (validation gates, lock release, audit) instead of a bespoke commit.
   */
  async batchCheckin(
    linkId: string,
    input: BatchCheckinInput,
    user: IdentityUser,
  ): Promise<BatchCheckinResult> {
    assertWriter(user);
    const link = readLinkRow(this.db, linkId);
    const target = await this.resolveTarget(link);
    const message = (input.message ?? '').trim();
    if (!message) throw httpError(400, 'translation.invalidParams', { field: 'message' });

    const requestedPaths = new Set(
      (input.paths ?? []).map((entry) => String(entry).replace(/\\/g, '/').trim()).filter(Boolean),
    );
    const requestedItemIds = new Set(input.itemIds ?? []);

    const candidates = this.db
      .select()
      .from(translationItems)
      .where(
        and(
          eq(translationItems.linkId, link.id),
          eq(translationItems.status, 'approved_draft'),
        ),
      )
      .all()
      .filter((item) => {
        if (requestedItemIds.size > 0) return requestedItemIds.has(item.id);
        return true;
      })
      .filter((item) => (requestedPaths.size > 0 ? requestedPaths.has(item.targetPath) : true));

    const paths: string[] = [];
    for (const item of candidates) {
      if (!paths.includes(item.targetPath)) paths.push(item.targetPath);
    }

    // Phase 16 §5.1.2: non-translatable work (synced assets, `.ditaval` passthrough copies, staged
    // deletes) never produces a `translation_items` row, so a `draft_ready` file state whose draft
    // lives in the caller's overlay is equally checkin-able. An explicit `itemIds` selection still
    // wins, and `paths` narrows the extra states just like it narrows the items above.
    if (requestedItemIds.size === 0) {
      const draftReady = this.db
        .select()
        .from(translationFileStates)
        .where(
          and(
            eq(translationFileStates.linkId, link.id),
            eq(translationFileStates.status, 'draft_ready'),
          ),
        )
        .all()
        .filter((state) => (requestedPaths.size > 0 ? requestedPaths.has(state.targetPath) : true));
      for (const state of draftReady) {
        if (!paths.includes(state.targetPath)) paths.push(state.targetPath);
      }
    }

    if (paths.length === 0) throw httpError(400, 'translation.nothingToCheckin', { path: linkId });

    // Only the caller's own drafts may be committed; a foreign draft means "not applied yet".
    // `link.targetManualId` is also the project id used by `syncAssetsToDrafts()` /
    // `syncPassthroughToDrafts()` (`locks.projectIdForManual()` returns the manual id), so asset,
    // ditaval and topic drafts are looked up under one and the same key.
    const owned: string[] = [];
    const alreadyApplied: string[] = [];
    const foreignOwners: string[] = [];
    let foreignCount = 0;
    for (const filePath of paths) {
      const mine = this.drafts.getUserDraft(
        link.targetManualId,
        link.targetBranch,
        user.id,
        filePath,
      );
      if (mine) {
        if (await this.isNoopDraft(target.workDir, mine)) {
          alreadyApplied.push(filePath);
          continue;
        }
        owned.push(filePath);
        continue;
      }
      // Not mine — if somebody else holds the draft this is an ownership problem (409), not an
      // empty selection. Reporting the owner's name is what lets the user switch identity.
      const foreign = this.drafts.getDraft(link.targetManualId, link.targetBranch, filePath);
      if (foreign && foreign.userId !== user.id) {
        foreignCount += 1;
        const name = this.identity.get(foreign.userId)?.displayName ?? foreign.userId;
        if (!foreignOwners.includes(name)) foreignOwners.push(name);
      }
    }

    // A draft whose text is byte-identical to `HEAD` (a re-translation of an already checked-in
    // file) would stage nothing and abort the whole batch on `git.noCommitChanges`. Drop those
    // drafts and their locks and close them as `synced` instead of committing nothing.
    let alreadySyncedFiles: string[] = [];
    if (alreadyApplied.length > 0) {
      for (const filePath of alreadyApplied) {
        try {
          await this.locks.cancelCheckout({
            workDir: target.workDir,
            projectId: link.targetManualId,
            branch: link.targetBranch,
            filePath,
            user,
          });
        } catch {
          // No own lock left on this path: the draft is already gone with it.
        }
      }
      const closed = await this.onTargetCheckinCommitted({
        manualId: link.targetManualId,
        branch: link.targetBranch,
        paths: alreadyApplied,
        userId: user.id,
      });
      alreadySyncedFiles = closed.syncedFiles;
    }

    if (owned.length === 0) {
      if (foreignCount > 0) {
        const owners = foreignOwners.join('、');
        throw httpError(
          409,
          'translation.draftOwnedByOther',
          { owners, count: foreignCount },
          { owners, count: foreignCount },
        );
      }
      if (alreadyApplied.length > 0) {
        return {
          commit: null,
          checkedInPaths: [],
          syncedFiles: alreadySyncedFiles,
          alreadySyncedPaths: alreadyApplied,
        };
      }
      throw httpError(400, 'translation.nothingToCheckin', { path: linkId });
    }

    const result = await this.locks.checkin({
      workDir: target.workDir,
      projectRootDir: target.rootDir,
      paths: owned,
      message,
      user,
    });

    if (this.onTargetBaselineChanged) {
      try {
        await this.onTargetBaselineChanged({
          manualId: link.targetManualId,
          branch: link.targetBranch,
          user,
          paths: owned,
          commit: result.commit,
        });
      } catch (error) {
        // A cache/index refresh problem must never undo a committed Git check-in.
        void error;
      }
    }

    const sync = await this.onTargetCheckinCommitted({
      manualId: link.targetManualId,
      branch: link.targetBranch,
      paths: owned,
      userId: user.id,
    });

    return {
      commit: {
        hash: result.commit.hash,
        shortHash: result.commit.shortHash,
        message: result.commit.message,
        author: result.commit.authorName,
        date: result.commit.date,
      },
      checkedInPaths: owned,
      syncedFiles: [...new Set([...alreadySyncedFiles, ...sync.syncedFiles])],
      ...(alreadyApplied.length > 0 ? { alreadySyncedPaths: alreadyApplied } : {}),
    };
  }

  /**
   * True when materializing `draft` would leave the target branch untouched: the stored text is
   * byte-identical to the blob at `HEAD`. Binary drafts, deletions and text-less rows are always
   * real changes, so they never qualify.
   */
  private async isNoopDraft(workDir: string, draft: WorkingDraftRow): Promise<boolean> {
    if (draft.op === 'delete' || draft.assetBlobPath || draft.content === null) return false;
    const baseline = await this.git.fileAtRevision(workDir, 'HEAD', draft.filePath);
    return baseline !== null && baseline === draft.content;
  }

  /**
   * Watermark sync after any target check-in (manual `POST /api/locks/checkin` or `batchCheckin`).
   *
   * Deliberately defensive: a translation bookkeeping failure must never turn a successful Git
   * commit into an error for the caller.
   */
  async onTargetCheckinCommitted(input: {
    manualId: string;
    branch: string;
    paths: string[];
    userId?: string;
  }): Promise<{ syncedFiles: string[]; checkedInItems: number }> {
    const result = { syncedFiles: [] as string[], checkedInItems: 0 };
    try {
      const links = this.db
        .select()
        .from(translationLinks)
        .where(
          and(
            eq(translationLinks.targetManualId, input.manualId),
            eq(translationLinks.targetBranch, input.branch),
          ),
        )
        .all();
      // Phase 16 Q4: a root manual has no incoming link, but it still owns outgoing links.
      // Never short-circuit here — the downstream rescan below must run for every check-in.

      const pathSet = new Set(input.paths.map((entry) => entry.replace(/\\/g, '/').trim()));
      const now = Date.now();

      for (const link of links) {
        const states = this.db
          .select()
          .from(translationFileStates)
          .where(eq(translationFileStates.linkId, link.id))
          .all()
          .filter((state) => pathSet.has(state.targetPath) || pathSet.has(state.sourcePath));
        if (states.length === 0) continue;

        const target = await this.resolveTarget(link);
        const targetHead = target.head;
        const targetHashes = new Map(
          (await this.git.listTreeFiles(target.workDir, 'HEAD')).map((file) => [file.path, file.blobHash]),
        );
        let sourceHashes: Map<string, string> | null = null;
        let sourceHead: string | null = null;
        let sourceWorkDir: string | null = null;
        try {
          const source = await this.resolveWorkDir(
            link.sourceManualId,
            link.sourceBranch,
            'translation.sourceManualMissing',
          );
          sourceWorkDir = source.workDir;
          sourceHead = source.head;
          sourceHashes = new Map(
            (await this.git.listTreeFiles(source.workDir, 'HEAD')).map((file) => [
              file.path,
              file.blobHash,
            ]),
          );
        } catch {
          sourceHashes = null;
        }

        for (const state of states) {
          const items = this.db
            .select()
            .from(translationItems)
            .where(
              and(
                eq(translationItems.linkId, link.id),
                eq(translationItems.targetPath, state.targetPath),
                eq(translationItems.status, 'approved_draft'),
              ),
            )
            .all();

          let lastSourceCommit = state.lastSourceCommit ?? sourceHead;
          for (const item of items) {
            this.db
              .update(translationItems)
              .set({ status: 'checked_in', error: null, updatedAt: now })
              .where(eq(translationItems.id, item.id))
              .run();
            result.checkedInItems += 1;
            lastSourceCommit = item.sourceCommit ?? lastSourceCommit;
          }

          let fingerprint: string | null = state.lastSourceTranslatableHash;
          // Only XML kinds have translatable segments; a binary asset (PNG, SVG, …) would make the
          // DITA parser throw and abort the whole watermark pass (§5.1 closed loop for assets).
          const isXmlKind =
            state.fileKind === 'topic' ||
            state.fileKind === 'map' ||
            state.fileKind === 'keydef_map';
          if (sourceWorkDir && isXmlKind) {
            const content = await this.git.fileAtRevision(
              sourceWorkDir,
              lastSourceCommit ?? 'HEAD',
              state.sourcePath,
            );
            fingerprint = content ? computeTranslatableDocumentFingerprint(content) : null;
          }

          const sourceBlob = sourceHashes?.get(state.sourcePath) ?? null;
          const restoredAsset =
            state.fileKind === 'asset' &&
            sourceBlob !== null &&
            targetHashes.get(state.targetPath) === sourceBlob;

          // Phase 16 §5.1.2: the source file is gone and the target deletion has been committed —
          // drop the bookkeeping row instead of leaving a zombie `synced` entry behind.
          if (
            sourceHashes !== null &&
            !sourceHashes.has(state.sourcePath) &&
            !targetHashes.has(state.targetPath)
          ) {
            this.db.delete(translationFileStates).where(eq(translationFileStates.id, state.id)).run();
            if (!result.syncedFiles.includes(state.sourcePath)) {
              result.syncedFiles.push(state.sourcePath);
            }
            continue;
          }

          this.db
            .update(translationFileStates)
            .set({
              status: 'synced',
              lastSourceCommit,
              lastSourceBlobHash: sourceHashes?.get(state.sourcePath) ?? state.lastSourceBlobHash,
              lastSourceTranslatableHash: fingerprint ?? state.lastSourceTranslatableHash,
              lastTargetCommit: targetHead,
              lastTargetBlobHash: targetHashes.get(state.targetPath) ?? state.lastTargetBlobHash,
              renamedFromPath: null,
              // A checked-in image that matches the source again is no longer a local override.
              ...(restoredAsset ? { localizedAssetOverride: 0 } : {}),
              updatedAt: now,
            })
            .where(eq(translationFileStates.id, state.id))
            .run();

          if (!result.syncedFiles.includes(state.sourcePath)) {
            result.syncedFiles.push(state.sourcePath);
          }
        }
      }

      // Phase 16 Q4 — the committed manual may itself be a translation source (an intermediate
      // hub language such as `en-US` inside `zh-CN → en-US → ar-SA`). Rescan its direct outgoing
      // links so their children flip to `outdated` immediately, without any manual "scan" click
      // and **without** enqueueing any AI translation job.
      try {
        const outLinks = this.db
          .select()
          .from(translationLinks)
          .where(
            and(
              eq(translationLinks.sourceManualId, input.manualId),
              eq(translationLinks.sourceBranch, input.branch),
            ),
          )
          .all();
        for (const outLink of outLinks) {
          await this.sync.scanLink(outLink.id).catch(() => undefined);
        }
      } catch (error) {
        // A rescan failure must never surface to a caller whose Git commit already succeeded.
        void error;
      }
    } catch (error) {
      // Never surface watermark problems to a caller whose Git commit already succeeded.
      void error;
    }
    return result;
  }

  /** Exposed for routes so a review response can include the link's own counters. */
  readLink(linkId: string): TranslationLinkRow {
    return readLinkRow(this.db, linkId);
  }

  /** Identity lookup used by the assign route to validate a reviewer id. */
  findUser(userId: string): IdentityUser | undefined {
    return this.identity.get(userId);
  }

  /** Test-only hook: the sync service counts used by route-level assertions. */
  countSyncedFiles(linkId: string): number {
    return this.sync.countLinkFiles(linkId).synced ?? 0;
  }
}
