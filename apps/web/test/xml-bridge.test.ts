import { describe, expect, it } from 'vitest';
import { DITA_SAMPLE_DOCUMENTS, xmlToPmDoc } from '@dita/core';
import {
  computeXmlLineDiffStats,
  formatDitaXml,
  syncSourceToVisual,
  syncVisualToSource,
} from '../src/editor/bridge/xml-bridge';

describe('Visual <-> Source Lossless XML Bridge', () => {
  it('blocks Source -> Visual transition when XML is malformed and reports exact location', () => {
    const brokenXml = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="broken">
  <title>Broken Topic</title>
  <body>
    <p>Unclosed <b>bold tag</p>
  </body>
</topic>`;

    const result = syncSourceToVisual(brokenXml, 70);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(5);
      expect(result.error.column).toBeGreaterThan(0);
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('round-trips Visual -> Source -> Visual with zero diff and preserves cursor element position', () => {
    const sample = DITA_SAMPLE_DOCUMENTS.find((d) => d.id === 'sample-concept')!;
    const { pmDoc } = xmlToPmDoc(sample.xml);

    // Find the `<note type="tip">` node position in ProseMirror
    let noteInsidePos = -1;
    pmDoc.descendants((node, pos) => {
      if (node.type.name === 'dita_note') {
        noteInsidePos = pos + 2;
        return false;
      }
      return true;
    });
    expect(noteInsidePos).toBeGreaterThan(0);

    const toSource = syncVisualToSource(pmDoc, noteInsidePos);
    expect(toSource.xml).toBe(sample.xml);
    expect(toSource.targetLine).not.toBeNull();
    expect(toSource.targetOffset).not.toBeNull();

    // Verify source offset actually points at `<note`
    const snippet = toSource.xml.slice(toSource.targetOffset!, toSource.targetOffset! + 5);
    expect(snippet).toBe('<note');

    // Now map back Source -> Visual
    const backToVisual = syncSourceToVisual(toSource.xml, toSource.targetOffset! + 3);
    expect(backToVisual.ok).toBe(true);
    if (backToVisual.ok) {
      expect(backToVisual.elementPath).toEqual(toSource.elementPath);
      expect(backToVisual.targetPmPos).not.toBeNull();
    }
  });

  it('formats unindented DITA XML deterministically via formatDitaXml()', () => {
    const messy = `<?xml version="1.0" encoding="UTF-8"?><topic id="t1"><title>Hi</title><body><p>Hello <b>world</b></p></body></topic>`;
    const formatted = formatDitaXml(messy);
    expect(formatted.ok).toBe(true);
    if (formatted.ok) {
      expect(formatted.xml).toBe(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<topic id="t1">',
          '  <title>Hi</title>',
          '  <body>',
          '    <p>Hello <b>world</b></p>',
          '  </body>',
          '</topic>',
          '',
        ].join('\n'),
      );
    }
  });

  it('tracks single-line minimal diff accurately', () => {
    const base = '<topic id="a">\n  <title>Old</title>\n  <body>\n    <p>Keep</p>\n  </body>\n</topic>\n';
    const next = '<topic id="a">\n  <title>New</title>\n  <body>\n    <p>Keep</p>\n  </body>\n</topic>\n';
    const stats = computeXmlLineDiffStats(base, next);
    expect(stats.isIdentical).toBe(false);
    expect(stats.changedLines).toBe(1);
    expect(stats.addedLines).toBe(0);
    expect(stats.removedLines).toBe(0);
  });
});
