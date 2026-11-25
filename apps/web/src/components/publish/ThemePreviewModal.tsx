import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Monitor, RefreshCw, Smartphone, Tablet, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import { getActiveScope } from '../../services/active-scope.js';
import { htmlThemePreviewUrl } from '../../services/publish-api.js';
import type { HtmlThemeDescriptor } from '../../services/publish-api.js';
import { themeOptionsFromDraft } from './html-theme-model.js';
import type { ThemeDraft } from './html-theme-model.js';

type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
type PreviewStatus = 'loading' | 'ready' | 'error';

const DEVICE_WIDTH: Record<PreviewDevice, number | null> = {
  desktop: null,
  tablet: 768,
  mobile: 390,
};

const PREVIEW_TIMEOUT_MS = 12_000;

export interface ThemePreviewModalProps {
  open: boolean;
  descriptor: HtmlThemeDescriptor | null;
  draft: ThemeDraft;
  /** Every catalogue entry, so readers can compare themes without closing the dialog. */
  descriptors?: HtmlThemeDescriptor[];
  onSelectTheme?: (descriptor: HtmlThemeDescriptor) => void;
  onClose: () => void;
  onApply: (draft: ThemeDraft) => void;
}

export function ThemePreviewModal({
  open,
  descriptor,
  draft,
  descriptors = [],
  onSelectTheme,
  onClose,
  onApply,
}: ThemePreviewModalProps) {
  const { t, locale } = useI18n();
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('loading');
  const renderedOnce = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const { themeId, mode } = draft;
  const buildUrl = useCallback(() => {
    if (!descriptor) return null;
    const scope = getActiveScope();
    return htmlThemePreviewUrl({
      themeId,
      mode,
      options: themeOptionsFromDraft(draft, descriptor),
      locale,
      manualId: scope.manualId,
      branch: scope.branch,
      cacheBust: Date.now(),
    });
  }, [descriptor, draft, locale, mode, themeId]);

  // Rebuild the iframe source on every draft change; the short debounce keeps colour typing and
  // text fields from firing one request per keystroke.
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
      setDevice('desktop');
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

  const width = DEVICE_WIDTH[device];
  const retry = () => {
    setStatus('loading');
    setUrl(buildUrl());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('publish.theme.previewTitle')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-[88vh] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Monitor className="h-4 w-4 text-blue-600" aria-hidden="true" />
              {t('publish.theme.previewTitle')}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {descriptor.name}
              </span>
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{t('publish.theme.previewHint')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            aria-label={t('publish.theme.previewClose')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
          {descriptors.length > 0 && onSelectTheme ? (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label={t('publish.theme.sectionTitle')}
            >
              {descriptors.map((item) => {
                const active = item.id === themeId;
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
            aria-label={t('publish.theme.deviceAria')}
          >
            {(
              [
                { id: 'desktop', labelKey: 'publish.theme.device.desktop', icon: Monitor },
                { id: 'tablet', labelKey: 'publish.theme.device.tablet', icon: Tablet },
                { id: 'mobile', labelKey: 'publish.theme.device.mobile', icon: Smartphone },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={device === item.id}
                  onClick={() => setDevice(item.id)}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                    device === item.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {t(item.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
          <div
            className="mx-auto h-full overflow-hidden rounded-lg bg-white shadow-lg"
            style={{ width: width === null ? '100%' : `${width}px`, maxWidth: '100%' }}
          >
            {url ? (
              <iframe
                key={url}
                src={url}
                title={t('publish.theme.previewTitle')}
                className="h-full w-full border-0 bg-white"
                onLoad={() => setStatus('ready')}
                onError={() => setStatus('error')}
              />
            ) : null}
          </div>
          {status === 'loading' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100/90 text-[11px] text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden="true" />
              {t('publish.theme.previewLoading')}
              <div className="mt-1 w-64 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-2 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-2 w-5/6 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          ) : null}
          {status === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/95 text-[11px] text-rose-700">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
              {t('publish.theme.previewFailed')}
              <button type="button" onClick={retry} className="dita-mini-btn bg-white px-2 py-1">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                {t('publish.theme.previewRetry')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-2">
          <button type="button" onClick={onClose} className="dita-mini-btn bg-white px-2.5 py-1">
            {t('publish.theme.previewClose')}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800"
          >
            {t('publish.theme.previewApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
