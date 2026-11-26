/* Between-block `+` gap inserter widget DOM builder. */

import { getElementSpec, getElementLabel, type UiLocale } from '@dita/core';
import { translate } from '../../../i18n/index.js';
import { DitaDecorationsCallbacks } from './types.js';
export function createBlockGapInserterDom(
  containerTag: string,
  containerDepth: number,
  /** Initial gap offset, or a live resolver (widget `getPos`) re-read at click time. */
  getInsertPos: number | (() => number),
  quickTags: readonly string[],
  hasMoreLegalElements: boolean,
  callbacks: DitaDecorationsCallbacks,
  locale: UiLocale,
): HTMLElement {
  const resolveInsertPos = (): number =>
    typeof getInsertPos === 'function' ? getInsertPos() : getInsertPos;
  const row = document.createElement('div');
  row.className = 'dita-block-inserter';
  row.contentEditable = 'false';
  row.dataset.containerTag = containerTag;
  row.dataset.insertPos = String(resolveInsertPos());

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
      insertPos: resolveInsertPos(),
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
      callbacks.onQuickInsertBlock(tag, resolveInsertPos());
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
        insertPos: resolveInsertPos(),
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
