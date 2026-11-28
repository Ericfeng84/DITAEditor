import { z } from 'zod';

/**
 * Phase 6 AI assistance — binding request/response contracts.
 * Source of truth: docs/design/ai-contract.md §3.
 */

export const aiTaskTypeSchema = z.enum([
  'ask',
  'authoring',
  'optimize_tags',
  'fix_error',
  /** Phase 14 ingest: outline planning, topic writing, and validation repair passes. */
  'ingest_plan',
  'ingest_write',
  'ingest_repair',
  /** Phase 16 translation: whole-topic batch, single-block, and refine/review passes. */
  'translate_batch',
  'translate_block',
  'translate_refine',
  /** Phase 16: independent reviewer AI and targeted repair passes. */
  'translate_review',
  'translate_repair',
]);
export type AiTaskType = z.infer<typeof aiTaskTypeSchema>;

export const aiSubActionSchema = z.enum([
  'optimize_tags',
  'fix_xml',
  'fix_diagnostic',
  'fix_strict',
]);
export type AiSubAction = z.infer<typeof aiSubActionSchema>;

export const aiTargetModeSchema = z.enum(['element', 'line-window', 'full-document']);

export const aiTargetSpecSchema = z.object({
  mode: aiTargetModeSchema,
  elementPath: z.array(z.number().int().nonnegative()).max(64).optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  selectedText: z.string().max(20_000).optional(),
});
export type AiTargetSpecInput = z.infer<typeof aiTargetSpecSchema>;

export const aiDiagnosticSchema = z.object({
  source: z.string().trim().min(1).max(64),
  message: z.string().min(1).max(2000),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  code: z.string().trim().max(64).optional(),
});
export type AiDiagnosticInput = z.infer<typeof aiDiagnosticSchema>;

export const aiHistoryTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8000),
});
export type AiHistoryTurn = z.infer<typeof aiHistoryTurnSchema>;

export const aiStreamRequestSchema = z.object({
  projectPath: z.string().trim().min(1).max(1000),
  xml: z.string().max(500_000).optional(),
  rootMapPath: z.string().trim().max(1000).nullable().optional(),
  ditavalPath: z.string().trim().max(1000).nullable().optional(),
  branch: z.string().trim().max(200).optional(),
  taskType: aiTaskTypeSchema,
  subAction: aiSubActionSchema.optional(),
  instruction: z.string().max(4000).default(''),
  includeProjectContext: z.boolean().default(true),
  target: aiTargetSpecSchema,
  context: z
    .object({
      diagnostics: z.array(aiDiagnosticSchema).max(50).optional(),
    })
    .optional(),
  history: z.array(aiHistoryTurnSchema).max(8).default([]),
});
export type AiStreamRequest = z.infer<typeof aiStreamRequestSchema>;

/**
 * Phase 16: an empty string or `null` clears a stored reviewer override so the role falls back to
 * the matching env variable and then to the primary role. A non-empty value must be a valid URL.
 */
const clearableUrlSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .refine(
    (value) =>
      value === undefined ||
      value === null ||
      value === '' ||
      z.string().url().safeParse(value).success,
    { message: 'ai.config.invalidUrl' },
  );

const clearableTextSchema = (max: number) => z.string().trim().max(max).nullable().optional();

export const aiConfigUpdateSchema = z.object({
  baseUrl: z.string().trim().url().max(500).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  apiKey: z.string().trim().max(500).nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  timeoutMs: z.number().int().min(1000).max(120_000).optional(),
  /**
   * Phase 16: optional dedicated reviewer role. `null`/`''` clears the stored override so the
   * reviewer falls back to the matching env variable and then to the primary role.
   */
  reviewer: z
    .object({
      baseUrl: clearableUrlSchema,
      model: clearableTextSchema(200),
      apiKey: clearableTextSchema(500),
      temperature: z.number().min(0).max(2).nullable().optional(),
    })
    .optional(),
});
export type AiConfigUpdateInput = z.infer<typeof aiConfigUpdateSchema>;

export const aiConfigTestSchema = z.object({
  baseUrl: z.string().trim().url().max(500).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  apiKey: z.string().trim().max(500).optional(),
  /** Phase 16: probe the dedicated reviewer role instead of the primary role. */
  role: z.enum(['primary', 'reviewer']).optional(),
});
export type AiConfigTestInput = z.infer<typeof aiConfigTestSchema>;

export const aiUsageQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type AiApiKeySource = 'db' | 'env' | 'none';

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
  /** Phase 16: independent reviewer role (masked; never carries the plaintext key). */
  reviewer: AiReviewerPublicConfig;
}

/**
 * Phase 16 reviewer role: a review-only AI that inherits the primary configuration unless a
 * dedicated base URL / model / key / temperature is configured (DB override, then env).
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

export interface AiConfigTestResult {
  ok: boolean;
  latencyMs: number;
  model: string;
  message?: string;
}

export interface AiUsageTokenSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiUsageTotals extends AiUsageTokenSummary {
  calls: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  avgDurationMs: number;
}

export interface AiUsageDayBucket extends AiUsageTokenSummary {
  day: string;
  calls: number;
}

export interface AiUsageTaskBucket extends AiUsageTokenSummary {
  taskType: AiTaskType;
  calls: number;
}

export interface AiUsageUserBucket extends AiUsageTokenSummary {
  userId: string;
  displayName: string;
  calls: number;
}

export interface AiUsageModelBucket extends AiUsageTokenSummary {
  model: string;
  calls: number;
}

export interface AiUsageLogView {
  id: string;
  projectId: string;
  branch: string;
  userId: string;
  userDisplayName: string;
  taskType: AiTaskType;
  subAction: string;
  filePath: string | null;
  model: string;
  status: 'succeeded' | 'failed' | 'cancelled';
  retryCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface AiUsageSummary {
  days: number;
  totals: AiUsageTotals;
  byDay: AiUsageDayBucket[];
  byTask: AiUsageTaskBucket[];
  byUser: AiUsageUserBucket[];
  byModel: AiUsageModelBucket[];
  recent: AiUsageLogView[];
}

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
  targetMode: 'element' | 'line-window' | 'full-document';
  targetTag: string | null;
  verification: AiProposalVerification;
  canRevalidateStrict: boolean;
}

export interface AiMetaPayload {
  requestId: string;
  model: string;
  targetMode: 'element' | 'line-window' | 'full-document';
  targetTag: string | null;
  contextBadges: string[];
}

export interface AiDonePayload {
  status: 'succeeded' | 'failed' | 'cancelled';
  usage: AiUsageTokenSummary;
  durationMs: number;
}

export type AiStreamEvent =
  | { event: 'meta'; data: AiMetaPayload }
  | { event: 'delta'; data: { text: string } }
  | { event: 'retry'; data: { attempt: number; maxRetries: number; reason: string } }
  | { event: 'proposal'; data: AiProposal }
  | { event: 'error'; data: { message: string; code?: string } }
  | { event: 'done'; data: AiDonePayload };
