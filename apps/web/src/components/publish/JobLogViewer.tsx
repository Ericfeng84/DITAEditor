import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { streamPublishJobEvents } from '../../services/publish-api';
import { useI18n } from '../../i18n/index.js';

export interface JobLogViewerProps {
  jobId: string;
  status: string;
}

const MAX_LOG_CHARS = 200_000;

export function JobLogViewer({ jobId, status }: JobLogViewerProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const live = status === 'queued' || status === 'running';

  useEffect(() => {
    setText('');
    setError(null);
    const controller = new AbortController();
    const append = (chunk: string) => {
      setText((previous) => `${previous}${chunk}`.slice(-MAX_LOG_CHARS));
    };
    void streamPublishJobEvents(
      jobId,
      {
        onLog: (chunk) => {
          setError(null);
          append(chunk);
        },
      },
      controller.signal,
    ).catch((caught: unknown) => {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => controller.abort();
  }, [jobId]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [text]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-2.5 py-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          build.log
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          {live ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-sky-400" aria-hidden="true" />
              {t('jobLog.live')}
            </>
          ) : (
            t('jobLog.finished')
          )}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="dita-scroller min-h-0 flex-1 overflow-auto px-2.5 py-2 font-mono text-[10.5px] leading-[1.55] text-slate-200"
      >
        {text ? (
          <pre className="whitespace-pre-wrap break-words">{text}</pre>
        ) : (
          <p className="text-slate-500">
            {error ? t('jobLog.error', { error }) : t('jobLog.waiting')}
          </p>
        )}
      </div>
    </div>
  );
}
