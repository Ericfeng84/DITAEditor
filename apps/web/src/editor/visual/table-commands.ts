import type { Node as PMNode } from 'prosemirror-model';
import { Selection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import {
  ditaSchema,
  getCalsColSpecsFromTgroup,
  getPmNodeRawAttrs,
  pmHasMultipleTgroups,
  setRawAttr,
  updateCalsEntrySpanAttrs,
  type CalsColSpec,
  type RawAttrs,
} from '@dita/core';

const EMPTY_ATTRS: RawAttrs = [];

function createEmptySimpleCell(): PMNode {
  return ditaSchema.nodes.dita_stentry!.create(
    { rawAttrs: EMPTY_ATTRS, namespaceURI: null },
    [ditaSchema.nodes.xml_text_block!.create()],
  );
}

function createEmptyCalsEntry(): PMNode {
  return ditaSchema.nodes.cals_entry!.create(
    { rawAttrs: EMPTY_ATTRS, namespaceURI: null, colspan: 1, rowspan: 1 },
    [ditaSchema.nodes.xml_text_block!.create()],
  );
}

// ---------------------------------------------------------------------------
// Simpletable Locators & Commands
// ---------------------------------------------------------------------------

interface SimpleTableCursor {
  tableDepth: number;
  tablePos: number;
  tableNode: PMNode;
  rowDepth: number;
  rowPos: number;
  rowNode: PMNode;
  rowIndex: number;
  cellDepth: number;
  cellPos: number;
  cellIndex: number;
  colCount: number;
}

function findSimpleTableCursor(state: EditorState): SimpleTableCursor | null {
  const { $from } = state.selection;
  let tableDepth = -1;
  let rowDepth = -1;
  let cellDepth = -1;

  for (let d = $from.depth; d >= 1; d--) {
    const name = $from.node(d).type.name;
    if (cellDepth === -1 && name === 'dita_stentry') cellDepth = d;
    if (rowDepth === -1 && (name === 'dita_strow' || name === 'dita_sthead')) rowDepth = d;
    if (name === 'dita_simpletable') {
      tableDepth = d;
      break;
    }
  }

  if (tableDepth === -1 || rowDepth === -1 || cellDepth === -1) return null;

  const tableNode = $from.node(tableDepth);
  const rowNode = $from.node(rowDepth);

  let colCount = 0;
  rowNode.forEach((c) => {
    if (c.type.name === 'dita_stentry') colCount++;
  });

  return {
    tableDepth,
    tablePos: $from.before(tableDepth),
    tableNode,
    rowDepth,
    rowPos: $from.before(rowDepth),
    rowNode,
    rowIndex: $from.index(tableDepth),
    cellDepth,
    cellPos: $from.before(cellDepth),
    cellIndex: $from.index(rowDepth),
    colCount: Math.max(1, colCount),
  };
}

// ---------------------------------------------------------------------------
// CALS Table Grid & Locators
// ---------------------------------------------------------------------------

interface CalsGridCell {
  rowIndex: number;
  colIndex: number;
  colspan: number;
  rowspan: number;
  entryNode: PMNode;
  entryPos: number;
  entryChildIndex: number;
}

interface CalsSectionGrid {
  rows: { rowNode: PMNode; rowPos: number; rowChildIndex: number }[];
  cells: CalsGridCell[];
  /** Map `${r}:${c}` -> owning CalsGridCell */
  matrix: Map<string, CalsGridCell>;
}

function buildCalsSectionGrid(
  sectionNode: PMNode,
  sectionPos: number,
  cols: number,
  colspecs: CalsColSpec[],
): CalsSectionGrid {
  const colNameToIdx = new Map<string, number>();
  colspecs.forEach((spec, idx) => {
    colNameToIdx.set(spec.colname, spec.colnum > 0 ? spec.colnum - 1 : idx);
  });

  const rows: CalsSectionGrid['rows'] = [];
  const cells: CalsGridCell[] = [];
  const matrix = new Map<string, CalsGridCell>();

  let offset = sectionPos + 1;
  let logicalRow = 0;

  for (let childIdx = 0; childIdx < sectionNode.childCount; childIdx++) {
    const child = sectionNode.child(childIdx);
    const childPos = offset;
    offset += child.nodeSize;

    if (child.type.name !== 'cals_row') continue;
    rows.push({ rowNode: child, rowPos: childPos, rowChildIndex: childIdx });

    let entryOffset = childPos + 1;
    let cursorCol = 0;

    for (let eIdx = 0; eIdx < child.childCount; eIdx++) {
      const entry = child.child(eIdx);
      const entryPos = entryOffset;
      entryOffset += entry.nodeSize;

      if (entry.type.name !== 'cals_entry') continue;

      const rawAttrs = getPmNodeRawAttrs(entry);
      const namest = rawAttrs.find((a) => a.name === 'namest')?.value;
      const colname = rawAttrs.find((a) => a.name === 'colname')?.value;
      const colspan = Math.max(1, Number(entry.attrs.colspan ?? 1));
      const rowspan = Math.max(1, Number(entry.attrs.rowspan ?? 1));

      let startCol: number | undefined;
      if (namest && colNameToIdx.has(namest)) {
        startCol = colNameToIdx.get(namest);
      } else if (colname && colNameToIdx.has(colname)) {
        startCol = colNameToIdx.get(colname);
      }

      if (startCol === undefined) {
        while (matrix.has(`${logicalRow}:${cursorCol}`) && cursorCol < cols + 16) {
          cursorCol++;
        }
        startCol = cursorCol;
      }

      const cellInfo: CalsGridCell = {
        rowIndex: logicalRow,
        colIndex: startCol,
        colspan,
        rowspan,
        entryNode: entry,
        entryPos,
        entryChildIndex: eIdx,
      };
      cells.push(cellInfo);

      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          matrix.set(`${logicalRow + dr}:${startCol + dc}`, cellInfo);
        }
      }

      cursorCol = Math.max(cursorCol, startCol + colspan);
    }

    logicalRow++;
  }

  return { rows, cells, matrix };
}

