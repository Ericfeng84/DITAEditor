/* Keyboard cell navigation (Tab / Shift+Tab). */

import type { Node as PMNode } from 'prosemirror-model';
import { Selection, TextSelection, type Command } from 'prosemirror-state';
import { ditaSchema } from '@dita/core';
import { addTableRow } from './rows.js';

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
