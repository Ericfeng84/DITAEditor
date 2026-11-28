/**
 * Phase 16 Stage 1 — glossary exchange codecs (CSV / JSON / TBX-Basic).
 *
 * All three formats round-trip through the same `GlossaryExchangeRow` shape, so the API can accept
 * any customer glossary and the web import dialog can preview rows without knowing the format.
 * Parsers never throw: they return `errors` with 1-based row numbers instead.
 */

import type * as slimdom from 'slimdom';
import { parseXml } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import type {
  GlossaryExchangeFormat,
  GlossaryExchangeRow,
  GlossaryImportPreview,
  GlossaryParseResult,
} from './types.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

export const GLOSSARY_CSV_COLUMNS = [
  'sourceTerm',
  'synonyms',
  'targetLang',
  'targetTerm',
  'forbiddenTargets',
  'doNotTranslate',
  'caseSensitive',
  'contextNote',
  'partOfSpeech',
  'status',
] as const;

type CsvColumn = (typeof GLOSSARY_CSV_COLUMNS)[number];

const MULTI_VALUE_SEPARATOR = /[|;]/;

const STATUS_VALUES = new Set(['approved', 'draft', 'deprecated']);

const LANGUAGE_TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/;

function splitMultiValue(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(MULTI_VALUE_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  return undefined;
}

function splitCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const ch = text[index]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += ch;
      index += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
      continue;
    }
    field += ch;
    index += 1;
  }

  if (inQuotes) throw new Error('Unterminated quoted field in CSV input.');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse an RFC 4180 glossary CSV (BOM-tolerant, quoted fields, embedded newlines).
 * The header row is matched case-insensitively against `GLOSSARY_CSV_COLUMNS`; reported `row`
 * numbers are 1-based data rows (the header is not counted).
 */
