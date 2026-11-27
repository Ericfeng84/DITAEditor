import { useEffect, useId, useRef, useState } from 'react';
import type { DitaMapTemplateType } from '@dita/core';
import { Network, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';

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
  const { t, locale } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapId, setMapId] = useState('');
  const [title, setTitle] = useState('');
  // The document language follows the UI language by default (still user-overridable).
  const defaultDocLang = locale === 'en' ? 'en-US' : 'zh-CN';
  const [lang, setLang] = useState(defaultDocLang);
  const [targetDir, setTargetDir] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const slug = `map_${Date.now().toString(36).slice(-4)}`;
      setFileName(`${slug}.ditamap`);
      setMapId(slug);
      setTitle('');
      setLang(defaultDocLang);
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
      kind: 'map',
      fileName: fileName || `${mapId || 'manual'}.ditamap`,
      id: mapId || 'dita_map',
      title: title || t('newMap.mapDefaultTitle'),
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
            {t('newMap.title')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('newMap.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('newMap.closeAria')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5 p-5 text-xs">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center gap-1.5 font-semibold">
            <Network className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            <span>{t('newMap.standard')}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{t('newMap.standardDesc')}</p>
        </div>

        <div>
          <label htmlFor="new-map-title" className="mb-1 block font-medium text-slate-700">
            {t('newMap.titleLabel')}
          </label>
          <input
            id="new-map-title"
            type="text"
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('newMap.titlePlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-map-file" className="mb-1 block font-medium text-slate-700">
              {t('newMap.fileName')}
            </label>
            <input
              id="new-map-file"
              type="text"
              required
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-map-dir" className="mb-1 block font-medium text-slate-700">
              {t('newMap.dirLabel')}
            </label>
            <input
              id="new-map-dir"
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder={t('newMap.dirPlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-map-id" className="mb-1 block font-medium text-slate-700">
              {t('newMap.rootId')}
            </label>
            <input
              id="new-map-id"
              type="text"
              required
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-map-lang" className="mb-1 block font-medium text-slate-700">
              {t('newMap.langLabel')}
            </label>
            <select
              id="new-map-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono focus:border-blue-500 focus:outline-none"
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
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700"
          >
            {t('newMap.submit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
