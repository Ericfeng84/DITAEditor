import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bold,
  Code,
  Ellipsis,
  FolderTree,
  Italic,
  Keyboard,
  KeyRound,
  ListFilter,
  MousePointerClick,
  Tag,
  Tags,
  Terminal,
  Type as TypeIcon,
  Underline,
  Variable,
  type LucideIcon,
} from 'lucide-react';
import type { DitaElementSpec } from '@dita/core';
import { useInstantTitles } from './useInstantTitles';

const TAG_ICONS: Record<string, LucideIcon> = {
  b: Bold,
  i: Italic,
  u: Underline,
  codeph: Code,
  uicontrol: MousePointerClick,
  filepath: FolderTree,
  varname: Variable,
  keyword: KeyRound,
  term: Tag,
  ph: Tags,
  cmdname: Code,
  parmname: Code,
  apiname: Code,
  userinput: Keyboard,
  systemoutput: Terminal,
  wintitle: TypeIcon,
  option: ListFilter,
};

export interface InlineBubbleAnchor {
  /** Viewport y (px) of the bubble's top edge. */
  top: number;
  /** Viewport x (px) of the bubble's horizontal center before clamping. */
  left: number;
}

export interface InlineBubbleToolbarProps {
  anchor: InlineBubbleAnchor;
  contextTag: string | null;
  items: DitaElementSpec[];
  activeTags: Set<string>;
  onApply: (tag: string) => void;
  onOpenMore: (anchorEl: HTMLElement) => void;
  onClose: () => void;
}

const EDGE_GAP = 8;

/**
 * Floating quick toolbar shown above a text selection in the visual editor.
 * Every button applies a DITA inline element to the highlighted range and keeps
 * the editor selection intact (mousedown is prevented so focus never leaves the view).
 */
export function InlineBubbleToolbar({
  anchor,
  contextTag,
  items,
  activeTags,
  onApply,
  onOpenMore,
  onClose,
}: InlineBubbleToolbarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [left, setLeft] = useState(anchor.left);
  useInstantTitles(rootRef, { offset: 6, placement: 'top' });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const width = el.offsetWidth;
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const min = EDGE_GAP + width / 2;
    const max = viewportWidth - width / 2 - EDGE_GAP;
    setLeft(max <= min ? viewportWidth / 2 : Math.min(Math.max(anchor.left, min), max));
  }, [anchor.left, anchor.top, items.length]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      ref={rootRef}
      className="dita-bubble"
      role="toolbar"
      aria-label={contextTag ? `行内元素转换（当前上下文 <${contextTag}>）` : '行内元素转换'}
      style={{ top: anchor.top, left }}
      onKeyDown={handleKeyDown}
      data-testid="inline-bubble-toolbar"
    >
      {items.map((spec) => {
        const Icon = TAG_ICONS[spec.tag] ?? Tag;
        const pressed = activeTags.has(spec.tag);
        return (
          <button
            key={spec.tag}
            type="button"
            className="dita-bubble-btn"
            title={`<${spec.tag}> ${spec.labelZh}${spec.shortcut ? ` · ${spec.shortcut}` : ''}`}
            aria-label={`转换为 <${spec.tag}>`}
            aria-pressed={pressed}
            data-tag={spec.tag}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onApply(spec.tag)}
          >
            <Icon size={14} aria-hidden />
          </button>
        );
      })}
      <span className="dita-bubble-sep" aria-hidden />
      <button
        ref={moreBtnRef}
        type="button"
        className="dita-bubble-btn"
        title="更多行内元素"
        aria-label="更多行内元素"
        data-tag="__more__"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const el = moreBtnRef.current;
          if (el) onOpenMore(el);
        }}
      >
        <Ellipsis size={14} aria-hidden />
      </button>
    </div>
  );
}
