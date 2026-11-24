import { describe, expect, it } from 'vitest';
import { EditorState, type Command } from 'prosemirror-state';
import { createTopicTemplate, pmDocToXml, xmlToPmDoc, type RawAttrs } from '@dita/core';
import { insertReuseElementAtPos } from '../src/editor/visual/commands';
import {
  buildConrefDragSnippet,
  escapeXmlAttrValue,
  parseConrefDragPayload,
} from '../src/editor/visual/conref-drag';

const CONKEYREF_ATTRS: RawAttrs = [
  { name: 'conkeyref', value: 'common_reuse/backup_warning', namespaceURI: null },
];

function runCmd(state: EditorState, cmd: Command): EditorState | null {
  let nextState: EditorState | null = null;
  const ok = cmd(state, (tr) => {
    nextState = state.apply(tr);
  });
  return ok ? nextState : null;
}

function dropState(): EditorState {
  const xml = createTopicTemplate('topic', { id: 'drop_test', title: 'Drop Test', lang: 'en' });
  const { pmDoc } = xmlToPmDoc(xml);
  return EditorState.create({ doc: pmDoc });
}

function findFirst(state: EditorState, nodeTypeName: string): number {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.type.name === nodeTypeName) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

describe('conref drag payload', () => {
  it('builds an empty XML snippet for the source view drop', () => {
    expect(
      buildConrefDragSnippet({
        tagName: 'note',
        attrName: 'conkeyref',
        value: 'common_reuse/backup_warning',
      }),
    ).toBe('<note conkeyref="common_reuse/backup_warning"/>');
  });

  it('escapes attribute values', () => {
    expect(escapeXmlAttrValue('a&b<c>"d"')).toBe('a&amp;b&lt;c&gt;&quot;d&quot;');
  });

  it('rejects malformed or incomplete payloads', () => {
    expect(parseConrefDragPayload('')).toBeNull();
    expect(parseConrefDragPayload('not json')).toBeNull();
    expect(parseConrefDragPayload(JSON.stringify({ tagName: 'note' }))).toBeNull();
    expect(
      parseConrefDragPayload(
        JSON.stringify({ tagName: 'note', attrName: 'href', value: 'x' }),
      ),
    ).toBeNull();
    expect(
      parseConrefDragPayload(
        JSON.stringify({ tagName: 'note', attrName: 'conref', value: 'x' }),
      ),
    ).toEqual({ tagName: 'note', attrName: 'conref', value: 'x' });
  });
});

describe('insertReuseElementAtPos', () => {
  it('inserts a block reuse element as a sibling after the paragraph at the drop point', () => {
    const state = dropState();
    const pPos = findFirst(state, 'dita_p');
    expect(pPos).toBeGreaterThan(0);

    const next = runCmd(state, insertReuseElementAtPos('note', pPos + 1, CONKEYREF_ATTRS));
    expect(next).not.toBeNull();

    const xml = pmDocToXml(next!.doc);
    expect(xml).toContain('<note conkeyref="common_reuse/backup_warning"');
    // Never nested inside the paragraph that was under the cursor.
    expect(xml).not.toMatch(/<p[^>]*>\s*<note/);
  });

  it('inserts an inline reuse element at the exact text offset', () => {
    const state = dropState();
    const pPos = findFirst(state, 'dita_p');
    expect(pPos).toBeGreaterThan(0);

    const next = runCmd(state, insertReuseElementAtPos('ph', pPos + 1, CONKEYREF_ATTRS));
    expect(next).not.toBeNull();

    const xml = pmDocToXml(next!.doc);
    expect(xml).toContain('<p><ph conkeyref="common_reuse/backup_warning"');
  });

  it('refuses a block drop that has no legal container (document root)', () => {
    const state = dropState();
    expect(runCmd(state, insertReuseElementAtPos('note', 0, CONKEYREF_ATTRS))).toBeNull();
  });
});
