import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DitaTopicTemplateType } from '@dita/core';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCode,
  ListChecks,
  TableProperties,
  XCircle,
} from 'lucide-react';
import { useI18n, type MessageKey } from '../i18n/index.js';
import {
  TOPIC_GUIDE_OCCURRENCE_KEYS,
  buildChildChips,
  buildTopicGuideTree,
  formatSlotLabel,
  getAllowedChildren,
  getGuideElementRuleKey,
  getRequiredAttributes,
  getTagDescription,
  getTagLabel,
  groupChildChips,
  type TopicGuideChildGroup,
  type TopicGuideTreeNode,
} from './topicGuideTree.js';

export type TopicGuideType = DitaTopicTemplateType;

export interface TopicStructureToken {
  label: string;
  required?: boolean;
}

export interface TopicAuthoringGuideSpec {
  type: TopicGuideType;
  rootTag: string;
  badgeKey: MessageKey;
  summaryKey: MessageKey;
  purposeKey: MessageKey;
  structureTokens: readonly TopicStructureToken[];
  doKeys: readonly MessageKey[];
  avoidKeys: readonly MessageKey[];
  icon: typeof BookOpen;
  accent: {
    barBg: string;
    badgeBg: string;
    badgeText: string;
    iconText: string;
    tokenRequired: string;
  };
}

export const TOPIC_AUTHORING_GUIDES: Readonly<Record<TopicGuideType, TopicAuthoringGuideSpec>> = {
  concept: {
    type: 'concept',
    rootTag: '<concept>',
    badgeKey: 'guide.concept.badge',
    summaryKey: 'guide.concept.summary',
    purposeKey: 'guide.concept.purpose',
    structureTokens: [
      { label: '<title>', required: true },
      { label: '<shortdesc>?' },
      { label: '<prolog>?' },
      { label: '<conbody>' },
      { label: '<section> / <p> / <dl>' },
      { label: '<related-links>?' },
    ],
    doKeys: ['guide.concept.do1', 'guide.concept.do2', 'guide.concept.do3'],
    avoidKeys: ['guide.concept.avoid1', 'guide.concept.avoid2'],
    icon: BookOpen,
    accent: {
      barBg: 'bg-blue-50/60',
      badgeBg: 'border-blue-200 bg-blue-100/80',
      badgeText: 'text-blue-800',
      iconText: 'text-blue-600',
      tokenRequired: 'border-blue-200 bg-blue-50 text-blue-800',
    },
  },
  task: {
    type: 'task',
    rootTag: '<task>',
    badgeKey: 'guide.task.badge',
    summaryKey: 'guide.task.summary',
    purposeKey: 'guide.task.purpose',
    structureTokens: [
      { label: '<title>', required: true },
      { label: '<shortdesc>?' },
      { label: '<prereq>?' },
      { label: '<context>?' },
      { label: '<steps> | <steps-unordered>', required: true },
      { label: '<result>?' },
      { label: '<example>?' },
      { label: '<postreq>?' },
    ],
    doKeys: ['guide.task.do1', 'guide.task.do2', 'guide.task.do3'],
    avoidKeys: ['guide.task.avoid1', 'guide.task.avoid2'],
    icon: ListChecks,
    accent: {
      barBg: 'bg-emerald-50/60',
      badgeBg: 'border-emerald-200 bg-emerald-100/80',
      badgeText: 'text-emerald-800',
      iconText: 'text-emerald-600',
      tokenRequired: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
  },
  reference: {
    type: 'reference',
    rootTag: '<reference>',
    badgeKey: 'guide.reference.badge',
    summaryKey: 'guide.reference.summary',
    purposeKey: 'guide.reference.purpose',
    structureTokens: [
      { label: '<title>', required: true },
      { label: '<shortdesc>?' },
      { label: '<prolog>?' },
      { label: '<refbody>' },
      { label: '<refsyn> | <section> | <table> | <simpletable>' },
    ],
    doKeys: ['guide.reference.do1', 'guide.reference.do2', 'guide.reference.do3'],
    avoidKeys: ['guide.reference.avoid1', 'guide.reference.avoid2'],
    icon: TableProperties,
    accent: {
      barBg: 'bg-amber-50/60',
      badgeBg: 'border-amber-200 bg-amber-100/80',
      badgeText: 'text-amber-800',
      iconText: 'text-amber-600',
      tokenRequired: 'border-amber-200 bg-amber-50 text-amber-800',
    },
  },
  topic: {
    type: 'topic',
    rootTag: '<topic>',
    badgeKey: 'guide.topic.badge',
    summaryKey: 'guide.topic.summary',
    purposeKey: 'guide.topic.purpose',
    structureTokens: [
      { label: '<title>', required: true },
      { label: '<shortdesc>?' },
      { label: '<prolog>?' },
      { label: '<body>' },
      { label: '<related-links>?' },
    ],
    doKeys: ['guide.topic.do1', 'guide.topic.do2', 'guide.topic.do3'],
    avoidKeys: ['guide.topic.avoid1', 'guide.topic.avoid2'],
    icon: FileCode,
    accent: {
      barBg: 'bg-sky-50/60',
      badgeBg: 'border-sky-200 bg-sky-100/80',
      badgeText: 'text-sky-800',
      iconText: 'text-sky-600',
      tokenRequired: 'border-sky-200 bg-sky-50 text-sky-800',
    },
  },
};

export function isTopicGuideType(docType: string | null | undefined): docType is TopicGuideType {
  return docType === 'concept' || docType === 'task' || docType === 'reference' || docType === 'topic';
}

const STORAGE_KEY = 'ditaeditor.authoringGuide.expanded';

const GROUP_LABEL_KEYS: Readonly<Record<TopicGuideChildGroup, MessageKey>> = {
  structure: 'guide.group.structure',
  block: 'guide.group.block',
  inline: 'guide.group.inline',
};

function readInitialExpanded(defaultExpanded: boolean): boolean {
  if (typeof window === 'undefined') return defaultExpanded;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // Ignore storage failures in sandboxed contexts
  }
  return defaultExpanded;
}

