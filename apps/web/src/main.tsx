import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppShell } from './AppShell';
import { HelpCenterHost } from './components/help/HelpCenterHost.js';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AppShell />
      <HelpCenterHost />
    </StrictMode>,
  );
}
