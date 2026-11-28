/**
 * Phase 16 — the language tags offered by the "add target language" dialog.
 *
 * The field used to be free text, which happily accepted `zh-cn`, `chinese` or an empty string and
 * only failed server-side. A fixed catalogue keeps every tag well-formed (`LANG_TAG` still guards
 * the value), matches the tags DITA-OT actually ships language resources for, and lets the picker
 * show a human-readable name instead of asking a translator to remember BCP-47 casing.
 *
 * Common tags are ordered alphabetically so the list is predictable; `zh-CN`/`en-US` are pulled up
 * by `suggestTargetLang()` rather than by the sort order.
 */

export const TARGET_LANGUAGES: readonly string[] = [
  'ar-SA',
  'cs-CZ',
  'da-DK',
  'de-DE',
  'el-GR',
  'en-GB',
  'en-US',
  'es-ES',
  'fi-FI',
  'fr-FR',
  'he-IL',
  'hi-IN',
  'hu-HU',
  'id-ID',
  'it-IT',
  'ja-JP',
  'ko-KR',
  'nb-NO',
  'nl-NL',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'ro-RO',
  'ru-RU',
  'sk-SK',
  'sl-SI',
  'sv-SE',
  'th-TH',
  'tr-TR',
  'uk-UA',
  'vi-VN',
  'zh-CN',
  'zh-TW',
];

/**
 * Languages a translator is most likely to add next, in order. The alphabetical catalogue below
 * makes the list predictable but would otherwise default the dialog to `ar-SA` as soon as `en-US`
 * is taken, so the suggestion falls through this ranking first.
 */
const PREFERRED_LANGUAGES: readonly string[] = ['en-US', 'zh-CN', 'ja-JP', 'de-DE', 'fr-FR', 'es-ES'];

/**
 * Best guess for a manual whose source language is `sourceLang`: cross the two workbench locales
 * (`zh-CN` ⇄ `en-US`) and fall back to English for everything else, which is what most DITA shops
 * translate from.
 */
export function suggestTargetLang(sourceLang?: string | null): string {
  const base = (sourceLang ?? '').trim().toLowerCase();
  if (base.startsWith('zh')) return 'en-US';
  if (base.startsWith('en')) return 'zh-CN';
  return 'en-US';
}

/** `zh-CN` in the current UI locale → `中文 · zh-CN`; falls back to the raw tag without Intl data. */
export function languageLabel(tag: string, uiLocale: string): string {
  if (!TARGET_LANGUAGES.includes(tag)) return tag;
  try {
    const languageOnly = tag.split('-')[0] ?? tag;
    const name = new Intl.DisplayNames([uiLocale], { type: 'language' }).of(languageOnly);
    if (name && name !== languageOnly && name !== 'Unknown language') return `${name} · ${tag}`;
  } catch {
    /* Node builds without full ICU: show the tag only. */
  }
  return tag;
}

/** First free language, preferring `preferred`, then the source-language suggestion, then the ranking. */
export function pickAvailableTargetLang(
  preferred: string,
  taken: ReadonlySet<string>,
  sourceLang?: string | null,
): string {
  const sourceBase = (sourceLang ?? '').trim().toLowerCase();
  const lowerTaken = new Set([...taken].map((tag) => tag.toLowerCase()));
  const isFree = (tag: string) => !lowerTaken.has(tag.toLowerCase()) && tag.toLowerCase() !== sourceBase;
  const candidates = [
    preferred,
    suggestTargetLang(sourceLang),
    ...PREFERRED_LANGUAGES,
    ...TARGET_LANGUAGES,
  ];
  return candidates.find((tag) => tag !== '' && isFree(tag)) ?? '';
}
