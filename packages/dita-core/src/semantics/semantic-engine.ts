import { coreT } from '../i18n/messages.js';
import type { UiLocale } from '../i18n/locale.js';
import type * as slimdom from 'slimdom';
import {
  DITA_PROFILING_ATTRS,
  parseDitaval,
  type DitaProfilingAttrName,
  type ParsedDitaval,
} from '../ditaval/ditaval.js';
import { parseDitaMap } from '../map/dita-map.js';
import { classifyDitaFileKind, normalizePosixPath, resolveDitaHref } from '../map/path-utils.js';
import { DITA_TOPIC_ROOT_TAGS } from '../model/dita-elements.js';
import { checkXmlWellFormed, getNodeSourceRange, parseXml } from '../xml/parser.js';
import { collectXmlStructureIssues } from '../xml/structure-check.js';
import { formatStructureIssue } from '../model/dita-structure.js';
import type { ParsedXmlDocument, XmlParseError } from '../xml/types.js';
import { findConrefUsages, findKeyrefUsages } from '../xml/xpath.js';
import { indexTopicElements, resolveConrefReference } from './conref.js';
import { buildKeyspace, resolveKeyrefInKeyspace } from './keyspace.js';
import {
  makeConrefOverlayKey,
  type DocumentSemanticOverlay,
  type KeyspaceResult,
  type ResolvedConrefResult,
  type ResolvedKeyrefResult,
  type SemanticDiagnostic,
  type TopicIdIndexEntry,
} from './types.js';

const ELEMENT_NODE = 1;

function findEnclosingTopicInfo(el: slimdom.Element): {
  topicId?: string;
  elementId?: string;
} {
  const elementId = el.getAttribute('id')?.trim() || undefined;
  let curr: slimdom.Node | null = el;
  while (curr && curr.nodeType === ELEMENT_NODE) {
    const currEl = curr as slimdom.Element;
    if (DITA_TOPIC_ROOT_TAGS.has(currEl.tagName)) {
      const topicId = currEl.getAttribute('id')?.trim() || undefined;
      if (topicId) return { topicId, elementId };
    }
    curr = currEl.parentNode;
  }
  const fallbackTopicId = el.ownerDocument?.documentElement?.getAttribute('id')?.trim() || undefined;
  return { topicId: fallbackTopicId, elementId };
}

/**
 * Isomorphic incremental DITA 1.3 semantic indexer supporting:
 * - BFS Keyspace (`keydef`/`keyref` + `keyscope`)
 * - Topic ID indexing & profiling token catalog
 * - DFS cycle-safe `conref` / `conkeyref` resolution
 * - `.ditaval` caching
 * - Unified cross-file semantic diagnostics
 */
export class DitaSemanticIndex {
  private readonly fileContents = new Map<string, string>();
  private readonly parsedDocs = new Map<string, ParsedXmlDocument | null>();
  private readonly xmlErrors = new Map<string, XmlParseError>();
  private readonly topicIndices = new Map<string, TopicIdIndexEntry>();
  private readonly parsedDitavals = new Map<
    string,
    { ok: true; parsed: ParsedDitaval } | { ok: false; error: XmlParseError }
  >();
  private readonly keyspaceCache = new Map<string, KeyspaceResult>();
  private profilingCatalogCache: Record<DitaProfilingAttrName, string[]> | null = null;
  /** UI locale used for every diagnostic message this index emits. */
  private uiLocale: UiLocale = 'zh-CN';

  /** Switch the message locale without invalidating any cached parse/keyspace data. */
  setUiLocale(locale: UiLocale): void {
    this.uiLocale = locale;
  }

  getUiLocale(): UiLocale {
    return this.uiLocale;
  }

  /**
   * Bulk-load a complete workspace map of POSIX paths -> XML text contents.
   */
  loadFiles(files: Record<string, string>): void {
    this.fileContents.clear();
    this.parsedDocs.clear();
    this.xmlErrors.clear();
    this.topicIndices.clear();
    this.parsedDitavals.clear();
    this.keyspaceCache.clear();
    this.profilingCatalogCache = null;

    for (const [rawPath, content] of Object.entries(files)) {
      const norm = normalizePosixPath(rawPath);
      if (!norm) continue;
      this.fileContents.set(norm, content);
      this.indexSingleFile(norm, content);
    }
  }

