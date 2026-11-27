import { describe, expect, it } from 'vitest';
import {
  checkXmlWellFormed,
  validateCheckinBatch,
  validateDitaFileForCheckin,
} from '../src/index.js';

/**
 * Step 1 regression tests (docs/plans/checkin-validation-ai-fix.md §5.1 CORE-7 / CORE-8): the
 * check-in gate is the shared decision point for `@dita/api` (hard gate) and `@dita/web`
 * (`CheckinDialog` pre-check), so it must report XML well-formedness, DITA 1.3 structure and
 * `.ditaval` syntax with identical file paths / lines / columns in both containers.
 */
const VALID_STRICT_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
  '<task id="t">',
  '  <title>T</title>',
  '  <taskbody>',
  '    <context><p>Create the map structure.</p></context>',
  '    <steps>',
  '      <step><cmd>Open the map editor.</cmd></step>',
  '    </steps>',
  '  </taskbody>',
  '</task>',
].join('\n');

const DUPLICATE_CMD_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
  '<task id="t">',
  '  <title>T</title>',
  '  <taskbody>',
  '    <steps>',
  '      <step>',
  '        <cmd>Open the map editor.</cmd>',
  '      </step>',
  '      <step>',
  '        <cmd>Type a map title.</cmd>',
  '        <cmd>Type a map title.</cmd>',
  '      </step>',
  '    </steps>',
  '  </taskbody>',
  '</task>',
].join('\n');

const MALFORMED_TASK = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
  '<task id="t">',
  '  <title>T</title>',
  '  <taskbody>',
  '    <steps>',
  '      <step><cmd>Open the map editor.</cmd>',
  '    </steps>',
  '  </taskbody>',
  '</task>',
].join('\n');

const GENERAL_TASK_WITH_SECTION = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA General Task//EN" "generalTask.dtd">',
  '<task id="t">',
  '  <title>T</title>',
  '  <taskbody>',
  '    <section>',
  '      <title>Background</title>',
  '      <p>General tasks may use sections.</p>',
  '    </section>',
  '  </taskbody>',
  '</task>',
].join('\n');

const INVALID_DITAVAL = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<val>',
  '  <prop att="audience" val="expert" action="exclude">',
  '</val>',
].join('\n');

const VALID_DITAVAL = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<val>',
  '  <prop att="audience" val="expert" action="exclude"/>',
  '</val>',
].join('\n');

const VALID_DITAMAP = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE map PUBLIC "-//OASIS//DTD DITA Map//EN" "map.dtd">',
  '<map id="m">',
  '  <title>M</title>',
  '</map>',
].join('\n');

const BROKEN_MAP = VALID_DITAMAP.replace('</map>', '');

