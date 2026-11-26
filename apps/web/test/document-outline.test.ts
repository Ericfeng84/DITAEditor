import { describe, expect, it } from 'vitest';
import { EditorState, type Command } from 'prosemirror-state';
import { history, undo } from 'prosemirror-history';
import type { Node as PMNode } from 'prosemirror-model';
import {
  getElementLabel,
  getElementSpec,
  getPmNodeRawAttrs,
  getPmNodeTagName,
  getRawAttr,
  pmDocToXml,
  resolvePmElementPath,
  validatePmStructure,
  xmlToPmDoc,
} from '@dita/core';
import {
  buildDocumentOutline,
  filterOutlineTree,
  indexOutlineNodes,
  resolveActiveOutlineId,
  resolveActiveOutlineIdByPath,
  type OutlineNode,
} from '../src/editor/outline/outline-model';
import { evaluateOutlineDrop } from '../src/editor/outline/outline-dnd';
import { moveDitaNodeByOutline } from '../src/editor/visual/commands';

const TOPIC_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">`;
const CONCEPT_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">`;
const TASK_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">`;
const REFERENCE_HEAD = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">`;

const CONCEPT_XML = `${CONCEPT_HEAD}
<concept id="c1"><title>Concept Title</title><shortdesc>Short summary</shortdesc>
<conbody>
<p id="p1">Alpha</p>
<section id="s1"><title>Sec One</title><p id="p2">Beta</p><note id="n1">Careful</note></section>
<example id="ex1"><title>Ex One</title><p id="p3">Gamma</p></example>
</conbody></concept>`;

const TASK_XML = `${TASK_HEAD}
<task id="t1"><title>Install</title><shortdesc>Quick</shortdesc><taskbody>
<prereq><p>Have disk</p></prereq>
<context><p>Read me</p></context>
<steps><step id="st1"><cmd>Run installer</cmd><stepresult><p>Done</p></stepresult></step>
<step id="st2"><cmd>Restart</cmd></step></steps>
<result><p>Ready</p></result>
<postreq><p>Enjoy</p></postreq>
</taskbody></task>`;

const TASK_WITH_SECTION_XML = `${TASK_HEAD}
<task id="t2"><title>Mixed</title><taskbody>
<section id="bad"><title>Extra</title><p>x</p></section>
<steps><step id="st3"><cmd>Do</cmd></step></steps>
</taskbody></task>`;

const TASK_TWO_STEPS_XML = `${TASK_HEAD}
<task id="t3"><title>Two step containers</title><taskbody>
<steps id="sx"><step id="stx1"><cmd>One</cmd></step><step id="stx2"><cmd>Two</cmd></step></steps>
<section id="sec1"><title>Extra</title><steps id="sy"><step id="sty1"><cmd>Three</cmd></step></steps></section>
</taskbody></task>`;

const REFERENCE_XML = `${REFERENCE_HEAD}
<reference id="r1"><title>Ref</title><refbody>
<section id="rs"><title>RS</title><p>x</p></section>
<refsyn><title>Syntax</title><codeblock>cmd --flag</codeblock></refsyn>
</refbody></reference>`;

const TOPIC_BODY_XML = `${TOPIC_HEAD}
<topic id="tb"><title>Body Doc</title><body>
<p id="p-top">Top</p>
<section id="s-a"><title>Section A</title>
<p id="p-a1">A1</p>
<note id="n-a1">Note A</note>
</section>
<section id="s-b"><title>Section B</title><p id="p-b1">B1</p></section>
<ul id="u-a"><li id="li-1">one</li><li id="li-2">two</li></ul>
<ul id="u-b"><li id="li-3">three</li></ul>
</body></topic>`;

const LOSSLESS_XML = `${TOPIC_HEAD}
<topic id="lossy">
<?oxy_comment_start author="a"?>
<title>Lossless</title>
<!-- keep me -->
<body>
<section id="sec-1" class="- topic/section ">
<!-- inner comment -->
<title>One</title>
<p id="p-1" props="a" audience="b">Alpha</p>
<?my-pi data="x"?>
<mytag id="u-1">custom</mytag>
</section>
<section id="sec-2"><title>Two</title><p id="p-2">Beta</p></section>
</body>
</topic>`;

