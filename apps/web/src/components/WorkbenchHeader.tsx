import { useEffect, useRef, useState } from 'react';
import type { XmlParseError } from '@dita/core';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Columns2,
  ExternalLink,
  Eye,
  Globe,
  Languages,
  PanelLeft,
  PanelRightOpen,
  Rocket,
} from 'lucide-react';
import type { EditorViewMode, OpenEditorTab } from '../store/editor-store';
import type { IdentityResponse, IdentityUser } from '../services/identity-api';
import type { ManualLanguageEdition } from '../workbench/manual-language-families.js';
import { useI18n } from '../i18n/index.js';
import { DesktopSettingsButton } from '../desktop/DesktopSettingsDialog.js';
import { SessionSettingsMenu } from './SessionSettingsMenu';

export interface WorkbenchHeaderProps {
  /** Brand lockup is rendered in the sidebar strip while it is open; the header takes over when collapsed. */
  showBrand: boolean;
  activeTab: OpenEditorTab | null;
  mode: EditorViewMode;
  xmlError: XmlParseError | null;
  leftSidebarOpen: boolean;
  problemsOpen: boolean;
  errorCount: number;
  warningCount: number;
  dirtyCount: number;
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onSwitchIdentity: (userId: string) => void;
  onToggleLeftSidebar: () => void;
  onChangeMode: (nextMode: EditorViewMode) => void;
  onToggleProblems: () => void;
  /** Collapsed inspector: show an explicit toolbar button so the panel is always recoverable. */
  showInspectorExpand: boolean;
  onExpandInspector: () => void;
  /** Phase 10: manual name of this session, shown as the header brand when the sidebar is collapsed. */
  manualName?: string | null;
  /** Publish the current root map (DITA-OT HTML5 / PDF). Omitted when publishing is unavailable. */
  onOpenPublish?: () => void;
  /**
   * Phase 16 — number of target languages this manual is a translation source for. The capsule is
   * always rendered when `onOpenTranslations` is provided: a manual with no target language yet
   * still needs a way into the translation center to add the first one, so a zero count only
   * changes the label (`Translations` instead of `Translations 1`) and never hides the button.
   */
  translationLinkCount?: number;
  onOpenTranslations?: () => void;
  /**
   * Phase 16 — base-first language editions of this manual. The capsule is a picker, not a link:
   * switching editions is a session switch (an edition is a manual of its own), so the caller
   * decides how to navigate (and how to protect unsaved buffers). The base/source edition is
   * always marked with the `Base` badge so the family's origin never has to be inferred.
   */
  languageEditions?: ManualLanguageEdition[];
  onSelectLanguageEdition?: (edition: ManualLanguageEdition) => void;
}

