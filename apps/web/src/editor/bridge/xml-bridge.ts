import type { Node as PMNode } from 'prosemirror-model';
import {
  checkXmlWellFormed,
  findDomElementByPath,
  findElementPathAtOffset,
  findPmPosByElementPath,
  getNodeSourceRange,
  parseXml,
  pmDocToXml,
  resolvePmElementPath,
  serializeXml,
  slimdomToPmDoc,
  type XmlParseError,
} from '@dita/core';

export type SourceToVisualResult =
  | {
      ok: true;
      pmDoc: PMNode;
      targetPmPos: number | null;
      elementPath: number[];
    }
  | {
      ok: false;
      error: XmlParseError;
    };

export interface VisualToSourceResult {
  xml: string;
  elementPath: number[];
  targetOffset: number | null;
  targetLine: number | null;
  targetColumn: number | null;
}

/**
 * Convert a Visual ProseMirror Document into deterministic lossless XML,
 * and locate the corresponding XML source line/column/offset for the active cursor position.
 */
export function syncVisualToSource(pmDoc: PMNode, pmPos?: number): VisualToSourceResult {
  const xml = pmDocToXml(pmDoc);
  const elementPath = pmPos !== undefined ? resolvePmElementPath(pmDoc, pmPos) : [];

  let targetOffset: number | null = null;
  let targetLine: number | null = null;
  let targetColumn: number | null = null;

  try {
    const parsed = parseXml(xml, { position: true });
    const domEl = findDomElementByPath(parsed.document, elementPath);
    if (domEl) {
      const range = getNodeSourceRange(domEl);
      if (range.open) {
        targetOffset = range.open.start;
        targetLine = range.open.line;
        targetColumn = range.open.column;
      }
    }
  } catch {
    // Serialization output is always well-formed; ignore position lookup failure gracefully
  }

  return {
    xml,
    elementPath,
    targetOffset,
    targetLine,
    targetColumn,
  };
}

/**
 * Guarded Source -> Visual conversion.
 * Always validates XML well-formedness first; blocks switching when malformed and returns exact error location.
 */
export function syncSourceToVisual(
  xml: string,
  sourceCursorOffset?: number,
): SourceToVisualResult {
  const check = checkXmlWellFormed(xml, { position: true });
  if (!check.ok) {
    return {
      ok: false,
      error: check.error,
    };
  }

  const pmDoc = slimdomToPmDoc(check.parsed);
  const elementPath =
    sourceCursorOffset !== undefined
      ? findElementPathAtOffset(check.parsed.document, sourceCursorOffset)
      : [];
  const targetPmPos =
    elementPath.length > 0 ? findPmPosByElementPath(pmDoc, elementPath) : null;

  return {
    ok: true,
    pmDoc,
    targetPmPos,
    elementPath,
  };
}

/**
 * Format XML deterministically using `@dita/core`'s lossless serializer.
 */
export function formatDitaXml(
  xml: string,
): { ok: true; xml: string } | { ok: false; error: XmlParseError } {
  const check = checkXmlWellFormed(xml, { position: false });
  if (!check.ok) {
    return { ok: false, error: check.error };
  }
  return {
    ok: true,
    xml: serializeXml(check.parsed),
  };
}

/**
 * Compute a lightweight line-level change summary against the baseline XML
 * so authors can immediately observe minimal Git Diff hygiene.
 */
export function computeXmlLineDiffStats(
  baselineXml: string,
  currentXml: string,
): { changedLines: number; addedLines: number; removedLines: number; isIdentical: boolean } {
  if (baselineXml === currentXml) {
    return { changedLines: 0, addedLines: 0, removedLines: 0, isIdentical: true };
  }

  const a = baselineXml.split('\n');
  const b = currentXml.split('\n');

  // Trim common prefix and suffix for fast accurate delta estimation
  let prefix = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefix < minLen && a[prefix] === b[prefix]) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }

  const aMid = a.slice(prefix, a.length - suffix);
  const bMid = b.slice(prefix, b.length - suffix);

  const sharedMid = Math.min(aMid.length, bMid.length);
  let modified = 0;
  for (let i = 0; i < sharedMid; i++) {
    if (aMid[i] !== bMid[i]) modified++;
  }

  const addedLines = Math.max(0, bMid.length - aMid.length);
  const removedLines = Math.max(0, aMid.length - bMid.length);
  const changedLines = modified + addedLines + removedLines;

  return {
    changedLines,
    addedLines,
    removedLines,
    isIdentical: false,
  };
}
