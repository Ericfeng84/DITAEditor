// @vitest-environment jsdom
/**
 * Phase 16 Stage 4 — Translation Center, bilingual review and glossary manager.
 *
 * Every assertion runs against the real `@dita/core` translation kernel (live QA is computed in
 * the component) and a stubbed `fetch` that mimics the Stage 2/3 `@dita/api` wire shapes, so a
 * drift in either the REST contract or the UI wiring fails here.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GlossaryEntryForMatch } from '@dita/core';
import { runTranslationQa } from '@dita/core';
import {
  bilingualReviewPath,
  editorPath,
  glossariesPath,
  hubPath,
  parseRoute,
  translationCenterPath,
} from '../src/router/app-router.js';
import { t as translate, useLocaleStore } from '../src/i18n/index.js';
import { useGitStore } from '../src/store/git-store';
import { useTranslationStore } from '../src/store/translation-store.js';
import type { IdentityResponse, IdentityUser } from '../src/services/identity-api.js';
import type { Manual } from '../src/services/manuals-api.js';
import { AiSettingsDialog } from '../src/ai/AiSettingsDialog';
import { useAiStore } from '../src/ai/ai-store';
import type { AiPublicConfig } from '../src/ai/ai-types';
import type {
  GlossaryTermView,
  GlossaryView,
  TranslationAiReviewReport,
  TranslationDitaOtItemReport,
  TranslationFileStateView,
  TranslationItemView,
  TranslationJobView,
  TranslationLinkView,
  TranslationReviewPayload,
} from '../src/services/translation-api.js';
import { BilingualReviewPage } from '../src/translation/BilingualReviewPage';
import { GlossaryManagerPage } from '../src/translation/GlossaryManagerPage';
import { TranslationCenterPage } from '../src/translation/TranslationCenterPage';
import { TranslationQueueTab } from '../src/translation/TranslationQueueTab';
import { WorkbenchHeader } from '../src/components/WorkbenchHeader';
import { ManualCard } from '../src/workbench/ManualCard';
import { WorkbenchHubPage } from '../src/workbench/WorkbenchHubPage';
import { ManualListSection } from '../src/workbench/ManualListSection';
import { groupHubManualsByLanguageFamily, buildSessionLanguageEditions } from '../src/workbench/manual-language-families.js';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const USER: IdentityUser = {
  id: 'u-translator-lin',
  displayName: '林知远',
  initials: '林',
  email: 'lin@dita.local',
  color: '#0f766e',
  role: 'writer',
};

const IDENTITY: IdentityResponse = { currentUser: USER, users: [USER] };

const SOURCE_PATH = 'topics/gateway-setup.dita';
const TARGET_PATH = 'topics/gateway-setup.dita';

function makeLink(overrides: Partial<TranslationLinkView> = {}): TranslationLinkView {
  return {
    id: 'link-1',
    sourceManualId: 'manual-src',
    sourceBranch: 'main',
    sourceLang: 'en-US',
    targetManualId: 'manual-zh',
    targetBranch: 'main',
    targetLang: 'zh-CN',
    options: {},
    createdBy: USER.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    sourceManual: {
      id: 'manual-src',
      name: 'Gateway Manual',
      rootDir: '/tmp/gateway',
      exists: true,
      sourceLang: 'en-US',
    },
    targetManual: {
      id: 'manual-zh',
      name: '网关手册',
      rootDir: '/tmp/gateway-zh',
      exists: true,
      sourceLang: 'zh-CN',
    },
    counts: {
      total: 3,
      synced: 1,
      outdated: 1,
      untranslated: 1,
      inQueue: 0,
      inReview: 0,
      draftReady: 0,
      metadataOnly: 1,
      sourceDeleted: 0,
      sourceRenamed: 0,
      progressPercent: 33,
    },
    ...overrides,
  };
}

const ACTIVE_ITEM: TranslationItemView = {
  id: 'item-1',
  jobId: 'job-1',
  linkId: 'link-1',
  sourcePath: SOURCE_PATH,
  targetPath: TARGET_PATH,
  status: 'ready_for_review',
  modeUsed: 'incremental',
  sourceCommit: 'abc1234',
  prevSourceCommit: 'abc0000',
  reviewerId: null,
  reusedSegments: 12,
  translatedSegments: 4,
  retryCount: 0,
  error: null,
  qaErrorCount: 0,
  qaWarningCount: 0,
  updatedAt: '2026-01-03T00:00:00.000Z',
};

function makeFiles(): TranslationFileStateView[] {
  return [
    {
      id: 'f-1',
      linkId: 'link-1',
      sourcePath: SOURCE_PATH,
      targetPath: TARGET_PATH,
      fileKind: 'topic',
      status: 'draft_ready',
      lastSourceCommit: 'abc1234',
      lastSourceBlobHash: 'b1',
      lastSourceTranslatableHash: 'h1',
      lastTargetCommit: 'def5678',
      lastTargetBlobHash: 'b2',
      renamedFromPath: null,
      localizedAssetOverride: false,
      needsHumanReview: false,
      updatedAt: '2026-01-03T00:00:00.000Z',
      activeItem: ACTIVE_ITEM,
    },
    {
      id: 'f-2',
      linkId: 'link-1',
      sourcePath: 'maps/keys.ditamap',
      targetPath: 'maps/keys.ditamap',
      fileKind: 'keydef_map',
      status: 'outdated_metadata_only',
      lastSourceCommit: 'abc1234',
      lastSourceBlobHash: 'b3',
      lastSourceTranslatableHash: null,
      lastTargetCommit: 'def5678',
      lastTargetBlobHash: 'b4',
      renamedFromPath: 'maps/old-keys.ditamap',
      localizedAssetOverride: false,
      needsHumanReview: true,
      updatedAt: '2026-01-03T00:00:00.000Z',
      activeItem: null,
    },
    {
      id: 'f-3',
      linkId: 'link-1',
      sourcePath: 'images/screenshot.png',
      targetPath: 'images/screenshot-zh.png',
      fileKind: 'asset',
      status: 'outdated',
      lastSourceCommit: 'abc1234',
      lastSourceBlobHash: 'b5',
      lastSourceTranslatableHash: null,
      lastTargetCommit: null,
      lastTargetBlobHash: null,
      renamedFromPath: null,
      localizedAssetOverride: true,
      needsHumanReview: false,
      updatedAt: '2026-01-03T00:00:00.000Z',
      activeItem: null,
    },
  ];
}

/**
 * The same matrix with the topic still *in review*.
 *
 * `draft_ready` already owns a target draft, so "apply to target draft" / "apply & check in" are
 * hidden for it; these actions only make sense while the item is still under review.
 */
function inReviewFiles(): TranslationFileStateView[] {
  return makeFiles().map((file) =>
    file.id === 'f-1' ? { ...file, status: 'in_review' as const } : file,
  );
}

/** `f-1` (the only reviewable row) with a draft held by another writer. */
function foreignDraftFiles(): TranslationFileStateView[] {
  return makeFiles().map((file) =>
    file.id === 'f-1'
      ? { ...file, draftOwner: { userId: 'u-admin', userName: 'Admin', isMine: false } }
      : file,
  );
}

const GATEWAY_ENTRY: GlossaryEntryForMatch = {
  termId: 'term-gateway',
  glossaryId: 'glossary-1',
  scope: 'global',
  sourceTerm: 'gateway',
  targetTerm: '网关',
  caseSensitive: false,
  doNotTranslate: false,
  forbiddenTargets: ['闸道'],
  contextNote: 'Product name for the API gateway.',
};

function makeReview(overrides: Partial<TranslationReviewPayload> = {}): TranslationReviewPayload {
  return {
    item: ACTIVE_ITEM,
    link: {
      id: 'link-1',
      sourceManualId: 'manual-src',
      targetManualId: 'manual-zh',
      sourceBranch: 'main',
      targetBranch: 'main',
      sourceLang: 'en-US',
      targetLang: 'zh-CN',
    },
    sourcePath: SOURCE_PATH,
    targetPath: TARGET_PATH,
    sourceXml: '<p>Configure the gateway before deployment.</p>',
    prevSourceXml: '<p>Configure the gateway.</p>',
    targetBaselineXml: '<p>部署前先配置。</p>',
    proposedXml: '<p>Deploy the gateway first.</p><codeblock>keep me</codeblock>',
    segments: [
      {
        segmentId: 'seg-1',
        elementTag: 'p',
        elementId: null,
        structuralPath: 'concept/conbody/p[1]',
        changeKind: 'modified',
        protected: false,
        protectedReason: null,
        currSourceXml: '<p>Configure the gateway before deployment.</p>',
        sourceText: 'Configure the gateway before deployment.',
        prevSourceText: 'Configure the gateway.',
        prevTargetText: '部署前先配置。',
        proposedTargetXml: '<p>Deploy the gateway first.</p>',
        proposedTargetText: 'Deploy the gateway first.',
        glossaryHits: [
          {
            termId: 'term-gateway',
            sourceTerm: 'gateway',
            targetTerm: '网关',
            matchedText: 'gateway',
            doNotTranslate: false,
            caseSensitive: false,
            forbiddenTargets: ['闸道'],
            contextNote: 'Product name for the API gateway.',
          },
        ],
        qaIssues: [],
      },
      {
        segmentId: 'seg-2',
        elementTag: 'codeblock',
        elementId: null,
        structuralPath: 'concept/conbody/codeblock[1]',
        changeKind: 'protected',
        protected: true,
        protectedReason: 'xml:space="preserve"',
        currSourceXml: '<codeblock>keep me</codeblock>',
        sourceText: 'keep me',
        prevSourceText: null,
        prevTargetText: null,
        proposedTargetXml: '<codeblock>keep me</codeblock>',
        proposedTargetText: 'keep me',
        glossaryHits: [],
        qaIssues: [],
      },
      {
        segmentId: 'seg-3',
        elementTag: 'p',
        elementId: null,
        structuralPath: 'concept/conbody/p[2]',
        changeKind: 'added',
        protected: false,
        protectedReason: null,
        currSourceXml: '<p>Restart the service.</p>',
        sourceText: 'Restart the service.',
        prevSourceText: null,
        prevTargetText: null,
        proposedTargetXml: '<p>Restart the service.</p>',
        proposedTargetText: '',
        glossaryHits: [],
        qaIssues: [],
      },
    ],
    glossary: [GATEWAY_ENTRY],
    qaReport: { issues: [], errorCount: 0, warningCount: 0, checkedSegments: 3 },
    lock: {
      userId: USER.id,
      userName: USER.displayName,
      lockedAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      isMine: true,
    },
    canReview: true,
    ...overrides,
  };
}

const GLOSSARY: GlossaryView = {
  id: 'glossary-1',
  scope: 'global',
  manualId: null,
  name: 'Product Terminology',
  description: 'Approved product names.',
  sourceLang: 'en-US',
  enabled: true,
  createdBy: USER.id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  termCount: 1,
};

