import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import {
  evaluateElementConditions,
  getAllowedChildElements,
  getElementSpec,
  getInsertableTagsBySequence,
  getPmChildTags,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  getRawAttr,
  isUnknownPmNode,
  makeConrefOverlayKey,
  type DitavalDisplayMode,
  type DocumentSemanticOverlay,
  type ParsedDitaval,
  type RawAttrs,
  type ResolvedConrefResult,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';
import { renderConrefPreviewDom, sanitizeCssColor } from './conref-renderer';
import { getElementLabel, type UiLocale } from '@dita/core';
import { getCurrentLocale, translate } from '../../i18n/index.js';

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
  decorations: DecorationSet;
}

export interface DitaDecorationMeta {
  tagMode?: TagDisplayMode;
  locale?: UiLocale;
  activeNodePos?: number | null;
  semantic?: VisualSemanticContext;
}

export const DITA_DECORATIONS_KEY = new PluginKey<DitaDecorationPluginState>('ditaDecorations');

const PROFILING_ATTR_NAMES = new Set([
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
const OUTER_WRAPPED_TAG_NODES = new Set([
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
const SKIP_TAG_DECORATION_NODES = new Set([
  'dita_sthead',
  'dita_strow',
  'cals_tgroup',
  'cals_colspec',
  'cals_thead',
  'cals_tbody',
  'cals_row',
]);

const SVG_NS = 'http://www.w3.org/2000/svg';

function createChevronCapSvg(direction: 'open' | 'close'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `dita-ox-cap dita-ox-cap-${direction}`);
  svg.setAttribute('viewBox', '0 0 7 18');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const fillPoly = document.createElementNS(SVG_NS, 'polygon');
  fillPoly.setAttribute('class', 'dita-ox-cap-fill');
  fillPoly.setAttribute(
    'points',
    direction === 'open' ? '0,0 6.5,9 0,18' : '7,0 0.5,9 7,18',
  );
  svg.appendChild(fillPoly);

  const strokeLine = document.createElementNS(SVG_NS, 'polyline');
  strokeLine.setAttribute('class', 'dita-ox-cap-stroke');
  strokeLine.setAttribute(
    'points',
    direction === 'open' ? '0,0.6 6.3,9 0,17.4' : '7,0.6 0.7,9 7,17.4',
  );
  strokeLine.setAttribute('fill', 'none');
  strokeLine.setAttribute('stroke-width', '1.1');
  strokeLine.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(strokeLine);

  return svg;
}

function formatAttrsForTag(rawAttrs: RawAttrs): string {
  if (rawAttrs.length === 0) return '';
  return rawAttrs
    .map((a) => {
      const val = a.value.length > 36 ? `${a.value.slice(0, 33)}…` : a.value;
      return `${a.name}="${val}"`;
    })
    .join(' ');
}

function createOxygenTagDom(
  direction: 'open' | 'close',
  tagName: string,
  rawAttrs: RawAttrs,
  tagMode: Exclude<TagDisplayMode, 'none'>,
  nodePos: number,
  options: {
    isInlineTag: boolean;
    isContainerStrip: boolean;
    isSelected: boolean;
    isUnknown: boolean;
    onSelect: (pos: number) => void;
  },
  locale: UiLocale,
): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = [
    'dita-ox-tag',
    direction === 'open' ? 'dita-ox-open' : 'dita-ox-close',
    options.isInlineTag ? 'dita-ox-inline' : 'dita-ox-block',
    options.isContainerStrip ? 'dita-ox-strip' : '',
    options.isUnknown ? 'dita-ox-unknown' : '',
  ]
    .filter(Boolean)
    .join(' ');
  wrapper.contentEditable = 'false';
  wrapper.dataset.oxDir = direction;
  wrapper.dataset.oxTag = tagName;
  wrapper.dataset.oxSelected = String(options.isSelected);
  wrapper.title = translate(locale, 'decor.selectElementTitle', { tag: tagName });

  const body = document.createElement('span');
  body.className = 'dita-ox-body';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'dita-ox-name';
  nameSpan.textContent = tagName;
  body.appendChild(nameSpan);

  if (direction === 'open' && tagMode === 'full' && rawAttrs.length > 0) {
    const attrsText = formatAttrsForTag(rawAttrs);
    if (attrsText) {
      const attrsSpan = document.createElement('span');
      attrsSpan.className = 'dita-ox-attrs';
      attrsSpan.textContent = ` ${attrsText}`;
      body.appendChild(attrsSpan);
    }
  }

  if (direction === 'open') {
    wrapper.appendChild(body);
    wrapper.appendChild(createChevronCapSvg('open'));
  } else {
    wrapper.appendChild(createChevronCapSvg('close'));
    wrapper.appendChild(body);
  }

  wrapper.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    options.onSelect(nodePos);
  });

  return wrapper;
}

