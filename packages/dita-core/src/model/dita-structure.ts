/**
 * DITA 1.3 ordered content models (sequence + cardinality).
 *
 * `DITA_CONTENT_MODEL` (see `dita-rules.ts`) only answers "may this child appear here?"
 * (an unordered membership set). The OASIS DTD/RNG content models additionally constrain:
 *
 * - **Sequence**: children must appear in the declared order (`,` in DTD notation).
 * - **Cardinality**: `?` -> at most one, `*` -> zero or more, `+` -> one or more, bare -> exactly one.
 * - **Choice**:
 *   - Single-occurrence (`required` / `optional`) multi-tag slot `(a | b)?` -> mutually exclusive.
 *   - Repeating (`zeroOrMore` / `oneOrMore`) multi-tag slot `(a | b)*` -> unordered repeating mix.
 *
 * This module is intentionally *permissive about membership*:
 * - In **open-tail containers** (`section`, `example`, `refsyn`, `fig`), undeclared tags are body
 *   content that belongs after the leading title/desc slots.
 * - In **strict-sequence containers** (`topic`, `taskbody`, `step`, `prolog`, ...), unknown or
 *   specialized tags are transparently skipped so custom specializations keep passing through
 *   losslessly without poisoning subsequent valid siblings.
 *
 * Consumers:
 * - Visual Editor: sequence-aware block insertion (`getInsertionSlot`) + insert-menu cardinality filter.
 * - Visual Editor decorations: live inline diagnostics over the ProseMirror document.
 * - CodeMirror 6 source linter & completion: live XML diagnostics & cardinality-aware completion.
 * - Semantic index / Problems panel: cross-file structural diagnostics.
 */

import type { UiLocale } from '../i18n/locale.js';
import { coreT, type CoreMessageKey } from '../i18n/messages.js';

/** DTD-style occurrence indicator for one content-model slot. */
export type SequenceOccurrence = 'required' | 'optional' | 'zeroOrMore' | 'oneOrMore';

/** One ordered slot of a DITA content model; `tags` are the `|` alternatives of that slot. */
export interface DitaSequenceSlot {
  readonly tags: readonly string[];
  readonly occurrence: SequenceOccurrence;
}

export type StructureIssueCode =
  /** Child appears after a slot that must come later. */
  | 'child-out-of-order'
  /** A slot that must appear is missing. */
  | 'missing-required-child'
  /** A `?` / bare slot received more than one child. */
  | 'child-cardinality'
  /** Two different alternatives of a single-occurrence `|` slot appear together (e.g. `steps` + `steps-unordered`). */
  | 'slot-exclusive';

export interface StructureIssue {
  code: StructureIssueCode;
  parentTag: string;
  /** Offending child tag; for `missing-required-child` this is the required tag itself. */
  childTag: string;
  /** 0-based index of the offending child inside the parent; undefined for missing children. */
  index?: number;
  /** Tags that would be legal at the offending slot (diagnostic hint). */
  expectedTags?: readonly string[];
  severity: 'error' | 'warning';
}

/** Shared mapping from structure issue codes to `@dita/core` i18n keys. */
export const STRUCTURE_MESSAGE_KEYS = {
  'child-out-of-order': 'structure.outOfOrder',
  'missing-required-child': 'structure.missingRequiredChild',
  'child-cardinality': 'structure.childCardinality',
  'slot-exclusive': 'structure.slotExclusive',
} as const satisfies Record<StructureIssueCode, CoreMessageKey>;

export interface StructureIssueMessageInput {
  code: StructureIssueCode;
  parentTag: string;
  childTag: string;
  expectedTags?: readonly string[];
}

/**
 * Format a localized, human-readable explanation for a DITA 1.3 content-model violation.
 * Single source of truth shared by `@dita/core` semantic diagnostics, Visual Editor decorations,
 * and the CodeMirror 6 XML linter.
 */
export function formatStructureIssue(
  issue: StructureIssueMessageInput,
  locale: UiLocale | string = 'zh-CN',
): string {
  return coreT(locale, STRUCTURE_MESSAGE_KEYS[issue.code], {
    parent: issue.parentTag,
    child: issue.childTag,
    expected: (issue.expectedTags ?? []).map((tag) => `<${tag}>`).join(' | '),
  });
}

const required = (...tags: string[]): DitaSequenceSlot => ({ tags, occurrence: 'required' });
const optional = (...tags: string[]): DitaSequenceSlot => ({ tags, occurrence: 'optional' });
const many = (...tags: string[]): DitaSequenceSlot => ({ tags, occurrence: 'zeroOrMore' });
const some = (...tags: string[]): DitaSequenceSlot => ({ tags, occurrence: 'oneOrMore' });

