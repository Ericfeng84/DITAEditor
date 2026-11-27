import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import {
  appendReusableFragmentToTopicXml,
  collectTopicElementIds,
  createTopicTemplate,
  createWarehouseTopicTemplate,
  generateSemanticElementId,
  roundTripXmlThroughPm,
  serializePmBlockToXml,
  xmlToPmDoc,
} from '../src/index.js';

const WAREHOUSE_TOPIC = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="urn:oasis:names:tc:dita:rng:topic.rng" schematypens="http://relaxng.org/ns/structure/1.0"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<!-- Warehouse header comment preserved across edits -->
<topic id="topic_reuse" xml:lang="zh-CN">
  <title>复用片段仓库</title>
  <shortdesc>集中存放跨主题共享的可复用片段。</shortdesc>
  <body>
    <!-- fragments below -->
    <note id="note_existing"><p>Existing note.</p></note>
  </body>
</topic>
`;

describe('createWarehouseTopicTemplate', () => {
  it('creates a zh-CN warehouse topic with prolog comment and an empty body', () => {
    const xml = createWarehouseTopicTemplate();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">');
    expect(xml).toContain('xml:lang="zh-CN"');
    expect(xml).toContain('<title>复用仓库主题</title>');
    expect(xml).toContain('resource-only');
    expect(xml).toContain('<!--');
    // No demo sections / paragraphs that would clutter reuse candidate lists
    expect(xml).not.toContain('<p>');
    expect(xml).not.toContain('<section');
    expect(roundTripXmlThroughPm(xml).xml).toBe(xml);
  });

  it('creates an en-US warehouse topic for /^en\\b/i languages', () => {
    const xml = createWarehouseTopicTemplate({ id: 'reuse_common', lang: 'en-US', title: 'Shared Fragments' });
    expect(xml).toContain('xml:lang="en-US"');
    expect(xml).toContain('<topic id="reuse_common"');
    expect(xml).toContain('<title>Shared Fragments</title>');
    expect(xml).not.toContain('<p>');
    expect(roundTripXmlThroughPm(xml).xml).toBe(xml);
  });

  it('stays idempotent through the ProseMirror round trip in both languages', () => {
    for (const lang of ['zh-CN', 'en-GB']) {
      const xml = createWarehouseTopicTemplate({ lang });
      const pass1 = roundTripXmlThroughPm(xml);
      expect(pass1.xml).toBe(xml);
      expect(roundTripXmlThroughPm(pass1.xml).xml).toBe(xml);
    }
  });
});

describe('generateSemanticElementId', () => {
  it('derives a DITA id from the tag name plus ASCII words of the preview', () => {
    const id = generateSemanticElementId('note', 'Restart the worker before upgrading', new Set());
    expect(id).toBe('note_restart_the_worker');
    expect(id).toMatch(/^[A-Za-z_][A-Za-z0-9_.-]*$/);
  });

  it('falls back to a numbered id for non-ASCII previews', () => {
    expect(generateSemanticElementId('ph', '请先重启服务', new Set())).toBe('ph');
    expect(generateSemanticElementId('ph', '请先重启服务', new Set(['ph']))).toBe('ph_1');
    expect(generateSemanticElementId('ph', '请先重启服务', new Set(['ph', 'ph_1']))).toBe('ph_2');
  });

  it('avoids collisions with existing ids via an incrementing numeric suffix', () => {
    const existing = new Set(['note_restart_required']);
    expect(generateSemanticElementId('note', 'Restart required', existing)).toBe(
      'note_restart_required_1',
    );
    existing.add('note_restart_required_1');
    expect(generateSemanticElementId('note', 'Restart required', existing)).toBe(
      'note_restart_required_2',
    );
  });
});

describe('collectTopicElementIds', () => {
  it('collects every @id in a topic', () => {
    const ids = collectTopicElementIds(WAREHOUSE_TOPIC);
    expect(ids).toEqual(new Set(['topic_reuse', 'note_existing']));
  });

  it('returns an empty set for malformed XML', () => {
    expect(collectTopicElementIds('<topic id="t"><body>').size).toBe(0);
  });
});

describe('appendReusableFragmentToTopicXml', () => {
  it('appends a <p> directly to <body> and preserves the prolog, comments and PIs', () => {
    const result = appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
      tagName: 'p',
      elementId: 'p_shared_intro',
      textContent: 'Shared intro paragraph.',
    });
    if (!result.ok) throw new Error(result.error);

    expect(result.topicId).toBe('topic_reuse');
    expect(result.elementId).toBe('p_shared_intro');
    expect(result.tagName).toBe('p');

    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.xml).toContain('<?xml-model href="urn:oasis:names:tc:dita:rng:topic.rng"');
    expect(result.xml).toContain('<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">');
    expect(result.xml).toContain('<!-- Warehouse header comment preserved across edits -->');
    expect(result.xml).toContain('<!-- fragments below -->');
    expect(result.xml).toContain('<p id="p_shared_intro">Shared intro paragraph.</p>');
    expect(result.xml).toContain('<note id="note_existing">');

    // the new block lands inside <body>, after the existing note
    expect(result.xml.indexOf('<p id="p_shared_intro">')).toBeGreaterThan(
      result.xml.indexOf('note_existing'),
    );
    expect(resolveRootIds(result.xml).has('p_shared_intro')).toBe(true);
    expect(roundTripXmlThroughPm(result.xml).xml).toBe(result.xml);
  });

  it('appends <note>, <section> and <codeblock> as direct body blocks', () => {
    const note = expectOk(
      appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
        tagName: 'note',
        elementId: 'note_restart_required',
        textContent: 'Restart the worker after changing logging levels.',
      }),
    );
    expect(note.xml).toContain('<note id="note_restart_required">Restart the worker');

    const section = expectOk(
      appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
        tagName: 'section',
        elementId: 'sec_shared_limits',
        fragmentXml: '<section id="tmp"><title>Shared Limits</title><p>Body.</p></section>',
      }),
    );
    expect(section.xml).toContain('<section id="sec_shared_limits">');
    expect(section.xml).toContain('<title>Shared Limits</title>');
    expect(roundTripXmlThroughPm(section.xml).xml).toBe(section.xml);

    const codeblock = expectOk(
      appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
        tagName: 'codeblock',
        elementId: 'code_health_check',
        textContent: 'curl -fsS http://localhost:8090/health',
      }),
    );
    expect(codeblock.xml).toContain('<codeblock id="code_health_check">curl -fsS');
    expect(roundTripXmlThroughPm(codeblock.xml).xml).toBe(codeblock.xml);
  });

  it('wraps inline <ph> inside <p>', () => {
    const result = expectOk(
      appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
        tagName: 'ph',
        elementId: 'ph_prod_name',
        textContent: 'DITAEditor',
      }),
    );
    expect(result.xml).toContain('<p><ph id="ph_prod_name">DITAEditor</ph></p>');
    expect(roundTripXmlThroughPm(result.xml).xml).toBe(result.xml);
  });

  it('wraps <li> inside <ul>', () => {
    const result = expectOk(
      appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
        tagName: 'li',
        elementId: 'li_reuse_hint',
        textContent: 'Reuse the shared note instead of copying it.',
      }),
    );
    expect(result.xml).toContain('<ul>');
    expect(result.xml).toContain('<li id="li_reuse_hint">Reuse the shared note instead of copying it.</li>');
    expect(result.xml.indexOf('<ul>')).toBeLessThan(result.xml.indexOf('li_reuse_hint'));
    expect(roundTripXmlThroughPm(result.xml).xml).toBe(result.xml);
  });

  it('clones fragmentXml, forces the requested id and strips conref attributes', () => {
    const result = expectOk(
      appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
        tagName: 'note',
        elementId: 'note_quoted_copy',
        fragmentXml:
          '<note id="note_source" conref="other.dita#t/n1" conkeyref="keys/n2" conrefend="other.dita#t/n9" type="warning"><p>Quoted.</p></note>',
      }),
    );
    expect(result.tagName).toBe('note');
    expect(result.xml).toContain('<note id="note_quoted_copy" type="warning">');
    expect(result.xml).not.toContain('conref');
    expect(result.xml).not.toContain('conkeyref');
    expect(result.xml).toContain('<p>Quoted.</p>');
    expect(roundTripXmlThroughPm(result.xml).xml).toBe(result.xml);
  });

  it('rejects duplicate ids and invalid id patterns', () => {
    const duplicate = appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
      tagName: 'p',
      elementId: 'note_existing',
      textContent: 'Dup.',
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) throw new Error('expected failure');
    expect(duplicate.error).toContain('already exists');

    const invalid = appendReusableFragmentToTopicXml(WAREHOUSE_TOPIC, {
      tagName: 'p',
      elementId: '9-not-an-id',
      textContent: 'Bad id.',
    });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error('expected failure');
    expect(invalid.error).toContain('Invalid DITA element id');
  });

  it('rejects malformed topic XML and non-topic roots', () => {
    const malformed = appendReusableFragmentToTopicXml('<topic id="t"><body>', {
      tagName: 'p',
      elementId: 'p_x',
    });
    expect(malformed.ok).toBe(false);
    if (malformed.ok) throw new Error('expected failure');
    expect(malformed.error).toContain('not well-formed');

    const mapRoot = appendReusableFragmentToTopicXml('<map id="m"/>', {
      tagName: 'p',
      elementId: 'p_x',
    });
    expect(mapRoot.ok).toBe(false);
    if (mapRoot.ok) throw new Error('expected failure');
    expect(mapRoot.error).toContain('not a DITA topic root');
  });

  it('creates a missing <body> before <related-links>', () => {
    const topic = '<topic id="t_body"><title>T</title><related-links><link href="a.dita"/></related-links></topic>';
    const result = expectOk(
      appendReusableFragmentToTopicXml(topic, {
        tagName: 'p',
        elementId: 'p_created_body',
        textContent: 'Body was created.',
      }),
    );
    expect(result.xml.indexOf('<body>')).toBeGreaterThan(-1);
    expect(result.xml.indexOf('<body>')).toBeLessThan(result.xml.indexOf('<related-links>'));
    expect(result.xml).toContain('<p id="p_created_body">Body was created.</p>');
  });

  it('keeps Strict Task compliant: flow blocks go into <context>', () => {
    const task = createTopicTemplate('task', { id: 'task_reuse', lang: 'en-US' });
    const result = expectOk(
      appendReusableFragmentToTopicXml(task, {
        tagName: 'p',
        elementId: 'p_task_shared',
        textContent: 'Shared task context paragraph.',
      }),
    );
    expect(result.xml).toMatch(/<context>[\s\S]*<p id="p_task_shared">[\s\S]*<\/context>/);
    expect(result.xml).not.toMatch(/<steps>[\s\S]*p_task_shared/);

    // a second flow block reuses the existing <context>
    const note = expectOk(
      appendReusableFragmentToTopicXml(result.xml, {
        tagName: 'note',
        elementId: 'note_task_shared',
        textContent: 'Shared task note.',
      }),
    );
    expect(note.xml.match(/<context>/g)?.length).toBe(1);
    expect(note.xml).toMatch(/<context>[\s\S]*note_task_shared[\s\S]*<\/context>/);
    expect(roundTripXmlThroughPm(note.xml).xml).toBe(note.xml);
  });

  it('creates a <context> at the Strict Task slot when the taskbody has none', () => {
    const task =
      '<task id="t_task"><title>T</title><taskbody><steps><step><cmd>Go.</cmd></step></steps></taskbody></task>';
    const result = expectOk(
      appendReusableFragmentToTopicXml(task, {
        tagName: 'note',
        elementId: 'note_task_slot',
        textContent: 'Inserted before steps.',
      }),
    );
    expect(result.xml).toContain('<context>');
    expect(result.xml.indexOf('<context>')).toBeLessThan(result.xml.indexOf('<steps>'));
    expect(result.xml).toMatch(/<context>[\s\S]*note_task_slot[\s\S]*<\/context>/);
  });

  it('places <section> inside <example> for Strict Task bodies', () => {
    const task = createTopicTemplate('task', { id: 'task_section', lang: 'en-US' });
    const result = expectOk(
      appendReusableFragmentToTopicXml(task, {
        tagName: 'section',
        elementId: 'sec_task_shared',
        fragmentXml: '<section><title>Shared Section</title><p>Section body.</p></section>',
      }),
    );
    expect(result.xml).toMatch(/<example>[\s\S]*<section id="sec_task_shared">[\s\S]*<\/example>/);
    expect(roundTripXmlThroughPm(result.xml).xml).toBe(result.xml);
  });
});

describe('serializePmBlockToXml', () => {
  it('serializes one ProseMirror block with nested inline tags and preserved attribute order', () => {
    const topicXml = `<topic id="t"><title>T</title><body><p outputclass="lead" id="p1">Hello <b class="k">bold <i>it</i></b> <ph keyref="prod"/></p></body></topic>`;
    const { pmDoc } = xmlToPmDoc(topicXml);

    const blocks: PMNode[] = [];
    pmDoc.descendants((node) => {
      if (node.type.name === 'dita_p') blocks.push(node);
    });
    const pNode = blocks[0];
    if (!pNode) throw new Error('dita_p node not found');

    expect(serializePmBlockToXml(pNode)).toBe(
      '<p outputclass="lead" id="p1">Hello <b class="k">bold <i>it</i></b> <ph keyref="prod"/></p>',
    );
  });

  it('serializes a block without XML declaration or trailing newline', () => {
    const topicXml = `<topic id="t"><title>T</title><body><note id="n1" type="tip"><p>Tip.</p></note></body></topic>`;
    const { pmDoc } = xmlToPmDoc(topicXml);

    const notes: PMNode[] = [];
    pmDoc.descendants((node) => {
      if (node.type.name === 'dita_note') notes.push(node);
    });
    const noteNode = notes[0];
    if (!noteNode) throw new Error('dita_note node not found');

    const xml = serializePmBlockToXml(noteNode);
    expect(xml.startsWith('<note')).toBe(true);
    expect(xml).not.toContain('<?xml');
    expect(xml.endsWith('\n')).toBe(false);
    expect(xml).toBe('<note id="n1" type="tip">\n  <p>Tip.</p>\n</note>');
  });
});

function expectOk(
  result: ReturnType<typeof appendReusableFragmentToTopicXml>,
): Extract<ReturnType<typeof appendReusableFragmentToTopicXml>, { ok: true }> {
  if (!result.ok) throw new Error(result.error);
  return result;
}

function resolveRootIds(xml: string): Set<string> {
  return collectTopicElementIds(xml);
}
