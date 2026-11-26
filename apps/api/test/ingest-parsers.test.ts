import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DitaDatabaseHandle } from '../src/db/client.js';
import { HttpError } from '../src/modules/errors.js';
import type { IdentityUser } from '../src/modules/identity/identity-service.js';
import {
  ParserSettingsService,
  readIngestEnvDefaults,
  toParserAvailability,
} from '../src/modules/ingest/parser-settings-service.js';
import { parseWithDoclingCli, parseWithDoclingServe } from '../src/modules/ingest/parsers/docling-parser.js';
import { parseWithMarkItDownCli } from '../src/modules/ingest/parsers/markitdown-parser.js';
import {
  defaultAvailability,
  parseDocumentToMarkdown,
  resolveParserEnginePlan,
} from '../src/modules/ingest/parsers/parser-router.js';
import {
  IngestParseError,
  type CommandResult,
  type CommandRunner,
  type ParseDocumentInput,
  type ParserRuntimeAvailability,
  type ResolvedParserConfig,
} from '../src/modules/ingest/parsers/types.js';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const ADMIN: IdentityUser = {
  id: 'u-admin',
  displayName: 'Admin',
  role: 'admin',
  email: 'admin@example.com',
  color: '#000000',
  initials: 'AD',
};
const WRITER: IdentityUser = { ...ADMIN, id: 'u-writer', role: 'writer', initials: 'WR' };

const tempDirs: string[] = [];
const ENV_KEYS = [
  'INGEST_DEFAULT_ENGINE',
  'INGEST_PREFER_MARKITDOWN_FOR_OFFICE',
  'DOCLING_MODE',
  'DOCLING_SERVE_URL',
  'DOCLING_API_KEY',
  'DOCLING_CLI_COMMAND',
  'DOCLING_DO_OCR',
  'DOCLING_TABLE_MODE',
  'MARKITDOWN_ENABLED',
  'MARKITDOWN_CLI_COMMAND',
  'MARKITDOWN_KEEP_DATA_URIS',
  'DITA_INGEST_TIMEOUT_MS',
  'DITA_INGEST_MAX_FILE_MB',
] as const;

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function tempWorkspace(): { root: string; input: string; outputDir: string; assetsDir: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-ingest-'));
  tempDirs.push(root);
  const outputDir = path.join(root, 'out');
  const assetsDir = path.join(root, 'assets');
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });
  return { root, input: path.join(root, 'source.bin'), outputDir, assetsDir };
}

function baseConfig(overrides: Partial<ResolvedParserConfig> = {}): ResolvedParserConfig {
  return {
    defaultEngine: 'auto',
    preferMarkitdownForOffice: true,
    doclingMode: 'auto',
    doclingServeUrl: null,
    doclingApiKey: null,
    doclingCliCommand: 'docling',
    doclingDoOcr: true,
    doclingTableMode: 'accurate',
    markitdownEnabled: true,
    markitdownCliCommand: 'markitdown',
    markitdownKeepDataUris: true,
    timeoutMs: 15_000,
    maxFileMb: 5,
    ...overrides,
  };
}

function parseInput(
  workspace: ReturnType<typeof tempWorkspace>,
  extension: string,
  overrides: Partial<ParseDocumentInput> = {},
): ParseDocumentInput {
  return {
    inputPath: workspace.input,
    outputDir: workspace.outputDir,
    assetsDir: workspace.assetsDir,
    extension,
    config: baseConfig(),
    ...overrides,
  };
}

class FakeRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: string[] }> = [];

  constructor(
    private readonly handler: (
      command: string,
      args: readonly string[],
    ) => Promise<CommandResult> | CommandResult,
  ) {}

  async run(command: string, args: readonly string[]): Promise<CommandResult> {
    this.calls.push({ command, args: [...args] });
    return await this.handler(command, args);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

interface ServeCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  form?: FormData;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      },
      { once: true },
    );
  });
}

/**
 * Minimal fake of the docling-serve async API. `statuses` is consumed one entry per poll; the
 * last entry repeats, so `['started', 'success']` reports one poll of progress.
 */
