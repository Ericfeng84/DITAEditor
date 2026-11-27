import type { Node as PMNode } from 'prosemirror-model';
import type { Command } from 'prosemirror-state';
import { getPmNodeRawAttrs, getPmNodeTagName, type RawAttrs } from '@dita/core';
import { createDitaElementSkeleton } from './element-skeleton.js';
import { insertReuseElementAtPos } from './drop-commands.js';

export type ReuseAttrName = 'conref' | 'conkeyref';

/**
 * Profiling attributes that describe *this* occurrence rather than the reused fragment.
 *
 * Replacing a block with a `conref` / `conkeyref` reference throws the block's own content away,
 * but conditional-processing metadata still applies to the reference itself (a reused `<note>`
 * can stay `audience="admin"`), so those six attributes survive the swap verbatim and in their
 * original document order. `@id` and the opposite reuse attribute are dropped: the reference is
 * an alias for the warehouse element, so it must not claim an identity or two targets.
 */
export const REUSE_PROFILING_ATTRS = [
  'audience',
  'platform',
  'product',
  'otherprops',
  'props',
  'rev',
] as const;

const REUSE_PROFILING_ATTR_SET: ReadonlySet<string> = new Set(REUSE_PROFILING_ATTRS);

/**
 * Structural containers that must never be swapped for a reference: they carry the topic's own
 * identity / mandatory content model, so the editor exposes no "make reusable" action for them
 * and the command refuses them even if a stale menu still fires.
 */
export const REUSE_EXCLUDED_BLOCK_TAGS: ReadonlySet<string> = new Set([
  'title',
  'shortdesc',
  'body',
  'conbody',
  'taskbody',
  'refbody',
  'prolog',
  'related-links',
]);

/** Attributes that never survive a "replace block with a reuse reference" swap. */
const DROPPED_ON_REUSE: ReadonlySet<string> = new Set([
  'id',
  'conref',
  'conkeyref',
  'conrefend',
]);

/**
 * Build the `rawAttrs` of the empty reference skeleton that replaces `node`: profiling attributes
 * first (original order), then the `conref` / `conkeyref` attribute.
 */
export function buildReuseSkeletonAttrs(
  node: PMNode,
  attrName: ReuseAttrName,
  value: string,
): RawAttrs {
  const attrs: RawAttrs = [];
  for (const entry of getPmNodeRawAttrs(node)) {
    if (DROPPED_ON_REUSE.has(entry.name)) continue;
    if (!REUSE_PROFILING_ATTR_SET.has(entry.name)) continue;
    attrs.push(entry);
  }
  attrs.push({ name: attrName, value, namespaceURI: null });
  return attrs;
}

/**
 * Replace one block with an empty `conref` / `conkeyref` reference in a **single** transaction so
 * one `undo` restores both the original content and its attributes.
 */
export function replaceBlockWithReuseAtPos(
  blockPos: number,
  attrName: ReuseAttrName,
  value: string,
): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(blockPos);
    if (!node || node.isText || node.isInline) return false;
    const tagName = getPmNodeTagName(node);
    if (!tagName) return false;
    if (REUSE_EXCLUDED_BLOCK_TAGS.has(tagName)) return false;
    const skeleton = createDitaElementSkeleton(
      tagName,
      buildReuseSkeletonAttrs(node, attrName, value),
    );
    if (!skeleton) return false;
    if (!dispatch) return true;
    const tr = state.tr.replaceWith(blockPos, blockPos + node.nodeSize, skeleton);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

/**
 * Insert an empty reuse reference (`<note conkeyref="snippets/note_x"/>`, …) at an explicit
 * document offset — the `/` insert menu and the snippet dialog both target a pinned position.
 */
export function insertReuseReferenceAtPos(
  tagName: string,
  insertPos: number,
  attrName: ReuseAttrName,
  value: string,
): Command {
  const attrs: RawAttrs = [{ name: attrName, value, namespaceURI: null }];
  return insertReuseElementAtPos(tagName, insertPos, attrs);
}
