import { Filter, Tags } from 'lucide-react';
import type {
  ParsedDitaval,
  TaskContentModel,
  TaskContentModelSetting,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';
import { useI18n } from '../../i18n/index.js';
import { TaskModelSwitch } from '../../components/TaskModelSwitch';
import type { DitavalTopicSummary } from './ditaval-summary';

export interface VisualEditorSubHeaderProps {
  tagDisplayMode: TagDisplayMode;
  onChangeTagDisplayMode: (mode: TagDisplayMode) => void;
  activeDitaval: ParsedDitaval | null;
  activeDitavalPath: string | null;
  ditavalTopicSummary: DitavalTopicSummary | null;
  showTaskModelSwitch: boolean;
  taskModelSetting: TaskContentModelSetting;
  resolvedTaskModel: TaskContentModel;
  onChangeTaskModelSetting?: (next: TaskContentModelSetting) => void;
}

const TAG_MODE_HINT = '+';

/**
 * Compact visual-mode sub-header: tag display mode switch, gap-insert hint,
 * task content-model switch and the active DITAVAL badge.
 */
export function VisualEditorSubHeader({
  tagDisplayMode,
  onChangeTagDisplayMode,
  activeDitaval,
  activeDitavalPath,
  ditavalTopicSummary,
  showTaskModelSwitch,
  taskModelSetting,
  resolvedTaskModel,
  onChangeTaskModelSetting,
}: VisualEditorSubHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-2.5">
        <div
          role="group"
          aria-label={t('visual.tagModeGroupAria')}
          className="flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-100/90 p-0.5"
        >
          <Tags className="mx-1.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
          {(
            [
              { id: 'none', label: t('visual.tagMode.none'), title: t('visual.tagMode.noneTitle') },
              { id: 'tags', label: t('visual.tagMode.tags'), title: t('visual.tagMode.tagsTitle') },
              {
                id: 'full',
                label: t('visual.tagMode.full'),
                title: t('visual.tagMode.fullTitle'),
              },
            ] as const
          ).map((item) => {
            const active = tagDisplayMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeTagDisplayMode(item.id)}
                title={item.title}
                className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <span className="hidden min-w-0 truncate text-[11px] text-slate-400 md:inline-block">
          {t('visual.gapHintBefore')}{' '}
          <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-600">
            {TAG_MODE_HINT}
          </kbd>{' '}
          {t('visual.gapHintAfter')}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showTaskModelSwitch && onChangeTaskModelSetting ? (
          <TaskModelSwitch
            setting={taskModelSetting}
            resolved={resolvedTaskModel}
            onChange={onChangeTaskModelSetting}
          />
        ) : null}

        {activeDitaval ? (
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10.5px] font-medium text-teal-800">
            <Filter className="h-3 w-3 text-teal-600" aria-hidden="true" />
            <span className="max-w-[140px] truncate">{activeDitavalPath?.split('/').pop()}</span>
            {ditavalTopicSummary ? (
              <span className="font-mono text-[10px] text-teal-700">
                · {t('visual.ditavalExcluded')} {ditavalTopicSummary.excluded} ·{' '}
                {t('visual.ditavalFlagged')} {ditavalTopicSummary.flagged}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
