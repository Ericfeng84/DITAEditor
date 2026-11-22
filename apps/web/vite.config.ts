import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * slimdom-sax-parser imports `Readable` from Node's `stream` module for its unused `async()` helper.
 * Provide a zero-overhead browser stub so `@dita/core`'s synchronous parser runs cleanly in the browser.
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

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [browserStreamStubPlugin(), tailwindcss(), react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    // Node's `navigator.language` is `en-US`; pin the UI locale so existing assertions stay
    // written against the zh-CN default. Individual tests switch locale when they need English.
    setupFiles: ['./test/setup-locale.ts'],
  },
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
          if (
            id.includes('node_modules/react-arborist/') ||
            id.includes('node_modules/react-dnd') ||
            id.includes('node_modules/react-window')
          ) {
            return 'vendor-tree';
          }
          if (
            id.includes('node_modules/slimdom') ||
            id.includes('node_modules/fontoxpath')
          ) {
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
});
