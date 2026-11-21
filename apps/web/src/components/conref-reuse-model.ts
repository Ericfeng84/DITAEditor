import {
  computeRelativeDitaHref,
  type IndexedTopicElement,
  type KeyspaceResult,
  type TopicIdIndexEntry,
} from '@dita/core';

export type ConrefAttrName = 'conref' | 'conkeyref';

/** A Key from the current Root Map that actually points at a local DITA file. */
export interface KeyBoundTopic {
  qualifiedKey: string;
  resolvedHref: string;
}

/**
 * Keys usable as conkeyref targets: must resolve to a local file. External keys (URLs) cannot
 * host reusable DITA elements, so they are filtered out here rather than in the UI.
 */
export function listKeyBoundTopics(keyspace: KeyspaceResult | null): KeyBoundTopic[] {
  if (!keyspace) return [];
  return Object.values(keyspace.keys)
    .filter((k) => Boolean(k.resolvedHref && !k.isExternal))
    .map((k) => ({ qualifiedKey: k.qualifiedKey, resolvedHref: k.resolvedHref as string }))
    .sort((a, b) => a.qualifiedKey.localeCompare(b.qualifiedKey));
}

/**
 * Elements that can be reused from `entry`: everything carrying an `id` except the topic root
 * itself (a topic root is referenced by file, not by fragment). `query` matches element id,
 * tag name or preview text case-insensitively.
 */
export function filterReusableElements(
  entry: TopicIdIndexEntry | undefined,
  query: string,
): IndexedTopicElement[] {
  if (!entry) return [];
  const q = query.trim().toLowerCase();
  return entry.elements.filter((el) => {
    if (el.isTopicRoot) return false;
    if (!q) return true;
    return (
      el.elementId.toLowerCase().includes(q) ||
      el.tagName.toLowerCase().includes(q) ||
      el.previewText.toLowerCase().includes(q)
    );
  });
}

/**
 * The attribute value written to the document:
 *   conkeyref → `<key>/<elementId>` (Key resolution keeps the reference path-independent)
 *   conref    → `<relative-href>#<fragment>`, or `#<fragment>` inside the same file
 */
export function buildReuseAttrValue(options: {
  attrName: ConrefAttrName;
  selectedKey: string;
  target: Pick<IndexedTopicElement, 'filePath' | 'elementId' | 'fragment'> | null;
  activeDocPath: string | null;
}): string {
  const { attrName, selectedKey, target, activeDocPath } = options;
  if (!target) return '';

  if (attrName === 'conkeyref') {
    return selectedKey ? `${selectedKey}/${target.elementId}` : '';
  }

  if (!activeDocPath) return `${target.filePath}#${target.fragment}`;
  const relativeHref =
    target.filePath === activeDocPath
      ? ''
      : computeRelativeDitaHref(activeDocPath, target.filePath);
  return `${relativeHref}#${target.fragment}`;
}
