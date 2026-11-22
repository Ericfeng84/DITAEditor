import { eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { aiSettings, type AiSettingsRow } from '../../db/schema.js';
import { HttpError, httpError } from '../errors.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type { AiApiKeySource, AiConfigUpdateInput, AiPublicConfig } from './types.js';

/** Singleton row id for the local AI provider configuration. */
export const AI_SETTINGS_ID = 'default';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-flash';
const DEFAULT_API_KEY = '';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_CONTEXT_CHARS = 24_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;

export interface AiEnvDefaults {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxContextChars: number;
}

export interface ResolvedAiConfig {
  baseUrl: string;
  model: string;
  apiKey: string | null;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
  maxContextChars: number;
  apiKeySource: AiApiKeySource;
}

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readAiEnvDefaults(): AiEnvDefaults {
  return {
    baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL,
    model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() || DEFAULT_API_KEY,
    timeoutMs: readEnvInt('AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxContextChars: readEnvInt('AI_MAX_CONTEXT_CHARS', DEFAULT_MAX_CONTEXT_CHARS),
  };
}

/**
 * Masked keys keep a recognizable prefix/suffix (`sk-****9a2f`) so admins can tell which key is
 * active without ever returning the full secret over the wire.
 */
export function maskApiKey(apiKey: string | null | undefined): string | null {
  const trimmed = apiKey?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length < 10) return '****';
  return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`;
}

export class AiSettingsService {
  constructor(private readonly db: DitaDatabase) {}

  getRow(): AiSettingsRow | null {
    return this.db.select().from(aiSettings).where(eq(aiSettings.id, AI_SETTINGS_ID)).get() ?? null;
  }

  resolveConfig(): ResolvedAiConfig {
    const env = readAiEnvDefaults();
    const row = this.getRow();
    const dbKey = row?.apiKey?.trim() ?? '';
    const envKey = env.apiKey;
    const apiKey = dbKey || envKey || null;
    const apiKeySource: AiApiKeySource = dbKey ? 'db' : envKey ? 'env' : 'none';
    return {
      baseUrl: row?.baseUrl?.trim() || env.baseUrl,
      model: row?.model?.trim() || env.model,
      apiKey,
      temperature: row?.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: row?.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs: row?.timeoutMs ?? env.timeoutMs,
      maxContextChars: env.maxContextChars,
      apiKeySource,
    };
  }

  getPublicConfig(user: IdentityUser): AiPublicConfig {
    const config = this.resolveConfig();
    return {
      configured: Boolean(config.apiKey),
      baseUrl: config.baseUrl,
      model: config.model,
      hasApiKey: Boolean(config.apiKey),
      apiKeySource: config.apiKeySource,
      maskedApiKey: maskApiKey(config.apiKey),
      temperature: config.temperature,
      maxRetries: config.maxRetries,
      timeoutMs: config.timeoutMs,
      maxContextChars: config.maxContextChars,
      canEdit: user.role === 'admin',
    };
  }

  /**
   * Persists the singleton row. `apiKey === null` clears the DB key so the env fallback takes over;
   * `apiKey === undefined` leaves the stored key untouched.
   */
  saveConfig(input: AiConfigUpdateInput, user: IdentityUser): AiPublicConfig {
    if (user.role !== 'admin') {
      throw httpError(403, 'ai.adminOnlyConfig');
    }
    const env = readAiEnvDefaults();
    const existing = this.getRow();
    const nextApiKey =
      input.apiKey === undefined
        ? (existing?.apiKey ?? null)
        : input.apiKey && input.apiKey.trim()
          ? input.apiKey.trim()
          : null;
    const values = {
      baseUrl: input.baseUrl ?? existing?.baseUrl ?? env.baseUrl,
      model: input.model ?? existing?.model ?? env.model,
      apiKey: nextApiKey,
      temperature: input.temperature ?? existing?.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: input.maxRetries ?? existing?.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs: input.timeoutMs ?? existing?.timeoutMs ?? env.timeoutMs,
      updatedBy: user.id,
      updatedAt: Date.now(),
    };

    if (existing) {
      this.db.update(aiSettings).set(values).where(eq(aiSettings.id, AI_SETTINGS_ID)).run();
    } else {
      this.db.insert(aiSettings).values({ id: AI_SETTINGS_ID, ...values }).run();
    }
    return this.getPublicConfig(user);
  }
}
