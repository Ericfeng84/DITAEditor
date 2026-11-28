/**
 * Phase 16 — language families on the Workbench Hub and in the editor header.
 *
 * A translated manual is a real manual in the registry, but it is *not* a separate project: it is
 * an edition of its source manual. Showing both as sibling cards duplicates every project once a
 * second language exists (and buries the original), so the Hub instead renders one card per
 * family and exposes the editions as a language strip inside that card.
 *
 * Phase 16 introduced multi-level lineage (`zh-CN → en-US → ar-SA`), so both projections below walk
 * the *whole* tree rather than one hop. The old one-hop version silently dropped grandchildren: a
 * manual that only appeared as a link target of a target was neither hidden (its parent was in the
 * list and therefore hidden itself, so it never became a visible card) nor attached as a descendant.
 *
 * This module stays pure (no React, no fetch) so ordering can be unit tested without a DOM: the
 * base/source language is always edition `0`, descendants follow depth-first with siblings sorted
 * by target language, and a translated manual whose source is missing from the list keeps its own
 * card (an orphan edition must never disappear just because its source was deleted or archived).
 */
import type { Manual } from '../services/manuals-api.js';
import type { TranslationLinkView } from '../services/translation-api.js';

export interface ManualLanguageEdition {
  lang: string;
  manualId: string;
  branch: string;
  manualName: string;
  isBase: boolean;
  exists: boolean;
  progressPercent?: number | null;
  linkId?: string;
  /** `true` for the edition the current editor session is bound to (header language picker). */
  isCurrent?: boolean;
  /** Metadata of the underlying manual, so the hub card can preview the selected edition. */
  stats?: Manual['stats'];
  lastOpenedAt?: string | null;
  /**
   * Distance from the family root: `0`/omitted for the base edition, `1` for a direct translation,
   * `2+` for a translation of a translation. Optional so existing one-level editions stay
   * byte-compatible with the pre-Phase-16 shape.
   */
  depth?: number;
  /** Target language of the parent edition (`null` for a root). */
  parentLang?: string | null;
  /** Root language followed by every language down to this edition, e.g. `['zh-CN','en-US','ar-SA']`. */
  lineagePath?: string[];
}

/**
 * One node of the family tree as the DFS sees it. `currentBranch` is the registry branch of the
 * underlying manual (used to prefer the link that belongs to the branch being edited), and is
 * `null` for a manual that was inferred from a link rather than loaded from the registry.
 */
interface FamilyNode {
  manualId: string;
  branch: string;
  lang: string;
  manualName: string;
  exists: boolean;
  currentBranch: string | null;
  depth: number;
  pathLangs: string[];
}

function nodeKey(manualId: string, branch: string | null): string {
  return `${manualId}::${branch ?? ''}`;
}

/** Siblings grouped by target language, preferring the link that matches the node's branch. */
function nextLinks(
  links: readonly TranslationLinkView[],
  node: FamilyNode,
): TranslationLinkView[] {
  const byLang = new Map<string, TranslationLinkView>();
  for (const link of links) {
    if (link.sourceManualId !== node.manualId) continue;
    if (link.targetManualId === link.sourceManualId) continue;
    if (!link.targetLang) continue;
    const kept = byLang.get(link.targetLang);
    if (!kept) {
      byLang.set(link.targetLang, link);
      continue;
    }
    const wantedBranch = node.currentBranch;
    const linkMatches = wantedBranch !== null && link.sourceBranch === wantedBranch;
    const keptMatches = wantedBranch !== null && kept.sourceBranch === wantedBranch;
    if (linkMatches && !keptMatches) byLang.set(link.targetLang, link);
  }
  return [...byLang.values()].sort((left, right) => left.targetLang.localeCompare(right.targetLang));
}

/** Incoming links of a node (one per branch), preferring the branch of the session being edited. */
function incomingLink(
  links: readonly TranslationLinkView[],
  manualId: string,
  branch: string | null,
): TranslationLinkView | null {
  const candidates = links.filter(
    (link) => link.targetManualId === manualId && link.sourceManualId !== link.targetManualId,
  );
  if (candidates.length === 0) return null;
  if (branch) {
    const exact = candidates.find((link) => link.targetBranch === branch);
    if (exact) return exact;
  }
  return candidates[0] ?? null;
}

