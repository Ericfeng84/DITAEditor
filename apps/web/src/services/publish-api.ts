import { getActiveScope } from './active-scope.js';
import { apiUrl } from './api-base.js';
import { getCurrentUserId } from './identity-api.js';
import { requestJson } from './workspace-api.js';

import { getCurrentLocale, translate } from '../i18n/index.js';
export type PublishFormat = 'html5' | 'pdf';
export type PublishStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** Phase 12 HTML5 publish themes (mirrors `apps/api/src/modules/publish/html-themes.ts`). */
export type HtmlThemeId =
  | 'tech-docs'
  | 'editorial-paper'
  | 'enterprise-manual'
  | 'dev-dark'
  | 'vanilla';

export type HtmlThemeDefaultMode = 'light' | 'dark';

export interface HtmlThemeFeatures {
  search: boolean;
  toc: boolean;
  codeCopy: boolean;
  colorModeToggle: boolean;
}

export interface HtmlThemeOptions {
  /** `#RRGGBB`; the API accepts a bare `RRGGBB` too and normalizes it. */
  accentColor?: string | null;
  siteTitle?: string | null;
  logoPath?: string | null;
  footerText?: string | null;
  customCssPath?: string | null;
  features?: Partial<HtmlThemeFeatures>;
}

export interface HtmlThemePalette {
  bg: string;
  surface: string;
  header: string;
  text: string;
  accent: string;
  border: string;
}

export interface HtmlThemeDescriptor {
  id: HtmlThemeId;
  name: string;
  description: string;
  tags: string[];
  defaultAccent: string;
  defaultMode: HtmlThemeDefaultMode;
  supportsCustomization: boolean;
  previewPalette: HtmlThemePalette;
  defaultFeatures: HtmlThemeFeatures;
}

