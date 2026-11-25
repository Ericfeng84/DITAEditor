import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { apiT, type ApiMessageKey } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';

/**
 * Phase 12: HTML5 publish themes.
 *
 * This module is the single source of truth for the theme ids, their localized
 * catalogue metadata, the sanitized theme options and the accent colour scale
 * that the enhancer writes into `_ditaeditor/brand-vars.css`.
 *
 * The theme assets themselves live in `dita-ot-plugins/html5-themes/` so the
 * Docker image, the Hugging Face Space and the Electron desktop build all ship
 * them without extra packaging steps.
 */

export type HtmlThemeId =
  | 'tech-docs'
  | 'editorial-paper'
  | 'enterprise-manual'
  | 'dev-dark'
  | 'vanilla';

export const HTML_THEME_IDS: readonly HtmlThemeId[] = [
  'tech-docs',
  'editorial-paper',
  'enterprise-manual',
  'dev-dark',
  'vanilla',
];

export const DEFAULT_HTML_THEME_ID: HtmlThemeId = 'tech-docs';

export interface HtmlThemeFeatures {
  search: boolean;
  toc: boolean;
  codeCopy: boolean;
  colorModeToggle: boolean;
}

export interface HtmlThemeOptions {
  /** `#RRGGBB` (a bare `RRGGBB` value is accepted and normalized). */
  accentColor?: string | null;
  /** Header brand title; falls back to the root map title when empty. */
  siteTitle?: string | null;
  /** Workspace-relative image path (`.png/.jpg/.jpeg/.svg/.webp`). */
  logoPath?: string | null;
  /** Footer line (copyright, legal notice, …). */
  footerText?: string | null;
  /** Workspace-relative `.css` file appended after the theme styles.</ */
  customCssPath?: string | null;
  features?: Partial<HtmlThemeFeatures>;
}

export interface HtmlThemeLabels {
  search: string;
  searchPlaceholder: string;
  noResults: string;
  clear: string;
  copy: string;
  copied: string;
  onThisPage: string;
  menu: string;
  close: string;
  themeToggle: string;
  prev: string;
  next: string;
  shortcutHint: string;
}

export interface HtmlThemePalette {
  bg: string;
  surface: string;
  header: string;
  text: string;
  accent: string;
  border: string;
}

export interface HtmlThemeDescriptor {
  id: HtmlThemeId;
  name: string;
  description: string;
  tags: string[];
  defaultAccent: string;
  defaultMode: 'light' | 'dark';
  supportsCustomization: boolean;
  previewPalette: HtmlThemePalette;
  defaultFeatures: HtmlThemeFeatures;
}

export type HtmlThemeDefaultMode = HtmlThemeDescriptor['defaultMode'];

export const THEME_OPTION_LIMITS = { siteTitle: 120, footerText: 240 } as const;

export const DEFAULT_HTML_FEATURES: HtmlThemeFeatures = {
  search: true,
  toc: true,
  codeCopy: true,
  colorModeToggle: true,
};

const NO_FEATURES: HtmlThemeFeatures = {
  search: false,
  toc: false,
  codeCopy: false,
  colorModeToggle: false,
};

export const HTML_THEME_LABELS: Record<ApiLocale, HtmlThemeLabels> = {
  'zh-CN': {
    search: '搜索',
    searchPlaceholder: '搜索本手册内容',
    noResults: '没有匹配结果',
    clear: '清除',
    copy: '复制',
    copied: '已复制',
    onThisPage: '本页目录',
    menu: '目录',
    close: '关闭',
    themeToggle: '切换明暗模式',
    prev: '上一篇',
    next: '下一篇',
    shortcutHint: 'Ctrl K',
  },
  en: {
    search: 'Search',
    searchPlaceholder: 'Search this document set',
    noResults: 'No results found',
    clear: 'Clear',
    copy: 'Copy',
    copied: 'Copied',
    onThisPage: 'On this page',
    menu: 'Contents',
    close: 'Close',
    themeToggle: 'Toggle color mode',
    prev: 'Previous',
    next: 'Next',
    shortcutHint: 'Ctrl K',
  },
};

interface HtmlThemeCatalogEntry {
  id: HtmlThemeId;
  name: ApiMessageKey;
  description: ApiMessageKey;
  tags: ApiMessageKey[];
  defaultAccent: string;
  defaultMode: HtmlThemeDefaultMode;
  supportsCustomization: boolean;
  previewPalette: HtmlThemePalette;
  defaultFeatures: HtmlThemeFeatures;
}

