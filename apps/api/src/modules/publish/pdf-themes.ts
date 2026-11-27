import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { apiT, type ApiMessageKey } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import { isValidAccent, accentScale } from './html-themes.js';

/**
 * Phase 15: PDF publish style themes.
 *
 * This module is the single source of truth for the PDF theme ids, their
 * localized catalogue metadata, the sanitized theme options and the mapping
 * from the (small, user facing) option set onto the XSLT tokens that
 * `pdf-customization.ts` writes into `<job>/customization/`.
 *
 * The theme assets themselves live in `dita-ot-plugins/pdf-themes/` so the
 * Docker image, the Hugging Face Space and the Electron desktop build all ship
 * them without extra packaging steps.
 */

export type PdfThemeId =
  | 'tech-manual'
  | 'enterprise-spec'
  | 'editorial-book'
  | 'compact-guide'
  | 'vanilla';

export const PDF_THEME_IDS: readonly PdfThemeId[] = [
  'tech-manual',
  'enterprise-spec',
  'editorial-book',
  'compact-guide',
  'vanilla',
];

export const DEFAULT_PDF_THEME_ID: PdfThemeId = 'tech-manual';

export type PdfPageSize = 'A4' | 'Letter' | 'B5';
export type PdfFontFamily = 'sans' | 'serif';
export type PdfFontSize = '9pt' | '10pt' | '11pt';
export type PdfMargins = 'compact' | 'normal' | 'wide';

export type PdfCoverStyle =
  | 'left-accent'
  | 'navy-band'
  | 'editorial-center'
  | 'compact-header'
  | 'vanilla';

export const PDF_PAGE_SIZES: readonly PdfPageSize[] = ['A4', 'Letter', 'B5'];
export const PDF_FONT_FAMILIES: readonly PdfFontFamily[] = ['sans', 'serif'];
export const PDF_FONT_SIZES: readonly PdfFontSize[] = ['9pt', '10pt', '11pt'];
export const PDF_MARGINS: readonly PdfMargins[] = ['compact', 'normal', 'wide'];

export interface PdfThemeFeatures {
  showCover: boolean;
  showToc: boolean;
  chapterNumbers: boolean;
  taskLabels: boolean;
  mirrorMargins: boolean;
}

export interface PdfThemeOptions {
  /** `#RRGGBB` (a bare `RRGGBB` value is accepted and normalized). */
  accentColor?: string | null;
  pageSize?: PdfPageSize | null;
  fontFamily?: PdfFontFamily | null;
  fontSize?: PdfFontSize | null;
  margins?: PdfMargins | null;
  /** Secondary line under the cover title. */
  coverSubtitle?: string | null;
  /** Running header left slot; falls back to the product name. */
  headerText?: string | null;
  /** Running footer left slot (copyright, revision, …). */
  footerText?: string | null;
  /** Workspace-relative image path (`.png/.jpg/.jpeg/.svg`). */
  logoPath?: string | null;
  features?: Partial<PdfThemeFeatures>;
}

export interface PdfThemePalette {
  page: string;
  header: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  codeBg: string;
}

export interface PdfThemeDescriptor {
  id: PdfThemeId;
  name: string;
  description: string;
  tags: string[];
  defaultAccent: string;
  defaultPageSize: PdfPageSize;
  defaultFontFamily: PdfFontFamily;
  defaultFontSize: PdfFontSize;
  defaultMargins: PdfMargins;
  coverStyle: PdfCoverStyle;
  supportsCustomization: boolean;
  previewPalette: PdfThemePalette;
  defaultFeatures: PdfThemeFeatures;
}

/** Length limits for the free-text PDF options (characters, post-trim). */
export const PDF_THEME_OPTION_LIMITS = {
  coverSubtitle: 120,
  headerText: 120,
  footerText: 240,
} as const;

/** Logo formats FOP 2.9 can rasterize. WebP is rejected on purpose. */
export const PDF_LOGO_EXTENSIONS: readonly string[] = ['.png', '.jpg', '.jpeg', '.svg'];

/** Hard cap for a workspace logo file (bytes). */
export const PDF_LOGO_MAX_BYTES = 2 * 1024 * 1024;

