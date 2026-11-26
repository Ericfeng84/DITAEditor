/**
 * Step 4 — live generation progress.
 *
 * All numbers here come from the job snapshot the SSE stream keeps refreshing, so the screen
 * stays correct even if a frame is missed: `progress.percent` is monotonic server-side and
 * `progress.topics` is the authoritative per-topic state.
 */

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode2,
  Loader2,
  Wrench,
} from 'lucide-react';
import type { IngestJobView, IngestLogEntry, IngestTopicProgress } from '../services/ingest-api.js';
import { useI18n } from '../i18n/index.js';
import { INGEST_PROGRESS_STAGES, progressStageIndex } from './types.js';

export interface IngestProgressStepProps {
  job: IngestJobView;
  logs: IngestLogEntry[];
  cancelling: boolean;
  error: string | null;
  onCancel: () => void;
}

type TopicStatus = IngestTopicProgress['status'];

const TOPIC_TONE: Record<TopicStatus, string> = {
  pending: 'border-slate-200 bg-white text-slate-500',
  writing: 'border-blue-200 bg-blue-50 text-blue-700',
  written: 'border-blue-200 bg-blue-50 text-blue-700',
  validating: 'border-amber-200 bg-amber-50 text-amber-800',
  repairing: 'border-amber-300 bg-amber-100 text-amber-900',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-rose-200 bg-rose-50 text-rose-800',
};

const LOG_TONE: Record<IngestLogEntry['level'], string> = {
  info: 'text-slate-500',
  warn: 'text-amber-700',
  error: 'text-rose-700',
};

function TopicIcon({ status }: { status: TopicStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-3 w-3" aria-hidden="true" />;
  if (status === 'failed') return <AlertCircle className="h-3 w-3" aria-hidden="true" />;
  if (status === 'repairing') return <Wrench className="h-3 w-3" aria-hidden="true" />;
  if (status === 'writing' || status === 'validating' || status === 'written') {
    return <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />;
  }
  return <Circle className="h-3 w-3" aria-hidden="true" />;
}

export function IngestProgressStep({
  job,
  logs,
  cancelling,
  error,
  onCancel,
}: IngestProgressStepProps) {
  const { t } = useI18n();
  const [showLogs, setShowLogs] = useState(false);
  // A failed/cancelled job must stay on the stage where it stopped (`failed` has no stage of its
  // own, and `stageIndex('failed')` would collapse back to `parsing`).
  const stopped = job.status === 'failed' || job.status === 'cancelled';
  const currentIndex = progressStageIndex(job);
  const topics = useMemo(() => job.progress?.topics ?? [], [job.progress]);
  const percent = Math.max(0, Math.min(100, Math.round(job.progress?.percent ?? 0)));
  const doneCount = topics.filter((topic) => topic.status === 'done').length;
  const failedCount = topics.filter((topic) => topic.status === 'failed').length;
  const latest = logs[logs.length - 1];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-semibold text-slate-800">{t('ingest.progress.title')}</h3>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-600">
          {t('ingest.progress.percent', { percent })}
        </span>
        <span className="text-[9.5px] text-slate-400">
          {doneCount} / {topics.length}
        </span>
        {latest ? (
          <span className="ml-auto max-w-[46%] truncate text-[9.5px] text-slate-400" title={latest.message}>
            {latest.message}
          </span>
        ) : null}
      </div>

      <ol className="flex items-center gap-1">
        {INGEST_PROGRESS_STAGES.map((stage, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'todo';
          return (
            <li key={stage} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className={`inline-flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium ${
                  state === 'done'
                    ? 'bg-emerald-50 text-emerald-700'
                    : state === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {state === 'done' ? (
                  <CheckCircle2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                ) : state === 'active' ? (
                  stopped ? (
                    <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden="true" />
                  )
                ) : null}
                <span className="truncate">{t(`ingest.progress.stage.${stage}`)}</span>
              </span>
              {index < INGEST_PROGRESS_STAGES.length - 1 ? (
                <span className={`h-px flex-1 ${index < currentIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            failedCount > 0 ? 'bg-rose-500' : 'bg-blue-600'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <section className="rounded-lg border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-2.5 py-1">
          <span className="text-[10.5px] font-semibold text-slate-700">{t('ingest.progress.topics')}</span>
          {failedCount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-rose-700">
              <AlertCircle className="h-3 w-3" aria-hidden="true" />
              {failedCount}
            </span>
          ) : null}
        </div>
        <div className="dita-scroller max-h-[240px] overflow-y-auto p-2">
          {topics.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t('common.loading')}
            </p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {topics.map((topic) => (
                <li
                  key={topic.topicId}
                  className={`rounded border px-1.5 py-1 ${TOPIC_TONE[topic.status]}`}
                  title={topic.error ?? topic.filePath}
                >
                  <div className="flex items-center gap-1">
                    <TopicIcon status={topic.status} />
                    <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium">
                      {topic.title || topic.filePath}
                    </span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide opacity-70">
                      {t(`ingest.progress.topic.${topic.status}`)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] opacity-70">
                    <FileCode2 className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    <span className="truncate font-mono">{topic.filePath}</span>
                  </div>
                  {topic.attempts > 0 ? (
                    <p className="text-[9px] opacity-80">
                      {t('ingest.progress.attempts', { count: topic.attempts })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => setShowLogs((value) => !value)}
          aria-expanded={showLogs}
          className="flex w-full items-center gap-1 px-2.5 py-1 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          {showLogs ? (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          )}
          {showLogs ? t('ingest.progress.hideLogs') : t('ingest.progress.showLogs')}
          <span className="ml-auto rounded bg-slate-100 px-1 text-[9px] font-medium text-slate-500">
            {logs.length}
          </span>
        </button>
        {showLogs ? (
          <div className="dita-scroller max-h-[160px] overflow-y-auto border-t border-slate-200 bg-slate-950/95 px-2 py-1.5">
            {logs.length === 0 ? (
              <p className="text-[9.5px] text-slate-400">{t('ingest.progress.noLogs')}</p>
            ) : (
              <ul className="space-y-0.5 font-mono text-[9.5px] leading-relaxed">
                {logs.map((entry, index) => (
                  <li
                    key={`${index}-${entry.message}`}
                    className={entry.level === 'info' ? 'text-slate-300' : LOG_TONE[entry.level]}
                  >
                    <span className="mr-1 opacity-50">{entry.level}</span>
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling || job.cancelRequested}
          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {cancelling ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Ban className="h-3 w-3" aria-hidden="true" />
          )}
          {cancelling ? t('ingest.progress.cancelling') : t('ingest.progress.cancel')}
        </button>
      </div>
    </div>
  );
}
