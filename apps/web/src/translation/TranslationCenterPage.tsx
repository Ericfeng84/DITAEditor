import {
  ArrowLeft,
  BookMarked,
  FileText,
  Languages,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DesktopSettingsButton } from '../desktop/DesktopSettingsDialog.js';
import { SessionSettingsMenu } from '../components/SessionSettingsMenu';
import { useI18n, type MessageKey } from '../i18n/index.js';
import {
  bilingualReviewPath,
  editorPath,
  navigate,
  translationCenterPath,
  type TranslationCenterTab,
} from '../router/app-router.js';
import { useGitStore } from '../store/git-store';
import { useTranslationStore } from '../store/translation-store.js';
import { AddTargetLanguageDialog } from './AddTargetLanguageDialog.js';
import { GlossaryWorkspacePanel } from './GlossaryWorkspacePanel.js';
import { TranslationFilesTab } from './TranslationFilesTab.js';
import { TranslationLineageSidebar } from './TranslationLineageSidebar.js';
import { TranslationQueueTab } from './TranslationQueueTab.js';
import { TranslationSettingsTab } from './TranslationSettingsTab.js';
import { buildTranslationLineage, pickDefaultActiveLink } from './translation-lineage.js';

const OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';

const TABS: ReadonlyArray<{ id: TranslationCenterTab; labelKey: MessageKey; icon: typeof FileText }> = [
  { id: 'files', labelKey: 'translation.tab.files', icon: FileText },
  { id: 'queue', labelKey: 'translation.tab.queue', icon: ListChecks },
  { id: 'glossary', labelKey: 'translation.tab.glossary', icon: BookMarked },
  { id: 'settings', labelKey: 'translation.tab.settings', icon: Settings2 },
];

export interface TranslationCenterPageProps {
  manualId: string;
  /** Manual name resolved by the shell (falls back to the link's manual summary). */
  manualName?: string | null;
  manualSourceLang?: string | null;
  branch: string | null;
  linkId: string | null;
  tab: TranslationCenterTab | null;
}

/**
 * Phase 16 Stage 4 — the translation center.
 *
 * One URL (`/manuals/:id/translation?branch&link&tab`) drives the whole screen: the active
 * language pair lives in `?link=` and the visible panel in `?tab=`, so a reviewer can deep-link
 * straight into the queue or the manual glossary and the browser back button keeps working.
 *
 * Phase 16 lineage pass: the old horizontal language bar became a master-detail layout. The left
 * column is the whole multi-level family tree (`zh-CN → en-US → ar-SA`), the right column is the
 * detail of the selected node, and a one-line breadcrumb keeps the depth visible after the tree is
 * collapsed. Upstream staleness is surfaced as a non-blocking banner instead of a blocking modal,
 * because a translator may legitimately want to work on a branch whose parent is mid-sync.
 */
