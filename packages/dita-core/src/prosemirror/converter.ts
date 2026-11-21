import { Fragment, Node as PMNode } from 'prosemirror-model';
import * as slimdom from 'slimdom';
import {
  extractElementAttrs,
  parseCalsColSpecs,
  resolveCalsEntrySpan,
  type CalsColSpec,
} from '../cals/cals-table.js';
import {
  DITA_STRUCTURAL_ELEMENT_CONTAINERS,
  isBlockElementName,
  isWhitespacePreservingElement,
  MODELED_INLINE_TAGS,
  PM_NODE_TO_DITA_TAG,
} from '../model/dita-elements.js';
import { parseXml, type ParseXmlOptions } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import type {
  ParsedXmlDocument,
  SerializeXmlOptions,
  XmlAttributeEntry,
  XmlDeclaration,
  XmlDoctypeInfo,
  XmlPrologItem,
} from '../xml/types.js';
import { ditaSchema, type RawAttrs } from './schema.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const DOCUMENT_TYPE_NODE = 10;

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

/**
 * Block-level DITA tag name -> ProseMirror node type name (container nodes).
 */
const MODELED_BLOCK_CONTAINERS: ReadonlyMap<string, string> = new Map([
  ['topic', 'dita_topic'],
  ['concept', 'dita_concept'],
  ['task', 'dita_task'],
  ['reference', 'dita_reference'],
  ['prolog', 'dita_prolog'],
  ['body', 'dita_body'],
  ['conbody', 'dita_conbody'],
  ['taskbody', 'dita_taskbody'],
  ['refbody', 'dita_refbody'],
  ['section', 'dita_section'],
  ['example', 'dita_example'],
  ['refsyn', 'dita_refsyn'],
  ['prereq', 'dita_prereq'],
  ['context', 'dita_context'],
  ['steps', 'dita_steps'],
  ['steps-unordered', 'dita_steps_unordered'],
  ['step', 'dita_step'],
  ['info', 'dita_info'],
  ['stepxmp', 'dita_stepxmp'],
  ['stepresult', 'dita_stepresult'],
  ['substeps', 'dita_substeps'],
  ['substep', 'dita_substep'],
  ['choices', 'dita_choices'],
  ['choice', 'dita_choice'],
  ['result', 'dita_result'],
  ['postreq', 'dita_postreq'],
  ['related-links', 'dita_related_links'],
  ['link', 'dita_link'],
  ['note', 'dita_note'],
  ['ul', 'dita_ul'],
  ['ol', 'dita_ol'],
  ['li', 'dita_li'],
  ['dl', 'dita_dl'],
  ['dlentry', 'dita_dlentry'],
  ['dd', 'dita_dd'],
  ['fig', 'dita_fig'],
  ['simpletable', 'dita_simpletable'],
  ['sthead', 'dita_sthead'],
  ['strow', 'dita_strow'],
  ['stentry', 'dita_stentry'],
  ['table', 'cals_table'],
  ['thead', 'cals_thead'],
  ['tbody', 'cals_tbody'],
  ['row', 'cals_row'],
]);

/**
 * Pure textblock DITA elements (fall back to block container / unknown_block if they contain block children).
 */
const MODELED_TEXTBLOCKS: ReadonlyMap<string, string> = new Map([
  ['title', 'dita_title'],
  ['shortdesc', 'dita_shortdesc'],
  ['cmd', 'dita_cmd'],
  ['p', 'dita_p'],
  ['dt', 'dita_dt'],
  ['desc', 'dita_desc'],
  ['codeblock', 'dita_codeblock'],
  ['pre', 'dita_pre'],
]);

function isBlockChildElement(el: slimdom.Element): boolean {
  if (el.tagName === 'image') {
    return el.getAttribute('placement') === 'break';
  }
  return isBlockElementName(el.tagName);
}

function elementContainsBlockChild(el: slimdom.Element): boolean {
  for (const child of el.childNodes) {
    if (child.nodeType === ELEMENT_NODE && isBlockChildElement(child as slimdom.Element)) {
      return true;
    }
  }
  return false;
}

function isPureWhitespaceText(node: slimdom.Node): boolean {
  return node.nodeType === TEXT_NODE && /^\s*$/.test(node.nodeValue ?? '');
}

