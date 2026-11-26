import { getCurrentLocale, translate } from '../i18n/index.js';
import {
  checkXmlWellFormed,
  computeRelativeDitaHref,
  DITA_MAP_CONTAINER_NODE_TAGS,
  evaluateElementConditions,
  moveMapNodes,
  parseDitaMap,
  resolveDitaHref,
  transferMapNode,
  type DitaMapTreeNode,
  type DitavalDisplayMode,
  type ElementConditionEvaluation,
  type ParsedDitaMap,
  type ParsedDitaval,
  type XmlAttributeEntry,
  type XmlParseError,
} from '@dita/core';

/**
 * Verdict for one `topicref` / `mapref` target.
 *
 * - `ok`       target file exists in the current view (Baseline + caller overlay)
 * - `external` `scope="external|peer"` or an absolute URL — nothing to resolve, never an error
 * - `missing`  a valid workspace-relative `href` whose file has not been created yet (a hint, not an error)
 * - `escaped`  `href` resolves outside the workspace root or is malformed — a real authoring error
 * - `cycle`    `mapref` that re-enters a map already on the expansion stack
 */
export type MapTargetStatus = 'ok' | 'external' | 'missing' | 'escaped' | 'cycle';

export interface MapTargetResolution {
  status: MapTargetStatus;
  /** Workspace-relative target path the `href` points at (undefined for `external`). */
  targetPath?: string;
  /** True only when the target can actually be opened. */
  exists: boolean;
}

/**
 * Single source of truth for “is this map reference healthy?”.
 *
 * The Map Tree row, the Map overview reference list and the missing-target quick fix all call
 * this instead of re-deriving `escapesRoot || !targetPath || !fileSet.has(…)` by hand: a newly
 * saved draft used to be reported as broken in one place and healthy in another.
 */
export function resolveMapTargetStatus(
  mapPath: string,
  href: string,
  fileSet: ReadonlySet<string>,
  scope?: string,
): MapTargetResolution {
  if (scope === 'external' || scope === 'peer') {
    return { status: 'external', exists: true };
  }
  const res = resolveDitaHref(mapPath, href);
  if (res.isExternal) {
    return { status: 'external', exists: true };
  }
  const targetPath = res.targetPath || undefined;
  if (res.escapesRoot) {
    return { status: 'escaped', targetPath, exists: false };
  }
  if (!targetPath) {
    return { status: 'missing', exists: false };
  }
  const exists = fileSet.has(targetPath);
  return { status: exists ? 'ok' : 'missing', targetPath, exists };
}

export interface MapBufferState {
  path: string;
  baselineXml: string;
  xml: string;
  undoStack: string[];
  redoStack: string[];
  xmlError: XmlParseError | null;
  /** Phase 13: hash of the bytes last read from / written to disk (optimistic concurrency). */
  contentHash?: string | null;
}

export interface CompositeMapTreeNode {
  id: string;
  ownerMapPath: string;
  elementPath: number[];
  tagName: string;
  label: string;
  href?: string;
  keys?: string;
  keyref?: string;
  navtitle?: string;
  /** Resolved inline text of a `<keydef>` (`<keyword>`/`<linktext>`), shown as a row preview. */
  inlineText?: string;
  inlineTextSource?: 'keyword' | 'linktext' | 'navtitle' | 'none';
  format?: string;
  scope?: string;
  processingRole?: string;
  toc?: string;
  topicType?: string;
  rawAttrs: XmlAttributeEntry[];
  isSubmapRef: boolean;
  resolvedTargetPath?: string;
  targetExists: boolean;
  /** Fine-grained reason behind `targetExists`, so every surface colours the row identically. */
  targetStatus?: MapTargetStatus;
  resolvedTitle?: string;
  isSubmapChild: boolean;
  isCyclicRef?: boolean;
  line?: number;
  column?: number;
  conditionEval?: ElementConditionEvaluation;
  isExcluded?: boolean;
  profilingSummary?: { name: string; values: string[] }[];
  children?: CompositeMapTreeNode[];
}

export interface CompositeMapTreeResult {
  parsedRoot: ParsedDitaMap | null;
  nodes: CompositeMapTreeNode[];
  parseError: XmlParseError | null;
  hiddenCount: number;
  excludedCount: number;
  flaggedCount: number;
}

export interface BuildCompositeMapTreeOptions {
  ditaval?: ParsedDitaval | null;
  ditavalDisplayMode?: DitavalDisplayMode;
  /**
   * Root-element topic type of each workspace file. When a `topicref` does not declare its
   * own `type=` attribute, the real type of the referenced file drives the row icon.
   */
  topicTypes?: Record<string, string>;
}

