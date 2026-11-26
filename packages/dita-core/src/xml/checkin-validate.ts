/**
 * Isomorphic check-in validation gate for DITA workspace files.
 *
 * Single source of truth shared by `@dita/api` (the hard server-side gate before a personal draft
 * is materialized into the shared baseline) and `@dita/web` (`CheckinDialog` pre-check), so the
 * front end and the back end can never disagree about whether a file may be checked in.
 *
 * Deliberately narrow: only XML well-formedness, DITA 1.3 content-model structure and `.ditaval`
 * syntax are reported. Cross-file reference warnings (`asset-ref` / `keyref` / `conref` / map
 * hrefs) live in the semantic index and never block a check-in.
 */

import type { UiLocale } from '../i18n/locale.js';
import { coreT } from '../i18n/messages.js';
import { formatStructureIssue } from '../model/dita-structure.js';
import { classifyDitaFileKind } from '../map/path-utils.js';
import { parseDitaval } from '../ditaval/ditaval.js';
import { checkXmlWellFormed } from './parser.js';
import { checkXmlStructure } from './structure-check.js';

export interface CheckinValidationIssue {
  filePath: string;
  source: 'xml' | 'structure' | 'ditaval';
  severity: 'error' | 'warning';
  line: number;
  column: number;
  code?: string;
  message: string;
}

export interface CheckinFileInput {
  filePath: string;
  content: string;
  /** Deleted or binary files skip XML validation. */
  deleted?: boolean;
  binary?: boolean;
}

export interface CheckinBatchValidation {
  ok: boolean;
  errors: CheckinValidationIssue[];
  warnings: CheckinValidationIssue[];
}

/**
 * Validate one candidate check-in file.
 *
 * - `deleted` / `binary` inputs are exempt (a deletion never parses its historical content).
 * - `topic` / `ditamap` / `bookmap`: XML well-formedness first, then DITA 1.3 structure for topics
 *   (the task shell is detected from the document `<!DOCTYPE>` so `generalTask.dtd` is not
 *   misreported).
 * - `ditaval`: `parseDitaval()` syntax gate.
 * - `image` / `other`: untouched, no issues.
 */
export function validateDitaFileForCheckin(
  input: CheckinFileInput,
  locale: UiLocale = 'zh-CN',
): CheckinValidationIssue[] {
  if (input.deleted === true || input.binary === true) return [];

  const kind = classifyDitaFileKind(input.filePath);

  if (kind === 'ditaval') {
    try {
      parseDitaval(input.content);
      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const location = locateDitavalError(input.content);
      return [
        {
          filePath: input.filePath,
          source: 'ditaval',
          severity: 'error',
          line: location.line,
          column: location.column,
          code: 'ditaval-syntax',
          message: coreT(locale, 'semantic.ditavalSyntax', { message }),
        },
      ];
    }
  }

  if (kind !== 'topic' && kind !== 'ditamap' && kind !== 'bookmap') return [];

  const wellFormed = checkXmlWellFormed(input.content);
  if (!wellFormed.ok) {
    return [
      {
        filePath: input.filePath,
        source: 'xml',
        severity: 'error',
        line: wellFormed.error.line,
        column: wellFormed.error.column,
        code: 'xml-not-well-formed',
        message: coreT(locale, 'semantic.malformedXml', { message: wellFormed.error.message }),
      },
    ];
  }

  if (kind !== 'topic') return [];

  const structure = checkXmlStructure(input.content, { taskModel: 'auto' });
  if (!structure.ok) {
    // The well-formedness check above already passed; a parse failure here is defensive only.
    return [
      {
        filePath: input.filePath,
        source: 'xml',
        severity: 'error',
        line: structure.error.line,
        column: structure.error.column,
        code: 'xml-not-well-formed',
        message: coreT(locale, 'semantic.malformedXml', { message: structure.error.message }),
      },
    ];
  }

  return structure.issues.map((issue) => ({
    filePath: input.filePath,
    source: 'structure' as const,
    severity: issue.severity,
    line: issue.line,
    column: issue.column,
    code: issue.code,
    message: formatStructureIssue(issue, locale),
  }));
}

/**
 * Validate a whole check-in batch. `ok` is true only when no error-level issue remains; warnings
 * are returned for display but never block the check-in.
 */
export function validateCheckinBatch(
  files: readonly CheckinFileInput[],
  locale: UiLocale = 'zh-CN',
): CheckinBatchValidation {
  const errors: CheckinValidationIssue[] = [];
  const warnings: CheckinValidationIssue[] = [];
  for (const file of files) {
    for (const issue of validateDitaFileForCheckin(file, locale)) {
      if (issue.severity === 'error') errors.push(issue);
      else warnings.push(issue);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Best-effort source location for a `.ditaval` failure (falling back to 1:1 for semantic errors). */
function locateDitavalError(content: string): { line: number; column: number } {
  const wellFormed = checkXmlWellFormed(content);
  if (!wellFormed.ok) {
    return { line: wellFormed.error.line, column: wellFormed.error.column };
  }
  return { line: 1, column: 1 };
}
