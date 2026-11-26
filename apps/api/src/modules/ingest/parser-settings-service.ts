import { eq } from 'drizzle-orm';
import type { IngestEngineChoice } from '@dita/core';
import type { DitaDatabase } from '../../db/client.js';
import { ingestParserSettings, type IngestParserSettingsRow } from '../../db/schema.js';
import { HttpError } from '../errors.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { maskApiKey } from '../ai/ai-settings-service.js';
import { createCommandRunner, splitCommandLine } from './parsers/command-runner.js';
import {
  DIRECT_EXTENSIONS,
  DOCLING_EXTENSIONS,
  MARKITDOWN_EXTENSIONS,
  type CommandRunner,
  type ParserRuntimeAvailability,
  type ResolvedParserConfig,
} from './parsers/types.js';

/** Singleton row id for the ingest parser configuration. */
export const INGEST_PARSER_SETTINGS_ID = 'default';

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_FILE_MB = 80;

export interface IngestEnvDefaults {
  defaultEngine: IngestEngineChoice;
  preferMarkitdownForOffice: boolean;
  doclingMode: ResolvedParserConfig['doclingMode'];
  doclingServeUrl: string;
  doclingApiKey: string;
  doclingCliCommand: string;
  doclingDoOcr: boolean;
  doclingTableMode: 'fast' | 'accurate';
  markitdownEnabled: boolean;
  markitdownCliCommand: string;
  markitdownKeepDataUris: boolean;
  timeoutMs: number;
  maxFileMb: number;
}

export interface ParserRuntimeDetail {
  available: boolean;
  version: string | null;
  details: string | null;
}

export interface ParserRuntimeDetection {
  direct: { available: true; extensions: readonly string[] };
  doclingServe: ParserRuntimeDetail & { url: string | null };
  doclingCli: ParserRuntimeDetail & { command: string };
  markitdownCli: ParserRuntimeDetail & { command: string; enabled: boolean };
  supportedExtensions: readonly string[];
}

export interface RuntimeDetectionOptions {
  fetchImpl?: typeof fetch;
  commandRunner?: CommandRunner;
  /** Per-probe budget for health checks and `--version` calls. */
  probeTimeoutMs?: number;
}

