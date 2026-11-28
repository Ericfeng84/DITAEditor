/**
 * Editorial stacked layout: one language on top, the other directly underneath.
 *
 * The pair reads like a bilingual book page: the primary line is crisp and dark, the counterpart
 * is muted so the eye still knows which language it is reviewing.
 */
import { SegmentEditorPanel } from './SegmentEditorPanel.js';
import { DitaInlineRenderer } from './DitaInlineRenderer.js';
import { resolveBlockTypography } from './dita-block-typography.js';
import { CHANGE_TONE, issuesForSegment, type SegmentListProps } from './review-shared.js';
import { extractInnerXml } from './segment-xml-utils.js';

export interface StackedBilingualViewProps extends SegmentListProps {
  order: 'targetTop' | 'sourceTop';
  rawRequestFor: string | null;
}

export function StackedBilingualView(props: StackedBilingualViewProps) {
  const {
    t,
    segments,
    drafts,
    dirtySegments,
    issues,
    editable,
    showTags,
    editingSegmentId,
    order,
    rawRequestFor,
    onStartEditing,
    onStopEditing,
  } = props;

  return (
    <div className="review-scroll review-scroll--editorial" data-testid="review-stacked">
      <div className="review-editorial" data-order={order}>
        {segments.map((segment) => {
          const segmentId = segment.segmentId;
          const typography = resolveBlockTypography(segment);
          const draft = drafts[segmentId] ?? '';
          const segmentIssues = issuesForSegment(issues, segmentId);
          const editing = editingSegmentId === segmentId;
          const dirty = dirtySegments.has(segmentId);

          const sourceBlock = (
            <div
              key="source"
              className="review-editorial__source"
              data-testid={`review-source-${segmentId}`}
              onClick={() => onStartEditing(segmentId)}
            >
              <p className={`${typography.proseClassName} ${typography.mutedClassName}`}>
                <DitaInlineRenderer
                  innerXml={extractInnerXml(segment.currSourceXml)}
                  glossaryHits={segment.glossaryHits}
                  showTags={showTags}
                />
              </p>
            </div>
          );

          const targetBlock = (
            <div
              key="target"
              className="review-editorial__target"
              data-testid={`review-target-${segmentId}`}
              onClick={() => onStartEditing(segmentId)}
            >
              {editing ? (
                <SegmentEditorPanel {...props} segment={segment} initialRaw={rawRequestFor === segmentId} />
              ) : (
                <p className={`${typography.proseClassName} review-editorial__target-prose`}>
                  <DitaInlineRenderer innerXml={draft} showTags={showTags} />
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
          );

          return (
            <section
              key={segmentId}
              data-testid={`review-row-${segmentId}`}
              data-editing={editing ? 'true' : 'false'}
              className={`review-editorial__block ${typography.rowClassName}`}
            >
              <div className="review-editorial__meta">
                <span className="review-tag" data-testid={`review-tag-${segmentId}`}>
                  {typography.tagLabel}
                </span>
                <span
                  className={`review-pill ${CHANGE_TONE[segment.changeKind] ?? CHANGE_TONE.modified}`}
                >
                  {t(`translation.changeKind.${segment.changeKind}` as never)}
                </span>
                {dirty ? (
                  <span className="review-dirty-dot" title={t('translation.review.dirty')} aria-hidden="true" />
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
                    {t('translation.review.segmentQa', { count: segmentIssues.length })}
                  </button>
                ) : null}
              </div>
              <div className={`review-indent-${typography.indent}`}>
                {order === 'targetTop' ? [targetBlock, sourceBlock] : [sourceBlock, targetBlock]}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
