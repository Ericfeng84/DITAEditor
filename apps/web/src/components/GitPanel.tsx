import { useEffect, useMemo, useState } from 'react';
import {
  FileDiff,
  GitBranch,
  GitCommitHorizontal,
  History,
  Lock,
  LockOpen,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useGitStore } from '../store/git-store';

export interface GitPanelProps {
  activePath: string | null;
  onOpenDiff: (options: { path: string; from?: string; to?: string }) => void;
  onOpenCheckin: (paths: string[]) => void;
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function GitPanel({ activePath, onOpenDiff, onOpenCheckin }: GitPanelProps) {
  const identity = useGitStore((state) => state.identity);
  const currentUser = useGitStore((state) => state.currentUser);
  const status = useGitStore((state) => state.status);
  const branches = useGitStore((state) => state.branches);
  const branch = useGitStore((state) => state.branch);
  const locks = useGitStore((state) => state.locks);
  const history = useGitStore((state) => state.history);
  const loading = useGitStore((state) => state.loading);
  const error = useGitStore((state) => state.error);
  const busyPath = useGitStore((state) => state.busyPath);
  const refreshAll = useGitStore((state) => state.refreshAll);
  const initGit = useGitStore((state) => state.initGit);
  const createBranch = useGitStore((state) => state.createBranch);
  const switchBranch = useGitStore((state) => state.switchBranch);
  const loadHistory = useGitStore((state) => state.loadHistory);
  const release = useGitStore((state) => state.release);
  const forceUnlock = useGitStore((state) => state.forceUnlock);

  const [newBranch, setNewBranch] = useState('');
  const [creating, setCreating] = useState(false);

  const canWrite = currentUser?.role === 'admin' || currentUser?.role === 'writer';
  const initialized = Boolean(status?.initialized);
  const dirtyFiles = status?.dirtyFiles ?? [];
  const dirtySet = useMemo(() => new Set(dirtyFiles.map((file) => file.path)), [dirtyFiles]);
  const myLocks = useMemo(
    () => locks.filter((lock) => lock.userId === currentUser?.id),
    [locks, currentUser?.id],
  );
  const eligiblePaths = useMemo(
    () => myLocks.filter((lock) => dirtySet.has(lock.filePath)).map((lock) => lock.filePath),
    [myLocks, dirtySet],
  );

  useEffect(() => {
    if (!initialized) return;
    void loadHistory(activePath);
  }, [initialized, activePath, branch, loadHistory]);

  const handleCreateBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    setCreating(true);
    const created = await createBranch(name);
    if (created) {
      setNewBranch('');
      await switchBranch(name);
    }
    setCreating(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden text-xs">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <span className="text-[11px] font-semibold text-slate-700">本地 Git 与检出</span>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refreshAll()}
          className="inline-flex items-center justify-center rounded border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
          title="刷新 Git 状态与检出锁"
          aria-label="刷新 Git 状态与检出锁"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
        {error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] text-rose-700">
            {error}
          </div>
        ) : null}

