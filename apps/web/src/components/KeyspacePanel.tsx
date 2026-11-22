import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import type { KeyDefinition, KeyspaceResult } from '@dita/core';
import {
  AlertTriangle,
  ExternalLink,
  KeyRound,
  PlusCircle,
  Search,
} from 'lucide-react';

export interface KeyspacePanelProps {
  rootMapPath: string | null;
  keyspace: KeyspaceResult | null;
  canInsertInTopic: boolean;
  onInsertKeyref: (qualifiedKey: string) => void;
  onJumpToKeyDef: (def: KeyDefinition) => void;
}

export function KeyspacePanel({
  rootMapPath,
  keyspace,
  canInsertInTopic,
  onInsertKeyref,
  onJumpToKeyDef,
}: KeyspacePanelProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [activeScope, setActiveScope] = useState<string>('__all__');

  const definitions = useMemo(() => {
    if (!keyspace) return [];
    const list = Object.values(keyspace.keys).sort((a, b) =>
      a.qualifiedKey.localeCompare(b.qualifiedKey),
    );
    const q = search.trim().toLowerCase();
    return list.filter((def) => {
      if (activeScope !== '__all__') {
        if (activeScope === '__root__') {
          if (def.keyscope) return false;
        } else if (def.keyscope !== activeScope) {
          return false;
        }
      }
      if (!q) return true;
      return (
        def.qualifiedKey.toLowerCase().includes(q) ||
        (def.inlineText?.toLowerCase().includes(q) ?? false) ||
        (def.resolvedHref?.toLowerCase().includes(q) ?? false) ||
        def.sourceMapPath.toLowerCase().includes(q)
      );
    });
  }, [keyspace, search, activeScope]);

  if (!rootMapPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
        <KeyRound className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
        <p>{t('keyspace.pickRoot')}</p>
        <p className="mt-1 text-[11px]">{t('keyspace.pickRootHint')}</p>
      </div>
    );
  }

  const totalKeys = keyspace ? Object.keys(keyspace.keys).length : 0;
  const scopes = keyspace?.scopes ?? [];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header summary */}
      <div className="border-b border-slate-100 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />
              <span className="truncate text-xs font-semibold text-slate-800">
                Root Map Keyspace
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400" title={rootMapPath}>
              {rootMapPath}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-violet-700">
            {totalKeys} keys
          </span>
        </div>

        {/* Scope filter pills */}
        {scopes.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveScope('__all__')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                activeScope === '__all__'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('keyspace.scope.all')}
            </button>
            <button
              type="button"
              onClick={() => setActiveScope('__root__')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                activeScope === '__root__'
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('keyspace.scope.global')}
            </button>
            {scopes.map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setActiveScope(sc)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                  activeScope === sc
                    ? 'bg-violet-600 text-white'
                    : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Search */}
      <div className="border-b border-slate-100 px-2.5 py-1.5">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2 h-3 w-3 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('keyspace.searchPlaceholder')}
            aria-label={t('keyspace.searchAria')}
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-1 pr-2 pl-6 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Map cycle warning if any */}
      {keyspace && keyspace.mapCycles.length > 0 ? (
        <div className="mx-2.5 mt-2 rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-800">
          <div className="flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
            <span>{t('keyspace.cycles', { count: keyspace.mapCycles.length })}</span>
          </div>
        </div>
      ) : null}

      {/* Keys list */}
      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto p-2 space-y-1.5">
        {definitions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            {totalKeys === 0
              ? t('keyspace.emptyRoot')
              : t('keyspace.emptyFiltered')}
          </div>
        ) : (
          definitions.map((def) => {
            const preview =
              def.inlineText ??
              (def.targetTitle ? `${def.targetTitle} (${def.resolvedHref ?? def.href})` : def.resolvedHref ?? def.href ?? t('keyspace.noValue'));

            return (
              <div
                key={def.qualifiedKey}
                className="group rounded-lg border border-slate-200/90 bg-slate-50/70 p-2 text-xs transition-colors hover:border-violet-300 hover:bg-violet-50/30"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 items-center gap-1">
                    <code className="truncate rounded bg-violet-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-violet-900">
                      {def.qualifiedKey}
                    </code>
                    {def.keyscope ? (
                      <span className="shrink-0 rounded bg-sky-100 px-1 py-0.5 font-mono text-[9.5px] text-sky-800">
                        scope:{def.keyscope}
                      </span>
                    ) : null}
                    {def.shadowedCount > 0 ? (
                      <span
                        className="shrink-0 rounded bg-amber-100 px-1 py-0.5 font-mono text-[9.5px] text-amber-800"
                        title={t('keyspace.shadowedTooltip', { count: def.shadowedCount })}
                      >
                        {t('keyspace.shadowedCount', { count: def.shadowedCount })}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-1 truncate text-[11.5px] font-medium text-slate-800" title={preview}>
                  {preview}
                </p>

                <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-slate-400">
                  <span className="truncate font-mono" title={`${def.sourceMapPath}:${def.line}`}>
                    {def.sourceMapPath}:{def.line}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {canInsertInTopic ? (
                      <button
                        type="button"
                        onClick={() => onInsertKeyref(def.qualifiedKey)}
                        title={t('keyspace.insertTooltip')}
                        className="inline-flex items-center gap-0.5 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-violet-500"
                      >
                        <PlusCircle className="h-2.5 w-2.5" aria-hidden="true" />
                        {t('keyspace.insert')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onJumpToKeyDef(def)}
                      title={t('keyspace.jumpTooltip')}
                      className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('attributes.define')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
