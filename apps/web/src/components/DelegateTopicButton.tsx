import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/index.js';
import type { IdentityUser } from '../services/identity-api';
import { useAssignmentStore } from '../store/assignment-store';
import { useGitStore } from '../store/git-store';
import { DelegateTopicDialog } from '../workbench/DelegateTopicDialog';

export interface DelegateTopicButtonProps {
  topicPath: string;
  topicTitle: string | null;
  candidates: IdentityUser[];
  disabled: boolean;
  variant?: 'toolbar' | 'inline';
}

/** "委派" entry point for a topic nobody owns yet (admin/writer only). */
export function DelegateTopicButton({
  topicPath,
  topicTitle,
  candidates,
  disabled,
  variant = 'toolbar',
}: DelegateTopicButtonProps) {
  const { t } = useI18n();
  const branch = useGitStore((state) => state.branch);
  const delegate = useAssignmentStore((state) => state.delegate);
  const busy = useAssignmentStore((state) => state.busy);
  const error = useAssignmentStore((state) => state.error);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || candidates.length === 0}
        title={t('assignments.menuDelegate')}
        className={
          variant === 'toolbar'
            ? 'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
            : 'inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline'
        }
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
        {t('assignments.editorDelegate')}
      </button>
      <DelegateTopicDialog
        open={open}
        mode="create"
        topicPath={topicPath}
        topicTitle={topicTitle}
        branch={branch}
        candidates={candidates}
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={({ assigneeId, note, dueDate }) => {
          void delegate({ topicPath, assigneeId, note, dueDate });
        }}
      />
    </>
  );
}
