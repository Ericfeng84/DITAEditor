/* Column insertion (with `<colspec>` widening) and deletion. */

import type { Node as PMNode } from 'prosemirror-model';
import { Selection, type Command } from 'prosemirror-state';
import { ditaSchema, getPmNodeRawAttrs, setRawAttr, type RawAttrs } from '@dita/core';
import { buildCalsSectionGrid, createEmptyCalsEntry, createEmptySimpleCell, ensureColSpecs, findCalsCursor, findSimpleTableCursor } from './cursor.js';

export function addTableColumn(side: 'before' | 'after'): Command {
  return (state, dispatch) => {
    // 1. Simpletable
    const simple = findSimpleTableCursor(state);
    if (simple) {
      if (!dispatch) return true;
      const targetCol = side === 'before' ? simple.cellIndex : simple.cellIndex + 1;
      const tr = state.tr;

      // Walk rows from bottom to top so positions don't shift earlier rows
      const rowPositions: { pos: number; node: PMNode }[] = [];
      let offset = simple.tablePos + 1;
      simple.tableNode.forEach((child) => {
        if (child.type.name === 'dita_sthead' || child.type.name === 'dita_strow') {
          rowPositions.push({ pos: offset, node: child });
        }
        offset += child.nodeSize;
      });

      for (let i = rowPositions.length - 1; i >= 0; i--) {
        const { pos, node } = rowPositions[i]!;
        let cellOffset = pos + 1;
        let seen = 0;
        let insertAt = pos + node.nodeSize - 1;
        for (let c = 0; c < node.childCount; c++) {
          const child = node.child(c);
          if (child.type.name === 'dita_stentry') {
            if (seen === targetCol) {
              insertAt = cellOffset;
              break;
            }
            seen++;
          }
          cellOffset += child.nodeSize;
        }
        tr.insert(insertAt, createEmptySimpleCell());
      }

      dispatch(tr.scrollIntoView());
      return true;
    }

    // 2. CALS table
    const cals = findCalsCursor(state);
    if (!cals) return false;
    if (!dispatch) return true;

    const newCols = cals.cols + 1;
    const insertColIdx =
      side === 'before'
        ? cals.activeCell.colIndex
        : cals.activeCell.colIndex + cals.activeCell.colspan;

    // Pick a unique colname not already used by any existing colspec
    const usedNames = new Set(cals.colspecs.map((s) => s.colname));
    let nextNum = newCols;
    while (usedNames.has(`c${nextNum}`)) nextNum++;
    const newColName = `c${nextNum}`;

    // Rebuild tgroup children cleanly (updating colspecs + appending/inserting cells in thead & tbody)
    const updatedChildren: PMNode[] = [];
    let colspecOrdinal = 0;
    let colspecInserted = false;

    const makeColspecNode = (colnum: number, colname: string, rawAttrs?: RawAttrs): PMNode => {
      const attrs = rawAttrs
        ? setRawAttr(rawAttrs, 'colnum', String(colnum))
        : [
            { name: 'colnum', value: String(colnum), namespaceURI: null },
            { name: 'colname', value: colname, namespaceURI: null },
            { name: 'colwidth', value: '1*', namespaceURI: null },
          ];
      return ditaSchema.nodes.cals_colspec!.create({
        rawAttrs: attrs,
        namespaceURI: null,
        colnum,
        colname,
        colwidth: attrs.find((a) => a.name === 'colwidth')?.value ?? '1*',
      });
    };

    const existingColspecs = ensureColSpecs(cals.tgroupNode, cals.cols);

    cals.tgroupNode.forEach((child) => {
      if (child.type.name === 'cals_colspec') {
        if (!colspecInserted && colspecOrdinal === insertColIdx) {
          updatedChildren.push(makeColspecNode(colspecOrdinal + 1, newColName));
          colspecOrdinal++;
          colspecInserted = true;
        }
        const colname = String(child.attrs.colname || `c${colspecOrdinal + 1}`);
        updatedChildren.push(makeColspecNode(colspecOrdinal + 1, colname, getPmNodeRawAttrs(child)));
        colspecOrdinal++;
        return;
      }

      if (child.type.name === 'cals_thead' || child.type.name === 'cals_tbody') {
        if (!colspecInserted && cals.colspecs.length > 0) {
          updatedChildren.push(makeColspecNode(colspecOrdinal + 1, newColName));
          colspecOrdinal++;
          colspecInserted = true;
        }

        const sectionGrid = buildCalsSectionGrid(child, 0, cals.cols, existingColspecs);
        const newSectionChildren: PMNode[] = [];
        let rowIdx = 0;

        child.forEach((secChild) => {
          if (secChild.type.name !== 'cals_row') {
            newSectionChildren.push(secChild);
            return;
          }

          // Check if a horizontal span crosses `insertColIdx` on this row
          const leftOwner = insertColIdx > 0 ? sectionGrid.matrix.get(`${rowIdx}:${insertColIdx - 1}`) : undefined;
          const rightOwner = insertColIdx < cals.cols ? sectionGrid.matrix.get(`${rowIdx}:${insertColIdx}`) : undefined;
          const crossingSpan = leftOwner && rightOwner && leftOwner.entryPos === rightOwner.entryPos ? leftOwner : null;

          const newRowEntries: PMNode[] = [];
          let insertedInRow = false;
          const rowCells = sectionGrid.cells.filter((c) => c.rowIndex === rowIdx);
          let entryCursor = 0;

          secChild.forEach((entryChild) => {
            if (entryChild.type.name !== 'cals_entry') {
              newRowEntries.push(entryChild);
              return;
            }
            const cellMeta = rowCells[entryCursor++];
            if (crossingSpan && cellMeta && cellMeta.entryPos === crossingSpan.entryPos) {
              // Expand colspan of crossing span by 1 (namest/nameend stay valid because new col sits between them!)
              newRowEntries.push(
                entryChild.type.create(
                  { ...entryChild.attrs, colspan: cellMeta.colspan + 1 },
                  entryChild.content,
                ),
              );
              insertedInRow = true;
              return;
            }

            if (!insertedInRow && !crossingSpan && cellMeta && cellMeta.colIndex >= insertColIdx) {
              newRowEntries.push(createEmptyCalsEntry());
              insertedInRow = true;
            }
            newRowEntries.push(entryChild);
          });

          if (!insertedInRow && !crossingSpan) {
            newRowEntries.push(createEmptyCalsEntry());
          }

          newSectionChildren.push(secChild.type.create(secChild.attrs, newRowEntries));
          rowIdx++;
        });

        updatedChildren.push(child.type.create(child.attrs, newSectionChildren));
        return;
      }

      updatedChildren.push(child);
    });

    const nextTgroupRaw = setRawAttr(getPmNodeRawAttrs(cals.tgroupNode), 'cols', String(newCols));
    const nextTgroup = cals.tgroupNode.type.create(
      { ...cals.tgroupNode.attrs, rawAttrs: nextTgroupRaw, cols: newCols },
      updatedChildren,
    );

    const tr = state.tr.replaceWith(
      cals.tgroupPos,
      cals.tgroupPos + cals.tgroupNode.nodeSize,
      nextTgroup,
    );
    tr.setSelection(Selection.near(tr.doc.resolve(cals.tgroupPos + 1), 1));
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export const deleteTableColumn: Command = (state, dispatch) => {
  // 1. Simpletable
  const simple = findSimpleTableCursor(state);
  if (simple) {
    if (simple.colCount <= 1) return false;
    if (!dispatch) return true;
    const targetCol = simple.cellIndex;
    const tr = state.tr;

    const deletions: { from: number; to: number }[] = [];
    let offset = simple.tablePos + 1;
    simple.tableNode.forEach((row) => {
      if (row.type.name === 'dita_sthead' || row.type.name === 'dita_strow') {
        let cellOffset = offset + 1;
        let idx = 0;
        row.forEach((cell) => {
          if (cell.type.name === 'dita_stentry') {
            if (idx === targetCol) {
              deletions.push({ from: cellOffset, to: cellOffset + cell.nodeSize });
            }
            idx++;
          }
          cellOffset += cell.nodeSize;
        });
      }
      offset += row.nodeSize;
    });

    for (let i = deletions.length - 1; i >= 0; i--) {
      const del = deletions[i]!;
      tr.delete(del.from, del.to);
    }
    dispatch(tr.scrollIntoView());
    return true;
  }

  // 2. CALS table (safely guards against deleting a column with active colspan > 1)
  const cals = findCalsCursor(state);
  if (!cals || cals.cols <= 1) return false;

  const delCol = cals.activeCell.colIndex;
  const existingColspecs = ensureColSpecs(cals.tgroupNode, cals.cols);

  // Check every section so we don't corrupt merged horizontal cells
  let hasBlockedSpan = false;
  cals.tgroupNode.forEach((child) => {
    if (child.type.name === 'cals_thead' || child.type.name === 'cals_tbody') {
      const g = buildCalsSectionGrid(child, 0, cals.cols, existingColspecs);
      for (let r = 0; r < g.rows.length; r++) {
        const owner = g.matrix.get(`${r}:${delCol}`);
        if (owner && owner.colspan > 1) {
          hasBlockedSpan = true;
        }
      }
    }
  });
  if (hasBlockedSpan) return false;
  if (!dispatch) return true;

  const newCols = cals.cols - 1;
  const updatedChildren: PMNode[] = [];
  let colspecIdx = 0;
  let newColnum = 1;

  cals.tgroupNode.forEach((child) => {
    if (child.type.name === 'cals_colspec') {
      if (colspecIdx === delCol) {
        colspecIdx++;
        return;
      }
      const nextRaw = setRawAttr(getPmNodeRawAttrs(child), 'colnum', String(newColnum));
      updatedChildren.push(
        child.type.create({ ...child.attrs, rawAttrs: nextRaw, colnum: newColnum }),
      );
      newColnum++;
      colspecIdx++;
      return;
    }

    if (child.type.name === 'cals_thead' || child.type.name === 'cals_tbody') {
      const g = buildCalsSectionGrid(child, 0, cals.cols, existingColspecs);
      const newSectionChildren: PMNode[] = [];
      let rIdx = 0;

      child.forEach((secChild) => {
        if (secChild.type.name !== 'cals_row') {
          newSectionChildren.push(secChild);
          return;
        }
        const rowCells = g.cells.filter((c) => c.rowIndex === rIdx);
        const newEntries: PMNode[] = [];
        let eCursor = 0;

        secChild.forEach((entryChild) => {
          if (entryChild.type.name !== 'cals_entry') {
            newEntries.push(entryChild);
            return;
          }
          const cellMeta = rowCells[eCursor++];
          if (cellMeta && cellMeta.colIndex === delCol) {
            return; // drop deleted column cell
          }
          newEntries.push(entryChild);
        });

        newSectionChildren.push(secChild.type.create(secChild.attrs, newEntries));
        rIdx++;
      });

      updatedChildren.push(child.type.create(child.attrs, newSectionChildren));
      return;
    }

    updatedChildren.push(child);
  });

  const nextTgroupRaw = setRawAttr(getPmNodeRawAttrs(cals.tgroupNode), 'cols', String(newCols));
  const nextTgroup = cals.tgroupNode.type.create(
    { ...cals.tgroupNode.attrs, rawAttrs: nextTgroupRaw, cols: newCols },
    updatedChildren,
  );

  const tr = state.tr.replaceWith(
    cals.tgroupPos,
    cals.tgroupPos + cals.tgroupNode.nodeSize,
    nextTgroup,
  );
  tr.setSelection(Selection.near(tr.doc.resolve(cals.tgroupPos + 1), 1));
  dispatch(tr.scrollIntoView());
  return true;
};

// ---------------------------------------------------------------------------
// OASIS CALS Cell Merge & Split Commands
// ---------------------------------------------------------------------------
