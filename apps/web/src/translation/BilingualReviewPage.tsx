/**
 * Bilingual review workbench.
 *
 * The page owns *state* only (buffers, dirty sets, view preferences, navigation guards) and hands
 * rendering to the small components in `./review/`. Every layout shows the same underlying data, so
 * switching views never risks losing an edit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  extractPlainText,
  runTranslationQa,
  type TranslationQaIssue,
} from '@dita/core';
import { useI18n, type MessageKey } from '../i18n/index.js';
import {
  bilingualReviewPath,
  editorPath,
  navigate,
  translationCenterPath,
} from '../router/app-router.js';
import type {
  ApplyTranslationDraftResult,
  RefineTranslationSegmentResult,
  TranslationItemStatus,
  TranslationGlossaryHitView,
  TranslationReviewSiblingView,
  TranslationSegmentReviewView,
} from '../services/translation-api.js';
import { useGitStore } from '../store/git-store';
import { useTranslationStore } from '../store/translation-store.js';
import { HoverReadingView } from './review/HoverReadingView.js';
import { ReviewHeader } from './review/ReviewHeader.js';
import { ReviewInspectorPanel } from './review/ReviewInspectorPanel.js';
import { SegmentFilterBar } from './review/SegmentFilterBar.js';
import { SideBySideView } from './review/SideBySideView.js';
import { StackedBilingualView } from './review/StackedBilingualView.js';
import { XmlDiffView } from './review/XmlDiffView.js';
import type { RefineState, ReviewViewMode, SegmentFilter } from './review/review-shared.js';
import type { SegmentInsertRequest } from './review/RichInlineSegmentEditor.js';
import type { MissingInlineTag } from './review/segment-xml-utils.js';
import {
  buildTargetXmlForSave,
  extractInnerXml,
  findMissingSourceInlineTags,
  fragmentToPlainText,
} from './review/segment-xml-utils.js';

export interface BilingualReviewPageProps {
  manualId: string;
  itemId: string;
  branch: string | null;
}

const OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';

const VIEW_STORAGE_KEY = 'ditaeditor.review.view';
const INSPECTOR_STORAGE_KEY = 'ditaeditor.review.inspector';
const VIEW_MODES: ReviewViewMode[] = ['sideBySide', 'stacked', 'hoverReading', 'xmlDiff'];

function safeRead(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* jsdom / private browsing: preferences are a nicety, never a failure. */
  }
}

function readStoredViewMode(): ReviewViewMode {
  const stored = safeRead(VIEW_STORAGE_KEY);
  return VIEW_MODES.includes(stored as ReviewViewMode) ? (stored as ReviewViewMode) : 'sideBySide';
}

function readStoredInspector(): boolean | null {
  const stored = safeRead(INSPECTOR_STORAGE_KEY);
  if (stored === 'open') return true;
  if (stored === 'closed') return false;
  return null;
}

function issueKey(issue: TranslationQaIssue): string {
  return `${issue.code}::${issue.segmentId ?? ''}::${issue.message}`;
}

