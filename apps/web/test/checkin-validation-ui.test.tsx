import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Same SSR harness as `phase13-ui-components.test.tsx`: React 19's `getServerSnapshot` would
// otherwise read Zustand's initial state, so point `useStore` at the live store during render.
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

import { translate } from '../src/i18n/index.js';
import type { AiProposal } from '../src/ai/ai-types';
import { resetAiStore, useAiStore } from '../src/ai/ai-store';
import { AiAssistantPanel } from '../src/ai/AiAssistantPanel';
import { AiDiffDialog } from '../src/ai/AiDiffDialog';
import {
  CheckinDialog,
  applyCheckinAiFix,
  countCheckinIssues,
  resolveCheckinSubmit,
  summarizeCheckinIssues,
  type CheckinIssue,
} from '../src/components/CheckinDialog';
import type { IdentityUser } from '../src/services/identity-api';
import { useGitStore } from '../src/store/git-store';
import { switchLocale } from '../src/i18n/index.js';

// React 19's `renderToStaticMarkup` reads each Zustand hook's server snapshot, which is the state
// captured at module creation — and `test/setup-locale.ts` imports the locale store before this
// file's `zustand` mock is registered, so components render with the initial `en-US` locale no
// matter what `switchLocale` sets. Assertions therefore use the English catalog, like
// `phase13-ui-components.test.tsx` does.
const st = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) =>
  translate('en', key, params);

/** Static markup escapes `&`, so compare against the HTML-escaped copy. */
const esc = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const WRITER: IdentityUser = {
  id: 'u-writer-1',
  displayName: '林知远',
  initials: '林',
  email: 'lin@dita.local',
  color: '#0f766e',
  role: 'writer',
};

const TOPIC_PATH = 'concepts/checkin-a.dita';
const OTHER_PATH = 'concepts/checkin-b.dita';

const TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="a"><title>A</title><body><p>ok</p></body></concept>`;

const PROPOSAL: AiProposal = {
  explanation: '修复结构错误。',
  changesSummary: ['调整 <step> 子元素顺序'],
  originalXml: TOPIC_XML,
  patchedXml: TOPIC_XML.replace('<p>ok</p>', '<p>fixed</p>'),
  targetMode: 'line-window',
  targetTag: 'step',
  verification: {
    wellFormed: true,
    prosemirrorCompatible: true,
    preservedDoctype: true,
    retryCount: 0,
    warnings: [],
  },
  canRevalidateStrict: true,
};

function issue(overrides: Partial<CheckinIssue> = {}): CheckinIssue {
  return {
    filePath: TOPIC_PATH,
    line: 17,
    column: 3,
    severity: 'error',
    source: 'structure',
    message: '元素 <step> 缺少必需的子元素 <cmd>',
    ...overrides,
  };
}

function renderCheckin(props: Partial<React.ComponentProps<typeof CheckinDialog>> = {}) {
  return renderToStaticMarkup(
    React.createElement(CheckinDialog, {
      open: true,
      candidates: [{ path: TOPIC_PATH }],
      onClose: () => undefined,
      onConfirm: async () => true,
      ...props,
    }),
  );
}

function buttonTag(html: string, testId: string): string {
  const index = html.indexOf(`data-testid="${testId}"`);
  if (index < 0) return '';
  const start = html.lastIndexOf('<button', index);
  const end = html.indexOf('>', index);
  return html.slice(start, end + 1);
}

function renderPanel(props: Partial<React.ComponentProps<typeof AiAssistantPanel>> = {}) {
  return renderToStaticMarkup(
    React.createElement(AiAssistantPanel, {
      filePath: TOPIC_PATH,
      xml: TOPIC_XML,
      target: { mode: 'full-document' },
      canApply: true,
      readOnly: false,
      onApplyProposal: () => undefined,
      ...props,
    }),
  );
}

beforeEach(() => {
  resetAiStore();
  switchLocale('zh-CN');
  useGitStore.setState({
    currentUser: WRITER,
    locks: [],
    userDrafts: [],
    diff: null,
    externalDirtyFiles: [],
    error: null,
    diffLoading: false,
  });
});

describe('WEB-1: blocking errors in the check-in dialog', () => {
  it('renders the error block, a per-file error badge and a disabled submit button', () => {
    const blocking = issue();
    const html = renderCheckin({
      issuesByPath: { [TOPIC_PATH]: [blocking] },
      onJumpToIssue: () => undefined,
      onAiFixIssue: () => undefined,
    });

    expect(html).toContain('data-testid="checkin-blocking-errors"');
    expect(html).toContain(`data-testid="checkin-badge-errors-${TOPIC_PATH}"`);
    expect(html).toContain(st('checkin.validationErrors', { count: 1 }));
    expect(html).toContain(st('checkin.aiFix'));
    expect(html).toContain(st('checkin.jumpToSource'));
    expect(html).toContain(`data-testid="checkin-jump-${TOPIC_PATH}"`);
    expect(html).toContain(`data-testid="checkin-ai-fix-${TOPIC_PATH}"`);

    const submit = buttonTag(html, 'checkin-submit');
    expect(submit).toContain('disabled=""');
    expect(submit).toContain(st('checkin.blockedByErrors'));
  });

  it('hides the UI hints when the caller wires no jump/fix handlers', () => {
    const html = renderCheckin({ issuesByPath: { [TOPIC_PATH]: [issue()] } });
    expect(html).toContain('data-testid="checkin-blocking-errors"');
    expect(html).not.toContain(`data-testid="checkin-ai-fix-${TOPIC_PATH}"`);
    expect(html).not.toContain(`data-testid="checkin-jump-${TOPIC_PATH}"`);
  });
});

describe('WEB-2: unchecking the failing draft re-enables the commit', () => {
  it('keeps the commit blocked while a selected file still has errors', () => {
    const issuesByPath = { [TOPIC_PATH]: [issue()] };
    const { blockingErrors } = summarizeCheckinIssues(issuesByPath, [TOPIC_PATH]);
    const gate = resolveCheckinSubmit({
      selected: [TOPIC_PATH],
      message: 'fix ready',
      busy: false,
      conflictingExternalPaths: [],
      blockingErrors,
    });
    expect(gate).toEqual({ canSubmit: false, blockedReason: 'errors' });
  });

  it('allows the commit once the failing file is deselected and a message is present', () => {
    const issuesByPath = {
      [TOPIC_PATH]: [issue()],
      [OTHER_PATH]: [] as CheckinIssue[],
    };
    const { blockingErrors } = summarizeCheckinIssues(issuesByPath, [OTHER_PATH]);
    expect(blockingErrors).toHaveLength(0);
    expect(
      resolveCheckinSubmit({
        selected: [OTHER_PATH],
        message: 'only the clean draft',
        busy: false,
        conflictingExternalPaths: [],
        blockingErrors,
      }),
    ).toEqual({ canSubmit: true, blockedReason: 'none' });
  });
});

describe('WEB-3: AI Fix hand-off from the dialog', () => {
  it('closes the dialog first, then forwards the exact issue to the workbench', () => {
    const calls: string[] = [];
    const blocking = issue();
    let received: CheckinIssue | null = null;
    applyCheckinAiFix(blocking, {
      onClose: () => calls.push('close'),
      onAiFixIssue: (value) => {
        calls.push('fix');
        received = value;
      },
    });
    expect(calls).toEqual(['close', 'fix']);
    expect(received).toEqual(blocking);
    expect(received).toMatchObject({
      filePath: TOPIC_PATH,
      line: 17,
      column: 3,
      source: 'structure',
    });
  });
});

describe('WEB-4: warnings never block the commit', () => {
  it('shows an amber notice instead of the blocking alert and stays submittable', () => {
    const warning = issue({ severity: 'warning', source: 'keyref', message: 'keyref 未解析' });
    const html = renderCheckin({ issuesByPath: { [TOPIC_PATH]: [warning] } });

    expect(html).toContain('data-testid="checkin-warnings-only"');
    expect(html).toContain(st('checkin.validationWarnings', { count: 1 }));
    expect(html).not.toContain('data-testid="checkin-blocking-errors"');
    expect(html).toContain(`data-testid="checkin-badge-warnings-${TOPIC_PATH}"`);

    const { blockingErrors, warnings } = summarizeCheckinIssues(
      { [TOPIC_PATH]: [warning] },
      [TOPIC_PATH],
    );
    expect(warnings).toHaveLength(1);
    expect(
      resolveCheckinSubmit({
        selected: [TOPIC_PATH],
        message: 'ship the warning',
        busy: false,
        conflictingExternalPaths: [],
        blockingErrors,
      }),
    ).toEqual({ canSubmit: true, blockedReason: 'none' });
  });

  it('marks a clean draft as valid', () => {
    const html = renderCheckin({ issuesByPath: { [TOPIC_PATH]: [] } });
    expect(html).toContain(`data-testid="checkin-badge-valid-${TOPIC_PATH}"`);
    expect(html).toContain(st('checkin.statusValid'));
    expect(html).not.toContain('data-testid="checkin-warnings-only"');
  });
});

// The backend gate (validateDitaFileForCheckin) only rejects xml/structure/ditaval errors, so the
// dialog must treat indexer-reported cross-file reference errors as non-blocking warnings or team
// authoring would dead-end on issues the commit endpoint happily accepts.
describe('Phase 14: cross-file reference errors are non-blocking warnings', () => {
  const CROSS_FILE = ['keyref', 'conref', 'conref-cycle', 'map-ref', 'asset-ref'] as const;
  const BLOCKING = ['xml', 'structure', 'ditaval'] as const;

  it('classifies every cross-file indexer error as a warning', () => {
    const issues = CROSS_FILE.map((source) =>
      issue({ source, severity: 'error', message: `unresolved ${source} target` }),
    );
    const summary = summarizeCheckinIssues({ [TOPIC_PATH]: issues }, [TOPIC_PATH]);
    expect(summary.blockingErrors).toHaveLength(0);
    expect(summary.warnings).toHaveLength(CROSS_FILE.length);
    expect(countCheckinIssues(issues)).toEqual({ errors: 0, warnings: CROSS_FILE.length });
  });

  it('still blocks on xml, structure and ditaval errors', () => {
    for (const source of BLOCKING) {
      const issues = [issue({ source })];
      const summary = summarizeCheckinIssues({ [TOPIC_PATH]: issues }, [TOPIC_PATH]);
      expect(summary.blockingErrors).toHaveLength(1);
      expect(summary.warnings).toHaveLength(0);
      expect(countCheckinIssues(issues)).toEqual({ errors: 1, warnings: 0 });
      expect(
        resolveCheckinSubmit({
          selected: [TOPIC_PATH],
          message: 'ship it',
          busy: false,
          conflictingExternalPaths: [],
          blockingErrors: summary.blockingErrors,
        }),
      ).toEqual({ canSubmit: false, blockedReason: 'errors' });
    }
  });

  it('renders an indexer keyref error as a warning badge and never blocks the commit', () => {
    const issues = [issue({ source: 'keyref', severity: 'error', message: 'keyref 未解析' })];
    const html = renderCheckin({ issuesByPath: { [TOPIC_PATH]: issues } });

    expect(html).toContain(`data-testid="checkin-badge-warnings-${TOPIC_PATH}"`);
    expect(html).not.toContain(`data-testid="checkin-badge-errors-${TOPIC_PATH}"`);
    expect(html).not.toContain('data-testid="checkin-blocking-errors"');
    expect(html).toContain('data-testid="checkin-warnings-only"');
    expect(buttonTag(html, 'checkin-submit')).not.toContain(st('checkin.blockedByErrors'));

    const { blockingErrors } = summarizeCheckinIssues({ [TOPIC_PATH]: issues }, [TOPIC_PATH]);
    expect(
      resolveCheckinSubmit({
        selected: [TOPIC_PATH],
        message: 'check in despite the unresolved keyref',
        busy: false,
        conflictingExternalPaths: [],
        blockingErrors,
      }),
    ).toEqual({ canSubmit: true, blockedReason: 'none' });
  });
});

describe('Phase 14 AI apply labels (WEB-6/WEB-7)', () => {
  beforeEach(() => {
    useAiStore.setState({ proposal: PROPOSAL, verification: PROPOSAL.verification, applied: false });
  });

  it('labels the primary action as check-out-and-apply for an unlocked file', () => {
    const html = renderPanel({ applyMode: 'checkout-and-apply', workspaceMode: 'api' });
    expect(html).toContain(esc(st('ai.proposal.applyCheckoutDraft')));
    expect(buttonTag(html, 'ai-apply-button')).not.toContain('disabled=""');
  });

  it('labels a plain draft apply once I hold the lock', () => {
    const html = renderPanel({ applyMode: 'apply', workspaceMode: 'api' });
    expect(html).toContain(st('ai.proposal.applyDraft'));
    expect(html).not.toContain(st('ai.proposal.applyCheckoutDraft'));
  });

  it('labels memory mode without mentioning drafts', () => {
    const html = renderPanel({ applyMode: 'apply', workspaceMode: 'memory' });
    expect(html).toContain(st('ai.proposal.apply'));
    expect(html).not.toContain(st('ai.proposal.applyDraft'));
  });

  it('disables the button and shows progress while the patch is applying', () => {
    useAiStore.setState({
      applyOutcome: {
        status: 'applying',
        checkedOutAutomatically: false,
        filePath: TOPIC_PATH,
      },
    });
    const html = renderPanel({ applyMode: 'checkout-and-apply', workspaceMode: 'api' });
    const button = buttonTag(html, 'ai-apply-button');
    expect(button).toContain('disabled=""');
    expect(html).toContain(st('ai.proposal.applying'));
  });

  it('confirms the saved draft and offers check-in + strict revalidation', () => {
    useAiStore.setState({
      applied: true,
      applyOutcome: {
        status: 'saved-draft',
        checkedOutAutomatically: true,
        filePath: TOPIC_PATH,
      },
    });
    const html = renderPanel({
      applyMode: 'checkout-and-apply',
      workspaceMode: 'api',
      onOpenCheckin: () => undefined,
      onRevalidateStrict: () => undefined,
    });
    expect(html).toContain('data-testid="ai-apply-outcome"');
    expect(html).toContain('data-testid="ai-apply-saved"');
    expect(html).toContain(st('ai.proposal.appliedDraftCheckedOut'));
    expect(html).toContain('data-testid="ai-open-checkin"');
    expect(html).toContain(st('ai.proposal.checkin'));
    expect(html).toContain('data-testid="ai-rerun-strict"');
    expect(html).toContain(st('ai.proposal.rerunStrict'));
  });

  it('degrades to an amber retry banner when the draft save failed', () => {
    useAiStore.setState({
      applied: true,
      applyOutcome: {
        status: 'applied-unsaved',
        checkedOutAutomatically: false,
        filePath: TOPIC_PATH,
        saveError: '磁盘只读',
      },
    });
    const html = renderPanel({
      applyMode: 'apply',
      workspaceMode: 'api',
      onRetrySave: () => undefined,
    });
    expect(html).toContain('data-testid="ai-apply-unsaved"');
    expect(html).toContain(st('ai.proposal.appliedUnsaved', { message: '磁盘只读' }));
    expect(html).toContain('data-testid="ai-retry-save-draft"');
    expect(html).toContain(st('ai.proposal.retrySaveDraft'));
  });
});

describe('Phase 14 AI diff dialog apply affordance', () => {
  it('mirrors the check-out-and-apply label and keeps the button enabled', () => {
    const html = renderToStaticMarkup(
      React.createElement(AiDiffDialog, {
        open: true,
        proposal: PROPOSAL,
        canApply: true,
        readOnly: false,
        applyMode: 'checkout-and-apply',
        workspaceMode: 'api',
        onClose: () => undefined,
        onApply: () => undefined,
      }),
    );
    expect(html).toContain(esc(st('ai.proposal.applyCheckoutDraft')));
    expect(buttonTag(html, 'ai-diff-apply')).not.toContain('disabled=""');
  });

  it('blocks a second click while applying', () => {
    const html = renderToStaticMarkup(
      React.createElement(AiDiffDialog, {
        open: true,
        proposal: PROPOSAL,
        canApply: true,
        readOnly: false,
        applying: true,
        onClose: () => undefined,
        onApply: () => undefined,
      }),
    );
    expect(buttonTag(html, 'ai-diff-apply')).toContain('disabled=""');
    expect(html).toContain(st('ai.proposal.applying'));
  });
});

describe('WEB-12: localization of the new check-in/AI copy', () => {
  it('has every new key in both locales and keeps them distinct', () => {
    const keys = [
      'checkin.validationErrors',
      'checkin.validationWarnings',
      'checkin.statusErrors',
      'checkin.statusWarnings',
      'checkin.statusValid',
      'checkin.statusChecking',
      'checkin.blockedByErrors',
      'checkin.jumpToSource',
      'checkin.aiFix',
      'checkin.warningsOnly',
      'ai.proposal.applyCheckoutDraft',
      'ai.proposal.applyDraft',
      'ai.proposal.applying',
      'ai.proposal.appliedDraft',
      'ai.proposal.appliedDraftCheckedOut',
      'ai.proposal.appliedUnsaved',
      'ai.proposal.retrySaveDraft',
      'ai.proposal.checkin',
      'ai.proposal.rerunStrict',
    ] as const;
    for (const key of keys) {
      const zh = translate('zh-CN', key);
      const en = translate('en', key);
      expect(zh.length, key).toBeGreaterThan(0);
      expect(en.length, key).toBeGreaterThan(0);
      expect(zh, key).not.toBe(key);
      expect(en, key).not.toBe(key);
      expect(zh, key).not.toBe(en);
      // No CJK may leak into the English catalog (mirrors `no-hardcoded-cjk`).
      expect(en, key).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('interpolates the counts instead of hardcoding them', () => {
    expect(translate('zh-CN', 'checkin.statusErrors', { count: 3 })).toContain('3');
    expect(translate('en', 'checkin.statusErrors', { count: 3 })).toContain('3');
    expect(translate('en', 'checkin.validationErrors', { count: 2 })).toContain('2');
  });
});
