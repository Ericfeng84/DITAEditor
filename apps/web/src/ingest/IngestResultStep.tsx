/**
 * Step 5 — the scorecard.
 *
 * The publish-grade part of the wizard: it reports the two validation layers separately so an
 * import that passed structure but skipped DITA-OT (or vice versa) never looks like a full pass.
 */

import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileCode2,
  FileImage,
  FolderOpen,
  Info,
  MinusCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { IngestJobView } from '../services/ingest-api.js';
import { countIngestRepairs } from '../services/ingest-api.js';
import { useI18n } from '../i18n/index.js';
import { baseName } from './types.js';

export interface IngestResultStepProps {
  job: IngestJobView;
  onOpenManual: () => void;
  onOpenDrafts: () => void;
  onOpenTopic: (filePath: string) => void;
  onRestart: () => void;
  onClose: () => void;
}

function LayerStatus({ ok }: { ok: boolean }) {
  const { t } = useI18n();
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700">
      <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
      {t('ingest.result.passed')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[9.5px] font-medium text-rose-700">
      <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" />
      {t('ingest.result.failed')}
    </span>
  );
}

export function IngestResultStep({
  job,
  onOpenManual,
  onOpenDrafts,
  onOpenTopic,
  onRestart,
  onClose,
}: IngestResultStepProps) {
  const { t } = useI18n();
  const succeeded = job.status === 'succeeded';
  const cancelled = job.status === 'cancelled';
  const report = job.validation;
  const layer2 = report?.layer2;
  const repairs = countIngestRepairs(report);
  const assets = job.result?.assets ?? [];
  const topics = job.result?.topics ?? [];
  const warnings = [
    ...(job.result?.warnings ?? []),
    ...(report ? report.layer1.issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message) : []),
    ...(report && layer2 ? layer2.issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message) : []),
  ];

  const title = succeeded
    ? t('ingest.result.title')
    : cancelled
      ? t('ingest.result.titleCancelled')
      : t('ingest.result.titleFailed');

  return (
    <div className="space-y-2.5">
      <div
        className={`flex items-start gap-2 rounded-lg border p-2.5 ${
          succeeded
            ? 'border-emerald-200 bg-emerald-50/60'
            : cancelled
              ? 'border-slate-200 bg-slate-50'
              : 'border-rose-200 bg-rose-50/60'
        }`}
      >
        <span
          className={`mt-0.5 shrink-0 rounded-full p-1 ${
            succeeded ? 'bg-emerald-100 text-emerald-700' : cancelled ? 'bg-slate-100 text-slate-500' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {succeeded ? (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          ) : cancelled ? (
            <Ban className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12px] font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {cancelled
              ? t('ingest.result.cancelledBody')
              : succeeded
                ? `${baseName(job.sourceFilename)} · ${t('ingest.result.topics')}: ${topics.length}`
                : t('ingest.result.error', { message: job.error ?? '—' })}
          </p>
        </div>
      </div>

      {succeeded ? (
        <>
          <section className="grid gap-1.5 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700">
                  {t('ingest.result.layer1')}
                </span>
                <LayerStatus ok={report?.layer1.ok ?? false} />
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">
                {report?.layer1.issues.length ?? 0} issues
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-slate-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700">
                  {t('ingest.result.layer2')}
                </span>
                {layer2 ? (
                  layer2.status === 'passed' ? (
                    <LayerStatus ok />
                  ) : layer2.status === 'skipped' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-600">
                      <MinusCircle className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('ingest.result.skipped')}
                    </span>
                  ) : (
                    <LayerStatus ok={false} />
                  )
                ) : (
                  <span className="text-[9.5px] text-slate-400">{t('common.unknown')}</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[9px] text-slate-400" title={layer2?.reason ?? ''}>
                {layer2?.reason ?? `${layer2?.issues.length ?? 0} issues`}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <p className="text-[10px] font-medium text-slate-700">{t('ingest.result.repairs', { count: repairs })}</p>
              <p className="mt-0.5 text-[9px] text-slate-400">
                {report?.topics.filter((topic) => topic.repaired).length ?? 0} / {report?.topics.length ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <p className="text-[10px] font-medium text-slate-700">
                {t('ingest.result.images', { count: assets.length })}
              </p>
              <p className="mt-0.5 text-[9px] text-slate-400">{job.engineUsed ?? '—'}</p>
            </div>
          </section>

          {warnings.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/70 px-2 py-1.5">
              <h4 className="flex items-center gap-1 text-[10px] font-semibold text-amber-900">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {t('ingest.result.warnings')}
              </h4>
              <ul className="mt-0.5 space-y-0.5">
                {warnings.slice(0, 8).map((warning, index) => (
                  <li key={`${index}-${warning}`} className="flex items-start gap-1 text-[9.5px] text-amber-800">
                    <Info className="mt-0.5 h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">{warning}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-slate-200">
              <h4 className="border-b border-slate-200 bg-slate-50/70 px-2 py-1 text-[10px] font-semibold text-slate-700">
                {t('ingest.result.topics')}
              </h4>
              {topics.length === 0 ? (
                <p className="px-2 py-1.5 text-[10px] text-slate-500">{t('ingest.result.noTopics')}</p>
              ) : (
                <ul className="dita-scroller max-h-[150px] divide-y divide-slate-100 overflow-y-auto">
                  {topics.map((topic) => (
                    <li key={topic.filePath}>
                      <button
                        type="button"
                        onClick={() => onOpenTopic(topic.filePath)}
                        className="flex w-full items-center gap-1.5 px-2 py-1 text-left hover:bg-slate-50"
                      >
                        <FileCode2 className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[10px] text-slate-700">{topic.title}</span>
                        <span className="shrink-0 font-mono text-[9px] text-slate-400">{baseName(topic.filePath)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="min-w-0 rounded-lg border border-slate-200">
              <h4 className="border-b border-slate-200 bg-slate-50/70 px-2 py-1 text-[10px] font-semibold text-slate-700">
                {t('ingest.result.assets')}
              </h4>
              {assets.length === 0 ? (
                <p className="px-2 py-1.5 text-[10px] text-slate-500">{t('ingest.review.noAssets')}</p>
              ) : (
                <ul className="dita-scroller max-h-[150px] divide-y divide-slate-100 overflow-y-auto">
                  {assets.map((asset) => (
                    <li key={asset.assetId} className="flex items-center gap-1.5 px-2 py-1">
                      <FileImage className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-slate-600">
                        {asset.filePath}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          {t('ingest.result.again')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
        >
          {t('ingest.result.close')}
        </button>
        {succeeded ? (
          <button
            type="button"
            onClick={job.targetMode === 'new_manual' ? onOpenManual : onOpenDrafts}
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
          >
            <FolderOpen className="h-3 w-3" aria-hidden="true" />
            {job.targetMode === 'new_manual' ? t('ingest.result.openManual') : t('ingest.result.openDrafts')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
