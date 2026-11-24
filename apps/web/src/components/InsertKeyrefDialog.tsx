import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  resolveKeyrefInKeyspace,
  type KeyspaceResult,
  type RawAttrs,
} from '@dita/core';
import { AlertTriangle, KeyRound, Search, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';

export interface InsertKeyrefDialogProps {
  open: boolean;
  keyspace: KeyspaceResult | null;
  rootMapPath: string | null;
  onClose: () => void;
  onConfirm: (tagName: 'keyword' | 'ph' | 'xref' | 'term', attrs: RawAttrs, fallbackText?: string) => void;
}

export function InsertKeyrefDialog({
  open,
  keyspace,
  rootMapPath,
  onClose,
  onConfirm,
}: InsertKeyrefDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('__all__');
  const [selectedKey, setSelectedKey] = useState('');
  const [tagName, setTagName] = useState<'keyword' | 'ph' | 'xref' | 'term'>('keyword');
  const [fallbackText, setFallbackText] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const keys = keyspace ? Object.keys(keyspace.keys).sort() : [];
      setSelectedKey(keys[0] ?? '');
      setSearch('');
      setScopeFilter('__all__');
      setTagName('keyword');
      setFallbackText('');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, keyspace]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCloseEvt = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', onCloseEvt);
    return () => dialog.removeEventListener('close', onCloseEvt);
  }, [onClose]);

  const filteredDefs = useMemo(() => {
    if (!keyspace) return [];
    const q = search.trim().toLowerCase();
    return Object.values(keyspace.keys)
      .sort((a, b) => a.qualifiedKey.localeCompare(b.qualifiedKey))
      .filter((def) => {
        if (scopeFilter !== '__all__') {
          if (scopeFilter === '__root__' && def.keyscope) return false;
          if (scopeFilter !== '__root__' && def.keyscope !== scopeFilter) return false;
        }
        if (!q) return true;
        return (
          def.qualifiedKey.toLowerCase().includes(q) ||
          (def.inlineText?.toLowerCase().includes(q) ?? false) ||
          (def.resolvedHref?.toLowerCase().includes(q) ?? false)
        );
      });
  }, [keyspace, search, scopeFilter]);

  const previewResolution = useMemo(() => {
    if (!selectedKey.trim()) return null;
    return resolveKeyrefInKeyspace(selectedKey, keyspace);
  }, [selectedKey, keyspace]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const key = selectedKey.trim();
    if (!key) return;
    const attrs: RawAttrs = [{ name: 'keyref', value: key, namespaceURI: null }];
    if (tagName === 'xref' && previewResolution?.definition?.format) {
      attrs.push({
        name: 'format',
        value: previewResolution.definition.format,
        namespaceURI: null,
      });
    }
    onConfirm(tagName, attrs, fallbackText.trim() || undefined);
    dialogRef.current?.close('ok');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 id={titleId} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <KeyRound className="h-4 w-4 text-blue-600" aria-hidden="true" />
          {t('keyref.title')}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('keyref.closeAria')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 p-5 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-500">{t('keyref.currentRootMap')}</span>
          <code className="font-mono text-[11px] font-semibold text-slate-800">
            {rootMapPath ?? t('keyref.noRootMap')}
          </code>
        </div>

        {/* Scope pills + search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('keyref.filterPlaceholder')}
              className="w-full rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          {keyspace && keyspace.scopes.length > 0 ? (
            <select
              aria-label={t('keyref.scopeAria')}
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="__all__">{t('keyref.scopeAll')}</option>
              <option value="__root__">{t('keyref.scopeRoot')}</option>
              {keyspace.scopes.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Available keys picker */}
        <div className="dita-scroller max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {filteredDefs.length === 0 ? (
            <p className="p-4 text-center text-slate-400">{t('keyref.empty')}</p>
          ) : (
            filteredDefs.map((def) => {
              const active = selectedKey === def.qualifiedKey;
              return (
                <button
                  key={def.qualifiedKey}
                  type="button"
                  onClick={() => setSelectedKey(def.qualifiedKey)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                    active ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono font-semibold text-blue-800">
                        {def.qualifiedKey}
                      </code>
                      {def.keyscope ? (
                        <span className="rounded bg-sky-100 px-1 py-0.2 font-mono text-[10px] text-sky-800">
                          {def.keyscope}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-600">
                      {def.inlineText ?? def.resolvedHref ?? def.href ?? t('keyref.noBinding')}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">
                    {def.sourceMapPath}:{def.line}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="keyref-input" className="mb-1 block font-medium text-slate-700">
              {t('keyref.valueLabel')}
            </label>
            <input
              id="keyref-input"
              type="text"
              required
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              placeholder={t('keyref.valuePlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="keyref-tag" className="mb-1 block font-medium text-slate-700">
              {t('keyref.tagLabel')}
            </label>
            <select
              id="keyref-tag"
              value={tagName}
              onChange={(e) => setTagName(e.target.value as 'keyword' | 'ph' | 'xref' | 'term')}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="keyword">&lt;keyword&gt; ({t('keyref.tagKeyword')})</option>
              <option value="ph">&lt;ph&gt; ({t('keyref.tagPh')})</option>
              <option value="xref">&lt;xref&gt; ({t('keyref.tagXref')})</option>
              <option value="term">&lt;term&gt; ({t('keyref.tagTerm')})</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="keyref-fallback" className="mb-1 block font-medium text-slate-700">
            {t('keyref.fallbackLabel')}
          </label>
          <input
            id="keyref-fallback"
            type="text"
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            placeholder={t('keyref.fallbackPlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          />
        </div>

        {selectedKey.trim() && previewResolution ? (
          previewResolution.status === 'resolved' ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900">
              {t('keyref.resolution')}
              <strong className="ml-1 font-semibold">
                {previewResolution.resolvedText ?? previewResolution.targetFilePath ?? t('keyref.defined')}
              </strong>
              {previewResolution.definition ? (
                <span className="ml-2 font-mono text-[10px] text-emerald-700">
                  ({previewResolution.definition.sourceMapPath}:{previewResolution.definition.line})
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{t('keyref.errorWarning', { message: previewResolution.errorMessage ?? '' })}</span>
            </div>
          )
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!selectedKey.trim()}
            className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
          >
            {t('keyref.submit')} &lt;{tagName}&gt;
          </button>
        </div>
      </form>
    </dialog>
  );
}
