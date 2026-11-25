/**
 * Canonical site URLs. Astro injects `SITE` / `BASE_URL` from `astro.config.mjs`, so the layout and
 * the components agree with the deployment target (root domain, sub-path, or file preview).
 */
const base = import.meta.env.BASE_URL || '/';
const site = (import.meta.env.SITE || 'https://ditaeditor.dev').replace(/\/$/, '');

const repo = 'https://github.com/Ericfeng84/DITAEditor';

/**
 * Desktop installers live on GitHub Releases. Bump `desktopTag` together with
 * `apps/desktop/package.json` when publishing a release; asset names are derived
 * from the tag so only the tag and byte sizes below need editing.
 */
const desktopTag = 'v1.3.0';
const desktopVersion = desktopTag.replace(/^v/, '');

function releaseAsset(name: string, bytes: number) {
  return {
    name,
    size: `${Math.round(bytes / 1024 / 1024)} MB`,
    url: `${repo}/releases/download/${desktopTag}/${name}`,
  };
}

export const DESKTOP = {
  version: desktopVersion,
  tag: desktopTag,
  macArch: 'Apple Silicon (arm64)',
  winArch: 'x64',
  dmg: releaseAsset(`DITAEditor-${desktopVersion}-mac-arm64.dmg`, 119_830_169),
  macZip: releaseAsset(`DITAEditor-${desktopVersion}-mac-arm64.zip`, 115_706_313),
  exe: releaseAsset(`DITAEditor-${desktopVersion}-win-x64.exe`, 101_527_625),
  winZip: releaseAsset(`DITAEditor-${desktopVersion}-win-x64.zip`, 129_220_956),
  releaseUrl: `${repo}/releases/tag/${desktopTag}`,
  latestUrl: `${repo}/releases/latest`,
  allReleasesUrl: `${repo}/releases`,
} as const;

export const SITE = {
  name: 'DITAEditor',
  tagline: {
    zh: '开源 Web DITA 1.3 结构化写作工作台',
    en: 'Open-source web workbench for DITA 1.3 structured authoring',
  },
  repo,
  licenseUrl: `${repo}/blob/main/LICENSE`,
  /**
   * Hosted full-trial workbench (GCP Cloud Run + subpath reverse proxy: DITA-OT
   * validation, HTML5 themes, Noto CJK PDF publishing, Git locks, AI proxy).
   * Every "online workbench" CTA across the site points here.
   */
  trialUrl: 'https://www.cemplatformcvs.cloud/dita',
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
