import { describe, expect, it } from 'vitest';
import {
  createDitavalTemplate,
  evaluateElementConditions,
  extractProfilingValuesFromDocument,
  formatProfilingAttrValue,
  parseDitaval,
  parseProfilingAttrValue,
  parseXml,
  type XmlAttributeEntry,
} from '../src/index.js';

function attrs(record: Record<string, string>): XmlAttributeEntry[] {
  return Object.entries(record).map(([name, value]) => ({
    name,
    value,
    namespaceURI: null,
  }));
}

describe('DITAVAL parser & conditional profiling evaluator', () => {
  const sampleDitaval = `<?xml version="1.0" encoding="UTF-8"?>
<val>
  <style-conflict foreground-conflict-color="#991b1b" background-conflict-color="#fee2e2"/>
  <prop action="exclude" att="audience" val="internal"/>
  <prop action="exclude" att="platform" val="windows"/>
  <prop action="include" att="platform" val="linux"/>
  <prop action="flag" att="product" val="cloud" color="#0369a1" backcolor="#e0f2fe" style="bold">
    <startflag><alt-text>Cloud</alt-text></startflag>
    <endflag><alt-text>/Cloud</alt-text></endflag>
  </prop>
  <prop action="flag" att="audience" val="admin" color="#7c3aed" backcolor="#f5f3ff">
    <startflag><alt-text>Admin</alt-text></startflag>
  </prop>
  <prop action="exclude" att="deployment" val="onprem"/>
  <revprop action="flag" val="2.0" color="#166534" backcolor="#dcfce7" changebar="style:solid">
    <startflag><alt-text>v2.0</alt-text></startflag>
  </revprop>
</val>`;

  it('parses valid DITAVAL rules, flag endpoints, revprop, and style-conflict', () => {
    const parsed = parseDitaval(sampleDitaval);

    expect(parsed.defaultAction).toBe('include');
    expect(parsed.styleConflict).toEqual({
      foregroundConflictColor: '#991b1b',
      backgroundConflictColor: '#fee2e2',
    });
    expect(parsed.exactRules['audience\0internal']?.action).toBe('exclude');
    expect(parsed.exactRules['product\0cloud']?.startFlag?.altText).toBe('Cloud');
    expect(parsed.exactRules['product\0cloud']?.endFlag?.altText).toBe('/Cloud');
    expect(parsed.revRules['2.0']?.action).toBe('flag');
    expect(parsed.revRules['2.0']?.changebar).toBe('style:solid');
  });

  it('rejects non-<val> roots and malformed XML cleanly', () => {
    expect(() => parseDitaval('<topic id="t1"><title>Not a val</title></topic>')).toThrow(
      /<val>/,
    );
    expect(() => parseDitaval('<val><prop action="exclude"</val>')).toThrow();
  });

  it('applies DITA 1.3 multi-value exclusion semantics (exclude only if all values in an attribute are excluded)', () => {
    const parsed = parseDitaval(sampleDitaval);

    // Single excluded token -> excluded
    const onlyWin = evaluateElementConditions(attrs({ platform: 'windows' }), parsed);
    expect(onlyWin.status).toBe('exclude');
    expect(onlyWin.excludedBy).toEqual({ attr: 'platform', values: ['windows'] });

    // Multi-value with one excluded and one included -> INCLUDED per DITA 1.3 spec
    const winAndLinux = evaluateElementConditions(attrs({ platform: 'windows linux' }), parsed);
    expect(winAndLinux.status).toBe('include');

    // Multi-attribute AND semantics: platform included, audience excluded -> EXCLUDED
    const crossAttr = evaluateElementConditions(
      attrs({ platform: 'linux', audience: 'internal' }),
      parsed,
    );
    expect(crossAttr.status).toBe('exclude');
    expect(crossAttr.excludedBy?.attr).toBe('audience');
  });

  it('evaluates grouped props syntax such as props="deployment(onprem)"', () => {
    const parsed = parseDitaval(sampleDitaval);

    const excludedGrouped = evaluateElementConditions(
      attrs({ props: 'deployment(onprem)' }),
      parsed,
    );
    expect(excludedGrouped.status).toBe('exclude');
    expect(excludedGrouped.excludedBy?.attr).toBe('deployment');

    const includedGrouped = evaluateElementConditions(
      attrs({ props: 'deployment(onprem saas)' }),
      parsed,
    );
    expect(includedGrouped.status).toBe('include');
  });

  it('applies flagging, revprop, and style-conflict colors when multiple flags collide', () => {
    const parsed = parseDitaval(sampleDitaval);

    const singleFlag = evaluateElementConditions(attrs({ product: 'cloud' }), parsed);
    expect(singleFlag.status).toBe('flag');
    expect(singleFlag.flags).toHaveLength(1);
    expect(singleFlag.effectiveStyle?.color).toBe('#0369a1');
    expect(singleFlag.effectiveStyle?.backcolor).toBe('#e0f2fe');

    const conflictingFlags = evaluateElementConditions(
      attrs({ product: 'cloud', audience: 'admin', rev: '2.0' }),
      parsed,
    );
    expect(conflictingFlags.status).toBe('flag');
    expect(conflictingFlags.flags).toHaveLength(3);
    expect(conflictingFlags.effectiveStyle?.color).toBe('#991b1b');
    expect(conflictingFlags.effectiveStyle?.backcolor).toBe('#fee2e2');
  });

  it('parses/formats profiling attribute tokens and extracts distinct values from a topic', () => {
    expect(parseProfilingAttrValue(' linux   macos ')).toEqual(['linux', 'macos']);
    expect(formatProfilingAttrValue(['linux', 'macos', 'linux', ''])).toBe('linux macos');

    const parsed = parseXml(
      `<concept id="c1" product="cloud">
        <title>Test</title>
        <conbody>
          <p audience="admin developer" platform="linux macos">A</p>
          <p audience="admin" rev="2.0">B</p>
        </conbody>
      </concept>`,
    );
    const extracted = extractProfilingValuesFromDocument(parsed.document);
    expect(extracted.product).toEqual(['cloud']);
    expect(extracted.audience).toEqual(['admin', 'developer']);
    expect(extracted.platform).toEqual(['linux', 'macos']);
    expect(extracted.rev).toEqual(['2.0']);
  });

  it('generates a parseable default DITAVAL template', () => {
    const xml = createDitavalTemplate('Cloud Release');
    const parsed = parseDitaval(xml);
    expect(parsed.defaultAction).toBe('include');
  });
});
