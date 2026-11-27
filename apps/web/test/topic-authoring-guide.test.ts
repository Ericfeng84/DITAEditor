import { describe, expect, it } from 'vitest';
import {
  isTopicGuideType,
  TOPIC_AUTHORING_GUIDES,
  type TopicGuideType,
} from '../src/components/TopicAuthoringGuide';
import { en } from '../src/i18n/messages/en.js';
import { zhCN } from '../src/i18n/messages/zh-CN.js';

describe('TopicAuthoringGuide metadata and bilingual completeness', () => {
  const topicTypes: TopicGuideType[] = ['concept', 'task', 'reference', 'topic'];

  it('recognizes only the four DITA topic types', () => {
    for (const type of topicTypes) {
      expect(isTopicGuideType(type)).toBe(true);
    }
    for (const nonTopic of ['map', 'ditaval', 'other', null, undefined]) {
      expect(isTopicGuideType(nonTopic)).toBe(false);
    }
  });

  it('provides non-empty bilingual guidelines, structure tokens, dos, and avoids for every topic type', () => {
    for (const type of topicTypes) {
      const spec = TOPIC_AUTHORING_GUIDES[type];
      expect(spec.rootTag).toBe(`<${type}>`);
      expect(spec.structureTokens.length).toBeGreaterThanOrEqual(4);
      expect(spec.structureTokens[0]?.label).toBe('<title>');
      expect(spec.structureTokens[0]?.required).toBe(true);
      expect(spec.doKeys.length).toBeGreaterThanOrEqual(2);
      expect(spec.avoidKeys.length).toBeGreaterThanOrEqual(2);

      const keys = [
        spec.badgeKey,
        spec.summaryKey,
        spec.purposeKey,
        ...spec.doKeys,
        ...spec.avoidKeys,
      ];
      for (const key of keys) {
        expect(zhCN[key].trim().length).toBeGreaterThan(0);
        expect(en[key].trim().length).toBeGreaterThan(0);
      }
    }
  });
});
