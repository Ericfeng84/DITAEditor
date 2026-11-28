/**
 * XML diff layout: read-only T0 baseline next to the editable T1 proposal.
 */
import type { Translator } from './review-shared.js';

export interface XmlDiffViewProps {
  t: Translator;
  xmlDraft: string;
  baselineXml: string;
  editable: boolean;
  onXmlDraftChange: (value: string) => void;
  hint?: string | null;
}

export function XmlDiffView({
  t,
  xmlDraft,
  baselineXml,
  editable,
  onXmlDraftChange,
  hint,
}: XmlDiffViewProps) {
  return (
    <div className="review-scroll" data-testid="review-xml-diff">
      <p className="review-xml-hint">{t('translation.review.xmlDiffHint')}</p>
      {hint ? <p className="review-inline-error">{hint}</p> : null}
      <div className="review-xml-grid">
        <div className="review-xml-column">
          <label className="review-xml-label" htmlFor="review-xml-baseline">
            {t('translation.review.targetT0')}
          </label>
          <textarea
            id="review-xml-baseline"
            className="review-xml-textarea review-xml-textarea--readonly"
            aria-label={t('translation.review.targetT0')}
            value={baselineXml}
            readOnly
            spellCheck={false}
            rows={18}
          />
        </div>
        <div className="review-xml-column">
          <label className="review-xml-label" htmlFor="review-xml-editor">
            {t('translation.review.targetT1')}
          </label>
          <textarea
            id="review-xml-editor"
            data-testid="review-xml-editor"
            className="review-xml-textarea"
            aria-label={t('translation.review.targetT1')}
            value={xmlDraft}
            readOnly={!editable}
            spellCheck={false}
            rows={18}
            onChange={(event) => onXmlDraftChange(event.currentTarget.value)}
          />
        </div>
      </div>
    </div>
  );
}
