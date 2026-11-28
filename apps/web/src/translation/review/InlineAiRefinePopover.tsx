/**
 * Per-segment AI refinement panel.
 *
 * The preview renders with `DitaInlineRenderer`, so the reviewer judges the *suggestion's prose*
 * (bold words, code, key chips) instead of staring at `<b>` tags — the raw XML stays in the
 * tooltip and in the request, never duplicated on screen.
 */
import type { RefineTranslationSegmentResult } from '../../services/translation-api.js';
import type { TranslationSegmentReviewView } from '../../services/translation-api.js';
import { DitaInlineRenderer } from './DitaInlineRenderer.js';
import type { Translator } from './review-shared.js';
import { extractInnerXml } from './segment-xml-utils.js';

export interface InlineAiRefinePopoverProps {
  t: Translator;
  segment: TranslationSegmentReviewView;
  preview: RefineTranslationSegmentResult | null;
  instruction: string;
  busy: boolean;
  showTags: boolean;
  onInstructionChange: (value: string) => void;
  onRun: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function InlineAiRefinePopover({
  t,
  segment,
  preview,
  instruction,
  busy,
  showTags,
  onInstructionChange,
  onRun,
  onApply,
  onClose,
}: InlineAiRefinePopoverProps) {
  return (
    <div className="review-refine" role="dialog">
      <label className="review-refine__label" htmlFor={`review-refine-input-${segment.segmentId}`}>
        {t('translation.review.aiRefineTitle')}
      </label>
      <textarea
        id={`review-refine-input-${segment.segmentId}`}
        className="review-refine__input"
        aria-label={t('translation.review.aiRefineTitle')}
        placeholder={t('translation.review.aiRefinePlaceholder')}
        value={instruction}
        rows={2}
        onChange={(event) => onInstructionChange(event.currentTarget.value)}
      />
      <div className="review-refine__actions">
        <button
          type="button"
          className="review-button review-button--primary"
          disabled={busy}
          onClick={onRun}
        >
          {busy ? t('translation.review.aiRefineRunning') : t('translation.review.aiRefineRun')}
        </button>
        <button type="button" className="review-button" onClick={onClose}>
          {t('translation.review.aiRefineCancel')}
        </button>
      </div>

      {preview ? (
        <div
          className="review-refine__preview"
          data-testid={`review-refine-preview-${segment.segmentId}`}
        >
          <DitaInlineRenderer
            innerXml={extractInnerXml(preview.proposedTargetXml)}
            showTags={showTags}
            className="review-refine__preview-text"
          />
          <button
            type="button"
            className="review-button review-button--primary"
            onClick={onApply}
          >
            {t('translation.review.aiRefineApply')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
