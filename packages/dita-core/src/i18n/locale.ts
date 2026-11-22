/**
 * Isomorphic UI locale primitives shared by `@dita/web`, `@dita/api`, and `@dita/core`.
 * Zero runtime dependencies: the whole i18n layer is a strongly-typed TypeScript module.
 */

export type UiLocale = 'zh-CN' | 'en';

export const DEFAULT_UI_LOCALE: UiLocale = 'zh-CN';

export const SUPPORTED_UI_LOCALES: readonly UiLocale[] = ['zh-CN', 'en'];

/**
 * Normalize a BCP-47 tag (`zh`, `zh-CN`, `zh-Hans`, `en`, `en-US`, ...) into a supported
 * UI locale. English is the fallback for any non-Chinese tag; unknown/empty input keeps the
 * historical default (`zh-CN`) so Phase 0–7 behavior is unchanged.
 */
export function normalizeLocale(input?: string | null): UiLocale {
  if (!input) return DEFAULT_UI_LOCALE;
  const tag = String(input).trim().toLowerCase();
  if (!tag) return DEFAULT_UI_LOCALE;
  if (tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('zh_')) return 'zh-CN';
  if (tag === 'en' || tag.startsWith('en-') || tag.startsWith('en_')) return 'en';
  return DEFAULT_UI_LOCALE;
}

export function isEnglishLocale(locale?: UiLocale | string | null): boolean {
  return normalizeLocale(locale) === 'en';
}

export interface FormatMessageParams {
  [name: string]: string | number;
}

/**
 * Named placeholder interpolation (`{name}`). Unknown placeholders are left verbatim so
 * parity tests can catch missing parameters instead of silently rendering empty text.
 */
export function formatMessage(template: string, params?: FormatMessageParams): string {
  if (!params) return template;
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
