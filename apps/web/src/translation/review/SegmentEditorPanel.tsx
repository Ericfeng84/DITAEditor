/**
 * The in-place editor block: rich segment editor, inline QA diagnostics and the AI refinement panel.
 *
 * Reviewing is also a *repair* task, so the QA strip lives exactly where the fix has to happen: it
 * names every issue on this block and offers the one action that resolves it (insert the dropped
 * inline tag, insert the glossary target, switch to raw XML, or hand the issues to AI refine).
 * Used by every layout so switching views never changes what editing feels like.
 */
import { useRef, useState } from 'react';
import type { TranslationQaIssue } from '@dita/core';
import { RichInlineSegmentEditor, type SegmentTagInsertRequest } from './RichInlineSegmentEditor.js';
import { InlineAiRefinePopover } from './InlineAiRefinePopover.js';
import { issuesForSegment, type SegmentListProps } from './review-shared.js';
import type {
  TranslationGlossaryHitView,
  TranslationSegmentReviewView,
} from '../../services/translation-api.js';

export interface SegmentEditorPanelProps extends SegmentListProps {
  segment: TranslationSegmentReviewView;
  /** Start this segment in raw XML mode (the `</>` row action). */
  initialRaw?: boolean;
}

export function SegmentEditorPanel({
  segment,
  initialRaw,
  t,
  drafts,
  showTags,
  issues,
  editable,
  missingTagsFor,
  insertRequest,
  refine,
  onDraftChange,
  onInstructionChange,
  onRunRefine,
  onApplyRefine,
  onCloseRefine,
  onOpenRefine,
  onEditXml,
  onInsertGlossaryTerm,
}: SegmentEditorPanelProps) {
  const segmentId = segment.segmentId;
  const [insertTagRequest, setInsertTagRequest] = useState<SegmentTagInsertRequest | null>(null);
  const [forceXmlRequest, setForceXmlRequest] = useState(0);
  const nonceRef = useRef(0);

  const nextNonce = (): number => {
    nonceRef.current += 1;
    return nonceRef.current;
  };

  const segmentIssues = issuesForSegment(issues, segmentId);
  const missingTags = missingTagsFor(segment);
  const hasError = segmentIssues.some((issue) => issue.severity === 'error');
  const canRepair = editable && !segment.protected;

  const glossaryHitFor = (issue: TranslationQaIssue): TranslationGlossaryHitView | null => {
    const hits = segment.glossaryHits;
    const byId = issue.termId ? hits.find((hit) => hit.termId === issue.termId) : undefined;
    const byTerm = issue.sourceTerm
      ? hits.find((hit) => hit.sourceTerm === issue.sourceTerm)
      : undefined;
    const hit = byId ?? byTerm ?? null;
    return hit && hit.targetTerm.trim().length > 0 ? hit : null;
  };

  const insertGlossary = (text: string) => {
    onInsertGlossaryTerm(segmentId, text);
  };

  return (
    <div className="review-editor-panel">
      <RichInlineSegmentEditor
        segment={segment}
        value={drafts[segmentId] ?? ''}
        onChange={(next) => onDraftChange(segmentId, next)}
        showTags={showTags}
        missingTags={missingTags}
        insertRequest={insertRequest}
        insertTagRequest={insertTagRequest}
        forceXmlRequest={forceXmlRequest}
        initialRaw={initialRaw}
        showMissingTags={false}
        t={t}
      />

      {segmentIssues.length > 0 ? (
        <div
          className="review-qa-box"
          data-testid={`review-qa-box-${segmentId}`}
          data-severity={hasError ? 'error' : 'warning'}
        >
          <div className="review-qa-box__head">
            <span className="review-qa-box__title">{t('translation.review.qaFixTitle')}</span>
            <span className="review-qa-box__summary">
              {t('translation.review.segmentQa', { count: segmentIssues.length })}
            </span>
          </div>

          <ul className="review-qa-box__list">
            {segmentIssues.map((issue, index) => {
              const hit = issue.code === 'missing_glossary_term' ? glossaryHitFor(issue) : null;
              const canSwitchToXml =
                canRepair &&
                (issue.code === 'xml_malformed' ||
                  (issue.code === 'protected_attr_modified' && missingTags.length === 0));
              return (
                <li
                  key={`${issue.code}-${index}`}
                  className="review-qa-box__item"
                  data-testid={`review-qa-issue-${segmentId}-${index}`}
                  data-code={issue.code}
                >
                  <span
                    className={`review-qa-box__badge ${
                      issue.severity === 'error'
                        ? 'review-qa-box__badge--error'
                        : 'review-qa-box__badge--warning'
                    }`}
                  >
                    {issue.severity === 'error'
                      ? t('translation.review.qaError')
                      : t('translation.review.qaWarning')}
                  </span>
                  <span className="review-qa-box__message">{issue.message}</span>
                  {hit ? (
                    <button
                      type="button"
                      className="review-qa-box__action"
                      data-testid={`review-qa-insert-glossary-${segmentId}-${index}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        insertGlossary(hit.targetTerm);
                      }}
                    >
                      {t('translation.review.qaInsertGlossary', { term: hit.targetTerm })}
                    </button>
                  ) : null}
                  {canSwitchToXml ? (
                    <button
                      type="button"
                      className="review-qa-box__action"
                      data-testid={`review-qa-xml-fix-${segmentId}-${index}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setForceXmlRequest(nextNonce());
                        onEditXml(segmentId);
                      }}
                    >
                      {t('translation.review.qaSwitchXml')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {canRepair && missingTags.length > 0 ? (
            <div
              className="review-missing-tags"
              data-testid={`review-missing-tags-${segmentId}`}
            >
              <span className="review-missing-tags__label">
                {t('translation.review.missingTagBadge', { count: missingTags.length })}
              </span>
              <span className="review-missing-tags__chips">
                {missingTags.map((tag, index) => (
                  <button
                    type="button"
                    key={`${tag.snippet}-${index}`}
                    className="review-chip review-chip--insert"
                    data-testid={`review-insert-tag-${segmentId}-${index}`}
                    title={tag.snippet}
                    onClick={(event) => {
                      event.stopPropagation();
                      setInsertTagRequest({
                        segmentId,
                        snippet: tag.snippet,
                        label: tag.label,
                        nonce: nextNonce(),
                      });
                    }}
                  >
                    <span aria-hidden="true">+</span>
                    {t('translation.review.insertTag', { label: tag.label })}
                  </button>
                ))}
              </span>
            </div>
          ) : null}

          {canRepair ? (
            <button
              type="button"
              className="review-qa-box__ai"
              data-testid={`review-qa-ai-fix-${segmentId}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenRefine(segmentId);
                onInstructionChange(
                  t('translation.review.qaFixInstruction', {
                    issues: segmentIssues.map((issue) => issue.message).join(' '),
                  }),
                );
              }}
            >
              {t('translation.review.qaAiFix')}
            </button>
          ) : null}
        </div>
      ) : null}

      {refine.segmentId === segmentId ? (
        <InlineAiRefinePopover
          t={t}
          segment={segment}
          preview={refine.preview}
          instruction={refine.instruction}
          busy={refine.busy}
          showTags={showTags}
          onInstructionChange={onInstructionChange}
          onRun={onRunRefine}
          onApply={onApplyRefine}
          onClose={onCloseRefine}
        />
      ) : null}
    </div>
  );
}
