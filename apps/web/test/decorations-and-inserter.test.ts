import { describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import {
  DITA_SAMPLE_DOCUMENTS,
  isChildAllowed,
  pmDocToXml,
  xmlToPmDoc,
} from '@dita/core';
import { insertBlockDitaElementAtPos } from '../src/editor/visual/commands';
import {
  collectDitaDecorations,
  CONTAINER_QUICK_BLOCK_TAGS,
  createDitaDecorationsPlugin,
  DITA_DECORATIONS_KEY,
  type DitaDecorationsCallbacks,
} from '../src/editor/visual/decorations';

const noopCallbacks: DitaDecorationsCallbacks = {
  onSelectTagNode: () => {},
  onQuickInsertBlock: () => {},
  onOpenGapInsertMenu: () => {},
};

describe('Oxygen-style Element Tag Decorations & Jupyter Between-Block Inserters', () => {
  it('ensures every configured quick-insert tag in CONTAINER_QUICK_BLOCK_TAGS is DITA 1.3 legal', () => {
    for (const [containerTag, quickTags] of Object.entries(CONTAINER_QUICK_BLOCK_TAGS)) {
      for (const childTag of quickTags) {
        expect(
          isChildAllowed(containerTag, childTag),
          `<${childTag}> must be legal inside <${containerTag}>`,
        ).toBe(true);
      }
    }
  });

  it('produces zero tag decorations in "none" mode while keeping between-block "+" inserters', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);

    const decoNone = collectDitaDecorations(pmDoc, 'none', null, noopCallbacks);
    const allNone = decoNone.find();
    const oxTagsNone = allNone.filter((d) => String(d.spec.key ?? '').startsWith('ox-'));
    const gapBarsNone = allNone.filter((d) => String(d.spec.key ?? '').startsWith('gap-'));

    expect(oxTagsNone).toHaveLength(0);
    expect(gapBarsNone.length).toBeGreaterThan(0);

    // Decorations must never alter serialized XML
    expect(pmDocToXml(pmDoc)).toBe(taskSample.xml);
  });

  it('produces paired open/close Oxygen chevron tags and profiling badges in "full" mode', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);

    const decoFull = collectDitaDecorations(pmDoc, 'full', null, noopCallbacks);
    const allFull = decoFull.find();
    const openTags = allFull.filter((d) => String(d.spec.key ?? '').startsWith('ox-open-'));
    const closeTags = allFull.filter((d) => String(d.spec.key ?? '').startsWith('ox-close-'));
    const profBadges = allFull.filter((d) => String(d.spec.key ?? '').startsWith('ox-prof-'));

    expect(openTags.length).toBeGreaterThan(10);
    expect(closeTags.length).toBe(openTags.length);
    // `<info audience="admin">` in sample-task triggers profiling highlight + badge
    expect(profBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('never places tag or gap widgets directly inside HTML table/tbody/tr structure', () => {
    const refSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-reference')!;
    const { pmDoc } = xmlToPmDoc(refSample.xml);

    const deco = collectDitaDecorations(pmDoc, 'full', null, noopCallbacks);
    const keys = deco.find().map((d) => String(d.spec.key ?? ''));

    // Table rows / tgroup / thead / tbody should never get direct child tag decorations
    expect(keys.some((k) => k.includes('-row-') || k.includes('-tgroup-') || k.includes('-strow-'))).toBe(
      false,
    );
    // Cells (`entry` / `stentry`) and outer `table` / `simpletable` DO get tags
    expect(keys.some((k) => k.includes('-entry-'))).toBe(true);
    expect(keys.some((k) => k.includes('-table-'))).toBe(true);
  });

  it('switches tagDisplayMode live via plugin transaction meta without altering doc XML', () => {
    const conceptSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(conceptSample.xml);

    let state = EditorState.create({
      doc: pmDoc,
      plugins: [createDitaDecorationsPlugin('none', noopCallbacks)],
    });

    expect(DITA_DECORATIONS_KEY.getState(state)?.tagMode).toBe('none');
    state = state.apply(state.tr.setMeta(DITA_DECORATIONS_KEY, { tagMode: 'full' }));
    expect(DITA_DECORATIONS_KEY.getState(state)?.tagMode).toBe('full');
    expect(pmDocToXml(state.doc)).toBe(conceptSample.xml);
  });

  it('inserts a DITA block at the exact gap offset via insertBlockDitaElementAtPos()', () => {
    const conceptSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(conceptSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    // Locate the exact gap immediately after the first `<p>` inside `<conbody>`
    let gapAfterFirstP = -1;
    state.doc.descendants((node, pos) => {
      if (gapAfterFirstP !== -1) return false;
      if (node.type.name === 'dita_p') {
        gapAfterFirstP = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    expect(gapAfterFirstP).toBeGreaterThan(0);

    const ok = insertBlockDitaElementAtPos('note', gapAfterFirstP)(state, (tr) => {
      state = state.apply(tr);
    });
    expect(ok).toBe(true);

    // Type text inside the newly inserted `<note><p>`
    state = state.apply(state.tr.insertText('通过块间加号插入的提示框'));
    const outXml = pmDocToXml(state.doc);

    expect(outXml).toContain('<note type="note">\n      <p>通过块间加号插入的提示框</p>\n    </note>');
    // Ensure the new `<note>` appears BEFORE `<section id="sec_core_types">`
    expect(outXml.indexOf('通过块间加号插入的提示框')).toBeLessThan(
      outXml.indexOf('<section id="sec_core_types">'),
    );
  });
});
