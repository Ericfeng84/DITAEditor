import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  Bold,
  Code,
  Columns,
  FileCode2,
  FolderTree,
  Grid2x2,
  Image as ImageIcon,
  Italic,
  KeyRound,
  LayoutList,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Merge,
  Minus,
  Pilcrow,
  Plus,
  Redo2,
  Rows,
  SplitSquareHorizontal,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Variable,
} from 'lucide-react';
import type { EditorSelectionSnapshot } from './selection-info';

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
  onInsertBlock: (tag: string) => void;
  onOpenXrefDialog: () => void;
  onOpenImageDialog: () => void;
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
  onInsertBlock,
  onOpenXrefDialog,
  onOpenImageDialog,
  onTableAction,
  disabled = false,
}: EditorToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);

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
    { tag: 'b', label: '粗体 <b> (⌘B)', icon: Bold },
    { tag: 'i', label: '斜体 <i> (⌘I)', icon: Italic },
    { tag: 'u', label: '下划线 <u> (⌘U)', icon: Underline },
    { tag: 'codeph', label: '行内代码 <codeph> (⌘E)', icon: Code },
    { tag: 'uicontrol', label: '界面控件 <uicontrol>', icon: LayoutList },
    { tag: 'filepath', label: '文件路径 <filepath>', icon: FolderTree },
    { tag: 'varname', label: '变量 <varname>', icon: Variable },
    { tag: 'keyword', label: '关键字/变量 <keyword>', icon: KeyRound },
  ];

  const blockInsertItems = [
    { tag: 'p', label: '插入段落 <p>', short: 'p', icon: Pilcrow },
    { tag: 'section', label: '插入章节 <section>', short: 'section', icon: LayoutList },
    { tag: 'step', label: '插入步骤 <step>', short: 'step', icon: ListChecks },
    { tag: 'note', label: '插入提示框 <note>', short: 'note', icon: AlertCircle },
    { tag: 'ul', label: '插入无序列表 <ul>', short: 'ul', icon: List },
    { tag: 'ol', label: '插入有序列表 <ol>', short: 'ol', icon: ListOrdered },
    { tag: 'codeblock', label: '插入代码块 <codeblock>', short: 'code', icon: FileCode2 },
    { tag: 'simpletable', label: '插入简单表格 <simpletable>', short: 'simpletable', icon: Grid2x2 },
    { tag: 'table', label: '插入 CALS 表格 <table>', short: 'CALS', icon: Table2 },
  ];

  return (
    <div className="border-b border-slate-200 bg-white">
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="DITA 文档编辑工具栏"
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        className="dita-toolbar flex flex-wrap items-center gap-1 px-3 py-1.5"
      >
        {/* History group */}
        <div role="group" aria-label="撤销与重做" className="flex items-center gap-0.5">
          <button
            type="button"
            className="dita-tb-btn"
            aria-label="撤销 (⌘Z)"
            title="撤销 (⌘Z)"
            aria-disabled={disabled || !canUndo}
            onClick={() => invokeIfEnabled(!canUndo, onUndo)}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dita-tb-btn"
            aria-label="重做 (⇧⌘Z)"
            title="重做 (⇧⌘Z)"
            aria-disabled={disabled || !canRedo}
            onClick={() => invokeIfEnabled(!canRedo, onRedo)}
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <span role="separator" aria-orientation="vertical" className="dita-tb-sep" />

        {/* Context-Aware Insert Trigger */}
        <div role="group" aria-label="上下文元素插入" className="flex items-center gap-1">
          <button
            type="button"
            className="dita-tb-btn dita-tb-btn-primary"
            aria-label="打开上下文合法元素插入菜单 (⌘/ 或输入 /)"
            title="上下文合法元素插入 (⌘/ 或输入 /)"
            aria-disabled={disabled}
            onClick={(e) => {
              if (disabled) return;
              onOpenInsertMenu(e.currentTarget);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>插入元素</span>
            <kbd className="ml-0.5 rounded bg-indigo-500/20 px-1 font-mono text-[10px] text-indigo-700">
              /
            </kbd>
          </button>
        </div>

        <span role="separator" aria-orientation="vertical" className="dita-tb-sep" />

        {/* Inline formatting toggles */}
        <div role="group" aria-label="行内语义元素" className="flex items-center gap-0.5">
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
            aria-label="插入交叉引用 <xref> (⌘K)"
            title="插入交叉引用 <xref> (⌘K)"
            aria-disabled={disabled || !canInsertInline('xref')}
            onClick={() => invokeIfEnabled(!canInsertInline('xref'), onOpenXrefDialog)}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dita-tb-btn"
            aria-label="插入图片 <image>"
            title="插入图片 <image>"
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
        </div>

        <span role="separator" aria-orientation="vertical" className="dita-tb-sep" />

        {/* Contextual Block Quick Inserts */}
        <div role="group" aria-label="常用块级结构" className="flex items-center gap-0.5">
          {blockInsertItems.map((item) => {
            const Icon = item.icon;
            const allowed = canInsertBlock(item.tag);
            // Hide task-specific `<step>` when not inside a task/steps context to keep toolbar focused
            if (item.tag === 'step' && !allowed) return null;
            return (
              <button
                key={item.tag}
                type="button"
                className="dita-tb-btn px-2 text-[11px]"
                aria-label={item.label}
                title={allowed ? item.label : `当前上下文不允许插入 <${item.tag}>`}
                aria-disabled={disabled || !allowed}
                onClick={() => invokeIfEnabled(!allowed, () => onInsertBlock(item.tag))}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden font-mono xl:inline">{item.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual Table Operations Strip (Visible only when cursor is inside simpletable or CALS table) */}
      {tableInfo && !disabled ? (
        <div
          role="group"
          aria-label="表格操作工具栏"
          className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/90 px-3 py-1 text-[11px]"
        >
          <span className="inline-flex items-center gap-1 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
            {tableInfo.kind === 'cals' ? `CALS table · ${tableInfo.cols} 列` : `simpletable · ${tableInfo.cols} 列`}
          </span>

          {tableInfo.isMultiTgroup ? (
            <span className="text-amber-700">
              多 &lt;tgroup&gt; 表格已锁定结构修改（请在源码模式编辑行列）
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onTableAction('addRowBefore')}
                className="dita-mini-btn"
                title="在上方插入行"
              >
                <Rows className="h-3 w-3" aria-hidden="true" />
                上插行
              </button>
              <button
                type="button"
                onClick={() => onTableAction('addRowAfter')}
                className="dita-mini-btn"
                title="在下方插入行"
              >
                <Rows className="h-3 w-3" aria-hidden="true" />
                下插行
              </button>
              <button
                type="button"
                onClick={() => onTableAction('deleteRow')}
                className="dita-mini-btn text-rose-700 hover:bg-rose-50"
                title="删除当前行"
              >
                <Minus className="h-3 w-3" aria-hidden="true" />
                删行
              </button>

              <span className="mx-0.5 h-3.5 w-px bg-slate-300" aria-hidden="true" />

              <button
                type="button"
                onClick={() => onTableAction('addColBefore')}
                className="dita-mini-btn"
                title="在左侧插入列"
              >
                <Columns className="h-3 w-3" aria-hidden="true" />
                左插列
              </button>
              <button
                type="button"
                onClick={() => onTableAction('addColAfter')}
                className="dita-mini-btn"
                title="在右侧插入列"
              >
                <Columns className="h-3 w-3" aria-hidden="true" />
                右插列
              </button>
              <button
                type="button"
                onClick={() => onTableAction('deleteCol')}
                className="dita-mini-btn text-rose-700 hover:bg-rose-50"
                title="删除当前列"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                删列
              </button>

              {tableInfo.kind === 'cals' ? (
                <>
                  <span className="mx-0.5 h-3.5 w-px bg-slate-300" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => onTableAction('mergeRight')}
                    disabled={!tableInfo.canMergeRight}
                    className="dita-mini-btn disabled:opacity-40"
                    title="向右合并单元格（生成 namest/nameend）"
                  >
                    <Merge className="h-3 w-3" aria-hidden="true" />
                    右合并
                  </button>
                  <button
                    type="button"
                    onClick={() => onTableAction('mergeDown')}
                    disabled={!tableInfo.canMergeDown}
                    className="dita-mini-btn disabled:opacity-40"
                    title="向下合并单元格（生成 morerows）"
                  >
                    <Merge className="h-3 w-3 rotate-90" aria-hidden="true" />
                    下合并
                  </button>
                  <button
                    type="button"
                    onClick={() => onTableAction('splitCell')}
                    disabled={!tableInfo.canSplitCell}
                    className="dita-mini-btn disabled:opacity-40"
                    title="拆分当前合并单元格"
                  >
                    <SplitSquareHorizontal className="h-3 w-3" aria-hidden="true" />
                    拆分 ({tableInfo.colspan}×{tableInfo.rowspan})
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
