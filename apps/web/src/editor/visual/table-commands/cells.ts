/* CALS cell merging (namest/nameend/morerows) and splitting. */

import type { Node as PMNode } from 'prosemirror-model';
import { Selection, type Command } from 'prosemirror-state';
import { ditaSchema, getPmNodeRawAttrs, updateCalsEntrySpanAttrs } from '@dita/core';
import { buildCalsSectionGrid, createEmptyCalsEntry, ensureColSpecs, findCalsCursor } from './cursor.js';

function mergeCellContents(first: PMNode, second: PMNode): PMNode[] {
  const children: PMNode[] = [];
  first.forEach((c) => {
    if (!(c.type.name === 'xml_text_block' && c.content.size === 0)) {
      children.push(c);
    }
  });
  second.forEach((c) => {
    if (!(c.type.name === 'xml_text_block' && c.content.size === 0)) {
      children.push(c);
    }
  });
  if (children.length === 0) {
    children.push(ditaSchema.nodes.xml_text_block!.create());
  }
  return children;
}

/**
 * Merge the active CALS `<entry>` with its immediate right neighbor (`namest`/`nameend` + `colspan`).
 */
export const mergeCalsCellRight: Command = (state, dispatch) => {
  const cals = findCalsCursor(state);
  if (!cals) return false;

  const { activeCell, grid, cols } = cals;
  const rightCol = activeCell.colIndex + activeCell.colspan;
  if (rightCol >= cols) return false;

  const neighbor = grid.matrix.get(`${activeCell.rowIndex}:${rightCol}`);
  if (
    !neighbor ||
    neighbor.entryPos === activeCell.entryPos ||
    neighbor.rowIndex !== activeCell.rowIndex ||
    neighbor.rowspan !== activeCell.rowspan
  ) {
    return false;
  }

  if (!dispatch) return true;

  const colspecs = ensureColSpecs(cals.tgroupNode, cols);
  const newColspan = activeCell.colspan + neighbor.colspan;
  const nextRaw = updateCalsEntrySpanAttrs(
    getPmNodeRawAttrs(activeCell.entryNode),
    colspecs,
    activeCell.colIndex,
    newColspan,
    activeCell.rowspan,
  );
  const mergedNode = activeCell.entryNode.type.create(
    { ...activeCell.entryNode.attrs, rawAttrs: nextRaw, colspan: newColspan },
    mergeCellContents(activeCell.entryNode, neighbor.entryNode),
  );

  const tr = state.tr;
  // Delete right neighbor first (higher pos), then replace active cell
  tr.delete(neighbor.entryPos, neighbor.entryPos + neighbor.entryNode.nodeSize);
  tr.replaceWith(
    activeCell.entryPos,
    activeCell.entryPos + activeCell.entryNode.nodeSize,
    mergedNode,
  );
  tr.setSelection(Selection.near(tr.doc.resolve(activeCell.entryPos + 1), 1));
  dispatch(tr.scrollIntoView());
  return true;
};

/**
 * Merge the active CALS `<entry>` with the cell directly below it (`morerows` + `rowspan`).
 */
export const mergeCalsCellDown: Command = (state, dispatch) => {
  const cals = findCalsCursor(state);
  if (!cals) return false;

  const { activeCell, grid, cols } = cals;
  const belowRow = activeCell.rowIndex + activeCell.rowspan;
  if (belowRow >= grid.rows.length) return false;

  const neighbor = grid.matrix.get(`${belowRow}:${activeCell.colIndex}`);
  if (
    !neighbor ||
    neighbor.entryPos === activeCell.entryPos ||
    neighbor.colIndex !== activeCell.colIndex ||
    neighbor.colspan !== activeCell.colspan
  ) {
    return false;
  }

  if (!dispatch) return true;

  const colspecs = ensureColSpecs(cals.tgroupNode, cols);
  const newRowspan = activeCell.rowspan + neighbor.rowspan;
  const nextRaw = updateCalsEntrySpanAttrs(
    getPmNodeRawAttrs(activeCell.entryNode),
    colspecs,
    activeCell.colIndex,
    activeCell.colspan,
    newRowspan,
  );
  const mergedNode = activeCell.entryNode.type.create(
    { ...activeCell.entryNode.attrs, rawAttrs: nextRaw, rowspan: newRowspan },
    mergeCellContents(activeCell.entryNode, neighbor.entryNode),
  );

  const tr = state.tr;
  // Delete lower neighbor first (higher pos), then replace active cell
  tr.delete(neighbor.entryPos, neighbor.entryPos + neighbor.entryNode.nodeSize);
  tr.replaceWith(
    activeCell.entryPos,
    activeCell.entryPos + activeCell.entryNode.nodeSize,
    mergedNode,
  );
  tr.setSelection(Selection.near(tr.doc.resolve(activeCell.entryPos + 1), 1));
  dispatch(tr.scrollIntoView());
  return true;
};

/**
 * Split a merged CALS `<entry>` back into individual 1×1 cells, clearing `namest`/`nameend`/`morerows`.
 */
export const splitCalsCell: Command = (state, dispatch) => {
  const cals = findCalsCursor(state);
  if (!cals) return false;

  const { activeCell, grid, cols } = cals;
  if (activeCell.colspan <= 1 && activeCell.rowspan <= 1) return false;
  if (!dispatch) return true;

  const colspecs = ensureColSpecs(cals.tgroupNode, cols);
  const resetRaw = updateCalsEntrySpanAttrs(
    getPmNodeRawAttrs(activeCell.entryNode),
    colspecs,
    activeCell.colIndex,
    1,
    1,
  );
  const resetCell = activeCell.entryNode.type.create(
    { ...activeCell.entryNode.attrs, rawAttrs: resetRaw, colspan: 1, rowspan: 1 },
    activeCell.entryNode.content,
  );

  // Apply edits from bottom row upward so earlier positions stay intact
  const tr = state.tr;

  for (let r = activeCell.rowIndex + activeCell.rowspan - 1; r >= activeCell.rowIndex; r--) {
    const rowInfo = grid.rows[r];
    if (!rowInfo) continue;

    if (r === activeCell.rowIndex) {
      // Replace activeCell with resetCell + (colspan - 1) empty cells right after it
      const replacement: PMNode[] = [resetCell];
      for (let dc = 1; dc < activeCell.colspan; dc++) {
        replacement.push(createEmptyCalsEntry());
      }
      tr.replaceWith(
        activeCell.entryPos,
        activeCell.entryPos + activeCell.entryNode.nodeSize,
        replacement,
      );
    } else {
      // Find insertion offset inside row `r` before the first cell whose colIndex > activeCell.colIndex
      const rowCells = grid.cells.filter((c) => c.rowIndex === r);
      const nextCell = rowCells.find((c) => c.colIndex > activeCell.colIndex);
      const insertAt = nextCell
        ? nextCell.entryPos
        : rowInfo.rowPos + rowInfo.rowNode.nodeSize - 1;

      const filler: PMNode[] = [];
      for (let dc = 0; dc < activeCell.colspan; dc++) {
        filler.push(createEmptyCalsEntry());
      }
      tr.insert(insertAt, filler);
    }
  }

  tr.setSelection(Selection.near(tr.doc.resolve(activeCell.entryPos + 1), 1));
  dispatch(tr.scrollIntoView());
  return true;
};

/**
 * Tab / Shift+Tab navigation across cells inside `<simpletable>` or CALS `<table>`.
 * Automatically hydrates empty target cells with an `xml_text_block` so authors can type immediately.
 */
