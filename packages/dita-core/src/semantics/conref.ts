import { coreT } from '../i18n/messages.js';
import type { UiLocale } from '../i18n/locale.js';
import * as slimdom from 'slimdom';
import { extractProfilingValuesFromDocument } from '../ditaval/ditaval.js';
import { resolveDitaHref } from '../map/path-utils.js';
import { DITA_INLINE_TAGS, DITA_TOPIC_ROOT_TAGS } from '../model/dita-elements.js';
import { getNodeSourceRange } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import type { ParsedXmlDocument } from '../xml/types.js';
import { findElementByDitaId } from '../xml/xpath.js';
import { resolveKeyrefInKeyspace } from './keyspace.js';
import type {
  IndexedTopicElement,
  KeyspaceResult,
  ResolvedConrefResult,
  TopicIdIndexEntry,
} from './types.js';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;
const PROCESSING_INSTRUCTION_NODE = 7;
const COMMENT_NODE = 8;

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

const MAX_CONREF_DEPTH = 16;

const CONREF_SPECIALIZATION_PARENT: Readonly<Record<string, readonly string[]>> = {
  topic: ['concept', 'task', 'reference'],
  body: ['conbody', 'taskbody', 'refbody'],
  ph: [
    'codeph',
    'uicontrol',
    'filepath',
    'varname',
    'cmdname',
    'parmname',
    'userinput',
    'systemoutput',
    'wintitle',
    'menucascade',
    'term',
    'option',
    'apiname',
    'b',
    'i',
    'u',
  ],
  keyword: ['cmdname', 'parmname', 'varname', 'option', 'apiname', 'wintitle'],
  ul: ['choices', 'steps-unordered'],
  ol: ['steps', 'substeps'],
  li: ['step', 'substep', 'choice'],
  pre: ['codeblock', 'lines', 'screen', 'msgblock'],
  section: ['prereq', 'context', 'result', 'postreq', 'example', 'refsyn'],
  simpletable: ['properties', 'choicetable'],
};

/**
 * Verify whether a referencing element (`sourceTag`) can legally pull content from
 * `targetTag` per DITA 1.3 conref specialization compatibility rules.
 * A more general source element may reference itself or a more specialized target element;
 * specialized elements may also match identically.
 */
export function areConrefTagsCompatible(sourceTag: string, targetTag: string): boolean {
  if (sourceTag === targetTag) return true;
  const specializations = CONREF_SPECIALIZATION_PARENT[sourceTag];
  if (specializations && specializations.includes(targetTag)) {
    return true;
  }
  return false;
}

function getNormalizedText(el: slimdom.Element | null): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function findDirectChild(parent: slimdom.Element, tagName: string): slimdom.Element | null {
  for (const child of parent.childNodes) {
    if (child.nodeType === ELEMENT_NODE && (child as slimdom.Element).tagName === tagName) {
      return child as slimdom.Element;
    }
  }
  return null;
}

/**
 * Index all elements carrying `@id` inside a parsed DITA topic document, along with
 * document title and profiling attribute token inventory.
 */
