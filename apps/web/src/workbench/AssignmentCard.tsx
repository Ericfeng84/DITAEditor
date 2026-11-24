import { AlertTriangle, CalendarClock, Check, ExternalLink, GitBranch, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { Assignment } from '../services/assignments-api';

export interface AssignmentCardProps {
  assignment: Assignment;
  /** `mine` shows 打开/完成; `delegated` shows who owns it plus 取消. */
  viewer: 'mine' | 'delegated';
  onOpen: (assignment: Assignment) => void;
  onComplete: (assignment: Assignment) => void;
  onCancel: (assignment: Assignment) => void;
}

function statusTone(assignment: Assignment): { className: string; key: 'workbench.assignmentsPending' | 'workbench.assignmentsInProgress' | 'workbench.assignmentsOverdue' } {
  if (assignment.overdue) {
    return { className: 'border-rose-200 bg-rose-50 text-rose-700', key: 'workbench.assignmentsOverdue' };
  }
  if (assignment.status === 'in_progress') {
    return {
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      key: 'workbench.assignmentsInProgress',
    };
  }
  return {
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    key: 'workbench.assignmentsPending',
  };
}

export function AssignmentCard({ assignment, viewer, onOpen, onComplete, onCancel }: AssignmentCardProps) {
  const { t } = useI18n();
  const tone = statusTone(assignment);
  const person = viewer === 'mine' ? assignment.assigner : assignment.assignee;
  const personLabel =
    viewer === 'mine'
      ? t('workbench.assignmentsAssigner', { name: person?.displayName ?? '—' })
      : t('workbench.assignmentsAssignee', { name: person?.displayName ?? '—' });

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[12.5px] font-semibold text-slate-900">
            {assignment.topicTitle ?? assignment.topicPath}
          </h4>
          <p className="mt-0.5 truncate text-[10.5px] text-slate-500" title={assignment.topicPath}>
            {t('workbench.assignmentsBranch', {
              manual: assignment.manualName,
              branch: assignment.branch,
            })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded border px-1 py-[1px] text-[10px] font-medium ${tone.className}`}
        >
          {t(tone.key)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500">
        <span>{personLabel}</span>
        <span className="inline-flex items-center gap-0.5">
          <CalendarClock className="h-3 w-3 text-slate-400" aria-hidden="true" />
          {assignment.dueDate
            ? t('workbench.assignmentsDue', { date: assignment.dueDate })
            : t('workbench.assignmentsNoDue')}
        </span>
        {assignment.lockOwnerName && assignment.lockOwnerId !== person?.id ? (
          <span className="inline-flex items-center gap-0.5 text-slate-400">
            <GitBranch className="h-3 w-3" aria-hidden="true" />
            {assignment.lockOwnerName}
          </span>
        ) : null}
        {!assignment.topicExists ? (
          <span className="inline-flex items-center gap-0.5 text-amber-700">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {t('workbench.assignmentsMissingTopic')}
          </span>
        ) : null}
      </div>

      {assignment.note ? (
        <p className="mt-2 line-clamp-2 rounded bg-slate-50 px-2 py-1 text-[10.5px] leading-snug text-slate-600">
          {assignment.note}
        </p>
      ) : null}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onOpen(assignment)}
            disabled={!assignment.topicExists}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            {t('workbench.assignmentsOpen')}
          </button>
          {viewer === 'mine' ? (
            <button
              type="button"
              onClick={() => onComplete(assignment)}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              {t('workbench.assignmentsComplete')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCancel(assignment)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              {t('workbench.assignmentsCancel')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
