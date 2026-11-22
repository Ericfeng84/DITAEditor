import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';

export type DitaStreamName = 'stdout' | 'stderr';

export interface DitaRuntimeOptions {
  /** Executable name or absolute path. Defaults to `DITA_CMD`, `<DITA_OT_HOME>/bin/dita`, or `dita` on PATH. */
  command?: string;
  /** DITA-OT installation root (the directory containing `bin/dita`). */
  ditaHome?: string;
  /** Pure-XML PDF CJK plugin directory shipped by this repository. */
  pluginDir?: string;
  /** FOP user configuration file used for CJK font mapping. */
  fopConfigPath?: string;
  /** Directory containing Noto CJK font files. */
  notoFontDir?: string;
}

export interface DitaRuntimeInfo {
  available: boolean;
  command: string;
  ditaHome: string | null;
  version: string | null;
  pluginInstalled: boolean;
  pluginPath: string | null;
  fopConfigPath: string | null;
  fontsAvailable: boolean;
  fontsPath: string | null;
  checkedAt: string;
  error?: string;
}

export interface DitaRunOptions {
  command: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  onOutput?: (chunk: string, stream: DitaStreamName) => void;
  /** Maximum bytes retained per stream in the returned result. */
  maxBufferBytes?: number;
}

export interface DitaRunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  cancelled: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  commandLine: string;
}

const MAX_RETAINED_BYTES = 256 * 1024;

function findRepoRoot(): string {
  let cursor = fileURLToPath(new URL('.', import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(cursor, 'samples', 'demo-dita-project'))) {
      return cursor;
    }
    const parent = resolve(cursor, '..');
    if (parent === cursor) break;
    cursor = parent;
  }
  return process.cwd();
}

export function defaultPluginDir(): string {
  return (
    process.env.DITAEDITOR_PDF_PLUGIN_DIR ??
    join(findRepoRoot(), 'dita-ot-plugins', 'com.ditaeditor.pdf-cjk')
  );
}

const DITA_EXECUTABLE = process.platform === 'win32' ? 'dita.bat' : 'dita';

/** Common per-user/system locations checked when DITA_OT_HOME is not configured. */
function defaultDitaHomes(): string[] {
  const home = homedir();
  return [
    join(home, 'dita-ot'),
    join(home, '.local', 'share', 'dita-ot'),
    '/opt/dita-ot',
    '/usr/local/dita-ot',
    '/Applications/dita-ot',
  ];
}

function findInstalledDitaHome(): string | null {
  for (const home of defaultDitaHomes()) {
    if (existsSync(join(home, 'bin', DITA_EXECUTABLE))) return resolve(home);
  }
  return null;
}

/**
 * Returns the first existing font directory so local (non-Docker) development can use
 * the same pure-XML font mappings without installing fonts system-wide.
 */