export function indexTopicElements(
  filePath: string,
  parsedDoc: ParsedXmlDocument,
): TopicIdIndexEntry {
  const root = parsedDoc.document.documentElement;
  if (!root) {
    return {
      filePath,
      rootTag: '',
      elements: [],
      profilingValues: extractProfilingValuesFromDocument(parsedDoc.document),
      wellFormed: false,
    };
  }

  const titleEl = findDirectChild(root, 'title');
  const title = getNormalizedText(titleEl) || undefined;
  const rootTopicId = root.getAttribute('id')?.trim() || undefined;
  const elements: IndexedTopicElement[] = [];

  const walk = (el: slimdom.Element, elemPath: number[], activeTopicId: string) => {
    const isTopic = DITA_TOPIC_ROOT_TAGS.has(el.tagName);
    const idAttr = el.getAttribute('id')?.trim();
    const nextTopicId = isTopic && idAttr ? idAttr : activeTopicId;

    if (idAttr) {
      const range = getNodeSourceRange(el);
      const conkeyref = el.getAttribute('conkeyref')?.trim();
      const conref = el.getAttribute('conref')?.trim();
      const fragment =
        isTopic || !nextTopicId || nextTopicId === idAttr
          ? idAttr
          : `${nextTopicId}/${idAttr}`;
      const rawPreview = getNormalizedText(el);
      const previewText =
        rawPreview.length > 100 ? `${rawPreview.slice(0, 97)}...` : rawPreview;

      elements.push({
        filePath,
        topicId: nextTopicId || idAttr,
        elementId: idAttr,
        fragment,
        tagName: el.tagName,
        isTopicRoot: isTopic,
        previewText,
        line: range.open?.line ?? 1,
        column: range.open?.column ?? 1,
        elementPath: elemPath,
        hasConref: Boolean(conkeyref || conref),
        conrefAttr: conkeyref ? 'conkeyref' : conref ? 'conref' : undefined,
        conrefValue: conkeyref ?? conref ?? undefined,
      });
    }

    let idx = 0;
    for (const child of el.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) continue;
      walk(child as slimdom.Element, [...elemPath, idx], nextTopicId);
      idx++;
    }
  };

  walk(root, [], rootTopicId ?? '');

  return {
    filePath,
    rootTag: root.tagName,
    rootTopicId,
    title,
    elements,
    profilingValues: extractProfilingValuesFromDocument(parsedDoc.document),
    wellFormed: true,
  };
}

/**
 * Pure cross-version DOM cloner into a target `slimdom@4` Document.
 * Inspects strictly `nodeType` constants so `slimdom@3` (slimdom-sax-parser) nodes clone
 * cleanly into `slimdom@4` documents with zero `instanceof` mismatches.
 */
function cloneNodeIntoSlimdom(targetDoc: slimdom.Document, source: slimdom.Node): slimdom.Node | null {
  switch (source.nodeType) {
    case TEXT_NODE:
      return targetDoc.createTextNode(source.nodeValue ?? '');
    case CDATA_SECTION_NODE:
      return targetDoc.createCDATASection(source.nodeValue ?? '');
    case COMMENT_NODE:
      return targetDoc.createComment(source.nodeValue ?? '');
    case PROCESSING_INSTRUCTION_NODE: {
      const pi = source as slimdom.ProcessingInstruction;
      return targetDoc.createProcessingInstruction(pi.target, pi.data);
    }
    case ELEMENT_NODE: {
      const srcEl = source as slimdom.Element;
      const cloned = targetDoc.createElementNS(srcEl.namespaceURI ?? null, srcEl.tagName);
      for (const attr of srcEl.attributes) {
        let ns: string | null = attr.namespaceURI ?? null;
        if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
          ns = XMLNS_NS;
        } else if (attr.name.startsWith('xml:')) {
          ns = XML_NS;
        }
        const attrNode = targetDoc.createAttributeNS(ns, attr.name);
        attrNode.value = attr.value;
        cloned.setAttributeNodeNS(attrNode);
      }
      for (const child of srcEl.childNodes) {
        const clonedChild = cloneNodeIntoSlimdom(targetDoc, child);
        if (clonedChild) cloned.appendChild(clonedChild);
      }
      return cloned;
    }
    default:
      return null;
  }
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serializeChildNodes(nodes: readonly slimdom.Node[]): string {
  const parts: string[] = [];
  for (const child of nodes) {
    if (child.nodeType === TEXT_NODE) {
      parts.push(escapeXmlText(child.nodeValue ?? ''));
    } else if (child.nodeType === COMMENT_NODE) {
      parts.push(`<!--${child.nodeValue ?? ''}-->`);
    } else if (child.nodeType === CDATA_SECTION_NODE) {
      parts.push(`<![CDATA[${child.nodeValue ?? ''}]]>`);
    } else if (child.nodeType === PROCESSING_INSTRUCTION_NODE) {
      const pi = child as slimdom.ProcessingInstruction;
      parts.push(pi.data ? `<?${pi.target} ${pi.data}?>` : `<?${pi.target}?>`);
    } else if (child.nodeType === ELEMENT_NODE) {
      const tempDoc = new slimdom.Document();
      const cloned = cloneNodeIntoSlimdom(tempDoc, child);
      if (cloned) {
        tempDoc.appendChild(cloned);
        parts.push(
          serializeXml(tempDoc, {
            includeXmlDeclaration: false,
            trailingNewline: false,
          }),
        );
      }
    }
  }
  return parts.join('');
}

