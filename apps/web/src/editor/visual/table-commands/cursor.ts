/* Cursor discovery and empty-cell factories shared by every table command. */

import type { Node as PMNode } from 'prosemirror-model';
import { type EditorState } from 'prosemirror-state';
import { ditaSchema, getCalsColSpecsFromTgroup, getPmNodeRawAttrs, pmHasMultipleTgroups, type CalsColSpec, type RawAttrs } from '@dita/core';

export const EMPTY_ATTRS: RawAttrs = [];

export function createEmptySimpleCell(): PMNode {
  return ditaSchema.nodes.dita_stentry!.create(
    { rawAttrs: EMPTY_ATTRS, namespaceURI: null },
    [ditaSchema.nodes.xml_text_block!.create()],
  );
}

export function createEmptyCalsEntry(): PMNode {
  return ditaSchema.nodes.cals_entry!.create(
    { rawAttrs: EMPTY_ATTRS, namespaceURI: null, colspan: 1, rowspan: 1 },
    [ditaSchema.nodes.xml_text_block!.create()],
  );
}

// ---------------------------------------------------------------------------
// Simpletable Locators & Commands
// ---------------------------------------------------------------------------

export interface SimpleTableCursor {
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

export function findSimpleTableCursor(state: EditorState): SimpleTableCursor | null {
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

export interface CalsGridCell {
  rowIndex: number;
  colIndex: number;
  colspan: number;
  rowspan: number;
  entryNode: PMNode;
  entryPos: number;
  entryChildIndex: number;
}

export interface CalsSectionGrid {
  rows: { rowNode: PMNode; rowPos: number; rowChildIndex: number }[];
  cells: CalsGridCell[];
  /** Map `${r}:${c}` -> owning CalsGridCell */
  matrix: Map<string, CalsGridCell>;
}

export function buildCalsSectionGrid(
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

export interface CalsCursor {
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

export function findCalsCursor(state: EditorState): CalsCursor | null {
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

export function ensureColSpecs(tgroupNode: PMNode, cols: number): CalsColSpec[] {
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