function scrollToRow(segmentId: string): void {
  const row = document.querySelector(`[data-testid="review-row-${segmentId}"]`);
  row?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

export function BilingualReviewPage({ manualId, itemId, branch }: BilingualReviewPageProps) {
  const { t } = useI18n();
  const review = useTranslationStore((state) => state.review);
  const reviewLoading = useTranslationStore((state) => state.reviewLoading);
  const reviewError = useTranslationStore((state) => state.reviewError);
  const reviewSaving = useTranslationStore((state) => state.reviewSaving);
  const applyingDraft = useTranslationStore((state) => state.applyingDraft);
  const refiningSegmentId = useTranslationStore((state) => state.refiningSegmentId);
  const actionError = useTranslationStore((state) => state.actionError);
  const actionMessage = useTranslationStore((state) => state.actionMessage);
  const loadReview = useTranslationStore((state) => state.loadReview);
  const saveReview = useTranslationStore((state) => state.saveReview);
  const refineSegment = useTranslationStore((state) => state.refineSegment);
  const applyDraft = useTranslationStore((state) => state.applyDraft);
  const batchCheckin = useTranslationStore((state) => state.batchCheckin);
  const validatingStrict = useTranslationStore((state) => state.validatingStrict);
  const validateActiveItemStrict = useTranslationStore((state) => state.validateActiveItemStrict);

  const [activeItemId, setActiveItemId] = useState(itemId);
  const [viewMode, setViewMode] = useState<ReviewViewMode>(() => readStoredViewMode());
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const [showTags, setShowTags] = useState(false);
  const [order, setOrder] = useState<'targetTop' | 'sourceTop'>('targetTop');
  const [primary, setPrimary] = useState<'target' | 'source'>('target');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [dirtySegments, setDirtySegments] = useState<Set<string>>(() => new Set());
  const [xmlDraft, setXmlDraft] = useState('');
  const [xmlDirty, setXmlDirty] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [rawRequestFor, setRawRequestFor] = useState<string | null>(null);
  const [insertRequest, setInsertRequest] = useState<SegmentInsertRequest | null>(null);
  const [refineFor, setRefineFor] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [refinePreview, setRefinePreview] = useState<RefineTranslationSegmentResult | null>(null);
  const [inspectorPref, setInspectorPref] = useState<boolean | null>(() => readStoredInspector());
  const [switchPrompt, setSwitchPrompt] = useState<string | null>(null);
  const [applyResultPath, setApplyResultPath] = useState<string | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedInHash, setCheckedInHash] = useState<string | null>(null);

  useEffect(() => {
    setActiveItemId(itemId);
  }, [itemId]);

  useEffect(() => {
    void loadReview(activeItemId);
  }, [activeItemId, loadReview]);

  // The draft overlay actions (lock, apply, check-in) all speak for an identity, so the page needs
  // one even when it is opened directly from a deep link instead of through the translation center.
  const initializeIdentity = useGitStore((state) => state.initialize);
  const identity = useGitStore((state) => state.identity);
  const currentUser = useGitStore((state) => state.currentUser);
  const switchUser = useGitStore((state) => state.switchUser);
  useEffect(() => {
    if (OFFLINE) return;
    void initializeIdentity();
  }, [initializeIdentity]);

  /* ------------------------------------------------------------- seeding */

  const draftXmlFor = useCallback(
    (segment: TranslationSegmentReviewView): string => {
      const draftInner = drafts[segment.segmentId] ?? '';
      // Untouched segments keep the server payload verbatim (no re-escaping, no re-wrapping).
      if (!dirtySegments.has(segment.segmentId) && segment.proposedTargetXml !== null) {
        return segment.proposedTargetXml;
      }
      return buildTargetXmlForSave(segment, draftInner);
    },
    [drafts, dirtySegments],
  );

  /** Item whose buffers are currently seeded, so a metadata-only payload refresh cannot wipe them. */
  const seededItemIdRef = useRef<string | null>(null);
  /** Server proposal fingerprint; a new proposal re-seeds the buffers, a status change never does. */
  const seededContentKeyRef = useRef<string | null>(null);

  const seedingKey = review
    ? `${review.item.id}::${review.proposedXml ?? ''}::${review.segments
        .map((segment) => segment.proposedTargetXml ?? '')
        .join('\u0000')}`
    : null;

  useEffect(() => {
    if (!review || seedingKey === null) return;
    const itemChanged = seededItemIdRef.current !== review.item.id;
    const contentChanged = seededContentKeyRef.current !== seedingKey;
    if (!itemChanged && !contentChanged) return;
    seededItemIdRef.current = review.item.id;
    seededContentKeyRef.current = seedingKey;

    // Per-item UI state follows the *file*, never the payload: `applyDraft` only refreshes
    // `item.status`/`lock`, and that must not close the check-in bar or hide the checked-in hash.
    if (itemChanged) {
      setSelectedSegmentId(
        review.segments.find((segment) => !segment.protected)?.segmentId ??
          review.segments[0]?.segmentId ??
          null,
      );
      setEditingSegmentId(null);
      setRawRequestFor(null);
      setInsertRequest(null);
      setRefineFor(null);
      setRefinePreview(null);
      setRefineInstruction('');
      setCheckedInHash(null);
      setApplyResultPath(null);
      setCheckinOpen(false);
      setCheckinMessage('');
    }

    const next: Record<string, string> = {};
    for (const segment of review.segments) {
      // Attribute segments (`navtitle="…"`) hold plain text, so seed from the plain payload — not
      // from the XML-escaped `proposedTargetXml` (`CI &amp; CD` must edit as `CI & CD`).
      if (segment.attributeName) {
        next[segment.segmentId] =
          segment.proposedTargetText ?? segment.prevTargetText ?? segment.sourceText;
        continue;
      }
      const innerXml = segment.proposedTargetXml ? extractInnerXml(segment.proposedTargetXml) : '';
      next[segment.segmentId] =
        innerXml.length > 0 ? innerXml : (segment.proposedTargetText ?? segment.prevTargetText ?? '');
    }
    setDrafts(next);
    setDirtySegments(new Set());
    setXmlDraft(review.proposedXml ?? '');
    setXmlDirty(false);
  }, [review, seedingKey]);

  const editable = review?.canReview ?? false;
  const segments = useMemo(() => review?.segments ?? [], [review]);

  /* ----------------------------------------------------------- live QA */

  const mergedIssues: TranslationQaIssue[] = useMemo(() => {
    if (!review) return [];
    const live = runTranslationQa({
      segments: review.segments.map((segment) => {
        const draftInner = drafts[segment.segmentId] ?? '';
        const targetXml = segment.protected
          ? (segment.proposedTargetXml ?? segment.currSourceXml)
          : buildTargetXmlForSave(segment, draftInner);
        return {
          segmentId: segment.segmentId,
          sourceXml: segment.currSourceXml,
          sourceText: segment.sourceText,
          targetXml,
          targetText: segment.protected
            ? segment.sourceText
            : fragmentToPlainText(draftInner),
          protected: segment.protected,
        };
      }),
      glossary: review.glossary,
    });
    const merged = new Map<string, TranslationQaIssue>();
    for (const issue of review.qaReport?.issues ?? []) {
      if (issue.segmentId) continue;
      merged.set(issueKey(issue), issue);
    }
    for (const issue of live) merged.set(issueKey(issue), issue);
    return [...merged.values()];
  }, [review, drafts]);

  const errorCount = mergedIssues.filter((issue) => issue.severity === 'error').length;
  const warningCount = mergedIssues.filter((issue) => issue.severity === 'warning').length;
  // The inspector lists *matched* terms, so aggregate the per-segment hits (a term matched by three
  // blocks is still one card).
  const glossaryHits = useMemo(() => {
    const seen = new Map<string, TranslationGlossaryHitView>();
    for (const segment of review?.segments ?? []) {
      for (const hit of segment.glossaryHits) {
        if (!seen.has(hit.termId)) seen.set(hit.termId, hit);
      }
    }
    return [...seen.values()];
  }, [review]);
  const inspectorOpen = inspectorPref ?? (errorCount > 0 || warningCount > 0 || glossaryHits.length > 0);

  const activeSegments = useMemo(() => {
    return segments.filter((segment) => {
      if (filter === 'changed') return segment.changeKind !== 'unchanged';
      if (filter === 'qa') return mergedIssues.some((issue) => issue.segmentId === segment.segmentId);
      if (filter === 'edited') return dirtySegments.has(segment.segmentId);
      return true;
    });
  }, [segments, filter, mergedIssues, dirtySegments]);

  const filterCounts = useMemo(
    () => ({
      all: segments.length,
      changed: segments.filter((segment) => segment.changeKind !== 'unchanged').length,
      qa: segments.filter((segment) =>
        mergedIssues.some((issue) => issue.segmentId === segment.segmentId),
      ).length,
      edited: segments.filter((segment) => dirtySegments.has(segment.segmentId)).length,
    }),
    [segments, mergedIssues, dirtySegments],
  );

  const missingTagsFor = useCallback(
    (segment: TranslationSegmentReviewView): MissingInlineTag[] => {
      if (!segment.elementTag || segment.attributeName) return [];
      return findMissingSourceInlineTags(
        extractInnerXml(segment.currSourceXml),
        drafts[segment.segmentId] ?? '',
      );
    },
    [drafts],
  );

  /* ------------------------------------------------------- edit handlers */

  const editSegment = useCallback((segmentId: string, value: string) => {
    setDrafts((previous) => ({ ...previous, [segmentId]: value }));
    setDirtySegments((previous) => new Set(previous).add(segmentId));
  }, []);

  const startEditing = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    setEditingSegmentId(segmentId);
    setRawRequestFor(null);
  }, []);

  const editXmlOf = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    setEditingSegmentId(segmentId);
    setRawRequestFor(segmentId);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingSegmentId(null);
    setRawRequestFor(null);
  }, []);

  const insertTerm = useCallback(
    (text: string, targetSegmentId?: string) => {
      const segmentId = targetSegmentId ?? editingSegmentId ?? selectedSegmentId;
      if (!segmentId || !editable) return;
      const segment = segments.find((entry) => entry.segmentId === segmentId);
      if (!segment || segment.protected) return;
      if (editingSegmentId !== segmentId) startEditing(segmentId);
      setInsertRequest({ segmentId, text, nonce: Date.now() + Math.random() });
    },
    [editable, editingSegmentId, segments, selectedSegmentId, startEditing],
  );

  const selectSegment = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    scrollToRow(segmentId);
  }, []);

  /* ------------------------------------------------------------- refine */

  const openRefine = useCallback(
    (segmentId: string) => {
      setRefineFor(segmentId);
      setRefineInstruction('');
      setRefinePreview(null);
      setSelectedSegmentId(segmentId);
      setEditingSegmentId(segmentId);
    },
    [],
  );

  const closeRefine = useCallback(() => {
    setRefineFor(null);
    setRefineInstruction('');
    setRefinePreview(null);
  }, []);

  const runRefine = async () => {
    if (!refineFor || !review) return;
    const segment = review.segments.find((entry) => entry.segmentId === refineFor);
    if (!segment) return;
    setRefinePreview(null);
    // Real block XML (inline tags and attributes intact), never the flattened draft text.
    const result = await refineSegment(
      activeItemId,
      refineFor,
      refineInstruction.trim(),
      buildTargetXmlForSave(segment, drafts[refineFor] ?? ''),
    );
    if (result) setRefinePreview(result);
  };

  const applyRefinePreview = () => {
    if (!refinePreview) return;
    const segment = segments.find((entry) => entry.segmentId === refinePreview.segmentId);
    const nextDraft = segment?.attributeName
      ? refinePreview.proposedTargetText
      : segment
        ? extractInnerXml(refinePreview.proposedTargetXml)
        : refinePreview.proposedTargetXml;
    editSegment(refinePreview.segmentId, nextDraft);
    setRefinePreview(null);
    setRefineFor(null);
    setRefineInstruction('');
  };

  /* ------------------------------------------------------ persistence */

  /**
   * Persists the reviewer buffers.
   *
   * Resolves `true` when the server holds the latest edits (including "there was nothing to save"),
   * and `false` when the request failed — callers that chain a write (apply / check-in) must abort
   * on `false`, otherwise the stale proposal would be applied to the target draft.
   */
  const saveRevisions = useCallback(async (): Promise<boolean> => {
    if (!review) return false;
    const dirty = dirtySegments.size > 0;
    if (!xmlDirty && !dirty) return true;
    if (xmlDirty) {
      const saved = await saveReview(activeItemId, { proposedXml: xmlDraft });
      if (!saved) return false;
      // A whole-file save supersedes the block buffers: they are re-seeded from the payload.
      setDirtySegments(new Set());
      setXmlDirty(false);
      return true;
    }
    // Every non-protected segment is re-supplied: untouched ones keep their original
    // `proposedTargetXml` byte-for-byte, edited ones are rebuilt from the live inner XML.
    const payload = review.segments
      .filter((segment) => !segment.protected)
      .map((segment) => ({
        segmentId: segment.segmentId,
        proposedTargetXml: draftXmlFor(segment),
      }));
    const saved = await saveReview(activeItemId, { segments: payload });
    if (!saved) return false;
    setDirtySegments(new Set());
    setXmlDirty(false);
    return true;
  }, [activeItemId, dirtySegments, draftXmlFor, review, saveReview, xmlDirty, xmlDraft]);

  const applyToDraft = async () => {
    if (!review) return;
    if (dirtySegments.size > 0 || xmlDirty) {
      const saved = await saveRevisions();
      if (!saved) return;
    }
    const targetPath = review.item.targetPath;
    const result: ApplyTranslationDraftResult | null = await applyDraft(activeItemId);
    if (result) {
      setCheckedInHash(null);
      // A no-op apply leaves no draft behind: the baseline already held these exact bytes, so the
      // banner points at the target file itself instead of a draft path that never existed.
      setApplyResultPath(result.draft?.filePath ?? targetPath);
    }
  };

  const checkIn = async () => {
    if (!review) return;
    const message = checkinMessage.trim();
    if (!message) return;
    setCheckingIn(true);
    try {
      let didSave = false;
      if (dirtySegments.size > 0 || xmlDirty) {
        didSave = await saveRevisions();
        if (!didSave) return;
      }
      // Check-in only ever commits drafts, so an approved proposal is a prerequisite. The status is
      // read from the store because `saveRevisions` reseeds `review` with a fresh payload.
      const currentStatus = useTranslationStore.getState().review?.item.status;
      if (didSave || currentStatus !== 'approved_draft') {
        const applied = await applyDraft(activeItemId);
        // A foreign lock is reported inline; aborting keeps the user on the file instead of
        // letting `batchCheckin` answer with a misleading `nothingToCheckin`.
        if (!applied) return;
      }
      const result = await batchCheckin(review.link.id, { itemIds: [review.item.id], message });
      if (!result) return;
      setCheckinOpen(false);
      setCheckinMessage('');
      setApplyResultPath(null);
      await loadReview(activeItemId);
      // Set after the reload: the seeding effect only clears the hash on a file switch.
      setCheckedInHash(result.commit?.shortHash ?? '');
    } finally {
      setCheckingIn(false);
    }
  };

  /* ------------------------------------------------------- navigation */

  const siblings: TranslationReviewSiblingView[] = useMemo(() => {
    if (!review) return [];
    if (review.siblings && review.siblings.length > 0) return review.siblings;
    // Single-item fallback: the API may not ship the queue yet, so synthesize it from the payload.
    return [
      {
        itemId: review.item.id,
        sourcePath: review.sourcePath,
        targetPath: review.targetPath,
        status: review.item.status,
        qaErrorCount: review.item.qaErrorCount ?? 0,
        qaWarningCount: review.item.qaWarningCount ?? 0,
      },
    ];
  }, [review]);

  const visibleSiblings = pendingOnly
    ? siblings.filter((entry) => entry.status !== 'checked_in')
    : siblings;
  const activeSiblingIndex = Math.max(
    visibleSiblings.findIndex((entry) => entry.itemId === activeItemId),
    0,
  );

  const goToItem = useCallback(
    (targetId: string) => {
      setActiveItemId(targetId);
      navigate(bilingualReviewPath(manualId, targetId, { branch }));
    },
    [branch, manualId],
  );

  const isDirty = dirtySegments.size > 0 || xmlDirty;

  const requestSwitch = useCallback(
    (targetId: string) => {
      if (!targetId || targetId === activeItemId) return;
      if (isDirty) {
        setSwitchPrompt(targetId);
        return;
      }
      goToItem(targetId);
    },
    [activeItemId, goToItem, isDirty],
  );

  const discardAndSwitch = () => {
    const target = switchPrompt;
    setSwitchPrompt(null);
    setDirtySegments(new Set());
    setXmlDirty(false);
    setEditingSegmentId(null);
    if (target) goToItem(target);
  };

  const saveAndSwitch = async () => {
    const target = switchPrompt;
    if (!target) return;
    await saveRevisions();
    setSwitchPrompt(null);
    setDirtySegments(new Set());
    setXmlDirty(false);
    setEditingSegmentId(null);
    goToItem(target);
  };

  const stepItem = useCallback(
    (direction: -1 | 1) => {
      const next = visibleSiblings[activeSiblingIndex + direction];
      if (!next) return;
      requestSwitch(next.itemId);
    },
    [activeSiblingIndex, requestSwitch, visibleSiblings],
  );

  const stepSegment = useCallback(
    (direction: -1 | 1) => {
      if (activeSegments.length === 0) return;
      const currentIndex = activeSegments.findIndex((entry) => entry.segmentId === selectedSegmentId);
      const base = currentIndex < 0 ? 0 : currentIndex + direction;
      const nextIndex = Math.min(Math.max(base, 0), activeSegments.length - 1);
      const next = activeSegments[nextIndex];
      if (!next) return;
      setSelectedSegmentId(next.segmentId);
      setEditingSegmentId(next.segmentId);
      scrollToRow(next.segmentId);
    },
    [activeSegments, selectedSegmentId],
  );

  /* --------------------------------------------------------- shortcuts */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        void saveRevisions();
        return;
      }
      if (event.key === 'Escape') {
        setEditingSegmentId(null);
        setRefineFor(null);
        setRefinePreview(null);
        setSwitchPrompt(null);
        return;
      }
      if (!event.altKey || modifier) return;
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        stepSegment(-1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        stepSegment(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepItem(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepItem(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveRevisions, stepItem, stepSegment]);

  /* -------------------------------------------------------------- views */

  const changeViewMode = (mode: ReviewViewMode) => {
    setViewMode(mode);
    safeWrite(VIEW_STORAGE_KEY, mode);
    stopEditing();
  };

  const toggleInspector = () => {
    const next = !inspectorOpen;
    setInspectorPref(next);
    safeWrite(INSPECTOR_STORAGE_KEY, next ? 'open' : 'closed');
  };

  if (reviewLoading && !review) {
    return (
      <div className="review-page review-page--loading" data-testid="bilingual-review-page">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('translation.review.loadingReview')}
      </div>
    );
  }

  if (!review) {
    return (
      <div className="review-page review-page--empty" data-testid="bilingual-review-page">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <button type="button" className="review-button" onClick={() => navigate(translationCenterPath(manualId, { branch }))}>
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            {t('translation.review.back')}
          </button>
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700" data-testid="review-error">
            {reviewError
              ? t('translation.error', { message: reviewError })
              : t('translation.review.emptySegments')}
          </p>
        </div>
      </div>
    );
  }

  const lock = review.lock;
  const lockConflict = Boolean(actionError && /lock|409/i.test(actionError));
  const errorText = actionError
    ? lockConflict
      ? t('translation.review.lockConflict')
      : t('translation.error', { message: actionError })
    : reviewError
      ? t('translation.error', { message: reviewError })
      : null;
  const messageText =
    applyResultPath !== null
      ? t('translation.review.appliedHint', { path: applyResultPath })
      : actionMessage;

  const listProps = {
    t,
    segments: activeSegments,
    drafts,
    dirtySegments,
    issues: mergedIssues,
    editable,
    showTags,
    activeSegmentId: selectedSegmentId,
    editingSegmentId,
    missingTagsFor,
    insertRequest,
    refine: {
      segmentId: refineFor,
      instruction: refineInstruction,
      preview: refinePreview,
      busy: refiningSegmentId === refineFor,
    } satisfies RefineState,
    onStartEditing: startEditing,
    onStopEditing: stopEditing,
    onEditXml: editXmlOf,
    onInsertGlossaryTerm: (segmentId: string, text: string) => insertTerm(text, segmentId),
    onDraftChange: editSegment,
    onOpenRefine: openRefine,
    onCloseRefine: closeRefine,
    onInstructionChange: setRefineInstruction,
    onRunRefine: () => void runRefine(),
    onApplyRefine: applyRefinePreview,
  };

  return (
    <div className="review-page" data-testid="bilingual-review-page">
      <ReviewHeader
        t={t}
        sourcePath={review.sourcePath}
        targetPath={review.targetPath}
        status={review.item.status as TranslationItemStatus}
        siblings={siblings}
        activeItemId={activeItemId}
        pendingOnly={pendingOnly}
        onTogglePendingOnly={() => setPendingOnly((value) => !value)}
        onSelectItem={requestSwitch}
        onPrevItem={() => stepItem(-1)}
        onNextItem={() => stepItem(1)}
        hasPrevItem={activeSiblingIndex > 0}
        hasNextItem={activeSiblingIndex < visibleSiblings.length - 1}
        viewMode={viewMode}
        onViewModeChange={changeViewMode}
        dirtyCount={dirtySegments.size}
        xmlDirty={xmlDirty}
        saving={reviewSaving}
        applying={applyingDraft}
        checkingIn={checkingIn}
        checkedInHash={checkedInHash}
        canSave={editable}
        canApply={editable}
        canCheckin={editable}
        onSave={() => void saveRevisions()}
        onApply={() => void applyToDraft()}
        onCheckin={() => setCheckinOpen((open) => !open)}
        inspectorOpen={inspectorOpen}
        onToggleInspector={toggleInspector}
        errorCount={errorCount}
        warningCount={warningCount}
        glossaryCount={glossaryHits.length}
        lock={lock}
        segmentProgress={t('translation.review.segmentProgress', {
          visible: activeSegments.length,
          total: segments.length,
        })}
        actionMessage={messageText}
        actionError={errorText}
        readOnly={!editable}
        identity={identity}
        aiReview={review.aiReview ?? null}
        ditaOtReport={review.ditaOtReport ?? null}
        currentUser={currentUser}
        onSwitchIdentity={(userId) => void switchUser(userId)}
        onBack={() =>
          navigate(translationCenterPath(manualId, { branch: review.link.sourceBranch, linkId: review.link.id }))
        }
        onOpenTargetEditor={
          applyResultPath
            ? () =>
                navigate(
                  editorPath(review.link.targetManualId, {
                    branch: review.link.targetBranch,
                    topicPath: review.targetPath,
                  }),
                )
            : null
        }
      />

      {checkinOpen ? (
        <div className="review-checkin-bar">
          <span>{t('translation.review.checkinHint')}</span>
          <input
            value={checkinMessage}
            aria-label={t('translation.review.checkinMessage')}
            placeholder={t('translation.review.checkinPlaceholder')}
            onChange={(event) => setCheckinMessage(event.currentTarget.value)}
          />
          <button
            type="button"
            className="review-button review-button--primary"
            data-testid="review-checkin-confirm"
            disabled={checkingIn || !checkinMessage.trim()}
            onClick={() => void checkIn()}
          >
            {t('translation.review.checkinConfirm')}
          </button>
          <button type="button" className="review-button" onClick={() => setCheckinOpen(false)}>
            {t('translation.review.checkinCancel')}
          </button>
        </div>
      ) : null}

      <SegmentFilterBar
        t={t}
        filter={filter}
        counts={filterCounts}
        showTags={showTags}
        viewMode={viewMode}
        order={order}
        primary={primary}
        onFilterChange={setFilter}
        onToggleTags={() => setShowTags((value) => !value)}
        onOrderChange={setOrder}
        onPrimaryChange={setPrimary}
      />

      <div className="review-workbench">
        <div className="review-content">
          {viewMode === 'sideBySide' ? (
            <SideBySideView {...listProps} rawRequestFor={rawRequestFor} />
          ) : null}
          {viewMode === 'stacked' ? (
            <StackedBilingualView {...listProps} order={order} rawRequestFor={rawRequestFor} />
          ) : null}
          {viewMode === 'hoverReading' ? (
            <HoverReadingView {...listProps} primary={primary} rawRequestFor={rawRequestFor} />
          ) : null}
          {viewMode === 'xmlDiff' ? (
            <XmlDiffView
              t={t}
              xmlDraft={xmlDraft}
              baselineXml={review.targetBaselineXml ?? ''}
              editable={editable}
              onXmlDraftChange={(value) => {
                setXmlDraft(value);
                setXmlDirty(value !== (review.proposedXml ?? ''));
              }}
            />
          ) : null}
          {viewMode !== 'xmlDiff' && activeSegments.length === 0 ? (
            <p className="review-empty" data-testid="review-filter-empty">
              {t('translation.review.filterEmpty')}
            </p>
          ) : null}
        </div>

        {inspectorOpen ? (
          <ReviewInspectorPanel
            t={t}
            glossaryHits={glossaryHits}
            issues={mergedIssues}
            errorCount={errorCount}
            warningCount={warningCount}
            onInsertTerm={(hit) => insertTerm(hit.targetTerm)}
            onSelectSegment={selectSegment}
            onClose={toggleInspector}
            aiReview={review.aiReview ?? null}
            ditaOtReport={review.ditaOtReport ?? null}
            validatingStrict={validatingStrict}
            onRerunStrict={() => void validateActiveItemStrict(review.item.id)}
          />
        ) : null}
      </div>

      {switchPrompt ? (
        <div className="review-dialog-backdrop" role="presentation">
          <div
            className="review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-unsaved-title"
            data-testid="review-unsaved-dialog"
          >
            <h2 className="review-dialog__title" id="review-unsaved-title">
              {t('translation.review.unsavedTitle')}
            </h2>
            <p className="review-dialog__body">{t('translation.review.unsavedBody')}</p>
            <div className="review-dialog__actions">
              <button type="button" className="review-button" onClick={() => setSwitchPrompt(null)} data-testid="review-unsaved-cancel">
                {t('translation.review.cancel')}
              </button>
              <button type="button" className="review-button" onClick={discardAndSwitch} data-testid="review-unsaved-discard">
                {t('translation.review.discardAndSwitch')}
              </button>
              <button
                type="button"
                className="review-button review-button--primary"
                onClick={() => void saveAndSwitch()}
                data-testid="review-unsaved-save"
              >
                {t('translation.review.saveAndSwitch')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Re-exported for tests that need the plain-text projection of a draft. */
export const __reviewInternals = { extractPlainText };
