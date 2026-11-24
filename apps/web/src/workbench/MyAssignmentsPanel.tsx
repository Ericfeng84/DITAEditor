import { Inbox, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import type { Assignment, AssignmentSummary } from '../services/assignments-api';
import { AssignmentCard } from './AssignmentCard';

export interface MyAssignmentsPanelProps {
  mine: Assignment[];
  delegated: Assignment[];
  summary: AssignmentSummary | null;
  loading: boolean;
  offline: boolean;
  onOpen: (assignment: Assignment) => void;
  onComplete: (assignment: Assignment) => void;
  onCancel: (assignment: Assignment) => void;
}

type PanelTab = 'mine' | 'delegated';

export function MyAssignmentsPanel({
  mine,
  delegated,
  summary,
  loading,
  offline,
  onOpen,
  onComplete,
  onCancel,
}: MyAssignmentsPanelProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<PanelTab>('mine');
  const list = tab === 'mine' ? mine : delegated;

  return (
    <aside className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="min-w-0">
        <h2 className="text-[12.5px] font-semibold text-slate-900">{t('workbench.assignmentsTitle')}</h2>
        {summary ? (
          <span className="mt-0.5 block text-[10px] font-medium leading-4 text-slate-500">
            {t('workbench.assignmentsSummary', {
              pending: summary.myPending,
              inProgress: summary.myInProgress,
              overdue: summary.myOverdue,
            })}
          </span>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label={t('workbench.assignmentsTitle')}
        className="mt-2 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5"
      >
        {(
          [
            { id: 'mine' as PanelTab, labelKey: 'workbench.assignmentsMine' as const, count: mine.length },
            {
              id: 'delegated' as PanelTab,
              labelKey: 'workbench.assignmentsDelegated' as const,
              count: delegated.length,
            },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t(item.labelKey)}
            {item.count > 0 ? (
              <span
                className={`ml-1 rounded px-1 text-[9.5px] ${
                  tab === item.id ? 'bg-white/20' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-2 flex-1 space-y-2 overflow-y-auto">
        {loading && list.length === 0 ? (
          <p className="flex items-center gap-1.5 px-1 py-3 text-[11px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('workbench.assignmentsLoading')}
          </p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
            {tab === 'mine' ? (
              <Inbox className="h-5 w-5 text-slate-300" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5 text-slate-300" aria-hidden="true" />
            )}
            <p className="text-[11px] leading-relaxed text-slate-500">
              {offline
                ? t('workbench.offlineDescription')
                : tab === 'mine'
                  ? t('workbench.assignmentsEmptyMine')
                  : t('workbench.assignmentsEmptyDelegated')}
            </p>
          </div>
        ) : (
          list.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              viewer={tab}
              onOpen={onOpen}
              onComplete={onComplete}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </aside>
  );
}
