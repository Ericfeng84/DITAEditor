import type * as slimdom from 'slimdom';
import {
  DITA_STRUCTURAL_ELEMENT_CONTAINERS,
  isBlockElementName,
  isInlineElementName,
  isWhitespacePreservingElement,
} from '../model/dita-elements.js';
import type {
  ParsedXmlDocument,
  SerializeXmlOptions,
  XmlDoctypeInfo,
} from './types.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const DOCUMENT_NODE = 9;
const DOCUMENT_TYPE_NODE = 10;

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

function formatDoctype(info: XmlDoctypeInfo): string {
  if (info.raw) {
    return info.raw;
  }
  if (info.publicId) {
    return `<!DOCTYPE ${info.name} PUBLIC "${info.publicId}" "${info.systemId}">`;
  }
  if (info.systemId) {
    return `<!DOCTYPE ${info.name} SYSTEM "${info.systemId}">`;
  }
  return `<!DOCTYPE ${info.name}>`;
}

function serializeAttributes(element: slimdom.Element): string {
  if (!element.attributes || element.attributes.length === 0) {
    return '';
  }
  let out = '';
  for (const attr of element.attributes) {
    out += ` ${attr.name}="${escapeXmlAttr(attr.value)}"`;
  }
  return out;
}

function hasSignificantTextOrCdata(element: slimdom.Element): boolean {
  for (const child of element.childNodes) {
    if (child.nodeType === TEXT_NODE && (child.nodeValue ?? '').trim().length > 0) {
      return true;
    }
    if (child.nodeType === CDATA_SECTION_NODE) {
      return true;
    }
  }
  return false;
}

/**
 * Determine whether an element's children should be formatted with block indentation
 * rather than inline flow.
 */
function hasBlockChildren(element: slimdom.Element): boolean {
  const noSignificantText = !hasSignificantTextOrCdata(element);
  if (noSignificantText && DITA_STRUCTURAL_ELEMENT_CONTAINERS.has(element.tagName)) {
    for (const child of element.childNodes) {
      if (child.nodeType === ELEMENT_NODE) return true;
    }
  }

  for (const child of element.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      const childEl = child as slimdom.Element;
      if (isBlockElementName(childEl.tagName)) {
        return true;
      }
      if (childEl.getAttribute('placement') === 'break') {
        return true;
      }
      // Unknown/specialized element inside an element-only parent (no text siblings) formats as a block child
      if (noSignificantText && !isInlineElementName(childEl.tagName)) {
        return true;
      }
    }
  }
  return false;
}

function hasNonWhitespaceTextOrInline(element: slimdom.Element): boolean {
  const noSignificantText = !hasSignificantTextOrCdata(element);
  if (noSignificantText && DITA_STRUCTURAL_ELEMENT_CONTAINERS.has(element.tagName)) {
    return false;
  }

  for (const child of element.childNodes) {
    if (child.nodeType === TEXT_NODE) {
      if ((child.nodeValue ?? '').trim().length > 0) {
        return true;
      }
    } else if (child.nodeType === CDATA_SECTION_NODE) {
      return true;
    } else if (child.nodeType === ELEMENT_NODE) {
      const childEl = child as slimdom.Element;
      if (isBlockElementName(childEl.tagName) || childEl.getAttribute('placement') === 'break') {
        continue;
      }
      // Unknown non-inline element in an element-only parent is treated as a block child, not inline
      if (noSignificantText && !isInlineElementName(childEl.tagName)) {
        continue;
      }
      return true;
    }
  }
  return false;
}

function isPureFormattingWhitespace(node: slimdom.Node): boolean {
  return node.nodeType === TEXT_NODE && /^\s*$/.test(node.nodeValue ?? '');
}

