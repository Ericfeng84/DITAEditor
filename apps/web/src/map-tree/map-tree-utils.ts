import {
  checkXmlWellFormed,
  computeRelativeDitaHref,
  DITA_MAP_CONTAINER_NODE_TAGS,
  moveMapNodes,
  parseDitaMap,
  resolveDitaHref,
  transferMapNode,
  type DitaMapTreeNode,
  type ParsedDitaMap,
  type XmlAttributeEntry,
  type XmlParseError,
} from '@dita/core';

export interface MapBufferState {
  path: string;
  baselineXml: string;
  xml: string;
  undoStack: string[];
  redoStack: string[];
  xmlError: XmlParseError | null;
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
  format?: string;
  scope?: string;
  processingRole?: string;
  toc?: string;
  topicType?: string;
  rawAttrs: XmlAttributeEntry[];
  isSubmapRef: boolean;
  resolvedTargetPath?: string;
  targetExists: boolean;
  resolvedTitle?: string;
  isSubmapChild: boolean;
  isCyclicRef?: boolean;
  line?: number;
  column?: number;
  children?: CompositeMapTreeNode[];
}

export interface CompositeMapTreeResult {
  parsedRoot: ParsedDitaMap | null;
  nodes: CompositeMapTreeNode[];
  parseError: XmlParseError | null;
}

/**
 * Build a unified composite tree for `react-arborist` starting from `rootMapPath`,
 * recursively expanding `<mapref>` entries whose target map exists in `mapBuffers`
 * while guarding against circular `<mapref>` cycles.
 */
export function buildCompositeMapTree(
  rootMapPath: string | null,
  mapBuffers: Record<string, { xml: string }>,
  fileSet: ReadonlySet<string>,
  topicTitles: Record<string, string>,
): CompositeMapTreeResult {
  if (!rootMapPath) {
    return { parsedRoot: null, nodes: [], parseError: null };
  }

  const rootBuffer = mapBuffers[rootMapPath];
  if (!rootBuffer) {
    return { parsedRoot: null, nodes: [], parseError: null };
  }

  const check = checkXmlWellFormed(rootBuffer.xml, { position: false });
  if (!check.ok) {
    return { parsedRoot: null, nodes: [], parseError: check.error };
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
    };
  }

  const convertMapNodes = (
    rawNodes: readonly DitaMapTreeNode[],
    ownerMapPath: string,
    instancePrefix: string,
    isSubmapChild: boolean,
    visitedStack: ReadonlySet<string>,
  ): CompositeMapTreeNode[] => {
    return rawNodes.map((node) => {
      const nodeId = `${instancePrefix}${ownerMapPath}::${node.elementPath.join('.')}`;
      const isExternal = node.scope === 'external' || node.scope === 'peer';

      let resolvedTargetPath: string | undefined;
      let targetExists = true;
      let isCyclicRef = false;
      let resolvedTitle: string | undefined;

      if (node.href) {
        const res = resolveDitaHref(ownerMapPath, node.href);
        if (!res.isExternal && !isExternal) {
          resolvedTargetPath = res.targetPath || undefined;
          targetExists = Boolean(!res.escapesRoot && res.targetPath && fileSet.has(res.targetPath));
          if (resolvedTargetPath) {
            resolvedTitle = topicTitles[resolvedTargetPath];
          }
        }
      }

      let children: CompositeMapTreeNode[] | undefined;
      if (node.isSubmapRef && resolvedTargetPath) {
        if (visitedStack.has(resolvedTargetPath)) {
          isCyclicRef = true;
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

      return {
        id: nodeId,
        ownerMapPath,
        elementPath: node.elementPath,
        tagName: node.tagName,
        label: displayLabel,
        href: node.href,
        keys: node.keys,
        keyref: node.keyref,
        navtitle: node.navtitle,
        format: node.format,
        scope: node.scope,
        processingRole: node.processingRole,
        toc: node.toc,
        topicType: node.topicType,
        rawAttrs: node.rawAttrs,
        isSubmapRef: node.isSubmapRef,
        resolvedTargetPath,
        targetExists,
        resolvedTitle,
        isSubmapChild,
        isCyclicRef,
        line: node.line,
        column: node.column,
        children,
      };
    });
  };

  const visited = new Set<string>([rootMapPath]);
  const nodes = convertMapNodes(parsedRoot.nodes, rootMapPath, '', false, visited);

  return {
    parsedRoot,
    nodes,
    parseError: null,
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
          reason: '无法向未加载或断链的 <mapref> 子地图内拖拽节点。',
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
        reason: `<${targetParentNode.tagName}> 不支持包含子节点。`,
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
      return { ok: false, updates: [], reason: '不能将节点拖入其自身或子节点内。' };
    }
    if (subtreeReferencesMap(dragged, targetMapPath)) {
      return { ok: false, updates: [], reason: '不能将子地图引用拖入其自身内部（避免循环引用）。' };
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
