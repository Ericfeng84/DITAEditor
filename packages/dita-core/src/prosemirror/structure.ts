/**
 * ProseMirror-level DITA content-model structure check (sequence + cardinality).
 *
 * Runs over the live `Doc` and reports violations with ProseMirror positions so the visual
 * editor can decorate offending nodes inline without a round-trip through XML text.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { validateChildSequence, type StructureIssue } from '../model/dita-structure.js';
import { getPmNodeRawAttrs, getPmNodeTagName, isUnknownPmNode } from './helpers.js';

export interface PmStructureIssue extends StructureIssue {
  /** Start position of the offending child; the parent start position for missing children. */
  pos: number;
  /** `nodeSize` of the offending child; `0` for missing children (decorate as a point widget). */
  size: number;
}

interface ChildEntry {
  tag: string;
  pos: number;
  size: number;
}

/**
 * `<step conkeyref="..."/>` and friends carry their content at publish time, so an empty
 * element must not be reported as missing a required child.
 */
function isReusedContent(node: PMNode): boolean {
  const rawAttrs = getPmNodeRawAttrs(node);
  return rawAttrs.some((attr) => attr.name === 'conref' || attr.name === 'conkeyref');
}

/** Direct DITA child tags of a ProseMirror node, skipping comments/PIs/xml text wrappers. */
export function getPmChildTags(node: PMNode): string[] {
  const tags: string[] = [];
  node.forEach((child) => {
    const tag = getPmNodeTagName(child);
    if (tag) tags.push(tag);
  });
  return tags;
}

/**
 * Validate every modeled element in the document against the DITA ordered content models.
 * Unknown / specialized elements are skipped as containers (their children stay lossless).
 */
export function validatePmStructure(doc: PMNode): PmStructureIssue[] {
  const issues: PmStructureIssue[] = [];

  doc.descendants((node, pos) => {
    if (node.isLeaf || isUnknownPmNode(node)) return true;
    const parentTag = getPmNodeTagName(node);
    if (!parentTag) return true;

    const children: ChildEntry[] = [];
    node.forEach((child, offset) => {
      const tag = getPmNodeTagName(child);
      if (tag) children.push({ tag, pos: pos + 1 + offset, size: child.nodeSize });
    });

    const childIssues = validateChildSequence(
      parentTag,
      children.map((child) => child.tag),
      { contentIsReused: isReusedContent(node) },
    );
    for (const issue of childIssues) {
      const target = issue.index === undefined ? undefined : children[issue.index];
      issues.push({
        ...issue,
        pos: target ? target.pos : pos,
        size: target ? target.size : 0,
      });
    }
    return true;
  });

  return issues;
}
