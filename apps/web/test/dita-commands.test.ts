import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import {
  createTopicTemplate,
  DITA_SAMPLE_DOCUMENTS,
  pmDocToXml,
  validatePmStructure,
  xmlToPmDoc,
} from '@dita/core';
import {
  handleDitaEnter,
  insertBlockDitaElement,
  toggleInlineDitaElement,
  updateNodeRawAttr,
} from '../src/editor/visual/commands';
import { getSelectionSnapshot } from '../src/editor/visual/selection-info';

function runCmd(state: EditorState, cmd: Command): EditorState {
  let nextState = state;
  const ok = cmd(state, (tr) => {
    nextState = state.apply(tr);
  });
  expect(ok).toBe(true);
  return nextState;
}

describe('Phase 1 DITA ProseMirror Editing Commands', () => {
  it('wraps and unwraps inline elements as ProseMirror inline nodes with rawAttrs intact', () => {
    const xml = createTopicTemplate('topic', { id: 'inline_test', title: 'Inline Test' });
    const { pmDoc } = xmlToPmDoc(xml);
    let state = EditorState.create({ doc: pmDoc });

    // Locate `<p>` inside `<body>` and select 4 characters
    let pPos = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dita_p') {
        pPos = pos;
        return false;
      }
      return true;
    });
    expect(pPos).toBeGreaterThan(0);

    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, pPos + 1, pPos + 5)),
    );

    // Wrap in `<b outputclass="strong">`
    state = runCmd(
      state,
      toggleInlineDitaElement('b', [{ name: 'outputclass', value: 'strong', namespaceURI: null }]),
    );
    const wrappedXml = pmDocToXml(state.doc);
    expect(wrappedXml).toContain('<b outputclass="strong">');

    // Toggling `b` again unwraps it back to clean XML
    state = runCmd(state, toggleInlineDitaElement('b'));
    const unwrappedXml = pmDocToXml(state.doc);
    expect(unwrappedXml).not.toContain('<b>');
    expect(unwrappedXml).not.toContain('<b ');
    expect(unwrappedXml).toBe(xml);
  });

  it('creates a new <step><cmd/></step> when pressing Enter inside a task <cmd>', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    // Put cursor at end of first `<cmd>`
    let cmdEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dita_cmd') {
        cmdEnd = pos + 1 + node.content.size;
        return false;
      }
      return true;
    });
    expect(cmdEnd).toBeGreaterThan(0);

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, cmdEnd)));
    state = runCmd(state, handleDitaEnter);

    // Type text into the new step's `<cmd>`
    state = state.apply(state.tr.insertText('Verify container logs.'));
    const outXml = pmDocToXml(state.doc);
    expect(outXml).toContain('<step>\n        <cmd>Verify container logs.</cmd>\n      </step>');
  });

  it('inserts literal newline inside <codeblock> on Enter (preserving whitespace verbatim)', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    let codeEnd = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dita_codeblock') {
        codeEnd = pos + 1 + node.content.size;
        return false;
      }
      return true;
    });
    expect(codeEnd).toBeGreaterThan(0);

    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, codeEnd)));
    state = runCmd(state, handleDitaEnter);
    state = state.apply(state.tr.insertText('  echo "done"'));

    const outXml = pmDocToXml(state.doc);
    expect(outXml).toContain('curl -fsS http://localhost:8090/health\n  echo "done"</codeblock>');
  });

  it('updates attributes in-place via updateNodeRawAttr without reordering siblings or causing extra diff', () => {
    const conceptSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(conceptSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    let notePos = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dita_note') {
        notePos = pos;
        return false;
      }
      return true;
    });
    expect(notePos).toBeGreaterThan(0);

    state = runCmd(state, updateNodeRawAttr(notePos, 'type', 'warning'));
    const outXml = pmDocToXml(state.doc);

    const oldLines = conceptSample.xml.split('\n');
    const newLines = outXml.split('\n');
    const changed = oldLines.filter((l, i) => l !== newLines[i]);
    expect(changed).toHaveLength(1);
    expect(outXml).toContain('<note type="warning">');
  });

  it('inserts context-valid <note> and exposes accurate breadcrumbs in getSelectionSnapshot()', () => {
    const xml = createTopicTemplate('concept', { id: 'c1', title: 'Concept 1' });
    const { pmDoc } = xmlToPmDoc(xml);
    let state = EditorState.create({ doc: pmDoc });

    // Place cursor inside the first `<p>` in `<conbody>`
    let pInside = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'dita_p') {
        pInside = pos + 1;
        return false;
      }
      return true;
    });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, pInside)));

    const snapBefore = getSelectionSnapshot(state);
    expect(snapBefore.breadcrumbs.map((b) => b.tagName)).toEqual(['concept', 'conbody', 'p']);
    expect(snapBefore.insertGroups.some((g) => g.containerTag === 'conbody')).toBe(true);
    // Block structures come first; the inline group (if any) is always the last section,
    // because the insert menu's first section is what arrow keys land on.
    const kinds = snapBefore.insertGroups.map((g) => g.insertKind);
    expect(kinds.indexOf('inline')).toBe(kinds.length - 1);
    expect(kinds[0]).toBe('block');

    state = runCmd(state, insertBlockDitaElement('note'));
    const outXml = pmDocToXml(state.doc);
    expect(outXml).toContain('<note type="note">');
  });
});

