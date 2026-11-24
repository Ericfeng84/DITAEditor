import { useEffect, useId, useRef, useState } from 'react';
import type { DitaTopicTemplateType } from '@dita/core';
import { BookOpen, FileCode, ListChecks, Network, TableProperties, X } from 'lucide-react';
import { useI18n, type MessageKey } from '../i18n/index.js';
import { TopicStructurePreview } from './TopicAuthoringGuide';

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
  labelKey: MessageKey;
  subtitle: string;
  descKey: MessageKey;
  icon: typeof BookOpen;
}[] = [
  {
    type: 'concept',
    labelKey: 'newTopic.concept.label',
    subtitle: '<concept>',
    descKey: 'newTopic.concept.desc',
    icon: BookOpen,
  },
  {
    type: 'task',
    labelKey: 'newTopic.task.label',
    subtitle: '<task>',
    descKey: 'newTopic.task.desc',
    icon: ListChecks,
  },
  {
    type: 'reference',
    labelKey: 'newTopic.reference.label',
    subtitle: '<reference>',
    descKey: 'newTopic.reference.desc',
    icon: TableProperties,
  },
  {
    type: 'topic',
    labelKey: 'newTopic.topic.label',
    subtitle: '<topic>',
    descKey: 'newTopic.topic.desc',
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
  const { t, locale } = useI18n();
  const titleId = useId();
  const dirListId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [topicType, setTopicType] = useState<DitaTopicTemplateType>('concept');
  const [docId, setDocId] = useState('');
  const [docTitle, setDocTitle] = useState('');
  // The document language follows the UI language by default (still user-overridable).
  const defaultDocLang = locale === 'en' ? 'en-US' : 'zh-CN';
  const [lang, setLang] = useState(defaultDocLang);
  const [targetDir, setTargetDir] = useState('concepts');
  const [mountTagName, setMountTagName] = useState('topicref');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setTopicType('concept');
      setDocId(`concept_${Date.now().toString(36).slice(-4)}`);
      setDocTitle('');
      setLang(defaultDocLang);
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
      docTitle || t('newTopic.fallbackTitle', { type: topicType }),
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
            {mountContext ? t('newTopic.titleMount') : t('newTopic.title')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {mountContext
              ? t('newTopic.mountDesc', { mapPath: mountContext.mapPath, parent: mountContext.parentLabel })
              : t('newTopic.standardDesc')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('newTopic.closeAria')}
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
              {t('newTopic.mountTarget')} <code className="font-mono font-semibold">{mountContext.parentLabel}</code>
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
                    ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Icon className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                    {t(opt.labelKey)}
                  </span>
                  <code className="font-mono text-[10px] text-slate-500">{opt.subtitle}</code>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{t(opt.descKey)}</p>
              </button>
            );
          })}
        </div>

        <TopicStructurePreview type={topicType} />

        <div className="space-y-3">
          <div>
            <label htmlFor="new-topic-title" className="mb-1 block text-xs font-medium text-slate-700">
              {t('newTopic.docTitle')} (&lt;title&gt;)
            </label>
            <input
              id="new-topic-title"
              type="text"
              autoFocus
              required
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder={t('newTopic.titlePlaceholder')}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="new-topic-id" className="mb-1 block text-xs font-medium text-slate-700">
                {t('newTopic.idLabel')}
              </label>
              <input
                id="new-topic-id"
                type="text"
                required
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                placeholder="e.g. task_setup_fonts"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-topic-lang" className="mb-1 block text-xs font-medium text-slate-700">
                {t('newTopic.langLabel')}
              </label>
              <select
                id="new-topic-lang"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
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
                {t('newTopic.dirLabel')}
              </label>
              <input
                id="new-topic-dir"
                type="text"
                list={dirListId}
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                placeholder={t('newTopic.dirPlaceholder')}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
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
                  {t('newTopic.mountLabel')}
                </label>
                <select
                  id="new-topic-mount-tag"
                  value={mountTagName}
                  onChange={(e) => setMountTagName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
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
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {mountContext ? t('newTopic.submitMount') : t('newTopic.submit')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
