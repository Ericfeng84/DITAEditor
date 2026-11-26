/**
 * Phase 14 Stage 2 — multi-role ingest agent contracts.
 *
 * The ingest pipeline is a deterministic three-role state machine:
 * `Planner` (Markdown outline → DITA plan) → `Writer` (per-topic DITA 1.3 XML) →
 * `Validator/Repairer` (Layer 1 `@dita/core` checks + Layer 2 semantic / DITA-OT strict checks).
 *
 * Everything the agents need is injected so tests can script an `AiModelFactory` and a
 * `strictValidator` without touching a real LLM or a DITA-OT installation.
 */

import type {
  DitaSemanticIndex,
  ExtractedIngestAsset,
  IngestDiagnosticItem,
  IngestOutlinePlan,
  IngestTopicProgress,
  IngestValidationReport,
  MarkdownSection,
  PlannedTopicNode,
} from '@dita/core';
import type { DitaMapTemplateType } from '@dita/core';
import type { DitaTopicTemplateType } from '@dita/core';
import type { ApiLocale } from '../../../i18n/locale.js';
import type { AiModelFactory } from '../../ai/ai-model-factory.js';
import type { AiSettingsService } from '../../ai/ai-settings-service.js';
import type { AiUsageService } from '../../ai/ai-usage-service.js';
import type { DitaRuntimeOptions } from '../../dita-ot/dita-runtime.js';
import type { IdentityUser } from '../../identity/identity-service.js';
import type {
  StrictValidationInput,
  StrictValidationResult,
} from '../../validate/strict-validator.js';

/**
 * Injectable DITA-OT strict validator. Tests pass a scripted stub, production passes
 * `validateStrict` itself (or nothing, letting `DitaRuntimeOptions` decide).
 */
export type IngestStrictValidator = (
  input: StrictValidationInput,
) => Promise<StrictValidationResult>;

/** Injected services shared by every agent role. */
export interface IngestAgentDeps {
  settings: AiSettingsService;
  usage: AiUsageService;
  modelFactory: AiModelFactory;
  ditaRuntime?: DitaRuntimeOptions;
  strictValidator?: IngestStrictValidator;
}

/** Per-run context: identity, locale, abort signal and read-only workspace knowledge. */
export interface IngestAgentContext {
  projectId: string;
  branch: string;
  user: IdentityUser;
  locale: ApiLocale;
  signal?: AbortSignal;
  /** Existing key definitions (`keys` / `keyword`) offered to the Writer prompt. */
  keyspaceSummary?: Array<{ keys: string; keyword: string }>;
  /** Workspace paths already present, so generated paths and asset hrefs never collide. */
  existingPaths?: ReadonlySet<string>;
}

/** One generated topic after the Layer 1 self-healing loop (and optional Layer 2 repairs). */
export interface GeneratedTopicArtifact {
  node: PlannedTopicNode;
  xml: string;
  /** Number of repair passes actually applied (Layer 1 + Layer 2). */
  repairAttempts: number;
  /** True when at least one repair pass changed the XML. */
  repaired: boolean;
  issues: IngestDiagnosticItem[];
  ok: boolean;
}

/** Raised when the caller's `AbortSignal` fires; agents stop between every LLM/strict step. */
export class IngestAgentAbortedError extends Error {
  constructor(message = 'Ingest agent run was aborted.') {
    super(message);
    this.name = 'IngestAgentAbortedError';
  }
}

/** Throws `IngestAgentAbortedError` when the signal already fired. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new IngestAgentAbortedError();
}

/**
 * Optional lifecycle hooks. Stage 3's `IngestService` maps these onto SSE progress events so the
 * wizard can stream per-topic writer/repair status without polling.
 */
export interface IngestAgentCallbacks {
  onTopicStatus?(update: {
    topicId: string;
    filePath: string;
    title: string;
    status: IngestTopicProgress['status'];
    attempts: number;
    error?: string;
  }): void;
  onLog?(entry: { level: 'info' | 'warn' | 'error'; message: string }): void;
  onLayer2Start?(info: { targets: readonly string[]; rootMapPath: string }): void;
  onLayer2Repair?(info: {
    topicId: string;
    filePath: string;
    attempt: number;
    issues: readonly IngestDiagnosticItem[];
  }): void;
}

/* ------------------------------------------------------------------------------------------ */
/* Planner                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface PlanOutlineInput {
  /** Markdown produced by Docling / MarkItDown / direct passthrough (already asset-rewritten). */
  markdown: string;
  /** Original upload file name, used for titles and the deterministic fallback. */
  sourceFilename: string;
  targetMode: 'new_manual' | 'single_topic' | 'multi_topic';
  /** BCP 47 language tag of the generated content. */
  language?: string;
  mapKind?: DitaMapTemplateType;
  topicType?: DitaTopicTemplateType | 'auto';
  /** Folder constraint passed through to `normalizePlanPaths()`. */
  targetDir?: string;
  /** Free-form author note forwarded to the Planner prompt. */
  instruction?: string;
  /** Soft cap on generated topics; extra sections stay inside the last topic. */
  maxTopics?: number;
  callbacks?: IngestAgentCallbacks;
}

export interface PlanOutlineResult {
  plan: IngestOutlinePlan;
  usedFallback: boolean;
  warnings: string[];
}

