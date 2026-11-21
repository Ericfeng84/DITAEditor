import { isAbsolute, relative, resolve, sep } from 'node:path';

export interface DitaDiagnostic {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  code?: string;
}

export interface DitaPathRoot {
  /** Absolute directory or file prefix that may appear in DITA-OT output. */
  absolute: string;
  /** POSIX path to display instead of the prefix (usually '' so output is project-relative). */
  displayPrefix?: string;
}

export interface ParseDitaLogOptions {
  /** Roots used to rewrite absolute build paths back to workspace-relative paths. */
  roots?: DitaPathRoot[];
  /** Diagnostic file used when DITA-OT reports an error without any location. */
  fallbackPath?: string;
}

const DITA_FILE = String.raw`[^\s:<>"']+?\.(?:dita|ditamap|bookmap|ditaval|xml)`;
const LOCATION_PATTERNS: RegExp[] = [
  new RegExp(String.raw`(${DITA_FILE})\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)`, 'i'),
  new RegExp(String.raw`(${DITA_FILE})["']?\s*,?\s+line\s+(\d+)(?:\s*(?:,|:)?\s*(?:column\s*)?(\d+))?`, 'i'),
  new RegExp(String.raw`((?:file:\/{0,3})?(?:[A-Za-z]:[\\/])?${DITA_FILE}):(\d+)(?::(\d+))?`, 'i'),
];
const CODE_PATTERN = /\[((?:DOT)[A-Z0-9]*?[EWIF])\](?:\[(ERROR|WARN|WARNING|INFO|FATAL)\])?/;
const SEVERITY_PATTERN = /\b(ERROR|WARN(?:ING)?|FATAL|SEVERE)\b/i;

function normalizeRoots(roots: DitaPathRoot[]): DitaPathRoot[] {
  return [...roots]
    .map((root) => ({ absolute: resolve(root.absolute), displayPrefix: root.displayPrefix ?? '' }))
    .sort((a, b) => b.absolute.length - a.absolute.length);
}

function stripFileUrl(raw: string): string {
  let value = raw.trim().replace(/^["'(]+|["'),;]+$/g, '');
  if (/^file:/i.test(value)) {
    if (/^file:\/\//i.test(value)) {
      // file:///tmp/a -> /tmp/a; file://server/share/a -> //server/share/a
      value = value.slice('file://'.length);
      if (!value.startsWith('/') && !/^[A-Za-z]:/.test(value)) {
        value = `//${value}`;
      }
    } else {
      // file:/tmp/a keeps its leading slash.
      value = value.slice('file:'.length);
    }
    if (/^\/[A-Za-z]:\//.test(value)) {
      // file:///C:/path -> C:/path
      value = value.slice(1);
    }
    try {
      value = decodeURIComponent(value);
    } catch {
      // keep raw when it is not valid percent-encoding
    }
  }
  return value.replace(/\\/g, '/');
}

export function normalizeDitaPath(rawPath: string, roots: DitaPathRoot[]): string {
  const cleaned = stripFileUrl(rawPath);
  if (!cleaned) return '';
  const absolute = isAbsolute(cleaned) ? resolve(cleaned) : null;
  if (absolute) {
    for (const root of normalizeRoots(roots)) {
      const rel = relative(root.absolute, absolute);
      if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
        const posixRel = rel.split(sep).join('/');
        const prefix = root.displayPrefix?.replace(/\/$/, '') ?? '';
        return prefix ? `${prefix}/${posixRel}` : posixRel;
      }
    }
    return cleaned;
  }
  return cleaned.replace(/^\.\//, '');
}

interface LocationMatch {
  path: string;
  line: number;
  column: number;
  matchedText: string;
}

function matchLocation(line: string): LocationMatch | null {
  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.exec(line);
    if (!match) continue;
    const rawPath = match[1] ?? '';
    if (!rawPath) continue;
    return {
      path: rawPath,
      line: Number(match[2] ?? 1) || 1,
      column: Number(match[3] ?? 1) || 1,
      matchedText: match[0],
    };
  }
  return null;
}

function severityFor(line: string, code: string | undefined): 'error' | 'warning' | null {
  if (code?.endsWith('W')) return 'warning';
  if (code?.endsWith('E') || code?.endsWith('F')) return 'error';
  const severity = SEVERITY_PATTERN.exec(line)?.[1]?.toUpperCase();
  if (!severity) return null;
  if (severity.startsWith('WARN')) return 'warning';
  if (severity === 'ERROR' || severity === 'FATAL' || severity === 'SEVERE') return 'error';
  return null;
}

function extractMessage(line: string, location: LocationMatch | null, headerMessage?: string): string {
  // Remove the path/line/column prefix so the UI does not repeat it in the message column.
  let detail = location ? line.replace(location.matchedText, ' ') : line;
  detail = detail
    .replace(CODE_PATTERN, '')
    .replace(/^\s*Error:\s*/i, '')
    .replace(/^\s*Build failed with an exception:\s*/i, '')
    .replace(/['"]?file:[^'"\s]+['"]?/gi, ' ')
    .replace(/\s*\.\s*:\s*/g, ': ')
    .replace(/:\s*:/g, ':')
    .replace(/^\s*[-:|]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const head = headerMessage?.replace(/\s+/g, ' ').trim() ?? '';
  if (!head) return detail;
  if (!detail || head.includes(detail)) return head;
  if (detail.includes(head)) return detail;
  return `${head} — ${detail}`;
}

function uniqueDiagnostics(diagnostics: DitaDiagnostic[]): DitaDiagnostic[] {
  const seen = new Set<string>();
  const out: DitaDiagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.severity,
      diagnostic.filePath,
      diagnostic.line,
      diagnostic.column,
      diagnostic.code ?? '',
      diagnostic.message,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diagnostic);
  }
  return out;
}

