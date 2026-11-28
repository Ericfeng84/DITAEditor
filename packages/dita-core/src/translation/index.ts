/**
 * Phase 16 Stage 1 — isomorphic translation, glossary & QA kernel.
 *
 * Consumed by `@dita/api` (translation jobs, glossary CRUD, review gates) and by `@dita/web`
 * (translation center, bilingual review workbench). Everything here is pure TypeScript over
 * `slimdom` — no `node:*` imports, so the same code runs in a browser worker.
 *
 * Binding blueprint: docs/plans/phase16-translation.md §2.2, §3.1, Stage 1.
 */

export type {
  AlignedTranslationSegment,
  AssembleResult,
  DeletedTranslationSegment,
  GlossaryEntryForMatch,
  GlossaryExchangeFormat,
  GlossaryExchangeRow,
  GlossaryImportPreview,
  GlossaryMatchHit,
  GlossaryParseResult,
  IncrementalPlanMode,
  IncrementalTranslationPlan,
  RunTranslationQaInput,
  SegmentChangeKind,
  SegmentMatchStrategy,
  SegmentProtectedReason,
  TranslatableSegment,
  TranslationFileStatus,
  TranslationQaIssue,
  TranslationQaIssueCode,
  TranslationQaSegmentInput,
} from './types.js';

export {
  computeTranslatableDocumentFingerprint,
  extractPlainText,
  extractTranslatableSegments,
  findElementByStructuralPath,
  hashText,
  parseAttributeStructuralPath,
  serializeElementXml,
  serializeInnerXml,
  setRootXmlLang,
} from './segment-extractor.js';
export type {
  ExtractPlainTextOptions,
  ExtractTranslatableSegmentsOptions,
} from './segment-extractor.js';

export {
  STRUCTURAL_DIVERGENCE_THRESHOLD,
  assembleTranslatedXml,
  planIncrementalTranslation,
} from './incremental-diff.js';
export type {
  AssembleTranslatedXmlInput,
  PlanIncrementalTranslationInput,
} from './incremental-diff.js';

export { matchGlossaryTerms, mergeGlossaryEntries } from './glossary-matcher.js';

export { runTranslationQa } from './translation-qa.js';

export {
  GLOSSARY_CSV_COLUMNS,
  parseGlossaryCsv,
  parseGlossaryJson,
  parseGlossaryTbx,
  previewGlossaryImport,
  serializeGlossaryCsv,
  serializeGlossaryJson,
  serializeGlossaryTbx,
} from './glossary-codec.js';
