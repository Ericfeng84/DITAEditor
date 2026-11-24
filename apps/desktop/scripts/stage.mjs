import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DESKTOP_ROOT, '..', '..');
const STAGE_DIR = path.join(DESKTOP_ROOT, 'stage');

function normalizeVersion(raw, fallback) {
  const cleaned = (raw ?? '').trim().replace(/^v/i, '');
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(cleaned) ? cleaned : fallback;
}

// 1. Build main.mjs and preload.cjs via esbuild
execFileSync(process.execPath, [path.join(__dirname, 'build.mjs')], {
  cwd: DESKTOP_ROOT,
  stdio: 'inherit',
});

// 2. Verify required assets exist before staging
const requiredPaths = [
  path.join(REPO_ROOT, 'apps', 'web', 'dist', 'index.html'),
  path.join(REPO_ROOT, 'samples', 'demo-dita-project'),
  path.join(REPO_ROOT, 'dita-ot-plugins', 'com.ditaeditor.pdf-cjk', 'plugin.xml'),
];
for (const required of requiredPaths) {
  if (!existsSync(required)) {
    throw new Error(
      `Missing required desktop packaging asset: ${required}. Run "pnpm --filter @dita/core --filter @dita/web --filter @dita/api build" first.`,
    );
  }
}

// 3. Prepare clean flat staging directory for electron-builder (avoids pnpm symlink issues)
const desktopPkg = JSON.parse(readFileSync(path.join(DESKTOP_ROOT, 'package.json'), 'utf8'));
const apiPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'apps', 'api', 'package.json'), 'utf8'));
const betterSqliteVersion = apiPkg.dependencies?.['better-sqlite3'];
if (!betterSqliteVersion) {
  throw new Error('Could not find better-sqlite3 version in apps/api/package.json');
}

const version = normalizeVersion(process.env.DESKTOP_VERSION, desktopPkg.version);

rmSync(STAGE_DIR, { recursive: true, force: true });
mkdirSync(path.join(STAGE_DIR, 'dist'), { recursive: true });

cpSync(path.join(DESKTOP_ROOT, 'dist', 'main.mjs'), path.join(STAGE_DIR, 'dist', 'main.mjs'));
cpSync(path.join(DESKTOP_ROOT, 'dist', 'preload.cjs'), path.join(STAGE_DIR, 'dist', 'preload.cjs'));

const stagePkg = {
  name: 'dita-editor',
  productName: 'DITAEditor',
  version,
  description: desktopPkg.description,
  author: 'DITAEditor Contributors',
  license: desktopPkg.license ?? 'MIT',
  type: 'module',
  main: 'dist/main.mjs',
  dependencies: {
    'better-sqlite3': betterSqliteVersion,
  },
};

writeFileSync(
  path.join(STAGE_DIR, 'package.json'),
  `${JSON.stringify(stagePkg, null, 2)}\n`,
  'utf8',
);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npmCmd, ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'], {
  cwd: STAGE_DIR,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

console.log(`Staged @dita/desktop v${version} in ${STAGE_DIR}`);
