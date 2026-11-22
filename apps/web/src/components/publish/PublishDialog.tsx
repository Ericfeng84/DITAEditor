import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  FileText,
  Globe2,
  History,
  Loader2,
  Package,
  RefreshCw,
  Rocket,
  X,
  XCircle,
} from 'lucide-react';
import type { IdentityUser } from '../../services/identity-api';
import type { WorkspaceDitavalSummary, WorkspaceMapSummary } from '../../services/workspace-api';
import type { PublishFormat, PublishJob, PublishStatus } from '../../services/publish-api';
import { usePublishStore } from '../../store/publish-store';
import { useI18n } from '../../i18n/index.js';
import type { MessageKey } from '../../i18n/messages/index.js';
import { JobLogViewer } from './JobLogViewer';

export interface PublishDialogProps {
  open: boolean;
  rootMaps: WorkspaceMapSummary[];
  ditavals: WorkspaceDitavalSummary[];
  activeRootMapPath: string | null;
  activeDitavalPath: string | null;
  role: IdentityUser['role'] | null;
  onClose: () => void;
}

const STATUS_META: Record<PublishStatus, { labelKey: MessageKey; className: string; icon: typeof Clock }> = {
  queued: { labelKey: 'publish.status.queued', className: 'bg-slate-100 text-slate-600', icon: Clock },
  running: { labelKey: 'publish.status.running', className: 'bg-sky-50 text-sky-700', icon: Loader2 },
  succeeded: { labelKey: 'publish.status.succeeded', className: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  failed: { labelKey: 'publish.status.failed', className: 'bg-rose-50 text-rose-700', icon: XCircle },
  cancelled: { labelKey: 'publish.status.cancelled', className: 'bg-amber-50 text-amber-700', icon: Ban },
};

function formatBytes(value: number | null): string {
  if (!value || value <= 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function stemOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.(ditamap|bookmap)$/i, '');
}

export function PublishDialog({
  open,
  rootMaps,
  ditavals,
  activeRootMapPath,
  activeDitavalPath,
  role,
  onClose,
}: PublishDialogProps) {
  const { t } = useI18n();
  const runtime = usePublishStore((state) => state.runtime);
  const runtimeLoading = usePublishStore((state) => state.runtimeLoading);
  const runtimeError = usePublishStore((state) => state.runtimeError);
  const jobs = usePublishStore((state) => state.jobs);
  const jobsLoading = usePublishStore((state) => state.jobsLoading);
  const activeJobId = usePublishStore((state) => state.activeJobId);
  const actionError = usePublishStore((state) => state.actionError);
  const submitting = usePublishStore((state) => state.submitting);
  const cancelling = usePublishStore((state) => state.cancelling);
  const loadRuntime = usePublishStore((state) => state.loadRuntime);
  const loadJobs = usePublishStore((state) => state.loadJobs);
  const createJob = usePublishStore((state) => state.createJob);
  const cancelJob = usePublishStore((state) => state.cancelJob);
  const selectJob = usePublishStore((state) => state.selectJob);
  const refreshJob = usePublishStore((state) => state.refreshJob);
  const clearActionError = usePublishStore((state) => state.clearActionError);

  const [rootMap, setRootMap] = useState('');
  const [format, setFormat] = useState<PublishFormat>('html5');
  const [ditaval, setDitaval] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    const preferred =
      (activeRootMapPath && rootMaps.some((map) => map.path === activeRootMapPath)
        ? activeRootMapPath
        : rootMaps[0]?.path) ?? '';
    setRootMap(preferred);
    setDitaval(activeDitavalPath ?? '');
    setFormat('html5');
    setTitle('');
    clearActionError();
    void loadRuntime();
    void loadJobs();
  }, [open, activeRootMapPath, activeDitavalPath, rootMaps, loadRuntime, loadJobs, clearActionError]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? null,
    [jobs, activeJobId],
  );
  const liveJob = selectedJob && (selectedJob.status === 'queued' || selectedJob.status === 'running');

  useEffect(() => {
    if (!open || !liveJob || !selectedJob) return;
    const timer = setInterval(() => {
      void refreshJob(selectedJob.id);
    }, 1500);
    return () => clearInterval(timer);
  }, [open, liveJob, selectedJob, refreshJob]);

  const selectedMap = rootMaps.find((map) => map.path === rootMap) ?? null;
  const defaultTitle = selectedMap?.title?.trim() || stemOf(rootMap) || t('publish.untitled');
  const canPublish =
    Boolean(runtime?.available) && Boolean(rootMap) && !submitting && role !== 'viewer';

  if (!open) return null;

  const submit = async () => {
    const job = await createJob({
      rootMap,
      format,
      ditaval: ditaval || null,
      title: title.trim() || defaultTitle,
    });
    if (job) setTitle('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('publish.aria')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex h-[86vh] w-[min(1220px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Rocket className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              {t('publish.title')}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('publish.subtitle')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                runtimeLoading
                  ? 'border-slate-200 bg-slate-50 text-slate-500'
                  : runtime?.available
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
              title={runtime?.error ?? runtime?.command ?? t('publish.detectPending')}
            >
              {runtimeLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : runtime?.available ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
              )}
              {runtimeLoading
                ? t('publish.detecting')
                : runtime?.available
                  ? `DITA-OT ${runtime.version ?? 'ready'}`
                  : t('publish.notReady')}
            </span>
            <button
              type="button"
              onClick={() => void loadRuntime()}
              disabled={runtimeLoading}
              className="dita-mini-btn px-1.5 py-0.5 disabled:opacity-50"
              title={t('publish.redetect')}
            >
              <RefreshCw
                className={`h-3 w-3 ${runtimeLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
              aria-label={t('publish.closeAria')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {!runtimeLoading && !runtime?.available ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-900">
            <p className="font-semibold">{t('publish.missingCliTitle')}</p>
            <p className="mt-0.5 text-amber-800">
              {t('publish.missingCliBefore')} <code className="font-mono">DITA_OT_HOME</code>{' '}
              {t('publish.missingCliMiddle')} <code className="font-mono">dita</code>{' '}
              {t('publish.missingCliAfter')}
              <code className="ml-1 font-mono">{runtime?.command ?? 'dita'}</code>
              {runtime?.error ? <span className="ml-2 text-rose-700">{runtime.error}</span> : null}
            </p>
          </div>
        ) : runtime?.available && !runtime.pluginInstalled ? (
          <div className="shrink-0 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-[11px] text-sky-900">
            {t('publish.pluginMissingBefore')} <code className="font-mono">com.ditaeditor.pdf-cjk</code>{' '}
            {t('publish.pluginMissingMiddle')} <code className="font-mono">--customization.dir</code>{' '}
            {t('publish.pluginMissingAfter')}
          </div>
        ) : null}

        {runtimeError ? (
          <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-1.5 text-[11px] text-rose-800">
            {runtimeError}
          </div>
        ) : null}

        {role === 'viewer' ? (
          <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-600">
            {t('publish.readOnlyBanner')}
          </div>
        ) : null}

        <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
          <div className="grid grid-cols-[minmax(0,1.25fr)_auto_minmax(0,0.9fr)_minmax(0,1fr)_auto] items-end gap-2">
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Root Map
              </span>
              <select
                value={rootMap}
                onChange={(event) => setRootMap(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              >
                {rootMaps.length === 0 ? <option value="">{t('publish.noMaps')}</option> : null}
                {rootMaps.map((map) => (
                  <option key={map.path} value={map.path}>
                    {map.title || map.name} · {map.path}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('publish.formatLabel')}
              </span>
              <div className="flex items-center rounded-md border border-slate-300 bg-white p-0.5">
                {(
                  [
                    { id: 'html5', label: 'HTML5', icon: Globe2 },
                    { id: 'pdf', label: 'PDF', icon: FileText },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={format === item.id}
                      onClick={() => setFormat(item.id)}
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                        format === item.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('publish.ditavalLabel')}
              </span>
              <select
                value={ditaval}
                onChange={(event) => setDitaval(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">{t('publish.ditavalNone')}</option>
                {ditavals.map((item) => (
                  <option key={item.path} value={item.path}>
                    {item.name} · {t('publish.ditavalRules', { count: item.ruleCount })}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('publish.titleLabel')}
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={defaultTitle}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>

            <button
              type="button"
              disabled={!canPublish}
              onClick={() => void submit()}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              title={
                role === 'viewer'
                  ? t('publish.readOnlyBlocked')
                  : runtime?.available
                    ? t('publish.createTask')
                    : t('publish.cliBlocked')
              }
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {submitting ? t('publish.submitting') : t('publish.start')}
            </button>
          </div>
          {actionError ? (
            <p className="mt-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                <History className="h-3 w-3" aria-hidden="true" />
                {t('publish.historyTitle', { count: jobs.length })}
              </span>
              <button
                type="button"
                onClick={() => void loadJobs()}
                disabled={jobsLoading}
                className="dita-mini-btn px-1.5 py-0.5 disabled:opacity-50"
                title={t('publish.refreshHistory')}
              >
                <RefreshCw
                  className={`h-3 w-3 ${jobsLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div className="dita-scroller min-h-0 flex-1 overflow-y-auto p-1.5">
              {jobs.length === 0 ? (
                <p className="px-2 py-8 text-center text-[11px] text-slate-500">
                  {t('publish.historyEmpty')}
                </p>
              ) : (
                jobs.map((job) => {
                  const meta = STATUS_META[job.status];
                  const StatusIcon = meta.icon;
                  const active = job.id === activeJobId;
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => selectJob(job.id)}
                      className={`mb-1 block w-full rounded-md border px-2 py-1.5 text-left text-[11px] ${
                        active
                          ? 'border-indigo-200 bg-indigo-50/70'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase ${meta.className}`}
                        >
                          <StatusIcon
                            className={`h-2.5 w-2.5 ${job.status === 'running' ? 'animate-spin' : ''}`}
                            aria-hidden="true"
                          />
                          {job.format}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                          {job.title}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                        <span className="truncate">{formatTime(job.createdAt)}</span>
                        <span className="shrink-0">{formatDuration(job.durationMs)}</span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[9.5px] text-slate-400">
                        {job.id.slice(0, 8)} · {job.status}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2 p-3">
            {selectedJob ? (
              <>
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_META[selectedJob.status].className}`}
                      >
                        {selectedJob.status === 'running' ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : null}
                        {t(STATUS_META[selectedJob.status].labelKey)}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {selectedJob.title}
                      </h3>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500">
                      <span className="font-mono">{selectedJob.rootMap}</span>
                      <span>·</span>
                      <span>{t('publish.meta.format', { value: selectedJob.format.toUpperCase() })}</span>
                      {selectedJob.ditaval ? (
                        <>
                          <span>·</span>
                          <span>{t('publish.meta.filter', { value: selectedJob.ditaval })}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>{t('publish.meta.branch', { value: selectedJob.branch })}</span>
                      <span>·</span>
                      <span>{t('publish.meta.actor', { value: selectedJob.userId })}</span>
                      <span>·</span>
                      <span>{t('publish.meta.created', { value: formatTime(selectedJob.createdAt) })}</span>
                      <span>·</span>
                      <span>{t('publish.meta.duration', { value: formatDuration(selectedJob.durationMs) })}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {selectedJob.status === 'succeeded' && selectedJob.previewUrl ? (
                      <button
                        type="button"
                        onClick={() => window.open(selectedJob.previewUrl ?? '', '_blank', 'noopener')}
                        className="dita-mini-btn bg-white px-2 py-1"
                      >
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        {t('publish.previewHtml5')}
                      </button>
                    ) : null}
                    {selectedJob.status === 'succeeded' && selectedJob.artifactUrl ? (
                      <a
                        href={selectedJob.artifactUrl}
                        className="dita-mini-btn bg-white px-2 py-1"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedJob.format === 'pdf' ? (
                          <FileText className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Package className="h-3 w-3" aria-hidden="true" />
                        )}
                        {selectedJob.format === 'pdf' ? t('publish.openPdf') : t('publish.downloadZip')}
                        {selectedJob.artifactSize ? (
                          <span className="ml-1 text-[9.5px] text-slate-400">
                            {formatBytes(selectedJob.artifactSize)}
                          </span>
                        ) : null}
                      </a>
                    ) : null}
                    {selectedJob.status === 'succeeded' && selectedJob.artifactUrl && selectedJob.format === 'pdf' ? (
                      <a
                        href={`${selectedJob.artifactUrl}?inline=0`}
                        className="dita-mini-btn bg-white px-2 py-1"
                        download
                      >
                        <FileDown className="h-3 w-3" aria-hidden="true" />
                        {t('common.download')}
                      </a>
                    ) : null}
                    {liveJob && role !== 'viewer' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('publish.confirmCancel'))) void cancelJob(selectedJob.id);
                        }}
                        disabled={cancelling}
                        className="dita-mini-btn border-rose-200 bg-white px-2 py-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {cancelling ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <Ban className="h-3 w-3" aria-hidden="true" />
                        )}
                        {t('publish.cancelBuild')}
                      </button>
                    ) : null}
                  </div>
                </div>

                {selectedJob.error ? (
                  <div className="shrink-0 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
                    {selectedJob.error}
                  </div>
                ) : null}

                {selectedJob.diagnostics.length > 0 ? (
                  <div className="dita-scroller max-h-36 shrink-0 overflow-y-auto rounded-md border border-slate-200">
                    <div className="sticky top-0 border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      {t('publish.diagnosticsTitle', { count: selectedJob.diagnostics.length })}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {selectedJob.diagnostics.map((diagnostic) => (
                        <li
                          key={diagnostic.id}
                          className="flex items-start gap-1.5 px-2 py-1 text-[10.5px]"
                        >
                          {diagnostic.severity === 'error' ? (
                            <AlertCircle
                              className="mt-0.5 h-3 w-3 shrink-0 text-rose-500"
                              aria-hidden="true"
                            />
                          ) : (
                            <AlertCircle
                              className="mt-0.5 h-3 w-3 shrink-0 text-amber-500"
                              aria-hidden="true"
                            />
                          )}
                          <span className="min-w-0 flex-1 text-slate-700">{diagnostic.message}</span>
                          <span className="shrink-0 font-mono text-[9.5px] text-slate-400">
                            {diagnostic.filePath}:{diagnostic.line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <JobLogViewer jobId={selectedJob.id} status={selectedJob.status} />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
                {t('publish.emptySelection')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
