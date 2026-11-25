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
import { getCurrentLocale } from '../i18n/index.js';
import { applyScopeHeaders } from './active-scope.js';
import { apiUrl } from './api-base.js';
import { getCurrentUserId } from './identity-api.js';

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
  projectRootDir?: string;
  rootDir: string;
  defaultRootDir: string;
  name: string;
  maps: WorkspaceMapSummary[];
  ditavals: WorkspaceDitavalSummary[];
  files: WorkspaceFileNode[];
  topicTitles: Record<string, string>;
  topicTypes?: Record<string, DitaTopicTemplateType>;
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

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  const userId = getCurrentUserId();
  if (userId) headers.set('x-dita-user-id', userId);
  headers.set('x-dita-locale', getCurrentLocale());
  applyScopeHeaders(headers);
  const res = await fetch(apiUrl(url), { ...init, headers });
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

  const res = await fetch(apiUrl('/api/assets/upload'), {
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
  const uploaded = data as UploadAssetResult;
  return uploaded.previewUrl
    ? { ...uploaded, previewUrl: apiUrl(uploaded.previewUrl) }
    : uploaded;
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
    if (trimmed.startsWith('/api/')) return apiUrl(trimmed);
    return apiUrl(`/api/assets/resolve?from=${encodeURIComponent(docPath)}&href=${encodeURIComponent(trimmed)}`);
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
