import {
  Activity,
  FileCheck2,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Square,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { formatRelativeTime, useI18n, type MessageKey } from '../i18n/index.js';
import type { IdentityResponse } from '../services/identity-api';
import type {
  TranslationAiReviewReport,
  TranslationDitaOtStatus,
  TranslationItemStatus,
  TranslationItemView,
  TranslationJobStatus,
  TranslationJobView,
  TranslationLinkView,
} from '../services/translation-api.js';
import { useTranslationStore } from '../store/translation-store.js';

const JOB_STATUS_KEYS: Record<TranslationJobStatus, MessageKey> = {
  queued: 'translation.jobStatus.queued',
  running: 'translation.jobStatus.running',
  completed: 'translation.jobStatus.completed',
  completed_with_errors: 'translation.jobStatus.completed_with_errors',
  failed: 'translation.jobStatus.failed',
  cancelled: 'translation.jobStatus.cancelled',
};

const ITEM_STATUS_KEYS: Record<TranslationItemStatus, MessageKey> = {
  queued: 'translation.itemStatus.queued',
  ai_translating: 'translation.itemStatus.ai_translating',
  ai_reviewing: 'translation.itemStatus.ai_reviewing',
  validating: 'translation.itemStatus.validating',
  ready_for_review: 'translation.itemStatus.ready_for_review',
  in_review: 'translation.itemStatus.in_review',
  approved_draft: 'translation.itemStatus.approved_draft',
  checked_in: 'translation.itemStatus.checked_in',
  failed: 'translation.itemStatus.failed',
  cancelled: 'translation.itemStatus.cancelled',
};

const JOB_TONE: Record<TranslationJobStatus, string> = {
  queued: 'border-slate-200 bg-slate-50 text-slate-600',
  running: 'border-blue-200 bg-blue-50 text-blue-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  completed_with_errors: 'border-amber-200 bg-amber-50 text-amber-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-slate-200 bg-white text-slate-500',
};

const ITEM_TONE: Record<TranslationItemStatus, string> = {
  queued: 'border-slate-200 bg-slate-50 text-slate-600',
  ai_translating: 'border-blue-200 bg-blue-50 text-blue-700',
  // Phase 16 — the reviewer round reads as its own step, never as "still translating".
  ai_reviewing: 'border-sky-300 bg-sky-50 text-sky-700',
  validating: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  ready_for_review: 'border-violet-200 bg-violet-50 text-violet-700',
  in_review: 'border-violet-300 bg-violet-100 text-violet-800',
  approved_draft: 'border-teal-200 bg-teal-50 text-teal-700',
  checked_in: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  cancelled: 'border-slate-200 bg-white text-slate-500',
};

const AI_VERDICT_KEYS: Record<TranslationAiReviewReport['verdict'], MessageKey> = {
  pass: 'translation.aiReview.verdict.pass',
  revise: 'translation.aiReview.verdict.revise',
  skipped: 'translation.aiReview.verdict.skipped',
  error: 'translation.aiReview.verdict.error',
};

const DITAOT_STATUS_KEYS: Record<TranslationDitaOtStatus, MessageKey> = {
  passed: 'translation.ditaOt.status.passed',
  failed: 'translation.ditaOt.status.failed',
  skipped: 'translation.ditaOt.status.skipped',
};

const AI_VERDICT_TONE: Record<TranslationAiReviewReport['verdict'], string> = {
  pass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  revise: 'border-amber-200 bg-amber-50 text-amber-800',
  skipped: 'border-slate-200 bg-slate-50 text-slate-500',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
};

const DITAOT_TONE: Record<TranslationDitaOtStatus, string> = {
  passed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  skipped: 'border-slate-200 bg-slate-50 text-slate-500',
};

const REVIEWABLE: readonly TranslationItemStatus[] = [
  'ready_for_review',
  'in_review',
  'approved_draft',
];

export interface TranslationQueueTabProps {
  link: TranslationLinkView;
  identity: IdentityResponse | null;
  onOpenReview: (itemId: string) => void;
}

export function TranslationQueueTab({ link, identity, onOpenReview }: TranslationQueueTabProps) {
  const { t, locale } = useI18n();
  const jobs = useTranslationStore((state) => state.jobs);
  const jobsLoading = useTranslationStore((state) => state.jobsLoading);
  const jobsError = useTranslationStore((state) => state.jobsError);
  const jobSnapshot = useTranslationStore((state) => state.jobSnapshot);
  const activeJobId = useTranslationStore((state) => state.activeJobId);
  const streaming = useTranslationStore((state) => state.streaming);
  const streamError = useTranslationStore((state) => state.streamError);
  const actionError = useTranslationStore((state) => state.actionError);
  const loadJobs = useTranslationStore((state) => state.loadJobs);
  const openJob = useTranslationStore((state) => state.openJob);
  const cancelJob = useTranslationStore((state) => state.cancelJob);
  const retryFailed = useTranslationStore((state) => state.retryFailed);
  const assignReviewer = useTranslationStore((state) => state.assignReviewer);

  useEffect(() => {
    void loadJobs({ linkId: link.id });
  }, [link.id, loadJobs]);

  /**
   * Live progress: the first non-terminal job of this pair drives the SSE subscription, so
   * opening the queue during a run shows the same items the worker is writing.
   */
  useEffect(() => {
    if (streaming) return;
    const live = jobs.find((job) => job.status === 'queued' || job.status === 'running');
    if (!live || live.id === activeJobId) return;
    void openJob(live.id);
  }, [jobs, streaming, activeJobId, openJob]);

  const renderJobRow = (job: TranslationJobView) => {
    const active = job.id === activeJobId;
    const percent =
      job.totalItems > 0 ? Math.round((job.completedItems / job.totalItems) * 100) : 0;
    return (
      <button
        key={job.id}
        type="button"
        onClick={() => void openJob(job.id)}
        data-testid={`translation-job-${job.id}`}
        className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          active
            ? 'border-blue-300 bg-blue-50/70'
            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11.5px] font-semibold text-slate-800">
            {t(job.mode === 'full' ? 'translation.queue.mode.full' : 'translation.queue.mode.incremental')}
          </span>
          <span
            className={`inline-flex items-center rounded border px-1.5 py-[1px] text-[10px] font-medium ${JOB_TONE[job.status] ?? JOB_TONE.queued}`}
          >
            {t(JOB_STATUS_KEYS[job.status] ?? 'translation.jobStatus.queued')}
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-1 text-[10px] tabular-nums text-slate-500">
          <span>{t('translation.queue.progress', { done: job.completedItems, total: job.totalItems })}</span>
          <span>{formatRelativeTime(job.createdAt, locale)}</span>
        </div>
        {job.failedItems > 0 ? (
          <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-600">
            <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
            {t('translation.queue.failedCount', { count: job.failedItems })}
          </span>
        ) : null}
      </button>
    );
  };

  const renderItemRow = (item: TranslationItemView) => {
    const reviewers = identity?.users ?? [];
    return (
      <tr key={item.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
        <td className="min-w-0 px-2 py-1.5">
          <div className="truncate font-mono text-[11.5px] text-slate-800" title={item.sourcePath}>
            {item.sourcePath}
          </div>
          <div className="truncate font-mono text-[10.5px] text-slate-400" title={item.targetPath}>
            {item.targetPath}
          </div>
          {item.error ? (
            <div className="mt-0.5 text-[10px] text-rose-600">
              {t('translation.queue.itemError', { message: item.error })}
            </div>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-2 py-1.5">
          <span
            className={`inline-flex items-center rounded border px-1.5 py-[1px] text-[10.5px] font-medium ${ITEM_TONE[item.status] ?? ITEM_TONE.queued}`}
          >
            {item.status === 'ai_reviewing' ? (
              <Loader2 className="mr-0.5 h-2.5 w-2.5 animate-spin" aria-hidden="true" />
            ) : null}
            {t(ITEM_STATUS_KEYS[item.status] ?? 'translation.itemStatus.queued')}
          </span>
          {item.retryCount > 0 ? (
            <span className="ml-1 text-[10px] tabular-nums text-slate-400">
              {t('translation.queue.retryCount', { count: item.retryCount })}
            </span>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-[10.5px] tabular-nums">
          <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1 py-[1px] font-medium text-emerald-700">
            {t('translation.queue.reused', { count: item.reusedSegments })}
          </span>{' '}
          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1 py-[1px] font-medium text-blue-700">
            {t('translation.queue.translated', { count: item.translatedSegments })}
          </span>
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-[10.5px] tabular-nums">
          <span
            className={`inline-flex items-center rounded border px-1 py-[1px] font-medium ${
              item.qaErrorCount > 0
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {t('translation.queue.qaErrors', { count: item.qaErrorCount })}
          </span>{' '}
          <span
            className={`inline-flex items-center rounded border px-1 py-[1px] font-medium ${
              item.qaWarningCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {t('translation.queue.qaWarnings', { count: item.qaWarningCount })}
          </span>

          {/* Phase 16 — the three gates that decide whether this file is safe to apply. */}
          {(item.qaRepairedCount ?? 0) > 0 ||
          item.aiReviewVerdict ||
          item.ditaOtStatus ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {(item.qaRepairedCount ?? 0) > 0 ? (
                <span
                  className="inline-flex items-center rounded border border-teal-200 bg-teal-50 px-1 py-[1px] font-medium text-teal-700"
                  data-testid={`translation-item-qa-repaired-${item.id}`}
                >
                  {t('translation.queue.chip.qaRepaired', { count: item.qaRepairedCount ?? 0 })}
                </span>
              ) : null}
              {item.aiReviewVerdict ? (
                <span
                  className={`inline-flex items-center gap-0.5 rounded border px-1 py-[1px] font-medium ${AI_VERDICT_TONE[item.aiReviewVerdict] ?? AI_VERDICT_TONE.skipped}`}
                  data-testid={`translation-item-ai-review-${item.id}`}
                >
                  <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                  {t('translation.queue.chip.aiReview', {
                    verdict: t(AI_VERDICT_KEYS[item.aiReviewVerdict] ?? AI_VERDICT_KEYS.skipped),
                  })}
                  {(item.aiReviewErrorCount ?? 0) > 0 ? (
                    <span className="tabular-nums">· {item.aiReviewErrorCount}</span>
                  ) : null}
                </span>
              ) : null}
              {item.ditaOtStatus ? (
                <span
                  className={`inline-flex items-center gap-0.5 rounded border px-1 py-[1px] font-medium ${DITAOT_TONE[item.ditaOtStatus] ?? DITAOT_TONE.skipped}`}
                  data-testid={`translation-item-ditaot-${item.id}`}
                >
                  {item.ditaOtStatus === 'failed' && (item.ditaOtErrorCount ?? 0) > 0
                    ? t('translation.queue.chip.ditaOtErrors', {
                        status: t(DITAOT_STATUS_KEYS[item.ditaOtStatus] ?? DITAOT_STATUS_KEYS.skipped),
                        count: item.ditaOtErrorCount ?? 0,
                      })
                    : t('translation.queue.chip.ditaOt', {
                        status: t(DITAOT_STATUS_KEYS[item.ditaOtStatus] ?? DITAOT_STATUS_KEYS.skipped),
                      })}
                </span>
              ) : null}
            </div>
          ) : null}
        </td>
        <td className="whitespace-nowrap px-2 py-1.5">
          <label className="inline-flex items-center gap-1 text-[10.5px] text-slate-500">
            <Users className="h-2.5 w-2.5" aria-hidden="true" />
            <select
              aria-label={t('translation.queue.assignReviewer')}
              value={item.reviewerId ?? ''}
              onChange={(event) => void assignReviewer(item.id, event.target.value || null)}
              className="h-6 rounded border border-slate-200 bg-white px-1 text-[10.5px] text-slate-700 outline-none focus-visible:border-blue-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
            >
              <option value="">{t('translation.queue.unassigned')}</option>
              {reviewers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 text-right">
          {REVIEWABLE.includes(item.status) ? (
            <button
              type="button"
              onClick={() => onOpenReview(item.id)}
              className="rounded-md border border-blue-600 bg-blue-600 px-1.5 py-0.5 text-[10.5px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {t('translation.queue.openReview')}
            </button>
          ) : null}
        </td>
      </tr>
    );
  };

  const job = jobSnapshot?.job ?? null;
  const items = jobSnapshot?.items ?? [];

  if (jobsLoading && jobs.length === 0) {
    return (
      <div className="flex items-center gap-2 py-8 text-[12px] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('translation.loading')}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-center text-[11.5px] text-slate-500">
        {t('translation.queue.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="translation-queue-tab">
      {jobsError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {t('translation.error', { message: jobsError })}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {t('translation.error', { message: actionError })}
        </p>
      ) : null}
      {streamError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          {t('translation.queue.streamError', { message: streamError })}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t('translation.queue.title')}
          </h3>
          {jobs.map(renderJobRow)}
        </div>

        <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
          {!job ? (
            <p className="px-3 py-6 text-center text-[11.5px] text-slate-500">
              {t('translation.queue.selectJob')}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
                <span className="text-[11.5px] font-semibold text-slate-800">
                  {formatRelativeTime(job.createdAt, locale)}
                </span>
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-[1px] text-[10px] font-medium ${JOB_TONE[job.status] ?? JOB_TONE.queued}`}
                >
                  {t(JOB_STATUS_KEYS[job.status] ?? 'translation.jobStatus.queued')}
                </span>
                {streaming ? (
                  <span className="inline-flex items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1 py-[1px] text-[10px] font-medium text-blue-700">
                    <Activity className="h-2.5 w-2.5 animate-pulse" aria-hidden="true" />
                    {t('translation.queue.live')}
                  </span>
                ) : null}
                <span className="text-[10.5px] tabular-nums text-slate-500">
                  {t('translation.queue.progress', {
                    done: job.completedItems,
                    total: job.totalItems,
                  })}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  {job.status === 'queued' || job.status === 'running' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('translation.queue.cancelConfirm'))) {
                          void cancelJob(job.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Square className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('translation.queue.cancel')}
                    </button>
                  ) : null}
                  {job.failedItems > 0 ? (
                    <button
                      type="button"
                      onClick={() => void retryFailed(job.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                    >
                      <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('translation.queue.retryFailed')}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="h-1 w-full bg-slate-100">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${
                      job.totalItems > 0 ? Math.round((job.completedItems / job.totalItems) * 100) : 0
                    }%`,
                  }}
                />
              </div>

              {/* Phase 16 — the job-level strict gate is a summary, not a toast: it stays visible
                  next to the file table so "passed with 2 auto-repairs" is readable at a glance. */}
              {job.validationReport ? (
                <div
                  className={`flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5 text-[10.5px] ${
                    job.validationReport.status === 'failed'
                      ? 'bg-rose-50/60'
                      : job.validationReport.status === 'passed'
                        ? 'bg-emerald-50/50'
                        : 'bg-slate-50/60'
                  }`}
                  data-testid="translation-job-validation"
                >
                  <FileCheck2 className="h-3 w-3 text-slate-500" aria-hidden="true" />
                  <span className="font-semibold text-slate-700">
                    {t('translation.queue.validation.title')}
                  </span>
                  <span
                    className={`inline-flex items-center rounded border px-1 py-[1px] font-medium ${DITAOT_TONE[job.validationReport.status] ?? DITAOT_TONE.skipped}`}
                    data-testid="translation-job-validation-status"
                  >
                    {t(DITAOT_STATUS_KEYS[job.validationReport.status] ?? DITAOT_STATUS_KEYS.skipped)}
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {t('translation.queue.validation.files', {
                      count: job.validationReport.checkedFiles,
                    })}
                  </span>
                  {job.validationReport.repairedFiles > 0 ? (
                    <span className="inline-flex items-center rounded border border-teal-200 bg-teal-50 px-1 py-[1px] font-medium tabular-nums text-teal-700">
                      {t('translation.queue.validation.repaired', {
                        count: job.validationReport.repairedFiles,
                      })}
                    </span>
                  ) : null}
                  {job.validationReport.remainingErrorFiles > 0 ? (
                    <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1 py-[1px] font-medium tabular-nums text-rose-700">
                      {t('translation.queue.validation.remaining', {
                        count: job.validationReport.remainingErrorFiles,
                      })}
                    </span>
                  ) : null}
                  <span className="tabular-nums text-slate-400">
                    {t('translation.queue.validation.duration', {
                      ms: job.validationReport.durationMs,
                    })}
                  </span>
                  {job.validationReport.reason ? (
                    <span className="min-w-0 truncate text-slate-500">
                      {t('translation.queue.validation.reason', {
                        reason: job.validationReport.reason,
                      })}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="dita-scroller">
                <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-1.5 font-medium">{t('translation.files.colPath')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('translation.files.colStatus')}</th>
                    <th className="px-2 py-1.5 font-medium">{t('translation.queue.items')}</th>
                    <th className="px-2 py-1.5 font-medium">QA</th>
                    <th className="px-2 py-1.5 font-medium">{t('translation.queue.assignReviewer')}</th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      {t('translation.files.colActions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-5 text-center text-[11.5px] text-slate-500">
                        {t('translation.queue.noItems')}
                      </td>
                    </tr>
                  ) : (
                    items.map(renderItemRow)
                  )}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
