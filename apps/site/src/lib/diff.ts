/**
 * Minimal, dependency-free line diff used by both the home-page mini demo and the full
 * playground. It is intentionally pure so it can be unit-tested outside the browser and keeps
 * the site's runtime free of diff libraries.
 */

export type DiffLineType = 'same' | 'add' | 'del';

export interface DiffLine {
  type: DiffLineType;
  text: string;
  /** 1-based line number in the "before" document, when the line exists there. */
  beforeLine?: number;
  /** 1-based line number in the "after" document, when the line exists there. */
  afterLine?: number;
}

export interface DiffSummary {
  lines: DiffLine[];
  /** Number of added lines. */
  added: number;
  /** Number of removed lines. */
  removed: number;
  /** Lines that are identical in both documents. */
  unchanged: number;
}

const MAX_CELLS = 4_000_000;

function splitLines(xml: string): string[] {
  return xml.replace(/\r\n?/g, '\n').split('\n');
}

/**
 * Longest-common-subsequence diff. Falls back to a coarse prefix/suffix match for pathological
 * inputs so the UI never blocks on a quadratic table.
 */
export function computeLineDiff(before: string, after: string): DiffSummary {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length;
  const m = b.length;

  if (n * m > MAX_CELLS) {
    return prefixSuffixDiff(a, b);
  }

  const width = m + 1;
  const table = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + (j + 1)] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + (j + 1)] ?? 0);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i] ?? '', beforeLine: i + 1, afterLine: j + 1 });
      i += 1;
      j += 1;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + (j + 1)] ?? 0)) {
      lines.push({ type: 'del', text: a[i] ?? '', beforeLine: i + 1 });
      i += 1;
    } else {
      lines.push({ type: 'add', text: b[j] ?? '', afterLine: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    lines.push({ type: 'del', text: a[i] ?? '', beforeLine: i + 1 });
    i += 1;
  }
  while (j < m) {
    lines.push({ type: 'add', text: b[j] ?? '', afterLine: j + 1 });
    j += 1;
  }

  return summarise(lines);
}

function prefixSuffixDiff(a: string[], b: string[]): DiffSummary {
  const lines: DiffLine[] = [];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    lines.push({ type: 'same', text: a[prefix] ?? '', beforeLine: prefix + 1, afterLine: prefix + 1 });
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  for (let i = prefix; i < a.length - suffix; i += 1) {
    lines.push({ type: 'del', text: a[i] ?? '', beforeLine: i + 1 });
  }
  for (let j = prefix; j < b.length - suffix; j += 1) {
    lines.push({ type: 'add', text: b[j] ?? '', afterLine: j + 1 });
  }
  for (let k = a.length - suffix; k < a.length; k += 1) {
    const beforeLine = k + 1;
    const afterLine = b.length - (a.length - k) + 1;
    lines.push({ type: 'same', text: a[k] ?? '', beforeLine, afterLine });
  }
  return summarise(lines);
}

function summarise(lines: DiffLine[]): DiffSummary {
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  for (const line of lines) {
    if (line.type === 'add') added += 1;
    else if (line.type === 'del') removed += 1;
    else unchanged += 1;
  }
  return { lines, added, removed, unchanged };
}

/** Only the lines that actually changed plus one line of context either side. */
export function compactDiff(summary: DiffSummary, context = 1): DiffLine[] {
  const keep = new Set<number>();
  summary.lines.forEach((line, index) => {
    if (line.type === 'same') return;
    for (let offset = -context; offset <= context; offset += 1) {
      const target = index + offset;
      if (target >= 0 && target < summary.lines.length) keep.add(target);
    }
  });
  return summary.lines.filter((_, index) => keep.has(index));
}

/** True when two XML strings are byte-identical after newline normalisation. */
export function isByteIdentical(before: string, after: string): boolean {
  return before.replace(/\r\n?/g, '\n') === after.replace(/\r\n?/g, '\n');
}
