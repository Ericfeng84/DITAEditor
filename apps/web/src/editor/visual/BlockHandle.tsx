import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { BlockConvertOption } from './block-transforms';
import { useI18n } from '../../i18n/index.js';
import type { MessageKey } from '../../i18n/messages/index.js';

export interface BlockHandleProps {
  /** Viewport coords of the handle row (aligned with the block's first line). */
  top: number;
  left: number;
  blockTag: string;
  containerTag: string;
  dragging: boolean;
  /** Conversion options; non-null while the "turn into" menu is open. */
  menuOptions: BlockConvertOption[] | null;
  /** Whether a legal sibling block can still be inserted below this block. */
  canInsert: boolean;
  /** Dragging is only offered inside a reorderable container and never for pinned blocks. */
  canMove: boolean;
  /** Duplicating is refused for single-occurrence slots (`<shortdesc>`, `<title>`, focused ones). */
  canDuplicate: boolean;
  /** Deleting is refused for required structure (`<taskbody>`, the last `<step>`, the root). */
  canDelete: boolean;
  /** Localized explanation shown while the delete action is refused. */
  deleteBlockedReason: string | null;
  onInsert: () => void;
  onToggleMenu: () => void;
  onStartDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onConvert: (tag: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCloseMenu: () => void;
}

const MODE_LABEL_KEYS: Record<string, MessageKey> = {
  inline: 'block.mode.inline',
  'wrap-inline': 'block.mode.wrapInline',
  'wrap-block': 'block.mode.wrapBlock',
  text: 'block.mode.text',
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
  canInsert,
  canMove,
  canDuplicate,
  canDelete,
  deleteBlockedReason,
  onInsert,
  onToggleMenu,
  onStartDrag,
  onConvert,
  onDuplicate,
  onDelete,
  onCloseMenu,
}: BlockHandleProps) {
  const { t } = useI18n();
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
        title={canInsert ? t('block.insertBlockTitle', { tag: containerTag }) : t('block.insertBlockUnavailable')}
        aria-label={canInsert ? t('block.insertBlockTitle', { tag: containerTag }) : t('block.insertBlockUnavailable')}
        disabled={!canInsert}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onInsert}
      >
        <Plus size={13} aria-hidden />
      </button>
      <button
        type="button"
        className={`dita-block-handle-btn dita-block-handle-grip${canMove ? '' : ' dita-block-handle-grip--static'}`}
        title={
          canMove
            ? t('block.convertTitle', { tag: blockTag })
            : t('block.staticTitle', { tag: blockTag, container: containerTag })
        }
        aria-label={t('block.convertTitle', { tag: blockTag })}
        aria-haspopup="menu"
        aria-expanded={menuOptions !== null}
        data-movable={canMove}
        onPointerDown={(event) => {
          if (canMove) {
            onStartDrag(event);
            return;
          }
          // Pinned / structural blocks cannot be dragged: open the action menu directly.
          event.preventDefault();
          onToggleMenu();
        }}
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
          aria-label={t('block.convertMenuAria', { tag: blockTag })}
          style={{ top: menuPos.top, left: menuPos.left }}
          onKeyDown={handleKeyDown}
          data-testid="block-type-menu"
        >
          <div className="dita-block-menu-head">
            <span className="dita-block-menu-tag">{`<${blockTag}>`}</span>
            <span className="dita-block-menu-hint">{t('block.convertMenuHint', { tag: containerTag })}</span>
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
                <span className="dita-block-menu-mode">{MODE_LABEL_KEYS[option.mode] ? t(MODE_LABEL_KEYS[option.mode]!) : option.mode}</span>
              </button>
            ))}
            {menuOptions.length === 0 ? (
              <div className="dita-block-menu-empty">{t('block.noConvertible')}</div>
            ) : null}
          </div>
          <div className="dita-block-menu-sep" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="dita-block-menu-action"
            disabled={!canDuplicate}
            onClick={onDuplicate}
          >
            <Copy size={12} aria-hidden />
            {t('block.duplicate')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="dita-block-menu-action dita-block-menu-action--danger"
            disabled={!canDelete}
            title={deleteBlockedReason ?? undefined}
            onClick={onDelete}
          >
            <Trash2 size={12} aria-hidden />
            {t('block.delete')}
          </button>
          {canDelete ? null : (
            <p className="dita-block-menu-note" data-testid="block-delete-blocked">
              {deleteBlockedReason}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
