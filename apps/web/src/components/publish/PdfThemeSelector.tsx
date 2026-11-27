import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Check,
  FileText,
  Image,
  LayoutTemplate,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import type { MessageKey } from '../../i18n/messages/index.js';
import type { PublishLoadStatus } from '../../store/publish-store';
import type {
  PdfFontFamily,
  PdfFontSize,
  PdfMargins,
  PdfPageSize,
  PdfThemeDescriptor,
  PdfThemeFeatures,
  PdfThemeId,
} from '../../services/publish-api';
import type { WorkspaceFileNode } from '../../services/workspace-api';
import {
  PDF_FONT_FAMILIES,
  PDF_FONT_SIZES,
  PDF_MARGINS,
  PDF_PAGE_SIZES,
  PDF_THEME_TEXT_LIMITS,
  collectPdfLogoPaths,
  normalizePdfAccentColor,
  pdfThumbnailStyle,
} from './pdf-theme-model.js';
import type { PdfThemeDraft } from './pdf-theme-model.js';

const ACCENT_PRESETS = ['#1d4ed8', '#0f766e', '#7c2d12', '#334155', '#6d28d9', '#b91c1c'] as const;

const PAGE_SIZE_KEYS: Readonly<Record<PdfPageSize, MessageKey>> = {
  A4: 'publish.pdf.pageSize.A4',
  Letter: 'publish.pdf.pageSize.Letter',
  B5: 'publish.pdf.pageSize.B5',
};

const FONT_FAMILY_KEYS: Readonly<Record<PdfFontFamily, MessageKey>> = {
  sans: 'publish.pdf.fontFamily.sans',
  serif: 'publish.pdf.fontFamily.serif',
};

const MARGIN_KEYS: Readonly<Record<PdfMargins, MessageKey>> = {
  compact: 'publish.pdf.margins.compact',
  normal: 'publish.pdf.margins.normal',
  wide: 'publish.pdf.margins.wide',
};

const FEATURE_ROWS: ReadonlyArray<{
  key: keyof PdfThemeFeatures;
  labelKey: MessageKey;
  hintKey: MessageKey;
}> = [
  {
    key: 'showCover',
    labelKey: 'publish.pdf.feature.showCover',
    hintKey: 'publish.pdf.feature.showCoverHint',
  },
  {
    key: 'showToc',
    labelKey: 'publish.pdf.feature.showToc',
    hintKey: 'publish.pdf.feature.showTocHint',
  },
  {
    key: 'chapterNumbers',
    labelKey: 'publish.pdf.feature.chapterNumbers',
    hintKey: 'publish.pdf.feature.chapterNumbersHint',
  },
  {
    key: 'taskLabels',
    labelKey: 'publish.pdf.feature.taskLabels',
    hintKey: 'publish.pdf.feature.taskLabelsHint',
  },
  {
    key: 'mirrorMargins',
    labelKey: 'publish.pdf.feature.mirrorMargins',
    hintKey: 'publish.pdf.feature.mirrorMarginsHint',
  },
];

type SelectorTab = 'templates' | 'customize';

const TAB_ORDER: readonly SelectorTab[] = ['templates', 'customize'];

const TAB_BASE = 'border-b-2 px-2.5 py-1.5 text-[11px] font-semibold transition';
const TAB_ACTIVE = 'border-blue-600 text-blue-700';
const TAB_IDLE = 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900';
const TAB_DISABLED = 'cursor-not-allowed border-transparent text-slate-400 opacity-60';

