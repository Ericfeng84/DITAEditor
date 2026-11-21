import { useEffect, useId, useRef, useState } from 'react';
import { computeRelativeDitaHref, type RawAttrs } from '@dita/core';
import { Image as ImageIcon, Link2, Upload, X } from 'lucide-react';
import type { UploadAssetResult } from '../services/workspace-api';

export interface XrefImageDialogProps {
  mode: 'xref' | 'image' | null;
  activeDocPath?: string | null;
  workspaceMode?: 'api' | 'memory';
  workspaceTopics?: string[];
  workspaceImages?: string[];
  topicTitles?: Record<string, string>;
  onUploadImage?: (
    file: File,
    targetDir: string,
    fromDocPath?: string,
  ) => Promise<UploadAssetResult>;
  resolvePreviewUrl?: (href: string) => string | null;
  onClose: () => void;
  onConfirmXref: (attrs: RawAttrs, linkText: string) => void;
  onConfirmImage: (attrs: RawAttrs, placement: 'inline' | 'break') => void;
}

export function XrefImageDialog({
  mode,
  activeDocPath,
  workspaceMode = 'memory',
  workspaceTopics = [],
  workspaceImages = [],
  topicTitles = {},
  onUploadImage,
  resolvePreviewUrl,
  onClose,
  onConfirmXref,
  onConfirmImage,
}: XrefImageDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [href, setHref] = useState('');
  const [keyref, setKeyref] = useState('');
  const [text, setText] = useState('');
  const [scope, setScope] = useState('local');
  const [format, setFormat] = useState('dita');
  const [placement, setPlacement] = useState<'break' | 'inline'>('break');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mode) {
      const defaultTopic = workspaceTopics.find((t) => t !== activeDocPath) ?? workspaceTopics[0];
      const defaultImage = workspaceImages[0];

      if (mode === 'xref') {
        const rel =
          defaultTopic && activeDocPath
            ? computeRelativeDitaHref(activeDocPath, defaultTopic)
            : '../concepts/dita-architecture.dita';
        setHref(rel);
        setText(defaultTopic && topicTitles[defaultTopic] ? topicTitles[defaultTopic]! : '参考文档');
      } else {
        const relImg =
          defaultImage && activeDocPath
            ? computeRelativeDitaHref(activeDocPath, defaultImage)
            : '../images/architecture.svg';
        setHref(relImg);
        setText('');
      }

      setKeyref('');
      setScope('local');
      setFormat('dita');
      setPlacement('break');
      setAlt('架构示意图');
      setUploadErr(null);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [mode, activeDocPath, workspaceTopics, workspaceImages, topicTitles]);

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

  const handleUploadPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);

    if (workspaceMode === 'api' && onUploadImage) {
      setUploading(true);
      try {
        const res = await onUploadImage(file, 'images', activeDocPath ?? undefined);
        setHref(res.relativeHref);
        if (!alt || alt === '架构示意图') {
          setAlt(file.name.replace(/\.[^.]+$/, ''));
        }
      } catch (err) {
        setUploadErr(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
        e.target.value = '';
      }
      return;
    }

    // Memory mode fallback: embed uploaded image as data URL
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setHref(reader.result);
        setAlt(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'xref') {
      const attrs: RawAttrs = [];
      if (href.trim()) attrs.push({ name: 'href', value: href.trim(), namespaceURI: null });
      if (keyref.trim()) attrs.push({ name: 'keyref', value: keyref.trim(), namespaceURI: null });
      if (scope) attrs.push({ name: 'scope', value: scope, namespaceURI: null });
      if (format) attrs.push({ name: 'format', value: format, namespaceURI: null });
      onConfirmXref(attrs, text.trim());
    } else if (mode === 'image') {
      const attrs: RawAttrs = [];
      if (href.trim()) attrs.push({ name: 'href', value: href.trim(), namespaceURI: null });
      if (keyref.trim()) attrs.push({ name: 'keyref', value: keyref.trim(), namespaceURI: null });
      attrs.push({ name: 'placement', value: placement, namespaceURI: null });
      if (alt.trim()) attrs.push({ name: 'alt', value: alt.trim(), namespaceURI: null });
      onConfirmImage(attrs, placement);
    }
    dialogRef.current?.close('ok');
  };

  const previewUrl =
    mode === 'image' && href.trim() ? (resolvePreviewUrl?.(href.trim()) ?? null) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-md rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 id={titleId} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          {mode === 'image' ? (
            <>
              <ImageIcon className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              插入图片 (&lt;image&gt;)
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              插入交叉引用 (&lt;xref&gt;)
            </>
          )}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="关闭对话框"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 p-5 text-xs">
        {/* Quick workspace picker + image upload */}
        {mode === 'image' ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-700">上传图片或从工作区选取</span>
              <button
                type="button"
                disabled={uploading}
                onClick={() => uploadInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Upload className="h-3 w-3" aria-hidden="true" />
                {uploading ? '上传中…' : '上传图片'}
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.avif"
                onChange={handleUploadPicked}
                className="hidden"
                aria-hidden="true"
              />
            </div>

            {workspaceImages.length > 0 ? (
              <select
                aria-label="选择工作区已有图片"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const rel = activeDocPath
                    ? computeRelativeDitaHref(activeDocPath, e.target.value)
                    : e.target.value;
                  setHref(rel);
                }}
                className="w-full rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
              >
                <option value="">从工作区 images/ 选择已有图片…</option>
                {workspaceImages.map((img) => (
                  <option key={img} value={img}>
                    {img}
                  </option>
                ))}
              </select>
            ) : null}

            {uploadErr ? <p className="text-[11px] text-rose-600">{uploadErr}</p> : null}
          </div>
        ) : workspaceTopics.length > 0 ? (
          <div>
            <label htmlFor="xref-ws-topic" className="mb-1 block font-medium text-slate-700">
              从工作区快速选择目标 Topic
            </label>
            <select
              id="xref-ws-topic"
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const rel = activeDocPath
                  ? computeRelativeDitaHref(activeDocPath, e.target.value)
                  : e.target.value;
                setHref(rel);
                if (topicTitles[e.target.value]) {
                  setText(topicTitles[e.target.value]!);
                }
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] focus:border-indigo-500 focus:outline-none"
            >
              <option value="">选择工作区 Topic 自动计算相对 href…</option>
              {workspaceTopics.map((t) => (
                <option key={t} value={t}>
                  {t} {topicTitles[t] ? `— ${topicTitles[t]}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="ref-href" className="mb-1 block font-medium text-slate-700">
            目标路径 (href)
          </label>
          <input
            id="ref-href"
            type="text"
            autoFocus
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder={
              mode === 'xref'
                ? 'target.dita#topicId/elemId 或 https://...'
                : '../images/diagram.svg'
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {previewUrl ? (
          <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-2">
            <img
              src={previewUrl}
              alt={alt || '图片预览'}
              className="max-h-28 max-w-full rounded object-contain"
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="ref-keyref" className="mb-1 block font-medium text-slate-700">
            或 Key 引用 (keyref，可选)
          </label>
          <input
            id="ref-keyref"
            type="text"
            value={keyref}
            onChange={(e) => setKeyref(e.target.value)}
            placeholder="例如：key_api_guide"
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {mode === 'xref' ? (
          <>
            <div>
              <label htmlFor="ref-text" className="mb-1 block font-medium text-slate-700">
                链接显示文本（若已选中文字将包裹所选内容）
              </label>
              <input
                id="ref-text"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="例如：查看架构说明"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ref-scope" className="mb-1 block font-medium text-slate-700">
                  scope
                </label>
                <select
                  id="ref-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="local">local</option>
                  <option value="peer">peer</option>
                  <option value="external">external</option>
                </select>
              </div>
              <div>
                <label htmlFor="ref-format" className="mb-1 block font-medium text-slate-700">
                  format
                </label>
                <select
                  id="ref-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="dita">dita</option>
                  <option value="html">html</option>
                  <option value="pdf">pdf</option>
                  <option value="ditamap">ditamap</option>
                </select>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="img-alt" className="mb-1 block font-medium text-slate-700">
                替代文本 (alt)
              </label>
              <input
                id="img-alt"
                type="text"
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="用于无障碍与图注说明"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="img-placement" className="mb-1 block font-medium text-slate-700">
                排版方式 (placement)
              </label>
              <select
                id="img-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value as 'break' | 'inline')}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
              >
                <option value="break">break（独立块级插图）</option>
                <option value="inline">inline（行内小图标）</option>
              </select>
            </div>
          </>
        )}

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
            确认插入
          </button>
        </div>
      </form>
    </dialog>
  );
}