function findTopicIdForElement(el: slimdom.Element): string | undefined {
  let curr: slimdom.Node | null = el;
  while (curr && curr.nodeType === ELEMENT_NODE) {
    const currEl = curr as slimdom.Element;
    if (DITA_TOPIC_ROOT_TAGS.has(currEl.tagName)) {
      const id = currEl.getAttribute('id')?.trim();
      if (id) return id;
    }
    curr = currEl.parentNode;
  }
  return el.ownerDocument?.documentElement?.getAttribute('id')?.trim() || undefined;
}

export interface ResolveConrefOptions {
  sourceFilePath: string;
  sourceTagName: string;
  attrName: 'conref' | 'conkeyref';
  rawValue: string;
  conrefend?: string;
  sourceTopicId?: string;
  sourceElementId?: string;
  keyspace: KeyspaceResult | null;
  getParsedDoc: (posixPath: string) => ParsedXmlDocument | null;
  hasFile?: (posixPath: string) => boolean;
  resolveTopicRootId: (posixPath: string) => string | undefined;
  locale?: UiLocale;
}

/**
 * Resolve a DITA 1.3 `conref` or `conkeyref` (including optional `conrefend`, nested keyref
 * substitution, chained conrefs, tag compatibility checks, and DFS cycle detection).
 */
