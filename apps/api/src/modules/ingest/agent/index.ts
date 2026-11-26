/**
 * Phase 14 Stage 2 — multi-role ingest agents (Planner → Writer → Validator/Repairer).
 *
 * Stage 3's `IngestService` orchestrates these roles; each module is independently testable through
 * the injectable `AiModelFactory` / `strictValidator` in `IngestAgentDeps`.
 */

export * from './types.js';
export { planDocumentOutline, enforceTargetMode, extractJsonCandidate } from './planner-agent.js';
export {
  draftTopicWithAgent,
  draftTopicsConcurrently,
  postProcessGeneratedTopicXml,
  extractTopicXml,
  rewriteAssetReferences,
  runWithConcurrency,
  topicDoctypeFor,
} from './writer-agent.js';
export {
  draftAndVerifyTopic,
  repairTopicWithAgent,
  validateAndRepairBatch,
  validateTopicLayer1,
} from './validator-repair-agent.js';
export {
  runDitaOtRepairAgent,
  assertInsideStaging,
  type DitaOtRepairAgentInput,
  type DitaOtRepairAgentResult,
} from './dita-ot-repair-agent.js';
