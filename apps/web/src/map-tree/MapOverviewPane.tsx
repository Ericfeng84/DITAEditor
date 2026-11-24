import { useMemo } from 'react';
import { useI18n } from '../i18n/index.js';
import { parseDitaMap, resolveDitaHref } from '@dita/core';
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  Code2,
  FilePlus2,
  Network,
  ShieldCheck,
} from 'lucide-react';

export interface MapOverviewPaneProps {
  mapPath: string;
  xml: string;
  fileSet: ReadonlySet<string>;
  onUpdateRootTitle: (mapPath: string, title: string) => void;
  onActivateRootMap: (mapPath: string) => void;
  onOpenSourceMode: () => void;
  onOpenTopic: (filePath: string) => void;
  onCreateAndMount: (mapPath: string, title: string) => void;
}

export function MapOverviewPane({
  mapPath,
  xml,
  fileSet,
  onUpdateRootTitle,
  onActivateRootMap,
  onOpenSourceMode,
  onOpenTopic,
  onCreateAndMount,
}: MapOverviewPaneProps) {
  const { t } = useI18n();
  const parsed = useMemo(() => {
    try {
      return { ok: true as const, data: parseDitaMap(xml) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [xml]);

  if (!parsed.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-8 text-center">
        <AlertTriangle className="mb-2 h-8 w-8 text-rose-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-slate-900">{t('mapOverview.parseErrorTitle')}</h3>
        <p className="mt-1 max-w-md font-mono text-xs text-rose-700">{parsed.error}</p>
        <button
          type="button"
          onClick={onOpenSourceMode}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
          {t('mapOverview.fixInSource')}
        </button>
      </div>
    );
  }

  const map = parsed.data;
  const brokenRefs = map.references.filter((ref) => {
    if (ref.scope === 'external' || ref.scope === 'peer') return false;
    const res = resolveDitaHref(mapPath, ref.href);
    if (res.isExternal) return false;
    return res.escapesRoot || !res.targetPath || !fileSet.has(res.targetPath);
  });

  const submapCount = map.references.filter((r) => r.isSubmapRef).length;

  return (
    <div className="dita-scroller h-full overflow-y-auto bg-slate-100/80 p-6">
      <div className="mx-auto max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                  map.kind === 'bookmap'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-sky-100 text-sky-800'
                }`}
              >
                {map.kind === 'bookmap' ? (
                  <BookMarked className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Network className="h-3 w-3" aria-hidden="true" />
                )}
                &lt;{map.rootTag}&gt;
              </span>
              <span className="font-mono text-xs text-slate-500">{mapPath}</span>
            </div>

            <label htmlFor="map-overview-title" className="mt-3 block text-[11px] font-medium text-slate-500">
              {map.kind === 'bookmap' ? t('mapOverview.bookTitle') : t('mapOverview.mapTitle')}
            </label>
            <input
              id="map-overview-title"
              type="text"
              value={map.title}
              onChange={(e) => onUpdateRootTitle(mapPath, e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-base font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onActivateRootMap(mapPath)}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
            >
              {t('mapOverview.openInTree')}
            </button>
            <button
              type="button"
              onClick={() => onCreateAndMount(mapPath, map.title)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('mapTree.createMounted')}
            </button>
            <button
              type="button"
              onClick={onOpenSourceMode}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              {t('mapOverview.editSource')}
            </button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">{t('mapOverview.topNavNodes')}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">{map.nodes.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">{t('mapOverview.totalRefs')}</div>
            <div className="mt-0.5 text-lg font-bold text-slate-900">{map.references.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">{t('mapOverview.submaps')}</div>
            <div className="mt-0.5 text-lg font-bold text-sky-700">{submapCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">{t('mapOverview.brokenLinks')}</div>
            <div
              className={`mt-0.5 text-lg font-bold ${
                brokenRefs.length > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {brokenRefs.length}
            </div>
          </div>
        </div>

        {/* Preserved Metadata */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3.5 py-2.5 text-xs text-emerald-900">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
{t('mapOverview.lossless', {
              doctype: map.preservedMetaSummary.hasDoctype ? t('mapOverview.yes') : t('mapOverview.no'),
              comments: map.preservedMetaSummary.commentCount,
              pis: map.preservedMetaSummary.piCount,
            })}
            {map.preservedMetaSummary.hasReltable ? '、<reltable>' : ''}
            {map.preservedMetaSummary.hasBookmeta ? '、<bookmeta>' : ''}
            {map.preservedMetaSummary.hasTopicmeta ? '、<topicmeta>' : ''}
          </span>
        </div>

        {/* References Table */}
        <div>
          <h3 className="mb-2 text-xs font-semibold text-slate-700">{t('mapOverview.refsTitle')}</h3>
          {map.references.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              {t('mapOverview.noRefs')}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {map.references.map((ref, idx) => {
                const res = resolveDitaHref(mapPath, ref.href);
                const exists =
                  res.isExternal ||
                  ref.scope === 'external' ||
                  (!res.escapesRoot && Boolean(res.targetPath) && fileSet.has(res.targetPath));

                return (
                  <div
                    key={`${ref.elementPath.join('.')}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {exists ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-hidden="true" />
                      )}
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-700">
                        &lt;{ref.tagName}&gt;
                      </code>
                      <span className="truncate font-mono text-slate-700">{ref.href}</span>
                    </div>

                    {exists && !res.isExternal && res.targetPath ? (
                      <button
                        type="button"
                        onClick={() => onOpenTopic(res.targetPath)}
                        className="shrink-0 rounded border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                      >
                        {t('mapOverview.open')}
                      </button>
                    ) : !exists ? (
                      <span className="shrink-0 text-[11px] font-medium text-rose-600">
                        {t('mapOverview.fileMissing')}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