/** Persisted expand/collapse state for the authoring-guide panel (shared by chip + panel). */
export function useAuthoringGuideExpanded(defaultExpanded = false): [boolean, () => void] {
  const [expanded, setExpanded] = useState<boolean>(() => readInitialExpanded(defaultExpanded));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
  }, [expanded]);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);
  return [expanded, toggle];
}

export interface TopicGuideChipProps {
  docType: string | null | undefined;
  expanded: boolean;
  onToggle: () => void;
  /** Number of live DITA 1.3 structure diagnostics on the active topic file. */
  structureIssueCount?: number;
  /** Opens the Problems panel when the author clicks the structure issue badge. */
  onOpenProblems?: () => void;
}

/**
 * Single-line authoring-guide summary + expand toggle. It is intentionally NOT a strip of its
 * own: it lives at the end of the editor action row, so the guide costs zero extra chrome height.
 */
export function TopicGuideChip({
  docType,
  expanded,
  onToggle,
  structureIssueCount = 0,
  onOpenProblems,
}: TopicGuideChipProps) {
  const { t } = useI18n();
  if (!isTopicGuideType(docType)) return null;

  const spec = TOPIC_AUTHORING_GUIDES[docType];
  const Icon = spec.icon;

  return (
    <div className="flex min-w-0 items-center gap-1.5" data-topic-guide-type={spec.type}>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${spec.accent.badgeBg} ${spec.accent.badgeText}`}
        title={t(spec.summaryKey)}
      >
        <Icon className={`h-3 w-3 ${spec.accent.iconText}`} aria-hidden="true" />
        <span>{t(spec.badgeKey)}</span>
        {/* The raw tag token lives in the status bar / breadcrumb; the chip only needs the
            human label so the toolbar row stays on one line next to the lock and assignment chips. */}
        <code className="sr-only">{spec.rootTag}</code>
      </span>

      {structureIssueCount > 0 ? (
        <button
          type="button"
          onClick={onOpenProblems}
          title={t('guide.issuesTitle')}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-medium text-rose-700 transition-colors hover:bg-rose-100"
        >
          <AlertTriangle className="h-3 w-3 text-rose-600" aria-hidden="true" />
          <span>{t('guide.issuesBadge', { count: structureIssueCount })}</span>
        </button>
      ) : null}

      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t('guide.aria')}
        title={expanded ? t('guide.collapse') : t('guide.aria')}
        onClick={onToggle}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200/90 bg-white/90 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900"
      >
        {/* Label collapses first on narrow panes so the lock/assignment actions keep their room. */}
        <span className="hidden @[60rem]:inline">
          {expanded ? t('guide.collapse') : t('guide.expand')}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export interface TopicAuthoringGuideProps {
  docType: string | null | undefined;
}

/**
 * Expanded DITA 1.3 authoring specification for the active topic type: a clickable tag
 * hierarchy (required vs optional, spec order) plus a detail pane (allowed children, required
 * attributes, authoring rules). Mounted only while expanded — the toggle lives in
 * `TopicGuideChip`, inside the editor action row.
 */
export function TopicAuthoringGuide({ docType }: TopicAuthoringGuideProps) {
  const { t } = useI18n();
  if (!isTopicGuideType(docType)) return null;

  const spec = TOPIC_AUTHORING_GUIDES[docType];

  return (
    <section
      aria-label={t('guide.aria')}
      data-topic-guide-type={spec.type}
      className={`shrink-0 border-b border-slate-200/90 ${spec.accent.barBg}`}
    >
      <TopicGuidePanel key={spec.type} spec={spec} />
    </section>
  );
}

interface TopicGuidePanelProps {
  spec: TopicAuthoringGuideSpec;
}

/**
 * Expanded body: purpose line + two panes (`tag hierarchy` | `selected tag facts`).
 * Selection resets whenever the topic type changes because the panel is keyed by spec.type.
 */
function TopicGuidePanel({ spec }: TopicGuidePanelProps) {
  const { t, locale } = useI18n();
  const tree = useMemo(() => buildTopicGuideTree(spec.type), [spec.type]);
  const [selected, setSelected] = useState<TopicGuideTreeNode>(tree);

  return (
    <div className="border-t border-slate-200/70 bg-white/90 px-3.5 py-2.5 text-[11px] text-slate-700">
      <p className="leading-relaxed text-slate-600">{t(spec.purposeKey)}</p>

      <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Left: clickable tag hierarchy with cardinality badges */}
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-baseline gap-1.5">
            <h4 className="text-[10.5px] font-semibold text-slate-600">{t('guide.hierarchyLabel')}</h4>
            <span className="text-[9.5px] text-slate-400">{t('guide.hierarchyHint')}</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto rounded border border-slate-200/70 bg-slate-50/40 p-1.5">
            <GuideTreeNode node={tree} spec={spec} selected={selected} onSelect={setSelected} />
          </div>
        </div>

        {/* Right: required/optional, allowed children, and the authoring rule */}
        <div className="min-w-0">
          <div className="max-h-[300px] overflow-y-auto rounded border border-slate-200/70 bg-white p-2">
            {selected.occurrence === 'root' ? (
              <TypeLevelRules spec={spec} />
            ) : (
              <TagFacts node={selected} spec={spec} onSelect={setSelected} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface GuideTreeNodeProps {
  node: TopicGuideTreeNode;
  spec: TopicAuthoringGuideSpec;
  selected: TopicGuideTreeNode;
  onSelect: (node: TopicGuideTreeNode) => void;
}

function GuideTreeNode({ node, spec, selected, onSelect }: GuideTreeNodeProps) {
  const { t, locale } = useI18n();
  const isSelected = selected === node;
  const occurrenceKey = TOPIC_GUIDE_OCCURRENCE_KEYS[node.occurrence];
  const isRequired = node.occurrence === 'root' || node.occurrence === 'required' || node.occurrence === 'oneOrMore';
  const label = getTagLabel(node.anchor, locale);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node)}
        aria-pressed={isSelected}
        title={label ? `${formatSlotLabel(node.tags, 4)} · ${label}` : formatSlotLabel(node.tags, 4)}
        className={`flex w-full min-w-0 items-center gap-1 rounded px-1 py-[1px] text-left transition-colors ${
          isSelected ? 'bg-white shadow-sm ring-1 ring-slate-300/80' : 'hover:bg-white/70'
        }`}
      >
          <span className="flex shrink-0 items-center gap-0.5">
            {node.tags.slice(0, 3).map((tag, index) => (
              <span key={tag} className="flex items-center gap-0.5">
                {index > 0 ? <span className="text-[9px] text-slate-300">|</span> : null}
                <code
                  className={`rounded border px-1 font-mono text-[10px] ${
                    isRequired ? `${spec.accent.tokenRequired} font-semibold` : 'border-slate-200 bg-white/80 text-slate-600'
                  }`}
                >
                  {`<${tag}>`}
                </code>
              </span>
            ))}
            {node.tags.length > 3 ? (
              <span className="text-[9.5px] text-slate-400">+{node.tags.length - 3}</span>
            ) : null}
          </span>
          <span
            className={`shrink-0 rounded-full border px-1 text-[9px] leading-[14px] ${
              isRequired
                ? `${spec.accent.badgeBg} ${spec.accent.badgeText} border-transparent`
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {t(occurrenceKey)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{label}</span>
      </button>

      {node.children.length > 0 ? (
        <div className="ml-[5px] border-l border-slate-200/80 pl-1.5">
          {node.children.map((child, index) => (
            <GuideTreeNode
              key={`${child.tags.join('|')}-${index}`}
              node={child}
              spec={spec}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Detail pane for the topic root: the type-level summary, dos, and pitfalls. */
function TypeLevelRules({ spec }: { spec: TopicAuthoringGuideSpec }) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <code className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${spec.accent.tokenRequired}`}>
          {spec.rootTag}
        </code>
        <span className={`rounded-full border px-1.5 text-[9.5px] leading-[15px] border-transparent ${spec.accent.badgeBg} ${spec.accent.badgeText}`}>
          {t(TOPIC_GUIDE_OCCURRENCE_KEYS.root)}
        </span>
        <span className="text-[10.5px] text-slate-500">{t(spec.badgeKey)}</span>
      </div>

      <div>
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {t('guide.structureLabel')}
        </h5>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {spec.structureTokens.map((token, idx) => (
            <span key={token.label} className="inline-flex items-center gap-1">
              {idx > 0 ? <span className="text-slate-300" aria-hidden="true">→</span> : null}
              <code
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                  token.required
                    ? `${spec.accent.tokenRequired} font-semibold`
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {token.label}
              </code>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <div>
          <h5 className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            {t('guide.dosLabel')}
          </h5>
          <ul className="space-y-1 leading-snug text-slate-600">
            {spec.doKeys.map((key) => (
              <li key={key} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-rose-700">
            <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {t('guide.avoidLabel')}
          </h5>
          <ul className="space-y-1 leading-snug text-slate-600">
            {spec.avoidKeys.map((key) => (
              <li key={key} className="flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-rose-400" aria-hidden="true" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface TagFactsProps {
  node: TopicGuideTreeNode;
  spec: TopicAuthoringGuideSpec;
  onSelect: (node: TopicGuideTreeNode) => void;
}

/** Detail pane for one tag: cardinality, authoring rule, required attributes, allowed children. */
function TagFacts({ node, spec, onSelect }: TagFactsProps) {
  const { t, locale } = useI18n();
  const ruleKey = getGuideElementRuleKey(node.anchor);
  const rule = ruleKey ? t(ruleKey) : '';
  const description = getTagDescription(node.anchor, locale);
  const requiredAttrs = useMemo(() => getRequiredAttributes(node.anchor, locale), [node.anchor, locale]);
  const allowed = useMemo(() => getAllowedChildren(node.anchor), [node.anchor]);
  const chips = useMemo(
    () => buildChildChips(allowed.tags, allowed.requiredTags, locale),
    [allowed, locale],
  );
  const groupedChips = useMemo(() => groupChildChips(chips), [chips]);
  const alternatives = node.tags.filter((tag) => tag !== node.anchor);

  return (
    <div className="space-y-2">
      {/* header: tag, alternatives, cardinality, localized label */}
      <div className="flex flex-wrap items-center gap-1">
        <code className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${spec.accent.tokenRequired}`}>
          {`<${node.anchor}>`}
        </code>
        {alternatives.length > 0 ? (
          <span className="flex flex-wrap items-center gap-0.5 text-[10px] text-slate-400">
            <span>{t('guide.or')}</span>
            {alternatives.map((tag) => (
              <code key={tag} className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] text-slate-500">
                {`<${tag}>`}
              </code>
            ))}
          </span>
        ) : null}
        <span
          className={`rounded-full border px-1.5 text-[9.5px] leading-[15px] ${
            node.occurrence === 'required' || node.occurrence === 'oneOrMore'
              ? `border-transparent ${spec.accent.badgeBg} ${spec.accent.badgeText}`
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          {t(TOPIC_GUIDE_OCCURRENCE_KEYS[node.occurrence])}
        </span>
        <span className="text-[10.5px] text-slate-500">{getTagLabel(node.anchor, locale)}</span>
      </div>

      {/* authoring rule */}
      <div>
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {t('guide.writingRule')}
        </h5>
        <p className="mt-0.5 leading-relaxed text-slate-700">
          {rule || description || t('guide.textOnly')}
        </p>
        {rule && description ? (
          <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{description}</p>
        ) : null}
      </div>

      {/* required attributes */}
      {requiredAttrs.length > 0 ? (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {t('guide.requiredAttrs')}
          </h5>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {requiredAttrs.map((attr) => (
              <span
                key={attr.name}
                title={attr.description}
                className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1 py-[1px] text-[10px] text-amber-800"
              >
                <code className="font-mono font-semibold">{attr.name}</code>
                <span className="text-amber-700/80">{attr.label}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* children: ordered slots when the element has an ordered model, else grouped chips */}
      <div>
        <h5 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {node.children.length > 0 ? t('guide.orderedChildren') : t('guide.allowedChildren')}
          {node.children.length === 0 ? (
            <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">{allowed.tags.length}</span>
          ) : null}
        </h5>

        {node.children.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {node.children.map((child, index) => {
              const childRequired = child.occurrence === 'required' || child.occurrence === 'oneOrMore';
              return (
                <li key={`${child.tags.join('|')}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(child)}
                    className="flex w-full min-w-0 items-center gap-1 rounded px-1 py-[1px] text-left hover:bg-slate-50"
                  >
                    <code
                      title={child.tags.map((tag) => `<${tag}>`).join(' | ')}
                      className={`shrink-0 rounded border px-1 font-mono text-[10px] ${
                        childRequired ? `${spec.accent.tokenRequired} font-semibold` : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {formatSlotLabel(child.tags, 3)}
                    </code>
                    <span
                      className={`shrink-0 rounded-full border px-1 text-[9px] leading-[14px] ${
                        childRequired
                          ? `border-transparent ${spec.accent.badgeBg} ${spec.accent.badgeText}`
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {t(TOPIC_GUIDE_OCCURRENCE_KEYS[child.occurrence])}
                    </span>
                    <span className="min-w-0 truncate text-[10px] text-slate-500">
                      {getTagLabel(child.anchor, locale)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : chips.length > 0 ? (
          <div className="mt-1 space-y-1">
            {groupedChips.map(({ group, chips: groupChips }) => (
              <div key={group}>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  {t(GROUP_LABEL_KEYS[group])}
                </span>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {groupChips.map((chip) => (
                    <span
                      key={chip.tag}
                      title={chip.description}
                      className={`inline-flex items-center gap-1 rounded border px-1 py-[1px] text-[10px] ${
                        chip.required
                          ? `${spec.accent.tokenRequired} font-semibold`
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <code className="font-mono">{`<${chip.tag}>`}</code>
                      <span className={chip.required ? '' : 'text-slate-400'}>{chip.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-0.5 text-[10px] text-slate-400">{t('guide.textOnly')}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Compact 1-line structure preview reused inside `NewTopicDialog` so authors see the
 * DITA 1.3 content skeleton before creating a new topic.
 */
export function TopicStructurePreview({ type }: { type: TopicGuideType }) {
  const { t } = useI18n();
  const spec = TOPIC_AUTHORING_GUIDES[type];
  return (
    <div className={`rounded-lg border border-slate-200/80 px-3 py-2 text-[11px] ${spec.accent.barBg}`}>
      <p className="text-slate-700">{t(spec.summaryKey)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-[10px] font-semibold text-slate-500">
          {t('guide.newTopicPreview')}:
        </span>
        {spec.structureTokens.map((token, idx) => (
          <span key={token.label} className="inline-flex items-center gap-1">
            {idx > 0 ? <span className="text-slate-300" aria-hidden="true">→</span> : null}
            <code
              className={`rounded border px-1 py-0.5 font-mono text-[10px] ${
                token.required
                  ? `${spec.accent.tokenRequired} font-semibold`
                  : 'border-slate-200 bg-white/80 text-slate-600'
              }`}
            >
              {token.label}
            </code>
          </span>
        ))}
      </div>
    </div>
  );
}
