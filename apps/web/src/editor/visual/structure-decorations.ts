import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { validatePmStructure, type UiLocale } from '@dita/core';
import { getCurrentLocale } from '../../i18n/index.js';
import { describeStructureIssue } from '../structure-messages.js';

/**
 * Live DITA 1.3 content-model (sequence + cardinality) diagnostics for the visual editor.
 *
 * The visual editor intentionally does NOT block transactions: unknown / specialized elements must stay
 * pass-through and lossless. Instead every violation of an *ordered* content model (topic title-first,
 * task `prereq → context → steps → result → postreq`, `step` needing `cmd` first, `dlentry` dt-before-dd,
 * `prolog`, `table`/`tgroup`, …) is highlighted inline with a hover explanation, mirroring Oxygen's behavior.
 */
export interface DitaStructurePluginState {
  locale: UiLocale;
  decorations: DecorationSet;
}

export const DITA_STRUCTURE_KEY =
  new PluginKey<DitaStructurePluginState>('ditaStructureDiagnostics');

function buildStructureDecorations(doc: PMNode, locale: UiLocale): DecorationSet {
  const issues = validatePmStructure(doc);
  if (issues.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  for (const issue of issues) {
    // A missing required child has no node to decorate; the ProblemsPanel and the source linter
    // report it, while the visual editor stays uncluttered (fresh skeletons are mid-authoring).
    if (issue.size <= 0) continue;
    decorations.push(
      Decoration.node(issue.pos, issue.pos + issue.size, {
        class: `dita-structure-invalid dita-structure-${issue.code}`,
        title: describeStructureIssue(issue, locale),
        'data-structure-code': issue.code,
        'data-structure-parent': issue.parentTag,
      }),
    );
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Structure-diagnostic plugin: recomputes only when the document or the UI locale changes.
 */
export function createDitaStructurePlugin(
  initialLocale: UiLocale = getCurrentLocale(),
): Plugin<DitaStructurePluginState> {
  return new Plugin({
    key: DITA_STRUCTURE_KEY,
    state: {
      init(_, state) {
        return {
          locale: initialLocale,
          decorations: buildStructureDecorations(state.doc, initialLocale),
        };
      },
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(DITA_STRUCTURE_KEY) as { locale?: UiLocale } | undefined;
        const nextLocale = meta?.locale ?? prev.locale;
        if (!tr.docChanged && nextLocale === prev.locale) return prev;
        return {
          locale: nextLocale,
          decorations: buildStructureDecorations(newState.doc, nextLocale),
        };
      },
    },
    props: {
      decorations(state) {
        return DITA_STRUCTURE_KEY.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}