interface CalsCursor {
  tableDepth: number;
  tablePos: number;
  tableNode: PMNode;
  tgroupDepth: number;
  tgroupPos: number;
  tgroupNode: PMNode;
  sectionDepth: number;
  sectionPos: number;
  sectionNode: PMNode;
  rowDepth: number;
  rowPos: number;
  rowNode: PMNode;
  cellDepth: number;
  cellPos: number;
  cellNode: PMNode;
  cols: number;
  colspecs: CalsColSpec[];
  grid: CalsSectionGrid;
  activeCell: CalsGridCell;
}

function findCalsCursor(state: EditorState): CalsCursor | null {
  const { $from } = state.selection;
  let tableDepth = -1;
  let tgroupDepth = -1;
  let sectionDepth = -1;
  let rowDepth = -1;
  let cellDepth = -1;

  for (let d = $from.depth; d >= 1; d--) {
    const name = $from.node(d).type.name;
    if (cellDepth === -1 && name === 'cals_entry') cellDepth = d;
    if (rowDepth === -1 && name === 'cals_row') rowDepth = d;
    if (sectionDepth === -1 && (name === 'cals_thead' || name === 'cals_tbody')) sectionDepth = d;
    if (tgroupDepth === -1 && name === 'cals_tgroup') tgroupDepth = d;
    if (name === 'cals_table') {
      tableDepth = d;
      break;
    }
  }

  if (
    tableDepth === -1 ||
    tgroupDepth === -1 ||
    sectionDepth === -1 ||
    rowDepth === -1 ||
    cellDepth === -1
  ) {
    return null;
  }

  const tableNode = $from.node(tableDepth);
  if (pmHasMultipleTgroups(tableNode)) {
    return null; // Protect multi-tgroup CALS tables from destructive visual edits
  }

  const tgroupNode = $from.node(tgroupDepth);
  const sectionNode = $from.node(sectionDepth);
  const rowNode = $from.node(rowDepth);
  const cellNode = $from.node(cellDepth);

  const colspecs = getCalsColSpecsFromTgroup(tgroupNode);
  const cols = Math.max(1, Number(tgroupNode.attrs.cols ?? colspecs.length) || 1);
  const sectionPos = $from.before(sectionDepth);
  const cellPos = $from.before(cellDepth);
  const grid = buildCalsSectionGrid(sectionNode, sectionPos, cols, colspecs);
  const activeCell = grid.cells.find((c) => c.entryPos === cellPos);
  if (!activeCell) return null;

  return {
    tableDepth,
    tablePos: $from.before(tableDepth),
    tableNode,
    tgroupDepth,
    tgroupPos: $from.before(tgroupDepth),
    tgroupNode,
    sectionDepth,
    sectionPos,
    sectionNode,
    rowDepth,
    rowPos: $from.before(rowDepth),
    rowNode,
    cellDepth,
    cellPos,
    cellNode,
    cols,
    colspecs,
    grid,
    activeCell,
  };
}

