import { readFile, stat } from 'node:fs/promises';
import { extractDataUriImages } from '@dita/core';
import { saveDataUriImages } from './assets.js';
import { parseWithDoclingCli, parseWithDoclingServe } from './docling-parser.js';
import { parseWithMarkItDownCli } from './markitdown-parser.js';
import {
  DIRECT_EXTENSIONS,
  DOCLING_EXTENSIONS,
  DOCLING_ONLY_EXTENSIONS,
  IngestParseError,
  MARKITDOWN_EXTENSIONS,
  MARKITDOWN_ONLY_EXTENSIONS,
  OFFICE_EXTENSIONS,
  isSupportedIngestExtension,
  normalizeExtension,
  type ParseDocumentInput,
  type ParsedDocumentOutput,
  type ParserRuntimeAvailability,
  type ResolvedParserConfig,
} from './types.js';

/** Concrete engine ids the router can schedule. */
export type ParserEngineId = 'docling-serve' | 'docling-cli' | 'markitdown-cli';

/** Availability implied by configuration alone (used when the caller has no probe result). */
export function defaultAvailability(config: ResolvedParserConfig): ParserRuntimeAvailability {
  return {
    direct: true,
    doclingServe:
      Boolean(config.doclingServeUrl) &&
      config.doclingMode !== 'off' &&
      config.doclingMode !== 'cli',
    doclingCli: config.doclingMode !== 'off',
    markitdownCli: config.markitdownEnabled,
  };
}

function doclingOrder(
  config: ResolvedParserConfig,
  availability: ParserRuntimeAvailability,
): ParserEngineId[] {
  if (config.doclingMode === 'off') return [];
  const order: ParserEngineId[] = [];
  if (config.doclingMode !== 'cli') order.push('docling-serve');
  if (config.doclingMode !== 'serve') order.push('docling-cli');
  return order.filter((engine) =>
    engine === 'docling-serve' ? availability.doclingServe : availability.doclingCli,
  );
}

/**
 * Routing matrix for one document (see `docs/phase14-docling-agent-plan.md`):
 *
 * | extension                            | order                                              |
 * |--------------------------------------|----------------------------------------------------|
 * | `.md`/`.markdown`/`.txt`             | direct pass-through (no engine)                    |
 * | images, `.asciidoc`, `.adoc`         | docling-serve → docling-cli                        |
 * | `.pdf`                               | docling-serve → docling-cli → markitdown-cli       |
 * | office/html                          | preferMarkitdownForOffice ? markitdown → docling : docling → markitdown |
 * | `.xls`/`.epub`/`.csv`/`.msg`         | markitdown-cli                                     |
 *
 * `defaultEngine` biases (never overrides capability): `docling` moves Docling first,
 * `markitdown` moves MarkItDown first.
 */
export function resolveParserEnginePlan(
  extension: string,
  config: ResolvedParserConfig,
  availability: ParserRuntimeAvailability = defaultAvailability(config),
  requestedEngine: 'auto' | 'docling' | 'markitdown' = 'auto',
): ParserEngineId[] {
  const ext = normalizeExtension(extension);
  const supportedByDocling = (DOCLING_EXTENSIONS as readonly string[]).includes(ext);
  const supportedByMarkItDown = (MARKITDOWN_EXTENSIONS as readonly string[]).includes(ext);
  const docling = supportedByDocling ? doclingOrder(config, availability) : [];
  const markitdown: ParserEngineId[] =
    supportedByMarkItDown && config.markitdownEnabled && availability.markitdownCli
      ? ['markitdown-cli']
      : [];

  if (requestedEngine === 'docling') {
    if (!supportedByDocling) {
      throw new IngestParseError(
        'engine-unsupported',
        `Docling cannot read "${ext}" files. Supported: ${DOCLING_EXTENSIONS.join(', ')}.`,
        { extension: ext, engine: 'docling' },
      );
    }
    if (docling.length === 0) {
      throw new IngestParseError(
        'engine-unavailable',
        'Docling is not available (no reachable docling-serve and no local docling CLI).',
        { engine: 'docling' },
      );
    }
    return docling;
  }

  if (requestedEngine === 'markitdown') {
    if (!supportedByMarkItDown) {
      throw new IngestParseError(
        'engine-unsupported',
        `MarkItDown cannot read "${ext}" files. Supported: ${MARKITDOWN_EXTENSIONS.join(', ')}.`,
        { extension: ext, engine: 'markitdown' },
      );
    }
    if (markitdown.length === 0) {
      throw new IngestParseError(
        'engine-unavailable',
        'MarkItDown is disabled or its CLI is not installed.',
        { engine: 'markitdown' },
      );
    }
    return markitdown;
  }

  if ((DOCLING_ONLY_EXTENSIONS as readonly string[]).includes(ext)) return docling;
  if ((MARKITDOWN_ONLY_EXTENSIONS as readonly string[]).includes(ext)) return markitdown;

  const preferMarkItDown = (OFFICE_EXTENSIONS as readonly string[]).includes(ext)
    ? config.preferMarkitdownForOffice
    : false;
  const fallbackFirst = preferMarkItDown ? [...markitdown, ...docling] : [...docling, ...markitdown];

  if (config.defaultEngine === 'docling') {
    return [...docling, ...markitdown];
  }
  if (config.defaultEngine === 'markitdown' && markitdown.length > 0) {
    return [...markitdown, ...docling];
  }
  return dedupe(fallbackFirst);
}

