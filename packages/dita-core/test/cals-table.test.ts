import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as slimdom from 'slimdom';
import { describe, expect, it } from 'vitest';
import {
  evaluateXPathToFirstNode,
  hasMultipleTgroups,
  parseCalsTgroup,
  parseXml,
  updateCalsEntrySpanAttrs,
  xmlToPmDoc,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('OASIS CALS Table Adapter (@dita/core/cals)', () => {
  it('resolves colspecs, horizontal namest/nameend spans, vertical morerows spans, and grid occupancy', () => {
    const xml = readFileSync(join(FIXTURES_DIR, '03-reference-cals-table.dita'), 'utf8');
    const { document } = parseXml(xml);

    const tableEl = evaluateXPathToFirstNode<slimdom.Element>('//table[@id="tbl_sizing"]', document)!;
    expect(tableEl).not.toBeNull();
    expect(hasMultipleTgroups(tableEl)).toBe(false);

    const tgroupEl = evaluateXPathToFirstNode<slimdom.Element>('.//tgroup', tableEl)!;
    const model = parseCalsTgroup(tgroupEl);

    expect(model.cols).toBe(4);
    expect(model.warnings).toEqual([]);
    expect(model.colspecs.map((c) => c.colname)).toEqual(['c1', 'c2', 'c3', 'c4']);

    // thead row 0: Component (rowspan 2), Resource Allocation (colspan 2 at col 1..2), Notes (rowspan 2 at col 3)
    expect(model.theadRows).toHaveLength(2);
    expect(model.theadRows[0]!.cells).toMatchObject([
      { colIndex: 0, colspan: 1, rowspan: 2 },
      { colIndex: 1, colspan: 2, rowspan: 1 },
      { colIndex: 3, colspan: 1, rowspan: 2 },
    ]);
    // thead row 1: CPU at col 1, Memory at col 2
    expect(model.theadRows[1]!.cells).toMatchObject([
      { colIndex: 1, colspan: 1, rowspan: 1 },
      { colIndex: 2, colspan: 1, rowspan: 1 },
    ]);

    // tbody row 0: Java Worker (morerows=1 -> rowspan 2), 2 vCPU, 2 GB, Notes
    // tbody row 1: skips col 0 because of row 0's morerows! Starts at col 1
    expect(model.tbodyRows).toHaveLength(3);
    expect(model.tbodyRows[0]!.cells[0]).toMatchObject({ colIndex: 0, colspan: 1, rowspan: 2 });
    expect(model.tbodyRows[1]!.cells[0]).toMatchObject({ colIndex: 1, colspan: 1, rowspan: 1 });
    // tbody row 2: PostgreSQL + Redis spans c1..c2 (colspan 2)
    expect(model.tbodyRows[2]!.cells[0]).toMatchObject({ colIndex: 0, colspan: 2, rowspan: 1 });
  });

  it('propagates computed colspan/rowspan onto ProseMirror cals_entry nodes', () => {
    const xml = readFileSync(join(FIXTURES_DIR, '03-reference-cals-table.dita'), 'utf8');
    const { pmDoc } = xmlToPmDoc(xml);

    const entrySpans: Array<{ text: string; colspan: number; rowspan: number }> = [];
    pmDoc.descendants((node) => {
      if (node.type.name === 'cals_entry') {
        entrySpans.push({
          text: node.textContent.trim(),
          colspan: Number(node.attrs.colspan),
          rowspan: Number(node.attrs.rowspan),
        });
      }
    });

    expect(entrySpans).toContainEqual({ text: 'Component', colspan: 1, rowspan: 2 });
    expect(entrySpans).toContainEqual({ text: 'Resource Allocation', colspan: 2, rowspan: 1 });
    expect(entrySpans).toContainEqual({ text: 'Java Worker', colspan: 1, rowspan: 2 });
    expect(entrySpans).toContainEqual({ text: 'PostgreSQL + Redis', colspan: 2, rowspan: 1 });
  });

  it('detects multi-tgroup CALS tables safely', () => {
    const xml = readFileSync(
      join(FIXTURES_DIR, '10-multi-tgroup-cals-and-properties.dita'),
      'utf8',
    );
    const { document } = parseXml(xml);
    const tableEl = evaluateXPathToFirstNode<slimdom.Element>(
      '//table[@id="tbl_multi_tgroup"]',
      document,
    )!;
    expect(hasMultipleTgroups(tableEl)).toBe(true);
  });

  it('updates CALS entry span attributes while preserving unrelated attributes', () => {
    const colspecs = [
      { colnum: 1, colname: 'c1', rawAttrs: [] },
      { colnum: 2, colname: 'c2', rawAttrs: [] },
      { colnum: 3, colname: 'c3', rawAttrs: [] },
    ];
    const updated = updateCalsEntrySpanAttrs(
      [
        { name: 'align', value: 'center', namespaceURI: null },
        { name: 'colname', value: 'c1', namespaceURI: null },
      ],
      colspecs,
      1,
      2,
      3,
    );

    expect(updated.map((a) => [a.name, a.value])).toEqual([
      ['align', 'center'],
      ['namest', 'c2'],
      ['nameend', 'c3'],
      ['morerows', '2'],
    ]);
  });
});
