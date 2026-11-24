import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assetUrl } from './site.js';

/**
 * Public assets keep stable filenames, so a replaced screenshot would otherwise stay
 * cached in browsers (and in the GitHub Pages edge cache) until the TTL expires.
 * Appending a content hash makes every new capture a new URL.
 *
 * Server-only: uses `node:fs`, so call it from `.astro` pages/components, never from
 * hydrated islands.
 */
const PUBLIC_ROOT = fileURLToPath(new URL('../../public/', import.meta.url));
const digests = new Map<string, string>();

function digest(relativePath: string): string {
  const cached = digests.get(relativePath);
  if (cached) return cached;
  const hash = createHash('sha256')
    .update(readFileSync(`${PUBLIC_ROOT}${relativePath}`))
    .digest('hex')
    .slice(0, 10);
  digests.set(relativePath, hash);
  return hash;
}

/** Resolve a public asset (e.g. `/images/ai-diff.webp`) to a cache-busted, base-aware URL. */
export function versionedAsset(pathname: string): string {
  return `${assetUrl(pathname)}?v=${digest(pathname.replace(/^\//, ''))}`;
}
