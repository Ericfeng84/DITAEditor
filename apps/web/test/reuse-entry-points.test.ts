import { describe, expect, it } from 'vitest';
import { EditorState, type Command } from 'prosemirror-state';
import { history, redo, undo } from 'prosemirror-history';
import { getPmNodeRawAttrs, pmDocToXml, xmlToPmDoc } from '@dita/core';
import { collectTopicElementIds, generateSemanticElementId } from '@dita/core';
import {
  insertReuseReferenceAtPos,
  replaceBlockWithReuseAtPos,
  updateNodeRawAttr,
} from '../src/editor/visual/commands';
import {
  DEFAULT_SNIPPET_TAG,
  DITA_ELEMENT_ID_PATTERN,
  SNIPPET_TAGS,
  isWarehousePath,
  resolveWarehouseTargetValue,
  sortWarehouseTargets,
  validateSnippetId,
} from '../src/components/CreateReusableSnippetDialog';
import { zhCN } from '../src/i18n/messages/zh-CN';
import { en } from '../src/i18n/messages/en';

/**
 * The reuse entry points are pure command factories: `VisualEditorHandle.insertReuseAtPos` and
 * `.replaceBlockWithReuse` are thin wrappers that run exactly these commands through one
 * ProseMirror transaction, so covering the commands covers the handle's undo semantics too.
 */

