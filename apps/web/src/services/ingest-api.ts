/**
 * Phase 14 — typed client for the document ingest API (`apps/api/src/modules/ingest/routes.ts`).
 *
 * Two things are worth calling out:
 * 1. Every request goes through `requestJson`, so the `VITE_BASE` reverse-proxy subpath,
 *    `x-dita-user-id`, `x-dita-locale` and the manual/branch scope headers are applied once.
 * 2. The job stream (`/api/ingest/jobs/:id/stream`) uses a `fetch()` reader instead of
 *    `EventSource` because the API identifies the caller (and the UI locale) through headers,
 *    which `EventSource` cannot send.
 */

import type {
  ExtractedIngestAsset,
  IngestEngineChoice,
  IngestJobProgress,
  IngestJobResult,
  IngestOutlinePlan,
  IngestSuggestedKey,
  IngestTopicProgress,
  IngestValidationReport,
  MarkdownSection,
  PlannedTopicNode,
} from '@dita/core';
import { apiUrl } from './api-base.js';
import { ApiHttpError, requestJson } from './workspace-api.js';
import { getCurrentUserId } from './identity-api.js';
import { applyScopeHeaders } from './active-scope.js';
import { getCurrentLocale, translate } from '../i18n/index.js';

export type {
  ExtractedIngestAsset,
  IngestEngineChoice,
  IngestOutlinePlan,
  IngestSuggestedKey,
  IngestTopicProgress,
  PlannedTopicNode,
};

export type IngestTargetMode = 'new_manual' | 'single_topic' | 'multi_topic';

export type IngestJobStatus =
  | 'queued'
  | 'parsing'
  | 'planning'
  | 'awaiting_plan_approval'
  | 'writing'
  | 'validating'
  | 'repairing'
  | 'materializing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type IngestMapKind = 'map' | 'bookmap';
export type IngestTopicType = 'concept' | 'task' | 'reference' | 'topic';
export type IngestTopicTypeChoice = IngestTopicType | 'auto';

/** Runtime probe detail for one parser (mirrors `ParserRuntimeDetail`). */
export interface IngestParserRuntimeDetail {
  available: boolean;
  version: string | null;
  details: string | null;
}

/** Mirrors `ParserRuntimeDetection` from `app/api/src/modules/ingest/parser-settings-service.ts`. */
export interface IngestParserRuntimeDetection {
  direct: { available: true; extensions: readonly string[] };
  doclingServe: IngestParserRuntimeDetail & { url: string | null };
  doclingCli: IngestParserRuntimeDetail & { command: string };
  markitdownCli: IngestParserRuntimeDetail & { command: string; enabled: boolean };
  supportedExtensions: readonly string[];
}

export type IngestDoclingMode = 'auto' | 'serve' | 'cli' | 'off';

/** Mirrors `IngestParserPublicConfig` (secrets are reduced to `has*`/`masked*`). */
export interface IngestParserPublicConfig {
  defaultEngine: IngestEngineChoice;
  preferMarkitdownForOffice: boolean;
  doclingMode: IngestDoclingMode;
  doclingServeUrl: string | null;
  hasDoclingApiKey: boolean;
  maskedDoclingApiKey: string | null;
  doclingCliCommand: string;
  doclingDoOcr: boolean;
  doclingTableMode: 'fast' | 'accurate';
  markitdownEnabled: boolean;
  markitdownCliCommand: string;
  markitdownKeepDataUris: boolean;
  timeoutMs: number;
  maxFileMb: number;
  supportedExtensions: readonly string[];
  canEdit: boolean;
}

/** Mirrors `IngestParserConfigInput`; `doclingApiKey: null` clears the stored key. */
export interface IngestParserConfigPatch {
  defaultEngine?: IngestEngineChoice;
  preferMarkitdownForOffice?: boolean;
  doclingMode?: IngestDoclingMode;
  doclingServeUrl?: string | null;
  doclingApiKey?: string | null;
  doclingCliCommand?: string;
  doclingDoOcr?: boolean;
  doclingTableMode?: 'fast' | 'accurate';
  markitdownEnabled?: boolean;
  markitdownCliCommand?: string;
  markitdownKeepDataUris?: boolean;
  timeoutMs?: number;
  maxFileMb?: number;
}