interface PdfThemeDefinition extends Omit<PdfThemeDescriptor, 'name' | 'description' | 'tags'> {
  tags: readonly string[];
}

const PDF_THEME_DEFINITIONS: Record<PdfThemeId, PdfThemeDefinition> = {
  'tech-manual': {
    id: 'tech-manual',
    tags: ['default', 'modern', 'docs'],
    defaultAccent: '#0f766e',
    defaultPageSize: 'A4',
    defaultFontFamily: 'sans',
    defaultFontSize: '10pt',
    defaultMargins: 'normal',
    coverStyle: 'left-accent',
    supportsCustomization: true,
    previewPalette: {
      page: '#ffffff',
      header: '#f1f5f9',
      text: '#111827',
      muted: '#6b7280',
      accent: '#0f766e',
      border: '#e5e7eb',
      codeBg: '#f6f8fa',
    },
    defaultFeatures: {
      showCover: true,
      showToc: true,
      chapterNumbers: false,
      taskLabels: true,
      mirrorMargins: false,
    },
  },
  'enterprise-spec': {
    id: 'enterprise-spec',
    tags: ['spec', 'dense', 'print'],
    defaultAccent: '#0f2942',
    defaultPageSize: 'A4',
    defaultFontFamily: 'sans',
    defaultFontSize: '10pt',
    defaultMargins: 'normal',
    coverStyle: 'navy-band',
    supportsCustomization: true,
    previewPalette: {
      page: '#ffffff',
      header: '#e8edf3',
      text: '#0b1220',
      muted: '#5b6b7d',
      accent: '#0f2942',
      border: '#c3d0de',
      codeBg: '#f4f6f9',
    },
    defaultFeatures: {
      showCover: true,
      showToc: true,
      chapterNumbers: true,
      taskLabels: true,
      mirrorMargins: false,
    },
  },
  'editorial-book': {
    id: 'editorial-book',
    tags: ['book', 'print', 'serif'],
    defaultAccent: '#9a3412',
    defaultPageSize: 'A4',
    defaultFontFamily: 'serif',
    defaultFontSize: '11pt',
    defaultMargins: 'wide',
    coverStyle: 'editorial-center',
    supportsCustomization: true,
    previewPalette: {
      page: '#fffdf9',
      header: '#faf6f1',
      text: '#1c1917',
      muted: '#78716c',
      accent: '#9a3412',
      border: '#e8ddd0',
      codeBg: '#faf6f0',
    },
    defaultFeatures: {
      showCover: true,
      showToc: true,
      chapterNumbers: true,
      taskLabels: false,
      mirrorMargins: true,
    },
  },
  'compact-guide': {
    id: 'compact-guide',
    tags: ['compact', 'dense', 'printer'],
    defaultAccent: '#2563eb',
    defaultPageSize: 'A4',
    defaultFontFamily: 'sans',
    defaultFontSize: '9pt',
    defaultMargins: 'compact',
    coverStyle: 'compact-header',
    supportsCustomization: true,
    previewPalette: {
      page: '#ffffff',
      header: '#eef2f8',
      text: '#111827',
      muted: '#64748b',
      accent: '#2563eb',
      border: '#dbe3ec',
      codeBg: '#f5f7fb',
    },
    defaultFeatures: {
      showCover: true,
      showToc: true,
      chapterNumbers: false,
      taskLabels: true,
      mirrorMargins: true,
    },
  },
  vanilla: {
    id: 'vanilla',
    tags: ['native'],
    defaultAccent: '#1f4e79',
    defaultPageSize: 'A4',
    defaultFontFamily: 'sans',
    defaultFontSize: '10pt',
    defaultMargins: 'normal',
    coverStyle: 'vanilla',
    supportsCustomization: false,
    previewPalette: {
      page: '#ffffff',
      header: '#ffffff',
      text: '#000000',
      muted: '#555555',
      accent: '#1f4e79',
      border: '#999999',
      codeBg: '#f2f2f2',
    },
    defaultFeatures: {
      showCover: true,
      showToc: true,
      chapterNumbers: false,
      taskLabels: false,
      mirrorMargins: false,
    },
  },
};

