import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown, Image, Loader2, Palette, RotateCcw, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import type { MessageKey } from '../../i18n/messages/index.js';
import type { PublishLoadStatus } from '../../store/publish-store';
import type {
  HtmlThemeDescriptor,
  HtmlThemeFeatures,
  HtmlThemeId,
} from '../../services/publish-api';
import type { WorkspaceFileNode } from '../../services/workspace-api';
import {
  collectThemeAssetPaths,
  normalizeAccentColor,
  themeThumbnailStyle,
} from './html-theme-model.js';
import type { ThemeDraft } from './html-theme-model.js';

const ACCENT_PRESETS = ['#2563eb', '#0ea5e9', '#059669', '#b45309', '#7c3aed', '#e11d48'] as const;

const FEATURE_ROWS: ReadonlyArray<{
  key: keyof HtmlThemeFeatures;
  labelKey: MessageKey;
  hintKey: MessageKey;
}> = [
  {
    key: 'search',
    labelKey: 'publish.theme.feature.search',
    hintKey: 'publish.theme.feature.searchHint',
  },
  { key: 'toc', labelKey: 'publish.theme.feature.toc', hintKey: 'publish.theme.feature.tocHint' },
  {
    key: 'codeCopy',
    labelKey: 'publish.theme.feature.codeCopy',
    hintKey: 'publish.theme.feature.codeCopyHint',
  },
  {
    key: 'colorModeToggle',
    labelKey: 'publish.theme.feature.colorModeToggle',
    hintKey: 'publish.theme.feature.colorModeToggleHint',
  },
];

export interface HtmlThemeSelectorProps {
  descriptors: HtmlThemeDescriptor[];
  status: PublishLoadStatus;
  error: string | null;
  draft: ThemeDraft;
  /** Theme id saved as the manual default, used for the badge. */
  defaultThemeId: HtmlThemeId | null;
  files: WorkspaceFileNode[];
  disabled?: boolean;
  onChange: (next: ThemeDraft) => void;
  onRetry: () => void;
  onPreview: () => void;
  onSaveDefault: () => void;
  savingDefault: boolean;
  savedDefault: boolean;
  saveError: string | null;
}

