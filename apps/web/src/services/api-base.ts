const API_BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');

/**
 * Prefix root-relative API/asset paths (`/api/...`) with Vite's `BASE_URL` when deployed
 * under a reverse-proxy subpath (e.g. `https://www.cemplatformcvs.cloud/dita`).
 * When `BASE_URL` is `'/'`, paths are returned unchanged.
 */
export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  if (!path.startsWith('/')) return path;
  if (path === API_BASE || path.startsWith(`${API_BASE}/`)) return path;
  return `${API_BASE}${path}`;
}