  /**
   * Incrementally update or add a single file without rescanning unchanged workspace files.
   */
  updateFile(filePath: string, content: string): { changed: boolean; invalidatedKeyspaces: boolean } {
    const norm = normalizePosixPath(filePath);
    if (!norm) return { changed: false, invalidatedKeyspaces: false };

    const prev = this.fileContents.get(norm);
    if (prev === content) {
      return { changed: false, invalidatedKeyspaces: false };
    }

    this.fileContents.set(norm, content);
    this.indexSingleFile(norm, content);
    this.profilingCatalogCache = null;

    const kind = classifyDitaFileKind(norm);
    const invalidatedKeyspaces =
      kind === 'ditamap' || kind === 'bookmap' || this.isTitleReferencedChange(norm);
    // Invalidate keyspaces when any map changes or when any topic title may have changed
    if (invalidatedKeyspaces || kind === 'topic') {
      this.keyspaceCache.clear();
    }

    return { changed: true, invalidatedKeyspaces };
  }

  private isTitleReferencedChange(filePath: string): boolean {
    const kind = classifyDitaFileKind(filePath);
    return kind === 'ditamap' || kind === 'bookmap';
  }

  removeFile(filePath: string): void {
    const norm = normalizePosixPath(filePath);
    if (!norm) return;
    this.fileContents.delete(norm);
    this.parsedDocs.delete(norm);
    this.xmlErrors.delete(norm);
    this.topicIndices.delete(norm);
    this.parsedDitavals.delete(norm);
    this.keyspaceCache.clear();
    this.profilingCatalogCache = null;
  }

  renameFile(fromPath: string, toPath: string): void {
    const normFrom = normalizePosixPath(fromPath);
    const normTo = normalizePosixPath(toPath);
    const content = this.fileContents.get(normFrom);
    this.removeFile(normFrom);
    if (content !== undefined) {
      this.updateFile(normTo, content);
    }
  }

  hasFile(filePath: string): boolean {
    return this.fileContents.has(normalizePosixPath(filePath));
  }

  getFilePaths(): string[] {
    return Array.from(this.fileContents.keys()).sort();
  }

  getTopicTitles(): Record<string, string> {
    const titles: Record<string, string> = {};
    for (const [filePath, entry] of this.topicIndices.entries()) {
      if (entry.title) {
        titles[filePath] = entry.title;
      }
    }
    return titles;
  }

  private indexSingleFile(filePath: string, content: string): void {
    const kind = classifyDitaFileKind(filePath);
    if (kind !== 'ditamap' && kind !== 'bookmap' && kind !== 'topic' && kind !== 'ditaval') {
      return;
    }

    const check = checkXmlWellFormed(content, { position: true });
    if (!check.ok) {
      this.parsedDocs.set(filePath, null);
      this.xmlErrors.set(filePath, check.error);
      if (kind === 'topic') {
        this.topicIndices.set(filePath, {
          filePath,
          rootTag: '',
          elements: [],
          profilingValues: {
            audience: [],
            platform: [],
            product: [],
            otherprops: [],
            props: [],
            rev: [],
          },
          wellFormed: false,
        });
      }
      if (kind === 'ditaval') {
        this.parsedDitavals.set(filePath, { ok: false, error: check.error });
      }
      return;
    }

    this.xmlErrors.delete(filePath);
    this.parsedDocs.set(filePath, check.parsed);

    if (kind === 'topic') {
      this.topicIndices.set(filePath, indexTopicElements(filePath, check.parsed));
    } else if (kind === 'ditaval') {
      try {
        const parsedVal = parseDitaval(content);
        this.parsedDitavals.set(filePath, { ok: true, parsed: parsedVal });
      } catch (err) {
        this.parsedDitavals.set(filePath, {
          ok: false,
          error: {
            message: err instanceof Error ? err.message : String(err),
            line: 1,
            column: 1,
            offset: 0,
          },
        });
      }
    }
  }

  getParsedDoc(filePath: string): ParsedXmlDocument | null {
    const norm = normalizePosixPath(filePath);
    if (this.parsedDocs.has(norm)) {
      return this.parsedDocs.get(norm) ?? null;
    }
    const content = this.fileContents.get(norm);
    if (content === undefined) return null;
    try {
      const parsed = parseXml(content, { position: true });
      this.parsedDocs.set(norm, parsed);
      return parsed;
    } catch {
      this.parsedDocs.set(norm, null);
      return null;
    }
  }

