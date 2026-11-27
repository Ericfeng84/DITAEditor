/**
 * In-app help center content model.
 *
 * Prose (workflow, pitfalls, shortcuts) is authored in the i18n catalogues. Everything that
 * describes DITA itself — topic-type structure, element labels/descriptions, attribute docs,
 * ordered content models — is **derived** from `@dita/core` here, so a DTD/RNG correction in the
 * kernel immediately shows up in the help instead of leaving a stale table behind.
 *
 * `buildHelpSections(locale)` returns fully resolved strings, which keeps filtering a plain
 * `includes()` match and lets the dialog stay free of derivation logic.
 */

import {
  getAttributeDescription,
  getAttributeLabel,
  getAttributesForElement,
  getSequenceSlots,
  type DitaSequenceSlot,
  type UiLocale,
} from '@dita/core';
import {
  BookMarked,
  GitBranch,
  Keyboard,
  Link2,
  PackageCheck,
  PenLine,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { translate, type MessageKey } from '../../i18n/index.js';
import {
  HELP_DITA_OT_URL,
  HELP_OASIS_LANG_REFERENCE,
  HELP_OASIS_TECH_CONTENT,
  HELP_OFFLINE,
  HELP_REPO_URL,
  helpDocsUrl,
} from '../../lib/help-links.js';
import { getAllowedChildren, getTagDescription, getTagLabel } from '../topicGuideTree.js';
import enProblems from '../../assets/help/en/problems.png';
import enPublish from '../../assets/help/en/publish.png';
import enSplit from '../../assets/help/en/split.png';
import enWorkspace from '../../assets/help/en/workspace.png';
import zhProblems from '../../assets/help/zh/problems.png';
import zhPublish from '../../assets/help/zh/publish.png';
import zhSplit from '../../assets/help/zh/split.png';
import zhWorkspace from '../../assets/help/zh/workspace.png';

export interface HelpRow {
  /** First column: `<tag>` + localized label, or the attribute name + localized label. */
  label: string;
  /** Second column: localized description. */
  detail: string;
  /** Optional extra lines under the description, e.g. "何时选用: …" for a topic type. */
  meta?: { label: string; text: string; mono?: boolean }[];
}

export interface HelpImage {
  /** Bundled screenshot URL (hashed by Vite); never a remote URL, so help works offline. */
  src: string;
  alt: string;
}

export interface HelpStep {
  text: string;
  image?: HelpImage;
}

export type HelpBlock =
  | { kind: 'steps'; items: HelpStep[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'table'; caption: string; note?: string; rows: HelpRow[] }
  | { kind: 'shortcuts'; groups: { label: string; items: string[] }[] }
  | { kind: 'links'; note?: string; items: { label: string; note: string; href: string }[] };

export interface HelpSection {
  id: string;
  /** Catalogue key for this section's nav entry. */
  navKey: MessageKey;
  icon: LucideIcon;
  title: string;
  intro: string;
  blocks: HelpBlock[];
}

const OCCURRENCE_SUFFIX: Readonly<Record<DitaSequenceSlot['occurrence'], string>> = {
  required: '',
  optional: '?',
  zeroOrMore: '*',
  oneOrMore: '+',
};

/** Four topic roots, in the order authors should consider them. */
const TOPIC_TYPES = ['concept', 'task', 'reference', 'topic'] as const;

/** Ordered containers worth showing: bodies that constrain layout, plus the common lists. */
const ORDERED_CONTAINERS = ['conbody', 'taskbody', 'refbody', 'ul', 'ol', 'table'] as const;

const BLOCK_ELEMENTS = [
  'p',
  'shortdesc',
  'section',
  'example',
  'note',
  'ul',
  'ol',
  'li',
  'dl',
  'dlentry',
  'fig',
  'image',
  'table',
  'simpletable',
  'codeblock',
  'lines',
  'xref',
] as const;

const INLINE_ELEMENTS = [
  'b',
  'i',
  'u',
  'codeph',
  'cmdname',
  'filepath',
  'userinput',
  'systemoutput',
  'wintitle',
  'keyword',
  'ph',
  'term',
  'option',
  'apiname',
  'fn',
] as const;

const COMMON_ATTRIBUTES = [
  'id',
  'xml:lang',
  'conref',
  'conkeyref',
  'keyref',
  'href',
  'scope',
  'format',
  'audience',
  'platform',
  'product',
  'props',
  'outputclass',
  'importance',
] as const;

function t(locale: UiLocale, key: MessageKey): string {
  return translate(locale, key);
}

/**
 * Screenshots are captured per UI language (the workbench itself is bilingual), so a Chinese
 * reader never meets an English chrome and vice versa. Files live under `src/assets/help/<locale>/`
 * and are bundled, which keeps the whole help center usable offline.
 */
const HELP_SHOTS: Readonly<Record<UiLocale, Record<'workspace' | 'split' | 'problems' | 'publish', string>>> = {
  'zh-CN': { workspace: zhWorkspace, split: zhSplit, problems: zhProblems, publish: zhPublish },
  en: { workspace: enWorkspace, split: enSplit, problems: enProblems, publish: enPublish },
};

/** Quick-start steps, in order, with the illustration (if any) that belongs to each. */
const QUICKSTART_STEPS: readonly { key: MessageKey; shot?: keyof (typeof HELP_SHOTS)['en']; altKey?: MessageKey }[] = [
  { key: 'help.quickstart.s1', shot: 'workspace', altKey: 'help.quickstart.img1Alt' },
  { key: 'help.quickstart.s2' },
  { key: 'help.quickstart.s3', shot: 'split', altKey: 'help.quickstart.img2Alt' },
  { key: 'help.quickstart.s4', shot: 'problems', altKey: 'help.quickstart.img3Alt' },
  { key: 'help.quickstart.s5' },
  { key: 'help.quickstart.s6', shot: 'publish', altKey: 'help.quickstart.img4Alt' },
];

function buildQuickstartSteps(locale: UiLocale): HelpStep[] {
  return QUICKSTART_STEPS.map(({ key, shot, altKey }) => ({
    text: t(locale, key),
    image:
      shot && altKey ? { src: HELP_SHOTS[locale][shot], alt: t(locale, altKey) } : undefined,
  }));
}

/** `p | note | …` with the cardinality suffix of its slot, truncated to stay on one line. */
function formatSlot(slot: DitaSequenceSlot): string {
  const shown = slot.tags.slice(0, 4).map((tag) => `<${tag}>`).join(' | ');
  const more = slot.tags.length > 4 ? ' …' : '';
  return `${shown}${more}${OCCURRENCE_SUFFIX[slot.occurrence]}`;
}

/** Catalogue key holding the "use it for" sentence of one topic type. */
const TOPIC_TYPE_USE_KEY: Readonly<Record<(typeof TOPIC_TYPES)[number], MessageKey>> = {
  concept: 'help.dita.typeUseConcept',
  task: 'help.dita.typeUseTask',
  reference: 'help.dita.typeUseReference',
  topic: 'help.dita.typeUseTopic',
};

function buildTopicTypeRows(locale: UiLocale): HelpRow[] {
  return TOPIC_TYPES.map((type) => {
    const { requiredTags } = getAllowedChildren(type);
    const required = requiredTags.map((tag) => `<${tag}>`).join(' → ');
    const meta: NonNullable<HelpRow['meta']> = [
      { label: t(locale, 'help.dita.typesUseLabel'), text: t(locale, TOPIC_TYPE_USE_KEY[type]) },
    ];
    if (required) meta.push({ label: t(locale, 'help.dita.typesRequired'), text: required, mono: true });
    return {
      label: `<${type}> ${getTagLabel(type, locale)}`,
      detail: getTagDescription(type, locale),
      meta,
    };
  });
}

function buildOrderedContainerRows(locale: UiLocale): HelpRow[] {
  return ORDERED_CONTAINERS.flatMap((tag) => {
    const slots = getSequenceSlots(tag);
    if (!slots) return [];
    return [
      {
        label: `<${tag}>`,
        detail: slots.map(formatSlot).join(' → '),
      },
    ];
  });
}

function buildElementRows(tags: readonly string[], locale: UiLocale): HelpRow[] {
  return tags.map((tag) => ({
    label: `<${tag}> ${getTagLabel(tag, locale)}`,
    detail: getTagDescription(tag, locale),
  }));
}

/** Roots on which an attribute is declared `required` (currently only `id` on topic roots). */
function requiredOn(name: string): string[] {
  return TOPIC_TYPES.filter((root) =>
    getAttributesForElement(root).some((spec) => spec.name === name && spec.required),
  ).map((root) => `<${root}>`);
}

function buildAttributeRows(locale: UiLocale): HelpRow[] {
  return COMMON_ATTRIBUTES.flatMap((name) => {
    const spec = getAttributesForElement('ph').find((attr) => attr.name === name);
    if (!spec) return [];
    const roots = requiredOn(name);
    const description = getAttributeDescription(spec, locale);
    return [
      {
        label: `${name} · ${getAttributeLabel(spec, locale)}`,
        detail: roots.length
          ? `${description} · ${t(locale, 'help.dita.colRequiredOn')}: ${roots.join(' / ')}`
          : description,
      },
    ];
  });
}

function buildLinkItems(locale: UiLocale): { label: string; note: string; href: string }[] {
  const items: { label: string; note: string; href: string }[] = [];
  // Network-only targets are hidden in offline builds rather than rendered as dead buttons.
  if (!HELP_OFFLINE) {
    items.push(
      {
        label: t(locale, 'help.links.siteLabel'),
        note: t(locale, 'help.links.siteNote'),
        href: helpDocsUrl(locale),
      },
      {
        label: t(locale, 'help.links.repoLabel'),
        note: t(locale, 'help.links.repoNote'),
        href: HELP_REPO_URL,
      },
    );
  }
  items.push(
    {
      label: t(locale, 'help.links.oasisLabel'),
      note: t(locale, 'help.links.oasisNote'),
      href: HELP_OASIS_TECH_CONTENT,
    },
    {
      label: t(locale, 'help.links.oasisLangLabel'),
      note: t(locale, 'help.links.oasisLangNote'),
      href: HELP_OASIS_LANG_REFERENCE,
    },
    {
      label: t(locale, 'help.links.ditaOtLabel'),
      note: t(locale, 'help.links.ditaOtNote'),
      href: HELP_DITA_OT_URL,
    },
  );
  return items;
}

/** Resolve every section for one locale. Cheap enough to call once per locale change. */
export function buildHelpSections(locale: UiLocale): HelpSection[] {
  return [
    {
      id: 'quickstart',
      navKey: 'help.nav.quickstart',
      icon: Rocket,
      title: t(locale, 'help.quickstart.title'),
      intro: t(locale, 'help.quickstart.intro'),
      blocks: [
        { kind: 'steps', items: buildQuickstartSteps(locale) },
      ],
    },
    {
      id: 'authoring',
      navKey: 'help.nav.authoring',
      icon: PenLine,
      title: t(locale, 'help.authoring.title'),
      intro: t(locale, 'help.authoring.intro'),
      blocks: [
        {
          kind: 'bullets',
          items: (
            [
              'help.authoring.b1',
              'help.authoring.b2',
              'help.authoring.b3',
              'help.authoring.b4',
              'help.authoring.b5',
              'help.authoring.b6',
              'help.authoring.b7',
              'help.authoring.b8',
            ] as const
          ).map((key) => t(locale, key)),
        },
      ],
    },
    {
      id: 'dita',
      navKey: 'help.nav.dita',
      icon: BookMarked,
      title: t(locale, 'help.dita.title'),
      intro: t(locale, 'help.dita.intro'),
      blocks: [
        {
          kind: 'table',
          caption: t(locale, 'help.dita.typesLabel'),
          note: t(locale, 'help.dita.typesNote'),
          rows: buildTopicTypeRows(locale),
        },
        {
          kind: 'table',
          caption: t(locale, 'help.dita.typesOrder'),
          rows: buildOrderedContainerRows(locale),
        },
        {
          kind: 'table',
          caption: t(locale, 'help.dita.elementsBlockLabel'),
          rows: buildElementRows(BLOCK_ELEMENTS, locale),
        },
        {
          kind: 'table',
          caption: t(locale, 'help.dita.elementsInlineLabel'),
          rows: buildElementRows(INLINE_ELEMENTS, locale),
        },
        {
          kind: 'table',
          caption: t(locale, 'help.dita.attrsLabel'),
          note: t(locale, 'help.dita.attrsNote'),
          rows: buildAttributeRows(locale),
        },
        {
          kind: 'bullets',
          items: (
            [
              'help.dita.rules1',
              'help.dita.rules2',
              'help.dita.rules3',
              'help.dita.rules4',
              'help.dita.rules5',
            ] as const
          ).map((key) => t(locale, key)),
        },
        {
          kind: 'bullets',
          items: (
            [
              'help.dita.pitfall1',
              'help.dita.pitfall2',
              'help.dita.pitfall3',
              'help.dita.pitfall4',
              'help.dita.pitfall5',
            ] as const
          ).map((key) => t(locale, key)),
        },
      ],
    },
    {
      id: 'validation',
      navKey: 'help.nav.validation',
      icon: PackageCheck,
      title: t(locale, 'help.validation.title'),
      intro: t(locale, 'help.validation.intro'),
      blocks: [
        {
          kind: 'bullets',
          items: (
            [
              'help.validation.b1',
              'help.validation.b2',
              'help.validation.b3',
              'help.validation.b4',
              'help.validation.b5',
              'help.validation.b6',
            ] as const
          ).map((key) => t(locale, key)),
        },
      ],
    },
    {
      id: 'collab',
      navKey: 'help.nav.collab',
      icon: GitBranch,
      title: t(locale, 'help.collab.title'),
      intro: t(locale, 'help.collab.intro'),
      blocks: [
        {
          kind: 'bullets',
          items: (
            [
              'help.collab.b1',
              'help.collab.b2',
              'help.collab.b3',
              'help.collab.b4',
              'help.collab.b5',
              'help.collab.b6',
              'help.collab.b7',
            ] as const
          ).map((key) => t(locale, key)),
        },
      ],
    },
    {
      id: 'shortcuts',
      navKey: 'help.nav.shortcuts',
      icon: Keyboard,
      title: t(locale, 'help.shortcuts.title'),
      intro: t(locale, 'help.shortcuts.intro'),
      blocks: [
        {
          kind: 'shortcuts',
          groups: [
            {
              label: t(locale, 'help.shortcuts.globalLabel'),
              items: (['help.shortcuts.save', 'help.shortcuts.sidebar', 'help.shortcuts.outline', 'help.shortcuts.help'] as const).map(
                (key) => t(locale, key),
              ),
            },
            {
              label: t(locale, 'help.shortcuts.editorLabel'),
              items: (
                [
                  'help.shortcuts.undo',
                  'help.shortcuts.inline',
                  'help.shortcuts.xref',
                  'help.shortcuts.codeblock',
                  'help.shortcuts.table',
                ] as const
              ).map((key) => t(locale, key)),
            },
            {
              label: t(locale, 'help.shortcuts.outlineLabel'),
              items: (['help.shortcuts.move', 'help.shortcuts.escape'] as const).map((key) => t(locale, key)),
            },
          ],
        },
      ],
    },
    {
      id: 'links',
      navKey: 'help.nav.links',
      icon: Link2,
      title: t(locale, 'help.links.title'),
      intro: t(locale, 'help.links.intro'),
      blocks: [
        {
          kind: 'links',
          note: HELP_OFFLINE ? t(locale, 'help.links.offlineNote') : undefined,
          items: buildLinkItems(locale),
        },
      ],
    },
  ];
}

/** Number of leaf entries (steps, bullets, table rows, shortcut groups, links). */
export function helpEntryCount(sections: readonly HelpSection[]): number {
  return sections.reduce((total, section) => {
    return (
      total +
      section.blocks.reduce((sum, block) => {
        switch (block.kind) {
          case 'steps':
          case 'bullets':
            return sum + block.items.length;
          case 'table':
            return sum + block.rows.length;
          case 'shortcuts':
            return sum + block.groups.reduce((n, group) => n + group.items.length, 0);
          case 'links':
            return sum + block.items.length;
        }
      }, 0)
    );
  }, 0);
}

function blockTexts(block: HelpBlock): string[] {
  switch (block.kind) {
    case 'steps':
      return block.items.map((item) => item.text);
    case 'bullets':
      return block.items;
    case 'table':
      return [
        block.caption,
        block.note ?? '',
        ...block.rows.flatMap((row) => [
          row.label,
          row.detail,
          ...(row.meta ?? []).flatMap((meta) => [meta.label, meta.text]),
        ]),
      ];
    case 'shortcuts':
      return block.groups.flatMap((group) => [group.label, ...group.items]);
    case 'links':
      return [block.note ?? '', ...block.items.flatMap((item) => [item.label, item.note])];
  }
}

/** Every searchable string in a section, title and intro included. */
export function sectionTexts(section: HelpSection): string[] {
  return [section.title, section.intro, ...section.blocks.flatMap(blockTexts)];
}

function matches(texts: readonly string[], query: string): boolean {
  return texts.some((text) => text.toLowerCase().includes(query));
}

function filterBlock(block: HelpBlock, query: string): HelpBlock | null {
  switch (block.kind) {
    case 'steps': {
      const items = block.items.filter((item) => matches([item.text], query));
      return items.length > 0 ? { ...block, items } : null;
    }
    case 'bullets': {
      const items = block.items.filter((item) => matches([item], query));
      return items.length > 0 ? { ...block, items } : null;
    }
    case 'table': {
      const rows = block.rows.filter((row) =>
        matches(
          [row.label, row.detail, ...(row.meta ?? []).flatMap((meta) => [meta.label, meta.text])],
          query,
        ),
      );
      return rows.length > 0 ? { ...block, rows } : null;
    }
    case 'shortcuts': {
      const groups = block.groups
        .map((group) => ({ label: group.label, items: group.items.filter((item) => matches([item], query)) }))
        .filter((group) => group.items.length > 0);
      return groups.length > 0 ? { ...block, groups } : null;
    }
    case 'links': {
      const items = block.items.filter((item) => matches([item.label, item.note], query));
      return items.length > 0 ? { ...block, items } : null;
    }
  }
}

/**
 * Filter by a free-text query. A section whose own title or intro matches keeps all of its
 * blocks; otherwise only matching entries survive and empty blocks disappear.
 */
export function filterHelpSections(sections: readonly HelpSection[], rawQuery: string): HelpSection[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [...sections];
  return sections.flatMap((section) => {
    if (matches([section.title, section.intro], query)) return [section];
    const blocks = section.blocks
      .map((block) => filterBlock(block, query))
      .filter((block): block is HelpBlock => block !== null);
    return blocks.length > 0 ? [{ ...section, blocks }] : [];
  });
}