function isSingleOccurrence(slot: DitaSequenceSlot): boolean {
  return slot.occurrence === 'required' || slot.occurrence === 'optional';
}

/**
 * Containers whose model is "ordered leading header slots (`title` / `desc`) followed by open
 * unordered body prose". Inside these containers, any undeclared child is treated as tail content
 * so a late `<title>` or `<desc>` after `<p>` / `<image>` is still flagged as out of order.
 */
const OPEN_TAIL_CONTAINERS: ReadonlySet<string> = new Set([
  'section',
  'example',
  'refsyn',
  'fig',
]);

/**
 * DITA 1.3 ordered content models, restricted to the containers whose declared order matters
 * (topic roots, strict task workflow, lists, figures/tables, links and prolog).
 *
 * Purely unordered containers (`body`, `conbody`, `refbody`, `section` prose, `li`, `entry`,
 * `note`, ...) are deliberately absent: their OASIS DTD model is an unordered `|` choice, so
 * the membership table in `dita-rules.ts` is already the complete constraint.
 */
export const DITA_SEQUENCE_MODEL: Readonly<Record<string, readonly DitaSequenceSlot[]>> = {
  // Topic roots: ((title), (titlealts)?, (shortdesc | abstract)?, (prolog)?, (<body>)?, (related-links)?)
  topic: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('body'),
    optional('related-links'),
  ],
  concept: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('conbody'),
    optional('related-links'),
  ],
  task: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('taskbody'),
    optional('related-links'),
  ],
  reference: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('refbody'),
    optional('related-links'),
  ],

  // Strict Task body (OASIS DITA 1.3 task.dtd / strictTaskbodyConstraint.mod):
  // ((prereq)?, (context)?, (steps | steps-unordered | steps-informal)?, (result)?, (tasktroubleshooting)?, (example)?, (postreq)?)
  taskbody: [
    optional('prereq'),
    optional('context'),
    optional('steps', 'steps-unordered', 'steps-informal'),
    optional('result'),
    optional('tasktroubleshooting'),
    optional('example'),
    optional('postreq'),
  ],

  // Title-first open-tail containers
  section: [optional('title')],
  example: [optional('title')],
  refsyn: [optional('title')],
  fig: [optional('title'), optional('desc')],

  // Tables (OASIS CALS + DITA simpletable)
  table: [optional('title'), optional('desc'), some('tgroup')],
  simpletable: [optional('sthead'), some('strow')],
  tgroup: [many('colspec'), optional('thead'), required('tbody')],

  // Task workflow (OASIS DITA 1.3 task.mod)
  steps: [some('step', 'stepsection')],
  'steps-unordered': [some('step', 'stepsection')],
  step: [
    many('note', 'hazardstatement'),
    required('cmd'),
    many('info', 'substeps', 'choices', 'choicetable', 'itemgroup', 'stepxmp', 'tutorialinfo'),
    optional('stepresult'),
    optional('steptroubleshooting'),
  ],
  substeps: [some('substep')],
  substep: [
    many('note', 'hazardstatement'),
    required('cmd'),
    many('info', 'itemgroup', 'stepxmp', 'tutorialinfo'),
    optional('stepresult'),
  ],
  choices: [some('choice')],

  // Links & metadata (OASIS DITA 1.3 topic.mod / metaDecl.mod)
  'related-links': [many('link', 'linklist', 'linkpool')],
  link: [optional('linktext'), optional('desc')],
  prolog: [
    many('author'),
    optional('source'),
    optional('publisher'),
    many('copyright'),
    optional('critdates'),
    optional('permissions'),
    many('metadata'),
    many('resourceid'),
  ],
  critdates: [optional('created'), many('revised')],

  // Lists
  ul: [some('li')],
  ol: [some('li')],
  dl: [optional('dlhead'), some('dlentry')],
  dlentry: [some('dt'), some('dd')],
};

/** Rank assigned to body prose after leading slots in open-tail containers. */
const TAIL_RANK = Number.MAX_SAFE_INTEGER;
/** Sentinel for unknown / specialized tags in strict-sequence containers (skipped transparently). */
const UNKNOWN_RANK = -1;

function findSlotIndex(
  slots: readonly DitaSequenceSlot[],
  tag: string,
): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]!.tags.includes(tag)) return i;
  }
  return UNKNOWN_RANK;
}

