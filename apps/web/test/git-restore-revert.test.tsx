import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In Vitest's Node environment, React 19 `renderToStaticMarkup` uses `getServerSnapshot`
// on Zustand's `useStore`, which reads the store's initial empty state instead of the live
// test state. Pointing `useStore` at `api.getState()` lets us SSR-render real components
// against any store state without needing jsdom.
vi.mock('zustand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('zustand')>();
  return {
    ...actual,
    create: <T,>(initializer: Parameters<typeof actual.create<T>>[0]) => {
      const store = actual.create(initializer);
      const bound = ((selector?: (state: T) => unknown) => {
        const current = store.getState();
        return selector ? selector(current) : current;
      }) as typeof store;
      Object.assign(bound, store);
      return bound;
    },
  };
});

import { translate, useLocaleStore, type MessageKey } from '../src/i18n/index.js';
import type { DraftView, GitCommitInfo, GitStatusResponse } from '../src/services/git-api';
import type { IdentityResponse, IdentityUser } from '../src/services/identity-api';
import type { WorkspaceSnapshot } from '../src/services/workspace-api';
import type { MapBufferState } from '../src/map-tree/map-tree-utils';
import type { OpenEditorTab } from '../src/store/editor-store/types';
import { useGitStore } from '../src/store/git-store';
import { useEditorStore } from '../src/store/editor-store';
import { GitPanel } from '../src/components/GitPanel';

/** The suite default is zh-CN; these tests assert both locales explicitly. */
const en = (key: MessageKey, params?: Record<string, string | number>) =>
  translate('en', key, params);
const zh = (key: MessageKey, params?: Record<string, string | number>) =>
  translate('zh-CN', key, params);

/** Mirrors the store's own helper: both full hashes and commit objects render short. */
const shortHash = (hash: string): string => hash.slice(0, 7);

const USER_A: IdentityUser = {
  id: 'u-writer-lin',
  displayName: 'Lin',
  initials: 'L',
  email: 'lin@dita.local',
  color: '#0f766e',
  role: 'writer',
};

const VIEWER: IdentityUser = {
  id: 'u-viewer',
  displayName: 'Reviewer',
  initials: 'R',
  email: 'viewer@dita.local',
  color: '#64748b',
  role: 'viewer',
};

const TOPIC_PATH = 'concepts/single-sourcing.dita';
const OTHER_TOPIC_PATH = 'concepts/reuse.dita';
const THIRD_TOPIC_PATH = 'concepts/profiling.dita';
const MAP_PATH = 'product-manual.ditamap';

const HEAD_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1';
const OTHER_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2';

const DRAFT_TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="single_sourcing">
  <title>Draft Local Title</title>
  <conbody><p>Uncommitted local draft.</p></conbody>
</concept>`;

const BASELINE_TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="single_sourcing">
  <title>Baseline Title</title>
  <conbody><p>Baseline HEAD content.</p></conbody>
</concept>`;

const REVERTED_TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="single_sourcing">
  <title>Reverted Title</title>
  <conbody><p>Content after the revert commit.</p></conbody>
</concept>`;

const OLD_MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="product_manual">
  <title>Old Manual</title>
  <topicref href="concepts/single-sourcing.dita"/>
</map>`;

const NEW_MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="product_manual">
  <title>Reverted Manual</title>
  <topicref href="concepts/single-sourcing.dita"/>
  <topicref href="concepts/reuse.dita"/>
