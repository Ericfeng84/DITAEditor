/**
 * Drag payload shared by the reuse panel (drag source) and the visual editor (drop target).
 *
 * The panel rows are plain HTML5 drag sources; the editor reads the same payload on drop and
 * inserts a conref/conkeyref element at the drop position. `text/plain` carries a complete XML
 * snippet so dropping into the CodeMirror source view (or any other editor) still works.
 */
export const CONREF_DRAG_MIME = 'application/x-dita-conref';

export interface ConrefDragPayload {
  tagName: string;
  attrName: 'conref' | 'conkeyref';
  value: string;
}

/** Escape a value for use inside a double-quoted XML attribute. */
export function escapeXmlAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `<note conkeyref="common_reuse/backup_warning"/>` — valid for any empty-element reuse target. */
export function buildConrefDragSnippet(payload: ConrefDragPayload): string {
  return `<${payload.tagName} ${payload.attrName}="${escapeXmlAttrValue(payload.value)}"/>`;
}

/** Attach the payload to a `dragstart` event's `dataTransfer`. */
export function writeConrefDragData(
  dataTransfer: DataTransfer,
  payload: ConrefDragPayload,
): void {
  dataTransfer.setData(CONREF_DRAG_MIME, JSON.stringify(payload));
  dataTransfer.setData('text/plain', buildConrefDragSnippet(payload));
  dataTransfer.effectAllowed = 'copy';
}

/**
 * `dragover` cannot read data (browsers only expose the type list for security), so the drop
 * target checks the MIME type first and only parses the payload in `drop`.
 */
export function hasConrefDragPayload(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types ?? []).includes(CONREF_DRAG_MIME);
}

export function parseConrefDragPayload(raw: string | null | undefined): ConrefDragPayload | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<ConrefDragPayload>;
  if (typeof candidate.tagName !== 'string' || candidate.tagName.length === 0) return null;
  if (candidate.attrName !== 'conref' && candidate.attrName !== 'conkeyref') return null;
  if (typeof candidate.value !== 'string' || candidate.value.length === 0) return null;
  return { tagName: candidate.tagName, attrName: candidate.attrName, value: candidate.value };
}

export function readConrefDragPayload(
  dataTransfer: DataTransfer | null,
): ConrefDragPayload | null {
  if (!dataTransfer) return null;
  return parseConrefDragPayload(dataTransfer.getData(CONREF_DRAG_MIME));
}
