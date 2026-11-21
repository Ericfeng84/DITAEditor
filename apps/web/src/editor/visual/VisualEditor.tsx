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
import { Filter, Tags } from 'lucide-react';
import {
  evaluateElementConditions,
  getAllowedChildElements,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  getRawAttr,
  pmDocToXml,
  xmlToPmDoc,
  type DitavalDisplayMode,
  type DocumentSemanticOverlay,
  type ParsedDitaval,
  type RawAttrs,
  type XmlDeclaration,
  type XmlPrologItem,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';
import {
  convertDitaBlockAtPos,
  deleteDitaNodeAtPos,
  duplicateDitaBlockAtPos,
  hydrateEmptyContainerAtPos,
  insertBlockDitaElement,
  insertBlockDitaElementAtPos,
  moveDitaBlockToGap,
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
import { createDitaNodeViews, SemanticViewRegistry } from './node-views';
import { InsertElementMenu, type InsertElementChoice } from './InsertElementMenu';
import { InlineBubbleToolbar } from './InlineBubbleToolbar';
import { BlockHandle } from './BlockHandle';
import {
  findBlockHandleTarget,
  getBlockConvertOptions,
  planBlockMove,
  type BlockHandleTarget,
} from './block-transforms';
import { getInlineBubbleInfo, type InlineBubbleInfo } from './inline-selection';
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

/** Table internals and metadata are never offered by the block insert menus. */
const NON_INSERTABLE_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'sthead',
  'strow',
  'stentry',
  'tgroup',
  'colspec',
  'thead',
  'tbody',
  'row',
  'entry',
]);

function buildBlockInsertGroups(containerTag: string, containerDepth: number): InsertContextGroup[] {
  return [
    {
      containerTag,
      containerDepth,
      containerLabel: `在 <${containerTag}> 此处插入块`,
      insertKind: 'block',
      items: getAllowedChildElements(containerTag, 'block').filter(
        (spec) => !NON_INSERTABLE_BLOCK_TAGS.has(spec.tag),
      ),
    },
  ];
}

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
  semanticOverlay?: DocumentSemanticOverlay | null;
  activeDitaval?: ParsedDitaval | null;
  activeDitavalPath?: string | null;
  ditavalDisplayMode?: DitavalDisplayMode;
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void;
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
  resolveImageSrc?: (href: string) => string | null;
  /** Read-only mode for viewers or files checked out by another identity. */
  readOnly?: boolean;
}

