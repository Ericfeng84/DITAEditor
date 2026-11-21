import { useEffect, useMemo, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';

const diffTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12px',
    fontFamily:
      '"JetBrains Mono", "SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  '.cm-scroller': { overflow: 'auto', lineHeight: '1.6' },
  '.cm-content': { padding: '8px 0' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 10px', minWidth: '28px' },
});

/** Shorten raw 40-char commit SHAs while leaving symbolic labels (HEAD, 工作区) intact. */
function displayRevisionLabel(label: string): string {
  if (!/^[0-9a-f]{40}(?:~\d+)?$/.test(label)) return label;
  const parentMarker = label.endsWith('~1') ? '~1' : '';
  return `${label.slice(0, 7)}${parentMarker}`;
}

export interface DiffViewerProps {
  oldText: string;
  newText: string;
  fromLabel: string;
  toLabel: string;
}

/** Side-by-side CodeMirror 6 MergeView used by history and check-in previews. */
export function DiffViewer({ oldText, newText, fromLabel, toLabel }: DiffViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mergeRef = useRef<MergeView | null>(null);
  const labels = useMemo(
    () => ({ fromLabel: displayRevisionLabel(fromLabel), toLabel: displayRevisionLabel(toLabel) }),
    [fromLabel, toLabel],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    const merge = new MergeView({
      a: {
        doc: oldText,
        extensions: [EditorView.editable.of(false), EditorView.lineWrapping, lineNumbers(), diffTheme],
      },
      b: {
        doc: newText,
        extensions: [EditorView.editable.of(false), EditorView.lineWrapping, lineNumbers(), diffTheme],
      },
      parent: host,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 2, minSize: 6 },
    });
    // MergeView's own layout expects a block container. Making it a flex
    // container pushes the second editor outside the visible area.
    merge.dom.style.height = '100%';
    merge.dom.style.width = '100%';
    merge.dom.style.minWidth = '0';
    merge.dom.style.overflow = 'auto';
    mergeRef.current = merge;
    return () => {
      merge.destroy();
      mergeRef.current = null;
      host.innerHTML = '';
    };
  }, [oldText, newText]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200">
      <div className="grid shrink-0 grid-cols-2 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
        <div className="truncate border-r border-slate-200 px-2 py-1">旧版本 · {labels.fromLabel}</div>
        <div className="truncate px-2 py-1">新版本 · {labels.toLabel}</div>
      </div>
      <div ref={hostRef} className="dita-diff-view min-h-0 min-w-0 flex-1 overflow-hidden" />
    </div>
  );
}