function createServeFetch(options: {
  statuses?: string[];
  markdown?: string;
  failSubmit?: boolean;
  pollDelayMs?: number;
} = {}): { fetchImpl: typeof fetch; calls: ServeCall[] } {
  const statuses = options.statuses ?? ['started', 'success'];
  const markdown = options.markdown ?? `# Docling\n\n![fig](data:image/png;base64,${PNG_BASE64})\n`;
  const calls: ServeCall[] = [];
  let pollIndex = 0;

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const href = String(url);
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
      headers[key.toLowerCase()] = String(value);
    }
    const form = init?.body instanceof FormData ? init.body : undefined;
    calls.push({ url: href, method, headers, form });

    if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });

    if (href.endsWith('/v1/convert/file/async') && method === 'POST') {
      if (options.failSubmit) return new Response('boom', { status: 500 });
      return jsonResponse({ task_id: 'task-1', task_status: 'pending' });
    }
    if (href.includes('/v1/status/poll/task-1')) {
      if (options.pollDelayMs) await sleep(options.pollDelayMs, init?.signal);
      const status = statuses[Math.min(pollIndex, statuses.length - 1)]!;
      pollIndex += 1;
      return jsonResponse({ task_id: 'task-1', task_status: status });
    }
    if (href.includes('/v1/result/task-1')) {
      return jsonResponse({ document: { md_content: markdown }, status: 'success' });
    }
    if (method === 'DELETE') return jsonResponse({ status: 'cancelled' });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  return { fetchImpl, calls };
}

function fakeCliRunner(options: {
  markdown?: string;
  images?: Record<string, Buffer>;
  exitCode?: number;
}): FakeRunner {
  return new FakeRunner((_command, args) => {
    const argsList = [...args];
    const outputFlag = argsList.indexOf('--output');
    const outFlag = argsList.indexOf('-o');
    if (outputFlag >= 0) {
      const outDir = argsList[outputFlag + 1]!;
      mkdirSync(path.join(outDir, 'artifacts'), { recursive: true });
      writeFileSync(path.join(outDir, 'report.md'), options.markdown ?? '# Report\n');
      for (const [name, buffer] of Object.entries(options.images ?? {})) {
        const target = path.join(outDir, 'artifacts', name);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, buffer);
      }
    } else if (outFlag >= 0) {
      const target = argsList[outFlag + 1]!;
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, options.markdown ?? '# Report\n');
    }
    return { stdout: 'ok', stderr: '', exitCode: options.exitCode ?? 0 };
  });
}

describe('direct pass-through', () => {
  it('returns Markdown unchanged and lifts data-URI images', async () => {
    const workspace = tempWorkspace();
    const source = `# Notes\n\n![shot](data:image/png;base64,${PNG_BASE64})\n`;
    writeFileSync(workspace.input, source);

    const result = await parseDocumentToMarkdown(parseInput(workspace, '.md'));

    expect(result.engine).toBe('direct');
    expect(result.markdown).toContain('![shot](asset://img_001.png)');
    expect(result.markdown).not.toContain('data:image');
    expect(result.assets).toHaveLength(1);
    expect(existsSync(path.join(workspace.assetsDir, 'img_001.png'))).toBe(true);
  });

  it('passes plain text through without touching it', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'plain notes\n');
    const result = await parseDocumentToMarkdown(parseInput(workspace, '.txt'));
    expect(result).toEqual({ markdown: 'plain notes\n', engine: 'direct', assets: [], warnings: [] });
  });
});