export const VisualEditor = forwardRef<VisualEditorHandle, VisualEditorProps>(
  function VisualEditor(
    {
      xml,
      reloadToken,
      tagDisplayMode,
      onChangeTagDisplayMode,
      semanticOverlay = null,
      activeDitaval = null,
      activeDitavalPath = null,
      ditavalDisplayMode = 'dim-excluded',
      onJumpToSource,
      pendingJumpPos,
      onJumpHandled,
      onXmlChange,
      onSnapshotChange,
      onOpenXrefDialog,
      onAnnounce,
      resolveImageSrc,
      readOnly = false,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const pinnedPosRef = useRef<number | null>(null);
    const slashPosRef = useRef<number | null>(null);
    const tagModeRef = useRef<TagDisplayMode>(tagDisplayMode);
    tagModeRef.current = tagDisplayMode;
    const readOnlyRef = useRef(readOnly);
    readOnlyRef.current = readOnly;

    const semanticOverlayRef = useRef<DocumentSemanticOverlay | null>(semanticOverlay);
    const activeDitavalRef = useRef<ParsedDitaval | null>(activeDitaval);
    const ditavalModeRef = useRef<DitavalDisplayMode>(ditavalDisplayMode);
    const onJumpToSourceRef = useRef(onJumpToSource);
    const semanticRegistryRef = useRef<SemanticViewRegistry>(new SemanticViewRegistry());
    semanticOverlayRef.current = semanticOverlay;
    activeDitavalRef.current = activeDitaval;
    ditavalModeRef.current = ditavalDisplayMode;
    onJumpToSourceRef.current = onJumpToSource;

    const onXmlChangeRef = useRef(onXmlChange);
    const onSnapshotRef = useRef(onSnapshotChange);
    const onXrefRef = useRef(onOpenXrefDialog);
    const onAnnounceRef = useRef(onAnnounce);
    const resolveImageSrcRef = useRef(resolveImageSrc);
    onXmlChangeRef.current = onXmlChange;
    onSnapshotRef.current = onSnapshotChange;
    onXrefRef.current = onOpenXrefDialog;
    onAnnounceRef.current = onAnnounce;
    resolveImageSrcRef.current = resolveImageSrc;

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
    const [inlineBubble, setInlineBubble] = useState<{
      info: InlineBubbleInfo;
      top: number;
      left: number;
    } | null>(null);
    const [dismissedBubbleKey, setDismissedBubbleKey] = useState<string | null>(null);
    const [insertMenuInlineOnly, setInsertMenuInlineOnly] = useState(false);

    /** Recompute the floating inline-element bubble against the current viewport geometry. */
    const syncInlineBubble = useCallback((view: EditorView) => {
      const info = getInlineBubbleInfo(view.state);
      if (!info.visible) {
        setInlineBubble(null);
        return;
      }
      let startCoords: { top: number; bottom: number; left: number };
      let endCoords: { top: number; bottom: number; left: number };
      try {
        startCoords = view.coordsAtPos(info.from);
        endCoords = view.coordsAtPos(info.to, -1);
      } catch {
        setInlineBubble(null);
        return;
      }
      const left = (startCoords.left + endCoords.left) / 2;
      const aboveTop = Math.min(startCoords.top, endCoords.top) - 46;
      const top = aboveTop < 8 ? Math.max(startCoords.bottom, endCoords.bottom) + 10 : aboveTop;
      setInlineBubble({ info, top, left });
    }, []);

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
      setInsertMenuInlineOnly(false);
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
      const rect = payload.anchorEl.getBoundingClientRect();
      setGapInsertContext({
        insertPos: payload.insertPos,
        groups: buildBlockInsertGroups(payload.containerTag, payload.containerDepth),
      });
      setInsertMenuAnchor({ top: rect.bottom + 6, left: rect.left });
      setInsertIsSlash(false);
      setInsertMenuInlineOnly(false);
      setInsertMenuOpen(true);
    }, []);

    /** Apply a DITA inline element to the highlighted range from the floating bubble toolbar. */
    const applyInlineBubbleTag = useCallback((tagName: string) => {
      const view = viewRef.current;
      if (!view) return;
      if (toggleInlineDitaElement(tagName)(view.state, view.dispatch)) {
        view.focus();
        onAnnounceRef.current?.(`已将选中文字转换为行内元素 <${tagName}>`);
      }
    }, []);

    /** "更多元素" opens the insert menu narrowed to the inline elements legal at the caret. */
    const openInlineMoreMenu = useCallback((anchorEl: HTMLElement) => {
      slashPosRef.current = null;
      setGapInsertContext(null);
      const rect = anchorEl.getBoundingClientRect();
      setInsertMenuAnchor({ top: rect.bottom + 6, left: rect.left });
      setInsertIsSlash(false);
      setInsertMenuInlineOnly(true);
      setInsertMenuOpen(true);
    }, []);

    // ---- Notion-style left gutter block handle -------------------------------------------
    const [blockHandle, setBlockHandle] = useState<{
      target: BlockHandleTarget;
      top: number;
      left: number;
    } | null>(null);
    const [blockMenuOpen, setBlockMenuOpen] = useState(false);
    const [blockDragging, setBlockDragging] = useState(false);
    const [blockDropGap, setBlockDropGap] = useState<{
      gap: number;
      top: number;
      left: number;
      width: number;
    } | null>(null);
    const blockDragRef = useRef<{
      target: BlockHandleTarget;
      startX: number;
      startY: number;
      active: boolean;
    } | null>(null);
    const blockDragGapRef = useRef<number | null>(null);

    /** Viewport anchor of the handle row: aligned with the block's first text line. */
    const resolveHandleAnchor = useCallback((view: EditorView, target: BlockHandleTarget) => {
      let lineTop: number | null = null;
      try {
        lineTop = view.coordsAtPos(target.blockPos + 1).top;
      } catch {
        lineTop = null;
      }
      const dom = view.nodeDOM(target.blockPos);
      const rect = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
      const top = lineTop ?? rect?.top ?? null;
      if (top === null) return null;
      const leftEdge = rect?.left ?? 0;
      return { top: Math.max(8, top), left: Math.max(6, leftEdge - 46) };
    }, []);

    /**
     * The gutter handle is not a hover affordance: it follows the block that holds the caret /
     * selection, so it only shows up after the user clicks into a paragraph.
     */
    const syncBlockHandle = useCallback(
      (view: EditorView) => {
        if (blockDragRef.current) return;
        const target = findBlockHandleTarget(view.state, view.state.selection.from);
        if (!target) {
          setBlockHandle(null);
          return;
        }
        const anchor = resolveHandleAnchor(view, target);
        if (!anchor) {
          setBlockHandle(null);
          return;
        }
        setBlockHandle((prev) => {
          if (
            prev &&
            prev.target.blockPos === target.blockPos &&
            Math.abs(prev.top - anchor.top) < 1.5 &&
            Math.abs(prev.left - anchor.left) < 1.5
          ) {
            return prev;
          }
          return { target, top: anchor.top, left: anchor.left };
        });
      },
      [resolveHandleAnchor],
    );

    /** Nearest legal gap inside the block's container, with the indicator geometry. */
    const computeDropGap = useCallback((target: BlockHandleTarget, clientY: number) => {
      const view = viewRef.current;
      if (!view) return null;
      // Measure the real DOM boxes of the container's children: `coordsAtPos` at node boundaries
      // is unreliable inside DITA NodeViews (note/task/table wrappers), so anchor the drop line
      // to the sibling elements themselves.
      const candidates: { gap: number; top: number }[] = [];
      let pos = target.containerPos + 1;
      let lastBottom: number | null = null;
      for (let index = 0; index < target.containerNode.childCount; index += 1) {
        const child = target.containerNode.child(index);
        const dom = view.nodeDOM(pos);
        const rect = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
        if (rect) {
          candidates.push({ gap: pos, top: rect.top });
          lastBottom = rect.bottom;
        } else {
          try {
            candidates.push({ gap: pos, top: view.coordsAtPos(pos, 1).top });
          } catch {
            /* unmeasurable edge position */
          }
        }
        pos += child.nodeSize;
      }
      if (lastBottom !== null) candidates.push({ gap: pos, top: lastBottom });

      let best: { gap: number; top: number } | null = null;
      for (const candidate of candidates) {
        if (!planBlockMove(target.blockPos, target.blockNode.nodeSize, candidate.gap)) continue;
        if (!best || Math.abs(candidate.top - clientY) < Math.abs(best.top - clientY)) {
          best = candidate;
        }
      }
      if (!best) return null;
      const paper = mountRef.current?.closest('.dita-paper');
      const paperRect = paper instanceof HTMLElement ? paper.getBoundingClientRect() : null;
      return {
        gap: best.gap,
        top: best.top,
        left: paperRect?.left ?? 0,
        width: paperRect?.width ?? 0,
      };
    }, []);

    const startBlockDrag = useCallback(
      (event: React.PointerEvent<HTMLButtonElement>) => {
        const view = viewRef.current;
        if (!view || !blockHandle) return;
        event.preventDefault();
        blockDragRef.current = {
          target: blockHandle.target,
          startX: event.clientX,
          startY: event.clientY,
          active: false,
        };
        blockDragGapRef.current = null;

        const onMove = (moveEvent: PointerEvent) => {
          const drag = blockDragRef.current;
          if (!drag) return;
          if (!drag.active) {
            if (
              Math.abs(moveEvent.clientY - drag.startY) < 4 &&
              Math.abs(moveEvent.clientX - drag.startX) < 4
            ) {
              return;
            }
            drag.active = true;
            setBlockDragging(true);
          }
          const gap = computeDropGap(drag.target, moveEvent.clientY);
          blockDragGapRef.current = gap?.gap ?? null;
          setBlockDropGap(gap);
        };

        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          const drag = blockDragRef.current;
          blockDragRef.current = null;
          setBlockDragging(false);
          setBlockDropGap(null);
          if (!drag) return;
          if (!drag.active) {
            setBlockMenuOpen(true);
            return;
          }
          const gap = blockDragGapRef.current;
          blockDragGapRef.current = null;
          const currentView = viewRef.current;
          if (
            gap !== null &&
            currentView &&
            moveDitaBlockToGap(drag.target.blockPos, gap)(currentView.state, currentView.dispatch)
          ) {
            onAnnounceRef.current?.(`已移动块 <${drag.target.blockTag}>`);
          }
          setBlockHandle(null);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      },
      [blockHandle, computeDropGap],
    );

    const openInsertMenuAfterBlock = useCallback(() => {
      const target = blockHandle?.target;
      if (!target) return;
      slashPosRef.current = null;
      setGapInsertContext({
        insertPos: target.blockPos + target.blockNode.nodeSize,
        groups: buildBlockInsertGroups(target.containerTag, target.containerDepth),
      });
      setInsertMenuAnchor({ top: (blockHandle?.top ?? 0) + 28, left: (blockHandle?.left ?? 0) + 34 });
      setInsertIsSlash(false);
      setInsertMenuInlineOnly(false);
      setInsertMenuOpen(true);
    }, [blockHandle]);

    const convertBlockTo = useCallback(
      (tag: string) => {
        const view = viewRef.current;
        const target = blockHandle?.target;
        if (!view || !target) return;
        setBlockMenuOpen(false);
        if (convertDitaBlockAtPos(tag, target.blockPos)(view.state, view.dispatch)) {
          onAnnounceRef.current?.(`已将块 <${target.blockTag}> 转换为 <${tag}>`);
        }
        setBlockHandle(null);
      },
      [blockHandle],
    );

    const duplicateBlock = useCallback(() => {
      const view = viewRef.current;
      const target = blockHandle?.target;
      if (!view || !target) return;
      setBlockMenuOpen(false);
      if (duplicateDitaBlockAtPos(target.blockPos)(view.state, view.dispatch)) {
        onAnnounceRef.current?.(`已复制块 <${target.blockTag}>`);
      }
      setBlockHandle(null);
    }, [blockHandle]);

    const deleteBlock = useCallback(() => {
      const view = viewRef.current;
      const target = blockHandle?.target;
      if (!view || !target) return;
      setBlockMenuOpen(false);
      if (deleteDitaNodeAtPos(target.blockPos)(view.state, view.dispatch)) {
        onAnnounceRef.current?.(`已删除块 <${target.blockTag}>`);
      }
      setBlockHandle(null);
    }, [blockHandle]);

    // Dismiss the "turn into" menu on outside pointerdown / Escape
    useEffect(() => {
      if (!blockMenuOpen) return;
      const onPointerDown = (event: PointerEvent) => {
        const el = event.target as Element | null;
        if (el?.closest('.dita-block-menu') || el?.closest('.dita-block-handle')) return;
        setBlockMenuOpen(false);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setBlockMenuOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      return () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
      };
    }, [blockMenuOpen]);

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
      setInsertMenuInlineOnly(false);
      setDismissedBubbleKey(null);
      setInlineBubble(null);
      setBlockHandle(null);
      setBlockMenuOpen(false);
      setBlockDragging(false);
      setBlockDropGap(null);
      blockDragRef.current = null;
      blockDragGapRef.current = null;

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
          createDitaDecorationsPlugin(
            tagModeRef.current,
            {
              onSelectTagNode: selectTagNodeFromDecoration,
              onQuickInsertBlock: handleGapQuickInsert,
              onOpenGapInsertMenu: handleOpenGapInsertMenu,
              onJumpToSource: (filePath, line, elementId) =>
                onJumpToSourceRef.current?.(filePath, line, elementId),
            },
            {
              overlay: semanticOverlayRef.current,
              ditaval: activeDitavalRef.current,
              ditavalDisplayMode: ditavalModeRef.current,
            },
          ),
          dropCursor({ color: '#4f46e5', width: 2 }),
          gapCursor(),
        ],
      });

      const view = new EditorView(container, {
        state,
        nodeViews: createDitaNodeViews({
          resolveImageSrc: (href) => resolveImageSrcRef.current?.(href) ?? null,
          getSemanticOverlay: () => semanticOverlayRef.current,
          semanticRegistry: semanticRegistryRef.current,
          onJumpToSource: (filePath, line, elementId) =>
            onJumpToSourceRef.current?.(filePath, line, elementId),
        }),
        attributes: {
          class: 'dita-prosemirror-doc',
          spellcheck: 'false',
        },
        editable: () => !readOnlyRef.current,
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
          // Never hydrate empty containers carrying conref/conkeyref so source XML stays untouched
          const rawAttrs = getPmNodeRawAttrs(node);
          if (getRawAttr(rawAttrs, 'conref') || getRawAttr(rawAttrs, 'conkeyref')) {
            return false;
          }
          if (node.childCount === 0 && !node.isTextblock && !node.isAtom) {
            if (hydrateEmptyContainerAtPos(nodePos)(editorView.state, editorView.dispatch)) {
              return true;
            }
          }
          void pos;
          return false;
        },
        dispatchTransaction(tr) {
          // Readers and non-owners must never mutate XML, even via keyboard shortcuts.
          if (readOnlyRef.current && tr.docChanged) return;
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
          syncInlineBubble(view);
          syncBlockHandle(view);
        },
      });

      viewRef.current = view;
      emitSnapshot(state);
      syncInlineBubble(view);
      syncBlockHandle(view);

      // Keep the bubble and gutter handle glued to the content while scrolling / resizing
      const handleViewportChange = () => {
        if (!viewRef.current) return;
        syncInlineBubble(viewRef.current);
        syncBlockHandle(viewRef.current);
      };
      window.addEventListener('scroll', handleViewportChange, true);
      window.addEventListener('resize', handleViewportChange);

      return () => {
        window.removeEventListener('scroll', handleViewportChange, true);
        window.removeEventListener('resize', handleViewportChange);
        view.destroy();
        viewRef.current = null;
        setInlineBubble(null);
        setBlockHandle(null);
        setBlockMenuOpen(false);
        setBlockDropGap(null);
      };
      // Only rebuild ProseMirror view on explicit reloadToken changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadToken]);

    // Toggle editability in place when the check-out state or identity changes.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      view.setProps({ editable: () => !readOnlyRef.current });
      setInlineBubble(null);
      setBlockHandle(null);
      setBlockMenuOpen(false);
      setBlockDropGap(null);
    }, [readOnly]);

    // Live-update Oxygen tag display mode WITHOUT recreating ProseMirror view or losing undo history!
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const tr = view.state.tr.setMeta(DITA_DECORATIONS_KEY, {
        tagMode: tagDisplayMode,
      });
      view.dispatch(tr);
      // Tag chrome changes every block's height; the dispatch above re-anchors the handle
      setBlockMenuOpen(false);
      setBlockDropGap(null);
    }, [tagDisplayMode]);

    // Live-update Keyref / Conref / DITAVAL semantic overlays WITHOUT losing editor history
    useEffect(() => {
      const view = viewRef.current;
      if (view) {
        const tr = view.state.tr.setMeta(DITA_DECORATIONS_KEY, {
          semantic: {
            overlay: semanticOverlay ?? null,
            ditaval: activeDitaval ?? null,
            ditavalDisplayMode,
          },
        });
        view.dispatch(tr);
      }
      semanticRegistryRef.current.notifyAll();
    }, [semanticOverlay, activeDitaval, ditavalDisplayMode]);

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

    const activeMenuGroups = insertMenuInlineOnly
      ? (gapInsertContext?.groups ?? latestSnapshot?.insertGroups ?? [])
          .map((group) => ({
            ...group,
            items: group.items.filter((spec) => spec.kind === 'inline'),
          }))
          .filter((group) => group.items.length > 0)
      : (gapInsertContext?.groups ?? latestSnapshot?.insertGroups ?? []);

    const bubbleKey = inlineBubble ? `${inlineBubble.info.from}-${inlineBubble.info.to}` : null;

    // Recomputed each render so the "turn into" list always reflects the live block content
    const blockMenuOptions =
      blockMenuOpen && blockHandle
        ? getBlockConvertOptions(
            viewRef.current?.state.doc.nodeAt(blockHandle.target.blockPos) ??
              blockHandle.target.blockNode,
            blockHandle.target.containerTag,
          )
        : null;

    const ditavalTopicSummary = (() => {
      if (!activeDitaval || !viewRef.current) return null;
      let excluded = 0;
      let flagged = 0;
      viewRef.current.state.doc.descendants((node) => {
        if (!getPmNodeTagName(node)) return true;
        const ev = evaluateElementConditions(getPmNodeRawAttrs(node), activeDitaval);
        if (ev.status === 'exclude') excluded++;
        else if (ev.status === 'flag') flagged++;
        return true;
      });
      return { excluded, flagged };
    })();

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
              选中段落后点击段间 <kbd className="rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-600">+</kbd> 快速插块
            </span>
          </div>

          {activeDitaval ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10.5px] font-medium text-teal-800">
              <Filter className="h-3 w-3 text-teal-600" aria-hidden="true" />
              <span className="max-w-[140px] truncate">{activeDitavalPath?.split('/').pop()}</span>
              {ditavalTopicSummary ? (
                <span className="font-mono text-[10px] text-teal-700">
                  · 排除 {ditavalTopicSummary.excluded} · 标记 {ditavalTopicSummary.flagged}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className="dita-scroller relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8"
        >
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
              setInsertMenuInlineOnly(false);
              setInsertMenuOpen(false);
              viewRef.current?.focus();
            }}
          />

          {inlineBubble && !insertMenuOpen && dismissedBubbleKey !== bubbleKey ? (
            <InlineBubbleToolbar
              anchor={{ top: inlineBubble.top, left: inlineBubble.left }}
              contextTag={inlineBubble.info.contextTag}
              items={inlineBubble.info.items}
              activeTags={inlineBubble.info.activeTags}
              onApply={applyInlineBubbleTag}
              onOpenMore={openInlineMoreMenu}
              onClose={() => setDismissedBubbleKey(bubbleKey)}
            />
          ) : null}

          {blockHandle && !insertMenuOpen ? (
            <BlockHandle
              top={blockHandle.top}
              left={blockHandle.left}
              blockTag={blockHandle.target.blockTag}
              containerTag={blockHandle.target.containerTag}
              dragging={blockDragging}
              menuOptions={blockMenuOptions}
              onInsert={openInsertMenuAfterBlock}
              onToggleMenu={() => setBlockMenuOpen((open) => !open)}
              onStartDrag={startBlockDrag}
              onConvert={convertBlockTo}
              onDuplicate={duplicateBlock}
              onDelete={deleteBlock}
              onCloseMenu={() => setBlockMenuOpen(false)}
            />
          ) : null}

          {blockDropGap ? (
            <div
              className="dita-block-drop-indicator"
              style={{ top: blockDropGap.top, left: blockDropGap.left, width: blockDropGap.width }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    );
  },
);