interface DomToPmContext {
  activeColspecs: CalsColSpec[];
}

function convertInlineChildren(el: slimdom.Element, ctx: DomToPmContext): PMNode[] {
  const result: PMNode[] = [];
  for (const child of el.childNodes) {
    result.push(...convertInlineNode(child, ctx));
  }
  return result;
}

function convertInlineNode(node: slimdom.Node, ctx: DomToPmContext): PMNode[] {
  switch (node.nodeType) {
    case TEXT_NODE: {
      const value = node.nodeValue ?? '';
      return value.length > 0 ? [ditaSchema.text(value)] : [];
    }
    case CDATA_SECTION_NODE:
      return [
        ditaSchema.nodes.xml_cdata_inline!.create({
          data: node.nodeValue ?? '',
        }),
      ];
    case COMMENT_NODE:
      return [
        ditaSchema.nodes.xml_comment_inline!.create({
          data: node.nodeValue ?? '',
        }),
      ];
    case PROCESSING_INSTRUCTION_NODE: {
      const pi = node as slimdom.ProcessingInstruction;
      return [
        ditaSchema.nodes.xml_pi_inline!.create({
          target: pi.target,
          data: pi.data,
        }),
      ];
    }
    case ELEMENT_NODE: {
      const el = node as slimdom.Element;
      const rawAttrs = extractElementAttrs(el);
      const namespaceURI = el.namespaceURI;
      const hasBlocks = elementContainsBlockChild(el);

      if (el.tagName === 'image') {
        return [
          ditaSchema.nodes.dita_image_inline!.create(
            { rawAttrs, namespaceURI },
            convertInlineChildren(el, ctx),
          ),
        ];
      }

      if (el.tagName === 'fn' && hasBlocks) {
        return [
          ditaSchema.nodes.dita_fn_block!.create(
            { rawAttrs, namespaceURI },
            convertBlockContainerChildren(el, ctx),
          ),
        ];
      }

      if (!hasBlocks) {
        const modeledInline = MODELED_INLINE_TAGS.get(el.tagName);
        if (modeledInline) {
          const nodeType = ditaSchema.nodes[modeledInline]!;
          return [nodeType.create({ rawAttrs, namespaceURI }, convertInlineChildren(el, ctx))];
        }
        return [
          ditaSchema.nodes.unknown_inline!.create(
            {
              tagName: el.tagName,
              rawAttrs,
              namespaceURI,
            },
            convertInlineChildren(el, ctx),
          ),
        ];
      }

      // Unknown inline tag containing block children
      return [
        ditaSchema.nodes.unknown_inline_block!.create(
          {
            tagName: el.tagName,
            rawAttrs,
            namespaceURI,
          },
          convertBlockContainerChildren(el, ctx),
        ),
      ];
    }
    default:
      return [];
  }
}

/**
 * Trim boundary indentation whitespace from an inline run sitting inside a mixed-content
 * block container (e.g. indentation newlines immediately before/after a sibling block element).
 */
function normalizeMixedInlineRun(nodes: PMNode[], hasBlockSiblings: boolean): PMNode[] {
  if (!hasBlockSiblings || nodes.length === 0) {
    return nodes;
  }

  const out = [...nodes];

  // Trim leading whitespace if first node is a text node
  const first = out[0];
  if (first && first.isText && first.text !== undefined) {
    const trimmed = first.text.replace(/^\s+/, '');
    if (trimmed.length === 0) {
      out.shift();
    } else if (trimmed !== first.text) {
      out[0] = ditaSchema.text(trimmed);
    }
  }

  // Trim trailing whitespace if last node is a text node
  const lastIdx = out.length - 1;
  const last = lastIdx >= 0 ? out[lastIdx] : undefined;
  if (last && last.isText && last.text !== undefined) {
    const trimmed = last.text.replace(/\s+$/, '');
    if (trimmed.length === 0) {
      out.pop();
    } else if (trimmed !== last.text) {
      out[lastIdx] = ditaSchema.text(trimmed);
    }
  }

  return out;
}

