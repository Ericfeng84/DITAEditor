import { useEffect, type RefObject } from 'react';

export interface UseInstantTitlesOptions {
  /** Gap in px between the trigger and the tooltip. */
  offset?: number;
  /** Preferred side; 'auto' flips when there is not enough room. */
  placement?: 'auto' | 'top' | 'bottom';
}

const VIEWPORT_GAP = 8;

/**
 * Upgrades the native `title` tooltips of every trigger inside `rootRef` into an
 * immediate custom tooltip: as soon as the pointer (or keyboard focus) lands on a
 * `[title]` element, its title is moved into a single floating tooltip node and the
 * attribute is stripped so the browser never shows its slow native bubble.
 *
 * The original title is restored on leave, so React props stay authoritative and
 * the accessible name is unchanged when the tooltip is closed.
 */
export function useInstantTitles(
  rootRef: RefObject<HTMLElement | null>,
  options: UseInstantTitlesOptions = {},
): void {
  const { offset = 8, placement = 'auto' } = options;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof document === 'undefined') return;

    let tip: HTMLDivElement | null = null;
    let active: HTMLElement | null = null;
    let savedTitle = '';

    const removeTip = (): void => {
      tip?.remove();
      tip = null;
    };

    const hide = (): void => {
      if (active && savedTitle && !active.hasAttribute('title')) {
        active.setAttribute('title', savedTitle);
      }
      active = null;
      savedTitle = '';
      removeTip();
    };

    const ensureTip = (): HTMLDivElement => {
      if (tip?.isConnected) return tip;
      const node = document.createElement('div');
      node.className = 'dita-instant-tip';
      node.setAttribute('role', 'tooltip');
      document.body.append(node);
      tip = node;
      return node;
    };

    const place = (trigger: HTMLElement, label: string): void => {
      const node = ensureTip();
      node.textContent = label;
      node.style.visibility = 'hidden';
      node.style.left = '0px';
      node.style.top = '0px';

      const rect = trigger.getBoundingClientRect();
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, VIEWPORT_GAP),
        Math.max(viewportWidth - width - VIEWPORT_GAP, VIEWPORT_GAP),
      );

      let below = placement !== 'top';
      if (placement === 'auto' && rect.bottom + offset + height > viewportHeight - VIEWPORT_GAP) {
        below = false;
      }
      let top = below ? rect.bottom + offset : rect.top - height - offset;
      if (top < VIEWPORT_GAP) {
        below = true;
        top = rect.bottom + offset;
      }

      node.dataset.placement = below ? 'bottom' : 'top';
      node.style.left = `${Math.round(left)}px`;
      node.style.top = `${Math.round(top)}px`;
      node.style.visibility = 'visible';
    };

    const showFor = (trigger: HTMLElement): void => {
      const label = trigger.getAttribute('title');
      if (active === trigger) {
        if (label) trigger.removeAttribute('title');
        return;
      }
      if (!label) return;
      hide();
      savedTitle = label;
      active = trigger;
      trigger.removeAttribute('title');
      place(trigger, label);
    };

    const findTrigger = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      const el = target.closest('[title]');
      return el instanceof HTMLElement && root.contains(el) ? el : null;
    };

    const onPointerOver = (event: PointerEvent): void => {
      const trigger = findTrigger(event.target);
      if (trigger) showFor(trigger);
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!active) return;
      const target = event.target;
      if (target instanceof Node && active.contains(target)) {
        if (active.hasAttribute('title')) active.removeAttribute('title');
        return;
      }
      const trigger = findTrigger(target);
      if (trigger && trigger !== active) showFor(trigger);
      else hide();
    };

    const onPointerOut = (event: PointerEvent): void => {
      if (!active) return;
      const related = event.relatedTarget;
      if (related instanceof Node && active.contains(related)) return;
      hide();
    };

    const onFocusIn = (event: FocusEvent): void => {
      const trigger = findTrigger(event.target);
      if (trigger) showFor(trigger);
    };

    const onFocusOut = (event: FocusEvent): void => {
      if (active && event.target === active) hide();
    };

    const onPointerDown = (): void => hide();
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') hide();
    };
    const onViewportChange = (): void => hide();

    root.addEventListener('pointerover', onPointerOver);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerout', onPointerOut);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    document.addEventListener('keydown', onEscape, true);

    return () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      document.removeEventListener('keydown', onEscape, true);
      hide();
    };
  }, [rootRef, offset, placement]);
}
