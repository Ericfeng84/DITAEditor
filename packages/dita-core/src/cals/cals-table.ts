import type * as slimdom from 'slimdom';
import type { XmlAttributeEntry } from '../xml/types.js';

export interface CalsColSpec {
  colnum: number;
  colname: string;
  colwidth?: string;
  align?: string;
  rawAttrs: XmlAttributeEntry[];
}

export interface CalsCellSpan {
  colIndex: number; // 0-based column index
  rowIndex: number; // 0-based row index within section (thead or tbody)
  colspan: number;
  rowspan: number;
  colname?: string;
  namest?: string;
  nameend?: string;
  morerows?: number;
}

export interface CalsRowModel {
  section: 'thead' | 'tbody';
  rowIndex: number;
  cells: CalsCellSpan[];
}

export interface CalsTgroupModel {
  cols: number;
  colspecs: CalsColSpec[];
  theadRows: CalsRowModel[];
  tbodyRows: CalsRowModel[];
  warnings: string[];
}

export function extractElementAttrs(el: slimdom.Element): XmlAttributeEntry[] {
  return Array.from(el.attributes).map((a) => ({
    name: a.name,
    value: a.value,
    namespaceURI: a.namespaceURI,
  }));
}

/**
 * Parse `<colspec>` elements inside a CALS `<tgroup>`.
 */
export function parseCalsColSpecs(tgroup: slimdom.Element): CalsColSpec[] {
  const specs: CalsColSpec[] = [];
  let nextAutoColnum = 1;

  for (const child of tgroup.childNodes) {
    if (child.nodeType !== 1) continue;
    const el = child as slimdom.Element;
    if (el.tagName !== 'colspec') continue;

    const rawColnum = el.getAttribute('colnum');
    const colnum = rawColnum && /^\d+$/.test(rawColnum) ? Number(rawColnum) : nextAutoColnum;
    nextAutoColnum = colnum + 1;

    const colname = el.getAttribute('colname') ?? `col${colnum}`;
    specs.push({
      colnum,
      colname,
      colwidth: el.getAttribute('colwidth') ?? undefined,
      align: el.getAttribute('align') ?? undefined,
      rawAttrs: extractElementAttrs(el),
    });
  }

  return specs;
}

/**
 * Resolve a CALS `<entry>`'s horizontal span (`colspan`) and vertical span (`rowspan`)
 * against the owning `<tgroup>`'s `colspecs`.
 */
export function resolveCalsEntrySpan(
  entryAttrs: XmlAttributeEntry[],
  colspecs: CalsColSpec[],
): { colspan: number; rowspan: number; startColIndex?: number } {
  const attrMap = new Map(entryAttrs.map((a) => [a.name, a.value]));
  const colNameToIndex = new Map<string, number>();
  colspecs.forEach((spec, idx) => {
    colNameToIndex.set(spec.colname, spec.colnum > 0 ? spec.colnum - 1 : idx);
  });

  const namest = attrMap.get('namest');
  const nameend = attrMap.get('nameend');
  const colname = attrMap.get('colname');
  const morerowsRaw = attrMap.get('morerows');

  let colspan = 1;
  let startColIndex: number | undefined;

  if (namest && nameend) {
    const startIdx = colNameToIndex.get(namest);
    const endIdx = colNameToIndex.get(nameend);
    if (startIdx !== undefined && endIdx !== undefined && endIdx >= startIdx) {
      startColIndex = startIdx;
      colspan = endIdx - startIdx + 1;
    }
  } else if (colname) {
    const idx = colNameToIndex.get(colname);
    if (idx !== undefined) {
      startColIndex = idx;
    }
  }

  let rowspan = 1;
  if (morerowsRaw !== undefined && /^\d+$/.test(morerowsRaw)) {
    rowspan = Number(morerowsRaw) + 1;
  }

  return { colspan, rowspan, startColIndex };
}