function convertBlockContainerChildren(el: slimdom.Element, ctx: DomToPmContext): PMNode[] {
  const result: PMNode[] = [];
  const isStructuralOnly = DITA_STRUCTURAL_ELEMENT_CONTAINERS.has(el.tagName);
  const hasBlocks = isStructuralOnly || elementContainsBlockChild(el);
  let inlineBuffer: PMNode[] = [];

  const flushInlineBuffer = () => {
    const normalized = normalizeMixedInlineRun(inlineBuffer, hasBlocks);
    inlineBuffer = [];
    if (normalized.length === 0) return;

    // If the entire buffer is whitespace-only text inside a block container, drop formatting whitespace
    const isAllWhitespace = normalized.every(
      (n) => n.isText && /^\s*$/.test(n.text ?? ''),
    );
    if (isAllWhitespace && hasBlocks) {
      return;
    }

    result.push(ditaSchema.nodes.xml_text_block!.create(null, normalized));
  };

  for (const child of el.childNodes) {
    if (child.nodeType === ELEMENT_NODE) {
      const childEl = child as slimdom.Element;
      const childIsBlock =
        isBlockChildElement(childEl) ||
        (!MODELED_INLINE_TAGS.has(childEl.tagName) &&
          childEl.tagName !== 'image' &&
          elementContainsBlockChild(childEl)) ||
        // Unknown element inside a pure-block parent (like <prolog>, <body>, <hazardstatement>)
        // when there is no adjacent inline text becomes unknown_block
        (!MODELED_INLINE_TAGS.has(childEl.tagName) &&
          childEl.tagName !== 'image' &&
          !isInlinePreferredParent(el.tagName) &&
          inlineBuffer.every((n) => n.isText && /^\s*$/.test(n.text ?? '')));

      if (childIsBlock) {
        flushInlineBuffer();
        result.push(convertBlockElement(childEl, ctx));
        continue;
      }

      if (isStructuralOnly) {
        // Drop inter-element indentation whitespace inside structural containers like <keywords> / <groupseq>
        if (inlineBuffer.length > 0 && inlineBuffer[inlineBuffer.length - 1]!.isText && /^\s*$/.test(inlineBuffer[inlineBuffer.length - 1]!.text ?? '')) {
          inlineBuffer.pop();
        }
      }
      inlineBuffer.push(...convertInlineNode(childEl, ctx));
      continue;
    }

    if (child.nodeType === COMMENT_NODE) {
      if (inlineBuffer.some((n) => !n.isText || (n.text ?? '').trim().length > 0)) {
        inlineBuffer.push(
          ditaSchema.nodes.xml_comment_inline!.create({ data: child.nodeValue ?? '' }),
        );
      } else {
        inlineBuffer = [];
        result.push(
          ditaSchema.nodes.xml_comment_block!.create({ data: child.nodeValue ?? '' }),
        );
      }
      continue;
    }

    if (child.nodeType === PROCESSING_INSTRUCTION_NODE) {
      const pi = child as slimdom.ProcessingInstruction;
      if (inlineBuffer.some((n) => !n.isText || (n.text ?? '').trim().length > 0)) {
        inlineBuffer.push(
          ditaSchema.nodes.xml_pi_inline!.create({ target: pi.target, data: pi.data }),
        );
      } else {
        inlineBuffer = [];
        result.push(
          ditaSchema.nodes.xml_pi_block!.create({ target: pi.target, data: pi.data }),
        );
      }
      continue;
    }

    if (child.nodeType === CDATA_SECTION_NODE) {
      if (inlineBuffer.some((n) => !n.isText || (n.text ?? '').trim().length > 0)) {
        inlineBuffer.push(
          ditaSchema.nodes.xml_cdata_inline!.create({ data: child.nodeValue ?? '' }),
        );
      } else {
        inlineBuffer = [];
        result.push(
          ditaSchema.nodes.xml_cdata_block!.create({ data: child.nodeValue ?? '' }),
        );
      }
      continue;
    }

    if (child.nodeType === TEXT_NODE) {
      if (isPureWhitespaceText(child)) {
        // Only keep whitespace text if we are actively accumulating inline content
        if (inlineBuffer.length > 0) {
          const val = child.nodeValue ?? '';
          if (val.length > 0) {
            inlineBuffer.push(ditaSchema.text(val));
          }
        }
      } else {
        const val = child.nodeValue ?? '';
        if (val.length > 0) {
          inlineBuffer.push(ditaSchema.text(val));
        }
      }
    }
  }

  flushInlineBuffer();
  return result;
}

