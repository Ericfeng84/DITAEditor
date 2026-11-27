import { useId, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import type { XmlAttributeEntry } from '@dita/core';
import { useI18n } from '../../i18n/index.js';

export interface RawAttributesSectionProps {
  rawAttrs: readonly XmlAttributeEntry[];
  /** Attribute names modeled by the DITA schema for this element. */
  knownNames: ReadonlySet<string>;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateAttr: (name: string, value: string | null) => void;
  /** Localized empty-state text (differs between Topic and Map panels). */
  emptyText: string;
}

/**
 * Bottom "XML source order & custom attributes" section, collapsed by default.
 * Preserves the exact XML attribute order, keeps inline value editing and the custom-attribute
 * form, and surfaces an amber badge whenever the element carries schema-unknown attributes.
 */
export function RawAttributesSection({
  rawAttrs,
  knownNames,
  isOpen,
  onToggle,
  onUpdateAttr,
  emptyText,
}: RawAttributesSectionProps) {
  const { t } = useI18n();
  const panelId = useId();
  const [customAttrName, setCustomAttrName] = useState('');
  const [customAttrValue, setCustomAttrValue] = useState('');
  const unknownCount = rawAttrs.filter((entry) => !knownNames.has(entry.name)).length;

  const handleAddCustomAttr = (event: React.FormEvent) => {
    event.preventDefault();
    const name = customAttrName.trim();
    if (!name || !/^[A-Za-z_][\w:.-]*$/.test(name)) return;
    onUpdateAttr(name, customAttrValue);
    setCustomAttrName('');
    setCustomAttrValue('');
  };

  return (
    <section className="p-3">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide"
      >
        <span className="flex items-center gap-1">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          )}
          {t('attributes.rawTitle')}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {unknownCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-sans text-[9.5px] font-semibold text-amber-800 normal-case">
              {t('attributes.rawCustomCount', { count: unknownCount })}
            </span>
          ) : null}
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
            {rawAttrs.length}
          </span>
        </span>
      </button>

      {isOpen ? (
        <div id={panelId} className="mt-2 space-y-1.5">
          <p className="text-[10.5px] leading-snug text-slate-500">{t('attributes.rawDesc')}</p>
          {rawAttrs.length === 0 ? (
            <p className="text-[11px] text-slate-400">{emptyText}</p>
          ) : (
            rawAttrs.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 rounded border border-slate-200/80 bg-slate-50 px-2 py-1"
              >
                <span
                  className={`shrink-0 font-mono text-[11px] font-medium ${
                    knownNames.has(entry.name) ? 'text-blue-700' : 'text-amber-700'
                  }`}
                >
                  {entry.name}
                </span>
                <span className="text-slate-400">=</span>
                <input
                  type="text"
                  aria-label={t('attributes.attrAria', { name: entry.name })}
                  value={entry.value}
                  onChange={(e) => onUpdateAttr(entry.name, e.target.value)}
                  className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onUpdateAttr(entry.name, null)}
                  aria-label={t('attributes.removeAria', { name: entry.name })}
                  title={t('attributes.remove')}
                  className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))
          )}

          <form onSubmit={handleAddCustomAttr} className="mt-2 flex items-center gap-1">
            <input
              type="text"
              value={customAttrName}
              onChange={(e) => setCustomAttrName(e.target.value)}
              placeholder={t('attributes.namePlaceholder')}
              aria-label={t('attributes.nameAria')}
              className="w-24 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              value={customAttrValue}
              onChange={(e) => setCustomAttrValue(e.target.value)}
              placeholder={t('attributes.valuePlaceholder')}
              aria-label={t('attributes.valueAria')}
              className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              aria-label={t('attributes.addCustomAria')}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-white hover:bg-slate-700"
              title={t('attributes.addCustom')}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