export function parseGlossaryCsv(content: string): GlossaryParseResult {
  const rows: GlossaryExchangeRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  let records: string[][];
  try {
    records = splitCsvRecords(content.replace(/^\uFEFF/, ''));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { rows, errors: [{ row: 1, message }] };
  }

  const headerRecord = records.shift();
  if (!headerRecord) return { rows, errors: [{ row: 1, message: 'CSV input is empty.' }] };

  const headerIndex = new Map<CsvColumn, number>();
  headerRecord.forEach((rawName, columnIndex) => {
    const name = rawName.trim().toLowerCase();
    const canonical = GLOSSARY_CSV_COLUMNS.find((column) => column.toLowerCase() === name);
    if (canonical && !headerIndex.has(canonical)) headerIndex.set(canonical, columnIndex);
  });

  if (!headerIndex.has('sourceTerm')) {
    return {
      rows,
      errors: [
        {
          row: 1,
          message: `CSV header must contain "sourceTerm"; expected columns: ${GLOSSARY_CSV_COLUMNS.join(', ')}.`,
        },
      ],
    };
  }

  records.forEach((record, recordIndex) => {
    // Row numbers are 1-based data rows (the header is not counted) so CSV errors line up with
    // the row numbers `previewGlossaryImport()` reports for other formats.
    const rowNumber = recordIndex + 1;
    if (record.every((cell) => cell.trim().length === 0)) return;
    const get = (column: CsvColumn): string | undefined => {
      const columnIndex = headerIndex.get(column);
      if (columnIndex === undefined) return undefined;
      const value = record[columnIndex];
      return value === undefined ? undefined : value.trim();
    };

    const sourceTerm = get('sourceTerm') ?? '';
    if (sourceTerm.length === 0) {
      errors.push({ row: rowNumber, message: 'sourceTerm must not be empty.' });
      return;
    }

    const targetTermRaw = get('targetTerm');
    const doNotTranslate = parseBoolean(get('doNotTranslate'));
    const statusRaw = get('status');
    if (statusRaw && !STATUS_VALUES.has(statusRaw)) {
      errors.push({
        row: rowNumber,
        message: `status "${statusRaw}" must be approved, draft or deprecated.`,
      });
      return;
    }

    const row: GlossaryExchangeRow = { sourceTerm };
    const synonyms = splitMultiValue(get('synonyms'));
    if (synonyms) row.synonyms = synonyms;
    const targetLang = get('targetLang');
    if (targetLang) row.targetLang = targetLang;
    if (targetTermRaw !== undefined && targetTermRaw.length > 0) row.targetTerm = targetTermRaw;
    else if (targetTermRaw !== undefined) row.targetTerm = null;
    const forbidden = splitMultiValue(get('forbiddenTargets'));
    if (forbidden) row.forbiddenTargets = forbidden;
    if (doNotTranslate !== undefined) row.doNotTranslate = doNotTranslate;
    const caseSensitive = parseBoolean(get('caseSensitive'));
    if (caseSensitive !== undefined) row.caseSensitive = caseSensitive;
    const contextNote = get('contextNote');
    if (contextNote) row.contextNote = contextNote;
    const partOfSpeech = get('partOfSpeech');
    if (partOfSpeech) row.partOfSpeech = partOfSpeech;
    if (statusRaw) row.status = statusRaw as GlossaryExchangeRow['status'];

    rows.push(row);
  });

  return { rows, errors };
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function booleanCell(value: boolean | undefined): string {
  if (value === undefined) return '';
  return value ? 'true' : 'false';
}

/** Serialize glossary rows to RFC 4180 CSV with a fixed column order. */
export function serializeGlossaryCsv(rows: readonly GlossaryExchangeRow[]): string {
  const lines: string[] = [GLOSSARY_CSV_COLUMNS.join(',')];
  for (const row of rows) {
    const cells: string[] = [
      row.sourceTerm ?? '',
      (row.synonyms ?? []).join('|'),
      row.targetLang ?? '',
      row.targetTerm ?? '',
      (row.forbiddenTargets ?? []).join('|'),
      booleanCell(row.doNotTranslate),
      booleanCell(row.caseSensitive),
      row.contextNote ?? '',
      row.partOfSpeech ?? '',
      row.status ?? '',
    ];
    lines.push(cells.map(escapeCsvField).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const parts = value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return parts.length > 0 ? parts : undefined;
  }
  if (typeof value === 'string') return splitMultiValue(value);
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return parseBoolean(value);
  return undefined;
}

function coerceRow(raw: unknown): GlossaryExchangeRow | null {
  if (!isRecord(raw)) return null;
  const sourceTerm = optionalString(raw.sourceTerm ?? raw.source ?? raw.term);
  if (!sourceTerm) return null;

  const row: GlossaryExchangeRow = { sourceTerm };
  const synonyms = stringArray(raw.synonyms);
  if (synonyms) row.synonyms = synonyms;
  const targetLang = optionalString(raw.targetLang ?? raw.lang);
  if (targetLang) row.targetLang = targetLang;
  if (typeof raw.targetTerm === 'string') {
    const trimmed = raw.targetTerm.trim();
    row.targetTerm = trimmed.length > 0 ? trimmed : null;
  } else if (raw.targetTerm === null) {
    row.targetTerm = null;
  }
  const forbidden = stringArray(raw.forbiddenTargets ?? raw.forbidden);
  if (forbidden) row.forbiddenTargets = forbidden;
  const doNotTranslate = optionalBoolean(raw.doNotTranslate ?? raw.dnt);
  if (doNotTranslate !== undefined) row.doNotTranslate = doNotTranslate;
  const caseSensitive = optionalBoolean(raw.caseSensitive);
  if (caseSensitive !== undefined) row.caseSensitive = caseSensitive;
  const contextNote = optionalString(raw.contextNote ?? raw.context);
  if (contextNote) row.contextNote = contextNote;
  const partOfSpeech = optionalString(raw.partOfSpeech);
  if (partOfSpeech) row.partOfSpeech = partOfSpeech;
  const status = optionalString(raw.status);
  if (status && STATUS_VALUES.has(status)) {
    row.status = status as GlossaryExchangeRow['status'];
  }
  return row;
}

/**
 * Parse a glossary JSON document: a bare array, or `{ "terms": [...] }` / `{ "rows": [...] }`.
 * Unknown keys are ignored and malformed rows are reported, never thrown.
 */
export function parseGlossaryJson(content: string): GlossaryParseResult {
  const rows: GlossaryExchangeRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { rows, errors: [{ row: 1, message: `Invalid JSON: ${message}` }] };
  }

  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.terms)
      ? parsed.terms
      : isRecord(parsed) && Array.isArray(parsed.rows)
        ? parsed.rows
        : [];

  if (list.length === 0 && !Array.isArray(parsed)) {
    return {
      rows,
      errors: [{ row: 1, message: 'JSON must be an array or an object with a "terms" array.' }],
    };
  }

  list.forEach((raw, index) => {
    const row = coerceRow(raw);
    if (!row) {
      errors.push({ row: index + 1, message: 'Row must be an object with a non-empty sourceTerm.' });
      return;
    }
    rows.push(row);
  });

  return { rows, errors };
}

