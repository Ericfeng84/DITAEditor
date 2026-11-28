/**
 * Phase 16 Stage 1 — isomorphic translation, glossary & QA contracts.
 *
 * Everything in this module is shared verbatim by `@dita/api` (queue workers, review service)
 * and `@dita/web` (translation center, bilingual review workbench). Keep it free of `node:*`
 * imports and of any XML implementation detail.
 *
 * Binding blueprint: docs/plans/phase16-translation.md §2.2, §3.1, Stage 1.
 */

/** Lifecycle of one target-language file relative to its source baseline water mark. */
export type TranslationFileStatus =
  | 'untranslated'
  | 'outdated'
  | 'outdated_metadata_only'
  | 'in_queue'
  | 'in_review'
  | 'draft_ready'
  | 'synced'
  | 'source_deleted'
  | 'source_renamed';

/** What happened to a translatable block between the previous and the current source. */
export type SegmentChangeKind = 'unchanged' | 'modified' | 'added' | 'protected' | 'deleted';

/**
 * - `incremental`: reuse `T0` for unchanged blocks, translate only what changed.
 * - `full`: no usable `S0`/`T0` baseline, translate every non-protected block.
 * - `full_with_reference`: `S0 × T0` diverged too far (match ratio < 0.5); translate everything
 *   but hand `T0` to the model as a reference instead of silently misaligning blocks.
 */
export type IncrementalPlanMode = 'incremental' | 'full' | 'full_with_reference';

/** Why a block is excluded from machine translation (but still carried into the output). */
export type SegmentProtectedReason = 'code_or_pre' | 'conref' | 'translate_no';

/** One translatable (or protected) block extracted from a DITA topic or map. */
export interface TranslatableSegment {
  /** Deterministic id: `<structuralPath>` joined with the element tag, e.g. `task[0]/title[0]`. */
  segmentId: string;
  elementTag: string;
  /** `id` attribute value when present, otherwise `''`. */
  elementId: string;
  /** Deterministic per-tag child index path, e.g. `/task[0]/taskbody[0]/steps[0]/step[1]/cmd[0]`. */
  structuralPath: string;
  /** Lossless XML of the whole element, attributes included, exactly as it appears in the source. */
  sourceXml: string;
  /** XML of the element's children only (the part that is actually translated). */
  innerXml: string;
  /** Tag-stripped, whitespace-normalised text used for hashing, matching and QA. */
  plainText: string;
  /** `hashText()` of `elementTag + canonical inner XML`; stable across re-indentation. */
  contentHash: string;
  protected: boolean;
  protectedReason?: SegmentProtectedReason;
  /** True for `.ditamap` map metadata (`<title>`, `<navtitle>`, `<linktext>`, `<keyword>`). */
  isMapMeta?: boolean;
  /**
   * Set when the segment is a translatable *attribute* (`navtitle="…"`, map `title="…"`) rather
   * than an element. `structuralPath` then ends with `/@attrName`, `innerXml`/`sourceXml` carry the
   * whitespace-normalised, XML-escaped attribute text, and `plainText` the raw attribute value.
   */
  attributeName?: string;
}

/** Strategy that produced a source↔target (or previous↔current) block match. */
export type SegmentMatchStrategy =
  | 'element_id'
  | 'structural_path'
  | 'content_hash'
  | 'tag_lcs';

/** One aligned block of `S1` (current source) with its reused/proposed target side. */
export interface AlignedTranslationSegment {
  segmentId: string;
  changeKind: SegmentChangeKind;
  elementTag: string;
  elementId: string;
  structuralPath: string;

  prevSourceXml?: string;
  prevSourceText?: string;
  currSourceXml: string;
  currSourceText: string;

  prevTargetXml?: string;
  prevTargetText?: string;
  /** Deterministic 0-token reuse of `T0`; only set for `changeKind === 'unchanged'`. */
  proposedTargetXml?: string;
  proposedTargetText?: string;

  /** Hash of the current source block (`S1`). */
  sourceContentHash: string;
  protected: boolean;
  protectedReason?: SegmentProtectedReason;
  matchedBy?: SegmentMatchStrategy;
  needsReview?: boolean;
  /** Present when this block is an attribute segment (see `TranslatableSegment.attributeName`). */
  attributeName?: string;
}

