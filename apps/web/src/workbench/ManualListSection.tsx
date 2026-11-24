import { FolderPlus, Loader2, Plus, Search } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { Manual } from '../services/manuals-api.js';
import { ManualCard } from './ManualCard';

export interface ManualListSectionProps {
  manuals: Manual[];
  loading: boolean;
  query: string;
  includeArchived: boolean;
  busyManualId: string | null;
  canManage: boolean;
  offline: boolean;
  onQueryChange: (query: string) => void;
  onToggleArchived: (include: boolean) => void;
  onCreate: () => void;
  onAttach: () => void;
  onOpen: (manual: Manual) => void;
  onEdit: (manual: Manual) => void;
  onToggleArchive: (manual: Manual) => void;
  onRemove: (manual: Manual) => void;
}

export function ManualListSection({
  manuals,
  loading,
  query,
  includeArchived,
  busyManualId,
  canManage,
  offline,
  onQueryChange,
  onToggleArchived,
  onCreate,
  onAttach,
  onOpen,
  onEdit,
  onToggleArchive,
  onRemove,
}: ManualListSectionProps) {
  const { t } = useI18n();
  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('workbench.searchPlaceholder')}
              aria-label={t('workbench.searchAria')}
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {offline ? null : (
            <label className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(event) => onToggleArchived(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
              />
              {t('workbench.includeArchived')}
            </label>
          )}
        </div>
        {canManage && !offline ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onAttach}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('workbench.attachManual')}
            </button>
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-[11.5px] font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('workbench.newManual')}
            </button>
          </div>
        ) : null}
      </div>

      {loading && manuals.length === 0 ? (
        <div className="mt-6 flex items-center gap-2 text-[12px] text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('workbench.loading')}
        </div>
      ) : manuals.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
          <h3 className="text-[13px] font-semibold text-slate-800">
            {query.trim() ? t('workbench.emptySearch') : t('workbench.emptyTitle')}
          </h3>
          {query.trim() ? null : (
            <>
              <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-slate-500">
                {t('workbench.emptyDescription')}
              </p>
              {canManage ? (
                <button
                  type="button"
                  onClick={onCreate}
                  className="mt-3 inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-blue-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('workbench.emptyAction')}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {manuals.map((manual) => (
            <ManualCard
              key={manual.id}
              manual={manual}
              busy={busyManualId === manual.id}
              canManage={canManage}
              onOpen={onOpen}
              onEdit={onEdit}
              onToggleArchive={onToggleArchive}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
