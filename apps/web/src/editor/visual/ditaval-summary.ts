import type { EditorView } from 'prosemirror-view';
import {
  evaluateElementConditions,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  type ParsedDitaval,
} from '@dita/core';

export interface DitavalTopicSummary {
  excluded: number;
  flagged: number;
}

/**
 * Count how many topic elements the active DITAVAL would exclude or flag,
 * shown as a compact badge next to the filter name in the visual sub-header.
 */
export function summarizeDitavalTopics(
  ditaval: ParsedDitaval | null,
  view: EditorView | null,
): DitavalTopicSummary | null {
  if (!ditaval || !view) return null;
  let excluded = 0;
  let flagged = 0;
  view.state.doc.descendants((node) => {
    if (!getPmNodeTagName(node)) return true;
    const ev = evaluateElementConditions(getPmNodeRawAttrs(node), ditaval);
    if (ev.status === 'exclude') excluded++;
    else if (ev.status === 'flag') flagged++;
    return true;
  });
  return { excluded, flagged };
}
