import { apiUrl } from '../services/api-base';
import { getCurrentUserId } from '../services/identity-api';
import { getCurrentLocale, translate } from '../i18n/index.js';
import { requestJson } from '../services/workspace-api';
import type {
  AiConfigPatch,
  AiConfigTestInput,
  AiConfigTestResult,
  AiDoneEvent,
  AiErrorEvent,
  AiMetaEvent,
  AiProposal,
  AiPublicConfig,
  AiRetryEvent,
  AiStreamRequest,
  AiUsageSummary,
} from './ai-types';

interface ParsedSseFrame {
  event: string;
  data: unknown;
}

/**
 * Parse one `event: <name>\ndata: <json>` frame. Multi-line `data:` payloads are
 * joined with newlines before JSON decoding, mirroring `services/publish-api.ts`.
 */
export function parseAiSseFrame(frame: string): ParsedSseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
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

export interface AiStreamHandlers {
  onMeta?: (event: AiMetaEvent) => void;
  onDelta?: (text: string) => void;
  onRetry?: (event: AiRetryEvent) => void;
  onProposal?: (proposal: AiProposal) => void;
  onError?: (event: AiErrorEvent) => void;
  onDone?: (event: AiDoneEvent) => void;
}

function abortError(): Error {
  const error = new Error(translate(getCurrentLocale(), 'aiApi.cancelled'));
  error.name = 'AbortError';
  return error;
}

/**
 * Consume the AI SSE stream with `fetch` so the identity header is preserved
 * (native `EventSource` cannot send custom headers or POST bodies).
 */
export async function streamAiRequest(
  request: AiStreamRequest,
  handlers: AiStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    accept: 'text/event-stream',
    'content-type': 'application/json',
    'x-dita-locale': getCurrentLocale(),
  };
  const userId = getCurrentUserId();
  if (userId) headers['x-dita-user-id'] = userId;

  const response = await fetch(apiUrl('/api/ai/stream'), {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? translate(getCurrentLocale(), 'aiApi.streamFailed', { status: String(response.status) }));
  }
  if (!response.body) throw new Error(translate(getCurrentLocale(), 'aiApi.noStream'));

  if (signal?.aborted) throw abortError();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  let buffer = '';

  try {
    for (;;) {
      if (signal?.aborted) throw abortError();
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        dispatchFrame(parseAiSseFrame(frame), handlers);
        boundary = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) dispatchFrame(parseAiSseFrame(buffer), handlers);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}

function dispatchFrame(frame: ParsedSseFrame | null, handlers: AiStreamHandlers): void {
  if (!frame) return;
  switch (frame.event) {
    case 'meta':
      handlers.onMeta?.(frame.data as AiMetaEvent);
      return;
    case 'delta':
      handlers.onDelta?.((frame.data as { text?: string }).text ?? '');
      return;
    case 'retry':
      handlers.onRetry?.(frame.data as AiRetryEvent);
      return;
    case 'proposal':
      handlers.onProposal?.(frame.data as AiProposal);
      return;
    case 'error':
      handlers.onError?.(frame.data as AiErrorEvent);
      return;
    case 'done':
      handlers.onDone?.(frame.data as AiDoneEvent);
      return;
    default:
      return;
  }
}

export async function fetchAiConfig(): Promise<AiPublicConfig> {
  return requestJson<AiPublicConfig>('/api/ai/config', { cache: 'no-store' });
}

export async function saveAiConfig(patch: AiConfigPatch): Promise<AiPublicConfig> {
  await requestJson('/api/ai/config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return fetchAiConfig();
}

export async function testAiConfig(input: AiConfigTestInput): Promise<AiConfigTestResult> {
  return requestJson<AiConfigTestResult>('/api/ai/config/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function fetchAiUsage(days = 30, limit = 50): Promise<AiUsageSummary> {
  return requestJson<AiUsageSummary>(
    `/api/ai/usage?days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`,
    { cache: 'no-store' },
  );
}
