import { normalizeLocale, type UiLocale } from '@dita/core';
import { create } from 'zustand';

/** localStorage key that survives reloads and workbench remounts. */
export const LOCALE_STORAGE_KEY = 'dita.uiLocale';

export const DEFAULT_UI_LOCALE: UiLocale = 'zh-CN';

interface LocaleState {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
}

function readPersistedLocale(): UiLocale | null {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return raw ? normalizeLocale(raw) : null;
  } catch {
    return null;
  }
}

function detectBrowserLocale(): UiLocale {
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
  return normalizeLocale(candidates[0] ?? DEFAULT_UI_LOCALE);
}

/** Resolution order: persisted user choice → browser preference → zh-CN. */
export function resolveInitialLocale(): UiLocale {
  return readPersistedLocale() ?? detectBrowserLocale();
}

function persist(locale: UiLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode / quota: locale still lives in memory */
  }
}

/** Keep `<html lang>`, `data-locale` and the CSS pseudo-label hook in sync. */
export function applyDocumentLocale(locale: UiLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
}

type LocaleListener = (locale: UiLocale) => void;

const localeListeners = new Set<LocaleListener>();

/**
 * Subscribe to locale changes from non-React modules (editor stores, `@dita/core` indexes).
 * The listener fires after the store and the DOM have been updated.
 */
export function onLocaleChange(listener: LocaleListener): () => void {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function notifyLocaleChange(locale: UiLocale): void {
  for (const listener of localeListeners) listener(locale);
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: resolveInitialLocale(),
  setLocale: (next) => {
    const locale = normalizeLocale(next);
    persist(locale);
    applyDocumentLocale(locale);
    if (get().locale !== locale) {
      set({ locale });
      notifyLocaleChange(locale);
    }
  },
}));

/** Imperative access for non-React modules (API clients, stores, editor commands). */
export function getCurrentLocale(): UiLocale {
  return useLocaleStore.getState().locale;
}

export function switchLocale(locale: UiLocale): void {
  useLocaleStore.getState().setLocale(locale);
}
