import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { OutlineNode } from './outline-model.js';
import type { OutlineDropBlockReason, OutlineDropEvaluation, OutlineDropPlacement } from './outline-dnd.js';

/** A press must travel this far before it becomes a drag, so plain clicks still locate. */
const DRAG_THRESHOLD_PX = 4;
/** Auto-scroll kicks in when the pointer is this close to the scroll container edges. */
const AUTO_SCROLL_EDGE_PX = 28;
const AUTO_SCROLL_STEP_PX = 16;
/** Attribute the tree rows expose so hit-testing can find the hovered element. */
const ROW_SELECTOR = '[data-outline-pos]';
const SCROLL_SELECTOR = '[data-outline-scroll]';
const DRAGGING_BODY_CLASS = 'dita-outline-dragging';

export interface OutlineDropIndicator {
  targetId: string;
  targetPos: number;
  placement: OutlineDropPlacement;
  ok: boolean;
}

export interface OutlineDragGhost {
  sourceId: string;
  /** Tag name of the dragged element. */
  tagName: string;
  label: string;
  clientX: number;
  clientY: number;
  /** Tag name of the hovered drop target, when the pointer is over a row. */
  targetTag: string | null;
  /** Localized-by-caller block reason, or `null` when the drop is legal. */
  reason: OutlineDropBlockReason | null;
}

export interface UseOutlineDragOptions {
  onEvaluateDrop: (sourcePos: number, targetPos: number, placement: OutlineDropPlacement) => OutlineDropEvaluation;
  onDrop: (sourcePos: number, targetPos: number, placement: OutlineDropPlacement) => boolean;
  /** Scroll container used for edge auto-scroll; defaults to the closest `[data-outline-scroll]`. */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
}

export interface UseOutlineDragResult {
  draggingPos: number | null;
  dropIndicator: OutlineDropIndicator | null;
  ghost: OutlineDragGhost | null;
  startDrag: (event: ReactPointerEvent<HTMLElement>, node: OutlineNode) => void;
}

interface DragUiState {
  draggingPos: number | null;
  dropIndicator: OutlineDropIndicator | null;
  ghost: OutlineDragGhost | null;
}

const IDLE_STATE: DragUiState = { draggingPos: null, dropIndicator: null, ghost: null };

interface DragSession {
  pointerId: number;
  source: OutlineNode;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  active: boolean;
  evaluation: OutlineDropEvaluation | null;
  scrollContainer: HTMLElement | null;
  frame: number | null;
  scrollDir: -1 | 0 | 1;
  detach: () => void;
}

/** Top-25% / middle-50% / bottom-25% inside containers, halves everywhere else. */
function resolvePlacement(row: HTMLElement, clientY: number): OutlineDropPlacement {
  const rect = row.getBoundingClientRect();
  const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
  if (row.dataset.outlineContainer === 'true') {
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  }
  return ratio < 0.5 ? 'before' : 'after';
}

function findRow(clientX: number, clientY: number): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit) return null;
  return hit.closest<HTMLElement>(ROW_SELECTOR);
}

function readPos(row: HTMLElement): number | null {
  const raw = row.dataset.outlinePos;
  if (raw === undefined) return null;
  const pos = Number(raw);
  return Number.isFinite(pos) ? pos : null;
}

function sameIndicator(a: OutlineDropIndicator | null, b: OutlineDropIndicator | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.targetPos === b.targetPos && a.placement === b.placement && a.ok === b.ok;
}

function sameGhost(a: OutlineDragGhost | null, b: OutlineDragGhost | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.clientX === b.clientX &&
    a.clientY === b.clientY &&
    a.reason === b.reason &&
    a.targetTag === b.targetTag &&
    a.sourceId === b.sourceId
  );
}

/**
 * Pointer-driven drag-and-drop for the document outline.
 *
 * `react-dnd-html5-backend` cannot be used here: `MapTreePanel` already mounts one
 * `HTML5Backend` on the same window and a second registration throws, so the outline
 * runs its own pointer session with `document.elementFromPoint` hit-testing.
 */
