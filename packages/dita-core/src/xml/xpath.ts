import {
  evaluateXPathToBoolean as fxEvalBoolean,
  evaluateXPathToFirstNode as fxEvalFirstNode,
  evaluateXPathToNodes as fxEvalNodes,
  evaluateXPathToString as fxEvalString,
  evaluateXPathToStrings as fxEvalStrings,
} from 'fontoxpath';
import type * as slimdom from 'slimdom';

export type XPathVariables = Record<string, unknown>;

export function evaluateXPathToNodes<T extends slimdom.Node = slimdom.Node>(
  selector: string,
  contextNode: slimdom.Node,
  variables?: XPathVariables,
): T[] {
  return fxEvalNodes(selector, contextNode, null, variables) as unknown as T[];
}

export function evaluateXPathToFirstNode<T extends slimdom.Node = slimdom.Node>(
  selector: string,
  contextNode: slimdom.Node,
  variables?: XPathVariables,
): T | null {
  return (fxEvalFirstNode(selector, contextNode, null, variables) as unknown as T | null) ?? null;
}

export function evaluateXPathToStrings(
  selector: string,
  contextNode: slimdom.Node,
  variables?: XPathVariables,
): string[] {
  return fxEvalStrings(selector, contextNode, null, variables);
}

export function evaluateXPathToString(
  selector: string,
  contextNode: slimdom.Node,
  variables?: XPathVariables,
): string {
  return fxEvalString(selector, contextNode, null, variables);
}

export function evaluateXPathToBoolean(
  selector: string,
  contextNode: slimdom.Node,
  variables?: XPathVariables,
): boolean {
  return fxEvalBoolean(selector, contextNode, null, variables);
}

/**
 * Resolve a DITA fragment address (`#topicId` or `#topicId/elemId`) within a slimdom Document.
 */
export function findElementByDitaId(
  doc: slimdom.Document,
  topicId: string,
  elemId?: string,
): slimdom.Element | null {
  if (!elemId) {
    return evaluateXPathToFirstNode<slimdom.Element>(
      `//*[@id = $topicId][self::topic or self::concept or self::task or self::reference or ancestor-or-self::*[1][@id = $topicId]]`,
      doc,
      { topicId },
    );
  }
  return evaluateXPathToFirstNode<slimdom.Element>(
    `//*[@id = $topicId]//*[@id = $elemId]`,
    doc,
    { topicId, elemId },
  );
}

export interface ConrefUsage {
  element: slimdom.Element;
  tagName: string;
  attrName: 'conref' | 'conkeyref';
  value: string;
  conrefend?: string;
}

/**
 * Find all elements carrying `conref` or `conkeyref` in a document via XPath 3.1.
 */
export function findConrefUsages(doc: slimdom.Document): ConrefUsage[] {
  const nodes = evaluateXPathToNodes<slimdom.Element>('//*[@conref or @conkeyref]', doc);
  return nodes.map((element) => {
    const conkeyref = element.getAttribute('conkeyref');
    const conref = element.getAttribute('conref');
    const conrefend = element.getAttribute('conrefend') ?? undefined;
    if (conkeyref !== null) {
      return {
        element,
        tagName: element.tagName,
        attrName: 'conkeyref',
        value: conkeyref,
        conrefend,
      };
    }
    return {
      element,
      tagName: element.tagName,
      attrName: 'conref',
      value: conref ?? '',
      conrefend,
    };
  });
}

export interface KeyrefUsage {
  element: slimdom.Element;
  tagName: string;
  keyref: string;
}

/**
 * Find all elements carrying `keyref` in a document via XPath 3.1.
 */
export function findKeyrefUsages(doc: slimdom.Document): KeyrefUsage[] {
  const nodes = evaluateXPathToNodes<slimdom.Element>('//*[@keyref]', doc);
  return nodes.map((element) => ({
    element,
    tagName: element.tagName,
    keyref: element.getAttribute('keyref') ?? '',
  }));
}
