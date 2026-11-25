import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiHttpError, requestJson, resolveWorkspaceAssetUrl } from '../src/services/workspace-api';
import {
  CURRENT_USER_STORAGE_KEY,
  getCurrentUserId,
  setCurrentUserId,
} from '../src/services/identity-api';
import { clearActiveScope, setActiveScope } from '../src/services/active-scope';

/**
 * Phase 13 (Wave 3B) frontend contracts:
 * - asset URLs must carry manual/branch/user so draft images resolve for their author;
 * - a rejected save must surface the HTTP status + `files.staleContent` code, not a bare Error.
 */

function installFakeWindow(userId: string | null): void {
  const store = new Map<string, string>();
  if (userId) store.set(CURRENT_USER_STORAGE_KEY, userId);
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  });
}

describe('Phase 13 asset URL scope', () => {
  beforeEach(() => {
    setActiveScope({ manualId: 'manual-1', branch: 'release/2.0' });
    installFakeWindow('u-writer-lin');
  });

  afterEach(() => {
    clearActiveScope();
    vi.unstubAllGlobals();
  });

  it('repeats manual, branch and userId on /api/assets/resolve', () => {
    const url = resolveWorkspaceAssetUrl('topics/intro.dita', 'images/draft.png', 'api');
    expect(url).toBeTruthy();
    const parsed = new URL(url ?? '', 'http://localhost');
    expect(parsed.pathname).toBe('/api/assets/resolve');
    expect(parsed.searchParams.get('from')).toBe('topics/intro.dita');
    expect(parsed.searchParams.get('href')).toBe('images/draft.png');
    expect(parsed.searchParams.get('manualId')).toBe('manual-1');
    expect(parsed.searchParams.get('branch')).toBe('release/2.0');
    expect(parsed.searchParams.get('userId')).toBe('u-writer-lin');
  });

  it('leaves external and data URLs untouched', () => {
    expect(resolveWorkspaceAssetUrl('topics/intro.dita', 'https://cdn.test/a.png', 'api')).toBe(
      'https://cdn.test/a.png',
    );
    expect(resolveWorkspaceAssetUrl('topics/intro.dita', 'data:image/png;base64,AAA', 'api')).toBe(
      'data:image/png;base64,AAA',
    );
  });
});

describe('Phase 13 optimistic concurrency errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('classifies a 409 files.staleContent response', () => {
    const error = new ApiHttpError(409, 'The file changed elsewhere', 'files.staleContent', {
      path: 'topics/intro.dita',
      currentHash: 'sha256-new',
      serverContent: '<concept/>',
    });
    expect(error.status).toBe(409);
    expect(error.code).toBe('files.staleContent');
    expect(error.isStaleContent).toBe(true);
    expect(error.details.currentHash).toBe('sha256-new');
  });

  it('keeps status and code on a rejected requestJson call', async () => {
    installFakeWindow('u-writer-lin');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: 'The file changed elsewhere',
            code: 'files.staleContent',
            path: 'topics/intro.dita',
            currentHash: 'sha256-new',
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(requestJson('/api/files/content')).rejects.toMatchObject({
      name: 'ApiHttpError',
      status: 409,
      code: 'files.staleContent',
      message: 'The file changed elsewhere',
    });
  });
});

describe('Phase 13 per-tab identity isolation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the current tab identity in sessionStorage when another tab updates localStorage', () => {
    const local = new Map<string, string>([[CURRENT_USER_STORAGE_KEY, 'u-writer-lin']]);
    const session = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => local.get(key) ?? null,
        setItem: (key: string, value: string) => local.set(key, value),
        removeItem: (key: string) => local.delete(key),
      },
      sessionStorage: {
        getItem: (key: string) => session.get(key) ?? null,
        setItem: (key: string, value: string) => session.set(key, value),
        removeItem: (key: string) => session.delete(key),
      },
    });

    // Tab 1 boots and inherits user A from localStorage into its own sessionStorage.
    expect(getCurrentUserId()).toBe('u-writer-lin');
    // Tab 2 switches to user B and overwrites shared localStorage.
    local.set(CURRENT_USER_STORAGE_KEY, 'u-writer-chen');
    // Tab 1 must stay user A so two tabs can test draft isolation side by side.
    expect(getCurrentUserId()).toBe('u-writer-lin');

    // Explicitly switching inside Tab 1 updates both storages.
    setCurrentUserId('u-viewer');
    expect(getCurrentUserId()).toBe('u-viewer');
    expect(local.get(CURRENT_USER_STORAGE_KEY)).toBe('u-viewer');
  });
});
