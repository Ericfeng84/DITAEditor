import type { RefObject } from 'react';
import type { Command, EditorState } from 'prosemirror-state';
import { undo, redo } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { xmlToPmDoc, type RawAttrs } from '@dita/core';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import {
  deleteDitaNodeAtPos,
  insertBlockDitaElement,
  insertBlockDitaElementAtPos,
  insertReuseElementAtPos,
  moveDitaNodeSibling,
  selectNodeAtPos,
  toggleInlineDitaElement,
  updateNodeRawAttr,
} from './commands';
import { DITA_DECORATIONS_KEY } from './decorations';
import type { ConrefDragPayload } from './conref-drag.js';
import { findLegalAncestorDepthForBlock, isInlineTagAllowedAtSelection } from './selection-info';
import {
  addTableColumn,
  addTableRow,
  deleteTableColumn,
  deleteTableRow,
  mergeCalsCellDown,
  mergeCalsCellRight,
  splitCalsCell,
} from './table-commands';

export type TableAction =
  | 'addRowBefore'
  | 'addRowAfter'
  | 'deleteRow'
  | 'addColBefore'
  | 'addColAfter'
  | 'deleteCol'
  | 'mergeRight'
  | 'mergeDown'
  | 'splitCell';

export interface VisualEditorHandle {
  runCommand: (cmd: Command) => boolean;
  undo: () => void;
  redo: () => void;
  toggleInline: (tag: string, attrs?: RawAttrs, defaultText?: string) => boolean;
  insertBlock: (tag: string, containerDepth?: number, attrs?: RawAttrs) => boolean;
  insertBlockAtPos: (tag: string, insertPos: number, attrs?: RawAttrs) => boolean;
  /**
   * Insert a conref/conkeyref element at viewport coordinates (reuse-panel pointer-drop fallback).
   * Returns false when the point is not over the canvas or no container accepts the element.
   */
  insertReuseAtPoint: (
    clientX: number,
    clientY: number,
    payload: ConrefDragPayload,
  ) => boolean;
  updateAttr: (nodePos: number, attrName: string, value: string | null) => void;
  deleteNode: (nodePos: number) => void;
  moveNode: (nodePos: number, direction: 'up' | 'down') => void;
  selectNode: (nodePos: number, pinInspector?: boolean) => void;
  runTableAction: (action: TableAction) => boolean;
  openInsertMenuAtElement: (anchorEl: HTMLElement) => void;
  getCurrentPmState: () => EditorState | null;
  /** Replace the whole document in one undoable transaction (AI proposal apply). */
  replaceDocumentXml: (nextXml: string) => boolean;
  canInsertBlock: (tag: string) => boolean;
  canInsertInline: (tag: string) => boolean;
}

/** Everything the imperative editor handle needs from the owning component's closure. */
export interface VisualEditorHandleDeps {
  viewRef: RefObject<EditorView | null>;
  pinnedPosRef: RefObject<number | null>;
  slashPosRef: RefObject<number | null>;
  onAnnounceRef: RefObject<((msg: string) => void) | undefined>;
  emitSnapshot: (state: EditorState) => void;
  setGapInsertContext: (value: null) => void;
  setInsertMenuAnchor: (anchor: { top: number; left: number }) => void;
  setInsertIsSlash: (value: boolean) => void;
  setInsertMenuOpen: (value: boolean) => void;
}

const TABLE_ACTIONS: Record<TableAction, Command> = {
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

type MessageKey = Parameters<typeof translate>[1];

function announce(
  deps: Pick<VisualEditorHandleDeps, 'onAnnounceRef'>,
  key: MessageKey,
  vars?: Record<string, string>,
): void {
  deps.onAnnounceRef.current?.(translate(getCurrentLocale(), key, vars));
}

/** Build the imperative handle exposed through `ref` by `<VisualEditor>`. */
export function createVisualEditorHandle(deps: VisualEditorHandleDeps): VisualEditorHandle {
  const { viewRef, pinnedPosRef, slashPosRef, emitSnapshot } = deps;

  const applyCommand = (cmd: Command, announceKey?: MessageKey, vars?: Record<string, string>) => {
    const view = viewRef.current;
    if (!view) return false;
    const ok = cmd(view.state, view.dispatch, view);
    if (ok) {
      view.focus();
      if (announceKey) announce(deps, announceKey, vars);
    }
    return ok;
  };

  return {
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
        announce(deps, 'visual.announce.undo');
      }
    },
    redo() {
      const view = viewRef.current;
      if (!view) return;
      if (redo(view.state, view.dispatch)) {
        view.focus();
        announce(deps, 'visual.announce.redo');
      }
    },
    toggleInline(tag, attrs = [], defaultText) {
      return applyCommand(
        toggleInlineDitaElement(tag, attrs, defaultText),
        'visual.announce.inlineApplied',
        { tag },
      );
    },
    insertBlock(tag, containerDepth, attrs = []) {
      return applyCommand(
        insertBlockDitaElement(tag, containerDepth, attrs),
        'visual.announce.blockInserted',
        { tag },
      );
    },
    insertBlockAtPos(tag, insertPos, attrs = []) {
      return applyCommand(
        insertBlockDitaElementAtPos(tag, insertPos, attrs),
        'visual.announce.blockInserted',
        { tag },
      );
    },
    insertReuseAtPoint(clientX, clientY, payload) {
      const view = viewRef.current;
      if (!view) return false;
      const coords = view.posAtCoords({ left: clientX, top: clientY });
      if (!coords) return false;
      const attrs: RawAttrs = [
        { name: payload.attrName, value: payload.value, namespaceURI: null },
      ];
      const ok = insertReuseElementAtPos(payload.tagName, coords.pos, attrs)(
        view.state,
        view.dispatch,
        view,
      );
      if (ok) view.focus();
      announce(
        deps,
        ok ? 'visual.announce.conrefDropped' : 'visual.announce.conrefDropBlocked',
        { tag: payload.tagName },
      );
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
      applyCommand(deleteDitaNodeAtPos(nodePos), 'visual.announce.deletedElement');
    },
    moveNode(nodePos, direction) {
      const view = viewRef.current;
      if (!view) return;
      pinnedPosRef.current = null;
      applyCommand(
        moveDitaNodeSibling(nodePos, direction),
        direction === 'up' ? 'visual.announce.movedUp' : 'visual.announce.movedDown',
      );
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
      const ok = TABLE_ACTIONS[action](view.state, view.dispatch);
      if (ok) {
        view.focus();
        announce(deps, 'visual.announce.tableUpdated');
      } else {
        announce(deps, 'visual.announce.tableBlocked');
      }
      return ok;
    },
    openInsertMenuAtElement(anchorEl) {
      slashPosRef.current = null;
      deps.setGapInsertContext(null);
      const rect = anchorEl.getBoundingClientRect();
      deps.setInsertMenuAnchor({ top: rect.bottom + 6, left: rect.left });
      deps.setInsertIsSlash(false);
      deps.setInsertMenuOpen(true);
    },
    getCurrentPmState() {
      return viewRef.current?.state ?? null;
    },
    replaceDocumentXml(nextXml) {
      const view = viewRef.current;
      if (!view) return false;
      try {
        const { pmDoc } = xmlToPmDoc(nextXml);
        const tr = view.state.tr;
        tr.replaceWith(0, view.state.doc.content.size, pmDoc.content);
        for (const [key, value] of Object.entries(pmDoc.attrs)) {
          tr.setDocAttribute(key, value);
        }
        view.dispatch(tr);
        view.focus();
        return true;
      } catch {
        return false;
      }
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
  };
}
