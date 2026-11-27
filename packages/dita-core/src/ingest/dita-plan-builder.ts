/**
 * Phase 14 Stage 1 — deterministic DITA plan builders.
 *
 * Pure, isomorphic helpers that turn a Planner outline into safe DITA paths, valid
 * DITA 1.3 `.ditamap` XML, a `keys.ditamap`, or a lossless mount of new
 * `<topicref>` elements into an existing map.
 */

import type * as slimdom from 'slimdom';
import { DITA_KEY_NAME_PATTERN } from '../map/dita-map.js';
import { basenamePosix, computeRelativeDitaHref, dirnamePosix } from '../map/path-utils.js';
import { parseXml } from '../xml/parser.js';
import { serializeXml } from '../xml/serializer.js';
import type { DitaMapTemplateType } from '../templates/map-templates.js';
import type { DitaTopicTemplateType } from '../templates/topic-templates.js';
import { parseMarkdownOutline } from './markdown-outline.js';
import type {
  IngestOutlinePlan,
  IngestTargetMode,
  PlannedTopicNode,
} from './types.js';

const ELEMENT_NODE = 1;

const DEFAULT_FOLDER_BY_TYPE: Record<DitaTopicTemplateType, string> = {
  concept: 'concepts',
  task: 'tasks',
  reference: 'references',
  topic: 'topics',
};

const MAX_TOPIC_ID_LENGTH = 64;

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')
    .replace(/\r/g, '&#13;');
}

/**
 * Normalize any title into a valid DITA/XML id (`NCName`-safe, lowercase ASCII).
 * Non-ASCII text (e.g. Chinese titles) collapses to the sanitized `fallback`.
 */
export function sanitizeDitaTopicId(raw: string, fallback: string): string {
  const clean = (value: string): string =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/-+/g, '-')
      .replace(/^[_-]+/, '')
      .replace(/[_-]+$/, '');

  let id = clean(raw);
  if (!id) id = clean(fallback);
  if (!id) id = 'topic';
  if (!/^[a-z_]/.test(id)) id = `id_${id}`;
  if (id.length > MAX_TOPIC_ID_LENGTH) {
    id = id.slice(0, MAX_TOPIC_ID_LENGTH).replace(/[_-]+$/, '');
  }
  return id || 'topic';
}

/** Depth-first flatten of the planned topic tree (pre-order, parents before children). */
export function flattenPlannedTopics(nodes: PlannedTopicNode[]): PlannedTopicNode[] {
  const result: PlannedTopicNode[] = [];
  const visit = (list: readonly PlannedTopicNode[]): void => {
    for (const node of list) {
      result.push(node);
      if (node.children && node.children.length > 0) visit(node.children);
    }
  };
  visit(nodes);
  return result;
}

function sanitizePathSegment(segment: string): string {
  const cleaned = segment.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || '_';
}

/** Turn arbitrary input into a safe POSIX relative path (no `..`, no leading slash). */
function safeRelativePath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .trim()
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .map(sanitizePathSegment)
    .join('/');
}

function ensureExtension(filePath: string, extension: string): string {
  if (filePath.toLowerCase().endsWith(extension)) return filePath;
  const slash = filePath.lastIndexOf('/');
  const dot = filePath.lastIndexOf('.');
  const base = dot > slash ? filePath.slice(0, dot) : filePath;
  return `${base}${extension}`;
}

function withPathSuffix(filePath: string, suffix: number): string {
  const slash = filePath.lastIndexOf('/');
  const dot = filePath.lastIndexOf('.');
  if (dot <= slash) return `${filePath}_${suffix}`;
  return `${filePath.slice(0, dot)}_${suffix}${filePath.slice(dot)}`;
}

function folderForType(type: DitaTopicTemplateType): string {
  return DEFAULT_FOLDER_BY_TYPE[type] ?? DEFAULT_FOLDER_BY_TYPE.topic;
}

function normalizeDirOption(targetDir: string | undefined): string {
  if (!targetDir) return '';
  return safeRelativePath(targetDir);
}

export interface NormalizePlanPathsOptions {
  /** Paths already present in the target manual; generated paths never collide with them. */
  existingPaths?: ReadonlySet<string>;
  /** Preferred folder for topics that did not supply a directory. */
  targetDir?: string;
}

function planKeysMapPath(rootMapPath: string): string {
  const dir = dirnamePosix(rootMapPath);
  return dir ? `${dir}/keys.ditamap` : 'keys.ditamap';
}

/**
 * Sanitize ids and file paths of an outline plan:
 * - topic ids become unique `[a-z_][a-z0-9_-]*` values;
 * - topic paths become safe POSIX `.dita` paths (unique across plan + existing files);
 * - the root map path ends in `.ditamap`.
 */
