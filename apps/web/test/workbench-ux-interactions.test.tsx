// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAssistantPanel } from '../src/ai/AiAssistantPanel';
import { LockStatusBar } from '../src/components/LockStatusBar';
import { ReadOnlyBanner } from '../src/components/ReadOnlyBanner';
import { WorkbenchHeader } from '../src/components/WorkbenchHeader';
import { useAiStore } from '../src/ai/ai-store';
import { useHelpCenterStore } from '../src/store/help-center-store.js';
import { createOxygenTagDom } from '../src/editor/visual/decorations/tag-dom';
import { t as tRaw, useLocaleStore } from '../src/i18n/index.js';
import type { FileEditability } from '../src/services/lock-helpers';

// `apps/web/test/setup-locale.ts` pins the module-level `t` to zh-CN. Keep every assertion on the
// same catalogue the component reads from.
beforeEach(() => {
  useLocaleStore.setState({ locale: 'en' });
  useAiStore.setState({
    messages: [],
    proposal: null,
    applied: null,
    draft: '',
    phase: 'idle',
    error: null,
    meta: null,
    config: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const t = (key: Parameters<typeof tRaw>[0], params?: Parameters<typeof tRaw>[1]): string =>
  tRaw(key, params);

describe('createOxygenTagDom: attribute spacing', () => {
  function build(mode: 'tags' | 'full') {
    return createOxygenTagDom(
      'open',
      'concept',
      [{ name: 'id', value: 'concept-1' }],
      mode,
      0,
      {
        isInlineTag: false,
        isContainerStrip: true,
        isSelected: false,
        isUnknown: false,
        onSelect: () => {},
      },
      'en',
    );
  }

  it('does not pad the attribute string with a leading space in full mode', () => {
    const wrapper = build('full');
    const attrs = wrapper.querySelector('.dita-ox-attrs');
    expect(attrs?.textContent).toBe('id="concept-1"');
    // `gap: 4px` on `.dita-ox-body` supplies the visual separator, so the names never fuse.
    expect(wrapper.querySelector('.dita-ox-body')?.textContent).toBe('conceptid="concept-1"');
  });

  it('omits attributes entirely in tags mode', () => {
    const wrapper = build('tags');
    expect(wrapper.querySelector('.dita-ox-attrs')).toBeNull();
    expect(wrapper.querySelector('.dita-ox-body')?.textContent).toBe('concept');
  });
});

describe('ReadOnlyBanner: interactive nudge', () => {
  const editability: FileEditability = {
    editable: false,
    state: 'unlocked',
    reason: 'not checked out',
  };

  function renderBanner(nudgeToken: number) {
    return (
      <ReadOnlyBanner
        editability={editability}
        lock={null}
        busy={false}
        onCheckout={() => {}}
        onRefresh={() => {}}
        nudgeToken={nudgeToken}
      />
    );
  }

  it('pulses the checkout button for ~1.5s after an edit attempt', () => {
    vi.useFakeTimers();
    const { rerender } = render(renderBanner(0));
    const checkout = screen.getByRole('button', { name: new RegExp(t('lock.checkout')) });
    expect(checkout.getAttribute('data-nudging')).toBe('false');

    rerender(renderBanner(1));
    const nudged = screen.getByRole('button', { name: new RegExp(t('lock.checkout')) });
    expect(nudged.getAttribute('data-nudging')).toBe('true');
    expect(nudged.className).toContain('ring-2');

    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(
      screen.getByRole('button', { name: new RegExp(t('lock.checkout')) }).getAttribute('data-nudging'),
    ).toBe('false');
  });
});

describe('AiAssistantPanel: composer chrome', () => {
  function renderPanel() {
    return (
      <AiAssistantPanel
        filePath="topics/intro.dita"
        xml="<topic id='intro'><title>Intro</title></concept>"
        target={{ mode: 'full-document' }}
        canApply
        readOnly={false}
        onApplyProposal={() => {}}
        onOpenSettings={() => {}}
      />
    );
  }

  it('has no dead close button and no duplicated title bar', () => {
    render(renderPanel());
    expect(screen.queryByLabelText(t('ai.close'))).toBeNull();
    expect(screen.queryByText(t('ai.close'))).toBeNull();
    // The panel heading moved into the inspector tab strip with the rest of the panel titles.
    expect(screen.queryByRole('heading', { name: t('ai.title') })).toBeNull();
  });

  it('folds the model pill and settings into the scope row', () => {
    useAiStore.setState({ config: { model: 'gpt-5-mini' } as never });
    render(renderPanel());
    const pill = screen.getByTestId('ai-model-pill');
    expect(pill.textContent).toContain('gpt-5-mini');
    expect(pill.getAttribute('title')).toBe(t('ai.modelPill'));
  });

  it('omits the whole-topic banner in document scope', () => {
    render(renderPanel());
    expect(screen.queryByText(t('ai.scopeBanner.document'))).toBeNull();
    expect(screen.queryByText(t('ai.scopeBanner.fallback'))).toBeNull();
  });

  it('offers three quick prompts that prepare the composer without sending', () => {
    render(renderPanel());
    const composer = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(composer.value).toBe('');

    const quick = screen.getByTestId('ai-quick-prompts');
    const chips = Array.from(quick.querySelectorAll('button'));
    expect(chips).toHaveLength(3);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      t('ai.quick.structure'),
      t('ai.quick.shortdesc'),
      t('ai.quick.summary'),
    ]);

    fireEvent.click(chips[1] as HTMLElement);

    // Draft only: the author still presses send, so no request may start.
    expect(useAiStore.getState().draft).toBe(t('ai.quick.shortdescPrompt'));
    expect(useAiStore.getState().messages).toHaveLength(0);
    expect(useAiStore.getState().phase).toBe('idle');
    const focused = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(focused.value).toBe(t('ai.quick.shortdescPrompt'));
    expect(document.activeElement).toBe(focused);
    // The `shortdesc` prompt is a fragment-scope authoring task.
    expect(screen.getByText(t('ai.scopeBanner.fallback'))).not.toBeNull();
  });
});

const INLINE_EDITABILITY: FileEditability = {
  editable: true,
  state: 'owned',
  reason: 'checked out by you',
  lock: null,
  canForceUnlock: false,
};

const OWNED_LOCK = {
  id: 'lock-1',
  projectId: 'project',
  branch: 'main',
  filePath: 'topics/intro.dita',
  userId: 'user-1',
  userName: 'Ada Writer',
  userColor: '#2563eb',
  userRole: 'writer',
  lockedAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T10:30:00.000Z',
  expired: false,
};

function renderInlineLock(overrides: Partial<React.ComponentProps<typeof LockStatusBar>> = {}) {
  return render(
    <LockStatusBar
      variant="inline"
      filePath="topics/intro.dita"
      editability={INLINE_EDITABILITY}
      lock={OWNED_LOCK}
      busy={false}
      canCheckin
      onCheckout={() => {}}
      onRelease={() => {}}
      onCancelCheckout={() => {}}
      onOpenCheckin={() => {}}
      onForceUnlock={() => {}}
      {...overrides}
    />,
  );
}

describe('LockStatusBar: inline menu', () => {
  it('renders a single state icon and hides the verbs until the menu opens', () => {
    renderInlineLock();
    const trigger = screen.getByTestId('lock-status-trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-label')).toBe(t('lock.state.owned'));
    // One button only: the four-verb row that wrapped the sub-header is gone.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByTestId('lock-status-menu')).toBeNull();
    expect(screen.queryByText(t('lock.checkin'))).toBeNull();
  });

  it('opens the owned-state verbs and runs them through the existing callbacks', () => {
    const onOpenCheckin = vi.fn();
    const onCancelCheckout = vi.fn();
    const onRelease = vi.fn();
    renderInlineLock({ onOpenCheckin, onCancelCheckout, onRelease });

    fireEvent.click(screen.getByTestId('lock-status-trigger'));
    const menu = screen.getByTestId('lock-status-menu');
    expect(menu.getAttribute('role')).toBe('menu');
    // Status summary carries the state badge, the reason and the lock timestamp.
    expect(menu.textContent).toContain(t('lock.state.owned'));
    expect(menu.textContent).toContain('checked out by you');

    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      t('lock.checkin'),
      t('lock.cancelCheckout'),
      t('lock.release'),
    ]);

    fireEvent.click(items[1] as HTMLElement);
    expect(onCancelCheckout).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('lock-status-menu')).toBeNull();

    fireEvent.click(screen.getByTestId('lock-status-trigger'));
    fireEvent.click(screen.getAllByRole('menuitem')[2] as HTMLElement);
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onOpenCheckin).not.toHaveBeenCalled();
  });

  it('disables check-in until the draft has something to commit', () => {
    renderInlineLock({ canCheckin: false });
    fireEvent.click(screen.getByTestId('lock-status-trigger'));
    const checkin = screen.getAllByRole('menuitem')[0] as HTMLButtonElement;
    expect(checkin.disabled).toBe(true);
    expect(checkin.getAttribute('title')).toBe(t('lock.checkinDisabled'));
  });

  it('offers checkout for an unlocked file and force unlock for an admin lock', () => {
    const onCheckout = vi.fn();
    const onForceUnlock = vi.fn();
    const { unmount } = renderInlineLock({
      editability: {
        editable: false,
        state: 'unlocked',
        reason: 'not checked out',
        lock: null,
        canForceUnlock: false,
      },
      lock: null,
      onCheckout,
    });
    fireEvent.click(screen.getByTestId('lock-status-trigger'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      t('lock.checkout'),
    ]);
    fireEvent.click(screen.getAllByRole('menuitem')[0] as HTMLElement);
    expect(onCheckout).toHaveBeenCalledTimes(1);
    unmount();

    renderInlineLock({
      editability: {
        editable: false,
        state: 'locked-by-other',
        reason: 'locked by Ada Writer',
        lock: null,
        canForceUnlock: true,
      },
      onForceUnlock,
    });
    fireEvent.click(screen.getByTestId('lock-status-trigger'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      t('lock.force'),
    ]);
    fireEvent.click(screen.getAllByRole('menuitem')[0] as HTMLElement);
    expect(onForceUnlock).toHaveBeenCalledTimes(1);
  });

  it('dismisses the menu on Escape and on an outside pointerdown', () => {
    renderInlineLock();
    const trigger = screen.getByTestId('lock-status-trigger');

    fireEvent.click(trigger);
    expect(screen.queryByTestId('lock-status-menu')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('lock-status-menu')).toBeNull();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('lock-status-menu')).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('lock-status-menu')).toBeNull();
  });
});

