import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';
import { ensureFileCheckedOut, useGitStore } from '../src/store/git-store';
import { usePublishStore } from '../src/store/publish-store';
import { useAssignmentStore } from '../src/store/assignment-store';
import {
  CURRENT_USER_STORAGE_KEY,
  type IdentityResponse,
  type IdentityUser,
} from '../src/services/identity-api';
import type { FileLock, GitCommitInfo } from '../src/services/git-api';
import type { WorkspaceSnapshot } from '../src/services/workspace-api';
import { t } from '../src/i18n/index.js';

const USER_A: IdentityUser = {
  id: 'u-writer-lin',
  displayName: '林知远',
  initials: '林',
  email: 'lin@dita.local',
  color: '#0f766e',
  role: 'writer',
};

const USER_B: IdentityUser = {
  id: 'u-writer-chen',
  displayName: '陈曦',
  initials: '陈',
  email: 'chen@dita.local',
  color: '#2563eb',
  role: 'writer',
};

const ADMIN: IdentityUser = {
  id: 'u-admin',
  displayName: '系统管理员',
  initials: '系',
  email: 'admin@dita.local',
  color: '#4f46e5',
  role: 'admin',
};

const VIEWER: IdentityUser = {
  id: 'u-viewer',
  displayName: '审阅者',
  initials: '审',
  email: 'viewer@dita.local',
  color: '#64748b',
  role: 'viewer',
};

const ALL_USERS: IdentityUser[] = [ADMIN, USER_A, USER_B, VIEWER];

const TOPIC_PATH = 'concepts/single-sourcing.dita';
const MAP_PATH = 'product-manual.ditamap';

const BASELINE_TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="single_sourcing">
  <title>Single Sourcing Baseline</title>
  <conbody><p>Baseline HEAD content.</p></conbody>
</concept>`;

const USER_A_DRAFT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="single_sourcing">
  <title>Single Sourcing Draft A</title>
  <conbody><p>Uncommitted draft by User A.</p></conbody>
</concept>`;

const MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="product_manual">
  <title>Product Manual</title>
  <topicref href="concepts/single-sourcing.dita"/>