</map>`;

function makeCommit(hash: string, message: string): GitCommitInfo {
  return {
    hash,
    shortHash: hash.slice(0, 7),
    authorName: USER_A.displayName,
    authorEmail: USER_A.email,
    date: '2026-11-26T00:00:00.000Z',
    message,
  };
}

const HEAD_COMMIT = makeCommit(HEAD_HASH, 'feat: baseline');
const OLDER_COMMIT = makeCommit(OTHER_HASH, 'feat: older');

function makeIdentity(currentUser: IdentityUser): IdentityResponse {
  return {
    users: [USER_A, VIEWER],
    currentUser,
    roles: [
      { id: 'admin', label: 'Admin', description: '' },
      { id: 'writer', label: 'Writer', description: '' },
      { id: 'viewer', label: 'Viewer', description: '' },
    ],
  };
}

function makeTab(
  path: string,
  xml: string,
  overrides: Partial<OpenEditorTab> = {},
): OpenEditorTab {
  return {
    path,
    fileName: path.split('/').pop() ?? path,
    title: 'Local Title',
    kind: path.endsWith('.ditamap') ? 'ditamap' : 'topic',
    docType: path.endsWith('.ditamap') ? 'map' : 'concept',
    baselineXml: xml,
    xml,
    mode: 'visual',
    xmlError: null,
    switchBlockedReason: null,
    visualReloadToken: 0,
    contentHash: 'hash-local',
    ...overrides,
  };
}

function makeMapBuffer(path: string, xml: string): MapBufferState {
  return {
    path,
    baselineXml: xml,
    xml,
    undoStack: ['stale-undo'],
    redoStack: ['stale-redo'],
    xmlError: null,
    contentHash: 'hash-local-map',
  };
}

function makeSnapshot(): WorkspaceSnapshot {
  return {
    rootDir: '/tmp/manual',
    projectRootDir: '/tmp/manual',
    defaultRootDir: '/tmp/manual',
    name: 'Manual',
    maps: [
      { path: MAP_PATH, name: MAP_PATH, kind: 'ditamap', title: 'Product Manual', topicrefCount: 1 },
    ],
    ditavals: [],
    files: [
      { name: MAP_PATH, path: MAP_PATH, kind: 'ditamap' },
      {
        name: 'concepts',
        path: 'concepts',
        kind: 'directory',
        children: [
          { name: 'single-sourcing.dita', path: TOPIC_PATH, kind: 'topic' },
          { name: 'reuse.dita', path: OTHER_TOPIC_PATH, kind: 'topic' },
          { name: 'profiling.dita', path: THIRD_TOPIC_PATH, kind: 'topic' },
        ],
      },
    ],
    // Deliberately stale: reloadFilesFromDisk must overwrite these with the re-read titles.
    topicTitles: { [TOPIC_PATH]: 'Stale Snapshot Title', [OTHER_TOPIC_PATH]: 'Reuse' },
    topicTypes: { [TOPIC_PATH]: 'concept', [OTHER_TOPIC_PATH]: 'concept' },
    stats: { totalFiles: 4, totalTopics: 3, totalMaps: 1, totalImages: 0 },
  };
}

function makeStatus(overrides: Partial<GitStatusResponse> = {}): GitStatusResponse {
  return {
    initialized: true,
    hasCommits: true,
    rootDir: '/tmp/manual',
    branch: 'main',
    primaryBranch: 'main',
    ahead: 0,
    behind: 0,
    isClean: true,
    dirtyFiles: [],
    lastCommit: HEAD_COMMIT,
    workDir: '/tmp/manual',
    projectRootDir: '/tmp/manual',
    projectId: 'manual-1',
    locks: [],
    userDrafts: [],
    externalDirtyFiles: [],
    ...overrides,
  };
}

function resetStores(currentUser: IdentityUser = USER_A): void {
  useGitStore.setState({
    identity: makeIdentity(currentUser),
    currentUser,
    locks: [],
    branch: 'main',
    projectId: 'manual-1',
    workDir: '/tmp/manual',
    projectRootDir: '/tmp/manual',
    status: makeStatus(),
    branches: [{ name: 'main', current: true, primary: true }],
    userDrafts: [],
    externalDirtyFiles: [],
    tags: [],
    auditLogs: [],
    history: [HEAD_COMMIT, OLDER_COMMIT],
    historyPath: null,
    diff: null,
    diffLoading: false,
    loading: false,
    busyPath: null,
    error: null,
    notice: null,
    lastCommit: HEAD_COMMIT,
  });

  useEditorStore.setState({
    workspaceMode: 'api',
    fileTree: [],
    fileSet: new Set([MAP_PATH, TOPIC_PATH, OTHER_TOPIC_PATH, THIRD_TOPIC_PATH]),
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
}

type FileReply =
  | { content: string; contentHash: string }
  | { status: number; error: string };

interface FetchHub {
  requests: Array<{ method: string; url: string; body: unknown }>;
  /** Per-path answers for `GET /api/files/content`; an absent path answers 404. */
  contents: Record<string, FileReply>;
  status: GitStatusResponse;
  history: GitCommitInfo[];
  revert: unknown | { status: number; error: string; code?: string };
  restore: unknown | { status: number; error: string; code?: string };
  externalCommit: unknown;
}

function makeHub(overrides: Partial<FetchHub> = {}): FetchHub {
  return {
    requests: [],
    contents: {},
    status: makeStatus(),
    history: [HEAD_COMMIT, OLDER_COMMIT],
    revert: { commit: makeCommit('cafe1234567890cafe1234567890cafe12345678', 'revert'), changedFiles: [] },
    restore: { path: TOPIC_PATH, unchanged: false },
    externalCommit: { commit: makeCommit('dead0123456789dead0123456789dead0123456789', 'external') },
    ...overrides,
  };
}

function installFetchHub(hub: FetchHub): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown = null;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : null;
    } catch {
      body = null;
    }
    hub.requests.push({ method, url, body });
    const reply = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    const pathOnly = url.split('?')[0] ?? url;
    const query = new URLSearchParams(url.split('?')[1] ?? '');

    if (pathOnly === '/api/files/content') {
      const requested = query.get('path') ?? '';
      const entry = hub.contents[requested];
      if (!entry) return reply({ error: 'File not found' }, 404);
      if ('status' in entry) {
        return reply({ error: entry.error, code: 'files.notFound' }, entry.status);
      }
      return reply({
        path: requested,
        content: entry.content,
        mtimeMs: 1,
        size: entry.content.length,
        kind: 'topic',
        wellFormed: true,
        contentHash: entry.contentHash,
      });
    }
    if (pathOnly === '/api/git/status') return reply(hub.status);
    if (pathOnly === '/api/git/branches') {
      return reply({
        initialized: true,
        branch: 'main',
        primaryBranch: 'main',
        branches: [{ name: 'main', current: true, primary: true }],
      });
    }
    if (pathOnly === '/api/git/log') return reply({ branch: 'main', commits: hub.history });
    if (pathOnly === '/api/git/audit') return reply({ branch: 'main', logs: [] });
    if (pathOnly === '/api/git/restore-file') {
      const answer = hub.restore as Record<string, unknown>;
      if (typeof answer['status'] === 'number') {
        return reply({ error: answer['error'], code: answer['code'] }, answer['status']);
      }
      return reply(hub.restore);
    }
    if (pathOnly === '/api/git/revert-commit') {
      const answer = hub.revert as Record<string, unknown>;
      if (typeof answer['status'] === 'number') {
        return reply({ error: answer['error'], code: answer['code'] }, answer['status']);
      }
      return reply(hub.revert);
    }
    if (pathOnly === '/api/git/external-commit') return reply(hub.externalCommit);
    if (pathOnly === '/api/workspace') return reply(makeSnapshot());
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
    if (pathOnly.startsWith('/api/diagnostics')) return reply({ diagnostics: [] });
    return reply({});
  });
}

/** Paths this test re-read from disk, in call order (deduplicated). */
function contentReads(hub: FetchHub): string[] {
  return hub.requests
    .filter((request) => request.url.split('?')[0] === '/api/files/content')
    .map((request) => new URLSearchParams(request.url.split('?')[1] ?? '').get('path') ?? '');
}

function requestedPaths(hub: FetchHub, path: string): boolean {
  return hub.requests.some((request) => request.url.split('?')[0] === path);
}

function tabByPath(path: string): OpenEditorTab {
  const tab = useEditorStore.getState().openTabs.find((item) => item.path === path);
  if (!tab) throw new Error(`tab ${path} is not open`);
  return tab;
}

describe('Phase 13 revert commit refreshes open buffers', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('WEB-1: reverts with `changedFiles`, reloading open Topic Tab and map buffer', async () => {
    useEditorStore.setState({
      openTabs: [makeTab(TOPIC_PATH, DRAFT_TOPIC_XML), makeTab(MAP_PATH, OLD_MAP_XML)],
      activeTabPath: TOPIC_PATH,
      mapBuffers: { [MAP_PATH]: makeMapBuffer(MAP_PATH, OLD_MAP_XML) },
    });
    const hub = makeHub({
      contents: {
        [TOPIC_PATH]: { content: REVERTED_TOPIC_XML, contentHash: 'hash-reverted' },
        [MAP_PATH]: { content: NEW_MAP_XML, contentHash: 'hash-map-reverted' },
      },
      revert: {
        commit: makeCommit('cafe1234567890cafe1234567890cafe12345678', 'revert: undo baseline'),
        changedFiles: [TOPIC_PATH, MAP_PATH],
      },
    });
    installFetchHub(hub);

    expect(await useGitStore.getState().revertCommit(OTHER_HASH)).toBe(true);

    // Only the two paths the revert actually touched are re-read.
    expect(contentReads(hub).sort()).toEqual([MAP_PATH, TOPIC_PATH].sort());

    const tab = tabByPath(TOPIC_PATH);
    expect(tab.xml).toBe(REVERTED_TOPIC_XML);
    expect(tab.baselineXml).toBe(REVERTED_TOPIC_XML);
    expect(tab.title).toBe('Reverted Title');
    expect(tab.contentHash).toBe('hash-reverted');
    expect(tab.visualReloadToken).toBe(1);
    expect(tab.switchBlockedReason).toBeNull();

    const editor = useEditorStore.getState();
    // Re-read title wins over the stale title the workspace snapshot reported.
    expect(editor.topicTitles[TOPIC_PATH]).toBe('Reverted Title');
    expect(editor.mapBuffers[MAP_PATH]?.xml).toBe(NEW_MAP_XML);
    expect(editor.mapBuffers[MAP_PATH]?.baselineXml).toBe(NEW_MAP_XML);
    expect(editor.mapBuffers[MAP_PATH]?.contentHash).toBe('hash-map-reverted');
    expect(editor.mapBuffers[MAP_PATH]?.undoStack).toEqual([]);

    // History is refreshed and the user gets visible (not just screen-reader) feedback.
    expect(requestedPaths(hub, '/api/git/log')).toBe(true);
    const notice = useGitStore.getState().notice;
    expect(notice?.tone).toBe('success');
    expect(notice?.message).toBe(
      zh('gitStatus.reverted', { hash: shortHash('cafe1234567890cafe1234567890cafe12345678') }),
    );
    expect(useGitStore.getState().error).toBeNull();
    expect(useEditorStore.getState().statusMessage).toBe(notice?.message);
  });

  it('WEB-2: reverts without `changedFiles` and falls back to every open tab and map buffer', async () => {
    useEditorStore.setState({
      openTabs: [makeTab(TOPIC_PATH, DRAFT_TOPIC_XML)],
      activeTabPath: TOPIC_PATH,
      mapBuffers: { [MAP_PATH]: makeMapBuffer(MAP_PATH, OLD_MAP_XML) },
    });
    const hub = makeHub({
      contents: {
        [TOPIC_PATH]: { content: REVERTED_TOPIC_XML, contentHash: 'hash-reverted' },
        [MAP_PATH]: { content: NEW_MAP_XML, contentHash: 'hash-map-reverted' },
      },
      // Older API responses omit `changedFiles` entirely.
      revert: { commit: makeCommit('cafe1234567890cafe1234567890cafe12345678', 'revert') },
    });
    installFetchHub(hub);

    expect(await useGitStore.getState().revertCommit(OTHER_HASH)).toBe(true);

    expect(contentReads(hub).sort()).toEqual([MAP_PATH, TOPIC_PATH].sort());
    expect(tabByPath(TOPIC_PATH).xml).toBe(REVERTED_TOPIC_XML);
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(NEW_MAP_XML);
    expect(useGitStore.getState().notice?.tone).toBe('success');
  });

  it('WEB-2b: reloadFilesFromDisk dedupes paths and no-ops on an empty list', async () => {
    const hub = makeHub({
      contents: { [MAP_PATH]: { content: NEW_MAP_XML, contentHash: 'hash-map-reverted' } },
    });
    installFetchHub(hub);
    useEditorStore.setState({
      openTabs: [makeTab(MAP_PATH, OLD_MAP_XML)],
      activeTabPath: MAP_PATH,
      // The same path open in both views must still be fetched once.
      mapBuffers: { [MAP_PATH]: makeMapBuffer(MAP_PATH, OLD_MAP_XML) },
    });

    await useEditorStore.getState().reloadFilesFromDisk([]);
    expect(contentReads(hub)).toEqual([]);

    await useEditorStore.getState().reloadFilesFromDisk([MAP_PATH, MAP_PATH]);
    expect(contentReads(hub)).toEqual([MAP_PATH]);
    expect(tabByPath(MAP_PATH).xml).toBe(NEW_MAP_XML);
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(NEW_MAP_XML);
  });

  it('WEB-3: a file deleted by the revert (404) closes its tab, buffer and stale conflict', async () => {
    useEditorStore.setState({
      openTabs: [
        makeTab(OTHER_TOPIC_PATH, DRAFT_TOPIC_XML),
        makeTab(TOPIC_PATH, DRAFT_TOPIC_XML),
        makeTab(THIRD_TOPIC_PATH, DRAFT_TOPIC_XML),
      ],
      activeTabPath: TOPIC_PATH,
      mapBuffers: { [TOPIC_PATH]: makeMapBuffer(TOPIC_PATH, DRAFT_TOPIC_XML) },
      contentConflict: {
        path: TOPIC_PATH,
        message: 'stale',
        currentHash: 'hash-remote',
        baseHash: 'hash-local',
      },
    });
    const hub = makeHub({
      contents: {
        [OTHER_TOPIC_PATH]: { content: BASELINE_TOPIC_XML, contentHash: 'hash-other' },
        [THIRD_TOPIC_PATH]: { content: BASELINE_TOPIC_XML, contentHash: 'hash-third' },
        // TOPIC_PATH intentionally absent: the revert deleted it.
      },
      revert: {
        commit: makeCommit('cafe1234567890cafe1234567890cafe12345678', 'revert: delete topic'),
        changedFiles: [TOPIC_PATH],
      },
    });
    installFetchHub(hub);

    expect(await useGitStore.getState().revertCommit(OTHER_HASH)).toBe(true);

    const editor = useEditorStore.getState();
    expect(editor.openTabs.map((tab) => tab.path)).toEqual([OTHER_TOPIC_PATH, THIRD_TOPIC_PATH]);
    // The closed tab was active, so the adjacent tab takes over.
    expect(editor.activeTabPath).toBe(THIRD_TOPIC_PATH);
    expect(editor.mapBuffers[TOPIC_PATH]).toBeUndefined();
    expect(editor.contentConflict).toBeNull();
    // A 404 is a real deletion, not an error banner.
    expect(useGitStore.getState().error).toBeNull();
    expect(useGitStore.getState().notice?.tone).toBe('success');
  });

  it('WEB-4: 409 lock/draft blocks surface a readable error without corrupting the open tab', async () => {
    useEditorStore.setState({
      openTabs: [makeTab(TOPIC_PATH, DRAFT_TOPIC_XML)],
      activeTabPath: TOPIC_PATH,
    });
    const hub = makeHub({
      revert: {
        status: 409,
        error: 'Another user holds the lock on concepts/single-sourcing.dita',
        code: 'git.revertBlockedByLocks',
      },
    });
    installFetchHub(hub);

    expect(await useGitStore.getState().revertCommit(OTHER_HASH)).toBe(false);
    expect(useGitStore.getState().error).toContain('holds the lock');
    expect(useGitStore.getState().notice).toBeNull();
    // Nothing was reloaded, so the in-memory edit survives untouched.
    expect(tabByPath(TOPIC_PATH).xml).toBe(DRAFT_TOPIC_XML);
    expect(contentReads(hub)).toEqual([]);

    // Draft block from a different user takes the same safe path.
    hub.revert = {
      status: 409,
      error: 'Uncommitted drafts exist on this branch',
      code: 'git.revertBlockedByDrafts',
    };
    expect(await useGitStore.getState().revertCommit(OTHER_HASH)).toBe(false);
    expect(useGitStore.getState().error).toContain('Uncommitted drafts');
    expect(tabByPath(TOPIC_PATH).xml).toBe(DRAFT_TOPIC_XML);
  });
});

describe('Phase 13 restore historical revision feedback', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('WEB-5: restoring a revision refreshes the tab, clears conflict and shows success', async () => {
    const draft: DraftView = {
      id: 'draft-1',
      filePath: TOPIC_PATH,
      op: 'edit',
      originalPath: null,
      contentHash: 'hash-reverted',
      isBinary: false,
      baseCommit: OTHER_HASH,
      updatedAt: '2026-11-26T00:00:00.000Z',
    };
    useEditorStore.setState({
      openTabs: [makeTab(TOPIC_PATH, DRAFT_TOPIC_XML)],
      activeTabPath: TOPIC_PATH,
      contentConflict: {
        path: TOPIC_PATH,
        message: 'stale',
        currentHash: 'hash-remote',
        baseHash: 'hash-local',
      },
    });
    const hub = makeHub({
      contents: { [TOPIC_PATH]: { content: REVERTED_TOPIC_XML, contentHash: 'hash-reverted' } },
      status: makeStatus({ isClean: false, userDrafts: [draft] }),
      restore: {
        path: TOPIC_PATH,
        revision: OTHER_HASH,
        mode: 'commit',
        unchanged: false,
        contentHash: 'hash-reverted',
      },
    });
    installFetchHub(hub);

    const revision = OTHER_HASH;
    expect(
      await useGitStore.getState().restoreFile({ path: TOPIC_PATH, revision, mode: 'commit' }),
    ).toBe(true);

    const tab = tabByPath(TOPIC_PATH);
    expect(tab.xml).toBe(REVERTED_TOPIC_XML);
    expect(tab.baselineXml).toBe(REVERTED_TOPIC_XML);
    expect(tab.title).toBe('Reverted Title');
    expect(tab.contentHash).toBe('hash-reverted');
    expect(tab.visualReloadToken).toBe(1);
    expect(useEditorStore.getState().contentConflict).toBeNull();

    // The caller's draft list is re-read so the panel stops showing a draft that moved.
    expect(useGitStore.getState().userDrafts).toHaveLength(1);
    expect(useGitStore.getState().userDrafts[0]?.contentHash).toBe('hash-reverted');
    // A commit-mode restore also refreshes history.
    expect(requestedPaths(hub, '/api/git/log')).toBe(true);

    const notice = useGitStore.getState().notice;
    expect(notice?.tone).toBe('success');
    expect(notice?.message).toBe(
      zh('gitStatus.restored', { path: TOPIC_PATH, revision }),
    );
    expect(useGitStore.getState().busyPath).toBeNull();
  });

  it('WEB-6: `unchanged` shows info and `clearedDraft` shows success, both without errors', async () => {
    useEditorStore.setState({
      openTabs: [makeTab(TOPIC_PATH, DRAFT_TOPIC_XML)],
      activeTabPath: TOPIC_PATH,
    });
    const revision = OTHER_HASH;
    const hub = makeHub({
      contents: { [TOPIC_PATH]: { content: BASELINE_TOPIC_XML, contentHash: 'hash-baseline' } },
      restore: { path: TOPIC_PATH, revision, mode: 'draft', unchanged: true, contentHash: 'hash-baseline' },
    });
    installFetchHub(hub);

    // 1. Nothing to restore: informational notice, and the buffer is left alone.
    expect(
      await useGitStore.getState().restoreFile({ path: TOPIC_PATH, revision, mode: 'draft' }),
    ).toBe(true);
    expect(useGitStore.getState().error).toBeNull();
    expect(useGitStore.getState().notice?.tone).toBe('info');
    expect(useGitStore.getState().notice?.message).toBe(
      zh('gitStatus.restoredUnchanged', { path: TOPIC_PATH, revision: shortHash(revision) }),
    );
    expect(tabByPath(TOPIC_PATH).xml).toBe(DRAFT_TOPIC_XML);
    expect(tabByPath(TOPIC_PATH).visualReloadToken).toBe(0);
    expect(contentReads(hub)).toEqual([]);

    // 2. HEAD restore that dropped the now-redundant draft: success + reloaded content.
    hub.restore = {
      path: TOPIC_PATH,
      revision,
      mode: 'commit',
      unchanged: false,
      clearedDraft: true,
      contentHash: 'hash-baseline',
    };
    expect(
      await useGitStore.getState().restoreFile({ path: TOPIC_PATH, revision, mode: 'commit' }),
    ).toBe(true);
    expect(useGitStore.getState().error).toBeNull();
    expect(useGitStore.getState().notice?.tone).toBe('success');
    expect(useGitStore.getState().notice?.message).toBe(
      zh('gitStatus.restoredClearedDraft', { path: TOPIC_PATH, revision: shortHash(revision) }),
    );
    expect(contentReads(hub)).toEqual([TOPIC_PATH]);
    expect(tabByPath(TOPIC_PATH).xml).toBe(BASELINE_TOPIC_XML);
    expect(tabByPath(TOPIC_PATH).visualReloadToken).toBe(1);

    // The localized copy exists in both catalogues.
    expect(
      en('gitStatus.restoredClearedDraft', { path: TOPIC_PATH, revision: shortHash(revision) }),
    ).toContain('cleared the redundant draft');
  });

  it('WEB-7: external commit reloads every open tab and map buffer', async () => {
    useEditorStore.setState({
      openTabs: [makeTab(TOPIC_PATH, DRAFT_TOPIC_XML)],
      activeTabPath: TOPIC_PATH,
      mapBuffers: { [MAP_PATH]: makeMapBuffer(MAP_PATH, OLD_MAP_XML) },
    });
    const hub = makeHub({
      contents: {
        [TOPIC_PATH]: { content: BASELINE_TOPIC_XML, contentHash: 'hash-baseline' },
        [MAP_PATH]: { content: NEW_MAP_XML, contentHash: 'hash-map' },
      },
    });
    installFetchHub(hub);

    expect(await useGitStore.getState().commitExternal('chore: commit external edits')).toBe(true);

    // Commit-external does not report paths, so everything open is re-read.
    expect(contentReads(hub).sort()).toEqual([MAP_PATH, TOPIC_PATH].sort());
    expect(tabByPath(TOPIC_PATH).xml).toBe(BASELINE_TOPIC_XML);
    expect(tabByPath(TOPIC_PATH).contentHash).toBe('hash-baseline');
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(NEW_MAP_XML);
    expect(useGitStore.getState().error).toBeNull();
  });
});

describe('Phase 13 GitPanel feedback placement and version actions', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: 'en' });
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderPanel = (activePath: string | null): string =>
    renderToStaticMarkup(
      React.createElement(GitPanel, {
        activePath,
        onOpenDiff: () => undefined,
        onOpenCheckin: () => undefined,
      }),
    );

  it('WEB-8: renders error and notice outside the scroll area, disables version buttons, marks HEAD', () => {
    const errorText = 'Another user holds the lock on concepts/single-sourcing.dita';
    const noticeText = en('gitStatus.restored', { path: TOPIC_PATH, revision: 'abcdef1' });
    useGitStore.setState({
      status: makeStatus({ initialized: true, lastCommit: HEAD_COMMIT }),
      lastCommit: HEAD_COMMIT,
      history: [HEAD_COMMIT, OLDER_COMMIT],
      branch: 'main',
      loading: false,
      busyPath: TOPIC_PATH,
      error: errorText,
      notice: { id: 7, tone: 'success', message: noticeText },
    });

    const html = renderPanel(TOPIC_PATH);
    const feedbackIndex = html.indexOf('data-testid="git-panel-feedback"');
    const scrollIndex = html.indexOf('data-testid="git-panel-scroll"');

    expect(feedbackIndex).toBeGreaterThanOrEqual(0);
    expect(scrollIndex).toBeGreaterThan(feedbackIndex);

    // Both messages live above the scroll container, so a user scrolled to Commit History sees them.
    const errorIndex = html.indexOf(errorText);
    const noticeIndex = html.indexOf(noticeText);
    expect(errorIndex).toBeGreaterThan(feedbackIndex);
    expect(errorIndex).toBeLessThan(scrollIndex);
    expect(noticeIndex).toBeGreaterThan(feedbackIndex);
    expect(noticeIndex).toBeLessThan(scrollIndex);
    expect(html.slice(scrollIndex)).not.toContain(errorText);
    expect(html.slice(scrollIndex)).not.toContain(noticeText);

    expect(html).toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(`aria-label="${en('git.dismissNotice')}"`);

    // Buttons are disabled while this path is busy.
    expect(html).toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${en('git.restoreFile')}</button>`),
    );
    expect(html).toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${en('git.revertCommit')}</button>`),
    );

    // Exactly one commit carries the HEAD badge.
    expect(html.match(new RegExp(`>${en('git.headBadge')}<`, 'g')) ?? []).toHaveLength(1);
  });

  it('WEB-8b: disables version buttons while loading and re-enables them for other paths', () => {
    useGitStore.setState({
      status: makeStatus({ initialized: true, lastCommit: HEAD_COMMIT }),
      lastCommit: HEAD_COMMIT,
      history: [HEAD_COMMIT],
      loading: true,
      busyPath: null,
      error: null,
      notice: null,
    });

    const loadingHtml = renderPanel(TOPIC_PATH);
    expect(loadingHtml).toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${en('git.restoreFile')}</button>`),
    );
    expect(loadingHtml).toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${en('git.revertCommit')}</button>`),
    );

    // Another file is busy and nothing is loading: the active file's buttons stay enabled.
    useGitStore.setState({ loading: false, busyPath: OTHER_TOPIC_PATH });
    const idleHtml = renderPanel(TOPIC_PATH);
    expect(idleHtml).not.toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${en('git.restoreFile')}</button>`),
    );
    expect(idleHtml).not.toMatch(
      new RegExp(`<button[^>]*disabled=""[^>]*>${en('git.revertCommit')}</button>`),
    );
    expect(idleHtml).toContain(en('git.restoreFile'));
    expect(idleHtml).toContain(en('git.revertCommit'));
    // No HEAD badge when the loaded history does not contain the HEAD commit... it does here.
    expect(idleHtml).toContain(`>${en('git.headBadge')}<`);

    // A viewer never sees the write-only version actions.
    useGitStore.setState({ currentUser: VIEWER, busyPath: null, loading: false });
    const viewerHtml = renderPanel(TOPIC_PATH);
    expect(viewerHtml).not.toContain(en('git.restoreFile'));
    expect(viewerHtml).not.toContain(en('git.revertCommit'));
  });
});