function resolveRank(
  parentTag: string,
  slots: readonly DitaSequenceSlot[],
  tag: string,
): number {
  const rank = findSlotIndex(slots, tag);
  if (rank !== UNKNOWN_RANK) return rank;
  return OPEN_TAIL_CONTAINERS.has(parentTag) ? TAIL_RANK : UNKNOWN_RANK;
}

/** Whether this tag is declared by the ordered content model of `parentTag`. */
export function isSequenceTag(parentTag: string, tag: string): boolean {
  const slots = DITA_SEQUENCE_MODEL[parentTag];
  if (!slots) return false;
  return findSlotIndex(slots, tag) !== UNKNOWN_RANK;
}

/** Whether `parentTag` has a declared ordered content model at all. */
export function hasSequenceModel(parentTag: string): boolean {
  return DITA_SEQUENCE_MODEL[parentTag] !== undefined;
}

export interface SequenceValidationOptions {
  /**
   * True when the element's content is supplied at publish time (`conref` / `conkeyref`),
   * which legitimately leaves the element empty in the source and must not be reported
   * as a missing required child.
   */
  contentIsReused?: boolean;
}

/**
 * Validate the direct-child tag sequence of `parentTag` against the DITA 1.3 ordered content model.
 * Returns `[]` for parents without an ordered model.
 */
export function validateChildSequence(
  parentTag: string,
  childTags: readonly string[],
  options: SequenceValidationOptions = {},
): StructureIssue[] {
  const slots = DITA_SEQUENCE_MODEL[parentTag];
  if (!slots) return [];

  const issues: StructureIssue[] = [];
  const counts = new Map<number, number>();
  const slotTags = new Map<number, Set<string>>();
  let lastRank = -1;

  for (let index = 0; index < childTags.length; index++) {
    const childTag = childTags[index]!;
    const rank = resolveRank(parentTag, slots, childTag);

    if (rank === UNKNOWN_RANK) {
      // Unknown or specialized element in a strict-sequence container: pass through transparently
      // so custom specializations never poison ordering of subsequent valid siblings.
      continue;
    }

    if (rank === TAIL_RANK) {
      // Open-tail container (section/example/refsyn/fig): record tail tags so a displaced leading
      // `<title>` / `<desc>` can cite the concrete preceding body element(s).
      const tailSeen = slotTags.get(TAIL_RANK) ?? new Set<string>();
      tailSeen.add(childTag);
      slotTags.set(TAIL_RANK, tailSeen);
      lastRank = TAIL_RANK;
      continue;
    }

    const slot = slots[rank]!;
    const single = isSingleOccurrence(slot);
    const seen = slotTags.get(rank) ?? new Set<string>();
    const prevCount = counts.get(rank) ?? 0;

    // 1. Exclusive choice violation on a single-occurrence `(a | b)?` slot takes precedence over
    //    out-of-order: moving the element elsewhere cannot resolve an exclusive conflict.
    if (single && slot.tags.length > 1 && seen.size > 0 && !seen.has(childTag)) {
      issues.push({
        code: 'slot-exclusive',
        parentTag,
        childTag,
        index,
        expectedTags: slot.tags,
        severity: 'error',
      });
      continue;
    }

    // 2. Single-occurrence cardinality violation takes precedence over out-of-order: a second
    //    `<title>` after `<body>` must be removed/merged, not moved before `<body>`.
    if (single && prevCount >= 1) {
      counts.set(rank, prevCount + 1);
      issues.push({
        code: 'child-cardinality',
        parentTag,
        childTag,
        index,
        expectedTags: slot.tags,
        severity: 'error',
      });
      continue;
    }

    seen.add(childTag);
    slotTags.set(rank, seen);
    counts.set(rank, prevCount + 1);

    // 3. Sequence violation: this child belongs earlier than at least one preceding element.
    if (rank < lastRank) {
      const displaced: string[] = [];
      const displacedSet = new Set<string>();
      for (const [seenRank, seenInSlot] of slotTags) {
        if (seenRank <= rank) continue;
        for (const tag of seenInSlot) {
          if (!displacedSet.has(tag)) {
            displacedSet.add(tag);
            displaced.push(tag);
          }
        }
      }
      issues.push({
        code: 'child-out-of-order',
        parentTag,
        childTag,
        index,
        expectedTags: displaced,
        severity: 'error',
      });
      continue;
    }

    lastRank = rank;
  }

  if (options.contentIsReused) return issues;

  for (let rank = 0; rank < slots.length; rank++) {
    const slot = slots[rank]!;
    if (slot.occurrence !== 'required' && slot.occurrence !== 'oneOrMore') continue;
    if ((counts.get(rank) ?? 0) > 0) continue;
    issues.push({
      code: 'missing-required-child',
      parentTag,
      childTag: slot.tags[0]!,
      expectedTags: slot.tags,
      // An empty `+` container is still legal-ish while authoring, so keep it a warning.
      severity: slot.occurrence === 'required' ? 'error' : 'warning',
    });
  }

  return issues;
}

