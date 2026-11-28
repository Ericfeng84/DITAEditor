import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import type { DraftService } from '../locks/draft-service.js';
import { validateStrict, type StrictValidationResult } from '../validate/strict-validator.js';
import { realignProposalAfterRepair, type AiTranslationOrchestrator } from './ai-translator.js';
import type { GlossaryService } from './glossary-service.js';
import type {
  TranslationDitaOtDiagnostic,
  TranslationDitaOtItemReport,
  TranslationJobValidationReport,
} from './types.js';
import type { TranslationLinkRow } from '../../db/schema.js';

/** One job item that still needs a DITA-OT verdict. */
export interface TranslationValidationTarget {
  itemId: string;
  targetPath: string;
  /** The proposal as it would be applied to the draft overlay. */
  proposedXml: string;
  /** Source document the proposal was generated from (repair context). */
  sourceXml?: string;
  segmentsJson: string | null;
}

export interface ValidateTranslationJobBatchInput {
  jobId: string;
  link: TranslationLinkRow;
  userId: string;
  sourceWorkDir: string;
  targetWorkDir: string | null;
  items: TranslationValidationTarget[];
  /** `false` skips DITA-OT entirely (link option `ditaOtStrictEnabled`). */
  ditaOtStrictEnabled?: boolean;
  customInstruction?: string;
  signal?: AbortSignal;
  locale?: ApiLocale;
}

export interface ValidatedTranslationItem {
  itemId: string;
  report: TranslationDitaOtItemReport;
  /** Set only when the DITA-OT repair actually replaced the proposal. */
  proposedXml?: string;
  segmentsJson?: string;
  qaReportJson?: string;
}

export interface ValidateTranslationJobBatchResult {
  validationReport: TranslationJobValidationReport;
  items: ValidatedTranslationItem[];
}

export interface ValidateTranslationItemInput {
  link: TranslationLinkRow;
  userId: string;
  sourceWorkDir: string;
  targetWorkDir: string | null;
  item: TranslationValidationTarget;
  customInstruction?: string;
  signal?: AbortSignal;
  locale?: ApiLocale;
}

export interface TranslationDitaOtValidatorOptions {
  translator: AiTranslationOrchestrator;
  /** Phase 13 overlay: layers 2+3 of the staging directory come from this service. */
  drafts?: DraftService;
  glossaries?: Pick<GlossaryService, 'resolveEffectiveGlossary'>;
  /** Injectable DITA-OT runner, so tests can script strict/lax outcomes. */
  strictValidator?: typeof validateStrict;
  logger?: (message: string, error?: unknown) => void;
}

const STAGING_PREFIX = 'dita-translate-validate-';
const STAGING_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  '.turbo',
  '.dita-workspaces',
  '.DS_Store',
]);

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/{2,}/g, '/')
    .trim();
}

/** Rejects any path that could escape the staging directory. */
function safeRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\u0000') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new Error(`Unsafe translation path: ${filePath}`);
  }
  return normalized;
}

/**
 * Writes into the staging tree without ever mutating the shared `workDir`.
 *
 * `DraftService.materializeOverlayDir()` hardlinks baseline files into the staging tree, so a plain
 * `writeFileSync` here would rewrite the baseline through the shared inode. Writing to a sibling
 * temp file and `rename()`-ing it replaces only the staging directory entry.
 */
