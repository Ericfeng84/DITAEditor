import {
  Archive,
  ArchiveRestore,
  FolderTree,
  GitBranch,
  Globe,
  Languages,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDateTime, formatRelativeTime, useI18n } from '../i18n/index.js';
import type { Manual } from '../services/manuals-api.js';
import type { ManualLanguageEdition } from './manual-language-families.js';

export interface ManualCardProps {
  manual: Manual;
  busy: boolean;
  canManage: boolean;
  /** Accepted for backward compatibility; the card's bottom bar no longer varies with it. */
  offline?: boolean;
  /** Language editions of this manual, base/source language first (Phase 16 hub grouping). */
  editions?: ManualLanguageEdition[];
  onOpenEdition?: (edition: ManualLanguageEdition) => void;
  onOpen: (manual: Manual) => void;
  onEdit: (manual: Manual) => void;
  onToggleArchive: (manual: Manual) => void;
  onRemove: (manual: Manual) => void;
}

export function ManualCard({
  manual,
  busy,
  canManage,
  editions,
  onOpenEdition,
  onOpen,
  onEdit,
  onToggleArchive,
  onRemove,
}: ManualCardProps) {
  const { t, locale } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Language pills only *select* an edition; the bottom "Open" button opens the selected one.
  const effectiveEditions: ManualLanguageEdition[] =
    editions ??
    (manual.sourceLang
      ? [
          {
            lang: manual.sourceLang,
            manualId: manual.id,
            branch: manual.currentBranch,
            manualName: manual.name,
            isBase: true,
            exists: manual.exists,
            stats: manual.stats,
            lastOpenedAt: manual.lastOpenedAt,
          },
        ]
      : []);

  const orderedEditions = [...effectiveEditions].sort(
    (left, right) => Number(right.isBase) - Number(left.isBase),
  );

  const [selectedLang, setSelectedLang] = useState<string | null>(
    () => orderedEditions[0]?.lang ?? null,
  );
  const selectedEdition =
    orderedEditions.find((edition) => edition.lang === selectedLang) ?? orderedEditions[0] ?? null;

  const displayStats = selectedEdition?.stats ?? manual.stats;
  const displayBranch = selectedEdition?.branch ?? manual.currentBranch;
  const displayLastOpenedAt = selectedEdition ? selectedEdition.lastOpenedAt ?? null : manual.lastOpenedAt;
  const displayExists = selectedEdition ? selectedEdition.exists : manual.exists;

  const lastOpened = displayLastOpenedAt
    ? t('workbench.lastOpened', { time: formatRelativeTime(displayLastOpenedAt, locale) })
    : t('workbench.neverOpened');

  const openSelected = () => {
    if (selectedEdition && !selectedEdition.isBase && onOpenEdition) {
      onOpenEdition(selectedEdition);
      return;
    }
    onOpen(manual);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <article
      className={`group relative flex flex-col rounded-xl border bg-white p-4 transition-shadow hover:shadow-md ${
        displayExists ? 'border-slate-200' : 'border-amber-200 bg-amber-50/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[13px] font-semibold text-slate-900">{manual.name}</h3>
            {manual.isBuiltin ? (
              <span className="rounded border border-slate-200 bg-slate-50 px-1 py-[1px] text-[10px] font-medium text-slate-500">
                {t('workbench.badgeBuiltin')}
              </span>
            ) : null}
            {manual.archived ? (
              <span className="rounded border border-slate-300 bg-slate-100 px-1 py-[1px] text-[10px] font-medium text-slate-600">
                {t('workbench.badgeArchived')}
              </span>
            ) : null}
            {!displayExists ? (
              <span className="inline-flex items-center gap-0.5 rounded border border-amber-300 bg-amber-100 px-1 py-[1px] text-[10px] font-medium text-amber-800">
                <TriangleAlert className="h-2.5 w-2.5" aria-hidden="true" />
                {t('workbench.badgeMissing')}
              </span>
            ) : null}
          </div>
          {orderedEditions.length > 0 ? (
            <div
              data-testid={`manual-editions-${manual.id}`}
              className="mt-1.5 flex flex-wrap items-center gap-1.5"
            >
              {orderedEditions.map((edition) => {
                const isSelected = edition.lang === selectedEdition?.lang;
                const baseLabel = t(
                  edition.isBase
                    ? 'translation.entry.openBaseEditionTitle'
                    : 'translation.entry.openTargetEditionTitle',
                  { lang: edition.lang, percent: edition.progressPercent ?? 0 },
                );
                // Phase 16: a derived edition (`depth >= 2`) is reachable from several branches,
                // so the pill carries its full root→leaf path instead of a bare language tag.
                const depth = edition.depth ?? 0;
                const nested = depth >= 2 && (edition.lineagePath?.length ?? 0) > 0;
                const lineagePath = edition.lineagePath?.join(' → ') ?? edition.lang;
                const label = nested
                  ? t('translation.entry.lineageEditionTitle', {
                      path: lineagePath,
                      title: baseLabel,
                    })
                  : baseLabel;
                return (
                  <button
                    key={`${edition.isBase ? 'base' : 'target'}-${edition.lang}-${edition.manualId}-${edition.branch}`}
                    type="button"
                    disabled={busy || !edition.exists}
                    data-testid={`manual-edition-${manual.id}-${edition.lang}`}
                    data-base={edition.isBase ? 'true' : 'false'}
                    data-depth={depth}
                    data-selected={isSelected ? 'true' : 'false'}
                    aria-pressed={isSelected}
                    title={label}
                    aria-label={label}
                    onClick={() => setSelectedLang(edition.lang)}
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {edition.isBase ? (
                      <Globe className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Languages
                        className={`h-2.5 w-2.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {nested ? (
                        <span aria-hidden="true" className="text-slate-400">
                          ↳{' '}
                        </span>
                      ) : null}
                      {edition.lang}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="mt-1 line-clamp-2 min-h-[2.1em] text-[11.5px] leading-snug text-slate-500">
            {manual.description || manual.rootDir}
          </p>
        </div>

        {canManage ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('workbench.edit')}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-[11.5px] shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(manual);
                  }}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  {t('workbench.edit')}
                </button>
                {manual.isBuiltin ? null : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleArchive(manual);
                    }}
                    className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-slate-700 hover:bg-slate-50"
                  >
                    {manual.archived ? (
                      <ArchiveRestore className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Archive className="h-3 w-3" aria-hidden="true" />
                    )}
                    {manual.archived ? t('workbench.unarchive') : t('workbench.archive')}
                  </button>
                )}
                {manual.isBuiltin ? null : (
                  <div className="mt-0.5 border-t border-slate-100 pt-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onRemove(manual);
                      }}
                      title={t('workbench.removeHint')}
                      className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      {t('workbench.remove')}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <FolderTree className="h-3 w-3 text-slate-400" aria-hidden="true" />
          {t('workbench.stats', {
            topics: displayStats.totalTopics,
            maps: displayStats.totalMaps,
          })}
        </span>
        <span className="inline-flex items-center gap-1">
          <GitBranch className="h-3 w-3 text-slate-400" aria-hidden="true" />
          {t('workbench.branch', { branch: displayBranch })}
        </span>
        {manual.myActiveAssignmentCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1 py-[1px] font-medium text-blue-700">
            <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
            {t('workbench.myAssignmentCount', { count: manual.myActiveAssignmentCount })}
          </span>
        ) : manual.activeAssignmentCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
            {t('workbench.assignmentCount', { count: manual.activeAssignmentCount })}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span
          className="truncate text-[10px] text-slate-400"
          title={
            displayLastOpenedAt ? formatDateTime(displayLastOpenedAt, locale) : manual.rootDir
          }
        >
          {lastOpened}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={openSelected}
            disabled={busy || !displayExists}
            data-testid={`manual-open-${manual.id}`}
            title={displayExists ? undefined : t('workbench.badgeMissing')}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            {t('workbench.open')}
          </button>
        </div>
      </div>
    </article>
  );
}