function createProfilingBadgeDom(profilingAttrs: { name: string; value: string }[]): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'dita-ox-prof-group';
  wrap.contentEditable = 'false';

  for (const attr of profilingAttrs) {
    const chip = document.createElement('span');
    chip.className = 'dita-ox-prof-badge';
    chip.dataset.profAttr = attr.name;
    chip.textContent = `${attr.name} [${attr.value}]`;
    wrap.appendChild(chip);
  }
  return wrap;
}

function createDitavalFlagPillDom(text: string, color?: string | null, backcolor?: string | null): HTMLElement {
  const pill = document.createElement('span');
  pill.className = 'dita-ditaval-flag-pill';
  pill.contentEditable = 'false';
  pill.textContent = text;
  if (color) pill.style.color = color;
  if (backcolor) pill.style.backgroundColor = backcolor;
  return pill;
}

function createConrefWidgetDom(
  resolved: ResolvedConrefResult,
  isInline: boolean,
  locale: UiLocale,
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void,
): HTMLElement {
  if (resolved.status !== 'resolved') {
    const alert = document.createElement(isInline ? 'span' : 'div');
    alert.contentEditable = 'false';
    alert.className =
      resolved.status === 'cycle'
        ? isInline
          ? 'dita-conref-inline-alert dita-conref-alert-cycle'
          : 'dita-conref-alert dita-conref-alert-cycle'
        : isInline
          ? 'dita-conref-inline-alert dita-conref-alert-error'
          : 'dita-conref-alert dita-conref-alert-error';

    const title = document.createElement('span');
    title.className = 'dita-conref-alert-title';
    title.textContent =
      resolved.status === 'cycle'
        ? translate(locale, 'decor.conrefCycle', { attr: resolved.attrName, value: resolved.rawValue })
        : translate(locale, 'decor.conrefError', { attr: resolved.attrName, value: resolved.rawValue });
    alert.appendChild(title);

    const msg = document.createElement('span');
    msg.className = 'dita-conref-alert-msg';
    msg.textContent = resolved.errorMessage ?? translate(locale, 'decor.conrefUnresolved');
    alert.appendChild(msg);

    if (resolved.targetFilePath && onJumpToSource) {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'dita-conref-jump-btn';
      jumpBtn.textContent = translate(locale, 'decor.conrefViewTarget');
      jumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      jumpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSource(resolved.targetFilePath!, resolved.targetLine, resolved.targetElementId);
      });
      alert.appendChild(jumpBtn);
    }
    return alert;
  }

  if (isInline) {
    const pill = document.createElement('span');
    pill.contentEditable = 'false';
    pill.className = 'dita-conref-preview-inline';
    pill.title = `${resolved.attrName}="${resolved.rawValue}"\n${translate(locale, 'decor.conrefSource')}: ${resolved.targetFilePath}:${resolved.targetLine}`;

    const badge = document.createElement('span');
    badge.className = 'dita-conref-inline-badge';
    badge.textContent = translate(locale, 'decor.conrefBadge');
    pill.appendChild(badge);

    pill.appendChild(renderConrefPreviewDom(resolved.resolvedXml ?? '', true));

    if (resolved.targetFilePath && onJumpToSource) {
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.className = 'dita-conref-inline-jump';
      jump.textContent = '↗';
      jump.title = translate(locale, 'decor.conrefJumpTitle', { path: resolved.targetFilePath, line: String(resolved.targetLine ?? 1) });
      jump.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      jump.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSource(resolved.targetFilePath!, resolved.targetLine, resolved.targetElementId);
      });
      pill.appendChild(jump);
    }
    return pill;
  }

  const card = document.createElement('div');
  card.contentEditable = 'false';
  card.className = 'dita-conref-preview-block';

  const header = document.createElement('div');
  header.className = 'dita-conref-preview-header';

  const pillTag = document.createElement('span');
  pillTag.className = 'dita-conref-tag';
  pillTag.textContent = `${resolved.attrName}="${resolved.rawValue}"`;
  header.appendChild(pillTag);

  const readonlyChip = document.createElement('span');
  readonlyChip.className = 'dita-conref-ro-chip';
  readonlyChip.textContent = translate(locale, 'decor.conrefReadonly');
  header.appendChild(readonlyChip);

  if (resolved.targetFilePath) {
    const srcLabel = document.createElement('span');
    srcLabel.className = 'dita-conref-source-path';
    srcLabel.textContent = `${resolved.targetFilePath}:${resolved.targetLine ?? 1}`;
    header.appendChild(srcLabel);

    if (onJumpToSource) {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'dita-conref-jump-btn';
      jumpBtn.textContent = translate(locale, 'decor.conrefJump');
      jumpBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      jumpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSource(resolved.targetFilePath!, resolved.targetLine, resolved.targetElementId);
      });
      header.appendChild(jumpBtn);
    }
  }

  card.appendChild(header);
  card.appendChild(renderConrefPreviewDom(resolved.resolvedXml ?? '', false));
  return card;
}

