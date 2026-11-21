import { DITA_CORE_VERSION } from '@dita/core';

export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>DITA Editor</h1>
      <p>Core engine ready: @dita/core v{DITA_CORE_VERSION}</p>
    </main>
  );
}