/* ------------------------------------------------------------------------------------------ */
/* Writer                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export interface TopicAssetMapping {
  assets: readonly ExtractedIngestAsset[];
  /** `assetId` (`img_001`) → workspace-relative asset path (`images/img_001.png`). */
  assetPathById: ReadonlyMap<string, string>;
}

export interface PostProcessTopicOptions {
  node: PlannedTopicNode;
  /** BCP 47 language tag written to the root `xml:lang`. */
  language: string;
  assetPathById: ReadonlyMap<string, string>;
}

export interface DraftTopicInput {
  markdown: string;
  sections: MarkdownSection[];
  plan: IngestOutlinePlan;
  node: PlannedTopicNode;
  language: string;
  assets?: readonly ExtractedIngestAsset[];
  assetPathById?: ReadonlyMap<string, string>;
  /** Sibling topic paths (`concepts/intro.dita`, …) offered to the prompt for cross-refs. */
  siblingPaths?: readonly string[];
  /** Optional author instruction from plan review. */
  instruction?: string;
  callbacks?: IngestAgentCallbacks;
}

export interface DraftTopicResult {
  xml: string;
  warnings: string[];
}

export type SharedDraftOptions = Omit<DraftTopicInput, 'node'>;

export interface ConcurrentDraftOptions extends SharedDraftOptions {
  /** Bounded writer pool size; defaults to 2. */
  concurrency?: number;
}

/* ------------------------------------------------------------------------------------------ */
/* Validator / Repairer                                                                       */
/* ------------------------------------------------------------------------------------------ */

export interface ValidateLayer1Input {
  node: PlannedTopicNode;
  xml: string;
  locale: ApiLocale;
  /** Workspace-relative image paths that exist (generated assets, baseline assets, drafts). */
  availableAssetPaths?: ReadonlySet<string>;
  /** Existing workspace paths, accepted as image targets too. */
  existingPaths?: ReadonlySet<string>;
}

export interface Layer1ValidationResult {
  ok: boolean;
  issues: IngestDiagnosticItem[];
  /** Subset of `issues` that point at broken/missing image references. */
  assetIssues: IngestDiagnosticItem[];
}

export interface RepairTopicInput {
  node: PlannedTopicNode;
  xml: string;
  language: string;
  assetPathById?: ReadonlyMap<string, string>;
  issues: readonly IngestDiagnosticItem[];
  /** `layer1` = well-formedness/structure/PM/asset, `layer2_strict` = DITA-OT + semantic. */
  layer: 'layer1' | 'layer2_strict';
  attempt: number;
  availableAssetPaths?: ReadonlySet<string>;
  existingPaths?: ReadonlySet<string>;
  callbacks?: IngestAgentCallbacks;
}

export interface RepairTopicResult {
  xml: string;
  warnings: string[];
}

export interface DraftAndVerifyInput extends DraftTopicInput {
  availableAssetPaths?: ReadonlySet<string>;
  /** Layer 1 repair passes after the first draft; defaults to 2. */
  maxLayer1Retries?: number;
}

/** Staging directory handed to the caller's `prepareStagingDir` callback. */
export interface StagingDirContext {
  workDir: string;
  rootMapPath: string;
  /** Writes a workspace-relative text file inside the staging directory. */
  writeFile(relativePath: string, content: string): void;
  /** Writes an extracted asset (base64 or CLI source path) inside the staging directory. */
  writeAsset(asset: ExtractedIngestAsset, relativePath: string): void;
}

/**
 * Lets Stage 3 overlay the generated files on top of an existing manual (Draft Overlay
 * materialization) before DITA-OT runs. Generated artifacts are written *after* this callback,
 * so a copied baseline file can never shadow a freshly written topic or root map.
 */
export type PrepareStagingDir = (context: StagingDirContext) => void | Promise<void>;

export interface ValidateBatchInput {
  plan: IngestOutlinePlan;
  artifacts: readonly GeneratedTopicArtifact[];
  assets?: readonly ExtractedIngestAsset[];
  assetPathById?: ReadonlyMap<string, string>;
  /** Workspace-relative asset paths known to exist (baseline assets + generated assets). */
  assetPaths?: ReadonlySet<string>;
  /** Extra baseline files (`path → XML`) merged under the generated files for the semantic pass. */
  baselineFiles?: Record<string, string>;
  /** Reuse an existing semantic index (e.g. the caller's User Overlay index) instead of rebuilding. */
  baselineIndex?: DitaSemanticIndex;
  prepareStagingDir?: PrepareStagingDir;
  /** Layer 2 targeted repair passes per failing topic; defaults to 2. */
  maxLayer2Retries?: number;
  language?: string;
  availableAssetPaths?: ReadonlySet<string>;
  callbacks?: IngestAgentCallbacks;
}

export interface ValidateBatchResult {
  artifacts: GeneratedTopicArtifact[];
  validationReport: IngestValidationReport;
  /**
   * Map / keys-map XML the Layer 2 repair agent rewrote in staging (topics come back through
   * `artifacts`). Handed to `materializeNewManual` as `fileOverrides` so the repaired map — not a
   * freshly regenerated one — is what lands on disk.
   */
  repairedFiles?: Record<string, string>;
}
