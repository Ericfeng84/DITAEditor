import type { CSSProperties } from 'react';
import { collectWorkspaceFilesByKind } from '../../map-tree/map-tree-utils.js';
import type {
  ManualPublishProfile,
  PdfFontFamily,
  PdfFontSize,
  PdfMargins,
  PdfPageSize,
  PdfThemeCoverStyle,
  PdfThemeDescriptor,
  PdfThemeFeatures,
  PdfThemeId,
  PdfThemeOptions,
  PdfThemePalette,
} from '../../services/publish-api';
import type { WorkspaceFileNode } from '../../services/workspace-api';

/**
 * Pure model behind the PDF theme picker (Phase 15): the dialog-local draft, its mapping to the
 * `pdfThemeOptions` request contract, workspace logo discovery and the deterministic palette →
 * paper-thumbnail styles. Deliberately free of React so the rules are unit tested without a DOM.
 */
export interface PdfThemeDraft {
  themeId: PdfThemeId;
  /** Always a normalized `#rrggbb`; equal to `descriptor.defaultAccent` means "theme default". */
  accentColor: string;
  pageSize: PdfPageSize;
  fontFamily: PdfFontFamily;
  fontSize: PdfFontSize;
  margins: PdfMargins;
  /** Printed on the cover, below the document title. */
  coverSubtitle: string;
  headerText: string;
  footerText: string;
  logoPath: string;
  features: PdfThemeFeatures;
}

/** Mirrors the text limits enforced by the API registry. */
export const PDF_THEME_TEXT_LIMITS = { coverSubtitle: 120, headerText: 120, footerText: 240 } as const;

export const PDF_PAGE_SIZES: readonly PdfPageSize[] = ['A4', 'Letter', 'B5'];
export const PDF_FONT_SIZES: readonly PdfFontSize[] = ['9pt', '10pt', '11pt'];
export const PDF_FONT_FAMILIES: readonly PdfFontFamily[] = ['sans', 'serif'];
export const PDF_MARGINS: readonly PdfMargins[] = ['compact', 'normal', 'wide'];

/** Physical page proportions used by the CSS-only thumbnail and the preview toolbar badge. */
export const PDF_PAGE_RATIO: Readonly<Record<PdfPageSize, string>> = {
  A4: '210 / 297',
  Letter: '215.9 / 279.4',
  B5: '176 / 250',
};

const ACCENT_PATTERN = /^#?[0-9a-fA-F]{6}$/;
const FEATURE_KEYS = [
  'showCover',
  'showToc',
  'chapterNumbers',
  'taskLabels',
  'mirrorMargins',
] as const;
/**
 * Apache FOP 2.9 renders PNG/JPEG and (through Batik) SVG. WebP has no FOP image handler, so a
 * `.webp` logo would abort the build — it is filtered out of the picker and rejected by the API.
 */
const LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg'] as const;

/** `#1a2b3c` for any 6-digit hex (with or without `#`), otherwise the fallback. */
export function normalizePdfAccentColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!ACCENT_PATTERN.test(trimmed)) {
    return ACCENT_PATTERN.test(fallback)
      ? `#${fallback.replace(/^#/, '').toLowerCase()}`
      : fallback;
  }
  return `#${trimmed.replace(/^#/, '').toLowerCase()}`;
}

function clampText(value: string, limit: number): string {
  return value.trim().slice(0, limit);
}

