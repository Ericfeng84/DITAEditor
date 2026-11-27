/* Oxygen-style chevron tag / profiling badge / DITAVAL flag DOM builders. */

import { type RawAttrs, type UiLocale } from '@dita/core';
import { type TagDisplayMode } from '../../../store/editor-store';
import { translate } from '../../../i18n/index.js';
import { SVG_NS } from './types.js';
export function createChevronCapSvg(direction: 'open' | 'close'): SVGSVGElement {
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

export function formatAttrsForTag(rawAttrs: RawAttrs): string {
  if (rawAttrs.length === 0) return '';
  return rawAttrs
    .map((a) => {
      const val = a.value.length > 36 ? `${a.value.slice(0, 33)}…` : a.value;
      return `${a.name}="${val}"`;
    })
    .join(' ');
}

export function createOxygenTagDom(
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
      attrsSpan.textContent = attrsText;
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

export function createProfilingBadgeDom(profilingAttrs: { name: string; value: string }[]): HTMLElement {
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

export function createDitavalFlagPillDom(text: string, color?: string | null, backcolor?: string | null): HTMLElement {
  const pill = document.createElement('span');
  pill.className = 'dita-ditaval-flag-pill';
  pill.contentEditable = 'false';
  pill.textContent = text;
  if (color) pill.style.color = color;
  if (backcolor) pill.style.backgroundColor = backcolor;
  return pill;
}
