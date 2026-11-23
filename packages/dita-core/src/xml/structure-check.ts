/**
 * XML-level DITA content-model structure check (sequence + cardinality).
 *
 * Walks a position-tracked slimdom document and reports content-model violations with exact
 * source offsets, so the CodeMirror source linter and the workspace Problems panel can both
 * point at the offending element.
 */

import type * as slimdom from 'slimdom';
import { validateChildSequence, type StructureIssue } from '../model/dita-structure.js';
import { checkXmlWellFormed, getNodeSourceRange } from './parser.js';
import type { XmlParseError } from './types.js';

const ELEMENT_NODE = 1;

export interface XmlStructureIssue extends StructureIssue {
  line: number;
  column: number;
  /** Character offset of the offending element (or of the parent start tag for missing children). */
  offset: number;
  endOffset: number;
}

/** Collect content-model issues from an already position-tracked document. */
export function collectXmlStructureIssues(document: slimdom.Document): XmlStructureIssue[] {
  const issues: XmlStructureIssue[] = [];

  const walk = (el: slimdom.Element): void => {
    const children: slimdom.Element[] = [];
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === ELEMENT_NODE) children.push(child as slimdom.Element);
    }

    const childTags = children.map((child) => child.tagName);
    const contentIsReused =
      el.hasAttribute('conref') || el.hasAttribute('conkeyref');
    for (const issue of validateChildSequence(el.tagName, childTags, { contentIsReused })) {
      const target = issue.index === undefined ? el : children[issue.index];
      const range = target ? getNodeSourceRange(target) : undefined;
      const open = range?.open;
      const offset = open?.start ?? 0;
      issues.push({
        ...issue,
        line: open?.line ?? 1,
        column: open?.column ?? 1,
        offset,
        endOffset: Math.max(offset, open?.end ?? offset),
      });
    }

    for (const child of children) walk(child);
  };

  if (document.documentElement) walk(document.documentElement);
  return issues;
}

export type XmlStructureCheckResult =
  | { ok: true; issues: XmlStructureIssue[] }
  | { ok: false; error: XmlParseError };

/** Parse + validate; malformed XML short-circuits with the parser error. */
export function checkXmlStructure(xml: string): XmlStructureCheckResult {
  const wellFormed = checkXmlWellFormed(xml);
  if (!wellFormed.ok) return { ok: false, error: wellFormed.error };
  return { ok: true, issues: collectXmlStructureIssues(wellFormed.parsed.document) };
}