export function normalizePlanPaths(
  plan: IngestOutlinePlan,
  options: NormalizePlanPathsOptions = {},
): IngestOutlinePlan {
  const usedPaths = new Set<string>();
  for (const existing of options.existingPaths ?? []) {
    const normalized = safeRelativePath(existing).toLowerCase();
    if (normalized) usedPaths.add(normalized);
  }

  const rootExtension = '.ditamap';
  const rawRoot = plan.rootMapPath ? safeRelativePath(plan.rootMapPath) : '';
  let rootMapPath = ensureExtension(
    rawRoot || `${sanitizeDitaTopicId(plan.title, 'ingest')}${rootExtension}`,
    rootExtension,
  );
  let rootSuffix = 2;
  while (usedPaths.has(rootMapPath.toLowerCase())) {
    rootMapPath = withPathSuffix(rootMapPath, rootSuffix);
    rootSuffix += 1;
  }
  usedPaths.add(rootMapPath.toLowerCase());

  if (plan.createKeysMap && plan.suggestedKeys.length > 0) {
    usedPaths.add(planKeysMapPath(rootMapPath).toLowerCase());
  }

  const flat = flattenPlannedTopics(plan.topics);
  const usedIds = new Set<string>();
  const idByNode = new Map<PlannedTopicNode, string>();

  for (const node of flat) {
    const base = sanitizeDitaTopicId(node.topicId, node.title);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = sanitizeDitaTopicId(`${base}_${suffix}`, base);
      suffix += 1;
    }
    usedIds.add(id);
    idByNode.set(node, id);
  }

  const pathByNode = new Map<PlannedTopicNode, string>();
  const targetDir = normalizeDirOption(options.targetDir);

  for (const node of flat) {
    const id = idByNode.get(node) ?? sanitizeDitaTopicId(node.topicId, node.title);
    const rawPath = node.filePath ? safeRelativePath(node.filePath) : '';
    const defaultFolder = targetDir || folderForType(node.type);

    let candidate = '';
    if (rawPath) {
      candidate = ensureExtension(rawPath, '.dita');
      if (!candidate.includes('/')) candidate = `${defaultFolder}/${candidate}`;
    } else {
      candidate = `${defaultFolder}/${id}.dita`;
    }

    let unique = candidate;
    let suffix = 2;
    while (usedPaths.has(unique.toLowerCase())) {
      unique = withPathSuffix(candidate, suffix);
      suffix += 1;
    }
    usedPaths.add(unique.toLowerCase());
    pathByNode.set(node, unique);
  }

  const rebuild = (nodes: PlannedTopicNode[]): PlannedTopicNode[] =>
    nodes.map((node) => {
      const rebuilt: PlannedTopicNode = {
        ...node,
        topicId: idByNode.get(node) ?? node.topicId,
        filePath: pathByNode.get(node) ?? node.filePath,
      };
      if (node.children && node.children.length > 0) {
        rebuilt.children = rebuild(node.children);
      }
      return rebuilt;
    });

  const normalized: IngestOutlinePlan = {
    ...plan,
    rootMapPath,
    topics: rebuild(plan.topics),
  };
  if (plan.targetMode) normalized.targetMode = plan.targetMode;
  return normalized;
}

function renderTopicRefs(
  nodes: readonly PlannedTopicNode[],
  rootMapPath: string,
  depth: number,
  indent: string,
): string[] {
  const lines: string[] = [];
  const pad = indent.repeat(depth);

  for (const node of nodes) {
    const href = computeRelativeDitaHref(rootMapPath, node.filePath);
    const navtitle =
      node.navTitle && node.navTitle.trim() ? ` navtitle="${escapeXmlAttr(node.navTitle.trim())}"` : '';
    const children = node.children ?? [];

    if (children.length === 0) {
      lines.push(`${pad}<topicref href="${escapeXmlAttr(href)}"${navtitle}/>`);
      continue;
    }
    lines.push(`${pad}<topicref href="${escapeXmlAttr(href)}"${navtitle}>`);
    lines.push(...renderTopicRefs(children, rootMapPath, depth + 1, indent));
    lines.push(`${pad}</topicref>`);
  }

  return lines;
}

/**
 * Generate a complete DITA 1.3 `<map>` for an outline plan.
 * The plan is assumed normalized (`normalizePlanPaths`); hrefs are relative to the root map.
 */
