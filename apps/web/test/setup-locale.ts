import { beforeEach } from 'vitest';
import { useLocaleStore } from '../src/i18n/index.js';

/**
 * Node exposes `navigator.language = 'en-US'`, so the browser-detection path of
 * `resolveInitialLocale()` would flip every existing assertion to English.
 * Pin the suite to the project's default UI locale; Phase 8 tests that need English call
 * `switchLocale('en')` themselves.
 */
beforeEach(() => {
  useLocaleStore.setState({ locale: 'zh-CN' });
});
