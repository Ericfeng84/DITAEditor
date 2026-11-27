import { describe, expect, it } from 'vitest';
import { zh } from '../src/i18n/zh.js';
import { en } from '../src/i18n/en.js';
import { getDictionary, isLocale } from '../src/i18n/index.js';
import { DOC_SLUGS, LOCALES } from '../src/i18n/locales.js';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, '../src/content/docs');

/** Flatten a dictionary into `a.b.c` key paths so structural drift is impossible to miss. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}

function leafValues(value: unknown, prefix = ''): { path: string; value: unknown }[] {
  if (value === null || typeof value !== 'object') return [{ path: prefix, value }];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    leafValues(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('site dictionaries', () => {
  it('zh and en expose the exact same key structure', () => {
    expect(keyPaths(en)).toEqual(keyPaths(zh));
  });

  it('has no empty or placeholder translations', () => {
    for (const locale of LOCALES) {
      const dict = getDictionary(locale);
      for (const leaf of leafValues(dict)) {
        if (typeof leaf.value !== 'string') continue;
        expect(leaf.value.trim(), `${locale}:${leaf.path}`).not.toBe('');
        expect(leaf.value, `${locale}:${leaf.path}`).not.toBe('TODO');
        expect(leaf.value, `${locale}:${leaf.path}`).not.toContain('Lorem ipsum');
      }
    }
  });

  it('keeps every documentation slug present in both locales', () => {
    for (const locale of LOCALES) {
      for (const slug of DOC_SLUGS) {
        expect(existsSync(join(docsRoot, locale, `${slug}.md`)), `${locale}/${slug}.md`).toBe(true);
      }
    }
  });

  it('ships exactly the documented guides per locale', () => {
    for (const locale of LOCALES) {
      const dir = join(docsRoot, locale);
      const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.md')) : [];
      expect(files.sort()).toEqual(DOC_SLUGS.map((slug) => `${slug}.md`).sort());
    }
  });

  it('validates locale guards', () => {
    expect(isLocale('zh')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
