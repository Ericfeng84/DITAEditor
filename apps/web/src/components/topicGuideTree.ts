/**
 * Data-driven DITA 1.3 tag-hierarchy model for the topic authoring guide.
 *
 * Everything here is derived from `@dita/core`'s single source of truth:
 * - `getSequenceSlots()`  -> ordered slots + cardinality (`required` / `?` / `*` / `+`)
 * - `getAllowedChildElementTags()` -> unordered legal children for block containers
 * - `getElementSpec()` / `getElementLabel()` / `getElementDescription()` -> display metadata
 * - `getAttributesForElement()` -> required attributes per element
 *
 * The guide never hardcodes content models: a DTD/RNG correction in `@dita/core` immediately
 * shows up in the authoring guide, the Visual Editor insert menu, and the XML linter alike.
 */

import {
  getAttributesForElement,
  getAllowedChildElementTags,
  getElementDescription,
  getElementLabel,
  getElementSpec,
  getSequenceSlots,
  type DitaElementCategory,
  type SequenceOccurrence,
  type TaskContentModel,
  type UiLocale,
} from '@dita/core';
import type { MessageKey } from '../i18n/index.js';

export type TopicGuideOccurrence = SequenceOccurrence | 'root';

/** One row of the rendered tag-hierarchy tree. */
export interface TopicGuideTreeNode {
  /** Every alternative of this slot, e.g. `['steps', 'steps-unordered']`. */
  tags: readonly string[];
  /** Tag whose facts (rules, allowed children) are shown in the detail pane. */
  anchor: string;
  occurrence: TopicGuideOccurrence;
  /** Nested ordered slots, present only for curated workflow containers. */
  children: readonly TopicGuideTreeNode[];
  /** Unordered legal children, present only on leaves. */
  allowedTags: readonly string[];
  depth: number;
}

export const TOPIC_GUIDE_OCCURRENCE_KEYS: Readonly<Record<TopicGuideOccurrence, MessageKey>> = {
  root: 'guide.req.root',
  required: 'guide.req.required',
  optional: 'guide.req.optional',
  zeroOrMore: 'guide.req.zeroOrMore',
  oneOrMore: 'guide.req.oneOrMore',
};

/**
 * Containers whose ordered slots are worth rendering as indented child rows. Everything else
 * stays a leaf row whose legal children are listed as chips in the detail pane (otherwise the
 * tree would explode into spec-table noise such as `prolog`'s eight metadata slots).
 */
const EXPANDED_CONTAINERS: ReadonlySet<string> = new Set([
  'conbody',
  'conbodydiv',
  'taskbody',
  'steps',
  'steps-unordered',
  'step',
  'substeps',
  'substep',
  'result',
  'postreq',
  'example',
  'related-links',
  'linklist',
  'refsyn',
  'section',
  'fig',
  'table',
  'dl',
]);

/** Root children start at depth 1; deeper nesting stops here (task: steps -> step -> substeps). */
const MAX_EXPANDED_DEPTH = 4;

function slotSignature(slots: ReturnType<typeof getSequenceSlots>): string {
  return (slots ?? []).map((slot) => `${slot.occurrence}:${slot.tags.join('|')}`).join(';');
}

/**
 * Pick the tag whose internals should be expanded for a slot, or `undefined` when the slot's
 * alternatives are structurally unrelated (e.g. `section | example | conbodydiv`), in which case
 * the row stays a leaf and the detail pane lists its legal children as chips.
 */
function resolveExpandedAnchor(
  tags: readonly string[],
  taskModel: TaskContentModel,
  ancestors: readonly string[],
  depth: number,
): string | undefined {
  if (depth > MAX_EXPANDED_DEPTH) return undefined;
  const candidates = tags.filter((tag) => EXPANDED_CONTAINERS.has(tag));
  const anchor = candidates[0];
  if (!anchor) return undefined;
  if (ancestors.includes(anchor)) return undefined;

  const anchorSlots = getSequenceSlots(anchor, taskModel);
  if (!anchorSlots || anchorSlots.length === 0) return undefined;

  const anchorSignature = slotSignature(anchorSlots);
  for (const tag of candidates.slice(1)) {
    const slots = getSequenceSlots(tag, taskModel);
    if (slots && slots.length > 0 && slotSignature(slots) !== anchorSignature) return undefined;
  }
  return anchor;
}

function buildNode(
  slot: { tags: readonly string[]; occurrence: SequenceOccurrence },
  depth: number,
  ancestors: readonly string[],
  taskModel: TaskContentModel,
): TopicGuideTreeNode {
  const anchor = slot.tags[0] ?? '';
  const expandedAnchor = resolveExpandedAnchor(slot.tags, taskModel, ancestors, depth);
  const childSlots = expandedAnchor ? (getSequenceSlots(expandedAnchor, taskModel) ?? []) : [];
  const children = childSlots.map((childSlot) =>
    buildNode(childSlot, depth + 1, [...ancestors, expandedAnchor as string], taskModel),
  );

  return {
    tags: slot.tags,
    anchor,
    occurrence: slot.occurrence,
    children,
    allowedTags: children.length > 0 ? [] : getAllowedChildElementTags(anchor, taskModel),
    depth,
  };
}

/** Build the root node of the tag hierarchy for a DITA topic type. */
export function buildTopicGuideTree(
  type: string,
  taskModel: TaskContentModel = 'strict',
): TopicGuideTreeNode {
  const slots = getSequenceSlots(type, taskModel) ?? [];
  return {
    tags: [type],
    anchor: type,
    occurrence: 'root',
    children: slots.map((slot) => buildNode(slot, 1, [type], taskModel)),
    allowedTags: [],
    depth: 0,
  };
}

