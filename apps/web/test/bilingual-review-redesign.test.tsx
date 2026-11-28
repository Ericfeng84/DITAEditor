// @vitest-environment jsdom
/**
 * Phase 16 review redesign — modular review workbench.
 *
 * The suite is intentionally layered:
 *  - pure XML helpers and the inline renderer are tested in isolation (no fetch, no store),
 *  - the single-segment rich editor is driven through a small harness,
 *  - the page is exercised through every layout, navigation path and guard.
 *
 * Nothing here mocks `@dita/core`: the lossless round-trip, live QA and CALS/`navtitle` rules are the
 * real kernel, so a regression in the kernel surfaces here too.
 */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t as translate } from '../src/i18n/index.js';
import { useLocaleStore } from '../src/i18n/index.js';
import { useGitStore } from '../src/store/git-store';
import { useTranslationStore } from '../src/store/translation-store.js';
import type {
  TranslationAiReviewReport,
  TranslationDitaOtItemReport,
  TranslationItemView,
  TranslationReviewPayload,
  TranslationReviewSiblingView,
  TranslationSegmentReviewView,
} from '../src/services/translation-api.js';
import type { IdentityResponse, IdentityUser } from '../src/services/identity-api.js';
import { BilingualReviewPage } from '../src/translation/BilingualReviewPage';
import { DitaInlineRenderer } from '../src/translation/review/DitaInlineRenderer.js';
import { RichInlineSegmentEditor } from '../src/translation/review/RichInlineSegmentEditor.js';
import {
  buildTargetXmlForSave,
  escapeXmlText,
  extractInnerXml,
  findMissingSourceInlineTags,
  fragmentToPlainText,
  isSelfClosingElement,
  parseInnerFragment,
  splitOuterElement,
} from '../src/translation/review/segment-xml-utils.js';

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

const EMPTY_COUNTS = {
  total: 0,
  synced: 0,
  outdated: 0,
  untranslated: 0,
  inQueue: 0,
  inReview: 0,
  draftReady: 0,
  metadataOnly: 0,
  sourceDeleted: 0,
  sourceRenamed: 0,
  progressPercent: 0,
};

const XREF =
  '<xref href="../references/publish-themes.dita" scope="local" format="dita">';
const INLINE_SOURCE =
  `<p id="p-1">Use the <b>widget</b> from <codeph>ditaeditor</codeph>; see ${XREF}themes</xref> ` +
  '<keyword keyref="prod_name"/>.</p>';
const INLINE_TARGET_INNER =
  `使用 <b>小组件</b>，来自 <codeph>ditaeditor</codeph>；参见 ${XREF}主题</xref> ` +
  '<keyword keyref="prod_name"/>。';

function makeItem(overrides: Partial<TranslationItemView> = {}): TranslationItemView {
  return {
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
    updatedAt: '2026-01-04T00:00:00.000Z',
    ...overrides,
  };
}

function inlineSegment(): TranslationSegmentReviewView {
  return {
    segmentId: 'seg-inline',
    elementTag: 'p',
    elementId: 'p-1',
    structuralPath: 'concept/conbody/p[1]',
    changeKind: 'modified',
    protected: false,
    protectedReason: null,
    currSourceXml: INLINE_SOURCE,
    sourceText: 'Use the widget from ditaeditor; see themes prod_name.',
    prevSourceText: null,
    prevTargetText: null,
    proposedTargetXml: `<p id="p-1">${INLINE_TARGET_INNER}</p>`,
    proposedTargetText: '使用 小组件，来自 ditaeditor；参见 主题 prod_name。',
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
  };
}

const SIBLINGS: TranslationReviewSiblingView[] = [
  {
    itemId: 'item-1',
    sourcePath: SOURCE_PATH,
    targetPath: TARGET_PATH,
    status: 'ready_for_review',
    qaErrorCount: 0,
    qaWarningCount: 1,
  },
  {
    itemId: 'item-2',
    sourcePath: 'topics/reference.dita',
    targetPath: 'topics/reference.dita',
    status: 'queued',
    qaErrorCount: 0,
    qaWarningCount: 0,
  },
  {
    itemId: 'item-3',
    sourcePath: 'topics/appendix.dita',
    targetPath: 'topics/appendix.dita',
    status: 'checked_in',
    qaErrorCount: 0,
    qaWarningCount: 0,
  },
];

