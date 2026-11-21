import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import {
  getAllowedChildElements,
  getElementSpec,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  isUnknownPmNode,
  type RawAttrs,
} from '@dita/core';
import type { TagDisplayMode } from '../../store/editor-store';

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
}

export interface DitaDecorationPluginState {
  tagMode: TagDisplayMode;
  activeNodePos: number | null;
  decorations: DecorationSet;
}

export interface DitaDecorationMeta {
  tagMode?: TagDisplayMode;
  activeNodePos?: number | null;
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
  wrapper.title = `点击选中 <${tagName}> 并编辑属性`;

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
    chip.textContent = `${attr.name} [${attr.value}]`;
    wrap.appendChild(chip);
  }
  return wrap;
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
  bar.setAttribute('aria-label', `在 <${containerTag}> 中插入块`);

  // Primary `+` button opens full context-aware DITA insert menu for this container
  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'dita-bi-plus';
  plusBtn.textContent = '+';
  plusBtn.title = `在此处插入合法的 <${containerTag}> 子块`;
  plusBtn.setAttribute('aria-label', `在 <${containerTag}> 此处插入元素`);
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
    chip.title = spec ? `插入 <${tag}> (${spec.labelZh})` : `插入 <${tag}>`;

    const plusMark = document.createElement('span');
    plusMark.className = 'dita-bi-chip-plus';
    plusMark.textContent = '+';
    chip.appendChild(plusMark);

    const text = document.createElement('span');
    text.textContent = spec ? spec.labelZh : tag;
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
    moreBtn.textContent = '更多…';
    moreBtn.title = `查看 <${containerTag}> 允许的全部 DITA 1.3 元素`;
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

  const visit = (node: PMNode, pos: number, depth: number) => {
    const typeName = node.type.name;
    const tagName = getPmNodeTagName(node);

    // 1. Oxygen-style opening & closing tags + profiling badges (when tagMode !== 'none')
    if (tagMode !== 'none' && tagName && !SKIP_TAG_DECORATION_NODES.has(typeName)) {
      const rawAttrs = getPmNodeRawAttrs(node);
      const isSelected = activeNodePos === pos;
      const isUnknown = isUnknownPmNode(node);
      const isOuterWrapped = OUTER_WRAPPED_TAG_NODES.has(typeName);

      const profilingAttrs = rawAttrs.filter((a) => PROFILING_ATTR_NAMES.has(a.name));
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
            createOxygenTagDom('open', tagName, rawAttrs, tagMode, pos, {
              isInlineTag,
              isContainerStrip,
              isSelected,
              isUnknown,
              onSelect: callbacks.onSelectTagNode,
            }),
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
            createOxygenTagDom('close', tagName, rawAttrs, tagMode, pos, {
              isInlineTag,
              isContainerStrip,
              isSelected,
              isUnknown,
              onSelect: callbacks.onSelectTagNode,
            }),
          {
            side: closeSide,
            key: `ox-close-${pos}-${tagName}-${tagMode}-${isSelected}`,
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
        const legalTagSet = new Set(allLegalBlocks.map((s) => s.tag));
        const quickTags = configuredQuick.filter((t) => legalTagSet.has(t)).slice(0, 4);
        const hasMore = allLegalBlocks.length > quickTags.length;

        if (quickTags.length > 0) {
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
                    ),
                  {
                    side: -5,
                    key: `gap-before-${pos}-${i}-${tagName}`,
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
                    ),
                  {
                    side: isLastChild ? 2 : -5,
                    key: `gap-after-${pos}-${i}-${tagName}`,
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
      let childPos = pos + 1;
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        visit(child, childPos, depth + 1);
        childPos += child.nodeSize;
      }
    }
  };

  // Start at top-level children of `doc` (depth 1 = root DITA element)
  let rootPos = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    visit(child, rootPos, 1);
    rootPos += child.nodeSize;
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * ProseMirror plugin providing:
 * 1. Oxygen XML Author-style chevron opening/closing tags (toggleable: none / tags / full)
 * 2. Jupyter Notebook-style between-block `+` inserter dividers (schema-aware per DITA container)
 */
export function createDitaDecorationsPlugin(
  initialTagMode: TagDisplayMode,
  callbacks: DitaDecorationsCallbacks,
): Plugin<DitaDecorationPluginState> {
  return new Plugin<DitaDecorationPluginState>({
    key: DITA_DECORATIONS_KEY,
    state: {
      init(_, state) {
        return {
          tagMode: initialTagMode,
          activeNodePos: null,
          decorations: collectDitaDecorations(
            state.doc,
            initialTagMode,
            null,
            callbacks,
            state.selection.from,
          ),
        };
      },
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(DITA_DECORATIONS_KEY) as DitaDecorationMeta | undefined;
        const nextTagMode = meta?.tagMode ?? prev.tagMode;
        const nextActivePos =
          meta && 'activeNodePos' in meta ? (meta.activeNodePos ?? null) : prev.activeNodePos;

        if (
          !tr.docChanged &&
          !tr.selectionSet &&
          nextTagMode === prev.tagMode &&
          nextActivePos === prev.activeNodePos
        ) {
          return prev;
        }

        return {
          tagMode: nextTagMode,
          activeNodePos: nextActivePos,
          decorations: collectDitaDecorations(
            newState.doc,
            nextTagMode,
            nextActivePos,
            callbacks,
            newState.selection.from,
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