/** Legal children of `tag`, plus the subset the DTD marks as required / one-or-more. */
export function getAllowedChildren(tag: string, taskModel: TaskContentModel = 'strict'): {
  tags: readonly string[];
  requiredTags: readonly string[];
} {
  const tags = getAllowedChildElementTags(tag, taskModel);
  const requiredTags: string[] = [];
  for (const slot of getSequenceSlots(tag, taskModel) ?? []) {
    if (slot.occurrence === 'required' || slot.occurrence === 'oneOrMore') {
      requiredTags.push(...slot.tags);
    }
  }
  return { tags, requiredTags };
}

export type TopicGuideChildGroup = 'structure' | 'block' | 'inline';

export interface TopicGuideChildChip {
  tag: string;
  label: string;
  description: string;
  required: boolean;
  group: TopicGuideChildGroup;
}

function groupForCategory(category: DitaElementCategory | undefined): TopicGuideChildGroup {
  if (category === 'inline') return 'inline';
  if (category === 'block' || category === 'table') return 'block';
  return 'structure';
}

/** Turn raw tags into labelled, grouped chips for the "allowed children" section. */
export function buildChildChips(
  tags: readonly string[],
  requiredTags: readonly string[] = [],
  locale: UiLocale = 'zh-CN',
): TopicGuideChildChip[] {
  return tags.map((tag) => {
    const spec = getElementSpec(tag);
    return {
      tag,
      label: spec ? getElementLabel(spec, locale) : tag,
      description: spec ? getElementDescription(spec, locale) : '',
      required: requiredTags.includes(tag),
      group: groupForCategory(spec?.category),
    };
  });
}

const GROUP_ORDER: readonly TopicGuideChildGroup[] = ['structure', 'block', 'inline'];

export function groupChildChips(
  chips: readonly TopicGuideChildChip[],
): { group: TopicGuideChildGroup; chips: TopicGuideChildChip[] }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    chips: chips.filter((chip) => chip.group === group),
  })).filter((entry) => entry.chips.length > 0);
}

/** Required attributes authors must not forget (e.g. `href` on `<link>` / `<xref>`). */
export function getRequiredAttributes(
  tag: string,
  locale: UiLocale = 'zh-CN',
): { name: string; label: string; description: string }[] {
  return getAttributesForElement(tag)
    .filter((attr) => attr.required)
    .map((attr) => ({
      name: attr.name,
      label: locale === 'en' ? attr.label : (attr.labelZh ?? attr.label),
      description: locale === 'en' ? attr.description : (attr.descriptionZh ?? attr.description),
    }));
}

/**
 * Element-level authoring rules distilled from `docs/dita/*.md`. Tags without a curated rule
 * fall back to the `@dita/core` element description so the pane is never empty.
 */
export const TOPIC_GUIDE_ELEMENT_RULES: Readonly<Record<string, MessageKey>> = {
  title: 'guide.el.title',
  titlealts: 'guide.el.titlealts',
  shortdesc: 'guide.el.shortdesc',
  abstract: 'guide.el.abstract',
  prolog: 'guide.el.prolog',
  body: 'guide.el.body',
  bodydiv: 'guide.el.bodydiv',
  conbody: 'guide.el.conbody',
  conbodydiv: 'guide.el.conbodydiv',
  section: 'guide.el.section',
  taskbody: 'guide.el.taskbody',
  prereq: 'guide.el.prereq',
  context: 'guide.el.context',
  steps: 'guide.el.steps',
  'steps-unordered': 'guide.el.stepsUnordered',
  step: 'guide.el.step',
  cmd: 'guide.el.cmd',
  info: 'guide.el.info',
  substeps: 'guide.el.substeps',
  substep: 'guide.el.substep',
  choices: 'guide.el.choices',
  stepresult: 'guide.el.stepresult',
  result: 'guide.el.result',
  tasktroubleshooting: 'guide.el.tasktroubleshooting',
  example: 'guide.el.example',
  postreq: 'guide.el.postreq',
  refbody: 'guide.el.refbody',
  refsyn: 'guide.el.refsyn',
  properties: 'guide.el.properties',
  'related-links': 'guide.el.relatedLinks',
  link: 'guide.el.link',
  linklist: 'guide.el.linklist',
  linkpool: 'guide.el.linkpool',
  table: 'guide.el.table',
  simpletable: 'guide.el.simpletable',
  dl: 'guide.el.dl',
  fig: 'guide.el.fig',
  note: 'guide.el.note',
  // Topic self-nesting slots (`topic*`, `concept*`, ...)
  topic: 'guide.el.nestedTopic',
  concept: 'guide.el.nestedTopic',
  task: 'guide.el.nestedTopic',
  reference: 'guide.el.nestedTopic',
};

export function getGuideElementRuleKey(tag: string): MessageKey | undefined {
  return TOPIC_GUIDE_ELEMENT_RULES[tag];
}

/** Localized display label of a tag (falls back to the raw tag name). */
export function getTagLabel(tag: string, locale: UiLocale = 'zh-CN'): string {
  const spec = getElementSpec(tag);
  return spec ? getElementLabel(spec, locale) : tag;
}

/** Localized one-line description of a tag. */
export function getTagDescription(tag: string, locale: UiLocale = 'zh-CN'): string {
  const spec = getElementSpec(tag);
  return spec ? getElementDescription(spec, locale) : '';
}

/** Compact `<a> | <b>` rendering used by rows whose slot has several alternatives. */
export function formatSlotLabel(tags: readonly string[], maxAlternatives = 2): string {
  const shown = tags.slice(0, maxAlternatives).map((tag) => `<${tag}>`);
  if (tags.length > maxAlternatives) shown.push(`+${tags.length - maxAlternatives}`);
  return shown.join(' | ');
}
