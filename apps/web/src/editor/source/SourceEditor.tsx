import { useEffect, useRef, useState } from 'react';
import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { xml as xmlLang } from '@codemirror/lang-xml';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { forceLinting, lintGutter } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import type {
  DitaProfilingAttrName,
  KeyspaceResult,
  TaskContentModel,
  TaskContentModelSetting,
  TopicIdIndexEntry,
  XmlParseError,
} from '@dita/core';
import { AlertTriangle, Check, Copy, LocateFixed, Sparkles } from 'lucide-react';
import { formatDitaXml } from '../bridge/xml-bridge';
import { getCurrentLocale, translate, useI18n } from '../../i18n/index.js';
import { TaskModelSwitch } from '../../components/TaskModelSwitch';
import {
  createDitaXmlCompletionSource,
  type SourceSemanticCompletionContext,
} from './dita-completion';
import { createDitaXmlLinter } from './xml-linter';

export interface SourceEditorProps {
  xml: string;
  xmlError: XmlParseError | null;
  switchBlockedReason: string | null;
  pendingJumpOffset: number | null;
  onJumpHandled: () => void;
  onChange: (nextXml: string) => void;
  onCursorOffsetChange?: (offset: number) => void;
  onAnnounce?: (msg: string) => void;
  keyspace?: KeyspaceResult | null;
  topicIndices?: readonly TopicIdIndexEntry[];
  profilingCatalog?: Partial<Record<DitaProfilingAttrName, readonly string[]>>;
  /** Read-only mode for viewers or files checked out by another identity. */
  readOnly?: boolean;
  /** One-shot buffer replacement issued by an applied AI proposal. */
  replacementXml?: string | null;
  onReplacementApplied?: () => void;
  /** Opens the AI assistant to repair the current well-formedness error. */
  onAiFixXmlError?: () => void;
  /**
   * Task content-model preference; `auto` follows this document's DOCTYPE.
   * The switch itself (`TaskModelSwitch`) is rendered in this toolbar for `<task>` topics only;
   * changing it also forces a re-lint of the buffer.
   */
  taskModelSetting?: TaskContentModelSetting;
  /** Model `auto` currently resolves to for this document (shown next to the switch). */
  resolvedTaskModel?: TaskContentModel;
  onChangeTaskModelSetting?: (next: TaskContentModelSetting) => void;
  /** Only `<task>` topics expose the strict / general switch. */
  showTaskModelSwitch?: boolean;
}

const sourceEditorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily:
      '"JetBrains Mono", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  '.cm-scroller': {
    overflow: 'auto',
    lineHeight: '1.65',
  },
  '.cm-content': {
    padding: '14px 0',
    caretColor: '#38bdf8',
  },
  '.cm-gutters': {
    backgroundColor: '#0b1120',
    color: '#64748b',
    borderRight: '1px solid #1e293b',
    paddingRight: '4px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(56, 189, 248, 0.25) !important',
  },
  '.cm-cursor': {
    borderLeftColor: '#38bdf8',
    borderLeftWidth: '2px',
  },
  '.cm-tooltip': {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#f1f5f9',
    borderRadius: '6px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.45)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: '#0284c7',
    color: '#ffffff',
  },
  '.cm-diagnostic-error': {
    borderLeft: '3px solid #f87171',
    backgroundColor: 'rgba(127, 29, 29, 0.4)',
    color: '#fecaca',
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy #f87171',
    textUnderlineOffset: '3px',
  },
});

