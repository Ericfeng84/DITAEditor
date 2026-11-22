import { describe, expect, it } from 'vitest';
import {
  checkXmlWellFormed,
  buildKeyspace,
  parseDitaval,
  evaluateElementConditions,
  extractProfilingValuesFromDocument,
  roundTripXmlThroughPm,
  resolveKeyrefInKeyspace,
  getRawAttr,
  parseXml,
  type RawAttrs,
} from '@dita/core';
import { MINI_DEMO_XML, PLAYGROUND_PRESETS } from '../src/data/playground-presets.js';

/** Every preset must be a real, well-formed DITA document that survives the visual pipeline. */
describe('playground presets', () => {
  it('ships four distinct scenarios', () => {
    expect(PLAYGROUND_PRESETS).toHaveLength(4);
    expect(new Set(PLAYGROUND_PRESETS.map((preset) => preset.id)).size).toBe(4);
  });

  for (const preset of PLAYGROUND_PRESETS) {
    describe(preset.id, () => {
      it('is well-formed XML', () => {
        const result = checkXmlWellFormed(preset.xml);
        expect(result.ok, result.ok ? '' : result.error.message).toBe(true);
      });

      it('round-trips through ProseMirror byte for byte', () => {
        expect(roundTripXmlThroughPm(preset.xml).xml).toBe(preset.xml);
      });

      it('is idempotent on a second round-trip', () => {
        const once = roundTripXmlThroughPm(preset.xml).xml;
        expect(roundTripXmlThroughPm(once).xml).toBe(once);
      });
    });
  }

  it('the home mini demo also round-trips losslessly', () => {
    expect(checkXmlWellFormed(MINI_DEMO_XML).ok).toBe(true);
    expect(roundTripXmlThroughPm(MINI_DEMO_XML).xml).toBe(MINI_DEMO_XML);
  });

  it('resolves demo keys through a real keyspace', () => {
    const single = PLAYGROUND_PRESETS.find((preset) => preset.id === 'single-sourcing');
    expect(single?.keyspace).toBeTruthy();
    const files = single!.keyspace!.files;
    const keyspace = buildKeyspace(single!.keyspace!.rootMapPath, (path) => files[path] ?? null);

    const product = resolveKeyrefInKeyspace('product-name', keyspace);
    expect(product.status).toBe('resolved');
    expect(product.resolvedText).toBe('DITAEditor');

    const edition = resolveKeyrefInKeyspace('edition-label', keyspace);
    expect(edition.status).toBe('resolved');
    expect(edition.resolvedText).toBe('DITAEditor Cloud');

    const version = resolveKeyrefInKeyspace('cli-version', keyspace);
    expect(version.resolvedText).toBe('1.0.0');

    expect(resolveKeyrefInKeyspace('missing-key', keyspace).status).toBe('unresolved');
  });

  it('evaluates both DITAVAL profiles against the single-sourcing topic', () => {
    const single = PLAYGROUND_PRESETS.find((preset) => preset.id === 'single-sourcing')!;
    const cloud = parseDitaval(single.ditavalProfiles!.find((p) => p.id === 'cloud')!.xml);
    const onprem = parseDitaval(single.ditavalProfiles!.find((p) => p.id === 'onprem')!.xml);

    const values = extractProfilingValuesFromDocument(parseXml(single.xml).document);
    expect(values.product).toEqual(expect.arrayContaining(['cloud', 'onprem']));
    expect(values.audience).toEqual(expect.arrayContaining(['admin']));

    const cloudAttrs: RawAttrs = [{ name: 'product', value: 'cloud' }];
    expect(evaluateElementConditions(cloudAttrs, cloud).status).toBe('include');
    expect(evaluateElementConditions(cloudAttrs, onprem).status).toBe('exclude');

    const onpremAttrs: RawAttrs = [{ name: 'product', value: 'onprem' }];
    expect(evaluateElementConditions(onpremAttrs, cloud).status).toBe('exclude');
    expect(evaluateElementConditions(onpremAttrs, onprem).status).toBe('include');

    const adminOnprem: RawAttrs = [
      { name: 'audience', value: 'admin' },
      { name: 'product', value: 'onprem' },
    ];
    expect(evaluateElementConditions(adminOnprem, cloud).status).toBe('exclude');
    const adminCloud: RawAttrs = [
      { name: 'audience', value: 'admin' },
      { name: 'product', value: 'cloud' },
    ];
    const flagged = evaluateElementConditions(adminCloud, cloud);
    expect(flagged.status).toBe('flag');
    expect(flagged.flags.length).toBeGreaterThan(0);
    expect(getRawAttr(adminCloud, 'audience')).toBe('admin');
  });
});
