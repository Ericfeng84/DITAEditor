import { describe, expect, it } from 'vitest';
import {
  TOPIC_GUIDE_ELEMENT_RULES,
  TOPIC_GUIDE_OCCURRENCE_KEYS,
  buildChildChips,
  buildTopicGuideTree,
  formatSlotLabel,
  getAllowedChildren,
  getGuideElementRuleKey,
  getRequiredAttributes,
  groupChildChips,
  type TopicGuideTreeNode,
} from '../src/components/topicGuideTree.js';

function flatten(node: TopicGuideTreeNode): TopicGuideTreeNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function findSlot(node: TopicGuideTreeNode, tag: string): TopicGuideTreeNode | undefined {
  return flatten(node).find((entry) => entry.tags.includes(tag));
}

describe('buildTopicGuideTree', () => {
  it('roots every topic type at its own tag with `title` as the first required slot', () => {
    for (const type of ['concept', 'task', 'reference', 'topic'] as const) {
      const root = buildTopicGuideTree(type);
      expect(root.tags).toEqual([type]);
      expect(root.anchor).toBe(type);
      expect(root.occurrence).toBe('root');
      expect(root.depth).toBe(0);

      const title = root.children[0];
      expect(title?.tags).toEqual(['title']);
      expect(title?.occurrence).toBe('required');
      expect(title?.depth).toBe(1);
    }
  });

  it('models `<conbody>` as an expanded container whose ordered slots include `<section>`', () => {
    const root = buildTopicGuideTree('concept');
    const conbody = findSlot(root, 'conbody');
    expect(conbody).toBeDefined();
    expect(conbody?.children.length).toBeGreaterThan(0);
    expect(conbody?.children.some((child) => child.tags.includes('section'))).toBe(true);
    // Expanded nodes defer their unordered children to the detail pane.
    expect(conbody?.allowedTags).toEqual([]);
  });

  it('walks task workflow depth: taskbody -> steps -> step -> cmd (required)', () => {
    const root = buildTopicGuideTree('task');
    const steps = findSlot(root, 'steps');
    expect(steps?.children.some((child) => child.tags.includes('step'))).toBe(true);
    const step = findSlot(root, 'step');
    expect(step).toBeDefined();
    const cmd = step?.children.find((child) => child.tags.includes('cmd'));
    expect(cmd?.occurrence).toBe('required');
  });

  it('keeps strict-taskbody discipline but expands `section` under the general task model', () => {
    const strict = buildTopicGuideTree('task', 'strict');
    expect(findSlot(strict, 'section')).toBeUndefined();

    const general = buildTopicGuideTree('task', 'general');
    expect(findSlot(general, 'section')).toBeDefined();
  });

  it('leaves unordered containers as leaves carrying their legal children', () => {
    const root = buildTopicGuideTree('reference');
    const refbody = findSlot(root, 'refbody');
    // `refbody` is not an expanded container: it stays a leaf with allowed children listed.
    expect(refbody?.children).toEqual([]);
    expect(refbody?.allowedTags.length).toBeGreaterThan(0);
  });
});

describe('getAllowedChildren', () => {
  it('lists legal children for a block container', () => {
    const { tags } = getAllowedChildren('conbody');
    expect(tags).toContain('section');
    expect(tags).toContain('p');
  });

  it('reports the required subset of an ordered container', () => {
    const required = getAllowedChildren('step').requiredTags;
    expect(required).toContain('cmd');
    expect(required).not.toContain('info');
  });
});

describe('occurrence labels', () => {
  it('maps every occurrence to a message key', () => {
    expect(Object.keys(TOPIC_GUIDE_OCCURRENCE_KEYS).sort()).toEqual(
      ['oneOrMore', 'optional', 'required', 'root', 'zeroOrMore'].sort(),
    );
  });

  it('renders alternative slots compactly', () => {
    expect(formatSlotLabel(['steps', 'steps-unordered'])).toBe('<steps> | <steps-unordered>');
    expect(formatSlotLabel(['a', 'b', 'c'], 2)).toBe('<a> | <b> | +1');
    expect(formatSlotLabel([])).toBe('');
  });
});

describe('child chips', () => {
  it('groups inline, block, and structural children in a stable order', () => {
    const { tags, requiredTags } = getAllowedChildren('conbody');
    const chips = buildChildChips(tags, requiredTags, 'en');
    const groups = groupChildChips(chips).map((entry) => entry.group);
    expect(groups).toEqual([...new Set(groups)]);
    expect(groups[0]).toBe('structure');
    expect(chips.find((chip) => chip.tag === 'p')?.group).toBe('block');
    expect(chips.every((chip) => chip.label.length > 0)).toBe(true);
  });
});

describe('authoring rules', () => {
  it('covers the tags authors actually author, with a message key each', () => {
    for (const tag of ['title', 'shortdesc', 'conbody', 'taskbody', 'step', 'refsyn', 'related-links', 'section']) {
      expect(getGuideElementRuleKey(tag)).toBe(TOPIC_GUIDE_ELEMENT_RULES[tag]);
    }
    expect(getGuideElementRuleKey('unmodeled-specialization-xyz')).toBeUndefined();
  });

  it('surfaces required attributes where the model declares them', () => {
    const tgroup = getRequiredAttributes('tgroup', 'en');
    expect(tgroup.map((attr) => attr.name)).toContain('cols');

    const concept = getRequiredAttributes('concept', 'en');
    expect(concept.map((attr) => attr.name)).toContain('id');
    expect(concept.every((attr) => attr.label.length > 0)).toBe(true);

    // Optional-only elements yield no rows instead of inventing required ones.
    expect(getRequiredAttributes('p', 'en')).toEqual([]);
  });
});
