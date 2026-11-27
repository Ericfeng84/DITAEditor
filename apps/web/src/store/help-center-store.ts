import { create } from 'zustand';

/**
 * Help center open state.
 *
 * A store instead of a React context so any surface (Workbench header, Hub header, keyboard
 * host) can open the dialog without threading a provider through `apps/web/src/App.tsx`.
 */
export interface HelpCenterState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useHelpCenterStore = create<HelpCenterState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

/** True when the keystroke belongs to a text field and must not trigger global shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName ?? '';
  return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
