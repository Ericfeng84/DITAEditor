/* Decoration collection: tag chrome, gap inserters, DITAVAL flags and semantic overlays. */

import type { Node as PMNode } from 'prosemirror-model';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { evaluateElementConditions, getAllowedChildElements, getInsertableTagsBySequence, getPmChildTags, getPmNodeRawAttrs, getPmNodeTagName, getRawAttr, isUnknownPmNode, makeConrefOverlayKey, type UiLocale } from '@dita/core';
import { type TagDisplayMode } from '../../../store/editor-store';
import { sanitizeCssColor } from '../conref-renderer';
import { getCurrentLocale } from '../../../i18n/index.js';
import { CONTAINER_QUICK_BLOCK_TAGS, DitaDecorationsCallbacks, OUTER_WRAPPED_TAG_NODES, PROFILING_ATTR_NAMES, SKIP_TAG_DECORATION_NODES, VisualSemanticContext } from './types.js';
import { createDitavalFlagPillDom, createOxygenTagDom, createProfilingBadgeDom } from './tag-dom.js';
import { createConrefWidgetDom } from './conref-widget.js';
import { createBlockGapInserterDom } from './gap-inserter.js';
export function collectDitaDecorations(
  doc: PMNode,
  tagMode: TagDisplayMode,
  activeNodePos: number | null,
  callbacks: DitaDecorationsCallbacks,
  selectionPos: number | null = null,
  semantic?: VisualSemanticContext,
  locale: UiLocale = getCurrentLocale(),
  readOnly = false,
): DecorationSet {
  const decorations: Decoration[] = [];

  // Deepest block containing the selection whose parent hosts `+` gap inserters.
  // It gets `dita-gap-active` so the gaps directly above/below it stay visible.
  if (
    !readOnly &&
    selectionPos !== null &&
    selectionPos >= 0 &&
    selectionPos <= doc.content.size
  ) {
    const $sel = doc.resolve(selectionPos);
    for (let d = $sel.depth; d >= 2; d--) {
      const candidate = $sel.node(d);
      const parentTag = getPmNodeTagName($sel.node(d - 1));
      if (
        !candidate.isInline &&
        candidate.type.name !== 'xml_text_block' &&
        parentTag &&
        CONTAINER_QUICK_BLOCK_TAGS[parentTag]
      ) {
        const start = $sel.before(d);
        decorations.push(
          Decoration.node(start, start + candidate.nodeSize, { class: 'dita-gap-active' }),
        );
        break;
      }
    }
  }

  const ditaval = semantic?.ditaval ?? null;
  const ditavalMode = semantic?.ditavalDisplayMode ?? 'dim-excluded';
  const overlay = semantic?.overlay ?? null;

  const visit = (node: PMNode, pos: number, depth: number, ancestorExcluded: boolean) => {
    const typeName = node.type.name;
    const tagName = getPmNodeTagName(node);
    const rawAttrs = tagName ? getPmNodeRawAttrs(node) : [];
    const profilingAttrs = tagName ? rawAttrs.filter((a) => PROFILING_ATTR_NAMES.has(a.name)) : [];

    // 0. DITAVAL conditional profiling evaluation & projection
    let nodeExcludedSelf = false;
    if (tagName && !SKIP_TAG_DECORATION_NODES.has(typeName)) {
      const evalRes = evaluateElementConditions(rawAttrs, ditaval);
      nodeExcludedSelf = evalRes.status === 'exclude';

      if (ditaval && nodeExcludedSelf && !ancestorExcluded) {
        const cls =
          ditavalMode === 'hide-excluded'
            ? 'dita-ditaval-excluded-hide'
            : ditavalMode === 'show-all'
              ? 'dita-ditaval-excluded-outline'
              : 'dita-ditaval-excluded-dim';
        decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }));
      } else if (ditaval && !ancestorExcluded && !nodeExcludedSelf && evalRes.status === 'flag') {
        const fg = sanitizeCssColor(evalRes.effectiveStyle?.color);
        const bg = sanitizeCssColor(evalRes.effectiveStyle?.backcolor);
        const styleParts: string[] = [];
        if (fg) styleParts.push(`color: ${fg}`);
        if (bg) styleParts.push(`background-color: ${bg}`);
        if (evalRes.effectiveStyle?.style === 'bold') styleParts.push('font-weight: 700');
        else if (evalRes.effectiveStyle?.style === 'italics') styleParts.push('font-style: italic');
        else if (evalRes.effectiveStyle?.style === 'underline') {
          styleParts.push('text-decoration: underline');
        }
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: 'dita-ditaval-flagged',
            ...(styleParts.length > 0 ? { style: styleParts.join('; ') } : {}),
          }),
        );

        const isOuterWrapped = OUTER_WRAPPED_TAG_NODES.has(typeName);
        const flagStartPos = node.isAtom || isOuterWrapped ? pos : pos + 1;
        const flagEndPos = node.isAtom || isOuterWrapped ? pos + node.nodeSize : pos + node.nodeSize - 1;
        for (const fl of evalRes.flags) {
          if (fl.startFlag?.altText) {
            decorations.push(
              Decoration.widget(
                flagStartPos,
                () =>
                  createDitavalFlagPillDom(
                    fl.startFlag!.altText!,
                    sanitizeCssColor(fl.color),
                    sanitizeCssColor(fl.backcolor),
                  ),
                {
                  side: -3,
                  key: `dv-start-${pos}-${fl.att}-${fl.val}`,
                  ignoreSelection: true,
                },
              ),
            );
          }
          if (fl.endFlag?.altText) {
            decorations.push(
              Decoration.widget(
                flagEndPos,
                () =>
                  createDitavalFlagPillDom(
                    fl.endFlag!.altText!,
                    sanitizeCssColor(fl.color),
                    sanitizeCssColor(fl.backcolor),
                  ),
                {
                  side: 3,
                  key: `dv-end-${pos}-${fl.att}-${fl.val}`,
                  ignoreSelection: true,
                },
              ),
            );
          }
        }
      }
    }

    // 0.5 Conref / Conkeyref read-only expansion
    if (tagName && overlay && !SKIP_TAG_DECORATION_NODES.has(typeName)) {
      const conkeyref = getRawAttr(rawAttrs, 'conkeyref')?.trim();
      const conref = getRawAttr(rawAttrs, 'conref')?.trim();
      const conrefend = getRawAttr(rawAttrs, 'conrefend')?.trim() || undefined;
      if (conkeyref || conref) {
        const attrKind: 'conref' | 'conkeyref' = conkeyref ? 'conkeyref' : 'conref';
        const rawVal = (conkeyref ?? conref)!;
        const overlayKey = makeConrefOverlayKey(tagName, attrKind, rawVal, conrefend);
        const resolved = overlay.conrefs[overlayKey];
        if (resolved) {
          const statusClass =
            resolved.status === 'resolved'
              ? 'dita-conref-resolved'
              : resolved.status === 'cycle'
                ? 'dita-conref-cycle'
                : 'dita-conref-error';
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: `dita-conref-host ${statusClass}`,
            }),
          );

          const placeOutside =
            node.isAtom ||
            OUTER_WRAPPED_TAG_NODES.has(typeName) ||
            typeName === 'dita_codeblock' ||
            typeName === 'dita_pre' ||
            typeName === 'cals_table' ||
            typeName === 'dita_simpletable';
          const widgetPos = placeOutside ? pos + node.nodeSize : pos + 1;
          const widgetSide = placeOutside ? -8 : -2;
          const isInline = node.isInline || Boolean(resolved.isInline);

          decorations.push(
            Decoration.widget(
              widgetPos,
              () => createConrefWidgetDom(resolved, isInline, locale, callbacks.onJumpToSource),
              {
                side: widgetSide,
                key: `conref-${pos}-${overlayKey}-${resolved.status}-${resolved.resolvedXml?.length ?? 0}`,
                ignoreSelection: true,
              },
            ),
          );
        }
      }
    }

    // 1. Oxygen-style opening & closing tags + profiling badges (when tagMode !== 'none')
    if (tagMode !== 'none' && tagName && !SKIP_TAG_DECORATION_NODES.has(typeName)) {
      const isSelected = activeNodePos === pos;
      const isUnknown = isUnknownPmNode(node);
      const isOuterWrapped = OUTER_WRAPPED_TAG_NODES.has(typeName);

      if (profilingAttrs.length > 0 && !node.isInline) {
        decorations.push(
          Decoration.node(pos, pos + node.nodeSize, {
            class: 'dita-ox-profiled',
          }),
        );
      }

      const isContainerStrip = !node.isTextblock && !node.isInline && !isOuterWrapped;
      const isInlineTag = node.isInline || node.isTextblock;

      const openPos = isOuterWrapped ? pos : pos + 1;
      const closePos = isOuterWrapped ? pos + node.nodeSize : pos + node.nodeSize - 1;
      const openSide = isOuterWrapped ? -1 : -10;
      const closeSide = isOuterWrapped ? -9 : 10;

      decorations.push(
        Decoration.widget(
          openPos,
          () =>
            createOxygenTagDom(
              'open',
              tagName,
              rawAttrs,
              tagMode,
              pos,
              {
                isInlineTag,
                isContainerStrip,
                isSelected,
                isUnknown,
                onSelect: callbacks.onSelectTagNode,
              },
              locale,
            ),
          {
            side: openSide,
            key: `ox-open-${pos}-${tagName}-${tagMode}-${isSelected}`,
            ignoreSelection: true,
          },
        ),
      );

      if (profilingAttrs.length > 0) {
        decorations.push(
          Decoration.widget(
            closePos,
            () => createProfilingBadgeDom(profilingAttrs),
            {
              side: isOuterWrapped ? -10 : 6,
              key: `ox-prof-${pos}-${profilingAttrs.map((a) => `${a.name}:${a.value}`).join(',')}`,
              ignoreSelection: true,
            },
          ),
        );
      }

      decorations.push(
        Decoration.widget(
          closePos,
          () =>
            createOxygenTagDom(
              'close',
              tagName,
              rawAttrs,
              tagMode,
              pos,
              {
                isInlineTag,
                isContainerStrip,
                isSelected,
                isUnknown,
                onSelect: callbacks.onSelectTagNode,
              },
              locale,
            ),
          {
            side: closeSide,
            key: `ox-close-${pos}-${tagName}-${tagMode}-${isSelected}`,
            ignoreSelection: true,
          },
        ),
      );
    } else if (
      tagMode === 'none' &&
      ditavalMode === 'show-all' &&
      tagName &&
      !SKIP_TAG_DECORATION_NODES.has(typeName) &&
      profilingAttrs.length > 0
    ) {
      // In "全部显示" profiling view with hidden XML tags, still surface compact colored profiling badges
      const isOuterWrapped = OUTER_WRAPPED_TAG_NODES.has(typeName);
      const badgePos = node.isAtom || isOuterWrapped ? pos + node.nodeSize : pos + node.nodeSize - 1;
      decorations.push(
        Decoration.widget(
          badgePos,
          () => createProfilingBadgeDom(profilingAttrs),
          {
            side: isOuterWrapped ? -10 : 6,
            key: `ox-prof-showall-${pos}-${profilingAttrs.map((a) => `${a.name}:${a.value}`).join(',')}`,
            ignoreSelection: true,
          },
        ),
      );
    }

    // 2. Jupyter Notebook-style between-block `+` inserters for legal block containers
    // Read-only documents keep the tag chrome / semantic overlays but lose every editing affordance.
    if (!readOnly && tagName && !node.isInline && !node.isTextblock) {
      const configuredQuick = CONTAINER_QUICK_BLOCK_TAGS[tagName];
      if (configuredQuick && configuredQuick.length > 0) {
        const allLegalBlocks = getAllowedChildElements(tagName, 'block');
        // DITA 1.3 cardinality / choice: a filled single-occurrence slot and a resolved `a | b` choice
        // must not be offered again by the between-block `+` inserters.
        const insertableTags = new Set(
          getInsertableTagsBySequence(
            tagName,
            getPmChildTags(node),
            allLegalBlocks.map((spec) => spec.tag),
          ),
        );
        const insertableBlocks = allLegalBlocks.filter((spec) => insertableTags.has(spec.tag));
        const legalTagSet = new Set(insertableBlocks.map((s) => s.tag));
        const quickTags = configuredQuick.filter((t) => legalTagSet.has(t)).slice(0, 4);
        const hasMore = insertableBlocks.length > quickTags.length;

        if (quickTags.length > 0 || hasMore) {
          const widgetSig = `${quickTags.join(',')}-${hasMore ? 1 : 0}-${locale}`;
          let childOffset = pos + 1;
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            const childEnd = childOffset + child.nodeSize;

            // Optional gap BEFORE the first child (skip before required leading <title> / <cmd>)
            if (
              i === 0 &&
              child.type.name !== 'dita_title' &&
              child.type.name !== 'dita_cmd' &&
              child.type.name !== 'xml_text_block'
            ) {
              const gapPos = childOffset;
              decorations.push(
                Decoration.widget(
                  gapPos,
                  (_view, getPos) =>
                    createBlockGapInserterDom(
                      tagName,
                      depth,
                      // Resolve the live widget offset at click time: the document can grow under
                      // an unmoved widget key, so a captured `gapPos` must never be trusted.
                      () => getPos() ?? gapPos,
                      quickTags,
                      hasMore,
                      callbacks,
                      locale,
                    ),
                  {
                    side: -5,
                    // Include `gapPos`: when text inside a sibling paragraph / <cmd> grows, the
                    // widget key must change so ProseMirror rebuilds the DOM instead of reusing
                    // a stale position closure.
                    key: `gap-before-${pos}-${i}-${gapPos}-${tagName}-${widgetSig}`,
                    ignoreSelection: true,
                  },
                ),
              );
            }

            // Gap AFTER every direct block child (skip inside mixed text-only single child unless block)
            if (child.type.name !== 'xml_text_block' || i === node.childCount - 1) {
              const gapPos = childEnd;
              const isLastChild = i === node.childCount - 1;
              decorations.push(
                Decoration.widget(
                  gapPos,
                  (_view, getPos) =>
                    createBlockGapInserterDom(
                      tagName,
                      depth,
                      // Always insert at the widget's live offset, never at a captured one.
                      () => getPos() ?? gapPos,
                      quickTags,
                      hasMore,
                      callbacks,
                      locale,
                    ),
                  {
                    side: isLastChild ? 2 : -5,
                    // `gapPos` is part of the key so a growing sibling textblock invalidates the
                    // cached widget DOM (and its old insert offset) instead of silently reusing it.
                    key: `gap-after-${pos}-${i}-${gapPos}-${tagName}-${widgetSig}`,
                    ignoreSelection: true,
                  },
                ),
              );
            }

            childOffset = childEnd;
          }
        }
      }
    }

    // Recurse into children
    if (!node.isAtom && node.childCount > 0) {
      const nextAncestorExcluded = ancestorExcluded || nodeExcludedSelf;
      let childPos = pos + 1;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        visit(child, childPos, depth + 1, nextAncestorExcluded);
        childPos += child.nodeSize;
      }
    }
  };

  // Start at top-level children of `doc` (depth 1 = root DITA element)
  let rootPos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    visit(child, rootPos, 1, false);
    rootPos += child.nodeSize;
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * ProseMirror plugin providing:
 * 1. Oxygen XML Author-style chevron opening/closing tags (toggleable: none / tags / full)
 * 2. Jupyter Notebook-style between-block `+` inserter dividers (schema-aware per DITA container)
 * 3. Phase 3 Conref/Conkeyref read-only expansions + DITAVAL live filtering & flagging
 */
