import type { ReactNode } from 'react';
import { Filter } from 'lucide-react';
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
  /** Collapsible document outline toggle, pinned to the far left before the guide chip. */
  outlineSlot?: ReactNode;
  /** Authoring-guide toggle (topic type badge + expand/collapse) at the end of the toolbar. */
  guideSlot?: ReactNode;
  /** Save affordance, rendered right before the guide toggle so it stays on the document toolbar. */
  saveSlot?: ReactNode;
  /** Lock state and assignment chip for the open topic, kept on one row with the toolbar. */
  contextSlot?: ReactNode;
}

/**
 * Compact visual-mode sub-header: tag display mode switch, task content-model switch,
 * the active DITAVAL badge, the topic's lock/assignment context and the save affordance.
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
  outlineSlot,
  guideSlot,
  saveSlot,
  contextSlot,
}: VisualEditorSubHeaderProps) {
  const { t } = useI18n();
  return (
    <div className="@container flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-1.5 text-xs">
      <div className="flex min-w-0 shrink items-center gap-2.5 overflow-hidden">
        {/* Document identity first, then the control scoped to it: the task content-model
            switch (task topics only). View options such as tag disclosure live on the right. */}
        {outlineSlot}
        {guideSlot}
        {showTaskModelSwitch && onChangeTaskModelSetting ? (
          <TaskModelSwitch
            setting={taskModelSetting}
            resolved={resolvedTaskModel}
            onChange={onChangeTaskModelSetting}
          />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        {/* View options live on the right: tag disclosure mode, then topic context, DITAVAL badge
            and the save affordance. */}
        <div
          role="group"
          aria-label={t('visual.tagModeGroupAria')}
          className="flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-100/90 p-0.5"
        >
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
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {contextSlot ? (
          <div className="flex min-w-0 items-center gap-1.5">{contextSlot}</div>
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
        {saveSlot}
      </div>
    </div>
  );
}
