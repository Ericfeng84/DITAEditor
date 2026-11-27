/**
 * In-app help center modal.
 *
 * Left = section nav, right = searchable content. A query switches the body from "active
 * section" to "every matching section, stacked", so a search for `conref` surfaces hits from
 * several chapters without making the reader guess which chapter to open.
 *
 * All copy comes from the i18n catalogue and all DITA facts are derived in `help-sections.ts`;
 * this file only lays them out.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Search, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import {
  buildHelpSections,
  filterHelpSections,
  helpEntryCount,
  type HelpBlock,
  type HelpImage,
  type HelpRow,
  type HelpSection,
} from './help-sections.js';

export interface HelpCenterDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Split "⌘/Ctrl + S — 保存当前标签页草稿" into the key chord and its meaning. */
function splitShortcut(item: string): { chord: string; label: string } {
  const separator = item.indexOf(' — ');
  if (separator === -1) return { chord: item, label: '' };
  return { chord: item.slice(0, separator), label: item.slice(separator + 3) };
}

function RowList({ caption, note, rows }: { caption: string; note?: string; rows: HelpRow[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{caption}</h4>
      {note ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p> : null}
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="font-mono text-xs leading-5 text-slate-900">{row.label}</dt>
            <dd className="text-xs leading-5 text-slate-600">
              <span>{row.detail}</span>
              {row.meta?.map((meta) => (
                <span key={meta.label} className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                  <span className="text-slate-400">{meta.label}</span>
                  <span className="px-1 text-slate-300">·</span>
                  {meta.mono ? <span className="font-mono">{meta.text}</span> : meta.text}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BlockView({ block, onZoom }: { block: HelpBlock; onZoom: (image: HelpImage) => void }) {
  const { t } = useI18n();
  switch (block.kind) {
    case 'steps':
      // Explicit numbering: a step list is the one place where a reader follows an order, so the
      // number must survive any list-style reset, and each step may carry a screenshot.
      return (
        <ol className="space-y-3">
          {block.items.map((step, index) => {
            const image = step.image;
            return (
              <li key={step.text} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm leading-relaxed text-slate-700">{step.text}</p>
                  {image ? (
                    <figure>
                      <button
                        type="button"
                        onClick={() => onZoom(image)}
                        title={t('help.zoomImage')}
                        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-md border border-slate-200 bg-white"
                      >
                        <img
                          src={image.src}
                          alt={image.alt}
                          loading="lazy"
                          decoding="async"
                          className="block max-h-72 w-full object-contain object-top"
                        />
                        <span className="pointer-events-none absolute top-1.5 right-1.5 rounded bg-slate-900/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <Maximize2 className="h-3 w-3" aria-hidden="true" />
                        </span>
                      </button>
                    </figure>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      );
    case 'bullets':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case 'table':
      return <RowList caption={block.caption} note={block.note} rows={block.rows} />;
    case 'shortcuts':
      return (
        <div className="space-y-3">
          {block.groups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{group.label}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {group.items.map((item) => {
                  const { chord, label } = splitShortcut(item);
                  return (
                    <li key={item} className="flex flex-wrap items-baseline gap-2 text-sm leading-relaxed">
                      <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                        {chord}
                      </kbd>
                      <span className="text-xs text-slate-600">{label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'links':
      return (
        <div className="space-y-2">
          {block.note ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              {block.note}
            </p>
          ) : null}
          <ul className="space-y-2">
            {block.items.map((item) => (
              <li key={item.href} className="rounded-md border border-slate-200 px-3 py-2">
                <a
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

function SectionBody({ section, onZoom }: { section: HelpSection; onZoom: (image: HelpImage) => void }) {
  const headingId = `help-section-${section.id}`;
  const Icon = section.icon;
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div>
        <h3 id={headingId} className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />
          {section.title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{section.intro}</p>
      </div>
      {section.blocks.map((block, index) => (
        <BlockView key={`${section.id}-${block.kind}-${index}`} block={block} onZoom={onZoom} />
      ))}
    </section>
  );
}

export function HelpCenterDialog({ open, onClose }: HelpCenterDialogProps) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('quickstart');
  const [zoomed, setZoomed] = useState<HelpImage | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const sections = useMemo(() => buildHelpSections(locale), [locale]);
  const matchedSections = useMemo(() => filterHelpSections(sections, query), [sections, query]);
  const searching = query.trim().length > 0;
  const totals = useMemo(() => helpEntryCount(sections), [sections]);
  const matched = useMemo(() => helpEntryCount(matchedSections), [matchedSections]);
  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  useEffect(() => {
    if (!open) {
      setQuery('');
      setZoomed(null);
      return;
    }
    searchRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        // The enlarged screenshot is a layer above the dialog, so it closes first.
        setZoomed((current) => {
          if (current) return null;
          onClose();
          return null;
        });
        return;
      }
      // Keep Tab inside the dialog so the workbench behind it stays untouchable.
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open || !active) return null;

  const visibleSections = searching ? matchedSections : [active];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <nav aria-label={t('help.ariaLabel')} className="hidden w-52 shrink-0 flex-col border-r border-slate-200 bg-slate-50/70 sm:flex">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold text-slate-900">
              {t('help.title')}
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('help.subtitle')}</p>
          </div>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = !searching && section.id === active.id;
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-current={isActive ? 'true' : undefined}
                    onClick={() => {
                      setQuery('');
                      setActiveId(section.id);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                      isActive ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t(section.navKey)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                aria-label={t('help.filterLabel')}
                placeholder={t('help.filterPlaceholder')}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white py-1.5 pr-2 pl-7 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <span className="hidden shrink-0 text-[11px] text-slate-500 md:inline">
              {t('help.filterCount', { matched, total: totals })}
            </span>
            <button
              type="button"
              onClick={onClose}
              title={t('help.close')}
              aria-label={t('help.close')}
              className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {visibleSections.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{t('help.filterEmpty')}</p>
            ) : (
              <div className="space-y-8">
                {visibleSections.map((section) => (
                  <SectionBody key={section.id} section={section} onZoom={setZoomed} />
                ))}
              </div>
            )}
            {visibleSections.some((section) => section.id === 'dita') ? (
              <p className="mt-6 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
                {t('help.derivedNote')}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {zoomed ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-6"
          onMouseDown={() => setZoomed(null)}
        >
          <img
            src={zoomed.src}
            alt={zoomed.alt}
            className="max-h-full max-w-full rounded-lg border border-white/20 shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  );
}