const TERM: GlossaryTermView = {
  id: 'term-gateway',
  glossaryId: 'glossary-1',
  sourceTerm: 'gateway',
  synonyms: ['API gateway'],
  caseSensitive: false,
  doNotTranslate: false,
  partOfSpeech: 'noun',
  contextNote: 'Product name for the API gateway.',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  translations: [
    {
      id: 'tr-1',
      termId: 'term-gateway',
      targetLang: 'zh-CN',
      targetTerm: '网关',
      forbiddenTargets: ['闸道'],
      notes: null,
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* fetch harness                                                               */
/* -------------------------------------------------------------------------- */

interface FetchCall {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

type FetchHandler = (call: FetchCall) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function emptyStream(): Response {
  return new Response('', { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/** A finite SSE stream — the frames are flushed immediately, then the body closes. */
function eventStream(frames: readonly string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

/** Identity + git chrome so pages that mount the shared identity store stay quiet. */
function chrome(call: FetchCall): Response | null {
  if (call.path === '/api/identity') return json(IDENTITY);
  if (call.path === '/api/git/status') {
    return json({
      initialized: true,
      hasCommits: true,
      rootDir: '/tmp/gateway',
      branch: 'main',
      primaryBranch: 'main',
      ahead: 0,
      behind: 0,
      isClean: true,
      dirtyFiles: [],
      lastCommit: null,
    });
  }
  if (call.path === '/api/git/locks') return json({ locks: [] });
  return null;
}

function installFetch(handler: FetchHandler): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const queryIndex = raw.indexOf('?');
    const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
    const search = queryIndex === -1 ? '' : raw.slice(queryIndex);
    const call: FetchCall = {
      method: (init?.method ?? 'GET').toUpperCase(),
      path,
      search,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
    };
    calls.push(call);
    return handler(call);
  });
  return calls;
}

beforeEach(() => {
  useLocaleStore.setState({ locale: 'en' });
  useTranslationStore.getState().reset();
  useGitStore.setState({ identity: IDENTITY, currentUser: USER });
  // Navigation assertions read the real jsdom URL, so every test starts from the hub.
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  useTranslationStore.getState().reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* 1. Router                                                                   */
/* -------------------------------------------------------------------------- */

describe('Phase 16 router', () => {
  it('parses the translation center with branch, link and tab', () => {
    expect(
      parseRoute(
        'http://dita.local/manuals/manual-src/translation?branch=release%2F2.0&link=link-1&tab=queue',
      ),
    ).toEqual({
      name: 'translation-center',
      manualId: 'manual-src',
      branch: 'release/2.0',
      linkId: 'link-1',
      tab: 'queue',
    });
  });

  it('defaults absent link/tab/branch to null and rejects unknown tabs', () => {
    expect(parseRoute('http://dita.local/manuals/manual-src/translation')).toEqual({
      name: 'translation-center',
      manualId: 'manual-src',
      branch: null,
      linkId: null,
      tab: null,
    });
    expect(parseRoute('http://dita.local/manuals/m1/translation?tab=nope')).toMatchObject({
      name: 'translation-center',
      tab: null,
    });
  });

  it('parses the bilingual review route before the plain manual route', () => {
    expect(parseRoute('http://dita.local/manuals/m1/translation/review/item-1?branch=main')).toEqual({
      name: 'translation-review',
      manualId: 'm1',
      itemId: 'item-1',
      branch: 'main',
    });
    // `/manuals/:id` keeps behaving exactly as Phase 10 described.
    expect(parseRoute('http://dita.local/manuals/m1')).toEqual({
      name: 'editor',
      manualId: 'm1',
      branch: null,
      topicPath: null,
      assignmentId: null,
    });
  });

  it('parses the glossary route and round-trips every builder', () => {
    expect(parseRoute('http://dita.local/glossaries')).toEqual({
      name: 'glossaries',
      glossaryId: null,
    });
    expect(parseRoute('http://dita.local/glossaries?glossary=g-1')).toEqual({
      name: 'glossaries',
      glossaryId: 'g-1',
    });

    const center = new URL(
      translationCenterPath('manual src', { branch: 'release/2.0', linkId: 'link 1', tab: 'glossary' }),
      'http://dita.local',
    );
    expect(parseRoute(center.toString())).toEqual({
      name: 'translation-center',
      manualId: 'manual src',
      branch: 'release/2.0',
      linkId: 'link 1',
      tab: 'glossary',
    });

    const review = new URL(bilingualReviewPath('m1', 'item 1', { branch: 'main' }), 'http://dita.local');
    expect(parseRoute(review.toString())).toEqual({
      name: 'translation-review',
      manualId: 'm1',
      itemId: 'item 1',
      branch: 'main',
    });

    expect(parseRoute(new URL(glossariesPath('g 1'), 'http://dita.local').toString())).toEqual({
      name: 'glossaries',
      glossaryId: 'g 1',
    });
    expect(new URL(hubPath(), 'http://dita.local').pathname).toBe('/');
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Translation Center                                                       */
/* -------------------------------------------------------------------------- */

describe('TranslationCenterPage', () => {
  function renderCenter(tab: 'files' | 'queue' | 'settings' = 'files') {
    return render(
      <TranslationCenterPage
        manualId="manual-src"
        manualName="Gateway Manual"
        manualSourceLang="en-US"
        branch="main"
        linkId={null}
        tab={tab}
      />,
    );
  }

  function baseHandler(call: FetchCall): Response {
    const fromChrome = chrome(call);
    if (fromChrome) return fromChrome;
    if (call.path === '/api/translation/links' && call.method === 'GET') {
      return json({ links: [makeLink()] });
    }
    if (call.path === '/api/translation/links/link-1/files') {
      return json({ files: makeFiles(), counts: makeLink().counts });
    }
    if (call.path === '/api/translation/links/link-1/scan') {
      return json({
        summary: {
          sourceCommit: 'abc1234',
          targetCommit: 'def5678',
          total: 3,
          created: 1,
          updated: 2,
          removed: 0,
          renames: 0,
          deleted: 0,
          counts: makeLink().counts,
        },
        files: makeFiles(),
      });
    }
    if (call.path === '/api/translation/jobs' && call.method === 'POST') {
      const job: TranslationJobView = {
        id: 'job-2',
        linkId: 'link-1',
        userId: USER.id,
        mode: 'incremental',
        status: 'queued',
        sourceCommit: 'abc1234',
        totalItems: 1,
        completedItems: 0,
        failedItems: 0,
        cancelRequested: false,
        createdAt: '2026-01-04T00:00:00.000Z',
        startedAt: null,
        finishedAt: null,
      };
      return json({ job, items: [{ ...ACTIVE_ITEM, id: 'item-2', jobId: 'job-2' }] }, 201);
    }
    if (call.path.endsWith('/stream')) return emptyStream();
    if (call.path === '/api/translation/jobs') {
      const queued: TranslationJobView = {
        id: 'job-1',
        linkId: 'link-1',
        userId: USER.id,
        mode: 'incremental',
        status: 'running',
        sourceCommit: 'abc1234',
        totalItems: 3,
        completedItems: 1,
        failedItems: 0,
        cancelRequested: false,
        createdAt: '2026-01-04T00:00:00.000Z',
        startedAt: '2026-01-04T00:00:05.000Z',
        finishedAt: null,
      };
      return json({ jobs: [queued] });
    }
    if (/^\/api\/translation\/jobs\/[^/]+$/.test(call.path)) {
      return json({
        job: {
          id: 'job-1',
          linkId: 'link-1',
          userId: USER.id,
          mode: 'incremental',
          status: 'running',
          sourceCommit: 'abc1234',
          totalItems: 3,
          completedItems: 1,
          failedItems: 0,
          cancelRequested: false,
          createdAt: '2026-01-04T00:00:00.000Z',
          startedAt: '2026-01-04T00:00:05.000Z',
          finishedAt: null,
        },
        items: [ACTIVE_ITEM],
      });
    }
    return json({});
  }

  it('renders the language pair pill, the three workspace scopes and the file matrix', async () => {
    installFetch(baseHandler);
    renderCenter();

    expect(await screen.findByTestId('translation-link-link-1')).toBeTruthy();
    const pill = screen.getByTestId('translation-link-link-1');
    expect(pill.textContent).toContain('zh-CN');
    expect(pill.textContent).toContain('33%');
    // The source language now lives in the lineage breadcrumb instead of the target pill.
    expect(screen.getByTestId('translation-lineage-breadcrumb').textContent).toContain(
      'en-US → zh-CN',
    );

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));

    // Docs is the default scope: only the topic row is listed, and one of each scope tab exists.
    expect(within(tab).getByTestId('translation-files-scope-docs')).toBeTruthy();
    expect(within(tab).getByTestId('translation-files-scope-assets')).toBeTruthy();
    expect(within(tab).getByTestId('translation-files-scope-structure')).toBeTruthy();
    expect(within(tab).queryAllByText('maps/keys.ditamap')).toHaveLength(0);
    expect(
      within(tab).getAllByText(translate('translation.fileStatus.draft_ready')).length,
    ).toBeGreaterThan(0);
    // only the file with an active item offers "Open Review"
    expect(within(tab).getAllByText(translate('translation.files.openReview'))).toHaveLength(1);

    // Structure scope carries the metadata-only keydef map plus its contextual guidance.
    fireEvent.click(within(tab).getByTestId('translation-files-scope-structure'));
    await waitFor(() =>
      expect(within(tab).getAllByText('maps/keys.ditamap').length).toBeGreaterThan(0),
    );
    expect(
      within(tab).getAllByText(translate('translation.fileKind.keydef_map')).length,
    ).toBeGreaterThan(0);
    expect(within(tab).getByText(translate('translation.files.needsHumanReview'))).toBeTruthy();
    expect(
      within(tab).getAllByText(translate('translation.fileStatus.outdated_metadata_only')).length,
    ).toBeGreaterThan(0);
    expect(within(tab).getByText(translate('translation.scope.guidance.structure'))).toBeTruthy();

    // Assets scope carries the localized screenshot with its override hint.
    fireEvent.click(within(tab).getByTestId('translation-files-scope-assets'));
    await waitFor(() =>
      expect(within(tab).getAllByText('images/screenshot.png').length).toBeGreaterThan(0),
    );
    expect(within(tab).getByText(translate('translation.files.assetOverride'))).toBeTruthy();
    expect(within(tab).getByText(translate('translation.scope.guidance.assets'))).toBeTruthy();
  });

  it('scans incremental changes and reports the summary', async () => {
    const calls = installFetch(baseHandler);
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    const scan = await screen.findByTestId('translation-files-scan');
    fireEvent.click(scan);

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'POST' && call.path === '/api/translation/links/link-1/scan'),
      ).toBe(true),
    );
    expect(
      await within(tab).findByText(
        translate('translation.scenario.scanSummary', {
          created: 1,
          updated: 2,
          removed: 0,
          renames: 0,
        }),
      ),
    ).toBeTruthy();
  });

  it('enqueues an incremental job for the selected untranslated document', async () => {
    // A draft-ready row is not translatable any more, so swap it for a genuinely pending topic.
    const pending = makeFiles().map((file) =>
      file.id === 'f-1'
        ? { ...file, status: 'untranslated' as const, activeItem: null, localizedAssetOverride: false }
        : file,
    );
    const calls = installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: pending, counts: makeLink().counts });
      }
      return baseHandler(call);
    });
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));

    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH })),
    );

    const actionBar = await within(tab).findByText(translate('translation.files.selected', { count: 1 }));
    expect(actionBar).toBeTruthy();
    fireEvent.click(
      within(tab).getByRole('button', { name: translate('translation.batch.translate', { count: 1 }) }),
    );

    await waitFor(() => expect(calls.some((call) => call.path === '/api/translation/jobs')).toBe(true));
    const enqueueCall = calls.find(
      (call) => call.path === '/api/translation/jobs' && call.method === 'POST',
    );
    expect(enqueueCall?.body).toEqual({
      linkId: 'link-1',
      paths: [SOURCE_PATH],
      mode: 'incremental',
    });
  });

  it('batch applies the selected files to target drafts and shows the summary', async () => {
    const handler: FetchHandler = (call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: inReviewFiles(), counts: makeLink().counts });
      }
      if (call.path === '/api/translation/links/link-1/batch-apply-draft') {
        return json({
          applied: [{ itemId: ACTIVE_ITEM.id, sourcePath: SOURCE_PATH, targetPath: TARGET_PATH }],
          skippedLocked: [],
          skippedInvalid: [],
          skippedNoProposal: ['maps/keys.ditamap'],
        });
      }
      return baseHandler(call);
    };
    const calls = installFetch(handler);
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));

    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH })),
    );

    const apply = await within(tab).findByTestId('translation-files-batch-apply');
    expect(apply.textContent).toContain(translate('translation.files.batchApplyDraft'));
    fireEvent.click(apply);

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' && call.path === '/api/translation/links/link-1/batch-apply-draft',
        ),
      ).toBe(true),
    );
    const applyCall = calls.find(
      (call) =>
        call.method === 'POST' && call.path === '/api/translation/links/link-1/batch-apply-draft',
    );
    expect(applyCall?.body).toEqual({ paths: [SOURCE_PATH] });

    expect(
      await within(tab).findByText(
        translate('translation.files.batchApplyDone', { applied: 1, locked: 0, skipped: 1 }),
      ),
    ).toBeTruthy();

    // The refresh must hit *this* link only: the unfiltered list would drag every other manual's
    // links into `state.links` and print duplicate language pills in the center header.
    await waitFor(() =>
      expect(
        calls.filter((call) => call.method === 'GET' && call.path === '/api/translation/links/link-1'),
      ).not.toHaveLength(0),
    );
    const linkListReads = calls.filter(
      (call) => call.method === 'GET' && call.path === '/api/translation/links',
    );
    expect(linkListReads).toHaveLength(1);
  });

  it('offers apply actions for in-review files but never for draft-ready files', async () => {
    installFetch(baseHandler);
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));
    const rowCheckbox = () =>
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH }));

    // `f-1` is draft_ready in the default matrix: check-in is legal, apply is not.
    fireEvent.click(rowCheckbox());
    await within(tab).findByTestId('translation-files-batch-bar');
    expect(within(tab).queryByTestId('translation-files-batch-apply')).toBeNull();
    expect(within(tab).queryByTestId('translation-batch-apply-and-checkin')).toBeNull();
    expect(within(tab).getByTestId('translation-batch-checkin')).toBeTruthy();
    fireEvent.click(within(tab).getByText(translate('translation.files.clearSelection')));

    cleanup();
    installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: inReviewFiles(), counts: makeLink().counts });
      }
      return baseHandler(call);
    });
    renderCenter();

    const reviewTab = await screen.findByTestId('translation-files-tab');
    await waitFor(() =>
      expect(within(reviewTab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0),
    );
    fireEvent.click(
      within(reviewTab).getByLabelText(
        translate('translation.files.selectRow', { path: SOURCE_PATH }),
      ),
    );
    expect(await within(reviewTab).findByTestId('translation-files-batch-apply')).toBeTruthy();
    expect(within(reviewTab).getByTestId('translation-batch-apply-and-checkin')).toBeTruthy();
    expect(within(reviewTab).queryByTestId('translation-batch-checkin')).toBeNull();
  });

  it('shows the foreign draft owner instead of a check-in button nobody can use', async () => {
    installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: foreignDraftFiles(), counts: makeLink().counts });
      }
      return baseHandler(call);
    });
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));

    expect(
      within(tab).getByTestId('translation-foreign-draft-badge-f-1').textContent,
    ).toContain(translate('translation.files.foreignDraftBadge', { owner: 'Admin' }));
    // No per-row check-in, but the review link stays available.
    expect(within(tab).queryByTestId('translation-row-action-checkin-f-1')).toBeNull();
    expect(within(tab).getByTestId('translation-row-action-open_review-f-1')).toBeTruthy();

    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH })),
    );
    expect(await within(tab).findByTestId('translation-batch-foreign-drafts')).toBeTruthy();
    expect(within(tab).queryByTestId('translation-batch-checkin')).toBeNull();
    expect(
      within(tab).getByTestId('translation-batch-foreign-drafts').textContent,
    ).toContain(
      translate('translation.batch.foreignDraftsHint', { count: 1, owners: 'Admin' }),
    );
  });

  it('opens the status legend from the column header and closes it with Escape', async () => {
    installFetch(baseHandler);
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));

    expect(within(tab).queryByTestId('translation-status-legend')).toBeNull();
    fireEvent.click(within(tab).getByTestId('translation-status-legend-button'));

    const legend = await within(tab).findByTestId('translation-status-legend');
    expect(legend.textContent).toContain(translate('translation.statusLegend.title'));
    expect(legend.textContent).toContain(translate('translation.statusLegend.group.todo'));
    expect(legend.textContent).toContain(translate('translation.statusLegend.group.checkin'));
    expect(legend.textContent).toContain(translate('translation.statusDesc.draft_ready'));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(within(tab).queryByTestId('translation-status-legend')).toBeNull());
  });

  it('treats a foreign-only draft batch as a preview, not a check-in', async () => {
    installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: foreignDraftFiles(), counts: makeLink().counts });
      }
      if (call.path === '/api/translation/jobs' && call.method === 'GET') return json({ jobs: [] });
      return baseHandler(call);
    });
    renderCenter();

    const banner = await screen.findByTestId('translation-scenario-banner');
    await waitFor(() => expect(banner.getAttribute('data-scenario')).toBe('draft_ready'));
    expect(
      within(banner).getByText(
        translate('translation.scenario.foreignDraft.title', { count: 1, owners: 'Admin' }),
      ),
    ).toBeTruthy();
    expect(within(banner).getByTestId('translation-scenario-primary').textContent).toContain(
      translate('translation.scenario.foreignDraft.cta'),
    );
    expect(within(banner).queryByTestId('translation-scenario-secondary')).toBeNull();
  });

  it('shows the queue tab for the selected language pair', async () => {
    installFetch(baseHandler);
    renderCenter('queue');

    const queue = await screen.findByTestId('translation-queue-tab');
    expect(queue.textContent).toContain(SOURCE_PATH);
  });

  it('returns to the editor from the header back button', async () => {
    installFetch(baseHandler);
    renderCenter();

    const back = await screen.findByTestId('translation-back-to-editor');
    expect(back.textContent).toContain(translate('translation.backToEditor'));

    fireEvent.click(back);

    const target = new URL(editorPath('manual-src', { branch: 'main' }), 'http://dita.local');
    expect(window.location.pathname).toBe(target.pathname);
    expect(window.location.search).toBe(target.search);
  });

  it('opens a target edition from the language pair pill without switching pairs', async () => {
    const second = makeLink({
      id: 'link-2',
      targetManualId: 'manual-fr',
      targetBranch: 'fr',
      targetLang: 'fr-FR',
    });
    installFetch((call) => {
      if (call.path === '/api/translation/links' && call.method === 'GET') {
        return json({ links: [makeLink(), second] });
      }
      return baseHandler(call);
    });
    renderCenter();

    const first = await screen.findByTestId('translation-link-link-1');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('translation-link-link-2').getAttribute('aria-pressed')).toBe('false');

    const open = screen.getByTestId('translation-link-open-editor-link-1');
    // The tree row keeps its actions icon-only so depth stays readable; the label moves to ARIA.
    expect(open.getAttribute('aria-label')).toBe(
      translate('translation.openTargetInEditorTitle', { lang: 'zh-CN' }),
    );
    expect(open.getAttribute('title')).toBe(
      translate('translation.openTargetInEditorTitle', { lang: 'zh-CN' }),
    );

    fireEvent.click(open);

    // Opening the edition is a navigation; the pill selection is untouched.
    expect(screen.getByTestId('translation-link-link-1').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('translation-link-link-2').getAttribute('aria-pressed')).toBe('false');
    const target = new URL(
      editorPath('manual-zh', { branch: 'main' }),
      'http://dita.local',
    );
    expect(window.location.pathname).toBe(target.pathname);
    expect(window.location.search).toBe(target.search);
  });

  it('disables the pill action when the target edition is missing', async () => {
    const missing = makeLink({
      id: 'link-missing',
      targetManual: {
        id: 'manual-zh',
        name: '网关手册',
        rootDir: '/tmp/gateway-zh',
        exists: false,
        sourceLang: 'zh-CN',
      },
    });
    installFetch((call) => {
      if (call.path === '/api/translation/links' && call.method === 'GET') {
        return json({ links: [missing] });
      }
      if (call.path === '/api/translation/links/link-missing/files') {
        return json({ files: makeFiles(), counts: missing.counts });
      }
      return baseHandler(call);
    });
    renderCenter();

    const open = await screen.findByTestId('translation-link-open-editor-link-missing');
    expect((open as HTMLButtonElement).disabled).toBe(true);
    expect(open.getAttribute('aria-label')).toBe(
      translate('translation.openTargetInEditorTitle', { lang: 'zh-CN' }),
    );
  });

  it('mirrors the editor chrome: segmented tabs and the Settings popover', async () => {
    installFetch(baseHandler);
    renderCenter();

    // The four primary destinations live in one segmented switch, exactly like the workbench header.
    const filesTab = await screen.findByTestId('translation-tab-files');
    expect(filesTab.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('translation-tab-queue')).toBeTruthy();
    expect(screen.getByTestId('translation-tab-glossary')).toBeTruthy();
    expect(screen.getByTestId('translation-tab-settings')).toBeTruthy();
    expect(filesTab.textContent).toContain(translate('translation.tab.files'));

    // Identity, locale and the help centre are reachable from the gear, not from loose header chips.
    const menu = screen.getByTestId('translation-settings-menu-button');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    const panel = await screen.findByTestId('translation-settings-menu');
    expect(panel.getAttribute('role')).toBe('menu');
    expect(within(panel).getByText(translate('header.settings.identity'))).toBeTruthy();
    expect(within(panel).getByText(translate('header.settings.language'))).toBeTruthy();
    expect(within(panel).getByText(translate('header.settings.help'))).toBeTruthy();
    expect(within(panel).getAllByRole('combobox').length).toBeGreaterThan(0);

    // Escape closes it again without leaving the page.
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('translation-settings-menu')).toBeNull());
    expect(screen.getByTestId('translation-files-tab')).toBeTruthy();
  });

  it('marks the queue tab while a job is live and keeps a single active segment', async () => {
    installFetch(baseHandler);
    renderCenter();

    const queueTab = await screen.findByTestId('translation-tab-queue');
    await waitFor(() => expect(within(queueTab).getByTestId('translation-tab-live-dot')).toBeTruthy());
    expect(screen.getByTestId('translation-tab-files').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(queueTab);
    await waitFor(() =>
      expect(window.location.search).toContain(`tab=${encodeURIComponent('queue')}`),
    );
  });

  it('runs the five-stage pipeline and reports counts for the active workspace scope', async () => {
    installFetch(baseHandler);
    renderCenter();

    const pipeline = await screen.findByTestId('translation-pipeline-bar');
    for (const stage of ['todo', 'translating', 'review', 'synced'] as const) {
      const button = within(pipeline).getByTestId(`translation-pipeline-${stage}`);
      expect(button.textContent).toContain(translate(`translation.pipeline.${stage}`));
      expect(button.textContent).toContain('0');
    }
    // Docs scope holds exactly one draft-ready topic, so `checkin` is the only populated stage.
    const checkin = within(pipeline).getByTestId('translation-pipeline-checkin');
    expect(checkin.textContent).toContain(translate('translation.pipeline.checkin'));
    expect(checkin.textContent).toContain('1');
    expect(within(pipeline).getByTestId('translation-pipeline-all').textContent).toContain('1');

    fireEvent.click(checkin);
    await waitFor(() =>
      expect(within(pipeline).getByTestId('translation-pipeline-checkin').getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
    expect(screen.getByText(translate('translation.pipeline.hint.checkin'))).toBeTruthy();
  });

  it('never offers AI translation for assets and explains the two-path SVG workflow', async () => {
    const assetFiles = [
      {
        ...makeFiles()[2]!,
        id: 'f-svg',
        sourcePath: 'images/flow.svg',
        targetPath: 'images/flow.svg',
        localizedAssetOverride: false,
      },
      { ...makeFiles()[2]!, id: 'f-kept' },
    ];
    installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: assetFiles, counts: makeLink().counts });
      }
      if (call.path === '/api/translation/jobs' && call.method === 'GET') {
        return json({ jobs: [] });
      }
      return baseHandler(call);
    });
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    fireEvent.click(within(tab).getByTestId('translation-files-scope-assets'));

    const row = await within(tab).findByTestId('translation-file-row-f-svg');
    expect(within(row).getByText(translate('translation.row.svgKind'))).toBeTruthy();
    expect(within(row).queryByText(translate('translation.row.aiTranslate'))).toBeNull();
    expect(within(tab).queryByText(translate('translation.row.aiTranslate'))).toBeNull();
    // A plain SVG is reused verbatim, and the hint explains why AI is not involved.
    expect(within(row).getByText(translate('translation.row.hint.svg'))).toBeTruthy();
    expect(within(row).getByTestId('translation-row-action-sync_asset-f-svg')).toBeTruthy();
    // A localized override keeps its own version instead of being overwritten.
    expect(
      within(tab).getByTestId('translation-row-action-keep_local_version-f-kept'),
    ).toBeTruthy();

    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: 'images/flow.svg' })),
    );
    await within(tab).findByText(translate('translation.files.selected', { count: 1 }));
    expect(within(tab).queryByText(translate('translation.batch.translate', { count: 1 }))).toBeNull();
    expect(
      within(tab).getByRole('button', { name: translate('translation.batch.reuseSource', { count: 1 }) }),
    ).toBeTruthy();
  });

  it('streams job progress inline on the Files tab without switching to the queue', async () => {
    const frames = [
      `event: job.updated\ndata: ${JSON.stringify({
        id: 'job-1',
        linkId: 'link-1',
        status: 'running',
        mode: 'incremental',
        sourceCommit: 'abc1234',
        totalItems: 4,
        completedItems: 3,
        failedItems: 0,
        cancelRequested: false,
        createdAt: '2026-01-03T00:00:00.000Z',
        startedAt: '2026-01-03T00:00:01.000Z',
        finishedAt: null,
      })}\n\n`,
    ];
    installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: makeFiles(), counts: makeLink().counts });
      }
      if (call.path === '/api/translation/jobs' && call.method === 'GET') {
        return json({
          jobs: [
            {
              id: 'job-1',
              linkId: 'link-1',
              status: 'running',
              mode: 'incremental',
              sourceCommit: 'abc1234',
              totalItems: 4,
              completedItems: 1,
              failedItems: 0,
              cancelRequested: false,
              createdAt: '2026-01-03T00:00:00.000Z',
              startedAt: '2026-01-03T00:00:01.000Z',
              finishedAt: null,
            },
          ],
        });
      }
      if (call.path.endsWith('/stream')) return eventStream(frames);
      return baseHandler(call);
    });
    renderCenter();

    const banner = await screen.findByTestId('translation-scenario-banner');
    expect(banner.getAttribute('data-scenario')).toBe('running_job');
    await waitFor(() =>
      expect(
        within(banner).getByText(
          translate('translation.scenario.runningJob.progress', { done: 3, total: 4 }),
        ),
      ).toBeTruthy(),
    );
    // The Files tab stays mounted: no navigation to the queue happened.
    expect(screen.getByTestId('translation-files-tab')).toBeTruthy();
    expect(window.location.search).not.toContain('tab=queue');
  });

  it('auto-scans once on the first visit so an empty link never looks broken', async () => {
    const emptyCounts = {
      ...makeLink().counts,
      total: 0,
      synced: 0,
      outdated: 0,
      untranslated: 0,
      metadataOnly: 0,
      draftReady: 0,
      progressPercent: 0,
    };
    const calls = installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: [], counts: emptyCounts });
      }
      if (call.path === '/api/translation/jobs' && call.method === 'GET') return json({ jobs: [] });
      if (call.path === '/api/translation/links/link-1/scan') {
        return json({
          summary: {
            sourceCommit: 'abc1234',
            targetCommit: 'def5678',
            total: 1,
            created: 1,
            updated: 0,
            removed: 0,
            renames: 0,
            deleted: 0,
            counts: { ...emptyCounts, total: 1, untranslated: 1 },
          },
          files: [
            {
              ...makeFiles()[0]!,
              status: 'untranslated' as const,
              activeItem: null,
            },
          ],
        });
      }
      return baseHandler(call);
    });
    renderCenter();

    await waitFor(() =>
      expect(
        calls.filter(
          (call) => call.method === 'POST' && call.path === '/api/translation/links/link-1/scan',
        ),
      ).toHaveLength(1),
    );
    // The scan result lands in the matrix without a manual click.
    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));
  });

  it('chains accept-and-check-in behind an editable commit message', async () => {
    const calls = installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: inReviewFiles(), counts: makeLink().counts });
      }
      if (call.path === '/api/translation/links/link-1/batch-apply-draft') {
        return json({
          applied: [{ itemId: 'item-1', sourcePath: SOURCE_PATH, targetPath: TARGET_PATH }],
          skippedLocked: [],
          skippedInvalid: [],
          skippedNoProposal: [],
        });
      }
      if (call.path === '/api/translation/links/link-1/batch-checkin') {
        return json({
          commit: {
            hash: 'fff1111',
            shortHash: 'fff111',
            message: 'translate',
            author: 'Ada',
            date: '2026-01-04T00:00:00.000Z',
          },
          checkedInPaths: [SOURCE_PATH],
          syncedFiles: [SOURCE_PATH],
        });
      }
      return baseHandler(call);
    });
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));
    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH })),
    );

    fireEvent.click(
      await within(tab).findByTestId('translation-batch-apply-and-checkin'),
    );
    const form = await within(tab).findByTestId('translation-files-checkin-form');
    const input = within(form).getByLabelText(translate('translation.batch.checkinMessage')) as HTMLInputElement;
    const prefilled = translate('translation.batch.defaultMessage', {
      count: 1,
      date: new Date().toISOString().slice(0, 10),
    });
    expect(input.value).toBe(prefilled);

    fireEvent.change(input, { target: { value: 'chore: ship gateway zh' } });
    fireEvent.click(within(form).getByRole('button', { name: translate('translation.batch.checkinConfirm') }));

    await waitFor(() =>
      expect(
        calls.filter((call) => call.path === '/api/translation/links/link-1/batch-checkin'),
      ).toHaveLength(1),
    );
    const applyIndex = calls.findIndex((call) => call.path.endsWith('/batch-apply-draft'));
    const checkinCall = calls.find((call) => call.path.endsWith('/batch-checkin'));
    expect(applyIndex).toBeGreaterThan(-1);
    expect(calls.indexOf(checkinCall!)).toBeGreaterThan(applyIndex);
    // `batch-checkin` matches target paths, so the apply result — not the source selection —
    // decides what gets committed.
    expect(checkinCall?.body).toEqual({ paths: [TARGET_PATH], message: 'chore: ship gateway zh' });
  });

  it('only passes the actually applied paths to batch-check-in and skips it on an empty apply', async () => {
    const calls = installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: inReviewFiles(), counts: makeLink().counts });
      }
      if (call.path === '/api/translation/links/link-1/batch-apply-draft') {
        return json({
          applied: [],
          skippedLocked: [{ path: SOURCE_PATH, itemId: 'item-1', reason: 'locked' }],
          skippedInvalid: [],
          skippedNoProposal: [],
        });
      }
      return baseHandler(call);
    });
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));
    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH })),
    );
    fireEvent.click(await within(tab).findByTestId('translation-batch-apply-and-checkin'));
    const form = await within(tab).findByTestId('translation-files-checkin-form');
    const input = within(form).getByLabelText(translate('translation.batch.checkinMessage')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'chore: nothing to ship' } });
    fireEvent.click(
      within(form).getByRole('button', { name: translate('translation.batch.checkinConfirm') }),
    );

    await waitFor(() =>
      expect(calls.filter((call) => call.path.endsWith('/batch-apply-draft'))).toHaveLength(1),
    );
    // An empty apply must not be turned into a "nothing to check in" API error.
    expect(calls.filter((call) => call.path.endsWith('/batch-checkin'))).toHaveLength(0);
    await waitFor(() =>
      expect(
        within(tab).getByText(
          translate('translation.files.batchApplyEmpty', { locked: 1, skipped: 0 }),
        ),
      ).toBeTruthy(),
    );
  });

  it('reports drafts that were already in the baseline instead of pretending to commit', async () => {
    const calls = installFetch((call) => {
      if (call.path === '/api/translation/links/link-1/batch-checkin') {
        // Every selected draft matched `HEAD`, so the server closed them as synced without a commit.
        return json({
          commit: null,
          checkedInPaths: [],
          syncedFiles: [TARGET_PATH],
          alreadySyncedPaths: [TARGET_PATH],
        });
      }
      return baseHandler(call);
    });
    renderCenter();

    const tab = await screen.findByTestId('translation-files-tab');
    await waitFor(() => expect(within(tab).getAllByText(SOURCE_PATH).length).toBeGreaterThan(0));
    fireEvent.click(
      within(tab).getByLabelText(translate('translation.files.selectRow', { path: SOURCE_PATH })),
    );
    fireEvent.click(await within(tab).findByTestId('translation-batch-checkin'));
    const form = await within(tab).findByTestId('translation-files-checkin-form');
    const input = within(form).getByLabelText(
      translate('translation.batch.checkinMessage'),
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'chore: already translated' } });
    fireEvent.click(
      within(form).getByRole('button', { name: translate('translation.batch.checkinConfirm') }),
    );

    await waitFor(() =>
      expect(calls.filter((call) => call.path.endsWith('/batch-checkin'))).toHaveLength(1),
    );
    // No commit hash exists, so the feedback must never claim a check-in happened.
    await waitFor(() =>
      expect(
        within(tab).getByText(translate('translation.files.alreadySynced', { count: 1 })),
      ).toBeTruthy(),
    );
  });

  it('offers the recommended draft-ready scenario with a check-in shortcut', async () => {
    installFetch((call) => {
      if (call.path === '/api/translation/jobs' && call.method === 'GET') return json({ jobs: [] });
      return baseHandler(call);
    });
    renderCenter();

    const banner = await screen.findByTestId('translation-scenario-banner');
    await waitFor(() => expect(banner.getAttribute('data-scenario')).toBe('draft_ready'));
    expect(
      within(banner).getByText(translate('translation.scenario.draftReady.title', { count: 1 })),
    ).toBeTruthy();
    expect(within(banner).getByText(translate('translation.scenario.draftReady.body'))).toBeTruthy();
    expect(within(banner).getByTestId('translation-scenario-primary').textContent).toContain(
      translate('translation.scenario.draftReady.cta', { count: 1 }),
    );
    expect(within(banner).getByTestId('translation-scenario-secondary')).toBeTruthy();
    expect(within(banner).getByTestId('translation-files-scan')).toBeTruthy();
  });
});