export interface InsertionSlotResult {
  ok: boolean;
  /** Child index (inside the parent) at which the new element should be inserted to stay in order. */
  index: number;
  /** Earliest valid insertion index for this slot. */
  minIndex?: number;
  /** Latest valid insertion index for this slot. */
  maxIndex?: number;
  /** Reason why the element may not be inserted now (cardinality / choice conflict). */
  issue?: StructureIssue;
}

/**
 * Compute the sequence-correct insertion index for `tag` inside `parentTag` given the current
 * direct-child tags, and reject insertions that would break cardinality or an exclusive `|` choice.
 *
 * When `preferredIndex` is supplied (e.g. from the cursor position or a clicked between-block `+`
 * gap), it is preserved whenever it already falls within the legal `[minIndex, maxIndex]` range
 * (crucial for repeating slots like `ul/li`, `steps/step`, `dl/dlentry`) and clamped into range
 * when out of order.
 */
export function getInsertionSlot(
  parentTag: string,
  existingChildTags: readonly string[],
  tag: string,
  preferredIndex?: number,
): InsertionSlotResult {
  const slots = DITA_SEQUENCE_MODEL[parentTag];
  const fallbackIndex =
    preferredIndex === undefined
      ? existingChildTags.length
      : Math.max(0, Math.min(existingChildTags.length, preferredIndex));
  if (!slots) {
    return { ok: true, index: fallbackIndex, minIndex: 0, maxIndex: existingChildTags.length };
  }

  const targetRank = resolveRank(parentTag, slots, tag);
  if (targetRank === UNKNOWN_RANK) {
    return { ok: true, index: fallbackIndex, minIndex: 0, maxIndex: existingChildTags.length };
  }

  let count = 0;
  const seen = new Set<string>();
  let lastLowerIdx = -1;
  let firstHigherIdx = existingChildTags.length;

  for (let i = 0; i < existingChildTags.length; i++) {
    const childTag = existingChildTags[i]!;
    const rank = resolveRank(parentTag, slots, childTag);
    if (rank === UNKNOWN_RANK) continue;
    if (rank < targetRank) {
      lastLowerIdx = i;
    } else if (rank > targetRank && firstHigherIdx === existingChildTags.length) {
      firstHigherIdx = i;
    } else if (rank === targetRank) {
      count++;
      seen.add(childTag);
    }
  }

  const minIndex = lastLowerIdx + 1;
  // When existing children are already misordered (`minIndex > firstHigherIdx`), anchor right
  // after the last preceding lower-rank sibling so relative order with earlier slots stays valid.
  const maxIndex = Math.max(minIndex, firstHigherIdx);
  const index =
    preferredIndex === undefined
      ? maxIndex
      : Math.max(minIndex, Math.min(maxIndex, preferredIndex));

  if (targetRank !== TAIL_RANK) {
    const slot = slots[targetRank]!;
    if (isSingleOccurrence(slot)) {
      if (slot.tags.length > 1 && seen.size > 0 && !seen.has(tag)) {
        return {
          ok: false,
          index,
          minIndex,
          maxIndex,
          issue: {
            code: 'slot-exclusive',
            parentTag,
            childTag: tag,
            expectedTags: slot.tags,
            severity: 'error',
          },
        };
      }
      if (count > 0) {
        return {
          ok: false,
          index,
          minIndex,
          maxIndex,
          issue: {
            code: 'child-cardinality',
            parentTag,
            childTag: tag,
            expectedTags: slot.tags,
            severity: 'error',
          },
        };
      }
    }
  }

  return { ok: true, index, minIndex, maxIndex };
}

/**
 * Filter insert-menu candidates down to the tags that are still legal *right now*
 * (cardinality / exclusive `|` choice aware). Tags without a declared slot are kept.
 */
export function getInsertableTagsBySequence(
  parentTag: string,
  existingChildTags: readonly string[],
  candidateTags: readonly string[],
): string[] {
  if (!hasSequenceModel(parentTag)) return [...candidateTags];
  return candidateTags.filter(
    (tag) => getInsertionSlot(parentTag, existingChildTags, tag).ok,
  );
}