export function useOutlineDrag(options: UseOutlineDragOptions): UseOutlineDragResult {
  const [state, setState] = useState<DragUiState>(IDLE_STATE);
  const sessionRef = useRef<DragSession | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const commit = useCallback((next: DragUiState) => {
    setState((prev) =>
      prev.draggingPos === next.draggingPos &&
      sameGhost(prev.ghost, next.ghost) &&
      sameIndicator(prev.dropIndicator, next.dropIndicator)
        ? prev
        : next,
    );
  }, []);

  const teardown = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.detach();
    if (session.frame !== null) window.cancelAnimationFrame(session.frame);
    sessionRef.current = null;
    document.body.classList.remove(DRAGGING_BODY_CLASS);
    commit(IDLE_STATE);
  }, [commit]);

  useEffect(() => () => teardown(), [teardown]);

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, node: OutlineNode) => {
      if (optionsRef.current.disabled) return;
      if (event.button !== 0) return;
      // Touch drags fight with native scrolling; keep taps locating instead.
      if (event.pointerType === 'touch') return;
      if (sessionRef.current) return;

      const pointerId = event.pointerId;
      const scrollContainer =
        optionsRef.current.scrollContainerRef?.current ??
        (event.currentTarget.closest(SCROLL_SELECTOR) as HTMLElement | null);

      const session: DragSession = {
        pointerId,
        source: node,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        active: false,
        evaluation: null,
        scrollContainer,
        frame: null,
        scrollDir: 0,
        detach: () => undefined,
      };

      /** Re-evaluates the hovered row; only `pointermove` and auto-scroll call this. */
      const evaluateAt = (clientX: number, clientY: number) => {
        const source = session.source;
        const base: OutlineDragGhost = {
          sourceId: source.id,
          tagName: source.tagName,
          label: source.label,
          clientX,
          clientY,
          targetTag: null,
          reason: null,
        };
        const row = findRow(clientX, clientY);
        const targetPos = row ? readPos(row) : null;
        if (!row || targetPos === null) {
          session.evaluation = null;
          commit({ draggingPos: source.pmPos, dropIndicator: null, ghost: base });
          return;
        }

        const rect = row.getBoundingClientRect();
        let placement = resolvePlacement(row, clientY);
        let evaluation = optionsRef.current.onEvaluateDrop(source.pmPos, targetPos, placement);

        // Dragging past container edges must feel smooth: an illegal `inside` falls back to
        // the nearest sibling gap (`before` in the upper half, `after` in the lower half).
        if (placement === 'inside' && !evaluation.ok && targetPos !== source.pmPos) {
          const fallbackPlacement: OutlineDropPlacement = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
          const fallback = optionsRef.current.onEvaluateDrop(source.pmPos, targetPos, fallbackPlacement);
          if (fallback.ok) {
            evaluation = fallback;
            placement = fallbackPlacement;
          }
        }
        session.evaluation = evaluation;

        const reason: OutlineDropBlockReason | null =
          evaluation.ok || evaluation.reason === 'noop' ? null : (evaluation.reason ?? null);

        commit({
          draggingPos: source.pmPos,
          dropIndicator: {
            targetId: row.dataset.outlineId ?? '',
            targetPos,
            placement,
            ok: evaluation.ok,
          },
          ghost: { ...base, targetTag: row.dataset.outlineTag ?? null, reason },
        });
      };

      /** Keeps scrolling while the pointer rests near the top/bottom edge. */
      const tickAutoScroll = () => {
        const current = sessionRef.current;
        if (current !== session || !current.active || current.scrollDir === 0) {
          if (current === session) session.frame = null;
          return;
        }
        current.scrollContainer?.scrollBy({ top: current.scrollDir * AUTO_SCROLL_STEP_PX });
        evaluateAt(current.lastX, current.lastY);
        current.frame = window.requestAnimationFrame(tickAutoScroll);
      };

      const updateAutoScroll = () => {
        const container = session.scrollContainer;
        if (!container) {
          session.scrollDir = 0;
          return;
        }
        const rect = container.getBoundingClientRect();
        if (session.lastY < rect.top + AUTO_SCROLL_EDGE_PX) session.scrollDir = -1;
        else if (session.lastY > rect.bottom - AUTO_SCROLL_EDGE_PX) session.scrollDir = 1;
        else session.scrollDir = 0;

        if (session.scrollDir !== 0 && session.frame === null) {
          session.frame = window.requestAnimationFrame(tickAutoScroll);
        }
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        session.lastX = moveEvent.clientX;
        session.lastY = moveEvent.clientY;
        if (!session.active) {
          const distance = Math.hypot(moveEvent.clientX - session.startX, moveEvent.clientY - session.startY);
          if (distance < DRAG_THRESHOLD_PX) return;
          session.active = true;
          document.body.classList.add(DRAGGING_BODY_CLASS);
        }
        // Suppresses text selection / native image dragging while the pointer owns the gesture.
        if (moveEvent.cancelable) moveEvent.preventDefault();
        evaluateAt(moveEvent.clientX, moveEvent.clientY);
        updateAutoScroll();
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        const wasActive = session.active;
        const evaluation = session.evaluation;
        teardown();
        if (!wasActive || !evaluation?.ok) return;
        optionsRef.current.onDrop(session.source.pmPos, evaluation.targetPos, evaluation.placement);
      };

      const onPointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId !== pointerId) return;
        teardown();
      };

      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape') return;
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
        teardown();
      };

      const onWindowBlur = () => teardown();

      session.detach = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('blur', onWindowBlur);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
      // Capture phase: Escape must cancel the drag even when the tree row keeps focus.
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('blur', onWindowBlur);

      sessionRef.current = session;
    },
    [commit, teardown],
  );

  return {
    draggingPos: state.draggingPos,
    dropIndicator: state.dropIndicator,
    ghost: state.ghost,
    startDrag,
  };
}
