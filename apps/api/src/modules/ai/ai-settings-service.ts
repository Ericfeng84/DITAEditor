import { eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { aiSettings, type AiSettingsRow } from '../../db/schema.js';
import { HttpError, httpError } from '../errors.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type {
  AiApiKeySource,
  AiConfigUpdateInput,
  AiPublicConfig,
  AiReviewerPublicConfig,
} from './types.js';

/** Singleton row id for the local AI provider configuration. */
export const AI_SETTINGS_ID = 'default';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-flash';
const DEFAULT_API_KEY = '';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_CONTEXT_CHARS = 24_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;
/** Upper bound for the inherited reviewer temperature: review must stay deterministic. */
const REVIEWER_MAX_TEMPERATURE = 0.1;

export interface AiEnvDefaults {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxContextChars: number;
  reviewerBaseUrl: string;
  reviewerModel: string;
  reviewerApiKey: string;
  reviewerTemperature: number | null;
}

/**
 * Phase 16: the reviewer role is a *separate* model identity so the reviewer cannot inherit the
 * translator's own blind spots. Everything is derived from the primary config unless the admin (or
 * the environment) provides a dedicated value.
 */
export interface ResolvedReviewerConfig extends ResolvedAiConfig {
  isDedicated: boolean;
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

function readEnvFloat(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 2 ? parsed : null;
}

export function readAiEnvDefaults(): AiEnvDefaults {
  return {
    baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL,
    model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL,
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() || DEFAULT_API_KEY,
    timeoutMs: readEnvInt('AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxContextChars: readEnvInt('AI_MAX_CONTEXT_CHARS', DEFAULT_MAX_CONTEXT_CHARS),
    reviewerBaseUrl: process.env.AI_REVIEWER_BASE_URL?.trim() || '',
    reviewerModel: process.env.AI_REVIEWER_MODEL?.trim() || '',
    reviewerApiKey: process.env.AI_REVIEWER_API_KEY?.trim() || '',
    reviewerTemperature: readEnvFloat('AI_REVIEWER_TEMPERATURE'),
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

  /**
   * Resolves the reviewer role. Precedence per field: DB reviewer override → reviewer env var →
   * primary role value. The default reviewer temperature is `min(primary.temperature, 0.1)` so a
   * reviewer is always as deterministic as (or more than) the translator.
   */
  resolveReviewerConfig(): ResolvedReviewerConfig {
    const primary = this.resolveConfig();
    const env = readAiEnvDefaults();
    const row = this.getRow();
    const dbBaseUrl = row?.reviewerBaseUrl?.trim() || '';
    const dbModel = row?.reviewerModel?.trim() || '';
    const dbKey = row?.reviewerApiKey?.trim() || '';
    const dbTemperature = row?.reviewerTemperature ?? null;

    const baseUrl = dbBaseUrl || env.reviewerBaseUrl || primary.baseUrl;
    const model = dbModel || env.reviewerModel || primary.model;
    const envKey = env.reviewerApiKey;
    const apiKey = dbKey || envKey || primary.apiKey;
    const apiKeySource: AiApiKeySource = dbKey
      ? 'db'
      : envKey
        ? 'env'
        : primary.apiKeySource;
    const inheritedTemperature = Math.min(primary.temperature, REVIEWER_MAX_TEMPERATURE);
    const temperature = dbTemperature ?? env.reviewerTemperature ?? inheritedTemperature;

    return {
      ...primary,
      baseUrl,
      model,
      apiKey,
      apiKeySource,
      temperature,
      isDedicated:
        baseUrl !== primary.baseUrl ||
        model !== primary.model ||
        apiKey !== primary.apiKey ||
        temperature !== inheritedTemperature,
    };
  }

  getPublicConfig(user: IdentityUser): AiPublicConfig {
    const config = this.resolveConfig();
    const reviewer = this.resolveReviewerConfig();
    const row = this.getRow();
    const reviewerPublic: AiReviewerPublicConfig = {
      configured: Boolean(reviewer.apiKey),
      isDedicated: reviewer.isDedicated,
      baseUrl: reviewer.baseUrl,
      model: reviewer.model,
      hasApiKey: Boolean(reviewer.apiKey),
      apiKeySource: reviewer.apiKeySource,
      maskedApiKey: maskApiKey(reviewer.apiKey),
      temperature: reviewer.temperature,
      hasDedicatedBaseUrl: Boolean(row?.reviewerBaseUrl?.trim()) || Boolean(readAiEnvDefaults().reviewerBaseUrl),
      hasDedicatedModel: Boolean(row?.reviewerModel?.trim()) || Boolean(readAiEnvDefaults().reviewerModel),
      hasDedicatedApiKey: Boolean(row?.reviewerApiKey?.trim()) || Boolean(readAiEnvDefaults().reviewerApiKey),
      hasDedicatedTemperature:
        row?.reviewerTemperature != null || readAiEnvDefaults().reviewerTemperature !== null,
    };
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
      reviewer: reviewerPublic,
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
    const reviewer = input.reviewer;
    const clearable = (value: string | null | undefined): string | null | undefined => {
      if (value === undefined) return undefined;
      const trimmed = value?.trim() ?? '';
      return trimmed ? trimmed : null;
    };
    const values = {
      baseUrl: input.baseUrl ?? existing?.baseUrl ?? env.baseUrl,
      model: input.model ?? existing?.model ?? env.model,
      apiKey: nextApiKey,
      temperature: input.temperature ?? existing?.temperature ?? DEFAULT_TEMPERATURE,
      maxRetries: input.maxRetries ?? existing?.maxRetries ?? DEFAULT_MAX_RETRIES,
      timeoutMs: input.timeoutMs ?? existing?.timeoutMs ?? env.timeoutMs,
      reviewerBaseUrl:
        reviewer === undefined
          ? (existing?.reviewerBaseUrl ?? null)
          : (clearable(reviewer.baseUrl) ?? null),
      reviewerModel:
        reviewer === undefined
          ? (existing?.reviewerModel ?? null)
          : (clearable(reviewer.model) ?? null),
      reviewerApiKey:
        reviewer === undefined
          ? (existing?.reviewerApiKey ?? null)
          : (clearable(reviewer.apiKey) ?? null),
      reviewerTemperature:
        reviewer === undefined
          ? (existing?.reviewerTemperature ?? null)
          : reviewer.temperature === undefined
            ? (existing?.reviewerTemperature ?? null)
            : reviewer.temperature,
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
