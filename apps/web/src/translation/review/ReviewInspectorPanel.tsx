/**
 * Collapsible inspector: glossary matches, live QA and the two Phase 16 gates.
 *
 * Order matters: glossary → live QA (deterministic, computed in the browser) → reviewer AI report
 * → DITA-OT strict. That is the same order the pipeline runs, so a reviewer reading top-down walks
 * the file through the same gates it had to pass.
 */
import { AlertTriangle, BookMarked, CheckCircle2, Info, Loader2, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import type { TranslationQaIssue } from '@dita/core';
import type {
  TranslationAiReviewReport,
  TranslationDitaOtItemReport,
  TranslationGlossaryHitView,
} from '../../services/translation-api.js';
import {
  AI_REVIEW_CATEGORY_KEYS,
  AI_VERDICT_KEYS,
  DITAOT_STATUS_KEYS,
  type Translator,
} from './review-shared.js';

export interface ReviewInspectorPanelProps {
  t: Translator;
  glossaryHits: TranslationGlossaryHitView[];
  issues: TranslationQaIssue[];
  errorCount: number;
  warningCount: number;
  onInsertTerm: (hit: TranslationGlossaryHitView) => void;
  onSelectSegment: (segmentId: string) => void;
  onClose: () => void;
  /** Phase 16 — reviewer AI report for the open item (absent while the pair has it disabled). */
  aiReview?: TranslationAiReviewReport | null;
  /** Phase 16 — DITA-OT strict result for the open item. */
  ditaOtReport?: TranslationDitaOtItemReport | null;
  onRerunStrict?: () => void;
  validatingStrict?: boolean;
}

export function ReviewInspectorPanel({
  t,
  glossaryHits,
  issues,
  errorCount,
  warningCount,
  onInsertTerm,
  onSelectSegment,
  onClose,
  aiReview = null,
  ditaOtReport = null,
  onRerunStrict,
  validatingStrict = false,
}: ReviewInspectorPanelProps) {
  return (
    <aside className="review-inspector" data-testid="review-inspector" aria-label={t('translation.review.inspectorShow')}>
      <div className="review-inspector__head">
        <h2 className="review-inspector__title">{t('translation.review.termsColumn')}</h2>
        <button type="button" className="review-link-button" onClick={onClose}>
          {t('translation.review.inspectorHide')}
        </button>
      </div>

      <p className="review-inspector__summary">
        {t('translation.review.glossaryMatched', { count: glossaryHits.length })}
      </p>
      <div className="review-inspector__terms" data-testid="review-glossary-hits">
        {glossaryHits.length === 0 ? (
          <p className="review-inspector__empty">{t('translation.review.glossaryEmpty')}</p>
        ) : (
          glossaryHits.map((hit) => (
            <div key={hit.termId} className="review-term-card" data-testid={`review-glossary-${hit.termId}`}>
              <div className="review-term-card__head">
                <BookMarked className="h-3 w-3" aria-hidden="true" />
                <span className="review-term-card__source">{hit.sourceTerm}</span>
                <span className="review-term-card__arrow" aria-hidden="true">
                  →
                </span>
                <span className="review-term-card__target">{hit.targetTerm}</span>
              </div>
              {hit.contextNote ? <p className="review-term-card__note">{hit.contextNote}</p> : null}
              <div className="review-term-card__flags">
                {hit.doNotTranslate ? <span className="review-pill">{t('translation.review.dnt')}</span> : null}
                {hit.forbiddenTargets.length > 0 ? (
                  <span className="review-pill review-pill--danger">
                    {t('translation.review.forbidden')}: {hit.forbiddenTargets.join(', ')}
                  </span>
                ) : null}
                {hit.caseSensitive ? <span className="review-pill">{t('translation.review.contextNote')}</span> : null}
              </div>
              <button
                type="button"
                className="review-button review-button--quiet"
                data-testid={`review-insert-${hit.termId}`}
                onClick={() => onInsertTerm(hit)}
              >
                {t('translation.review.insert')}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="review-inspector__head review-inspector__head--qa">
        <h2 className="review-inspector__title">{t('translation.review.qaIssues')}</h2>
        <span className="review-inspector__counts">
          {t('translation.review.qaSummary', { errors: errorCount, warnings: warningCount })}
        </span>
      </div>
      <div className="review-inspector__issues" data-testid="review-qa-list">
        {issues.length === 0 ? (
          <p className="review-inspector__empty">{t('translation.review.qaClean')}</p>
        ) : (
          issues.map((issue, index) => (
            <button
              key={`${issue.code}-${issue.segmentId ?? 'doc'}-${index}`}
              type="button"
              className={`review-issue ${issue.severity === 'error' ? 'review-issue--error' : 'review-issue--warning'}`}
              data-testid={`review-qa-issue-${index}`}
              disabled={!issue.segmentId}
              onClick={() => issue.segmentId && onSelectSegment(issue.segmentId)}
            >
              {issue.severity === 'error' ? (
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Info className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="review-issue__message">{issue.message}</span>
              {issue.segmentId ? (
                <span className="review-issue__jump">{t('translation.review.jumpToSegment')}</span>
              ) : null}
            </button>
          ))
        )}
      </div>

      {/* ---------------------------------------------- reviewer AI report */}
      <div className="review-inspector__head review-inspector__head--qa">
        <h2 className="review-inspector__title">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {t('translation.review.aiReviewTitle')}
        </h2>
        {aiReview ? (
          <span className="inline-flex items-center gap-1">
            <span
              className={`review-pill review-pill--${aiReview.verdict}`}
              data-testid="review-ai-verdict"
            >
              {t(AI_VERDICT_KEYS[aiReview.verdict])}
            </span>
            {aiReview.stale ? (
              <span className="review-pill review-pill--stale" data-testid="review-ai-stale">
                {t('translation.aiReview.stale')}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="review-ai-card" data-testid="review-ai-review">
        {!aiReview ? (
          <p className="review-inspector__empty">{t('translation.review.aiReviewEmpty')}</p>
        ) : (
          <>
            <p className="review-ai-card__model">
              {aiReview.model
                ? t('translation.review.aiReviewModel', { model: aiReview.model })
                : t('translation.review.aiReviewNoModel')}
              {' · '}
              <span className="review-ai-card__scope">
                {aiReview.isDedicatedModel
                  ? t('translation.review.aiReviewDedicated')
                  : t('translation.review.aiReviewInherited')}
              </span>
            </p>
            <p className="review-ai-card__stats" data-testid="review-ai-qa-stats">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              {t('translation.review.aiReviewQaStats', {
                initial: aiReview.initialQaErrors,
                remaining: aiReview.remainingQaErrors,
                repaired: aiReview.repairedSegments,
                rounds: aiReview.qaRepairRounds,
              })}
              {' · '}
              {t('translation.review.aiReviewRounds', { rounds: aiReview.reviewRounds })}
            </p>
            {aiReview.summary ? (
              <div className="review-ai-card__summary">
                <p className="review-ai-card__label">{t('translation.review.aiReviewSummary')}</p>
                <p data-testid="review-ai-summary">{aiReview.summary}</p>
              </div>
            ) : null}

            <div className="review-ai-card__issues">
              <p className="review-ai-card__label">
                {t('translation.review.aiReviewIssues', { count: aiReview.issues.length })}
              </p>
              {aiReview.issues.length === 0 ? (
                <p className="review-inspector__empty">
                  {t('translation.review.aiReviewIssuesEmpty')}
                </p>
              ) : (
                aiReview.issues.map((issue, index) => (
                  <button
                    key={`${issue.segmentId}-${issue.category}-${index}`}
                    type="button"
                    className={`review-ai-issue review-ai-issue--${issue.severity}`}
                    data-testid={`review-ai-issue-${index}`}
                    title={t('translation.review.aiReviewJump')}
                    onClick={() => issue.segmentId && onSelectSegment(issue.segmentId)}
                  >
                    <span className="review-ai-issue__head">
                      {issue.severity === 'error' ? (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Info className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span className="review-ai-issue__category">
                        {t(AI_REVIEW_CATEGORY_KEYS[issue.category])}
                      </span>
                      <span className="review-ai-issue__jump">
                        {t('translation.review.jumpToSegment')}
                      </span>
                    </span>
                    <span className="review-ai-issue__message">{issue.message}</span>
                    {issue.suggestion ? (
                      <span className="review-ai-issue__suggestion">{issue.suggestion}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------------------------------------------- DITA-OT strict gate */}
      <div className="review-inspector__head review-inspector__head--qa">
        <h2 className="review-inspector__title">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          {t('translation.review.ditaOtTitle')}
        </h2>
        {ditaOtReport ? (
          <span
            className={`review-pill review-pill--ditaot-${ditaOtReport.status}`}
            data-testid="review-ditaot-status"
          >
            {t(DITAOT_STATUS_KEYS[ditaOtReport.status])}
          </span>
        ) : null}
      </div>

      <div className="review-ditaot-card" data-testid="review-ditaot">
        {!ditaOtReport ? (
          <p className="review-inspector__empty">{t('translation.review.ditaOtEmpty')}</p>
        ) : (
          <>
            <div className="review-ditaot-card__flags">
              {ditaOtReport.repaired ? (
                <span className="review-pill review-pill--repaired" data-testid="review-ditaot-repaired">
                  {t('translation.review.ditaOtRepaired')}
                </span>
              ) : null}
              {ditaOtReport.stale ? (
                <span className="review-pill review-pill--stale" data-testid="review-ditaot-stale">
                  {t('translation.ditaOt.stale')}
                </span>
              ) : null}
              <span className="review-ditaot-card__counts" data-testid="review-ditaot-counts">
                {t('translation.review.ditaOtCounts', {
                  errors: ditaOtReport.errorCount,
                  warnings: ditaOtReport.warningCount,
                })}
              </span>
              {ditaOtReport.repairAttempts > 0 ? (
                <span className="review-ditaot-card__counts">
                  {t('translation.review.ditaOtAttempts', { count: ditaOtReport.repairAttempts })}
                </span>
              ) : null}
            </div>

            {ditaOtReport.status === 'skipped' && ditaOtReport.reason ? (
              <p className="review-ditaot-card__reason" data-testid="review-ditaot-reason">
                {t('translation.review.ditaOtReason', { reason: ditaOtReport.reason })}
              </p>
            ) : null}

            <div className="review-ditaot-card__diagnostics">
              <p className="review-ai-card__label">
                {t('translation.review.ditaOtDiagnostics', {
                  count: ditaOtReport.diagnostics.length,
                })}
              </p>
              {ditaOtReport.diagnostics.length === 0 ? (
                <p className="review-inspector__empty">
                  {t('translation.review.ditaOtNoDiagnostics')}
                </p>
              ) : (
                ditaOtReport.diagnostics.map((diagnostic, index) => (
                  <div
                    key={`${diagnostic.code ?? 'diag'}-${index}`}
                    className={`review-ditaot-diagnostic review-ditaot-diagnostic--${diagnostic.severity}`}
                    data-testid={`review-ditaot-diagnostic-${index}`}
                  >
                    <span className="review-ditaot-diagnostic__head">
                      {diagnostic.severity === 'error' ? (
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Info className="h-3 w-3" aria-hidden="true" />
                      )}
                      {diagnostic.code ? (
                        <span className="review-ditaot-diagnostic__code">{diagnostic.code}</span>
                      ) : null}
                      {diagnostic.filePath ? (
                        <span className="review-ditaot-diagnostic__path">
                          {diagnostic.filePath}
                          {typeof diagnostic.line === 'number' ? `:${diagnostic.line}` : ''}
                          {typeof diagnostic.column === 'number' ? `:${diagnostic.column}` : ''}
                        </span>
                      ) : null}
                    </span>
                    <span className="review-ditaot-diagnostic__message">{diagnostic.message}</span>
                  </div>
                ))
              )}
            </div>

            {onRerunStrict ? (
              <button
                type="button"
                className="review-button review-button--quiet"
                data-testid="review-rerun-strict"
                disabled={validatingStrict}
                onClick={onRerunStrict}
              >
                {validatingStrict ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                )}
                {validatingStrict
                  ? t('translation.review.ditaOtRunning')
                  : t('translation.review.ditaOtRerun')}
              </button>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
