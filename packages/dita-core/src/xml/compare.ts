import type * as slimdom from 'slimdom';
import { isWhitespacePreservingElement } from '../model/dita-elements.js';
import type { ParsedXmlDocument } from '../xml/types.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;
const DOCUMENT_TYPE_NODE = 10;

export interface XmlDiffEntry {
  path: string;
  reason: string;
  expected?: string;
  actual?: string;
}

interface NormalizedChild {
  node: slimdom.Node;
  kind: 'element' | 'text' | 'cdata' | 'comment' | 'pi' | 'doctype';
  textValue?: string;
}

function normalizeChildren(
  parent: slimdom.Node,
  preserveWs: boolean,
): NormalizedChild[] {
  const raw = Array.from(parent.childNodes);
  const hasBlockElement = raw.some((n) => n.nodeType === ELEMENT_NODE);
  const result: NormalizedChild[] = [];

  for (const child of raw) {
    switch (child.nodeType) {
      case ELEMENT_NODE:
        result.push({ node: child, kind: 'element' });
        break;
      case CDATA_SECTION_NODE:
        result.push({ node: child, kind: 'cdata', textValue: child.nodeValue ?? '' });
        break;
      case COMMENT_NODE:
        result.push({ node: child, kind: 'comment', textValue: child.nodeValue ?? '' });
        break;
      case PROCESSING_INSTRUCTION_NODE:
        result.push({ node: child, kind: 'pi' });
        break;
      case DOCUMENT_TYPE_NODE:
        result.push({ node: child, kind: 'doctype' });
        break;
      case TEXT_NODE: {
        const val = child.nodeValue ?? '';
        if (preserveWs) {
          result.push({ node: child, kind: 'text', textValue: val });
        } else if (/^\s*$/.test(val)) {
          // Formatting whitespace between elements in block containers is insignificant;
          // preserve a single space when between inline siblings
          if (!hasBlockElement && val.length > 0) {
            result.push({ node: child, kind: 'text', textValue: val });
          }
        } else {
          // Trim outer indentation newlines around block children while preserving internal text
          const trimmed = val.replace(/^\n\s*/, '').replace(/\n\s*$/, '');
          result.push({ node: child, kind: 'text', textValue: trimmed });
        }
        break;
      }
      default:
        break;
    }
  }

  return result;
}

function compareElements(
  expected: slimdom.Element,
  actual: slimdom.Element,
  path: string,
  preserveWs: boolean,
  diffs: XmlDiffEntry[],
): void {
  if (expected.tagName !== actual.tagName) {
    diffs.push({
      path,
      reason: 'Element tagName mismatch',
      expected: expected.tagName,
      actual: actual.tagName,
    });
    return;
  }

  if (expected.namespaceURI !== actual.namespaceURI) {
    diffs.push({
      path,
      reason: 'Element namespaceURI mismatch',
      expected: String(expected.namespaceURI),
      actual: String(actual.namespaceURI),
    });
  }

  // Exact attribute count, names, values, and ORDER
  const expAttrs = Array.from(expected.attributes);
  const actAttrs = Array.from(actual.attributes);
  if (expAttrs.length !== actAttrs.length) {
    diffs.push({
      path,
      reason: 'Attribute count mismatch',
      expected: expAttrs.map((a) => `${a.name}="${a.value}"`).join(' '),
      actual: actAttrs.map((a) => `${a.name}="${a.value}"`).join(' '),
    });
  } else {
    for (let i = 0; i < expAttrs.length; i++) {
      const ea = expAttrs[i]!;
      const aa = actAttrs[i]!;
      if (ea.name !== aa.name || ea.value !== aa.value) {
        diffs.push({
          path: `${path}/@${ea.name}[${i}]`,
          reason: 'Attribute name/value/order mismatch',
          expected: `${ea.name}="${ea.value}"`,
          actual: `${aa.name}="${aa.value}"`,
        });
      }
    }
  }

  const nextPreserveWs =
    preserveWs ||
    isWhitespacePreservingElement(expected.tagName, expected.getAttribute('xml:space'));

  const expChildren = normalizeChildren(expected, nextPreserveWs);
  const actChildren = normalizeChildren(actual, nextPreserveWs);

  if (expChildren.length !== actChildren.length) {
    diffs.push({
      path,
      reason: `Child node count mismatch (${expChildren.length} vs ${actChildren.length})`,
      expected: expChildren.map((c) => `${c.kind}:${c.node.nodeName}`).join(', '),
      actual: actChildren.map((c) => `${c.kind}:${c.node.nodeName}`).join(', '),
    });
    return;
  }

  for (let i = 0; i < expChildren.length; i++) {
    const ec = expChildren[i]!;
    const ac = actChildren[i]!;
    const childPath = `${path}/${ec.kind === 'element' ? (ec.node as slimdom.Element).tagName : ec.kind}[${i}]`;

    if (ec.kind !== ac.kind) {
      diffs.push({
        path: childPath,
        reason: 'Child node kind mismatch',
        expected: ec.kind,
        actual: ac.kind,
      });
      continue;
    }

    if (ec.kind === 'element') {
      compareElements(
        ec.node as slimdom.Element,
        ac.node as slimdom.Element,
        childPath,
        nextPreserveWs,
        diffs,
      );
    } else if (ec.kind === 'pi') {
      const ep = ec.node as slimdom.ProcessingInstruction;
      const ap = ac.node as slimdom.ProcessingInstruction;
      if (ep.target !== ap.target || ep.data !== ap.data) {
        diffs.push({
          path: childPath,
          reason: 'ProcessingInstruction mismatch',
          expected: `<?${ep.target} ${ep.data}?>`,
          actual: `<?${ap.target} ${ap.data}?>`,
        });
      }
    } else if (ec.textValue !== ac.textValue) {
      diffs.push({
        path: childPath,
        reason: `${ec.kind} content mismatch`,
        expected: JSON.stringify(ec.textValue),
        actual: JSON.stringify(ac.textValue),
      });
    }
  }
}