  getKeyspace(rootMapPath: string): KeyspaceResult {
    const norm = normalizePosixPath(rootMapPath);
    const cached = this.keyspaceCache.get(norm);
    if (cached) return cached;

    const built = buildKeyspace(
      norm,
      (p) => this.fileContents.get(normalizePosixPath(p)) ?? null,
      {
        topicTitles: this.getTopicTitles(),
        getParsedDoc: (p) => this.getParsedDoc(p),
        locale: this.uiLocale,
      },
    );
    this.keyspaceCache.set(norm, built);
    return built;
  }

  getTopicIndex(filePath: string): TopicIdIndexEntry | null {
    return this.topicIndices.get(normalizePosixPath(filePath)) ?? null;
  }

  getAllTopicIndices(): TopicIdIndexEntry[] {
    return Array.from(this.topicIndices.values()).sort((a, b) =>
      a.filePath.localeCompare(b.filePath),
    );
  }

  getDitaval(
    ditavalPath: string,
  ): { ok: true; parsed: ParsedDitaval } | { ok: false; error: XmlParseError } | null {
    return this.parsedDitavals.get(normalizePosixPath(ditavalPath)) ?? null;
  }

  getProfilingCatalog(): Record<DitaProfilingAttrName, string[]> {
    if (this.profilingCatalogCache) return this.profilingCatalogCache;

    const buckets: Record<DitaProfilingAttrName, Set<string>> = {
      audience: new Set(),
      platform: new Set(),
      product: new Set(),
      otherprops: new Set(),
      props: new Set(),
      rev: new Set(),
    };

    for (const entry of this.topicIndices.values()) {
      for (const attr of DITA_PROFILING_ATTRS) {
        for (const val of entry.profilingValues[attr]) {
          buckets[attr].add(val);
        }
      }
    }

    // Also harvest tokens from `.ditaval` rule declarations and `.ditamap` attributes
    for (const [filePath, parsedDoc] of this.parsedDocs.entries()) {
      if (!parsedDoc) continue;
      const kind = classifyDitaFileKind(filePath);
      if (kind === 'ditamap' || kind === 'bookmap' || kind === 'ditaval') {
        const root = parsedDoc.document.documentElement;
        if (!root) continue;
        const walk = (el: slimdom.Element) => {
          if (kind === 'ditaval') {
            if (el.tagName === 'prop') {
              const att = el.getAttribute('att')?.trim() as DitaProfilingAttrName | undefined;
              const val = el.getAttribute('val')?.trim();
              if (att && att in buckets && val) buckets[att].add(val);
            } else if (el.tagName === 'revprop') {
              const val = el.getAttribute('val')?.trim();
              if (val) buckets.rev.add(val);
            }
          } else {
            for (const attr of DITA_PROFILING_ATTRS) {
              const raw = el.getAttribute(attr)?.trim();
              if (!raw) continue;
              for (const token of raw.split(/\s+/).filter(Boolean)) {
                buckets[attr].add(token);
              }
            }
          }
          for (const child of el.childNodes) {
            if (child.nodeType === ELEMENT_NODE) walk(child as slimdom.Element);
          }
        };
        walk(root);
      }
    }

    this.profilingCatalogCache = {
      audience: Array.from(buckets.audience).sort(),
      platform: Array.from(buckets.platform).sort(),
      product: Array.from(buckets.product).sort(),
      otherprops: Array.from(buckets.otherprops).sort(),
      props: Array.from(buckets.props).sort(),
      rev: Array.from(buckets.rev).sort(),
    };
    return this.profilingCatalogCache;
  }

  resolveKeyref(
    keyref: string,
    rootMapPath: string | null,
    scopePath?: readonly string[],
  ): ResolvedKeyrefResult {
    const keyspace = rootMapPath ? this.getKeyspace(rootMapPath) : null;
    return resolveKeyrefInKeyspace(keyref, keyspace, scopePath, this.uiLocale);
  }