describe('docling-serve parser', () => {
  it('uploads, polls, fetches the result, and externalizes embedded images', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, Buffer.from('%PDF-1.4 demo'));
    const { fetchImpl, calls } = createServeFetch();

    const result = await parseWithDoclingServe(
      parseInput(workspace, '.pdf', {
        fetchImpl,
        pollIntervalMs: 5,
        config: baseConfig({
          doclingServeUrl: 'http://docling.local/',
          doclingApiKey: 'serve-secret',
          doclingTableMode: 'fast',
          doclingDoOcr: false,
        }),
      }),
    );

    expect(result.engine).toBe('docling-serve');
    expect(result.markdown).toContain('![fig](asset://img_001.png)');
    expect(existsSync(path.join(workspace.assetsDir, 'img_001.png'))).toBe(true);
    expect(readFileSync(path.join(workspace.assetsDir, 'img_001.png'))).toEqual(
      Buffer.from(PNG_BASE64, 'base64'),
    );

    const submit = calls.find((call) => call.url === 'http://docling.local/v1/convert/file/async');
    expect(submit?.method).toBe('POST');
    expect(submit?.headers['x-api-key']).toBe('serve-secret');
    expect(submit?.form?.get('to_formats')).toBe('md');
    expect(submit?.form?.get('image_export_mode')).toBe('embedded');
    expect(submit?.form?.get('do_ocr')).toBe('false');
    expect(submit?.form?.get('table_mode')).toBe('fast');
    expect(calls.some((call) => call.url.includes('/v1/status/poll/task-1'))).toBe(true);
    expect(calls.some((call) => call.url.includes('/v1/result/task-1'))).toBe(true);
  });

  it('accepts a flat md_content result envelope', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'docx bytes');
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const href = String(url);
      if (href.endsWith('/v1/convert/file/async')) return jsonResponse({ task_id: 't' });
      if (href.includes('/v1/status/poll/t')) return jsonResponse({ task_status: 'success' });
      if (href.includes('/v1/result/t')) return jsonResponse({ md_content: '# Flat\n' });
      return new Response('', { status: 404 });
    }) as typeof fetch;

    const result = await parseWithDoclingServe(
      parseInput(workspace, '.docx', {
        fetchImpl,
        pollIntervalMs: 1,
        config: baseConfig({ doclingServeUrl: 'http://docling.local' }),
      }),
    );
    expect(result.markdown).toBe('# Flat\n');
  });

  it('cancels the remote task when the caller aborts', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'pdf bytes');
    const { fetchImpl, calls } = createServeFetch({
      statuses: ['started'],
      pollDelayMs: 30,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 80);

    await expect(
      parseWithDoclingServe(
        parseInput(workspace, '.pdf', {
          fetchImpl,
          signal: controller.signal,
          pollIntervalMs: 5,
          config: baseConfig({ doclingServeUrl: 'http://docling.local' }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'cancelled' });
    clearTimeout(timeout);
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });

  it('reports a failed conversion with the server message', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'pdf bytes');
    const { fetchImpl } = createServeFetch({ statuses: ['failure'] });

    await expect(
      parseWithDoclingServe(
        parseInput(workspace, '.pdf', {
          fetchImpl,
          pollIntervalMs: 1,
          config: baseConfig({ doclingServeUrl: 'http://docling.local' }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'parse-failed' });
  });
});

describe('docling CLI parser', () => {
  it('copies referenced images and rewrites them to asset://', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'docx bytes');
    const runner = fakeCliRunner({
      markdown: '# Report\n\n![diagram](artifacts/img1.png)\n',
      images: { 'img1.png': Buffer.from(PNG_BASE64, 'base64') },
    });

    const result = await parseWithDoclingCli(
      parseInput(workspace, '.docx', {
        commandRunner: runner,
        config: baseConfig({ doclingDoOcr: false, doclingTableMode: 'fast' }),
      }),
    );

    expect(result.engine).toBe('docling-cli');
    expect(result.markdown).toContain('![diagram](asset://img_001.png)');
    expect(result.assets).toHaveLength(1);
    expect(existsSync(path.join(workspace.assetsDir, 'img_001.png'))).toBe(true);

    const args = runner.calls[0]!.args;
    expect(args).toContain('--to');
    expect(args).toContain('--image-export-mode');
    expect(args).toContain('--no-ocr');
    expect(args[args.indexOf('--table-mode') + 1]).toBe('fast');
  });

  it('fails cleanly when the CLI exits non-zero', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'docx bytes');
    const runner = new FakeRunner(() => ({ stdout: '', stderr: 'unsupported file', exitCode: 2 }));

    await expect(
      parseWithDoclingCli(parseInput(workspace, '.docx', { commandRunner: runner })),
    ).rejects.toMatchObject({ code: 'parse-failed' });
  });
});

