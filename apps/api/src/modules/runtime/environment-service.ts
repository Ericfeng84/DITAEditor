/**
 * Unified runtime & plugin environment detection (`GET /api/runtime/environment`).
 *
 * The desktop workbench needs one cheap call that answers "what can this machine do right
 * now?" — Git, a JVM, the DITA-OT 4.x CLI, Noto CJK fonts, Docling and MarkItDown. Every probe
 * is best-effort: an unreachable tool reports `available: false` with a human-readable detail
 * instead of failing the whole report.
 *
 * `ditaRuntime` is intentionally held by reference (never cloned) so `@dita/desktop` can mutate
 * `ditaHome` / `notoFontDir`, call `resetDitaRuntimeCache()` and have PublishService,
 * validateStrict, IngestService and this endpoint all observe the new value on the next call.
 */

import { spawn } from 'node:child_process';
import type { ApiLocale } from '../../i18n/locale.js';
import {
  detectDitaRuntime,
  type DitaRuntimeInfo,
  type DitaRuntimeOptions,
} from '../dita-ot/dita-runtime.js';
import type {
  ParserRuntimeDetection,
  ParserSettingsService,
  RuntimeDetectionOptions,
} from '../ingest/parser-settings-service.js';
import type { CommandRunner } from '../ingest/parsers/types.js';

/** Result of probing one external binary (`git --version`, `java -version`, …). */
export interface BinaryProbeResult {
  available: boolean;
  command: string;
  version: string | null;
  error?: string;
}

export interface RuntimeEnvironmentReport {
  checkedAt: string;
  platform: NodeJS.Platform;
  arch: string;
  git: BinaryProbeResult;
  java: BinaryProbeResult;
  ditaOt: DitaRuntimeInfo;
  parsers: ParserRuntimeDetection;
}

/** Version extractor shared by the built-in probes and injectable test seams. */
export type VersionParser = (stdout: string, stderr: string) => string | null;

/**
 * Process probe seam. Production uses {@link probeCommandVersion}; tests inject a deterministic
 * implementation so the endpoint can be exercised without shelling out.
 */
export type CommandVersionProbe = (
  command: string,
  args: readonly string[],
  parseVersion: VersionParser,
  timeoutMs?: number,
) => Promise<BinaryProbeResult>;

export interface RuntimeEnvironmentDeps {
  /** Mutable runtime options shared with PublishService / validateStrict / IngestService. */
  ditaRuntime?: DitaRuntimeOptions;
  parserSettings: Pick<ParserSettingsService, 'detectRuntimes'>;
  /** Injectable `fetch` used by the Docling Serve health probe. */
  fetchImpl?: typeof fetch;
  /** Injectable process boundary used by the Docling / MarkItDown CLI probes. */
  commandRunner?: CommandRunner;
  /** Deterministic probe seam (tests). */
  probeCommandVersion?: CommandVersionProbe;
}

export interface DetectRuntimeEnvironmentOptions {
  /** Bypass the DITA-OT detection cache (default `true` for this endpoint). */
  force?: boolean;
  /** UI locale forwarded to localized DITA-OT runtime errors. */
  locale?: ApiLocale;
  /** Per-probe budget for `git --version` / `java -version`. */
  probeTimeoutMs?: number;
  /** Deterministic probe seam (tests); overrides `deps.probeCommandVersion`. */
  probeCommandVersion?: CommandVersionProbe;
}

const DEFAULT_PROBE_TIMEOUT_MS = 4_000;
const MAX_PROBE_OUTPUT_CHARS = 32 * 1024;
/** Parser CLI / serve health checks must never dominate a settings-panel refresh. */
const PARSER_PROBE_TIMEOUT_MS = 2_500;

const GIT_VERSION_PATTERN = /git\s+version\s+([^\s]+)/i;
/** `openjdk version "21.0.4" 2024-07-16` / `java version "1.8.0_412"` / `openjdk 21.0.4 2024-07-16`. */
const JAVA_VERSION_PATTERN = /version\s+"?(\d[^\s"]*)"?|^openjdk\s+(\d[^\s]*)/im;

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) return trimmed.slice(0, 200);
  }
  return null;
}

/** `git version 2.45.1` → `2.45.1`; unknown banners fall back to the first non-empty line. */
export function parseGitVersion(stdout: string, stderr: string): string | null {
  const match = GIT_VERSION_PATTERN.exec(`${stdout}\n${stderr}`);
  if (match?.[1]) return match[1];
  return firstNonEmptyLine(stdout) ?? firstNonEmptyLine(stderr);
}

