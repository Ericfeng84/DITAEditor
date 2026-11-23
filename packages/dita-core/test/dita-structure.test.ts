import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkXmlStructure,
  collectXmlStructureIssues,
  createTopicTemplate,
  DITA_SAMPLE_DOCUMENTS,
  formatStructureIssue,
  getInsertableTagsBySequence,
  getInsertionSlot,
  getPmChildTags,
  parseXml,
  pmDocToXml,
  validateChildSequence,
  validatePmStructure,
  xmlToPmDoc,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');
const DEMO_PROJECT_DIR = join(__dirname, '..', '..', '..', 'samples', 'demo-dita-project');

const codes = (issues: { code: string }[]): string[] => issues.map((issue) => issue.code);

function collectDitaFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDitaFiles(fullPath));
    } else if (entry.name.endsWith('.dita')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('DITA 1.3 ordered content models (sequence + cardinality)', () => {
  it('accepts the canonical task body sequence including result + tasktroubleshooting', () => {
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
  });

  it('treats `prereq -> context -> steps -> result -> postreq` as order-enforced but all-optional', () => {
    expect(validateChildSequence('taskbody', [])).toEqual([]);
    const reversed = validateChildSequence('taskbody', ['postreq', 'result', 'steps', 'context']);
    expect(codes(reversed)).toEqual([
      'child-out-of-order',
      'child-out-of-order',
      'child-out-of-order',
    ]);
  });

  it('enforces the steps | steps-unordered | steps-informal exclusive choice inside taskbody', () => {
    expect(
      codes(validateChildSequence('taskbody', ['context', 'steps', 'steps-unordered'])),
    ).toContain('slot-exclusive');
    expect(
      codes(validateChildSequence('taskbody', ['steps-informal', 'steps'])),
    ).toContain('slot-exclusive');
    // Even when separated by a later slot, exclusive conflict is reported directly (not only out-of-order).
    expect(
      codes(validateChildSequence('taskbody', ['steps', 'result', 'steps-unordered'])),
    ).toEqual(['slot-exclusive']);
  });

  it('requires a topic title, allows titlealts/abstract, and flags duplicate or late title accurately', () => {
    expect(codes(validateChildSequence('concept', []))).toEqual(['missing-required-child']);
    expect(codes(validateChildSequence('concept', ['title', 'title']))).toEqual([
      'child-cardinality',
    ]);
    expect(
      codes(validateChildSequence('concept', ['title', 'conbody', 'title'])),
    ).toEqual(['child-cardinality']);
    const lateTitle = validateChildSequence('concept', ['conbody', 'title']);
    expect(lateTitle).toHaveLength(1);
    expect(lateTitle[0]).toMatchObject({
      code: 'child-out-of-order',
      childTag: 'title',
      expectedTags: ['conbody'],
    });
    // Standard DITA 1.3 topic children (`titlealts`, `abstract`) must not poison subsequent slots.
    expect(
      validateChildSequence('topic', ['title', 'titlealts', 'shortdesc', 'prolog', 'body']),
    ).toEqual([]);
    expect(validateChildSequence('topic', ['title', 'abstract', 'body'])).toEqual([]);
    expect(codes(validateChildSequence('topic', ['title', 'shortdesc', 'abstract']))).toEqual([
      'slot-exclusive',
    ]);
  });

  it('follows OASIS DITA 1.3 step/substep models (pre-cmd notes, unordered repeating body, post-body stepresult)', () => {
    expect(codes(validateChildSequence('step', []))).toEqual(['missing-required-child']);
    expect(
      validateChildSequence('step', [
        'note',
        'cmd',
        'choices',
        'info',
        'info',
        'stepxmp',
        'substeps',
        'stepresult',
        'steptroubleshooting',
      ]),
    ).toEqual([]);
    expect(validateChildSequence('substep', ['note', 'cmd', 'stepxmp', 'info', 'stepresult'])).toEqual(
      [],
    );
    expect(codes(validateChildSequence('step', ['info', 'cmd']))).toEqual(['child-out-of-order']);
    expect(codes(validateChildSequence('step', ['cmd', 'stepresult', 'info']))).toEqual([
      'child-out-of-order',
    ]);
  });

  it('supports standard DITA 1.3 prolog, dlhead, stepsection, and strict CALS tgroup tbody cardinality', () => {
    expect(
      validateChildSequence('prolog', [
        'author',
        'source',
        'publisher',
        'copyright',
        'critdates',
        'permissions',
        'metadata',
        'metadata',
        'resourceid',
      ]),
    ).toEqual([]);
    expect(validateChildSequence('dl', ['dlhead', 'dlentry', 'dlentry'])).toEqual([]);
    expect(validateChildSequence('steps', ['stepsection', 'step', 'stepsection', 'step'])).toEqual(
      [],
    );
    expect(codes(validateChildSequence('tgroup', ['colspec', 'thead', 'tbody', 'tbody']))).toEqual([
      'child-cardinality',
    ]);
  });

  it('passes unknown/specialized tags transparently inside strict-sequence containers without poisoning siblings', () => {
    expect(
      validateChildSequence('taskbody', ['prereq', 'acme-custom-meta', 'steps', 'result']),
    ).toEqual([]);
  });

  it('suppresses missing-required-child for conref/conkeyref reuse targets', () => {
    const xml =
      '<task id="t"><title>T</title><taskbody><steps>' +
      '<step conkeyref="k/step"/><step><cmd>Do</cmd></step>' +
      '</steps></taskbody></task>';
    const issues = checkXmlStructure(xml);
    expect(issues.ok).toBe(true);
    if (!issues.ok) return;
    expect(issues.issues).toEqual([]);
  });

  it('enforces (dt)+ then (dd)+ inside <dlentry>', () => {
    expect(validateChildSequence('dlentry', ['dt', 'dd'])).toEqual([]);
    expect(validateChildSequence('dlentry', ['dt', 'dt', 'dd', 'dd'])).toEqual([]);
    expect(codes(validateChildSequence('dlentry', ['dd', 'dt']))).toEqual(['child-out-of-order']);
    expect(codes(validateChildSequence('dlentry', ['dt']))).toEqual([
      'missing-required-child',
    ]);
  });

  it('keeps <title> first in open-tail containers and cites the concrete preceding prose tag', () => {
    expect(validateChildSequence('section', ['title', 'p', 'note'])).toEqual([]);
    const late = validateChildSequence('section', ['p', 'title']);
    expect(late).toHaveLength(1);
    expect(late[0]).toMatchObject({
      code: 'child-out-of-order',
      childTag: 'title',
      expectedTags: ['p'],
    });
    expect(formatStructureIssue(late[0]!, 'en')).toContain('before <p>');
    expect(formatStructureIssue(late[0]!, 'zh-CN')).toContain('<p>');
    expect(codes(validateChildSequence('section', ['title', 'title']))).toEqual([
      'child-cardinality',
    ]);
  });

  it('leaves unordered containers (including OASIS DITA 1.3 refbody) unconstrained', () => {
    for (const parentTag of ['body', 'conbody', 'refbody', 'li', 'dd', 'note', 'entry']) {
      expect(
        validateChildSequence(parentTag, ['example', 'section', 'table', 'simpletable', 'refsyn']),
      ).toEqual([]);
    }
  });
});

describe('sequence-aware insertion slots', () => {
  it('places title at the start and shortdesc right after it', () => {
    expect(getInsertionSlot('section', ['p'], 'title')).toMatchObject({ ok: true, index: 0 });
    expect(getInsertionSlot('concept', ['title', 'conbody'], 'shortdesc')).toMatchObject({
      ok: true,
      index: 1,
    });
  });

  it('places workflow elements at their sequence slot, even when existing children are misordered', () => {
    expect(getInsertionSlot('taskbody', ['context', 'result'], 'prereq')).toMatchObject({
      ok: true,
      index: 0,
    });
    expect(getInsertionSlot('taskbody', ['prereq', 'steps', 'postreq'], 'result')).toMatchObject({
      ok: true,
      index: 2,
    });
    // Misordered existing children: `result` must land after `steps`, not before `steps`.
    expect(getInsertionSlot('taskbody', ['postreq', 'steps'], 'result')).toMatchObject({
      ok: true,
      index: 2,
    });
    expect(getInsertionSlot('taskbody', ['prereq', 'context'], 'postreq')).toMatchObject({
      ok: true,
      index: 2,
    });
    expect(getInsertionSlot('step', ['info', 'stepxmp'], 'cmd')).toMatchObject({
      ok: true,
      index: 0,
    });
  });

  it('preserves preferredIndex inside repeating slots and clamps out-of-order preferredIndex', () => {
    expect(getInsertionSlot('ul', ['li', 'li', 'li', 'li'], 'li', 1)).toMatchObject({
      ok: true,
      index: 1,
      minIndex: 0,
      maxIndex: 4,
    });
    expect(getInsertionSlot('dlentry', ['dt', 'dt', 'dd', 'dd'], 'dt', 1)).toMatchObject({
      ok: true,
      index: 1,
    });
    expect(getInsertionSlot('dlentry', ['dt', 'dt', 'dd', 'dd'], 'dt', 4)).toMatchObject({
      ok: true,
      index: 2,
    });
    expect(getInsertionSlot('dlentry', ['dt', 'dt', 'dd', 'dd'], 'dd', 0)).toMatchObject({
      ok: true,
      index: 2,
    });
    expect(getInsertionSlot('section', ['title', 'p'], 'p', 0)).toMatchObject({
      ok: true,
      index: 1,
    });
  });

  it('blocks insertions that would break single-occurrence cardinality or an exclusive choice', () => {
    expect(getInsertionSlot('taskbody', ['steps'], 'steps-unordered')).toMatchObject({
      ok: false,
      issue: { code: 'slot-exclusive' },
    });
    expect(getInsertionSlot('concept', ['title'], 'title')).toMatchObject({
      ok: false,
      issue: { code: 'child-cardinality' },
    });
    expect(getInsertionSlot('section', ['title'], 'title').ok).toBe(false);
    // Repeating mixed choice in <step> keeps allowing more <info> / <choices>.
    expect(getInsertionSlot('step', ['cmd', 'choices'], 'info').ok).toBe(true);
    expect(getInsertionSlot('step', ['cmd', 'info'], 'info').ok).toBe(true);
  });

  it('filters insert-menu candidates by current cardinality', () => {
    expect(
      getInsertableTagsBySequence('taskbody', [], ['steps', 'steps-unordered', 'prereq']),
    ).toEqual(['steps', 'steps-unordered', 'prereq']);
    expect(getInsertableTagsBySequence('taskbody', ['steps'], ['steps', 'steps-unordered'])).toEqual(
      [],
    );
    expect(getInsertableTagsBySequence('taskbody', ['steps'], ['result', 'postreq'])).toEqual([
      'result',
      'postreq',
    ]);
    expect(getInsertableTagsBySequence('concept', ['title'], ['title', 'shortdesc'])).toEqual([
      'shortdesc',
    ]);
    expect(getInsertableTagsBySequence('conbody', ['p'], ['p', 'section'])).toEqual([
      'p',
      'section',
    ]);
    expect(
      getInsertableTagsBySequence('refbody', ['table'], ['table', 'simpletable', 'example']),
    ).toEqual(['table', 'simpletable', 'example']);
  });
});

describe('XML structure diagnostics', () => {
  it('reports exact line/column of an out-of-order child', () => {
    const xml = [
      '<task id="t">',
      '  <title>T</title>',
      '  <taskbody>',
      '    <steps><step><cmd>Do</cmd></step></steps>',
      '    <context><p>Late</p></context>',
      '  </taskbody>',
      '</task>',
    ].join('\n');
    const result = checkXmlStructure(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      code: 'child-out-of-order',
      parentTag: 'taskbody',
      childTag: 'context',
      line: 5,
      column: 5,
      severity: 'error',
    });
  });

  it('short-circuits on malformed XML', () => {
    const result = checkXmlStructure('<task><title>x</task>');
    expect(result.ok).toBe(false);
  });

  it('ignores comments and processing instructions between children', () => {
    const xml =
      '<concept id="c"><title>T</title><!-- note --><?pi data?>' +
      '<conbody><p>Body</p></conbody></concept>';
    const parsed = parseXml(xml);
    expect(collectXmlStructureIssues(parsed.document)).toEqual([]);
  });

  it('keeps every bundled fixture, demo project topic, and template structurally valid', () => {
    const fixtures = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith('.dita'));
    expect(fixtures.length).toBeGreaterThan(0);
    for (const name of fixtures) {
      const xml = readFileSync(join(FIXTURES_DIR, name), 'utf8');
      const result = checkXmlStructure(xml);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect({ file: name, issues: result.issues }).toEqual({ file: name, issues: [] });
    }

    const demoFiles = collectDitaFiles(DEMO_PROJECT_DIR);
    expect(demoFiles.length).toBeGreaterThan(0);
    for (const fullPath of demoFiles) {
      const xml = readFileSync(fullPath, 'utf8');
      const result = checkXmlStructure(xml);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect({ file: fullPath, issues: result.issues }).toEqual({ file: fullPath, issues: [] });
    }

    for (const type of ['concept', 'task', 'reference', 'topic'] as const) {
      for (const lang of ['zh-CN', 'en-US'] as const) {
        const result = checkXmlStructure(createTopicTemplate(type, { lang }));
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect({ template: `${type}:${lang}`, issues: result.issues }).toEqual({
          template: `${type}:${lang}`,
          issues: [],
        });
      }
    }

    for (const sample of DITA_SAMPLE_DOCUMENTS) {
      const result = checkXmlStructure(sample.xml);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect({ sample: sample.id, issues: result.issues }).toEqual({
        sample: sample.id,
        issues: [],
      });
    }
  });
});

