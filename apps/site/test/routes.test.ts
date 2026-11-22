import { describe, expect, it } from 'vitest';
import {
  DOC_SLUGS,
  docsPath,
  docsIndexPath,
  homePath,
  localeFromPath,
  localePath,
  normalizeBase,
  playgroundPath,
  stripBase,
  switchLocalePath,
  withBase,
} from '../src/i18n/locales.js';

describe('withBase', () => {
  it('passes through paths on a root deployment', () => {
    expect(withBase('/')).toBe('/');
    expect(withBase('/playground')).toBe('/playground');
    expect(withBase('/docs/getting-started')).toBe('/docs/getting-started');
  });

  it('prefixes a GitHub Pages project base without double slashes', () => {
    expect(withBase('/', '/DITAEditor/')).toBe('/DITAEditor/');
    expect(withBase('/playground', '/DITAEditor/')).toBe('/DITAEditor/playground');
    expect(withBase('/en/docs', 'DITAEditor')).toBe('/DITAEditor/en/docs');
  });

  it('normalises configured bases', () => {
    expect(normalizeBase('/')).toBe('/');
    expect(normalizeBase('')).toBe('/');
    expect(normalizeBase('/repo')).toBe('/repo/');
    expect(normalizeBase('repo/')).toBe('/repo/');
  });
});

describe('locale routing', () => {
  it('keeps zh at the root and en under /en', () => {
    expect(homePath('zh')).toBe('/');
    expect(homePath('en')).toBe('/en/');
    expect(playgroundPath('zh')).toBe('/playground');
    expect(playgroundPath('en')).toBe('/en/playground');
    expect(docsIndexPath('en')).toBe('/en/docs');
    expect(docsPath('en', 'ai-setup')).toBe('/en/docs/ai-setup');
  });

  it('composes locale and base together', () => {
    expect(localePath('zh', '/playground', '/DITAEditor/')).toBe('/DITAEditor/playground');
    expect(localePath('en', '/playground', '/DITAEditor/')).toBe('/DITAEditor/en/playground');
    expect(homePath('en', '/DITAEditor/')).toBe('/DITAEditor/en/');
  });

  it('switches locale while staying on the same page', () => {
    for (const slug of DOC_SLUGS) {
      const zhPath = docsPath('zh', slug);
      const enPath = docsPath('en', slug);
      expect(switchLocalePath(zhPath, 'en')).toBe(enPath);
      expect(switchLocalePath(enPath, 'zh')).toBe(zhPath);
    }
    expect(switchLocalePath('/en/', 'zh')).toBe('/');
    expect(switchLocalePath('/', 'en')).toBe('/en/');
    expect(switchLocalePath('/en/playground', 'zh')).toBe('/playground');
    expect(switchLocalePath('/playground', 'en')).toBe('/en/playground');
  });

  it('switches locale under a sub-path base', () => {
    expect(switchLocalePath('/DITAEditor/en/docs/features', 'zh', '/DITAEditor/')).toBe(
      '/DITAEditor/docs/features',
    );
    expect(switchLocalePath('/DITAEditor/docs/features', 'en', '/DITAEditor/')).toBe(
      '/DITAEditor/en/docs/features',
    );
    expect(switchLocalePath('/DITAEditor/', 'en', '/DITAEditor/')).toBe('/DITAEditor/en/');
  });

  it('detects the active locale from a pathname', () => {
    expect(localeFromPath('/')).toBe('zh');
    expect(localeFromPath('/docs/features')).toBe('zh');
    expect(localeFromPath('/en')).toBe('en');
    expect(localeFromPath('/en/docs/features')).toBe('en');
    expect(localeFromPath('/DITAEditor/en/docs/features', '/DITAEditor/')).toBe('en');
    expect(localeFromPath('/DITAEditor/docs/features', '/DITAEditor/')).toBe('zh');
  });

  it('strips a base and tolerates foreign paths', () => {
    expect(stripBase('/DITAEditor/docs/x', '/DITAEditor/')).toBe('/docs/x');
    expect(stripBase('/DITAEditor', '/DITAEditor/')).toBe('/');
    expect(stripBase('/docs/x', '/')).toBe('/docs/x');
    expect(stripBase('/elsewhere', '/DITAEditor/')).toBe('/elsewhere');
  });
});
