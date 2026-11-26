import type * as slimdom from 'slimdom';
import { getNodeSourceRange, parseXml } from '../xml/parser.js';
import type { AiExtractOptions, AiFragmentExtraction, AiTargetSpec } from './types.js';
import { coreT } from '../i18n/messages.js';
import type { UiLocale } from '../i18n/locale.js';

export const DEFAULT_AI_CONTEXT_LINES = 25;
export const DEFAULT_AI_MAX_CONTEXT_CHARS = 4000;
export const DEFAULT_AI_MAX_TARGET_CHARS = 12000;

const ELEMENT_NODE = 1;

interface LineSpan {
  start: number;
  end: number;
}

interface ResolvedOptions {
  contextLines: number;
  maxContextChars: number;
  maxTargetChars: number;
  locale: UiLocale;
}

/**
 * Locate the AI target inside the original XML and return the exact source slice plus a
 * read-only context window. The document is never reserialized: offsets come straight from
 * the position-tracked parser so untouched regions stay byte-identical.
 */
export function extractTargetFragment(
  xml: string,
  target: AiTargetSpec,
  options: AiExtractOptions = {},
): AiFragmentExtraction {
  const resolved: ResolvedOptions = {
    contextLines: Math.max(0, Math.floor(options.contextLines ?? DEFAULT_AI_CONTEXT_LINES)),
    maxContextChars: Math.max(1, Math.floor(options.maxContextChars ?? DEFAULT_AI_MAX_CONTEXT_CHARS)),
    maxTargetChars: Math.max(1, Math.floor(options.maxTargetChars ?? DEFAULT_AI_MAX_TARGET_CHARS)),
    locale: options.locale ?? 'zh-CN',
  };

  switch (target.mode) {
    case 'element':
      return extractElementTarget(xml, target, resolved);
    case 'line-window':
      return extractLineWindowTarget(xml, target, resolved);
    case 'full-document':
      return extractFullDocumentTarget(xml, target, resolved);
    default: {
      const exhaustive: never = target.mode;
      throw new Error(coreT(options.locale, 'ai.unsupportedMode', { mode: String(exhaustive) }));
    }
  }
}

