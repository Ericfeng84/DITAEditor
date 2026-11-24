/**
 * Phase 10 — a ~100 line history router.
 *
 * The workbench needs exactly two screens: the manual hub (`/`) and one editor session
 * per manual (`/manuals/:manualId?branch=…&topic=…`). Pulling in react-router for that
 * would add a dependency and a second source of truth for the URL, so the route is
 * derived from `window.location` on every navigation and every `popstate`.
 */
import { useSyncExternalStore } from 'react';

export interface HubRoute {
  name: 'hub';
}

export interface EditorRoute {
  name: 'editor';
  manualId: string;
  branch: string | null;
  topicPath: string | null;
  /** Assignment to focus once the topic is open (`?assignment=`). */
  assignmentId: string | null;
}

export type AppRoute = HubRoute | EditorRoute;

/** Vite injects `base` for sub-path deployments; keep every link BASE_URL-aware. */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

function withBase(path: string): string {
  if (!BASE) return path;
  return path.startsWith(BASE) ? path : `${BASE}${path}`;
}

function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return '/';
  return pathname.startsWith(`${BASE}/`) ? pathname.slice(BASE.length) : pathname;
}

export function parseRoute(url: string): AppRoute {
  let parsed: URL;
  try {
    parsed = new URL(url, 'http://dita.local');
  } catch {
    return { name: 'hub' };
  }
  const pathname = stripBase(parsed.pathname);
  const match = /^\/manuals\/([^/]+)\/?$/.exec(pathname);
  if (!match) return { name: 'hub' };
  const manualId = decodeURIComponent(match[1] ?? '');
  if (!manualId) return { name: 'hub' };
  const branch = parsed.searchParams.get('branch');
  const topic = parsed.searchParams.get('topic');
  const assignmentId = parsed.searchParams.get('assignment');
  return {
    name: 'editor',
    manualId,
    branch: branch && branch.trim() ? branch : null,
    topicPath: topic && topic.trim() ? topic : null,
    assignmentId: assignmentId && assignmentId.trim() ? assignmentId : null,
  };
}

export function hubPath(): string {
  return withBase('/');
}

export function editorPath(
  manualId: string,
  options: { branch?: string | null; topicPath?: string | null; assignmentId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.branch) params.set('branch', options.branch);
  if (options.topicPath) params.set('topic', options.topicPath);
  if (options.assignmentId) params.set('assignment', options.assignmentId);
  const suffix = params.toString();
  return withBase(`/manuals/${encodeURIComponent(manualId)}${suffix ? `?${suffix}` : ''}`);
}

const NAVIGATE_EVENT = 'dita:navigate';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', emit);
  window.addEventListener(NAVIGATE_EVENT, emit);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', emit);
    window.removeEventListener(NAVIGATE_EVENT, emit);
  };
}

let currentHref = typeof window === 'undefined' ? 'http://dita.local/' : window.location.href;
let currentRoute: AppRoute = parseRoute(currentHref);

function snapshot(): AppRoute {
  const href = typeof window === 'undefined' ? 'http://dita.local/' : window.location.href;
  if (href !== currentHref) {
    currentHref = href;
    currentRoute = parseRoute(href);
  }
  return currentRoute;
}

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  const target = path.startsWith('http') ? path : withBase(path);
  if (options.replace) window.history.replaceState(null, '', target);
  else window.history.pushState(null, '', target);
  emit();
}

export function useAppRoute(): AppRoute {
  return useSyncExternalStore(subscribe, snapshot, () => currentRoute);
}

/** Test-only: resets the memoized URL so jsdom/history mutations are picked up. */
export function resetRouteForTests(): void {
  currentHref = '';
  emit();
}
