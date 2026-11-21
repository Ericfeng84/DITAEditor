import {
  classifyDitaFileKind,
  createMapTemplate,
  DITA_SAMPLE_DOCUMENTS,
  extractDitaDocumentTitle,
  parseDitaMap,
  resolveDitaHref,
  type DitaFileKind,
  type DitaMapTemplateType,
  type DitaTopicTemplateType,
  type XmlParseError,
} from '@dita/core';

export interface WorkspaceFileNode {
  name: string;
  path: string;
  kind: 'directory' | DitaFileKind;
  size?: number;
  mtimeMs?: number;
  children?: WorkspaceFileNode[];
}

export interface WorkspaceMapSummary {
  path: string;
  name: string;
  kind: 'ditamap' | 'bookmap';
  title: string;
  topicrefCount: number;
  parseError?: XmlParseError;
}

export interface WorkspaceSnapshot {
  rootDir: string;
  defaultRootDir: string;
  name: string;
  maps: WorkspaceMapSummary[];
  files: WorkspaceFileNode[];
  topicTitles: Record<string, string>;
  stats: {
    totalFiles: number;
    totalTopics: number;
    totalMaps: number;
    totalImages: number;
  };
}

export interface FileContentResult {
  path: string;
  content: string;
  mtimeMs: number;
  size: number;
  kind: DitaFileKind;
  wellFormed: boolean;
  xmlError?: XmlParseError;
}

export interface WorkspaceDiagnostic {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  source: 'xml' | 'map-ref' | 'asset-ref';
  message: string;
  targetHref?: string;
  resolvedPath?: string;
}

export interface UploadAssetResult {
  path: string;
  fileName: string;
  relativeHref: string;
  previewUrl: string;
  mimeType: string;
  size: number;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(errMsg);
  }
  return data as T;
}

export function fetchWorkspace(): Promise<WorkspaceSnapshot> {
  return requestJson<WorkspaceSnapshot>('/api/workspace');
}

export function openWorkspaceDir(
  target: { rootDir: string } | { useDefault: true },
): Promise<WorkspaceSnapshot> {
  return requestJson<WorkspaceSnapshot>('/api/workspace/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });
}

export function importWorkspaceProject(
  projectName: string,
  files: { path: string; content: string; encoding?: 'utf8' | 'base64' }[],
): Promise<WorkspaceSnapshot> {
  return requestJson<WorkspaceSnapshot>('/api/workspace/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, files }),
  });
}

export function fetchFileContent(filePath: string): Promise<FileContentResult> {
  return requestJson<FileContentResult>(
    `/api/files/content?path=${encodeURIComponent(filePath)}`,
  );
}

export function saveFileContent(
  filePath: string,
  content: string,
  createDirs = true,
): Promise<FileContentResult> {
  return requestJson<FileContentResult>('/api/files/content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content, createDirs }),
  });
}

export function createWorkspaceFile(payload: {
  path: string;
  kind: DitaTopicTemplateType | DitaMapTemplateType | 'ditaval';
  id?: string;
  title?: string;
  lang?: string;
  content?: string;
  overwrite?: boolean;
}): Promise<FileContentResult> {
  return requestJson<FileContentResult>('/api/files/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function createWorkspaceDir(dirPath: string): Promise<{ path: string }> {
  return requestJson<{ path: string }>('/api/files/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath }),
  });
}

export function renameWorkspaceEntry(
  fromPath: string,
  toPath: string,
): Promise<{ fromPath: string; toPath: string }> {
  return requestJson<{ fromPath: string; toPath: string }>('/api/files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromPath, toPath }),
  });
}

export function deleteWorkspaceEntry(filePath: string): Promise<{ path: string }> {
  return requestJson<{ path: string }>(`/api/files?path=${encodeURIComponent(filePath)}`, {
    method: 'DELETE',
  });
}

export function fetchWorkspaceDiagnostics(
  rootMapPath?: string,
): Promise<{ diagnostics: WorkspaceDiagnostic[] }> {
  const qs = rootMapPath ? `?rootMap=${encodeURIComponent(rootMapPath)}` : '';
  return requestJson<{ diagnostics: WorkspaceDiagnostic[] }>(`/api/diagnostics${qs}`);
}

