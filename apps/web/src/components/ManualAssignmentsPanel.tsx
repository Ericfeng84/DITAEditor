import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronRight, ClipboardList, Info, XCircle } from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { Assignment } from '../services/assignments-api';
import { useAssignmentStore } from '../store/assignment-store';
import { useGitStore } from '../store/git-store';

export interface ManualAssignmentsPanelProps {
  /** Opens the assignment's topic in the editor (deep link within this session). */
  onOpenTopic: (assignment: Assignment) => void;
}

const STATUS_TONE: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
};

/**
 * Sidebar panel (Phase 10): my assignments in this manual + branch, plus what I delegated.
 *
 * Scoping is implicit — the session's `x-dita-manual-id` / `x-dita-branch` headers make the
 * server answer for this session only, so the panel never has to filter cross-manual noise.
 */
export function ManualAssignmentsPanel({ onOpenTopic }: ManualAssignmentsPanelProps) {
  const { t, locale } = useI18n();
  const currentUser = useGitStore((state) => state.currentUser);
  const mine = useAssignmentStore((state) => state.mine);
  const delegated = useAssignmentStore((state) => state.delegated);
  const loading = useAssignmentStore((state) => state.loading);
  const busy = useAssignmentStore((state) => state.busy);
  const error = useAssignmentStore((state) => state.error);
  const setStatus = useAssignmentStore((state) => state.setStatus);
  const cancel = useAssignmentStore((state) => state.cancel);
  const [view, setView] = useState<'mine' | 'delegated'>('mine');

  const canDelegate = currentUser?.role === 'admin' || currentUser?.role === 'writer';
  const visible = view === 'mine' ? mine : delegated;
  const openCount = useMemo(
    () => mine.filter((item) => item.status === 'pending' || item.status === 'in_progress').length,
    [mine],
  );

  const dueLabel = (item: Assignment) => {
    if (!item.dueDate) return null;
    return (
      <span
        className={`inline-flex items-center rounded px-1 py-px text-[10px] font-medium ${
          item.overdue ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {t(item.overdue ? 'assignments.dueOverdue' : 'assignments.dueOn', { date: item.dueDate })}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span className="truncate text-[11px] font-semibold text-slate-800">
            {t('assignments.panelTitle')}
          </span>
          {openCount > 0 ? (
            <span className="rounded-full bg-blue-600 px-1.5 py-px text-[9.5px] font-bold text-white">
              {openCount}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1">
        {(['mine', 'delegated'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => setView(item)}
            className={`flex-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors ${
              view === item
                ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(item === 'mine' ? 'assignments.panelMine' : 'assignments.panelDelegated')} ·{' '}
            {item === 'mine' ? mine.length : delegated.length}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="shrink-0 border-b border-rose-100 bg-rose-50 px-2.5 py-1 text-[10.5px] text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && visible.length === 0 ? (
          <p className="px-2.5 py-3 text-[11px] text-slate-400">{t('assignments.panelLoading')}</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
            <Info className="h-4 w-4 text-slate-300" aria-hidden="true" />
            <p className="text-[11px] text-slate-500">
              {t(view === 'mine' ? 'assignments.panelEmptyMine' : 'assignments.panelEmptyDelegated')}
            </p>
            {view === 'mine' && canDelegate ? (
              <p className="text-[10px] leading-relaxed text-slate-400">
                {t('assignments.panelEmptyHint')}
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((item) => {
              const person = view === 'mine' ? item.assigner : item.assignee;
              return (
                <li key={item.id} className="group px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenTopic(item)}
                    className="flex w-full items-start gap-1 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-slate-800 group-hover:text-blue-700">
                        {item.topicTitle || item.topicPath}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                        <span
                          className={`inline-flex items-center rounded border px-1 py-px font-medium ${
                            STATUS_TONE[item.status] ?? STATUS_TONE.cancelled
                          }`}
                        >
                          {t(`assignments.status.${item.status}`)}
                        </span>
                        <span className="truncate">
                          {t(view === 'mine' ? 'assignments.fromPerson' : 'assignments.toPerson', {
                            name: person?.displayName ?? '—',
                          })}
                        </span>
                        {dueLabel(item)}
                        {!item.topicExists ? (
                          <span className="text-rose-600">{t('assignments.topicMissingShort')}</span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-300 group-hover:text-blue-600" aria-hidden="true" />
                  </button>
                  {item.status === 'pending' || item.status === 'in_progress' ? (
                    <div className="mt-1 flex items-center gap-1 pl-0">
                      {view === 'mine' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(item.id, 'done')}
                          className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-px text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                          {t('assignments.markDone')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancel(item.id)}
                          className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-px text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <XCircle className="h-2.5 w-2.5" aria-hidden="true" />
                          {t('assignments.cancelDelegate')}
                        </button>
                      )}
                      <span className="truncate text-[9.5px] text-slate-400">
                        {t('assignments.updatedAt', {
                          time: new Intl.DateTimeFormat(locale, {
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(item.updatedAt)),
                        })}
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