export function isPdfThemeId(value: unknown): value is PdfThemeId {
  return typeof value === 'string' && (PDF_THEME_IDS as readonly string[]).includes(value);
}

export function pdfThemeDefinition(id: PdfThemeId): PdfThemeDefinition {
  return PDF_THEME_DEFINITIONS[id];
}

const PDF_THEME_LABEL_KEYS: Record<
  PdfThemeId,
  { name: ApiMessageKey; description: ApiMessageKey }
> = {
  'tech-manual': {
    name: 'publish.pdfTheme.tech-manual.name',
    description: 'publish.pdfTheme.tech-manual.description',
  },
  'enterprise-spec': {
    name: 'publish.pdfTheme.enterprise-spec.name',
    description: 'publish.pdfTheme.enterprise-spec.description',
  },
  'editorial-book': {
    name: 'publish.pdfTheme.editorial-book.name',
    description: 'publish.pdfTheme.editorial-book.description',
  },
  'compact-guide': {
    name: 'publish.pdfTheme.compact-guide.name',
    description: 'publish.pdfTheme.compact-guide.description',
  },
  vanilla: {
    name: 'publish.pdfTheme.vanilla.name',
    description: 'publish.pdfTheme.vanilla.description',
  },
};

const PDF_THEME_TAG_KEYS: Record<string, ApiMessageKey> = {
  default: 'publish.pdfThemeTag.default',
  modern: 'publish.pdfThemeTag.modern',
  docs: 'publish.pdfThemeTag.docs',
  spec: 'publish.pdfThemeTag.spec',
  dense: 'publish.pdfThemeTag.dense',
  print: 'publish.pdfThemeTag.print',
  book: 'publish.pdfThemeTag.book',
  serif: 'publish.pdfThemeTag.serif',
  compact: 'publish.pdfThemeTag.compact',
  printer: 'publish.pdfThemeTag.printer',
  native: 'publish.pdfThemeTag.native',
};

function localizedDescriptor(id: PdfThemeId, locale: ApiLocale): PdfThemeDescriptor {
  const definition = PDF_THEME_DEFINITIONS[id];
  const labels = PDF_THEME_LABEL_KEYS[id];
  return {
    id: definition.id,
    name: apiT(locale, labels.name),
    description: apiT(locale, labels.description),
    tags: definition.tags.map((tag) =>
      tag in PDF_THEME_TAG_KEYS ? apiT(locale, PDF_THEME_TAG_KEYS[tag]!) : tag,
    ),
    defaultAccent: definition.defaultAccent,
    defaultPageSize: definition.defaultPageSize,
    defaultFontFamily: definition.defaultFontFamily,
    defaultFontSize: definition.defaultFontSize,
    defaultMargins: definition.defaultMargins,
    coverStyle: definition.coverStyle,
    supportsCustomization: definition.supportsCustomization,
    previewPalette: { ...definition.previewPalette },
    defaultFeatures: { ...definition.defaultFeatures },
  };
}

/** All PDF themes in display order, localized for `locale`. */
export function listPdfThemes(locale: ApiLocale): PdfThemeDescriptor[] {
  return PDF_THEME_IDS.map((id) => localizedDescriptor(id, locale));
}

/** A single localized descriptor, or `undefined` for unknown ids. */
export function getPdfTheme(locale: ApiLocale, id: string): PdfThemeDescriptor | undefined {
  return isPdfThemeId(id) ? localizedDescriptor(id, locale) : undefined;
}

/* -------------------------------------------------------------------------- */
/* Option sanitizing + zod contracts                                           */
/* -------------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, limit: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** Merge partial feature input over the theme's documented defaults. */
export function resolvePdfThemeFeatures(
  themeId: PdfThemeId,
  input: unknown,
): PdfThemeFeatures {
  const features: PdfThemeFeatures = { ...PDF_THEME_DEFINITIONS[themeId].defaultFeatures };
  const source = isRecord(input) ? input : {};
  for (const key of Object.keys(features) as (keyof PdfThemeFeatures)[]) {
    const value = source[key];
    if (typeof value === 'boolean') features[key] = value;
  }
  return features;
}

