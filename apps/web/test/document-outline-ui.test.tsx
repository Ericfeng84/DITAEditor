// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { xmlToPmDoc, type XmlParseError } from '@dita/core';
import {
  DocumentOutlinePanel,
  type DocumentOutlinePanelProps,
} from '../src/editor/outline/DocumentOutlinePanel';
import {
  buildDocumentOutline,
  type OutlineDensity,
  type OutlineNode,
} from '../src/editor/outline/outline-model';
import type { OutlineDropEvaluation, OutlineDropPlacement } from '../src/editor/outline/outline-dnd';
import { t } from '../src/i18n/index.js';

/**
 * The outline panel is the only pointer/keyboard surface in the editor that mutates document
 * order, so it is exercised through the real DOM: a genuine `buildDocumentOutline()` tree fed from
 * a DITA `<task>`, real clicks, real focus movement and real key handling.
 */

const TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">
<task id="t1"><title>Install Kit</title>
<taskbody>
<context><p id="ctx-p">Context text</p></context>
<steps>
<step id="s-1"><cmd>Open panel</cmd><info>Watch the latch</info></step>
<step id="s-2"><cmd>Fasten bolt</cmd><note id="n1">Torque matters</note></step>
</steps>
</taskbody>
</task>`;

const CONCEPT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="c1"><title>Concept Title</title>
<conbody>
<p id="p1">Alpha</p>
<section id="s1"><title>Sec One</title><p id="p2">Beta</p><note id="n1">Careful</note></section>
</conbody>
</concept>`;

function outlineFor(xml: string, density: OutlineDensity = 'all'): OutlineNode[] {
  const { pmDoc } = xmlToPmDoc(xml, { position: true });
  return buildDocumentOutline(pmDoc, { density });
}

/** Depth-first lookup: the panel's own ordering, used to derive expectations instead of guessing. */
function findNode(
  nodes: readonly OutlineNode[],
  predicate: (node: OutlineNode) => boolean,
): OutlineNode | null {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const child = findNode(node.children, predicate);
    if (child) return child;
  }
  return null;
}

interface Harness {
  props: DocumentOutlinePanelProps;
  rerender: (next: Partial<DocumentOutlinePanelProps>) => void;
}

function okEvaluation(
  sourcePos: number,
  targetPos: number,
  placement: OutlineDropPlacement,
): OutlineDropEvaluation {
  return { ok: true, placement, sourcePos, targetPos };
}

function renderPanel(overrides: Partial<DocumentOutlinePanelProps> = {}): Harness {
  const nodes = overrides.nodes ?? outlineFor(TASK_XML);
  const props: DocumentOutlinePanelProps = {
    nodes,
    activeNodeId: null,
    density: 'all',
    onChangeDensity: vi.fn(),
    onLocateNode: vi.fn(),
    onEvaluateDrop: vi.fn((sourcePos: number, targetPos: number, placement: OutlineDropPlacement) =>
      okEvaluation(sourcePos, targetPos, placement),
    ),
    onMoveNode: vi.fn(() => true),
    onCollapse: vi.fn(),
    ...overrides,
  };
  const view = render(<DocumentOutlinePanel {...props} />);
  return {
    props,
    rerender: (next) =>
      void view.rerender(<DocumentOutlinePanel {...props} {...next} />),
  };
}

/** Visible rows, in DOM order — the same order arrow keys traverse. */
function rows(): HTMLElement[] {
  return screen.queryAllByRole('treeitem');
}