/**
 * Parse DITA-OT console output into file/line/column diagnostics.
 *
 * DITA-OT mixes several formats from Saxon, Xerces and its own logger:
 *   [DOTJ013E][ERROR] Failed to parse the referenced file 'concepts/a.dita':
 *   concepts/a.dita:12:5: The element type "bad" must be terminated...
 *   file:/tmp/build/topics/a.dita:8:3: ...
 */
export function parseDitaLog(
  output: string,
  options: ParseDitaLogOptions = {},
): DitaDiagnostic[] {
  const roots = options.roots ?? [];
  const lines = output.split(/\r?\n/);
  const diagnostics: DitaDiagnostic[] = [];
  type PendingHeader = { severity: 'error' | 'warning'; code?: string; message: string };
  let pending: PendingHeader | null = null;
  // A function boundary keeps TypeScript from over-narrowing `pending` across loop iterations.
  const readPending = (): PendingHeader | null => pending;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      pending = null;
      continue;
    }

    const codeMatch = CODE_PATTERN.exec(line);
    const code = codeMatch?.[1];
    const location = matchLocation(line);
    const severity = severityFor(line, code);

    const previous = readPending();
    if (location) {
      const effectiveSeverity: 'error' | 'warning' =
        severity ?? previous?.severity ?? 'error';
      if (effectiveSeverity === 'warning' || effectiveSeverity === 'error') {
        const message = extractMessage(line, location, previous?.message);
        diagnostics.push({
          id: `${normalizeDitaPath(location.path, roots)}:${location.line}:${location.column}:${code ?? 'dita-ot'}`,
          filePath: normalizeDitaPath(location.path, roots),
          line: location.line,
          column: location.column,
          severity: effectiveSeverity,
          message: message || 'DITA-OT validation error',
          code: code ?? previous?.code,
        });
      }
      pending = null;
      continue;
    }

    if (code || SEVERITY_PATTERN.test(line) || /^Cause:\s/i.test(line)) {
      const effectiveSeverity: 'error' | 'warning' = severity ?? previous?.severity ?? 'error';
      const message = extractMessage(line, null, previous?.message);
      // Keep the header so the next line (which usually carries the location) can attach it.
      pending = {
        severity: effectiveSeverity,
        code: code ?? previous?.code,
        message,
      };
      continue;
    }

    if (pending) {
      pending.message = `${pending.message} ${line}`.trim();
    }
  }

  // A parser error that never received a location is still useful, but only when it is the
  // only signal. Callers add a generic fallback diagnostic when the build failed silently.
  return uniqueDiagnostics(diagnostics);
}

export function fallbackDitaDiagnostic(
  fallbackPath: string,
  message: string,
  code = 'DITA-OT',
): DitaDiagnostic {
  return {
    id: `${fallbackPath || 'publish'}:0:0:${code}`,
    filePath: fallbackPath,
    line: 0,
    column: 0,
    severity: 'error',
    message,
    code,
  };
}
