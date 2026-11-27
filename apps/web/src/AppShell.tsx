import { useEffect, useState } from 'react';
import { App } from './App';
import { t } from './i18n/index.js';
import { hubPath, navigate, useAppRoute } from './router/app-router.js';
import { clearActiveScope, setActiveScope } from './services/active-scope';
import { fetchManual, type Manual } from './services/manuals-api.js';
import { useAssignmentStore } from './store/assignment-store';
import { useWorkbenchStore } from './store/workbench-store';
import { WorkbenchHubPage } from './workbench/WorkbenchHubPage';

const OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';

type EditorState =
  | { status: 'loading' }
  | { status: 'ready'; manual: Manual }
  | { status: 'error'; message: string };

/**
 * Phase 10 shell: picks the screen from the URL and owns the *scope* transition.
 *
 * The scope headers (`x-dita-manual-id` / `x-dita-branch`) must be in place before the
 * editor mounts, because every request the editor makes on boot — workspace snapshot, git
 * status, locks — has to land on the manual's branch worktree. The editor is therefore only
 * rendered once its manual resolved, and each manual gets a fresh `key` so two sessions can
 * never share state.
 */
export function AppShell() {
  const route = useAppRoute();
  const manualId = route.name === 'editor' ? route.manualId : null;
  const branchParam = route.name === 'editor' ? route.branch : null;
  const topicPath = route.name === 'editor' ? route.topicPath : null;
  const assignmentId = route.name === 'editor' ? route.assignmentId : null;

  const [editor, setEditor] = useState<EditorState>({ status: 'loading' });

  useEffect(() => {
    if (!manualId) return;
    if (OFFLINE) {
      // Static demo: no API at all, the editor falls back to its in-memory workspace.
      setEditor({
        status: 'ready',
        manual: {
          id: manualId,
          name: t('workbench.offlineDemoName'),
          description: t('workbench.offlineDemoDescription'),
          rootDir: '(offline)',
          defaultRootMap: null,
          isBuiltin: true,
          archived: false,
          exists: true,
          currentBranch: 'main',
          stats: { totalTopics: 0, totalMaps: 0 },
          activeAssignmentCount: 0,
          myActiveAssignmentCount: 0,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastOpenedAt: null,
        },
      });
      return;
    }
    let cancelled = false;
    setEditor({ status: 'loading' });
    fetchManual(manualId)
      .then(({ manual }) => {
        if (!cancelled) setEditor({ status: 'ready', manual });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEditor({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [manualId]);

  if (!manualId) {
    // Hub requests must stay unscoped so the list is cross-manual.
    if (OFFLINE) return <WorkbenchHubPage />;
    clearActiveScope();
    return <WorkbenchHubPage />;
  }

  if (editor.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-rose-200 bg-white p-5 text-center">
          <h1 className="text-sm font-semibold text-slate-900">{t('workbench.error', { message: editor.message })}</h1>
          <button
            type="button"
            onClick={() => navigate(hubPath())}
            className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-slate-800"
          >
            {t('workbench.title')}
          </button>
        </div>
      </div>
    );
  }

  if (editor.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[12px] text-slate-500">
        {t('workbench.loading')}
      </div>
    );
  }

  const branch = branchParam ?? editor.manual.currentBranch;
  if (!OFFLINE) setActiveScope({ manualId, branch });

  return (
    <App
      key={`${manualId}::${branch}`}
      manualId={manualId}
      manualName={editor.manual.name}
      branch={branch}
      topicPath={topicPath}
      defaultRootMap={editor.manual.defaultRootMap ?? null}
      assignmentId={assignmentId}
      onLeaveSession={() => {
        clearActiveScope();
        useAssignmentStore.getState().clear();
        void useWorkbenchStore.getState().refresh();
        void useWorkbenchStore.getState().refreshAssignments();
        navigate(hubPath());
      }}
    />
  );
}
