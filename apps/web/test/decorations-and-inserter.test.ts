import { describe, expect, it } from 'vitest';
import type { Node as PMNode } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import {
  DITA_SAMPLE_DOCUMENTS,
  isChildAllowed,
  pmDocToXml,
  validatePmStructure,
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

/* ------------------------------------------------------------------------------------------------
 * Test-local DOM doubles.
 *
 * These tests run in Vitest's Node environment (no jsdom), so clicking a real gap-inserter button
 * requires a hand-rolled `document.createElement`. The double only implements the DOM surface that
 * `createBlockGapInserterDom()` touches, which keeps the click path exercised end-to-end.
 * ---------------------------------------------------------------------------------------------- */

interface FakeDomEvent {
  type: string;
  preventDefault(): void;
  stopPropagation(): void;
}

class FakeDomElement {
  readonly tagName: string;
  className = '';
  contentEditable = '';
  title = '';
  type = '';
  textContent = '';
  readonly dataset: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  readonly children: FakeDomElement[] = [];
  private readonly listeners = new Map<string, Array<(ev: FakeDomEvent) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  appendChild(child: FakeDomElement): FakeDomElement {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: (ev: FakeDomEvent) => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  dispatch(type: string): void {
    const ev: FakeDomEvent = { type, preventDefault: () => {}, stopPropagation: () => {} };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(ev);
  }

  findAll(predicate: (el: FakeDomElement) => boolean): FakeDomElement[] {
    const found: FakeDomElement[] = [];
    const walk = (el: FakeDomElement): void => {
      if (predicate(el)) found.push(el);
      for (const child of el.children) walk(child);
    };
    walk(this);
    return found;
  }
}

function withFakeDocument<T>(fn: () => T): T {
  const globals = globalThis as { document?: unknown };
  const previous = globals.document;
  globals.document = { createElement: (tag: string) => new FakeDomElement(tag) };
  try {
    return fn();
  } finally {
    if (previous === undefined) delete globals.document;
    else globals.document = previous;
  }
}

/**
 * Structural shape of the internal widget type stored on a `Decoration` (`Decoration.type` is
 * `@internal`, so it is reached through a narrow local interface instead of `any`).
 */
interface WidgetDecorationType {
  toDOM(view: unknown, getPos: () => number | undefined): unknown;
}

interface ParsedGapKey {
  key: string;
  kind: 'before' | 'after';
  pos: number;
  index: number;
  gapPos: number;
  containerTag: string;
}

const GAP_KEY_RE = /^gap-(before|after)-(\d+)-(\d+)-(\d+)-(.+)$/;

/** Every between-block `+` widget key, parsed into `gap-<kind>-<pos>-<i>-<gapPos>-<tag>-<sig>`. */
function parsedGapKeys(doc: PMNode): ParsedGapKey[] {
  return collectDitaDecorations(doc, 'none', null, noopCallbacks)
    .find()
    .map((d) => String(d.spec.key ?? ''))
    .filter((key) => key.startsWith('gap-'))
    .flatMap((key) => {
      const match = GAP_KEY_RE.exec(key);
      if (!match) return [];
      return [
        {
          key,
          kind: match[1] as 'before' | 'after',
          pos: Number(match[2]),
          index: Number(match[3]),
          gapPos: Number(match[4]),
          containerTag: match[5]!.split('-')[0]!,
        },
      ];
    });
}

function findNodes(doc: PMNode, typeName: string): { node: PMNode; pos: number }[] {
  const found: { node: PMNode; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === typeName) found.push({ node, pos });
    return true;
  });
  return found;
}

function ditaTagOf(node: PMNode): string {
  return String((node.attrs as { tagName?: string }).tagName ?? node.type.name.replace(/^dita_/, ''));
}

function childTags(node: PMNode): string[] {
  const tags: string[] = [];
  node.forEach((child) => {
    tags.push(ditaTagOf(child));
  });
  return tags;
}

/** Ancestor tag chains of every node of `typeName`, nearest-last (root first). */
function ancestorChains(doc: PMNode, typeName: string): string[][] {
  return findNodes(doc, typeName).map(({ pos }) => {
    const $pos = doc.resolve(pos);
    const chain: string[] = [];
    for (let depth = 1; depth <= $pos.depth; depth += 1) chain.push(ditaTagOf($pos.node(depth)));
    return chain;
  });
}

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

