import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  compareParsedXmlDocuments,
  ditaSchema,
  parseXml,
  pmDocToXml,
  roundTripXmlThroughPm,
  xmlToPmDoc,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

const fixtureFiles = readdirSync(FIXTURES_DIR)
  .filter((name) => name.endsWith('.dita'))
  .sort();

describe('Phase 0 Spike: Lossless DITA 1.3 XML <-> ProseMirror Golden Round-trip', () => {
  it('loads all 10 complex DITA 1.3 fixture documents', () => {
    expect(fixtureFiles).toHaveLength(10);
  });

  for (const filename of fixtureFiles) {
    it(`round-trips ${filename} losslessly with zero diff and full idempotency`, () => {
      const inputXml = readFileSync(join(FIXTURES_DIR, filename), 'utf8');

      // Pass 1: XML -> slimdom -> ProseMirror Doc -> slimdom -> XML
      const pass1 = roundTripXmlThroughPm(inputXml);

      // 1. Exact golden text equality (zero formatting or attribute drift)
      expect(pass1.xml).toBe(inputXml);

      // 2. Deep DOM equivalence (DOCTYPE, XML decl, comments, PIs, CDATA, exact attr order)
      const reparsed = parseXml(pass1.xml);
      const domDiffs = compareParsedXmlDocuments(pass1.inputParsed, reparsed);
      expect(domDiffs).toEqual([]);

      // 3. Pass 2 idempotency: second round-trip produces byte-identical output
      const pass2 = roundTripXmlThroughPm(pass1.xml);
      expect(pass2.xml).toBe(pass1.xml);
    });
  }

  it('produces minimal single-line Git diff when editing one node inside ProseMirror Doc', () => {
    const inputXml = readFileSync(join(FIXTURES_DIR, '04-comments-pis-cdata.dita'), 'utf8');
    const { pmDoc } = xmlToPmDoc(inputXml);

    // Replace the <title> text inside the ProseMirror document without touching anything else
    const rootNode = pmDoc.firstChild!;
    const titleNode = rootNode.firstChild!;
    expect(titleNode.type.name).toBe('dita_title');

    const updatedTitle = titleNode.type.create(
      titleNode.attrs,
      ditaSchema.text('Updated Metadata Title'),
    );
    const updatedRoot = rootNode.copy(rootNode.content.replaceChild(0, updatedTitle));
    const updatedDoc = pmDoc.copy(pmDoc.content.replaceChild(0, updatedRoot));

    const outputXml = pmDocToXml(updatedDoc);

    const oldLines = inputXml.split('\n');
    const newLines = outputXml.split('\n');
    expect(newLines.length).toBe(oldLines.length);

    const changedLineIndices: number[] = [];
    for (let i = 0; i < oldLines.length; i++) {
      if (oldLines[i] !== newLines[i]) {
        changedLineIndices.push(i);
      }
    }

    // ONLY the <title> line changed — DOCTYPE, PIs, comments, CDATA, and indentation are untouched!
    expect(changedLineIndices).toHaveLength(1);
    expect(newLines[changedLineIndices[0]!]).toBe('  <title>Updated Metadata Title</title>');
  });
});
