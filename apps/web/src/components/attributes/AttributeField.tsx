import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import {
  formatAttributeOptionLabel,
  getAttributeDescription,
  getAttributeExample,
  getAttributeLabel,
  getAttributePlaceholder,
  getAttributeUsage,
  type DitaAttributeSpec,
  type UiLocale,
} from '@dita/core';
import { HelpCircle } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

export interface AttributeFieldControlContext {
  inputId: string;
  helpId: string;
  /** Set only while the help card is open, so screen readers read the full explanation. */
  describedBy?: string;
}

export interface AttributeFieldProps {
  attr: DitaAttributeSpec;
  locale: UiLocale;
  inputId: string;
  /** Raw XML value (empty string when unset). */
  value: string;
  hasValue: boolean;
  helpOpen: boolean;
  onToggleHelp: () => void;
  onClear: () => void;
  onChange: (next: string | null) => void;
  /** Custom control slot: `KeyrefAttrField`, `ProfilingAttrEditor` or the Map `href` quick picker. */
  renderControl?: (ctx: AttributeFieldControlContext) => ReactNode;
}

/**
 * One DITA attribute row: compact localized label + monospace XML name badge + `?` toggle.
 * The long-form explanation stays collapsed until the `?` button is pressed and then expands
 * *above* the input, so an open autocomplete/dropdown can never cover it.
 */
export function AttributeField({
  attr,
  locale,
  inputId,
  value,
  hasValue,
  helpOpen,
  onToggleHelp,
  onClear,
  onChange,
  renderControl,
}: AttributeFieldProps) {
  const { t } = useI18n();
  const helpId = `${inputId}-help`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const label = getAttributeLabel(attr, locale);
  const description = getAttributeDescription(attr, locale);
  const usage = getAttributeUsage(attr, locale);
  const example = getAttributeExample(attr, locale);
  const describedBy = helpOpen ? helpId : undefined;

  const closeAndRefocus = () => {
    onToggleHelp();
    toggleRef.current?.focus();
  };

  const handleEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !helpOpen) return;
    event.preventDefault();
    event.stopPropagation();
    closeAndRefocus();
  };

  const controlCtx: AttributeFieldControlContext = { inputId, helpId, describedBy };
  const commonControlProps = {
    id: inputId,
    'aria-describedby': describedBy,
    'aria-description': helpOpen ? undefined : description,
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-1">
        <label
          htmlFor={inputId}
          className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-slate-700"
        >
          <span className="truncate">{label}</span>
          <code className="shrink-0 rounded bg-slate-100 px-1 py-px font-mono text-[9.5px] font-normal text-slate-500">
            {attr.name}
          </code>
          {attr.required ? (
            <span className="text-rose-500" aria-label={t('attributes.required')}>
              *
            </span>
          ) : null}
        </label>
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            ref={toggleRef}
            aria-expanded={helpOpen}
            aria-controls={helpId}
            aria-label={t('attributes.helpToggleAria', { name: attr.name })}
            title={t('attributes.helpToggleAria', { name: attr.name })}
            onClick={onToggleHelp}
            onKeyDown={handleEscape}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
              helpOpen
                ? 'border-blue-300 bg-blue-100 text-blue-700'
                : 'border-transparent text-slate-400 hover:bg-slate-100 hover:text-blue-600'
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {hasValue ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded px-1 py-0.5 text-[10px] text-slate-400 hover:bg-rose-50 hover:text-rose-600"
            >
              {t('attributes.clear')}
            </button>
          ) : null}
        </span>
      </div>

      {helpOpen ? (
        <div
          id={helpId}
          tabIndex={-1}
          onKeyDown={handleEscape}
          className="mb-1.5 rounded-md border border-blue-100 bg-blue-50/55 px-2.5 py-2 text-[11px] leading-relaxed text-slate-700"
        >
          <dl className="space-y-1.5">
            <div>
              <dt className="text-[10px] font-semibold tracking-wide text-blue-800 uppercase">
                {t('attributes.helpPurpose')}
              </dt>
              <dd>{description}</dd>
            </div>
            {usage ? (
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-blue-800 uppercase">
                  {t('attributes.helpUsage')}
                </dt>
                <dd>{usage}</dd>
              </div>
            ) : null}
            {example ? (
              <div>
                <dt className="text-[10px] font-semibold tracking-wide text-blue-800 uppercase">
                  {t('attributes.helpExample')}
                </dt>
                <dd>
                  <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-[10.5px] break-all text-slate-800">
                    {example}
                  </code>
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={closeAndRefocus}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-white"
            >
              {t('attributes.helpClose')}
            </button>
          </div>
        </div>
      ) : null}

      {renderControl ? (
        renderControl(controlCtx)
      ) : attr.values && attr.values.length > 0 ? (
        <select
          {...commonControlProps}
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
        >
          <option value="">{t('attributes.unset')}</option>
          {value && !attr.values.includes(value) ? (
            <option value={value}>{formatAttributeOptionLabel(attr, value, locale)}</option>
          ) : null}
          {attr.values.map((v) => (
            <option key={v} value={v}>
              {formatAttributeOptionLabel(attr, v, locale)}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...commonControlProps}
          type="text"
          value={value}
          placeholder={getAttributePlaceholder(attr, locale) ?? label}
          onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}
