import { getActiveScope } from './active-scope.js';
import { getCurrentUserId } from './identity-api.js';
import { requestJson } from './workspace-api.js';

import { getCurrentLocale, translate } from '../i18n/index.js';
export type PublishFormat = 'html5' | 'pdf';
export type PublishStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

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

export interface PublishJob {
  id: string;
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

export async function fetchPublishJobs(limit = 20): Promise<{ branch: string; jobs: PublishJob[] }> {
  return requestJson(`/api/publish/jobs?limit=${encodeURIComponent(String(limit))}`, {
    cache: 'no-store',
  });
}

export async function fetchPublishJob(id: string): Promise<PublishJob> {
  const result = await requestJson<{ job: PublishJob }>(`/api/publish/jobs/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  return result.job;
}

export async function createPublishJob(input: {
  rootMap: string;
  format: PublishFormat;
  ditaval?: string | null;
  title?: string;
}): Promise<PublishJob> {
  const result = await requestJson<{ job: PublishJob }>('/api/publish/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return result.job;
}

export async function cancelPublishJob(id: string): Promise<PublishJob> {
  const result = await requestJson<{ job: PublishJob }>(
    `/api/publish/jobs/${encodeURIComponent(id)}/cancel`,
    { method: 'POST' },
  );
  return result.job;
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
    `/api/publish/jobs/${encodeURIComponent(id)}/events`,
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
          if (data.job) handlers.onStatus?.(data.job);
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
