import { describe, expect, it } from 'vitest';
import {
  extractDitaDocumentTitle,
  extractDitaDocumentTitleFromDocument,
  getPmDocTitle,
  parseXml,
  xmlToPmDoc,
} from '@dita/core';

function titleOf(xml: string): string | null {
  return getPmDocTitle(xmlToPmDoc(xml).pmDoc);
}

const SAMPLES = [
  `<topic id="t"><title>  Hello\n <b>World</b>  </title><body><p>x</p></body></topic>`,
  `<task id="t"><title>Deploy</title><taskbody><steps><step><cmd>Click</cmd></step></steps></taskbody></task>`,
  `<concept id="c"><title>Concept</title><conbody><p>a</p></conbody></concept>`,
  `<bookmap id="b"><booktitle><mainbooktitle>Guide</mainbooktitle></booktitle></bookmap>`,
  `<map id="m"><title>Map Title</title></map>`,
  `<map id="m2" title="Attr Map Title"/>`,
  `<topic id="t"><body><p>no title</p></body></topic>`,
  `<topic id="t"><title/><body><p>empty title</p></body></topic>`,
  `<topic id="t"><title>Hello <![CDATA[World]]></title><body><p>x</p></body></topic>`,
  `<topic id="t"><title><![CDATA[Only CDATA]]></title><body><p>x</p></body></topic>`,
  `<topic id="t"><title>Hello <!-- ignore me --> World</title><body><p>x</p></body></topic>`,
  `<topic id="t"><title>Hello <?pi ignore?> World</title><body><p>x</p></body></topic>`,
  `<bookmap id="b2"><booktitle><mainbooktitle>Main <![CDATA[Book]]></mainbooktitle></booktitle></bookmap>`,
];

describe('getPmDocTitle', () => {
  it('reads the title straight off the ProseMirror doc without re-parsing XML', () => {
    expect(titleOf(SAMPLES[0]!)).toBe('Hello World');
    expect(titleOf(SAMPLES[1]!)).toBe('Deploy');
    expect(titleOf(SAMPLES[2]!)).toBe('Concept');
  });

  it('falls back to booktitle/mainbooktitle for bookmaps and @title for maps', () => {
    expect(titleOf(SAMPLES[3]!)).toBe('Guide');
    expect(titleOf(SAMPLES[5]!)).toBe('Attr Map Title');
  });

  it('returns null when the document has no title or an empty title', () => {
    expect(titleOf(SAMPLES[6]!)).toBeNull();
    expect(titleOf(SAMPLES[7]!)).toBeNull();
  });

  it('includes CDATA text and ignores comments/PIs just like DOM textContent', () => {
    expect(titleOf(SAMPLES[8]!)).toBe('Hello World');
    expect(titleOf(SAMPLES[9]!)).toBe('Only CDATA');
    expect(titleOf(SAMPLES[10]!)).toBe('Hello World');
    expect(titleOf(SAMPLES[11]!)).toBe('Hello World');
    expect(titleOf(SAMPLES[12]!)).toBe('Main Book');
  });

  it('matches the XML-level title extractor for topics, maps and bookmaps', () => {
    for (const xml of SAMPLES) {
      expect(titleOf(xml)).toBe(extractDitaDocumentTitle(xml));
    }
  });
});

describe('extractDitaDocumentTitleFromDocument', () => {
  it('reuses an already parsed document instead of parsing again', () => {
    for (const xml of SAMPLES) {
      const parsed = parseXml(xml, { position: false });
      expect(extractDitaDocumentTitleFromDocument(parsed.document)).toBe(
        extractDitaDocumentTitle(xml),
      );
    }
  });

});