export function buildMapXmlFromPlan(plan: IngestOutlinePlan): string {
  const lang = plan.language?.trim() || 'zh-CN';
  const title = plan.title.trim() || 'Imported Manual';
  const mapId = sanitizeDitaTopicId(plan.title, 'ingest_map');
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];

  lines.push('<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">');
  lines.push(`<map id="${mapId}" xml:lang="${escapeXmlAttr(lang)}">`);
  lines.push(`  <title>${escapeXmlText(title)}</title>`);

  if (plan.createKeysMap && plan.suggestedKeys.length > 0) {
    const keysHref = computeRelativeDitaHref(plan.rootMapPath, planKeysMapPath(plan.rootMapPath));
    lines.push(
      `  <mapref href="${escapeXmlAttr(keysHref)}" processing-role="resource-only"/>`,
    );
  }

  lines.push(...renderTopicRefs(plan.topics, plan.rootMapPath, 1, '  '));

  lines.push('</map>');
  lines.push('');
  return lines.join('\n');
}

function sanitizeDitaKey(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let key = trimmed.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[^A-Za-z0-9_]+/, '');
  if (!key) return null;
  if (key.length > 128) key = key.slice(0, 128);
  return DITA_KEY_NAME_PATTERN.test(key) ? key : null;
}

/** Generate the optional `keys.ditamap` referenced by a plan's root map. */
export function buildKeysMapXml(plan: IngestOutlinePlan): string {
  const lang = plan.language?.trim() || 'zh-CN';
  const seen = new Set<string>();
  const entries: Array<{ keys: string; keyword: string }> = [];

  for (const suggested of plan.suggestedKeys) {
    const key = sanitizeDitaKey(suggested.keys);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    entries.push({ keys: key, keyword: suggested.keyword.trim() || suggested.keys.trim() });
  }

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
    `<map id="${sanitizeDitaTopicId(plan.title, 'keys_map')}_keys" xml:lang="${escapeXmlAttr(lang)}">`,
    '  <title>Key Definitions</title>',
  ];

  for (const entry of entries) {
    lines.push(`  <keydef keys="${escapeXmlAttr(entry.keys)}">`);
    lines.push('    <topicmeta>');
    lines.push('      <keywords>');
    lines.push(`        <keyword>${escapeXmlText(entry.keyword)}</keyword>`);
    lines.push('      </keywords>');
    lines.push('    </topicmeta>');
    lines.push('  </keydef>');
  }

  lines.push('</map>');
  lines.push('');
  return lines.join('\n');
}

export interface MountTopicsIntoExistingMapOptions {
  /** Workspace-relative POSIX path of the existing map (defines the href base). */
  mapPath: string;
  /** Element child index path from the map root; `null`/empty appends at the root level. */
  parentElementPath: number[] | null;
  topics: PlannedTopicNode[];
  /** Override the tag used at the mount level (`topicref` by default). */
  mountTagName?: string;
}

function resolveElementByPath(
  root: slimdom.Element,
  path: readonly number[],
): slimdom.Element | null {
  let current = root;
  for (const index of path) {
    const elementChildren = Array.from(current.childNodes).filter(
      (child): child is slimdom.Element => child.nodeType === ELEMENT_NODE,
    );
    const next = elementChildren[index];
    if (!next) return null;
    current = next;
  }
  return current;
}

function createPlannedElement(
  doc: slimdom.Document,
  node: PlannedTopicNode,
  mapPath: string,
  tagName: string,
): slimdom.Element {
  const el = doc.createElementNS(null, tagName);
  const href = computeRelativeDitaHref(mapPath, node.filePath);
  el.setAttribute('href', href);
  const navtitle = node.navTitle?.trim();
  if (navtitle) el.setAttribute('navtitle', navtitle);
  for (const child of node.children ?? []) {
    el.appendChild(createPlannedElement(doc, child, mapPath, 'topicref'));
  }
  return el;
}

/**
 * Losslessly mount planned topics into an existing `.ditamap`:
 * XML declaration, DOCTYPE, comments, PIs and every existing attribute stay untouched; new
 * `<topicref>` elements are appended (or inserted before trailing `<reltable>`).
 */
export function mountTopicsIntoExistingMap(
  mapXml: string,
  options: MountTopicsIntoExistingMapOptions,
): string {
  const parsed = parseXml(mapXml, { position: false });
  const root = parsed.document.documentElement;
  if (!root) {
    throw new Error('Cannot mount topics into an XML document without a root element.');
  }

  const parent =
    options.parentElementPath && options.parentElementPath.length > 0
      ? resolveElementByPath(root, options.parentElementPath)
      : root;
  if (!parent) {
    throw new Error('Mount parent element path does not resolve inside the map.');
  }

  const tagName = options.mountTagName?.trim() || 'topicref';

  const anchor =
    parent === root
      ? (Array.from(parent.childNodes).find(
          (child): child is slimdom.Element =>
            child.nodeType === ELEMENT_NODE && (child as slimdom.Element).tagName === 'reltable',
        ) ?? null)
      : null;

  for (const node of options.topics) {
    parent.insertBefore(createPlannedElement(parsed.document, node, options.mapPath, tagName), anchor);
  }

  return serializeXml(parsed);
}

