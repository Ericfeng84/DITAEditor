import type {
  ExtractedIngestAsset,
  IngestEngineChoice,
  IngestResolvedEngine,
} from '@dita/core';

/** Files that need no external parser: they are already plain Markdown/plain text. */
export const DIRECT_EXTENSIONS = ['.md', '.markdown', '.txt'] as const;

/** Extensions Docling can convert (office, PDF, HTML, images via OCR, AsciiDoc). */
export const DOCLING_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.html',
  '.htm',
  '.png',
  '.jpg',
  '.jpeg',
  '.tiff',
  '.tif',
  '.bmp',
  '.webp',
  '.asciidoc',
  '.adoc',
] as const;

/** Extensions MarkItDown handles natively (lighter than Docling, no OCR). */
export const MARKITDOWN_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.xls',
  '.pptx',
  '.html',
  '.htm',
  '.csv',
  '.epub',
  '.msg',
] as const;

export const ALL_INGEST_EXTENSIONS: readonly string[] = Array.from(
  new Set<string>([
    ...DIRECT_EXTENSIONS,
    ...DOCLING_EXTENSIONS,
    ...MARKITDOWN_EXTENSIONS,
  ]),
).sort();

export const DOCLING_ONLY_EXTENSIONS: readonly string[] = DOCLING_EXTENSIONS.filter(
  (extension) => !(MARKITDOWN_EXTENSIONS as readonly string[]).includes(extension),
);

export const MARKITDOWN_ONLY_EXTENSIONS: readonly string[] = MARKITDOWN_EXTENSIONS.filter(
  (extension) => !(DOCLING_EXTENSIONS as readonly string[]).includes(extension),
);

/** Office/HTML formats where MarkItDown is usually the faster, lighter choice. */
export const OFFICE_EXTENSIONS: readonly string[] = [
  '.docx',
  '.pptx',
  '.xlsx',
  '.xls',
  '.html',
  '.htm',
  '.epub',
  '.msg',
  '.csv',
];

export function normalizeExtension(fileNameOrExtension: string): string {
  const base = fileNameOrExtension.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const extension = dot >= 0 ? base.slice(dot) : base;
  return extension.toLowerCase();
}

export function isSupportedIngestExtension(extension: string): boolean {
  return ALL_INGEST_EXTENSIONS.includes(normalizeExtension(extension));
}

/** Fully resolved parser settings, after DB values and environment fallbacks are merged. */
export interface ResolvedParserConfig {
  defaultEngine: IngestEngineChoice;
  preferMarkitdownForOffice: boolean;
  doclingMode: 'auto' | 'serve' | 'cli' | 'off';
  doclingServeUrl: string | null;
  doclingApiKey: string | null;
  doclingCliCommand: string;
  doclingDoOcr: boolean;
  doclingTableMode: 'fast' | 'accurate';
  markitdownEnabled: boolean;
  markitdownCliCommand: string;
  markitdownKeepDataUris: boolean;
  timeoutMs: number;
  maxFileMb: number;
}

/** Availability snapshot used by the router and by `auto` fallbacks. */
export interface ParserRuntimeAvailability {
  direct: boolean;
  doclingServe: boolean;
  doclingCli: boolean;
  markitdownCli: boolean;
  unsupportedReason?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandRunOptions {
  cwd?: string;
  /** Hard wall-clock limit; the runner kills the process tree and rejects with a timeout error. */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Keep at most this many stdout characters (default 1 MiB) to bound memory. */
  maxOutputChars?: number;
}

/**
 * Thin, injectable process boundary: tests supply a fake runner, production uses
 * `createCommandRunner()`. Commands always run without a shell on POSIX and through
 * `cmd.exe /d /s /c` on Windows so `.cmd` shims such as `markitdown.cmd` resolve.
 */
export interface CommandRunner {
  run(command: string, args: readonly string[], options?: CommandRunOptions): Promise<CommandResult>;
  /** True when the command resolves on `PATH` (used by runtime detection). */
  isAvailable(command: string): Promise<boolean>;
}

export type IngestParseErrorCode =
  | 'unsupported-extension'
  | 'file-too-large'
  | 'engine-unavailable'
  | 'engine-unsupported'
  | 'parse-failed'
  | 'timeout'
  | 'cancelled';

export class IngestParseError extends Error {
  constructor(
    readonly code: IngestParseErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'IngestParseError';
  }
}

export interface ParseDocumentInput {
  /** Absolute path of the uploaded source file. */
  inputPath: string;
  /** Scratch directory for engine output (created by the caller if missing). */
  outputDir: string;
  /** Destination for extracted binary images (`img_001.png`, ...). */
  assetsDir: string;
  /** Lower-case extension with the leading dot, e.g. `.docx`. */
  extension: string;
  config: ResolvedParserConfig;
  requestedEngine?: IngestEngineChoice;
  availability?: ParserRuntimeAvailability;
  /** Override the docling-serve poll cadence (tests use a few milliseconds). */
  pollIntervalMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** Injectable process boundary for CLI engines; defaults to `createCommandRunner()`. */
  commandRunner?: CommandRunner;
}

export interface ParsedDocumentOutput {
  markdown: string;
  engine: IngestResolvedEngine;
  assets: ExtractedIngestAsset[];
  warnings: string[];
}

/** Common contract for every parser implementation (direct, Docling, MarkItDown). */
export interface DocumentParserProvider {
  readonly engine: IngestResolvedEngine;
  parse(input: ParseDocumentInput): Promise<ParsedDocumentOutput>;
}