function docOf(xml: string): PMNode {
  return xmlToPmDoc(xml).pmDoc;
}

function stateOf(xml: string): EditorState {
  return EditorState.create({ doc: docOf(xml), plugins: [history()] });
}

function labelOf(tag: string): string {
  const spec = getElementSpec(tag);
  if (!spec) throw new Error(`No element spec for ${tag}`);
  return getElementLabel(spec, 'zh-CN');
}

function flatten(nodes: readonly OutlineNode[]): OutlineNode[] {
  const result: OutlineNode[] = [];
  const walk = (list: readonly OutlineNode[]): void => {
    for (const node of list) {
      result.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

function childTags(node: OutlineNode): string[] {
  return node.children.map((child) => child.tagName);
}

function findOutlineNode(
  nodes: readonly OutlineNode[],
  tagName: string,
  label?: string,
): OutlineNode {
  const match = flatten(nodes).find(
    (node) => node.tagName === tagName && (label === undefined || node.label === label),
  );
  if (!match) throw new Error(`Outline node ${tagName} (${label ?? ''}) not found`);
  return match;
}

function posOf(doc: PMNode, tagName: string, ditaId?: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (getPmNodeTagName(node) !== tagName) return true;
    if (ditaId !== undefined && getRawAttr(getPmNodeRawAttrs(node), 'id') !== ditaId) return true;
    found = pos;
    return false;
  });
  if (found < 0) throw new Error(`Node ${tagName}#${ditaId ?? ''} not found`);
  return found;
}

function applyCommand(state: EditorState, command: Command): EditorState {
  let next = state;
  command(state, (tr) => {
    next = state.apply(tr);
  });
  return next;
}

describe('buildDocumentOutline', () => {
  it('builds a structure-mode tree for a concept', () => {
    const doc = docOf(CONCEPT_XML);
    const [root, ...rest] = buildDocumentOutline(doc);
    expect(rest).toHaveLength(0);
    expect(root).toBeDefined();
    if (!root) return;

    expect(root.tagName).toBe('concept');
    expect(root.id).toBe('root');
    expect(root.elementPath).toEqual([]);
    expect(root.label).toBe('Concept Title');
    expect(root.ditaId).toBe('c1');
    expect(root.depth).toBe(0);
    expect(root.canDrag).toBe(false);
    expect(root.canAcceptChildren).toBe(true);
    expect(root.isUnknown).toBe(false);
    expect(root.category).toBe('topic');
    expect(childTags(root)).toEqual(['shortdesc', 'conbody']);

    const shortdesc = root.children[0];
    expect(shortdesc?.label).toBe(labelOf('shortdesc'));

    const conbody = root.children[1];
    if (!conbody) throw new Error('conbody missing');
    expect(conbody.tagName).toBe('conbody');
    expect(conbody.label).toBe(labelOf('conbody'));
    // `<p id="p1">` is hidden in structure density.
    expect(conbody.hiddenChildCount).toBe(1);
    expect(childTags(conbody)).toEqual(['section', 'example']);

    const section = conbody.children[0];
    if (!section) throw new Error('section missing');
    expect(section.label).toBe('Sec One');
    expect(section.elementPath).toEqual([2, 1]);
    expect(section.hiddenChildCount).toBe(2); // <p> + <note>
    expect(section.canDrag).toBe(true);

    const example = conbody.children[1];
    expect(example?.label).toBe('Ex One');
    expect(example?.elementPath).toEqual([2, 2]);
    expect(example?.hiddenChildCount).toBe(1); // <p>
  });

  it('exposes every block element in all density', () => {
    const doc = docOf(CONCEPT_XML);
    const root = buildDocumentOutline(doc, { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    const conbody = root.children[1];
    if (!conbody) throw new Error('conbody missing');

    expect(childTags(conbody)).toEqual(['p', 'section', 'example']);
    expect(conbody.hiddenChildCount).toBe(0);

    const paragraph = conbody.children[0];
    expect(paragraph?.tagName).toBe('p');
    expect(paragraph?.label).toBe('Alpha');
    expect(paragraph?.category).toBe('block');
    expect(paragraph?.ditaId).toBe('p1');
    expect(paragraph?.canAcceptChildren).toBe(false);
    expect(paragraph?.canDrag).toBe(true);

    const section = conbody.children[1];
    if (!section) throw new Error('section missing');
    expect(section.hiddenChildCount).toBe(0);
    expect(childTags(section)).toEqual(['p', 'note']);

    const note = section.children[1];
    expect(note?.tagName).toBe('note');
    expect(note?.category).toBe('note');
    expect(note?.label.startsWith(labelOf('note'))).toBe(true);
    expect(note?.label).toContain('Careful');
  });

  it('uses <cmd>, <dt> and localized labels for task workflow nodes', () => {
    const doc = docOf(TASK_XML);
    const root = buildDocumentOutline(doc)[0];
    if (!root) throw new Error('root missing');
    expect(childTags(root)).toEqual(['shortdesc', 'taskbody']);

    const taskbody = root.children[1];
    if (!taskbody) throw new Error('taskbody missing');
    expect(taskbody.label).toBe(labelOf('taskbody'));
    expect(childTags(taskbody)).toEqual(['prereq', 'context', 'steps', 'result', 'postreq']);
    expect(taskbody.children[0]?.label).toBe(labelOf('prereq'));

    const steps = taskbody.children[2];
    if (!steps) throw new Error('steps missing');
    expect(steps.label).toBe(labelOf('steps'));
    expect(childTags(steps)).toEqual(['step', 'step']);
    expect(steps.children[0]?.label).toBe('Run installer');
    expect(steps.children[1]?.label).toBe('Restart');
    expect(steps.children[0]?.category).toBe('step');
    // `<stepresult>` and its `<p>` are hidden; `<cmd>` is the step label, not a hidden child.
    expect(steps.children[0]?.hiddenChildCount).toBe(2);
  });

  it('labels dlentry by its <dt>', () => {
    const xml = `${TOPIC_HEAD}
<topic id="dl"><title>DL</title><body><dl><dlentry><dt>Term One</dt><dd>Definition</dd></dlentry></dl></body></topic>`;
    const root = buildDocumentOutline(docOf(xml), { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    const entry = findOutlineNode(root.children, 'dlentry');
    expect(entry.label).toBe('Term One');
    expect(entry.category).toBe('list');
  });

  it('labels block images by alt, href basename or keyref', () => {
    const xml = `${TOPIC_HEAD}
<topic id="img"><title>Img</title><body>
<section id="is"><title>Images</title>
<fig><title>Figure</title><image href="images/logo.png" placement="break"/></fig>
<image keyref="brand-logo" placement="break"/>
<image href="pics/pic.png" placement="break"><alt>Alt text</alt></image>
</section>
</body></topic>`;
    const root = buildDocumentOutline(docOf(xml), { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    const images = flatten(root.children).filter((node) => node.tagName === 'image');
    expect(images.map((node) => node.label)).toEqual(['logo.png', 'brand-logo', 'Alt text']);
    for (const image of images) expect(image.category).toBe('media');
  });

  it('labels links by linktext, href or keyref', () => {
    const xml = `${TOPIC_HEAD}
<topic id="ln"><title>Links</title><body><p>
<link href="https://example.com/a"><linktext>Example A</linktext></link>
<link keyref="topic-key"/>
</p></body></topic>`;
    const root = buildDocumentOutline(docOf(xml), { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    const links = flatten(root.children).filter((node) => node.tagName === 'link');
    expect(links.map((node) => node.label)).toEqual(['Example A', 'topic-key']);
  });

  it('builds a reference outline and hides table internals', () => {
    const doc = docOf(REFERENCE_XML);
    const root = buildDocumentOutline(doc, { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    expect(root.tagName).toBe('reference');
    const refbody = root.children[0];
    if (!refbody) throw new Error('refbody missing');
    expect(refbody.tagName).toBe('refbody');
    expect(childTags(refbody)).toEqual(['section', 'refsyn']);

    const refsyn = refbody.children[1];
    if (!refsyn) throw new Error('refsyn missing');
    expect(refsyn.label).toBe('Syntax');
    expect(childTags(refsyn)).toEqual(['codeblock']);
    expect(refsyn.children[0]?.category).toBe('code');

    const propertiesXml = `${REFERENCE_HEAD}
<reference id="rp"><title>Props</title><refbody>
<properties><prophead><proptypehd>Type</proptypehd><propvaluehd>Value</propvaluehd></prophead>
<property><proptype>String</proptype><propvalue>abc</propvalue></property></properties>
</refbody></reference>`;
    const propsRoot = buildDocumentOutline(docOf(propertiesXml), { density: 'all' })[0];
    if (!propsRoot) throw new Error('props root missing');
    const properties = findOutlineNode(propsRoot.children, 'properties');
    expect(properties.children).toEqual([]);
    expect(properties.hiddenChildCount).toBe(0);
  });

  it('keeps titled tables while hiding CALS internals', () => {
    const xml = `${TOPIC_HEAD}
<topic id="tbl"><title>Tables</title><body>
<table id="tb1"><title>Sample</title>
<tgroup cols="2"><colspec colname="c1"/><colspec colname="c2"/>
<thead><row><entry>H1</entry><entry>H2</entry></row></thead>
<tbody><row><entry>A</entry><entry>B</entry></row></tbody></tgroup></table>
<simpletable id="st1"><sthead><stentry>S1</stentry></sthead>
<strow><stentry>V1</stentry></strow></simpletable>
</body></topic>`;
    const root = buildDocumentOutline(docOf(xml), { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    const body = root.children[0];
    if (!body) throw new Error('body missing');
    expect(childTags(body)).toEqual(['table', 'simpletable']);
    const table = body.children[0];
    expect(table?.label).toBe('Sample');
    expect(table?.category).toBe('table');
    expect(table?.children).toEqual([]);
    expect(table?.hiddenChildCount).toBe(0);
    expect(table?.canDrag).toBe(true);
    // `<table>` itself is not a CALS internal, so it stays a drop container per spec.
    expect(table?.canAcceptChildren).toBe(true);
  });

  it('keeps stable elementPath/id pairs that match resolvePmElementPath', () => {
    for (const xml of [CONCEPT_XML, TASK_XML, REFERENCE_XML, TOPIC_BODY_XML]) {
      const doc = docOf(xml);
      for (const density of ['structure', 'all'] as const) {
        const nodes = flatten(buildDocumentOutline(doc, { density }));
        const ids = new Set(nodes.map((node) => node.id));
        expect(ids.size).toBe(nodes.length);
        for (const node of nodes) {
          expect(node.id).toBe(node.elementPath.length === 0 ? 'root' : node.elementPath.join('/'));
          // `resolvePmElementPath` maps a *content* position to its element path, so a
          // node start needs `+ 1` to resolve to the node itself.
          expect(resolvePmElementPath(doc, node.pmPos + 1)).toEqual(node.elementPath);
          expect(node.pmEndPos).toBeGreaterThan(node.pmPos);
          expect(node.pmEndPos - node.pmPos).toBe(doc.nodeAt(node.pmPos)?.nodeSize);
        }
      }
    }
  });

  it('attaches structure issues only where the strict task model rejects a child', () => {
    const doc = docOf(TASK_WITH_SECTION_XML);
    const strictRoot = buildDocumentOutline(doc, { taskModel: 'strict' })[0];
    if (!strictRoot) throw new Error('root missing');
    const strictSection = findOutlineNode(strictRoot.children, 'section');
    expect(strictSection.structureIssueMessage).toBeTruthy();
    expect(strictSection.structureIssueMessage).toContain('taskbody');
    expect(strictSection.structureIssueMessage).toContain('section');

    const generalRoot = buildDocumentOutline(doc, { taskModel: 'general' })[0];
    if (!generalRoot) throw new Error('root missing');
    const generalSection = findOutlineNode(generalRoot.children, 'section');
    expect(generalSection.structureIssueMessage).toBeUndefined();

    const issues = validatePmStructure(doc, { taskModel: 'strict' });
    expect(issues.some((issue) => issue.code === 'child-not-allowed')).toBe(true);
  });

  it('marks specialized (unknown) elements and keeps them draggable', () => {
    const xml = `${TOPIC_HEAD}
<topic id="unk"><title>Unknown</title><body><section id="us"><title>U</title><mytag id="m1">custom</mytag></section></body></topic>`;
    const root = buildDocumentOutline(docOf(xml), { density: 'all' })[0];
    if (!root) throw new Error('root missing');
    const custom = findOutlineNode(root.children, 'mytag');
    expect(custom.isUnknown).toBe(true);
    expect(custom.canDrag).toBe(true);
    expect(custom.category).toBe('block');
  });
});

describe('filterOutlineTree', () => {
  const doc = docOf(CONCEPT_XML);
  const nodes = buildDocumentOutline(doc, { density: 'all' });

  it('keeps ancestors of label matches', () => {
    const filtered = filterOutlineTree(nodes, 'Sec');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.tagName).toBe('concept');
    expect(filtered[0]?.children[0]?.tagName).toBe('conbody');
    expect(filtered[0]?.children[0]?.children.map((node) => node.label)).toEqual(['Sec One']);
  });

  it('matches by tag name, with or without angle brackets', () => {
    const byName = filterOutlineTree(nodes, 'section');
    const byTag = filterOutlineTree(nodes, '<section>');
    expect(byName).toHaveLength(1);
    // A match keeps its whole subtree (ancestor preservation).
    expect(flatten(byName).map((node) => node.tagName)).toEqual([
      'concept',
      'conbody',
      'section',
      'p',
      'note',
    ]);
    expect(byTag).toEqual(byName);
  });

  it('matches by DITA @id with the # prefix', () => {
    const filtered = filterOutlineTree(nodes, '#ex1');
    const matches = flatten(filtered);
    expect(matches.map((node) => node.tagName)).toEqual(['concept', 'conbody', 'example', 'p']);
    expect(matches[2]?.ditaId).toBe('ex1');
  });

  it('returns everything for an empty query and nothing for a miss', () => {
    expect(filterOutlineTree(nodes, '   ')).toHaveLength(1);
    expect(filterOutlineTree(nodes, 'zzz-nope')).toEqual([]);
    expect(filterOutlineTree(nodes, '#')).toHaveLength(1);
  });
});

describe('active outline resolution', () => {
  const doc = docOf(CONCEPT_XML);
  const nodes = buildDocumentOutline(doc);
  const nodeMap = indexOutlineNodes(nodes);
  const root = nodes[0];
  if (!root) throw new Error('root missing');
  const conbody = root.children[1];
  if (!conbody) throw new Error('conbody missing');
  const section = conbody.children[0];
  if (!section) throw new Error('section missing');

  it('walks breadcrumbs from deepest to root', () => {
    expect(resolveActiveOutlineId([], nodeMap)).toBeNull();
    expect(resolveActiveOutlineId([{ pos: root.pmPos }], nodeMap)).toBe('root');
    expect(
      resolveActiveOutlineId([{ pos: root.pmPos }, { pos: section.pmPos }], nodeMap),
    ).toBe(section.id);
    // A caret inside the hidden `<p id="p2">` falls back to the enclosing section.
    const hiddenParagraphPos = posOf(doc, 'p', 'p2');
    expect(
      resolveActiveOutlineId(
        [{ pos: root.pmPos }, { pos: conbody.pmPos }, { pos: section.pmPos }, { pos: hiddenParagraphPos }],
        nodeMap,
      ),
    ).toBe(section.id);
    expect(resolveActiveOutlineId([{ pos: 9999 }], nodeMap)).toBeNull();
  });

  it('resolves by element path using the longest prefix', () => {
    expect(resolveActiveOutlineIdByPath([], nodeMap)).toBe('root');
    expect(resolveActiveOutlineIdByPath([2], nodeMap)).toBe(conbody.id);
    expect(resolveActiveOutlineIdByPath(section.elementPath, nodeMap)).toBe(section.id);
    expect(resolveActiveOutlineIdByPath([...section.elementPath, 1], nodeMap)).toBe(section.id);
    // The root element path ([]) is a prefix of every path, so unknown paths fall back to root.
    expect(resolveActiveOutlineIdByPath([7, 7], nodeMap)).toBe('root');
  });
});

describe('evaluateOutlineDrop', () => {
  const topicDoc = docOf(TOPIC_BODY_XML);
  const conceptDoc = docOf(CONCEPT_XML);
  const taskDoc = docOf(TASK_XML);
  const twoStepsDoc = docOf(TASK_TWO_STEPS_XML);

  it('accepts legal same-container reorders', () => {
    const sectionA = posOf(topicDoc, 'section', 's-a');
    const sectionB = posOf(topicDoc, 'section', 's-b');
    const moveSection = evaluateOutlineDrop(topicDoc, sectionB, sectionA, 'before');
    expect(moveSection.ok).toBe(true);
    expect(moveSection.destParentTag).toBe('body');

    const pTop = posOf(topicDoc, 'p', 'p-top');
    const ulB = posOf(topicDoc, 'ul', 'u-b');
    const moveParagraph = evaluateOutlineDrop(topicDoc, pTop, ulB, 'after');
    expect(moveParagraph.ok).toBe(true);

    const step1 = posOf(taskDoc, 'step', 'st1');
    const step2 = posOf(taskDoc, 'step', 'st2');
    expect(evaluateOutlineDrop(taskDoc, step2, step1, 'before').ok).toBe(true);

    const li1 = posOf(topicDoc, 'li', 'li-1');
    const li2 = posOf(topicDoc, 'li', 'li-2');
    expect(evaluateOutlineDrop(topicDoc, li2, li1, 'before').ok).toBe(true);

    const pA1 = posOf(topicDoc, 'p', 'p-a1');
    const noteA1 = posOf(topicDoc, 'note', 'n-a1');
    // `section` has an open content tail, so `p` may follow `note`.
    expect(evaluateOutlineDrop(topicDoc, pA1, noteA1, 'after').ok).toBe(true);
  });

  it('rejects illegal same-container reorders', () => {
    const prereq = posOf(taskDoc, 'prereq');
    const steps = posOf(taskDoc, 'steps');
    const afterSteps = evaluateOutlineDrop(taskDoc, prereq, steps, 'after');
    expect(afterSteps.ok).toBe(false);
    expect(afterSteps.reason).toBe('out-of-order');

    const p1 = posOf(conceptDoc, 'p', 'p1');
    const section = posOf(conceptDoc, 'section', 's1');
    const afterSection = evaluateOutlineDrop(conceptDoc, p1, section, 'after');
    expect(afterSection.ok).toBe(false);
    expect(afterSection.reason).toBe('out-of-order');

    const title = posOf(conceptDoc, 'title');
    const moveTitle = evaluateOutlineDrop(conceptDoc, title, section, 'after');
    expect(moveTitle.ok).toBe(false);
    expect(moveTitle.reason).toBe('pinned-node');

    // The concept's own `<title>` is the leading pinned child of the root container.
    const pA = posOf(conceptDoc, 'p', 'p2');
    const beforeTitle = evaluateOutlineDrop(conceptDoc, pA, title, 'before');
    expect(beforeTitle.ok).toBe(false);
    expect(beforeTitle.reason).toBe('pinned-node');
  });

  it('rejects no-op reorders', () => {
    const pTop = posOf(topicDoc, 'p', 'p-top');
    const sectionA = posOf(topicDoc, 'section', 's-a');
    const beforeNext = evaluateOutlineDrop(topicDoc, pTop, sectionA, 'before');
    expect(beforeNext.ok).toBe(false);
    expect(beforeNext.reason).toBe('noop');

    const sectionB = posOf(topicDoc, 'section', 's-b');
    const afterPrev = evaluateOutlineDrop(topicDoc, sectionB, sectionA, 'after');
    expect(afterPrev.ok).toBe(false);
    expect(afterPrev.reason).toBe('noop');
  });

  it('accepts legal cross-container reparenting', () => {
    const pA1 = posOf(topicDoc, 'p', 'p-a1');
    const sectionB = posOf(topicDoc, 'section', 's-b');
    const intoSection = evaluateOutlineDrop(topicDoc, pA1, sectionB, 'inside');
    expect(intoSection.ok).toBe(true);
    expect(intoSection.destParentTag).toBe('section');
    // `destParentPos` is the destination parent's node start.
    expect(intoSection.destParentPos).toBe(sectionB);
    expect(intoSection.insertGapPos).toBeDefined();

    const p1 = posOf(conceptDoc, 'p', 'p1');
    const sec1 = posOf(conceptDoc, 'section', 's1');
    const fromConbody = evaluateOutlineDrop(conceptDoc, p1, sec1, 'inside');
    expect(fromConbody.ok).toBe(true);
    expect(fromConbody.destElementIndex).toBe(3); // <title>, <p id="p2">, <note id="n1">

    const li1 = posOf(topicDoc, 'li', 'li-1');
    const ulB = posOf(topicDoc, 'ul', 'u-b');
    const acrossLists = evaluateOutlineDrop(topicDoc, li1, ulB, 'inside');
    expect(acrossLists.ok).toBe(true);
    expect(acrossLists.destParentTag).toBe('ul');
    expect(acrossLists.destElementIndex).toBe(1);

    const stepX1 = posOf(twoStepsDoc, 'step', 'stx1');
    const stepsY = posOf(twoStepsDoc, 'steps', 'sy');
    const acrossSteps = evaluateOutlineDrop(twoStepsDoc, stepX1, stepsY, 'inside', 'general');
    expect(acrossSteps.ok).toBe(true);
    expect(acrossSteps.destParentTag).toBe('steps');
  });

  it('rejects illegal cross-container drops', () => {
    const soleStep = posOf(twoStepsDoc, 'step', 'sty1');
    const soleStepsParent = posOf(twoStepsDoc, 'steps', 'sx');
    const removeSoleStep = evaluateOutlineDrop(twoStepsDoc, soleStep, soleStepsParent, 'inside', 'general');
    expect(removeSoleStep.ok).toBe(false);
    expect(removeSoleStep.reason).toBe('source-required');

    const cmd = posOf(taskDoc, 'cmd');
    const steps = posOf(taskDoc, 'steps');
    const removeCmd = evaluateOutlineDrop(taskDoc, cmd, steps, 'inside');
    expect(removeCmd.ok).toBe(false);
    expect(removeCmd.reason).toBe('source-required');

    const pA1 = posOf(topicDoc, 'p', 'p-a1');
    const ulA = posOf(topicDoc, 'ul', 'u-a');
    const pIntoList = evaluateOutlineDrop(topicDoc, pA1, ulA, 'inside');
    expect(pIntoList.ok).toBe(false);
    expect(pIntoList.reason).toBe('not-allowed-in-target');

    const sectionA = posOf(topicDoc, 'section', 's-a');
    const pInA = posOf(topicDoc, 'p', 'p-a1');
    const intoDescendant = evaluateOutlineDrop(topicDoc, sectionA, pInA, 'inside');
    expect(intoDescendant.ok).toBe(false);
    expect(intoDescendant.reason).toBe('self-or-descendant');

    const moveRoot = evaluateOutlineDrop(topicDoc, 0, sectionA, 'inside');
    expect(moveRoot.ok).toBe(false);
    expect(moveRoot.reason).toBe('pinned-node');

    const noteA1 = posOf(topicDoc, 'note', 'n-a1');
    const intoParagraph = evaluateOutlineDrop(topicDoc, noteA1, pInA, 'inside');
    expect(intoParagraph.ok).toBe(false);
    expect(intoParagraph.reason).toBe('target-not-container');
  });
});

describe('moveDitaNodeByOutline', () => {
  it('moves a paragraph into another section as one transaction', () => {
    const initial = stateOf(TOPIC_BODY_XML);
    const pA1 = posOf(initial.doc, 'p', 'p-a1');
    const sectionB = posOf(initial.doc, 'section', 's-b');
    const next = applyCommand(initial, moveDitaNodeByOutline(pA1, sectionB, 'inside'));
    const xml = pmDocToXml(next.doc);

    expect(xml.indexOf('id="p-a1"')).toBeGreaterThan(xml.indexOf('id="p-b1"'));
    const sectionBEnd = xml.indexOf('</section>', xml.indexOf('id="p-b1"'));
    expect(xml.indexOf('id="p-a1"')).toBeLessThan(sectionBEnd);
    // The moved node keeps its DITA @id and no duplication happens.
    expect(xml.split('id="p-a1"').length).toBe(2);
  });

  it('reorders siblings inside one container', () => {
    const initial = stateOf(TOPIC_BODY_XML);
    const sectionA = posOf(initial.doc, 'section', 's-a');
    const sectionB = posOf(initial.doc, 'section', 's-b');
    const next = applyCommand(initial, moveDitaNodeByOutline(sectionB, sectionA, 'before'));
    const xml = pmDocToXml(next.doc);
    expect(xml.indexOf('id="s-b"')).toBeLessThan(xml.indexOf('id="s-a"'));
  });

  it('refuses illegal drops and leaves the document untouched', () => {
    const initial = stateOf(TOPIC_BODY_XML);
    const pA1 = posOf(initial.doc, 'p', 'p-a1');
    const ulA = posOf(initial.doc, 'ul', 'u-a');
    let dispatched = 0;
    const ok = moveDitaNodeByOutline(pA1, ulA, 'inside')(initial, (tr) => {
      dispatched += 1;
      initial.apply(tr);
    });
    expect(ok).toBe(false);
    expect(dispatched).toBe(0);

    const sectionA = posOf(initial.doc, 'section', 's-a');
    const pInA = posOf(initial.doc, 'p', 'p-a1');
    expect(moveDitaNodeByOutline(sectionA, pInA, 'inside')(initial, () => undefined)).toBe(false);
  });

  it('preserves comments, PIs, attributes order and specialized elements losslessly', () => {
    const initial = stateOf(LOSSLESS_XML);
    const originalXml = pmDocToXml(initial.doc);
    const p1 = posOf(initial.doc, 'p', 'p-1');
    const sec2 = posOf(initial.doc, 'section', 'sec-2');

    const next = applyCommand(initial, moveDitaNodeByOutline(p1, sec2, 'inside'));
    const movedXml = pmDocToXml(next.doc);
    expect(movedXml).not.toBe(originalXml);

    expect(movedXml).toContain('<?oxy_comment_start author="a"?>');
    expect(movedXml).toContain('<!-- keep me -->');
    expect(movedXml).toContain('<!-- inner comment -->');
    expect(movedXml).toContain('<?my-pi data="x"?>');
    expect(movedXml).toContain('<mytag id="u-1">custom</mytag>');
    expect(movedXml).toContain('<p id="p-1" props="a" audience="b">Alpha</p>');
    expect(movedXml).toContain('<section id="sec-1" class="- topic/section ">');

    const undone = applyCommand(next, undo);
    expect(pmDocToXml(undone.doc)).toBe(originalXml);
  });

  it('keeps a single undo step for a cross-container move', () => {
    const initial = stateOf(CONCEPT_XML);
    const originalXml = pmDocToXml(initial.doc);
    const p1 = posOf(initial.doc, 'p', 'p1');
    const sec1 = posOf(initial.doc, 'section', 's1');
    const next = applyCommand(initial, moveDitaNodeByOutline(p1, sec1, 'inside'));
    expect(pmDocToXml(next.doc)).not.toBe(originalXml);
    const undone = applyCommand(next, undo);
    expect(pmDocToXml(undone.doc)).toBe(originalXml);
  });
});
