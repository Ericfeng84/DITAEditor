import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  detectDitaRuntime,
  resolveDitaCommand,
  runDita,
  type DitaRuntimeInfo,
  type DitaRuntimeOptions,
} from '../dita-ot/dita-runtime.js';
import {
  fallbackDitaDiagnostic,
  normalizeDitaPath,
  parseDitaLog,
  type DitaDiagnostic,
} from '../dita-ot/dita-log-parser.js';

export type StrictDiagnostic = DitaDiagnostic;

export interface StrictValidationInput {
  workDir: string;
  /** Topic/map paths relative to `workDir`, or absolute paths inside it. */
  paths: string[];
  /** Optional root map used as the validation entry point. */
  rootMapPath?: string | null;
  /** Optional DITAVAL applied while validating. */
  ditavalPath?: string | null;
  runtimeOptions?: DitaRuntimeOptions;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** UI locale of the requesting client; diagnostics fall back messages follow it. */
  locale?: ApiLocale;
}

export interface StrictValidationResult {
  available: boolean;
  ok: boolean;
  /** Normalized project-relative targets that were validated. */
  targets: string[];
  /** Root map used as the build entry point when contextual validation was requested. */
  entryPoint?: string;
  diagnostics: StrictDiagnostic[];
  durationMs: number;
  command: string;
  logTail: string;
  runtime: DitaRuntimeInfo;
  message?: string;
}

const VALIDATABLE_EXTENSIONS = new Set(['.dita', '.ditamap', '.bookmap']);
const DEFAULT_TIMEOUT_MS = 240_000;
const LOG_TAIL_BYTES = 12_000;

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function ensureInside(workDir: string, absPath: string, locale: ApiLocale): string {
  const rel = relative(workDir, absPath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(apiT(locale, 'validate.pathOutside', { path: absPath }));
  }
  return toPosix(rel);
}

export function resolveValidationTarget(
  workDir: string,
  rawPath: string,
  locale: ApiLocale = 'zh-CN',
): string {
  const absPath = isAbsolute(rawPath) ? resolve(rawPath) : resolve(workDir, rawPath);
  const posixPath = ensureInside(workDir, absPath, locale);
  if (!existsSync(absPath)) {
    throw new Error(apiT(locale, 'validate.fileMissing', { path: posixPath }));
  }
  const extension = extname(absPath).toLowerCase();
  if (!VALIDATABLE_EXTENSIONS.has(extension)) {
    throw new Error(apiT(locale, 'validate.unsupportedType', { path: posixPath }));
  }
  return posixPath;
}

/** DITAVAL is only read by DITA-OT, so constrain it to the workspace and its expected suffix. */
export function resolveDitavalTarget(
  workDir: string,
  rawPath: string,
  locale: ApiLocale = 'zh-CN',
): string {
  const absPath = isAbsolute(rawPath) ? resolve(rawPath) : resolve(workDir, rawPath);
  const posixPath = ensureInside(workDir, absPath, locale);
  if (!existsSync(absPath)) {
    throw new Error(apiT(locale, 'validate.ditavalMissing', { path: posixPath }));
  }
  if (extname(absPath).toLowerCase() !== '.ditaval') {
    throw new Error(apiT(locale, 'validate.ditavalSuffix', { path: posixPath }));
  }
  return posixPath;
}

function tail(text: string, maxBytes = LOG_TAIL_BYTES): string {
  return text.length <= maxBytes ? text : text.slice(text.length - maxBytes);
}

interface SingleTargetResult {
  target: string;
  exitCode: number | null;
  timedOut: boolean;
  cancelled: boolean;
  stdout: string;
  stderr: string;
  commandLine: string;
}

/**
 * Run DITA-OT's built-in DTD/RNG validation in strict processing mode against topics or maps.
 * Each target gets its own temporary output directory so a map cannot mask a sibling failure.
 */