export function resolveConrefReference(options: ResolveConrefOptions): ResolvedConrefResult {
  const locale: UiLocale = options.locale ?? 'zh-CN';
  const {
    sourceFilePath,
    sourceTagName,
    attrName,
    rawValue,
    conrefend,
    sourceTopicId,
    sourceElementId,
    keyspace,
    getParsedDoc,
    hasFile,
    resolveTopicRootId,
  } = options;

  const visitStack: string[] = [];
  if (sourceTopicId) {
    const selfCanonical =
      sourceElementId && sourceElementId !== sourceTopicId
        ? `${sourceFilePath}#${sourceTopicId}/${sourceElementId}`
        : `${sourceFilePath}#${sourceTopicId}`;
    visitStack.push(selfCanonical);
  }

  interface TargetAddressOk {
    ok: true;
    targetFilePath: string;
    topicId: string;
    elemId?: string;
  }
  type TargetAddressErr = {
    ok: false;
    status: ResolvedConrefResult['status'];
    errorMessage: string;
    targetFilePath?: string;
  };

  const parseTargetAddress = (
    currFile: string,
    currAttr: 'conref' | 'conkeyref',
    currValue: string,
    currTopicId?: string,
  ): TargetAddressOk | TargetAddressErr => {
    const trimmed = currValue.trim();
    if (!trimmed) {
      return {
        ok: false,
        status: 'invalid-syntax',
        errorMessage: coreT(locale, 'conref.emptyAttr', { attr: currAttr }),
      };
    }

    if (currAttr === 'conkeyref') {
      const slashIdx = trimmed.indexOf('/');
      const keyName = slashIdx >= 0 ? trimmed.slice(0, slashIdx).trim() : trimmed;
      const elemId = slashIdx >= 0 ? trimmed.slice(slashIdx + 1).trim() || undefined : undefined;
      if (!keyName) {
        return {
          ok: false,
          status: 'invalid-syntax',
          errorMessage: coreT(locale, 'conref.invalidConkeyref', { value: trimmed }),
        };
      }
      const keyDef = keyspace?.keys[keyName];
      if (!keyDef) {
        return {
          ok: false,
          status: 'missing-key',
          errorMessage: coreT(locale, 'conref.missingKey', { keyName }),
        };
      }
      if (!keyDef.resolvedHref) {
        return {
          ok: false,
          status: 'missing-file',
          errorMessage: coreT(locale, 'conref.keyWithoutHref', { keyName }),
        };
      }
      const topicFromKey = keyDef.fragment?.split('/')[0];
      const topicId = topicFromKey || resolveTopicRootId(keyDef.resolvedHref);
      if (!topicId) {
        return {
          ok: false,
          status: 'missing-target',
          targetFilePath: keyDef.resolvedHref,
          errorMessage: coreT(locale, 'conref.targetWithoutTopicId', { path: keyDef.resolvedHref }),
        };
      }
      return {
        ok: true,
        targetFilePath: keyDef.resolvedHref,
        topicId,
        elemId,
      };
    }

    // Standard `conref`: file.dita#topicId/elemId | #topicId/elemId | #./elemId | #topicId
    const hashIdx = trimmed.indexOf('#');
    if (hashIdx === -1) {
      return {
        ok: false,
        status: 'invalid-syntax',
        errorMessage: coreT(locale, 'conref.missingFragment', { value: trimmed }),
      };
    }

    const filePart = trimmed.slice(0, hashIdx).trim();
    const fragPart = trimmed.slice(hashIdx + 1).trim();
    if (!fragPart) {
      return {
        ok: false,
        status: 'invalid-syntax',
        errorMessage: coreT(locale, 'conref.emptyFragment', { value: trimmed }),
      };
    }

    let targetFilePath = currFile;
    if (filePart.length > 0) {
      const resolved = resolveDitaHref(currFile, filePart);
      if (resolved.isExternal || resolved.escapesRoot || !resolved.targetPath) {
        return {
          ok: false,
          status: 'missing-file',
          errorMessage: coreT(locale, 'conref.unresolvablePath', { value: trimmed }),
        };
      }
      targetFilePath = resolved.targetPath;
    }

    const fragSlash = fragPart.indexOf('/');
    let topicId = fragSlash >= 0 ? fragPart.slice(0, fragSlash).trim() : fragPart;
    const elemId = fragSlash >= 0 ? fragPart.slice(fragSlash + 1).trim() || undefined : undefined;

    // Handle DITA 1.3 same-topic shorthand `#./elemId`
    if (topicId === '.') {
      topicId = currTopicId || resolveTopicRootId(targetFilePath) || '';
    }

    if (!topicId) {
      return {
        ok: false,
        status: 'invalid-syntax',
        targetFilePath,
        errorMessage: coreT(locale, 'conref.unresolvableTopicId', { value: trimmed }),
      };
    }

    return {
      ok: true,
      targetFilePath,
      topicId,
      elemId,
    };
  };

  const locateElementInDoc = (
    doc: slimdom.Document,
    topicId: string,
    elemId?: string,
  ): slimdom.Element | null => {
    const direct = findElementByDitaId(doc, topicId, elemId);
    if (direct) return direct;
    if (!elemId && doc.documentElement?.getAttribute('id') === topicId) {
      return doc.documentElement;
    }
    return null;
  };

  const expandSubtree = (
    sourceEl: slimdom.Element,
    ownerFilePath: string,
    ownerTopicId: string,
    targetDoc: slimdom.Document,
  ): { ok: true; element: slimdom.Element } | { ok: false; result: ResolvedConrefResult } => {
    const cloned = targetDoc.createElementNS(sourceEl.namespaceURI ?? null, sourceEl.tagName);
    for (const attr of sourceEl.attributes) {
      let ns: string | null = attr.namespaceURI ?? null;
      if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) ns = XMLNS_NS;
      else if (attr.name.startsWith('xml:')) ns = XML_NS;
      const a = targetDoc.createAttributeNS(ns, attr.name);
      a.value = attr.value;
      cloned.setAttributeNodeNS(a);
    }

    // Substitute empty `<keyword keyref="..."/>` or `<ph keyref="..."/>` inline preview text
    const keyrefVal = sourceEl.getAttribute('keyref')?.trim();
    if (
      keyrefVal &&
      (sourceEl.tagName === 'keyword' || sourceEl.tagName === 'ph' || sourceEl.tagName === 'term') &&
      sourceEl.childNodes.length === 0
    ) {
      const resolvedKey = resolveKeyrefInKeyspace(keyrefVal, keyspace, undefined, locale);
      if (resolvedKey.status === 'resolved' && resolvedKey.resolvedText) {
        cloned.appendChild(targetDoc.createTextNode(resolvedKey.resolvedText));
        return { ok: true, element: cloned };
      }
    }

    for (const child of sourceEl.childNodes) {
      if (child.nodeType !== ELEMENT_NODE) {
        const c = cloneNodeIntoSlimdom(targetDoc, child);
        if (c) cloned.appendChild(c);
        continue;
      }

      const childEl = child as slimdom.Element;
      const childConkeyref = childEl.getAttribute('conkeyref')?.trim();
      const childConref = childEl.getAttribute('conref')?.trim();
      const childEnd = childEl.getAttribute('conrefend')?.trim() || undefined;

      if (childConkeyref || childConref) {
        const nestedRes = resolveInternal(
          ownerFilePath,
          childEl.tagName,
          childConkeyref ? 'conkeyref' : 'conref',
          (childConkeyref ?? childConref)!,
          childEnd,
          ownerTopicId,
          childEl.getAttribute('id')?.trim() || undefined,
          false,
        );
        if (nestedRes.status === 'cycle') {
          return { ok: false, result: nestedRes };
        }
        if (nestedRes.status === 'resolved' && 'elements' in nestedRes && nestedRes.elements.length > 0) {
          for (const resolvedEl of nestedRes.elements) {
            const imported = cloneNodeIntoSlimdom(targetDoc, resolvedEl);
            if (imported) cloned.appendChild(imported);
          }
          continue;
        }
      }

      const expandedChild = expandSubtree(childEl, ownerFilePath, ownerTopicId, targetDoc);
      if (!expandedChild.ok) return expandedChild;
      cloned.appendChild(expandedChild.element);
    }

    return { ok: true, element: cloned };
  };

  type InternalResolveResult =
    | {
        status: 'resolved';
        targetFilePath: string;
        targetTopicId: string;
        targetElementId?: string;
        targetTagName: string;
        targetLine: number;
        targetColumn: number;
        elements: slimdom.Element[];
        isRange: boolean;
      }
    | ResolvedConrefResult;

  const resolveInternal = (
    currFile: string,
    currTag: string,
    currAttr: 'conref' | 'conkeyref',
    currValue: string,
    currEnd: string | undefined,
    currTopicId: string | undefined,
    currElemId: string | undefined,
    checkCompatibility: boolean,
  ): InternalResolveResult => {
    const addr = parseTargetAddress(currFile, currAttr, currValue, currTopicId);
    if (!addr.ok) {
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: addr.status,
        targetFilePath: addr.targetFilePath,
        errorMessage: addr.errorMessage,
      };
    }

    if (hasFile && !hasFile(addr.targetFilePath)) {
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: 'missing-file',
        targetFilePath: addr.targetFilePath,
        errorMessage: coreT(locale, 'conref.missingTargetFile', { path: addr.targetFilePath }),
      };
    }

    const parsedTarget = getParsedDoc(addr.targetFilePath);
    if (!parsedTarget) {
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: hasFile ? 'malformed-target' : 'missing-file',
        targetFilePath: addr.targetFilePath,
        errorMessage: hasFile
          ? coreT(locale, 'conref.malformedTargetFile', { path: addr.targetFilePath })
          : coreT(locale, 'conref.unresolvableTargetFile', { path: addr.targetFilePath }),
      };
    }

    const targetEl = locateElementInDoc(parsedTarget.document, addr.topicId, addr.elemId);
    if (!targetEl) {
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: 'missing-target',
        targetFilePath: addr.targetFilePath,
        targetTopicId: addr.topicId,
        targetElementId: addr.elemId,
        errorMessage: coreT(locale, 'conref.missingTargetId', {
          path: addr.targetFilePath,
          topicId: addr.topicId,
          elemId: addr.elemId ? `/${addr.elemId}` : '',
        }),
      };
    }

    if (checkCompatibility && !areConrefTagsCompatible(currTag, targetEl.tagName)) {
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: 'incompatible-tag',
        targetFilePath: addr.targetFilePath,
        targetTopicId: addr.topicId,
        targetElementId: addr.elemId,
        targetTagName: targetEl.tagName,
        errorMessage: coreT(locale, 'conref.incompatibleTag', {
          sourceTag: currTag,
          targetTag: targetEl.tagName,
        }),
      };
    }

    const canonicalTarget = addr.elemId
      ? `${addr.targetFilePath}#${addr.topicId}/${addr.elemId}`
      : `${addr.targetFilePath}#${addr.topicId}`;

    if (visitStack.includes(canonicalTarget)) {
      const cycleChain = [...visitStack, canonicalTarget];
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: 'cycle',
        targetFilePath: addr.targetFilePath,
        targetTopicId: addr.topicId,
        targetElementId: addr.elemId,
        targetTagName: targetEl.tagName,
        cycleChain,
        errorMessage: coreT(locale, 'conref.cycle', { chain: cycleChain.join(' → ') }),
      };
    }

    if (visitStack.length >= MAX_CONREF_DEPTH) {
      const cycleChain = [...visitStack, canonicalTarget];
      return {
        sourceFilePath,
        sourceTagName,
        attrName,
        rawValue,
        conrefend,
        status: 'cycle',
        targetFilePath: addr.targetFilePath,
        cycleChain,
        errorMessage: coreT(locale, 'conref.depthLimit', {
          depth: String(MAX_CONREF_DEPTH),
          chain: cycleChain.join(' → '),
        }),
      };
    }

    void currElemId;
    visitStack.push(canonicalTarget);
    try {
      const targetRange = getNodeSourceRange(targetEl);
      const targetLine = targetRange.open?.line ?? 1;
      const targetColumn = targetRange.open?.column ?? 1;

      // Optional `conrefend` sibling range collection
      let rawElements: slimdom.Element[] = [targetEl];
      let isRange = false;

      if (currEnd) {
        const endAttrKind: 'conref' | 'conkeyref' =
          currEnd.includes('#') || currAttr === 'conref' ? 'conref' : 'conkeyref';
        const endAddr = parseTargetAddress(
          currFile,
          endAttrKind,
          currEnd,
          addr.topicId,
        );
        if (!endAddr.ok) {
          return {
            sourceFilePath,
            sourceTagName,
            attrName,
            rawValue,
            conrefend,
            status: endAddr.status,
            targetFilePath: addr.targetFilePath,
            errorMessage: coreT(locale, 'conref.conrefendFailed', {
              message: endAddr.errorMessage ?? '',
            }),
          };
        }
        const endEl = locateElementInDoc(parsedTarget.document, endAddr.topicId, endAddr.elemId);
        if (!endEl || endEl.parentNode !== targetEl.parentNode || !targetEl.parentNode) {
          return {
            sourceFilePath,
            sourceTagName,
            attrName,
            rawValue,
            conrefend,
            status: 'missing-target',
            targetFilePath: addr.targetFilePath,
            errorMessage: coreT(locale, 'conref.conrefendDifferentParent', { value: currEnd }),
          };
        }
        const siblings: slimdom.Element[] = [];
        for (const child of targetEl.parentNode.childNodes) {
          if (child.nodeType === ELEMENT_NODE) siblings.push(child as slimdom.Element);
        }
        const startIdx = siblings.indexOf(targetEl);
        const endIdx = siblings.indexOf(endEl);
        if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
          return {
            sourceFilePath,
            sourceTagName,
            attrName,
            rawValue,
            conrefend,
            status: 'invalid-syntax',
            targetFilePath: addr.targetFilePath,
            errorMessage: coreT(locale, 'conref.conrefendOutOfOrder'),
          };
        }
        rawElements = siblings.slice(startIdx, endIdx + 1);
        isRange = rawElements.length > 1;
      }

      const scratchDoc = new slimdom.Document();
      const expandedElements: slimdom.Element[] = [];

      for (const rawEl of rawElements) {
        // Handle chained conref directly on target element
        const chainedConkeyref = rawEl.getAttribute('conkeyref')?.trim();
        const chainedConref = rawEl.getAttribute('conref')?.trim();
        const chainedEnd = rawEl.getAttribute('conrefend')?.trim() || undefined;
        const rawTopicId = findTopicIdForElement(rawEl) ?? addr.topicId;

        if (chainedConkeyref || chainedConref) {
          const chainedRes = resolveInternal(
            addr.targetFilePath,
            rawEl.tagName,
            chainedConkeyref ? 'conkeyref' : 'conref',
            (chainedConkeyref ?? chainedConref)!,
            chainedEnd,
            rawTopicId,
            rawEl.getAttribute('id')?.trim() || undefined,
            true,
          );
          if (chainedRes.status !== 'resolved' || !('elements' in chainedRes)) {
            return chainedRes;
          }
          for (const el of chainedRes.elements) {
            const imported = cloneNodeIntoSlimdom(scratchDoc, el) as slimdom.Element | null;
            if (imported) expandedElements.push(imported);
          }
          continue;
        }

        const expanded = expandSubtree(rawEl, addr.targetFilePath, rawTopicId, scratchDoc);
        if (!expanded.ok) {
          return expanded.result;
        }
        expandedElements.push(expanded.element);
      }

      return {
        status: 'resolved',
        targetFilePath: addr.targetFilePath,
        targetTopicId: addr.topicId,
        targetElementId: addr.elemId,
        targetTagName: targetEl.tagName,
        targetLine,
        targetColumn,
        elements: expandedElements,
        isRange,
      };
    } finally {
      visitStack.pop();
    }
  };

  const finalRes = resolveInternal(
    sourceFilePath,
    sourceTagName,
    attrName,
    rawValue,
    conrefend,
    sourceTopicId,
    sourceElementId,
    true,
  );

  if (finalRes.status !== 'resolved' || !('elements' in finalRes)) {
    return finalRes as ResolvedConrefResult;
  }

  let resolvedXml: string;
  if (finalRes.isRange) {
    resolvedXml = serializeChildNodes(finalRes.elements);
  } else {
    const first = finalRes.elements[0]!;
    resolvedXml = serializeChildNodes(Array.from(first.childNodes));
  }

  const resolvedText = finalRes.elements
    .map((el) => getNormalizedText(el))
    .filter(Boolean)
    .join(' ')
    .trim();

  const isInline =
    DITA_INLINE_TAGS.has(sourceTagName) || DITA_INLINE_TAGS.has(finalRes.targetTagName);

  return {
    sourceFilePath,
    sourceTagName,
    attrName,
    rawValue,
    conrefend,
    status: 'resolved',
    targetFilePath: finalRes.targetFilePath,
    targetTopicId: finalRes.targetTopicId,
    targetElementId: finalRes.targetElementId,
    targetTagName: finalRes.targetTagName,
    targetLine: finalRes.targetLine,
    targetColumn: finalRes.targetColumn,
    resolvedXml,
    resolvedText,
    isInline,
  };
}