/** Minified portrait paper sheet: the cover style decides where the accent lives. */
function PdfThumbnail({ descriptor }: { descriptor: PdfThemeDescriptor }) {
  const style = pdfThumbnailStyle(descriptor);
  const palette = descriptor.previewPalette;
  return (
    <div
      className="flex h-[78px] w-full items-stretch justify-center overflow-hidden rounded-md border bg-slate-50 px-2 py-1.5"
      style={style.page}
      aria-hidden="true"
    >
      <div
        className="relative flex h-full w-[46px] flex-col overflow-hidden rounded-[2px] border shadow-sm"
        style={{ ...style.page, borderColor: palette.border }}
      >
        {style.coverStyle === 'navy-band' ? (
          <div className="flex h-[18px] flex-col justify-center gap-0.5 px-1" style={style.band}>
            <span className="h-1 w-4/5 rounded-sm" style={{ backgroundColor: palette.page }} />
            <span
              className="h-0.5 w-3/5 rounded-sm"
              style={{ backgroundColor: palette.page, opacity: 0.7 }}
            />
          </div>
        ) : null}
        {style.coverStyle === 'left-accent' ? (
          <span className="absolute inset-y-0 left-0 w-[3px]" style={style.accentBar} />
        ) : null}
        {style.coverStyle === 'compact-header' ? (
          <div
            className="flex h-[6px] items-center gap-0.5 px-1"
            style={{ ...style.band, backgroundColor: palette.page }}
          >
            <span className="h-[3px] w-[3px] rounded-sm" style={style.accentBar} />
            <span className="h-0.5 flex-1 rounded-sm" style={style.muted} />
          </div>
        ) : null}
        <div
          className={`flex flex-1 flex-col gap-1 px-1 py-1 ${
            style.coverStyle === 'editorial-center' ? 'items-center pt-2' : ''
          } ${style.coverStyle === 'left-accent' ? 'pl-1.5' : ''}`}
        >
          {style.coverStyle === 'editorial-center' ? (
            <span className="mb-0.5 h-[2px] w-4" style={style.accentBar} />
          ) : null}
          <span
            className={`h-[3px] rounded-sm ${
              style.coverStyle === 'editorial-center' ? 'w-3/4' : 'w-5/6'
            }`}
            style={style.title}
          />
          <span className="h-0.5 w-1/2 rounded-sm" style={style.muted} />
          {style.coverStyle !== 'vanilla' ? (
            <span className="mt-0.5 h-[1px] w-full rounded-sm" style={style.line} />
          ) : null}
          <span className="mt-0.5 h-0.5 w-full rounded-sm" style={style.line} />
          <span className="h-0.5 w-11/12 rounded-sm" style={style.line} />
          <span className="h-0.5 w-full rounded-sm" style={style.line} />
          <span className="mt-auto h-[5px] w-full rounded-sm" style={style.code} />
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  labelOf,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labelOf: (option: T) => string;
  disabled: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50/60 p-0.5"
      >
        {options.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`flex-1 whitespace-nowrap rounded px-1.5 py-1 text-[10.5px] transition disabled:opacity-50 ${
                active
                  ? 'bg-white font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {labelOf(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface PdfThemeSelectorProps {
  descriptors: PdfThemeDescriptor[];
  status: PublishLoadStatus;
  error: string | null;
  draft: PdfThemeDraft;
  /** Theme id saved as the manual default, used for the badge. */
  defaultThemeId: PdfThemeId | null;
  files: WorkspaceFileNode[];
  disabled?: boolean;
  /** Field-level patches (accent, paper, text, logo, features). */
  onChange: (next: PdfThemeDraft) => void;
  /** Card selection goes through `applyPdfThemeSelection` in the dialog. */
  onSelectTheme: (descriptor: PdfThemeDescriptor) => void;
  onRetry: () => void;
  onPreview: () => void;
  onSaveDefault: () => void;
  savingDefault: boolean;
  savedDefault: boolean;
  saveError: string | null;
}

export function PdfThemeSelector({
  descriptors,
  status,
  error,
  draft,
  defaultThemeId,
  files,
  disabled = false,
  onChange,
  onSelectTheme,
  onRetry,
  onPreview,
  onSaveDefault,
  savingDefault,
  savedDefault,
  saveError,
}: PdfThemeSelectorProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<SelectorTab>('templates');
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selected = descriptors.find((descriptor) => descriptor.id === draft.themeId) ?? null;
  const customizable = selected?.supportsCustomization ?? false;
  // `vanilla` (or any other non-customizable theme) has no layout panel, so the tab list falls
  // back to the templates tab instead of parking the user on a disabled tab.
  const currentTab: SelectorTab = !customizable && activeTab === 'customize' ? 'templates' : activeTab;
  const logoPaths = collectPdfLogoPaths(files);

  const select = (descriptor: PdfThemeDescriptor) => {
    if (disabled || descriptor.id === draft.themeId) return;
    if (!descriptor.supportsCustomization) setActiveTab('templates');
    onSelectTheme(descriptor);
  };

  const moveSelection = (index: number, delta: number) => {
    if (descriptors.length === 0) return;
    const next = (index + delta + descriptors.length) % descriptors.length;
    const descriptor = descriptors[next];
    if (!descriptor) return;
    if (!descriptor.supportsCustomization) setActiveTab('templates');
    onSelectTheme(descriptor);
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

  const moveTab = (index: number, delta: number) => {
    const next = (index + delta + TAB_ORDER.length) % TAB_ORDER.length;
    const tab = TAB_ORDER[next];
    if (!tab) return;
    if (tab === 'customize' && !customizable) return;
    setActiveTab(tab);
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown =
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        moveTab(index, 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveTab(index, -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveTab('templates');
        tabRefs.current[0]?.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        if (customizable) {
          setActiveTab('customize');
          tabRefs.current[1]?.focus();
        }
      }
    };

  const patch = (changes: Partial<PdfThemeDraft>) => onChange({ ...draft, ...changes });

  if (status === 'loading' && descriptors.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-6 text-[11px] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t('publish.pdf.loading')}
      </div>
    );
  }

  if (status === 'error' && descriptors.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
        <span className="min-w-0 flex-1">
          {t('publish.pdf.themesLoadFailed', { message: error ?? '' })}
        </span>
        <button type="button" onClick={onRetry} className="dita-mini-btn bg-white px-2 py-1">
          {t('publish.pdf.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <div
        role="tablist"
        aria-label={t('publish.pdf.tabsAria')}
        className="sticky top-0 z-10 mb-2 flex items-center gap-1 border-b border-slate-200 bg-white pt-0.5"
      >
        <button
          ref={(node) => {
            tabRefs.current[0] = node;
          }}
          type="button"
          role="tab"
          id="pdf-theme-tab-templates"
          aria-selected={currentTab === 'templates'}
          aria-controls="pdf-theme-panel-templates"
          tabIndex={currentTab === 'templates' ? 0 : -1}
          onClick={() => setActiveTab('templates')}
          onKeyDown={onTabKeyDown(0)}
          className={`${TAB_BASE} ${
            currentTab === 'templates' ? TAB_ACTIVE : TAB_IDLE
          } inline-flex items-center gap-1`}
        >
          <FileText className="h-3 w-3" aria-hidden="true" />
          {t('publish.pdf.tabTemplates')}
          {selected ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
              {selected.name}
            </span>
          ) : null}
        </button>
        <button
          ref={(node) => {
            tabRefs.current[1] = node;
          }}
          type="button"
          role="tab"
          id="pdf-theme-tab-customize"
          aria-selected={currentTab === 'customize'}
          aria-controls="pdf-theme-panel-customize"
          aria-disabled={!customizable}
          disabled={!customizable}
          title={!customizable ? t('publish.pdf.vanillaHint') : undefined}
          tabIndex={currentTab === 'customize' ? 0 : -1}
          onClick={() => setActiveTab('customize')}
          onKeyDown={onTabKeyDown(1)}
          className={`${TAB_BASE} ${
            !customizable ? TAB_DISABLED : currentTab === 'customize' ? TAB_ACTIVE : TAB_IDLE
          } inline-flex items-center gap-1`}
        >
          <LayoutTemplate className="h-3 w-3" aria-hidden="true" />
          {t('publish.pdf.customizeTitle')}
          {customizable ? (
            <>
              <span
                className="h-2 w-2 rounded-full border border-slate-200"
                style={{ backgroundColor: draft.accentColor }}
                aria-hidden="true"
              />
              <span className="text-[10px] font-normal text-slate-400">
                {t(PAGE_SIZE_KEYS[draft.pageSize])} · {t(FONT_FAMILY_KEYS[draft.fontFamily])} ·{' '}
                {draft.fontSize}
              </span>
            </>
          ) : null}
        </button>
      </div>

      {currentTab === 'templates' ? (
        <div id="pdf-theme-panel-templates" role="tabpanel" aria-labelledby="pdf-theme-tab-templates">
          <div
            role="radiogroup"
            aria-label={t('publish.pdf.groupAria')}
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
                  aria-label={t('publish.pdf.cardAria', { name: descriptor.name })}
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
                  <PdfThumbnail descriptor={descriptor} />
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                      {descriptor.name}
                    </span>
                    {isDefault ? (
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                        {t('publish.pdf.defaultBadge')}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[10.5px] text-slate-500" title={descriptor.description}>
                    {descriptor.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                      {t(PAGE_SIZE_KEYS[descriptor.defaultPageSize])}
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
              {t('publish.pdf.vanillaHint')}
            </p>
          ) : null}
        </div>
      ) : (
        <div
          id="pdf-theme-panel-customize"
          role="tabpanel"
          aria-labelledby="pdf-theme-tab-customize"
          className="rounded-md border border-slate-200 bg-white p-2.5"
        >
          <p className="mb-2 text-[10.5px] text-slate-500">{t('publish.pdf.customizeHint')}</p>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('publish.pdf.accentLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="color"
                  value={draft.accentColor}
                  onChange={(event) =>
                    patch({
                      accentColor: normalizePdfAccentColor(event.target.value, draft.accentColor),
                    })
                  }
                  className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                  aria-label={t('publish.pdf.accentLabel')}
                />
                <input
                  value={draft.accentColor}
                  maxLength={7}
                  onChange={(event) =>
                    patch({
                      accentColor: normalizePdfAccentColor(event.target.value, draft.accentColor),
                    })
                  }
                  aria-label={t('publish.pdf.accentLabel')}
                  className="w-[74px] rounded-md border border-slate-300 bg-white px-1.5 py-1 font-mono text-[10.5px] uppercase text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      accentColor: normalizePdfAccentColor(
                        selected?.defaultAccent ?? draft.accentColor,
                        draft.accentColor,
                      ),
                    })
                  }
                  className="dita-mini-btn bg-white px-1.5 py-0.5 text-[10px]"
                  title={t('publish.pdf.accentReset')}
                >
                  <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
                  {t('publish.pdf.accentReset')}
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-1">
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

            <Segmented
              label={t('publish.pdf.pageSizeLabel')}
              value={draft.pageSize}
              options={PDF_PAGE_SIZES}
              labelOf={(option) => t(PAGE_SIZE_KEYS[option])}
              disabled={disabled}
              onChange={(pageSize) => patch({ pageSize })}
            />

            <Segmented
              label={t('publish.pdf.fontFamilyLabel')}
              value={draft.fontFamily}
              options={PDF_FONT_FAMILIES}
              labelOf={(option) => t(FONT_FAMILY_KEYS[option])}
              disabled={disabled}
              onChange={(fontFamily) => patch({ fontFamily })}
            />

            <Segmented
              label={t('publish.pdf.fontSizeLabel')}
              value={draft.fontSize}
              options={PDF_FONT_SIZES}
              labelOf={(option) => option}
              disabled={disabled}
              onChange={(fontSize) => patch({ fontSize })}
            />

            <Segmented
              label={t('publish.pdf.marginsLabel')}
              value={draft.margins}
              options={PDF_MARGINS}
              labelOf={(option) => t(MARGIN_KEYS[option])}
              disabled={disabled}
              onChange={(margins) => patch({ margins })}
            />

            <label className="min-w-0">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Image className="h-2.5 w-2.5" aria-hidden="true" />
                {t('publish.pdf.logoLabel')}
              </span>
              <select
                value={draft.logoPath}
                onChange={(event) => patch({ logoPath: event.target.value })}
                disabled={logoPaths.length === 0}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">
                  {logoPaths.length === 0 ? t('publish.pdf.logoEmpty') : t('publish.pdf.logoNone')}
                </option>
                {logoPaths.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[9.5px] text-slate-400">
                {t('publish.pdf.logoHint')}
              </span>
            </label>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2 md:grid-cols-3">
            <label className="min-w-0">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-2.5 w-2.5" aria-hidden="true" />
                {t('publish.pdf.coverSubtitleLabel')}
              </span>
              <input
                value={draft.coverSubtitle}
                maxLength={PDF_THEME_TEXT_LIMITS.coverSubtitle}
                onChange={(event) => patch({ coverSubtitle: event.target.value })}
                placeholder={t('publish.pdf.coverSubtitlePlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('publish.pdf.headerLabel')}
              </span>
              <input
                value={draft.headerText}
                maxLength={PDF_THEME_TEXT_LIMITS.headerText}
                onChange={(event) => patch({ headerText: event.target.value })}
                placeholder={t('publish.pdf.headerPlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {t('publish.pdf.footerLabel')}
              </span>
              <input
                value={draft.footerText}
                maxLength={PDF_THEME_TEXT_LIMITS.footerText}
                onChange={(event) => patch({ footerText: event.target.value })}
                placeholder={t('publish.pdf.footerPlaceholder')}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
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
            <button type="button" onClick={onPreview} className="dita-mini-btn bg-white px-2 py-1">
              <Sparkles className="h-3 w-3 text-slate-500" aria-hidden="true" />
              {t('publish.pdf.previewButton')}
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
              {savingDefault ? t('publish.pdf.saving') : t('publish.pdf.saveButton')}
            </button>
            {saveError ? (
              <span className="text-[10px] text-rose-600">
                {t('publish.pdf.saveFailed', { message: saveError })}
              </span>
            ) : savedDefault ? (
              <span className="text-[10px] text-emerald-600">{t('publish.pdf.saved')}</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