const THEME_CATALOG: readonly HtmlThemeCatalogEntry[] = [
  {
    id: 'tech-docs',
    name: 'publish.theme.tech-docs.name',
    description: 'publish.theme.tech-docs.description',
    tags: ['publish.theme.tags.modern', 'publish.theme.tags.default'],
    defaultAccent: '#2563eb',
    defaultMode: 'light',
    supportsCustomization: true,
    previewPalette: {
      bg: '#ffffff',
      surface: '#f8fafc',
      header: '#ffffff',
      text: '#0f172a',
      accent: '#2563eb',
      border: '#e2e8f0',
    },
    defaultFeatures: DEFAULT_HTML_FEATURES,
  },
  {
    id: 'editorial-paper',
    name: 'publish.theme.editorial-paper.name',
    description: 'publish.theme.editorial-paper.description',
    tags: ['publish.theme.tags.minimal', 'publish.theme.tags.print'],
    defaultAccent: '#b45309',
    defaultMode: 'light',
    supportsCustomization: true,
    previewPalette: {
      bg: '#faf8f5',
      surface: '#f5f1ea',
      header: '#faf8f5',
      text: '#1c1917',
      accent: '#b45309',
      border: '#e2dbd1',
    },
    defaultFeatures: DEFAULT_HTML_FEATURES,
  },
  {
    id: 'enterprise-manual',
    name: 'publish.theme.enterprise-manual.name',
    description: 'publish.theme.enterprise-manual.description',
    tags: ['publish.theme.tags.enterprise', 'publish.theme.tags.print'],
    defaultAccent: '#1d4ed8',
    defaultMode: 'light',
    supportsCustomization: true,
    previewPalette: {
      bg: '#ffffff',
      surface: '#f4f6f9',
      header: '#0f2942',
      text: '#111827',
      accent: '#1d4ed8',
      border: '#cfd8e3',
    },
    defaultFeatures: DEFAULT_HTML_FEATURES,
  },
  {
    id: 'dev-dark',
    name: 'publish.theme.dev-dark.name',
    description: 'publish.theme.dev-dark.description',
    tags: ['publish.theme.tags.dark', 'publish.theme.tags.developer'],
    defaultAccent: '#38bdf8',
    defaultMode: 'dark',
    supportsCustomization: true,
    previewPalette: {
      bg: '#0b0f17',
      surface: '#111827',
      header: '#0b0f17',
      text: '#e5e7eb',
      accent: '#38bdf8',
      border: '#1f2a3a',
    },
    defaultFeatures: DEFAULT_HTML_FEATURES,
  },
  {
    id: 'vanilla',
    name: 'publish.theme.vanilla.name',
    description: 'publish.theme.vanilla.description',
    tags: ['publish.theme.tags.native'],
    defaultAccent: '#2e5a88',
    defaultMode: 'light',
    supportsCustomization: false,
    previewPalette: {
      bg: '#ffffff',
      surface: '#f5f5f5',
      header: '#ffffff',
      text: '#222222',
      accent: '#2e5a88',
      border: '#cccccc',
    },
    defaultFeatures: NO_FEATURES,
  },
];

function toDescriptor(entry: HtmlThemeCatalogEntry, locale: ApiLocale): HtmlThemeDescriptor {
  return {
    id: entry.id,
    name: apiT(locale, entry.name),
    description: apiT(locale, entry.description),
    tags: entry.tags.map((tag) => apiT(locale, tag)),
    defaultAccent: entry.defaultAccent,
    defaultMode: entry.defaultMode,
    supportsCustomization: entry.supportsCustomization,
    previewPalette: { ...entry.previewPalette },
    defaultFeatures: { ...entry.defaultFeatures },
  };
}

export function listHtmlThemes(locale: ApiLocale): HtmlThemeDescriptor[] {
  return THEME_CATALOG.map((entry) => toDescriptor(entry, locale));
}

export function getHtmlTheme(id: string, locale: ApiLocale): HtmlThemeDescriptor | null {
  const entry = THEME_CATALOG.find((candidate) => candidate.id === id);
  return entry ? toDescriptor(entry, locale) : null;
}

