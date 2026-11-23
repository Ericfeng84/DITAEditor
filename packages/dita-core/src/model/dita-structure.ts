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
import { DITA_BLOCK_TAGS } from './dita-elements.js';
import { getAllowedChildElementTags } from './dita-rules.js';
import type { TaskContentModel } from './task-model.js';

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
  | 'slot-exclusive'
  /**
   * A known DITA element the container's variant forbids — e.g. `<section>` or `<steps-informal>`
   * inside `<taskbody>` under the strict `task.dtd` model. Unknown / specialized elements never
   * produce this issue, so passthrough content stays lossless.
   */
  | 'child-not-allowed';

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
  'child-not-allowed': 'structure.childNotAllowed',
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
 * Strict Task body (`task.dtd` + `strictTaskbodyConstraint.mod`):
 * `(prereq?, context?, (steps | steps-unordered)?, result?, tasktroubleshooting?,
 *   example?, postreq?)`
 * Every slot is single-occurrence and ordered; `<section>` / `<steps-informal>` are not allowed.
 */
const STRICT_TASKBODY_SLOTS: readonly DitaSequenceSlot[] = [
  optional('prereq'),
  optional('context'),
  optional('steps', 'steps-unordered'),
  optional('result'),
  optional('tasktroubleshooting'),
  optional('example'),
  optional('postreq'),
];

/**
 * Unconstrained Task body (`generalTask.dtd` / `ditabase.dtd`, plain `task.mod`):
 * `((prereq | context | section)*, (steps | steps-unordered | steps-informal)?, result?,
 *   tasktroubleshooting?, example*, postreq*)`
 * The three leading prose containers share ONE repeating mixed slot because the DTD lets them
 * interleave freely; splitting them into ordered slots would fabricate `child-out-of-order`.
 */
const GENERAL_TASKBODY_SLOTS: readonly DitaSequenceSlot[] = [
  many('prereq', 'context', 'section'),
  optional('steps', 'steps-unordered', 'steps-informal'),
  optional('result'),
  optional('tasktroubleshooting'),
  many('example'),
  many('postreq'),
];

/** Slot lists that differ between the strict and the general DITA 1.3 task shells. */
/**
 * Elements a container accepts only outside the strict task shell. `task.dtd` pulls in
 * `strictTaskbodyConstraint.mod`, which narrows `<taskbody>` to
 * `(prereq?, context?, (steps|steps-unordered)?, result?, tasktroubleshooting?, example?, postreq?)`,
 * so `<section>` and `<steps-informal>` are illegal there while `generalTask.dtd` / `ditabase.dtd`
 * allow them. Unknown / specialized elements are never listed here — they stay lossless.
 */
const STRICT_FORBIDDEN_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  taskbody: ['section', 'steps-informal'],
};

export const GENERAL_TASK_SEQUENCE_OVERRIDES: Readonly<
  Record<string, readonly DitaSequenceSlot[]>
> = {
  taskbody: GENERAL_TASKBODY_SLOTS,
};

/**
 * Ordered content model of `parentTag` for the given task shell.
 * Non-task containers are identical in both variants.
 */