</map>`;

function makeCommit(hash = 'abcdef1234567890abcdef1234567890abcdef12', message = 'commit'): GitCommitInfo {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    authorName: USER_A.displayName,
    authorEmail: USER_A.email,
    date: '2026-11-26T00:00:00.000Z',
    message,
  };
}

function makeLock(filePath: string, user: IdentityUser): FileLock {
  return {
    id: `lock-${filePath}-${user.id}`,
    projectId: 'manual-1',
    branch: 'main',
    filePath,
    userId: user.id,
    userName: user.displayName,
    userColor: user.color,
    userRole: user.role,
    lockedAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
    expired: false,
  };
}

function makeSnapshot(topicTitle: string): WorkspaceSnapshot {
  return {
    rootDir: '/tmp/manual',
    projectRootDir: '/tmp/manual',
    defaultRootDir: '/tmp/manual',
    name: 'Manual',
    maps: [{ path: MAP_PATH, name: MAP_PATH, kind: 'ditamap', title: 'Product Manual', topicrefCount: 1 }],
    ditavals: [],
    files: [
      { name: MAP_PATH, path: MAP_PATH, kind: 'ditamap' },
      {
        name: 'concepts',
        path: 'concepts',
        kind: 'directory',
        children: [{ name: 'single-sourcing.dita', path: TOPIC_PATH, kind: 'topic' }],
      },
    ],
    topicTitles: { [TOPIC_PATH]: topicTitle },
    topicTypes: { [TOPIC_PATH]: 'concept' },
    stats: { totalFiles: 2, totalTopics: 1, totalMaps: 1, totalImages: 0 },
  };
}

function installFakeBrowserStorage(initialUserId: string): void {
  const local = new Map<string, string>([[CURRENT_USER_STORAGE_KEY, initialUserId]]);
  const session = new Map<string, string>([[CURRENT_USER_STORAGE_KEY, initialUserId]]);
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
}

function makeIdentity(currentUser: IdentityUser): IdentityResponse {
  return {
    users: ALL_USERS,
    currentUser,
    roles: [
      { id: 'admin', label: 'Admin', description: '' },
      { id: 'writer', label: 'Writer', description: '' },
      { id: 'viewer', label: 'Viewer', description: '' },
    ],
  };
}

function resetStores(): void {
  useGitStore.setState({
    identity: makeIdentity(USER_A),
    currentUser: USER_A,
    locks: [],
    branch: 'main',
    projectId: 'manual-1',
    workDir: '/tmp/manual',
    projectRootDir: '/tmp/manual',
    status: {
      initialized: true,
      hasCommits: true,
      rootDir: '/tmp/manual',
      branch: 'main',
      primaryBranch: 'main',
      ahead: 0,
      behind: 0,
      isClean: true,
      dirtyFiles: [],
      lastCommit: makeCommit(),
      workDir: '/tmp/manual',
      projectRootDir: '/tmp/manual',
      projectId: 'manual-1',
      locks: [],
      userDrafts: [],
      externalDirtyFiles: [],
    },
    branches: [
      { name: 'main', current: true, primary: true },
      { name: 'release/2.0', current: false, primary: false, worktreePath: '/tmp/wt/r2' },
    ],
    userDrafts: [],
    externalDirtyFiles: [],
    tags: [],
    auditLogs: [],
    history: [],
    historyPath: null,
    diff: null,
    diffLoading: false,
    loading: false,
    busyPath: null,
    error: null,
    lastCommit: makeCommit(),
  });

  useEditorStore.setState({
    workspaceMode: 'api',
    fileTree: [],
    fileSet: new Set([MAP_PATH, TOPIC_PATH]),
    workspaceMaps: [],
    workspaceDitavals: [],
    topicTitles: {},
    topicTypes: {},
    activeRootMapPath: MAP_PATH,
    activeDitavalPath: null,
    activeDitaval: null,
    documentOverlays: {},
    mapBuffers: {},
    diagnostics: [],
    openTabs: [],
    activeTabPath: null,
    savingPaths: [],
    contentConflict: null,
    alert: null,
    lastSaveFailures: [],
    statusMessage: '',
  });

  useAssignmentStore.setState({
    mine: [],
    delegated: [],
    manualItems: [],
  });

  usePublishStore.setState({
    jobs: [],
    activeJobId: null,
    actionError: null,
    submitting: false,
  });
}

function readHeader(init: RequestInit | undefined, name: string): string | null {
  if (!init?.headers) return null;
  if (init.headers instanceof Headers) return init.headers.get(name);
  if (Array.isArray(init.headers)) {
    const found = init.headers.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return found ? found[1] : null;
  }
  const entries = Object.entries(init.headers as Record<string, string>);
  const found = entries.find(([k]) => k.toLowerCase() === name.toLowerCase());
  return found ? found[1] : null;
}

describe('Phase 13 frontend identity switch & draft isolation', () => {
  beforeEach(() => {
    installFakeBrowserStorage(USER_A.id);
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reloads open tabs and clears previous user drafts/alerts when switching from User A to User B', async () => {
    const seenUsersByEndpoint: Record<string, string[]> = {};
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const userId = readHeader(init, 'x-dita-user-id') ?? 'unknown';
      const pathOnly = url.split('?')[0] ?? url;
      (seenUsersByEndpoint[pathOnly] ??= []).push(userId);
      const reply = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });

      if (pathOnly === '/api/identity') {
        const user = ALL_USERS.find((u) => u.id === userId) ?? USER_A;
        return reply(makeIdentity(user));
      }
      if (pathOnly === '/api/git/status') {
        return reply({
          initialized: true,
          hasCommits: true,
          rootDir: '/tmp/manual',
          workDir: '/tmp/manual',
          projectRootDir: '/tmp/manual',
          projectId: 'manual-1',
          branch: 'main',
          primaryBranch: 'main',
          ahead: 0,
          behind: 0,
          isClean: true,
          dirtyFiles: [],
          externalDirtyFiles: [],
          userDrafts:
            userId === USER_A.id
              ? [
                  {
                    id: 'd1',
                    projectId: 'manual-1',
                    branch: 'main',
                    filePath: TOPIC_PATH,
                    userId: USER_A.id,
                    op: 'edit',
                    originalPath: null,
                    contentHash: 'hash-a',
                    isBinary: false,
                    baseCommit: 'abc',
                    updatedAt: '2026-11-26T00:00:00.000Z',
                  },
                ]
              : [],
          locks: [makeLock(TOPIC_PATH, USER_A)],
          lastCommit: makeCommit(),
        });
      }
      if (pathOnly === '/api/git/branches') {
        return reply({
          initialized: true,
          branch: 'main',
          primaryBranch: 'main',
          branches: [{ name: 'main', current: true, primary: true }],
        });
      }
      if (pathOnly === '/api/workspace') {
        return reply(
          makeSnapshot(userId === USER_A.id ? 'Single Sourcing Draft A' : 'Single Sourcing Baseline'),
        );
      }
      if (pathOnly === '/api/files/content') {
        const params = new URL(url, 'http://localhost').searchParams;
        const target = params.get('path');
        if (target === MAP_PATH) {
          return reply({
            path: MAP_PATH,
            content: MAP_XML,
            mtimeMs: 1,
            size: MAP_XML.length,
            kind: 'ditamap',
            wellFormed: true,
            contentHash: 'map-hash',
          });
        }
        const isA = userId === USER_A.id;
        const xml = isA ? USER_A_DRAFT_XML : BASELINE_TOPIC_XML;
        return reply({
          path: TOPIC_PATH,
          content: xml,
          mtimeMs: 1,
          size: xml.length,
          kind: 'topic',
          wellFormed: true,
          contentHash: isA ? 'hash-a' : 'hash-baseline',
          isDraft: isA,
        });
      }
      if (pathOnly === '/api/semantics/context') {
        return reply({
          branch: 'main',
          rootMapPath: MAP_PATH,
          ditavalPath: null,
          keyspace: null,
          topicIndices: [],
          profilingCatalog: { audience: [], platform: [], product: [], otherprops: [], props: [], rev: [] },
          ditavals: [],
          activeDitaval: null,
          indexedAt: Date.now(),
        });
      }
      if (pathOnly === '/api/diagnostics') {
        return reply({ diagnostics: [] });
      }
      if (pathOnly === '/api/semantics/resolve-document') {
        return reply({ filePath: TOPIC_PATH, keyrefs: {}, conrefs: {}, diagnostics: [] });
      }
      if (pathOnly.startsWith('/api/assignments')) {
        return reply({ assignments: [] });
      }
      return reply({});
    });

    // Seed User A's active editor session with their uncommitted draft + stale conflict banner.
    useEditorStore.setState({
      workspaceMode: 'api',
      fileTree: makeSnapshot('Single Sourcing Draft A').files,
      openTabs: [
        {
          path: TOPIC_PATH,
          fileName: 'single-sourcing.dita',
          title: 'Single Sourcing Draft A',
          kind: 'topic',
          docType: 'concept',
          baselineXml: USER_A_DRAFT_XML,
          xml: USER_A_DRAFT_XML,
          mode: 'visual',
          xmlError: null,
          switchBlockedReason: null,
          visualReloadToken: 1,
          contentHash: 'hash-a',
        },
      ],
      activeTabPath: TOPIC_PATH,
      contentConflict: {
        path: TOPIC_PATH,
        message: 'stale',
        currentHash: 'hash-x',
        baseHash: 'hash-a',
      },
      alert: { id: 1, tone: 'error', message: 'old alert' },
    });

    // Switch to User B: editor must drop A's in-memory draft and load clean HEAD baseline.
    await useGitStore.getState().switchUser(USER_B.id);

    const editorAfterB = useEditorStore.getState();
    const tabForB = editorAfterB.openTabs.find((tab) => tab.path === TOPIC_PATH);
    expect(tabForB).toBeDefined();
    expect(tabForB?.xml).toBe(BASELINE_TOPIC_XML);
    expect(tabForB?.contentHash).toBe('hash-baseline');
    expect(editorAfterB.contentConflict).toBeNull();
    expect(editorAfterB.alert).toBeNull();
    expect(useGitStore.getState().userDrafts).toEqual([]);
    expect(seenUsersByEndpoint['/api/workspace']).toContain(USER_B.id);
    expect(seenUsersByEndpoint['/api/files/content']).toContain(USER_B.id);

    // Switch back to User A: A sees their own saved draft again.
    await useGitStore.getState().switchUser(USER_A.id);
    const tabForA = useEditorStore.getState().openTabs.find((tab) => tab.path === TOPIC_PATH);
    expect(tabForA?.xml).toBe(USER_A_DRAFT_XML);
    expect(tabForA?.contentHash).toBe('hash-a');
    expect(useGitStore.getState().userDrafts).toHaveLength(1);
  });
});

describe('Phase 13 optimistic concurrency in editor-store', () => {
  beforeEach(() => {
    installFakeBrowserStorage(USER_A.id);
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends expectedHash, surfaces 409 files.staleContent without losing edits, and supports force overwrite', async () => {
    const putBodies: Array<Record<string, unknown>> = [];
    let rejectStale = true;

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const reply = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });

      if (url.includes('/api/files/content') && method === 'PUT') {
        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        putBodies.push(body);
        if (rejectStale && body.expectedHash) {
          return reply(
            {
              error: 'File changed on server',
              code: 'files.staleContent',
              path: TOPIC_PATH,
              currentHash: 'hash-server-v2',
              serverContent: BASELINE_TOPIC_XML,
            },
            409,
          );
        }
        return reply({
          path: TOPIC_PATH,
          content: body.content,
          mtimeMs: 2,
          size: String(body.content).length,
          kind: 'topic',
          wellFormed: true,
          contentHash: 'hash-after-force',
        });
      }
      if (url.includes('/api/files/content') && method === 'GET') {
        return reply({
          path: TOPIC_PATH,
          content: BASELINE_TOPIC_XML,
          mtimeMs: 2,
          size: BASELINE_TOPIC_XML.length,
          kind: 'topic',
          wellFormed: true,
          contentHash: 'hash-server-v2',
        });
      }
      return reply({});
    });

    useEditorStore.setState({
      workspaceMode: 'api',
      openTabs: [
        {
          path: TOPIC_PATH,
          fileName: 'single-sourcing.dita',
          title: 'Single Sourcing Draft A',
          kind: 'topic',
          docType: 'concept',
          baselineXml: BASELINE_TOPIC_XML,
          xml: USER_A_DRAFT_XML,
          mode: 'source',
          xmlError: null,
          switchBlockedReason: null,
          visualReloadToken: 1,
          contentHash: 'hash-v1',
        },
      ],
      activeTabPath: TOPIC_PATH,
    });

    // 1. Normal save sends expectedHash and gets 409 -> populates contentConflict, keeps local buffer.
    const first = await useEditorStore.getState().saveFile(TOPIC_PATH, { refresh: false });
    expect(first).toBe(false);
    expect(putBodies[0]?.expectedHash).toBe('hash-v1');
    const conflict = useEditorStore.getState().contentConflict;
    expect(conflict).toMatchObject({
      path: TOPIC_PATH,
      currentHash: 'hash-server-v2',
      baseHash: 'hash-v1',
    });
    expect(useEditorStore.getState().openTabs[0]?.xml).toBe(USER_A_DRAFT_XML);

    // 2. Force overwrite omits expectedHash, succeeds, updates contentHash, and clears conflict.
    rejectStale = false;
    const forced = await useEditorStore
      .getState()
      .saveFile(TOPIC_PATH, { force: true, refresh: false });
    expect(forced).toBe(true);
    expect(putBodies[1]?.expectedHash).toBeUndefined();
    expect(useEditorStore.getState().contentConflict).toBeNull();
    expect(useEditorStore.getState().openTabs[0]?.contentHash).toBe('hash-after-force');
  });
});

describe('Phase 13 git-store actions & API contract alignment', () => {
  beforeEach(() => {
    installFakeBrowserStorage(USER_A.id);
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('handles dirty release 409 guidance, handoff, tags, audit, revert, external commit/discard, and merge', async () => {
    const requests: Array<{ method: string; url: string; body?: unknown }> = [];

    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ method, url, body });
      const reply = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        });

      if (url === '/api/locks/release') {
        return reply({ error: 'Cannot release dirty draft' }, 409);
      }
      if (url === '/api/locks/handoff') {
        return reply({
          locks: [makeLock(TOPIC_PATH, USER_B)],
          drafts: [],
        });
      }
      if (url === '/api/git/tags' && method === 'POST') {
        return reply({
          tag: {
            name: 'v1.0',
            commitHash: '1111111222222233333334444444555555556666',
            shortHash: '1111111',
            message: 'Release 1.0',
            taggerName: USER_A.displayName,
            date: '2026-11-26T00:00:00.000Z',
          },
          tags: [
            {
              name: 'v1.0',
              commitHash: '1111111222222233333334444444555555556666',
              shortHash: '1111111',
              message: 'Release 1.0',
              taggerName: USER_A.displayName,
              date: '2026-11-26T00:00:00.000Z',
            },
          ],
        });
      }
      if (url === '/api/git/tags/v1.0' && method === 'DELETE') {
        return reply({ deleted: 'v1.0', tags: [] });
      }
      if (url.startsWith('/api/git/audit')) {
        return reply({
          branch: 'main',
          logs: [
            {
              id: 'a1',
              projectId: 'manual-1',
              branch: 'main',
              actorId: USER_A.id,
              actorName: USER_A.displayName,
              actorColor: USER_A.color,
              action: 'checkin',
              targetPath: TOPIC_PATH,
              details: {},
              createdAt: '2026-11-26T00:00:00.000Z',
            },
          ],
        });
      }
      if (url === '/api/git/external-commit') {
        // Real backend returns a GitCommitEntry object (not a bare string).
        return reply({ commit: makeCommit('deadbeef1234567890', 'external') });
      }
      if (url === '/api/git/external-discard') {
        // Real backend returns `{ discarded: true, paths: [...] }`.
        return reply({ discarded: true, paths: [TOPIC_PATH] });
      }
      if (url === '/api/git/revert-commit') {
        return reply({ commit: makeCommit('cafe1234567890', 'revert') });
      }
      if (url === '/api/git/merge') {
        return reply({
          commit: 'face1234567890',
          sourceBranch: 'release/2.0',
          targetBranch: 'main',
          changedFiles: [TOPIC_PATH],
          resolvedFiles: [],
        });
      }
      if (url === '/api/git/status') {
        return reply({
          initialized: true,
          hasCommits: true,
          rootDir: '/tmp/manual',
          workDir: '/tmp/manual',
          projectRootDir: '/tmp/manual',
          projectId: 'manual-1',
          branch: 'main',
          primaryBranch: 'main',
          ahead: 0,
          behind: 0,
          isClean: true,
          dirtyFiles: [],
          externalDirtyFiles: [],
          userDrafts: [],
          locks: [],
          lastCommit: makeCommit(),
        });
      }
      if (url === '/api/git/branches' && method === 'GET') {
        return reply({
          initialized: true,
          branch: 'main',
          primaryBranch: 'main',
          branches: [{ name: 'main', current: true, primary: true }],
        });
      }
      if (url.startsWith('/api/git/log')) {
        return reply({ branch: 'main', commits: [makeCommit()] });
      }
      if (url === '/api/workspace') return reply(makeSnapshot('Single Sourcing Baseline'));
      if (url.includes('/api/files/content')) {
        return reply({
          path: TOPIC_PATH,
          content: BASELINE_TOPIC_XML,
          mtimeMs: 1,
          size: BASELINE_TOPIC_XML.length,
          kind: 'topic',
          wellFormed: true,
          contentHash: 'hash-baseline',
        });
      }
      if (url.startsWith('/api/semantics/context')) {
        return reply({
          branch: 'main',
          rootMapPath: MAP_PATH,
          ditavalPath: null,
          keyspace: null,
          topicIndices: [],
          profilingCatalog: { audience: [], platform: [], product: [], otherprops: [], props: [], rev: [] },
          ditavals: [],
          activeDitaval: null,
          indexedAt: Date.now(),
        });
      }
      if (url.startsWith('/api/diagnostics')) return reply({ diagnostics: [] });
      return reply({});
    });

    // 1. Dirty release 409 shows guided message.
    await useGitStore.getState().release(TOPIC_PATH);
    expect(useGitStore.getState().error).toBe(t('gitStatus.releaseDirtyGuided'));

    // 2. Handoff transfers lock & clears caller's draft.
    const handed = await useGitStore.getState().handoff(TOPIC_PATH, USER_B.id);
    expect(handed).toBe(true);
    expect(requests.some((r) => r.url === '/api/locks/handoff')).toBe(true);

    // 3. Tags create & delete.
    expect(await useGitStore.getState().createTag({ name: 'v1.0', message: 'Release 1.0' })).toBe(true);
    expect(useGitStore.getState().tags).toHaveLength(1);
    expect(await useGitStore.getState().deleteTag('v1.0')).toBe(true);
    expect(useGitStore.getState().tags).toEqual([]);

    // 4. Audit log loads cleanly.
    await useGitStore.getState().loadAudit({ limit: 20 });
    expect(useGitStore.getState().auditLogs).toHaveLength(1);

    // 5. External commit & discard work with real backend payload shapes without throwing.
    expect(await useGitStore.getState().commitExternal('chore: external')).toBe(true);
    expect(useGitStore.getState().error).toBeNull();
    expect(await useGitStore.getState().discardExternal()).toBe(true);
    expect(useGitStore.getState().error).toBeNull();

    // 6. Revert commit works with real GitCommitInfo object shape.
    expect(await useGitStore.getState().revertCommit('abcdef1')).toBe(true);
    expect(useGitStore.getState().error).toBeNull();

    // 7. Merge succeeds and returns result.
    const merged = await useGitStore.getState().merge({
      sourceBranch: 'release/2.0',
      targetBranch: 'main',
      message: 'Merge release/2.0',
    });
    expect(merged?.commit).toBe('face1234567890');
  });

  it('blocks admin in ensureFileCheckedOut when another user owns the lock', async () => {
    useGitStore.setState({
      currentUser: ADMIN,
      projectId: 'manual-1',
      locks: [makeLock(TOPIC_PATH, USER_A)],
    });

    const guard = await ensureFileCheckedOut(TOPIC_PATH);
    expect(guard.ok).toBe(false);
    expect(guard.reason).toBe('locked-by-other');
    expect(guard.message).toContain(USER_A.displayName);
  });
});

describe('Phase 13 publish-store source modes & traceability', () => {
  beforeEach(() => {
    installFakeBrowserStorage(USER_A.id);
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends sourceMode and sourceRef and preserves traceability metadata on created jobs', async () => {
    const payloads: Array<Record<string, unknown>> = [];
    vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      payloads.push(body);
      return new Response(
        JSON.stringify({
          job: {
            id: 'pub-1',
            projectId: 'manual-1',
            branch: 'main',
            userId: USER_A.id,
            rootMap: MAP_PATH,
            format: 'html5',
            ditaval: null,
            title: 'v1.0 release',
            status: 'queued',
            createdAt: '2026-11-26T00:00:00.000Z',
            startedAt: null,
            finishedAt: null,
            durationMs: null,
            exitCode: null,
            error: null,
            artifactName: null,
            artifactSize: null,
            diagnostics: [],
            previewUrl: null,
            artifactUrl: null,
            logUrl: '/api/publish/jobs/pub-1/log',
            cancelRequested: false,
            themeId: 'tech-docs',
            themeOptions: {},
            sourceMode: body.sourceMode ?? 'baseline',
            sourceRef: body.sourceRef ?? null,
            commitHash: '1234567890abcdef',
            isDirty: body.sourceMode === 'my_drafts',
            dirtyFiles: body.sourceMode === 'my_drafts' ? [TOPIC_PATH] : [],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const tagJob = await usePublishStore.getState().createJob({
      rootMap: MAP_PATH,
      format: 'html5',
      sourceMode: 'tag',
      sourceRef: 'v1.0',
    });
    expect(payloads[0]).toMatchObject({ sourceMode: 'tag', sourceRef: 'v1.0' });
    expect(tagJob?.sourceMode).toBe('tag');
    expect(tagJob?.sourceRef).toBe('v1.0');
    expect(tagJob?.commitHash).toBe('1234567890abcdef');
    expect(tagJob?.isDirty).toBe(false);

    const draftJob = await usePublishStore.getState().createJob({
      rootMap: MAP_PATH,
      format: 'html5',
      sourceMode: 'my_drafts',
    });
    expect(payloads[1]).toMatchObject({ sourceMode: 'my_drafts' });
    expect(draftJob?.isDirty).toBe(true);
    expect(draftJob?.dirtyFiles).toEqual([TOPIC_PATH]);
  });
});
