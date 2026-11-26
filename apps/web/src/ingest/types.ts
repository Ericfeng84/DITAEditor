/**
 * Phase 14 — shared shapes and formatting helpers for the document ingest wizard.
 *
 * Kept deliberately small: anything that mirrors the API lives in `services/ingest-api.ts`,
 * this file only holds UI-level types and locale-neutral formatting.
 */

import type { IngestJobStatus, IngestTargetMode } from '../services/ingest-api.js';

export type { IngestTargetMode };

/** The five wizard screens; the dialog itself decides which one is visible. */
export type IngestWizardStep = 'upload' | 'parsing' | 'review' | 'progress' | 'result';

/** Where the dialog was opened from; drives the default target mode and the completion CTA. */
export type IngestOrigin = 'hub' | 'editor';

/** Mount target handed over by the map tree ("Import topics from document…"). */
export interface IngestMountContext {
  mapPath: string;
  parentPath: number[] | null;
  parentLabel: string;
}

/** Ordered step list for the little progress header of the wizard. */
export const INGEST_STEPS: readonly IngestWizardStep[] = [
  'upload',
  'parsing',
  'review',
  'progress',
  'result',
];

/** Stage order used by the progress stepper (maps `IngestJobStatus` onto a coarse stage). */
export const INGEST_PROGRESS_STAGES = [
  'parsing',
  'planning',
  'writing',
  'validating',
  'materializing',
] as const;

export type IngestProgressStage = (typeof INGEST_PROGRESS_STAGES)[number];

/** Collapses the 11 backend statuses onto the 5 visible stages. */
export function stageForStatus(status: IngestJobStatus): IngestProgressStage {
  switch (status) {
    case 'queued':
    case 'parsing':
      return 'parsing';
    case 'planning':
    case 'awaiting_plan_approval':
      return 'planning';
    case 'writing':
      return 'writing';
    case 'validating':
    case 'repairing':
      return 'validating';
    case 'materializing':
    case 'succeeded':
      return 'materializing';
    default:
      return 'parsing';
  }
}

/** 0-based index of a stage inside {@link INGEST_PROGRESS_STAGES}. */
export function stageIndex(status: IngestJobStatus): number {
  const stage = stageForStatus(status);
  return INGEST_PROGRESS_STAGES.indexOf(stage);
}

/**
 * Stepper index for a live job.
 *
 * `failed` / `cancelled` carry no stage of their own: the job kept the stage it was in when it
 * stopped, so the pill must stay there (`校验 / 修复`) instead of snapping back to `解析`.
 */
export function progressStageIndex(job: {
  status: IngestJobStatus;
  progress?: { stage?: IngestJobStatus | null } | null;
}): number {
  if (job.status === 'failed' || job.status === 'cancelled') {
    return Math.max(0, stageIndex(job.progress?.stage ?? 'parsing'));
  }
  return stageIndex(job.status);
}

/** Locale-neutral byte size (`1.4 MB`, `820 KB`) — units are the same in both catalogues. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** `path/to/file.dita` → `file.dita`, for compact topic rows. */
export function baseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/u);
  return parts[parts.length - 1] ?? filePath;
}

/** True when the picked engine cannot do OCR, which matters for scanned PDFs. */
export function needsScannedPdfWarning(fileName: string | null, engine: string): boolean {
  if (!fileName || engine !== 'markitdown') return false;
  return /\.pdf$/iu.test(fileName);
}

/** Extensions accepted by the API, rendered as `.docx · .pdf · …`. */
export function formatExtensions(extensions: readonly string[] | undefined): string {
  if (!extensions || extensions.length === 0) return '—';
  return extensions
    .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`))
    .join(' · ');
}

/** Case-insensitive extension check against the supported list (`docx` vs `.docx`). */
export function isSupportedExtension(fileName: string, extensions: readonly string[]): boolean {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = lower.slice(dot);
  return extensions.some((candidate) => {
    const normalized = candidate.toLowerCase();
    return (normalized.startsWith('.') ? normalized : `.${normalized}`) === ext;
  });
}
