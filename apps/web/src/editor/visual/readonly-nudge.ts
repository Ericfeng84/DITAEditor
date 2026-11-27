/**
 * Read-only edit-intent detection.
 *
 * A viewer who clicks into the visual canvas and starts typing gets nothing at all: ProseMirror
 * is `editable: false`, the caret never appears and the keystroke vanishes. These helpers let the
 * host notice the intent (typing / Backspace / Delete / Enter) and nudge the user toward `检出`
 * instead of silently swallowing their work.
 */

/** Keys that move the caret or dismiss UI — never an edit intent. */
const NAVIGATION_KEYS: ReadonlySet<string> = new Set([
  'Escape',
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Insert',
  'ContextMenu',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
]);

/** Minimal `KeyboardEvent` shape so the predicate stays testable without a DOM. */
export interface KeyStrokeLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/**
 * True when the keystroke would have edited the document. Ctrl/Cmd/Alt combinations are
 * shortcuts (copy, select-all, find, undo, paste-from-menu) and must never trigger the nudge;
 * plain navigation and Escape are ignored as well.
 */
export function isReadOnlyEditKeystroke(event: KeyStrokeLike): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (NAVIGATION_KEYS.has(event.key)) return false;
  if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter') return true;
  // Printable characters (including space) arrive as a single code point.
  return Array.from(event.key).length === 1;
}
