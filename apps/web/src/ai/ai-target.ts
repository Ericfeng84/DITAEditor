import {
  checkXmlWellFormed,
  findElementPathAtOffset,
  resolvePmElementPath,
  type AiTargetSpec,
} from '@dita/core';
import type { Node as PMNode } from 'prosemirror-model';

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

/**
 * How much of the file the AI is allowed to rewrite.
 *
 * `document` is the default for authoring work: the assistant receives the whole topic and may
 * return a complete root element, which is what "write a full topic" needs. `fragment` keeps the
 * request scoped to the selected element or the source caret line.
 */
export type AiTargetScope = 'fragment' | 'document';

export const AI_TARGET_SCOPE_LABELS: Record<AiTargetScope, string> = {
  fragment: '片段',
  document: '整篇 Topic',
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