const REUSE_TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="reuse_topic"><title>Reuse topic</title><body>
<note id="n1" audience="admin" platform="linux" conref="legacy.dita#legacy_note" type="warning">Battery warning text.</note>
<p id="p_after">After the note.</p>
</body></topic>`;

interface DispatchResult {
  state: EditorState;
  transactions: number;
  ok: boolean;
}

function createState(): EditorState {
  const { pmDoc } = xmlToPmDoc(REUSE_TOPIC_XML);
  return EditorState.create({ doc: pmDoc, plugins: [history()] });
}

function dispatch(state: EditorState, cmd: Command): DispatchResult {
  let next = state;
  let transactions = 0;
  const ok = cmd(state, (tr) => {
    transactions += 1;
    next = state.apply(tr);
  });
  return { state: next, transactions, ok };
}

function findNode(state: EditorState, typeName: string): { pos: number; nodeSize: number } {
  let found: { pos: number; nodeSize: number } | null = null;
  state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === typeName) {
      found = { pos, nodeSize: node.nodeSize };
      return false;
    }
    return true;
  });
  if (!found) throw new Error(`fixture is missing a ${typeName} node`);
  return found;
}

describe('replaceBlockWithReuseAtPos', () => {
  it('replaces the block in a single transaction while keeping profiling attributes', () => {
    const state = createState();
    const note = findNode(state, 'dita_note');

    const result = dispatch(
      state,
      replaceBlockWithReuseAtPos(note.pos, 'conkeyref', 'reuse_snippets/note_battery_warning'),
    );

    expect(result.ok).toBe(true);
    expect(result.transactions).toBe(1);

    const replaced = result.state.doc.nodeAt(note.pos);
    expect(replaced).not.toBeNull();
    expect(getPmNodeRawAttrs(replaced!).map((attr) => attr.name)).toEqual([
      'audience',
      'platform',
      'conkeyref',
    ]);
    expect(getPmNodeRawAttrs(replaced!).map((attr) => attr.value)).toEqual([
      'admin',
      'linux',
      'reuse_snippets/note_battery_warning',
    ]);

    const xml = pmDocToXml(result.state.doc);
    expect(xml).toContain(
      '<note audience="admin" platform="linux" conkeyref="reuse_snippets/note_battery_warning"/>',
    );
    // The old identity and the opposite reuse attribute must not survive the swap.
    expect(xml).not.toContain('id="n1"');
    expect(xml).not.toContain('conref="legacy.dita#legacy_note"');
    expect(xml).not.toContain('type="warning"');
    expect(xml).not.toContain('Battery warning text.');
    // Nothing else in the topic moved.
    expect(xml).toContain('<p id="p_after">After the note.</p>');
  });

  it('is restored by one undo and re-applied by one redo', () => {
    const state = createState();
    const originalXml = pmDocToXml(state.doc);
    const note = findNode(state, 'dita_note');

    const replaced = dispatch(
      state,
      replaceBlockWithReuseAtPos(note.pos, 'conref', 'reuse/common-snippets.dita#note_warning'),
    );
    expect(replaced.ok).toBe(true);
    const replacedXml = pmDocToXml(replaced.state.doc);
    expect(replacedXml).toContain(
      '<note audience="admin" platform="linux" conref="reuse/common-snippets.dita#note_warning"/>',
    );

    const undone = dispatch(replaced.state, undo);
    expect(undone.ok).toBe(true);
    expect(undone.transactions).toBe(1);
    expect(pmDocToXml(undone.state.doc)).toBe(originalXml);

    const redone = dispatch(undone.state, redo);
    expect(redone.ok).toBe(true);
    expect(pmDocToXml(redone.state.doc)).toBe(replacedXml);
  });

  it('refuses containers that may not carry a reuse reference', () => {
    const state = createState();
    const title = findNode(state, 'dita_title');

    const result = dispatch(
      state,
      replaceBlockWithReuseAtPos(title.pos, 'conkeyref', 'reuse_snippets/title_x'),
    );

    expect(result.ok).toBe(false);
    expect(result.transactions).toBe(0);
  });
});

describe('insertReuseReferenceAtPos', () => {
  it('inserts a block reference at the requested position in one transaction', () => {
    const state = createState();
    const note = findNode(state, 'dita_note');
    const insertPos = note.pos + note.nodeSize;

    const result = dispatch(
      state,
      insertReuseReferenceAtPos('p', insertPos, 'conkeyref', 'reuse_snippets/p_battery'),
    );

    expect(result.ok).toBe(true);
    expect(result.transactions).toBe(1);
    const xml = pmDocToXml(result.state.doc);
    expect(xml).toContain('<p conkeyref="reuse_snippets/p_battery"/>');
    expect(xml).toContain('Battery warning text.');
  });

  it('inserts an inline reference inside a paragraph', () => {
    const state = createState();
    const paragraph = findNode(state, 'dita_p');
    const textEnd = paragraph.pos + paragraph.nodeSize - 1;

    const result = dispatch(
      state,
      insertReuseReferenceAtPos('ph', textEnd, 'conref', 'reuse/common-snippets.dita#ph_vendor'),
    );

    expect(result.ok).toBe(true);
    expect(result.transactions).toBe(1);
    expect(pmDocToXml(result.state.doc)).toContain(
      '<ph conref="reuse/common-snippets.dita#ph_vendor"/>',
    );
  });

  it('rejects an insertion point that is not a legal DITA position', () => {
    const state = createState();
    const result = dispatch(
      state,
      insertReuseReferenceAtPos('p', state.doc.content.size + 20, 'conkeyref', 'k/x'),
    );
    expect(result.ok).toBe(false);
    expect(result.transactions).toBe(0);
  });
});

describe('make reusable id assignment', () => {
  const MAKE_REUSABLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">
<topic id="assign_topic"><title>Assign</title><body>
<note audience="admin" platform="linux" type="warning">Battery warning text.</note>
</body></topic>`;

  function makeReusableState() {
    const { pmDoc } = xmlToPmDoc(MAKE_REUSABLE_XML);
    return EditorState.create({ doc: pmDoc, plugins: [history()] });
  }

  it('writes a unique semantic id and keeps existing attributes in place', () => {
    const state = makeReusableState();
    const note = findNode(state, 'dita_note');
    const original = state.doc.nodeAt(note.pos)!;
    const originalNames = getPmNodeRawAttrs(original).map((attr) => attr.name);
    expect(originalNames).toEqual(['audience', 'platform', 'type']);

    const existingIds = collectTopicElementIds(pmDocToXml(state.doc));
    const id = generateSemanticElementId('note', 'Battery warning text.', existingIds);
    expect(DITA_ELEMENT_ID_PATTERN.test(id)).toBe(true);
    expect(id.startsWith('note')).toBe(true);
    expect(existingIds.has(id)).toBe(false);

    const result = dispatch(state, updateNodeRawAttr(note.pos, 'id', id));
    expect(result.ok).toBe(true);
    expect(result.transactions).toBe(1);

    const nextRaw = getPmNodeRawAttrs(result.state.doc.nodeAt(note.pos)!);
    // Only an appended `id`: every pre-existing attribute keeps its original slot and value.
    expect(nextRaw.map((attr) => attr.name)).toEqual([...originalNames, 'id']);
    expect(nextRaw.filter((attr) => attr.name !== 'id')).toEqual(getPmNodeRawAttrs(original));

    const xml = pmDocToXml(result.state.doc);
    expect(xml).toContain(`id="${id}"`);
    expect(xml).toContain('audience="admin"');
    expect(xml).toContain('platform="linux"');
    expect(xml).toContain('type="warning"');
    // The assigned id is now the conref target the warehouse lookup will report.
    expect(collectTopicElementIds(xml).has(id)).toBe(true);
  });

  it('generates a different id once the first one is in the document', () => {
    const state = makeReusableState();
    const note = findNode(state, 'dita_note');
    const first = generateSemanticElementId(
      'note',
      'Battery warning text.',
      collectTopicElementIds(pmDocToXml(state.doc)),
    );
    const afterFirst = dispatch(state, updateNodeRawAttr(note.pos, 'id', first)).state;
    const second = generateSemanticElementId(
      'note',
      'Battery warning text.',
      collectTopicElementIds(pmDocToXml(afterFirst.doc)),
    );
    expect(second).not.toBe(first);
    expect(DITA_ELEMENT_ID_PATTERN.test(second)).toBe(true);
  });

  it('restores the id-less block on undo', () => {
    const state = makeReusableState();
    const note = findNode(state, 'dita_note');
    const before = pmDocToXml(state.doc);
    const id = generateSemanticElementId(
      'note',
      'Battery warning text.',
      collectTopicElementIds(before),
    );
    const applied = dispatch(state, updateNodeRawAttr(note.pos, 'id', id)).state;
    const undone = dispatch(applied, undo).state;
    expect(pmDocToXml(undone.doc)).toBe(before);
    expect(dispatch(undone, redo).state).toBeDefined();
  });
});