/**
 * Create a Jupyter Notebook-style between-block `+` inserter divider DOM node.
 * Fixed compact track height guarantees zero layout shift on hover/focus.
 */
function createBlockGapInserterDom(
  containerTag: string,
  containerDepth: number,
  insertPos: number,
  quickTags: readonly string[],
  hasMoreLegalElements: boolean,
  callbacks: DitaDecorationsCallbacks,
  locale: UiLocale,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'dita-block-inserter';
  row.contentEditable = 'false';
  row.dataset.containerTag = containerTag;
  row.dataset.insertPos = String(insertPos);

  const line = document.createElement('div');
  line.className = 'dita-bi-line';
  line.setAttribute('aria-hidden', 'true');
  row.appendChild(line);

  const bar = document.createElement('div');
  bar.className = 'dita-bi-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', translate(locale, 'decor.insertBlockAria', { tag: containerTag }));

  // Primary `+` button opens full context-aware DITA insert menu for this container
  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'dita-bi-plus';
  plusBtn.textContent = '+';
  plusBtn.title = translate(locale, 'decor.insertBlockHint', { tag: containerTag });
  plusBtn.setAttribute('aria-label', translate(locale, 'decor.insertElementAria', { tag: containerTag }));
  plusBtn.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
  });
  plusBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    callbacks.onOpenGapInsertMenu({
      containerTag,
      containerDepth,
      insertPos,
      anchorEl: plusBtn,
    });
  });
  bar.appendChild(plusBtn);

  // Quick-insert chips (Jupyter "+ Code / + Markdown" adapted for DITA 1.3!)
  const quickList = document.createElement('div');
  quickList.className = 'dita-bi-chips';

  for (const tag of quickTags) {
    const spec = getElementSpec(tag);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'dita-bi-chip';
    chip.title = spec
      ? translate(locale, 'decor.insertQuickTagLabeled', { tag, label: getElementLabel(spec, locale) })
      : translate(locale, 'decor.insertQuickTag', { tag });

    const plusMark = document.createElement('span');
    plusMark.className = 'dita-bi-chip-plus';
    plusMark.textContent = '+';
    chip.appendChild(plusMark);

    const text = document.createElement('span');
    text.textContent = spec ? getElementLabel(spec, locale) : tag;
    chip.appendChild(text);

    const tagCode = document.createElement('code');
    tagCode.className = 'dita-bi-chip-tag';
    tagCode.textContent = `<${tag}>`;
    chip.appendChild(tagCode);

    chip.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    chip.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      callbacks.onQuickInsertBlock(tag, insertPos);
    });
    quickList.appendChild(chip);
  }

  if (hasMoreLegalElements) {
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'dita-bi-chip dita-bi-chip-more';
    moreBtn.textContent = translate(locale, 'decor.more');
    moreBtn.title = translate(locale, 'decor.moreTitle', { tag: containerTag });
    moreBtn.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    moreBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      callbacks.onOpenGapInsertMenu({
        containerTag,
        containerDepth,
        insertPos,
        anchorEl: moreBtn,
      });
    });
    quickList.appendChild(moreBtn);
  }

  bar.appendChild(quickList);
  row.appendChild(bar);

  return row;
}

