import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { EditorState, Selection, TextSelection, type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Tags } from 'lucide-react';
import {
  getAllowedChildElements,
  pmDocToXml,
  xmlToPmDoc,
  type RawAttrs,
  type XmlDeclaration,
  type XmlPrologItem,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';
import {
  deleteDitaNodeAtPos,
  hydrateEmptyContainerAtPos,
  insertBlockDitaElement,
  insertBlockDitaElementAtPos,
  moveDitaNodeSibling,
  selectNodeAtPos,
  toggleInlineDitaElement,
  updateNodeRawAttr,
} from './commands';
import {
  createDitaDecorationsPlugin,
  DITA_DECORATIONS_KEY,
  type BlockGapOpenMenuPayload,
} from './decorations';
import { buildDitaKeymapPlugins } from './keymap';
import { createDitaNodeViews } from './node-views';
import { InsertElementMenu, type InsertElementChoice } from './InsertElementMenu';
import {
  findLegalAncestorDepthForBlock,
  getSelectionSnapshot,
  isInlineTagAllowedAtSelection,
  type EditorSelectionSnapshot,
  type InsertContextGroup,
} from './selection-info';
import {
  addTableColumn,
  addTableRow,
  deleteTableColumn,
  deleteTableRow,
  mergeCalsCellDown,
  mergeCalsCellRight,
  splitCalsCell,
} from './table-commands';

export interface VisualEditorHandle {
  runCommand: (cmd: Command) => boolean;
  undo: () => void;
  redo: () => void;
  toggleInline: (tag: string, attrs?: RawAttrs, defaultText?: string) => boolean;
  insertBlock: (tag: string, containerDepth?: number, attrs?: RawAttrs) => boolean;
  insertBlockAtPos: (tag: string, insertPos: number, attrs?: RawAttrs) => boolean;
  updateAttr: (nodePos: number, attrName: string, value: string | null) => void;
  deleteNode: (nodePos: number) => void;
  moveNode: (nodePos: number, direction: 'up' | 'down') => void;
  selectNode: (nodePos: number, pinInspector?: boolean) => void;
  runTableAction: (
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
  ) => boolean;
  openInsertMenuAtElement: (anchorEl: HTMLElement) => void;
  getCurrentPmState: () => EditorState | null;
  canInsertBlock: (tag: string) => boolean;
  canInsertInline: (tag: string) => boolean;
}

export interface VisualEditorProps {
  xml: string;
  reloadToken: number;
  tagDisplayMode: TagDisplayMode;
  onChangeTagDisplayMode: (mode: TagDisplayMode) => void;
  pendingJumpPos: number | null;
  onJumpHandled: () => void;
  onXmlChange: (nextXml: string) => void;
  onSnapshotChange: (
    snapshot: EditorSelectionSnapshot,
    historyFlags: { canUndo: boolean; canRedo: boolean },
    docMeta: {
      xmlDeclaration: XmlDeclaration | null;
      prolog: XmlPrologItem[];
      epilog: XmlPrologItem[];
    },
  ) => void;
  onOpenXrefDialog: () => void;
  onAnnounce?: (msg: string) => void;
}

export const VisualEditor = forwardRef<VisualEditorHandle, VisualEditorProps>(
  function VisualEditor(
    {
      xml,
      reloadToken,
      tagDisplayMode,
      onChangeTagDisplayMode,
      pendingJumpPos,
      onJumpHandled,
      onXmlChange,
      onSnapshotChange,
      onOpenXrefDialog,
      onAnnounce,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const pinnedPosRef = useRef<number | null>(null);
    const slashPosRef = useRef<number | null>(null);
    const tagModeRef = useRef<TagDisplayMode>(tagDisplayMode);
    tagModeRef.current = tagDisplayMode;

    const onXmlChangeRef = useRef(onXmlChange);
    const onSnapshotRef = useRef(onSnapshotChange);
    const onXrefRef = useRef(onOpenXrefDialog);
    const onAnnounceRef = useRef(onAnnounce);
    onXmlChangeRef.current = onXmlChange;
    onSnapshotRef.current = onSnapshotChange;
    onXrefRef.current = onOpenXrefDialog;
    onAnnounceRef.current = onAnnounce;

    const [insertMenuOpen, setInsertMenuOpen] = useState(false);
    const [insertMenuAnchor, setInsertMenuAnchor] = useState<{ top: number; left: number } | null>(
      null,
    );
    const [insertIsSlash, setInsertIsSlash] = useState(false);
    const [gapInsertContext, setGapInsertContext] = useState<{
      insertPos: number;
      groups: InsertContextGroup[];
    } | null>(null);
    const [latestSnapshot, setLatestSnapshot] = useState<EditorSelectionSnapshot | null>(null);

    const emitSnapshot = useCallback((state: EditorState) => {
      const snap = getSelectionSnapshot(state, pinnedPosRef.current);
      setLatestSnapshot(snap);
      const canUndoNow = undo(state);
      const canRedoNow = redo(state);
      onSnapshotRef.current(
        snap,
        { canUndo: canUndoNow, canRedo: canRedoNow },
        {
          xmlDeclaration: (state.doc.attrs.xmlDeclaration as XmlDeclaration | null) ?? null,
          prolog: (state.doc.attrs.prolog as XmlPrologItem[]) ?? [],
          epilog: (state.doc.attrs.epilog as XmlPrologItem[]) ?? [],
        },
      );
    }, []);

    const openInsertMenuAtCaret = useCallback((slashMode: boolean) => {
      const view = viewRef.current;
      if (!view) return;
      setGapInsertContext(null);
      try {
        const coords = view.coordsAtPos(view.state.selection.from);
        setInsertMenuAnchor({ top: coords.bottom + 6, left: coords.left });
      } catch {
        setInsertMenuAnchor(null);
      }
      setInsertIsSlash(slashMode);
      setInsertMenuOpen(true);
    }, []);

    const selectTagNodeFromDecoration = useCallback(
      (nodePos: number) => {
        const view = viewRef.current;
        if (!view) return;
        pinnedPosRef.current = nodePos;
        selectNodeAtPos(nodePos)(view.state, (tr) => {
          tr.setMeta('keepPinnedCrumb', true);
          tr.setMeta(DITA_DECORATIONS_KEY, { activeNodePos: nodePos });
          view.dispatch(tr);
        });
        view.focus();
        emitSnapshot(view.state);
      },
      [emitSnapshot],
    );

    const handleGapQuickInsert = useCallback((tagName: string, insertPos: number) => {
      const view = viewRef.current;
      if (!view) return;
      if (insertBlockDitaElementAtPos(tagName, insertPos)(view.state, view.dispatch)) {
        view.focus();
        onAnnounceRef.current?.(`已插入块级元素 <${tagName}>`);
      }
    }, []);

    const handleOpenGapInsertMenu = useCallback((payload: BlockGapOpenMenuPayload) => {
      slashPosRef.current = null;
      const legalBlocks = getAllowedChildElements(payload.containerTag, 'block').filter(
        (s) =>
          ![
            'sthead',
            'strow',
            'stentry',
            'tgroup',
            'colspec',
            'thead',
            'tbody',
            'row',
            'entry',
          ].includes(s.tag),
      );

      const rect = payload.anchorEl.getBoundingClientRect();
      setGapInsertContext({
        insertPos: payload.insertPos,
        groups: [
          {
            containerTag: payload.containerTag,
            containerDepth: payload.containerDepth,
            containerLabel: `在 <${payload.containerTag}> 此处插入块`,
            insertKind: 'block',
            items: legalBlocks,
          },
        ],
      });
      setInsertMenuAnchor({ top: rect.bottom + 6, left: rect.left });
      setInsertIsSlash(false);
      setInsertMenuOpen(true);
    }, []);

    // Build / reload ProseMirror EditorView whenever `reloadToken` changes (document switch, Source -> Visual)
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      let initialDoc;
      try {
        initialDoc = xmlToPmDoc(xml, { position: false }).pmDoc;
      } catch {
        return;
      }

      pinnedPosRef.current = null;
      slashPosRef.current = null;
      setInsertMenuOpen(false);
      setGapInsertContext(null);

      const state = EditorState.create({
        doc: initialDoc,
        plugins: [
          history(),
          ...buildDitaKeymapPlugins({
            onOpenInsertMenu: () => {
              slashPosRef.current = null;
              openInsertMenuAtCaret(false);
            },
            onOpenXrefDialog: () => onXrefRef.current(),
          }),
          createDitaDecorationsPlugin(tagModeRef.current, {
            onSelectTagNode: selectTagNodeFromDecoration,
            onQuickInsertBlock: handleGapQuickInsert,
            onOpenGapInsertMenu: handleOpenGapInsertMenu,
          }),
          dropCursor({ color: '#4f46e5', width: 2 }),
          gapCursor(),
        ],
      });

      const view = new EditorView(container, {
        state,
        nodeViews: createDitaNodeViews(),
        attributes: {
          class: 'dita-prosemirror-doc',
          spellcheck: 'false',
        },
        handleTextInput(editorView, from, to, text) {
          // Trigger floating Context-Aware Insert Menu when typing `/` at start of textblock or after space
          if (text === '/') {
            const $pos = editorView.state.doc.resolve(from);
            const inCode =
              $pos.parent.type.name === 'dita_codeblock' ||
              $pos.parent.type.name === 'dita_pre' ||
              $pos.parent.type.name === 'unknown_pre_block';
            if (!inCode) {
              const charBefore =
                $pos.parentOffset > 0
                  ? editorView.state.doc.textBetween(Math.max(0, from - 1), from)
                  : '';
              if ($pos.parentOffset === 0 || /\s/.test(charBefore)) {
                const tr = editorView.state.tr.insertText('/', from, to);
                editorView.dispatch(tr);
                slashPosRef.current = from;
                openInsertMenuAtCaret(true);
                return true;
              }
            }
          }
          return false;
        },
        handleClickOn(editorView, pos, node, nodePos) {
          if (node.childCount === 0 && !node.isTextblock && !node.isAtom) {
            if (hydrateEmptyContainerAtPos(nodePos)(editorView.state, editorView.dispatch)) {
              return true;
            }
          }
          void pos;
          return false;
        },
        dispatchTransaction(tr) {
          const nextState = view.state.apply(tr);
          view.updateState(nextState);

          if (tr.selectionSet && !tr.getMeta('keepPinnedCrumb')) {
            pinnedPosRef.current = null;
          }

          if (tr.docChanged) {
            const serialized = pmDocToXml(nextState.doc);
            onXmlChangeRef.current(serialized);
          }

          emitSnapshot(nextState);
        },
      });

      viewRef.current = view;
      emitSnapshot(state);

      return () => {
        view.destroy();
        viewRef.current = null;
      };
      // Only rebuild ProseMirror view on explicit reloadToken changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadToken]);

    // Live-update Oxygen tag display mode WITHOUT recreating ProseMirror view or losing undo history!
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const tr = view.state.tr.setMeta(DITA_DECORATIONS_KEY, {
        tagMode: tagDisplayMode,
      });
      view.dispatch(tr);
    }, [tagDisplayMode]);

    // Sync active highlighted tag pill in decorations when inspected element changes
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const activePos = latestSnapshot?.activeItem?.pos ?? null;
      const currentPluginState = DITA_DECORATIONS_KEY.getState(view.state);
      if (currentPluginState && currentPluginState.activeNodePos !== activePos) {
        const tr = view.state.tr
          .setMeta('keepPinnedCrumb', true)
          .setMeta(DITA_DECORATIONS_KEY, { activeNodePos: activePos });
        view.dispatch(tr);
      }
    }, [latestSnapshot?.activeItem?.pos]);

    // Handle Source -> Visual cursor jump requests
    useEffect(() => {
      if (pendingJumpPos === null) return;
      const view = viewRef.current;
      if (!view) return;
      const clamped = Math.max(1, Math.min(pendingJumpPos, view.state.doc.content.size));
      const tr = view.state.tr.setSelection(
        Selection.near(view.state.doc.resolve(clamped), 1),
      );
      view.dispatch(tr.scrollIntoView());
      view.focus();
      onJumpHandled();
    }, [pendingJumpPos, onJumpHandled]);

    useImperativeHandle(
      ref,
      () => ({
        runCommand(cmd) {
          const view = viewRef.current;
          if (!view) return false;
          const ok = cmd(view.state, view.dispatch, view);
          if (ok) view.focus();
          return ok;
        },
        undo() {
          const view = viewRef.current;
          if (!view) return;
          if (undo(view.state, view.dispatch)) {
            view.focus();
            onAnnounceRef.current?.('已撤销上一步编辑');
          }
        },
        redo() {
          const view = viewRef.current;
          if (!view) return;
          if (redo(view.state, view.dispatch)) {
            view.focus();
            onAnnounceRef.current?.('已重做编辑');
          }
        },
        toggleInline(tag, attrs = [], defaultText) {
          const view = viewRef.current;
          if (!view) return false;
          const ok = toggleInlineDitaElement(tag, attrs, defaultText)(
            view.state,
            view.dispatch,
          );
          if (ok) {
            view.focus();
            onAnnounceRef.current?.(`已应用行内元素 <${tag}>`);
          }
          return ok;
        },
        insertBlock(tag, containerDepth, attrs = []) {
          const view = viewRef.current;
          if (!view) return false;
          const ok = insertBlockDitaElement(tag, containerDepth, attrs)(
            view.state,
            view.dispatch,
          );
          if (ok) {
            view.focus();
            onAnnounceRef.current?.(`已插入块级元素 <${tag}>`);
          }
          return ok;
        },
        insertBlockAtPos(tag, insertPos, attrs = []) {
          const view = viewRef.current;
          if (!view) return false;
          const ok = insertBlockDitaElementAtPos(tag, insertPos, attrs)(
            view.state,
            view.dispatch,
          );
          if (ok) {
            view.focus();
            onAnnounceRef.current?.(`已插入块级元素 <${tag}>`);
          }
          return ok;
        },
        updateAttr(nodePos, attrName, value) {
          const view = viewRef.current;
          if (!view) return;
          const keepPinned = pinnedPosRef.current;
          const ok = updateNodeRawAttr(nodePos, attrName, value)(view.state, (tr) => {
            tr.setMeta('keepPinnedCrumb', true);
            view.dispatch(tr);
          });
          if (ok && keepPinned !== null) {
            pinnedPosRef.current = keepPinned;
            emitSnapshot(view.state);
          }
        },
        deleteNode(nodePos) {
          const view = viewRef.current;
          if (!view) return;
          pinnedPosRef.current = null;
          if (deleteDitaNodeAtPos(nodePos)(view.state, view.dispatch)) {
            view.focus();
            onAnnounceRef.current?.('已删除所选 DITA 元素');
          }
        },
        moveNode(nodePos, direction) {
          const view = viewRef.current;
          if (!view) return;
          pinnedPosRef.current = null;
          if (moveDitaNodeSibling(nodePos, direction)(view.state, view.dispatch)) {
            view.focus();
            onAnnounceRef.current?.(direction === 'up' ? '已上移元素' : '已下移元素');
          }
        },
        selectNode(nodePos, pinInspector = true) {
          const view = viewRef.current;
          if (!view) return;
          pinnedPosRef.current = pinInspector ? nodePos : null;
          selectNodeAtPos(nodePos)(view.state, (tr) => {
            tr.setMeta('keepPinnedCrumb', pinInspector);
            tr.setMeta(DITA_DECORATIONS_KEY, { activeNodePos: nodePos });
            view.dispatch(tr);
          });
          view.focus();
          emitSnapshot(view.state);
        },
        runTableAction(action) {
          const view = viewRef.current;
          if (!view) return false;
          const cmdMap: Record<typeof action, Command> = {
            addRowBefore: addTableRow('before'),
            addRowAfter: addTableRow('after'),
            deleteRow: deleteTableRow,
            addColBefore: addTableColumn('before'),
            addColAfter: addTableColumn('after'),
            deleteCol: deleteTableColumn,
            mergeRight: mergeCalsCellRight,
            mergeDown: mergeCalsCellDown,
            splitCell: splitCalsCell,
          };
          const ok = cmdMap[action](view.state, view.dispatch);
          if (ok) {
            view.focus();
            onAnnounceRef.current?.('已更新表格结构');
          } else {
            onAnnounceRef.current?.('当前单元格无法执行该表格操作（可能受跨行/跨列约束）');
          }
          return ok;
        },
        openInsertMenuAtElement(anchorEl) {
          slashPosRef.current = null;
          setGapInsertContext(null);
          const rect = anchorEl.getBoundingClientRect();
          setInsertMenuAnchor({ top: rect.bottom + 6, left: rect.left });
          setInsertIsSlash(false);
          setInsertMenuOpen(true);
        },
        getCurrentPmState() {
          return viewRef.current?.state ?? null;
        },
        canInsertBlock(tag) {
          const view = viewRef.current;
          if (!view) return false;
          return findLegalAncestorDepthForBlock(view.state, tag) !== null;
        },
        canInsertInline(tag) {
          const view = viewRef.current;
          if (!view) return false;
          return isInlineTagAllowedAtSelection(view.state, tag);
        },
      }),
      [emitSnapshot],
    );

    const handleInsertChoice = (choice: InsertElementChoice) => {
      const view = viewRef.current;
      setInsertMenuOpen(false);
      setGapInsertContext(null);
      if (!view) return;

      // Remove leading `/` trigger character if opened via slash command
      if (slashPosRef.current !== null) {
        const sPos = slashPosRef.current;
        slashPosRef.current = null;
        if (
          sPos >= 0 &&
          sPos + 1 <= view.state.doc.content.size &&
          view.state.doc.textBetween(sPos, sPos + 1) === '/'
        ) {
          const tr = view.state.tr.delete(sPos, sPos + 1);
          tr.setSelection(TextSelection.create(tr.doc, sPos));
          view.dispatch(tr);
        }
      }

      if (choice.insertPos !== undefined) {
        insertBlockDitaElementAtPos(choice.spec.tag, choice.insertPos)(
          view.state,
          view.dispatch,
        );
      } else if (choice.insertKind === 'inline') {
        if (choice.spec.tag === 'xref') {
          onXrefRef.current();
          return;
        }
        toggleInlineDitaElement(choice.spec.tag)(view.state, view.dispatch);
      } else {
        insertBlockDitaElement(choice.spec.tag, choice.containerDepth)(
          view.state,
          view.dispatch,
        );
      }
      view.focus();
      onAnnounceRef.current?.(`已插入 <${choice.spec.tag}>`);
    };

    const activeMenuGroups = gapInsertContext?.groups ?? latestSnapshot?.insertGroups ?? [];

    return (
      <div className="flex h-full flex-col bg-slate-100/80">
        {/* Compact Visual Sub-Header Bar (aligned with Source Editor sub-bar) */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2.5">
            <div
              role="group"
              aria-label="段落与元素标签显示模式"
              className="flex items-center rounded-md border border-slate-200 bg-slate-100/90 p-0.5"
            >
              <Tags className="mx-1.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              {(
                [
                  { id: 'none', label: '无标签', title: '隐藏段落与元素 XML 标签' },
                  { id: 'tags', label: '标签', title: '显示紧凑尖箭头开始/结束标签' },
                  {
                    id: 'full',
                    label: '含属性',
                    title: '显示带 XML 属性的完整尖箭头标签（Oxygen 风格）',
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
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
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

            <span className="hidden text-[11px] text-slate-400 md:inline">
              悬停段落间点击 <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-600">+</kbd> 快速插块
            </span>
          </div>
        </div>

        <div className="dita-scroller relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
          <div
            className={`dita-paper dita-tag-mode-${tagDisplayMode} mx-auto min-h-[calc(100%-0.5rem)] max-w-[880px] rounded-xl border border-slate-200/90 bg-white px-7 py-7 shadow-sm sm:px-10 sm:py-9`}
          >
            <div ref={mountRef} />
          </div>

          <InsertElementMenu
            open={insertMenuOpen}
            groups={activeMenuGroups}
            anchorRect={insertMenuAnchor}
            isSlashTrigger={insertIsSlash}
            explicitInsertPos={gapInsertContext?.insertPos ?? null}
            onSelect={handleInsertChoice}
            onClose={() => {
              slashPosRef.current = null;
              setGapInsertContext(null);
              setInsertMenuOpen(false);
              viewRef.current?.focus();
            }}
          />
        </div>
      </div>
    );
  },
);