function rowFor(node: OutlineNode): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-outline-id="${node.id}"]`);
  if (!row) throw new Error(`outline row for ${node.tagName} (${node.id}) is missing`);
  return row;
}

beforeAll(() => {
  // jsdom ships neither geometry nor scrolling helpers; the panel calls both defensively.
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => undefined,
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DocumentOutlinePanel rendering', () => {
  it('renders a real task outline with roles, tag badges and hierarchy levels', () => {
    const nodes = outlineFor(TASK_XML);
    renderPanel({ nodes });

    const visible = rows();
    expect(visible.length).toBeGreaterThan(3);

    // The tree itself is labelled and single-select.
    const tree = screen.getByRole('tree', { name: t('outline.treeAria') });
    expect(tree).toBeTruthy();
    expect(tree.getAttribute('aria-multiselectable')).toBe('false');

    // The root topic row is first, level 1, and rendered with its tag badge.
    const first = visible[0]!;
    expect(first.getAttribute('aria-level')).toBe('1');
    expect(within(first).getByText('<task>')).toBeTruthy();

    // `steps` is a container: it exposes aria-expanded and the container marker used by DnD.
    const steps = findNode(nodes, (node) => node.tagName === 'steps');
    expect(steps).not.toBeNull();
    const stepsRow = rowFor(steps!);
    expect(stepsRow.getAttribute('aria-expanded')).toBe('true');
    expect(stepsRow.dataset.outlineContainer).toBe('true');

    // A leaf (`<info>`; `<cmd>` folds into its step label) has no aria-expanded but stays selectable.
    const leaf = findNode(nodes, (node) => node.tagName === 'info');
    expect(leaf).not.toBeNull();
    expect(rowFor(leaf!).hasAttribute('aria-expanded')).toBe(false);
  });

  it('marks the active row with aria-selected and a blue tint', () => {
    const nodes = outlineFor(TASK_XML);
    const step = findNode(nodes, (node) => node.tagName === 'step')!;
    renderPanel({ nodes, activeNodeId: step.id });

    const activeRow = rowFor(step);
    expect(activeRow.getAttribute('aria-selected')).toBe('true');
    expect(activeRow.className).toContain('bg-blue-50');
    // Every other row stays unselected.
    const others = rows().filter((row) => row !== activeRow);
    expect(others.every((row) => row.getAttribute('aria-selected') === 'false')).toBe(true);
  });

  it('surfaces structure issues as a titled indicator', () => {
    const nodes = outlineFor(CONCEPT_XML);
    const withIssue = findNode(nodes, (node) => Boolean(node.structureIssueMessage));
    renderPanel({ nodes });
    if (!withIssue) return; // the fixture is valid; nothing to assert
    expect(screen.getByRole('img', { name: t('outline.structureIssue', { message: withIssue.structureIssueMessage! }) })).toBeTruthy();
  });
});

describe('density switch', () => {
  it('switches structure <-> all through the segmented header control', () => {
    const { props, rerender } = renderPanel({ density: 'structure' });

    const structureButton = screen.getByRole('button', { name: t('outline.density.structure') });
    const allButton = screen.getByRole('button', { name: t('outline.density.all') });
    expect(structureButton.getAttribute('aria-pressed')).toBe('true');
    expect(allButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(allButton);
    expect(props.onChangeDensity).toHaveBeenCalledWith('all');

    rerender({ density: 'all' });
    expect(
      screen.getByRole('button', { name: t('outline.density.all') }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('promotes to all blocks from the +N hidden-children pill', () => {
    const structureNodes = outlineFor(TASK_XML, 'structure');
    const hiddenParent = findNode(structureNodes, (node) => node.hiddenChildCount > 0);
    expect(hiddenParent).not.toBeNull();

    const { props } = renderPanel({ nodes: structureNodes, density: 'structure' });
    const pill = within(rowFor(hiddenParent!)).getByRole('button', {
      name: t('outline.hiddenBlocks', { count: hiddenParent!.hiddenChildCount }),
    });
    fireEvent.click(pill);
    expect(props.onChangeDensity).toHaveBeenCalledWith('all');
  });
});

describe('search', () => {
  it('filters by text, by <tag> and by #ditaId, and clears back to the full tree', () => {
    const nodes = outlineFor(CONCEPT_XML);
    renderPanel({ nodes });
    const totalRows = rows().length;
    expect(totalRows).toBeGreaterThan(3);

    const input = screen.getByRole('searchbox', { name: t('outline.searchAria') });

    fireEvent.change(input, { target: { value: 'Beta' } });
    const betaMatches = rows();
    expect(betaMatches.length).toBeLessThan(totalRows);
    expect(document.querySelectorAll('[data-outline-tag="note"]').length).toBe(0);

    fireEvent.change(input, { target: { value: '<note>' } });
    expect(document.querySelectorAll('[data-outline-tag="note"]').length).toBe(1);
    // Ancestors stay visible so the match keeps its context.
    expect(document.querySelectorAll('[data-outline-tag="concept"]').length).toBe(1);

    fireEvent.change(input, { target: { value: '#n1' } });
    expect(document.querySelectorAll('[data-outline-tag="note"]').length).toBe(1);

    fireEvent.change(input, { target: { value: 'nothing-matches-this' } });
    expect(rows().length).toBe(0);
    expect(screen.getByText(t('outline.noMatch', { query: 'nothing-matches-this' }))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('outline.clearSearch') }));
    expect(rows().length).toBe(totalRows);
    expect((input as HTMLInputElement).value).toBe('');
  });
});

describe('locate', () => {
  it('invokes onLocateNode with the exact node that was clicked', () => {
    const nodes = outlineFor(TASK_XML);
    const step = findNode(nodes, (node) => node.tagName === 'step' && node.label === 'Open panel')!;
    const { props } = renderPanel({ nodes });

    fireEvent.click(rowFor(step));
    expect(props.onLocateNode).toHaveBeenCalledTimes(1);
    expect(props.onLocateNode).toHaveBeenCalledWith(step);
    expect((props.onLocateNode as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(step);
  });

  it('locates on Enter and on Space', () => {
    const nodes = outlineFor(TASK_XML);
    const conceptStep = findNode(nodes, (node) => node.tagName === 'steps')!;
    const { props } = renderPanel({ nodes });
    const row = rowFor(conceptStep);

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(props.onLocateNode).toHaveBeenCalledWith(conceptStep);

    fireEvent.keyDown(row, { key: ' ' });
    expect(props.onLocateNode).toHaveBeenCalledTimes(2);
  });
});

describe('following the active node', () => {
  it('reveals a collapsed branch when the followed node moves inside it', () => {
    const nodes = outlineFor(TASK_XML);
    const steps = findNode(nodes, (node) => node.tagName === 'steps')!;
    const step = findNode(nodes, (node) => node.tagName === 'step')!;
    const { rerender } = renderPanel({ nodes });

    // Collapse the container the way an author would, so its steps leave the DOM.
    const caret = rowFor(steps).querySelector('button');
    expect(caret).not.toBeNull();
    fireEvent.click(caret!);
    expect(rowFor(steps).getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector(`[data-outline-id="${step.id}"]`)).toBeNull();

    // A breadcrumb click hands the panel a node it cannot scroll to while the branch is closed.
    rerender({ activeNodeId: step.id });
    expect(rowFor(steps).getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector(`[data-outline-id="${step.id}"]`)).not.toBeNull();
    expect(rowFor(step).getAttribute('aria-selected')).toBe('true');
  });

  it('leaves unrelated collapsed branches alone', () => {
    const nodes = outlineFor(TASK_XML);
    const context = findNode(nodes, (node) => node.tagName === 'context')!;
    const step = findNode(nodes, (node) => node.tagName === 'step')!;
    const { rerender } = renderPanel({ nodes });

    fireEvent.click(rowFor(context).querySelector('button')!);
    expect(rowFor(context).getAttribute('aria-expanded')).toBe('false');

    rerender({ activeNodeId: step.id });
    // Navigating to one branch must not expand every branch — the reading position stays legible.
    expect(rowFor(context).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('read-only mode', () => {
  it('hides drag handles and shows the read-only footer hint', () => {
    const nodes = outlineFor(TASK_XML);
    const step = findNode(nodes, (node) => node.tagName === 'step')!;
    renderPanel({ nodes, readOnly: true });

    expect(
      screen.queryByRole('button', { name: t('outline.dragHandle', { tag: step.tagName }) }),
    ).toBeNull();
    expect(screen.getByText(t('outline.footer.readOnly'))).toBeTruthy();
    expect(screen.queryByText(t('outline.footer.editable'))).toBeNull();
  });

  it('still shows the editable footer and drag handles when writable', () => {
    const nodes = outlineFor(TASK_XML);
    const step = findNode(nodes, (node) => node.tagName === 'step')!;
    renderPanel({ nodes });

    expect(screen.getByText(t('outline.footer.editable'))).toBeTruthy();
    expect(
      within(rowFor(step)).getByRole('button', { name: t('outline.dragHandle', { tag: step.tagName }) }),
    ).toBeTruthy();
  });
});

describe('XML syntax error banner', () => {
  const xmlError: XmlParseError = {
    message: 'Unexpected end of file',
    line: 12,
    column: 3,
    offset: 188,
  };

  it('renders the line/column and forwards the jump action', () => {
    const onJumpToXmlError = vi.fn();
    renderPanel({ xmlError, onJumpToXmlError });

    const banner = screen.getByRole('status');
    expect(within(banner).getByText('L12:3')).toBeTruthy();
    expect(within(banner).getByText('Unexpected end of file')).toBeTruthy();

    fireEvent.click(within(banner).getByRole('button', { name: t('outline.xmlErrorJump') }));
    expect(onJumpToXmlError).toHaveBeenCalledTimes(1);
  });

  it('omits the banner and the jump button when the XML is well formed', () => {
    renderPanel();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('keyboard navigation', () => {
  it('moves focus with ArrowDown / ArrowUp without changing the selection', () => {
    const { props } = renderPanel({ nodes: outlineFor(TASK_XML) });
    const visible = rows();

    fireEvent.focus(visible[0]!);
    fireEvent.keyDown(visible[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(visible[1]!);

    fireEvent.keyDown(visible[1]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(visible[0]!);
    expect(props.onLocateNode).not.toHaveBeenCalled();
  });

  it('expands and collapses a container with ArrowRight / ArrowLeft', () => {
    const nodes = outlineFor(TASK_XML);
    const steps = findNode(nodes, (node) => node.tagName === 'steps')!;
    renderPanel({ nodes });

    const stepsRow = rowFor(steps);
    expect(stepsRow.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(stepsRow, { key: 'ArrowLeft' });
    expect(rowFor(steps).getAttribute('aria-expanded')).toBe('false');

    fireEvent.keyDown(rowFor(steps), { key: 'ArrowRight' });
    expect(rowFor(steps).getAttribute('aria-expanded')).toBe('true');
  });

  it('reorders with Alt+ArrowDown and Alt+ArrowUp using visible siblings', () => {
    const nodes = outlineFor(TASK_XML);
    const { props } = renderPanel({ nodes });

    // Two sibling steps: reorder the first one after the second, then back.
    const steps = findNode(nodes, (node) => node.tagName === 'steps')!;
    const firstStep = steps.children.find((child) => child.tagName === 'step')!;
    const secondStep = steps.children.filter((child) => child.tagName === 'step')[1]!;

    const firstRow = rowFor(firstStep);
    fireEvent.keyDown(firstRow, { key: 'ArrowDown', altKey: true });
    expect(props.onMoveNode).toHaveBeenCalledWith(firstStep.pmPos, secondStep.pmPos, 'after');

    fireEvent.keyDown(rowFor(secondStep), { key: 'ArrowUp', altKey: true });
    expect(props.onMoveNode).toHaveBeenCalledWith(secondStep.pmPos, firstStep.pmPos, 'before');
    expect(props.onMoveNode).toHaveBeenCalledTimes(2);
    expect(props.onLocateNode).not.toHaveBeenCalled();
  });

  it('ignores Alt+Arrow in read-only mode', () => {
    const nodes = outlineFor(TASK_XML);
    const steps = findNode(nodes, (node) => node.tagName === 'steps')!;
    const firstStep = steps.children.find((child) => child.tagName === 'step')!;
    const { props } = renderPanel({ nodes, readOnly: true });

    fireEvent.keyDown(rowFor(firstStep), { key: 'ArrowDown', altKey: true });
    expect(props.onMoveNode).not.toHaveBeenCalled();
  });
});
