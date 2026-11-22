import { parseXml } from '@dita/core';
import { getCurrentLocale, translate } from '../../i18n/index.js';

interface XmlLikeNode {
  readonly nodeType: number;
  readonly nodeValue?: string | null;
}

interface XmlLikeElement extends XmlLikeNode {
  readonly tagName: string;
  readonly childNodes: Iterable<XmlLikeNode>;
  getAttribute(name: string): string | null;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

const CSS_COLOR_REGEX =
  /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{2,24}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/;

/**
 * Sanitize a DITAVAL `color` / `backcolor` string before applying to DOM inline styles.
 */
export function sanitizeCssColor(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return CSS_COLOR_REGEX.test(trimmed) ? trimmed : null;
}

const INLINE_TAG_ELEMENT_MAP: Readonly<Record<string, string>> = {
  b: 'strong',
  i: 'em',
  u: 'u',
  codeph: 'code',
  cmdname: 'code',
  parmname: 'code',
  option: 'code',
  apiname: 'code',
  filepath: 'code',
  varname: 'var',
  userinput: 'kbd',
  systemoutput: 'samp',
  term: 'dfn',
};

const BLOCK_TAG_ELEMENT_MAP: Readonly<Record<string, string>> = {
  p: 'p',
  title: 'h4',
  shortdesc: 'p',
  cmd: 'p',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  dl: 'dl',
  dt: 'dt',
  dd: 'dd',
  note: 'aside',
  codeblock: 'pre',
  pre: 'pre',
  section: 'section',
  info: 'div',
  step: 'div',
  stepxmp: 'div',
  stepresult: 'div',
  simpletable: 'table',
  sthead: 'tr',
  strow: 'tr',
  stentry: 'td',
  table: 'table',
  tgroup: 'table',
  thead: 'thead',
  tbody: 'tbody',
  row: 'tr',
  entry: 'td',
};

function renderDomNode(node: XmlLikeNode): Node | null {
  if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE) {
    return document.createTextNode(node.nodeValue ?? '');
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return null;
  }

  const el = node as XmlLikeElement;
  const tag = el.tagName;
  if (tag === 'colspec') return null;

  const htmlTag = BLOCK_TAG_ELEMENT_MAP[tag] ?? INLINE_TAG_ELEMENT_MAP[tag] ?? 'span';
  const domEl = document.createElement(htmlTag);
  domEl.dataset.conrefTag = tag;
  domEl.className = `dita-cr-el dita-cr-${tag}`;

  if (tag === 'note') {
    const noteType = el.getAttribute('type')?.trim() || 'note';
    domEl.dataset.noteType = noteType;
  }
  if (tag === 'keyword' || tag === 'ph') {
    const keyref = el.getAttribute('keyref')?.trim();
    if (keyref) domEl.dataset.keyref = keyref;
  }

  for (const child of el.childNodes) {
    const childDom = renderDomNode(child);
    if (childDom) domEl.appendChild(childDom);
  }

  return domEl;
}

/**
 * Safely construct a read-only DOM fragment from expanded `conref` / `conkeyref` XML
 * using pure `document.createElement` + `textContent` (never `innerHTML`).
 */
export function renderConrefPreviewDom(resolvedXml: string, isInline = false): HTMLElement {
  const container = document.createElement(isInline ? 'span' : 'div');
  container.className = isInline ? 'dita-cr-inline-body' : 'dita-cr-block-body';

  if (!resolvedXml.trim()) {
    const empty = document.createElement('span');
    empty.className = 'dita-cr-empty';
    empty.textContent = translate(getCurrentLocale(), 'conref.emptyFragment');
    container.appendChild(empty);
    return container;
  }

  try {
    const parsed = parseXml(`<dita-preview>${resolvedXml}</dita-preview>`, { position: false });
    const root = parsed.document.documentElement;
    if (root) {
      for (const child of root.childNodes) {
        const rendered = renderDomNode(child);
        if (rendered) container.appendChild(rendered);
      }
    }
  } catch {
    container.textContent = resolvedXml;
  }

  return container;
}
