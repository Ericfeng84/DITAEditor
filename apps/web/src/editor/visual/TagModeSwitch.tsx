import { Tags } from 'lucide-react';
import type { TagDisplayMode } from '../../store/editor-store';
import { useI18n } from '../../i18n/index.js';

export interface TagModeSwitchProps {
  tagDisplayMode: TagDisplayMode;
  onChangeTagDisplayMode: (mode: TagDisplayMode) => void;
  /** Placement classes supplied by the host (the visual sub-header pins it right of the outline). */
  className?: string;
}

/**
 * How much DITA markup the document body discloses (`none` / `tags` / `full`), as a compact
 * dropdown so the chrome row carries a single control instead of a three-segment strip.
 *
 * It sits immediately to the right of the outline toggle — both answer "what do I see in the
 * document?" — and it is a native `<select>` rather than a cycling button so the three modes stay
 * visible and one click away (the neighbouring task-model switch is built the same way).
 */
export function TagModeSwitch({
  tagDisplayMode,
  onChangeTagDisplayMode,
  className,
}: TagModeSwitchProps) {
  const { t } = useI18n();

  const titles = {
    none: t('visual.tagMode.noneTitle'),
    tags: t('visual.tagMode.tagsTitle'),
    full: t('visual.tagMode.fullTitle'),
  } as const;
  const groupLabel = t('visual.tagModeGroupAria');

  return (
    <label
      data-tag-mode={tagDisplayMode}
      className={`dita-tag-mode shrink-0 ${className ?? ''}`}
      title={titles[tagDisplayMode]}
    >
      <Tags className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="sr-only">{groupLabel}</span>
      <select
        className="dita-tb-select dita-tb-select--compact"
        aria-label={groupLabel}
        title={titles[tagDisplayMode]}
        value={tagDisplayMode}
        onChange={(event) => onChangeTagDisplayMode(event.target.value as TagDisplayMode)}
      >
        <option value="none">{t('visual.tagMode.none')}</option>
        <option value="tags">{t('visual.tagMode.tags')}</option>
        <option value="full">{t('visual.tagMode.full')}</option>
      </select>
    </label>
  );
}
