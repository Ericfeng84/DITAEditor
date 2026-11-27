/**
 * Phase 14 Stage 1 — shared ingest contracts.
 *
 * Everything in this module is isomorphic (browser + Node): the same plan/result shapes are
 * produced by the API's deterministic Planner fallback and rendered by the web wizard.
 */

import type { DitaMapTemplateType } from '../templates/map-templates.js';
import type { DitaTopicTemplateType } from '../templates/topic-templates.js';

/** Where the imported content lands. */
export type IngestTargetMode = 'new_manual' | 'single_topic' | 'multi_topic';

/** Engine selector offered in the upload wizard / admin settings. */
export type IngestEngineChoice = 'auto' | 'docling' | 'markitdown';

/** Concrete engine that actually produced the Markdown. */
export type IngestResolvedEngine = 'direct' | 'docling-serve' | 'docling-cli' | 'markitdown-cli';

/** Lifecycle of an ingest job (persisted in `ingest_jobs.status`). */
export type IngestJobStatus =
  | 'queued'
  | 'parsing'
  | 'planning'
  | 'awaiting_plan_approval'
  | 'writing'
  | 'validating'
  | 'repairing'
  | 'materializing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/** One Markdown heading section (or the preamble / whole document when it has no headings). */
export interface MarkdownSection {
  /** Stable synthetic id: `sec_001`, `sec_002`, … */
  id: string;
  /** ATX/Setext heading level 1–6; `0` for the preamble before the first heading. */
  level: number;
  /** Heading text without leading `#` / trailing `#`. Empty for preamble/whole-document sections. */
  heading: string;
  /** 1-based first line of the section (the heading line, or line 1 for preamble). */
  startLine: number;
  /** 1-based last line of the section (inclusive). */
  endLine: number;
  /** Exact character length of `markdown.slice(startLine..endLine)` in the source Markdown. */
  charCount: number;
  /** True when the section body contains a GitHub-style table separator row. */
  hasTable: boolean;
  /** True when the section body contains a fenced code block. */
  hasCode: boolean;
  /** `asset://img_NNN.ext` references appearing inside the section. */
  imageAssetIds: string[];
}

/** A data-URI embedded image found in Markdown and lifted out to a binary asset. */
export interface ExtractedDataUriImage {
  /** Deterministic asset id inside the job, e.g. `img_001`. */
  assetId: string;
  /** File name to write into the job assets directory, e.g. `img_001.png`. */
  fileName: string;
  /** Extension without a dot: `png`, `jpg`, `gif`, `webp`, `svg`. */
  extension: string;
  /** Normalized media type, e.g. `image/png`. */
  mimeType: string;
  /** Image alt text (Markdown) or `alt` attribute (HTML); may be empty. */
  alt: string;
  /** Base64 payload with whitespace removed. */
  base64: string;
  /** Decoded byte length computed from the base64 payload length. */
  byteLength: number;
}

/** Metadata describing one extracted image asset of an ingest job. */
export interface ExtractedIngestAsset {
  assetId: string;
  fileName: string;
  mediaType: string;
  extension: string;
  byteLength: number;
  /** Base64 payload when the asset came from a data URI. */
  base64?: string;
  /** How the asset was obtained. */
  origin: 'data-uri' | 'referenced' | 'cli';
  /** Original path on disk when the asset was copied from a parser output directory. */
  sourcePath?: string;
}

/** A planned DITA topic in the outline tree (recursive, depth-first). */
export interface PlannedTopicNode {
  /** Sanitized DITA topic id (`[a-z_][a-z0-9_-]*`). */
  topicId: string;
  /** Topic `<title>`. */
  title: string;
  /** DITA topic type used to pick the template + default folder. */
  type: DitaTopicTemplateType;
  /** Safe POSIX path relative to the manual root, always ending in `.dita`. */
  filePath: string;
  /** Optional Map `@navtitle`; omitted from the map when empty. */
  navTitle?: string;
  /** One-paragraph planning summary for the Writer agent. */
  summary?: string;
  /** Markdown section ids feeding this topic (empty ⇒ let the writer use the digest). */
  sectionIds?: string[];
  children?: PlannedTopicNode[];
}