function extractElementTarget(
  xml: string,
  target: AiTargetSpec,
  options: ResolvedOptions,
): AiFragmentExtraction {
  const elementPath = target.elementPath;
  if (!elementPath) {
    throw new Error(coreT(options.locale, 'ai.elementPathRequired'));
  }

  let root: slimdom.Element;
  try {
    const parsed = parseXml(xml, { position: true });
    const documentElement = parsed.document.documentElement;
    if (!documentElement) {
      throw new Error(coreT(options.locale, 'ai.missingRoot'));
    }
    root = documentElement;
  } catch (err) {
    throw new Error(
      coreT(options.locale, 'ai.elementTargetNeedsWellFormed', {
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  let current: slimdom.Element = root;
  let parent: slimdom.Element | null = null;
  for (const index of elementPath) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(coreT(options.locale, 'ai.invalidElementIndex', { index: String(index) }));
    }
    const children = elementChildren(current);
    const next = children[index];
    if (!next) {
      throw new Error(
        coreT(options.locale, 'ai.elementPathOutOfRange', {
          tag: current.tagName,
          index: String(index),
          count: String(children.length),
        }),
      );
    }
    parent = current;
    current = next;
  }

  const range = getNodeSourceRange(current);
  const reportedStart = range.open?.start;
  if (reportedStart === undefined) {
    throw new Error(coreT(options.locale, 'ai.missingSourceRange', { tag: current.tagName }));
  }
  const startOffset = resolveElementStartOffset(xml, reportedStart, current.tagName);
  if (!xml.startsWith(current.tagName, startOffset + 1)) {
    throw new Error(coreT(options.locale, 'ai.unreliableSourceRange', { tag: current.tagName }));
  }
  const openEnd = range.open?.end ?? startOffset;
  const closeEnd = range.close?.end;
  const endOffset =
    closeEnd !== undefined && closeEnd >= openEnd ? closeEnd : scanElementEndOffset(xml, startOffset);

  const targetXml = xml.slice(startOffset, endOffset);
  const lineStart = lineNumberAt(xml, startOffset);
  const lineEnd = lineNumberAt(xml, Math.max(startOffset, endOffset - 1));
  const context = buildContextWindow(xml, startOffset, endOffset, lineStart, lineEnd, options);

  return {
    mode: 'element',
    originalXml: xml,
    rootTagName: root.tagName,
    targetTag: current.tagName,
    parentTag: parent ? parent.tagName : null,
    targetXml,
    startOffset,
    endOffset,
    lineStart,
    lineEnd,
    contextXml: context.contextXml,
    ...(target.selectedText !== undefined ? { selectedText: target.selectedText } : {}),
    truncated: context.truncated || targetXml.length > options.maxTargetChars,
  };
}

function extractLineWindowTarget(
  xml: string,
  target: AiTargetSpec,
  options: ResolvedOptions,
): AiFragmentExtraction {
  const lines = buildLineIndex(xml);
  const rawStart = target.line ?? 1;
  const rawEnd = target.lineEnd ?? rawStart;
  if (!Number.isInteger(rawStart) || rawStart < 1) {
    throw new Error(coreT(options.locale, 'ai.invalidStartLine', { line: String(rawStart) }));
  }
  if (!Number.isInteger(rawEnd) || rawEnd < rawStart) {
    throw new Error(
      coreT(options.locale, 'ai.invalidEndLine', {
        line: String(rawEnd),
        startLine: String(rawStart),
      }),
    );
  }

  const lineStart = Math.min(rawStart, lines.length);
  const lineEnd = Math.min(rawEnd, lines.length);
  const startOffset = Math.min(lines[lineStart - 1]?.start ?? 0, xml.length);
  const endOffset = Math.min(lines[lineEnd - 1]?.end ?? xml.length, xml.length);
  const targetXml = xml.slice(startOffset, endOffset);
  const context = buildContextWindow(xml, startOffset, endOffset, lineStart, lineEnd, options);

  return {
    mode: 'line-window',
    originalXml: xml,
    rootTagName: deriveRootTagName(xml),
    targetTag: null,
    parentTag: null,
    targetXml,
    startOffset,
    endOffset,
    lineStart,
    lineEnd,
    contextXml: context.contextXml,
    ...(target.selectedText !== undefined ? { selectedText: target.selectedText } : {}),
    truncated: context.truncated || targetXml.length > options.maxTargetChars,
  };
}

function extractFullDocumentTarget(
  xml: string,
  target: AiTargetSpec,
  options: ResolvedOptions,
): AiFragmentExtraction {
  const lines = buildLineIndex(xml);
  const lineStart = 1;
  const lineEnd = lines.length;
  const startOffset = 0;
  const endOffset = xml.length;
  const context = buildContextWindow(xml, startOffset, endOffset, lineStart, lineEnd, options);

  return {
    mode: 'full-document',
    originalXml: xml,
    rootTagName: deriveRootTagName(xml),
    targetTag: null,
    parentTag: null,
    targetXml: xml,
    startOffset,
    endOffset,
    lineStart,
    lineEnd,
    contextXml: context.contextXml,
    ...(target.selectedText !== undefined ? { selectedText: target.selectedText } : {}),
    truncated: context.truncated || xml.length > options.maxTargetChars,
  };
}

/**
 * `slimdom-sax-parser` reports the root element's `position.start` either on the `<` or on the
 * first character of the tag name (observed for documents with a prolog / leading newline), so
 * normalise it back to the `<` before slicing. Non-root elements are reported correctly.
 */
function resolveElementStartOffset(xml: string, reportedStart: number, tagName: string): number {
  if (xml[reportedStart] === '<') return reportedStart;
  const backward = xml.lastIndexOf('<', Math.min(reportedStart, xml.length - 1));
  if (backward !== -1 && xml.startsWith(tagName, backward + 1)) return backward;
  const forward = xml.indexOf('<', Math.max(0, reportedStart));
  if (forward !== -1 && xml.startsWith(tagName, forward + 1)) return forward;
  return reportedStart;
}

function elementChildren(element: slimdom.Element): slimdom.Element[] {
  const result: slimdom.Element[] = [];
  for (const child of element.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      result.push(child as slimdom.Element);
    }
  }
  return result;
}

/** Fallback for missing/invalid close positions: scan forward for the matching end of the element. */
function scanElementEndOffset(xml: string, startOffset: number): number {
  let depth = 0;
  let i = startOffset;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) return xml.length;
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) return xml.length;
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (end === -1) return xml.length;
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      if (end === -1) return xml.length;
      i = end + 2;
      continue;
    }
    const tagEnd = findTagEnd(xml, lt);
    if (tagEnd === -1) return xml.length;
    const isCloseTag = xml[lt + 1] === '/';
    const isSelfClosing = xml[tagEnd - 1] === '/';
    if (isCloseTag) {
      depth -= 1;
    } else if (!isSelfClosing) {
      depth += 1;
    }
    if (depth === 0) return tagEnd + 1;
    i = tagEnd + 1;
  }
  return xml.length;
}

