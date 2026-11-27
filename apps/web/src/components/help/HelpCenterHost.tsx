/**
 * Mount point for the help center: owns the global `?` shortcut and renders the dialog.
 *
 * Rendered once in `apps/web/src/main.tsx` so the Hub and the Workbench share one dialog
 * instance; entry buttons only need `useHelpCenterStore((state) => state.open)`.
 */

import { useEffect } from 'react';
import { isTypingTarget, useHelpCenterStore } from '../../store/help-center-store.js';
import { HelpCenterDialog } from './HelpCenterDialog.js';

export function HelpCenterHost() {
  const isOpen = useHelpCenterStore((state) => state.isOpen);
  const close = useHelpCenterStore((state) => state.close);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== '?') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      useHelpCenterStore.getState().toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return <HelpCenterDialog open={isOpen} onClose={close} />;
}
