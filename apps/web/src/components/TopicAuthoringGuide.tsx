import { useEffect, useState } from 'react';
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
      barBg: 'bg-indigo-50/60',
      badgeBg: 'border-indigo-200 bg-indigo-100/80',
      badgeText: 'text-indigo-800',
      iconText: 'text-indigo-600',
      tokenRequired: 'border-indigo-200 bg-indigo-50 text-indigo-800',
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

export interface TopicAuthoringGuideProps {
  docType: string | null | undefined;
  /** Number of live DITA 1.3 structure diagnostics on the active topic file. */
  structureIssueCount?: number;
  /** Opens the Problems panel when the author clicks the structure issue badge. */
  onOpenProblems?: () => void;
  defaultExpanded?: boolean;
}

/**
 * Compact, collapsible DITA 1.3 authoring guideline strip for Topic documents
 * (`concept`, `task`, `reference`, `topic`). Renders a 1-line summary when collapsed
 * and expands into recommended sequence order, authoring guidelines, and common pitfalls.
 */
export function TopicAuthoringGuide({
  docType,
  structureIssueCount = 0,
  onOpenProblems,
  defaultExpanded = false,
}: TopicAuthoringGuideProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<boolean>(() => readInitialExpanded(defaultExpanded));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
    } catch {
      // Ignore storage failures
    }
  }, [expanded]);

  if (!isTopicGuideType(docType)) return null;

  const spec = TOPIC_AUTHORING_GUIDES[docType];
  const Icon = spec.icon;

  return (
    <section
      aria-label={t('guide.aria')}
      data-topic-guide-type={spec.type}
      className={`shrink-0 border-b border-slate-200/90 ${spec.accent.barBg}`}
    >
      {/* 1-line compact header */}
      <div className="flex items-center justify-between gap-2 px-3 py-1 text-[11px]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold ${spec.accent.badgeBg} ${spec.accent.badgeText}`}
          >
            <Icon className={`h-3 w-3 ${spec.accent.iconText}`} aria-hidden="true" />
            <span>{t(spec.badgeKey)}</span>
            <code className="font-mono text-[10px] font-normal opacity-80">{spec.rootTag}</code>
          </span>
          <span className="min-w-0 truncate text-slate-600" title={t(spec.summaryKey)}>
            {t(spec.summaryKey)}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {structureIssueCount > 0 ? (
            <button
              type="button"
              onClick={onOpenProblems}
              title={t('guide.issuesTitle')}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-medium text-rose-700 transition-colors hover:bg-rose-100"
            >
              <AlertTriangle className="h-3 w-3 text-rose-600" aria-hidden="true" />
              <span>{t('guide.issuesBadge', { count: structureIssueCount })}</span>
            </button>
          ) : null}

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded border border-slate-200/90 bg-white/90 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-900"
          >
            <span>{expanded ? t('guide.collapse') : t('guide.expand')}</span>
            {expanded ? (
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded full authoring specification card */}
      {expanded ? (
        <div className="border-t border-slate-200/70 bg-white/90 px-3.5 py-2.5 text-[11px] text-slate-700">
          <p className="leading-relaxed text-slate-600">{t(spec.purposeKey)}</p>

          {/* Recommended structure sequence */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10.5px] font-semibold text-slate-500">
              {t('guide.structureLabel')}:
            </span>
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

          {/* Do's and Avoids */}
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                {t('guide.dosLabel')}
              </h4>
              <ul className="space-y-1 text-[11px] leading-snug text-slate-600">
                {spec.doKeys.map((key) => (
                  <li key={key} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-1 flex items-center gap-1 text-[10.5px] font-semibold text-rose-700">
                <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                {t('guide.avoidLabel')}
              </h4>
              <ul className="space-y-1 text-[11px] leading-snug text-slate-600">
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
      ) : null}
    </section>
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
