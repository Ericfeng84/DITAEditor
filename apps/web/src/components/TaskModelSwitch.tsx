import type { TaskContentModel, TaskContentModelSetting } from '@dita/core';
import { useI18n } from '../i18n/index.js';

export interface TaskModelSwitchProps {
  setting: TaskContentModelSetting;
  resolved: TaskContentModel;
  disabled?: boolean;
  /** `light` matches the visual sub-header, `dark` the source editor toolbar. */
  variant?: 'light' | 'dark';
  onChange: (next: TaskContentModelSetting) => void;
}

/**
 * Task content-model switch (`auto` / `strict` / `general`).
 *
 * Rendered in the visual sub-header bar and the source toolbar (never in the editing toolbar), and
 * only for `<task>` documents — style it through `variant` so it blends with each surface.
 */
export function TaskModelSwitch({
  setting,
  resolved,
  disabled = false,
  variant = 'light',
  onChange,
}: TaskModelSwitchProps) {
  const { t } = useI18n();
  const resolvedLabel =
    resolved === 'general' ? t('toolbar.taskModelGeneral') : t('toolbar.taskModelStrict');
  const hint = t('toolbar.taskModelHint');

  return (
    <label className={`dita-task-model dita-task-model--${variant}`} title={hint}>
      <span className="dita-tb-caption">{t('toolbar.taskModel')}</span>
      <select
        className="dita-tb-select dita-tb-select--compact"
        aria-label={t('toolbar.taskModelGroup')}
        title={hint}
        value={setting}
        disabled={disabled}
        data-testid="task-model-select"
        onChange={(event) => onChange(event.target.value as TaskContentModelSetting)}
      >
        <option value="auto">{t('toolbar.taskModelAuto')}</option>
        <option value="strict">{t('toolbar.taskModelStrict')}</option>
        <option value="general">{t('toolbar.taskModelGeneral')}</option>
      </select>
      {setting === 'auto' ? (
        <span className="dita-task-model-resolved" data-testid="task-model-resolved">
          {resolvedLabel}
        </span>
      ) : null}
    </label>
  );
}
