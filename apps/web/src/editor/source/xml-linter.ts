import { linter, type Diagnostic } from '@codemirror/lint';
import { checkXmlStructure } from '@dita/core';
import { getCurrentLocale, translate } from '../../i18n/index.js';
import { describeStructureIssue } from '../structure-messages.js';
import { getTaskContentModelSetting } from '../structure-options';

/**
 * CodeMirror 6 real-time XML linter backed directly by `@dita/core`:
 * 1. well-formedness (blocks Visual mode switching), then
 * 2. DITA 1.3 ordered content-model checks (sequence + cardinality) which are what DITA-OT strict
 *    validation rejects but relaxed processors silently accept.
 *
 * Uses a single position-tracked parse via `checkXmlStructure()`. Structure issues never block
 * editing; they are surfaced as inline squiggles and in ProblemsPanel.
 */
export function createDitaXmlLinter() {
  return linter(
    (view) => {
      const xml = view.state.doc.toString();
      if (xml.trim().length === 0) {
        return [
          {
            from: 0,
            to: 0,
            severity: 'error',
            source: 'DITA XML',
            message: translate(getCurrentLocale(), 'source.emptyDocument'),
          },
        ];
      }

      // `auto` (the default) resolves the task shell from this document's own DOCTYPE, so a
      // `generalTask.dtd` / `ditabase.dtd` topic is linted with the unconstrained taskbody model.
      const structure = checkXmlStructure(xml, { taskModel: getTaskContentModelSetting() });
      const docLength = view.state.doc.length;
      if (!structure.ok) {
        const { line, column, message, offset } = structure.error;
        const clampedFrom = Math.max(0, Math.min(offset, docLength));
        const lineObj =
          line >= 1 && line <= view.state.doc.lines ? view.state.doc.line(line) : null;
        const clampedTo = lineObj
          ? Math.min(lineObj.to, Math.max(clampedFrom + 1, Math.min(clampedFrom + 12, lineObj.to)))
          : Math.min(docLength, clampedFrom + 1);

        const diagnostic: Diagnostic = {
          from: clampedFrom,
          to: Math.max(clampedFrom, clampedTo),
          severity: 'error',
          source: 'DITA XML',
          message: translate(getCurrentLocale(), 'source.positionedMessage', { line, column, message }),
        };
        return [diagnostic];
      }

      const locale = getCurrentLocale();
      const sourceLabel = translate(locale, 'source.structureSource');
      return structure.issues.map((issue) => {
        const from = Math.max(0, Math.min(issue.offset, docLength));
        const to = Math.max(
          from,
          Math.min(Math.max(issue.endOffset, from + 1), docLength),
        );
        return {
          from,
          to,
          severity: issue.severity === 'warning' ? 'warning' : 'error',
          source: sourceLabel,
          message: describeStructureIssue(issue, locale),
        } satisfies Diagnostic;
      });
    },
    { delay: 180 },
  );
}