/* -------------------------------------------------------------------------- */
/* 2b. Hub card & editor header entry points                                   */
/* -------------------------------------------------------------------------- */

describe('translation entry points', () => {
  function renderCard(overrides: { offline?: boolean } = {}) {
    return render(
      <ManualCard
        manual={makeHubManual({ id: 'manual-card' })}
        busy={false}
        canManage={false}
        offline={overrides.offline}
        onOpen={() => {}}
        onEdit={() => {}}
        onToggleArchive={() => {}}
        onRemove={() => {}}
      />,
    );
  }

  function headerProps(overrides: Partial<ComponentProps<typeof WorkbenchHeader>> = {}) {
    return {
      showBrand: false,
      activeTab: null,
      mode: 'visual' as const,
      xmlError: null,
      leftSidebarOpen: true,
      problemsOpen: false,
      errorCount: 0,
      warningCount: 0,
      dirtyCount: 0,
      identity: IDENTITY,
      currentUser: USER,
      onSwitchIdentity: () => {},
      onToggleLeftSidebar: () => {},
      onChangeMode: () => {},
      onToggleProblems: () => {},
      showInspectorExpand: false,
      onExpandInspector: () => {},
      translationLinkCount: 0,
      ...overrides,
    };
  }

  it('no longer offers a translation-center button on the hub manual card', () => {
    renderCard();

    // The translation center now lives in the editor header, so the card keeps one primary action.
    expect(screen.queryByTestId('manual-translations-manual-card')).toBeNull();
    expect(screen.queryByText(translate('translation.entry.translations'))).toBeNull();
    expect(screen.getByTestId('manual-open-manual-card')).toBeTruthy();
  });

  it('still accepts the offline flag that used to hide the card button', () => {
    renderCard({ offline: true });

    expect(screen.queryByTestId('manual-translations-manual-card')).toBeNull();
    expect(screen.getByTestId('manual-open-manual-card')).toBeTruthy();
  });

  it('always shows the header translation capsule, even with no target language yet', () => {
    const onOpen = vi.fn();
    render(
      <WorkbenchHeader {...headerProps({ translationLinkCount: 0, onOpenTranslations: onOpen })} />,
    );

    const capsule = screen.getByTestId('header-translation-capsule');
    expect(capsule.textContent).toContain(translate('translation.entry.translations'));
    // A zero count must never render as "Translations 0".
    expect(capsule.textContent).not.toContain('0');
    expect(capsule.getAttribute('title')).toBe(translate('translation.entry.translationsTitle'));

    // The capsule is a picker now: it opens the language menu instead of navigating away.
    fireEvent.click(capsule);
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('header-language-menu')).toBeTruthy();

    fireEvent.click(screen.getByTestId('header-translation-center-action'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('labels the header capsule with the pair count once targets exist', () => {
    render(<WorkbenchHeader {...headerProps({ translationLinkCount: 2, onOpenTranslations: () => {} })} />);

    const capsule = screen.getByTestId('header-translation-capsule');
    expect(capsule.textContent).toContain(
      translate('translation.entry.versionCount', { count: 2 }),
    );
    // With no edition list the tooltip still advertises managing versions, not switching.
    expect(capsule.getAttribute('title')).toBe(
      translate('translation.entry.translationsTitle'),
    );
  });

  it('switches language editions from the header and marks the base language', () => {
    const onSelect = vi.fn();
    render(
      <WorkbenchHeader
        {...headerProps({
          translationLinkCount: 1,
          onOpenTranslations: () => {},
          languageEditions: [
            {
              lang: 'zh-CN',
              manualId: 'manual-src',
              branch: 'main',
              manualName: '网关手册',
              isBase: true,
              exists: true,
              isCurrent: true,
              progressPercent: null,
            },
            {
              lang: 'en-US',
              manualId: 'manual-en',
              branch: 'main',
              manualName: 'Gateway Manual',
              isBase: false,
              exists: true,
              isCurrent: false,
              progressPercent: 42,
            },
          ],
          onSelectLanguageEdition: onSelect,
        })}
      />,
    );

    expect(screen.getByTestId('header-translation-capsule').textContent).toContain('zh-CN');
    expect(screen.getByTestId('header-translation-capsule').getAttribute('title')).toBe(
      translate('translation.entry.capsuleTitle'),
    );
    fireEvent.click(screen.getByTestId('header-translation-capsule'));

    const base = screen.getByTestId('header-language-edition-zh-CN');
    expect(base.getAttribute('data-base')).toBe('true');
    expect(base.getAttribute('aria-checked')).toBe('true');
    expect(base.textContent).toContain(translate('translation.entry.baseBadge'));
    // The base edition is the source of truth, so it is labelled even when it is not current.
    expect(base.getAttribute('data-base')).toBe('true');
    // The edition you are already in is not a click target; the other one switches session.
    expect((base as HTMLButtonElement).disabled).toBe(true);

    const target = screen.getByTestId('header-language-edition-en-US');
    expect(target.textContent).toContain(translate('translation.progressPercent', { percent: 42 }));
    fireEvent.click(target);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ lang: 'en-US', isBase: false }));
    // The menu closes on selection so it cannot hover over the next session's canvas.
    expect(screen.queryByTestId('header-language-menu')).toBeNull();
  });

  it('hides the header capsule when translations are unavailable (static demo)', () => {
    render(
      <WorkbenchHeader
        {...headerProps({ translationLinkCount: 1, onOpenTranslations: undefined })}
      />,
    );

    expect(screen.queryByTestId('header-translation-capsule')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Bilingual review                                                         */
/* -------------------------------------------------------------------------- */

describe('BilingualReviewPage', () => {
  function renderReview() {
    return render(<BilingualReviewPage manualId="manual-src" itemId="item-1" branch="main" />);
  }

  function reviewHandler(overrides: { applyDraft?: () => Response } = {}): FetchHandler {
    return (call) => {
      const fromChrome = chrome(call);
      if (fromChrome) return fromChrome;
      if (call.path === '/api/translation/items/item-1/review' && call.method === 'GET') {
        return json(makeReview());
      }
      if (call.path === '/api/translation/items/item-1/review' && call.method === 'PUT') {
        return json(makeReview());
      }
      if (call.path === '/api/translation/items/item-1/apply-draft') {
        if (overrides.applyDraft) return overrides.applyDraft();
        return json({
          item: { ...ACTIVE_ITEM, status: 'approved_draft' },
          draft: {
            filePath: TARGET_PATH,
            op: 'update',
            baseCommit: 'abc1234',
            updatedAt: '2026-01-05T00:00:00.000Z',
          },
          lock: {
            userId: USER.id,
            userName: USER.displayName,
            lockedAt: '2026-01-05T00:00:00.000Z',
            updatedAt: '2026-01-05T00:00:00.000Z',
            isMine: true,
          },
        });
      }
      return json({});
    };
  }

  /** Read the rendered target of a block (typography view, no editor mounted). */
  function targetCell(segmentId: string): HTMLElement {
    return screen.getByTestId(`review-target-${segmentId}`);
  }

  /** Focus a block: only the active segment mounts an editor. */
  function activateSegment(segmentId: string): HTMLElement {
    const cell = targetCell(segmentId);
    fireEvent.click(cell);
    return cell;
  }

  /** The active block switched to its raw inner-XML textarea through the `</>` toggle. */
  async function rawSegmentXml(segmentId: string): Promise<HTMLTextAreaElement> {
    activateSegment(segmentId);
    const toggle = screen.queryByTestId(`review-xml-toggle-${segmentId}`);
    if (toggle && toggle.getAttribute('aria-pressed') !== 'true') fireEvent.click(toggle);
    return (await screen.findByTestId(`review-segment-xml-${segmentId}`)) as HTMLTextAreaElement;
  }

  it('renders aligned segments, the target lock and the live glossary QA error', async () => {
    installFetch(reviewHandler());
    renderReview();

    expect(await screen.findByTestId('bilingual-review-page')).toBeTruthy();
    expect(screen.getByTestId('review-item-status').textContent).toContain(
      translate('translation.itemStatus.ready_for_review'),
    );
    expect(screen.getByTestId('review-lock').textContent).toContain(
      translate('translation.review.lockedMine'),
    );

    // left column: changeKind pills, protected hint and the S0 diff toggle
    expect(screen.getByTestId('review-source-seg-1').textContent).toContain(
      translate('translation.changeKind.modified'),
    );
    expect(screen.getByTestId('review-source-seg-2').textContent).toContain(
      translate('translation.changeKind.protected'),
    );
    expect(screen.getByTestId('review-source-seg-3').textContent).toContain(
      translate('translation.changeKind.added'),
    );

    // target column: clean typography by default, an editor only for the focused block
    expect(targetCell('seg-1').textContent).toContain('Deploy the gateway first.');
    expect(screen.queryByTestId('review-segment-editor-seg-1')).toBeNull();
    activateSegment('seg-1');
    expect(await screen.findByTestId('review-segment-editor-seg-1')).toBeTruthy();

    // protected blocks stay read-only even when focused
    expect(targetCell('seg-2').textContent).toContain('keep me');
    activateSegment('seg-2');
    const protectedXml = (await screen.findByTestId('review-segment-xml-seg-2')) as HTMLTextAreaElement;
    expect(protectedXml.readOnly).toBe(true);
    expect(protectedXml.value).toBe('keep me');

    // right column: the live kernel flags the ignored glossary term
    await waitFor(() =>
      expect(screen.getByTestId('review-qa-errors').textContent).toContain('1'),
    );
    const qaList = screen.getByTestId('review-qa-list');
    expect(qaList.textContent).toContain('gateway');
    expect(qaList.textContent).toContain('网关');
    expect(screen.getByTestId('review-glossary-hits').textContent).toContain('闸道');
  });

  it('inserts a glossary hit into the selected block and clears the live QA error', async () => {
    installFetch(reviewHandler());
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    activateSegment('seg-1');
    await waitFor(() => expect(screen.getByTestId('review-qa-errors').textContent).toContain('1'));

    fireEvent.click(screen.getByTestId('review-insert-term-gateway'));

    await waitFor(() => expect(targetCell('seg-1').textContent).toContain('网关'));
    const inserted = await rawSegmentXml('seg-1');
    expect(inserted.value).toContain('网关');
    await waitFor(() => expect(screen.getByTestId('review-qa-errors').textContent).toContain('0'));
    expect(screen.getByTestId('review-qa-list').textContent).toContain(
      translate('translation.review.qaClean'),
    );
  });

  it('saves revisions, applies to the draft and surfaces a lock conflict', async () => {
    const calls = installFetch(
      reviewHandler({
        applyDraft: () => json({ error: 'files.lockedByOtherUser' }, 409),
      }),
    );
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    activateSegment('seg-1');
    fireEvent.click(screen.getByTestId('review-insert-term-gateway'));
    await waitFor(() => expect(targetCell('seg-1').textContent).toContain('网关'));

    fireEvent.click(screen.getByTestId('review-save'));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
        ),
      ).toBe(true),
    );
    const save = calls.find(
      (call) => call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
    );
    const segments = (save?.body as { segments: { segmentId: string; proposedTargetXml: string }[] })
      .segments;
    expect(segments.map((segment) => segment.segmentId)).toEqual(['seg-1', 'seg-3']);
    expect(segments[0]?.proposedTargetXml).toContain('网关');

    fireEvent.click(screen.getByTestId('review-apply-draft'));
    await waitFor(() =>
      expect(calls.some((call) => call.path === '/api/translation/items/item-1/apply-draft')).toBe(
        true,
      ),
    );
    expect((await screen.findByTestId('review-error')).textContent).toContain(
      translate('translation.review.lockConflict'),
    );
  });

  /* ------------------------------------------------------------------ */
  /* Map attribute segments: `navtitle="…"`, `title="…"`                 */
  /* ------------------------------------------------------------------ */

  const NAVTITLE_HEAD = 'map[0]/topichead[0]/@navtitle';
  const NAVTITLE_MAPREF = 'map[0]/mapref[0]/@navtitle';

  /** A map review payload: every translatable label is an attribute, not a child element. */
  function makeMapReview(): TranslationReviewPayload {
    return {
      ...makeReview(),
      sourcePath: 'maps/guide.ditamap',
      targetPath: 'maps/guide.ditamap',
      sourceXml:
        '<map id="guide" title="Product Guide"><topichead navtitle="Getting started">' +
        '<topicref href="topics/task-install.dita" format="dita" navtitle="Install &amp; configure"/>' +
        '</topichead><mapref href="maps/reference.ditamap" format="ditamap" navtitle="Reference"/></map>',
      prevSourceXml: null,
      targetBaselineXml: null,
      proposedXml:
        '<map id="guide" title="产品指南"><topichead navtitle="入门 &amp; 安装"></topichead>' +
        '<mapref href="maps/reference.ditamap" format="ditamap" navtitle="参考 &amp; 索引"/></map>',
      segments: [
        {
          segmentId: NAVTITLE_HEAD,
          elementTag: 'topichead',
          attributeName: 'navtitle',
          elementId: null,
          structuralPath: NAVTITLE_HEAD,
          changeKind: 'modified',
          protected: false,
          protectedReason: null,
          currSourceXml: 'Getting started',
          sourceText: 'Getting started',
          prevSourceText: null,
          prevTargetText: null,
          proposedTargetXml: '入门 &amp; 安装',
          proposedTargetText: '入门 & 安装',
          glossaryHits: [],
          qaIssues: [],
        },
        {
          segmentId: NAVTITLE_MAPREF,
          elementTag: 'mapref',
          attributeName: 'navtitle',
          elementId: null,
          structuralPath: NAVTITLE_MAPREF,
          changeKind: 'modified',
          protected: false,
          protectedReason: null,
          currSourceXml: 'Reference',
          sourceText: 'Reference',
          prevSourceText: null,
          prevTargetText: null,
          proposedTargetXml: '参考 &amp; 索引',
          proposedTargetText: '参考 & 索引',
          glossaryHits: [],
          qaIssues: [],
        },
      ],
      glossary: [],
      qaReport: { issues: [], errorCount: 0, warningCount: 0, checkedSegments: 2 },
    };
  }

  it('labels map attribute segments and saves their text XML-escaped', async () => {
    const calls = installFetch((call) => {
      const fromChrome = chrome(call);
      if (fromChrome) return fromChrome;
      if (call.path === '/api/translation/items/item-1/review') return json(makeMapReview());
      return json({});
    });
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    // The source card names the attribute so a reviewer knows what is being translated.
    expect(screen.getByTestId(`review-tag-${NAVTITLE_HEAD}`).textContent).toBe('<topichead @navtitle>');
    expect(screen.getByTestId(`review-tag-${NAVTITLE_MAPREF}`).textContent).toBe('<mapref @navtitle>');

    // Attribute segments open straight in raw mode; drafts hold plain text, not escaped payloads.
    activateSegment(NAVTITLE_HEAD);
    const headXml = (await screen.findByTestId(`review-segment-xml-${NAVTITLE_HEAD}`)) as HTMLTextAreaElement;
    expect(headXml.value).toBe('入门 & 安装');
    fireEvent.change(headXml, { target: { value: '入门 & 集成' } });
    expect(headXml.value).toBe('入门 & 集成');

    fireEvent.click(screen.getByTestId('review-save'));
    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
        ),
      ).toBe(true),
    );
    const save = calls.find(
      (call) => call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
    );
    const segments = (save?.body as { segments: { segmentId: string; proposedTargetXml: string }[] })
      .segments;
    expect(segments.map((segment) => segment.segmentId)).toEqual([NAVTITLE_HEAD, NAVTITLE_MAPREF]);
    // Attribute payloads are escaped exactly once and never wrapped in an element.
    expect(segments[0]?.proposedTargetXml).toBe('入门 &amp; 集成');
    expect(segments[1]?.proposedTargetXml).toBe('参考 &amp; 索引');
  });

  /* ------------------------------------------------------------------ */
  /* Inline tags: `<b>`, `<codeph>`, `<term>`, `<xref href="…">`         */
  /* ------------------------------------------------------------------ */

  const INLINE_SOURCE_XML =
    '<p id="p-inline">Use the <b>widget</b> from <codeph>ditaeditor</codeph> in <term>DITA-OT</term>; ' +
    'see <xref href="../references/publish-themes.dita" scope="local" format="dita">themes</xref>.</p>';
  const INLINE_TARGET_INNER =
    '使用 <b>小组件</b>，来自 <codeph>ditaeditor</codeph> 的 <term>DITA-OT</term>；' +
    '参见 <xref href="../references/publish-themes.dita" scope="local" format="dita">主题</xref>。';
  const INLINE_XREF =
    '<xref href="../references/publish-themes.dita" scope="local" format="dita">';

  /**
   * A review payload whose block carries every inline shape that used to be flattened on load and
   * on save, plus a stale segment-level QA issue from the worker to prove live QA supersedes it.
   */
  function makeInlineReview(): TranslationReviewPayload {
    return {
      ...makeReview(),
      segments: [
        {
          segmentId: 'seg-inline',
          elementTag: 'p',
          elementId: 'p-inline',
          structuralPath: 'concept/conbody/p[1]',
          changeKind: 'modified',
          protected: false,
          protectedReason: null,
          currSourceXml: INLINE_SOURCE_XML,
          sourceText: 'Use the widget from ditaeditor in DITA-OT; see themes.',
          prevSourceText: null,
          prevTargetText: null,
          proposedTargetXml: `<p id="p-inline">${INLINE_TARGET_INNER}</p>`,
          proposedTargetText: '使用 小组件，来自 ditaeditor 的 DITA-OT；参见 主题。',
          glossaryHits: [],
          qaIssues: [],
        },
        {
          segmentId: 'seg-plain',
          elementTag: 'p',
          elementId: null,
          structuralPath: 'concept/conbody/p[2]',
          changeKind: 'unchanged',
          protected: false,
          protectedReason: null,
          currSourceXml: '<p>Restart the service.</p>',
          sourceText: 'Restart the service.',
          prevSourceText: null,
          prevTargetText: '重启服务。',
          proposedTargetXml: '<p>重启服务。</p>',
          proposedTargetText: '重启服务。',
          glossaryHits: [],
          qaIssues: [],
        },
      ],
      glossary: [],
      qaReport: {
        issues: [
          {
            code: 'inline_tag_mismatch',
            severity: 'error',
            segmentId: 'seg-inline',
            message: 'Inline element <b> count changed: source has 1, translation has 0.',
          },
          {
            code: 'structure_warning',
            severity: 'warning',
            message: 'Document-level XML check.',
          },
        ],
        errorCount: 1,
        warningCount: 1,
        checkedSegments: 2,
      },
    };
  }

  function inlineHandler(refine?: () => Response): FetchHandler {
    return (call) => {
      const fromChrome = chrome(call);
      if (fromChrome) return fromChrome;
      if (call.path === '/api/translation/items/item-1/review') return json(makeInlineReview());
      if (call.path === '/api/translation/items/item-1/ai-refine') {
        if (refine) return refine();
        return json({});
      }
      return json({});
    };
  }

  it('keeps inline tags in the target editor and source column on load', async () => {
    installFetch(inlineHandler());
    renderReview();

    await screen.findByTestId('bilingual-review-page');

    // The block renders DITA typography, not raw XML, and not the text twice.
    const rendered = targetCell('seg-inline');
    expect(rendered.textContent).toContain('小组件');
    expect(rendered.textContent).toContain('ditaeditor');
    expect(rendered.textContent).not.toContain('<b>小组件</b>');
    expect(rendered.querySelectorAll('b').length).toBe(1);

    // The raw editor is seeded with inner XML, so no inline element is lost before the first keystroke.
    const target = (await rawSegmentXml('seg-inline')).value;
    expect(target).toContain('<b>小组件</b>');
    expect(target).toContain('<codeph>ditaeditor</codeph>');
    expect(target).toContain('<term>DITA-OT</term>');
    expect(target).toContain(INLINE_XREF);
    expect(target).not.toContain('<p id="p-inline">');

    // The source column renders the same semantics (bold widget, code, link) without raw XML noise.
    const source = screen.getByTestId('review-source-seg-inline');
    expect(source.querySelectorAll('b').length).toBe(1);
    expect(source.textContent).toContain('widget');
    expect(source.textContent).toContain('ditaeditor');
    expect(source.textContent).toContain('themes');
    expect(source.textContent).not.toContain('<b>widget</b>');
    expect(source.querySelector('a')?.getAttribute('href')).toBe('../references/publish-themes.dita');

    // The stale segment-level report is replaced by live QA: no inline/attribute errors remain.
    await waitFor(() => expect(screen.getByTestId('review-qa-errors').textContent).toContain('0'));
    expect(screen.queryByTestId('review-qa-list')?.textContent ?? '').not.toContain('Inline element');
  });

  it('saves revisions without flattening or re-escaping inline tags', async () => {
    const calls = installFetch(inlineHandler());
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    const inlineXml = await rawSegmentXml('seg-inline');
    fireEvent.change(inlineXml, { target: { value: `${INLINE_TARGET_INNER}已更新` } });

    fireEvent.click(screen.getByTestId('review-save'));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
        ),
      ).toBe(true),
    );

    const save = calls.find(
      (call) => call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
    );
    const sent = (
      save?.body as { segments: { segmentId: string; proposedTargetXml: string }[] }
    ).segments;
    expect(sent.map((segment) => segment.segmentId)).toEqual(['seg-inline', 'seg-plain']);

    const edited = sent.find((segment) => segment.segmentId === 'seg-inline');
    expect(edited?.proposedTargetXml).toContain('<b>小组件</b>');
    expect(edited?.proposedTargetXml).toContain('<codeph>ditaeditor</codeph>');
    expect(edited?.proposedTargetXml).toContain('<term>DITA-OT</term>');
    expect(edited?.proposedTargetXml).toContain(INLINE_XREF);
    expect(edited?.proposedTargetXml).toContain('已更新');
    expect(edited?.proposedTargetXml.startsWith('<p id="p-inline">')).toBe(true);

    // An untouched segment travels verbatim, never rebuilt from flattened text.
    const untouched = sent.find((segment) => segment.segmentId === 'seg-plain');
    expect(untouched?.proposedTargetXml).toBe('<p>重启服务。</p>');

    // The saved payload itself passes the inline/protected-attribute gates.
    const fixture = makeInlineReview();
    const qa = runTranslationQa({
      glossary: [],
      segments: fixture.segments.map((segment) => {
        const payload = sent.find((entry) => entry.segmentId === segment.segmentId);
        return {
          segmentId: segment.segmentId,
          sourceXml: segment.currSourceXml,
          sourceText: segment.sourceText,
          targetXml: payload?.proposedTargetXml ?? '',
          targetText: payload?.proposedTargetXml ?? '',
        };
      }),
    });
    expect(
      qa.filter(
        (issue) => issue.code === 'inline_tag_mismatch' || issue.code === 'protected_attr_modified',
      ),
    ).toEqual([]);
  });

  it('escapes only plain-text drafts that are not well-formed XML', async () => {
    const calls = installFetch(inlineHandler());
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    const plainXml = await rawSegmentXml('seg-plain');
    fireEvent.change(plainXml, { target: { value: 'R&D 重启服务' } });
    fireEvent.click(screen.getByTestId('review-save'));

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
        ),
      ).toBe(true),
    );
    const save = calls.find(
      (call) => call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
    );
    const sent = (
      save?.body as { segments: { segmentId: string; proposedTargetXml: string }[] }
    ).segments;
    expect(sent.find((segment) => segment.segmentId === 'seg-plain')?.proposedTargetXml).toBe(
      '<p>R&amp;D 重启服务</p>',
    );
    // …while the inline-XML segment stays untouched byte-for-byte.
    expect(sent.find((segment) => segment.segmentId === 'seg-inline')?.proposedTargetXml).toBe(
      `<p id="p-inline">${INLINE_TARGET_INNER}</p>`,
    );
  });

  it('applies an AI refine preview without losing inline tags', async () => {
    const refinedInner =
      '请使用 <b>组件</b>，来自 <codeph>ditaeditor</codeph> 的 <term>DITA-OT 4.x</term>；' +
      '参见 <xref href="../references/publish-themes.dita" scope="local" format="dita">主题</xref>。';
    const calls = installFetch(
      inlineHandler(() =>
        json({
          segmentId: 'seg-inline',
          proposedTargetXml: `<p id="p-inline">${refinedInner}</p>`,
          proposedTargetText: '请使用 组件，来自 ditaeditor 的 DITA-OT 4.x；参见 主题。',
          qaIssues: [],
        }),
      ),
    );
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    const card = screen.getByTestId('review-target-seg-inline');
    fireEvent.click(within(card).getByRole('button', { name: translate('translation.review.aiRefine') }));
    fireEvent.change(within(card).getByLabelText(translate('translation.review.aiRefineTitle')), {
      target: { value: 'make it more literal' },
    });
    fireEvent.click(within(card).getByRole('button', { name: translate('translation.review.aiRefineRun') }));

    await waitFor(() => expect(screen.getByTestId('review-refine-preview-seg-inline')).toBeTruthy());

    // The refine request carried real block XML, not flattened text.
    const refine = calls.find((call) => call.path === '/api/translation/items/item-1/ai-refine');
    expect((refine?.body as { currentTargetXml?: string }).currentTargetXml).toContain(
      '<b>小组件</b>',
    );
    expect((refine?.body as { currentTargetXml?: string }).currentTargetXml).toContain(INLINE_XREF);

    // The preview renders the suggestion semantically: the bold word reads as bold, not as `<b>`.
    const preview = screen.getByTestId('review-refine-preview-seg-inline');
    expect(preview.textContent).toContain('组件');
    expect(preview.textContent).not.toContain('<b>组件</b>');
    expect(preview.querySelectorAll('b').length).toBe(1);

    fireEvent.click(within(card).getByRole('button', { name: translate('translation.review.aiRefineApply') }));
    await waitFor(() => expect(targetCell('seg-inline').textContent).toContain('组件'));
    const applied = await rawSegmentXml('seg-inline');
    expect(applied.value).toContain('<b>组件</b>');
    expect(applied.value).toContain('<term>DITA-OT 4.x</term>');
    expect(applied.value).toContain(INLINE_XREF);
    expect(applied.value).not.toContain('<p id="p-inline">');
  });

  it('switches to the XML diff view with T0 and T1 panes', async () => {
    installFetch(reviewHandler());
    renderReview();

    await screen.findByTestId('bilingual-review-page');
    fireEvent.click(screen.getByRole('button', { name: translate('translation.review.xmlDiff') }));

    const editor = (await screen.findByTestId('review-xml-editor')) as HTMLTextAreaElement;
    const t0 = screen.getByLabelText(
      translate('translation.review.targetT0'),
    ) as HTMLTextAreaElement;
    expect(t0.readOnly).toBe(true);
    expect(t0.value).toContain('部署前先配置');
    expect(editor.readOnly).toBe(false);
    expect(editor.value).toContain('Deploy the gateway first.');
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Glossary manager                                                         */
/* -------------------------------------------------------------------------- */

describe('GlossaryManagerPage', () => {
  function glossaryHandler(): FetchHandler {
    return (call) => {
      const fromChrome = chrome(call);
      if (fromChrome) return fromChrome;
      if (call.path === '/api/glossaries' && call.method === 'GET') {
        return json({ glossaries: [GLOSSARY] });
      }
      if (call.path === '/api/glossaries/glossary-1/terms' && call.method === 'GET') {
        return json({ terms: [TERM] });
      }
      if (call.path === '/api/glossaries/glossary-1/terms' && call.method === 'POST') {
        return json({ term: { ...TERM, id: 'term-new', sourceTerm: 'service' } }, 201);
      }
      if (call.path === '/api/glossaries/glossary-1/import') {
        const dryRun = (call.body as { dryRun?: boolean }).dryRun === true;
        return json({
          dryRun,
          stats: {
            total: 3,
            newCount: 2,
            updateCount: 1,
            invalidCount: 1,
            writtenTerms: dryRun ? 0 : 3,
            writtenTranslations: dryRun ? 0 : 3,
          },
          errors: [{ row: 4, message: 'targetLang missing' }],
          preview: [
            { sourceTerm: 'gateway', targetLang: 'zh-CN', targetTerm: '网关', action: 'update' },
            { sourceTerm: 'service', targetLang: 'zh-CN', targetTerm: '服务', action: 'create' },
            { sourceTerm: 'cluster', targetLang: 'zh-CN', targetTerm: '集群', action: 'create' },
          ],
        });
      }
      return json({});
    };
  }

  it('lists glossaries, loads terms and creates a term', async () => {
    const calls = installFetch(glossaryHandler());
    render(<GlossaryManagerPage glossaryId={null} />);

    expect(await screen.findByTestId('glossary-manager-page')).toBeTruthy();
    const item = await screen.findByTestId('glossary-item-glossary-1');
    expect(item.textContent).toContain('Product Terminology');

    fireEvent.click(item);
    await waitFor(() => expect(screen.getByTestId('glossary-term-term-gateway')).toBeTruthy());
    expect(screen.getByTestId('glossary-term-term-gateway').textContent).toContain('网关');

    fireEvent.click(screen.getByTestId('glossary-add-term'));
    await screen.findByTestId('term-form-submit');

    fireEvent.change(screen.getByLabelText(translate('translation.glossary.term.sourceTerm')), {
      target: { value: 'service' },
    });
    fireEvent.change(screen.getByLabelText(translate('translation.glossary.term.targetLang')), {
      target: { value: 'zh-CN' },
    });
    fireEvent.change(screen.getByLabelText(translate('translation.glossary.term.targetTerm')), {
      target: { value: '服务' },
    });
    fireEvent.click(screen.getByTestId('term-form-submit'));

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.path === '/api/glossaries/glossary-1/terms' && call.method === 'POST',
        ),
      ).toBe(true),
    );
    const create = calls.find(
      (call) => call.path === '/api/glossaries/glossary-1/terms' && call.method === 'POST',
    );
    expect(create?.body).toMatchObject({
      sourceTerm: 'service',
      status: 'approved',
      translations: [{ targetLang: 'zh-CN', targetTerm: '服务' }],
    });
  });

  it('previews a CSV import before committing it', async () => {
    const calls = installFetch(glossaryHandler());
    render(<GlossaryManagerPage glossaryId={null} />);

    await screen.findByTestId('glossary-manager-page');
    fireEvent.click(await screen.findByTestId('glossary-item-glossary-1'));
    await waitFor(() => expect(screen.getByTestId('glossary-term-term-gateway')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: translate('translation.glossary.import') }));
    const content = await screen.findByLabelText(translate('translation.glossary.importContent'));
    fireEvent.change(content, {
      target: { value: 'sourceTerm,targetLang,targetTerm\ngateway,zh-CN,网关\nservice,zh-CN,服务' },
    });

    fireEvent.click(screen.getByTestId('import-dry-run'));
    const preview = await screen.findByTestId('import-preview');
    expect(preview.textContent).toContain(translate('translation.glossary.importNew', { count: 2 }));
    expect(preview.textContent).toContain(
      translate('translation.glossary.importUpdate', { count: 1 }),
    );
    expect(preview.textContent).toContain(
      translate('translation.glossary.importInvalid', { count: 1 }),
    );
    expect(screen.getByTestId('import-commit')).not.toHaveProperty('disabled', true);

    const importCall = calls.find((call) => call.path === '/api/glossaries/glossary-1/import');
    expect(importCall?.body).toMatchObject({ format: 'csv', dryRun: true });

    fireEvent.click(screen.getByTestId('import-commit'));
    await waitFor(() =>
      expect(
        calls.filter((call) => call.path === '/api/glossaries/glossary-1/import' && call.body).length,
      ).toBeGreaterThanOrEqual(2),
    );
    const commitCall = calls
      .filter((call) => call.path === '/api/glossaries/glossary-1/import')
      .at(-1);
    expect(commitCall?.body).toMatchObject({ dryRun: false });
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Hub language families                                                    */
/* -------------------------------------------------------------------------- */

function makeHubManual(overrides: Partial<Manual> = {}): Manual {
  return {
    id: 'manual-src',
    name: 'Gateway Manual',
    description: 'Gateway operations',
    rootDir: '/tmp/gateway',
    defaultRootMap: null,
    isBuiltin: false,
    archived: false,
    exists: true,
    sourceLang: 'en-US',
    currentBranch: 'main',
    stats: { totalTopics: 3, totalMaps: 1 },
    activeAssignmentCount: 0,
    myActiveAssignmentCount: 0,
    createdBy: USER.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    lastOpenedAt: null,
    ...overrides,
  };
}

describe('groupHubManualsByLanguageFamily', () => {
  it('hides translated manuals, keeps the base language first and sorts targets', () => {
    const source = makeHubManual({ id: 'manual-src', sourceLang: 'en-US', currentBranch: 'main' });
    const zh = makeHubManual({
      id: 'manual-zh',
      name: '网关手册',
      sourceLang: 'zh-CN',
      exists: false,
    });
    const fr = makeHubManual({ id: 'manual-fr', name: 'Manuel passerelle', sourceLang: 'fr-FR' });

    const links = [
      makeLink({
        id: 'link-zh',
        sourceManualId: 'manual-src',
        targetManualId: 'manual-zh',
        targetLang: 'zh-CN',
        sourceLang: 'en-US',
        targetBranch: 'main',
      }),
      // Two links to the same target language: the one on the current source branch wins.
      makeLink({
        id: 'link-fr-old',
        sourceManualId: 'manual-src',
        sourceBranch: 'release/1.0',
        targetManualId: 'manual-fr',
        targetLang: 'fr-FR',
        targetBranch: 'fr-old',
      }),
      makeLink({
        id: 'link-fr',
        sourceManualId: 'manual-src',
        sourceBranch: 'main',
        targetManualId: 'manual-fr',
        targetLang: 'fr-FR',
        targetBranch: 'fr-main',
      }),
    ];

    const { visibleManuals, editionsByManualId } = groupHubManualsByLanguageFamily(
      [source, zh, fr],
      links,
    );

    expect(visibleManuals.map((manual) => manual.id)).toEqual(['manual-src']);

    const editions = editionsByManualId.get('manual-src') ?? [];
    expect(editions.map((edition) => edition.lang)).toEqual(['en-US', 'fr-FR', 'zh-CN']);
    expect(editions[0]).toMatchObject({
      isBase: true,
      manualId: 'manual-src',
      branch: 'main',
      manualName: 'Gateway Manual',
      stats: source.stats,
      lastOpenedAt: source.lastOpenedAt,
    });
    expect(editions[2]).toMatchObject({
      isBase: false,
      manualId: 'manual-zh',
      branch: 'main',
      manualName: '网关手册',
      exists: false,
      linkId: 'link-zh',
      progressPercent: 33,
      // The target edition carries the translated manual's own metadata.
      stats: zh.stats,
      lastOpenedAt: zh.lastOpenedAt,
    });
    expect(editions[1]).toMatchObject({ isBase: false, branch: 'fr-main', linkId: 'link-fr' });
  });

  it('keeps an orphan translated manual visible when its source is absent from the list', () => {
    const orphan = makeHubManual({
      id: 'manual-orphan',
      name: 'Orphan Manual',
      sourceLang: 'ja-JP',
    });
    const source = makeHubManual({ id: 'manual-src' });

    const { visibleManuals, editionsByManualId } = groupHubManualsByLanguageFamily(
      [source, orphan],
      [
        makeLink({
          id: 'link-orphan',
          sourceManualId: 'manual-deleted',
          targetManualId: 'manual-orphan',
          targetLang: 'ja-JP',
        }),
      ],
    );

    expect(visibleManuals.map((manual) => manual.id)).toEqual(['manual-src', 'manual-orphan']);
    expect(editionsByManualId.get('manual-orphan')).toEqual([
      {
        lang: 'ja-JP',
        manualId: 'manual-orphan',
        branch: 'main',
        manualName: 'Orphan Manual',
        isBase: true,
        exists: true,
        stats: orphan.stats,
        lastOpenedAt: orphan.lastOpenedAt,
      },
    ]);
  });

  it('falls back to the link source language when the manual carries no sourceLang', () => {
    const source = makeHubManual({ id: 'manual-src', sourceLang: null });
    const zh = makeHubManual({ id: 'manual-zh', sourceLang: 'zh-CN' });

    const { editionsByManualId } = groupHubManualsByLanguageFamily(
      [source, zh],
      [
        makeLink({
          id: 'link-zh',
          sourceManualId: 'manual-src',
          sourceLang: 'en-GB',
          targetManualId: 'manual-zh',
          targetLang: 'zh-CN',
        }),
      ],
    );

    const editions = editionsByManualId.get('manual-src') ?? [];
    expect(editions.map((edition) => [edition.lang, edition.isBase])).toEqual([
      ['en-GB', true],
      ['zh-CN', false],
    ]);
  });
});

describe('buildSessionLanguageEditions', () => {
  it('marks the source session manual as the current base edition', () => {
    const editions = buildSessionLanguageEditions({
      manualId: 'manual-src',
      branch: 'main',
      manualName: 'Gateway Manual',
      sourceLang: 'en-US',
      links: [
        makeLink({ id: 'link-zh', targetManualId: 'manual-zh', targetLang: 'zh-CN' }),
        makeLink({
          id: 'link-fr',
          targetManualId: 'manual-fr',
          targetLang: 'fr-FR',
          targetManual: {
            id: 'manual-fr',
            name: 'Manuel passerelle',
            rootDir: '/tmp/gateway-fr',
            exists: false,
            sourceLang: 'fr-FR',
          },
        }),
      ],
    });

    expect(editions.map((edition) => [edition.lang, edition.isBase, edition.isCurrent])).toEqual([
      ['en-US', true, true],
      ['fr-FR', false, false],
      ['zh-CN', false, false],
    ]);
    expect(editions[1]).toMatchObject({ exists: false, manualId: 'manual-fr' });
    expect(editions[2]).toMatchObject({ exists: true, progressPercent: 33, linkId: 'link-zh' });
  });

  it('reads the family from the incoming link when a translated manual is opened', () => {
    // A translated manual's own `sourceLang` is its *target* language, so base detection must not
    // trust it — otherwise the target edition would be rendered as the family's origin.
    const editions = buildSessionLanguageEditions({
      manualId: 'manual-zh',
      branch: 'main',
      manualName: '网关手册',
      sourceLang: 'zh-CN',
      links: [makeLink({ id: 'link-zh', targetManualId: 'manual-zh', targetLang: 'zh-CN' })],
    });

    expect(editions.map((edition) => [edition.lang, edition.isBase, edition.isCurrent])).toEqual([
      ['en-US', true, false],
      ['zh-CN', false, true],
    ]);
    expect(editions[0]).toMatchObject({ manualId: 'manual-src', manualName: 'Gateway Manual' });
  });

  it('falls back to the source language of the link when the registry has none', () => {
    const editions = buildSessionLanguageEditions({
      manualId: 'manual-src',
      branch: 'main',
      manualName: 'Gateway Manual',
      sourceLang: null,
      links: [makeLink({ id: 'link-zh', targetManualId: 'manual-zh', targetLang: 'zh-CN' })],
    });

    expect(editions.map((edition) => edition.lang)).toEqual(['en-US', 'zh-CN']);
    expect(editions[0]?.isBase).toBe(true);
  });

  it('returns no editions when neither the registry nor a link knows the language', () => {
    expect(
      buildSessionLanguageEditions({
        manualId: 'manual-src',
        branch: 'main',
        manualName: 'Gateway Manual',
        sourceLang: null,
        links: [],
      }),
    ).toEqual([]);
  });
});

describe('ManualListSection language edition strip', () => {
  const sourceZh = makeHubManual({
    id: 'manual-zh-src',
    name: '网关手册',
    sourceLang: 'zh-CN',
    currentBranch: 'main',
    stats: { totalTopics: 3, totalMaps: 1 },
    lastOpenedAt: '2026-01-03T00:00:00.000Z',
  });
  const targetEn = makeHubManual({
    id: 'manual-en',
    name: 'Gateway Manual',
    sourceLang: 'en-US',
    currentBranch: 'en',
    stats: { totalTopics: 12, totalMaps: 4 },
    lastOpenedAt: '2026-01-05T00:00:00.000Z',
  });
  const link = makeLink({
    id: 'link-en',
    sourceManualId: 'manual-zh-src',
    sourceBranch: 'main',
    sourceLang: 'zh-CN',
    targetManualId: 'manual-en',
    targetBranch: 'en',
    targetLang: 'en-US',
    counts: { ...makeLink().counts, progressPercent: 42 },
  });

  function renderSection(
    overrides: {
      onOpenEdition?: (edition: unknown) => void;
      onOpen?: (manual: unknown) => void;
    } = {},
  ) {
    const { visibleManuals, editionsByManualId } = groupHubManualsByLanguageFamily(
      [sourceZh, targetEn],
      [link],
    );
    const onOpenEdition = overrides.onOpenEdition ?? vi.fn();
    const onOpen = overrides.onOpen ?? vi.fn();
    const utils = render(
      <ManualListSection
        manuals={visibleManuals}
        editionsByManualId={editionsByManualId}
        onOpenEdition={onOpenEdition as never}
        loading={false}
        query=""
        includeArchived={false}
        busyManualId={null}
        canManage={false}
        offline={true}
        onQueryChange={() => {}}
        onToggleArchived={() => {}}
        onCreate={() => {}}
        onAttach={() => {}}
        onImport={() => {}}
        onOpen={onOpen as never}
        onEdit={() => {}}
        onToggleArchive={() => {}}
        onRemove={() => {}}
      />,
    );
    return { ...utils, onOpenEdition, onOpen, editionsByManualId };
  }

  it('renders one card per language family instead of a card per translated manual', () => {
    renderSection();

    // The translated edition no longer has its own card...
    expect(screen.queryByText('Gateway Manual')).toBeNull();
    expect(screen.getByText('网关手册')).toBeTruthy();
    // ...and the old static source-language badge is gone in favour of the interactive strip.
    expect(screen.queryByTestId('manual-source-lang-manual-zh-src')).toBeNull();
  });

  it('puts the base language pill first and the target language pill second', () => {
    renderSection();

    const strip = screen.getByTestId('manual-editions-manual-zh-src');
    const pills = within(strip).getAllByRole('button');
    expect(pills).toHaveLength(2);
    expect(pills[0]?.getAttribute('data-base')).toBe('true');
    expect(pills[0]?.textContent).toBe('zh-CN');
    expect(pills[1]?.getAttribute('data-base')).toBe('false');
    expect(pills[1]?.textContent).toBe('en-US');
    expect(pills[1]?.getAttribute('title')).toBe(
      translate('translation.entry.openTargetEditionTitle', { lang: 'en-US', percent: 42 }),
    );
  });

  it('selects the base language by default and opens nothing', () => {
    const { onOpen, onOpenEdition } = renderSection();

    const base = screen.getByTestId('manual-edition-manual-zh-src-zh-CN');
    const target = screen.getByTestId('manual-edition-manual-zh-src-en-US');
    expect(base.getAttribute('aria-pressed')).toBe('true');
    expect(base.getAttribute('data-selected')).toBe('true');
    expect(target.getAttribute('aria-pressed')).toBe('false');
    expect(target.getAttribute('data-selected')).toBe('false');
    expect(onOpen).not.toHaveBeenCalled();
    expect(onOpenEdition).not.toHaveBeenCalled();
  });

  it('only switches selection when a language pill is clicked', () => {
    const { onOpen, onOpenEdition } = renderSection();

    fireEvent.click(screen.getByTestId('manual-edition-manual-zh-src-en-US'));

    // Selecting an edition never opens it.
    expect(onOpen).not.toHaveBeenCalled();
    expect(onOpenEdition).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('manual-edition-manual-zh-src-en-US').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByTestId('manual-edition-manual-zh-src-en-US').getAttribute('data-selected'),
    ).toBe('true');
    expect(
      screen.getByTestId('manual-edition-manual-zh-src-zh-CN').getAttribute('aria-pressed'),
    ).toBe('false');

    // The card metadata follows the selected edition (branch and stats differ per manual).
    const card = screen
      .getByTestId('manual-editions-manual-zh-src')
      .closest('article') as HTMLElement | null;
    if (!card) throw new Error('manual card not found');
    expect(card.textContent).toContain(translate('workbench.branch', { branch: 'en' }));
    expect(card.textContent).toContain(translate('workbench.stats', { topics: 12, maps: 4 }));
  });

  it('opens the selected target edition only from the bottom button', () => {
    const { onOpen, onOpenEdition } = renderSection();

    fireEvent.click(screen.getByTestId('manual-edition-manual-zh-src-en-US'));
    expect(onOpenEdition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('manual-open-manual-zh-src'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onOpenEdition).toHaveBeenCalledTimes(1);
    expect(onOpenEdition).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'en-US',
        manualId: 'manual-en',
        branch: 'en',
        manualName: 'Gateway Manual',
        isBase: false,
        exists: true,
        progressPercent: 42,
        linkId: 'link-en',
      }),
    );
  });

  it('opens the base manual from the bottom button after re-selecting it', () => {
    const { onOpen, onOpenEdition } = renderSection();

    fireEvent.click(screen.getByTestId('manual-edition-manual-zh-src-en-US'));
    fireEvent.click(screen.getByTestId('manual-edition-manual-zh-src-zh-CN'));
    fireEvent.click(screen.getByTestId('manual-open-manual-zh-src'));

    expect(onOpenEdition).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'manual-zh-src' }));
  });
});