  resolveConref(params: {
    sourceFilePath: string;
    sourceTagName: string;
    attrName: 'conref' | 'conkeyref';
    rawValue: string;
    conrefend?: string;
    sourceTopicId?: string;
    sourceElementId?: string;
    rootMapPath: string | null;
  }): ResolvedConrefResult {
    const normSource = normalizePosixPath(params.sourceFilePath);
    const keyspace = params.rootMapPath ? this.getKeyspace(params.rootMapPath) : null;
    return resolveConrefReference({
      sourceFilePath: normSource,
      sourceTagName: params.sourceTagName,
      attrName: params.attrName,
      rawValue: params.rawValue,
      conrefend: params.conrefend,
      sourceTopicId: params.sourceTopicId,
      sourceElementId: params.sourceElementId,
      keyspace,
      getParsedDoc: (p) => this.getParsedDoc(p),
      hasFile: (p) => this.hasFile(p),
      resolveTopicRootId: (p) => this.getTopicIndex(p)?.rootTopicId,
      locale: this.uiLocale,
    });
  }

  /**
   * Build the live semantic overlay (`keyrefs`, `conrefs`, and per-document diagnostics)
   * for a single document (using `overrideXml` if currently edited in memory).
   */
  buildDocumentOverlay(
    filePath: string,
    rootMapPath: string | null,
    overrideXml?: string,
  ): DocumentSemanticOverlay {
    const normPath = normalizePosixPath(filePath);
    const keyspace = rootMapPath ? this.getKeyspace(rootMapPath) : null;
    const keyrefs: Record<string, ResolvedKeyrefResult> = {};
    const conrefs: Record<string, ResolvedConrefResult> = {};
    const diagnostics: SemanticDiagnostic[] = [];

    let parsedDoc: ParsedXmlDocument | null = null;
    if (overrideXml !== undefined) {
      const check = checkXmlWellFormed(overrideXml, { position: true });
      if (!check.ok) {
        return {
          filePath: normPath,
          rootMapPath,
          keyrefs,
          conrefs,
          diagnostics: [
            {
              id: `xml:${normPath}:${check.error.line}:${check.error.column}`,
              filePath: normPath,
              line: check.error.line,
              column: check.error.column,
              severity: 'error',
              source: 'xml',
              message: coreT(this.uiLocale, 'semantic.malformedXml', { message: check.error.message }),
            },
          ],
        };
      }
      parsedDoc = check.parsed;
    } else {
      parsedDoc = this.getParsedDoc(normPath);
    }

    if (!parsedDoc) {
      return { filePath: normPath, rootMapPath, keyrefs, conrefs, diagnostics };
    }

    const getDocForConref = (p: string): ParsedXmlDocument | null => {
      if (p === normPath && parsedDoc) return parsedDoc;
      return this.getParsedDoc(p);
    };

    const resolveRootTopicId = (p: string): string | undefined => {
      if (p === normPath && parsedDoc?.document.documentElement) {
        return parsedDoc.document.documentElement.getAttribute('id')?.trim() || undefined;
      }
      return this.getTopicIndex(p)?.rootTopicId;
    };

    // 1. Keyref resolution
    const keyrefUsages = findKeyrefUsages(parsedDoc.document);
    for (const usage of keyrefUsages) {
      const rawKeyref = usage.keyref.trim();
      if (!rawKeyref) continue;
      if (!(rawKeyref in keyrefs)) {
        const res = resolveKeyrefInKeyspace(rawKeyref, keyspace, undefined, this.uiLocale);
        keyrefs[rawKeyref] = res;
      }
      const res = keyrefs[rawKeyref]!;
      if (keyspace && res.status === 'unresolved') {
        const range = getNodeSourceRange(usage.element);
        const line = range.open?.line ?? 1;
        const column = range.open?.column ?? 1;
        diagnostics.push({
          id: `keyref:${normPath}:${line}:${column}:${rawKeyref}`,
          filePath: normPath,
          line,
          column,
          severity: 'error',
          source: 'keyref',
          keyName: res.keyName,
          message:
            res.errorMessage ?? coreT(this.uiLocale, 'semantic.undefinedKeyref', { value: rawKeyref }),
        });
      }
    }

    // 2. Conref / Conkeyref resolution
    const conrefUsages = findConrefUsages(parsedDoc.document);
    for (const usage of conrefUsages) {
      const key = makeConrefOverlayKey(usage.tagName, usage.attrName, usage.value, usage.conrefend);
      if (!(key in conrefs)) {
        const { topicId, elementId } = findEnclosingTopicInfo(usage.element);
        const resolved = resolveConrefReference({
          sourceFilePath: normPath,
          sourceTagName: usage.tagName,
          attrName: usage.attrName,
          rawValue: usage.value,
          conrefend: usage.conrefend,
          sourceTopicId: topicId,
          sourceElementId: elementId,
          keyspace,
          getParsedDoc: getDocForConref,
          hasFile: (p) => this.hasFile(p),
          resolveTopicRootId: resolveRootTopicId,
        });
        conrefs[key] = resolved;
      }

      const res = conrefs[key]!;
      if (res.status !== 'resolved') {
        // When no Root Map is active, don't flag missing-key on conkeyref as an error until a map is chosen
        if (res.status === 'missing-key' && !keyspace) continue;
        const range = getNodeSourceRange(usage.element);
        const line = range.open?.line ?? 1;
        const column = range.open?.column ?? 1;
        diagnostics.push({
          id: `conref:${normPath}:${line}:${column}:${key}`,
          filePath: normPath,
          line,
          column,
          severity: 'error',
          source: res.status === 'cycle' ? 'conref-cycle' : 'conref',
          message:
            res.errorMessage ?? coreT(this.uiLocale, 'semantic.invalidConref', { value: usage.value }),
          resolvedPath: res.targetFilePath,
          cycleChain: res.cycleChain,
        });
      }
    }

    return {
      filePath: normPath,
      rootMapPath,
      keyrefs,
      conrefs,
      diagnostics,
    };
  }

