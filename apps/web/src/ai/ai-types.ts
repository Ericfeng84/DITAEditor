import type {
  AiTargetMode,
  AiTargetSpec,
  AiVerificationReport,
} from '@dita/core';

export type { AiTargetMode, AiTargetSpec, AiVerificationReport };

/** Task families understood by `POST /api/ai/stream`. */
export type AiTaskType = 'ask' | 'authoring' | 'optimize_tags' | 'fix_error';

/**
 * Every task family that can appear in the usage ledger.
 *
 * The `ingest_*` and `translate_*` families never reach `/api/ai/stream` (they run inside the
 * ingest repair agent and the translation pipeline) but they are recorded in `ai_usage`, so the
 * statistics tab has to label them too.
 */
export type AiUsageTaskType =
  | AiTaskType
  | 'ingest_plan'
  | 'ingest_write'
  | 'ingest_repair'
  | 'translate_batch'
  | 'translate_block'
  | 'translate_refine'
  | 'translate_review'
  | 'translate_repair';

/** Narrow fix sub-action used by diagnostic / strict-validation entry points. */
export type AiSubAction = 'optimize_tags' | 'fix_xml' | 'fix_diagnostic' | 'fix_strict';

export type AiApiKeySource = 'db' | 'env' | 'none';

/**
 * Phase 16 — the independent reviewer model used by the translation quality loop.
 *
 * Kept separate from the primary provider because the reviewer must stay *independent* (a
 * different family reads the translation without seeing the translator's reasoning) and *cold*
 * (temperature ≤ 0.1). Every `hasDedicated*` flag answers "did the user override this field?", so
 * the dialog can render the inherited value without guessing.
 */
export interface AiReviewerPublicConfig {
  configured: boolean;
  isDedicated: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeySource: AiApiKeySource;
  maskedApiKey: string | null;
  temperature: number;
  hasDedicatedBaseUrl: boolean;
  hasDedicatedModel: boolean;
  hasDedicatedApiKey: boolean;
  hasDedicatedTemperature: boolean;
}

/** Public (never-secret) AI provider configuration returned by `GET /api/ai/config`. */
export interface AiPublicConfig {
  configured: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeySource: AiApiKeySource;
  maskedApiKey: string | null;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
  maxContextChars: number;
  canEdit: boolean;
  /**
   * Optional so an older API build (or a test mock predating Phase 16) still type-checks; the
   * settings dialog degrades to "inherit primary" when it is absent.
   */
  reviewer?: AiReviewerPublicConfig;
}

export interface AiReviewerConfigPatch {
  baseUrl?: string | null;
  model?: string | null;
  apiKey?: string | null;
  temperature?: number | null;
}

export interface AiConfigPatch {
  baseUrl?: string;
  model?: string;
  /** `null` clears the database key and falls back to the environment variable. */
  apiKey?: string | null;
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** `null` on every field means "inherit the primary model again". */
  reviewer?: AiReviewerConfigPatch;
}

export interface AiConfigTestInput {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  /** Which provider to probe: the primary one, or the Phase 16 quality reviewer. */
  role?: 'primary' | 'reviewer';
}

export interface AiConfigTestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  message?: string;
}

export interface AiDiagnosticContext {
  source: string;
  message: string;
  line?: number;
  column?: number;
  code?: string;
}

export interface AiHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Request body for `POST /api/ai/stream` (contract §3, plus additive `branch`). */
export interface AiStreamRequest {
  projectPath: string;
  /** Current editor buffer (may contain unsaved edits). Falls back to the file on disk. */
  xml?: string;
  rootMapPath?: string;
  ditavalPath?: string;
  branch?: string;
  taskType: AiTaskType;
  subAction?: AiSubAction;
  instruction: string;
  target: AiTargetSpec;
  context?: { diagnostics?: AiDiagnosticContext[] };
  history?: AiHistoryTurn[];
}

export interface AiMetaEvent {
  requestId: string;
  model: string;
  targetMode: AiTargetMode;
  targetTag: string | null;
  contextBadges: string[];
}

export interface AiDeltaEvent {
  text: string;
}

export interface AiRetryEvent {
  attempt: number;
  maxRetries: number;
  reason: string;
}

/** Verification subset emitted on the proposal frame (server-side retry count included). */
export interface AiProposalVerification {
  wellFormed: boolean;
  prosemirrorCompatible: boolean;
  preservedDoctype: boolean;
  retryCount: number;
  warnings: string[];
}

export interface AiProposal {
  explanation: string;
  changesSummary: string[];
  originalXml: string;
  patchedXml: string;
  targetMode: AiTargetMode;
  targetTag: string | null;
  verification: AiProposalVerification;
  canRevalidateStrict: boolean;
}

export interface AiErrorEvent {
  message: string;
  code?: string;
}

export interface AiUsageTokens {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiDoneEvent {
  status: 'succeeded' | 'failed' | 'cancelled';
  usage: AiUsageTokens;
  durationMs: number;
}

export type AiSseEvent =
  | ({ type: 'meta' } & AiMetaEvent)
  | ({ type: 'delta' } & AiDeltaEvent)
  | ({ type: 'retry' } & AiRetryEvent)
  | ({ type: 'proposal' } & AiProposal)
  | ({ type: 'error' } & AiErrorEvent)
  | ({ type: 'done' } & AiDoneEvent);

/**
 * Aggregated admin usage statistics from `GET /api/ai/usage`.
 * Field names mirror `apps/api/src/modules/ai/types.ts` exactly — keep them in sync
 * (`apps/api/test/phase6-ai-api.test.ts` pins the payload keys).
 */
export interface AiUsageTokenSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiUsageTotals extends AiUsageTokenSummary {
  succeeded: number;
  failed: number;
  cancelled: number;
  avgDurationMs: number;
}

export interface AiUsageDayBucket extends AiUsageTokenSummary {
  day: string;
}

export interface AiUsageTaskBucket extends AiUsageTokenSummary {
  taskType: AiUsageTaskType;
}

export interface AiUsageUserBucket extends AiUsageTokenSummary {
  userId: string;
  displayName: string;
}

export interface AiUsageModelBucket extends AiUsageTokenSummary {
  model: string;
}

export interface AiUsageRecentEntry {
  id: string;
  taskType: AiUsageTaskType;
  subAction: string | null;
  status: 'succeeded' | 'failed' | 'cancelled';
  userDisplayName: string;
  model: string;
  filePath: string | null;
  retryCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  createdAt: string;
}

export interface AiUsageSummary {
  days: number;
  totals: AiUsageTotals;
  byDay: AiUsageDayBucket[];
  byTask: AiUsageTaskBucket[];
  byUser: AiUsageUserBucket[];
  byModel: AiUsageModelBucket[];
  recent: AiUsageRecentEntry[];
}

/** Context assembled when a diagnostic row launches an AI fix. */
export interface AiFixContext {
  taskType: 'fix_error';
  subAction: AiSubAction;
  target: AiTargetSpec;
  instruction: string;
  diagnostics?: AiDiagnosticContext[];
}
