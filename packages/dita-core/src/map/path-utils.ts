/**
 * Isomorphic POSIX path utilities for DITA relative `href` resolution and project classification.
 * Safe to run in both browser (`@dita/web`) and Node.js (`@dita/api`) with zero Node built-ins.
 */

export type DitaFileKind = 'ditamap' | 'topic' | 'ditaval' | 'image' | 'other';

export interface ResolvedDitaHref {
  /** Normalized workspace-relative POSIX path without fragment (empty when external or fragment-only). */
  targetPath: string;
  /** Optional fragment identifier after `#` (e.g. `topicId/elemId`). */
  fragment?: string;
  /** True for `http://`, `https://`, `mailto:`, `urn:`, etc. */
  isExternal: boolean;
  /** True if relative segments (`..`) traverse above the workspace root. */
  escapesRoot: boolean;
}

const EXTERNAL_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
  '.bmp',
]);

/**
 * Normalize a relative POSIX path, collapsing `.` and `..` segments and stripping leading `/` or `./`.
 */
export function normalizePosixPath(input: string): string {
  const slashNormalized = input.replace(/\\/g, '/').trim();
  const segments = slashNormalized.split('/');
  const out: string[] = [];

  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else {
        out.push('..');
      }
    } else {
      out.push(seg);
    }
  }

  return out.join('/');
}

export function dirnamePosix(filePath: string): string {
  const normalized = normalizePosixPath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

export function basenamePosix(filePath: string): string {
  const normalized = normalizePosixPath(filePath);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

/**
 * Resolve a DITA `href` string relative to `baseFilePath` inside a workspace root.
 */
export function resolveDitaHref(baseFilePath: string, href: string): ResolvedDitaHref {
  const trimmed = href.trim();
  if (!trimmed) {
    return { targetPath: '', isExternal: false, escapesRoot: false };
  }

  if (EXTERNAL_SCHEME_REGEX.test(trimmed)) {
    return { targetPath: '', isExternal: true, escapesRoot: false };
  }

  const hashIdx = trimmed.indexOf('#');
  const rawPath = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const fragment = hashIdx >= 0 ? trimmed.slice(hashIdx + 1) : undefined;

  if (!rawPath) {
    return {
      targetPath: normalizePosixPath(baseFilePath),
      fragment,
      isExternal: false,
      escapesRoot: false,
    };
  }

  const baseDir = dirnamePosix(baseFilePath);
  const combined = baseDir ? `${baseDir}/${rawPath}` : rawPath;
  const resolved = normalizePosixPath(combined);
  const escapesRoot = resolved === '..' || resolved.startsWith('../');

  return {
    targetPath: escapesRoot ? '' : resolved,
    fragment: fragment || undefined,
    isExternal: false,
    escapesRoot,
  };
}

/**
 * Compute the minimal POSIX relative `href` from `fromFilePath`'s directory to `toFilePath`.
 * Example: `computeRelativeDitaHref('maps/sub.ditamap', 'concepts/arch.dita')` -> `'../concepts/arch.dita'`.
 */
export function computeRelativeDitaHref(fromFilePath: string, toFilePath: string): string {
  const fromDir = dirnamePosix(fromFilePath);
  const targetNorm = normalizePosixPath(toFilePath);

  if (!fromDir) return targetNorm;
  if (!targetNorm) return '';

  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = targetNorm.split('/').filter(Boolean);

  let common = 0;
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++;
  }

  const ups = Array.from({ length: fromParts.length - common }, () => '..');
  const downs = toParts.slice(common);
  const rel = [...ups, ...downs].join('/');
  return rel || basenamePosix(targetNorm);
}

/**
 * Classify a workspace file path into a DITA-relevant asset category.
 */
export function classifyDitaFileKind(filePath: string): DitaFileKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ditamap')) return 'ditamap';
  if (lower.endsWith('.ditaval')) return 'ditaval';
  if (lower.endsWith('.dita') || lower.endsWith('.xml')) return 'topic';

  const dotIdx = lower.lastIndexOf('.');
  if (dotIdx >= 0 && IMAGE_EXTENSIONS.has(lower.slice(dotIdx))) {
    return 'image';
  }
  return 'other';
}
