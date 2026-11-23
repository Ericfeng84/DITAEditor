import {
  formatStructureIssue,
  STRUCTURE_MESSAGE_KEYS,
  type StructureIssueMessageInput,
  type UiLocale,
} from '@dita/core';
import { getCurrentLocale } from '../i18n/index.js';

export { STRUCTURE_MESSAGE_KEYS };
export type StructureIssueLike = StructureIssueMessageInput;

/**
 * Localized, human-readable explanation for a DITA 1.3 content-model (sequence / cardinality) violation.
 * Delegates to `@dita/core`'s `formatStructureIssue` so Visual Editor, CodeMirror linter, and
 * ProblemsPanel always share a single message source.
 */
export function describeStructureIssue(
  issue: StructureIssueLike,
  locale: UiLocale | string = getCurrentLocale(),
): string {
  return formatStructureIssue(issue, locale);
}