/**
 * Pure helper to compute all Oxygen tag decorations + Jupyter between-block `+` inserters for a document.
 * Exported so it can be thoroughly verified in Vitest without needing a full browser.
 */
export function collectDitaDecorations(
  doc: PMNode,
  tagMode: TagDisplayMode,
  activeNodePos: number | null,
  callbacks: DitaDecorationsCallbacks,
  selectionPos: number | null = null,
  semantic?: VisualSemanticContext,
  locale: UiLocale = getCurrentLocale(),
): DecorationSet {
  const decorations: Decoration[] = [];

  // Deepest block containing the selection whose parent hosts `+` gap inserters.
  // It gets `dita-gap-active` so the gaps directly above/below it stay visible.
  if (selectionPos !== null && selectionPos >= 0 && selectionPos <= doc.content.size) {
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
    if (tagName && !node.isInline && !node.isTextblock) {
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
                  () =>
                    createBlockGapInserterDom(
                      tagName,
                      depth,
                      gapPos,
                      quickTags,
                      hasMore,
                      callbacks,
                      locale,
                    ),
                  {
                    side: -5,
                    key: `gap-before-${pos}-${i}-${tagName}-${widgetSig}`,
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
                  () =>
                    createBlockGapInserterDom(
                      tagName,
                      depth,
                      gapPos,
                      quickTags,
                      hasMore,
                      callbacks,
                      locale,
                    ),
                  {
                    side: isLastChild ? 2 : -5,
                    key: `gap-after-${pos}-${i}-${tagName}-${widgetSig}`,
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
export function createDitaDecorationsPlugin(
  initialTagMode: TagDisplayMode,
  callbacks: DitaDecorationsCallbacks,
  initialSemantic?: VisualSemanticContext,
  initialLocale: UiLocale = getCurrentLocale(),
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
          decorations: collectDitaDecorations(
            state.doc,
            initialTagMode,
            null,
            callbacks,
            state.selection.from,
            initialSemantic,
            initialLocale,
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

        if (
          !tr.docChanged &&
          !tr.selectionSet &&
          nextTagMode === prev.tagMode &&
          nextActivePos === prev.activeNodePos &&
          nextSemantic === prev.semantic &&
          nextLocale === prev.locale
        ) {
          return prev;
        }

        return {
          tagMode: nextTagMode,
          locale: nextLocale,
          activeNodePos: nextActivePos,
          semantic: nextSemantic,
          decorations: collectDitaDecorations(
            newState.doc,
            nextTagMode,
            nextActivePos,
            callbacks,
            newState.selection.from,
            nextSemantic,
            nextLocale,
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