/** Mirrors `IngestJobOptions`, the tuning bag persisted with every job. */
export interface IngestJobOptions {
  engine: IngestEngineChoice;
  language?: string;
  mapKind?: IngestMapKind;
  topicType?: IngestTopicTypeChoice;
  targetDir?: string;
  instruction?: string;
  maxTopics?: number;
  manualName?: string;
  manualDescription?: string;
  mountMapPath?: string | null;
  mountParentPath?: number[] | null;
  locale?: string;
}

/** Mirrors `IngestJobView`. */
export interface IngestJobView {
  id: string;
  targetMode: IngestTargetMode;
  projectId: string | null;
  branch: string | null;
  userId: string;
  sourceFilename: string;
  sourceExt: string;
  sourceSize: number;
  requestedEngine: IngestEngineChoice;
  engineUsed: string | null;
  status: IngestJobStatus;
  autoApprove: boolean;
  options: IngestJobOptions;
  assets: ExtractedIngestAsset[];
  plan: IngestOutlinePlan | null;
  progress: IngestJobProgress | null;
  validation: IngestValidationReport | null;
  result: IngestJobResult | null;
  createdManualId: string | null;
  error: string | null;
  cancelRequested: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Mirrors `IngestMarkdownView`. */
export interface IngestMarkdownView {
  jobId: string;
  status: IngestJobStatus;
  markdown: string;
  sections: MarkdownSection[];
  assets: ExtractedIngestAsset[];
  plan: IngestOutlinePlan | null;
}

/** Mirrors `ReplanOptions`. */
export interface IngestReplanOptions {
  language?: string;
  mapKind?: IngestMapKind;
  topicType?: IngestTopicTypeChoice;
  targetDir?: string;
  instruction?: string;
  maxTopics?: number;
}

/** Mirrors `IngestStreamEvent`; `data` already carries `type`, so `type` is the discriminator. */
export type IngestStreamEvent =
  | { type: 'snapshot'; job: IngestJobView }
  | { type: 'status'; status: IngestJobStatus; progress: IngestJobProgress | null; message?: string }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | {
      type: 'plan_ready';
      plan: IngestOutlinePlan;
      assets: ExtractedIngestAsset[];
      warnings: string[];
    }
  | { type: 'topic_progress'; topic: IngestTopicProgress }
  | { type: 'validation'; report: IngestValidationReport }
  | { type: 'done'; job: IngestJobView }
  | { type: 'error'; message: string }
  | { type: 'cancelled'; job: IngestJobView };

export interface IngestLogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface IngestStreamHandlers {
  onSnapshot?: (job: IngestJobView) => void;
  onStatus?: (event: Extract<IngestStreamEvent, { type: 'status' }>) => void;
  onLog?: (entry: IngestLogEntry) => void;
  onPlanReady?: (event: Extract<IngestStreamEvent, { type: 'plan_ready' }>) => void;
  onTopicProgress?: (topic: IngestTopicProgress) => void;
  onValidation?: (report: IngestValidationReport) => void;
  onDone?: (job: IngestJobView) => void;
  onCancelled?: (job: IngestJobView) => void;
  onError?: (message: string) => void;
}

/** Everything the upload step may send; optional fields are omitted from the multipart body. */
export interface IngestJobUpload {
  file: File;
  targetMode: IngestTargetMode;
  engine: IngestEngineChoice;
  autoApprove: boolean;
  language?: string;
  mapKind?: IngestMapKind;
  topicType?: IngestTopicTypeChoice;
  targetDir?: string;
  instruction?: string;
  maxTopics?: number;
  manualName?: string;
  manualDescription?: string;
  manualId?: string;
  branch?: string;
  mountMapPath?: string;
  mountParentPath?: number[];
}

/* ------------------------------------------------------------------------------------------ */
/* Parser configuration                                                                        */
/* ------------------------------------------------------------------------------------------ */

export function fetchIngestConfig(): Promise<IngestParserPublicConfig> {
  return requestJson<IngestParserPublicConfig>('/api/ingest/config');
}

export function updateIngestConfig(
  patch: IngestParserConfigPatch,
): Promise<IngestParserPublicConfig> {
  return requestJson<IngestParserPublicConfig>('/api/ingest/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function testIngestConfig(): Promise<IngestParserRuntimeDetection> {
  return requestJson<IngestParserRuntimeDetection>('/api/ingest/config/test', { method: 'POST' });
}

/* ------------------------------------------------------------------------------------------ */
/* Jobs                                                                                       */
/* ------------------------------------------------------------------------------------------ */

function appendField(form: FormData, key: string, value: string | number | undefined): void {
  if (value === undefined) return;
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (!text) return;
  form.append(key, text);
}

/**
 * Creates a job. The browser must set the multipart boundary itself, so no
 * `Content-Type` header is passed here — `requestJson` only adds identity/scope headers.
 */
export function createIngestJob(upload: IngestJobUpload): Promise<IngestJobView> {
  const form = new FormData();
  form.append('file', upload.file, upload.file.name);
  form.append('targetMode', upload.targetMode);
  form.append('engine', upload.engine);
  form.append('autoApprove', upload.autoApprove ? 'true' : 'false');
  appendField(form, 'language', upload.language);
  appendField(form, 'mapKind', upload.mapKind);
  appendField(form, 'topicType', upload.topicType);
  appendField(form, 'targetDir', upload.targetDir);
  appendField(form, 'instruction', upload.instruction);
  appendField(form, 'maxTopics', upload.maxTopics);
  appendField(form, 'manualName', upload.manualName);
  appendField(form, 'manualDescription', upload.manualDescription);
  appendField(form, 'manualId', upload.manualId);
  appendField(form, 'branch', upload.branch);
  appendField(form, 'mountMapPath', upload.mountMapPath);
  if (upload.mountParentPath && upload.mountParentPath.length > 0) {
    form.append('mountParentPath', JSON.stringify(upload.mountParentPath));
  }
  return requestJson<IngestJobView>('/api/ingest/jobs', { method: 'POST', body: form });
}

export function listIngestJobs(limit?: number): Promise<{ jobs: IngestJobView[] }> {
  const qs = limit ? `?limit=${encodeURIComponent(String(limit))}` : '';
  return requestJson<{ jobs: IngestJobView[] }>(`/api/ingest/jobs${qs}`);
}

export function fetchIngestJob(jobId: string): Promise<IngestJobView> {
  return requestJson<IngestJobView>(`/api/ingest/jobs/${encodeURIComponent(jobId)}`);
}

export function fetchIngestMarkdown(jobId: string): Promise<IngestMarkdownView> {
  return requestJson<IngestMarkdownView>(`/api/ingest/jobs/${encodeURIComponent(jobId)}/markdown`);
}

export function updateIngestMarkdown(jobId: string, markdown: string): Promise<IngestMarkdownView> {
  return requestJson<IngestMarkdownView>(`/api/ingest/jobs/${encodeURIComponent(jobId)}/markdown`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown }),
  });
}

