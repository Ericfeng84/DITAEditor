import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';

export interface ToolbarMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name of the dropdown itself (`role="menu"`). */
  ariaLabel: string;
  /** Tooltip on the trigger button (also used as its accessible description). */
  triggerTitle: string;
  /** Trigger label content: icon + text + chevron. */
  triggerContent: ReactNode;
  /** Extra trigger classes layered on top of `dita-mini-btn px-1.5 py-0.5`. */
  triggerClassName?: string;
  /** Rendered inside the popover; usually `role="menuitem"` buttons. */
  children: ReactNode;
}

/**
 * Toolbar dropdown menu rendered in the browser **top layer** via the native Popover API.
 *
 * The map-tree action strip lives inside the sidebar's `overflow-hidden` pane, so an absolutely
 * positioned menu is clipped (or squeezed against the panel edge) as soon as it is wider than the
 * trigger button. A `[popover="auto"]` element escapes that clipping entirely, and gives
 * light-dismiss + Escape handling for free. Position is computed from the trigger rect and
 * viewport-clamped (flip above the trigger when there is no room below).
 */
export function ToolbarMenu({
  open,
  onOpenChange,
  ariaLabel,
  triggerTitle,
  triggerContent,
  triggerClassName = '',
  children,
}: ToolbarMenuProps) {
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  /** Set when the trigger was activated from the keyboard, so focus can enter the menu. */
  const focusFirstRef = useRef(false);

  const reposition = useCallback(() => {
    const btn = triggerRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    pop.style.position = 'fixed';
    pop.style.inset = 'auto';
    pop.style.margin = '0';
    // Measure at a known origin first, then clamp into the viewport.
    pop.style.left = '0px';
    pop.style.top = '0px';
    const menuRect = pop.getBoundingClientRect();
    const width = menuRect.width || 224;
    const height = menuRect.height || 120;
    const anchor = btn.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    const below = anchor.bottom + 4;
    const top =
      below + height <= window.innerHeight - 8
        ? below
        : Math.max(8, anchor.top - height - 4);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

  // Keep the native popover in sync with the controlled `open` prop.
  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;
    const supportsPopover = typeof pop.showPopover === 'function';
    if (open) {
      if (supportsPopover && !pop.matches(':popover-open')) {
        try {
          pop.showPopover();
        } catch {
          // Popover API unavailable in this runtime; the menu still renders inline.
        }
      }
      reposition();
      if (focusFirstRef.current) {
        focusFirstRef.current = false;
        requestAnimationFrame(() => {
          pop.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
        });
      }
      return;
    }
    if (supportsPopover && pop.matches(':popover-open')) {
      try {
        pop.hidePopover();
      } catch {
        // Already closed.
      }
    }
  }, [open, reposition]);

  // Native light-dismiss / Escape closes the popover: mirror that back into React state.
  useEffect(() => {
    const pop = popoverRef.current;
    if (!pop) return;
    const handleToggle = (event: Event) => {
      const state = (event as ToggleEvent).newState;
      if (state === 'open') {
        reposition();
        if (!openRef.current) onOpenChange(true);
      } else if (openRef.current) {
        onOpenChange(false);
      }
    };
    pop.addEventListener('toggle', handleToggle);
    return () => pop.removeEventListener('toggle', handleToggle);
  }, [onOpenChange, reposition]);

  // A fixed popover does not follow its trigger when the panel scrolls or the window resizes.
  useEffect(() => {
    if (!open) return;
    const handle = () => reposition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [open, reposition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        {...({ popovertarget: popoverId } as Record<string, string>)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            focusFirstRef.current = true;
          }
        }}
        title={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`dita-mini-btn px-1.5 py-0.5 ${triggerClassName}`.trim()}
      >
        {triggerContent}
      </button>
      <div
        ref={popoverRef}
        id={popoverId}
        {...({ popover: 'auto' } as Record<string, string>)}
        className="dita-toolbar-popover w-56 rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div role="menu" aria-label={ariaLabel} className="dita-ctx-menu">
          {children}
        </div>
      </div>
    </>
  );
}
