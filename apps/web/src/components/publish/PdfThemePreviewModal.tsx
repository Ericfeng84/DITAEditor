import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BookOpen, FileText, Loader2, Maximize2, Minimize2, RefreshCw, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import { getActiveScope } from '../../services/active-scope.js';
import { pdfThemePreviewUrl } from '../../services/publish-api';
import type { PdfThemeDescriptor } from '../../services/publish-api';
import { pdfThemeOptionsFromDraft } from './pdf-theme-model.js';
import type { PdfThemeDraft } from './pdf-theme-model.js';

type PreviewZoom = 'fit' | 'actual';
type PreviewStatus = 'loading' | 'ready' | 'error';

const PREVIEW_TIMEOUT_MS = 12_000;

/**
 * Paper-sheet preview for the PDF themes. The API renders a two-page sample (cover + body) as a
 * self-contained HTML document without invoking DITA-OT, so the dialog only has to feed the draft
 * through `pdfThemeOptionsFromDraft()` into the preview URL.
 */
export interface PdfThemePreviewModalProps {
  open: boolean;
  descriptor: PdfThemeDescriptor | null;
  draft: PdfThemeDraft;
  /** Every catalogue entry, so readers can compare themes without closing the dialog. */
  descriptors?: PdfThemeDescriptor[];
  onSelectTheme?: (descriptor: PdfThemeDescriptor) => void;
  onClose: () => void;
  onApply: (draft: PdfThemeDraft) => void;
}

export function PdfThemePreviewModal({
  open,
  descriptor,
  draft,
  descriptors = [],
  onSelectTheme,
  onClose,
  onApply,
}: PdfThemePreviewModalProps) {
  const { t, locale } = useI18n();
  const [zoom, setZoom] = useState<PreviewZoom>('fit');
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const renderedOnce = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const buildUrl = useCallback(() => {
    if (!descriptor) return null;
    const scope = getActiveScope();
    return pdfThemePreviewUrl({
      themeId: descriptor.id,
      options: pdfThemeOptionsFromDraft(draft, descriptor),
      locale,
      manualId: scope.manualId,
      branch: scope.branch,
      cacheBust: Date.now(),
    });
  }, [descriptor, draft, locale]);

  // Rebuild the iframe source on every draft change; the short debounce keeps colour typing and
  // brand text fields from firing one request per keystroke.
  useEffect(() => {
    if (!open || !descriptor) return;
    const immediate = !renderedOnce.current;
    setStatus('loading');
    const apply = () => {
      renderedOnce.current = true;
      setUrl(buildUrl());
    };
    if (immediate) {
      apply();
      return;
    }
    const timer = setTimeout(apply, 250);
    return () => clearTimeout(timer);
  }, [open, descriptor, buildUrl]);

  useEffect(() => {
    if (!open) {
      renderedOnce.current = false;
      setUrl(null);
      setZoom('fit');
    }
  }, [open]);

  // `<iframe onError>` fires for network failures only, so a watchdog covers error documents.
  useEffect(() => {
    if (!open || !url || status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [open, url, status]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  if (!open || !descriptor) return null;

  const retry = () => {
    setStatus('loading');
    setUrl(buildUrl());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('publish.pdf.previewTitle')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-[88vh] w-[min(1120px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <BookOpen className="h-4 w-4 text-blue-600" aria-hidden="true" />
              {t('publish.pdf.previewTitle')}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {descriptor.name}
              </span>
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                {t('publish.pdf.paperBadge', { size: draft.pageSize })}
              </span>
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                {t('publish.pdf.marginsBadge', { value: draft.margins })}
              </span>
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{t('publish.pdf.previewHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            aria-label={t('publish.pdf.previewClose')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
          {descriptors.length > 0 && onSelectTheme ? (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label={t('publish.pdf.groupAria')}
            >
              {descriptors.map((item) => {
                const active = item.id === descriptor.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectTheme(item)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${
                      active
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: item.previewPalette.accent }}
                      aria-hidden="true"
                    />
                    {item.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <span />
          )}
          <div
            className="flex items-center rounded-md border border-slate-300 bg-white p-0.5"
            role="group"
            aria-label={t('publish.pdf.zoomAria')}
          >
            {(
              [
                { id: 'fit', labelKey: 'publish.pdf.zoom.fit', icon: Minimize2 },
                { id: 'actual', labelKey: 'publish.pdf.zoom.actual', icon: Maximize2 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={zoom === item.id}
                  onClick={() => setZoom(item.id)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                    zoom === item.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-slate-200/70 p-4">
          <div
            className="mx-auto h-full overflow-hidden rounded-lg bg-white shadow-lg"
            style={{ width: zoom === 'fit' ? '100%' : '860px', maxWidth: zoom === 'fit' ? '100%' : undefined }}
          >
            {url ? (
              <iframe
                key={url}
                src={url}
                title={t('publish.pdf.previewTitle')}
                className="h-full w-full border-0 bg-white"
                onLoad={() => setStatus('ready')}
                onError={() => setStatus('error')}
              />
            ) : null}
          </div>
          {status === 'loading' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-200/90 text-[11px] text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
              {t('publish.pdf.previewLoading')}
              <div className="mt-1 flex gap-2">
                <div className="h-28 w-20 animate-pulse rounded-sm bg-white shadow" />
                <div className="h-28 w-20 animate-pulse rounded-sm bg-white shadow" />
              </div>
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/95 text-[11px] text-rose-700">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
              {t('publish.pdf.previewFailed')}
              <button type="button" onClick={retry} className="dita-mini-btn bg-white px-2 py-1">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {t('publish.pdf.previewRetry')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 px-4 py-2">
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <FileText className="h-3 w-3" aria-hidden="true" />
            {draft.fontFamily} · {draft.fontSize}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="dita-mini-btn ml-auto bg-white px-2.5 py-1"
          >
            {t('publish.pdf.previewClose')}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800"
          >
            {t('publish.pdf.previewApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
