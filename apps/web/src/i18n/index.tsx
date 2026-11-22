import { formatMessage } from '@dita/core';
import { useCallback } from 'react';
import { useLocaleStore } from './locale.js';
import { type MessageKey, type MessageParams, translate } from './messages/index.js';

export type { MessageKey, MessageParams };
export {
  LOCALE_STORAGE_KEY,
  applyDocumentLocale,
  DEFAULT_UI_LOCALE,
  getCurrentLocale,
  onLocaleChange,
  resolveInitialLocale,
  switchLocale,
  useLocaleStore,
} from './locale.js';

export { translate, catalogueFor, allMessageKeys } from './messages/index.js';

/** Translate outside React (stores, API clients, editor plugins). */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(useLocaleStore.getState().locale, key, params);
}

/**
 * React binding. Re-renders the calling component whenever the locale changes,
 * so a switch hot-swaps every visible string without a reload.
 */
export function useI18n(): {
  locale: 'zh-CN' | 'en';
  t: (key: MessageKey, params?: MessageParams) => string;
  setLocale: (locale: 'zh-CN' | 'en') => void;
} {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const translator = useCallback(
    (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
    [locale],
  );
  return { locale, t: translator, setLocale };
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function dateTimeFormatter(locale: string): Intl.DateTimeFormat {
  const cached = dateTimeFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  dateTimeFormatters.set(locale, formatter);
  return formatter;
}

export function formatDateTime(value: string | number | Date, locale = useLocaleStore.getState().locale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateTimeFormatter(locale).format(date);
}

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  const cached = relativeFormatters.get(locale);
  if (cached) return cached;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  relativeFormatters.set(locale, formatter);
  return formatter;
}

/** Renders "3 分钟前" / "3 minutes ago" with Intl.RelativeTimeFormat. */
export function formatRelativeTime(
  value: string | number | Date,
  locale = useLocaleStore.getState().locale,
  now = Date.now(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const formatter = relativeFormatter(locale);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return formatter.format(diffSeconds, 'second');
  if (abs < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  return formatter.format(Math.round(diffSeconds / 86_400), 'day');
}

/** "1.8s" / "420ms" style durations are locale-neutral; only the unit wording differs. */
export function formatDuration(ms: number, locale = useLocaleStore.getState().locale): string {
  if (ms < 1000) return `${Math.round(ms)} ${translate(locale, 'common.unitMs')}`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} ${translate(locale, 'common.unitSec')}`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${String(minutes)} ${translate(locale, 'common.unitMin')} ${String(rest)} ${translate(locale, 'common.unitSec')}`;
}

/** Exposed for components that need to format a backend message with `{param}` slots. */
export function interpolate(template: string, params?: MessageParams): string {
  return formatMessage(template, params);
}
