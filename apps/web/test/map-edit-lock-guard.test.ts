import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';
import { useGitStore } from '../src/store/git-store';
import type { FileLock } from '../src/services/git-api';
import type { IdentityUser } from '../src/services/identity-api';
import { t } from '../src/i18n/index.js';
import type { MapBufferState } from '../src/map-tree/map-tree-utils';

const MAP_PATH = 'maps/product-manual.ditamap';
const MAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">
<map id="manual">
  <title>Product Manual</title>
  <topicref href="../topics/intro.dita" type="topic" id="intro"/>
</map>
`;

const WRITER: IdentityUser = {
  id: 'u-writer-lin',
  displayName: '林知远',
  initials: 'LZ',
  email: 'lin@example.com',
  color: '#2563eb',
  role: 'writer',
};

const OTHER_WRITER: IdentityUser = { ...WRITER, id: 'u-writer-chen', displayName: '陈曦' };

function makeLock(filePath: string, user: IdentityUser): FileLock {
  return {
    id: `lock-${user.id}`,
    projectId: 'p1',
    branch: 'main',
    filePath,
    userId: user.id,
    userName: user.displayName,
    userColor: user.color,
    userRole: user.role,
    lockedAt: '2026-11-25T00:00:00.000Z',
    updatedAt: '2026-11-25T00:00:00.000Z',
    expired: false,
  };
}

function makeBuffer(xml = MAP_XML): MapBufferState {
  return { path: MAP_PATH, xml, baselineXml: xml, undoStack: [], redoStack: [], xmlError: null };
}

interface ServerOptions {
  /** Locks the server reports (for `/api/locks/checkout` and `/api/git/status`). */
  locks?: FileLock[];
  /** Result of `PUT /api/files/content`; evaluated per call so a test can reject then accept. */
  save?: () => { ok: boolean; status: number; error?: string } | undefined;
}

/**
 * Minimal HTTP stand-in for `apps/web/src/services/*-api.ts`. Records every request as
 * `"METHOD /path"` so tests can assert that a check-out (or a file write) did or did not happen.
 */
function installServer(options: ServerOptions = {}) {
  const calls: string[] = [];
  let locks = options.locks ?? [];

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(`${method} ${url}`);
    const reply = (body: unknown, ok = true, status = 200) =>
      ({ ok, status, text: async () => JSON.stringify(body) }) as unknown as Response;

    if (url.endsWith('/api/locks/checkout')) {
      const filePath = JSON.parse(String(init?.body ?? '{}')).filePath as string | undefined;
      const lock = makeLock(filePath ?? MAP_PATH, WRITER);
      locks = [...locks.filter((item) => item.filePath !== lock.filePath), lock];
      return reply({
        locks,
        lock,
        branch: 'main',
        projectId: 'p1',
        workDir: '/tmp/work',
        projectRootDir: '/tmp/root',
      });
    }
    if (url.includes('/api/files/content')) {
      const result = options.save?.() ?? { ok: true, status: 200 };
      return reply(result.ok ? { path: 'saved' } : { error: result.error ?? `HTTP ${result.status}` }, result.ok, result.status);
    }
    if (url.endsWith('/api/locks/checkin')) {
      return reply({
        commit: {
          hash: 'abcdef1234567890',
          shortHash: 'abcdef1',
          message: 'check-in',
          author: WRITER.displayName,
          email: WRITER.email,
          date: '2026-11-25T00:00:00.000Z',
        },
        branch: 'main',
        projectId: 'p1',
        releasedPaths: [],
        locks: [],
        status: { initialized: true, dirtyFiles: [] },
        workDir: '/tmp/work',
        projectRootDir: '/tmp/root',
        completedAssignments: [],
      });
    }
    if (url.includes('/api/git/status')) {
      return reply({
        initialized: true,
        branch: 'main',
        dirtyFiles: [],
        untrackedFiles: [],
        ahead: 0,
        behind: 0,
        lastCommit: null,
        workDir: '/tmp/work',
        projectRootDir: '/tmp/root',
        projectId: 'p1',
        locks,
      });
    }
    if (url.includes('/api/git/branches')) {
      return reply({
        initialized: true,
        branch: 'main',
        primaryBranch: 'main',
        branches: [{ name: 'main', current: true }],
      });
    }
    return reply({});
  });

  return calls;
}

