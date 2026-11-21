import { FileCheck2, Lock, LockOpen, ShieldAlert, Unlock } from 'lucide-react';
import type { FileEditability } from '../services/lock-helpers';
import type { FileLock } from '../services/git-api';

export interface LockStatusBarProps {
  filePath: string | null;
  editability: FileEditability;
  lock: FileLock | null;
  busy: boolean;
  canCheckin: boolean;
  onCheckout: () => void;
  onRelease: () => void;
  onCancelCheckout: () => void;
  onOpenCheckin: () => void;
  onForceUnlock: () => void;
}

const stateStyles: Record<FileEditability['state'], string> = {
  admin: 'border-indigo-200 bg-indigo-50/70 text-indigo-800',
  viewer: 'border-slate-200 bg-slate-50 text-slate-600',
  unlocked: 'border-amber-200 bg-amber-50/70 text-amber-800',
  owned: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  'locked-by-other': 'border-rose-200 bg-rose-50/70 text-rose-800',
};

export function LockStatusBar({
  filePath,
  editability,
  lock,
  busy,
  canCheckin,
  onCheckout,
  onRelease,
  onCancelCheckout,
  onOpenCheckin,
  onForceUnlock,
}: LockStatusBarProps) {
  if (!filePath) return null;
  const showCheckout =
    editability.state === 'unlocked' || editability.state === 'locked-by-other';
  const showOwnerActions = editability.state === 'owned' || (editability.state === 'admin' && lock);

  return (
    <div
      className={`flex h-8 shrink-0 items-center justify-between gap-2 border-b px-3 text-[11px] ${stateStyles[editability.state]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {editability.state === 'owned' ? (
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : editability.state === 'locked-by-other' ? (
          <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
        ) : (
          <LockOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span className="shrink-0 font-semibold">
          {editability.state === 'owned'
            ? '已检出'
            : editability.state === 'locked-by-other'
              ? '他人检出'
              : editability.state === 'admin'
                ? '管理员'
                : editability.state === 'viewer'
                  ? '只读'
                  : '未检出'}
        </span>
        <span className="truncate text-current/80">{editability.reason}</span>
        {lock ? (
          <span className="hidden shrink-0 text-current/60 md:inline">
            {new Date(lock.updatedAt).toLocaleString('zh-CN')}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {showCheckout ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCheckout}
            className="inline-flex items-center gap-1 rounded border border-current/25 bg-white/80 px-2 py-0.5 font-medium hover:bg-white disabled:opacity-50"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            {busy ? '处理中…' : '检出'}
          </button>
        ) : null}
        {showOwnerActions && editability.state === 'owned' ? (
          <>
            <button
              type="button"
              disabled={busy || !canCheckin}
              onClick={onOpenCheckin}
              className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              title={canCheckin ? '预览差异并提交本地 Git' : '当前文件没有需要提交的改动'}
            >
              <FileCheck2 className="h-3 w-3" aria-hidden="true" />
              签入…
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelCheckout}
              className="inline-flex items-center gap-1 rounded border border-current/25 bg-white/80 px-2 py-0.5 hover:bg-white disabled:opacity-50"
              title="取消检出并回滚到 HEAD 版本"
            >
              <Unlock className="h-3 w-3" aria-hidden="true" />
              取消检出
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRelease}
              className="rounded border border-current/25 bg-white/80 px-2 py-0.5 hover:bg-white disabled:opacity-50"
              title="仅释放锁，保留工作区改动"
            >
              释放
            </button>
          </>
        ) : null}
        {editability.state === 'admin' && lock ? (
          <button
            type="button"
            disabled={busy}
            onClick={onForceUnlock}
            className="inline-flex items-center gap-1 rounded border border-rose-300 bg-white px-2 py-0.5 font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            title="管理员强制解锁，并把当前内容与补丁写入备份表"
          >
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            强制解锁
          </button>
        ) : null}
        {editability.state === 'locked-by-other' && lock ? (
          <span className="text-current/70">需要 {lock.userName} 先释放</span>
        ) : null}
      </div>
    </div>
  );
}
