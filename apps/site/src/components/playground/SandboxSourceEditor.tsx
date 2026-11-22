import { useEffect, useRef } from 'react';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { xml } from '@codemirror/lang-xml';
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { checkXmlWellFormed } from '@dita/core';
import { ditaHighlightStyle, ditaEditorTheme } from '../../lib/codemirror-theme.js';

/** Surface the same well-formedness gate the real workbench uses before Visual mode. */
const xmlLinter = linter(
  (view): Diagnostic[] => {
    const result = checkXmlWellFormed(view.state.doc.toString());
    if (result.ok) return [];
    const lineNumber = Math.min(Math.max(result.error.line, 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    const from = Math.min(line.from + Math.max(result.error.column - 1, 0), line.to);
    return [
      {
        from,
        to: Math.min(from + 1, line.to),
        severity: 'error',
        message: result.error.message,
      },
    ];
  },
  { delay: 260 },
);

interface Props {
  value: string;
  onChange: (xml: string) => void;
  ariaLabel: string;
}

export default function SandboxSourceEditor({ value, onChange, ariaLabel }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          foldGutter(),
          lintGutter(),
          xmlLinter,
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          xml(),
          syntaxHighlighting(ditaHighlightStyle),
          ditaEditorTheme,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: 'false' }),
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const next = update.state.doc.toString();
            lastEmittedRef.current = next;
            onChangeRef.current(next);
          }),
        ],
      }),
    });
    viewRef.current = view;
    lastEmittedRef.current = value;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount once; external updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === lastEmittedRef.current) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
    lastEmittedRef.current = value;
  }, [value]);

  return (
    <div
      className="pg-source-host"
      ref={hostRef}
    />
  );
}