const INLINE_PREFERRED_PARENTS = new Set<string>([
  'p',
  'title',
  'shortdesc',
  'cmd',
  'dt',
  'desc',
  'li',
  'dd',
  'entry',
  'stentry',
  'note',
  'info',
  'stepresult',
  'stepxmp',
  'choice',
  'context',
  'prereq',
  'result',
  'postreq',
]);

function isInlinePreferredParent(tagName: string): boolean {
  return INLINE_PREFERRED_PARENTS.has(tagName);
}

function convertBlockElement(el: slimdom.Element, ctx: DomToPmContext): PMNode {
  const rawAttrs = extractElementAttrs(el);
  const namespaceURI = el.namespaceURI;
  const tagName = el.tagName;

  // 1. CALS <tgroup>
  if (tagName === 'tgroup') {
    const colspecs = parseCalsColSpecs(el);
    const colsAttr = el.getAttribute('cols');
    const cols =
      colsAttr && /^\d+$/.test(colsAttr) ? Number(colsAttr) : Math.max(colspecs.length, 1);
    const childCtx: DomToPmContext = { ...ctx, activeColspecs: colspecs };
    const children = convertBlockContainerChildren(el, childCtx);
    return ditaSchema.nodes.cals_tgroup!.create(
      { rawAttrs, namespaceURI, cols },
      children,
    );
  }

  // 2. CALS <colspec>
  if (tagName === 'colspec') {
    const colnumAttr = el.getAttribute('colnum');
    const colnum = colnumAttr && /^\d+$/.test(colnumAttr) ? Number(colnumAttr) : 1;
    return ditaSchema.nodes.cals_colspec!.create({
      rawAttrs,
      namespaceURI,
      colnum,
      colname: el.getAttribute('colname') ?? '',
      colwidth: el.getAttribute('colwidth'),
    });
  }

  // 3. CALS <entry>
  if (tagName === 'entry') {
    const { colspan, rowspan } = resolveCalsEntrySpan(rawAttrs, ctx.activeColspecs);
    return ditaSchema.nodes.cals_entry!.create(
      { rawAttrs, namespaceURI, colspan, rowspan },
      convertBlockContainerChildren(el, ctx),
    );
  }

  // 4. Block <image> (e.g., placement="break" or direct child of <fig>)
  if (tagName === 'image') {
    return ditaSchema.nodes.dita_image_block!.create(
      { rawAttrs, namespaceURI },
      convertBlockContainerChildren(el, ctx),
    );
  }

  // 5. Modeled textblocks (<p>, <title>, <shortdesc>, <cmd>, <dt>, <desc>, <codeblock>, <pre>)
  const textblockType = MODELED_TEXTBLOCKS.get(tagName);
  if (textblockType) {
    const hasBlocks = elementContainsBlockChild(el);
    if (!hasBlocks) {
      return ditaSchema.nodes[textblockType]!.create(
        { rawAttrs, namespaceURI },
        convertInlineChildren(el, ctx),
      );
    }
    if (tagName === 'p') {
      return ditaSchema.nodes.dita_p_block!.create(
        { rawAttrs, namespaceURI },
        convertBlockContainerChildren(el, ctx),
      );
    }
    // Edge case: <title>/<shortdesc>/<cmd>/<dt>/<desc> with unexpected block children -> unknown_block preserves 100%
    return ditaSchema.nodes.unknown_block!.create(
      {
        tagName,
        rawAttrs,
        namespaceURI,
        preserveWhitespace: isWhitespacePreservingElement(tagName, el.getAttribute('xml:space')),
      },
      convertBlockContainerChildren(el, ctx),
    );
  }

  // 6. Modeled block containers
  const blockContainerType = MODELED_BLOCK_CONTAINERS.get(tagName);
  if (blockContainerType) {
    return ditaSchema.nodes[blockContainerType]!.create(
      { rawAttrs, namespaceURI },
      convertBlockContainerChildren(el, ctx),
    );
  }

  // 7. Unknown / specialized block element
  const preserveWs = isWhitespacePreservingElement(tagName, el.getAttribute('xml:space'));
  if (preserveWs && !elementContainsBlockChild(el)) {
    return ditaSchema.nodes.unknown_pre_block!.create(
      { tagName, rawAttrs, namespaceURI },
      convertInlineChildren(el, ctx),
    );
  }

  return ditaSchema.nodes.unknown_block!.create(
    {
      tagName,
      rawAttrs,
      namespaceURI,
      preserveWhitespace: preserveWs,
    },
    convertBlockContainerChildren(el, ctx),
  );
}

