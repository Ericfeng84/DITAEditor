import { useEffect, useId, useRef, useState } from 'react';
import type { RawAttrs } from '@dita/core';
import { Image as ImageIcon, Link2, X } from 'lucide-react';

export interface XrefImageDialogProps {
  mode: 'xref' | 'image' | null;
  onClose: () => void;
  onConfirmXref: (attrs: RawAttrs, linkText: string) => void;
  onConfirmImage: (attrs: RawAttrs, placement: 'inline' | 'break') => void;
}

export function XrefImageDialog({
  mode,
  onClose,
  onConfirmXref,
  onConfirmImage,
}: XrefImageDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [href, setHref] = useState('');
  const [keyref, setKeyref] = useState('');
  const [text, setText] = useState('');
  const [scope, setScope] = useState('local');
  const [format, setFormat] = useState('dita');
  const [placement, setPlacement] = useState<'break' | 'inline'>('break');
  const [alt, setAlt] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mode) {
      setHref(mode === 'xref' ? '../concepts/dita-architecture.dita' : '../images/architecture.svg');
      setKeyref('');
      setText(mode === 'xref' ? '参考文档' : '');
      setScope('local');
      setFormat('dita');
      setPlacement('break');
      setAlt('架构示意图');
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [mode]);

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
            placeholder={mode === 'xref' ? 'target.dita#topicId/elemId 或 https://...' : '../images/diagram.svg'}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

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
