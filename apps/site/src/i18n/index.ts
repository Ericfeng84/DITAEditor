import { DEFAULT_LOCALE, type Locale } from './locales.js';
import { zh } from './zh.js';
import { en } from './en.js';

export type SiteDictionary = typeof zh;

const DICTIONARIES: Record<Locale, SiteDictionary> = { zh, en };

export function getDictionary(locale: Locale): SiteDictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** A bilingual value authored inline in data modules. */
export interface LocalizedString {
  zh: string;
  en: string;
}

export function pickText(value: LocalizedString, locale: Locale): string {
  return value[locale];
}

export function isLocale(value: string | undefined): value is Locale {
  return value === 'zh' || value === 'en';
}
