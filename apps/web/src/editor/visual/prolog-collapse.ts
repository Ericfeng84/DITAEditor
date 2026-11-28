import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * `<prolog>` is a metadata drawer: collapsed by default so metadata never dominates the
 * editorial reading flow, expandable per document position when authors need to read or edit
 * `<author>` / `<critdates>` / `<metadata>`.
 *
 * The expanded set lives in ProseMirror plugin state (never in the NodeView DOM) because the
 * decoration plugins redraw node views on most transactions — a DOM-held flag would silently
 * reset and the drawer could never stay open.
 */
export interface PrologCollapseState {
  /** Prolog node positions the author has expanded; every other `<prolog>` renders collapsed. */
  expanded: ReadonlySet<number>;
}

export interface PrologCollapseMeta {
  pos: number;
  collapsed: boolean;
}

export const PROLOG_COLLAPSE_KEY = new PluginKey<PrologCollapseState>('ditaPrologCollapse');

export function createPrologCollapsePlugin(): Plugin<PrologCollapseState> {
  return new Plugin<PrologCollapseState>({
    key: PROLOG_COLLAPSE_KEY,
    state: {
      init: () => ({ expanded: new Set<number>() }),
      apply(tr, previous) {
        const meta = tr.getMeta(PROLOG_COLLAPSE_KEY) as PrologCollapseMeta | undefined;

        let expanded = previous.expanded;
        if (tr.docChanged && expanded.size > 0) {
          const mapped = new Set<number>();
          for (const pos of expanded) {
            const result = tr.mapping.mapResult(pos, 1);
            if (!result.deleted) mapped.add(result.pos);
          }
          expanded = mapped;
        }

        if (meta) {
          const next = new Set(expanded);
          if (meta.collapsed) next.delete(meta.pos);
          else next.add(meta.pos);
          expanded = next;
        }

        return expanded === previous.expanded ? previous : { expanded };
      },
    },
  });
}

export function isPrologCollapsed(state: EditorState, pos: number): boolean {
  return !(PROLOG_COLLAPSE_KEY.getState(state)?.expanded.has(pos) ?? false);
}

/** Flip the drawer state for the prolog at `pos` without touching the document. */
export function setPrologCollapsed(view: EditorView, pos: number, collapsed: boolean): void {
  if (isPrologCollapsed(view.state, pos) === collapsed) return;
  view.dispatch(
    view.state.tr.setMeta(PROLOG_COLLAPSE_KEY, {
      pos,
      collapsed,
    } satisfies PrologCollapseMeta),
  );
}
