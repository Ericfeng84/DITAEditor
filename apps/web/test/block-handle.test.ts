import { describe, expect, it } from 'vitest';
import { EditorState, type Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { getElementSpec, pmDocToXml, xmlToPmDoc } from '@dita/core';
import {
  convertDitaBlockAtPos,
  deleteDitaNodeAtPos,
  duplicateDitaBlockAtPos,
  moveDitaBlockToGap,
} from '../src/editor/visual/commands';
import {
  blockIndexInContainer,
  buildConvertedBlock,
  canDuplicateBlock,
  computeBlockGaps,
  findBlockHandleTarget,
  findBlockHandleTargetForNode,
  getBlockConvertOptions,
  isBlockMoveOrderSafe,
  planBlockMove,
} from '../src/editor/visual/block-transforms';

const TOPIC_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">`;
const TASK_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">`;

function buildState(bodyXml: string): EditorState {
  const xml = `${TOPIC_HEAD}
<topic id="handle_test"><title>Handle Test</title><body>${bodyXml}</body></topic>`;
  const { pmDoc } = xmlToPmDoc(xml);
  return EditorState.create({ doc: pmDoc });
}

function buildTaskState(taskBodyXml: string): EditorState {
  const xml = `${TASK_HEAD}
<task id="handle_task"><title>Handle Task</title><shortdesc>Summary</shortdesc><taskbody>${taskBodyXml}</taskbody></task>`;
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

describe('explicit block handle targets (tag pill / breadcrumb selection)', () => {
  it('targets the <step> itself instead of the <cmd> nested inside it', () => {
    const state = buildTaskState(
      '<steps><step><cmd>one</cmd></step><step><cmd>two</cmd></step></steps>',
    );
    const step = findNode(state, 'dita_step');
    // A click inside the step pill puts the caret in the nested `<cmd>` text, so the caret walk
    // resolves the `<cmd>` and the step itself stays unreachable without an explicit selection.
    const caretTarget = findBlockHandleTarget(state, step.pos + 2);
    expect(caretTarget?.blockTag).toBe('cmd');

    const target = findBlockHandleTargetForNode(state, step.pos);
    expect(target?.blockTag).toBe('step');
    expect(target?.containerTag).toBe('steps');
    expect(target?.movable).toBe(true);
    expect(target?.deleteObstacle).toBeNull();
    expect(blockIndexInContainer(target!)).toBe(0);
    expect(canDuplicateBlock('steps', target!.containerNode, 'step')).toBe(true);
  });

  it('exposes <taskbody> with a blocked delete and no drag', () => {
    const state = buildTaskState('<steps><step><cmd>one</cmd></step></steps>');
    const taskbody = findNode(state, 'dita_taskbody');
    const target = findBlockHandleTargetForNode(state, taskbody.pos);
    expect(target?.blockTag).toBe('taskbody');
    expect(target?.containerTag).toBe('task');
    expect(target?.movable).toBe(false);
    // Editor policy code: DITA 1.3 keeps `<taskbody>` optional, the editor still refuses.
    expect(target?.deleteObstacle?.code).toBe('required-policy');
    // structural blocks keep their document order
    expect(canDuplicateBlock('task', target!.containerNode, 'taskbody')).toBe(false);
  });

  it('exposes <shortdesc> (pinned, deletable) and refuses the root <title>', () => {
    const state = buildTaskState('<steps><step><cmd>one</cmd></step></steps>');
    const shortdesc = findNode(state, 'dita_shortdesc');
    const target = findBlockHandleTargetForNode(state, shortdesc.pos);
    expect(target?.blockTag).toBe('shortdesc');
    expect(target?.containerTag).toBe('task');
    expect(target?.movable).toBe(false);
    expect(target?.deleteObstacle).toBeNull();

    const title = findNode(state, 'dita_title');
    const titleTarget = findBlockHandleTargetForNode(state, title.pos);
    expect(titleTarget?.blockTag).toBe('title');
    expect(titleTarget?.deleteObstacle?.code).toBe('required-child');
    // The caret-based walk still ignores the topic title (it never becomes draggable).
    expect(findBlockHandleTarget(state, title.pos + 1)).toBeNull();
  });

  it('ignores the document root and inline nodes', () => {
    const state = buildState('<p>one <b>bold</b></p>');
    expect(findBlockHandleTargetForNode(state, 0)).toBeNull();
    const bold = findNode(state, 'dita_b');
    expect(findBlockHandleTargetForNode(state, bold.pos)).toBeNull();
  });
});

describe('structure-aware delete', () => {
  it('refuses removing <taskbody> but deletes an optional <shortdesc>', () => {
    const state = buildTaskState('<steps><step><cmd>one</cmd></step></steps>');
    const taskbody = findNode(state, 'dita_taskbody');
    expect(deleteDitaNodeAtPos(taskbody.pos)(state, () => {})).toBe(false);

    const shortdesc = findNode(state, 'dita_shortdesc');
    const next = runCmd(state, deleteDitaNodeAtPos(shortdesc.pos));
    expect(pmDocToXml(next.doc)).not.toContain('<shortdesc>');
  });

  it('refuses the last <step> of <steps> and allows removing a duplicate one', () => {
    const single = buildTaskState('<steps><step><cmd>one</cmd></step></steps>');
    const onlyStep = findNode(single, 'dita_step');
    expect(deleteDitaNodeAtPos(onlyStep.pos)(single, () => {})).toBe(false);

    const twoSteps = buildTaskState(
      '<steps><step><cmd>one</cmd></step><step><cmd>two</cmd></step></steps>',
    );
    const first = findNode(twoSteps, 'dita_step');
    const secondPos = first.pos + first.node.nodeSize;
    const next = runCmd(twoSteps, deleteDitaNodeAtPos(secondPos));
    const xml = pmDocToXml(next.doc);
    expect(xml).toContain('<cmd>one</cmd>');
    expect(xml).not.toContain('<cmd>two</cmd>');
  });

  it('refuses deleting a required <cmd> and the root <title>', () => {
    const state = buildTaskState('<steps><step><cmd>one</cmd></step></steps>');
    const cmd = findNode(state, 'dita_cmd');
    expect(deleteDitaNodeAtPos(cmd.pos)(state, () => {})).toBe(false);
    const title = findNode(state, 'dita_title');
    expect(deleteDitaNodeAtPos(title.pos)(state, () => {})).toBe(false);
  });
});

describe('order-safe reordering', () => {
  it('keeps taskbody workflow slots in order', () => {
    expect(isBlockMoveOrderSafe('taskbody', ['prereq', 'steps'], 0, 2)).toBe(false);
    expect(isBlockMoveOrderSafe('taskbody', ['context', 'prereq'], 1, 0)).toBe(true);
    expect(isBlockMoveOrderSafe('body', ['p', 'p'], 0, 2)).toBe(true);
    expect(isBlockMoveOrderSafe('steps', ['step', 'step'], 0, 2)).toBe(true);
  });

  it('refuses a drag that would move <prereq> behind <steps>', () => {
    const state = buildTaskState(
      '<prereq><p>pre</p></prereq><steps><step><cmd>one</cmd></step></steps>',
    );
    const prereq = findNode(state, 'dita_prereq');
    const taskbody = findNode(state, 'dita_taskbody');
    const endGap = taskbody.pos + taskbody.node.nodeSize - 1;
    expect(moveDitaBlockToGap(prereq.pos, endGap)(state, () => {})).toBe(false);
  });
});
