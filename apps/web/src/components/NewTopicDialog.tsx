import { useEffect, useId, useRef, useState } from 'react';
import type { DitaTopicTemplateType } from '@dita/core';
import { BookOpen, FileCode, ListChecks, Network, TableProperties, X } from 'lucide-react';

export interface NewTopicMountContext {
  mapPath: string;
  parentLabel: string;
  defaultDir: string;
  defaultTagName: string;
  isBookmap: boolean;
}

export interface NewTopicDialogProps {
  open: boolean;
  mountContext?: NewTopicMountContext | null;
  directories?: string[];
  onClose: () => void;
  onCreate: (
    type: DitaTopicTemplateType,
    id: string,
    title: string,
    lang: string,
    targetDir: string,
    mountTagName: string,
  ) => void;
}

const TOPIC_OPTIONS: {
  type: DitaTopicTemplateType;
  label: string;
  subtitle: string;
  desc: string;
  icon: typeof BookOpen;
}[] = [
  {
    type: 'concept',
    label: 'Concept 概念',
    subtitle: '<concept>',
    desc: '解释原理、架构背景与核心定义（含 conbody / section）',
    icon: BookOpen,
  },
  {
    type: 'task',
    label: 'Task 任务',
    subtitle: '<task>',
    desc: '操作步骤指南（含 prereq / steps / step / cmd / result）',
    icon: ListChecks,
  },
  {
    type: 'reference',
    label: 'Reference 参考',
    subtitle: '<reference>',
    desc: 'API 参数、配置规格与结构化表格（含 refbody / simpletable）',
    icon: TableProperties,
  },
  {
    type: 'topic',
    label: 'Topic 通用',
    subtitle: '<topic>',
    desc: '标准基础 DITA 主题文档',
    icon: FileCode,
  },
];

const DEFAULT_DIR_FOR_TYPE: Record<DitaTopicTemplateType, string> = {
  concept: 'concepts',
  task: 'tasks',
  reference: 'references',
  topic: 'topics',
};

export function NewTopicDialog({
  open,
  mountContext,
  directories = ['', 'concepts', 'tasks', 'references', 'topics'],
  onClose,
  onCreate,
}: NewTopicDialogProps) {
  const titleId = useId();
  const dirListId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [topicType, setTopicType] = useState<DitaTopicTemplateType>('concept');
  const [docId, setDocId] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [lang, setLang] = useState('zh-CN');
  const [targetDir, setTargetDir] = useState('concepts');
  const [mountTagName, setMountTagName] = useState('topicref');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setTopicType('concept');
      setDocId(`concept_${Date.now().toString(36).slice(-4)}`);
      setDocTitle('');
      setLang('zh-CN');
      setTargetDir(mountContext?.defaultDir ?? 'concepts');
      setMountTagName(mountContext?.defaultTagName ?? 'topicref');
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open, mountContext]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };
    dialog.addEventListener('close', handleClose);

    let cleanupBackdrop: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (ev: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          ev.clientX < r.left ||
          ev.clientX > r.right ||
          ev.clientY < r.top ||
          ev.clientY > r.bottom
        );
      };
      const onDown = (ev: PointerEvent) => {
        pressedOutside = isOutside(ev);
      };
      const onUp = (ev: PointerEvent) => {
        if (pressedOutside && isOutside(ev) && dialog.open) {
          dialog.close();
        }
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupBackdrop?.();
    };
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(
      topicType,
      docId || `${topicType}_new`,
      docTitle || `新建 ${topicType} 文档`,
      lang,
      targetDir,
      mountTagName,
    );
    dialogRef.current?.close('create');
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
          <h2 id={titleId} className="text-sm font-semibold text-slate-900">
            {mountContext ? '新建 Topic 并挂载到 Map' : '新建标准 DITA 1.3 文档'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {mountContext
              ? `将在 ${mountContext.mapPath}（${mountContext.parentLabel}）下自动写入相对 href`
              : '自动生成带 OASIS DOCTYPE 与标准内容骨架的 .dita 文件'}
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

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        {mountContext ? (
          <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 text-xs text-sky-900">
            <Network className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
            <span className="truncate">
              挂载目标：<code className="font-mono font-semibold">{mountContext.parentLabel}</code>
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          {TOPIC_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = topicType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  setTopicType(opt.type);
                  setDocId(`${opt.type}_${Date.now().toString(36).slice(-4)}`);
                  if (!mountContext) {
                    setTargetDir(DEFAULT_DIR_FOR_TYPE[opt.type]);
                  }
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? 'border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Icon className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
                    {opt.label}
                  </span>
                  <code className="font-mono text-[10px] text-slate-500">{opt.subtitle}</code>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="new-topic-title" className="mb-1 block text-xs font-medium text-slate-700">
              文档标题 (&lt;title&gt;)
            </label>
            <input
              id="new-topic-title"
              type="text"
              autoFocus
              required
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="例如：配置 DITA-OT 中文 PDF 字体映射"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="new-topic-id" className="mb-1 block text-xs font-medium text-slate-700">
                Topic ID / 文件名
              </label>
              <input
                id="new-topic-id"
                type="text"
                required
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                placeholder="e.g. task_setup_fonts"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-topic-lang" className="mb-1 block text-xs font-medium text-slate-700">
                语言 (xml:lang)
              </label>
              <select
                id="new-topic-lang"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="zh-CN">zh-CN</option>
                <option value="en-US">en-US</option>
                <option value="ja-JP">ja-JP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-topic-dir" className="mb-1 block text-xs font-medium text-slate-700">
                保存目录（工作区相对路径）
              </label>
              <input
                id="new-topic-dir"
                type="text"
                list={dirListId}
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                placeholder="例如：concepts（留空放根目录）"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id={dirListId}>
                {directories
                  .filter(Boolean)
                  .map((d) => (
                    <option key={d} value={d} />
                  ))}
              </datalist>
            </div>

            {mountContext ? (
              <div>
                <label htmlFor="new-topic-mount-tag" className="mb-1 block text-xs font-medium text-slate-700">
                  Map 挂载标签
                </label>
                <select
                  id="new-topic-mount-tag"
                  value={mountTagName}
                  onChange={(e) => setMountTagName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="topicref">&lt;topicref&gt;</option>
                  {mountContext.isBookmap ? (
                    <>
                      <option value="chapter">&lt;chapter&gt;</option>
                      <option value="appendix">&lt;appendix&gt;</option>
                      <option value="preface">&lt;preface&gt;</option>
                    </>
                  ) : null}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            {mountContext ? '创建并挂载' : '创建并打开'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
