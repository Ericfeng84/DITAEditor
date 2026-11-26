#!/usr/bin/env node
/**
 * Self-healing check for the Electron binary shipped in node_modules.
 *
 * Why this exists: electron's own `install.js` unpacks the cached zip with
 * `extract-zip@2`, which on some environments (observed on macOS arm64 with
 * Node 24.16.0) hangs forever on the second zip entry and — because nothing
 * keeps the event loop alive — exits silently with code 0 after writing only
 * `dist/LICENSES.chromium.html`. The result is a half-installed Electron:
 *
 *   Error: Electron failed to install correctly, please delete node_modules/electron
 *   and try installing again
 *
 * This script re-extracts the already-downloaded, checksum-verified zip with
 * the platform's native unzip utility (falling back to extract-zip guarded by a
 * timeout), then writes `path.txt`. It is a no-op when Electron is healthy, and
 * it never fails the install when Electron is absent (e.g. --ignore-scripts, or
 * ELECTRON_SKIP_BINARY_DOWNLOAD).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_ROOT = path.resolve(__dirname, '..');
const EXTRACT_TIMEOUT_MS = 5 * 60 * 1000;

function log(message) {
  console.log(`[ensure-electron] ${message}`);
}

function resolveElectronDir() {
  const desktopRequire = createRequire(path.join(DESKTOP_ROOT, 'package.json'));
  for (const specifier of ['electron/package.json', 'electron']) {
    try {
      return path.dirname(desktopRequire.resolve(specifier));
    } catch {
      // try next specifier
    }
  }
  return null;
}

function getPlatformPath() {
  switch (process.env.npm_config_platform || process.platform) {
    case 'mas':
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron';
    case 'freebsd':
    case 'openbsd':
    case 'linux':
      return 'electron';
    case 'win32':
      return 'electron.exe';
    default:
      return null;
  }
}

function getArch() {
  let arch = process.env.npm_config_arch || process.arch;
  // Running under Rosetta on Apple Silicon: fetch the arm64 build like install.js does.
  if (process.platform === 'darwin' && arch === 'x64' && process.env.npm_config_arch === undefined) {
    try {
      if (spawnSync('sysctl', ['-in', 'sysctl.proc_translated'], { encoding: 'utf8' }).stdout.trim() === '1') {
        arch = 'arm64';
      }
    } catch {
      // ignore: stay on x64
    }
  }
  return arch;
}

function isHealthy(electronDir, platformPath) {
  const pathTxt = path.join(electronDir, 'path.txt');
  const executable = path.join(electronDir, 'dist', platformPath);
  if (!existsSync(pathTxt) || !existsSync(executable)) return false;
  return readFileSync(pathTxt, 'utf8').trim() === platformPath;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', timeout: EXTRACT_TIMEOUT_MS });
  if (result.error) return { ok: false, reason: result.error.message };
  if (result.status !== 0) return { ok: false, reason: `${command} exited with code ${result.status}` };
  return { ok: true };
}

function extractWithNativeUnzip(zipPath, distDir) {
  if (process.platform === 'win32') {
    const literal = zipPath.replace(/'/g, "''");
    const destination = distDir.replace(/'/g, "''");
    return runCommand('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${literal}' -DestinationPath '${destination}' -Force`,
    ]);
  }
  return runCommand('unzip', ['-q', '-o', zipPath, '-d', distDir]);
}

function extractWithExtractZip(zipPath, distDir, electronDir) {
  // Run in a child process so a hung extract-zip can be killed instead of
  // leaving this script silently "succeeding" with a partial dist/.
  const script = `
const extract = require('extract-zip');
extract(${JSON.stringify(zipPath)}, { dir: ${JSON.stringify(distDir)} })
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
`;
  const result = spawnSync(process.execPath, ['-e', script], {
    stdio: 'inherit',
    timeout: EXTRACT_TIMEOUT_MS,
    // extract-zip lives in electron's own node_modules
    cwd: electronDir,
  });
  if (result.error) return { ok: false, reason: result.error.message };
  if (result.status !== 0) return { ok: false, reason: `extract-zip exited with code ${result.status}` };
  return { ok: true };
}

async function main() {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) {
    log('ELECTRON_SKIP_BINARY_DOWNLOAD is set, skipping');
    return;
  }

  const electronDir = resolveElectronDir();
  if (!electronDir) {
    log('electron is not installed in this workspace, skipping');
    return;
  }

  const platformPath = getPlatformPath();
  if (!platformPath) {
    log(`unsupported platform "${process.platform}", skipping`);
    return;
  }

  if (isHealthy(electronDir, platformPath)) {
    log(`ok (${path.join('dist', platformPath)})`);
    return;
  }

  log(`electron binary missing or incomplete in ${electronDir}, repairing`);

  const electronPkg = JSON.parse(readFileSync(path.join(electronDir, 'package.json'), 'utf8'));
  const electronRequire = createRequire(path.join(electronDir, 'package.json'));
  // Prefer the bundled checksums so a repair works offline (no SHASUMS download).
  let checksums;
  try {
    checksums = JSON.parse(readFileSync(path.join(electronDir, 'checksums.json'), 'utf8'));
  } catch {
    checksums = undefined;
  }

  const { downloadArtifact } = electronRequire('@electron/get');
  const zipPath = await downloadArtifact({
    version: electronPkg.version,
    artifactName: 'electron',
    platform: process.env.npm_config_platform || process.platform,
    arch: getArch(),
    checksums,
  });
  log(`using cached archive ${zipPath}`);

  const distDir = path.join(electronDir, 'dist');
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  let extraction = extractWithNativeUnzip(zipPath, distDir);
  if (!extraction.ok) {
    log(`native unzip failed (${extraction.reason}), falling back to extract-zip`);
    extraction = extractWithExtractZip(zipPath, distDir, electronDir);
  }
  if (!extraction.ok) {
    throw new Error(`Could not extract ${zipPath}: ${extraction.reason}`);
  }

  // Electron 34+ no longer ships electron.d.ts inside the archive; handle both shapes.
  const nestedTypeDefs = path.join(distDir, 'electron.d.ts');
  if (existsSync(nestedTypeDefs)) {
    renameSync(nestedTypeDefs, path.join(electronDir, 'electron.d.ts'));
  }

  const executable = path.join(distDir, platformPath);
  if (!existsSync(executable)) {
    throw new Error(`Extraction finished but ${executable} is missing (corrupt archive?)`);
  }

  writeFileSync(path.join(electronDir, 'path.txt'), platformPath);
  log(`repaired (${path.join('dist', platformPath)})`);
}

main().catch((error) => {
  console.error(`[ensure-electron] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