export async function uploadWorkspaceImage(
  file: File,
  targetDir = 'images',
  fromDocPath?: string,
): Promise<UploadAssetResult> {
  const form = new FormData();
  form.append('targetDir', targetDir);
  if (fromDocPath) {
    form.append('fromDocPath', fromDocPath);
  }
  form.append('file', file);

  const res = await fetch('/api/assets/upload', {
    method: 'POST',
    body: form,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Upload failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as UploadAssetResult;
}

/**
 * Resolve a DITA `href` image target into a live preview URL in either API or in-memory fallback mode.
 */
export function resolveWorkspaceAssetUrl(
  docPath: string,
  href: string,
  mode: 'api' | 'memory',
  memoryAssets?: Record<string, string>,
): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }

  if (mode === 'api') {
    if (trimmed.startsWith('/api/')) return trimmed;
    return `/api/assets/resolve?from=${encodeURIComponent(docPath)}&href=${encodeURIComponent(trimmed)}`;
  }

  const resolved = resolveDitaHref(docPath, trimmed);
  if (resolved.isExternal || resolved.escapesRoot || !resolved.targetPath) {
    return null;
  }
  return memoryAssets?.[resolved.targetPath] ?? null;
}

export interface InMemoryDemoWorkspace {
  snapshot: WorkspaceSnapshot;
  files: Record<string, string>;
  assets: Record<string, string>;
}

const DEMO_ARCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 200" width="640" height="200"><rect width="640" height="200" rx="12" fill="#f8fafc" stroke="#c7d2fe"/><text x="24" y="34" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#1e293b">DITAEditor Phase 2 Offline Demo Workspace</text><rect x="24" y="56" width="180" height="110" rx="8" fill="#eef2ff" stroke="#818cf8"/><text x="38" y="88" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#312e81">Map / Bookmap Tree</text><text x="38" y="114" font-family="monospace" font-size="11" fill="#4338ca">react-arborist</text><rect x="230" y="56" width="180" height="110" rx="8" fill="#0f172a"/><text x="246" y="88" font-family="monospace" font-size="12" font-weight="700" fill="#38bdf8">@dita/core</text><text x="246" y="114" font-family="system-ui,sans-serif" font-size="11" fill="#cbd5e1">Lossless XML DOM</text><rect x="436" y="56" width="180" height="110" rx="8" fill="#ecfdf5" stroke="#34d399"/><text x="452" y="88" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#065f46">Multi-Tab Editor</text><text x="452" y="114" font-family="system-ui,sans-serif" font-size="11" fill="#047857">Visual &lt;-&gt; Source</text></svg>`;

/**
 * Fallback in-memory multi-file project used when `@dita/api` is not running.
 */