export function getSequenceSlots(
  parentTag: string,
  taskModel: TaskContentModel = 'strict',
): readonly DitaSequenceSlot[] | undefined {
  if (taskModel === 'general') {
    const override = GENERAL_TASK_SEQUENCE_OVERRIDES[parentTag];
    if (override) return override;
  }
  return DITA_SEQUENCE_MODEL[parentTag];
}

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
    many('topic'),
  ],
  concept: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('conbody'),
    optional('related-links'),
    many('concept'),
  ],
  task: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('taskbody'),
    optional('related-links'),
    many('task'),
  ],
  reference: [
    required('title'),
    optional('titlealts'),
    optional('shortdesc', 'abstract'),
    optional('prolog'),
    optional('refbody'),
    optional('related-links'),
    many('reference'),
  ],

  // Task body — default is Strict Task (OASIS DITA 1.3 `task.dtd`, which pulls in
  // `strictTaskbodyConstraint.mod`); `GENERAL_TASK_SEQUENCE_OVERRIDES` below swaps in the
  // unconstrained `generalTask.dtd` / `ditabase.dtd` model when that shell is selected.
  taskbody: STRICT_TASKBODY_SLOTS,

  // Concept body — OASIS DITA 1.3 `concept.mod`: ((body.cnt)*, (section | example | conbodydiv)*).
  // Plain blocks must all precede the section/example divisions, which is exactly the rule such
  // guides call “no orphan paragraph after a section”. `<body>` is genuinely unordered
  // (`topic.mod`: (body.cnt | bodydiv | example | section)*), so it gets no slots.
  conbody: [
    many(
      'p',
      'note',
      'hazardstatement',
      'ul',
      'ol',
      'dl',
      'codeblock',
      'pre',
      'fig',
      'image',
      'simpletable',
      'table',
    ),
    many('section', 'example', 'conbodydiv'),
  ],
  conbodydiv: [many('section', 'example')],

  // Title-first open-tail containers
  section: [optional('title')],
  example: [optional('title')],
  refsyn: [optional('title')],
  fig: [optional('title'), optional('desc')],

  // Tables (OASIS CALS + DITA simpletable)
  table: [optional('title'), optional('desc'), some('tgroup')],
  simpletable: [optional('sthead'), some('strow')],

  // Reference parameter tables (reference.mod: `properties = (prophead?, property+)`).
  properties: [optional('prophead'), some('property')],
  prophead: [optional('proptypehd'), optional('propvaluehd'), optional('propdeschd')],
  property: [optional('proptype'), optional('propvalue'), optional('propdesc')],
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

  // topic.mod `titlealts.content` = (navtitle?, searchtitle?)
  titlealts: [optional('navtitle'), optional('searchtitle')],

  // Links & metadata (OASIS DITA 1.3 topic.mod / metaDecl.mod)
  'related-links': [many('link', 'linklist', 'linkpool')],
  link: [optional('linktext'), optional('desc')],
  // topic.mod `linklist.content` = (title?, desc?, (linklist | link)*, linkinfo?)
  linklist: [optional('title'), optional('desc'), many('link', 'linklist'), optional('linkinfo')],
  // topic.mod `linkpool.content` = (linkpool | link)*
  linkpool: [many('link', 'linkpool')],
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
export function isSequenceTag(
  parentTag: string,
  tag: string,
  taskModel: TaskContentModel = 'strict',
): boolean {
  const slots = getSequenceSlots(parentTag, taskModel);
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
  /** Task shell variant: `strict` (default, `task.dtd`) or `general` (`generalTask.dtd`). */
  taskModel?: TaskContentModel;
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
  const membershipIssues = collectForbiddenChildIssues(parentTag, childTags);
  const slots = getSequenceSlots(parentTag, options.taskModel);
  if (!slots) return membershipIssues;

  const issues: StructureIssue[] = [];
  const counts = new Map<number, number>();
  const slotTags = new Map<number, Set<string>>();
  let lastRank = -1;

  for (let index = 0; index < childTags.length; index++) {
    const childTag = childTags[index]!;
    const rank = resolveRank(parentTag, slots, childTag);

    if (rank === UNKNOWN_RANK) {
      // Strict task shell: `<section>` / `<steps-informal>` are known elements that `task.dtd`
      // forbids inside `<taskbody>` — report them instead of treating them as passthrough.
      if (
        (options.taskModel ?? 'strict') === 'strict' &&
        STRICT_FORBIDDEN_CHILDREN[parentTag]?.includes(childTag)
      ) {
        issues.push({
          code: 'child-not-allowed',
          parentTag,
          childTag,
          index,
          expectedTags: slots.flatMap((slot) => slot.tags),
          severity: 'error',
        });
        continue;
      }
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

  if (options.contentIsReused) return [...issues, ...membershipIssues];

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

  return [...issues, ...membershipIssues];
}

/**
 * Containers whose `DITA_CONTENT_MODEL` entry is the *complete* child list (no open tail).
 * Inside them a declared DITA block that the DTD forbids must be reported instead of being
 * silently absorbed — this is what catches e.g. `<properties>` written inside `<section>` or a
 * bare `<p>` written directly in `<refbody>`.
 */
const EXHAUSTIVE_MEMBERSHIP_CONTAINERS: ReadonlySet<string> = new Set([
  'section',
  'refsyn',
  'refbody',
  'refbodydiv',
]);

/**
 * Report DITA block children that the content model does not allow in an exhaustive container.
 * Unknown / specialized elements are never reported — they must stay lossless passthroughs.
 */
function collectForbiddenChildIssues(
  parentTag: string,
  childTags: readonly string[],
): StructureIssue[] {
  if (!EXHAUSTIVE_MEMBERSHIP_CONTAINERS.has(parentTag)) return [];

  const allowed = getAllowedChildElementTags(parentTag);
  const allowedSet = new Set(allowed);
  const issues: StructureIssue[] = [];

  for (let index = 0; index < childTags.length; index++) {
    const childTag = childTags[index]!;
    if (!DITA_BLOCK_TAGS.has(childTag) || allowedSet.has(childTag)) continue;
    issues.push({
      code: 'child-not-allowed',
      parentTag,
      childTag,
      index,
      expectedTags: allowed,
      severity: 'error',
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
  taskModel: TaskContentModel = 'strict',
): InsertionSlotResult {
  const slots = getSequenceSlots(parentTag, taskModel);
  const fallbackIndex =
    preferredIndex === undefined
      ? existingChildTags.length
      : Math.max(0, Math.min(existingChildTags.length, preferredIndex));
  if (!slots) {
    return { ok: true, index: fallbackIndex, minIndex: 0, maxIndex: existingChildTags.length };
  }

  const targetRank = resolveRank(parentTag, slots, tag);
  if (targetRank === UNKNOWN_RANK) {
    // Known-but-forbidden elements (strict taskbody without `section`) must not be offered as
    // insertable; unknown / specialized elements keep the permissive fallback.
    if (taskModel === 'strict' && STRICT_FORBIDDEN_CHILDREN[parentTag]?.includes(tag)) {
      return { ok: false, index: fallbackIndex, minIndex: 0, maxIndex: existingChildTags.length };
    }
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
  taskModel: TaskContentModel = 'strict',
): string[] {
  if (!hasSequenceModel(parentTag)) return [...candidateTags];
  return candidateTags.filter(
    (tag) => getInsertionSlot(parentTag, existingChildTags, tag, undefined, taskModel).ok,
  );
}

/**
 * Children this EDITOR refuses to delete because doing so would leave no legal editing anchor,
 * even though OASIS DITA 1.3 itself keeps the slot optional.
 *
 * This is an authoring policy, not a DTD rule: DITA 1.3 `task.content` really is
 * `(title, titlealts?, (abstract | shortdesc)?, prolog?, (taskbody)?, related-links?, task-info-types*)`,
 * so a `<task>` without `<taskbody>` is valid DITA. We still keep `<taskbody>` because every block
 * element inside a task body needs it as a legal ProseMirror parent; removing it would lock visual
 * editing (see the missing-taskbody skeleton fix in `apps/web/src/editor/visual/commands.ts`).
 * The sequence model keeps the slot `optional` so incremental authoring never fabricates a
 * `missing-required-child` diagnostic.
 */
const REQUIRED_STRUCTURAL_CHILDREN: Readonly<Record<string, readonly string[]>> = {
  task: ['taskbody'],
};

export type ChildRemovalObstacleCode =
  /** The child is the document root element. */
  | 'root-element'
  /** The DITA content model requires this child (`required` slot of the sequence model). */
  | 'required-child'
  /** Editor policy: a structurally necessary wrapper the author must keep (see above). */
  | 'required-policy'
  /** Deleting would empty a `oneOrMore` slot, e.g. the last `<step>` of `<steps>`. */
  | 'last-of-one-or-more';

export interface ChildRemovalObstacle {
  code: ChildRemovalObstacleCode;
  parentTag: string;
  childTag: string;
}

/**
 * Whether removing `childTag` from a `parentTag` element would break the DITA 1.3 content model.
 * `parentTag` is the empty string for the document root.
 *
 * Only structural obstacles are reported: order of the remaining siblings is irrelevant to a
 * removal, so `child-out-of-order` / `slot-exclusive` are never produced here.
 */
export function checkChildRemoval(
  parentTag: string,
  childTag: string,
  siblingTags: readonly string[],
  taskModel: TaskContentModel = 'strict',
): ChildRemovalObstacle | null {
  if (!parentTag) return { code: 'root-element', parentTag, childTag };

  const declaredRequired = REQUIRED_STRUCTURAL_CHILDREN[parentTag];
  if (declaredRequired?.includes(childTag)) {
    return { code: 'required-policy', parentTag, childTag };
  }

  const slots = getSequenceSlots(parentTag, taskModel);
  if (!slots) return null;
  const slot = slots[findSlotIndex(slots, childTag)];
  if (!slot) return null;

  if (slot.occurrence === 'required') {
    return { code: 'required-child', parentTag, childTag };
  }
  if (slot.occurrence === 'oneOrMore') {
    const remaining = siblingTags.filter((tag) => slot.tags.includes(tag)).length;
    if (remaining <= 1) return { code: 'last-of-one-or-more', parentTag, childTag };
  }
  return null;
}