describe('CreateReusableSnippetDialog pure helpers', () => {
  it('starts create mode from a paragraph', () => {
    expect(DEFAULT_SNIPPET_TAG).toBe('p');
    expect(SNIPPET_TAGS[0]).toBe('p');
    expect(SNIPPET_TAGS).toContain(DEFAULT_SNIPPET_TAG);
  });

  it('validates ids against the DITA charset and the target topic ids', () => {
    expect(DITA_ELEMENT_ID_PATTERN.test('note_battery_warning')).toBe(true);
    expect(DITA_ELEMENT_ID_PATTERN.test('1bad')).toBe(false);

    expect(validateSnippetId('   ', new Set())).toEqual({ ok: false, issue: 'empty' });
    expect(validateSnippetId('bad id', new Set())).toEqual({ ok: false, issue: 'pattern' });
    expect(validateSnippetId('-bad', new Set())).toEqual({ ok: false, issue: 'pattern' });
    expect(validateSnippetId('note_warning', new Set(['note_warning']))).toEqual({
      ok: false,
      issue: 'duplicate',
    });
    expect(validateSnippetId('  note_warning  ', new Set(['other']))).toEqual({
      ok: true,
      id: 'note_warning',
    });
  });

  it('prefers conkeyref when the warehouse file is bound to a root-map key', () => {
    expect(
      resolveWarehouseTargetValue({
        keyName: 'reuse_snippets',
        activeDocPath: 'topics/intro.dita',
        targetFilePath: 'reuse/common-snippets.dita',
        elementId: 'note_warning',
      }),
    ).toEqual({ attrName: 'conkeyref', value: 'reuse_snippets/note_warning' });
  });

  it('falls back to a relative conref href without a key', () => {
    expect(
      resolveWarehouseTargetValue({
        keyName: null,
        activeDocPath: 'topics/intro.dita',
        targetFilePath: 'reuse/common-snippets.dita',
        elementId: 'note_warning',
      }),
    ).toEqual({ attrName: 'conref', value: '../reuse/common-snippets.dita#note_warning' });

    expect(
      resolveWarehouseTargetValue({
        keyName: '   ',
        activeDocPath: null,
        targetFilePath: 'reuse/common-snippets.dita',
        elementId: 'note_warning',
      }),
    ).toEqual({ attrName: 'conref', value: 'reuse/common-snippets.dita#note_warning' });
  });

  it('lists warehouse-looking topics first in the target dropdown', () => {
    expect(isWarehousePath('reuse/common-snippets.dita')).toBe(true);
    expect(isWarehousePath('topics/intro.dita')).toBe(false);
    expect(
      sortWarehouseTargets([
        'topics/zeta.dita',
        'topics/alpha.dita',
        'reuse/common-snippets.dita',
      ]),
    ).toEqual(['reuse/common-snippets.dita', 'topics/alpha.dita', 'topics/zeta.dita']);
  });
});

describe('reuse entry-point i18n', () => {
  const zh = zhCN as Record<string, string>;
  const enMessages = en as Record<string, string>;

  const REUSE_KEYS = Object.keys(zh).filter(
    (key) =>
      key.startsWith('reuseDialog.') ||
      key.startsWith('reuse.') ||
      key.startsWith('conref.') ||
      key === 'block.makeReusable' ||
      key === 'block.extractToReuse' ||
      key === 'status.warehouseCreated' ||
      key.startsWith('insertMenu.reuse') ||
      key.startsWith('insertMenu.special') ||
      key === 'visual.announce.reuseReferenceInserted' ||
      key === 'visual.announce.reuseReferenceBlocked' ||
      key === 'visual.announce.reuseBlockReplaced' ||
      key === 'visual.announce.reuseReplaceBlocked' ||
      key === 'visual.announce.reuseIdPrompt',
  );

  const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

  it('ships every reuse key in both locales with matching placeholders', () => {
    expect(REUSE_KEYS.length).toBeGreaterThan(30);
    for (const key of REUSE_KEYS) {
      expect(enMessages[key], `missing en translation for ${key}`).toBeTruthy();
      expect(placeholders(enMessages[key] ?? '')).toEqual(placeholders(zh[key] ?? ''));
    }
    expect(Object.keys(enMessages).sort()).toEqual(Object.keys(zh).sort());
  });

  it('keeps the searchable reuse keywords free of CJK in the English catalog', () => {
    expect(enMessages['insertMenu.reuseKeywords']).toContain('conkeyref');
    expect(/[\u4e00-\u9fff]/.test(enMessages['insertMenu.reuseKeywords'] ?? '')).toBe(false);
    expect(zh['insertMenu.reuseKeywords']).toContain('复用');
  });
});
