import { ArrowLeft, BookMarked } from 'lucide-react';
import { useEffect } from 'react';
import { useI18n } from '../i18n/index.js';
import { useGitStore } from '../store/git-store.js';
import { useTranslationStore } from '../store/translation-store.js';
import { navigate, hubPath } from '../router/app-router.js';
import { IdentitySwitcher } from '../components/IdentitySwitcher';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { GlossaryWorkspacePanel } from './GlossaryWorkspacePanel.js';

export interface GlossaryManagerPageProps {
  glossaryId: string | null;
}

export function GlossaryManagerPage({ glossaryId }: GlossaryManagerPageProps) {
  const { t } = useI18n();
  const identity = useGitStore((state) => state.identity);
  const currentUser = useGitStore((state) => state.currentUser);
  const initialize = useGitStore((state) => state.initialize);
  const switchUser = useGitStore((state) => state.switchUser);
  const glossaries = useTranslationStore((state) => state.glossaries);
  const activeGlossaryId = useTranslationStore((state) => state.activeGlossaryId);
  const selectGlossary = useTranslationStore((state) => state.selectGlossary);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  /** Deep link `/glossaries?glossary=<id>` selects that catalogue once the list arrives. */
  useEffect(() => {
    if (!glossaryId) return;
    if (activeGlossaryId === glossaryId) return;
    if (!glossaries.some((glossary) => glossary.id === glossaryId)) return;
    void selectGlossary(glossaryId);
  }, [glossaryId, glossaries, activeGlossaryId, selectGlossary]);

  return (
    <div className="min-h-screen bg-slate-50" data-testid="glossary-manager-page">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(hubPath())}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              {t('translation.backToHub')}
            </button>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <BookMarked className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <h1 className="truncate text-[13px] font-semibold text-slate-900">
                  {t('translation.glossary.managerTitle')}
                </h1>
              </div>
              <p className="mt-0.5 text-[10.5px] text-slate-400">
                {t('translation.glossary.managerSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IdentitySwitcher
              identity={identity}
              currentUser={currentUser}
              onChange={(userId) => void switchUser(userId)}
            />
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-4">
        <GlossaryWorkspacePanel scope="global" />
      </main>
    </div>
  );
}
