import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import {
  checkChildRemoval,
  DITA_CONTENT_MODEL,
  detectTaskContentModel,
  getAllowedChildElementTags,
  getElementSpec,
  getInsertableTagsBySequence,
  isChildAllowed,
  pmDocToXml,
  resolvePmDocTaskContentModel,
  resolveTaskContentModel,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '../src/index.js';
import { checkXmlStructure } from '../src/xml/structure-check.js';

function collectNodeTypes(root: PMNode): string[] {
  const names: string[] = [];
  root.descendants((node) => {
    names.push(node.type.name);
  });
  return names;
}

const TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task_full">
  <title>Full Task Model</title>
  <abstract>
    <p>An abstract may carry several blocks and replaces shortdesc.</p>
  </abstract>
  <taskbody>
    <prereq>Strict task allows at most one prereq.</prereq>
    <context>And at most one context.</context>
    <steps>
      <stepsection>Preparation</stepsection>
      <step>
        <cmd>Open the chassis</cmd>
        <info>
          <itemgroup>
            <p>Remove both screws.</p>
          </itemgroup>
        </info>
        <tutorialinfo>
          <p>Torque matters for the seal.</p>
        </tutorialinfo>
        <stepresult>Chassis is open</stepresult>
        <steptroubleshooting>
          <p>If the chassis sticks, check the seal.</p>
        </steptroubleshooting>
      </step>
    </steps>
    <result>All steps complete</result>
    <tasktroubleshooting>
      <p>Power on again to verify.</p>
    </tasktroubleshooting>
  </taskbody>
</task>
`;

describe('DITA 1.3 task elements outside the strict step workflow', () => {
  it('exposes element specs for every documented task container', () => {
    const modeled = [
      'abstract',
      'tasktroubleshooting',
      'steps-informal',
      'stepsection',
      'steptroubleshooting',
      'tutorialinfo',
      'itemgroup',
      'choicetable',
    ] as const;
    for (const tag of modeled) {
      const spec = getElementSpec(tag);
      expect(spec, tag).toBeDefined();
      expect(spec!.kind, tag).toBe('block');
      expect(spec!.pmNodeType, tag).toBe(`dita_${tag.replace(/-/g, '_')}`);
    }
    // hazardstatement stays an intentional lossless passthrough (see passthrough-unknown.test.ts).
    const hazard = getElementSpec('hazardstatement');
    expect(hazard).toBeDefined();
    expect(hazard!.pmNodeType).toBeUndefined();
  });

  it('answers parent -> child membership for the new containers', () => {
    expect(isChildAllowed('task', 'abstract')).toBe(true);
    expect(isChildAllowed('taskbody', 'tasktroubleshooting')).toBe(true);
    // Strict Task body: `section` / `steps-informal` exist only in generalTask.dtd / ditabase.dtd.
    expect(isChildAllowed('taskbody', 'section')).toBe(false);
    expect(isChildAllowed('taskbody', 'steps-informal')).toBe(false);
    expect(isChildAllowed('steps', 'stepsection')).toBe(true);
    expect(isChildAllowed('step', 'steptroubleshooting')).toBe(true);
    expect(isChildAllowed('step', 'tutorialinfo')).toBe(true);
    expect(isChildAllowed('step', 'itemgroup')).toBe(true);
    expect(isChildAllowed('step', 'choicetable')).toBe(true);
    expect(isChildAllowed('substep', 'itemgroup')).toBe(true);
    expect(isChildAllowed('choicetable', 'chrow')).toBe(true);
    // Structural guards stay intact.
    expect(isChildAllowed('taskbody', 'p')).toBe(false);
    expect(isChildAllowed('steps', 'p')).toBe(false);
  });

  it('round-trips the extended task model losslessly and structure-clean', () => {
    const { pmDoc } = xmlToPmDoc(TASK_XML);
    const nodeTypes = collectNodeTypes(pmDoc);
    for (const type of [
      'dita_abstract',
      'dita_stepsection',
      'dita_itemgroup',
      'dita_tutorialinfo',
      'dita_steptroubleshooting',
      'dita_tasktroubleshooting',
    ]) {
      expect(nodeTypes, type).toContain(type);
    }

    const roundTripped = pmDocToXml(pmDoc);
    expect(roundTripped).toBe(TASK_XML);
    expect(pmDocToXml(xmlToPmDoc(roundTripped).pmDoc)).toBe(roundTripped);

    expect(validatePmStructure(pmDoc)).toEqual([]);
    const sourceCheck = checkXmlStructure(TASK_XML);
    expect(sourceCheck.ok).toBe(true);
    expect(sourceCheck.ok && sourceCheck.issues).toEqual([]);
  });

  it('keeps `<steps-informal>` modeled but outside the Strict Task body', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="task_informal"><title>Informal</title><taskbody><steps-informal><p>Just prose.</p></steps-informal></taskbody></task>
`;
    const { pmDoc } = xmlToPmDoc(xml);
    expect(collectNodeTypes(pmDoc)).toContain('dita_steps_informal');
    const once = pmDocToXml(pmDoc);
    expect(once).toContain('<steps-informal>');
    expect(once).toContain('<p>Just prose.</p>');
    // Deterministic serializer: the second pass is byte-identical.
    expect(pmDocToXml(xmlToPmDoc(once).pmDoc)).toBe(once);
    // `generalTask.dtd` / `ditabase.dtd` only: the strict taskbody model reports it as not allowed,
    // and the insert menu therefore never offers it for `task.dtd` documents.
    expect(getInsertableTagsBySequence('taskbody', [], DITA_CONTENT_MODEL.taskbody ?? [])).not.toContain(
      'steps-informal',
    );
    expect(DITA_CONTENT_MODEL.taskbody).not.toContain('steps-informal');
    expect(DITA_CONTENT_MODEL.taskbody).not.toContain('section');
    expect(isChildAllowed('taskbody', 'steps-informal')).toBe(false);
  });

  it('offers the new task children from the sequence-aware insert menu', () => {
    const taskbodyCandidates = getInsertableTagsBySequence(
      'taskbody',
      ['prereq', 'context', 'steps', 'result'],
      DITA_CONTENT_MODEL.taskbody ?? [],
    );
    expect(taskbodyCandidates).toContain('example');
    expect(taskbodyCandidates).toContain('postreq');
    expect(taskbodyCandidates).toContain('tasktroubleshooting');
    // The `steps` slot is already filled, so no second step group is offered.
    expect(taskbodyCandidates).not.toContain('steps');
    expect(taskbodyCandidates).not.toContain('steps-unordered');

    const stepCandidates = getInsertableTagsBySequence(
      'step',
      ['cmd'],
      DITA_CONTENT_MODEL.step ?? [],
    );
    expect(stepCandidates).toEqual(
      expect.arrayContaining(['steptroubleshooting', 'tutorialinfo', 'itemgroup', 'choicetable']),
    );
  });
});

