/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** GitHub Pages / desktop demo: no API, no network — see `apps/web/src/AppShell.tsx`. */
  readonly VITE_STATIC_DEMO?: string;
  /** Sub-path reverse proxy prefix (`VITE_BASE`) — see `apps/web/vite.config.ts`. */
  readonly VITE_BASE?: string;
  /** Canonical documentation site, used by the help center (`apps/web/src/lib/help-links.ts`). */
  readonly VITE_SITE_URL?: string;
  /** Project home / source repository URL shown in the help center. */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
