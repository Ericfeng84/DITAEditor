import { useMemo, useState } from 'react';
import { resolveKeyrefInKeyspace, type KeyDefinition, type KeyspaceResult } from '@dita/core';
import { ChevronDown, KeyRound, Plus, Search } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

export interface KeyrefAttrFieldProps {
  inputId: string;
  value: string;
  placeholder?: string;
  keyspace: KeyspaceResult | null;
  canEditKeys?: boolean;
  onChange: (value: string | null) => void;
  onOpenNewKey?: () => void;
  onInspectKeyDef?: (def: KeyDefinition) => void;
}

/**
 * `keyref` needs a key name the author cannot remember, so the field pairs the plain
 * input with a searchable keyspace picker and a shortcut to create a missing key.
 */
export function KeyrefAttrField({
  inputId,
  value,
  placeholder,
  keyspace,
  canEditKeys = false,
  onChange,
  onOpenNewKey,
  onInspectKeyDef,
}: KeyrefAttrFieldProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const definitions = useMemo(() => {
    const list = keyspace ? Object.values(keyspace.keys) : [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (def) =>
            def.qualifiedKey.toLowerCase().includes(q) ||
            (def.inlineText?.toLowerCase().includes(q) ?? false) ||
            (def.resolvedHref?.toLowerCase().includes(q) ?? false),
        )
      : list;
    return filtered.sort((a, b) => a.qualifiedKey.localeCompare(b.qualifiedKey)).slice(0, 50);
  }, [keyspace, search]);

  const select = (key: string) => {
    onChange(key || null);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <input
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="button"
          aria-expanded={open}
          aria-label={t('attributes.keyrefPickerAria')}
          title={t('attributes.keyrefPickerAria')}
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10.5px] font-medium text-blue-700 hover:bg-blue-50"
        >
          <KeyRound className="h-3 w-3" aria-hidden="true" />
          <ChevronDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div className="rounded-md border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-1.5 h-3 w-3 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('attributes.keyrefSearchPlaceholder')}
              aria-label={t('attributes.keyrefSearchPlaceholder')}
              className="w-full rounded border border-slate-200 bg-slate-50 py-0.5 pr-1.5 pl-5 text-[11px] focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="dita-scroller mt-1 max-h-40 overflow-y-auto">
            {definitions.length === 0 ? (
              <p className="p-2 text-center text-[10.5px] text-slate-400">
                {t('attributes.keyrefNoMatch')}
              </p>
            ) : (
              definitions.map((def) => {
                const resolved = keyspace ? resolveKeyrefInKeyspace(def.qualifiedKey, keyspace) : null;
                const preview =
                  def.inlineText ??
                  resolved?.resolvedText ??
                  def.resolvedHref ??
                  def.href ??
                  t('keyspace.noValue');
                return (
                  <div
                    key={def.qualifiedKey}
                    className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10.5px] ${
                      def.qualifiedKey === value ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => select(def.qualifiedKey)}
                      className="flex min-w-0 flex-1 items-center gap-1 text-left"
                    >
                      <code className="shrink-0 rounded bg-blue-100 px-1 font-mono text-[10px] font-semibold text-blue-900">
                        {def.qualifiedKey}
                      </code>
                      {def.keyscope ? (
                        <span className="shrink-0 rounded bg-sky-100 px-1 font-mono text-[9px] text-sky-800">
                          {def.keyscope}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-slate-600" title={preview}>
                        {preview}
                      </span>
                    </button>
                    {onInspectKeyDef ? (
                      <button
                        type="button"
                        onClick={() => {
                          onInspectKeyDef(def);
                          setOpen(false);
                        }}
                        className="shrink-0 rounded px-1 text-[9.5px] font-medium text-slate-500 hover:bg-white hover:text-blue-700"
                      >
                        {t('attributes.keyrefInspect')}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          {canEditKeys && onOpenNewKey ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenNewKey();
              }}
              className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded border border-dashed border-blue-200 px-1.5 py-1 text-[10.5px] font-medium text-blue-700 hover:bg-blue-50"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {t('attributes.keyrefCreate')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
