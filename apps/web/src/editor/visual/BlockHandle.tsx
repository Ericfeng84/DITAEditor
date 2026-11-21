import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { BlockConvertOption } from './block-transforms';

export interface BlockHandleProps {
  /** Viewport coords of the handle row (aligned with the block's first line). */
  top: number;
  left: number;
  blockTag: string;
  containerTag: string;
  dragging: boolean;
  /** Conversion options; non-null while the "turn into" menu is open. */
  menuOptions: BlockConvertOption[] | null;
  onInsert: () => void;
  onToggleMenu: () => void;
  onStartDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onConvert: (tag: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCloseMenu: () => void;
}

const MODE_LABEL: Record<string, string> = {
  inline: '保留文本',
  'wrap-inline': '包裹段落',
  'wrap-block': '包裹整块',
  text: '转为纯文本',
};

const MENU_WIDTH = 232;
const MENU_MAX_HEIGHT = 320;
const EDGE_GAP = 8;

/**
 * Notion-style left gutter handle: `+` inserts a sibling block, the grip drags the block
 * to another gap of its container and a plain click opens the "turn into" menu.
 */
export function BlockHandle({
  top,
  left,
  blockTag,
  containerTag,
  dragging,
  menuOptions,
  onInsert,
  onToggleMenu,
  onStartDrag,
  onConvert,
  onDuplicate,
  onDelete,
  onCloseMenu,
}: BlockHandleProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!menuOptions) {
      setMenuPos(null);
      return;
    }
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    const root = rootRef.current;
    const handleWidth = root?.offsetWidth ?? 44;
    const menuLeft = Math.min(
      Math.max(left + handleWidth + 4, EDGE_GAP),
      Math.max(viewportWidth - MENU_WIDTH - EDGE_GAP, EDGE_GAP),
    );
    const menuTop = Math.min(
      Math.max(top - 4, EDGE_GAP),
      Math.max(viewportHeight - MENU_MAX_HEIGHT - EDGE_GAP, EDGE_GAP),
    );
    setMenuPos({ top: menuTop, left: menuLeft });
  }, [menuOptions, top, left]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseMenu();
      }
    },
    [onCloseMenu],
  );

  return (
    <div
      ref={rootRef}
      className={`dita-block-handle${dragging ? ' dita-block-handle--dragging' : ''}`}
      style={{ top, left }}
      data-block-tag={blockTag}
      data-testid="block-handle"
    >
      <button
        type="button"
        className="dita-block-handle-btn"
        title={`在 <${containerTag}> 中插入块`}
        aria-label={`在 <${containerTag}> 中插入块`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onInsert}
      >
        <Plus size={13} aria-hidden />
      </button>
      <button
        type="button"
        className="dita-block-handle-btn dita-block-handle-grip"
        title={`拖动或点击以转换 <${blockTag}>`}
        aria-label={`拖动或点击以转换 <${blockTag}>`}
        aria-haspopup="menu"
        aria-expanded={menuOptions !== null}
        onPointerDown={onStartDrag}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggleMenu();
          }
        }}
      >
        <GripVertical size={13} aria-hidden />
      </button>

      {menuOptions && menuPos ? (
        <div
          className="dita-block-menu"
          role="menu"
          aria-label={`转换 <${blockTag}> 为其他块`}
          style={{ top: menuPos.top, left: menuPos.left }}
          onKeyDown={handleKeyDown}
          data-testid="block-type-menu"
        >
          <div className="dita-block-menu-head">
            <span className="dita-block-menu-tag">{`<${blockTag}>`}</span>
            <span className="dita-block-menu-hint">{`转换为 · <${containerTag}> 内合法块`}</span>
          </div>
          <div className="dita-block-menu-list">
            {menuOptions.map((option) => (
              <button
                key={option.spec.tag}
                type="button"
                role="menuitem"
                className="dita-block-menu-item"
                onClick={() => onConvert(option.spec.tag)}
              >
                <span className="dita-block-menu-item-label">{option.spec.labelZh}</span>
                <span className="dita-block-menu-item-tag">{`<${option.spec.tag}>`}</span>
                <span className="dita-block-menu-mode">{MODE_LABEL[option.mode] ?? option.mode}</span>
              </button>
            ))}
            {menuOptions.length === 0 ? (
              <div className="dita-block-menu-empty">当前容器内没有可转换的块</div>
            ) : null}
          </div>
          <div className="dita-block-menu-sep" role="separator" />
          <button type="button" role="menuitem" className="dita-block-menu-action" onClick={onDuplicate}>
            <Copy size={12} aria-hidden />
            复制块
          </button>
          <button
            type="button"
            role="menuitem"
            className="dita-block-menu-action dita-block-menu-action--danger"
            onClick={onDelete}
          >
            <Trash2 size={12} aria-hidden />
            删除块
          </button>
        </div>
      ) : null}
    </div>
  );
}
