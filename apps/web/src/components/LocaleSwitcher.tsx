import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { UiLocale } from '@dita/core';

const OPTIONS: ReadonlyArray<{ locale: UiLocale; labelKey: 'locale.zh' | 'locale.en' }> = [
  { locale: 'zh-CN', labelKey: 'locale.zh' },
  { locale: 'en', labelKey: 'locale.en' },
];

/**
 * Header language switch. Switching is a pure state change: unsaved buffers, open tabs,
 * ProseMirror history and CodeMirror scroll positions all survive because nothing remounts.
 */
export function LocaleSwitcher() {
  const { locale, t, setLocale } = useI18n();
  return (
    <div
      role="group"
      aria-label={t('locale.group')}
      className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100/80 p-0.5"
    >
      <Languages className="ml-1 mr-0.5 h-3 w-3 text-slate-400" aria-hidden="true" />
      {OPTIONS.map((option) => {
        const active = locale === option.locale;
        return (
          <button
            key={option.locale}
            type="button"
            aria-pressed={active}
            lang={option.locale}
            onClick={() => setLocale(option.locale)}
            title={t('locale.switchTo', { language: t(option.labelKey) })}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
              active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