function findTagEnd(xml: string, startOffset: number): number {
  let quote: string | null = null;
  for (let i = startOffset + 1; i < xml.length; i += 1) {
    const char = xml[i]!;
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return i;
    }
  }
  return -1;
}

function buildLineIndex(xml: string): LineSpan[] {
  const lines: LineSpan[] = [];
  let start = 0;
  for (;;) {
    const newline = xml.indexOf('\n', start);
    if (newline === -1) {
      lines.push({ start, end: xml.length });
      return lines;
    }
    lines.push({ start, end: newline });
    start = newline + 1;
  }
}

function lineNumberAt(xml: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, xml.length));
  let line = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (xml[i] === '\n') line += 1;
  }
  return line;
}

/** Derive the root tag name without parsing, so it also works for malformed documents. */
function deriveRootTagName(xml: string): string {
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) return '';
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      if (end === -1) return '';
      i = end + 2;
      continue;
    }
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) return '';
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<!', lt)) {
      const end = findTagEnd(xml, lt);
      if (end === -1) return '';
      i = end + 1;
      continue;
    }
    const match = /^<\s*([A-Za-z_][\w.:-]*)/.exec(xml.slice(lt, lt + 128));
    return match?.[1] ?? '';
  }
  return '';
}

function buildContextWindow(
  xml: string,
  startOffset: number,
  endOffset: number,
  lineStart: number,
  lineEnd: number,
  options: ResolvedOptions,
): { contextXml: string; truncated: boolean } {
  const lines = buildLineIndex(xml);
  const windowStartLine = Math.max(1, lineStart - options.contextLines);
  const windowEndLine = Math.min(lines.length, lineEnd + options.contextLines);
  const firstLine = lines[windowStartLine - 1];
  const lastLine = lines[windowEndLine - 1] ?? lines[lines.length - 1];
  let contextStart = firstLine?.start ?? 0;
  const lastLineEnd = lastLine?.end ?? xml.length;
  // Keep the trailing newline of the last context line so the window holds complete lines.
  let contextEnd = lastLineEnd < xml.length ? lastLineEnd + 1 : lastLineEnd;

  let truncated = false;
  const targetLength = endOffset - startOffset;
  if (contextEnd - contextStart > options.maxContextChars) {
    truncated = true;
    if (targetLength >= options.maxContextChars) {
      contextStart = startOffset;
      contextEnd = Math.min(endOffset, startOffset + options.maxContextChars);
    } else {
      const before = Math.floor((options.maxContextChars - targetLength) / 2);
      contextStart = Math.max(contextStart, startOffset - before);
      // `maxContextChars - before >= targetLength`, so the target always stays inside.
      contextEnd = Math.min(contextEnd, contextStart + options.maxContextChars);
    }
  }

  return { contextXml: xml.slice(contextStart, contextEnd), truncated };
}

/** An enclosing element wider than this makes the whole topic the fix scope instead. */
export const DEFAULT_AI_FIX_WINDOW_MAX_LINES = 80;

export interface AiFixWindowOptions {
  /** Line cap for the widened window. Defaults to `DEFAULT_AI_FIX_WINDOW_MAX_LINES`. */
  maxLines?: number;
  /**
   * When true (used for DITA structure / DITA-OT content-model diagnostics), step one level up
   * from a child element to its enclosing container (e.g. `<cmd>` -> `<step>`) so sibling-level
   * fixes such as deduplication, reordering, or replacing an illegal child can succeed without
   * producing an empty patch.
   */
  expandToParent?: boolean;
}

/**
 * Widen a diagnostic's one-line target to the element that encloses the reported line.
 *
 * Validators report the tag they detect, not the cause: a duplicated `<cmd>` is reported at the
 * step's `</step>`, a missing required child at the parent's end tag, a bad `keyref` at the
 * `topicref`'s closing line. A one-line window can never repair those causes, so the assistant
 * can only echo the line back and the proposal becomes a no-op.
 *
 * The window stays honest about scope: the smallest enclosing element is used, and when that
 * element is the root (or wider than `maxLines`) the whole document becomes the target. Malformed
 * XML has no element tree at all, so the original target is returned untouched.
 *
 * A child element that occupies exactly the reported single line (`<cmd>…</cmd>`) is always
 * widened to its parent container, and with `expandToParent` any non-root container child is
 * widened one level even when it spans several lines, so sibling-level structure fixes
 * (deduplication, reordering, slot exclusivity) can see the whole container.
 */
