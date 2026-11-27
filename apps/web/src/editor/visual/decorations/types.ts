/* Decoration types, plugin key, profiling attribute set and the tag-decoration allow/deny lists. */

import { PluginKey } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';
import { type DitavalDisplayMode, type DocumentSemanticOverlay, type ParsedDitaval, type UiLocale } from '@dita/core';
import { type TagDisplayMode } from '../../../store/editor-store';
export interface BlockGapOpenMenuPayload {
  containerTag: string;
  containerDepth: number;
  insertPos: number;
  anchorEl: HTMLElement;
}

export interface DitaDecorationsCallbacks {
  onSelectTagNode: (pos: number) => void;
  onQuickInsertBlock: (tagName: string, insertPos: number) => void;
  onOpenGapInsertMenu: (payload: BlockGapOpenMenuPayload) => void;
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void;
}

export interface VisualSemanticContext {
  overlay: DocumentSemanticOverlay | null;
  ditaval: ParsedDitaval | null;
  ditavalDisplayMode: DitavalDisplayMode;
}

export interface DitaDecorationPluginState {
  tagMode: TagDisplayMode;
  locale: UiLocale;
  activeNodePos: number | null;
  semantic?: VisualSemanticContext;
  /** Read-only documents show no authoring affordances (no `+` gap inserters, no gap highlight). */
  readOnly: boolean;
  decorations: DecorationSet;
}

export interface DitaDecorationMeta {
  tagMode?: TagDisplayMode;
  locale?: UiLocale;
  activeNodePos?: number | null;
  semantic?: VisualSemanticContext;
  readOnly?: boolean;
}

export const DITA_DECORATIONS_KEY = new PluginKey<DitaDecorationPluginState>('ditaDecorations');

export const PROFILING_ATTR_NAMES = new Set([
  'audience',
  'platform',
  'product',
  'otherprops',
  'props',
  'rev',
]);

/**
 * Tailored quick-insert DITA block chips displayed on hover in Jupyter-style between-block dividers.
 * Every tag listed here is strictly verified against `DITA_CONTENT_MODEL` for its container.
 */
export const CONTAINER_QUICK_BLOCK_TAGS: Readonly<Record<string, readonly string[]>> = {
  body: ['p', 'section', 'note', 'ul', 'codeblock'],
  conbody: ['p', 'section', 'note', 'ul', 'codeblock'],
  section: ['p', 'note', 'ul', 'codeblock', 'simpletable'],
  example: ['p', 'codeblock', 'note'],
  refsyn: ['p', 'codeblock'],
  taskbody: ['prereq', 'context', 'steps', 'result', 'postreq'],
  refbody: ['section', 'refsyn', 'simpletable', 'table'],
  steps: ['step'],
  'steps-unordered': ['step'],
  step: ['info', 'substeps', 'choices', 'stepxmp', 'stepresult'],
  substeps: ['substep'],
  substep: ['info', 'stepxmp', 'stepresult'],
  choices: ['choice'],
  ul: ['li'],
  ol: ['li'],
  dl: ['dlentry'],
  prereq: ['p', 'note', 'ul', 'codeblock'],
  context: ['p', 'note', 'ul'],
  info: ['p', 'note', 'ul', 'codeblock'],
  stepxmp: ['p', 'codeblock'],
  stepresult: ['p', 'note', 'codeblock'],
  result: ['p', 'note', 'ul'],
  postreq: ['p', 'note', 'ul'],
  note: ['p', 'ul', 'codeblock'],
  fig: ['desc', 'image', 'p'],
};

/**
 * Nodes whose tag pills should wrap OUTSIDE the node DOM (`pos` / `pos + nodeSize`)
 * rather than inside their `contentDOM` (e.g. code cards, callout boxes, tables, atoms).
 */
export const OUTER_WRAPPED_TAG_NODES = new Set([
  'dita_codeblock',
  'dita_pre',
  'unknown_pre_block',
  'dita_note',
  'dita_prolog',
  'dita_image_block',
  'dita_simpletable',
  'cals_table',
]);

/**
 * HTML table-internal nodes where injecting non-table widget DOM as direct children
 * would break table layout (cells `dita_stentry` & `cals_entry` DO get interior tags).
 */
export const SKIP_TAG_DECORATION_NODES = new Set([
  'dita_sthead',
  'dita_strow',
  'cals_tgroup',
  'cals_colspec',
  'cals_thead',
  'cals_tbody',
  'cals_row',
]);

export const SVG_NS = 'http://www.w3.org/2000/svg';