  /**
   * Collect unified workspace diagnostics covering:
   * 1. XML well-formedness & invalid `.ditaval` syntax
   * 2. Topic `<image>` broken asset links
   * 3. Active Root Map (or all maps) broken `href` & circular `<mapref>`
   * 4. Unresolved `keyref`, invalid/missing `conref`/`conkeyref`, and DFS `conref` cycles
   */
  collectSemanticDiagnostics(
    rootMapPath: string | null,
    options: { assetPaths?: ReadonlySet<string> } = {},
  ): SemanticDiagnostic[] {
    const diagnostics: SemanticDiagnostic[] = [];
    const knownPaths = new Set<string>(this.fileContents.keys());
    if (options.assetPaths) {
      for (const p of options.assetPaths) {
        knownPaths.add(normalizePosixPath(p));
      }
    }

    const normRoot = rootMapPath ? normalizePosixPath(rootMapPath) : null;
    const activeRoot = normRoot && this.fileContents.has(normRoot) ? normRoot : null;
    const keyspace = activeRoot ? this.getKeyspace(activeRoot) : null;

    // 1. XML errors, DITAVAL validation, and Topic asset/keyref/conref checks
    for (const filePath of this.getFilePaths()) {
      const xmlErr = this.xmlErrors.get(filePath);
      if (xmlErr) {
        diagnostics.push({
          id: `xml:${filePath}:${xmlErr.line}:${xmlErr.column}`,
          filePath,
          line: xmlErr.line,
          column: xmlErr.column,
          severity: 'error',
          source: 'xml',
          message: coreT(this.uiLocale, 'semantic.malformedXml', { message: xmlErr.message }),
        });
        continue;
      }

      const kind = classifyDitaFileKind(filePath);
      if (kind === 'ditaval') {
        const dv = this.parsedDitavals.get(filePath);
        if (dv && !dv.ok) {
          diagnostics.push({
            id: `ditaval:${filePath}:${dv.error.line}:${dv.error.column}`,
            filePath,
            line: dv.error.line,
            column: dv.error.column,
            severity: 'error',
            source: 'ditaval',
            message: coreT(this.uiLocale, 'semantic.ditavalSyntax', { message: dv.error.message }),
          });
        }
        continue;
      }

      if (kind !== 'topic') continue;

      const parsed = this.getParsedDoc(filePath);
      if (parsed) {
        // 1a. DITA 1.3 ordered content model (sequence + cardinality) violations
        for (const issue of collectXmlStructureIssues(parsed.document)) {
          diagnostics.push({
            id: `structure:${filePath}:${issue.offset}:${issue.code}:${issue.childTag}`,
            filePath,
            line: issue.line,
            column: issue.column,
            severity: issue.severity,
            source: 'structure',
            message: formatStructureIssue(issue, this.uiLocale),
          });
        }

        const images = parsed.document.getElementsByTagName('image');
        for (const imgEl of Array.from(images)) {
          const href = imgEl.getAttribute('href')?.trim();
          if (!href) continue;
          const resolved = resolveDitaHref(filePath, href);
          if (resolved.isExternal) continue;
          const range = getNodeSourceRange(imgEl);
          const line = range.open?.line ?? 1;
          const column = range.open?.column ?? 1;

          if (resolved.escapesRoot || !knownPaths.has(resolved.targetPath)) {
            diagnostics.push({
              id: `asset:${filePath}:${line}:${column}:${href}`,
              filePath,
              line,
              column,
              severity: 'warning',
              source: 'asset-ref',
              message: coreT(this.uiLocale, 'semantic.missingImage', { href }),
              targetHref: href,
              resolvedPath: resolved.targetPath || undefined,
            });
          }
        }
      }

      const overlay = this.buildDocumentOverlay(filePath, activeRoot);
      diagnostics.push(...overlay.diagnostics);
    }

    // 2. Map href & circular <mapref> diagnostics
    const mapsToInspect = activeRoot
      ? [activeRoot]
      : this.getFilePaths().filter((p) => {
          const k = classifyDitaFileKind(p);
          return k === 'ditamap' || k === 'bookmap';
        });

    const visitedMaps = new Set<string>();
    const activeStack = new Set<string>();

    const inspectMap = (mapPath: string) => {
      if (visitedMaps.has(mapPath)) return;
      visitedMaps.add(mapPath);
      activeStack.add(mapPath);

      const xml = this.fileContents.get(mapPath);
      if (!xml) {
        activeStack.delete(mapPath);
        return;
      }

      let parsedMap;
      try {
        parsedMap = parseDitaMap(xml);
      } catch {
        activeStack.delete(mapPath);
        return;
      }

      for (const ref of parsedMap.references) {
        if (ref.scope === 'external' || ref.scope === 'peer') continue;
        const resolved = resolveDitaHref(mapPath, ref.href);
        if (resolved.isExternal) continue;

        const line = ref.line ?? 1;
        const column = ref.column ?? 1;

        if (resolved.escapesRoot || !resolved.targetPath) {
          diagnostics.push({
            id: `map:${mapPath}:${line}:${column}:${ref.href}`,
            filePath: mapPath,
            line,
            column,
            severity: 'error',
            source: 'map-ref',
            message: coreT(this.uiLocale, 'semantic.pathEscapesRoot', { href: ref.href }),
            targetHref: ref.href,
          });
          continue;
        }

        if (!knownPaths.has(resolved.targetPath)) {
          diagnostics.push({
            id: `map:${mapPath}:${line}:${column}:${ref.href}`,
            filePath: mapPath,
            line,
            column,
            severity: 'error',
            source: 'map-ref',
            message: coreT(this.uiLocale, 'semantic.missingTargetFile', {
                href: ref.href,
                resolved: resolved.targetPath,
              }),
            targetHref: ref.href,
            resolvedPath: resolved.targetPath,
          });
          continue;
        }

        if (ref.isSubmapRef) {
          if (activeStack.has(resolved.targetPath)) {
            diagnostics.push({
              id: `cycle:${mapPath}:${line}:${column}:${resolved.targetPath}`,
              filePath: mapPath,
              line,
              column,
              severity: 'error',
              source: 'map-ref',
              message: coreT(this.uiLocale, 'semantic.mapCycle', {
                from: mapPath,
                to: resolved.targetPath,
              }),
              targetHref: ref.href,
              resolvedPath: resolved.targetPath,
            });
          } else {
            inspectMap(resolved.targetPath);
          }
        }
      }

      activeStack.delete(mapPath);
    };

    for (const mapPath of mapsToInspect) {
      inspectMap(mapPath);
    }

    // Deduplicate diagnostics by id while keeping deterministic order
    void keyspace;
    const dedup = new Map<string, SemanticDiagnostic>();
    for (const d of diagnostics) {
      if (!dedup.has(d.id)) {
        dedup.set(d.id, d);
      }
    }
    return Array.from(dedup.values());
  }
}