/** A block that existed in `S0` but no longer exists in `S1`. */
export interface DeletedTranslationSegment {
  segmentId: string;
  elementTag: string;
  elementId: string;
  structuralPath: string;
  prevSourceXml: string;
  prevTargetXml?: string;
  attributeName?: string;
}

/** Full three-way (`S0 × S1 × T0`) incremental plan for one file. */
export interface IncrementalTranslationPlan {
  mode: IncrementalPlanMode;
  /** Share of non-protected `S0` blocks matched into `T0`; `1` when there is nothing to match. */
  matchRatio: number;
  /** `true` when `S0 ↔ T0` fell below the 0.5 match ratio and the plan degraded to reference mode. */
  structuralDivergence: boolean;
  segments: AlignedTranslationSegment[];
  deletedSegments: DeletedTranslationSegment[];
  stats: {
    total: number;
    unchanged: number;
    modified: number;
    added: number;
    protected: number;
    deleted: number;
  };
  sourceTranslatableHash: string;
  /** Raw XML changed but no translatable content did (formatting/comment/prolog-only edit). */
  metadataOnlyChange: boolean;
}

/** Result of `assembleTranslatedXml()` — the pre-review `T1` candidate plus its verification. */
export interface AssembleResult {
  ok: boolean;
  xml: string;
  wellFormedError?: { line: number; column: number; offset: number; message: string };
  structureIssues: Array<{
    code: string;
    message: string;
    path?: string;
    line?: number;
    column?: number;
    [key: string]: unknown;
  }>;
  pmCompatible: boolean;
  pmError?: string;
  warnings: string[];
}

/** Glossary entry flattened for matching/QA (one row per `(term, targetLang)` pair). */
export interface GlossaryEntryForMatch {
  termId: string;
  glossaryId: string;
  scope: 'global' | 'manual';
  sourceTerm: string;
  synonyms?: string[];
  targetTerm: string;
  forbiddenTargets?: string[];
  caseSensitive: boolean;
  doNotTranslate: boolean;
  contextNote?: string;
  partOfSpeech?: string;
}

/** One non-overlapping glossary hit inside a text run. */
export interface GlossaryMatchHit {
  entry: GlossaryEntryForMatch;
  matchedText: string;
  start: number;
  end: number;
}

export type TranslationQaIssueCode =
  | 'missing_glossary_term'
  | 'forbidden_translation'
  | 'dnt_modified'
  | 'inline_tag_mismatch'
  | 'protected_attr_modified'
  | 'placeholder_mismatch'
  | 'xml_malformed'
  | 'structure_warning';

export interface TranslationQaIssue {
  code: TranslationQaIssueCode;
  severity: 'error' | 'warning';
  segmentId?: string;
  message: string;
  termId?: string;
  sourceTerm?: string;
  expected?: string;
  actual?: string;
}

/** One importable/exportable glossary row (CSV/JSON/TBX-Basic share this shape). */
export interface GlossaryExchangeRow {
  sourceTerm: string;
  synonyms?: string[];
  targetLang?: string;
  targetTerm?: string | null;
  forbiddenTargets?: string[];
  doNotTranslate?: boolean;
  caseSensitive?: boolean;
  contextNote?: string;
  partOfSpeech?: string;
  status?: 'approved' | 'draft' | 'deprecated';
}

/** Dry-run result of a glossary import (rows are never written by this kernel). */
export interface GlossaryImportPreview {
  rows: GlossaryExchangeRow[];
  errors: Array<{ row: number; message: string }>;
  stats: {
    total: number;
    newCount: number;
    updateCount: number;
    invalidCount: number;
  };
}

/** Raw parse result shared by the CSV/JSON/TBX decoders. */
export interface GlossaryParseResult {
  rows: GlossaryExchangeRow[];
  errors: Array<{ row: number; message: string }>;
}

/** Supported glossary exchange formats. */
export type GlossaryExchangeFormat = 'csv' | 'json' | 'tbx';

/** One audited block for `runTranslationQa()`. */
export interface TranslationQaSegmentInput {
  segmentId: string;
  sourceXml: string;
  sourceText: string;
  targetXml: string;
  targetText: string;
  protected?: boolean;
  attributeName?: string;
}

export interface RunTranslationQaInput {
  segments: TranslationQaSegmentInput[];
  glossary: GlossaryEntryForMatch[];
}
