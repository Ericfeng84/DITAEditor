import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view';
import { getPmNodeRawAttrs, getRawAttr, pmDocToXml, xmlToPmDoc } from '@dita/core';
import { createDitaNodeViews, SemanticViewRegistry } from '../src/editor/visual/node-views';
import { TopicInspector } from '../src/components/TopicInspector';
import type { AttributesPanelProps } from '../src/editor/visual/AttributesPanel';
import type { ConrefReusePanelProps } from '../src/components/ConrefReusePanel';
import { t } from '../src/i18n/index.js';

/* ------------------------------------------------------------------------------------------------
 * Minimal DOM doubles.
 *
 * This suite runs in Vitest's Node environment (no jsdom), so `DitaNoteNodeView`'s
 * `document.createElement(...)` calls are served by a hand-rolled element that only implements the
 * surface the NodeView touches.
 * ---------------------------------------------------------------------------------------------- */

interface FakeDomEvent {
  type: string;
  preventDefault(): void;
  stopPropagation(): void;
}

class FakeDomElement {
  readonly tagName: string;
  className = '';
  contentEditable = '';
  textContent = '';
  value = '';
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  readonly children: FakeDomElement[] = [];
  private readonly listeners = new Map<string, Array<(ev: FakeDomEvent) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  appendChild(child: FakeDomElement): FakeDomElement {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: (ev: FakeDomEvent) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  dispatch(type: string): void {
    const ev: FakeDomEvent = { type, preventDefault: () => {}, stopPropagation: () => {} };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(ev);
  }

  find(predicate: (el: FakeDomElement) => boolean): FakeDomElement | null {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const hit = child.find(predicate);
      if (hit) return hit;
    }
    return null;
  }
}

function withFakeDocument<T>(fn: () => T): T {
  const globals = globalThis as { document?: unknown };
  const previous = globals.document;
  globals.document = { createElement: (tag: string) => new FakeDomElement(tag) };
  try {
    return fn();
  } finally {
    if (previous === undefined) delete globals.document;
    else globals.document = previous;
  }
}

const NOTE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="t"><title>T</title><body><p>Intro</p><note type="tip"><p>Careful</p></note></body></topic>`;

function buildNoteNodeView(isReadOnly: () => boolean, registry: SemanticViewRegistry) {
  const { pmDoc } = xmlToPmDoc(NOTE_XML);
  let notePos = -1;
  pmDoc.descendants((node, pos) => {
    if (notePos !== -1) return false;
    if (node.type.name === 'dita_note') {
      notePos = pos;
      return false;
    }
    return true;
  });
  expect(notePos).toBeGreaterThan(-1);

  let state = EditorState.create({ doc: pmDoc });
  const view = {
    get state() {
      return state;
    },
    dispatch(tr: Parameters<EditorView['dispatch']>[0]) {
      state = state.apply(tr);
    },
    focus() {},
  } as unknown as EditorView;

  const ctor = createDitaNodeViews({ isReadOnly, semanticRegistry: registry })
    .dita_note as NodeViewConstructor;
  const node = pmDoc.nodeAt(notePos);
  expect(node).not.toBeNull();
  const nodeView = ctor(node as PMNode, view, () => notePos, null as never, null as never);
  const select = (nodeView.dom as unknown as FakeDomElement).find(
    (el) => el.tagName === 'SELECT',
  );
  expect(select).not.toBeNull();

  return {
    nodeView,
    select: select as FakeDomElement,
    currentDoc: () => state.doc,
  };
}

describe('DitaNoteNodeView hides its type selector for read-only documents', () => {
  afterEach(() => {
    // `withFakeDocument` always restores the global, nothing else to clean up here.
  });

  it('disables the note-type select when the document is not editable', () => {
    withFakeDocument(() => {
      const registry = new SemanticViewRegistry();
      const { select } = buildNoteNodeView(() => true, registry);
      expect(select.disabled).toBe(true);
    });
  });

  it('re-enables the select as soon as the document is checked out (registry notification)', () => {
    withFakeDocument(() => {
      const registry = new SemanticViewRegistry();
      let readOnly = true;
      const { select } = buildNoteNodeView(() => readOnly, registry);
      expect(select.disabled).toBe(true);

      readOnly = false;
      registry.notifyAll();
      expect(select.disabled).toBe(false);

      readOnly = true;
      registry.notifyAll();
      expect(select.disabled).toBe(true);
    });
  });

  it('ignores the change event entirely while read-only', () => {
    withFakeDocument(() => {
      const registry = new SemanticViewRegistry();
      const { select, currentDoc } = buildNoteNodeView(() => true, registry);

      select.value = 'warning';
      select.dispatch('change');

      const noteNode = currentDoc().child(0).child(1).child(1);
      expect(noteNode.type.name).toBe('dita_note');
      expect(getRawAttr(getPmNodeRawAttrs(noteNode), 'type')).toBe('tip');
      expect(pmDocToXml(currentDoc())).toBe(pmDocToXml(xmlToPmDoc(NOTE_XML).pmDoc));
    });
  });

  it('applies the type change once the document is editable again', () => {
    withFakeDocument(() => {
      const registry = new SemanticViewRegistry();
      const { select, currentDoc } = buildNoteNodeView(() => false, registry);

      select.value = 'warning';
      select.dispatch('change');

      const noteNode = currentDoc().child(0).child(1).child(1);
      expect(getRawAttr(getPmNodeRawAttrs(noteNode), 'type')).toBe('warning');
    });
  });

  it('unsubscribes from the semantic registry on destroy()', () => {
    withFakeDocument(() => {
      const registry = new SemanticViewRegistry();
      let readOnly = false;
      const { nodeView, select } = buildNoteNodeView(() => readOnly, registry);
      expect(select.disabled).toBe(false);

      (nodeView as NodeView).destroy?.(nodeView.dom as unknown as never, false);

      readOnly = true;
      registry.notifyAll();
      // No listener left: the select keeps its last synced state instead of flipping to disabled.
      expect(select.disabled).toBe(false);
    });
  });
});

describe('TopicInspector opens on the AI tab', () => {
  const renderInspector = () =>
    renderToStaticMarkup(
      <TopicInspector
        tab="ai"
        onTabChange={() => {}}
        attributes={{} as unknown as AttributesPanelProps}
        reuse={{} as unknown as ConrefReusePanelProps}
        ai={<div id="ai-slot">assistant</div>}
      />,
    );

  it('marks the AI tab active first and renders the assistant slot', () => {
    const html = renderInspector();
    const tabs = [
      ...html.matchAll(
        /<button[^>]*role="tab"[^>]*aria-selected="(true|false)"[^>]*>([\s\S]*?)<\/button>/g,
      ),
    ];
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.[1]).toBe('true');
    expect(tabs[0]?.[2]).toContain(t('inspector.tab.ai'));
    expect(tabs.slice(1).every((match) => match[1] === 'false')).toBe(true);
    expect(html).toContain('<div id="ai-slot">assistant</div>');
  });
});

describe('workbench defaults the right inspector to the AI tab', () => {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

  it('initialises inspectorTab to "ai" and derives aiPanelVisible from the layout', () => {
    expect(appSource).toContain("useState<InspectorTab>('ai')");
    expect(appSource).toContain(
      "showRightInspector && inspectorTarget !== 'map-node' && inspectorTab === 'ai'",
    );
  });

  it('no longer selects the AI store panelOpen flag in App.tsx', () => {
    expect(appSource).not.toContain('aiPanelOpen');
    expect(appSource).not.toContain('state.panelOpen');
  });
});