function resolveFeatures(
  source: Partial<PdfThemeFeatures> | undefined,
  fallback: PdfThemeFeatures,
): PdfThemeFeatures {
  const features = { ...fallback };
  for (const key of FEATURE_KEYS) {
    const value = source?.[key];
    if (typeof value === 'boolean') features[key] = value;
  }
  return features;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Default draft for a descriptor: theme layout defaults, theme features, empty brand fields. */
export function defaultPdfThemeDraft(descriptor: PdfThemeDescriptor): PdfThemeDraft {
  return {
    themeId: descriptor.id,
    accentColor: normalizePdfAccentColor(descriptor.defaultAccent, '#1d4ed8'),
    pageSize: descriptor.defaultPageSize,
    fontFamily: descriptor.defaultFontFamily,
    fontSize: descriptor.defaultFontSize,
    margins: descriptor.defaultMargins,
    coverSubtitle: '',
    headerText: '',
    footerText: '',
    logoPath: '',
    features: resolveFeatures(undefined, descriptor.defaultFeatures),
  };
}

/** Defensive normalization for values that came from a profile, a switch or user typing. */
export function normalizePdfThemeDraft(
  draft: PdfThemeDraft,
  descriptor: PdfThemeDescriptor,
): PdfThemeDraft {
  return {
    themeId: descriptor.id,
    accentColor: normalizePdfAccentColor(draft.accentColor, descriptor.defaultAccent),
    pageSize: oneOf(draft.pageSize, PDF_PAGE_SIZES, descriptor.defaultPageSize),
    fontFamily: oneOf(draft.fontFamily, PDF_FONT_FAMILIES, descriptor.defaultFontFamily),
    fontSize: oneOf(draft.fontSize, PDF_FONT_SIZES, descriptor.defaultFontSize),
    margins: oneOf(draft.margins, PDF_MARGINS, descriptor.defaultMargins),
    coverSubtitle: clampText(draft.coverSubtitle, PDF_THEME_TEXT_LIMITS.coverSubtitle),
    headerText: clampText(draft.headerText, PDF_THEME_TEXT_LIMITS.headerText),
    footerText: clampText(draft.footerText, PDF_THEME_TEXT_LIMITS.footerText),
    logoPath: draft.logoPath.trim(),
    features: resolveFeatures(draft.features, descriptor.defaultFeatures),
  };
}

/** Draft initialized from the manual publish profile (theme defaults when it is blank). */
export function pdfThemeDraftFromProfile(
  profile: ManualPublishProfile,
  descriptor: PdfThemeDescriptor,
): PdfThemeDraft {
  const options = profile.pdfThemeOptions ?? {};
  return normalizePdfThemeDraft(
    {
      themeId: descriptor.id,
      accentColor:
        typeof options.accentColor === 'string' && options.accentColor
          ? options.accentColor
          : descriptor.defaultAccent,
      pageSize: options.pageSize ?? descriptor.defaultPageSize,
      fontFamily: options.fontFamily ?? descriptor.defaultFontFamily,
      fontSize: options.fontSize ?? descriptor.defaultFontSize,
      margins: options.margins ?? descriptor.defaultMargins,
      coverSubtitle: options.coverSubtitle ?? '',
      headerText: options.headerText ?? '',
      footerText: options.footerText ?? '',
      logoPath: options.logoPath ?? '',
      features: resolveFeatures(options.features, descriptor.defaultFeatures),
    },
    descriptor,
  );
}

/**
 * Switching themes keeps the manual's cover subtitle, header/footer text and logo, keeps a
 * hand-picked accent (but re-seeds the new theme's accent when the old one was untouched), and
 * always re-seeds the layout (paper, family, size, margins) and feature flags onto the new
 * theme so switching to `compact-guide` really yields its 9pt compact layout.
 * `vanilla` clears customization because DITA-OT output is left untouched.
 */
export function applyPdfThemeSelection(
  draft: PdfThemeDraft,
  previous: PdfThemeDescriptor | null,
  next: PdfThemeDescriptor,
): PdfThemeDraft {
  if (!next.supportsCustomization) return defaultPdfThemeDraft(next);
  const keepsAccent =
    previous !== null &&
    previous.supportsCustomization &&
    normalizePdfAccentColor(draft.accentColor, previous.defaultAccent) !==
      normalizePdfAccentColor(previous.defaultAccent, previous.defaultAccent);
  const safe = previous ? normalizePdfThemeDraft(draft, previous) : defaultPdfThemeDraft(next);
  return {
    themeId: next.id,
    accentColor: keepsAccent
      ? safe.accentColor
      : normalizePdfAccentColor(next.defaultAccent, next.defaultAccent),
    pageSize: next.defaultPageSize,
    fontFamily: next.defaultFontFamily,
    fontSize: next.defaultFontSize,
    margins: next.defaultMargins,
    coverSubtitle: safe.coverSubtitle,
    headerText: safe.headerText,
    footerText: safe.footerText,
    logoPath: safe.logoPath,
    features: resolveFeatures(undefined, next.defaultFeatures),
  };
}

/**
 * Map the draft onto the request/profile option contract. `vanilla` intentionally produces `{}`
 * so the API skips the customization directory, and every value that still equals the theme
 * default is omitted so a saved profile stays minimal.
 */
export function pdfThemeOptionsFromDraft(
  draft: PdfThemeDraft,
  descriptor: PdfThemeDescriptor,
): PdfThemeOptions {
  if (!descriptor.supportsCustomization) return {};
  const safe = normalizePdfThemeDraft(draft, descriptor);
  const options: PdfThemeOptions = { features: { ...safe.features } };
  if (safe.accentColor !== normalizePdfAccentColor(descriptor.defaultAccent, descriptor.defaultAccent)) {
    options.accentColor = safe.accentColor;
  }
  if (safe.pageSize !== descriptor.defaultPageSize) options.pageSize = safe.pageSize;
  if (safe.fontFamily !== descriptor.defaultFontFamily) options.fontFamily = safe.fontFamily;
  if (safe.fontSize !== descriptor.defaultFontSize) options.fontSize = safe.fontSize;
  if (safe.margins !== descriptor.defaultMargins) options.margins = safe.margins;
  if (safe.coverSubtitle) options.coverSubtitle = safe.coverSubtitle;
  if (safe.headerText) options.headerText = safe.headerText;
  if (safe.footerText) options.footerText = safe.footerText;
  if (safe.logoPath) options.logoPath = safe.logoPath;
  return options;
}

/** Workspace image paths offered by the cover logo picker, WebP excluded, stable-sorted. */
export function collectPdfLogoPaths(files: WorkspaceFileNode[]): string[] {
  return collectWorkspaceFilesByKind(files, new Set(['image'])).filter((path) => {
    const lower = path.toLowerCase();
    return LOGO_EXTENSIONS.some((extension) => lower.endsWith(extension));
  });
}

export interface PdfThumbnailStyle {
  page: CSSProperties;
  band: CSSProperties;
  accentBar: CSSProperties;
  title: CSSProperties;
  line: CSSProperties;
  muted: CSSProperties;
  border: CSSProperties;
  code: CSSProperties;
  coverStyle: PdfThemeCoverStyle;
  aspectRatio: string;
}

/**
 * Palette → inline styles for the CSS-only minified paper sheet on each theme card. The cover
 * style decides how the accent is placed (top band, left rule, centred ornament, thin header).
 */
export function pdfThumbnailStyle(descriptor: PdfThemeDescriptor): PdfThumbnailStyle {
  const palette: PdfThemePalette = descriptor.previewPalette;
  return {
    page: { backgroundColor: palette.page, borderColor: palette.border },
    band: { backgroundColor: palette.header, borderBottomColor: palette.border },
    accentBar: { backgroundColor: palette.accent },
    title: { backgroundColor: palette.text },
    line: { backgroundColor: palette.border },
    muted: { backgroundColor: palette.muted },
    border: { borderColor: palette.border },
    code: { backgroundColor: palette.codeBg, borderColor: palette.border },
    coverStyle: descriptor.coverStyle,
    aspectRatio: PDF_PAGE_RATIO[descriptor.defaultPageSize] ?? PDF_PAGE_RATIO.A4,
  };
}
