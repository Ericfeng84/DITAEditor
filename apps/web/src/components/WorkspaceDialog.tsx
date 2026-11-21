import { useEffect, useId, useRef, useState } from 'react';
import { classifyDitaFileKind } from '@dita/core';
import { FolderOpen, FolderUp, RotateCcw, Server, X } from 'lucide-react';

export interface WorkspaceDialogProps {
  open: boolean;
  workspaceMode: 'api' | 'memory';
  rootDir: string;
  defaultRootDir: string;
  onClose: () => void;
  onOpenLocalDir: (target: { rootDir: string } | { useDefault: true }) => Promise<void>;
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

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function WorkspaceDialog({
  open,
  workspaceMode,
  rootDir,
  defaultRootDir,
  onClose,
  onOpenLocalDir,
  onImportFolder,
  onRestoreOfflineDemo,
}: WorkspaceDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const [dirInput, setDirInput] = useState(rootDir);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      setDirInput(workspaceMode === 'api' ? rootDir : '');
      setErrorMsg(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, rootDir, workspaceMode]);

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

  const handleOpenPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirInput.trim()) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await onOpenLocalDir({ rootDir: dirInput.trim() });
      dialogRef.current?.close('ok');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDefault = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await onOpenLocalDir({ useDefault: true });
      dialogRef.current?.close('ok');
    } catch {
      onRestoreOfflineDemo();
      dialogRef.current?.close('ok');
    } finally {
      setBusy(false);
    }
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
        setBusy(false);
        e.target.value = '';
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
      className="dita-dialog w-full max-w-lg rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 id={titleId} className="inline-flex items-center gap-2 text-sm font-semibold">
            <Server className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <span>工作区与本地 DITA 项目管理</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            连接本地目录或一键导入完整 DITA 1.3 多文件项目（支持 50+ Topic 与嵌套子地图）
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="关闭对话框"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-4 p-5 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">当前工作区状态</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                workspaceMode === 'api'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {workspaceMode === 'api' ? 'Fastify 本地磁盘同步' : '浏览器内存离线模式'}
            </span>
          </div>
          <div className="mt-1.5 break-all font-mono text-[11px] text-slate-600">{rootDir}</div>
        </div>

        {/* Open local directory path on API server */}
        <form onSubmit={handleOpenPath} className="space-y-2">
          <label htmlFor="ws-dir-input" className="block font-medium text-slate-700">
            打开本机项目目录路径（需启动 @dita/api）
          </label>
          <div className="flex items-center gap-2">
            <input
              id="ws-dir-input"
              type="text"
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              placeholder={defaultRootDir}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !dirInput.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
              打开目录
            </button>
          </div>
        </form>

        {/* Browser Folder Upload Import */}
        <div className="rounded-lg border border-dashed border-indigo-200 bg-indigo-50/40 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-indigo-950">从本地选择整个项目文件夹导入</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                自动保留子目录结构、.ditamap / .bookmap / .dita 与图片资源
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              <FolderUp className="h-3.5 w-3.5" aria-hidden="true" />
              选择文件夹…
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
        </div>

        {errorMsg ? (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            {errorMsg}
          </p>
        ) : null}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleOpenDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            恢复内置多 Map 示例项目
          </button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
      </div>
    </dialog>
  );
}
