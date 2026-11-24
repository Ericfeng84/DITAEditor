import { Loader2, RotateCcw, Save } from 'lucide-react';
import { useI18n } from '../i18n/index.js';

export interface SaveControlsProps {
  dirtyCount: number;
  isCurrentDirty: boolean;
  saving: boolean;
  readOnly?: boolean;
  onSave: () => void;
  onResetBaseline: () => void;
}

/**
 * Save affordance for the editor toolbars (visual sub-header / action row).
 *
 * Lives next to the authoring-guide toggle instead of in the app header: the header is
 * navigation + identity + diagnostics, while save belongs with the document tooling.
 * The button keeps a stable slot when nothing is dirty so the toolbar does not jump.
 */
export function SaveControls({
  dirtyCount,
  isCurrentDirty,
  saving,
  readOnly = false,
  onSave,
  onResetBaseline,
}: SaveControlsProps) {
  const { t } = useI18n();
  const disabled = readOnly || saving || dirtyCount === 0;
  const label =
    dirtyCount === 0
      ? t('common.save')
      : dirtyCount > 1
        ? t('header.save.saveAll', { count: dirtyCount })
        : t('common.save');

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onSave}
        title={
          dirtyCount === 0
            ? t('header.save.cleanTitle')
            : readOnly
              ? t('header.save.readOnlyTitle')
              : t('header.save.title')
        }
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
          dirtyCount > 0 && !readOnly
            ? 'bg-slate-900 text-white hover:bg-slate-800'
            : 'border border-slate-200 bg-white text-slate-400'
        } disabled:cursor-not-allowed`}
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-3 w-3" aria-hidden="true" />
        )}
        <span>{saving ? t('common.saving') : label}</span>
        {dirtyCount > 0 ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
            aria-label={t('tabs.unsaved')}
          />
        ) : null}
      </button>
      {isCurrentDirty && !readOnly ? (
        <button
          type="button"
          onClick={onResetBaseline}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          title={t('header.reset.title')}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span className="hidden lg:inline">{t('header.reset.label')}</span>
        </button>
      ) : null}
    </div>
  );
}
