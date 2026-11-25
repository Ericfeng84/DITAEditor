import type { CSSProperties } from 'react';
import { collectWorkspaceFilesByKind } from '../../map-tree/map-tree-utils.js';
import type {
  HtmlThemeDescriptor,
  HtmlThemeDefaultMode,
  HtmlThemeFeatures,
  HtmlThemeId,
  HtmlThemeOptions,
  HtmlThemePalette,
  ManualPublishProfile,
} from '../../services/publish-api';
import type { WorkspaceFileNode } from '../../services/workspace-api';

/**
 * Pure model behind the HTML5 theme picker: the dialog-local draft, its mapping to the
 * `htmlThemeOptions` request contract, workspace asset discovery for the brand panel and the
 * deterministic palette → thumbnail styles. Kept away from React so the rules are unit tested
 * without a DOM.
 */
export interface ThemeDraft {
  themeId: HtmlThemeId;
  /** Initial reading mode of the theme; the reader can still flip it in the published output. */
  mode: HtmlThemeDefaultMode;
  /** Always a normalized `#rrggbb`; equal to `descriptor.defaultAccent` means "theme default". */
  accentColor: string;
  siteTitle: string;
  footerText: string;
  logoPath: string;
  customCssPath: string;
  features: HtmlThemeFeatures;
}

export type ThemeAssetKind = 'logo' | 'css';

/** Mirrors `THEME_OPTION_LIMITS` in the API registry. */
export const THEME_TEXT_LIMITS = { siteTitle: 120, footerText: 240 } as const;

const ACCENT_PATTERN = /^#?[0-9a-fA-F]{6}$/;
const FEATURE_KEYS = ['search', 'toc', 'codeCopy', 'colorModeToggle'] as const;
const LOGO_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp'] as const;

/** `#1a2b3c` for any 6-digit hex (with or without `#`), otherwise the fallback. */
export function normalizeAccentColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!ACCENT_PATTERN.test(trimmed)) {
    return ACCENT_PATTERN.test(fallback) ? `#${fallback.replace(/^#/, '').toLowerCase()}` : fallback;
  }
  return `#${trimmed.replace(/^#/, '').toLowerCase()}`;
}

function clampText(value: string, limit: number): string {
  return value.trim().slice(0, limit);
}

function resolveFeatures(
  source: Partial<HtmlThemeFeatures> | undefined,
  fallback: HtmlThemeFeatures,
): HtmlThemeFeatures {
  const features = { ...fallback };
  for (const key of FEATURE_KEYS) {
    const value = source?.[key];
    if (typeof value === 'boolean') features[key] = value;
  }
  return features;
}

/** Default draft for a descriptor: theme accent, theme features, empty brand fields. */
export function defaultThemeDraft(descriptor: HtmlThemeDescriptor): ThemeDraft {
  return {
    themeId: descriptor.id,
    mode: descriptor.defaultMode,
    accentColor: normalizeAccentColor(descriptor.defaultAccent, '#2563eb'),
    siteTitle: '',
    footerText: '',
    logoPath: '',
    customCssPath: '',
    features: resolveFeatures(undefined, descriptor.defaultFeatures),
  };
}

/** Defensive normalization for values that came from a profile, a switch or user typing. */
export function normalizeThemeDraft(
  draft: ThemeDraft,
  descriptor: HtmlThemeDescriptor,
): ThemeDraft {
  return {
    themeId: descriptor.id,
    mode: descriptor.defaultMode,
    accentColor: normalizeAccentColor(draft.accentColor, descriptor.defaultAccent),
    siteTitle: clampText(draft.siteTitle, THEME_TEXT_LIMITS.siteTitle),
    footerText: clampText(draft.footerText, THEME_TEXT_LIMITS.footerText),
    logoPath: draft.logoPath.trim(),
    customCssPath: draft.customCssPath.trim(),
    features: resolveFeatures(draft.features, descriptor.defaultFeatures),
  };
}

