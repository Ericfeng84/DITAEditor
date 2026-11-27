import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, FilePlus2, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { CompositeMapTreeNode } from './map-tree-utils';
import { useI18n } from '../i18n/index.js';

export interface MapTargetFixTarget {
  node: CompositeMapTreeNode;
  x: number;
  y: number;
  openedByKeyboard: boolean;
  restoreEl: HTMLElement | null;
}

export interface MapTargetFixPopoverProps {
  target: MapTargetFixTarget | null;
  onClose: () => void;
  onCreateTarget: (node: CompositeMapTreeNode) => void;
  onEditHref: (node: CompositeMapTreeNode) => void;
  onRemoveNode: (node: CompositeMapTreeNode) => void;
}

const MAP_EXTENSIONS = /\.ditamap$/i;

/**
 * Quick fix for a `topicref` whose target file does not exist yet.
 *
 * A dangling `href` is normal mid-authoring (someone wrote the map before the topic, or the topic
 * lives in a personal draft), so it must never look like a hard error: this popover turns the
 * warning into the next authoring step instead of a dead end. Mechanics mirror
 * `MapNodeContextMenu` (native `popover="auto"` + CSS Anchor Positioning with a viewport fallback).
 */
export function MapTargetFixPopover({
  target,
  onClose,
  onCreateTarget,
  onEditHref,
  onRemoveNode,
}: MapTargetFixPopoverProps) {
  const { t } = useI18n();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<MapTargetFixTarget | null>(target);
  targetRef.current = target;
  const [copied, setCopied] = useState(false);

  const getEnabledMenuItems = useCallback(() => {
    const menu = menuRef.current;
    if (!menu) return [];
    return Array.from(menu.querySelectorAll<HTMLButtonElement>('button')).filter(
      (btn) => !btn.disabled,
    );
  }, []);

  const hideAndRestore = useCallback(
    (fromPointer: boolean) => {
      const pop = popoverRef.current;
      const restore = targetRef.current?.restoreEl;
      try {
        if (pop && typeof pop.hidePopover === 'function' && pop.matches(':popover-open')) {
          pop.hidePopover();
        }
      } catch {
        // fall through to onClose()
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

  const applyFallbackViewportPosition = useCallback((x: number, y: number) => {
    const pop = popoverRef.current;
    if (!pop) return;
    if (typeof CSS !== 'undefined' && CSS.supports?.('position-area', 'block-end')) {
      pop.style.left = '';
      pop.style.top = '';
      return;
    }
    const rect = pop.getBoundingClientRect();
    const width = rect.width || 248;
    const height = rect.height || 200;
    const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

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

    setCopied(false);
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

  // Escape / Tab close; arrow keys rove only when the native focusgroup is unavailable.
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
        hideAndRestore(false);
        return;
      }
      if (ev.key === 'Tab') {
        hideAndRestore(false);
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
      else next = (current - 1 + items.length) % items.length;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      items[next]?.focus({ preventScroll: true });
    };

    menu.addEventListener('keydown', handleKeyDown, true);
    return () => menu.removeEventListener('keydown', handleKeyDown, true);
  }, [getEnabledMenuItems, hideAndRestore]);

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
    hideAndRestore(fromPointer);
    if (current) action(current);
  };

  const node = target?.node ?? null;
  const targetPath = node?.resolvedTargetPath;
  // Maps cannot be generated from a row: only real topics get the one-click create action.
  const canCreate = Boolean(targetPath) && !MAP_EXTENSIONS.test(targetPath ?? '');

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" className="dita-ctx-anchor" />
      <div
        ref={popoverRef}
        {...({ popover: 'auto' } as Record<string, string>)}
        className="dita-ctx-popover dita-target-fix-popover"
      >
        <div
          ref={menuRef}
          {...({ focusgroup: 'menu nomemory' } as Record<string, string>)}
          aria-label={t('mapTargetFix.aria')}
          className="dita-ctx-menu"
        >
          <div className="px-2.5 py-1.5">
            <p className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              {t('mapTargetFix.title')}
            </p>
            <p className="mt-0.5 font-mono text-[10px] break-all text-slate-500">
              {targetPath ?? node?.href ?? ''}
            </p>
          </div>

          <hr />

          <button
            type="button"
            disabled={!canCreate}
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onCreateTarget)}
            title={canCreate ? t('mapTargetFix.createHint') : t('mapTargetFix.createDisabledHint')}
          >
            <FilePlus2 className="dita-ctx-icon text-emerald-600" aria-hidden="true" />
            <span className="flex flex-col">
              <span>{t('mapTargetFix.create')}</span>
              <span className="text-[10px] leading-tight text-slate-500">
                {t('mapTargetFix.createSub')}
              </span>
            </span>
          </button>
          <button
            type="button"
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onEditHref)}
          >
            <SlidersHorizontal className="dita-ctx-icon text-blue-600" aria-hidden="true" />
            <span className="flex flex-col">
              <span>{t('mapTargetFix.editHref')}</span>
              <span className="text-[10px] leading-tight text-slate-500">
                {t('mapTargetFix.editHrefSub')}
              </span>
            </span>
          </button>
          <button
            type="button"
            onPointerMove={handlePointerMoveItem}
            onClick={async (ev) => {
              ev.stopPropagation();
              const href = node?.href;
              if (!href) return;
              try {
                await navigator.clipboard.writeText(href);
                setCopied(true);
              } catch {
                // Clipboard permissions can be denied; keep the menu open so the user can retry.
              }
            }}
          >
            {copied ? (
              <Check className="dita-ctx-icon text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="dita-ctx-icon text-slate-500" aria-hidden="true" />
            )}
            <span>
              {copied ? t('mapTargetFix.copied') : t('mapTargetFix.copyHref')}
              <span className="ml-1 font-mono text-[10px] text-slate-400">{node?.href ?? ''}</span>
            </span>
          </button>

          <hr />

          <button
            type="button"
            className="text-rose-600"
            onPointerMove={handlePointerMoveItem}
            onClick={(ev) => runAction(ev, onRemoveNode)}
          >
            <Trash2 className="dita-ctx-icon text-rose-500" aria-hidden="true" />
            <span>{t('mapTargetFix.remove')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
