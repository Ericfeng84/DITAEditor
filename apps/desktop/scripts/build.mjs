import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(DESKTOP_ROOT, 'dist');

mkdirSync(DIST_DIR, { recursive: true });

const esmCreateRequireBanner = [
  "import { createRequire as __ditaDesktopCreateRequire } from 'node:module';",
  'const require = __ditaDesktopCreateRequire(import.meta.url);',
].join('\n');

await Promise.all([
  esbuild.build({
    entryPoints: [path.join(DESKTOP_ROOT, 'src', 'main.ts')],
    outfile: path.join(DIST_DIR, 'main.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: true,
    external: ['electron', 'better-sqlite3'],
    banner: { js: esmCreateRequireBanner },
  }),
  esbuild.build({
    entryPoints: [path.join(DESKTOP_ROOT, 'src', 'preload.ts')],
    outfile: path.join(DIST_DIR, 'preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    sourcemap: true,
    external: ['electron'],
  }),
]);

console.log('Built @dita/desktop main.mjs and preload.cjs');
