/**
 * Segment filter pills plus the view-specific controls that belong next to them.
 */
import { Tags } from 'lucide-react';
import type { SegmentFilter, Translator, ReviewViewMode } from './review-shared.js';

export interface SegmentFilterCounts {
  all: number;
  changed: number;
  qa: number;
  edited: number;
}

export interface SegmentFilterBarProps {
  t: Translator;
  filter: SegmentFilter;
  counts: SegmentFilterCounts;
  showTags: boolean;
  viewMode: ReviewViewMode;
  order: 'targetTop' | 'sourceTop';
  primary: 'target' | 'source';
  onFilterChange: (filter: SegmentFilter) => void;
  onToggleTags: () => void;
  onOrderChange: (order: 'targetTop' | 'sourceTop') => void;
  onPrimaryChange: (primary: 'target' | 'source') => void;
}

const FILTERS: Array<{ id: SegmentFilter; labelKey: never }> = [
  { id: 'all', labelKey: 'translation.review.filterAll' as never },
  { id: 'changed', labelKey: 'translation.review.filterChanged' as never },
  { id: 'qa', labelKey: 'translation.review.filterQa' as never },
  { id: 'edited', labelKey: 'translation.review.filterEdited' as never },
];

export function SegmentFilterBar({
  t,
  filter,
  counts,
  showTags,
  viewMode,
  order,
  primary,
  onFilterChange,
  onToggleTags,
  onOrderChange,
  onPrimaryChange,
}: SegmentFilterBarProps) {
  return (
    <div className="review-filter-bar">
      <div className="review-filter-group" role="group" aria-label={t('translation.review.filterLabel')}>
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="review-filter-pill"
            data-testid={`review-filter-${entry.id}`}
            aria-pressed={filter === entry.id}
            onClick={() => onFilterChange(entry.id)}
          >
            {t(entry.labelKey)}
            <span className="review-filter-pill__count">{counts[entry.id]}</span>
          </button>
        ))}
      </div>

      <div className="review-filter-group">
        <button
          type="button"
          className="review-toggle"
          data-testid="review-toggle-tags"
          aria-pressed={showTags}
          onClick={onToggleTags}
        >
          <Tags className="h-3 w-3" aria-hidden="true" />
          {t('translation.review.showTags')}
        </button>

        {viewMode === 'stacked' ? (
          <div className="review-segmented review-segmented--sm" role="group">
            <button
              type="button"
              className="review-segmented__item"
              data-testid="review-order-target-top"
              aria-pressed={order === 'targetTop'}
              onClick={() => onOrderChange('targetTop')}
            >
              {t('translation.review.targetOnTop')}
            </button>
            <button
              type="button"
              className="review-segmented__item"
              data-testid="review-order-source-top"
              aria-pressed={order === 'sourceTop'}
              onClick={() => onOrderChange('sourceTop')}
            >
              {t('translation.review.sourceOnTop')}
            </button>
          </div>
        ) : null}

        {viewMode === 'hoverReading' ? (
          <div className="review-segmented review-segmented--sm" role="group">
            <button
              type="button"
              className="review-segmented__item"
              data-testid="review-primary-target"
              aria-pressed={primary === 'target'}
              onClick={() => onPrimaryChange('target')}
            >
              {t('translation.review.primaryTarget')}
            </button>
            <button
              type="button"
              className="review-segmented__item"
              data-testid="review-primary-source"
              aria-pressed={primary === 'source'}
              onClick={() => onPrimaryChange('source')}
            >
              {t('translation.review.primarySource')}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
