import type * as slimdom from 'slimdom';
import { normalizePosixPath, resolveDitaHref } from '../map/path-utils.js';
import { getNodeSourceRange, parseXml } from '../xml/parser.js';
import type { ParsedXmlDocument } from '../xml/types.js';
import type {
  KeyDefinition,
  KeyspaceMapCycle,
  KeyspaceResult,
  ResolvedKeyrefResult,
} from './types.js';

const ELEMENT_NODE = 1;

const NON_KEY_CONTAINER_TAGS = new Set([
  'topicmeta',
  'bookmeta',
  'booktitle',
  'reltable',
  'relheader',
  'relrow',
  'relcell',
  'relcolspec',
]);

function findDirectChild(parent: slimdom.Element, tagName: string): slimdom.Element | null {
  for (const child of parent.childNodes) {
    if (child.nodeType === ELEMENT_NODE && (child as slimdom.Element).tagName === tagName) {
      return child as slimdom.Element;
    }
  }
  return null;
}

function getNormalizedText(el: slimdom.Element | null): string {
  if (!el) return '';
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isSubmapReference(tagName: string, href?: string, format?: string): boolean {
  if (tagName === 'mapref' || format === 'ditamap') return true;
  if (!href) return false;
  return /\.(ditamap|bookmap)(#|$)/i.test(href.trim());
}

function extractInlineKeyText(el: slimdom.Element): {
  text?: string;
  source: KeyDefinition['inlineTextSource'];
} {
  const topicmeta = findDirectChild(el, 'topicmeta');
  if (topicmeta) {
    const keywords = findDirectChild(topicmeta, 'keywords');
    if (keywords) {
      const kw = findDirectChild(keywords, 'keyword');
      const kwText = getNormalizedText(kw);
      if (kwText) return { text: kwText, source: 'keyword' };
    }
    const linktext = findDirectChild(topicmeta, 'linktext');
    const linkTextVal = getNormalizedText(linktext);
    if (linkTextVal) return { text: linkTextVal, source: 'linktext' };

    const metaNavtitle = findDirectChild(topicmeta, 'navtitle');
    const metaNavVal = getNormalizedText(metaNavtitle);
    if (metaNavVal) return { text: metaNavVal, source: 'navtitle' };
  }

  const attrNavtitle = el.getAttribute('navtitle')?.trim();
  if (attrNavtitle) {
    return { text: attrNavtitle, source: 'navtitle' };
  }

  return { source: 'none' };
}

function expandScopePrefixes(
  parentPrefixes: readonly (readonly string[])[],
  rawKeyscope: string | null,
  discoveredScopes: Set<string>,
): string[][] {
  const tokens = rawKeyscope?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length === 0) {
    return parentPrefixes.map((p) => [...p]);
  }

  const next: string[][] = [];
  for (const prefix of parentPrefixes) {
    for (const token of tokens) {
      const combined = [...prefix, token];
      next.push(combined);
      discoveredScopes.add(combined.join('.'));
    }
  }
  return next;
}

interface BfsFrame {
  mapPath: string;
  element: slimdom.Element;
  elementPath: number[];
  scopePrefixes: string[][];
  ancestorMaps: ReadonlySet<string>;
}

/**
 * Build a DITA 1.3 Keyspace starting from `rootMapPath` using:
 * - **Breadth-First Traversal (BFS)** across nested `<topicref>`/`<topicgroup>`/`<mapref>` trees
 * - **First Definition Wins** for duplicate key names at the same qualified scope
 * - **`keyscope` qualification** (`scope.key`, supporting nested scopes and reused sub-maps across scopes)
 */
export function buildKeyspace(
  rootMapPath: string,
  readFile: (posixPath: string) => string | null,
  options: {
    topicTitles?: Record<string, string>;
    getParsedDoc?: (posixPath: string) => ParsedXmlDocument | null;
  } = {},
): KeyspaceResult {
  const normalizedRoot = normalizePosixPath(rootMapPath);
  const keys: Record<string, KeyDefinition> = {};
  const allDefinitions: KeyDefinition[] = [];
  const scopesSet = new Set<string>();
  const referencedTopicsSet = new Set<string>();
  const mapCycles: KeyspaceMapCycle[] = [];

  const loadMapDoc = (mapPath: string): ParsedXmlDocument | null => {
    if (options.getParsedDoc) {
      return options.getParsedDoc(mapPath);
    }
    const xml = readFile(mapPath);
    if (xml === null) return null;
    try {
      return parseXml(xml, { position: true });
    } catch {
      return null;
    }
  };

  const rootDoc = loadMapDoc(normalizedRoot);
  const rootEl = rootDoc?.document.documentElement ?? null;
  if (!rootEl) {
    return {
      rootMapPath: normalizedRoot,
      keys: {},
      allDefinitions: [],
      scopes: [],
      referencedTopics: [],
      mapCycles: [],
    };
  }

  const initialScopes = expandScopePrefixes([[]], rootEl.getAttribute('keyscope'), scopesSet);
  const queue: BfsFrame[] = [
    {
      mapPath: normalizedRoot,
      element: rootEl,
      elementPath: [],
      scopePrefixes: initialScopes,
      ancestorMaps: new Set([normalizedRoot]),
    },
  ];

  while (queue.length > 0) {
    const frame = queue.shift()!;
    let elemIdx = 0;

    for (const childNode of frame.element.childNodes) {
      if (childNode.nodeType !== ELEMENT_NODE) continue;
      const el = childNode as slimdom.Element;
      const currentPath = [...frame.elementPath, elemIdx];
      elemIdx++;

      const nextScopePrefixes = expandScopePrefixes(
        frame.scopePrefixes,
        el.getAttribute('keyscope'),
        scopesSet,
      );

      const href = el.getAttribute('href')?.trim() || undefined;
      const format = el.getAttribute('format')?.trim() || undefined;
      const scopeAttr = el.getAttribute('scope')?.trim() || undefined;
      const processingRole = el.getAttribute('processing-role')?.trim() || undefined;
      const isExternal = scopeAttr === 'external' || scopeAttr === 'peer';
      const submap = !isExternal && isSubmapReference(el.tagName, href, format);

      const range = getNodeSourceRange(el);
      const line = range.open?.line ?? 1;
      const column = range.open?.column ?? 1;

      const resolved = href ? resolveDitaHref(frame.mapPath, href) : null;
      const effectiveExternal = Boolean(isExternal || resolved?.isExternal);
      const localTargetPath =
        resolved && !effectiveExternal && !resolved.escapesRoot && resolved.targetPath
          ? resolved.targetPath
          : undefined;

      if (localTargetPath && !submap) {
        referencedTopicsSet.add(localTargetPath);
      }

      const keysAttr = el.getAttribute('keys')?.trim();
      if (keysAttr) {
        const keyNames = keysAttr.split(/\s+/).filter(Boolean);
        const inline = extractInlineKeyText(el);
        const targetTitle = localTargetPath ? options.topicTitles?.[localTargetPath] : undefined;

        for (const keyName of keyNames) {
          for (const scopeParts of nextScopePrefixes) {
            const scopePrefix = scopeParts.join('.');
            const qualifiedKey = scopePrefix ? `${scopePrefix}.${keyName}` : keyName;

            const def: KeyDefinition = {
              key: keyName,
              qualifiedKey,
              keyscope: scopePrefix || undefined,
              sourceMapPath: frame.mapPath,
              elementPath: currentPath,
              tagName: el.tagName,
              line,
              column,
              href,
              resolvedHref: localTargetPath,
              fragment: resolved?.fragment,
              format,
              scope: scopeAttr,
              processingRole,
              isExternal: effectiveExternal,
              inlineText: inline.text,
              inlineTextSource: inline.source,
              targetTitle,
              shadowedCount: 0,
            };

            allDefinitions.push(def);

            if (!keys[qualifiedKey]) {
              keys[qualifiedKey] = def;
            } else {
              keys[qualifiedKey]!.shadowedCount += 1;
            }
          }
        }
      }

      if (submap && localTargetPath) {
        if (frame.ancestorMaps.has(localTargetPath)) {
          mapCycles.push({
            fromMap: frame.mapPath,
            toMap: localTargetPath,
            line,
            column,
          });
        } else {
          const subDoc = loadMapDoc(localTargetPath);
          const subRoot = subDoc?.document.documentElement ?? null;
          if (subRoot) {
            const subScopePrefixes = expandScopePrefixes(
              nextScopePrefixes,
              subRoot.getAttribute('keyscope'),
              scopesSet,
            );
            const nextAncestors = new Set(frame.ancestorMaps);
            nextAncestors.add(localTargetPath);
            queue.push({
              mapPath: localTargetPath,
              element: subRoot,
              elementPath: [],
              scopePrefixes: subScopePrefixes,
              ancestorMaps: nextAncestors,
            });
          }
        }
        continue;
      }

      if (!NON_KEY_CONTAINER_TAGS.has(el.tagName)) {
        let hasElementChildren = false;
        for (const grandChild of el.childNodes) {
          if (
            grandChild.nodeType === ELEMENT_NODE &&
            !NON_KEY_CONTAINER_TAGS.has((grandChild as slimdom.Element).tagName)
          ) {
            hasElementChildren = true;
            break;
          }
        }
        if (hasElementChildren) {
          queue.push({
            mapPath: frame.mapPath,
            element: el,
            elementPath: currentPath,
            scopePrefixes: nextScopePrefixes,
            ancestorMaps: frame.ancestorMaps,
          });
        }
      }
    }
  }

  return {
    rootMapPath: normalizedRoot,
    keys,
    allDefinitions,
    scopes: Array.from(scopesSet).sort(),
    referencedTopics: Array.from(referencedTopicsSet).sort(),
    mapCycles,
  };
}

/**
 * Resolve a DITA `keyref` value (either `keyName` or `keyName/elementId`, optionally qualified
 * with a `scope.key` prefix) against a built `KeyspaceResult`.
 */
export function resolveKeyrefInKeyspace(
  keyrefValue: string,
  keyspace: KeyspaceResult | null,
  activeScopePath?: readonly string[],
): ResolvedKeyrefResult {
  const trimmed = keyrefValue.trim();
  const slashIdx = trimmed.indexOf('/');
  const keyName = slashIdx >= 0 ? trimmed.slice(0, slashIdx).trim() : trimmed;
  const elementId = slashIdx >= 0 ? trimmed.slice(slashIdx + 1).trim() || undefined : undefined;

  if (!keyName || !keyspace) {
    return {
      keyref: trimmed,
      keyName,
      elementId,
      status: 'unresolved',
      errorMessage: keyName ? `未在当前 Root Map 中找到 Key 定义："${keyName}"` : '空的 keyref 引用',
    };
  }

  let def: KeyDefinition | undefined;

  // DITA 1.3 scope lookup: parent scopes override child scopes for unqualified keys
  if (activeScopePath && activeScopePath.length > 0) {
    for (let len = 0; len <= activeScopePath.length; len++) {
      const prefix = activeScopePath.slice(0, len).join('.');
      const candidate = prefix ? `${prefix}.${keyName}` : keyName;
      if (keyspace.keys[candidate]) {
        def = keyspace.keys[candidate];
        break;
      }
    }
  }

  if (!def) {
    def = keyspace.keys[keyName];
  }

  if (!def) {
    return {
      keyref: trimmed,
      keyName,
      elementId,
      status: 'unresolved',
      errorMessage: `未在当前 Root Map 中找到 Key 定义："${keyName}"`,
    };
  }

  const baseTopicFragment = def.fragment ? def.fragment.split('/')[0] : undefined;
  const targetFragment = elementId
    ? baseTopicFragment
      ? `${baseTopicFragment}/${elementId}`
      : elementId
    : def.fragment;

  return {
    keyref: trimmed,
    keyName,
    elementId,
    status: 'resolved',
    definition: def,
    resolvedText: def.inlineText ?? def.targetTitle,
    targetFilePath: !def.isExternal ? def.resolvedHref : undefined,
    targetFragment,
  };
}
