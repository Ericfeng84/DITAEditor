/**
 * Every URL the in-app help center offers, in one place.
 *
 * Both targets are deployment-dependent, so they can be overridden at build time:
 * `VITE_SITE_URL` / `VITE_REPO_URL`. Defaults point at the GitHub Pages deployment of the
 * documentation site (`https://ericfeng84.github.io/DITAEditor/docs`, sub-path aware) and the
 * public repository.
 *
 * The desktop shell (`apps/desktop/src/main.ts:308`) routes every `window.open` on http(s) into
 * `shell.openExternal` and denies the window, so every external link must be rendered with
 * `target="_blank" rel="noopener noreferrer"` — a plain `<a href>` silently does nothing there.
 */
import type { UiLocale } from '@dita/core';

/**
 * GitHub Pages deployment root: the Astro site is published under `/DITAEditor/`, so the docs
 * entry point is `<root>/docs` (zh) and `<root>/en/docs` (en). Override with `VITE_SITE_URL`
 * (no trailing slash) when the site lives on another origin or sub-path.
 */
const SITE_FALLBACK = 'https://ericfeng84.github.io/DITAEditor';
const REPO_FALLBACK = 'https://github.com/Ericfeng84/DITAEditor';

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Documentation site root, without a trailing slash. */
export const HELP_SITE_URL = withoutTrailingSlash(import.meta.env.VITE_SITE_URL ?? SITE_FALLBACK);

/** Project home (GitHub repository) without a trailing slash. */
export const HELP_REPO_URL = withoutTrailingSlash(import.meta.env.VITE_REPO_URL ?? REPO_FALLBACK);

/**
 * Offline builds (GitHub Pages workbench / `VITE_STATIC_DEMO=true`) and air-gapped desktops
 * cannot reach the network, so network-only links are hidden instead of rendered dead.
 */
export const HELP_OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';

export const HELP_OASIS_TECH_CONTENT =
  'https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html';

export const HELP_OASIS_LANG_REFERENCE =
  'https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part3-all-inclusive.html';

export const HELP_DITA_OT_URL = 'https://www.dita-ot.org/';

/** Localised docs entry point (`<root>/docs` for Chinese, `<root>/en/docs` for English). */
export function helpDocsUrl(locale: UiLocale, slug?: string): string {
  const root = locale === 'en' ? `${HELP_SITE_URL}/en/docs` : `${HELP_SITE_URL}/docs`;
  return slug ? `${root}/${slug}` : root;
}
