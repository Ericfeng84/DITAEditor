import type {
  AiTargetMode,
  AiTargetSpec,
  AiVerificationReport,
} from '@dita/core';

export type { AiTargetMode, AiTargetSpec, AiVerificationReport };

/** Task families understood by `POST /api/ai/stream`. */
export type AiTaskType = 'ask' | 'authoring' | 'optimize_tags' | 'fix_error';

/** Narrow fix sub-action used by diagnostic / strict-validation entry points. */
export type AiSubAction = 'optimize_tags' | 'fix_xml' | 'fix_diagnostic' | 'fix_strict';

export type AiApiKeySource = 'db' | 'env' | 'none';

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
}

export interface AiConfigPatch {
  baseUrl?: string;
  model?: string;
  /** `null` clears the database key and falls back to the environment variable. */
  apiKey?: string | null;
  temperature?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface AiConfigTestInput {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
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
  taskType: AiTaskType;
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
  taskType: AiTaskType;
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
