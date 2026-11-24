import { BellRing, Check, LockKeyhole, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import type { IdentityUser } from '../services/identity-api';
import { useAssignmentStore } from '../store/assignment-store';
import { useGitStore } from '../store/git-store';
import { DelegateTopicDialog } from '../workbench/DelegateTopicDialog';

export interface TopicAssignmentBannerProps {
  topicPath: string;
  topicTitle: string | null;
  currentUserId: string | null;
  role: string | null;
  /** Users eligible as assignees (admin/writer). */
  candidates: IdentityUser[];
  lockedByMe: boolean;
  busy: boolean;
  onCheckout: () => void;
}

/**
 * Phase 10 assignment chip for the open topic.
 *
 * Two readings of the same fact: "this is yours, start it" versus "somebody else owns it,
 * confirm before you start". Both are advisory — the lock still decides who may write.
 *
 * Rendered as a compact chip inside the document toolbar so the assignment never costs a
 * whole extra row above the canvas; the long explanations live in `title` tooltips.
 */
export function TopicAssignmentBanner({
  topicPath,
  topicTitle,
  currentUserId,
  role,
  candidates,
  lockedByMe,
  busy,
  onCheckout,
}: TopicAssignmentBannerProps) {
  const { t } = useI18n();
  const branch = useGitStore((state) => state.branch);
  const active = useAssignmentStore((state) => state.active);
  const dismissed = useAssignmentStore((state) => state.dismissed);
  const dismiss = useAssignmentStore((state) => state.dismiss);
  const setStatus = useAssignmentStore((state) => state.setStatus);
  const reassign = useAssignmentStore((state) => state.reassign);
  const storeError = useAssignmentStore((state) => state.error);
  const storeBusy = useAssignmentStore((state) => state.busy);
  const [reassignOpen, setReassignOpen] = useState(false);

  if (!active || active.status === 'cancelled' || active.status === 'done') return null;
  if (active.topicPath !== topicPath) return null;
  if (dismissed.has(topicPath)) return null;

  const mine = Boolean(currentUserId && active.assignee?.id === currentUserId);
  const canReassign = role === 'admin' || active.assigner?.id === currentUserId;

  const dialog = (
    <DelegateTopicDialog
      open={reassignOpen}
      mode="reassign"
      topicPath={topicPath}
      topicTitle={topicTitle}
      branch={branch}
      candidates={candidates}
      initialAssigneeId={active.assignee?.id ?? null}
      busy={storeBusy}
      error={storeError}
      onClose={() => setReassignOpen(false)}
      onSubmit={({ assigneeId }) => {
        void reassign(active.id, assigneeId);
      }}
    />
  );

  const dismissButton = (
    <button
      type="button"
      onClick={() => dismiss(topicPath)}
      title={t('assignments.bannerDismiss')}
      aria-label={t('assignments.bannerDismiss')}
      className="rounded p-0.5 hover:bg-white/70"
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );

  if (mine) {
    const statusLabel =
      active.status === 'pending'
        ? t('assignments.status.pending')
        : t('assignments.status.in_progress');
    const detail = active.dueDate
      ? t('assignments.bannerMineDescription', {
          assigner: active.assigner?.displayName ?? '—',
          due: active.dueDate,
        })
      : t('assignments.bannerMineNoDue', { assigner: active.assigner?.displayName ?? '—' });
    return (
      <>
        <div
          className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded border border-blue-200 bg-blue-50/80 px-1.5 py-[2px] text-[10.5px] text-blue-800"
          title={active.note ? `${detail} · ${t('assignments.bannerNote', { note: active.note })}` : detail}
        >
          <UserRound className="h-3 w-3 shrink-0 text-blue-600" aria-hidden="true" />
          <span className="shrink-0 whitespace-nowrap font-semibold">
            {t('assignments.chipMineLabel')} · {statusLabel}
          </span>
          {active.status === 'pending' ? (
            <button
              type="button"
              onClick={onCheckout}
              disabled={busy || lockedByMe}
              title={lockedByMe ? t('lock.state.owned') : undefined}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-blue-600 px-1.5 py-[1px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <LockKeyhole className="h-3 w-3" aria-hidden="true" />
              {t('assignments.bannerCheckout')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setStatus(active.id, 'done')}
              disabled={storeBusy}
              className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-600 px-1.5 py-[1px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              {t('assignments.bannerComplete')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setReassignOpen(true)}
            className="shrink-0 rounded border border-blue-300 bg-white px-1.5 py-[1px] font-medium text-blue-700 hover:bg-blue-50"
          >
            {t('assignments.bannerReassign')}
          </button>
          {dismissButton}
        </div>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div
        className="flex min-w-0 items-center gap-1.5 overflow-hidden rounded border border-amber-200 bg-amber-50/80 px-1.5 py-[2px] text-[10.5px] text-amber-800"
        title={t('assignments.bannerOtherDescription')}
      >
        <BellRing className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="min-w-0 truncate font-semibold">
          {t('assignments.bannerOtherTitle', { name: active.assignee?.displayName ?? '—' })}
        </span>
        {canReassign ? (
          <button
            type="button"
            onClick={() => setReassignOpen(true)}
            className="shrink-0 rounded border border-amber-300 bg-white px-1.5 py-[1px] font-medium text-amber-700 hover:bg-amber-50"
          >
            {t('assignments.bannerReassign')}
          </button>
        ) : null}
        {dismissButton}
      </div>
      {dialog}
    </>
  );
}