function ThemeThumbnail({ descriptor }: { descriptor: HtmlThemeDescriptor }) {
  const style = themeThumbnailStyle(descriptor.previewPalette);
  return (
    <div
      className="flex h-[68px] w-full items-stretch overflow-hidden rounded-md border"
      style={style.frame}
      aria-hidden="true"
    >
      <div className="flex w-[22%] flex-col gap-1 border-r p-1.5" style={style.sidebar}>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className="h-1 rounded-full"
            style={{ ...style.sidebarLine, width: index === 3 ? '60%' : '100%' }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-3.5 items-center gap-1 border-b px-1.5" style={style.header}>
          <span className="h-1.5 w-7 rounded-sm" style={style.title} />
          <span className="ml-auto h-1.5 w-3 rounded-sm" style={style.button} />
        </div>
        <div className="flex flex-1 flex-col gap-1 p-1.5">
          <span className="h-1.5 w-2/3 rounded-full" style={style.title} />
          <span className="h-1 w-full rounded-full" style={style.line} />
          <span className="h-1 w-5/6 rounded-full" style={style.line} />
          <div className="mt-auto flex items-center gap-1">
            <span className="h-1 w-3/5 rounded-full" style={style.line} />
            <span className="ml-auto h-2 w-5 rounded-sm" style={style.button} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HtmlThemeSelector({
  descriptors,
  status,
  error,
  draft,
  defaultThemeId,
  files,
  disabled = false,
  onChange,
  onRetry,
  onPreview,
  onSaveDefault,
  savingDefault,
  savedDefault,
  saveError,
}: HtmlThemeSelectorProps) {
  const { t } = useI18n();
  const [brandOpen, setBrandOpen] = useState(false);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const brandPanelRef = useRef<HTMLDivElement | null>(null);

  const toggleBrandPanel = () => {
    const next = !brandOpen;
    setBrandOpen(next);
    if (next) {
      // The theme area is a capped scroller inside the dialog; keep newly revealed fields visible.
      requestAnimationFrame(() => {
        brandPanelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }
  };

  const selected = descriptors.find((descriptor) => descriptor.id === draft.themeId) ?? null;
  const customizable = selected?.supportsCustomization ?? false;
  const logoSources = collectThemeAssetPaths(files, 'logo');
  const cssSources = collectThemeAssetPaths(files, 'css');

  const select = (descriptor: HtmlThemeDescriptor) => {
    if (disabled || descriptor.id === draft.themeId) return;
    onChange({ ...draft, themeId: descriptor.id, mode: descriptor.defaultMode });
  };

  const moveSelection = (index: number, delta: number) => {
    if (descriptors.length === 0) return;
    const next = (index + delta + descriptors.length) % descriptors.length;
    const descriptor = descriptors[next];
    if (!descriptor) return;
    onChange({ ...draft, themeId: descriptor.id, mode: descriptor.defaultMode });
    cardRefs.current[next]?.focus();
  };

  const onCardKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveSelection(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveSelection(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveSelection(index, -index);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveSelection(index, descriptors.length - 1 - index);
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const descriptor = descriptors[index];
      if (descriptor) select(descriptor);
    }
  };

  const patch = (changes: Partial<ThemeDraft>) => onChange({ ...draft, ...changes });

  if (status === 'loading' && descriptors.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-[11px] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t('publish.theme.loading')}
      </div>
    );
  }

  if (status === 'error' && descriptors.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
        <span className="min-w-0 flex-1">
          {t('publish.theme.themesLoadFailed', { message: error ?? '' })}
        </span>
        <button type="button" onClick={onRetry} className="dita-mini-btn bg-white px-2 py-1">
          {t('publish.theme.retry')}
        </button>
      </div>
    );
  }

  if (descriptors.length === 0) {
    return <p className="px-1 py-4 text-[11px] text-slate-500">{t('publish.theme.empty')}</p>;
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <div
        role="radiogroup"
        aria-label={t('publish.theme.groupAria')}
        aria-disabled={disabled}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-3"
      >
        {descriptors.map((descriptor, index) => {
          const isSelected = descriptor.id === draft.themeId;
          const isDefault = descriptor.id === defaultThemeId;
          return (
            <button
              key={descriptor.id}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t('publish.theme.cardAria', { name: descriptor.name })}
              tabIndex={isSelected ? 0 : -1}
              disabled={disabled}
              onClick={() => select(descriptor)}
              onKeyDown={onCardKeyDown(index)}
              className={`relative flex flex-col gap-1.5 rounded-lg border bg-white p-2 text-left transition ${
                isSelected
                  ? 'border-slate-300'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
              }`}
              style={
                isSelected
                  ? {
                      borderColor: draft.accentColor,
                      boxShadow: `0 0 0 1px ${draft.accentColor} inset`,
                    }
                  : undefined
              }
            >
              {isSelected ? (
                <span
                  className="absolute right-1.5 top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full text-white shadow"
                  style={{ backgroundColor: draft.accentColor }}
                  aria-hidden="true"
                >
                  <Check className="h-2.5 w-2.5" />
                </span>
              ) : null}
              <ThemeThumbnail descriptor={descriptor} />
              <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                  {descriptor.name}
                </span>
                {isDefault ? (
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                    {t('publish.theme.defaultBadge')}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[10.5px] text-slate-500" title={descriptor.description}>
                {descriptor.description}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                  {descriptor.defaultMode === 'dark'
                    ? t('publish.theme.mode.dark')
                    : t('publish.theme.mode.light')}
                </span>
                {descriptor.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
                {!descriptor.supportsCustomization ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">
                    DITA-OT
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {!customizable ? (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-slate-500">
          {t('publish.theme.vanillaHint')}
        </p>
      ) : (
        <div className="mt-2 rounded-md border border-slate-200">
          <button
            type="button"
            aria-expanded={brandOpen}
            onClick={toggleBrandPanel}
            className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Palette className="h-3 w-3 text-slate-500" aria-hidden="true" />
            {t('publish.theme.brandTitle')}
            <span className="ml-auto text-[10px] font-normal text-slate-400">
              {draft.accentColor}
            </span>
            <ChevronDown
              className={`h-3 w-3 text-slate-400 transition-transform ${brandOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {brandOpen ? (
            <div ref={brandPanelRef} className="border-t border-slate-200 p-2.5">
              <p className="mb-2 text-[10.5px] text-slate-500">{t('publish.theme.brandHint')}</p>
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {t('publish.theme.accentLabel')}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      type="color"
                      value={draft.accentColor}
                      onChange={(event) =>
                        patch({ accentColor: normalizeAccentColor(event.target.value, draft.accentColor) })
                      }
                      className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                      aria-label={t('publish.theme.accentLabel')}
                    />
                    <span className="font-mono text-[10.5px] text-slate-600">{draft.accentColor}</span>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          accentColor: normalizeAccentColor(
                            selected?.defaultAccent ?? draft.accentColor,
                            draft.accentColor,
                          ),
                        })
                      }
                      className="dita-mini-btn bg-white px-1.5 py-0.5 text-[10px]"
                      title={t('publish.theme.accentReset')}
                    >
                      <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('publish.theme.accentReset')}
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1" aria-label={t('publish.theme.accentPresets')}>
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => patch({ accentColor: preset })}
                        className={`h-4 w-4 rounded-full border ${
                          draft.accentColor === preset ? 'border-slate-700' : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: preset }}
                        aria-label={preset}
                        title={preset}
                      />
                    ))}
                  </div>
                </div>

                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {t('publish.theme.siteTitleLabel')}
                  </span>
                  <input
                    value={draft.siteTitle}
                    maxLength={120}
                    onChange={(event) => patch({ siteTitle: event.target.value })}
                    placeholder={t('publish.theme.siteTitlePlaceholder')}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>

                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {t('publish.theme.footerLabel')}
                  </span>
                  <textarea
                    value={draft.footerText}
                    maxLength={240}
                    rows={2}
                    onChange={(event) => patch({ footerText: event.target.value })}
                    placeholder={t('publish.theme.footerPlaceholder')}
                    className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>

                <div className="grid grid-cols-1 gap-2">
                  <label className="min-w-0">
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      <Image className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('publish.theme.logoLabel')}
                    </span>
                    <select
                      value={draft.logoPath}
                      onChange={(event) => patch({ logoPath: event.target.value })}
                      disabled={logoSources.length === 0}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">
                        {logoSources.length === 0
                          ? t('publish.theme.logoEmpty')
                          : t('publish.theme.logoNone')}
                      </option>
                      {logoSources.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t('publish.theme.cssLabel')}
                    </span>
                    <select
                      value={draft.customCssPath}
                      onChange={(event) => patch({ customCssPath: event.target.value })}
                      disabled={cssSources.length === 0}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">
                        {cssSources.length === 0
                          ? t('publish.theme.cssEmpty')
                          : t('publish.theme.cssNone')}
                      </option>
                      {cssSources.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {FEATURE_ROWS.map((row) => (
                  <label
                    key={row.key}
                    className="flex cursor-pointer items-start gap-1.5 rounded border border-slate-200 px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={draft.features[row.key]}
                      onChange={(event) =>
                        patch({
                          features: { ...draft.features, [row.key]: event.target.checked },
                        })
                      }
                      className="mt-0.5 h-3 w-3 rounded border-slate-300 text-blue-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-medium text-slate-700">
                        {t(row.labelKey)}
                      </span>
                      <span className="block text-[10px] text-slate-500">{t(row.hintKey)}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={onPreview}
                  className="dita-mini-btn bg-white px-2 py-1"
                >
                  <Sparkles className="h-3 w-3 text-slate-500" aria-hidden="true" />
                  {t('publish.theme.previewButton')}
                </button>
                <button
                  type="button"
                  onClick={onSaveDefault}
                  disabled={savingDefault}
                  className="dita-mini-btn bg-white px-2 py-1 disabled:opacity-50"
                >
                  {savingDefault ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                  )}
                  {savingDefault ? t('publish.theme.saving') : t('publish.theme.saveButton')}
                </button>
                {saveError ? (
                  <span className="text-[10px] text-rose-600">
                    {t('publish.theme.saveFailed', { message: saveError })}
                  </span>
                ) : savedDefault ? (
                  <span className="text-[10px] text-emerald-600">{t('publish.theme.saved')}</span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
