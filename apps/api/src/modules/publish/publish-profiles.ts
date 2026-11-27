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
import {
  DEFAULT_PDF_THEME_ID,
  isPdfThemeId,
  resolvePdfThemeOptions,
  type PdfThemeId,
  type PdfThemeOptions,
} from './pdf-themes.js';

/**
 * Publishing defaults persisted per manual: HTML5 themes (Phase 12) and PDF themes
 * (Phase 15). Both sides are independent - saving one never rewrites the other.
 */
export interface ManualPublishProfile {
  readonly manualId: string;
  readonly htmlThemeId: HtmlThemeId;
  readonly htmlThemeOptions: HtmlThemeOptions;
  readonly pdfThemeId: PdfThemeId;
  readonly pdfThemeOptions: PdfThemeOptions;
  readonly updatedBy: string | null;
  readonly updatedAt: string | null;
}

/** Partial update of one side (or both) of a manual's publish profile. */
export interface PublishProfileUpdate {
  readonly themeId?: HtmlThemeId;
  readonly themeOptions?: unknown;
  readonly pdfThemeId?: PdfThemeId;
  readonly pdfThemeOptions?: unknown;
}

/** Profile returned when a manual has never saved theme preferences. */
export function defaultProfile(manualId: string): ManualPublishProfile {
  return {
    manualId,
    htmlThemeId: DEFAULT_HTML_THEME_ID,
    htmlThemeOptions: {},
    pdfThemeId: DEFAULT_PDF_THEME_ID,
    pdfThemeOptions: {},
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

const PDF_SCALAR_OPTION_KEYS = [
  'accentColor',
  'pageSize',
  'fontFamily',
  'fontSize',
  'margins',
  'coverSubtitle',
  'headerText',
  'footerText',
  'logoPath',
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
 * PDF counterpart of `mergeThemeOptions`. The theme id is required because every default
 * (page size, font, margin preset, feature flags) is theme specific.
 */
export function mergePdfThemeOptions(
  themeId: PdfThemeId,
  base: unknown,
  override: unknown,
): PdfThemeOptions {
  const baseRecord = asRecord(base);
  const overrideRecord = asRecord(override);
  const merged: Record<string, unknown> = {};
  for (const key of PDF_SCALAR_OPTION_KEYS) {
    const value = overrideRecord[key] ?? baseRecord[key];
    if (value != null) merged[key] = value;
  }
  merged.features = {
    ...asRecord(baseRecord.features),
    ...asRecord(overrideRecord.features),
  };
  return resolvePdfThemeOptions(themeId, merged);
}

/**
 * Per-manual publish preferences. `get()` never throws so publishing keeps working before a
 * manual has ever configured a theme; only `save()` validates the theme ids.
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
    const pdfThemeId = isPdfThemeId(row.pdfThemeId) ? row.pdfThemeId : DEFAULT_PDF_THEME_ID;
    return {
      manualId: row.manualId,
      htmlThemeId,
      htmlThemeOptions: normalizeStoredOptions(htmlThemeId, row.htmlThemeOptionsJson),
      pdfThemeId,
      pdfThemeOptions: normalizeStoredPdfOptions(pdfThemeId, row.pdfThemeOptionsJson),
      updatedBy: row.updatedBy ?? null,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Persist the supplied side(s) of the profile. The other side is read back from the row and
   * written unchanged, so `PUT /api/publish/profile` with only `pdfThemeId` cannot reset the
   * HTML5 theme (and vice versa).
   */
  save(
    manualId: string,
    update: PublishProfileUpdate,
    updatedBy: string,
  ): ManualPublishProfile {
    if (update.themeId === undefined && update.pdfThemeId === undefined) {
      throw httpError(400, 'publish.invalidThemeOptions');
    }
    const current = this.get(manualId);
    let htmlThemeId = current.htmlThemeId;
    let htmlOptions = current.htmlThemeOptions;
    if (update.themeId !== undefined) {
      if (!isHtmlThemeId(update.themeId)) {
        throw httpError(400, 'publish.invalidThemeOptions', undefined, {
          themeId: update.themeId,
        });
      }
      htmlThemeId = update.themeId;
      htmlOptions =
        htmlThemeId === 'vanilla' ? {} : resolveThemeOptions(update.themeOptions ?? {});
    }
    let pdfThemeId = current.pdfThemeId;
    let pdfOptions = current.pdfThemeOptions;
    if (update.pdfThemeId !== undefined) {
      if (!isPdfThemeId(update.pdfThemeId)) {
        throw httpError(400, 'publish.invalidThemeOptions', undefined, {
          themeId: update.pdfThemeId,
        });
      }
      pdfThemeId = update.pdfThemeId;
      pdfOptions =
        pdfThemeId === 'vanilla'
          ? {}
          : resolvePdfThemeOptions(pdfThemeId, update.pdfThemeOptions ?? {});
    }
    const updatedAt = new Date().toISOString();
    const row = {
      manualId,
      htmlThemeId,
      htmlThemeOptionsJson: JSON.stringify(htmlOptions),
      pdfThemeId,
      pdfThemeOptionsJson: JSON.stringify(pdfOptions),
      updatedBy,
      updatedAt,
    };
    this.db
      .insert(manualPublishProfiles)
      .values(row)
      .onConflictDoUpdate({
        target: manualPublishProfiles.manualId,
        set: {
          htmlThemeId: row.htmlThemeId,
          htmlThemeOptionsJson: row.htmlThemeOptionsJson,
          pdfThemeId: row.pdfThemeId,
          pdfThemeOptionsJson: row.pdfThemeOptionsJson,
          updatedBy: row.updatedBy,
          updatedAt: row.updatedAt,
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

/** PDF counterpart of `normalizeStoredOptions`. */
function normalizeStoredPdfOptions(themeId: PdfThemeId, json: string): PdfThemeOptions {
  if (themeId === 'vanilla') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return resolvePdfThemeOptions(themeId, {});
  }
  return resolvePdfThemeOptions(themeId, parsed);
}
