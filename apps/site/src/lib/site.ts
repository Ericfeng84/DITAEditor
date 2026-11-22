/**
 * Canonical site URLs. Astro injects `SITE` / `BASE_URL` from `astro.config.mjs`, so the layout and
 * the components agree with the deployment target (root domain, sub-path, or file preview).
 */
const base = import.meta.env.BASE_URL || '/';
const site = (import.meta.env.SITE || 'https://ditaeditor.dev').replace(/\/$/, '');

export const SITE = {
  name: 'DITAEditor',
  tagline: {
    zh: '开源 Web DITA 1.3 结构化写作工作台',
    en: 'Open-source web workbench for DITA 1.3 structured authoring',
  },
  repo: 'https://github.com/Ericfeng84/DITAEditor',
  licenseUrl: 'https://github.com/Ericfeng84/DITAEditor/blob/main/LICENSE',
  base,
  url: site,
  /** Bumped by hand when the site copy changes; printed in the footer for traceability. */
  edition: '2026.11',
} as const;

export function absoluteUrl(pathname: string): string {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const prefixed = base === '/' ? clean : `${base.replace(/\/$/, '')}${clean}`;
  return `${site}${prefixed === '/' ? '/' : prefixed.replace(/\/{2,}/g, '/')}`;
}

export function assetUrl(pathname: string): string {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return base === '/' ? clean : `${base.replace(/\/$/, '')}${clean}`;
}
