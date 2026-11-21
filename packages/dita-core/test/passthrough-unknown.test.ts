import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Node as PMNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { pmDocToXml, xmlToPmDoc, type RawAttrs } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

function collectNodes(root: PMNode, predicate: (node: PMNode) => boolean): PMNode[] {
  const hits: PMNode[] = [];
  root.descendants((node) => {
    if (predicate(node)) {
      hits.push(node);
    }
  });
  return hits;
}

describe('Passthrough unknown_block / unknown_inline fidelity', () => {
  it('maps unmodeled specialized DITA elements to unknown_block, unknown_pre_block, and unknown_inline', () => {
    const xml = readFileSync(join(FIXTURES_DIR, '06-unknown-specialized-elements.dita'), 'utf8');
    const { pmDoc } = xmlToPmDoc(xml);

    const unknownBlocks = collectNodes(pmDoc, (n) => n.type.name === 'unknown_block');
    const unknownBlockTags = unknownBlocks.map((n) => String(n.attrs.tagName));

    expect(unknownBlockTags).toContain('hazardstatement');
    expect(unknownBlockTags).toContain('messagepanel');
    expect(unknownBlockTags).toContain('typeofhazard');
    expect(unknownBlockTags).toContain('consequence');
    expect(unknownBlockTags).toContain('howtoavoid');
    expect(unknownBlockTags).toContain('hazardsymbol');
    expect(unknownBlockTags).toContain('syntaxdiagram');
    expect(unknownBlockTags).toContain('groupseq');
    expect(unknownBlockTags).toContain('acme-callout');
    expect(unknownBlockTags).toContain('acme-badge');

    // Whitespace-preserving unknown block (<screen>)
    const unknownPreBlocks = collectNodes(pmDoc, (n) => n.type.name === 'unknown_pre_block');
    expect(unknownPreBlocks.map((n) => String(n.attrs.tagName))).toEqual(['screen']);
    expect(unknownPreBlocks[0]!.textContent).toContain('  Output: out/manual.pdf');

    // Unknown inline tags (including empty self-closing <acme-marker/> and <abbreviated-form/>)
    const unknownInlines = collectNodes(pmDoc, (n) => n.type.name === 'unknown_inline');
    const unknownInlineTags = unknownInlines.map((n) => String(n.attrs.tagName));
    expect(unknownInlineTags).toContain('tm');
    expect(unknownInlineTags).toContain('abbreviated-form');
    expect(unknownInlineTags).toContain('acme-tag');
    expect(unknownInlineTags).toContain('acme-marker');

    // Verify rawAttrs preservation on custom unknown element
    const acmeCallout = unknownBlocks.find((n) => n.attrs.tagName === 'acme-callout')!;
    const calloutAttrs = acmeCallout.attrs.rawAttrs as RawAttrs;
    expect(calloutAttrs.map((a) => [a.name, a.value])).toEqual([
      ['severity', 'high'],
      ['data-owner', 'sec-team'],
    ]);

    // Verify multi-paragraph inline <fn> uses dita_fn_block
    const fnBlocks = collectNodes(pmDoc, (n) => n.type.name === 'dita_fn_block');
    expect(fnBlocks).toHaveLength(1);
    expect(fnBlocks[0]!.childCount).toBe(2);

    // Round-trip back to exact XML
    expect(pmDocToXml(pmDoc)).toBe(xml);
  });

  it('preserves specialized root topic types and XML namespaces via unknown_block', () => {
    const xml = readFileSync(
      join(FIXTURES_DIR, '08-namespaces-and-specialized-root.dita'),
      'utf8',
    );
    const { pmDoc } = xmlToPmDoc(xml);

    const rootNode = pmDoc.firstChild!;
    expect(rootNode.type.name).toBe('unknown_block');
    expect(rootNode.attrs.tagName).toBe('troubleshooting');

    const rootAttrs = rootNode.attrs.rawAttrs as RawAttrs;
    expect(rootAttrs.map((a) => a.name)).toEqual([
      'id',
      'xml:lang',
      'xmlns:ditaarch',
      'ditaarch:DITAArchVersion',
    ]);

    expect(pmDocToXml(pmDoc)).toBe(xml);
  });
});
