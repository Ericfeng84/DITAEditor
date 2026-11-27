import { useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/index.js';
import {
  Bold,
  Code,
  Columns,
  CopyPlus,
  FolderTree,
  Image as ImageIcon,
  Italic,
  KeyRound,
  LayoutList,
  Link2,
  Merge,
  Minus,
  Plus,
  Redo2,
  Rows,
  SplitSquareHorizontal,
  Trash2,
  Underline,
  Undo2,
  Variable,
} from 'lucide-react';
import type { EditorSelectionSnapshot } from './selection-info';
import { useInstantTitles } from './useInstantTitles';

export interface EditorToolbarProps {
  snapshot: EditorSelectionSnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
  canInsertBlock: (tag: string) => boolean;
  canInsertInline: (tag: string) => boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenInsertMenu: (anchorEl: HTMLElement) => void;
  onToggleInline: (tag: string) => void;
  onOpenXrefDialog: () => void;
  onOpenImageDialog: () => void;
  onOpenKeyrefDialog?: () => void;
  onOpenConrefDialog?: () => void;
  onTableAction: (
    action:
      | 'addRowBefore'
      | 'addRowAfter'
      | 'deleteRow'
      | 'addColBefore'
      | 'addColAfter'
      | 'deleteCol'
      | 'mergeRight'
      | 'mergeDown'
      | 'splitCell',
  ) => void;
  disabled?: boolean;
}

/**
 * Accessible Editor Toolbar implementing modern-web-guidance `toolbar`:
 * - Single tab stop via `focusgroup="toolbar wrap"` + roving-tabindex fallback when unsupported
 * - `aria-pressed` ONLY on stateful toggle buttons, never on one-shot actions
 * - `aria-disabled="true"` instead of `disabled` so arrow-key traversal stays intact
 */
export function EditorToolbar({
  snapshot,
  canUndo,
  canRedo,
  canInsertBlock,
  canInsertInline,
  onUndo,
  onRedo,
  onOpenInsertMenu,
  onToggleInline,
  onOpenXrefDialog,
  onOpenImageDialog,
  onOpenKeyrefDialog,
  onOpenConrefDialog,
  onTableAction,
  disabled = false,
}: EditorToolbarProps) {
  const { t } = useI18n();
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  useInstantTitles(toolbarRef);

  // Roving-tabindex fallback strictly when native `focusgroup` is unsupported
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || 'focusGroup' in HTMLElement.prototype) return;

    const getButtons = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button[type="button"]'));

    const buttons = getButtons();
    buttons.forEach((btn, idx) => {
      btn.tabIndex = idx === 0 ? 0 : -1;
    });

    const handleFocusIn = (ev: FocusEvent) => {
      const target = ev.target as HTMLButtonElement | null;
      const list = getButtons();
      if (!target || !list.includes(target)) return;
      list.forEach((b) => {
        b.tabIndex = b === target ? 0 : -1;
      });
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      const list = getButtons();
      const idx = list.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;

      const rtl = getComputedStyle(bar).direction === 'rtl';
      let nextIdx = -1;
      if (ev.key === 'ArrowRight') {
        nextIdx = (idx + (rtl ? -1 : 1) + list.length) % list.length;
      } else if (ev.key === 'ArrowLeft') {
        nextIdx = (idx + (rtl ? 1 : -1) + list.length) % list.length;
      } else if (ev.key === 'Home') {
        nextIdx = 0;
      } else if (ev.key === 'End') {
        nextIdx = list.length - 1;
      }

      if (nextIdx >= 0) {
        ev.preventDefault();
        list.forEach((b, i) => {
          b.tabIndex = i === nextIdx ? 0 : -1;
        });
        list[nextIdx]?.focus();
      }
    };

    bar.addEventListener('focusin', handleFocusIn);
    bar.addEventListener('keydown', handleKeyDown);
    return () => {
      bar.removeEventListener('focusin', handleFocusIn);
      bar.removeEventListener('keydown', handleKeyDown);
    };
  }, [snapshot?.tableInfo?.kind]);

  const activeInline = snapshot?.activeInlineTags ?? new Set<string>();
  const tableInfo = snapshot?.tableInfo ?? null;

  const invokeIfEnabled = (isDisabled: boolean, fn: () => void) => {
    if (disabled || isDisabled) return;
    fn();
  };

  const inlineToggleItems = [
    { tag: 'b', label: t('toolbar.inline.b'), icon: Bold },
    { tag: 'i', label: t('toolbar.inline.i'), icon: Italic },
    { tag: 'u', label: t('toolbar.inline.u'), icon: Underline },
    { tag: 'codeph', label: t('toolbar.inline.codeph'), icon: Code },
    { tag: 'uicontrol', label: t('toolbar.inline.uicontrol'), icon: LayoutList },
    { tag: 'filepath', label: t('toolbar.inline.filepath'), icon: FolderTree },
    { tag: 'varname', label: t('toolbar.inline.varname'), icon: Variable },
    { tag: 'keyword', label: t('toolbar.inline.keyword'), icon: KeyRound },
  ];

  return (
    <div className="min-w-0 flex-1">
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label={t('toolbar.aria')}
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        className="dita-toolbar flex min-w-0 flex-wrap items-center gap-1"
      >
        {/* History group */}
        <div role="group" aria-label={t('toolbar.undoGroup')} className="flex items-center gap-0.5">
          <button
            type="button"
            className="dita-tb-btn"
            aria-label={t('toolbar.undo')}
            title={t('toolbar.undo')}
            aria-disabled={disabled || !canUndo}
            onClick={() => invokeIfEnabled(!canUndo, onUndo)}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dita-tb-btn"
            aria-label={t('toolbar.redo')}
            title={t('toolbar.redo')}
            aria-disabled={disabled || !canRedo}
            onClick={() => invokeIfEnabled(!canRedo, onRedo)}
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <span role="separator" aria-orientation="vertical" className="dita-tb-sep" />

        {/* Context-Aware Insert Trigger */}
        <div role="group" aria-label={t('toolbar.insertGroup')} className="flex items-center gap-1">
          <button
            type="button"
            className="dita-tb-btn dita-tb-btn-primary"
            aria-label={t('toolbar.insertMenuAria')}
            title={t('toolbar.insertMenu')}
            aria-disabled={disabled}
            onClick={(e) => {
              if (disabled) return;
              onOpenInsertMenu(e.currentTarget);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('toolbar.insertElement')}</span>
            <kbd className="ml-0.5 rounded bg-blue-500/20 px-1 font-mono text-[10px] text-blue-700">
              /
            </kbd>
          </button>
        </div>

        <span role="separator" aria-orientation="vertical" className="dita-tb-sep" />

        {/* Inline formatting toggles */}
        <div role="group" aria-label={t('toolbar.inlineGroup')} className="flex items-center gap-0.5">
          {inlineToggleItems.map((item) => {
            const Icon = item.icon;
            const isPressed = activeInline.has(item.tag);
            const isItemDisabled = !canInsertInline(item.tag) && !isPressed;
            return (
              <button
                key={item.tag}
                type="button"
                className="dita-tb-btn"
                aria-label={item.label}
                title={item.label}
                aria-pressed={isPressed}
                aria-disabled={disabled || isItemDisabled}
                onClick={() => invokeIfEnabled(isItemDisabled, () => onToggleInline(item.tag))}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            );
          })}
          <button
            type="button"
            className="dita-tb-btn"
            aria-label={t('toolbar.xref')}
            title={t('toolbar.xref')}
            aria-disabled={disabled || !canInsertInline('xref')}
            onClick={() => invokeIfEnabled(!canInsertInline('xref'), onOpenXrefDialog)}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dita-tb-btn"
            aria-label={t('toolbar.image')}
            title={t('toolbar.image')}
            aria-disabled={disabled || (!canInsertBlock('image') && !canInsertInline('image'))}
            onClick={() =>
              invokeIfEnabled(
                !canInsertBlock('image') && !canInsertInline('image'),
                onOpenImageDialog,
              )
            }
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {onOpenKeyrefDialog ? (
            <button
              type="button"
              className="dita-tb-btn px-2 text-[11px] text-blue-700"
              aria-label={t('toolbar.keyref')}
              title={t('toolbar.keyrefTitle')}
              aria-disabled={disabled || !canInsertInline('keyword')}
              onClick={() => invokeIfEnabled(!canInsertInline('keyword'), onOpenKeyrefDialog)}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden 2xl:inline">Keyref</span>
            </button>
          ) : null}
          {onOpenConrefDialog ? (
            <button
              type="button"
              className="dita-tb-btn px-2 text-[11px] text-teal-700"
              aria-label={t('toolbar.conref')}
              title={t('toolbar.conrefTitle')}
              aria-disabled={disabled}
              onClick={() => invokeIfEnabled(false, onOpenConrefDialog)}
            >
              <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">{t('toolbar.reuse')}</span>
            </button>
          ) : null}
        </div>

      </div>

      {/* Contextual Table Operations Strip (Visible only when cursor is inside simpletable or CALS table) */}
      {tableInfo && !disabled ? (
        <div
          role="group"
          aria-label={t('toolbar.tableGroup')}
          className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-slate-200 bg-slate-50/90 px-1.5 py-0.5 text-[11px]"
        >
          <span className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
            {tableInfo.kind === 'cals' ? t('toolbar.tableSummaryCals', { cols: tableInfo.cols }) : t('toolbar.tableSummarySimple', { cols: tableInfo.cols })}
          </span>

          {tableInfo.isMultiTgroup ? (
            <span className="text-amber-700">
              {t('toolbar.tgroupLocked')}
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onTableAction('addRowBefore')}
                className="dita-mini-btn"
                title={t('toolbar.rowAbove')}
              >
                <Rows className="h-3 w-3" aria-hidden="true" />
                {t('toolbar.rowAboveShort')}
              </button>
              <button
                type="button"
                onClick={() => onTableAction('addRowAfter')}
                className="dita-mini-btn"
                title={t('toolbar.rowBelow')}
              >
                <Rows className="h-3 w-3" aria-hidden="true" />
                {t('toolbar.rowBelowShort')}
              </button>
              <button
                type="button"
                onClick={() => onTableAction('deleteRow')}
                className="dita-mini-btn text-rose-700 hover:bg-rose-50"
                title={t('toolbar.rowDelete')}
              >
                <Minus className="h-3 w-3" aria-hidden="true" />
                {t('toolbar.rowDeleteShort')}
              </button>

              <span className="mx-0.5 h-3.5 w-px bg-slate-300" aria-hidden="true" />

              <button
                type="button"
                onClick={() => onTableAction('addColBefore')}
                className="dita-mini-btn"
                title={t('toolbar.colLeft')}
              >
                <Columns className="h-3 w-3" aria-hidden="true" />
                {t('toolbar.colLeftShort')}
              </button>
              <button
                type="button"
                onClick={() => onTableAction('addColAfter')}
                className="dita-mini-btn"
                title={t('toolbar.colRight')}
              >
                <Columns className="h-3 w-3" aria-hidden="true" />
                {t('toolbar.colRightShort')}
              </button>
              <button
                type="button"
                onClick={() => onTableAction('deleteCol')}
                className="dita-mini-btn text-rose-700 hover:bg-rose-50"
                title={t('toolbar.colDelete')}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                {t('toolbar.colDeleteShort')}
              </button>

              {tableInfo.kind === 'cals' ? (
                <>
                  <span className="mx-0.5 h-3.5 w-px bg-slate-300" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => onTableAction('mergeRight')}
                    disabled={!tableInfo.canMergeRight}
                    className="dita-mini-btn disabled:opacity-40"
                    title={t('toolbar.mergeRightTitle')}
                  >
                    <Merge className="h-3 w-3" aria-hidden="true" />
                    {t('toolbar.mergeRightShort')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTableAction('mergeDown')}
                    disabled={!tableInfo.canMergeDown}
                    className="dita-mini-btn disabled:opacity-40"
                    title={t('toolbar.mergeDownTitle')}
                  >
                    <Merge className="h-3 w-3 rotate-90" aria-hidden="true" />
                    {t('toolbar.mergeDownShort')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTableAction('splitCell')}
                    disabled={!tableInfo.canSplitCell}
                    className="dita-mini-btn disabled:opacity-40"
                    title={t('toolbar.splitTitle')}
                  >
                    <SplitSquareHorizontal className="h-3 w-3" aria-hidden="true" />
                    {t('toolbar.splitShort', { colspan: tableInfo.colspan, rowspan: tableInfo.rowspan })}
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
