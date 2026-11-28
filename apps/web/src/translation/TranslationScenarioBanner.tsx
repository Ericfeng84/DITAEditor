import { ArrowRight, CheckCheck, ClipboardCheck, FileWarning, Images, Languages, Loader2, RefreshCw, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';

import { useI18n, type MessageKey } from '../i18n/index.js';
import type { TranslationFileStateView } from '../services/translation-api.js';
import type { RecommendedScenario, ScenarioId } from './translation-workflow.js';

interface ScenarioCopy {
  icon: LucideIcon;
  title: MessageKey;
  body: MessageKey;
  cta: MessageKey;
  secondary: MessageKey | null;
  frame: string;
  iconTone: string;
}

const SCENARIO_COPY: Record<ScenarioId, ScenarioCopy> = {
  empty: {
    icon: Languages,
    title: 'translation.scenario.empty.title',
    body: 'translation.scenario.empty.body',
    cta: 'translation.scenario.empty.cta',
    secondary: null,
    frame: 'border-dashed border-slate-300 bg-white',
    iconTone: 'text-slate-400',
  },
  running_job: {
    icon: Loader2,
    title: 'translation.scenario.runningJob.title',
    body: 'translation.scenario.runningJob.body',
    cta: 'translation.scenario.runningJob.cta',
    secondary: null,
    frame: 'border-blue-200 bg-blue-50/70',
    iconTone: 'text-blue-600',
  },
  draft_ready: {
    icon: ClipboardCheck,
    title: 'translation.scenario.draftReady.title',
    body: 'translation.scenario.draftReady.body',
    cta: 'translation.scenario.draftReady.cta',
    secondary: 'translation.scenario.draftReady.secondary',
    frame: 'border-teal-200 bg-teal-50/70',
    iconTone: 'text-teal-600',
  },
  in_review: {
    icon: ShieldCheck,
    title: 'translation.scenario.inReview.title',
    body: 'translation.scenario.inReview.body',
    cta: 'translation.scenario.inReview.cta',
    secondary: 'translation.scenario.inReview.secondary',
    frame: 'border-violet-200 bg-violet-50/70',
    iconTone: 'text-violet-600',
  },
  first_translation: {
    icon: Sparkles,
    title: 'translation.scenario.firstTranslation.title',
    body: 'translation.scenario.firstTranslation.body',
    cta: 'translation.scenario.firstTranslation.cta',
    secondary: null,
    frame: 'border-blue-200 bg-blue-50/70',
    iconTone: 'text-blue-600',
  },
  source_updated: {
    icon: RefreshCw,
    title: 'translation.scenario.sourceUpdated.title',
    body: 'translation.scenario.sourceUpdated.body',
    cta: 'translation.scenario.sourceUpdated.cta',
    secondary: null,
    frame: 'border-blue-200 bg-blue-50/70',
    iconTone: 'text-blue-600',
  },
  assets_or_structure: {
    icon: Images,
    title: 'translation.scenario.assetsOrStructure.title',
    body: 'translation.scenario.assetsOrStructure.body',
    cta: 'translation.scenario.assetsOrStructure.cta',
    secondary: null,
    frame: 'border-amber-200 bg-amber-50/70',
    iconTone: 'text-amber-600',
  },
  all_synced: {
    icon: CheckCheck,
    title: 'translation.scenario.allSynced.title',
    body: 'translation.scenario.allSynced.body',
    cta: 'translation.scenario.allSynced.cta',
    secondary: null,
    frame: 'border-emerald-200 bg-emerald-50/70',
    iconTone: 'text-emerald-600',
  },
};

/**
 * Copy used when every `draft_ready` file belongs to someone else: the same scenario id, but the
 * CTA can only preview the target editor because Phase 13 lets the owner alone check the draft in.
 */
const FOREIGN_DRAFT_COPY: ScenarioCopy = {
  icon: FileWarning,
  title: 'translation.scenario.foreignDraft.title',
  body: 'translation.scenario.foreignDraft.body',
  cta: 'translation.scenario.foreignDraft.cta',
  secondary: null,
  frame: 'border-amber-200 bg-amber-50/70',
  iconTone: 'text-amber-600',
};

export interface TranslationScenarioBannerProps {
  scenario: RecommendedScenario;
  files: readonly TranslationFileStateView[];
  /** Live percent from the link counters; only used when no job snapshot is available. */
  progressPercent: number;
  scanning: boolean;
  busy: boolean;
  canEdit: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  onScan: () => void;
}

/**
 * The one thing to do next.
 *
 * While a job is live this card *is* the progress bar (fed by the Files tab's own SSE
 * subscription), so a translator never has to switch to the Queue tab to watch a run. Otherwise it
 * renders the recommended scenario with a single primary CTA plus an optional quiet secondary one.
 */
export function TranslationScenarioBanner({
  scenario,
  files,
  progressPercent,
  scanning,
  busy,
  canEdit,
  onPrimary,
  onSecondary,
  onScan,
}: TranslationScenarioBannerProps) {
  const { t } = useI18n();
  const foreignOnly = scenario.foreignOnly === true;
  const copy = foreignOnly ? FOREIGN_DRAFT_COPY : SCENARIO_COPY[scenario.id];
  const Icon = copy.icon;

  const { done, total, percent } = useMemo(() => {
    const job = scenario.job;
    if (job) {
      const totalItems = Math.max(job.totalItems, 0);
      const completed = Math.min(Math.max(job.completedItems, 0), totalItems);
      return {
        done: completed,
        total: totalItems,
        percent: totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0,
      };
    }
    return { done: 0, total: 0, percent: progressPercent };
  }, [scenario.job, progressPercent]);

  const live = scenario.id === 'running_job';
  const params = {
    count: scenario.count,
    done,
    total,
    files: files.length,
    owners: (scenario.foreignDraftOwners ?? []).join(', '),
  };
  // A foreign-only draft scenario never mutates anything (it only previews), so a viewer can use it.
  const primaryDisabled = busy || (!canEdit && scenario.id !== 'all_synced' && !foreignOnly);
  const primaryAction = scenario.id === 'empty' ? onScan : onPrimary;

  return (
    <section
      data-testid="translation-scenario-banner"
      data-scenario={scenario.id}
      className={`rounded-lg border px-3 py-2.5 ${copy.frame}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${copy.iconTone} ${live ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <h2 className="truncate text-[12.5px] font-semibold text-slate-900">
              {t(copy.title, params)}
            </h2>
          </div>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-slate-600">
            {t(copy.body, params)}
          </p>
          {live ? (
            <div className="mt-1.5 flex items-center gap-2" data-testid="translation-scenario-progress">
              <div className="h-1.5 min-w-[8rem] flex-1 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="shrink-0 text-[10.5px] font-medium tabular-nums text-blue-800">
                {t('translation.scenario.runningJob.progress', { done, total })}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="translation-scenario-primary"
            onClick={primaryAction}
            disabled={primaryDisabled}
            className="inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && scenario.id !== 'running_job' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            )}
            {t(copy.cta, params)}
          </button>
          {copy.secondary ? (
            <button
              type="button"
              data-testid="translation-scenario-secondary"
              onClick={onSecondary}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {t(copy.secondary, params)}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/70 pt-1.5">
        <button
          type="button"
          data-testid="translation-files-scan"
          onClick={onScan}
          disabled={scanning || !canEdit}
          title={t('translation.scenario.scan')}
          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500 transition-colors hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {scanning ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          )}
          {scanning ? t('translation.scenario.scanBusy') : t('translation.scenario.scan')}
        </button>
        {!canEdit ? (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-amber-700">
            <FileWarning className="h-3 w-3" aria-hidden="true" />
            {t('translation.scenario.blocked')}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-slate-400">
          <Layers className="h-3 w-3" aria-hidden="true" />
          {t('translation.counts.total', { count: files.length })}
        </span>
      </div>
    </section>
  );
}
