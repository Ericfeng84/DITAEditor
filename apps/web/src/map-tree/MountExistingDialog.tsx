import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { classifyDitaFileKind, computeRelativeDitaHref } from '@dita/core';
import { Link2, X } from 'lucide-react';
import { useI18n } from '../i18n/index.js';

export interface MountExistingDialogProps {
  open: boolean;
  mapPath: string;
  parentLabel: string;
  isBookmap: boolean;
  availableFiles: string[];
  topicTitles: Record<string, string>;
  onClose: () => void;
  onConfirm: (options: {
    targetFilePath: string;
    tagName: string;
    navtitle?: string;
  }) => void;
}

export function MountExistingDialog({
  open,
  mapPath,
  parentLabel,
  isBookmap,
  availableFiles,
  topicTitles,
  onClose,
  onConfirm,
}: MountExistingDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [tagName, setTagName] = useState('topicref');
  const [navtitle, setNavtitle] = useState('');

  const mountableFiles = useMemo(
    () => availableFiles.filter((p) => p !== mapPath),
    [availableFiles, mapPath],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const first = mountableFiles[0] ?? '';
      setSelectedFile(first);
      const kind = classifyDitaFileKind(first);
      setTagName(
        kind === 'ditamap' || kind === 'bookmap'
          ? 'mapref'
          : isBookmap
            ? 'chapter'
            : 'topicref',
      );
      setNavtitle(topicTitles[first] ?? '');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, mountableFiles, isBookmap, topicTitles]);

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

  const previewHref = selectedFile ? computeRelativeDitaHref(mapPath, selectedFile) : '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    onConfirm({
      targetFilePath: selectedFile,
      tagName,
      navtitle: navtitle.trim() || undefined,
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
        <div className="min-w-0">
          <h2 id={titleId} className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span>{t('mountDialog.title')}</span>
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {t('mountDialog.location', { parent: parentLabel, path: mapPath })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('common.close')}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 p-5 text-xs">
        <div>
          <label htmlFor="mount-file-select" className="mb-1 block font-medium text-slate-700">
            {t('mountDialog.pickFile')}
          </label>
          <select
            id="mount-file-select"
            value={selectedFile}
            onChange={(e) => {
              const path = e.target.value;
              setSelectedFile(path);
              const kind = classifyDitaFileKind(path);
              if (kind === 'ditamap' || kind === 'bookmap') {
                setTagName('mapref');
              } else if (tagName === 'mapref') {
                setTagName(isBookmap ? 'chapter' : 'topicref');
              }
              setNavtitle(topicTitles[path] ?? '');
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
          >
            {mountableFiles.map((f) => (
              <option key={f} value={f}>
                {f} {topicTitles[f] ? `— ${topicTitles[f]}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="mount-tag-select" className="mb-1 block font-medium text-slate-700">
              {t('mountDialog.refTag')}
            </label>
            <select
              id="mount-tag-select"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="topicref">&lt;topicref&gt;</option>
              <option value="mapref">&lt;mapref&gt;</option>
              {isBookmap ? (
                <>
                  <option value="chapter">&lt;chapter&gt;</option>
                  <option value="appendix">&lt;appendix&gt;</option>
                  <option value="preface">&lt;preface&gt;</option>
                </>
              ) : null}
            </select>
          </div>
          <div>
            <label htmlFor="mount-navtitle" className="mb-1 block font-medium text-slate-700">
              {t('mountDialog.navtitle')}
            </label>
            <input
              id="mount-navtitle"
              type="text"
              value={navtitle}
              onChange={(e) => setNavtitle(e.target.value)}
              placeholder={t('mountDialog.navtitlePlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
          {t('mountDialog.hrefPreview')}<span className="text-blue-700">{previewHref || '—'}</span>
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
            disabled={!selectedFile}
            className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {t('mountDialog.submit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
