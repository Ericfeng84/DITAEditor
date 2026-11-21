import { describe, expect, it } from 'vitest';
import { EditorState, type Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { getElementSpec, pmDocToXml, xmlToPmDoc } from '@dita/core';
import {
  convertDitaBlockAtPos,
  duplicateDitaBlockAtPos,
  moveDitaBlockToGap,
} from '../src/editor/visual/commands';
import {
  buildConvertedBlock,
  computeBlockGaps,
  findBlockHandleTarget,
  getBlockConvertOptions,
  planBlockMove,
} from '../src/editor/visual/block-transforms';

const TOPIC_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">`;

function buildState(bodyXml: string): EditorState {
  const xml = `${TOPIC_HEAD}
<topic id="handle_test"><title>Handle Test</title><body>${bodyXml}</body></topic>`;
  const { pmDoc } = xmlToPmDoc(xml);
  return EditorState.create({ doc: pmDoc });
}

function findNode(state: EditorState, typeName: string, text?: string): { pos: number; node: PMNode } {
  let found: { pos: number; node: PMNode } | null = null;
  state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name !== typeName) return true;
    if (text !== undefined && node.textContent !== text) return true;
    found = { pos, node };
    return false;
  });
  if (!found) throw new Error(`Node ${typeName} (${text ?? ''}) not found`);
  return found;
}

function gapAt(gaps: number[], index: number): number {
  const gap = gaps[index];
  if (gap === undefined) throw new Error(`Missing gap ${index}`);
  return gap;
}

function runCmd(state: EditorState, cmd: Command): EditorState {
  let next = state;
  const ok = cmd(state, (tr) => {
    next = state.apply(tr);
  });
  expect(ok).toBe(true);
  return next;
}

describe('Notion-style block handle target resolution', () => {
  it('targets the paragraph inside <body>', () => {
    const state = buildState('<p>one</p><p>two</p>');
    const { pos } = findNode(state, 'dita_p', 'one');
    const target = findBlockHandleTarget(state, pos + 1);
    expect(target).not.toBeNull();
    expect(target?.blockTag).toBe('p');
    expect(target?.containerTag).toBe('body');
    expect(target?.blockPos).toBe(pos);
  });

  it('targets the <li> when the caret sits in list item text', () => {
    const state = buildState('<ul><li>alpha</li><li>beta</li></ul>');
    const { pos } = findNode(state, 'dita_li', 'beta');
    const target = findBlockHandleTarget(state, pos + 1);
    expect(target?.blockTag).toBe('li');
    expect(target?.containerTag).toBe('ul');
  });

  it('targets the section paragraph and uses the section as container', () => {
    const state = buildState('<section><title>S</title><p>inner</p></section>');
    const { pos } = findNode(state, 'dita_p', 'inner');
    const target = findBlockHandleTarget(state, pos + 1);
    expect(target?.blockTag).toBe('p');
    expect(target?.containerTag).toBe('section');
  });

  it('never exposes the topic title or prolog as draggable blocks', () => {
    const state = buildState('<p>one</p>');
    const title = findNode(state, 'dita_title');
    expect(findBlockHandleTarget(state, title.pos + 1)).toBeNull();
  });
});

describe('block gaps and move planning', () => {
  it('produces one gap per child boundary and plans a move', () => {
    const state = buildState('<p>one</p><p>two</p><p>three</p>');
    const body = findNode(state, 'dita_body');
    const gaps = computeBlockGaps(body.pos, body.node);
    expect(gaps).toHaveLength(body.node.childCount + 1);
    expect(gaps[0]).toBe(body.pos + 1);

    const first = findNode(state, 'dita_p', 'one');
    expect(planBlockMove(first.pos, first.node.nodeSize, gapAt(gaps, 0))).toBeNull();
    expect(planBlockMove(first.pos, first.node.nodeSize, gapAt(gaps, 1))).toBeNull();
    expect(planBlockMove(first.pos, first.node.nodeSize, gapAt(gaps, 3))).toEqual({
      from: first.pos,
      to: first.pos + first.node.nodeSize,
      insertAt: gapAt(gaps, 3) - first.node.nodeSize,
    });
  });
});