export async function validateStrict(input: StrictValidationInput): Promise<StrictValidationResult> {
  const locale: ApiLocale = input.locale ?? 'zh-CN';
  const startedAt = Date.now();
  const workDir = resolve(input.workDir);
  const runtimeOptions = input.runtimeOptions ?? {};
  const command = resolveDitaCommand(runtimeOptions);
  const runtime = await detectDitaRuntime(runtimeOptions, { locale });
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!runtime.available) {
    return {
      available: false,
      ok: false,
      targets: [],
      diagnostics: [],
      durationMs: Date.now() - startedAt,
      command,
      logTail: '',
      runtime,
      message: runtime.error ?? apiT(locale, 'validate.noCli'),
    };
  }

  let targets: string[];
  try {
    targets = [
      ...new Set(input.paths.map((path) => resolveValidationTarget(workDir, path, locale))),
    ];
  } catch (err) {
    return {
      available: true,
      ok: false,
      targets: [],
      diagnostics: [],
      durationMs: Date.now() - startedAt,
      command,
      logTail: '',
      runtime,
      message: err instanceof Error ? err.message : String(err),
    };
  }
  if (targets.length === 0) {
    return {
      available: true,
      ok: false,
      targets,
      diagnostics: [],
      durationMs: Date.now() - startedAt,
      command,
      logTail: '',
      runtime,
      message: apiT(locale, 'validate.selectTargets'),
    };
  }

  let rootMap: string | null = null;
  if (input.rootMapPath) {
    try {
      rootMap = resolveValidationTarget(workDir, input.rootMapPath, locale);
    } catch (err) {
      return {
        available: true,
        ok: false,
        targets,
        diagnostics: [],
        durationMs: Date.now() - startedAt,
        command,
        logTail: '',
        runtime,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  let filterAbs: string | null = null;
  if (input.ditavalPath) {
    try {
      filterAbs = join(workDir, resolveDitavalTarget(workDir, input.ditavalPath));
    } catch (err) {
      return {
        available: true,
        ok: false,
        targets,
        diagnostics: [],
        durationMs: Date.now() - startedAt,
        command,
        logTail: '',
        runtime,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'dita-strict-'));
  const results: SingleTargetResult[] = [];
  // With a root map, run a single contextual build so keyref/conkeyref and conref targets
  // resolve exactly as they will during publishing. Without it, each topic is validated in
  // isolation and key-resolution diagnostics are downgraded to warnings.
  const entries = rootMap ? [rootMap] : targets;
  try {
    for (const [index, target] of entries.entries()) {
      if (input.signal?.aborted) break;
      const outputDir = join(tempRoot, `out-${index}`);
      const args = [
        `--input=${join(workDir, target)}`,
        '--format=html5',
        `--output=${outputDir}`,
        '--validate=yes',
        '--processing-mode=strict',
      ];
      if (filterAbs) args.push(`--filter=${filterAbs}`);
      try {
        const result = await runDita({
          command,
          args,
          cwd: workDir,
          timeoutMs,
          signal: input.signal,
          onOutput: undefined,
        });
        results.push({
          target,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          cancelled: result.cancelled,
          stdout: result.stdout,
          stderr: result.stderr,
          commandLine: result.commandLine,
        });
      } catch (err) {
        results.push({
          target,
          exitCode: null,
          timedOut: false,
          cancelled: false,
          stdout: '',
          stderr: err instanceof Error ? err.message : String(err),
          commandLine: [command, ...args].join(' '),
        });
      }
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  const roots = [{ absolute: workDir, displayPrefix: '' }];
  const diagnostics: StrictDiagnostic[] = [];
  let combinedLog = '';
  for (const result of results) {
    const log = `${result.stdout}\n${result.stderr}`.trim();
    combinedLog += `\n$ ${result.commandLine}\n${log}\n`;
    const parsed = parseDitaLog(log, { roots, fallbackPath: result.target });
    diagnostics.push(
      ...parsed.map((diagnostic) =>
        !rootMap && diagnostic.code === 'DOTJ046E'
          ? { ...diagnostic, severity: 'warning' as const }
          : diagnostic,
      ),
    );
    if (parsed.length === 0 && (result.exitCode !== 0 || result.timedOut || result.cancelled)) {
      diagnostics.push(
        fallbackDitaDiagnostic(
          result.target,
          result.timedOut
            ? apiT(locale, 'validate.timeout')
            : result.cancelled
              ? apiT(locale, 'validate.cancelled')
              : apiT(locale, 'validate.failed'),
        ),
      );
    }
  }

  const unique = new Map<string, StrictDiagnostic>();
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code ?? ''}:${diagnostic.message}`;
    if (!unique.has(key)) unique.set(key, diagnostic);
  }
  const finalDiagnostics = [...unique.values()];
  const hasError = finalDiagnostics.some((diagnostic) => diagnostic.severity === 'error');
  const ok =
    results.length === entries.length &&
    results.every((result) => result.exitCode === 0 && !result.timedOut && !result.cancelled) &&
    !hasError;

  return {
    available: true,
    ok,
    targets,
    ...(rootMap ? { entryPoint: rootMap } : {}),
    diagnostics: finalDiagnostics,
    durationMs: Date.now() - startedAt,
    command: results[0]?.commandLine ?? command,
    logTail: tail(combinedLog),
    runtime,
  };
}

/** Read the last part of a build log without loading multi-megabyte tail files. */
export function readLogTail(logPath: string, maxBytes = LOG_TAIL_BYTES): string {
  try {
    const size = statSync(logPath).size;
    const content = readFileSync(logPath);
    return content.subarray(Math.max(0, size - maxBytes)).toString('utf8');
  } catch {
    return '';
  }
}

export { normalizeDitaPath };
