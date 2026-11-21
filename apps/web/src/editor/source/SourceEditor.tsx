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
import { lintGutter } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import type { XmlParseError } from '@dita/core';
import { AlertTriangle, Check, Copy, LocateFixed, Sparkles } from 'lucide-react';
import { formatDitaXml } from '../bridge/xml-bridge';
import { ditaXmlCompletionSource } from './dita-completion';
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
}: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isApplyingExternalRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCursorRef = useRef(onCursorOffsetChange);
  onChangeRef.current = onChange;
  onCursorRef.current = onCursorOffsetChange;

  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copied, setCopied] = useState(false);

  // Mount CodeMirror 6 instance once
  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const state = EditorState.create({
      doc: xml,
      extensions: [
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
          override: [ditaXmlCompletionSource],
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
      onAnnounce?.(`无法格式化：第 ${res.error.line} 行存在 XML 语法错误`);
      return;
    }
    if (res.xml === raw) {
      onAnnounce?.('XML 格式已是标准确定性缩进');
      return;
    }
    view.dispatch({
      changes: { from: 0, to: raw.length, insert: res.xml },
    });
    onAnnounce?.('已完成 DITA XML 确定性格式化');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(xml);
      setCopied(true);
      onAnnounce?.('已复制完整 DITA XML 源码');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      onAnnounce?.('复制失败，请检查浏览器剪贴板权限');
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      {/* Compact Source Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium text-sky-400">XML 源码</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">DITA 1.3 智能补全已就绪（输入 &lt; 或属性名触发）</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <button
            type="button"
            onClick={handleFormat}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
            title="使用 @dita/core 确定性序列化器整理缩进"
          >
            <Sparkles className="h-3 w-3 text-sky-400" aria-hidden="true" />
            格式化 XML
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-slate-400" aria-hidden="true" />
                复制
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
                  ? '已阻止切换至可视化模式（XML 良构校验未通过）'
                  : `XML 良构错误 · 第 ${xmlError.line} 行第 ${xmlError.column} 列`}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-rose-300">
                {xmlError.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleJumpToError}
            className="inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-500"
          >
            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            定位到错误位置
          </button>
        </div>
      ) : null}

      {/* CodeMirror 6 Mount Container */}
      <div
        ref={hostRef}
        className="dita-scroller min-h-0 flex-1 overflow-hidden"
        aria-label="DITA XML 源码编辑器"
      />
    </div>
  );
}