function dedupe(engines: readonly ParserEngineId[]): ParserEngineId[] {
  return Array.from(new Set(engines));
}

async function parseDirect(input: ParseDocumentInput): Promise<ParsedDocumentOutput> {
  const raw = await readFile(input.inputPath, 'utf8');
  const extracted = extractDataUriImages(raw);
  const assets = await saveDataUriImages(extracted.images, input.assetsDir);
  const warnings: string[] = [];
  if (!extracted.markdown.trim()) warnings.push('The uploaded document is empty.');
  return { markdown: extracted.markdown, engine: 'direct', assets, warnings };
}

function runEngine(engine: ParserEngineId, input: ParseDocumentInput): Promise<ParsedDocumentOutput> {
  if (engine === 'docling-serve') return parseWithDoclingServe(input);
  if (engine === 'docling-cli') return parseWithDoclingCli(input);
  return parseWithMarkItDownCli(input);
}

/**
 * Validates the extension/size, then converts the document to Markdown using the resolved
 * engine order. Explicit engine requests fail cleanly (no silent switching); `auto` falls back
 * across available engines and reports which ones failed.
 */
export async function parseDocumentToMarkdown(
  input: ParseDocumentInput,
): Promise<ParsedDocumentOutput> {
  const extension = normalizeExtension(input.extension || input.inputPath);
  if (!isSupportedIngestExtension(extension)) {
    throw new IngestParseError('unsupported-extension', `Unsupported document type "${extension}".`, {
      extension,
    });
  }

  const fileStat = await stat(input.inputPath);
  const maxBytes = Math.max(1, input.config.maxFileMb) * 1024 * 1024;
  if (fileStat.size > maxBytes) {
    throw new IngestParseError(
      'file-too-large',
      `"${input.inputPath}" is ${(fileStat.size / (1024 * 1024)).toFixed(1)} MB; the limit is ${input.config.maxFileMb} MB.`,
      { size: fileStat.size, maxBytes },
    );
  }

  if ((DIRECT_EXTENSIONS as readonly string[]).includes(extension)) {
    return await parseDirect(input);
  }

  const availability = input.availability ?? defaultAvailability(input.config);
  const requested = input.requestedEngine ?? 'auto';
  const plan = resolveParserEnginePlan(extension, input.config, availability, requested);
  if (plan.length === 0) {
    throw new IngestParseError(
      'engine-unavailable',
      `No installed engine can convert "${extension}" files. Install Docling or MarkItDown, or configure docling-serve.`,
      { extension, requestedEngine: requested },
    );
  }

  // Explicit requests are strict: exactly one engine, no fallback.
  if (requested !== 'auto') {
    return await runEngine(plan[0]!, input);
  }

  const failures: string[] = [];
  for (const engine of plan) {
    try {
      return await runEngine(engine, input);
    } catch (error) {
      if (error instanceof IngestParseError && error.code === 'cancelled') throw error;
      failures.push(`${engine}: ${error instanceof Error ? error.message : String(error)}`);
      if (failures.length === plan.length) break;
    }
  }

  throw new IngestParseError(
    'parse-failed',
    `Every available parser failed for "${extension}". ${failures.join(' | ')}`,
    { extension, failures },
  );
}

export {
  DIRECT_EXTENSIONS,
  DOCLING_EXTENSIONS,
  MARKITDOWN_EXTENSIONS,
};
