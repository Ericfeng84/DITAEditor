/**
 * Read-only rendering of one DITA inline fragment.
 *
 * The old review column printed the block's plain text *and* its raw XML, which made the reviewer
 * read everything twice. This renderer prints the fragment exactly once, with DITA semantics:
 * `<uicontrol>` looks like a button label, `<codeph>` like code, `<xref>` like a link, and a
 * `<keyword keyref="prod_name"/>` becomes a compact key chip (its full XML lives in the tooltip)
 * instead of raw tag noise.
 */
import { Fragment, type ElementType, type ReactNode } from 'react';
import type { TranslationGlossaryHitView } from '../../services/translation-api.js';
import {
  attributeValue,
  elementName,
  fragmentToPlainText,
  nodeValue,
  parseInnerFragment,
  serializeNode,
  type DomNodeLike,
} from './segment-xml-utils.js';

const TEXT_NODE = 3;
const CDATA_NODE = 4;
const ELEMENT_NODE = 1;
const COMMENT_NODE = 8;
const PROCESSING_INSTRUCTION_NODE = 7;

/** DITA inline elements that map 1:1 to a semantic HTML tag. */
const SEMANTIC_TAGS: Record<string, { tag: string; className?: string }> = {
  b: { tag: 'b' },
  i: { tag: 'i' },
  u: { tag: 'u' },
  sup: { tag: 'sup' },
  sub: { tag: 'sub' },
  tt: { tag: 'code', className: 'review-inline-code' },
  codeph: { tag: 'code', className: 'review-inline-code' },
  cmdname: { tag: 'code', className: 'review-inline-code' },
  parmname: { tag: 'code', className: 'review-inline-code' },
  option: { tag: 'code', className: 'review-inline-code' },
  apiname: { tag: 'code', className: 'review-inline-code' },
  msgnum: { tag: 'code', className: 'review-inline-code' },
  filepath: { tag: 'code', className: 'review-inline-code review-inline-code--path' },
  varname: { tag: 'var', className: 'review-inline-var' },
  userinput: { tag: 'kbd', className: 'review-inline-kbd' },
  systemoutput: { tag: 'samp', className: 'review-inline-samp' },
  term: { tag: 'dfn', className: 'review-inline-term' },
  wintitle: { tag: 'span', className: 'review-inline-wintitle' },
  uicontrol: { tag: 'span', className: 'review-inline-uicontrol' },
  menucascade: { tag: 'span', className: 'review-inline-menucascade' },
  cite: { tag: 'cite' },
  fn: { tag: 'span', className: 'review-inline-fn' },
  ph: { tag: 'span' },
  draft: { tag: 'span' },
};

export interface DitaInlineRendererProps {
  /** Inner XML of the block (`<p>` excluded) or a bare attribute text payload. */
  innerXml: string;
  /** Render compact `‹tag›` badges inside the text (review aid, off by default). */
  showTags?: boolean;
  /** Glossary hits of this segment; matched source text is highlighted. */
  glossaryHits?: TranslationGlossaryHitView[];
  className?: string;
  /** Shown when the fragment has no visible text. */
  emptyFallback?: string;
  testId?: string;
}

