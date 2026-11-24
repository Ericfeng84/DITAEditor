import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { history, redo, undo } from 'prosemirror-history';
import { EditorState, Selection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import {
  checkChildRemoval,
  getPmChildTags,
  type DitavalDisplayMode,
  type DocumentSemanticOverlay,
  type ParsedDitaval,
  type TaskContentModel,
  type TaskContentModelSetting,
  type XmlDeclaration,
  type XmlPrologItem,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';
import { getCurrentLocale, translate, useI18n } from '../../i18n/index.js';
import {
  convertDitaBlockAtPos,
  deleteDitaNodeAtPos,
  duplicateDitaBlockAtPos,
  insertBlockDitaElement,
  insertBlockDitaElementAtPos,
  moveDitaBlockToGap,
  selectNodeAtPos,
  toggleInlineDitaElement,
} from './commands';
import { DITA_DECORATIONS_KEY, type BlockGapOpenMenuPayload } from './decorations';
import { DITA_STRUCTURE_KEY } from './structure-decorations';
import { resolveTaskModelForDocument } from '../structure-options';
import { SemanticViewRegistry } from './node-views';
import { InsertElementMenu, type InsertElementChoice } from './InsertElementMenu';
import { InlineBubbleToolbar } from './InlineBubbleToolbar';
import { BlockHandle } from './BlockHandle';
import { buildBlockInsertGroups, readGapContainerChildTags } from './insert-context';
import { createVisualEditorHandle, type VisualEditorHandle } from './editor-handle';
import { useVisualEditorView } from './use-visual-editor-view';
import { summarizeDitavalTopics } from './ditaval-summary';
import { VisualEditorSubHeader } from './VisualEditorSubHeader';
import {
  blockIndexInContainer,
  canDuplicateBlock,
  findBlockHandleTarget,
  findBlockHandleTargetForNode,
  getBlockConvertOptions,
  isBlockMoveOrderSafe,
  planBlockMove,
  type BlockHandleTarget,
} from './block-transforms';
import { getInlineBubbleInfo, type InlineBubbleInfo } from './inline-selection';
import {
  getSelectionSnapshot,
  type EditorSelectionSnapshot,
  type InsertContextGroup,
} from './selection-info';

export type { VisualEditorHandle };

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
  onXmlChange: (nextXml: string, nextTitle: string | null) => void;
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
  onAiRequest?: (kind: 'rewrite' | 'ask') => void;
  onAnnounce?: (msg: string) => void;
  resolveImageSrc?: (href: string) => string | null;
  /** Read-only mode for viewers or files checked out by another identity. */
  readOnly?: boolean;
  /** User preference for the task content model (`auto` reads the document DOCTYPE). */
  taskModelSetting?: TaskContentModelSetting;
  /** Model `auto` currently resolves to for this document (shown next to the switch). */
  resolvedTaskModel?: TaskContentModel;
  onChangeTaskModelSetting?: (next: TaskContentModelSetting) => void;
  /** Only `<task>` topics expose the strict / general switch. */
  showTaskModelSwitch?: boolean;
  /** Authoring-guide toggle, placed at the end of the sub-header toolbar. */
  guideSlot?: ReactNode;
  /** Expanded authoring-guide panel, rendered directly under the sub-header. */
  guidePanel?: ReactNode;
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
      onAiRequest,
      onAnnounce,
      resolveImageSrc,
      readOnly = false,
      taskModelSetting = 'auto',
      resolvedTaskModel = 'strict',
      onChangeTaskModelSetting,
      showTaskModelSwitch = false,
      guideSlot,
      guidePanel,
    },
    ref,
  ) {
    const { t, locale } = useI18n();
    const mountRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<EditorView | null>(null);
    const localeRef = useRef(locale);
    localeRef.current = locale;
    const pinnedPosRef = useRef<number | null>(null);
    const slashPosRef = useRef<number | null>(null);
    const tagModeRef = useRef<TagDisplayMode>(tagDisplayMode);
    tagModeRef.current = tagDisplayMode;
    const readOnlyRef = useRef(readOnly);
    readOnlyRef.current = readOnly;
    const taskModelSettingRef = useRef<TaskContentModelSetting>(taskModelSetting);
    taskModelSettingRef.current = taskModelSetting;

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
        onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.insertBlock', { tag: tagName }));
      }
    }, []);

    const handleOpenGapInsertMenu = useCallback((payload: BlockGapOpenMenuPayload) => {
      slashPosRef.current = null;
      const rect = payload.anchorEl.getBoundingClientRect();
      setGapInsertContext({
        insertPos: payload.insertPos,
        groups: buildBlockInsertGroups(
          payload.containerTag,
          payload.containerDepth,
          readGapContainerChildTags(viewRef.current, payload.insertPos, payload.containerTag),
          viewRef.current ? resolveTaskModelForDocument(viewRef.current.state.doc) : 'strict',
        ),
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
        onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.wrapInline', { tag: tagName }));
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
      const dom = view.nodeDOM(target.blockPos);
      const rect = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
      let top: number | null;
      if (target.blockNode.isTextblock) {
        // Align with the first text line so the handle sits on the baseline of the paragraph.
        try {
          top = view.coordsAtPos(target.blockPos + 1).top;
        } catch {
          top = rect?.top ?? null;
        }
      } else {
        // Structural containers (`<steps>`, `<taskbody>`, `<shortdesc>`) have no text line of
        // their own: anchor to the element box so the handle lines up with its tag pill.
        top = rect?.top ?? null;
      }
      if (top === null) return null;
      const leftEdge = rect?.left ?? 0;
      return { top: Math.max(8, top), left: Math.max(6, leftEdge - 46) };
    }, []);

    /**
     * The gutter handle is not a hover affordance: it follows the block that holds the caret /
     * selection, and an explicitly pinned element (tag pill, breadcrumb, attribute inspector)
     * takes precedence so `<step>` / `<taskbody>` / `<shortdesc>` are manageable, not just the
     * textblock nested inside them.
     */
    const syncBlockHandle = useCallback(
      (view: EditorView) => {
        if (blockDragRef.current) return;
        const pinned = pinnedPosRef.current;
        const target =
          (pinned !== null ? findBlockHandleTargetForNode(view.state, pinned) : null) ??
          findBlockHandleTarget(view.state, view.state.selection.from);
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
      const candidates: { gap: number; top: number; index: number }[] = [];
      let pos = target.containerPos + 1;
      let lastBottom: number | null = null;
      for (let index = 0; index < target.containerNode.childCount; index += 1) {
        const child = target.containerNode.child(index);
        const dom = view.nodeDOM(pos);
        const rect = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
        if (rect) {
          candidates.push({ gap: pos, top: rect.top, index });
          lastBottom = rect.bottom;
        } else {
          try {
            candidates.push({ gap: pos, top: view.coordsAtPos(pos, 1).top, index });
          } catch {
            /* unmeasurable edge position */
          }
        }
        pos += child.nodeSize;
      }
      if (lastBottom !== null) {
        candidates.push({ gap: pos, top: lastBottom, index: target.containerNode.childCount });
      }

      // Only offer gaps that keep the ordered content model valid (`<prereq>` never lands after
      // `<steps>` inside `<taskbody>`, `<title>` never moves below prose, …).
      const containerChildTags = getPmChildTags(target.containerNode);
      const fromIndex = blockIndexInContainer(target);
      let best: { gap: number; top: number } | null = null;
      for (const candidate of candidates) {
        if (!planBlockMove(target.blockPos, target.blockNode.nodeSize, candidate.gap)) continue;
        if (
          target.containerTag &&
          !isBlockMoveOrderSafe(target.containerTag, containerChildTags, fromIndex, candidate.index)
        ) {
          continue;
        }
        if (!best || Math.abs(candidate.top - clientY) < Math.abs(best.top - clientY)) {
          best = { gap: candidate.gap, top: candidate.top };
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
            onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.movedBlock', { tag: drag.target.blockTag }));
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
        groups: buildBlockInsertGroups(
          target.containerTag,
          target.containerDepth,
          readGapContainerChildTags(
            viewRef.current,
            target.blockPos + target.blockNode.nodeSize,
            target.containerTag,
          ),
          viewRef.current ? resolveTaskModelForDocument(viewRef.current.state.doc) : 'strict',
        ),
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
          onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.convertedBlock', { from: target.blockTag, to: tag }));
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
        onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.duplicatedBlock', { tag: target.blockTag }));
      }
      setBlockHandle(null);
    }, [blockHandle]);

    const deleteBlock = useCallback(() => {
      const view = viewRef.current;
      const target = blockHandle?.target;
      if (!view || !target) return;
      setBlockMenuOpen(false);
      if (deleteDitaNodeAtPos(target.blockPos)(view.state, view.dispatch)) {
        onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.deletedBlock', { tag: target.blockTag }));
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

    useVisualEditorView({
      xml,
      reloadToken,
      mountRef,
      viewRef,
      pinnedPosRef,
      slashPosRef,
      tagModeRef,
      localeRef,
      readOnlyRef,
      semanticOverlayRef,
      activeDitavalRef,
      ditavalModeRef,
      onJumpToSourceRef,
      onXrefRef,
      onXmlChangeRef,
      onAnnounceRef,
      resolveImageSrcRef,
      semanticRegistryRef,
      blockDragRef,
      blockDragGapRef,
      setInsertMenuOpen,
      setGapInsertContext,
      setInsertMenuInlineOnly,
      setDismissedBubbleKey,
      setInlineBubble,
      setBlockHandle,
      setBlockMenuOpen,
      setBlockDragging,
      setBlockDropGap,
      openInsertMenuAtCaret,
      selectTagNodeFromDecoration,
      handleGapQuickInsert,
      handleOpenGapInsertMenu,
      emitSnapshot,
      syncInlineBubble,
      syncBlockHandle,
    });

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

    // Live-swap the UI language for tag chrome / conref badges WITHOUT recreating the view
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const tr = view.state.tr.setMeta(DITA_DECORATIONS_KEY, { locale });
      tr.setMeta(DITA_STRUCTURE_KEY, { locale });
      view.dispatch(tr);
    }, [locale]);

    // Live-swap the task content model (strict <-> general) WITHOUT recreating the view: the
    // diagnostic plugin re-runs `validatePmStructure` with the new variant.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const tr = view.state.tr.setMeta(DITA_STRUCTURE_KEY, {
        taskModel: resolveTaskModelForDocument(view.state.doc),
      });
      view.dispatch(tr);
    }, [taskModelSetting]);

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
      () =>
        createVisualEditorHandle({
          viewRef,
          pinnedPosRef,
          slashPosRef,
          onAnnounceRef,
          emitSnapshot,
          setGapInsertContext,
          setInsertMenuAnchor,
          setInsertIsSlash,
          setInsertMenuOpen,
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
      onAnnounceRef.current?.(translate(getCurrentLocale(), 'visual.announce.insertedTag', { tag: choice.spec.tag }));
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

    // Recomputed each render so the gutter actions always reflect the live content model
    const blockLiveContainer = blockHandle
      ? (viewRef.current?.state.doc.nodeAt(blockHandle.target.containerPos) ??
        blockHandle.target.containerNode)
      : null;
    const activeTaskModel = viewRef.current
      ? resolveTaskModelForDocument(viewRef.current.state.doc)
      : 'strict';
    const blockInsertGroups =
      blockHandle && blockLiveContainer
        ? buildBlockInsertGroups(
            blockHandle.target.containerTag,
            blockHandle.target.containerDepth,
            getPmChildTags(blockLiveContainer),
            activeTaskModel,
          )
        : [];
    const blockCanInsert = blockInsertGroups.some((group) => group.items.length > 0);
    const blockCanDuplicate =
      blockHandle && blockLiveContainer
        ? canDuplicateBlock(
            blockHandle.target.containerTag,
            blockLiveContainer,
            blockHandle.target.blockTag,
            activeTaskModel,
          )
        : false;
    // Deleting structure must respect the ordered content model: required slots, the last item of a
    // `oneOrMore` slot and the root element are refused (`checkChildRemoval`).
    const blockDeleteObstacle =
      blockHandle && blockLiveContainer
        ? checkChildRemoval(
            blockHandle.target.containerTag,
            blockHandle.target.blockTag,
            getPmChildTags(blockLiveContainer),
            activeTaskModel,
          )
        : null;
    const blockDeleteBlockedReason = blockDeleteObstacle
      ? blockDeleteObstacle.code === 'root-element'
        ? t('block.deleteBlockedRoot')
        : blockDeleteObstacle.code === 'required-policy'
          ? t('block.deleteBlockedPolicy', { tag: blockDeleteObstacle.childTag, parent: blockDeleteObstacle.parentTag })
          : blockDeleteObstacle.code === 'last-of-one-or-more'
            ? t('block.deleteBlockedLast', { tag: blockDeleteObstacle.childTag, parent: blockDeleteObstacle.parentTag })
            : t('block.deleteBlockedRequired', { tag: blockDeleteObstacle.childTag, parent: blockDeleteObstacle.parentTag })
      : null;
    const blockMenuOptions =
      blockMenuOpen && blockHandle
        ? getBlockConvertOptions(
            viewRef.current?.state.doc.nodeAt(blockHandle.target.blockPos) ??
              blockHandle.target.blockNode,
            blockHandle.target.containerTag,
          )
        : null;

    const ditavalTopicSummary = summarizeDitavalTopics(activeDitaval, viewRef.current);

    return (
      <div className="flex h-full flex-col bg-slate-100/80">
        <VisualEditorSubHeader
          tagDisplayMode={tagDisplayMode}
          onChangeTagDisplayMode={onChangeTagDisplayMode}
          activeDitaval={activeDitaval}
          activeDitavalPath={activeDitavalPath ?? null}
          ditavalTopicSummary={ditavalTopicSummary}
          showTaskModelSwitch={showTaskModelSwitch}
          taskModelSetting={taskModelSetting}
          resolvedTaskModel={resolvedTaskModel}
          onChangeTaskModelSetting={onChangeTaskModelSetting}
          guideSlot={guideSlot}
        />

        {guidePanel}

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
              onAiRequest={
                readOnly
                  ? undefined
                  : (kind) => {
                      setDismissedBubbleKey(bubbleKey);
                      onAiRequest?.(kind);
                    }
              }
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
              canInsert={blockCanInsert}
              canMove={blockHandle.target.movable}
              canDuplicate={blockCanDuplicate}
              canDelete={blockDeleteObstacle === null}
              deleteBlockedReason={blockDeleteBlockedReason}
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