/**
 * Coerce arbitrary JSON (request bodies, stored profiles, legacy rows) into a
 * usable PDF options object. Junk input never throws: unknown keys are dropped,
 * empty strings disappear, over-long text is truncated, enum values must be one
 * of the documented literals and feature flags keep their theme defaults unless
 * the caller supplied a real boolean.
 */
export function resolvePdfThemeOptions(themeId: PdfThemeId, input: unknown): PdfThemeOptions {
  const source = isRecord(input) ? input : {};
  const options: PdfThemeOptions = {
    features: resolvePdfThemeFeatures(themeId, source.features),
  };

  const accent = typeof source.accentColor === 'string' ? source.accentColor.trim() : '';
  if (isValidAccent(accent)) {
    options.accentColor = `#${accent.replace(/^#/, '').toLowerCase()}`;
  }
  const pageSize = pickEnum(source.pageSize, PDF_PAGE_SIZES);
  if (pageSize) options.pageSize = pageSize;
  const fontFamily = pickEnum(source.fontFamily, PDF_FONT_FAMILIES);
  if (fontFamily) options.fontFamily = fontFamily;
  const fontSize = pickEnum(source.fontSize, PDF_FONT_SIZES);
  if (fontSize) options.fontSize = fontSize;
  const margins = pickEnum(source.margins, PDF_MARGINS);
  if (margins) options.margins = margins;

  const coverSubtitle = cleanText(source.coverSubtitle, PDF_THEME_OPTION_LIMITS.coverSubtitle);
  if (coverSubtitle) options.coverSubtitle = coverSubtitle;
  const headerText = cleanText(source.headerText, PDF_THEME_OPTION_LIMITS.headerText);
  if (headerText) options.headerText = headerText;
  const footerText = cleanText(source.footerText, PDF_THEME_OPTION_LIMITS.footerText);
  if (footerText) options.footerText = footerText;
  const logoPath = cleanText(source.logoPath, 1024);
  if (logoPath) options.logoPath = logoPath;

  return options;
}

export const pdfThemeIdSchema = z.enum([
  'tech-manual',
  'enterprise-spec',
  'editorial-book',
  'compact-guide',
  'vanilla',
]);

const accentPattern = /^#?[0-9a-fA-F]{6}$/;

/**
 * Zod contract for `pdfThemeOptions` in publish requests and saved profiles.
 * Unknown keys are stripped (zod default) so a newer web client cannot smuggle
 * arbitrary configuration into `publish_jobs.options_json` — and it can never
 * supply an XSL path, because no such field exists.
 */
export const pdfThemeOptionsSchema = z.object({
  accentColor: z.string().regex(accentPattern).nullish(),
  pageSize: z.enum(['A4', 'Letter', 'B5']).nullish(),
  fontFamily: z.enum(['sans', 'serif']).nullish(),
  fontSize: z.enum(['9pt', '10pt', '11pt']).nullish(),
  margins: z.enum(['compact', 'normal', 'wide']).nullish(),
  coverSubtitle: z.string().max(PDF_THEME_OPTION_LIMITS.coverSubtitle).nullish(),
  headerText: z.string().max(PDF_THEME_OPTION_LIMITS.headerText).nullish(),
  footerText: z.string().max(PDF_THEME_OPTION_LIMITS.footerText).nullish(),
  logoPath: z.string().max(1024).nullish(),
  features: z
    .object({
      showCover: z.boolean(),
      showToc: z.boolean(),
      chapterNumbers: z.boolean(),
      taskLabels: z.boolean(),
      mirrorMargins: z.boolean(),
    })
    .partial()
    .nullish(),
});

/* -------------------------------------------------------------------------- */
/* Asset directory resolution                                                  */
/* -------------------------------------------------------------------------- */

function findRepoRoot(): string {
  let cursor = fileURLToPath(new URL('.', import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(cursor, 'samples', 'demo-dita-project'))) {
      return cursor;
    }
    const parent = resolve(cursor, '..');
    if (parent === cursor) break;
    cursor = parent;
  }
  return process.cwd();
}

/**
 * Locate `dita-ot-plugins/pdf-themes`:
 * explicit override → `DITAEDITOR_PDF_THEMES_DIR` → repository walk-up.
 */