/**
 * Convert a parsed slimdom Document into a lossless ProseMirror Document.
 */
export function slimdomToPmDoc(parsed: ParsedXmlDocument): PMNode {
  const { document, xmlDeclaration, doctype } = parsed;
  const prolog: XmlPrologItem[] = [];
  const epilog: XmlPrologItem[] = [];
  let rootPmNode: PMNode | null = null;
  let seenRoot = false;

  const ctx: DomToPmContext = { activeColspecs: [] };

  for (const child of document.childNodes) {
    if (child.nodeType === ELEMENT_NODE && !seenRoot) {
      seenRoot = true;
      rootPmNode = convertBlockElement(child as slimdom.Element, ctx);
      continue;
    }

    const bucket = seenRoot ? epilog : prolog;

    if (child.nodeType === DOCUMENT_TYPE_NODE) {
      const dt = child as slimdom.DocumentType;
      const info: XmlDoctypeInfo = doctype ?? {
        name: dt.name,
        publicId: dt.publicId,
        systemId: dt.systemId,
      };
      bucket.push({ type: 'doctype', info });
    } else if (child.nodeType === COMMENT_NODE) {
      bucket.push({ type: 'comment', data: child.nodeValue ?? '' });
    } else if (child.nodeType === PROCESSING_INSTRUCTION_NODE) {
      const pi = child as slimdom.ProcessingInstruction;
      bucket.push({ type: 'pi', target: pi.target, data: pi.data });
    }
  }

  if (!rootPmNode) {
    throw new Error('Cannot convert slimdom Document without a root element to ProseMirror Doc.');
  }

  return ditaSchema.nodes.doc!.create(
    {
      xmlDeclaration,
      prolog,
      epilog,
    },
    Fragment.from(rootPmNode),
  );
}

function applyRawAttrs(
  doc: slimdom.Document,
  el: slimdom.Element,
  rawAttrs: RawAttrs,
): void {
  for (const entry of rawAttrs) {
    let ns: string | null = entry.namespaceURI ?? null;
    if (entry.name === 'xmlns' || entry.name.startsWith('xmlns:')) {
      ns = XMLNS_NS;
    } else if (entry.name.startsWith('xml:')) {
      ns = XML_NS;
    }
    const attrNode = doc.createAttributeNS(ns, entry.name);
    attrNode.value = entry.value;
    el.setAttributeNodeNS(attrNode);
  }
}

function resolveTagNameForPmNode(node: PMNode): string | null {
  const typeName = node.type.name;
  if (
    typeName === 'unknown_block' ||
    typeName === 'unknown_pre_block' ||
    typeName === 'unknown_inline' ||
    typeName === 'unknown_inline_block'
  ) {
    return String(node.attrs.tagName);
  }
  if (typeName === 'dita_fn_block') {
    return 'fn';
  }
  if (typeName === 'cals_colspec') {
    return 'colspec';
  }
  return PM_NODE_TO_DITA_TAG.get(typeName) ?? null;
}

