/* Row insertion and deletion for `<simpletable>` and OASIS CALS tables. */

import type { Node as PMNode } from 'prosemirror-model';
import { Selection, TextSelection, type Command } from 'prosemirror-state';
import { ditaSchema, getPmNodeRawAttrs, updateCalsEntrySpanAttrs } from '@dita/core';
import type { CalsGridCell } from './cursor.js';
import { EMPTY_ATTRS, createEmptyCalsEntry, createEmptySimpleCell, ensureColSpecs, findCalsCursor, findSimpleTableCursor } from './cursor.js';

export function addTableRow(position: 'before' | 'after'): Command {
  return (state, dispatch) => {
    // 1. Simpletable
    const simple = findSimpleTableCursor(state);
    if (simple) {
      if (position === 'before' && simple.rowNode.type.name === 'dita_sthead') {
        return false; // Never insert a body row above <sthead>
      }
      if (!dispatch) return true;
      const cells: PMNode[] = [];
      for (let i = 0; i < simple.colCount; i++) {
        cells.push(createEmptySimpleCell());
      }
      const newRow = ditaSchema.nodes.dita_strow!.create(
        { rawAttrs: EMPTY_ATTRS, namespaceURI: null },
        cells,
      );
      const insertPos =
        position === 'before' ? simple.rowPos : simple.rowPos + simple.rowNode.nodeSize;
      const tr = state.tr.insert(insertPos, newRow);
      tr.setSelection(TextSelection.create(tr.doc, insertPos + 3));
      dispatch(tr.scrollIntoView());
      return true;
    }

    // 2. CALS table
    const cals = findCalsCursor(state);
    if (!cals) return false;
    if (!dispatch) return true;

    const targetRowIdx =
      position === 'before'
        ? cals.activeCell.rowIndex
        : cals.activeCell.rowIndex + cals.activeCell.rowspan;

    // Count how many columns are already occupied by a vertical span crossing `targetRowIdx`
    let occupiedCols = 0;
    const spanningCellsToExtend: CalsGridCell[] = [];
    if (targetRowIdx > 0 && targetRowIdx < cals.grid.rows.length) {
      const seen = new Set<number>();
      for (let c = 0; c < cals.cols; c++) {
        const owner = cals.grid.matrix.get(`${targetRowIdx}:${c}`);
        if (owner && owner.rowIndex < targetRowIdx && !seen.has(owner.entryPos)) {
          seen.add(owner.entryPos);
          spanningCellsToExtend.push(owner);
          occupiedCols += owner.colspan;
        }
      }
    }

    const neededEntries = Math.max(1, cals.cols - occupiedCols);
    const entries: PMNode[] = [];
    for (let i = 0; i < neededEntries; i++) {
      entries.push(createEmptyCalsEntry());
    }
    const newRow = ditaSchema.nodes.cals_row!.create(
      { rawAttrs: EMPTY_ATTRS, namespaceURI: null },
      entries,
    );

    const tr = state.tr;
    // Extend any vertical spans that cross the new row boundary
    for (const spanCell of spanningCellsToExtend) {
      const nextRowspan = spanCell.rowspan + 1;
      const nextRaw = updateCalsEntrySpanAttrs(
        getPmNodeRawAttrs(spanCell.entryNode),
        ensureColSpecs(cals.tgroupNode, cals.cols),
        spanCell.colIndex,
        spanCell.colspan,
        nextRowspan,
      );
      tr.setNodeMarkup(spanCell.entryPos, undefined, {
        ...spanCell.entryNode.attrs,
        rawAttrs: nextRaw,
        rowspan: nextRowspan,
      });
    }

    let insertPos: number;
    if (position === 'before') {
      insertPos = cals.rowPos;
    } else if (targetRowIdx < cals.grid.rows.length) {
      insertPos = cals.grid.rows[targetRowIdx]!.rowPos;
    } else {
      const lastRow = cals.grid.rows[cals.grid.rows.length - 1]!;
      insertPos = lastRow.rowPos + lastRow.rowNode.nodeSize;
    }

    const mappedInsert = tr.mapping.map(insertPos);
    tr.insert(mappedInsert, newRow);
    tr.setSelection(TextSelection.create(tr.doc, mappedInsert + 3));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export const deleteTableRow: Command = (state, dispatch) => {
  const simple = findSimpleTableCursor(state);
  if (simple) {
    let rowCount = 0;
    simple.tableNode.forEach((c) => {
      if (c.type.name === 'dita_strow' || c.type.name === 'dita_sthead') rowCount++;
    });
    if (rowCount <= 1) return false;
    if (!dispatch) return true;
    const tr = state.tr.delete(simple.rowPos, simple.rowPos + simple.rowNode.nodeSize);
    tr.setSelection(Selection.near(tr.doc.resolve(Math.min(simple.rowPos, tr.doc.content.size)), -1));
    dispatch(tr.scrollIntoView());
    return true;
  }

  const cals = findCalsCursor(state);
  if (!cals) return false;
  if (cals.grid.rows.length <= 1) return false;

  // Guard against deleting a row intersected by a vertical span so we never silently corrupt CALS matrix
  const rIdx = cals.activeCell.rowIndex;
  for (let c = 0; c < cals.cols; c++) {
    const owner = cals.grid.matrix.get(`${rIdx}:${c}`);
    if (owner && owner.rowspan > 1) {
      return false;
    }
  }

  if (!dispatch) return true;
  const tr = state.tr.delete(cals.rowPos, cals.rowPos + cals.rowNode.nodeSize);
  tr.setSelection(Selection.near(tr.doc.resolve(Math.min(cals.rowPos, tr.doc.content.size)), -1));
  dispatch(tr.scrollIntoView());
  return true;
};