function serializeInlineNode(node: slimdom.Node, preserveWs: boolean): string {
  switch (node.nodeType) {
    case TEXT_NODE:
      return escapeXmlText(node.nodeValue ?? '');
    case CDATA_SECTION_NODE:
      return `<![CDATA[${node.nodeValue ?? ''}]]>`;
    case COMMENT_NODE:
      return `<!--${node.nodeValue ?? ''}-->`;
    case PROCESSING_INSTRUCTION_NODE: {
      const pi = node as slimdom.ProcessingInstruction;
      return pi.data ? `<?${pi.target} ${pi.data}?>` : `<?${pi.target}?>`;
    }
    case ELEMENT_NODE: {
      const el = node as slimdom.Element;
      const attrs = serializeAttributes(el);
      const childPreserveWs =
        preserveWs || isWhitespacePreservingElement(el.tagName, el.getAttribute('xml:space'));
      if (el.childNodes.length === 0) {
        return `<${el.tagName}${attrs}/>`;
      }
      let inner = '';
      for (const child of el.childNodes) {
        inner += serializeInlineNode(child, childPreserveWs);
      }
      return `<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
    }
    default:
      return '';
  }
}

interface InternalSerializeCtx {
  indent: string;
  eol: string;
}

function serializeElementNode(
  el: slimdom.Element,
  depth: number,
  ctx: InternalSerializeCtx,
  preserveWs: boolean,
): string {
  const pad = ctx.indent.repeat(depth);
  const attrs = serializeAttributes(el);
  const selfPreserveWs =
    preserveWs || isWhitespacePreservingElement(el.tagName, el.getAttribute('xml:space'));

  if (el.childNodes.length === 0) {
    return `${pad}<${el.tagName}${attrs}/>`;
  }

  // Whitespace-preserving elements (<codeblock>, <pre>, etc.) serialize verbatim
  if (selfPreserveWs) {
    let inner = '';
    for (const child of el.childNodes) {
      inner += serializeInlineNode(child, true);
    }
    return `${pad}<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
  }

  const containsBlocks = hasBlockChildren(el);
  const containsInline = hasNonWhitespaceTextOrInline(el);

  // Pure inline / textblock element (e.g., <p>, <title>, <cmd>, <li>text</li>, <entry>val</entry>)
  if (!containsBlocks && containsInline) {
    let inner = '';
    for (const child of el.childNodes) {
      inner += serializeInlineNode(child, false);
    }
    return `${pad}<${el.tagName}${attrs}>${inner}</${el.tagName}>`;
  }

  // Pure block container (may also contain comments/PIs, or only whitespace text nodes)
  if (containsBlocks && !containsInline) {
    const lines: string[] = [`${pad}<${el.tagName}${attrs}>`];
    for (const child of el.childNodes) {
      if (isPureFormattingWhitespace(child)) continue;
      if (child.nodeType === ELEMENT_NODE) {
        lines.push(serializeElementNode(child as slimdom.Element, depth + 1, ctx, false));
      } else if (child.nodeType === COMMENT_NODE) {
        lines.push(`${ctx.indent.repeat(depth + 1)}<!--${child.nodeValue ?? ''}-->`);
      } else if (child.nodeType === PROCESSING_INSTRUCTION_NODE) {
        const pi = child as slimdom.ProcessingInstruction;
        const piStr = pi.data ? `<?${pi.target} ${pi.data}?>` : `<?${pi.target}?>`;
        lines.push(`${ctx.indent.repeat(depth + 1)}${piStr}`);
      } else if (child.nodeType === CDATA_SECTION_NODE) {
        lines.push(`${ctx.indent.repeat(depth + 1)}<![CDATA[${child.nodeValue ?? ''}]]>`);
      }
    }
    lines.push(`${pad}</${el.tagName}>`);
    return lines.join(ctx.eol);
  }

  // Mixed content container (has BOTH inline text/elements AND block children, e.g. <li>Text <ul>...</ul></li>)
  if (containsBlocks && containsInline) {
    const childPad = ctx.indent.repeat(depth + 1);
    const lines: string[] = [`${pad}<${el.tagName}${attrs}>`];
    let inlineBuf = '';

    const flushInline = () => {
      const trimmed = inlineBuf.replace(/^\s+/, '').replace(/\s+$/, '');
      if (trimmed.length > 0) {
        lines.push(`${childPad}${trimmed}`);
      }
      inlineBuf = '';
    };

    for (const child of el.childNodes) {
      if (child.nodeType === ELEMENT_NODE) {
        const childEl = child as slimdom.Element;
        if (isBlockElementName(childEl.tagName) || childEl.getAttribute('placement') === 'break') {
          flushInline();
          lines.push(serializeElementNode(childEl, depth + 1, ctx, false));
          continue;
        }
      }
      if (child.nodeType === COMMENT_NODE || child.nodeType === PROCESSING_INSTRUCTION_NODE) {
        // Keep comments/PIs inline if adjacent to inline buffer, otherwise on their own indented line
        if (inlineBuf.trim().length > 0) {
          inlineBuf += serializeInlineNode(child, false);
        } else {
          inlineBuf = '';
          lines.push(`${childPad}${serializeInlineNode(child, false)}`);
        }
        continue;
      }
      inlineBuf += serializeInlineNode(child, false);
    }
    flushInline();
    lines.push(`${pad}</${el.tagName}>`);
    return lines.join(ctx.eol);
  }

  // Container with only comments/PIs/whitespace (e.g., <prolog><!-- TODO --></prolog> or <p> </p>)
  const hasNonTextChild = Array.from(el.childNodes).some((c) => c.nodeType !== TEXT_NODE);
  if (hasNonTextChild) {
    const childPad = ctx.indent.repeat(depth + 1);
    const lines: string[] = [`${pad}<${el.tagName}${attrs}>`];
    for (const child of el.childNodes) {
      if (isPureFormattingWhitespace(child)) continue;
      lines.push(`${childPad}${serializeInlineNode(child, false)}`);
    }
    lines.push(`${pad}</${el.tagName}>`);
    return lines.join(ctx.eol);
  }

  // Only whitespace text inside a non-preserve element
  let rawText = '';
  for (const child of el.childNodes) {
    rawText += escapeXmlText(child.nodeValue ?? '');
  }
  return `${pad}<${el.tagName}${attrs}>${rawText}</${el.tagName}>`;
}

/**
 * Deterministically serialize a ParsedXmlDocument (or raw slimdom.Document) back into XML string.
 * Preserves XML declaration, DOCTYPE, comments, PIs, CDATA, attribute order, and whitespace-sensitive blocks.
 */
function isParsedXmlDocument(
  input: ParsedXmlDocument | slimdom.Document,
): input is ParsedXmlDocument {
  return 'document' in input && input.document !== undefined;
}

export function serializeXml(
  input: ParsedXmlDocument | slimdom.Document,
  options: SerializeXmlOptions = {},
): string {
  const indent = options.indent ?? '  ';
  const eol = options.lineEnding ?? '\n';
  const includeXmlDeclaration = options.includeXmlDeclaration ?? true;
  const trailingNewline = options.trailingNewline ?? true;

  const isParsed = isParsedXmlDocument(input);
  const doc: slimdom.Document = isParsed ? input.document : input;
  const xmlDeclaration = isParsed ? input.xmlDeclaration : null;
  const doctypeOverride = isParsed ? input.doctype : null;

  const ctx: InternalSerializeCtx = { indent, eol };
  const topLines: string[] = [];

  if (includeXmlDeclaration && xmlDeclaration) {
    topLines.push(xmlDeclaration.raw);
  }

  let doctypeEmitted = false;
  for (const child of doc.childNodes) {
    switch (child.nodeType) {
      case DOCUMENT_TYPE_NODE: {
        const dt = child as slimdom.DocumentType;
        topLines.push(
          formatDoctype(
            doctypeOverride ?? {
              name: dt.name,
              publicId: dt.publicId,
              systemId: dt.systemId,
            },
          ),
        );
        doctypeEmitted = true;
        break;
      }
      case COMMENT_NODE:
        topLines.push(`<!--${child.nodeValue ?? ''}-->`);
        break;
      case PROCESSING_INSTRUCTION_NODE: {
        const pi = child as slimdom.ProcessingInstruction;
        topLines.push(pi.data ? `<?${pi.target} ${pi.data}?>` : `<?${pi.target}?>`);
        break;
      }
      case ELEMENT_NODE:
        if (!doctypeEmitted && doctypeOverride) {
          topLines.push(formatDoctype(doctypeOverride));
          doctypeEmitted = true;
        }
        topLines.push(serializeElementNode(child as slimdom.Element, 0, ctx, false));
        break;
      case DOCUMENT_NODE:
      default:
        break;
    }
  }

  return topLines.join(eol) + (trailingNewline ? eol : '');
}
