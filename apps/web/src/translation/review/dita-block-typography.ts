/**
 * Semantic typography for a translated block.
 *
 * DITA blocks are not all paragraphs: a `<title>` must look like a heading, `<shortdesc>` like a
 * lede, `<cmd>` like a procedure step, `<dt>/<dd>` like a definition pair, `<codeblock>` like code
 * and `@navtitle` like a label. Deriving that once, from `elementTag` + `structuralPath` +
 * `attributeName` + `protected`, keeps every view (side by side, stacked, focus reading) visually
 * identical without duplicating the mapping.
 */
import type { TranslationSegmentReviewView } from '../../services/translation-api.js';

export type BlockRole =
  | 'map-title'
  | 'topic-title'
  | 'section-title'
  | 'shortdesc'
  | 'definition-term'
  | 'definition'
  | 'step'
  | 'list-item'
  | 'note'
  | 'code'
  | 'table'
  | 'attribute'
  | 'protected'
  | 'paragraph'
  | 'other';

export interface BlockTypography {
  role: BlockRole;
  /** Modifier class applied to the shared row/card wrapper. */
  rowClassName: string;
  /** Typography class applied to the rendered block text. */
  proseClassName: string;
  /** Extra class for the muted (source) language rendering. */
  mutedClassName: string;
  /** 0–2, derived from the structural path, so nested sections read as nested. */
  indent: number;
  /** Code-ish blocks keep monospace + preserved whitespace. */
  mono: boolean;
  /** Tag chip text: `<p>`, `<topichead @navtitle>`. */
  tagLabel: string;
}

const ROLE_CLASS: Record<BlockRole, string> = {
  'map-title': 'review-block--title review-block--map-title',
  'topic-title': 'review-block--title',
  'section-title': 'review-block--section-title',
  shortdesc: 'review-block--shortdesc',
  'definition-term': 'review-block--dt',
  definition: 'review-block--dd',
  step: 'review-block--step',
  'list-item': 'review-block--li',
  note: 'review-block--note',
  code: 'review-block--code',
  table: 'review-block--table',
  attribute: 'review-block--attribute',
  protected: 'review-block--protected',
  paragraph: 'review-block--p',
  other: 'review-block--other',
};

const PROSE_CLASS: Record<BlockRole, string> = {
  'map-title': 'review-prose review-prose--title',
  'topic-title': 'review-prose review-prose--title',
  'section-title': 'review-prose review-prose--section-title',
  shortdesc: 'review-prose review-prose--shortdesc',
  'definition-term': 'review-prose review-prose--dt',
  definition: 'review-prose review-prose--dd',
  step: 'review-prose review-prose--step',
  'list-item': 'review-prose review-prose--li',
  note: 'review-prose review-prose--note',
  code: 'review-prose review-prose--code',
  table: 'review-prose review-prose--table',
  attribute: 'review-prose review-prose--attribute',
  protected: 'review-prose review-prose--protected',
  paragraph: 'review-prose',
  other: 'review-prose',
};

const CODE_TAGS = new Set(['codeblock', 'pre', 'screen', 'msgblock', 'lines', 'code']);

/** `<topichead @navtitle>` for attribute segments, `<p>` otherwise. */
export function segmentTagLabel(
  segment: Pick<TranslationSegmentReviewView, 'elementTag' | 'attributeName'>,
): string {
  if (segment.attributeName) return `<${segment.elementTag} @${segment.attributeName}>`;
  return `<${segment.elementTag}>`;
}

/** Structural depth, used only for indentation cues (clamped to 2). */
export function structuralIndent(structuralPath: string): number {
  const steps = structuralPath.split('/').filter((step) => step.length > 0);
  // `concept/conbody/p[1]` = 3 steps → the block itself sits at depth 2.
  return Math.max(0, Math.min(2, steps.length - 2));
}

export function resolveBlockRole(
  segment: Pick<
    TranslationSegmentReviewView,
    'elementTag' | 'structuralPath' | 'attributeName' | 'protected'
  >,
): BlockRole {
  const tag = segment.elementTag.toLowerCase();
  const path = segment.structuralPath;
  if (segment.attributeName) return 'attribute';
  if (tag === 'title') {
    // A map/`topichead` title is the document title of a navigation tree, not a topic heading.
    if (/^(map|bookmap|ditamap)($|\/)/i.test(path) || /(^|\/)topic(head|ref)\[/.test(path)) {
      return 'map-title';
    }
    if (/(^|\/)section\[/.test(path) || /(^|\/)example\[/.test(path)) return 'section-title';
    return 'topic-title';
  }
  if (tag === 'shortdesc' || tag === 'abstract') return 'shortdesc';
  if (tag === 'dt' || tag === 'term' || tag === 'glossterm') return 'definition-term';
  if (tag === 'dd' || tag === 'ddhd') return 'definition';
  if (tag === 'cmd' || tag === 'stepresult' || tag === 'stepxmp' || tag === 'info') return 'step';
  if (tag === 'li' || tag === 'sl' || tag === 'sli') return 'list-item';
  if (tag === 'note' || tag === 'warning' || tag === 'tip' || tag === 'important' || tag === 'caution') {
    return 'note';
  }
  if (CODE_TAGS.has(tag)) return 'code';
  if (
    tag === 'entry' ||
    tag === 'stentry' ||
    tag === 'row' ||
    tag === 'thead' ||
    tag === 'tbody' ||
    tag === 'table' ||
    tag === 'simpletable'
  ) {
    return 'table';
  }
  if (segment.protected) return 'protected';
  if (tag === 'p' || tag === 'ph' || tag === 'pd' || tag === 'lq') return 'paragraph';
  return 'other';
}

export function resolveBlockTypography(
  segment: Pick<
    TranslationSegmentReviewView,
    'elementTag' | 'structuralPath' | 'attributeName' | 'protected'
  >,
): BlockTypography {
  const role = resolveBlockRole(segment);
  const mono = role === 'code' || role === 'attribute';
  return {
    role,
    rowClassName: ROLE_CLASS[role],
    proseClassName: `${PROSE_CLASS[role]}${mono ? ' review-prose--mono' : ''}`,
    mutedClassName: 'review-prose--muted',
    indent: role === 'map-title' || role === 'topic-title' ? 0 : structuralIndent(segment.structuralPath),
    mono,
    tagLabel: segmentTagLabel(segment),
  };
}