describe('strict taskbody content model (task.dtd + strictTaskbodyConstraint.mod)', () => {
  it('keeps the allowed-child list in sync with the Strict Task shell', () => {
    expect(DITA_CONTENT_MODEL.taskbody).toEqual([
      'prereq',
      'context',
      'steps',
      'steps-unordered',
      'result',
      'tasktroubleshooting',
      'example',
      'postreq',
    ]);
  });

  it('accepts the full ordered strict body', () => {
    expect(
      validateChildSequence('taskbody', [
        'prereq',
        'context',
        'steps',
        'result',
        'tasktroubleshooting',
        'example',
        'postreq',
      ]),
    ).toEqual([]);
    expect(validateChildSequence('taskbody', ['steps'])).toEqual([]);
    expect(validateChildSequence('taskbody', [])).toEqual([]);
  });

  it('rejects the second occurrence of prereq / context / example / postreq', () => {
    expect(validateChildSequence('taskbody', ['prereq', 'prereq'])).toMatchObject([
      { code: 'child-cardinality', parentTag: 'taskbody', childTag: 'prereq', index: 1 },
    ]);
    expect(validateChildSequence('taskbody', ['context', 'context'])).toMatchObject([
      { code: 'child-cardinality', childTag: 'context', index: 1 },
    ]);
    expect(validateChildSequence('taskbody', ['example', 'example'])).toMatchObject([
      { code: 'child-cardinality', childTag: 'example', index: 1 },
    ]);
    expect(validateChildSequence('taskbody', ['postreq', 'postreq'])).toMatchObject([
      { code: 'child-cardinality', childTag: 'postreq', index: 1 },
    ]);
  });

  it('rejects interleaved and out-of-order taskbody children', () => {
    expect(validateChildSequence('taskbody', ['context', 'prereq'])).toMatchObject([
      { code: 'child-out-of-order', childTag: 'prereq' },
    ]);
    expect(validateChildSequence('taskbody', ['tasktroubleshooting', 'result'])).toMatchObject([
      { code: 'child-out-of-order', parentTag: 'taskbody', childTag: 'result' },
    ]);
    expect(validateChildSequence('taskbody', ['steps', 'prereq'])).toMatchObject([
      { code: 'child-out-of-order', parentTag: 'taskbody', childTag: 'prereq' },
    ]);
  });

  it('keeps single-occurrence prose containers deletable while `<taskbody>` itself is protected', () => {
    expect(checkChildRemoval('taskbody', 'prereq', ['prereq', 'context'])).toBeNull();
    expect(checkChildRemoval('taskbody', 'example', ['example'])).toBeNull();
    expect(checkChildRemoval('task', 'taskbody', ['title', 'taskbody'])).toMatchObject({
      code: 'required-policy',
    });
  });
});

