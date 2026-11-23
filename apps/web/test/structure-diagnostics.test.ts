import { describe, expect, it } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState as CmEditorState } from '@codemirror/state';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import type { DecorationSet } from 'prosemirror-view';
import {
  checkXmlStructure,
  getPmNodeTagName,
  pmDocToXml,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '@dita/core';
import {
  insertBlockDitaElement,
  insertBlockDitaElementAtPos,
} from '../src/editor/visual/commands';
import {
  findLegalAncestorDepthForBlock,
  getSelectionSnapshot,
} from '../src/editor/visual/selection-info';
import {
  collectDitaDecorations,
  type DitaDecorationsCallbacks,
} from '../src/editor/visual/decorations';
import {
  createDitaStructurePlugin,
  DITA_STRUCTURE_KEY,
} from '../src/editor/visual/structure-decorations';
import { describeStructureIssue } from '../src/editor/structure-messages';
import { ditaXmlCompletionSource } from '../src/editor/source/dita-completion';

const noopCallbacks: DitaDecorationsCallbacks = {
  onSelectTagNode: () => {},
  onQuickInsertBlock: () => {},
  onOpenGapInsertMenu: () => {},
};

function makeState(xml: string): EditorState {
  const { pmDoc } = xmlToPmDoc(xml);
  return EditorState.create({ doc: pmDoc });
}

function runCmd(state: EditorState, cmd: Command): { state: EditorState; ok: boolean } {
  let nextState = state;
  const ok = cmd(state, (tr) => {
    nextState = state.apply(tr);
  });
  return { state: nextState, ok };
}

/** Put the cursor inside the first textblock whose ancestor chain contains `tagName`. */
function cursorIntoTag(state: EditorState, tagName: string): EditorState {
  let target = -1;
  state.doc.descendants((node, pos) => {
    if (target >= 0) return false;
    if (!node.isTextblock) return true;
    const $pos = state.doc.resolve(pos + 1);
    for (let depth = $pos.depth; depth >= 0; depth--) {
      if (getPmNodeTagName($pos.node(depth)) === tagName) {
        target = pos + 1;
        return false;
      }
    }
    return true;
  });
  expect(target).toBeGreaterThan(0);
  return state.apply(state.tr.setSelection(TextSelection.create(state.doc, target)));
}

const MISORDERED_TASK = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="t1"><title>Deploy</title><taskbody><postreq><p>Cleanup</p></postreq><steps><step><info>Read this</info><cmd>Click</cmd></step></steps></taskbody></task>`;

describe('DITA 1.3 ordered content-model diagnostics (web wiring)', () => {
  it('places a new <prereq> before an existing out-of-order <postreq>', () => {
    const state = cursorIntoTag(makeState(MISORDERED_TASK), 'taskbody');
    const { state: next, ok } = runCmd(state, insertBlockDitaElement('prereq'));
    expect(ok).toBe(true);
    const xml = pmDocToXml(next.doc);
    expect(xml.indexOf('<prereq')).toBeGreaterThan(-1);
    expect(xml.indexOf('<prereq')).toBeLessThan(xml.indexOf('<postreq'));
  });

  it('keeps <step> children in DTD order when inserting <cmd> last', () => {
    const xml = `<task id="t"><title>T</title><taskbody><steps><step><info>hint</info></step></steps></taskbody></task>`;
    const state = cursorIntoTag(makeState(xml), 'step');
    const { state: next, ok } = runCmd(state, insertBlockDitaElement('cmd'));
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    expect(out.indexOf('<cmd')).toBeGreaterThan(-1);
    expect(out.indexOf('<cmd')).toBeLessThan(out.indexOf('<info'));
  });

  it('re-anchors a gap-inserted <prereq> to its legal slot instead of the clicked gap', () => {
    const xml = `<task id="t"><title>T</title><taskbody><steps><step><cmd>a</cmd></step></steps></taskbody></task>`;
    const state = makeState(xml);
    // Gap directly AFTER <steps> — placing <prereq> there would violate the taskbody sequence.
    let stepsEnd = -1;
    state.doc.descendants((node, pos) => {
      if (stepsEnd < 0 && getPmNodeTagName(node) === 'steps') stepsEnd = pos + node.nodeSize;
      return true;
    });
    expect(stepsEnd).toBeGreaterThan(0);
    const { state: next, ok } = runCmd(state, insertBlockDitaElementAtPos('prereq', stepsEnd));
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    expect(out.indexOf('<prereq')).toBeLessThan(out.indexOf('<steps'));
    expect(checkXmlStructure(out)).toMatchObject({ ok: true, issues: [] });
  });

  it('preserves in-place insertion in the middle of repeating lists (<ul>/<li> and <steps>/<step>)', () => {
    const listXml = `<concept id="c"><title>T</title><conbody><ul><li>First</li><li>Second</li><li>Third</li></ul></conbody></concept>`;
    const state = makeState(listXml);
    // Find exact gap directly after the first <li>
    let afterFirstLi = -1;
    state.doc.descendants((node, pos) => {
      if (afterFirstLi < 0 && getPmNodeTagName(node) === 'li') afterFirstLi = pos + node.nodeSize;
      return true;
    });
    expect(afterFirstLi).toBeGreaterThan(0);
    const { state: next, ok } = runCmd(
      state,
      insertBlockDitaElementAtPos('li', afterFirstLi, [
        { name: 'id', value: 'mid_li', namespaceURI: null },
      ]),
    );
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    expect(out.indexOf('First')).toBeLessThan(out.indexOf('id="mid_li"'));
    expect(out.indexOf('id="mid_li"')).toBeLessThan(out.indexOf('Second'));

    // Also verify cursor-based `/` insertion inside first <li> inserts right after it (not at list end)
    const cursorInFirst = cursorIntoTag(state, 'li');
    const { state: nextSlash, ok: okSlash } = runCmd(
      cursorInFirst,
      insertBlockDitaElement('li', undefined, [
        { name: 'id', value: 'slash_li', namespaceURI: null },
      ]),
    );
    expect(okSlash).toBe(true);
    const outSlash = pmDocToXml(nextSlash.doc);
    expect(outSlash.indexOf('First')).toBeLessThan(outSlash.indexOf('id="slash_li"'));
    expect(outSlash.indexOf('id="slash_li"')).toBeLessThan(outSlash.indexOf('Second'));
  });

  it('refuses to insert a second single-occurrence child and skips full inner containers when finding ancestors', () => {
    const state = makeState(MISORDERED_TASK);
    const withTitle = cursorIntoTag(state, 'task');
    const { ok } = runCmd(withTitle, insertBlockDitaElement('title'));
    expect(ok).toBe(false);

    // <fig> already has a <title>, while its enclosing <section> does not.
    const nestedXml = `<concept id="c"><title>T</title><conbody><section><fig><title>Fig</title><p>cap</p></fig></section></conbody></concept>`;
    const nestedState = cursorIntoTag(makeState(nestedXml), 'fig');
    const depth = findLegalAncestorDepthForBlock(nestedState, 'title');
    expect(depth).not.toBeNull();
    expect(getPmNodeTagName(nestedState.selection.$from.node(depth!))).toBe('section');
  });

  it('offers only one of the mutually exclusive steps | steps-unordered slots', () => {
    const xml = `<task id="t"><title>T</title><taskbody><steps><step><cmd>a</cmd></step></steps></taskbody></task>`;
    const state = cursorIntoTag(makeState(xml), 'taskbody');
    const snapshot = getSelectionSnapshot(state);
    const offered = snapshot.insertGroups.flatMap((group) => group.items.map((item) => item.tag));
    expect(offered).toContain('result');
    expect(offered).not.toContain('steps');
    expect(offered).not.toContain('steps-unordered');
  });

  it('updates between-block gap widget keys when single-occurrence slots fill and keeps the + more menu when only non-quick tags remain', () => {
    const partialTask = `<task id="t"><title>T</title><taskbody><prereq><p>A</p></prereq></taskbody></task>`;
    const filledQuickTask = `<task id="t"><title>T</title><taskbody><prereq><p>A</p></prereq><context><p>B</p></context><steps><step><cmd>C</cmd></step></steps><result><p>D</p></result><postreq><p>E</p></postreq></taskbody></task>`;

    const beforeKeys = collectDitaDecorations(xmlToPmDoc(partialTask).pmDoc, 'none', null, noopCallbacks)
      .find()
      .map((d) => String(d.spec.key ?? ''))
      .filter((k) => k.includes('-taskbody-'));
    const afterKeys = collectDitaDecorations(xmlToPmDoc(filledQuickTask).pmDoc, 'none', null, noopCallbacks)
      .find()
      .map((d) => String(d.spec.key ?? ''))
      .filter((k) => k.includes('-taskbody-'));

    // `example` is still insertable even after all 5 quick tags are filled -> gap widgets must stay present (`hasMore = 1`).
    expect(beforeKeys.length).toBeGreaterThan(0);
    expect(afterKeys.length).toBeGreaterThan(0);
    expect(beforeKeys[0]).not.toBe(afterKeys[0]);
    expect(afterKeys[0]).toContain('-1-');
  });

  it('filters already-filled single-occurrence and exclusive tags in CodeMirror XML source completion', () => {
    const doc = '<task id="t"><title>T</title><taskbody><steps><step><cmd>a</cmd></step></steps><';
    const cmState = CmEditorState.create({ doc });
    const res = ditaXmlCompletionSource(new CompletionContext(cmState, doc.length, true));
    expect(res).not.toBeNull();
    const labels = res!.options.map((o) => o.label);
    expect(labels).toContain('result');
    expect(labels).not.toContain('steps');
    expect(labels).not.toContain('steps-unordered');
  });

  it('decorates only the offending node and never mutates the document', () => {
    const { pmDoc } = xmlToPmDoc(MISORDERED_TASK);
    const before = pmDocToXml(pmDoc);
    const state = EditorState.create({ doc: pmDoc, plugins: [createDitaStructurePlugin('zh-CN')] });

    const pluginState = DITA_STRUCTURE_KEY.getState(state);
    expect(pluginState).toBeTruthy();
    const decorations: DecorationSet = pluginState!.decorations;
    const found = decorations.find();
    expect(found.length).toBeGreaterThan(0);
    const codes = found.map(
      (decoration) =>
        (decoration as unknown as { type: { attrs?: Record<string, string> } }).type.attrs?.[
          'data-structure-code'
        ],
    );
    expect(codes).toContain('child-out-of-order');
    for (const decoration of found) {
      expect(decoration.from).toBeLessThan(decoration.to);
    }
    // Diagnostics are read-only overlays: the ProseMirror doc keeps its lossless round-trip.
    expect(pmDocToXml(state.doc)).toBe(before);
  });

  it('reports the same violations through the XML-level checker used by the source linter', () => {
    const result = checkXmlStructure(MISORDERED_TASK);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain('child-out-of-order');
    const offender = result.issues.find((issue) => issue.childTag === 'steps');
    expect(offender).toBeTruthy();
    expect(offender!.line).toBeGreaterThan(0);
    expect(offender!.endOffset).toBeGreaterThan(offender!.offset);
  });

  it('localizes structure messages in both UI languages', () => {
    const issue = {
      code: 'child-out-of-order' as const,
      parentTag: 'taskbody',
      childTag: 'prereq',
      expectedTags: ['postreq'],
    };
    expect(describeStructureIssue(issue, 'zh-CN')).toContain('<prereq>');
    expect(describeStructureIssue(issue, 'en')).toContain('out of order');
  });

  it('keeps a valid document free of structure issues', () => {
    const xml = `<task id="t"><title>T</title><taskbody><prereq><p>a</p></prereq><steps><step><cmd>a</cmd><info>b</info></step></steps><result><p>c</p></result></taskbody></task>`;
    const { pmDoc } = xmlToPmDoc(xml);
    expect(validatePmStructure(pmDoc)).toHaveLength(0);
    expect(validateChildSequence('taskbody', ['prereq', 'steps', 'result'])).toHaveLength(0);
    const checked = checkXmlStructure(xml);
    expect(checked.ok && checked.issues).toHaveLength(0);
  });
});
