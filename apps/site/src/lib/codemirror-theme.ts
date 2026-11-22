import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/**
 * Paper-light CodeMirror theme shared by the sandbox. Colours come from the global design tokens
 * so the source view stays visually inside the site instead of importing a third-party theme.
 */
export const ditaEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#FFFFFF',
      color: '#141619',
      fontSize: '12.5px',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      lineHeight: '1.75',
      overflow: 'auto',
    },
    '.cm-content': { padding: '16px 0', caretColor: '#1D4ED8' },
    '.cm-line': { padding: '0 18px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-gutters': {
      backgroundColor: '#FAF9F6',
      color: '#9AA0AB',
      border: 'none',
      borderRight: '1px solid #E5E2DA',
      fontSize: '11px',
    },
    '.cm-activeLineGutter': { backgroundColor: '#F1EFE8', color: '#454A54' },
    '.cm-activeLine': { backgroundColor: 'rgba(29, 78, 216, 0.04)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(29, 78, 216, 0.16) !important',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1D4ED8', borderLeftWidth: '2px' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgba(180, 83, 9, 0.14)',
      outline: 'none',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#F1EFE8',
      border: '1px solid #E5E2DA',
      color: '#454A54',
    },
    '.cm-tooltip': {
      border: '1px solid #E5E2DA',
      backgroundColor: '#FFFFFF',
      boxShadow: '0 12px 28px -18px rgba(20, 22, 25, 0.4)',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'rgba(29, 78, 216, 0.08)',
      color: '#141619',
    },
    '.cm-diagnostic': { fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px' },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      borderBottom: '1.5px solid #B91C1C',
    },
  },
  { dark: false },
);

export const ditaHighlightStyle = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], color: '#1D4ED8' },
  { tag: [t.attributeName], color: '#B45309' },
  { tag: [t.attributeValue, t.string], color: '#15803D' },
  { tag: [t.processingInstruction, t.meta], color: '#6E7480' },
  { tag: [t.comment], color: '#9AA0AB', fontStyle: 'italic' },
  { tag: [t.documentMeta], color: '#6E7480' },
  { tag: [t.number, t.bool], color: '#9333EA' },
]);