/**
 * Language editions of one manual for the *editor* header, base/source language first.
 *
 * The hub groups the whole registry, but the editor only needs the family around one session:
 * `entryLinks` is already narrowed to the manual's family by the API (either as source or as
 * target), so this is a projection of that one list, not a re-grouping.
 *
 * A translated manual opened as its own session must not be mistaken for a base language: its
 * registry `sourceLang` is the *target* language, so the walk climbs the incoming chain (cycle-safe)
 * to the true family root before descending again. That makes the base edition the real origin and
 * keeps every sibling branch visible from an intermediate node (the old one-hop version hid them).
 */
export function buildSessionLanguageEditions(input: {
  manualId: string;
  branch: string | null;
  manualName: string;
  /** Registry `sourceLang` of the session manual (`null` when unknown). */
  sourceLang: string | null;
  links: readonly TranslationLinkView[];
}): ManualLanguageEdition[] {
  const { manualId, branch, manualName, sourceLang, links } = input;

  const sessionKey = nodeKey(manualId, branch);
  const visited = new Set<string>([sessionKey]);

  // Climb to the true root: the manual at the top of the incoming chain.
  let rootManualId = manualId;
  let rootBranch = branch ?? '';
  let rootName = manualName;
  let rootLang = sourceLang;
  let rootExists = true;
  let climbEdge = incomingLink(links, manualId, branch);
  while (climbEdge) {
    rootManualId = climbEdge.sourceManualId;
    rootBranch = climbEdge.sourceBranch;
    rootName = climbEdge.sourceManual?.name ?? rootName;
    rootExists = climbEdge.sourceManual?.exists ?? true;
    rootLang = climbEdge.sourceLang ?? rootLang;
    const nextKey = nodeKey(rootManualId, rootBranch);
    if (visited.has(nextKey)) break;
    visited.add(nextKey);
    climbEdge = incomingLink(links, rootManualId, rootBranch);
  }

  const rootNode: FamilyNode = {
    manualId: rootManualId,
    branch: rootBranch,
    lang: rootLang ?? '',
    manualName: rootName,
    exists: rootExists,
    currentBranch: rootManualId === manualId ? (branch ?? '') : (rootBranch || null),
    depth: 0,
    pathLangs: rootLang ? [rootLang] : [],
  };

  // A family whose languages nobody knows yet has no editions to offer.
  if (!rootNode.lang) {
    const fallbackLink = links.find(
      (link) => link.sourceManualId === rootManualId && link.sourceLang,
    );
    rootNode.lang = fallbackLink?.sourceLang ?? '';
    rootNode.pathLangs = rootNode.lang ? [rootNode.lang] : [];
    if (!rootNode.lang) return [];
  }

  const editions: ManualLanguageEdition[] = [
    {
      lang: rootNode.lang,
      manualId: rootNode.manualId,
      branch: rootNode.branch,
      manualName: rootNode.manualName,
      isBase: true,
      exists: rootNode.exists,
      isCurrent: rootNode.manualId === manualId && (branch === null || rootNode.branch === branch),
      progressPercent: null,
    },
  ];

  const visitedEditions = new Set<string>([nodeKey(rootNode.manualId, rootNode.branch)]);
  const isSession = (link: TranslationLinkView) =>
    link.targetManualId === manualId && (branch === null || link.targetBranch === branch);

  const walk = (node: FamilyNode) => {
    for (const link of nextLinks(links, node)) {
      const key = nodeKey(link.targetManualId, link.targetBranch);
      if (visitedEditions.has(key)) continue;
      visitedEditions.add(key);
      const pathLangs = [...node.pathLangs, link.targetLang];
      editions.push({
        lang: link.targetLang,
        manualId: link.targetManualId,
        branch: link.targetBranch,
        manualName: link.targetManual?.name ?? node.manualName,
        isBase: false,
        exists: link.targetManual?.exists ?? true,
        isCurrent: isSession(link),
        progressPercent: link.counts?.progressPercent ?? null,
        linkId: link.id,
        depth: node.depth + 1,
        parentLang: node.lang,
        lineagePath: pathLangs,
      });
      walk({
        manualId: link.targetManualId,
        branch: link.targetBranch,
        lang: link.targetLang,
        manualName: link.targetManual?.name ?? node.manualName,
        exists: link.targetManual?.exists ?? true,
        currentBranch: link.targetBranch,
        depth: node.depth + 1,
        pathLangs,
      });
    }
  };

  walk(rootNode);
  return editions;
}

