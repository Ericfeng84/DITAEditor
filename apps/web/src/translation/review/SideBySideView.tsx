/**
 * Default review layout: source and target locked into one shared row.
 *
 * Both languages live inside the *same* `review-row-*` container, so a long paragraph can never
 * drift out of alignment. Rows are stacked in one scroll container; only the active block gets an
 * editor, everything else stays clean typography.
 */
import { useState } from 'react';
import { Bot, Code2, TriangleAlert } from 'lucide-react';
import type { TranslationSegmentReviewView } from '../../services/translation-api.js';
import { DitaInlineRenderer } from './DitaInlineRenderer.js';
import { SegmentEditorPanel } from './SegmentEditorPanel.js';
import { resolveBlockTypography } from './dita-block-typography.js';
import { CHANGE_TONE, issuesForSegment, type SegmentListProps } from './review-shared.js';
import { extractInnerXml, fragmentToPlainText } from './segment-xml-utils.js';

export interface SideBySideViewProps extends SegmentListProps {
  /** Start a segment in raw XML mode. */
  rawRequestFor: string | null;
}

export function SideBySideView(props: SideBySideViewProps) {
  const {
    t,
    segments,
    drafts,
    dirtySegments,
    issues,
    editable,
    showTags,
    editingSegmentId,
    rawRequestFor,
    onStartEditing,
    onStopEditing,
    onOpenRefine,
    onEditXml,
  } = props;
  const [diffFor, setDiffFor] = useState<Set<string>>(() => new Set());

  const toggleDiff = (segmentId: string) => {
    setDiffFor((previous) => {
      const next = new Set(previous);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  };

  return (
    <div className="review-scroll" data-testid="review-side-by-side">
      <div className="review-column-head">
        <span>{t('translation.review.sourceColumn')}</span>
        <span>{t('translation.review.targetColumn')}</span>
      </div>
      {segments.map((segment, index) => {
        const segmentId = segment.segmentId;
        const typography = resolveBlockTypography(segment);
        const draft = drafts[segmentId] ?? '';
        const segmentIssues = issuesForSegment(issues, segmentId);
        const editing = editingSegmentId === segmentId;
        const dirty = dirtySegments.has(segmentId);
        const showPrevious = diffFor.has(segmentId) && Boolean(segment.prevSourceText);
        return (
          <div
            key={segmentId}
            data-testid={`review-row-${segmentId}`}
            data-editing={editing ? 'true' : 'false'}
            className={`review-row grid grid-cols-1 lg:grid-cols-2 ${typography.rowClassName}`}
          >
            <div
              className="review-cell review-cell--source"
              data-testid={`review-source-${segmentId}`}
              onClick={() => onStartEditing(segmentId)}
            >
              <div className="review-cell__meta">
                <span className="review-row-index" data-testid={`review-row-index-${segmentId}`}>
                  #{index + 1}
                </span>
                <span className="review-tag" data-testid={`review-tag-${segmentId}`}>
                  {typography.tagLabel}
                </span>
                <span
                  className={`review-pill ${CHANGE_TONE[segment.changeKind] ?? CHANGE_TONE.modified}`}
                >
                  {t(`translation.changeKind.${segment.changeKind}` as never)}
                </span>
                {segment.prevSourceText ? (
                  <button
                    type="button"
                    className="review-link-button"
                    data-testid={`review-s0-toggle-${segmentId}`}
                    aria-pressed={showPrevious}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleDiff(segmentId);
                    }}
                  >
                    {showPrevious ? t('translation.review.hideDiff') : t('translation.review.showDiff')}
                  </button>
                ) : null}
              </div>
              <div className={`review-indent-${typography.indent}`}>
                <p className={`${typography.proseClassName} ${typography.mutedClassName}`}>
                  <DitaInlineRenderer
                    innerXml={extractInnerXml(segment.currSourceXml)}
                    glossaryHits={segment.glossaryHits}
                    showTags={showTags}
                  />
                </p>
                {showPrevious ? (
                  <p className="review-prose review-prose--previous">
                    <span className="review-prose__eyebrow">{t('translation.review.prevSource')}</span>
                    {segment.prevSourceText}
                  </p>
                ) : null}
              </div>
            </div>

            <div
              className="review-cell review-cell--target"
              data-testid={`review-target-${segmentId}`}
              onClick={() => onStartEditing(segmentId)}
            >
              <div className="review-cell__meta">
                {dirty ? (
                  <span
                    className="review-dirty-dot"
                    title={t('translation.review.dirty')}
                    aria-hidden="true"
                  />
                ) : null}
                {segmentIssues.length > 0 ? (
                  <button
                    type="button"
                    className={`review-qa-chip ${
                      segmentIssues.some((issue) => issue.severity === 'error')
                        ? 'review-qa-chip--error'
                        : 'review-qa-chip--warning'
                    }`}
                    data-testid={`review-segment-qa-${segmentId}`}
                    title={segmentIssues.map((issue) => issue.message).join('\n')}
                    onClick={(event) => {
                      event.stopPropagation();
                      onStartEditing(segmentId);
                    }}
                  >
                    <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
                    {t('translation.review.segmentQa', { count: segmentIssues.length })}
                  </button>
                ) : null}
                {segment.protected ? (
                  <span className="review-pill border-slate-300 bg-slate-100 text-slate-600">
                    {t('translation.review.protectedReadOnly')}
                  </span>
                ) : null}
                <span className="review-row-actions">
                  {editable ? (
                    <button
                      type="button"
                      className="review-icon-button"
                      data-testid={`review-refine-${segmentId}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onStartEditing(segmentId);
                        onOpenRefine(segmentId);
                      }}
                    >
                      <Bot className="h-3 w-3" aria-hidden="true" />
                      <span>{t('translation.review.aiRefine')}</span>
                    </button>
                  ) : null}
                  {editable && !segment.protected && !editing ? (
                    <button
                      type="button"
                      className="review-icon-button"
                      data-testid={`review-row-xml-${segmentId}`}
                      title={t('translation.review.editXml')}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditXml(segmentId);
                      }}
                    >
                      <Code2 className="h-3 w-3" aria-hidden="true" />
                      <span aria-hidden="true">{'</>'}</span>
                    </button>
                  ) : null}
                </span>
              </div>

              <div className={`review-indent-${typography.indent}`}>
                {editing ? (
                  <SegmentEditorPanel
                    {...props}
                    segment={segment}
                    initialRaw={rawRequestFor === segmentId}
                  />
                ) : (
                  <p
                    className={`${typography.proseClassName} review-target-text`}
                    title={editable ? t('translation.review.clickToEdit') : undefined}
                    onClick={() => onStartEditing(segmentId)}
                  >
                    <DitaInlineRenderer
                      innerXml={draft}
                      showTags={showTags}
                      emptyFallback={fragmentToPlainText(segment.proposedTargetText ?? '') || undefined}
                    />
                  </p>
                )}
                {editing && !segment.protected ? (
                  <button
                    type="button"
                    className="review-link-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStopEditing();
                    }}
                  >
                    {t('translation.review.exitEdit')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One row's shared wrapper — exported so tests can assert alignment without DOM guessing. */
export function reviewRowIdOf(segment: TranslationSegmentReviewView): string {
  return `review-row-${segment.segmentId}`;
}