describe('Gap inserter position freshness (no stale gapPos / getPos closures)', () => {
  it('keys between-block "+" widgets with pos+index+gapPos so a growing <cmd> invalidates them', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);

    let cmdPos = -1;
    let cmdEnd = -1;
    pmDoc.descendants((node, pos) => {
      if (cmdPos === -1 && node.type.name === 'dita_cmd') {
        cmdPos = pos;
        cmdEnd = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    expect(cmdPos).toBeGreaterThan(0);

    const before = parsedGapKeys(pmDoc);
    const cmdGap = before.find(
      (k) => k.kind === 'after' && k.gapPos === cmdEnd && k.containerTag === 'step',
    );
    expect(cmdGap).toBeDefined();
    // The key must carry `gapPos` (format: gap-after-<pos>-<i>-<gapPos>-<tag>-<sig>)
    expect(cmdGap!.key.startsWith(`gap-after-${cmdGap!.pos}-${cmdGap!.index}-${cmdEnd}-step-`)).toBe(
      true,
    );

    // Grow text *inside* the <cmd> only: the <step> keeps its position and child index,
    // so a key without `gapPos` would leave ProseMirror reusing the stale widget DOM.
    let state = EditorState.create({ doc: pmDoc });
    state = state.apply(state.tr.insertText('XYZ', cmdPos + 2));

    const after = parsedGapKeys(state.doc);
    const cmdGapAfter = after.find(
      (k) =>
        k.kind === 'after' &&
        k.pos === cmdGap!.pos &&
        k.index === cmdGap!.index &&
        k.containerTag === 'step',
    );
    expect(cmdGapAfter).toBeDefined();
    expect(cmdGapAfter!.gapPos).toBe(cmdEnd + 3);
    expect(cmdGapAfter!.key).not.toBe(cmdGap!.key);
  });

  it('keys gap-before widgets with the live container offset so a growing paragraph invalidates them', () => {
    const conceptSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(conceptSample.xml);

    const before = parsedGapKeys(pmDoc);
    const ulGap = before.find((k) => k.kind === 'before' && k.containerTag === 'ul');
    expect(ulGap).toBeDefined();
    expect(ulGap!.gapPos).toBe(ulGap!.pos + 1);
    expect(
      ulGap!.key.startsWith(`gap-before-${ulGap!.pos}-${ulGap!.index}-${ulGap!.gapPos}-ul-`),
    ).toBe(true);

    const pPos = findNodes(pmDoc, 'dita_p')[0]!.pos;
    let state = EditorState.create({ doc: pmDoc });
    state = state.apply(state.tr.insertText('ABCDE', pPos + 1));

    const after = parsedGapKeys(state.doc);
    expect(after.map((k) => k.key)).not.toEqual(before.map((k) => k.key));
    const ulGapAfter = after.find(
      (k) => k.kind === 'before' && k.containerTag === 'ul' && k.index === ulGap!.index,
    );
    expect(ulGapAfter).toBeDefined();
    expect(ulGapAfter!.pos).toBe(ulGap!.pos + 5);
    expect(ulGapAfter!.gapPos).toBe(ulGap!.gapPos + 5);
    expect(ulGapAfter!.key).not.toBe(ulGap!.key);
  });

  it('clicks a gap-inserter button at the live getPos() offset, falling back to gapPos when detached', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);

    const cmdEnd = findNodes(pmDoc, 'dita_cmd')[0]!.pos + findNodes(pmDoc, 'dita_cmd')[0]!.node.nodeSize;

    const openedAt: number[] = [];
    const quickInsertedAt: Array<[string, number]> = [];
    const callbacks: DitaDecorationsCallbacks = {
      onSelectTagNode: () => {},
      onQuickInsertBlock: (tag, pos) => quickInsertedAt.push([tag, pos]),
      onOpenGapInsertMenu: (context) => openedAt.push(context.insertPos),
    };

    const cmdDeco = collectDitaDecorations(pmDoc, 'none', null, callbacks)
      .find()
      .find((d) => {
        const key = String(d.spec.key ?? '');
        return key.startsWith('gap-after-') && key.includes(`-${cmdEnd}-step-`);
      });
    expect(cmdDeco).toBeDefined();

    withFakeDocument(() => {
      // `Decoration.spec` exposes the user spec; the internal `type` holds the WidgetType.
      const widget = (cmdDeco as unknown as { type: WidgetDecorationType }).type;
      let livePos: number | undefined = cmdEnd;

      const dom = widget.toDOM({}, () => livePos) as unknown as FakeDomElement;
      expect(dom.dataset.insertPos).toBe(String(cmdEnd));

      const plus = dom.findAll((el) => el.className === 'dita-bi-plus')[0]!;
      const chips = dom.findAll((el) => el.className === 'dita-bi-chip');
      const more = dom.findAll((el) => el.className.includes('dita-bi-chip-more'))[0];
      expect(plus).toBeDefined();
      expect(chips.length).toBeGreaterThan(0);

      // The document grew after the widget DOM was built: getPos() now reports a later offset.
      livePos = cmdEnd + 42;
      plus.dispatch('click');
      expect(openedAt).toEqual([cmdEnd + 42]);

      chips[0]!.dispatch('click');
      expect(quickInsertedAt).toHaveLength(1);
      expect(quickInsertedAt[0]![1]).toBe(cmdEnd + 42);

      if (more) {
        more.dispatch('click');
        expect(openedAt).toEqual([cmdEnd + 42, cmdEnd + 42]);
      }

      // Detached widget (getPos() === undefined) must fall back to the initial gap offset.
      const detachedDom = widget.toDOM({}, () => undefined) as unknown as FakeDomElement;
      detachedDom.findAll((el) => el.className === 'dita-bi-plus')[0]!.dispatch('click');
      expect(openedAt[openedAt.length - 1]).toBe(cmdEnd);
    });
  });
});

