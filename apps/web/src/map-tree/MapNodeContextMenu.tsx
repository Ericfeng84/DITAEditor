import { useCallback, useEffect, useRef } from 'react';
import {
  BookOpen,
  Code2,
  FilePlus2,
  FolderPlus,
  Layers,
  Link2,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { CompositeMapTreeNode } from './map-tree-utils';
import { useI18n } from '../i18n/index.js';

export interface MapNodeMenuTarget {
  node: CompositeMapTreeNode;
  x: number;
  y: number;
  openedByKeyboard: boolean;
  restoreEl: HTMLElement | null;
}

export interface MapNodeContextMenuProps {
  target: MapNodeMenuTarget | null;
  isBookmap: boolean;
  onClose: () => void;
  onOpenTarget: (node: CompositeMapTreeNode) => void;
  onViewSource: (node: CompositeMapTreeNode) => void;
  onCreateChildTopic: (node: CompositeMapTreeNode) => void;
  onMountExisting: (node: CompositeMapTreeNode) => void;
  onInsertStructure: (node: CompositeMapTreeNode, tagName: string) => void;
  onInspectNode: (node: CompositeMapTreeNode) => void;
  onRemoveNode: (node: CompositeMapTreeNode) => void;
}

/**
 * Accessible context menu for Map Tree nodes following `modern-web-guidance` `menu`:
 * - Zero-size `position: fixed` anchor placeholder placed immediately before `[popover="auto"]`
 * - Opened via `showPopover({ source })` so CSS Anchor Positioning (`position-area`) works natively,
 *   with `@supports not (position-area: block-end)` viewport-clamped fallback coordinates
 * - Nested `<div focusgroup="menu nomemory">` with `<hr>` native separators
 * - `role="menu"` / `role="menuitem"` & arrow-key roving fallback ONLY when native `focusgroup` is missing
 */
export function MapNodeContextMenu({
  target,
  isBookmap,
  onClose,
  onOpenTarget,
  onViewSource,
  onCreateChildTopic,
  onMountExisting,
  onInsertStructure,
  onInspectNode,
  onRemoveNode,
}: MapNodeContextMenuProps) {
  const { t } = useI18n();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<MapNodeMenuTarget | null>(target);
  targetRef.current = target;

  const getEnabledMenuItems = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return [];
    return Array.from(menu.querySelectorAll<HTMLButtonElement>('button')).filter(
      (btn) => !btn.disabled && btn.getAttribute('aria-disabled') !== 'true',
    );
  }, []);

  const hideMenuAndRestore = useCallback(
    (fromPointer: boolean) => {
      const pop = popoverRef.current;
      const restore = targetRef.current?.restoreEl;
      try {
        if (pop && typeof pop.hidePopover === 'function' && pop.matches(':popover-open')) {
          pop.hidePopover();
        }
      } catch {
        // fallback below
      }
      if (restore && typeof restore.focus === 'function') {
        try {
          restore.focus({ focusVisible: !fromPointer } as FocusOptions);
        } catch {
          restore.focus();
        }
      }
      onClose();
    },
    [onClose],
  );

  // Position fallback when CSS Anchor Positioning (`position-area`) is unsupported
  const applyFallbackViewportPosition = useCallback((x: number, y: number) => {
    const pop = popoverRef.current;
    if (!pop) return;
    if (typeof CSS !== 'undefined' && CSS.supports?.('position-area', 'block-end')) {
      pop.style.left = '';
      pop.style.top = '';
      return;
    }
    const rect = pop.getBoundingClientRect();
    const width = rect.width || 224;
    const height = rect.height || 260;
    const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

  // Open or close the native popover whenever `target` changes
  useEffect(() => {
    const anchor = anchorRef.current;
    const pop = popoverRef.current;
    if (!anchor || !pop) return;

    if (!target) {
      try {
        if (typeof pop.hidePopover === 'function' && pop.matches(':popover-open')) {
          pop.hidePopover();
        }
      } catch {
        // ignore
      }
      return;
    }

    anchor.style.left = `${target.x}px`;
    anchor.style.top = `${target.y}px`;

    try {
      const showPopoverWithSource = pop.showPopover as
        | ((options?: { source?: HTMLElement }) => void)
        | undefined;
      if (typeof showPopoverWithSource === 'function') {
        if (!pop.matches(':popover-open')) {
          showPopoverWithSource.call(pop, { source: anchor });
        }
        applyFallbackViewportPosition(target.x, target.y);
      }
    } catch {
      applyFallbackViewportPosition(target.x, target.y);
    }

    if (target.openedByKeyboard) {
      requestAnimationFrame(() => {
        getEnabledMenuItems()[0]?.focus();
      });
    }
  }, [target, applyFallbackViewportPosition, getEnabledMenuItems]);

  // Listen to native popover `toggle` light-dismiss / Escape close
  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;

    const handleToggle = (ev: Event) => {
      const toggleEv = ev as ToggleEvent;
      if (toggleEv.newState === 'closed' && targetRef.current) {
        onClose();
      } else if (toggleEv.newState === 'open' && targetRef.current) {
        applyFallbackViewportPosition(targetRef.current.x, targetRef.current.y);
      }
    };

    pop.addEventListener('toggle', handleToggle);
    return () => pop.removeEventListener('toggle', handleToggle);
  }, [onClose, applyFallbackViewportPosition]);

  // Fallback keyboard navigation + ARIA menu roles strictly when native `focusgroup` is absent
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const hasFocusGroup = 'focusGroup' in HTMLElement.prototype;
    if (!hasFocusGroup) {
      menu.setAttribute('role', 'menu');
      menu.querySelectorAll('button:not([role])').forEach((btn) => {
        btn.setAttribute('role', 'menuitem');
      });
    }

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        hideMenuAndRestore(false);
        return;
      }
      if (ev.key === 'Tab') {
        hideMenuAndRestore(false);
        return;
      }

      if (hasFocusGroup) return;
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(ev.key)) return;

      const items = getEnabledMenuItems();
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      let next = 0;
      if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = items.length - 1;
      else if (ev.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
      else if (ev.key === 'ArrowUp') {
        next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      items[next]?.focus({ preventScroll: true });
    };

    menu.addEventListener('keydown', handleKeyDown, true);
    return () => menu.removeEventListener('keydown', handleKeyDown, true);
  }, [target, getEnabledMenuItems, hideMenuAndRestore]);

  const handlePointerMoveItem = (ev: React.PointerEvent<HTMLButtonElement>) => {
    try {
      ev.currentTarget.focus({ focusVisible: false } as FocusOptions);
    } catch {
      ev.currentTarget.focus();
    }
  };

  const runAction = (
    ev: React.MouseEvent<HTMLButtonElement>,
    action: (node: CompositeMapTreeNode) => void,
  ) => {
    const current = target?.node;
    const fromPointer = ev.detail !== 0;
    hideMenuAndRestore(fromPointer);
    if (current) {
      action(current);
    }
  };

  const node = target?.node ?? null;
  const canNestChildren =
    node !== null &&
    (node.isSubmapRef ||
      ['topicref', 'topichead', 'topicgroup', 'chapter', 'part', 'appendix', 'frontmatter', 'backmatter'].includes(
        node.tagName,
      ));

  return (
    <>
      <div
        ref={anchorRef}
        aria-hidden="true"
        className="dita-ctx-anchor"
      />
      <div
        ref={popoverRef}
        {...({ popover: 'auto' } as Record<string, string>)}
        className="dita-ctx-popover"
      >
        <div
          ref={menuRef}
          {...({ focusgroup: 'menu nomemory' } as Record<string, string>)}
          aria-label={t('mapMenu.aria')}
          className="dita-ctx-menu"
        >
          <button
            type="button"
            disabled={!node?.resolvedTargetPath}
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onOpenTarget)}
          >
            <BookOpen className="dita-ctx-icon text-blue-600" aria-hidden="true" />
            <span>{node?.isSubmapRef ? t('mapMenu.openSubmap') : t('mapMenu.openTopic')}</span>
          </button>
          <button
            type="button"
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onViewSource)}
          >
            <Code2 className="dita-ctx-icon text-sky-600" aria-hidden="true" />
            <span>{t('mapMenu.locate')}</span>
          </button>

          <hr />

          <button
            type="button"
            disabled={!canNestChildren}
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onCreateChildTopic)}
          >
            <FilePlus2 className="dita-ctx-icon text-emerald-600" aria-hidden="true" />
            <span>{t('mapMenu.createChild')}</span>
          </button>
          <button
            type="button"
            disabled={!canNestChildren}
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onMountExisting)}
          >
            <Link2 className="dita-ctx-icon text-blue-600" aria-hidden="true" />
            <span>{t('mapMenu.mountExisting')}</span>
          </button>

          <hr />

          <button
            type="button"
            disabled={!canNestChildren}
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, (n) => onInsertStructure(n, isBookmap ? 'chapter' : 'topichead'))}
          >
            <FolderPlus className="dita-ctx-icon text-slate-600" aria-hidden="true" />
            <span>{isBookmap ? t('mapMenu.insertChapter') : t('mapMenu.insertGroup')}</span>
          </button>
          <button
            type="button"
            disabled={!canNestChildren || isBookmap}
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, (n) => onInsertStructure(n, 'topicgroup'))}
          >
            <Layers className="dita-ctx-icon text-slate-600" aria-hidden="true" />
            <span>{t('mapMenu.insertTopicgroup')}</span>
          </button>

          <hr />

          <button
            type="button"
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onInspectNode)}
          >
            <SlidersHorizontal className="dita-ctx-icon text-slate-600" aria-hidden="true" />
            <span>{t('mapMenu.editAttrs')}</span>
          </button>
          <button
            type="button"
            className="text-rose-600"
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onRemoveNode)}
          >
            <Trash2 className="dita-ctx-icon text-rose-500" aria-hidden="true" />
            <span>{t('mapMenu.remove')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
