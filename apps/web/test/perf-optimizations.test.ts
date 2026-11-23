import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../src/store/editor-store';

const MAP_PATH = 'root.ditamap';
const TOPIC_A_PATH = 'topics/a.dita';
const TOPIC_B_PATH = 'topics/b.dita';

const BASE_MAP = `<?xml version="1.0" encoding="UTF-8"?>
<map id="m_perf">
  <title>Perf Map</title>
  <keydef keys="prod_name"><topicmeta><keywords><keyword>Acme</keyword></keywords></topicmeta></keydef>
  <topicref href="topics/a.dita"/>
  <topicref href="topics/b.dita"/>
</map>`;

const BASE_TOPIC_A = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="topic_a">
  <title>Topic A</title>
  <body><p><keyword keyref="prod_name"/></p></body>
</topic>`;

const BASE_TOPIC_B = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="topic_b">
  <title>Topic B</title>
  <body><p><keyword keyref="prod_name"/></p></body>
</topic>`;

async function loadTestMemoryWorkspace() {
  await useEditorStore.getState().importFolderWorkspace('Perf Test', [
    { path: MAP_PATH, content: BASE_MAP },
    { path: TOPIC_A_PATH, content: BASE_TOPIC_A },
    { path: TOPIC_B_PATH, content: BASE_TOPIC_B },
  ]);
}

describe('editor-store performance & debounce regression guards', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await loadTestMemoryWorkspace();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not re-parse XML in updateXmlFromVisual when caller explicitly passes null title', () => {
    const store = useEditorStore.getState();
    expect(store.activeTabPath).toBe(TOPIC_A_PATH);

    // Passing `null` means the PM doc was already inspected and had no title, so the store
    // must use the filename fallback instead of re-parsing the XML string.
    const xmlWithTitle = `<topic id="topic_a"><title>Must Not Be Parsed</title><body><p>x</p></body></topic>`;
    store.updateXmlFromVisual(xmlWithTitle, null);
    const tabAfterNull = useEditorStore.getState().openTabs.find((t) => t.path === TOPIC_A_PATH);
    expect(tabAfterNull?.title).toBe('a.dita');

    // Omitting `title` (`undefined`) still parses the title from XML for non-PM callers.
    store.updateXmlFromVisual(xmlWithTitle);
    const tabAfterUndefined = useEditorStore
      .getState()
      .openTabs.find((t) => t.path === TOPIC_A_PATH);
    expect(tabAfterUndefined?.title).toBe('Must Not Be Parsed');
  });

  it('defers source-mode map keyspace refresh by 400ms and preserves unsaved map edits', async () => {
    await useEditorStore.getState().openFileTab(MAP_PATH, { mode: 'source' });
    const updatedMap = BASE_MAP.replace(
      '</map>',
      '  <keydef keys="live_key"><topicmeta><keywords><keyword>LiveValue</keyword></keywords></topicmeta></keydef>\n</map>',
    );

    useEditorStore.getState().updateXmlFromSource(updatedMap);

    // Debounced: keyspace should not yet contain the new key synchronously.
    expect(useEditorStore.getState().keyspace?.keys['live_key']).toBeUndefined();

    // After 400ms, the unsaved map edit must be indexed rather than reverted to saved memoryFiles.
    await vi.advanceTimersByTimeAsync(450);
    expect(useEditorStore.getState().keyspace?.keys['live_key']?.inlineText).toBe('LiveValue');
  });

  it('cancels pending overlay refresh on resetCurrentToBaseline so stale XML is never written back', async () => {
    const editedTopic = `<topic id="topic_a">
  <title>Edited A</title>
  <body><p><keyword keyref="missing_key_123"/></p></body>
</topic>`;
    useEditorStore.getState().updateXmlFromVisual(editedTopic, 'Edited A');

    // Revert within the 180ms debounce window.
    await vi.advanceTimersByTimeAsync(50);
    useEditorStore.getState().resetCurrentToBaseline();

    // Let the original 180ms window elapse.
    await vi.advanceTimersByTimeAsync(250);

    const state = useEditorStore.getState();
    const tab = state.openTabs.find((t) => t.path === TOPIC_A_PATH);
    expect(tab?.xml).toBe(BASE_TOPIC_A);
    expect(tab?.title).toBe('Topic A');

    const overlay = state.documentOverlays[TOPIC_A_PATH];
    const keyrefs = Object.keys(overlay?.keyrefs ?? {});
    expect(keyrefs).toContain('prod_name');
    expect(keyrefs).not.toContain('missing_key_123');
  });

  it('keeps per-file overlay timers independent when switching tabs within 180ms', async () => {
    await useEditorStore.getState().openFileTab(TOPIC_B_PATH);

    // Edit Topic B
    const editedB = `<topic id="topic_b"><title>Topic B</title><body><p><keyword keyref="key_b"/></p></body></topic>`;
    useEditorStore.getState().updateXmlFromVisual(editedB, 'Topic B');

    // Immediately switch to Topic A and edit it before Topic B's 180ms timer fires
    useEditorStore.getState().activateTab(TOPIC_A_PATH);
    const editedA = `<topic id="topic_a"><title>Topic A</title><body><p><keyword keyref="key_a"/></p></body></topic>`;
    useEditorStore.getState().updateXmlFromVisual(editedA, 'Topic A');

    await vi.advanceTimersByTimeAsync(220);

    const overlays = useEditorStore.getState().documentOverlays;
    expect(Object.keys(overlays[TOPIC_A_PATH]?.keyrefs ?? {})).toContain('key_a');
    expect(Object.keys(overlays[TOPIC_B_PATH]?.keyrefs ?? {})).toContain('key_b');
  });

  it('cancels stale timers and resets semantic index cache cleanly across workspace imports', async () => {
    const editedA = `<topic id="topic_a"><title>Stale A</title><body><p><keyword keyref="stale_key"/></p></body></topic>`;
    useEditorStore.getState().updateXmlFromVisual(editedA, 'Stale A');

    // Import a brand-new workspace before the 180ms timer fires.
    await vi.advanceTimersByTimeAsync(50);
    await useEditorStore.getState().importFolderWorkspace('Fresh Workspace', [
      {
        path: 'fresh.ditamap',
        content: `<map id="m_fresh"><title>Fresh</title><keydef keys="fresh_key"><topicmeta><keywords><keyword>FreshVal</keyword></keywords></topicmeta></keydef><topicref href="topics/a.dita"/></map>`,
      },
      {
        path: TOPIC_A_PATH,
        content: `<topic id="topic_a"><title>Fresh A</title><body><p><keyword keyref="fresh_key"/></p></body></topic>`,
      },
    ]);

    // Advance past the old timer window; stale edit from previous workspace must not leak in.
    await vi.advanceTimersByTimeAsync(300);

    const state = useEditorStore.getState();
    expect(state.workspaceName).toBe('Fresh Workspace');
    expect(state.keyspace?.keys['fresh_key']?.inlineText).toBe('FreshVal');
    expect(state.keyspace?.keys['prod_name']).toBeUndefined();
    const keyrefs = Object.keys(state.documentOverlays[TOPIC_A_PATH]?.keyrefs ?? {});
    expect(keyrefs).toContain('fresh_key');
    expect(keyrefs).not.toContain('stale_key');
  });
});
