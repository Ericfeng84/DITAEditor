import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

export interface AttributeFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onlySet: boolean;
  onToggleOnlySet: () => void;
  /** Number of attributes currently set on the inspected element. */
  setCount: number;
}

/**
 * Compact sticky filter bar rendered right below the element/node header of both inspectors.
 * Search matches XML names, localized labels and usage scenarios; the toggle narrows the panel to
 * attributes that already carry a value.
 */
export function AttributeFilterBar({
  query,
  onQueryChange,
  onlySet,
  onToggleOnlySet,
  setCount,
}: AttributeFilterBarProps) {
  const { t } = useI18n();
  const hasQuery = query.length > 0;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-slate-200 bg-white/95 px-2.5 py-1.5 backdrop-blur">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-1.5 h-3 w-3 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label={t('attributes.searchAria')}
          placeholder={t('attributes.searchPlaceholder')}
          className="w-full rounded-md border border-slate-200 bg-white py-1 pr-6 pl-6 text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label={t('attributes.searchClearAria')}
            title={t('attributes.searchClearAria')}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-pressed={onlySet}
        aria-label={t('attributes.onlySetAria')}
        title={t('attributes.onlySetAria')}
        onClick={onToggleOnlySet}
        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-1 text-[10.5px] font-medium whitespace-nowrap transition-colors ${
          onlySet
            ? 'border-blue-300 bg-blue-50 text-blue-800'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
        {t('attributes.onlySet', { count: setCount })}
      </button>
    </div>
  );
}
