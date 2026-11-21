import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [browserStreamStubPlugin(), react()],
  server: {
    port: 5173,
  },
});