/**
 * Task shell variant switch: `task.dtd` (strict) vs `generalTask.dtd` / `ditabase.dtd` (general).
 * The strict model is the default; `auto` resolves it from the document's own DOCTYPE.
 */
describe('task content model switch (strict / general)', () => {
  const GENERAL_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA General Task//EN" "generalTask.dtd">
<task id="general_task">
  <title>General Task Model</title>
  <taskbody>
    <prereq>First prerequisite.</prereq>
    <context>Interleaved context.</context>
    <section>
      <title>Overview</title>
      <p>General tasks allow sections.</p>
    </section>
    <prereq>A second prerequisite is legal here.</prereq>
    <steps-informal>
      <p>The informal path also works.</p>
    </steps-informal>
    <result>Everything worked.</result>
    <example>Repeatable example.</example>
    <example>Another repeatable example.</example>
    <postreq>Repeatable postrequisite.</postreq>
    <postreq>And another.</postreq>
  </taskbody>
</task>
`;

  it('detects the variant from the DOCTYPE and honours an explicit setting', () => {
    expect(detectTaskContentModel(GENERAL_TASK_XML)).toBe('general');
    expect(detectTaskContentModel(TASK_XML)).toBe('strict');
    expect(detectTaskContentModel(TASK_XML.replace('task.dtd', 'ditabase.dtd'))).toBe('general');
    expect(detectTaskContentModel('')).toBe('strict');
    expect(resolveTaskContentModel('auto', 'general')).toBe('general');
    expect(resolveTaskContentModel('strict', 'general')).toBe('strict');
    expect(resolveTaskContentModel('general', 'strict')).toBe('general');
  });

  it('accepts general-only taskbody content in general mode and rejects it in strict mode', () => {
    // Strict `task.dtd` narrows `<taskbody>`: the known elements general mode adds are reported
    // instead of being silently treated as passthrough.
    expect(validateChildSequence('taskbody', ['section'])).toMatchObject([
      { code: 'child-not-allowed', parentTag: 'taskbody', childTag: 'section' },
    ]);
    expect(validateChildSequence('taskbody', ['steps-informal'])).toMatchObject([
      { code: 'child-not-allowed', parentTag: 'taskbody', childTag: 'steps-informal' },
    ]);
    // Unknown / specialized children stay transparent in both variants (lossless passthrough).
    expect(validateChildSequence('taskbody', ['mySpecializedPrereq'])).toEqual([]);
    expect(
      validateChildSequence('taskbody', ['mySpecializedPrereq'], { taskModel: 'general' }),
    ).toEqual([]);
    expect(validateChildSequence('taskbody', ['section'], { taskModel: 'general' })).toEqual([]);
    expect(
      validateChildSequence('taskbody', ['prereq', 'context', 'section', 'prereq'], {
        taskModel: 'general',
      }),
    ).toEqual([]);
    expect(validateChildSequence('taskbody', ['steps-informal'], { taskModel: 'general' })).toEqual(
      [],
    );
    expect(
      validateChildSequence('taskbody', ['example', 'example', 'postreq', 'postreq'], {
        taskModel: 'general',
      }),
    ).toEqual([]);
    // General mode still keeps the DTD order for the single-occurrence tail slots
    expect(
      validateChildSequence('taskbody', ['result', 'steps'], { taskModel: 'general' }),
    ).toMatchObject([{ code: 'child-out-of-order', childTag: 'steps' }]);
    expect(
      validateChildSequence('taskbody', ['steps', 'steps-informal'], { taskModel: 'general' }),
    ).toMatchObject([{ code: 'slot-exclusive' }]);
  });

  it('offers the general-only elements in the insert menu only in general mode', () => {
    const candidates = ['section', 'steps-informal', 'example', 'postreq', 'prereq'];
    expect(getInsertableTagsBySequence('taskbody', [], candidates)).not.toContain('section');
    expect(getInsertableTagsBySequence('taskbody', [], candidates)).not.toContain(
      'steps-informal',
    );
    expect(
      getInsertableTagsBySequence('taskbody', ['prereq'], candidates, 'general'),
    ).toContain('section');
    expect(
      getInsertableTagsBySequence('taskbody', ['prereq'], candidates, 'general'),
    ).toContain('steps-informal');
    expect(getAllowedChildElementTags('taskbody', 'general')).toContain('section');
    expect(getAllowedChildElementTags('taskbody')).not.toContain('section');
  });

  it('validates this source with the model resolved from its own DOCTYPE', () => {
    const auto = checkXmlStructure(GENERAL_TASK_XML, { taskModel: 'auto' });
    expect(auto.ok).toBe(true);
    expect(auto.ok && auto.issues).toEqual([]);
    // `ok` reports well-formedness; the content-model verdict is `issues`.
    const forcedStrict = checkXmlStructure(GENERAL_TASK_XML, { taskModel: 'strict' });
    const strictCodes = forcedStrict.ok ? forcedStrict.issues.map((issue) => issue.code) : [];
    expect(strictCodes).toContain('child-not-allowed');
    // Every strict-mode complaint names `<taskbody>` — the only container the variants differ on.
    const strictIssues = forcedStrict.ok ? forcedStrict.issues : [];
    expect(strictIssues.map((issue) => issue.parentTag)).toEqual(
      strictIssues.map(() => 'taskbody'),
    );
    expect(strictIssues.map((issue) => issue.childTag)).toContain('section');
    expect(strictIssues.map((issue) => issue.childTag)).toContain('steps-informal');
    const strictOnTask = checkXmlStructure(TASK_XML, { taskModel: 'auto' });
    expect(strictOnTask.ok && strictOnTask.issues).toEqual([]);
  });

  it('keeps the general model lossless through the ProseMirror round-trip', () => {
    const { pmDoc } = xmlToPmDoc(GENERAL_TASK_XML);
    expect(validatePmStructure(pmDoc, { taskModel: 'general' })).toEqual([]);
    expect(validatePmStructure(pmDoc)).not.toEqual([]);
    expect(resolvePmDocTaskContentModel(pmDoc, 'auto')).toBe('general');
    expect(resolvePmDocTaskContentModel(pmDoc, 'strict')).toBe('strict');
    const once = pmDocToXml(pmDoc);
    expect(once).toBe(GENERAL_TASK_XML);
    expect(pmDocToXml(xmlToPmDoc(once).pmDoc)).toBe(once);
    expect(
      collectNodeTypes(pmDoc).filter((name) => name === 'dita_steps_informal'),
    ).toHaveLength(1);
  });

  it('keeps general-mode prose containers deletable (they are `zeroOrMore`)', () => {
    expect(checkChildRemoval('taskbody', 'section', ['section'])).toBeNull();
    expect(checkChildRemoval('taskbody', 'section', ['section'], 'general')).toBeNull();
    // `prereq|context|section` is `(...)*` in generalTask.dtd, so emptying it is legal.
    expect(checkChildRemoval('taskbody', 'prereq', ['prereq', 'context'], 'general')).toBeNull();
    // The strict model keeps its single-occurrence slots deletable as well.
    expect(checkChildRemoval('taskbody', 'prereq', ['prereq', 'context'])).toBeNull();
  });
});