export function SourceEditor({
  xml,
  xmlError,
  switchBlockedReason,
  pendingJumpOffset,
  onJumpHandled,
  onChange,
  onCursorOffsetChange,
  onAnnounce,
  keyspace,
  topicIndices,
  profilingCatalog,
  readOnly = false,
  replacementXml = null,
  onReplacementApplied,
  onAiFixXmlError,
  taskModelSetting = 'auto',
  resolvedTaskModel = 'strict',
  onChangeTaskModelSetting,
  showTaskModelSwitch = false,
}: SourceEditorProps) {
  const { t, locale } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isApplyingExternalRef = useRef(false);
  const editableCompartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursorOffsetChange);
  const completionCtxRef = useRef<SourceSemanticCompletionContext>({
    keyspace,
    topicIndices,
    profilingCatalog,
  });
  onChangeRef.current = onChange;
  onCursorRef.current = onCursorOffsetChange;
  completionCtxRef.current = { keyspace, topicIndices, profilingCatalog };

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copied, setCopied] = useState(false);

  // Mount CodeMirror 6 instance once
  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const state = EditorState.create({
      doc: xml,
      extensions: [
        editableCompartmentRef.current.of(EditorView.editable.of(!readOnly)),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightSelectionMatches(),
        xmlLang(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        autocompletion({
          override: [createDitaXmlCompletionSource(() => completionCtxRef.current)],
          activateOnTyping: true,
        }),
        lintGutter(),
        createDitaXmlLinter(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.selectionSet) {
            const head = update.state.selection.main.head;
            const lineObj = update.state.doc.lineAt(head);
            setCursorPos({ line: lineObj.number, col: head - lineObj.from + 1 });
            onCursorRef.current?.(head);
          }
          if (update.docChanged && !isApplyingExternalRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        sourceEditorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: container,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally mounted once; external `xml` updates are synced incrementally below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle editability without rebuilding the CodeMirror instance.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
  }, [readOnly]);

  // Re-run lint diagnostics immediately on UI locale switch so messages re-translate without edits.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    forceLinting(view);
  }, [locale]);

  // Re-lint when the task content model changes (strict <-> general), without touching the buffer.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    forceLinting(view);
  }, [taskModelSetting]);

  // Sync external XML updates (from Visual edits or document switch) without losing scroll/focus unnecessarily
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === xml) return;

    isApplyingExternalRef.current = true;
    const prevHead = Math.min(view.state.selection.main.head, xml.length);
    view.dispatch({
      changes: { from: 0, to: current.length, insert: xml },
      selection: { anchor: prevHead },
    });
    isApplyingExternalRef.current = false;
  }, [xml]);

  // Apply an AI-patched document in a single CodeMirror dispatch. This runs after the
  // generic xml sync so the store remains the source of truth for the next render.
  useEffect(() => {
    if (replacementXml === null) return;
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current !== replacementXml) {
      isApplyingExternalRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: replacementXml },
        selection: { anchor: 0 },
        effects: EditorView.scrollIntoView(0, { y: 'start' }),
      });
      isApplyingExternalRef.current = false;
    }
    view.focus();
    onReplacementApplied?.();
  }, [replacementXml, onReplacementApplied]);

  // Handle Visual -> Source cursor jump requests
  useEffect(() => {
    if (pendingJumpOffset === null) return;
    const view = viewRef.current;
    if (!view) return;
    const clamped = Math.max(0, Math.min(pendingJumpOffset, view.state.doc.length));
    view.dispatch({
      selection: { anchor: clamped },
      effects: EditorView.scrollIntoView(clamped, { y: 'center' }),
    });
    view.focus();
    onJumpHandled();
  }, [pendingJumpOffset, onJumpHandled]);

  const handleJumpToError = () => {
    const view = viewRef.current;
    if (!view || !xmlError) return;
    const offset = Math.max(0, Math.min(xmlError.offset, view.state.doc.length));
    view.dispatch({
      selection: { anchor: offset },
      effects: EditorView.scrollIntoView(offset, { y: 'center' }),
    });
    view.focus();
  };

  const handleFormat = () => {
    const view = viewRef.current;
    if (!view) return;
    const raw = view.state.doc.toString();
    const res = formatDitaXml(raw);
    if (!res.ok) {
      onAnnounce?.(translate(getCurrentLocale(), 'source.formatBlocked', { line: res.error.line }));
      return;
    }
    if (res.xml === raw) {
      onAnnounce?.(translate(getCurrentLocale(), 'source.alreadyFormatted'));
      return;
    }
    view.dispatch({
      changes: { from: 0, to: raw.length, insert: res.xml },
    });
    onAnnounce?.(translate(getCurrentLocale(), 'source.formatted'));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      onAnnounce?.(translate(getCurrentLocale(), 'source.copied'));
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      onAnnounce?.(translate(getCurrentLocale(), 'source.copyFailed'));
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      {/* Compact Source Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-sky-400">{t('source.title')}</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{t('source.completionReady')}</span>
        </div>

        <div className="flex items-center gap-2">
          {showTaskModelSwitch && onChangeTaskModelSetting ? (
            <TaskModelSwitch
              setting={taskModelSetting}
              resolved={resolvedTaskModel}
              variant="dark"
              onChange={onChangeTaskModelSetting}
            />
          ) : null}
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <button
            type="button"
            onClick={handleFormat}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
            title={t('source.formatTitle')}
          >
            <Sparkles className="h-3 w-3 text-sky-400" aria-hidden="true" />
            {t('source.format')}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                {t('source.copiedShort')}
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" aria-hidden="true" />
                {t('source.copy')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Malformed XML Guard Banner */}
      {xmlError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/40 bg-rose-950/80 px-3 py-2 text-xs text-rose-100"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <div>
              <p className="font-semibold text-rose-200">
                {switchBlockedReason
                  ? t('source.switchBlocked')
                  : t('source.wellFormedError', { line: xmlError.line, column: xmlError.column })}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-rose-300">
                {xmlError.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onAiFixXmlError && !readOnly ? (
              <button
                type="button"
                onClick={onAiFixXmlError}
                className="inline-flex items-center gap-1 rounded border border-rose-400/60 bg-rose-900/60 px-2.5 py-1 text-[11px] font-medium text-rose-100 hover:bg-rose-800"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t('source.aiFix')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleJumpToError}
              className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-500"
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
              {t('source.jumpToError')}
            </button>
          </div>
        </div>
      ) : null}

      {/* CodeMirror 6 Mount Container */}
      <div
        ref={hostRef}
        className="dita-scroller min-h-0 flex-1 overflow-hidden"
        aria-label={t('source.editorAria')}
      />
    </div>
  );
}
