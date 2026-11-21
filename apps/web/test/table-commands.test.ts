import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { DITA_SAMPLE_DOCUMENTS, pmDocToXml, xmlToPmDoc } from '@dita/core';
import {
  addTableColumn,
  addTableRow,
  deleteTableRow,
  mergeCalsCellDown,
  mergeCalsCellRight,
  splitCalsCell,
} from '../src/editor/visual/table-commands';

function runCmd(state: EditorState, cmd: Command): EditorState {
  let next = state;
  const ok = cmd(state, (tr) => {
    next = state.apply(tr);
  });
  expect(ok).toBe(true);
  return next;
}

describe('Phase 1 Table Editing Commands (Simpletable + OASIS CALS)', () => {
  it('adds and deletes rows/columns in <simpletable> cleanly', () => {
    const refSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-reference')!;
    const { pmDoc } = xmlToPmDoc(refSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    // Place cursor inside the first `<strow>` cell (`POST`)
    let cellPos = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dita_strow') {
        cellPos = pos + 3;
        return false;
      }
      return true;
    });
    expect(cellPos).toBeGreaterThan(0);

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, cellPos)));
    state = runCmd(state, addTableRow('after'));
    expect(pmDocToXml(state.doc).match(/<strow>/g)).toHaveLength(3);

    state = runCmd(state, addTableColumn('after'));
    const xmlAfterCol = pmDocToXml(state.doc);
    // Original sthead had 3 stentry -> now 4
    const stheadMatch = /<sthead>([\s\S]*?)<\/sthead>/.exec(xmlAfterCol);
    expect(stheadMatch?.[1]?.match(/<stentry/g)).toHaveLength(4);

    state = runCmd(state, deleteTableRow);
    expect(pmDocToXml(state.doc).match(/<strow>/g)).toHaveLength(2);
  });

  it('merges right (namest/nameend), merges down (morerows), and splits cells in CALS <table>', () => {
    const calsXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">
<reference id="ref_cals_edit">
  <title>CALS Test</title>
  <refbody>
    <section>
      <table frame="all">
        <tgroup cols="3">
          <colspec colnum="1" colname="c1" colwidth="1*"/>
          <colspec colnum="2" colname="c2" colwidth="1*"/>
          <colspec colnum="3" colname="c3" colwidth="1*"/>
          <tbody>
            <row>
              <entry>R1C1</entry>
              <entry>R1C2</entry>
              <entry>R1C3</entry>
            </row>
            <row>
              <entry>R2C1</entry>
              <entry>R2C2</entry>
              <entry>R2C3</entry>
            </row>
          </tbody>
        </tgroup>
      </table>
    </section>
  </refbody>
</reference>
`;
    const { pmDoc } = xmlToPmDoc(calsXml);
    let state = EditorState.create({ doc: pmDoc });

    // Select R1C1
    let r1c1Pos = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'cals_entry' && node.textContent === 'R1C1') {
        r1c1Pos = pos + 2;
        return false;
      }
      return true;
    });
    expect(r1c1Pos).toBeGreaterThan(0);

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, r1c1Pos)));

    // 1. Merge R1C1 + R1C2 -> namest="c1" nameend="c2"
    state = runCmd(state, mergeCalsCellRight);
    const afterMergeRight = pmDocToXml(state.doc);
    expect(afterMergeRight).toContain('namest="c1" nameend="c2"');

    // 2. Split it back -> namest/nameend removed, 3 entries restored in row 1
    state = runCmd(state, splitCalsCell);
    const afterSplit = pmDocToXml(state.doc);
    expect(afterSplit).not.toContain('namest=');
    expect(afterSplit).not.toContain('nameend=');

    // 3. Merge R1C1 + R2C1 down -> morerows="1"
    state = runCmd(state, mergeCalsCellDown);
    const afterMergeDown = pmDocToXml(state.doc);
    expect(afterMergeDown).toContain('morerows="1"');

    // 4. Add column -> cols increments from 3 to 4 and a new <colspec> is added
    state = runCmd(state, addTableColumn('after'));
    const afterAddCol = pmDocToXml(state.doc);
    expect(afterAddCol).toContain('<tgroup cols="4">');
    expect(afterAddCol.match(/<colspec /g)).toHaveLength(4);
  });

  it('refuses destructive structural edits on multi-tgroup CALS tables', () => {
    const multiTgroupXml = `<?xml version="1.0" encoding="UTF-8"?>
<reference id="ref_multi">
  <title>Multi Tgroup</title>
  <refbody>
    <table>
      <tgroup cols="2">
        <tbody><row><entry>A</entry><entry>B</entry></row></tbody>
      </tgroup>
      <tgroup cols="2">
        <tbody><row><entry>C</entry><entry>D</entry></row></tbody>
      </tgroup>
    </table>
  </refbody>
</reference>
`;
    const { pmDoc } = xmlToPmDoc(multiTgroupXml);
    let state = EditorState.create({ doc: pmDoc });

    let entryPos = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'cals_entry' && node.textContent === 'A') {
        entryPos = pos + 2;
        return false;
      }
      return true;
    });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, entryPos)));

    expect(mergeCalsCellRight(state)).toBe(false);
    expect(addTableRow('after')(state)).toBe(false);
    expect(addTableColumn('after')(state)).toBe(false);
  });
});
