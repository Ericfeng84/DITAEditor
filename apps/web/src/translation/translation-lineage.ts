/**
 * Phase 16 — multi-level translation lineage kernel.
 *
 * A translation family is a forest of directed edges (`source_manual` → `target_manual`) whose
 * shape the database already keeps tree-like: a target manual has one incoming edge per branch, so
 * `zh-CN → en-US → ar-SA` and `zh-CN → es-ES` are two branches of one root.
 *
 * Everything here is pure (no React, no fetch) and derived from the flat link list the API returns
 * for the whole family, which keeps the left lineage tree, the add-target dialog, the settings tab
 * and the unit tests on one shared projection:
 *
 * - `orderedLinks` is a depth-first walk with siblings sorted by target language, so rendering it
 *   in order yields the tree without any further sorting.
 * - `linkMetaById` answers the two cross-level questions the UI cannot answer per link: "which
 *   ancestors still need syncing?" (Q4) and "which languages hang below this node?" (Q5).
 * - `familyLangs` is the lowercase, normalized language set used to grey out already taken
 *   languages in the derive dialog (Q3), so a family can never contain `ar-SA` twice.
 *
 * The builder is cycle-safe: the API rejects cycles on write, but a hand-edited or legacy database
 * must not hang the workbench, so every walk carries a visited set and unreachable nodes are
 * promoted to their own root instead of disappearing.
 */
import type { TranslationLinkView } from '../services/translation-api.js';

/** A manual version (one branch of one manual) inside a translation family tree. */
export interface TranslationLineageNode {
  manualId: string;
  branch: string | null;
  lang: string | null;
  manualName: string | null;
  /** `0` for a family root, `1` for its direct translations, `2+` for derived translations. */
  depth: number;
  /** Root language followed by every language on the way down, e.g. `['zh-CN','en-US']`. */
  pathLangs: string[];
  parentManualId: string | null;
  /** Links whose target is this node (one per target branch). */
  incomingLinkIds: string[];
  /** Links whose source is this node, DFS ordered. */
  childLinkIds: string[];
  exists: boolean;
  isEntry: boolean;
}

/** Depth-first facts about one link, keyed by link id. */
export interface TranslationLinkLineageMeta {
  depth: number;
  /** `['zh-CN','en-US','ar-SA']` for the `en-US → ar-SA` link of `zh-CN → en-US → ar-SA`. */
  pathLangs: string[];
  /** Root-most first links leading to this link's source node (empty for a depth-1 link). */
  ancestorLinks: TranslationLinkView[];
  /** Every link below this link's target node. */
  descendantLinks: TranslationLinkView[];
  /** Every descendant target language, DFS ordered and de-duplicated. */
  descendantLangs: string[];
  /** Ancestors whose target is not fully synced (`counts.total > counts.synced`), per Q4. */
  upstreamPending: TranslationLinkView[];
}

/** One selectable parent in the derive dialog (Q1: any node may spawn a child language). */
export interface TranslationLineageSourceOption {
  manualId: string;
  branch: string | null;
  lang: string | null;
  manualName: string | null;
  depth: number;
  pathLangs: string[];
  progressPercent: number | null;
}

export interface TranslationLineageModel {
  roots: TranslationLineageNode[];
  nodeByManualId: Map<string, TranslationLineageNode>;
  linkMetaById: Map<string, TranslationLinkLineageMeta>;
  orderedLinks: TranslationLinkView[];
  /** Lowercase BCP 47 tags used anywhere in the family (roots included), per Q3. */
  familyLangs: Set<string>;
  sourceCandidates: TranslationLineageSourceOption[];
  /** `0` no link, `1` single-level star, `>= 2` multi-level lineage. */
  maxDepth: number;
}

export interface BuildTranslationLineageInput {
  links: readonly TranslationLinkView[];
  entryManualId: string;
  entryManualName?: string | null;
  entrySourceLang?: string | null;
  entryBranch?: string | null;
}

interface LineageNodeSeed {
  manualId: string;
  branch: string | null;
  lang: string | null;
  manualName: string | null;
  exists: boolean;
}

function nodeKey(manualId: string, branch: string | null | undefined): string {
  return `${manualId}::${branch ?? ''}`;
}

function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function isPending(link: TranslationLinkView): boolean {
  return (link.counts?.total ?? 0) > (link.counts?.synced ?? 0);
}

