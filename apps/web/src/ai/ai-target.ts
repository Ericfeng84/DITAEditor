import {
  checkXmlWellFormed,
  findElementPathAtOffset,
  resolvePmElementPath,
  widenAiFixTarget,
  type AiTargetSpec,
} from '@dita/core';
import type { Node as PMNode } from 'prosemirror-model';
import type { MessageKey } from '../i18n/index.js';

/** Selection text is capped to keep request payloads bounded (contract §1). */
export const AI_SELECTED_TEXT_LIMIT = 4000;

function normalizeSelectedText(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, AI_SELECTED_TEXT_LIMIT);
}

function offsetToLineColumn(xml: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, xml.length));
  const lineStart = xml.lastIndexOf('\n', Math.max(0, clamped - 1)) + 1;
  let line = 1;
  for (let i = 0; i < lineStart; i++) {
    if (xml.charCodeAt(i) === 10) line++;
  }
  return { line, column: clamped - lineStart + 1 };
}

/**
 * Target the deepest element enclosing a ProseMirror selection. Used by the inline
 * bubble toolbar so the AI only rewrites the selected DITA element.
 */
export function buildVisualAiTarget(
  pmDoc: PMNode,
  from: number,
  to: number,
  selectedText?: string,
): AiTargetSpec {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const text = selectedText ?? pmDoc.textBetween(start, end, '\n', ' ');
  const normalized = normalizeSelectedText(text);
  return {
    mode: 'element',
    elementPath: resolvePmElementPath(pmDoc, start),
    ...(normalized !== undefined ? { selectedText: normalized } : {}),
  };
}

/**
 * Target the element at a CodeMirror cursor offset. Malformed XML (or a cursor outside
 * any element) falls back to a one-line window so the API can still repair the source.
 */
export function buildSourceAiTarget(
  xml: string,
  offset: number,
  selectedText?: string,
): AiTargetSpec {
  const { line, column } = offsetToLineColumn(xml, offset);
  const normalized = normalizeSelectedText(selectedText ?? '');
  const wellFormed = checkXmlWellFormed(xml, { position: true });
  if (wellFormed.ok) {
    const elementPath = findElementPathAtOffset(wellFormed.parsed.document, offset);
    if (elementPath.length > 0) {
      return {
        mode: 'element',
        elementPath,
        line,
        column,
        ...(normalized !== undefined ? { selectedText: normalized } : {}),
      };
    }
  }
  return {
    mode: 'line-window',
    line,
    column,
    lineEnd: line,
    ...(normalized !== undefined ? { selectedText: normalized } : {}),
  };
}

/** Build a line-window target for diagnostics, XML errors, and strict-validation failures. */
export function buildLineWindowAiTarget(
  line: number | undefined,
  column?: number,
  lineEnd?: number,
): AiTargetSpec {
  const startLine = line && line > 0 ? Math.floor(line) : 1;
  return {
    mode: 'line-window',
    line: startLine,
    column: column && column > 0 ? Math.floor(column) : 1,
    lineEnd: lineEnd && lineEnd >= startLine ? Math.floor(lineEnd) : startLine,
  };
}

/** Line cap for a widened diagnostic fix window; wider enclosing elements use the whole topic. */
export const AI_FIX_WINDOW_MAX_LINES = 80;

/** Malformed XML has no element tree, so the fix scope is padded around the reported line. */
export const AI_FIX_MALFORMED_CONTEXT_LINES = 12;

/** Diagnostic sources whose reported line is a child tag rather than the structural cause. */
const STRUCTURE_DIAGNOSTIC_SOURCES = new Set(['structure', 'dita-ot']);

/**
 * Turn a validator's reported line into a window the assistant can actually repair.
 *
 * Diagnostics point at the tag that tripped the validator, not at the cause: a duplicated `<cmd>`
 * is reported at the step's `</step>`, so a one-line window leaves the root cause uneditable and
 * the model can only echo the line back (an "applied" patch that changes nothing). The window is
 * therefore widened to the enclosing element — or to the whole topic when that element is the
 * root — and, for malformed XML (no element tree), padded symmetrically around the line.
 *
 * Content-model diagnostics (`structure` / `dita-ot`) are widened one extra level to the
 * container (`<cmd>` -> `<step>`) so sibling-level fixes such as deduplication, reordering or an
 * illegal child replacement can see every element involved.
 */
export function buildDiagnosticFixTarget(
  xml: string,
  line: number | undefined,
  column?: number,
  lineEnd?: number,
  options?: { source?: string },
): AiTargetSpec {
  const base = buildLineWindowAiTarget(line, column, lineEnd);
  const widened = widenAiFixTarget(
    xml,
    base,
    options?.source !== undefined && STRUCTURE_DIAGNOSTIC_SOURCES.has(options.source)
      ? { maxLines: AI_FIX_WINDOW_MAX_LINES, expandToParent: true }
      : { maxLines: AI_FIX_WINDOW_MAX_LINES },
  );
  const changed =
    widened.mode !== base.mode ||
    widened.line !== base.line ||
    widened.lineEnd !== base.lineEnd;
  if (changed) return widened;
  if (checkXmlWellFormed(xml, { position: false }).ok) return base;

  const totalLines = Math.max(1, xml.split('\n').length);
  const anchorStart = base.line ?? 1;
  const anchorEnd = base.lineEnd ?? anchorStart;
  return {
    ...base,
    line: Math.max(1, anchorStart - AI_FIX_MALFORMED_CONTEXT_LINES),
    lineEnd: Math.min(totalLines, anchorEnd + AI_FIX_MALFORMED_CONTEXT_LINES),
  };
}

/**
 * How much of the file the AI is allowed to rewrite.
 *
 * `document` is the default for authoring work: the assistant receives the whole topic and may
 * return a complete root element, which is what "write a full topic" needs. `fragment` keeps the
 * request scoped to the selected element or the source caret line.
 */
export type AiTargetScope = 'fragment' | 'document';

export const AI_TARGET_SCOPE_LABELS: Record<AiTargetScope, MessageKey> = {
  fragment: 'ai.scope.fragment',
  document: 'ai.scope.document',
};

export function resolveScopeTarget(
  scope: AiTargetScope,
  candidates: Array<AiTargetSpec | null | undefined>,
): AiTargetSpec {
  if (scope === 'document') return { mode: 'full-document' };
  return candidates.find((candidate): candidate is AiTargetSpec => Boolean(candidate)) ?? {
    mode: 'full-document',
  };
}
