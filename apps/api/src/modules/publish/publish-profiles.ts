import { eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { manualPublishProfiles } from '../../db/schema.js';
import { httpError } from '../errors.js';
import {
  DEFAULT_HTML_THEME_ID,
  isHtmlThemeId,
  resolveThemeOptions,
  type HtmlThemeId,
  type HtmlThemeOptions,
} from './html-themes.js';

/** HTML5 publishing defaults persisted per manual (Phase 12). */
export interface ManualPublishProfile {
  readonly manualId: string;
  readonly htmlThemeId: HtmlThemeId;
  readonly htmlThemeOptions: HtmlThemeOptions;
  readonly updatedBy: string | null;
  readonly updatedAt: string | null;
}

/** Profile returned when a manual has never saved theme preferences. */
export function defaultProfile(manualId: string): ManualPublishProfile {
  return {
    manualId,
    htmlThemeId: DEFAULT_HTML_THEME_ID,
    htmlThemeOptions: {},
    updatedBy: null,
    updatedAt: null,
  };
}

const SCALAR_OPTION_KEYS = [
  'accentColor',
  'siteTitle',
  'logoPath',
  'footerText',
  'customCssPath',
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Overlays one theme option set on another: scalar options from `override` win, feature flags
 * merge per key. Inputs are untrusted on purpose (zod output or stored JSON), so the merged
 * object is normalized through `resolveThemeOptions`.
 */
export function mergeThemeOptions(base: unknown, override: unknown): HtmlThemeOptions {
  const baseRecord = asRecord(base);
  const overrideRecord = asRecord(override);
  const merged: Record<string, unknown> = {};
  for (const key of SCALAR_OPTION_KEYS) {
    const value = overrideRecord[key] ?? baseRecord[key];
    if (value != null) merged[key] = value;
  }
  merged.features = {
    ...asRecord(baseRecord.features),
    ...asRecord(overrideRecord.features),
  };
  return resolveThemeOptions(merged);
}

/**
 * Per-manual HTML5 theme preferences. `get()` never throws so publishing keeps working before a
 * manual has ever configured a theme; only `save()` validates the theme id.
 */
export class PublishProfileService {
  constructor(private readonly db: DitaDatabase) {}

  get(manualId: string): ManualPublishProfile {
    const row = this.db
      .select()
      .from(manualPublishProfiles)
      .where(eq(manualPublishProfiles.manualId, manualId))
      .get();
    if (!row) return defaultProfile(manualId);
    const htmlThemeId = isHtmlThemeId(row.htmlThemeId) ? row.htmlThemeId : DEFAULT_HTML_THEME_ID;
    return {
      manualId: row.manualId,
      htmlThemeId,
      htmlThemeOptions: normalizeStoredOptions(htmlThemeId, row.htmlThemeOptionsJson),
      updatedBy: row.updatedBy ?? null,
      updatedAt: row.updatedAt,
    };
  }

  save(
    manualId: string,
    themeId: string,
    themeOptions: unknown,
    updatedBy: string,
  ): ManualPublishProfile {
    if (!isHtmlThemeId(themeId)) {
      throw httpError(400, 'publish.invalidThemeOptions', undefined, { themeId });
    }
    const options = themeId === 'vanilla' ? {} : resolveThemeOptions(themeOptions ?? {});
    const updatedAt = new Date().toISOString();
    this.db
      .insert(manualPublishProfiles)
      .values({
        manualId,
        htmlThemeId: themeId,
        htmlThemeOptionsJson: JSON.stringify(options),
        updatedBy,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: manualPublishProfiles.manualId,
        set: {
          htmlThemeId: themeId,
          htmlThemeOptionsJson: JSON.stringify(options),
          updatedBy,
          updatedAt,
        },
      })
      .run();
    return this.get(manualId);
  }
}

/** Defensive JSON parse of the stored options; `vanilla` keeps no options by design. */
function normalizeStoredOptions(themeId: HtmlThemeId, json: string): HtmlThemeOptions {
  if (themeId === 'vanilla') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return resolveThemeOptions({});
  }
  return resolveThemeOptions(parsed);
}