export function TranslationCenterPage({
  manualId,
  manualName,
  manualSourceLang,
  branch,
  linkId,
  tab,
}: TranslationCenterPageProps) {
  const { t } = useI18n();
  const links = useTranslationStore((state) => state.links);
  const linksLoading = useTranslationStore((state) => state.linksLoading);
  const linksError = useTranslationStore((state) => state.linksError);
  const loadLinks = useTranslationStore((state) => state.loadLinks);
  const jobs = useTranslationStore((state) => state.jobs);
  const identity = useGitStore((state) => state.identity);
  const currentUser = useGitStore((state) => state.currentUser);
  const initializeIdentity = useGitStore((state) => state.initialize);
  const switchUser = useGitStore((state) => state.switchUser);

  const [addOpen, setAddOpen] = useState(false);
  /** Node that opened the derive dialog; the global "+" leaves it `null` (family root). */
  const [addSourceManualId, setAddSourceManualId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (OFFLINE) return;
    void initializeIdentity();
  }, [initializeIdentity]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    void loadLinks({ manualId }).finally(() => {
      if (!cancelled) setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [manualId, loadLinks]);

  const lineage = useMemo(
    () =>
      buildTranslationLineage({
        links,
        entryManualId: manualId,
        entryManualName: manualName ?? null,
        entrySourceLang: manualSourceLang ?? null,
        entryBranch: branch,
      }),
    [links, manualId, manualName, manualSourceLang, branch],
  );

  const activeLink = useMemo(
    () => pickDefaultActiveLink(links, lineage, manualId, linkId),
    [links, lineage, manualId, linkId],
  );
  const activeMeta = activeLink ? (lineage.linkMetaById.get(activeLink.id) ?? null) : null;

  const activeTab: TranslationCenterTab = tab ?? 'files';
  const sourceLang = activeLink?.sourceLang ?? manualSourceLang ?? null;
  const resolvedManualName = manualName ?? activeLink?.sourceManual?.name ?? manualId;
  const lineagePath =
    activeMeta?.pathLangs ??
    (activeLink ? [activeLink.sourceLang, activeLink.targetLang] : sourceLang ? [sourceLang] : []);
  const upstreamPending = activeMeta?.upstreamPending ?? [];
  const upstreamPendingFiles = upstreamPending.reduce(
    (sum, ancestor) => sum + Math.max(0, ancestor.counts.total - ancestor.counts.synced),
    0,
  );
  const jobActive = useMemo(
    () =>
      jobs.some(
        (job) =>
          job.linkId === activeLink?.id && (job.status === 'queued' || job.status === 'running'),
      ),
    [jobs, activeLink?.id],
  );

  const openTab = (next: TranslationCenterTab) => {
    navigate(
      translationCenterPath(manualId, { branch, linkId: activeLink?.id ?? null, tab: next }),
    );
  };

  const selectLink = (id: string) => {
    navigate(translationCenterPath(manualId, { branch, linkId: id, tab: activeTab }));
  };

  /** Opens the target-language edition itself, without touching the selected pair. */
  const openTargetInEditor = (link: (typeof links)[number]) => {
    navigate(editorPath(link.targetManualId, { branch: link.targetBranch }));
  };

  const refresh = () => {
    setRefreshing(true);
    void loadLinks({ manualId }).finally(() => setRefreshing(false));
  };

  const openAddDialog = (sourceManualId?: string | null) => {
    setAddSourceManualId(sourceManualId ?? null);
    setAddOpen(true);
  };

  const renderTab = () => {
    if (!activeLink) return null;
    if (activeTab === 'files') {
      return (
        <TranslationFilesTab
          link={activeLink}
          onOpenReview={(itemId) =>
            navigate(bilingualReviewPath(manualId, itemId, { branch: activeLink.targetBranch }))
          }
          onOpenQueue={() => openTab('queue')}
          onOpenTargetEditor={() => openTargetInEditor(activeLink)}
        />
      );
    }
    if (activeTab === 'queue') {
      return (
        <TranslationQueueTab
          link={activeLink}
          identity={identity}
          onOpenReview={(itemId) =>
            navigate(bilingualReviewPath(manualId, itemId, { branch: activeLink.targetBranch }))
          }
        />
      );
    }
    if (activeTab === 'glossary') {
      // Q7: the manual glossary belongs to the *source* manual of the selected pair, not to the
      // manual the center was opened from — otherwise a depth-2 pair would edit the wrong glossary.
      return (
        <GlossaryWorkspacePanel
          key={activeLink.sourceManualId}
          scope="manual"
          manualId={activeLink.sourceManualId}
          defaultSourceLang={activeLink.sourceLang}
          defaultTargetLang={activeLink.targetLang}
        />
      );
    }
    return (
      <TranslationSettingsTab
        link={activeLink}
        manualId={manualId}
        descendantLangs={activeMeta?.descendantLangs ?? []}
        onUnlinked={() => void loadLinks({ manualId })}
      />
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(editorPath(manualId, { branch }))}
            data-testid="translation-back-to-editor"
            title={t('translation.backToEditor')}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            {t('translation.backToEditor')}
          </button>
          <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs"
            aria-hidden="true"
          >
            <Languages className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="flex items-baseline gap-1.5">
              <h1 className="truncate text-xs font-bold tracking-tight text-slate-900">
                {t('translation.title')}
              </h1>
              <span className="truncate text-[11px] font-medium text-slate-400">
                {resolvedManualName}
              </span>
            </div>
            <p className="truncate text-[10px] font-medium text-slate-400">
              {sourceLang
                ? t('translation.sourceLang', { lang: sourceLang })
                : t('translation.sourceLangUnknown')}
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label={t('translation.shell.segmentedAria')}
          className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                data-testid={`translation-tab-${item.id}`}
                onClick={() => openTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
                  active ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {t(item.labelKey)}
                {item.id === 'queue' && jobActive ? (
                  <span
                    className="relative ml-0.5 flex h-1.5 w-1.5"
                    data-testid="translation-tab-live-dot"
                    aria-hidden="true"
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={refresh}
            aria-label={t('translation.refresh')}
            title={t('translation.refresh')}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
          <DesktopSettingsButton />
          <SessionSettingsMenu
            identity={identity}
            currentUser={currentUser}
            onChangeIdentity={(userId) => void switchUser(userId)}
            testId="translation-settings-menu-button"
            menuTestId="translation-settings-menu"
            menuAriaLabel={t('translation.shell.settingsAria')}
          />
        </div>
      </header>

      {linksError ? (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-1.5 text-[11.5px] text-rose-700">
          {t('translation.error', { message: linksError })}
        </div>
      ) : null}

      {links.length > 0 ? (
        <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <TranslationLineageSidebar
            lineage={lineage}
            entryManualId={manualId}
            entryManualName={manualName ?? null}
            activeLinkId={activeLink?.id ?? null}
            onSelectLink={selectLink}
            onOpenEditor={openTargetInEditor}
            onDerive={(sourceManualId) => openAddDialog(sourceManualId)}
            onAddTarget={() => openAddDialog(null)}
            onOpenRoot={() => {
              const root = lineage.roots[0];
              navigate(editorPath(root?.manualId ?? manualId, { branch: root?.branch ?? branch }));
            }}
          />

          <main className="min-w-0 flex-1 px-4 py-3">
            <div className="mx-auto w-full max-w-6xl">
              {activeLink ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
                  <div
                    data-testid="translation-lineage-breadcrumb"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px]"
                  >
                    <span className="truncate font-mono font-semibold text-slate-700">
                      {lineagePath.join(' → ')}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="truncate text-slate-500">
                      {t('translation.settings.targetManual', {
                        name: activeLink.targetManual?.name ?? activeLink.targetManualId,
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openTargetInEditor(activeLink)}
                    disabled={activeLink.targetManual?.exists === false}
                    data-testid="translation-lineage-breadcrumb-open"
                    title={t('translation.openTargetInEditorTitle', { lang: activeLink.targetLang })}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Pencil className="h-3 w-3" aria-hidden="true" />
                    {t('translation.openTargetInEditor')}
                  </button>
                </div>
              ) : null}

              {upstreamPending.length > 0 ? (
                <div
                  role="status"
                  data-testid="translation-upstream-banner"
                  className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800"
                >
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {t('translation.lineage.upstreamBanner', {
                      lang: upstreamPending[0]?.targetLang ?? '',
                      count: upstreamPendingFiles,
                    })}
                  </span>
                  {upstreamPending.map((ancestor) => (
                    <button
                      key={ancestor.id}
                      type="button"
                      onClick={() => selectLink(ancestor.id)}
                      data-testid={`translation-upstream-jump-${ancestor.id}`}
                      title={t('translation.lineage.pendingJumpLabel')}
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 transition-colors hover:bg-amber-100"
                    >
                      {t('translation.lineage.upstreamJump', { lang: ancestor.targetLang })}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="pt-3">
                {linksLoading && links.length === 0 ? (
                  <div className="flex items-center gap-2 py-10 text-[12px] text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {t('translation.loading')}
                  </div>
                ) : (
                  renderTab()
                )}
              </div>
            </div>
          </main>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-3">
          {linksLoading ? (
            <div className="flex items-center gap-2 py-10 text-[12px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('translation.loading')}
            </div>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
              <Languages className="mx-auto h-6 w-6 text-slate-300" aria-hidden="true" />
              <h2 className="mt-2 text-[13px] font-semibold text-slate-900">
                {t('translation.noLinksTitle')}
              </h2>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] text-slate-500">
                {t('translation.noLinksBody')}
              </p>
              <button
                type="button"
                onClick={() => openAddDialog(null)}
                className="mt-3 inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                {t('translation.addTargetLanguage')}
              </button>
            </section>
          )}
        </main>
      )}

      <AddTargetLanguageDialog
        open={addOpen}
        manualId={manualId}
        sourceLang={sourceLang}
        sourceCandidates={lineage.sourceCandidates}
        defaultSourceManualId={addSourceManualId ?? lineage.roots[0]?.manualId ?? manualId}
        familyTakenLangs={[...lineage.familyLangs]}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false);
          navigate(translationCenterPath(manualId, { branch, linkId: created.id, tab: activeTab }));
        }}
      />
    </div>
  );
}