/**
 * Oracle/OpenJDK print the banner to **stderr**: `openjdk version "21.0.4" 2024-07-16`.
 * The version string is extracted from `stderr || stdout`, with a first-line fallback.
 */
export function parseJavaVersion(stdout: string, stderr: string): string | null {
  const primary = stderr.trim() ? stderr : stdout;
  const match = JAVA_VERSION_PATTERN.exec(`${primary}\n${stdout}`);
  const version = match?.[1] ?? match?.[2];
  if (version) return version;
  return firstNonEmptyLine(primary) ?? firstNonEmptyLine(stderr) ?? firstNonEmptyLine(stdout);
}

function truncateTail(value: string): string {
  return value.length > MAX_PROBE_OUTPUT_CHARS ? value.slice(-MAX_PROBE_OUTPUT_CHARS) : value;
}

function describeProbeFailure(error: unknown, command: string): string {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === 'ENOENT') return `${command}: not found on PATH`;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Spawn `<command> <args>`, collect a bounded amount of output and extract a version string.
 * Never throws: a missing binary, non-zero exit or timeout yields `available: false`.
 */
export function probeCommandVersion(
  command: string,
  args: readonly string[],
  parseVersion: VersionParser,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<BinaryProbeResult> {
  return new Promise((resolvePromise) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let child: ReturnType<typeof spawn> | undefined;

    const finish = (result: BinaryProbeResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      if (child && child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          // Process already exited — the close handler will settle the promise.
        }
      }
      finish({
        available: false,
        command,
        version: null,
        error: `${command} --version timed out after ${timeoutMs} ms`,
      });
    }, Math.max(500, timeoutMs));
    timer.unref?.();

    try {
      child = spawn(command, [...args], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish({
        available: false,
        command,
        version: null,
        error: describeProbeFailure(error, command),
      });
      return;
    }

    const collect = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      if (stream === 'stdout') {
        stdout = truncateTail(stdout + text);
      } else {
        stderr = truncateTail(stderr + text);
      }
    };

    child.stdout?.on('data', collect('stdout'));
    child.stderr?.on('data', collect('stderr'));

    child.on('error', (error) => {
      finish({
        available: false,
        command,
        version: null,
        error: describeProbeFailure(error, command),
      });
    });

    child.on('close', (exitCode) => {
      if (timedOut) return;
      if (exitCode !== 0) {
        const detail = (stderr || stdout).trim();
        finish({
          available: false,
          command,
          version: null,
          error: detail ? detail.slice(0, 400) : `${command} exited with code ${String(exitCode)}`,
        });
        return;
      }
      const version = parseVersion(stdout, stderr);
      finish(
        version
          ? { available: true, command, version }
          : {
              available: false,
              command,
              version: null,
              error: `${command} produced no recognizable version output`,
            },
      );
    });
  });
}

/** A throwing injected probe must degrade to one unavailable row, never fail the report. */
async function safeProbe(
  probe: CommandVersionProbe,
  command: string,
  args: readonly string[],
  parseVersion: VersionParser,
  timeoutMs: number,
): Promise<BinaryProbeResult> {
  try {
    return await probe(command, args, parseVersion, timeoutMs);
  } catch (error) {
    return {
      available: false,
      command,
      version: null,
      error: describeProbeFailure(error, command),
    };
  }
}

/**
 * Probe Git, the JVM, DITA-OT (+ CJK fonts), Docling and MarkItDown in parallel.
 * Total latency is bounded by the slowest probe, not the sum.
 */
export async function detectRuntimeEnvironment(
  deps: RuntimeEnvironmentDeps,
  options: DetectRuntimeEnvironmentOptions = {},
): Promise<RuntimeEnvironmentReport> {
  const probe = options.probeCommandVersion ?? deps.probeCommandVersion ?? probeCommandVersion;
  const probeTimeoutMs = options.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const parserOptions: RuntimeDetectionOptions = {
    probeTimeoutMs: PARSER_PROBE_TIMEOUT_MS,
    fetchImpl: deps.fetchImpl,
    commandRunner: deps.commandRunner,
  };

  const [git, java, ditaOt, parsers] = await Promise.all([
    safeProbe(probe, 'git', ['--version'], parseGitVersion, probeTimeoutMs),
    safeProbe(probe, 'java', ['-version'], parseJavaVersion, probeTimeoutMs),
    detectDitaRuntime(deps.ditaRuntime ?? {}, {
      force: options.force ?? true,
      timeoutMs: probeTimeoutMs,
      ...(options.locale ? { locale: options.locale } : {}),
    }),
    deps.parserSettings.detectRuntimes(parserOptions),
  ]);

  return {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    git,
    java,
    ditaOt,
    parsers,
  };
}