/**
 * Build a unified composite tree for `react-arborist` starting from `rootMapPath`,
 * recursively expanding `<mapref>` entries whose target map exists in `mapBuffers`
 * while guarding against circular `<mapref>` cycles and projecting active DITAVAL conditions.
 */
export function buildCompositeMapTree(
  rootMapPath: string | null,
  mapBuffers: Record<string, { xml: string }>,
  fileSet: ReadonlySet<string>,
  topicTitles: Record<string, string>,
  options: BuildCompositeMapTreeOptions = {},
): CompositeMapTreeResult {
  const ditaval = options.ditaval ?? null;
  const ditavalDisplayMode = options.ditavalDisplayMode ?? 'dim-excluded';
  const topicTypes = options.topicTypes;

  if (!rootMapPath) {
    return {
      parsedRoot: null,
      nodes: [],
      parseError: null,
      hiddenCount: 0,
      excludedCount: 0,
      flaggedCount: 0,
    };
  }

  const rootBuffer = mapBuffers[rootMapPath];
  if (!rootBuffer) {
    return {
      parsedRoot: null,
      nodes: [],
      parseError: null,
      hiddenCount: 0,
      excludedCount: 0,
      flaggedCount: 0,
    };
  }

  const check = checkXmlWellFormed(rootBuffer.xml, { position: false });
  if (!check.ok) {
    return {
      parsedRoot: null,
      nodes: [],
      parseError: check.error,
      hiddenCount: 0,
      excludedCount: 0,
      flaggedCount: 0,
    };
  }

  let parsedRoot: ParsedDitaMap;
  try {
    parsedRoot = parseDitaMap(rootBuffer.xml);
  } catch (err) {
    return {
      parsedRoot: null,
      nodes: [],
      parseError: {
        message: err instanceof Error ? err.message : String(err),
        line: 1,
        column: 1,
        offset: 0,
      },
      hiddenCount: 0,
      excludedCount: 0,
      flaggedCount: 0,
    };
  }

  let hiddenCount = 0;
  let excludedCount = 0;
  let flaggedCount = 0;

  const rootEval = evaluateElementConditions(parsedRoot.rootAttrs, ditaval);
  const rootExcluded = rootEval.status === 'exclude';

  const convertMapNodes = (
    rawNodes: readonly DitaMapTreeNode[],
    ownerMapPath: string,
    instancePrefix: string,
    isSubmapChild: boolean,
    visitedStack: ReadonlySet<string>,
    inheritedExcluded: boolean,
  ): CompositeMapTreeNode[] => {
    const out: CompositeMapTreeNode[] = [];

    for (const node of rawNodes) {
      const nodeId = `${instancePrefix}${ownerMapPath}::${node.elementPath.join('.')}`;

      const condEval = evaluateElementConditions(node.rawAttrs, ditaval);
      const isExcluded = inheritedExcluded || condEval.status === 'exclude';
      if (isExcluded) excludedCount++;
      else if (condEval.status === 'flag') flaggedCount++;

      if (isExcluded && ditaval && ditavalDisplayMode === 'hide-excluded') {
        hiddenCount++;
        continue;
      }

      const profilingSummary = Object.entries(condEval.presentAttrs).map(([name, values]) => ({
        name,
        values: values ?? [],
      }));

      let resolvedTargetPath: string | undefined;
      let targetExists = true;
      let targetStatus: MapTargetStatus | undefined;
      let isCyclicRef = false;
      let resolvedTitle: string | undefined;

      if (node.href) {
        const resolution = resolveMapTargetStatus(ownerMapPath, node.href, fileSet, node.scope);
        targetStatus = resolution.status;
        resolvedTargetPath = resolution.targetPath;
        targetExists = resolution.exists;
        if (resolvedTargetPath) {
          resolvedTitle = topicTitles[resolvedTargetPath];
        }
      }

      let children: CompositeMapTreeNode[] | undefined;
      if (node.isSubmapRef && resolvedTargetPath) {
        if (visitedStack.has(resolvedTargetPath)) {
          isCyclicRef = true;
          targetStatus = 'cycle';
        } else if (targetExists && mapBuffers[resolvedTargetPath]) {
          try {
            const subParsed = parseDitaMap(mapBuffers[resolvedTargetPath]!.xml);
            const nextVisited = new Set(visitedStack);
            nextVisited.add(resolvedTargetPath);
            children = convertMapNodes(
              subParsed.nodes,
              resolvedTargetPath,
              `${nodeId}>>`,
              true,
              nextVisited,
              isExcluded,
            );
          } catch {
            children = undefined;
          }
        }
      } else if (node.children) {
        children = convertMapNodes(
          node.children,
          ownerMapPath,
          instancePrefix,
          isSubmapChild,
          visitedStack,
          isExcluded,
        );
      } else if (DITA_MAP_CONTAINER_NODE_TAGS.has(node.tagName)) {
        children = [];
      }

      // Prefer explicit navtitle/label; if label fell back to raw href, show resolved topic title
      const displayLabel =
        node.navtitle ||
        (node.keys ? `key: ${node.keys}` : '') ||
        resolvedTitle ||
        node.label;

      out.push({
        id: nodeId,
        ownerMapPath,
        elementPath: node.elementPath,
        tagName: node.tagName,
        label: displayLabel,
        href: node.href,
        keys: node.keys,
        keyref: node.keyref,
        navtitle: node.navtitle,
        inlineText: node.inlineText,
        inlineTextSource: node.inlineTextSource,
        format: node.format,
        scope: node.scope,
        processingRole: node.processingRole,
        toc: node.toc,
        topicType:
          node.topicType ??
          (resolvedTargetPath ? topicTypes?.[resolvedTargetPath] : undefined),
        rawAttrs: node.rawAttrs,
        isSubmapRef: node.isSubmapRef,
        resolvedTargetPath,
        targetExists,
        targetStatus,
        resolvedTitle,
        isSubmapChild,
        isCyclicRef,
        line: node.line,
        column: node.column,
        conditionEval: condEval,
        isExcluded,
        profilingSummary: profilingSummary.length > 0 ? profilingSummary : undefined,
        children,
      });
    }

    return out;
  };

  const visited = new Set<string>([rootMapPath]);
  const nodes = convertMapNodes(parsedRoot.nodes, rootMapPath, '', false, visited, rootExcluded);

  return {
    parsedRoot,
    nodes,
    parseError: null,
    hiddenCount,
    excludedCount,
    flaggedCount,
  };
}