export interface IngestParserPublicConfig {
  defaultEngine: IngestEngineChoice;
  preferMarkitdownForOffice: boolean;
  doclingMode: ResolvedParserConfig['doclingMode'];
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

export interface IngestParserConfigInput {
  defaultEngine?: IngestEngineChoice;
  preferMarkitdownForOffice?: boolean;
  doclingMode?: ResolvedParserConfig['doclingMode'];
  doclingServeUrl?: string | null;
  /** `null` clears the stored key, `undefined` keeps it untouched. */
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

function readEnvFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return !['0', 'false', 'no', 'off'].includes(raw);
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readEngineChoice(name: string, fallback: IngestEngineChoice): IngestEngineChoice {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === 'auto' || raw === 'docling' || raw === 'markitdown' ? raw : fallback;
}

function readDoclingMode(): ResolvedParserConfig['doclingMode'] {
  const raw = process.env.DOCLING_MODE?.trim().toLowerCase();
  return raw === 'auto' || raw === 'serve' || raw === 'cli' || raw === 'off' ? raw : 'auto';
}

function readTableMode(): 'fast' | 'accurate' {
  return process.env.DOCLING_TABLE_MODE?.trim().toLowerCase() === 'fast' ? 'fast' : 'accurate';
}

/** Environment fallbacks used before the admin saves a singleton row. */
export function readIngestEnvDefaults(): IngestEnvDefaults {
  return {
    defaultEngine: readEngineChoice('INGEST_DEFAULT_ENGINE', 'auto'),
    preferMarkitdownForOffice: readEnvFlag('INGEST_PREFER_MARKITDOWN_FOR_OFFICE', true),
    doclingMode: readDoclingMode(),
    doclingServeUrl: process.env.DOCLING_SERVE_URL?.trim() ?? '',
    doclingApiKey: process.env.DOCLING_API_KEY?.trim() ?? '',
    doclingCliCommand: process.env.DOCLING_CLI_COMMAND?.trim() || 'docling',
    doclingDoOcr: readEnvFlag('DOCLING_DO_OCR', true),
    doclingTableMode: readTableMode(),
    markitdownEnabled: readEnvFlag('MARKITDOWN_ENABLED', true),
    markitdownCliCommand: process.env.MARKITDOWN_CLI_COMMAND?.trim() || 'markitdown',
    markitdownKeepDataUris: readEnvFlag('MARKITDOWN_KEEP_DATA_URIS', true),
    timeoutMs: readEnvInt('DITA_INGEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxFileMb: readEnvInt('DITA_INGEST_MAX_FILE_MB', DEFAULT_MAX_FILE_MB),
  };
}

function uniqueExtensions(extensions: Iterable<string>): string[] {
  return Array.from(new Set(extensions)).sort();
}

/** Extensions the configured engines can attempt, ignoring live runtime availability. */
export function supportedExtensionsForConfig(config: ResolvedParserConfig): readonly string[] {
  const extensions: string[] = [...DIRECT_EXTENSIONS];
  if (config.doclingMode !== 'off') extensions.push(...DOCLING_EXTENSIONS);
  if (config.markitdownEnabled) extensions.push(...MARKITDOWN_EXTENSIONS);
  return uniqueExtensions(extensions);
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return min;
  return Math.min(max, Math.max(min, rounded));
}

function assertEngineChoice(value: string): IngestEngineChoice {
  if (value !== 'auto' && value !== 'docling' && value !== 'markitdown') {
    throw new HttpError(400, `Unsupported parser engine: ${value}`);
  }
  return value;
}

function assertDoclingMode(value: string): ResolvedParserConfig['doclingMode'] {
  if (value !== 'auto' && value !== 'serve' && value !== 'cli' && value !== 'off') {
    throw new HttpError(400, `Unsupported Docling mode: ${value}`);
  }
  return value;
}

function assertTableMode(value: string): 'fast' | 'accurate' {
  if (value !== 'fast' && value !== 'accurate') {
    throw new HttpError(400, `Unsupported Docling table mode: ${value}`);
  }
  return value;
}

function normalizeServeUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, `Docling serve URL is not a valid URL: ${trimmed}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'Docling serve URL must use http:// or https://');
  }
  return trimmed.replace(/\/+$/, '');
}

function readVersion(detail: string | null | undefined): string | null {
  const firstLine = detail?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 120) : null;
}

const HEALTH_PROBE_MS = 4_000;

/**
 * Parser settings service. The DB row overrides environment fallbacks; when no row exists the
 * `INGEST_* / DOCLING_* / MARKITDOWN_*` values (or built-in defaults) apply. Only admins may
 * persist changes; every user may read the masked public view.
 */
export class ParserSettingsService {
  constructor(
    private readonly db: DitaDatabase,
    private readonly commandRunner: CommandRunner = createCommandRunner(),
  ) {}

  getRow(): IngestParserSettingsRow | null {
    return (
      this.db
        .select()
        .from(ingestParserSettings)
        .where(eq(ingestParserSettings.id, INGEST_PARSER_SETTINGS_ID))
        .get() ?? null
    );
  }

  resolveConfig(): ResolvedParserConfig {
    const env = readIngestEnvDefaults();
    const row = this.getRow();
    const pick = (dbValue: string | null | undefined, envValue: string): string =>
      dbValue?.trim() || envValue;

    return {
      defaultEngine: row ? assertEngineChoice(row.defaultEngine) : env.defaultEngine,
      preferMarkitdownForOffice: row
        ? row.preferMarkitdownForOffice === 1
        : env.preferMarkitdownForOffice,
      doclingMode: row ? assertDoclingMode(row.doclingMode) : env.doclingMode,
      doclingServeUrl: normalizeServeUrl(pick(row?.doclingServeUrl, env.doclingServeUrl)),
      doclingApiKey: pick(row?.doclingApiKey, env.doclingApiKey) || null,
      doclingCliCommand: pick(row?.doclingCliCommand, env.doclingCliCommand),
      doclingDoOcr: row ? row.doclingDoOcr === 1 : env.doclingDoOcr,
      doclingTableMode: row ? assertTableMode(row.doclingTableMode) : env.doclingTableMode,
      markitdownEnabled: row ? row.markitdownEnabled === 1 : env.markitdownEnabled,
      markitdownCliCommand: pick(row?.markitdownCliCommand, env.markitdownCliCommand),
      markitdownKeepDataUris: row
        ? row.markitdownKeepDataUris === 1
        : env.markitdownKeepDataUris,
      timeoutMs: row?.timeoutMs ?? env.timeoutMs,
      maxFileMb: row?.maxFileMb ?? env.maxFileMb,
    };
  }

  getPublicConfig(user: IdentityUser): IngestParserPublicConfig {
    const config = this.resolveConfig();
    return {
      defaultEngine: config.defaultEngine,
      preferMarkitdownForOffice: config.preferMarkitdownForOffice,
      doclingMode: config.doclingMode,
      doclingServeUrl: config.doclingServeUrl,
      hasDoclingApiKey: Boolean(config.doclingApiKey),
      maskedDoclingApiKey: maskApiKey(config.doclingApiKey),
      doclingCliCommand: config.doclingCliCommand,
      doclingDoOcr: config.doclingDoOcr,
      doclingTableMode: config.doclingTableMode,
      markitdownEnabled: config.markitdownEnabled,
      markitdownCliCommand: config.markitdownCliCommand,
      markitdownKeepDataUris: config.markitdownKeepDataUris,
      timeoutMs: config.timeoutMs,
      maxFileMb: config.maxFileMb,
      supportedExtensions: supportedExtensionsForConfig(config),
      canEdit: user.role === 'admin',
    };
  }

  /** Admin-only write. Missing fields keep their current value; `doclingApiKey: null` clears. */
  saveConfig(input: IngestParserConfigInput, user: IdentityUser): IngestParserPublicConfig {
    if (user.role !== 'admin') {
      throw new HttpError(403, 'Only administrators can change ingest parser settings.');
    }
    const existing = this.getRow();
    const env = readIngestEnvDefaults();
    const current = this.resolveConfig();

    const defaultEngine =
      input.defaultEngine === undefined ? current.defaultEngine : assertEngineChoice(input.defaultEngine);
    const doclingMode =
      input.doclingMode === undefined ? current.doclingMode : assertDoclingMode(input.doclingMode);
    const doclingTableMode =
      input.doclingTableMode === undefined
        ? current.doclingTableMode
        : assertTableMode(input.doclingTableMode);
    const doclingServeUrl =
      input.doclingServeUrl === undefined
        ? (existing?.doclingServeUrl ?? env.doclingServeUrl ?? null)
        : normalizeServeUrl(input.doclingServeUrl);
    const doclingApiKey =
      input.doclingApiKey === undefined
        ? (existing?.doclingApiKey ?? env.doclingApiKey ?? null)
        : input.doclingApiKey?.trim() || null;

    const values = {
      defaultEngine,
      preferMarkitdownForOffice:
        (input.preferMarkitdownForOffice ?? current.preferMarkitdownForOffice) ? 1 : 0,
      doclingMode,
      doclingServeUrl,
      doclingApiKey,
      doclingCliCommand:
        input.doclingCliCommand?.trim() || existing?.doclingCliCommand || env.doclingCliCommand,
      doclingDoOcr: (input.doclingDoOcr ?? current.doclingDoOcr) ? 1 : 0,
      doclingTableMode,
      markitdownEnabled: (input.markitdownEnabled ?? current.markitdownEnabled) ? 1 : 0,
      markitdownCliCommand:
        input.markitdownCliCommand?.trim() ||
        existing?.markitdownCliCommand ||
        env.markitdownCliCommand,
      markitdownKeepDataUris: (input.markitdownKeepDataUris ?? current.markitdownKeepDataUris)
        ? 1
        : 0,
      timeoutMs: clampInt(input.timeoutMs ?? current.timeoutMs, 5_000, 3_600_000),
      maxFileMb: clampInt(input.maxFileMb ?? current.maxFileMb, 1, 2_048),
      updatedBy: user.id,
      updatedAt: Date.now(),
    };

    if (existing) {
      this.db
        .update(ingestParserSettings)
        .set(values)
        .where(eq(ingestParserSettings.id, INGEST_PARSER_SETTINGS_ID))
        .run();
    } else {
      this.db
        .insert(ingestParserSettings)
        .values({ id: INGEST_PARSER_SETTINGS_ID, ...values })
        .run();
    }
    return this.getPublicConfig(user);
  }

  /**
   * Probes every configured engine. `docling-serve` is checked through `GET /health` with an
   * `/openapi.json` fallback; CLI engines are probed with `--version`. Never throws: an
   * unreachable engine simply reports `available: false` with a human-readable detail.
   */
  async detectRuntimes(options: RuntimeDetectionOptions = {}): Promise<ParserRuntimeDetection> {
    const config = this.resolveConfig();
    const fetchImpl = options.fetchImpl ?? fetch;
    const runner = options.commandRunner ?? this.commandRunner;
    const probeTimeoutMs = options.probeTimeoutMs ?? HEALTH_PROBE_MS;

    const doclingServe = await this.probeDoclingServe(config, fetchImpl, probeTimeoutMs);
    const doclingCli = await this.probeCli(
      runner,
      config.doclingCliCommand,
      config.doclingMode !== 'off',
      probeTimeoutMs,
    );
    const markitdownCli = await this.probeCli(
      runner,
      config.markitdownCliCommand,
      config.markitdownEnabled,
      probeTimeoutMs,
    );

    const extensions: string[] = [...DIRECT_EXTENSIONS];
    if (doclingServe.available || doclingCli.available) extensions.push(...DOCLING_EXTENSIONS);
    if (markitdownCli.available) extensions.push(...MARKITDOWN_EXTENSIONS);

    return {
      direct: { available: true, extensions: [...DIRECT_EXTENSIONS] },
      doclingServe,
      doclingCli,
      markitdownCli,
      supportedExtensions: uniqueExtensions(extensions),
    };
  }

  private async probeDoclingServe(
    config: ResolvedParserConfig,
    fetchImpl: typeof fetch,
    probeTimeoutMs: number,
  ): Promise<ParserRuntimeDetail & { url: string | null }> {
    const url = config.doclingServeUrl;
    if (!url || config.doclingMode === 'off' || config.doclingMode === 'cli') {
      return {
        available: false,
        version: null,
        details: url ? `Docling mode is "${config.doclingMode}".` : 'No Docling serve URL configured.',
        url,
      };
    }

    const headers: Record<string, string> = {};
    if (config.doclingApiKey) headers['X-Api-Key'] = config.doclingApiKey;

    for (const path of ['/health', '/openapi.json']) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), probeTimeoutMs);
      try {
        const response = await fetchImpl(`${url}${path}`, { headers, signal: controller.signal });
        if (!response.ok) continue;
        const text = await response.text();
        const version = extractVersionFromBody(text);
        return {
          available: true,
          version,
          details: `Reachable at ${url}${path}.`,
          url,
        };
      } catch (error) {
        if (path === '/openapi.json') {
          return {
            available: false,
            version: null,
            details: error instanceof Error ? error.message : 'Docling serve is unreachable.',
            url,
          };
        }
      } finally {
        clearTimeout(timer);
      }
    }
    return { available: false, version: null, details: `Docling serve at ${url} is unreachable.`, url };
  }

  private async probeCli(
    runner: CommandRunner,
    command: string,
    enabled: boolean,
    probeTimeoutMs: number,
  ): Promise<ParserRuntimeDetail & { command: string; enabled: boolean }> {
    if (!enabled) {
      return { available: false, version: null, details: 'Disabled in settings.', command, enabled };
    }
    const { command: executable, args } = splitCommandLine(command);
    if (!executable) {
      return { available: false, version: null, details: 'No command configured.', command, enabled };
    }
    try {
      const result = await runner.run(executable, [...args, '--version'], {
        timeoutMs: probeTimeoutMs * 4,
        maxOutputChars: 16_384,
      });
      if (result.exitCode !== 0) {
        return {
          available: false,
          version: null,
          details: (result.stderr || result.stdout).trim().slice(0, 400) || 'Command failed.',
          command,
          enabled,
        };
      }
      const version = readVersion(result.stdout) ?? readVersion(result.stderr);
      return {
        available: true,
        version,
        details: version ? `${executable} ${version}` : `${executable} is available.`,
        command,
        enabled,
      };
    } catch (error) {
      return {
        available: false,
        version: null,
        details: error instanceof Error ? error.message : 'Command is unavailable.',
        command,
        enabled,
      };
    }
  }
}

/** Project a detection snapshot onto the coarse availability matrix used by the router. */
export function toParserAvailability(
  detection: ParserRuntimeDetection,
): ParserRuntimeAvailability {
  const direct = detection.direct.available;
  const doclingServe = detection.doclingServe.available;
  const doclingCli = detection.doclingCli.available;
  const markitdownCli = detection.markitdownCli.available;
  return {
    direct,
    doclingServe,
    doclingCli,
    markitdownCli,
    unsupportedReason:
      doclingServe || doclingCli || markitdownCli
        ? undefined
        : 'No document conversion engine is available.',
  };
}

function extractVersionFromBody(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as {
      version?: unknown;
      info?: { version?: unknown };
    };
    const version = parsed.version ?? parsed.info?.version;
    if (typeof version === 'string' && version.trim()) return version.trim().slice(0, 120);
  } catch {
    // `/health` may return plain text such as `ok`.
  }
  return readVersion(body);
}
