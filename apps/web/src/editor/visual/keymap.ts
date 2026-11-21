import { baseKeymap } from 'prosemirror-commands';
import { redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Command, Plugin } from 'prosemirror-state';
import {
  exitCodeblockToParagraph,
  handleDitaBackspace,
  handleDitaEnter,
  toggleInlineDitaElement,
} from './commands';
import { navigateTableCell } from './table-commands';

export interface DitaKeymapCallbacks {
  onOpenInsertMenu: () => void;
  onOpenXrefDialog: () => void;
}

/**
 * Build the DITA-aware ProseMirror keymap plugins.
 * Ordered so DITA structural semantics take priority over baseKeymap defaults.
 */
export function buildDitaKeymapPlugins(callbacks: DitaKeymapCallbacks): Plugin[] {
  const openInsert: Command = () => {
    callbacks.onOpenInsertMenu();
    return true;
  };

  const openXref: Command = () => {
    callbacks.onOpenXrefDialog();
    return true;
  };

  const ditaKeys = keymap({
    'Mod-z': undo,
    'Mod-y': redo,
    'Shift-Mod-z': redo,
    'Mod-b': toggleInlineDitaElement('b'),
    'Mod-i': toggleInlineDitaElement('i'),
    'Mod-u': toggleInlineDitaElement('u'),
    'Mod-e': toggleInlineDitaElement('codeph'),
    'Mod-k': openXref,
    'Mod-/': openInsert,
    Enter: handleDitaEnter,
    'Shift-Enter': exitCodeblockToParagraph,
    'Mod-Enter': exitCodeblockToParagraph,
    Backspace: handleDitaBackspace,
    Tab: navigateTableCell(1),
    'Shift-Tab': navigateTableCell(-1),
  });

  return [ditaKeys, keymap(baseKeymap)];
}