function isSameOrDescendantPath(ancestor: readonly number[], candidate: readonly number[]): boolean {
  if (ancestor.length > candidate.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== candidate[i]) return false;
  }
  return true;
}

function subtreeReferencesMap(node: CompositeMapTreeNode, targetMapPath: string): boolean {
  if (node.isSubmapRef && node.resolvedTargetPath === targetMapPath) {
    return true;
  }
  return Boolean(node.children?.some((child) => subtreeReferencesMap(child, targetMapPath)));
}

export interface PlannedMapMoveResult {
  ok: boolean;
  updates: { mapPath: string; xml: string }[];
  reason?: string;
}

/**
 * Plan and execute a drag-and-drop move on the composite Map Tree, supporting both
 * same-map reordering/reparenting and cross-map subtree transfers (with automatic POSIX `href` rewriting).
 */
export function planMapNodeMove(options: {
  rootMapPath: string;
  dragNodes: CompositeMapTreeNode[];
  targetParentNode: CompositeMapTreeNode | null;
  targetIndex: number;
  mapBuffers: Record<string, { xml: string }>;
}): PlannedMapMoveResult {
  const { rootMapPath, dragNodes, targetParentNode, targetIndex, mapBuffers } = options;
  if (dragNodes.length === 0) {
    return { ok: false, updates: [] };
  }

  // Determine destination map & DOM parent path
  let targetMapPath = rootMapPath;
  let targetParentPath: number[] | null = null;

  if (targetParentNode) {
    if (targetParentNode.isSubmapRef) {
      if (!targetParentNode.resolvedTargetPath || !mapBuffers[targetParentNode.resolvedTargetPath]) {
        return {
          ok: false,
          updates: [],
          reason: translate(getCurrentLocale(), 'mapDnd.notLoaded'),
        };
      }
      targetMapPath = targetParentNode.resolvedTargetPath;
      targetParentPath = null;
    } else if (DITA_MAP_CONTAINER_NODE_TAGS.has(targetParentNode.tagName)) {
      targetMapPath = targetParentNode.ownerMapPath;
      targetParentPath = targetParentNode.elementPath;
    } else {
      return {
        ok: false,
        updates: [],
        reason: translate(getCurrentLocale(), 'mapDnd.noChildren', { tag: targetParentNode.tagName }),
      };
    }
  }

  const targetBuffer = mapBuffers[targetMapPath];
  if (!targetBuffer) {
    return { ok: false, updates: [] };
  }

  // Filter out dragged nodes whose ancestor is also dragged
  const dragIds = new Set(dragNodes.map((n) => n.id));
  const topDragged = dragNodes.filter((node) => {
    for (const other of dragNodes) {
      if (other.id === node.id) continue;
      if (
        other.ownerMapPath === node.ownerMapPath &&
        isSameOrDescendantPath(other.elementPath, node.elementPath)
      ) {
        return false;
      }
    }
    return dragIds.has(node.id);
  });

  // Guard against dragging a node into itself / descendant or creating submap cycles
  for (const dragged of topDragged) {
    if (
      targetParentNode &&
      dragged.ownerMapPath === targetMapPath &&
      targetParentPath &&
      isSameOrDescendantPath(dragged.elementPath, targetParentPath)
    ) {
      return { ok: false, updates: [], reason: translate(getCurrentLocale(), 'mapDnd.self') };
    }
    if (subtreeReferencesMap(dragged, targetMapPath)) {
      return { ok: false, updates: [], reason: translate(getCurrentLocale(), 'mapDnd.cycle') };
    }
  }

  // Case A: all dragged nodes belong to `targetMapPath` -> atomic single-DOM move
  if (topDragged.every((n) => n.ownerMapPath === targetMapPath)) {
    const res = moveMapNodes(
      targetBuffer.xml,
      topDragged.map((n) => n.elementPath),
      targetParentPath,
      targetIndex,
    );
    if (!res.moved) return { ok: false, updates: [] };
    return {
      ok: true,
      updates: [{ mapPath: targetMapPath, xml: res.xml }],
    };
  }

  // Case B: cross-map move (single or sequential transfer with relative href rewriting)
  const workingBuffers: Record<string, string> = {};
  for (const [p, buf] of Object.entries(mapBuffers)) {
    workingBuffers[p] = buf.xml;
  }

  // Process from deepest/reverse index in source maps so earlier sibling removals don't shift later paths
  const ordered = [...topDragged].sort((a, b) => {
    if (a.ownerMapPath !== b.ownerMapPath) {
      return a.ownerMapPath.localeCompare(b.ownerMapPath);
    }
    const len = Math.min(a.elementPath.length, b.elementPath.length);
    for (let i = 0; i < len; i++) {
      if (a.elementPath[i] !== b.elementPath[i]) {
        return b.elementPath[i]! - a.elementPath[i]!;
      }
    }
    return b.elementPath.length - a.elementPath.length;
  });

  const touchedMaps = new Set<string>();
  let insertOffset = targetIndex;

  for (const node of ordered) {
    const srcXml = workingBuffers[node.ownerMapPath];
    const dstXml = workingBuffers[targetMapPath];
    if (!srcXml || !dstXml) continue;

    if (node.ownerMapPath === targetMapPath) {
      const moved = moveMapNodes(dstXml, [node.elementPath], targetParentPath, insertOffset);
      if (moved.moved) {
        workingBuffers[targetMapPath] = moved.xml;
        touchedMaps.add(targetMapPath);
        insertOffset++;
      }
    } else {
      const res = transferMapNode(
        srcXml,
        node.elementPath,
        dstXml,
        targetParentPath,
        insertOffset,
        (href) => {
          const resolved = resolveDitaHref(node.ownerMapPath, href);
          if (resolved.isExternal || resolved.escapesRoot || !resolved.targetPath) {
            return href;
          }
          const rel = computeRelativeDitaHref(targetMapPath, resolved.targetPath);
          return resolved.fragment ? `${rel}#${resolved.fragment}` : rel;
        },
      );
      if (res.moved) {
        workingBuffers[node.ownerMapPath] = res.sourceXml;
        workingBuffers[targetMapPath] = res.targetXml;
        touchedMaps.add(node.ownerMapPath);
        touchedMaps.add(targetMapPath);
        insertOffset++;
      }
    }
  }

  if (touchedMaps.size === 0) {
    return { ok: false, updates: [] };
  }

  return {
    ok: true,
    updates: Array.from(touchedMaps).map((mapPath) => ({
      mapPath,
      xml: workingBuffers[mapPath]!,
    })),
  };
}

/**
 * Find all unique directory paths present in a workspace file tree.
 */
export function collectWorkspaceDirectoryPaths(
  nodes: { path: string; kind: string; children?: unknown[] }[],
): string[] {
  const dirs: string[] = [''];
  const walk = (list: { path: string; kind: string; children?: unknown[] }[]) => {
    for (const item of list) {
      if (item.kind === 'directory') {
        dirs.push(item.path);
        if (Array.isArray(item.children)) {
          walk(item.children as { path: string; kind: string; children?: unknown[] }[]);
        }
      }
    }
  };
  walk(nodes);
  return dirs;
}

/**
 * Collect all file paths matching any of the given DITA file kinds from a workspace file tree.
 */
export function collectWorkspaceFilesByKind(
  nodes: { path: string; kind: string; children?: unknown[] }[],
  kinds: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const walk = (list: { path: string; kind: string; children?: unknown[] }[]) => {
    for (const item of list) {
      if (item.kind === 'directory') {
        if (Array.isArray(item.children)) {
          walk(item.children as { path: string; kind: string; children?: unknown[] }[]);
        }
      } else if (kinds.has(item.kind)) {
        out.push(item.path);
      }
    }
  };
  walk(nodes);
  return out.sort();
}