export function widenAiFixTarget(
  xml: string,
  target: AiTargetSpec,
  options: AiFixWindowOptions = {},
): AiTargetSpec {
  if (target.mode !== 'line-window') return target;
  const maxLines = Math.max(1, Math.floor(options.maxLines ?? DEFAULT_AI_FIX_WINDOW_MAX_LINES));
  const lines = buildLineIndex(xml);
  const totalLines = Math.max(1, lines.length);
  const startLine = Math.min(Math.max(Math.floor(target.line ?? 1), 1), totalLines);
  const endLine = Math.min(Math.max(Math.floor(target.lineEnd ?? startLine), startLine), totalLines);
  const column = Math.max(1, Math.floor(target.column ?? 1));
  const anchorLine = lines[startLine - 1];
  if (!anchorLine) return target;
  const anchorOffset = Math.min(anchorLine.start + column - 1, Math.max(0, xml.length - 1));

  let root: slimdom.Element;
  try {
    const documentElement = parseXml(xml, { position: true }).document.documentElement;
    if (!documentElement) return target;
    root = documentElement;
  } catch {
    return target;
  }

  // Walk down to the innermost element whose source range still covers the reported offset,
  // remembering the ancestor chain (`root` -> `current`) for the parent-widening step below.
  const ancestors: slimdom.Element[] = [root];
  let current = root;
  for (;;) {
    const children = elementChildren(current);
    let next: slimdom.Element | null = null;
    for (const child of children) {
      const childBounds = resolveElementBounds(xml, child);
      if (childBounds && anchorOffset >= childBounds.start && anchorOffset <= childBounds.end) {
        next = child;
        break;
      }
    }
    if (!next) break;
    current = next;
    ancestors.push(current);
  }

  const bounds = resolveElementBounds(xml, current);
  if (!bounds) return target;
  let wideStart = lineNumberAt(xml, bounds.start);
  let wideEnd = lineNumberAt(xml, Math.max(bounds.start, bounds.end - 1));
  // The element covers exactly the single reported line: the cause is a sibling, so looking at the
  // element alone can never fix it.
  const spansReportedSingleLine =
    wideStart === wideEnd && wideStart === startLine && endLine === startLine;

  let targetElement: slimdom.Element = current;

  // One level up, never further: either the element itself only covers the reported line (so the
  // cause is a sibling, e.g. a duplicated `<cmd>`), or the caller explicitly asked for container
  // visibility for structure diagnostics and the element sits below the document root.
  const parentEl = ancestors.length >= 2 ? ancestors[ancestors.length - 2]! : null;
  if (
    parentEl &&
    (spansReportedSingleLine || (options.expandToParent === true && ancestors.length >= 3))
  ) {
    const parentBounds = resolveElementBounds(xml, parentEl);
    if (parentBounds) {
      targetElement = parentEl;
      wideStart = lineNumberAt(xml, parentBounds.start);
      wideEnd = lineNumberAt(xml, Math.max(parentBounds.start, parentBounds.end - 1));
    }
  }

  if (targetElement === root) return { mode: 'full-document' };
  if (wideEnd - wideStart + 1 > maxLines) return { mode: 'full-document' };
  if (wideStart === startLine && wideEnd === endLine) return target;

  return {
    mode: 'line-window',
    line: wideStart,
    column,
    lineEnd: wideEnd,
    ...(target.selectedText !== undefined ? { selectedText: target.selectedText } : {}),
  };
}

/** Byte-exact source span of an element, or `null` when its position is unusable. */
function resolveElementBounds(
  xml: string,
  element: slimdom.Element,
): { start: number; end: number } | null {
  const range = getNodeSourceRange(element);
  const reportedStart = range.open?.start;
  if (reportedStart === undefined) return null;
  const start = resolveElementStartOffset(xml, reportedStart, element.tagName);
  if (!xml.startsWith(element.tagName, start + 1)) return null;
  const openEnd = range.open?.end ?? start;
  const closeEnd = range.close?.end;
  const end = closeEnd !== undefined && closeEnd >= openEnd ? closeEnd : scanElementEndOffset(xml, start);
  return { start, end };
}