describe('ProseMirror structure diagnostics', () => {
  it('maps violations onto ProseMirror positions without touching round-trip output', () => {
    const xml = [
      '<task id="t"><title>T</title><taskbody>',
      '<result><p>R</p></result><prereq><p>P</p></prereq>',
      '</taskbody></task>',
    ].join('');
    const { pmDoc } = xmlToPmDoc(xml);
    const serializedBefore = pmDocToXml(pmDoc);
    const issues = validatePmStructure(pmDoc);
    expect(issues).toHaveLength(1);
    const [issue] = issues;
    expect(issue).toMatchObject({
      code: 'child-out-of-order',
      parentTag: 'taskbody',
      childTag: 'prereq',
    });
    expect(issue!.pos).toBeGreaterThan(0);
    expect(issue!.size).toBeGreaterThan(0);
    // Diagnosing must never mutate the document.
    expect(pmDocToXml(pmDoc)).toBe(serializedBefore);
    expect(getPmChildTags(pmDoc.firstChild!)).toEqual(['title', 'taskbody']);
  });

  it('reports no issues for a valid task document', () => {
    const xml =
      '<task id="t"><title>T</title><shortdesc>S</shortdesc><taskbody>' +
      '<prereq><p>P</p></prereq><context><p>C</p></context>' +
      '<steps><step><cmd>Do</cmd></step></steps><result><p>R</p></result>' +
      '</taskbody></task>';
    const { pmDoc } = xmlToPmDoc(xml);
    expect(validatePmStructure(pmDoc)).toEqual([]);
  });
});