describe('block conversion options', () => {
  it('offers only content-model-safe targets for a paragraph in <body>', () => {
    const state = buildState('<p>one</p>');
    const p = findNode(state, 'dita_p', 'one');
    const options = getBlockConvertOptions(p.node, 'body');
    const tags = options.map((option) => option.spec.tag);
    expect(tags).toContain('note');
    expect(tags).toContain('codeblock');
    expect(tags).not.toContain('p');
    expect(tags).not.toContain('li');
    expect(tags).not.toContain('title');
    expect(tags).not.toContain('tgroup');

    const note = options.find((option) => option.spec.tag === 'note');
    expect(note?.mode).toBe('wrap-inline');
    const codeblock = options.find((option) => option.spec.tag === 'codeblock');
    expect(codeblock?.mode).toBe('text');
  });

  it('builds wrapped and text-only conversions', () => {
    const state = buildState('<p>one</p>');
    const p = findNode(state, 'dita_p', 'one');
    const noteXml = pmDocToXml(
      state.tr.replaceWith(
        p.pos,
        p.pos + p.node.nodeSize,
        buildConvertedBlock(p.node, getElementSpec('note')!)!,
      ).doc,
    );
    expect(noteXml).toContain('<note>');
    expect(noteXml).toContain('<p>one</p>');

    const codeXml = pmDocToXml(
      state.tr.replaceWith(
        p.pos,
        p.pos + p.node.nodeSize,
        buildConvertedBlock(p.node, getElementSpec('codeblock')!)!,
      ).doc,
    );
    expect(codeXml).toContain('<codeblock>one</codeblock>');
  });
});

describe('block handle commands', () => {
  it('converts a paragraph into a codeblock and keeps its text', () => {
    const state = buildState('<p>one</p>');
    const p = findNode(state, 'dita_p', 'one');
    const next = runCmd(state, convertDitaBlockAtPos('codeblock', p.pos));
    const xml = pmDocToXml(next.doc);
    expect(xml).toContain('<codeblock>one</codeblock>');
    expect(xml).not.toContain('<p>one</p>');
  });

  it('refuses conversions that are invalid for the container', () => {
    const state = buildState('<p>one</p>');
    const p = findNode(state, 'dita_p', 'one');
    expect(convertDitaBlockAtPos('li', p.pos)(state, () => {})).toBe(false);
    expect(convertDitaBlockAtPos('p', p.pos)(state, () => {})).toBe(false);
  });

  it('duplicates a block right below itself', () => {
    const state = buildState('<p>one</p><p>two</p>');
    const p = findNode(state, 'dita_p', 'one');
    const next = runCmd(state, duplicateDitaBlockAtPos(p.pos));
    const xml = pmDocToXml(next.doc);
    const occurrences = xml.match(/<p>one<\/p>/g) ?? [];
    expect(occurrences).toHaveLength(2);
    expect(xml.indexOf('<p>one</p>')).toBeLessThan(xml.lastIndexOf('<p>two</p>'));
  });

  it('moves a block into another gap of its container', () => {
    const state = buildState('<p>one</p><p>two</p><p>three</p>');
    const body = findNode(state, 'dita_body');
    const gaps = computeBlockGaps(body.pos, body.node);
    const first = findNode(state, 'dita_p', 'one');
    const next = runCmd(state, moveDitaBlockToGap(first.pos, gapAt(gaps, 3)));
    const xml = pmDocToXml(next.doc);
    expect(xml.indexOf('<p>two</p>')).toBeLessThan(xml.indexOf('<p>three</p>'));
    expect(xml.indexOf('<p>three</p>')).toBeLessThan(xml.indexOf('<p>one</p>'));
  });
});
