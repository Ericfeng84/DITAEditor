import { mkdir, readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  findProducedMarkdown,
  materializeMarkdownAssets,
  readTextFile,
  saveDataUriImages,
} from './assets.js';
import { createCommandRunner, splitCommandLine } from './command-runner.js';
import { IngestParseError, type ParseDocumentInput, type ParsedDocumentOutput } from './types.js';
import { extractDataUriImages } from '@dita/core';

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 120_000;

interface ServeTaskEnvelope {
  task_id?: unknown;
  taskId?: unknown;
  task_status?: unknown;
  error?: unknown;
  message?: unknown;
}

interface ServeResultEnvelope {
  document?: { md_content?: unknown; md?: unknown; markdown?: unknown };
  md_content?: unknown;
  md?: unknown;
  markdown?: unknown;
  task_status?: unknown;
}

function readString(source: unknown, keys: string[]): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new IngestParseError('cancelled', 'The document parse was cancelled.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new IngestParseError('cancelled', 'The document parse was cancelled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** `fetch` with a per-request timeout that also honours the caller's `AbortSignal`. */
async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  if (signal?.aborted) {
    throw new IngestParseError('cancelled', 'The document parse was cancelled.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));
  const onAbort = (): void => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) {
      throw new IngestParseError('cancelled', 'The document parse was cancelled.');
    }
    if (controller.signal.aborted) {
      throw new IngestParseError('timeout', `Docling serve did not answer within ${timeoutMs} ms.`);
    }
    throw new IngestParseError(
      'parse-failed',
      `Docling serve request failed: ${error instanceof Error ? error.message : String(error)}`,
      { url },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function readJson(response: Response, context: string): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new IngestParseError(
      'parse-failed',
      `Docling serve ${context} failed with HTTP ${response.status}: ${text.slice(0, 400)}`,
      { status: response.status },
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new IngestParseError('parse-failed', `Docling serve ${context} returned invalid JSON.`);
  }
}

/**
 * Converts a document through a running `docling-serve` instance using the async convert API:
 * upload → poll status → fetch result. Embedded data-URI images are lifted into `assetsDir`
 * and referenced as `asset://img_NNN.<ext>`.
 */
export async function parseWithDoclingServe(input: ParseDocumentInput): Promise<ParsedDocumentOutput> {
  const { config } = input;
  const serveUrl = config.doclingServeUrl?.replace(/\/+$/, '');
  if (!serveUrl) {
    throw new IngestParseError('engine-unavailable', 'No Docling serve URL is configured.');
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const headers: Record<string, string> = {};
  if (config.doclingApiKey) headers['X-Api-Key'] = config.doclingApiKey;

  const fileBuffer = await readFile(input.inputPath);
  const fileName = basename(input.inputPath);
  const form = new FormData();
  form.append('files', new Blob([new Uint8Array(fileBuffer)]), fileName);
  form.append('to_formats', 'md');
  form.append('image_export_mode', 'embedded');
  form.append('do_ocr', config.doclingDoOcr ? 'true' : 'false');
  form.append('table_mode', config.doclingTableMode);

  const submit = await fetchWithTimeout(
    fetchImpl,
    `${serveUrl}/v1/convert/file/async`,
    { method: 'POST', headers, body: form },
    Math.min(config.timeoutMs, REQUEST_TIMEOUT_MS),
    input.signal,
  );
  const submitted = (await readJson(submit, 'submit')) as ServeTaskEnvelope;
  const taskId = readString(submitted, ['task_id', 'taskId']);
  if (!taskId) {
    throw new IngestParseError('parse-failed', 'Docling serve did not return a task id.');
  }

  const deadline = Date.now() + config.timeoutMs;
  try {
    for (;;) {
      if (Date.now() > deadline) {
        throw new IngestParseError(
          'timeout',
          `Docling serve conversion exceeded ${config.timeoutMs} ms.`,
        );
      }
      await delay(input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, input.signal);
      const poll = await fetchWithTimeout(
        fetchImpl,
        `${serveUrl}/v1/status/poll/${encodeURIComponent(taskId)}`,
        { method: 'GET', headers },
        Math.min(config.timeoutMs, REQUEST_TIMEOUT_MS),
        input.signal,
      );
      const status = (await readJson(poll, 'status')) as ServeTaskEnvelope;
      const state = (readString(status, ['task_status', 'status']) ?? 'pending').toLowerCase();
      if (state === 'success' || state === 'succeeded' || state === 'completed') break;
      if (state === 'failure' || state === 'failed' || state === 'error' || state === 'revoked') {
        const detail =
          readString(status, ['error', 'message']) ?? readString(status, ['task_status']);
        throw new IngestParseError(
          'parse-failed',
          `Docling serve conversion failed: ${detail ?? 'unknown error'}`,
          { taskId },
        );
      }
    }

    const resultResponse = await fetchWithTimeout(
      fetchImpl,
      `${serveUrl}/v1/result/${encodeURIComponent(taskId)}`,
      { method: 'GET', headers },
      Math.min(config.timeoutMs, REQUEST_TIMEOUT_MS),
      input.signal,
    );
    const result = (await readJson(resultResponse, 'result')) as ServeResultEnvelope;
    const markdown =
      readString(result.document, ['md_content', 'md', 'markdown']) ??
      readString(result, ['md_content', 'md', 'markdown']);
    if (markdown === null) {
      throw new IngestParseError('parse-failed', 'Docling serve result contained no Markdown.');
    }

    const extracted = extractDataUriImages(markdown);
    const assets = await saveDataUriImages(extracted.images, input.assetsDir);
    const warnings: string[] = [];
    if (!extracted.markdown.trim()) warnings.push('Docling returned an empty Markdown document.');
    return { markdown: extracted.markdown, engine: 'docling-serve', assets, warnings };
  } catch (error) {
    // Best-effort remote cancellation so a timed-out/aborted job does not keep a worker busy.
    try {
      await fetchImpl(`${serveUrl}/v1/convert/file/async/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        headers,
      });
    } catch {
      // Ignore — the job is already failing.
    }
    throw error;
  }
}

/**
 * Converts a document with the local `docling` CLI, asking it to write referenced images next
 * to the Markdown, then copies those images into `assetsDir` and rewrites the references.
 */
export async function parseWithDoclingCli(input: ParseDocumentInput): Promise<ParsedDocumentOutput> {
  const { config } = input;
  const runner = input.commandRunner ?? createCommandRunner();
  const { command, args: leadingArgs } = splitCommandLine(config.doclingCliCommand);
  if (!command) {
    throw new IngestParseError('engine-unavailable', 'No Docling CLI command is configured.');
  }

  await mkdir(input.outputDir, { recursive: true });
  const args = [
    ...leadingArgs,
    input.inputPath,
    '--to',
    'md',
    '--image-export-mode',
    'referenced',
    '--output',
    input.outputDir,
    '--table-mode',
    config.doclingTableMode,
  ];
  if (!config.doclingDoOcr) args.push('--no-ocr');

  const result = await runner.run(command, args, {
    timeoutMs: config.timeoutMs,
    signal: input.signal,
  });
  if (result.exitCode !== 0) {
    const detail = (result.stderr || result.stdout).trim().slice(-800);
    throw new IngestParseError(
      'parse-failed',
      `Docling CLI exited with code ${result.exitCode}${detail ? `: ${detail}` : '.'}`,
      { exitCode: result.exitCode },
    );
  }

  const markdownPath = await findProducedMarkdown(input.outputDir);
  if (!markdownPath) {
    throw new IngestParseError('parse-failed', 'Docling CLI produced no Markdown output.');
  }
  const rawMarkdown = await readTextFile(markdownPath);
  const { markdown, assets } = await materializeMarkdownAssets(rawMarkdown, input.assetsDir, [
    input.outputDir,
  ]);

  const warnings: string[] = [];
  if (!markdown.trim()) warnings.push('Docling CLI produced an empty Markdown document.');
  return { markdown, engine: 'docling-cli', assets, warnings };
}