describe('Block insertion from a cursor inside an inline tag never treats <p> as the container', () => {
  it('offers block elements under <conbody> (not <p>) and inserts after the paragraph', () => {
    const conceptSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(conceptSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    let firstPPos = -1;
    state.doc.descendants((node, pos) => {
      if (firstPPos === -1 && node.type.name === 'dita_p') {
        firstPPos = pos;
        return false;
      }
      return true;
    });
    expect(firstPPos).toBeGreaterThan(0);
    const pContentSize = state.doc.nodeAt(firstPPos)!.content.size;

    // Cursor inside the `<b>模块化</b>` inline node nested in the paragraph.
    let bInside = -1;
    state.doc.descendants((node, pos) => {
      if (bInside === -1 && node.type.name === 'dita_b') {
        bInside = pos + 1;
        return false;
      }
      return true;
    });
    expect(bInside).toBeGreaterThan(0);
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, bInside)));

    const snapshot = getSelectionSnapshot(state);
    expect(snapshot.breadcrumbs.map((b) => b.tagName)).toEqual(['concept', 'conbody', 'p', 'b']);
    // Leaf textblocks (`dita_p` has content `inline*`) must never be block-insertion containers.
    expect(snapshot.insertGroups.some((g) => g.containerTag === 'p')).toBe(false);
    const blockGroups = snapshot.insertGroups.filter((g) => g.insertKind === 'block');
    expect(blockGroups.length).toBeGreaterThan(0);
    expect(blockGroups[0]!.containerTag).toBe('conbody');
    expect(blockGroups.some((g) => g.items.some((item) => item.tag === 'note'))).toBe(true);

    state = runCmd(state, insertBlockDitaElement('note'));
    const outXml = pmDocToXml(state.doc);

    // The paragraph keeps all of its inline children: no split at the inline boundary.
    expect(outXml).toContain(
      '<p>DITA（Darwin Information Typing Architecture）是一套基于 XML 的开放技术文档标准，核心强调<b>模块化</b>、<i>语义化</i>与<u>多渠道发布</u>。</p>',
    );
    expect(outXml.match(/<note type="note">/g)).toHaveLength(1);
    // The sample's existing `<note type="tip">` is still there
    expect(outXml).toContain('<note type="tip">');
    expect(outXml.indexOf('<note type="note">')).toBeGreaterThan(
      outXml.indexOf('<u>多渠道发布</u>。</p>'),
    );
    expect(outXml.indexOf('<note type="note">')).toBeLessThan(
      outXml.indexOf('<section id="sec_core_types">'),
    );

    let firstPAfter = -1;
    state.doc.descendants((node, pos) => {
      if (firstPAfter === -1 && node.type.name === 'dita_p') {
        firstPAfter = pos;
        return false;
      }
      return true;
    });
    expect(firstPAfter).toBe(firstPPos);
    expect(state.doc.nodeAt(firstPPos)!.content.size).toBe(pContentSize);
    expect(validatePmStructure(state.doc)).toEqual([]);
  });
});