/**
 * `<img src>` cannot send identity headers, so the caller is repeated as a query parameter
 * (same convention as workspace assets, which keep draft images owner-scoped).
 */
export function ingestAssetUrl(jobId: string, assetId: string): string {
  const params = new URLSearchParams();
  const userId = getCurrentUserId();
  if (userId) params.set('userId', userId);
  const qs = params.toString();
  return apiUrl(
    `/api/ingest/jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(assetId)}${qs ? `?${qs}` : ''}`,
  );
}

export function replanIngestJob(
  jobId: string,
  options: IngestReplanOptions = {},
): Promise<IngestJobView> {
  return requestJson<IngestJobView>(`/api/ingest/jobs/${encodeURIComponent(jobId)}/replan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
}

/** `plan` is optional: omitting it approves the plan the Planner agent produced. */
export function approveIngestJob(
  jobId: string,
  plan?: IngestOutlinePlan | null,
): Promise<IngestJobView> {
  return requestJson<IngestJobView>(`/api/ingest/jobs/${encodeURIComponent(jobId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan ? { plan } : {}),
  });
}

export function cancelIngestJob(jobId: string): Promise<IngestJobView> {
  return requestJson<IngestJobView>(`/api/ingest/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
}

/* ------------------------------------------------------------------------------------------ */
/* SSE                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** The stream is terminal once one of these arrives; the reader then stops. */
const TERMINAL_EVENTS = new Set<IngestStreamEvent['type']>(['done', 'error', 'cancelled']);

function ingestStreamHeaders(): Record<string, string> {
  const headers = new Headers({ accept: 'text/event-stream' });
  const userId = getCurrentUserId();
  if (userId) headers.set('x-dita-user-id', userId);
  headers.set('x-dita-locale', getCurrentLocale());
  applyScopeHeaders(headers);
  const bag: Record<string, string> = {};
  headers.forEach((value, key) => {
    bag[key] = value;
  });
  return bag;
}

/** Parses one SSE frame; the ingest API repeats the full event payload in `data:`. */
function parseIngestFrame(frame: string): IngestStreamEvent | null {
  const dataLines: string[] = [];
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue; // heartbeat / comment
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const payload = dataLines.join('\n');
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (parsed && typeof parsed === 'object' && typeof (parsed as { type?: unknown }).type === 'string') {
      return parsed as IngestStreamEvent;
    }
    return null;
  } catch {
    return null;
  }
}

function dispatchIngestEvent(event: IngestStreamEvent, handlers: IngestStreamHandlers): void {
  switch (event.type) {
    case 'snapshot':
      handlers.onSnapshot?.(event.job);
      return;
    case 'status':
      handlers.onStatus?.(event);
      return;
    case 'log':
      handlers.onLog?.({ level: event.level, message: event.message });
      return;
    case 'plan_ready':
      handlers.onPlanReady?.(event);
      return;
    case 'topic_progress':
      handlers.onTopicProgress?.(event.topic);
      return;
    case 'validation':
      handlers.onValidation?.(event.report);
      return;
    case 'done':
      handlers.onDone?.(event.job);
      return;
    case 'cancelled':
      handlers.onCancelled?.(event.job);
      return;
    case 'error':
      handlers.onError?.(event.message);
      return;
    default:
      return;
  }
}

function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Streams one ingest job until it finishes, fails, is cancelled, or `signal` aborts.
 *
 * Resolves when the stream ends cleanly; rejects with `AbortError` when aborted (callers
 * treat that as a normal teardown) and with `ApiHttpError` if the endpoint refuses the job.
 */
export async function subscribeIngestStream(
  jobId: string,
  handlers: IngestStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(apiUrl(`/api/ingest/jobs/${encodeURIComponent(jobId)}/stream`), {
    method: 'GET',
    headers: ingestStreamHeaders(),
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiHttpError(
      response.status,
      payload.error ?? translate(getCurrentLocale(), 'ingest.error.loadFailed', { message: String(response.status) }),
    );
  }
  if (!response.body) {
    throw new Error(translate(getCurrentLocale(), 'ingest.error.streamLost', { message: String(response.status) }));
  }
  if (signal?.aborted) throw abortError();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  let buffer = '';
  let terminal = false;

  const consume = (frame: string): void => {
    const event = parseIngestFrame(frame);
    if (!event) return;
    dispatchIngestEvent(event, handlers);
    if (TERMINAL_EVENTS.has(event.type)) terminal = true;
  };

  try {
    while (!terminal) {
      if (signal?.aborted) throw abortError();
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        consume(frame);
        if (terminal) break;
        boundary = buffer.indexOf('\n\n');
      }
    }
    if (!terminal && buffer.trim()) consume(buffer);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    try {
      reader.releaseLock();
    } catch {
      // The reader was already released by an abort-triggered cancel.
    }
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Helpers shared by the wizard                                                               */
/* ------------------------------------------------------------------------------------------ */

/** Total auto-repair passes applied across all topics (result scorecard). */
export function countIngestRepairs(report: IngestValidationReport | null): number {
  if (!report) return 0;
  return report.topics.reduce((total, topic) => total + (topic.repaired ? Math.max(topic.attempts, 1) : 0), 0);
}

export function isIngestTerminal(status: IngestJobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

/** Collects a plan's topics depth-first (used for counters and per-topic cards). */
export function flattenPlannedTopics(topics: PlannedTopicNode[]): PlannedTopicNode[] {
  const out: PlannedTopicNode[] = [];
  const walk = (nodes: PlannedTopicNode[]): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(topics);
  return out;
}

/** Key suggestions are only advisory in the review pane. */
export function countSuggestedKeys(keys: IngestSuggestedKey[]): number {
  return keys.filter((entry) => entry.keys.trim().length > 0).length;
}
