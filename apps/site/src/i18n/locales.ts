/**
 * Locale routing helpers for the DITAEditor static site.
 *
 * All functions are pure so they can be unit-tested without an Astro runtime. Astro's
 * `BASE_URL` always carries a leading and trailing slash; the helpers normalise any base so
 * GitHub Pages project layouts (`/DITAEditor/`) and root deployments (`/`) behave identically.
 */

export type Locale = 'zh' | 'en';

export const LOCALES: readonly Locale[] = ['zh', 'en'];
export const DEFAULT_LOCALE: Locale = 'zh';

/** Simplified Chinese is the default locale and therefore lives at the site root. */
export const LOCALE_PREFIX: Readonly<Record<Locale, string>> = { zh: '', en: '/en' };
export const LOCALE_HTML_LANG: Readonly<Record<Locale, string>> = { zh: 'zh-CN', en: 'en' };
export const LOCALE_LABEL: Readonly<Record<Locale, string>> = { zh: '中文', en: 'English' };
export const LOCALE_OG_LOCALE: Readonly<Record<Locale, string>> = { zh: 'zh_CN', en: 'en_US' };

/** The six core guides, in reading order. Both locales must ship all six. */
export const DOC_SLUGS = [
  'introduction',
  'getting-started',
  'local-development',
  'features',
  'ai-setup',
  'architecture',
] as const;

export type DocSlug = (typeof DOC_SLUGS)[number];

/** Normalise a configured base to `/` or `/prefix/`. */
export function normalizeBase(base: string): string {
  const trimmed = (base ?? '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/** Join the configured base with a site-absolute path (`/`, `/docs`, ...). */
export function withBase(path: string, base = '/'): string {
  const normalisedBase = normalizeBase(base);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (normalisedBase === '/') return cleanPath;
  return `${normalisedBase.replace(/\/$/, '')}${cleanPath}`;
}

/** Strip the configured base from an absolute pathname, leaving a site-relative path. */
export function stripBase(pathname: string, base = '/'): string {
  const normalisedBase = normalizeBase(base);
  if (normalisedBase === '/') return pathname.startsWith('/') ? pathname : `/${pathname}`;
  const prefix = normalisedBase.replace(/\/$/, '');
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

/** Localised path for a site-relative path (`/docs/features` → `/en/docs/features`). */
export function localePath(locale: Locale, path = '/', base = '/'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return withBase(`${LOCALE_PREFIX[locale]}${cleanPath}`, base);
}

export function homePath(locale: Locale, base = '/'): string {
  return localePath(locale, '/', base);
}

export function playgroundPath(locale: Locale, base = '/'): string {
  return localePath(locale, '/playground', base);
}

export function docsIndexPath(locale: Locale, base = '/'): string {
  return localePath(locale, '/docs', base);
}

export function docsPath(locale: Locale, slug: DocSlug, base = '/'): string {
  return localePath(locale, `/docs/${slug}`, base);
}

export function localeFromPath(pathname: string, base = '/'): Locale {
  const relative = stripBase(pathname, base);
  return relative === '/en' || relative.startsWith('/en/') ? 'en' : 'zh';
}

/**
 * Map the current pathname to the same page in the target locale, preserving the active page
 * (a reader on `/en/docs/ai-setup` lands on `/docs/ai-setup`, not the home page).
 */
export function switchLocalePath(pathname: string, target: Locale, base = '/'): string {
  const relative = stripBase(pathname, base);
  const withoutLocale = relative.replace(/^\/en(?=\/|$)/, '') || '/';
  const normalised = withoutLocale.startsWith('/') ? withoutLocale : `/${withoutLocale}`;
  return localePath(target, normalised, base);
}