function appendPmNodeToDom(
  doc: slimdom.Document,
  parent: slimdom.Node,
  pmNode: PMNode,
): void {
  if (pmNode.isText) {
    if (pmNode.text && pmNode.text.length > 0) {
      parent.appendChild(doc.createTextNode(pmNode.text));
    }
    return;
  }

  const typeName = pmNode.type.name;

  // Virtual mixed-content wrapper -> unwrap children directly into parent!
  if (typeName === 'xml_text_block') {
    pmNode.forEach((child) => {
      appendPmNodeToDom(doc, parent, child);
    });
    return;
  }

  if (typeName === 'xml_comment_block' || typeName === 'xml_comment_inline') {
    parent.appendChild(doc.createComment(String(pmNode.attrs.data ?? '')));
    return;
  }

  if (typeName === 'xml_pi_block' || typeName === 'xml_pi_inline') {
    parent.appendChild(
      doc.createProcessingInstruction(
        String(pmNode.attrs.target ?? ''),
        String(pmNode.attrs.data ?? ''),
      ),
    );
    return;
  }

  if (typeName === 'xml_cdata_block' || typeName === 'xml_cdata_inline') {
    parent.appendChild(doc.createCDATASection(String(pmNode.attrs.data ?? '')));
    return;
  }

  const tagName = resolveTagNameForPmNode(pmNode);
  if (!tagName) {
    throw new Error(`Unsupported ProseMirror node type during XML serialization: ${typeName}`);
  }

  const ns = (pmNode.attrs.namespaceURI as string | null | undefined) ?? null;
  const el = doc.createElementNS(ns, tagName);
  const rawAttrs = (pmNode.attrs.rawAttrs as RawAttrs | undefined) ?? [];
  applyRawAttrs(doc, el, rawAttrs);

  pmNode.forEach((child) => {
    appendPmNodeToDom(doc, el, child);
  });

  parent.appendChild(el);
}

/**
 * Convert a ProseMirror Document back into a lossless slimdom ParsedXmlDocument.
 */
export function pmDocToSlimdom(pmDoc: PMNode): ParsedXmlDocument {
  const doc = new slimdom.Document();
  const xmlDeclaration = (pmDoc.attrs.xmlDeclaration as XmlDeclaration | null) ?? null;
  const prolog = (pmDoc.attrs.prolog as XmlPrologItem[]) ?? [];
  const epilog = (pmDoc.attrs.epilog as XmlPrologItem[]) ?? [];

  let doctype: XmlDoctypeInfo | null = null;

  const appendPrologItem = (item: XmlPrologItem) => {
    if (item.type === 'comment') {
      doc.appendChild(doc.createComment(item.data));
    } else if (item.type === 'pi') {
      doc.appendChild(doc.createProcessingInstruction(item.target, item.data));
    } else if (item.type === 'doctype') {
      doctype = item.info;
      doc.appendChild(
        doc.implementation.createDocumentType(
          item.info.name,
          item.info.publicId,
          item.info.systemId,
        ),
      );
    }
  };

  for (const item of prolog) {
    appendPrologItem(item);
  }

  pmDoc.forEach((child) => {
    appendPmNodeToDom(doc, doc, child);
  });

  for (const item of epilog) {
    appendPrologItem(item);
  }

  return {
    document: doc,
    xmlDeclaration,
    doctype,
  };
}

/**
 * Convenience pipeline: XML string -> slimdom -> ProseMirror Doc.
 */
export function xmlToPmDoc(
  xml: string,
  options?: ParseXmlOptions,
): { pmDoc: PMNode; parsed: ParsedXmlDocument } {
  const parsed = parseXml(xml, options);
  const pmDoc = slimdomToPmDoc(parsed);
  return { pmDoc, parsed };
}

/**
 * Convenience pipeline: ProseMirror Doc -> slimdom -> deterministic XML string.
 */
export function pmDocToXml(pmDoc: PMNode, options?: SerializeXmlOptions): string {
  const parsed = pmDocToSlimdom(pmDoc);
  return serializeXml(parsed, options);
}

/**
 * Full Phase 0 spike round-trip pipeline:
 * XML -> slimdom -> ProseMirror Doc -> slimdom -> XML.
 */
export function roundTripXmlThroughPm(
  xml: string,
  options?: { parse?: ParseXmlOptions; serialize?: SerializeXmlOptions },
): {
  xml: string;
  pmDoc: PMNode;
  inputParsed: ParsedXmlDocument;
  outputParsed: ParsedXmlDocument;
} {
  const inputParsed = parseXml(xml, options?.parse);
  const pmDoc = slimdomToPmDoc(inputParsed);
  const outputParsed = pmDocToSlimdom(pmDoc);
  const outXml = serializeXml(outputParsed, options?.serialize);
  return {
    xml: outXml,
    pmDoc,
    inputParsed,
    outputParsed,
  };
}
