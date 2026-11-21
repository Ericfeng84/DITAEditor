import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  areConrefTagsCompatible,
  computeRelativeDitaHref,
  type IndexedTopicElement,
  type KeyspaceResult,
  type ResolvedConrefResult,
  type TopicIdIndexEntry,
} from '@dita/core';
import { AlertTriangle, CheckCircle2, CopyPlus, Search, X } from 'lucide-react';

export interface InsertConrefDialogProps {
  open: boolean;
  activeDocPath: string | null;
  selectedElementTag: string | null;
  selectedTopicId?: string;
  selectedElementId?: string;
  keyspace: KeyspaceResult | null;
  topicIndices: TopicIdIndexEntry[];
  onResolvePreview: (params: {
    sourceFilePath: string;
    sourceTagName: string;
    attrName: 'conref' | 'conkeyref';
    rawValue: string;
    sourceTopicId?: string;
    sourceElementId?: string;
  }) => Promise<ResolvedConrefResult>;
  onClose: () => void;
  onConfirm: (options: {
    action: 'insert-new' | 'bind-selected';
    tagName: string;
    attrName: 'conref' | 'conkeyref';
    value: string;
  }) => void;
}

export function InsertConrefDialog({
  open,
  activeDocPath,
  selectedElementTag,
  selectedTopicId,
  selectedElementId,
  keyspace,
  topicIndices,
  onResolvePreview,
  onClose,
  onConfirm,
}: InsertConrefDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const [mode, setMode] = useState<'conkeyref' | 'conref'>('conkeyref');
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<IndexedTopicElement | null>(null);
  const [insertAction, setInsertAction] = useState<'insert-new' | 'bind-selected'>('insert-new');
  const [preview, setPreview] = useState<ResolvedConrefResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const keyBoundTopics = useMemo(() => {
    if (!keyspace) return [];
    return Object.values(keyspace.keys)
      .filter((k) => Boolean(k.resolvedHref && !k.isExternal))
      .sort((a, b) => a.qualifiedKey.localeCompare(b.qualifiedKey));
  }, [keyspace]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      const hasKeys = keyBoundTopics.length > 0;
      setMode(hasKeys ? 'conkeyref' : 'conref');
      const firstKey = keyBoundTopics[0];
      setSelectedKey(firstKey?.qualifiedKey ?? '');
      const defaultTopic =
        firstKey?.resolvedHref ??
        topicIndices.find((t) => t.filePath !== activeDocPath)?.filePath ??
        topicIndices[0]?.filePath ??
        '';
      setSelectedFile(defaultTopic);
      setIdSearch('');
      setSelectedTarget(null);
      setInsertAction('insert-new');
      setPreview(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, keyBoundTopics, topicIndices, activeDocPath]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCloseEvt = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', onCloseEvt);
    return () => dialog.removeEventListener('close', onCloseEvt);
  }, [onClose]);

  const effectiveTopicFile = useMemo(() => {
    if (mode === 'conkeyref') {
      return keyBoundTopics.find((k) => k.qualifiedKey === selectedKey)?.resolvedHref ?? '';
    }
    return selectedFile;
  }, [mode, keyBoundTopics, selectedKey, selectedFile]);

  const candidateElements = useMemo(() => {
    const entry = topicIndices.find((t) => t.filePath === effectiveTopicFile);
    if (!entry) return [];
    const q = idSearch.trim().toLowerCase();
    return entry.elements.filter((el) => {
      if (el.isTopicRoot) return false;
      if (!q) return true;
      return (
        el.elementId.toLowerCase().includes(q) ||
        el.tagName.toLowerCase().includes(q) ||
        el.previewText.toLowerCase().includes(q)
      );
    });
  }, [topicIndices, effectiveTopicFile, idSearch]);

  const computedAttrValue = useMemo(() => {
    if (!selectedTarget) return '';
    if (mode === 'conkeyref') {
      return selectedKey ? `${selectedKey}/${selectedTarget.elementId}` : '';
    }
    if (!activeDocPath) return `${selectedTarget.filePath}#${selectedTarget.fragment}`;
    const rel =
      selectedTarget.filePath === activeDocPath
        ? ''
        : computeRelativeDitaHref(activeDocPath, selectedTarget.filePath);
    return `${rel}#${selectedTarget.fragment}`;
  }, [mode, selectedKey, selectedTarget, activeDocPath]);

  const canBindToSelected = Boolean(
    selectedElementTag &&
      selectedTarget &&
      areConrefTagsCompatible(selectedElementTag, selectedTarget.tagName),
  );

  // Trigger live cycle + preview check whenever target selection changes
  useEffect(() => {
    if (!open || !selectedTarget || !activeDocPath || !computedAttrValue) {
      setPreview(null);
      return;
    }

    const effectiveSourceTag =
      insertAction === 'bind-selected' && selectedElementTag
        ? selectedElementTag
        : selectedTarget.tagName;

    let cancelled = false;
    setLoadingPreview(true);
    void onResolvePreview({
      sourceFilePath: activeDocPath,
      sourceTagName: effectiveSourceTag,
      attrName: mode,
      rawValue: computedAttrValue,
      sourceTopicId: selectedTopicId,
      sourceElementId: insertAction === 'bind-selected' ? selectedElementId : undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setPreview(res);
          setLoadingPreview(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    selectedTarget,
    activeDocPath,
    computedAttrValue,
    insertAction,
    selectedElementTag,
    selectedTopicId,
    selectedElementId,
    mode,
    onResolvePreview,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget || !computedAttrValue) return;
    if (preview?.status === 'cycle') return;

    const finalAction =
      insertAction === 'bind-selected' && canBindToSelected ? 'bind-selected' : 'insert-new';
    const tagName =
      finalAction === 'bind-selected' && selectedElementTag
        ? selectedElementTag
        : selectedTarget.tagName;

    onConfirm({
      action: finalAction,
      tagName,
      attrName: mode,
      value: computedAttrValue,
    });
    dialogRef.current?.close('ok');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="dita-dialog w-full max-w-xl rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 id={titleId} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CopyPlus className="h-4 w-4 text-teal-600" aria-hidden="true" />
          插入内容复用 (Conref / Conkeyref)
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
        {/* Reference Mode */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('conkeyref');
              setSelectedTarget(null);
            }}
            className={`flex-1 rounded-lg border px-3 py-1.5 font-medium transition-colors ${
              mode === 'conkeyref'
                ? 'border-teal-500 bg-teal-50 text-teal-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <code>conkeyref</code>（推荐：解耦路径，基于 Key）
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('conref');
              setSelectedTarget(null);
            }}
            className={`flex-1 rounded-lg border px-3 py-1.5 font-medium transition-colors ${
              mode === 'conref'
                ? 'border-teal-500 bg-teal-50 text-teal-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <code>conref</code>（相对路径直接引用）
          </button>
        </div>

        {/* Target Source Picker */}
        {mode === 'conkeyref' ? (
          <div>
            <label htmlFor="conref-key-select" className="mb-1 block font-medium text-slate-700">
              1. 选择绑定了目标 Topic 的 Key
            </label>
            <select
              id="conref-key-select"
              value={selectedKey}
              onChange={(e) => {
                setSelectedKey(e.target.value);
                setSelectedTarget(null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-teal-500 focus:outline-none"
            >
              {keyBoundTopics.length === 0 ? (
                <option value="">当前 Root Map 暂无绑定文件的 Key（请切换为 conref 或添加 keydef）</option>
              ) : (
                keyBoundTopics.map((k) => (
                  <option key={k.qualifiedKey} value={k.qualifiedKey}>
                    {k.qualifiedKey} → {k.resolvedHref}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="conref-file-select" className="mb-1 block font-medium text-slate-700">
              1. 选择源 Topic 文件
            </label>
            <select
              id="conref-file-select"
              value={selectedFile}
              onChange={(e) => {
                setSelectedFile(e.target.value);
                setSelectedTarget(null);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-teal-500 focus:outline-none"
            >
              {topicIndices.map((t) => (
                <option key={t.filePath} value={t.filePath}>
                  {t.filePath} {t.title ? `— ${t.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Element ID Picker */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="conref-id-search" className="font-medium text-slate-700">
              2. 选择带 <code>id</code> 的可复用元素
            </label>
            <span className="font-mono text-[10.5px] text-slate-400">
              {candidateElements.length} 个候选元素
            </span>
          </div>
          <div className="relative mb-1.5">
            <Search
              className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="conref-id-search"
              type="search"
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
              placeholder="搜索元素 ID、标签名或文本内容…"
              className="w-full rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="dita-scroller max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {candidateElements.length === 0 ? (
              <p className="p-4 text-center text-slate-400">所选文件中没有带 id 属性的可复用子元素。</p>
            ) : (
              candidateElements.map((el) => {
                const isPicked = selectedTarget?.fragment === el.fragment && selectedTarget.filePath === el.filePath;
                const compatWithSelected =
                  !selectedElementTag || areConrefTagsCompatible(selectedElementTag, el.tagName);

                return (
                  <button
                    key={`${el.filePath}#${el.fragment}`}
                    type="button"
                    onClick={() => setSelectedTarget(el)}
                    className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors ${
                      isPicked ? 'bg-teal-50 text-teal-950' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <code className="rounded bg-slate-200/80 px-1 py-0.2 font-mono text-[10.5px] font-semibold text-slate-800">
                          &lt;{el.tagName}&gt;
                        </code>
                        <code className="font-mono font-semibold text-teal-800">
                          #{el.elementId}
                        </code>
                        {selectedElementTag && !compatWithSelected ? (
                          <span className="rounded bg-amber-100 px-1 py-0.2 text-[9.5px] text-amber-800">
                            与当前 &lt;{selectedElementTag}&gt; 不兼容
                          </span>
                        ) : null}
                      </div>
                      {el.previewText ? (
                        <p className="mt-0.5 truncate text-[11px] text-slate-600">{el.previewText}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      L{el.line}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Insertion mode & Live Preview */}
        {selectedTarget ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-700">
                {mode}=&quot;{computedAttrValue}&quot;
              </span>
              {selectedElementTag ? (
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="conref-action"
                      checked={insertAction === 'insert-new'}
                      onChange={() => setInsertAction('insert-new')}
                    />
                    <span>新建 &lt;{selectedTarget.tagName}&gt;</span>
                  </label>
                  <label
                    className={`inline-flex items-center gap-1 ${
                      canBindToSelected ? 'cursor-pointer' : 'opacity-45 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="radio"
                      name="conref-action"
                      disabled={!canBindToSelected}
                      checked={insertAction === 'bind-selected'}
                      onChange={() => setInsertAction('bind-selected')}
                    />
                    <span>绑定到当前 &lt;{selectedElementTag}&gt;</span>
                  </label>
                </div>
              ) : null}
            </div>

            {loadingPreview ? (
              <p className="text-[11px] text-slate-400">正在校验循环引用并加载预览…</p>
            ) : preview ? (
              preview.status === 'resolved' ? (
                <div className="rounded border border-emerald-200 bg-white p-2 text-[11px] text-slate-700">
                  <div className="mb-1 flex items-center gap-1 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>可安全复用（无循环引用）</span>
                  </div>
                  <p className="line-clamp-3 text-slate-700">{preview.resolvedText || '(空内容)'}</p>
                </div>
              ) : (
                <div className="rounded border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800">
                  <div className="flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                    <span>{preview.errorMessage}</span>
                  </div>
                  {preview.cycleChain ? (
                    <p className="mt-1 font-mono text-[10px] text-rose-700">
                      {preview.cycleChain.join(' → ')}
                    </p>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}

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
            disabled={!selectedTarget || !computedAttrValue || preview?.status === 'cycle'}
            className="rounded-lg bg-teal-600 px-4 py-1.5 font-semibold text-white hover:bg-teal-500 disabled:opacity-45"
          >
            确认复用
          </button>
        </div>
      </form>
    </dialog>
  );
}
