import { describe, expect, it } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState as CmEditorState } from '@codemirror/state';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import type { DecorationSet } from 'prosemirror-view';
import {
  checkXmlStructure,
  DITA_CONTENT_MODEL,
  DITA_ELEMENT_SPECS,
  getPmNodeTagName,
  isChildAllowed,
  pmDocToXml,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '@dita/core';
import {
  createDitaElementSkeleton,
  handleDitaEnter,
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

  it('offers <properties> and <refbodydiv> in a reference body', () => {
    const xml = `<reference id="r"><title>R</title><refbody><section><title>S</title><p>x</p></section></refbody></reference>`;

    const inRefbody = getSelectionSnapshot(cursorIntoTag(makeState(xml), 'refbody'));
    const offeredInRefbody = inRefbody.insertGroups.flatMap((group) =>
      group.items.map((item) => item.tag),
    );
    expect(offeredInRefbody).toContain('properties');
    expect(offeredInRefbody).toContain('refbodydiv');

    // `section.cnt` has no `properties` (reference.mod), so the candidate source never yields it.
    expect(isChildAllowed('section', 'properties')).toBe(false);
    expect(isChildAllowed('refbody', 'properties')).toBe(true);
  });

  it('offers <bodydiv> and the related-links family from a topic body', () => {
    const xml = `<topic id="t"><title>T</title><body><p>x</p></body></topic>`;
    const offered = getSelectionSnapshot(cursorIntoTag(makeState(xml), 'body')).insertGroups.flatMap(
      (group) => group.items.map((item) => item.tag),
    );
    expect(offered).toContain('bodydiv');
    expect(offered).toContain('related-links');
    expect(offered).toContain('section');
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

  it('inserts a missing <taskbody> with an editable steps seed when a task arrives without one', () => {
    const state = cursorIntoTag(
      makeState(`<task id="t1"><title>task</title><shortdesc>desc</shortdesc></task>`),
      'shortdesc',
    );
    const { state: next, ok } = runCmd(state, insertBlockDitaElement('taskbody'));
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    expect(out).toContain('<taskbody>');
    expect(out.indexOf('<taskbody>')).toBeGreaterThan(out.indexOf('<shortdesc>'));
    // Strict task model has no `<p>` in `<taskbody>`: the seed must be a real <steps><step><cmd/>.
    expect(out).toContain('<steps>');
    expect(out).toContain('<cmd/>');
    expect(checkXmlStructure(out)).toMatchObject({ ok: true, issues: [] });
    expect(getPmNodeTagName(next.selection.$from.parent)).toBe('cmd');
  });

  it('inserts missing body wrappers (body / conbody / refbody) with editable content', () => {
    const cases: { xml: string; tag: string; expected: string }[] = [
      { xml: `<topic id="t"><title>T</title></topic>`, tag: 'body', expected: '<body>' },
      { xml: `<concept id="c"><title>T</title></concept>`, tag: 'conbody', expected: '<conbody>' },
      { xml: `<reference id="r"><title>T</title></reference>`, tag: 'refbody', expected: '<refbody>' },
    ];
    for (const { xml, tag, expected } of cases) {
      const state = cursorIntoTag(makeState(xml), 'title');
      const { state: next, ok } = runCmd(state, insertBlockDitaElement(tag));
      expect(ok, `insert ${tag}`).toBe(true);
      const out = pmDocToXml(next.doc);
      expect(out).toContain(expected);
      expect(checkXmlStructure(out)).toMatchObject({ ok: true, issues: [] });
      expect(next.selection.$from.parent.type.name).toMatch(/dita_(p|codeblock|title)/);
    }
  });

  it('creates the missing <taskbody> when pressing Enter at the end of <shortdesc>', () => {
    const state = cursorIntoTag(
      makeState(`<task id="t1"><title>task</title><shortdesc>desc</shortdesc></task>`),
      'shortdesc',
    );
    const atEnd = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, state.selection.$from.end()),
      ),
    );
    const { state: next, ok } = runCmd(atEnd, handleDitaEnter);
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    // Never `splitBlock` a single-occurrence <shortdesc> into two.
    expect(out.match(/<shortdesc>/g)).toHaveLength(1);
    expect(out).toContain('<taskbody>');
    expect(checkXmlStructure(out)).toMatchObject({ ok: true, issues: [] });
    expect(next.selection.$from.parent.type.name).toBe('dita_cmd');
  });

  it('creates the missing body wrapper from Enter at the end of a topic root <title>', () => {
    const state = cursorIntoTag(makeState(`<concept id="c"><title>T</title></concept>`), 'title');
    const atEnd = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, state.selection.$from.end())),
    );
    const { state: next, ok } = runCmd(atEnd, handleDitaEnter);
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out).toContain('<conbody>');
    expect(next.selection.$from.parent.type.name).toBe('dita_p');
    expect(checkXmlStructure(out)).toMatchObject({ ok: true, issues: [] });
  });

  it('provides insertable skeletons for the extended task containers', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['abstract', 'task'],
      ['tasktroubleshooting', 'taskbody'],
      ['stepsection', 'steps'],
      ['steptroubleshooting', 'step'],
      ['tutorialinfo', 'step'],
      ['itemgroup', 'step'],
      ['choicetable', 'step'],
      // Concept-body grammar (concept.mod) — DITA 1.3 divisions plus topic nesting.
      ['conbodydiv', 'conbody'],
      ['sectiondiv', 'section'],
      ['concept', 'concept'],
      // Reference-body grammar (reference.dtd) — parameter tables plus DITA 1.3 divisions.
      ['properties', 'refbody'],
      ['refbodydiv', 'refbody'],
      ['property', 'properties'],
      ['prophead', 'properties'],
      // Topic-body grammar (topic.dtd) — bodydiv plus the related-links family.
      ['bodydiv', 'body'],
      ['linklist', 'related-links'],
      ['linkpool', 'related-links'],
      ['linkinfo', 'linklist'],
      // Kept as a lossless passthrough node on purpose (unknown_block + exact DTD tag names).
      ['hazardstatement', 'body'],
    ];
    for (const [tag, parentTag] of cases) {
      const node = createDitaElementSkeleton(tag);
      expect(node, tag).not.toBeNull();
      expect(isChildAllowed(parentTag, tag), `${parentTag}>${tag}`).toBe(true);
      const spec = DITA_ELEMENT_SPECS.get(tag);
      expect(spec, tag).toBeDefined();
      expect(node!.type.name, tag).toBe(spec!.pmNodeType ?? 'unknown_block');
    }
    // `<steps-informal>` stays modeled for generalTask / ditabase documents even though the strict
    // taskbody model does not allow it, so it must still have an insertable skeleton.
    const informal = createDitaElementSkeleton('steps-informal');
    expect(informal).not.toBeNull();
    expect(informal!.type.name).toBe('dita_steps_informal');
    expect(isChildAllowed('taskbody', 'steps-informal')).toBe(false);

    // `<choicetable>` seeds one lossless chrow with choption / chdesc children.
    const choicetable = createDitaElementSkeleton('choicetable')!;
    const chrow = choicetable.child(0);
    expect(chrow.type.name).toBe('unknown_block');
    expect(chrow.attrs.tagName).toBe('chrow');
    expect(chrow.childCount).toBe(2);
    // `<hazardstatement>` seeds messagepanel > typeofhazard / consequence / howtoavoid.
    const hazard = createDitaElementSkeleton('hazardstatement')!;
    expect(hazard.attrs.tagName).toBe('hazardstatement');
    expect(hazard.attrs.rawAttrs).toEqual([{ name: 'type', value: 'warning', namespaceURI: null }]);
    const panel = hazard.child(0);
    expect(panel.attrs.tagName).toBe('messagepanel');
    expect(panel.childCount).toBe(3);

    // `<properties>` seeds a header row plus one parameter row with all three columns filled.
    const properties = createDitaElementSkeleton('properties')!;
    expect(properties.type.name).toBe('dita_properties');
    expect(properties.childCount).toBe(2);
    const prophead = properties.child(0);
    expect(prophead.type.name).toBe('dita_prophead');
    expect(prophead.childCount).toBe(3);
    expect([0, 1, 2].map((index) => prophead.child(index).type.name)).toEqual([
      'dita_proptypehd',
      'dita_propvaluehd',
      'dita_propdeschd',
    ]);
    const property = properties.child(1);
    expect(property.type.name).toBe('dita_property');
    expect([0, 1, 2].map((index) => property.child(index).type.name)).toEqual([
      'dita_proptype',
      'dita_propvalue',
      'dita_propdesc',
    ]);
    for (const index of [0, 1, 2]) {
      expect(property.child(index).childCount).toBeGreaterThan(0);
    }
  });

  it('has a skeleton for every block element the topic insert menu can offer', () => {
    const topicContainers = [
      'topic', 'concept', 'task', 'reference', 'body', 'conbody', 'taskbody', 'refbody',
      'section', 'example', 'refsyn', 'prereq', 'context', 'steps', 'steps-unordered', 'step',
      'substeps', 'substep', 'choices', 'info', 'stepxmp', 'stepresult', 'result', 'postreq',
      'related-links', 'ul', 'ol', 'dl', 'dlentry', 'li', 'note', 'fig', 'link', 'choice',
      // Extended DITA 1.3 task containers (`abstract`, troubleshooting, informal steps, ...)
      'abstract', 'tasktroubleshooting', 'steps-informal', 'stepsection', 'steptroubleshooting',
      'tutorialinfo', 'itemgroup', 'choicetable',
      // Reference-body grammar (`properties` family + `refbodydiv`)
      'refbodydiv', 'properties',
    ];
    // Table internals are managed by the dedicated table toolbar instead of the generic menu.
    const tableInternals = new Set(['tgroup', 'colspec', 'thead', 'tbody', 'row', 'entry', 'sthead', 'strow', 'stentry']);
    const missing: string[] = [];
    for (const parentTag of topicContainers) {
      for (const childTag of DITA_CONTENT_MODEL[parentTag] ?? []) {
        if (tableInternals.has(childTag)) continue;
        const spec = DITA_ELEMENT_SPECS.get(childTag);
        if (!spec || spec.kind !== 'block') continue;
        if (!createDitaElementSkeleton(childTag)) missing.push(`${parentTag}>${childTag}`);
      }
    }
    expect(missing).toEqual([]);
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

  it('maps structure decorations through text-only edits instead of revalidating the document', () => {
    const { pmDoc } = xmlToPmDoc(MISORDERED_TASK);
    const state = EditorState.create({ doc: pmDoc, plugins: [createDitaStructurePlugin('zh-CN')] });
    const getDecos = (editorState: EditorState) =>
      DITA_STRUCTURE_KEY.getState(editorState)!.decorations.find();
    const spans = (editorState: EditorState) =>
      getDecos(editorState).map((decoration) => [decoration.from, decoration.to] as const);
    const types = (editorState: EditorState) =>
      getDecos(editorState).map((decoration) => (decoration as unknown as { type: unknown }).type);

    const before = spans(state);
    const beforeTypes = types(state);
    expect(before.length).toBeGreaterThan(0);

    // Typing inside <title> cannot change element structure: decorations are mapped (same type objects), not rebuilt.
    const inserted = state.apply(state.tr.insertText('XX', 2));
    expect(spans(inserted)).toEqual(before.map(([from, to]) => [from + 2, to + 2]));
    expect(types(inserted)).toEqual(beforeTypes);

    // Replacing a text selection within the same textblock also maps without rebuilding.
    const replaced = inserted.apply(inserted.tr.insertText('Y', 2, 4));
    expect(spans(replaced)).toEqual(before.map(([from, to]) => [from + 1, to + 1]));
    expect(types(replaced)).toEqual(beforeTypes);

    const deleted = replaced.apply(replaced.tr.delete(2, 3));
    expect(spans(deleted)).toEqual(before);
    expect(types(deleted)).toEqual(beforeTypes);
  });

  it('rebuilds structure decorations when plain text replaces a cross-node selection', () => {
    const misorderedSection = `<?xml version="1.0" encoding="UTF-8"?>
<concept id="c_sec">
  <title>Concept</title>
  <conbody>
    <section>
      <p>first</p>
      <title>late title</title>
    </section>
  </conbody>
</concept>`;
    const { pmDoc } = xmlToPmDoc(misorderedSection);
    const state = EditorState.create({ doc: pmDoc, plugins: [createDitaStructurePlugin('zh-CN')] });

    expect(DITA_STRUCTURE_KEY.getState(state)!.decorations.find().length).toBe(1);

    // Selecting from inside <p> across the misordered <title> and typing 'X' destroys <title>
    // in a single ReplaceStep whose inserted slice is pure text; decorations MUST rebuild.
    let pTextPos = 0;
    let lateTitleEnd = 0;
    pmDoc.descendants((node, pos) => {
      if (node.type.name === 'dita_p') pTextPos = pos + 2;
      if (node.type.name === 'dita_title' && pos > 10) lateTitleEnd = pos + node.nodeSize - 1;
    });
    const nextState = state.apply(state.tr.insertText('X', pTextPos, lateTitleEnd));
    expect(validatePmStructure(nextState.doc)).toHaveLength(0);
    expect(DITA_STRUCTURE_KEY.getState(nextState)!.decorations.find()).toHaveLength(0);
  });

  it('rebuilds structure decorations when plain text merges misordered taskbody blocks', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<task id="t_merge">
  <title>Task</title>
  <taskbody>
    <postreq><p>after</p></postreq>
    <prereq><p>before</p></prereq>
    <steps><step><cmd>do</cmd></step></steps>
  </taskbody>
</task>`;
    const { pmDoc } = xmlToPmDoc(xml);
    const state = EditorState.create({ doc: pmDoc, plugins: [createDitaStructurePlugin('zh-CN')] });

    let postreqInner = 0;
    let prereqInner = 0;
    pmDoc.descendants((node, pos) => {
      if (node.type.name === 'dita_postreq') postreqInner = pos + 3;
      if (node.type.name === 'dita_prereq') prereqInner = pos + 3;
    });

    const nextState = state.apply(state.tr.insertText('X', postreqInner, prereqInner));
    const expectedCount = validatePmStructure(nextState.doc).filter((i) => i.size > 0).length;
    expect(DITA_STRUCTURE_KEY.getState(nextState)!.decorations.find()).toHaveLength(expectedCount);
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

  it('flags a paragraph that trails a section inside conbody (concept.mod ordering)', () => {
    const xml = `<concept id="c"><title>C</title><conbody><section id="s"><title>S</title><p>a</p></section><p>b</p></conbody></concept>`;
    const { pmDoc } = xmlToPmDoc(xml);
    const issues = validatePmStructure(pmDoc);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'child-out-of-order', parentTag: 'conbody', childTag: 'p' });

    // The same shape stays legal inside a base topic <body>.
    const topicXml = `<topic id="t"><title>T</title><body><section id="s"><title>S</title><p>a</p></section><p>b</p></body></topic>`;
    expect(validatePmStructure(xmlToPmDoc(topicXml, { position: false }).pmDoc)).toHaveLength(0);
  });

  it('re-anchors a paragraph inserted after a conbody section in front of it', () => {
    const xml = `<concept id="c"><title>C</title><conbody><section id="s"><title>S</title><p>a</p></section></conbody></concept>`;
    const { pmDoc } = xmlToPmDoc(xml);
    // Ask the gap menu for a paragraph *after* the whole section (conbody level).
    let sectionPos = -1;
    pmDoc.descendants((node, pos) => {
      if (sectionPos === -1 && node.type.name === 'dita_section') {
        sectionPos = pos + node.nodeSize;
      }
      return true;
    });
    expect(sectionPos).toBeGreaterThan(0);
    const state = EditorState.create({ doc: pmDoc, plugins: [createDitaStructurePlugin('zh-CN')] });
    const { state: next, ok } = runCmd(state, insertBlockDitaElementAtPos('p', sectionPos));
    expect(ok).toBe(true);
    const out = pmDocToXml(next.doc);
    expect(validatePmStructure(next.doc)).toHaveLength(0);
    // The new (still empty) paragraph is re-anchored in front of the section instead of trailing it.
    expect(out).toContain('<p/>');
    expect(out.indexOf('<p/>')).toBeLessThan(out.indexOf('<section'));
    expect(out.match(/<p>a<\/p>/g)).toHaveLength(1);
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