/** Serialize glossary rows as a stable, pretty-printed JSON array. */
export function serializeGlossaryJson(rows: readonly GlossaryExchangeRow[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

const MARTIF_LANG_FALLBACK = 'en';

function elementChildren(el: slimdom.Element): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === ELEMENT_NODE) out.push(child as slimdom.Element);
  }
  return out;
}

function elementText(el: slimdom.Element): string {
  let text = '';
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === TEXT_NODE || child.nodeType === CDATA_SECTION_NODE) {
      text += child.nodeValue ?? '';
    } else if (child.nodeType === ELEMENT_NODE) {
      text += elementText(child as slimdom.Element);
    }
  }
  return text.trim();
}

function descendantsByTag(root: slimdom.Element, tagName: string): slimdom.Element[] {
  const out: slimdom.Element[] = [];
  const walk = (el: slimdom.Element): void => {
    for (const child of elementChildren(el)) {
      if (child.tagName === tagName) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

function firstChildByTag(el: slimdom.Element, tagName: string): slimdom.Element | undefined {
  return elementChildren(el).find((child) => child.tagName === tagName);
}

function noteValue(langSet: slimdom.Element, type: string): string | undefined {
  for (const termNote of descendantsByTag(langSet, 'termNote')) {
    if (termNote.getAttribute('type') !== type) continue;
    const text = elementText(termNote);
    if (text.length > 0) return text;
  }
  return undefined;
}

function descripValue(langSet: slimdom.Element, type: string): string | undefined {
  for (const descrip of descendantsByTag(langSet, 'descrip')) {
    if (descrip.getAttribute('type') !== type) continue;
    const text = elementText(descrip);
    if (text.length > 0) return text;
  }
  return undefined;
}

/**
 * Parse a TBX-Basic document (`<martif type="TBX-Basic">`).
 *
 * The first `<langSet>` of a `<termEntry>` is the source language, the second is the target.
 * `descrip type="context"` carries the context note, `termNote type="partOfSpeech"` the POS and
 * `termNote type="administrativeStatus"` the approval status.
 */
export function parseGlossaryTbx(content: string): GlossaryParseResult {
  const rows: GlossaryExchangeRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  let doc;
  try {
    doc = parseXml(content, { position: false }).document;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { rows, errors: [{ row: 1, message: `Invalid TBX XML: ${message}` }] };
  }

  const root = doc.documentElement;
  if (!root || root.tagName !== 'martif') {
    return { rows, errors: [{ row: 1, message: 'TBX document must have a <martif> root element.' }] };
  }

  const termEntries = descendantsByTag(root, 'termEntry');
  if (termEntries.length === 0) {
    return { rows, errors: [{ row: 1, message: 'TBX document contains no <termEntry> elements.' }] };
  }

  termEntries.forEach((termEntry, index) => {
    const rowNumber = index + 1;
    const langSets = elementChildren(termEntry).filter((child) => child.tagName === 'langSet');
    if (langSets.length === 0) {
      errors.push({ row: rowNumber, message: '<termEntry> must contain at least one <langSet>.' });
      return;
    }

    const sourceLangSet = langSets[0]!;
    const sourceTig = firstChildByTag(sourceLangSet, 'tig');
    const sourceTermEl = sourceTig ? firstChildByTag(sourceTig, 'term') : undefined;
    const sourceTerm = sourceTermEl ? elementText(sourceTermEl) : '';
    if (sourceTerm.length === 0) {
      errors.push({ row: rowNumber, message: '<termEntry> source <tig> must contain a <term>.' });
      return;
    }

    const row: GlossaryExchangeRow = { sourceTerm };
    const synonyms: string[] = [];
    if (sourceTig) {
      for (const term of elementChildren(sourceTig)) {
        if (term.tagName !== 'term') continue;
        const text = elementText(term);
        if (text.length > 0 && text !== sourceTerm) synonyms.push(text);
      }
    }
    if (synonyms.length > 0) row.synonyms = synonyms;

    const context = descripValue(sourceLangSet, 'context');
    if (context) row.contextNote = context;
    const dnt = descripValue(sourceLangSet, 'doNotTranslate');
    if (dnt && parseBoolean(dnt) === true) row.doNotTranslate = true;
    const caseSensitive = descripValue(sourceLangSet, 'caseSensitive');
    const caseSensitiveValue = caseSensitive ? parseBoolean(caseSensitive) : undefined;
    if (caseSensitiveValue !== undefined) row.caseSensitive = caseSensitiveValue;

    const targetLangSet = langSets[1];
    if (targetLangSet) {
      const targetLang = targetLangSet.getAttribute('xml:lang');
      if (targetLang) row.targetLang = targetLang;
      const targetTig = firstChildByTag(targetLangSet, 'tig');
      const targetTermEl = targetTig ? firstChildByTag(targetTig, 'term') : undefined;
      const targetTerm = targetTermEl ? elementText(targetTermEl) : '';
      row.targetTerm = targetTerm.length > 0 ? targetTerm : null;
      const partOfSpeech = noteValue(targetLangSet, 'partOfSpeech');
      if (partOfSpeech) row.partOfSpeech = partOfSpeech;
      const status = noteValue(targetLangSet, 'administrativeStatus');
      if (status) {
        const normalized = status.toLowerCase();
        if (status === 'approved' || normalized === 'approved') row.status = 'approved';
        else if (normalized === 'deprecated' || normalized === 'obsolete') row.status = 'deprecated';
        else if (normalized === 'draft' || normalized === 'provision') row.status = 'draft';
      }
      const forbidden = descripValue(targetLangSet, 'forbiddenTerm');
      const forbiddenList = splitMultiValue(forbidden);
      if (forbiddenList) row.forbiddenTargets = forbiddenList;
    }

    rows.push(row);
  });

  return { rows, errors };
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Serialize glossary rows to a TBX-Basic document.
 *
 * Source terms live in the first `<langSet>` (default `en`), the target language — taken from the
 * first row that declares one — in the second.
 */
export function serializeGlossaryTbx(
  rows: readonly GlossaryExchangeRow[],
  sourceLang = 'en',
): string {
  const targetLang = rows.find((row) => row.targetLang)?.targetLang ?? '';
  const langOf = (value: string | undefined): string => value ?? sourceLang;

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<martif type="TBX-Basic" xml:lang="${escapeXmlText(langOf(sourceLang))}">`,
    '  <martifHeader>',
    '    <fileDesc>',
    '      <sourceDesc>',
    '        <p>DITAEditor glossary export</p>',
    '      </sourceDesc>',
    '    </fileDesc>',
    '  </martifHeader>',
    '  <text>',
    '    <body>',
  ];

  rows.forEach((row, index) => {
    lines.push(`      <termEntry id="te-${index + 1}">`);
    lines.push(`        <langSet xml:lang="${escapeXmlText(langOf(sourceLang))}">`);
    const sourceTerms = [row.sourceTerm, ...(row.synonyms ?? [])].filter(
      (term) => term.trim().length > 0,
    );
    lines.push('          <tig>');
    for (const term of sourceTerms) {
      lines.push(`            <term>${escapeXmlText(term)}</term>`);
    }
    if (row.contextNote) {
      lines.push(`            <descrip type="context">${escapeXmlText(row.contextNote)}</descrip>`);
    }
    if (row.doNotTranslate === true) {
      lines.push('            <descrip type="doNotTranslate">true</descrip>');
    }
    if (row.caseSensitive !== undefined) {
      lines.push(
        `            <descrip type="caseSensitive">${row.caseSensitive ? 'true' : 'false'}</descrip>`,
      );
    }
    lines.push('          </tig>');
    lines.push('        </langSet>');

    const rowTargetLang = row.targetLang ?? targetLang;
    lines.push(`        <langSet xml:lang="${escapeXmlText(rowTargetLang || sourceLang)}">`);
    lines.push('          <tig>');
    lines.push(`            <term>${escapeXmlText(row.targetTerm ?? '')}</term>`);
    if (row.partOfSpeech) {
      lines.push(
        `            <termNote type="partOfSpeech">${escapeXmlText(row.partOfSpeech)}</termNote>`,
      );
    }
    if (row.status) {
      lines.push(
        `            <termNote type="administrativeStatus">${escapeXmlText(row.status)}</termNote>`,
      );
    }
    if (row.forbiddenTargets && row.forbiddenTargets.length > 0) {
      lines.push(
        `            <descrip type="forbiddenTerm">${escapeXmlText(row.forbiddenTargets.join('|'))}</descrip>`,
      );
    }
    lines.push('          </tig>');
    lines.push('        </langSet>');
    lines.push('      </termEntry>');
  });

  lines.push('    </body>');
  lines.push('  </text>');
  lines.push('</martif>');
  lines.push('');

  // Route through the real parser/serializer so the export is guaranteed well-formed and stable.
  const parsed = parseXml(lines.join('\n'), { position: false });
  return serializeXml(parsed);
}

function parseByFormat(format: GlossaryExchangeFormat, content: string): GlossaryParseResult {
  switch (format) {
    case 'csv':
      return parseGlossaryCsv(content);
    case 'json':
      return parseGlossaryJson(content);
    case 'tbx':
      return parseGlossaryTbx(content);
    default:
      return { rows: [], errors: [{ row: 1, message: `Unsupported glossary format "${format}".` }] };
  }
}

function validateRow(
  row: GlossaryExchangeRow,
): string | null {
  if (row.sourceTerm.trim().length === 0) return 'sourceTerm must not be empty.';
  if (row.targetLang !== undefined && !LANGUAGE_TAG.test(row.targetLang)) {
    return `targetLang "${row.targetLang}" is not a valid language tag.`;
  }
  if (row.doNotTranslate !== true && (!row.targetTerm || row.targetTerm.trim().length === 0)) {
    return 'targetTerm is required unless doNotTranslate is true.';
  }
  if (row.targetTerm && row.forbiddenTargets) {
    const target = row.targetTerm.trim().toLowerCase();
    if (row.forbiddenTargets.some((forbidden) => forbidden.trim().toLowerCase() === target)) {
      return 'targetTerm must not also be listed as a forbidden translation.';
    }
  }
  return null;
}

/**
 * Dry-run a glossary import: parse, validate, dedupe and diff against existing source terms.
 *
 * Nothing is written here — the caller decides whether to apply `rows`.
 */
export function previewGlossaryImport(
  format: GlossaryExchangeFormat,
  content: string,
  existingSourceTerms?: ReadonlySet<string>,
): GlossaryImportPreview {
  const parsed = parseByFormat(format, content);
  const errors = [...parsed.errors];
  const rows: GlossaryExchangeRow[] = [];

  const existing = new Set<string>();
  for (const term of existingSourceTerms ?? []) {
    existing.add(term.trim().toLowerCase());
  }

  const seen = new Map<string, number>();
  let newCount = 0;
  let updateCount = 0;
  let invalidCount = parsed.errors.length;

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const problem = validateRow(row);
    if (problem) {
      errors.push({ row: rowNumber, message: problem });
      invalidCount += 1;
      return;
    }

    const key = row.sourceTerm.trim().toLowerCase();
    const previousRow = seen.get(key);
    if (previousRow !== undefined) {
      errors.push({
        row: rowNumber,
        message: `Duplicate sourceTerm "${row.sourceTerm}" (first seen on row ${previousRow}).`,
      });
      invalidCount += 1;
      return;
    }
    seen.set(key, rowNumber);

    if (existing.has(key)) updateCount += 1;
    else newCount += 1;
    rows.push(row);
  });

  return {
    rows,
    errors,
    stats: {
      total: parsed.rows.length + parsed.errors.length,
      newCount,
      updateCount,
      invalidCount,
    },
  };
}
