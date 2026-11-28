import { useI18n, type MessageKey } from '../i18n/index.js';
import type { PipelineStage, StageCounts } from './translation-workflow.js';

interface StageMeta {
  id: PipelineStage;
  label: MessageKey;
  hint: MessageKey;
  dot: string;
  active: string;
}

/**
 * Visual order: the five real stages first (`待处理 → 翻译中 → 待审校 → 待签入 → 已同步`), then the
 * `全部` overview tab that only exists for counting.
 */
const STAGES: readonly StageMeta[] = [
  {
    id: 'todo',
    label: 'translation.pipeline.todo',
    hint: 'translation.pipeline.hint.todo',
    dot: 'bg-amber-500',
    active: 'border-blue-600 text-blue-700',
  },
  {
    id: 'translating',
    label: 'translation.pipeline.translating',
    hint: 'translation.pipeline.hint.translating',
    dot: 'bg-blue-500',
    active: 'border-blue-600 text-blue-700',
  },
  {
    id: 'review',
    label: 'translation.pipeline.review',
    hint: 'translation.pipeline.hint.review',
    dot: 'bg-violet-500',
    active: 'border-blue-600 text-blue-700',
  },
  {
    id: 'checkin',
    label: 'translation.pipeline.checkin',
    hint: 'translation.pipeline.hint.checkin',
    dot: 'bg-teal-500',
    active: 'border-blue-600 text-blue-700',
  },
  {
    id: 'synced',
    label: 'translation.pipeline.synced',
    hint: 'translation.pipeline.hint.synced',
    dot: 'bg-emerald-500',
    active: 'border-blue-600 text-blue-700',
  },
];

const ALL_STAGE: StageMeta = {
  id: 'all',
  label: 'translation.pipeline.all',
  hint: 'translation.pipeline.hint.all',
  dot: 'bg-slate-400',
  active: 'border-blue-600 text-blue-700',
};

export interface TranslationPipelineBarProps {
  counts: StageCounts;
  stage: PipelineStage;
  onChange: (stage: PipelineStage) => void;
}

/**
 * Clickable five-stage pipeline. Counts are per file-state (not per job), so the same bar works for
 * documents, assets and structure rows — clicking a stage filters the table below and the active
 * stage explains itself in one line.
 */
export function TranslationPipelineBar({ counts, stage, onChange }: TranslationPipelineBarProps) {
  const { t } = useI18n();
  const active = stage === 'all' ? ALL_STAGE : (STAGES.find((entry) => entry.id === stage) ?? ALL_STAGE);
  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-label={t('translation.pipeline.aria')}
        data-testid="translation-pipeline-bar"
        className="flex flex-wrap items-center gap-1 border-b border-slate-200"
      >
        {STAGES.map((entry) => {
          const isActive = stage === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              aria-pressed={isActive}
              data-testid={`translation-pipeline-${entry.id}`}
              onClick={() => onChange(entry.id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isActive
                  ? entry.active
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${entry.dot}`} aria-hidden="true" />
              {t(entry.label)}
              <span
                className={`rounded px-1 text-[10px] font-semibold tabular-nums ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {counts[entry.id]}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={stage === 'all'}
          data-testid="translation-pipeline-all"
          onClick={() => onChange('all')}
          className={`ml-auto -mb-px inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            stage === 'all' ? ALL_STAGE.active : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {t(ALL_STAGE.label)}
          <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold tabular-nums text-slate-600">
            {counts.all}
          </span>
        </button>
      </div>
      <p className="text-[10.5px] text-slate-500">{t(active.hint)}</p>
    </div>
  );
}