export interface ManualPublishProfile {
  manualId: string;
  htmlThemeId: HtmlThemeId;
  htmlThemeOptions: HtmlThemeOptions;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface PublishDiagnostic {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  code?: string;
}

export interface PublishRuntimeInfo {
  available: boolean;
  command: string;
  ditaHome: string | null;
  version: string | null;
  pluginInstalled: boolean;
  pluginPath: string | null;
  fopConfigPath: string | null;
  fontsAvailable: boolean;
  fontsPath: string | null;
  checkedAt: string;
  error?: string;
}

/**
 * Phase 13 publish provenance: what the build was rendered from.
 * `baseline` renders the shared `HEAD`, `tag`/`commit` render an immutable snapshot,
 * `my_drafts` previews the requester's own overlay without touching the shared baseline.
 */
export type PublishSourceMode = 'baseline' | 'tag' | 'commit' | 'my_drafts';

export interface PublishJob {
  id: string;
  /** Resolved HTML5 theme snapshot; `null` for PDF jobs and legacy rows. */
  themeId: HtmlThemeId | null;
  themeOptions: HtmlThemeOptions | null;
  projectId: string;
  branch: string;
  userId: string;
  rootMap: string;
  format: PublishFormat;
  ditaval: string | null;
  title: string;
  status: PublishStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  error: string | null;
  artifactName: string | null;
  artifactSize: number | null;
  diagnostics: PublishDiagnostic[];
  previewUrl: string | null;
  artifactUrl: string | null;
  logUrl: string;
  cancelRequested: boolean;
  /** Phase 13 provenance (absent on rows published before source modes existed). */
  sourceMode?: PublishSourceMode | null;
  sourceRef?: string | null;
  commitHash?: string | null;
  isDirty?: boolean | null;
  /** Paths that were still uncommitted when the build was snapshotted (`my_drafts` previews). */
  dirtyFiles?: string[] | null;
}

export interface StrictValidationResult {
  available: boolean;
  ok: boolean;
  targets: string[];
  diagnostics: PublishDiagnostic[];
  durationMs: number;
  command: string;
  logTail: string;
  runtime: PublishRuntimeInfo;
  message?: string;
}

export interface StrictValidationInput {
  paths?: string[];
  path?: string;
  rootMapPath?: string;
  ditavalPath?: string | null;
}

export async function fetchPublishRuntime(): Promise<{
  runtime: PublishRuntimeInfo;
  publishRootDir: string;
}> {
  return requestJson('/api/publish/runtime', { cache: 'no-store' });
}

function normalizePublishJob(job: PublishJob): PublishJob {
  const preview = job.previewUrl
    ? job.previewUrl.endsWith('/preview/')
      ? `${job.previewUrl}index.html`
      : job.previewUrl
    : null;
  return {
    ...job,
    previewUrl: preview ? apiUrl(preview) : null,
    artifactUrl: job.artifactUrl ? apiUrl(job.artifactUrl) : null,
    logUrl: apiUrl(job.logUrl),
  };
}

export async function fetchPublishJobs(limit = 20): Promise<{ branch: string; jobs: PublishJob[] }> {
  const result = await requestJson<{ branch: string; jobs: PublishJob[] }>(
    `/api/publish/jobs?limit=${encodeURIComponent(String(limit))}`,
    {
      cache: 'no-store',
    },
  );
  return { ...result, jobs: result.jobs.map(normalizePublishJob) };
}

export async function fetchPublishJob(id: string): Promise<PublishJob> {
  const result = await requestJson<{ job: PublishJob }>(`/api/publish/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  return normalizePublishJob(result.job);
}

export interface CreatePublishJobInput {
  rootMap: string;
  /** Phase 13: which snapshot to render (defaults to `baseline` on the API). */
  sourceMode?: PublishSourceMode;
  /** Phase 13: tag name or commit SHA for `tag` / `commit` sources. */
  sourceRef?: string;
  format: PublishFormat;
  ditaval?: string | null;
  title?: string;
  themeId?: HtmlThemeId;
  themeOptions?: HtmlThemeOptions;
  saveAsDefault?: boolean;
}

export async function createPublishJob(input: CreatePublishJobInput): Promise<PublishJob> {
  const { themeOptions, ...rest } = input;
  // The API names the request field `htmlThemeOptions` (it also merges the manual profile).
  const body = themeOptions === undefined ? rest : { ...rest, htmlThemeOptions: themeOptions };
  const result = await requestJson<{ job: PublishJob }>('/api/publish/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return normalizePublishJob(result.job);
}

export async function fetchHtmlThemes(): Promise<HtmlThemeDescriptor[]> {
  const result = await requestJson<{ themes: HtmlThemeDescriptor[] }>('/api/publish/themes', {
    cache: 'no-store',
  });
  return result.themes;
}

export async function fetchPublishProfile(): Promise<ManualPublishProfile> {
  const result = await requestJson<{ profile: ManualPublishProfile }>('/api/publish/profile', {
    cache: 'no-store',
  });
  return result.profile;
}

export async function savePublishProfile(input: {
  themeId: HtmlThemeId;
  themeOptions?: HtmlThemeOptions;
}): Promise<ManualPublishProfile> {
  const result = await requestJson<{ profile: ManualPublishProfile }>('/api/publish/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return result.profile;
}

export interface HtmlThemePreviewParams {
  themeId: HtmlThemeId;
  mode: HtmlThemeDefaultMode;
  options: HtmlThemeOptions;
  locale: string;
  manualId?: string | null;
  branch?: string | null;
  /** Cache-busting token so a debounced iframe reload always re-requests the document. */
  cacheBust?: string | number;
}

const ACCENT_PATTERN = /^#?[0-9a-fA-F]{6}$/;
const PREVIEW_FEATURE_KEYS = ['search', 'toc', 'codeCopy', 'colorModeToggle'] as const;

/**
 * Same-origin preview URL for the iframe in `ThemePreviewModal`. Headers cannot be sent by an
 * `<iframe src>`, so the manual/branch scope travels as query parameters (the API resolver reads
 * both); features are encoded as `1`/`0` exactly like the preview route expects.
 */
export function htmlThemePreviewUrl(params: HtmlThemePreviewParams): string {
  const query = new URLSearchParams();
  const accent = params.options.accentColor?.trim().replace(/^#/, '') ?? '';
  if (accent && ACCENT_PATTERN.test(accent)) query.set('accent', accent.toLowerCase());
  if (params.options.siteTitle) query.set('title', params.options.siteTitle);
  if (params.options.footerText) query.set('footer', params.options.footerText);
  const features = params.options.features ?? {};
  for (const key of PREVIEW_FEATURE_KEYS) {
    const flag = features[key];
    if (typeof flag === 'boolean') query.set(key, flag ? '1' : '0');
  }
  query.set('mode', params.mode);
  query.set('locale', params.locale);
  if (params.manualId) query.set('manualId', params.manualId);
  if (params.branch) query.set('branch', params.branch);
  if (params.cacheBust !== undefined) query.set('_', String(params.cacheBust));
  return apiUrl(`/api/publish/themes/${encodeURIComponent(params.themeId)}/preview?${query.toString()}`);
}

export async function cancelPublishJob(id: string): Promise<PublishJob> {
  const result = await requestJson<{ job: PublishJob }>(
    `/api/publish/jobs/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  return normalizePublishJob(result.job);
}

export async function runStrictValidation(
  input: StrictValidationInput,
): Promise<StrictValidationResult> {
  return requestJson('/api/validate/strict', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function fetchPublishLog(id: string, offset = 0): Promise<{
  content: string;
  offset: number;
  size: number;
  complete: boolean;
}> {
  return requestJson(
    `/api/publish/jobs/${encodeURIComponent(id)}/log?offset=${encodeURIComponent(String(offset))}`,
    { cache: 'no-store' },
  );
}

export interface PublishEventHandlers {
  onLog?: (content: string, offset: number) => void;
  onStatus?: (job: PublishJob) => void;
  onEnd?: (payload: unknown) => void;
}

function parseEventFrame(frame: string): { event: string; data: unknown } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(raw) as unknown };
  } catch {
    return { event, data: raw };
  }
}

/**
 * Consume the server-sent event stream with fetch so the identity header is preserved
 * (native EventSource cannot send custom headers). Returns when the server ends the stream.
 */
export async function streamPublishJobEvents(
  id: string,
  handlers: PublishEventHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    accept: 'text/event-stream',
    'x-dita-locale': getCurrentLocale(),
  };
  const userId = getCurrentUserId();
  if (userId) headers['x-dita-user-id'] = userId;
  const scope = getActiveScope();
  if (scope.manualId) headers['x-dita-manual-id'] = scope.manualId;
  if (scope.branch) headers['x-dita-branch'] = scope.branch;
  const response = await fetch(
    apiUrl(`/api/publish/jobs/${encodeURIComponent(id)}/events`),
    { headers, cache: 'no-store', signal },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? translate(getCurrentLocale(), 'publishApi.logStreamFailed', { status: String(response.status) }));
  }
  if (!response.body) throw new Error(translate(getCurrentLocale(), 'publishApi.noStream'));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseEventFrame(frame);
        if (parsed?.event === 'log') {
          const data = parsed.data as { content?: string; offset?: number };
          if (data.content) handlers.onLog?.(data.content, data.offset ?? 0);
        } else if (parsed?.event === 'status') {
          const data = parsed.data as { job?: PublishJob };
          if (data.job) handlers.onStatus?.(normalizePublishJob(data.job));
        } else if (parsed?.event === 'end') {
          handlers.onEnd?.(parsed.data);
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