describe('validateDitaFileForCheckin (CORE-7)', () => {
  it('returns no issues for a valid strict task, ditamap, ditaval, deleted or binary file', () => {
    expect(
      validateDitaFileForCheckin({ filePath: 'tasks/t.dita', content: VALID_STRICT_TASK }),
    ).toEqual([]);
    expect(
      validateDitaFileForCheckin({ filePath: 'maps/main.ditamap', content: VALID_DITAMAP }),
    ).toEqual([]);
    expect(
      validateDitaFileForCheckin({ filePath: 'config/print.ditaval', content: VALID_DITAVAL }),
    ).toEqual([]);
    // Deleted drafts never parse their historical content.
    expect(
      validateDitaFileForCheckin({
        filePath: 'tasks/gone.dita',
        content: MALFORMED_TASK,
        deleted: true,
      }),
    ).toEqual([]);
    // Binary / non-DITA kinds are not XML-validated.
    expect(
      validateDitaFileForCheckin({
        filePath: 'images/logo.png',
        content: '<not xml',
        binary: true,
      }),
    ).toEqual([]);
    expect(
      validateDitaFileForCheckin({ filePath: 'images/logo.png', content: 'not xml at all' }),
    ).toEqual([]);
    expect(
      validateDitaFileForCheckin({ filePath: 'notes/readme.md', content: 'not xml at all' }),
    ).toEqual([]);
  });

  it('reports a child-cardinality structure error with the exact line and column', () => {
    const issues = validateDitaFileForCheckin({
      filePath: 'tasks/create-map-structure.dita',
      content: DUPLICATE_CMD_TASK,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      filePath: 'tasks/create-map-structure.dita',
      source: 'structure',
      severity: 'error',
      code: 'child-cardinality',
      line: 12,
      column: 9,
    });
    expect(issues[0]?.message).toBe('<step> 中 <cmd> 最多只能出现一次');
  });

  it('reports malformed XML from the well-formedness gate instead of structure', () => {
    expect(checkXmlWellFormed(MALFORMED_TASK).ok).toBe(false);
    const issues = validateDitaFileForCheckin({ filePath: 'tasks/broken.dita', content: MALFORMED_TASK });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      filePath: 'tasks/broken.dita',
      source: 'xml',
      severity: 'error',
      code: 'xml-not-well-formed',
    });
    expect(issues[0]?.line).toBeGreaterThanOrEqual(1);
    expect(issues[0]?.column).toBeGreaterThanOrEqual(1);
    expect(issues[0]?.message).toContain('XML');
    // ditamap is gated on well-formedness only (structure rules are topic-specific).
    const mapIssues = validateDitaFileForCheckin({ filePath: 'maps/main.ditamap', content: BROKEN_MAP });
    expect(mapIssues.map((issue) => issue.source)).toEqual(['xml']);
  });

  it('does not flag generalTask.dtd sections as structure violations', () => {
    expect(
      validateDitaFileForCheckin({ filePath: 'tasks/general.dita', content: GENERAL_TASK_WITH_SECTION }),
    ).toEqual([]);
  });

  it('reports .ditaval syntax errors from parseDitaval', () => {
    const issues = validateDitaFileForCheckin({
      filePath: 'config/print.ditaval',
      content: INVALID_DITAVAL,
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      filePath: 'config/print.ditaval',
      source: 'ditaval',
      severity: 'error',
      code: 'ditaval-syntax',
      line: 4,
      column: 6,
    });
    expect(issues[0]?.message).toContain('DITAVAL');
  });
});

describe('validateCheckinBatch (CORE-8)', () => {
  const files = [
    { filePath: 'tasks/create-map-structure.dita', content: DUPLICATE_CMD_TASK },
    { filePath: 'tasks/valid.dita', content: VALID_STRICT_TASK },
  ];

  it('returns ok=false with only the failing file in zh-CN', () => {
    const batch = validateCheckinBatch(files, 'zh-CN');
    expect(batch.ok).toBe(false);
    expect(batch.errors).toHaveLength(1);
    expect(batch.warnings).toEqual([]);
    expect(batch.errors[0]).toMatchObject({
      filePath: 'tasks/create-map-structure.dita',
      line: 12,
      column: 9,
      code: 'child-cardinality',
    });
    expect(batch.errors[0]?.message).toContain('最多只能出现一次');
    expect(batch.errors[0]?.message).toContain('<cmd>');
  });

  it('localizes the same batch into English without changing file, line or column', () => {
    const zh = validateCheckinBatch(files, 'zh-CN');
    const en = validateCheckinBatch(files, 'en');
    expect(en.ok).toBe(false);
    expect(en.errors).toHaveLength(1);
    expect(en.errors[0]).toMatchObject({
      filePath: 'tasks/create-map-structure.dita',
      line: 12,
      column: 9,
      code: 'child-cardinality',
    });
    expect(en.errors[0]?.message).toContain('<cmd>');
    expect(en.errors[0]?.message).toContain('at most once');
    expect(en.errors[0]?.message).not.toBe(zh.errors[0]?.message);
  });

  it('is ok when every file passes the gate', () => {
    const batch = validateCheckinBatch(
      [{ filePath: 'tasks/valid.dita', content: VALID_STRICT_TASK }],
      'en',
    );
    expect(batch).toEqual({ ok: true, errors: [], warnings: [] });
  });
});