describe('MarkItDown parser', () => {
  it('keeps data URIs on request and converts them into assets', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'office bytes');
    const markdown = `# Office\n\n![pic](data:image/png;base64,${PNG_BASE64})\n`;
    const runner = fakeCliRunner({ markdown });

    const result = await parseWithMarkItDownCli(
      parseInput(workspace, '.docx', { commandRunner: runner }),
    );

    expect(result.engine).toBe('markitdown-cli');
    expect(result.markdown).toContain('![pic](asset://img_001.png)');
    expect(result.assets[0]).toMatchObject({ assetId: 'img_001', extension: 'png', origin: 'data-uri' });
    expect(runner.calls[0]!.args).toContain('--keep-data-uris');
    expect(existsSync(path.join(workspace.assetsDir, 'img_001.png'))).toBe(true);
  });

  it('omits --keep-data-uris when configured off', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'office bytes');
    const runner = fakeCliRunner({ markdown: '# Plain\n' });

    await parseWithMarkItDownCli(
      parseInput(workspace, '.docx', {
        commandRunner: runner,
        config: baseConfig({ markitdownKeepDataUris: false }),
      }),
    );
    expect(runner.calls[0]!.args).not.toContain('--keep-data-uris');
  });

  it('warns when a PDF has almost no extractable text', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'scanned pdf bytes');
    const runner = fakeCliRunner({ markdown: '## 1\n\n.!' });

    const result = await parseWithMarkItDownCli(
      parseInput(workspace, '.pdf', { commandRunner: runner }),
    );

    expect(result.warnings.join(' ')).toMatch(/scanned/i);
    expect(result.markdown).toContain('Docling');
  });
});

