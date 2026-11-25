import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { translate, type MessageKey } from '../src/i18n/index.js';
import type { DraftView, FileLock, GitCommitInfo, GitFileChange } from '../src/services/git-api';
import type { IdentityUser } from '../src/services/identity-api';
import { useGitStore } from '../src/store/git-store';
import { useEditorStore } from '../src/store/editor-store';
import { usePublishStore } from '../src/store/publish-store';
import { CheckinDialog } from '../src/components/CheckinDialog';
import { GitPanel } from '../src/components/GitPanel';
import { MergeDialog } from '../src/components/MergeDialog';
import { LockStatusBar } from '../src/components/LockStatusBar';
import { PublishDialog } from '../src/components/publish/PublishDialog';
import { ContentConflictBanner } from '../src/workbench/ContentConflictBanner';
import { resolveFileEditability } from '../src/services/lock-helpers';

const ssrT = (key: MessageKey, params?: Record<string, string | number>) =>
  translate('en', key, params);

const USER_A: IdentityUser = {
  id: 'u-writer-lin',
  displayName: '林知远',
  initials: '林',
  email: 'lin@dita.local',
  color: '#0f766e',
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

const TOPIC_PATH = 'concepts/single-sourcing.dita';

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

const COMMIT: GitCommitInfo = {
  hash: 'abcdef1234567890abcdef1234567890abcdef12',
  shortHash: 'abcdef1',
  authorName: USER_A.displayName,
  authorEmail: USER_A.email,
  date: '2026-11-26T00:00:00.000Z',
  message: 'init',
};

function makeExtChange(path: string): GitFileChange {
  return {
    path,
    index: ' ',
    workingTree: 'M',
    staged: false,
    untracked: false,
    deleted: false,
    renamed: false,
    label: 'Modified',
  };
}

describe('Phase 13 UI components SSR invariants', () => {
  beforeEach(() => {
    useGitStore.setState({
      identity: { users: [ADMIN, USER_A, VIEWER], currentUser: USER_A, roles: [] },
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
        lastCommit: COMMIT,
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
      tags: [
        {
          name: 'v1.0',
          commitHash: COMMIT.hash,
          shortHash: COMMIT.shortHash,
          message: 'Release 1.0',
          taggerName: USER_A.displayName,
          date: COMMIT.date,
        },
      ],
      auditLogs: [],
      history: [COMMIT],
      historyPath: null,
      diff: null,
      diffLoading: false,
      loading: false,
      busyPath: null,
      error: null,
      lastCommit: COMMIT,
    });
    useEditorStore.setState({
      mapBuffers: {},
      fileTree: [],
    });
    usePublishStore.setState({
      runtime: {
        available: true,
        command: 'dita',
        ditaHome: '/opt/dita',
        version: '4.2.1',
        pluginInstalled: true,
        pluginPath: null,
        fopConfigPath: null,
        fontsAvailable: true,
        fontsPath: null,
        checkedAt: COMMIT.date,
      },
      jobs: [
        {
          id: 'pub-1',
          projectId: 'manual-1',
          branch: 'main',
          userId: USER_A.id,
          rootMap: 'product-manual.ditamap',
          format: 'html5',
          ditaval: null,
          title: 'Baseline Release',
          status: 'succeeded',
          createdAt: COMMIT.date,
          startedAt: COMMIT.date,
          finishedAt: COMMIT.date,
          durationMs: 1200,
          exitCode: 0,
          error: null,
          artifactName: 'out.zip',
          artifactSize: 1024,
          diagnostics: [],
          previewUrl: '/api/publish/jobs/pub-1/preview/index.html',
          artifactUrl: '/api/publish/jobs/pub-1/artifact',
          logUrl: '/api/publish/jobs/pub-1/log',
          cancelRequested: false,
          themeId: 'tech-docs',
          themeOptions: {},
          sourceMode: 'tag',
          sourceRef: 'v1.0',
          commitHash: COMMIT.hash,
          isDirty: false,
          dirtyFiles: [],
        },
      ],
      activeJobId: 'pub-1',
    });
  });

  it('CheckinDialog renders inline external-dirty conflict resolution card and disables submit when overlapping', () => {
    useGitStore.setState({
      currentUser: USER_A,
      externalDirtyFiles: [makeExtChange(TOPIC_PATH)],
    });

    const html = renderToStaticMarkup(
      React.createElement(CheckinDialog, {
        open: true,
        candidates: [{ path: TOPIC_PATH, lock: makeLock(TOPIC_PATH, USER_A) }],
        onClose: () => undefined,
        onConfirm: async () => true,
      }),
    );

    expect(html).toContain(TOPIC_PATH);
    expect(html).toContain(ssrT('checkin.externalCommitBtn'));
    expect(html).toContain(ssrT('checkin.externalDiscardBtn'));
    expect(html).toContain(ssrT('checkin.blockedByExternal'));
  });

  it('CheckinDialog detects external-dirty overlap on rename originalPath and hides warning when unrelated', () => {
    const renamedFrom = 'concepts/old-name.dita';
    const renamedTo = 'concepts/new-name.dita';
    const draft: DraftView = {
      id: 'd-ren',
      projectId: 'manual-1',
      branch: 'main',
      filePath: renamedTo,
      userId: USER_A.id,
      op: 'rename',
      originalPath: renamedFrom,
      contentHash: 'h1',
      isBinary: false,
      baseCommit: COMMIT.hash,
      updatedAt: COMMIT.date,
    };

    useGitStore.setState({
      currentUser: USER_A,
      userDrafts: [draft],
      externalDirtyFiles: [makeExtChange(renamedFrom)],
    });
    const conflictHtml = renderToStaticMarkup(
      React.createElement(CheckinDialog, {
        open: true,
        candidates: [{ path: renamedTo }],
        onClose: () => undefined,
        onConfirm: async () => true,
      }),
    );
    expect(conflictHtml).toContain(ssrT('checkin.externalCommitBtn'));
    expect(conflictHtml).toContain(renamedTo);

    // Unrelated external dirty file must NOT block check-in of TOPIC_PATH.
    useGitStore.setState({
      currentUser: USER_A,
      userDrafts: [],
      externalDirtyFiles: [makeExtChange('concepts/unrelated.dita')],
    });
    const cleanHtml = renderToStaticMarkup(
      React.createElement(CheckinDialog, {
        open: true,
        candidates: [{ path: TOPIC_PATH, lock: makeLock(TOPIC_PATH, USER_A) }],
        onClose: () => undefined,
        onConfirm: async () => true,
      }),
    );
    expect(cleanHtml).not.toContain(ssrT('checkin.externalCommitBtn'));
  });

  it('GitPanel lets viewers switch existing branches while hiding write-only controls, and shows drafts/external banner for writers', () => {
    useGitStore.setState({
      currentUser: VIEWER,
      externalDirtyFiles: [makeExtChange(TOPIC_PATH)],
    });

    const viewerHtml = renderToStaticMarkup(
      React.createElement(GitPanel, {
        activePath: TOPIC_PATH,
        onOpenDiff: () => undefined,
        onOpenCheckin: () => undefined,
      }),
    );

    expect(viewerHtml).toContain(`aria-label="${ssrT('git.switchBranchAria')}"`);
    expect(viewerHtml).not.toMatch(
      new RegExp(`<select[^>]*disabled=""[^>]*aria-label="${ssrT('git.switchBranchAria')}"`),
    );
    expect(viewerHtml).not.toContain(ssrT('git.externalCommit'));
    expect(viewerHtml).not.toContain(ssrT('git.newBranchPlaceholder'));

    useGitStore.setState({
      currentUser: USER_A,
      externalDirtyFiles: [makeExtChange(TOPIC_PATH)],
      userDrafts: [
        {
          id: 'd1',
          projectId: 'manual-1',
          branch: 'main',
          filePath: TOPIC_PATH,
          userId: USER_A.id,
          op: 'delete',
          originalPath: null,
          contentHash: null,
          isBinary: false,
          baseCommit: COMMIT.hash,
          updatedAt: COMMIT.date,
        },
      ],
    });
    const writerHtml = renderToStaticMarkup(
      React.createElement(GitPanel, {
        activePath: TOPIC_PATH,
        onOpenDiff: () => undefined,
        onOpenCheckin: () => undefined,
      }),
    );
    expect(writerHtml).toContain(ssrT('git.externalCommit'));
    expect(writerHtml).toContain(ssrT('git.draftOp.delete'));
    expect(writerHtml).toContain('v1.0');
  });

  it('LockStatusBar shows Force Unlock for admin on another user lock instead of direct edit', () => {
    const lock = makeLock(TOPIC_PATH, USER_A);
    const editability = resolveFileEditability({
      role: 'admin',
      userId: ADMIN.id,
      filePath: TOPIC_PATH,
      locks: [lock],
    });
    const html = renderToStaticMarkup(
      React.createElement(LockStatusBar, {
        filePath: TOPIC_PATH,
        editability,
        lock,
        busy: false,
        canCheckin: false,
        onCheckout: () => undefined,
        onRelease: () => undefined,
        onCancelCheckout: () => undefined,
        onOpenCheckin: () => undefined,
        onForceUnlock: () => undefined,
      }),
    );
    expect(html).toContain(ssrT('lock.force'));
    expect(html).not.toContain(ssrT('lock.checkout'));
  });

  it('ContentConflictBanner, MergeDialog, and PublishDialog render Phase 13 controls and traceability', () => {
    const bannerHtml = renderToStaticMarkup(
      React.createElement(ContentConflictBanner, {
        conflict: {
          path: TOPIC_PATH,
          message: ssrT('contentConflict.message', { path: TOPIC_PATH }),
          currentHash: 'h2',
          baseHash: 'h1',
        },
        onReload: () => undefined,
        onOverwrite: () => undefined,
        onDismiss: () => undefined,
      }),
    );
    expect(bannerHtml).toContain(ssrT('contentConflict.title'));
    expect(bannerHtml).toContain(ssrT('contentConflict.reload'));
    expect(bannerHtml).toContain(ssrT('contentConflict.overwrite'));

    const mergeHtml = renderToStaticMarkup(
      React.createElement(MergeDialog, {
        open: true,
        onClose: () => undefined,
      }),
    );
    expect(mergeHtml).toContain(ssrT('merge.title'));
    expect(mergeHtml).toContain('release/2.0');

    const publishHtml = renderToStaticMarkup(
      React.createElement(PublishDialog, {
        open: true,
        rootMaps: [
          {
            path: 'product-manual.ditamap',
            name: 'product-manual.ditamap',
            kind: 'ditamap',
            title: 'Product Manual',
            topicrefCount: 1,
          },
        ],
        ditavals: [],
        activeRootMapPath: 'product-manual.ditamap',
        activeDitavalPath: null,
        role: 'writer',
        onClose: () => undefined,
      }),
    );
    expect(publishHtml).toContain(ssrT('publish.source.baseline'));
    expect(publishHtml).toContain(ssrT('publish.source.my_drafts'));
    expect(publishHtml).toContain(COMMIT.shortHash);
    expect(publishHtml).toContain('v1.0');
  });
});
