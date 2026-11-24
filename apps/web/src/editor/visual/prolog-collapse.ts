import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * `<prolog>` is a metadata drawer: expanded by default so authors can read and edit
 * `<author>` / `<critdates>` / `<metadata>` directly, collapsible per document position.
 *
 * The collapsed set lives in ProseMirror plugin state (never in the NodeView DOM) because the
 * decoration plugins redraw node views on most transactions — a DOM-held flag would silently
 * reset and the drawer could never stay open.
 */
export interface PrologCollapseState {
  /** Prolog node positions the author has collapsed; every other `<prolog>` renders expanded. */
  collapsed: ReadonlySet<number>;
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
      init: () => ({ collapsed: new Set<number>() }),
      apply(tr, previous) {
        const meta = tr.getMeta(PROLOG_COLLAPSE_KEY) as PrologCollapseMeta | undefined;

        let collapsed = previous.collapsed;
        if (tr.docChanged && collapsed.size > 0) {
          const mapped = new Set<number>();
          for (const pos of collapsed) {
            const result = tr.mapping.mapResult(pos, 1);
            if (!result.deleted) mapped.add(result.pos);
          }
          collapsed = mapped;
        }

        if (meta) {
          const next = new Set(collapsed);
          if (meta.collapsed) next.add(meta.pos);
          else next.delete(meta.pos);
          collapsed = next;
        }

        return collapsed === previous.collapsed ? previous : { collapsed };
      },
    },
  });
}

export function isPrologCollapsed(state: EditorState, pos: number): boolean {
  return PROLOG_COLLAPSE_KEY.getState(state)?.collapsed.has(pos) ?? false;
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