describe('WorkbenchHubPage language families', () => {
  const hubSource = makeHubManual({
    id: 'manual-hub-zh',
    name: '网关手册',
    sourceLang: 'zh-CN',
    currentBranch: 'main',
  });
  const hubTarget = makeHubManual({
    id: 'manual-hub-en',
    name: 'Gateway Manual',
    sourceLang: 'en-US',
    currentBranch: 'en',
  });
  const hubLink = makeLink({
    id: 'link-hub-en',
    sourceManualId: 'manual-hub-zh',
    sourceBranch: 'main',
    sourceLang: 'zh-CN',
    targetManualId: 'manual-hub-en',
    targetBranch: 'en',
    targetLang: 'en-US',
  });

  it('loads translation links, hides the translated card and opens the clicked edition', async () => {
    const calls = installFetch((call) => {
      const chromeResponse = chrome(call);
      if (chromeResponse) return chromeResponse;
      if (call.path === '/api/manuals') {
        return json({
          defaultRootDir: '/tmp/manuals',
          importsRootDir: '/tmp/imports',
          manuals: [hubSource, hubTarget],
          activeManualId: null,
        });
      }
      if (call.path === '/api/translation/links') return json({ links: [hubLink] });
      if (call.path === '/api/manuals/manual-hub-en/touch') return json({ manual: hubTarget });
      return json({}, 404);
    });

    render(<WorkbenchHubPage />);

    await waitFor(() => expect(screen.getByTestId('manual-editions-manual-hub-zh')).toBeTruthy());
    // One card for the family: the English edition is a pill, never a sibling card.
    expect(screen.getByText('网关手册')).toBeTruthy();
    expect(screen.queryByText('Gateway Manual')).toBeNull();
    expect(screen.getAllByTestId(/^manual-editions-/)).toHaveLength(1);

    const strip = screen.getByTestId('manual-editions-manual-hub-zh');
    const pills = within(strip).getAllByRole('button');
    expect(pills.map((pill) => [pill.textContent, pill.getAttribute('data-base')])).toEqual([
      ['zh-CN', 'true'],
      ['en-US', 'false'],
    ]);

    fireEvent.click(screen.getByTestId('manual-edition-manual-hub-zh-en-US'));
    // Selecting an edition must not open it — no touch/navigate happens on the pill.
    expect(
      screen.getByTestId('manual-edition-manual-hub-zh-en-US').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(calls.some((call) => call.path === '/api/manuals/manual-hub-en/touch')).toBe(false);

    // The bottom "open" button opens the selected edition.
    fireEvent.click(screen.getByTestId('manual-open-manual-hub-zh'));
    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.path === '/api/manuals/manual-hub-en/touch' && call.method === 'POST',
        ),
      ).toBe(true),
    );
  });

  it('stays on a single card when the translation module is unavailable', async () => {
    installFetch((call) => {
      const chromeResponse = chrome(call);
      if (chromeResponse) return chromeResponse;
      if (call.path === '/api/manuals') {
        return json({
          defaultRootDir: '/tmp/manuals',
          importsRootDir: '/tmp/imports',
          manuals: [hubSource],
          activeManualId: null,
        });
      }
      return json({}, 404);
    });

    render(<WorkbenchHubPage />);

    await waitFor(() => expect(screen.getByText('网关手册')).toBeTruthy());
    // No links could be loaded, so only the fallback base pill renders and nothing breaks.
    const strip = screen.getByTestId('manual-editions-manual-hub-zh');
    expect(within(strip).getAllByRole('button')).toHaveLength(1);
    expect(within(strip).getByRole('button').getAttribute('data-base')).toBe('true');
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Phase 16 — dual-AI review and DITA-OT strict gates                       */
/* -------------------------------------------------------------------------- */

const REVIEWER_CONFIG: AiPublicConfig = {
  configured: true,
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4.1-mini',
  hasApiKey: true,
  apiKeySource: 'env',
  maskedApiKey: 'sk-***',
  temperature: 0.2,
  maxRetries: 2,
  timeoutMs: 60000,
  maxContextChars: 24000,
  canEdit: true,
  reviewer: {
    configured: true,
    isDedicated: true,
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'reviewer-model',
    hasApiKey: true,
    apiKeySource: 'db',
    maskedApiKey: 'sk-ant-***',
    temperature: 0.1,
    hasDedicatedBaseUrl: true,
    hasDedicatedModel: true,
    hasDedicatedApiKey: true,
    hasDedicatedTemperature: true,
  },
};

describe('Phase 16 dual-AI and strict gates', () => {
  function gatesHandler(
    options: {
      link?: Partial<TranslationLinkView>;
      job?: Partial<TranslationJobView>;
      items?: TranslationItemView[];
      review?: Partial<TranslationReviewPayload>;
      strict?: () => Response;
    } = {},
  ): FetchHandler {
    const link = makeLink(options.link);
    return (call) => {
      const fromChrome = chrome(call);
      if (fromChrome) return fromChrome;
      if (call.path === '/api/translation/links' && call.method === 'GET') {
        return json({ links: [link] });
      }
      if (call.path === '/api/translation/links/link-1' && call.method === 'PATCH') {
        return json({ link: { ...link, options: (call.body as { options: Record<string, unknown> }).options } });
      }
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: makeFiles(), counts: link.counts });
      }
      if (call.path === '/api/translation/jobs' && call.method === 'GET') {
        return json({ jobs: [{ ...queueJob(), ...options.job }] });
      }
      if (call.path === '/api/translation/jobs/job-1') {
        return json({ job: { ...queueJob(), ...options.job }, items: options.items ?? [gateItem()] });
      }
      if (call.path.endsWith('/stream')) return emptyStream();
      if (call.path === '/api/translation/items/item-1/review' && call.method === 'GET') {
        return json(makeReview(options.review));
      }
      if (call.path === '/api/translation/items/item-1/validate-strict') {
        if (options.strict) return options.strict();
        return json({ item: { ...gateItem(), ditaOtStatus: 'passed', ditaOtErrorCount: 0 }, ditaOtReport: passedStrictReport() });
      }
      return json({});
    };
  }

  function queueJob(): TranslationJobView {
    return {
      id: 'job-1',
      linkId: 'link-1',
      userId: USER.id,
      mode: 'incremental',
      status: 'completed',
      sourceCommit: 'abc1234',
      totalItems: 2,
      completedItems: 2,
      failedItems: 0,
      cancelRequested: false,
      createdAt: '2026-01-04T00:00:00.000Z',
      startedAt: '2026-01-04T00:00:05.000Z',
      finishedAt: '2026-01-04T00:01:00.000Z',
    };
  }

  /** A row that carries every Phase 16 gate so each chip is reachable in one render. */
  function gateItem(overrides: Partial<TranslationItemView> = {}): TranslationItemView {
    return {
      ...ACTIVE_ITEM,
      status: 'ai_reviewing',
      qaRepairedCount: 3,
      aiReviewVerdict: 'revise',
      aiReviewErrorCount: 1,
      aiReviewWarningCount: 2,
      ditaOtStatus: 'failed',
      ditaOtErrorCount: 2,
      ditaOtWarningCount: 1,
      ...overrides,
    };
  }

  function aiReviewReport(overrides: Partial<TranslationAiReviewReport> = {}): TranslationAiReviewReport {
    return {
      verdict: 'revise',
      model: 'claude-sonnet-reviewer',
      isDedicatedModel: true,
      summary: 'Two segments drop the approved term for "gateway".',
      reviewRounds: 2,
      qaRepairRounds: 1,
      repairedSegments: 3,
      initialQaErrors: 4,
      remainingQaErrors: 1,
      issues: [
        {
          segmentId: 'seg-1',
          severity: 'error',
          category: 'terminology',
          message: 'The approved term 网关 is missing.',
          suggestion: 'Use 网关 for "gateway".',
        },
        {
          segmentId: 'seg-3',
          severity: 'warning',
          category: 'style',
          message: 'Sentence reads like a literal translation.',
          suggestion: 'Prefer 重启服务。',
        },
      ],
      updatedAt: '2026-01-05T00:00:00.000Z',
      ...overrides,
    };
  }

  function failedStrictReport(): TranslationDitaOtItemReport {
    return {
      status: 'failed',
      repaired: true,
      repairAttempts: 2,
      errorCount: 2,
      warningCount: 1,
      diagnostics: [
        {
          severity: 'error',
          code: 'DITAOT001',
          message: 'Element "ph" not allowed here.',
          filePath: TARGET_PATH,
          line: 12,
          column: 5,
        },
      ],
      updatedAt: '2026-01-05T00:00:00.000Z',
    };
  }

  function passedStrictReport(): TranslationDitaOtItemReport {
    return {
      status: 'passed',
      repaired: false,
      repairAttempts: 0,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [],
      updatedAt: '2026-01-05T00:10:00.000Z',
    };
  }

  it('persists both Phase 16 toggles into the language-pair options', async () => {
    const calls = installFetch(gatesHandler());
    render(
      <TranslationCenterPage
        manualId="manual-src"
        manualName="Gateway Manual"
        manualSourceLang="en-US"
        branch="main"
        linkId={null}
        tab="settings"
      />,
    );

    const tab = await screen.findByTestId('translation-settings-tab');
    const aiReview = (await within(tab).findByTestId(
      'translation-settings-ai-review',
    )) as HTMLInputElement;
    const ditaOt = within(tab).getByTestId('translation-settings-ditaot-strict') as HTMLInputElement;
    // both gates are opt-out, so a pair that never touched them keeps them on
    expect(aiReview.checked).toBe(true);
    expect(ditaOt.checked).toBe(true);

    fireEvent.click(aiReview);
    fireEvent.click(ditaOt);
    fireEvent.click(within(tab).getByText(translate('translation.settings.save')));

    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'PATCH' && call.path === '/api/translation/links/link-1'),
      ).toBe(true),
    );
    const patch = calls.find(
      (call) => call.method === 'PATCH' && call.path === '/api/translation/links/link-1',
    )!;
    expect(patch.body).toMatchObject({
      options: { aiReviewEnabled: false, ditaOtStrictEnabled: false },
    });
  });

  it('shows the ai_reviewing status, the job validation banner and per-item gate chips', async () => {
    installFetch(
      gatesHandler({
        job: {
          status: 'completed_with_errors',
          validationReport: {
            status: 'failed',
            checkedFiles: 2,
            errorFiles: 2,
            repairedFiles: 1,
            remainingErrorFiles: 1,
            durationMs: 4300,
            updatedAt: '2026-01-05T00:01:00.000Z',
          },
        },
      }),
    );
    render(<TranslationQueueTab link={makeLink()} identity={IDENTITY} onOpenReview={() => {}} />);

    const jobButton = await screen.findByTestId('translation-job-job-1');
    fireEvent.click(jobButton);

    const banner = await screen.findByTestId('translation-job-validation');
    expect(banner.textContent).toContain(translate('translation.queue.validation.title'));
    expect(within(banner).getByTestId('translation-job-validation-status').textContent).toContain(
      translate('translation.ditaOt.status.failed'),
    );
    expect(banner.textContent).toContain('2'); // checked files
    expect(banner.textContent).toContain('1'); // repaired / remaining
    expect(banner.textContent).toContain('4300');

    // the row itself: reviewer round label, repaired chip, AI verdict and DITA-OT status
    expect(await screen.findByText(translate('translation.itemStatus.ai_reviewing'))).toBeTruthy();
    expect(screen.getByTestId('translation-item-qa-repaired-item-1').textContent).toContain('3');
    expect(screen.getByTestId('translation-item-ai-review-item-1').textContent).toContain(
      translate('translation.aiReview.verdict.revise'),
    );
    expect(screen.getByTestId('translation-item-ditaot-item-1').textContent).toContain(
      translate('translation.ditaOt.status.failed'),
    );
  });

  it('renders the reviewer report, jumps to an issue segment and re-runs the strict gate', async () => {
    const calls = installFetch(
      gatesHandler({
        review: {
          item: gateItem({ status: 'ready_for_review' }),
          aiReview: aiReviewReport(),
          ditaOtReport: failedStrictReport(),
        },
      }),
    );
    // the review view mode is persisted per browser, so drop any mode an earlier test stored
    window.localStorage.clear();
    render(<BilingualReviewPage manualId="manual-src" itemId="item-1" branch="main" />);

    await screen.findByTestId('bilingual-review-page');

    // header pills mirror the inspector verdicts
    expect(screen.getByTestId('review-header-ai-review').textContent).toContain(
      translate('translation.review.pillAiReview'),
    );
    expect(screen.getByTestId('review-header-ditaot').textContent).toContain(
      translate('translation.ditaOt.status.failed'),
    );

    const aiCard = await screen.findByTestId('review-ai-review');
    expect(screen.getByTestId('review-ai-verdict').textContent).toContain(
      translate('translation.aiReview.verdict.revise'),
    );
    expect(aiCard.textContent).toContain('claude-sonnet-reviewer');
    expect(aiCard.textContent).toContain(translate('translation.review.aiReviewDedicated'));
    expect(screen.getByTestId('review-ai-summary').textContent).toContain('approved term');
    // 4 initial QA errors → 1 remaining, with the repaired count and round number
    expect(screen.getByTestId('review-ai-qa-stats').textContent).toContain('4');
    expect(screen.getByTestId('review-ai-summary')).toBeTruthy();

    const ditaOtCard = screen.getByTestId('review-ditaot');
    expect(screen.getByTestId('review-ditaot-status').textContent).toContain(
      translate('translation.ditaOt.status.failed'),
    );
    expect(screen.getByTestId('review-ditaot-repaired')).toBeTruthy();
    expect(ditaOtCard.textContent).toContain('DITAOT001');
    expect(ditaOtCard.textContent).toContain('12:5');
    expect(within(ditaOtCard).getByTestId('review-ditaot-diagnostic-0').textContent).toContain(
      'not allowed here',
    );

    // clicking a reviewer issue focuses that segment in the bilingual editor
    // jsdom has no layout, so the "jump" is observed through scrollIntoView on the target row
    const scrolled: HTMLElement[] = [];
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value(this: HTMLElement) {
        scrolled.push(this);
      },
    });
    try {
      fireEvent.click(screen.getByTestId('review-ai-issue-0'));
      expect(scrolled.at(-1)?.getAttribute('data-testid')).toBe('review-row-seg-1');

      // a warning issue jumps to its own segment instead
      fireEvent.click(screen.getByTestId('review-ai-issue-1'));
      expect(scrolled.at(-1)?.getAttribute('data-testid')).toBe('review-row-seg-3');
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }

    fireEvent.click(screen.getByTestId('review-rerun-strict'));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' &&
            call.path === '/api/translation/items/item-1/validate-strict',
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(screen.getByTestId('review-ditaot-status').textContent).toContain(
        translate('translation.ditaOt.status.passed'),
      ),
    );
    expect(screen.getByTestId('review-header-ditaot').textContent).toContain(
      translate('translation.ditaOt.status.passed'),
    );
  });

  it('switches the reviewer card between inherited and dedicated models', async () => {
    const calls = installFetch((call) => {
      if (call.path === '/api/ai/config' && call.method === 'GET') {
        return json(REVIEWER_CONFIG);
      }
      if (call.path === '/api/ai/config' && call.method === 'PUT') {
        return json({
          ...REVIEWER_CONFIG,
          reviewer: {
            ...REVIEWER_CONFIG.reviewer,
            isDedicated: false,
            hasDedicatedBaseUrl: false,
            hasDedicatedModel: false,
            hasDedicatedApiKey: false,
            hasDedicatedTemperature: false,
          },
        });
      }
      if (call.path === '/api/ai/config/test') {
        return json({ ok: true, latencyMs: 42, model: 'reviewer-model' });
      }
      if (call.path === '/api/ai/usage') {
        return json({
          totals: {
            calls: 1,
            succeeded: 1,
            failed: 0,
            cancelled: 0,
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
            avgDurationMs: 900,
          },
          byDay: [],
          byTask: [],
          byUser: [],
          byModel: [{ model: 'reviewer-model', calls: 1, promptTokens: 10, completionTokens: 5, totalTokens: 15 }],
          recent: [
            {
              id: 'u-1',
              taskType: 'translate_review',
              subAction: null,
              status: 'succeeded',
              userDisplayName: USER.displayName,
              model: 'reviewer-model',
              filePath: SOURCE_PATH,
              retryCount: 0,
              promptTokens: 10,
              completionTokens: 5,
              totalTokens: 15,
              durationMs: 900,
              createdAt: '2026-01-05T00:00:00.000Z',
            },
          ],
          days: 30,
        });
      }
      return json({});
    });

    // the dialog renders whatever the store already holds; the parent owns the initial load
    useAiStore.setState({ config: REVIEWER_CONFIG, usage: null });
    render(<AiSettingsDialog open onClose={() => {}} />);

    const card = await screen.findByTestId('ai-reviewer-card');
    // the saved config has a dedicated reviewer, so the card opens in dedicated mode
    expect(
      within(card).getByTestId('ai-reviewer-mode-dedicated').getAttribute('aria-pressed'),
    ).toBe('true');
    expect((within(card).getByTestId('ai-reviewer-model') as HTMLInputElement).value).toBe(
      'reviewer-model',
    );

    // probe the reviewer alone: the request must carry role=reviewer
    fireEvent.click(within(card).getByTestId('ai-reviewer-test'));
    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'POST' && call.path === '/api/ai/config/test'),
      ).toBe(true),
    );
    const testCall = calls.find((call) => call.path === '/api/ai/config/test')!;
    expect(testCall.body).toMatchObject({ role: 'reviewer', model: 'reviewer-model' });
    expect(await within(card).findByTestId('ai-reviewer-test-result')).toBeTruthy();

    // going back to inherit is dirty, and saving sends four nulls
    fireEvent.click(within(card).getByTestId('ai-reviewer-mode-inherit'));
    expect(within(card).getByTestId('ai-reviewer-inherit-summary').textContent).toContain(
      REVIEWER_CONFIG.model,
    );
    fireEvent.click(screen.getByText(translate('aiSettings.save')));
    await waitFor(() =>
      expect(
        calls.some((call) => call.method === 'PUT' && call.path === '/api/ai/config'),
      ).toBe(true),
    );
    const patch = calls.find((call) => call.method === 'PUT' && call.path === '/api/ai/config')!;
    expect(patch.body).toMatchObject({
      reviewer: { baseUrl: null, model: null, apiKey: null, temperature: null },
    });

    // the usage ledger labels the translate_review task family instead of the raw id
    // the label and the file path share one text node, so match as a substring
    expect(
      await screen.findByText(translate('aiSettings.taskType.translateReview'), { exact: false }),
    ).toBeTruthy();
    expect(screen.queryByText('translate_review', { exact: false })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Multi-level lineage (Phase 16)                                           */
/* -------------------------------------------------------------------------- */

describe('Phase 16 multi-level lineage UI', () => {
  /** `en-US → zh-CN → ar-SA`: the middle node is both a child and a parent. */
  function arabicLink(overrides: Partial<TranslationLinkView> = {}): TranslationLinkView {
    return makeLink({
      id: 'link-ar',
      sourceManualId: 'manual-zh',
      sourceBranch: 'main',
      sourceLang: 'zh-CN',
      targetManualId: 'manual-ar',
      targetBranch: 'main',
      targetLang: 'ar-SA',
      sourceManual: {
        id: 'manual-zh',
        name: '网关手册',
        rootDir: '/tmp/gateway-zh',
        exists: true,
        sourceLang: 'zh-CN',
      },
      targetManual: {
        id: 'manual-ar',
        name: 'دليل البوابة',
        rootDir: '/tmp/gateway-ar',
        exists: true,
        sourceLang: 'ar-SA',
      },
      counts: { ...makeLink().counts, progressPercent: 10 },
      ...overrides,
    });
  }

  function lineageHandler(links: readonly TranslationLinkView[]) {
    return (call: FetchCall): Response => {
      const fromChrome = chrome(call);
      if (fromChrome) return fromChrome;
      if (call.path === '/api/translation/links' && call.method === 'GET') {
        return json({ links });
      }
      for (const link of links) {
        if (call.path === `/api/translation/links/${link.id}/files`) {
          return json({ files: makeFiles(), counts: link.counts });
        }
        if (call.path === `/api/translation/links/${link.id}/scan`) {
          return json({
            summary: {
              sourceCommit: 'abc1234',
              targetCommit: 'def5678',
              total: 3,
              created: 1,
              updated: 2,
              removed: 0,
              renames: 0,
              deleted: 0,
              counts: link.counts,
            },
            files: makeFiles(),
          });
        }
        if (call.path === `/api/translation/links/${link.id}` && call.method === 'GET') {
          return json({ link });
        }
      }
      if (call.path === '/api/glossaries') return json({ glossaries: [] });
      if (call.path === '/api/translation/jobs') return json({ jobs: [] });
      if (call.path === '/api/manuals') return json({ manuals: [] });
      return json({});
    };
  }

  function renderCenter(
    props: Partial<ComponentProps<typeof TranslationCenterPage>> = {},
  ): ReturnType<typeof render> {
    return render(
      <TranslationCenterPage
        manualId="manual-src"
        manualName="Gateway Manual"
        manualSourceLang="en-US"
        branch="main"
        linkId={null}
        tab="files"
        {...props}
      />,
    );
  }

  it('renders the whole family tree with depth, guides and a root-first selection', async () => {
    installFetch(lineageHandler([makeLink(), arabicLink()]));
    renderCenter();

    await screen.findByTestId('translation-lineage-sidebar');
    const root = await screen.findByTestId('translation-lineage-root');
    expect(root.getAttribute('data-depth')).toBe('0');
    expect(root.textContent).toContain('en-US');
    expect(
      within(screen.getByTestId('translation-lineage-sidebar')).getByText('Gateway Manual'),
    ).toBeTruthy();

    const zhNode = await screen.findByTestId('translation-lineage-node-link-1');
    expect(zhNode.getAttribute('data-depth')).toBe('1');
    expect(screen.getByTestId('translation-link-link-1').getAttribute('aria-pressed')).toBe('true');

    const arNode = screen.getByTestId('translation-lineage-node-link-ar');
    expect(arNode.getAttribute('data-depth')).toBe('2');
    expect(screen.getByTestId('translation-link-link-ar').getAttribute('aria-pressed')).toBe(
      'false',
    );

    // Collapsing the middle node hides its children but keeps the node itself selectable.
    fireEvent.click(screen.getByTestId('translation-lineage-toggle-link-1'));
    expect(screen.queryByTestId('translation-lineage-node-link-ar')).toBeNull();
    expect(screen.getByTestId('translation-link-link-1')).toBeTruthy();

    // The tree itself collapses into a slim strip, leaving an expand affordance behind.
    fireEvent.click(screen.getByTestId('translation-lineage-toggle'));
    expect(screen.queryByTestId('translation-lineage-root')).toBeNull();
    fireEvent.click(screen.getByTestId('translation-lineage-expand'));
    expect(screen.getByTestId('translation-lineage-root')).toBeTruthy();
  });

  it('opens the true family root, not the entry manual, from the lineage root action', async () => {
    // Only `zh-CN → ar-SA` exists, so the leaf manual is the entry but `zh-CN` is the root.
    installFetch(lineageHandler([arabicLink()]));
    renderCenter({
      manualId: 'manual-ar',
      manualName: 'دليل البوابة',
      manualSourceLang: 'ar-SA',
    });

    const root = await screen.findByTestId('translation-lineage-root');
    expect(root.textContent).toContain('zh-CN');

    fireEvent.click(screen.getByTestId('translation-lineage-root-open'));

    const url = new URL(window.location.href);
    expect(url.pathname).toBe('/manuals/manual-zh');
    expect(url.searchParams.get('branch')).toBe('main');
    expect(url.pathname).not.toBe('/manuals/manual-ar');
  });

  it('pre-selects the derived node and disables languages already used in the family', async () => {
    installFetch(lineageHandler([makeLink(), arabicLink()]));
    renderCenter();

    fireEvent.click(await screen.findByTestId('translation-link-derive-link-ar'));

    const source = (await screen.findByTestId('translation-add-source')) as HTMLSelectElement;
    await waitFor(() => expect(source.value).toBe('manual-ar'));
    expect(within(source).getByRole('option', { name: /ar-SA/ })).toBeTruthy();

    const lang = screen.getByTestId('translation-add-lang') as HTMLSelectElement;
    for (const taken of ['en-US', 'zh-CN', 'ar-SA']) {
      const option = lang.querySelector<HTMLOptionElement>(`option[value="${taken}"]`);
      expect(option?.disabled).toBe(true);
    }
    expect(lang.querySelector<HTMLOptionElement>('option[value="de-DE"]')?.disabled).toBe(false);
  });

  it('shows the pending upstream banner and jumps to the stale ancestor', async () => {
    installFetch(lineageHandler([makeLink(), arabicLink()]));
    renderCenter({ linkId: 'link-ar' });

    const banner = await screen.findByTestId('translation-upstream-banner');
    expect(banner.textContent).toContain('zh-CN');

    fireEvent.click(screen.getByTestId('translation-upstream-jump-link-1'));
    const url = new URL(window.location.href);
    expect(url.searchParams.get('link')).toBe('link-1');
  });

  it('warns before unlinking a node that still has descendants', async () => {
    const calls = installFetch(lineageHandler([makeLink(), arabicLink()]));
    renderCenter({ tab: 'settings' });

    fireEvent.click(await screen.findByTestId('translation-unlink-start'));
    const warning = await screen.findByTestId('translation-unlink-downstream-warning');
    expect(warning.textContent).toContain('ar-SA');

    fireEvent.click(screen.getByTestId('translation-unlink-confirm'));

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.method === 'DELETE' && call.path === '/api/translation/links/link-1',
        ),
      ).toBe(true),
    );
    // The success path re-reads the family so the tree cannot keep a removed branch.
    await waitFor(() =>
      expect(calls.filter((call) => call.path === '/api/translation/links').length).toBeGreaterThan(
        1,
      ),
    );
  });

  it('binds the glossary panel to the active pair source manual, not the entry manual', async () => {
    const calls = installFetch(lineageHandler([makeLink(), arabicLink()]));
    renderCenter({ manualId: 'manual-ar', manualName: 'دليل البوابة', manualSourceLang: 'ar-SA', tab: 'glossary' });

    await screen.findByTestId('glossary-workspace');
    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.path === '/api/glossaries' && call.search.includes('manualId=manual-zh'),
        ),
      ).toBe(true),
    );
    expect(
      calls.some(
        (call) => call.path === '/api/glossaries' && call.search.includes('manualId=manual-ar'),
      ),
    ).toBe(false);
  });
});