/* ------------------------------------------------------------------------------------------ */
/* Heuristic fallback planner                                                                 */
/* ------------------------------------------------------------------------------------------ */

const TASK_HEADING_REGEX =
  /(\btask\b|\btasks\b|\bprocedure\b|\bprocedures\b|\bsteps?\b|\bhow\s+to\b|\bworkflow\b|步骤|操作|任务|流程|安装|配置步骤)/i;
const REFERENCE_HEADING_REGEX =
  /(\breference\b|\breferences\b|\bparameters?\b|\boptions?\b|\bcommands?\b|\bapi\b|\bfields?\b|\battributes?\b|\bproperties\b|参考|参数|命令|字段|选项|接口|属性|附录)/i;

function detectTopicType(heading: string, body: string): DitaTopicTemplateType {
  const haystack = `${heading}\n${body}`;
  if (TASK_HEADING_REGEX.test(haystack)) return 'task';
  if (REFERENCE_HEADING_REGEX.test(haystack)) return 'reference';
  return 'concept';
}

function humanizeFilename(filename: string): string {
  const withoutExt = filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
  const spaced = withoutExt.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced || 'Imported Document';
}

export interface BuildFallbackOutlinePlanOptions {
  sourceFilename: string;
  targetMode: IngestTargetMode;
  language?: string;
  mapKind?: DitaMapTemplateType;
  topicType?: DitaTopicTemplateType | 'auto';
  targetDir?: string;
}

/**
 * Deterministic heuristic outline used when the Planner agent is disabled or fails validation.
 * One topic per top-level heading; deeper sections stay inside the topic via `sectionIds`.
 */
export function buildFallbackOutlinePlan(
  markdown: string,
  options: BuildFallbackOutlinePlanOptions,
): IngestOutlinePlan {
  const sections = parseMarkdownOutline(markdown);
  const language = options.language ?? 'zh-CN';
  const mapKind = options.mapKind ?? 'map';
  const requestedType = options.topicType ?? 'auto';
  const documentTitle = humanizeFilename(options.sourceFilename);

  const headingLevels = sections
    .filter((section) => section.level > 0)
    .map((section) => section.level);
  const minHeadingLevel = headingLevels.length > 0 ? Math.min(...headingLevels) : 1;
  const topSections = sections.filter(
    (section) => section.level === 0 || section.level === minHeadingLevel,
  );
  const titles = topSections
    .map((section) => section.heading.trim())
    .filter((title) => title.length > 0);
  const planTitle = titles[0] ?? documentTitle;

  const sectionText = (startLine: number, endLine: number): string => {
    const lines = markdown.split('\n');
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end).join('\n');
  };

  const topics: PlannedTopicNode[] = [];
  let current: PlannedTopicNode | null = null;

  for (const section of sections) {
    const isTop = topSections.includes(section);
    if (isTop) {
      const heading = section.heading.trim();
      const body = sectionText(section.startLine, section.endLine);
      const title = heading || (topics.length === 0 ? documentTitle : `Section ${topics.length + 1}`);
      const type =
        requestedType === 'auto' ? detectTopicType(heading, body) : requestedType;
      const node: PlannedTopicNode = {
        topicId: '',
        title,
        type,
        filePath: '',
        sectionIds: [section.id],
        summary: body.replace(/\s+/g, ' ').trim().slice(0, 240),
      };
      topics.push(node);
      current = node;
      continue;
    }
    // Descendant section: never attach the preamble to the previous topic.
    if (current && section.level > 0) {
      current.sectionIds?.push(section.id);
    }
  }

  if (topics.length === 0) {
    topics.push({
      topicId: '',
      title: documentTitle,
      type: requestedType === 'auto' ? 'concept' : requestedType,
      filePath: '',
      sectionIds: sections.map((section) => section.id),
      summary: markdown.replace(/\s+/g, ' ').trim().slice(0, 240),
    });
  }

  const rootExtension = '.ditamap';
  const plan: IngestOutlinePlan = {
    title: planTitle,
    language,
    targetMode: options.targetMode,
    mapKind,
    rootMapPath: `${sanitizeDitaTopicId(planTitle, 'ingest')}${rootExtension}`,
    topicType: requestedType,
    createKeysMap: false,
    suggestedKeys: [],
    topics,
  };
  if (options.targetDir) plan.targetDir = options.targetDir;

  return normalizePlanPaths(plan, options.targetDir ? { targetDir: options.targetDir } : {});
}

/** Exposed for callers that need the companion keys map path of a normalized plan. */
export function keysMapPathFor(rootMapPath: string): string {
  return planKeysMapPath(rootMapPath);
}

/** Exposed for callers that need a deterministic basename of a planned topic. */
export function topicFileBasename(topic: PlannedTopicNode): string {
  return basenamePosix(topic.filePath);
}