function parseSectionRows(
  sectionEl: slimdom.Element,
  section: 'thead' | 'tbody',
  cols: number,
  colspecs: CalsColSpec[],
  warnings: string[],
): CalsRowModel[] {
  const rows: CalsRowModel[] = [];
  // Track occupied cells caused by previous rows' morerows (rowIndex -> Set<colIndex>)
  const occupied = new Map<number, Set<number>>();

  const markOccupied = (r: number, c: number) => {
    let set = occupied.get(r);
    if (!set) {
      set = new Set<number>();
      occupied.set(r, set);
    }
    set.add(c);
  };

  const isOccupied = (r: number, c: number): boolean => occupied.get(r)?.has(c) ?? false;

  let rowIndex = 0;
  for (const child of sectionEl.childNodes) {
    if (child.nodeType !== 1) continue;
    const rowEl = child as slimdom.Element;
    if (rowEl.tagName !== 'row') continue;

    const cells: CalsCellSpan[] = [];
    let cursorCol = 0;

    for (const entryNode of rowEl.childNodes) {
      if (entryNode.nodeType !== 1) continue;
      const entryEl = entryNode as slimdom.Element;
      if (entryEl.tagName !== 'entry') continue;

      const entryAttrs = extractElementAttrs(entryEl);
      const { colspan, rowspan, startColIndex } = resolveCalsEntrySpan(entryAttrs, colspecs);

      let colIndex: number;
      if (startColIndex !== undefined) {
        colIndex = startColIndex;
      } else {
        while (isOccupied(rowIndex, cursorCol)) {
          cursorCol++;
        }
        colIndex = cursorCol;
      }

      if (colIndex + colspan > cols) {
        warnings.push(
          `${section} row ${rowIndex + 1}: entry spans column ${colIndex + 1}..${colIndex + colspan}, exceeding tgroup cols=${cols}`,
        );
      }

      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          markOccupied(rowIndex + dr, colIndex + dc);
        }
      }

      const morerowsAttr = entryEl.getAttribute('morerows');
      cells.push({
        colIndex,
        rowIndex,
        colspan,
        rowspan,
        colname: entryEl.getAttribute('colname') ?? undefined,
        namest: entryEl.getAttribute('namest') ?? undefined,
        nameend: entryEl.getAttribute('nameend') ?? undefined,
        morerows: morerowsAttr !== null && /^\d+$/.test(morerowsAttr) ? Number(morerowsAttr) : undefined,
      });

      cursorCol = Math.max(cursorCol, colIndex + colspan);
    }

    rows.push({ section, rowIndex, cells });
    rowIndex++;
  }

  return rows;
}

/**
 * Parse a CALS `<tgroup>` element into a full grid model with resolved cell coordinates,
 * colspans, rowspans, and colspecs.
 */
export function parseCalsTgroup(tgroup: slimdom.Element): CalsTgroupModel {
  const warnings: string[] = [];
  const colspecs = parseCalsColSpecs(tgroup);
  const colsAttr = tgroup.getAttribute('cols');
  const cols =
    colsAttr && /^\d+$/.test(colsAttr)
      ? Number(colsAttr)
      : Math.max(colspecs.length, 1);

  const theadRows: CalsRowModel[] = [];
  const tbodyRows: CalsRowModel[] = [];

  for (const child of tgroup.childNodes) {
    if (child.nodeType !== 1) continue;
    const el = child as slimdom.Element;
    if (el.tagName === 'thead') {
      theadRows.push(...parseSectionRows(el, 'thead', cols, colspecs, warnings));
    } else if (el.tagName === 'tbody') {
      tbodyRows.push(...parseSectionRows(el, 'tbody', cols, colspecs, warnings));
    }
  }

  return {
    cols,
    colspecs,
    theadRows,
    tbodyRows,
    warnings,
  };
}

/**
 * Update a CALS `<entry>`'s attribute list to reflect a new `(startColIndex, colspan, rowspan)`,
 * preserving all unrelated attributes in their original order.
 */
export function updateCalsEntrySpanAttrs(
  existingAttrs: XmlAttributeEntry[],
  colspecs: CalsColSpec[],
  startColIndex: number,
  colspan: number,
  rowspan: number,
): XmlAttributeEntry[] {
  const filtered = existingAttrs.filter(
    (a) => a.name !== 'colname' && a.name !== 'namest' && a.name !== 'nameend' && a.name !== 'morerows',
  );

  const getColName = (idx: number): string => {
    const byNum = colspecs.find((c) => c.colnum === idx + 1);
    return byNum?.colname ?? colspecs[idx]?.colname ?? `col${idx + 1}`;
  };

  const result: XmlAttributeEntry[] = [...filtered];

  if (colspan > 1) {
    result.push({ name: 'namest', value: getColName(startColIndex), namespaceURI: null });
    result.push({
      name: 'nameend',
      value: getColName(startColIndex + colspan - 1),
      namespaceURI: null,
    });
  }

  if (rowspan > 1) {
    result.push({ name: 'morerows', value: String(rowspan - 1), namespaceURI: null });
  }

  return result;
}

/**
 * Detect whether a CALS `<table>` contains multiple `<tgroup>` elements (rare advanced OASIS pattern).
 */
export function hasMultipleTgroups(tableEl: slimdom.Element): boolean {
  let count = 0;
  for (const child of tableEl.childNodes) {
    if (child.nodeType === 1 && (child as slimdom.Element).tagName === 'tgroup') {
      count++;
      if (count > 1) return true;
    }
  }
  return false;
}
