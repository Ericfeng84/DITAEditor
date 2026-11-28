/**
 * Phase 16 — `<AddTargetLanguageDialog>` language picker helpers.
 *
 * The field is a dropdown over a fixed BCP-47 catalogue now, so these tests pin the three things
 * that used to be free-text behaviour: the suggested default, the case-insensitive "already paired"
 * filter, and the fact that every offered tag is a well-formed DITA language tag.
 */
import { describe, expect, it } from 'vitest';

import {
  TARGET_LANGUAGES,
  languageLabel,
  pickAvailableTargetLang,
  suggestTargetLang,
} from '../src/translation/target-languages.js';

const LANG_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

describe('target language catalogue', () => {
  it('offers only well-formed, unique language tags', () => {
    expect(TARGET_LANGUAGES.length).toBeGreaterThan(10);
    for (const tag of TARGET_LANGUAGES) expect(tag).toMatch(LANG_TAG);
    expect(new Set(TARGET_LANGUAGES).size).toBe(TARGET_LANGUAGES.length);
  });
});

describe('suggestTargetLang', () => {
  it('crosses the two workbench locales', () => {
    expect(suggestTargetLang('zh-CN')).toBe('en-US');
    expect(suggestTargetLang('en-US')).toBe('zh-CN');
  });

  it('falls back to en-US for unknown or missing source languages', () => {
    expect(suggestTargetLang('ja-JP')).toBe('en-US');
    expect(suggestTargetLang(null)).toBe('en-US');
    expect(suggestTargetLang('  ')).toBe('en-US');
  });
});

describe('pickAvailableTargetLang', () => {
  it('keeps the suggestion when it is free', () => {
    expect(pickAvailableTargetLang('en-US', new Set(), 'zh-CN')).toBe('en-US');
  });

  it('keeps an explicitly preferred language', () => {
    expect(pickAvailableTargetLang('fr-FR', new Set(['en-US']), 'zh-CN')).toBe('fr-FR');
  });

  it('skips languages that are already paired, case-insensitively', () => {
    expect(pickAvailableTargetLang('en-US', new Set(['en-us']), 'zh-CN')).toBe('ja-JP');
  });

  it('falls back to the ranking instead of the alphabet when the two workbench locales are taken', () => {
    expect(pickAvailableTargetLang('en-US', new Set(['en-us', 'ar-sa']), 'zh-CN')).toBe('ja-JP');
  });

  it('never suggests the source language itself', () => {
    expect(pickAvailableTargetLang('zh-CN', new Set(), 'zh-CN')).toBe('en-US');
  });

  it('degrades to an empty value when every language is taken', () => {
    const all = new Set(TARGET_LANGUAGES.map((tag) => tag.toLowerCase()));
    expect(pickAvailableTargetLang('en-US', all)).toBe('');
  });
});

describe('languageLabel', () => {
  it('appends the raw tag to the localized language name', () => {
    expect(languageLabel('en-US', 'zh-CN')).toContain('en-US');
    expect(languageLabel('zh-CN', 'en')).toContain('zh-CN');
    expect(languageLabel('zh-CN', 'zh-CN')).not.toBe('zh-CN');
  });

  it('falls back to the bare tag', () => {
    expect(languageLabel('xx-YY', 'en')).toBe('xx-YY');
  });
});