export function createInMemoryDemoWorkspace(): InMemoryDemoWorkspace {
  const sampleConcept = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
  const sampleTask = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
  const sampleRef = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-reference')!;
  const samplePass = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-passthrough')!;

  const conceptXml = sampleConcept.xml.replace(
    '<note type="tip">',
    '<fig id="fig_demo_arch"><title>工作台架构概览</title><image href="../images/architecture.svg" placement="break" alt="DITAEditor 架构示意图"/></fig>\n      <note type="tip">',
  );

  const rootMapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
    '<map id="product_manual" xml:lang="zh-CN">',
    '  <title>DITAEditor 产品手册（离线示例工作区）</title>',
    '  <keydef keys="prod_name" processing-role="resource-only">',
    '    <topicmeta>',
    '      <keywords>',
    '        <keyword>DITAEditor</keyword>',
    '      </keywords>',
    '    </topicmeta>',
    '  </keydef>',
    '  <topichead navtitle="核心概念">',
    '    <topicref href="concepts/dita-architecture.dita" type="concept" navtitle="DITA 结构化写作架构概述"/>',
    '  </topichead>',
    '  <mapref href="maps/getting-started.ditamap" format="ditamap" navtitle="快速入门子地图"/>',
    '  <topichead navtitle="规格与高级特性">',
    '    <topicref href="references/server-sizing-cals.dita" type="reference" navtitle="Server Sizing &amp; CALS Matrix"/>',
    '    <topicref href="references/specialized-passthrough.dita" type="topic" navtitle="Specialized &amp; Unknown Elements"/>',
    '  </topichead>',
    '</map>',
    '',
  ].join('\n');

  const subMapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
    '<map id="submap_getting_started" xml:lang="zh-CN">',
    '  <title>快速入门子地图</title>',
    '  <topicref href="../tasks/deploy-worker.dita" type="task" navtitle="Deploy the DITA Validation Worker"/>',
    '</map>',
    '',
  ].join('\n');

  const bookMapXml = createMapTemplate('bookmap', {
    id: 'admin_book',
    title: '平台管理员技术手册',
  });

  const files: Record<string, string> = {
    'product-manual.ditamap': rootMapXml,
    'admin-book.bookmap': bookMapXml,
    'maps/getting-started.ditamap': subMapXml,
    'concepts/dita-architecture.dita': conceptXml,
    'tasks/deploy-worker.dita': sampleTask.xml,
    'references/server-sizing-cals.dita': sampleRef.xml,
    'references/specialized-passthrough.dita': samplePass.xml,
  };

  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(DEMO_ARCH_SVG)}`;
  const assets: Record<string, string> = {
    'images/architecture.svg': svgDataUrl,
  };

  const snapshot = buildSnapshotFromMemoryFiles('demo-dita-project (离线示例)', files, assets);
  return { snapshot, files, assets };
}

export function buildSnapshotFromMemoryFiles(
  workspaceName: string,
  files: Record<string, string>,
  assets: Record<string, string>,
): WorkspaceSnapshot {
  const maps: WorkspaceMapSummary[] = [];
  const topicTitles: Record<string, string> = {};
  const stats = {
    totalFiles: 0,
    totalTopics: 0,
    totalMaps: 0,
    totalImages: 0,
  };

  const allPaths = [...Object.keys(files), ...Object.keys(assets)].sort();
  const rootChildren: WorkspaceFileNode[] = [];
  const dirMap = new Map<string, WorkspaceFileNode>();

  const ensureDir = (dirPath: string): WorkspaceFileNode[] => {
    if (!dirPath) return rootChildren;
    const existing = dirMap.get(dirPath);
    if (existing?.children) return existing.children;
    const parts = dirPath.split('/');
    const name = parts[parts.length - 1]!;
    const parentPath = parts.slice(0, -1).join('/');
    const parentChildren = ensureDir(parentPath);
    const dirNode: WorkspaceFileNode = {
      name,
      path: dirPath,
      kind: 'directory',
      children: [],
    };
    parentChildren.push(dirNode);
    dirMap.set(dirPath, dirNode);
    return dirNode.children!;
  };

  for (const filePath of allPaths) {
    const kind = classifyDitaFileKind(filePath);
    const name = filePath.split('/').pop() ?? filePath;
    const parentDir = filePath.includes('/')
      ? filePath.slice(0, filePath.lastIndexOf('/'))
      : '';
    const parentChildren = ensureDir(parentDir);

    stats.totalFiles++;
    const content = files[filePath];
    if (kind === 'ditamap' || kind === 'bookmap') {
      stats.totalMaps++;
      if (content !== undefined) {
        try {
          const parsed = parseDitaMap(content);
          maps.push({
            path: filePath,
            name,
            kind,
            title: parsed.title,
            topicrefCount: parsed.nodes.length,
          });
        } catch {
          maps.push({
            path: filePath,
            name,
            kind,
            title: name,
            topicrefCount: 0,
          });
        }
      }
    } else if (kind === 'topic' && content !== undefined) {
      stats.totalTopics++;
      const title = extractDitaDocumentTitle(content);
      if (title) topicTitles[filePath] = title;
    } else if (kind === 'image') {
      stats.totalImages++;
    }

    parentChildren.push({
      name,
      path: filePath,
      kind,
      size: content?.length ?? 0,
    });
  }

  const sortTree = (nodes: WorkspaceFileNode[]) => {
    nodes.sort((a, b) => {
      if ((a.kind === 'directory') !== (b.kind === 'directory')) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortTree(n.children);
    }
  };
  sortTree(rootChildren);

  maps.sort((a, b) => {
    const da = a.path.split('/').length;
    const db = b.path.split('/').length;
    return da !== db ? da - db : a.path.localeCompare(b.path);
  });

  return {
    rootDir: 'memory://demo-dita-project',
    defaultRootDir: 'memory://demo-dita-project',
    name: workspaceName,
    maps,
    files: rootChildren,
    topicTitles,
    stats,
  };
}
