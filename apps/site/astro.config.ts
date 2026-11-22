import { defineConfig } from 'astro/config';
import type { Plugin } from 'vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/**
 * `slimdom-sax-parser` imports `Readable` from Node's `stream` module for its unused `async()`
 * helper. Stub it so `@dita/core` runs unchanged inside the browser playground island.
 * Keep in sync with `apps/web/vite.config.ts`.
 */
function browserStreamStubPlugin(): Plugin {
  const virtualId = '\0virtual:stream-stub';
  return {
    name: 'dita-browser-stream-stub',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'stream' || id === 'node:stream') {
        return virtualId;
      }
      return null;
    },
    load(id) {
      if (id === virtualId) {
        return 'export class Readable {} export default { Readable };';
      }
      return null;
    },
  };
}

/** Lowercase the host so `github.repository_owner` casing never leaks into canonicals. */
function normaliseOrigin(value: string): string {
  try {
    const url = new URL(value);
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

const site = normaliseOrigin(process.env.SITE_URL ?? 'https://ditaeditor.dev');
// GitHub Pages project sites live under https://<user>.github.io/<repo>, so allow a sub-path base.
const base = process.env.SITE_BASE ?? '/';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    react(),
    sitemap({
      // Emit xhtml:link alternates so search engines pair the zh/en twins.
      i18n: { defaultLocale: 'zh', locales: { zh: 'zh-CN', en: 'en' } },
    }),
  ],
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: false,
    },
  },
  vite: {
    plugins: [browserStreamStubPlugin(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@codemirror/') || id.includes('node_modules/@lezer/')) {
              return 'vendor-codemirror';
            }
            if (id.includes('node_modules/prosemirror-')) {
              return 'vendor-prosemirror';
            }
            if (id.includes('node_modules/slimdom') || id.includes('node_modules/fontoxpath')) {
              return 'vendor-xml-core';
            }
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
  },
});