describe('parser router', () => {
  function availability(overrides: Partial<ParserRuntimeAvailability> = {}): ParserRuntimeAvailability {
    return {
      direct: true,
      doclingServe: false,
      doclingCli: false,
      markitdownCli: false,
      ...overrides,
    };
  }

  it('rejects unsupported extensions and oversized files', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'binary');
    await expect(
      parseDocumentToMarkdown(parseInput(workspace, '.exe')),
    ).rejects.toMatchObject({ code: 'unsupported-extension' });

    writeFileSync(workspace.input, 'x'.repeat(1.2 * 1024 * 1024));
    await expect(
      parseDocumentToMarkdown(
        parseInput(workspace, '.md', { config: baseConfig({ maxFileMb: 1 }) }),
      ),
    ).rejects.toMatchObject({ code: 'file-too-large' });
  });

  it('routes .pdf to docling-serve first and falls back to the CLI', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'pdf bytes');
    const failingFetch = (async () => {
      throw new Error('connection refused');
    }) as typeof fetch;
    const runner = fakeCliRunner({ markdown: '# From CLI\n' });

    const result = await parseDocumentToMarkdown(
      parseInput(workspace, '.pdf', {
        fetchImpl: failingFetch,
        commandRunner: runner,
        availability: availability({ doclingServe: true, doclingCli: true }),
        config: baseConfig({ doclingServeUrl: 'http://docling.local' }),
      }),
    );

    expect(result.engine).toBe('docling-cli');
    expect(result.markdown).toContain('# From CLI');
  });

  it('prefers MarkItDown for office files when configured', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'docx bytes');
    const runner = fakeCliRunner({ markdown: '# MarkItDown\n' });

    const result = await parseDocumentToMarkdown(
      parseInput(workspace, '.docx', {
        commandRunner: runner,
        availability: availability({ markitdownCli: true, doclingCli: true }),
      }),
    );

    expect(result.engine).toBe('markitdown-cli');
    expect(runner.calls[0]!.command).toBe('markitdown');
  });

  it('uses Docling for office files when MarkItDown is not preferred', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'docx bytes');
    const runner = fakeCliRunner({ markdown: '# Docling CLI\n' });

    const result = await parseDocumentToMarkdown(
      parseInput(workspace, '.docx', {
        commandRunner: runner,
        availability: availability({ markitdownCli: true, doclingCli: true }),
        config: baseConfig({ preferMarkitdownForOffice: false }),
      }),
    );

    expect(result.engine).toBe('docling-cli');
  });

  it('never sends images to MarkItDown and fails when Docling is missing', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'png bytes');
    const runner = fakeCliRunner({ markdown: 'should not run' });

    await expect(
      parseDocumentToMarkdown(
        parseInput(workspace, '.png', {
          commandRunner: runner,
          availability: availability({ markitdownCli: true }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'engine-unavailable' });
    expect(runner.calls).toHaveLength(0);
  });

  it('enforces an explicit engine request without silent switching', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'docx bytes');
    const runner = fakeCliRunner({ markdown: '# MarkItDown\n' });

    await expect(
      parseDocumentToMarkdown(
        parseInput(workspace, '.docx', {
          commandRunner: runner,
          requestedEngine: 'docling',
          availability: availability({ markitdownCli: true }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'engine-unavailable' });
    expect(runner.calls).toHaveLength(0);
  });

  it('rejects an explicit engine that cannot read the extension', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'png bytes');

    await expect(
      parseDocumentToMarkdown(
        parseInput(workspace, '.png', {
          requestedEngine: 'markitdown',
          availability: availability({ markitdownCli: true }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'engine-unsupported' });
  });

  it('reports every failed fallback attempt in auto mode', async () => {
    const workspace = tempWorkspace();
    writeFileSync(workspace.input, 'pdf bytes');
    const failingFetch = (async () => {
      throw new Error('down');
    }) as typeof fetch;
    const failingCli = new FakeRunner(() => ({ stdout: '', stderr: 'cli broken', exitCode: 1 }));

    await expect(
      parseDocumentToMarkdown(
        parseInput(workspace, '.pdf', {
          fetchImpl: failingFetch,
          commandRunner: failingCli,
          availability: availability({ doclingServe: true, doclingCli: true, markitdownCli: true }),
          config: baseConfig({ doclingServeUrl: 'http://docling.local' }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'parse-failed' });
  });

  it('documents the routing matrix through resolveParserEnginePlan', () => {
    const config = baseConfig();
    expect(
      resolveParserEnginePlan('.pdf', config, availability({ doclingServe: true, doclingCli: true, markitdownCli: true })),
    ).toEqual(['docling-serve', 'docling-cli', 'markitdown-cli']);
    expect(
      resolveParserEnginePlan('.docx', config, availability({ doclingServe: true, doclingCli: true, markitdownCli: true })),
    ).toEqual(['markitdown-cli', 'docling-serve', 'docling-cli']);
    expect(
      resolveParserEnginePlan('.csv', config, availability({ doclingCli: true, markitdownCli: true })),
    ).toEqual(['markitdown-cli']);
    expect(
      resolveParserEnginePlan('.png', config, availability({ doclingCli: true, markitdownCli: true })),
    ).toEqual(['docling-cli']);
    expect(defaultAvailability(baseConfig({ doclingMode: 'off' })).doclingCli).toBe(false);
  });
});

describe('ParserSettingsService', () => {
  let handle: DitaDatabaseHandle;
  let service: ParserSettingsService;
  let runner: FakeRunner;

  beforeEach(() => {
    handle = openDatabase(':memory:');
    runner = new FakeRunner((command) => ({
      stdout: command === 'docling' ? 'Docling version 2.1.0\n' : 'markitdown 0.1.1\n',
      stderr: '',
      exitCode: 0,
    }));
    service = new ParserSettingsService(handle.db, runner);
  });

  afterEach(() => {
    handle.close();
  });

  it('falls back to environment defaults when no row exists', () => {
    process.env.INGEST_DEFAULT_ENGINE = 'markitdown';
    process.env.DOCLING_MODE = 'cli';
    process.env.DOCLING_TABLE_MODE = 'fast';
    process.env.DITA_INGEST_TIMEOUT_MS = '42000';

    const config = service.resolveConfig();
    expect(config.defaultEngine).toBe('markitdown');
    expect(config.doclingMode).toBe('cli');
    expect(config.doclingTableMode).toBe('fast');
    expect(config.timeoutMs).toBe(42_000);

    const env = readIngestEnvDefaults();
    expect(env.maxFileMb).toBe(80);
  });

  it('lets only admins save configuration', () => {
    expect(() => service.saveConfig({ timeoutMs: 60_000 }, WRITER)).toThrow(HttpError);
    try {
      service.saveConfig({}, WRITER);
    } catch (error) {
      expect((error as HttpError).statusCode).toBe(403);
    }
    expect(service.getRow()).toBeNull();
  });

  it('persists settings and masks the Docling API key', () => {
    const publicConfig = service.saveConfig(
      {
        defaultEngine: 'docling',
        doclingServeUrl: 'http://docling.local/',
        doclingApiKey: 'sk-docling-1234567890',
        doclingMode: 'serve',
        markitdownEnabled: false,
        timeoutMs: 90_000,
        maxFileMb: 32,
      },
      ADMIN,
    );

    expect(publicConfig.hasDoclingApiKey).toBe(true);
    expect(publicConfig.maskedDoclingApiKey).toBe('sk-****7890');
    expect(publicConfig.doclingServeUrl).toBe('http://docling.local');
    expect(publicConfig.supportedExtensions).not.toContain('.msg');
    expect(publicConfig.canEdit).toBe(true);

    const row = service.getRow();
    expect(row?.doclingApiKey).toBe('sk-docling-1234567890');
    expect(row?.updatedBy).toBe(ADMIN.id);

    const cleared = service.saveConfig({ doclingApiKey: null }, ADMIN);
    expect(cleared.hasDoclingApiKey).toBe(false);
  });

  it('rejects invalid URLs and out-of-range numbers', () => {
    expect(() => service.saveConfig({ doclingServeUrl: 'ftp://x' }, ADMIN)).toThrow(HttpError);
    const clamped = service.saveConfig({ timeoutMs: 1, maxFileMb: 999_999 }, ADMIN);
    expect(clamped.timeoutMs).toBe(5_000);
    expect(clamped.maxFileMb).toBe(2_048);
  });

  it('detects docling-serve, docling CLI, and MarkItDown at once', async () => {
    service.saveConfig(
      {
        doclingServeUrl: 'http://docling.local',
        doclingMode: 'auto',
        markitdownEnabled: true,
      },
      ADMIN,
    );
    const healthCalls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request): Promise<Response> => {
      healthCalls.push(String(url));
      return jsonResponse({ status: 'ok', version: '2.9.1' });
    }) as typeof fetch;

    const detection = await service.detectRuntimes({ fetchImpl, commandRunner: runner });

    expect(healthCalls[0]).toBe('http://docling.local/health');
    expect(detection.doclingServe).toMatchObject({ available: true, version: '2.9.1' });
    expect(detection.doclingCli).toMatchObject({ available: true, version: 'Docling version 2.1.0' });
    expect(detection.markitdownCli).toMatchObject({ available: true, version: 'markitdown 0.1.1' });
    expect(detection.supportedExtensions).toEqual(expect.arrayContaining(['.pdf', '.docx', '.epub']));

    const availability = toParserAvailability(detection);
    expect(availability).toMatchObject({
      direct: true,
      doclingServe: true,
      doclingCli: true,
      markitdownCli: true,
    });
  });

  it('falls back to /openapi.json and reports unreachable servers', async () => {
    service.saveConfig({ doclingServeUrl: 'http://docling.local', doclingMode: 'serve' }, ADMIN);
    const paths: string[] = [];
    const fetchImpl = (async (url: string | URL | Request): Promise<Response> => {
      const href = String(url);
      paths.push(href);
      if (href.endsWith('/health')) return new Response('down', { status: 503 });
      if (href.endsWith('/openapi.json')) return jsonResponse({ info: { version: '9.9.9' } });
      return new Response('', { status: 404 });
    }) as typeof fetch;

    const ok = await service.detectRuntimes({ fetchImpl, commandRunner: runner });
    expect(paths[0]).toBe('http://docling.local/health');
    expect(ok.doclingServe).toMatchObject({ available: true, version: '9.9.9' });

    const failingFetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;
    const detection = await service.detectRuntimes({ fetchImpl: failingFetch, commandRunner: runner });
    expect(detection.doclingServe.available).toBe(false);
    expect(detection.doclingServe.details).toContain('ECONNREFUSED');
  });

  it('marks disabled engines as unavailable without probing them', async () => {
    service.saveConfig({ doclingMode: 'off', markitdownEnabled: false }, ADMIN);
    const detection = await service.detectRuntimes({ commandRunner: runner });
    expect(detection.doclingServe.available).toBe(false);
    expect(detection.doclingCli.available).toBe(false);
    expect(detection.markitdownCli).toMatchObject({ available: false, enabled: false });
    expect(runner.calls).toHaveLength(0);
    expect(toParserAvailability(detection).unsupportedReason).toBeTruthy();
  });
});

describe('IngestParseError', () => {
  it('keeps the code, message, and details', () => {
    const error = new IngestParseError('parse-failed', 'nope', { attempt: 2 });
    expect(error.code).toBe('parse-failed');
    expect(error.details).toEqual({ attempt: 2 });
    expect(error.name).toBe('IngestParseError');
  });
});