/**
 * Deeply compare two ParsedXmlDocuments for lossless structural, attribute (including order),
 * comment, PI, CDATA, DOCTYPE, and XML declaration equivalence.
 */
export function compareParsedXmlDocuments(
  expected: ParsedXmlDocument,
  actual: ParsedXmlDocument,
): XmlDiffEntry[] {
  const diffs: XmlDiffEntry[] = [];

  if (expected.xmlDeclaration?.raw !== actual.xmlDeclaration?.raw) {
    diffs.push({
      path: '#xmlDeclaration',
      reason: 'XML declaration mismatch',
      expected: expected.xmlDeclaration?.raw ?? 'null',
      actual: actual.xmlDeclaration?.raw ?? 'null',
    });
  }

  const expChildren = normalizeChildren(expected.document, false);
  const actChildren = normalizeChildren(actual.document, false);

  if (expChildren.length !== actChildren.length) {
    diffs.push({
      path: '#document',
      reason: `Top-level child count mismatch (${expChildren.length} vs ${actChildren.length})`,
      expected: expChildren.map((c) => c.kind).join(', '),
      actual: actChildren.map((c) => c.kind).join(', '),
    });
    return diffs;
  }

  for (let i = 0; i < expChildren.length; i++) {
    const ec = expChildren[i]!;
    const ac = actChildren[i]!;
    if (ec.kind !== ac.kind) {
      diffs.push({
        path: `#document[${i}]`,
        reason: 'Top-level child kind mismatch',
        expected: ec.kind,
        actual: ac.kind,
      });
      continue;
    }

    if (ec.kind === 'doctype') {
      const ed = ec.node as slimdom.DocumentType;
      const ad = ac.node as slimdom.DocumentType;
      if (ed.name !== ad.name || ed.publicId !== ad.publicId || ed.systemId !== ad.systemId) {
        diffs.push({
          path: `#document/doctype`,
          reason: 'DOCTYPE mismatch',
          expected: `${ed.name} | ${ed.publicId} | ${ed.systemId}`,
          actual: `${ad.name} | ${ad.publicId} | ${ad.systemId}`,
        });
      }
    } else if (ec.kind === 'comment') {
      if (ec.textValue !== ac.textValue) {
        diffs.push({
          path: `#document/comment[${i}]`,
          reason: 'Top-level comment mismatch',
          expected: ec.textValue,
          actual: ac.textValue,
        });
      }
    } else if (ec.kind === 'pi') {
      const ep = ec.node as slimdom.ProcessingInstruction;
      const ap = ac.node as slimdom.ProcessingInstruction;
      if (ep.target !== ap.target || ep.data !== ap.data) {
        diffs.push({
          path: `#document/pi[${i}]`,
          reason: 'Top-level PI mismatch',
          expected: `<?${ep.target} ${ep.data}?>`,
          actual: `<?${ap.target} ${ap.data}?>`,
        });
      }
    } else if (ec.kind === 'element') {
      compareElements(
        ec.node as slimdom.Element,
        ac.node as slimdom.Element,
        `/${(ec.node as slimdom.Element).tagName}`,
        false,
        diffs,
      );
    }
  }

  return diffs;
}
