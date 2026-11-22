import { formatMessage, type UiLocale } from '@dita/core';
import { en } from './en.js';
import { type MessageKey, type MessageParams, zhCN } from './zh-CN.js';

export type { MessageKey, MessageParams };

const CATALOGUES: Readonly<Record<UiLocale, Readonly<Record<MessageKey, string>>>> = {
  'zh-CN': zhCN,
  en,
};

/**
 * Look up + interpolate. Unknown keys fall back to the key itself so a missing
 * translation degrades visibly instead of throwing inside a render pass.
 */
export function translate(locale: UiLocale, key: MessageKey, params?: MessageParams): string {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES['zh-CN'];
  const template = catalogue[key] ?? zhCN[key] ?? key;
  return params ? formatMessage(template, params) : template;
}

export function catalogueFor(locale: UiLocale): Readonly<Record<MessageKey, string>> {
  return CATALOGUES[locale] ?? CATALOGUES['zh-CN'];
}

export function allMessageKeys(): MessageKey[] {
  return Object.keys(zhCN) as MessageKey[];
}

export { en, zhCN };