/** One suggested key definition for the auto-generated `keys.ditamap`. */
export interface IngestSuggestedKey {
  /** DITA key name (validated against `DITA_KEY_NAME_PATTERN`). */
  keys: string;
  /** `<keyword>` text bound to the key. */
  keyword: string;
}

/** The deterministic outline plan produced by the Planner Agent (or the heuristic fallback). */
export interface IngestOutlinePlan {
  /** Human-readable manual / map title. */
  title: string;
  /** BCP 47 language tag, e.g. `zh-CN` / `en`. */
  language?: string;
  targetMode?: IngestTargetMode;
  /** DITA map template kind; drives the generated root map doctype. */
  mapKind: DitaMapTemplateType;
  /** Safe POSIX path of the root map, ending in `.ditamap`. */
  rootMapPath: string;
  /** Preferred topic type; `auto` lets each node decide. */
  topicType: DitaTopicTemplateType | 'auto';
  /** Optional target folder constraint for generated topic paths. */
  targetDir?: string;
  /** Short plan summary for the review step. */
  summary?: string;
  createKeysMap: boolean;
  suggestedKeys: IngestSuggestedKey[];
  topics: PlannedTopicNode[];
}

/** One validation finding (Layer 1 structure / Layer 2 semantic / DITA-OT strict). */
export interface IngestDiagnosticItem {
  source: 'plan' | 'asset' | 'structure' | 'prosemirror' | 'semantic' | 'dita-ot';
  severity: 'error' | 'warning' | 'info';
  code?: string;
  message: string;
  /** Workspace-relative path of the offending file, when known. */
  path?: string;
  line?: number;
  column?: number;
}

/** Per-topic validation outcome of the Validator/Repairer loop. */
export interface IngestTopicValidationResult {
  topicId: string;
  filePath: string;
  title?: string;
  ok: boolean;
  issues: IngestDiagnosticItem[];
  /** True when at least one automated repair pass was applied. */
  repaired: boolean;
  attempts: number;
}

/** Full validation report attached to an ingest job. */
export interface IngestValidationReport {
  ok: boolean;
  generatedAt: number;
  layer1: { ok: boolean; issues: IngestDiagnosticItem[] };
  layer2: {
    status: 'passed' | 'failed' | 'skipped';
    issues: IngestDiagnosticItem[];
    reason?: string;
  };
  topics: IngestTopicValidationResult[];
  assetIssues: IngestDiagnosticItem[];
}

/** Per-topic progress entry streamed over SSE. */
export interface IngestTopicProgress {
  topicId: string;
  filePath: string;
  title: string;
  status: 'pending' | 'writing' | 'written' | 'validating' | 'repairing' | 'done' | 'failed';
  attempts: number;
  error?: string;
}

/** Job-level progress snapshot (`ingest_jobs.progress_json`). */
export interface IngestJobProgress {
  stage: IngestJobStatus;
  /** 0–100, monotonically increasing within a job. */
  percent: number;
  message?: string;
  planReady: boolean;
  topics: IngestTopicProgress[];
  updatedAt: number;
}

/** Final job result (`ingest_jobs.result_json`). */
export interface IngestJobResult {
  manualId?: string;
  rootMapPath?: string;
  /** Map actually mounted into (existing-manual targets). */
  mountedMapPath?: string;
  topics: Array<{ topicId: string; filePath: string; title: string }>;
  assets: Array<{ assetId: string; fileName: string; filePath: string }>;
  commitHash?: string;
  /** Number of files written as personal drafts (existing-manual targets). */
  draftCount?: number;
  warnings?: string[];
}