function ensureColSpecs(tgroupNode: PMNode, cols: number): CalsColSpec[] {
  const existing = getCalsColSpecsFromTgroup(tgroupNode);
  if (existing.length >= cols) return existing;
  const specs = [...existing];
  for (let i = specs.length; i < cols; i++) {
    const colnum = i + 1;
    const colname = `c${colnum}`;
    specs.push({
      colnum,
      colname,
      colwidth: '1*',
      rawAttrs: [
        { name: 'colnum', value: String(colnum), namespaceURI: null },
        { name: 'colname', value: colname, namespaceURI: null },
        { name: 'colwidth', value: '1*', namespaceURI: null },
      ],
    });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Unified Table Commands (Work transparently on BOTH simpletable & CALS table)
// ---------------------------------------------------------------------------

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
export function navigateTableCell(direction: 1 | -1): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    let tableDepth = -1;
    let cellDepth = -1;

    for (let d = $from.depth; d >= 1; d--) {
      const name = $from.node(d).type.name;
      if (cellDepth === -1 && (name === 'dita_stentry' || name === 'cals_entry')) {
        cellDepth = d;
      }
      if (name === 'dita_simpletable' || name === 'cals_tgroup') {
        tableDepth = d;
        break;
      }
    }

    if (tableDepth === -1 || cellDepth === -1) return false;

    const tableNode = $from.node(tableDepth);
    const tableStart = $from.start(tableDepth);
    const currentCellPos = $from.before(cellDepth);

    const allCells: { pos: number; node: PMNode }[] = [];
    tableNode.descendants((node, relPos) => {
      if (node.type.name === 'dita_stentry' || node.type.name === 'cals_entry') {
        allCells.push({ pos: tableStart + relPos, node });
        return false;
      }
      return true;
    });

    const curIdx = allCells.findIndex((c) => c.pos === currentCellPos);
    if (curIdx === -1) return false;

    const nextIdx = curIdx + direction;
    if (nextIdx < 0 || nextIdx >= allCells.length) {
      // Pressing Tab on the very last cell adds a new row!
      if (direction === 1) {
        return addTableRow('after')(state, dispatch);
      }
      return true;
    }

    const target = allCells[nextIdx]!;
    if (!dispatch) return true;
    const tr = state.tr;
    if (target.node.childCount === 0) {
      tr.insert(target.pos + 1, ditaSchema.nodes.xml_text_block!.create());
      tr.setSelection(TextSelection.create(tr.doc, target.pos + 2));
    } else {
      tr.setSelection(Selection.near(tr.doc.resolve(target.pos + 1), 1));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}