function writeStagingFile(root: string, filePath: string, content: string): void {
  const relative = safeRelativePath(filePath);
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.ditaeditor-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`;
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, target);
}

/** Copies a workspace tree without `.git`/build output, overwriting existing files. */
function copyWorkspaceTree(sourceDir: string, destDir: string): void {
  cpSync(sourceDir, destDir, {
    recursive: true,
    force: true,
    filter: (from) => {
      const name = from.split(/[\\/]/).pop() ?? '';
      return !STAGING_SKIP_DIRS.has(name);
    },
  });
}

function itemReport(input: {
  status: TranslationDitaOtItemReport['status'];
  repaired: boolean;
  repairAttempts: number;
  diagnostics: TranslationDitaOtDiagnostic[];
  reason?: string;
}): TranslationDitaOtItemReport {
  const diagnostics = input.diagnostics;
  return {
    status: input.status,
    repaired: input.repaired,
    repairAttempts: input.repairAttempts,
    errorCount: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length,
    diagnostics,
    ...(input.reason ? { reason: input.reason } : {}),
    stale: false,
    updatedAt: toIso(Date.now()),
  };
}

/**
 * Phase 16 Stage 4 — job-level DITA-OT strict validation.
 *
 * The validator materialises an isolated 4-layer staging directory and runs DITA-OT there:
 *
 *   1. the source manual tree (`sourceCommit`, read-only) for `keys.ditamap`, siblings and images,
 *   2. the target manual `HEAD` tree (overrides layer 1),
 *   3. the job owner's Phase 13 `working_drafts` overlay for the target manual,
 *   4. this job's proposals (highest priority).
 *
 * It never writes into the shared `sourceWorkDir`/`targetWorkDir`: the staging directory lives under
 * `os.tmpdir()` and is removed in a `finally`.
 */
export class TranslationDitaOtValidator {
  private readonly translator: AiTranslationOrchestrator;
  private readonly drafts: DraftService | null;
  private readonly glossaries: Pick<GlossaryService, 'resolveEffectiveGlossary'> | null;
  private readonly strictValidator: typeof validateStrict;
  private readonly logger: (message: string, error?: unknown) => void;

  constructor(options: TranslationDitaOtValidatorOptions) {
    this.translator = options.translator;
    this.drafts = options.drafts ?? null;
    this.glossaries = options.glossaries ?? null;
    this.strictValidator = options.strictValidator ?? validateStrict;
    this.logger = options.logger ?? (() => undefined);
  }

  // ------------------------------------------------------------------ job batch

  async validateJobBatch(
    input: ValidateTranslationJobBatchInput,
  ): Promise<ValidateTranslationJobBatchResult> {
    const startedAt = Date.now();
    const locale: ApiLocale = input.locale ?? 'zh-CN';
    const targets = input.items.filter((item) => item.proposedXml.trim().length > 0);

    if (input.ditaOtStrictEnabled === false) {
      return this.skippedBatch(
        targets,
        startedAt,
        apiT(locale, 'translation.ditaOtDisabled'),
        'skipped',
      );
    }
    if (targets.length === 0) {
      return this.skippedBatch(
        targets,
        startedAt,
        apiT(locale, 'translation.ditaOtNoTargets'),
        'skipped',
      );
    }

    let stagingDir: string | null = null;
    try {
      stagingDir = await this.prepareStagingDir(input, targets);
      const paths = [...new Set(targets.map((item) => item.targetPath))];

      let run = await this.runStrict({
        workDir: stagingDir,
        paths,
        processingMode: 'strict',
        ...(input.signal ? { signal: input.signal } : {}),
        locale,
      });
      if (!run.available) {
        return this.skippedBatch(
          targets,
          startedAt,
          run.message ?? apiT(locale, 'translation.ditaOtUnavailable'),
          'skipped',
        );
      }

      let attributed = this.attribute(run, targets);
      if (targets.length > 1 && this.hasErrors(attributed)) {
        // Strict aborts per file; one lax sweep reports every broken file at once so the batch can
        // repair (and attribute) them in a single pass.
        const lax = await this.runStrict({
          workDir: stagingDir,
          paths,
          processingMode: 'lax',
          ...(input.signal ? { signal: input.signal } : {}),
          locale,
        });
        if (lax.available) {
          attributed = this.attribute(lax, targets);
          run = lax;
        }
      }

      const diagnosticsByItem = attributed;
      const broken = targets.filter((item) => (diagnosticsByItem.get(item.itemId) ?? []).some(
        (diagnostic) => diagnostic.severity === 'error',
      ));
      const errorFiles = broken.length;
      const validated = new Map<string, ValidatedTranslationItem>();
      const repairedItems: ValidatedTranslationItem[] = [];

      for (const item of broken) {
        if (input.signal?.aborted) break;
        const diagnostics = (diagnosticsByItem.get(item.itemId) ?? []).filter(
          (diagnostic) => diagnostic.severity === 'error',
        );
        let repair;
        try {
          repair = await this.translator.repairDocumentForDitaOt({
            link: input.link,
            sourcePath: item.targetPath,
            user: this.repairUser(input),
            sourceXml: item.sourceXml ?? item.proposedXml,
            proposedXml: item.proposedXml,
            filePath: item.targetPath,
            sourceLang: input.link.sourceLang,
            targetLang: input.link.targetLang,
            ditaOtDiagnostics: diagnostics,
            ...(() => {
              const glossary = this.glossaryEntries(input.link);
              return glossary.length > 0 ? { glossary } : {};
            })(),
            ...(input.customInstruction ? { customInstruction: input.customInstruction } : {}),
            ...(input.signal ? { signal: input.signal } : {}),
          });
        } catch (error) {
          this.logger(`translation DITA-OT repair failed for ${item.targetPath}`, error);
          repair = { repaired: false, xml: item.proposedXml, message: describeError(error) };
        }
        if (!repair.repaired) {
          validated.set(item.itemId, {
            itemId: item.itemId,
            report: itemReport({
              status: 'failed',
              repaired: false,
              repairAttempts: 1,
              diagnostics,
              reason: repair.message ?? apiT(locale, 'translation.ditaOtRepairFailed'),
            }),
          });
          continue;
        }
        writeStagingFile(stagingDir, item.targetPath, repair.xml);
        const derived = this.realign(input.link, item, repair.xml);
        const entry: ValidatedTranslationItem = {
          itemId: item.itemId,
          report: itemReport({
            status: 'passed',
            repaired: true,
            repairAttempts: 1,
            diagnostics: [],
          }),
          proposedXml: repair.xml,
          ...(derived ? { segmentsJson: derived.segmentsJson, qaReportJson: derived.qaReportJson } : {}),
        };
        validated.set(item.itemId, entry);
        repairedItems.push(entry);
      }

      // Mandatory outer deterministic confirmation: never trust the repair alone.
      let confirmed: Map<string, TranslationDitaOtDiagnostic[]> = new Map();
      if (repairedItems.length > 0) {
        const confirmTargets = targets;
        let confirm = await this.runStrict({
          workDir: stagingDir,
          paths: [...new Set(confirmTargets.map((item) => item.targetPath))],
          processingMode: 'strict',
          ...(input.signal ? { signal: input.signal } : {}),
          locale,
        });
        if (!confirm.available) {
          this.logger(
            `translation DITA-OT confirmation unavailable: ${confirm.message ?? 'unknown'}`,
          );
          confirmed = new Map();
        } else {
          confirmed = this.attribute(confirm, confirmTargets);
          if (confirmTargets.length > 1 && this.hasErrors(confirmed)) {
            const lax = await this.runStrict({
              workDir: stagingDir,
              paths: [...new Set(confirmTargets.map((item) => item.targetPath))],
              processingMode: 'lax',
              ...(input.signal ? { signal: input.signal } : {}),
              locale,
            });
            if (lax.available) confirmed = this.attribute(lax, confirmTargets);
          }
        }
      }

      const results: ValidatedTranslationItem[] = targets.map((item) => {
        const existing = validated.get(item.itemId);
        const errors = (confirmed.get(item.itemId) ?? []).filter(
          (diagnostic) => diagnostic.severity === 'error',
        );
        if (errors.length > 0) {
          return {
            itemId: item.itemId,
            report: itemReport({
              status: 'failed',
              repaired: existing?.report.repaired ?? false,
              repairAttempts: existing?.report.repairAttempts ?? 0,
              diagnostics: confirmed.get(item.itemId) ?? [],
              reason: apiT(locale, 'translation.ditaOtErrorsRemain'),
            }),
            ...(existing?.proposedXml ? { proposedXml: existing.proposedXml } : {}),
            ...(existing?.segmentsJson ? { segmentsJson: existing.segmentsJson } : {}),
            ...(existing?.qaReportJson ? { qaReportJson: existing.qaReportJson } : {}),
          };
        }
        if (existing) return existing;
        return {
          itemId: item.itemId,
          report: itemReport({
            status: 'passed',
            repaired: false,
            repairAttempts: 0,
            diagnostics: diagnosticsByItem.get(item.itemId) ?? [],
          }),
        };
      });

      const remainingErrorFiles = results.filter(
        (result) => result.report.status === 'failed',
      ).length;
      const status: TranslationJobValidationReport['status'] =
        remainingErrorFiles > 0 ? 'failed' : 'passed';
      return {
        validationReport: {
          status,
          checkedFiles: targets.length,
          errorFiles,
          repairedFiles: results.filter((result) => result.report.repaired).length,
          remainingErrorFiles,
          durationMs: run.durationMs,
          ...(remainingErrorFiles > 0 ? { reason: apiT(locale, 'translation.ditaOtErrorsRemain') } : {}),
          updatedAt: toIso(Date.now()),
        },
        items: results,
      };
    } catch (error) {
      this.logger('translation DITA-OT batch validation failed', error);
      return {
        validationReport: {
          status: 'skipped',
          checkedFiles: targets.length,
          errorFiles: 0,
          repairedFiles: 0,
          remainingErrorFiles: 0,
          durationMs: Date.now() - startedAt,
          reason: describeError(error),
          updatedAt: toIso(Date.now()),
        },
        items: targets.map((item) => ({
          itemId: item.itemId,
          report: itemReport({
            status: 'skipped',
            repaired: false,
            repairAttempts: 0,
            diagnostics: [],
            reason: describeError(error),
          }),
        })),
      };
    } finally {
      if (stagingDir) rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  // ----------------------------------------------------------------- single item

  async validateSingleItem(input: ValidateTranslationItemInput): Promise<ValidatedTranslationItem> {
    const locale: ApiLocale = input.locale ?? 'zh-CN';
    const item = input.item;
    if (!item.proposedXml.trim()) {
      return {
        itemId: item.itemId,
        report: itemReport({
          status: 'skipped',
          repaired: false,
          repairAttempts: 0,
          diagnostics: [],
          reason: apiT(locale, 'translation.noProposal', { path: item.targetPath }),
        }),
      };
    }
    let stagingDir: string | null = null;
    try {
      stagingDir = await this.prepareStagingDir(
        {
          jobId: '',
          link: input.link,
          userId: input.userId,
          sourceWorkDir: input.sourceWorkDir,
          targetWorkDir: input.targetWorkDir,
          items: [item],
          ...(input.customInstruction ? { customInstruction: input.customInstruction } : {}),
          ...(input.signal ? { signal: input.signal } : {}),
          locale,
        },
        [item],
      );
      const run = await this.runStrict({
        workDir: stagingDir,
        paths: [item.targetPath],
        processingMode: 'strict',
        ...(input.signal ? { signal: input.signal } : {}),
        locale,
      });
      if (!run.available) {
        return {
          itemId: item.itemId,
          report: itemReport({
            status: 'skipped',
            repaired: false,
            repairAttempts: 0,
            diagnostics: [],
            reason: run.message ?? apiT(locale, 'translation.ditaOtUnavailable'),
          }),
        };
      }
      const attributed = this.attribute(run, [item]);
      const diagnostics = attributed.get(item.itemId) ?? [];
      const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
      return {
        itemId: item.itemId,
        report: itemReport({
          status: hasErrors ? 'failed' : 'passed',
          repaired: false,
          repairAttempts: 0,
          diagnostics,
          ...(hasErrors ? { reason: apiT(locale, 'translation.ditaOtErrorsRemain') } : {}),
        }),
      };
    } catch (error) {
      return {
        itemId: item.itemId,
        report: itemReport({
          status: 'skipped',
          repaired: false,
          repairAttempts: 0,
          diagnostics: [],
          reason: describeError(error),
        }),
      };
    } finally {
      if (stagingDir) rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  // -------------------------------------------------------------------- internals

  private async prepareStagingDir(
    input: ValidateTranslationJobBatchInput,
    items: readonly TranslationValidationTarget[],
  ): Promise<string> {
    const stagingDir = mkdtempSync(join(tmpdir(), STAGING_PREFIX));
    try {
      if (input.targetWorkDir) {
        // Layer 1: source baseline (keys.ditamap, sibling topics, images) …
        if (input.sourceWorkDir) copyWorkspaceTree(input.sourceWorkDir, stagingDir);
        // … layers 2+3: target HEAD tree overrides it, then the owner's Phase 13 overlay.
        if (this.drafts) {
          await this.drafts.materializeOverlayDir({
            baselineDir: input.targetWorkDir,
            projectId: input.link.targetManualId,
            branch: input.link.targetBranch,
            userId: input.userId,
            destDir: stagingDir,
          });
        } else {
          copyWorkspaceTree(input.targetWorkDir, stagingDir);
        }
      } else if (input.sourceWorkDir) {
        copyWorkspaceTree(input.sourceWorkDir, stagingDir);
      }
      // Layer 4: this job's proposals win over everything else.
      for (const item of items) writeStagingFile(stagingDir, item.targetPath, item.proposedXml);
      return stagingDir;
    } catch (error) {
      rmSync(stagingDir, { recursive: true, force: true });
      throw error;
    }
  }

  private async runStrict(input: {
    workDir: string;
    paths: string[];
    processingMode: 'strict' | 'lax';
    signal?: AbortSignal;
    locale: ApiLocale;
  }): Promise<StrictValidationResult> {
    return await this.strictValidator({
      workDir: input.workDir,
      paths: input.paths,
      processingMode: input.processingMode,
      locale: input.locale,
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  /** Strict attribution: only errors in files this job owns count, baseline noise is ignored. */
  private attribute(
    run: StrictValidationResult,
    items: readonly TranslationValidationTarget[],
  ): Map<string, TranslationDitaOtDiagnostic[]> {
    const byPath = new Map<string, string>();
    for (const item of items) byPath.set(normalizePath(item.targetPath), item.itemId);
    const result = new Map<string, TranslationDitaOtDiagnostic[]>();
    const seen = new Set<string>();
    for (const raw of run.diagnostics) {
      const filePath = (raw.filePath ?? '').trim();
      if (!filePath) continue;
      const itemId = byPath.get(normalizePath(filePath));
      if (!itemId) continue;
      const key = `${itemId}:${raw.severity}:${raw.code ?? ''}:${raw.line ?? ''}:${raw.column ?? ''}:${raw.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bucket = result.get(itemId) ?? [];
      bucket.push({
        severity: raw.severity,
        ...(raw.code ? { code: raw.code } : {}),
        message: raw.message,
        ...(raw.filePath ? { filePath: normalizePath(raw.filePath) } : {}),
        ...(raw.line !== undefined ? { line: raw.line } : {}),
        ...(raw.column !== undefined ? { column: raw.column } : {}),
      });
      result.set(itemId, bucket);
    }
    return result;
  }

  private hasErrors(attributed: Map<string, TranslationDitaOtDiagnostic[]>): boolean {
    for (const diagnostics of attributed.values()) {
      if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return true;
    }
    return false;
  }

  private realign(
    link: TranslationLinkRow,
    item: TranslationValidationTarget,
    proposedXml: string,
  ): { segmentsJson: string; qaReportJson: string } | null {
    try {
      return realignProposalAfterRepair({
        segmentsJson: item.segmentsJson,
        proposedXml,
        glossary: this.glossaryEntries(link),
      });
    } catch (error) {
      this.logger(`translation segment realignment failed for ${item.targetPath}`, error);
      return null;
    }
  }

  /** Effective glossary entries for the target manual; empty when no glossary service exists. */
  private glossaryEntries(link: TranslationLinkRow) {
    if (!this.glossaries) return [];
    try {
      return this.glossaries.resolveEffectiveGlossary({
        manualId: link.targetManualId,
        sourceLang: link.sourceLang,
        targetLang: link.targetLang,
      }).entries;
    } catch (error) {
      this.logger('translation glossary resolution failed', error);
      return [];
    }
  }

  private repairUser(input: ValidateTranslationJobBatchInput): {
    id: string;
    displayName: string;
    role: 'writer';
    email: string;
    color: string;
    initials: string;
  } {
    return {
      id: input.userId,
      displayName: input.userId,
      role: 'writer',
      email: '',
      color: '#64748b',
      initials: 'TR',
    };
  }

  private skippedBatch(
    targets: readonly TranslationValidationTarget[],
    startedAt: number,
    reason: string,
    status: TranslationJobValidationReport['status'],
  ): ValidateTranslationJobBatchResult {
    return {
      validationReport: {
        status,
        checkedFiles: targets.length,
        errorFiles: 0,
        repairedFiles: 0,
        remainingErrorFiles: 0,
        durationMs: Date.now() - startedAt,
        reason,
        updatedAt: toIso(Date.now()),
      },
      items: targets.map((item) => ({
        itemId: item.itemId,
        report: itemReport({
          status: status === 'skipped' ? 'skipped' : 'passed',
          repaired: false,
          repairAttempts: 0,
          diagnostics: [],
          reason,
        }),
      })),
    };
  }
}