describe('Block insertion from a stale intra-textblock position never splits <cmd> / <p>', () => {
  it('re-anchors a <step> request inside <cmd> to a sibling step and keeps <cmd> intact', () => {
    const taskSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-task')!;
    const { pmDoc } = xmlToPmDoc(taskSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    const cmd = findNodes(pmDoc, 'dita_cmd')[0]!;
    const cmdInsidePos = cmd.pos + 2;
    const cmdContentSize = cmd.node.content.size;
    const firstStepPos = findNodes(pmDoc, 'dita_step')[0]!.pos;
    expect(findNodes(pmDoc, 'dita_step')[0]!.node.childCount).toBe(3);

    // Reproduces `<step><cmd>...缺|字。</cmd></step>`: a stale gap offset inside a textblock.
    const ok = insertBlockDitaElementAtPos('step', cmdInsidePos)(state, (tr) => {
      state = state.apply(tr);
    });
    expect(ok).toBe(true);

    const cmds = findNodes(state.doc, 'dita_cmd');
    // The original <cmd> is untouched (never split) and the new <step> owns one empty <cmd>.
    expect(cmds[0]!.node.content.size).toBe(cmdContentSize);

    const steps = findNodes(state.doc, 'dita_step');
    expect(steps).toHaveLength(3);
    expect(steps[0]!.pos).toBe(firstStepPos);
    expect(childTags(steps[0]!.node)).toEqual(['cmd', 'info', 'substeps']);
    expect(childTags(steps[1]!.node)).toEqual(['cmd']);
    expect(steps[1]!.node.child(0).content.size).toBe(0);
    expect(childTags(findNodes(state.doc, 'dita_steps')[0]!.node)).toEqual(['step', 'step', 'step']);

    // No <step> may be nested inside another <step>, and no <step> may live inside <cmd>.
    for (const chain of ancestorChains(state.doc, 'dita_step')) {
      expect(chain).toEqual(['task', 'taskbody', 'steps']);
    }

    expect(validatePmStructure(state.doc)).toEqual([]);
    const outXml = pmDocToXml(state.doc);
    expect(outXml).toContain('<steps>');
    expect(outXml.match(/<step>\n/g)?.length).toBe(1);
  });

  it('re-anchors a <note> request inside <p> to a sibling block and keeps the paragraph whole', () => {
    const conceptSample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(conceptSample.xml);
    let state = EditorState.create({ doc: pmDoc });

    const firstP = findNodes(pmDoc, 'dita_p')[0]!;
    const pContentSize = firstP.node.content.size;
    const pChildTags = childTags(firstP.node);
    const pCountBefore = findNodes(pmDoc, 'dita_p').length;

    const ok = insertBlockDitaElementAtPos('note', firstP.pos + 2)(state, (tr) => {
      state = state.apply(tr);
    });
    expect(ok).toBe(true);

    const paragraphs = findNodes(state.doc, 'dita_p');
    expect(paragraphs).toHaveLength(pCountBefore + 1);
    // The original <p> keeps every child (no split at the stale offset)
    expect(paragraphs[0]!.node.content.size).toBe(pContentSize);
    expect(childTags(paragraphs[0]!.node)).toEqual(pChildTags);

    const notes = findNodes(state.doc, 'dita_note');
    expect(notes).toHaveLength(2);
    // The new <note> is a direct sibling in <conbody>, right after the untouched <p>
    expect(notes[0]!.pos).toBeGreaterThan(firstP.pos + firstP.node.nodeSize - 1);
    expect(ancestorChains(state.doc, 'dita_note')[0]).toEqual(['concept', 'conbody']);

    expect(validatePmStructure(state.doc)).toEqual([]);
    const outXml = pmDocToXml(state.doc);
    expect(outXml).toContain(
      '<p>DITA（Darwin Information Typing Architecture）是一套基于 XML 的开放技术文档标准，核心强调<b>模块化</b>、<i>语义化</i>与<u>多渠道发布</u>。</p>',
    );
    expect(outXml.indexOf('<note type="note">')).toBeGreaterThan(
      outXml.indexOf('<u>多渠道发布</u>。</p>'),
    );
  });
});