        {!initialized ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
            <p className="text-[11px] font-semibold text-amber-900">尚未初始化本地 Git 仓库</p>
            <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
              初始化会创建仓库、维护分支隔离的 worktree，并提交当前工作区作为首个版本。
            </p>
            {canWrite ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => void initGit()}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <GitBranch className="h-3 w-3" aria-hidden="true" />
                初始化 Git 仓库
              </button>
            ) : (
              <p className="mt-2 text-[10px] font-medium text-amber-800">只读身份无法初始化仓库</p>
            )}
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <GitBranch className="h-3 w-3" aria-hidden="true" />
                分支
              </div>
              <select
                value={branch ?? ''}
                disabled={!canWrite || loading}
                onChange={(event) => void switchBranch(event.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-800 outline-none focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-500"
                aria-label="切换 Git 分支"
              >
                {branches.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                    {item.primary ? ' · 主工作区' : item.worktreePath ? ' · worktree' : ''}
                  </option>
                ))}
              </select>
              {canWrite ? (
                <div className="mt-1.5 flex items-center gap-1">
                  <input
                    value={newBranch}
                    onChange={(event) => setNewBranch(event.target.value)}
                    placeholder="新分支名，如 release/2.0"
                    className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-[10px] outline-none focus:border-indigo-400"
                    aria-label="新分支名"
                  />
                  <button
                    type="button"
                    disabled={creating || !newBranch.trim()}
                    onClick={() => void handleCreateBranch()}
                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                    title="创建并切换到新分支"
                  >
                    <Plus className="h-3 w-3" aria-hidden="true" />
                    创建
                  </button>
                </div>
              ) : null}
              {status?.lastCommit ? (
                <p className="mt-1.5 truncate text-[10px] text-slate-500" title={status.lastCommit.message}>
                  HEAD {status.lastCommit.shortHash} · {status.lastCommit.message}
                </p>
              ) : null}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  检出锁 · {locks.length}
                </span>
                {eligiblePaths.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => onOpenCheckin(eligiblePaths)}
                    className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700"
                  >
                    签入 {eligiblePaths.length}
                  </button>
                ) : null}
              </div>
              {locks.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">当前分支没有文件被检出。</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {locks.map((lock) => (
                    <li
                      key={lock.id}
                      className="flex items-center justify-between gap-1 rounded border border-slate-100 bg-slate-50/60 px-1.5 py-1"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-medium text-slate-700" title={lock.filePath}>
                          {lock.filePath}
                        </span>
                        <span className="flex items-center gap-1 text-[9px] text-slate-500">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: lock.userColor }}
                            aria-hidden="true"
                          />
                          {lock.userName} · {shortDate(lock.updatedAt)}
                        </span>
                      </span>
                      {lock.userId === currentUser?.id ? (
                        <button
                          type="button"
                          disabled={busyPath === lock.filePath}
                          onClick={() => void release(lock.filePath)}
                          className="shrink-0 rounded border border-slate-200 bg-white p-0.5 text-slate-500 hover:text-slate-800 disabled:opacity-50"
                          title="释放检出锁（保留磁盘改动）"
                          aria-label={`释放 ${lock.filePath}`}
                        >
                          <LockOpen className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : currentUser?.role === 'admin' ? (
                        <button
                          type="button"
                          disabled={busyPath === lock.filePath}
                          onClick={() => {
                            const reason = window.prompt(
                              `强制解锁 ${lock.filePath}（${lock.userName}）\n请输入原因：`,
                              '管理员强制解锁',
                            );
                            if (reason !== null) void forceUnlock(lock.filePath, reason);
                          }}
                          className="shrink-0 rounded border border-rose-200 bg-white p-0.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          title="管理员强制解锁并备份"
                          aria-label={`强制解锁 ${lock.filePath}`}
                        >
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <FileDiff className="h-3 w-3" aria-hidden="true" />
                  工作区改动 · {dirtyFiles.length}
                </span>
                {activePath && dirtySet.has(activePath) ? (
                  <button
                    type="button"
                    onClick={() => onOpenDiff({ path: activePath, from: 'HEAD' })}
                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    当前文件差异
                  </button>
                ) : null}
              </div>
              {dirtyFiles.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">工作区与 HEAD 一致。</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {dirtyFiles.slice(0, 80).map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        onClick={() => onOpenDiff({ path: file.path, from: 'HEAD' })}
                        className="flex w-full items-center justify-between gap-1 rounded px-1 py-0.5 text-left hover:bg-slate-50"
                        title={`查看 ${file.path} 的工作区差异`}
                      >
                        <span className="min-w-0 truncate text-[10px] text-slate-700">
                          {file.renamed ? `${file.originalPath} → ${file.path}` : file.path}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-1 text-[9px] text-slate-500">
                          {file.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <History className="h-3 w-3" aria-hidden="true" />
                提交历史{activePath ? ` · ${activePath.split('/').pop()}` : ' · 全分支'}
              </div>
              {history.length === 0 ? (
                <p className="mt-1.5 text-[10px] text-slate-500">当前分支还没有提交。</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {history.slice(0, 30).map((commit) => (
                    <li key={commit.hash} className="rounded border border-slate-100 p-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-medium text-slate-800" title={commit.message}>
                            {commit.message}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[9px] text-slate-500">
                            <GitCommitHorizontal className="h-2.5 w-2.5" aria-hidden="true" />
                            {commit.shortHash} · {commit.authorName} · {shortDate(commit.date)}
                          </p>
                        </div>
                        {activePath ? (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDiff({
                                path: activePath,
                                from: `${commit.hash}~1`,
                                to: commit.hash,
                              })
                            }
                            className="shrink-0 rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-600 hover:bg-slate-50"
                            title="对比该提交的此文件版本"
                          >
                            差异
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] text-slate-500">
        {currentUser
          ? `${currentUser.displayName} · ${identity?.roles.find((role) => role.id === currentUser.role)?.label ?? currentUser.role}`
          : '身份加载中'}
        {' · '}
        本地 Git，无远端依赖
      </div>
    </div>
  );
}
