/**
 * Phase 14 — the document ingest wizard shell.
 *
 * One `<dialog>`-like overlay that owns the whole lifecycle: upload → parse → review →
 * write → result. The job stream is subscribed exactly once per job id and aborted on close,
 * so navigating away never leaves a dangling SSE connection (or a leaked `reader`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Ban, Loader2, Sparkles, X } from 'lucide-react';
import type { IngestJobResult } from '@dita/core';
import { useI18n } from '../i18n/index.js';
import { useAiStore } from '../ai/ai-store.js';
import type {
  IngestJobUpload,
  IngestJobView,
  IngestLogEntry,
  IngestMarkdownView,
  IngestOutlinePlan,
  IngestParserPublicConfig,
  IngestParserRuntimeDetection,
  IngestReplanOptions,
  IngestStreamHandlers,
} from '../services/ingest-api.js';
import {
  approveIngestJob,
  cancelIngestJob,
  countIngestRepairs,
  createIngestJob,
  fetchIngestConfig,
  fetchIngestJob,
  fetchIngestMarkdown,
  isIngestTerminal,
  replanIngestJob,
  subscribeIngestStream,
  testIngestConfig,
  updateIngestMarkdown,
} from '../services/ingest-api.js';
import { IngestUploadStep } from './IngestUploadStep.js';
import { IngestPlanReviewStep } from './IngestPlanReviewStep.js';
import { IngestProgressStep } from './IngestProgressStep.js';
import { IngestResultStep } from './IngestResultStep.js';
import {
  INGEST_STEPS,
  type IngestMountContext,
  type IngestOrigin,
  type IngestTargetMode,
  type IngestWizardStep,
} from './types.js';

export interface DocumentIngestDialogProps {
  open: boolean;
  origin: IngestOrigin;
  /** Existing manual worked on (editor origin); omitted for `new_manual` imports. */
  manualId?: string;
  branch?: string;
  /** Set when the map tree asked to mount the generated topics at a specific node. */
  mountContext?: IngestMountContext | null;
  /** `new_manual` for the workbench hub, `single_topic` / `multi_topic` for the editor. */
  defaultTargetMode?: IngestTargetMode;
  /** Opens the AI settings dialog when the LLM key is missing. */
  onOpenSettings?: () => void;
  onClose: () => void;
  onManualCreated?: (manualId: string) => void;
  onTopicsMaterialized?: (result: IngestJobResult, job: IngestJobView) => void;
  /** "Open" a single generated topic from the result list. */
  onOpenTopic?: (filePath: string) => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DocumentIngestDialog({
  open,
  origin,
  manualId,
  branch,
  mountContext,
  defaultTargetMode,
  onOpenSettings,
  onClose,
  onManualCreated,
  onTopicsMaterialized,
  onOpenTopic,
}: DocumentIngestDialogProps) {
  const { t } = useI18n();
  const aiConfig = useAiStore((state) => state.config);
  const loadAiConfig = useAiStore((state) => state.loadConfig);

  const [step, setStep] = useState<IngestWizardStep>('upload');
  const [config, setConfig] = useState<IngestParserPublicConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [detection, setDetection] = useState<IngestParserRuntimeDetection | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [job, setJob] = useState<IngestJobView | null>(null);
  const [streamJobId, setStreamJobId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [logs, setLogs] = useState<IngestLogEntry[]>([]);

  const [markdown, setMarkdown] = useState<IngestMarkdownView | null>(null);
  const [markdownLoading, setMarkdownLoading] = useState(false);
  const [markdownError, setMarkdownError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handlersRef = useRef<IngestStreamHandlers>({});

  const targetMode: IngestTargetMode =
    defaultTargetMode ?? (origin === 'hub' ? 'new_manual' : 'multi_topic');

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      setConfig(await fetchIngestConfig());
    } catch (error) {
      setConfigError(messageOf(error));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const probe = useCallback(async () => {
    setProbing(true);
    setProbeError(null);
    try {
      setDetection(await testIngestConfig());
    } catch (error) {
      setProbeError(messageOf(error));
    } finally {
      setProbing(false);
    }
  }, []);

  /* Reset everything when the dialog opens; abort the stream when it closes. */
  useEffect(() => {
    if (!open) {
      setStreamJobId(null);
      return;
    }
    setStep('upload');
    setJob(null);
    setLogs([]);
    setMarkdown(null);
    setMarkdownError(null);
    setReviewError(null);
    setReviewNotice(null);
    setCreateError(null);
    setStreamError(null);
    setDetection(null);
    setProbeError(null);
    setStreamJobId(null);
    void loadConfig();
    void loadAiConfig();
  }, [open, loadConfig, loadAiConfig]);

  /* Probing shells out to the parsers, so it stays admin-only and runs at most once per open. */
  useEffect(() => {
    if (!open || !config?.canEdit) return;
    void probe();
  }, [open, config?.canEdit, probe]);

  const openReview = useCallback(async (jobId: string) => {
    setStep('review');
    setMarkdownLoading(true);
    setMarkdownError(null);
    try {
      setMarkdown(await fetchIngestMarkdown(jobId));
    } catch (error) {
      setMarkdownError(messageOf(error));
    } finally {
      setMarkdownLoading(false);
    }
  }, []);

  /* One subscription per job; handlers read the latest job from a ref to stay stable. */
  useEffect(() => {
    if (!open || !streamJobId) return;
    const controller = new AbortController();

    handlersRef.current = {
      onSnapshot: (snapshot) => {
        setJob(snapshot);
        if (snapshot.status === 'awaiting_plan_approval') void openReview(snapshot.id);
        else if (isIngestTerminal(snapshot.status)) setStep('result');
        else if (snapshot.status !== 'queued' && snapshot.status !== 'parsing' && snapshot.status !== 'planning') {
          setStep('progress');
        }
      },
      onStatus: (event) => {
        setJob((previous) =>
          previous ? { ...previous, status: event.status, progress: event.progress ?? previous.progress } : previous,
        );
        if (event.status === 'awaiting_plan_approval') {
          void openReview(streamJobId);
          return;
        }
        if (isIngestTerminal(event.status)) {
          setStep('result');
          return;
        }
        if (event.status === 'writing' || event.status === 'validating' || event.status === 'repairing' || event.status === 'materializing') {
          setStep('progress');
        }
      },
      onLog: (entry) => {
        setLogs((previous) => [...previous.slice(-199), entry]);
      },
      onPlanReady: (event) => {
        setJob((previous) =>
          previous ? { ...previous, plan: event.plan, assets: event.assets } : previous,
        );
      },
      onTopicProgress: (topic) => {
        setJob((previous) => {
          if (!previous) return previous;
          const progress = previous.progress;
          if (!progress) {
            return {
              ...previous,
              progress: {
                stage: previous.status,
                percent: 0,
                planReady: true,
                topics: [topic],
                updatedAt: Date.now(),
              },
            };
          }
          const topics = progress.topics.some((entry) => entry.topicId === topic.topicId)
            ? progress.topics.map((entry) => (entry.topicId === topic.topicId ? topic : entry))
            : [...progress.topics, topic];
          return { ...previous, progress: { ...progress, topics } };
        });
      },
      onValidation: (report) => {
        setJob((previous) => (previous ? { ...previous, validation: report } : previous));
      },
      onDone: (finished) => {
        setJob(finished);
        setStep('result');
      },
      onCancelled: (cancelled) => {
        setJob(cancelled);
        setStep('result');
      },
      onError: (message) => {
        setStreamError(t('ingest.error.jobFailed', { message }));
        void fetchIngestJob(streamJobId)
          .then((next) => setJob(next))
          .catch(() => {});
      },
    };

    const run = async () => {
      try {
        await subscribeIngestStream(streamJobId, handlersRef.current, controller.signal);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setStreamError(t('ingest.error.streamLost', { message: messageOf(error) }));
      }
    };
    void run();
    return () => controller.abort();
  }, [open, streamJobId, openReview, t]);

  const handleSubmit = async (upload: IngestJobUpload) => {
    setCreating(true);
    setCreateError(null);
    setLogs([]);
    try {
      const created = await createIngestJob(upload);
      setJob(created);
      setStreamJobId(created.id);
      if (created.status === 'awaiting_plan_approval') {
        await openReview(created.id);
      } else if (isIngestTerminal(created.status)) {
        setStep('result');
      } else {
        setStep('parsing');
      }
    } catch (error) {
      setCreateError(t('ingest.error.createFailed', { message: messageOf(error) }));
    } finally {
      setCreating(false);
    }
  };

  const handleReplan = async (markdownText: string, options: IngestReplanOptions) => {
    if (!job) return;
    setReviewBusy(true);
    setReviewError(null);
    setReviewNotice(null);
    try {
      await updateIngestMarkdown(job.id, markdownText);
      const next = await replanIngestJob(job.id, options);
      setJob(next);
      setMarkdown(await fetchIngestMarkdown(job.id));
      setReviewNotice(t('ingest.review.markdownSaved'));
    } catch (error) {
      setReviewError(t('ingest.error.replanFailed', { message: messageOf(error) }));
    } finally {
      setReviewBusy(false);
    }
  };

  const handleApprove = async (plan: IngestOutlinePlan) => {
    if (!job) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      const next = await approveIngestJob(job.id, plan);
      setJob(next);
      setStep('progress');
    } catch (error) {
      setReviewError(t('ingest.error.approveFailed', { message: messageOf(error) }));
    } finally {
      setReviewBusy(false);
    }
  };

  const handleCancelJob = async () => {
    if (!job) return;
    setCancelling(true);
    try {
      const next = await cancelIngestJob(job.id);
      setJob(next);
      setStep('result');
    } catch (error) {
      setStreamError(t('ingest.error.cancelFailed', { message: messageOf(error) }));
    } finally {
      setCancelling(false);
    }
  };

  /* "Back" abandons the job (it is cancelled server-side) and returns to the upload step. */
  const handleBack = () => {
    if (job && !isIngestTerminal(job.status)) void cancelIngestJob(job.id).catch(() => {});
    setStreamJobId(null);
    setJob(null);
    setLogs([]);
    setMarkdown(null);
    setReviewError(null);
    setReviewNotice(null);
    setStreamError(null);
    setStep('upload');
  };

  const handleRestart = () => {
    setStreamJobId(null);
    setJob(null);
    setLogs([]);
    setMarkdown(null);
    setStreamError(null);
    setCreateError(null);
    setStep('upload');
  };

  const handleClose = () => {
    setStreamJobId(null);
    onClose();
  };

  const handleOpenCreated = () => {
    if (!job) return;
    const createdManualId = job.result?.manualId ?? job.createdManualId;
    if (createdManualId) onManualCreated?.(createdManualId);
    handleClose();
  };

  const handleOpenDrafts = () => {
    if (!job) return;
    if (job.result) onTopicsMaterialized?.(job.result, job);
    handleClose();
  };

  const handleOpenTopic = (filePath: string) => {
    onOpenTopic?.(filePath);
    handleClose();
  };

  if (!open) return null;

  const stepIndex = INGEST_STEPS.indexOf(step);
  const title =
    origin === 'hub' || targetMode === 'new_manual'
      ? t('ingest.title.newManual')
      : t('ingest.title.existingManual');
  const repairs = countIngestRepairs(job?.validation ?? null);

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="flex max-h-[92vh] w-[min(1080px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
              {title}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{t('ingest.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('ingest.closeAria')}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div
          aria-label={t('ingest.stepOf', { current: stepIndex + 1, total: INGEST_STEPS.length })}
          className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-4 py-1.5"
        >
          {INGEST_STEPS.map((entry, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'active' : 'todo';
            return (
              <div key={entry} className="flex min-w-0 flex-1 items-center gap-1">
                <span
                  className={`inline-flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium ${
                    state === 'done'
                      ? 'bg-emerald-50 text-emerald-700'
                      : state === 'active'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400'
                  }`}
                >
                  <span className="font-mono">{index + 1}</span>
                  <span className="truncate">{t(`ingest.step.${entry}`)}</span>
                </span>
                {index < INGEST_STEPS.length - 1 ? (
                  <span className={`h-px flex-1 ${index < stepIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="dita-scroller min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {step === 'upload' ? (
            <IngestUploadStep
              origin={origin}
              {...(manualId ? { manualId } : {})}
              {...(branch ? { branch } : {})}
              mountContext={mountContext ?? null}
              defaultTargetMode={targetMode}
              config={config}
              configLoading={configLoading}
              detection={detection}
              probing={probing}
              probeError={probeError ?? configError}
              onProbe={() => void probe()}
              llmConfigured={aiConfig ? aiConfig.configured : null}
              canConfigureLlm={aiConfig?.canEdit ?? false}
              {...(onOpenSettings ? { onOpenSettings } : {})}
              submitting={creating}
              submitError={createError}
              onSubmit={(upload) => void handleSubmit(upload)}
              onCancel={handleClose}
            />
          ) : null}

          {step === 'parsing' ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
              <p className="text-[12px] font-medium text-slate-800">{t('ingest.parsing.title')}</p>
              <p className="max-w-[42ch] text-center text-[10.5px] text-slate-500">{t('ingest.parsing.body')}</p>
              {job && job.progress ? (
                <p className="text-[10px] text-slate-400">
                  {t('ingest.progress.percent', { percent: Math.round(job.progress.percent) })}
                </p>
              ) : null}
              {streamError ? (
                <p className="mt-1 flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {streamError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCancelJob()}
                disabled={cancelling || !job}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-40"
              >
                {cancelling ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Ban className="h-3 w-3" aria-hidden="true" />
                )}
                {t('ingest.parsing.cancel')}
              </button>
            </div>
          ) : null}

          {step === 'review' && job ? (
            <IngestPlanReviewStep
              job={job}
              markdown={markdown}
              markdownLoading={markdownLoading}
              markdownError={markdownError}
              busy={reviewBusy}
              error={reviewError}
              notice={reviewNotice}
              onReplan={(markdownText, options) => void handleReplan(markdownText, options)}
              onApprove={(plan) => void handleApprove(plan)}
              onBack={handleBack}
              onCancelJob={() => void handleCancelJob()}
            />
          ) : null}

          {step === 'progress' && job ? (
            <IngestProgressStep
              job={job}
              logs={logs}
              cancelling={cancelling}
              error={streamError}
              onCancel={() => void handleCancelJob()}
            />
          ) : null}

          {step === 'result' && job ? (
            <IngestResultStep
              job={job}
              onOpenManual={handleOpenCreated}
              onOpenDrafts={handleOpenDrafts}
              onOpenTopic={handleOpenTopic}
              onRestart={handleRestart}
              onClose={handleClose}
            />
          ) : null}
        </div>

        {step === 'result' && repairs > 0 ? (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-[9.5px] text-slate-500">
            {t('ingest.result.repairs', { count: repairs })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
