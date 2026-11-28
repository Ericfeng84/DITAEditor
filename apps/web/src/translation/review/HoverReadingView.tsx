/**
 * Reading-first layout: one language at a time in real document hierarchy.
 *
 * Hovering a block reveals the counterpart in a floating card that is absolutely positioned, so it
 * never reflows the text underneath. Clicking pins the pair open into an in-place editor drawer.
 */
import { useEffect, useRef, useState } from 'react';
import { Pin, X } from 'lucide-react';
import { DitaInlineRenderer } from './DitaInlineRenderer.js';
import { SegmentEditorPanel } from './SegmentEditorPanel.js';
import { resolveBlockTypography } from './dita-block-typography.js';
import type { SegmentListProps } from './review-shared.js';
import { extractInnerXml } from './segment-xml-utils.js';

export interface HoverReadingViewProps extends SegmentListProps {
  primary: 'target' | 'source';
  rawRequestFor: string | null;
}

export function HoverReadingView(props: HoverReadingViewProps) {
  const {
    t,
    segments,
    drafts,
    showTags,
    editingSegmentId,
    primary,
    rawRequestFor,
    onStartEditing,
    onStopEditing,
  } = props;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pinnedId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && rootRef.current.contains(target)) return;
      setPinnedId(null);
      onStopEditing();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinnedId(null);
      onStopEditing();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinnedId, onStopEditing]);

  const pin = (segmentId: string) => {
    setPinnedId(segmentId);
    setHoveredId(null);
    onStartEditing(segmentId);
  };

  const closePinned = () => {
    setPinnedId(null);
    onStopEditing();
  };

  return (
    <div className="review-scroll review-scroll--reading" data-testid="review-hover-view">
      <div className="review-reading" ref={rootRef} data-primary={primary}>
        {segments.length === 0 ? (
          <p className="review-empty">{t('translation.review.emptySegments')}</p>
        ) : null}
        {segments.map((segment, index) => {
          const segmentId = segment.segmentId;
          const typography = resolveBlockTypography(segment);
          const draft = drafts[segmentId] ?? '';
          const pinned = pinnedId === segmentId;
          const hovered = hoveredId === segmentId;
          const placement = index < Math.ceil(segments.length / 2) ? 'below' : 'above';
          const primaryNode =
            primary === 'target' ? (
              <p className={`${typography.proseClassName} review-reading__primary-prose`}>
                <DitaInlineRenderer innerXml={draft} showTags={showTags} />
              </p>
            ) : (
              <p className={`${typography.proseClassName} review-reading__primary-prose`}>
                <DitaInlineRenderer
                  innerXml={extractInnerXml(segment.currSourceXml)}
                  glossaryHits={segment.glossaryHits}
                  showTags={showTags}
                />
              </p>
            );
          const counterpart = (
            <DitaInlineRenderer
              innerXml={
                primary === 'target' ? extractInnerXml(segment.currSourceXml) : draft
              }
              showTags={showTags}
              className="review-hover-card__text"
            />
          );

          return (
            <section
              key={segmentId}
              data-testid={`review-row-${segmentId}`}
              data-editing={editingSegmentId === segmentId ? 'true' : 'false'}
              className={`review-reading__block ${typography.rowClassName}`}
              data-placement={placement}
              onMouseEnter={() => setHoveredId(segmentId)}
              onMouseLeave={() => setHoveredId((current) => (current === segmentId ? null : current))}
            >
              <div className="review-reading__gutter" aria-hidden="true">
                <span className="review-tag" data-testid={`review-tag-${segmentId}`}>
                  {typography.tagLabel}
                </span>
              </div>

              <div
                className="review-reading__body"
                data-testid={primary === 'target' ? `review-target-${segmentId}` : `review-source-${segmentId}`}
                onClick={() => pin(segmentId)}
              >
                {pinned ? (
                  <div className="review-pinned" data-testid={`review-hover-editor-${segmentId}`}>
                    <div className="review-pinned__head">
                      <span>{t('translation.review.sourceLabel')}</span>
                      <button
                        type="button"
                        className="review-icon-button"
                        aria-label={t('translation.review.closeComparison')}
                        onClick={(event) => {
                          event.stopPropagation();
                          closePinned();
                        }}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                    <p className={`${typography.proseClassName} ${typography.mutedClassName}`}>
                      <DitaInlineRenderer
                        innerXml={extractInnerXml(segment.currSourceXml)}
                        glossaryHits={segment.glossaryHits}
                        showTags={showTags}
                      />
                    </p>
                    <div className="review-pinned__head">
                      <span>{t('translation.review.targetLabel')}</span>
                      <Pin className="h-3 w-3" aria-hidden="true" />
                    </div>
                    <SegmentEditorPanel
                      {...props}
                      segment={segment}
                      initialRaw={rawRequestFor === segmentId}
                    />
                  </div>
                ) : (
                  primaryNode
                )}
              </div>

              {hovered && !pinned ? (
                <div
                  className="review-hover-card"
                  data-testid={`review-hover-card-${segmentId}`}
                  data-placement={placement}
                  aria-hidden="true"
                >
                  <span className="review-hover-card__eyebrow">
                    {primary === 'target'
                      ? t('translation.review.sourceLabel')
                      : t('translation.review.targetLabel')}
                  </span>
                  {counterpart}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