describe('WorkbenchHeader: settings menu', () => {
  const HEADER_IDENTITY = {
    users: [
      {
        id: 'user-1',
        displayName: 'Ada Writer',
        initials: 'AW',
        color: '#2563eb',
        role: 'writer' as const,
      },
    ],
    currentUser: {
      id: 'user-1',
      displayName: 'Ada Writer',
      initials: 'AW',
      color: '#2563eb',
      role: 'writer' as const,
    },
  };

  function renderHeader(overrides: { onSwitchIdentity?: (userId: string) => void } = {}) {
    return render(
      <WorkbenchHeader
        showBrand={false}
        activeTab={null}
        mode="visual"
        xmlError={null}
        leftSidebarOpen
        problemsOpen={false}
        errorCount={0}
        warningCount={0}
        dirtyCount={0}
        identity={HEADER_IDENTITY}
        currentUser={HEADER_IDENTITY.currentUser}
        onSwitchIdentity={overrides.onSwitchIdentity ?? (() => {})}
        onToggleLeftSidebar={() => {}}
        onChangeMode={() => {}}
        onToggleProblems={() => {}}
        showInspectorExpand={false}
        onExpandInspector={() => {}}
      />,
    );
  }

  it('keeps identity, language and help inside the gear menu, hidden until it opens', () => {
    renderHeader();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('group', { name: t('locale.group') })).toBeNull();
    // 员工切换 and 帮助 no longer occupy the header bar.
    expect(screen.queryByLabelText(t('identity.switchAria'))).toBeNull();
    expect(screen.queryByRole('button', { name: t('help.openAria') })).toBeNull();

    const gear = screen.getByTestId('header-settings-button');
    expect(gear.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(gear);

    expect(gear.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: t('header.settings.title') });
    expect(menu.className).toContain('absolute');
    expect(menu.className).toContain('right-0');
    expect(menu.textContent).toContain(t('header.settings.identity'));
    expect(menu.textContent).toContain(t('header.settings.language'));
    expect(menu.textContent).toContain(t('header.settings.help'));
    // All three session controls render inside the menu, never loose on the bar.
    const select = screen.getByLabelText(t('identity.switchAria'));
    expect(menu.contains(select)).toBe(true);
    const locale = screen.getByRole('group', { name: t('locale.group') });
    expect(menu.contains(locale)).toBe(true);
    const help = screen.getByRole('menuitem', { name: t('help.openAria') });
    expect(menu.contains(help)).toBe(true);
  });

  it('switches identity from the menu', () => {
    const onSwitchIdentity = vi.fn();
    renderHeader({ onSwitchIdentity });
    fireEvent.click(screen.getByTestId('header-settings-button'));
    const select = screen.getByLabelText(t('identity.switchAria'));
    fireEvent.change(select, { target: { value: 'user-1' } });
    expect(onSwitchIdentity).toHaveBeenCalledWith('user-1');
  });

  it('opens the help center from the menu and closes the menu', () => {
    useHelpCenterStore.setState({ isOpen: false });
    renderHeader();
    fireEvent.click(screen.getByTestId('header-settings-button'));
    const help = screen.getByRole('menuitem', { name: t('help.openAria') });
    expect(help.textContent).toContain(t('header.settings.help'));
    fireEvent.click(help);
    expect(useHelpCenterStore.getState().isOpen).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
    useHelpCenterStore.setState({ isOpen: false });
  });

  it('renders the bar in order with the settings gear closing the cluster', () => {
    const onOpenPublish = vi.fn();
    const { unmount } = render(
      <WorkbenchHeader
        showBrand={false}
        activeTab={null}
        mode="visual"
        xmlError={null}
        leftSidebarOpen
        problemsOpen={false}
        errorCount={0}
        warningCount={0}
        dirtyCount={2}
        identity={HEADER_IDENTITY}
        currentUser={HEADER_IDENTITY.currentUser}
        onSwitchIdentity={() => {}}
        onToggleLeftSidebar={() => {}}
        onChangeMode={() => {}}
        onToggleProblems={() => {}}
        onOpenPublish={onOpenPublish}
        showInspectorExpand={false}
        onExpandInspector={() => {}}
      />,
    );

    const publish = screen.getByRole('button', { name: t('mapTree.publish') });
    const diagnostics = screen.getByTitle(t('header.problems.toggleTitle'));
    const settings = screen.getByTestId('header-settings-button');

    /** True when `first` precedes `second` in document order. */
    const precedes = (first: HTMLElement, second: HTMLElement): boolean =>
      (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    expect(precedes(publish, diagnostics)).toBe(true);
    expect(precedes(diagnostics, settings)).toBe(true);
    // With the inspector collapsed, the gear is the final button on the bar.
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1]).toBe(settings);
    unmount();

    // With the inspector collapsed, its expander renders after the gear and closes the bar.
    render(
      <WorkbenchHeader
        showBrand={false}
        activeTab={null}
        mode="visual"
        xmlError={null}
        leftSidebarOpen
        problemsOpen={false}
        errorCount={0}
        warningCount={0}
        dirtyCount={0}
        identity={HEADER_IDENTITY}
        currentUser={HEADER_IDENTITY.currentUser}
        onSwitchIdentity={() => {}}
        onToggleLeftSidebar={() => {}}
        onChangeMode={() => {}}
        onToggleProblems={() => {}}
        showInspectorExpand
        onExpandInspector={() => {}}
      />,
    );
    const inspector = screen.getByLabelText(t('header.inspector.expandAria'));
    expect(precedes(screen.getByTestId('header-settings-button'), inspector)).toBe(true);
    const withInspector = screen.getAllByRole('button');
    expect(withInspector[withInspector.length - 1]).toBe(inspector);
  });

  it('dismisses the language menu on Escape and on outside pointerdown', () => {
    renderHeader();
    const gear = screen.getByTestId('header-settings-button');

    fireEvent.click(gear);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(gear);
    expect(screen.queryByRole('menu')).not.toBeNull();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