export function resolvePdfThemesDir(override?: string): string {
  const configured = override?.trim() || process.env.DITAEDITOR_PDF_THEMES_DIR?.trim() || '';
  if (configured) {
    const dir = resolve(configured);
    if (!existsSync(join(dir, 'shared', 'attrs-base.xsl'))) {
      throw new Error(`pdf-themes assets not found: ${dir}`);
    }
    return dir;
  }

  const dir = join(findRepoRoot(), 'dita-ot-plugins', 'pdf-themes');
  if (!existsSync(join(dir, 'shared', 'attrs-base.xsl'))) {
    throw new Error(`pdf-themes assets not found: ${dir}`);
  }
  return dir;
}

/* -------------------------------------------------------------------------- */
/* XSLT token derivation                                                       */
/* -------------------------------------------------------------------------- */

/** Print-geometry table: page box (mm) and the three margin presets (mm). */
export const PDF_PAGE_GEOMETRY: Record<
  PdfPageSize,
  { width: string; height: string }
> = {
  A4: { width: '210mm', height: '297mm' },
  Letter: { width: '215.9mm', height: '279.4mm' },
  B5: { width: '176mm', height: '250mm' },
};

export const PDF_MARGIN_PRESETS: Record<
  PdfMargins,
  { inside: string; outside: string; top: string; bottom: string }
> = {
  compact: { inside: '15mm', outside: '15mm', top: '16mm', bottom: '16mm' },
  normal: { inside: '22mm', outside: '22mm', top: '22mm', bottom: '22mm' },
  wide: { inside: '30mm', outside: '26mm', top: '28mm', bottom: '28mm' },
};

const DITA_OT_FONT_KEYS: Record<PdfFontFamily, string> = {
  sans: 'sans',
  serif: 'serif',
};

export interface ResolvedPdfTheme {
  themeId: PdfThemeId;
  options: PdfThemeOptions;
  features: PdfThemeFeatures;
  accent: string;
  pageSize: PdfPageSize;
  fontFamily: PdfFontFamily;
  fontSize: PdfFontSize;
  margins: PdfMargins;
  /** DITA-OT logical font key (`sans` → `Sans`, `serif` → `Serif`). */
  fontKey: string;
}

/** Fill a theme's documented defaults into a sanitized option object. */
export function resolvePdfTheme(themeId: PdfThemeId, input: unknown): ResolvedPdfTheme {
  const definition = PDF_THEME_DEFINITIONS[themeId];
  const options = resolvePdfThemeOptions(themeId, input);
  const fontFamily = options.fontFamily ?? definition.defaultFontFamily;
  return {
    themeId,
    options,
    features: resolvePdfThemeFeatures(themeId, options.features),
    accent: options.accentColor ?? definition.defaultAccent,
    pageSize: options.pageSize ?? definition.defaultPageSize,
    fontFamily,
    fontSize: options.fontSize ?? definition.defaultFontSize,
    margins: options.margins ?? definition.defaultMargins,
    fontKey: DITA_OT_FONT_KEYS[fontFamily],
  };
}

const OPAQUE_RGBA = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/;

/**
 * FOP understands `#RRGGBB` and `rgb()` but not alpha, so flatten the shared
 * CSS accent scale (which may return `rgba()` tints) against white.
 */
export function toFoColor(color: string): string {
  const rgba = OPAQUE_RGBA.exec(color.trim());
  if (!rgba) return color.trim();
  const alpha = Math.min(1, Math.max(0, Number.parseFloat(rgba[4]!)));
  const blend = (channel: string): number =>
    Math.round(Number.parseInt(channel, 10) * alpha + 255 * (1 - alpha));
  const toHex = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${toHex(blend(rgba[1]!))}${toHex(blend(rgba[2]!))}${toHex(blend(rgba[3]!))}`;
}

export interface PdfThemeColors {
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentContrast: string;
}

/** Accent + derived tints, always opaque and FOP safe. */
export function pdfThemeColors(accent: string): PdfThemeColors {
  const scale = accentScale(accent);
  return {
    accent: scale.accent,
    accentSoft: toFoColor(scale.soft),
    accentBorder: toFoColor(scale.border),
    accentContrast: scale.contrast,
  };
}
