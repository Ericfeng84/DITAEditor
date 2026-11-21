import { useEffect, useId, useRef, useState } from 'react';
import type { DitaMapTemplateType } from '@dita/core';
import { BookMarked, Network, X } from 'lucide-react';

export interface NewMapDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (options: {
    kind: DitaMapTemplateType;
    fileName: string;
    id: string;
    title: string;
    lang: string;
    targetDir: string;
  }) => void;
}

export function NewMapDialog({ open, onClose, onCreate }: NewMapDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [kind, setKind] = useState<DitaMapTemplateType>('map');
  const [fileName, setFileName] = useState('');
  const [mapId, setMapId] = useState('');
  const [title, setTitle] = useState('');
  const [lang, setLang] = useState('zh-CN');
  const [targetDir, setTargetDir] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const slug = `map_${Date.now().toString(36).slice(-4)}`;
      setKind('map');
      setFileName(`${slug}.ditamap`);
      setMapId(slug);
      setTitle('');
      setLang('zh-CN');
      setTargetDir('');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      kind,
      fileName: fileName || `${mapId || 'manual'}.${kind === 'bookmap' ? 'bookmap' : 'ditamap'}`,
      id: mapId || 'dita_map',
      title: title || (kind === 'bookmap' ? '新建产品技术手册' : '新建 DITA Map'),
      lang,
      targetDir,
    });
    dialogRef.current?.close('ok');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            新建 DITA Map / Bookmap
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            创建标准结构化地图并设为当前激活 Root Map
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

      <form onSubmit={handleSubmit} className="space-y-3.5 p-5 text-xs">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setKind('map');
              setFileName((prev) => prev.replace(/\.bookmap$/, '.ditamap'));
            }}
            className={`rounded-lg border p-3 text-left ${
              kind === 'map'
                ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <Network className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              <span>标准 Map</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">.ditamap 通用层次目录与子地图</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setKind('bookmap');
              setFileName((prev) => prev.replace(/\.ditamap$/, '.bookmap'));
            }}
            className={`rounded-lg border p-3 text-left ${
              kind === 'bookmap'
                ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <BookMarked className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
              <span>Bookmap 书籍</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">.bookmap 含前言、篇/章、附录</p>
          </button>
        </div>

        <div>
          <label htmlFor="new-map-title" className="mb-1 block font-medium text-slate-700">
            Map 标题
          </label>
          <input
            id="new-map-title"
            type="text"
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：产品部署与运维手册"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-map-file" className="mb-1 block font-medium text-slate-700">
              文件名
            </label>
            <input
              id="new-map-file"
              type="text"
              required
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-map-dir" className="mb-1 block font-medium text-slate-700">
              所在目录（可选）
            </label>
            <input
              id="new-map-dir"
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder="留空放根目录，或 maps"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-map-id" className="mb-1 block font-medium text-slate-700">
              根元素 ID
            </label>
            <input
              id="new-map-id"
              type="text"
              required
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-map-lang" className="mb-1 block font-medium text-slate-700">
              语言 (xml:lang)
            </label>
            <select
              id="new-map-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono focus:border-indigo-500 focus:outline-none"
            >
              <option value="zh-CN">zh-CN</option>
              <option value="en-US">en-US</option>
              <option value="ja-JP">ja-JP</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 font-semibold text-white hover:bg-indigo-500"
          >
            创建 Map
          </button>
        </div>
      </form>
    </dialog>
  );
}