export function WorkbenchHeader({
  showBrand,
  activeTab,
  mode,
  xmlError,
  leftSidebarOpen,
  problemsOpen,
  errorCount,
  warningCount,
  dirtyCount,
  identity,
  currentUser,
  onSwitchIdentity,
  onToggleLeftSidebar,
  onChangeMode,
  onToggleProblems,
  showInspectorExpand,
  onExpandInspector,
  manualName = null,
  onOpenPublish,
  translationLinkCount = 0,
  onOpenTranslations,
  languageEditions = [],
  onSelectLanguageEdition,
}: WorkbenchHeaderProps) {
  const { t } = useI18n();
  const [languagesOpen, setLanguagesOpen] = useState(false);
  const languagesRef = useRef<HTMLDivElement | null>(null);

  // Transient-menu contract: outside pointerdown or Escape closes it.
  useEffect(() => {
    if (!languagesOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!languagesRef.current?.contains(event.target as Node)) setLanguagesOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguagesOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [languagesOpen]);

  const currentEdition =
    languageEditions.find((edition) => edition.isCurrent) ?? null;
  // Phase 16: the family can contain more links than the entry lookup returned (derived editions),
  // so the badge counts every non-base edition as well as the raw link count.
  const familyTargetCount = languageEditions.filter((edition) => !edition.isBase).length;
  const linkCount = Math.max(translationLinkCount, familyTargetCount);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex min-w-0 items-center gap-1.5">
        {/* Mirrors `showInspectorExpand` on the right: a collapse button is pointless while the
            sidebar is open (the sidebar strip carries its own toggle), so only offer expand. */}
        {!leftSidebarOpen ? (
          <button
            type="button"
            aria-pressed={false}
            onClick={onToggleLeftSidebar}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50"
            title={t('header.toggleExpandTitle')}
            aria-label={t('header.toggleExpandAria')}
          >
            <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}

        {showBrand ? (
          <div className="flex items-center gap-2 pr-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white shadow-xs">
              D
            </div>
            <div className="hidden leading-tight xl:block">
              <div className="text-xs font-bold tracking-tight text-slate-900">
                {manualName ?? 'DITAEditor'}
              </div>
              <div className="text-[10px] font-medium text-slate-400">
                {manualName ? t('header.manualSubtitle') : t('header.brandSubtitle')}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Center: Visual | Split | Source Mode Segmented Switch */}
      <div
        role="group"
        aria-label={t('header.modeGroup')}
        className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5"
      >
        {(
          [
            { id: 'visual', label: t('header.mode.visual'), icon: Eye },
            { id: 'split', label: t('header.mode.split'), icon: Columns2 },
            { id: 'source', label: t('header.mode.source'), icon: Code2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          const blocked = Boolean(xmlError && mode === 'source' && item.id !== 'source');
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              disabled={!activeTab}
              onClick={() => onChangeMode(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : blocked
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
              title={
                blocked
                  ? t('header.mode.blockedTitle')
                  : t('header.mode.switchTitle', { mode: item.label })
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Publish, Diagnostics, Drafts, Desktop settings, Settings, Inspector. Session chrome
          (identity, language, help) lives in the settings menu so the bar stays document state. */}
      <div className="flex shrink-0 items-center gap-1.5">
        {onOpenTranslations ? (
          <div ref={languagesRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={languagesOpen}
              onClick={() => setLanguagesOpen((open) => !open)}
              data-testid="header-translation-capsule"
              title={
                languageEditions.length > 1
                  ? t('translation.entry.capsuleTitle')
                  : t('translation.entry.translationsTitle')
              }
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-medium transition-colors ${
                languagesOpen
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              {currentEdition ? (
                <span className="font-mono text-[10.5px] font-semibold">{currentEdition.lang}</span>
              ) : (
                <span className="hidden sm:inline">{t('translation.entry.translations')}</span>
              )}
              {linkCount > 0 ? (
                <span
                  className={`rounded px-1 text-[10px] font-semibold tabular-nums ${
                    languagesOpen ? 'bg-white text-blue-700 ring-1 ring-blue-200' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t('translation.entry.versionCount', { count: linkCount })}
                </span>
              ) : null}
              <ChevronDown
                className={`h-3 w-3 transition-transform ${languagesOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {languagesOpen ? (
              <div
                role="menu"
                data-testid="header-language-menu"
                aria-label={t('translation.entry.languageVersions')}
                className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
              >
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {t('translation.entry.languageVersions')}
                  </span>
                  {linkCount > 0 ? (
                    <span className="text-[10px] text-slate-400">
                      {linkCount === 1
                        ? t('translation.entry.targetCountOne', { count: 1 })
                        : t('translation.entry.targetCount', { count: linkCount })}
                    </span>
                  ) : null}
                </div>

                {languageEditions.length === 0 ? (
                  <p className="px-1.5 pb-1.5 text-[11px] leading-snug text-slate-500">
                    {t('translation.entry.noEditions')}
                  </p>
                ) : null}

                {languageEditions.map((edition) => {
                  const disabled = !edition.exists || edition.isCurrent || !onSelectLanguageEdition;
                  const baseTitle = edition.isCurrent
                    ? t('translation.entry.currentEditionTitle', { lang: edition.lang })
                    : edition.exists
                      ? t('translation.entry.switchEditionTitle', { lang: edition.lang })
                      : t('translation.entry.editionMissing', { lang: edition.lang });
                  // Phase 16: derived editions (`depth >= 2`) are indented and labelled with the
                  // path that produced them, because `ar-SA` alone does not say what it translates.
                  const depth = edition.depth ?? 0;
                  const nested = depth >= 2 && (edition.lineagePath?.length ?? 0) > 0;
                  const title = nested
                    ? t('translation.entry.lineageEditionTitle', {
                        path: edition.lineagePath?.join(' → ') ?? edition.lang,
                        title: baseTitle,
                      })
                    : baseTitle;
                  return (
                    <button
                      key={`${edition.isBase ? 'base' : 'target'}-${edition.lang}-${edition.manualId}-${edition.branch}`}
                      type="button"
                      role="menuitemradio"
                      aria-checked={Boolean(edition.isCurrent)}
                      disabled={disabled}
                      title={title}
                      data-testid={`header-language-edition-${edition.lang}`}
                      data-base={edition.isBase ? 'true' : 'false'}
                      data-depth={depth}
                      onClick={() => {
                        if (disabled) return;
                        setLanguagesOpen(false);
                        onSelectLanguageEdition?.(edition);
                      }}
                      className={`flex w-full items-start gap-1.5 rounded py-1.5 pr-1.5 text-left transition-colors ${
                        nested ? 'pl-4' : 'pl-1.5'
                      } ${
                        edition.isCurrent
                          ? 'bg-blue-50'
                          : 'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                          edition.isBase
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200'
                        }`}
                      >
                        {edition.isBase ? (
                          <Globe className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Languages className="h-3 w-3" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          {nested ? (
                            <span className="text-[10px] text-slate-400" aria-hidden="true">
                              ↳
                            </span>
                          ) : null}
                          <span className="font-mono text-[11px] font-semibold text-slate-800">
                            {edition.lang}
                          </span>
                          {nested && edition.parentLang ? (
                            <span className="text-[9px] text-slate-400">
                              {t('translation.entry.parentLangHint', { lang: edition.parentLang })}
                            </span>
                          ) : null}
                          {edition.isBase ? (
                            <span
                              data-testid="header-language-base-badge"
                              className="rounded bg-slate-900 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white"
                            >
                              {t('translation.entry.baseBadge')}
                            </span>
                          ) : null}
                          {!edition.isBase && typeof edition.progressPercent === 'number' ? (
                            <span className="rounded bg-slate-100 px-1 text-[9px] font-semibold tabular-nums text-slate-500">
                              {t('translation.progressPercent', { percent: edition.progressPercent })}
                            </span>
                          ) : null}
                          {edition.isCurrent ? (
                            <Check className="ml-auto h-3 w-3 shrink-0 text-blue-600" aria-hidden="true" />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                          {edition.manualName}
                        </span>
                      </span>
                    </button>
                  );
                })}

                <div className="my-1 h-px bg-slate-100" aria-hidden="true" />
                <button
                  type="button"
                  role="menuitem"
                  data-testid="header-translation-center-action"
                  onClick={() => {
                    setLanguagesOpen(false);
                    onOpenTranslations();
                  }}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-800"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {linkCount > 0
                    ? t('translation.entry.openCenter')
                    : t('translation.entry.addTargetLanguage')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {onOpenPublish ? (
          <button
            type="button"
            onClick={onOpenPublish}
            className="inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs transition-colors hover:border-blue-700 hover:bg-blue-700"
            title={t('mapTree.publishTooltip')}
            aria-label={t('mapTree.publish')}
          >
            <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('mapTree.publish')}</span>
          </button>
        ) : null}

        {/* Diagnostics toggle pill */}
        <button
          type="button"
          aria-pressed={problemsOpen}
          onClick={onToggleProblems}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            errorCount > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : warningCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : problemsOpen
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title={t('header.problems.toggleTitle')}
        >
          {errorCount > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          )}
          <span className="hidden md:inline">
            {errorCount > 0 || warningCount > 0
              ? t('header.problems.summary', { errors: errorCount, warnings: warningCount })
              : t('header.problems.zero')}
          </span>
        </button>

        {xmlError ? (
          <span
            className="hidden items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 2xl:inline-flex"
            title={xmlError.message}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            L{xmlError.line}:{xmlError.column}
          </span>
        ) : null}

        {dirtyCount > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
            title={t('header.dirtyTitle')}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            <span>{t('header.dirtyCount', { count: dirtyCount })}</span>
          </span>
        ) : null}

        <DesktopSettingsButton />

        {/* Session chrome (identity, language, help) lives behind this gear: each was a permanent
            control on the bar competing with document state for the tightest pixels. */}
        <SessionSettingsMenu
          identity={identity}
          currentUser={currentUser}
          onChangeIdentity={onSwitchIdentity}
          testId="header-settings-button"
        />

        {showInspectorExpand ? (
          <button
            type="button"
            onClick={onExpandInspector}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            title={t('header.inspector.expandTitle')}
            aria-label={t('header.inspector.expandAria')}
          >
            <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">{t('header.inspector.expand')}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
