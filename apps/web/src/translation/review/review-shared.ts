/**
 * Shared vocabulary for the bilingual review views.
 *
 * Every view (side by side, stacked, focus reading, XML diff) receives the same row state so a
 * reviewer can switch layouts without losing drafts, filters, refinement previews or the active
 * segment.
 */
import type { TranslationQaIssue } from '@dita/core';
import type { MessageKey, MessageParams } from '../../i18n/index.js';
import type {
  RefineTranslationSegmentResult,
  TranslationAiReviewCategory,
  TranslationAiReviewReport,
  TranslationDitaOtStatus,
  TranslationItemStatus,
  TranslationSegmentReviewView,
} from '../../services/translation-api.js';
import type { SegmentInsertRequest } from './RichInlineSegmentEditor.js';
import type { MissingInlineTag } from './segment-xml-utils.js';

export type ReviewViewMode = 'sideBySide' | 'stacked' | 'hoverReading' | 'xmlDiff';

export type SegmentFilter = 'all' | 'changed' | 'qa' | 'edited';

export type Translator = (key: MessageKey, params?: MessageParams) => string;

export interface RefineState {
  segmentId: string | null;
  instruction: string;
  preview: RefineTranslationSegmentResult | null;
  busy: boolean;
}

export const CHANGE_TONE: Record<string, string> = {
  unchanged: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  modified: 'border-amber-200 bg-amber-50 text-amber-700',
  added: 'border-blue-200 bg-blue-50 text-blue-700',
  protected: 'border-slate-300 bg-slate-100 text-slate-600',
  deleted: 'border-rose-200 bg-rose-50 text-rose-700',
};

export const ITEM_TONE: Record<string, string> = {
  queued: 'border-slate-200 bg-slate-50 text-slate-600',
  ai_translating: 'border-blue-200 bg-blue-50 text-blue-700',
  ai_reviewing: 'border-sky-200 bg-sky-50 text-sky-700',
  validating: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  ready_for_review: 'border-violet-200 bg-violet-50 text-violet-700',
  in_review: 'border-violet-300 bg-violet-100 text-violet-800',
  approved_draft: 'border-teal-200 bg-teal-50 text-teal-700',
  checked_in: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-slate-200 bg-white text-slate-500',
};

/** A file still needs work until its translation is checked in. */
export function isPendingStatus(status: TranslationItemStatus): boolean {
  return status !== 'checked_in';
}

/**
 * Phase 16 gate vocabulary, shared so the header pills and the inspector cards can never drift.
 */
export const AI_VERDICT_KEYS: Record<TranslationAiReviewReport['verdict'], MessageKey> = {
  pass: 'translation.aiReview.verdict.pass',
  revise: 'translation.aiReview.verdict.revise',
  skipped: 'translation.aiReview.verdict.skipped',
  error: 'translation.aiReview.verdict.error',
};

export const AI_REVIEW_CATEGORY_KEYS: Record<TranslationAiReviewCategory, MessageKey> = {
  accuracy: 'translation.review.aiReviewCategory.accuracy',
  omission: 'translation.review.aiReviewCategory.omission',
  terminology: 'translation.review.aiReviewCategory.terminology',
  markup: 'translation.review.aiReviewCategory.markup',
  style: 'translation.review.aiReviewCategory.style',
  qa_violation: 'translation.review.aiReviewCategory.qa_violation',
};

export const DITAOT_STATUS_KEYS: Record<TranslationDitaOtStatus, MessageKey> = {
  passed: 'translation.ditaOt.status.passed',
  failed: 'translation.ditaOt.status.failed',
  skipped: 'translation.ditaOt.status.skipped',
};

export function issuesForSegment(
  issues: TranslationQaIssue[],
  segmentId: string,
): TranslationQaIssue[] {
  return issues.filter((issue) => issue.segmentId === segmentId);
}

export function segmentIssueCounts(issues: TranslationQaIssue[]): {
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === 'error') errors += 1;
    else warnings += 1;
  }
  return { errors, warnings };
}

export interface SegmentListProps {
  t: Translator;
  segments: TranslationSegmentReviewView[];
  drafts: Record<string, string>;
  dirtySegments: Set<string>;
  issues: TranslationQaIssue[];
  editable: boolean;
  showTags: boolean;
  activeSegmentId: string | null;
  editingSegmentId: string | null;
  missingTagsFor: (segment: TranslationSegmentReviewView) => MissingInlineTag[];
  insertRequest: SegmentInsertRequest | null;
  refine: RefineState;
  onStartEditing: (segmentId: string) => void;
  onStopEditing: () => void;
  /** Open a segment straight in raw XML mode (row action, QA repair, mode switch). */
  onEditXml: (segmentId: string) => void;
  /** Append a glossary target term to a segment draft (row toolbar and QA repair). */
  onInsertGlossaryTerm: (segmentId: string, text: string) => void;
  onDraftChange: (segmentId: string, innerXml: string) => void;
  onOpenRefine: (segmentId: string) => void;
  onCloseRefine: () => void;
  onInstructionChange: (value: string) => void;
  onRunRefine: () => void;
  onApplyRefine: () => void;
}