function languageKey(lang: string | null | undefined): string | null {
  const trimmed = (lang ?? '').trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function compareLinks(left: TranslationLinkView, right: TranslationLinkView): number {
  return (
    left.targetLang.localeCompare(right.targetLang) ||
    left.targetManualId.localeCompare(right.targetManualId) ||
    left.targetBranch.localeCompare(right.targetBranch)
  );
}

function compareNodes(left: TranslationLineageNode, right: TranslationLineageNode): number {
  return (
    (left.lang ?? '').localeCompare(right.lang ?? '') ||
    left.manualId.localeCompare(right.manualId) ||
    (left.branch ?? '').localeCompare(right.branch ?? '')
  );
}

/**
 * Projects the flat family link list into the tree the whole translation UI navigates.
 *
 * Siblings are sorted by `targetLang` so `orderedLinks` is already the depth-first render order;
 * roots are ordered with the entry manual's own family first, which is what makes opening the
 * translation center from any node land on the most relevant branch.
 */
export function buildTranslationLineage(
  input: BuildTranslationLineageInput,
): TranslationLineageModel {
  const {
    links,
    entryManualId,
    entryManualName = null,
    entrySourceLang = null,
    entryBranch = null,
  } = input;

  const linksBySource = new Map<string, TranslationLinkView[]>();
  const linksByTarget = new Map<string, TranslationLinkView[]>();
  const nodeSeeds = new Map<string, LineageNodeSeed>();

  const rememberNode = (
    manualId: string,
    branch: string | null,
    lang: string | null,
    manualName: string | null,
    exists: boolean,
  ) => {
    const key = nodeKey(manualId, branch);
    if (!nodeSeeds.has(key)) nodeSeeds.set(key, { manualId, branch, lang, manualName, exists });
  };

  for (const link of links) {
    // A self-edge cannot be part of a family tree; ignoring it also keeps the DFS honest.
    if (link.sourceManualId === link.targetManualId && link.sourceBranch === link.targetBranch) {
      continue;
    }
    pushInto(linksBySource, nodeKey(link.sourceManualId, link.sourceBranch), link);
    pushInto(linksByTarget, nodeKey(link.targetManualId, link.targetBranch), link);
    rememberNode(
      link.sourceManualId,
      link.sourceBranch,
      link.sourceLang,
      link.sourceManual?.name ?? null,
      link.sourceManual?.exists ?? true,
    );
    rememberNode(
      link.targetManualId,
      link.targetBranch,
      link.targetLang,
      link.targetManual?.name ?? null,
      link.targetManual?.exists ?? true,
    );
  }

  // The entry manual is always present, even before its first target language exists.
  const entryKey = nodeKey(entryManualId, entryBranch);
  if (!nodeSeeds.has(entryKey)) {
    rememberNode(entryManualId, entryBranch, entrySourceLang, entryManualName, true);
  }

  for (const list of linksBySource.values()) list.sort(compareLinks);

  const nodeByManualId = new Map<string, TranslationLineageNode>();
  const nodesByKey = new Map<string, TranslationLineageNode>();
  const linkMetaById = new Map<string, TranslationLinkLineageMeta>();
  const orderedLinks: TranslationLinkView[] = [];
  const familyLangs = new Set<string>();
  const sourceCandidates: TranslationLineageSourceOption[] = [];
  const visitedNodes = new Set<string>();
  const visitedLinks = new Set<string>();

  const walk = (
    currentKey: string,
    depth: number,
    pathLangs: string[],
    ancestorLinks: TranslationLinkView[],
    parentManualId: string | null,
    incoming: TranslationLinkView | null,
  ): TranslationLineageNode | null => {
    const seed = nodeSeeds.get(currentKey);
    if (!seed) return null;

    const node: TranslationLineageNode = {
      manualId: seed.manualId,
      branch: seed.branch,
      lang: seed.lang,
      manualName: seed.manualName,
      depth,
      pathLangs,
      parentManualId,
      incomingLinkIds: (linksByTarget.get(currentKey) ?? []).map((link) => link.id),
      childLinkIds: [],
      exists: seed.exists,
      isEntry: seed.manualId === entryManualId,
    };
    nodesByKey.set(currentKey, node);
    if (!nodeByManualId.has(seed.manualId) || seed.manualId === entryManualId) {
      nodeByManualId.set(seed.manualId, node);
    }
    const normalisedLang = languageKey(seed.lang);
    if (normalisedLang) familyLangs.add(normalisedLang);
    sourceCandidates.push({
      manualId: seed.manualId,
      branch: seed.branch,
      lang: seed.lang,
      manualName: seed.manualName,
      depth,
      pathLangs,
      progressPercent: incoming?.counts?.progressPercent ?? null,
    });

    for (const link of linksBySource.get(currentKey) ?? []) {
      node.childLinkIds.push(link.id);
      if (visitedLinks.has(link.id)) continue;
      visitedLinks.add(link.id);
      orderedLinks.push(link);

      const linkPathLangs = [...pathLangs, link.targetLang];
      linkMetaById.set(link.id, {
        depth: depth + 1,
        pathLangs: linkPathLangs,
        ancestorLinks: [...ancestorLinks],
        descendantLinks: [],
        descendantLangs: [],
        upstreamPending: ancestorLinks.filter(isPending),
      });

      const normalisedTarget = languageKey(link.targetLang);
      if (normalisedTarget) familyLangs.add(normalisedTarget);
      const normalisedSource = languageKey(link.sourceLang);
      if (normalisedSource) familyLangs.add(normalisedSource);

      const childKey = nodeKey(link.targetManualId, link.targetBranch);
      // A link that would revisit a node is a cycle: keep it visible but never descend again.
      if (visitedNodes.has(childKey)) continue;
      visitedNodes.add(childKey);

      walk(
        childKey,
        depth + 1,
        linkPathLangs,
        [...ancestorLinks, link],
        seed.manualId,
        link,
      );
    }

    return node;
  };

  const rootKeys: string[] = [];
  for (const key of nodeSeeds.keys()) {
    if ((linksByTarget.get(key) ?? []).length === 0) rootKeys.push(key);
  }

  const roots: TranslationLineageNode[] = [];
  const visitRoot = (key: string) => {
    if (visitedNodes.has(key)) return;
    visitedNodes.add(key);
    // The root language belongs to every path below it, so the DFS starts with it.
    const rootLang = nodeSeeds.get(key)?.lang;
    const node = walk(key, 0, rootLang ? [rootLang] : [], [], null, null);
    if (node) roots.push(node);
  };

  for (const key of rootKeys) visitRoot(key);
  // Cycle fallback: any node the roots could not reach becomes the root of its own component.
  for (const key of nodeSeeds.keys()) visitRoot(key);

  // Put the entry manual's own family first; the rest stay in discovery order.
  roots.sort((left, right) => {
    const leftIsEntry = left.manualId === entryManualId ? 0 : 1;
    const rightIsEntry = right.manualId === entryManualId ? 0 : 1;
    return leftIsEntry - rightIsEntry || compareNodes(left, right);
  });

  // Descendant facts are a pure post-order over the node tree, memoized per link.
  const descendantsOfNode = new Map<string, { links: TranslationLinkView[]; langs: string[] }>();
  const linksById = new Map(links.map((link) => [link.id, link]));

  const collectNode = (key: string, guard: Set<string>): TranslationLinkView[] => {
    const cached = descendantsOfNode.get(key);
    if (cached) return cached.links;
    const node = nodesByKey.get(key);
    if (!node || guard.has(key)) return [];
    guard.add(key);
    const collected: TranslationLinkView[] = [];
    for (const linkId of node.childLinkIds) {
      const link = linksById.get(linkId);
      if (!link) continue;
      collected.push(link);
      collected.push(...collectNode(nodeKey(link.targetManualId, link.targetBranch), guard));
    }
    descendantsOfNode.set(key, { links: collected, langs: [] });
    return collected;
  };

  for (const [linkId, meta] of linkMetaById) {
    const link = linksById.get(linkId);
    if (!link) continue;
    const subtree = collectNode(nodeKey(link.targetManualId, link.targetBranch), new Set());
    meta.descendantLinks = subtree;
    const langs: string[] = [];
    for (const descendant of subtree) {
      if (!langs.includes(descendant.targetLang)) langs.push(descendant.targetLang);
    }
    meta.descendantLangs = langs;
  }

  const maxDepth = orderedLinks.reduce(
    (max, link) => Math.max(max, linkMetaById.get(link.id)?.depth ?? 0),
    0,
  );

  return {
    roots,
    nodeByManualId,
    linkMetaById,
    orderedLinks,
    familyLangs,
    sourceCandidates,
    maxDepth,
  };
}

/**
 * Picks the pair the center should show, most specific first: the URL, then the entry manual as a
 * translation source, then its incoming pair, then the first DFS link.
 */
export function pickDefaultActiveLink(
  links: readonly TranslationLinkView[],
  lineage: TranslationLineageModel,
  entryManualId: string,
  requestedLinkId: string | null | undefined,
): TranslationLinkView | null {
  if (requestedLinkId) {
    const requested = links.find((link) => link.id === requestedLinkId);
    if (requested) return requested;
  }
  // The API returns the family in creation order, which keeps the oldest pair selected on first
  // visit; only the last-resort fallback uses the DFS order.
  const outgoing = links.find((link) => link.sourceManualId === entryManualId);
  if (outgoing) return outgoing;
  const incoming = links.find((link) => link.targetManualId === entryManualId);
  if (incoming) return incoming;
  return lineage.orderedLinks[0] ?? links[0] ?? null;
}
