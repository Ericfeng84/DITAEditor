import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history } from 'prosemirror-history';
import {
  getPmDocTitle,
  getPmNodeRawAttrs,
  getRawAttr,
  pmDocToXml,
  xmlToPmDoc,
  type DitavalDisplayMode,
  type DocumentSemanticOverlay,
  type ParsedDitaval,
  type RawAttrs,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';
import { resolveTaskModelForDocument } from '../structure-options';
import { buildDitaKeymapPlugins } from './keymap';
import { createDitaDecorationsPlugin, type BlockGapOpenMenuPayload } from './decorations';
import { createDitaStructurePlugin } from './structure-decorations';
import { createPrologCollapsePlugin } from './prolog-collapse.js';
import { createDitaNodeViews, type SemanticViewRegistry } from './node-views';
import { hydrateEmptyContainerAtPos, insertReuseElementAtPos } from './commands';
import { hasConrefDragPayload, readConrefDragPayload } from './conref-drag.js';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import type { InlineBubbleInfo } from './inline-selection';
import type { BlockHandleTarget } from './block-transforms';
import type { InsertContextGroup } from './selection-info';

export interface VisualEditorViewDeps {
  xml: string;
  reloadToken: number;
  mountRef: RefObject<HTMLDivElement | null>;
  viewRef: RefObject<EditorView | null>;
  pinnedPosRef: RefObject<number | null>;
  slashPosRef: RefObject<number | null>;
  tagModeRef: RefObject<TagDisplayMode>;
  localeRef: RefObject<'zh-CN' | 'en'>;
  readOnlyRef: RefObject<boolean>;
  semanticOverlayRef: RefObject<DocumentSemanticOverlay | null>;
  activeDitavalRef: RefObject<ParsedDitaval | null>;
  ditavalModeRef: RefObject<DitavalDisplayMode>;
  onJumpToSourceRef: RefObject<
    ((filePath: string, line?: number, elementId?: string) => void) | undefined
  >;
  onXrefRef: RefObject<() => void>;
  onXmlChangeRef: RefObject<(nextXml: string, nextTitle: string | null) => void>;
  onAnnounceRef: RefObject<((message: string) => void) | undefined>;
  resolveImageSrcRef: RefObject<((href: string) => string | null) | undefined>;
  semanticRegistryRef: RefObject<SemanticViewRegistry>;
  blockDragRef: RefObject<{
    target: BlockHandleTarget;
    startX: number;
    startY: number;
    active: boolean;
  } | null>;
  blockDragGapRef: RefObject<number | null>;
  setInsertMenuOpen: Dispatch<SetStateAction<boolean>>;
  setGapInsertContext: Dispatch<
    SetStateAction<{ insertPos: number; groups: InsertContextGroup[] } | null>
  >;
  setInsertMenuInlineOnly: Dispatch<SetStateAction<boolean>>;
  setDismissedBubbleKey: Dispatch<SetStateAction<string | null>>;
  setInlineBubble: Dispatch<
    SetStateAction<{ info: InlineBubbleInfo; top: number; left: number } | null>
  >;
  setBlockHandle: Dispatch<
    SetStateAction<{ target: BlockHandleTarget; top: number; left: number } | null>
  >;
  setBlockMenuOpen: Dispatch<SetStateAction<boolean>>;
  setBlockDragging: Dispatch<SetStateAction<boolean>>;
  setBlockDropGap: Dispatch<
    SetStateAction<{ gap: number; top: number; left: number; width: number } | null>
  >;
  openInsertMenuAtCaret: (slashMode: boolean) => void;
  selectTagNodeFromDecoration: (nodePos: number) => void;
  handleGapQuickInsert: (tagName: string, insertPos: number) => void;
  handleOpenGapInsertMenu: (payload: BlockGapOpenMenuPayload) => void;
  emitSnapshot: (state: EditorState) => void;
  /** Reports the document only when it actually changed (outline rebuild trigger). */
  onDocChangeRef: RefObject<((doc: PMNode) => void) | undefined>;
  syncInlineBubble: (view: EditorView) => void;
  syncBlockHandle: (view: EditorView) => void;
}

/**
 * Build (or rebuild) the ProseMirror `EditorView` for the visual DITA editor.
 *
 * The view is created once per `reloadToken`, so document switches and Source -> Visual
 * transitions restart cleanly, while every other prop is read through refs to keep the
 * view (and its undo history) alive across re-renders.
 */
export function useVisualEditorView(deps: VisualEditorViewDeps): void {
  const {
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
    onDocChangeRef,
    syncInlineBubble,
    syncBlockHandle,
  } = deps;

  useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      // A browser drop can arrive already cancelled (`defaultPrevented`), in which case
      // ProseMirror's `eventBelongsToView` guard skips its handlers and `handleDrop` never runs.
      // Applying reuse drops from the mount container keeps them working; the WeakSet keeps the
      // ProseMirror path from inserting twice when both listeners see the same event.
      const appliedDrops = new WeakSet<Event>();
      const applyConrefDrop = (editorView: EditorView, event: DragEvent) => {
        if (appliedDrops.has(event)) return;
        const payload = readConrefDragPayload(event.dataTransfer);
        if (!payload) return;
        appliedDrops.add(event);
        if (readOnlyRef.current) return;
        const announceDrop = (dropped: boolean) =>
          onAnnounceRef.current?.(
            translate(
              getCurrentLocale(),
              dropped ? 'visual.announce.conrefDropped' : 'visual.announce.conrefDropBlocked',
              { tag: payload.tagName },
            ),
          );
        const coords = editorView.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!coords) {
          // Dropped in the canvas padding: never fall back to the caret, that would mutate a
          // spot the user did not aim at.
          announceDrop(false);
          return;
        }
        const attrs: RawAttrs = [
          { name: payload.attrName, value: payload.value, namespaceURI: null },
        ];
        const inserted = insertReuseElementAtPos(payload.tagName, coords.pos, attrs)(
          editorView.state,
          editorView.dispatch,
        );
        announceDrop(inserted);
        if (inserted) editorView.focus();
      };

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
            localeRef.current,
            readOnlyRef.current,
          ),
          // Guide + (non-blocking) diagnose: ordered DITA content models never reject transactions,
          // they only mark out-of-order / over-cardinality children inline.
          createDitaStructurePlugin(
            localeRef.current,
            resolveTaskModelForDocument(initialDoc),
          ),
          dropCursor({ color: '#2563eb', width: 2 }),
          gapCursor(),
          // Keeps the `<prolog>` metadata drawer's collapsed state out of the NodeView DOM so
          // decoration-driven redraws cannot re-collapse an expanded drawer.
          createPrologCollapsePlugin(),
        ],
      });

      const view = new EditorView(container, {
        state,
        nodeViews: createDitaNodeViews({
          resolveImageSrc: (href) => resolveImageSrcRef.current?.(href) ?? null,
          getSemanticOverlay: () => semanticOverlayRef.current,
          semanticRegistry: semanticRegistryRef.current,
          isReadOnly: () => readOnlyRef.current,
          onJumpToSource: (filePath, line, elementId) =>
            onJumpToSourceRef.current?.(filePath, line, elementId),
        }),
        attributes: {
          class: 'dita-prosemirror-doc',
          spellcheck: 'false',
        },
        editable: () => !readOnlyRef.current,
        handleTextInput(editorView, from, to, text) {
          // Read-only documents never open the `/` insert menu (the view is not editable, but the
          // handler is kept honest for IME / programmatic input paths).
          if (readOnlyRef.current) return false;
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
          // Read-only documents must never be mutated by a stray click.
          if (readOnlyRef.current) return false;
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
        // Reuse-panel drag: mark the editor as an accepting drop target so the browser shows a
        // copy cursor. `handleDrop` then inserts the element instead of the payload's XML text.
        handleDOMEvents: {
          dragover(_editorView, event) {
            if (readOnlyRef.current) return false;
            if (!hasConrefDragPayload(event.dataTransfer)) return false;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            return true;
          },
        },
        handleDrop(editorView, event) {
          if (!hasConrefDragPayload(event.dataTransfer)) return false;
          // Consume the drop even when it cannot be applied, so raw XML never lands as text.
          event.preventDefault();
          applyConrefDrop(editorView, event);
          return true;
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
            onXmlChangeRef.current(serialized, getPmDocTitle(nextState.doc));
            onDocChangeRef.current?.(nextState.doc);
          }

          emitSnapshot(nextState);
          syncInlineBubble(view);
          syncBlockHandle(view);
        },
      });

      viewRef.current = view;
      emitSnapshot(state);
      onDocChangeRef.current?.(state.doc);
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

      const onContainerDragOver = (event: DragEvent) => {
        if (readOnlyRef.current) return;
        if (!hasConrefDragPayload(event.dataTransfer)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      };
      const onContainerDrop = (event: DragEvent) => {
        if (!hasConrefDragPayload(event.dataTransfer)) return;
        event.preventDefault();
        applyConrefDrop(view, event);
      };
      container.addEventListener('dragover', onContainerDragOver);
      container.addEventListener('drop', onContainerDrop);

      return () => {
        container.removeEventListener('dragover', onContainerDragOver);
        container.removeEventListener('drop', onContainerDrop);
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
}
