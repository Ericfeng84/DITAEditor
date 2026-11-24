import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';

const TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="dedupe_topic">
  <title>Dedupe Topic</title>
  <body>
    <p>Only one tab should exist for this path.</p>
  </body>
</topic>
`;

/**
 * `openFileTab` awaits disk reads before pushing a tab, so two callers that start together both pass
 * the initial `openTabs.find(...)` dedupe check. The workbench bootstraps itself from an effect, and
 * React StrictMode runs that effect twice in development, which used to leave two identical tabs.
 * The store therefore re-checks the path inside the final `set()`.
 */
describe('openFileTab tab de-duplication', () => {
  beforeEach(() => {
    useEditorStore.setState({
      workspaceMode: 'memory',
      memoryFiles: { 'topics/a.dita': TOPIC_XML },
      openTabs: [],
      activeTabPath: null,
      mapBuffers: {},
    });
  });

  it('keeps a single tab when two callers open the same file concurrently', async () => {
    await Promise.all([
      useEditorStore.getState().openFileTab('topics/a.dita'),
      useEditorStore.getState().openFileTab('topics/a.dita'),
    ]);

    const state = useEditorStore.getState();
    expect(state.openTabs.filter((tab) => tab.path === 'topics/a.dita')).toHaveLength(1);
    expect(state.activeTabPath).toBe('topics/a.dita');
  });

  it('reuses the existing tab on a later open instead of appending a duplicate', async () => {
    await useEditorStore.getState().openFileTab('topics/a.dita', { mode: 'source' });
    await useEditorStore.getState().openFileTab('topics/a.dita', { mode: 'visual' });

    const tabs = useEditorStore.getState().openTabs.filter((tab) => tab.path === 'topics/a.dita');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.mode).toBe('visual');
  });
});