export function defaultNotoFontDir(): string {
  const configured = process.env.DITAEDITOR_NOTO_CJK_DIR;
  if (configured) return configured;
  const candidates = [
    '/usr/share/fonts/opentype/noto',
    join(homedir(), '.local', 'share', 'fonts', 'noto'),
    join(homedir(), 'Library', 'Fonts', 'Noto'),
    '/Library/Fonts/Noto',
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

export function resolveDitaCommand(options: DitaRuntimeOptions = {}): string {
  if (options.command?.trim()) return options.command.trim();
  if (process.env.DITA_CMD?.trim()) return process.env.DITA_CMD.trim();
  const home = options.ditaHome ?? process.env.DITA_OT_HOME ?? process.env.DITA_HOME;
  if (home?.trim()) {
    return join(home.trim(), 'bin', DITA_EXECUTABLE);
  }
  const installed = findInstalledDitaHome();
  return installed ? join(installed, 'bin', DITA_EXECUTABLE) : 'dita';
}

export function resolveDitaHome(options: DitaRuntimeOptions = {}): string | null {
  const explicit = options.ditaHome ?? process.env.DITA_OT_HOME ?? process.env.DITA_HOME;
  if (explicit?.trim()) return resolve(explicit.trim());
  return findInstalledDitaHome();
}

/**
 * The bundled plugin registers a `fop.xconf`. DITA-OT can consume that file directly through
 * `args.fo.userconfig`, which also works on machines where the plugin has not been installed yet.
 */
export function resolveFopConfig(options: DitaRuntimeOptions = {}): string | null {
  const candidate =
    options.fopConfigPath ??
    process.env.DITAEDITOR_FOP_XCONF ??
    join(options.pluginDir ?? defaultPluginDir(), 'fop.xconf');
  return existsSync(candidate) ? resolve(candidate) : null;
}

export function resolveNotoFontDir(options: DitaRuntimeOptions = {}): string | null {
  const candidate = options.notoFontDir ?? defaultNotoFontDir();
  return existsSync(candidate) ? resolve(candidate) : null;
}

function buildRuntimeEnv(command: string, options: DitaRuntimeOptions): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const home = resolveDitaHome(options);
  if (home && !env.DITA_HOME) {
    env.DITA_HOME = home;
  }
  // A caller may provide a bare executable name; keep PATH untouched in that case.
  if (command.includes('/') || command.includes('\\')) {
    const dir = resolve(command, '..');
    env.PATH = env.PATH ? `${dir}${delimiter}${env.PATH}` : dir;
  }
  return env;
}

interface DetectionCacheEntry {
  key: string;
  at: number;
  value: DitaRuntimeInfo;
}

let detectionCache: DetectionCacheEntry | null = null;
const DETECTION_TTL_MS = 30_000;

export interface DetectRuntimeOptions {
  timeoutMs?: number;
  force?: boolean;
  /** UI locale for the returned error text. Defaults to `zh-CN`. */
  locale?: ApiLocale;
}

/**
 * Detect whether the DITA-OT CLI and the CJK PDF assets are available.
 * Detection is cached briefly because the publish panel can call it on every open.
 */
export async function detectDitaRuntime(
  options: DitaRuntimeOptions = {},
  detectOptions: DetectRuntimeOptions = {},
): Promise<DitaRuntimeInfo> {
  const command = resolveDitaCommand(options);
  const cacheKey = JSON.stringify([
    command,
    resolveDitaHome(options),
    options.pluginDir ?? defaultPluginDir(),
    resolveFopConfig(options),
    resolveNotoFontDir(options),
  ]);
  if (
    !detectOptions.force &&
    detectionCache &&
    detectionCache.key === cacheKey &&
    Date.now() - detectionCache.at < DETECTION_TTL_MS
  ) {
    return detectionCache.value;
  }

  const pluginPath = resolve(options.pluginDir ?? defaultPluginDir());
  const ditaHome = resolveDitaHome(options);
  // Prefer the copy integrated into DITA-OT; fall back to the bundled source directory when no
  // DITA_OT_HOME is configured (the publish path can still pass the bundled fop.xconf explicitly).
  const installedPlugin = ditaHome
    ? join(ditaHome, 'plugins', 'com.ditaeditor.pdf-cjk', 'plugin.xml')
    : null;
  const base: DitaRuntimeInfo = {
    available: false,
    command,
    ditaHome,
    version: null,
    pluginInstalled:
      (installedPlugin ? existsSync(installedPlugin) : false) ||
      existsSync(join(pluginPath, 'plugin.xml')),
    pluginPath,
    fopConfigPath: resolveFopConfig(options),
    fontsAvailable: resolveNotoFontDir(options) !== null,
    fontsPath: resolveNotoFontDir(options),
    checkedAt: new Date().toISOString(),
  };

  let error: string | undefined;
  try {
    const result = await runDita({
      command,
      args: ['--version'],
      cwd: process.cwd(),
      timeoutMs: detectOptions.timeoutMs ?? 10_000,
      env: buildRuntimeEnv(command, options),
      maxBufferBytes: 32 * 1024,
    });
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (result.exitCode === 0) {
      base.available = true;
      const firstLine = output.split('\n').find((line) => line.trim())?.trim() ?? 'DITA-OT';
      base.version = firstLine.replace(/^DITA-OT\s+version\s+/i, '').trim() || firstLine;
    } else {
      error = output || `dita --version exited with code ${String(result.exitCode)}`;
    }
  } catch (err) {
    error = (err as NodeJS.ErrnoException).code === 'ENOENT'
      ? apiT(detectOptions.locale ?? 'zh-CN', 'ditaRuntime.cliNotFound', { command })
      : err instanceof Error
        ? err.message
        : String(err);
  }

  const value: DitaRuntimeInfo = error ? { ...base, error } : base;
  detectionCache = { key: cacheKey, at: Date.now(), value };
  return value;
}

export function resetDitaRuntimeCache(): void {
  detectionCache = null;
}

function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      // The child was spawned detached, so a negative pid targets the whole process group
      // (DITA-OT shells out to a JVM; killing only the wrapper leaks the build).
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // already exited
    }
  }
}

function makeAppender(): { push: (chunk: Buffer) => void; text: () => string } {
  let retained = '';
  let dropped = 0;
  return {
    push(chunk) {
      retained += chunk.toString('utf8');
      if (retained.length > MAX_RETAINED_BYTES) {
        const overflow = retained.length - MAX_RETAINED_BYTES;
        dropped += overflow;
        retained = retained.slice(overflow);
      }
    },
    text() {
      return dropped > 0 ? `… (${dropped} earlier characters omitted)\n${retained}` : retained;
    },
  };
}

/**
 * Spawn the DITA-OT CLI with timeout and cancellation support. Output is streamed as it arrives;
 * a bounded copy is retained for diagnostics parsing.
 */
export function runDita(options: DitaRunOptions): Promise<DitaRunResult> {
  const {
    command,
    args,
    cwd,
    timeoutMs,
    signal,
    env,
    onOutput,
    maxBufferBytes = MAX_RETAINED_BYTES,
  } = options;

  return new Promise((resolvePromise, reject) => {
    const startedAt = Date.now();
    const stdout = makeAppender();
    const stderr = makeAppender();
    let timedOut = false;
    let cancelled = false;
    let settled = false;

    const child = spawn(command, args, {
      cwd,
      env: env ?? process.env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
    }, Math.max(1_000, timeoutMs));

    const onAbort = () => {
      cancelled = true;
      killProcessTree(child);
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    const finish = (result: DitaRunResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(result);
    };

    const readStream = (stream: 'stdout' | 'stderr', appender: ReturnType<typeof makeAppender>) => {
      return (chunk: Buffer) => {
        appender.push(chunk);
        const text = chunk.toString('utf8');
        if (onOutput) {
          try {
            onOutput(text, stream);
          } catch {
            // A logging sink must never break the build process.
          }
        }
      };
    };

    child.stdout?.on('data', readStream('stdout', stdout));
    child.stderr?.on('data', readStream('stderr', stderr));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    child.on('close', (exitCode, termSignal) => {
      finish({
        exitCode,
        signal: termSignal as NodeJS.Signals | null,
        timedOut,
        cancelled,
        durationMs: Date.now() - startedAt,
        stdout: stdout.text(),
        stderr: stderr.text(),
        commandLine: [command, ...args].map((part) => (part.includes(' ') ? JSON.stringify(part) : part)).join(' '),
      });
    });
  });
}