export function isHtmlThemeId(value: unknown): value is HtmlThemeId {
  return typeof value === 'string' && (HTML_THEME_IDS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Accent colour maths                                                         */
/* -------------------------------------------------------------------------- */

const ACCENT_PATTERN = /^#?[0-9a-fA-F]{6}$/;
/** Text colour used on light accents; also the intrinsic `dev-dark` canvas. */
export const ACCENT_DARK_TEXT = '#0b0f17';
export const ACCENT_LIGHT_TEXT = '#ffffff';

export function isValidAccent(value: unknown): value is string {
  return typeof value === 'string' && ACCENT_PATTERN.test(value.trim());
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseHex(value: string): Rgb | null {
  const match = /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(value.trim());
  if (!match) return null;
  return {
    r: Number.parseInt(match[1]!, 16),
    g: Number.parseInt(match[2]!, 16),
    b: Number.parseInt(match[3]!, 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function mix(from: Rgb, to: Rgb, weight: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
  };
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * linearChannel(rgb.r) +
    0.7152 * linearChannel(rgb.g) +
    0.0722 * linearChannel(rgb.b)
  );
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface HtmlThemeAccentScale {
  accent: string;
  hover: string;
  soft: string;
  border: string;
  contrast: string;
}

/**
 * Derive the five CSS custom properties used by every theme from one accent.
 * The contrast colour is whichever of white / `#0b0f17` wins the WCAG ratio,
 * and light accents get translucent tints so they stay readable on dark
 * canvases (`dev-dark`) instead of painting near-white hover blocks.
 */
export function accentScale(hex: string): HtmlThemeAccentScale {
  const rgb = parseHex(hex) ?? { r: 0x25, g: 0x63, b: 0xeb };
  const accent = toHex(rgb);
  const luminance = relativeLuminance(rgb);
  const white = relativeLuminance({ r: 255, g: 255, b: 255 });
  const dark = relativeLuminance({ r: 0x0b, g: 0x0f, b: 0x17 });
  const useDarkText = contrastRatio(luminance, dark) >= contrastRatio(luminance, white);

  const hover = useDarkText
    ? toHex(mix(rgb, { r: 255, g: 255, b: 255 }, 0.16))
    : toHex(mix(rgb, { r: 0, g: 0, b: 0 }, 0.14));

  return {
    accent,
    hover,
    soft: useDarkText
      ? `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.16)`
      : toHex(mix(rgb, { r: 255, g: 255, b: 255 }, 0.88)),
    border: useDarkText
      ? `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.42)`
      : toHex(mix(rgb, { r: 255, g: 255, b: 255 }, 0.66)),
    contrast: useDarkText ? ACCENT_DARK_TEXT : ACCENT_LIGHT_TEXT,
  };
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

function cleanPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

/**
 * Coerce arbitrary JSON (request bodies, stored profiles, legacy rows) into a
 * usable options object. Junk input never throws: unknown keys are dropped,
 * empty strings disappear, over-long text is truncated and features keep their
 * defaults unless the caller supplied a real boolean.
 */
export function resolveThemeOptions(input: unknown): HtmlThemeOptions {
  const source = isRecord(input) ? input : {};
  const rawFeatures = isRecord(source.features) ? source.features : {};
  const features: HtmlThemeFeatures = { ...DEFAULT_HTML_FEATURES };
  for (const key of Object.keys(DEFAULT_HTML_FEATURES) as (keyof HtmlThemeFeatures)[]) {
    const value = rawFeatures[key];
    if (typeof value === 'boolean') features[key] = value;
  }

  const options: HtmlThemeOptions = { features };
  const accent = typeof source.accentColor === 'string' ? source.accentColor.trim() : '';
  if (isValidAccent(accent)) {
    options.accentColor = `#${accent.replace(/^#/, '').toLowerCase()}`;
  }
  const siteTitle = cleanText(source.siteTitle, THEME_OPTION_LIMITS.siteTitle);
  if (siteTitle) options.siteTitle = siteTitle;
  const logoPath = cleanPath(source.logoPath);
  if (logoPath) options.logoPath = logoPath;
  const footerText = cleanText(source.footerText, THEME_OPTION_LIMITS.footerText);
  if (footerText) options.footerText = footerText;
  const customCssPath = cleanPath(source.customCssPath);
  if (customCssPath) options.customCssPath = customCssPath;
  return options;
}

export const htmlThemeIdSchema = z.enum([
  'tech-docs',
  'editorial-paper',
  'enterprise-manual',
  'dev-dark',
  'vanilla',
]);

/**
 * Zod contract for `themeOptions` in publish requests and saved profiles.
 * Unknown keys are stripped (zod default) so a newer web client cannot smuggle
 * arbitrary configuration into `publish_jobs.options_json`.
 */
export const htmlThemeOptionsSchema = z.object({
  accentColor: z.string().regex(ACCENT_PATTERN).nullish(),
  siteTitle: z.string().max(THEME_OPTION_LIMITS.siteTitle).nullish(),
  logoPath: z.string().max(1024).nullish(),
  footerText: z.string().max(THEME_OPTION_LIMITS.footerText).nullish(),
  customCssPath: z.string().max(1024).nullish(),
  features: z
    .object({
      search: z.boolean(),
      toc: z.boolean(),
      codeCopy: z.boolean(),
      colorModeToggle: z.boolean(),
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
 * Locate `dita-ot-plugins/html5-themes`:
 * explicit override → `DITAEDITOR_HTML_THEMES_DIR` → repository walk-up.
 */
export function resolveHtmlThemesDir(override?: string): string {
  const configured = override?.trim() || process.env.DITAEDITOR_HTML_THEMES_DIR?.trim() || '';
  if (configured) {
    const dir = resolve(configured);
    if (!existsSync(join(dir, 'shared', 'theme-base.css'))) {
      throw new Error(`html-themes assets not found: ${dir}`);
    }
    return dir;
  }

  const dir = join(findRepoRoot(), 'dita-ot-plugins', 'html5-themes');
  if (!existsSync(join(dir, 'shared', 'theme-base.css'))) {
    throw new Error(`html-themes assets not found: ${dir}`);
  }
  return dir;
}