/** Draft initialized from the manual publish profile (theme defaults when it is blank). */
export function themeDraftFromProfile(
  profile: ManualPublishProfile,
  descriptor: HtmlThemeDescriptor,
): ThemeDraft {
  const options = profile.htmlThemeOptions;
  return normalizeThemeDraft(
    {
      themeId: descriptor.id,
      mode: descriptor.defaultMode,
      accentColor:
        typeof options.accentColor === 'string' && options.accentColor
          ? options.accentColor
          : descriptor.defaultAccent,
      siteTitle: options.siteTitle ?? '',
      footerText: options.footerText ?? '',
      logoPath: options.logoPath ?? '',
      customCssPath: options.customCssPath ?? '',
      features: resolveFeatures(options.features, descriptor.defaultFeatures),
    },
    descriptor,
  );
}

/**
 * Switching themes keeps the manual's brand text, logo and custom CSS, keeps a hand-picked
 * accent (but re-seeds the new theme's accent when the old one was untouched), and always
 * re-seeds the feature flags so a vanilla round-trip cannot leave everything disabled.
 * `vanilla` clears customization because DITA-OT output is left untouched.
 */
export function applyThemeSelection(
  draft: ThemeDraft,
  previous: HtmlThemeDescriptor | null,
  next: HtmlThemeDescriptor,
): ThemeDraft {
  if (!next.supportsCustomization) return defaultThemeDraft(next);
  const keepsAccent =
    previous !== null &&
    previous.supportsCustomization &&
    normalizeAccentColor(draft.accentColor, previous.defaultAccent) !==
      normalizeAccentColor(previous.defaultAccent, previous.defaultAccent);
  const safe = previous ? normalizeThemeDraft(draft, previous) : defaultThemeDraft(next);
  return {
    themeId: next.id,
    mode: next.defaultMode,
    accentColor: keepsAccent ? safe.accentColor : normalizeAccentColor(next.defaultAccent, next.defaultAccent),
    siteTitle: safe.siteTitle,
    footerText: safe.footerText,
    logoPath: safe.logoPath,
    customCssPath: safe.customCssPath,
    features: resolveFeatures(undefined, next.defaultFeatures),
  };
}

/**
 * Map the draft onto the request/profile option contract. `vanilla` intentionally produces
 * `{}` so the API skips post-processing; the accent is omitted when it equals the theme
 * default so a saved profile stays minimal.
 */
export function themeOptionsFromDraft(
  draft: ThemeDraft,
  descriptor: HtmlThemeDescriptor,
): HtmlThemeOptions {
  if (!descriptor.supportsCustomization) return {};
  const safe = normalizeThemeDraft(draft, descriptor);
  const options: HtmlThemeOptions = { features: { ...safe.features } };
  if (safe.accentColor !== normalizeAccentColor(descriptor.defaultAccent, descriptor.defaultAccent)) {
    options.accentColor = safe.accentColor;
  }
  if (safe.siteTitle) options.siteTitle = safe.siteTitle;
  if (safe.footerText) options.footerText = safe.footerText;
  if (safe.logoPath) options.logoPath = safe.logoPath;
  if (safe.customCssPath) options.customCssPath = safe.customCssPath;
  return options;
}

/** Workspace image / stylesheet paths offered by the brand panel, stable-sorted. */
export function collectThemeAssetPaths(
  files: WorkspaceFileNode[],
  kind: ThemeAssetKind,
): string[] {
  if (kind === 'logo') {
    const images = collectWorkspaceFilesByKind(files, new Set(['image']));
    return images.filter((path) => {
      const lower = path.toLowerCase();
      return LOGO_EXTENSIONS.some((extension) => lower.endsWith(extension));
    });
  }
  return collectWorkspaceFilesByKind(files, new Set(['other'])).filter((path) =>
    path.toLowerCase().endsWith('.css'),
  );
}

export interface ThemeThumbnailStyle {
  frame: CSSProperties;
  header: CSSProperties;
  sidebar: CSSProperties;
  sidebarLine: CSSProperties;
  title: CSSProperties;
  line: CSSProperties;
  button: CSSProperties;
}

/** Palette → inline styles for the CSS-only mini document thumbnail on each theme card. */
export function themeThumbnailStyle(palette: HtmlThemePalette): ThemeThumbnailStyle {
  return {
    frame: { backgroundColor: palette.bg, borderColor: palette.border },
    header: { backgroundColor: palette.header, borderBottomColor: palette.border },
    sidebar: { backgroundColor: palette.surface, borderRightColor: palette.border },
    sidebarLine: { backgroundColor: palette.border },
    title: { backgroundColor: palette.text },
    line: { backgroundColor: palette.border },
    button: { backgroundColor: palette.accent },
  };
}
