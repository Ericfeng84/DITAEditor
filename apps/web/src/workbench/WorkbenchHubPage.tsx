import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { editorPath, navigate } from '../router/app-router.js';
import type { Assignment } from '../services/assignments-api';
import type { Manual, ManualCreateInput, ManualUpdateInput } from '../services/manuals-api.js';
import { useGitStore } from '../store/git-store';
import { useWorkbenchStore } from '../store/workbench-store';
import { HubHeader } from './HubHeader';
import { ManualFormDialog, type ManualFormMode } from './ManualFormDialog';
import { ManualListSection } from './ManualListSection';
import { MyAssignmentsPanel } from './MyAssignmentsPanel';

const FOCUS_REFRESH_THROTTLE_MS = 3000;

/**
 * Phase 10 hub: one screen that lists the manuals of this installation, creates or
 * attaches more, and surfaces the caller's own assignments. Opening a manual navigates to
 * `/manuals/:id`, where the editor runs against its own isolated session.
 */
export function WorkbenchHubPage() {
  const { t } = useI18n();
  const identity = useGitStore((state) => state.identity);
  const currentUser = useGitStore((state) => state.currentUser);
  const initializeIdentity = useGitStore((state) => state.initialize);
  const switchUser = useGitStore((state) => state.switchUser);

  const manuals = useWorkbenchStore((state) => state.manuals);
  const loading = useWorkbenchStore((state) => state.loading);
  const error = useWorkbenchStore((state) => state.error);
  const offline = useWorkbenchStore((state) => state.offline);
  const query = useWorkbenchStore((state) => state.query);
  const includeArchived = useWorkbenchStore((state) => state.includeArchived);
  const busyManualId = useWorkbenchStore((state) => state.busyManualId);
  const summary = useWorkbenchStore((state) => state.summary);
  const myAssignments = useWorkbenchStore((state) => state.myAssignments);
  const delegatedAssignments = useWorkbenchStore((state) => state.delegatedAssignments);
  const assignmentsLoading = useWorkbenchStore((state) => state.assignmentsLoading);
  const refresh = useWorkbenchStore((state) => state.refresh);
  const refreshAssignments = useWorkbenchStore((state) => state.refreshAssignments);
  const setQuery = useWorkbenchStore((state) => state.setQuery);
  const setIncludeArchived = useWorkbenchStore((state) => state.setIncludeArchived);
  const createManual = useWorkbenchStore((state) => state.createManual);
  const updateManual = useWorkbenchStore((state) => state.updateManual);
  const deleteManual = useWorkbenchStore((state) => state.deleteManual);
  const touchManual = useWorkbenchStore((state) => state.touchManual);
  const setAssignmentStatus = useWorkbenchStore((state) => state.setAssignmentStatus);
  const cancelAssignment = useWorkbenchStore((state) => state.cancelAssignment);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<ManualFormMode>('create');
  const [formManual, setFormManual] = useState<Manual | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const lastFocusRefresh = useRef(0);

  // Identity first: the manual list is per-user (assignment counts), so load it after.
  useEffect(() => {
    void initializeIdentity();
  }, [initializeIdentity]);

  useEffect(() => {
    void refresh();
    void refreshAssignments();
  }, [refresh, refreshAssignments, currentUser?.id]);

  // Freshness without polling: re-read on focus/visibility with a 3s throttle.
  useEffect(() => {
    const maybeRefresh = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastFocusRefresh.current < FOCUS_REFRESH_THROTTLE_MS) return;
      lastFocusRefresh.current = now;
      void refresh();
      void refreshAssignments();
    };
    const onFocus = () => maybeRefresh(false);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeRefresh(false);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh, refreshAssignments]);

  const openManual = async (manual: Manual, assignmentId?: string) => {
    if (offline) {
      navigate(editorPath(manual.id, { branch: manual.currentBranch }));
      return;
    }
    await touchManual(manual.id);
    navigate(
      editorPath(manual.id, { branch: manual.currentBranch, assignmentId: assignmentId ?? null }),
    );
  };

  const openAssignment = (assignment: Assignment) => {
    navigate(
      editorPath(assignment.manualId, {
        branch: assignment.branch,
        topicPath: assignment.topicPath,
        assignmentId: assignment.id,
      }),
    );
  };

  const handleCreate = async (input: ManualCreateInput) => {
    setFormBusy(true);
    const manual = await createManual(input);
    setFormBusy(false);
    if (manual) {
      setFormOpen(false);
      navigate(editorPath(manual.id, { branch: manual.currentBranch }));
    }
  };

  const handleUpdate = async (id: string, patch: ManualUpdateInput) => {
    setFormBusy(true);
    await updateManual(id, patch);
    setFormBusy(false);
    setFormOpen(false);
  };

  const handleToggleArchive = async (manual: Manual) => {
    await updateManual(manual.id, { archived: !manual.archived });
  };

  const handleRemove = async (manual: Manual) => {
    const confirmed = window.confirm(t('workbench.removeConfirm', { name: manual.name }));
    if (!confirmed) return;
    await deleteManual(manual.id);
  };

  const canManage = currentUser ? currentUser.role !== 'viewer' : false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <HubHeader
        identity={identity}
        currentUser={currentUser}
        onSwitchIdentity={(userId) => void switchUser(userId)}
        onRefresh={() => {
          void refresh();
          void refreshAssignments();
        }}
        loading={loading}
        offline={offline}
      />

      <main className="mx-auto max-w-6xl px-5 py-5">
        <div className="mb-3">
          <h1 className="text-[17px] font-semibold tracking-tight text-slate-900">
            {t('workbench.title')}
          </h1>
          <p className="mt-0.5 text-[11.5px] text-slate-500">{t('workbench.subtitle')}</p>
        </div>

        {offline ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
            <span className="font-semibold">{t('workbench.offlineTitle')}</span> ·{' '}
            {t('workbench.offlineDescription')}
          </div>
        ) : null}

        {error && !offline ? (
          <div
            role="alert"
            className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700"
          >
            <span>{t('workbench.error', { message: error })}</span>
            <button
              type="button"
              aria-label={t('workbench.dismissError')}
              onClick={() => useWorkbenchStore.setState({ error: null })}
              className="shrink-0 rounded px-1 text-rose-500 hover:bg-rose-100"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
          <ManualListSection
            manuals={manuals}
            loading={loading}
            query={query}
            includeArchived={includeArchived}
            busyManualId={busyManualId}
            canManage={canManage}
            offline={offline}
            onQueryChange={setQuery}
            onToggleArchived={setIncludeArchived}
            onCreate={() => {
              setFormMode('create');
              setFormManual(null);
              setFormOpen(true);
            }}
            onAttach={() => {
              setFormMode('attach');
              setFormManual(null);
              setFormOpen(true);
            }}
            onOpen={(manual) => void openManual(manual)}
            onEdit={(manual) => {
              setFormMode('edit');
              setFormManual(manual);
              setFormOpen(true);
            }}
            onToggleArchive={(manual) => void handleToggleArchive(manual)}
            onRemove={(manual) => void handleRemove(manual)}
          />

          <MyAssignmentsPanel
            mine={myAssignments}
            delegated={delegatedAssignments}
            summary={summary}
            loading={assignmentsLoading}
            offline={offline}
            onOpen={openAssignment}
            onComplete={(assignment) => void setAssignmentStatus(assignment.id, 'done')}
            onCancel={(assignment) => void cancelAssignment(assignment.id)}
          />
        </div>
      </main>

      <ManualFormDialog
        open={formOpen}
        mode={formMode}
        manual={formManual}
        busy={formBusy}
        error={error}
        onClose={() => setFormOpen(false)}
        onCreate={(input) => void handleCreate(input)}
        onUpdate={(id, patch) => void handleUpdate(id, patch)}
      />
    </div>
  );
}
