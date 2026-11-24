/**
 * Pointer-driven drag source for the reuse panel candidate rows.
 *
 * HTML5 drag-and-drop is the happy path (it also feeds the XML source view and any other drop
 * target for free), but some browsers refuse to start a native drag from a form control and
 * nothing happens without any feedback. This hook adds a pointer fallback on top:
 *
 * - native drag wins whenever the browser starts one (the pointer session is cancelled by the
 *   browser's own `pointercancel`), so a single gesture never inserts twice;
 * - otherwise a floating ghost chip follows the cursor, the visual editor is highlighted while
 *   the pointer is over it, and releasing calls `onDropAtPoint` with the release coordinates.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { writeConrefDragData, type ConrefDragPayload } from '../editor/visual/conref-drag.js';

export interface ConrefDragGhost {
  x: number;
  y: number;
  label: string;
  /** True while the pointer is over the visual editor (i.e. releasing will insert). */
  overTarget: boolean;
}

export interface ConrefRowDragOptions {
  /** Insert the payload at viewport coordinates; returns whether the element was inserted. */
  onDropAtPoint: (clientX: number, clientY: number, payload: ConrefDragPayload) => boolean;
}

export interface ConrefRowDragApi {
  ghost: ConrefDragGhost | null;
  /** Row is being dragged natively (used to dim it / keep it highlighted). */
  nativeDragging: boolean;
  /** `pointerdown` handler for a row: begins a (possibly) fallback drag session. */
  startPointerDrag: (
    event: ReactPointerEvent,
    payload: ConrefDragPayload,
    label: string,
  ) => void;
  /** `dragstart` handler: writes the native HTML5 payload. */
  startNativeDrag: (event: ReactDragEvent, payload: ConrefDragPayload) => void;
  /** `dragend` handler. */
  endNativeDrag: () => void;
}

const DRAG_THRESHOLD_PX = 4;

/** The visual editor resolves drops on its own ProseMirror root. */
function editorAt(clientX: number, clientY: number): Element | null {
  if (typeof document === 'undefined') return null;
  const hit = document.elementFromPoint(clientX, clientY);
  return hit?.closest('.ProseMirror') ?? null;
}

export function useConrefRowDrag({ onDropAtPoint }: ConrefRowDragOptions): ConrefRowDragApi {
  const [ghost, setGhost] = useState<ConrefDragGhost | null>(null);
  const [nativeDragging, setNativeDragging] = useState(false);
  const onDropRef = useRef(onDropAtPoint);
  onDropRef.current = onDropAtPoint;
  const stopRef = useRef<(() => void) | null>(null);
  const highlightedRef = useRef<Element | null>(null);

  const highlight = useCallback((next: Element | null) => {
    if (highlightedRef.current === next) return;
    highlightedRef.current?.classList.remove('dita-drop-target');
    next?.classList.add('dita-drop-target');
    highlightedRef.current = next;
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    highlight(null);
    setGhost(null);
  }, [highlight]);

  useEffect(() => () => stop(), [stop]);

  const startPointerDrag = useCallback<ConrefRowDragApi['startPointerDrag']>(
    (event, payload, label) => {
      if (event.button !== 0) return;
      stop();
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;
      let cancelled = false;

      const onMove = (moveEvent: PointerEvent) => {
        if (cancelled) return;
        if (!active) {
          const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
          if (distance < DRAG_THRESHOLD_PX) return;
          active = true;
        }
        const editor = editorAt(moveEvent.clientX, moveEvent.clientY);
        highlight(editor);
        setGhost({
          x: moveEvent.clientX,
          y: moveEvent.clientY,
          label,
          overTarget: editor !== null,
        });
      };

      const onUp = (upEvent: PointerEvent) => {
        // A native drag owns the gesture; `pointercancel` already disabled the fallback.
        const shouldDrop = !cancelled && active && editorAt(upEvent.clientX, upEvent.clientY);
        if (shouldDrop) onDropRef.current(upEvent.clientX, upEvent.clientY, payload);
        stop();
      };

      const onCancel = () => {
        cancelled = true;
        stop();
      };

      const detach = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      stopRef.current = detach;
    },
    [highlight, stop],
  );

  const startNativeDrag = useCallback<ConrefRowDragApi['startNativeDrag']>((event, payload) => {
    writeConrefDragData(event.dataTransfer, payload);
    setNativeDragging(true);
  }, []);

  const endNativeDrag = useCallback(() => setNativeDragging(false), []);

  return { ghost, nativeDragging, startPointerDrag, startNativeDrag, endNativeDrag };
}
