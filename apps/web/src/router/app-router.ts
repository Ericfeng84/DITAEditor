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

/** Phase 16 — the four tabs of the translation center. */
export type TranslationCenterTab = 'files' | 'queue' | 'glossary' | 'settings';

/** Phase 16 — `/manuals/:manualId/translation?branch=…&link=…&tab=…`. */
export interface TranslationCenterRoute {
  name: 'translation-center';
  manualId: string;
  branch: string | null;
  linkId: string | null;
  tab: TranslationCenterTab | null;
}

/** Phase 16 — `/manuals/:manualId/translation/review/:itemId?branch=…`. */
export interface BilingualReviewRoute {
  name: 'translation-review';
  manualId: string;
  itemId: string;
  branch: string | null;
}

/** Phase 16 — `/glossaries?glossary=…`. */
export interface GlossariesRoute {
  name: 'glossaries';
  glossaryId: string | null;
}

export type AppRoute =
  | HubRoute
  | EditorRoute
  | TranslationCenterRoute
  | BilingualReviewRoute
  | GlossariesRoute;

const TRANSLATION_TABS: readonly TranslationCenterTab[] = ['files', 'queue', 'glossary', 'settings'];

function parseTranslationTab(value: string | null): TranslationCenterTab | null {
  if (!value) return null;
  const trimmed = value.trim() as TranslationCenterTab;
  return (TRANSLATION_TABS as readonly string[]).includes(trimmed) ? trimmed : null;
}

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

  // Phase 16 screens — matched before `/manuals/:id` so a translation path can never fall back to
  // the editor (or, worse, silently open the wrong tab).
  if (/^\/glossaries\/?$/.test(pathname)) {
    const glossaryId = parsed.searchParams.get('glossary');
    return {
      name: 'glossaries',
      glossaryId: glossaryId && glossaryId.trim() ? glossaryId : null,
    };
  }

  const review = /^\/manuals\/([^/]+)\/translation\/review\/([^/]+)\/?$/.exec(pathname);
  if (review) {
    const manualId = decodeURIComponent(review[1] ?? '');
    const itemId = decodeURIComponent(review[2] ?? '');
    if (manualId && itemId) {
      const branch = parsed.searchParams.get('branch');
      return {
        name: 'translation-review',
        manualId,
        itemId,
        branch: branch && branch.trim() ? branch : null,
      };
    }
    return { name: 'hub' };
  }

  const center = /^\/manuals\/([^/]+)\/translation\/?$/.exec(pathname);
  if (center) {
    const manualId = decodeURIComponent(center[1] ?? '');
    if (!manualId) return { name: 'hub' };
    const branch = parsed.searchParams.get('branch');
    const linkId = parsed.searchParams.get('link');
    return {
      name: 'translation-center',
      manualId,
      branch: branch && branch.trim() ? branch : null,
      linkId: linkId && linkId.trim() ? linkId : null,
      tab: parseTranslationTab(parsed.searchParams.get('tab')),
    };
  }

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

/** Phase 16 — `/manuals/:manualId/translation`. */
export function translationCenterPath(
  manualId: string,
  options: { branch?: string | null; linkId?: string | null; tab?: TranslationCenterTab | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.branch) params.set('branch', options.branch);
  if (options.linkId) params.set('link', options.linkId);
  if (options.tab) params.set('tab', options.tab);
  const suffix = params.toString();
  return withBase(`/manuals/${encodeURIComponent(manualId)}/translation${suffix ? `?${suffix}` : ''}`);
}

/** Phase 16 — `/manuals/:manualId/translation/review/:itemId`. */
export function bilingualReviewPath(
  manualId: string,
  itemId: string,
  options: { branch?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.branch) params.set('branch', options.branch);
  const suffix = params.toString();
  return withBase(
    `/manuals/${encodeURIComponent(manualId)}/translation/review/${encodeURIComponent(itemId)}${suffix ? `?${suffix}` : ''}`,
  );
}

/** Phase 16 — `/glossaries`, optionally focused on one glossary. */
export function glossariesPath(glossaryId?: string | null): string {
  const suffix = glossaryId ? `?glossary=${encodeURIComponent(glossaryId)}` : '';
  return withBase(`/glossaries${suffix}`);
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