function seedWorkspace(input: { mode: 'memory' | 'api'; user?: IdentityUser; locks?: FileLock[] }) {
  useGitStore.setState({
    identity: null,
    currentUser: input.mode === 'api' ? (input.user ?? WRITER) : null,
    locks: input.locks ?? [],
    branch: 'main',
    projectId: input.mode === 'api' ? 'p1' : null,
    workDir: '/tmp/work',
    projectRootDir: '/tmp/root',
    status: null,
    busyPath: null,
    error: null,
    lastCommit: null,
  });
  useEditorStore.setState({
    workspaceMode: input.mode,
    mapBuffers: { [MAP_PATH]: makeBuffer() },
    activeRootMapPath: null,
    selectedMapNode: null,
    openTabs: [],
    activeTabPath: null,
    savingPaths: [],
    alert: null,
    lastSaveFailures: [],
    statusMessage: '',
  });
}

describe('map edits take the check-out lock first', () => {
  beforeEach(() => {
    seedWorkspace({ mode: 'memory' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('never talks to the lock API in the in-browser demo workspace', async () => {
    const calls = installServer();

    await expect(useEditorStore.getState().ensureMapEditable(MAP_PATH)).resolves.toBe(true);
    expect(calls).toEqual([]);
  });

  it('checks the map out before applying a structure edit', async () => {
    seedWorkspace({ mode: 'api' });
    const calls = installServer();

    const applied = await useEditorStore
      .getState()
      .insertMapStructureNode({ mapPath: MAP_PATH, parentPath: [], tagName: 'topicref' });

    expect(applied).toBeUndefined();
    expect(calls).toContain('POST /api/locks/checkout');
    expect(useGitStore.getState().locks.map((lock) => lock.filePath)).toContain(MAP_PATH);
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).not.toBe(MAP_XML);
    expect(useEditorStore.getState().isPathDirty(MAP_PATH)).toBe(true);
  });

  it('reuses a lock the current user already holds instead of checking out again', async () => {
    seedWorkspace({ mode: 'api', locks: [makeLock(MAP_PATH, WRITER)] });
    const calls = installServer({ locks: [makeLock(MAP_PATH, WRITER)] });

    await expect(useEditorStore.getState().ensureMapEditable(MAP_PATH)).resolves.toBe(true);
    expect(calls).toEqual([]);
  });

  it('deduplicates concurrent check-outs for the same map', async () => {
    seedWorkspace({ mode: 'api' });
    const calls = installServer();

    const results = await Promise.all([
      useEditorStore.getState().ensureMapEditable(MAP_PATH),
      useEditorStore.getState().ensureMapEditable(MAP_PATH),
      useEditorStore.getState().ensureMapEditable(MAP_PATH),
    ]);

    expect(results).toEqual([true, true, true]);
    expect(calls.filter((call) => call.endsWith('/api/locks/checkout'))).toHaveLength(1);
  });

  it('blocks the edit and explains why when another writer holds the map', async () => {
    seedWorkspace({ mode: 'api', locks: [makeLock(MAP_PATH, OTHER_WRITER)] });
    const calls = installServer({ locks: [makeLock(MAP_PATH, OTHER_WRITER)] });

    const applied = await useEditorStore
      .getState()
      .insertMapStructureNode({ mapPath: MAP_PATH, parentPath: [], tagName: 'topicref' });

    expect(applied).toBeUndefined();
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(MAP_XML);
    expect(calls).toEqual([]);
    expect(useEditorStore.getState().alert?.message).toBe(
      t('lock.mapBlocked', {
        path: MAP_PATH,
        message: t('lock.checkedOutByOther', { user: OTHER_WRITER.displayName }),
      }),
    );
  });

  it('blocks the edit for a read-only viewer', async () => {
    seedWorkspace({ mode: 'api', user: { ...WRITER, id: 'u-viewer', role: 'viewer' } });
    const calls = installServer();

    await expect(useEditorStore.getState().ensureMapEditable(MAP_PATH)).resolves.toBe(false);
    expect(calls).toEqual([]);
    expect(useEditorStore.getState().alert?.message).toBe(
      t('lock.mapBlocked', { path: MAP_PATH, message: t('lock.viewerReadOnly') }),
    );
  });

  it('does not create an orphan topic when the map cannot be checked out', async () => {
    seedWorkspace({ mode: 'api', locks: [makeLock(MAP_PATH, OTHER_WRITER)] });
    const calls = installServer({ locks: [makeLock(MAP_PATH, OTHER_WRITER)] });

    await useEditorStore.getState().createTopicAndMountInMap({
      mapPath: MAP_PATH,
      parentPath: [],
      tagName: 'topicref',
      topicType: 'concept',
      id: 'orphan_probe',
      title: 'Orphan probe',
      lang: 'zh-CN',
      targetDir: 'topics',
    });

    expect(calls.filter((call) => call.includes('/api/files'))).toEqual([]);
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(MAP_XML);
    expect(useEditorStore.getState().alert?.tone).toBe('error');
  });
});

describe('check-in commits what is on disk', () => {
  const DIRTY_MAP_XML = MAP_XML.replace('Product Manual', 'Edited Manual');

  beforeEach(() => {
    seedWorkspace({ mode: 'api', locks: [makeLock(MAP_PATH, WRITER)] });
    useEditorStore.setState({
      mapBuffers: { [MAP_PATH]: { ...makeBuffer(), xml: DIRTY_MAP_XML } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves the unsaved map before committing it', async () => {
    const calls = installServer({ locks: [makeLock(MAP_PATH, WRITER)] });

    const result = await useGitStore.getState().checkin([MAP_PATH], 'edit manual');

    expect(result).not.toBeNull();
    const saveIndex = calls.indexOf('PUT /api/files/content');
    const checkinIndex = calls.indexOf('POST /api/locks/checkin');
    expect(saveIndex).toBeGreaterThanOrEqual(0);
    expect(checkinIndex).toBeGreaterThan(saveIndex);
  });

  it('blocks the commit and reports the reason when that save is rejected', async () => {
    const calls = installServer({
      locks: [makeLock(MAP_PATH, WRITER)],
      save: () => ({ ok: false, status: 409, error: '请先检出该文件再编辑保存' }),
    });

    const result = await useGitStore.getState().checkin([MAP_PATH], 'edit manual');

    expect(result).toBeNull();
    expect(calls).not.toContain('POST /api/locks/checkin');
    expect(useGitStore.getState().error).toBe(
      t('gitStatus.checkinBlockedByDirty', { paths: MAP_PATH }),
    );
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.xml).toBe(DIRTY_MAP_XML);
  });
});

describe('save failures are visible instead of only announced to screen readers', () => {
  beforeEach(() => {
    seedWorkspace({ mode: 'api', locks: [makeLock(MAP_PATH, WRITER)] });
    useEditorStore.setState({
      openTabs: [
        {
          path: MAP_PATH,
          title: 'Product Manual',
          xml: MAP_XML.replace('Product Manual', 'Edited Manual'),
          baselineXml: MAP_XML,
          xmlError: null,
          mode: 'source',
          visualReloadToken: 0,
        } as unknown as ReturnType<typeof useEditorStore.getState>['openTabs'][number],
      ],
      activeTabPath: MAP_PATH,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records the server reason and raises a visible alert with a recovery action', async () => {
    installServer({ save: () => ({ ok: false, status: 409, error: '请先检出该文件再编辑保存' }) });

    const saved = await useEditorStore.getState().saveFile(MAP_PATH);

    expect(saved).toBe(false);
    const state = useEditorStore.getState();
    expect(state.lastSaveFailures).toEqual([
      { path: MAP_PATH, message: '请先检出该文件再编辑保存' },
    ]);
    expect(state.alert).toMatchObject({
      tone: 'error',
      action: { kind: 'save-with-checkout', paths: [MAP_PATH] },
    });
    expect(state.alert?.message).toBe(
      t('lock.saveFailed', { path: MAP_PATH, message: '请先检出该文件再编辑保存' }),
    );
  });

  it('retries after taking the lock and clears the alert once the file is saved', async () => {
    // The lock was released (or never taken): saving must acquire it first, like the UI does.
    useGitStore.setState({ locks: [] });
    const calls = installServer({ save: () => ({ ok: true, status: 200 }) });
    useEditorStore.setState({ alert: null, lastSaveFailures: [] });

    const saved = await useEditorStore.getState().saveFileEnsuringLock(MAP_PATH);

    expect(saved).toBe(true);
    expect(calls).toContain('POST /api/locks/checkout');
    expect(useEditorStore.getState().alert).toBeNull();
    expect(useEditorStore.getState().lastSaveFailures).toEqual([]);
    expect(useEditorStore.getState().mapBuffers[MAP_PATH]?.baselineXml).toBe(
      MAP_XML.replace('Product Manual', 'Edited Manual'),
    );
  });

  it('keeps the alert dismissible without dropping the unsaved edits', async () => {
    installServer({ save: () => ({ ok: false, status: 403, error: '只读身份无法保存文件' }) });
    await useEditorStore.getState().saveFile(MAP_PATH);
    expect(useEditorStore.getState().alert).not.toBeNull();

    useEditorStore.getState().dismissAlert();

    expect(useEditorStore.getState().alert).toBeNull();
    expect(useEditorStore.getState().isPathDirty(MAP_PATH)).toBe(true);
  });
});
