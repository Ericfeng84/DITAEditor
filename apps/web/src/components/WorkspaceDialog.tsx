import { useEffect, useId, useRef, useState } from 'react';
import { classifyDitaFileKind } from '@dita/core';
import {
  AlertCircle,
  ChevronDown,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { WorkspaceListItem, WorkspaceScaffold } from '../services/workspace-api';

export interface WorkspaceDialogProps {
  open: boolean;
  workspaceMode: 'api' | 'memory';
  rootDir: string;
  defaultRootDir: string;
  importsRootDir: string;
  recentWorkspaces: WorkspaceListItem[];
  loadingWorkspaces: boolean;
  onClose: () => void;
  onOpenLocalDir: (target: { rootDir: string } | { useDefault: true }) => Promise<void>;
  onCreateWorkspace: (options: {
    name: string;
    parentDir: string;
    scaffold: WorkspaceScaffold;
  }) => Promise<void>;
  onForgetWorkspace: (dirPath: string) => Promise<void>;
  onRefreshWorkspaces: () => Promise<void>;
  onImportFolder: (
    projectName: string,
    files: { path: string; content: string; encoding?: 'utf8' | 'base64' }[],
  ) => Promise<void>;
  onRestoreOfflineDemo: () => void;
}

const RELEVANT_EXTENSIONS = new Set([
  '.dita',
  '.ditamap',
  '.bookmap',
  '.ditaval',
  '.xml',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.avif',
]);

const FIELD_CLASS =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 ' +
  'placeholder:text-slate-400 transition-colors focus:border-indigo-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const PRIMARY_BTN =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs ' +
  'font-semibold text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-500 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ' +
  'focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45';

const SECONDARY_BTN =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white ' +
  'px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

const SCAFFOLD_OPTIONS: {
  value: WorkspaceScaffold;
  label: string;
  description: string;
}[] = [
  {
    value: 'blank',
    label: '空白目录',
    description: '仅创建 topics / maps / images 标准结构',
  },
  {
    value: 'starter',
    label: '示例骨架',
    description: '附带 index.ditamap 与介绍主题',
  },
];

export function WorkspaceDialog({
  open,
  workspaceMode,
  rootDir,
  defaultRootDir,
  importsRootDir,
  recentWorkspaces,
  loadingWorkspaces,
  onClose,
  onOpenLocalDir,
  onCreateWorkspace,
  onForgetWorkspace,
  onRefreshWorkspaces,
  onImportFolder,
  onRestoreOfflineDemo,
}: WorkspaceDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [dirInput, setDirInput] = useState(rootDir);
  const [projectName, setProjectName] = useState('new-dita-project');
  const [parentDir, setParentDir] = useState('');
  const [scaffold, setScaffold] = useState<WorkspaceScaffold>('blank');
  const [advancedParent, setAdvancedParent] = useState(false);
  const [advancedPath, setAdvancedPath] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isApiMode = workspaceMode === 'api';
  const canWrite = isApiMode && !busy;
  const baseParentDir = parentDir.trim() || importsRootDir || defaultRootDir;
  const createTargetDir = `${baseParentDir.replace(/\/+$/, '')}/${projectName.trim() || '<项目名>'}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setDirInput('');
      setParentDir(importsRootDir || defaultRootDir);
      setProjectName('new-dita-project');
      setScaffold('blank');
      setAdvancedParent(false);
      setAdvancedPath(false);
      setErrorMsg(null);
      if (!dialog.open) dialog.showModal();
      if (isApiMode) {
        void onRefreshWorkspaces();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, rootDir, isApiMode, importsRootDir, defaultRootDir, onRefreshWorkspaces]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  useEffect(() => {
    if (errorMsg) {
      errorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [errorMsg]);

  const runBusy = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await action();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPath = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirInput.trim()) return;
    void runBusy(async () => {
      await onOpenLocalDir({ rootDir: dirInput.trim() });
      dialogRef.current?.close('ok');
    });
  };

  const handleOpenRecent = (target: string) => {
    if (busy) return;
    void runBusy(async () => {
      await onOpenLocalDir({ rootDir: target });
      dialogRef.current?.close('ok');
    });
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) {
      setErrorMsg('请填写工作区名称。');
      return;
    }
    void runBusy(async () => {
      await onCreateWorkspace({
        name,
        parentDir: parentDir.trim(),
        scaffold,
      });
      dialogRef.current?.close('ok');
    });
  };

  const handleForget = (target: string) => {
    void runBusy(async () => {
      await onForgetWorkspace(target);
    });
  };

  const handleOpenDefault = () => {
    void runBusy(async () => {
      try {
        await onOpenLocalDir({ useDefault: true });
      } catch (err) {
        if (isApiMode) throw err;
        onRestoreOfflineDemo();
      }
      dialogRef.current?.close('ok');
    });
  };

  const handleFolderPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setBusy(true);
    setErrorMsg(null);

    try {
      const firstRel = picked[0]!.webkitRelativePath || picked[0]!.name;
      const rootFolderName = firstRel.includes('/') ? firstRel.split('/')[0]! : 'imported-dita';
      const batch: { path: string; content: string; encoding?: 'utf8' | 'base64' }[] = [];

      for (const file of picked) {
        const rawRel = file.webkitRelativePath || file.name;
        const stripped = rawRel.startsWith(`${rootFolderName}/`)
          ? rawRel.slice(rootFolderName.length + 1)
          : rawRel;
        if (!stripped || stripped.startsWith('.')) continue;

        const lower = stripped.toLowerCase();
        const dotIdx = lower.lastIndexOf('.');
        const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';
        if (!RELEVANT_EXTENSIONS.has(ext)) continue;

        const kind = classifyDitaFileKind(stripped);
        if (kind === 'image') {
          const buf = await file.arrayBuffer();
          batch.push({
            path: stripped,
            content: arrayBufferToBase64(buf),
            encoding: 'base64',
          });
        } else {
          const text = await file.text();
          batch.push({
            path: stripped,
            content: text,
            encoding: 'utf8',
          });
        }
      }

      if (batch.length === 0) {
        setErrorMsg('所选文件夹中未找到 .dita / .ditamap / .bookmap / 图片文件。');
        return;
      }

      await onImportFolder(rootFolderName, batch);
      dialogRef.current?.close('ok');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog max-h-[calc(100vh-3rem)] w-[min(960px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-0 text-slate-900 shadow-2xl shadow-slate-900/15"
    >
      <div className="flex max-h-[calc(100vh-3rem)] flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold leading-tight text-slate-900">
              工作区
            </h2>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-slate-500">
              切换本地 DITA 项目，或初始化一个新的工作区
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="关闭对话框"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:min-h-[520px] md:flex-row">
          {/* Workspace rail */}
          <aside
            aria-label="最近工作区"
            className="flex max-h-[38vh] w-full shrink-0 flex-col border-b border-slate-100 bg-slate-50/70 md:max-h-none md:w-[288px] md:border-b-0 md:border-r"
          >
            <div className="flex items-center justify-between px-3 pb-1 pt-3">
              <span className="inline-flex items-baseline gap-1.5 text-[11px] font-semibold text-slate-500">
                最近工作区
                {recentWorkspaces.length > 0 ? (
                  <span className="text-[10px] font-medium tabular-nums text-slate-400">
                    {recentWorkspaces.length}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={!isApiMode || loadingWorkspaces}
                onClick={() => void onRefreshWorkspaces()}
                aria-label="刷新工作区列表"
                title="刷新工作区列表"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loadingWorkspaces ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {!isApiMode ? (
                <div className="mx-1 mt-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/60 px-3 py-4 text-center">
                  <p className="text-[11px] font-medium text-amber-900">离线模式</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-amber-800/80">
                    启动 @dita/api 后可在此切换、创建和导入本地工作区。
                  </p>
                </div>
              ) : loadingWorkspaces && recentWorkspaces.length === 0 ? (
                <div className="space-y-1.5 px-1 pt-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg bg-white/80 px-2.5 py-2.5">
                      <div className="h-2.5 w-24 animate-pulse rounded bg-slate-200/80" />
                      <div className="mt-2 h-2 w-40 animate-pulse rounded bg-slate-200/60" />
                    </div>
                  ))}
                </div>
              ) : recentWorkspaces.length === 0 ? (
                <div className="mx-1 mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-5 text-center">
                  <FolderOpen className="mx-auto h-5 w-5 text-slate-300" aria-hidden="true" />
                  <p className="mt-2 text-[11px] font-medium text-slate-600">暂无工作区记录</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                    在右侧新建一个空白项目，或打开 / 导入已有目录。
                  </p>
                </div>
              ) : (
                <ul className="space-y-1 pt-1">
                  {recentWorkspaces.map((ws) => {
                    const removable = !ws.isDefault && !ws.isCurrent;
                    return (
                      <li key={ws.path}>
                        <div
                          className={`group flex items-center gap-0.5 rounded-lg border px-1 py-1 transition-colors ${
                            ws.isCurrent
                              ? 'border-slate-200 bg-white shadow-xs'
                              : 'border-transparent hover:border-slate-200 hover:bg-white'
                          }`}
                        >
                          {ws.isCurrent ? (
                            <div
                              aria-current="true"
                              className="flex min-w-0 flex-1 items-start gap-2 px-1 py-0.5"
                            >
                              <WorkspaceRowBody ws={ws} isCurrent />
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || !ws.exists}
                              onClick={() => handleOpenRecent(ws.path)}
                              aria-label={`打开工作区 ${ws.name}`}
                              className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed"
                            >
                              <WorkspaceRowBody ws={ws} />
                            </button>
                          )}
                          {removable ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleForget(ws.path)}
                              aria-label={`从最近列表移除 ${ws.name}`}
                              title="从列表隐藏，不会删除磁盘目录"
                              className="mr-0.5 rounded-md p-1 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 group-hover:opacity-100 disabled:opacity-0"
                            >
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 px-2 py-2">
              <p className="px-2 pb-1.5 text-[10px] leading-relaxed text-slate-500">
                切换工作区会重新载入地图、主题与语义索引。
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleOpenDefault}
                className="inline-flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                恢复内置示例项目
              </button>
            </div>
          </aside>

          {/* Main pane */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-4">
            <form onSubmit={handleCreateWorkspace}>
              <section aria-labelledby="ws-create-heading">
                <div className="flex items-baseline justify-between gap-3">
                  <h3
                    id="ws-create-heading"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-900"
                  >
                    <FolderPlus className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                    新建空白工作区
                  </h3>
                  <span className="text-[10.5px] text-slate-500">服务端自动创建 · 立即切换</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  服务端会自动创建标准 DITA 目录结构，创建完成后立即打开。
                </p>

                <div className="mt-3">
                  <label
                    htmlFor="ws-new-name"
                    className="mb-1 block text-[11px] font-medium text-slate-600"
                  >
                    工作区名称
                  </label>
                  <input
                    id="ws-new-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-dita-project"
                    disabled={!canWrite}
                    className={FIELD_CLASS}
                  />
                  <p className="mt-1 text-[10.5px] text-slate-500">目录名会自动规范化。</p>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-600">位置</span>
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => {
                        if (advancedParent) {
                          setParentDir(importsRootDir || defaultRootDir);
                          setAdvancedParent(false);
                        } else {
                          setAdvancedParent(true);
                        }
                      }}
                      aria-expanded={advancedParent}
                      aria-controls={advancedParent ? 'ws-advanced-parent' : undefined}
                      className="rounded text-[10.5px] font-medium text-indigo-600 transition-colors hover:text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-45"
                    >
                      {advancedParent ? '使用默认位置' : '更改'}
                    </button>
                  </div>
                  <div
                    className="truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[10.5px] text-slate-600"
                    title={createTargetDir}
                  >
                    {createTargetDir}
                  </div>

                  {advancedParent ? (
                    <div id="ws-advanced-parent" className="mt-2">
                      <label
                        htmlFor="ws-new-parent"
                        className="mb-1 block text-[10.5px] text-slate-500"
                      >
                        父目录（服务端路径）
                      </label>
                      <input
                        id="ws-new-parent"
                        type="text"
                        value={parentDir}
                        onChange={(e) => setParentDir(e.target.value)}
                        placeholder={importsRootDir || defaultRootDir}
                        title={baseParentDir}
                        disabled={!canWrite}
                        className={`${FIELD_CLASS} truncate font-mono text-[11px]`}
                      />
                      <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                        仅管理员 / 开发者需要修改；路径指向运行 @dita/api 的机器。
                      </p>
                    </div>
                  ) : null}
                </div>

                <fieldset className="mt-3" disabled={!canWrite}>
                  <legend className="mb-1.5 block text-[11px] font-medium text-slate-600">
                    初始化方式
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SCAFFOLD_OPTIONS.map((option) => {
                      const selected = scaffold === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors focus-within:ring-2 focus-within:ring-indigo-500/30 ${
                            selected
                              ? 'border-indigo-400 bg-indigo-50/50'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                          } ${!canWrite ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="radio"
                            name="ws-scaffold"
                            value={option.value}
                            checked={selected}
                            onChange={() => setScaffold(option.value)}
                            disabled={!canWrite}
                            className="sr-only"
                          />
                          <span
                            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ${
                              selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {option.value === 'starter' ? (
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <FolderPlus className="h-3 w-3" aria-hidden="true" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11.5px] font-semibold text-slate-800">
                              {option.label}
                            </span>
                            <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-500">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={!canWrite || !projectName.trim()}
                    className={PRIMARY_BTN}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    创建并打开
                  </button>
                </div>
              </section>
            </form>

            <div className="my-4 h-px bg-slate-100" />

            <section aria-labelledby="ws-open-heading">
              <h3
                id="ws-open-heading"
                className="text-[13px] font-semibold text-slate-900"
              >
                打开项目
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                导入会复制一份到服务端工作区；也可以直接打开服务端已有的目录。
              </p>

              <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-indigo-600 shadow-xs ring-1 ring-slate-200/70">
                  <FolderUp className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold text-slate-800">从本地导入整个文件夹</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-slate-500">
                    保留子目录 · .dita / .ditamap / .bookmap / 图片资源
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => folderInputRef.current?.click()}
                  className={`${SECONDARY_BTN} shrink-0`}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FolderUp className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  选择文件夹
                </button>
                <input
                  ref={folderInputRef}
                  type="file"
                  {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                  multiple
                  onChange={handleFolderPicked}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setAdvancedPath((v) => !v)}
                  aria-expanded={advancedPath}
                  aria-controls={advancedPath ? 'ws-open-advanced' : undefined}
                  className="inline-flex items-center gap-1 rounded text-[10.5px] font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                >
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${advancedPath ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  高级：打开服务端已有目录
                </button>

                {advancedPath ? (
                  <form
                    id="ws-open-advanced"
                    onSubmit={handleOpenPath}
                    className="mt-2 flex items-center gap-2"
                  >
                    <label htmlFor="ws-dir-input" className="sr-only">
                      服务端项目目录绝对路径
                    </label>
                    <input
                      id="ws-dir-input"
                      type="text"
                      value={dirInput}
                      onChange={(e) => setDirInput(e.target.value)}
                      placeholder={defaultRootDir}
                      title={dirInput}
                      disabled={!canWrite}
                      className={`${FIELD_CLASS} min-w-0 flex-1 truncate font-mono text-[11px]`}
                    />
                    <button
                      type="submit"
                      disabled={!canWrite || !dirInput.trim()}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      打开
                    </button>
                  </form>
                ) : null}
              </div>
            </section>

            {errorMsg ? (
              <div
                ref={errorRef}
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"
              >
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500"
                  aria-hidden="true"
                />
                <p className="min-w-0 flex-1 break-words text-[11px] leading-relaxed text-rose-800">
                  {errorMsg}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function WorkspaceRowBody({ ws, isCurrent = false }: { ws: WorkspaceListItem; isCurrent?: boolean }) {
  return (
    <>
      <FolderOpen
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          !ws.exists ? 'text-slate-300' : isCurrent ? 'text-emerald-600' : 'text-amber-500'
        }`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-slate-800">{ws.name}</span>
          {isCurrent ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-600/15">
              当前
            </span>
          ) : ws.isDefault ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[9px] font-medium text-slate-500">
              内置
            </span>
          ) : ws.unregistered ? (
            <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-medium text-amber-700 ring-1 ring-amber-600/15">
              未登记
            </span>
          ) : null}
          {!ws.exists ? (
            <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-px text-[9px] font-medium text-rose-600">
              目录缺失
            </span>
          ) : null}
        </span>
        <span
          className="mt-0.5 block truncate font-mono text-[9.5px] leading-tight text-slate-500"
          title={ws.path}
        >
          {ws.path}
        </span>
        {ws.unregistered ? (
          <span className="mt-0.5 block text-[9.5px] leading-tight text-slate-500">
            打开后加入最近列表
          </span>
        ) : formatRelativeTime(ws.lastOpenedAt) ? (
          <span className="mt-0.5 block text-[9.5px] leading-tight text-slate-500">
            {formatRelativeTime(ws.lastOpenedAt)}
          </span>
        ) : null}
      </span>
    </>
  );
}
