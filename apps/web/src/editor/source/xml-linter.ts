import { linter, type Diagnostic } from '@codemirror/lint';
import { checkXmlWellFormed } from '@dita/core';

/**
 * CodeMirror 6 real-time XML well-formedness linter backed directly by `@dita/core`.
 * Highlights the exact error position reported by `slimdom-sax-parser` with zero network latency.
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
            message: 'XML 文档不能为空，请包含有效的 DITA 根元素。',
          },
        ];
      }

      const result = checkXmlWellFormed(xml, { position: false });
      if (result.ok) {
        return [];
      }

      const { line, column, message, offset } = result.error;
      const docLength = view.state.doc.length;
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
        message: `第 ${line} 行第 ${column} 列：${message}`,
      };
      return [diagnostic];
    },
    { delay: 180 },
  );
}
