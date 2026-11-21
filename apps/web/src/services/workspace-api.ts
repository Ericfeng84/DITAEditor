import {
  classifyDitaFileKind,
  createMapTemplate,
  DITA_SAMPLE_DOCUMENTS,
  extractDitaDocumentTitle,
  parseDitaMap,
  parseDitaval,
  resolveDitaHref,
  type DitaFileKind,
  type DitaMapTemplateType,
  type DitaProfilingAttrName,
  type DitaTopicTemplateType,
  type DocumentSemanticOverlay,
  type KeyspaceResult,
  type ParsedDitaval,
  type ResolvedConrefResult,
  type SemanticDiagnostic,
  type TopicIdIndexEntry,
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

export interface WorkspaceDitavalSummary {
  path: string;
  name: string;
  ruleCount: number;
  parseError?: XmlParseError;
}

export interface WorkspaceSnapshot {
  rootDir: string;
  defaultRootDir: string;
  name: string;
  maps: WorkspaceMapSummary[];
  ditavals: WorkspaceDitavalSummary[];
  files: WorkspaceFileNode[];
  topicTitles: Record<string, string>;
  stats: {
    totalFiles: number;
    totalTopics: number;
    totalMaps: number;
    totalImages: number;
  };
}

export type WorkspaceScaffold = 'blank' | 'starter';

export interface WorkspaceListItem {
  path: string;
  name: string;
  lastOpenedAt: number;
  /** True when the directory was discovered under the imports root but never opened. */
  unregistered?: boolean;
  exists: boolean;
  isDefault: boolean;
  isCurrent: boolean;
}

export interface WorkspacePickerSnapshot {
  current: { path: string; name: string } | null;
  defaultRootDir: string;
  importsRootDir: string;
  workspaces: WorkspaceListItem[];
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

export type WorkspaceDiagnostic = SemanticDiagnostic;

export interface SemanticContextResponse {
  branch: string;
  rootMapPath: string | null;
  ditavalPath: string | null;
  keyspace: KeyspaceResult | null;
  topicIndices: TopicIdIndexEntry[];
  profilingCatalog: Record<DitaProfilingAttrName, string[]>;
  ditavals: WorkspaceDitavalSummary[];
  activeDitaval: ParsedDitaval | null;
  ditavalError?: XmlParseError;
  indexedAt: number;
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

export function fetchWorkspaces(): Promise<WorkspacePickerSnapshot> {
  return requestJson<WorkspacePickerSnapshot>('/api/workspaces');
}

export function createWorkspaceProject(payload: {
  name: string;
  parentDir?: string;
  scaffold?: WorkspaceScaffold;
}): Promise<WorkspaceSnapshot> {
  return requestJson<WorkspaceSnapshot>('/api/workspaces/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function forgetWorkspaceProject(
  dirPath: string,
): Promise<{ workspaces: WorkspaceListItem[] }> {
  return requestJson<{ workspaces: WorkspaceListItem[] }>('/api/workspaces/forget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath }),
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

export function fetchSemanticContext(
  rootMapPath: string | null,
  ditavalPath: string | null,
): Promise<SemanticContextResponse> {
  const params = new URLSearchParams();
  if (rootMapPath) params.set('rootMap', rootMapPath);
  if (ditavalPath) params.set('ditaval', ditavalPath);
  const qs = params.toString();
  return requestJson<SemanticContextResponse>(`/api/semantics/context${qs ? `?${qs}` : ''}`);
}

export function resolveDocumentSemantics(payload: {
  filePath: string;
  rootMapPath: string | null;
  xml?: string;
}): Promise<DocumentSemanticOverlay> {
  return requestJson<DocumentSemanticOverlay>('/api/semantics/resolve-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function resolveSingleConref(payload: {
  sourceFilePath: string;
  sourceTagName: string;
  attrName: 'conref' | 'conkeyref';
  rawValue: string;
  conrefend?: string;
  sourceTopicId?: string;
  sourceElementId?: string;
  rootMapPath: string | null;
}): Promise<ResolvedConrefResult> {
  return requestJson<ResolvedConrefResult>('/api/semantics/resolve-conref', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchParsedDitaval(
  ditavalPath: string,
): Promise<{ path: string; ditaval: ParsedDitaval }> {
  return requestJson<{ path: string; ditaval: ParsedDitaval }>(
    `/api/semantics/ditaval?path=${encodeURIComponent(ditavalPath)}`,
  );
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
    '        <keyword>DITAEditor Enterprise</keyword>',
    '      </keywords>',
    '    </topicmeta>',
    '  </keydef>',
    '  <keydef keys="api_version" processing-role="resource-only">',
    '    <topicmeta>',
    '      <keywords>',
    '        <keyword>v2.4</keyword>',
    '      </keywords>',
    '    </topicmeta>',
    '  </keydef>',
    '  <keydef keys="deployment_mode" processing-role="resource-only">',
    '    <topicmeta>',
    '      <keywords>',
    '        <keyword>Cloud SaaS 多租户</keyword>',
    '      </keywords>',
    '    </topicmeta>',
    '  </keydef>',
    '  <keydef keys="common_reuse" href="shared/common-reuse.dita" processing-role="resource-only"/>',
    '  <keydef keys="gloss_dita" processing-role="resource-only">',
    '    <topicmeta>',
    '      <keywords>',
    '        <keyword>DITA (Darwin Information Typing Architecture)</keyword>',
    '      </keywords>',
    '    </topicmeta>',
    '  </keydef>',
    '  <topicgroup keyscope="cloud">',
    '    <keydef keys="endpoint_url" processing-role="resource-only">',
    '      <topicmeta>',
    '        <keywords>',
    '          <keyword>https://cloud.ditaeditor.dev/api</keyword>',
    '        </keywords>',
    '      </topicmeta>',
    '    </keydef>',
    '  </topicgroup>',
    '  <topichead navtitle="核心概念">',
    '    <topicref href="concepts/dita-architecture.dita" type="concept" navtitle="DITA 结构化写作架构概述">',
    '      <topicref href="concepts/single-sourcing.dita" type="concept" navtitle="单一信息源与跨文档复用" rev="2.4"/>',
    '    </topicref>',
    '  </topichead>',
    '  <mapref href="maps/getting-started.ditamap" format="ditamap" navtitle="快速入门子地图" audience="admin"/>',
    '  <topichead navtitle="规格与高级特性" product="cloud">',
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

  const bookMapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE bookmap PUBLIC "-//OASIS//DTD DITA BookMap//EN" "bookmap.dtd">',
    '<bookmap id="admin_book" xml:lang="zh-CN">',
    '  <booktitle>',
    '    <mainbooktitle>平台部署与管理员手册</mainbooktitle>',
    '  </booktitle>',
    '  <frontmatter>',
    '    <keydef keys="prod_name" processing-role="resource-only">',
    '      <topicmeta><keywords><keyword>DITAEditor 私有化平台版</keyword></keywords></topicmeta>',
    '    </keydef>',
    '    <keydef keys="api_version" processing-role="resource-only">',
    '      <topicmeta><keywords><keyword>v2.4-LTS</keyword></keywords></topicmeta>',
    '    </keydef>',
    '    <keydef keys="deployment_mode" processing-role="resource-only">',
    '      <topicmeta><keywords><keyword>私有化内网集群</keyword></keywords></topicmeta>',
    '    </keydef>',
    '    <keydef keys="common_reuse" href="shared/common-reuse.dita" processing-role="resource-only"/>',
    '    <keydef keys="gloss_dita" processing-role="resource-only">',
    '      <topicmeta><keywords><keyword>DITA 1.3</keyword></keywords></topicmeta>',
    '    </keydef>',
    '    <topicgroup keyscope="cloud">',
    '      <keydef keys="endpoint_url" processing-role="resource-only">',
    '        <topicmeta><keywords><keyword>https://intranet.corp.local/dita-api</keyword></keywords></topicmeta>',
    '      </keydef>',
    '    </topicgroup>',
    '  </frontmatter>',
    '  <chapter href="concepts/dita-architecture.dita" navtitle="第 1 章 结构化写作架构">',
    '    <topicref href="concepts/single-sourcing.dita" type="concept" navtitle="单一信息源模型" rev="2.4"/>',
    '  </chapter>',
    '  <chapter href="tasks/deploy-worker.dita" navtitle="第 2 章 部署 Worker" audience="admin"/>',
    '</bookmap>',
    '',
  ].join('\n');

  const commonReuseXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">',
    '<topic id="common_reuse" xml:lang="zh-CN">',
    '  <title>跨文档单一信息源复用片段库</title>',
    '  <shortdesc>集中维护标准告警提示与共用声明。</shortdesc>',
    '  <body>',
    '    <note id="backup_warning" type="caution">在执行升级前，请对 <keyword keyref="prod_name"/> 工作区执行快照备份。</note>',
    '    <p id="sla_notice">本章节遵循 <keyword keyref="prod_name"/>（<keyword keyref="api_version"/>）单源复用规范。</p>',
    '    <p>联系邮箱：<ph id="support_email">docs-team@ditaeditor.dev</ph></p>',
    '  </body>',
    '</topic>',
    '',
  ].join('\n');

  const singleSourcingXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
    '<concept id="single_sourcing_model" xml:lang="zh-CN">',
    '  <title>单一信息源与跨文档复用（<keyword keyref="prod_name"/>）</title>',
    '  <shortdesc>演示 Root Map Keyspace 变量替换、Conref 复用展开与 DITAVAL 条件过滤。</shortdesc>',
    '  <conbody>',
    '    <p>当前产品：<keyword keyref="prod_name"/> <keyword keyref="api_version"/> · 模式：<ph keyref="deployment_mode"/> · API：<keyword keyref="cloud.endpoint_url"/>。</p>',
    '    <section id="sec_conref_demo">',
    '      <title>内容复用实时展开示例</title>',
    '      <note conkeyref="common_reuse/backup_warning" type="caution"/>',
    '      <p conref="../shared/common-reuse.dita#common_reuse/sla_notice"/>',
    '      <p>技术支持：<ph conkeyref="common_reuse/support_email"/>。</p>',
    '    </section>',
    '    <section id="sec_profiling_demo">',
    '      <title>DITAVAL 条件过滤示例</title>',
    '      <p product="cloud" rev="2.4">【云原生版】多租户工作区由控制面自动分配隔离存储。</p>',
    '      <p product="onprem" platform="linux" audience="admin">【私有化部署版】需在 Linux 节点部署 Java 21 Worker。</p>',
    '      <p otherprops="internal">【内部研发备注】本地调试提示信息。</p>',
    '    </section>',
    '  </conbody>',
    '</concept>',
    '',
  ].join('\n');

  const cloudDitaval = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<val>',
    '  <prop att="audience" val="admin" action="include"/>',
    '  <prop att="product" val="cloud" action="include"/>',
    '  <prop att="product" val="onprem" action="exclude"/>',
    '  <prop att="otherprops" val="internal" action="exclude"/>',
    '  <revprop val="2.4" action="flag" color="#6d28d9" backcolor="#ede9fe" style="bold">',
    '    <startflag><alt-text>v2.4 Cloud</alt-text></startflag>',
    '  </revprop>',
    '</val>',
    '',
  ].join('\n');

  const onpremDitaval = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<val>',
    '  <prop att="audience" val="admin" action="include"/>',
    '  <prop att="product" val="onprem" action="include"/>',
    '  <prop att="product" val="cloud" action="exclude"/>',
    '  <prop att="otherprops" val="internal" action="exclude"/>',
    '  <prop att="platform" val="linux" action="flag" color="#065f46" backcolor="#d1fae5">',
    '    <startflag><alt-text>Linux</alt-text></startflag>',
    '  </prop>',
    '  <revprop val="2.4" action="flag" color="#1d4ed8" backcolor="#dbeafe" style="bold">',
    '    <startflag><alt-text>NEW v2.4</alt-text></startflag>',
    '  </revprop>',
    '</val>',
    '',
  ].join('\n');

  const files: Record<string, string> = {
    'product-manual.ditamap': rootMapXml,
    'admin-book.bookmap': bookMapXml,
    'maps/getting-started.ditamap': subMapXml,
    'concepts/dita-architecture.dita': conceptXml,
    'concepts/single-sourcing.dita': singleSourcingXml,
    'shared/common-reuse.dita': commonReuseXml,
    'tasks/deploy-worker.dita': sampleTask.xml,
    'references/server-sizing-cals.dita': sampleRef.xml,
    'references/specialized-passthrough.dita': samplePass.xml,
    'filters/cloud-edition.ditaval': cloudDitaval,
    'filters/onprem-admin.ditaval': onpremDitaval,
  };
  void createMapTemplate;

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
  const ditavals: WorkspaceDitavalSummary[] = [];
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
    } else if (kind === 'ditaval' && content !== undefined) {
      try {
        const parsedVal = parseDitaval(content);
        ditavals.push({
          path: filePath,
          name,
          ruleCount: parsedVal.rules.length,
        });
      } catch (err) {
        ditavals.push({
          path: filePath,
          name,
          ruleCount: 0,
          parseError: {
            message: err instanceof Error ? err.message : String(err),
            line: 1,
            column: 1,
            offset: 0,
          },
        });
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

  ditavals.sort((a, b) => a.path.localeCompare(b.path));

  return {
    rootDir: 'memory://demo-dita-project',
    defaultRootDir: 'memory://demo-dita-project',
    name: workspaceName,
    maps,
    ditavals,
    files: rootChildren,
    topicTitles,
    stats,
  };
}