export interface GroupedHubManuals {
  visibleManuals: Manual[];
  editionsByManualId: Map<string, ManualLanguageEdition[]>;
}

/**
 * Collapses translated manuals into the editions of their source manual.
 *
 * - A manual is hidden when some link points at it as `targetManualId` **and** that link's source
 *   manual is part of this list; otherwise the target would vanish from the Hub entirely.
 * - Only true family roots become cards, and every descendant depth is attached to its root so
 *   `zh-CN → en-US → ar-SA` renders all three editions on the `zh-CN` card.
 * - Duplicate targets per `targetLang` are dropped, preferring the link that matches the source
 *   manual's current branch (that is the edition the writer is actually working on).
 */
export function groupHubManualsByLanguageFamily(
  manuals: readonly Manual[],
  links: readonly TranslationLinkView[],
): GroupedHubManuals {
  const manualById = new Map(manuals.map((manual) => [manual.id, manual]));

  const translatedManualIds = new Set<string>();
  for (const link of links) {
    if (link.sourceManualId === link.targetManualId) continue;
    if (!manualById.has(link.sourceManualId)) continue;
    translatedManualIds.add(link.targetManualId);
  }

  const visibleManuals: Manual[] = [];
  const editionsByManualId = new Map<string, ManualLanguageEdition[]>();

  for (const manual of manuals) {
    if (translatedManualIds.has(manual.id)) continue;
    visibleManuals.push(manual);

    const outgoing = links.filter(
      (link) => link.sourceManualId === manual.id && link.targetManualId !== manual.id,
    );

    const editions: ManualLanguageEdition[] = [];
    const baseLang = manual.sourceLang ?? outgoing[0]?.sourceLang ?? null;
    if (baseLang) {
      editions.push({
        lang: baseLang,
        manualId: manual.id,
        branch: manual.currentBranch,
        manualName: manual.name,
        isBase: true,
        exists: manual.exists,
        stats: manual.stats,
        lastOpenedAt: manual.lastOpenedAt,
      });
    }

    const visited = new Set<string>([nodeKey(manual.id, manual.currentBranch)]);
    const walk = (node: FamilyNode) => {
      for (const link of nextLinks(links, node)) {
        const key = nodeKey(link.targetManualId, link.targetBranch);
        if (visited.has(key)) continue;
        visited.add(key);
        const target = manualById.get(link.targetManualId);
        const pathLangs = [...node.pathLangs, link.targetLang];
        editions.push({
          lang: link.targetLang,
          manualId: link.targetManualId,
          branch: link.targetBranch,
          manualName: target?.name ?? link.targetManual?.name ?? manual.name,
          isBase: false,
          exists: target?.exists ?? link.targetManual?.exists ?? true,
          progressPercent: link.counts?.progressPercent,
          linkId: link.id,
          stats: target?.stats,
          lastOpenedAt: target?.lastOpenedAt,
          depth: node.depth + 1,
          parentLang: node.lang,
          lineagePath: pathLangs,
        });
        walk({
          manualId: link.targetManualId,
          branch: link.targetBranch,
          lang: link.targetLang,
          manualName: target?.name ?? link.targetManual?.name ?? manual.name,
          exists: target?.exists ?? link.targetManual?.exists ?? true,
          currentBranch: target?.currentBranch ?? link.targetBranch,
          depth: node.depth + 1,
          pathLangs,
        });
      }
    };
    walk({
      manualId: manual.id,
      branch: manual.currentBranch,
      lang: baseLang ?? '',
      manualName: manual.name,
      exists: manual.exists,
      currentBranch: manual.currentBranch,
      depth: 0,
      pathLangs: baseLang ? [baseLang] : [],
    });

    editionsByManualId.set(manual.id, editions);
  }

  return { visibleManuals, editionsByManualId };
}
