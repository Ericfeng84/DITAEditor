import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { pmDocToXml, xmlToPmDoc } from '@dita/core';
import { toggleInlineDitaElement } from '../src/editor/visual/commands';
import { getInlineBubbleInfo } from '../src/editor/visual/inline-selection';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="inline-bubble"><title>行内元素</title><body><p>前面<b>加粗</b>中间<i>斜体</i>末尾</p><p>第二段</p><codeblock>code here</codeblock></body></topic>`;

function loadDoc(xml = XML): PMNode {
  return xmlToPmDoc(xml, { position: false }).pmDoc;
}

/** Position of the first occurrence of `needle`, plus a character offset inside it. */
function posOf(doc: PMNode, needle: string, offset = 0): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText && node.text) {
      const index = node.text.indexOf(needle);
      if (index >= 0) {
        found = pos + index + offset;
        return false;
      }
    }
    return true;
  });
  if (found < 0) throw new Error(`未找到文本：${needle}`);
  return found;
}

function stateWithRange(doc: PMNode, from: number, to: number): EditorState {
  const state = EditorState.create({ doc });
  return state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, from, to)),
  );
}

function applyCommand(state: EditorState, cmd: ReturnType<typeof toggleInlineDitaElement>): EditorState {
  let next = state;
  cmd(state, (tr) => {
    next = state.apply(tr);
  });
  return next;
}

describe('getInlineBubbleInfo', () => {
  it('在段落文本选区上显示快捷工具栏，并给出合法的行内元素', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, '前面'), posOf(doc, '末尾'));

    const info = getInlineBubbleInfo(state);

    expect(info.visible).toBe(true);
    expect(info.contextTag).toBe('p');
    const tags = info.items.map((spec) => spec.tag);
    expect(tags.slice(0, 4)).toEqual(['b', 'i', 'u', 'codeph']);
    expect(tags.some((tag) => tag === 'keyword')).toBe(true);
  });

  it('光标折叠时隐藏', () => {
    const doc = loadDoc();
    const from = posOf(doc, '前面');
    const info = getInlineBubbleInfo(stateWithRange(doc, from, from));
    expect(info.visible).toBe(false);
  });

  it('跨段落的选区不显示', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, '前面'), posOf(doc, '第二段', 2));
    expect(getInlineBubbleInfo(state).visible).toBe(false);
  });

  it('codeblock 内的选区不显示', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, 'code'), posOf(doc, 'code') + 4);
    expect(getInlineBubbleInfo(state).visible).toBe(false);
  });

  it('选区落在既有行内元素内时标记为激活状态', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, '加粗'), posOf(doc, '加粗') + 2);

    const info = getInlineBubbleInfo(state);

    expect(info.visible).toBe(true);
    expect(info.activeTags.has('b')).toBe(true);
    expect(info.items.some((spec) => spec.tag === 'b')).toBe(true);
  });
});

describe('toggleInlineDitaElement on a highlighted range', () => {
  it('保留选区内既有行内元素且不会产生同名嵌套', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, '前面', 1), posOf(doc, '末尾'));

    const next = applyCommand(state, toggleInlineDitaElement('b'));
    const xml = pmDocToXml(next.doc);

    expect(xml).toContain('<b>面加粗中间<i>斜体</i></b>');
    expect(xml).not.toContain('<b><b>');
  });

  it('再次应用同一元素会解包外层包装并保留其他行内元素', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, '前面', 1), posOf(doc, '末尾'));

    const wrapped = applyCommand(state, toggleInlineDitaElement('b'));
    const unwrapped = applyCommand(wrapped, toggleInlineDitaElement('b'));
    const xml = pmDocToXml(unwrapped.doc);

    expect(xml).toContain('<p>前面加粗中间<i>斜体</i>末尾</p>');
    // The unwrapped text stays selected so the bubble reflects the new (unpressed) state
    expect(unwrapped.selection.from).toBeLessThan(unwrapped.selection.to);
    expect(
      unwrapped.doc.textBetween(unwrapped.selection.from, unwrapped.selection.to, '', ''),
    ).toBe('面加粗中间斜体');
  });

  it('部分覆盖的行内元素保持包裹文本而不丢失内容', () => {
    const doc = loadDoc();
    const state = stateWithRange(doc, posOf(doc, '加粗', 1), posOf(doc, '斜体', 1));

    const next = applyCommand(state, toggleInlineDitaElement('codeph'));
    const xml = pmDocToXml(next.doc);

    expect(xml).not.toContain('<codeph><codeph>');
    expect(xml).toContain('<codeph><b>粗</b>中间<i>斜</i></codeph>');
  });
});
