// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  IndexedTopicElement,
  KeyspaceResult,
  ResolvedConrefResult,
  TopicIdIndexEntry,
} from '@dita/core';
import { ConrefReusePanel } from '../src/components/ConrefReusePanel';

/**
 * `ConrefReusePanel` candidate rows used to carry an amber "不兼容" badge next to every element
 * whose tag could not host the current selection. The badge duplicated information the disabled
 * "Bind to current element" button already conveys, so it was removed — while tag compatibility
 * itself must still gate that button, which is what these DOM assertions pin down.
 */

const SHARED_PATH = 'shared/common-reuse.dita';

function reusableNote(): IndexedTopicElement {
  return {
    filePath: SHARED_PATH,
    topicId: 'common_reuse',
    elementId: 'backup_warning',
    fragment: 'common_reuse/backup_warning',
    tagName: 'note',
    isTopicRoot: false,
    previewText: 'Back up production data before upgrading.',
    line: 7,
    column: 3,
    elementPath: [0, 1],
    hasConref: false,
  };
}

function keyspace(): KeyspaceResult {
  return {
    rootMapPath: 'root.ditamap',
    keys: {
      common_reuse: {
        key: 'common_reuse',
        qualifiedKey: 'common_reuse',
        sourceMapPath: 'root.ditamap',
        elementPath: [0],
        tagName: 'topicref',
        line: 4,
        column: 3,
        href: SHARED_PATH,
        resolvedHref: SHARED_PATH,
        isExternal: false,
        shadowedCount: 0,
      },
    },
    allDefinitions: [],
    scopes: [],
    referencedTopics: [SHARED_PATH],
    mapCycles: [],
  };
}

function topicIndices(): TopicIdIndexEntry[] {
  return [
    {
      filePath: SHARED_PATH,
      rootTag: 'concept',
      rootTopicId: 'common_reuse',
      title: 'Shared snippets',
      elements: [reusableNote()],
      profilingValues: {
        audience: [],
        platform: [],
        product: [],
        props: [],
        otherprops: [],
        rev: [],
        importance: [],
        status: [],
      } as TopicIdIndexEntry['profilingValues'],
      wellFormed: true,
    },
  ];
}

const NOOP_PROPS = {
  activeDocPath: 'topics/workspace-model.dita',
  onResolvePreview: vi.fn(
    async (): Promise<ResolvedConrefResult> => ({
      sourceFilePath: SHARED_PATH,
      sourceTagName: 'note',
      attrName: 'conkeyref',
      rawValue: 'common_reuse/backup_warning',
      status: 'resolved',
    }),
  ),
  onConfirm: vi.fn(),
};

function renderPanel(selectedElementTag: string | null) {
  const utils = render(
    <ConrefReusePanel
      {...NOOP_PROPS}
      selectedElementTag={selectedElementTag}
      keyspace={keyspace()}
      topicIndices={topicIndices()}
    />,
  );
  // Picking a Key is what materializes the candidate list.
  fireEvent.change(utils.container.querySelector('#conref-panel-key') as HTMLSelectElement, {
    target: { value: 'common_reuse' },
  });
  return utils;
}

/** Clicking a candidate row is what reveals the insertion / bind action section. */
function pickCandidate(): void {
  fireEvent.click(screen.getByText('#backup_warning'));
}

function bindButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /绑定当前|Bind current/ }) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ConrefReusePanel candidate rows', () => {
  it('renders the reusable element without an "incompatible" badge', () => {
    renderPanel('concept');

    expect(screen.getByText('#backup_warning')).toBeTruthy();
    // The removed badge was the only place these strings appeared in this panel.
    expect(screen.queryByText('不兼容')).toBeNull();
    expect(screen.queryByText('Incompatible')).toBeNull();
  });

  it('still disables "Bind to current element" when tag names are incompatible', () => {
    renderPanel('concept');
    pickCandidate();
    expect(bindButton().disabled).toBe(true);
  });

  it('enables "Bind to current element" for a compatible tag', () => {
    renderPanel('note');
    pickCandidate();
    expect(bindButton().disabled).toBe(false);
  });
});