function makeReview(overrides: Partial<TranslationReviewPayload> = {}): TranslationReviewPayload {
  return {
    item: makeItem(),
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
    sourceXml: INLINE_SOURCE,
    prevSourceXml: null,
    targetBaselineXml: `<p id="p-1">${INLINE_TARGET_INNER}</p>`,
    proposedXml: `<p id="p-1">${INLINE_TARGET_INNER}</p><codeblock>keep me</codeblock>`,
    segments: [
      inlineSegment(),
      {
        segmentId: 'seg-code',
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
    glossary: [
      {
        termId: 'term-gateway',
        glossaryId: 'glossary-1',
        scope: 'global',
        sourceTerm: 'gateway',
        targetTerm: '网关',
        caseSensitive: false,
        doNotTranslate: false,
        forbiddenTargets: ['闸道'],
        contextNote: 'Product name for the API gateway.',
      },
    ],
    qaReport: { issues: [], errorCount: 0, warningCount: 0, checkedSegments: 3 },
    lock: {
      userId: USER.id,
      userName: USER.displayName,
      lockedAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
      isMine: true,
    },
    canReview: true,
    siblings: SIBLINGS,
    ...overrides,
  };
}

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

function reviewHandler(
  options: {
    review?: () => TranslationReviewPayload;
    reviewFor?: (itemId: string) => TranslationReviewPayload;
    applyDraft?: () => Response;
  } = {},
): FetchHandler {
  return (call) => {
    const fromChrome = chrome(call);
    if (fromChrome) return fromChrome;
    const reviewMatch = /^\/api\/translation\/items\/([^/]+)\/review$/.exec(call.path);
    if (reviewMatch) {
      const itemId = reviewMatch[1] ?? 'item-1';
      const payload =
        options.reviewFor?.(itemId) ?? options.review?.() ?? makeReview();
      if (call.method === 'PUT') return json(payload);
      return json(payload);
    }
    if (call.path === '/api/translation/items/item-1/apply-draft') {
      if (options.applyDraft) return options.applyDraft();
      return json({
        item: makeItem({ status: 'approved_draft' }),
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
    if (call.path.endsWith('/ai-refine')) return json({});
    return json({});
  };
}

beforeEach(() => {
  useLocaleStore.setState({ locale: 'en' });
  useTranslationStore.getState().reset();
  useGitStore.setState({ identity: IDENTITY, currentUser: USER });
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  useTranslationStore.getState().reset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderReview(itemId = 'item-1') {
  return render(<BilingualReviewPage manualId="manual-src" itemId={itemId} branch="main" />);
}

/** Focus a block and switch it to the raw inner-XML textarea via `</>`. */
async function rawSegmentXml(segmentId: string): Promise<HTMLTextAreaElement> {
  fireEvent.click(screen.getByTestId(`review-target-${segmentId}`));
  const toggle = screen.queryByTestId(`review-xml-toggle-${segmentId}`);
  if (toggle && toggle.getAttribute('aria-pressed') !== 'true') fireEvent.click(toggle);
  return (await screen.findByTestId(`review-segment-xml-${segmentId}`)) as HTMLTextAreaElement;
}

/* -------------------------------------------------------------------------- */
/* 1. segment-xml-utils                                                        */
/* -------------------------------------------------------------------------- */

describe('segment-xml-utils', () => {
  it('extracts inner XML losslessly and keeps comments / PIs / CDATA', () => {
    const xml = '<p id="p-1">a <!-- keep --><?pi x?><b>bold</b><![CDATA[<raw>]]></p>';
    expect(extractInnerXml(xml)).toBe('a <!-- keep --><?pi x?><b>bold</b><![CDATA[<raw>]]>');
    expect(extractInnerXml(`<p>${INLINE_TARGET_INNER}</p>`)).toBe(INLINE_TARGET_INNER);
  });

  it('splits outer elements and detects self-closing siblings', () => {
    expect(isSelfClosingElement('<keyword keyref="prod_name"/>')).toBe(true);
    expect(isSelfClosingElement('<keyword keyref="prod_name" />')).toBe(true);
    expect(isSelfClosingElement('<b>x</b>')).toBe(false);
    const parts = splitOuterElement('<p id="p-1">x</p>');
    expect(parts?.openTag).toBe('<p id="p-1">');
    expect(parts?.innerXml).toBe('x');
    expect(parts?.closeTag).toBe('</p>');
    expect(splitOuterElement('bare text')).toBeNull();
    expect(extractInnerXml('bare text')).toBe('bare text');
  });

  it('projects a fragment to plain text without leaking markup', () => {
    expect(fragmentToPlainText(INLINE_TARGET_INNER)).toBe(
      '使用 小组件，来自 ditaeditor；参见 主题 。',
    );
    expect(escapeXmlText('R&D <x>')).toBe('R&amp;D &lt;x&gt;');
  });

  it('parses inner fragments with numeric node types (never instanceof slimdom)', () => {
    const nodes = parseInnerFragment(`${INLINE_TARGET_INNER}<!-- tail -->`);
    expect(nodes).not.toBeNull();
    const types = (nodes ?? []).map((node) => node.nodeType as number);
    expect(types).toContain(1); // element
    expect(types).toContain(3); // text
    expect(types).toContain(8); // comment
    expect(parseInnerFragment('<b>unclosed')).toBeNull();
  });

  it('rebuilds target XML per segment shape: attribute, fragment, plain text', () => {
    // Attribute segments carry bare text as their `currSourceXml`, so nothing gets re-wrapped.
    const attr = {
      ...inlineSegment(),
      attributeName: 'navtitle',
      elementTag: 'topichead',
      currSourceXml: 'Getting started',
    };
    expect(buildTargetXmlForSave(attr, '入门 & 安装')).toBe('入门 &amp; 安装');

    const block = inlineSegment();
    expect(buildTargetXmlForSave(block, INLINE_TARGET_INNER)).toBe(
      `<p id="p-1">${INLINE_TARGET_INNER}</p>`,
    );
    // Plain text (no markup) inside an element is escaped exactly once.
    expect(
      buildTargetXmlForSave(
        { ...block, currSourceXml: '<p>重启服务。</p>', proposedTargetXml: '<p>重启服务。</p>' },
        'A & B',
      ),
    ).toBe('<p>A &amp; B</p>');
    // Already well-formed inner XML passes through untouched.
    expect(buildTargetXmlForSave(block, '<b>x</b>')).toBe('<p id="p-1"><b>x</b></p>');
  });

  it('finds source inline tags that the translation dropped, with snippets and labels', () => {
    const missing = findMissingSourceInlineTags(
      INLINE_SOURCE,
      '使用 小组件，来自 ditaeditor；参见 主题 。',
    );
    expect(missing.map((tag) => tag.tagName)).toEqual(['b', 'codeph', 'xref', 'keyword']);
    expect(missing.map((tag) => tag.label)).toEqual([
      '<b>',
      '<codeph>',
      '<xref>',
      'key:prod_name',
    ]);
    expect(missing[0]?.snippet).toBe('<b>widget</b>');
    expect(missing[3]?.snippet).toBe('<keyword keyref="prod_name"/>');
    expect(missing[2]?.href).toBe('../references/publish-themes.dita');

    // Multiset comparison: one `<b>` in the target still leaves the second source `<b>` missing.
    const twoBold = '<p><b>a</b> and <b>b</b></p>';
    expect(findMissingSourceInlineTags(twoBold, '<b>a</b>').map((tag) => tag.label)).toEqual([
      '<b>',
    ]);
    expect(findMissingSourceInlineTags('<p><b>a</b></p>', '<b>a</b>')).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. DitaInlineRenderer                                                       */
/* -------------------------------------------------------------------------- */

describe('DitaInlineRenderer', () => {
  it('renders DITA semantics once — no duplicated plain text, no raw XML', () => {
    const { container } = render(<DitaInlineRenderer innerXml={INLINE_TARGET_INNER} />);
    expect(container.textContent?.match(/小组件/g)).toHaveLength(1);
    expect(container.textContent).not.toContain('<b>');
    expect(container.textContent).not.toContain('keyref');
    expect(container.querySelectorAll('b')).toHaveLength(1);
    expect(container.querySelector('codeph, .review-inline-code')?.textContent).toBe('ditaeditor');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      '../references/publish-themes.dita',
    );
  });

  it('renders `<keyword keyref="prod_name"/>` as a compact key chip with the XML as tooltip', () => {
    const { container } = render(<DitaInlineRenderer innerXml='<keyword keyref="prod_name"/>' />);
    const chip = container.querySelector('.dita-nv-keyword');
    expect(chip).not.toBeNull();
    expect(chip?.querySelector('.dita-nv-ref-badge')?.textContent).toBe('prod_name');
    expect(chip?.getAttribute('title')).toBe('<keyword keyref="prod_name"/>');
    expect(container.textContent).toBe('prod_name');
  });

  it('shows compact inline tag badges only when showTags is on', () => {
    const { container, rerender } = render(<DitaInlineRenderer innerXml={INLINE_TARGET_INNER} />);
    expect(container.querySelectorAll('.review-inline-tag')).toHaveLength(0);

    rerender(<DitaInlineRenderer innerXml={INLINE_TARGET_INNER} showTags />);
    const badges = [...container.querySelectorAll('.review-inline-tag')].map(
      (node) => node.textContent,
    );
    expect(badges).toContain('<b>');
    expect(badges).toContain('</b>');
    expect(badges).toContain('<xref>');
    expect(container.querySelectorAll('b')).toHaveLength(1);
  });

  it('highlights glossary source matches and degrades malformed XML to readable text', () => {
    const hit = inlineSegment().glossaryHits;
    const { container } = render(
      <DitaInlineRenderer innerXml="gateway and Gateway" glossaryHits={hit} />,
    );
    expect(container.querySelectorAll('mark.review-glossary-mark')).toHaveLength(2);

    const malformed = render(<DitaInlineRenderer innerXml="<b>broken" testId="inline" />);
    expect(malformed.getByTestId('inline').getAttribute('data-malformed')).toBe('true');
    expect(malformed.getByTestId('inline').textContent).toBe('broken');
  });
});

/* -------------------------------------------------------------------------- */
/* 3. RichInlineSegmentEditor                                                  */
/* -------------------------------------------------------------------------- */

function EditorHarness({
  segment,
  initialValue,
}: {
  segment: TranslationSegmentReviewView;
  initialValue: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [request, setRequest] = useState<{ segmentId: string; text: string; nonce: number } | null>(
    null,
  );
  const missingTags = findMissingSourceInlineTags(
    extractInnerXml(segment.currSourceXml),
    value,
  );
  return (
    <div>
      <button
        type="button"
        data-testid="request-insert"
        onClick={() => setRequest({ segmentId: segment.segmentId, text: '网关', nonce: 1 })}
      >
        insert
      </button>
      <RichInlineSegmentEditor
        segment={segment}
        value={value}
        onChange={setValue}
        showTags={false}
        missingTags={missingTags}
        t={translate}
        insertRequest={request}
      />
      <output data-testid="editor-value">{value}</output>
    </div>
  );
}

describe('RichInlineSegmentEditor', () => {
  it('mounts a one-block ProseMirror editor and keeps inline attributes lossless', async () => {
    const segment = inlineSegment();
    render(<EditorHarness segment={segment} initialValue={INLINE_TARGET_INNER} />);

    const editor = await screen.findByTestId('review-segment-editor-seg-inline');
    expect(editor.getAttribute('data-mode')).toBe('visual');
    expect(editor.querySelector('.ProseMirror')).not.toBeNull();
    // `<keyword keyref>` is a protected chip, not editable text.
    expect(editor.querySelector('.dita-nv-keyword')).not.toBeNull();
    expect(screen.getByTestId('editor-value').textContent).toBe(INLINE_TARGET_INNER);
  });

  it('inserts a glossary term at the caret without splitting or flattening the block', async () => {
    const segment = inlineSegment();
    render(<EditorHarness segment={segment} initialValue={INLINE_TARGET_INNER} />);
    await screen.findByTestId('review-segment-editor-seg-inline');

    fireEvent.click(screen.getByTestId('request-insert'));

    await waitFor(() => expect(screen.getByTestId('editor-value').textContent).toContain('网关'));
    const value = screen.getByTestId('editor-value').textContent ?? '';
    expect(value).toContain('<b>小组件</b>');
    expect(value).toContain(XREF);
    expect(value).toContain('<keyword keyref="prod_name"/>');
    expect(value).not.toContain('<p');
  });

  it('offers one-click chips for source inline tags the translation dropped', async () => {
    const segment = inlineSegment();
    render(<EditorHarness segment={segment} initialValue="使用 小组件。" />);

    const chips = await screen.findAllByTestId(/^review-insert-tag-seg-inline-/);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.some((chip) => chip.textContent?.includes('<b>'))).toBe(true);

    fireEvent.click(chips[0] as HTMLElement);
    await waitFor(() =>
      expect(screen.getByTestId('editor-value').textContent).toContain('<b>widget</b>'),
    );
  });

  it('switches a single segment to raw XML editing and keeps malformed drafts in XML mode', async () => {
    const segment = inlineSegment();
    render(<EditorHarness segment={segment} initialValue={INLINE_TARGET_INNER} />);
    await screen.findByTestId('review-segment-editor-seg-inline');

    fireEvent.click(screen.getByTestId('review-xml-toggle-seg-inline'));
    const raw = (await screen.findByTestId('review-segment-xml-seg-inline')) as HTMLTextAreaElement;
    expect(raw.value).toBe(INLINE_TARGET_INNER);

    fireEvent.change(raw, { target: { value: '<b>broken' } });
    expect(screen.getByTestId('editor-value').textContent).toBe('<b>broken');
    // Still the textarea: malformed XML never silently becomes a visual document.
    expect(screen.getByTestId('review-xml-toggle-seg-inline').getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByTestId('review-segment-editor-seg-inline').getAttribute('data-mode')).toBe(
      'xml',
    );
  });

  it('renders `<keyword keyref="prod_name"/>` visibly inside ProseMirror (attributes live in rawAttrs)', async () => {
    const segment = inlineSegment();
    render(
      <EditorHarness segment={segment} initialValue='<keyword keyref="prod_name"/>' />,
    );

    const editor = await screen.findByTestId('review-segment-editor-seg-inline');
    const chip = editor.querySelector('.dita-nv-keyword');
    expect(chip).not.toBeNull();
    // The bug: reading `node.attrs.keyref` left an empty span, so the keyword vanished.
    expect(chip?.textContent).toBe('key:prod_name');
    expect(chip?.getAttribute('title')).toBe('<keyword keyref="prod_name"/>');
    expect(chip?.querySelector('.dita-nv-ref-badge')?.getAttribute('contenteditable')).toBe(
      'false',
    );
    expect(editor.textContent).toContain('prod_name');
    expect(screen.getByTestId('editor-value').textContent).toBe(
      '<keyword keyref="prod_name"/>',
    );
  });

  it('forces raw mode for attribute segments and read-only mode for protected blocks', async () => {
    const attr = { ...inlineSegment(), attributeName: 'navtitle', elementTag: 'topichead' };
    const { unmount } = render(<EditorHarness segment={attr} initialValue="入门 & 安装" />);
    const attrRaw = (await screen.findByTestId('review-segment-xml-seg-inline')) as HTMLTextAreaElement;
    expect(attrRaw.value).toBe('入门 & 安装');
    expect(screen.queryByTestId('review-xml-toggle-seg-inline')).toBeNull();
    unmount();

    const protectedSegment: TranslationSegmentReviewView = {
      ...inlineSegment(),
      protected: true,
      protectedReason: 'xml:space="preserve"',
      segmentId: 'seg-protected',
      elementTag: 'codeblock',
    };
    render(<EditorHarness segment={protectedSegment} initialValue="keep me" />);
    const protectedRaw = (await screen.findByTestId(
      'review-segment-xml-seg-protected',
    )) as HTMLTextAreaElement;
    expect(protectedRaw.readOnly).toBe(true);
    expect(protectedRaw.value).toBe('keep me');
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Page: views                                                              */
/* -------------------------------------------------------------------------- */

describe('BilingualReviewPage views', () => {
  it('renders side by side blocks inside ONE shared row so both columns stay aligned', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    expect(screen.getByTestId('review-side-by-side')).toBeTruthy();
    for (const segmentId of ['seg-inline', 'seg-code', 'seg-plain']) {
      const row = screen.getByTestId(`review-row-${segmentId}`);
      expect(row.className).toContain('grid');
      expect(within(row).getByTestId(`review-source-${segmentId}`)).toBeTruthy();
      expect(within(row).getByTestId(`review-target-${segmentId}`)).toBeTruthy();
    }
    // Clean typography by default: no editor until the reviewer focuses a block.
    expect(screen.queryByTestId('review-segment-editor-seg-inline')).toBeNull();
    expect(screen.getByTestId('review-target-seg-inline').textContent).toContain('小组件');
  });

  it('swaps source/target order in the stacked editorial view and remembers the choice', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-view-stacked'));
    const row = screen.getByTestId('review-row-seg-inline');
    const order = (): string[] =>
      [...row.querySelectorAll('[data-testid^="review-target-"], [data-testid^="review-source-"]')]
        .map((node) => node.getAttribute('data-testid') ?? '')
        .filter((id) => id === 'review-target-seg-inline' || id === 'review-source-seg-inline');
    expect(order()).toEqual(['review-target-seg-inline', 'review-source-seg-inline']);

    fireEvent.click(screen.getByTestId('review-order-source-top'));
    expect(order()).toEqual(['review-source-seg-inline', 'review-target-seg-inline']);
    expect(window.localStorage.getItem('ditaeditor.review.view')).toBe('stacked');
  });

  it('hover-reading shows a floating counterpart card and pins it into an editor drawer', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-view-hoverReading'));
    expect(screen.getByTestId('review-hover-view')).toBeTruthy();
    const row = screen.getByTestId('review-row-seg-inline');
    expect(within(row).getByTestId('review-target-seg-inline')).toBeTruthy();

    fireEvent.mouseOver(row);
    const card = await screen.findByTestId('review-hover-card-seg-inline');
    expect(card.textContent).toContain('widget');
    expect(card.getAttribute('data-placement')).toBeTruthy();

    fireEvent.click(within(row).getByTestId('review-target-seg-inline'));
    expect(await screen.findByTestId('review-hover-editor-seg-inline')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('review-hover-editor-seg-inline')).toBeNull());

    // Primary language toggle: the document becomes the source text.
    fireEvent.click(screen.getByTestId('review-primary-source'));
    expect(within(screen.getByTestId('review-row-seg-inline')).getByTestId('review-source-seg-inline')).toBeTruthy();
  });

  it('keeps the XML diff read-only baseline beside an editable proposal', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-view-xmlDiff'));
    const baseline = screen.getByLabelText(
      translate('translation.review.targetT0'),
    ) as HTMLTextAreaElement;
    expect(baseline.readOnly).toBe(true);
    expect(baseline.value).toContain('小组件');

    const editor = screen.getByTestId('review-xml-editor') as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(false);
    fireEvent.change(editor, { target: { value: '<p>手动修订</p>' } });
    expect(editor.value).toBe('<p>手动修订</p>');
    expect(window.localStorage.getItem('ditaeditor.review.view')).toBe('xmlDiff');
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Page: navigation, filters and guards                                     */
/* -------------------------------------------------------------------------- */

describe('BilingualReviewPage navigation', () => {
  it('walks the review queue with previous/next and the `1 / 3` file switcher', async () => {
    const calls = installFetch(
      reviewHandler({
        reviewFor: (itemId) =>
          itemId === 'item-2'
            ? makeReview({
                item: makeItem({ id: 'item-2', sourcePath: 'topics/reference.dita', status: 'queued' }),
                sourcePath: 'topics/reference.dita',
              })
            : makeReview(),
      }),
    );
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    expect(screen.getByTestId('review-file-switcher').textContent).toContain('1 / 3');
    expect((screen.getByTestId('review-prev-item') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId('review-next-item'));
    await waitFor(() =>
      expect(calls.some((call) => call.path === '/api/translation/items/item-2/review')).toBe(true),
    );
    await waitFor(() =>
      expect(window.location.pathname).toContain('/translation/review/item-2'),
    );
    expect(screen.getByTestId('review-file-switcher').textContent).toContain('2 / 3');

    fireEvent.click(screen.getByTestId('review-prev-item'));
    await waitFor(() =>
      expect(window.location.pathname).toContain('/translation/review/item-1'),
    );
  });

  it('filters the switcher to pending files and jumps straight to a chosen file', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-file-switcher'));
    expect(screen.getByTestId('review-file-option-item-1')).toBeTruthy();
    expect(screen.getByTestId('review-file-option-item-3')).toBeTruthy();

    fireEvent.click(screen.getByTestId('review-pending-only'));
    expect(screen.getByTestId('review-file-option-item-1')).toBeTruthy();
    expect(screen.queryByTestId('review-file-option-item-3')).toBeNull();

    fireEvent.click(screen.getByTestId('review-file-option-item-2'));
    await waitFor(() =>
      expect(window.location.pathname).toContain('/translation/review/item-2'),
    );
  });

  it('guards unsaved drafts with save/discard/cancel before switching files', async () => {
    const calls = installFetch(
      reviewHandler({
        reviewFor: (itemId) =>
          itemId === 'item-2'
            ? makeReview({ item: makeItem({ id: 'item-2', sourcePath: 'topics/reference.dita' }) })
            : makeReview(),
      }),
    );
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    const raw = await rawSegmentXml('seg-inline');
    fireEvent.change(raw, { target: { value: `${INLINE_TARGET_INNER}已更新` } });

    fireEvent.click(screen.getByTestId('review-next-item'));
    expect(screen.getByTestId('review-unsaved-dialog')).toBeTruthy();
    expect(calls.some((call) => call.path === '/api/translation/items/item-2/review')).toBe(false);

    // Cancel keeps the current file and the draft.
    fireEvent.click(screen.getByTestId('review-unsaved-cancel'));
    expect(screen.queryByTestId('review-unsaved-dialog')).toBeNull();
    expect(screen.getByTestId('review-segment-xml-seg-inline')).toHaveProperty('value');
    expect((screen.getByTestId('review-segment-xml-seg-inline') as HTMLTextAreaElement).value).toContain(
      '已更新',
    );

    // Discard switches without a PUT.
    fireEvent.click(screen.getByTestId('review-next-item'));
    fireEvent.click(screen.getByTestId('review-unsaved-discard'));
    await waitFor(() =>
      expect(calls.some((call) => call.path === '/api/translation/items/item-2/review')).toBe(true),
    );
    expect(
      calls.some(
        (call) =>
          call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
      ),
    ).toBe(false);

    // Save & switch persists first, then navigates.
    fireEvent.click(screen.getByTestId('review-prev-item'));
    await screen.findByTestId('review-row-seg-inline');
    const again = await rawSegmentXml('seg-inline');
    fireEvent.change(again, { target: { value: '<p>保存后切换</p>' } });
    fireEvent.click(screen.getByTestId('review-next-item'));
    fireEvent.click(screen.getByTestId('review-unsaved-save'));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
        ),
      ).toBe(true),
    );
  });

  it('offers "next file" right after applying the draft to the target workspace', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-apply-draft'));
    const next = await screen.findByTestId('review-next-after-apply');
    expect(screen.getByTestId('review-message').textContent).toBeTruthy();
    expect((screen.getByTestId('review-apply-draft') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(next);
    await waitFor(() =>
      expect(window.location.pathname).toContain('/translation/review/item-2'),
    );
  });
});

describe('BilingualReviewPage apply, check-in & filters', () => {
  const CHECKIN_HASH = 'abc1234def5678';

  /** Adds the target-draft/check-in endpoints on top of the review fixture handler. */
  function chainedHandler() {
    const base = reviewHandler();
    return (call: FetchCall): Response | Promise<Response> => {
      if (call.path === '/api/translation/links/link-1/batch-checkin') {
        return json({
          commit: {
            hash: CHECKIN_HASH,
            shortHash: CHECKIN_HASH.slice(0, 7),
            message: 'chore: check in gateway',
            author: USER.displayName,
            date: '2026-01-06T00:00:00.000Z',
          },
          checkedInPaths: [TARGET_PATH],
          syncedFiles: [TARGET_PATH],
        });
      }
      if (call.path === '/api/translation/links/link-1/files') {
        return json({ files: [], counts: EMPTY_COUNTS });
      }
      if (call.path === '/api/translation/links/link-1') {
        return json({ link: { id: 'link-1', targetLang: 'zh-CN' } });
      }
      return base(call);
    };
  }

  it('saves a dirty block before applying it to the target draft and keeps the result visible', async () => {
    const calls = installFetch(chainedHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    const raw = await rawSegmentXml('seg-inline');
    fireEvent.change(raw, { target: { value: `${INLINE_TARGET_INNER}已补充说明` } });

    fireEvent.click(screen.getByTestId('review-apply-draft'));

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'POST' && call.path === '/api/translation/items/item-1/apply-draft',
        ),
      ).toBe(true),
    );
    const putIndex = calls.findIndex(
      (call) => call.method === 'PUT' && call.path === '/api/translation/items/item-1/review',
    );
    const applyIndex = calls.findIndex((call) => call.path.endsWith('/apply-draft'));
    expect(putIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(putIndex);
    // The unsaved edit really travelled to the server, not just to the draft overlay.
    expect(JSON.stringify(calls[putIndex]?.body)).toContain('已补充说明');

    // The edit survives the payload refresh, and the applied hint stays on screen.
    expect((screen.getByTestId('review-segment-xml-seg-inline') as HTMLTextAreaElement).value).toContain(
      '已补充说明',
    );
    expect(screen.getByTestId('review-message').textContent).toBeTruthy();
    expect(await screen.findByTestId('review-open-target-editor')).toBeTruthy();
  });

  it('opens the applied draft in the target editor', async () => {
    installFetch(chainedHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-apply-draft'));
    fireEvent.click(await screen.findByTestId('review-open-target-editor'));

    await waitFor(() => expect(window.location.pathname).toContain('/manuals/manual-zh'));
    expect(window.location.search).toContain('branch=main');
    expect(window.location.search).toContain('topic=topics%2Fgateway-setup.dita');
  });

  it('auto-saves and auto-applies before check-in and keeps the checked-in hash after the reload', async () => {
    const calls = installFetch(chainedHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    const raw = await rawSegmentXml('seg-inline');
    fireEvent.change(raw, { target: { value: `${INLINE_TARGET_INNER}待签入` } });

    fireEvent.click(screen.getByTestId('review-checkin'));
    const messageInput = screen.getByLabelText(
      translate('translation.review.checkinMessage'),
    ) as HTMLInputElement;
    fireEvent.change(messageInput, { target: { value: 'chore: check in gateway' } });
    fireEvent.click(screen.getByTestId('review-checkin-confirm'));

    await waitFor(() =>
      expect(calls.filter((call) => call.path.endsWith('/batch-checkin'))).toHaveLength(1),
    );
    const putIndex = calls.findIndex(
      (call) => call.method === 'PUT' && call.path === '/api/translation/items/item-1/review',
    );
    const applyIndex = calls.findIndex(
      (call) => call.method === 'POST' && call.path === '/api/translation/items/item-1/apply-draft',
    );
    const checkinIndex = calls.findIndex((call) => call.path.endsWith('/batch-checkin'));
    expect(putIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(putIndex);
    expect(checkinIndex).toBeGreaterThan(applyIndex);
    expect(calls[checkinIndex]?.body).toEqual({
      itemIds: ['item-1'],
      message: 'chore: check in gateway',
    });

    // `loadReview` runs after the commit, and only a *file* switch may clear the hash.
    await waitFor(() =>
      expect(
        calls.filter(
          (call) => call.method === 'GET' && call.path === '/api/translation/items/item-1/review',
        ).length,
      ).toBeGreaterThan(1),
    );
    await waitFor(() =>
      expect(screen.getByTestId('review-checkin').textContent).toContain('abc1234'),
    );
    expect(screen.queryByTestId('review-checkin-confirm')).toBeNull();
  });

  it('filters segments by status and by live QA / edited state', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-filter-changed'));
    expect(screen.queryByTestId('review-row-seg-plain')).toBeNull();
    expect(screen.getByTestId('review-row-seg-inline')).toBeTruthy();

    fireEvent.click(screen.getByTestId('review-filter-all'));
    const raw = await rawSegmentXml('seg-plain');
    fireEvent.change(raw, { target: { value: '只改这一块' } });
    fireEvent.click(screen.getByTestId('review-filter-edited'));
    expect(screen.getByTestId('review-row-seg-plain')).toBeTruthy();
    expect(screen.queryByTestId('review-row-seg-inline')).toBeNull();

    // No live QA issue in this fixture, so the QA filter honestly reports an empty result.
    fireEvent.click(screen.getByTestId('review-filter-qa'));
    expect(screen.getByTestId('review-filter-empty')).toBeTruthy();
  });

  it('toggles compact inline tags across every block from the filter bar', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    expect(document.querySelectorAll('.review-inline-tag')).toHaveLength(0);
    const toggle = screen.getByTestId('review-toggle-tags');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.review-inline-tag').length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Page: inspector                                                          */
/* -------------------------------------------------------------------------- */

describe('BilingualReviewPage inspector', () => {
  it('auto-opens when there are QA issues and collapses to a toggle when clean', async () => {
    // Clean payload: target omits the glossary term would be an error, so translate it.
    installFetch(
      reviewHandler({
        review: () =>
          makeReview({
            segments: [
              { ...inlineSegment(), glossaryHits: [] },
              ...makeReview().segments.slice(1),
            ],
            glossary: [],
            qaReport: { issues: [], errorCount: 0, warningCount: 0, checkedSegments: 3 },
          }),
      }),
    );
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    expect(screen.queryByTestId('review-inspector')).toBeNull();
    fireEvent.click(screen.getByTestId('review-toggle-inspector'));
    expect(screen.getByTestId('review-inspector')).toBeTruthy();
    expect(window.localStorage.getItem('ditaeditor.review.inspector')).toBe('open');
  });

  it('auto-opens on live glossary errors and jumps to the offending segment', async () => {
    installFetch(
      reviewHandler({
        review: () =>
          makeReview({
            segments: [
              {
                ...inlineSegment(),
                changeKind: 'modified',
                currSourceXml: '<p>Configure the gateway.</p>',
                sourceText: 'Configure the gateway.',
                proposedTargetXml: '<p>部署 闸道。</p>',
                proposedTargetText: '部署 闸道。',
              },
              ...makeReview().segments.slice(1),
            ],
          }),
      }),
    );
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    await waitFor(() =>
      expect(screen.getByTestId('review-qa-errors').textContent).toMatch(/[1-9]/),
    );
    expect(screen.getByTestId('review-inspector')).toBeTruthy();
    expect(screen.getByTestId('review-qa-list').textContent).toContain('闸道');

    fireEvent.click(screen.getByTestId('review-qa-issue-0'));
    expect(screen.getByTestId('review-row-seg-inline')).toBeTruthy();
  });

  it('inserts a matched term into the focused block from the inspector', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    // Matched terms open the inspector automatically, so only toggle when it is collapsed.
    if (!screen.queryByTestId('review-inspector')) {
      fireEvent.click(screen.getByTestId('review-toggle-inspector'));
    }
    expect(screen.getByTestId('review-glossary-hits').textContent).toContain('闸道');

    fireEvent.click(screen.getByTestId('review-insert-term-gateway'));
    await waitFor(() =>
      expect(screen.getByTestId('review-target-seg-inline').textContent).toContain('网关'),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Page: shortcuts                                                          */
/* -------------------------------------------------------------------------- */

describe('BilingualReviewPage shortcuts', () => {
  it('saves with Cmd/Ctrl+S and steps segments with Alt+ArrowDown', async () => {
    const calls = installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    const raw = await rawSegmentXml('seg-inline');
    fireEvent.change(raw, { target: { value: '<p>快捷键保存</p>' } });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.path === '/api/translation/items/item-1/review' && call.method === 'PUT',
        ),
      ).toBe(true),
    );

    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true });
    expect(await screen.findByTestId('review-segment-editor-seg-code')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByTestId('review-segment-editor-seg-code')).toBeNull(),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Page: inline QA diagnostics and 1-click repair                           */
/* -------------------------------------------------------------------------- */

const QA_SOURCE = '<p id="p-qa">Configure the <b>gateway</b> before publishing.</p>';

/** Target drops the inline `<b>` *and* uses the forbidden glossary gloss. */
function qaSegment(): TranslationSegmentReviewView {
  return {
    ...inlineSegment(),
    segmentId: 'seg-qa',
    elementId: 'p-qa',
    structuralPath: 'concept/conbody/p[1]',
    currSourceXml: QA_SOURCE,
    sourceText: 'Configure the gateway before publishing.',
    prevSourceText: null,
    prevTargetText: null,
    proposedTargetXml: '<p id="p-qa">配置 闸道 后发布。</p>',
    proposedTargetText: '配置 闸道 后发布。',
  };
}

/** Only the protected `scope` attribute drifted, so no missing-tag chip can repair it. */
function scopeSegment(): TranslationSegmentReviewView {
  return {
    ...inlineSegment(),
    segmentId: 'seg-scope',
    elementId: 'p-scope',
    structuralPath: 'concept/conbody/p[3]',
    currSourceXml:
      `<p id="p-scope">See ${XREF}themes</xref>.</p>`,
    sourceText: 'See themes.',
    prevSourceText: null,
    prevTargetText: null,
    proposedTargetXml:
      '<p id="p-scope">参见 <xref href="../references/publish-themes.dita" scope="external">主题</xref>。</p>',
    proposedTargetText: '参见 主题。',
    glossaryHits: [],
  };
}

function qaReview(segments: TranslationSegmentReviewView[]): TranslationReviewPayload {
  return makeReview({ segments });
}

describe('BilingualReviewPage inline QA repair', () => {
  it('frames every paired row as a scannable card: row number, no repeated target label, QA button', async () => {
    installFetch(reviewHandler({ review: () => qaReview([qaSegment()]) }));
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    expect(screen.getByTestId('review-row-index-seg-qa').textContent).toBe('#1');

    const row = screen.getByTestId('review-row-seg-qa');
    // The sticky column header already owns the target-language label; rows must not repeat it.
    expect(within(row).queryByText(translate('translation.review.targetColumn'))).toBeNull();

    const chip = within(row).getByTestId('review-segment-qa-seg-qa');
    expect(chip.tagName).toBe('BUTTON');
    expect(chip.className).toContain('review-qa-chip--error');
  });

  it('explains each QA issue on the block and repairs a dropped inline tag in one click', async () => {
    installFetch(reviewHandler({ review: () => qaReview([qaSegment()]) }));
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-segment-qa-seg-qa'));
    const box = await screen.findByTestId('review-qa-box-seg-qa');
    expect(box.getAttribute('data-severity')).toBe('error');
    expect(box.textContent).toContain(translate('translation.review.qaFixTitle'));
    // Severity is written out, never implied by colour alone.
    expect(box.textContent).toContain(translate('translation.review.qaError'));
    expect(box.querySelector('[data-code="inline_tag_mismatch"]')).not.toBeNull();
    expect(box.querySelector('[data-code="missing_glossary_term"]')).not.toBeNull();

    const chips = await within(box).findAllByTestId(/^review-insert-tag-seg-qa-/);
    expect(chips.some((chip) => chip.textContent?.includes('<b>'))).toBe(true);
    fireEvent.click(chips[0] as HTMLElement);

    await waitFor(() =>
      expect(
        screen
          .getByTestId('review-qa-box-seg-qa')
          .querySelector('[data-code="inline_tag_mismatch"]'),
      ).toBeNull(),
    );
    // The repair actually landed in the draft, not only in the UI.
    expect(screen.getByTestId('review-segment-editor-seg-qa').textContent).toContain('gateway');
  });

  it('inserts the glossary target straight from its QA issue and clears that error', async () => {
    installFetch(reviewHandler({ review: () => qaReview([qaSegment()]) }));
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-segment-qa-seg-qa'));
    await screen.findByTestId('review-qa-box-seg-qa');

    const button = await screen.findByTestId(/^review-qa-insert-glossary-seg-qa-\d+$/);
    expect(button.textContent).toContain('网关');
    fireEvent.click(button);

    await waitFor(() =>
      expect(
        screen
          .getByTestId('review-qa-box-seg-qa')
          .querySelector('[data-code="missing_glossary_term"]'),
      ).toBeNull(),
    );
    // The forbidden gloss is still reported: fixing one issue must not hide the rest.
    expect(
      screen
        .getByTestId('review-qa-box-seg-qa')
        .querySelector('[data-code="forbidden_translation"]'),
    ).not.toBeNull();
  });

  it('switches to raw XML for a protected attribute drift that no chip can repair', async () => {
    installFetch(reviewHandler({ review: () => qaReview([scopeSegment()]) }));
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-segment-qa-seg-scope'));
    const box = await screen.findByTestId('review-qa-box-seg-scope');
    expect(box.querySelector('[data-code="protected_attr_modified"]')).not.toBeNull();
    expect(within(box).queryAllByTestId(/^review-insert-tag-seg-scope-/)).toHaveLength(0);

    fireEvent.click(await screen.findByTestId('review-qa-xml-fix-seg-scope-0'));
    await waitFor(() =>
      expect(
        screen.getByTestId('review-segment-editor-seg-scope').getAttribute('data-mode'),
      ).toBe('xml'),
    );
    expect(
      (screen.getByTestId('review-segment-xml-seg-scope') as HTMLTextAreaElement).value,
    ).toContain('scope="external"');
  });

  it('prefills the AI refine box with the QA issues of the block', async () => {
    installFetch(reviewHandler({ review: () => qaReview([qaSegment()]) }));
    renderReview();
    await screen.findByTestId('bilingual-review-page');

    fireEvent.click(screen.getByTestId('review-segment-qa-seg-qa'));
    await screen.findByTestId('review-qa-box-seg-qa');

    fireEvent.click(screen.getByTestId('review-qa-ai-fix-seg-qa'));
    const input = (await screen.findByLabelText(
      translate('translation.review.aiRefineTitle'),
    )) as HTMLTextAreaElement;
    expect(input.value).toContain('Inline element <b> count changed');
    expect(input.value).toContain('Glossary term "gateway"');
  });
});

/* -------------------------------------------------------------------------- */
/* 6b. Inspector: Phase 16 gates                                               */
/* -------------------------------------------------------------------------- */

describe('BilingualReviewPage inspector — Phase 16 gates', () => {
  const AI_REVIEW: TranslationAiReviewReport = {
    verdict: 'revise',
    model: 'reviewer-fallback-model',
    isDedicatedModel: false,
    summary: 'The code block lost its id attribute.',
    reviewRounds: 1,
    qaRepairRounds: 2,
    repairedSegments: 2,
    initialQaErrors: 3,
    remainingQaErrors: 0,
    issues: [
      {
        segmentId: 'seg-inline',
        severity: 'warning',
        category: 'markup',
        message: 'Inline tag order changed.',
        suggestion: 'Keep <b><i> in the source order.',
      },
    ],
    stale: true,
    updatedAt: '2026-01-05T00:00:00.000Z',
  };

  const SKIPPED_STRICT: TranslationDitaOtItemReport = {
    status: 'skipped',
    repaired: false,
    repairAttempts: 0,
    errorCount: 0,
    warningCount: 0,
    diagnostics: [],
    reason: 'DITA-OT is unavailable in this environment.',
    stale: true,
    updatedAt: '2026-01-05T00:00:00.000Z',
  };

  function openInspector(): void {
    if (!screen.queryByTestId('review-inspector')) {
      fireEvent.click(screen.getByTestId('review-toggle-inspector'));
    }
  }

  it('labels an inherited reviewer model and marks both reports stale', async () => {
    installFetch(
      reviewHandler({ review: () => makeReview({ aiReview: AI_REVIEW, ditaOtReport: SKIPPED_STRICT }) }),
    );
    renderReview();
    await screen.findByTestId('bilingual-review-page');
    openInspector();

    const aiCard = screen.getByTestId('review-ai-review');
    // the verdict pill rides in the section head, the stats and issues live in the card
    expect(screen.getByTestId('review-ai-verdict').textContent).toContain(
      translate('translation.aiReview.verdict.revise'),
    );
    // an inheriting reviewer must say so, otherwise the operator assumes a second model ran
    expect(aiCard.textContent).toContain(translate('translation.review.aiReviewInherited'));
    expect(aiCard.textContent).toContain('reviewer-fallback-model');
    expect(screen.getByTestId('review-ai-stale').textContent).toContain(
      translate('translation.aiReview.stale'),
    );
    // 3 → 0 QA errors across 2 repair rounds
    const stats = within(aiCard).getByTestId('review-ai-qa-stats').textContent ?? '';
    expect(stats).toContain('3');
    expect(stats).toContain('0');

    const ditaOtCard = screen.getByTestId('review-ditaot');
    expect(screen.getByTestId('review-ditaot-status').textContent).toContain(
      translate('translation.ditaOt.status.skipped'),
    );
    expect(within(ditaOtCard).getByTestId('review-ditaot-stale')).toBeTruthy();
    expect(within(ditaOtCard).queryByTestId('review-ditaot-repaired')).toBeNull();
    expect(within(ditaOtCard).getByTestId('review-ditaot-reason').textContent).toContain(
      'DITA-OT is unavailable',
    );
    expect(
      within(ditaOtCard).getByText(translate('translation.review.ditaOtNoDiagnostics')),
    ).toBeTruthy();
  });

  it('keeps the gate cards empty (and the header pill-free) before either report exists', async () => {
    installFetch(reviewHandler());
    renderReview();
    await screen.findByTestId('bilingual-review-page');
    openInspector();

    expect(screen.getByTestId('review-ai-review').textContent).toContain(
      translate('translation.review.aiReviewEmpty'),
    );
    expect(screen.getByTestId('review-ditaot').textContent).toContain(
      translate('translation.review.ditaOtEmpty'),
    );
    expect(screen.queryByTestId('review-header-ai-review')).toBeNull();
    expect(screen.queryByTestId('review-header-ditaot')).toBeNull();
    // without a report there is nothing to re-run from the card
    expect(screen.queryByTestId('review-rerun-strict')).toBeNull();
  });
});