function tagBadge(label: string, key: string, tone: 'open' | 'close' | 'self' = 'open'): ReactNode {
  return (
    <span className={`review-inline-tag review-inline-tag--${tone}`} key={key} aria-hidden="true">
      {label}
    </span>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight glossary matches inside one text node, longest term first. */
function renderText(
  text: string,
  hits: TranslationGlossaryHitView[] | undefined,
  keyPrefix: string,
): ReactNode {
  const candidates = new Map<string, TranslationGlossaryHitView>();
  for (const hit of hits ?? []) {
    for (const needle of [hit.matchedText, hit.sourceTerm]) {
      if (needle && !candidates.has(needle)) candidates.set(needle, hit);
    }
  }
  if (candidates.size === 0 || !text) return text;
  const needles = [...candidates.keys()].sort((left, right) => right.length - left.length);
  const pattern = new RegExp(`(${needles.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return (
    <Fragment key={`${keyPrefix}-text`}>
      {parts.map((part, index) => {
        if (!part) return null;
        const hit = [...candidates.entries()].find(
          ([needle]) => needle.toLowerCase() === part.toLowerCase(),
        )?.[1];
        if (!hit) return <Fragment key={`${keyPrefix}-t${index}`}>{part}</Fragment>;
        return (
          <mark
            key={`${keyPrefix}-m${index}`}
            className="review-glossary-mark"
            title={`${hit.sourceTerm} → ${hit.targetTerm}`}
          >
            {part}
          </mark>
        );
      })}
    </Fragment>
  );
}

function renderChildren(
  node: DomNodeLike,
  context: { showTags: boolean; hits?: TranslationGlossaryHitView[]; key: string },
): ReactNode[] {
  const children: ReactNode[] = [];
  const raw = Array.from(node.childNodes ?? []);
  raw.forEach((child, index) => {
    children.push(renderNode(child, `${context.key}.${index}`, context));
  });
  return children;
}

function renderElement(
  node: DomNodeLike,
  key: string,
  context: { showTags: boolean; hits?: TranslationGlossaryHitView[] },
): ReactNode {
  const tag = elementName(node);
  const showTags = context.showTags;
  const children = renderChildren(node, { ...context, key });
  const hasChildren = Array.from(node.childNodes ?? []).length > 0;
  const xml = serializeNode(node);
  const open = showTags ? tagBadge(`<${tag}>`, `${key}-open`) : null;
  const close = showTags && hasChildren ? tagBadge(`</${tag}>`, `${key}-close`, 'close') : null;
  const withBadges = (element: ReactNode): ReactNode => (
    <Fragment key={key}>
      {open}
      {element}
      {close}
    </Fragment>
  );

  if (tag === 'keyword') {
    const keyref = attributeValue(node, 'keyref');
    // A keyref-only `<keyword/>` never prints its own tag: the chip shows the key name instead.
    return withBadges(
      <span className="dita-nv-keyword" data-dita-tag="keyword" title={xml}>
        {keyref ? <span className="dita-nv-ref-badge">{keyref}</span> : null}
        {children}
      </span>,
    );
  }

  if (tag === 'xref' || tag === 'link') {
    const href = attributeValue(node, 'href');
    const keyref = attributeValue(node, 'keyref');
    const target = keyref ?? href;
    const label = children.length > 0 ? children : (target ?? '');
    return withBadges(
      <a
        className="dita-nv-xref"
        data-dita-tag={tag}
        title={xml}
        href={href ?? undefined}
        onClick={(event) => event.preventDefault()}
      >
        {label}
        {keyref ? <span className="dita-nv-ref-badge">{keyref}</span> : null}
      </a>,
    );
  }

  const semantic = SEMANTIC_TAGS[tag];
  if (semantic) {
    const Element = semantic.tag as ElementType;
    return withBadges(
      <Element
        className={semantic.className}
        data-dita-tag={tag}
        title={tag === 'fn' ? xml : undefined}
      >
        {children}
      </Element>,
    );
  }

  // Unknown / specialized inline element: keep it visible, keep its XML reachable in the tooltip.
  return withBadges(
    <span className="review-inline-unknown" data-dita-tag={tag} title={xml}>
      {children}
    </span>,
  );
}

function renderNode(
  node: DomNodeLike,
  key: string,
  context: { showTags: boolean; hits?: TranslationGlossaryHitView[] },
): ReactNode {
  switch (node.nodeType) {
    case TEXT_NODE:
    case CDATA_NODE:
      return renderText(nodeValue(node), context.hits, key);
    case COMMENT_NODE:
      return context.showTags ? tagBadge('<!-- -->', key, 'self') : null;
    case PROCESSING_INSTRUCTION_NODE:
      return context.showTags ? tagBadge(`<?${node.nodeName}?>`, key, 'self') : null;
    case ELEMENT_NODE:
      return renderElement(node, key, context);
    default:
      return null;
  }
}

export function DitaInlineRenderer({
  innerXml,
  showTags = false,
  glossaryHits,
  className,
  emptyFallback = '—',
  testId,
}: DitaInlineRendererProps) {
  const nodes = parseInnerFragment(innerXml);
  const classes = ['review-inline-host', className].filter(Boolean).join(' ');
  if (!nodes) {
    // Malformed fragment: show its readable text, never its raw XML (the raw editor owns that).
    return (
      <span className={classes} data-testid={testId} data-malformed="true">
        {fragmentToPlainText(innerXml)}
      </span>
    );
  }
  const hasContent = nodes.some((node) => {
    if (node.nodeType === ELEMENT_NODE) return true;
    if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_NODE) {
      return nodeValue(node).trim().length > 0;
    }
    return false;
  });
  if (!hasContent) {
    return (
      <span className={classes} data-testid={testId} data-empty="true">
        {emptyFallback}
      </span>
    );
  }
  return (
    <span className={classes} data-testid={testId}>
      {nodes.map((node, index) => renderNode(node, `n${index}`, { showTags, hits: glossaryHits }))}
    </span>
  );
}
