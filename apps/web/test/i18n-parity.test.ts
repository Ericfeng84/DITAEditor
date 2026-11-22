import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/messages/en.js';
import { zhCN } from '../src/i18n/messages/zh-CN.js';

/**
 * Phase 8 bilingual parity gate.
 *
 * `en` is typed as `Record<MessageKey, string>`, so a *missing* key already fails typecheck.
 * These assertions cover what the type system cannot: stray keys that nobody references, empty
 * translations, and placeholder drift (`{path}` in zh vs `{file}` in en renders raw braces).
 */

const zhKeys = Object.keys(zhCN).sort();
const enKeys = Object.keys(en).sort();

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

describe('web i18n catalogue parity', () => {
  it('defines the exact same key set in zh-CN and en', () => {
    expect(enKeys).toEqual(zhKeys);
    expect(zhKeys.length).toBeGreaterThan(500);
  });

  it('keeps every placeholder identical between the two locales', () => {
    const mismatches: string[] = [];
    for (const key of zhKeys) {
      const zh = placeholders((zhCN as Record<string, string>)[key] ?? '');
      const enPlaceholders = placeholders((en as Record<string, string>)[key] ?? '');
      if (zh.join(',') !== enPlaceholders.join(',')) {
        mismatches.push(`${key}: zh{${zh.join(',')}} vs en{${enPlaceholders.join(',')}}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('has no empty translations', () => {
    const empty = zhKeys.filter(
      (key) =>
        !((zhCN as Record<string, string>)[key] ?? '').trim() ||
        !((en as Record<string, string>)[key] ?? '').trim(),
    );
    expect(empty).toEqual([]);
  });

  it('never leaves CJK characters inside an English string', () => {
    const cjk = /[\u3400-\u9fff]/;
    const offenders = enKeys.filter((key) => cjk.test((en as Record<string, string>)[key] ?? ''));
    // The single documented exception is the language-switch label, which must read 中文.
    expect(offenders).toEqual(['locale.zh']);
    expect(en['locale.zh']).toBe('中文');
    expect(en['locale.en']).toBe('EN');
  });

  it('translates the shared shell vocabulary consistently', () => {
    expect(zhCN['common.cancel']).toBe('取消');
    expect(en['common.cancel']).toBe('Cancel');
    expect(zhCN['common.apply']).not.toBe(en['common.apply']);
  });
});
