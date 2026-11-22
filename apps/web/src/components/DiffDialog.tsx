import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { GitFileDiff } from '../services/git-api';
import { DiffViewer } from './DiffViewer';
import { useI18n } from '../i18n/index.js';

/** Git revisions are 40-char SHAs; keep the dialog labels scannable. */
function revisionLabel(revision: string): string {
  const parentMarker = revision.endsWith('~1') ? '~1' : '';
  const hash = parentMarker ? revision.slice(0, -parentMarker.length) : revision;
  return `${hash.slice(0, 7)}${parentMarker}`;
}

export interface DiffDialogProps {
  open: boolean;
  diff: GitFileDiff | null;
  loading: boolean;
  onClose: () => void;
}

export function DiffDialog({ open, diff, loading, onClose }: DiffDialogProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('diff.aria')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ${
          expanded ? 'h-[94vh] w-[min(1280px,96vw)]' : 'h-[70vh] w-[min(960px,88vw)]'
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">{t('diff.title', { path: diff?.path ?? t('diff.loadingShort') })}</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {diff
                ? t('diff.summary', {
                    additions: diff.additions,
                    deletions: diff.deletions,
                    binary: diff.binary ? t('diff.binarySuffix') : '',
                    from: revisionLabel(diff.fromLabel),
                    to: revisionLabel(diff.toLabel),
                  })
                : t('diff.readingRevisions')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              aria-label={expanded ? t('diff.restoreAria') : t('diff.expandAria')}
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              aria-label={t('diff.closeAria')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3">
          {loading || !diff ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              {t('diff.computing')}
            </div>
          ) : diff.binary ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
              {t('diff.binaryBody')}
            </div>
          ) : (
            <DiffViewer
              oldText={diff.oldText}
              newText={diff.newText}
              fromLabel={diff.fromLabel}
              toLabel={diff.toLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
