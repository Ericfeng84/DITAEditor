/* ProseMirror plugin wiring `collectDitaDecorations` into the editor view. */

import { Plugin } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';
import { type UiLocale } from '@dita/core';
import { type TagDisplayMode } from '../../../store/editor-store';
import { getCurrentLocale } from '../../../i18n/index.js';
import { DITA_DECORATIONS_KEY, DitaDecorationMeta, DitaDecorationPluginState, DitaDecorationsCallbacks, VisualSemanticContext } from './types.js';
import { collectDitaDecorations } from './collect.js';
export function createDitaDecorationsPlugin(
  initialTagMode: TagDisplayMode,
  callbacks: DitaDecorationsCallbacks,
  initialSemantic?: VisualSemanticContext,
  initialLocale: UiLocale = getCurrentLocale(),
  initialReadOnly = false,
): Plugin<DitaDecorationPluginState> {
  return new Plugin<DitaDecorationPluginState>({
    key: DITA_DECORATIONS_KEY,
    state: {
      init(_, state) {
        return {
          tagMode: initialTagMode,
          locale: initialLocale,
          activeNodePos: null,
          semantic: initialSemantic,
          readOnly: initialReadOnly,
          decorations: collectDitaDecorations(
            state.doc,
            initialTagMode,
            null,
            callbacks,
            state.selection.from,
            initialSemantic,
            initialLocale,
            initialReadOnly,
          ),
        };
      },
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(DITA_DECORATIONS_KEY) as DitaDecorationMeta | undefined;
        const nextTagMode = meta?.tagMode ?? prev.tagMode;
        const nextActivePos =
          meta && 'activeNodePos' in meta ? (meta.activeNodePos ?? null) : prev.activeNodePos;
        const nextSemantic = meta && 'semantic' in meta ? meta.semantic : prev.semantic;
        const nextLocale = meta?.locale ?? prev.locale;
        // `readOnly` is sticky: only an explicit boolean flips it, so unrelated metas that reuse
        // this plugin key (tag mode, locale, semantic overlays) never revive the inserters.
        const nextReadOnly =
          meta && typeof meta.readOnly === 'boolean' ? meta.readOnly : prev.readOnly;

        if (
          !tr.docChanged &&
          !tr.selectionSet &&
          nextTagMode === prev.tagMode &&
          nextActivePos === prev.activeNodePos &&
          nextSemantic === prev.semantic &&
          nextLocale === prev.locale &&
          nextReadOnly === prev.readOnly
        ) {
          return prev;
        }

        return {
          tagMode: nextTagMode,
          locale: nextLocale,
          activeNodePos: nextActivePos,
          semantic: nextSemantic,
          readOnly: nextReadOnly,
          decorations: collectDitaDecorations(
            newState.doc,
            nextTagMode,
            nextActivePos,
            callbacks,
            newState.selection.from,
            nextSemantic,
            nextLocale,
            nextReadOnly,
          ),
        };
      },
    },
    props: {
      decorations(state) {
        return DITA_DECORATIONS_KEY.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}
