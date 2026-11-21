import { describe, expect, it } from 'vitest';
import type { IndexedTopicElement, KeyspaceResult, TopicIdIndexEntry } from '@dita/core';
import {
  buildReuseAttrValue,
  filterReusableElements,
  listKeyBoundTopics,
} from '../src/components/conref-reuse-model';

function element(overrides: Partial<IndexedTopicElement> = {}): IndexedTopicElement {
  return {
    filePath: 'shared/common-reuse.dita',
    topicId: 'common_reuse',
    elementId: 'backup_warning',
    fragment: 'common_reuse/backup_warning',
    tagName: 'note',
    isTopicRoot: false,
    previewText: '在执行生产环境升级前，请务必先完成备份。',
    line: 7,
    column: 3,
    elementPath: [0, 1],
    hasConref: false,
    ...overrides,
  };
}

function entry(elements: IndexedTopicElement[]): TopicIdIndexEntry {
  return {
    filePath: 'shared/common-reuse.dita',
    rootTag: 'concept',
    rootTopicId: 'common_reuse',
    title: '共用复用片段',
    elements,
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
  };
}

describe('Conref reuse panel model (conkeyref / conref value composition)', () => {
  it('composes a conkeyref from the selected key and element id', () => {
    expect(
      buildReuseAttrValue({
        attrName: 'conkeyref',
        selectedKey: 'common_reuse',
        target: element(),
        activeDocPath: 'topics/workspace-model.dita',
      }),
    ).toBe('common_reuse/backup_warning');
  });

  it('returns an empty conkeyref when no key is selected yet', () => {
    expect(
      buildReuseAttrValue({
        attrName: 'conkeyref',
        selectedKey: '',
        target: element(),
        activeDocPath: 'topics/workspace-model.dita',
      }),
    ).toBe('');
  });

  it('composes a cross-directory conref with a POSIX relative href', () => {
    expect(
      buildReuseAttrValue({
        attrName: 'conref',
        selectedKey: '',
        target: element(),
        activeDocPath: 'topics/workspace-model.dita',
      }),
    ).toBe('../shared/common-reuse.dita#common_reuse/backup_warning');
  });

  it('composes a same-file conref as a bare fragment', () => {
    expect(
      buildReuseAttrValue({
        attrName: 'conref',
        selectedKey: '',
        target: element({ filePath: 'topics/workspace-model.dita' }),
        activeDocPath: 'topics/workspace-model.dita',
      }),
    ).toBe('#common_reuse/backup_warning');
  });

  it('returns an empty value when nothing is picked', () => {
    expect(
      buildReuseAttrValue({
        attrName: 'conref',
        selectedKey: '',
        target: null,
        activeDocPath: 'topics/workspace-model.dita',
      }),
    ).toBe('');
  });
});

describe('Conref reuse panel model (candidate filtering)', () => {
  const elements = [
    element({ elementId: 'common_reuse', tagName: 'concept', isTopicRoot: true }),
    element({ elementId: 'backup_warning', tagName: 'note' }),
    element({
      elementId: 'support_email',
      tagName: 'ph',
      fragment: 'common_reuse/support_email',
      previewText: 'support@example.com',
    }),
  ];

  it('never offers the topic root as a conref target', () => {
    const ids = filterReusableElements(entry(elements), '').map((el) => el.elementId);
    expect(ids).toEqual(['backup_warning', 'support_email']);
  });

  it('matches element id, tag name and preview text case-insensitively', () => {
    expect(filterReusableElements(entry(elements), 'BACKUP').map((el) => el.elementId)).toEqual([
      'backup_warning',
    ]);
    expect(filterReusableElements(entry(elements), 'ph').map((el) => el.elementId)).toEqual([
      'support_email',
    ]);
    expect(filterReusableElements(entry(elements), 'example.com').map((el) => el.elementId)).toEqual(
      ['support_email'],
    );
  });

  it('returns nothing when the topic entry is missing', () => {
    expect(filterReusableElements(undefined, '')).toEqual([]);
  });
});

describe('Conref reuse panel model (key candidates)', () => {
  const keyspace = {
    keys: {
      common_reuse: {
        qualifiedKey: 'common_reuse',
        resolvedHref: 'shared/common-reuse.dita',
        isExternal: false,
        declaredIn: 'maps/demo.ditamap',
      },
      docs_site: {
        qualifiedKey: 'docs_site',
        resolvedHref: 'https://example.com/docs',
        isExternal: true,
        declaredIn: 'maps/demo.ditamap',
      },
      alpha: {
        qualifiedKey: 'alpha',
        resolvedHref: 'concepts/alpha.dita',
        isExternal: false,
        declaredIn: 'maps/demo.ditamap',
      },
    },
  } as unknown as KeyspaceResult;

  it('keeps only keys that resolve to a local file and sorts them', () => {
    expect(listKeyBoundTopics(keyspace)).toEqual([
      { qualifiedKey: 'alpha', resolvedHref: 'concepts/alpha.dita' },
      { qualifiedKey: 'common_reuse', resolvedHref: 'shared/common-reuse.dita' },
    ]);
  });

  it('handles a missing keyspace', () => {
    expect(listKeyBoundTopics(null)).toEqual([]);
  });
});
